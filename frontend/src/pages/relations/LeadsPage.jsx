/**
 * LeadsPage · CRM Discovery — record commerciali da qualificare.
 *
 * ITER181.C · Governance Fix:
 *   - copy operativa (no "segnali" / "atmosfere" / poetic register)
 *   - rimossi i filtri tag fake (atmospheres)
 *   - aggiunta CTA primary "+ Nuovo Lead" che apre il modal CRM
 */
import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, X, Plus, BookOpen } from 'lucide-react';
import ClientRelationsLayout from './ClientRelationsLayout';
import useRelations from './useRelations';
import useDesigners from './useDesigners';
import DesignerChip from './DesignerChip';
import WelcomeDrawer from './WelcomeDrawer';
import ContinuationInterviewDrawer from './ContinuationInterviewDrawer';
import { useNewRelationship } from '../../hooks/useNewRelationship';

const ATMOSPHERES = []; // ITER181.C: filtri fake rimossi (nessun filtro reale dietro)

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

      {/* Origin source + emotional keywords — discrete metadata row */}
      <div className="lead-card__origin" data-testid={`lead-origin-${lead.id}`}>
        <span className="lead-card__origin-source">
          {(lead.source_channel || lead.origin_source || 'studio inbound').replace(/_/g, ' ')}
        </span>
        {Array.isArray(lead.emotional_keywords) && lead.emotional_keywords.length > 0 && (
          <span className="lead-card__origin-keywords">
            {lead.emotional_keywords.slice(0, 3).map(k => String(k).replace(/_/g, ' ')).join(' · ')}
          </span>
        )}
      </div>

      <footer className="lead-card__meta">
        <DesignerChip designer={designer} size="sm" contextId={`lead-${lead.id}`} />
        <span className="lead-card__meta-spacer" />
        <span className="lead-card__meta-status">
          {lead.intake_completed_at ? 'intake captured' : 'awaiting first interview'}
        </span>
        <Link
          to={`/relations/memory/${lead.id}`}
          className="lead-card__memory-link"
          onClick={(e) => e.stopPropagation()}
          data-testid={`lead-memory-link-${lead.id}`}
          aria-label="Open the relationship's memory"
        >
          <BookOpen size={14} strokeWidth={1.6} /> memory
        </Link>
      </footer>
    </article>
  );
};

const LeadsPage = () => {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const filters = useMemo(() => ({ q }), [q]);
  const { items, total, counts, loading } = useRelations('/api/relations/leads', filters);
  const { pickDesigner } = useDesigners();
  const newRel = useNewRelationship();

  // Drawer state — Welcome + Continuation Interview.
  const [welcomeId, setWelcomeId] = useState(null);
  const [interviewLead, setInterviewLead] = useState(null);

  // ITER186.A · P0.2 — clicking a Lead card navigates to LeadDetailPage
  // so the user can immediately resume Discovery. (Welcome drawer remains
  // available via secondary affordances, but the primary path is now detail.)
  const handleOpen = (lead) => navigate(`/relations/leads/${lead.id}`);
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

  const handleNewLead = () => {
    if (newRel && typeof newRel.open === 'function') {
      newRel.open({ choice: 'lead' });
    }
  };

  const toolbar = (
    <>
      <button
        type="button"
        className="cr-chip cr-chip--primary"
        data-testid="leads-new-cta"
        onClick={handleNewLead}
      >
        <Plus size={13} strokeWidth={1.8} /> Nuovo Lead
      </button>
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
      {q && (
        <button type="button" className="cr-chip cr-chip--reset" onClick={() => setQ('')} data-testid="leads-reset">
          <X size={13} /> Reset
        </button>
      )}
    </>
  );

  return (
    <ClientRelationsLayout
      stage="lead"
      eyebrow="CRM · DISCOVERY"
      title="Leads"
      lede="Contatti da qualificare. I Lead rappresentano persone o aziende che hanno manifestato un interesse verso lo studio, un progetto o un servizio. Registra, organizza e qualifica ogni contatto prima di trasformarlo in Prospect."
      counts={counts}
      toolbar={toolbar}
    >
      <p className="cr-resultbar" data-testid="leads-resultbar">
        <strong>{total}</strong> Lead {total === 1 ? 'registrato' : 'registrati'}
      </p>

      {loading && (
        <div className="lead-grid" data-testid="leads-loading">
          {[1,2,3,4].map(i => <div key={i} className="lead-card lead-card--skeleton" />)}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div
          className="cr-empty"
          data-testid="leads-empty"
          style={{ textAlign: 'center', padding: '48px 24px' }}
        >
          <p className="cr-empty__title" style={{ fontSize: 18, fontWeight: 600, color: '#0c0e12', marginBottom: 8 }}>
            Nessun Lead registrato.
          </p>
          <p
            className="cr-empty__sub"
            data-testid="leads-empty-sub"
            style={{ fontSize: 13, color: '#5a5d63', marginBottom: 20, maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}
          >
            Un Lead è un contatto che ha manifestato interesse verso lo studio.
            Fast Capture in &lt;30 secondi: nome + email o telefono. Da qui parte
            la Discovery e la qualifica a Prospect.
          </p>
          <button
            type="button"
            data-testid="leads-empty-cta"
            onClick={handleNewLead}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 18px', fontSize: 13, fontWeight: 500,
              color: '#ffffff', background: '#0c0e12', border: 0,
              borderRadius: 8, cursor: 'pointer',
            }}
          >
            <Plus size={14} strokeWidth={2} /> Crea il primo Lead
          </button>
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
