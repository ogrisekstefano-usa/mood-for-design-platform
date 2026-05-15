"""Demo Magic-Link — one-click authenticated entry into the EXE demo workspace.

Goal: turn the EXE INTERIOR demo storefront into an INTERACTIVE product demo.
A visitor clicks "Try this Storefront" → we mint a session for the pre-seeded
demo user → they land directly in the Storefront Studio with a guided tour.

Trade-offs (intentional, documented for the next iteration):
  • For the MVP we reuse the existing super-admin demo account. A future P2
    task should provision a sandboxed `demo_editor` role scoped to the demo
    tenant only, so the prospect cannot reach billing/super-admin surfaces.
  • Rate-limit is in-process (single-pod) — adequate for current preview
    traffic. Move to Redis when we scale beyond one backend replica.
  • Magic-link tokens use the same Supabase JWT lifetime as a normal login
    (currently 1h). No additional rotation logic is needed yet.
"""
import os
import time
from collections import defaultdict, deque
from typing import Dict, Deque

from fastapi import APIRouter, HTTPException, Request

from routers.auth import _supabase_password_grant
from database import db, db_available

router = APIRouter()

# ── Configuration ──────────────────────────────────────────────────
DEMO_EMAIL    = os.environ.get('DEMO_USER_EMAIL', 'demo@moodfordesign.com')
DEMO_PASSWORD = os.environ.get('DEMO_USER_PASSWORD', 'Blueprint2024!')
DEMO_TENANT_SLUG = os.environ.get('DEMO_TENANT_SLUG', 'mood-demo-studio-81a09e')
REDIRECT_PATH = '/settings/storefront?demo=1&step=intro'

# ── Rate limit: max 6 demo grants / IP / 10min ────────────────────
_RATE_WINDOW_S = 600
_RATE_MAX = 6
_RATE_BUCKET: Dict[str, Deque[float]] = defaultdict(deque)


def _rate_check(client_ip: str) -> None:
    """Reject the request when the IP has burned through its allowance."""
    now = time.time()
    bucket = _RATE_BUCKET[client_ip]
    # Evict timestamps outside the window
    while bucket and (now - bucket[0]) > _RATE_WINDOW_S:
        bucket.popleft()
    if len(bucket) >= _RATE_MAX:
        retry_in = int(_RATE_WINDOW_S - (now - bucket[0]))
        raise HTTPException(
            429,
            f"Too many demo sessions from this IP. Try again in {retry_in}s.",
        )
    bucket.append(now)


# ── Endpoint ───────────────────────────────────────────────────────
@router.post('/magic-link')
def issue_demo_magic_link(request: Request):
    """Issue a fresh demo session.

    Returns the same shape as `/api/auth/login` so the frontend can drop the
    token into localStorage and the api client picks it up automatically:
      {
        "session": { access_token, refresh_token, expires_at },
        "redirect": "/settings/storefront?demo=1&step=intro",
        "tenant_slug": "mood-demo-studio-81a09e",
        "expires_in_seconds": 3600,
        "user_email": "demo@moodfordesign.com"
      }
    """
    if not db_available():
        raise HTTPException(503, "Database not configured")

    # Rate-limit per source IP (X-Forwarded-For aware, falls back to client.host).
    fwd = request.headers.get('x-forwarded-for', '')
    client_ip = (fwd.split(',')[0].strip() if fwd else (request.client.host if request.client else 'unknown'))
    _rate_check(client_ip)

    try:
        session_data = _supabase_password_grant(DEMO_EMAIL.lower(), DEMO_PASSWORD)
    except HTTPException as e:
        # Re-raise with a friendlier message — the prospect should never see
        # "Invalid credentials" for a server-managed demo account.
        raise HTTPException(503, f"Demo session unavailable ({e.status_code}). Please try again.")

    auth_user = session_data.get('user', {})
    client = db()
    profile = client.table('users_profile').select('id, role, tenant_id, email') \
        .eq('auth_user_id', auth_user.get('id')).limit(1).execute()
    if not profile.data:
        raise HTTPException(503, "Demo profile missing — contact support")
    p = profile.data[0]

    return {
        "session": {
            "access_token":  session_data['access_token'],
            "refresh_token": session_data.get('refresh_token'),
            "expires_at":    session_data.get('expires_at'),
        },
        "redirect": REDIRECT_PATH,
        "tenant_slug": DEMO_TENANT_SLUG,
        "user_email": DEMO_EMAIL,
        "expires_in_seconds": 3600,
        "profile_id": p.get('id'),
    }
