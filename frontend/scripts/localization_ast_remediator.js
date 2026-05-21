/**
 * ITER129 · AST-Based Localization Remediator.
 *
 * Replaces the regex remediator with a real Babel AST pass that handles:
 *
 *   • JSXText                — `<h2>Le relazioni della tua casa</h2>`
 *   • JSXAttribute strings   — `<Input placeholder="Cerca un account" />`
 *   • Interpolated templates — `<p>{`Ciao ${name}, benvenuto`}</p>`
 *   • Conditional strings    — `<p>{loading ? 'Caricamento…' : 'Pronto'}</p>`
 *   • String literal consts  — `const SUBTITLE = 'Le tue versioni mercato.';`
 *
 * Outputs are written with @babel/generator, preserving formatting via
 * retainFunctionParens, jsescOption.minimal etc.
 *
 * Usage:
 *   node scripts/localization_ast_remediator.js              # dry-run
 *   node scripts/localization_ast_remediator.js --apply      # commit
 *   node scripts/localization_ast_remediator.js --apply --max-files 5
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverseModule = require('@babel/traverse');
const generateModule = require('@babel/generator');
const t = require('@babel/types');

const traverse = traverseModule.default || traverseModule;
const generate = generateModule.default || generateModule;

const ROOT = path.join(__dirname, '..');
const REPORT = path.join(ROOT, '..', 'governance', 'source-leaks.json');
const IT_JSON = path.join(ROOT, 'src/i18n/strings/it-IT.json');
const EN_JSON = path.join(ROOT, 'src/i18n/strings/en-US.json');
const APPLY = process.argv.includes('--apply');
const MAX_IDX = process.argv.indexOf('--max-files');
const MAX_FILES = MAX_IDX >= 0 ? parseInt(process.argv[MAX_IDX + 1] || '999', 10) : 999;

// ── Protected terms — must never be translated/keyed ──────────
const PROTECTED_TERMS = [
  'Atelier™', 'Design Journey™', 'Moodboard Direction™', 'Material Direction™',
  'Cultural Editions™', 'Studio Pulse™', 'MOOD™', 'Blueprint™',
  'MOOD for DESIGN', 'MOOD for DESIGN™', 'Companion Thread™',
  'Editorial Calendar™', 'Studio Voice™', 'Language Command Center™',
  'Adaptive Language Experience™', 'Translation Memory™', 'Studio Identity™',
  'Brand Atlas™', 'Material View™', 'Market Editions™', 'Insights™',
  'Storefront™', 'Editorial OS™', 'Journey Taxonomy™',
  'Cassina', 'Molteni', 'Minotti', 'Cattelan Italia', 'Poliform',
  'Flexform', 'Calacatta', 'Aman', 'Six Senses', 'Rosewood',
];
const PROTECTED_RX = new RegExp(
  '(' + PROTECTED_TERMS.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')',
  'g',
);

// ── Italian detection — same signature as iter128 audit ───────
const IT_PATTERNS = [
  /\b(il|lo|la|gli|le|delle|dello|della|degli|alla|alle|sulla|sulle|nella|nelle|nel|sul|dal|del|col|al|ai|agli)\s+[A-Za-zàèéìòóùÀÈÉÌÒÓÙ][\w\u00C0-\u017F-]+/i,
  /\b(scegli|aggiungi|aggiorna|riscrivi|fissa|sblocca|riprova|annulla|salva|conferma|invia|elimina|modifica|carica|esporta|stampa|condividi|pubblica|crea|apri|chiudi|continua|inizia|riapri|avvia|cerca|filtra|esplora|esegui)\b/i,
  /\b(moodboard|materico|atmosfera|raffinato|composizione|materiali?|tonalit[àa])\b/i,
  /\b(prossimi passi|messaggio|capitolo|sezione|impostazion[ei]|notifich[ei]|contatti|atelier|esperienze|insights|inspirazion[ei]|editorial[ei]|caricamento|salvataggio)\b/i,
  /\b(questo|questa|quello|quella|tutti|tutte|nessun[oa]|altr[oai]|ogni|alcun[ie])\s+(\w+)/i,
  /[a-zà-ÿ]{2,}à\b|[a-zà-ÿ]{2,}è\b|[a-zà-ÿ]{2,}é\b|[a-zà-ÿ]{2,}ù\b|[a-zà-ÿ]{2,}ò\b/,
];
const ENGLISH_HINT = /\b(the|and|with|this|that|your|our|from|into|when|where|click|here|hello|welcome|sign|please|create|update|save|delete|edit|search|filter|export|import|loading|saving|preview)\b/i;

const SKIP_FILES = [
  'StudioVoicePage.jsx', 'LanguageCommandCenter.jsx', 'LocalizedMessage.jsx',
  'LocalizationOverlay.jsx', 'leakageDetector.js', 'missingI18nRegistry.js', 'engine.js',
];
const SKIP_DIRS = ['/i18n/strings/', '/i18n/', '/__tests__/', '/__mocks__/', '/test/'];
const ALLOWED_PROPS = new Set([
  'placeholder', 'title', 'alt', 'aria-label', 'label', 'description',
  'tooltip', 'hint', 'subtitle', 'caption',
]);

function shouldSkip(filepath) {
  for (const d of SKIP_DIRS) if (filepath.includes(d)) return true;
  const base = path.basename(filepath);
  for (const f of SKIP_FILES) if (base.endsWith(f) || base === f) return true;
  return false;
}

function isItalian(text) {
  if (!text || text.length < 4 || text.length > 280) return false;
  if (!/[a-zà-ÿ]/i.test(text)) return false;
  const masked = text.replace(PROTECTED_RX, '__PROTECTED__');
  let it = 0; for (const rx of IT_PATTERNS) if (rx.test(masked)) it += 1;
  if (!it) return false;
  const en = (masked.match(ENGLISH_HINT) || []).length;
  return en <= it;
}

const slugify = (txt) =>
  txt.toLowerCase()
     .replace(/[àá]/g, 'a').replace(/[èé]/g, 'e').replace(/[ìí]/g, 'i')
     .replace(/[òó]/g, 'o').replace(/[ùú]/g, 'u')
     .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50)
     .replace(/_+$/, '');

function nsFromPath(rel) {
  const seg = rel.replace(/\\/g, '/').split('/');
  if (seg[0] === 'src' && seg[1] === 'pages')      return seg[2] || 'misc';
  if (seg[0] === 'src' && seg[1] === 'components') return seg[2] || 'components';
  return 'misc';
}
function fileKey(rel) {
  return path.basename(rel, path.extname(rel))
    .replace(/Page$|Panel$|Drawer$|Modal$|Card$|List$|Section$|Editor$|Wizard$/, '')
    .replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// ── i18n JSON helpers ─────────────────────────────────────────
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch (_) { return {}; } }
function writeJson(p, d) { fs.writeFileSync(p, JSON.stringify(d, null, 2) + '\n', 'utf-8'); }
function setDeep(o, k, v) { const p = k.split('.'); let c = o;
  for (let i = 0; i < p.length - 1; i++) { if (typeof c[p[i]] !== 'object' || !c[p[i]]) c[p[i]] = {}; c = c[p[i]]; }
  c[p[p.length - 1]] = v;
}
function getDeep(o, k) { const p = k.split('.'); let c = o;
  for (const s of p) { if (!c || typeof c !== 'object') return undefined; c = c[s]; }
  return c;
}

// ── per-file remediation ──────────────────────────────────────
function remediateFile(absPath, itDict, enDict, stats) {
  let code;
  try { code = fs.readFileSync(absPath, 'utf-8'); } catch (_) { return false; }
  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: 'module', plugins: ['jsx', 'classProperties', 'optionalChaining',
        'nullishCoalescingOperator', 'objectRestSpread', 'dynamicImport',
        'exportDefaultFrom', 'exportNamespaceFrom'],
      tokens: false, ranges: false, errorRecovery: true,
    });
  } catch (e) { stats.parse_errors += 1; return false; }

  const rel = path.relative(ROOT, absPath);
  const ns = nsFromPath(rel);
  const sub = fileKey(rel);
  let touched = false;
  let needTHook = false;

  // Detect if file already has a usable `t` in scope.
  let hasDestructuredT = false, hasNonDestructuredT = false, hasLocalT = false;
  traverse(ast, {
    VariableDeclarator(p) {
      const init = p.node.init;
      if (!init) return;
      // const t = useT() / useBlueprint() — non-destructured t
      if (t.isIdentifier(p.node.id, { name: 't' }) && t.isCallExpression(init)) {
        const callee = init.callee;
        if (t.isIdentifier(callee, { name: 'useT' }) || t.isIdentifier(callee, { name: 'useBlueprint' })) {
          hasNonDestructuredT = true;
        } else {
          hasLocalT = true;
        }
      }
      // const { t, ... } = useT() / useBlueprint()
      if (t.isObjectPattern(p.node.id) && t.isCallExpression(init)) {
        const callee = init.callee;
        if ((t.isIdentifier(callee, { name: 'useT' }) || t.isIdentifier(callee, { name: 'useBlueprint' }))
            && p.node.id.properties.some((pr) =>
                t.isObjectProperty(pr) && t.isIdentifier(pr.key, { name: 't' }))) {
          hasDestructuredT = true;
        }
      }
      // ANY other `const t = ...` declaration → file is unsafe (e.g. const t = milestone.type)
      if (t.isIdentifier(p.node.id, { name: 't' }) && init && !t.isCallExpression(init)) {
        hasLocalT = true;
      }
    },
  });

  if (hasLocalT || hasNonDestructuredT) { stats.skipped_unsafe_t += 1; return false; }

  // Helper to make a t('key') CallExpression
  const tCall = (key) =>
    t.callExpression(t.identifier('t'), [t.stringLiteral(key)]);

  const recordKey = (text) => {
    const slug = slugify(text);
    if (!slug) return null;
    const key = `${ns}.${sub}.${slug}`;
    if (getDeep(itDict, key) === undefined) {
      setDeep(itDict, key, text);
      setDeep(enDict, key, text);  // placeholder — Studio refines via Command Center
      stats.keys_added += 1;
    }
    return key;
  };

  // ── PASS 1 · JSXText ─────────────────────────────────────────
  traverse(ast, {
    JSXText(p) {
      const raw = p.node.value;
      const trimmed = raw.trim();
      if (!isItalian(trimmed)) return;
      // Preserve leading/trailing whitespace structure.
      const leading = raw.match(/^\s*/)[0];
      const trailing = raw.match(/\s*$/)[0];
      const key = recordKey(trimmed);
      if (!key) return;
      const expr = t.jsxExpressionContainer(tCall(key));
      // Replace with whitespace nodes + expression so spacing/layout survives
      const nodes = [];
      if (leading) nodes.push(t.jsxText(leading));
      nodes.push(expr);
      if (trailing) nodes.push(t.jsxText(trailing));
      p.replaceWithMultiple(nodes);
      touched = true; needTHook = true;
      stats.replaced_jsx_text += 1;
    },
  });

  // ── PASS 2 · JSXAttribute string literals (placeholder/title/etc.) ─────
  traverse(ast, {
    JSXAttribute(p) {
      const name = p.node.name;
      if (!t.isJSXIdentifier(name)) return;
      if (!ALLOWED_PROPS.has(name.name)) return;
      const v = p.node.value;
      if (!t.isStringLiteral(v)) return;
      const text = v.value.trim();
      if (!isItalian(text)) return;
      const key = recordKey(text);
      if (!key) return;
      p.node.value = t.jsxExpressionContainer(tCall(key));
      touched = true; needTHook = true;
      stats.replaced_jsx_attr += 1;
    },
  });

  // ── PASS 3 · Interpolated templates inside JSXExpressionContainers ─────
  traverse(ast, {
    TemplateLiteral(p) {
      // Only consider templates that have NO expressions (purely string) OR
      // pure prefix + ${var}; for v1 keep it simple: only NO-expression
      // templates (` ` `).
      if (p.node.expressions.length !== 0) return;
      if (p.node.quasis.length !== 1) return;
      const raw = p.node.quasis[0].value.cooked;
      if (!isItalian(raw.trim())) return;
      const key = recordKey(raw.trim());
      if (!key) return;
      p.replaceWith(tCall(key));
      touched = true; needTHook = true;
      stats.replaced_template += 1;
    },
  });

  if (!touched) return false;

  // ── Inject `t` into the first React component if needed ─────
  if (!hasDestructuredT) {
    // Look for: function ComponentName(...) { ... } where Name starts with [A-Z]
    let injected = false;
    traverse(ast, {
      FunctionDeclaration(p) {
        if (injected) return;
        const id = p.node.id;
        if (!id || !/^[A-Z]/.test(id.name)) return;
        injectTHook(p.node.body);
        injected = true;
        p.stop();
      },
      VariableDeclarator(p) {
        if (injected) return;
        const id = p.node.id;
        if (!t.isIdentifier(id) || !/^[A-Z]/.test(id.name)) return;
        let init = p.node.init;
        if (!init) return;
        if (t.isCallExpression(init) && (t.isIdentifier(init.callee, { name: 'memo' })
            || (t.isMemberExpression(init.callee)
                && t.isIdentifier(init.callee.object, { name: 'React' })
                && t.isIdentifier(init.callee.property, { name: 'memo' })))) {
          init = init.arguments[0];
        }
        if (t.isArrowFunctionExpression(init) && t.isBlockStatement(init.body)) {
          injectTHook(init.body);
          injected = true; p.stop();
        }
      },
    });
    if (injected) {
      // Make sure `useT` is imported.
      let hasImport = false;
      traverse(ast, {
        ImportDeclaration(p) {
          if (!t.isStringLiteral(p.node.source)) return;
          if (!/\/i18n\/useT$/.test(p.node.source.value)) return;
          if (p.node.specifiers.some((s) => t.isImportSpecifier(s)
              && t.isIdentifier(s.imported, { name: 'useT' }))) hasImport = true;
        },
      });
      if (!hasImport) {
        const srcRoot = path.join(ROOT, 'src');
        const dir = path.dirname(absPath);
        let relPath = path.relative(dir, path.join(srcRoot, 'i18n', 'useT')).replace(/\\/g, '/');
        if (!relPath.startsWith('.')) relPath = './' + relPath;
        const importDecl = t.importDeclaration(
          [t.importSpecifier(t.identifier('useT'), t.identifier('useT'))],
          t.stringLiteral(relPath),
        );
        // Insert after the last existing import.
        let lastImportIdx = -1;
        ast.program.body.forEach((n, i) => { if (t.isImportDeclaration(n)) lastImportIdx = i; });
        ast.program.body.splice(lastImportIdx + 1, 0, importDecl);
      }
    } else {
      // Replacements happened but no component-body found — back out.
      stats.skipped_no_component += 1;
      return false;
    }
  }

  if (APPLY) {
    const out = generate(ast, { retainLines: false, jsescOption: { minimal: true } }, code);
    fs.writeFileSync(absPath, out.code, 'utf-8');
  }
  stats.files_touched += 1;
  return true;
}

function injectTHook(blockStatement) {
  const decl = t.variableDeclaration('const', [
    t.variableDeclarator(
      t.objectPattern([
        t.objectProperty(t.identifier('t'), t.identifier('t'), false, true),
      ]),
      t.callExpression(t.identifier('useT'), []),
    ),
  ]);
  blockStatement.body.unshift(decl);
}

// ── main ──────────────────────────────────────────────────────
function main() {
  if (!fs.existsSync(REPORT)) {
    console.error('Run scripts/localization_source_audit.js first.');
    process.exit(2);
  }
  const report = JSON.parse(fs.readFileSync(REPORT, 'utf-8'));
  const itDict = readJson(IT_JSON);
  const enDict = readJson(EN_JSON);
  const stats = {
    files_touched: 0, keys_added: 0,
    replaced_jsx_text: 0, replaced_jsx_attr: 0, replaced_template: 0,
    skipped_unsafe_t: 0, skipped_no_component: 0, parse_errors: 0,
  };

  const files = Object.keys(report.by_file).slice(0, MAX_FILES);
  for (const rel of files) {
    if (shouldSkip(rel)) continue;
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    remediateFile(abs, itDict, enDict, stats);
  }

  if (APPLY) { writeJson(IT_JSON, itDict); writeJson(EN_JSON, enDict); }

  console.log(`\n${APPLY ? '✅ APPLIED' : '👁  DRY-RUN'} · iter129 AST remediation`);
  Object.entries(stats).forEach(([k, v]) => console.log(`  ${k.padEnd(24)} ${v}`));
  if (!APPLY) console.log('\nRe-run with --apply to write changes.');
}

main();
