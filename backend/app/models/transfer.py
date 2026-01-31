from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base


class Transfer(Base):
    __tablename__ = "transfers"
    
    id = Column(Integer, primary_key=True, index=True)
    from_jar_id = Column(Integer, ForeignKey("jars.id", ondelete="CASCADE"), nullable=False)
    to_jar_id = Column(Integer, ForeignKey("jars.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    note = Column(String(255), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    from_jar = relationship("Jar", foreign_keys=[from_jar_id])
    to_jar = relationship("Jar", foreign_keys=[to_jar_id])
    user = relationship("User", back_populates="transfers")
