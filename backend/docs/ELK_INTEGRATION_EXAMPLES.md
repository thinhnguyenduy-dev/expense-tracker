# ELK Integration Examples

Các ví dụ về cách tích hợp ELK logging vào API endpoints.

## 1. Log Transaction Creation

### File: `backend/app/api/expenses.py`

```python
from app.utils.elk_logger import log_transaction_created

@router.post("/", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
def create_expense(
    expense: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # ... existing code to create expense ...
    
    # Log to ELK
    log_transaction_created(
        user_id=current_user.id,
        transaction_type="expense",
        amount=float(db_expense.amount),
        currency=db_expense.currency,
        category_id=db_expense.category_id
    )
    
    return db_expense
```

## 2. Log Budget Alerts

### File: `backend/app/api/expenses.py`

```python
from app.utils.elk_logger import log_budget_alert

def check_budget_alert(db: Session, user: User, category_id: int, current_spending: Decimal):
    """Check if budget alert should be triggered"""
    category = db.query(Category).filter(
        Category.id == category_id,
        Category.user_id == user.id
    ).first()
    
    if not category or not category.monthly_limit:
        return
    
    percentage = (float(current_spending) / float(category.monthly_limit)) * 100
    
    # Log to ELK
    if percentage >= 80:
        alert_level = "critical" if percentage >= 100 else "warning"
        
        log_budget_alert(
            user_id=user.id,
            category_id=category_id,
            budget_limit=float(category.monthly_limit),
            current_spending=float(current_spending),
            percentage=percentage,
            alert_level=alert_level
        )
    
    # ... existing email notification code ...
```

## 3. Log AI Queries

### File: `backend/app/api/ai.py`

```python
import time
from app.utils.elk_logger import log_ai_query

@router.post("/chat")
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    start_time = time.time()
    error = None
    success = False
    
    try:
        # ... existing AI processing code ...
        
        success = True
        return response
        
    except Exception as e:
        error = str(e)
        raise
        
    finally:
        # Log to ELK
        duration_ms = (time.time() - start_time) * 1000
        log_ai_query(
            user_id=current_user.id,
            query=request.message,
            response_time_ms=duration_ms,
            success=success,
            error=error
        )
```

## 4. Log OCR Scans

### File: `backend/app/api/ocr.py`

```python
import time
from app.utils.elk_logger import log_ocr_scan

@router.post("/scan")
async def scan_receipt(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    start_time = time.time()
    error = None
    success = False
    extracted_amount = None
    
    try:
        # ... existing OCR processing code ...
        
        extracted_amount = result.get("amount")
        success = True
        return result
        
    except Exception as e:
        error = str(e)
        raise
        
    finally:
        # Log to ELK
        duration_ms = (time.time() - start_time) * 1000
        log_ocr_scan(
            user_id=current_user.id,
            success=success,
            processing_time_ms=duration_ms,
            extracted_amount=extracted_amount,
            error=error
        )
```

## 5. Log User Authentication

### File: `backend/app/api/auth.py`

```python
from app.utils.elk_logger import log_user_login, log_user_registration

@router.post("/login")
def login(
    credentials: LoginRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    # ... existing login code ...
    
    # Log successful login
    log_user_login(
        user_id=user.id,
        email=user.email,
        ip_address=request.client.host if request.client else None
    )
    
    return {"access_token": token, "token_type": "bearer"}


@router.post("/register")
def register(
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    # ... existing registration code ...
    
    # Log new user registration
    log_user_registration(
        user_id=new_user.id,
        email=new_user.email
    )
    
    return new_user
```

## 6. Log Goal Progress

### File: `backend/app/api/goals.py`

```python
from app.utils.elk_logger import log_goal_progress

@router.post("/{goal_id}/contribute")
def contribute_to_goal(
    goal_id: int,
    amount: Decimal,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # ... existing code to add contribution ...
    
    # Calculate progress
    percentage = (float(goal.current_amount) / float(goal.target_amount)) * 100
    
    # Log to ELK
    log_goal_progress(
        user_id=current_user.id,
        goal_id=goal_id,
        target_amount=float(goal.target_amount),
        current_amount=float(goal.current_amount),
        percentage=percentage
    )
    
    return goal
```

## 7. Log Recurring Expense Processing

### File: `backend/app/core/recurring_expense_service.py`

```python
from app.utils.elk_logger import log_recurring_expense_processed

class RecurringExpenseService:
    def process_recurring_expense(self, recurring_expense):
        # ... existing code to create expense ...
        
        # Log to ELK
        log_recurring_expense_processed(
            user_id=recurring_expense.user_id,
            recurring_expense_id=recurring_expense.id,
            amount=float(recurring_expense.amount),
            description=recurring_expense.description
        )
        
        return expense
```

## 8. Log Custom Business Events

### Example: Log Family Invitation

```python
from app.core.logging import log_business_event

@router.post("/families/{family_id}/invite")
def invite_member(
    family_id: int,
    email: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # ... existing invitation code ...
    
    # Log custom event
    log_business_event(
        event_type="family_invitation_sent",
        user_id=current_user.id,
        family_id=family_id,
        invited_email=email
    )
    
    return {"message": "Invitation sent"}
```

## 9. Log Data Export

```python
from app.core.logging import log_business_event

@router.get("/export")
def export_data(
    format: str = "csv",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # ... existing export code ...
    
    # Log export event
    log_business_event(
        event_type="data_exported",
        user_id=current_user.id,
        export_format=format,
        record_count=len(data)
    )
    
    return response
```

## 10. Log Critical Operations

```python
from app.core.logging import app_logger as logger, log_business_event

@router.delete("/users/me")
def delete_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Log critical operation
    logger.warning(f"User account deletion requested: {current_user.email}")
    
    log_business_event(
        event_type="account_deleted",
        user_id=current_user.id,
        email=current_user.email
    )
    
    # ... existing deletion code ...
    
    return {"message": "Account deleted"}
```

## Best Practices

### 1. Always use try-finally for timing

```python
import time

start_time = time.time()
try:
    # ... operation ...
    success = True
except Exception as e:
    error = str(e)
    success = False
    raise
finally:
    duration_ms = (time.time() - start_time) * 1000
    log_event(duration_ms=duration_ms, success=success, error=error)
```

### 2. Don't log sensitive data

```python
# ❌ BAD - logs password
log_business_event(
    event_type="login_attempt",
    email=email,
    password=password  # NEVER DO THIS
)

# ✅ GOOD - only logs non-sensitive data
log_business_event(
    event_type="login_attempt",
    email=email,
    success=True
)
```

### 3. Use appropriate log levels

```python
from app.core.logging import app_logger as logger

# INFO - normal operations
logger.info("User created expense")

# WARNING - potential issues
logger.warning("Budget threshold exceeded")

# ERROR - actual errors
logger.error(f"Failed to process payment: {error}")
```

### 4. Add context to logs

```python
# ❌ BAD - not enough context
log_business_event(event_type="error")

# ✅ GOOD - includes context
log_business_event(
    event_type="payment_failed",
    user_id=user.id,
    amount=amount,
    currency=currency,
    error_code=error.code,
    error_message=str(error)
)
```

### 5. Truncate long strings

```python
# Truncate long queries/messages
log_ai_query(
    user_id=user.id,
    query=query[:200],  # Limit to 200 chars
    response_time_ms=duration
)
```

## Testing Your Logs

After adding logging, test it:

```bash
# 1. Make API request
curl -X POST http://localhost:8000/api/expenses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 50000, "description": "Test"}'

# 2. Check Kibana
# Go to Discover and search:
event_type: "transaction_created" AND user_id: YOUR_USER_ID
```

## Monitoring Queries

### Find slow operations
```
duration_ms > 1000 OR response_time_ms > 1000 OR processing_time_ms > 1000
```

### Find failed operations
```
success: false OR error: *
```

### Monitor specific user
```
user_id: 123
```

### Track feature usage
```
event_type: "ai_query" OR event_type: "ocr_scan"
```
