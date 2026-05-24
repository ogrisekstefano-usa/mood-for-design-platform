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
import { Search, Layers, FileSignature, CheckCircle2, X } from 'lucide-react';
import ClientRelationsLayout from './ClientRelationsLayout';
import useRelations from './useRelations';

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

// Tiny deterministic palette swatches derived from id (visual variety until
// real moodboard previews are wired in Sprint B).
const swatchesFor = (id, atmospheres = []) => {
  const palette = ['#D6B48A', '#00C9B3', '#3F5F88', '#A38B6E', '#1F2A40', '#7C9BAE'];
  const seed = String(id || '').replace(/-/g, '').slice(0, 6);
  return [0,1,2,3].map((i) => {
    const c = parseInt(seed.charAt(i) || '0', 16) || i;
    return palette[c % palette.length];
  });
};

const AccountCard = ({ a }) => {
  const name = a.account_name || a.email || 'Account';
  const initials = name.split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const score = Math.max(0, Math.min(100, Math.round(Number(a.relationship_score || 0))));
  const ringDeg = (score / 100) * 360;
  // For ITER148 P0 we surface placeholder counts; Sprint B/D wires the
  // real moodboard/proposal/approval aggregates.
  const moodboards = a.__moodboards_count ?? '—';
  const proposals  = a.__proposals_count  ?? '—';
  const approvals  = a.__approvals_pending ?? '—';
  const swatches = swatchesFor(a.id);
  const health = a.relationship_health || 'stable';

  return (
    <article className="account-card" data-testid={`account-card-${a.id}`}>
      <header className="account-card__head">
        <div className="account-card__monogram-wrap">
          <span
            className="account-card__ring"
            style={{ background: `conic-gradient(var(--cr-gold) ${ringDeg}deg, rgba(255,255,255,0.08) 0deg)` }}
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
        <div className="account-card__score">
          <span className="account-card__score-value">{score}</span>
          <span className="account-card__score-label">relationship</span>
        </div>
      </header>

      <div className="account-card__moodstrip" aria-label="Moodboard palette" data-testid={`account-mood-${a.id}`}>
        {swatches.map((c, i) => (
          <span key={i} className="account-card__swatch" style={{ background: c }} />
        ))}
        <span className="account-card__moodlabel">live moodboard palette</span>
      </div>

      <ul className="account-card__metrics">
        <li>
          <Layers size={16} strokeWidth={1.6} />
          <span><strong>{moodboards}</strong> moodboards</span>
        </li>
        <li>
          <FileSignature size={16} strokeWidth={1.6} />
          <span><strong>{proposals}</strong> proposals</span>
        </li>
        <li>
          <CheckCircle2 size={16} strokeWidth={1.6} />
          <span><strong>{approvals}</strong> approvals pending</span>
        </li>
      </ul>

      <footer className="account-card__meta">
        <span>last touch <strong>{formatAgo(a.last_activity_at)} ago</strong></span>
        <span>·</span>
        <span>{a.next_followup_at ? `next ${formatAgo(a.next_followup_at)} ahead` : 'no follow-up scheduled'}</span>
      </footer>
    </article>
  );
};

const AccountsPage = () => {
  const [q, setQ] = useState('');
  const [health, setHealth] = useState(null);
  const filters = useMemo(() => ({ q, health }), [q, health]);
  const { items, total, counts, loading } = useRelations('/api/relations/accounts', filters);

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
        <div className="cr-empty" data-testid="accounts-empty">
          <p className="cr-empty__title">Nessun progetto attivo.</p>
          <p className="cr-empty__sub">Un account nasce quando un prospect viene promosso con un Design&nbsp;Journey™.</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="account-grid" data-testid="accounts-grid">
          {items.map((a) => <AccountCard key={a.id} a={a} />)}
        </div>
      )}
    </ClientRelationsLayout>
  );
};

export default AccountsPage;
