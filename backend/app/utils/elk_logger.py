"""
Helper functions for logging business events to ELK
"""
from typing import Optional, Dict, Any
from app.core.logging import log_business_event


def log_transaction_created(
    user_id: int,
    transaction_type: str,
    amount: float,
    currency: str,
    category_id: Optional[int] = None
):
    """Log when a transaction is created"""
    log_business_event(
        event_type="transaction_created",
        user_id=user_id,
        transaction_type=transaction_type,
        amount=amount,
        currency=currency,
        category_id=category_id
    )


def log_budget_alert(
    user_id: int,
    category_id: int,
    budget_limit: float,
    current_spending: float,
    percentage: float,
    alert_level: str
):
    """Log budget alerts"""
    log_business_event(
        event_type="budget_alert",
        user_id=user_id,
        category_id=category_id,
        budget_limit=budget_limit,
        current_spending=current_spending,
        percentage=percentage,
        alert_level=alert_level
    )


def log_goal_progress(
    user_id: int,
    goal_id: int,
    target_amount: float,
    current_amount: float,
    percentage: float
):
    """Log goal progress updates"""
    log_business_event(
        event_type="goal_progress",
        user_id=user_id,
        goal_id=goal_id,
        target_amount=target_amount,
        current_amount=current_amount,
        percentage=percentage
    )


def log_recurring_expense_processed(
    user_id: int,
    recurring_expense_id: int,
    amount: float,
    description: str
):
    """Log when recurring expense is automatically processed"""
    log_business_event(
        event_type="recurring_expense_processed",
        user_id=user_id,
        recurring_expense_id=recurring_expense_id,
        amount=amount,
        description=description
    )


def log_user_login(user_id: int, email: str, ip_address: Optional[str] = None):
    """Log user login events"""
    log_business_event(
        event_type="user_login",
        user_id=user_id,
        email=email,
        ip_address=ip_address
    )


def log_user_registration(user_id: int, email: str):
    """Log new user registrations"""
    log_business_event(
        event_type="user_registration",
        user_id=user_id,
        email=email
    )


def log_ai_query(
    user_id: int,
    query: str,
    response_time_ms: float,
    success: bool,
    error: Optional[str] = None
):
    """Log AI assistant queries"""
    log_business_event(
        event_type="ai_query",
        user_id=user_id,
        query=query[:200],  # Truncate long queries
        response_time_ms=response_time_ms,
        success=success,
        error=error
    )


def log_ocr_scan(
    user_id: int,
    success: bool,
    processing_time_ms: float,
    extracted_amount: Optional[float] = None,
    error: Optional[str] = None
):
    """Log OCR receipt scanning"""
    log_business_event(
        event_type="ocr_scan",
        user_id=user_id,
        success=success,
        processing_time_ms=processing_time_ms,
        extracted_amount=extracted_amount,
        error=error
    )
