from pydantic import BaseModel, Field
from typing import Optional
from decimal import Decimal

class ExpenseExtraction(BaseModel):
    """Structured output for expense extraction from natural language."""
    amount: float = Field(..., description="The numeric amount of the expense")
    currency: Optional[str] = Field("VND", description="The currency code (e.g. USD, VND). Default to VND if not specified.")
    category: Optional[str] = Field(None, description="The category name or similar concept")
    merchant: Optional[str] = Field(None, description="The merchant or place of purchase")
    description: Optional[str] = Field(None, description="Brief description of the expense")
    date: Optional[str] = Field(None, description="Date of the expense in ISO format YYYY-MM-DD. Use today if not specified.")

class BudgetCheckResult(BaseModel):
    category_id: int
    category_name: str
    limit: Decimal
    spent: Decimal
    remaining: Decimal
    is_over_budget: bool
    warning_message: Optional[str] = None
