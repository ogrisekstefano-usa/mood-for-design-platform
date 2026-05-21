"""ITER130 · Bulk Editorial Refinement™ runner.

Scans `/app/frontend/src/i18n/strings/en-US.json` for residual Italian leaks
(AST-remediator artifacts where keys were created but values were left in
Italian) and runs each through `relational_translation.translate(...)` —
Claude Sonnet 4.5, DNT-aware, editorial register.

Writes back into the same file. Idempotent: a re-run only translates what is
still Italian. Persists progress every N items so it can be resumed if the
worker is killed.

Usage:
    cd /app/backend && python3 -m scripts.iter130_bulk_translate_en_us
"""
from __future__ import annotations

import json
import logging
import os
import re
import sys
import time
from pathlib import Path

# Make the backend package importable when run as a one-off script.
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# Load /app/backend/.env so EMERGENT_LLM_KEY is in os.environ.
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv(ROOT / '.env')
except Exception:
    pass

from services.relational_translation import translate  # noqa: E402

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger('iter130')

STRINGS_DIR = Path('/app/frontend/src/i18n/strings')
EN_US_FILE  = STRINGS_DIR / 'en-US.json'
IT_IT_FILE  = STRINGS_DIR / 'it-IT.json'

# Italian fingerprint — must catch obvious leaks without snagging English copy
# that happens to share short connectives.
_IT_RX = re.compile(
    r"\b(il|lo|la|gli|le|della|dello|delle|degli|nella|nelle|negli|alla|alle|"
    r"allo|agli|tuoi|tue|tuo|tua|nostro|nostra|nostri|nostre|sono|siamo|essere|"
    r"già|più|perché|può|però|questa|questo|quella|quello|questi|queste|ogni|"
    r"nessun|nessuna|tutti|tutte|aggiungi|annulla|salva|chiudi|carica|scegli|"
    r"conferma|raccogli|aggiorna|crea|modifica|riprova|sceglie|atmosfera|"
    r"materico|composizione|cliente|progetto|moodboard|ispirazione)\b",
    re.IGNORECASE,
)
# Italian-only accent fingerprint (English copy never carries è/à/ù).
_IT_ACCENT = re.compile(r"[àèéìòù]")


def looks_italian(text: str) -> bool:
    if not text or len(text) < 4:
        return False
    if _IT_ACCENT.search(text):
        return True
    # Require at least 2 IT markers to avoid false positives on short labels.
    return len(_IT_RX.findall(text)) >= 2


def flatten(o, prefix=''):
    out = {}
    if isinstance(o, dict):
        for k, v in o.items():
            p = f'{prefix}.{k}' if prefix else k
            out.update(flatten(v, p))
    elif isinstance(o, str):
        out[prefix] = o
    return out


def set_path(d, path, value):
    parts = path.split('.')
    cur = d
    for p in parts[:-1]:
        if p not in cur or not isinstance(cur[p], dict):
            cur[p] = {}
        cur = cur[p]
    cur[parts[-1]] = value


def main(limit: int | None = None, save_every: int = 25):
    en_doc = json.loads(EN_US_FILE.read_text(encoding='utf-8'))
    it_doc = json.loads(IT_IT_FILE.read_text(encoding='utf-8'))

    en_flat = flatten(en_doc)
    it_flat = flatten(it_doc)

    candidates = []
    for key, en_val in en_flat.items():
        if looks_italian(en_val):
            # Prefer the IT source when available (editorial source of truth).
            source_text = it_flat.get(key, en_val)
            candidates.append((key, source_text, en_val))

    log.info("Italian-leaking en-US keys: %d", len(candidates))
    if limit is not None:
        candidates = candidates[:limit]
        log.info("Running on the first %d candidates", len(candidates))

    translated = skipped = failed = 0
    t0 = time.time()
    for i, (key, src, leak) in enumerate(candidates, 1):
        try:
            r = translate(src, source_locale='it', target_locale='en-US')
            if r.translated and r.localized and r.localized.strip() and r.localized != src:
                set_path(en_doc, key, r.localized.strip())
                translated += 1
                log.info("[%d/%d] ✓ %s · %dms", i, len(candidates), key, r.duration_ms or 0)
            else:
                failed += 1
                log.warning("[%d/%d] ✗ %s · error=%s", i, len(candidates), key, r.error)
        except Exception as e:
            failed += 1
            log.exception("[%d/%d] ✗ %s · exception=%s", i, len(candidates), key, e)

        if translated and translated % save_every == 0:
            EN_US_FILE.write_text(json.dumps(en_doc, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
            log.info("Checkpoint saved (%d translated so far)", translated)

    # Final save.
    EN_US_FILE.write_text(json.dumps(en_doc, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    dt = time.time() - t0
    log.info("DONE · translated=%d failed=%d skipped=%d · %.1fs", translated, failed, skipped, dt)


if __name__ == '__main__':
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument('--limit', type=int, default=None)
    p.add_argument('--save-every', type=int, default=25)
    args = p.parse_args()
    main(limit=args.limit, save_every=args.save_every)
