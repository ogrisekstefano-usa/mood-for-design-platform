/**
 * Step3 — Chi è il referente? (Nome, Cognome, Email global-uniq, Phone)
 */
import React from 'react';
import { useEmailCheck } from './hooks/useEmailCheck';
import { useCountries } from './hooks/useCountries';

const Step3Contact = ({ manifest, t, form, update, next, back, locale }) => {
  const { items: countries } = useCountries(locale || 'it-IT');
  const dialPrefix = (() => {
    const iso = form.headquarter_country_iso || form.country;
    const c   = countries.find((x) => x.iso2 === iso);
    return c?.dial_code || '+39';
  })();
  const { checking, available, reason } = useEmailCheck(form.contact_email);

  const emailValid = /.+@.+\..+/.test(form.contact_email || '');
  const emailOK    = emailValid && (available === true);
  const showError  = emailValid && available === false;

  const errorCopy = reason === 'user'
    ? t('email_taken_user')
    : reason === 'advisor'
      ? t('email_taken_advisor')
      : reason === 'pending'
        ? t('email_taken_pending')
        : reason === 'invalid'
          ? t('email_invalid')
          : '';

  const canContinue = !!form.first_name?.trim()
                   && !!form.last_name?.trim()
                   && emailOK
                   && !checking;

  // Default phone prefix from selected HQ country
  React.useEffect(() => {
    if (!form.phone_prefix && dialPrefix) {
      update({ phone_prefix: dialPrefix });
    }
    // eslint-disable-next-line
  }, [form.headquarter_country_iso, countries]);

  const inputStyle = {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 6, color: '#F4F4F5',
    padding: '14px 16px', fontSize: '1rem', fontFamily: 'inherit',
  };
  const labelStyle = {
    display: 'block', fontSize: '0.72rem', letterSpacing: '0.16em',
    color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase',
    marginBottom: 8,
  };

  return (
    <div data-testid="step3-contact">
      <h1 style={{
        fontSize: 'clamp(2rem, 4.5vw, 3rem)', lineHeight: 1.1,
        margin: '0 0 36px', fontWeight: 500, letterSpacing: '-0.02em',
      }} data-testid="step3-title">{t('step3_title')}</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 22 }}>
        <div>
          <label style={labelStyle}>{t('step3_first_name')}</label>
          <input type="text" value={form.first_name || ''}
            onChange={(e) => update({ first_name: e.target.value })}
            data-testid="first-name-input" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>{t('step3_last_name')}</label>
          <input type="text" value={form.last_name || ''}
            onChange={(e) => update({ last_name: e.target.value })}
            data-testid="last-name-input" style={inputStyle} />
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <label style={labelStyle}>{t('step3_email')}</label>
        <input type="email" value={form.contact_email || ''}
          onChange={(e) => update({ contact_email: (e.target.value || '').toLowerCase() })}
          data-testid="email-input"
          style={{
            ...inputStyle,
            borderColor: showError ? '#FFB4A2' : emailOK ? '#00C9B3' : 'rgba(255,255,255,0.12)',
          }} />
        {checking && (
          <p data-testid="email-checking" style={{
            fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)',
            marginTop: 6,
          }}>Verifica in corso…</p>
        )}
        {showError && (
          <p data-testid="email-error" style={{
            fontSize: '0.82rem', color: '#FFB4A2', marginTop: 6,
          }}>{errorCopy}</p>
        )}
        {emailValid && !checking && emailOK && (
          <p data-testid="email-ok" style={{
            fontSize: '0.78rem', color: '#00C9B3', marginTop: 6,
          }}>✓</p>
        )}
      </div>

      <div style={{ marginBottom: 36, display: 'grid', gridTemplateColumns: '100px 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>{t('step3_phone')}</label>
          <input type="text" value={form.phone_prefix || ''}
            onChange={(e) => update({ phone_prefix: e.target.value })}
            data-testid="phone-prefix-input" style={inputStyle} />
        </div>
        <div>
          <label style={{ ...labelStyle, visibility: 'hidden' }}>·</label>
          <input type="tel" value={form.phone_number || ''}
            onChange={(e) => update({ phone_number: e.target.value })}
            data-testid="phone-number-input" style={inputStyle} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <button type="button" onClick={back} data-testid="step3-back"
          style={{ background: 'transparent', color: 'rgba(255,255,255,0.6)',
            border: 'none', cursor: 'pointer',
            padding: '14px 4px', fontSize: '0.92rem', fontFamily: 'inherit' }}>
          ← {t('btn_back')}
        </button>
        <button type="button" disabled={!canContinue} onClick={next}
          data-testid="step3-continue"
          style={{
            background: canContinue ? '#00C9B3' : 'rgba(255,255,255,0.08)',
            color: canContinue ? '#0A0A0B' : 'rgba(255,255,255,0.4)',
            border: 'none', borderRadius: 999,
            padding: '14px 32px', fontSize: '0.92rem',
            fontWeight: 500, letterSpacing: '0.04em',
            cursor: canContinue ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
          }}>{t('btn_continue')} →</button>
      </div>
    </div>
  );
};

export default Step3Contact;
