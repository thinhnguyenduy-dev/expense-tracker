from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional
from decimal import Decimal


class IncomeBase(BaseModel):
    amount: Decimal
    source: str
    date: date


class IncomeCreate(IncomeBase):
    currency: Optional[str] = None


class IncomeResponse(IncomeBase):
    id: int
    user_id: int
    created_at: datetime
    user_name: Optional[str] = None  # For family mode attribution
    
    # Multi-currency fields
    original_amount: Optional[Decimal] = None
    original_currency: Optional[str] = None
    exchange_rate: Optional[Decimal] = None
    
    class Config:
        from_attributes = True
