/**
 * PaletteSwitcher — Topbar trigger che apre l'Atelier dei temi con i preset
 * editoriali DB (15 chiari + 18 scuri).
 *
 * Strategia "applica subito + sync server":
 *   1. Click → applico DIRETTAMENTE le CSS vars sul :root (visible 0ms)
 *   2. In parallelo POST /api/branding/apply-preset (server sync)
 *   3. Popover bg si adatta al theme corrente (light/dark) via inline style
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Palette, Check, Sun, Moon, ExternalLink, X, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { clearPalette } from '../../lib/curatedPalettes';
import { applyThemeEverywhere } from '../../lib/themeApply';
import api from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import './palette-switcher.css';

// ── Apply theme vars DIRECTLY everywhere via shared util ──
// Delega a applyThemeEverywhere() che gestisce :root + body + [data-surface]
// + calcolo on-primary contrast + warning/danger/success adattivi.
const applyThemeToRoot = theme => applyThemeEverywhere(theme);

// ── Mini-swatch · 3 stop (bg · surface · primary→accent gradient) ─────
const Swatch = ({
  preset,
  active,
  onPick
}) => {
  const p = preset.theme?.palette || {};
  const handleClick = e => {
    e.preventDefault();
    e.stopPropagation();
    onPick(preset);
  };
  return <button type="button" onClick={handleClick} onMouseDown={e => e.stopPropagation()} title={`${preset.label} — ${preset.description || ''}`} aria-label={`Tema ${preset.label}`} aria-pressed={active} data-testid={`palette-swatch-${preset.key}`} className={`palsw-swatch ${active ? 'palsw-swatch--active' : ''}`}>
      <span className="palsw-swatch__chip" aria-hidden>
        <span style={{
        background: p.background
      }} />
        <span style={{
        background: p.surface
      }} />
        <span style={{
        background: `linear-gradient(135deg, ${p.primary || '#888'} 0%, ${p.accent || p.primary || '#888'} 100%)`
      }} />
      </span>
      <span className="palsw-swatch__name">{preset.label}</span>
      {active && <Check size={10} className="palsw-swatch__check" strokeWidth={2.6} />}
    </button>;
};
const PaletteSwitcher = () => {
  const {
    refresh,
    t
  } = useBlueprint();
  const [open, setOpen] = useState(false);
  const [presets, setPresets] = useState([]);
  const [currentKey, setCurrentKey] = useState(null);
  const [coords, setCoords] = useState({
    top: 64,
    right: 24
  });
  const ref = useRef();
  const triggerRef = useRef();

  // Carica i preset una sola volta + theme corrente per evidenziare attivo
  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get('/api/branding/presets').catch(() => ({
      data: {
        presets: []
      }
    })), api.get('/api/branding/theme').catch(() => ({
      data: {
        theme: {}
      }
    }))]).then(([pr, th]) => {
      if (cancelled) return;
      setPresets(pr.data?.presets || []);
      setCurrentKey(th.data?.theme?.preset_key || null);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setCoords({
      top: r.bottom + 8,
      right: Math.max(8, window.innerWidth - r.right)
    });
  }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const handler = e => {
      if (ref.current && !ref.current.contains(e.target) && triggerRef.current && !triggerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const esc = e => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  const pick = async preset => {
    if (!preset?.key) return;
    // 1. UI optimistic: pulisci override curated, applica subito le var CSS
    clearPalette();
    applyThemeToRoot(preset.theme);
    setCurrentKey(preset.key);
    setOpen(false);
    // 2. Server sync in parallelo
    try {
      const r = await api.post('/api/branding/apply-preset', {
        preset_key: preset.key
      });
      // Riapplico con il theme dal server (potrebbe avere merge defaults)
      if (r.data?.theme) applyThemeToRoot(r.data.theme);
      try {
        await refresh();
      } catch {/* tolerable */}
      toast.success(`Tema "${preset.label}" applicato`);
    } catch (e) {
      console.error('[PaletteSwitcher] apply-preset failed', e);
      toast.error(e?.response?.data?.detail || 'Non sono riuscito ad applicare il tema');
    }
  };

  // ── Adattivo: il popover prende sfondo/testo dal mode del theme corrente ──
  const activePreset = useMemo(() => presets.find(p => p.key === currentKey), [presets, currentKey]);
  const isDarkTheme = (activePreset?.theme?.mode || '').toLowerCase() === 'dark';
  const ap = activePreset?.theme?.palette || {};

  // Tokens calcolati per il popover (override locale, indipendente dal :root)
  const popoverTheme = isDarkTheme ? {
    bg: ap.background || '#0F0F10',
    surface: ap.surface || '#16171A',
    text: ap.text_primary || '#F0EFEC',
    textMuted: ap.text_secondary || '#A19D98',
    textFaint: 'rgba(255,255,255,0.40)',
    border: 'rgba(255,255,255,0.10)',
    borderStrong: 'rgba(255,255,255,0.18)',
    primary: ap.primary || '#C9A26B',
    onPrimary: '#FFFFFF'
  } : {
    bg: '#FFFFFF',
    surface: ap.surface || '#FAF4E8',
    text: ap.text_primary || '#1F1F22',
    textMuted: ap.text_secondary || '#5A5A60',
    textFaint: 'rgba(0,0,0,0.45)',
    border: 'rgba(0,0,0,0.10)',
    borderStrong: 'rgba(0,0,0,0.18)',
    primary: ap.primary || '#C9A36E',
    onPrimary: '#FFFFFF'
  };

  // Split presets in light / dark
  const lights = presets.filter(p => (p.theme?.mode || '').toLowerCase() !== 'dark');
  const darks = presets.filter(p => (p.theme?.mode || '').toLowerCase() === 'dark');
  return <div className="palsw-root" data-testid="palette-switcher-root">
      <button ref={triggerRef} type="button" onClick={() => setOpen(v => !v)} data-testid="palette-switcher-trigger" title={`Tema · ${activePreset?.label || 'Default'}`} aria-expanded={open} className="palsw-trigger">
        <Palette size={13} strokeWidth={1.7} />
        <span className="palsw-trigger__chip" aria-hidden>
          <span style={{
          background: ap.background || '#1a1a1a'
        }} />
          <span style={{
          background: ap.primary || '#C9A26B'
        }} />
        </span>
      </button>

      {open && createPortal(<div className="palsw-popover" role="dialog" aria-label={t("common.palette_switcher.preset_editoriali")} data-testid="palette-switcher-popover" ref={ref} data-mode={isDarkTheme ? 'dark' : 'light'} style={{
      top: coords.top,
      right: coords.right,
      // CSS variables locali — il popover usa SOLO queste
      '--pop-bg': popoverTheme.bg,
      '--pop-surface': popoverTheme.surface,
      '--pop-text': popoverTheme.text,
      '--pop-text-muted': popoverTheme.textMuted,
      '--pop-text-faint': popoverTheme.textFaint,
      '--pop-border': popoverTheme.border,
      '--pop-border-strong': popoverTheme.borderStrong,
      '--pop-primary': popoverTheme.primary,
      '--pop-on-primary': popoverTheme.onPrimary,
      background: popoverTheme.bg,
      color: popoverTheme.text,
      borderColor: popoverTheme.borderStrong
    }}>
          <header className="palsw-popover__head">
            <div>
              <p className="palsw-popover__eyebrow">{t('common.palette_switcher.atelier_dei_temi')}</p>
              <h3 className="palsw-popover__title">{t('common.palette_switcher.preset_editoriali')}</h3>
            </div>
            <button type="button" className="palsw-popover__close" onClick={() => setOpen(false)} aria-label={t("common.palette_switcher.chiudi")} data-testid="palette-switcher-close">
              <X size={14} />
            </button>
          </header>

          {presets.length === 0 ? <div className="palsw-loading">
              <Loader2 size={14} className="animate-spin" />
              <span>Carico i temi…</span>
            </div> : <>
              {lights.length > 0 && <section className="palsw-section" data-testid="palette-section-light">
                  <p className="palsw-section__label">
                    <Sun size={10} strokeWidth={1.8} /> Chiari · {lights.length}
                  </p>
                  <div className="palsw-grid">
                    {lights.map(p => <Swatch key={p.key} preset={p} active={currentKey === p.key} onPick={pick} />)}
                  </div>
                </section>}

              {darks.length > 0 && <section className="palsw-section" data-testid="palette-section-dark">
                  <p className="palsw-section__label">
                    <Moon size={10} strokeWidth={1.8} /> Scuri · {darks.length}
                  </p>
                  <div className="palsw-grid">
                    {darks.map(p => <Swatch key={p.key} preset={p} active={currentKey === p.key} onPick={pick} />)}
                  </div>
                </section>}
            </>}

          <footer className="palsw-popover__foot">
            <Link to="/settings/brand#section-presets" onClick={() => setOpen(false)} data-testid="palette-switcher-brand-studio" className="palsw-foot__link">
              {t("common.palette_switcher.apri_studio_identity_personalizza")} <ExternalLink size={11} strokeWidth={1.7} />
            </Link>
            <p className="palsw-foot__hint">
              {t("common.palette_switcher.imposta_colori_tipografia_e_radius_del_tuo_studio")}
            </p>
          </footer>
        </div>, document.body)}
    </div>;
};
export default PaletteSwitcher;