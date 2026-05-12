/**
 * BrandStudioPage — premium tenant theme editor (Linear/Stripe/Vercel inspired).
 *
 * Tabs: Palette · Typography · Shape & Spacing · Elevation & Motion · Assets
 * Live preview pane on the right with desktop/tablet/mobile toggle.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import api, { formatError } from '../../lib/api';
import { uploadBrandAsset } from '../../lib/assetUpload';
import { useBlueprint, applyTheme } from '../../contexts/BlueprintContext';
import { Palette, Type, Square, Sparkles, Image as ImageIcon, Monitor, Tablet, Smartphone, RotateCcw, Check } from 'lucide-react';

const PRESETS = [
  { id: 'mood',    name: 'MOOD Teal',     primary: '#26F5C9', accent: '#B8977A', bg: '#0A0A0B' },
  { id: 'gold',    name: 'Editorial Gold', primary: '#D4AF37', accent: '#B8977A', bg: '#0A0A0B' },
  { id: 'noir',    name: 'Pure Noir',     primary: '#FFFFFF', accent: '#A19D98', bg: '#000000' },
  { id: 'rose',    name: 'Rose Quartz',   primary: '#E8B4B8', accent: '#9B7B7E', bg: '#0E0A0B' },
  { id: 'forest',  name: 'Deep Forest',   primary: '#7AA489', accent: '#B89C7A', bg: '#0A0E0B' },
  { id: 'ocean',   name: 'Midnight Sea',  primary: '#5B8FB8', accent: '#B8977A', bg: '#070B11' },
];

const TabBtn = ({ active, onClick, icon: Icon, label, testid }) => (
  <button data-testid={testid} onClick={onClick}
    className={`flex items-center gap-2 px-3 py-2 text-xs font-body rounded-[var(--bp-radius-sm)] transition-colors ${
      active ? 'bg-white/[0.05] text-[var(--bp-text-primary)]' : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-secondary)]'
    }`}>
    <Icon size={13} strokeWidth={1.5} /> {label}
  </button>
);

const Label = ({ children }) => (
  <label className="block text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--bp-text-muted)] font-body mb-1.5">
    {children}
  </label>
);

const ColorField = ({ label, value, onChange, testid }) => (
  <div>
    <Label>{label}</Label>
    <div className="flex items-center gap-2">
      <input type="color" value={value || '#000000'} onChange={(e) => onChange(e.target.value)}
        className="w-9 h-9 rounded-[var(--bp-radius-sm)] cursor-pointer border border-[var(--bp-border)] bg-transparent" />
      <input data-testid={testid} type="text" value={value || ''} onChange={(e) => onChange(e.target.value)}
        className="input-luxury flex-1 px-3 py-2 text-xs font-mono rounded-[var(--bp-radius-sm)]" />
    </div>
  </div>
);

const Select = ({ label, value, onChange, options, testid }) => (
  <div>
    <Label>{label}</Label>
    <select data-testid={testid} value={value || ''} onChange={(e) => onChange(e.target.value)}
      className="input-luxury w-full px-3 py-2 text-sm font-body rounded-[var(--bp-radius-sm)]">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const Slider = ({ label, value, onChange, min, max, step = 1, suffix = '', testid }) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--bp-text-muted)] font-body">{label}</span>
      <span className="text-[11px] text-[var(--bp-text-secondary)] font-mono">{value}{suffix}</span>
    </div>
    <input data-testid={testid} type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full accent-[var(--bp-primary)]" />
  </div>
);

const AssetUploader = ({ kind, label, currentUrl, onUploaded }) => {
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true); setError('');
    try {
      const r = await uploadBrandAsset({ kind, file });
      onUploaded(r.url);
    } catch (err) { setError(err.message || formatError(err)); }
    finally { setUploading(false); }
  };

  return (
    <div className="bg-[var(--bp-surface-2)] border border-[var(--bp-border)] rounded-[var(--bp-radius-md)] p-4">
      <Label>{label}</Label>
      <input ref={fileRef} type="file" accept="image/*,.svg,.ico" onChange={handleFile} className="hidden" data-testid={`asset-input-${kind}`} />
      {currentUrl ? (
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-[var(--bp-radius-sm)] bg-[var(--bp-surface-3)] flex items-center justify-center overflow-hidden border border-[var(--bp-border)]">
            <img src={currentUrl} alt={kind} className="max-w-full max-h-full object-contain" />
          </div>
          <button onClick={() => fileRef.current?.click()} disabled={uploading} data-testid={`asset-replace-${kind}`}
            className="text-xs text-[var(--bp-primary)] hover:opacity-80 font-body">
            {uploading ? 'Uploading…' : 'Replace'}
          </button>
        </div>
      ) : (
        <button onClick={() => fileRef.current?.click()} disabled={uploading} data-testid={`asset-upload-${kind}`}
          className="w-full px-4 py-3 border border-dashed border-[var(--bp-border-strong)] text-xs text-[var(--bp-text-secondary)] font-body rounded-[var(--bp-radius-sm)] hover:border-[var(--bp-primary)]/40 hover:text-[var(--bp-text-primary)] transition-colors">
          {uploading ? 'Uploading…' : `+ Upload ${label}`}
        </button>
      )}
      {error && <p className="text-red-400 text-[10px] font-body mt-1.5">{error}</p>}
    </div>
  );
};

// ── Live preview surface ─────────────────────────────────────────────────────
const PreviewFrame = ({ theme, viewport }) => {
  const widths = { desktop: '100%', tablet: '768px', mobile: '375px' };
  const p = theme.palette || {};
  const t = theme.typography || {};

  const inner = (
    <div style={{
      background: p.background, color: p.text_primary, fontFamily: t.font_body,
      minHeight: '100%', padding: '32px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <div style={{ width: 28, height: 28, background: p.primary, borderRadius: theme.shape?.radius_sm }} />
        <span style={{ fontFamily: t.font_heading, fontSize: 16, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Studio Brand
        </span>
      </div>
      <h1 style={{
        fontFamily: t.font_heading, fontWeight: 300, fontSize: viewport === 'mobile' ? 32 : 48,
        color: p.text_primary, letterSpacing: t.letter_spacing_heading || '-0.01em', marginBottom: 12,
      }}>
        Timeless elegance.
      </h1>
      <p style={{ color: p.text_secondary, fontSize: 14, marginBottom: 28, maxWidth: 480 }}>
        A preview of your tenant brand. Typography, colors, and motion all update live as you edit.
      </p>
      <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
        <button style={{
          background: p.primary, color: p.background, padding: '10px 20px',
          borderRadius: theme.components?.button_style === 'pill' ? '9999px' : theme.shape?.radius_sm,
          fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', border: 'none',
        }}>Get started</button>
        <button style={{
          background: 'transparent', color: p.text_primary, padding: '10px 20px',
          borderRadius: theme.components?.button_style === 'pill' ? '9999px' : theme.shape?.radius_sm,
          fontSize: 12, fontWeight: 500, letterSpacing: '0.05em', border: `1px solid ${p.border_strong}`,
        }}>Learn more</button>
      </div>
      <div style={{
        background: p.surface_1, border: `1px solid ${p.border}`,
        borderRadius: theme.shape?.radius_md, padding: 20, boxShadow: theme.elevation?.md,
      }}>
        <p style={{ color: p.text_muted, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>
          Active leads
        </p>
        <p style={{ fontFamily: t.font_heading, fontWeight: 300, fontSize: 32, color: p.text_primary }}>247</p>
      </div>
    </div>
  );

  return (
    <div className="flex justify-center items-start h-full overflow-auto bg-black/30 p-6">
      <div style={{
        width: widths[viewport], maxWidth: '100%', height: '100%', minHeight: 500,
        background: p.background, borderRadius: theme.shape?.radius_lg, overflow: 'hidden',
        boxShadow: theme.elevation?.lg, border: `1px solid ${p.border}`,
        transition: 'width 240ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}>{inner}</div>
    </div>
  );
};


const BrandStudioPage = () => {
  const { t } = useBlueprint();
  const [theme, setTheme] = useState(null);
  const [defaultTheme, setDefaultTheme] = useState(null);
  const [fonts, setFonts] = useState([]);
  const [tab, setTab] = useState('palette');
  const [viewport, setViewport] = useState('desktop');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    const results = await Promise.allSettled([
      api.get('/api/settings/theme'),
      api.get('/api/settings/fonts/catalog'),
    ]);
    if (results[0].status === 'fulfilled') {
      setTheme(results[0].value.data.effective);
      setDefaultTheme(results[0].value.data.default);
    } else {
      // retry once
      try {
        const r = await api.get('/api/settings/theme');
        setTheme(r.data.effective);
        setDefaultTheme(r.data.default);
      } catch (e) { console.warn('theme load failed', e); }
    }
    if (results[1].status === 'fulfilled') {
      setFonts(results[1].value.data.fonts || []);
    } else {
      try { const r = await api.get('/api/settings/fonts/catalog'); setFonts(r.data.fonts || []); } catch (_) {}
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setPath = (path, value) => {
    setDirty(true);
    setTheme((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let obj = next; for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]] = obj[keys[i]] || {};
      obj[keys[keys.length - 1]] = value;
      // Apply locally for live preview
      applyTheme(next);
      return next;
    });
  };

  const save = async () => {
    if (!theme) return;
    setSaving(true);
    try {
      await api.put('/api/settings/theme', theme);
      setSavedAt(Date.now());
      setDirty(false);
    } catch (e) { alert(formatError(e)); }
    finally { setSaving(false); }
  };

  const reset = async () => {
    if (!window.confirm('Reset theme to default?')) return;
    await api.post('/api/settings/theme/reset');
    await load();
    applyTheme(defaultTheme);
    setDirty(false);
  };

  const applyPreset = (preset) => {
    setPath('palette.primary', preset.primary);
    setPath('palette.accent', preset.accent);
    setPath('palette.background', preset.bg);
  };

  if (!theme) return <div className="p-10 text-[var(--bp-text-muted)]">{t('common.loading')}…</div>;

  return (
    <div className="h-full flex bg-[var(--bp-bg)]" data-testid="brand-studio-page">
      {/* Left: Editor */}
      <div className="w-[440px] flex-shrink-0 border-r border-[var(--bp-border)] flex flex-col h-full overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-[var(--bp-border)]">
          <p className="text-[var(--bp-primary)] text-[10px] font-body uppercase tracking-[0.2em] font-semibold mb-1">
            {t('brandStudio.header', null, 'Tenant · Brand Studio')}
          </p>
          <h1 className="font-heading text-3xl font-light text-[var(--bp-text-primary)]">
            {t('brandStudio.title', null, 'Theme Engine')}
          </h1>
        </div>

        {/* Tabs */}
        <div className="px-3 py-2 border-b border-[var(--bp-border)] flex items-center gap-1 flex-wrap">
          <TabBtn testid="tab-palette" active={tab === 'palette'} onClick={() => setTab('palette')} icon={Palette} label={t('brandStudio.tab.palette', null, 'Palette')} />
          <TabBtn testid="tab-typography" active={tab === 'typography'} onClick={() => setTab('typography')} icon={Type} label={t('brandStudio.tab.typography', null, 'Typography')} />
          <TabBtn testid="tab-shape" active={tab === 'shape'} onClick={() => setTab('shape')} icon={Square} label={t('brandStudio.tab.shape', null, 'Shape')} />
          <TabBtn testid="tab-motion" active={tab === 'motion'} onClick={() => setTab('motion')} icon={Sparkles} label={t('brandStudio.tab.motion', null, 'Motion')} />
          <TabBtn testid="tab-assets" active={tab === 'assets'} onClick={() => setTab('assets')} icon={ImageIcon} label={t('brandStudio.tab.assets', null, 'Assets')} />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {tab === 'palette' && (
            <>
              <div>
                <Label>{t('brandStudio.presets', null, 'Presets')}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {PRESETS.map((p) => (
                    <button key={p.id} data-testid={`preset-${p.id}`} onClick={() => applyPreset(p)}
                      className="group flex items-center gap-2 p-2 border border-[var(--bp-border)] rounded-[var(--bp-radius-sm)] hover:border-[var(--bp-border-strong)] transition-colors text-left">
                      <div className="w-7 h-7 rounded-[2px] flex-shrink-0" style={{ background: p.primary }} />
                      <span className="text-[10px] font-body text-[var(--bp-text-secondary)] group-hover:text-[var(--bp-text-primary)]">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ColorField testid="color-primary" label="Primary" value={theme.palette.primary} onChange={(v) => setPath('palette.primary', v)} />
                <ColorField testid="color-accent" label="Accent" value={theme.palette.accent} onChange={(v) => setPath('palette.accent', v)} />
                <ColorField label="Background" value={theme.palette.background} onChange={(v) => setPath('palette.background', v)} />
                <ColorField label="Surface 1" value={theme.palette.surface_1} onChange={(v) => setPath('palette.surface_1', v)} />
                <ColorField label="Surface 2" value={theme.palette.surface_2} onChange={(v) => setPath('palette.surface_2', v)} />
                <ColorField label="Surface 3" value={theme.palette.surface_3} onChange={(v) => setPath('palette.surface_3', v)} />
                <ColorField label="Text Primary" value={theme.palette.text_primary} onChange={(v) => setPath('palette.text_primary', v)} />
                <ColorField label="Text Secondary" value={theme.palette.text_secondary} onChange={(v) => setPath('palette.text_secondary', v)} />
              </div>
            </>
          )}

          {tab === 'typography' && (
            <>
              <Select testid="font-heading" label="Heading font" value={theme.typography.font_heading}
                options={fonts.filter(f => f.category === 'serif' || f.category === 'sans-serif').map(f => ({
                  value: `'${f.family}', ${f.category}`,
                  label: `${f.family} · ${f.category}`,
                }))}
                onChange={(v) => setPath('typography.font_heading', v)} />
              <Select testid="font-body" label="Body font" value={theme.typography.font_body}
                options={fonts.filter(f => f.category === 'sans-serif' || f.category === 'serif').map(f => ({
                  value: `'${f.family}', ${f.category}`,
                  label: `${f.family} · ${f.category}`,
                }))}
                onChange={(v) => setPath('typography.font_body', v)} />
              <Slider testid="font-size" label="Base font size" value={theme.typography.font_size_base} onChange={(v) => setPath('typography.font_size_base', v)} min={12} max={18} step={1} suffix="px" />
              <Slider label="Line height" value={theme.typography.line_height_base} onChange={(v) => setPath('typography.line_height_base', v)} min={1.2} max={1.8} step={0.05} />
            </>
          )}

          {tab === 'shape' && (
            <>
              <Slider testid="radius-sm" label="Radius sm" value={parseInt(theme.shape.radius_sm)} onChange={(v) => setPath('shape.radius_sm', `${v}px`)} min={0} max={20} suffix="px" />
              <Slider label="Radius md" value={parseInt(theme.shape.radius_md)} onChange={(v) => setPath('shape.radius_md', `${v}px`)} min={0} max={28} suffix="px" />
              <Slider label="Radius lg" value={parseInt(theme.shape.radius_lg)} onChange={(v) => setPath('shape.radius_lg', `${v}px`)} min={0} max={40} suffix="px" />
              <Select testid="button-style" label="Button style" value={theme.components.button_style}
                options={[{ value: 'sharp', label: 'Sharp · editorial' }, { value: 'pill', label: 'Pill · soft' }, { value: 'ghost', label: 'Ghost · minimal' }]}
                onChange={(v) => setPath('components.button_style', v)} />
              <Select testid="density" label="UI density" value={theme.spacing.scale}
                options={[{ value: 'compact', label: 'Compact' }, { value: 'comfortable', label: 'Comfortable' }, { value: 'spacious', label: 'Spacious' }]}
                onChange={(v) => setPath('spacing.scale', v)} />
            </>
          )}

          {tab === 'motion' && (
            <>
              <Select testid="motion-preset" label="Motion preset" value={theme.motion.preset}
                options={[{ value: 'subtle', label: 'Subtle' }, { value: 'standard', label: 'Standard' }, { value: 'expressive', label: 'Expressive' }]}
                onChange={(v) => {
                  setPath('motion.preset', v);
                  const presets = {
                    subtle:     { duration_fast: '80ms',  duration_normal: '140ms', duration_slow: '220ms' },
                    standard:   { duration_fast: '120ms', duration_normal: '180ms', duration_slow: '280ms' },
                    expressive: { duration_fast: '180ms', duration_normal: '260ms', duration_slow: '420ms' },
                  };
                  Object.entries(presets[v] || {}).forEach(([k, val]) => setPath(`motion.${k}`, val));
                }} />
              <div>
                <Label>Shadow · sm</Label>
                <input value={theme.elevation.sm} onChange={(e) => setPath('elevation.sm', e.target.value)} className="input-luxury w-full px-3 py-2 text-xs font-mono rounded-[var(--bp-radius-sm)]" />
              </div>
              <div>
                <Label>Shadow · md</Label>
                <input value={theme.elevation.md} onChange={(e) => setPath('elevation.md', e.target.value)} className="input-luxury w-full px-3 py-2 text-xs font-mono rounded-[var(--bp-radius-sm)]" />
              </div>
              <div>
                <Label>Shadow · lg</Label>
                <input value={theme.elevation.lg} onChange={(e) => setPath('elevation.lg', e.target.value)} className="input-luxury w-full px-3 py-2 text-xs font-mono rounded-[var(--bp-radius-sm)]" />
              </div>
            </>
          )}

          {tab === 'assets' && (
            <div className="space-y-3">
              <AssetUploader kind="logo_dark"  label="Logo (dark bg)"  currentUrl={theme.assets?.logo_dark} onUploaded={(url) => { setPath('assets.logo_dark', url); }} />
              <AssetUploader kind="logo_light" label="Logo (light bg)" currentUrl={theme.assets?.logo_light} onUploaded={(url) => setPath('assets.logo_light', url)} />
              <AssetUploader kind="logo_mobile" label="Logo (mobile)"  currentUrl={theme.assets?.logo_mobile} onUploaded={(url) => setPath('assets.logo_mobile', url)} />
              <AssetUploader kind="favicon"    label="Favicon"         currentUrl={theme.assets?.favicon} onUploaded={(url) => setPath('assets.favicon', url)} />
              <AssetUploader kind="og_image"   label="OG image"        currentUrl={theme.assets?.og_image} onUploaded={(url) => setPath('assets.og_image', url)} />
            </div>
          )}
        </div>

        {/* Save bar */}
        <div className="border-t border-[var(--bp-border)] px-6 py-4 flex items-center justify-between gap-3 bg-[var(--bp-surface-1)]">
          <button onClick={reset} data-testid="reset-theme-btn"
            className="text-xs text-[var(--bp-text-muted)] hover:text-[var(--bp-text-secondary)] flex items-center gap-1.5 font-body">
            <RotateCcw size={12} /> Reset
          </button>
          <div className="flex items-center gap-3">
            {savedAt > 0 && Date.now() - savedAt < 3000 && !dirty && (
              <span className="text-xs text-emerald-400 flex items-center gap-1 font-body" data-testid="saved-indicator"><Check size={12} /> Saved</span>
            )}
            <button onClick={save} disabled={saving || !dirty} data-testid="save-theme-btn"
              className="px-5 py-2 bg-[var(--bp-primary)] hover:opacity-90 text-[var(--bp-bg)] font-semibold text-xs font-body rounded-[var(--bp-radius-sm)] disabled:opacity-40 disabled:cursor-not-allowed">
              {saving ? 'Saving…' : (dirty ? 'Save changes' : 'Saved')}
            </button>
          </div>
        </div>
      </div>

      {/* Right: Preview */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-12 border-b border-[var(--bp-border)] flex items-center justify-between px-6 flex-shrink-0">
          <span className="text-[10px] text-[var(--bp-text-muted)] font-body uppercase tracking-[0.2em] font-semibold">
            {t('brandStudio.preview', null, 'Live Preview')}
          </span>
          <div className="flex items-center gap-1 bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[var(--bp-radius-sm)] p-0.5">
            {[['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]].map(([v, Icon]) => (
              <button key={v} data-testid={`viewport-${v}`} onClick={() => setViewport(v)}
                className={`p-1.5 rounded-[2px] transition-colors ${viewport === v ? 'bg-[var(--bp-surface-3)] text-[var(--bp-text-primary)]' : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-secondary)]'}`}>
                <Icon size={13} strokeWidth={1.5} />
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <PreviewFrame theme={theme} viewport={viewport} />
        </div>
      </div>
    </div>
  );
};

export default BrandStudioPage;
