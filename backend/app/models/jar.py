from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Numeric, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base


class Jar(Base):
    __tablename__ = "jars"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    percentage = Column(Float, nullable=False)  # e.g., 55.0 for 55%
    balance = Column(Numeric(12, 2), default=0, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="jars")
    categories = relationship("Category", back_populates="jar")
