from typing import Literal, Annotated, TypedDict
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

# --- Supervisor Node ---
def supervisor_node(state: AgentState):
    """
    Decides which agent to route to.
    """
    messages = state["messages"]
    
    model = ChatOpenAI(
        model=settings.OPENAI_MODEL_NAME, 
        api_key=settings.OPENAI_API_KEY,
        base_url=settings.OPENAI_API_BASE,
        temperature=0
    )
    
    system_prompt = (
        "You are a supervisor for a Financial App. Manage the conversation between the following workers:\n"
        "1. `financial_agent`: Handles creating/logging expenses, checking budget health, and transactional queries about *recent* activity.\n"
        "2. `data_analyst`: Handles complex analysis, SQL queries (aggregations, trends over time), and external web search (exchange rates, news).\n"
        "3. `general_agent`: Handles general greetings, small talk, and non-financial questions.\n"
        "\n"
        "Given the user request, respond with the worker name to act next. If the user's request is satisfied, respond with FINISH."
    )
    
    # Use standard tool calling for compatibility with Groq/Llama
    from pydantic import BaseModel, Field
    
    class RouterResponse(BaseModel):
        """Select the next agent to handle the request."""
        next: Literal["financial_agent", "data_analyst", "general_agent", "FINISH"] = Field(
            description="The next worker to act. Use 'FINISH' if user is satisfied."
        )

    # Bind the tool and force it
    # Intentional blank or comment, previous line was invalid assignment syntax 
    # Actually, for routing we usually want to force it.
    
    model_with_tool = model.bind_tools([RouterResponse], tool_choice="RouterResponse")
    
    # We pass the last few messages to context
    response = model_with_tool.invoke([
        SystemMessage(content=system_prompt),
        *messages[-5:] # Context window
    ])
    
    # Extract decision
    if response.tool_calls:
        # Standard tool call extraction
        args = response.tool_calls[0]["args"]
        next_node = args.get("next")
    else:
        # Fallback if model just chats
        next_node = "FINISH"
    
    if next_node == "FINISH":
        return {"next": "FINISH"}
        
    return {"next": next_node}

# --- Financial Agent ---
def financial_agent_node(state: AgentState, config: RunnableConfig):
    user_id = config.get("configurable", {}).get("user_id")
    tools = make_tools(user_id)
    
    model = ChatOpenAI(
        model=settings.OPENAI_MODEL_NAME, 
        api_key=settings.OPENAI_API_KEY,
        base_url=settings.OPENAI_API_BASE,
        temperature=0
    ).bind_tools(tools)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a helpful Financial Assistant. Extract expense details, check budgets, and submit drafts. Current Date: {date}"),
        MessagesPlaceholder(variable_name="messages"),
    ])
    from datetime import date
    chain = prompt.partial(date=str(date.today())) | model
    
    response = chain.invoke(state["messages"])
    return {"messages": [response]}

def financial_tools_node(state: AgentState, config: RunnableConfig):
    user_id = config.get("configurable", {}).get("user_id")
    tools = make_tools(user_id)
    node = ToolNode(tools)
    return node.invoke(state, config)

# --- Data Analyst Agent Wrapper ---
async def data_analyst_node(state: AgentState):
    analyst_agent = get_analyst_agent()
    response = await analyst_agent.ainvoke(state)
    
    # The sub-graph returns a state with 'messages'. 
    # We want to take the LAST message (Answer) and append it to our main graph.
    # LangGraph subgraphs usually return the full state.
    
    # We just return the messages update
    new_messages = response["messages"]
    if new_messages:
         # To avoid duplicating the *entire* history if the subgraph includes it,
         # we should ideally only return the *new* messages.
         # But simpler: ReAct agent outputs the reasoning trace + final answer.
         # We might want to just grab the final AIMessage?
         # Check last message.
         last = new_messages[-1]
         return {"messages": [last]}
         
    return {}

# --- General Agent ---
def general_agent_node(state: AgentState, config: RunnableConfig):
    """Handles general chitchat and non-financial questions."""
    model = ChatOpenAI(
        model=settings.OPENAI_MODEL_NAME, 
        api_key=settings.OPENAI_API_KEY,
        base_url=settings.OPENAI_API_BASE,
        temperature=0.5
    )
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a helpful AI Assistant for an Expense Tracker app. You can help users manage their finances, but you are also polite and conversational. If the user greets you, greet them back."),
        MessagesPlaceholder(variable_name="messages"),
    ])
    
    chain = prompt | model
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
