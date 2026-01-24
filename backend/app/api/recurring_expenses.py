from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta

from ..core.database import get_db
from ..core.deps import get_current_user
from ..models.user import User
from ..models.category import Category
from ..models.recurring_expense import RecurringExpense
from ..models.expense import Expense
from ..schemas.recurring_expense import (
    RecurringExpenseCreate,
    RecurringExpenseUpdate,
    RecurringExpenseResponse,
    RecurringExpenseWithDueDate
)

router = APIRouter(prefix="/recurring-expenses", tags=["Recurring Expenses"])


def calculate_next_due_date(recurring: RecurringExpense) -> date | None:
    """Calculate the next due date for a recurring expense."""
    if not recurring.is_active:
        return None
    
    if recurring.end_date and recurring.end_date < date.today():
        return None
    
    base_date = recurring.last_created or recurring.start_date
    today = date.today()
    
    if recurring.frequency == "monthly":
        # Start from base_date and add months until we're in the future
        next_date = base_date
        while next_date <= today:
            next_date = next_date + relativedelta(months=1)
            # Ensure the day is valid for the month
            try:
                next_date = next_date.replace(day=recurring.day_of_month)
            except ValueError:
                # Handle months with fewer days (e.g., Feb 30 -> Feb 28/29)
                next_date = next_date.replace(day=1) + relativedelta(months=1) - timedelta(days=1)
        
        if recurring.end_date and next_date > recurring.end_date:
            return None
        return next_date
    
    elif recurring.frequency == "weekly":
        # Find the next occurrence of day_of_week
        days_ahead = recurring.day_of_week - base_date.weekday()
        if days_ahead <= 0:  # Target day already happened this week
            days_ahead += 7
        next_date = base_date + timedelta(days=days_ahead)
        
        # If we're still in the past, add weeks
        while next_date <= today:
            next_date += timedelta(weeks=1)
        
        if recurring.end_date and next_date > recurring.end_date:
            return None
        return next_date
    
    elif recurring.frequency == "yearly":
        # Add years until we're in the future
        next_date = base_date
        while next_date <= today:
            next_date = next_date + relativedelta(years=1)
        
        if recurring.end_date and next_date > recurring.end_date:
            return None
        return next_date
    
    return None


@router.get("", response_model=List[RecurringExpenseWithDueDate])
def get_recurring_expenses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all recurring expenses for the current user."""
    recurring_expenses = db.query(RecurringExpense).filter(
        RecurringExpense.user_id == current_user.id
    ).all()
    
    result = []
    for recurring in recurring_expenses:
        category = db.query(Category).filter(Category.id == recurring.category_id).first()
        result.append(RecurringExpenseWithDueDate(
            id=recurring.id,
            user_id=recurring.user_id,
            category_id=recurring.category_id,
            amount=recurring.amount,
            description=recurring.description,
            frequency=recurring.frequency,
            day_of_month=recurring.day_of_month,
            day_of_week=recurring.day_of_week,
            start_date=recurring.start_date,
            end_date=recurring.end_date,
            is_active=recurring.is_active,
            last_created=recurring.last_created,
            next_due_date=calculate_next_due_date(recurring),
            category_name=category.name if category else "",
            category_icon=category.icon if category else "",
            category_color=category.color if category else ""
        ))
    
    return result


@router.post("", response_model=RecurringExpenseResponse, status_code=status.HTTP_201_CREATED)
def create_recurring_expense(
    recurring_data: RecurringExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new recurring expense template."""
    # Verify category belongs to user
    category = db.query(Category).filter(
        Category.id == recurring_data.category_id,
        Category.user_id == current_user.id
    ).first()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )
    
    recurring = RecurringExpense(
        **recurring_data.model_dump(),
        user_id=current_user.id
    )
    db.add(recurring)
    db.commit()
    db.refresh(recurring)
    
    return recurring


@router.get("/{recurring_id}", response_model=RecurringExpenseWithDueDate)
def get_recurring_expense(
    recurring_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific recurring expense."""
    recurring = db.query(RecurringExpense).filter(
        RecurringExpense.id == recurring_id,
        RecurringExpense.user_id == current_user.id
    ).first()
    
    if not recurring:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recurring expense not found"
        )
    
    category = db.query(Category).filter(Category.id == recurring.category_id).first()
    
    return RecurringExpenseWithDueDate(
        id=recurring.id,
        user_id=recurring.user_id,
        category_id=recurring.category_id,
        amount=recurring.amount,
        description=recurring.description,
        frequency=recurring.frequency,
        day_of_month=recurring.day_of_month,
        day_of_week=recurring.day_of_week,
        start_date=recurring.start_date,
        end_date=recurring.end_date,
        is_active=recurring.is_active,
        last_created=recurring.last_created,
        next_due_date=calculate_next_due_date(recurring),
        category_name=category.name if category else "",
        category_icon=category.icon if category else "",
        category_color=category.color if category else ""
    )


@router.put("/{recurring_id}", response_model=RecurringExpenseResponse)
def update_recurring_expense(
    recurring_id: int,
    recurring_data: RecurringExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a recurring expense."""
    recurring = db.query(RecurringExpense).filter(
        RecurringExpense.id == recurring_id,
        RecurringExpense.user_id == current_user.id
    ).first()
    
    if not recurring:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recurring expense not found"
        )
    
    # If updating category, verify it belongs to user
    if recurring_data.category_id is not None:
        category = db.query(Category).filter(
            Category.id == recurring_data.category_id,
            Category.user_id == current_user.id
        ).first()
        
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Category not found"
            )
    
    update_data = recurring_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(recurring, field, value)
    
    db.commit()
    db.refresh(recurring)
    
    return recurring


@router.delete("/{recurring_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recurring_expense(
    recurring_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a recurring expense."""
    recurring = db.query(RecurringExpense).filter(
        RecurringExpense.id == recurring_id,
        RecurringExpense.user_id == current_user.id
    ).first()
    
    if not recurring:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recurring expense not found"
        )
    
    db.delete(recurring)
    db.commit()
    
    return None


@router.post("/{recurring_id}/create-expense", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_expense_from_template(
    recurring_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create an actual expense from a recurring expense template."""
    recurring = db.query(RecurringExpense).filter(
        RecurringExpense.id == recurring_id,
        RecurringExpense.user_id == current_user.id
    ).first()
    
    if not recurring:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recurring expense not found"
        )
    
    if not recurring.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create expense from inactive template"
        )
    
    next_due = calculate_next_due_date(recurring)
    if not next_due:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No upcoming due date for this recurring expense"
        )
    
    # Create the expense
    expense = Expense(
        user_id=current_user.id,
        category_id=recurring.category_id,
        amount=recurring.amount,
        description=recurring.description,
        date=next_due
    )
    db.add(expense)
    
    # Update last_created
    recurring.last_created = next_due
    
    db.commit()
    db.refresh(expense)
    
    return {
        "message": "Expense created successfully",
        "expense_id": expense.id,
        "date": expense.date,
        "amount": expense.amount
    }
