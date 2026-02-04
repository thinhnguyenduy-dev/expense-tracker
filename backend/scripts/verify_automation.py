
import sys
import os
from datetime import date, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.config import settings
from app.core.recurring_expense_service import RecurringExpenseService
from app.models.recurring_expense import RecurringExpense
from app.models.expense import Expense
from app.models.user import User

# Setup DB connection
engine = create_engine(str(settings.DATABASE_URL))
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

def test_automation():
    print("--- Starting Automation Verification ---")
    
    # 1. Setup: Create a dummy user and recurring expense
    try:
        # Check if test user exists or create one
        user = db.query(User).filter(User.email == "test_auto@example.com").first()
        if not user:
            user = User(email="test_auto@example.com", hashed_password="hashed_secret", name="Test Auto User")
            db.add(user)
            db.commit()
            print(f"Created test user: {user.id}")
        
        # Create a recurring expense that is DUE (start date in past, no last_created)
        # Using a category ID that hopefully exists, e.g., 1. If not, we might crash.
        # Let's check for a category first.
        from app.models.category import Category
        category = db.query(Category).first()
        if not category:
            category = Category(name="Test Cat", icon="🧪", color="#000", user_id=user.id)
            db.add(category)
            db.commit()

        # Clean up existing test recurring expenses
        db.query(RecurringExpense).filter(RecurringExpense.description == "TEST_AUTO_EXPENSE").delete()
        db.commit()

        recurring = RecurringExpense(
            user_id=user.id,
            category_id=category.id,
            amount=100.0,
            description="TEST_AUTO_EXPENSE",
            frequency="monthly",
            day_of_month=date.today().day, # Due today!
            start_date=date.today(), # Started today, so only 1 is due
            is_active=True
        )
        db.add(recurring)
        db.commit()
        print(f"Created recurring expense: {recurring.id} (Due today)")

        # 2. Run Automation - First Run
        service = RecurringExpenseService(db)
        count = service.process_all_due_expenses()
        print(f"First Run Processed: {count}")
        
        if count != 1:
            print("❌ FAILED: Exepected to create 1 expense, but created", count)
        else:
            print("✅ SUCCEEDED: Created 1 expense")

        # Verify expense was created
        created_expense = db.query(Expense).filter(
            Expense.description == "TEST_AUTO_EXPENSE",
            Expense.date == date.today()
        ).first()
        
        if created_expense:
             print(f"✅ Expense found in DB: ID {created_expense.id}")
        else:
             print("❌ FAILED: Expense not found in DB")

        # 3. Verification - Idempotency (Run again)
        print("Running again (Idempotency check)...")
        count_2 = service.process_all_due_expenses()
        print(f"Second Run Processed: {count_2}")
        
        if count_2 != 0:
             print("❌ FAILED: Idempotency failed! Created duplicate expenses.")
        else:
             print("✅ SUCCEEDED: No duplicates created.")
             
        # Cleanup
        db.delete(recurring)
        if created_expense:
            db.delete(created_expense)
        # db.delete(user) # Keep user for re-runs logic simplicity
        db.commit()
        print("Cleanup done.")

    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    test_automation()
