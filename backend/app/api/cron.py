from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date
from ..core.database import get_db
from ..core.budget_service import BudgetService
from ..core.email import email_service
from ..models.user import User
from ..models.category import Category # noqa

router = APIRouter()

@router.post("/run")
async def run_cron_jobs(db: Session = Depends(get_db)):
    """
    Trigger daily cron jobs:
    1. Check budget alerts
    2. Check bill reminders (TODO)
    """
    
    # 1. Check Budget Alerts
    users = db.query(User).all()
    budget_service = BudgetService(db)
    
    alerts_sent = 0
    
    for user in users:
        # Check overall budget
        status = budget_service.get_budget_status(user.id)
        overall = status.get("overall", {})
        
        if overall.get("is_warning") and user.overall_monthly_limit:
            # Simple simulation: just log/email if over 80%
            # In real app: check if we ALREADY sent an alert this month
             await email_service.send_email(
                to_email=user.email,
                subject="Budget Alert: Monthly Limit Reached",
                body=f"You have used {overall['percentage']:.1f}% of your monthly budget."
            )
             alerts_sent += 1

        # Check category budgets
        for cat_status in status.get("categories", []):
            if cat_status.get("is_warning"):
                 # In real app: check last_alert_date on Category model
                 # For now, just logging
                 await email_service.send_email(
                    to_email=user.email,
                    subject=f"Budget Alert: {cat_status['category_name']}",
                    body=f"You have used {cat_status['percentage']:.1f}% of your budget for {cat_status['category_name']}."
                )
                 alerts_sent += 1
                 
    # 2. Check Bill Reminders
    from ..core.reminder_service import ReminderService
    reminder_service = ReminderService(db)
    reminders_sent = await reminder_service.process_reminders()

    # 3. Process Automated Recurring Expenses
    from ..core.recurring_expense_service import RecurringExpenseService
    recurring_service = RecurringExpenseService(db)
    expenses_created = recurring_service.process_all_due_expenses()
                 
    return {
        "status": "ok", 
        "alerts_sent": alerts_sent, 
        "reminders_sent": reminders_sent,
        "expenses_created": expenses_created
    }
