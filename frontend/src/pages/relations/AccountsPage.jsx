/**
 * AccountsPage · ACTIVE STUDIO layer.
 *
 * Visual intent: active project ecosystems. Each account is a wide
 * portrait card with: project status ring, mini moodboard preview row,
 * counts of moodboards / proposals / approvals, last touch.
 *
 * Warm gold accent (#D6B48A). Operator/Studio surface (NOT client-facing).
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, X, BookOpen, CheckCircle2, RotateCcw, Compass } from 'lucide-react';
import ClientRelationsLayout from './ClientRelationsLayout';
import useRelations from './useRelations';
import useDesigners from './useDesigners';
import DesignerChip from './DesignerChip';
import WelcomeDrawer from './WelcomeDrawer';
import ConvertToCustomerModal from '../../components/relations/ConvertToCustomerModal';
import RevertToProspectModal from '../../components/relations/RevertToProspectModal';
import { useNewRelationship } from '../../hooks/useNewRelationship';

const HEALTHS = [
  { v: 'thriving', l: 'Thriving' },
  { v: 'stable',   l: 'Stable'   },
  { v: 'at_risk',  l: 'At risk'  },
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

const stageLabel = (s) => {
  if (!s) return 'discovery';
  return String(s).replace(/_/g, ' ');
};

// Tiny deterministic palette swatches derived from id — Atelier Warm Cinematic™
// (visual variety until real moodboard previews are wired in Sprint B).
const swatchesFor = (id, atmospheres = []) => {
  // Pure warm/espresso/bronze/sage tones — no cold blue, no electric teal.
  const palette = ['#D6B48A', '#00B0A0', '#7A5530', '#A38B6E', '#2A1F18', '#3E322A'];
  const seed = String(id || '').replace(/-/g, '').slice(0, 6);
  return [0,1,2,3].map((i) => {
    const c = parseInt(seed.charAt(i) || '0', 16) || i;
    return palette[c % palette.length];
  });
};

const isProspectStage = (s) =>
  ['prospect', 'in_proposal', 'new_inquiry', 'lead', 'discovery', 'conversation_open'].includes(String(s || '').toLowerCase());
const isCustomerStage = (s) =>
  ['customer', 'active_project', 'existing_client', 'repeat_client'].includes(String(s || '').toLowerCase());

const AccountCard = ({ a, designer, onOpen, onConvert, onRevert, onNewJourney }) => {
  const name = a.account_name || a.email || 'Account';
  const initials = name.split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const score = Math.max(0, Math.min(100, Math.round(Number(a.relationship_score || 0))));
  const ringDeg = (score / 100) * 360;
  const swatches = swatchesFor(a.id);
  const health = a.relationship_health || 'stable';
  const usedIn = a.used_in || { moodboards: 0, proposals: 0, memories: 0 };

  // Relationship-centric narrative line — NOT a task counter.
  const tone =
    score >= 80 ? 'the relationship is in full conversation' :
    score >= 55 ? 'the dialogue is settling into rhythm' :
    score >= 30 ? 'the studio is listening closely' :
                  'the relationship is just opening';

  return (
    <article
      className="account-card"
      data-testid={`account-card-${a.id}`}
      onClick={() => onOpen && onOpen(a)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' && onOpen) onOpen(a); }}
    >
      <header className="account-card__head">
        <div className="account-card__monogram-wrap">
          <span
            className="account-card__ring"
            style={{ background: `conic-gradient(var(--cr-gold) ${ringDeg}deg, rgba(255,255,255,0.06) 0deg)` }}
            aria-hidden="true"
          />
          <span className="account-card__monogram">{initials || '·'}</span>
        </div>
        <div className="account-card__who">
          <h3 className="account-card__name">{name}</h3>
          <p className="account-card__type">
            {(a.account_type || 'private').replace(/_/g, ' ')} · {(a.locale_code || a.language || 'it').toUpperCase()}
          </p>
          <p className="account-card__stage" data-testid={`account-stage-${a.id}`}>
            <span className={`account-card__health account-card__health--${health}`} aria-hidden="true" />
            {stageLabel(a.relationship_journey_stage || a.lifecycle_stage)}
          </p>
        </div>
      </header>

      <div className="account-card__tone" data-testid={`account-tone-${a.id}`}>
        <span className="account-card__tone-eyebrow">Where we are</span>
        <p className="account-card__tone-line">{tone}</p>
      </div>

      <div className="account-card__moodstrip" aria-label="Moodboard palette" data-testid={`account-mood-${a.id}`}>
        {swatches.map((c, i) => (
          <span key={i} className="account-card__swatch" style={{ background: c }} />
        ))}
        <span className="account-card__moodlabel">studio palette</span>
      </div>

      <div className="account-card__usedin" data-testid={`account-usedin-${a.id}`} aria-label="Used in this relationship">
        <span className="account-card__usedin-eyebrow">Used in this relationship</span>
        <ul className="account-card__usedin-list">
          <li className="account-card__usedin-item" data-testid={`account-usedin-moodboards-${a.id}`}>
            <strong>{usedIn.moodboards}</strong>
            <span>moodboard{usedIn.moodboards === 1 ? '' : 's'}</span>
          </li>
          <li className="account-card__usedin-divider" aria-hidden="true">·</li>
          <li className="account-card__usedin-item" data-testid={`account-usedin-proposals-${a.id}`}>
            <strong>{usedIn.proposals}</strong>
            <span>proposal{usedIn.proposals === 1 ? '' : 's'}</span>
          </li>
          <li className="account-card__usedin-divider" aria-hidden="true">·</li>
          <li className="account-card__usedin-item" data-testid={`account-usedin-memories-${a.id}`}>
            <strong>{usedIn.memories}</strong>
            <span>memor{usedIn.memories === 1 ? 'y' : 'ies'}</span>
          </li>
        </ul>
      </div>

      <footer className="account-card__meta">
        <DesignerChip designer={designer} size="sm" contextId={`account-${a.id}`} />
        <span className="account-card__meta-spacer" />
        <span>last conversation <strong>{formatAgo(a.last_activity_at)} ago</strong></span>
        <Link
          to={`/relations/memory/${a.id}`}
          className="account-card__memory-link"
          onClick={(e) => e.stopPropagation()}
          data-testid={`account-memory-link-${a.id}`}
          aria-label="Open the relationship's memory"
        >
          <BookOpen size={14} strokeWidth={1.6} /> memory
        </Link>
      </footer>

      {/* ITER185.P1 · Lifecycle CTAs (Convert / Revert) */}
      <div
        className="account-card__lifecycle"
        onClick={(e) => e.stopPropagation()}
        style={{
          marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', gap: 8, justifyContent: 'flex-end',
        }}
      >
        {isProspectStage(a.lifecycle_stage) && (
          <button
            type="button"
            onClick={() => onConvert?.(a)}
            data-testid={`account-convert-customer-${a.id}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', fontSize: 11, letterSpacing: '0.02em',
              background: 'transparent', color: '#D6B48A',
              border: '1px solid rgba(214, 180, 138, 0.4)', borderRadius: 6,
              cursor: 'pointer', transition: 'all 160ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(214, 180, 138, 0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <CheckCircle2 size={12} /> Conferma cliente
          </button>
        )}
        {isCustomerStage(a.lifecycle_stage) && (
          <>
            <button
              type="button"
              onClick={() => onNewJourney?.(a)}
              data-testid={`account-new-journey-${a.id}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', fontSize: 11, letterSpacing: '0.02em',
                background: '#0c0e12', color: '#ffffff',
                border: '1px solid #0c0e12', borderRadius: 6,
                cursor: 'pointer', transition: 'all 160ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#1f2530'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#0c0e12'; }}
            >
              <Compass size={12} /> Nuovo Design Journey
            </button>
            <button
              type="button"
              onClick={() => onRevert?.(a)}
              data-testid={`account-revert-prospect-${a.id}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', fontSize: 11, letterSpacing: '0.02em',
                background: 'transparent', color: '#9b9da3',
                border: '1px solid rgba(155, 157, 163, 0.3)', borderRadius: 6,
                cursor: 'pointer', transition: 'all 160ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(155, 157, 163, 0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <RotateCcw size={12} /> Rollback prospect
            </button>
          </>
        )}
      </div>
    </article>
  );
};

const AccountsPage = () => {
  const [q, setQ] = useState('');
  const [health, setHealth] = useState(null);
  const filters = useMemo(() => ({ q, health }), [q, health]);
  const { items, total, counts, loading, refresh } = useRelations('/api/relations/accounts', filters);
  const { pickDesigner } = useDesigners();
  const newRel = useNewRelationship();

  const [welcomeId, setWelcomeId] = useState(null);
  const [convertAccount, setConvertAccount] = useState(null);
  const [revertAccount, setRevertAccount]   = useState(null);
  const handleOpen = (a) => setWelcomeId(a.id);
  const handleWelcomeAction = () => setWelcomeId(null);
  const handleLifecycleUpdated = () => { if (typeof refresh === 'function') refresh(); };

  // ITER186.A · P0.6 — "Nuovo Design Journey" inline CTA su Customer cards
  const handleNewJourney = (account) => {
    if (newRel && typeof newRel.open === 'function') {
      newRel.open({ choice: 'customer', account_id: account.id });
    }
  };

  const toolbar = (
    <>
      <div className="cr-search">
        <Search size={16} />
        <input
          type="search"
          placeholder="Cerca account…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          data-testid="accounts-search"
        />
      </div>
      {HEALTHS.map((h) => (
        <button
          key={h.v}
          type="button"
          className={`cr-chip cr-chip--gold ${health === h.v ? 'is-active' : ''}`}
          onClick={() => setHealth(health === h.v ? null : h.v)}
          data-testid={`accounts-filter-${h.v}`}
        >{h.l}</button>
      ))}
      {(q || health) && (
        <button type="button" className="cr-chip cr-chip--reset" onClick={() => { setQ(''); setHealth(null); }}>
          <X size={13} /> Reset
        </button>
      )}
    </>
  );

  return (
    <ClientRelationsLayout
      stage="account"
      eyebrow="CLIENT RELATIONS™ · ACTIVE STUDIO"
      title="Accounts"
      lede="Progetti vivi. Ogni account è un ecosistema in movimento — moodboard, proposte, approvazioni, conversazioni. La memoria del progetto vive qui."
      counts={counts}
      toolbar={toolbar}
    >
      <p className="cr-resultbar" data-testid="accounts-resultbar">
        <strong>{total}</strong> active studio relationship{total === 1 ? '' : 's'}
      </p>

      {loading && (
        <div className="account-grid" data-testid="accounts-loading">
          {[1,2,3,4].map(i => <div key={i} className="account-card account-card--skeleton" />)}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div
          className="cr-empty"
          data-testid="accounts-empty"
          style={{ textAlign: 'center', padding: '48px 24px' }}
        >
          <p className="cr-empty__title" style={{ fontSize: 18, fontWeight: 600, color: '#0c0e12', marginBottom: 8 }}>
            Nessun account attivo.
          </p>
          <p
            className="cr-empty__sub"
            data-testid="accounts-empty-sub"
            style={{ fontSize: 13, color: '#5a5d63', marginBottom: 20, maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}
          >
            Un account nasce quando un Prospect viene qualificato (75% Discovery).
            Da qui apri una Design Journey o conferma il cliente con una proposta firmata.
          </p>
          <Link
            to="/relations/prospects"
            data-testid="accounts-empty-cta"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 18px', fontSize: 13, fontWeight: 500,
              color: '#ffffff', background: '#0c0e12', border: 0,
              borderRadius: 8, textDecoration: 'none',
            }}
          >
            Vai ai Prospects da convertire
          </Link>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="account-grid" data-testid="accounts-grid">
          {items.map((a) => (
            <AccountCard
              key={a.id}
              a={a}
              designer={pickDesigner(a.id)}
              onOpen={handleOpen}
              onConvert={setConvertAccount}
              onRevert={setRevertAccount}
              onNewJourney={handleNewJourney}
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

      <ConvertToCustomerModal
        open={Boolean(convertAccount)}
        account={convertAccount}
        onClose={() => setConvertAccount(null)}
        onConverted={handleLifecycleUpdated}
      />
      <RevertToProspectModal
        open={Boolean(revertAccount)}
        account={revertAccount}
        onClose={() => setRevertAccount(null)}
        onReverted={handleLifecycleUpdated}
      />
    </ClientRelationsLayout>
  );
};

export default AccountsPage;
