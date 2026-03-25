from typing import Any, Dict, List, Union
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.messages import BaseMessage
from langchain_core.outputs import LLMResult
from app.core.logging import get_logger

logger = get_logger()

class AILoggingCallbackHandler(BaseCallbackHandler):
    """Callback Handler that logs Chain and Tool events cleanly."""

    def on_chain_start(
        self, serialized: Dict[str, Any], inputs: Dict[str, Any], **kwargs: Any
    ) -> None:
        """Run when chain starts running."""
        if not serialized:
            return
        name = serialized.get("name", "")
        if name in ["supervisor", "financial_agent", "general_agent", "data_analyst", "financial_tools"]:
            print(f"\n👉 [NODE CHẠY] Đang xử lý: {name}...")

    def on_tool_start(
        self, serialized: Dict[str, Any], input_str: str, **kwargs: Any
    ) -> None:
        """Run when tool starts running."""
        if not serialized:
            return
        name = serialized.get("name", "Unknown Tool")
        print(f"\n🛠️ [TOOL CHẠY] Gọi công cụ: {name} | Tham số: {input_str.strip()}")

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
