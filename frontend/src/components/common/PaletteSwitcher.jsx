/**
 * PaletteSwitcher — Topbar trigger che apre l'Atelier dei temi con i 28
 * preset editoriali DB (16 chiari + 12 scuri).
 *
 *   ┌──────────────────────────────────────┐
 *   │  ATELIER DEI TEMI               [×]  │
 *   │                                      │
 *   │  ☀ Chiari (16)                       │
 *   │   ⬜ Florence  ⬜ Warm   ⬜ Tokyo …  │
 *   │                                      │
 *   │  ☾ Scuri (12)                        │
 *   │   ⬛ Graphite  ⬛ Obsidian ⬛ ...     │
 *   │                                      │
 *   │  Apri Brand Studio · personalizza    │
 *   └──────────────────────────────────────┘
 *
 * Click → applica il preset completo (palette + tipografia + radius) via
 * POST /api/branding/apply-preset. Visibilmente cambia tutto subito.
 */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Palette, Check, Sun, Moon, ExternalLink, X, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { clearPalette } from '../../lib/curatedPalettes';
import api from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import './palette-switcher.css';

// ── Mini-swatch · 3 stop (bg · surface · primary→accent gradient) ─────
const Swatch = ({ preset, active, onPick }) => {
  const p = preset.theme?.palette || {};
  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onPick(preset);
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseDown={(e) => e.stopPropagation()}
      title={`${preset.label} — ${preset.description || ''}`}
      aria-label={`Tema ${preset.label}`}
      aria-pressed={active}
      data-testid={`palette-swatch-${preset.key}`}
      className={`palsw-swatch ${active ? 'palsw-swatch--active' : ''}`}
    >
      <span className="palsw-swatch__chip" aria-hidden>
        <span style={{ background: p.background }} />
        <span style={{ background: p.surface }} />
        <span style={{
          background: `linear-gradient(135deg, ${p.primary || '#888'} 0%, ${p.accent || p.primary || '#888'} 100%)`,
        }} />
      </span>
      <span className="palsw-swatch__name">{preset.label}</span>
      {active && <Check size={10} className="palsw-swatch__check" strokeWidth={2.6} />}
    </button>
  );
};

const PaletteSwitcher = () => {
  const { refresh } = useBlueprint();
  const [open, setOpen] = useState(false);
  const [presets, setPresets] = useState([]);
  const [currentKey, setCurrentKey] = useState(null);
  const [coords, setCoords] = useState({ top: 64, right: 24 });
  const ref = useRef();
  const triggerRef = useRef();

  // Carica i preset una sola volta + theme corrente per evidenziare attivo
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get('/api/branding/presets').catch(() => ({ data: { presets: [] } })),
      api.get('/api/branding/theme').catch(() => ({ data: { theme: {} } })),
    ]).then(([pr, th]) => {
      if (cancelled) return;
      setPresets(pr.data?.presets || []);
      setCurrentKey(th.data?.theme?.preset_key || null);
    });
    return () => { cancelled = true; };
  }, []);

  // Position popover under trigger
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setCoords({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target) &&
          triggerRef.current && !triggerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const pick = async (preset) => {
    if (!preset?.key) return;
    // Optimistic feedback istantaneo + chiusura popover subito
    setCurrentKey(preset.key);
    setOpen(false);
    try {
      // Pulisce gli override !important del curated PaletteSwitcher
      // (necessario per applicare un preset chiaro su top di un theme scuro)
      clearPalette();
      await api.post('/api/branding/apply-preset', { preset_key: preset.key });
      try { await refresh(); } catch { /* tolerable */ }
      toast.success(`Tema "${preset.label}" applicato`);
    } catch (e) {
      console.error('[PaletteSwitcher] apply-preset failed', e);
      toast.error(e?.response?.data?.detail || 'Non sono riuscito ad applicare il tema');
    }
  };

  // Split presets in light / dark
  const lights = presets.filter((p) => (p.theme?.mode || '').toLowerCase() !== 'dark');
  const darks  = presets.filter((p) => (p.theme?.mode || '').toLowerCase() === 'dark');
  const active = presets.find((p) => p.key === currentKey);
  const activePalette = active?.theme?.palette || {};

  return (
    <div className="palsw-root" data-testid="palette-switcher-root">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="palette-switcher-trigger"
        title={`Tema · ${active?.label || 'Default'}`}
        aria-expanded={open}
        className="palsw-trigger"
      >
        <Palette size={13} strokeWidth={1.7} />
        <span className="palsw-trigger__chip" aria-hidden>
          <span style={{ background: activePalette.background || '#1a1a1a' }} />
          <span style={{ background: activePalette.primary || '#00C9B3' }} />
        </span>
      </button>

      {open && createPortal(
        <div className="palsw-popover" role="dialog" aria-label="Preset editoriali"
             data-testid="palette-switcher-popover"
             ref={ref}
             style={{ top: coords.top, right: coords.right }}>
          <header className="palsw-popover__head">
            <div>
              <p className="palsw-popover__eyebrow">Atelier dei temi</p>
              <h3 className="palsw-popover__title">Preset editoriali</h3>
            </div>
            <button type="button" className="palsw-popover__close"
                    onClick={() => setOpen(false)} aria-label="Chiudi"
                    data-testid="palette-switcher-close">
              <X size={14} />
            </button>
          </header>

          {presets.length === 0 ? (
            <div className="palsw-loading">
              <Loader2 size={14} className="animate-spin" />
              <span>Carico i temi…</span>
            </div>
          ) : (
            <>
              {lights.length > 0 && (
                <section className="palsw-section" data-testid="palette-section-light">
                  <p className="palsw-section__label">
                    <Sun size={10} strokeWidth={1.8} /> Chiari · {lights.length}
                  </p>
                  <div className="palsw-grid">
                    {lights.map((p) => (
                      <Swatch key={p.key} preset={p}
                              active={currentKey === p.key}
                              onPick={pick} />
                    ))}
                  </div>
                </section>
              )}

              {darks.length > 0 && (
                <section className="palsw-section" data-testid="palette-section-dark">
                  <p className="palsw-section__label">
                    <Moon size={10} strokeWidth={1.8} /> Scuri · {darks.length}
                  </p>
                  <div className="palsw-grid">
                    {darks.map((p) => (
                      <Swatch key={p.key} preset={p}
                              active={currentKey === p.key}
                              onPick={pick} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          <footer className="palsw-popover__foot">
            <Link to="/settings/brand#section-presets" onClick={() => setOpen(false)}
                  data-testid="palette-switcher-brand-studio"
                  className="palsw-foot__link">
              Apri Brand Studio · personalizza <ExternalLink size={11} strokeWidth={1.7} />
            </Link>
            <p className="palsw-foot__hint">
              Imposta colori, tipografia e radius del tuo studio.
            </p>
          </footer>
        </div>,
        document.body
      )}
    </div>
  );
};

export default PaletteSwitcher;
