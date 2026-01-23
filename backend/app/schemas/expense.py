from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional
from decimal import Decimal
from .category import CategoryResponse


class ExpenseBase(BaseModel):
    amount: Decimal
    description: str
    date: date
    category_id: int


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseUpdate(BaseModel):
    amount: Optional[Decimal] = None
    description: Optional[str] = None
    date: Optional[date] = None
    category_id: Optional[int] = None


class ExpenseResponse(ExpenseBase):
    id: int
    user_id: int
    created_at: datetime
    category: Optional[CategoryResponse] = None
    
    class Config:
        from_attributes = True


class ExpenseFilter(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    category_id: Optional[int] = None
    min_amount: Optional[Decimal] = None
    max_amount: Optional[Decimal] = None
