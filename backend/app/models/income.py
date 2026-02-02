from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Numeric, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base


class Income(Base):
    __tablename__ = "incomes"
    
    id = Column(Integer, primary_key=True, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    source = Column(String(255), nullable=False)
    date = Column(Date, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Multi-currency support
    original_amount = Column(Numeric(12, 2), nullable=True)
    original_currency = Column(String(3), nullable=True)
    exchange_rate = Column(Numeric(10, 6), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="incomes")
