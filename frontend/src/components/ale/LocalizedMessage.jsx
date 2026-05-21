/**
 * Adaptive Language Experience™ — LocalizedMessage component.
 * Sprint ITER123.
 *
 * Renders a piece of user-authored content in the reader's locale while
 * preserving access to the original. The visual treatment is sober and
 * editorial: a translation badge in eyebrow type, never invasive.
 *
 * Three display modes (governed by user preference + caller override):
 *   - `localized_only`: shows translated text + small "Translated by MOOD" caption
 *   - `original_only` : shows source text untouched (no API call)
 *   - `dual`          : shows translated text + original underneath in muted italic
 *
 * The component handles its own loading state and gracefully falls back to
 * the original text on any error or unsupported locale combination.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Languages } from 'lucide-react';
import api from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';

const TRANSLATE_LABELS = {
  it:    'Tradotto automaticamente da MOOD for DESIGN™',
  'en-US': 'Translated automatically by MOOD for DESIGN™',
  'en-GB': 'Translated automatically by MOOD for DESIGN™',
  fr:    'Traduit automatiquement par MOOD for DESIGN™',
  de:    'Automatisch übersetzt von MOOD for DESIGN™',
  es:    'Traducido automáticamente por MOOD for DESIGN™',
  ar:    'تُرجم تلقائياً بواسطة MOOD for DESIGN™',
};
const VIEW_ORIGINAL = {
  it:    'Vedi originale',
  'en-US': 'View original',
  'en-GB': 'View original',
  fr:    'Voir l\'original',
  de:    'Original anzeigen',
  es:    'Ver original',
  ar:    'عرض الأصل',
};
const HIDE_ORIGINAL = {
  it:    'Nascondi originale',
  'en-US': 'Hide original',
  'en-GB': 'Hide original',
  fr:    'Masquer l\'original',
  de:    'Original ausblenden',
  es:    'Ocultar original',
  ar:    'إخفاء الأصل',
};

export const LocalizedMessage = ({
  text,
  sourceLocale,
  targetLocale,          // override; default = reader's UI locale
  mode = 'localized_only', // 'localized_only' | 'original_only' | 'dual'
  showLabel = true,
  className = '',
  testid = 'localized-message',
}) => {
  const { locale: uiLocale } = useBlueprint();
  const target = targetLocale || uiLocale;
  const needsTranslation = sourceLocale && target && sourceLocale !== target && mode !== 'original_only';

  const [localized, setLocalized] = useState(null);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(mode === 'dual');

  useEffect(() => {
    if (!needsTranslation || !text) return;
    let cancel = false;
    setLoading(true);
    api.post('/api/ale/localize', {
      text,
      source_locale: sourceLocale,
      target_locale: target,
    })
      .then((r) => { if (!cancel) setLocalized(r.data); })
      .catch(() => { if (!cancel) setLocalized({ localized: text, translated: false }); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [text, sourceLocale, target, needsTranslation]);

  if (!text) return null;
  if (!needsTranslation) {
    return <span className={className} data-testid={testid}>{text}</span>;
  }
  const display = localized?.localized || text;
  const wasTranslated = localized?.translated;

  return (
    <span className={`ale-msg ${className}`} data-testid={testid}>
      {loading ? (
        <span className="ale-msg__loading" data-testid={`${testid}-loading`}>
          {text}
        </span>
      ) : (
        <span className="ale-msg__primary" data-testid={`${testid}-primary`}>
          {display}
        </span>
      )}
      {showLabel && wasTranslated && (
        <span className="ale-msg__meta" data-testid={`${testid}-meta`} style={metaStyle}>
          <Languages size={9} strokeWidth={1.5} style={{ opacity: 0.6 }} />
          {TRANSLATE_LABELS[uiLocale] || TRANSLATE_LABELS['en-US']}
          {mode !== 'dual' && (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              data-testid={`${testid}-toggle`}
              style={toggleStyle}
            >
              · {revealed ? (HIDE_ORIGINAL[uiLocale] || HIDE_ORIGINAL['en-US'])
                          : (VIEW_ORIGINAL[uiLocale] || VIEW_ORIGINAL['en-US'])}
            </button>
          )}
        </span>
      )}
      {revealed && wasTranslated && (
        <span className="ale-msg__original" data-testid={`${testid}-original`} style={originalStyle}>
          <em>{text}</em>
        </span>
      )}
    </span>
  );
};

const metaStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  marginLeft: 6,
  fontFamily: "var(--mood-font-mono, 'JetBrains Mono', monospace)",
  fontSize: 8.5,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'var(--mood-text-muted, rgba(240,235,224,0.45))',
};
const toggleStyle = {
  background: 'transparent',
  border: 'none',
  color: 'inherit',
  fontFamily: 'inherit',
  fontSize: 'inherit',
  letterSpacing: 'inherit',
  textTransform: 'inherit',
  cursor: 'pointer',
  padding: 0,
};
const originalStyle = {
  display: 'block',
  marginTop: 6,
  paddingTop: 6,
  borderTop: '1px solid var(--mood-border, rgba(255,255,255,0.06))',
  fontFamily: "var(--mood-font-heading, 'Playfair Display', serif)",
  fontSize: '0.92em',
  color: 'var(--mood-text-muted, rgba(240,235,224,0.6))',
  fontStyle: 'italic',
};

export default LocalizedMessage;

/** Convenience hook for callers that want the raw translation result. */
export const useLocalizedContent = (text, sourceLocale, targetLocaleOverride = null) => {
  const { locale: uiLocale } = useBlueprint();
  const target = targetLocaleOverride || uiLocale;
  const [state, setState] = useState({ localized: text, translated: false, loading: false });

  useEffect(() => {
    if (!text || !sourceLocale || sourceLocale === target) {
      setState({ localized: text, translated: false, loading: false });
      return;
    }
    let cancel = false;
    setState((s) => ({ ...s, loading: true }));
    api.post('/api/ale/localize', { text, source_locale: sourceLocale, target_locale: target })
      .then((r) => { if (!cancel) setState({ ...r.data, loading: false }); })
      .catch(() => { if (!cancel) setState({ localized: text, translated: false, loading: false }); });
    return () => { cancel = true; };
  }, [text, sourceLocale, target]);

  return state;
};
