"""Notification cron jobs · M4
=====================================================================

Single scheduler (APScheduler) running inside the backend process.

Jobs
----
* ``followup_overdue_scan`` — daily at 08:00 Europe/Rome.
  Scans ``relationship_actions`` whose ``due_date`` is in the past
  and ``status='open'`` (or 'in_progress'). Emits a ``followup_overdue``
  notification to the action's ``assigned_to`` user. Dedup: skips
  emission if a notification with the same ``payload.action_id`` was
  already created in the last 20 hours.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from database import db
from services.notification_publisher import publish

logger = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def followup_overdue_scan() -> dict:
    """Find open follow-ups past due_date and emit notifications.

    Returns a small stats dict (mostly for tests and debug)."""
    c = db()
    if c is None:
        return {"ok": False, "reason": "no_db"}

    now = datetime.now(timezone.utc)
    twenty_h_ago = (now - timedelta(hours=20)).isoformat()

    # Pull open/in-progress overdue actions across all tenants.
    res = (c.table("relationship_actions").select(
                "id, tenant_id, account_id, title, due_date, "
                "assigned_to, priority, status")
             .in_("status", ["open", "in_progress"])
             .lt("due_date", now.isoformat())
             .limit(500).execute())
    rows = res.data or []

    emitted = 0
    skipped = 0
    for r in rows:
        assignee = r.get("assigned_to")
        if not assignee:
            skipped += 1
            continue

        # Dedup: do not re-emit if we already notified about this action in
        # the last 20 hours (cron is daily so this guards against re-runs).
        dup = (c.table("relationship_notifications")
                 .select("id")
                 .eq("recipient_user_id", assignee)
                 .eq("category_key", "followup_overdue")
                 .gt("created_at", twenty_h_ago)
                 .contains("payload", {"action_id": r["id"]})
                 .limit(1).execute().data) or []
        if dup:
            skipped += 1
            continue

        publish(
            tenant_id=r["tenant_id"],
            recipient_user_id=assignee,
            category_key="followup_overdue",
            title=r.get("title") or "Follow-up scaduto",
            narrative=f"Follow-up scaduto: {r.get('title') or ''}",
            payload={
                "action_id": r["id"],
                "account_id": r.get("account_id"),
                "due_date": r.get("due_date"),
            },
            priority="high",
            sender_type="system",
        )
        emitted += 1

    logger.info("notif.cron.followup_overdue scanned=%d emitted=%d skipped=%d",
                len(rows), emitted, skipped)
    return {"ok": True, "scanned": len(rows), "emitted": emitted, "skipped": skipped}


def start_scheduler() -> BackgroundScheduler:
    """Idempotently start the singleton scheduler. Safe to call multiple times."""
    global _scheduler
    if _scheduler and _scheduler.running:
        return _scheduler

    sched = BackgroundScheduler(timezone="Europe/Rome", daemon=True)
    sched.add_job(
        followup_overdue_scan,
        trigger=CronTrigger(hour=8, minute=0, timezone="Europe/Rome"),
        id="followup_overdue_scan",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    sched.start()
    _scheduler = sched
    logger.info("notif.cron.scheduler started · jobs=%s",
                [j.id for j in sched.get_jobs()])
    return sched


def get_scheduler() -> BackgroundScheduler | None:
    return _scheduler
