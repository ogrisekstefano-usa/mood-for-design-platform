-- ===== 005: TASKS COMPLETED_AT COLUMN =====
-- Purpose: workspace.py::update_task expects a completed_at column to track when a task
-- transitions to status='done'. The base tasks table doesn't have this column yet.
-- Reversible: yes.
-- Author: agent / 2026-05-13

BEGIN;

ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tasks_project_status
    ON public.tasks (project_id, status, created_at DESC);

COMMIT;
