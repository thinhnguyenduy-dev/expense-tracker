from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..core.database import get_db
from ..core.deps import get_current_user
from ..models.user import User
from ..models.jar import Jar
from ..models.transfer import Transfer
from ..schemas.jar import TransferCreate, TransferResponse

router = APIRouter()

@router.get("/", response_model=List[TransferResponse])
def get_transfers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all transfers for the current user."""
    transfers = db.query(Transfer).filter(Transfer.user_id == current_user.id).order_by(Transfer.date.desc()).all()
    
    # Enrich simple response with jar names if needed, or rely on frontend to map IDs
    # Since we defined from_jar_name in schema, let's try to populate it if easy, 
    # or rely on the ORM relationship if it was eager loaded.
    
    result = []
    for t in transfers:
        # If we need jar names, accessing t.from_jar.name works due to relationship
        result.append({
            "id": t.id,
            "from_jar_id": t.from_jar_id,
            "to_jar_id": t.to_jar_id,
            "amount": t.amount,
            "note": t.note,
            "date": t.date,
            "from_jar_name": t.from_jar.name if t.from_jar else "Unknown",
            "to_jar_name": t.to_jar.name if t.to_jar else "Unknown"
        })
    return result

@router.post("/", response_model=TransferResponse)
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
    
    # Record transfer
    db_transfer = Transfer(
        from_jar_id=transfer.from_jar_id,
        to_jar_id=transfer.to_jar_id,
        amount=transfer.amount,
        user_id=current_user.id,
        note=transfer.note
    )
    db.add(db_transfer)

    db.commit()
    db.refresh(db_transfer)
    
    # Populate names for response
    return {
        "id": db_transfer.id,
        "from_jar_id": db_transfer.from_jar_id,
        "to_jar_id": db_transfer.to_jar_id,
        "amount": db_transfer.amount,
        "note": db_transfer.note,
        "date": db_transfer.date,
        "from_jar_name": from_jar.name,
        "to_jar_name": to_jar.name
    }
