# Logging System Migration

## Changes Made

The logging system has been migrated from the old `get_logger()` pattern to a new ELK-integrated system.

## Old Pattern (Deprecated)

```python
from app.core.logging import setup_logging, get_logger

setup_logging()
logger = get_logger()
```

## New Pattern (Current)

```python
from app.core.logging import app_logger as logger

# Logger is already initialized, just use it
logger.info("Your message")
```

## Files Updated

The following files have been updated to use the new logging pattern:

1. `backend/app/core/exchange_rate.py`
2. `backend/app/core/llm.py`
3. `backend/app/core/ai_logging.py`
4. `backend/app/cron_worker.py`
5. `backend/app/agents/graph.py`
6. `backend/main.py`

## Migration Guide

If you have custom code using the old pattern, update it as follows:

### Before
```python
from app.core.logging import get_logger

logger = get_logger()
logger.info("Message")
```

### After
```python
from app.core.logging import app_logger as logger

logger.info("Message")
```

## New Features

The new logging system includes:

1. **Automatic ELK Integration** - Logs are automatically sent to Elasticsearch when `ELK_ENABLED=true`
2. **Structured Logging** - Support for JSON structured logs
3. **HTTP Request Logging** - Automatic middleware logging
4. **Business Event Logging** - Helper functions for logging business events
5. **Multiple Outputs** - Console, File, and Elasticsearch simultaneously

## Usage Examples

### Basic Logging
```python
from app.core.logging import app_logger as logger

logger.info("Information message")
logger.warning("Warning message")
logger.error("Error message")
```

### HTTP Request Logging (Automatic)
```python
# Handled automatically by LoggingMiddleware
# No code changes needed
```

### Business Event Logging
```python
from app.utils.elk_logger import log_transaction_created

log_transaction_created(
    user_id=user.id,
    transaction_type="expense",
    amount=50000,
    currency="VND"
)
```

### Custom Event Logging
```python
from app.core.logging import log_business_event

log_business_event(
    event_type="custom_event",
    user_id=user.id,
    custom_field="value"
)
```

## Configuration

Set these environment variables in `.env`:

```bash
# Enable/disable ELK logging
ELK_ENABLED=true

# Elasticsearch connection
ELASTICSEARCH_URL=https://your-elasticsearch-url.com
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=your_password

# Kibana URL (optional, for documentation)
KIBANA_URL=https://your-kibana-url.com

# Log level
LOG_LEVEL=INFO  # DEBUG, INFO, WARNING, ERROR
```

## Backward Compatibility

The old `get_logger()` function has been removed. All code must use the new `app_logger` pattern.

## Testing

Test the new logging system:

```bash
# Run test script
python scripts/test_elk_logging.py

# Check logs in console
tail -f logs/app_*.log

# Check logs in Kibana
# Go to Discover and select 'expense-tracker-logs-*' index pattern
```

## Troubleshooting

### Import Error: cannot import name 'get_logger'

**Solution**: Update your imports to use `app_logger`:

```python
# Old (will fail)
from app.core.logging import get_logger
logger = get_logger()

# New (correct)
from app.core.logging import app_logger as logger
```

### Logs not appearing in Elasticsearch

**Check**:
1. `ELK_ENABLED=true` in `.env`
2. Elasticsearch credentials are correct
3. Run `python scripts/setup_elk.py` to create indices
4. Check console logs for connection errors

## Support

For more information, see:
- [ELK Setup Guide](./ELK_SETUP.md)
- [ELK Quick Start](./ELK_QUICKSTART.md)
- [Integration Examples](./ELK_INTEGRATION_EXAMPLES.md)
