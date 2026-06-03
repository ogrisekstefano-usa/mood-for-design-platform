"""M4 cron · Follow-up overdue daily scan.

Runs at 08:00 Europe/Rome (per user spec).

Selects every active relationship_activity with a `next_step_due_at` in
the past, no completion/archival yet, that has not been re-notified today.
Fires one notification per (activity, day) via dedup_key.

This is intentionally a daily *digest of overdue items per owner* — not a
real-time burst — to avoid swamping the bell. Re-runs are idempotent.
"""
from __future__ import annotations
import logging
from datetime import date

from sqlalchemy import text

from database import AsyncSessionLocal
from services import notifications as notif

log = logging.getLogger(__name__)


async def run_followup_overdue_scan() -> dict:
    """Scan + notify. Returns summary stats."""
    today_iso = date.today().isoformat()
    created = 0
    skipped = 0
    async with AsyncSessionLocal() as s:
        rows = (await s.execute(text("""
            SELECT a.id            AS activity_id,
                   a.tenant_id     AS tenant_id,
                   a.owner_user_id AS owner_user_id,
                   a.subject       AS subject,
                   a.next_step     AS next_step,
                   a.next_step_due_at AS due_at,
                   t.name          AS tenant_name,
                   FLOOR(EXTRACT(EPOCH FROM (NOW() - a.next_step_due_at)) / 86400)::int AS days_overdue
              FROM relationship_activities a
              JOIN tenants t ON t.id = a.tenant_id
             WHERE a.next_step_due_at < NOW()
               AND a.completed_at IS NULL
               AND a.archived_at IS NULL
               AND a.owner_user_id IS NOT NULL
             ORDER BY a.next_step_due_at ASC
        """))).mappings().all()

        for r in rows:
            try:
                ids = await notif.notify(
                    s,
                    type_code='followup_overdue',
                    tenant_id=r['tenant_id'],
                    activity_id=r['activity_id'],
                    payload={
                        'subject':     r['subject'] or r['next_step'] or '—',
                        'studio_name': r['tenant_name'] or '—',
                        'days':        str(max(1, int(r['days_overdue'] or 1))),
                    },
                    explicit_recipients=[r['owner_user_id']],
                    advisor_user_id=r['owner_user_id'],
                    dedup_key=f"followup_overdue:{r['activity_id']}:{today_iso}",
                    source_event_type='followup:overdue_scan',
                    source_event_id=r['activity_id'],
                )
                if ids:
                    created += 1
                else:
                    skipped += 1
            except Exception as ex:
                log.warning('followup_overdue notify failed for %s: %s', r['activity_id'], ex)
                skipped += 1
        await s.commit()

    summary = {
        'date': today_iso,
        'scanned': len(rows),
        'created': created,
        'skipped': skipped,
    }
    log.info('followup_overdue_scan: %s', summary)
    return summary
