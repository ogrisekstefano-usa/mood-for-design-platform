"""Helper for Sprint F · F1 realtime test.
Inserts a single live notification row for the admin user."""
import os, sys
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
ADMIN = "caee7b92-34b4-4ecf-bdaa-8a3eda93a70e"
TENANT = "848354b9-a43e-4147-bdad-116fb93bd585"

c = psycopg2.connect(os.environ["DATABASE_URL"]); c.autocommit = True
cur = c.cursor()
narrative = sys.argv[1] if len(sys.argv) > 1 else "F1 realtime ping · una nuova relazione si è mossa."
priority = sys.argv[2] if len(sys.argv) > 2 else "high"
cur.execute(
    """INSERT INTO relationship_notifications
       (id, tenant_id, recipient_user_id, recipient_type,
        notification_type, narrative, priority, payload, created_at)
       VALUES (gen_random_uuid(), %s, %s, 'designer',
               'new_message', %s, %s, '{}'::jsonb, NOW())
       RETURNING id, created_at""",
    (TENANT, ADMIN, narrative, priority),
)
nid, ts = cur.fetchone()
print(f"INSERTED id={nid} at={ts}")
cur.close(); c.close()
