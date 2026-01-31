import sys
import os

# Add the parent directory to sys.path to allow imports from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from app.core.config import settings

def reset_negative_jars():
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as connection:
        try:
            # Check for negative jars
            result = connection.execute(text("SELECT id, name, balance FROM jars WHERE balance < 0"))
            jars = result.fetchall()
            
            if not jars:
                print("No negative balance jars found.")
                return

            print(f"Found {len(jars)} jars with negative balance.")
            for jar in jars:
                print(f"Resetting jar '{jar[1]}' (ID: {jar[0]}) from {jar[2]} to 0")

            # Reset them
            connection.execute(text("UPDATE jars SET balance = 0 WHERE balance < 0"))
            connection.commit()
            print("Successfully reset negative balances.")
            
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    reset_negative_jars()
