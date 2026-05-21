# 📊 Hướng dẫn Setup ELK Stack cho Expense Tracker

## Tổng quan

Dự án đã được tích hợp sẵn ELK Stack (Elasticsearch, Logstash, Kibana) để quản lý logs và phân tích dữ liệu.

## ✅ Checklist Setup

### 1. Cấu hình Environment Variables

Thêm vào file `backend/.env`:

```bash
# ELK Stack Configuration
ELASTICSEARCH_URL=https://your-elasticsearch-url.com
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=<your_password_here>
KIBANA_URL=https://your-kibana-url.com
ELK_ENABLED=true
```

### 2. Cài đặt Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

Các packages mới được thêm:
- `elasticsearch==8.12.0` - Client để kết nối Elasticsearch
- `python-logstash-async==2.5.0` - Async logging handler

### 3. Setup Elasticsearch Indices

Chạy script để tạo index templates và ILM policies:

```bash
cd backend
python scripts/setup_elk.py
```

Script này sẽ:
- ✅ Kết nối đến Elasticsearch
- ✅ Tạo Index Template cho logs
- ✅ Tạo ILM Policy (giữ logs 30 ngày)
- ✅ Cấu hình index settings

### 4. Test Logging

Chạy script test để verify:

```bash
python scripts/test_elk_logging.py
```

Script sẽ tạo các test logs:
- HTTP requests
- Transactions
- Budget alerts
- AI queries
- OCR scans

### 5. Setup Kibana

#### 5.1. Tạo Index Pattern

1. Truy cập: https://your-kibana-url.com
2. Vào **Stack Management** > **Index Patterns**
3. Create pattern: `expense-tracker-logs-*`
4. Time field: `@timestamp`

#### 5.2. Xem Logs

1. Vào **Discover**
2. Chọn index pattern vừa tạo
3. Set time range: Last 15 minutes
4. Xem test logs

### 6. Khởi động Application

```bash
cd backend
uvicorn main:app --reload
```

Logs sẽ tự động được gửi đến Elasticsearch!

## 📝 Các loại Logs được track

### 1. HTTP Request Logs
Tất cả API requests được log với:
- Method, Path, Status Code
- Response time (ms)
- User ID (nếu authenticated)
- Errors (nếu có)

### 2. Business Event Logs

#### Transactions
```json
{
  "event_type": "transaction_created",
  "user_id": 123,
  "transaction_type": "expense",
  "amount": 50000,
  "currency": "VND"
}
```

#### Budget Alerts
```json
{
  "event_type": "budget_alert",
  "alert_level": "warning",
  "percentage": 85
}
```

#### AI Queries
```json
{
  "event_type": "ai_query",
  "query": "Phân tích chi tiêu",
  "response_time_ms": 1234.56
}
```

#### OCR Scans
```json
{
  "event_type": "ocr_scan",
  "success": true,
  "extracted_amount": 50000
}
```

## 🎯 Sử dụng trong Code

### Log Business Events

```python
from app.utils.elk_logger import (
    log_transaction_created,
    log_budget_alert,
    log_ai_query
)

# Trong API endpoint
log_transaction_created(
    user_id=current_user.id,
    transaction_type="expense",
    amount=expense.amount,
    currency=expense.currency,
    category_id=expense.category_id
)
```

### Log Custom Events

```python
from app.core.logging import log_business_event

log_business_event(
    event_type="custom_event",
    user_id=user.id,
    custom_field="value"
)
```

## 📊 Kibana Dashboards

### Recommended Visualizations

1. **HTTP Requests Over Time** (Line Chart)
   - Y-axis: Count
   - X-axis: @timestamp
   - Split: path.keyword

2. **Response Time** (Line Chart)
   - Y-axis: Avg duration_ms
   - X-axis: @timestamp

3. **Status Codes** (Pie Chart)
   - Slice by: status_code

4. **Transaction Volume** (Metric)
   - Filter: event_type="transaction_created"
   - Metric: Count

5. **Budget Alerts** (Table)
   - Filter: event_type="budget_alert"
   - Columns: user_id, category_id, percentage, alert_level

### Useful Queries

```
# Tìm errors
status_code >= 400

# Tìm slow requests
duration_ms > 1000

# Xem transactions của user
event_type: "transaction_created" AND user_id: 123

# Xem budget alerts
event_type: "budget_alert" AND alert_level: "critical"

# Xem failed AI queries
event_type: "ai_query" AND success: false
```

## 🔧 Troubleshooting

### Không kết nối được Elasticsearch

```bash
# Test connection
curl -u elastic:password https://your-elasticsearch-url.com

# Check logs
tail -f backend/logs/app_*.log
```

### Logs không xuất hiện trong Kibana

1. ✅ Check `ELK_ENABLED=true` trong .env
2. ✅ Restart application
3. ✅ Verify credentials
4. ✅ Check index pattern trong Kibana

### Performance Issues

```bash
# Giảm log level
LOG_LEVEL=WARNING

# Hoặc disable ELK tạm thời
ELK_ENABLED=false
```

## 📚 Tài liệu chi tiết

- [Quick Start Guide](backend/docs/ELK_QUICKSTART.md) - Hướng dẫn nhanh
- [Full Setup Guide](backend/docs/ELK_SETUP.md) - Hướng dẫn đầy đủ

## 🎉 Hoàn thành!

Sau khi setup xong, anh sẽ có:
- ✅ Tất cả logs được gửi tự động đến Elasticsearch
- ✅ Xem và search logs trong Kibana
- ✅ Tạo dashboards và visualizations
- ✅ Setup alerts cho errors và anomalies
- ✅ Phân tích business metrics

Chúc anh setup thành công! 🚀
