from sqlalchemy.orm import Session
from ..models.jar import Jar
from decimal import Decimal

class JarService:
    @staticmethod
    def update_jar_balance(db: Session, jar_id: int, amount_delta: Decimal | float):
        """
        Update the balance of a Jar.
        
        Args:
            db: Database session
            jar_id: ID of the jar to update
            amount_delta: Amount to add (positive) or subtract (negative)
            
        Note:
            - To DEDUCT (spending), pass a NEGATIVE value (e.g. -100).
            - To REFUND (undo spending), pass a POSITIVE value (e.g. 100).
        """
        if not jar_id or amount_delta == 0:
            return

        jar = db.query(Jar).filter(Jar.id == jar_id).first()
        if jar:
            # Convert to Decimal if needed to avoid type errors with Numeric column
            # SQLAlchemy handles float to Numeric usually, but explicit is better if mixed
            jar.balance += Decimal(str(amount_delta))
            # No commit here, let the caller commit transaction
