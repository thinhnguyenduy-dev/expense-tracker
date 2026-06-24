"""Single ReAct agent for the expense tracker.

One agent owns every tool (logging, reads, read-only SQL, web search). Multi-step
requests ("look up the fuel price AND log it") are handled by chaining tool calls
inside a single ReAct loop. Adding a capability means adding a TOOL, not a rule.

Built per request so the user's id/currency/categories/date can be baked into the
tools and the system prompt. `compile_graph` is the public entry used by
`app/api/ai.py`.
"""

from datetime import date as _date
from typing import Optional

from langgraph.graph import END, START, MessagesState, StateGraph

# Prefer LangGraph's prebuilt `create_react_agent`. It propagates the model's
# token-streaming events out through the graph, so the SSE chat endpoint can stream
# the answer token-by-token (`stream_mode="messages"`). LangChain's newer
# `create_agent` runs the model in a way that swallows those events — the graph only
# sees `on_chain_*`, never `on_chat_model_stream` — so with it the answer can only be
# delivered as one final block. Both build the SAME single ReAct agent; this is purely
# an implementation choice to keep streaming working.
try:
    from langgraph.prebuilt import create_react_agent as _create_agent
    _USE_LANGCHAIN_CREATE_AGENT = False
except ImportError:  # pragma: no cover - compatibility with older installs
    from langchain.agents import create_agent as _create_agent
    _USE_LANGCHAIN_CREATE_AGENT = True

from app.agents.sql_tools import make_sql_tools
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
    """Compile the ReAct agent for one user.

    Tools: expense/income logging + clarification (user-scoped ORM), recent/monthly
    reads, read-only user-scoped SQL, and web search. Returns a CompiledStateGraph
    whose state is messages-based, so `app/api/ai.py` reads it exactly as before.
    """
    # streaming=True so LangGraph's `stream_mode="messages"` can emit per-token
    # chunks for the SSE endpoint. Harmless for the non-streaming path — `ainvoke`
    # aggregates the streamed chunks into one response transparently.
    llm = get_llm(temperature=0, streaming=True)

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

    if _USE_LANGCHAIN_CREATE_AGENT:
        return _create_agent(
            model=llm,
            tools=tools,
            system_prompt=prompt,
            checkpointer=checkpointer,
        )
    return _create_agent(llm, tools, prompt=prompt, checkpointer=checkpointer)


def compile_graph(checkpointer=None, **agent_ctx):
    """Public entry used by `app/api/ai.py`.

    - WITH user context (``user_id=...`` etc.) → the full ReAct agent for that user.
    - WITHOUT it (the history-read endpoints, which only call ``aget_state``) → a
      minimal messages-only graph that loads checkpointed state without building
      tools or hitting the database for schema reflection.
    """
    if agent_ctx.get("user_id") is not None:
        return build_agent(checkpointer=checkpointer, **agent_ctx)

    # Read-only stub: just enough state schema to load `messages` from a checkpoint.
    g = StateGraph(MessagesState)
    g.add_node("noop", lambda state: state)
    g.add_edge(START, "noop")
    g.add_edge("noop", END)
    return g.compile(checkpointer=checkpointer)
