/**
 * AccountDetailDrawer — 9-tab account-centered detail panel.
 *
 *   Overview · Contacts · Timeline · Projects · Moodboards ·
 *   Files · Follow-ups · Notes · Style & Interests
 *
 * Right-aligned drawer (max 880px) for editorial calm without
 * full-page navigation context loss.
 */
import React, { useEffect, useState } from 'react';
import {
  X, UserCircle, FileText, ListChecks, Folder, Layers,
  Compass, BellRing, NotebookPen, Palette, Clock, Plus, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { avatarPalette, initialsOf } from '../../lib/avatarHue';

const TABS = [
  { id: 'overview',  label: 'Overview',  icon: FileText },
  { id: 'contacts',  label: 'Contacts',  icon: UserCircle },
  { id: 'timeline',  label: 'Timeline',  icon: Clock },
  { id: 'projects',  label: 'Projects',  icon: Folder },
  { id: 'moodboards',label: 'Moodboards',icon: Layers },
  { id: 'files',     label: 'Files',     icon: Compass },
  { id: 'followups', label: 'Follow-ups',icon: BellRing },
  { id: 'notes',     label: 'Notes',     icon: NotebookPen },
  { id: 'style',     label: 'Style',     icon: Palette },
];

// ─── Helpers per la testata editoriale ─────────────────────────────
const STAGE_LABEL = {
  discovery: 'Discovery', inspiration: 'Inspiration',
  editorial_engagement: 'Editorial', project_conversation: 'In conversazione',
  material_exploration: 'Materiali', strategic_direction: 'Direzione',
  specification: 'Specifica', proposal: 'Proposta',
  active_collaboration: 'Attivo', long_term_relationship: 'Long-term',
  archived: 'Archivio',
};
const STAGE_COLOR = {
  discovery: '#9CA3AF', inspiration: '#88c0d0', editorial_engagement: '#88c0d0',
  project_conversation: '#5B7CA0', material_exploration: '#b08d57',
  strategic_direction: '#b08d57', specification: '#F59E0B',
  proposal: '#D4AF37', active_collaboration: '#10B981',
  long_term_relationship: '#10B981', archived: '#6B7280',
};
const initialsOfLocal = (name) => initialsOf(name);  // re-export reference
const relativeTime = (iso) => {
  if (!iso) return '—';
  try {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'ora';
    if (diff < 3600) return `${Math.floor(diff / 60)}m fa`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h fa`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}g fa`;
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  } catch { return '—'; }
};

const Field = ({ label, value, mono }) => (
  <div className="adr-field">
    <p className="adr-field__label">{label}</p>
    <p className={`adr-field__value ${mono ? 'is-mono' : ''}`}>{value || <span className="adr-empty">—</span>}</p>
  </div>
);

// ─── Overview pane ─────────────────────────────────────────────────
const OverviewPane = ({ account, primary }) => (
  <div className="adr-grid">
    <Field label="Account name" value={account.account_name} />
    <Field label="Tipo" value={account.account_type} mono />
    <Field label="Lifecycle stage" value={account.lifecycle_stage} mono />
    <Field label="Source" value={account.source} mono />
    <Field label="Owner" value={account.primary_owner_id || account.owner_email} mono />
    <Field label="Città" value={account.city} />
    <Field label="Paese" value={account.country} mono />
    <Field label="Telefono" value={account.phone || primary?.phone} mono />
    <Field label="Email" value={account.email || primary?.email} mono />
    <Field label="Ultima attività" value={account.last_activity_at ? new Date(account.last_activity_at).toLocaleString('it-IT') : '—'} mono />
  </div>
);

// ─── Contacts pane ─────────────────────────────────────────────────
const ContactsPane = ({ accountId }) => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', role_title: '' });

  const load = async () => {
    setLoading(true);
    try {
      // Contacts are embedded in GET /accounts/{id} — no dedicated GET endpoint exists.
      const r = await api.get(`/api/relationships/accounts/${accountId}`);
      setContacts(r.data?.contacts || []);
    } catch {
      setContacts([]);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [accountId]);

  const submit = async () => {
    if (!form.first_name && !form.last_name) return toast.error('Inserisci almeno nome o cognome');
    try {
      await api.post(`/api/relationships/accounts/${accountId}/contacts`, form);
      toast.success('Contact aggiunto');
      setShowAdd(false);
      setForm({ first_name: '', last_name: '', email: '', phone: '', role_title: '' });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Salvataggio fallito');
    }
  };

  return (
    <div data-testid="adr-contacts-pane">
      <p className="adr-helper">
        I Contact sono <strong>persone esterne</strong> collegate a questo Account.
        I membri del Team appartengono alla sezione <strong>Team</strong> e non vengono mischiati qui.
      </p>
      {loading && <p className="adr-empty">Caricamento…</p>}
      {!loading && contacts.length === 0 && (
        <p className="adr-empty">Nessun contact ancora. Aggiungi il primo qui sotto.</p>
      )}
      <div className="adr-list">
        {contacts.map((c) => (
          <div key={c.id} className="adr-card" data-testid={`adr-contact-${c.id}`}>
            <div className="adr-card__head">
              <p className="adr-card__title">
                {c.full_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || '—'}
                {c.primary_contact && <span className="adr-chip">primary</span>}
              </p>
              <p className="adr-card__meta">{c.role_title || '—'}</p>
            </div>
            <div className="adr-card__row">
              {c.email && <span className="adr-mono">{c.email}</span>}
              {c.phone && <span className="adr-mono">· {c.phone}</span>}
            </div>
          </div>
        ))}
      </div>
      {!showAdd ? (
        <button type="button" className="crm-btn crm-btn--ghost" onClick={() => setShowAdd(true)} data-testid="adr-contact-add">
          <Plus size={11} /> Aggiungi contact
        </button>
      ) : (
        <div className="adr-form" data-testid="adr-contact-form">
          <div className="adr-form__row">
            <input className="crm-input" placeholder="Nome" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            <input className="crm-input" placeholder="Cognome" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          </div>
          <input className="crm-input" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="crm-input" placeholder="Telefono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="crm-input" placeholder="Ruolo (es. Founder, Specifier, …)" value={form.role_title} onChange={(e) => setForm({ ...form, role_title: e.target.value })} />
          <div className="adr-form__actions">
            <button type="button" className="crm-btn crm-btn--ghost" onClick={() => setShowAdd(false)}>Annulla</button>
            <button type="button" className="crm-btn crm-btn--primary" onClick={submit} data-testid="adr-contact-submit">Salva</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Timeline pane (interactions) ──────────────────────────────────
const TimelinePane = ({ accountId }) => {
  const [items, setItems] = useState([]);
  useEffect(() => {
    api.get(`/api/relationships/accounts/${accountId}/interactions`)
       .then((r) => setItems(r.data?.interactions || []))
       .catch(() => setItems([]));
  }, [accountId]);
  return (
    <div data-testid="adr-timeline-pane">
      {items.length === 0 && <p className="adr-empty">Nessuna interazione registrata.</p>}
      <ul className="adr-timeline">
        {items.map((it) => (
          <li key={it.id} className="adr-timeline__item">
            <span className="adr-timeline__dot" />
            <div className="adr-timeline__body">
              <p className="adr-timeline__title">{it.subject || it.interaction_type || 'Interazione'}</p>
              <p className="adr-timeline__meta">{it.occurred_at ? new Date(it.occurred_at).toLocaleString('it-IT') : ''} · {it.channel || '—'}</p>
              {it.summary && <p className="adr-timeline__body-text">{it.summary}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

// ─── Projects pane ─────────────────────────────────────────────────
const ProjectsPane = ({ accountId }) => {
  const [links, setLinks] = useState([]);
  useEffect(() => {
    api.get(`/api/relationships/accounts/${accountId}/projects`)
       .then((r) => setLinks(r.data?.links || []))
       .catch(() => setLinks([]));
  }, [accountId]);
  return (
    <div data-testid="adr-projects-pane">
      {links.length === 0 && <p className="adr-empty">Nessun progetto collegato.</p>}
      {links.map((l) => (
        <div key={l.id} className="adr-card" data-testid={`adr-project-${l.id}`}>
          <p className="adr-card__title">Project · {l.project_id?.slice(0, 8)}</p>
          <p className="adr-card__meta">role · {l.role} {l.collaboration_stage ? `· stage @ link · ${l.collaboration_stage}` : ''}</p>
          {l.notes && <p className="adr-card__row">{l.notes}</p>}
        </div>
      ))}
    </div>
  );
};

// ─── Moodboards pane ───────────────────────────────────────────────
const MoodboardsPane = ({ account }) => (
  <div data-testid="adr-moodboards-pane">
    <p className="adr-empty">
      Linkaggio Moodboard arriva in P1 dedicato.
      Le moodboard create da team sono visibili in <strong>Workspace · Moodboards</strong>.
    </p>
  </div>
);

// ─── Files / Notes / Meetings / Style placeholders ─────────────────
const FilesPane = () => (
  <div data-testid="adr-files-pane"><p className="adr-empty">Files allegati arriva con il Media Library inspector.</p></div>
);
const NotesPane = () => (
  <div data-testid="adr-notes-pane"><p className="adr-empty">Notes editor in P1.</p></div>
);
const FollowUpsPane = ({ accountId }) => {
  const [items, setItems] = useState([]);
  useEffect(() => {
    api.get(`/api/relationships/accounts/${accountId}/actions`)
       .then((r) => setItems(r.data?.actions || []))
       .catch(() => setItems([]));
  }, [accountId]);
  return (
    <div data-testid="adr-followups-pane">
      {items.length === 0 && <p className="adr-empty">Nessun follow-up programmato.</p>}
      {items.map((a) => (
        <div key={a.id} className="adr-card">
          <p className="adr-card__title">{a.title}</p>
          <p className="adr-card__meta">{a.action_type} · {a.due_date ? new Date(a.due_date).toLocaleDateString('it-IT') : '—'} · status {a.status}</p>
        </div>
      ))}
    </div>
  );
};
const StylePane = ({ accountId }) => {
  const [style, setStyle] = useState(null);
  useEffect(() => {
    api.get(`/api/relationships/accounts/${accountId}/style`)
       .then((r) => setStyle(r.data?.style || null))
       .catch(() => setStyle(null));
  }, [accountId]);
  return (
    <div data-testid="adr-style-pane">
      {!style && <p className="adr-empty">Style DNA non ancora compilato per questo Account.</p>}
      {style && (
        <>
          <Field label="Atmosphere" value={(style.atmosphere_tags || []).join(' · ')} />
          <Field label="Materials" value={(style.preferred_materials || []).join(' · ')} />
          <Field label="Budget range" value={style.budget_range} mono />
        </>
      )}
    </div>
  );
};

// ─── Main drawer ───────────────────────────────────────────────────
const AccountDetailDrawer = ({ account, onClose, onChanged }) => {
  const [tab, setTab] = useState('overview');
  const [full, setFull] = useState(account);
  const [primary, setPrimary] = useState(account?.primary_contact);

  useEffect(() => {
    if (!account?.id) return;
    api.get(`/api/relationships/accounts/${account.id}`).then((r) => {
      const a = r.data?.account || r.data;
      setFull(a || account);
      const contacts = r.data?.contacts || [];
      setPrimary(contacts.find((c) => c.primary_contact) || contacts[0] || account.primary_contact);
    }).catch(() => {});
  }, [account?.id]);

  if (!account) return null;
  const displayName = full?.account_name || account.account_name;
  const stage = full?.lifecycle_stage || account.lifecycle_stage;
  const stageLbl = STAGE_LABEL[stage] || stage || '—';
  const stageCol = STAGE_COLOR[stage] || '#9CA3AF';
  const pal = avatarPalette(displayName);
  const owner = full?.primary_owner_email || full?.primary_owner_id || account.primary_owner_id;
  const openCount = full?.open_actions_count || account.open_actions_count || 0;
  const nextDue = full?.next_followup_due_at || account.next_followup_due_at;
  const lastAct = full?.last_activity_at || account.last_activity_at;

  return (
    <div className="adr-bg"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
         data-testid="account-detail-drawer">
      <aside className="adr" onClick={(e) => e.stopPropagation()}>
        <header className="adr__head">
          <div className="adr__head-main">
            <span className="adr__avatar"
                  style={{ background: pal.bg, color: pal.fg, borderColor: pal.border }}
                  aria-hidden>{initialsOf(displayName)}</span>
            <div className="adr__head-text">
              <p className="adr__eyebrow">CRM · Account</p>
              <h2 className="adr__title">{displayName}</h2>
              <p className="adr__sub">{full?.account_type || account.account_type || '—'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="adr__close" data-testid="adr-close" aria-label="Chiudi">
            <X size={17} />
          </button>
        </header>

        {/* Quick facts row — sempre visibile */}
        <div className="adr__facts" data-testid="adr-quick-facts">
          <div className="adr__fact">
            <span className="adr__fact-lbl">Stage</span>
            <span className="adr__fact-val">
              <span className="adr__stage-pill" style={{ borderColor: stageCol }}>
                <span className="adr__stage-pill-dot" style={{ backgroundColor: stageCol }} />
                {stageLbl}
              </span>
            </span>
          </div>
          <div className="adr__fact">
            <span className="adr__fact-lbl">Owner</span>
            <span className="adr__fact-val">{owner || <em className="adr-empty">non assegnato</em>}</span>
          </div>
          <div className="adr__fact">
            <span className="adr__fact-lbl">Ultima attività</span>
            <span className="adr__fact-val">{relativeTime(lastAct)}</span>
          </div>
          <div className="adr__fact">
            <span className="adr__fact-lbl">Next step</span>
            <span className="adr__fact-val">
              {openCount > 0 ? (
                <button type="button" className="adr__fact-action"
                        data-testid="adr-jump-followups"
                        onClick={() => setTab('followups')}>
                  {openCount} follow-up{openCount === 1 ? '' : ''} {nextDue ? `· ${new Date(nextDue).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}` : ''}
                </button>
              ) : (
                <em className="adr-empty">nessun follow-up</em>
              )}
            </span>
          </div>
        </div>

        <nav className="adr__tabs" role="tablist">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id}
                      role="tab"
                      aria-selected={active}
                      onClick={() => setTab(t.id)}
                      data-testid={`adr-tab-${t.id}`}
                      className={`adr__tab ${active ? 'is-active' : ''}`}>
                <Icon size={11} strokeWidth={1.6} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="adr__body">
          {tab === 'overview'  && <OverviewPane account={full} primary={primary} />}
          {tab === 'contacts'  && <ContactsPane accountId={account.id} />}
          {tab === 'timeline'  && <TimelinePane accountId={account.id} />}
          {tab === 'projects'  && <ProjectsPane accountId={account.id} />}
          {tab === 'moodboards'&& <MoodboardsPane account={full} />}
          {tab === 'files'     && <FilesPane />}
          {tab === 'followups' && <FollowUpsPane accountId={account.id} />}
          {tab === 'notes'     && <NotesPane />}
          {tab === 'style'     && <StylePane accountId={account.id} />}
        </div>
      </aside>
    </div>
  );
};

export default AccountDetailDrawer;
