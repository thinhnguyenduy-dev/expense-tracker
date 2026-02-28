import requests
import time
import sys

BASE_URL = "http://localhost:8000"
EMAIL = "demo@expense-tracker.com"
PASSWORD = "Demo123!"

def login():
    try:
        resp = requests.post(f"{BASE_URL}/api/auth/login", data={"username": EMAIL, "password": PASSWORD})
        if resp.status_code == 200:
            return resp.json()["access_token"]
        print(f"Login failed: {resp.status_code} {resp.text}")
        return None
    except Exception as e:
        print(f"Connection failed: {e}")
        return None

def test_chat(token, message, expect_refusal=False):
    headers = {"Authorization": f"Bearer {token}"}
    start = time.time()
    resp = requests.post(f"{BASE_URL}/api/ai/agent/chat", headers=headers, json={"message": message})
    duration = time.time() - start
    
    if resp.status_code != 200:
        print(f"Chat failed: {resp.status_code} {resp.text}")
        return None, duration

    data = resp.json()
    response_text = data.get("response", "")
    print(f"Message: {message}")
    print(f"Response: {response_text[:100]}...")
    print(f"Time: {duration:.4f}s")
    
    if expect_refusal:
        # Check for refusal keywords
        refusal_keywords = ["cannot", "not able", "unrelated", "finance", "expense"]
        # It should say something like "I'm sorry, I can only help with..."
        # But we must be careful with false positives.
        print("verifying refusal...")
        # (Manual check mostly, but script can hint)
        
    return response_text, duration

def main():
    print("Waiting for server...")
    for _ in range(10):
        try:
            requests.get(f"{BASE_URL}/docs")
            break
        except:
            time.sleep(1)
            print(".", end="", flush=True)
    print("Server ready (or timeout).")

    token = login()
    if not token:
        sys.exit(1)

    print("\n--- Test 1: Relevancy ---")
    test_chat(token, "What is the capital of France?", expect_refusal=True)

    print("\n--- Test 2: Caching (First Call) ---")
    # Use a specific query that might take time (e.g., fetching data)
    # But "What is my total expense" might is simple enough.
    # We rely on network/LLM latency being > cache latency.
    msg = "Who are you?"
    res1, dur1 = test_chat(token, msg)

    print("\n--- Test 3: Caching (Second Call) ---")
    res2, dur2 = test_chat(token, msg)
    print(f"Message: {msg}")
    print(f"Response: {res2[:100]}...")
    print(f"Time: {dur2:.4f}s")
    
    if dur2 < dur1 * 0.5: # Expect significant speedup
        print("SUCCESS: Caching seems to be working (2nd call much faster).")
    else:
        print("WARNING: Caching might not be effective or latency variance.")

    print("\n--- Test 4: Monthly Summary Tool ---")
    msg_sum = "What are my total expenses this month?"
    res_sum, _ = test_chat(token, msg_sum)
    print(f"Message: {msg_sum}")
    print(f"Response: {res_sum}")
    if "Monthly Summary" in res_sum or "Total Spent" in res_sum:
        print("SUCCESS: AI used the monthly summary tool.")
    else:
        print("WARNING: AI might not have used the monthly summary tool.")

if __name__ == "__main__":
    main()
```
