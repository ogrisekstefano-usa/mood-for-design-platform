/**
 * Editorial workflow status — editorial-grade labels & visual tokens.
 *
 * ITER131hf · the labels here moved to a locale-aware accessor backed by
 * the i18n registry so EN-US never receives an Italian status chip.
 *
 * Each state still carries its precise editorial meaning. The five
 * canonical "spine" states (draft / ai_composing / ready_for_editorial_review
 * / scheduled / published) are exposed via SPINE_STATUSES below for the
 * Editorial Calendar filter chips.
 */
import { pickString } from '../../i18n/engine';

const STATUS_TONES = {
  draft:                      { dot: '#7a7a7a', tone: 'quiet'     },
  direction_defined:          { dot: '#7a7a7a', tone: 'quiet'     },
  ai_composing:               { dot: '#c8a572', tone: 'composing' },
  ready_for_editorial_review: { dot: '#d4af37', tone: 'review'    },
  revision_requested:         { dot: '#c87a3a', tone: 'review'    },
  approved:                   { dot: '#9aa56a', tone: 'approved'  },
  scheduled:                  { dot: '#6b8aa5', tone: 'scheduled' },
  published:                  { dot: '#3d6b3a', tone: 'published' },
  archived:                   { dot: '#4a4a4a', tone: 'quiet'     },
};

const STATUS_KEY = (s) => `taxonomy.editorial_status.${s || 'draft'}`;

/** Static legacy export kept for compatibility — values are now lazy. */
export const STATUS_META = new Proxy({}, {
  get(_, key) {
    if (typeof key !== 'string') return undefined;
    const tones = STATUS_TONES[key] || STATUS_TONES.draft;
    return {
      ...tones,
      get label() {
        return pickString(STATUS_KEY(key)) || key;
      },
    };
  },
});

/** Locale-aware accessor — preferred. */
export function statusMeta(status, t) {
  const tones = STATUS_TONES[status] || STATUS_TONES.draft;
  const label = t
    ? t(STATUS_KEY(status), null, status || 'Draft')
    : pickString(STATUS_KEY(status));
  return { ...tones, label };
}

/** The five canonical "spine" states displayed in calendar filter chips. */
export const SPINE_STATUSES = [
  'draft',
  'ai_composing',
  'ready_for_editorial_review',
  'scheduled',
  'published',
];
