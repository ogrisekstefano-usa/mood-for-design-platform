/**
 * VisitReportForm — curatorial assessment, never a sales report.
 * Discreet ratings, atmosphere fields, operational maturity.
 */
import React, { useState } from 'react';
import { adminApi } from '../adminApi';
import { tokens, eyebrow, headlineSmall, sublead, sectionLabel, helper } from '../utils/consoleTokens';

const RATINGS = [
  ['workflow_maturity',          'visit.workflow.label'],
  ['showroom_quality',           'visit.showroom.label'],
  ['material_culture',           'visit.material.label'],
  ['design_journey_alignment',   'visit.alignment.label'],
  ['client_experience_maturity', 'visit.client.label'],
  ['international_readiness',    'visit.international.label'],
  ['digital_readiness',          'visit.digital.label'],
  ['operational_complexity',     'visit.complexity.label'],
];

const ScaleRow = ({ field, label, value, onChange, t }) => (
  <div data-testid={`visit-rating-${field}`} style={{
    padding: '1.1rem 0', borderBottom: `1px solid ${tokens.hair}`,
    display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '1.5rem',
  }}>
    <div>
      <p style={{ ...sectionLabel, color: tokens.inkSoft, marginBottom: 4 }}>{label}</p>
      <p style={{ ...helper, fontSize: '0.72rem' }}>
        {value !== null && value !== undefined ? t(`visit.scale.${value}`) : t('visit.scale.0')}
      </p>
    </div>
    <div style={{ display: 'flex', gap: 6 }}>
      {[0,1,2,3,4,5].map((n) => {
        const active = value === n;
        return (
          <button
            key={n} type="button" onClick={() => onChange(field, n)}
            data-testid={`visit-${field}-${n}`}
            style={{
              width: 28, height: 28, borderRadius: '50%',
              border: `1px solid ${active ? tokens.teal : tokens.hairBold}`,
              background: active ? tokens.teal : 'transparent',
              color: active ? '#08090C' : tokens.inkSoft,
              fontFamily: 'Inter, sans-serif', fontSize: '0.72rem',
              cursor: 'pointer', transition: 'all 160ms ease',
            }}>
            {n}
          </button>
        );
      })}
    </div>
  </div>
);

const Block = ({ label, children }) => (
  <div style={{ marginTop: '1.6rem' }}>
    <p style={{ ...sectionLabel, marginBottom: '0.5rem' }}>{label}</p>
    {children}
  </div>
);

const Area = ({ value, onChange, placeholder, testid, rows = 3 }) => (
  <textarea
    value={value || ''} onChange={onChange} placeholder={placeholder} rows={rows}
    data-testid={testid}
    style={{
      width: '100%', background: 'transparent', border: `1px solid ${tokens.hair}`,
      color: tokens.ink, padding: '0.8rem 1rem', borderRadius: 2, outline: 'none',
      fontFamily: 'Playfair Display, serif', fontStyle: 'italic',
      fontSize: '0.96rem', lineHeight: 1.65, resize: 'vertical',
    }}
  />
);

const VisitReportForm = ({ t, relationId, onClose, onSaved }) => {
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await adminApi.createVisit(relationId, form);
      onSaved();
    } finally { setBusy(false); }
  };

  return (
    <div data-testid="visit-report-form" style={{
      position: 'fixed', inset: 0, background: 'rgba(8,9,12,0.86)',
      backdropFilter: 'blur(12px)', zIndex: 100, display: 'flex',
      justifyContent: 'flex-end',
    }} onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} style={{
        background: tokens.bg, width: 680, maxWidth: '95vw',
        borderLeft: `1px solid ${tokens.hairBold}`,
        padding: '3.5rem 3.5rem', overflowY: 'auto', height: '100vh',
      }}>
        <p style={{ ...eyebrow, marginBottom: '1rem' }}>{t('visit.eyebrow')}</p>
        <h2 style={{ ...headlineSmall, marginBottom: '0.6rem' }}>{t('visit.headline')}</h2>
        <p style={{ ...sublead, fontSize: '0.92rem', marginBottom: '2.5rem' }}>{t('visit.sublead')}</p>

        <Block label={t('visit.atmosphere.label')}>
          <Area value={form.atmosphere_observed}
                onChange={(e) => set('atmosphere_observed', e.target.value)}
                placeholder={t('visit.atmosphere.placeholder')} testid="visit-atmosphere" rows={4} />
        </Block>

        <div style={{ marginTop: '2.5rem', marginBottom: '2rem' }}>
          {RATINGS.map(([field, key]) => (
            <ScaleRow key={field} field={field} label={t(key)}
                      value={form[field]} onChange={set} t={t} />
          ))}
        </div>

        <Block label={t('visit.opportunities.label')}>
          <Area value={form.opportunities} onChange={(e) => set('opportunities', e.target.value)} testid="visit-opportunities" />
        </Block>
        <Block label={t('visit.objections.label')}>
          <Area value={form.objections} onChange={(e) => set('objections', e.target.value)} testid="visit-objections" />
        </Block>
        <Block label={t('visit.competitors.label')}>
          <Area value={form.competitor_tools} onChange={(e) => set('competitor_tools', e.target.value)} testid="visit-competitors" rows={2} />
        </Block>
        <Block label={t('visit.next_step.label')}>
          <Area value={form.next_step} onChange={(e) => set('next_step', e.target.value)} testid="visit-next-step" rows={2} />
        </Block>

        {/* Advisory Value */}
        <p style={{ ...eyebrow, marginTop: '3rem', marginBottom: '1.2rem' }}>{t('visit.value.eyebrow')}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
          <NumField label={t('visit.value.monthly')}     value={form.estimated_monthly_value} onChange={(v) => set('estimated_monthly_value', v)} testid="visit-emv" />
          <NumField label={t('visit.value.setup')}       value={form.estimated_setup_value}   onChange={(v) => set('estimated_setup_value',   v)} testid="visit-esv" />
          <NumField label={t('visit.value.probability')} value={form.probability_pct}         onChange={(v) => set('probability_pct',         v)} testid="visit-prob" suffix="%" />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3rem', gap: '1rem' }}>
          <button type="button" onClick={onClose} data-testid="visit-cancel" style={{
            background: 'transparent', border: 'none', color: tokens.inkDim,
            fontFamily: 'Inter, sans-serif', fontSize: '0.74rem',
            letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer',
          }}>
            {t('activation.cancel_cta')}
          </button>
          <button type="submit" disabled={busy} data-testid="visit-submit" style={{
            background: tokens.teal, color: '#08090C', border: 'none',
            padding: '0.85rem 1.6rem', fontFamily: 'Inter, sans-serif',
            fontSize: '0.72rem', letterSpacing: '0.22em', textTransform: 'uppercase',
            cursor: 'pointer', borderRadius: 2, opacity: busy ? 0.4 : 1, fontWeight: 500,
          }}>
            {busy ? '…' : t('visit.save_cta')}
          </button>
        </div>
      </form>
    </div>
  );
};

const NumField = ({ label, value, onChange, testid, suffix }) => (
  <div>
    <p style={{ ...sectionLabel, marginBottom: '0.4rem' }}>{label}</p>
    <div style={{ position: 'relative' }}>
      <input
        type="number" min="0"
        value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        data-testid={testid}
        style={{
          width: '100%', background: 'transparent', border: 'none',
          borderBottom: `1px solid ${tokens.hairBold}`,
          color: tokens.ink, padding: '0.45rem 0',
          fontFamily: 'Playfair Display, serif', fontStyle: 'italic',
          fontSize: '1.15rem', outline: 'none',
        }}
      />
      {suffix && (
        <span style={{
          position: 'absolute', right: 0, top: '0.45rem', color: tokens.inkDim,
          fontFamily: 'Inter, sans-serif', fontSize: '0.9rem',
        }}>{suffix}</span>
      )}
    </div>
  </div>
);

export default VisitReportForm;
