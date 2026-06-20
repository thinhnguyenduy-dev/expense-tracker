from typing import Any, Dict, List, Union
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.messages import BaseMessage
from langchain_core.outputs import LLMResult
from app.core.logging import app_logger as logger

class AILoggingCallbackHandler(BaseCallbackHandler):
    """Callback Handler that logs Chain and Tool events cleanly."""

    def __init__(self) -> None:
        super().__init__()
        # run_id → tool name, so on_tool_end/on_tool_error can name the tool.
        self._tool_names: Dict[Any, str] = {}

    @staticmethod
    def _tool_name(serialized: Dict[str, Any], kwargs: Dict[str, Any]) -> str:
        return (serialized or {}).get("name") or kwargs.get("name") or "Unknown Tool"

    def on_chain_start(
        self, serialized: Dict[str, Any], inputs: Dict[str, Any], **kwargs: Any
    ) -> None:
        """Run when chain starts running."""
        if not serialized:
            return
        name = serialized.get("name", "")
        if name in ["supervisor", "financial_agent", "general_agent", "data_analyst", "financial_tools"]:
            print(f"\n👉 [NODE] Running: {name}...")

    def on_tool_start(
        self, serialized: Dict[str, Any], input_str: str, **kwargs: Any
    ) -> None:
        """Run when tool starts running."""
        name = self._tool_name(serialized, kwargs)
        run_id = kwargs.get("run_id")
        if run_id is not None:
            self._tool_names[run_id] = name
        params = (input_str or "").strip()
        print(f"\n🛠️ [TOOL START] {name} | Args: {params}")

    def on_tool_end(self, output: Any, **kwargs: Any) -> None:
        """Run when a tool finishes — log which tool and its result."""
        name = self._tool_names.pop(kwargs.get("run_id"), None) or self._tool_name({}, kwargs)
        # `output` may be a ToolMessage or a raw value.
        result = str(getattr(output, "content", output))
        if len(result) > 500:
            result = result[:500] + "…"
        print(f"\n✅ [TOOL END] {name} | Result: {result}")

    def on_tool_error(self, error: Union[Exception, KeyboardInterrupt], **kwargs: Any) -> None:
        """Run when a tool raises — log which tool failed.

        A GraphInterrupt is NOT an error: it's how `interrupt()` (human-in-the-loop)
        pauses the graph to wait for the user. Log it as a pause, not a failure.
        """
        name = self._tool_names.pop(kwargs.get("run_id"), None) or self._tool_name({}, kwargs)
        from langgraph.errors import GraphInterrupt
        if isinstance(error, GraphInterrupt):
            payload = error.args[0] if error.args else error
            question = None
            try:
                question = payload[0].value.get("question")
            except (AttributeError, IndexError, TypeError):
                pass
            print(f"\n⏸️ [TOOL PAUSE] {name} | waiting for user: {question or payload}")
            return
        print(f"\n❌ [TOOL LỖI] {name} | {error}")

    def on_llm_start(
        self, serialized: Dict[str, Any], prompts: List[str], **kwargs: Any
    ) -> None:
        pass

    def on_chat_model_start(
        self, serialized: Dict[str, Any], messages: List[List[BaseMessage]], **kwargs: Any
    ) -> None:
        pass

    def on_llm_end(self, response: LLMResult, **kwargs: Any) -> None:
        pass

    def on_llm_error(self, error: Union[Exception, KeyboardInterrupt], **kwargs: Any) -> None:
        logger.error(f"❌ AI Error: {error}")
