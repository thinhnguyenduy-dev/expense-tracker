"""Entry point for the financial agent.

The agent is a single ReAct agent (see `agent.py`) — there is no supervisor graph
anymore. `compile_graph` is the one public builder, kept with the same name so the
read-only call sites in `app/api/ai.py` stay unchanged.
"""

from langgraph.graph import END, START, MessagesState, StateGraph

from app.agents.agent import build_agent


def compile_graph(checkpointer=None, **agent_ctx):
    """Compile the financial agent.

    - WITH user context (``user_id=...`` etc.) → the full single ReAct agent with
      every tool, built for that user.
    - WITHOUT it (history-read endpoints, which only call ``aget_state``) → a
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
