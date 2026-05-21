"""ITER130 · Sanitize LLM meta-responses + retry the dirty ones with a
tighter prompt. Runs after `iter130_bulk_translate_en_us.py`."""
from __future__ import annotations

import json
import os
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv(ROOT / '.env')
except Exception:
    pass

from services.relational_translation import translate, _build_prompt, _wrap_dnt, _unwrap_dnt, DEFAULT_DNT_TERMS, _emergent_key, DEFAULT_MODEL  # noqa
import asyncio
import logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger('iter130-clean')

EN_US = Path('/app/frontend/src/i18n/strings/en-US.json')
IT_IT = Path('/app/frontend/src/i18n/strings/it-IT.json')

_META_PREAMBLES = [
    re.compile(r"^\s*#+\s.*$", re.M),                              # # heading lines
    re.compile(r"^\s*\*\*[^*]+\*\*\s*$", re.M),                    # **bold** standalone lines
    re.compile(r"^[━─\-]{3,}.*$", re.M),                           # divider lines
    re.compile(r"^\s*(\*\*)?(Source|Target|Output|Note|Token|Status):.*$", re.I | re.M),
    re.compile(r"^\s*(?:I'?m\s+(?:ready|going|happy)|Please provide|Here(?:'s| is)|I'?ll\s+translate|I\s+would|I\s+will).*$", re.I | re.M),
    re.compile(r"^\s*\(.*MOOD for DESIGN.*\)\s*$", re.I | re.M),
]
_CLEAN_HEAD_RX = re.compile(r"^\s*#+\s+(.+?)\s*$")


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


def is_meta(text: str) -> bool:
    if not text:
        return False
    if re.search(r"^I'?m (ready|going to|happy)|^Please provide|^Here'?s the|^Here is the|^I'?ll (translate|rewrite|re-author)", text.strip(), re.I):
        return True
    return False


def sanitize(text: str) -> str:
    """Strip markdown headers, dividers, meta preambles. Return the surviving
    editorial body. If only a single `# Heading` survives, unwrap it."""
    if not text:
        return text
    s = text
    # If text starts with model preamble lines, drop the preamble entirely.
    if is_meta(s):
        # Try to extract content after the meta — usually after a blank line.
        parts = re.split(r"\n\s*\n", s, maxsplit=1)
        if len(parts) == 2:
            s = parts[1]
        else:
            return ''  # nothing usable

    for rx in _META_PREAMBLES:
        s = rx.sub('', s)
    s = re.sub(r"\n{3,}", "\n\n", s).strip()
    # If after cleanup the entire payload was a single `# heading`, unwrap.
    if s.startswith('#'):
        first = s.split('\n', 1)[0]
        m = _CLEAN_HEAD_RX.match(first)
        if m and (len(s.split('\n', 1)) == 1 or not s.split('\n', 1)[1].strip()):
            s = m.group(1)
    # Drop trailing fragments like `↓`, "Add the first one ↓"
    return s.strip()


def needs_clean(text: str) -> bool:
    if not text:
        return False
    if re.search(r"^\s*#\s", text) or re.search(r"^\s*\*\*[A-Z]", text):
        return True
    if re.search(r"\bSource text\b|\bSource:\b|\bTarget:\b|^Note:|^Token|Token budget", text, re.I):
        return True
    if re.search(r"^I'?m (ready|going|happy)|^Please provide|^I'?ll (translate|rewrite|re-author)|^Here(?:'s| is) (?:the|a|my|your)", text.strip(), re.I):
        return True
    return False


# ── Re-translate with a stricter prompt ───────────────────────
_STRICT_SYSTEM = (
    "You are MOOD for DESIGN™'s in-house editorial translator. "
    "Respond with ONE line of plain English — no markdown, no headers, "
    "no preamble, no meta-commentary, no quotation marks. Plain text only."
)


def strict_translate(source_it: str, key: str) -> str:
    """Calls the LLM directly with a much stricter system prompt to avoid
    meta-preambles. Falls back to the regular translate() on failure."""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage  # type: ignore
        masked, recovered = _wrap_dnt(source_it, DEFAULT_DNT_TERMS)
        user_msg = (
            "Re-author this Italian copy into editorial American English. "
            "Output ONLY the rewritten English text. No commentary.\n\n"
            f"ITALIAN: {masked}\n\nENGLISH:"
        )
        chat = LlmChat(
            api_key=_emergent_key(),
            session_id=f"ale-strict-{key[:20]}",
            system_message=_STRICT_SYSTEM,
        ).with_model(*DEFAULT_MODEL)

        async def _call():
            return await chat.send_message(UserMessage(text=user_msg))
        try:
            out = asyncio.run(_call())
        except RuntimeError:
            loop = asyncio.new_event_loop()
            try:
                out = loop.run_until_complete(_call())
            finally:
                loop.close()
        if isinstance(out, dict):
            out = out.get('content', '') or ''
        out = (out or '').strip().strip('"').strip("'").strip()
        out = _unwrap_dnt(out, recovered)
        # Final defensive cleanup.
        return sanitize(out)
    except Exception as e:
        log.warning("strict_translate failed for %s: %s", key, e)
        return ''


def main():
    en = json.loads(EN_US.read_text(encoding='utf-8'))
    it = json.loads(IT_IT.read_text(encoding='utf-8'))
    en_fl = flatten(en)
    it_fl = flatten(it)

    dirty = [(k, v) for k, v in en_fl.items() if needs_clean(v)]
    log.info("Dirty en-US entries: %d", len(dirty))

    fixed = 0
    for i, (key, dirty_val) in enumerate(dirty, 1):
        # First try local sanitize.
        cleaned = sanitize(dirty_val)
        # If cleanup left something usable and short, accept it.
        if cleaned and not needs_clean(cleaned) and len(cleaned) <= len(dirty_val) + 50:
            set_path(en, key, cleaned)
            fixed += 1
            log.info("[%d/%d] sanitized · %s · %s", i, len(dirty), key, cleaned[:80])
            continue
        # Otherwise, re-translate with the strict prompt from the IT source.
        it_src = it_fl.get(key, '')
        if not it_src:
            log.warning("[%d/%d] no IT source for %s — keeping clean fallback", i, len(dirty), key)
            if cleaned:
                set_path(en, key, cleaned)
                fixed += 1
            continue
        new = strict_translate(it_src, key)
        if new and not needs_clean(new):
            set_path(en, key, new)
            fixed += 1
            log.info("[%d/%d] retranslated · %s · %s", i, len(dirty), key, new[:80])
        elif cleaned:
            set_path(en, key, cleaned)
            fixed += 1
            log.warning("[%d/%d] kept sanitized version · %s", i, len(dirty), key)

        if fixed and fixed % 10 == 0:
            EN_US.write_text(json.dumps(en, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
            log.info("Checkpoint saved (%d fixed so far)", fixed)

    EN_US.write_text(json.dumps(en, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    log.info("DONE · fixed=%d / %d dirty", fixed, len(dirty))


if __name__ == '__main__':
    main()
