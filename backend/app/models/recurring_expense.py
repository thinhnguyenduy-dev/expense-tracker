from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Numeric, Date, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base


class RecurringExpense(Base):
    __tablename__ = "recurring_expenses"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    description = Column(String(500), nullable=False)
    frequency = Column(String(20), nullable=False)  # "monthly", "weekly", "yearly"
    day_of_month = Column(Integer, nullable=True)  # 1-31 for monthly
    day_of_week = Column(Integer, nullable=True)  # 0-6 for weekly (0=Monday)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    last_created = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="recurring_expenses")
    category = relationship("Category")

    @property
    def next_due_date(self) -> Date | None:
        from datetime import date, timedelta
        from dateutil.relativedelta import relativedelta
        
        if not self.is_active:
            return None
        
        today = date.today()
        if self.end_date and self.end_date < today:
            return None
        
        base_date = self.last_created or self.start_date
        
        if self.frequency == "monthly":
            next_date = base_date
            while next_date <= today:
                next_date = next_date + relativedelta(months=1)
                try:
                    next_date = next_date.replace(day=self.day_of_month)
                except ValueError:
                    next_date = next_date.replace(day=1) + relativedelta(months=1) - timedelta(days=1)
            
            if self.end_date and next_date > self.end_date:
                return None
            return next_date
        
        elif self.frequency == "weekly":
            days_ahead = self.day_of_week - base_date.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            next_date = base_date + timedelta(days=days_ahead)
            
            while next_date <= today:
                next_date += timedelta(weeks=1)
            
            if self.end_date and next_date > self.end_date:
                return None
            return next_date
        
        elif self.frequency == "yearly":
            next_date = base_date
            while next_date <= today:
                next_date = next_date + relativedelta(years=1)
            
            if self.end_date and next_date > self.end_date:
                return None
            return next_date
        
        return None
