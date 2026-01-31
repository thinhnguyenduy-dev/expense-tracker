from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta
from typing import Optional

from ..core.database import get_db
from ..core.deps import get_current_user
from ..models.user import User
from ..models.expense import Expense
from ..models.category import Category
from ..schemas.reports import ReportResponse, DailyExpense, CategoryReport

router = APIRouter()

@router.get("/", response_model=ReportResponse)
def get_reports(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get aggregated report data for a specific date range."""
    # Default to last 30 days if no dates provided
    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = end_date - timedelta(days=29)
        
    # --- 1. Daily Expenses Trend ---
    daily_query = db.query(
        Expense.date,
        func.sum(Expense.amount).label('total')
    ).filter(
        Expense.user_id == current_user.id,
        Expense.date >= start_date,
        Expense.date <= end_date
    ).group_by(
        Expense.date
    ).order_by(
        Expense.date
    ).all()
    
    # Fill in missing dates with 0
    daily_expenses = []
    current = start_date
    daily_map = {d.date: d.total for d in daily_query}
    
    while current <= end_date:
        amount = daily_map.get(current, 0)
        daily_expenses.append({
            "date": current,
            "amount": amount
        })
        current += timedelta(days=1)
        
    # --- 2. Category Breakdown ---
    category_query = db.query(
        Category.id,
        Category.name,
        Category.color,
        func.sum(Expense.amount).label('total')
    ).join(
        Expense, Expense.category_id == Category.id
    ).filter(
        Expense.user_id == current_user.id,
        Expense.date >= start_date,
        Expense.date <= end_date
    ).group_by(
        Category.id, Category.name, Category.color
    ).all()
    
    total_period = sum(item.total for item in category_query)
    
    category_breakdown = []
    for item in category_query:
        percentage = (float(item.total) / float(total_period) * 100) if total_period > 0 else 0
        category_breakdown.append({
            "category_id": item.id,
            "category_name": item.name,
            "category_color": item.color,
            "amount": item.total,
            "percentage": round(percentage, 2)
        })
        
    return {
        "daily_expenses": daily_expenses,
        "category_breakdown": category_breakdown,
        "total_period": total_period,
        "period_start": start_date,
        "period_end": end_date
    }
