from openai import OpenAI
import os
from dotenv import load_dotenv

# Load env variables
load_dotenv()

# Check values
api_key = os.getenv("OPENAI_API_KEY")
base_url = os.getenv("OPENAI_API_BASE")

print(f"Base URL: {base_url}")
print(f"API Key: {api_key[:5]}..." if api_key else "API Key: None")

if not api_key or not base_url:
    print("Error: Missing OPENAI_API_KEY or OPENAI_API_BASE")
    exit(1)

client = OpenAI(
    api_key=api_key,
    base_url=base_url
)

try:
    print("Fetching models...")
    models = client.models.list()
    print("Available Models:")
    for m in models.data:
        print(f"- {m.id}")
except Exception as e:
    print(f"Error listing models: {e}")
