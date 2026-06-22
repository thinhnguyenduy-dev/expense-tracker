import re
from typing import Optional

from langchain_community.utilities import SQLDatabase
from langchain_community.agent_toolkits.sql.toolkit import SQLDatabaseToolkit
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent
from loguru import logger
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.agents.prompts import ANALYST_SYSTEM_PROMPT
from app.agents.tools import get_search_tool
from app.core.llm import get_llm
from app.core.database import engine, analyst_engine

# Tables that carry a `user_id` and must never be queried across users.
USER_SCOPED_TABLES = ("expenses", "incomes", "categories", "jars", "recurring_expenses")

# Statement-level keywords that must never appear in an analyst query. The analyst
# is strictly read-only; anything that writes, alters, grants, or controls a
# transaction is rejected before it ever reaches the database — even when the
# RLS-constrained read-only role is unavailable (owner-engine fallback).
_FORBIDDEN_SQL_KEYWORDS = (
    "insert", "update", "delete", "drop", "truncate", "alter", "create",
    "grant", "revoke", "replace", "merge", "call", "copy", "vacuum",
    "reindex", "comment", "lock", "set", "commit", "rollback", "begin",
    "savepoint", "attach", "pragma",
)


def _strip_sql_noise(query: str) -> str:
    """Remove comments and single-quoted string literals from a query.

    Done before keyword scanning so a literal value like `'drop shipping'` or a
    `-- drop everything` comment can't trip (or evade) the read-only guard.
    """
    q = re.sub(r"/\*.*?\*/", " ", query, flags=re.DOTALL)  # /* block comments */
    q = re.sub(r"--[^\n]*", " ", q)                          # -- line comments
    q = re.sub(r"'(?:''|[^'])*'", " ", q)                    # 'string literals'
    return q


def _reject_if_not_read_only(query: str) -> Optional[str]:
    """Return an error string if `query` is anything other than a single SELECT.

    Returns None when the query is a safe, single read-only statement.
    """
    cleaned = _strip_sql_noise(query).strip().rstrip(";").strip()
    if not cleaned:
        return "ERROR: Empty query."
    # Single statement only — no stacked `SELECT ...; DROP ...`.
    if ";" in cleaned:
        return "ERROR: Query rejected — only a single SELECT statement is allowed (no `;`-separated statements)."
    # Must be a read query.
    if not re.match(r"(?is)^\s*(select|with)\b", cleaned):
        return "ERROR: Query rejected — only read-only SELECT queries are allowed."
    # No write / DDL / transaction-control keywords anywhere (e.g. inside a CTE).
    lowered = cleaned.lower()
    for kw in _FORBIDDEN_SQL_KEYWORDS:
        if re.search(rf"\b{kw}\b", lowered):
            return (
                f"ERROR: Query rejected — the `{kw.upper()}` operation is not permitted. "
                f"The analyst is read-only; you may only run SELECT queries."
            )
    return None


def _make_guarded_query_tool(query_engine, user_id: int):
    """A drop-in replacement for `sql_db_query` that enforces user scoping.

    Two layers of defence:

    1. **Database RLS (primary).** The query runs on `query_engine`, which —
       in production — connects as the read-only `analyst_ro` role. Before each
       query we set `app.user_id` so Postgres row-level security filters every
       row to the current user, even across JOINs/subqueries or a `users` scan.
       See the analyst-rls Alembic migration.
    2. **String heuristic (fallback).** Rejects queries that drop the `user_id`
       filter or reference another user's id. This is what protects scoping when
       ANALYST_DATABASE_URL is unset and RLS is bypassed by the owner role.
    """

    @tool("sql_db_query")
    def guarded_sql_db_query(query: str) -> str:
        """Execute a PostgreSQL SELECT query and return the result.
        The query MUST be scoped to the current user via `user_id = <id>` on any
        user-owned table. Input is a single, valid SQL query string."""
        # Read-only guard (first line of defence): reject anything that isn't a
        # single SELECT before touching the DB — covers the owner-engine fallback
        # where RLS isn't enforcing read-only access.
        not_read_only = _reject_if_not_read_only(query)
        if not_read_only:
            return not_read_only

        lowered = query.lower()
        if any(t in lowered for t in USER_SCOPED_TABLES):
            # Must reference the current user's id.
            if not re.search(rf"user_id\s*=\s*{user_id}\b", lowered):
                return (
                    f"ERROR: Query rejected — it must filter by `user_id = {user_id}` on every "
                    f"user-owned table ({', '.join(USER_SCOPED_TABLES)}). An empty result is a "
                    f"valid answer (0); do NOT remove the user_id filter."
                )
            # Must NOT reference any other user's id.
            other_ids = {int(m) for m in re.findall(r"user_id\s*=\s*(\d+)", lowered) if int(m) != user_id}
            if other_ids:
                return f"ERROR: Query rejected — you may only access user_id = {user_id}, not {sorted(other_ids)}."

        # Run inside a single transaction so the transaction-local `app.user_id`
        # GUC applies to the query. Read-only: the transaction is committed but
        # the SELECT mutates nothing.
        try:
            with query_engine.begin() as conn:
                conn.execute(
                    text("SELECT set_config('app.user_id', :uid, true)"),
                    {"uid": str(user_id)},
                )
                result = conn.execute(text(query))
                rows = result.fetchall()
            if not rows:
                return ""
            return str([tuple(r) for r in rows])
        except SQLAlchemyError as exc:
            # Mirror SQLDatabase.run's behaviour: hand the error back to the LLM
            # so it can correct the query.
            return f"Error: {exc}"

    return guarded_sql_db_query


def get_analyst_agent(today: Optional[str] = None, user_id: Optional[int] = None):
    """
    Creates a Data Analyst agent capable of:
    1. Querying the SQL database (Read-Only preferred).
    2. Searching the web.

    `today` / `user_id` are injected into the prompt so the agent can resolve
    relative periods ("this month") and scope queries to the right user.
    """
    # 1. Setup Database — prefer the read-only, RLS-constrained analyst engine so
    #    the LLM's SQL is hard-bounded to the current user at the DB level. Fall
    #    back to the shared owner engine (string guard only) when unconfigured.
    query_engine = analyst_engine or engine
    if analyst_engine is None and user_id is not None:
        logger.warning(
            "ANALYST_DATABASE_URL is not set — the data_analyst is running on the "
            "RLS-bypassing owner role. User scoping relies on the string guard only. "
            "Set ANALYST_DATABASE_URL to the analyst_ro role for defence-in-depth."
        )
    db = SQLDatabase(
        query_engine,
        include_tables=['expenses', 'categories', 'incomes', 'users', 'jars', 'recurring_expenses']
    )

    # 2. Setup LLM
    llm = get_llm(temperature=0)

    # 3. Setup Tools — swap the raw sql_db_query for a user-scoped guarded version.
    sql_tools = SQLDatabaseToolkit(db=db, llm=llm).get_tools()
    if user_id is not None:
        sql_tools = [t for t in sql_tools if t.name != "sql_db_query"]
        sql_tools.append(_make_guarded_query_tool(query_engine, user_id))
    tools = sql_tools + [get_search_tool()]

    # 4. Build prompt with runtime context prepended.
    context = ""
    if today:
        context += f"Today's date is {today}. Use it to resolve relative periods like 'this month'.\n"
    if user_id is not None:
        context += f"The current user_id is {user_id}. Scope every query to this user.\n"
    system_prompt = (context + "\n" + ANALYST_SYSTEM_PROMPT) if context else ANALYST_SYSTEM_PROMPT

    # 5. Create Agent (ReAct) — returns a CompiledStateGraph.
    return create_react_agent(llm, tools, prompt=system_prompt)
