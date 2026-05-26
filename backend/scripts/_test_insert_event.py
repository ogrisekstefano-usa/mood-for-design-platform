"""Helper for Sprint F · F4 timeline realtime test."""
import os, sys
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
TENANT  = "848354b9-a43e-4147-bdad-116fb93bd585"
CLIENT  = "91548304-bfab-48b6-9cbd-f292115fc577"
DESIGNER = "caee7b92-34b4-4ecf-bdaa-8a3eda93a70e"

narrative = sys.argv[1] if len(sys.argv) > 1 else "Marco è tornato sul moodboard dopo 3 giorni."
event_type = sys.argv[2] if len(sys.argv) > 2 else "client_returned"
actor_label = sys.argv[3] if len(sys.argv) > 3 else "Marco"

c = psycopg2.connect(os.environ["DATABASE_URL"]); c.autocommit = True
cur = c.cursor()
cur.execute(
    """INSERT INTO relationship_events
       (id, tenant_id, client_profile_id, designer_id,
        event_type, actor_type, actor_id, actor_label,
        narrative, payload, visibility, occurred_at)
       VALUES (gen_random_uuid(), %s, %s, %s,
               %s, 'client', %s, %s,
               %s, '{}'::jsonb, 'studio', NOW())
       RETURNING id, occurred_at""",
    (TENANT, CLIENT, DESIGNER, event_type, CLIENT, actor_label, narrative),
)
nid, ts = cur.fetchone()
print(f"INSERTED event id={nid} at={ts} type={event_type}")
cur.close(); c.close()
