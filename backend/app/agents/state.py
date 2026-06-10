from typing import List, Optional, TypedDict, Annotated
import operator
from langchain_core.messages import BaseMessage


class AgentState(TypedDict, total=False):
    """The state of the Financial Agent graph."""

    # Messages are appended to the list (reducer pattern).
    messages: Annotated[List[BaseMessage], operator.add]

    # If the agent needs to ask the user a question.
    clarification_needed: Optional[str]

    # Supervisor routing decision.
    next: Optional[str]
