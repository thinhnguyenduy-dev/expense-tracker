
import asyncio
import sys
import os

# Add backend directory to sys.path if run directly
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app.core.database import SessionLocal
from app.core.recurring_expense_service import RecurringExpenseService
from app.core.reminder_service import ReminderService
from app.core.logging import setup_logging, get_logger

setup_logging()
logger = get_logger()

async def run_cron_jobs():
    logger.info("⏳ Starting daily cron jobs...")
    db = SessionLocal()
    try:
        # 1. Bill Reminders
        logger.info("Processing bill reminders...")
        reminder_service = ReminderService(db)
        await reminder_service.process_reminders()
        
        # 2. Automated Recurring Expenses
        logger.info("Processing automated recurring expenses...")
        recurring_service = RecurringExpenseService(db)
        count = recurring_service.process_all_due_expenses()
        logger.info(f"✅ Processed {count} recurring expenses.")
        
    except Exception as e:
        logger.error(f"❌ Error running cron jobs: {e}")
        # We might want to alert Sentry here if configured, 
        # but the services usually handle their own error logging.
        sys.exit(1)
    finally:
        db.close()
        logger.info("🏁 Cron jobs finished.")

if __name__ == "__main__":
    asyncio.run(run_cron_jobs())
