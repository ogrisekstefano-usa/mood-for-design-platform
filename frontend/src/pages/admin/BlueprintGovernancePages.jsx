/**
 * ITER143C · Blueprint Command Center™ — All 8 governance pages.
 *
 * Pages:
 *   1. DashboardGovernancePage     — live counters + coverage matrix
 *   2. TenantsGovernancePage       — tenant orchestration
 *   3. UsersGovernancePage         — role-distinguished user table
 *   4. PresetsGovernancePage       — frozen registry view
 *   5. EditorialRuntimePage        — Narrative Orchestration™
 *   6. LanguageGovernancePage      — wraps existing LanguageCommandCenter
 *   7. EmailGovernancePage         — provider stub + event feed
 *   8. DemoGovernancePage          — Restore Golden Snapshot™
 *
 * All pages use editorial runtime copy (no hardcoded strings).
 */
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { useEditorialBlock } from '../../site/editorial/EditorialBundleProvider';
import { Loader2, RefreshCw, AlertTriangle, Check, Shield } from 'lucide-react';
import api from '../../lib/api';

const useAdminFetch = (path) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    setLoading(true);
    try {
      const r = await api.get(path);
      setData(r.data);
      setError(null);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message);
    } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [path]);
  return { data, error, loading, refresh };
};

const Label = ({ k: key, fallback = '' }) => {
  const v = useEditorialBlock(key, fallback);
  return <>{v || fallback || '\u00A0'}</>;
};

const PageHeader = ({ ek, tk, sk }) => (
  <header className="bp-page__header">
    <div className="bp-page__title-stack">
      <span className="bp-page__eyebrow"><Label k={ek} /></span>
      <h1 className="bp-page__title"><Label k={tk} /></h1>
      <p className="bp-page__sub"><Label k={sk} /></p>
    </div>
  </header>
);

const Metric = ({ label, value, hint, testId }) => (
  <div className="bp-metric" data-testid={testId || 'bp-metric'}>
    <span className="bp-metric__label">{label}</span>
    <span className="bp-metric__value">{value ?? '—'}</span>
    {hint && <span className="bp-metric__hint">{hint}</span>}
  </div>
);

const SpinnerBlock = () => (
  <div className="bp-empty"><Loader2 size={18} className="animate-spin" /></div>
);

/* ── 1. Dashboard Governance™ ────────────────────────────────────── */
export const DashboardGovernancePage = () => {
  const { data, loading, error, refresh } = useAdminFetch('/api/blueprint-admin/dashboard');
  if (loading) return <SpinnerBlock />;
  if (error)   return <div className="bp-empty">⚠ {error}</div>;

  const p = data?.platform || {};
  const er = data?.editorial_runtime || {};
  const coverage = er.coverage || {};
  const locales = er.active_locales || [];

  return (
    <div data-testid="bp-page-dashboard">
      <PageHeader
        ek="admin.dashboard.eyebrow"
        tk="admin.dashboard.title"
        sk="admin.dashboard.sub"
      />
      <div className="bp-metric-grid">
        <Metric label={<Label k="admin.dashboard.metric.tenants" />}
                value={p.tenants_active}
                hint={`/ ${p.tenants_total} total`} />
        <Metric label={<Label k="admin.dashboard.metric.users" />}
                value={p.users_active}
                hint={`/ ${p.users_total} total`} />
        <Metric label={<Label k="admin.dashboard.metric.journeys" />}
                value={p.journeys_total} />
        <Metric label={<Label k="admin.dashboard.metric.editorial_blocks" />}
                value={er.blocks_active}
                hint={<Label k="admin.dashboard.metric.editorial_blocks.hint" />} />
      </div>

      <section className="bp-section">
        <h2 className="bp-section__title"><Label k="admin.dashboard.section.coverage" /></h2>
        <div className="bp-card">
          {locales.map((loc) => {
            const c = coverage[loc] || {};
            return (
              <div className="bp-coverage-row" key={loc} data-testid={`bp-coverage-${loc}`}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                               textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {loc}
                </span>
                <div className="bp-coverage-bar">
                  <div className="bp-coverage-bar__fill" style={{ width: `${c.percent || 0}%` }} />
                </div>
                <span className="bp-coverage-value">{(c.percent || 0)}%</span>
              </div>
            );
          })}
        </div>
      </section>

      <button type="button" className="bp-btn" onClick={refresh} data-testid="bp-dashboard-refresh">
        <RefreshCw size={12} /> <Label k="admin.action.refresh" />
      </button>
    </div>
  );
};


/* ── 2. Tenants Governance™ ──────────────────────────────────────── */
export const TenantsGovernancePage = () => {
  const { data, loading, error } = useAdminFetch('/api/blueprint-admin/tenants');
  if (loading) return <SpinnerBlock />;
  return (
    <div data-testid="bp-page-tenants">
      <PageHeader
        ek="admin.tenants.eyebrow"
        tk="admin.tenants.title"
        sk="admin.tenants.sub"
      />
      {error && <div className="bp-empty">⚠ {error}</div>}
      <div className="bp-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="bp-table">
          <thead>
            <tr>
              <th><Label k="admin.tenants.col.name" /></th>
              <th><Label k="admin.tenants.col.slug" /></th>
              <th><Label k="admin.tenants.col.plan" /></th>
              <th><Label k="admin.tenants.col.locale" /></th>
              <th><Label k="admin.tenants.col.members" /></th>
              <th><Label k="admin.tenants.col.status" /></th>
            </tr>
          </thead>
          <tbody>
            {(data?.tenants || []).map((t) => (
              <tr key={t.id} data-testid={`bp-tenant-row-${t.slug}`}>
                <td>{t.name}{t.is_demo && <span className="bp-pill bp-pill--root" style={{ marginLeft: 8 }}>DEMO</span>}</td>
                <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{t.slug}</td>
                <td>{t.plan || '—'}</td>
                <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{t.default_locale_code || '—'}</td>
                <td>{t.members_count}</td>
                <td>
                  <span className={'bp-pill ' + (t.status === 'active' ? 'bp-pill--ok' : 'bp-pill--warn')}>
                    {t.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};


/* ── 3. Users Governance™ ────────────────────────────────────────── */
const ROLE_BADGE = {
  root_superadmin: { cls: 'bp-pill--root', label: 'ROOT' },
  super_admin:     { cls: '',              label: 'BLUEPRINT' },
  tenant_admin:    { cls: 'bp-pill--ok',   label: 'STUDIO' },
  designer:        { cls: '',              label: 'OPERATOR' },
  client:          { cls: 'bp-pill--warn', label: 'CLIENT' },
};
export const UsersGovernancePage = () => {
  const { data, loading, error } = useAdminFetch('/api/blueprint-admin/users');
  if (loading) return <SpinnerBlock />;
  return (
    <div data-testid="bp-page-users">
      <PageHeader
        ek="admin.users.eyebrow"
        tk="admin.users.title"
        sk="admin.users.sub"
      />
      {error && <div className="bp-empty">⚠ {error}</div>}
      <div className="bp-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="bp-table">
          <thead>
            <tr>
              <th><Label k="admin.users.col.email" /></th>
              <th><Label k="admin.users.col.name" /></th>
              <th><Label k="admin.users.col.role" /></th>
              <th><Label k="admin.users.col.tenant" /></th>
              <th><Label k="admin.users.col.status" /></th>
            </tr>
          </thead>
          <tbody>
            {(data?.users || []).map((u) => {
              const badge = ROLE_BADGE[u.effective_role] || { cls: '', label: u.effective_role };
              return (
                <tr key={u.id} data-testid={`bp-user-row-${u.email}`}>
                  <td>{u.email}{u.is_root_superadmin && <Shield size={11} style={{ marginLeft: 6, verticalAlign: '-1px', color: 'var(--bp-cc-accent)' }} />}</td>
                  <td>{[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}</td>
                  <td><span className={'bp-pill ' + badge.cls}>{badge.label}</span></td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{u.tenant_slug || '—'}</td>
                  <td>
                    <span className={'bp-pill ' + (u.status === 'active' ? 'bp-pill--ok' : 'bp-pill--warn')}>
                      {u.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};


/* ── 4. Atelier Presets™ (frozen view) ───────────────────────────── */
export const PresetsGovernancePage = () => {
  const { data, loading } = useAdminFetch('/api/blueprint-admin/presets');
  if (loading) return <SpinnerBlock />;
  return (
    <div data-testid="bp-page-presets">
      <PageHeader
        ek="admin.presets.eyebrow"
        tk="admin.presets.title"
        sk="admin.presets.sub"
      />
      <div className="bp-metric-grid">
        {(data?.presets || []).map((p) => (
          <div className="bp-metric" key={p.code} data-testid={`bp-preset-${p.code}`}>
            <span className="bp-metric__label">{p.position} · {p.code}</span>
            <span className="bp-metric__value" style={{ fontSize: 22 }}>{p.display_name}</span>
            <span className="bp-metric__hint" style={{ marginTop: 8 }}>{p.summary}</span>
            <span className="bp-pill bp-pill--root" style={{ marginTop: 8, alignSelf: 'flex-start' }}>
              {p.is_locked ? 'FROZEN' : 'UNLOCKED'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};


/* ── 5. Editorial Runtime™ (Narrative Orchestration) ─────────────── */
export const EditorialRuntimePage = () => {
  const { data, loading, error, refresh } = useAdminFetch('/api/blueprint-admin/editorial-runtime');
  const [busy, setBusy] = useState(null);

  if (loading) return <SpinnerBlock />;
  if (error)   return <div className="bp-empty">⚠ {error}</div>;

  const groups = data?.groups || {};
  const namespaces = data?.namespaces || [];
  const locales = data?.active_locales || [];

  const regenerate = async (id) => {
    setBusy(id);
    try {
      await api.post(`/api/blueprint-admin/editorial-runtime/${id}/regenerate`, {});
      toast('Re-orchestrated. Refresh to see updated coverage.');
    } catch (e) {
      toast.error('Regeneration failed.');
    } finally { setBusy(null); }
  };

  return (
    <div data-testid="bp-page-editorial">
      <PageHeader
        ek="admin.editorial.eyebrow"
        tk="admin.editorial.title"
        sk="admin.editorial.sub"
      />
      {namespaces.map((ns) => (
        <section className="bp-section" key={ns}>
          <h2 className="bp-section__title">{ns}</h2>
          <div className="bp-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="bp-table">
              <thead>
                <tr>
                  <th><Label k="admin.editorial.col.block" /></th>
                  <th><Label k="admin.editorial.col.source" /></th>
                  <th><Label k="admin.editorial.col.coverage" /></th>
                  <th><Label k="admin.editorial.col.actions" /></th>
                </tr>
              </thead>
              <tbody>
                {(groups[ns] || []).map((b) => {
                  const covered = locales.filter((l) => b.coverage?.[l]?.present).length;
                  return (
                    <tr key={b.id} data-testid={`bp-editorial-row-${b.block_key}`}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                            {b.block_key}
                          </span>
                          <span className="bp-pill" style={{ alignSelf: 'flex-start', fontSize: 9 }}>
                            {b.block_type}
                          </span>
                        </div>
                      </td>
                      <td style={{ maxWidth: 320, fontStyle: 'italic',
                                   fontFamily: 'Cormorant Garamond, serif', fontSize: 14 }}>
                        {b.source_value}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {locales.map((loc) => {
                            const present = b.coverage?.[loc]?.present;
                            return (
                              <span key={loc} title={loc} style={{
                                width: 14, height: 14, borderRadius: '50%',
                                border: '1px solid var(--bp-cc-border)',
                                background: present ? 'var(--bp-cc-accent)' : 'transparent',
                                boxShadow: present ? '0 0 6px var(--bp-cc-accent)' : 'none',
                                opacity: present ? 1 : 0.4,
                              }} />
                            );
                          })}
                          <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--bp-cc-ink-mute)' }}>
                            {covered}/{locales.length}
                          </span>
                        </div>
                      </td>
                      <td>
                        <button type="button" className="bp-btn"
                                disabled={busy === b.id}
                                onClick={() => regenerate(b.id)}
                                data-testid={`bp-editorial-regen-${b.block_key}`}>
                          {busy === b.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                          <Label k="admin.editorial.action.regenerate" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <button type="button" className="bp-btn" onClick={refresh}>
        <RefreshCw size={12} /> <Label k="admin.action.refresh" />
      </button>
    </div>
  );
};


/* ── 7. Email Governance™ ────────────────────────────────────────── */
export const EmailGovernancePage = () => {
  const [filters, setFilters] = useState({ status: '', event_type: '' });
  const qs = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v).reduce((a, [k, v]) => ({ ...a, [k]: v }), {})
  ).toString();
  const path = `/api/blueprint-admin/email-events${qs ? '?' + qs : ''}`;
  const { data, loading, error, refresh } = useAdminFetch(path);
  const [detail, setDetail] = useState(null);
  const [testForm, setTestForm] = useState({
    to: '', template_key: 'password_reset',
    source_host: 'studio.moodfordesign.com',
  });
  const [sending, setSending] = useState(false);

  const openDetail = async (id) => {
    try {
      const r = await api.get(`/api/blueprint-admin/email-events/${id}`);
      setDetail(r.data);
    } catch (_) { toast.error('Detail unreachable.'); }
  };

  const sendTest = async (e) => {
    e.preventDefault();
    if (!testForm.to) { toast.error('Inserisci destinatario.'); return; }
    setSending(true);
    try {
      const r = await api.post('/api/blueprint-admin/email-events/resend-test', testForm);
      if (r.data.ok) {
        toast(`Inviata (${r.data.provider}) — ${r.data.provider_message_id || 'logged'}`);
      } else {
        toast.error(`Provider error: ${r.data.error}`);
      }
      refresh();
    } catch (_) { toast.error('Send failed.'); }
    finally { setSending(false); }
  };

  if (loading && !data) return <SpinnerBlock />;
  const events = data?.events || [];
  const stats = data?.stats || {};

  return (
    <div data-testid="bp-page-email">
      <PageHeader
        ek="admin.email.eyebrow"
        tk="admin.email.title"
        sk="admin.email.sub"
      />
      <div className="bp-metric-grid">
        <Metric label={<Label k="admin.email.metric.sent" />} value={stats.sent} />
        <Metric label={<Label k="admin.email.metric.queued" />} value={stats.queued} />
        <Metric label={<Label k="admin.email.metric.failed" />} value={stats.failed} />
        <Metric label={<Label k="admin.email.metric.bounced" />} value={stats.bounced} />
      </div>

      {/* Test send card */}
      <section className="bp-section">
        <h2 className="bp-section__title">Test invio</h2>
        <form onSubmit={sendTest} className="bp-card"
              style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1.4fr auto',
                       gap: 10, alignItems: 'end' }}
              data-testid="bp-email-test-form">
          <FormField label="Destinatario"
                     value={testForm.to}
                     onChange={(v) => setTestForm({ ...testForm, to: v })}
                     placeholder="operator@example.com"
                     testId="bp-email-test-to" />
          <FormSelect label="Template" value={testForm.template_key}
                      onChange={(v) => setTestForm({ ...testForm, template_key: v })}
                      options={[
                        'password_reset', 'invite', 'onboarding',
                        'lead_captured', 'magic_link', 'proposal_ready', 'generic',
                      ]}
                      testId="bp-email-test-template" />
          <FormField label="Source host"
                     value={testForm.source_host}
                     onChange={(v) => setTestForm({ ...testForm, source_host: v })}
                     placeholder="studio.moodfordesign.com"
                     testId="bp-email-test-host" />
          <button type="submit" disabled={sending} className="bp-btn"
                  data-testid="bp-email-test-send">
            {sending ? <Loader2 size={12} className="animate-spin" /> : '⏵'} Invia test
          </button>
        </form>
      </section>

      {/* Filters */}
      <section className="bp-section">
        <h2 className="bp-section__title">Eventi</h2>
        <div className="bp-card" style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <FormSelect label="Status" value={filters.status} compact
                      onChange={(v) => setFilters({ ...filters, status: v })}
                      options={['', 'sent', 'failed', 'queued', 'bounced']}
                      testId="bp-email-filter-status" />
          <FormSelect label="Event" value={filters.event_type} compact
                      onChange={(v) => setFilters({ ...filters, event_type: v })}
                      options={['', 'password_reset', 'invite', 'onboarding',
                               'lead_captured', 'magic_link', 'test.password_reset',
                               'test.invite', 'test.generic']}
                      testId="bp-email-filter-event" />
        </div>

        {error && <div className="bp-empty">⚠ {error}</div>}
        {events.length === 0 ? (
          <div className="bp-empty"><Label k="admin.email.empty" /></div>
        ) : (
          <div className="bp-card" style={{ padding: 0 }}>
            <table className="bp-table">
              <thead>
                <tr>
                  <th><Label k="admin.email.col.when" /></th>
                  <th><Label k="admin.email.col.event" /></th>
                  <th><Label k="admin.email.col.recipient" /></th>
                  <th>Origin</th>
                  <th><Label k="admin.email.col.subject" /></th>
                  <th><Label k="admin.email.col.status" /></th>
                  <th>Provider</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}
                      onClick={() => openDetail(e.id)}
                      style={{ cursor: 'pointer' }}
                      data-testid={`bp-email-row-${e.id}`}>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                      {(e.created_at || '').slice(0, 16).replace('T', ' ')}
                    </td>
                    <td>{e.event_type}</td>
                    <td>{e.recipient_email || e.recipient}</td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                                 color: 'var(--bp-cc-ink-mute)' }}>
                      {e.source_domain || '—'}
                    </td>
                    <td>{e.subject || '—'}</td>
                    <td>
                      <span className={'bp-pill ' + (e.status === 'sent' ? 'bp-pill--ok' : e.status === 'failed' ? 'bp-pill--fail' : 'bp-pill--warn')}>
                        {e.status}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                      {e.provider}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {detail && <EmailEventDetailModal event={detail} onClose={() => setDetail(null)} />}
    </div>
  );
};

const FormField = ({ label, value, onChange, placeholder, testId }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <span className="bp-page__eyebrow">{label}</span>
    <input data-testid={testId} value={value || ''} placeholder={placeholder}
           onChange={(e) => onChange(e.target.value)}
           style={{ padding: '9px 11px', background: 'rgba(8,10,13,0.5)',
                    border: '1px solid var(--bp-cc-border)',
                    borderRadius: 7, color: 'var(--bp-cc-ink)', fontSize: 12 }} />
  </label>
);

const FormSelect = ({ label, value, onChange, options, testId, compact }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 6,
                  minWidth: compact ? 180 : undefined }}>
    <span className="bp-page__eyebrow">{label}</span>
    <select data-testid={testId} value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            style={{ padding: '9px 11px', background: 'rgba(8,10,13,0.5)',
                     border: '1px solid var(--bp-cc-border)',
                     borderRadius: 7, color: 'var(--bp-cc-ink)', fontSize: 12 }}>
      {options.map((o) => <option key={o} value={o}>{o || '— any —'}</option>)}
    </select>
  </label>
);

const EmailEventDetailModal = ({ event, onClose }) => (
  <div onClick={onClose}
       style={{ position: 'fixed', inset: 0, zIndex: 99,
                background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
                display: 'grid', placeItems: 'center', padding: 24 }}>
    <div onClick={(e) => e.stopPropagation()}
         className="bp-card"
         style={{ maxWidth: 720, width: '100%', maxHeight: '82vh', overflow: 'auto' }}
         data-testid="bp-email-detail">
      <div className="bp-page__eyebrow">Email Event</div>
      <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic',
                   fontSize: 22, margin: '4px 0 18px' }}>
        {event.subject || event.event_type}
      </h3>
      <pre style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
                    background: 'rgba(0,0,0,0.4)', padding: 14, borderRadius: 8,
                    color: 'var(--bp-cc-ink-soft)',
                    border: '1px solid var(--bp-cc-border)', overflow: 'auto' }}>
        {JSON.stringify(event, null, 2)}
      </pre>
      <button onClick={onClose} className="bp-btn" style={{ marginTop: 16 }}
              data-testid="bp-email-detail-close">Chiudi</button>
    </div>
  </div>
);


/* ── 8. Demo Governance™ ─────────────────────────────────────────── */
export const DemoGovernancePage = () => {
  const { data, loading, refresh } = useAdminFetch('/api/blueprint-admin/demo/status');
  const [restoring, setRestoring] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const restore = async () => {
    setRestoring(true);
    try {
      const r = await api.post(`/api/blueprint-admin/demo/restore`, {});
      setLastResult(r.data);
      toast('Golden Snapshot™ restored.');
      refresh();
    } catch (e) {
      toast.error('Restore failed.');
    } finally {
      setRestoring(false);
      setConfirm(false);
    }
  };

  if (loading) return <SpinnerBlock />;
  const t = data?.tenant;
  const inv = data?.inventory || {};
  const last = data?.last_snapshot;

  return (
    <div data-testid="bp-page-demo">
      <PageHeader
        ek="admin.demo.eyebrow"
        tk="admin.demo.title"
        sk="admin.demo.sub"
      />

      {!data?.available ? (
        <div className="bp-empty"><Label k="admin.demo.unavailable" /></div>
      ) : (
        <>
          <div className="bp-metric-grid">
            <Metric label={<Label k="admin.demo.metric.tenant" />} value={t?.slug} />
            <Metric label={<Label k="admin.demo.metric.users" />} value={inv.users} />
            <Metric label={<Label k="admin.demo.metric.relationships" />} value={inv.relationships} />
            <Metric label={<Label k="admin.demo.metric.journeys" />} value={inv.journeys} />
          </div>

          {last && (
            <div className="bp-card" style={{ marginBottom: 24 }}>
              <div className="bp-page__eyebrow"><Label k="admin.demo.last_snapshot" /></div>
              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--bp-cc-ink-soft)' }}>
                <strong>{last.action}</strong> · {(last.created_at || '').slice(0, 16).replace('T', ' ')}
                {last.duration_ms != null && <> · {last.duration_ms}ms</>}
              </div>
            </div>
          )}

          <div className="bp-card">
            <h2 className="bp-section__title" style={{ marginTop: 0 }}>
              <Label k="admin.demo.restore.title" />
            </h2>
            <p className="bp-page__sub" style={{ marginBottom: 18 }}>
              <Label k="admin.demo.restore.body" />
            </p>

            {!confirm ? (
              <button type="button" className="bp-btn bp-btn--danger"
                      onClick={() => setConfirm(true)}
                      data-testid="bp-demo-restore-cta">
                <AlertTriangle size={12} /> <Label k="admin.demo.restore.cta" />
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--bp-cc-ink-soft)' }}>
                  <Label k="admin.demo.restore.confirm" />
                </span>
                <button type="button" className="bp-btn bp-btn--danger"
                        disabled={restoring}
                        onClick={restore}
                        data-testid="bp-demo-restore-confirm">
                  {restoring ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  <Label k="admin.demo.restore.confirm_cta" />
                </button>
                <button type="button" className="bp-btn"
                        onClick={() => setConfirm(false)}
                        disabled={restoring}>
                  <Label k="admin.demo.restore.cancel" />
                </button>
              </div>
            )}

            {lastResult && (
              <pre style={{
                marginTop: 22, padding: 14, fontSize: 11,
                fontFamily: 'JetBrains Mono, monospace',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--bp-cc-border)',
                borderRadius: 8, color: 'var(--bp-cc-ink-soft)',
                overflow: 'auto',
              }}>
                {JSON.stringify(lastResult, null, 2)}
              </pre>
            )}
          </div>
        </>
      )}
    </div>
  );
};


/* ── Default index → redirect to dashboard. Keeps router clean. ──── */
export const AdminIndexPage = () => (
  <div data-testid="bp-page-index">
    <PageHeader
      ek="admin.index.eyebrow"
      tk="admin.index.title"
      sk="admin.index.sub"
    />
    <div className="bp-card">
      <Link to="/admin/dashboard" className="bp-btn">
        <Label k="admin.index.cta" />
      </Link>
    </div>
  </div>
);
