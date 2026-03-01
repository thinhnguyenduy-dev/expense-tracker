from typing import Literal, Annotated, TypedDict, Optional
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langgraph.graph import StateGraph, END, START
from langgraph.prebuilt import ToolNode
from langchain_core.runnables import RunnableConfig
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, AIMessage

from app.agents.state import AgentState
from app.agents.tools import make_tools
from app.core.config import settings
from app.agents.analyst import get_analyst_agent
from app.core.logging import get_logger

from app.core.llm import get_llm

logger = get_logger()

# --- Supervisor Node ---
def supervisor_node(state: AgentState):
    """
    Decides which agent to route to.
    """
    logger.debug("Entering supervisor_node")
    messages = state["messages"]
    
    model = get_llm(temperature=0)
    system_prompt = (
        "You are a supervisor for a Financial App. Your goal is to route the conversation or finish it.\n"
        "WORKERS:\n"
        "1. `financial_agent`: For creating/logging expenses and incomes, checking budget health, and transactional queries.\n"
        "2. `data_analyst`: For complex analysis, SQL queries, and external web search.\n"
        "3. `general_agent`: For general greetings, small talk, and non-financial questions.\n"
        "\n"
        "CRITICAL ROUTING RULES:\n"
        "- **RELEVANCY FILTER**: If the user asks about topics completely unrelated to finance, expense tracking, or this app (e.g., general history, coding, science, sports), you MUST respond with FINISH and a polite refusal. Do NOT route to `general_agent` for random topics. `general_agent` is ONLY for greetings and politeness.\n"
        "- If the last message is from an AI agent and it answers the user's question (e.g., 'Draft created', 'Here is the data'), you MUST respond with FINISH.\n"
        "- Do NOT route back to the same agent immediately unless the user has asked a NEW follow-up question.\n"
        "- If the user's request is satisfied, respond with FINISH."
    )
    
    # Use standard tool calling for compatibility with Groq/Llama
    from pydantic import BaseModel, Field
    
    class RouterResponse(BaseModel):
        """Select the next agent to handle the request."""
        next: Literal["financial_agent", "data_analyst", "general_agent", "FINISH"] = Field(
            description="The next worker to act. Use 'FINISH' if user is satisfied."
        )
        reason: Optional[str] = Field(
            default=None, 
            description="The final message to the user if returning FINISH (e.g., answer, refusal, or clarification)."
        )

    logger.debug(f"Supervisor State Messages Count: {len(messages)}")
    if messages:
        last_msg = messages[-1]
        logger.debug(f"Last Message Role: {last_msg.type}")
        logger.debug(f"Last Message Content: {str(last_msg.content)[:100]}...")
        
        # CRITICAL FIX: Force stop if the last message was from an AI
        # This prevents the Supervisor from routing an AI's answer back to an AI
        if last_msg.type == "ai":
             logger.debug("Last message was from AI. Forcing FINISH.")
             return {"next": "FINISH"}

        if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
             logger.debug(f"Last Message Tool Calls: {last_msg.tool_calls}")

    # Bind the tool and force it
    model_with_tool = model.bind_tools([RouterResponse], tool_choice="RouterResponse")
    
    # We pass the last few messages to context
    logger.debug("Invoking Supervisor Model...")
    try:
        response = model_with_tool.invoke([
            SystemMessage(content=system_prompt),
            *messages[-5:] # Context window
        ])
        logger.debug(f"Supervisor Response Tool Calls: {response.tool_calls}")
    except Exception as e:
        logger.debug(f"Supervisor invocation failed: {e}")
        return {"next": "FINISH"}
    
    # Extract decision
    to_return = {}
    if response.tool_calls:
        # Standard tool call extraction
        args = response.tool_calls[0]["args"]
        next_node = args.get("next")
        reason = args.get("reason")
        logger.debug(f"Supervisor Decided: {next_node}, Reason: {reason}")
        
        if reason:
            # Add the reasoning as an AIMessage so the UI sees it
            to_return["messages"] = [AIMessage(content=reason)]
            
    else:
        # Fallback if model just chats
        logger.debug("Supervisor made no decision (no tool call)")
        next_node = "FINISH"
    
    to_return["next"] = next_node
    return to_return

# --- Financial Agent ---
def financial_agent_node(state: AgentState, config: RunnableConfig):
    logger.debug("Entering financial_agent_node")
    user_id = config.get("configurable", {}).get("user_id")
    user_lang = config.get("configurable", {}).get("user_lang", "vi")
    user_currency = config.get("configurable", {}).get("user_currency", "VND")
    logger.debug(f"User ID: {user_id}, Lang: {user_lang}, Currency: {user_currency}")
    tools = make_tools(user_id)
    
    logger.debug("Binding tools...")
    model = get_llm(temperature=0).bind_tools(tools)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a helpful Financial Assistant. Extract expense and income details, check budgets, provide monthly summaries, and submit drafts. Current Date: {date}. IMPORTANT: Always respond in the user's preferred language: {user_lang}. All monetary amounts MUST be properly formatted based on this currency: {user_currency}."),
        MessagesPlaceholder(variable_name="messages"),
    ])
    from datetime import date
    chain = prompt.partial(date=str(date.today()), user_lang=user_lang, user_currency=user_currency) | model
    
    logger.debug("Invoking financial chain...")
    response = chain.invoke(state["messages"])
    logger.debug(f"Financial response content: {str(response.content)[:100]}...")
    if response.tool_calls:
        logger.debug(f"Financial response tool_calls: {response.tool_calls}")
    
    logger.debug("Financial chain returned")
    return {"messages": [response]}

def financial_tools_node(state: AgentState, config: RunnableConfig):
    user_id = config.get("configurable", {}).get("user_id")
    tools = make_tools(user_id)
    node = ToolNode(tools)
    return node.invoke(state, config)

# --- Data Analyst Agent Wrapper ---
async def data_analyst_node(state: AgentState):
    analyst_agent = get_analyst_agent()
    # Note: Analyst agent inside 'get_analyst_agent' should also ideally use get_llm if possible,
    # or be passed the model. We might need to refactor 'analyst.py' too if we care about consistency there.
    # For now, let's assuming analyst.py uses ChatOpenAI or we refactor it next.
    response = await analyst_agent.ainvoke(state)
    
    new_messages = response["messages"]
    if new_messages:
         last = new_messages[-1]
         return {"messages": [last]}
         
    return {}

# --- General Agent ---
def general_agent_node(state: AgentState, config: RunnableConfig):
    """Handles general chitchat and non-financial questions."""
    user_lang = config.get("configurable", {}).get("user_lang", "vi")
    
    model = get_llm(temperature=0.5)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a helpful AI Assistant for an Expense Tracker app. You can help users manage their finances, but you are also polite and conversational. If the user greets you, greet them back. IMPORTANT: Always respond in the user's preferred language: {user_lang}."),
        MessagesPlaceholder(variable_name="messages"),
    ])
    
    chain = prompt.partial(user_lang=user_lang) | model
    response = chain.invoke(state["messages"])
    return {"messages": [response]}

# --- Main Graph ---
def get_agent_graph():
    workflow = StateGraph(AgentState)
    
    workflow.add_node("supervisor", supervisor_node)
    workflow.add_node("financial_agent", financial_agent_node)
    workflow.add_node("financial_tools", financial_tools_node)
    workflow.add_node("data_analyst", data_analyst_node)
    workflow.add_node("general_agent", general_agent_node)
    
    workflow.set_entry_point("supervisor")
    
    # Conditional Edge from Supervisor
    workflow.add_conditional_edges(
        "supervisor",
        lambda state: state["next"],
        {
            "financial_agent": "financial_agent",
            "data_analyst": "data_analyst",
            "general_agent": "general_agent",
            "FINISH": END
        }
    )
    
    # Conditional Edge from Financial Agent (Loop for Tools)
    def should_continue_financial(state: AgentState) -> Literal["financial_tools", "supervisor"]:
        last_message = state["messages"][-1]
        if last_message.tool_calls:
            return "financial_tools"
        return "supervisor" # Go back to supervisor after acting

    workflow.add_conditional_edges("financial_agent", should_continue_financial)
    workflow.add_edge("financial_tools", "financial_agent")
    
    # Edge from Analyst
    workflow.add_edge("data_analyst", "supervisor")
    
    # Edge from General Agent
    workflow.add_edge("general_agent", "supervisor")
    
    return workflow

def compile_graph(checkpointer=None):
    workflow = get_agent_graph()
    return workflow.compile(checkpointer=checkpointer)
