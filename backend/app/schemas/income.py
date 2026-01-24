from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional
from decimal import Decimal


class IncomeBase(BaseModel):
    amount: Decimal
    source: str
    date: date


class IncomeCreate(IncomeBase):
    pass


class IncomeResponse(IncomeBase):
    id: int
    user_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True
