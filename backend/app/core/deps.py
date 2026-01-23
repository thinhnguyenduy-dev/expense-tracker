from typing import Generator
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from .database import get_db
from .security import decode_access_token
from ..models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    """Get the current authenticated user from JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decode_access_token(token)
    if payload is None:
        print("DEBUG: Token decoding failed")
        raise credentials_exception
    
    try:
        user_id = int(payload.get("sub"))
    except (TypeError, ValueError):
        print("DEBUG: 'sub' cannot be converted to int")
        raise credentials_exception
    if user_id is None:
        print("DEBUG: 'sub' (user_id) missing in payload")
        raise credentials_exception
    
    print(f"DEBUG: Token payload user_id: {user_id} (type: {type(user_id)})")
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        print(f"DEBUG: User not found for id {user_id}")
        raise credentials_exception
    
    return user
