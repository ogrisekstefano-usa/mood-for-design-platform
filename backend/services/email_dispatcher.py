"""
Generic CMS-driven email dispatcher.
─────────────────────────────────────────────────────────────────────────────
Every transactional email in the Tenant Activation Lifecycle is rendered
from `editorial_blocks` under the namespace `email.<template_key>.*`.

NO hardcoded copy: subject, headline, body, cta, footer, signature are all
fetched from the CMS using the standard locale fallback chain via
`services.site_resolver._fetch_block_values`.

Email delivery uses the same Resend SDK already configured for magic links
(`access_continuity._send_magic_link_email`).

A persistent audit log is stored in `studio_email_dispatch_log` for retry
and observability.

Public API:
  await dispatch_email(template_key, to, locale, variables) -> str (log_id)
"""
from __future__ import annotations
import os, asyncio, logging, json, uuid
from typing import Optional
from sqlalchemy import text
import resend

from database import AsyncSessionLocal
from services.site_resolver import _fetch_block_values
from tenant_resolver import get_corporate_tenant

logger = logging.getLogger("email_dispatcher")
DEFAULT_LOCALE = 'it-IT'

# IMPORTANT — Runtime env lookups, NEVER module-level constants.
# Reason: with uvicorn --reload, the email_dispatcher module can be
# imported into a worker BEFORE load_dotenv has populated os.environ
# (race window during watchfiles spawns). A module-level constant would
# get "fail-cached" as empty string and stay that way for the rest of
# the worker's life, silently routing every send to status='sandbox'.
# Each accessor below re-reads os.environ on every call.
def _resend_api_key() -> str:
    return os.environ.get("RESEND_API_KEY", "").strip()

def _sender_email() -> str:
    return os.environ.get("ACCESS_SENDER_EMAIL", "no-reply@mail.moodfordesign.com")

def _sender_name() -> str:
    return os.environ.get("ACCESS_SENDER_NAME", "MOOD for DESIGN")

def _base_url() -> str:
    return os.environ.get("ACCESS_LINK_BASE_URL", "").rstrip("/")

def _is_sandbox_key(key: str) -> bool:
    """A key is considered sandbox-only if missing or matching the
    documented placeholder prefix."""
    return (not key) or key.startswith("re_sandbox_placeholder")


# ── HTML wrapper (structure-only; copy comes from CMS) ──────────────────────
def _wrap_html(subject: str, eyebrow: str, headline: str,
               body: str, cta_label: str | None, cta_url: str | None,
               note: str | None, signature: str) -> str:
    cta_block = ""
    if cta_label and cta_url:
        cta_block = (
            '<tr><td style="padding:24px 0 8px;"><a href="' + cta_url + '" '
            'style="display:inline-block;padding:14px 26px;background:#00C9B3;'
            'color:#000;text-decoration:none;letter-spacing:.05em;'
            'font-family:Inter,sans-serif;font-size:14px;font-weight:500;">'
            + cta_label + '</a></td></tr>'
        )
    note_block = (
        f'<tr><td style="padding:16px 0;color:#888;font-size:13px;'
        f'font-family:Inter,sans-serif;line-height:1.6;">{note}</td></tr>'
        if note else ''
    )
    body_html = (body or '').replace('\n', '<br>')
    return (
        '<!doctype html><html><body style="margin:0;padding:0;'
        'background:#FFFFFF;color:#121212;">'
        '<table width="100%" cellpadding="0" cellspacing="0" '
        'style="max-width:580px;margin:40px auto;padding:0 24px;">'
        f'<tr><td style="padding-bottom:16px;color:#888;font-size:11px;'
        f'letter-spacing:.18em;text-transform:uppercase;'
        f'font-family:Inter,sans-serif;">{eyebrow}</td></tr>'
        f'<tr><td style="padding-bottom:16px;'
        f'font-family:DM Serif Display,Playfair Display,serif;'
        f'font-size:30px;line-height:1.15;color:#121212;">{headline}</td></tr>'
        f'<tr><td style="font-family:Inter,sans-serif;font-size:15px;'
        f'line-height:1.7;color:#222;padding-bottom:8px;">{body_html}</td></tr>'
        f'{cta_block}'
        f'{note_block}'
        '<tr><td style="border-top:1px solid #eaeaea;padding-top:24px;'
        'margin-top:32px;color:#555;font-size:12px;font-family:Inter,sans-serif;'
        'letter-spacing:.04em;">'
        f'— {signature}</td></tr>'
        '</table></body></html>'
    )


def _interpolate(template: str, variables: dict) -> str:
    if not template:
        return template
    out = template
    for k, v in (variables or {}).items():
        out = out.replace(f"{{{{{k}}}}}", "" if v is None else str(v))
    return out


async def _resolve_copy(template_key: str, locale: str) -> dict:
    """Pull the editorial blocks under email.<template_key>.* for the locale.

    Uses a direct query (rather than `_fetch_block_values`) because the
    namespace/block_key split convention used by site_resolver does not
    match our namespace='email' layout (block_key contains the dotted
    template key).
    """
    from sqlalchemy import bindparam
    tenant = await get_corporate_tenant()
    fields = ['subject', 'eyebrow', 'headline', 'body',
              'cta_label', 'cta_url_path', 'note', 'signature']
    keys = [f"{template_key}.{f}" for f in fields]
    async with AsyncSessionLocal() as s:
        rows = (await s.execute(text("""
            SELECT b.block_key, b.source_value,
                   COALESCE(t.value, b.source_value) AS resolved
              FROM editorial_blocks b
              LEFT JOIN editorial_block_translations t
                ON t.block_id = b.id AND t.locale = :loc
             WHERE b.tenant_id = :tid
               AND b.namespace = 'email'
               AND b.is_active = true
               AND b.block_key = ANY(:keys)
        """), {"tid": tenant['id'], "loc": locale, "keys": keys})).mappings().all()
    out: dict[str, str] = {}
    for r in rows:
        # block_key e.g. 'studio_request_received.subject' → field = 'subject'
        suffix = r['block_key'].split('.', 1)[-1]
        out[suffix] = r['resolved'] or r['source_value'] or ''
    return out


async def _log_dispatch(template_key: str, to_email: str, locale: str,
                        subject: str, variables: dict, status: str,
                        error: str | None = None,
                        external_id: str | None = None) -> str:
    log_id = str(uuid.uuid4())
    async with AsyncSessionLocal() as s:
        await s.execute(text("""
            INSERT INTO studio_email_dispatch_log
              (id, template_key, to_email, locale, subject,
               variables, status, error, external_id, created_at)
            VALUES
              (:id, :tk, :em, :loc, :sub,
               CAST(:vars AS jsonb), :st, :err, :ext, NOW())
        """), {
            "id": log_id, "tk": template_key, "em": to_email,
            "loc": locale, "sub": subject,
            "vars": json.dumps(variables or {}, default=str),
            "st": status, "err": error, "ext": external_id,
        })
        await s.commit()
    return log_id


async def dispatch_email(*, template_key: str, to_email: str,
                         to_name: Optional[str] = None,
                         locale: str = DEFAULT_LOCALE,
                         variables: Optional[dict] = None,
                         cta_url_override: Optional[str] = None) -> str:
    """
    Render and send a transactional email driven by the CMS.
    Returns the dispatch log id (always logged, even on failure).
    """
    variables = variables or {}
    copy = await _resolve_copy(template_key, locale)

    subject   = _interpolate(copy.get('subject')   or '', variables) or f"[MOOD] {template_key}"
    eyebrow   = _interpolate(copy.get('eyebrow')   or '', variables)
    headline  = _interpolate(copy.get('headline')  or '', variables)
    body      = _interpolate(copy.get('body')      or '', variables)
    cta_label = _interpolate(copy.get('cta_label') or '', variables) or None
    cta_path  = _interpolate(copy.get('cta_url_path') or '', variables) or None
    note      = _interpolate(copy.get('note')      or '', variables) or None
    signature = _interpolate(copy.get('signature') or 'MOOD for DESIGN™', variables)

    cta_url = cta_url_override or (f"{_base_url()}{cta_path}" if cta_path else None)

    html = _wrap_html(subject, eyebrow, headline, body, cta_label, cta_url, note, signature)
    text_body = (
        f"{headline}\n\n{body}\n\n"
        f"{(cta_label + ': ' + cta_url + chr(10) + chr(10)) if cta_label and cta_url else ''}"
        f"{(note + chr(10) + chr(10)) if note else ''}"
        f"— {signature}\n"
    )

    api_key = _resend_api_key()
    if _is_sandbox_key(api_key):
        logger.info("EMAIL_DEV_PREVIEW template=%s to=%s subject=%r (sandbox: key missing/placeholder)",
                    template_key, to_email, subject)
        return await _log_dispatch(template_key, to_email, locale,
                                   subject, variables, 'sandbox')

    resend.api_key = api_key
    from_field = f"{_sender_name()} <{_sender_email()}>"
    to_field   = f"{to_name} <{to_email}>" if to_name else to_email

    def _send():
        return resend.Emails.send({
            "from": from_field, "to": [to_field],
            "subject": subject, "html": html, "text": text_body,
        })

    try:
        result = await asyncio.to_thread(_send)
        external = (result or {}).get('id')
        return await _log_dispatch(template_key, to_email, locale,
                                   subject, variables, 'sent',
                                   external_id=external)
    except Exception as exc:
        logger.exception("dispatch_email failed template=%s to=%s", template_key, to_email)
        return await _log_dispatch(template_key, to_email, locale,
                                   subject, variables, 'failed',
                                   error=str(exc))


async def retry_failed(limit: int = 25) -> int:
    """Idempotent retry loop for stuck dispatches.

    Picks up rows in status IN ('failed','sandbox') with retry_count < 3.
    'sandbox' inclusion lets us auto-recover emails that were short-
    circuited during a window where RESEND_API_KEY wasn't yet loaded
    (e.g. brief reload race) — once the key is back, the next call to
    retry_failed will retry them and they'll go out as 'sent'.

    Returns the count of rows successfully re-dispatched.
    """
    async with AsyncSessionLocal() as s:
        rows = (await s.execute(text("""
            SELECT id, template_key, to_email, locale, variables
              FROM studio_email_dispatch_log
             WHERE status IN ('failed','sandbox') AND retry_count < 3
             ORDER BY created_at ASC LIMIT :lim
        """), {"lim": limit})).mappings().all()
    count = 0
    for r in rows:
        try:
            await dispatch_email(
                template_key=r['template_key'], to_email=r['to_email'],
                locale=r['locale'], variables=r['variables'] or {})
            count += 1
            async with AsyncSessionLocal() as s2:
                await s2.execute(text("""
                    UPDATE studio_email_dispatch_log
                       SET retry_count = retry_count + 1, last_retry_at = NOW()
                     WHERE id = :id
                """), {"id": r['id']})
                await s2.commit()
        except Exception:
            continue
    return count


# ── Startup health check ────────────────────────────────────────────
async def email_health_check() -> dict:
    """Live verification of the Resend integration at startup.

    Performs:
      • presence + shape of RESEND_API_KEY,
      • Resend GET /domains (so we know the key is accepted),
      • match between ACCESS_SENDER_EMAIL and a verified domain.

    Returns a dict suitable for both startup logging and a future admin
    diagnostic surface. NEVER raises — failures are reported in the dict.
    """
    import httpx
    out = {
        'ok':                False,
        'api_key_present':   False,
        'sandbox':           True,
        'domain_verified':   False,
        'domain':            None,
        'sender_email':      _sender_email(),
        'sender_name':       _sender_name(),
        'base_url':          _base_url(),
        'api_reachable':     False,
        'detail':            None,
    }
    key = _resend_api_key()
    out['api_key_present'] = bool(key)
    out['sandbox'] = _is_sandbox_key(key)
    if out['sandbox']:
        out['detail'] = 'RESEND_API_KEY missing or placeholder — emails routed to sandbox'
        return out
    sender_email = _sender_email()
    sender_domain = sender_email.split('@', 1)[-1].lower() if '@' in sender_email else None
    try:
        async with httpx.AsyncClient(timeout=8) as cx:
            r = await cx.get(
                "https://api.resend.com/domains",
                headers={'Authorization': f'Bearer {key}'},
            )
            if r.status_code != 200:
                out['detail'] = f'Resend API HTTP {r.status_code}: {r.text[:160]}'
                return out
            out['api_reachable'] = True
            data = r.json() or {}
            for d in (data.get('data') or []):
                if (d.get('name') or '').lower() == sender_domain:
                    out['domain'] = d.get('name')
                    out['domain_verified'] = d.get('status') == 'verified'
                    break
            if not out['domain']:
                out['detail'] = f"Sender domain '{sender_domain}' not present in Resend account"
                return out
            if not out['domain_verified']:
                out['detail'] = f"Sender domain '{out['domain']}' not yet verified"
                return out
    except Exception as e:
        out['detail'] = f'Resend reachability error: {e!r}'
        return out
    out['ok'] = True
    return out


def log_email_health(report: dict) -> None:
    """Log the email health report at startup (or anywhere)."""
    if report.get('ok'):
        logger.info(
            "EMAIL STATUS · Resend API: OK · Domain: %s · Sandbox: OFF · Ready: YES",
            report.get('domain'),
        )
    else:
        logger.error(
            "EMAIL STATUS · Resend API: %s · Domain: %s · Sandbox: %s · Ready: NO · detail=%s",
            'OK' if report.get('api_reachable') else 'NOT_REACHABLE',
            report.get('domain') or '—',
            'ON' if report.get('sandbox') else 'OFF',
            report.get('detail'),
        )
