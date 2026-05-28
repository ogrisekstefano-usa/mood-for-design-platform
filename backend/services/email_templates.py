"""ITER143D · Cinematic email templates.

Each template is a small Python function that returns
`(subject, html_body, text_body)` for a given context dict.

Design principles
─────────────────
• Inline CSS only — email clients have terrible CSS support.
• Tables for layout — same reason.
• System fonts + Cormorant Garamond fallback chain.
• Dark cinematic palette by default (matches Blueprint Command Center™).
• Tenant overrides come from `tenant_email_settings` (logo + primary_color
  + footer_signature + sender). When no tenant setting exists we fall
  back to MOOD platform defaults.
• Locale-aware: every body of copy lives in the Dynamic Editorial Runtime™
  under `email.{template_key}.{block}` keys. If a locale is missing
  we use the IT source (it never leaks foreign-language).

Templates implemented (P0)
──────────────────────────
  • password_reset
  • invite
  • onboarding
  • lead_captured
  • proposal_ready          (placeholder — surface ready)
  • journey_started         (placeholder — surface ready)
  • magic_link

The HTML structure is shared via _wrap_email() so all templates feel
like part of the same editorial system.
"""
from __future__ import annotations

import logging
from typing import Dict, Optional, Tuple

logger = logging.getLogger(__name__)

# Default platform branding (used when tenant_email_settings is empty).
PLATFORM_DEFAULTS = {
    "brand_name":       "MOOD for DESIGN™",
    "primary_color":    "#7ce4f5",
    "accent_color":     "#e8ebf0",
    "background":       "#050608",
    "card_background":  "#0e1014",
    "ink":              "#e8ebf0",
    "ink_soft":         "rgba(232,235,240,0.6)",
    "footer_signature": "MOOD for DESIGN™ · Curated atmospheres for international ateliers.",
    "support_email":    "support@moodfordesign.com",
    "logo_url":         "",
}


def _branding(tenant_settings: Optional[dict]) -> Dict[str, str]:
    """Merge tenant_email_settings on top of platform defaults."""
    out = dict(PLATFORM_DEFAULTS)
    if not tenant_settings:
        return out
    for src, dst in (
        ("sender_name",       "brand_name"),
        ("primary_color",     "primary_color"),
        ("accent_color",      "accent_color"),
        ("footer_signature",  "footer_signature"),
        ("support_email",     "support_email"),
        ("logo_url",          "logo_url"),
    ):
        v = (tenant_settings or {}).get(src)
        if v:
            out[dst] = v
    return out


def _wrap_email(*, brand: Dict[str, str], preheader: str, body_html: str) -> str:
    """The shared cinematic shell. body_html is dropped into the central card."""
    logo_block = ""
    if brand.get("logo_url"):
        logo_block = (
            f'<img src="{brand["logo_url"]}" alt="{brand["brand_name"]}" '
            f'style="display:block;max-height:32px;margin:0 auto 28px;border:0;outline:none;text-decoration:none" />'
        )
    else:
        logo_block = (
            f'<div style="font-family:Georgia,\'Cormorant Garamond\',serif;'
            f'font-style:italic;font-size:18px;letter-spacing:0.02em;'
            f'color:{brand["ink"]};text-align:center;margin:0 0 28px;">'
            f'{brand["brand_name"]}</div>'
        )
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark light" />
  <meta name="supported-color-schemes" content="dark light" />
  <title>{brand["brand_name"]}</title>
  <style>
    /* Apple Mail / Gmail iOS dark-mode hardening (ITER167 R4).
       The cinematic palette IS dark by default — these rules force
       the few light-mode clients to KEEP the dark intent so the
       bronze/cream contrast never inverts on the client side.       */
    :root {{
      color-scheme: dark light;
      supported-color-schemes: dark light;
    }}
    /* CTA: never let a client invert the bronze/cyan accent. */
    .mfd-cta-link {{ color: #050608 !important; }}
    /* Gmail dark-mode color-block override safety net. */
    @media (prefers-color-scheme: dark) {{
      .mfd-card    {{ background:#0e1014 !important; }}
      .mfd-ink     {{ color:#e8ebf0 !important; }}
      .mfd-ink-soft{{ color:rgba(232,235,240,0.7) !important; }}
    }}
    /* Block Outlook / Gmail "blue link auto-styling". */
    a {{ color: inherit; text-decoration: none; }}
    /* Mobile: extra breathing room for the CTA on iPhone screens. */
    @media (max-width: 480px) {{
      .mfd-card    {{ padding: 32px 22px !important; }}
      .mfd-cta-cell{{ padding: 18px 18px !important; }}
    }}
  </style>
</head>
<body style="margin:0;padding:0;background:{brand['background']};color:{brand['ink']};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <!-- Preheader (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;color:transparent;">{preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{brand['background']};padding:48px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
          <tr>
            <td style="padding:0 0 24px;">{logo_block}</td>
          </tr>
          <tr>
            <td class="mfd-card" style="background:{brand['card_background']};border:1px solid rgba(232,235,240,0.06);border-radius:12px;padding:40px 36px;">
              {body_html}
            </td>
          </tr>
          <tr>
            <td style="padding:28px 8px 0;text-align:center;font-size:11px;line-height:1.6;color:{brand['ink_soft']};font-family:Georgia,'Cormorant Garamond',serif;font-style:italic;">
              {brand['footer_signature']}<br/>
              <a href="mailto:{brand['support_email']}" style="color:{brand['ink_soft']};text-decoration:none;">{brand['support_email']}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _button(label: str, href: str, primary: str, ink: str) -> str:
    return (
        f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">'
        f'  <tr><td style="border-radius:8px;background:{primary};">'
        f'    <a href="{href}" target="_blank" style="display:inline-block;padding:13px 26px;'
        f'      font-size:12px;letter-spacing:0.16em;text-transform:uppercase;text-decoration:none;'
        f'      color:#050608;font-weight:600;">{label}</a>'
        f'  </td></tr>'
        f'</table>'
    )


def _eyebrow(text: str, color: str) -> str:
    return (
        f'<div style="font-size:10px;letter-spacing:0.32em;text-transform:uppercase;'
        f'color:{color};opacity:0.7;margin-bottom:12px;">{text}</div>'
    )


def _title(text: str, ink: str) -> str:
    return (
        f'<h1 style="margin:0 0 18px;font-family:Georgia,\'Cormorant Garamond\',serif;'
        f'font-style:italic;font-size:28px;line-height:1.2;color:{ink};">{text}</h1>'
    )


def _p(text: str, ink_soft: str) -> str:
    return f'<p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:{ink_soft};">{text}</p>'


# ─── Template: password_reset ─────────────────────────────────────────
def password_reset(ctx: dict) -> Tuple[str, str, str]:
    brand = _branding(ctx.get("tenant_settings"))
    name = ctx.get("first_name") or ""
    greeting = f"Ciao {name}," if name else "Ciao,"
    reset_url = ctx["reset_url"]
    body_text = ctx.get("locale_copy", {}).get("body") or (
        "Hai richiesto di reimpostare la password del tuo account "
        f"{brand['brand_name']}. Clicca il pulsante qui sotto per "
        "scegliere una nuova password. Il link è valido un'ora."
    )
    body_html = (
        _eyebrow(ctx.get("locale_copy", {}).get("eyebrow", "Reset Password"),
                 brand["primary_color"])
        + _title(ctx.get("locale_copy", {}).get("title",
                 "Reimposta la tua password."), brand["ink"])
        + _p(greeting, brand["ink_soft"])
        + _p(body_text, brand["ink_soft"])
        + _button(ctx.get("locale_copy", {}).get("cta", "Scegli nuova password"),
                  reset_url, brand["primary_color"], brand["ink"])
        + _p("Se non hai richiesto tu il reset, ignora questa email. "
             "Il link scade automaticamente.", brand["ink_soft"])
    )
    preheader = ctx.get("locale_copy", {}).get("preheader",
        "Reimposta la tua password — link valido un'ora.")
    subject = ctx.get("locale_copy", {}).get("subject",
        f"{brand['brand_name']} · Reset della password")
    text = f"{greeting}\n\n{body_text}\n\n{reset_url}\n\n— {brand['footer_signature']}"
    return subject, _wrap_email(brand=brand, preheader=preheader, body_html=body_html), text


# ─── Template: invite ─────────────────────────────────────────────────
def invite(ctx: dict) -> Tuple[str, str, str]:
    brand = _branding(ctx.get("tenant_settings"))
    inviter = ctx.get("inviter_name") or brand["brand_name"]
    accept_url = ctx["accept_url"]
    locale = ctx.get("locale_copy", {})
    eyebrow = locale.get("eyebrow", "Sei stato invitato")
    title = locale.get("title", f"{inviter} ti invita.")
    body = locale.get("body",
        f"Ti aspetta uno spazio personale in {brand['brand_name']} — "
        "accedi e completa il tuo profilo per cominciare.")
    body_html = (
        _eyebrow(eyebrow, brand["primary_color"])
        + _title(title, brand["ink"])
        + _p(body, brand["ink_soft"])
        + _button(locale.get("cta", "Accetta l'invito"),
                  accept_url, brand["primary_color"], brand["ink"])
        + _p("Se l'invito non è per te, ignora questa email.", brand["ink_soft"])
    )
    subject = locale.get("subject", f"{inviter} ti invita su {brand['brand_name']}")
    preheader = locale.get("preheader", subject)
    text = f"{title}\n\n{body}\n\n{accept_url}\n\n— {brand['footer_signature']}"
    return subject, _wrap_email(brand=brand, preheader=preheader, body_html=body_html), text


# ─── Template: onboarding ─────────────────────────────────────────────
def onboarding(ctx: dict) -> Tuple[str, str, str]:
    brand = _branding(ctx.get("tenant_settings"))
    name = ctx.get("first_name") or ""
    cta_url = ctx.get("cta_url") or ctx.get("login_url")
    locale = ctx.get("locale_copy", {})
    body_html = (
        _eyebrow(locale.get("eyebrow", "Benvenuto"), brand["primary_color"])
        + _title(locale.get("title",
            f"Benvenuto in {brand['brand_name']}, {name}." if name
            else f"Benvenuto in {brand['brand_name']}."), brand["ink"])
        + _p(locale.get("body",
            "Lo spazio che cura il tuo Design Journey™ è pronto. "
            "Accedi quando vuoi — gli ambienti si compongono con te."),
            brand["ink_soft"])
        + (_button(locale.get("cta", "Entra nel tuo spazio"),
                   cta_url, brand["primary_color"], brand["ink"])
           if cta_url else "")
    )
    subject = locale.get("subject", f"Benvenuto in {brand['brand_name']}")
    preheader = locale.get("preheader", "Il tuo Design Journey™ è iniziato.")
    text = f"{subject}\n\n{cta_url or ''}\n\n— {brand['footer_signature']}"
    return subject, _wrap_email(brand=brand, preheader=preheader, body_html=body_html), text


# ─── Template: lead_captured ──────────────────────────────────────────
def lead_captured(ctx: dict) -> Tuple[str, str, str]:
    brand = _branding(ctx.get("tenant_settings"))
    studio_name = ctx.get("studio_name") or brand["brand_name"]
    body_html = (
        _eyebrow("Conferma", brand["primary_color"])
        + _title("Abbiamo ricevuto il tuo Design Journey™.", brand["ink"])
        + _p(f"{studio_name} sta leggendo la tua richiesta. Ti scriviamo presto.",
             brand["ink_soft"])
    )
    subject = f"{studio_name} · Abbiamo ricevuto la tua richiesta"
    preheader = "Il tuo Design Journey™ è in lettura."
    text = subject
    return subject, _wrap_email(brand=brand, preheader=preheader, body_html=body_html), text


# ─── Template: magic_link ─────────────────────────────────────────────
def magic_link(ctx: dict) -> Tuple[str, str, str]:
    """ITER167 Round 3 · Email Continuity™.

    Cinematic letter from the studio (NOT a software auth notification).
    Structure:
      • small studio logo (mark)
      • eyebrow (e.g. "IL TUO SPAZIO PROGETTUALE")
      • cinematic title in italic Cormorant
      • optional hero quote (drawn from the brief)
      • short editorial body
      • single, mobile-first CTA
      • real signature (referente_name / studio_name)

    Mobile-first: padding generous, CTA min-height 44px, font sizes scale,
    dark-mode safe (uses explicit hex colors on every element).
    Locale-aware: all strings come from `ctx['locale_copy']` populated by
    `_enrich_with_editorial`. Hardcoded Italian only as safety net.
    """
    brand = _branding(ctx.get("tenant_settings"))
    link = ctx["magic_url"]
    locale = ctx.get("locale_copy", {}) or {}

    studio_name    = ctx.get("studio_name")    or brand["brand_name"]
    first_name     = (ctx.get("first_name")    or "").strip()
    referente_name = (ctx.get("referente_name") or "").strip()
    hero_quote     = (ctx.get("hero_quote")    or "").strip()

    # Editorial source-of-truth (with editorial fallbacks)
    eyebrow_txt = locale.get("eyebrow")  or "Il tuo spazio progettuale"
    title_txt = locale.get("title") or (
        f"Bentornato, {first_name}." if first_name else "Bentornato nel tuo spazio."
    )
    body_txt = locale.get("body") or (
        "Abbiamo preparato il tuo spazio progettuale. "
        "Da qui potrai continuare il tuo Design Journey™, "
        "condividere idee e confrontarti con noi."
    )
    cta_txt   = locale.get("cta")       or "Apri il tuo spazio progettuale"
    micro_txt = locale.get("microcopy") or (
        "Il tuo accesso è personale. Potrai rientrare in qualsiasi momento."
    )
    sign_off  = locale.get("sign_off")  or "Con cura,"
    signer = referente_name or studio_name

    # Cinematic body — mobile-first inline styling, dark-mode safe.
    quote_block = ""
    if hero_quote:
        quote_block = (
            f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" '
            f'style="margin:0 0 24px 0;width:100%;">'
            f'  <tr><td style="border-left:2px solid {brand["primary_color"]};padding:8px 0 8px 18px;">'
            f'    <p style="margin:0;font-family:Georgia,\'Cormorant Garamond\',serif;'
            f'    font-style:italic;font-size:18px;line-height:1.45;color:{brand["ink"]};">'
            f'    \u201C{hero_quote}\u201D'
            f'    </p>'
            f'  </td></tr>'
            f'</table>'
        )

    body_html = (
        _eyebrow(eyebrow_txt, brand["primary_color"])
        + _title(title_txt, brand["ink"])
        + quote_block
        + _p(body_txt, brand["ink_soft"])
        + _mobile_cta(cta_txt, link, brand["primary_color"])
        + _p(micro_txt, brand["ink_soft"])
        + _signature(sign_off, signer, brand["ink"], brand["ink_soft"])
    )

    subject   = locale.get("subject")   or f"{studio_name} \u00b7 Il tuo spazio progettuale ti aspetta"
    preheader = locale.get("preheader") or "Apri il link per continuare il tuo Design Journey\u2122."

    text = (
        f"{title_txt}\n\n"
        + (f"\u201C{hero_quote}\u201D\n\n" if hero_quote else "")
        + f"{body_txt}\n\n"
        f"{cta_txt}: {link}\n\n"
        f"{micro_txt}\n\n"
        f"{sign_off}\n{signer}"
    )
    return subject, _wrap_email(brand=brand, preheader=preheader, body_html=body_html), text


# ─── Email Continuity™ helpers (ITER167.R3) ────────────────────────────
def _mobile_cta(label: str, href: str, primary: str) -> str:
    """Big, tappable, mobile-first CTA. min-height ~52px (44px target + padding)."""
    return (
        f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" '
        f'style="margin:28px 0;width:100%;">'
        f'  <tr><td class="mfd-cta-cell" align="center" style="border-radius:6px;background:{primary};">'
        f'    <a href="{href}" target="_blank" class="mfd-cta-link" '
        f'       style="display:block;padding:18px 24px;'
        f'              font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;'
        f'              font-size:13px;letter-spacing:0.18em;text-transform:uppercase;'
        f'              text-decoration:none;color:#050608;font-weight:600;'
        f'              min-height:18px;line-height:1.4;">'
        f'      {label}'
        f'    </a>'
        f'  </td></tr>'
        f'</table>'
    )


def _signature(sign_off: str, signer: str, ink: str, ink_soft: str) -> str:
    return (
        f'<div style="margin-top:36px;padding-top:24px;border-top:1px solid rgba(232,235,240,0.08);">'
        f'  <p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:{ink_soft};">{sign_off}</p>'
        f'  <p style="margin:0;font-family:Georgia,\'Cormorant Garamond\',serif;'
        f'  font-style:italic;font-size:18px;color:{ink};">{signer}</p>'
        f'</div>'
    )


# ─── Template: generic notification (proposal_ready, journey_started…) ─
def generic(ctx: dict) -> Tuple[str, str, str]:
    brand = _branding(ctx.get("tenant_settings"))
    title = ctx.get("title", brand["brand_name"])
    body = ctx.get("body", "")
    cta_label = ctx.get("cta_label")
    cta_url = ctx.get("cta_url")
    body_html = (
        _eyebrow(ctx.get("eyebrow", "Aggiornamento"), brand["primary_color"])
        + _title(title, brand["ink"])
        + _p(body, brand["ink_soft"])
        + (_button(cta_label, cta_url, brand["primary_color"], brand["ink"])
           if cta_label and cta_url else "")
    )
    subject = ctx.get("subject", title)
    preheader = ctx.get("preheader", title)
    text = f"{title}\n\n{body}\n\n{cta_url or ''}\n\n— {brand['footer_signature']}"
    return subject, _wrap_email(brand=brand, preheader=preheader, body_html=body_html), text


REGISTRY = {
    "password_reset": password_reset,
    "invite":         invite,
    "onboarding":     onboarding,
    "lead_captured":  lead_captured,
    "magic_link":     magic_link,
    # ITER167.R3 · Email Continuity™ — post-3-step welcome reuses the same
    # cinematic composer as magic_link, with editorial copy from
    # `email.space_ready.*` editorial blocks.
    "space_ready":    magic_link,
    "partnership_request": lead_captured,  # ITER146.A · reuse same composer, copy diverges via editorial
    "proposal_ready": generic,
    "journey_started": generic,
    "professional_partner_request": generic,
    "advisor_referral": generic,
    "generic":        generic,
}

# ITER145.A · Editorial Runtime™ convergence — map template_key →
# editorial namespace key. The system reads per-locale copy from
# editorial_blocks (system.email.*) and merges it into `ctx['locale_copy']`
# BEFORE the legacy template function runs. This way the hardcoded
# fallback below stays as a safety net (zero-downtime migration).
_EDITORIAL_TEMPLATE_KEY = {
    "password_reset": "auth_reset",
    "invite":         "invite",
    "onboarding":     "onboarding",
    "lead_captured":  "lead_captured",
    "magic_link":     "magic_link",
    "space_ready":    "space_ready",  # ITER167.R3
    "partnership_request": "partnership_request",  # ITER146.A
}


def _interpolate(value: str, vars: dict) -> str:
    """Simple {{var}} substitution. Missing vars → empty string."""
    if not value or not isinstance(value, str) or "{{" not in value:
        return value or ""
    out = value
    for k, v in (vars or {}).items():
        out = out.replace("{{" + k + "}}", str(v if v is not None else ""))
    # Clean up any remaining placeholders
    import re
    out = re.sub(r"\{\{[a-zA-Z0-9_\.]+\}\}", "", out)
    return out


def _enrich_with_editorial(template_key: str, ctx: dict) -> dict:
    """Pull Editorial Runtime™ copy and merge into ctx['locale_copy'].

    Strict: locale is filtered to tenant.enabled_locales by the resolver
    so we never render a foreign-language leak.
    """
    editorial_key = _EDITORIAL_TEMPLATE_KEY.get(template_key)
    if not editorial_key:
        return ctx  # generic / unmapped → keep legacy behaviour
    try:
        from services.email_editorial_resolver import resolve_email_copy
    except Exception:
        return ctx
    locale = (ctx.get("locale") or "it-IT")
    tenant_id = ctx.get("tenant_id")
    try:
        copy = resolve_email_copy(editorial_key, locale, tenant_id=tenant_id)
    except Exception as e:
        logger.debug("editorial email copy resolve failed for %s: %s",
                     template_key, e)
        return ctx
    if not copy:
        return ctx
    # Variables available to interpolation come from ctx + tenant brand.
    brand = _branding(ctx.get("tenant_settings") or ctx.get("tenant_identity"))
    interp_vars = {
        "studio_name":    brand.get("brand_name") or "MOOD for DESIGN™",
        "brand_name":     brand.get("brand_name") or "MOOD for DESIGN™",
        "first_name":     ctx.get("first_name") or "",
        "inviter_name":   ctx.get("inviter_name") or "",
        # ITER167.R3 · Email Continuity™
        "referente_name": ctx.get("referente_name") or "",
        "hero_quote":     ctx.get("hero_quote") or "",
    }
    resolved = {k: _interpolate(v, interp_vars) for k, v in copy.items()}
    # Merge under locale_copy WITHOUT overriding any caller-provided keys
    # (so call-sites can still hard-override individual fields if needed).
    locale_copy = dict(resolved)
    locale_copy.update(ctx.get("locale_copy") or {})
    ctx = {**ctx, "locale_copy": locale_copy, "editorial_resolved": True}
    return ctx


def render(template_key: str, ctx: dict) -> Tuple[str, str, str]:
    """Render an email template.

    Path:
      1. Editorial Runtime™ resolves per-locale copy → ctx['locale_copy']
      2. Legacy template function composes the HTML using locale_copy
         (with hardcoded Italian fallback if a field is missing).
    """
    ctx = _enrich_with_editorial(template_key, ctx)
    fn = REGISTRY.get(template_key) or generic
    return fn(ctx)

