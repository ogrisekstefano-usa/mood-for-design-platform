/**
 * ITER204-A · Brand Atlas 2.0 — Design Discovery Engine™
 *
 * From "directory of vendors" → "library of design languages".
 * All content dynamic from /api/knowledge/atlas/discover + /facets.
 * No hardcoded mood_dna, images, counts, or tags.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import KE from '../../lib/knowledgeApi';
import './brand-atlas-2.css';

const FALLBACK_HERO =
  'linear-gradient(135deg, #1a1a1f 0%, #2a261c 50%, #312e2b 100%)';

export default function BrandAtlas2Page() {
  const [cards, setCards] = useState(null);
  const [facets, setFacets] = useState({ mood_dna: [], markets: [], positioning: [] });
  const [q, setQ] = useState('');
  const [moodFilter, setMoodFilter] = useState(null);
  const [marketFilter, setMarketFilter] = useState(null);
  const [posFilter, setPosFilter] = useState(null);
  const [savedOnly, setSavedOnly] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);

  const reload = useCallback(async () => {
    try {
      const [d, f] = await Promise.all([KE.atlasDiscover(), KE.atlasFacets()]);
      setCards(d.data?.cards || []);
      setFacets(f.data || { mood_dna: [], markets: [], positioning: [] });
    } catch (_) { setCards([]); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const toggleSave = useCallback(async (card) => {
    try {
      if (card.saved) {
        await KE.unlinkBrandFromStudio(card.id);
        toast.success('Rimosso dalla Studio Library');
      } else {
        await KE.linkBrandToStudio(card.id, {});
        toast.success(`${card.name} salvato nella Studio Library™`);
      }
      setCards((arr) => arr.map((c) => c.id === card.id ? { ...c, saved: !c.saved } : c));
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Operazione fallita');
    }
  }, []);

  const filtered = useMemo(() => {
    if (!cards) return null;
    const ql = q.trim().toLowerCase();
    return cards.filter((c) => {
      if (savedOnly && !c.saved) return false;
      if (moodFilter && !(c.mood_dna || []).includes(moodFilter)) return false;
      if (marketFilter && !(c.markets || []).includes(marketFilter)) return false;
      if (posFilter && c.positioning !== posFilter) return false;
      if (!ql) return true;
      const hay = [
        c.name, c.positioning, c.category, c.country,
        ...(c.mood_dna || []), ...(c.markets || []),
        ...(c.top_collections || []),
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(ql);
    });
  }, [cards, q, moodFilter, marketFilter, posFilter, savedOnly]);

  const activeFilters = [moodFilter, marketFilter, posFilter, savedOnly && '__saved__']
    .filter(Boolean).length;

  return (
    <div className="atlas2-page" data-testid="atlas2-page">
      {/* ── HERO ────────────────────────────────────────────────── */}
      <section className="atlas2-hero">
        <div className="atlas2-hero-eyebrow">BRAND ATLAS™</div>
        <h1 className="atlas2-hero-title">
          Manufacturers as <em>design languages</em>
        </h1>
        <p className="atlas2-hero-lead">
          Esplora i brand che definiscono materiali, atmosfere e culture del
          design contemporaneo. Trova la direzione progettuale prima del
          produttore.
        </p>
      </section>

      {/* ── SEARCH + FILTERS ─────────────────────────────────────── */}
      <section className="atlas2-controls" data-testid="atlas2-controls">
        <div className="atlas2-search">
          <Icons.Search size={14} />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca brand, materiale, designer, stile, mercato o linguaggio progettuale…"
            data-testid="atlas2-search" />
          {q && (
            <button className="atlas2-search-clear" onClick={() => setQ('')}
                     data-testid="atlas2-search-clear">
              <Icons.X size={14} />
            </button>
          )}
        </div>

        <div className="atlas2-filter-row">
          <FilterPicker
            label="Mood DNA"
            value={moodFilter}
            options={facets.mood_dna}
            onChange={setMoodFilter}
            testid="atlas2-filter-mood" />
          <FilterPicker
            label="Mercato"
            value={marketFilter}
            options={facets.markets}
            onChange={setMarketFilter}
            testid="atlas2-filter-market" />
          <FilterPicker
            label="Posizionamento"
            value={posFilter}
            options={facets.positioning}
            onChange={setPosFilter}
            testid="atlas2-filter-positioning" />
          <button
            className={`atlas2-toggle ${savedOnly ? 'atlas2-toggle--on' : ''}`}
            onClick={() => setSavedOnly((v) => !v)}
            data-testid="atlas2-filter-saved">
            {savedOnly ? <Icons.BookmarkCheck size={14} /> : <Icons.Bookmark size={14} />}
            <span>Studio Library</span>
          </button>
          {activeFilters > 0 && (
            <button className="atlas2-clear" onClick={() => {
              setMoodFilter(null); setMarketFilter(null);
              setPosFilter(null); setSavedOnly(false);
            }} data-testid="atlas2-clear-filters">
              <Icons.X size={12} />
              <span>Reset {activeFilters}</span>
            </button>
          )}
        </div>
      </section>

      {/* ── GRID ─────────────────────────────────────────────────── */}
      {filtered === null ? (
        <div className="atlas2-grid">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="atlas2-empty" data-testid="atlas2-empty">
          <Icons.Compass size={28} strokeWidth={1.3} />
          <h3>Nessun brand corrisponde ai filtri selezionati.</h3>
          <p>Prova a rimuovere uno dei filtri o cerca un linguaggio diverso.</p>
        </div>
      ) : (
        <div className="atlas2-grid" data-testid="atlas2-grid">
          {filtered.map((c) => (
            <AtlasCard
              key={c.id}
              card={c}
              isHovered={hoveredId === c.id}
              onHover={(v) => setHoveredId(v ? c.id : null)}
              onToggleSave={() => toggleSave(c)} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  CARD                                                               */
/* ─────────────────────────────────────────────────────────────────── */
function AtlasCard({ card, isHovered, onHover, onToggleSave }) {
  const hasHero = !!card.hero_image_url;
  const heroStyle = hasHero
    ? { backgroundImage: `url(${card.hero_image_url})` }
    : { backgroundImage: FALLBACK_HERO };
  const moods = (card.mood_dna || []).slice(0, 3);
  return (
    <Link
      to={`/inspirations/brands/${card.id}`}
      className="atlas2-card"
      data-testid={`atlas2-card-${card.id}`}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <div className="atlas2-card-hero" style={heroStyle}>
        <div className="atlas2-card-veil" />

        {/* Save button — top right */}
        <button
          className={`atlas2-save ${card.saved ? 'atlas2-save--on' : ''}`}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSave(); }}
          data-testid={`atlas2-save-${card.id}`}
          aria-label={card.saved ? 'Remove from Studio Library' : 'Save to Studio Library'}
        >
          {card.saved ? <Icons.Heart fill="currentColor" size={14} />
                       : <Icons.Heart size={14} />}
        </button>

        {/* Badge — top left */}
        <div className="atlas2-card-badges">
          {card.certified ? (
            <span className="atlas2-badge atlas2-badge--certified">
              <Icons.Award size={11} />
              <span>CERTIFIED ATLAS™</span>
            </span>
          ) : (
            <span className="atlas2-badge atlas2-badge--curated">
              <Icons.Sparkles size={11} />
              <span>CURATED BY MOOD™</span>
            </span>
          )}
        </div>

        {/* Quick preview on hover (desktop) */}
        {isHovered && (
          <div className="atlas2-quick-preview" data-testid={`atlas2-preview-${card.id}`}>
            <QPItem icon={<Icons.Layers size={12} />}
                     label="Collections" value={card.counts?.collections} />
            <QPItem icon={<Icons.Package size={12} />}
                     label="Products" value={card.counts?.products} />
            <QPItem icon={<Icons.Palette size={12} />}
                     label="Materials" value={card.counts?.materials} />
            <QPItem icon={<Icons.Users size={12} />}
                     label="Designers" value={card.counts?.designers} />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="atlas2-card-body">
        {card.positioning && (
          <div className="atlas2-card-cat">
            {String(card.positioning).toUpperCase()}
          </div>
        )}
        <h3 className="atlas2-card-name">{card.name}</h3>
        {card.hero_subtitle && (
          <p className="atlas2-card-narrative">{card.hero_subtitle}</p>
        )}
        {moods.length > 0 && (
          <div className="atlas2-mood-row">
            {moods.map((m, i) => (
              <span key={i} className="atlas2-mood-pill"
                     data-testid={`atlas2-card-${card.id}-mood-${i}`}>
                {m}
              </span>
            ))}
            {(card.mood_dna || []).length > 3 && (
              <span className="atlas2-mood-pill atlas2-mood-pill--more">
                +{(card.mood_dna || []).length - 3}
              </span>
            )}
          </div>
        )}
        {(card.top_collections || []).length > 0 && (
          <div className="atlas2-coll-line"
                data-testid={`atlas2-card-${card.id}-collections`}>
            <Icons.Bookmark size={10} />
            <span>{(card.top_collections || []).slice(0, 3).join(' · ')}</span>
          </div>
        )}
        <div className="atlas2-card-cta">
          Enter the Embassy
          <Icons.ArrowRight size={13} />
        </div>
      </div>
    </Link>
  );
}

function QPItem({ icon, label, value }) {
  return (
    <div className="atlas2-qp-item">
      <div className="atlas2-qp-icon">{icon}</div>
      <div className="atlas2-qp-value">{value ?? '—'}</div>
      <div className="atlas2-qp-label">{label}</div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="atlas2-card atlas2-card--skeleton">
      <div className="atlas2-card-hero" style={{ background: '#1a1a1f' }} />
      <div className="atlas2-card-body">
        <div className="atlas2-skel atlas2-skel--cat" />
        <div className="atlas2-skel atlas2-skel--name" />
        <div className="atlas2-skel atlas2-skel--narr" />
        <div className="atlas2-skel atlas2-skel--row" />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  FILTER PICKER (dropdown)                                            */
/* ─────────────────────────────────────────────────────────────────── */
function FilterPicker({ label, value, options, onChange, testid }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="atlas2-fp" data-testid={testid}>
      <button
        className={`atlas2-fp-btn ${value ? 'atlas2-fp-btn--active' : ''}`}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        data-testid={`${testid}-btn`}>
        <span className="atlas2-fp-label">{label}</span>
        <span className="atlas2-fp-value">{value || 'Tutti'}</span>
        <Icons.ChevronDown size={12} />
      </button>
      {open && (
        <>
          <div className="atlas2-fp-overlay" onClick={() => setOpen(false)} />
          <div className="atlas2-fp-menu" data-testid={`${testid}-menu`}>
            <button
              className="atlas2-fp-item"
              onClick={() => { onChange(null); setOpen(false); }}
              data-testid={`${testid}-item-all`}>
              Tutti
            </button>
            {(options || []).map((opt) => (
              <button key={opt.key}
                       className={`atlas2-fp-item ${value === opt.key ? 'atlas2-fp-item--on' : ''}`}
                       onClick={() => { onChange(opt.key); setOpen(false); }}
                       data-testid={`${testid}-item-${opt.key}`}>
                <span>{opt.key}</span>
                <span className="atlas2-fp-count">{opt.count}</span>
              </button>
            ))}
            {(options || []).length === 0 && (
              <div className="atlas2-fp-empty">Nessuna opzione disponibile</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
