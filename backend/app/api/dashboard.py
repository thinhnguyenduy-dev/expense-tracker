from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import date, timedelta
from decimal import Decimal
from typing import List

from ..core.database import get_db
from ..core.deps import get_current_user
from ..models.user import User
from ..models.expense import Expense
from ..models.category import Category
from ..schemas.dashboard import DashboardStats, CategoryStat, MonthlyTrend

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("", response_model=DashboardStats)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get dashboard statistics for the current user."""
    today = date.today()
    
    # Total expenses (all time)
    total_expenses = db.query(func.coalesce(func.sum(Expense.amount), 0)).filter(
        Expense.user_id == current_user.id
    ).scalar()
    
    # Total this month
    first_day_of_month = today.replace(day=1)
    total_this_month = db.query(func.coalesce(func.sum(Expense.amount), 0)).filter(
        Expense.user_id == current_user.id,
        Expense.date >= first_day_of_month
    ).scalar()
    
    # Total this week (Monday to Sunday)
    days_since_monday = today.weekday()
    first_day_of_week = today - timedelta(days=days_since_monday)
    total_this_week = db.query(func.coalesce(func.sum(Expense.amount), 0)).filter(
        Expense.user_id == current_user.id,
        Expense.date >= first_day_of_week
    ).scalar()
    
    # Expenses by category
    category_stats_query = db.query(
        Category.id,
        Category.name,
        Category.color,
        func.coalesce(func.sum(Expense.amount), 0).label('total')
    ).outerjoin(
        Expense, 
        (Expense.category_id == Category.id) & (Expense.user_id == current_user.id)
    ).filter(
        Category.user_id == current_user.id
    ).group_by(
        Category.id, Category.name, Category.color
    ).all()
    
    expenses_by_category: List[CategoryStat] = []
    for cat_id, cat_name, cat_color, cat_total in category_stats_query:
        percentage = 0.0
        if total_expenses > 0:
            percentage = float(cat_total) / float(total_expenses) * 100
        
        expenses_by_category.append(CategoryStat(
            category_id=cat_id,
            category_name=cat_name,
            category_color=cat_color,
            total=cat_total,
            percentage=round(percentage, 2)
        ))
    
    # Monthly trend (last 6 months)
    monthly_trend: List[MonthlyTrend] = []
    for i in range(5, -1, -1):
        target_date = today - timedelta(days=i * 30)
        month_start = target_date.replace(day=1)
        if target_date.month == 12:
            month_end = target_date.replace(year=target_date.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            month_end = target_date.replace(month=target_date.month + 1, day=1) - timedelta(days=1)
        
        month_total = db.query(func.coalesce(func.sum(Expense.amount), 0)).filter(
            Expense.user_id == current_user.id,
            Expense.date >= month_start,
            Expense.date <= month_end
        ).scalar()
        
        monthly_trend.append(MonthlyTrend(
            month=month_start.strftime("%b %Y"),
            total=month_total
        ))
    
    return DashboardStats(
        total_expenses=total_expenses,
        total_this_month=total_this_month,
        total_this_week=total_this_week,
        expenses_by_category=expenses_by_category,
        monthly_trend=monthly_trend
    )
