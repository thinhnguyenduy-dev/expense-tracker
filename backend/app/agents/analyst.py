from langchain_community.utilities import SQLDatabase
from langchain_community.agent_toolkits.sql.toolkit import SQLDatabaseToolkit
from langgraph.prebuilt import create_react_agent

from app.agents.prompts import ANALYST_SYSTEM_PROMPT
from app.agents.tools import get_search_tool
from app.core.llm import get_llm
from app.core.database import engine


def get_analyst_agent():
    """
    Creates a Data Analyst agent capable of:
    1. Querying the SQL database (Read-Only preferred).
    2. Searching the web.
    """
    # 1. Setup Database — use the shared engine to avoid pool exhaustion.
    db = SQLDatabase(
        engine,
        include_tables=['expenses', 'categories', 'incomes', 'users', 'jars', 'recurring_expenses']
    )

    # 2. Setup LLM
    llm = get_llm(temperature=0)

    # 3. Setup Tools
    sql_tools = SQLDatabaseToolkit(db=db, llm=llm).get_tools()
    tools = sql_tools + [get_search_tool()]

    # 4. Create Agent (ReAct) — returns a CompiledStateGraph.
    return create_react_agent(llm, tools, prompt=ANALYST_SYSTEM_PROMPT)
