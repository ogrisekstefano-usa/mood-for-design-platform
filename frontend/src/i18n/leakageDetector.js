/**
 * ITER126 · Italian Leakage Detector™ — DEV ONLY.
 *
 * A periodic DOM scanner that walks the body and flags any text node
 * containing high-signal Italian vocabulary when the active UI locale is
 * NOT Italian. The result is exposed via a registry similar to
 * missingI18nRegistry — so the Governance Overlay can surface the gaps
 * with the same visual treatment.
 *
 * What it catches:
 *   • Hardcoded Italian section titles, helper text, CTAs, empty states
 *     that never went through `t()`.
 *   • Tenant-default leaks where a non-Italian locale fell back to
 *     Italian via a stale fallback chain (now blocked by engine.js, but
 *     the scanner is still useful as a tripwire).
 *
 * Not a substitute for proper localization. It's a tripwire so we can
 * find leaks during dev/QA without having to read every page.
 */
const _leaks = new Map();      // sig → { phrase, page, locale, count, ... }
let _listeners = new Set();
let _intervalId = null;

const _emit = () => {
  try { _listeners.forEach((fn) => fn(_leaks.size)); } catch (_) { /* noop */ }
};

// Italian phrases that are *very unlikely* to appear in an English string
// unless they are leaking from a hardcoded Italian label. Kept short and
// high-signal to minimize false positives. Extend cautiously.
const ITALIAN_PHRASES = [
  // Pronouns & determiners
  /\b(il|lo|la|gli|le|delle|dello|della|degli|alla|alle|sulla|sulle|nella|nelle)\s+[A-Za-zÀ-ÿ]+/i,
  // Articulated prepositions
  /\b(del|nel|sul|dal|col)\s+[A-Za-zÀ-ÿ]+/i,
  // Common verbs in editorial UI
  /\b(scegli|aggiungi|aggiorna|riscrivi|fissa|sblocca|riprova|annulla|salva|conferma|invia|elimina|modifica|carica|esporta|stampa|condividi|pubblica)\b/i,
  // High-frequency editorial nouns
  /\b(prossimi passi|moodboard|aggiornamenti|messaggio|capitolo|sezione|impostazioni|notifiche|contatti|materiali|brand|atelier|studio identitario|esperienze|insights|inspiraz|editorial[ei])\b/i,
  // Specific MOOD vocabulary that should NEVER appear in EN UI chrome
  /\b(Il dizionario vivente|Voci aperte|Brief in apertura|Direzione presentata|Progetto vinto|Ultimo movimento|Continua il viaggio|Nuovo Journey|Apri il dossier|Riapri|Avvia)\b/i,
];

// Selectors we DO NOT scan — they legitimately render Italian source text
// translated by ALE (the original is preserved by design).
const SKIP_SELECTORS = [
  '[data-ale-original]',
  '[data-no-leakage-scan]',
  '.ale-msg__original',
  '[data-testid$="-body-original"]',
  // Studio Voice memory inspector renders both languages by design
  '[data-testid^="voice-memory-row-"]',
  // Vocabulary editor shows IT source terms by design
  '[data-testid^="voice-vocab-row-"]',
  // Login / form values typed by user
  'input, textarea, select',
];

function shouldSkip(el) {
  if (!el || el.nodeType !== 1) return false;
  for (const sel of SKIP_SELECTORS) {
    try { if (el.closest(sel)) return true; } catch (_) {}
  }
  return false;
}

function record(phrase, el, locale) {
  const page = (typeof window !== 'undefined' && window.location?.pathname) || '/';
  const sig = `${locale}|${page}|${phrase.slice(0, 60)}`;
  const prev = _leaks.get(sig);
  if (prev) {
    prev.count += 1;
    prev.last_seen = Date.now();
    return;
  }
  const testid = el?.closest?.('[data-testid]')?.getAttribute?.('data-testid') || null;
  _leaks.set(sig, {
    phrase,
    locale,
    page,
    testid,
    snippet: (el?.outerHTML || '').slice(0, 180),
    first_seen: Date.now(),
    last_seen: Date.now(),
    count: 1,
  });
  _emit();
  // eslint-disable-next-line no-console
  console.warn('[LEAKAGE]', { phrase, locale, page, testid });
}

function scanOnce(locale) {
  if (typeof document === 'undefined') return;
  if (!locale || /^it/i.test(locale)) return;  // IT users see IT — nothing to flag
  // Walk visible TEXT nodes only. We avoid traversing scripts/styles.
  const walker = document.createTreeWalker(
    document.body, NodeFilter.SHOW_TEXT,
    {
      acceptNode(n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const p = n.parentNode;
        if (!p || p.nodeType !== 1) return NodeFilter.FILTER_REJECT;
        if (p.tagName === 'SCRIPT' || p.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
        if (shouldSkip(p)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
  let count = 0;
  while (walker.nextNode() && count < 800) {
    const node = walker.currentNode;
    const text = node.nodeValue.trim();
    if (text.length < 4 || text.length > 240) continue;
    for (const rx of ITALIAN_PHRASES) {
      const m = text.match(rx);
      if (m) { record(m[0], node.parentElement, locale); break; }
    }
    count += 1;
  }
}

export function startLeakageScan(getLocale, intervalMs = 8000) {
  if (typeof window === 'undefined') return () => {};
  if (process.env.NODE_ENV === 'production') return () => {};
  stopLeakageScan();
  const tick = () => { try { scanOnce(getLocale?.()); } catch (_) {} };
  setTimeout(tick, 2000);  // first scan after initial render settles
  _intervalId = window.setInterval(tick, intervalMs);
  return stopLeakageScan;
}

export function stopLeakageScan() {
  if (_intervalId) { clearInterval(_intervalId); _intervalId = null; }
}

export function getLeaks()      { return Array.from(_leaks.values()).sort((a, b) => b.count - a.count); }
export function getLeakCount()  { return _leaks.size; }
export function clearLeaks()    { _leaks.clear(); _emit(); }
export function subscribeLeaks(fn) { _listeners.add(fn); return () => _listeners.delete(fn); }
