"""
Script to test error logging
This will simulate various errors to verify logging works correctly
"""
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.logging import app_logger as logger, log_request


def test_console_logging():
    """Test console logging with different levels"""
    print("\n" + "="*60)
    print("📝 Testing Console Logging")
    print("="*60)
    
    logger.info("✅ This is an INFO message")
    logger.warning("⚠️ This is a WARNING message")
    logger.error("❌ This is an ERROR message")
    
    print("\n✅ Console logging test completed")


def test_request_logging():
    """Test HTTP request logging"""
    print("\n" + "="*60)
    print("📝 Testing HTTP Request Logging")
    print("="*60)
    
    # Successful request
    print("\n1. Successful Request:")
    log_request(
        method="GET",
        path="/api/expenses",
        status_code=200,
        duration_ms=45.67,
        user_id=123
    )
    
    # Failed request with error
    print("\n2. Failed Request with Error:")
    log_request(
        method="POST",
        path="/api/expenses",
        status_code=500,
        duration_ms=123.45,
        user_id=123,
        error="ValueError: Invalid amount"
    )
    
    # Failed request with detailed error
    print("\n3. Failed Request with Detailed Error:")
    log_request(
        method="POST",
        path="/api/expenses",
        status_code=500,
        duration_ms=234.56,
        user_id=123,
        error="DatabaseError: Connection timeout - Unable to connect to database after 3 retries"
    )
    
    # 404 error
    print("\n4. Not Found Error:")
    log_request(
        method="GET",
        path="/api/expenses/999999",
        status_code=404,
        duration_ms=12.34,
        user_id=123,
        error="NotFoundError: Expense not found"
    )
    
    # 401 error
    print("\n5. Authentication Error:")
    log_request(
        method="GET",
        path="/api/expenses",
        status_code=401,
        duration_ms=5.67,
        error="AuthenticationError: Invalid token"
    )
    
    print("\n✅ HTTP request logging test completed")


def test_error_with_traceback():
    """Test error logging with traceback"""
    print("\n" + "="*60)
    print("📝 Testing Error with Traceback")
    print("="*60)
    
    try:
        # Simulate an error
        def divide_by_zero():
            return 1 / 0
        
        divide_by_zero()
    except Exception as e:
        import traceback
        error_type = type(e).__name__
        error_msg = str(e)
        
        logger.error(
            f"❌ Error in test function\n"
            f"   Error Type: {error_type}\n"
            f"   Error Message: {error_msg}\n"
            f"   Traceback:\n{traceback.format_exc()}"
        )
    
    print("\n✅ Error with traceback test completed")


def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("🚀 Starting Error Logging Tests")
    print("="*60)
    
    test_console_logging()
    test_request_logging()
    test_error_with_traceback()
    
    print("\n" + "="*60)
    print("✅ All tests completed!")
    print("="*60)
    
    print("\n📋 How to view these logs:")
    print("\n1. Console Output:")
    print("   - You can see the logs above in this console")
    
    print("\n2. File Logs:")
    print("   - tail -f logs/app_*.log")
    print("   - grep 'ERROR' logs/app_*.log")
    
    print("\n3. Kibana:")
    print("   - Go to Discover")
    print("   - Query: has_error: true")
    print("   - Query: status_code >= 400")
    print("   - Query: error: *ValueError*")
    
    print("\n📚 For more details, see:")
    print("   - backend/docs/VIEW_LOGS_GUIDE.md")


if __name__ == "__main__":
    main()
