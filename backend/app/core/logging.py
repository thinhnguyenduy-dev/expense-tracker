"""
Logging configuration with ELK Stack integration
"""
import sys
import json
from pathlib import Path
from typing import Optional, Dict, Any
from loguru import logger
from elasticsearch import Elasticsearch
from datetime import datetime
from app.core.config import settings

# Anchor logs to backend/logs regardless of the process CWD (this file lives at
# backend/app/core/logging.py → parents[2] == backend). A relative "logs/" path
# would otherwise create a stray logs/ dir wherever the process was started.
_LOG_DIR = Path(__file__).resolve().parents[2] / "logs"


class ElasticsearchHandler:
    """Custom handler to send logs to Elasticsearch"""
    
    def __init__(self):
        self.es_client: Optional[Elasticsearch] = None
        self.index_prefix = "expense-tracker-logs"
        
        if settings.ELK_ENABLED and settings.ELASTICSEARCH_URL:
            try:
                self.es_client = Elasticsearch(
                    [settings.ELASTICSEARCH_URL],
                    basic_auth=(
                        settings.ELASTICSEARCH_USERNAME,
                        settings.ELASTICSEARCH_PASSWORD
                    ) if settings.ELASTICSEARCH_PASSWORD else None,
                    verify_certs=True,
                    request_timeout=5
                )
                # Test connection
                if self.es_client.ping():
                    logger.info("✅ Connected to Elasticsearch")
                else:
                    logger.warning("⚠️ Elasticsearch ping failed")
                    self.es_client = None
            except Exception as e:
                logger.error(f"❌ Failed to connect to Elasticsearch: {e}")
                self.es_client = None
    
    def write(self, message: str):
        """Write log message to Elasticsearch"""
        if not self.es_client:
            return
        
        try:
            # Parse log message
            log_data = self._parse_log_message(message)
            
            # Create index name with date (e.g., expense-tracker-logs-2026-05-21)
            index_name = f"{self.index_prefix}-{datetime.utcnow().strftime('%Y-%m-%d')}"
            
            # Send to Elasticsearch
            self.es_client.index(
                index=index_name,
                document=log_data
            )
        except Exception as e:
            # Don't let logging errors crash the app
            print(f"Error sending log to Elasticsearch: {e}", file=sys.stderr)
    
    def _parse_log_message(self, message: str) -> Dict[str, Any]:
        """Parse loguru message into structured data"""
        try:
            # Try to parse as JSON first (for structured logs)
            if message.strip().startswith('{'):
                data = json.loads(message)
                data['@timestamp'] = datetime.utcnow().isoformat()
                return data
        except:
            pass
        
        # Fallback: create basic structure
        return {
            '@timestamp': datetime.utcnow().isoformat(),
            'message': message.strip(),
            'application': 'expense-tracker-backend',
            'environment': settings.ENVIRONMENT
        }


def setup_logging():
    """Configure logging with Loguru and ELK integration"""
    
    # Remove default handler
    logger.remove()
    
    # Console handler with colors (for development)
    logger.add(
        sys.stdout,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        level=settings.LOG_LEVEL,
        colorize=True
    )
    
    # File handler (rotating) — absolute path so logs always land in backend/logs.
    logger.add(
        str(_LOG_DIR / "app_{time:YYYY-MM-DD}.log"),
        rotation="00:00",  # Rotate at midnight
        retention="30 days",  # Keep logs for 30 days
        compression="zip",  # Compress old logs
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
        level="INFO"
    )
    
    # Elasticsearch handler (if enabled)
    if settings.ELK_ENABLED:
        es_handler = ElasticsearchHandler()
        if es_handler.es_client:
            logger.add(
                es_handler.write,
                format="{message}",
                level="INFO",
                serialize=False
            )
            logger.info("📊 ELK Stack logging enabled")
    
    logger.info(f"🚀 Logging initialized - Environment: {settings.ENVIRONMENT}")
    
    return logger


# Initialize logging
app_logger = setup_logging()


def log_request(
    method: str,
    path: str,
    status_code: int,
    duration_ms: float,
    user_id: Optional[int] = None,
    error: Optional[str] = None
):
    """Log HTTP request in structured format for ELK"""
    log_data = {
        "event_type": "http_request",
        "method": method,
        "path": path,
        "status_code": status_code,
        "duration_ms": round(duration_ms, 2),
        "user_id": user_id,
        "timestamp": datetime.utcnow().isoformat(),
        "application": "expense-tracker-backend",
        "environment": settings.ENVIRONMENT
    }
    
    if error:
        log_data["error"] = error
        log_data["has_error"] = True
    else:
        log_data["has_error"] = False
    
    # Human-readable format for console (always)
    status_emoji = "✅" if status_code < 400 else "❌"
    log_msg = (
        f"{status_emoji} {method} {path} - {status_code} - {duration_ms:.2f}ms"
        + (f" - User: {user_id}" if user_id else "")
    )
    
    if error:
        # Log error separately for better visibility
        logger.error(f"{log_msg}\n   ❌ Error: {error}")
    else:
        logger.info(log_msg)
    
    # Also send structured JSON to ELK if enabled
    if settings.ELK_ENABLED:
        # Send to Elasticsearch handler only (not console)
        import logging
        elk_logger = logging.getLogger("elk_only")
        elk_logger.info(json.dumps(log_data))


def log_business_event(
    event_type: str,
    user_id: Optional[int] = None,
    **kwargs
):
    """Log business events (transactions, budgets, etc.) for analytics"""
    log_data = {
        "event_type": event_type,
        "user_id": user_id,
        "timestamp": datetime.utcnow().isoformat(),
        "application": "expense-tracker-backend",
        "environment": settings.ENVIRONMENT,
        **kwargs
    }
    
    # Human-readable format for console (always)
    logger.info(f"📊 Business Event: {event_type} - User: {user_id} - {kwargs}")
    
    # Also send structured JSON to ELK if enabled
    if settings.ELK_ENABLED:
        import logging
        elk_logger = logging.getLogger("elk_only")
        elk_logger.info(json.dumps(log_data))
