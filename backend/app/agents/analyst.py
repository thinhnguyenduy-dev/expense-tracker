from langchain_community.utilities import SQLDatabase
from langchain_community.agent_toolkits.sql.toolkit import SQLDatabaseToolkit
from langchain_community.tools.ddg_search import DuckDuckGoSearchRun
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from app.core.config import settings

def get_analyst_agent():
    """
    Creates a Data Analyst agent capable of:
    1. Querying the SQL database (Read-Only preferred).
    2. Searching the web.
    """
    
    # 1. Setup Database
    # We use the existing DATABASE_URL.
    # Note: modifying connection string (e.g. changing user) would happen here if we had a dedicated read-only user.
    db = SQLDatabase.from_uri(settings.DATABASE_URL)
    
    # 2. Setup LLM
    llm = ChatOpenAI(
        model=settings.OPENAI_MODEL_NAME,
        api_key=settings.OPENAI_API_KEY,
        base_url=settings.OPENAI_API_BASE,
        temperature=0
    )
    
    # 3. Setup Tools
    # SQL Tools
    sql_toolkit = SQLDatabaseToolkit(db=db, llm=llm)
    sql_tools = sql_toolkit.get_tools()
    
    # Search Tool
    search_tool = DuckDuckGoSearchRun()
    
    tools = sql_tools + [search_tool]
    
    # 4. System Prompt
    system_prompt = (
        "You are an expert Data Analyst and Financial Researcher.\n"
        "You have access to a SQL database containing user expenses and a web search tool.\n"
        "\n"
        "DATABASE INSTRUCTIONS:\n"
        "- The main tables are: `expenses`, `categories`, `incomes`, `budgets`.\n"
        "- `expenses` has `amount`, `description`, `date`, `category_id`.\n"
        "- ALWAYS join `expenses` with `categories` to get category names when aggregating.\n"
        "- DO NOT execute DML statements (INSERT, UPDATE, DELETE, DROP).\n"
        "- If the user asks for a visualization, just return the data used for it.\n"
        "- If you cannot find the answer in the DB, consider using the Search tool if relevant (e.g. exchange rates).\n"
        "\n"
        "SEARCH INSTRUCTIONS:\n"
        "- Use `duckduckgo_search` for current events, market data, or exchange rates.\n"
        "\n"
        "When answering, be concise and data-driven.\n"
    )

    # 5. Create Agent (ReAct)
    # create_react_agent returns a CompiledStateGraph
    agent = create_react_agent(llm, tools, state_modifier=system_prompt)
    
    return agent
