import asyncio
import os
import sys
from pathlib import Path

# Ensure /app (container) or <repo>/backend (local) is importable.
CURRENT_FILE = Path(__file__).resolve()
BACKEND_ROOT = CURRENT_FILE.parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg_pool import AsyncConnectionPool

async def main():
    try:
        from app.core.config import settings
        db_url = settings.DATABASE_URL.replace("postgresql://", "postgresql://")
        
        print(f"Connecting to {db_url.split('@')[-1]}")
        
        # Open with autocommit=True is crucial for CREATE INDEX CONCURRENTLY
        async with AsyncConnectionPool(conninfo=db_url, kwargs={"autocommit": True}) as pool:
            checkpointer = AsyncPostgresSaver(pool)
            print("Running setup()...")
            await checkpointer.setup()
            print("Setup complete.")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
