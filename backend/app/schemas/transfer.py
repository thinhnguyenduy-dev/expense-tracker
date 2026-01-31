from pydantic import BaseModel
from decimal import Decimal

class TransferCreate(BaseModel):
    from_jar_id: int
    to_jar_id: int
    amount: Decimal
