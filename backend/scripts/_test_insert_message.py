"""Helper for Sprint F · F2 chat realtime test.
Inserts a single live message in the existing thread, sender_type=designer."""
import os, sys
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
THREAD = "e105c1f9-a379-4653-a729-932471655f79"
TENANT = "848354b9-a43e-4147-bdad-116fb93bd585"
DESIGNER_PROFILE = "caee7b92-34b4-4ecf-bdaa-8a3eda93a70e"  # admin/Stefano profile id

c = psycopg2.connect(os.environ["DATABASE_URL"]); c.autocommit = True
cur = c.cursor()
content = sys.argv[1] if len(sys.argv) > 1 else "Sto preparando una palette dedicata."
sender_type = sys.argv[2] if len(sys.argv) > 2 else "designer"
cur.execute(
    """INSERT INTO relationship_messages
       (id, tenant_id, thread_id, sender_type, sender_user_id, sender_label,
        message_type, content, attachments, metadata, created_at)
       VALUES (gen_random_uuid(), %s, %s, %s, %s, %s,
               'text', %s, '[]'::jsonb, '{}'::jsonb, NOW())
       RETURNING id, created_at""",
    (TENANT, THREAD, sender_type, DESIGNER_PROFILE,
     "Stefano" if sender_type == "designer" else "Marco",
     content),
)
nid, ts = cur.fetchone()
print(f"INSERTED message id={nid} at={ts} sender={sender_type}")
cur.close(); c.close()
