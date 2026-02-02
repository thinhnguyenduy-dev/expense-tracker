from sqlalchemy.orm import Session
from datetime import date, timedelta
from typing import List
from ..models.recurring_expense import RecurringExpense
from ..models.user import User
from ..core.email import email_service

class ReminderService:
    def __init__(self, db: Session):
        self.db = db

    async def process_reminders(self):
        """
        Check for recurring expenses due in 3 days and send email reminders.
        """
        today = date.today()
        target_date = today + timedelta(days=3)
        
        # Determine day of month and day of week for target date
        day_of_month = target_date.day
        day_of_week = target_date.weekday() # 0=Monday, 6=Sunday
        
        # 1. Find Monthly Expenses due on target day
        monthly_expenses = self.db.query(RecurringExpense).filter(
            RecurringExpense.is_active == True,
            RecurringExpense.frequency == "monthly",
            RecurringExpense.day_of_month == day_of_month,
             # Ensure we haven't already sent a reminder for this period (simple check: last_reminder_date != today)
             # Better check: last_reminder_date < today - 2 days to avoid dups if run multiple times
            (RecurringExpense.last_reminder_date == None) | (RecurringExpense.last_reminder_date < today)
        ).all()
        
        # 2. Find Weekly Expenses due on target day
        weekly_expenses = self.db.query(RecurringExpense).filter(
            RecurringExpense.is_active == True,
            RecurringExpense.frequency == "weekly",
            RecurringExpense.day_of_week == day_of_week,
            (RecurringExpense.last_reminder_date == None) | (RecurringExpense.last_reminder_date < today)
        ).all()
        
        reminders_sent = 0
        all_expenses = monthly_expenses + weekly_expenses
        
        for expense in all_expenses:
             # Double check end_date
             if expense.end_date and expense.end_date < target_date:
                 continue
                 
             user = self.db.query(User).filter(User.id == expense.user_id).first()
             if user:
                 await email_service.send_email(
                     to_email=user.email,
                     subject=f"Bill Reminder: {expense.description} due on {target_date}",
                     body=f"Reminder: You have a bill for {expense.description} ({expense.amount}) due on {target_date}."
                 )
                 
                 expense.last_reminder_date = today
                 reminders_sent += 1
                 
        self.db.commit()
        return reminders_sent
