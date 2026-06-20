from typing import Any, Dict, List, Optional, TypedDict, Annotated
import operator
from langchain_core.messages import BaseMessage


class AgentState(TypedDict, total=False):
    """The state of the Financial Agent graph."""

    # Messages are appended to the list (reducer pattern).
    messages: Annotated[List[BaseMessage], operator.add]

    # Supervisor routing decision.
    next: Optional[str]

    # The data_analyst's tool/SQL trace for the CURRENT turn, surfaced separately
    # from `messages` so it can be shown in the UI without bloating the shared
    # history. Reset to None at the start of each turn (see ai.py). Override field.
    analyst_trace: Optional[List[Dict[str, Any]]]
