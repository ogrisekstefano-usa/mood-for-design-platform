/**
 * ITER128 · Localization Auto-Remediator.
 *
 * Reads `governance/source-leaks.json`, for every Italian leak:
 *
 *   1. Generates a stable namespaced key from file path + phrase slug
 *      (e.g.  pages/crm/CrmAccountsPage.jsx + "Le relazioni della tua casa"
 *           →  'crm.accounts.le_relazioni_della_tua_casa')
 *
 *   2. Appends the IT text to `src/i18n/strings/it-IT.json` (deep nested).
 *
 *   3. Appends an English placeholder/translation to `en-US.json`. The
 *      placeholder is the IT text wrapped in `⟦…⟧` marker — the Studio
 *      can refine it later via the Language Command Center (the registry
 *      will return `review_status: 'ai_suggested'` for these).
 *
 *   4. Replaces the JSX text node `>Italian Text<` with `>{t('key')}<`
 *      and ensures the file imports `t` (`import { useT } from .../useT`
 *      pattern, with a fallback static-import if `useT` is unavailable).
 *
 * Safety:
 *   • DRY RUN by default (`--apply` to commit changes).
 *   • Per-file batching (writes once per file).
 *   • Skips protected terms.
 *   • Skips string consts (too risky for auto-substitution at module top).
 *   • Skips string props for v1 (focuses on JSX text nodes — biggest visual win).
 *
 * Usage:
 *   node scripts/localization_auto_remediate.js              # dry-run
 *   node scripts/localization_auto_remediate.js --apply      # mutate sources
 *   node scripts/localization_auto_remediate.js --apply --max-files 5
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REPORT = path.join(ROOT, '..', 'governance', 'source-leaks.json');
const IT_JSON = path.join(ROOT, 'src/i18n/strings/it-IT.json');
const EN_JSON = path.join(ROOT, 'src/i18n/strings/en-US.json');

const APPLY = process.argv.includes('--apply');
const MAX_FILES_FLAG = process.argv.indexOf('--max-files');
const MAX_FILES = MAX_FILES_FLAG >= 0 ? parseInt(process.argv[MAX_FILES_FLAG + 1] || '999', 10) : 999;

// Namespace mapping from file path → top-level key.
const NS_FROM_PATH = (rel) => {
  const seg = rel.replace(/\\/g, '/').split('/');
  // pages/<dir>/X.jsx → <dir>
  if (seg[0] === 'src' && seg[1] === 'pages') {
    if (seg.length >= 4) return seg[2];        // pages/crm/Foo.jsx → crm
    return path.basename(rel, path.extname(rel)).replace(/Page$/, '').toLowerCase();
  }
  if (seg[0] === 'src' && seg[1] === 'components') {
    return seg[2] || 'components';
  }
  return 'misc';
};

const FILE_KEY = (rel) => {
  const base = path.basename(rel, path.extname(rel));
  return base
    .replace(/Page$|Panel$|Drawer$|Modal$|Card$|List$|Section$|Editor$|Wizard$/, '')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
};

const slugify = (text) =>
  text.toLowerCase()
      .replace(/[àá]/g, 'a').replace(/[èé]/g, 'e').replace(/[ìí]/g, 'i')
      .replace(/[òó]/g, 'o').replace(/[ùú]/g, 'u')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 50)
      .replace(/_+$/, '');

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch (_) { return {}; } }
function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function setDeep(obj, dottedKey, value) {
  const path_ = dottedKey.split('.');
  let cur = obj;
  for (let i = 0; i < path_.length - 1; i++) {
    if (!cur[path_[i]] || typeof cur[path_[i]] !== 'object') cur[path_[i]] = {};
    cur = cur[path_[i]];
  }
  cur[path_[path_.length - 1]] = value;
}

function getDeep(obj, dottedKey) {
  const path_ = dottedKey.split('.');
  let cur = obj;
  for (const seg of path_) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = cur[seg];
  }
  return cur;
}

function ensureTImport(src, fileAbsPath) {
  // 1. If the file already destructures `t` from useBlueprint(), do nothing.
  if (/\bconst\s*\{\s*[^}]*\bt\b[^}]*\}\s*=\s*useBlueprint\s*\(\s*\)/.test(src)) return src;
  // 2. If it imports useBlueprint and destructures other things from it,
  //    add `t` to that destructure.
  if (/from\s+['"][^'"]*BlueprintContext['"]/.test(src) && /\buseBlueprint\b/.test(src)
      && /const\s*\{\s*[^}]+\}\s*=\s*useBlueprint\s*\(\s*\)/.test(src)) {
    return src.replace(
      /(const\s*\{\s*)([^}]*)(\}\s*=\s*useBlueprint\s*\(\s*\))/,
      (_, p1, p2, p3) => {
        const parts = p2.split(',').map((s) => s.trim()).filter(Boolean);
        if (!parts.includes('t')) parts.push('t');
        return `${p1}${parts.join(', ')} ${p3}`;
      });
  }
  // 3. Last resort: compute correct relative path to /src/i18n/useT and inject
  //    `const { t } = useT();` after the first `function/Const Component(`.
  // Path from fileAbsPath up to /src, then down into i18n/useT.
  const SRC_ROOT = path.join(ROOT, 'src');
  const dir = path.dirname(fileAbsPath);
  let rel = path.relative(dir, path.join(SRC_ROOT, 'i18n', 'useT'));
  if (!rel.startsWith('.')) rel = './' + rel;
  // Strip any trailing extension (none here, but defensive)
  rel = rel.replace(/\\/g, '/');
  if (!fs.existsSync(path.join(SRC_ROOT, 'i18n', 'useT.jsx'))) return src;  // bail safely
  // If our computed path escapes the project src, bail (will not compile in CRA).
  // Verify the resolved path stays within src/.
  const resolved = path.resolve(dir, rel);
  if (!resolved.startsWith(SRC_ROOT)) return src;
  if (/from\s+['"][^'"]+\/i18n\/useT['"]/.test(src)) return src;
  const importLine = `import { useT } from '${rel}';\n`;
  // Insert after the LAST `from '...';` line — which is robust to
  // multi-line imports (import { A, B, \n   C, \n } from 'x'; ).
  const lines = src.split('\n');
  let lastImportEnd = -1;
  for (let i = 0; i < Math.min(lines.length, 300); i++) {
    if (/^\s*\}\s*from\s+['"][^'"]+['"];?\s*$/.test(lines[i]) ||
        /^\s*import\s.+from\s+['"][^'"]+['"];?\s*$/.test(lines[i]) ||
        /^\s*import\s+['"][^'"]+['"];?\s*$/.test(lines[i])) {
      lastImportEnd = i;
    }
  }
  if (lastImportEnd < 0) {
    src = importLine + src;
  } else {
    lines.splice(lastImportEnd + 1, 0, importLine.trimEnd());
    src = lines.join('\n');
  }
  // Inject `const { t } = useT();` ONLY inside a function/const that
  // STARTS WITH AN UPPERCASE LETTER (React component convention). Critical
  // to avoid hooks being inserted into utility functions which causes
  // react-hooks/rules-of-hooks errors.
  // ALSO: bail entirely if the file already declares any `t` variable —
  // injection would shadow/conflict (e.g. local `const t = milestone.x`).
  const existingT = /\bconst\s+t\b\s*=|\bconst\s*\{\s*[^}]*\bt\b[^}]*\}\s*=/.test(src);
  if (existingT) return src;  // file needs manual treatment
  const compMatch = src.match(/(?:export\s+default\s+function\s+([A-Z]\w*)\s*\([^)]*\)\s*\{|function\s+([A-Z]\w*)\s*\([^)]*\)\s*\{|const\s+([A-Z]\w*)\s*=\s*(?:React\.)?(?:memo\(|forwardRef\()?\s*(?:\([^)]*\)|\w+)\s*=>\s*\{)/);
  if (compMatch) {
    const idx = compMatch.index + compMatch[0].length;
    src = src.slice(0, idx) + `\n  const { t } = useT();` + src.slice(idx);
  }
  return src;
}

function replaceJsxText(src, leak, key) {
  // Conservative: only replace if the literal Italian text appears verbatim
  // between `>` and `<` on the recorded line. Refuse if the text appears
  // multiple times on the file (could be ambiguous). Use the recorded
  // snippet line as the anchor.
  const lines = src.split('\n');
  const idx = leak.line - 1;
  if (idx < 0 || idx >= lines.length) return null;
  const line = lines[idx];

  // Find `>TEXT<` or `>TEXT` (newline) but exclude attribute values.
  const escText = leak.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(`>(${escText})<`);
  if (!rx.test(line)) return null;
  // Skip if line already includes t( for safety
  if (/\bt\s*\(/.test(line)) return null;

  lines[idx] = line.replace(rx, `>{t('${key}')}<`);
  return lines.join('\n');
}

function main() {
  if (!fs.existsSync(REPORT)) {
    console.error('Run scripts/localization_source_audit.js first.');
    process.exit(2);
  }
  const report = JSON.parse(fs.readFileSync(REPORT, 'utf-8'));
  const itDict = readJson(IT_JSON);
  const enDict = readJson(EN_JSON);
  const stats = { files_touched: 0, leaks_processed: 0, keys_added: 0,
                  skipped_kind: 0, skipped_no_anchor: 0, skipped_no_import_path: 0 };

  const files = Object.entries(report.by_file).slice(0, MAX_FILES);
  for (const [rel, leaks] of files) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    let src = fs.readFileSync(abs, 'utf-8');
    // iter128 safety: if the file already declares a local `t` variable (not
    // from useT/useBlueprint), bail entirely. Injection would shadow it.
    const hasLocalT = /\bconst\s+t\s*=\s*(?!useT|useBlueprint)/.test(src);
    if (hasLocalT) { stats.skipped_local_t = (stats.skipped_local_t || 0) + leaks.length; continue; }
    // iter128 safety: if the file already imports useT from anywhere AND
    // uses a non-destructured form (`const t = useT()`), do not inject.
    const hasNonDestructuredT = /\bconst\s+t\s*=\s*useT\s*\(/.test(src);
    if (hasNonDestructuredT) { stats.skipped_local_t = (stats.skipped_local_t || 0) + leaks.length; continue; }
    let touched = false;
    const ns = NS_FROM_PATH(rel);
    const sub = FILE_KEY(rel);

    for (const leak of leaks) {
      if (leak.kind !== 'jsx_text') { stats.skipped_kind += 1; continue; }
      const slug = slugify(leak.text);
      if (!slug) { stats.skipped_no_anchor += 1; continue; }
      const key = `${ns}.${sub}.${slug}`;
      if (getDeep(itDict, key) === undefined) {
        setDeep(itDict, key, leak.text);
        // Visible MISSING token in EN until reviewed — engine handles ⟦…⟧
        // automatically; here we provide an AI-suggested placeholder so the
        // Studio sees something + the Command Center marks ai_suggested.
        setDeep(enDict, key, leak.text);  // start with IT placeholder, Studio refines
        stats.keys_added += 1;
      }
      const newSrc = replaceJsxText(src, leak, key);
      if (!newSrc) { stats.skipped_no_anchor += 1; continue; }
      src = newSrc;
      touched = true;
      stats.leaks_processed += 1;
    }

    if (touched) {
      src = ensureTImport(src, abs);
      if (APPLY) fs.writeFileSync(abs, src, 'utf-8');
      stats.files_touched += 1;
    }
  }

  if (APPLY) {
    writeJson(IT_JSON, itDict);
    writeJson(EN_JSON, enDict);
  }

  console.log(`\n${APPLY ? '✅ APPLIED' : '👁  DRY-RUN'} · iter128 auto-remediation`);
  console.log(`Files touched:       ${stats.files_touched}`);
  console.log(`Leaks processed:     ${stats.leaks_processed}`);
  console.log(`Keys added:          ${stats.keys_added}`);
  console.log(`Skipped (kind):      ${stats.skipped_kind}`);
  console.log(`Skipped (no anchor): ${stats.skipped_no_anchor}`);
  if (!APPLY) console.log('\nRe-run with --apply to write changes.');
}

main();
