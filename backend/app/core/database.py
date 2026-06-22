from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from .config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # Test connections before use, reconnect if stale
    pool_recycle=300,    # Recycle connections every 5 minutes
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# Separate engine for the agent's SQL tool: connects as the read-only,
# RLS-constrained `analyst_ro` role so LLM-generated SQL is hard-bounded to the
# current user at the database level. Falls back to None when ANALYST_DATABASE_URL
# is unset; callers then use the main `engine` (RLS-bypassing owner role).
analyst_engine = (
    create_engine(
        settings.ANALYST_DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=300,
    )
    if settings.ANALYST_DATABASE_URL
    else None
)


def get_db():
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
