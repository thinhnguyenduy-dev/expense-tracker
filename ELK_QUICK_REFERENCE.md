# 📊 ELK Stack - Quick Reference Card

## ⚡ Quick Commands

```bash
# Setup Elasticsearch indices
python scripts/setup_elk.py

# Test logging
python scripts/test_elk_logging.py

# Start app
uvicorn main:app --reload

# View logs
tail -f logs/app_*.log
```

## 🔧 Environment Variables

```bash
ELASTICSEARCH_URL=https://your-elasticsearch-url.com
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=your_password
KIBANA_URL=https://your-kibana-url.com
ELK_ENABLED=true
LOG_LEVEL=INFO
```

## 💻 Code Usage

### Import Logger
```python
from app.core.logging import app_logger as logger

logger.info("Message")
logger.warning("Warning")
logger.error("Error")
```

### Log Business Events
```python
from app.utils.elk_logger import (
    log_transaction_created,
    log_budget_alert,
    log_ai_query,
    log_ocr_scan
)

# Transaction
log_transaction_created(
    user_id=user.id,
    transaction_type="expense",
    amount=50000,
    currency="VND"
)

# Budget Alert
log_budget_alert(
    user_id=user.id,
    category_id=5,
    budget_limit=1000000,
    current_spending=850000,
    percentage=85,
    alert_level="warning"
)
```

### Log Custom Events
```python
from app.core.logging import log_business_event

log_business_event(
    event_type="custom_event",
    user_id=user.id,
    field1="value1",
    field2=42
)
```

## 🔍 Xem Logs

### Console (Real-time)
```bash
# Xem logs khi chạy app
uvicorn main:app --reload

# Logs sẽ hiển thị:
✅ GET /api/expenses - 200 - 45.67ms - User: 123
❌ POST /api/expenses - 500 - 123.45ms - User: 123
   ❌ Error: ValueError: Invalid amount
```

### File Logs
```bash
# Xem real-time
tail -f logs/app_*.log

# Tìm errors
grep "ERROR" logs/app_*.log

# Tìm errors với context
grep -A 5 -B 5 "ERROR" logs/app_*.log

# Tìm theo user
grep "User: 123" logs/app_*.log
```

### Kibana
```
# Tất cả errors
has_error: true

# Errors trong 15 phút
has_error: true AND @timestamp >= now-15m

# Errors của user
user_id: 123 AND has_error: true

# Errors trong endpoint
path: "/api/expenses" AND status_code >= 400
```

## 🔍 Kibana Queries

### Find Errors
```
status_code >= 400 OR error: *
```

### Find Slow Requests
```
duration_ms > 1000
```

### User Activity
```
user_id: 123
```

### Transactions
```
event_type: "transaction_created"
```

### Budget Alerts
```
event_type: "budget_alert" AND alert_level: "critical"
```

### AI Queries
```
event_type: "ai_query"
```

### Failed Operations
```
success: false
```

## 📊 Index Pattern

```
expense-tracker-logs-*
```

Time field: `@timestamp`

## 🎯 Common Log Fields

### HTTP Requests
- `event_type`: "http_request"
- `method`: GET, POST, PUT, DELETE
- `path`: /api/expenses
- `status_code`: 200, 404, 500
- `duration_ms`: Response time
- `user_id`: User ID
- `error`: Error message

### Transactions
- `event_type`: "transaction_created"
- `transaction_type`: expense, income
- `amount`: Amount
- `currency`: VND, USD
- `category_id`: Category ID

### Budget Alerts
- `event_type`: "budget_alert"
- `alert_level`: warning, critical
- `percentage`: 85, 104
- `budget_limit`: Limit amount
- `current_spending`: Current amount

### AI Queries
- `event_type`: "ai_query"
- `query`: User query
- `response_time_ms`: Response time
- `success`: true/false
- `error`: Error message

## 🚨 Troubleshooting

### Cannot connect to Elasticsearch
```bash
# Test connection
curl -u elastic:password https://your-elasticsearch-url.com

# Check credentials in .env
cat .env | grep ELASTICSEARCH
```

### Logs not appearing
1. Check `ELK_ENABLED=true`
2. Restart app
3. Check `logs/app_*.log` for errors
4. Verify index pattern in Kibana

### Import errors
```python
# Old (wrong)
from app.core.logging import get_logger

# New (correct)
from app.core.logging import app_logger as logger
```

## 📚 Documentation

- [Quick Start](backend/docs/ELK_QUICKSTART.md)
- [Full Setup](backend/docs/ELK_SETUP.md)
- [Integration Examples](backend/docs/ELK_INTEGRATION_EXAMPLES.md)
- [Migration Guide](backend/docs/LOGGING_MIGRATION.md)
- [Setup Guide](SETUP_ELK.md)
- [Implementation Summary](ELK_IMPLEMENTATION_SUMMARY.md)

## ✅ Checklist

- [ ] Install dependencies: `pip install -r requirements.txt`
- [ ] Configure `.env` with Elasticsearch credentials
- [ ] Run setup: `python scripts/setup_elk.py`
- [ ] Test logging: `python scripts/test_elk_logging.py`
- [ ] Create Kibana index pattern: `expense-tracker-logs-*`
- [ ] Start app: `uvicorn main:app --reload`
- [ ] View logs in Kibana Discover
- [ ] Create dashboards (optional)

## 🎉 Success Indicators

✅ App starts without errors
✅ Console shows: "✅ Connected to Elasticsearch"
✅ Console shows: "📊 ELK Stack logging enabled"
✅ Logs appear in Kibana Discover
✅ HTTP requests are logged automatically
✅ Business events are tracked

## 🔗 URLs

- **Elasticsearch**: https://your-elasticsearch-url.com
- **Kibana**: https://your-kibana-url.com
- **API Docs**: http://localhost:8000/docs
- **App**: http://localhost:3000
