# 📋 Hướng dẫn xem Logs

## 1. Xem Logs trong Console (Real-time)

Khi chạy app, logs sẽ hiển thị trực tiếp trong console với format dễ đọc:

```bash
uvicorn main:app --reload
```

### Format Console Logs

#### Successful Request
```
✅ GET /api/expenses - 200 - 45.67ms - User: 123
```

#### Failed Request
```
❌ POST /api/expenses - 500 - 123.45ms - User: 123
   ❌ Error: ValueError: Invalid amount
```

#### Detailed Error
```
❌ Error in POST /api/expenses
   Error Type: ValueError
   Error Message: Invalid amount
   User ID: 123
   Traceback:
   File "/app/api/expenses.py", line 45, in create_expense
     validate_amount(amount)
   ValueError: Invalid amount
```

## 2. Xem Logs trong File

Logs được lưu tự động vào folder `logs/`:

```bash
# Xem logs real-time
tail -f logs/app_2026-05-21.log

# Xem 100 dòng cuối
tail -n 100 logs/app_2026-05-21.log

# Tìm errors
grep "ERROR" logs/app_2026-05-21.log

# Tìm errors với context
grep -A 5 -B 5 "ERROR" logs/app_2026-05-21.log

# Tìm theo user
grep "User: 123" logs/app_2026-05-21.log

# Tìm slow requests (> 1 second)
grep -E "[0-9]{4,}\.[0-9]{2}ms" logs/app_2026-05-21.log
```

## 3. Xem Logs trong Kibana

### 3.1. Truy cập Kibana
https://your-kibana-url.com

### 3.2. Vào Discover
1. Click **☰ Menu** > **Discover**
2. Chọn index pattern: `expense-tracker-logs-*`
3. Chọn time range (ví dụ: Last 15 minutes)

### 3.3. Tìm Errors

#### Tất cả errors
```
has_error: true
```

hoặc

```
status_code >= 400
```

#### Errors với message cụ thể
```
error: *ValueError*
```

#### Errors của user cụ thể
```
has_error: true AND user_id: 123
```

#### Errors trong endpoint cụ thể
```
path: "/api/expenses" AND status_code >= 400
```

### 3.4. Xem Chi tiết Error

1. Click vào log entry trong Discover
2. Xem tab **JSON** để thấy full details:

```json
{
  "@timestamp": "2026-05-21T10:24:25.000Z",
  "event_type": "http_request",
  "method": "POST",
  "path": "/api/expenses",
  "status_code": 500,
  "duration_ms": 123.45,
  "user_id": 123,
  "has_error": true,
  "error": "ValueError: Invalid amount",
  "application": "expense-tracker-backend",
  "environment": "production"
}
```

### 3.5. Tạo Saved Search cho Errors

1. Trong Discover, nhập query: `has_error: true`
2. Click **Save** ở góc trên
3. Đặt tên: "All Errors"
4. Lần sau chỉ cần load saved search này

## 4. Queries Hữu Ích

### Tìm 500 Errors
```
status_code: 500
```

### Tìm 404 Not Found
```
status_code: 404
```

### Tìm Authentication Errors
```
status_code: 401 OR status_code: 403
```

### Tìm Slow Requests (> 1 second)
```
duration_ms > 1000
```

### Tìm Errors trong 1 giờ qua
```
has_error: true AND @timestamp >= now-1h
```

### Tìm Errors của endpoint cụ thể
```
path: "/api/ai/chat" AND has_error: true
```

### Tìm theo Error Type
```
error: *ValueError* OR error: *KeyError* OR error: *TypeError*
```

### Xem Activity của User
```
user_id: 123
```

### Tìm Failed Transactions
```
event_type: "transaction_created" AND error: *
```

### Tìm Failed AI Queries
```
event_type: "ai_query" AND success: false
```

## 5. Tạo Visualizations cho Errors

### 5.1. Error Rate Over Time

1. Vào **Visualize Library** > **Create visualization**
2. Chọn **Line**
3. Index: `expense-tracker-logs-*`
4. Metrics:
   - Y-axis: Count
5. Buckets:
   - X-axis: Date Histogram on @timestamp
   - Split series: Terms on `has_error`
6. Save: "Error Rate Over Time"

### 5.2. Top Errors

1. Create visualization > **Table**
2. Metrics:
   - Metric: Count
3. Buckets:
   - Split rows: Terms on `error.keyword` (Top 10)
4. Save: "Top Errors"

### 5.3. Errors by Endpoint

1. Create visualization > **Bar**
2. Metrics:
   - Y-axis: Count
3. Buckets:
   - X-axis: Terms on `path.keyword`
   - Filter: `has_error: true`
4. Save: "Errors by Endpoint"

### 5.4. Error Status Code Distribution

1. Create visualization > **Pie**
2. Metrics:
   - Slice size: Count
3. Buckets:
   - Split slices: Terms on `status_code`
   - Filter: `status_code >= 400`
4. Save: "Error Status Codes"

## 6. Setup Alerts cho Errors

### 6.1. Alert cho High Error Rate

1. Vào **Stack Management** > **Rules and Connectors**
2. Click **Create rule**
3. Rule type: **Elasticsearch query**
4. Configure:
   - Index: `expense-tracker-logs-*`
   - Query: `has_error: true`
   - Threshold: Count > 10 trong 5 phút
5. Action: Send email/Slack notification

### 6.2. Alert cho 500 Errors

1. Create rule
2. Query: `status_code: 500`
3. Threshold: Count > 5 trong 5 phút
4. Action: Send notification

### 6.3. Alert cho Specific Error

1. Create rule
2. Query: `error: *DatabaseError*`
3. Threshold: Count > 0
4. Action: Send immediate notification

## 7. Debug Workflow

### Khi có lỗi, làm theo các bước:

#### Bước 1: Xem Console Log
```bash
# Xem real-time
tail -f logs/app_*.log
```

Tìm error message và traceback đầy đủ.

#### Bước 2: Xem trong Kibana
```
# Tìm error trong Kibana
has_error: true AND @timestamp >= now-15m
```

Click vào log entry để xem full details.

#### Bước 3: Xem Context
```
# Xem tất cả requests của user đó
user_id: 123 AND @timestamp >= now-1h
```

Xem user đã làm gì trước khi gặp error.

#### Bước 4: Xem Pattern
```
# Xem tất cả errors tương tự
error: *ValueError*
```

Kiểm tra xem có nhiều users gặp lỗi tương tự không.

## 8. Tips & Tricks

### Sử dụng KQL (Kibana Query Language)

```
# AND
has_error: true AND user_id: 123

# OR
status_code: 500 OR status_code: 502

# NOT
NOT status_code: 200

# Wildcard
error: *Database*

# Range
duration_ms > 1000 AND duration_ms < 5000

# Exists
error: *

# Time range
@timestamp >= "2026-05-21T00:00:00" AND @timestamp < "2026-05-22T00:00:00"
```

### Sử dụng Filters

Thay vì gõ query, có thể dùng filters:

1. Click **+ Add filter**
2. Field: `has_error`
3. Operator: `is`
4. Value: `true`
5. Click **Save**

### Export Logs

1. Trong Discover, filter logs cần export
2. Click **Share** > **CSV Reports**
3. Click **Generate CSV**

### Xem Logs theo Time

1. Click time picker (góc trên bên phải)
2. Chọn:
   - Quick: Last 15 minutes, Last 1 hour, Today
   - Relative: Last 30 minutes, Last 2 hours
   - Absolute: Chọn exact time range

## 9. Common Issues

### Không thấy logs mới

1. Check time range (có thể đang xem quá khứ)
2. Click **Refresh** hoặc enable **Auto-refresh**
3. Verify app đang chạy và ELK_ENABLED=true

### Logs không có error details

1. Check app version (phải dùng version mới)
2. Restart app để apply changes
3. Trigger error mới để test

### Quá nhiều logs

1. Sử dụng filters để narrow down
2. Tăng time range nếu cần
3. Sử dụng saved searches

## 10. Best Practices

1. **Luôn check console logs trước** - Nhanh nhất để debug
2. **Sử dụng Kibana cho analysis** - Xem patterns và trends
3. **Tạo saved searches** - Cho các queries thường dùng
4. **Setup alerts** - Để biết ngay khi có errors
5. **Export logs** - Khi cần share với team
6. **Check context** - Xem user activity trước khi error
7. **Look for patterns** - Nhiều users cùng lỗi = bug nghiêm trọng

## 11. Quick Commands Cheat Sheet

```bash
# Xem logs real-time
tail -f logs/app_*.log

# Tìm errors
grep "ERROR" logs/app_*.log

# Tìm errors với context (5 dòng trước/sau)
grep -A 5 -B 5 "ERROR" logs/app_*.log

# Count errors
grep -c "ERROR" logs/app_*.log

# Tìm theo user
grep "User: 123" logs/app_*.log

# Tìm slow requests
grep -E "[0-9]{4,}\.[0-9]{2}ms" logs/app_*.log

# Xem logs của hôm nay
cat logs/app_$(date +%Y-%m-%d).log

# Tìm trong tất cả log files
grep "ERROR" logs/*.log
```

## 12. Kibana Quick Queries

```
# All errors
has_error: true

# Recent errors (15 mins)
has_error: true AND @timestamp >= now-15m

# Specific user errors
user_id: 123 AND has_error: true

# Endpoint errors
path: "/api/expenses" AND status_code >= 400

# Slow requests
duration_ms > 1000

# Failed business events
event_type: "transaction_created" AND error: *

# Database errors
error: *Database*

# Validation errors
error: *Validation* OR error: *Invalid*
```
