from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from decimal import Decimal


class JarBase(BaseModel):
    name: str
    percentage: float
    balance: Decimal = Decimal('0.00')


class JarCreate(JarBase):
    pass


class JarUpdate(BaseModel):
    name: Optional[str] = None
    percentage: Optional[float] = None
    balance: Optional[Decimal] = None


class JarResponse(JarBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class TransferCreate(BaseModel):
    from_jar_id: int
    to_jar_id: int
    amount: Decimal
    note: Optional[str] = None

class TransferResponse(BaseModel):
    id: int
    from_jar_id: int
    to_jar_id: int
    amount: Decimal
    note: Optional[str] = None
    date: datetime
    
    # We might want to include jar names in response
    from_jar_name: Optional[str] = None
    to_jar_name: Optional[str] = None
    
    class Config:
        from_attributes = True
