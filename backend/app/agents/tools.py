import calendar
import json
from typing import Optional
from datetime import date, timedelta

from langchain_core.tools import tool
from langchain_community.tools.ddg_search import DuckDuckGoSearchRun
from langchain_community.utilities.duckduckgo_search import DuckDuckGoSearchAPIWrapper
from langgraph.types import interrupt
from sqlalchemy import func

from app.core.database import SessionLocal
from app.models.category import Category
from app.models.expense import Expense
from app.models.income import Income


def get_search_tool() -> DuckDuckGoSearchRun:
    """Shared DuckDuckGo search tool (reused by the analyst agent too).

    Biased toward RECENT, Vietnam-local results. Prices the analyst looks up (fuel,
    gold, market rates) change often — VN fuel is re-priced every ~10 days — but a
    default search happily returns months-old pages (which is how a gas-price lookup
    ended up citing an April figure). `time="m"` keeps hits within the last month and
    a higher `max_results` gives the model several dated snippets to pick the freshest.
    """
    wrapper = DuckDuckGoSearchAPIWrapper(region="vn-vi", time="m", max_results=6)
    return DuckDuckGoSearchRun(api_wrapper=wrapper)


def _parse_rate(answer: str) -> Optional[float]:
    """Extract an exchange rate (a number) from a free-text user answer.

    Handles plain numbers and common phrasings: "26318", "26,318", "26.318",
    "1 USD = 25000 VND". VND-style rates are integers in the thousands, so any
    ',' / '.' is treated as a grouping separator and stripped. The largest
    number in the answer is taken as the rate (avoids grabbing the '1' in
    "1 USD = 25000").
    """
    import re

    candidates = []
    for token in re.findall(r"\d[\d.,]*", str(answer)):
        digits = token.replace(",", "").replace(".", "")
        if digits.isdigit():
            candidates.append(float(digits))
    return max(candidates) if candidates else None


def _fmt_money(amount: float, currency: str) -> str:
    """Format an amount in the user's currency.

    VND (and other zero-decimal currencies) read better without cents;
    everything else keeps two decimals. Currency code is appended so the
    agent never invents a symbol like '$' for a VND user.
    """
    if currency in ("VND", "JPY", "KRW"):
        return f"{amount:,.0f} {currency}"
    return f"{amount:,.2f} {currency}"


def make_tools(user_id: int, user_currency: str = "VND"):
    """
    Factory validation to create tools bound to a specific user.
    """

    @tool
    def get_recent_expenses_tool(days: int = 7) -> str:
        """
        Get a summary of expenses from the last N days.
        Useful for checking if an expense was already added.
        """
        db = SessionLocal()
        try:
            start_date = date.today() - timedelta(days=days)
            expenses = db.query(Expense).filter(
                Expense.user_id == user_id,
                Expense.date >= start_date
            ).order_by(Expense.date.desc()).limit(10).all()
            
            if not expenses:
                return f"No expenses found in the last {days} days."
            
            summary = [f"- {e.date}: {e.description} ({_fmt_money(e.amount, user_currency)}) [{e.category.name if e.category else 'No Category'}]" for e in expenses]
            return "\n".join(summary)
        finally:
            db.close()

    @tool
    def get_recent_incomes_tool(days: int = 30) -> str:
        """
        Get a summary of incomes from the last N days (default 30).
        Useful when the user asks to list their incomes or earnings.
        """
        db = SessionLocal()
        try:
            start_date = date.today() - timedelta(days=days)
            incomes = db.query(Income).filter(
                Income.user_id == user_id,
                Income.date >= start_date
            ).order_by(Income.date.desc()).limit(20).all()
            
            if not incomes:
                return f"No incomes found in the last {days} days."
            
            summary = [f"- {i.date}: {i.source} (+{_fmt_money(i.amount, user_currency)})" for i in incomes]
            return "\n".join(summary)
        finally:
            db.close()

    @tool
    def submit_expense_tool(
        amount: float,
        currency: str = "VND",
        category: Optional[str] = None,
        merchant: Optional[str] = None,
        description: Optional[str] = None,
        date: Optional[str] = None
    ) -> str:
        """
        Call this tool when you have gathered all necessary information to create the expense draft.
        Pick the exact category name from the list provided in the system prompt.
        If the amount is in a foreign currency, just pass that currency and amount —
        the app pauses and asks the user for the exchange rate automatically; you do
        NOT need to ask for it yourself.
        This signals that the conversation is complete.
        """
        # ── Deterministic human-in-the-loop for foreign currency ──────────────
        # A foreign-currency expense can't be saved without a confirmed rate, and
        # that's a code-level rule — not a judgement call for the LLM. So we pause
        # HERE via interrupt() (re-asking until we get a parseable number) and do
        # the conversion ourselves, rather than relying on the model to remember.
        if currency and currency.upper() != user_currency.upper():
            from_ccy = currency.upper()
            prompt = (
                f"Tỷ giá {from_ccy} sang {user_currency} là bao nhiêu? "
                f"(1 {from_ccy} = ? {user_currency})"
            )
            rate = None
            while rate is None:
                answer = interrupt({
                    "question": prompt,
                    "type": "exchange_rate",
                    "from_currency": from_ccy,
                    "to_currency": user_currency,
                    "original_amount": amount,
                })
                rate = _parse_rate(answer)
                prompt = f"Mình chưa đọc được tỷ giá. Vui lòng nhập một con số, ví dụ 26318."
            original = f"{amount:g} {from_ccy} @ {rate:,.0f}"
            amount = amount * rate
            currency = user_currency
            description = f"{description} ({original})" if description else original

        db = SessionLocal()
        try:
            resolved_category = None
            category_id = None
            if category:
                cat = db.query(Category).filter(
                    Category.user_id == user_id,
                    Category.name.ilike(f"%{category}%")
                ).first()
                if cat:
                    category_id = cat.id
                    resolved_category = cat.name
                else:
                    # Category not found — return error so AI re-evaluates
                    available = db.query(Category).filter(Category.user_id == user_id).all()
                    names = ", ".join(c.name for c in available) or "none"
                    return json.dumps({
                        "status": "error",
                        "message": f"Category '{category}' not found. Available categories: {names}. Please use an exact name from the list.",
                    }, ensure_ascii=False)
            return json.dumps({
                "status": "draft_created",
                "category_id": category_id,
                "category": resolved_category,
                # Echo back the (possibly converted) values so ai.py / the frontend
                # persist the base-currency amount, not the original foreign one.
                "amount": amount,
                "currency": currency,
                "description": description,
            }, ensure_ascii=False)
        finally:
            db.close()

    @tool
    def ask_clarification_tool(question: str) -> str:
        """
        Ask the user ONE clarifying question when a SINGLE expense is genuinely
        ambiguous and you cannot proceed. Use this when:
        - The category is unclear AND no option in the list is a reasonable match
        - The amount or date is missing or ambiguous
        Do NOT use this for foreign currency / exchange rates — submit_expense_tool
        handles that automatically.
        Ask the question in the user's language. This PAUSES the conversation and
        returns the user's answer as a string — continue once you have it.
        Do NOT call this just because the user listed several expenses: if each one
        is clear, call submit_expense_tool for EACH of them instead.
        Do NOT call submit_expense_tool for an expense until it is unambiguous.
        """
        # Human-in-the-loop: interrupt() checkpoints the graph here and returns
        # control to the caller. On resume via Command(resume=<answer>) this call
        # returns the user's answer and the tool continues.
        answer = interrupt({"question": question})
        return answer

    @tool
    def submit_income_tool(
        amount: float,
        source: str,
        date: Optional[str] = None
    ) -> str:
        """
        Call this tool when you have gathered all necessary information to create an income draft.
        This signals that the conversation is complete.
        """
        return json.dumps({"status": "draft_created"}, ensure_ascii=False)

    @tool
    def get_monthly_summary_tool(month: Optional[int] = None, year: Optional[int] = None) -> str:
        """
        Get the total spending for a specific month and a breakdown by category.
        If no month or year is provided, it defaults to the current month.
        Use this when the user asks for "total expenses", "spending this month", "last month", or "monthly summary".
        """
        db = SessionLocal()
        try:
            today = date.today()
            
            target_year = year if year else today.year
            target_month = month if month else today.month
            
            # Start and End Dates formulation
            first_day = date(target_year, target_month, 1)
            last_day = date(target_year, target_month, calendar.monthrange(target_year, target_month)[1])
            
            # Total spending
            total_spent = db.query(func.coalesce(func.sum(Expense.amount), 0)).filter(
                Expense.user_id == user_id,
                Expense.date >= first_day,
                Expense.date <= last_day
            ).scalar()
            
            # Category breakdown
            cat_stats = db.query(
                Category.name,
                func.sum(Expense.amount).label('total')
            ).join(Expense).filter(
                Expense.user_id == user_id,
                Expense.date >= first_day,
                Expense.date <= last_day
            ).group_by(Category.name).all()
            
            breakdown = "\n".join([f"- {name}: {_fmt_money(total, user_currency)}" for name, total in cat_stats]) if cat_stats else "- No expenses recorded."

            return (
                f"📊 **Monthly Summary ({first_day.strftime('%B %Y')})**\n"
                f"**Total Spent:** {_fmt_money(total_spent, user_currency)}\n\n"
                f"**Breakdown by Category:**\n{breakdown}"
            )
        finally:
            db.close()

    @tool
    def get_monthly_income_summary_tool(month: Optional[int] = None, year: Optional[int] = None) -> str:
        """
        Get the total income for a specific month and a breakdown by source.
        If no month or year is provided, it defaults to the current month.
        Use this when the user asks for "total income", "income this month", "last month", or "monthly income".
        """
        db = SessionLocal()
        try:
            today = date.today()

            target_year = year if year else today.year
            target_month = month if month else today.month

            first_day = date(target_year, target_month, 1)
            last_day = date(target_year, target_month, calendar.monthrange(target_year, target_month)[1])

            total_income = db.query(func.coalesce(func.sum(Income.amount), 0)).filter(
                Income.user_id == user_id,
                Income.date >= first_day,
                Income.date <= last_day
            ).scalar()

            src_stats = db.query(
                Income.source,
                func.sum(Income.amount).label('total')
            ).filter(
                Income.user_id == user_id,
                Income.date >= first_day,
                Income.date <= last_day
            ).group_by(Income.source).all()

            breakdown = "\n".join([f"- {src}: {_fmt_money(total, user_currency)}" for src, total in src_stats]) if src_stats else "- No income recorded."

            return (
                f"📈 **Monthly Income ({first_day.strftime('%B %Y')})**\n"
                f"**Total Income:** {_fmt_money(total_income, user_currency)}\n\n"
                f"**Breakdown by Source:**\n{breakdown}"
            )
        finally:
            db.close()

    # NOTE: No web-search tool here on purpose. Currency conversion is handled
    # deterministically by ExchangeRateService at persistence time
    # (see app/core/exchange_rate.py). General web research is added separately
    # in `build_agent`, alongside these transactional tools.
    return [get_recent_expenses_tool, get_recent_incomes_tool, ask_clarification_tool, submit_expense_tool, submit_income_tool, get_monthly_summary_tool, get_monthly_income_summary_tool]
