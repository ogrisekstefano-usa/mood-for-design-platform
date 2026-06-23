/**
 * PartnerApplicationPage.jsx
 * Phase 3 — Task 1.
 *
 * Public intake form for showrooms, brands, and consultants who want
 * to join the MOOD for DESIGN ecosystem as partners.
 *
 * Endpoint: POST /api/corporate/partner-application
 * Components reused: PhonePrefixField (from studio_v2)
 * Hooks reused: useCountries, useLocale
 */
import React, { useState } from 'react';
import axios from 'axios';
import { useLocale } from '../../contexts/LocaleContext';
import { useCountries } from './studio_v2/hooks/useCountries';
import PhonePrefixField from './studio_v2/components/PhonePrefixField';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// ── Localized copy ────────────────────────────────────────────────────────
const COPY = {
  it: {
    eyebrow:       'Diventa partner',
    title:         'Entra nell\'ecosistema MOOD.',
    subtitle:      'Showroom, brand, consulenti e studi: se il tuo lavoro parla il linguaggio del design contemporaneo, c\'è uno spazio per te nell\'ecosistema MOOD.',
    first_name:    'Nome *',
    last_name:     'Cognome *',
    email:         'Email *',
    phone:         'Telefono',
    company:       'Studio / Azienda',
    website:       'Sito web',
    profile_type:  'Profilo *',
    intents:       'Aree di collaborazione',
    message:       'Come ti immagini la collaborazione?',
    submit:        'Invia candidatura',
    submitting:    'Invio in corso…',
    success_title: 'Candidatura ricevuta.',
    success_body:  'Ti risponderemo entro 48 ore per esplorare insieme le possibilità.',
    error:         'Qualcosa non ha funzionato. Riprova.',
    profiles: {
      showroom:   'Showroom',
      brand:      'Brand / Produttore',
      consultant: 'Consulente / Advisor',
      studio:     'Studio di design',
      other:      'Altro',
    },
    intent_labels: {
      content_collaboration:  'Collaborazione editoriale',
      product_curation:       'Curation di prodotto',
      editorial_partnerships: 'Partnership editoriali',
      training_programs:      'Programmi di formazione',
      ecosystem_membership:   'Accesso all\'ecosistema',
    },
    search_placeholder: 'Cerca paese…',
  },
  en: {
    eyebrow:       'Become a partner',
    title:         'Enter the MOOD ecosystem.',
    subtitle:      'Showrooms, brands, consultants, and studios: if your work speaks the language of contemporary design, there is a place for you in the MOOD ecosystem.',
    first_name:    'First name *',
    last_name:     'Last name *',
    email:         'Email *',
    phone:         'Phone',
    company:       'Studio / Company',
    website:       'Website',
    profile_type:  'Profile *',
    intents:       'Collaboration areas',
    message:       'How do you envision the collaboration?',
    submit:        'Send application',
    submitting:    'Sending…',
    success_title: 'Application received.',
    success_body:  'We will respond within 48 hours to explore the possibilities together.',
    error:         'Something went wrong. Please try again.',
    profiles: {
      showroom:   'Showroom',
      brand:      'Brand / Manufacturer',
      consultant: 'Consultant / Advisor',
      studio:     'Design studio',
      other:      'Other',
    },
    intent_labels: {
      content_collaboration:  'Editorial collaboration',
      product_curation:       'Product curation',
      editorial_partnerships: 'Editorial partnerships',
      training_programs:      'Training programs',
      ecosystem_membership:   'Ecosystem membership',
    },
    search_placeholder: 'Search country…',
  },
};

const PROFILE_TYPES = ['showroom', 'brand', 'consultant', 'studio', 'other'];
const INTENT_KEYS   = [
  'content_collaboration',
  'product_curation',
  'editorial_partnerships',
  'training_programs',
  'ecosystem_membership',
];

// ── Input styles ──────────────────────────────────────────────────────────
const inputStyle = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.14)',
  padding: '13px 16px',
  color: '#F4F4F5',
  fontSize: '0.95rem',
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'border-color 0.2s',
  borderRadius: 4,
  boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.72rem',
  fontWeight: 600,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.55)',
  marginBottom: '0.55rem',
};

const PartnerApplicationPage = () => {
  const { locale } = useLocale();
  const resolvedLocale = locale || (() => {
    try { return localStorage.getItem('mood-locale') || localStorage.getItem('mood_locale') || ''; } catch { return ''; }
  })();
  const isIT = resolvedLocale.startsWith('it');
  const c = isIT ? COPY.it : COPY.en;

  const { items: countries, ready: countriesReady } = useCountries(locale || 'it-IT');

  const [form, setForm] = useState({
    first_name:             '',
    last_name:              '',
    email:                  '',
    phone_prefix_iso:       'IT',
    phone_number:           '',
    company:                '',
    website:                '',
    profile_type:           '',
    collaboration_intents:  [],
    message:                '',
  });
  const [status, setStatus] = useState(null); // null | 'loading' | 'success' | 'error'

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const toggleIntent = (key) => {
    setForm(f => ({
      ...f,
      collaboration_intents: f.collaboration_intents.includes(key)
        ? f.collaboration_intents.filter(k => k !== key)
        : [...f.collaboration_intents, key],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    try {
      const dialCode = (countries.find(c => c.iso2 === form.phone_prefix_iso) || {}).dial_code || '';
      await axios.post(`${BACKEND_URL}/api/corporate/partner-application`, {
        first_name:            form.first_name,
        last_name:             form.last_name,
        email:                 form.email,
        phone_prefix:          dialCode,
        phone_number:          form.phone_number,
        company:               form.company || null,
        website:               form.website || null,
        profile_type:          form.profile_type,
        collaboration_intents: form.collaboration_intents,
        message:               form.message || null,
        locale:                locale || 'en-US',
      });
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <main
        data-testid="partner-application-page"
        style={{ background: 'var(--mood-black)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.5rem' }}
      >
        <div data-testid="partner-success" style={{ textAlign: 'center', maxWidth: 560 }}>
          <span style={{
            display: 'inline-block',
            width: 48, height: 48,
            border: '2px solid #00C9B3',
            borderRadius: '50%',
            marginBottom: '1.5rem',
            lineHeight: '44px',
            fontSize: '1.2rem',
            color: '#00C9B3',
          }}>✓</span>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '2rem', fontStyle: 'italic', color: '#FFFFFF', margin: '0 0 1rem' }}>
            {c.success_title}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.58)', lineHeight: 1.7, fontSize: '1rem' }}>
            {c.success_body}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main data-testid="partner-application-page" style={{ background: 'var(--mood-black)', minHeight: '100vh' }}>
      {/* Hero strip */}
      <section style={{
        padding: 'clamp(5rem, 10vw, 8rem) clamp(1.5rem, 6vw, 6rem) clamp(3rem, 6vw, 4rem)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        maxWidth: 1200,
        margin: '0 auto',
      }}>
        <p data-testid="partner-eyebrow" style={{
          fontSize: '0.72rem', letterSpacing: '0.18em', textTransform: 'uppercase',
          color: '#00C9B3', marginBottom: '1.2rem', fontWeight: 600,
        }}>
          {c.eyebrow}
        </p>
        <h1 data-testid="partner-title" style={{
          fontFamily: "'Playfair Display', 'Georgia', serif",
          fontSize: 'clamp(2rem, 5vw, 3.5rem)',
          fontWeight: 700,
          fontStyle: 'italic',
          color: '#FFFFFF',
          lineHeight: 1.15,
          margin: '0 0 1.2rem',
          letterSpacing: '-0.01em',
          maxWidth: 700,
        }}>
          {c.title}
        </h1>
        <p data-testid="partner-subtitle" style={{
          color: 'rgba(255,255,255,0.55)',
          fontSize: 'clamp(0.95rem, 1.5vw, 1.1rem)',
          lineHeight: 1.7,
          maxWidth: 580,
          margin: 0,
        }}>
          {c.subtitle}
        </p>
      </section>

      {/* Form */}
      <section style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: 'clamp(3rem, 6vw, 5rem) clamp(1.5rem, 6vw, 6rem)',
      }}>
        <form onSubmit={handleSubmit} data-testid="partner-form" noValidate>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.5rem 2rem',
          }}>

            {/* First name */}
            <div>
              <label style={labelStyle}>{c.first_name}</label>
              <input
                type="text"
                required
                value={form.first_name}
                onChange={e => setField('first_name', e.target.value)}
                style={inputStyle}
                data-testid="partner-first-name"
              />
            </div>

            {/* Last name */}
            <div>
              <label style={labelStyle}>{c.last_name}</label>
              <input
                type="text"
                required
                value={form.last_name}
                onChange={e => setField('last_name', e.target.value)}
                style={inputStyle}
                data-testid="partner-last-name"
              />
            </div>

            {/* Email */}
            <div>
              <label style={labelStyle}>{c.email}</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setField('email', e.target.value)}
                style={inputStyle}
                data-testid="partner-email"
              />
            </div>

            {/* Phone */}
            <div>
              <label style={labelStyle}>{c.phone}</label>
              <PhonePrefixField
                countries={countries}
                prefixIso={form.phone_prefix_iso}
                onPrefixIso={iso => setField('phone_prefix_iso', iso)}
                number={form.phone_number}
                onNumber={n => setField('phone_number', n)}
                testIdRoot="partner-phone"
                searchPlaceholder={c.search_placeholder}
              />
            </div>

            {/* Company */}
            <div>
              <label style={labelStyle}>{c.company}</label>
              <input
                type="text"
                value={form.company}
                onChange={e => setField('company', e.target.value)}
                style={inputStyle}
                data-testid="partner-company"
              />
            </div>

            {/* Website */}
            <div>
              <label style={labelStyle}>{c.website}</label>
              <input
                type="url"
                value={form.website}
                onChange={e => setField('website', e.target.value)}
                placeholder="https://"
                style={inputStyle}
                data-testid="partner-website"
              />
            </div>

            {/* Profile type */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>{c.profile_type}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }} data-testid="partner-profile-type">
                {PROFILE_TYPES.map(pt => (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => setField('profile_type', pt)}
                    data-testid={`partner-profile-${pt}`}
                    style={{
                      padding: '0.55rem 1.2rem',
                      borderRadius: 3,
                      border: form.profile_type === pt
                        ? '1px solid #00C9B3'
                        : '1px solid rgba(255,255,255,0.18)',
                      background: form.profile_type === pt
                        ? 'rgba(0,201,179,0.12)'
                        : 'transparent',
                      color: form.profile_type === pt ? '#00C9B3' : 'rgba(255,255,255,0.65)',
                      fontSize: '0.88rem',
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      transition: 'all 0.18s',
                    }}
                  >
                    {c.profiles[pt]}
                  </button>
                ))}
              </div>
            </div>

            {/* Collaboration intents */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>{c.intents}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }} data-testid="partner-intents">
                {INTENT_KEYS.map(ik => {
                  const active = form.collaboration_intents.includes(ik);
                  return (
                    <button
                      key={ik}
                      type="button"
                      onClick={() => toggleIntent(ik)}
                      data-testid={`partner-intent-${ik}`}
                      style={{
                        padding: '0.55rem 1.2rem',
                        borderRadius: 3,
                        border: active
                          ? '1px solid rgba(0,201,179,0.7)'
                          : '1px solid rgba(255,255,255,0.12)',
                        background: active
                          ? 'rgba(0,201,179,0.08)'
                          : 'rgba(255,255,255,0.02)',
                        color: active ? '#00C9B3' : 'rgba(255,255,255,0.5)',
                        fontSize: '0.85rem',
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        transition: 'all 0.18s',
                      }}
                    >
                      {c.intent_labels[ik]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Message */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>{c.message}</label>
              <textarea
                rows={5}
                value={form.message}
                onChange={e => setField('message', e.target.value)}
                style={{ ...inputStyle, resize: 'vertical' }}
                data-testid="partner-message"
              />
            </div>
          </div>

          {/* Error */}
          {status === 'error' && (
            <div data-testid="partner-error" style={{
              marginTop: '1.5rem',
              padding: '0.9rem 1.2rem',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 4,
              color: '#FCA5A5',
              fontSize: '0.9rem',
            }}>
              {c.error}
            </div>
          )}

          {/* Submit */}
          <div style={{ marginTop: '2.5rem' }}>
            <button
              type="submit"
              disabled={status === 'loading' || !form.profile_type}
              data-testid="partner-submit"
              style={{
                padding: '0.9rem 2.5rem',
                background: status === 'loading' || !form.profile_type
                  ? 'rgba(255,255,255,0.12)'
                  : '#00C9B3',
                color: status === 'loading' || !form.profile_type
                  ? 'rgba(255,255,255,0.4)'
                  : '#0A0A0A',
                border: 'none',
                fontSize: '0.85rem',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: status === 'loading' || !form.profile_type ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                borderRadius: 3,
                fontFamily: 'inherit',
              }}
            >
              {status === 'loading' ? c.submitting : c.submit}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
};

export default PartnerApplicationPage;
