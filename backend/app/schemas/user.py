from pydantic import BaseModel, EmailStr
from datetime import datetime


class UserBase(BaseModel):
    email: EmailStr
    name: str


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str
