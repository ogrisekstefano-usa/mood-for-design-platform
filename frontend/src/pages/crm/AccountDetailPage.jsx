/**
 * AccountDetailPage — Relationship OS™ full-page experience.
 *
 *   Layout:  Top bar (back · avatar · name · type · Quick Add +)
 *            Stage pills strip (clickable evolutionary stages)
 *            Body split:  [ Timeline left ] [ Summary panel right ]
 *
 * Mobile:    Stack vertical with sticky FAB for quick add.
 * Surface:   data-surface="os" so tenant theme can color the accent.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, Plus, Phone, Mail, MessageSquare, Mic, Calendar,
  FileText, Layers, MapPin, Compass, Sparkles, Feather, Globe,
  BellRing, NotebookPen, ChevronRight,
} from 'lucide-react';
import api from '../../lib/api';
import { avatarPalette, initialsOf } from '../../lib/avatarHue';
import ActivityModal from './ActivityModal';
import StageChangeModal, { CANONICAL_STAGES } from './StageChangeModal';
import CulturalEditionModal from './CulturalEditionModal';
import RelationshipGraph from './RelationshipGraph';
import AccountConstellation from './AccountConstellation';
import './relationship-os.css';
import './g3-overrides.css';

// ── icon glyph by interaction_type ──────────────────────────────────
const TYPE_GLYPH = {
  call: Phone, email: Mail, whatsapp: MessageSquare,
  voice_note: Mic, showroom_visit: MapPin, external_visit: MapPin,
  business_meeting: Calendar, casual_meeting: Calendar,
  moodboard_sent: Layers, moodboard_viewed: Layers,
  proposal_sent: FileText, proposal_opened: FileText, proposal_review: FileText,
  material_selection: Compass, project_update: Compass,
  post_visit_report: NotebookPen, internal_note: NotebookPen,
  follow_up: BellRing, ai_summary: Sparkles, stage_change: ChevronRight,
  discovery_interview: Sparkles,
};
const TYPE_LBL = {
  call: 'Telefonata', email: 'Email', whatsapp: 'WhatsApp',
  voice_note: 'Nota vocale', showroom_visit: 'Visita showroom',
  external_visit: 'Visita esterna', business_meeting: 'Meeting',
  casual_meeting: 'Incontro informale', moodboard_sent: 'Moodboard',
  moodboard_viewed: 'Moodboard vista', proposal_sent: 'Proposta',
  proposal_opened: 'Proposta aperta', proposal_review: 'Proposta in revisione',
  material_selection: 'Materiali', project_update: 'Progetto',
  post_visit_report: 'Report visita', internal_note: 'Nota',
  follow_up: 'Follow-up', ai_summary: 'Sintesi', stage_change: 'Stage',
  discovery_interview: 'Discovery',
};

// ── Quick add menu items ────────────────────────────────────────────
const QUICK_ITEMS = [
  { type: 'business_meeting', label: 'Log meeting',    icon: Calendar },
  { type: 'call',             label: 'Call',           icon: Phone },
  { type: 'voice_note',       label: 'Voice note',     icon: Mic },
  { type: 'showroom_visit',   label: 'Visit report',   icon: MapPin },
  { type: 'email',            label: 'Email',          icon: Mail },
  { type: 'internal_note',    label: 'Note',           icon: NotebookPen },
  { type: 'moodboard_sent',   label: 'Moodboard share',icon: Layers },
  { type: 'proposal_sent',    label: 'Proposal sent',  icon: FileText },
  { type: 'whatsapp',         label: 'WhatsApp',       icon: MessageSquare },
];

const fmtWhen = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60)    return 'ora';
    if (diff < 3600)  return `${Math.floor(diff / 60)}m fa`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h fa`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}g fa`;
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
};
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const ICON_BY_INSIGHT = { globe: Globe, compass: Compass, sparkles: Sparkles, feather: Feather };

// ─── Component ──────────────────────────────────────────────────────
const AccountDetailPage = () => {
  const { accountId } = useParams();
  const nav = useNavigate();

  const [summary, setSummary] = useState(null);
  const [interactions, setInteractions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activityOpen, setActivityOpen] = useState(false);
  const [activityType, setActivityType] = useState('internal_note');
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [stageTarget, setStageTarget] = useState(null);
  const [ceOpen, setCeOpen] = useState(false);

  const [filterType, setFilterType] = useState(''); // '' = all
  const quickRef = useRef();

  // ── Click outside quick add menu ──────────────────────────────────
  useEffect(() => {
    const fn = (e) => {
      if (!quickRef.current) return;
      if (!quickRef.current.contains(e.target)) setQuickMenuOpen(false);
    };
    if (quickMenuOpen) document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [quickMenuOpen]);

  // ── Loaders ──────────────────────────────────────────────────────
  const loadSummary = useCallback(async () => {
    try {
      const r = await api.get(`/api/relationships/accounts/${accountId}/summary`);
      setSummary(r.data);
    } catch (e) {
      toast.error('Account non trovato');
      setSummary(null);
    }
  }, [accountId]);

  const loadInteractions = useCallback(async () => {
    try {
      const r = await api.get(`/api/relationships/accounts/${accountId}/interactions?limit=200`);
      setInteractions(r.data?.interactions || []);
    } catch (e) {
      setInteractions([]);
    }
  }, [accountId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadSummary(), loadInteractions()]).finally(() => setLoading(false));
  }, [loadSummary, loadInteractions]);

  // ── Quick add handlers ───────────────────────────────────────────
  const onQuickPick = (t) => {
    setActivityType(t);
    setActivityOpen(true);
    setQuickMenuOpen(false);
  };

  const onActivityCreated = async () => {
    await Promise.all([loadInteractions(), loadSummary()]);
  };

  // ── Stage change ─────────────────────────────────────────────────
  const onStageChanged = async () => {
    await Promise.all([loadSummary(), loadInteractions()]);
  };

  // ── Derived ──────────────────────────────────────────────────────
  const account = summary?.account;
  const mood    = summary?.mood;
  const insights = summary?.insights || [];
  const owner   = summary?.owner;
  const advisor = summary?.advisor;
  const sub     = summary?.submarket;
  const style   = summary?.style;
  const nextAction = summary?.next_action;

  // Resolve localized submarket label (display_name → it-IT/en-US)
  const subLabel = (() => {
    if (!sub) return '';
    const dn = sub.display_name || sub.name || {};
    if (typeof dn === 'string') return dn;
    return dn['it-IT'] || dn['en-US'] || sub.code || '';
  })();

  const currentStage = account?.lifecycle_stage;
  const palette = useMemo(() => account ? avatarPalette(account.account_name || '') : { bg: '#222', fg: '#fff', border: '#444' }, [account]);

  // Filtered timeline
  const visible = useMemo(() => {
    if (!filterType) return interactions;
    return interactions.filter((i) => i.interaction_type === filterType);
  }, [interactions, filterType]);

  const filterCounts = useMemo(() => {
    const cnt = {};
    interactions.forEach((i) => { cnt[i.interaction_type] = (cnt[i.interaction_type] || 0) + 1; });
    return cnt;
  }, [interactions]);

  if (loading || !account) {
    return (
      <div className="crm-rl">
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--rl-ink-soft)' }}>
          {loading ? 'Carico la memoria della relazione…' : 'Account non disponibile.'}
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="crm-rl" data-surface="os" data-testid="account-detail-page">
      {/* Top bar */}
      <header className="rl-topbar">
        <button className="rl-topbar__back" onClick={() => nav('/crm/accounts')}
                data-testid="rl-back">
          <ArrowLeft size={12} /> Accounts
        </button>

        <div className="rl-topbar__title" style={{ flex: 1, justifyContent: 'flex-start' }}>
          <span className="rl-topbar__avatar"
                style={{ background: palette.bg, color: palette.fg, borderColor: palette.border }}>
            {initialsOf(account.account_name || '··')}
          </span>
          <div>
            <p className="rl-topbar__name" data-testid="rl-account-name">{account.account_name}</p>
            <span className="rl-topbar__type">{account.account_type?.replace(/_/g, ' ')}</span>
          </div>
        </div>

        <div className="rl-quickadd-wrap" ref={quickRef}>
          <button className="rl-quickadd-btn"
                  onClick={() => setQuickMenuOpen((v) => !v)}
                  data-testid="quick-add-btn">
            <span className="rl-quickadd-btn__icon"><Plus size={12} strokeWidth={2.5} /></span>
            Aggiungi
          </button>
          {quickMenuOpen && (
            <div className="rl-quickadd-menu" data-testid="quick-add-menu">
              {QUICK_ITEMS.map(({ type, label, icon: Icon }) => (
                <button key={type} className="rl-quickadd-item"
                        onClick={() => onQuickPick(type)}
                        data-testid={`quick-pick-${type}`}>
                  <Icon size={14} /> <span>{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* ── Sprint G.3 · Account = Constellation of Journeys™ ── */}
      <AccountConstellation accountId={accountId} />

      {/* Stage pills · LEGACY (kept for backwards compat with relationship_os) */}
      <div className="rl-stages rl-stages--legacy" data-testid="rl-stages">
        {CANONICAL_STAGES.map((s) => {
          const active = s.key === currentStage;
          return (
            <button key={s.key}
                    className={`rl-stage-pill ${active ? 'rl-stage-pill--current' : ''}`}
                    onClick={() => setStageTarget(s.key)}
                    style={!active ? { color: s.color } : undefined}
                    data-testid={`stage-pill-${s.key}`}>
              <span className="rl-stage-pill__dot" />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Split body */}
      <div className="rl-body">
        {/* ── Timeline left ── */}
        <section className="rl-timeline" data-testid="rl-timeline">
          <div className="rl-timeline__head">
            <h2 className="rl-timeline__title">Timeline relazione</h2>
            <div className="rl-timeline__filter">
              <button className={`rl-filter-chip ${!filterType ? 'rl-filter-chip--on' : ''}`}
                      onClick={() => setFilterType('')}
                      data-testid="rl-filter-all">
                Tutte · {interactions.length}
              </button>
              {Object.entries(filterCounts).slice(0, 6).map(([t, n]) => (
                <button key={t}
                        className={`rl-filter-chip ${filterType === t ? 'rl-filter-chip--on' : ''}`}
                        onClick={() => setFilterType(filterType === t ? '' : t)}
                        data-testid={`rl-filter-${t}`}>
                  {TYPE_LBL[t] || t} · {n}
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="rl-tl-empty">
              <p>La memoria della relazione è ancora bianca.</p>
              <p>Registra il primo contatto — una call, una nota vocale, una visita.<br />
                Ogni gesto diventa parte della storia.</p>
            </div>
          ) : (
            <div className="rl-tl-list">
              {visible.map((it) => {
                const Glyph = TYPE_GLYPH[it.interaction_type] || NotebookPen;
                const payload = it.report_payload || {};
                const audios = (it.attachments || []).filter((a) => a?.kind === 'audio' || (a?.mime || '').startsWith('audio/'));
                return (
                  <article key={it.id} className="rl-tl-card" data-testid={`rl-tl-${it.id}`}>
                    <span className="rl-tl-card__pin"><Glyph size={11} /></span>
                    <div className="rl-tl-card__box">
                      <div className="rl-tl-card__head">
                        <span className="rl-tl-card__type">{TYPE_LBL[it.interaction_type] || it.interaction_type}</span>
                        <span className="rl-tl-card__when">{fmtWhen(it.occurred_at)}</span>
                      </div>
                      {it.title && <p className="rl-tl-card__title">{it.title}</p>}
                      {it.summary && <p className="rl-tl-card__summary">{it.summary}</p>}
                      {audios.length > 0 && (
                        <div className="rl-tl-card__attachments">
                          {audios.map((a, i) => (
                            <div key={i} className="rl-tl-card__audio">
                              <Mic size={12} />
                              {a.url && <audio src={a.url} controls />}
                            </div>
                          ))}
                        </div>
                      )}
                      {payload.transcript && it.interaction_type === 'voice_note' && (
                        <div className="rl-tl-card__transcript" data-testid={`rl-transcript-${it.id}`}>
                          “{payload.transcript}”
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Summary panel right ── */}
        <aside className="rl-panel"
               data-testid="relationship-summary-panel"
               aria-label="Relationship Summary Panel">
          <p className="rl-panel__eyebrow">Relationship Summary™</p>
          <h3 className="rl-panel__title">{account.account_name}</h3>

          {/* Quick actions — placed early so concierge CTAs are always above the fold */}
          <div className="rl-panel__cta">
            <button className="rl-panel__cta-btn rl-panel__cta-btn--primary"
                    type="button"
                    onClick={() => setCeOpen(true)} data-testid="open-cultural-edition">
              <Globe size={13} /> Create a Cultural Edition™
            </button>
            <button className="rl-panel__cta-btn" type="button"
                    onClick={() => onQuickPick('voice_note')} data-testid="open-voice-note">
              <Mic size={13} /> Nota vocale rapida
            </button>
            <button className="rl-panel__cta-btn" type="button"
                    onClick={() => onQuickPick('follow_up')} data-testid="open-followup">
              <BellRing size={13} /> Pianifica follow-up
            </button>
          </div>

          <div className="rl-panel__row" style={{ marginTop: 16 }}>
            <span>Stage</span>
            <span>
              <span className="rl-tag rl-tag--accent">
                {(CANONICAL_STAGES.find((s) => s.key === currentStage)?.label) || currentStage || '—'}
              </span>
            </span>
          </div>
          <div className="rl-panel__row">
            <span>Health</span>
            <span>{account.relationship_health || '—'}</span>
          </div>
          <div className="rl-panel__row">
            <span>Owner</span>
            <span>{owner?.full_name || owner?.email || '—'}</span>
          </div>
          {advisor && (
            <>
              <div className="rl-panel__row">
                <span>Advisor</span>
                <span>{advisor.name} · {advisor.advisor_code}</span>
              </div>
              <div className="rl-panel__row">
                <span>Territory advisor</span>
                <span>{advisor.territory || '—'}</span>
              </div>
            </>
          )}
          <div className="rl-panel__row">
            <span>Territory cliente</span>
            <span>{[account.city, account.country].filter(Boolean).join(' · ') || '—'}</span>
          </div>
          <div className="rl-panel__row">
            <span>Ultimo contatto</span>
            <span>{fmtWhen(account.last_activity_at)}</span>
          </div>
          <div className="rl-panel__row">
            <span>Prossimo follow-up</span>
            <span>{nextAction ? `${fmtDate(nextAction.due_date)} · ${nextAction.title}` : '—'}</span>
          </div>
          <div className="rl-panel__row">
            <span>Mercato culturale</span>
            <span>{subLabel || account.market_submarket || account.country || '—'}</span>
          </div>
          <div className="rl-panel__row">
            <span>Mood prevalente</span>
            <span>
              {mood?.tags?.length ? (
                <span className="rl-tag-list">
                  {mood.tags.slice(0, 4).map((t) => (
                    <span key={t.tag} className="rl-tag">{t.tag}</span>
                  ))}
                </span>
              ) : '—'}
            </span>
          </div>
          <div className="rl-panel__row">
            <span>Materiali preferiti</span>
            <span>
              {style?.preferred_materials?.length ? (
                <span className="rl-tag-list">
                  {style.preferred_materials.slice(0, 5).map((m) => (
                    <span key={m} className="rl-tag">{m}</span>
                  ))}
                </span>
              ) : '—'}
            </span>
          </div>
          <div className="rl-panel__row">
            <span>Budget range</span>
            <span>{style?.budget_range || '—'}</span>
          </div>
          <div className="rl-panel__row">
            <span>Timeline progetto</span>
            <span>{style?.timing_range || '—'}</span>
          </div>

          {/* Micro-insights */}
          {insights.length > 0 && (
            <div className="rl-insights" data-testid="rl-insights">
              <p className="rl-panel__eyebrow" style={{ marginTop: 0 }}>Concierge Intelligence™</p>
              {insights.map((ins, i) => {
                const Icon = ICON_BY_INSIGHT[ins.icon] || Sparkles;
                return (
                  <div key={i} className="rl-insight">
                    <Icon size={14} className="rl-insight__icon" />
                    <p className="rl-insight__text">{ins.text}</p>
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      </div>

      {/* Relationship Graph™ — editorial connection map */}
      <RelationshipGraph accountId={accountId} />

      {/* Mobile FAB */}
      <button className="rl-fab" onClick={() => setQuickMenuOpen((v) => !v)} data-testid="rl-fab">
        <Plus size={22} strokeWidth={2.5} />
      </button>

      {/* Modals */}
      <ActivityModal open={activityOpen}
                     account={account}
                     defaultType={activityType}
                     onClose={() => setActivityOpen(false)}
                     onCreated={onActivityCreated} />

      <StageChangeModal open={!!stageTarget}
                        accountId={accountId}
                        currentStage={currentStage}
                        targetStage={stageTarget}
                        onClose={() => setStageTarget(null)}
                        onChanged={onStageChanged} />

      <CulturalEditionModal open={ceOpen}
                            accountId={accountId}
                            sourceType="account"
                            sourceId={accountId}
                            onClose={() => setCeOpen(false)}
                            onCreated={onActivityCreated} />
    </div>
  );
};

export default AccountDetailPage;
