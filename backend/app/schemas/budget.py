from pydantic import BaseModel
from typing import List, Optional
from decimal import Decimal

class BudgetStatus(BaseModel):
    limit: Optional[Decimal]
    spent: Decimal
    percentage: float
    is_over_limit: bool
    is_warning: bool

class CategoryBudgetStatus(BudgetStatus):
    category_id: int
    category_name: str

class BudgetResponse(BaseModel):
    overall: BudgetStatus
    categories: List[CategoryBudgetStatus]
