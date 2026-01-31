from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..core.deps import get_current_user
from ..models.user import User
from ..models.jar import Jar
from ..schemas.transfer import TransferCreate
from ..schemas.jar import JarResponse

router = APIRouter()

@router.post("/", response_model=JarResponse)
def transfer_funds(
    transfer: TransferCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Transfer funds between two jars."""
    if transfer.amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transfer amount must be positive"
        )

    if transfer.from_jar_id == transfer.to_jar_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot transfer to the same jar"
        )

    # Get source jar
    from_jar = db.query(Jar).filter(
        Jar.id == transfer.from_jar_id,
        Jar.user_id == current_user.id
    ).first()

    if not from_jar:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source jar not found"
        )

    # Get destination jar
    to_jar = db.query(Jar).filter(
        Jar.id == transfer.to_jar_id,
        Jar.user_id == current_user.id
    ).first()

    if not to_jar:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Destination jar not found"
        )

    # Check balance
    if from_jar.balance < transfer.amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient funds in source jar"
        )

    # Execute transfer
    from_jar.balance -= transfer.amount
    to_jar.balance += transfer.amount

    db.commit()
    db.refresh(from_jar)
    
    # Return from_jar (or we could return both, but usually knowing the transaction succeeded is enough)
    # Returning from_jar allows UI to update that card immediately, but best to refresh all.
    return from_jar
