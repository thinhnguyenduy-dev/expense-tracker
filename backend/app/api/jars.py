from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..core.database import get_db
from ..core.deps import get_current_user
from ..models.user import User
from ..models.jar import Jar
from ..schemas.jar import JarResponse, JarCreate, JarUpdate, JarBulkUpdate
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


@router.put("/bulk", response_model=List[JarResponse])
def update_jars_bulk(
    bulk_update: JarBulkUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update all jars (create, edit, delete) ensuring total percentage is 100%."""
    total_percentage = sum(jar.percentage for jar in bulk_update.jars)
    if abs(total_percentage - 100.0) > 0.01:
        raise HTTPException(status_code=400, detail="Total percentage must equal exactly 100%")

    current_jars = db.query(Jar).filter(Jar.user_id == current_user.id).all()
    current_jar_ids = {jar.id for jar in current_jars}
    
    request_jar_ids = {jar.id for jar in bulk_update.jars if jar.id is not None}
    
    # Check for deleted jars
    jars_to_delete_ids = current_jar_ids - request_jar_ids
    for jar_id in jars_to_delete_ids:
        jar_to_delete = next(j for j in current_jars if j.id == jar_id)
        if jar_to_delete.balance > 0:
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot delete jar '{jar_to_delete.name}' because it has a positive balance"
            )
        db.delete(jar_to_delete)

    # Process updates and creations
    for jar_data in bulk_update.jars:
        if jar_data.id is not None:
            existing_jar = next((j for j in current_jars if j.id == jar_data.id), None)
            if not existing_jar:
                raise HTTPException(status_code=404, detail=f"Jar with id {jar_data.id} not found")
            existing_jar.name = jar_data.name
            existing_jar.percentage = jar_data.percentage
        else:
            new_jar = Jar(
                name=jar_data.name,
                percentage=jar_data.percentage,
                balance=0.0,
                user_id=current_user.id
            )
            db.add(new_jar)

    db.commit()
    return db.query(Jar).filter(Jar.user_id == current_user.id).all()


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
