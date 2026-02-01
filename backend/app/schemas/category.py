from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class CategoryBase(BaseModel):
    name: str
    icon: str = "📦"
    color: str = "#85929E"
    monthly_limit: Optional[float] = None


class CategoryCreate(CategoryBase):
    jar_id: Optional[int] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    jar_id: Optional[int] = None
    monthly_limit: Optional[float] = None


class CategoryResponse(CategoryBase):
    id: int
    user_id: int
    jar_id: Optional[int] = None
    created_at: datetime
    
    class Config:
        from_attributes = True
