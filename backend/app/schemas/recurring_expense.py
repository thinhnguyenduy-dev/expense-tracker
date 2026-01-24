from pydantic import BaseModel, Field, field_validator
from decimal import Decimal
from datetime import date
from typing import Optional


class RecurringExpenseBase(BaseModel):
    category_id: int
    amount: Decimal = Field(gt=0)
    description: str = Field(min_length=1, max_length=500)
    frequency: str = Field(pattern="^(monthly|weekly|yearly)$")
    day_of_month: Optional[int] = Field(None, ge=1, le=31)
    day_of_week: Optional[int] = Field(None, ge=0, le=6)
    start_date: date
    end_date: Optional[date] = None
    is_active: bool = True
    
    @field_validator('day_of_month')
    @classmethod
    def validate_day_of_month(cls, v, info):
        if info.data.get('frequency') == 'monthly' and v is None:
            raise ValueError('day_of_month is required for monthly frequency')
        if info.data.get('frequency') != 'monthly' and v is not None:
            raise ValueError('day_of_month should only be set for monthly frequency')
        return v
    
    @field_validator('day_of_week')
    @classmethod
    def validate_day_of_week(cls, v, info):
        if info.data.get('frequency') == 'weekly' and v is None:
            raise ValueError('day_of_week is required for weekly frequency')
        if info.data.get('frequency') != 'weekly' and v is not None:
            raise ValueError('day_of_week should only be set for weekly frequency')
        return v
    
    @field_validator('end_date')
    @classmethod
    def validate_end_date(cls, v, info):
        if v is not None and info.data.get('start_date') and v < info.data['start_date']:
            raise ValueError('end_date must be after start_date')
        return v


class RecurringExpenseCreate(RecurringExpenseBase):
    pass


class RecurringExpenseUpdate(BaseModel):
    category_id: Optional[int] = None
    amount: Optional[Decimal] = Field(None, gt=0)
    description: Optional[str] = Field(None, min_length=1, max_length=500)
    frequency: Optional[str] = Field(None, pattern="^(monthly|weekly|yearly)$")
    day_of_month: Optional[int] = Field(None, ge=1, le=31)
    day_of_week: Optional[int] = Field(None, ge=0, le=6)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None


class RecurringExpenseResponse(RecurringExpenseBase):
    id: int
    user_id: int
    last_created: Optional[date]
    
    class Config:
        from_attributes = True


class RecurringExpenseWithDueDate(RecurringExpenseResponse):
    next_due_date: Optional[date]
    category_name: str
    category_icon: str
    category_color: str
