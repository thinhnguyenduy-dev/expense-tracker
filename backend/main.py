from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging import setup_logging, get_logger
from app.api import auth_router, categories_router, expenses_router, dashboard_router, recurring_expenses_router, users_router
from app.middleware import LoggingMiddleware

# Setup logging first
setup_logging()
logger = get_logger()

# Initialize Sentry if configured
if settings.SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
        
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            integrations=[
                FastApiIntegration(transaction_style="endpoint"),
                SqlalchemyIntegration(),
            ],
            traces_sample_rate=0.1,  # 10% of transactions
            profiles_sample_rate=0.1,
            environment="production" if not settings.SENTRY_DSN.startswith("http://localhost") else "development",
        )
        logger.info("✅ Sentry monitoring initialized")
    except Exception as e:
        logger.warning(f"Failed to initialize Sentry: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    logger.info("🚀 Expense Tracker API started")
    logger.info(f"📊 Log level: {settings.LOG_LEVEL}")
    
    if settings.REDIS_URL:
        from app.core.cache import get_redis_client
        if get_redis_client():
            logger.info("✅ Redis caching enabled")
        else:
            logger.warning("⚠️ Redis configured but connection failed")
    else:
        logger.info("ℹ️ Redis caching disabled (REDIS_URL not set)")
    
    if settings.SMTP_HOST:
        logger.info("✅ Email notifications enabled")
    else:
        logger.info("ℹ️ Email notifications disabled (SMTP not configured)")
    
    yield
    
    # Shutdown
    logger.info("👋 Expense Tracker API shutting down")


app = FastAPI(
    title="Expense Tracker API",
    description="Personal expense management API with authentication",
    version="1.0.0",
    lifespan=lifespan,
)

# Add logging middleware (before CORS)
app.add_middleware(LoggingMiddleware)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS] if isinstance(settings.BACKEND_CORS_ORIGINS, list) else [settings.BACKEND_CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix="/api")
app.include_router(categories_router, prefix="/api")
app.include_router(expenses_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(recurring_expenses_router, prefix="/api")
app.include_router(users_router, prefix="/api")


@app.get("/")
def root():
    """Health check endpoint."""
    return {"status": "healthy", "message": "Expense Tracker API is running"}


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
