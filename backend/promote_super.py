"""Promote demo user to super_admin."""
import os, psycopg2
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / '.env')
conn = psycopg2.connect(os.environ['DATABASE_URL'])
conn.autocommit = True
cur = conn.cursor()
cur.execute("UPDATE users_profile SET role = 'super_admin' WHERE email = 'demo@moodfordesign.com';")
print(f"Updated rows: {cur.rowcount}")
cur.execute("SELECT email, role FROM users_profile WHERE email='demo@moodfordesign.com';")
print(cur.fetchall())
cur.close(); conn.close()
