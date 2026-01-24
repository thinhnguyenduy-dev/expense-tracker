from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging import setup_logging, get_logger
from app.api import auth_router, categories_router, expenses_router, dashboard_router, recurring_expenses_router
from app.middleware import LoggingMiddleware

# Setup logging first
setup_logging()
logger = get_logger()

app = FastAPI(
    title="Expense Tracker API",
    description="Personal expense management API with authentication",
    version="1.0.0"
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


@app.on_event("startup")
async def startup_event():
    """Log application startup."""
    logger.info("🚀 Expense Tracker API started")
    logger.info(f"📊 Log level: {settings.LOG_LEVEL}")


@app.get("/")
def root():
    """Health check endpoint."""
    return {"status": "healthy", "message": "Expense Tracker API is running"}


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}

