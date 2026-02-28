from typing import Any, Dict, List, Union
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.messages import BaseMessage
from langchain_core.outputs import LLMResult
from app.core.logging import get_logger

logger = get_logger()

class AILoggingCallbackHandler(BaseCallbackHandler):
    """Callback Handler that logs LLM requests and responses."""

    def on_llm_start(
        self, serialized: Dict[str, Any], prompts: List[str], **kwargs: Any
    ) -> None:
        """Run when LLM starts running."""
        # For Chat models, 'prompts' might be empty or stringified messages.
        # But usually 'messages' are passed in kwargs['invocation_params'] or similar depending on provider.
        # LangChain's on_llm_start signature provides 'prompts'.
        # For ChatOpenAI, 'prompts' is a list of strings (often just the system prompt if not formatted).
        # We try to extract messages if available.
        
        # NOTE: With ChatModels, on_chat_model_start is usually called instead.
        if prompts:
            logger.debug(f"🤖 AI Request (Legacy/LLM): {prompts}")

    def on_chat_model_start(
        self, serialized: Dict[str, Any], messages: List[List[BaseMessage]], **kwargs: Any
    ) -> None:
        """Run when Chat Model starts running."""
        # messages is a list of lists of messages (for batching). usually just one list.
        for i, batch in enumerate(messages):
            formatted_messages = []
            for msg in batch:
                content = msg.content
                # Truncate if too long? User wants to see request. Let's keep it reasonable.
                # But for debugging "which request", full content is often needed.
                # Use repr or just str.
                formatted_messages.append(f"{msg.type}: {content}")
            
            logger.info(f"🤖 AI Request Batch {i}: {formatted_messages}")

    def on_llm_end(self, response: LLMResult, **kwargs: Any) -> None:
        """Run when LLM ends running."""
        # Log response if needed. User asked for "request", but response is useful too.
        # response.generations is a list of lists of Generation
        if response.generations:
             text = response.generations[0][0].text
             logger.debug(f"🤖 AI Response: {text[:200]}...") # Truncate response to avoid noise

    def on_llm_error(self, error: Union[Exception, KeyboardInterrupt], **kwargs: Any) -> None:
        """Run when LLM errors."""
        logger.error(f"❌ AI Error: {error}")
