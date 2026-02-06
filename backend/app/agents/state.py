from typing import List, Optional, TypedDict, Annotated
import operator
from langchain_core.messages import BaseMessage
from app.schemas.ai import ExpenseExtraction, BudgetCheckResult

class AgentState(TypedDict):
    """The state of the Financial Agent graph."""
    # Messages are appended to the list (reducer pattern)
    messages: Annotated[List[BaseMessage], operator.add]
    
    # Structured data extracted by the agent
    expense_data: Optional[ExpenseExtraction]
    
    # Result of any budget check performed
    budget_check: Optional[BudgetCheckResult]
    
    # If the agent needs to ask the user a question
    clarification_needed: Optional[str]
    
    # Final ready-to-save payload
    final_payload: Optional[dict]
