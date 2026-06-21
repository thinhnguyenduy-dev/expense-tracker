"""Graph node implementations for the financial agent.

Each function is a LangGraph node. The graph wiring lives in `graph.py`; prompt
text in `prompts.py`; message helpers in `utils.py`.
"""

from datetime import date as _date
from typing import Literal, Optional

from langchain_core.messages import AIMessage, SystemMessage, ToolMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import RunnableConfig
from langgraph.prebuilt import ToolNode
from pydantic import BaseModel, Field

from app.agents import prompts
from app.agents.analyst import get_analyst_agent
from app.agents.state import AgentState
from app.agents.tools import make_tools
from app.agents.utils import sanitize_messages_for_model, trim_messages
from app.core.llm import get_llm
from app.core.logging import app_logger as logger

_LANG_NAMES = {"vi": "Vietnamese", "en": "English"}


class RouterResponse(BaseModel):
    """Select the next agent to handle the request."""

    next: Literal["financial_agent", "data_analyst", "general_agent", "FINISH"] = Field(
        description="The next worker to act. Use 'FINISH' if user is satisfied."
    )
    reason: Optional[str] = Field(
        default=None,
        description="The final message to the user if returning FINISH (e.g., answer, refusal, or clarification).",
    )


def supervisor_node(state: AgentState):
    """Decide which agent to route to (or FINISH)."""
    logger.info("👉 [NODE] Entering supervisor")
    messages = state["messages"]

    model = get_llm(temperature=0)

    logger.debug(f"Supervisor State Messages Count: {len(messages)}")
    if messages:
        last_msg = messages[-1]
        logger.debug(f"Last Message Role: {last_msg.type}")
        logger.debug(f"Last Message Content: {str(last_msg.content)[:100]}...")

        # Force stop if the last message was from an AI: this prevents the
        # Supervisor from routing an AI's answer back to an AI.
        if last_msg.type == "ai":
            logger.info("🏁 [NODE] supervisor → FINISH (fast-path: last message is AI, no LLM call)")
            return {"next": "FINISH"}

        if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
            logger.debug(f"Last Message Tool Calls: {last_msg.tool_calls}")

    # Use standard tool calling for compatibility with Groq/Llama.
    model_with_tool = model.bind_tools([RouterResponse], tool_choice="RouterResponse")

    logger.debug("Invoking Supervisor Model...")
    try:
        response = model_with_tool.invoke([
            SystemMessage(content=prompts.SUPERVISOR_PROMPT),
            *sanitize_messages_for_model(messages)[-10:],  # Context window (sanitized)
        ])
        logger.debug(f"Supervisor Response Tool Calls: {response.tool_calls}")
    except Exception as e:
        logger.debug(f"Supervisor invocation failed: {e}")
        return {"next": "FINISH"}

    to_return = {}
    if response.tool_calls:
        args = response.tool_calls[0]["args"]
        next_node = args.get("next")
        reason = args.get("reason")
        logger.debug(f"Supervisor Decided: {next_node}, Reason: {reason}")

        valid_nodes = ["financial_agent", "data_analyst", "general_agent", "FINISH"]
        if next_node not in valid_nodes:
            logger.debug(f"Invalid next_node '{next_node}', defaulting to FINISH")
            next_node = "FINISH"

        if reason and next_node == "FINISH":
            # Add the reasoning as an AIMessage so the UI sees it.
            to_return["messages"] = [AIMessage(content=reason)]
    else:
        logger.debug("Supervisor made no decision (no tool call)")
        next_node = "FINISH"

    logger.info(f"🧭 [NODE] supervisor → {next_node} (routed by LLM)")
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
        return {"messages": merged}

    # last_message: keep shared history clean (only the final answer), but capture
    # the analyst's tool/SQL trace separately so the UI can still display it.
    trace = _extract_tool_trace(new_messages[len(state["messages"]):])
    logger.debug(f"data_analyst output_mode=last_message → merging 1 message, trace={len(trace)} tool calls")
    return {"messages": [new_messages[-1]], "analyst_trace": trace}


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
