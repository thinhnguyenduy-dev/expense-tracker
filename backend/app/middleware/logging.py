"""
Request logging middleware using Loguru.
"""
import time
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from loguru import logger


class LoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to log all incoming requests and outgoing responses."""
    
    async def dispatch(self, request: Request, call_next) -> Response:
        # Generate unique request ID
        request_id = str(uuid.uuid4())[:8]
        
        # Bind request_id to logger context
        request_logger = logger.bind(request_id=request_id)
        
        # Get client IP
        client_ip = request.client.host if request.client else "unknown"
        
        # Log incoming request
        request_logger.info(
            f"→ {request.method} {request.url.path}"
            f"{('?' + str(request.query_params)) if request.query_params else ''}"
            f" | IP: {client_ip}"
        )
        
        # Process request and measure duration
        start_time = time.perf_counter()
        
        try:
            response = await call_next(request)
            duration_ms = (time.perf_counter() - start_time) * 1000
            
            # Log response
            status_emoji = "✓" if response.status_code < 400 else "✗"
            request_logger.info(
                f"← {response.status_code} {status_emoji} | {duration_ms:.1f}ms"
            )
            
            # Add request ID to response headers for debugging
            response.headers["X-Request-ID"] = request_id
            
            return response
            
        except Exception as e:
            duration_ms = (time.perf_counter() - start_time) * 1000
            request_logger.exception(
                f"← 500 ✗ | {duration_ms:.1f}ms | Error: {str(e)}"
            )
            raise
