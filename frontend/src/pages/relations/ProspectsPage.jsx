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
import { Link, useNavigate } from 'react-router-dom';
import { Search, X, ArrowRight, MessageCircle, Heart, Repeat, ExternalLink } from 'lucide-react';
import ClientRelationsLayout from './ClientRelationsLayout';
import useRelations from './useRelations';
import useDesigners from './useDesigners';
import DesignerChip from './DesignerChip';
import WelcomeDrawer from './WelcomeDrawer';
import ContinuationInterviewDrawer from './ContinuationInterviewDrawer';
import { useT } from '../../i18n/useT';

const REGISTER_VALUES = ['editorial', 'concierge', 'consultative', 'discovery'];
const TIER_VALUES = ['atelier', 'couture', 'pret_a_porter'];

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
  const returns = tags.filter(tag => tag.includes('returning') || tag.includes('high_engagement')).length + 1;
  // Last interview answered approx — when did intake complete.
  const lastTouch = lead.intake_completed_at || lead.updated_at || lead.created_at;
  return { saved, returns, lastTouch };
};

const ProspectLane = ({ p, designer, onOpen, onNavigate }) => {
  const { t } = useT();
  const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email || t('clientRelations.prospects.card.fallback');
  const initials = name.split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const temp = Number(p.relationship_temperature || 0);
  const score = Number(p.progression_score || 0);
  const ready = temp >= 0.75 || score >= 0.80;
  const { saved, returns, lastTouch } = deriveSignals(p);
  const register = p.cultural_register || 'discovery';
  const tier = (p.luxury_perception_tier || '').replace(/_/g, ' ') || '—';
  const hasJourney = Boolean(p.journey_project_id || p.journey_id);

  // Journey lifecycle label
  const journeyStateLabel = {
    conversation_open: 'Journey · In corso',
    moodboard_phase: 'Journey · Moodboard',
    concept_phase: 'Journey · Concept',
    proposal_phase: 'Journey · Proposta',
    closed: 'Journey · Chiuso',
  }[p.journey_lifecycle_state] || (p.journey_lifecycle_state ? `Journey · ${p.journey_lifecycle_state}` : null);

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
        {journeyStateLabel && (
          <p className="prospect-lane__journey-state" data-testid={`prospect-journey-state-${p.id}`}
             style={{ fontSize: 11, color: '#0d9488', fontWeight: 600, letterSpacing: '0.04em', marginTop: 4 }}>
            {journeyStateLabel}
          </p>
        )}
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
            <span><strong>{saved}</strong> {t('clientRelations.prospects.card.savedInspirations')}</span>
          </span>
          <span className="prospect-metric">
            <Repeat size={15} strokeWidth={1.6} />
            <span><strong>{returns}</strong> {returns === 1 ? t('clientRelations.prospects.card.returns_one') : t('clientRelations.prospects.card.returns_many')}</span>
          </span>
        </div>
        <div className="prospect-lane__last-touch">
          <MessageCircle size={14} strokeWidth={1.6} />
          {lastTouch
            ? <>{t('clientRelations.prospects.card.lastInterviewLabel')} <strong>{formatAgo(lastTouch)} {t('common.time.ago')}</strong></>
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
          className={`prospect-lane__cta ${ready || hasJourney ? 'is-ready' : ''}`}
          onClick={() => onNavigate(p)}
          data-testid={`prospect-open-${p.id}`}
        >
          {hasJourney
            ? <><ExternalLink size={14} strokeWidth={2} /> Apri Journey</>
            : ready
              ? <>{t('clientRelations.prospects.card.promoteCta')} <ArrowRight size={15} strokeWidth={2} /></>
              : <>{t('clientRelations.prospects.card.continueCta')} <ArrowRight size={15} strokeWidth={2} /></>
          }
        </button>
      </div>
    </article>
  );
};

const ProspectsPage = () => {
  const { t } = useT();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [register, setRegister] = useState(null);
  const [tier, setTier] = useState(null);
  const filters = useMemo(() => ({ q, cultural_register: register, budget_tier: tier }), [q, register, tier]);
  const { items, total, counts, loading } = useRelations('/api/relations/prospects', filters);
  const { pickDesigner } = useDesigners();

  // Drawers (Sprint C)
  const [welcomeId, setWelcomeId] = useState(null);
  const [interviewLead, setInterviewLead] = useState(null);

  // Journey = Source of Truth: navigate to journey workspace or account detail
  const handleNavigate = (p) => {
    if (p.journey_project_id) {
      navigate(`/workspace/projects/${p.journey_project_id}`);
    } else if (p.journey_id) {
      navigate(`/workspace/projects?journey=${p.journey_id}`);
    } else {
      // No journey yet: open the account detail/welcome drawer
      setWelcomeId(p.id);
    }
  };
  const handleOpen = (p) => setWelcomeId(p.id);

  const toolbar = (
    <>
      <div className="cr-search">
        <Search size={16} />
        <input
          type="search"
          placeholder={t('clientRelations.prospects.searchPlaceholder')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          data-testid="prospects-search"
        />
      </div>
      {REGISTER_VALUES.map((rv) => (
        <button
          key={rv}
          type="button"
          className={`cr-chip cr-chip--teal ${register === rv ? 'is-active' : ''}`}
          onClick={() => setRegister(register === rv ? null : rv)}
          data-testid={`prospects-filter-${rv}`}
        >{t(`clientRelations.register.${rv}`)}</button>
      ))}
      {TIER_VALUES.map((tv) => (
        <button
          key={tv}
          type="button"
          className={`cr-chip cr-chip--teal ${tier === tv ? 'is-active' : ''}`}
          onClick={() => setTier(tier === tv ? null : tv)}
          data-testid={`prospects-filter-${tv}`}
        >{t(`clientRelations.tier.${tv}`)}</button>
      ))}
      {(q || register || tier) && (
        <button type="button" className="cr-chip cr-chip--reset" onClick={() => { setQ(''); setRegister(null); setTier(null); }}>
          <X size={13} /> {t('common.reset')}
        </button>
      )}
    </>
  );

  return (
    <ClientRelationsLayout
      stage="prospect"
      eyebrow="CLIENT RELATIONS™ · CULTIVATION"
      title={t('nav.client_relations_prospects')}
      lede="Relazioni in movimento. Qui il dialogo è iniziato: continua l'intervista, condividi una moodboard, suggerisci il prossimo passo. Quando il momento è giusto, promuovi ad Account."
      counts={counts}
      toolbar={toolbar}
    >
      <p className="cr-resultbar" data-testid="prospects-resultbar">
        <strong>{total}</strong> {total === 1 ? t('clientRelations.prospects.resultbar_one') : t('clientRelations.prospects.resultbar_many')}
      </p>

      {loading && (
        <div className="prospect-stack" data-testid="prospects-loading">
          {[1,2,3].map(i => <div key={i} className="prospect-lane prospect-lane--skeleton" />)}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div
          className="cr-empty"
          data-testid="prospects-empty"
          style={{ textAlign: 'center', padding: '48px 24px' }}
        >
          <p className="cr-empty__title" style={{ fontSize: 18, fontWeight: 600, color: '#0c0e12', marginBottom: 8 }}>
            {t('clientRelations.prospects.emptyTitle')}
          </p>
          <p
            className="cr-empty__sub"
            data-testid="prospects-empty-sub"
            style={{ fontSize: 13, color: '#5a5d63', marginBottom: 20, maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}
          >
            Un Prospect è un Account in fase di avanzamento verso la commessa.
            Viene creato automaticamente quando un Lead completa la Discovery.
            Clicca "Apri Journey" per accedere al workspace del Design Journey collegato.
          </p>
          <Link
            to="/relations/leads"
            data-testid="prospects-empty-cta"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 18px', fontSize: 13, fontWeight: 500,
              color: '#ffffff', background: '#0c0e12', border: 0,
              borderRadius: 8, textDecoration: 'none',
            }}
          >
            <ArrowRight size={14} strokeWidth={2} /> {t('clientRelations.prospects.emptyCta')}
          </Link>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="prospect-stack" data-testid="prospects-stack">
          {items.map((p) => (
            <ProspectLane
              key={p.id}
              p={p}
              designer={pickDesigner(p.id)}
              onNavigate={handleNavigate}
              onOpen={handleOpen}
            />
          ))}
        </div>
      )}

      <WelcomeDrawer
        subjectId={welcomeId}
        open={Boolean(welcomeId)}
        onClose={() => setWelcomeId(null)}
        onAction={(_moment) => setWelcomeId(null)}
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
