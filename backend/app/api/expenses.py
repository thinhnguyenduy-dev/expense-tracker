from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from fastapi.responses import StreamingResponse
import csv
import io
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func
from typing import List, Optional
from datetime import date
from decimal import Decimal
import math

from ..core.database import get_db
from ..core.deps import get_current_user
from ..core.config import settings
from ..core.notifications import send_budget_warning_email, send_budget_exceeded_email
from ..models.user import User
from ..models.expense import Expense
from ..models.category import Category
from ..schemas.expense import ExpenseCreate, ExpenseUpdate, ExpenseResponse
from ..schemas.expense import ExpenseCreate, ExpenseUpdate, ExpenseResponse
from ..schemas.pagination import PaginatedResponse
from .dashboard import invalidate_user_dashboard_cache
from ..core.exchange_rate import exchange_rate_service

router = APIRouter(prefix="/expenses", tags=["Expenses"])

from fastapi import UploadFile, File
from ..schemas.import_expenses import ImportResult, ImportError
from datetime import datetime

@router.post("/import", response_model=ImportResult)
async def import_expenses(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Import expenses from a CSV file."""
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload a CSV file.")
    
    content = await file.read()
    decoded_content = content.decode("utf-8")
    csv_reader = csv.DictReader(io.StringIO(decoded_content))
    
    # Normalize headers to lowercase to be more forgiving
    headers = [h.lower() for h in csv_reader.fieldnames or []]
    
    valid_expenses = []
    errors = []
    row_index = 1 # 1-based index for user feedback (header is 0)
    
    # Pre-fetch user categories for quick lookup
    user_categories = db.query(Category).filter(Category.user_id == current_user.id).all()
    category_map = {c.name.lower(): c for c in user_categories}
    
    # Ensure "Uncategorized" category exists
    uncategorized = category_map.get("uncategorized")
    if not uncategorized:
        uncategorized = Category(name="Uncategorized", user_id=current_user.id, icon="help-circle", color="#94a3b8")
        db.add(uncategorized)
        db.commit()
        db.refresh(uncategorized)
        category_map["uncategorized"] = uncategorized
    
    for row in csv_reader:
        row_index += 1
        
        # Lowercase keys for case-insensitive matching
        row_data = {k.lower(): v.strip() for k, v in row.items()}
        
        # 1. Validate Date
        date_str = row_data.get("date")
        expense_date = None
        if not date_str:
             errors.append(ImportError(row=row_index, error="Missing date", data=row))
             continue
             
        try:
            # Try ISO format first
            expense_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            try:
                # Try DD/MM/YYYY
                expense_date = datetime.strptime(date_str, "%d/%m/%Y").date()
            except ValueError:
                 errors.append(ImportError(row=row_index, error=f"Invalid date format: {date_str}. Use YYYY-MM-DD or DD/MM/YYYY", data=row))
                 continue
        
        # 2. Validate Amount
        amount_str = row_data.get("amount")
        amount = 0.0
        if not amount_str:
            errors.append(ImportError(row=row_index, error="Missing amount", data=row))
            continue
            
        try:
            amount = float(amount_str)
        except ValueError:
            errors.append(ImportError(row=row_index, error=f"Invalid amount: {amount_str}", data=row))
            continue
            
        # 3. Resolve Category
        category_name = row_data.get("category", "").lower()
        category = category_map.get(category_name)
        
        if not category:
            # Fallback to Uncategorized if empty or not found
            category = uncategorized
            
        # 4. Description
        description = row_data.get("description", "Imported Expense")
        
        # Create Expense Object
        valid_expenses.append(Expense(
            user_id=current_user.id,
            category_id=category.id,
            amount=amount,
            date=expense_date,
            description=description
        ))
    
    # Bulk Insert
    if valid_expenses:
        db.add_all(valid_expenses)
        
        # JAR LOGIC: Deduct from Jars if linked
        # We need to process this before commit to be safe, or alongside.
        # Since we just added objects, they have category_id. We need to check categories.
        # We have category_map, so we can look up if category has jar_id.
        
        from ..services.jar_service import JarService
        
        for expense in valid_expenses:
             # Find the category object to check jar_id
             # expense.category_id is set.
             # We can't easily access expense.category relationship immediately before flush/refresh in some cases,
             # but we can look up via our local map or query if needed.
             # Actually, we assigned category object from map to expense.
             # But SQLAlchemy might not have back-populated the checking without flush.
             # Simpler: we know the category object we assigned.
             
             # Optimization: We assigned `category_id` using `category.id`. 
             # We can find the category object in `category_map` (values) that matches the ID, 
             # OR effectively we can just iterate our valid_expenses and re-lookup or carry context.
             # Better yet, in the loop above where we created Expense, we could have tracked jar updates.
             # But let's do it here to keep "Create Expense Object" clean.
             
             # We need to find the category object for this expense. 
             # Since we don't have a direct link in the list except via DB relations which aren't committed,
             # let's just use a helper map of id -> category
             pass

        # To avoid N+1 or complex lookups, let's build a map
        cat_id_to_jar_id = {c.id: c.jar_id for c in user_categories if c.jar_id}
        
        for expense in valid_expenses:
            jar_id = cat_id_to_jar_id.get(expense.category_id)
            if jar_id:
                JarService.update_jar_balance(db, jar_id, -expense.amount)

        db.commit()
        
        # Invalidate cache
        invalidate_user_dashboard_cache(current_user.id)
        
    return ImportResult(
        success_count=len(valid_expenses),
        failed_count=len(errors),
        errors=errors,
        message=f"Successfully imported {len(valid_expenses)} expenses. {len(errors)} failed."
    )



def check_budget_and_notify(db: Session, user: User, category: Category):
    """Check if budget limit is reached and send notification if needed."""
    # Safe access to budget (handle missing column case)
    budget_limit = getattr(category, "budget", 0)
    
    if not budget_limit or budget_limit <= 0:
        return  # No budget set
    
    # Get total spent in this category for current month
    today = date.today()
    first_day_of_month = today.replace(day=1)
    
    total_spent = db.query(func.coalesce(func.sum(Expense.amount), 0)).filter(
        Expense.user_id == user.id,
        Expense.category_id == category.id,
        Expense.date >= first_day_of_month
    ).scalar()
    
    total_spent = float(total_spent)
    budget = float(budget_limit)
    percentage = int((total_spent / budget) * 100)
    
    # Check thresholds
    if percentage >= settings.BUDGET_ALERT_THRESHOLD_CRITICAL:
        send_budget_exceeded_email(
            user_email=user.email,
            user_name=user.name,
            category_name=category.name,
            budget_amount=budget,
            spent_amount=total_spent,
            percentage=percentage
        )
    elif percentage >= settings.BUDGET_ALERT_THRESHOLD_WARNING:
        send_budget_warning_email(
            user_email=user.email,
            user_name=user.name,
            category_name=category.name,
            budget_amount=budget,
            spent_amount=total_spent,
            percentage=percentage
        )


@router.get("")
def get_expenses(
    start_date: Optional[date] = Query(None, description="Filter by start date"),
    end_date: Optional[date] = Query(None, description="Filter by end date"),
    category_id: Optional[int] = Query(None, description="Filter by category ID"),
    min_amount: Optional[Decimal] = Query(None, description="Filter by minimum amount"),
    max_amount: Optional[Decimal] = Query(None, description="Filter by maximum amount"),
    search: Optional[str] = Query(None, description="Search in description and category name"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    scope: str = Query("personal", description="Scope of expenses: 'personal' or 'family'"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> PaginatedResponse[ExpenseResponse]:
    """Get paginated expenses for the current user with optional filters and search."""
    
    # Determine user IDs to query
    user_ids = [current_user.id]
    if scope == "family" and current_user.family_id:
        # Get all family members with lazy loading or explicit query if needed
        # Assuming family.members is available via relationship
        # Re-query user with family to ensure relationship loaded if needed, though lazy load works mostly
        # Safe approach: Query users in family
        members = db.query(User).filter(User.family_id == current_user.family_id).all()
        user_ids = [u.id for u in members]

    query = db.query(Expense).options(
        joinedload(Expense.category)
    ).filter(Expense.user_id.in_(user_ids))
    
    # Apply filters
    if start_date:
        query = query.filter(Expense.date >= start_date)
    if end_date:
        query = query.filter(Expense.date <= end_date)
    if category_id:
        query = query.filter(Expense.category_id == category_id)
    if min_amount:
        query = query.filter(Expense.amount >= min_amount)
    if max_amount:
        query = query.filter(Expense.amount <= max_amount)
    
    # Apply search filter (search in description and category name)
    if search:
        search_term = f"%{search}%"
        query = query.join(Category).filter(
            or_(
                Expense.description.ilike(search_term),
                Category.name.ilike(search_term)
            )
        )
    
    # Get total count before pagination
    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 1
    
    # Apply pagination
    offset = (page - 1) * page_size
    expenses = query.order_by(Expense.date.desc()).offset(offset).limit(page_size).all()
    
    return PaginatedResponse[ExpenseResponse](
        items=expenses,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/export")
def export_expenses(
    start_date: Optional[date] = Query(None, description="Filter by start date"),
    end_date: Optional[date] = Query(None, description="Filter by end date"),
    category_id: Optional[int] = Query(None, description="Filter by category ID"),
    min_amount: Optional[Decimal] = Query(None, description="Filter by minimum amount"),
    max_amount: Optional[Decimal] = Query(None, description="Filter by maximum amount"),
    search: Optional[str] = Query(None, description="Search in description and category name"),
    scope: str = Query("personal", description="Scope of expenses: 'personal' or 'family'"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Export expenses as CSV."""
    
    # Determine user IDs to query
    user_ids = [current_user.id]
    if scope == "family" and current_user.family_id:
        members = db.query(User).filter(User.family_id == current_user.family_id).all()
        user_ids = [u.id for u in members]

    query = db.query(Expense).options(
        joinedload(Expense.category)
    ).filter(Expense.user_id.in_(user_ids))
    
    # Apply filters
    if start_date:
        query = query.filter(Expense.date >= start_date)
    if end_date:
        query = query.filter(Expense.date <= end_date)
    if category_id:
        query = query.filter(Expense.category_id == category_id)
    if min_amount:
        query = query.filter(Expense.amount >= min_amount)
    if max_amount:
        query = query.filter(Expense.amount <= max_amount)
    
    # Apply search filter
    if search:
        search_term = f"%{search}%"
        query = query.join(Category).filter(
            or_(
                Expense.description.ilike(search_term),
                Category.name.ilike(search_term)
            )
        )
    
    def iter_csv():
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow(["Date", "Description", "Category", "Amount", "Type"])
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)
        
        # Write data
        for expense in query.order_by(Expense.date.desc()).yield_per(1000):
            writer.writerow([
                expense.date,
                expense.description,
                expense.category.name if expense.category else "Unknown",
                expense.amount,
                expense.category.type if expense.category else "Unknown"
            ])
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

    filename = f"expenses_export_{date.today()}.csv"
    return StreamingResponse(
        iter_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def create_expense(
    expense_data: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new expense."""
    # Verify category belongs to user
    category = db.query(Category).filter(
        Category.id == expense_data.category_id,
        Category.user_id == current_user.id
    ).first()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category not found"
        )
    
    expense_data_dict = expense_data.model_dump()
    currency = expense_data_dict.pop("currency", None)
    
    # Currency Conversion Logic
    exchange_rate = None
    original_amount = None
    original_currency = None
    
    # If currency provided and different from user's base currency
    # Note: For MVP we assume user base currency is 'VND' if not set, or we should fetch from user profile.
    # Ideally current_user.currency should be used.
    user_currency = current_user.currency or "VND"
    
    if currency and currency != user_currency:
        original_amount = expense_data.amount
        original_currency = currency
        
        # Convert to base currency
        # amount (Base) = original_amount * rate
        # e.g. 10 USD * 25000 = 250,000 VND
        converted_amount = await exchange_rate_service.convert(expense_data.amount, currency, user_currency)
        
        if converted_amount:
             # Get rate used: rate = converted / original
             # or just use get_exchange_rate
             rate = await exchange_rate_service.get_exchange_rate(currency, user_currency)
             exchange_rate = rate
             
             # Update amount to be the BASE currency amount
             expense_data_dict["amount"] = converted_amount
    
    expense = Expense(
        **expense_data_dict,
        user_id=current_user.id,
        original_amount=original_amount,
        original_currency=original_currency,
        exchange_rate=exchange_rate
    )
    db.add(expense)
    
    # Deduct from Jar if linked
    if category.jar_id:
        from ..services.jar_service import JarService
        # Deducting means negative delta
        JarService.update_jar_balance(db, category.jar_id, -expense.amount)
            
    db.commit()
    db.refresh(expense)
    
    # Load category for response
    db.refresh(expense, ["category"])
    
    # Invalidate dashboard cache
    invalidate_user_dashboard_cache(current_user.id)
    
    # Check budget and send notification if needed
    check_budget_and_notify(db, current_user, category)
    
    return expense


@router.get("/{expense_id}", response_model=ExpenseResponse)
def get_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific expense."""
    expense = db.query(Expense).options(
        joinedload(Expense.category)
    ).filter(
        Expense.id == expense_id,
        Expense.user_id == current_user.id
    ).first()
    
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found"
        )
    
    return expense


@router.put("/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    expense_id: int,
    expense_data: ExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an expense."""
    expense = db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.user_id == current_user.id
    ).first()
    
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found"
        )
    
    # Capture previous state for Jar logic
    prev_amount = expense.amount
    prev_category_id = expense.category_id
    
    update_data = expense_data.model_dump(exclude_unset=True)
    
    # If updating category, verify it belongs to user
    if "category_id" in update_data:
        category = db.query(Category).filter(
            Category.id == update_data["category_id"],
            Category.user_id == current_user.id
        ).first()
        
        if not category:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Category not found"
            )
    
    for field, value in update_data.items():
        if field == "currency":
            continue # Handle separately
        setattr(expense, field, value)

    # Handle currency update if present or if amount changed
    new_currency = update_data.get("currency")
    new_amount = update_data.get("amount")
    
    if new_currency or (new_amount and expense.original_currency):
        # Determine target currency (use new one, or fall back to existing original, or user base)
        target_currency = new_currency or expense.original_currency or current_user.currency or "VND"
        
        # Determine target amount
        target_amount = new_amount if new_amount is not None else expense.original_amount
        
        # If we have a target amount and it's not the base currency (or we explicitly want to set it)
        # Actually simplest logic:
        # If currency is specified, we treat the (new or existing) amount as that currency and convert to base.
        
        user_currency = current_user.currency or "VND"
        
        if target_currency != user_currency:
             # Convert
             converted_amount = await exchange_rate_service.convert(target_amount, target_currency, user_currency)
             if converted_amount:
                 expense.amount = converted_amount
                 expense.original_amount = target_amount
                 expense.original_currency = target_currency
                 expense.exchange_rate = await exchange_rate_service.get_exchange_rate(target_currency, user_currency)
        else:
            # If target is base, clear original fields
            if new_amount is not None:
                expense.amount = new_amount
            expense.original_amount = None
            expense.original_currency = None
            expense.exchange_rate = None
    
    # JAR LOGIC: Calculate impacts
    from ..services.jar_service import JarService
    
    # 1. Did Category Change?
    if expense.category_id != prev_category_id:
        # Refund Jar associated with OLD category (using OLD amount)
        from ..models.category import Category as CatModel # Alias to avoid conflict if needed
        old_cat = db.query(CatModel).filter(CatModel.id == prev_category_id).first()
        if old_cat and old_cat.jar_id:
            JarService.update_jar_balance(db, old_cat.jar_id, prev_amount)
            
        # Deduct from Jar associated with NEW category (using NEW amount)
        # We already fetched 'category' above if category_id changed
        if category.jar_id:
             JarService.update_jar_balance(db, category.jar_id, -expense.amount)
             
    # 2. Category Same, Amount Changed?
    elif expense.amount != prev_amount:
        # Adjust Same Jar by the difference
        # Amount increase (e.g. 100 -> 150): Delta is -50 (spend 50 more)
        # Amount decrease (e.g. 100 -> 80): Delta is +20 (refund 20)
        # Formula: Refunding (old - new)
        # Example 1: 100 - 150 = -50. Add -50 to balance. OK.
        # Example 2: 100 - 80 = 20. Add 20 to balance. OK.
        
        current_cat = db.query(Category).filter(Category.id == expense.category_id).first()
        if current_cat and current_cat.jar_id:
             diff = prev_amount - expense.amount
             JarService.update_jar_balance(db, current_cat.jar_id, diff)

    db.commit()
    db.refresh(expense, ["category"])
    
    # Invalidate dashboard cache
    invalidate_user_dashboard_cache(current_user.id)
    
    return expense


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete an expense."""
    expense = db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.user_id == current_user.id
    ).first()
    
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found"
        )
    
    # Refund to Jar if linked
    if expense.category.jar_id:
        from ..services.jar_service import JarService
        JarService.update_jar_balance(db, expense.category.jar_id, expense.amount)

    db.delete(expense)
    db.commit()
    
    # Invalidate dashboard cache
    invalidate_user_dashboard_cache(current_user.id)
    
    return None


@router.post("/bulk-delete", status_code=status.HTTP_204_NO_CONTENT)
def bulk_delete_expenses(
    expense_ids: List[int] = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete multiple expenses at once."""
    if not expense_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No expense IDs provided"
        )
    
    # Fetch expenses first to handle Jar refunds
    expenses_to_delete = db.query(Expense).options(
        joinedload(Expense.category)
    ).filter(
        Expense.id.in_(expense_ids),
        Expense.user_id == current_user.id
    ).all()
    
    if not expenses_to_delete:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No expenses found to delete"
        )
        
    # Process Jar Refunds
    from ..services.jar_service import JarService
    for expense in expenses_to_delete:
        if expense.category and expense.category.jar_id:
             JarService.update_jar_balance(db, expense.category.jar_id, expense.amount)

    # Delete expenses that belong to the current user
    # We can delete individually or bulk. Bulk is faster but we already fetched objects.
    # Given we need to refund individually anyway, deleting objects via session might be cleaner for hooks
    # but bulk delete via query is faster.
    
    # Since we need to delete exactly what we found:
    ids_to_delete = [e.id for e in expenses_to_delete]
    
    deleted_count = db.query(Expense).filter(
        Expense.id.in_(ids_to_delete)
    ).delete(synchronize_session=False)
    
    db.commit()
    
    # Invalidate dashboard cache
    invalidate_user_dashboard_cache(current_user.id)
    
    return None


@router.patch("/bulk-update", response_model=List[ExpenseResponse])
def bulk_update_expenses(
    expense_ids: List[int] = Body(...),
    category_id: Optional[int] = Body(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update multiple expenses at once (change category)."""
    if not expense_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No expense IDs provided"
        )
    
    if category_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No update fields provided"
        )
    
    # Verify category belongs to user
    category = db.query(Category).filter(
        Category.id == category_id,
        Category.user_id == current_user.id
    ).first()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category not found"
        )
    
    # Fetch expenses first to handle Jar logic
    expenses_to_update = db.query(Expense).options(
        joinedload(Expense.category)
    ).filter(
        Expense.id.in_(expense_ids),
        Expense.user_id == current_user.id
    ).all()
    
    if not expenses_to_update:
        # If no expenses found, nothing to do. Return empty list? or error?
        # Logic says "update expenses", if none match, effectively 0 updated.
        return []

    # Prepare for Jar updates
    from ..services.jar_service import JarService
    
    # We update all to NEW category.
    # Logic: For each expense:
    # 1. Refund OLD Category Jar (if exists)
    # 2. Deduct NEW Category Jar (if exists)
    
    # Optimize: Check if new category has a jar
    new_cat_jar_id = category.jar_id
    
    for expense in expenses_to_update:
        # 1. Refund Old
        if expense.category and expense.category.jar_id:
            # If old jar is same as new jar, net effect is 0?
            # Wait, if we change category, even if both cats map to SAME jar, 
            # we refund old, deduct new. Result 0. Correct.
            JarService.update_jar_balance(db, expense.category.jar_id, expense.amount)
            
        # 2. Deduct New
        if new_cat_jar_id:
             JarService.update_jar_balance(db, new_cat_jar_id, -expense.amount)

    # Perform Update
    # Since we need to delete exactly what we found:
    ids_to_update = [e.id for e in expenses_to_update]
    
    db.query(Expense).filter(
        Expense.id.in_(ids_to_update)
    ).update({"category_id": category_id}, synchronize_session=False)
    
    db.commit()
    
    # Invalidate dashboard cache
    invalidate_user_dashboard_cache(current_user.id)
    
    # Fetch updated expenses
    expenses = db.query(Expense).options(
        joinedload(Expense.category)
    ).filter(
        Expense.id.in_(ids_to_update)
    ).all() # No need to filter by user again since we used verified IDs
    
    return expenses
