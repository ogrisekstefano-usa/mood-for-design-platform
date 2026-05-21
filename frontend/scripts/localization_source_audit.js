/**
 * ITER128 · Source-Code Italian Leakage Auditor.
 *
 * Scans every JSX/TSX/JS file under src/pages/ + src/components/ for
 * Italian text leaking outside `t(...)` calls. Faster and more reliable
 * than the Playwright runtime audit for batch refactor — operates on AST-
 * aware regex against the source instead of waiting for a render.
 *
 * Output: /app/governance/source-leaks.json
 *   { generated_at, total_leaks, by_file: { 'pages/.../X.jsx': [ {snippet, line, kind, ...} ] } }
 *
 * Detected leak shapes:
 *   • JSX text nodes:   `>Le relazioni della tua casa<`
 *   • String props:     placeholder="Cerca…", title="Aggiungi…", alt="..."
 *   • String literals:  const SUBTITLE = 'Le tue versioni mercato.'
 *
 * Skipped (intentionally):
 *   • imports, comments, JSON files
 *   • Studio Voice + ALE surfaces (i18n source by design)
 *   • Protected Editorial Terms (Atelier™, Design Journey™, ...)
 *   • text already inside t('...') / t(`...`) / useTaxonomy(...) calls
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TARGETS = [
  path.join(ROOT, 'src/pages'),
  path.join(ROOT, 'src/components'),
];
const OUT_JSON = path.join(ROOT, '..', 'governance', 'source-leaks.json');
const OUT_MD   = path.join(ROOT, '..', 'governance', 'source-leaks.md');

// ── Protected Editorial Terms — NEVER translate ───────────────
const PROTECTED_TERMS = [
  'Atelier™', 'Design Journey™', 'Moodboard Direction™', 'Material Direction™',
  'Cultural Editions™', 'Studio Pulse™', 'MOOD™', 'Blueprint™',
  'MOOD for DESIGN', 'MOOD for DESIGN™',
  'Companion Thread™', 'Editorial Calendar™', 'Studio Voice™',
  'Language Command Center™', 'Adaptive Language Experience™',
  'Translation Memory™', 'Studio Identity™', 'Brand Atlas™',
  'Material View™', 'Market Editions™', 'Insights™',
  'Storefront™', 'Editorial OS™', 'Journey Taxonomy™',
  // Brand names (vendors)
  'Cassina', 'Molteni', 'Minotti', 'Cattelan Italia', 'Poliform',
  'Flexform', 'Calacatta', 'Aman', 'Six Senses', 'Rosewood',
];

const PROTECTED_RX = new RegExp(
  '(' + PROTECTED_TERMS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')',
  'g',
);

// ── Italian signature pattern (broader than runtime detector) ──
const ITALIAN_PATTERNS = [
  // Determiners + article-preps + nouns
  /\b(il|lo|la|gli|le|delle|dello|della|degli|alla|alle|sulla|sulle|nella|nelle|nel|sul|dal|del|col|al|ai|agli)\s+[A-Za-zàèéìòóùÀÈÉÌÒÓÙ][\w\u00C0-\u017F-]+/i,
  // Common UI verbs (imperative + 1st-2nd person)
  /\b(scegli|aggiungi|aggiorna|riscrivi|fissa|sblocca|riprova|annulla|salva|conferma|invia|elimina|modifica|carica|esporta|stampa|condividi|pubblica|crea|apri|chiudi|continua|inizia|riapri|avvia|cerca|filtra|esplora|esegui)\b/i,
  // Editorial vocabulary that's almost never accidental
  /\b(moodboard|materico|atmosfera|raffinato|composizione|materiali|tonalit[àa])\b/i,
  // High-signal phrases / nouns
  /\b(prossimi passi|messaggio|capitolo|sezione|impostazion[ei]|notifich[ei]|contatti|atelier|esperienze|insights|inspirazion[ei]|editorial[ei]|caricamento|salvataggio)\b/i,
  // Common Italian function words in long contexts
  /\b(questo|questa|quello|quella|quelli|quelle|tutti|tutte|nessun[oa]|altr[oai]|ogni|alcun[ie])\s+(\w+)/i,
  // Italian-specific accented words
  /[a-zà-ÿ]{2,}à\b|[a-zà-ÿ]{2,}è\b|[a-zà-ÿ]{2,}é\b|[a-zà-ÿ]{2,}ù\b|[a-zà-ÿ]{2,}ò\b/,
  // Reflexives
  /\b(si|ti|ci|vi|mi)\s+(è|sono|hai|abbiamo|avete|sei|siete|può|possono|deve|devono)\b/i,
];

// English negative-filter: if a snippet matches obvious English patterns,
// we still want to consider it for IT only if at least one IT pattern fires.
const ENGLISH_HINT = /\b(the|and|with|this|that|your|our|from|into|when|where|click|here|hello|welcome|sign|please|create|update|save|delete|edit|search|filter|export|import|loading|saving|preview)\b/i;

const SKIP_FILES = [
  // Files that legitimately contain IT/EN source (registries, voice, ALE)
  'StudioVoicePage.jsx',
  'LanguageCommandCenter.jsx',
  'LocalizedMessage.jsx',
  'LocalizationOverlay.jsx',
  'leakageDetector.js',
  'missingI18nRegistry.js',
  'engine.js',
  // Test files
  '.test.js', '.test.jsx', '.test.ts', '.test.tsx',
];

const SKIP_DIRS = [
  '/i18n/strings/',
  '/i18n/',
  '/__tests__/',
  '/__mocks__/',
  '/test/',
];

function shouldSkipFile(filepath) {
  for (const d of SKIP_DIRS) if (filepath.includes(d)) return true;
  const base = path.basename(filepath);
  for (const f of SKIP_FILES) if (base.endsWith(f) || base === f) return true;
  return false;
}

function isInsideTranslator(line) {
  // Heuristic: if the line already wraps text in t('...') or t(`...`), skip.
  return /\bt\s*\(\s*['"`]/.test(line) || /\buseT\s*\(/.test(line) ||
         /\btaxonomy\s*\(/.test(line) || /\buseTaxonomy\s*\(/.test(line);
}

function maskProtected(text) {
  return text.replace(PROTECTED_RX, '__PROTECTED__');
}

function detectIn(text, kind) {
  // Returns the matched IT phrase or null.
  const masked = maskProtected(text);
  // Require text to be at least 4 chars + ≤ 280 chars + contain a letter.
  if (masked.length < 4 || masked.length > 280) return null;
  if (!/[a-zà-ÿ]/i.test(masked)) return null;
  for (const rx of ITALIAN_PATTERNS) {
    const m = masked.match(rx);
    if (m) {
      // English-negative filter: skip if the snippet is mostly English with
      // one short IT-pattern false positive (e.g. "alla" matches inside a
      // word — already prevented by \b but extra safety).
      const enHits = (masked.match(ENGLISH_HINT) || []).length;
      const itHits = ITALIAN_PATTERNS.filter((r) => r.test(masked)).length;
      if (enHits > itHits) return null;
      return { match: m[0], kind };
    }
  }
  return null;
}

function scanFile(filepath) {
  const src = fs.readFileSync(filepath, 'utf-8');
  const lines = src.split('\n');
  const leaks = [];
  let inBlockComment = false;
  lines.forEach((line, i) => {
    // strip block comments crudely
    if (inBlockComment) { if (line.includes('*/')) inBlockComment = false; return; }
    if (line.trim().startsWith('/*')) { if (!line.includes('*/')) inBlockComment = true; return; }
    if (line.trim().startsWith('//')) return;
    if (line.trim().startsWith('*')) return;          // inside jsdoc
    if (isInsideTranslator(line)) return;
    // Skip imports.
    if (/^\s*import\b/.test(line) || /^\s*export\s+\*\s+from/.test(line)) return;

    // ─── Candidate 1: JSX text nodes  >Text here<
    let m;
    const jsxRx = />([^<>{}\n][^<>{}\n]*?)</g;
    while ((m = jsxRx.exec(line)) !== null) {
      const text = m[1].trim();
      if (!text) continue;
      const hit = detectIn(text, 'jsx_text');
      if (hit) leaks.push({ ...hit, line: i + 1, text, snippet: line.trim().slice(0, 220) });
    }

    // ─── Candidate 2: string props
    const propRx = /\b(placeholder|title|alt|aria-label|label|description|tooltip|hint)\s*=\s*"([^"]+)"/g;
    while ((m = propRx.exec(line)) !== null) {
      const text = m[2].trim();
      const hit = detectIn(text, `prop_${m[1]}`);
      if (hit) leaks.push({ ...hit, line: i + 1, text, snippet: line.trim().slice(0, 220) });
    }

    // ─── Candidate 3: top-level string consts
    const constRx = /\b(const|let|var)\s+(\w+)\s*=\s*['"]([^'"]+)['"]/g;
    while ((m = constRx.exec(line)) !== null) {
      const text = m[3].trim();
      const hit = detectIn(text, 'string_const');
      if (hit) leaks.push({ ...hit, line: i + 1, text, snippet: line.trim().slice(0, 220), varname: m[2] });
    }
  });
  return leaks;
}

function walk(dir, list = []) {
  if (!fs.existsSync(dir)) return list;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) walk(p, list);
    else if (/\.(jsx?|tsx?)$/.test(name)) list.push(p);
  }
  return list;
}

function main() {
  const files = TARGETS.flatMap((d) => walk(d));
  const out = { generated_at: new Date().toISOString(), total_files_scanned: 0,
                total_leaks: 0, by_file: {}, protected_terms: PROTECTED_TERMS.length };
  let scanned = 0;
  for (const fp of files) {
    if (shouldSkipFile(fp)) continue;
    scanned += 1;
    const leaks = scanFile(fp);
    if (leaks.length) {
      const rel = path.relative(ROOT, fp);
      out.by_file[rel] = leaks;
      out.total_leaks += leaks.length;
    }
  }
  out.total_files_scanned = scanned;

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2), 'utf-8');

  // Markdown — by file, sorted desc.
  const md = [];
  md.push(`# Source-Code Italian Leakage Audit · ${out.generated_at.slice(0, 10)}`);
  md.push('');
  md.push(`**Files scanned**: ${out.total_files_scanned}    **Total leaks**: ${out.total_leaks}    **Files with leaks**: ${Object.keys(out.by_file).length}`);
  md.push('');
  md.push('| File | Leaks |');
  md.push('|---|---:|');
  const ordered = Object.entries(out.by_file).sort(([, a], [, b]) => b.length - a.length);
  ordered.forEach(([f, leaks]) => md.push(`| \`${f}\` | ${leaks.length} |`));
  fs.writeFileSync(OUT_MD, md.join('\n'), 'utf-8');

  console.log(`Files scanned: ${scanned}`);
  console.log(`Total leaks:   ${out.total_leaks}`);
  console.log(`Files with leaks: ${Object.keys(out.by_file).length}`);
  console.log(`Report: ${OUT_JSON}`);
  console.log(`        ${OUT_MD}`);
}

main();
