"""
Logging configuration using Loguru.
"""
import sys
from loguru import logger
from app.core.config import settings


def setup_logging() -> None:
    """Configure Loguru logger for the application."""
    # Remove default handler
    logger.remove()
    
    # Determine log level from settings
    log_level = getattr(settings, "LOG_LEVEL", "INFO")
    
    # Add console handler with custom format
    logger.add(
        sys.stdout,
        level=log_level,
        format=(
            "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
            "<level>{level: <8}</level> | "
            "<cyan>{extra[request_id]}</cyan> | "
            "<level>{message}</level>"
        ),
        filter=lambda record: "request_id" in record["extra"],
        colorize=True,
    )
    
    # Add handler for logs without request_id (startup, etc.)
    logger.add(
        sys.stdout,
        level=log_level,
        format=(
            "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
            "<level>{level: <8}</level> | "
            "<level>{message}</level>"
        ),
        filter=lambda record: "request_id" not in record["extra"],
        colorize=True,
    )
    
    logger.info(f"Logging configured with level: {log_level}")


def get_logger():
    """Get the configured logger instance."""
    return logger
