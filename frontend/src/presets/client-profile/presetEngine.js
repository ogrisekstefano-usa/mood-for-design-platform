/**
 * Client Profile Preset Engine · ITER162
 *
 * Risolve a runtime quale preset visuale usare per il Client Profile™
 * (Atelier / Axis / Gallery / Residence). Per ora restituisce SEMPRE
 * "atelier" (P0), ma la firma è già pronta a leggere:
 *
 *   - tenant.preferences.client_profile_preset (Blueprint-controlled)
 *   - client.tier (private / premium / atelier)
 *   - project.category (residence / commercial / hospitality)
 *   - country / language overrides
 *
 * NON inserire qui logica di feature flag, telemetry o A/B test:
 * questa è la sorgente di verità VISUALE. Tutto il resto vive sul
 * backend o nel TenantContext.
 */

export const CLIENT_PROFILE_PRESETS = ['atelier', 'axis', 'gallery', 'residence'];

/**
 * @typedef {'atelier'|'axis'|'gallery'|'residence'} ClientProfilePreset
 *
 * @typedef {object} PresetConfig
 * @property {ClientProfilePreset} preset
 * @property {'three-column'|'split'|'editorial-stack'} layout
 * @property {{
 *   sidebar:boolean, hero:boolean, quote:boolean, quickSummary:boolean,
 *   referenceCard:boolean, actionPanel:boolean, timeline:boolean,
 *   nextStep:boolean, moodboardPreview:boolean, documents:boolean,
 *   appointments:boolean, quickActions:boolean, securityCard:boolean,
 *   passwordPrompt:boolean
 * }} components
 * @property {'compact'|'comfortable'|'luxury'} visualDensity
 * @property {{ serif:string, sans:string }} typography
 * @property {'editorial'|'minimal'|'iconic'} navigationStyle
 * @property {{ panel:number, hero:number, gutter:number }} spacing
 */

/** @type {Record<ClientProfilePreset, PresetConfig>} */
const PRESET_TABLE = {
  atelier: {
    preset: 'atelier',
    layout: 'three-column',
    components: {
      sidebar: true,
      hero: true,
      quote: true,
      quickSummary: true,
      referenceCard: true,
      actionPanel: true,
      timeline: true,
      nextStep: true,
      // future-ready, off by default
      moodboardPreview: false,
      documents: false,
      appointments: false,
      quickActions: false,
      securityCard: true,   // discreet, bottom-sidebar
      passwordPrompt: true, // discreet bottom-right
    },
    visualDensity: 'luxury',
    typography: {
      serif: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
      sans:  "'Inter', system-ui, -apple-system, sans-serif",
    },
    navigationStyle: 'editorial',
    spacing: { panel: 48, hero: 80, gutter: 32 },
  },

  // Stubs · DESIGN ready, components NOT built yet. Used only by
  // the preset registry — fall back to 'atelier' until shipped.
  axis:      { preset: 'axis',      layout: 'split',
               components: {}, visualDensity: 'comfortable',
               typography: { serif: 'inherit', sans: 'inherit' },
               navigationStyle: 'minimal', spacing: { panel: 32, hero: 64, gutter: 24 } },
  gallery:   { preset: 'gallery',   layout: 'editorial-stack',
               components: {}, visualDensity: 'luxury',
               typography: { serif: 'inherit', sans: 'inherit' },
               navigationStyle: 'iconic', spacing: { panel: 56, hero: 96, gutter: 40 } },
  residence: { preset: 'residence', layout: 'three-column',
               components: {}, visualDensity: 'comfortable',
               typography: { serif: 'inherit', sans: 'inherit' },
               navigationStyle: 'editorial', spacing: { panel: 40, hero: 72, gutter: 28 } },
};

/**
 * Decide which preset applies for the current viewer.
 *
 * @param {{ tenant?:object, profile?:object, journey?:object, overrideKey?:string }} ctx
 * @returns {PresetConfig}
 */
export function resolveClientProfilePreset(ctx = {}) {
  // 1. explicit query/localStorage override (Blueprint preview)
  if (ctx.overrideKey && PRESET_TABLE[ctx.overrideKey]) {
    return PRESET_TABLE[ctx.overrideKey];
  }
  // 2. tenant-level preference (future)
  const tenantKey = ctx.tenant?.preferences?.client_profile_preset;
  if (tenantKey && PRESET_TABLE[tenantKey]) return PRESET_TABLE[tenantKey];

  // 3. project category (future)
  // const cat = (ctx.journey?.category || '').toLowerCase();
  // if (cat === 'hospitality') return PRESET_TABLE.gallery;

  // 4. default
  return PRESET_TABLE.atelier;
}

/** Stable list of presets (for Blueprint UI later) */
export const listPresets = () =>
  CLIENT_PROFILE_PRESETS.map((k) => ({ key: k, ...PRESET_TABLE[k] }));
