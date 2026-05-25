/**
 * DesignDirectionPanel — ITER152 Sprint D
 *
 * Editorial display of relationship intelligence.
 * Shared between client view ("Your Design Direction™") and designer
 * view ("Relationship Intelligence™") — variant controls voice.
 *
 * NO charts. NO KPIs. NO percentages.
 * Serif headlines · narrative paragraphs · material chips · palette
 * swatches · cultural references.
 */
import React, { useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { getMyDirection, getLeadDirection, forceLeadDistil } from '../../lib/designDirection';
import './design-direction-panel.css';

const get = (s, k1, k2) => s?.[k1] ?? s?.[k2] ?? {};

const DesignDirectionPanel = ({ variant = 'client', leadId = null, locale = 'it' }) => {
  const [snap, setSnap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = variant === 'client'
        ? await getMyDirection()
        : await getLeadDirection(leadId);
      setSnap(data?.snapshot || null);
    } catch {
      setSnap(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [variant, leadId]);

  const regenerate = async () => {
    if (!leadId) return;
    setRegenerating(true);
    try {
      const { data } = await forceLeadDistil(leadId);
      setSnap(data?.snapshot || null);
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <section className="ddp ddp--loading" data-testid="ddp-loading">
        <Loader2 size={14} className="ddp__spin" />
        <span>{locale === 'it' ? 'Lo studio sta leggendo…' : 'The studio is reading…'}</span>
      </section>
    );
  }

  if (!snap) {
    return (
      <section className="ddp ddp--empty" data-testid="ddp-empty">
        <p>{locale === 'it' ? 'Direzione non ancora disponibile.' : 'Direction not yet available.'}</p>
      </section>
    );
  }

  const atm = get(snap, 'atmosphere_summary', 'atmosphere');
  const mat = get(snap, 'material_summary',  'materials');
  const lif = get(snap, 'lifestyle_summary', 'lifestyle');
  const cul = get(snap, 'cultural_summary',  'cultural');
  const pal = get(snap, 'palette_summary',   'palette');
  const narrative = snap.narrative_summary || snap.narrative;

  return (
    <section className={`ddp ddp--${variant}`} data-testid="design-direction-panel">
      <header className="ddp__head">
        <div>
          <p className="ddp__eyebrow">
            {variant === 'client'
              ? (locale === 'it' ? 'La tua direzione' : 'Your direction')
              : (locale === 'it' ? 'Intelligenza relazionale' : 'Relationship intelligence')}
          </p>
          <h2 className="ddp__title">Design Direction™</h2>
        </div>
        {variant === 'designer' && leadId && (
          <button
            type="button"
            className="ddp__regen"
            onClick={regenerate}
            disabled={regenerating}
            data-testid="ddp-regen"
          >
            {regenerating
              ? <Loader2 size={12} className="ddp__spin" />
              : <Sparkles size={12} />}
            {locale === 'it' ? 'Rileggi' : 'Re-read'}
          </button>
        )}
      </header>

      {narrative && (
        <p className="ddp__narrative" data-testid="ddp-narrative">{narrative}</p>
      )}

      {/* SECTION · ATMOSPHERE */}
      <article className="ddp-block ddp-block--atmosphere" data-testid="ddp-atmosphere">
        <p className="ddp-block__eyebrow">{locale === 'it' ? 'Atmosfera che emerge' : 'Atmosphere emerging'}</p>
        <h3 className="ddp-block__headline">{atm.headline}</h3>
        {atm.narrative && <p className="ddp-block__body">{atm.narrative}</p>}
        {atm.chips?.length > 0 && (
          <ul className="ddp-chips">
            {atm.chips.map((c, i) => (
              <li key={i} className="ddp-chip">{c}</li>
            ))}
          </ul>
        )}
      </article>

      {/* SECTION · MATERIALS */}
      <article className="ddp-block" data-testid="ddp-materials">
        <p className="ddp-block__eyebrow">{locale === 'it' ? 'Direzione materica' : 'Material direction'}</p>
        <h3 className="ddp-block__headline">{mat.headline}</h3>
        {mat.narrative && <p className="ddp-block__body">{mat.narrative}</p>}
        {mat.materials?.length > 0 && (
          <ul className="ddp-materials">
            {mat.materials.map((m, i) => (
              <li key={i} className={`ddp-material ddp-material--${m.tone || 'neutral'}`}>
                <span className="ddp-material__swatch" aria-hidden />
                <span className="ddp-material__name">{m.name}</span>
              </li>
            ))}
          </ul>
        )}
      </article>

      {/* SECTION · LIFESTYLE */}
      {(lif.headline || lif.rhythms?.length) && (
        <article className="ddp-block" data-testid="ddp-lifestyle">
          <p className="ddp-block__eyebrow">{locale === 'it' ? 'Ritmo di vita' : 'Lifestyle rhythm'}</p>
          <h3 className="ddp-block__headline">{lif.headline}</h3>
          {lif.narrative && <p className="ddp-block__body">{lif.narrative}</p>}
          {lif.rhythms?.length > 0 && (
            <ul className="ddp-rhythms">
              {lif.rhythms.map((r, i) => (
                <li key={i} className="ddp-rhythm">— {r}</li>
              ))}
            </ul>
          )}
        </article>
      )}

      {/* SECTION · CULTURAL */}
      {(cul.headline || cul.references?.length) && (
        <article className="ddp-block" data-testid="ddp-cultural">
          <p className="ddp-block__eyebrow">{locale === 'it' ? 'Registro culturale' : 'Cultural register'}</p>
          <h3 className="ddp-block__headline">{cul.headline}</h3>
          {cul.narrative && <p className="ddp-block__body">{cul.narrative}</p>}
          {cul.references?.length > 0 && (
            <ul className="ddp-refs">
              {cul.references.map((r, i) => (
                <li key={i} className="ddp-ref">{r}</li>
              ))}
            </ul>
          )}
        </article>
      )}

      {/* SECTION · PALETTE */}
      {pal.swatches?.length > 0 && (
        <article className="ddp-block ddp-block--palette" data-testid="ddp-palette">
          <p className="ddp-block__eyebrow">{locale === 'it' ? 'Palette in formazione' : 'Palette emerging'}</p>
          {pal.headline && <h3 className="ddp-block__headline">{pal.headline}</h3>}
          <ul className="ddp-palette">
            {pal.swatches.map((s, i) => (
              <li key={i} className="ddp-swatch">
                <span className="ddp-swatch__color" style={{ background: s.hex }} aria-hidden />
                <span className="ddp-swatch__name">{s.name}</span>
                <span className="ddp-swatch__hex">{s.hex}</span>
              </li>
            ))}
          </ul>
        </article>
      )}

      {snap.signals_count !== undefined && (
        <footer className="ddp__foot">
          <span>{locale === 'it'
            ? `Distillato da ${snap.signals_count} segnali`
            : `Distilled from ${snap.signals_count} signals`}</span>
        </footer>
      )}
    </section>
  );
};

export default DesignDirectionPanel;
