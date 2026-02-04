from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta
from typing import Optional

from ..core.database import get_db
from ..core.deps import get_current_user
from ..models.user import User
from ..models.expense import Expense
from ..models.category import Category
from ..schemas.reports import ReportResponse, DailyExpense, CategoryReport
from ..models.income import Income
from sqlalchemy import literal_column, union_all
from fastapi.responses import StreamingResponse
import csv
import io

router = APIRouter()

@router.get("/", response_model=ReportResponse)
def get_reports(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    scope: str = "personal",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get aggregated report data for a specific date range."""
    # Default to last 30 days if no dates provided
    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = end_date - timedelta(days=29)
    
    # Determine user filter based on scope
    if scope == "family" and current_user.family_id:
        members = db.query(User).filter(User.family_id == current_user.family_id).all()
        user_ids = [m.id for m in members]
    else:
        user_ids = [current_user.id]
        
    # --- 1. Daily Expenses Trend ---
    daily_query = db.query(
        Expense.date,
        func.sum(Expense.amount).label('total')
    ).filter(
        Expense.user_id.in_(user_ids),
        Expense.date >= start_date,
        Expense.date <= end_date
    ).group_by(
        Expense.date
    ).order_by(
        Expense.date
    ).all()
    
    # Fill in missing dates with 0
    daily_expenses = []
    current = start_date
    daily_map = {d.date: d.total for d in daily_query}
    
    while current <= end_date:
        amount = daily_map.get(current, 0)
        daily_expenses.append({
            "date": current,
            "amount": amount
        })
        current += timedelta(days=1)
        
    # --- 2. Category Breakdown ---
    category_query = db.query(
        Category.id,
        Category.name,
        Category.color,
        func.sum(Expense.amount).label('total')
    ).join(
        Expense, Expense.category_id == Category.id
    ).filter(
        Expense.user_id.in_(user_ids),
        Expense.date >= start_date,
        Expense.date <= end_date
    ).group_by(
        Category.id, Category.name, Category.color
    ).all()
    
    total_period = sum(item.total for item in category_query)
    
    category_breakdown = []
    for item in category_query:
        percentage = (float(item.total) / float(total_period) * 100) if total_period > 0 else 0
        category_breakdown.append({
            "category_id": item.id,
            "category_name": item.name,
            "category_color": item.color,
            "amount": item.total,
            "percentage": round(percentage, 2)
        })
        

    # --- 3. Income vs Expense (Monthly) ---
    # Group by month string YYYY-MM
    expenses_monthly = db.query(
        func.to_char(Expense.date, 'YYYY-MM').label('month'),
        func.sum(Expense.amount).label('total')
    ).filter(
        Expense.user_id.in_(user_ids),
        Expense.date >= start_date,
        Expense.date <= end_date
    ).group_by(
        literal_column('month')
    ).all()

    incomes_monthly = db.query(
        func.to_char(Income.date, 'YYYY-MM').label('month'),
        func.sum(Income.amount).label('total')
    ).filter(
        Income.user_id.in_(user_ids),
        Income.date >= start_date,
        Income.date <= end_date
    ).group_by(
        literal_column('month')
    ).all()

    monthly_data = {}
    
    # Process expenses
    for e in expenses_monthly:
        month_key = e.month
        monthly_data.setdefault(month_key, {"income": 0, "expense": 0})
        monthly_data[month_key]["expense"] = e.total

    # Process incomes
    for i in incomes_monthly:
        month_key = i.month
        monthly_data.setdefault(month_key, {"income": 0, "expense": 0})
        monthly_data[month_key]["income"] = i.total

    income_vs_expense = [
        {"month": k, "income": v["income"], "expense": v["expense"]}
        for k, v in sorted(monthly_data.items())
    ]

    # --- 4. Savings Stats ---
    total_income_period = sum(i.total for i in incomes_monthly) if incomes_monthly else 0
    total_expense_period = sum(e.total for e in expenses_monthly) if expenses_monthly else 0
    
    # If category query differs slightly due to joins, we trust the expense query here for total logic
    # Or rely on category sum for expenses as before? They should be identical.
    # Let's use the explicit queries we just ran.
    
    net_savings = total_income_period - total_expense_period
    current_savings_rate = (float(net_savings) / float(total_income_period) * 100) if total_income_period > 0 else 0
    
    savings_stats = {
        "current_savings_rate": round(current_savings_rate, 2),
        "total_income": total_income_period,
        "total_expense": total_expense_period,
        "net_savings": net_savings
    }

    return {
        "daily_expenses": daily_expenses,
        "category_breakdown": category_breakdown,
        "income_vs_expense": income_vs_expense,
        "savings_stats": savings_stats,
        "total_period": total_period,
        "period_start": start_date,
        "period_end": end_date
    }


@router.get("/export")
def export_report_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Export all expenses and incomes as CSV."""
    
    # Select Expenses: date, description/source, category/type, amount, type
    # We negate amount for expenses to indicate outflow? 
    # Frontend logic was: Expense amounts are negative.
    
    expenses_query = db.query(
        Expense.date,
        Expense.description.label("description"),
        Category.name.label("category"),
        (-Expense.amount).label("amount"),
        literal_column("'Expense'").label("type")
    ).outerjoin(Category, Expense.category_id == Category.id).filter(
        Expense.user_id == current_user.id
    )
    
    incomes_query = db.query(
        Income.date,
        literal_column("''").label("description"), # Incomes don't have description in the same way, or source is category? 
        # Wait, Income has 'source'. Frontend used 'source' as category/source column.
        # Frontend: ['Income', i.date, i.amount, i.source, ''] (headers: Type, Date, Amount, Category/Source, Description)
        # So: Type=Income, Date=date, Amount=amount, Category/Source=source, Description=''
        
        Income.source.label("category"), # Map source to category column
        Income.amount.label("amount"),
        literal_column("'Income'").label("type")
    ).filter(
        Income.user_id == current_user.id
    )
    
    # We need to render: Type, Date, Amount, Category/Source, Description
    # Expense map:
    # Type -> 'Expense'
    # Date -> date
    # Amount -> -amount
    # Category/Source -> category.name
    # Description -> description
    
    # Income map:
    # Type -> 'Income'
    # Date -> date
    # Amount -> amount
    # Category/Source -> source
    # Description -> '' (empty string)
    
    # Re-align queries to match the column order for Union or just select same columns
    
    q1 = db.query(
        literal_column("'Expense'").label("row_type"),
        Expense.date,
        (-Expense.amount).label("amount"),
        func.coalesce(Category.name, "Uncategorized").label("category_source"),
        func.coalesce(Expense.description, "").label("description")
    ).outerjoin(Category, Expense.category_id == Category.id).filter(
        Expense.user_id == current_user.id
    )
    
    q2 = db.query(
        literal_column("'Income'").label("row_type"),
        Income.date,
        Income.amount,
        Income.source.label("category_source"),
        literal_column("''").label("description")
    ).filter(
        Income.user_id == current_user.id
    )
    
    union_query = union_all(q1, q2).order_by(literal_column("date").desc())
    
    def iter_csv():
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow(["Type", "Date", "Amount", "Category/Source", "Description"])
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)
        
        # Write data
        # union_all returns a compound select, we can execute it
        result = db.execute(union_query)
        
        for row in result:
            writer.writerow([
                row.row_type,
                row.date,
                row.amount,
                row.category_source,
                row.description
            ])
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

    filename = f"expense_tracker_data_{date.today()}.csv"
    return StreamingResponse(
        iter_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
