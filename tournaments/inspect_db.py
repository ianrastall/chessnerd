import sqlite3
import os

DB_PATH = r"D:\GitHub\chessnerd\tournaments\players.db"

def inspect_database():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database not found at {DB_PATH}")
        return

    print(f"--- Inspecting {DB_PATH} ---")
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # 1. Get list of tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        
        if not tables:
            print("No tables found in database.")
            return

        for table in tables:
            table_name = table[0]
            print(f"\nTABLE: {table_name}")
            print("-" * 40)
            
            # 2. Get column info
            cursor.execute(f"PRAGMA table_info('{table_name}')")
            columns = cursor.fetchall()
            col_names = [col[1] for col in columns]
            print(f"Columns: {col_names}")
            
            # 3. Get row count (approximate if huge, but count(*) is fine for now)
            try:
                cursor.execute(f"SELECT COUNT(*) FROM '{table_name}'")
                count = cursor.fetchone()[0]
                print(f"Total Rows: {count:,}")
            except:
                print("Could not count rows.")

            # 4. Show sample data (first 3 rows)
            print("Sample Data:")
            cursor.execute(f"SELECT * FROM '{table_name}' LIMIT 3")
            rows = cursor.fetchall()
            for row in rows:
                print(row)
                
    except sqlite3.Error as e:
        print(f"SQLite Error: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    inspect_database()