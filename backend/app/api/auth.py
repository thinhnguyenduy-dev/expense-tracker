from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta

from ..core.rate_limit import limiter

from ..core.database import get_db
from ..core.security import verify_password, get_password_hash, create_access_token
from ..core.config import settings
from ..core.deps import get_current_user
from ..models.user import User
from ..schemas.user import UserCreate, UserResponse, Token

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
def register(request: Request, user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user."""
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    user = User(
        email=user_data.email,
        name=user_data.name,
        hashed_password=get_password_hash(user_data.password),
        language=user_data.language
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create default jars for the 6 Jars Method
    from ..models.jar import Jar
    default_jars = [
        {"name": "Necessities (NEC)", "percentage": 55.0},
        {"name": "Financial Freedom (FFA)", "percentage": 10.0},
        {"name": "Long-term Savings (LTSS)", "percentage": 10.0},
        {"name": "Education (EDU)", "percentage": 10.0},
        {"name": "Play (PLAY)", "percentage": 10.0},
        {"name": "Give (GIVE)", "percentage": 5.0},
    ]
    
    for jar_data in default_jars:
        new_jar = Jar(
            name=jar_data["name"],
            percentage=jar_data["percentage"],
            balance=0.0,
            user_id=user.id
        )
        db.add(new_jar)
    
    db.commit()
    
    return user


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Login to get access token."""
    user = db.query(User).filter(User.email == form_data.username).first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    )
    
    return Token(access_token=access_token)


@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Get current authenticated user info."""
    return current_user


@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    """Logout endpoint (client should discard token)."""
    return {"message": "Successfully logged out"}

