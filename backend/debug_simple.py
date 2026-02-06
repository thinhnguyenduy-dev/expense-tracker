from dotenv import load_dotenv
load_dotenv()

from app.core.llm import get_llm
from app.agents.tools import make_tools
from langchain_core.messages import HumanMessage

model = get_llm()
print(f"Model: {model.model_name}")

tools = make_tools("test_user_id")
model_with_tools = model.bind_tools(tools)

print("Invoking model with tools...")
# "Add expense coffee $5"
msg = HumanMessage(content="Add expense coffee $5")
try:
    res = model_with_tools.invoke([msg])
    print("Result:", res)
except Exception as e:
    print(f"Error: {e}")
