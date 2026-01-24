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
