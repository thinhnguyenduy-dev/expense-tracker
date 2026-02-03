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
        from ..models.jar import Jar
        jar = db.query(Jar).filter(Jar.id == category.jar_id).first()
        if jar:
            jar.balance -= expense.amount
            
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
        from ..models.jar import Jar
        jar = db.query(Jar).filter(Jar.id == expense.category.jar_id).first()
        if jar:
            jar.balance += expense.amount

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
    
    # Delete expenses that belong to the current user
    deleted_count = db.query(Expense).filter(
        Expense.id.in_(expense_ids),
        Expense.user_id == current_user.id
    ).delete(synchronize_session=False)
    
    db.commit()
    
    if deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No expenses found to delete"
        )
    
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
    
    # Update expenses that belong to the current user
    db.query(Expense).filter(
        Expense.id.in_(expense_ids),
        Expense.user_id == current_user.id
    ).update({"category_id": category_id}, synchronize_session=False)
    
    db.commit()
    
    # Invalidate dashboard cache
    invalidate_user_dashboard_cache(current_user.id)
    
    # Fetch updated expenses
    expenses = db.query(Expense).options(
        joinedload(Expense.category)
    ).filter(
        Expense.id.in_(expense_ids),
        Expense.user_id == current_user.id
    ).all()
    
    return expenses
