"""ITER167 Round 3 · Email Continuity\u2122 — editorial copy for magic_link.

Populates `editorial_blocks` (scope=system, namespace=email.magic_link)
with the editorial "letter from the studio" copy used by the cinematic
magic_link email template.

Variables available for {{interpolation}}:
  • {{studio_name}}    — tenant brand name
  • {{first_name}}     — client first name
  • {{referente_name}} — primary contact (signature)
  • {{hero_quote}}     — extract from brief (optional)

Locale: IT source. ALE (Automatic Localization Engine) propagates to
the tenant's active locales automatically.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from services.editorial_content_orchestrator import upsert_block  # noqa: E402


MAGIC_LINK = {
    "page_key":  "system-email-magic-link",
    "namespace": "system.email.magic_link",
    "blocks": [
        ("subject",   "subject",   "{{studio_name}} \u00b7 Il tuo spazio progettuale ti aspetta"),
        ("preheader", "preheader", "Apri il link per continuare il tuo Design Journey\u2122."),
        ("eyebrow",   "eyebrow",   "Il tuo spazio progettuale"),
        ("title",     "title",     "Bentornato, {{first_name}}."),
        ("body",      "body",      ("Abbiamo preparato il tuo spazio progettuale. "
                                    "Da qui potrai continuare il tuo Design Journey\u2122, "
                                    "condividere idee e confrontarti con noi.")),
        ("cta",       "cta",       "Apri il tuo spazio progettuale"),
        ("microcopy", "microcopy", ("Il tuo accesso \u00e8 personale. "
                                    "Potrai rientrare nel tuo spazio in qualsiasi momento.")),
        ("sign_off",  "sign_off",  "Con cura,"),
    ],
}


# ──  POST-3-STEP welcome (provisioning email) — separate composition ──
SPACE_READY = {
    "page_key":  "system-email-space-ready",
    "namespace": "system.email.space_ready",
    "blocks": [
        ("subject",   "subject",   "{{studio_name}} \u00b7 Il tuo spazio progettuale \u00e8 pronto"),
        ("preheader", "preheader", "Le tue prime indicazioni ti aspettano."),
        ("eyebrow",   "eyebrow",   "Il tuo spazio progettuale"),
        ("title",     "title",     "Il tuo spazio \u00e8 pronto, {{first_name}}."),
        ("body",      "body",      ("Abbiamo raccolto le tue prime indicazioni e "
                                    "preparato il tuo spazio progettuale. "
                                    "Da qui potrai continuare il tuo Design Journey\u2122, "
                                    "scriverci e richiedere un confronto.")),
        ("cta",       "cta",       "Apri il tuo Client Profile\u2122"),
        ("microcopy", "microcopy", ("Il tuo accesso \u00e8 personale. "
                                    "Potrai rientrare in qualsiasi momento.")),
        ("sign_off",  "sign_off",  "Con cura,"),
    ],
}


def _seed_namespace(ns):
    n = 0
    for key, btype, value in ns["blocks"]:
        full = f"{ns['namespace']}.{key}"
        try:
            upsert_block(
                scope='system',
                page_key=ns['page_key'],
                namespace=ns['namespace'],
                block_key=key,
                block_type=btype,
                source_locale='it',
                source_value=value,
            )
            n += 1
            print(f"[iter167.email] seeded {full}")
        except Exception as e:
            print(f"[iter167.email] FAILED {full}: {e}")
    return n


def main():
    total = 0
    total += _seed_namespace(MAGIC_LINK)
    total += _seed_namespace(SPACE_READY)
    print(f"[iter167.email] done — {total} email.* blocks seeded.")


if __name__ == '__main__':
    main()
