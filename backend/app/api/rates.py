from fastapi import APIRouter, Depends, Query
from decimal import Decimal
from typing import Optional

from ..core.exchange_rate import exchange_rate_service
from ..core.deps import get_current_user
from ..models.user import User

router = APIRouter(prefix="/rates", tags=["Rates"])

@router.get("/convert")
async def convert_currency(
    amount: Decimal = Query(..., gt=0),
    from_currency: str = Query(..., min_length=3, max_length=3),
    to_currency: str = Query(..., min_length=3, max_length=3),
    current_user: User = Depends(get_current_user)
):
    """Convert amount from one currency to another."""
    converted_amount = await exchange_rate_service.convert(amount, from_currency, to_currency)
    rate = await exchange_rate_service.get_exchange_rate(from_currency, to_currency)
    
    return {
        "original_amount": amount,
        "from_currency": from_currency.upper(),
        "to_currency": to_currency.upper(),
        "converted_amount": converted_amount,
        "rate": rate
    }
