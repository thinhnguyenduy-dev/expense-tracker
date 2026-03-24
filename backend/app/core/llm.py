from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_anthropic import ChatAnthropic
import httpx
from app.core.config import settings

from app.core.ai_logging import AILoggingCallbackHandler
from app.core.logging import get_logger

logger = get_logger()
_AUTO_MODEL_CACHE: str | None = None


def _resolve_openai_model_name() -> str:
    """Resolve model name for OpenAI-compatible providers.
    Priority:
    1) OPENAI_MODEL_NAME if explicitly set
    2) auto-discover from {OPENAI_API_BASE}/models
    """
    global _AUTO_MODEL_CACHE

    if settings.OPENAI_MODEL_NAME and settings.OPENAI_MODEL_NAME.strip():
        return settings.OPENAI_MODEL_NAME.strip()

    if _AUTO_MODEL_CACHE:
        return _AUTO_MODEL_CACHE

    if not settings.OPENAI_API_BASE or not settings.OPENAI_API_KEY:
        raise ValueError(
            "OPENAI_MODEL_NAME is not set, and auto-discovery requires OPENAI_API_BASE and OPENAI_API_KEY."
        )

    models_url = f"{settings.OPENAI_API_BASE.rstrip('/')}/models"
    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.get(
                models_url,
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
            )
            resp.raise_for_status()
            payload = resp.json()
    except Exception as e:
        raise ValueError(
            f"OPENAI_MODEL_NAME is not set and auto-discovery from {models_url} failed: {e}"
        ) from e

    data = payload.get("data", [])
    model_ids = [item.get("id") for item in data if isinstance(item, dict) and item.get("id")]
    if not model_ids:
        raise ValueError(f"OPENAI_MODEL_NAME is not set and no models returned from {models_url}.")

    preferred = ["gpt-5.4", "gpt-5.3-codex", "gpt-5.1", "gpt-5"]
    selected = next((m for m in preferred if m in model_ids), model_ids[0])
    _AUTO_MODEL_CACHE = selected
    logger.info(f"Auto-selected OpenAI model: {selected}")
    return selected

def get_llm(temperature: float = 0):
    """
    Factory function to return the configured LLM based on AI_PROVIDER settings.
    """
    provider = settings.AI_PROVIDER.lower()
    callbacks = [AILoggingCallbackHandler()]
    
    if provider == "google":
        if not settings.GOOGLE_API_KEY:
            raise ValueError("GOOGLE_API_KEY is not set.")
        model_name = settings.GOOGLE_MODEL_NAME
        
        # Langchain's ChatGoogleGenerativeAI relies on generateContent
        # Models with "-native-audio-" usually only support bidiGenerateContent (Live API via WebSockets)
        # Here we intelligently fallback to the standard flash model to prevent 404/NOT_FOUND crashes 
        # while using the text-based Chat UI.
        if "native-audio" in model_name:
            logger.warning(f"Model '{model_name}' does not support generateContent via REST. Falling back to 'gemini-2.5-flash'.")
            model_name = "gemini-2.5-flash"
            
        return ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=settings.GOOGLE_API_KEY,
            temperature=temperature,
            max_retries=3,
            convert_system_message_to_human=True, # Required for some models, safer to keep on
            callbacks=callbacks
        )
        
    elif provider == "anthropic":
        if not settings.ANTHROPIC_API_KEY:
            raise ValueError("ANTHROPIC_API_KEY is not set.")
        return ChatAnthropic(
            model=settings.ANTHROPIC_MODEL_NAME,
            api_key=settings.ANTHROPIC_API_KEY,
            temperature=temperature,
            callbacks=callbacks
        )
        
    elif provider == "groq":
        # Groq is compatible with ChatOpenAI client
        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is not set (required for Groq).")
        return ChatOpenAI(
            model=_resolve_openai_model_name(),
            api_key=settings.OPENAI_API_KEY,
            base_url="https://api.groq.com/openai/v1",
            temperature=temperature,
            callbacks=callbacks
        )

    # Default to OpenAI
    return ChatOpenAI(
        model=_resolve_openai_model_name(),
        api_key=settings.OPENAI_API_KEY,
        base_url=settings.OPENAI_API_BASE,
        temperature=temperature,
        callbacks=callbacks
    )
