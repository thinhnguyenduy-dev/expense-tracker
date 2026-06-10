import re
from typing import Optional

from langchain_community.utilities import SQLDatabase
from langchain_community.agent_toolkits.sql.toolkit import SQLDatabaseToolkit
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent

from app.agents.prompts import ANALYST_SYSTEM_PROMPT
from app.agents.tools import get_search_tool
from app.core.llm import get_llm
from app.core.database import engine

# Tables that carry a `user_id` and must never be queried across users.
USER_SCOPED_TABLES = ("expenses", "incomes", "categories", "jars", "recurring_expenses")


def _make_guarded_query_tool(db: SQLDatabase, user_id: int):
    """A drop-in replacement for `sql_db_query` that enforces user scoping.

    Any query touching a user-scoped table is rejected unless it filters by
    `user_id = <current user>`, and rejected if it references any OTHER user_id.
    This stops the LLM from "fixing" an empty result by dropping the filter
    (which would leak other users' data). Heuristic (string-based), not a
    substitute for DB-level RLS, but blocks the common leak paths.
    """

    @tool("sql_db_query")
    def guarded_sql_db_query(query: str) -> str:
        """Execute a PostgreSQL SELECT query and return the result.
        The query MUST be scoped to the current user via `user_id = <id>` on any
        user-owned table. Input is a single, valid SQL query string."""
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
        return db.run(query)

    return guarded_sql_db_query


def get_analyst_agent(today: Optional[str] = None, user_id: Optional[int] = None):
    """
    Creates a Data Analyst agent capable of:
    1. Querying the SQL database (Read-Only preferred).
    2. Searching the web.

    `today` / `user_id` are injected into the prompt so the agent can resolve
    relative periods ("this month") and scope queries to the right user.
    """
    # 1. Setup Database — use the shared engine to avoid pool exhaustion.
    db = SQLDatabase(
        engine,
        include_tables=['expenses', 'categories', 'incomes', 'users', 'jars', 'recurring_expenses']
    )

    # 2. Setup LLM
    llm = get_llm(temperature=0)

    # 3. Setup Tools — swap the raw sql_db_query for a user-scoped guarded version.
    sql_tools = SQLDatabaseToolkit(db=db, llm=llm).get_tools()
    if user_id is not None:
        sql_tools = [t for t in sql_tools if t.name != "sql_db_query"]
        sql_tools.append(_make_guarded_query_tool(db, user_id))
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
