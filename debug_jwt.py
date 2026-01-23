from jose import jwt
from datetime import datetime, timedelta

SECRET = "your-super-secret-jwt-key-change-in-production"
ALGO = "HS256"

def test_jwt():
    print(f"Secret: {SECRET}")
    print(f"Algo: {ALGO}")
    
    # 1. Encode (using int as sub)
    data = {"sub": 123, "exp": datetime.utcnow() + timedelta(minutes=60)}
    token = jwt.encode(data, SECRET, algorithm=ALGO)
    print(f"Encoded Token: {token}")
    
    # 2. Decode
    try:
        payload = jwt.decode(token, SECRET, algorithms=[ALGO])
        print(f"Decoded Payload: {payload}")
        print(f"sub type: {type(payload.get('sub'))}")
    except Exception as e:
        print(f"ERROR Decoding: {e}")

if __name__ == "__main__":
    test_jwt()
