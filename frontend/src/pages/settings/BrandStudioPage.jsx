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
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Palette, Type, Save, RotateCcw, Loader2, CheckCircle2,
  Image as ImageIcon, Layers, Sparkles, Square, Circle,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { useTenantTheme } from '../../contexts/TenantThemeContext';
import { useAuth } from '../../contexts/AuthContext';

const DISPLAY_FONTS = ['Playfair Display', 'Cormorant Garamond', 'DM Serif Display', 'Bodoni Moda', 'Fraunces', 'Inter Tight'];
const BODY_FONTS    = ['Inter', 'Montserrat', 'Manrope', 'Plus Jakarta Sans', 'Space Grotesk', 'Inter Tight'];
const RADIUS_OPTS   = ['0px', '2px', '4px', '8px', '12px'];
const DENSITY_OPTS  = ['compact', 'comfortable', 'spacious'];
const SHADOW_OPTS   = ['none', 'soft', 'medium', 'strong'];

const DEFAULT_PALETTE = {
  primary: '#00C9B3', secondary: '#33DCC6', accent: '#7EE6DA',
  background: '#0F0F10', surface: '#16171A',
  text_primary: '#F4F5F7', text_secondary: '#C8CACE',
  border: 'rgba(244,245,247,0.10)',
  success: '#22C55E', warning: '#F59E0B', danger: '#EF4444',
};

const Section = ({ kicker, title, children, testid }) => (
  <section className="mb-9" data-testid={testid}>
    <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] font-body mb-1">{kicker}</p>
    <h2 className="font-heading text-xl text-[var(--bp-text-primary)] mb-4">{title}</h2>
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

const ColorPicker = ({ value, onChange, label, testid }) => (
  <div className="flex items-center gap-2.5 mb-2">
    <input type="color"
           value={(value || '#000000').startsWith('#') ? value : '#000000'}
           onChange={(e) => onChange(e.target.value)}
           data-testid={`${testid}-picker`}
           className="w-9 h-9 rounded-[var(--bp-radius-xs)] border border-[var(--bp-border)] bg-transparent cursor-pointer" />
    <div className="flex-1">
      <p className="text-[9px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] font-body mb-1">{label}</p>
      <input value={value || ''} onChange={(e) => onChange(e.target.value)}
             data-testid={testid}
             className="w-full px-2 py-1 bg-[var(--bp-surface-2)] border border-[var(--bp-border)] rounded-[var(--bp-radius-xs)] text-[var(--bp-text-primary)] text-[11px] font-mono outline-none focus:border-[var(--bp-primary)] transition-colors" />
    </div>
  </div>
);

const SelectChips = ({ options, value, onChange, testid }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map((o) => {
      const active = value === o;
      return (
        <button type="button" key={o} onClick={() => onChange(o)} data-testid={`${testid}-${o}`}
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

// ── Live Preview surface ───────────────────────────────────────────
const LivePreview = ({ branding, theme }) => {
  const palette = theme?.palette || DEFAULT_PALETTE;
  const typo = theme?.typography || {};
  const radius = theme?.radius || '2px';
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
          {branding?.public_brand_name || 'Your Studio'}
        </div>
        <button className="px-3 py-1.5 text-[10px] uppercase tracking-[0.18em]"
                style={{ background: palette.primary, color: palette.background, borderRadius: radius }}>
          Sign in
        </button>
      </div>
      {/* Hero */}
      <div className="p-8" style={{ background: palette.surface }}>
        <p className="text-[10px] uppercase tracking-[0.22em] mb-2" style={{ color: palette.primary }}>
          {branding?.tagline || 'Premium interior design'}
        </p>
        <h1 className="font-heading leading-tight mb-2 text-3xl"
            style={{ fontFamily: typo.display ? `${typo.display}, serif` : 'inherit' }}>
          Spaces that tell stories.
        </h1>
        <p className="text-[12px] mb-4 max-w-md" style={{ color: palette.text_secondary }}>
          {branding?.short_description || 'A live preview of how your tenant looks. Edit on the left — changes appear here in real time.'}
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
      const r = await api.post('/api/branding/apply-preset', { preset_key: preset.key });
      const next = r.data?.theme || preset.theme || {};
      setTheme({ ...next, palette: { ...DEFAULT_PALETTE, ...(next.palette || {}) } });
      await refresh();
      toast.success(`Preset "${preset.label}" applied`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not apply preset');
    }
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
    <div className="p-8 max-w-[1500px] mx-auto" data-testid="brand-page">
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
            Identity & Theme
          </h1>
          <p className="text-[var(--bp-text-muted)] text-[13px] font-body mt-2 max-w-xl">
            Define how your tenant looks across the storefront and workspace. Changes preview live.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <button onClick={discard} data-testid="brand-discard"
                    className="px-4 py-2.5 rounded-[var(--bp-radius-sm)] border border-[var(--bp-border)] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] text-[10px] font-body uppercase tracking-[0.22em] flex items-center gap-1.5 transition-colors">
              <RotateCcw size={11} strokeWidth={1.5} /> Discard
            </button>
          )}
          <button onClick={save} disabled={!dirty || saving}
                  data-testid="brand-save"
                  className={`px-5 py-2.5 rounded-[var(--bp-radius-sm)] text-[10px] font-body uppercase tracking-[0.22em] flex items-center gap-2 transition-all
                    ${dirty && !saving
                      ? 'bg-[var(--bp-primary)] text-black hover:brightness-110'
                      : 'bg-[var(--bp-surface-2)] text-[var(--bp-text-muted)] cursor-not-allowed'}`}>
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} strokeWidth={1.5} />}
            Save changes
          </button>
        </div>
      </div>

      {/* Split layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_540px] gap-10">
        {/* Controls */}
        <div>
          <Section kicker="A · Identity" title="Brand identity" testid="section-identity">
            <Field label="Public brand name">
              <TextInput value={branding.public_brand_name}
                         onChange={(v) => setBranding({ ...branding, public_brand_name: v })}
                         placeholder="MOOD for DESIGN"
                         testid="brand-public-name" />
            </Field>
            <Field label="Tagline">
              <TextInput value={branding.tagline} onChange={(v) => setBranding({ ...branding, tagline: v })}
                         placeholder="Spaces that tell stories"
                         testid="brand-tagline" />
            </Field>
            <Field label="Short description">
              <TextInput value={branding.short_description} onChange={(v) => setBranding({ ...branding, short_description: v })}
                         placeholder="A boutique studio crafting bespoke interiors."
                         testid="brand-short-desc" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Support email">
                <TextInput value={branding.support_email} onChange={(v) => setBranding({ ...branding, support_email: v })}
                           placeholder="hello@studio.com" testid="brand-support-email" />
              </Field>
              <Field label="Phone">
                <TextInput value={branding.phone} onChange={(v) => setBranding({ ...branding, phone: v })}
                           placeholder="+39 02 0000 0000" testid="brand-phone" />
              </Field>
            </div>
            <Field label="Website URL">
              <TextInput value={branding.website_url} onChange={(v) => setBranding({ ...branding, website_url: v })}
                         placeholder="https://studio.com" testid="brand-website" />
            </Field>
            <Field label="Primary logo URL">
              <TextInput value={branding.primary_logo_url} onChange={(v) => setBranding({ ...branding, primary_logo_url: v })}
                         placeholder="https://…/logo.svg" testid="brand-logo-url" />
            </Field>
          </Section>

          <Section kicker="B · Palette" title="Colours" testid="section-palette">
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

          <Section kicker="C · Typography" title="Fonts" testid="section-typography">
            <Field label="Display (headlines)">
              <SelectChips options={DISPLAY_FONTS} value={theme.typography?.display} onChange={(v) => setTypo('display', v)} testid="font-display" />
            </Field>
            <Field label="Body">
              <SelectChips options={BODY_FONTS} value={theme.typography?.body} onChange={(v) => setTypo('body', v)} testid="font-body" />
            </Field>
          </Section>

          <Section kicker="D · Surface" title="Radius · Density · Shadow" testid="section-surface">
            <Field label="Border radius">
              <SelectChips options={RADIUS_OPTS} value={theme.radius} onChange={(v) => setTheme({ ...theme, radius: v })} testid="radius" />
            </Field>
            <Field label="Density">
              <SelectChips options={DENSITY_OPTS} value={theme.density} onChange={(v) => setTheme({ ...theme, density: v })} testid="density" />
            </Field>
            <Field label="Shadow softness">
              <SelectChips options={SHADOW_OPTS} value={theme.shadow} onChange={(v) => setTheme({ ...theme, shadow: v })} testid="shadow" />
            </Field>
          </Section>

          <Section kicker="E · Presets" title="Curated themes" testid="section-presets">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {presets.map((p) => (
                <PresetCard key={p.key} preset={p}
                            current={theme.preset_key === p.key}
                            onPick={applyPreset}
                            testid={`preset-${p.key}`} />
              ))}
            </div>
          </Section>
        </div>

        {/* Live preview */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] font-body mb-3 flex items-center gap-2">
            <Sparkles size={11} strokeWidth={1.5} /> Live preview
          </p>
          <LivePreview branding={branding} theme={theme} />
        </div>
      </div>
    </div>
  );
};

export default BrandStudioPage;
