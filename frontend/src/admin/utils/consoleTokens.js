/**
 * ITER161 — Shared editorial design tokens for the Advisor Console.
 * Private-banking aesthetic: deep ink, architectural negative space,
 * typography-led hierarchy, soft hairlines, never a "dashboard".
 */
export const tokens = {
  bg:           '#08090C',
  bgRaised:     '#0D0F14',
  bgSunk:       '#06070A',
  ink:          '#F5F2EC',
  inkSoft:      'rgba(245,242,236,0.72)',
  inkDim:       'rgba(245,242,236,0.42)',
  inkFaint:     'rgba(245,242,236,0.22)',
  hair:         'rgba(255,255,255,0.06)',
  hairBold:     'rgba(255,255,255,0.12)',
  teal:         '#00C9B3',
  tealDim:      'rgba(0,201,179,0.42)',
  amber:        '#D7B16A',
  ember:        '#C68A6A',
};

export const eyebrow = {
  fontFamily: 'Inter, sans-serif',
  fontSize:   '0.64rem',
  letterSpacing: '0.36em',
  textTransform: 'uppercase',
  color: tokens.teal,
  fontWeight: 500,
};

export const headline = {
  fontFamily: 'Playfair Display, serif',
  fontSize:   '2.4rem',
  lineHeight: 1.1,
  color: tokens.ink,
  letterSpacing: '-0.01em',
  fontWeight: 400,
};

export const headlineSmall = {
  ...headline,
  fontSize: '1.55rem',
};

export const sublead = {
  fontFamily: 'Inter, sans-serif',
  fontSize:   '0.95rem',
  lineHeight: 1.65,
  color: tokens.inkSoft,
  fontWeight: 300,
  fontStyle:  'italic',
};

export const sectionLabel = {
  fontFamily: 'Inter, sans-serif',
  fontSize:   '0.7rem',
  letterSpacing: '0.32em',
  textTransform: 'uppercase',
  color: tokens.inkDim,
  fontWeight: 500,
};

export const dataValue = {
  fontFamily: 'Playfair Display, serif',
  fontSize:   '2.6rem',
  lineHeight: 1,
  color: tokens.ink,
  fontWeight: 400,
};

export const helper = {
  fontFamily: 'Inter, sans-serif',
  fontSize:   '0.78rem',
  lineHeight: 1.55,
  color: tokens.inkDim,
  fontWeight: 300,
};

/* Temperature dot — calm color cue (no red alarms) */
export const TEMPERATURE_DOTS = {
  cold:   tokens.inkFaint,
  warm:   '#9FB7C9',
  strong: tokens.amber,
  ready:  tokens.teal,
};

/* Status hue — all muted, no urgency. */
export const STATUS_TONE = {
  prospect:                tokens.inkDim,
  under_review:            tokens.inkSoft,
  contacted:               '#A9C7E0',
  presentation_scheduled:  '#C9B68A',
  presented:               tokens.amber,
  qualified:               tokens.teal,
  proposal:                tokens.teal,
  activated:               tokens.ink,
  not_aligned:             tokens.inkDim,
  archived:                tokens.inkFaint,
};
