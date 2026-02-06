from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage

from app.core import deps
from app.models.user import User
from app.agents.graph import get_agent_graph

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[Dict[str, Any]]] = None  # Future proofing for chat history

class ToolCallLog(BaseModel):
    name: str
    args: Dict[str, Any]
    result: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    is_completed: bool = False
    expense_data: Optional[Dict[str, Any]] = None
    tool_calls: List[ToolCallLog] = []

@router.post("/agent/chat", response_model=ChatResponse)
async def chat_with_agent(
    request: ChatRequest,
    current_user: User = Depends(deps.get_current_user),
):
    """
    Chat with the Financial AI Agent.
    """
    graph = get_agent_graph()
    
    # Run the graph
    # We start with just the user message. 
    # In a real chat app, we'd pass the full history.
    input_state = {
        "messages": [HumanMessage(content=request.message)]
    }
    
    config = {"configurable": {"user_id": current_user.id}}
    
    # We want to stream the steps or just get the final result.
    # For simplicity v1, we await the final result.
    final_state = await graph.ainvoke(input_state, config=config)
    
    messages = final_state["messages"]
    last_message = messages[-1]
    
    response_text = last_message.content
    is_completed = False
    expense_data = None
    tool_calls_log = []

    # Analyze history to find tool calls and completion
    for msg in messages:
        if isinstance(msg, AIMessage) and msg.tool_calls:
            for tc in msg.tool_calls:
                tool_calls_log.append(ToolCallLog(name=tc["name"], args=tc["args"]))
                
                if tc["name"] == "submit_expense_tool":
                    is_completed = True
                    expense_data = tc["args"]
        
        if isinstance(msg, ToolMessage):
             # Find matching tool call in log and add result
             # (Simplified matching for V1)
             if tool_calls_log:
                 tool_calls_log[-1].result = msg.content

    return ChatResponse(
        response=str(response_text) if response_text else "I've processed that.",
        is_completed=is_completed,
        expense_data=expense_data,
        tool_calls=tool_calls_log
    )
