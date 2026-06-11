/**
 * AdvisorDashboardPage — Advisor self-service dashboard.
 * Route: /advisor
 *
 * Sections:
 *   1. Overview · referrals count + health breakdown + referral link
 *   2. Referred Studios · cards with health label (no raw %)
 *   3. Recent Reports · last visits/calls/support
 *
 * NEVER exposes private tenant data (CRM contacts, projects, moodboards,
 * media files, billing). Only safe activity health summary.
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Copy, MapPin, BellRing, NotebookPen, Plus, ChevronRight, AlertTriangle } from 'lucide-react';
import api from '../../lib/api';
import { avatarPalette, initialsOf } from '../../lib/avatarHue';
import './advisor.css';
import { useT } from '../../i18n/useT';
const HEALTH_LABEL = {
  healthy: {
    lbl: 'Sano',
    color: '#10B981'
  },
  stable: {
    lbl: 'Stabile',
    color: '#88c0d0'
  },
  needs_support: {
    lbl: 'Necessita supporto',
    color: '#F59E0B'
  },
  at_risk: {
    lbl: 'A rischio',
    color: '#EF4444'
  },
  dormant: {
    lbl: 'Dormiente',
    color: '#6B7280'
  },
  pending: {
    lbl: 'In attesa',
    color: '#9CA3AF'
  }
};
const REPORT_TYPES = [{
  v: 'visit',
  l: 'Visita'
}, {
  v: 'call',
  l: 'Chiamata'
}, {
  v: 'onboarding',
  l: 'Onboarding'
}, {
  v: 'training',
  l: 'Training'
}, {
  v: 'support',
  l: 'Supporto'
}, {
  v: 'feedback',
  l: 'Feedback'
}, {
  v: 'issue',
  l: 'Issue'
}, {
  v: 'follow_up',
  l: 'Follow-up'
}];
const AdvisorDashboardPage = () => {
  const {
    t
  } = useT();
  const nav = useNavigate();
  const [me, setMe] = useState(null);
  const [refs, setRefs] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      const [m, r, rep] = await Promise.all([api.get('/api/advisor/me'), api.get('/api/advisor/referrals'), api.get('/api/advisor/reports')]);
      setMe(m.data);
      setRefs(r.data.referrals || []);
      setReports(rep.data.reports || []);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 403 || status === 404) {
        setForbidden(true);
      } else {
        toast.error('Errore nel caricamento Advisor');
      }
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const copyLink = () => {
    if (!me?.magic_link) return;
    navigator.clipboard.writeText(me.magic_link);
    toast.success('Magic link copiato');
  };
  if (loading) return <div className="adv-page"><div className="adv-loading">Carico…</div></div>;
  if (forbidden) return <div className="adv-page" data-testid="advisor-forbidden">
      <header className="adv-hero">
        <p className="adv-hero__eyebrow">Advisor · Partner Relationship</p>
        <h1 className="adv-hero__title">{t('advisor.advisor_dashboard.quest_area_e_riservata_agli_advisor_di_mood')}</h1>
        <p className="adv-hero__lead">
          {t("advisor.advisor_dashboard.il_tuo_account_non_e_collegato_a_un_profilo_adviso")}
        </p>
      </header>
      <button className="adv-btn adv-btn--ghost" onClick={() => nav('/dashboard')} data-testid="adv-back-to-dashboard">
        {t("advisor.advisor_dashboard.torna_alla_dashboard")}
      </button>
    </div>;
  if (!me) return <div className="adv-page"><div className="adv-empty"><p className="adv-empty__lead">Profilo Advisor non trovato.</p></div></div>;
  const adv = me.advisor;
  const pal = avatarPalette(adv.name);
  return <div className="adv-page" data-testid="advisor-dashboard">
      <header className="adv-hero">
        <p className="adv-hero__eyebrow">Advisor · Partner Relationship</p>
        <h1 className="adv-hero__title">Buongiorno, {adv.name.split(' ')[0]}.</h1>
        <p className="adv-hero__lead">
          {t("advisor.advisor_dashboard.la_tua_rete_di_studi_e_showroom_referenti_le_loro")}
        </p>
      </header>

      {/* Referral link card */}
      <section className="adv-link-card" data-testid="adv-link-card">
        <div className="adv-link-card__head">
          <span className="adv-link-card__eyebrow">Magic Link</span>
          <p className="adv-link-card__hint">
            {t("advisor.advisor_dashboard.condividi_con_uno_studio_o_showroom_sconto_del")} {adv.default_discount_percentage}% applicato all'iscrizione.
          </p>
        </div>
        <div className="adv-link-card__row">
          <code className="adv-link-card__url">{me.magic_link}</code>
          <button className="adv-btn adv-btn--ghost" onClick={copyLink} data-testid="adv-copy-link">
            <Copy size={11} /> Copia
          </button>
        </div>
      </section>

      {/* Health breakdown */}
      <section className="adv-pulse" data-testid="adv-pulse">
        <PulseCell num={me.referrals_total} lbl="Studi referenti" />
        <PulseCell num={(me.health_breakdown?.healthy || 0) + (me.health_breakdown?.stable || 0)} lbl="Attivi" accent />
        <PulseCell num={(me.health_breakdown?.needs_support || 0) + (me.health_breakdown?.at_risk || 0)} lbl="Da supportare" warn={(me.health_breakdown?.needs_support || 0) + (me.health_breakdown?.at_risk || 0) > 0} />
        <PulseCell num={me.health_breakdown?.dormant || 0} lbl="Dormienti" />
      </section>

      {/* Referred Studios */}
      <section className="adv-section">
        <div className="adv-section__head">
          <h2 className="adv-section__title">Studi e showroom referenti</h2>
        </div>
        {refs.length === 0 && <p className="adv-empty__hint" style={{
        padding: '24px 0'
      }}>
            {t("advisor.advisor_dashboard.non_hai_ancora_studi_referenti_inizia_condividendo")}
          </p>}
        <div className="adv-cards">
          {refs.map(r => {
          const hl = HEALTH_LABEL[r.current_health_status] || HEALTH_LABEL.pending;
          const tpal = avatarPalette(r.tenant_name || '');
          return <article key={r.id} className="adv-card adv-card--readonly" data-testid={`adv-referral-${r.id}`}>
                <div className="adv-card__head">
                  <span className="adv-card__avatar" style={{
                background: tpal.bg,
                color: tpal.fg,
                borderColor: tpal.border
              }}>
                    {initialsOf(r.tenant_name || '··')}
                  </span>
                  <div className="adv-card__head-text">
                    <p className="adv-card__name">{r.tenant_name || '—'}</p>
                    <p className="adv-card__code">
                      {[r.tenant_city, r.tenant_country].filter(Boolean).join(', ') || '—'}
                    </p>
                  </div>
                  <span className="adv-health-pill" style={{
                borderColor: hl.color
              }}>
                    <span className="adv-health-pill__dot" style={{
                  background: hl.color
                }} />
                    {hl.lbl}
                  </span>
                </div>
                <div className="adv-card__meta">
                  <span>Sub: {r.subscription_status || '—'}</span>
                  {r.last_activity_date && <span>· Ultima attività · {new Date(r.last_activity_date).toLocaleDateString('it-IT', {
                  day: '2-digit',
                  month: 'short'
                })}</span>}
                </div>
                {r.commission_eligible && <div className="adv-card__elig">
                    <strong>Commissione attiva</strong> · ciclo {r.current_period_start ? new Date(r.current_period_start).toLocaleDateString('it-IT', {
                month: 'short',
                year: '2-digit'
              }) : '—'}
                  </div>}
              </article>;
        })}
        </div>
      </section>

      {/* Reports recap */}
      <section className="adv-section">
        <div className="adv-section__head">
          <h2 className="adv-section__title">Report di supporto recenti</h2>
          <button className="adv-btn adv-btn--ghost" onClick={() => setShowReport(true)} data-testid="adv-new-report">
            <Plus size={11} /> {t('atelier_voice.advisor_dashboard.new_report', null, 'New report')}
          </button>
        </div>
        {reports.length === 0 && <p className="adv-empty__hint" style={{
        padding: '12px 0'
      }}>
            {t("advisor.advisor_dashboard.nessun_report_ancora_crea_il_primo_dopo_una_visita")}
          </p>}
        <div className="adv-report-list">
          {reports.slice(0, 10).map(rep => <article key={rep.id} className="adv-report-row" data-testid={`adv-report-${rep.id}`}>
              <span className="adv-report-row__type">{REPORT_TYPES.find(t => t.v === rep.report_type)?.l || rep.report_type}</span>
              <p className="adv-report-row__title">{rep.title || rep.summary?.slice(0, 60) || '—'}</p>
              <span className="adv-report-row__date">{rep.date}</span>
            </article>)}
        </div>
      </section>

      {showReport && <ReportDrawer onClose={() => {
      setShowReport(false);
      load();
    }} referrals={refs} />}
    </div>;
};
const PulseCell = ({
  num,
  lbl,
  accent,
  warn
}) => <div className={`adv-pulse__cell ${accent ? 'is-accent' : ''} ${warn ? 'is-warn' : ''}`}>
    <span className="adv-pulse__num">{num}</span>
    <span className="adv-pulse__lbl">{lbl}</span>
  </div>;
const ReportDrawer = ({
  onClose,
  referrals
}) => {
  const {
    t
  } = useT();
  const [form, setForm] = useState({
    tenant_id: '',
    report_type: 'visit',
    date: new Date().toISOString().slice(0, 10),
    title: '',
    summary: '',
    adoption_blockers: '',
    support_needed: '',
    outcome: '',
    next_step: '',
    follow_up_date: '',
    attendees: ''
  });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!form.title && !form.summary) {
      toast.error('Titolo o sommario richiesto');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form
      };
      if (!payload.tenant_id) delete payload.tenant_id;
      if (!payload.follow_up_date) delete payload.follow_up_date;
      await api.post('/api/advisor/reports', payload);
      toast.success('Report salvato');
      onClose();
    } catch (e) {
      toast.error('Salvataggio fallito');
    } finally {
      setSaving(false);
    }
  };
  return <div className="adv-drawer-bg" onClick={e => {
    if (e.target === e.currentTarget) onClose();
  }}>
      <aside className="adv-drawer" data-testid="adv-report-drawer">
        <header className="adv-drawer__head">
          <div>
            <p className="adv-eyebrow">{t('atelier_voice.advisor_dashboard.support_report', null, 'Support report')}</p>
            <h2 className="adv-drawer__title">{t('atelier_voice.advisor_dashboard.new_report', null, 'New report')}</h2>
          </div>
          <button onClick={onClose} className="adv-drawer__close"><span style={{
            fontSize: 18
          }}>×</span></button>
        </header>
        <div className="adv-drawer__body">
          <Field label="Studio/showroom (opzionale)" testid="rpt-tenant">
            <select className="adv-field__input" value={form.tenant_id} onChange={e => setForm({
            ...form,
            tenant_id: e.target.value
          })}>
              <option value="">{t('advisor.advisor_dashboard.nessuno_specifico')}</option>
              {referrals.map(r => <option key={r.tenant_id} value={r.tenant_id}>{r.tenant_name}</option>)}
            </select>
          </Field>
          <div className="adv-grid-2">
            <Field label="Tipo" testid="rpt-type">
              <select className="adv-field__input" value={form.report_type} onChange={e => setForm({
              ...form,
              report_type: e.target.value
            })}>
                {REPORT_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </Field>
            <Field label="Data" testid="rpt-date">
              <input type="date" className="adv-field__input" value={form.date} onChange={e => setForm({
              ...form,
              date: e.target.value
            })} />
            </Field>
          </div>
          <Field label="Titolo" testid="rpt-title">
            <input className="adv-field__input" value={form.title} onChange={e => setForm({
            ...form,
            title: e.target.value
          })} placeholder="Es. Visita allo showroom" />
          </Field>
          <Field label="Persone incontrate" testid="rpt-attendees">
            <input className="adv-field__input" value={form.attendees} onChange={e => setForm({
            ...form,
            attendees: e.target.value
          })} placeholder="es. Cliente A, Cliente B" />
          </Field>
          <Field label="Sommario" testid="rpt-summary">
            <textarea rows={3} className="adv-field__input" value={form.summary} onChange={e => setForm({
            ...form,
            summary: e.target.value
          })} placeholder="Cosa si è discusso, come è andata…" />
          </Field>
          <Field label="Blocchi adozione" testid="rpt-blockers">
            <textarea rows={2} className="adv-field__input" value={form.adoption_blockers} onChange={e => setForm({
            ...form,
            adoption_blockers: e.target.value
          })} placeholder={t("advisor.advisor_dashboard.cosa_li_sta_frenando_dall_usare_la_piattaforma")} />
          </Field>
          <Field label="Supporto richiesto" testid="rpt-support">
            <textarea rows={2} className="adv-field__input" value={form.support_needed} onChange={e => setForm({
            ...form,
            support_needed: e.target.value
          })} />
          </Field>
          <Field label="Esito" testid="rpt-outcome">
            <textarea rows={2} className="adv-field__input" value={form.outcome} onChange={e => setForm({
            ...form,
            outcome: e.target.value
          })} />
          </Field>
          <div className="adv-grid-2">
            <Field label="Next step" testid="rpt-next">
              <input className="adv-field__input" value={form.next_step} onChange={e => setForm({
              ...form,
              next_step: e.target.value
            })} />
            </Field>
            <Field label="Follow-up" testid="rpt-followup">
              <input type="date" className="adv-field__input" value={form.follow_up_date} onChange={e => setForm({
              ...form,
              follow_up_date: e.target.value
            })} />
            </Field>
          </div>
        </div>
        <footer className="adv-drawer__foot">
          <button className="adv-btn adv-btn--ghost" onClick={onClose}>{t('advisor.advisor_dashboard.annulla')}</button>
          <button className="adv-btn adv-btn--primary" onClick={submit} disabled={saving} data-testid="rpt-submit">
            {saving ? 'Salvataggio…' : 'Salva report'}
          </button>
        </footer>
      </aside>
    </div>;
};
const Field = ({
  label,
  children,
  testid
}) => <label className="adv-field" data-testid={testid}>
    <span className="adv-field__lbl">{label}</span>
    {children}
  </label>;
export default AdvisorDashboardPage;