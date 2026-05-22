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
import { useT } from '../../i18n/useT';
const MACRO_ORDER = ['italy', 'europe', 'americas', 'gcc', 'apac', 'latam', 'other'];
const MACRO_LABEL = {
  italy: {
    idx: '01',
    title: 'Italia',
    intro: 'L\'identità di partenza, la cultura materica.'
  },
  europe: {
    idx: '02',
    title: 'Europe',
    intro: 'Una rete editoriale di studi vicini.'
  },
  americas: {
    idx: '03',
    title: 'Americas',
    intro: 'Le geografie aspirazionali oltre Atlantico.'
  },
  gcc: {
    idx: '04',
    title: 'GCC',
    intro: 'Le atmosfere private del Golfo.'
  },
  apac: {
    idx: '05',
    title: 'APAC',
    intro: 'Le geografie luxury dell\'Asia.'
  },
  latam: {
    idx: '06',
    title: 'LatAm',
    intro: 'Le geografie spagnole oltre l\'Atlantico.'
  },
  other: {
    idx: '07',
    title: 'Other',
    intro: 'Mercati editoriali emergenti.'
  }
};

// ── Phase S-IDENTITY Step 1B — Positioning Modes™ ─────────────────────
//
// Studio-level strategic choices saved under tenant_markets.custom_settings.
// Values are stable keys; UI labels are localised below.
const POSITIONING_MODES = [{
  v: 'domestic_luxury_authority',
  label: 'Domestic Luxury Authority',
  hint: 'Autorità locale, fiducia, advisor umano.'
}, {
  v: 'international_editorial',
  label: 'International Editorial Positioning',
  hint: 'Prestigio culturale, storytelling internazionale.'
}, {
  v: 'hospitality_contract',
  label: 'Hospitality Contract Specialist',
  hint: 'Hotel, ristoranti, retail, developer.'
}, {
  v: 'luxury_residential_advisory',
  label: 'Luxury Residential Advisory',
  hint: 'Clienti privati, ville, attici, residenziale alto.'
}, {
  v: 'material_consultancy',
  label: 'Material Consultancy',
  hint: 'Materiali, finiture, superfici, atelier.'
}, {
  v: 'ad_specification_partner',
  label: 'A&D Specification Partner',
  hint: 'Architetti, interior designer, specifiers.'
}, {
  v: 'collectible_bespoke',
  label: 'Collectible Design & Bespoke',
  hint: 'Pezzi su misura, autorialità, artigianato.'
}];
const BUSINESS_INTENTS = [{
  v: 'domestic_lead_gen',
  label: 'Domestic lead generation'
}, {
  v: 'international_lead_gen',
  label: 'International lead generation'
}, {
  v: 'ad_specification',
  label: 'A&D specification'
}, {
  v: 'hospitality_contract',
  label: 'Hospitality contract'
}, {
  v: 'retail_showroom',
  label: 'Retail showroom growth'
}, {
  v: 'private_acquisition',
  label: 'Private client acquisition'
}, {
  v: 'material_advisory',
  label: 'Material advisory'
}, {
  v: 'brand_awareness',
  label: 'Brand awareness'
}, {
  v: 'partner_showroom',
  label: 'Partner showroom strategy'
}];
const PRIMARY_AUDIENCES = [{
  v: 'private_clients',
  label: 'Private clients'
}, {
  v: 'architects',
  label: 'Architects'
}, {
  v: 'interior_designers',
  label: 'Interior designers'
}, {
  v: 'developers',
  label: 'Developers'
}, {
  v: 'hospitality_groups',
  label: 'Hospitality groups'
}, {
  v: 'retail_buyers',
  label: 'Retail buyers'
}, {
  v: 'procurement',
  label: 'Procurement teams'
}, {
  v: 'showroom_visitors',
  label: 'Showroom visitors'
}, {
  v: 'intl_homeowners',
  label: 'International homeowners'
}];

// Editorial Cultural Lens™ — INDIPENDENTE dal mercato target.
// "Lo studio comunica attraverso questa lente culturale".
// Esempio: USA studio · USA market · ITALIAN editorial lens (cultura materica).
const CULTURAL_LENSES = [{
  v: 'italian_material_culture',
  label: 'Italian Material Culture',
  hint: 'Continuità materica, cultura del fatto, rituale lento.'
}, {
  v: 'iberian_mediterranean',
  label: 'Iberian Mediterranean',
  hint: 'Conviviale, architettonico, luce-driven.'
}, {
  v: 'french_savoir_faire',
  label: 'French Savoir-Faire',
  hint: 'Couture editorial, intimità di salotto.'
}, {
  v: 'dach_architectural',
  label: 'DACH Architectural Precision',
  hint: 'Onestà materica, ingegneria visibile.'
}, {
  v: 'british_heritage_quiet',
  label: 'British Heritage Quiet',
  hint: 'Modernismo restrained, autorità editoriale silenziosa.'
}, {
  v: 'gcc_ceremonial',
  label: 'GCC Ceremonial Hospitality',
  hint: 'Materialità cerimoniale, ospitalità privata.'
}, {
  v: 'us_aspirational_lifestyle',
  label: 'US Aspirational Lifestyle',
  hint: 'Lifestyle aspirazionale, processo trasparente.'
}, {
  v: 'latam_hospitality_warmth',
  label: 'LatAm Hospitality Warmth',
  hint: 'Calore sociale, narrativa familiare aspirazionale.'
}, {
  v: 'collectible_authorial',
  label: 'Collectible Authorial',
  hint: 'Rarità, autorialità, artigianato firmato.'
}];
const POSITIONING_EMPHASIS = [{
  v: 'domestic',
  label: 'Domestic emphasis'
}, {
  v: 'international',
  label: 'International emphasis'
}, {
  v: 'hybrid',
  label: 'Hybrid (domestic core + selective international)'
}];

// Default settings shape stored under custom_settings.positioning
const POSITIONING_DEFAULTS = {
  positioning_mode: null,
  positioning_emphasis: null,
  cultural_editorial_lens: null,
  business_intent: [],
  primary_audience: []
};
const MARKET_BEHAVIOR_LABELS = {
  decision_speed: 'Decision speed',
  relationship_weight: 'Relationship weight',
  specification_depth: 'Specification depth',
  hospitality_relevance: 'Hospitality relevance',
  emotional_pacing: 'Emotional pacing',
  material_sensitivity: 'Material sensitivity',
  trust_requirement: 'Trust requirement',
  preferred_cta_style: 'Preferred CTA style'
};
const humaniseBehaviorValue = v => (v || '').toString().replaceAll('_', ' ');
const normaliseMacro = m => {
  // Special case: Italy gets its own group even though its DB macro_region is 'europe'.
  if (m?.code === 'italy') return 'italy';
  const code = (m?.macro_region || '').toLowerCase();
  if (code.includes('italy')) return 'italy';
  if (code.includes('latam')) return 'latam';
  if (code.includes('europe')) return 'europe';
  if (code.includes('americ') || code.includes('north_america')) return 'americas';
  if (code.includes('gcc') || code.includes('mena') || code.includes('middle')) return 'gcc';
  if (code.includes('apac') || code.includes('asia')) return 'apac';
  return 'other';
};
const displayName = (m, preferred = 'en-US') => {
  const d = m?.display_name;
  if (!d) return m?.code || '';
  if (typeof d === 'string') return d;
  return d[preferred] || d['en-US'] || d['it-IT'] || Object.values(d)[0] || m?.code || '';
};
const InternationalPresencePage = () => {
  const {
    t
  } = useT();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [markets, setMarkets] = useState([]);
  const [original, setOriginal] = useState([]);
  const [saving, setSaving] = useState(false);
  const [dragId, setDragId] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.get('/api/tenants/me/markets');
        if (!alive) return;
        const list = (r.data?.markets || []).map((m, i) => ({
          ...m,
          _sort: m.tenant_sort !== 999 ? m.tenant_sort : i
        }));
        setMarkets(list);
        setOriginal(JSON.parse(JSON.stringify(list)));
      } catch (e) {
        toast.error('Impossibile caricare i mercati');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Group by macro-region, preserving sort.
  const grouped = useMemo(() => {
    const buckets = {};
    markets.forEach(m => {
      const k = normaliseMacro(m);
      (buckets[k] = buckets[k] || []).push(m);
    });
    Object.keys(buckets).forEach(k => buckets[k].sort((a, b) => a._sort - b._sort));
    return MACRO_ORDER.filter(k => buckets[k] && buckets[k].length > 0).map(k => ({
      key: k,
      ...MACRO_LABEL[k],
      markets: buckets[k]
    }));
  }, [markets]);
  const dirty = useMemo(() => {
    const norm = list => list.map(m => ({
      id: m.id,
      is_active: m.is_active,
      is_default: m.is_default,
      _sort: m._sort,
      positioning: (m.custom_settings || {}).positioning || POSITIONING_DEFAULTS
    }));
    return JSON.stringify(norm(markets)) !== JSON.stringify(norm(original));
  }, [markets, original]);
  const dirtyCount = useMemo(() => {
    return markets.filter(m => {
      const o = original.find(x => x.id === m.id);
      if (!o) return false;
      if (o.is_active !== m.is_active || o.is_default !== m.is_default || o._sort !== m._sort) return true;
      const pa = JSON.stringify((m.custom_settings || {}).positioning || POSITIONING_DEFAULTS);
      const pb = JSON.stringify((o.custom_settings || {}).positioning || POSITIONING_DEFAULTS);
      return pa !== pb;
    }).length;
  }, [markets, original]);
  const togglePresence = id => {
    setMarkets(list => list.map(m => m.id === id ? {
      ...m,
      is_active: !m.is_active
    } : m));
  };
  const setAsDefault = id => {
    setMarkets(list => list.map(m => ({
      ...m,
      is_default: m.id === id,
      is_active: m.id === id ? true : m.is_active
    })));
  };

  // Phase 1B — Positioning Mode™ patch helper (writes to custom_settings.positioning)
  const updatePositioning = (id, patch) => {
    setMarkets(list => list.map(m => {
      if (m.id !== id) return m;
      const cs = {
        ...(m.custom_settings || {})
      };
      const cur = {
        ...POSITIONING_DEFAULTS,
        ...(cs.positioning || {})
      };
      cs.positioning = {
        ...cur,
        ...patch
      };
      return {
        ...m,
        custom_settings: cs
      };
    }));
  };

  // Drag reorder within the same macro-region (HTML5 drag, calm).
  const onDragStart = id => setDragId(id);
  const onDragEnd = () => setDragId(null);
  const onDragOver = e => e.preventDefault();
  const onDrop = targetId => {
    if (!dragId || dragId === targetId) return;
    setMarkets(list => {
      const src = list.find(m => m.id === dragId);
      const tgt = list.find(m => m.id === targetId);
      if (!src || !tgt) return list;
      // only reorder within same macro
      if (normaliseMacro(src) !== normaliseMacro(tgt)) return list;
      // swap _sort values
      return list.map(m => {
        if (m.id === src.id) return {
          ...m,
          _sort: tgt._sort
        };
        if (m.id === tgt.id) return {
          ...m,
          _sort: src._sort
        };
        return m;
      });
    });
    setDragId(null);
  };
  const save = async () => {
    setSaving(true);
    try {
      // Build the diff list. We run sequential awaits (NOT Promise.all)
      // so a 500 on one PATCH halts the batch — partial saves are worse
      // than a halted save we can retry. The mutex on is_default also
      // benefits from a deterministic order: set-default FIRST, then the
      // rest, so any subsequent toggles don't accidentally race the
      // single-default constraint.
      const ops = [];
      const becomingDefault = markets.find(m => {
        const o = original.find(x => x.id === m.id);
        return m.is_default && (!o || !o.is_default);
      });
      const orderedMarkets = becomingDefault ? [becomingDefault, ...markets.filter(m => m.id !== becomingDefault.id)] : markets;
      orderedMarkets.forEach(m => {
        const o = original.find(x => x.id === m.id);
        const patch = {};
        if (!o || o.is_active !== m.is_active) patch.is_active = m.is_active;
        if (!o || o.is_default !== m.is_default) patch.is_default = m.is_default;
        if (!o || o._sort !== m._sort) patch.sort_order = m._sort;
        const pa = JSON.stringify((m.custom_settings || {}).positioning || POSITIONING_DEFAULTS);
        const pb = JSON.stringify((o?.custom_settings || {}).positioning || POSITIONING_DEFAULTS);
        if (pa !== pb) patch.custom_settings = m.custom_settings || {};
        if (Object.keys(patch).length > 0) ops.push({
          id: m.id,
          patch
        });
      });
      for (const {
        id,
        patch
      } of ops) {
        await api.patch(`/api/tenants/me/markets/${id}`, patch);
      }
      setOriginal(JSON.parse(JSON.stringify(markets)));
      toast.success('Presenza internazionale aggiornata');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Salvataggio fallito');
    } finally {
      setSaving(false);
    }
  };
  const discard = () => {
    setMarkets(JSON.parse(JSON.stringify(original)));
    toast.message('Modifiche annullate');
  };
  return <div className="ip-root" data-testid="ip-root">
      <button type="button" className="ip-back" data-testid="ip-back" onClick={() => navigate('/settings')}>
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

      {loading && <p className="ip-loading" data-testid="ip-loading">{t('settings.international_presence.caricamento_della_presenza_editoriale')}</p>}
      {!loading && grouped.length === 0 && <p className="ip-empty">{t('settings.international_presence.nessun_mercato_disponibile_nel_catalogo_platform')}</p>}

      {grouped.map(g => <section key={g.key} className="ip-region" data-testid={`ip-region-${g.key}`}>
          <div className="ip-region__head">
            <span className="ip-region__index">{g.idx}</span>
            <h2 className="ip-region__title">{g.title}</h2>
            <span className="ip-region__count">
              {g.markets.filter(m => m.is_active).length} attivi · {g.markets.length} disponibili
            </span>
          </div>

          {g.markets.map(m => <MarketCard key={m.id} market={m} dragging={dragId === m.id} onDragStart={() => onDragStart(m.id)} onDragEnd={onDragEnd} onDragOver={onDragOver} onDrop={() => onDrop(m.id)} onToggle={() => togglePresence(m.id)} onSetDefault={() => setAsDefault(m.id)} onPositioningChange={patch => updatePositioning(m.id, patch)} />)}
        </section>)}

      <div className="ip-savebar" data-visible={dirty} data-testid="ip-savebar">
        <p className="ip-savebar__count">
          <strong>{dirtyCount}</strong> {dirtyCount === 1 ? 'mercato modificato' : 'mercati modificati'}
        </p>
        <div className="ip-savebar__actions">
          <button type="button" className="ip-btn" data-testid="ip-discard" onClick={discard} disabled={saving}>{t('settings.international_presence.annulla')}</button>
          <button type="button" className="ip-btn ip-btn--primary" data-testid="ip-save" onClick={save} disabled={saving}>{saving ? 'Salvataggio…' : 'Conferma presenza'}</button>
        </div>
      </div>
    </div>;
};
const MarketCard = ({
  market: m,
  dragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onToggle,
  onSetDefault,
  onPositioningChange
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pos = (m.custom_settings || {}).positioning || POSITIONING_DEFAULTS;
  const behavior = m.market_behavior || {};
  const posLabel = POSITIONING_MODES.find(p => p.v === pos.positioning_mode)?.label;
  const lensLabel = CULTURAL_LENSES.find(l => l.v === pos.cultural_editorial_lens)?.label;
  const emphasisLabel = POSITIONING_EMPHASIS.find(e => e.v === pos.positioning_emphasis)?.label;
  return <article className="ip-card" data-testid={`ip-card-${m.code}`} data-active={m.is_active} data-default={m.is_default} data-inactive={!m.is_active} data-dragging={dragging} data-expanded={drawerOpen} draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onDragOver={onDragOver} onDrop={onDrop}>
      <div className="ip-card__drag" aria-hidden>
        <GripVertical size={14} strokeWidth={1.5} />
      </div>

      <div className="ip-card__body">
        <p className={`ip-card__eyebrow ${m.is_default ? '' : 'ip-card__eyebrow--mute'}`}>
          {m.is_default ? 'Default market' : m.is_active ? 'In presence' : 'Available'}
        </p>
        <h3 className="ip-card__name">{displayName(m)}</h3>
        <span className="ip-card__locale">
          <MapPin size={10} strokeWidth={1.5} style={{
          display: 'inline',
          marginRight: 4,
          verticalAlign: -1
        }} />
          {m.primary_locale}{m.currency ? ` · ${m.currency}` : ''}
        </span>

        {/* Strategic positioning summary (Step 1B). Visible only when active. */}
        {m.is_active && (posLabel || lensLabel || emphasisLabel) && <div className="ip-card__strategy" data-testid={`ip-strategy-${m.code}`}>
            {posLabel && <span className="ip-card__strategy-pill" data-kind="mode">
                <span className="ip-card__strategy-dot" />
                {posLabel}
              </span>}
            {lensLabel && <span className="ip-card__strategy-pill" data-kind="lens">
                {lensLabel} <em>· editorial lens</em>
              </span>}
            {emphasisLabel && <span className="ip-card__strategy-pill" data-kind="emphasis">{emphasisLabel}</span>}
          </div>}

        <div className="ip-card__attrs">
          {m.editorial_tone && <div className="ip-card__attr">
              <p className="ip-card__attr-label">Editorial Tone</p>
              <p className="ip-card__attr-value">{m.editorial_tone}</p>
            </div>}
          {m.luxury_positioning && <div className="ip-card__attr">
              <p className="ip-card__attr-label">Luxury Positioning</p>
              <p className="ip-card__attr-value">{m.luxury_positioning}</p>
            </div>}
          {m.hospitality_profile && <div className="ip-card__attr">
              <p className="ip-card__attr-label">Hospitality Profile</p>
              <p className="ip-card__attr-value">{m.hospitality_profile}</p>
            </div>}
          {m.storefront_behavior && <div className="ip-card__attr">
              <p className="ip-card__attr-label">Storefront Behavior</p>
              <p className="ip-card__attr-value">{m.storefront_behavior}</p>
            </div>}
        </div>

        {m.is_active && <button type="button" className="ip-card__strategy-toggle" data-testid={`ip-strategy-toggle-${m.code}`} onClick={() => setDrawerOpen(v => !v)} aria-expanded={drawerOpen}>
            {drawerOpen ? 'Chiudi posizionamento' : 'Affina posizionamento strategico'} →
          </button>}

        {drawerOpen && m.is_active && <PositioningDrawer marketCode={m.code} pos={pos} behavior={behavior} ctaDefault={m.cta_style_default} luxuryPerception={m.luxury_perception} onChange={onPositioningChange} />}
      </div>

      <div className="ip-card__actions">
        <label className="ip-toggle" data-testid={`ip-toggle-${m.code}`}>
          <input type="checkbox" checked={m.is_active || false} onChange={onToggle} aria-label={m.is_active ? 'Remove from presence' : 'Add to presence'} />
          <span className="ip-toggle__track" />
          <span className="ip-toggle__dot" />
        </label>
        <button type="button" className="ip-default-link" data-testid={`ip-default-${m.code}`} data-is-default={m.is_default} onClick={onSetDefault} disabled={m.is_default || !m.is_active}>
          {m.is_default ? 'Default' : 'Set as default'}
        </button>
      </div>
    </article>;
};

// ── Positioning Drawer ─────────────────────────────────────────────────
const PositioningDrawer = ({
  marketCode,
  pos,
  behavior,
  ctaDefault,
  luxuryPerception,
  onChange
}) => {
  const {
    t
  } = useT();
  const toggleArray = (key, value) => {
    const cur = Array.isArray(pos[key]) ? pos[key] : [];
    onChange({
      [key]: cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value]
    });
  };
  return <div className="ip-drawer" data-testid={`ip-drawer-${marketCode}`}>
      <p className="ip-drawer__intro">
        Definisci <em>come</em> lo studio vuole essere percepito in questo mercato.
        Il <em>mercato target</em> stabilisce lingua, geografia SEO, fuso editoriale e psicologia
        del CTA. La <em>lente culturale</em> è invece l'identità con cui parli — può differire dal mercato:
        <br />uno studio di New York può rivolgersi al mercato americano usando una <em>{t('settings.international_presence.italian_material_culture')}</em> come lente editoriale.
      </p>

      {/* Positioning Mode */}
      <div className="ip-drawer__group">
        <p className="ip-drawer__label">Positioning Mode</p>
        <p className="ip-drawer__hint">{t('settings.international_presence.l_asse_strategico_di_posizionamento_commerciale_pe')}</p>
        <div className="ip-drawer__radios" role="radiogroup">
          {POSITIONING_MODES.map(p => <button type="button" key={p.v} role="radio" aria-checked={pos.positioning_mode === p.v} className="ip-drawer__radio" data-testid={`ip-pos-${marketCode}-${p.v}`} data-selected={pos.positioning_mode === p.v} onClick={() => onChange({
          positioning_mode: pos.positioning_mode === p.v ? null : p.v
        })}>
              <span className="ip-drawer__radio-title">{p.label}</span>
              <span className="ip-drawer__radio-hint">{p.hint}</span>
            </button>)}
        </div>
      </div>

      {/* Cultural Editorial Lens — INDEPENDENT from positioning_mode */}
      <div className="ip-drawer__group">
        <p className="ip-drawer__label">Editorial Cultural Lens<sup>™</sup></p>
        <p className="ip-drawer__hint">
          La cultura editoriale con cui comunichi al mercato. <em>Indipendente</em> dalla geografia: lo
          studio mantiene la propria identità.
        </p>
        <div className="ip-drawer__radios ip-drawer__radios--compact" role="radiogroup">
          {CULTURAL_LENSES.map(l => <button type="button" key={l.v} role="radio" aria-checked={pos.cultural_editorial_lens === l.v} className="ip-drawer__radio" data-testid={`ip-lens-${marketCode}-${l.v}`} data-selected={pos.cultural_editorial_lens === l.v} onClick={() => onChange({
          cultural_editorial_lens: pos.cultural_editorial_lens === l.v ? null : l.v
        })}>
              <span className="ip-drawer__radio-title">{l.label}</span>
              <span className="ip-drawer__radio-hint">{l.hint}</span>
            </button>)}
        </div>
      </div>

      {/* Positioning Emphasis (Domestic/International/Hybrid) */}
      <div className="ip-drawer__group">
        <p className="ip-drawer__label">Positioning Emphasis</p>
        <p className="ip-drawer__hint">
          Domestico, internazionale o ibrido. MOOD non assume mai che ogni studio voglia espandersi all'estero.
        </p>
        <div className="ip-drawer__chips">
          {POSITIONING_EMPHASIS.map(e => <button type="button" key={e.v} className="ip-drawer__chip" data-testid={`ip-emphasis-${marketCode}-${e.v}`} data-selected={pos.positioning_emphasis === e.v} onClick={() => onChange({
          positioning_emphasis: pos.positioning_emphasis === e.v ? null : e.v
        })}>{e.label}</button>)}
        </div>
      </div>

      {/* Business Intent — multi */}
      <div className="ip-drawer__group">
        <p className="ip-drawer__label">Business Intent</p>
        <p className="ip-drawer__hint">{t('settings.international_presence.cosa_vuoi_ottenere_strategicamente_da_questo_merca')}</p>
        <div className="ip-drawer__chips">
          {BUSINESS_INTENTS.map(b => <button type="button" key={b.v} className="ip-drawer__chip" data-testid={`ip-intent-${marketCode}-${b.v}`} data-selected={(pos.business_intent || []).includes(b.v)} onClick={() => toggleArray('business_intent', b.v)}>{b.label}</button>)}
        </div>
      </div>

      {/* Primary Audience — multi */}
      <div className="ip-drawer__group">
        <p className="ip-drawer__label">Primary Audience</p>
        <p className="ip-drawer__hint">{t('settings.international_presence.a_chi_parli_prevalentemente_in_questo_mercato')}</p>
        <div className="ip-drawer__chips">
          {PRIMARY_AUDIENCES.map(a => <button type="button" key={a.v} className="ip-drawer__chip" data-testid={`ip-audience-${marketCode}-${a.v}`} data-selected={(pos.primary_audience || []).includes(a.v)} onClick={() => toggleArray('primary_audience', a.v)}>{a.label}</button>)}
        </div>
      </div>

      {/* Market Behavior preview (read-only) */}
      {Object.keys(behavior).length > 0 && <div className="ip-drawer__group">
          <p className="ip-drawer__label">Market Behavior<sup>™</sup> <em style={{
          opacity: 0.5,
          fontStyle: 'italic'
        }}>· read-only intelligence</em></p>
          <p className="ip-drawer__hint">{t('settings.international_presence.come_gli_interlocutori_in_questo_mercato_tipicamen')}</p>
          <div className="ip-drawer__behavior">
            {Object.entries(MARKET_BEHAVIOR_LABELS).map(([k, label]) => behavior[k] ? <div key={k} className="ip-drawer__behavior-row">
                  <span className="ip-drawer__behavior-key">{label}</span>
                  <span className="ip-drawer__behavior-value">{humaniseBehaviorValue(behavior[k])}</span>
                </div> : null)}
          </div>
          {(ctaDefault || luxuryPerception) && <div className="ip-drawer__readout">
              {luxuryPerception && <p><strong>Luxury reading.</strong> {luxuryPerception}</p>}
              {ctaDefault && <p><strong>CTA voice.</strong> <em>"{ctaDefault}"</em></p>}
            </div>}
        </div>}
    </div>;
};
export default InternationalPresencePage;