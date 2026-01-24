"""Redis caching module with graceful fallback when Redis is unavailable."""
import json
import hashlib
from functools import wraps
from typing import Optional, Callable, Any
from loguru import logger

from .config import settings

# Redis client (lazily initialized)
_redis_client = None


def get_redis_client():
    """Get Redis client, returns None if Redis is not configured or unavailable."""
    global _redis_client
    
    if settings.REDIS_URL is None:
        return None
    
    if _redis_client is not None:
        return _redis_client
    
    try:
        import redis
        _redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        # Test connection
        _redis_client.ping()
        logger.info("Redis connection established")
        return _redis_client
    except Exception as e:
        logger.warning(f"Redis connection failed: {e}. Caching disabled.")
        return None


def cache_key(*args, **kwargs) -> str:
    """Generate a cache key from arguments."""
    key_data = json.dumps({"args": args, "kwargs": kwargs}, sort_keys=True, default=str)
    return hashlib.md5(key_data.encode()).hexdigest()


def cached(prefix: str, ttl: Optional[int] = None):
    """
    Decorator to cache function results in Redis.
    Falls back to no caching if Redis is unavailable.
    
    Args:
        prefix: Cache key prefix (e.g., "dashboard_stats")
        ttl: Time to live in seconds (defaults to CACHE_TTL_SECONDS from settings)
    """
    if ttl is None:
        ttl = settings.CACHE_TTL_SECONDS
    
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            redis = get_redis_client()
            
            # If Redis is not available, just run the function
            if redis is None:
                return func(*args, **kwargs)
            
            # Generate cache key
            key = f"{prefix}:{cache_key(*args, **kwargs)}"
            
            try:
                # Try to get from cache
                cached_value = redis.get(key)
                if cached_value is not None:
                    logger.debug(f"Cache hit: {key}")
                    return json.loads(cached_value)
                
                # Cache miss - run function
                result = func(*args, **kwargs)
                
                # Store in cache
                redis.setex(key, ttl, json.dumps(result, default=str))
                logger.debug(f"Cache set: {key} (TTL: {ttl}s)")
                
                return result
            except Exception as e:
                logger.warning(f"Cache error: {e}. Falling back to direct execution.")
                return func(*args, **kwargs)
        
        return wrapper
    return decorator


def invalidate_cache(prefix: str, *args, **kwargs):
    """Invalidate a specific cache entry."""
    redis = get_redis_client()
    if redis is None:
        return
    
    key = f"{prefix}:{cache_key(*args, **kwargs)}"
    try:
        redis.delete(key)
        logger.debug(f"Cache invalidated: {key}")
    except Exception as e:
        logger.warning(f"Cache invalidation error: {e}")


def invalidate_cache_pattern(pattern: str):
    """Invalidate all cache entries matching a pattern."""
    redis = get_redis_client()
    if redis is None:
        return
    
    try:
        keys = redis.keys(f"{pattern}:*")
        if keys:
            redis.delete(*keys)
            logger.debug(f"Cache invalidated: {len(keys)} keys matching {pattern}:*")
    except Exception as e:
        logger.warning(f"Cache pattern invalidation error: {e}")
