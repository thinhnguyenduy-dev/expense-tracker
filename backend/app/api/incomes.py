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
from ..core.exchange_rate import exchange_rate_service

router = APIRouter()


@router.get("/", response_model=List[IncomeResponse])
def get_incomes(
    scope: str = "personal",
    member_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all incomes for the current user or family."""
    if scope == "family" and current_user.family_id:
        # Get all family members
        members = db.query(User).filter(User.family_id == current_user.family_id).all()
        member_ids = [m.id for m in members]
        member_names = {m.id: m.name for m in members}
        
        # If member_id is specified, filter only that member
        if member_id and member_id in member_ids:
            query_ids = [member_id]
        else:
            query_ids = member_ids
        
        # Query incomes from specified members
        incomes = db.query(Income).filter(
            Income.user_id.in_(query_ids)
        ).order_by(Income.date.desc()).all()
        
        # Add user_name for attribution
        result = []
        for income in incomes:
            income_dict = {
                "id": income.id,
                "amount": income.amount,
                "source": income.source,
                "date": income.date,
                "user_id": income.user_id,
                "created_at": income.created_at,
                "user_name": member_names.get(income.user_id)
            }
            result.append(income_dict)
        return result
    
    # Personal scope (default)
    return db.query(Income).filter(Income.user_id == current_user.id).order_by(Income.date.desc()).all()


@router.post("/", response_model=IncomeResponse)
async def create_income(
    income: IncomeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add income and distribute to jars based on percentages."""
    """Add income and distribute to jars based on percentages."""
    
    income_data = income.model_dump()
    currency = income_data.pop("currency", None)
    
    # Currency Conversion Logic
    exchange_rate = None
    original_amount = None
    original_currency = None
    user_currency = current_user.currency or "VND"
    
    if currency and currency != user_currency:
        original_amount = income.amount
        original_currency = currency
        
        converted_amount = await exchange_rate_service.convert(income.amount, currency, user_currency)
        
        if converted_amount:
             rate = await exchange_rate_service.get_exchange_rate(currency, user_currency)
             exchange_rate = rate
             income_data["amount"] = converted_amount
    
    # Create Income record
    db_income = Income(
        **income_data, 
        user_id=current_user.id,
        original_amount=original_amount,
        original_currency=original_currency,
        exchange_rate=exchange_rate
    )
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
async def update_income(
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
    income_data = income_update.model_dump(exclude_unset=True)
    currency = income_data.pop("currency", None)
    
    # Update fields manually to handle currency logic
    for field, value in income_data.items():
        setattr(db_income, field, value)
        
    # Handle currency update
    new_amount = income_data.get("amount")
    
    if currency or (new_amount and db_income.original_currency):
        target_currency = currency or db_income.original_currency or current_user.currency or "VND"
        target_amount = new_amount if new_amount is not None else db_income.original_amount
        
        user_currency = current_user.currency or "VND"
        
        if target_currency != user_currency:
             converted_amount = await exchange_rate_service.convert(target_amount, target_currency, user_currency)
             if converted_amount:
                 db_income.amount = converted_amount
                 db_income.original_amount = target_amount
                 db_income.original_currency = target_currency
                 db_income.exchange_rate = await exchange_rate_service.get_exchange_rate(target_currency, user_currency)
        else:
             if new_amount is not None:
                 db_income.amount = new_amount
             db_income.original_amount = None
             db_income.original_currency = None
             db_income.exchange_rate = None
    
    # 3. Apply new distribution
    if jars:
        # Use the updated (Base) amount
        new_amount_base = db_income.amount
        for jar in jars:
            share = (new_amount_base * Decimal(str(jar.percentage))) / Decimal('100.0')
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
