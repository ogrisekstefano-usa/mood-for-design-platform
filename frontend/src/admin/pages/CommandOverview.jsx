/* eslint-disable react/prop-types */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../adminApi';
import { useEditorialCopy } from '../utils/useEditorialCopy';

/* ── Curatorial design tokens ────────────────────────────────────────
 *  Reused from the rest of the Command Center (consoleTokens are not
 *  exported as a module today; we keep the constants local & in sync).
 */
const tokens = {
  bg:       '#08090C',
  surface:  '#0C0E13',
  hair:     'rgba(255,255,255,0.06)',
  hairBold: 'rgba(255,255,255,0.12)',
  teal:     '#00C9B3',
  ink:      '#FFFFFF',
  fade1:    'rgba(255,255,255,0.92)',
  fade2:    'rgba(255,255,255,0.68)',
  fade3:    'rgba(255,255,255,0.42)',
};

const eyebrow = {
  fontFamily: 'Montserrat, sans-serif',
  fontSize: '0.66rem', letterSpacing: '0.32em',
  textTransform: 'uppercase', color: tokens.teal, marginBottom: '0.6rem',
};
const headlineL = {
  fontFamily: 'Playfair Display, serif',
  fontSize: '2.5rem', lineHeight: 1.12, color: tokens.fade1,
  fontWeight: 400, marginBottom: '0.6rem',
};
const sublead = {
  fontFamily: 'Playfair Display, serif', fontStyle: 'italic',
  color: tokens.fade2, fontSize: '1.05rem', lineHeight: 1.55,
  maxWidth: 760,
};
const sectionTitle = {
  fontFamily: 'Playfair Display, serif',
  fontSize: '1.55rem', color: tokens.fade1, lineHeight: 1.2,
  fontWeight: 400,
};
const tableHeader = {
  fontFamily: 'Montserrat, sans-serif',
  fontSize: '0.62rem', letterSpacing: '0.22em', textTransform: 'uppercase',
  color: tokens.fade3, padding: '0.85rem 0.9rem', textAlign: 'left',
  borderBottom: `1px solid ${tokens.hair}`, fontWeight: 600,
};
const tableCell = {
  padding: '0.95rem 0.9rem',
  fontFamily: 'Inter, sans-serif', fontSize: '0.86rem',
  color: tokens.fade1, borderBottom: `1px solid ${tokens.hair}`,
  verticalAlign: 'top',
};
const cellMuted = { ...tableCell, color: tokens.fade2 };

/* ── KPI Card ─────────────────────────────────────────────────────── */
const KpiCard = ({ label, value, helper, testid, accent = false, unit = '' }) => (
  <div data-testid={testid}
       style={{
         background: tokens.surface,
         border: `1px solid ${tokens.hair}`,
         borderLeft: accent ? `2px solid ${tokens.teal}` : `1px solid ${tokens.hair}`,
         padding: '1.6rem 1.5rem 1.4rem',
         display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
         minHeight: 132,
       }}>
    <p style={{ ...eyebrow, marginBottom: 0, color: tokens.fade3 }}>{label}</p>
    <div>
      <p style={{
        fontFamily: 'Playfair Display, serif',
        fontSize: '2.2rem', lineHeight: 1, color: tokens.fade1,
        fontWeight: 400, margin: '0.6rem 0 0.4rem',
      }}>
        {value}{unit && <span style={{ fontSize: '0.95rem', color: tokens.fade3, marginLeft: 6 }}>{unit}</span>}
      </p>
      <p style={{
        fontFamily: 'Inter, sans-serif', fontSize: '0.74rem',
        lineHeight: 1.55, color: tokens.fade3, margin: 0,
      }}>{helper}</p>
    </div>
  </div>
);

/* ── Section wrapper ───────────────────────────────────────────────── */
const Section = ({ eyebrowTxt, title, sublead: subleadTxt, children, testid }) => (
  <section data-testid={testid} style={{
    padding: '4rem 0 2rem', borderTop: `1px solid ${tokens.hair}`,
  }}>
    <p style={{ ...eyebrow }}>{eyebrowTxt}</p>
    <h2 style={sectionTitle}>{title}</h2>
    {subleadTxt && <p style={{ ...sublead, fontSize: '0.95rem', marginTop: '0.6rem' }}>{subleadTxt}</p>}
    <div style={{ marginTop: '2rem' }}>{children}</div>
  </section>
);

const formatCurrency = (n) => {
  if (!n) return '—';
  return new Intl.NumberFormat('it-IT', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(n);
};
const formatDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
};

/* ── Main page ─────────────────────────────────────────────────────── */
const CommandOverview = () => {
  const { t } = useEditorialCopy('command.overview', 'it');
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState(null);

  useEffect(() => {
    let alive = true;
    adminApi.commandOverview()
      .then((r) => { if (alive) { setData(r.data); setLoading(false); } })
      .catch((e) => {
        if (!alive) return;
        if (e?.response?.status === 403) setErr('forbidden');
        else                              setErr('error');
        setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  if (loading) {
    return (
      <div data-testid="cc-overview-loading" style={{
        minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div className="w-8 h-8 border border-[#00C9B3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (err === 'forbidden') {
    return (
      <div data-testid="cc-overview-forbidden" style={{
        padding: '4rem 3rem', color: tokens.fade2,
        fontFamily: 'Playfair Display, serif', fontStyle: 'italic',
      }}>
        Questa lettura è riservata al Super Admin di MOOD.
      </div>
    );
  }

  if (!data) return null;
  const { kpi, advisors, relations, studio_requests: requests, activated_tenants: tenants } = data;

  return (
    <div data-testid="command-overview" style={{
      background: tokens.bg, color: tokens.ink, minHeight: '100vh',
      padding: '3.5rem 3rem 5rem',
    }}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <header style={{ marginBottom: '3rem' }}>
        <p style={eyebrow}>{t('shell.eyebrow')}</p>
        <h1 style={headlineL}>{t('shell.title')}</h1>
        <p style={sublead}>{t('shell.sublead')}</p>
      </header>

      {/* ── KPI grid (4 columns × 2 rows) ────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0,
        border: `1px solid ${tokens.hair}`,
      }}>
        <KpiCard label={t('kpi.advisors.label')}   value={kpi.advisors_active}   helper={t('kpi.advisors.helper')}   accent testid="kpi-advisors" />
        <KpiCard label={t('kpi.relations.label')}  value={kpi.total_relations}   helper={t('kpi.relations.helper')}         testid="kpi-relations" />
        <KpiCard label={t('kpi.active.label')}     value={kpi.active_relations}  helper={t('kpi.active.helper')}            testid="kpi-active" />
        <KpiCard label={t('kpi.activated.label')}  value={kpi.activated_tenants} helper={t('kpi.activated.helper')}         testid="kpi-activated" />
        <KpiCard label={t('kpi.requests.label')}   value={kpi.requests_total}    helper={t('kpi.requests.helper')}          testid="kpi-requests" />
        <KpiCard label={t('kpi.unassigned.label')} value={kpi.requests_unassigned} helper={t('kpi.unassigned.helper')}      testid="kpi-unassigned" />
        <KpiCard label={t('kpi.pipeline_recurring.label')} value={formatCurrency(kpi.pipeline_recurring)} helper={t('kpi.pipeline_recurring.helper')} testid="kpi-pipeline-recurring" />
        <KpiCard label={t('kpi.pipeline_setup.label')}     value={formatCurrency(kpi.pipeline_setup)}     helper={t('kpi.pipeline_setup.helper')}     testid="kpi-pipeline-setup" />
      </div>

      {/* ── Advisors ───────────────────────────────────────────────── */}
      <Section testid="cc-advisors"
               eyebrowTxt={t('advisors.eyebrow')}
               title={t('advisors.headline')}
               sublead={t('advisors.sublead')}>
        {advisors.length === 0 ? (
          <p style={{ ...sublead, fontSize: '0.95rem', color: tokens.fade3 }}>
            {t('advisors.empty')}
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="advisors-table">
            <thead>
              <tr>
                <th style={tableHeader}>{t('advisors.col.advisor')}</th>
                <th style={tableHeader}>{t('advisors.col.code')}</th>
                <th style={tableHeader}>{t('advisors.col.status')}</th>
                <th style={tableHeader}>{t('advisors.col.active')}</th>
                <th style={tableHeader}>{t('advisors.col.activated')}</th>
                <th style={tableHeader}>{t('advisors.col.requests')}</th>
                <th style={tableHeader}>{t('advisors.col.commission')}</th>
              </tr>
            </thead>
            <tbody>
              {advisors.map((a) => (
                <tr key={a.profile_id} data-testid={`advisor-${a.advisor_code}`}>
                  <td style={tableCell}>
                    <div>{a.name}</div>
                    <div style={{ color: tokens.fade3, fontSize: '0.78rem' }}>{a.email}</div>
                  </td>
                  <td style={cellMuted}>{a.advisor_code}</td>
                  <td style={cellMuted}>{a.status}</td>
                  <td style={tableCell}>{a.active_count}</td>
                  <td style={tableCell}>{a.activated_count}</td>
                  <td style={tableCell}>{a.requests_count}</td>
                  <td style={cellMuted}>{a.commission_percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* ── Relations ──────────────────────────────────────────────── */}
      <Section testid="cc-relations"
               eyebrowTxt={t('relations.eyebrow')}
               title={t('relations.headline')}
               sublead={t('relations.sublead')}>
        {relations.length === 0 ? (
          <p style={{ ...sublead, fontSize: '0.95rem', color: tokens.fade3 }}>
            {t('relations.empty')}
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="relations-table">
            <thead>
              <tr>
                <th style={tableHeader}>{t('relations.col.studio')}</th>
                <th style={tableHeader}>{t('relations.col.archetype')}</th>
                <th style={tableHeader}>{t('relations.col.owner')}</th>
                <th style={tableHeader}>{t('relations.col.status')}</th>
                <th style={tableHeader}>{t('relations.col.temperature')}</th>
                <th style={tableHeader}>{t('relations.col.value')}</th>
                <th style={tableHeader}>{t('relations.col.last')}</th>
              </tr>
            </thead>
            <tbody>
              {relations.map((r) => (
                <tr key={r.id} data-testid={`relation-row-${r.id}`}>
                  <td style={tableCell}>
                    <Link to={`/command-center/advisor-console/relations/${r.id}`}
                          style={{ color: tokens.fade1, textDecoration: 'none' }}>
                      {r.studio_name}
                    </Link>
                    <div style={{ color: tokens.fade3, fontSize: '0.78rem' }}>
                      {r.city}{r.country ? ` · ${r.country}` : ''}
                    </div>
                  </td>
                  <td style={cellMuted}>{r.archetype || '—'}</td>
                  <td style={cellMuted}>{r.owner_name || '—'}</td>
                  <td style={tableCell}>{r.status}</td>
                  <td style={cellMuted}>{r.temperature || '—'}</td>
                  <td style={cellMuted}>
                    {r.expected_monthly ? `${formatCurrency(r.expected_monthly)}/m` : '—'}
                  </td>
                  <td style={cellMuted}>{formatDate(r.last_activity_at || r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* ── Studio Requests ────────────────────────────────────────── */}
      <Section testid="cc-requests"
               eyebrowTxt={t('requests.eyebrow')}
               title={t('requests.headline')}
               sublead={t('requests.sublead')}>
        {requests.length === 0 ? (
          <p style={{ ...sublead, fontSize: '0.95rem', color: tokens.fade3 }}>
            {t('requests.empty')}
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="requests-table">
            <thead>
              <tr>
                <th style={tableHeader}>{t('requests.col.studio')}</th>
                <th style={tableHeader}>{t('requests.col.contact')}</th>
                <th style={tableHeader}>{t('requests.col.archetype')}</th>
                <th style={tableHeader}>{t('requests.col.status')}</th>
                <th style={tableHeader}>{t('requests.col.assignment')}</th>
                <th style={tableHeader}>{t('requests.col.created')}</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((q) => (
                <tr key={q.id} data-testid={`request-row-${q.id}`}>
                  <td style={tableCell}>
                    <div>{q.studio_name || '—'}</div>
                    <div style={{ color: tokens.fade3, fontSize: '0.78rem' }}>
                      {q.city}{q.country ? ` · ${q.country}` : ''}
                    </div>
                  </td>
                  <td style={cellMuted}>{q.contact_email || '—'}</td>
                  <td style={cellMuted}>{q.archetype || '—'}</td>
                  <td style={tableCell}>{q.status}</td>
                  <td style={cellMuted}>
                    {q.assigned_name || <em style={{ color: tokens.fade3 }}>{t('requests.unassigned')}</em>}
                  </td>
                  <td style={cellMuted}>{formatDate(q.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* ── Activated Tenants ──────────────────────────────────────── */}
      <Section testid="cc-tenants"
               eyebrowTxt={t('tenants.eyebrow')}
               title={t('tenants.headline')}
               sublead={t('tenants.sublead')}>
        {tenants.length === 0 ? (
          <p style={{ ...sublead, fontSize: '0.95rem', color: tokens.fade3 }}>
            {t('tenants.empty')}
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="tenants-table">
            <thead>
              <tr>
                <th style={tableHeader}>{t('tenants.col.studio')}</th>
                <th style={tableHeader}>{t('tenants.col.slug')}</th>
                <th style={tableHeader}>{t('tenants.col.status')}</th>
                <th style={tableHeader}>{t('tenants.col.created')}</th>
                <th style={tableHeader}></th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tn) => (
                <tr key={tn.id} data-testid={`tenant-row-${tn.slug}`}>
                  <td style={tableCell}>{tn.name}</td>
                  <td style={cellMuted}><code style={{ fontSize: '0.78rem' }}>{tn.slug}</code></td>
                  <td style={tableCell}>{tn.status}</td>
                  <td style={cellMuted}>{formatDate(tn.created_at)}</td>
                  <td style={{ ...tableCell, textAlign: 'right' }}>
                    <a href={`/api/admin/tenants/${tn.slug}/manifest`}
                       target="_blank" rel="noopener noreferrer"
                       data-testid={`tenant-manifest-${tn.slug}`}
                       style={{
                         color: tokens.teal, textDecoration: 'none',
                         fontFamily: 'Montserrat, sans-serif',
                         fontSize: '0.7rem', letterSpacing: '0.18em', textTransform: 'uppercase',
                       }}>
                      {t('tenants.action.manifest')}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
};

export default CommandOverview;
