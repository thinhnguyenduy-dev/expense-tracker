from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..core.deps import get_current_user
from ..models.user import User
from ..models.family import Family
from ..schemas.family import FamilyCreate, FamilyResponse, JoinFamilyRequest
import uuid
import secrets

router = APIRouter(prefix="/families", tags=["Families"])

def generate_invite_code():
    # Generate a simple 6-char alphanumeric code (uppercase)
    # e.g. AB12CD
    return secrets.token_hex(3).upper()

@router.post("/", response_model=FamilyResponse, status_code=status.HTTP_201_CREATED)
def create_family(
    family_in: FamilyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.family_id:
        raise HTTPException(status_code=400, detail="User is already in a family")

    # Retry logic for unique invite code could be added, but collision is rare enough for MVP
    invite_code = generate_invite_code()
    
    new_family = Family(
        name=family_in.name,
        invite_code=invite_code
    )
    db.add(new_family)
    db.commit()
    db.refresh(new_family)

    # Add user to family
    current_user.family_id = new_family.id
    db.commit()
    
    return new_family

@router.post("/join", response_model=FamilyResponse)
def join_family(
    request: JoinFamilyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.family_id:
        raise HTTPException(status_code=400, detail="User is already in a family")

    family = db.query(Family).filter(Family.invite_code == request.invite_code).first()
    if not family:
        raise HTTPException(status_code=404, detail="Invalid invite code")

    current_user.family_id = family.id
    db.commit()
    
    return family

@router.get("/me", response_model=FamilyResponse)
def get_my_family(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)  # Needed for lazy loading relationship if not joined
):
    if not current_user.family_id:
         raise HTTPException(status_code=404, detail="User is not in a family")
    
    return current_user.family # Relationships should be loaded automatically or lazily
