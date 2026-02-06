from dotenv import load_dotenv
load_dotenv()

from app.core.llm import get_llm
from pydantic import BaseModel, Field
from typing import Literal
from langchain_core.messages import HumanMessage, SystemMessage

class RouterResponse(BaseModel):
    next: Literal["financial_agent", "data_analyst", "general_agent", "FINISH"] = Field(
        description="The next worker to act."
    )

model = get_llm()
print(f"Model: {model.model_name}")

print("Binding Pydantic tool...")
try:
    model_with_tool = model.bind_tools([RouterResponse], tool_choice="RouterResponse")
    print("Bound successfully.")
except Exception as e:
    print(f"Binding failed: {e}")
    exit(1)

system_prompt = "You are a supervisor. Route the user request."
msg = HumanMessage(content="Add expense coffee $5")

print("Invoking supervisor model...")
try:
    res = model_with_tool.invoke([
        SystemMessage(content=system_prompt),
        msg
    ])
    print("Result:", res)
    if res.tool_calls:
        print("Tool Calls:", res.tool_calls)
    else:
        print("No tool calls found.")
except Exception as e:
    print(f"Invocation failed: {e}")
