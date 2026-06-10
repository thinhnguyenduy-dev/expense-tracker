"""Message-history helpers shared across agent nodes."""

from langchain_core.messages import AIMessage, BaseMessage, SystemMessage, ToolMessage

MAX_CONTEXT_MESSAGES = 20


def trim_messages(
    messages: list[BaseMessage], max_messages: int = MAX_CONTEXT_MESSAGES
) -> list[BaseMessage]:
    """Keep only the last N messages to prevent context overflow.

    A leading SystemMessage is always preserved so the model never loses its
    instructions when the tail is trimmed.
    """
    if len(messages) <= max_messages:
        return messages

    if messages and isinstance(messages[0], SystemMessage):
        return [messages[0], *messages[-(max_messages - 1):]]
    return messages[-max_messages:]


def sanitize_messages_for_model(messages: list[BaseMessage]) -> list[BaseMessage]:
    """Remove dangling tool-call segments.

    These would otherwise trigger an OpenAI invalid_request_error:
    "No tool output found for function call ...". A tool-call turn is kept only
    when every call id has a matching ToolMessage output.
    """
    cleaned: list[BaseMessage] = []
    i = 0
    n = len(messages)
    while i < n:
        m = messages[i]

        if isinstance(m, AIMessage):
            tool_calls = getattr(m, "tool_calls", None) or []
            invalid_tool_calls = getattr(m, "invalid_tool_calls", None) or []
            finish_reason = (getattr(m, "response_metadata", None) or {}).get("finish_reason")

            if invalid_tool_calls or (finish_reason == "tool_calls" and not tool_calls):
                i += 1
                while i < n and isinstance(messages[i], ToolMessage):
                    i += 1
                continue

            if not tool_calls:
                cleaned.append(m)
                i += 1
                continue
            call_ids = [tc.get("id") for tc in tool_calls if isinstance(tc, dict) and tc.get("id")]

            j = i + 1
            tool_msgs: list[ToolMessage] = []
            while j < n and isinstance(messages[j], ToolMessage):
                tool_msgs.append(messages[j])
                j += 1

            tool_msg_ids = {getattr(tm, "tool_call_id", None) for tm in tool_msgs}

            # Keep the tool-call turn only when every call id has a corresponding tool output.
            if call_ids and all(cid in tool_msg_ids for cid in call_ids):
                cleaned.append(m)
                cleaned.extend(tool_msgs)
            # else: drop incomplete tool call segment silently

            i = j
            continue

        cleaned.append(m)
        i += 1

    return cleaned
