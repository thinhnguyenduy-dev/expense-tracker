from pydantic import BaseModel
from datetime import date as date_type, datetime
from typing import Optional
from decimal import Decimal
from .category import CategoryResponse


class ExpenseBase(BaseModel):
    amount: Decimal
    description: str
    date: date_type
    category_id: int


class ExpenseCreate(ExpenseBase):
    currency: Optional[str] = None

class ExpenseUpdate(BaseModel):
    amount: Optional[Decimal] = None
    description: Optional[str] = None
    date: Optional[date_type] = None
    category_id: Optional[int] = None
    currency: Optional[str] = None

class ExpenseResponse(ExpenseBase):
    id: int
    user_id: int
    created_at: datetime
    category: Optional[CategoryResponse] = None
    
    # Multi-currency fields
    original_amount: Optional[Decimal] = None
    original_currency: Optional[str] = None
    exchange_rate: Optional[Decimal] = None
    
    class Config:
        from_attributes = True
