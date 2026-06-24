import re
from typing import Optional

from langchain_community.utilities import SQLDatabase
from langchain_community.agent_toolkits.sql.toolkit import SQLDatabaseToolkit
from langchain_core.tools import tool
from loguru import logger
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import engine, analyst_engine

# Tables that carry a `user_id` and must never be queried across users.
USER_SCOPED_TABLES = ("expenses", "incomes", "categories")

# Tables the analyst must never touch at all — not even for the current user.
# `users` holds `hashed_password`; RLS scopes a `SELECT * FROM users` to the
# requester's own row, but that row's password hash would still leak into the LLM
# context / chat transcript / provider logs. `jars` and `recurring_expenses` are
# out of the analyst's scope too. RLS is row-level only, so we block these tables
# outright here (hiding them from `include_tables` isn't enough — the model can
# still name them in a hand-written query).
FORBIDDEN_TABLES = ("users", "jars", "recurring_expenses")

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

        # Scan with comments/string-literals stripped so a `users` inside a quoted
        # value or comment can't trip this, and a real reference can't hide there.
        scan = _strip_sql_noise(query).lower()
        for forbidden in FORBIDDEN_TABLES:
            if re.search(rf"\b{forbidden}\b", scan):
                return (
                    f"ERROR: Query rejected — the `{forbidden}` table is off-limits. "
                    f"It holds sensitive account fields; query the user's expenses, "
                    f"incomes, categories, jars or recurring_expenses instead."
                )

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


def make_sql_tools(user_id: Optional[int], llm):
    """Read-only, user-scoped SQL toolset for the agent.

    Returns the standard SQL toolkit (list tables, inspect schema, query checker)
    with the raw `sql_db_query` swapped for the guarded version — read-only and
    bound to `user_id`. Prefers the RLS-constrained `analyst_ro` engine, falling
    back to the owner engine (string/keyword guards only) when unconfigured.
    """
    query_engine = analyst_engine or engine
    if analyst_engine is None and user_id is not None:
        logger.warning(
            "ANALYST_DATABASE_URL is not set — SQL runs on the RLS-bypassing owner "
            "role. User scoping + read-only rely on the in-process guards only. Set "
            "ANALYST_DATABASE_URL to the analyst_ro role for defence-in-depth."
        )
    # NOTE: only the tables the analyst actually needs are exposed; `users`,
    # `jars` and `recurring_expenses` are deliberately left out (see
    # FORBIDDEN_TABLES). `users` is the sharp edge — exposing it lets a jailbroken
    # model run `SELECT * FROM users` which, while RLS-scoped to the user's own
    # row, still surfaces their `hashed_password` into the LLM context / chat
    # transcript / provider logs. RLS only does row-level isolation, not
    # column-level, so the FORBIDDEN_TABLES guard blocks these outright — dropping
    # them from include_tables alone isn't enough, the model can still name them.
    db = SQLDatabase(
        query_engine,
        include_tables=['expenses', 'categories', 'incomes'],
    )
    sql_tools = SQLDatabaseToolkit(db=db, llm=llm).get_tools()
    if user_id is not None:
        sql_tools = [t for t in sql_tools if t.name != "sql_db_query"]
        sql_tools.append(_make_guarded_query_tool(query_engine, user_id))
    return sql_tools
