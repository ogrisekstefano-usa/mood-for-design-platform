import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useReveal } from '../hooks/useReveal';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

/**
 * LoginHero — panoramic hero with overlaid login form.
 *
 * Layout: full-width photo background + left-to-right black veil +
 * top-left editorial text block + email/password form + teal CTA +
 * registration link. Matches the mockup "Benvenuto su MOOD".
 *
 * content: { eyebrow, title, body,
 *            email_label, password_label,
 *            cta_label, register_prompt, register_link_label }
 * media:   { background: { url, alt } }
 * links:   { register_href, forgot_href }
 */
const LoginHero = ({ content = {}, media = {}, links = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.1 });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [tenantOptions, setTenantOptions] = useState(null); // [{slug, name}] when multi-tenant
  const [chosenTenant, setChosenTenant] = useState(null);
  const bg = media.background;

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const { data } = await axios.post(
        `${BACKEND}/api/auth/login`,
        {
          email: email.trim().toLowerCase(),
          password,
          tenant_slug: chosenTenant || null,
        },
      );
      if (data.requires_tenant_selection) {
        setTenantOptions(data.tenants || []);
        setSubmitting(false);
        return;
      }
      // Successful login
      if (data.token) {
        localStorage.setItem('mood_auth_token', data.token);
        localStorage.setItem('mood_auth_user', JSON.stringify(data.user));
        localStorage.setItem('mood_auth_tenant', JSON.stringify(data.tenant));
      }
      setMessage(`Benvenuto ${data.user?.full_name || data.user?.email}.`);
      setTimeout(() => {
        window.location.href = data.redirect_url || '/admin';
      }, 600);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => d?.msg || JSON.stringify(d)).join(' · ')
          : err?.message || 'Errore imprevisto.';
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <section
      ref={ref}
      className={`relative overflow-hidden reveal ${visible ? 'visible' : ''}`}
      style={{ background: '#000000', minHeight: 'clamp(680px, 88vh, 940px)' }}
      data-testid="login-hero"
    >
      {bg && bg.url && (
        <img
          src={bg.url} alt={bg.alt || ''}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%', objectFit: 'cover',
            objectPosition: 'center 42%',
          }}
          loading="eager"
        />
      )}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0,
          background:
            'linear-gradient(to right, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.94) 22%, rgba(0,0,0,0.78) 42%, rgba(0,0,0,0.5) 62%, rgba(0,0,0,0.18) 78%, rgba(0,0,0,0) 92%)',
        }}
      />

      <div className="relative z-10 max-w-screen-2xl mx-auto px-6 md:px-12 lg:px-20 py-20 lg:py-28 flex items-center" style={{ minHeight: 'clamp(680px, 88vh, 940px)' }}>
        <div className="w-full max-w-[520px]">
          {content.eyebrow && (
            <p
              style={{
                fontFamily: 'Inter, sans-serif', fontSize: '0.74rem', fontWeight: 500,
                letterSpacing: '0.24em', textTransform: 'uppercase',
                color: 'var(--mood-teal, #00C9B3)', marginBottom: '2rem',
              }}
              data-testid="login-hero-eyebrow"
            >
              {content.eyebrow}
            </p>
          )}
          {content.title && (
            <h1
              style={{
                fontFamily: 'Playfair Display, serif', fontWeight: 400,
                fontSize: 'clamp(2.4rem, 4.4vw, 4rem)', lineHeight: 1.06,
                letterSpacing: '-0.02em', color: '#FFFFFF',
              }}
              data-testid="login-hero-title"
            >
              {content.title}
            </h1>
          )}
          {content.body && (
            <p
              className="mt-7 lg:mt-9"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 'clamp(0.98rem, 1.08vw, 1.04rem)',
                lineHeight: 1.7, color: 'rgba(255,255,255,0.74)', fontWeight: 300,
                maxWidth: '42ch',
              }}
              data-testid="login-hero-body"
            >
              {content.body}
            </p>
          )}

          <form onSubmit={onSubmit} className="mt-10" data-testid="login-form">
            <FormInput
              label={content.email_label || 'Email'}
              type="email"
              value={email}
              onChange={setEmail}
              testid="login-email"
              required
            />
            <FormInput
              label={content.password_label || 'Password'}
              type="password"
              value={password}
              onChange={setPassword}
              testid="login-password"
              required
            />

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%', marginTop: '1.4rem',
                fontFamily: 'Inter, sans-serif', fontSize: '0.86rem',
                fontWeight: 500, letterSpacing: '0.04em',
                color: '#000', background: 'var(--mood-teal, #00C9B3)',
                border: 'none', padding: '1.1rem 1.4rem',
                cursor: submitting ? 'wait' : 'pointer',
                opacity: submitting ? 0.7 : 1,
                transition: 'all 0.25s ease',
              }}
              onMouseEnter={(e) => { if (!submitting) e.currentTarget.style.background = 'rgba(0,201,179,0.85)'; }}
              onMouseLeave={(e) => { if (!submitting) e.currentTarget.style.background = 'var(--mood-teal, #00C9B3)'; }}
              data-testid="login-submit"
            >
              {submitting ? '…' : (chosenTenant ? `Accedi come ${chosenTenant}` : (content.cta_label || 'Accedi'))}
            </button>

            {tenantOptions && tenantOptions.length > 1 && (
              <div style={{ marginTop: '1.2rem' }} data-testid="login-tenant-picker">
                <p style={{
                  fontFamily: 'Inter, sans-serif', fontSize: '0.78rem',
                  color: 'rgba(255,255,255,0.7)', marginBottom: '0.7rem',
                }}>
                  Più studi corrispondono a queste credenziali. Scegli dove accedere:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {tenantOptions.map((t) => (
                    <button
                      type="button"
                      key={t.slug}
                      onClick={() => setChosenTenant(t.slug)}
                      style={{
                        textAlign: 'left',
                        padding: '0.8rem 1rem',
                        background: chosenTenant === t.slug ? 'rgba(0,201,179,0.12)' : 'rgba(255,255,255,0.04)',
                        border: chosenTenant === t.slug
                          ? '1px solid var(--mood-teal, #00C9B3)'
                          : '1px solid rgba(255,255,255,0.1)',
                        color: '#FFF', fontFamily: 'Inter, sans-serif',
                        fontSize: '0.88rem', cursor: 'pointer',
                      }}
                      data-testid={`login-tenant-${t.slug}`}
                    >
                      {t.name} <span style={{ color: 'rgba(255,255,255,0.4)' }}>· {t.slug}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <p
                style={{
                  marginTop: '1rem', fontFamily: 'Inter, sans-serif',
                  fontSize: '0.85rem', color: '#F88', fontWeight: 300,
                }}
                data-testid="login-error"
              >
                {error}
              </p>
            )}
            {message && (
              <p
                style={{
                  marginTop: '1rem', fontFamily: 'Inter, sans-serif',
                  fontSize: '0.85rem', color: 'rgba(0,201,179,0.95)', fontWeight: 300,
                }}
                data-testid="login-message"
              >
                {message}
              </p>
            )}
          </form>

          {(content.register_prompt || content.register_link_label) && (
            <div
              className="mt-8"
              style={{
                fontFamily: 'Inter, sans-serif', fontSize: '0.88rem',
                color: 'rgba(255,255,255,0.6)', fontWeight: 300,
              }}
              data-testid="login-register-row"
            >
              {content.register_prompt && <span>{content.register_prompt} </span>}
              {content.register_link_label && (
                <Link
                  to={links.register_href || '/dedicato-a'}
                  style={{ color: 'var(--mood-teal, #00C9B3)', textDecoration: 'none', fontWeight: 500 }}
                  onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                  data-testid="login-register-link"
                >
                  {content.register_link_label}
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

const FormInput = ({ label, type, value, onChange, testid, required }) => (
  <div style={{ marginBottom: '1.1rem' }}>
    <label
      style={{
        display: 'block', fontFamily: 'Inter, sans-serif', fontSize: '0.72rem',
        letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 500,
        color: 'rgba(255,255,255,0.55)', marginBottom: '0.5rem',
      }}
    >
      {label}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      style={{
        width: '100%',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.12)',
        color: '#FFFFFF',
        fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', fontWeight: 300,
        padding: '0.95rem 1.1rem',
        outline: 'none',
        transition: 'all 0.2s ease',
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--mood-teal, #00C9B3)'; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
      data-testid={testid}
    />
  </div>
);

export default LoginHero;
