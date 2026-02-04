from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from datetime import date
from pydantic import BaseModel
from decimal import Decimal

from ..core.database import get_db
from ..core.deps import get_current_user
from ..models.user import User
from ..models.expense import Expense
from ..models.income import Income
from ..models.category import Category

router = APIRouter()

class SearchResult(BaseModel):
    id: int
    type: str # 'expense', 'income'
    date: date
    amount: Decimal
    description: str
    category_name: str
    category_color: Optional[str] = None

@router.get("/", response_model=List[SearchResult])
def search_transactions(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(20, le=50, description="Max results"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Search expenses and incomes by description or category.
    """
    search_term = f"%{q}%"
    
    # 1. Search Expenses
    expenses = db.query(Expense).join(Category).filter(
        Expense.user_id == current_user.id,
        or_(
            Expense.description.ilike(search_term),
            Category.name.ilike(search_term)
        )
    ).order_by(Expense.date.desc()).limit(limit).all()
    
    # 2. Search Incomes
    incomes = db.query(Income).filter(
        Income.user_id == current_user.id,
        or_(
            Income.source.ilike(search_term),
            Income.description.ilike(search_term)
        )
    ).order_by(Income.date.desc()).limit(limit).all()
    
    # Combine and Sort
    results = []
    
    for e in expenses:
        results.append(SearchResult(
            id=e.id,
            type="expense",
            date=e.date,
            amount=e.amount,
            description=e.description,
            category_name=e.category.name,
            category_color=e.category.color
        ))
        
    for i in incomes:
        results.append(SearchResult(
            id=i.id,
            type="income",
            date=i.date,
            amount=i.amount,
            description=i.description or "Income",
            category_name=i.source, # Map source to category name for UI consistency
            category_color="#10b981" # Green for income
        ))
        
    # Sort by date desc
    results.sort(key=lambda x: x.date, reverse=True)
    
    return results[:limit]
