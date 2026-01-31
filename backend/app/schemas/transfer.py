from pydantic import BaseModel
from decimal import Decimal
from typing import Optional

class TransferCreate(BaseModel):
    from_jar_id: int
    to_jar_id: int
    amount: Decimal
    note: Optional[str] = None
