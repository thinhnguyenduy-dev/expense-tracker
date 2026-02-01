
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import io
import zipfile
from datetime import datetime
from fastapi.responses import StreamingResponse

from app.core.database import get_db
from app.core.security import get_current_user
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
    Export all user data (Expenses, Incomes) as a ZIP file containing CSVs.
    """
    # BytesIO buffer for the zip file
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        # 1. Export Expenses
        expenses = db.query(Expense).filter(Expense.user_id == current_user.id).all()
        expenses_data = []
        for e in expenses:
            expenses_data.append({
                "date": e.date.isoformat() if e.date else "",
                "amount": e.amount,
                "description": e.description,
                "category": e.category.name if e.category else "Uncategorized",
                "payment_method": e.payment_method or ""
            })
        expenses_csv = generate_csv(expenses_data)
        zip_file.writestr("expenses.csv", expenses_csv)
        
        # 2. Export Incomes
        incomes = db.query(Income).filter(Income.user_id == current_user.id).all()
        incomes_data = []
        for i in incomes:
            incomes_data.append({
                "date": i.date.isoformat() if i.date else "",
                "amount": i.amount,
                "description": i.description,
                "source": i.source or ""
            })
        incomes_csv = generate_csv(incomes_data)
        zip_file.writestr("incomes.csv", incomes_csv)

    # Reset pointer
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
    Import data from CSV. TO BE IMPLEMENTED.
    """
    # Parse CSV content
    content = await file.read()
    try:
        rows = parse_csv(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid CSV file: {str(e)}")

    if not rows:
        return {"message": "Empty CSV file", "imported_count": 0}

    # Detect type based on headers
    headers = set(rows[0].keys())
    
    imported_count = 0
    
    # Check for Expense headers
    if {"date", "amount", "description", "category"}.issubset(headers):
        for row in rows:
            try:
                # Parse date
                row_date = datetime.strptime(row["date"].split("T")[0], "%Y-%m-%d").date()
                
                # Find or create category
                category_name = row.get("category") or "Uncategorized"
                category = db.query(Category).filter(
                    Category.user_id == current_user.id,
                    Category.name == category_name
                ).first()
                
                if not category:
                    # Create new category
                    category = Category(
                        user_id=current_user.id,
                        name=category_name,
                        icon="📦", # Default icon
                        color="#94a3b8" # Default color (slate-400)
                    )
                    db.add(category)
                    db.commit()
                    db.refresh(category)
                
                expense = Expense(
                    user_id=current_user.id,
                    amount=float(row["amount"]),
                    description=row["description"],
                    date=row_date,
                    category_id=category.id,
                    payment_method=row.get("payment_method")
                )
                db.add(expense)
                imported_count += 1
            except Exception as e:
                print(f"Skipping row {row}: {e}")
                continue
                
        db.commit()
        return {"message": "Expenses imported successfully", "imported_count": imported_count, "type": "expense"}

    # Check for Income headers
    elif {"date", "amount", "description", "source"}.issubset(headers):
        for row in rows:
            try:
                 # Parse date
                row_date = datetime.strptime(row["date"].split("T")[0], "%Y-%m-%d").date()
                
                income = Income(
                    user_id=current_user.id,
                    amount=float(row["amount"]),
                    description=row["description"],
                    date=row_date,
                    source=row["source"]
                )
                db.add(income)
                imported_count += 1
            except Exception as e:
                 print(f"Skipping row {row}: {e}")
                 continue
                 
        db.commit()
        return {"message": "Incomes imported successfully", "imported_count": imported_count, "type": "income"}

    else:
        raise HTTPException(
            status_code=400, 
            detail="Unknown CSV format. Required headers for Expenses: date, amount, description, category. For Incomes: date, amount, description, source."
        )
