"""LangGraph wiring for the financial agent.

Node implementations live in `nodes.py`. This module only builds and compiles
the graph. Public entry points: `get_agent_graph()` and `compile_graph()`.
"""

from typing import Literal

from langgraph.graph import END, StateGraph

from app.agents.nodes import (
    data_analyst_node,
    financial_agent_node,
    financial_tools_node,
    general_agent_node,
    supervisor_node,
)
from app.agents.state import AgentState


def _should_continue_financial(
    state: AgentState,
) -> Literal["financial_tools", "supervisor"]:
    last_message = state["messages"][-1]
    if getattr(last_message, "tool_calls", None):
        return "financial_tools"
    return "supervisor"


def _route_after_analyst(
    state: AgentState,
) -> Literal["financial_agent", "supervisor"]:
    """Deterministic hand-off out of the analyst.

    `data_analyst_node` sets `next="financial_agent"` when the user asked to RECORD
    something it just looked up (a "log-with-lookup" request), so we go straight there
    instead of bouncing through the supervisor LLM — which the analyst's terse final
    answer reliably tricks into FINISHing before the expense is ever logged. In every
    other case control returns to the supervisor as before.
    """
    return "financial_agent" if state.get("next") == "financial_agent" else "supervisor"


def get_agent_graph():
    workflow = StateGraph(AgentState)

    workflow.add_node("supervisor", supervisor_node)
    workflow.add_node("financial_agent", financial_agent_node)
    workflow.add_node("financial_tools", financial_tools_node)
    workflow.add_node("data_analyst", data_analyst_node)
    workflow.add_node("general_agent", general_agent_node)

    workflow.set_entry_point("supervisor")

    workflow.add_conditional_edges(
        "supervisor",
        lambda state: state["next"],
        {
            "financial_agent": "financial_agent",
            "data_analyst": "data_analyst",
            "general_agent": "general_agent",
            "FINISH": END,
        },
    )

    workflow.add_conditional_edges("financial_agent", _should_continue_financial)

    # financial_tools always loops back to financial_agent. If ask_clarification_tool
    # runs, interrupt() pauses the graph here until Command(resume=...) arrives.
    workflow.add_edge("financial_tools", "financial_agent")

    workflow.add_conditional_edges(
        "data_analyst",
        _route_after_analyst,
        {"financial_agent": "financial_agent", "supervisor": "supervisor"},
    )
    workflow.add_edge("general_agent", "supervisor")

    return workflow


def compile_graph(checkpointer=None):
    workflow = get_agent_graph()
    return workflow.compile(checkpointer=checkpointer)
