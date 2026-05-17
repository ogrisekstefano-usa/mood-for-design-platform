/**
 * RelationshipsPage — Phase R-CRM-1
 *
 * `/workspace/relationships` — the lightweight Relationship OS.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │  PAGE HEADER — title + view toggle + + New Relationship         │
 *   ├──────────┬──────────────────────────────────────────────────────┤
 *   │ SIDEBAR  │  TABLE  /  KANBAN  view                              │
 *   │ filters  │  Account rows or pipeline columns                    │
 *   └──────────┴──────────────────────────────────────────────────────┘
 *   Click an account row → AccountDetailDrawer (right-side panel) with
 *   four tabs: Overview · Contacts · Timeline · Actions.
 *
 * Editorial register, NOT enterprise CRM. Soft borders, generous spacing,
 * uppercase eyebrows, italic stage chips.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, X, Search, Phone, Mail, MapPin, CheckCircle2, Circle, AlertTriangle, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';

// ── Stage palette (mockup-aligned soft chips) ────────────────────────────
const STAGE_PALETTE = {
  new_inquiry:     { label: 'Nuova richiesta',  bg: '#f5ecdb', ink: '#6b5c3c' },
  lead:            { label: 'Lead',             bg: '#f0e4ce', ink: '#7a6332' },
  discovery:       { label: 'Discovery',        bg: '#e6deef', ink: '#5b4a73' },
  prospect:        { label: 'Prospect',         bg: '#dee9e0', ink: '#3f6147' },
  active_project:  { label: 'Progetto attivo',  bg: '#cfe1d7', ink: '#2e5b48' },
  existing_client: { label: 'Cliente',          bg: '#dfe7ea', ink: '#3a5a6b' },
  repeat_client:   { label: 'Ricorrente',       bg: '#d3e0e6', ink: '#2c4f63' },
  partner_ad:      { label: 'Partner / A&D',    bg: '#ecdada', ink: '#7a4344' },
  archived:        { label: 'Archiviato',       bg: '#e6e2dc', ink: '#7a7060' },
};
const PIPELINE_ORDER = [
  'new_inquiry','lead','discovery','prospect','active_project','existing_client','archived',
];

const ACCOUNT_TYPE_LABEL = {
  private_client:          'Cliente privato',
  architecture_studio:     'Studio architettura',
  interior_design_studio:  'Studio interior',
  furniture_client:        'Cliente arredo',
  developer:               'Developer',
  contractor:              'Contractor',
  hospitality_group:       'Hospitality',
  company:                 'Azienda',
  partner_ad:              'Partner / A&D',
};

const SIDEBAR_GROUPS = [
  { id: 'all',         label: 'Tutte le relazioni', filter: () => true },
  { id: 'new',         label: 'Nuove',              filter: (a) => a.lifecycle_stage === 'new_inquiry' },
  { id: 'unassigned',  label: 'Non assegnate',      filter: (a) => !a.primary_owner_id },
  { id: 'follow_up',   label: 'Da seguire',         filter: (a) => (a.open_actions_count || 0) > 0 },
  { id: 'high_intent', label: 'High intent',        filter: (a) => ['prospect','discovery'].includes(a.lifecycle_stage) },
  { id: 'international', label: 'Internazionali',   filter: (a) => a.country && a.country !== 'IT' },
  { id: 'active',      label: 'Progetti attivi',    filter: (a) => a.lifecycle_stage === 'active_project' },
  { id: 'clients',     label: 'Clienti',            filter: (a) => ['existing_client','repeat_client'].includes(a.lifecycle_stage) },
  { id: 'archived',    label: 'Archiviate',         filter: (a) => a.lifecycle_stage === 'archived' },
];


const fmtRel = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m fa`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h fa`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}g fa`;
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
};
const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0,2).map(w => w[0]).join('').toUpperCase();


// ── Stage chip ─────────────────────────────────────────────────────────
const StageChip = ({ stage }) => {
  const p = STAGE_PALETTE[stage] || { label: stage, bg: '#e6e2dc', ink: '#444' };
  return (
    <span
      data-testid={`stage-chip-${stage}`}
      className="inline-flex items-center px-2.5 py-1 rounded-[3px] text-[10px] font-medium uppercase tracking-[0.16em]"
      style={{ background: p.bg, color: p.ink }}
    >
      {p.label}
    </span>
  );
};


// ── Avatar (initials in stone circle) ─────────────────────────────────
const Avatar = ({ name, size = 36 }) => (
  <span
    aria-hidden
    className="inline-flex items-center justify-center rounded-full font-heading font-light"
    style={{
      width: size, height: size, fontSize: size * 0.36,
      background: 'var(--bp-surface-2)', color: 'var(--bp-text-primary)',
      border: '1px solid var(--bp-border)',
    }}
  >
    {initials(name) || '·'}
  </span>
);


// ── Sidebar ───────────────────────────────────────────────────────────
const SidebarNav = ({ active, onChange, counts }) => (
  <aside
    data-testid="relationships-sidebar"
    className="w-[240px] shrink-0 border-r border-[var(--bp-border)] py-7 pr-6 pl-7 bg-[var(--bp-bg)]"
  >
    <p className="text-[9.5px] uppercase tracking-[0.32em] text-[var(--bp-text-muted)] font-body mb-5">
      Relazioni
    </p>
    <ul className="flex flex-col gap-[2px]">
      {SIDEBAR_GROUPS.map((g) => (
        <li key={g.id}>
          <button
            type="button"
            onClick={() => onChange(g.id)}
            data-testid={`relationships-filter-${g.id}`}
            className={`w-full flex items-baseline justify-between gap-3 px-3 py-2 rounded-[3px] text-left transition-colors
              ${active === g.id ? 'bg-[var(--bp-surface-2)]/60 text-[var(--bp-text-primary)]'
                                : 'text-[var(--bp-text-secondary)] hover:text-[var(--bp-text-primary)]'}`}
          >
            <span className="font-body text-[13px]">{g.label}</span>
            <span className="font-body text-[11px] text-[var(--bp-text-muted)]">{counts[g.id] || 0}</span>
          </button>
        </li>
      ))}
    </ul>
  </aside>
);


// ── Topbar ────────────────────────────────────────────────────────────
const Topbar = ({ view, setView, q, setQ, onNew }) => (
  <header className="px-10 pt-10 pb-7 border-b border-[var(--bp-border)]">
    <div className="flex items-end justify-between gap-6 flex-wrap">
      <div>
        <p className="text-[10px] uppercase tracking-[0.32em] text-[var(--bp-primary)] font-body mb-3">
          Relationship OS
        </p>
        <h1 className="font-heading font-light text-[42px] leading-[1.05] text-[var(--bp-text-primary)] tracking-[-0.005em]">
          Relazioni
        </h1>
        <p className="font-body text-[13.5px] italic text-[var(--bp-text-secondary)] mt-3 max-w-[56ch]">
          La memoria condivisa dello studio — accounts, contatti, conversazioni, prossimi passi.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center bg-[var(--bp-surface-2)]/60 border border-[var(--bp-border)] rounded-[3px] px-3 py-2 gap-2">
          <Search size={14} strokeWidth={1.6} className="text-[var(--bp-text-muted)]" aria-hidden />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca per nome, email, città…"
            data-testid="relationships-search"
            className="bg-transparent outline-none text-[13px] font-body w-[260px] text-[var(--bp-text-primary)] placeholder:text-[var(--bp-text-muted)]"
          />
        </div>
        <div className="inline-flex bg-[var(--bp-surface-2)]/60 border border-[var(--bp-border)] rounded-[3px] p-[3px]">
          {[
            ['table',  'Tabella'],
            ['kanban', 'Kanban'],
          ].map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setView(k)}
              data-testid={`relationships-view-${k}`}
              className={`px-4 py-1.5 rounded-[2px] text-[10.5px] uppercase tracking-[0.2em] font-body transition-all
                ${view === k ? 'bg-[var(--bp-primary)] text-[var(--bp-on-primary,#1a1a1a)]'
                            : 'text-[var(--bp-text-secondary)] hover:text-[var(--bp-text-primary)]'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onNew}
          data-testid="relationships-cta-new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[3px] bg-[var(--bp-primary)] text-[var(--bp-on-primary,#1a1a1a)] font-body text-[11px] uppercase tracking-[0.22em] hover:opacity-90 transition-opacity"
        >
          <Plus size={14} strokeWidth={2} aria-hidden /> Nuova relazione
        </button>
      </div>
    </div>
  </header>
);


// ── Table view ────────────────────────────────────────────────────────
const TableView = ({ accounts, onOpen }) => (
  <table
    data-testid="relationships-table"
    className="w-full border-separate"
    style={{ borderSpacing: 0 }}
  >
    <thead>
      <tr>
        {['Account','Tipo','Stage','Contatto primario','Ultima attività','Aperti','Owner'].map((h) => (
          <th
            key={h}
            className="text-left text-[10px] uppercase tracking-[0.26em] text-[var(--bp-text-muted)] font-body font-medium py-4 px-5 border-b border-[var(--bp-border)] bg-[var(--bp-surface-2)]/30"
          >{h}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {accounts.map((a) => {
        const pc = a.primary_contact || {};
        return (
          <tr
            key={a.id}
            onClick={() => onOpen(a)}
            data-testid={`account-row-${a.id}`}
            className="cursor-pointer transition-colors hover:bg-[var(--bp-surface-2)]/30 border-b border-[var(--bp-border)]"
          >
            <td className="py-4 px-5 border-b border-[var(--bp-border)]">
              <div className="flex items-center gap-3">
                <Avatar name={a.account_name} />
                <div>
                  <div className="font-heading text-[15.5px] text-[var(--bp-text-primary)] leading-tight">{a.account_name}</div>
                  <div className="font-body text-[11.5px] text-[var(--bp-text-muted)] mt-0.5">
                    {[a.city, a.country].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
              </div>
            </td>
            <td className="py-4 px-5 border-b border-[var(--bp-border)] font-body text-[13px] text-[var(--bp-text-secondary)]">
              {ACCOUNT_TYPE_LABEL[a.account_type] || a.account_type}
            </td>
            <td className="py-4 px-5 border-b border-[var(--bp-border)]"><StageChip stage={a.lifecycle_stage} /></td>
            <td className="py-4 px-5 border-b border-[var(--bp-border)] font-body text-[12.5px] text-[var(--bp-text-secondary)]">
              {pc.email || pc.phone || '—'}
            </td>
            <td className="py-4 px-5 border-b border-[var(--bp-border)] font-body text-[12.5px] italic text-[var(--bp-text-muted)]">
              {fmtRel(a.last_activity_at)}
            </td>
            <td className="py-4 px-5 border-b border-[var(--bp-border)] font-body text-[13px]">
              {a.open_actions_count > 0
                ? <span className="inline-flex items-center gap-1.5 text-[var(--bp-primary)]"><AlertTriangle size={12} strokeWidth={1.7} aria-hidden /> {a.open_actions_count}</span>
                : <span className="text-[var(--bp-text-muted)]">—</span>}
            </td>
            <td className="py-4 px-5 border-b border-[var(--bp-border)] font-body text-[12.5px] text-[var(--bp-text-muted)]">
              {a.primary_owner_id ? <span className="italic">assegnata</span> : <span>—</span>}
            </td>
          </tr>
        );
      })}
      {accounts.length === 0 && (
        <tr><td colSpan={7} className="py-20 text-center font-body italic text-[var(--bp-text-secondary)]">
          Nessuna relazione in questo filtro.
        </td></tr>
      )}
    </tbody>
  </table>
);


// ── Kanban view ───────────────────────────────────────────────────────
const KanbanView = ({ accounts, onOpen }) => {
  const byStage = useMemo(() => {
    const m = Object.fromEntries(PIPELINE_ORDER.map((s) => [s, []]));
    accounts.forEach((a) => {
      const s = PIPELINE_ORDER.includes(a.lifecycle_stage) ? a.lifecycle_stage : 'archived';
      m[s].push(a);
    });
    return m;
  }, [accounts]);
  return (
    <div data-testid="relationships-kanban" className="px-6 py-8 overflow-x-auto">
      <div className="flex gap-5 min-w-max">
        {PIPELINE_ORDER.map((stage) => (
          <div key={stage} className="w-[300px] shrink-0">
            <div className="flex items-baseline justify-between mb-4 pl-1">
              <StageChip stage={stage} />
              <span className="font-body text-[11px] text-[var(--bp-text-muted)]">{byStage[stage].length}</span>
            </div>
            <div className="flex flex-col gap-3">
              {byStage[stage].map((a) => {
                const pc = a.primary_contact || {};
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onOpen(a)}
                    data-testid={`kanban-card-${a.id}`}
                    className="text-left p-4 bg-[var(--bp-surface-2)]/40 border border-[var(--bp-border)] rounded-[3px] hover:border-[var(--bp-primary)]/40 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 mb-3">
                      <Avatar name={a.account_name} size={28} />
                      <div className="min-w-0">
                        <div className="font-heading text-[13.5px] text-[var(--bp-text-primary)] truncate">{a.account_name}</div>
                        <div className="font-body text-[10.5px] uppercase tracking-[0.18em] text-[var(--bp-text-muted)] truncate">
                          {ACCOUNT_TYPE_LABEL[a.account_type] || a.account_type}
                        </div>
                      </div>
                    </div>
                    <div className="font-body text-[11.5px] text-[var(--bp-text-secondary)] truncate mb-2">
                      {pc.email || pc.phone || [a.city, a.country].filter(Boolean).join(' · ') || '—'}
                    </div>
                    <div className="flex items-center justify-between font-body text-[10.5px] text-[var(--bp-text-muted)]">
                      <span className="italic">{fmtRel(a.last_activity_at)}</span>
                      {a.open_actions_count > 0 && (
                        <span className="inline-flex items-center gap-1 text-[var(--bp-primary)]">
                          <AlertTriangle size={10} strokeWidth={1.7} aria-hidden /> {a.open_actions_count}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
              {byStage[stage].length === 0 && (
                <div className="p-6 border border-dashed border-[var(--bp-border)] rounded-[3px] text-center text-[11.5px] italic font-body text-[var(--bp-text-muted)]">
                  Vuoto
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


// ── Account Detail Drawer (right slide-in) ───────────────────────────
const AccountDrawer = ({ account, onClose, onChange }) => {
  const [tab, setTab] = useState('overview');
  const [detail, setDetail] = useState(null);
  const [interactions, setInteractions] = useState([]);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!account?.id) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [d, ix, ac] = await Promise.all([
        api.get(`/api/relationships/accounts/${account.id}`),
        api.get(`/api/relationships/accounts/${account.id}/interactions`),
        api.get(`/api/relationships/accounts/${account.id}/actions`),
      ]);
      if (cancelled) return;
      setDetail(d.data);
      setInteractions(ix.data?.interactions || []);
      setActions(ac.data?.actions || []);
      setLoading(false);
    })().catch(() => setLoading(false));
    return () => { cancelled = true; };
  }, [account?.id]);

  if (!account) return null;
  const acc = detail?.account || account;
  const pc = (detail?.contacts || []).find((c) => c.primary_contact) || (detail?.contacts || [])[0] || account.primary_contact;

  const changeStage = async (next) => {
    try {
      await api.post(`/api/relationships/accounts/${acc.id}/stage`, { lifecycle_stage: next });
      toast.success(`Stage → ${STAGE_PALETTE[next]?.label || next}`);
      onChange();
    } catch {
      toast.error('Impossibile cambiare stage.');
    }
  };
  const toggleAction = async (act) => {
    const next = act.status === 'done' ? 'open' : 'done';
    try {
      await api.patch(`/api/relationships/accounts/${acc.id}/actions/${act.id}`, { status: next });
      setActions((prev) => prev.map((a) => a.id === act.id ? { ...a, status: next } : a));
    } catch { toast.error('Errore aggiornamento azione.'); }
  };

  return (
    <div
      data-testid="account-drawer"
      className="fixed inset-y-0 right-0 w-full max-w-[760px] z-50 bg-[var(--bp-bg)] border-l border-[var(--bp-border)] overflow-y-auto"
      style={{ boxShadow: '-40px 0 80px -40px rgba(0,0,0,0.4)' }}
    >
      <div className="sticky top-0 z-10 bg-[var(--bp-bg)]/95 backdrop-blur border-b border-[var(--bp-border)] px-8 py-5 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <StageChip stage={acc.lifecycle_stage} />
            <span className="font-body text-[10.5px] uppercase tracking-[0.24em] text-[var(--bp-text-muted)]">
              {ACCOUNT_TYPE_LABEL[acc.account_type] || acc.account_type}
            </span>
          </div>
          <h2 className="font-heading font-light text-[28px] leading-tight text-[var(--bp-text-primary)] truncate" data-testid="account-drawer-title">
            {acc.account_name}
          </h2>
          <p className="font-body text-[12.5px] text-[var(--bp-text-secondary)] mt-1">
            {[acc.city, acc.country].filter(Boolean).join(' · ') || '—'}
            {acc.last_activity_at && <> · <span className="italic">ultima attività {fmtRel(acc.last_activity_at)}</span></>}
          </p>
        </div>
        <button type="button" onClick={onClose} data-testid="account-drawer-close" className="p-2 -m-2 text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] transition-colors">
          <X size={20} strokeWidth={1.6} aria-hidden />
        </button>
      </div>

      {/* Tabs */}
      <nav className="flex gap-7 px-8 border-b border-[var(--bp-border)]" aria-label="Account tabs">
        {[
          ['overview',    'Overview'],
          ['contacts',    `Contatti${detail?.contacts ? ` · ${detail.contacts.length}` : ''}`],
          ['timeline',    `Timeline${interactions.length ? ` · ${interactions.length}` : ''}`],
          ['actions',     `Prossimi passi${actions.filter(a => a.status==='open').length ? ` · ${actions.filter(a=>a.status==='open').length}` : ''}`],
        ].map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            data-testid={`drawer-tab-${k}`}
            className={`py-4 font-body text-[11.5px] uppercase tracking-[0.22em] transition-colors relative
              ${tab === k ? 'text-[var(--bp-primary)]' : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]'}`}>
            {label}
            {tab === k && <span className="absolute -bottom-px left-0 right-0 h-px bg-[var(--bp-primary)]" />}
          </button>
        ))}
      </nav>

      <div className="px-8 py-7" data-testid="drawer-content">
        {loading && <p className="font-body italic text-[var(--bp-text-muted)]">Sto caricando la relazione…</p>}

        {!loading && tab === 'overview' && (
          <div className="grid grid-cols-2 gap-8" data-testid="drawer-overview">
            <section>
              <p className="text-[9.5px] uppercase tracking-[0.28em] text-[var(--bp-text-muted)] font-body mb-3">Dati account</p>
              <dl className="space-y-3 font-body text-[13.5px]">
                {pc?.email && <div className="flex gap-2 items-baseline"><Mail size={12} strokeWidth={1.6} className="opacity-60" /><dt className="sr-only">Email</dt><dd>{pc.email}</dd></div>}
                {pc?.phone && <div className="flex gap-2 items-baseline"><Phone size={12} strokeWidth={1.6} className="opacity-60" /><dt className="sr-only">Phone</dt><dd>{pc.phone}</dd></div>}
                {(acc.city || acc.country) && <div className="flex gap-2 items-baseline"><MapPin size={12} strokeWidth={1.6} className="opacity-60" /><dd>{[acc.city, acc.country].filter(Boolean).join(', ')}</dd></div>}
                {acc.source && <div className="flex gap-3"><dt className="text-[var(--bp-text-muted)] w-[100px]">Sorgente</dt><dd>{acc.source}</dd></div>}
                {acc.relationship_health && <div className="flex gap-3"><dt className="text-[var(--bp-text-muted)] w-[100px]">Salute</dt><dd>{acc.relationship_health}</dd></div>}
                {acc.notes && <div className="mt-4 italic text-[var(--bp-text-secondary)]">{acc.notes}</div>}
              </dl>
            </section>
            <section>
              <p className="text-[9.5px] uppercase tracking-[0.28em] text-[var(--bp-text-muted)] font-body mb-3">Cambia stage</p>
              <div className="flex flex-wrap gap-2">
                {PIPELINE_ORDER.map((s) => (
                  <button key={s} type="button" onClick={() => changeStage(s)}
                    data-testid={`drawer-stage-${s}`}
                    disabled={s === acc.lifecycle_stage}
                    className="opacity-100 disabled:opacity-40">
                    <StageChip stage={s} />
                  </button>
                ))}
              </div>
              <p className="mt-8 text-[9.5px] uppercase tracking-[0.28em] text-[var(--bp-text-muted)] font-body mb-3">Contatori</p>
              <div className="grid grid-cols-2 gap-3 font-body text-[12.5px]">
                <div className="p-4 bg-[var(--bp-surface-2)]/40 rounded-[3px]"><div className="text-[var(--bp-text-muted)] uppercase tracking-[0.22em] text-[10px] mb-1">Interazioni</div><div className="text-[24px] font-heading font-light text-[var(--bp-text-primary)]">{interactions.length}</div></div>
                <div className="p-4 bg-[var(--bp-surface-2)]/40 rounded-[3px]"><div className="text-[var(--bp-text-muted)] uppercase tracking-[0.22em] text-[10px] mb-1">Aperti</div><div className="text-[24px] font-heading font-light text-[var(--bp-text-primary)]">{actions.filter(a => a.status==='open').length}</div></div>
              </div>
            </section>
          </div>
        )}

        {!loading && tab === 'contacts' && (
          <ul className="space-y-4" data-testid="drawer-contacts">
            {(detail?.contacts || []).length === 0 && <li className="font-body italic text-[var(--bp-text-muted)]">Nessun contatto registrato.</li>}
            {(detail?.contacts || []).map((c) => (
              <li key={c.id} className="p-5 border border-[var(--bp-border)] rounded-[3px]" data-testid={`drawer-contact-${c.id}`}>
                <div className="flex items-center gap-3 mb-2">
                  <Avatar name={`${c.first_name || ''} ${c.last_name || ''}`} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="font-heading text-[15px] text-[var(--bp-text-primary)]">{[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}</div>
                    <div className="font-body text-[11px] uppercase tracking-[0.2em] text-[var(--bp-text-muted)] mt-0.5">
                      {[c.role, c.department_or_area].filter(Boolean).join(' · ') || (c.primary_contact ? 'Contatto principale' : '')}
                    </div>
                  </div>
                  {c.primary_contact && <span className="text-[9.5px] uppercase tracking-[0.22em] text-[var(--bp-primary)] font-body font-medium">Primario</span>}
                </div>
                <div className="font-body text-[12.5px] text-[var(--bp-text-secondary)] flex gap-5 flex-wrap">
                  {c.email && <span className="flex items-center gap-1.5"><Mail size={11} strokeWidth={1.6} className="opacity-60" />{c.email}</span>}
                  {c.phone && <span className="flex items-center gap-1.5"><Phone size={11} strokeWidth={1.6} className="opacity-60" />{c.phone}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}

        {!loading && tab === 'timeline' && (
          <ol className="relative pl-7 border-l border-[var(--bp-border)] space-y-7" data-testid="drawer-timeline">
            {interactions.length === 0 && <li className="font-body italic text-[var(--bp-text-muted)]">Nessuna interazione registrata.</li>}
            {interactions.map((ix) => (
              <li key={ix.id} className="relative" data-testid={`timeline-item-${ix.id}`}>
                <span className="absolute -left-[33px] top-1.5 w-2.5 h-2.5 rounded-full bg-[var(--bp-primary)]" />
                <div className="flex items-baseline gap-3 mb-1">
                  <span className="text-[9.5px] uppercase tracking-[0.28em] text-[var(--bp-primary)] font-body font-medium">{ix.interaction_type.replace(/_/g, ' ')}</span>
                  <span className="text-[11.5px] italic text-[var(--bp-text-muted)] font-body">{fmtRel(ix.occurred_at)}</span>
                </div>
                {ix.title && <div className="font-heading text-[15.5px] text-[var(--bp-text-primary)] leading-tight">{ix.title}</div>}
                {ix.summary && <div className="font-body text-[13px] text-[var(--bp-text-secondary)] leading-[1.7] mt-1">{ix.summary}</div>}
                {ix.next_step && <div className="mt-2 inline-flex items-center gap-2 text-[12px] text-[var(--bp-text-primary)] italic"><Calendar size={11} strokeWidth={1.6} className="opacity-60" />Prossimo passo: {ix.next_step}</div>}
              </li>
            ))}
          </ol>
        )}

        {!loading && tab === 'actions' && (
          <ul className="space-y-3" data-testid="drawer-actions">
            {actions.length === 0 && <li className="font-body italic text-[var(--bp-text-muted)]">Nessun prossimo passo aperto.</li>}
            {actions.map((a) => (
              <li key={a.id}
                className="flex items-start gap-3 p-4 border border-[var(--bp-border)] rounded-[3px]"
                data-testid={`drawer-action-${a.id}`}>
                <button type="button" onClick={() => toggleAction(a)} className="mt-0.5"
                  data-testid={`drawer-action-toggle-${a.id}`}
                  aria-label={a.status === 'done' ? 'Riapri' : 'Segna come fatto'}>
                  {a.status === 'done'
                    ? <CheckCircle2 size={18} strokeWidth={1.6} className="text-[var(--bp-primary)]" />
                    : <Circle size={18} strokeWidth={1.6} className="text-[var(--bp-text-muted)]" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`font-heading text-[14.5px] leading-tight ${a.status === 'done' ? 'line-through text-[var(--bp-text-muted)]' : 'text-[var(--bp-text-primary)]'}`}>{a.title}</div>
                  <div className="font-body text-[11px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] mt-1">
                    {a.action_type.replace(/_/g, ' ')}{a.due_date && ` · scadenza ${new Date(a.due_date).toLocaleDateString('it-IT')}`}{a.priority && a.priority !== 'normal' && ` · ${a.priority}`}
                  </div>
                  {a.notes && <div className="font-body text-[12.5px] text-[var(--bp-text-secondary)] mt-2 italic">{a.notes}</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};


// ── New Relationship (modal, minimal Phase 1) ─────────────────────────
const NewRelationshipModal = ({ open, onClose, onCreated }) => {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    account_name: '', account_type: 'private_client', source: 'manual_entry',
    first_name: '', last_name: '', email: '', phone: '',
    city: '', country: 'IT', notes: '',
  });
  if (!open) return null;
  const submit = async (e) => {
    e.preventDefault();
    if (!form.account_name.trim()) { toast.error('Inserisci un nome account.'); return; }
    setBusy(true);
    try {
      const r = await api.post('/api/relationships/accounts', {
        account_name: form.account_name, account_type: form.account_type, source: form.source,
        country: form.country, city: form.city, email: form.email, phone: form.phone,
        notes: form.notes || null, lifecycle_stage: 'new_inquiry',
      });
      const aid = r.data?.account?.id;
      if (aid && (form.first_name || form.email)) {
        await api.post(`/api/relationships/accounts/${aid}/contacts`, {
          first_name: form.first_name || form.account_name, last_name: form.last_name || null,
          email: form.email || null, phone: form.phone || null, primary_contact: true,
        });
      }
      toast.success('Relazione creata.');
      onCreated();
      onClose();
    } catch {
      toast.error('Impossibile creare la relazione.');
    } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6" data-testid="new-relationship-modal">
      <form onSubmit={submit} className="w-full max-w-[640px] bg-[var(--bp-bg)] border border-[var(--bp-border)] rounded-[6px] p-8" style={{ boxShadow: '0 40px 100px -40px rgba(0,0,0,0.5)' }}>
        <div className="flex items-start justify-between mb-7">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-[var(--bp-primary)] font-body mb-2">Nuova relazione</p>
            <h3 className="font-heading font-light text-[26px] text-[var(--bp-text-primary)]">Apri una nuova relazione</h3>
          </div>
          <button type="button" onClick={onClose} className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]" data-testid="modal-close"><X size={18} strokeWidth={1.6} /></button>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Field label="Nome account / famiglia / studio" required>
            <input type="text" value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} data-testid="modal-account-name" required className={inputCls} />
          </Field>
          <Field label="Tipo account">
            <select value={form.account_type} onChange={(e) => setForm({ ...form, account_type: e.target.value })} data-testid="modal-account-type" className={inputCls}>
              {Object.entries(ACCOUNT_TYPE_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Sorgente">
            <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} data-testid="modal-source" className={inputCls}>
              <option value="manual_entry">Inserimento manuale</option>
              <option value="showroom_visit">Visita showroom</option>
              <option value="business_meeting">Business meeting</option>
              <option value="incoming_call">Telefonata</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="referral">Referral</option>
              <option value="event">Evento</option>
              <option value="web_form">Form sito</option>
              <option value="social_lead">Social</option>
            </select>
          </Field>
          <Field label="Città"><input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} data-testid="modal-city" className={inputCls} /></Field>
          <Field label="Nome contatto"><input type="text" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} data-testid="modal-first-name" className={inputCls} /></Field>
          <Field label="Cognome contatto"><input type="text" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} data-testid="modal-last-name" className={inputCls} /></Field>
          <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="modal-email" className={inputCls} /></Field>
          <Field label="Telefono"><input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="modal-phone" className={inputCls} /></Field>
        </div>
        <Field label="Note iniziali (opzionale)"><textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} data-testid="modal-notes" className={`${inputCls} resize-none`} /></Field>
        <div className="flex justify-end gap-3 mt-7">
          <button type="button" onClick={onClose} className="px-5 py-2.5 font-body text-[11px] uppercase tracking-[0.22em] text-[var(--bp-text-secondary)] hover:text-[var(--bp-text-primary)]">Annulla</button>
          <button type="submit" disabled={busy} data-testid="modal-submit" className="px-6 py-2.5 rounded-[3px] bg-[var(--bp-primary)] text-[var(--bp-on-primary,#1a1a1a)] font-body text-[11px] uppercase tracking-[0.22em] hover:opacity-90 disabled:opacity-40">
            {busy ? 'Sto creando…' : 'Crea relazione'}
          </button>
        </div>
      </form>
    </div>
  );
};
const inputCls = 'w-full bg-[var(--bp-surface-2)]/40 border border-[var(--bp-border)] rounded-[3px] px-3 py-2.5 font-body text-[13px] text-[var(--bp-text-primary)] outline-none focus:border-[var(--bp-primary)]/50 transition-colors';
const Field = ({ label, required, children }) => (
  <label className="flex flex-col gap-1.5">
    <span className="font-body text-[9.5px] uppercase tracking-[0.28em] text-[var(--bp-text-muted)]">{label}{required && <span className="text-[var(--bp-primary)]"> *</span>}</span>
    {children}
  </label>
);


// ── Page ──────────────────────────────────────────────────────────────
const RelationshipsPage = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('table');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [openAccount, setOpenAccount] = useState(null);
  const [showNew, setShowNew] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/relationships/accounts?limit=500');
      setAccounts(r.data?.accounts || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    const fn = SIDEBAR_GROUPS.find((g) => g.id === filter)?.filter || (() => true);
    let xs = accounts.filter(fn);
    if (q.trim()) {
      const k = q.toLowerCase();
      xs = xs.filter((a) =>
        (a.account_name || '').toLowerCase().includes(k) ||
        (a.primary_contact?.email || '').toLowerCase().includes(k) ||
        (a.city || '').toLowerCase().includes(k) ||
        (a.country || '').toLowerCase().includes(k)
      );
    }
    return xs;
  }, [accounts, filter, q]);

  const counts = useMemo(() => {
    const m = {};
    SIDEBAR_GROUPS.forEach((g) => { m[g.id] = accounts.filter(g.filter).length; });
    return m;
  }, [accounts]);

  return (
    <div className="min-h-full bg-[var(--bp-bg)]" data-testid="relationships-page" data-surface="os">
      <Topbar view={view} setView={setView} q={q} setQ={setQ} onNew={() => setShowNew(true)} />
      <div className="flex">
        <SidebarNav active={filter} onChange={setFilter} counts={counts} />
        <main className="flex-1 min-w-0">
          {loading
            ? <p className="px-10 py-20 font-body italic text-[var(--bp-text-muted)]">Sto leggendo la memoria dello studio…</p>
            : view === 'table'
              ? <TableView accounts={filtered} onOpen={setOpenAccount} />
              : <KanbanView accounts={filtered} onOpen={setOpenAccount} />}
        </main>
      </div>
      {openAccount && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setOpenAccount(null)} aria-hidden />
          <AccountDrawer account={openAccount} onClose={() => setOpenAccount(null)} onChange={refresh} />
        </>
      )}
      <NewRelationshipModal open={showNew} onClose={() => setShowNew(false)} onCreated={refresh} />
    </div>
  );
};

export default RelationshipsPage;
