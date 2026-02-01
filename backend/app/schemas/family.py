from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from .user import UserResponse

class FamilyBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)

class FamilyCreate(FamilyBase):
    pass

class FamilyUpdate(FamilyBase):
    pass

class FamilyResponse(FamilyBase):
    id: int
    invite_code: str
    created_at: datetime
    members: List[UserResponse] = []

    class Config:
        from_attributes = True

class JoinFamilyRequest(BaseModel):
    invite_code: str = Field(..., min_length=1)
