/**
 * ProspectsPage · CULTIVATION layer.
 *
 * Visual intent: ACTIVE relationships in motion. Each prospect is a
 * "lane" — wide, horizontal, with three columns:
 *   1. Designer · who is cultivating
 *   2. Momentum · last touch, returns, saved inspirations
 *   3. Decision · progression bar + suggestion CTA
 *
 * Teal pulse accent. Operator-facing. NOT client-facing.
 */
import React, { useMemo, useState } from 'react';
import { Search, X, ArrowRight, MessageCircle, Heart, Repeat } from 'lucide-react';
import ClientRelationsLayout from './ClientRelationsLayout';
import useRelations from './useRelations';
import useDesigners from './useDesigners';
import DesignerChip from './DesignerChip';
import WelcomeDrawer from './WelcomeDrawer';
import ContinuationInterviewDrawer from './ContinuationInterviewDrawer';

const REGISTERS = [
  { v: 'editorial',    l: 'Editorial'    },
  { v: 'concierge',    l: 'Concierge'    },
  { v: 'consultative', l: 'Consultative' },
  { v: 'discovery',    l: 'Discovery'    },
];

const TIERS = [
  { v: 'atelier',       l: 'Atelier'        },
  { v: 'couture',       l: 'Couture'        },
  { v: 'pret_a_porter', l: 'Prêt-à-porter'  },
];

const formatAgo = (iso) => {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m || 1}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return `${Math.floor(d / 30)}mo`;
};

// Pseudo metrics derived from behavioral_tags — until Sprint B wires real timeline.
const deriveSignals = (lead) => {
  const tags = Array.isArray(lead.behavioral_tags) ? lead.behavioral_tags : [];
  const atmos = Array.isArray(lead.atmosphere_signals) ? lead.atmosphere_signals : [];
  const materials = Array.isArray(lead.material_signals) ? lead.material_signals : [];
  // Saved inspirations ≈ count of atmosphere+material signals captured.
  const saved   = atmos.length * 3 + materials.length * 2;
  // Returns: derived from has_returned-like tags.
  const returns = tags.filter(t => t.includes('returning') || t.includes('high_engagement')).length + 1;
  // Last interview answered approx — when did intake complete.
  const lastTouch = lead.intake_completed_at || lead.updated_at || lead.created_at;
  return { saved, returns, lastTouch };
};

const ProspectLane = ({ p, designer, onPromote, onOpen }) => {
  const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email || 'Untitled';
  const initials = name.split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const temp = Number(p.relationship_temperature || 0);
  const score = Number(p.progression_score || 0);
  const ready = temp >= 0.75 || score >= 0.80;
  const { saved, returns, lastTouch } = deriveSignals(p);
  const register = p.cultural_register || 'discovery';
  const tier = (p.luxury_perception_tier || '').replace(/_/g, ' ') || '—';

  // Narrative momentum language — NO percentages.
  const momentumLabel =
    score >= 0.85 ? 'arriving at the threshold' :
    score >= 0.65 ? 'gathering momentum' :
    score >= 0.40 ? 'finding its voice' :
    score >= 0.20 ? 'early dialogue' :
                    'first whispers';

  return (
    <article
      className="prospect-lane"
      data-testid={`prospect-lane-${p.id}`}
      onClick={() => onOpen && onOpen(p)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' && onOpen) onOpen(p); }}
    >
      {/* Column 1 · Designer Presence™ */}
      <div className="prospect-lane__designer" onClick={(e) => e.stopPropagation()}>
        <div className="prospect-lane__identity">
          <span className="prospect-lane__avatar" aria-hidden="true">{initials || '·'}</span>
          <div>
            <h3 className="prospect-lane__name">{name}</h3>
            <p className="prospect-lane__email">{p.email}</p>
          </div>
        </div>
        <p className="prospect-lane__designer-line">
          <span className="prospect-lane__pulse" />
          cultivated&nbsp;by
        </p>
        <DesignerChip designer={designer} size="md" contextId={`prospect-${p.id}`} />
      </div>

      {/* Column 2 · Momentum */}
      <div className="prospect-lane__momentum" data-testid={`prospect-momentum-${p.id}`}>
        <div className="prospect-lane__momentum-row">
          <span className="prospect-metric">
            <Heart size={15} strokeWidth={1.6} />
            <span><strong>{saved}</strong> saved inspirations</span>
          </span>
          <span className="prospect-metric">
            <Repeat size={15} strokeWidth={1.6} />
            <span><strong>{returns}</strong> return{returns === 1 ? '' : 's'}</span>
          </span>
        </div>
        <div className="prospect-lane__last-touch">
          <MessageCircle size={14} strokeWidth={1.6} />
          {lastTouch
            ? <>last interview answered <strong>{formatAgo(lastTouch)} ago</strong></>
            : <>continuation pending</>}
        </div>
        <div className="prospect-lane__chips">
          <span className="prospect-chip">{register}</span>
          {tier !== '—' && <span className="prospect-chip">{tier}</span>}
        </div>
      </div>

      {/* Column 3 · Decision — narrative, not %  */}
      <div className="prospect-lane__decision" onClick={(e) => e.stopPropagation()}>
        <div className="prospect-lane__momentum-narrative" aria-label={`Momentum: ${momentumLabel}`}>
          <span className="prospect-lane__momentum-eyebrow">Relationship momentum</span>
          <span className="prospect-lane__momentum-line">{momentumLabel}</span>
          <span className="prospect-lane__momentum-track" aria-hidden="true">
            <span className="prospect-lane__momentum-fill" style={{ width: `${Math.max(6, Math.min(100, Math.round(score * 100)))}%` }} />
          </span>
        </div>
        <button
          type="button"
          className={`prospect-lane__cta ${ready ? 'is-ready' : ''}`}
          onClick={() => onPromote(p)}
          data-testid={`prospect-promote-${p.id}`}
        >
          {ready ? 'Promote to account' : 'Continue interview'} <ArrowRight size={15} strokeWidth={2} />
        </button>
      </div>
    </article>
  );
};

const ProspectsPage = () => {
  const [q, setQ] = useState('');
  const [register, setRegister] = useState(null);
  const [tier, setTier] = useState(null);
  const filters = useMemo(() => ({ q, cultural_register: register, budget_tier: tier }), [q, register, tier]);
  const { items, total, counts, loading, promote } = useRelations('/api/relations/prospects', filters);
  const { pickDesigner } = useDesigners();

  // Drawers (Sprint C)
  const [welcomeId, setWelcomeId] = useState(null);
  const [interviewLead, setInterviewLead] = useState(null);

  const handlePromote = async (p) => {
    try { await promote(p.id, 'account'); } catch (_) { /* TODO toast */ }
  };
  const handleOpen = (p) => setWelcomeId(p.id);
  const handleWelcomeAction = (moment, lead) => {
    if (moment.kind === 'continuation_interview') {
      setInterviewLead(lead);
      setWelcomeId(null);
    } else if (moment.kind === 'promote_account') {
      handlePromote(lead);
      setWelcomeId(null);
    } else {
      setWelcomeId(null);
    }
  };

  const toolbar = (
    <>
      <div className="cr-search">
        <Search size={16} />
        <input
          type="search"
          placeholder="Cerca prospect…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          data-testid="prospects-search"
        />
      </div>
      {REGISTERS.map((r) => (
        <button
          key={r.v}
          type="button"
          className={`cr-chip cr-chip--teal ${register === r.v ? 'is-active' : ''}`}
          onClick={() => setRegister(register === r.v ? null : r.v)}
          data-testid={`prospects-filter-${r.v}`}
        >{r.l}</button>
      ))}
      {TIERS.map((t) => (
        <button
          key={t.v}
          type="button"
          className={`cr-chip cr-chip--teal ${tier === t.v ? 'is-active' : ''}`}
          onClick={() => setTier(tier === t.v ? null : t.v)}
          data-testid={`prospects-filter-${t.v}`}
        >{t.l}</button>
      ))}
      {(q || register || tier) && (
        <button type="button" className="cr-chip cr-chip--reset" onClick={() => { setQ(''); setRegister(null); setTier(null); }}>
          <X size={13} /> Reset
        </button>
      )}
    </>
  );

  return (
    <ClientRelationsLayout
      stage="prospect"
      eyebrow="CLIENT RELATIONS™ · CULTIVATION"
      title="Prospects"
      lede="Relazioni in movimento. Qui il dialogo è iniziato: continua l'intervista, condividi una moodboard, suggerisci il prossimo passo. Quando il momento è giusto, promuovi ad Account."
      counts={counts}
      toolbar={toolbar}
    >
      <p className="cr-resultbar" data-testid="prospects-resultbar">
        <strong>{total}</strong> relationship{total === 1 ? '' : 's'} in cultivation
      </p>

      {loading && (
        <div className="prospect-stack" data-testid="prospects-loading">
          {[1,2,3].map(i => <div key={i} className="prospect-lane prospect-lane--skeleton" />)}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="cr-empty" data-testid="prospects-empty">
          <p className="cr-empty__title">Nessuna relazione in coltivazione.</p>
          <p className="cr-empty__sub">Promuovi un lead da Leads per iniziare la conversazione.</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="prospect-stack" data-testid="prospects-stack">
          {items.map((p) => (
            <ProspectLane
              key={p.id}
              p={p}
              designer={pickDesigner(p.id)}
              onPromote={handlePromote}
              onOpen={handleOpen}
            />
          ))}
        </div>
      )}

      <WelcomeDrawer
        subjectId={welcomeId}
        open={Boolean(welcomeId)}
        onClose={() => setWelcomeId(null)}
        onAction={handleWelcomeAction}
      />
      <ContinuationInterviewDrawer
        open={Boolean(interviewLead)}
        lead={interviewLead}
        tenantSlug="mood-demo-studio-81a09e"
        onClose={() => setInterviewLead(null)}
        onCompleted={() => setInterviewLead(null)}
      />
    </ClientRelationsLayout>
  );
};

export default ProspectsPage;
