
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
    # Placeholder for now
    raise HTTPException(status_code=501, detail="Import functionality not implemented yet")
