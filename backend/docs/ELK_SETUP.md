# ELK Stack Integration Guide

## Tổng quan

Dự án đã được tích hợp với ELK Stack (Elasticsearch, Logstash, Kibana) để quản lý logs và phân tích dữ liệu.

## Cấu hình

### 1. Environment Variables

Thêm các biến sau vào file `.env`:

```bash
# ELK Stack
ELASTICSEARCH_URL=https://your-elasticsearch-url.com
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=your_password_here
KIBANA_URL=https://your-kibana-url.com
ELK_ENABLED=true
```

### 2. Cài đặt Dependencies

```bash
pip install -r requirements.txt
```

### 3. Setup Elasticsearch Indices

Chạy script setup để tạo index templates và policies:

```bash
cd backend
python scripts/setup_elk.py
```

Script này sẽ:
- Tạo index template cho logs
- Tạo ILM (Index Lifecycle Management) policy
- Cấu hình retention policy (giữ logs 30 ngày)

## Cấu trúc Logs

### HTTP Request Logs

Mọi HTTP request đều được log với thông tin:
- `method`: HTTP method (GET, POST, PUT, DELETE)
- `path`: Request path
- `status_code`: Response status code
- `duration_ms`: Request duration in milliseconds
- `user_id`: User ID (nếu authenticated)
- `error`: Error message (nếu có)

### Business Event Logs

Các sự kiện nghiệp vụ được log:

#### Transaction Events
```json
{
  "event_type": "transaction_created",
  "user_id": 123,
  "transaction_type": "expense",
  "amount": 50000,
  "currency": "VND",
  "category_id": 5
}
```

#### Budget Alerts
```json
{
  "event_type": "budget_alert",
  "user_id": 123,
  "category_id": 5,
  "budget_limit": 1000000,
  "current_spending": 850000,
  "percentage": 85,
  "alert_level": "warning"
}
```

#### AI Queries
```json
{
  "event_type": "ai_query",
  "user_id": 123,
  "query": "Phân tích chi tiêu tháng này",
  "response_time_ms": 1234.56,
  "success": true
}
```

#### OCR Scans
```json
{
  "event_type": "ocr_scan",
  "user_id": 123,
  "success": true,
  "processing_time_ms": 567.89,
  "extracted_amount": 50000
}
```

## Sử dụng trong Code

### Log Business Events

```python
from app.utils.elk_logger import (
    log_transaction_created,
    log_budget_alert,
    log_ai_query,
    log_ocr_scan
)

# Log transaction
log_transaction_created(
    user_id=user.id,
    transaction_type="expense",
    amount=50000,
    currency="VND",
    category_id=5
)

# Log budget alert
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
    user_id=123,
    custom_field="value",
    another_field=42
)
```

## Kibana Setup

### 1. Tạo Index Pattern

1. Truy cập Kibana: https://your-kibana-url.com
2. Vào **Stack Management** > **Index Patterns**
3. Click **Create index pattern**
4. Nhập pattern: `expense-tracker-logs-*`
5. Chọn **@timestamp** làm time field
6. Click **Create index pattern**

### 2. Xem Logs trong Discover

1. Vào **Discover**
2. Chọn index pattern `expense-tracker-logs-*`
3. Chọn time range phù hợp
4. Sử dụng filters để tìm kiếm:
   - `event_type: "http_request"`
   - `status_code: 500`
   - `user_id: 123`
   - `event_type: "transaction_created"`

### 3. Tạo Visualizations

#### Request Duration Chart
- Type: Line chart
- Y-axis: Average of `duration_ms`
- X-axis: @timestamp
- Split series: `path.keyword`

#### Status Code Distribution
- Type: Pie chart
- Slice by: `status_code`

#### User Activity
- Type: Bar chart
- Y-axis: Count
- X-axis: `user_id`
- Split series: `event_type.keyword`

#### Transaction Volume
- Type: Area chart
- Y-axis: Sum of `amount`
- X-axis: @timestamp
- Filter: `event_type: "transaction_created"`

### 4. Tạo Dashboard

1. Vào **Dashboard** > **Create dashboard**
2. Add các visualizations đã tạo
3. Arrange và resize theo ý muốn
4. Save dashboard với tên: "Expense Tracker Overview"

## Queries Hữu Ích

### Tìm slow requests (> 1 second)
```
event_type: "http_request" AND duration_ms > 1000
```

### Tìm errors
```
status_code >= 400 OR error: *
```

### Xem transactions của user
```
event_type: "transaction_created" AND user_id: 123
```

### Xem budget alerts
```
event_type: "budget_alert" AND alert_level: "critical"
```

### Xem AI queries
```
event_type: "ai_query"
```

### Xem failed AI queries
```
event_type: "ai_query" AND success: false
```

## Monitoring & Alerts

### Tạo Alerts trong Kibana

1. Vào **Stack Management** > **Rules and Connectors**
2. Click **Create rule**
3. Chọn rule type: **Elasticsearch query**

#### Alert cho High Error Rate
- Query: `status_code >= 500`
- Threshold: Count > 10 trong 5 phút
- Action: Send email/Slack notification

#### Alert cho Slow Requests
- Query: `duration_ms > 5000`
- Threshold: Count > 5 trong 5 phút

#### Alert cho Budget Exceeded
- Query: `event_type: "budget_alert" AND alert_level: "critical"`
- Threshold: Count > 0
- Action: Send notification

## Best Practices

1. **Structured Logging**: Luôn log dưới dạng JSON với các fields chuẩn
2. **Sensitive Data**: Không log passwords, tokens, hoặc PII
3. **Log Levels**: Sử dụng đúng log levels (INFO, WARNING, ERROR)
4. **Performance**: ELK logging là async, không ảnh hưởng performance
5. **Retention**: Logs được giữ 30 ngày, sau đó tự động xóa

## Troubleshooting

### Không kết nối được Elasticsearch
```bash
# Test connection
curl -u elastic:password https://your-elasticsearch-url.com
```

### Logs không xuất hiện trong Kibana
1. Check ELK_ENABLED=true trong .env
2. Check Elasticsearch credentials
3. Check logs/app_*.log để xem errors
4. Verify index pattern trong Kibana

### Performance Issues
1. Giảm log level: `LOG_LEVEL=WARNING`
2. Disable ELK tạm thời: `ELK_ENABLED=false`
3. Check Elasticsearch cluster health

## Tài liệu tham khảo

- [Elasticsearch Documentation](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
- [Kibana Documentation](https://www.elastic.co/guide/en/kibana/current/index.html)
- [Loguru Documentation](https://loguru.readthedocs.io/)
