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

class MonthlyStats(BaseModel):
    month: str  # YYYY-MM
    income: Decimal
    expense: Decimal

class SavingsStats(BaseModel):
    current_savings_rate: float
    total_income: Decimal
    total_expense: Decimal
    net_savings: Decimal

class ReportResponse(BaseModel):
    daily_expenses: List[DailyExpense]
    category_breakdown: List[CategoryReport]
    income_vs_expense: List[MonthlyStats]
    savings_stats: SavingsStats
    total_period: Decimal
    period_start: date
    period_end: date
