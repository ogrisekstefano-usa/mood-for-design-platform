/**
 * CinematicLoader — Atelier Nordic™ atmospheric loading state.
 *
 * ITER138 · Phase 4 (Deep Propagation + Cinematic Loading States™).
 *
 * Replaces every "software-feeling" spinner across the OS with a single
 * editorial vocabulary: cyan pulse line + italic Cormorant phrase that
 * rotates through atelier voice copy. Transforms waiting into emotional
 * continuity, not interruption.
 *
 * Variants:
 *   - default  → block loader with editorial phrase + cyan pulse line
 *   - centered → 96px-padded loading screen (full-route transitions)
 *   - inline   → 28px pulse next to a single line of italic copy
 *
 * Phrase resolution priority:
 *   1. Explicit `phrase` prop
 *   2. i18n key `atelier.loader.{phraseKey}` if provided
 *   3. Random rotation through `atelier.loader.phrase_*` (1-6) keys
 *   4. Hardcoded English fallback
 */
import React, { useMemo } from 'react';
import { useT } from '../contexts/BlueprintContext';

const PHRASE_KEYS = [
  'phrase_preparing_atelier',
  'phrase_curating_atmosphere',
  'phrase_opening_chapter',
  'phrase_synchronizing_rhythm',
  'phrase_listening_voices',
  'phrase_arranging_silence',
];

const PHRASE_FALLBACKS = {
  phrase_preparing_atelier:    'Preparing your atelier…',
  phrase_curating_atmosphere:  'Curating the atmosphere…',
  phrase_opening_chapter:      'Opening the next chapter…',
  phrase_synchronizing_rhythm: 'Synchronising the design rhythm…',
  phrase_listening_voices:     'Listening for voices in the studio…',
  phrase_arranging_silence:    'Arranging the silence…',
};

const CinematicLoader = ({
  variant = 'default',
  phrase,
  phraseKey,
  sub,
  className = '',
  testid = 'cinematic-loader',
}) => {
  const t = useT();

  const resolvedPhrase = useMemo(() => {
    if (phrase) return phrase;
    if (phraseKey) {
      return t(`atelier.loader.${phraseKey}`, null,
        PHRASE_FALLBACKS[phraseKey] || 'Preparing the atelier…');
    }
    const key = PHRASE_KEYS[Math.floor(Math.random() * PHRASE_KEYS.length)];
    return t(`atelier.loader.${key}`, null, PHRASE_FALLBACKS[key]);
  }, [phrase, phraseKey, t]);

  return (
    <div className={`cinematic-loader cinematic-loader--${variant} ${className}`}
         data-testid={testid}
         role="status"
         aria-live="polite">
      <div className="cinematic-loader__pulse" aria-hidden />
      <p className="cinematic-loader__phrase">{resolvedPhrase}</p>
      {sub && variant !== 'inline' && (
        <p className="cinematic-loader__sub">{sub}</p>
      )}
    </div>
  );
};

export default CinematicLoader;
