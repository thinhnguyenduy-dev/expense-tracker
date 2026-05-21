"""
Script to test ELK logging
Run this to verify ELK integration is working
"""
import sys
import time
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.logging import app_logger as logger, log_request, log_business_event
from app.utils.elk_logger import (
    log_transaction_created,
    log_budget_alert,
    log_ai_query,
    log_ocr_scan,
    log_user_login
)


def test_basic_logging():
    """Test basic logging"""
    print("\n📝 Testing basic logging...")
    
    logger.info("This is an INFO message")
    logger.warning("This is a WARNING message")
    logger.error("This is an ERROR message")
    
    print("✅ Basic logging test completed")


def test_http_request_logging():
    """Test HTTP request logging"""
    print("\n📝 Testing HTTP request logging...")
    
    log_request(
        method="GET",
        path="/api/expenses",
        status_code=200,
        duration_ms=45.67,
        user_id=123
    )
    
    log_request(
        method="POST",
        path="/api/expenses",
        status_code=201,
        duration_ms=123.45,
        user_id=123
    )
    
    log_request(
        method="GET",
        path="/api/dashboard",
        status_code=500,
        duration_ms=234.56,
        user_id=123,
        error="Database connection failed"
    )
    
    print("✅ HTTP request logging test completed")


def test_business_event_logging():
    """Test business event logging"""
    print("\n📝 Testing business event logging...")
    
    # Test transaction logging
    log_transaction_created(
        user_id=123,
        transaction_type="expense",
        amount=50000,
        currency="VND",
        category_id=5
    )
    
    log_transaction_created(
        user_id=123,
        transaction_type="income",
        amount=10000000,
        currency="VND"
    )
    
    # Test budget alert
    log_budget_alert(
        user_id=123,
        category_id=5,
        budget_limit=1000000,
        current_spending=850000,
        percentage=85,
        alert_level="warning"
    )
    
    log_budget_alert(
        user_id=123,
        category_id=6,
        budget_limit=500000,
        current_spending=520000,
        percentage=104,
        alert_level="critical"
    )
    
    # Test AI query
    log_ai_query(
        user_id=123,
        query="Phân tích chi tiêu tháng này",
        response_time_ms=1234.56,
        success=True
    )
    
    log_ai_query(
        user_id=123,
        query="Tạo báo cáo chi tiết",
        response_time_ms=567.89,
        success=False,
        error="API rate limit exceeded"
    )
    
    # Test OCR scan
    log_ocr_scan(
        user_id=123,
        success=True,
        processing_time_ms=456.78,
        extracted_amount=75000
    )
    
    log_ocr_scan(
        user_id=123,
        success=False,
        processing_time_ms=123.45,
        error="Image quality too low"
    )
    
    # Test user login
    log_user_login(
        user_id=123,
        email="test@example.com",
        ip_address="192.168.1.100"
    )
    
    print("✅ Business event logging test completed")


def test_custom_event():
    """Test custom event logging"""
    print("\n📝 Testing custom event logging...")
    
    log_business_event(
        event_type="custom_test_event",
        user_id=123,
        test_field="test_value",
        numeric_field=42,
        boolean_field=True
    )
    
    print("✅ Custom event logging test completed")


def main():
    """Run all tests"""
    print("🚀 Starting ELK logging tests...")
    print("=" * 60)
    
    test_basic_logging()
    time.sleep(1)
    
    test_http_request_logging()
    time.sleep(1)
    
    test_business_event_logging()
    time.sleep(1)
    
    test_custom_event()
    
    print("\n" + "=" * 60)
    print("✅ All tests completed!")
    print("\n📊 Check Kibana to view the logs:")
    print("   1. Go to Discover")
    print("   2. Select 'expense-tracker-logs-*' index pattern")
    print("   3. Set time range to 'Last 15 minutes'")
    print("   4. You should see all the test logs")


if __name__ == "__main__":
    main()
