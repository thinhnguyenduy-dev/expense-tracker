import json
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel
from sqlalchemy.orm import Session
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage

from app.core import deps
from app.models.user import User

router = APIRouter()

AI_USAGE_LIMIT_MESSAGE = "AI Service usage limit reached. Please try again later."

class ChatRequest(BaseModel):
    message: str
    thread_id: Optional[str] = None
    history: Optional[List[Dict[str, Any]]] = None
    is_resume: bool = False  # True when user is answering a clarification question

class ToolCallLog(BaseModel):
    name: str
    args: Dict[str, Any]
    result: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    is_completed: bool = False
    expense_data: Optional[Union[Dict[str, Any], List[Dict[str, Any]]]] = None
    income_data: Optional[Dict[str, Any]] = None
    tool_calls: List[ToolCallLog] = []
    thread_id: Optional[str] = None
    needs_clarification: bool = False  # True when graph is paused waiting for user input


def _ai_provider_error_text(error: Exception) -> str:
    """Collect provider error text from common SDK exception shapes."""
    parts = [str(error)]
    for attr in ("body", "response"):
        value = getattr(error, attr, None)
        if value:
            parts.append(str(value))
    return "\n".join(parts)


def _is_ai_usage_limit_error(error: Exception) -> bool:
    """Return True for rate-limit or provider risk-control blocks."""
    error_text = _ai_provider_error_text(error).lower()
    return any(
        marker in error_text
        for marker in (
            "rate limit reached",
            "rate_limit",
            "429",
            "risk_control",
            '"code": "441"',
            "'code': '441'",
            "high-frequency non-compliant",
        )
    )

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
        
        result = await process_chat(current_user.id, request.message, request.thread_id, request.is_resume)
        
        return ChatResponse(**result)

    except Exception as e:
        error_str = str(e)
        logger.error(f"AI Agent Error: {error_str}") # Log for debug

        if _is_ai_usage_limit_error(e):
            raise HTTPException(status_code=429, detail=AI_USAGE_LIMIT_MESSAGE)

        raise HTTPException(status_code=500, detail=f"AI Error: {error_str}")

from app.core.cache import acached
from loguru import logger


def _thread_belongs_to(thread_id: Optional[str], user_id: int) -> bool:
    """Threads are namespaced as ``<user_id>:<uuid>``. A thread belongs to a user
    only when that prefix matches the requester. This is the check that stops user B
    from reading user A's chat by reusing or guessing a thread_id — the checkpointer
    itself keys only on thread_id and has no concept of ownership.
    """
    return bool(thread_id) and thread_id.split(":", 1)[0] == str(user_id)


def _extract_text(content) -> str:
    """Flatten a message's content (str, or list of text/parts) into plain text."""
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict) and "text" in item:
                parts.append(item["text"])
            elif isinstance(item, str):
                parts.append(item)
        return "\n".join(parts) if parts else str(content)
    return str(content)


def _format_chat_history(messages) -> List[Dict[str, str]]:
    """Turn stored LangChain messages into [{role, content}] for the chat UI.

    Tool/system messages are skipped — only the user/agent turns are shown.
    """
    out: List[Dict[str, str]] = []
    for msg in messages:
        if isinstance(msg, AIMessage):
            role = "agent"
        elif isinstance(msg, HumanMessage):
            role = "user"
        else:
            continue
        out.append({"role": role, "content": _extract_text(msg.content)})
    return out


def _clarification_result(interrupt_value, final_thread_id: str) -> Dict[str, Any]:
    """Shape the response when the graph paused on a clarification interrupt."""
    question = (
        interrupt_value.get("question")
        if isinstance(interrupt_value, dict)
        else str(interrupt_value)
    )
    return {
        "response": question,
        "is_completed": False,
        "needs_clarification": True,
        "expense_data": None,
        "income_data": None,
        "tool_calls": [],
        "thread_id": final_thread_id,
    }


def _assemble_result(messages, final_thread_id: str, user_lang: str) -> Dict[str, Any]:
    """Build the structured chat response from a completed graph's messages.

    Shared by the non-streaming (`ainvoke`) and streaming (`astream`) paths so
    both produce an identical `ChatResponse` shape — only the delivery differs.
    """
    last_message = messages[-1]

    # Index of the last HumanMessage — agent output produced THIS turn lives after it.
    last_human_idx = -1
    for i in range(len(messages) - 1, -1, -1):
        if isinstance(messages[i], HumanMessage):
            last_human_idx = i
            break

    if isinstance(last_message, HumanMessage):
        # The graph returned without any agent output. To avoid echoing
        # the user, provide a localized fallback response.
        response_text = (
            "Mình luôn sẵn sàng giúp bạn! Bạn có thể yêu cầu mình thêm khoản chi, kiểm tra ngân sách hoặc phân tích thói quen chi tiêu của bạn."
            if user_lang == "vi"
            else "I'm always here to help! You can ask me to add an expense, check your budget, or analyze your spending habits."
        )
    else:
        # Concatenate every user-facing AI answer produced this turn,
        # not just the last message, so no useful text is dropped.
        # Skip messages that only carry tool_calls (no user-facing text).
        answer_parts: list[str] = []
        for msg in messages[last_human_idx + 1:]:
            if isinstance(msg, AIMessage) and not getattr(msg, "tool_calls", None):
                text = _extract_text(msg.content).strip()
                if text and (not answer_parts or answer_parts[-1] != text):
                    answer_parts.append(text)
        response_text = (
            "\n\n".join(answer_parts) if answer_parts
            else _extract_text(last_message.content)
        )

    is_completed = False
    expense_list: list[dict] = []   # collect all submit_expense_tool calls
    income_data = None
    tool_calls_log = []

    # Default to checking all if no human message found (unlikely)
    start_check_idx = last_human_idx if last_human_idx != -1 else 0

    # Analyze ONLY NEW history to find tool calls and completion
    # Maps tool_call_id → tool args for resolving category_id from tool result
    pending_expense_tool_calls: dict[str, dict] = {}

    for msg in messages[start_check_idx:]:
        if isinstance(msg, AIMessage) and msg.tool_calls:
            for tc in msg.tool_calls:
                tool_calls_log.append({"name": tc["name"], "args": tc["args"]})

                if tc["name"] == "submit_expense_tool":
                    pending_expense_tool_calls[tc["id"]] = tc["args"]

                elif tc["name"] == "submit_income_tool":
                    is_completed = True
                    income_data = tc["args"]

        if isinstance(msg, ToolMessage):
            if tool_calls_log:
                tool_calls_log[-1]["result"] = str(msg.content)

            # Resolve category_id from the tool's JSON return value
            call_id = getattr(msg, "tool_call_id", None)
            if call_id and call_id in pending_expense_tool_calls:
                args = pending_expense_tool_calls[call_id]
                try:
                    payload = json.loads(str(msg.content))
                except (ValueError, TypeError):
                    payload = {}
                if payload.get("status") == "draft_created":
                    # Prefer the tool's echoed values: for a foreign-currency
                    # expense the tool converted amount/currency and rewrote the
                    # description, so the original args are stale.
                    expense_list.append({
                        **args,
                        "category": payload.get("category") or args.get("category"),
                        "category_id": payload.get("category_id"),
                        "amount": payload.get("amount", args.get("amount")),
                        "currency": payload.get("currency", args.get("currency")),
                        "description": payload.get("description", args.get("description")),
                    })
                    is_completed = True
                del pending_expense_tool_calls[call_id]

    # Normalise: single expense keeps backward-compat shape; multi returns list
    if len(expense_list) == 1:
        expense_data = expense_list[0]
    elif len(expense_list) > 1:
        expense_data = expense_list  # type: ignore[assignment]
    else:
        expense_data = None

    return {
        "response": str(response_text) if response_text else "I've processed that.",
        "is_completed": is_completed,
        "needs_clarification": False,
        "expense_data": expense_data,
        "income_data": income_data,
        "tool_calls": tool_calls_log,
        "thread_id": final_thread_id,
    }


# @acached(prefix="ai_chat", ttl=60)
async def process_chat(user_id: int, message: str, thread_id: Optional[str] = None, is_resume: bool = False) -> Dict[str, Any]:
    # Import here to avoid circular dependencies if any
    from app.agents.agent import compile_graph
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
    from langgraph.types import Command
    from psycopg_pool import AsyncConnectionPool
    from app.core.config import settings
    from app.core.database import SessionLocal
    from app.models.user import User
    from app.models.category import Category
    import uuid

    # We need the connection string.
    db_url = settings.DATABASE_URL.replace("postgresql://", "postgresql://") # Ensure scheme
    
    # Fetch user preferences and categories
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        user_lang = user.language if user else "vi"
        user_currency = user.currency if user else "VND"
        
        # Fetch categories once here instead of via tool
        categories = db.query(Category).filter(Category.user_id == user_id).all()
        category_list = [c.name for c in categories] if categories else []
    finally:
        db.close()
    
    async with AsyncConnectionPool(conninfo=db_url) as pool:
        checkpointer = AsyncPostgresSaver(pool)
        
        # NOTE: You must run `checkpointer.setup()` once separately to create tables.
        # We assume tables exist to avoid "ActiveSqlTransaction" error in high-concurrency or transaction blocks.
        
        graph = compile_graph(
            checkpointer=checkpointer,
            user_id=user_id,
            user_currency=user_currency,
            categories=category_list,
            user_lang=user_lang,
        )

        # Thread ID logic — namespace every thread by user and NEVER continue a
        # thread owned by someone else (a stale/forged thread_id from another user
        # is discarded, so the new turn starts a fresh, owned thread).
        if thread_id and not _thread_belongs_to(thread_id, user_id):
            logger.warning(f"thread_id {thread_id!r} not owned by user {user_id} — starting a new thread")
            thread_id = None
        final_thread_id = thread_id or f"{user_id}:{uuid.uuid4()}"

        from app.core.ai_logging import AILoggingCallbackHandler
        config = {
            "configurable": {
                "user_id": user_id,
                "thread_id": final_thread_id,
                "user_lang": user_lang,
                "user_currency": user_currency,
                "categories": category_list,  # Pass categories to agents
            },
            "callbacks": [AILoggingCallbackHandler()],
            "recursion_limit": 12
        }
        
        try:
            # Decide how to feed this turn into the graph. We ALWAYS check whether
            # the thread is actually paused on an interrupt — never trust the
            # `is_resume` flag alone, because it can be stale or wrong:
            #   • is_resume=True but NOT paused — the model asked its question in
            #     plain text (no interrupt fired). Treat as a normal turn; history
            #     carries the context.
            #   • is_resume=False but STILL paused — the user ignored the pending
            #     question and typed something new. If we just sent a HumanMessage,
            #     the pending interrupt would re-fire and re-ask forever. So we
            #     ABANDON the stale interrupt (delete the thread) and start fresh.
            # Single ReAct agent uses a messages-only state — no per-turn routing
            # bookkeeping to reset.
            fresh_turn = {"messages": [HumanMessage(content=message)]}
            snapshot = await graph.aget_state(config)
            paused = bool(getattr(snapshot, "interrupts", None))

            if paused and is_resume:
                # User is answering the clarification → resume from the interrupt.
                input_state = Command(resume=message)
            elif paused and not is_resume:
                # User walked away from the question → drop the paused thread so the
                # interrupt can't re-fire, then process the new message cleanly.
                # NOTE: this clears the thread's history too (LangGraph has no
                # surgical "cancel one interrupt"); acceptable since the user
                # explicitly abandoned that flow.
                logger.info(f"Abandoning stale interrupt on thread {final_thread_id}")
                await checkpointer.adelete_thread(final_thread_id)
                input_state = fresh_turn
            else:
                input_state = fresh_turn

            final_state = await graph.ainvoke(input_state, config=config)

            # Detect human-in-the-loop pause: the graph hit interrupt() and is
            # waiting for the user's answer to a clarification question.
            if final_state.get("__interrupt__"):
                return _clarification_result(
                    final_state["__interrupt__"][0].value, final_thread_id
                )

            return _assemble_result(final_state["messages"], final_thread_id, user_lang)
        except Exception as e:
            from langgraph.errors import GraphRecursionError
            if isinstance(e, GraphRecursionError):
                return {
                    "response": (
                        "Xin lỗi, yêu cầu quá phức tạp để xử lý. Vui lòng thử lại với câu hỏi đơn giản hơn."
                        if user_lang == "vi"
                        else "Sorry, that request is too complex to process. Please try again with a simpler question."
                    ),
                    "is_completed": False,
                    "expense_data": None,
                    "income_data": None,
                    "tool_calls": [],
                    "thread_id": final_thread_id
                }
            raise e


def _sse(obj: Dict[str, Any]) -> str:
    """Encode a dict as a single Server-Sent Events `data:` frame."""
    return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"


async def stream_chat(user_id: int, message: str, thread_id: Optional[str] = None, is_resume: bool = False):
    """Streaming twin of `process_chat`.

    Yields SSE frames as the agent works:
      • `{"type": "meta", "thread_id": ...}`   — sent first so the client can persist it
      • `{"type": "token", "content": "..."}`  — incremental answer tokens (live typing)
      • `{"type": "done", ...ChatResponse...}`  — the SAME structured payload the
        non-streaming endpoint returns (expense_data, tool_calls, clarification, …)
      • `{"type": "error", "detail": ...}`      — on failure

    Token frames are a live preview only; the client should replace the preview with
    `done.response`, which is assembled identically to `process_chat` so the two
    endpoints never diverge.
    """
    from app.agents.agent import compile_graph
    from langchain_core.messages import AIMessageChunk
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
    from langgraph.types import Command
    from langgraph.errors import GraphRecursionError
    from psycopg_pool import AsyncConnectionPool
    from app.core.config import settings
    from app.core.database import SessionLocal
    from app.models.user import User
    from app.models.category import Category
    import uuid

    db_url = settings.DATABASE_URL.replace("postgresql://", "postgresql://")

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        user_lang = user.language if user else "vi"
        user_currency = user.currency if user else "VND"
        categories = db.query(Category).filter(Category.user_id == user_id).all()
        category_list = [c.name for c in categories] if categories else []
    finally:
        db.close()

    # Resolve the thread id up front so every frame (incl. early errors) can carry it.
    if thread_id and not _thread_belongs_to(thread_id, user_id):
        logger.warning(f"thread_id {thread_id!r} not owned by user {user_id} — starting a new thread")
        thread_id = None
    final_thread_id = thread_id or f"{user_id}:{uuid.uuid4()}"

    # IMPORTANT: everything that can fail — pool open, graph build (schema reflection,
    # search-tool init), and the agent run — lives inside this try so a failure ALWAYS
    # emits a terminal `error`/`done` frame. Otherwise an exception before the first
    # `yield` would close the SSE stream with zero frames and the client would hang on
    # a spinner forever.
    try:
        async with AsyncConnectionPool(conninfo=db_url) as pool:
            checkpointer = AsyncPostgresSaver(pool)
            graph = compile_graph(
                checkpointer=checkpointer,
                user_id=user_id,
                user_currency=user_currency,
                categories=category_list,
                user_lang=user_lang,
            )

            from app.core.ai_logging import AILoggingCallbackHandler
            config = {
                "configurable": {
                    "user_id": user_id,
                    "thread_id": final_thread_id,
                    "user_lang": user_lang,
                    "user_currency": user_currency,
                    "categories": category_list,
                },
                "callbacks": [AILoggingCallbackHandler()],
                "recursion_limit": 12,
            }

            yield _sse({"type": "meta", "thread_id": final_thread_id})

            # Same resume/abandon logic as process_chat (see there for the rationale).
            fresh_turn = {"messages": [HumanMessage(content=message)]}
            snapshot = await graph.aget_state(config)
            paused = bool(getattr(snapshot, "interrupts", None))

            if paused and is_resume:
                input_state = Command(resume=message)
            elif paused and not is_resume:
                logger.info(f"Abandoning stale interrupt on thread {final_thread_id}")
                await checkpointer.adelete_thread(final_thread_id)
                input_state = fresh_turn
            else:
                input_state = fresh_turn

            # Stream LLM tokens as they are generated. `stream_mode="messages"` yields
            # (chunk, metadata); we forward only AI text deltas. Tool-call deltas carry
            # no `.content`, so they're naturally skipped here.
            async for chunk, _meta in graph.astream(input_state, config=config, stream_mode="messages"):
                if isinstance(chunk, AIMessageChunk):
                    text = _extract_text(chunk.content)
                    if text:
                        yield _sse({"type": "token", "content": text})

            # Stream finished — read the authoritative final state and assemble the
            # structured payload exactly like process_chat.
            snapshot = await graph.aget_state(config)
            if getattr(snapshot, "interrupts", None):
                yield _sse({"type": "done", **_clarification_result(snapshot.interrupts[0].value, final_thread_id)})
                return

            result = _assemble_result(snapshot.values["messages"], final_thread_id, user_lang)
            yield _sse({"type": "done", **result})
    except GraphRecursionError:
        yield _sse({
            "type": "done",
            "response": (
                "Xin lỗi, yêu cầu quá phức tạp để xử lý. Vui lòng thử lại với câu hỏi đơn giản hơn."
                if user_lang == "vi"
                else "Sorry, that request is too complex to process. Please try again with a simpler question."
            ),
            "is_completed": False,
            "needs_clarification": False,
            "expense_data": None,
            "income_data": None,
            "tool_calls": [],
            "thread_id": final_thread_id,
        })
    except Exception as e:
        logger.error(f"AI Agent stream error: {e}")
        detail = AI_USAGE_LIMIT_MESSAGE if _is_ai_usage_limit_error(e) else f"AI Error: {e}"
        yield _sse({"type": "error", "detail": detail, "thread_id": final_thread_id})


@router.post("/agent/chat/stream")
async def chat_with_agent_stream(
    request: ChatRequest,
    current_user: User = Depends(deps.get_current_user),
):
    """Streaming variant of `/agent/chat` — returns an SSE token stream.

    Same auth and request shape as the non-streaming endpoint; the response is a
    `text/event-stream` of token frames followed by a final `done` frame carrying
    the full structured payload.
    """
    from fastapi.responses import StreamingResponse

    return StreamingResponse(
        stream_chat(current_user.id, request.message, request.thread_id, request.is_resume),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # disable nginx proxy buffering so tokens flush live
        },
    )


@router.get("/agent/history/{thread_id}", response_model=List[Dict[str, Any]])
async def get_chat_history(
    thread_id: str,
    current_user: User = Depends(deps.get_current_user),
):
    """
    Retrieve chat history for a specific thread.
    """
    from app.agents.agent import compile_graph
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
    from psycopg_pool import AsyncConnectionPool
    from app.core.config import settings

    # Ownership check — never return a thread that doesn't belong to this user.
    # Without this, anyone could read another user's chat by passing their thread_id.
    if not _thread_belongs_to(thread_id, current_user.id):
        logger.warning(f"User {current_user.id} requested history for foreign thread {thread_id!r} — denied")
        return []

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

        return _format_chat_history(snapshot.values.get("messages", []))


@router.get("/agent/threads/latest", response_model=Dict[str, Any])
async def get_latest_thread(
    current_user: User = Depends(deps.get_current_user),
):
    """Return the user's MOST RECENT chat thread (id + formatted history).

    Used on login to restore the last conversation. Threads are namespaced as
    ``<user_id>:<uuid>``, so we find this user's latest by filtering checkpoints on
    their prefix only — never touching another user's threads. `checkpoint_id` is
    time-sortable, so MAX(checkpoint_id) per thread gives the most recent.
    """
    from sqlalchemy import text
    from app.core.database import engine
    from app.agents.agent import compile_graph
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
    from psycopg_pool import AsyncConnectionPool
    from app.core.config import settings

    with engine.connect() as conn:
        row = conn.execute(
            text(
                "SELECT thread_id FROM checkpoints WHERE thread_id LIKE :prefix "
                "GROUP BY thread_id ORDER BY MAX(checkpoint_id) DESC LIMIT 1"
            ),
            {"prefix": f"{current_user.id}:%"},
        ).fetchone()

    if not row:
        return {"thread_id": None, "history": []}

    thread_id = row[0]
    async with AsyncConnectionPool(conninfo=settings.DATABASE_URL) as pool:
        graph = compile_graph(checkpointer=AsyncPostgresSaver(pool))
        snapshot = await graph.aget_state(
            {"configurable": {"user_id": current_user.id, "thread_id": thread_id}}
        )

    messages = snapshot.values.get("messages", []) if snapshot.values else []
    return {"thread_id": thread_id, "history": _format_chat_history(messages)}
