import asyncio
import os
import sys

# Ensure backend acts as root
sys.path.append(os.path.join(os.getcwd(), 'backend'))

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
