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
    thread_id: Optional[str] = None # Added thread_id
    history: Optional[List[Dict[str, Any]]] = None

class ToolCallLog(BaseModel):
    name: str
    args: Dict[str, Any]
    result: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    is_completed: bool = False
    expense_data: Optional[Dict[str, Any]] = None
    tool_calls: List[ToolCallLog] = []
    thread_id: Optional[str] = None # Added thread_id

@router.post("/agent/chat", response_model=ChatResponse)
async def chat_with_agent(
    request: ChatRequest,
    current_user: User = Depends(deps.get_current_user),
):
    """
    Chat with the Financial AI Agent.
    """
    # Import here to avoid circular dependencies if any
    from app.agents.graph import compile_graph
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
    from psycopg_pool import AsyncConnectionPool
    from app.core.config import settings

    # Use a connection pool for checkpointer
    # In a real app, this pool should be created once in lifespan and passed here.
    # For now, we create a temporary connection for the checkpointer.
    
    # We need the connection string.
    db_url = settings.DATABASE_URL.replace("postgresql://", "postgresql://") # Ensure scheme
    
    async with AsyncConnectionPool(conninfo=db_url) as pool:
        checkpointer = AsyncPostgresSaver(pool)
        
        # NOTE: You must run `checkpointer.setup()` once separately to create tables.
        # We assume tables exist to avoid "ActiveSqlTransaction" error in high-concurrency or transaction blocks.
        
        graph = compile_graph(checkpointer=checkpointer)
        
        # Thread ID logic
        import uuid
        thread_id = request.thread_id or str(uuid.uuid4())
        
        input_state = {
            "messages": [HumanMessage(content=request.message)]
        }
        
        config = {
            "configurable": {
                "user_id": current_user.id,
                "thread_id": thread_id
            }
        }
        
        try:
            final_state = await graph.ainvoke(input_state, config=config)
            
            messages = final_state["messages"]
            last_message = messages[-1]
            
            if isinstance(last_message, HumanMessage):
                # Supervisor decided to FINISH immediately without any agent output.
                # To avoid echoing, we provide a fallback response.
                response_text = "I'm here to help! You can ask me to add expenses, check your budget, or analyze your spending habits."
            else:
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
                     if tool_calls_log:
                         tool_calls_log[-1].result = msg.content
        
            return ChatResponse(
                response=str(response_text) if response_text else "I've processed that.",
                is_completed=is_completed,
                expense_data=expense_data,
                tool_calls=tool_calls_log,
                thread_id=thread_id
            )
        except Exception as e:
            error_str = str(e)
            print(f"AI Agent Error: {error_str}") # Log for debug
            
            if "Rate limit reached" in error_str or "429" in error_str:
                 raise HTTPException(status_code=429, detail="AI Service usage limit reached. Please try again later.")
            
            # OpenAI / Groq Specific errors might come as objects
            if hasattr(e, "body") and isinstance(e.body, dict):
                 msg = e.body.get("message", error_str)
                 if "rate_limit" in str(msg).lower():
                      raise HTTPException(status_code=429, detail="AI Service usage limit reached. Please try again later.")

            raise HTTPException(status_code=500, detail=f"AI Error: {error_str}")

@router.get("/agent/history/{thread_id}", response_model=List[Dict[str, Any]])
async def get_chat_history(
    thread_id: str,
    current_user: User = Depends(deps.get_current_user),
):
    """
    Retrieve chat history for a specific thread.
    """
    from app.agents.graph import compile_graph
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
    from psycopg_pool import AsyncConnectionPool
    from app.core.config import settings

    db_url = settings.DATABASE_URL.replace("postgresql://", "postgresql://")
    
    async with AsyncConnectionPool(conninfo=db_url) as pool:
        checkpointer = AsyncPostgresSaver(pool)
        # No setup needed for read
        
        graph = compile_graph(checkpointer=checkpointer)
        
        config = {
            "configurable": {
                "user_id": current_user.id,
                "thread_id": thread_id
            }
        }
        
        # Get the latest state
        snapshot = await graph.aget_state(config)
        
        if not snapshot.values:
            return []
            
        messages = snapshot.values.get("messages", [])
        
        # Format for frontend
        formatted_history = []
        for msg in messages:
            role = "user"
            if isinstance(msg, AIMessage):
                role = "agent"
            elif isinstance(msg, HumanMessage):
                role = "user"
            else:
                continue # Skip tool messages for simple display, or handle if needed
                
            formatted_history.append({
                "role": role,
                "content": msg.content
            })
            
        return formatted_history
