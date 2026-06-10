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
    logger.debug("Entering supervisor_node")
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
            logger.debug("Last message was from AI. Forcing FINISH.")
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
    is_resume = cfg.get("is_resume", False)
    lang_name = _LANG_NAMES.get(user_lang, user_lang)

    # ── Clarification relay mode ──────────────────────────────────────────────
    # Triggered ONLY when the last message in history is a ToolMessage from
    # ask_clarification_tool (i.e. financial_tools_node just ran it).
    # We relay the question as a friendly text AIMessage (no tools bound) so
    # history always ends on a clean AIMessage. We use the message history —
    # NOT state["clarification_needed"] — to avoid stale-state issues.
    messages = state["messages"]
    last_msg = messages[-1] if messages else None
    is_clarification_relay = (
        isinstance(last_msg, ToolMessage)
        and getattr(last_msg, "name", "") == "ask_clarification_tool"
    )
    if is_clarification_relay:
        question = str(last_msg.content)
        logger.debug(f"Relaying clarification question: {question[:80]}")
        relay_model = get_llm(temperature=0)
        relay_prompt = ChatPromptTemplate.from_messages([
            ("system", prompts.CLARIFICATION_RELAY_PROMPT),
        ])
        relay_chain = relay_prompt.partial(
            date=str(_date.today()),
            user_lang=lang_name,
            question=question,
        ) | relay_model
        response = relay_chain.invoke({})
        logger.debug("Clarification relayed as text AIMessage")
        # Set clarification_needed so ai.py detects needs_clarification=True
        return {"messages": [response], "clarification_needed": question}

    # ── Normal / resume mode ──────────────────────────────────────────────────
    tools = make_tools(user_id, user_currency)
    logger.debug("Binding tools...")
    model = get_llm(temperature=0).bind_tools(tools)

    categories_str = ", ".join(categories) if categories else "No categories available"
    resume_instruction = prompts.RESUME_INSTRUCTION if is_resume else ""

    prompt = ChatPromptTemplate.from_messages([
        ("system", prompts.FINANCIAL_SYSTEM_PROMPT),
        MessagesPlaceholder(variable_name="messages"),
    ])
    chain = prompt.partial(
        date=str(_date.today()),
        user_lang=lang_name,
        user_currency=user_currency,
        categories=categories_str,
        resume_instruction=resume_instruction,
    ) | model

    logger.debug("Invoking financial chain...")
    response = chain.invoke(sanitize_messages_for_model(trim_messages(messages)))
    logger.debug(f"Financial response content: {str(response.content)[:100]}...")
    if response.tool_calls:
        logger.debug(f"Financial response tool_calls: {response.tool_calls}")

    logger.debug("Financial chain returned")
    # Clear clarification_needed when generating the final response (no more tool calls).
    # This ensures ai.py sees needs_clarification=False after a successful resume+submit.
    extra = {} if getattr(response, "tool_calls", None) else {"clarification_needed": None}
    return {"messages": [response], **extra}


def financial_tools_node(state: AgentState, config: RunnableConfig):
    """Execute financial tool calls, surfacing clarification questions into state."""
    cfg = config.get("configurable", {})
    user_id = cfg.get("user_id")
    user_currency = cfg.get("user_currency", "VND")
    tools = make_tools(user_id, user_currency)
    node = ToolNode(tools)
    result = node.invoke(state, config)

    # Detect ask_clarification_tool call and surface the question into state
    for msg in result.get("messages", []):
        if isinstance(msg, ToolMessage) and getattr(msg, "name", "") == "ask_clarification_tool":
            return {**result, "clarification_needed": str(msg.content)}

    return result


def clarification_node(state: AgentState):
    """Terminal node signalling the AI needs more info from the user.

    The graph ends here; ai.py detects `clarification_needed` in the final state
    and returns needs_clarification=True to the frontend. On the next user turn
    the answer arrives as a new HumanMessage and the financial_agent resumes with
    full conversation history.
    """
    logger.debug(f"Clarification needed: {state.get('clarification_needed')}")
    return {}  # state already has clarification_needed set by financial_tools_node


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
