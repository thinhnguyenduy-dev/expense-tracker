"""
Logging middleware for FastAPI
"""
import time
import traceback
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.logging import log_request, app_logger as logger


class LoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to log all HTTP requests"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Start timer
        start_time = time.time()
        
        # Get user_id if authenticated
        user_id = None
        if hasattr(request.state, "user") and request.state.user:
            user_id = request.state.user.id
        
        # Process request
        response = None
        error = None
        error_type = None
        
        try:
            response = await call_next(request)
            return response
        except Exception as e:
            # Capture detailed error information
            error_type = type(e).__name__
            error = str(e)
            
            # Log detailed error to console
            logger.error(
                f"❌ Error in {request.method} {request.url.path}\n"
                f"   Error Type: {error_type}\n"
                f"   Error Message: {error}\n"
                f"   User ID: {user_id}\n"
                f"   Traceback:\n{traceback.format_exc()}"
            )
            raise
        finally:
            # Calculate duration
            duration_ms = (time.time() - start_time) * 1000
            
            # Log request with error details
            log_request(
                method=request.method,
                path=request.url.path,
                status_code=response.status_code if response else 500,
                duration_ms=duration_ms,
                user_id=user_id,
                error=f"{error_type}: {error}" if error_type else error
            )
