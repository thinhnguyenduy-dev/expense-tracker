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
