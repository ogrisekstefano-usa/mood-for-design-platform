import React from 'react';

/**
 * renderInlineMarkdown — minimal inline parser for body copy edited from
 * the admin's MarkdownToolbar. Supports:
 *   **bold**      → <strong>
 *   *italic*      → <em>
 *   [label](url)  → <a target="_blank">
 *   \n\n          → paragraph break (<br><br>)
 *   • / -         → preserved as text (no list HTML)
 *
 * Safe-by-construction: no HTML is interpreted from input. Anything not
 * matched is rendered as plain text.
 */
export function renderInlineMarkdown(value) {
  if (!value) return null;
  const text = String(value);
  // Split by inline markdown patterns. Order matters: bold before italic.
  const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  const out = [];
  let lastIdx = 0;
  let m;
  let key = 0;
  while ((m = TOKEN.exec(text)) !== null) {
    if (m.index > lastIdx) out.push(text.slice(lastIdx, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) {
      out.push(<strong key={`b${key++}`}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith('*')) {
      out.push(<em key={`i${key++}`}>{tok.slice(1, -1)}</em>);
    } else if (tok.startsWith('[')) {
      const label = tok.slice(1, tok.indexOf(']'));
      const url   = tok.slice(tok.indexOf('(') + 1, -1);
      out.push(
        <a key={`a${key++}`} href={url} target="_blank" rel="noreferrer"
           style={{ color: 'var(--mood-teal, #00C9B3)', textDecoration: 'none', borderBottom: '1px solid rgba(0,201,179,0.4)' }}>
          {label}
        </a>,
      );
    }
    lastIdx = m.index + tok.length;
  }
  if (lastIdx < text.length) out.push(text.slice(lastIdx));

  // Split by \n\n into paragraphs
  return out.flatMap((chunk, i) => {
    if (typeof chunk !== 'string') return [chunk];
    const parts = chunk.split('\n\n');
    const acc = [];
    parts.forEach((p, idx) => {
      acc.push(p);
      if (idx < parts.length - 1) acc.push(<><br key={`br1-${i}-${idx}`} /><br key={`br2-${i}-${idx}`} /></>);
    });
    return acc;
  });
}
