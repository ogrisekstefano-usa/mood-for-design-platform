"""Helper for Sprint F · F3 — set designer presence directly via DB."""
import os, sys
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
DESIGNER = "caee7b92-34b4-4ecf-bdaa-8a3eda93a70e"

PRESETS = {
    "in_studio":             ("In studio",            "In studio"),
    "reviewing_materials":   ("Selezione materiali",   "Reviewing materials"),
    "curating_inspirations": ("Curando ispirazioni",   "Curating inspirations"),
    "preparing_concepts":    ("Preparando concept",    "Preparing concepts"),
    "in_presentation":       ("In presentazione",      "In presentation"),
    "with_clients":          ("Con un cliente",        "With clients"),
    "site_visit":            ("Sopralluogo",           "Site visit"),
    "away":                  ("Fuori studio",          "Away"),
}

state_key = sys.argv[1] if len(sys.argv) > 1 else "curating_inspirations"
it, en = PRESETS[state_key]

c = psycopg2.connect(os.environ["DATABASE_URL"]); c.autocommit = True
cur = c.cursor()
cur.execute(
    """UPDATE designer_presence
          SET state_key=%s, state_label_it=%s, state_label_en=%s, updated_at=NOW()
        WHERE designer_id=%s
        RETURNING state_key, state_label_it""",
    (state_key, it, en, DESIGNER),
)
rows = cur.fetchall()
if not rows:
    # No row yet → insert
    cur.execute("""SELECT tenant_id FROM users_profile WHERE id=%s""", (DESIGNER,))
    tenant = cur.fetchone()[0]
    cur.execute("""INSERT INTO designer_presence
                   (id, tenant_id, designer_id, state_key, state_label_it, state_label_en, updated_at)
                   VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, NOW())
                   RETURNING state_key, state_label_it""",
                (tenant, DESIGNER, state_key, it, en))
    rows = cur.fetchall()
print("SET:", rows)
cur.close(); c.close()
