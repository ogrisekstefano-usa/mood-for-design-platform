/**
 * AdvisorDetailPage — SuperAdmin deep-dive on a single Advisor.
 * Route: /admin/advisors/:id
 *
 * Sections:
 *   1. Back link + hero with status pill
 *   2. Profile block (territory, code, contacts, commission %, discount %)
 *   3. Referred studios list (with health pills + commission eligibility)
 *   4. Commission periods table (6-month windows)
 *   5. Recent support reports
 *
 * Non si replicano stats motivazionali / leaderboard. Tutto è centrato
 * sulla qualità della relazione territoriale, non sul volume.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Copy, MapPin, Pencil } from 'lucide-react';
import api from '../../lib/api';
import { avatarPalette, initialsOf } from '../../lib/avatarHue';
import TerritorySelector from '../../components/advisor/TerritorySelector';
import AdvisorEditDrawer from './AdvisorEditDrawer';
import '../advisor/advisor.css';
import { useT } from '../../i18n/useT';

const STATUS_LABEL = { active: 'Attivo', paused: 'In pausa', archived: 'Archiviato' };

const HEALTH_LABEL = {
  healthy:       { lbl: 'Sano',                color: '#10B981' },
  stable:        { lbl: 'Stabile',             color: '#88c0d0' },
  needs_support: { lbl: 'Necessita supporto',  color: '#F59E0B' },
  at_risk:       { lbl: 'A rischio',           color: '#EF4444' },
  dormant:       { lbl: 'Dormiente',           color: '#6B7280' },
  pending:       { lbl: 'In attesa',           color: '#9CA3AF' },
};

const PERIOD_STATUS_LABEL = {
  eligible:     'Eleggibile',
  approved:     'Approvata',
  paid:         'Pagata',
  not_eligible: 'Non eleggibile',
};

const REPORT_TYPE_LABEL = {
  visit: 'Visita', call: 'Chiamata', onboarding: 'Onboarding',
  training: 'Training', support: 'Supporto', feedback: 'Feedback',
  issue: 'Issue', follow_up: 'Follow-up',
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
};

const fmtMoney = (n) => {
  if (n == null) return '—';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n);
};

const AdvisorDetailPage = () => {
  const { t } = useT();
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/api/advisor/admin/advisors/${id}`);
      setData(r.data);
    } catch (e) {
      toast.error('Advisor non trovato');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const updateStatus = async (status) => {
    try {
      await api.patch(`/api/advisor/admin/advisors/${id}`, { status });
      toast.success(`Status aggiornato · ${STATUS_LABEL[status]}`);
      load();
    } catch (e) {
      toast.error('Aggiornamento fallito');
    }
  };

  const copyCode = () => {
    if (!data?.advisor?.advisor_code) return;
    navigator.clipboard.writeText(data.advisor.advisor_code);
    toast.success('Codice copiato');
  };

  if (loading) return <div className="adv-page"><div className="adv-loading">Carico…</div></div>;
  if (!data) return (
    <div className="adv-page">
      <div className="adv-empty"><p className="adv-empty__lead">Advisor non trovato</p></div>
    </div>
  );

  const adv = data.advisor;
  const refs = data.referrals || [];
  const periods = data.commission_periods || [];
  const reports = data.reports || [];
  const pal = avatarPalette(adv.name);

  return (
    <div className="adv-page" data-testid="advisor-detail-page">
      <button type="button" className="adv-hero__back" onClick={() => nav('/admin/advisors')} data-testid="adv-detail-back">
        <ArrowLeft size={12} /> Network Advisor
      </button>

      <header className="adv-hero">
        <p className="adv-hero__eyebrow">Profilo Advisor · {adv.advisor_code}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span className="adv-card__avatar"
                style={{ background: pal.bg, color: pal.fg, borderColor: pal.border, width: 52, height: 52, fontSize: 15 }}>
            {initialsOf(adv.name)}
          </span>
          <div style={{ flex: 1 }}>
            <h1 className="adv-hero__title" style={{ marginBottom: 6 }}>{adv.name}</h1>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className={`adv-status-pill adv-status-pill--${adv.status}`} data-testid="adv-detail-status">
                {STATUS_LABEL[adv.status] || adv.status}
              </span>
              {adv.territory && (
                <span className="adv-card__terr"><MapPin size={11} /> {adv.territory}</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="adv-btn adv-btn--primary"
                    onClick={() => setEditOpen(true)}
                    data-testid="adv-detail-edit-open">
              <Pencil size={11} /> Modifica
            </button>
            {adv.status !== 'active' && (
              <button className="adv-btn adv-btn--ghost" onClick={() => updateStatus('active')} data-testid="adv-set-active">
                Attiva
              </button>
            )}
            {adv.status !== 'paused' && adv.status !== 'archived' && (
              <button className="adv-btn adv-btn--ghost" onClick={() => updateStatus('paused')} data-testid="adv-set-paused">
                Metti in pausa
              </button>
            )}
            {adv.status !== 'archived' && (
              <button className="adv-btn adv-btn--ghost" onClick={() => updateStatus('archived')} data-testid="adv-set-archived">
                Archivia
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="adv-detail-grid">
        {/* ── Sidebar ─────────────────────────────────────────────── */}
        <aside className="adv-detail-side">
          <section className="adv-detail-block" data-testid="adv-detail-profile">
            <h3 className="adv-detail-block__head">{t('admin.advisor_detail.contatti')}</h3>
            <div className="adv-detail-row"><span>Email</span><span>{adv.email || '—'}</span></div>
            <div className="adv-detail-row"><span>Telefono</span><span>{adv.phone || '—'}</span></div>
            <div className="adv-detail-row"><span>Territorio</span><span>{adv.territory || '—'}</span></div>
          </section>

          <section className="adv-detail-block" data-testid="adv-detail-codes">
            <h3 className="adv-detail-block__head">Codice & link</h3>
            <div className="adv-detail-row"><span>Codice</span>
              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                <code style={{ fontSize: 12 }}>{adv.advisor_code}</code>
                <button onClick={copyCode}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--bp-primary, #C9A36E)' }}
                        data-testid="adv-detail-copy-code">
                  <Copy size={11} />
                </button>
              </span>
            </div>
            <div className="adv-detail-row"><span>Sconto default</span><span>{adv.default_discount_percentage}%</span></div>
            <div className="adv-detail-row"><span>Commissione</span><span>{adv.commission_percentage}%</span></div>
            <div className="adv-detail-row"><span>Ciclo payout</span><span>{adv.payout_cycle_months || 6} mesi</span></div>
            <div className="adv-detail-row"><span>Mesi qualif. minimi</span><span>{adv.minimum_qualified_months || 6}</span></div>
          </section>

          <section className="adv-detail-block">
            <h3 className="adv-detail-block__head">Anagrafica</h3>
            <div className="adv-detail-row"><span>Creato</span><span>{fmtDate(adv.created_at)}</span></div>
            <div className="adv-detail-row"><span>Aggiornato</span><span>{fmtDate(adv.updated_at)}</span></div>
          </section>

          <section className="adv-detail-block" data-testid="adv-detail-territories-block">
            <h3 className="adv-detail-block__head">Presenza territoriale</h3>
            <p className="adv-detail-block__caption">
              Orchestrazione delle aree di rappresentanza · territorio primario + aree di copertura.
            </p>
            <TerritorySelector advisorId={adv.id} locale="it-IT" />
          </section>
        </aside>

        {/* ── Main column ─────────────────────────────────────────── */}
        <div className="adv-detail-main">
          {/* Referred studios */}
          <section data-testid="adv-detail-referrals">
            <div className="adv-section__head" style={{ marginBottom: 14 }}>
              <h2 className="adv-section__title">Studi & showroom referenti</h2>
              <span style={{ fontSize: 11, color: 'var(--bp-text-muted, #6B6863)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                {refs.length} totali
              </span>
            </div>
            {refs.length === 0 && (
              <p className="adv-empty__hint" style={{ padding: '12px 0' }}>
                Nessuna referenza ancora. Quando uno studio firma con il magic link di questo Advisor, comparirà qui.
              </p>
            )}
            <div className="adv-cards">
              {refs.map((r) => {
                const hl = HEALTH_LABEL[r.current_health_status] || HEALTH_LABEL.pending;
                const tpal = avatarPalette(r.tenant_name || '');
                return (
                  <article key={r.id} className="adv-card adv-card--readonly" data-testid={`adv-detail-ref-${r.id}`}>
                    <div className="adv-card__head">
                      <span className="adv-card__avatar"
                            style={{ background: tpal.bg, color: tpal.fg, borderColor: tpal.border }}>
                        {initialsOf(r.tenant_name || '··')}
                      </span>
                      <div className="adv-card__head-text">
                        <p className="adv-card__name">{r.tenant_name || '—'}</p>
                        <p className="adv-card__code">
                          {[r.tenant_city, r.tenant_country].filter(Boolean).join(', ') || r.referral_code}
                        </p>
                      </div>
                      <span className="adv-health-pill" style={{ borderColor: hl.color, color: hl.color }}>
                        <span className="adv-health-pill__dot" style={{ background: hl.color }} />
                        {hl.lbl}
                      </span>
                    </div>
                    <div className="adv-card__stats">
                      <span>Sub: <strong>{r.subscription_status || '—'}</strong></span>
                      <span>Sconto: <strong>{r.discount_applied || 0}%</strong></span>
                      {r.commission_eligible && (
                        <span className="adv-card__comm">Commissione attiva</span>
                      )}
                    </div>
                    <div className="adv-card__meta" style={{ fontSize: 11.5 }}>
                      <span>Iscrizione · {fmtDate(r.signup_date)}</span>
                      {r.last_activity_date && <span>· Ultima attività · {fmtDate(r.last_activity_date)}</span>}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Commission periods */}
          <section data-testid="adv-detail-commissions">
            <div className="adv-section__head" style={{ marginBottom: 8 }}>
              <h2 className="adv-section__title">Cicli di commissione</h2>
              <span style={{ fontSize: 11, color: 'var(--bp-text-muted, #6B6863)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Valutazione ogni 6 mesi
              </span>
            </div>
            {periods.length === 0 && (
              <p className="adv-empty__hint" style={{ padding: '12px 0' }}>
                Nessun ciclo valutato ancora. I cicli si chiudono ogni 6 mesi e premiano studi con attività reale.
              </p>
            )}
            {periods.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table className="adv-period-table">
                  <thead>
                    <tr>
                      <th>Periodo</th>
                      <th>Mesi qualif.</th>
                      <th>Base revenue</th>
                      <th>%</th>
                      <th>Commissione</th>
                      <th>Stato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map((p) => (
                      <tr key={p.id} data-testid={`adv-period-${p.id}`}>
                        <td>{fmtDate(p.period_start)} → {fmtDate(p.period_end)}</td>
                        <td>{p.months_qualified} / {p.months_total}</td>
                        <td>{fmtMoney(p.revenue_base)}</td>
                        <td>{p.commission_percentage}%</td>
                        <td>{fmtMoney(p.commission_amount)}</td>
                        <td>
                          <span className={`adv-period-pill adv-period-pill--${p.status}`}>
                            {PERIOD_STATUS_LABEL[p.status] || p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Recent support reports */}
          <section data-testid="adv-detail-reports">
            <div className="adv-section__head" style={{ marginBottom: 8 }}>
              <h2 className="adv-section__title">Report di supporto recenti</h2>
              <span style={{ fontSize: 11, color: 'var(--bp-text-muted, #6B6863)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Ultimi 50
              </span>
            </div>
            {reports.length === 0 && (
              <p className="adv-empty__hint" style={{ padding: '12px 0' }}>
                Nessun report ancora. L'Advisor può registrare visite, call e supporto dal proprio dashboard.
              </p>
            )}
            <div className="adv-report-list">
              {reports.map((rep) => (
                <article key={rep.id} className="adv-report-row" data-testid={`adv-rep-${rep.id}`}>
                  <span className="adv-report-row__type">{REPORT_TYPE_LABEL[rep.report_type] || rep.report_type}</span>
                  <p className="adv-report-row__title">{rep.title || rep.summary?.slice(0, 80) || '—'}</p>
                  <span className="adv-report-row__date">{fmtDate(rep.date)}</span>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>

      <AdvisorEditDrawer open={editOpen}
                         advisor={adv}
                         onClose={() => setEditOpen(false)}
                         onSaved={() => { setEditOpen(false); load(); }} />
    </div>
  );
};

export default AdvisorDetailPage;
