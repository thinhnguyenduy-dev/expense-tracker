from pydantic_settings import BaseSettings
from typing import List, Optional
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/expense_tracker"
    
    # JWT
    JWT_SECRET: str = "your-super-secret-jwt-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440  # 24 hours
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    # Logging
    LOG_LEVEL: str = "INFO"
    ENVIRONMENT: str = "production"
    
    # Redis (optional - if not set, caching is disabled)
    REDIS_URL: Optional[str] = None
    CACHE_TTL_SECONDS: int = 300  # 5 minutes
    
    # Sentry (optional - if not set, monitoring is disabled)
    SENTRY_DSN: Optional[str] = None
    
    # Email notifications (optional)
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: str = "noreply@expense-tracker.local"
    
    # Budget alert thresholds (percentages)
    BUDGET_ALERT_THRESHOLD_WARNING: int = 80
    BUDGET_ALERT_THRESHOLD_CRITICAL: int = 100
    
    # External Services
    EXCHANGE_RATE_API_KEY: Optional[str] = None
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
