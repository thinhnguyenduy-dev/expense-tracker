from typing import List, Optional
from langchain_core.tools import tool
from sqlalchemy import func
from datetime import date, timedelta
from app.core.database import SessionLocal
from app.core.budget_service import BudgetService
from app.models.category import Category
from app.models.expense import Expense
from app.models.income import Income
from app.schemas.ai import BudgetCheckResult

def make_tools(user_id: int):
    """
    Factory validation to create tools bound to a specific user.
    """
    
    @tool
    def check_budget_tool(category_name: str, amount: float) -> str:
        """
        Check if an expense of a certain amount in a category would exceed the budget.
        Returns a warning message if over budget, or a safe message.
        """
        db = SessionLocal()
        try:
            # 1. Component: Find Category
            # Simple fuzzy-ish match (case insensitive)
            category = db.query(Category).filter(
                Category.user_id == user_id,
                Category.name.ilike(f"%{category_name}%")
            ).first()
            
            if not category:
                return f"Category '{category_name}' not found. Please specify a valid category."
            
            # 2. Component: Check Budget
            service = BudgetService(db)
            status = service.get_budget_status(user_id)
            
            # Find the specific category status
            cat_status = next((c for c in status.get("categories", []) if c["category_id"] == category.id), None)
            
            if not cat_status:
                return f"No budget set for category '{category.name}'."
            
            remaining = cat_status["limit"] - cat_status["spent"]
            new_remaining = remaining - amount
            
            if new_remaining < 0:
                return (
                    f"⚠️ BUDGET ALERT: Spending ${amount} on '{category.name}' will exceed the budget by ${abs(new_remaining):.2f}. "
                    f"Remaining: ${remaining:.2f}, Limit: ${cat_status['limit']:.2f}."
                )
            else:
                return f"✅ Budget Safe: You have ${remaining:.2f} remaining in '{category.name}'. After this, you will have ${new_remaining:.2f}."
                
        finally:
            db.close()

    @tool
    def get_recent_expenses_tool(days: int = 7) -> str:
        """
        Get a summary of expenses from the last N days.
        Useful for checking if an expense was already added.
        """
        db = SessionLocal()
        try:
            start_date = date.today() - timedelta(days=days)
            expenses = db.query(Expense).filter(
                Expense.user_id == user_id,
                Expense.date >= start_date
            ).order_by(Expense.date.desc()).limit(10).all()
            
            if not expenses:
                return f"No expenses found in the last {days} days."
            
            summary = [f"- {e.date}: {e.description} (${e.amount}) [{e.category.name if e.category else 'No Category'}]" for e in expenses]
            return "\n".join(summary)
        finally:
            db.close()

    @tool
    def get_recent_incomes_tool(days: int = 30) -> str:
        """
        Get a summary of incomes from the last N days (default 30).
        Useful when the user asks to list their incomes or earnings.
        """
        db = SessionLocal()
        try:
            start_date = date.today() - timedelta(days=days)
            incomes = db.query(Income).filter(
                Income.user_id == user_id,
                Income.date >= start_date
            ).order_by(Income.date.desc()).limit(20).all()
            
            if not incomes:
                return f"No incomes found in the last {days} days."
            
            summary = [f"- {i.date}: {i.source} (+${i.amount})" for i in incomes]
            return "\n".join(summary)
        finally:
            db.close()

    @tool
    def lookup_categories_tool() -> str:
        """
        Get a list of all available categories for the user.
        """
        db = SessionLocal()
        try:
            categories = db.query(Category).filter(Category.user_id == user_id).all()
            if not categories:
                return "You have no categories. Please create some first."
            return ", ".join([c.name for c in categories])
        finally:
            db.close()

    @tool
    def submit_expense_tool(
        amount: float,
        currency: str = "VND",
        category: Optional[str] = None,
        merchant: Optional[str] = None,
        description: Optional[str] = None,
        date: Optional[str] = None
    ) -> str:
        """
        Call this tool when you have gathered all necessary information to create the expense draft.
        This signals that the conversation is complete.
        """
        # In a real agent, this might log to state, but here it marks completion.
        return "Draft Created"

    @tool
    def submit_income_tool(
        amount: float,
        source: str,
        date: Optional[str] = None
    ) -> str:
        """
        Call this tool when you have gathered all necessary information to create an income draft.
        This signals that the conversation is complete.
        """
        return "Draft Income Created"

    @tool
    def get_monthly_summary_tool(month: Optional[int] = None, year: Optional[int] = None) -> str:
        """
        Get the total spending for a specific month and a breakdown by category.
        If no month or year is provided, it defaults to the current month.
        Use this when the user asks for "total expenses", "spending this month", "last month", or "monthly summary".
        """
        db = SessionLocal()
        try:
            import calendar
            today = date.today()
            
            target_year = year if year else today.year
            target_month = month if month else today.month
            
            # Start and End Dates formulation
            first_day = date(target_year, target_month, 1)
            last_day = date(target_year, target_month, calendar.monthrange(target_year, target_month)[1])
            
            # Total spending
            total_spent = db.query(func.coalesce(func.sum(Expense.amount), 0)).filter(
                Expense.user_id == user_id,
                Expense.date >= first_day,
                Expense.date <= last_day
            ).scalar()
            
            # Category breakdown
            cat_stats = db.query(
                Category.name,
                func.sum(Expense.amount).label('total')
            ).join(Expense).filter(
                Expense.user_id == user_id,
                Expense.date >= first_day,
                Expense.date <= last_day
            ).group_by(Category.name).all()
            
            breakdown = "\n".join([f"- {name}: ${total:,.2f}" for name, total in cat_stats]) if cat_stats else "- No expenses recorded."
            
            return (
                f"📊 **Monthly Summary ({first_day.strftime('%B %Y')})**\n"
                f"**Total Spent:** ${total_spent:,.2f}\n\n"
                f"**Breakdown by Category:**\n{breakdown}"
            )
        finally:
            db.close()

    return [check_budget_tool, get_recent_expenses_tool, get_recent_incomes_tool, lookup_categories_tool, submit_expense_tool, submit_income_tool, get_monthly_summary_tool]
