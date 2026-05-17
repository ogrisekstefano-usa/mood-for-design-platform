/**
 * Editorial workflow status — editorial-grade labels & visual tokens.
 *
 * The backend exposes a richer status graph (draft, direction_defined,
 * ai_composing, ready_for_editorial_review, revision_requested,
 * approved, scheduled, published, archived). On the surface we keep the
 * UX coherent with the five published states the user mandated:
 *
 *   draft · ai_composing · ready_for_editorial_review · scheduled · published
 *
 * The remaining backend states (direction_defined / revision_requested /
 * approved / archived) keep their precise editorial label so editors are
 * never misled. NEVER aggregate.
 *
 * Rendering rule: editorial calm. No alert-style red, no "enterprise"
 * blue. A single muted accent + a typographic eyebrow.
 */

export const STATUS_META = {
  draft:                      { label: 'Bozza',                 dot: '#7a7a7a', tone: 'quiet'     },
  direction_defined:          { label: 'Direzione definita',    dot: '#7a7a7a', tone: 'quiet'     },
  ai_composing:               { label: 'In composizione',       dot: '#c8a572', tone: 'composing' },
  ready_for_editorial_review: { label: 'Pronto per revisione',  dot: '#d4af37', tone: 'review'    },
  revision_requested:         { label: 'Revisione richiesta',   dot: '#c87a3a', tone: 'review'    },
  approved:                   { label: 'Approvata',             dot: '#9aa56a', tone: 'approved'  },
  scheduled:                  { label: 'Programmata',           dot: '#6b8aa5', tone: 'scheduled' },
  published:                  { label: 'Pubblicata',            dot: '#3d6b3a', tone: 'published' },
  archived:                   { label: 'Archiviata',            dot: '#4a4a4a', tone: 'quiet'     },
};

export function statusMeta(status) {
  return STATUS_META[status] || { label: status || 'Bozza', dot: '#7a7a7a', tone: 'quiet' };
}

/** The five canonical "spine" states displayed in calendar filter chips. */
export const SPINE_STATUSES = [
  'draft',
  'ai_composing',
  'ready_for_editorial_review',
  'scheduled',
  'published',
];
