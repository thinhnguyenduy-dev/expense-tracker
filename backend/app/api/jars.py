from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..core.database import get_db
from ..core.deps import get_current_user
from ..models.user import User
from ..models.jar import Jar
from ..schemas.jar import JarResponse, JarCreate, JarUpdate

router = APIRouter()


@router.get("/", response_model=List[JarResponse])
def get_jars(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all jars for the current user."""
    return db.query(Jar).filter(Jar.user_id == current_user.id).all()


@router.post("/", response_model=JarResponse)
def create_jar(
    jar: JarCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new jar (mostly for initial setup or custom jars)."""
    db_jar = Jar(**jar.model_dump(), user_id=current_user.id)
    db.add(db_jar)
    db.commit()
    db.refresh(db_jar)
    return db_jar


@router.put("/{jar_id}", response_model=JarResponse)
def update_jar(
    jar_id: int,
    jar_update: JarUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a jar (e.g., change percentage)."""
    db_jar = db.query(Jar).filter(Jar.id == jar_id, Jar.user_id == current_user.id).first()
    if not db_jar:
        raise HTTPException(status_code=404, detail="Jar not found")
    
    update_data = jar_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_jar, key, value)
    
    db.commit()
    db.refresh(db_jar)
    return db_jar
