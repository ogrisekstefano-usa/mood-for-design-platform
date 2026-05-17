/**
 * RelationshipsPage — Phase R-CRM-2A
 *
 * `/workspace/relationships` — the lightweight Relationship OS, now fully
 * locale-aware + config-driven.
 *
 *   NO hardcoded business strings. NO hardcoded business values.
 *
 *   • All structured values (lifecycle_stage, account_type, source, …)
 *     come from `relationship_lookups` via `useLookups(group)`.
 *   • All UI text comes from `useT().t('relationships.…')` dictionaries.
 *   • Stage colours come from each lookup's metadata.color (set at seed).
 *   • Dates/numbers/relative time use `Intl.*` via `useT()` formatters.
 *
 * Layout: editorial dark register, soft borders, generous spacing.
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │  PAGE HEADER — title + view toggle + + New Relationship         │
 *   ├──────────┬──────────────────────────────────────────────────────┤
 *   │ SIDEBAR  │  TABLE  /  KANBAN  view                              │
 *   │ filters  │  Account rows or pipeline columns                    │
 *   └──────────┴──────────────────────────────────────────────────────┘
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, X, Search, Phone, Mail, MapPin, CheckCircle2, Circle, AlertTriangle, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { useT, useLookups } from '../../i18n';

// ─── Sidebar filters (CLIENT-SIDE predicates only). Labels come from t(). ──
// These are boolean predicates over the accounts list — not business values.
// Predicates reference *value_key* strings only (which are stable IDs, not
// translatable labels), so they remain valid even when tenant labels change.
const SIDEBAR_FILTERS = [
  { id: 'all',          predicate: () => true },
  { id: 'new',          predicate: (a) => a.lifecycle_stage === 'new_inquiry' },
  { id: 'unassigned',   predicate: (a) => !a.primary_owner_id },
  { id: 'follow_up',    predicate: (a) => (a.open_actions_count || 0) > 0 },
  { id: 'high_intent',  predicate: (a) => ['prospect', 'discovery'].includes(a.lifecycle_stage) },
  { id: 'international',predicate: (a) => a.country && a.country !== 'IT' },
  { id: 'active',       predicate: (a) => a.lifecycle_stage === 'active_project' },
  { id: 'clients',      predicate: (a) => ['existing_client', 'repeat_client'].includes(a.lifecycle_stage) },
  { id: 'archived',     predicate: (a) => a.lifecycle_stage === 'archived' },
];

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

// Default chip colour (used when lookup has no metadata.color override).
const DEFAULT_CHIP = { bg: '#e6e2dc', ink: '#444' };

// ─── Stage chip (colour + label from useLookups) ──────────────────────
const StageChip = ({ stage, stages }) => {
  const entry = stages.byValue[stage];
  const color = entry?.color || DEFAULT_CHIP;
  const label = entry?.label || stage;
  return (
    <span
      data-testid={`stage-chip-${stage}`}
      className="inline-flex items-center px-2.5 py-1 rounded-[3px] text-[10px] font-medium uppercase tracking-[0.16em]"
      style={{ background: color.bg, color: color.ink }}
    >
      {label}
    </span>
  );
};

// ─── Avatar (initials in stone circle) ────────────────────────────────
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

// ─── Sidebar ──────────────────────────────────────────────────────────
const SidebarNav = ({ active, onChange, counts }) => {
  const { t } = useT();
  return (
    <aside
      data-testid="relationships-sidebar"
      className="w-[240px] shrink-0 border-r border-[var(--bp-border)] py-7 pr-6 pl-7 bg-[var(--bp-bg)]"
    >
      <p className="text-[9.5px] uppercase tracking-[0.32em] text-[var(--bp-text-muted)] font-body mb-5">
        {t('relationships.sidebarTitle')}
      </p>
      <ul className="flex flex-col gap-[2px]">
        {SIDEBAR_FILTERS.map((g) => (
          <li key={g.id}>
            <button
              type="button"
              onClick={() => onChange(g.id)}
              data-testid={`relationships-filter-${g.id}`}
              className={`w-full flex items-baseline justify-between gap-3 px-3 py-2 rounded-[3px] text-left transition-colors
                ${active === g.id ? 'bg-[var(--bp-surface-2)]/60 text-[var(--bp-text-primary)]'
                                  : 'text-[var(--bp-text-secondary)] hover:text-[var(--bp-text-primary)]'}`}
            >
              <span className="font-body text-[13px]">{t(`relationships.filters.${g.id}`)}</span>
              <span className="font-body text-[11px] text-[var(--bp-text-muted)]">{counts[g.id] || 0}</span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
};

// ─── Topbar ────────────────────────────────────────────────────────────
const Topbar = ({ view, setView, q, setQ, onNew }) => {
  const { t } = useT();
  return (
    <header className="px-10 pt-10 pb-7 border-b border-[var(--bp-border)]">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.32em] text-[var(--bp-primary)] font-body mb-3">
            {t('relationships.eyebrow')}
          </p>
          <h1 className="font-heading font-light text-[42px] leading-[1.05] text-[var(--bp-text-primary)] tracking-[-0.005em]">
            {t('relationships.title')}
          </h1>
          <p className="font-body text-[13.5px] italic text-[var(--bp-text-secondary)] mt-3 max-w-[56ch]">
            {t('relationships.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center bg-[var(--bp-surface-2)]/60 border border-[var(--bp-border)] rounded-[3px] px-3 py-2 gap-2">
            <Search size={14} strokeWidth={1.6} className="text-[var(--bp-text-muted)]" aria-hidden />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('relationships.searchPlaceholder')}
              data-testid="relationships-search"
              className="bg-transparent outline-none text-[13px] font-body w-[260px] text-[var(--bp-text-primary)] placeholder:text-[var(--bp-text-muted)]"
            />
          </div>
          <div className="inline-flex bg-[var(--bp-surface-2)]/60 border border-[var(--bp-border)] rounded-[3px] p-[3px]">
            {[
              ['table',  t('relationships.viewTable')],
              ['kanban', t('relationships.viewKanban')],
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
            <Plus size={14} strokeWidth={2} aria-hidden /> {t('relationships.ctaNew')}
          </button>
        </div>
      </div>
    </header>
  );
};

// ─── Table view ────────────────────────────────────────────────────────
const TableView = ({ accounts, onOpen, stages, accountTypes }) => {
  const { t, fmtRelative } = useT();
  const headers = [
    t('relationships.table.account'),
    t('relationships.table.type'),
    t('relationships.table.stage'),
    t('relationships.table.contact'),
    t('relationships.table.lastActivity'),
    t('relationships.table.open'),
    t('relationships.table.owner'),
  ];
  return (
    <table
      data-testid="relationships-table"
      className="w-full border-separate"
      style={{ borderSpacing: 0 }}
    >
      <thead>
        <tr>
          {headers.map((h) => (
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
                      {[a.city, a.country].filter(Boolean).join(' · ') || t('common.none')}
                    </div>
                  </div>
                </div>
              </td>
              <td className="py-4 px-5 border-b border-[var(--bp-border)] font-body text-[13px] text-[var(--bp-text-secondary)]">
                {accountTypes.labelOf(a.account_type)}
              </td>
              <td className="py-4 px-5 border-b border-[var(--bp-border)]">
                <StageChip stage={a.lifecycle_stage} stages={stages} />
              </td>
              <td className="py-4 px-5 border-b border-[var(--bp-border)] font-body text-[12.5px] text-[var(--bp-text-secondary)]">
                {pc.email || pc.phone || t('common.none')}
              </td>
              <td className="py-4 px-5 border-b border-[var(--bp-border)] font-body text-[12.5px] italic text-[var(--bp-text-muted)]">
                {a.last_activity_at ? fmtRelative(a.last_activity_at) : t('common.none')}
              </td>
              <td className="py-4 px-5 border-b border-[var(--bp-border)] font-body text-[13px]">
                {a.open_actions_count > 0
                  ? <span className="inline-flex items-center gap-1.5 text-[var(--bp-primary)]"><AlertTriangle size={12} strokeWidth={1.7} aria-hidden /> {a.open_actions_count}</span>
                  : <span className="text-[var(--bp-text-muted)]">{t('common.none')}</span>}
              </td>
              <td className="py-4 px-5 border-b border-[var(--bp-border)] font-body text-[12.5px] text-[var(--bp-text-muted)]">
                {a.primary_owner_id ? <span className="italic">{t('common.assigned')}</span> : <span>{t('common.none')}</span>}
              </td>
            </tr>
          );
        })}
        {accounts.length === 0 && (
          <tr><td colSpan={headers.length} className="py-20 text-center font-body italic text-[var(--bp-text-secondary)]">
            {t('relationships.table.emptyFiltered')}
          </td></tr>
        )}
      </tbody>
    </table>
  );
};

// ─── Kanban view ───────────────────────────────────────────────────────
const KanbanView = ({ accounts, onOpen, stages, accountTypes }) => {
  const { t, fmtRelative } = useT();
  // Pipeline order = lookup sort_order (ex archived → last column), no hardcoded list.
  const pipelineStages = useMemo(
    () => stages.items.filter((s) => s.value !== 'archived').map((s) => s.value)
      .concat(stages.byValue['archived'] ? ['archived'] : []),
    [stages.items, stages.byValue],
  );

  const byStage = useMemo(() => {
    const m = Object.fromEntries(pipelineStages.map((s) => [s, []]));
    accounts.forEach((a) => {
      const s = m[a.lifecycle_stage] ? a.lifecycle_stage : (pipelineStages.includes('archived') ? 'archived' : pipelineStages[0]);
      if (m[s]) m[s].push(a);
    });
    return m;
  }, [accounts, pipelineStages]);

  return (
    <div data-testid="relationships-kanban" className="px-6 py-8 overflow-x-auto">
      <div className="flex gap-5 min-w-max">
        {pipelineStages.map((stage) => (
          <div key={stage} className="w-[300px] shrink-0">
            <div className="flex items-baseline justify-between mb-4 pl-1">
              <StageChip stage={stage} stages={stages} />
              <span className="font-body text-[11px] text-[var(--bp-text-muted)]">{byStage[stage]?.length || 0}</span>
            </div>
            <div className="flex flex-col gap-3">
              {(byStage[stage] || []).map((a) => {
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
                          {accountTypes.labelOf(a.account_type)}
                        </div>
                      </div>
                    </div>
                    <div className="font-body text-[11.5px] text-[var(--bp-text-secondary)] truncate mb-2">
                      {pc.email || pc.phone || [a.city, a.country].filter(Boolean).join(' · ') || t('common.none')}
                    </div>
                    <div className="flex items-center justify-between font-body text-[10.5px] text-[var(--bp-text-muted)]">
                      <span className="italic">{a.last_activity_at ? fmtRelative(a.last_activity_at) : t('common.none')}</span>
                      {a.open_actions_count > 0 && (
                        <span className="inline-flex items-center gap-1 text-[var(--bp-primary)]">
                          <AlertTriangle size={10} strokeWidth={1.7} aria-hidden /> {a.open_actions_count}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
              {(byStage[stage] || []).length === 0 && (
                <div className="p-6 border border-dashed border-[var(--bp-border)] rounded-[3px] text-center text-[11.5px] italic font-body text-[var(--bp-text-muted)]">
                  {t('relationships.kanban.emptyColumn')}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Account Detail Drawer ───────────────────────────────────────────
const AccountDrawer = ({ account, onClose, onChange, stages, accountTypes, interactionTypes, actionTypes }) => {
  const { t, fmtRelative, fmtDate } = useT();
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

  // Pipeline stage list = lookup order, excluding "archived" by default.
  const pipelineStages = stages.items.map((s) => s.value);

  const changeStage = async (next) => {
    try {
      await api.post(`/api/relationships/accounts/${acc.id}/stage`, { lifecycle_stage: next });
      const label = stages.labelOf(next);
      toast.success(`${t('relationships.drawer.stageChanged')} → ${label}`);
      onChange();
    } catch {
      toast.error(t('relationships.drawer.stageError'));
    }
  };
  const toggleAction = async (act) => {
    const next = act.status === 'done' ? 'open' : 'done';
    try {
      await api.patch(`/api/relationships/accounts/${acc.id}/actions/${act.id}`, { status: next });
      setActions((prev) => prev.map((a) => a.id === act.id ? { ...a, status: next } : a));
    } catch { toast.error(t('relationships.drawer.actionError')); }
  };

  const tabs = [
    ['overview', t('relationships.drawer.tabs.overview')],
    ['contacts', `${t('relationships.drawer.tabs.contacts')}${detail?.contacts ? ` · ${detail.contacts.length}` : ''}`],
    ['timeline', `${t('relationships.drawer.tabs.timeline')}${interactions.length ? ` · ${interactions.length}` : ''}`],
    ['actions',  `${t('relationships.drawer.tabs.actions')}${actions.filter(a => a.status==='open').length ? ` · ${actions.filter(a=>a.status==='open').length}` : ''}`],
  ];

  return (
    <div
      data-testid="account-drawer"
      className="fixed inset-y-0 right-0 w-full max-w-[760px] z-50 bg-[var(--bp-bg)] border-l border-[var(--bp-border)] overflow-y-auto"
      style={{ boxShadow: '-40px 0 80px -40px rgba(0,0,0,0.4)' }}
    >
      <div className="sticky top-0 z-10 bg-[var(--bp-bg)]/95 backdrop-blur border-b border-[var(--bp-border)] px-8 py-5 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <StageChip stage={acc.lifecycle_stage} stages={stages} />
            <span className="font-body text-[10.5px] uppercase tracking-[0.24em] text-[var(--bp-text-muted)]">
              {accountTypes.labelOf(acc.account_type)}
            </span>
          </div>
          <h2 className="font-heading font-light text-[28px] leading-tight text-[var(--bp-text-primary)] truncate" data-testid="account-drawer-title">
            {acc.account_name}
          </h2>
          <p className="font-body text-[12.5px] text-[var(--bp-text-secondary)] mt-1">
            {[acc.city, acc.country].filter(Boolean).join(' · ') || t('common.none')}
            {acc.last_activity_at && <> · <span className="italic">{t('relationships.drawer.lastActivityPrefix')} {fmtRelative(acc.last_activity_at)}</span></>}
          </p>
        </div>
        <button type="button" onClick={onClose} data-testid="account-drawer-close" className="p-2 -m-2 text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] transition-colors">
          <X size={20} strokeWidth={1.6} aria-hidden />
        </button>
      </div>

      <nav className="flex gap-7 px-8 border-b border-[var(--bp-border)]" aria-label="Account tabs">
        {tabs.map(([k, label]) => (
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
        {loading && <p className="font-body italic text-[var(--bp-text-muted)]">{t('relationships.drawer.loadingRelation')}</p>}

        {!loading && tab === 'overview' && (
          <div className="grid grid-cols-2 gap-8" data-testid="drawer-overview">
            <section>
              <p className="text-[9.5px] uppercase tracking-[0.28em] text-[var(--bp-text-muted)] font-body mb-3">{t('relationships.drawer.accountData')}</p>
              <dl className="space-y-3 font-body text-[13.5px]">
                {pc?.email && <div className="flex gap-2 items-baseline"><Mail size={12} strokeWidth={1.6} className="opacity-60" /><dt className="sr-only">Email</dt><dd>{pc.email}</dd></div>}
                {pc?.phone && <div className="flex gap-2 items-baseline"><Phone size={12} strokeWidth={1.6} className="opacity-60" /><dt className="sr-only">Phone</dt><dd>{pc.phone}</dd></div>}
                {(acc.city || acc.country) && <div className="flex gap-2 items-baseline"><MapPin size={12} strokeWidth={1.6} className="opacity-60" /><dd>{[acc.city, acc.country].filter(Boolean).join(', ')}</dd></div>}
                {acc.source && <div className="flex gap-3"><dt className="text-[var(--bp-text-muted)] w-[100px]">{t('relationships.drawer.source')}</dt><dd>{acc.source}</dd></div>}
                {acc.relationship_health && <div className="flex gap-3"><dt className="text-[var(--bp-text-muted)] w-[100px]">{t('relationships.drawer.health')}</dt><dd>{acc.relationship_health}</dd></div>}
                {acc.notes && <div className="mt-4 italic text-[var(--bp-text-secondary)]">{acc.notes}</div>}
              </dl>
            </section>
            <section>
              <p className="text-[9.5px] uppercase tracking-[0.28em] text-[var(--bp-text-muted)] font-body mb-3">{t('relationships.drawer.changeStage')}</p>
              <div className="flex flex-wrap gap-2">
                {pipelineStages.map((s) => (
                  <button key={s} type="button" onClick={() => changeStage(s)}
                    data-testid={`drawer-stage-${s}`}
                    disabled={s === acc.lifecycle_stage}
                    className="opacity-100 disabled:opacity-40">
                    <StageChip stage={s} stages={stages} />
                  </button>
                ))}
              </div>
              <p className="mt-8 text-[9.5px] uppercase tracking-[0.28em] text-[var(--bp-text-muted)] font-body mb-3">{t('relationships.drawer.counters')}</p>
              <div className="grid grid-cols-2 gap-3 font-body text-[12.5px]">
                <div className="p-4 bg-[var(--bp-surface-2)]/40 rounded-[3px]"><div className="text-[var(--bp-text-muted)] uppercase tracking-[0.22em] text-[10px] mb-1">{t('relationships.drawer.interactions')}</div><div className="text-[24px] font-heading font-light text-[var(--bp-text-primary)]">{interactions.length}</div></div>
                <div className="p-4 bg-[var(--bp-surface-2)]/40 rounded-[3px]"><div className="text-[var(--bp-text-muted)] uppercase tracking-[0.22em] text-[10px] mb-1">{t('relationships.drawer.openActions')}</div><div className="text-[24px] font-heading font-light text-[var(--bp-text-primary)]">{actions.filter(a => a.status==='open').length}</div></div>
              </div>
            </section>
          </div>
        )}

        {!loading && tab === 'contacts' && (
          <ul className="space-y-4" data-testid="drawer-contacts">
            {(detail?.contacts || []).length === 0 && <li className="font-body italic text-[var(--bp-text-muted)]">{t('relationships.drawer.emptyContacts')}</li>}
            {(detail?.contacts || []).map((c) => (
              <li key={c.id} className="p-5 border border-[var(--bp-border)] rounded-[3px]" data-testid={`drawer-contact-${c.id}`}>
                <div className="flex items-center gap-3 mb-2">
                  <Avatar name={`${c.first_name || ''} ${c.last_name || ''}`} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="font-heading text-[15px] text-[var(--bp-text-primary)]">{[c.first_name, c.last_name].filter(Boolean).join(' ') || t('common.none')}</div>
                    <div className="font-body text-[11px] uppercase tracking-[0.2em] text-[var(--bp-text-muted)] mt-0.5">
                      {[c.role, c.department_or_area].filter(Boolean).join(' · ') || (c.primary_contact ? t('common.primary') : '')}
                    </div>
                  </div>
                  {c.primary_contact && <span className="text-[9.5px] uppercase tracking-[0.22em] text-[var(--bp-primary)] font-body font-medium">{t('common.primary')}</span>}
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
            {interactions.length === 0 && <li className="font-body italic text-[var(--bp-text-muted)]">{t('relationships.drawer.emptyTimeline')}</li>}
            {interactions.map((ix) => (
              <li key={ix.id} className="relative" data-testid={`timeline-item-${ix.id}`}>
                <span className="absolute -left-[33px] top-1.5 w-2.5 h-2.5 rounded-full bg-[var(--bp-primary)]" />
                <div className="flex items-baseline gap-3 mb-1">
                  <span className="text-[9.5px] uppercase tracking-[0.28em] text-[var(--bp-primary)] font-body font-medium">{interactionTypes.labelOf(ix.interaction_type)}</span>
                  <span className="text-[11.5px] italic text-[var(--bp-text-muted)] font-body">{fmtRelative(ix.occurred_at)}</span>
                </div>
                {ix.title && <div className="font-heading text-[15.5px] text-[var(--bp-text-primary)] leading-tight">{ix.title}</div>}
                {ix.summary && <div className="font-body text-[13px] text-[var(--bp-text-secondary)] leading-[1.7] mt-1">{ix.summary}</div>}
                {ix.next_step && <div className="mt-2 inline-flex items-center gap-2 text-[12px] text-[var(--bp-text-primary)] italic"><Calendar size={11} strokeWidth={1.6} className="opacity-60" />{t('relationships.drawer.nextStep')} {ix.next_step}</div>}
              </li>
            ))}
          </ol>
        )}

        {!loading && tab === 'actions' && (
          <ul className="space-y-3" data-testid="drawer-actions">
            {actions.length === 0 && <li className="font-body italic text-[var(--bp-text-muted)]">{t('relationships.drawer.emptyActions')}</li>}
            {actions.map((a) => (
              <li key={a.id}
                className="flex items-start gap-3 p-4 border border-[var(--bp-border)] rounded-[3px]"
                data-testid={`drawer-action-${a.id}`}>
                <button type="button" onClick={() => toggleAction(a)} className="mt-0.5"
                  data-testid={`drawer-action-toggle-${a.id}`}
                  aria-label={a.status === 'done' ? t('relationships.drawer.reopen') : t('relationships.drawer.markDone')}>
                  {a.status === 'done'
                    ? <CheckCircle2 size={18} strokeWidth={1.6} className="text-[var(--bp-primary)]" />
                    : <Circle size={18} strokeWidth={1.6} className="text-[var(--bp-text-muted)]" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`font-heading text-[14.5px] leading-tight ${a.status === 'done' ? 'line-through text-[var(--bp-text-muted)]' : 'text-[var(--bp-text-primary)]'}`}>{a.title}</div>
                  <div className="font-body text-[11px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] mt-1">
                    {actionTypes.labelOf(a.action_type)}{a.due_date && ` · ${t('relationships.drawer.due')} ${fmtDate(a.due_date)}`}{a.priority && a.priority !== 'normal' && ` · ${a.priority}`}
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

// ─── New Relationship Modal ────────────────────────────────────────────
const inputCls = 'w-full bg-[var(--bp-surface-2)]/40 border border-[var(--bp-border)] rounded-[3px] px-3 py-2.5 font-body text-[13px] text-[var(--bp-text-primary)] outline-none focus:border-[var(--bp-primary)]/50 transition-colors';
const Field = ({ label, required, children }) => (
  <label className="flex flex-col gap-1.5">
    <span className="font-body text-[9.5px] uppercase tracking-[0.28em] text-[var(--bp-text-muted)]">{label}{required && <span className="text-[var(--bp-primary)]"> *</span>}</span>
    {children}
  </label>
);

const NewRelationshipModal = ({ open, onClose, onCreated, accountTypes, sources }) => {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    account_name: '', account_type: '', source: '',
    first_name: '', last_name: '', email: '', phone: '',
    city: '', country: 'IT', notes: '',
  });

  // Seed defaults from lookups (first entry) so the dropdowns always have a value.
  useEffect(() => {
    if (!accountTypes.loading && accountTypes.items.length && !form.account_type) {
      setForm((f) => ({ ...f, account_type: accountTypes.items[0].value }));
    }
    if (!sources.loading && sources.items.length && !form.source) {
      setForm((f) => ({ ...f, source: sources.items.find(s => s.value === 'manual_entry')?.value || sources.items[0].value }));
    }
  }, [accountTypes.loading, accountTypes.items, sources.loading, sources.items, form.account_type, form.source]);

  if (!open) return null;
  const submit = async (e) => {
    e.preventDefault();
    if (!form.account_name.trim()) { toast.error(t('relationships.newModal.errorNameRequired')); return; }
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
      toast.success(t('relationships.newModal.successCreated'));
      onCreated();
      onClose();
    } catch {
      toast.error(t('relationships.newModal.errorCreate'));
    } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6" data-testid="new-relationship-modal">
      <form onSubmit={submit} className="w-full max-w-[640px] bg-[var(--bp-bg)] border border-[var(--bp-border)] rounded-[6px] p-8" style={{ boxShadow: '0 40px 100px -40px rgba(0,0,0,0.5)' }}>
        <div className="flex items-start justify-between mb-7">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-[var(--bp-primary)] font-body mb-2">{t('relationships.newModal.eyebrow')}</p>
            <h3 className="font-heading font-light text-[26px] text-[var(--bp-text-primary)]">{t('relationships.newModal.title')}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]" data-testid="modal-close"><X size={18} strokeWidth={1.6} /></button>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Field label={t('relationships.newModal.accountName')} required>
            <input type="text" value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} data-testid="modal-account-name" required className={inputCls} />
          </Field>
          <Field label={t('relationships.newModal.accountType')}>
            <select value={form.account_type} onChange={(e) => setForm({ ...form, account_type: e.target.value })} data-testid="modal-account-type" className={inputCls}>
              {accountTypes.items.map((it) => <option key={it.value} value={it.value}>{it.label}</option>)}
            </select>
          </Field>
          <Field label={t('relationships.newModal.source')}>
            <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} data-testid="modal-source" className={inputCls}>
              {sources.items.map((it) => <option key={it.value} value={it.value}>{it.label}</option>)}
            </select>
          </Field>
          <Field label={t('relationships.newModal.city')}><input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} data-testid="modal-city" className={inputCls} /></Field>
          <Field label={t('relationships.newModal.firstName')}><input type="text" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} data-testid="modal-first-name" className={inputCls} /></Field>
          <Field label={t('relationships.newModal.lastName')}><input type="text" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} data-testid="modal-last-name" className={inputCls} /></Field>
          <Field label={t('relationships.newModal.email')}><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="modal-email" className={inputCls} /></Field>
          <Field label={t('relationships.newModal.phone')}><input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="modal-phone" className={inputCls} /></Field>
        </div>
        <Field label={t('relationships.newModal.notes')}><textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} data-testid="modal-notes" className={`${inputCls} resize-none`} /></Field>
        <div className="flex justify-end gap-3 mt-7">
          <button type="button" onClick={onClose} className="px-5 py-2.5 font-body text-[11px] uppercase tracking-[0.22em] text-[var(--bp-text-secondary)] hover:text-[var(--bp-text-primary)]">{t('common.cancel')}</button>
          <button type="submit" disabled={busy} data-testid="modal-submit" className="px-6 py-2.5 rounded-[3px] bg-[var(--bp-primary)] text-[var(--bp-on-primary,#1a1a1a)] font-body text-[11px] uppercase tracking-[0.22em] hover:opacity-90 disabled:opacity-40">
            {busy ? t('common.creating') : t('relationships.newModal.submit')}
          </button>
        </div>
      </form>
    </div>
  );
};

// ─── Page ──────────────────────────────────────────────────────────────
const RelationshipsPage = () => {
  const { t } = useT();
  const stages           = useLookups('lifecycle_stage');
  const accountTypes     = useLookups('account_type');
  const sources          = useLookups('source');
  const interactionTypes = useLookups('interaction_type');
  const actionTypes      = useLookups('action_type');

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
    const fn = SIDEBAR_FILTERS.find((g) => g.id === filter)?.predicate || (() => true);
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
    SIDEBAR_FILTERS.forEach((g) => { m[g.id] = accounts.filter(g.predicate).length; });
    return m;
  }, [accounts]);

  return (
    <div className="min-h-full bg-[var(--bp-bg)]" data-testid="relationships-page" data-surface="os">
      <Topbar view={view} setView={setView} q={q} setQ={setQ} onNew={() => setShowNew(true)} />
      <div className="flex">
        <SidebarNav active={filter} onChange={setFilter} counts={counts} />
        <main className="flex-1 min-w-0">
          {loading
            ? <p className="px-10 py-20 font-body italic text-[var(--bp-text-muted)]">{t('relationships.loadingAccounts')}</p>
            : view === 'table'
              ? <TableView accounts={filtered} onOpen={setOpenAccount} stages={stages} accountTypes={accountTypes} />
              : <KanbanView accounts={filtered} onOpen={setOpenAccount} stages={stages} accountTypes={accountTypes} />}
        </main>
      </div>
      {openAccount && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setOpenAccount(null)} aria-hidden />
          <AccountDrawer
            account={openAccount}
            onClose={() => setOpenAccount(null)}
            onChange={refresh}
            stages={stages}
            accountTypes={accountTypes}
            interactionTypes={interactionTypes}
            actionTypes={actionTypes}
          />
        </>
      )}
      <NewRelationshipModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreated={refresh}
        accountTypes={accountTypes}
        sources={sources}
      />
    </div>
  );
};

export default RelationshipsPage;
