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

    workflow.add_edge("data_analyst", "supervisor")
    workflow.add_edge("general_agent", "supervisor")

    return workflow


def compile_graph(checkpointer=None):
    workflow = get_agent_graph()
    return workflow.compile(checkpointer=checkpointer)
