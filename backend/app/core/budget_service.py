from sqlalchemy.orm import Session
from datetime import date
from decimal import Decimal
from typing import Dict, List, Any
from sqlalchemy import func
from ..models.user import User
from ..models.expense import Expense
from ..models.category import Category

class BudgetService:
    def __init__(self, db: Session):
        self.db = db

    def get_budget_status(self, user_id: int) -> Dict[str, Any]:
        """
        Calculate budget status for a user (overall and per category).
        """
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return {}

        today = date.today()
        start_date = date(today.year, today.month, 1)
        
        # Calculate total spent this month
        total_spent = self.db.query(func.sum(Expense.amount)).filter(
            Expense.user_id == user_id,
            Expense.date >= start_date,
            Expense.date >= start_date
            # User request: "80% of budget". Usually "budget" includes everything.
            # Let's include everything for now, or maybe make it configurable later.
            # Actually, standard practice is ALL expenses.
        ).scalar() or Decimal(0)

        overall_status = {
            "limit": user.overall_monthly_limit,
            "spent": total_spent,
            "percentage": (total_spent / user.overall_monthly_limit * 100) if user.overall_monthly_limit and user.overall_monthly_limit > 0 else 0,
            "is_over_limit": total_spent > user.overall_monthly_limit if user.overall_monthly_limit else False,
            "is_warning": (total_spent / user.overall_monthly_limit * 100) >= 80 if user.overall_monthly_limit and user.overall_monthly_limit > 0 else False
        }

        # Calculate per-category status
        categories_status = []
        categories = self.db.query(Category).filter(
            Category.user_id == user_id, 
            Category.monthly_limit.isnot(None)
        ).all()

        for cat in categories:
            cat_spent = self.db.query(func.sum(Expense.amount)).filter(
                Expense.user_id == user_id,
                Expense.category_id == cat.id,
                Expense.date >= start_date
            ).scalar() or Decimal(0)
            
            if cat.monthly_limit and cat.monthly_limit > 0:
                categories_status.append({
                    "category_id": cat.id,
                    "category_name": cat.name,
                    "limit": cat.monthly_limit,
                    "spent": cat_spent,
                    "percentage": (cat_spent / cat.monthly_limit * 100),
                    "is_over_limit": cat_spent > cat.monthly_limit,
                    "is_warning": (cat_spent / cat.monthly_limit * 100) >= 80
                })

        return {
            "overall": overall_status,
            "categories": categories_status
        }
