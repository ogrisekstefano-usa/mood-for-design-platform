"""M4 · Background job scheduler bootstrap.

Uses APScheduler `AsyncIOScheduler` to run lightweight cron-style jobs
inside the FastAPI worker process. For higher-throughput later, swap to
a dedicated worker (Celery / Arq) without changing job code.
"""
from __future__ import annotations
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from jobs.followup_overdue import run_followup_overdue_scan

log = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


def start_scheduler() -> AsyncIOScheduler:
    """Idempotent. Returns the running scheduler instance."""
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    sched = AsyncIOScheduler(timezone='Europe/Rome')
    # Daily 08:00 Europe/Rome (user spec)
    sched.add_job(
        run_followup_overdue_scan,
        CronTrigger(hour=8, minute=0, timezone='Europe/Rome'),
        id='followup_overdue_scan',
        name='M4 · Follow-up overdue scan',
        replace_existing=True,
        misfire_grace_time=60 * 30,  # tolerate up to 30min late starts
    )
    sched.start()
    _scheduler = sched
    log.info('Background scheduler started · Europe/Rome · jobs: %s',
             [j.id for j in sched.get_jobs()])
    return sched


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
