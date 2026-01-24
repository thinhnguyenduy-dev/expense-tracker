"""Email notification service for budget alerts and other notifications."""
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from loguru import logger

from .config import settings


async def send_email_async(
    to_email: str,
    subject: str,
    html_content: str,
    plain_content: Optional[str] = None
) -> bool:
    """
    Send an email asynchronously.
    Returns True if successful, False otherwise.
    """
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        logger.warning("SMTP not configured. Email not sent.")
        return False
    
    try:
        import aiosmtplib
        
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = settings.SMTP_FROM_EMAIL
        message["To"] = to_email
        
        # Add plain text version
        if plain_content:
            message.attach(MIMEText(plain_content, "plain"))
        
        # Add HTML version
        message.attach(MIMEText(html_content, "html"))
        
        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
        )
        logger.info(f"Email sent to {to_email}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False


def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    plain_content: Optional[str] = None
) -> bool:
    """
    Synchronous wrapper for send_email_async.
    Runs the email sending in a background task.
    """
    try:
        loop = asyncio.get_running_loop()
        # Schedule as a background task
        loop.create_task(
            send_email_async(to_email, subject, html_content, plain_content)
        )
        return True
    except RuntimeError:
        # No running event loop, run synchronously
        return asyncio.run(
            send_email_async(to_email, subject, html_content, plain_content)
        )


def send_budget_warning_email(
    user_email: str,
    user_name: str,
    category_name: str,
    budget_amount: float,
    spent_amount: float,
    percentage: int
) -> bool:
    """Send budget warning email (80% threshold)."""
    subject = f"⚠️ Budget Warning: {category_name} is at {percentage}%"
    
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f97316, #ea580c); padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">⚠️ Budget Warning</h1>
        </div>
        <div style="padding: 20px; background: #1e293b; color: #e2e8f0; border-radius: 0 0 8px 8px;">
            <p>Hi {user_name},</p>
            <p>Your <strong>{category_name}</strong> budget is reaching its limit:</p>
            <div style="background: #334155; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <p style="margin: 5px 0;"><strong>Budget:</strong> {budget_amount:,.0f} VND</p>
                <p style="margin: 5px 0;"><strong>Spent:</strong> {spent_amount:,.0f} VND</p>
                <p style="margin: 5px 0;"><strong>Usage:</strong> {percentage}%</p>
            </div>
            <p>Consider reviewing your spending to stay within budget.</p>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 30px;">
                This is an automated message from Expense Tracker.
            </p>
        </div>
    </body>
    </html>
    """
    
    plain_content = f"""
    Budget Warning: {category_name} is at {percentage}%
    
    Hi {user_name},
    
    Your {category_name} budget is reaching its limit:
    - Budget: {budget_amount:,.0f} VND
    - Spent: {spent_amount:,.0f} VND
    - Usage: {percentage}%
    
    Consider reviewing your spending to stay within budget.
    """
    
    return send_email(user_email, subject, html_content, plain_content)


def send_budget_exceeded_email(
    user_email: str,
    user_name: str,
    category_name: str,
    budget_amount: float,
    spent_amount: float,
    percentage: int
) -> bool:
    """Send budget exceeded email (100% threshold)."""
    subject = f"🚨 Budget Exceeded: {category_name} is at {percentage}%"
    
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">🚨 Budget Exceeded</h1>
        </div>
        <div style="padding: 20px; background: #1e293b; color: #e2e8f0; border-radius: 0 0 8px 8px;">
            <p>Hi {user_name},</p>
            <p>Your <strong>{category_name}</strong> budget has been exceeded:</p>
            <div style="background: #334155; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <p style="margin: 5px 0;"><strong>Budget:</strong> {budget_amount:,.0f} VND</p>
                <p style="margin: 5px 0;"><strong>Spent:</strong> {spent_amount:,.0f} VND</p>
                <p style="margin: 5px 0;"><strong>Over budget by:</strong> {spent_amount - budget_amount:,.0f} VND</p>
            </div>
            <p style="color: #f87171;">You are now spending beyond your set limit.</p>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 30px;">
                This is an automated message from Expense Tracker.
            </p>
        </div>
    </body>
    </html>
    """
    
    plain_content = f"""
    Budget Exceeded: {category_name} is at {percentage}%
    
    Hi {user_name},
    
    Your {category_name} budget has been exceeded:
    - Budget: {budget_amount:,.0f} VND
    - Spent: {spent_amount:,.0f} VND
    - Over budget by: {spent_amount - budget_amount:,.0f} VND
    
    You are now spending beyond your set limit.
    """
    
    return send_email(user_email, subject, html_content, plain_content)
