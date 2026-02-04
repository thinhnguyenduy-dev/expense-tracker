
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import io
import zipfile
from datetime import datetime
from fastapi.responses import StreamingResponse

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.expense import Expense
from app.models.income import Income
from app.models.category import Category
from app.utils.csv_handler import generate_csv, parse_csv

router = APIRouter()

@router.get("/export", response_class=StreamingResponse)
async def export_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Export all user data as a ZIP file containing CSVs.
    """
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        # 1. Export Jars
        from app.models.jar import Jar
        jars = db.query(Jar).filter(Jar.user_id == current_user.id).all()
        jars_data = []
        for j in jars:
            jars_data.append({
                "name": j.name,
                "percentage": j.percentage,
                "balance": j.balance
            })
        zip_file.writestr("jars.csv", generate_csv(jars_data))
        
        # 2. Export Categories
        categories = db.query(Category).filter(Category.user_id == current_user.id).all()
        categories_data = []
        for c in categories:
            categories_data.append({
                "name": c.name,
                "icon": c.icon,
                "color": c.color,
                "monthly_limit": c.monthly_limit or 0,
                "jar": c.jar.name if c.jar else "" # Export Jar Name for linking
            })
        zip_file.writestr("categories.csv", generate_csv(categories_data))

        # 3. Export Goals
        from app.models.goal import Goal
        goals = db.query(Goal).filter(Goal.user_id == current_user.id).all()
        goals_data = []
        for g in goals:
            goals_data.append({
                "name": g.name,
                "description": g.description or "",
                "target_amount": g.target_amount,
                "current_amount": g.current_amount,
                "deadline": g.deadline.isoformat() if g.deadline else "",
                "color": g.color
            })
        zip_file.writestr("goals.csv", generate_csv(goals_data))

        # 4. Export Expenses
        expenses = db.query(Expense).filter(Expense.user_id == current_user.id).all()
        expenses_data = []
        for e in expenses:
            expenses_data.append({
                "date": e.date.isoformat() if e.date else "",
                "amount": e.amount,
                "description": e.description,
                "category": e.category.name if e.category else "Uncategorized",

            })
        zip_file.writestr("expenses.csv", generate_csv(expenses_data))
        
        # 5. Export Incomes
        incomes = db.query(Income).filter(Income.user_id == current_user.id).all()
        incomes_data = []
        for i in incomes:
            incomes_data.append({
                "date": i.date.isoformat() if i.date else "",
                "amount": i.amount,
                "source": i.source or ""
            })
        zip_file.writestr("incomes.csv", generate_csv(incomes_data))

        # 6. Export Recurring Expenses
        from app.models.recurring_expense import RecurringExpense
        recurring = db.query(RecurringExpense).filter(RecurringExpense.user_id == current_user.id).all()
        recurring_data = []
        for r in recurring:
            recurring_data.append({
                "amount": r.amount,
                "description": r.description,
                "frequency": r.frequency,
                "day_of_month": r.day_of_month if r.day_of_month else "",
                "day_of_week": r.day_of_week if r.day_of_week is not None else "",
                "start_date": r.start_date.isoformat() if r.start_date else "",
                "end_date": r.end_date.isoformat() if r.end_date else "",
                "is_active": r.is_active,
                "last_created": r.last_created.isoformat() if r.last_created else "",
                "last_reminder_date": r.last_reminder_date.isoformat() if r.last_reminder_date else "",
                "category": r.category.name if r.category else "Uncategorized"
            })
        zip_file.writestr("recurring_expenses.csv", generate_csv(recurring_data))

    zip_buffer.seek(0)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"expense_tracker_export_{timestamp}.zip"
    
    return StreamingResponse(
        zip_buffer, 
        media_type="application/zip", 
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.post("/import")
async def import_data(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Import data from a CSV file or a ZIP file containing multiple CSVs.
    Supported CSVs: expenses.csv, incomes.csv, categories.csv, jars.csv, goals.csv.
    """
    imported_summary = []
    
    # Helper to process a single CSV content
    def process_rows(rows: List[dict]) -> dict:
        if not rows:
            return {"message": "Empty rows", "count": 0, "type": "unknown"}
            
        headers = set(rows[0].keys())
        count = 0
        type_name = "unknown"

        # 1. Detect Jars
        if {"name", "percentage", "balance"}.issubset(headers):
            type_name = "jar"
            from app.models.jar import Jar
            import re
            
            # Fetch all existing jars once for efficient matching
            existing_jars = db.query(Jar).filter(Jar.user_id == current_user.id).all()
            
            for row in rows:
                try:
                    imported_name = row["name"].strip()
                    target_jar = None
                    
                    # Strategy 1: Exact Name Match
                    target_jar = next((j for j in existing_jars if j.name == imported_name), None)
                    
                    # Strategy 2: Smart Code Match (e.g. "Necessities (NEC)" matches "Chi tieu (NEC)")
                    if not target_jar:
                        # Extract code like (NEC), (FFA)
                        code_match = re.search(r'\(([A-Z]{3,4})\)$', imported_name)
                        if code_match:
                            code = code_match.group(1)
                            # Find existing jar that contains this code
                            target_jar = next((j for j in existing_jars if f"({code})" in j.name), None)
                    
                    if target_jar:
                        # Update existing jar
                        target_jar.balance = float(row["balance"])
                        target_jar.percentage = float(row["percentage"])
                        # Optional: Update name to match the imported file (syncing language)
                        # Only update if the base code matches to avoid accidents, but code match implies it is safe.
                        target_jar.name = imported_name 
                        count += 1
                    else:
                        # Create new jar
                        new_jar = Jar(
                            user_id=current_user.id, 
                            name=imported_name, 
                            percentage=float(row["percentage"]),
                            balance=float(row["balance"])
                        )
                        db.add(new_jar)
                        # Add to local list to correctly handle duplicates within the same file if any
                        existing_jars.append(new_jar)
                        count += 1
                        
                except Exception:
                    continue

        # 2. Detect Categories
        elif {"name", "icon", "color"}.issubset(headers):
            type_name = "category"
            from app.models.jar import Jar
            for row in rows:
                try:
                    existing = db.query(Category).filter(Category.user_id == current_user.id, Category.name == row["name"]).first()
                    if not existing:
                        jar_id = None
                        if row.get("jar"):
                            jar = db.query(Jar).filter(Jar.user_id == current_user.id, Jar.name == row["jar"]).first()
                            if jar: jar_id = jar.id
                        
                        db.add(Category(
                            user_id=current_user.id,
                            name=row["name"],
                            icon=row["icon"],
                            color=row["color"],
                            monthly_limit=float(row["monthly_limit"]) if row.get("monthly_limit") else None,
                            jar_id=jar_id
                        ))
                        count += 1
                except Exception:
                    continue

        # 3. Detect Goals
        elif {"name", "target_amount", "current_amount"}.issubset(headers):
            type_name = "goal"
            from app.models.goal import Goal
            for row in rows:
                try:
                    existing = db.query(Goal).filter(Goal.user_id == current_user.id, Goal.name == row["name"]).first()
                    if not existing:
                        deadline = None
                        if row.get("deadline"):
                            deadline = datetime.strptime(row["deadline"].split("T")[0], "%Y-%m-%d").date()
                        
                        db.add(Goal(
                            user_id=current_user.id,
                            name=row["name"],
                            description=row.get("description"),
                            target_amount=float(row["target_amount"]),
                            current_amount=float(row["current_amount"]),
                            deadline=deadline,
                            color=row.get("color")
                        ))
                        count += 1
                except Exception:
                    continue

        # 4. Expenses
        elif {"date", "amount", "description", "category"}.issubset(headers):
            type_name = "expense"
            for row in rows:
                try:
                    row_date = datetime.strptime(row["date"].split("T")[0], "%Y-%m-%d").date()
                    category_name = row.get("category") or "Uncategorized"
                    category = db.query(Category).filter(
                        Category.user_id == current_user.id,
                        Category.name == category_name
                    ).first()
                    
                    if not category:
                        category = Category(
                            user_id=current_user.id, 
                            name=category_name, 
                            icon="📦", 
                            color="#94a3b8"
                        )
                        db.add(category)
                        db.commit()
                        db.refresh(category)
                    
                    # Duplicate Check
                    existing_expense = db.query(Expense).filter(
                        Expense.user_id == current_user.id,
                        Expense.amount == float(row["amount"]),
                        Expense.description == row["description"],
                        Expense.date == row_date,
                        Expense.category_id == category.id
                    ).first()

                    if not existing_expense:
                        db.add(Expense(
                            user_id=current_user.id,
                            amount=float(row["amount"]),
                            description=row["description"],
                            date=row_date,
                            category_id=category.id
                        ))
                        count += 1
                except Exception as e:
                    continue

        # 5. Incomes
        elif {"date", "amount", "source"}.issubset(headers):
            type_name = "income"
            for row in rows:
                try:
                    row_date = datetime.strptime(row["date"].split("T")[0], "%Y-%m-%d").date()
                    
                    # Duplicate Check
                    existing_income = db.query(Income).filter(
                        Income.user_id == current_user.id,
                        Income.amount == float(row["amount"]),
                        Income.date == row_date,
                        Income.source == row["source"]
                    ).first()

                    if not existing_income:
                        db.add(Income(
                            user_id=current_user.id,
                            amount=float(row["amount"]),
                            date=row_date,
                            source=row["source"]
                        ))
                        count += 1
                except Exception:
                    continue

        # 6. Recurring Expenses
        elif {"amount", "description", "frequency", "start_date", "category"}.issubset(headers):
            type_name = "recurring_expense"
            from app.models.recurring_expense import RecurringExpense
            
            for row in rows:
                try:
                    # Parse dates
                    start_date = datetime.strptime(row["start_date"].split("T")[0], "%Y-%m-%d").date()
                    end_date = None
                    if row.get("end_date"):
                        end_date = datetime.strptime(row["end_date"].split("T")[0], "%Y-%m-%d").date()
                    
                    last_created = None
                    if row.get("last_created"):
                        last_created = datetime.strptime(row["last_created"].split("T")[0], "%Y-%m-%d").date()

                    last_reminder_date = None
                    if row.get("last_reminder_date"):
                        last_reminder_date = datetime.strptime(row["last_reminder_date"].split("T")[0], "%Y-%m-%d").date()

                    # Find or create category
                    category_name = row.get("category") or "Uncategorized"
                    category = db.query(Category).filter(
                        Category.user_id == current_user.id,
                        Category.name == category_name
                    ).first()
                    
                    if not category:
                        category = Category(
                            user_id=current_user.id, 
                            name=category_name, 
                            icon="📦", 
                            color="#94a3b8"
                        )
                        db.add(category)
                        db.commit()
                        db.refresh(category)

                    # Duplicate Check
                    existing_recurring = db.query(RecurringExpense).filter(
                        RecurringExpense.user_id == current_user.id,
                        RecurringExpense.amount == float(row["amount"]),
                        RecurringExpense.description == row["description"],
                        RecurringExpense.frequency == row["frequency"],
                        RecurringExpense.start_date == start_date,
                        RecurringExpense.category_id == category.id
                    ).first()

                    if not existing_recurring:
                        # Create Recurring Expense
                        db.add(RecurringExpense(
                            user_id=current_user.id,
                            amount=float(row["amount"]),
                            description=row["description"],
                            frequency=row["frequency"],
                            day_of_month=int(float(row["day_of_month"])) if row.get("day_of_month") else None,
                            day_of_week=int(float(row["day_of_week"])) if row.get("day_of_week") else None,
                            start_date=start_date,
                            end_date=end_date,
                            is_active=str(row.get("is_active")).lower() == "true",
                            last_created=last_created,
                            last_reminder_date=last_reminder_date,
                            category_id=category.id
                        ))
                        count += 1
                except Exception as e:
                    print(f"Error importing recurring expense: {e}")
                    continue
        
        else:
            return {"message": "Unknown format", "count": 0, "type": "unknown"}

        db.commit()
        return {"message": f"Imported {type_name}s", "count": count, "type": type_name}


    # Handle ZIP file
    if file.filename.endswith(".zip"):
        content = await file.read()
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as z:
                # Order matters: Jars -> Categories -> Goals -> Expenses -> Incomes -> Recurring Expenses
                process_order = ['jars.csv', 'categories.csv', 'goals.csv', 'expenses.csv', 'incomes.csv', 'recurring_expenses.csv']
                
                # Also check for files that might be just names without checking strict order if named differently
                # But strict order is safer for dependencies.
                
                for filename in process_order:
                    if filename in z.namelist():
                        with z.open(filename) as f:
                            rows = parse_csv(f.read())
                            if rows:
                                res = process_rows(rows)
                                imported_summary.append(f"{filename}: {res['count']} imported")
            
        except zipfile.BadZipFile:
            raise HTTPException(status_code=400, detail="Invalid ZIP file")
            
    # Handle single CSV file
    else:
        content = await file.read()
        try:
            rows = parse_csv(content)
            res = process_rows(rows)
            imported_summary.append(f"{res['type']}: {res['count']} imported")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid CSV file: {str(e)}")

    # Invalidate dashboard cache
    from .dashboard import invalidate_user_dashboard_cache
    invalidate_user_dashboard_cache(current_user.id)

    return {
        "message": "Import completed successfully",
        "details": imported_summary
    }
