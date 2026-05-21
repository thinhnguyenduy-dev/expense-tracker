# ✅ Cải thiện Error Logging

## Vấn đề trước đây

Khi có lỗi, logs không rõ ràng:
- JSON format khó đọc trong console
- Không thấy error details ngay lập tức
- Phải vào Kibana mới thấy được lỗi gì

## Giải pháp mới

### 1. Console Logs - Human Readable

#### Successful Request
```
✅ GET /api/expenses - 200 - 45.67ms - User: 123
```

#### Failed Request
```
❌ POST /api/expenses - 500 - 123.45ms - User: 123
   ❌ Error: ValueError: Invalid amount
```

#### Detailed Error with Traceback
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

### 2. Dual Logging System

**Console**: Human-readable format với emoji và colors
- ✅ Success (status < 400)
- ❌ Error (status >= 400)
- Hiển thị error message ngay lập tức
- Hiển thị full traceback cho exceptions

**Elasticsearch**: Structured JSON format
- Tất cả fields được index
- Dễ dàng search và filter
- Tạo visualizations và dashboards

### 3. Error Details

Mỗi error log bao gồm:
- ✅ **Error Type**: ValueError, DatabaseError, etc.
- ✅ **Error Message**: Chi tiết lỗi
- ✅ **User ID**: User nào gặp lỗi
- ✅ **Endpoint**: API endpoint nào
- ✅ **Status Code**: 400, 404, 500, etc.
- ✅ **Duration**: Request mất bao lâu
- ✅ **Traceback**: Full stack trace (nếu có)

## Cách xem Logs

### 1. Console (Nhanh nhất)

Khi chạy app, logs hiển thị real-time:

```bash
uvicorn main:app --reload
```

Bạn sẽ thấy ngay:
```
✅ GET /api/expenses - 200 - 45.67ms - User: 123
❌ POST /api/expenses - 500 - 123.45ms - User: 123
   ❌ Error: ValueError: Invalid amount
```

### 2. File Logs

```bash
# Xem real-time
tail -f logs/app_*.log

# Tìm tất cả errors
grep "ERROR" logs/app_*.log

# Tìm errors với context (5 dòng trước/sau)
grep -A 5 -B 5 "ERROR" logs/app_*.log

# Tìm specific error type
grep "ValueError" logs/app_*.log

# Tìm errors của user cụ thể
grep "User: 123" logs/app_*.log | grep "ERROR"
```

### 3. Kibana (Phân tích)

```
# Tất cả errors
has_error: true

# Errors trong 15 phút
has_error: true AND @timestamp >= now-15m

# Specific error type
error: *ValueError*

# Errors của user
user_id: 123 AND has_error: true

# Errors trong endpoint
path: "/api/expenses" AND status_code >= 400
```

## Test Error Logging

Chạy script test:

```bash
cd backend
python scripts/test_error_logging.py
```

Output:
```
✅ GET /api/expenses - 200 - 45.67ms - User: 123
❌ POST /api/expenses - 500 - 123.45ms - User: 123
   ❌ Error: ValueError: Invalid amount
❌ Error in test function
   Error Type: ZeroDivisionError
   Error Message: division by zero
   Traceback:
   ...
```

## Các loại Errors được log

### 1. HTTP Errors
- 400 Bad Request
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found
- 500 Internal Server Error
- 502 Bad Gateway
- 503 Service Unavailable

### 2. Application Errors
- ValueError
- TypeError
- KeyError
- AttributeError
- DatabaseError
- ValidationError

### 3. Business Logic Errors
- InsufficientFundsError
- BudgetExceededError
- InvalidTransactionError
- etc.

## Debug Workflow

### Khi có lỗi:

#### Bước 1: Check Console
```bash
# Xem logs real-time
tail -f logs/app_*.log
```

Tìm error message và traceback.

#### Bước 2: Identify Error Type
```
❌ POST /api/expenses - 500 - 123.45ms - User: 123
   ❌ Error: ValueError: Invalid amount
```

- Error Type: ValueError
- Endpoint: POST /api/expenses
- User: 123
- Message: Invalid amount

#### Bước 3: Check Traceback
```
Traceback:
File "/app/api/expenses.py", line 45, in create_expense
  validate_amount(amount)
ValueError: Invalid amount
```

Biết chính xác file và line number gây lỗi.

#### Bước 4: Check Pattern in Kibana
```
error: *ValueError* AND path: "/api/expenses"
```

Xem có nhiều users gặp lỗi tương tự không.

#### Bước 5: Check User Activity
```
user_id: 123 AND @timestamp >= now-1h
```

Xem user đã làm gì trước khi gặp lỗi.

## Best Practices

### 1. Luôn check console logs trước
- Nhanh nhất
- Thấy ngay error message
- Có full traceback

### 2. Sử dụng grep để filter
```bash
# Chỉ xem errors
grep "ERROR" logs/app_*.log

# Errors của endpoint cụ thể
grep "/api/expenses" logs/app_*.log | grep "ERROR"

# Errors trong 1 giờ qua
grep "$(date +%Y-%m-%d\ %H)" logs/app_*.log | grep "ERROR"
```

### 3. Sử dụng Kibana cho analysis
- Xem trends
- Identify patterns
- Create alerts
- Generate reports

### 4. Setup alerts
- High error rate (> 10 errors/5min)
- Specific error types (DatabaseError)
- Critical endpoints (/api/payments)

## Improvements Made

### Code Changes

1. **Middleware** (`backend/app/middleware/logging.py`)
   - Capture error type
   - Capture full traceback
   - Log detailed error to console

2. **Logging Core** (`backend/app/core/logging.py`)
   - Always use human-readable format for console
   - Send structured JSON to Elasticsearch separately
   - Add emoji indicators (✅ ❌)
   - Better error formatting

3. **Test Script** (`backend/scripts/test_error_logging.py`)
   - Test various error scenarios
   - Verify logging output
   - Demonstrate best practices

### Documentation

1. **VIEW_LOGS_GUIDE.md** - Comprehensive guide
2. **IMPROVED_ERROR_LOGGING.md** - This document
3. **ELK_QUICK_REFERENCE.md** - Updated with log viewing

## Examples

### Example 1: Validation Error

**Console:**
```
❌ POST /api/expenses - 400 - 12.34ms - User: 123
   ❌ Error: ValidationError: Amount must be positive
```

**Kibana:**
```json
{
  "event_type": "http_request",
  "method": "POST",
  "path": "/api/expenses",
  "status_code": 400,
  "duration_ms": 12.34,
  "user_id": 123,
  "has_error": true,
  "error": "ValidationError: Amount must be positive"
}
```

### Example 2: Database Error

**Console:**
```
❌ Error in POST /api/expenses
   Error Type: DatabaseError
   Error Message: Connection timeout
   User ID: 123
   Traceback:
   File "/app/api/expenses.py", line 50
   File "/app/core/database.py", line 25
   DatabaseError: Connection timeout
```

**Kibana:**
```json
{
  "event_type": "http_request",
  "method": "POST",
  "path": "/api/expenses",
  "status_code": 500,
  "user_id": 123,
  "has_error": true,
  "error": "DatabaseError: Connection timeout"
}
```

### Example 3: Authentication Error

**Console:**
```
❌ GET /api/expenses - 401 - 5.67ms
   ❌ Error: AuthenticationError: Invalid token
```

**Kibana:**
```json
{
  "event_type": "http_request",
  "method": "GET",
  "path": "/api/expenses",
  "status_code": 401,
  "duration_ms": 5.67,
  "has_error": true,
  "error": "AuthenticationError: Invalid token"
}
```

## Summary

✅ **Console logs** - Dễ đọc, có màu sắc, emoji
✅ **Error details** - Type, message, traceback
✅ **Dual logging** - Console + Elasticsearch
✅ **Easy debugging** - Thấy ngay lỗi gì, ở đâu
✅ **Pattern analysis** - Kibana queries
✅ **Test script** - Verify logging works

Bây giờ anh có thể:
1. Thấy ngay lỗi trong console
2. Biết chính xác error type và message
3. Có full traceback để debug
4. Search và analyze trong Kibana
5. Setup alerts cho errors

🎉 Error logging đã được cải thiện đáng kể!
