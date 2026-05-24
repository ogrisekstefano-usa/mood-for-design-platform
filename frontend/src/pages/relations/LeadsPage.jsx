/**
 * LeadsPage · DISCOVERY layer.
 *
 * Visual intent: signals appearing on the studio — atmospheric, distant,
 * editorial. Each lead is an atmosphere + a material + a moment, NOT a
 * sales record. Cards are large, sparse, hushed. No CTAs, no progression
 * pressure. The reader is "listening".
 */
import React, { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import ClientRelationsLayout from './ClientRelationsLayout';
import useRelations from './useRelations';
import useDesigners from './useDesigners';
import DesignerChip from './DesignerChip';
import WelcomeDrawer from './WelcomeDrawer';
import ContinuationInterviewDrawer from './ContinuationInterviewDrawer';

const ATMOSPHERES = [
  { v: 'warm_editorial',       l: 'Warm editorial'       },
  { v: 'nordic_silence',       l: 'Nordic silence'       },
  { v: 'midnight_mood',        l: 'Midnight mood'        },
  { v: 'mediterranean_light',  l: 'Mediterranean light'  },
  { v: 'architectural_dawn',   l: 'Architectural dawn'   },
];

const formatAgo = (iso) => {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m || 1}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return `${Math.floor(d / 30)}mo`;
};

const tempLabel = (t) => {
  const v = Number(t || 0);
  if (v >= 0.85) return 'Warm · ready';
  if (v >= 0.65) return 'Engaged';
  if (v >= 0.40) return 'Curious';
  if (v >= 0.20) return 'Early';
  return 'First contact';
};

const LeadCard = ({ lead, designer, onOpen }) => {
  const name = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.email || 'Anonymous';
  const initials = name.split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const atmos    = Array.isArray(lead.atmosphere_signals) ? lead.atmosphere_signals : [];
  const materials= Array.isArray(lead.material_signals)   ? lead.material_signals   : [];
  const tags     = Array.isArray(lead.behavioral_tags)    ? lead.behavioral_tags    : [];
  const temp     = Number(lead.relationship_temperature || 0);

  // Hero atmosphere — the signal that defines this lead.
  const hero = atmos[0] || (tags.find(t => t.endsWith('_register')) || '').replace(/_register$/, '') || 'silent_signal';

  return (
    <article
      className="lead-card"
      data-testid={`lead-card-${lead.id}`}
      onClick={() => onOpen && onOpen(lead)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' && onOpen) onOpen(lead); }}
    >
      <div className="lead-card__rule" />

      <header className="lead-card__head">
        <span className="lead-card__monogram" aria-hidden="true">{initials || '·'}</span>
        <div className="lead-card__who">
          <h3 className="lead-card__name">{name}</h3>
          {lead.email && <div className="lead-card__email">{lead.email}</div>}
        </div>
        <div className="lead-card__when">
          <span className="lead-card__when-label">signal</span>
          <span className="lead-card__when-value">{formatAgo(lead.updated_at || lead.created_at)} ago</span>
        </div>
      </header>

      <div className="lead-card__hero">
        <span className="lead-card__hero-eyebrow">Atmosphere</span>
        <h4 className="lead-card__hero-title">
          {String(hero).replace(/_/g, ' ')}
        </h4>
        <p className="lead-card__hero-temp">
          <span className="lead-card__hero-dot" style={{ opacity: Math.max(0.25, temp) }} />
          {tempLabel(temp)} · {(lead.lead_type || 'private').replace(/_/g, ' ')} · {(lead.locale_code || 'it').toUpperCase()}
        </p>
      </div>

      {(materials.length > 0 || tags.length > 0) && (
        <ul className="lead-card__signals">
          {materials.slice(0, 3).map((m, i) => (
            <li key={`m${i}`} className="lead-card__sig lead-card__sig--material">
              · {String(m).replace(/_/g, ' ')}
            </li>
          ))}
          {tags.filter(t => t.endsWith('_register')).slice(0, 2).map((t, i) => (
            <li key={`r${i}`} className="lead-card__sig lead-card__sig--register">
              · {String(t).replace(/_register$/, '').replace(/_/g, ' ')} register
            </li>
          ))}
        </ul>
      )}

      <footer className="lead-card__meta">
        <DesignerChip designer={designer} size="sm" testid={`lead-designer-${lead.id}`} />
        <span className="lead-card__meta-spacer" />
        <span className="lead-card__meta-status">
          {lead.intake_completed_at ? 'intake captured' : 'awaiting first interview'}
        </span>
      </footer>
    </article>
  );
};

const LeadsPage = () => {
  const [q, setQ] = useState('');
  const [atmosphere, setAtmosphere] = useState(null);
  const filters = useMemo(() => ({ q, atmosphere }), [q, atmosphere]);
  const { items, total, counts, loading } = useRelations('/api/relations/leads', filters);
  const { pickDesigner } = useDesigners();

  // Drawer state — Welcome + Continuation Interview.
  const [welcomeId, setWelcomeId] = useState(null);
  const [interviewLead, setInterviewLead] = useState(null);

  const handleOpen = (lead) => setWelcomeId(lead.id);
  const handleWelcomeAction = (moment, lead) => {
    if (moment.kind === 'continuation_interview') {
      setInterviewLead(lead);
      setWelcomeId(null);
    } else if (moment.kind === 'promote_account') {
      // For Leads, we close the drawer — promote handled in Prospects.
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
          placeholder="Cerca per nome o email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          data-testid="leads-search"
        />
      </div>
      {ATMOSPHERES.map((a) => (
        <button
          key={a.v}
          type="button"
          className={`cr-chip cr-chip--slate ${atmosphere === a.v ? 'is-active' : ''}`}
          onClick={() => setAtmosphere(atmosphere === a.v ? null : a.v)}
          data-testid={`leads-filter-${a.v}`}
        >{a.l}</button>
      ))}
      {(q || atmosphere) && (
        <button type="button" className="cr-chip cr-chip--reset" onClick={() => { setQ(''); setAtmosphere(null); }} data-testid="leads-reset">
          <X size={13} /> Reset
        </button>
      )}
    </>
  );

  return (
    <ClientRelationsLayout
      stage="lead"
      eyebrow="CLIENT RELATIONS™ · DISCOVERY"
      title="Leads"
      lede="Segnali appena arrivati nello studio. Atmosfere, materiali, registri — non record commerciali. Ascolta prima di rispondere."
      counts={counts}
      toolbar={toolbar}
    >
      <p className="cr-resultbar" data-testid="leads-resultbar">
        <strong>{total}</strong> signal{total === 1 ? '' : 's'} listening
      </p>

      {loading && (
        <div className="lead-grid" data-testid="leads-loading">
          {[1,2,3,4].map(i => <div key={i} className="lead-card lead-card--skeleton" />)}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="cr-empty" data-testid="leads-empty">
          <p className="cr-empty__title">Nessun segnale, per ora.</p>
          <p className="cr-empty__sub">I nuovi lead appariranno qui dal Begin&nbsp;Journey™ pubblico.</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="lead-grid" data-testid="leads-grid">
          {items.map((it) => (
            <LeadCard
              key={it.id}
              lead={it}
              designer={pickDesigner(it.id)}
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

export default LeadsPage;
