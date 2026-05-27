/**
 * inlineMarkup — minimal-safe inline parser for editorial bodies.
 * Supports:  **bold**  *italic*  [text](url)
 * No HTML pass-through (text is escaped via React's default behaviour).
 * Returns an array of React nodes for safe rendering.
 */
import React from 'react';

// We pre-tokenise to avoid the classic "italic inside bold" headaches.
// Order matters: links first (since their inner text may itself have *...*
// or **...**, parsed recursively).
const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/;
const BOLD_RE = /\*\*([^*]+)\*\*/;
const ITALIC_RE = /\*([^*]+)\*/;

const isSafeHref = (href) => {
  if (!href) return false;
  const h = href.trim();
  return /^(https?:|mailto:|tel:|\/)/i.test(h);
};

const tokenize = (text, depth = 0) => {
  if (typeof text !== 'string' || !text || depth > 6) {
    return [text];
  }
  // Look for the earliest of LINK / BOLD / ITALIC
  const linkMatch = LINK_RE.exec(text);
  const boldMatch = BOLD_RE.exec(text);
  const italicMatch = ITALIC_RE.exec(text);

  const candidates = [];
  if (linkMatch)   candidates.push({ kind: 'link',   m: linkMatch });
  if (boldMatch)   candidates.push({ kind: 'bold',   m: boldMatch });
  if (italicMatch) candidates.push({ kind: 'italic', m: italicMatch });
  if (candidates.length === 0) return [text];

  candidates.sort((a, b) => a.m.index - b.m.index);
  const first = candidates[0];
  const before = text.slice(0, first.m.index);
  const after  = text.slice(first.m.index + first.m[0].length);

  if (first.kind === 'link') {
    const [, label, url] = first.m;
    const href = isSafeHref(url) ? url : null;
    return [
      ...(before ? tokenize(before, depth + 1) : []),
      href
        ? React.createElement('a',
            { href, target: href.startsWith('http') ? '_blank' : undefined,
              rel: href.startsWith('http') ? 'noopener noreferrer' : undefined,
              key: `lk-${depth}-${first.m.index}` },
            ...tokenize(label, depth + 1))
        : label,
      ...(after ? tokenize(after, depth + 1) : []),
    ];
  }
  if (first.kind === 'bold') {
    return [
      ...(before ? tokenize(before, depth + 1) : []),
      React.createElement('strong',
        { key: `b-${depth}-${first.m.index}` },
        ...tokenize(first.m[1], depth + 1)),
      ...(after ? tokenize(after, depth + 1) : []),
    ];
  }
  // italic
  return [
    ...(before ? tokenize(before, depth + 1) : []),
    React.createElement('em',
      { key: `i-${depth}-${first.m.index}` },
      ...tokenize(first.m[1], depth + 1)),
    ...(after ? tokenize(after, depth + 1) : []),
  ];
};

export const renderInline = (text) => {
  if (typeof text !== 'string' || !text) return text || null;
  const nodes = tokenize(text);
  return React.createElement(React.Fragment, null, ...nodes);
};

// Helpers for editor toolbar — wrap the current selection.
export const wrapMarkup = (textarea, prefix, suffix = prefix, placeholder = '') => {
  if (!textarea) return null;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const selected = value.slice(start, end) || placeholder;
  const newValue = value.slice(0, start) + prefix + selected + suffix + value.slice(end);
  const newPos = start + prefix.length + selected.length + suffix.length;
  return { newValue, newPos, selectStart: start + prefix.length, selectEnd: start + prefix.length + selected.length };
};
