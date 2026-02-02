from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Numeric, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base


class Category(Base):
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    icon = Column(String(50), nullable=False, default="📦")
    color = Column(String(20), nullable=False, default="#85929E")
    monthly_limit = Column(Numeric(10, 2), nullable=True)
    last_alert_date = Column(Date, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="categories")
    expenses = relationship("Expense", back_populates="category", cascade="all, delete-orphan")
    jar_id = Column(Integer, ForeignKey("jars.id", ondelete="SET NULL"), nullable=True)
    jar = relationship("Jar", back_populates="categories")
