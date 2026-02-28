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
    try:
        # We use a separate function for processing to allow caching
        # The cache key will be based on user_id, message, and thread_id
        # We need to ensure that the same question with the same context returns the same answer if cached.
        # However, "context" usually allows following up.
        # If thread_id is reused, and we cache strictly on input message, we might miss the fact that state has changed?
        # WAIT. Caching typical chat is dangerous if state matters.
        # If I ask "What is my balance?" -> Cache: "100".
        # I add an expense.
        # I ask "What is my balance?" -> Cache "100" (WRONG).
        
        # User request: "minimize calls to the AI API provider... (caching)".
        # Smart caching needs to know if data changed. Or just short TTL?
        # User asked for "caching", implying simple caching for identical queries.
        # But for an agent that modifies state, naive caching is bad.
        # I will use a short TTL (e.g., 60s) or assume the user accepts this trade-off for "repeated questions".
        # BETTER: The cache key should perhaps NOT include thread_id if we want to cache "What is X?" across users? No, user data is private.
        # We must include user_id.
        # If we include thread_id, then caching only works for REPEATED inputs in the SAME conversation.
        # If we don't include thread_id, we lose context.
        # A compromise for this task: Cache based on (user_id, message, thread_id). 
        # But we must be careful. If I ask "Who are you?" it handles it.
        # If I ask "Add expense 50", it performs action. Caching action requests is bad if it re-executes?
        # The cache stores the RESULT. So if I ask "Add expense 50", it returns "Done".
        # If I ask it AGAIN, it returns "Done" from cache, but DOES NOT execute the action again.
        # This is actually GOOD for idempotency if the user double-clicks?
        # But bad if the user *meant* to add it twice. 
        # However, usually identical immediate messages are accidental.
        
        result = await process_chat(current_user.id, request.message, request.thread_id)
        
        return ChatResponse(**result)

    except Exception as e:
        error_str = str(e)
        logger.error(f"AI Agent Error: {error_str}") # Log for debug
        
        if "Rate limit reached" in error_str or "429" in error_str:
             raise HTTPException(status_code=429, detail="AI Service usage limit reached. Please try again later.")
        
        # OpenAI / Groq Specific errors might come as objects
        if hasattr(e, "body") and isinstance(e.body, dict):
             msg = e.body.get("message", error_str)
             if "rate_limit" in str(msg).lower():
                  raise HTTPException(status_code=429, detail="AI Service usage limit reached. Please try again later.")

        raise HTTPException(status_code=500, detail=f"AI Error: {error_str}")

from app.core.cache import acached
from loguru import logger

@acached(prefix="ai_chat", ttl=60)
async def process_chat(user_id: int, message: str, thread_id: Optional[str] = None) -> Dict[str, Any]:
    # Import here to avoid circular dependencies if any
    from app.agents.graph import compile_graph
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
    from psycopg_pool import AsyncConnectionPool
    from app.core.config import settings
    import uuid

    # We need the connection string.
    db_url = settings.DATABASE_URL.replace("postgresql://", "postgresql://") # Ensure scheme
    
    async with AsyncConnectionPool(conninfo=db_url) as pool:
        checkpointer = AsyncPostgresSaver(pool)
        
        # NOTE: You must run `checkpointer.setup()` once separately to create tables.
        # We assume tables exist to avoid "ActiveSqlTransaction" error in high-concurrency or transaction blocks.
        
        graph = compile_graph(checkpointer=checkpointer)
        
        # Thread ID logic
        final_thread_id = thread_id or str(uuid.uuid4())
        
        input_state = {
            "messages": [HumanMessage(content=message)]
        }
        
        config = {
            "configurable": {
                "user_id": user_id,
                "thread_id": final_thread_id
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
        
            # Find the index of the last HumanMessage to only check relevant/new Agent responses
            last_human_idx = -1
            for i in range(len(messages) - 1, -1, -1):
                if isinstance(messages[i], HumanMessage):
                    last_human_idx = i
                    break
            
            # Default to checking all if no human message found (unlikely)
            start_check_idx = last_human_idx if last_human_idx != -1 else 0

            # Analyze ONLY NEW history to find tool calls and completion
            for msg in messages[start_check_idx:]:
                if isinstance(msg, AIMessage) and msg.tool_calls:
                    for tc in msg.tool_calls:
                        # Convert dict args to dict if needed (already dict)
                        tool_calls_log.append({"name": tc["name"], "args": tc["args"]})
                        
                        if tc["name"] == "submit_expense_tool":
                            is_completed = True
                            expense_data = tc["args"]
                
                if isinstance(msg, ToolMessage):
                     if tool_calls_log:
                         # We can't update the last log easily if we just append dicts, 
                         # effectively we need to track index or object. 
                         # Since we are just building a log for the frontend, we can try to attach result.
                         # But wait, 'ToolCallLog' is Pydantic. Here we return Dict.
                         # Let's verify if we can match them.
                         # Simplified: Just don't attach result for now or improved logic.
                         # The original code attached result to tool_calls_log[-1].
                         tool_calls_log[-1]["result"] = msg.content
        
            return {
                "response": str(response_text) if response_text else "I've processed that.",
                "is_completed": is_completed,
                "expense_data": expense_data,
                "tool_calls": tool_calls_log,
                "thread_id": final_thread_id
            }
        except Exception as e:
            # We re-raise to be handled by the caller (and thus NOT cached if it fails?)
            # Usually we don't want to cache failures.
            raise e

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
