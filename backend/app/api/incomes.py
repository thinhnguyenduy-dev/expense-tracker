from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from decimal import Decimal

from ..core.database import get_db
from ..core.deps import get_current_user
from ..models.user import User
from ..models.income import Income
from ..models.jar import Jar
from ..schemas.income import IncomeResponse, IncomeCreate

router = APIRouter()


@router.get("/", response_model=List[IncomeResponse])
def get_incomes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all incomes for the current user."""
    return db.query(Income).filter(Income.user_id == current_user.id).order_by(Income.date.desc()).all()


@router.post("/", response_model=IncomeResponse)
def create_income(
    income: IncomeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add income and distribute to jars based on percentages."""
    # Create Income record
    db_income = Income(**income.model_dump(), user_id=current_user.id)
    db.add(db_income)
    
    # Distribute to Jars
    jars = db.query(Jar).filter(Jar.user_id == current_user.id).all()
    
    # Validate percentages sum to 100 (optional, but good practice) or simply distribute what is defined
    total_percentage = sum(jar.percentage for jar in jars)
    
    # If no jars, just save income (or maybe create default jars? sticking to simple for now)
    if jars:
        amount = income.amount
        for jar in jars:
            # Calculate share: (Amount * Percentage) / 100
            share = (amount * Decimal(str(jar.percentage))) / Decimal('100.0')
            jar.balance += share
            # Note: Rounding issues might occur, but using Decimal helps. 
            # Real financial apps might allocate remainder to a specific jar.
    
    db.commit()
    db.refresh(db_income)
    return db_income


@router.put("/{income_id}", response_model=IncomeResponse)
def update_income(
    income_id: int,
    income_update: IncomeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an income and adjust jar balances."""
    db_income = db.query(Income).filter(Income.id == income_id, Income.user_id == current_user.id).first()
    if not db_income:
        raise HTTPException(status_code=404, detail="Income not found")

    # 1. Reverse old distribution
    jars = db.query(Jar).filter(Jar.user_id == current_user.id).all()
    if jars:
        old_amount = db_income.amount
        for jar in jars:
            # Skip if jar was created AFTER the income (means this income wasn't distributed to it originally)
            if jar.created_at and db_income.created_at and jar.created_at > db_income.created_at:
                continue
                
            share = (old_amount * Decimal(str(jar.percentage))) / Decimal('100.0')
            jar.balance -= share

    # 2. Update income record
    db_income.amount = income_update.amount
    db_income.source = income_update.source
    db_income.date = income_update.date
    
    # 3. Apply new distribution
    if jars:
        new_amount = income_update.amount
        for jar in jars:
            share = (new_amount * Decimal(str(jar.percentage))) / Decimal('100.0')
            jar.balance += share

    db.commit()
    db.refresh(db_income)
    return db_income


@router.delete("/{income_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_income(
    income_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete an income and reverse the distribution from jars."""
    income = db.query(Income).filter(Income.id == income_id, Income.user_id == current_user.id).first()
    if not income:
        raise HTTPException(status_code=404, detail="Income not found")

    # Reverse distribution from Jars based on CURRENT percentages
    # note: This is an approximation if percentages have changed since income was added.
    jars = db.query(Jar).filter(Jar.user_id == current_user.id).all()
    if jars:
        amount = income.amount
        for jar in jars:
            # Skip if jar was created AFTER the income
            if jar.created_at and income.created_at and jar.created_at > income.created_at:
                continue

            share = (amount * Decimal(str(jar.percentage))) / Decimal('100.0')
            jar.balance -= share

    db.delete(income)
    db.commit()
