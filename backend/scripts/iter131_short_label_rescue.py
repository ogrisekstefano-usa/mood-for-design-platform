"""ITER131 · Short-label Italian leak rescue.

The original bulk translator required 2+ Italian markers per value to flag a
leak. Short labels like "Chiudi" / "Aggiungi" / "Riprova" only carry 1
marker and slipped through. This pass uses a smaller, stricter Italian
fingerprint plus a defensive English-marker check, then re-translates the
survivors through the strict prompt."""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv(ROOT / '.env')
except Exception:
    pass

from scripts.iter130_sanitize_translations import strict_translate, sanitize  # noqa
import logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger('iter131-short')

EN_US = Path('/app/frontend/src/i18n/strings/en-US.json')
IT_IT = Path('/app/frontend/src/i18n/strings/it-IT.json')

IT_SINGLE = re.compile(
    r"\b(?:della|delle|degli|dello|tuoi|tue|tuo|tua|nostro|nostra|nessun|nessuna|"
    r"aggiungi|annulla|salva|chiudi|carica|scegli|conferma|raccogli|aggiorna|crea|"
    r"modifica|riprova|esporta|stampa|condividi|pubblica|atmosfera|materico|atelier|"
    r"sala|impostazioni|contatti|materialità|ispirazione|prossimi|capitolo|sezione|"
    r"cliente|cosa|vista|vocabolario|inizia|trascina|sfoglia|orfano|hotspot|imposta|"
    r"i primi|riprova|progetto|reference)\b",
    re.I,
)
EN_MARKERS = re.compile(
    r"\b(?:the|and|with|for|to|of|in|is|are|was|been|will|can|your|our|every|"
    r"this|that|all|some|any|new|here|there|when|until|since|before|after|"
    r"into|under|over|across|inside|outside)\b",
    re.I,
)
ACCENT = re.compile(r"[àèéìòù]")


def flatten(o, p=''):
    out = {}
    if isinstance(o, dict):
        for k, v in o.items():
            out.update(flatten(v, f'{p}.{k}' if p else k))
    elif isinstance(o, str):
        out[p] = o
    return out


def set_path(d, path, value):
    parts = path.split('.')
    cur = d
    for s in parts[:-1]:
        if s not in cur or not isinstance(cur[s], dict):
            cur[s] = {}
        cur = cur[s]
    cur[parts[-1]] = value


def is_italian_short(text: str) -> bool:
    if not text or len(text) < 3:
        return False
    if ACCENT.search(text):
        return True
    if EN_MARKERS.search(text):
        return False
    return bool(IT_SINGLE.search(text))


def main(save_every: int = 25):
    en = json.loads(EN_US.read_text(encoding='utf-8'))
    it = json.loads(IT_IT.read_text(encoding='utf-8'))
    en_fl = flatten(en)
    it_fl = flatten(it)

    suspects = [(k, v) for k, v in en_fl.items() if is_italian_short(v)]
    log.info('Short-label IT suspects: %d', len(suspects))

    fixed = 0
    for i, (key, dirty) in enumerate(suspects, 1):
        src = it_fl.get(key) or dirty
        new = strict_translate(src, key)
        new = sanitize(new) if new else ''
        if not new or is_italian_short(new):
            log.warning('[%d/%d] could not refine · %s · src="%s"', i, len(suspects), key, src[:60])
            continue
        set_path(en, key, new)
        fixed += 1
        if fixed % save_every == 0:
            EN_US.write_text(json.dumps(en, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
            log.info('Checkpoint %d', fixed)
        if i % 10 == 0:
            log.info('[%d/%d] %s · %s → %s', i, len(suspects), key, src[:40], new[:40])

    EN_US.write_text(json.dumps(en, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    log.info('DONE · fixed=%d / %d', fixed, len(suspects))


if __name__ == '__main__':
    main()
