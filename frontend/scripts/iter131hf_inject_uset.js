#!/usr/bin/env node
/**
 * ITER131hf · Auto-inject `useT()` into every component that calls
 * t(...) without `t` in scope.
 *
 * Strategy (per file):
 *   1. Parse with Babel.
 *   2. For every FunctionDeclaration / ArrowFunctionExpression /
 *      FunctionExpression that contains a CallExpression `t(<string>)`
 *      but whose containing function scope has no `t` identifier:
 *        a. If the function body is a JSX expression (concise arrow),
 *           wrap it in a block: `(...args) => { const { t } = useT();
 *           return <existing>; }`.
 *        b. Otherwise prepend `const { t } = useT();` to the body.
 *   3. If the file does not import `useT` from any path, add
 *      `import { useT } from '<relative>/i18n/useT';` after the last
 *      import statement, with the correct relative path.
 *
 * Skipped:
 *   • non-component arrow functions whose first identifier is lower-case
 *     (e.g. `const STAGE_FOR_STATUS = status => { ... }`) — calling
 *     useT() from a non-component breaks Rules of Hooks. For those we
 *     instead remove the inserted t(...) calls? No — those are typically
 *     mis-classified by the AST remediator; we leave them and the human
 *     fixes manually. We do REPORT them.
 *
 * Usage:
 *   node scripts/iter131hf_inject_uset.js              # dry-run summary
 *   node scripts/iter131hf_inject_uset.js --apply      # rewrite files
 */
const fs   = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverseModule = require('@babel/traverse');
const generateModule = require('@babel/generator');
const t = require('@babel/types');

const traverse = traverseModule.default || traverseModule;
const generate = generateModule.default || generateModule;

const ROOT   = path.join(__dirname, '..', 'src');
const APPLY  = process.argv.includes('--apply');

const report = { fixed: [], skipped: [], notes: [] };

function relativeUsetImport(filePath) {
  const target = path.join(__dirname, '..', 'src', 'i18n', 'useT');
  let rel = path.relative(path.dirname(filePath), target).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

function isComponentName(name) {
  return typeof name === 'string' && /^[A-Z]/.test(name);
}

function bodyHasTCall(fnPath) {
  let found = false;
  fnPath.traverse({
    CallExpression(p) {
      // skip nested function definitions (they have their own t scope)
      let parent = p.scope;
      while (parent && parent !== fnPath.scope) {
        if (parent === fnPath.scope) break;
        if (parent.parent === fnPath.scope.parent) break;
        if (parent.path.isFunction() && parent.path !== fnPath) {
          return; // belongs to nested function
        }
        parent = parent.parent;
      }
      const callee = p.node.callee;
      if (t.isIdentifier(callee, { name: 't' })) {
        found = true;
        p.stop();
      }
    },
  });
  return found;
}

function fnHasTBinding(fnPath) {
  // `t` is in scope if any ancestor scope has a binding for it.
  const scope = fnPath.scope;
  if (scope.hasBinding('t', /* noGlobals */ true)) return true;
  // Param destructuring: ({ t }) => ...
  for (const param of fnPath.node.params || []) {
    if (t.isObjectPattern(param)) {
      for (const prop of param.properties) {
        if (t.isObjectProperty(prop) && t.isIdentifier(prop.value, { name: 't' })) return true;
        if (t.isObjectProperty(prop) && t.isIdentifier(prop.key, { name: 't' }) && prop.shorthand) return true;
      }
    } else if (t.isIdentifier(param, { name: 't' })) {
      return true;
    }
  }
  return false;
}

function ensureUseTImport(ast, filePath) {
  let hasImport = false;
  let lastImportPath = null;
  ast.program.body.forEach((node, idx) => {
    if (t.isImportDeclaration(node)) {
      lastImportPath = idx;
      const specs = node.specifiers || [];
      if (specs.some((s) => t.isImportSpecifier(s) && s.imported && s.imported.name === 'useT')) {
        hasImport = true;
      }
    }
  });
  if (hasImport) return false;
  const importPath = relativeUsetImport(filePath);
  const imp = t.importDeclaration(
    [t.importSpecifier(t.identifier('useT'), t.identifier('useT'))],
    t.stringLiteral(importPath),
  );
  const insertAt = lastImportPath !== null ? lastImportPath + 1 : 0;
  ast.program.body.splice(insertAt, 0, imp);
  return true;
}

function injectUseT(fnPath) {
  const decl = t.variableDeclaration('const', [
    t.variableDeclarator(
      t.objectPattern([
        t.objectProperty(t.identifier('t'), t.identifier('t'), false, true),
      ]),
      t.callExpression(t.identifier('useT'), []),
    ),
  ]);
  // Convert concise arrow body to block body if necessary.
  if (t.isArrowFunctionExpression(fnPath.node) && !t.isBlockStatement(fnPath.node.body)) {
    const ret = t.returnStatement(fnPath.node.body);
    fnPath.node.body = t.blockStatement([decl, ret]);
    return;
  }
  // Otherwise prepend.
  const body = fnPath.node.body.body;
  body.unshift(decl);
}

function fixFile(filePath) {
  const src = fs.readFileSync(filePath, 'utf-8');
  let ast;
  try {
    ast = parser.parse(src, {
      sourceType: 'module',
      plugins: ['jsx', 'classProperties', 'objectRestSpread', 'optionalChaining', 'nullishCoalescingOperator', 'asyncGenerators', 'dynamicImport', 'exportDefaultFrom', 'exportNamespaceFrom'],
      attachComment: true,
    });
  } catch (e) {
    return { skipped: true, reason: 'parse-error: ' + e.message };
  }

  const fixed = [];
  const non_component_skipped = [];

  traverse(ast, {
    Function(p) {
      // Skip nested functions; we only inject at the first scope that needs it
      // (each function is visited independently anyway).
      if (fnHasTBinding(p)) return;
      if (!bodyHasTCall(p)) return;
      // Identify the binding name (for FunctionDeclaration / VariableDeclarator).
      let name = null;
      if (p.node.id && p.node.id.name) name = p.node.id.name;
      else if (p.parent && t.isVariableDeclarator(p.parent) && p.parent.id && p.parent.id.name) {
        name = p.parent.id.name;
      } else if (p.parent && t.isAssignmentExpression(p.parent) && p.parent.left && p.parent.left.name) {
        name = p.parent.left.name;
      }
      if (!isComponentName(name)) {
        non_component_skipped.push(name || '<anonymous>');
        return;
      }
      injectUseT(p);
      fixed.push(name);
    },
  });

  if (fixed.length === 0 && non_component_skipped.length === 0) {
    return null;
  }
  if (fixed.length > 0) {
    ensureUseTImport(ast, filePath);
  }

  if (APPLY && fixed.length > 0) {
    const out = generate(ast, { retainLines: false, jsescOption: { minimal: true } }, src).code;
    fs.writeFileSync(filePath, out, 'utf-8');
  }
  return { fixed, non_component_skipped };
}

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '__pycache__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.(jsx|js)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

(function main() {
  const files = walk(ROOT);
  for (const f of files) {
    const out = fixFile(f);
    if (!out) continue;
    if (out.skipped) {
      report.skipped.push({ file: f, reason: out.reason });
      continue;
    }
    if (out.fixed.length) {
      report.fixed.push({ file: path.relative(path.join(__dirname, '..'), f), components: out.fixed });
    }
    if (out.non_component_skipped.length) {
      report.notes.push({ file: path.relative(path.join(__dirname, '..'), f), suspect_non_components: out.non_component_skipped });
    }
  }
  const componentsCount = report.fixed.reduce((a, b) => a + b.components.length, 0);
  console.log(`Files fixed: ${report.fixed.length} (${componentsCount} components)`);
  console.log(`Notes (non-component suspects): ${report.notes.length}`);
  console.log(`Apply: ${APPLY}`);
  for (const f of report.fixed.slice(0, 50)) {
    console.log(`  · ${f.file}: ${f.components.join(', ')}`);
  }
  if (report.notes.length) {
    console.log('\nSuspect non-component callers (review manually):');
    for (const n of report.notes.slice(0, 30)) {
      console.log(`  · ${n.file}: ${n.suspect_non_components.join(', ')}`);
    }
  }
})();
