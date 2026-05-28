/**
 * MovementIdentity — /studio/identity
 *
 * The studio composes its own portrait. Form-heavy by necessity, but
 * never SaaS-feeling: pure typographic inputs (underline only, no
 * boxes), vertical staggered reveal, auto-save on blur with a quiet
 * italic confirmation. Closes with a single CTA "Invia la richiesta".
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import StudioActivationLayout from './StudioActivationLayout';
import { useActivationDraft } from './useActivationDraft';
import { useStudioManifest } from './useStudioManifest';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const LANGUAGES = ['it', 'en-us', 'fr', 'de', 'es'];
const MARKETS = [
  'private_residential', 'hospitality', 'cultural', 'yacht',
  'aviation', 'retail', 'office', 'showroom', 'restaurant',
];
const TEMPERAMENTS = ['quiet', 'composed', 'vivid'];

const MovementIdentity = () => {
  const navigate = useNavigate();
  const { t, ready: manifestReady } = useStudioManifest();
  const { draft, patch, resumed, ready: draftReady } = useActivationDraft();

  // Form local state, synced from draft.payload
  const payload = draft?.payload || {};
  const [form, setForm] = useState({
    studio_name:    payload.studio_name    || '',
    monogram:       payload.monogram       || '',
    city:           payload.city           || '',
    country:        payload.country        || '',
    languages:      payload.languages      || ['it'],
    atelier:        payload.atelier        || [{ name: '', role: '' }],
    markets:        payload.markets        || [],
    temperament:    payload.temperament    || null,
    contact_name:   payload.contact_name   || '',
    contact_role:   payload.contact_role   || '',
    contact_email:  payload.contact_email  || '',
    phone_prefix:   payload.phone_prefix   || '+39',
    phone_number:   payload.phone_number   || '',
    website:        payload.website        || '',
    notes:          payload.notes          || '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [softError,  setSoftError]  = useState(null);

  // Whenever the draft loads later, hydrate fields once
  useEffect(() => {
    if (!draftReady || !payload) return;
    setForm((f) => ({
      ...f,
      ...Object.fromEntries(
        Object.entries(payload).filter(([k, v]) =>
          v !== undefined && v !== null && (!Array.isArray(v) || v.length > 0)),
      ),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftReady]);

  const persist = (updates) => {
    const next = { ...form, ...updates };
    setForm(next);
    patch({ payload: updates });
  };

  const toggleArrayValue = (key, value) => {
    const arr = new Set(form[key] || []);
    if (arr.has(value)) arr.delete(value);
    else arr.add(value);
    persist({ [key]: Array.from(arr) });
  };

  const updateAtelierMember = (idx, field, value) => {
    const next = form.atelier.map((m, i) => i === idx ? { ...m, [field]: value } : m);
    persist({ atelier: next });
  };

  const addAtelierMember = () => {
    if (form.atelier.length >= 8) return;
    persist({ atelier: [...form.atelier, { name: '', role: '' }] });
  };

  const removeAtelierMember = (idx) => {
    persist({ atelier: form.atelier.filter((_, i) => i !== idx) });
  };

  const onSubmit = async (e) => {
    e?.preventDefault?.();
    if (submitting) return;
    if (!form.contact_email || !form.contact_email.includes('@')) {
      setSoftError('email');
      return;
    }
    setSoftError(null);
    setSubmitting(true);
    try {
      const res = await axios.post(`${BACKEND}/api/studio/activation/submit`, {
        draft_token:   draft?.draft_token,
        contact_name:  form.contact_name,
        contact_role:  form.contact_role,
        contact_email: form.contact_email,
        phone_prefix:  form.phone_prefix,
        phone_number:  form.phone_number,
        website:       form.website,
        notes:         form.notes,
        locale:        'it',
      });
      if (res.data?.ok && res.data.request_id) {
        sessionStorage.setItem('mood_studio_request', JSON.stringify({
          request_id: res.data.request_id,
          reference:  res.data.reference,
          email:      form.contact_email,
        }));
        navigate('/studio/request');
      } else {
        // concierge intercept: still proceed to request page,
        // showing a calm confirmation
        navigate('/studio/request');
      }
    } catch {
      navigate('/studio/request');
    } finally {
      setSubmitting(false);
    }
  };

  const ready = manifestReady && draftReady;

  return (
    <StudioActivationLayout
      movement="identity"
      monogram={form.monogram || (form.studio_name ? form.studio_name[0]?.toUpperCase() : null)}
      resumed={resumed}
    >
      {/* Ambient backdrop */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <div style={{
          position: 'absolute', inset: 0,
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(0,201,179,0.04) 0%, transparent 38%),' +
            'radial-gradient(ellipse at 90% 100%, rgba(255,180,162,0.03) 0%, transparent 50%)',
        }} />
      </div>

      {/* Scrollable composition */}
      <div
        style={{
          position: 'absolute', inset: 0,
          overflowY: 'auto',
          padding: '120px 24px 140px 24px',
        }}
        data-testid="identity-scroll"
      >
        <div
          className={ready ? 'studio-rise' : ''}
          style={{
            maxWidth: 720, margin: '0 auto',
            display: 'grid', gap: 56,
          }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center' }}>
            <p style={EYEBROW_STYLE}>{t['studio.activation.identity.eyebrow']}</p>
            <h1 style={HEADLINE_STYLE} data-testid="identity-headline">
              {t['studio.activation.identity.headline']}
            </h1>
            <p style={SUBLEAD_STYLE}>{t['studio.activation.identity.sublead']}</p>
          </div>

          {/* Studio name */}
          <Field label={t['studio.activation.identity.studio_name.label']}>
            <input
              type="text"
              value={form.studio_name}
              onChange={(e) => setForm((f) => ({ ...f, studio_name: e.target.value }))}
              onBlur={(e) => persist({ studio_name: e.target.value })}
              placeholder={t['studio.activation.identity.studio_name.placeholder']}
              data-testid="identity-studio-name"
              style={INPUT_SERIF}
            />
          </Field>

          {/* Monogram */}
          <Field
            label={t['studio.activation.identity.monogram.label']}
            helper={t['studio.activation.identity.monogram.helper']}
          >
            <input
              type="text"
              value={form.monogram}
              maxLength={3}
              onChange={(e) => setForm((f) => ({ ...f, monogram: e.target.value.toUpperCase() }))}
              onBlur={(e) => persist({ monogram: e.target.value.toUpperCase() })}
              data-testid="identity-monogram"
              style={{ ...INPUT_SERIF, fontSize: '1.8rem', maxWidth: 120, textAlign: 'center' }}
            />
          </Field>

          {/* Where */}
          <Field label={t['studio.activation.identity.where.label']}>
            <div style={{ display: 'flex', gap: 20 }}>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                onBlur={(e) => persist({ city: e.target.value })}
                placeholder={t['studio.activation.identity.where.city_placeholder']}
                data-testid="identity-city"
                style={{ ...INPUT_SANS, flex: 1 }}
              />
              <input
                type="text"
                value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                onBlur={(e) => persist({ country: e.target.value })}
                placeholder={t['studio.activation.identity.where.country_placeholder']}
                data-testid="identity-country"
                style={{ ...INPUT_SANS, flex: 1 }}
              />
            </div>
          </Field>

          {/* Languages */}
          <Field label={t['studio.activation.identity.languages.label']}>
            <ChipRow
              testidPrefix="identity-lang"
              options={LANGUAGES.map((code) => ({
                value: code,
                label: t[`studio.activation.language.${code}`] || code,
              }))}
              selected={form.languages}
              onToggle={(v) => toggleArrayValue('languages', v)}
            />
          </Field>

          {/* Atelier */}
          <Field label={t['studio.activation.identity.atelier.label']}>
            <div style={{ display: 'grid', gap: 14 }}>
              {form.atelier.map((m, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
                  <input
                    type="text"
                    value={m.name}
                    onChange={(e) => updateAtelierMember(idx, 'name', e.target.value)}
                    placeholder={t['studio.activation.identity.atelier.name_placeholder']}
                    data-testid={`identity-atelier-name-${idx}`}
                    style={{ ...INPUT_SANS, flex: 2 }}
                  />
                  <input
                    type="text"
                    value={m.role}
                    onChange={(e) => updateAtelierMember(idx, 'role', e.target.value)}
                    placeholder={t['studio.activation.identity.atelier.role_placeholder']}
                    data-testid={`identity-atelier-role-${idx}`}
                    style={{ ...INPUT_SANS, flex: 1 }}
                  />
                  {form.atelier.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAtelierMember(idx)}
                      style={{
                        background: 'transparent', border: 'none', padding: 4,
                        color: 'rgba(255,255,255,0.35)', cursor: 'pointer',
                        fontFamily: '"Playfair Display", serif',
                        fontStyle: 'italic', fontSize: 13,
                      }}
                      aria-label="remove"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addAtelierMember}
                data-testid="identity-atelier-add"
                style={ghostLink}
              >
                + {t['studio.activation.identity.atelier.add']}
              </button>
            </div>
          </Field>

          {/* Markets */}
          <Field label={t['studio.activation.identity.markets.label']}>
            <ChipRow
              testidPrefix="identity-market"
              options={MARKETS.map((m) => ({
                value: m,
                label: t[`studio.activation.market.${m}`] || m,
              }))}
              selected={form.markets}
              onToggle={(v) => toggleArrayValue('markets', v)}
            />
          </Field>

          {/* Temperament */}
          <Field
            label={t['studio.activation.identity.temperament.label']}
            helper={t['studio.activation.identity.temperament.helper']}
          >
            <div style={{ display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {TEMPERAMENTS.map((temp) => {
                const isSelected = form.temperament === temp;
                return (
                  <button
                    key={temp}
                    type="button"
                    onClick={() => persist({ temperament: temp })}
                    data-testid={`identity-temperament-${temp}`}
                    style={{
                      appearance: 'none',
                      background: 'transparent',
                      border: '1px solid',
                      borderColor: isSelected ? '#00C9B3' : 'rgba(255,255,255,0.12)',
                      borderRadius: 4,
                      padding: '22px 18px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'border-color 320ms ease, background 320ms ease',
                      background: isSelected ? 'rgba(0,201,179,0.04)' : 'transparent',
                    }}
                  >
                    <p style={{
                          margin: 0,
                          fontFamily: '"Playfair Display", Georgia, serif',
                          fontSize: '1.1rem', color: '#FFFFFF',
                        }}>
                      {t[`studio.activation.temperament.${temp}.title`] || ''}
                    </p>
                    <p style={{
                          margin: '10px 0 0 0',
                          fontFamily: '"Playfair Display", Georgia, serif',
                          fontStyle: 'italic',
                          fontSize: '0.88rem',
                          lineHeight: 1.5,
                          color: 'rgba(255,255,255,0.62)',
                        }}>
                      {t[`studio.activation.temperament.${temp}.body`] || ''}
                    </p>
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Contact block */}
          <div style={{ paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ ...EYEBROW_STYLE, textAlign: 'left' }}>
              {t['studio.activation.identity.contact.eyebrow']}
            </p>
            <h2 style={{
                  margin: '14px 0 28px 0',
                  fontFamily: '"Playfair Display", Georgia, serif',
                  fontWeight: 400, fontSize: '1.6rem', color: '#FFFFFF',
                }}>
              {t['studio.activation.identity.contact.headline']}
            </h2>

            <div style={{ display: 'grid', gap: 24 }}>
              <div style={{ display: 'flex', gap: 20 }}>
                <input
                  type="text"
                  value={form.contact_name}
                  onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
                  onBlur={(e) => persist({ contact_name: e.target.value })}
                  placeholder={t['studio.activation.identity.contact.name_placeholder']}
                  data-testid="identity-contact-name"
                  style={{ ...INPUT_SANS, flex: 1 }}
                />
                <input
                  type="text"
                  value={form.contact_role}
                  onChange={(e) => setForm((f) => ({ ...f, contact_role: e.target.value }))}
                  onBlur={(e) => persist({ contact_role: e.target.value })}
                  placeholder={t['studio.activation.identity.contact.role_placeholder']}
                  data-testid="identity-contact-role"
                  style={{ ...INPUT_SANS, flex: 1 }}
                />
              </div>

              <Field label={t['studio.activation.identity.contact.email_label']}>
                <input
                  type="email"
                  required
                  value={form.contact_email}
                  onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
                  onBlur={(e) => persist({ contact_email: e.target.value.toLowerCase() })}
                  placeholder={t['studio.activation.identity.contact.email_placeholder']}
                  data-testid="identity-contact-email"
                  style={{ ...INPUT_SANS,
                            borderColor: softError === 'email' ? '#ffb4a2' : undefined }}
                />
                {softError === 'email' && (
                  <p style={{ margin: '8px 0 0 0',
                                fontFamily: '"Playfair Display", serif',
                                fontStyle: 'italic',
                                fontSize: '0.86rem',
                                color: 'rgba(255,180,162,0.85)' }}>
                    Per continuare, lascia un riferimento email.
                  </p>
                )}
              </Field>

              <Field label={t['studio.activation.identity.contact.phone_label']}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <input
                    type="text"
                    value={form.phone_prefix}
                    onChange={(e) => setForm((f) => ({ ...f, phone_prefix: e.target.value }))}
                    onBlur={(e) => persist({ phone_prefix: e.target.value })}
                    placeholder={t['studio.activation.identity.contact.phone_prefix_placeholder']}
                    data-testid="identity-contact-phone-prefix"
                    style={{ ...INPUT_SANS, width: 80 }}
                  />
                  <input
                    type="tel"
                    value={form.phone_number}
                    onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))}
                    onBlur={(e) => persist({ phone_number: e.target.value })}
                    placeholder={t['studio.activation.identity.contact.phone_number_placeholder']}
                    data-testid="identity-contact-phone-number"
                    style={{ ...INPUT_SANS, flex: 1 }}
                  />
                </div>
              </Field>

              <Field label={t['studio.activation.identity.contact.website_label']}>
                <input
                  type="text"
                  value={form.website}
                  onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                  onBlur={(e) => persist({ website: e.target.value })}
                  placeholder={t['studio.activation.identity.contact.website_placeholder']}
                  data-testid="identity-contact-website"
                  style={INPUT_SANS}
                />
              </Field>

              <Field label={t['studio.activation.identity.contact.notes_label']}>
                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  onBlur={(e) => persist({ notes: e.target.value })}
                  placeholder={t['studio.activation.identity.contact.notes_placeholder']}
                  data-testid="identity-contact-notes"
                  style={{ ...INPUT_SANS, resize: 'vertical', minHeight: 92,
                             padding: '14px 2px', borderBottom: '1px solid rgba(255,255,255,0.22)' }}
                />
              </Field>
            </div>
          </div>

          {/* Submit */}
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting}
              data-testid="identity-submit"
              style={{
                ...ctaSolid,
                opacity: submitting ? 0.5 : 1,
                cursor: submitting ? 'wait' : 'pointer',
              }}
              onMouseOver={(e) => {
                if (submitting) return;
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 10px 32px rgba(0,201,179,0.32)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {t['studio.activation.identity.continue_cta'] || 'Invia la richiesta'}
            </button>
          </div>
        </div>
      </div>
    </StudioActivationLayout>
  );
};

// ─── Primitives
const Field = ({ label, helper, children }) => (
  <div>
    <label style={{
              display: 'block', marginBottom: 10,
              fontFamily: '"Helvetica Neue", Arial, sans-serif',
              fontSize: '0.7rem', letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.55)',
            }}>
      {label}
    </label>
    {children}
    {helper && (
      <p style={{ margin: '8px 0 0 0',
                    fontFamily: '"Playfair Display", serif',
                    fontStyle: 'italic',
                    fontSize: '0.82rem',
                    color: 'rgba(255,255,255,0.42)' }}>
        {helper}
      </p>
    )}
  </div>
);

const ChipRow = ({ options, selected, onToggle, testidPrefix }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
    {options.map((o) => {
      const isOn = selected?.includes(o.value);
      return (
        <button
          key={o.value}
          type="button"
          onClick={() => onToggle(o.value)}
          data-testid={`${testidPrefix}-${o.value}`}
          style={{
            appearance: 'none',
            background: isOn ? 'rgba(0,201,179,0.08)' : 'transparent',
            border: '1px solid',
            borderColor: isOn ? '#00C9B3' : 'rgba(255,255,255,0.18)',
            borderRadius: 999,
            padding: '8px 16px',
            fontFamily: '"Helvetica Neue", Arial, sans-serif',
            fontSize: '0.82rem',
            color: isOn ? '#00C9B3' : 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
            transition: 'all 280ms ease',
          }}
        >
          {o.label}
        </button>
      );
    })}
  </div>
);

const INPUT_SANS = {
  width: '100%', background: 'transparent', border: 'none',
  borderBottom: '1px solid rgba(255,255,255,0.22)',
  padding: '12px 2px',
  fontFamily: '"Helvetica Neue", Arial, sans-serif',
  fontSize: '1.02rem', color: '#FFFFFF',
  outline: 'none',
  transition: 'border-color 280ms ease',
};
const INPUT_SERIF = {
  ...INPUT_SANS,
  fontFamily: '"Playfair Display", Georgia, serif',
  fontSize: '1.6rem',
};

// ─── Header styles (mirror MovementEcosystem)
const EYEBROW_STYLE = {
  margin: 0, fontSize: '0.7rem', letterSpacing: '0.32em',
  textTransform: 'uppercase', color: '#00C9B3', opacity: 0.95,
  fontFamily: '"Helvetica Neue", Arial, sans-serif',
};
const HEADLINE_STYLE = {
  margin: '18px auto 0 auto',
  fontFamily: '"Playfair Display", Georgia, serif',
  fontWeight: 400,
  fontSize: 'clamp(1.7rem, 3.0vw, 2.4rem)',
  lineHeight: 1.12,
  letterSpacing: '-0.005em',
  maxWidth: '24ch',
  color: '#FFFFFF',
};
const SUBLEAD_STYLE = {
  margin: '14px auto 0 auto',
  fontFamily: '"Playfair Display", Georgia, serif',
  fontStyle: 'italic',
  fontSize: 'clamp(0.92rem, 1.15vw, 1.02rem)',
  lineHeight: 1.5,
  color: 'rgba(255,255,255,0.7)',
  maxWidth: '52ch',
};

const ctaSolid = {
  appearance: 'none', background: '#00C9B3', color: '#000',
  border: 'none', padding: '18px 38px', borderRadius: 999,
  fontFamily: '"Helvetica Neue", Arial, sans-serif',
  fontSize: '0.82rem', letterSpacing: '0.16em',
  textTransform: 'uppercase', fontWeight: 500, cursor: 'pointer',
  transition: 'transform 280ms cubic-bezier(0.22,1,0.36,1), box-shadow 280ms ease',
};
const ghostLink = {
  appearance: 'none', background: 'transparent', border: 'none', padding: 0,
  fontFamily: '"Playfair Display", Georgia, serif',
  fontStyle: 'italic', fontSize: '0.92rem',
  color: 'rgba(0,201,179,0.85)', cursor: 'pointer',
  textDecoration: 'underline', textUnderlineOffset: 4, textDecorationThickness: 1,
  textAlign: 'left',
};

export default MovementIdentity;
