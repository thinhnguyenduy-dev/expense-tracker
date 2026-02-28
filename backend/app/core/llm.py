from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_anthropic import ChatAnthropic
from app.core.config import settings

from app.core.ai_logging import AILoggingCallbackHandler

def get_llm(temperature: float = 0):
    """
    Factory function to return the configured LLM based on AI_PROVIDER settings.
    """
    provider = settings.AI_PROVIDER.lower()
    callbacks = [AILoggingCallbackHandler()]
    
    if provider == "google":
        if not settings.GOOGLE_API_KEY:
            raise ValueError("GOOGLE_API_KEY is not set.")
        return ChatGoogleGenerativeAI(
            model=settings.GOOGLE_MODEL_NAME,
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
            model=settings.OPENAI_MODEL_NAME, # e.g. llama-3.3-70b-versatile
            api_key=settings.OPENAI_API_KEY,
            base_url="https://api.groq.com/openai/v1",
            temperature=temperature,
            callbacks=callbacks
        )

    # Default to OpenAI
    return ChatOpenAI(
        model=settings.OPENAI_MODEL_NAME,
        api_key=settings.OPENAI_API_KEY,
        base_url=settings.OPENAI_API_BASE,
        temperature=temperature,
        callbacks=callbacks
    )
