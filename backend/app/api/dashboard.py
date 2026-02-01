from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta
from decimal import Decimal
from typing import List

from ..core.database import get_db
from ..core.deps import get_current_user
from ..core.cache import cached, invalidate_cache_pattern
from ..models.user import User
from ..models.expense import Expense
from ..models.category import Category
from ..schemas.dashboard import DashboardStats, CategoryStat, MonthlyTrend

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def compute_dashboard_stats(db: Session, user_id: int) -> dict:
    """Compute dashboard statistics for a user. This is the cached computation."""
    today = date.today()
    
    # Total expenses (all time)
    total_expenses = db.query(func.coalesce(func.sum(Expense.amount), 0)).filter(
        Expense.user_id == user_id
    ).scalar()
    
    # Total this month
    first_day_of_month = today.replace(day=1)
    total_this_month = db.query(func.coalesce(func.sum(Expense.amount), 0)).filter(
        Expense.user_id == user_id,
        Expense.date >= first_day_of_month
    ).scalar()
    
    # Total this week (Monday to Sunday)
    days_since_monday = today.weekday()
    first_day_of_week = today - timedelta(days=days_since_monday)
    total_this_week = db.query(func.coalesce(func.sum(Expense.amount), 0)).filter(
        Expense.user_id == user_id,
        Expense.date >= first_day_of_week
    ).scalar()
    
    # Expenses by category
    category_stats_query = db.query(
        Category.id,
        Category.name,
        Category.color,
        Category.monthly_limit,
        func.coalesce(func.sum(Expense.amount), 0).label('total')
    ).outerjoin(
        Expense, 
        (Expense.category_id == Category.id) & (Expense.user_id == user_id)
    ).filter(
        Category.user_id == user_id
    ).group_by(
        Category.id, Category.name, Category.color, Category.monthly_limit
    ).all()
    
    expenses_by_category = []
    for cat_id, cat_name, cat_color, cat_limit, cat_total in category_stats_query:
        percentage = 0.0
        if total_expenses > 0:
            percentage = float(cat_total) / float(total_expenses) * 100
        
        expenses_by_category.append({
            "category_id": cat_id,
            "category_name": cat_name,
            "category_color": cat_color,
            "total": float(cat_total),
            "percentage": round(percentage, 2),
            "monthly_limit": float(cat_limit) if cat_limit else None
        })
    
    # Monthly trend (last 6 months)
    monthly_trend = []
    for i in range(5, -1, -1):
        target_date = today - timedelta(days=i * 30)
        month_start = target_date.replace(day=1)
        if target_date.month == 12:
            month_end = target_date.replace(year=target_date.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            month_end = target_date.replace(month=target_date.month + 1, day=1) - timedelta(days=1)
        
        month_total = db.query(func.coalesce(func.sum(Expense.amount), 0)).filter(
            Expense.user_id == user_id,
            Expense.date >= month_start,
            Expense.date <= month_end
        ).scalar()
        
        monthly_trend.append({
        "monthly": month_start.strftime("%b %Y"),
            "total": float(month_total)
        })

    # Count due recurring expenses
    from ..models.recurring_expense import RecurringExpense
    recurring_expenses = db.query(RecurringExpense).filter(
        RecurringExpense.user_id == user_id,
        RecurringExpense.is_active == True
    ).all()
    
    due_count = 0
    today = date.today()
    for recurring in recurring_expenses:
        next_due = recurring.next_due_date
        if next_due and next_due <= today:
            due_count += 1
            
    return {
        "total_expenses": float(total_expenses),
        "total_this_month": float(total_this_month),
        "total_this_week": float(total_this_week),
        "expenses_by_category": expenses_by_category,
        "monthly_trend": monthly_trend,
        "due_recurring_count": due_count
    }


@router.get("", response_model=DashboardStats)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get dashboard statistics for the current user. Results are cached for 5 minutes."""
    
    # Use caching wrapper - the cache key is based on user_id
    @cached(prefix=f"dashboard_stats_{current_user.id}")
    def get_cached_stats():
        return compute_dashboard_stats(db, current_user.id)
    
    stats_dict = get_cached_stats()
    
    # Convert dict back to Pydantic model
    return DashboardStats(
        total_expenses=Decimal(str(stats_dict["total_expenses"])),
        total_this_month=Decimal(str(stats_dict["total_this_month"])),
        total_this_week=Decimal(str(stats_dict["total_this_week"])),
        expenses_by_category=[
            CategoryStat(
                category_id=cat["category_id"],
                category_name=cat["category_name"],
                category_color=cat["category_color"],
                total=Decimal(str(cat["total"])),
                percentage=cat["percentage"],
                monthly_limit=cat["monthly_limit"]
            )
            for cat in stats_dict["expenses_by_category"]
        ],
        monthly_trend=[
            MonthlyTrend(
                month=trend["month"],
                total=Decimal(str(trend["total"]))
            )
            for trend in stats_dict["monthly_trend"]
            for trend in stats_dict["monthly_trend"]
        ],
        due_recurring_count=stats_dict["due_recurring_count"]
    )


def invalidate_user_dashboard_cache(user_id: int):
    """Invalidate dashboard cache for a specific user. Call this after expense changes."""
    invalidate_cache_pattern(f"dashboard_stats_{user_id}")
