/**
 * ProductGalleryPage — Visual Atelier™ · Phase F2.1.
 *
 * Route: /inspirations/products/:productId
 *
 * NON è una pagina prodotto.
 * È un visual atelier editoriale — composizione, relazione, workflow.
 *
 * 3-col immersive layout:
 *   • LEFT    — filtri quick (Moodboard ready · Texture · Composition friendly)
 *               + atmosphere · materialità · color family
 *   • CENTER  — hero immersive + Visual Asset Stream raggruppato per bucket
 *   • RIGHT   — tabs contextual: Asset Info · Curated References™ · Works well with…
 *
 * Stile: dark cinematic editorial.
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import MoodboardPickerModal from './MoodboardPickerModal';
import CuratedCollectionDrawer from './CuratedCollectionDrawer';
import './product-gallery.css';

// ─── Bucket labels (italian editorial copy) ─────────────────────────
const BUCKET_LABELS = {
  lifestyle:        'Lifestyle',
  still_life:       'Still life',
  cutouts:          'Cutouts',
  textures:         'Materia',
  details:          'Dettagli',
  technicals:       'Tecnici',
  renderings:       'Rendering',
  campaigns:        'Campagne',
  material_samples: 'Campioni materia',
  variants:         'Varianti',
};

const BUCKET_ORDER = [
  'lifestyle', 'still_life', 'cutouts', 'details', 'textures',
  'material_samples', 'variants', 'campaigns', 'renderings', 'technicals',
];

// ─── Composition Modes™ — Phase F2.2 ────────────────────────────────
// Each mode reorders buckets AND boosts per-asset score for ranking.
// Mode does NOT change dataset — only priority/sequencing/hero choice.
const COMPOSITION_MODES = [
  {
    key: 'editorial',
    label: 'Editorial',
    sublabel: 'magazine luxury',
    bucketOrder: ['lifestyle', 'campaigns', 'still_life', 'details',
                  'cutouts', 'textures', 'material_samples',
                  'variants', 'renderings', 'technicals'],
    score: (c) =>
      ((c.asset_type === 'lifestyle' || c.asset_type === 'campaign') ? 4 : 0) +
      ((c.editorial_score || 0) * 3) +
      ((c.visual_weight || 0) * 1.5),
  },
  {
    key: 'composition',
    label: 'Composition',
    sublabel: 'atelier creativo',
    bucketOrder: ['still_life', 'cutouts', 'details', 'material_samples',
                  'textures', 'lifestyle', 'variants', 'renderings',
                  'campaigns', 'technicals'],
    score: (c) =>
      ((c.asset_type === 'still_life' || c.asset_type === 'cutout' || c.asset_type === 'detail') ? 4 : 0) +
      ((c.composition_friendly || 0) * 4) +
      ((c.moodboard_priority || 0) * 0.5),
  },
  {
    key: 'material',
    label: 'Material',
    sublabel: 'materioteca contemporanea',
    bucketOrder: ['textures', 'material_samples', 'details', 'cutouts',
                  'still_life', 'lifestyle', 'variants', 'renderings',
                  'campaigns', 'technicals'],
    score: (c) =>
      ((c.asset_type === 'texture' || c.asset_type === 'material_sample') ? 4 : 0) +
      ((c.asset_type === 'detail') ? 2 : 0) +
      ((c.texture_repetition_score || 0) * 2),
  },
  {
    key: 'storytelling',
    label: 'Storytelling',
    sublabel: 'narrativa cinematica',
    bucketOrder: ['lifestyle', 'campaigns', 'renderings', 'still_life',
                  'details', 'cutouts', 'textures', 'material_samples',
                  'variants', 'technicals'],
    score: (c) =>
      ((c.editorial_score || 0) * 4) +
      ((c.asset_type === 'lifestyle' || c.asset_type === 'campaign' || c.asset_type === 'rendering') ? 3 : 0) +
      ((c.visual_weight || 0) * 1.2),
  },
];

// Quick filters — pure UI predicates on atlas cards
const QUICK_FILTERS = [
  { key: 'moodboard_ready', label: 'Moodboard ready',
    test: c => (c.moodboard_priority || 0) >= 4 },
  { key: 'editorial',       label: 'Editorial',
    test: c => (c.editorial_score || 0) >= 0.75 },
  { key: 'composition',     label: 'Composition friendly',
    test: c => (c.composition_friendly || 0) >= 0.75 },
  { key: 'high_weight',     label: 'High visual weight',
    test: c => (c.visual_weight || 0) >= 0.70 },
  { key: 'textures',        label: 'Texture',
    test: c => c.asset_type === 'texture' || c.asset_type === 'material_sample' },
  { key: 'still_life',      label: 'Still life',
    test: c => c.asset_type === 'still_life' },
  { key: 'details',         label: 'Dettagli',
    test: c => c.asset_type === 'detail' },
];

const BadgeChip = ({ label, intent = 'default' }) => (
  <span className={`pg-chip pg-chip--${intent}`}>{label}</span>
);

const AssetBadges = ({ asset }) => {
  const b = [];
  if ((asset.moodboard_priority || 0) >= 4)        b.push({ k: 'mb',   label: 'Moodboard ready', intent: 'cyan' });
  if ((asset.editorial_score || 0) >= 0.78)        b.push({ k: 'ed',   label: 'Editorial',       intent: 'warm' });
  if ((asset.composition_friendly || 0) >= 0.80)   b.push({ k: 'comp', label: 'Composition',     intent: 'cyan' });
  if (asset.asset_type === 'texture')              b.push({ k: 'tx',   label: 'Texture',         intent: 'plain' });
  if (asset.asset_type === 'material_sample')      b.push({ k: 'ms',   label: 'Materia',         intent: 'plain' });
  if (asset.asset_type === 'detail')               b.push({ k: 'dt',   label: 'Dettaglio',       intent: 'plain' });
  if (asset.asset_type === 'still_life')           b.push({ k: 'sl',   label: 'Still life',      intent: 'plain' });
  if ((asset.visual_weight || 0) >= 0.78)          b.push({ k: 'vw',   label: 'High visual weight', intent: 'warm' });
  return (
    <div className="pg-asset-badges">
      {b.slice(0, 3).map(x => <BadgeChip key={x.k} label={x.label} intent={x.intent} />)}
    </div>
  );
};

const AssetTile = ({ asset, onPick, onSave, isHero = false, isSaved = false }) => (
  <button
    type="button"
    className={`pg-tile ${isHero ? 'pg-tile--hero' : ''}`}
    data-testid={`pg-tile-${asset.id}`}
    onClick={() => onPick(asset)}
  >
    <div className="pg-tile__media">
      {asset.file_url
        ? <img src={asset.file_url} alt={asset.alt_text || ''} loading="lazy" />
        : <div className="pg-tile__placeholder"><Icons.Image size={18} /></div>}
      <div className="pg-tile__overlay">
        <AssetBadges asset={asset} />
        <span
          className={`pg-tile__save ${isSaved ? 'is-saved' : ''}`}
          role="button"
          tabIndex={-1}
          onClick={(e) => { e.stopPropagation(); onSave(asset); }}
          data-testid={`pg-tile-save-${asset.id}`}
        >
          <Icons.Bookmark size={14} fill={isSaved ? 'currentColor' : 'transparent'} />
        </span>
      </div>
    </div>
  </button>
);

const Bucket = ({ name, items, onPick, onSave, savedIds }) => {
  const [open, setOpen] = useState(true);
  if (!items || items.length === 0) return null;
  return (
    <section className="pg-bucket" data-testid={`pg-bucket-${name}`}>
      <header className="pg-bucket__head">
        <button
          type="button"
          className="pg-bucket__toggle"
          onClick={() => setOpen(o => !o)}
          data-testid={`pg-bucket-toggle-${name}`}
        >
          <Icons.ChevronDown
            size={14}
            style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 220ms' }}
          />
          <span className="pg-bucket__name">{BUCKET_LABELS[name] || name}</span>
          <span className="pg-bucket__count">{items.length}</span>
        </button>
      </header>
      {open && (
        <div className="pg-bucket__grid">
          {items.map(it => (
            <AssetTile
              key={it.id}
              asset={it}
              onPick={onPick}
              onSave={onSave}
              isSaved={savedIds.has(it.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
};

// ─── Right sidebar tabs ─────────────────────────────────────────────
const TABS = ['asset_info', 'references', 'related'];

const AssetInfoTab = ({ asset }) => {
  if (!asset) return null;
  return (
    <div className="pg-info" data-testid="pg-tab-asset-info">
      <p className="pg-info__eyebrow">Linguaggio progettuale</p>
      <h3 className="pg-info__title">{asset.product_name || 'Asset senza nome'}</h3>
      <p className="pg-info__sub">{asset.brand} · {asset.collection || '—'}</p>

      <dl className="pg-info__grid">
        <div><dt>Tipologia asset</dt><dd>{BUCKET_LABELS[asset.asset_type] || asset.asset_type || '—'}</dd></div>
        <div><dt>Ruolo compositivo</dt><dd>{asset.compositional_role || '—'}</dd></div>
        <div><dt>Angolo</dt><dd>{asset.view_angle || '—'}</dd></div>
        <div><dt>Family cromatica</dt><dd>{asset.color_family || '—'}</dd></div>
        <div><dt>Editorial score</dt>
          <dd>{asset.editorial_score != null ? Math.round(asset.editorial_score * 100) + '%' : '—'}</dd></div>
        <div><dt>Composition friendly</dt>
          <dd>{asset.composition_friendly != null ? Math.round(asset.composition_friendly * 100) + '%' : '—'}</dd></div>
        <div><dt>Visual weight</dt>
          <dd>{asset.visual_weight != null ? Math.round(asset.visual_weight * 100) + '%' : '—'}</dd></div>
        <div><dt>Moodboard priority</dt><dd>{asset.moodboard_priority ?? '—'}</dd></div>
      </dl>

      {(asset.mood_tags?.length || 0) > 0 && (
        <div className="pg-info__chips">
          <p className="pg-info__chips-label">Atmosfera</p>
          {asset.mood_tags.map(t => <span key={t} className="pg-chip pg-chip--plain">{t}</span>)}
        </div>
      )}
      {(asset.dominant_color_palette?.length || 0) > 0 && (
        <div className="pg-info__palette" data-testid="pg-palette">
          <p className="pg-info__chips-label">Palette dominante</p>
          <div className="pg-info__palette-row">
            {asset.dominant_color_palette.slice(0, 5).map((p, i) => (
              <span key={i} className="pg-swatch" style={{ background: p.hex }} title={p.hex} />
            ))}
          </div>
        </div>
      )}
      <StudioLanguageWidget />
    </div>
  );
};

// Linguaggio progettuale dello studio — Usage Memory™ widget
const StudioLanguageWidget = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get('/api/inspirations/usage-memory/studio-language?days=90')
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);
  if (loading) return null;
  if (!data) return null;

  return (
    <div className="pg-studio-lang" data-testid="pg-studio-language">
      <p className="pg-info__chips-label">Linguaggio progettuale dello studio</p>
      {(data.atmospheres || []).length > 0 && (
        <div className="pg-studio-lang__row">
          <span className="pg-studio-lang__lbl">Atmosfere</span>
          <div className="pg-studio-lang__chips">
            {data.atmospheres.slice(0, 5).map(a =>
              <span key={a.label}
                    className={`pg-chip pg-chip--plain pg-studio-lang__chip is-${a.presence}`}>
                {a.label}
              </span>)}
          </div>
        </div>
      )}
      {(data.materialities || []).length > 0 && (
        <div className="pg-studio-lang__row">
          <span className="pg-studio-lang__lbl">Materialità</span>
          <div className="pg-studio-lang__chips">
            {data.materialities.slice(0, 5).map(m =>
              <span key={m.label}
                    className={`pg-chip pg-chip--plain pg-studio-lang__chip is-${m.presence}`}>
                {m.label}
              </span>)}
          </div>
        </div>
      )}
      {(data.narrative_threads || []).length > 0 && (
        <p className="pg-studio-lang__narrative">
          {data.narrative_threads[0].replace(/\*(.*?)\*/g, '$1')}
        </p>
      )}
    </div>
  );
};

const ReferencesTab = ({ collections, onCreate, onAddToCollection, currentAsset, savedInstances }) => (
  <div className="pg-refs" data-testid="pg-tab-references">
    <header className="pg-refs__head">
      <h4 className="pg-refs__title">Curated References™</h4>
      <button
        type="button"
        className="pg-btn pg-btn--ghost"
        onClick={onCreate}
        data-testid="pg-refs-new"
      >
        <Icons.Plus size={13} />
        <span>Nuova collezione</span>
      </button>
    </header>
    {currentAsset && (
      <p className="pg-refs__hint">
        Salva <em>{currentAsset.product_name || 'questo asset'}</em> in una collezione esistente
        o crea un nuovo capitolo curatoriale.
      </p>
    )}
    {savedInstances && savedInstances.length > 0 && (
      <div className="pg-refs__saved-banner" data-testid="pg-refs-saved-banner">
        Già salvato in {savedInstances.length} {savedInstances.length === 1 ? 'collezione' : 'collezioni'}
      </div>
    )}
    <ul className="pg-refs__list">
      {(collections || []).map(c => (
        <li key={c.id} className="pg-refs__item" data-testid={`pg-refs-item-${c.id}`}>
          <button
            type="button"
            className="pg-refs__item-btn"
            onClick={() => onAddToCollection(c)}
          >
            <div className="pg-refs__cover">
              {c.cover_asset?.file_url
                ? <img src={c.cover_asset.file_url} alt="" loading="lazy" />
                : <Icons.Layers size={14} />}
            </div>
            <div className="pg-refs__meta">
              <p className="pg-refs__name">{c.title}</p>
              <p className="pg-refs__sub">{c.items_count || 0} riferimenti · {c.visibility}</p>
            </div>
            <Icons.Plus size={14} className="pg-refs__add" />
          </button>
        </li>
      ))}
      {(!collections || collections.length === 0) && (
        <li className="pg-refs__empty">
          Nessuna collezione curata ancora. Crea il primo capitolo del tuo atelier.
        </li>
      )}
    </ul>
  </div>
);

const RelatedTab = ({ items, loading, onPick }) => (
  <div className="pg-related" data-testid="pg-tab-related">
    <h4 className="pg-related__title">Works well with…</h4>
    <p className="pg-related__hint">Curatela editoriale — non raccomandazione algoritmica.</p>
    {loading && <p className="pg-related__loading">Sto leggendo le relazioni…</p>}
    {!loading && (items || []).length === 0 && (
      <p className="pg-related__empty">Ancora nessuna affinità curatoriale rilevata.</p>
    )}
    <ul className="pg-related__list">
      {(items || []).slice(0, 8).map(it => (
        <li key={it.id} className="pg-related__item">
          <button
            type="button"
            className="pg-related__item-btn"
            onClick={() => onPick(it)}
            data-testid={`pg-related-${it.id}`}
          >
            <div className="pg-related__media">
              {it.file_url
                ? <img src={it.file_url} alt="" loading="lazy" />
                : <Icons.Image size={14} />}
            </div>
            <div className="pg-related__meta">
              <p className="pg-related__name">{it.product_name || '—'}</p>
              <p className="pg-related__sub">
                {it.brand} · {(it.match_reasons || []).join(' · ') || '—'}
              </p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  </div>
);

// ─── Floating action tray ───────────────────────────────────────────
const FloatingTray = ({ message, actions, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 5500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="pg-tray" data-testid="pg-tray" role="status">
      <Icons.Check size={14} className="pg-tray__check" />
      <span className="pg-tray__msg">{message}</span>
      <div className="pg-tray__actions">
        {(actions || []).map(a => (
          <button
            key={a.key}
            type="button"
            className="pg-tray__act"
            onClick={() => { a.onClick(); onClose(); }}
            data-testid={`pg-tray-${a.key}`}
          >
            {a.label}
          </button>
        ))}
        <button
          type="button"
          className="pg-tray__close"
          onClick={onClose}
          aria-label="Chiudi"
        >
          <Icons.X size={12} />
        </button>
      </div>
    </div>
  );
};


// ─── Main component ────────────────────────────────────────────────
export default function ProductGalleryPage() {
  const { productId } = useParams();
  const navigate = useNavigate();

  const [atlas, setAtlas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [hero, setHero] = useState(null);
  const [activeAsset, setActiveAsset] = useState(null);
  const [activeTab, setActiveTab] = useState('asset_info');
  const [quickFilters, setQuickFilters] = useState(new Set());
  const [mode, setMode] = useState('composition');  // Composition Modes™ — default 'composition' (atelier creativo)

  const [collections, setCollections] = useState([]);
  const [savedIds, setSavedIds] = useState(new Set());
  const [savedInstancesForActive, setSavedInstancesForActive] = useState([]);

  const [related, setRelated] = useState({ items: [], loading: false });

  // Modals / drawers
  const [moodboardPicker, setMoodboardPicker] = useState(null);    // { asset } or null
  const [collectionDrawer, setCollectionDrawer] = useState(null);  // { open: true } or null
  const [tray, setTray] = useState(null);                          // { message, actions } or null

  const [fullscreen, setFullscreen] = useState(false);

  // ── Load atlas ──────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setError(null);
    api.get(`/api/inspirations/registry/products/${productId}/visual-assets`)
      .then(r => {
        setAtlas(r.data);
        const initialHero = r.data.hero || (r.data.gallery && r.data.gallery[0]) || null;
        setHero(initialHero);
        setActiveAsset(initialHero);
      })
      .catch(e => {
        if (e?.response?.status === 404) setError('Product non trovato');
        else setError('Errore nel caricamento del Product Visual Atlas™');
      })
      .finally(() => setLoading(false));
  }, [productId]);

  // ── Load collections ────────────────────────────────────────────
  const reloadCollections = useCallback(() => {
    api.get('/api/inspirations/references/collections')
      .then(r => setCollections(r.data?.items || []))
      .catch(() => setCollections([]));
  }, []);

  useEffect(() => { reloadCollections(); }, [reloadCollections]);

  // ── Saved status for active asset ───────────────────────────────
  useEffect(() => {
    if (!activeAsset?.id) return;
    api.get(`/api/inspirations/references/by-asset/${activeAsset.id}`)
      .then(r => {
        setSavedInstancesForActive(r.data?.instances || []);
        if (r.data?.saved) {
          setSavedIds(s => new Set([...s, activeAsset.id]));
        }
      })
      .catch(() => {});
  }, [activeAsset?.id]);

  // ── Load related when tab changes to 'related' ──────────────────
  useEffect(() => {
    if (activeTab !== 'related' || !activeAsset?.id) return;
    setRelated(r => ({ ...r, loading: true }));
    api.get(`/api/inspirations/registry/products/${activeAsset.id}/related?limit=12`)
      .then(r => setRelated({ items: r.data?.items || [], loading: false }))
      .catch(() => setRelated({ items: [], loading: false }));
  }, [activeTab, activeAsset?.id]);

  // ── Quick filters + Composition Mode reorder ────────────────────
  const activeModeDef = useMemo(
    () => COMPOSITION_MODES.find(m => m.key === mode) || COMPOSITION_MODES[1],
    [mode],
  );

  const filteredBuckets = useMemo(() => {
    if (!atlas) return {};
    const buckets = {};
    const order = activeModeDef.bucketOrder || BUCKET_ORDER;
    order.forEach(k => {
      let items = atlas[k] || [];
      if (quickFilters.size > 0) {
        const tests = QUICK_FILTERS.filter(f => quickFilters.has(f.key)).map(f => f.test);
        items = items.filter(c => tests.every(t => t(c)));
      }
      // Mode-based score sort INSIDE each bucket
      items = [...items].sort((a, b) => activeModeDef.score(b) - activeModeDef.score(a));
      buckets[k] = items;
    });
    return buckets;
  }, [atlas, quickFilters, activeModeDef]);

  // Bucket order for rendering follows the mode
  const renderOrder = activeModeDef.bucketOrder || BUCKET_ORDER;

  // Hero recomputed when mode changes (top-scored asset across all buckets)
  useEffect(() => {
    if (!atlas?.gallery?.length) return;
    const scored = [...atlas.gallery].sort(
      (a, b) => activeModeDef.score(b) - activeModeDef.score(a),
    );
    const top = scored[0];
    if (top && top.id !== hero?.id) {
      setHero(top);
    }
    // Note: activeAsset is NOT auto-changed — user-explicit pick stays.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModeDef, atlas]);

  // ── Handlers ────────────────────────────────────────────────────
  const onPickAsset = useCallback((asset) => {
    setActiveAsset(asset);
    setHero(asset);
    setActiveTab('asset_info');
  }, []);

  const onSaveAsset = useCallback((asset, collectionId = null) => {
    api.post('/api/inspirations/references/save', {
      visual_asset_id: asset.id,
      curated_collection_id: collectionId,
    }).then(r => {
      setSavedIds(s => new Set([...s, asset.id]));
      const collTitle = collectionId
        ? (collections.find(c => c.id === collectionId)?.title || 'collezione')
        : 'Curated References™';
      setTray({
        message: r.data.created
          ? `Salvato in ${collTitle}`
          : `Già presente in ${collTitle}`,
        actions: [
          ...(collectionId ? [{
            key: 'open', label: 'Apri collezione',
            onClick: () => navigate(`/inspirations/references/${collectionId}`),
          }] : []),
          { key: 'moodboard', label: 'Aggiungi al moodboard',
            onClick: () => setMoodboardPicker({ asset }) },
        ],
      });
      reloadCollections();
      // refresh saved instances for active
      if (asset.id === activeAsset?.id) {
        api.get(`/api/inspirations/references/by-asset/${asset.id}`)
          .then(rr => setSavedInstancesForActive(rr.data?.instances || []));
      }
    }).catch(() => toast.error('Salvataggio non riuscito'));
  }, [collections, activeAsset?.id, navigate, reloadCollections]);

  const onCreateCollection = () => setCollectionDrawer({ open: true });

  const onCollectionCreated = (newColl) => {
    reloadCollections();
    setCollectionDrawer(null);
    // Auto-save active asset into the new collection
    if (activeAsset && newColl?.id) {
      onSaveAsset(activeAsset, newColl.id);
    }
  };

  const onAddActiveToMoodboard = () => {
    if (!activeAsset) return;
    setMoodboardPicker({ asset: activeAsset });
  };

  // ── Render ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="pg-shell pg-shell--loading" data-testid="pg-loading">
        <div className="pg-skel pg-skel--hero" />
        <div className="pg-skel pg-skel--row" />
        <div className="pg-skel pg-skel--row" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="pg-shell pg-shell--error" data-testid="pg-error">
        <Icons.AlertCircle size={20} />
        <p>{error}</p>
        <Link to="/inspirations">Torna all'archivio</Link>
      </div>
    );
  }
  if (!atlas) return null;

  const product = atlas.product || {};
  const counts = atlas.counts || {};

  return (
    <div className="pg-shell" data-testid="pg-shell">
      {/* ─── HEADER ─── */}
      <header className="pg-header">
        <Link to="/inspirations" className="pg-back" data-testid="pg-back">
          <Icons.ChevronLeft size={14} />
          <span>Archivio</span>
        </Link>
        <div className="pg-header__meta">
          <p className="pg-header__eyebrow">Product Gallery™ · Visual Atelier</p>
          <h1 className="pg-header__title">
            <em>{product.name || 'Asset visuale'}</em>
          </h1>
          <p className="pg-header__sub">
            {product.brand}{product.collection ? ` · ${product.collection}` : ''}
            {product.designer ? ` · design ${product.designer}` : ''}
            <span className="pg-header__total"> · {counts.total || 0} asset</span>
          </p>
        </div>
        {/* Composition Modes™ toggle */}
        <nav className="pg-modes" role="tablist" aria-label="Composition Modes" data-testid="pg-modes">
          {COMPOSITION_MODES.map(m => (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={mode === m.key}
              className={`pg-mode ${mode === m.key ? 'is-on' : ''}`}
              onClick={() => setMode(m.key)}
              data-testid={`pg-mode-${m.key}`}
              title={m.sublabel}
            >
              <span className="pg-mode__label">{m.label}</span>
              <span className="pg-mode__sub">{m.sublabel}</span>
            </button>
          ))}
        </nav>
      </header>

      {/* ─── BODY: 3-col layout ─── */}
      <div className="pg-body">
        {/* LEFT — filters */}
        <aside className="pg-aside pg-aside--left" data-testid="pg-aside-left">
          <section className="pg-aside__group">
            <p className="pg-aside__label">Quick filtri</p>
            <div className="pg-quick">
              {QUICK_FILTERS.map(f => (
                <button
                  key={f.key}
                  type="button"
                  className={`pg-pill ${quickFilters.has(f.key) ? 'is-on' : ''}`}
                  onClick={() => setQuickFilters(s => {
                    const n = new Set(s);
                    n.has(f.key) ? n.delete(f.key) : n.add(f.key);
                    return n;
                  })}
                  data-testid={`pg-filter-${f.key}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </section>

          <section className="pg-aside__group">
            <p className="pg-aside__label">Atmosfera</p>
            <div className="pg-meta-list">
              {(atlas.metadata?.mood_tags || []).slice(0, 10).map(t =>
                <span key={t} className="pg-chip pg-chip--plain">{t}</span>)}
              {(atlas.metadata?.mood_tags || []).length === 0 && (
                <p className="pg-aside__empty">Atmosfera in lettura curatoriale</p>
              )}
            </div>
          </section>

          <section className="pg-aside__group">
            <p className="pg-aside__label">Family cromatica</p>
            <p className="pg-aside__value">
              {atlas.metadata?.color_family_dominant || '—'}
            </p>
          </section>

          <section className="pg-aside__group">
            <p className="pg-aside__label">Palette aggregata</p>
            <div className="pg-aside__palette">
              {(atlas.metadata?.palette_aggregate || []).slice(0, 6).map((p, i) =>
                <span key={i} className="pg-swatch" style={{ background: p.hex }} title={p.hex} />)}
            </div>
          </section>
        </aside>

        {/* CENTER — hero + stream */}
        <main className="pg-main" data-testid="pg-main">
          {/* HERO */}
          <section
            className={`pg-hero ${fullscreen ? 'pg-hero--fullscreen' : ''}`}
            data-testid="pg-hero"
          >
            <div className="pg-hero__media">
              {hero?.file_url
                ? <img src={hero.file_url} alt={hero.alt_text || ''} />
                : <div className="pg-hero__placeholder"><Icons.Image size={24} /></div>}
            </div>
            <div className="pg-hero__actions">
              <button type="button" className="pg-btn pg-btn--ghost"
                onClick={() => setFullscreen(f => !f)}
                data-testid="pg-hero-fullscreen"
              >
                <Icons.Maximize2 size={13} />
                <span>{fullscreen ? 'Riduci' : 'Fullscreen'}</span>
              </button>
              <button type="button" className="pg-btn pg-btn--primary"
                onClick={() => activeAsset && onSaveAsset(activeAsset)}
                data-testid="pg-hero-save"
              >
                <Icons.Bookmark size={13} />
                <span>Salva in References™</span>
              </button>
              <button type="button" className="pg-btn pg-btn--accent"
                onClick={onAddActiveToMoodboard}
                data-testid="pg-hero-moodboard"
              >
                <Icons.LayoutGrid size={13} />
                <span>Aggiungi al moodboard</span>
              </button>
            </div>
            {hero && <div className="pg-hero__badges"><AssetBadges asset={hero} /></div>}
          </section>

          {/* STREAM */}
          <section className="pg-stream" data-testid="pg-stream">
            {renderOrder.map(name => (
              <Bucket
                key={name}
                name={name}
                items={filteredBuckets[name]}
                onPick={onPickAsset}
                onSave={onSaveAsset}
                savedIds={savedIds}
              />
            ))}
            {(atlas.gallery?.length || 0) === 0 && (
              <div className="pg-empty">
                Nessun asset visuale ancora classificato per questo prodotto.
              </div>
            )}
          </section>
        </main>

        {/* RIGHT — context tabs */}
        <aside className="pg-aside pg-aside--right" data-testid="pg-aside-right">
          <nav className="pg-tabs" role="tablist">
            {TABS.map(t => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={activeTab === t}
                className={`pg-tab ${activeTab === t ? 'is-on' : ''}`}
                onClick={() => setActiveTab(t)}
                data-testid={`pg-tab-${t}`}
              >
                {t === 'asset_info' && 'Asset'}
                {t === 'references' && 'References'}
                {t === 'related'    && 'Affinità'}
              </button>
            ))}
          </nav>
          <div className="pg-tab-body">
            {activeTab === 'asset_info' && <AssetInfoTab asset={activeAsset} />}
            {activeTab === 'references' && (
              <ReferencesTab
                collections={collections}
                onCreate={onCreateCollection}
                onAddToCollection={(coll) => activeAsset && onSaveAsset(activeAsset, coll.id)}
                currentAsset={activeAsset}
                savedInstances={savedInstancesForActive}
              />
            )}
            {activeTab === 'related' && (
              <RelatedTab
                items={related.items}
                loading={related.loading}
                onPick={onPickAsset}
              />
            )}
          </div>
        </aside>
      </div>

      {/* Floating tray */}
      {tray && (
        <FloatingTray
          message={tray.message}
          actions={tray.actions}
          onClose={() => setTray(null)}
        />
      )}

      {/* Modals */}
      {moodboardPicker && (
        <MoodboardPickerModal
          asset={moodboardPicker.asset}
          onClose={() => setMoodboardPicker(null)}
          onAdded={(mbId) => {
            setMoodboardPicker(null);
            setTray({
              message: 'Asset aggiunto al moodboard',
              actions: [{
                key: 'open-mb', label: 'Apri moodboard',
                onClick: () => navigate(`/moodboards/${mbId}`),
              }],
            });
          }}
        />
      )}
      {collectionDrawer?.open && (
        <CuratedCollectionDrawer
          onClose={() => setCollectionDrawer(null)}
          onCreated={onCollectionCreated}
        />
      )}
    </div>
  );
}
