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
    
    # If we have a cached client, verify it's still alive
    if _redis_client is not None:
        try:
            _redis_client.ping()
            return _redis_client
        except Exception:
            # Connection died, reset and reconnect
            _redis_client = None
            logger.info("Redis connection lost, attempting reconnect...")
    
    try:
        import redis
        _redis_client = redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_timeout=5,        # 5 second timeout for operations
            socket_connect_timeout=5, # 5 second timeout for connection
            retry_on_timeout=True,   # Retry on timeout errors
        )
        # Test connection
        _redis_client.ping()
        logger.info("Redis connection established")
        return _redis_client
    except Exception as e:
        logger.warning(f"Redis connection failed: {e}. Caching disabled.")
        _redis_client = None
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


def acached(prefix: str, ttl: Optional[int] = None):
    """
    Decorator to cache async function results in Redis.
    Uses redis.asyncio if available.
    """
    if ttl is None:
        ttl = settings.CACHE_TTL_SECONDS
        
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Try to use async redis client
            try:
                import redis.asyncio as redis_async
                # We need a way to get or create an async client.
                # Since get_redis_client() returns a sync client, we often need a separate async one.
                # For simplicity in this codebase which uses both, we might need a separate managed async client.
                # However, creating one per call is expensive.
                # Let's use a global async client similar to the sync one.
                pass
            except ImportError:
                # If redis.asyncio not available, just rename invoke
                return await func(*args, **kwargs)

            # Lazy init global async client
            global _async_redis_client
            if '_async_redis_client' not in globals():
                _async_redis_client = None
            
            if settings.REDIS_URL is None:
                return await func(*args, **kwargs)

            if _async_redis_client is None:
                try:
                    _async_redis_client = redis_async.from_url(
                        settings.REDIS_URL,
                        decode_responses=True,
                        socket_timeout=5,
                        socket_connect_timeout=5
                    )
                except Exception as e:
                    logger.warning(f"Async redis init failed: {e}")
                    return await func(*args, **kwargs)
            
            # Use the async client
            client = _async_redis_client
            key = f"{prefix}:{cache_key(*args, **kwargs)}"
            
            try:
                cached_value = await client.get(key)
                if cached_value is not None:
                    logger.debug(f"Async Cache hit: {key}")
                    return json.loads(cached_value)
                
                result = await func(*args, **kwargs)
                
                await client.setex(key, ttl, json.dumps(result, default=str))
                logger.debug(f"Async Cache set: {key}")
                return result
            except Exception as e:
                logger.warning(f"Async cache error: {e}")
                return await func(*args, **kwargs)
                
        return wrapper
    return decorator
