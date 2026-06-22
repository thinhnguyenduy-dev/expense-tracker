"""Single ReAct financial agent.

One agent owns every tool (logging, reads, read-only SQL, web search), so there
is NO supervisor and no routing/hand-off between specialists. Multi-step requests
("look up the fuel price AND log it") are handled by chaining tool calls inside a
single ReAct loop. Adding a capability means adding a TOOL, not a routing rule.

Built per request (like the old analyst) so the user's id/currency/categories/date
can be baked into the tools and the system prompt.
"""

from datetime import date as _date
from typing import Optional

from langgraph.prebuilt import create_react_agent

from app.agents.analyst import make_sql_tools
from app.agents.prompts import AGENT_SYSTEM_PROMPT
from app.agents.tools import get_search_tool, make_tools
from app.core.llm import get_llm

_LANG_NAMES = {"vi": "Vietnamese", "en": "English"}


def build_agent(
    checkpointer=None,
    *,
    user_id: int,
    user_currency: str = "VND",
    categories: Optional[list[str]] = None,
    user_lang: str = "vi",
    today: Optional[str] = None,
):
    """Compile the financial ReAct agent for one user.

    Tools: expense/income logging + clarification (user-scoped ORM), recent/monthly
    reads, read-only user-scoped SQL, and web search. Returns a CompiledStateGraph
    whose state is messages-based, so `app/api/ai.py` reads it exactly as before.
    """
    llm = get_llm(temperature=0)

    tools = list(make_tools(user_id, user_currency))
    tools += make_sql_tools(user_id, llm)
    tools.append(get_search_tool())

    prompt = AGENT_SYSTEM_PROMPT.format(
        date=today or str(_date.today()),
        categories=", ".join(categories) if categories else "No categories available",
        user_currency=user_currency,
        user_lang=_LANG_NAMES.get(user_lang, user_lang),
        user_id=user_id,
    )

    return create_react_agent(llm, tools, prompt=prompt, checkpointer=checkpointer)
