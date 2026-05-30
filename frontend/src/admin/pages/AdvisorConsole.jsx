/**
 * ITER161 — AdvisorConsole
 * Editorial intelligence dashboard for MOOD advisors.
 * Private banking aesthetic — typography-led, architectural negative space.
 * Three movements: Quadro generale · Studio Relations · Introduzioni in attesa.
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Plus } from 'lucide-react';
import { adminApi } from '../adminApi';
import { useEditorialCopy } from '../utils/useEditorialCopy';
import {
  tokens, eyebrow, headline, headlineSmall, sublead,
  sectionLabel, dataValue, helper,
  TEMPERATURE_DOTS, STATUS_TONE,
} from '../utils/consoleTokens';
import IdentityVerificationCard from '../components/IdentityVerificationCard';

const fmtMoney = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `€${(v / 1_000).toFixed(0)}K`;
  return `€${v.toFixed(0)}`;
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
};

const AdvisorConsole = () => {
  const { t, loaded } = useEditorialCopy('admin.studioRelations', 'it');
  const [summary, setSummary]   = useState(null);
  const [pending, setPending]   = useState([]);
  const [relations, setRelations] = useState([]);
  const [filter, setFilter]     = useState('all');
  const [showNew, setShowNew]   = useState(false);

  useEffect(() => {
    adminApi.consoleSummary().then((r) => {
      setSummary(r.data?.summary || null);
      setPending(r.data?.pending_introductions || []);
    }).catch(() => {});
    adminApi.listRelations({ limit: 200 }).then((r) => setRelations(r.data || [])).catch(() => {});
  }, []);

  const filtered = relations.filter((r) => {
    if (filter === 'all')       return true;
    if (filter === 'active')    return ['under_review','contacted','presentation_scheduled','presented','qualified','proposal'].includes(r.status);
    if (filter === 'ready')     return r.temperature === 'ready';
    if (filter === 'activated') return r.status === 'activated';
    if (filter === 'archived')  return r.status === 'archived' || r.status === 'not_aligned';
    return true;
  });

  if (!loaded) {
    return <div style={{ minHeight: 480 }} />;
  }

  return (
    <div data-testid="advisor-console" style={{
      background: tokens.bg, color: tokens.ink,
      minHeight: '100vh',
      padding: '4rem 4.5rem 6rem',
    }}>
      {/* Hero */}
      <header style={{ marginBottom: '5rem', maxWidth: 760 }}>
        <p style={{ ...eyebrow, marginBottom: '1rem' }}>{t('console.eyebrow')}</p>
        <h1 style={{ ...headline, fontSize: '3.2rem', marginBottom: '1.2rem' }}>{t('console.headline')}</h1>
        <p style={sublead}>{t('console.sublead')}</p>
      </header>

      {/* ─── Quadro generale ────────────────────────────────────── */}
      <SummaryStrip summary={summary} t={t} />

      {/* ─── Pending introductions ──────────────────────────────── */}
      <Section
        eyebrow={t('pending.eyebrow')}
        title={t('pending.headline')}
        style={{ marginTop: '6rem' }}
      >
        {pending.length === 0 ? (
          <ul data-testid="pending-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <li>
              <p style={{ ...sublead, fontSize: '0.92rem' }} data-testid="pending-empty">
                {t('pending.empty')}
              </p>
            </li>
          </ul>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.4rem' }} data-testid="pending-list">
            {pending.map((p) => (
              <PendingRow key={p.id} p={p} t={t} />
            ))}
          </ul>
        )}
      </Section>

      {/* ─── Studio Relations ───────────────────────────────────── */}
      <Section
        eyebrow={t('relations.eyebrow')}
        title={t('relations.headline')}
        sub={t('relations.sublead')}
        style={{ marginTop: '6rem' }}
        action={
          <button
            onClick={() => setShowNew(true)}
            data-testid="new-relation-cta"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'transparent', border: `1px solid ${tokens.hairBold}`,
              color: tokens.ink, fontFamily: 'Inter, sans-serif',
              fontSize: '0.72rem', letterSpacing: '0.22em',
              textTransform: 'uppercase', padding: '0.65rem 1.1rem',
              borderRadius: 2, cursor: 'pointer',
            }}>
            <Plus size={13} /> {t('relations.new_cta')}
          </button>
        }
      >
        {/* Filter chips */}
        <div style={{ display: 'flex', gap: '1.6rem', marginBottom: '2rem', flexWrap: 'wrap' }} data-testid="relations-filter">
          {[
            ['all',       'relations.filter.all'],
            ['active',    'relations.filter.active'],
            ['ready',     'relations.filter.ready'],
            ['activated', 'relations.filter.activated'],
            ['archived',  'relations.filter.archived'],
          ].map(([k, lk]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              data-testid={`filter-${k}`}
              style={{
                background: 'transparent', border: 'none', padding: '0 0 0.4rem',
                color: filter === k ? tokens.ink : tokens.inkDim,
                fontFamily: 'Inter, sans-serif', fontSize: '0.72rem',
                letterSpacing: '0.22em', textTransform: 'uppercase',
                cursor: 'pointer', fontWeight: filter === k ? 500 : 300,
                borderBottom: filter === k ? `1px solid ${tokens.teal}` : '1px solid transparent',
                transition: 'all 200ms ease',
              }}>
              {t(lk)}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p style={{ ...sublead, fontSize: '0.92rem' }} data-testid="relations-empty">
            {t('relations.empty')}
          </p>
        ) : (
          <RelationsTable rows={filtered} t={t} />
        )}
      </Section>

      {showNew && (
        <NewRelationDrawer
          t={t}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            adminApi.listRelations({ limit: 200 }).then((r) => setRelations(r.data || []));
          }}
        />
      )}
    </div>
  );
};

/* ───────────────────────── SummaryStrip ─────────────────────── */
const SummaryStrip = ({ summary, t }) => {
  if (!summary) return null;
  const cells = [
    { label: t('summary.total.label'),     value: summary.total,     helper: t('summary.total.helper') },
    { label: t('summary.active.label'),    value: summary.active,    helper: t('summary.active.helper') },
    { label: t('summary.activated.label'), value: summary.activated, helper: t('summary.activated.helper') },
    { label: t('summary.ready.label'),     value: summary.ready,     helper: t('summary.ready.helper') },
  ];
  return (
    <section data-testid="summary-strip">
      <p style={{ ...eyebrow, marginBottom: '1.2rem' }}>{t('summary.eyebrow')}</p>
      <h2 style={{ ...headlineSmall, marginBottom: '2.5rem' }}>{t('summary.headline')}</h2>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: '0',
        borderTop: `1px solid ${tokens.hair}`,
        borderBottom: `1px solid ${tokens.hair}`,
      }}>
        {cells.map((c, i) => (
          <div key={i} style={{
            padding: '2rem 1.6rem',
            borderRight: i < cells.length - 1 ? `1px solid ${tokens.hair}` : 'none',
          }}>
            <p style={{ ...sectionLabel, marginBottom: '0.6rem' }}>{c.label}</p>
            <p style={{ ...dataValue, marginBottom: '0.5rem' }}>{c.value}</p>
            <p style={helper}>{c.helper}</p>
          </div>
        ))}
      </div>

      {/* Advisory Value — silent and elegant */}
      <div style={{
        marginTop: '2.4rem',
        padding: '1.6rem 0',
        borderBottom: `1px solid ${tokens.hair}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        gap: '2rem', flexWrap: 'wrap',
      }} data-testid="advisory-value-strip">
        <div>
          <p style={{ ...sectionLabel, marginBottom: '0.4rem' }}>{t('summary.advisory_value')}</p>
          <p style={helper}>{t('summary.advisory.helper')}</p>
        </div>
        <div style={{ display: 'flex', gap: '3rem' }}>
          <div>
            <p style={{
              fontFamily: 'Playfair Display, serif', fontSize: '1.6rem',
              color: tokens.ink, lineHeight: 1, fontStyle: 'italic',
            }}>{fmtMoney(summary.pipeline_recurring)}</p>
            <p style={{ ...helper, marginTop: '0.4rem' }}>{t('summary.advisory.recurring')}</p>
          </div>
          <div>
            <p style={{
              fontFamily: 'Playfair Display, serif', fontSize: '1.6rem',
              color: tokens.ink, lineHeight: 1, fontStyle: 'italic',
            }}>{fmtMoney(summary.pipeline_setup)}</p>
            <p style={{ ...helper, marginTop: '0.4rem' }}>{t('summary.advisory.setup')}</p>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ───────────────────────── Section wrapper ──────────────────── */
const Section = ({ eyebrow: eb, title, sub, action, children, style }) => (
  <section style={style}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem', gap: '2rem', flexWrap: 'wrap' }}>
      <div>
        <p style={{ ...eyebrow, marginBottom: '0.8rem' }}>{eb}</p>
        <h2 style={{ ...headlineSmall, marginBottom: sub ? '0.6rem' : 0 }}>{title}</h2>
        {sub && <p style={{ ...sublead, fontSize: '0.92rem' }}>{sub}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
);

/* ───────────────────────── PendingRow ───────────────────────── */
const PendingRow = ({ p, t }) => {
  const navigate = useNavigate();
  const open = async () => {
    try {
      const r = await adminApi.openFromRequest(p.id);
      if (r.data?.relation_id) navigate(`/command-center/advisor-console/relations/${r.data.relation_id}`);
    } catch {}
  };
  return (
    <li data-testid={`pending-${p.id}`} style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto auto',
      alignItems: 'center', gap: '2rem',
      padding: '1.2rem 0', borderBottom: `1px solid ${tokens.hair}`,
    }}>
      <div>
        <p style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.2rem', color: tokens.ink, marginBottom: 4 }}>
          {p.studio_name || p.contact_email}
        </p>
        <p style={{ ...helper, fontSize: '0.78rem' }}>
          {p.archetype || '—'}
          {p.city ? <> · {p.city}{p.country ? `, ${p.country}` : ''}</> : null}
        </p>
      </div>
      <p style={{ ...helper, fontSize: '0.72rem', letterSpacing: '0.22em', textTransform: 'uppercase' }}>
        {fmtDate(p.created_at)}
      </p>
      <button onClick={open} data-testid={`pending-open-${p.id}`} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: tokens.teal, fontFamily: 'Inter, sans-serif',
        fontSize: '0.72rem', letterSpacing: '0.22em', textTransform: 'uppercase',
      }}>
        {t('pending.open_cta')} <ArrowUpRight size={13} />
      </button>
    </li>
  );
};

/* ───────────────────────── Relations table ──────────────────── */
const RelationsTable = ({ rows, t }) => (
  <div data-testid="relations-table">
    {/* Column headers */}
    <div style={{
      display: 'grid',
      gridTemplateColumns: '2fr 1.2fr 1.2fr 1fr 1fr 1fr',
      gap: '1.4rem',
      padding: '0 0 1rem',
      borderBottom: `1px solid ${tokens.hairBold}`,
    }}>
      {['relations.col.studio','relations.col.archetype','relations.col.status','relations.col.temperature','relations.col.value','relations.col.last']
        .map((k) => (
          <p key={k} style={sectionLabel}>{t(k)}</p>
      ))}
    </div>
    {rows.map((r) => (
      <RelationRow key={r.id} r={r} t={t} />
    ))}
  </div>
);

const RelationRow = ({ r, t }) => {
  const totalValue = (r.expected_monthly_value || 0) * (r.advisor_recurring_months || 24)
                    + (r.expected_setup_value || 0);
  return (
    <Link
      to={`/command-center/advisor-console/relations/${r.id}`}
      data-testid={`relation-row-${r.id}`}
      style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1.2fr 1.2fr 1fr 1fr 1fr',
        gap: '1.4rem',
        padding: '1.3rem 0',
        borderBottom: `1px solid ${tokens.hair}`,
        textDecoration: 'none', color: 'inherit',
        transition: 'background 180ms ease',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.015)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <div>
        <p style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.1rem', color: tokens.ink, marginBottom: 2 }}>
          {r.studio_name}
        </p>
        <p style={{ ...helper, fontSize: '0.72rem' }}>
          {r.city ? `${r.city}${r.country ? `, ${r.country}` : ''}` : (r.contact_email || '—')}
        </p>
      </div>
      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.84rem', color: tokens.inkSoft, alignSelf: 'center' }}>
        {r.archetype || '—'}
      </p>
      <p style={{
        fontFamily: 'Inter, sans-serif', fontSize: '0.78rem',
        color: STATUS_TONE[r.status] || tokens.inkDim, alignSelf: 'center',
        letterSpacing: '0.04em',
      }}>
        {t(`status.${r.status}`)}
      </p>
      <p style={{ alignSelf: 'center', fontSize: '0.82rem', color: tokens.inkSoft, fontFamily: 'Inter, sans-serif' }}>
        <span style={{
          display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
          background: TEMPERATURE_DOTS[r.temperature] || tokens.inkFaint,
          marginRight: 10, verticalAlign: 'middle',
        }} />
        {t(`temperature.${r.temperature}`)}
      </p>
      <p style={{
        alignSelf: 'center', fontFamily: 'Playfair Display, serif',
        fontStyle: 'italic', color: tokens.inkSoft, fontSize: '0.95rem',
      }}>
        {totalValue > 0 ? fmtMoney(totalValue) : '—'}
      </p>
      <p style={{ ...helper, fontSize: '0.74rem', alignSelf: 'center' }}>
        {fmtDate(r.last_activity_at)}
      </p>
    </Link>
  );
};

/* ───────────────────────── New Relation Drawer ───────────────── */
const NewRelationDrawer = ({ t, onClose, onCreated }) => {
  const [form, setForm] = useState({
    studio_name: '', contact_email: '', contact_name: '',
    website: '', city: '', country: '', archetype: '',
  });
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.studio_name.trim()) return;
    setBusy(true);
    try {
      const r = await adminApi.createRelation(form);
      if (r.data?.relation_id) {
        onCreated && onCreated();
        navigate(`/command-center/advisor-console/relations/${r.data.relation_id}`);
      }
    } finally { setBusy(false); }
  };

  return (
    <div data-testid="new-relation-drawer" style={{
      position: 'fixed', inset: 0, background: 'rgba(8,9,12,0.86)',
      backdropFilter: 'blur(12px)', zIndex: 100, display: 'flex',
      justifyContent: 'flex-end',
    }} onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} style={{
        background: tokens.bg, width: 560, maxWidth: '95vw',
        borderLeft: `1px solid ${tokens.hairBold}`,
        padding: '3.5rem 3rem', overflowY: 'auto', height: '100vh',
      }}>
        <p style={{ ...eyebrow, marginBottom: '1rem' }}>{t('relations.eyebrow')}</p>
        <h2 style={{ ...headlineSmall, marginBottom: '0.5rem' }}>{t('relations.new_cta')}</h2>
        <p style={{ ...sublead, fontSize: '0.88rem', marginBottom: '2.5rem' }}>{t('relations.sublead')}</p>

        <Field label={t('identity.studio_name.label', 'Il nome dello studio')}     value={form.studio_name} onChange={set('studio_name')} testid="new-studio-name" />
        <Field label={t('identity.contact.name_placeholder', 'Nome del riferimento')} value={form.contact_name} onChange={set('contact_name')} testid="new-contact-name" />
        <Field label={t('identity.contact.email_label', 'Email')}                   value={form.contact_email} onChange={set('contact_email')} testid="new-contact-email" />
        <Field label={t('identity.contact.website_label', 'Sito web')}              value={form.website}     onChange={set('website')}     testid="new-website" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <Field label={t('identity.where.city_placeholder', 'Città')}    value={form.city}    onChange={set('city')}    testid="new-city" />
          <Field label={t('identity.where.country_placeholder', 'Paese')} value={form.country} onChange={set('country')} testid="new-country" />
        </div>
        <Field label={t('pending.archetype.label', 'Archetipo')} value={form.archetype} onChange={set('archetype')} testid="new-archetype" />

        <IdentityVerificationCard
          studio_name={form.studio_name}
          contact_email={form.contact_email}
          website={form.website}
          t={t}
          onOpenExisting={(m) => {
            if (m.kind === 'existing_relation') {
              onClose();
              navigate(`/command-center/advisor-console/relations/${m.id}`);
            }
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2.5rem', gap: '1rem' }}>
          <button type="button" onClick={onClose} data-testid="new-relation-cancel" style={{
            background: 'transparent', border: 'none', color: tokens.inkDim,
            fontFamily: 'Inter, sans-serif', fontSize: '0.78rem',
            letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer',
          }}>
            {t('activation.cancel_cta')}
          </button>
          <button type="submit" disabled={busy || !form.studio_name.trim()} data-testid="new-relation-submit" style={{
            background: tokens.teal, color: '#08090C',
            border: 'none', padding: '0.85rem 1.6rem', borderRadius: 2,
            fontFamily: 'Inter, sans-serif', fontSize: '0.74rem',
            letterSpacing: '0.22em', textTransform: 'uppercase', cursor: 'pointer',
            opacity: busy || !form.studio_name.trim() ? 0.4 : 1, fontWeight: 500,
          }}>
            {busy ? '…' : t('relations.new_cta')}
          </button>
        </div>
      </form>
    </div>
  );
};

const Field = ({ label, value, onChange, testid }) => (
  <div style={{ marginBottom: '1.6rem' }}>
    <p style={{ ...sectionLabel, marginBottom: '0.5rem' }}>{label}</p>
    <input
      type="text" value={value} onChange={onChange} data-testid={testid}
      style={{
        width: '100%', background: 'transparent', border: 'none',
        borderBottom: `1px solid ${tokens.hairBold}`,
        color: tokens.ink, padding: '0.5rem 0',
        fontFamily: 'Playfair Display, serif', fontSize: '1.05rem',
        outline: 'none',
      }}
    />
  </div>
);

export default AdvisorConsole;
