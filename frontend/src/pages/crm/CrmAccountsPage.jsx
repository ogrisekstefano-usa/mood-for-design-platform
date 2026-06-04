/**
 * CRM · Accounts Page
 * ────────────────────────────────────────────────────────────────────
 * Account-centered relationship management for Italian furniture stores
 * and A&D studios that usually do NOT use a CRM.
 *
 *   Beautiful · simple · usable.
 *   NOT Salesforce. NOT enterprise.
 *
 * Surfaces 7 sub-routes via tab strip:
 *   Accounts · Contacts · Leads · Prospects · Clients · Follow-ups · Archived
 *
 * Main view supports:
 *   • Table view (compact)
 *   • Card view (editorial)
 *   • Account detail drawer with 9 tabs (Overview · Contacts · Timeline ·
 *     Projects · Moodboards · Files · Follow-ups · Notes · Style)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Users, UserCircle, Sparkles, Search, Crown, BellRing, Archive, LayoutGrid, Rows, Plus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { avatarPalette, initialsOf } from '../../lib/avatarHue';
import AccountDetailDrawer from './AccountDetailDrawer';
import './crm.css';
import './relationship-os.css';
import { useT } from '../../i18n/useT';

// ─── Tab definitions ────────────────────────────────────────────────
// All filter via lifecycle_stage values stored in relationship_lookups.
// Each sub-route maps to a stage filter (NOT hardcoded UI labels).
const CRM_TABS = [{
  id: 'accounts',
  to: '/crm/accounts',
  label: 'Accounts',
  icon: Users,
  filter: null,
  helper: 'Tutte le relazioni · Lead, Prospect, Cliente — tutto qui, come stage evolutivi'
}, {
  id: 'follow-ups',
  to: '/crm/follow-ups',
  label: 'Follow-ups',
  icon: BellRing,
  filter: '__followups__',
  helper: 'Azioni programmate · scadenze'
}, {
  id: 'archived',
  to: '/crm/archived',
  label: 'Archived',
  icon: Archive,
  filter: 'archived',
  helper: 'Relazioni archiviate · solo lettura'
}];
const ACCOUNT_TYPE_LABEL = {
  private_client: 'Cliente privato',
  family: 'Famiglia',
  company: 'Azienda',
  architecture_studio: 'Studio di architettura',
  interior_design_studio: 'Studio interior design',
  showroom: 'Showroom',
  developer: 'Developer',
  contractor: 'Contractor',
  hospitality_group: 'Gruppo hospitality',
  hotel_group: 'Gruppo alberghiero',
  yacht_client: 'Cliente yacht',
  luxury_retail: 'Retail luxury',
  partner_brand: 'Brand partner',
  partner: 'Partner'
};
const CANONICAL_PIPELINE = [{
  key: 'lead',
  label: 'Lead'
}, {
  key: 'prospect',
  label: 'Prospect'
}, {
  key: 'qualified',
  label: 'Qualificato'
}, {
  key: 'active_project',
  label: 'Progetto attivo'
}, {
  key: 'client',
  label: 'Cliente'
}, {
  key: 'returning_client',
  label: 'Cliente di ritorno'
}, {
  key: 'archived',
  label: 'Archiviato'
}];

// ─── Sub-components ─────────────────────────────────────────────────

const STAGE_META = {
  // Canonical pipeline
  lead: {
    c: '#9CA3AF',
    label: 'Lead'
  },
  prospect: {
    c: '#88c0d0',
    label: 'Prospect'
  },
  qualified: {
    c: '#5B7CA0',
    label: 'Qualificato'
  },
  active_project: {
    c: '#C9A36E',
    label: 'Progetto attivo'
  },
  client: {
    c: '#10B981',
    label: 'Cliente'
  },
  returning_client: {
    c: '#059669',
    label: 'Cliente di ritorno'
  },
  // Editorial sub-stages (legacy, still shown if used)
  discovery: {
    c: '#9CA3AF',
    label: 'Discovery'
  },
  inspiration: {
    c: '#88c0d0',
    label: 'Inspiration'
  },
  editorial_engagement: {
    c: '#88c0d0',
    label: 'Editorial'
  },
  project_conversation: {
    c: '#5B7CA0',
    label: 'In conversazione'
  },
  material_exploration: {
    c: '#b08d57',
    label: 'Materiali'
  },
  strategic_direction: {
    c: '#b08d57',
    label: 'Direzione'
  },
  specification: {
    c: '#F59E0B',
    label: 'Specifica'
  },
  proposal: {
    c: '#D4AF37',
    label: 'Proposta'
  },
  active_collaboration: {
    c: '#10B981',
    label: 'Attivo'
  },
  long_term_relationship: {
    c: '#10B981',
    label: 'Long-term'
  },
  archived: {
    c: '#6B7280',
    label: 'Archivio'
  }
};
const StageDot = ({
  stage
}) => {
  const {
    t
  } = useT();
  const meta = STAGE_META[stage] || {
    c: '#9CA3AF'
  };
  return <span className="crm-stage-dot" style={{
    backgroundColor: meta.c
  }} aria-hidden />;
};
const StagePill = ({
  stage
}) => {
  const meta = STAGE_META[stage] || {
    c: '#9CA3AF',
    label: stage || '—'
  };
  return <span className="crm-stage-pill" style={{
    borderColor: meta.c
  }}>
      <span className="crm-stage-pill__dot" style={{
      backgroundColor: meta.c
    }} />
      <span className="crm-stage-pill__label">{meta.label}</span>
    </span>;
};

// Avatar helpers (initialsOf, avatarPalette) imported above from /lib/avatarHue.

const formatRelativeTime = iso => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'ora';
    if (diff < 3600) return `${Math.floor(diff / 60)}m fa`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h fa`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}g fa`;
    return d.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short'
    });
  } catch {
    return '—';
  }
};

// ─── Account table row ─────────────────────────────────────────────
const AccountRow = ({
  account,
  onOpen
}) => {
  const primary = account.primary_contact;
  return <tr className="crm-row" data-testid={`crm-account-${account.id}`} onClick={() => onOpen(account)}>
      <td className="crm-td">
        <div className="crm-row__primary">
          <p className="crm-row__name">{account.account_name}</p>
          <p className="crm-row__type">{ACCOUNT_TYPE_LABEL[account.account_type] || account.account_type || '—'}</p>
        </div>
      </td>
      <td className="crm-td">
        {primary ? <div>
            <p className="crm-row__contact">{primary.full_name || `${primary.first_name || ''} ${primary.last_name || ''}`.trim() || '—'}</p>
            <p className="crm-row__contact-meta">{primary.email || primary.phone || '—'}</p>
          </div> : <span className="crm-empty">—</span>}
      </td>
      <td className="crm-td">
        <StagePill stage={account.lifecycle_stage} />
      </td>
      <td className="crm-td crm-td--mono">{account.source || '—'}</td>
      <td className="crm-td">{formatRelativeTime(account.last_activity_at)}</td>
      <td className="crm-td">
        {account.open_actions_count > 0 ? <span className="crm-actions-chip">{account.open_actions_count} aperti</span> : <span className="crm-empty">—</span>}
      </td>
    </tr>;
};

// ─── Account card (card view) ──────────────────────────────────────
const AccountCard = ({
  account,
  onOpen
}) => {
  const { t } = useT();
  const primary = account.primary_contact;
  const pal = avatarPalette(account.account_name);
  const primaryName = primary ? primary.full_name || `${primary.first_name || ''} ${primary.last_name || ''}`.trim() : '';
  return <button type="button" onClick={() => onOpen(account)} data-testid={`account-card-${account.id}`} data-account-id={account.id} className="crm-card">
      <div className="crm-card__head">
        <span className="crm-avatar" style={{
        background: pal.bg,
        color: pal.fg,
        borderColor: pal.border
      }} aria-hidden>
          {initialsOf(account.account_name)}
        </span>
        <div className="crm-card__head-text">
          <p className="crm-card__name">{account.account_name}</p>
          <p className="crm-card__type">{ACCOUNT_TYPE_LABEL[account.account_type] || account.account_type || '—'}</p>
        </div>
        <StagePill stage={account.lifecycle_stage} />
      </div>
      {primary ? <div className="crm-card__contact">
          <UserCircle size={11} className="crm-card__contact-icon" />
          <span className="crm-card__contact-name">{primaryName}</span>
          {primary.email && <span className="crm-card__contact-email">· {primary.email}</span>}
        </div> : <div className="crm-card__contact crm-card__contact--empty">
          <span>{t('crm.crm_accounts.nessun_contatto_primario_aggiungi_al_drawer')}</span>
        </div>}
      <div className="crm-card__foot">
        <span className="crm-card__last">Ultima attività · {formatRelativeTime(account.last_activity_at)}</span>
        {account.open_actions_count > 0 && <span className="crm-card__actions">{account.open_actions_count} follow-up</span>}
      </div>
    </button>;
};

// ─── Quick create modal ────────────────────────────────────────────
const NewAccountModal = ({
  open,
  onClose,
  onCreated
}) => {
  const { t } = useT();
  const [name, setName] = useState('');
  const [type, setType] = useState('private_client');
  const [stage, setStage] = useState('lead');
  const [saving, setSaving] = useState(false);
  if (!open) return null;
  const submit = async () => {
    if (!name.trim()) return toast.error('Nome obbligatorio');
    setSaving(true);
    try {
      const r = await api.post('/api/relationships/accounts', {
        account_name: name.trim(),
        account_type: type,
        lifecycle_stage: stage
      });
      toast.success('Account creato');
      onCreated?.(r.data?.account || r.data);
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Creazione fallita');
    } finally {
      setSaving(false);
    }
  };
  return <div className="crm-modal-bg" onClick={e => {
    if (e.target === e.currentTarget) onClose();
  }} data-testid="crm-new-account-modal">
      <div className="crm-modal" onClick={e => e.stopPropagation()}>
        <header className="crm-modal__head">
          <div>
            <p className="crm-modal__eyebrow">{t('atelier_voice.crm_accounts.new_relationship_eyebrow', null, 'Design Journey · Nuova relazione')}</p>
            <h2 className="crm-modal__title">{t('crm.crm_accounts.aggiungi_un_account')}</h2>
          </div>
          <button type="button" onClick={onClose}><X size={16} /></button>
        </header>
        <div className="crm-modal__body">
          <label className="crm-label">Nome Account</label>
          <input value={name} onChange={e => setName(e.target.value)} data-testid="crm-new-account-name" placeholder="es. Studio Bianchi · Villa Padova · ABC SpA" className="crm-input" />
          <label className="crm-label">Tipo</label>
          <select value={type} onChange={e => setType(e.target.value)} data-testid="crm-new-account-type" className="crm-input">
            {Object.entries(ACCOUNT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <label className="crm-label">Stage iniziale</label>
          <select value={stage} onChange={e => setStage(e.target.value)} data-testid="crm-new-account-stage" className="crm-input">
            {CANONICAL_PIPELINE.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        <footer className="crm-modal__foot">
          <button type="button" onClick={onClose} className="crm-btn crm-btn--ghost">{t('crm.crm_accounts.annulla')}</button>
          <button type="button" onClick={submit} disabled={saving} data-testid="crm-new-account-submit" className="crm-btn crm-btn--primary">
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
            {t("crm.crm_accounts.crea_account")}
          </button>
        </footer>
      </div>
    </div>;
};

// ─── Main page ─────────────────────────────────────────────────────
const CrmAccountsPage = () => {
  const { t } = useT();
  const navigate = useNavigate();
  const {
    tab = 'accounts',
    accountId
  } = useParams();
  const activeTab = CRM_TABS.find(tab_meta => tab_meta.id === tab) || CRM_TABS[0];
  const [accounts, setAccounts] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('cards'); // 'cards' | 'table'
  const [searchQ, setSearchQ] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [drawerAccount, setDrawerAccount] = useState(null);
  const [reload, setReload] = useState(0);
  // CRM Refactor™ filters
  const [filterStage, setFilterStage] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterHealth, setFilterHealth] = useState('');

  // Load accounts (or follow-ups)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (activeTab.filter === '__followups__') {
          const r = await api.get('/api/relationships/actions', {
            params: {
              status: 'open',
              limit: 200
            }
          });
          if (cancelled) return;
          setFollowUps(r.data?.actions || []);
        } else {
          const params = {
            limit: 200
          };
          if (activeTab.filter && activeTab.filter !== '__contacts__') params.stage = activeTab.filter;
          if (searchQ) params.q = searchQ;
          const r = await api.get('/api/relationships/accounts', {
            params
          });
          if (cancelled) return;
          setAccounts(r.data?.accounts || []);
        }
      } catch (e) {
        if (!cancelled) toast.error('Caricamento fallito');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab.filter, searchQ, reload]);

  // Auto-open drawer from URL ?id=
  useEffect(() => {
    if (accountId) {
      api.get(`/api/relationships/accounts/${accountId}`).then(r => setDrawerAccount(r.data?.account || r.data)).catch(() => setDrawerAccount(null));
    }
  }, [accountId]);
  const filtered = useMemo(() => {
    let rows = accounts;
    if (filterStage) rows = rows.filter(a => a.lifecycle_stage === filterStage);
    if (filterType) rows = rows.filter(a => a.account_type === filterType);
    if (filterHealth) rows = rows.filter(a => a.relationship_health === filterHealth);
    if (searchQ) {
      const q = searchQ.toLowerCase();
      rows = rows.filter(a => (a.account_name || '').toLowerCase().includes(q) || (a.primary_contact?.email || '').toLowerCase().includes(q));
    }
    return rows;
  }, [accounts, searchQ, filterStage, filterType, filterHealth]);
  const openDrawer = a => {
    // CRM Refactor™ — open the full-page experience instead of the drawer
    navigate(`/crm/accounts/${a.id}`);
  };
  const closeDrawer = () => {
    setDrawerAccount(null);
    navigate(`/crm/${activeTab.id}`, {
      replace: false
    });
  };
  return <div className="crm-page" data-surface="os" data-testid="crm-page">
      {/* ── Hero ── */}
      <header className="crm-hero">
        <p className="crm-hero__eyebrow">CRM</p>
        <h1 className="crm-hero__title">{t('crm.crm_accounts.le_relazioni_della_tua_casa_di_design')}</h1>
        <p className="crm-hero__lead">
          {t("crm.crm_accounts.account_centered_ogni_account_puo_avere_piu_contac")} <strong>Team</strong> {t('crm.crm_accounts.lead_outside_team', null, '— not here.')}
        </p>
      </header>

      {/* ── Tabs ── */}
      <nav className="crm-tabs" data-testid="crm-tabs" role="tablist">
        {CRM_TABS.map(t => {
        const Icon = t.icon;
        const active = t.id === activeTab.id;
        return <button key={t.id} type="button" role="tab" aria-selected={active} onClick={() => navigate(t.to)} data-testid={`crm-tab-${t.id}`} className={`crm-tab ${active ? 'is-active' : ''}`}>
              <Icon size={12} strokeWidth={1.6} />
              <span>{t.label}</span>
            </button>;
      })}
      </nav>
      <p className="crm-tab-helper">{activeTab.helper}</p>

      {/* ── Relationship pulse (subtle KPI strip, NOT enterprise) ── */}
      {!loading && activeTab.filter !== '__followups__' && filtered.length > 0 && <div className="crm-pulse" data-testid="crm-pulse">
          <div className="crm-pulse__cell">
            <span className="crm-pulse__num">{filtered.length}</span>
            <span className="crm-pulse__lbl">{activeTab.id === 'accounts' ? 'Account in archivio' : `${activeTab.label} in vista`}</span>
          </div>
          <div className="crm-pulse__cell">
            <span className="crm-pulse__num">{filtered.filter(a => a.lifecycle_stage === 'active_collaboration' || a.lifecycle_stage === 'long_term_relationship').length}</span>
            <span className="crm-pulse__lbl">Relazioni attive</span>
          </div>
          <div className="crm-pulse__cell">
            <span className="crm-pulse__num">{filtered.reduce((acc, a) => acc + (a.open_actions_count || 0), 0)}</span>
            <span className="crm-pulse__lbl">Follow-up aperti</span>
          </div>
        </div>}

      {/* ── Toolbar ── */}
      <div className="crm-toolbar" data-testid="crm-toolbar">
        <div className="crm-toolbar__search">
          <Search size={11} />
          <input type="search" value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder={t("crm.crm_accounts.cerca_per_nome_account_o_email_contact")} data-testid="crm-search" />
        </div>
        <div className="crm-toolbar__actions">
          <div className="crm-view-toggle" role="group" aria-label="View mode">
            <button type="button" aria-pressed={view === 'cards'} onClick={() => setView('cards')} data-testid="crm-view-cards" className={view === 'cards' ? 'is-active' : ''}>
              <LayoutGrid size={11} />
            </button>
            <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')} data-testid="crm-view-table" className={view === 'table' ? 'is-active' : ''}>
              <Rows size={11} />
            </button>
          </div>
          <button type="button" onClick={() => setShowNew(true)} data-testid="crm-new-account-btn" className="crm-btn crm-btn--primary">
            <Plus size={11} /> Nuovo Account
          </button>
        </div>
      </div>

      {/* ── Filter bar (stage · type · health) ── */}
      {activeTab.filter !== '__followups__' && <div className="rl-list-filters" data-testid="crm-filters">
          <select value={filterStage} onChange={e => setFilterStage(e.target.value)} data-testid="crm-filter-stage">
            <option value="">{t('crm.crm_accounts.tutti_gli_stage')}</option>
            {CANONICAL_PIPELINE.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} data-testid="crm-filter-type">
            <option value="">{t('crm.crm_accounts.tutti_i_tipi')}</option>
            {Object.entries(ACCOUNT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filterHealth} onChange={e => setFilterHealth(e.target.value)} data-testid="crm-filter-health">
            <option value="">Health</option>
            <option value="healthy">Sano</option>
            <option value="stable">Stabile</option>
            <option value="needs_support">Necessita supporto</option>
            <option value="at_risk">A rischio</option>
            <option value="dormant">Dormiente</option>
          </select>
        </div>}

      {/* ── Body ── */}
      {loading && <p className="crm-loading">{t('crm.crm_accounts.caricamento')}</p>}

      {!loading && activeTab.filter === '__followups__' && <FollowUpsList followUps={followUps} onOpenAccount={openDrawer} />}

      {!loading && activeTab.filter !== '__followups__' && filtered.length === 0 && <div className="crm-empty-state" data-testid="crm-empty-state">
          <p className="crm-empty-state__eyebrow">{t('crm.crm_accounts.sala_delle_relazioni')}</p>
          <p className="crm-empty-state__lead">
            {activeTab.id === 'accounts'
              ? t('crm.crm_accounts.empty.accounts_lead', null, 'No Accounts yet. Begin composing the memory of your relationships.')
              : t('crm.crm_accounts.empty.other_lead', { label: activeTab.label.toLowerCase() }, `No ${activeTab.label.toLowerCase()} in this view.`)}
          </p>
          <p className="crm-empty-state__hint">
            {activeTab.id === 'accounts'
              ? t('crm.crm_accounts.empty.accounts_hint', null, 'An Account is a relationship — a client, a studio, a family. Contacts are the people inside that relationship.')
              : t('crm.crm_accounts.empty.other_hint', null, 'Try another tab or compose a new Account to begin.')}
          </p>
          <button type="button" className="crm-empty-state__cta-btn" data-testid="crm-empty-state-cta" onClick={() => setShowNew(true)}>
            <Plus size={12} /> {t("crm.crm_accounts.apri_il_primo_account")}
          </button>
        </div>}

      {!loading && activeTab.filter !== '__followups__' && filtered.length > 0 && view === 'cards' && <div className="crm-cards" data-testid="crm-cards">
          {filtered.map(a => <AccountCard key={a.id} account={a} onOpen={openDrawer} />)}
        </div>}

      {!loading && activeTab.filter !== '__followups__' && filtered.length > 0 && view === 'table' && <div className="crm-table-wrap">
          <table className="crm-table" data-testid="crm-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Primary contact</th>
                <th>Stage</th>
                <th>Source</th>
                <th>Last activity</th>
                <th>Open follow-ups</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => <AccountRow key={a.id} account={a} onOpen={openDrawer} />)}
            </tbody>
          </table>
        </div>}

      <NewAccountModal open={showNew} onClose={() => setShowNew(false)} onCreated={() => setReload(k => k + 1)} />

      {drawerAccount && <AccountDetailDrawer account={drawerAccount} onClose={closeDrawer} onChanged={() => {
      setReload(k => k + 1);
    }} />}
    </div>;
};

// ─── Follow-ups view (own tab) ──────────────────────────────────────
const FollowUpsList = ({
  followUps,
  onOpenAccount
}) => {
  const { t } = useT();
  return <div className="crm-followups" data-testid="crm-followups">
    {followUps.length === 0 && <p className="crm-empty-state__lead">{t('crm.crm_accounts.no_follow_ups', null, 'No open follow-ups. 🎉')}</p>}
    {followUps.map(f => <div key={f.id} className="crm-followup" data-testid={`crm-followup-${f.id}`}>
        <div className="crm-followup__main">
          <p className="crm-followup__title">{f.title || t('crm.crm_accounts.action', null, 'Action')}</p>
          <p className="crm-followup__meta">{f.due_date ? `${t('crm.crm_accounts.due', null, 'Due')} · ${new Date(f.due_date).toLocaleDateString()}` : t('crm.crm_accounts.no_due_date', null, 'No due date')} · {f.action_type || 'task'}</p>
        </div>
        {f.account_id && <button type="button" className="crm-btn crm-btn--ghost" onClick={() => onOpenAccount({
      id: f.account_id,
      account_name: '—'
    })}>
            {t("crm.crm_accounts.apri_account")}
          </button>}
      </div>)}
  </div>;
};
export default CrmAccountsPage;