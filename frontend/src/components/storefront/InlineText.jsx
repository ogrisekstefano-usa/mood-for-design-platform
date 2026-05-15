/**
 * InlineText — contentEditable wrapper for cinematic inline editing.
 *
 * • Save on blur OR on Enter (single-line) / Shift+Enter (multi-line).
 * • Cinematic hover ring with editorial underline pulse on focus.
 * • Locale-aware placeholder.
 * • `multiline` toggle for headlines vs. paragraphs.
 */
import React, { useEffect, useRef, useState } from 'react';

const InlineText = ({
  value = '',
  onChange,
  placeholder = '',
  multiline = false,
  className = '',
  style = {},
  testid,
  as: Tag = 'span',
}) => {
  const ref = useRef(null);
  const [focused, setFocused] = useState(false);
  const [empty, setEmpty] = useState(!value);

  // Sync value -> DOM only when not focused (avoid caret jumps during typing)
  useEffect(() => {
    if (ref.current && !focused) {
      const incoming = value || '';
      if (ref.current.innerText !== incoming) ref.current.innerText = incoming;
      setEmpty(!incoming);
    }
  }, [value, focused]);

  const commit = () => {
    const next = ref.current?.innerText || '';
    setEmpty(!next);
    if (next !== (value || '')) onChange?.(next);
  };

  const onKeyDown = (e) => {
    if (!multiline && e.key === 'Enter') {
      e.preventDefault();
      ref.current?.blur();
    }
    if (e.key === 'Escape') {
      // Cancel edit — restore old value
      if (ref.current) ref.current.innerText = value || '';
      ref.current?.blur();
    }
  };

  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline={multiline}
      data-testid={testid}
      data-empty={empty || undefined}
      data-placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); commit(); }}
      onKeyDown={onKeyDown}
      onInput={() => setEmpty(!ref.current?.innerText)}
      className={`storefront-inline-text ${focused ? 'is-focused' : ''} ${empty ? 'is-empty' : ''} ${className}`}
      style={{ outline: 'none', whiteSpace: multiline ? 'pre-wrap' : 'normal', ...style }}
    />
  );
};

export default InlineText;
