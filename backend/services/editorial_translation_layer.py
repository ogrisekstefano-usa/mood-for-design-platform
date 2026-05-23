"""ITER132 · Editorial Runtime Translation Layer™.

Wraps any DB payload (a record, a list of records, a nested structure) and
returns it with selected text fields translated to the requested locale,
backed by a SHA-1-keyed Translation Memory™ table.

Pipeline:
  1. Walk the payload, collect (record_id, field, source_text) tuples.
  2. Skip any record/field already in the target language (heuristic).
  3. Hash each source. Look up in `editorial_translations`:
       hit  → swap the field with the cached translation.
       miss → call `relational_translation.translate(...)` with Studio
              Voice™ addendum + the locale's narrative directive
              (cinematic / restrained / intellectual / precise / sensorial).
              Persist the row.
  4. Return the mutated payload (caller never touches the LLM).

Hash key = sha1(`source_locale|target_locale|cultural_directive|text`).
That makes the cache "tone-aware": the same source can have multiple
cached translations for the same locale if the directive changes (e.g.
"more cinematic"), without colliding.

The cultural directives below were drafted from the user's brief
(EN-US cinematic, EN-GB restrained, FR-FR intellectual, DE-DE precise,
ES-ES sensorial). They are appended to the system prompt at translation
time.
"""
from __future__ import annotations

import hashlib
import logging
import re
import time
from datetime import datetime, timezone
from typing import Any, Iterable, List, Optional, Sequence, Tuple

from services.relational_translation import translate

log = logging.getLogger(__name__)

# ─── Locale handling ────────────────────────────────────────────────────
# Canonical "translate()" locale codes vs the BCP-47 the frontend speaks.
_BCP47_TO_TRANSLATE = {
    'it-it': 'it',
    'en-us': 'en-US',
    'en-gb': 'en-GB',
    'fr-fr': 'fr',
    'de-de': 'de',
    'es-es': 'es',
    'ar-ae': 'ar',
    'ar':    'ar',
    'it':    'it',
    'en-US': 'en-US',
    'en-GB': 'en-GB',
    'fr':    'fr',
    'de':    'de',
    'es':    'es',
}

# ─── Cultural narrative profiles (ITER132 · brief) ──────────────────────
CULTURAL_DIRECTIVES = {
    'en-US': (
        "Cultural register: EDITORIAL AMERICAN — cinematic, emotionally "
        "immersive, spatial storytelling, luxury-magazine cadence. Lean on "
        "evocative imagery, never SaaS-clinical. Use the active voice and "
        "American spelling. Sentences may breathe; commas are welcome."
    ),
    'en-GB': (
        "Cultural register: EDITORIAL BRITISH — architectural understatement, "
        "quieter sophistication, restrained luxury. Avoid superlatives. "
        "British spelling. The pen is dry, considered, never effusive."
    ),
    'fr': (
        "Cultural register: ÉDITORIAL FRANÇAIS — refined intellectual tone, "
        "cultural and artistic nuance, a touch of literary distance. Use "
        "rich connectors and a calm rhythm. Prefer 'maison', 'atelier', "
        "'composition'. Tu/vous: vouvoyer formally."
    ),
    'de': (
        "Cultural register: REDAKTIONELLES DEUTSCH — precision, material "
        "credibility, technical elegance. Sentences are exact, never "
        "decorative. Prefer 'sorgfältig komponiert', 'material- und "
        "lichtgenau'. Avoid English borrowings when a German term carries "
        "the meaning more precisely."
    ),
    'es': (
        "Cultural register: EDITORIAL ESPAÑOL — warmth, sensory narration, "
        "Mediterranean rhythm. Light cadence, generous adjectives without "
        "becoming florid. Prefer 'atelier', 'composición', 'atmósfera'. "
        "Avoid clinical SaaS register."
    ),
    'ar': (
        "Cultural register: EDITORIAL ARABIC — refined classical Arabic with "
        "a quiet hospitality register. Avoid casual dialect. Honour the "
        "right-to-left reading rhythm."
    ),
}

DEFAULT_DIRECTIVE_VERSION = "iter132.v1"


# ─── LLM meta-response sanitizer ────────────────────────────────────────
# Claude / GPT occasionally prepend a brief preamble ("# OUTPUT", "Here's
# the translation:", "Source:") even when the system prompt forbids it.
# We strip these defensively so the cached value is always clean editorial
# copy.
_META_LINE_RX = re.compile(
    r"^\s*(?:#+\s*[A-Z][^\n]*|\*\*[^\n]+\*\*|(?:Source|Target|Output|Note|Token|Translation|Result|Result/output|English|Italian)\s*[:：][^\n]*|"
    r"(?:Here'?s|Here is|I'?ll|I'?m|Please|This is)\b[^\n]*)$",
    re.M | re.I,
)
_LEAD_HEADING_RX = re.compile(r"^\s*#+\s+", re.M)


def _scrub_llm_response(text: str) -> str:
    """Drop markdown headers, label-prefixed lines, bullet-list preambles
    and meta-commentary."""
    if not text:
        return text
    s = text.strip()
    # If the model opened with a preamble like "I will:", "Here's the
    # translation:", "Output:" we try to recover the actual editorial copy
    # that follows the preamble block.
    PREAMBLE_OPENERS = re.compile(
        r"^(?:I\s+will|I'?ll|I'?m|Here'?s|Here\s+is|Please|This\s+is|"
        r"Output|Source|Target|Translation|Result|English|Italian)\b",
        re.I,
    )
    if PREAMBLE_OPENERS.match(s):
        # Try to find the first paragraph that doesn't look like meta.
        chunks = re.split(r"\n\s*\n", s)
        for chunk in chunks[1:]:
            c = chunk.strip()
            if not c:
                continue
            # Skip bullet lists and label-prefixed chunks.
            if c.startswith('-') or c.startswith('*') or PREAMBLE_OPENERS.match(c):
                continue
            if re.match(r"^[A-Z][a-z]+:\s", c):
                continue
            s = c
            break
        else:
            s = ''
    # Remove residual meta lines.
    s = _META_LINE_RX.sub('', s)
    s = _LEAD_HEADING_RX.sub('', s, count=1)
    s = re.sub(r"\n{3,}", "\n\n", s).strip()
    if (s.startswith('"') and s.endswith('"')) or (s.startswith('"') and s.endswith('"')):
        s = s[1:-1].strip()
    return s


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_locale(locale: Optional[str]) -> Optional[str]:
    """Normalise a header / front-end locale into the translate() vocabulary."""
    if not locale:
        return None
    key = locale.strip().lower()
    return _BCP47_TO_TRANSLATE.get(key)


def parse_accept_language(header: Optional[str]) -> Optional[str]:
    """Read an `Accept-Language` header and return a translate()-friendly code.
    Picks the highest-quality language tag the platform supports."""
    if not header:
        return None
    candidates = []
    for part in header.split(','):
        token = part.strip()
        if not token:
            continue
        if ';' in token:
            tag, rest = token.split(';', 1)
            q = 1.0
            m = re.search(r'q=([0-9.]+)', rest)
            if m:
                try:
                    q = float(m.group(1))
                except ValueError:
                    pass
        else:
            tag, q = token, 1.0
        candidates.append((q, tag.lower()))
    candidates.sort(reverse=True)
    for _, tag in candidates:
        norm = normalize_locale(tag) or normalize_locale(tag.split('-', 1)[0])
        if norm:
            return norm
    return None


# ─── Italian fingerprint (skip-if-already-target heuristic) ─────────────
_IT_RX = re.compile(
    r"\b(?:il|lo|la|gli|le|della|dello|delle|degli|alla|alle|nella|nelle|nel|"
    r"del|dei|delle|tuoi|tue|nostro|nostra|nessun|aggiungi|annulla|salva|chiudi|"
    r"atmosfera|materico|atelier|composizione|moodboard|cliente|progetto|"
    r"ispirazione|capitolo|sezione|residenziale|editoriale|architettonic[oa]|"
    r"sartoriale|materiale|materiali|pavimento|parete|pareti|soffitto|"
    r"tessuto|tessuti|marmo|cucina|salotto|camera|comodino|comodini|"
    r"luce|luminoso|ombra|atmosfera|profondit[àa]|simmetria|simmetric[oa]|"
    r"contemporane[oai]|tradizional[ei]|modern[oai]|antic[oai]|"
    r"vocazione|monumental[ei]|naturale|naturali|caldo|caldi|calda|calde|"
    r"freddo|chiaro|scuro|abitazione|residenza|appartamento|villa|attic[oai]|"
    r"penthouse|continuit[àa]|copertura|copertina|composto|composta|"
    r"livello|livelli|punto|punti|interesse|gioco|giochi|"
    r"interno|esterno|terrazza|terrazze|finitura|finiture|"
    r"sopra|sotto|verso|dentro|fuori|prima|dopo|durante|"
    r"con|tra|fra|presso|verso|secondo|attraverso|"
    r"un[oa']?|una|degli|delle|della|dello|sul|sulla|sulle|sugli|"
    r"essere|stato|stata|stati|state|fatto|fatta|cose|cosa|"
    r"questa|questo|quella|quello|questi|queste|quelli|quelle|"
    r"adesso|ancora|sempre|spesso|talvolta|qualche|ogni|nulla|nessuno|"
    r"buongiorno|buonasera|saluti|grazie|prego|"
    r"pavimentazione|posa|riscaldamento|finestre|porta|porte|colonna|colonne"
    r")\b",
    re.I,
)
_IT_ACC = re.compile(r"[àèéìòù]")
# English-only fingerprint — function words that don't exist in Italian.
# Single match is enough to mark the text as English (used to exclude
# short labels like "Open Studio Pulse" from the IT-leak set).
_EN_RX = re.compile(
    r"\b(?:the|and|with|for|your|our|every|this|that|these|those|"
    r"new|here|there|when|until|since|while|before|after|but|"
    r"because|whose|which|what|how|why|where|who|whom|"
    r"add|open|close|cancel|save|delete|edit|view|search|filter|select|"
    r"into|under|over|across|inside|outside|through|toward|towards|"
    r"have|has|had|does|did|done|been|being|"
    r"about|above|below|between|during|except|except|"
    r"first|last|next|previous|"
    r"its|it's|you're|we're|they're|"
    r"loading|saving|uploading|create|created|update|updated)\b",
    re.I,
)


def looks_italian(text: str) -> bool:
    if not text or len(text) < 4:
        return False
    if _IT_ACC.search(text):
        return True
    markers = _IT_RX.findall(text)
    if len(markers) >= 2:
        return True
    # Single-marker case — only if the text does NOT carry obvious English
    # function words. This catches short editorial titles like
    # "Composizione architettonica" without false-flagging "Materials menu".
    if len(markers) == 1 and not _EN_RX.search(text):
        return True
    return False


# ─── Multi-language source detection (ITER139 · locale-aware orchestration) ─
# Lightweight fingerprints used to classify the source language of a stored
# record so we can translate FROM the actual source, not always from IT.
# Order of evaluation matters — more specific languages first.
_ES_RX = re.compile(
    r"\b(?:el|los|las|una?s?|del|al|para|por|con|sin|entre|sobre|"
    r"hacia|desde|hasta|según|esta|esto|estos|estas|aquel|aquella|"
    r"está|están|son|fue|fueron|hay|hemos|tienen|"
    r"proyecto|cliente|materia[lr]es?|moodboard|estilo|atelier|"
    r"diseño|composición|interior|residencia|hospitalidad|"
    r"añadir|guardar|cancelar|cerrar|continuar|próximo|último|"
    r"hoy|ayer|mañana|gracias|buenos|buenas|nuevo|nueva)\b",
    re.I,
)
_FR_RX = re.compile(
    r"\b(?:le|les|une?|des?|du|au|aux|pour|par|avec|sans|entre|sur|"
    r"vers|depuis|jusqu'à|jusqu'aux|selon|cette|ces|ceux|celle|celles|"
    r"est|sont|était|étaient|avons|avez|ont|"
    r"projet|client|matériaux?|moodboard|style|atelier|"
    r"conception|composition|intérieur|résidence|hospitalité|"
    r"ajouter|enregistrer|annuler|fermer|continuer|prochain|dernier|"
    r"aujourd'hui|hier|demain|merci|bonjour|bonsoir|nouveau|nouvelle)\b",
    re.I,
)
_FR_ACC = re.compile(r"[àâçéèêëîïôûùüÿœæ]")
_DE_RX = re.compile(
    r"\b(?:der|die|das|den|dem|des|ein[ers]?|eine[mnrs]?|für|mit|"
    r"ohne|zwischen|über|nach|vor|seit|bis|gemäß|dieser?|jene[mnrs]?|"
    r"ist|sind|war|waren|haben|hat|hatten|werden|wurde|wurden|"
    r"Projekt|Kunde|Material[ie]?n?|Moodboard|Stil|Atelier|"
    r"Gestaltung|Komposition|Innenraum|Residenz|Gastfreundschaft|"
    r"hinzufügen|speichern|abbrechen|schließen|fortsetzen|nächste|letzte|"
    r"heute|gestern|morgen|danke|guten|neue[ers]?)\b",
)
_DE_UML = re.compile(r"[äöüÄÖÜß]")
_AR_RX = re.compile(r"[\u0600-\u06ff]")  # Any Arabic codepoint

# English markers re-used from _EN_RX above.


def detect_language(text: str) -> Optional[str]:
    """Best-effort language fingerprinting for stored editorial content.

    Returns: 'it' | 'en' | 'es' | 'fr' | 'de' | 'ar' | None (unknown).

    This is intentionally lightweight (regex-only, no LLM). It is used to
    decide whether a record needs translation at all and what the SOURCE
    language is for a downstream LLM call. Short strings (<4 chars) and
    purely numeric / brand-only strings return None so we don't try to
    translate them.
    """
    if not text or not isinstance(text, str):
        return None
    s = text.strip()
    if len(s) < 4:
        return None
    if _AR_RX.search(s):
        return 'ar'
    # German has the highest precision via umlauts/ß
    if _DE_UML.search(s) and _DE_RX.search(s):
        return 'de'
    de_hits = len(_DE_RX.findall(s))
    if de_hits >= 2:
        return 'de'
    # French accents are common; need stronger marker corroboration
    if _FR_RX.search(s) and (_FR_ACC.search(s) or len(_FR_RX.findall(s)) >= 2):
        return 'fr'
    # Spanish
    es_hits = len(_ES_RX.findall(s))
    if es_hits >= 2:
        return 'es'
    if es_hits == 1 and not _EN_RX.search(s) and not _IT_RX.search(s):
        return 'es'
    # Italian
    if looks_italian(s):
        return 'it'
    # English — single English marker, no IT/ES/FR markers
    if _EN_RX.search(s) and not _IT_RX.search(s) and not _ES_RX.search(s):
        return 'en'
    return None


# ─── Locale fallback chain (ITER139) ─────────────────────────────────────
# When a translation fails or is unavailable, fall back along the locale
# family before defaulting to en-US global editorial — NEVER cross-family
# (e.g. en-US must never fall back to es-ES).
_FALLBACK_CHAIN: dict = {
    'it':    ['it', 'en'],
    'en':    ['en'],
    'en-us': ['en-us', 'en-gb', 'en'],
    'en-gb': ['en-gb', 'en-us', 'en'],
    'es':    ['es', 'en'],
    'es-es': ['es-es', 'es', 'en'],
    'fr':    ['fr', 'en'],
    'fr-fr': ['fr-fr', 'fr', 'en'],
    'de':    ['de', 'en'],
    'de-de': ['de-de', 'de', 'en'],
    'ar':    ['ar', 'en'],
}


def locale_fallback_chain(locale: Optional[str]) -> list:
    """Return the ordered fallback chain for a locale. Always terminates
    at 'en' (global editorial baseline)."""
    if not locale:
        return ['en']
    norm = normalize_locale(locale) or locale.lower()
    return _FALLBACK_CHAIN.get(norm, [norm, 'en'])


# ─── LLM preamble / meta-output detector (ITER139) ───────────────────────
# Claude/GPT sometimes break instruction and dump system-prompt acknowledgement
# ("I'm calibrated and ready...", "I am your editorial translator...",
# "Ready. Paste...", "Source language: Italian", etc.) into their reply.
# These responses are toxic if we cache them — they pollute every downstream
# render with chatbot meta-commentary instead of clean editorial copy.
_LLM_PREAMBLE_MARKERS = re.compile(
    r"(?:I'?m\s+(?:calibrated|ready|your)|I\s+am\s+(?:your|ready|here)|"
    r"Understood[.,]?\s+I|Understood[.,]?\s+Here|"
    r"I've\s+absorbed|I\s+have\s+absorbed|"
    r"I\s+(?:will|shall)\s+(?:rewrite|translate|re-?author)|"
    r"Ready\.?\s+Paste|Paste\s+the\s+(?:Italian|source)|"
    r"Source\s+language\s*:|Target\s+language\s*:|"
    r"Awaiting\s+(?:clarification|input|source|the)|"
    r"Before\s+I\s+proceed|"
    r"^---|^━━━|^\*\*Ready\*\*|^\*\*Understood\*\*|"
    r"editorial\s+(?:cultural\s+)?translator|"
    r"may\s+I\s+confirm|"
    r"I\s+notice\s+the\s+INPUT|"
    r"Non[-\s]?negotiable\b|"
    r"register\s*[:：]|voice\s+profile\s*[:：]|"
    r"^Here'?s\s+(?:the|my)|^Here\s+is\s+(?:the|my))",
    re.I | re.M,
)


def looks_like_llm_preamble(text: str, source_text: str = '') -> bool:
    """True if `text` looks like an LLM system-prompt leak rather than a
    clean editorial translation. Used to refuse caching toxic responses.
    """
    if not text:
        return False
    s = text.strip()
    if not s:
        return False
    # Hard length sanity — translations within ±20% of source. Allow up to
    # 3× before deeming it suspicious (the LLM might add a sentence or two
    # culturally), and demand strict guard above that.
    if source_text and len(s) > max(800, 3 * len(source_text)):
        return True
    # Marker scan
    if _LLM_PREAMBLE_MARKERS.search(s):
        return True
    # Bullet-list dumps signal a meta-output, not a single editorial line.
    if s.count('\n- ') >= 3 or s.count('\n* ') >= 3:
        return True
    return False


# ─── TM cache (editorial_translations table) ────────────────────────────
def _content_hash(source_locale: str, target_locale: str,
                  directive_version: str, text: str) -> str:
    """SHA-1 over the full translation context (locale pair + directive
    version + normalised text). Whitespace is collapsed so trivial edits
    do not bust the cache."""
    norm = ' '.join((text or '').split())
    payload = f"{source_locale}|{target_locale}|{directive_version}|{norm}"
    return hashlib.sha1(payload.encode('utf-8')).hexdigest()


def _db():
    """Lazy DB import; returns (db_fn, ok) or (None, False)."""
    try:
        from database import db, db_available
        return (db, db_available())
    except Exception:
        return (None, False)


def _bulk_lookup(tenant_id: Optional[str], hashes: Sequence[str]) -> dict:
    """Return {hash: row} for every cached translation in `hashes`."""
    if not hashes:
        return {}
    db, ok = _db()
    if not ok:
        return {}
    try:
        q = (db().table('editorial_translations')
             .select('content_hash, translated_text, review_status, locked, model, created_at')
             .in_('content_hash', list(hashes)))
        if tenant_id:
            q = q.eq('tenant_id', tenant_id)
        res = q.execute()
        return {r['content_hash']: r for r in (res.data or [])}
    except Exception as e:
        log.warning("editorial_translations bulk_lookup failed: %s", e)
        return {}


def _persist(tenant_id: Optional[str], content_hash: str, source_locale: str,
             target_locale: str, source_text: str, translated_text: str,
             model: str, directive_version: str, source_field: str) -> None:
    db, ok = _db()
    if not ok:
        return
    try:
        db().table('editorial_translations').upsert({
            'tenant_id':         tenant_id,
            'content_hash':      content_hash,
            'source_locale':     source_locale,
            'target_locale':     target_locale,
            'source_text':       source_text,
            'translated_text':   translated_text,
            'model':             model,
            'directive_version': directive_version,
            'source_field':      source_field,
            'review_status':     'ai_suggested',
            'locked':            False,
            'created_at':        _now_iso(),
            'updated_at':        _now_iso(),
        }, on_conflict='content_hash').execute()
    except Exception as e:
        log.warning("editorial_translations persist failed: %s", e)


def _read_field(rec: dict, path: str):
    """Read a value at a possibly-nested path ('a' or 'a.b.c')."""
    cur: Any = rec
    for part in path.split('.'):
        if not isinstance(cur, dict):
            return None
        cur = cur.get(part)
        if cur is None:
            return None
    return cur


def _write_field(rec: dict, path: str, value) -> None:
    """Write a value at a possibly-nested path, creating dicts as needed."""
    parts = path.split('.')
    cur = rec
    for p in parts[:-1]:
        nxt = cur.get(p)
        if not isinstance(nxt, dict):
            nxt = {} if nxt is None else dict(nxt) if hasattr(nxt, 'items') else {}
            cur[p] = nxt
        cur = nxt
    cur[parts[-1]] = value


def _deep_copy_record(r):
    """Light deep copy that preserves only dicts + lists (good enough for
    JSON-shaped payloads coming back from the DB)."""
    if isinstance(r, dict):
        return {k: _deep_copy_record(v) for k, v in r.items()}
    if isinstance(r, list):
        return [_deep_copy_record(x) for x in r]
    return r


# ─── Public API ────────────────────────────────────────────────────────
def localize_records(
    records: List[dict],
    *,
    fields: Sequence[str],
    target_locale: Optional[str],
    tenant_id: Optional[str] = None,
    source_locale: Optional[str] = None,
    voice_addendum: Optional[str] = None,
    surface: str = 'editorial_content',
    timeout_s: float = 25.0,
) -> List[dict]:
    """Return `records` with every `field` translated into `target_locale`.

    ITER139 — multi-source-language aware:
      • Each (record, field) value is fingerprinted via `detect_language()`.
      • If detected source == target → field passes through untouched.
      • If detected source != target → translate from DETECTED source.
      • Unknown source falls back to `source_locale` (default 'it' for
        backward compat with IT-first seeded content).
      • Mutates copies, not the input. The total LLM budget is bounded by
        `timeout_s` so the API never blocks indefinitely.
    """
    if not records:
        return records
    if not target_locale:
        return records
    tgt = normalize_locale(target_locale)
    if not tgt:
        return records

    directive = CULTURAL_DIRECTIVES.get(tgt, '')
    directive_version = DEFAULT_DIRECTIVE_VERSION
    voice_block = (voice_addendum or '').strip()
    full_addendum = ((directive + ('\n\n' + voice_block if voice_block else '')) or None)

    default_source = (source_locale or 'it').lower()

    # 1. Collect (record_idx, field, hash, source_text, detected_src) tuples.
    items: List[Tuple[int, str, str, str, str]] = []
    for idx, rec in enumerate(records):
        if not isinstance(rec, dict):
            continue
        for field in fields:
            val = _read_field(rec, field)
            if not isinstance(val, str) or not val.strip():
                continue
            detected = detect_language(val) or default_source
            # Already in target language → no-op (this is the key fix:
            # previously we ONLY processed IT records, leaving EN/ES/etc.
            # leaking through unchanged on non-IT dashboards).
            if detected == tgt:
                continue
            h = _content_hash(detected, tgt, directive_version, val)
            items.append((idx, field, h, val, detected))

    if not items:
        return records

    # 2. Cache lookup for ALL hashes in one go.
    cache = _bulk_lookup(tenant_id, [h for _, _, h, _, _ in items])

    # 3. Translate the misses (under a wall-clock budget).
    cloned = [_deep_copy_record(r) if isinstance(r, dict) else r for r in records]
    t0 = time.time()
    misses = 0
    hits = 0
    failed = 0
    for idx, field, h, src_text, src_lang in items:
        cached = cache.get(h)
        if cached and (cached.get('translated_text') or '').strip():
            cached_text = cached['translated_text']
            # ITER139 · refuse polluted cache entries (LLM preamble leaks).
            # The bad row stays in DB so it can be inspected later, but we
            # don't write it into the record.
            if looks_like_llm_preamble(cached_text, src_text):
                log.warning("editorial layer · skipping polluted cache hash=%s len=%d",
                            h[:8], len(cached_text))
                # Fall through to live re-translate
            else:
                _write_field(cloned[idx], field, cached_text)
                hits += 1
                continue
        # Cache miss → translate live.
        if (time.time() - t0) > timeout_s:
            log.warning("editorial layer · time budget exceeded after %d/%d", hits + misses, len(items))
            break
        try:
            r = translate(
                src_text,
                source_locale=src_lang,
                target_locale=tgt,
                voice_addendum=full_addendum,
            )
            clean = _scrub_llm_response(r.localized or '') if r.translated else ''
            # Sanity guard — refuse to persist LLM preamble leaks.
            if clean and looks_like_llm_preamble(clean, src_text):
                log.warning("editorial layer · refused LLM preamble leak surface=%s field=%s",
                            surface, field)
                clean = ''
            if r.translated and clean and clean != src_text:
                _write_field(cloned[idx], field, clean)
                _persist(
                    tenant_id=tenant_id,
                    content_hash=h,
                    source_locale=src_lang,
                    target_locale=tgt,
                    source_text=src_text,
                    translated_text=clean,
                    model=r.model or '',
                    directive_version=directive_version,
                    source_field=f"{surface}.{field}",
                )
                misses += 1
            else:
                failed += 1
        except Exception as e:
            log.warning("editorial layer · translate failed: %s", e)
            failed += 1

    if misses or hits or failed:
        log.info("editorial layer · target=%s hits=%d misses=%d failed=%d in %.0fms",
                 tgt, hits, misses, failed, (time.time() - t0) * 1000)
    return cloned


def localize_record(
    record: dict,
    *,
    fields: Sequence[str],
    target_locale: Optional[str],
    tenant_id: Optional[str] = None,
    source_locale: str = 'it',
    voice_addendum: Optional[str] = None,
    surface: str = 'editorial_content',
    timeout_s: float = 8.0,
) -> dict:
    """Single-record convenience wrapper around `localize_records`."""
    if not isinstance(record, dict):
        return record
    out = localize_records(
        [record],
        fields=fields,
        target_locale=target_locale,
        tenant_id=tenant_id,
        source_locale=source_locale,
        voice_addendum=voice_addendum,
        surface=surface,
        timeout_s=timeout_s,
    )
    return out[0] if out else record


def cache_stats(tenant_id: Optional[str] = None) -> dict:
    """High-level TM stats for the Editorial Translation Studio™ admin view."""
    db, ok = _db()
    if not ok:
        return {'available': False}
    try:
        q = db().table('editorial_translations').select(
            'content_hash, target_locale, locked, review_status', count='exact')
        if tenant_id:
            q = q.eq('tenant_id', tenant_id)
        res = q.limit(0).execute()
        total = res.count or 0
        # Per-locale breakdown
        q2 = db().table('editorial_translations').select('target_locale')
        if tenant_id:
            q2 = q2.eq('tenant_id', tenant_id)
        rows = (q2.execute().data or [])
        by_locale = {}
        for row in rows:
            loc = row.get('target_locale')
            by_locale[loc] = by_locale.get(loc, 0) + 1
        return {
            'available':       True,
            'total_cached':    total,
            'by_locale':       by_locale,
        }
    except Exception as e:
        return {'available': False, 'error': str(e)[:120]}
