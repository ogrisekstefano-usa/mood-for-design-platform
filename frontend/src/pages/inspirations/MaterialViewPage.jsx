/**
 * MaterialViewPage — Materioteca curatoriale · Phase F2.2.
 *
 * Route: /inspirations/materials
 *
 * NON è un catalogo tecnico materiali.
 * È un **atlante materico curatoriale** organizzato per family cromatica
 * e ritmo visuale.
 *
 * Layout:
 *   • Top filter rail (color_family chips + material chips)
 *   • Editorial grid (asymmetrical, larger tiles for high-weight assets)
 *   • Hover reveals brand + product name + palette swatches
 *   • Click → naviga al Product Gallery™ del prodotto
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import api from '../../lib/api';
import JourneyContextHeader from '../../components/journey/JourneyContextHeader';
import './product-gallery.css';
import './material-view.css';
import { useT } from '../../i18n/useT';

export default function MaterialViewPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const [data, setData] = useState({ items: [], color_families: [], materials: [], count: 0 });
  const [loading, setLoading] = useState(true);
  const [activeFamily, setActiveFamily] = useState(null);
  const [activeMaterial, setActiveMaterial] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeFamily)   params.set('color_family', activeFamily);
    if (activeMaterial) params.set('material', activeMaterial);
    params.set('limit', '160');
    api.get(`/api/inspirations/materials/atlas?${params.toString()}`)
      .then(r => setData(r.data))
      .catch(() => setData({ items: [], color_families: [], materials: [], count: 0 }))
      .finally(() => setLoading(false));
  }, [activeFamily, activeMaterial]);

  // Asymmetrical grid: hero tiles (large) for high texture_repetition + visual_weight,
  // standard for the rest.
  const tiles = useMemo(() => {
    return (data.items || []).map((it, idx) => {
      const isHero = idx < 3
        || (it.texture_repetition_score || 0) > 0.72
        || (it.visual_weight || 0) > 0.78;
      return { ...it, _hero: !!isHero };
    });
  }, [data.items]);

  return (
    <div className="mv-shell mv-shell--editorial" data-testid="mv-shell">
      <JourneyContextHeader compact />

      {/* Header — coerente con /inspirations (Cultural Design Intelligence Layer) */}
      <header className="mv-header" data-testid="mv-header">
        <p className="mv-eyebrow">CURATED MATERIALS LIBRARY · MATERIAL VIEW™</p>
        <h1 className="mv-title">
          <em>Material that speaks</em>
        </h1>
        <p className="mv-sub">
          Un atlante materico organizzato per famiglia cromatica e ritmo visuale —
          non un catalogo tecnico, ma un tavolo curatoriale tattile su cui si compongono
          le moodboard di progetto.
        </p>
        <div className="mv-actions">
          <Link to="/inspirations" className="mv-action-btn" data-testid="mv-add-material">
            <Icons.Plus size={14} strokeWidth={2} /> Aggiungi materiale
          </Link>
          <Link to="/inspirations" className="mv-action-btn mv-action-btn--ghost">
            <Icons.ArrowLeft size={13} strokeWidth={1.8} /> Torna a Inspirations™
          </Link>
          <span className="mv-count-pill" data-testid="mv-count">
            <Icons.Layers size={11} strokeWidth={1.8} /> {data.count} elementi curati
          </span>
        </div>
      </header>

      {/* Filters */}
      <section className="mv-filters" data-testid="mv-filters">
        <div className="mv-filter-group">
          <span className="mv-filter-group__label">Family cromatica</span>
          <div className="mv-chips">
            <button
              type="button"
              className={`mv-chip ${!activeFamily ? 'is-on' : ''}`}
              onClick={() => setActiveFamily(null)}
              data-testid="mv-filter-family-all"
            >{t('taxonomy.common.all', null, 'All')}</button>
            {data.color_families.slice(0, 10).map(f => (
              <button
                key={f.family}
                type="button"
                className={`mv-chip ${activeFamily === f.family ? 'is-on' : ''}`}
                onClick={() => setActiveFamily(f.family === activeFamily ? null : f.family)}
                data-testid={`mv-filter-family-${f.family}`}
              >
                {f.family.replace(/_/g, ' ')}
                <span className="mv-chip__count">{f.count}</span>
              </button>
            ))}
          </div>
        </div>
        {data.materials.length > 0 && (
          <div className="mv-filter-group">
            <span className="mv-filter-group__label">{t('material_view.filter.materiality', null, 'Materiality')}</span>
            <div className="mv-chips">
              {data.materials.slice(0, 14).map(m => (
                <button
                  key={m.label}
                  type="button"
                  className={`mv-chip ${activeMaterial === m.label ? 'is-on' : ''}`}
                  onClick={() => setActiveMaterial(m.label === activeMaterial ? null : m.label)}
                  data-testid={`mv-filter-material-${m.label}`}
                >
                  {m.label}
                  <span className="mv-chip__count">{m.count}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Grid */}
      <main className="mv-grid" data-testid="mv-grid">
        {loading && (
          <div className="mv-loading">
            <Icons.Loader size={14} className="mv-spin" />
            <span>{t('inspirations.material_view.sto_leggendo_la_materioteca')}</span>
          </div>
        )}
        {!loading && tiles.length === 0 && (
          <div className="mv-empty mv-empty--editorial" data-testid="mv-empty">
            <Icons.Layers size={28} strokeWidth={1.4} className="mv-empty__icon" />
            <h3 className="mv-empty__title">L'atlante materico è ancora vuoto.</h3>
            <p className="mv-empty__sub">
              Aggiungi il primo materiale da Inspirations™ — un upload diretto, un link Pinterest,
              uno scatto del campionario, qualsiasi URL: MOOD lo classifica per famiglia cromatica
              e materialità.
            </p>
            <div className="mv-empty__actions">
              <Link to="/inspirations" className="mv-action-btn" data-testid="mv-empty-cta">
                <Icons.Plus size={14} strokeWidth={2} /> Aggiungi il primo materiale
              </Link>
            </div>
          </div>
        )}
        {tiles.map(it => (
          <button
            key={it.id}
            type="button"
            className={`mv-tile ${it._hero ? 'mv-tile--hero' : ''}`}
            onMouseEnter={() => setHoveredId(it.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => navigate(`/inspirations/products/${it.id}`)}
            data-testid={`mv-tile-${it.id}`}
          >
            <div className="mv-tile__media">
              {it.file_url
                ? <img src={it.file_url} alt={it.alt_text || ''} loading="lazy" />
                : <div className="mv-tile__placeholder"><Icons.Square size={16} /></div>}
              {hoveredId === it.id && (
                <div className="mv-tile__overlay">
                  <p className="mv-tile__name">{it.product_name || '—'}</p>
                  <p className="mv-tile__brand">{it.brand}</p>
                  {(it.dominant_color_palette || []).length > 0 && (
                    <div className="mv-tile__palette">
                      {it.dominant_color_palette.slice(0, 4).map((p, i) =>
                        <span key={i} className="mv-swatch" style={{ background: p.hex }} />)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </button>
        ))}
      </main>
    </div>
  );
}
