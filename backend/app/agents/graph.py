from typing import Literal, Annotated
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_core.runnables import RunnableConfig

from app.agents.state import AgentState
from app.agents.tools import make_tools
from app.core.config import settings

def get_agent_graph():
    """
    Builds the financial agent graph.
    """
    
    # Define the Agent Node
    def agent_node(state: AgentState, config: RunnableConfig):
        user_id = config.get("configurable", {}).get("user_id")
        if not user_id:
            raise ValueError("user_id is required in configurable")
            
        # Get tools for this user
        tools = make_tools(user_id)
        
        # Initialize Model (GPT-3.5-turbo is fast and good enough for this)
        # Using functional calling
        model = ChatOpenAI(
            model=settings.OPENAI_MODEL_NAME, 
            api_key=settings.OPENAI_API_KEY,
            base_url=settings.OPENAI_API_BASE,
            temperature=0
        ).bind_tools(tools)
        
        # System Prompt
        system_prompt = (
            "You are a helpful Financial Assistant for an Expense Tracker app.\n"
            "Your goal is to help the user log expenses accurately and check their budget health.\n"
            "\n"
            "PROCESS:\n"
            "1. Extract expense details from the user's message.\n"
            "2. If the category is vague, use `lookup_categories_tool` to find the best match.\n"
            "3. ALWAYS check the budget using `check_budget_tool` before finalizing, unless the user explicitly skips it.\n"
            "4. If budget is exceeded, warn the user but proceed if they insist.\n"
            "5. Once you have Amount, Category, and confirmed details, call `submit_expense_tool`.\n"
            "\n"
            "Current Date: {date}\n"
        )
        
        from datetime import date
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt.format(date=date.today())),
            MessagesPlaceholder(variable_name="messages"),
        ])
        
        chain = prompt | model
        response = chain.invoke({"messages": state["messages"]})
        
        return {"messages": [response]}

    # Define the Tools Node
    def tools_node(state: AgentState, config: RunnableConfig):
        user_id = config.get("configurable", {}).get("user_id")
        tools = make_tools(user_id)
        # We use the prebuilt ToolNode but we need to pass the instantiated tools
        # However, ToolNode expects a list of tools.
        node = ToolNode(tools)
        return node.invoke(state, config)

    # Define Edges
    def should_continue(state: AgentState) -> Literal["tools", END]:
        messages = state["messages"]
        last_message = messages[-1]
        
        # If there are no tool calls, stop
        if not last_message.tool_calls:
            return END
        
        # If the tool call is 'submit_expense_tool', we are effectively done with the *agent* part,
        # but we still need to run the tool to get the output in the history.
        # So we go to 'tools', then next loop agent sees "Draft Created" and stops?
        # A simpler pattern: Text -> Agent -> Tool -> Agent (sees result) -> END
        return "tools"

    # Build Graph
    workflow = StateGraph(AgentState)
    
    workflow.add_node("agent", agent_node)
    workflow.add_node("tools", tools_node)
    
    workflow.set_entry_point("agent")
    
    workflow.add_conditional_edges(
        "agent",
        should_continue,
    )
    
    workflow.add_edge("tools", "agent")
    
    return workflow.compile()
