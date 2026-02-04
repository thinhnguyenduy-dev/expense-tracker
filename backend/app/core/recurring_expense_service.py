from sqlalchemy.orm import Session
from datetime import date
from typing import List, Tuple
from ..models.recurring_expense import RecurringExpense
from ..models.expense import Expense
from ..models.user import User
from ..core.email import email_service
from ..api.dashboard import invalidate_user_dashboard_cache

class RecurringExpenseService:
    def __init__(self, db: Session):
        self.db = db

    def process_all_due_expenses(self) -> int:
        """
        Find and process all recurring expenses that are due and haven't been created yet.
        Returns the number of expenses successfully created.
        """
        today = date.today()
        
        # Find all active recurring expenses
        # Filter is simpler in Python for complex "due" logic, but SQL is faster.
        # "Due" logic relies on next_due_date property on the model which is calculated.
        # We can't easily query on a property.
        # So we query active ones and filter in code, or try to replicate logic in SQL.
        
        # Given the property logic is:
        # if frequency == monthly: date(today.year, today.month, day_of_month)
        # if frequency == weekly: next occurrence of day_of_week
        # This is hard to query.
        
        # However, we can check if last_created is "old enough".
        # But simplest way for now (since scale is small): Iterate all active.
        
        active_recurrings = self.db.query(RecurringExpense).filter(
            RecurringExpense.is_active == True
        ).all()
        
        count = 0
        processed_users = set()
        
        for recurring in active_recurrings:
            next_due = recurring.next_due_date
            
            # If due date is today or in the past
            if next_due and next_due <= today:
                # Double check we haven't already created it for this due date?
                # next_due_date logic usually advances after creation if based on last_created.
                # Let's check the logic:
                # recurring.next_due_date uses self.last_created to determine the NEXT one.
                # So if next_due_date <= today, it means we haven't created it yet.
                
                try:
                    self.create_expense_from_recurring(recurring, next_due)
                    count += 1
                    processed_users.add(recurring.user_id)
                except Exception as e:
                    print(f"Error processing recurring {recurring.id}: {e}")
                    
        # Invalidate caches for affected users
        for user_id in processed_users:
            try:
                invalidate_user_dashboard_cache(user_id)
            except:
                pass
                
        return count

    def create_expense_from_recurring(self, recurring: RecurringExpense, due_date: date) -> Expense:
        """Create an expense record from a recurring template."""
        
        # Create the expense
        expense = Expense(
            user_id=recurring.user_id,
            category_id=recurring.category_id,
            amount=recurring.amount,
            description=recurring.description,
            date=due_date
        )
        self.db.add(expense)
        
        # Update last_created to the due_date we just processed
        recurring.last_created = due_date
        
        self.db.commit()
        self.db.refresh(expense)
        return expense
