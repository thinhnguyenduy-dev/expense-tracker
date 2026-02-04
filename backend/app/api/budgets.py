from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..core.deps import get_current_user
from ..models.user import User
from ..core.budget_service import BudgetService
from ..schemas.budget import BudgetResponse

router = APIRouter(prefix="/budgets", tags=["Budgets"])

@router.get("/", response_model=BudgetResponse)
def get_my_budget_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get budget status for the current user."""
    service = BudgetService(db)
    return service.get_budget_status(current_user.id)
