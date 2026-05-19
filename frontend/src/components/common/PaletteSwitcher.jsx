/**
 * PaletteSwitcher — Topbar trigger that opens a "tavolozza" of 24 curated
 * themes for the workspace. Replaces the legacy Dark/Light toggle.
 *
 *   ┌──────────────────────────────────────┐
 *   │  TEMI CURATI                    [×]  │
 *   │                                      │
 *   │  CHIARI (15)                         │
 *   │   ⬜ Ivory   ⬜ Linen   ⬜ Pearl ...   │
 *   │                                      │
 *   │  SCURI (9)                           │
 *   │   ⬛ Graphite  ⬛ Midnight ...        │
 *   │                                      │
 *   │  ─────────────────────────────────   │
 *   │  Apri Brand Studio → custom completa │
 *   └──────────────────────────────────────┘
 *
 * Each swatch shows three stops (bg · surface · accent) so the designer reads
 * the palette at a glance — like a Pantone chip, not a SaaS toggle.
 */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Palette, Check, Sparkles, ExternalLink, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  LIGHT_PALETTES, DARK_PALETTES, applyPalette, getStoredPalette, storePalette, PALETTE_BY_ID,
} from '../../lib/curatedPalettes';
import './palette-switcher.css';

const Swatch = ({ palette, active, onPick }) => (
  <button
    type="button"
    onClick={() => onPick(palette.id)}
    title={`${palette.name} — ${palette.description}`}
    aria-label={`Tema ${palette.name}`}
    aria-pressed={active}
    data-testid={`palette-swatch-${palette.id}`}
    className={`palsw-swatch ${active ? 'palsw-swatch--active' : ''}`}
  >
    <span className="palsw-swatch__chip" aria-hidden>
      <span style={{ background: palette.bg }} />
      <span style={{ background: palette.surfaceElev }} />
      <span style={{ background: palette.primary }} />
    </span>
    <span className="palsw-swatch__name">{palette.name}</span>
    {active && <Check size={11} className="palsw-swatch__check" strokeWidth={2.4} />}
  </button>
);

const PaletteSwitcher = () => {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(() => getStoredPalette());
  const [coords, setCoords] = useState({ top: 64, right: 24 });
  const ref = useRef();
  const triggerRef = useRef();

  // Apply on mount so a fresh tab/browser loads the saved palette.
  useEffect(() => { applyPalette(current); }, [current]);

  // Position the portal popover under the trigger button.
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setCoords({
      top:   r.bottom + 8,
      right: Math.max(8, window.innerWidth - r.right),
    });
  }, [open]);

  // Click outside to close.
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

  const pick = (id) => {
    setCurrent(id);
    storePalette(id);
    applyPalette(id);
  };

  const activeMeta = PALETTE_BY_ID[current];

  return (
    <div className="palsw-root" data-testid="palette-switcher-root">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="palette-switcher-trigger"
        title={`Tema · ${activeMeta?.name || 'Default'}`}
        aria-expanded={open}
        className="palsw-trigger"
      >
        <Palette size={13} strokeWidth={1.7} />
        <span className="palsw-trigger__chip" aria-hidden>
          <span style={{ background: activeMeta?.bg }} />
          <span style={{ background: activeMeta?.primary }} />
        </span>
      </button>

      {open && createPortal(
        <div className="palsw-popover" role="dialog" aria-label="Temi curati"
             data-testid="palette-switcher-popover"
             ref={ref}
             style={{ top: coords.top, right: coords.right }}>
          <header className="palsw-popover__head">
            <div>
              <p className="palsw-popover__eyebrow">Atelier dei temi</p>
              <h3 className="palsw-popover__title">Temi curati</h3>
            </div>
            <button type="button" className="palsw-popover__close"
                    onClick={() => setOpen(false)} aria-label="Chiudi"
                    data-testid="palette-switcher-close">
              <X size={14} />
            </button>
          </header>

          <section className="palsw-section" data-testid="palette-section-light">
            <p className="palsw-section__label">
              <Sparkles size={10} strokeWidth={1.8} /> Chiari & colorati · {LIGHT_PALETTES.length}
            </p>
            <div className="palsw-grid">
              {LIGHT_PALETTES.map((p) => (
                <Swatch key={p.id} palette={p} active={current === p.id} onPick={pick} />
              ))}
            </div>
          </section>

          <section className="palsw-section" data-testid="palette-section-dark">
            <p className="palsw-section__label">
              <span className="palsw-section__moon" aria-hidden /> Scuri · {DARK_PALETTES.length}
            </p>
            <div className="palsw-grid">
              {DARK_PALETTES.map((p) => (
                <Swatch key={p.id} palette={p} active={current === p.id} onPick={pick} />
              ))}
            </div>
          </section>

          <footer className="palsw-popover__foot">
            <Link to="/settings/brand-studio" onClick={() => setOpen(false)}
                  data-testid="palette-switcher-brand-studio"
                  className="palsw-foot__link">
              Apri Brand Studio · personalizzazione completa <ExternalLink size={11} strokeWidth={1.7} />
            </Link>
            <p className="palsw-foot__hint">
              Imposta colori, font, micro-copy e logotipo del tuo studio.
            </p>
          </footer>
        </div>,
        document.body
      )}
    </div>
  );
};

export default PaletteSwitcher;
