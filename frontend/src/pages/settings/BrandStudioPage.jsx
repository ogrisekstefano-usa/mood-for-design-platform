/**
 * BrandStudioPage — Tenant Brand Override (`/settings/brand`).
 *
 * Split layout:
 *   • LEFT  — controls: identity / palette / typography / radius+shadow / preset cards
 *   • RIGHT — sticky live preview using the same CSS vars that drive the platform.
 *
 * Live preview is INSTANT and SAFE:
 *   - User edits → `applyDraft(theme)` writes vars to documentElement
 *   - "Save" → PUT /api/branding → refresh() picks the persisted theme
 *   - "Discard" → clearDraft() restores the saved theme
 *
 * No SSR concerns: this page is client-only. The same `--brand-*` vars are
 * mounted at boot for all tenants, so visiting `/dashboard` immediately after
 * saving will already show the new theme.
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Palette, Type, Save, RotateCcw, Loader2, CheckCircle2,
  Image as ImageIcon, Layers, Sparkles, Square, Circle, Sun, Moon,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { useTenantTheme } from '../../contexts/TenantThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import BlueprintColorPicker from '../../components/common/BlueprintColorPicker';
import EditorialMediaField from '../../components/common/EditorialMediaField';
import {
  LIGHT_PALETTES, DARK_PALETTES, applyPalette as applyCuratedRoot, storePalette, clearPalette as clearCuratedRoot,
} from '../../lib/curatedPalettes';
import { applyThemeEverywhere } from '../../lib/themeApply';

const DISPLAY_FONTS = [
  // Serif (editorial)
  'Playfair Display', 'Cormorant Garamond', 'DM Serif Display', 'Bodoni Moda', 'Fraunces', 'EB Garamond',
  // Sans (modern)
  'Inter Tight', 'Space Grotesk', 'Manrope', 'DM Sans', 'Archivo', 'Outfit',
];
const BODY_FONTS    = ['Inter', 'Montserrat', 'Manrope', 'Plus Jakarta Sans', 'Space Grotesk', 'DM Sans', 'Work Sans', 'Karla'];
const RADIUS_OPTS   = ['0px', '2px', '4px', '8px', '12px'];
const DENSITY_OPTS  = ['compact', 'comfortable', 'spacious'];
const SHADOW_OPTS   = ['none', 'soft', 'medium', 'strong'];

// Font kind hint — same catalog as TenantThemeContext, used to render
// each font option in its OWN typeface so the user sees what they're choosing.
const FONT_KIND = {
  'Playfair Display':'serif','Cormorant Garamond':'serif','DM Serif Display':'serif',
  'Bodoni Moda':'serif','Fraunces':'serif','EB Garamond':'serif',
  'Inter':'sans','Inter Tight':'sans','Montserrat':'sans','Manrope':'sans',
  'Plus Jakarta Sans':'sans','Space Grotesk':'sans','DM Sans':'sans',
  'Archivo':'sans','Outfit':'sans','Work Sans':'sans','Karla':'sans','Sora':'sans',
};

const DEFAULT_PALETTE = {
  primary: '#00C9B3', secondary: '#33DCC6', accent: '#7EE6DA',
  background: '#0F0F10', surface: '#16171A',
  text_primary: '#F4F5F7', text_secondary: '#C8CACE',
  border: 'rgba(244,245,247,0.10)',
  success: '#22C55E', warning: '#F59E0B', danger: '#EF4444',
};

// ── Color science helper — converte un hex/rgba in HSL hue (0-360) +
// lightness e saturation per ordinare le palette per famiglia cromatica.
// Restituisce { h, s, l } o null se non parsabile.
const parseColor = (input) => {
  if (!input || typeof input !== 'string') return null;
  const s = input.trim();
  let r, g, b;
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split('').map((c) => c + c).join('') : hex[1];
    r = parseInt(h.slice(0, 2), 16);
    g = parseInt(h.slice(2, 4), 16);
    b = parseInt(h.slice(4, 6), 16);
  } else {
    const rgba = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (!rgba) return null;
    r = parseInt(rgba[1], 10); g = parseInt(rgba[2], 10); b = parseInt(rgba[3], 10);
  }
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let sat = 0;
  if (d !== 0) {
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn)      h = ((gn - bn) / d + (gn < bn ? 6 : 0));
    else if (max === gn) h = ((bn - rn) / d + 2);
    else                 h = ((rn - gn) / d + 4);
    h *= 60;
  }
  return { h, s: sat, l };
};

// Ordina i preset prima per LUMINANCE (chiari prima, scuri dopo) e poi
// per famiglia cromatica (hue). I grayscale finiscono in coda nel proprio gruppo.
const sortPresetsByHue = (presets) => {
  if (!Array.isArray(presets)) return [];
  return [...presets].sort((a, b) => {
    const modeA = (a?.theme?.mode || '').toLowerCase() === 'dark' ? 1 : 0;
    const modeB = (b?.theme?.mode || '').toLowerCase() === 'dark' ? 1 : 0;
    if (modeA !== modeB) return modeA - modeB; // light (0) prima, dark (1) dopo
    const ca = parseColor(a?.theme?.palette?.primary) || { h: 0, s: 0, l: 0 };
    const cb = parseColor(b?.theme?.palette?.primary) || { h: 0, s: 0, l: 0 };
    const greyA = ca.s < 0.12 ? 1 : 0;
    const greyB = cb.s < 0.12 ? 1 : 0;
    if (greyA !== greyB) return greyA - greyB; // i grigi in fondo del gruppo
    if (greyA === 1) return ca.l - cb.l;       // tra grigi, dal chiaro allo scuro
    return ca.h - cb.h;                         // famiglie cromatiche per hue
  });
};

const Section = ({ kicker, title, children, testid, trace }) => (
  <section className="mb-9" data-testid={testid}>
    <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] font-body mb-1">{kicker}</p>
    <h2 className="font-heading text-xl text-[var(--bp-text-primary)] mb-2">{title}</h2>
    {trace && (
      <div className="mb-4 inline-flex items-center gap-2 px-2.5 py-1 bg-[var(--bp-surface-2)] border border-[var(--bp-border)] rounded-[var(--bp-radius-xs)]"
           data-testid={`${testid}-trace`}>
        <span className="w-1 h-1 rounded-full bg-[var(--bp-primary)]" aria-hidden />
        <span className="text-[9px] uppercase tracking-[0.20em] text-[var(--bp-text-muted)] font-body">{trace}</span>
      </div>
    )}
    {children}
  </section>
);

const Field = ({ label, children }) => (
  <label className="block mb-3">
    <span className="block text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] font-body mb-1.5">{label}</span>
    {children}
  </label>
);

const TextInput = ({ value, onChange, placeholder, testid }) => (
  <input value={value || ''} onChange={(e) => onChange(e.target.value)}
         placeholder={placeholder} data-testid={testid}
         className="w-full px-3 py-2 bg-[var(--bp-surface-2)] border border-[var(--bp-border)] rounded-[var(--bp-radius-xs)] text-[var(--bp-text-primary)] text-[12px] font-body outline-none focus:border-[var(--bp-primary)] transition-colors" />
);

// ── Brand Studio multilingue group (Step B Phase 4) ──────────────────
//
// Public brand name, tagline and short description support per-locale values
// stored under `branding.{field}_i18n = { 'it-IT': '...', 'en-US': '...' }`.
// The legacy single-string `branding.{field}` remains a backward-compatible
// fallback used by `public/brand` until the i18n bag is populated.
const I18N_LOCALES = [
  { code: 'it-IT', flag: '🇮🇹', label: 'Italiano' },
  { code: 'en-US', flag: '🇺🇸', label: 'English' },
  { code: 'en-GB', flag: '🇬🇧', label: 'English UK' },
  { code: 'fr-FR', flag: '🇫🇷', label: 'Français' },
  { code: 'de-DE', flag: '🇩🇪', label: 'Deutsch' },
  { code: 'es-ES', flag: '🇪🇸', label: 'Español' },
  { code: 'es-MX', flag: '🇲🇽', label: 'Español MX' },
  { code: 'ar-AE', flag: '🇦🇪', label: 'العربية' },
];

const IdentityI18nGroup = ({ branding, setBranding, t }) => {
  const [activeLocale, setActiveLocale] = useState('it-IT');
  const tr = t || ((_, __, fb) => fb);
  const getI18n = (field) => {
    const bag = branding[`${field}_i18n`] || {};
    // Seed the active locale with the legacy single string on first edit.
    if (!bag[activeLocale] && branding[field] && activeLocale === 'it-IT') return branding[field];
    return bag[activeLocale] || '';
  };
  const setI18n = (field, v) => {
    const bag = { ...(branding[`${field}_i18n`] || {}), [activeLocale]: v };
    // Keep the legacy single string mirror in sync with the default locale
    // so the unauth `/brand` endpoint always has a sensible fallback even
    // before its locale_code param resolution kicks in.
    const next = { ...branding, [`${field}_i18n`]: bag };
    if (activeLocale === 'it-IT') next[field] = v;
    setBranding(next);
  };
  return (
    <div data-testid="brand-i18n-group" className="mb-2">
      {/* Locale switcher */}
      <div className="flex flex-wrap gap-1 mb-3" role="tablist" aria-label="Edit per locale">
        {I18N_LOCALES.map((l) => (
          <button
            key={l.code}
            type="button"
            role="tab"
            aria-selected={activeLocale === l.code}
            onClick={() => setActiveLocale(l.code)}
            data-testid={`brand-i18n-tab-${l.code}`}
            className={`px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] font-body rounded-[3px] border transition-colors ${
              activeLocale === l.code
                ? 'bg-[var(--bp-primary)] text-[var(--bp-bg)] border-[var(--bp-primary)]'
                : 'bg-transparent text-[var(--bp-text-muted)] border-[var(--bp-border)] hover:text-[var(--bp-text-primary)]'
            }`}
          >
            <span style={{ marginRight: 5 }}>{l.flag}</span>{l.code}
          </button>
        ))}
      </div>
      <p className="text-[10.5px] italic text-[var(--bp-text-muted)] font-body mb-3" style={{ lineHeight: 1.5 }}>
        {tr('brand.i18nHint', { locale: activeLocale }, `Stai modificando i valori per ${activeLocale}. Il sito pubblico mostra il valore del locale visitato — un visitatore tedesco vede la versione de-DE.`)}
      </p>

      <Field label={`${tr('brand.field.public_name', null, 'Nome pubblico del brand')} · ${activeLocale}`}>
        <TextInput value={getI18n('public_brand_name')}
                   onChange={(v) => setI18n('public_brand_name', v)}
                   placeholder="MOOD for DESIGN"
                   testid="brand-public-name" />
      </Field>
      <Field label={`${tr('brand.field.tagline', null, 'Tagline')} · ${activeLocale}`}>
        <TextInput value={getI18n('tagline')} onChange={(v) => setI18n('tagline', v)}
                   placeholder="Spaces that tell stories"
                   testid="brand-tagline" />
      </Field>
      <Field label={`${tr('brand.field.short_desc', null, 'Descrizione breve')} · ${activeLocale}`}>
        <TextInput value={getI18n('short_description')} onChange={(v) => setI18n('short_description', v)}
                   placeholder="A boutique studio crafting bespoke interiors."
                   testid="brand-short-desc" />
      </Field>
    </div>
  );
};

const ColorPicker = ({ value, onChange, label, testid }) => (
  <div className="mb-2">
    <BlueprintColorPicker value={value} onChange={onChange} label={label} testid={testid} />
  </div>
);

const SelectChips = ({ options, value, onChange, testid, renderAs }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map((o) => {
      const active = value === o;
      // For typography chips, render the option label in its OWN font so
      // the picker visually communicates the choice (serif vs sans).
      const fontStyle = renderAs === 'font'
        ? { fontFamily: `'${o}', ${FONT_KIND[o] === 'serif' ? 'serif' : 'sans-serif'}`,
            letterSpacing: 0.02, textTransform: 'none', fontSize: 13 }
        : null;
      return (
        <button type="button" key={o} onClick={() => onChange(o)} data-testid={`${testid}-${o}`}
                style={fontStyle || undefined}
                className={`px-3 py-1.5 rounded-[var(--bp-radius-xs)] text-[10px] font-body uppercase tracking-[0.18em] border transition-colors
                  ${active ? 'border-[var(--bp-primary)] text-[var(--bp-primary)] bg-[var(--bp-primary)]/8'
                           : 'border-[var(--bp-border)] text-[var(--bp-text-secondary)] hover:border-[var(--bp-border-strong)] hover:text-[var(--bp-text-primary)]'}`}>
          {o}
        </button>
      );
    })}
  </div>
);

const PresetCard = ({ preset, current, onPick, testid }) => {
  const p = preset.theme?.palette || {};
  return (
    <button type="button" onClick={() => onPick(preset)}
            data-testid={testid}
            className={`text-left rounded-[var(--bp-radius-sm)] p-3 border transition-colors group
              ${current ? 'border-[var(--bp-primary)] bg-[var(--bp-primary)]/5'
                        : 'border-[var(--bp-border)] hover:border-[var(--bp-border-strong)]'}`}>
      <div className="aspect-[5/2] rounded-[3px] mb-2 overflow-hidden border border-[var(--bp-border)]"
           style={{ background: p.background || '#111' }}>
        <div className="h-full flex items-center px-3 gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.primary }} />
          <span className="w-2 h-2 rounded-full" style={{ background: p.secondary }} />
          <span className="w-2 h-2 rounded-full" style={{ background: p.accent }} />
          <span className="ml-auto font-heading text-[11px]" style={{ color: p.text_primary, fontFamily: preset.theme?.typography?.display }}>
            {preset.label}
          </span>
        </div>
      </div>
      <p className="text-[11px] font-body text-[var(--bp-text-primary)]">{preset.label}</p>
      <p className="text-[9px] font-body text-[var(--bp-text-muted)] line-clamp-1 mt-0.5">{preset.description}</p>
      {current && <CheckCircle2 size={12} strokeWidth={2} className="absolute mt-[-90px] ml-auto text-[var(--bp-primary)]" />}
    </button>
  );
};

// ── Curated palette card (24 curated themes from the topbar mega-menu)
const CuratedPaletteCard = ({ palette, current, onPick, testid }) => (
  <button type="button" onClick={() => onPick(palette)}
          data-testid={testid}
          className={`relative text-left rounded-[var(--bp-radius-sm)] p-3 border transition-all group
            ${current
              ? 'border-[var(--bp-primary)] bg-[var(--bp-primary)]/5 ring-1 ring-[var(--bp-primary)]'
              : 'border-[var(--bp-border)] hover:border-[var(--bp-border-strong)] hover:-translate-y-px'}`}>
    <div className="aspect-[5/2] rounded-[3px] mb-2 overflow-hidden flex border border-[var(--bp-border)]">
      <span className="flex-1" style={{ background: palette.bg }} />
      <span className="flex-1" style={{ background: palette.surfaceElev }} />
      <span className="flex-1" style={{ background: palette.primary }} />
      <span className="flex-1" style={{
        background: `linear-gradient(135deg, ${palette.accent} 0%, ${palette.primary} 55%, ${palette.surfaceElev} 100%)`,
      }} />
    </div>
    <p className="text-[11px] font-body text-[var(--bp-text-primary)]">{palette.name}</p>
    <p className="text-[9px] font-body text-[var(--bp-text-muted)] line-clamp-1 mt-0.5">{palette.description}</p>
    {current && (
      <span className="absolute top-2 right-2 inline-flex w-4 h-4 rounded-full bg-[var(--bp-primary)] text-white items-center justify-center">
        <CheckCircle2 size={10} strokeWidth={2.4} />
      </span>
    )}
  </button>
);

// ── Live Preview surface ───────────────────────────────────────────
const LivePreview = ({ branding, theme }) => {
  const palette = theme?.palette || DEFAULT_PALETTE;
  const typo = theme?.typography || {};
  const radius = theme?.radius || '2px';
  // Preview always shows the it-IT entry of the i18n bag (or legacy single string).
  const previewName    = (branding?.public_brand_name_i18n || {})['it-IT'] || branding?.public_brand_name || 'Your Studio';
  const previewTagline = (branding?.tagline_i18n || {})['it-IT']            || branding?.tagline            || 'Premium interior design';
  const previewDesc    = (branding?.short_description_i18n || {})['it-IT'] || branding?.short_description || 'A live preview of how your tenant looks. Edit on the left — changes appear here in real time.';
  return (
    <div className="rounded-[var(--bp-radius-md)] border border-[var(--bp-border)] overflow-hidden sticky top-6"
         data-testid="brand-preview"
         style={{
           background: palette.background,
           color: palette.text_primary,
           fontFamily: typo.body ? `${typo.body}, sans-serif` : 'inherit',
         }}>
      {/* Navbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: palette.border }}>
        <div className="font-heading text-lg" style={{ fontFamily: typo.display ? `${typo.display}, serif` : 'inherit' }}>
          {previewName}
        </div>
        <button className="px-3 py-1.5 text-[10px] uppercase tracking-[0.18em]"
                style={{ background: palette.primary, color: palette.background, borderRadius: radius }}>
          Sign in
        </button>
      </div>
      {/* Hero */}
      <div className="p-8" style={{ background: palette.surface }}>
        <p className="text-[10px] uppercase tracking-[0.22em] mb-2" style={{ color: palette.primary }}>
          {previewTagline}
        </p>
        <h1 className="font-heading leading-tight mb-2 text-3xl"
            style={{ fontFamily: typo.display ? `${typo.display}, serif` : 'inherit' }}>
          Spaces that tell stories.
        </h1>
        <p className="text-[12px] mb-4 max-w-md" style={{ color: palette.text_secondary }}>
          {previewDesc}
        </p>
        <div className="flex gap-2">
          <button className="px-4 py-2 text-[10px] uppercase tracking-[0.2em]"
                  style={{ background: palette.primary, color: palette.background, borderRadius: radius }}>
            Begin
          </button>
          <button className="px-4 py-2 text-[10px] uppercase tracking-[0.2em] border"
                  style={{ borderColor: palette.border, color: palette.text_primary, borderRadius: radius }}>
            Catalogue
          </button>
        </div>
      </div>
      {/* Cards */}
      <div className="grid grid-cols-3 gap-2 p-4" style={{ background: palette.background }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-3 border"
               style={{ borderColor: palette.border, borderRadius: radius, background: palette.surface }}>
            <div className="aspect-square mb-2" style={{ background: i === 2 ? palette.accent : palette.secondary, borderRadius: radius }} />
            <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: palette.text_secondary }}>Project</p>
            <p className="font-heading text-[12px]" style={{ fontFamily: typo.display ? `${typo.display}, serif` : 'inherit' }}>Villa #{i}</p>
          </div>
        ))}
      </div>
      {/* Buttons strip */}
      <div className="flex gap-2 px-4 pb-4" style={{ background: palette.background }}>
        <span className="px-2 py-1 text-[10px]" style={{ background: palette.success, color: palette.background, borderRadius: radius }}>Success</span>
        <span className="px-2 py-1 text-[10px]" style={{ background: palette.warning, color: palette.background, borderRadius: radius }}>Warning</span>
        <span className="px-2 py-1 text-[10px]" style={{ background: palette.danger, color: palette.background, borderRadius: radius }}>Danger</span>
      </div>
    </div>
  );
};

// ── Page ───────────────────────────────────────────────────────────
const BrandStudioPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useBlueprint();
  const { user } = useAuth();
  const { theme: savedTheme, branding: savedBranding, refresh, applyDraft, clearDraft } = useTenantTheme();

  // Local working copy
  const [branding, setBranding] = useState(savedBranding || {});
  const [theme, setTheme] = useState(savedTheme || { palette: DEFAULT_PALETTE, typography: {}, radius: '2px', density: 'comfortable', shadow: 'soft' });
  const [presets, setPresets] = useState([]);
  const [saving, setSaving] = useState(false);

  const canManage = user?.role === 'super_admin' || user?.role === 'tenant_admin';

  // Load presets once
  useEffect(() => {
    api.get('/api/branding/presets').then((r) => setPresets(r.data?.presets || []))
       .catch(() => {});
  }, []);

  // When saved theme/branding arrive (or refresh), copy them into local state.
  useEffect(() => {
    if (savedBranding) setBranding(savedBranding);
    if (savedTheme) setTheme({ ...savedTheme, palette: { ...DEFAULT_PALETTE, ...(savedTheme.palette || {}) } });
  }, [savedTheme, savedBranding]);

  // Push live preview to root vars whenever theme changes locally
  useEffect(() => { applyDraft(theme); }, [theme, applyDraft]);

  // Scroll-to-section quando entriamo con un hash (es. /settings/brand#section-curated-palettes
  // dal PaletteSwitcher topbar). Diamo un frame perché la pagina monta progressive.
  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.replace(/^#/, '');
    let cancelled = false;
    const tryScroll = (attempt = 0) => {
      if (cancelled) return;
      const el = document.querySelector(`[data-testid="${id}"]`) || document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (attempt < 20) setTimeout(() => tryScroll(attempt + 1), 120);
    };
    tryScroll();
    return () => { cancelled = true; };
  }, [location.hash, savedTheme]);

  const dirty = useMemo(() =>
    JSON.stringify(branding) !== JSON.stringify(savedBranding || {}) ||
    JSON.stringify(theme)    !== JSON.stringify(savedTheme || {}),
    [branding, theme, savedBranding, savedTheme]);

  const setPalette = (k, v) => setTheme((prev) => ({ ...prev, palette: { ...(prev.palette || {}), [k]: v } }));
  const setTypo    = (k, v) => setTheme((prev) => ({ ...prev, typography: { ...(prev.typography || {}), [k]: v } }));

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await api.put('/api/branding', { branding, theme });
      toast.success('Brand saved');
      await refresh();
      clearDraft();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [branding, theme, refresh, clearDraft]);

  const discard = () => {
    setBranding(savedBranding || {});
    setTheme(savedTheme || { palette: DEFAULT_PALETTE, typography: {}, radius: '2px', density: 'comfortable', shadow: 'soft' });
    clearDraft();
    toast.message('Reverted to saved state');
  };

  const applyPreset = async (preset) => {
    try {
      // 1. UI optimistic: pulisci override curated + applica subito le var
      clearCuratedRoot();
      applyThemeEverywhere(preset.theme);
      // 2. Server sync
      const r = await api.post('/api/branding/apply-preset', { preset_key: preset.key });
      const next = r.data?.theme || preset.theme || {};
      // 3. Riapplico il theme dal server (potrebbe avere defaults merged)
      applyThemeEverywhere(next);
      setTheme({ ...next, palette: { ...DEFAULT_PALETTE, ...(next.palette || {}) } });
      await refresh();
      toast.success(`Preset "${preset.label}" applied`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not apply preset');
    }
  };

  // ── Curated palette (mega-menu) — applies instantly to the workspace +
  //    propagates into the brand theme so the storefront receives it too.
  const applyCuratedPalette = (palette) => {
    // 1. Instant visual feedback on the workspace via :root override.
    applyCuratedRoot(palette.id);
    storePalette(palette.id);
    // 2. Map curated palette tokens → brand theme.palette so Save persists it.
    const isDark = (palette.text || '').toLowerCase().startsWith('#e') ||
                   (palette.text || '').toLowerCase().startsWith('#f');
    const mode = isDark ? 'dark' : 'light';
    setTheme((prev) => ({
      ...prev,
      mode,
      preset_key: `curated_${palette.id}`,
      palette: {
        ...DEFAULT_PALETTE,
        ...(prev.palette || {}),
        background:        palette.bg,
        surface:           palette.surface,
        surface_elevated:  palette.surfaceElev,
        primary:           palette.primary,
        primary_soft:      palette.primarySoft,
        secondary:         palette.accent,
        accent:            palette.accent,
        border:            palette.border,
        border_strong:     palette.borderStrong,
        text_primary:      palette.text,
        text_secondary:    palette.textMuted,
        text_muted:        palette.textFaint,
      },
    }));
    toast.success(`Tema "${palette.name}" applicato — premi "Salva" per renderlo definitivo`);
  };

  if (!canManage) {
    return (
      <div className="p-10 text-[var(--bp-text-muted)] text-center" data-testid="brand-page-denied">
        You do not have permission to edit brand settings.
      </div>
    );
  }

  const palette = theme.palette || {};

  return (
    <div className="p-8 pb-24 max-w-[1500px] mx-auto" data-testid="brand-page">
      {/* Header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <button onClick={() => navigate('/settings')}
                  data-testid="brand-back"
                  className="flex items-center gap-1.5 text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] text-[10px] font-body uppercase tracking-[0.22em] mb-3">
            <ArrowLeft size={11} strokeWidth={1.5} /> {t('common.back', null, 'Back')}
          </button>
          <p className="text-[var(--bp-primary)] text-[10px] font-body uppercase tracking-[0.22em] font-semibold mb-1">
            Workspace · Brand Studio
          </p>
          <h1 className="font-heading text-4xl font-light text-[var(--bp-text-primary)] leading-none">
            {t('brand.title', null, 'Identità & Tema')}
          </h1>
          <p className="text-[var(--bp-text-muted)] text-[13px] font-body mt-2 max-w-xl">
            {t('brand.intro', null, "Brand Studio è il sistema di identità visiva del tuo studio: palette, tipografia, presets. La tua identità propaga al sito pubblico (completa) e al Blueprint editor (solo accent + tipografia, per non compromettere l'usabilità operativa).")}
          </p>
          {/* Scope traceability — Brand Studio controls IDENTITY only.
              Navigation / footer / sections live in Experience Studio. */}
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--bp-surface-2)] border border-[var(--bp-border)] rounded-[var(--bp-radius-sm)]"
               data-testid="brand-scope-trace">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--bp-primary)]" aria-hidden />
            <span className="text-[9px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] font-body font-medium">
              {t('brand.controlsLabel', null, 'Controlla lo storefront pubblico:')}
            </span>
            <span className="text-[11px] font-heading italic text-[var(--bp-text-primary)]">
              {t('brand.controls', null, 'Identità · Palette · Tipografia · Logo · Showroom')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <button onClick={discard} data-testid="brand-discard"
                    className="px-4 py-2.5 rounded-[var(--bp-radius-sm)] border border-[var(--bp-border)] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] text-[10px] font-body uppercase tracking-[0.22em] flex items-center gap-1.5 transition-colors">
              <RotateCcw size={11} strokeWidth={1.5} /> {t('brand.discard', null, 'Annulla')}
            </button>
          )}
          <button onClick={save} disabled={!dirty || saving}
                  data-testid="brand-save"
                  className={`px-5 py-2.5 rounded-[var(--bp-radius-sm)] text-[10px] font-body uppercase tracking-[0.22em] flex items-center gap-2 transition-all
                    ${dirty && !saving
                      ? 'bg-[var(--bp-primary)] text-black hover:brightness-110'
                      : 'bg-[var(--bp-surface-2)] text-[var(--bp-text-muted)] cursor-not-allowed'}`}>
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} strokeWidth={1.5} />}
            {t('brand.save', null, 'Salva modifiche')}
          </button>
        </div>
      </div>

      {/* Split layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_540px] gap-10">
        {/* Controls */}
        <div>
          <Section kicker={t('brand.section.identityKicker', null, 'A · Identità')} title={t('brand.section.identity', null, 'Identità del brand')} testid="section-identity">
            <IdentityI18nGroup branding={branding} setBranding={setBranding} t={t} />
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('brand.field.support_email', null, 'Email di supporto')}>
                <TextInput value={branding.support_email} onChange={(v) => setBranding({ ...branding, support_email: v })}
                           placeholder="hello@studio.com" testid="brand-support-email" />
              </Field>
              <Field label={t('brand.field.phone', null, 'Telefono')}>
                <TextInput value={branding.phone} onChange={(v) => setBranding({ ...branding, phone: v })}
                           placeholder="+39 02 0000 0000" testid="brand-phone" />
              </Field>
            </div>
            <Field label={t('brand.field.website', null, 'Sito web')}>
              <TextInput value={branding.website_url} onChange={(v) => setBranding({ ...branding, website_url: v })}
                         placeholder="https://studio.com" testid="brand-website" />
            </Field>
            <Field label={t('brand.field.primary_logo', null, 'Logo principale')}>
              <EditorialMediaField
                value={branding.primary_logo_url}
                onChange={(v) => setBranding({ ...branding, primary_logo_url: v })}
                preset="logo"
                bucket="tenant-assets"
                folder="brand/logo"
                entityType="branding_asset"
                entityId={user?.tenant_id}
                role="primary_logo"
                helperText={t('brand.field.primary_logo_helper', null, 'Mostrato in header pubblico, email transazionali, footer. Sfondo trasparente raccomandato (PNG/SVG).')}
                testId="brand-logo-field"
              />
            </Field>
          </Section>

          <Section kicker={t('brand.section.paletteKicker', null, 'B · Palette')} title={t('brand.section.paletteTitle', null, 'Colori')} testid="section-palette"
                   trace={t('brand.paletteTrace', null, 'Storefront pubblico (palette completa) · Blueprint editor (solo accent + font come identità sottile)')}>
            <div className="mb-4 flex items-center gap-2" data-testid="brand-mode-toggle">
              <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] font-body mr-2">Modalità base</span>
              {['dark', 'light'].map((m) => (
                <button key={m}
                        type="button"
                        data-testid={`brand-mode-${m}`}
                        onClick={() => setTheme({ ...theme, mode: m })}
                        className={`px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] border rounded-[var(--bp-radius-xs)] transition-colors
                          ${(theme.mode || 'dark') === m
                            ? 'bg-[var(--bp-primary-soft)] text-[var(--bp-primary)] border-[var(--bp-border-active)]'
                            : 'bg-transparent text-[var(--bp-text-muted)] border-[var(--bp-border)] hover:text-[var(--bp-text-primary)]'}`}>
                  {m === 'dark' ? 'Dark base' : 'Light base'}
                </button>
              ))}
              <span className="ml-2 text-[10px] italic text-[var(--bp-text-faint)]">
                Il preset sceglie la modalità automaticamente · puoi sovrascriverla
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-1">
              {[
                ['primary',        'Primary'],
                ['secondary',      'Secondary'],
                ['accent',         'Accent'],
                ['background',     'Background'],
                ['surface',        'Surface'],
                ['text_primary',   'Text primary'],
                ['text_secondary', 'Text secondary'],
                ['border',         'Border'],
                ['success',        'Success'],
                ['warning',        'Warning'],
                ['danger',         'Danger'],
              ].map(([k, label]) => (
                <ColorPicker key={k} label={label} value={palette[k] || ''} onChange={(v) => setPalette(k, v)} testid={`palette-${k}`} />
              ))}
            </div>
          </Section>

          <Section kicker={t('brand.section.typographyKicker', null, 'C · Tipografia')} title={t('brand.section.typographyTitle', null, 'Caratteri')} testid="section-typography">
            <Field label={t('brand.field.display', null, 'Display (Titoli)')}>
              <SelectChips options={DISPLAY_FONTS} value={theme.typography?.display} onChange={(v) => setTypo('display', v)} testid="font-display" renderAs="font" />
            </Field>
            <Field label={t('brand.field.body', null, 'Body (Interfaccia)')}>
              <SelectChips options={BODY_FONTS} value={theme.typography?.body} onChange={(v) => setTypo('body', v)} testid="font-body" renderAs="font" />
            </Field>
          </Section>

          <Section kicker="D · Surface" title={t('brand.section.surfaceTitle', null, 'Raggio · Densità · Ombre')} testid="section-surface">
            <Field label={t('brand.field.radius', null, 'Border radius')}>
              <SelectChips options={RADIUS_OPTS} value={theme.radius} onChange={(v) => setTheme({ ...theme, radius: v })} testid="radius" />
            </Field>
            <Field label={t('brand.field.density', null, 'Densità')}>
              <SelectChips options={DENSITY_OPTS} value={theme.density} onChange={(v) => setTheme({ ...theme, density: v })} testid="density" />
            </Field>
            <Field label={t('brand.field.shadow', null, 'Morbidezza ombre')}>
              <SelectChips options={SHADOW_OPTS} value={theme.shadow} onChange={(v) => setTheme({ ...theme, shadow: v })} testid="shadow" />
            </Field>
          </Section>

          <Section kicker="E · Preset editoriali"
                   title={t('brand.section.presetsTitle', null, 'Preset editoriali')}
                   testid="section-presets"
                   trace={t('brand.presetsTrace', null, `${presets.length} identità complete · raggruppate per atmosfera · sovrascrivono palette + tipografia + radius`)}>
            {(() => {
              const sorted = sortPresetsByHue(presets);
              const lights = sorted.filter((p) => (p?.theme?.mode || '').toLowerCase() !== 'dark');
              const darks  = sorted.filter((p) => (p?.theme?.mode || '').toLowerCase() === 'dark');
              return (
                <>
                  {lights.length > 0 && (
                    <>
                      <div className="mb-3 text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] font-body flex items-center gap-2">
                        <Sun size={10} strokeWidth={1.8} /> Atmosfere chiare · {lights.length}
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-7" data-testid="brand-editorial-presets-light-grid">
                        {lights.map((p) => (
                          <PresetCard key={p.key} preset={p}
                                      current={theme.preset_key === p.key}
                                      onPick={applyPreset}
                                      testid={`preset-${p.key}`} />
                        ))}
                      </div>
                    </>
                  )}
                  {darks.length > 0 && (
                    <>
                      <div className="mb-3 text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] font-body flex items-center gap-2">
                        <Moon size={10} strokeWidth={1.8} /> Atmosfere scure · {darks.length}
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3" data-testid="brand-editorial-presets-dark-grid">
                        {darks.map((p) => (
                          <PresetCard key={p.key} preset={p}
                                      current={theme.preset_key === p.key}
                                      onPick={applyPreset}
                                      testid={`preset-${p.key}`} />
                        ))}
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </Section>
        </div>

        {/* Live preview */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] font-body mb-3 flex items-center gap-2">
            <Sparkles size={11} strokeWidth={1.5} /> {t('brand.livePreview', null, 'Anteprima live')}
          </p>
          <LivePreview branding={branding} theme={theme} />
        </div>
      </div>
    </div>
  );
};

export default BrandStudioPage;
