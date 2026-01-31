from pydantic import BaseModel
from typing import List, Optional
from decimal import Decimal
from datetime import date

class DailyExpense(BaseModel):
    date: date
    amount: Decimal

class CategoryReport(BaseModel):
    category_id: int
    category_name: str
    category_color: str
    amount: Decimal
    percentage: float

class ReportResponse(BaseModel):
    daily_expenses: List[DailyExpense]
    category_breakdown: List[CategoryReport]
    total_period: Decimal
    period_start: date
    period_end: date
