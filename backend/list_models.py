import os
import google.generativeai as genai
from dotenv import load_dotenv

# Load env variables
load_dotenv()

api_key = os.getenv("GOOGLE_API_KEY")

if not api_key:
    print("Error: GOOGLE_API_KEY not found in .env")
    exit(1)

print(f"Using API Key: {api_key[:5]}...{api_key[-5:]}")

try:
    genai.configure(api_key=api_key)
    print("Listing available models...")
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"- {m.name}")
except Exception as e:
    print(f"Error listing models: {e}")
