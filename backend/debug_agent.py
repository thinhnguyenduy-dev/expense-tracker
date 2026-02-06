import asyncio
from dotenv import load_dotenv
from app.agents.graph import compile_graph
from langchain_core.messages import HumanMessage

load_dotenv()

async def main():
    print("Compiling graph...")
    graph = compile_graph(checkpointer=None) # No persistence for debug
    
    print("Graph compiled. sending message...")
    user_input = "Add expense coffee $5"
    
    config = {"configurable": {"thread_id": "debug_1", "user_id": 1}}
    
    async for event in graph.astream({"messages": [HumanMessage(content=user_input)]}, config):
        for key, value in event.items():
            print(f"\n--- Node: {key} ---")
            # print(value) # value is usually the state update
            if "messages" in value:
                last_msg = value["messages"][-1]
                print(f"Message: {last_msg.content[:100]}...")
            if "next" in value:
                print(f"Decision: {value['next']}")

if __name__ == "__main__":
    asyncio.run(main())
