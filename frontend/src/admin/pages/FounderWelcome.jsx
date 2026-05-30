/**
 * Founder First Access™ — the cinematic welcome the founder sees the
 * very first time they consume the Open Studio Ecosystem magic link.
 *
 * Not a tutorial. Not a checklist. A single page that says:
 *   "Il tuo ecosistema è pronto."
 *
 * Pulls the Tenant Manifest live so all values are real (no placeholders).
 * Then routes to /admin on the single editorial CTA.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, adminAuth } from '../adminApi';
import { useEditorialCopy } from '../utils/useEditorialCopy';
import {
  tokens, eyebrow, headline, sublead, sectionLabel, helper,
} from '../utils/consoleTokens';
import axios from 'axios';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const FounderWelcome = () => {
  const { t, loaded } = useEditorialCopy('admin.founder', 'it');
  const [manifest, setManifest] = useState(null);
  const [phase, setPhase] = useState('opening');
  const navigate = useNavigate();

  useEffect(() => {
    // Resolve own tenant slug from the auth state set by the magic-link consume
    const tenantRaw = localStorage.getItem('mood_tenant') || localStorage.getItem('mood_auth_tenant');
    let slug = 'studio';
    try { slug = (JSON.parse(tenantRaw) || {}).slug || 'studio'; } catch {}
    axios.get(`${BACKEND}/api/admin/tenants/${slug}/manifest`, { headers: adminAuth.headers() })
      .then((r) => setManifest(r.data))
      .catch(() => setManifest(null));
  }, []);

  // Cinematic opening pacing
  useEffect(() => {
    const tA = setTimeout(() => setPhase('hero'),     420);
    const tB = setTimeout(() => setPhase('details'),  1700);
    return () => { clearTimeout(tA); clearTimeout(tB); };
  }, []);

  if (!loaded) return <div style={{ minHeight: '100vh', background: tokens.bg }} />;

  const m         = manifest || {};
  const studioName = m.tenant?.name || '...';
  const monogram   = m.identity?.monogram || (studioName.slice(0, 2).toUpperCase());
  const founderName = m.founder?.full_name || '';
  const advisorName = m.advisor?.full_name || '—';
  const lang        = m.language?.default === 'it' ? 'Italiano' : (m.language?.default || '—');
  const modules     = (m.modules || []).map((mod) => mod.module_key);
  const archetype   = m.identity?.archetype || '—';
  const country     = m.identity?.country   || '—';

  return (
    <div data-testid="founder-welcome" style={{
      background: tokens.bg, color: tokens.ink,
      minHeight: '100vh', padding: '6rem 5rem',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* Monogram drifting in */}
      <div style={{
        fontFamily: 'Playfair Display, serif',
        fontSize: '4rem', color: tokens.teal,
        letterSpacing: '0.04em', marginBottom: '3rem',
        opacity: phase === 'opening' ? 0 : 1,
        transform: phase === 'opening' ? 'translateY(20px)' : 'translateY(0)',
        transition: 'all 1200ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}>{monogram}</div>

      <div style={{
        maxWidth: 720, textAlign: 'center',
        opacity: ['hero','details'].includes(phase) ? 1 : 0,
        transform: ['hero','details'].includes(phase) ? 'translateY(0)' : 'translateY(16px)',
        transition: 'all 1000ms cubic-bezier(0.2, 0.8, 0.2, 1) 200ms',
      }}>
        <p style={{ ...eyebrow, marginBottom: '1.4rem' }}>
          {t('founder.welcome.eyebrow')}
        </p>
        <h1 style={{
          ...headline, fontSize: '3.6rem',
          marginBottom: '1.6rem', lineHeight: 1.05,
        }}>
          {t('founder.welcome.headline')}
        </h1>
        <p style={{ ...sublead, fontSize: '1.1rem', maxWidth: 600, margin: '0 auto' }}>
          {t('founder.welcome.sublead')}
        </p>
      </div>

      {/* Manifest details — appear after the hero settles */}
      <div style={{
        marginTop: '4.5rem',
        maxWidth: 720, width: '100%',
        opacity: phase === 'details' ? 1 : 0,
        transform: phase === 'details' ? 'translateY(0)' : 'translateY(14px)',
        transition: 'all 1000ms cubic-bezier(0.2, 0.8, 0.2, 1) 600ms',
      }} data-testid="founder-manifest">
        <Row label={t('founder.welcome.tenant.label')}    value={studioName} />
        <Row label={t('founder.welcome.founder.label')}   value={founderName} />
        <Row label={t('founder.welcome.advisor.label')}   value={advisorName} />
        <Row label={t('founder.welcome.language.label')}  value={`${lang} · ${country}`} />
        <Row label={t('founder.welcome.modules.label')}
             value={modules.length ? modules.map(humanize).join(' · ') : '—'} />
      </div>

      {/* Editorial CTA */}
      <button
        data-testid="founder-enter-cta"
        onClick={() => navigate('/blueprint')}
        style={{
          marginTop: '4.5rem',
          background: tokens.teal, color: '#08090C',
          border: 'none', padding: '1.1rem 2.4rem',
          fontFamily: 'Inter, sans-serif', fontSize: '0.76rem',
          letterSpacing: '0.28em', textTransform: 'uppercase',
          cursor: 'pointer', borderRadius: 2, fontWeight: 500,
          opacity: phase === 'details' ? 1 : 0,
          transition: 'opacity 800ms ease 1200ms',
        }}
      >
        {t('founder.welcome.enter_cta')}
      </button>

      <p style={{
        marginTop: '4rem',
        ...helper, fontStyle: 'italic',
        whiteSpace: 'pre-line', textAlign: 'center',
        opacity: phase === 'details' ? 0.7 : 0,
        transition: 'opacity 1000ms ease 1500ms',
      }}>
        {t('founder.welcome.signature')}
      </p>
    </div>
  );
};

const Row = ({ label, value }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: '180px 1fr',
    gap: '2rem', padding: '1rem 0',
    borderBottom: `1px solid ${tokens.hair}`,
    textAlign: 'left',
  }}>
    <p style={sectionLabel}>{label}</p>
    <p style={{
      fontFamily: 'Playfair Display, serif',
      fontSize: '1.05rem', color: tokens.ink, lineHeight: 1.5,
    }}>{value}</p>
  </div>
);

const humanize = (k) => {
  if (!k) return '';
  return k
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export default FounderWelcome;
