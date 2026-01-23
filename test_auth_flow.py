import requests

print("Testing Auth Flow...")

BASE_URL = "http://localhost:8000/api"
EMAIL = "test_user_debug@example.com"
PASSWORD = "password123"

# 1. Register (ignore if exists)
print("\n1. Registering...")
resp = requests.post(f"{BASE_URL}/auth/register", json={
    "email": EMAIL,
    "password": PASSWORD,
    "name": "Debug User"
})
if resp.status_code == 201:
    print("✅ Registered")
elif resp.status_code == 400:
    print("ℹ️ User already exists")
else:
    print(f"❌ Registration failed: {resp.text}")

# 2. Login
print("\n2. Logging in...")
resp = requests.post(f"{BASE_URL}/auth/login", data={
    "username": EMAIL,
    "password": PASSWORD
})

if resp.status_code != 200:
    print(f"❌ Login failed: {resp.text}")
    exit(1)

token_data = resp.json()
access_token = token_data.get("access_token")
print(f"✅ Login success. Token: {access_token[:20]}...")

# 3. Get Me
print("\n3. Getting User Info (/me)...")
headers = {"Authorization": f"Bearer {access_token}"}
resp = requests.get(f"{BASE_URL}/auth/me", headers=headers)

print(f"Status: {resp.status_code}")
if resp.status_code == 200:
    print(f"✅ User Info: {resp.json()}")
else:
    print(f"❌ Failed: {resp.text}")
