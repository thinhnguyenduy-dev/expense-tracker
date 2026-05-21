# ELK Stack - Quick Start Guide

## Bước 1: Cấu hình Environment

Thêm vào file `backend/.env`:

```bash
# ELK Stack Configuration
ELASTICSEARCH_URL=https://your-elasticsearch-url.com
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=your_password_here
KIBANA_URL=https://your-kibana-url.com
ELK_ENABLED=true
```

## Bước 2: Cài đặt Dependencies

```bash
cd backend
pip install -r requirements.txt
```

## Bước 3: Setup Elasticsearch

Chạy script setup để tạo index templates:

```bash
python scripts/setup_elk.py
```

Output mong đợi:
```
🔗 Connecting to Elasticsearch: https://your-elasticsearch-url.com
✅ Connected to Elasticsearch
📊 Cluster: your-cluster-name
📊 Version: 8.12.0

📝 Creating ILM policy...
✅ ILM policy created successfully

📝 Creating index template...
✅ Index template created successfully

✅ ELK setup completed!
```

## Bước 4: Test Logging

Chạy script test để verify:

```bash
python scripts/test_elk_logging.py
```

## Bước 5: Setup Kibana

### 5.1. Tạo Index Pattern

1. Truy cập: https://your-kibana-url.com
2. Login với credentials
3. Vào **☰ Menu** > **Stack Management** > **Index Patterns**
4. Click **Create index pattern**
5. Nhập: `expense-tracker-logs-*`
6. Click **Next step**
7. Chọn **@timestamp** làm Time field
8. Click **Create index pattern**

### 5.2. Xem Logs

1. Vào **☰ Menu** > **Discover**
2. Chọn index pattern: `expense-tracker-logs-*`
3. Chọn time range: **Last 15 minutes**
4. Bạn sẽ thấy logs từ test script

## Bước 6: Khởi động Application

```bash
cd backend
uvicorn main:app --reload
```

Logs sẽ tự động được gửi đến Elasticsearch!

## Bước 7: Tạo Dashboard (Optional)

### 7.1. Tạo Visualizations

#### HTTP Requests Over Time
1. Vào **Visualize Library** > **Create visualization**
2. Chọn **Line**
3. Select index: `expense-tracker-logs-*`
4. Metrics:
   - Y-axis: Count
5. Buckets:
   - X-axis: Date Histogram on @timestamp
   - Split series: Terms on `path.keyword` (Top 10)
6. Save: "HTTP Requests Over Time"

#### Response Time
1. Create visualization > **Line**
2. Metrics:
   - Y-axis: Average of `duration_ms`
3. Buckets:
   - X-axis: Date Histogram on @timestamp
4. Save: "Average Response Time"

#### Status Code Distribution
1. Create visualization > **Pie**
2. Metrics:
   - Slice size: Count
3. Buckets:
   - Split slices: Terms on `status_code`
4. Save: "Status Code Distribution"

#### Transaction Volume
1. Create visualization > **Metric**
2. Filter: `event_type: "transaction_created"`
3. Metrics:
   - Metric: Count
4. Save: "Total Transactions"

### 7.2. Tạo Dashboard

1. Vào **Dashboard** > **Create dashboard**
2. Click **Add from library**
3. Thêm các visualizations đã tạo:
   - HTTP Requests Over Time
   - Average Response Time
   - Status Code Distribution
   - Transaction Volume
4. Arrange layout
5. Save dashboard: "Expense Tracker Overview"

## Useful Kibana Queries

### Tìm errors
```
status_code >= 400
```

### Tìm slow requests
```
duration_ms > 1000
```

### Xem transactions của user cụ thể
```
event_type: "transaction_created" AND user_id: 123
```

### Xem budget alerts
```
event_type: "budget_alert"
```

### Xem AI queries
```
event_type: "ai_query"
```

### Xem failed operations
```
error: * OR success: false
```

## Troubleshooting

### Không thấy logs trong Kibana?

1. Check ELK_ENABLED=true trong .env
2. Restart application
3. Check logs/app_*.log để xem errors
4. Verify Elasticsearch connection:
   ```bash
   curl -u elastic:password https://your-elasticsearch-url.com
   ```

### Connection timeout?

1. Check firewall/network
2. Verify Elasticsearch URL
3. Check credentials

### Logs không có structure?

1. Verify ELK_ENABLED=true
2. Check index template đã được tạo:
   ```bash
   python scripts/setup_elk.py
   ```

## Next Steps

- Tạo alerts cho errors và slow requests
- Setup retention policy phù hợp
- Tạo custom dashboards cho business metrics
- Integrate với monitoring tools (Grafana, etc.)

## Tài liệu chi tiết

Xem [ELK_SETUP.md](./ELK_SETUP.md) để biết thêm chi tiết về:
- Cấu trúc logs
- Advanced queries
- Monitoring & alerts
- Best practices
