import sqlite3
import os

DB_PATH = r"D:\chessnerd\players.db"
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Check the schema
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()
print("Tables in database:")
for table in tables:
    print(f"  {table[0]}")
    cursor.execute(f"PRAGMA table_info({table[0]});")
    columns = cursor.fetchall()
    for col in columns:
        print(f"    {col[1]} ({col[2]})")

# Check some sample data
print("\nSample players (first 10):")
cursor.execute("SELECT name FROM players LIMIT 10;")
for row in cursor.fetchall():
    print(f"  {row[0]}")

print("\nSample aliases (first 10):")
cursor.execute("SELECT alias FROM aliases LIMIT 10;")
for row in cursor.fetchall():
    print(f"  {row[0]}")

conn.close()