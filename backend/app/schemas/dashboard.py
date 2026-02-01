from pydantic import BaseModel
from typing import List
from decimal import Decimal


class CategoryStat(BaseModel):
    category_id: int
    category_name: str
    category_color: str
    total: Decimal
    percentage: float
    monthly_limit: float | None = None


class MonthlyTrend(BaseModel):
    month: str
    total: Decimal


class DashboardStats(BaseModel):
    total_expenses: Decimal
    total_this_month: Decimal
    total_this_week: Decimal
    expenses_by_category: List[CategoryStat]
    monthly_trend: List[MonthlyTrend]
    due_recurring_count: int = 0
