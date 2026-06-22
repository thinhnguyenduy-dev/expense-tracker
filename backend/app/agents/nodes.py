"""Graph node implementations for the financial agent.

Each function is a LangGraph node. The graph wiring lives in `graph.py`; prompt
text in `prompts.py`; message helpers in `utils.py`.
"""

import re
from datetime import date as _date
from typing import Literal, Optional

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import RunnableConfig
from langgraph.prebuilt import ToolNode
from pydantic import BaseModel, Field

from app.agents import prompts
from app.agents.analyst import get_analyst_agent
from app.agents.registry import ROUTE_OPTIONS, WORKER_NAMES
from app.agents.state import AgentState
from app.agents.tools import make_tools
from app.agents.utils import sanitize_messages_for_model, trim_messages
from app.core.llm import get_llm
from app.core.logging import app_logger as logger

_LANG_NAMES = {"vi": "Vietnamese", "en": "English"}


_WORKERS = WORKER_NAMES  # from the worker registry — single source of truth

# Logging/recording intent in the user's own words. Used to DETERMINISTICALLY chain
# data_analyst → financial_agent for "look it up AND log it" requests. The analyst can
# only research (read/search), never write, so after it returns the figure the expense
# still has to be logged — and we don't trust the reactive supervisor to notice, because
# the analyst's terse answer (or any closing remark) too often makes it FINISH first.
# Covers common Vietnamese and English phrasings ("ghi vào sổ", "lưu", "log", "record").
_LOG_INTENT_RE = re.compile(
    r"ghi|lưu|nhập|vào sổ|\blog\b|\brecord\b|\bsave\b|\btrack\b",
    re.IGNORECASE,
)


def _latest_human_text(messages) -> str:
    """Plain text of the most recent HumanMessage (the current user request)."""
    for m in reversed(messages):
        if isinstance(m, HumanMessage):
            return str(m.content)
    return ""


def _wants_logging(messages) -> bool:
    """True when the current user request asks to record/log a transaction."""
    return bool(_LOG_INTENT_RE.search(_latest_human_text(messages)))


class RouterResponse(BaseModel):
    """Pick the next worker to act, or FINISH."""

    next: Literal[ROUTE_OPTIONS] = Field(  # type: ignore[valid-type]  # enum built from the worker registry
        description="The next worker to handle the next unhandled part. 'FINISH' when the whole request is done.",
    )
    reason: Optional[str] = Field(
        default=None,
        description="Reply to the user when finishing immediately without any worker (direct answer / refusal).",
    )


# Safety cap on how many workers one turn may chain — backstop for the reactive loop.
MAX_AGENT_HOPS = 3


def supervisor_node(state: AgentState, config: RunnableConfig):
    """Textbook REACTIVE supervisor.

    After EVERY worker, re-ask the LLM which worker should act next (or FINISH),
    based on the conversation so far. This is the defining trait of the supervisor
    pattern: it reacts to what a worker actually produced, at the cost of one routing
    LLM call per step. Two safety nets bound the loop (the local model otherwise
    re-routes greetings forever): a per-worker guard (never re-run a worker that
    already acted this turn) and a hard hop cap.
    """
    logger.info("👉 [NODE] Entering supervisor")
    messages = state["messages"]
    agents_run = state.get("agents_run") or []  # workers that already acted this turn
    user_lang = config.get("configurable", {}).get("user_lang", "vi")
    lang_name = _LANG_NAMES.get(user_lang, user_lang)

    # Hard safety cap.
    if len(agents_run) >= MAX_AGENT_HOPS:
        logger.info(f"🏁 [NODE] supervisor → FINISH (hop cap {MAX_AGENT_HOPS} reached)")
        return {"next": "FINISH"}

    model = get_llm(temperature=0)
    # Standard tool calling for routing (compatible with Groq/Llama).
    model_with_tool = model.bind_tools([RouterResponse], tool_choice="RouterResponse")
    # Pin the decision to the CURRENT user request. Without this the weak local model
    # treats a finished PRIOR turn (still in history) as proof the new message is already
    # handled and wrongly FINISHes — e.g. answering "list expenses" then dropping the
    # follow-up "list income" with a generic reply.
    current_request = _latest_human_text(messages)
    routing_directive = SystemMessage(content=(
        f'ROUTE THIS — the user\'s CURRENT request is: "{current_request}"\n'
        "Earlier messages are prior turns, already answered; they are context only and "
        "do NOT mean this request is handled. Pick the worker for it now. Only FINISH if "
        "this request itself is already fully handled by a worker THIS turn"
        + (f" (workers run this turn: {', '.join(agents_run)})." if agents_run
           else " (no worker has run for it yet, so do not FINISH it as already-done).")
    ))
    try:
        response = model_with_tool.invoke([
            SystemMessage(content=prompts.SUPERVISOR_PROMPT.format(user_lang=lang_name)),
            *sanitize_messages_for_model(messages)[-10:],  # Context window (sanitized)
            routing_directive,
        ])
    except Exception as e:
        logger.debug(f"Supervisor invocation failed: {e}")
        return {"next": "FINISH"}

    next_node, reason = "FINISH", None
    if response.tool_calls:
        args = response.tool_calls[0]["args"]
        next_node = args.get("next") or "FINISH"
        reason = args.get("reason")
        if next_node not in _WORKERS and next_node != "FINISH":
            next_node = "FINISH"

    to_return = {}
    # Loop guard: never re-run a worker that already acted this turn (the usual cause
    # of supervisor↔worker ping-pong). Routing to a DIFFERENT worker still chains fine.
    if next_node in agents_run:
        logger.info(f"🏁 [NODE] supervisor → FINISH ({next_node} already ran this turn)")
        next_node = "FINISH"

    if next_node == "FINISH":
        # Surface the supervisor's own reply only on an immediate finish (no worker ran).
        if reason and not agents_run:
            to_return["messages"] = [AIMessage(content=reason)]
        logger.info("🏁 [NODE] supervisor → FINISH")
    else:
        to_return["agents_run"] = agents_run + [next_node]
        logger.info(f"🧭 [NODE] supervisor → {next_node} (reactive; đã chạy: {agents_run or '—'})")

    to_return["next"] = next_node
    return to_return


def financial_agent_node(state: AgentState, config: RunnableConfig):
    """Handle transactional financial tasks (log expenses/incomes, budget checks)."""
    logger.debug("Entering financial_agent_node")
    cfg = config.get("configurable", {})
    user_id = cfg.get("user_id")
    user_lang = cfg.get("user_lang", "vi")
    user_currency = cfg.get("user_currency", "VND")
    categories = cfg.get("categories", [])
    lang_name = _LANG_NAMES.get(user_lang, user_lang)

    messages = state["messages"]
    tools = make_tools(user_id, user_currency)
    logger.debug("Binding tools...")
    model = get_llm(temperature=0).bind_tools(tools)

    categories_str = ", ".join(categories) if categories else "No categories available"

    prompt = ChatPromptTemplate.from_messages([
        ("system", prompts.FINANCIAL_SYSTEM_PROMPT),
        MessagesPlaceholder(variable_name="messages"),
    ])
    chain = prompt.partial(
        date=str(_date.today()),
        user_lang=lang_name,
        user_currency=user_currency,
        categories=categories_str,
    ) | model

    logger.debug("Invoking financial chain...")
    response = chain.invoke(sanitize_messages_for_model(trim_messages(messages)))
    logger.debug(f"Financial response content: {str(response.content)[:100]}...")
    if response.tool_calls:
        logger.debug(f"Financial response tool_calls: {response.tool_calls}")

    logger.debug("Financial chain returned")
    return {"messages": [response]}


def financial_tools_node(state: AgentState, config: RunnableConfig):
    """Execute financial tool calls.

    If ask_clarification_tool runs, its interrupt() pauses the whole graph here
    (human-in-the-loop) until ai.py resumes with Command(resume=<answer>).
    """
    cfg = config.get("configurable", {})
    user_id = cfg.get("user_id")
    user_currency = cfg.get("user_currency", "VND")
    tools = make_tools(user_id, user_currency)
    return ToolNode(tools).invoke(state, config)


def _extract_tool_trace(messages) -> list[dict]:
    """Build [{name, args, result}] from a run of AI(tool_calls)/Tool messages.

    Used to surface the analyst's SQL/search trace to the UI when running in
    last_message mode (where those messages don't enter the shared `messages`).
    """
    trace: list[dict] = []
    pending: dict[str, dict] = {}  # tool_call_id → entry awaiting its result
    for m in messages:
        if isinstance(m, AIMessage) and getattr(m, "tool_calls", None):
            for tc in m.tool_calls:
                entry = {"name": tc.get("name"), "args": tc.get("args")}
                trace.append(entry)
                if tc.get("id"):
                    pending[tc["id"]] = entry
        elif isinstance(m, ToolMessage):
            cid = getattr(m, "tool_call_id", None)
            if cid in pending:
                pending[cid]["result"] = str(m.content)
    return trace


async def data_analyst_node(state: AgentState, config: RunnableConfig):
    """Delegate analytics/aggregation queries to the ReAct analyst agent.

    The analyst is a ReAct subgraph that emits a whole AI/Tool/AI/Tool chain
    while running SQL. `analyst_output_mode` controls how much of that chain is
    merged back into the supervisor's shared state:
      - "last_message" (default): only the analyst's final answer — clean history.
      - "full_history": every message the analyst produced — full SQL trace.
    """
    cfg = config.get("configurable", {})
    output_mode = cfg.get("analyst_output_mode", "last_message")

    analyst_agent = get_analyst_agent(today=str(_date.today()), user_id=cfg.get("user_id"))
    # Pass config so callbacks (e.g. AILoggingCallbackHandler) propagate into the
    # analyst subgraph — otherwise its SQL/tool calls don't show up in the logs.
    response = await analyst_agent.ainvoke(state, config)

    new_messages = response["messages"]
    if not new_messages:
        return {}

    if output_mode == "full_history":
        # create_react_agent returns prior history + new messages. Slice off the
        # messages the supervisor already has, otherwise operator.add duplicates them.
        already_seen = len(state["messages"])
        merged = new_messages[already_seen:]
        logger.debug(f"data_analyst output_mode=full_history → merging {len(merged)} messages back")
        result = {"messages": merged}
    else:
        # last_message: keep shared history clean (only the final answer), but capture
        # the analyst's tool/SQL trace separately so the UI can still display it.
        trace = _extract_tool_trace(new_messages[len(state["messages"]):])
        logger.debug(f"data_analyst output_mode=last_message → merging 1 message, trace={len(trace)} tool calls")
        result = {"messages": [new_messages[-1]], "analyst_trace": trace}

    # Deterministic "look it up AND log it" chaining (see _LOG_INTENT_RE). If the user
    # asked to RECORD something the analyst just researched, hard-route to financial_agent
    # next — the analyst's final answer now carries the figure, and financial_agent does
    # the actual write. Pre-mark agents_run so the supervisor's loop guard won't re-run it
    # after it returns. `next` is read by the conditional edge in graph.py.
    agents_run = state.get("agents_run") or []
    if "financial_agent" not in agents_run and _wants_logging(state["messages"]):
        result["next"] = "financial_agent"
        result["agents_run"] = agents_run + ["financial_agent"]
        logger.info("🧭 [NODE] data_analyst → financial_agent (deterministic log-with-lookup)")
    else:
        result["next"] = "supervisor"
    return result


def general_agent_node(state: AgentState, config: RunnableConfig):
    """Handle general chitchat and non-financial questions."""
    user_lang = config.get("configurable", {}).get("user_lang", "vi")
    lang_name = _LANG_NAMES.get(user_lang, user_lang)

    model = get_llm(temperature=0.5)

    prompt = ChatPromptTemplate.from_messages([
        ("system", prompts.GENERAL_AGENT_PROMPT),
        MessagesPlaceholder(variable_name="messages"),
    ])

    chain = prompt.partial(user_lang=lang_name) | model
    response = chain.invoke(sanitize_messages_for_model(trim_messages(state["messages"])))
    return {"messages": [response]}
