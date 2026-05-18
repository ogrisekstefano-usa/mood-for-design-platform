/**
 * InternationalPresencePage — Phase S-IDENTITY Step 1.
 *
 * The tenant's MARKET POSITIONING surface. NOT an admin toggles table —
 * an editorial market-presence experience. Each market is a cinematic
 * card; macro-regions are large editorial sections; activation is a
 * calm soft toggle; default is a marked gold accent.
 *
 * Reads:  GET  /api/tenants/me/markets  (returns ALL platform markets
 *         joined with tenant_markets so we know active/default/sort).
 * Writes: PATCH /api/tenants/me/markets/{market_id} per row, debounced
 *         and batched on Save.
 *
 * NEVER use words like 'toggle', 'enable', 'activate' aggressively. The
 * UI says "Add to presence" / "Currently in presence" / "Set as default".
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { ArrowLeft, GripVertical, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import './internationalPresence.css';

const MACRO_ORDER = ['italy', 'europe', 'americas', 'gcc', 'apac', 'other'];
const MACRO_LABEL = {
  italy:    { idx: '01', title: 'Italia',   intro: 'L\'identità di partenza, la cultura materica.' },
  europe:   { idx: '02', title: 'Europe',   intro: 'Una rete editoriale di studi vicini.' },
  americas: { idx: '03', title: 'Americas', intro: 'Le geografie aspirazionali oltre Atlantico.' },
  gcc:      { idx: '04', title: 'GCC',      intro: 'Le atmosfere private del Golfo.' },
  apac:     { idx: '05', title: 'APAC',     intro: 'Le geografie luxury dell\'Asia.' },
  other:    { idx: '06', title: 'Other',    intro: 'Mercati editoriali emergenti.' },
};

const normaliseMacro = (m) => {
  // Special case: Italy gets its own group even though its DB macro_region is 'europe'.
  if (m?.code === 'italy') return 'italy';
  const code = (m?.macro_region || '').toLowerCase();
  if (code.includes('italy'))    return 'italy';
  if (code.includes('europe'))   return 'europe';
  if (code.includes('americ') || code.includes('north_america') || code.includes('latam')) return 'americas';
  if (code.includes('gcc') || code.includes('mena') || code.includes('middle')) return 'gcc';
  if (code.includes('apac') || code.includes('asia'))  return 'apac';
  return 'other';
};

const displayName = (m, preferred = 'en-US') => {
  const d = m?.display_name;
  if (!d) return m?.code || '';
  if (typeof d === 'string') return d;
  return d[preferred] || d['en-US'] || d['it-IT'] || Object.values(d)[0] || m?.code || '';
};

const InternationalPresencePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading]   = useState(true);
  const [markets, setMarkets]   = useState([]);
  const [original, setOriginal] = useState([]);
  const [saving, setSaving]     = useState(false);
  const [dragId, setDragId]     = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.get('/api/tenants/me/markets');
        if (!alive) return;
        const list = (r.data?.markets || []).map((m, i) => ({
          ...m,
          _sort: m.tenant_sort !== 999 ? m.tenant_sort : i,
        }));
        setMarkets(list);
        setOriginal(JSON.parse(JSON.stringify(list)));
      } catch (e) {
        toast.error('Impossibile caricare i mercati');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Group by macro-region, preserving sort.
  const grouped = useMemo(() => {
    const buckets = {};
    markets.forEach((m) => {
      const k = normaliseMacro(m);
      (buckets[k] = buckets[k] || []).push(m);
    });
    Object.keys(buckets).forEach((k) => buckets[k].sort((a, b) => a._sort - b._sort));
    return MACRO_ORDER
      .filter((k) => buckets[k] && buckets[k].length > 0)
      .map((k) => ({ key: k, ...MACRO_LABEL[k], markets: buckets[k] }));
  }, [markets]);

  const dirty = useMemo(() => {
    return JSON.stringify(markets.map((m) => ({
      id: m.id, is_active: m.is_active, is_default: m.is_default, _sort: m._sort,
    }))) !== JSON.stringify(original.map((m) => ({
      id: m.id, is_active: m.is_active, is_default: m.is_default, _sort: m._sort,
    })));
  }, [markets, original]);

  const dirtyCount = useMemo(() => {
    return markets.filter((m) => {
      const o = original.find((x) => x.id === m.id);
      if (!o) return false;
      return o.is_active !== m.is_active || o.is_default !== m.is_default || o._sort !== m._sort;
    }).length;
  }, [markets, original]);

  const togglePresence = (id) => {
    setMarkets((list) => list.map((m) => m.id === id ? { ...m, is_active: !m.is_active } : m));
  };
  const setAsDefault = (id) => {
    setMarkets((list) => list.map((m) => ({
      ...m,
      is_default: m.id === id,
      is_active:  m.id === id ? true : m.is_active,
    })));
  };

  // Drag reorder within the same macro-region (HTML5 drag, calm).
  const onDragStart = (id) => setDragId(id);
  const onDragEnd   = () => setDragId(null);
  const onDragOver  = (e) => e.preventDefault();
  const onDrop      = (targetId) => {
    if (!dragId || dragId === targetId) return;
    setMarkets((list) => {
      const src = list.find((m) => m.id === dragId);
      const tgt = list.find((m) => m.id === targetId);
      if (!src || !tgt) return list;
      // only reorder within same macro
      if (normaliseMacro(src) !== normaliseMacro(tgt)) return list;
      // swap _sort values
      return list.map((m) => {
        if (m.id === src.id) return { ...m, _sort: tgt._sort };
        if (m.id === tgt.id) return { ...m, _sort: src._sort };
        return m;
      });
    });
    setDragId(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      const ops = [];
      markets.forEach((m) => {
        const o = original.find((x) => x.id === m.id);
        const patch = {};
        if (!o || o.is_active  !== m.is_active)  patch.is_active  = m.is_active;
        if (!o || o.is_default !== m.is_default) patch.is_default = m.is_default;
        if (!o || o._sort      !== m._sort)      patch.sort_order = m._sort;
        if (Object.keys(patch).length > 0) {
          ops.push(api.patch(`/api/tenants/me/markets/${m.id}`, patch));
        }
      });
      await Promise.all(ops);
      setOriginal(JSON.parse(JSON.stringify(markets)));
      toast.success('Presenza internazionale aggiornata');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Salvataggio fallito');
    } finally { setSaving(false); }
  };

  const discard = () => {
    setMarkets(JSON.parse(JSON.stringify(original)));
    toast.message('Modifiche annullate');
  };

  return (
    <div className="ip-root" data-testid="ip-root">
      <button
        type="button"
        className="ip-back"
        data-testid="ip-back"
        onClick={() => navigate('/settings')}
      >
        <ArrowLeft size={11} strokeWidth={1.5} /> Settings
      </button>

      <header className="ip-head">
        <p className="ip-head__eyebrow">Workspace · Identity</p>
        <h1 className="ip-head__title">
          International Presence<sup>™</sup>
        </h1>
        <p className="ip-head__intro">
          La mappa editoriale dei mercati in cui lo studio si posiziona. Ogni mercato
          attivato apre una superficie storefront market-native — non una traduzione,
          una presenza culturalmente nativa. Il mercato impostato come <em>default</em>
          è quello che apre il sito quando un visitatore arriva senza indicazione di lingua.
        </p>
      </header>

      {loading && <p className="ip-loading" data-testid="ip-loading">Caricamento della presenza editoriale…</p>}
      {!loading && grouped.length === 0 && (
        <p className="ip-empty">Nessun mercato disponibile nel catalogo platform.</p>
      )}

      {grouped.map((g) => (
        <section
          key={g.key}
          className="ip-region"
          data-testid={`ip-region-${g.key}`}
        >
          <div className="ip-region__head">
            <span className="ip-region__index">{g.idx}</span>
            <h2 className="ip-region__title">{g.title}</h2>
            <span className="ip-region__count">
              {g.markets.filter((m) => m.is_active).length} attivi · {g.markets.length} disponibili
            </span>
          </div>

          {g.markets.map((m) => (
            <MarketCard
              key={m.id}
              market={m}
              dragging={dragId === m.id}
              onDragStart={() => onDragStart(m.id)}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              onDrop={() => onDrop(m.id)}
              onToggle={() => togglePresence(m.id)}
              onSetDefault={() => setAsDefault(m.id)}
            />
          ))}
        </section>
      ))}

      <div
        className="ip-savebar"
        data-visible={dirty}
        data-testid="ip-savebar"
      >
        <p className="ip-savebar__count">
          <strong>{dirtyCount}</strong> {dirtyCount === 1 ? 'mercato modificato' : 'mercati modificati'}
        </p>
        <div className="ip-savebar__actions">
          <button
            type="button"
            className="ip-btn"
            data-testid="ip-discard"
            onClick={discard}
            disabled={saving}
          >Annulla</button>
          <button
            type="button"
            className="ip-btn ip-btn--primary"
            data-testid="ip-save"
            onClick={save}
            disabled={saving}
          >{saving ? 'Salvataggio…' : 'Conferma presenza'}</button>
        </div>
      </div>
    </div>
  );
};

const MarketCard = ({ market: m, dragging, onDragStart, onDragEnd, onDragOver, onDrop, onToggle, onSetDefault }) => {
  return (
    <article
      className="ip-card"
      data-testid={`ip-card-${m.code}`}
      data-active={m.is_active}
      data-default={m.is_default}
      data-inactive={!m.is_active}
      data-dragging={dragging}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="ip-card__drag" aria-hidden>
        <GripVertical size={14} strokeWidth={1.5} />
      </div>

      <div className="ip-card__body">
        <p
          className={`ip-card__eyebrow ${m.is_default ? '' : 'ip-card__eyebrow--mute'}`}
        >
          {m.is_default ? 'Default market' : m.is_active ? 'In presence' : 'Available'}
        </p>
        <h3 className="ip-card__name">{displayName(m)}</h3>
        <span className="ip-card__locale">
          <MapPin size={10} strokeWidth={1.5} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />
          {m.primary_locale}{m.currency ? ` · ${m.currency}` : ''}
        </span>

        <div className="ip-card__attrs">
          {m.editorial_tone && (
            <div className="ip-card__attr">
              <p className="ip-card__attr-label">Editorial Tone</p>
              <p className="ip-card__attr-value">{m.editorial_tone}</p>
            </div>
          )}
          {m.luxury_positioning && (
            <div className="ip-card__attr">
              <p className="ip-card__attr-label">Luxury Positioning</p>
              <p className="ip-card__attr-value">{m.luxury_positioning}</p>
            </div>
          )}
          {m.hospitality_profile && (
            <div className="ip-card__attr">
              <p className="ip-card__attr-label">Hospitality Profile</p>
              <p className="ip-card__attr-value">{m.hospitality_profile}</p>
            </div>
          )}
          {m.storefront_behavior && (
            <div className="ip-card__attr">
              <p className="ip-card__attr-label">Storefront Behavior</p>
              <p className="ip-card__attr-value">{m.storefront_behavior}</p>
            </div>
          )}
        </div>
      </div>

      <div className="ip-card__actions">
        <label className="ip-toggle" data-testid={`ip-toggle-${m.code}`}>
          <input
            type="checkbox"
            checked={m.is_active || false}
            onChange={onToggle}
            aria-label={m.is_active ? 'Remove from presence' : 'Add to presence'}
          />
          <span className="ip-toggle__track" />
          <span className="ip-toggle__dot" />
        </label>
        <button
          type="button"
          className="ip-default-link"
          data-testid={`ip-default-${m.code}`}
          data-is-default={m.is_default}
          onClick={onSetDefault}
          disabled={m.is_default || !m.is_active}
        >
          {m.is_default ? 'Default' : 'Set as default'}
        </button>
      </div>
    </article>
  );
};

export default InternationalPresencePage;
