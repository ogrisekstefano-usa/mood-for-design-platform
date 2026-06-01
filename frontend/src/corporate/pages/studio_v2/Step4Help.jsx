/**
 * Step4 — Come possiamo aiutarti? (multi-select DB-driven + Altro free-text)
 * Final step → on submit, calls /api/studio/v2/submit (which wraps V1
 * submit_request so the lifecycle email pipeline fires unchanged).
 */
import React, { useState } from 'react';
import axios from 'axios';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const Step4Help = ({ manifest, t, form, update, next, back,
                     draftToken, locale, setSubmitResult, withLoading }) => {
  const topics = manifest?.help_topics || [];
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const toggle = (code) => {
    const cur = new Set(form.help_topics || []);
    if (cur.has(code)) cur.delete(code); else cur.add(code);
    update({ help_topics: Array.from(cur) });
  };

  const otherSel  = (form.help_topics || []).includes('other');
  const canSubmit = (form.help_topics || []).length > 0 && !submitting;

  const onSubmit = async () => {
    setSubmitting(true);
    setError(null);
    const doSubmit = async () => {
      try {
        const r = await axios.post(`${BACKEND}/api/studio/v2/submit`, {
        draft_token:        draftToken,
        archetype_code:     form.archetype_code,
        // New V2 geo (Step 2 refactor)
        primary_operating_market_code: form.primary_operating_market_code,
        headquarter_country_iso:       form.headquarter_country_iso,
        headquarter_city:              form.headquarter_city,
        headquarter_region:            form.headquarter_region,
        headquarter_lat:               form.headquarter_lat,
        headquarter_lng:               form.headquarter_lng,
        mapbox_place_id:               form.mapbox_place_id,
        // Target countries with priority + status (new structure)
        target_countries:              form.target_countries || [],
        // Contact + help
        first_name:         form.first_name,
        last_name:          form.last_name,
        contact_email:      form.contact_email,
        phone_prefix:       form.phone_prefix,
        phone_number:       form.phone_number,
        help_topics:        form.help_topics || [],
        help_other_text:    form.help_other_text || '',
        locale,
      });
      if (r.data?.ok) {
        setSubmitResult(r.data);
        next();
      } else {
        setError(r.data?.reason || 'internal');
      }
    } catch (e) {
      setError(e.response?.data?.reason || e.message);
    } finally {
      setSubmitting(false);
    }
    };
    if (withLoading) {
      await withLoading(t('loading.message', 'Un attimo…'), doSubmit);
    } else {
      await doSubmit();
    }
  };

  return (
    <div data-testid="step4-help">
      <h1 style={{
        fontSize: 'clamp(2rem, 4.5vw, 3rem)', lineHeight: 1.1,
        margin: '0 0 10px', fontWeight: 500, letterSpacing: '-0.02em',
      }} data-testid="step4-title">{t('step4_title')}</h1>
      <p style={{
        color: 'rgba(255,255,255,0.55)', marginBottom: 32, fontSize: '1rem',
      }} data-testid="step4-sublead">{t('step4_sublead')}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {topics.map((topic) => {
          const sel = (form.help_topics || []).includes(topic.code);
          return (
            <button
              key={topic.code} type="button"
              onClick={() => toggle(topic.code)}
              data-testid={`help-topic-${topic.code}`}
              style={{
                background: sel ? 'rgba(0,201,179,0.08)' : 'rgba(255,255,255,0.025)',
                border: '1px solid ' + (sel ? '#00C9B3' : 'rgba(255,255,255,0.08)'),
                borderRadius: 6, padding: '14px 18px',
                color: '#F4F4F5', textAlign: 'left',
                cursor: 'pointer', fontSize: '1rem', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 12,
              }}
            >
              <span style={{
                width: 16, height: 16, borderRadius: 3,
                border: '1px solid ' + (sel ? '#00C9B3' : 'rgba(255,255,255,0.3)'),
                background: sel ? '#00C9B3' : 'transparent',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, color: '#0A0A0B', fontWeight: 700,
              }}>{sel ? '✓' : ''}</span>
              {topic.label}
            </button>
          );
        })}
      </div>

      {otherSel && (
        <div style={{ marginBottom: 24 }}>
          <input type="text" value={form.help_other_text || ''}
            onChange={(e) => update({ help_other_text: e.target.value })}
            placeholder={t('step4.help_other.placeholder', 'Specifica…')}
            data-testid="help-other-input"
            style={{
              width: '100%', background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6,
              color: '#F4F4F5', padding: '12px 16px',
              fontSize: '0.95rem', fontFamily: 'inherit',
            }} />
        </div>
      )}

      {error && (
        <p data-testid="step4-error" style={{
          color: '#FFB4A2', fontSize: '0.88rem', marginBottom: 16,
        }}>{t('step4.error.prefix', 'Si è verificato un errore')}: {error}</p>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <button type="button" onClick={back} data-testid="step4-back"
          disabled={submitting}
          style={{
            background: 'transparent', color: 'rgba(255,255,255,0.6)',
            border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
            padding: '14px 4px', fontSize: '0.92rem', fontFamily: 'inherit',
          }}>← {t('btn_back')}</button>
        <button type="button" onClick={onSubmit}
          disabled={!canSubmit}
          data-testid="step4-submit"
          style={{
            background: canSubmit ? '#00C9B3' : 'rgba(255,255,255,0.08)',
            color: canSubmit ? '#0A0A0B' : 'rgba(255,255,255,0.4)',
            border: 'none', borderRadius: 999,
            padding: '14px 32px', fontSize: '0.92rem',
            fontWeight: 500, letterSpacing: '0.04em',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
          }}>{submitting ? '…' : t('btn_submit')}</button>
      </div>
    </div>
  );
};

export default Step4Help;
