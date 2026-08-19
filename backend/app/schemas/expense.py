from pydantic import BaseModel, Field, field_validator
from datetime import date as date_type, datetime
from typing import List, Optional
from decimal import Decimal
from .category import CategoryResponse


class ExpenseBase(BaseModel):
    amount: Decimal
    description: str
    date: date_type
    category_id: int


class ExpenseCreate(ExpenseBase):
    currency: Optional[str] = None
    images: Optional[List[str]] = Field(default_factory=list)

    @field_validator("images", mode="before")
    @classmethod
    def coerce_images(cls, value):
        return value or []


class ExpenseUpdate(BaseModel):
    amount: Optional[Decimal] = None
    description: Optional[str] = None
    date: Optional[date_type] = None
    category_id: Optional[int] = None
    currency: Optional[str] = None
    images: Optional[List[str]] = None


class ExpenseResponse(ExpenseBase):
    id: int
    user_id: int
    created_at: datetime
    category: Optional[CategoryResponse] = None
    images: List[str] = Field(default_factory=list)
    
    # Multi-currency fields
    original_amount: Optional[Decimal] = None
    original_currency: Optional[str] = None
    exchange_rate: Optional[Decimal] = None

    @field_validator("images", mode="before")
    @classmethod
    def coerce_images(cls, value):
        return value or []
    
    class Config:
        from_attributes = True
