/**
 * PartnerApplicationPage — /partner-application
 * ═══════════════════════════════════════════════
 * Form di candidatura partner per professionisti.
 *
 * 100% CMS-driven: tutte le label, placeholder, messaggi di errore/successo
 * e le opzioni dei select/checkbox provengono dalla sezione `partner_form_labels`
 * nel CMS (cms_sections), governabile dal cliente via Blueprint senza sviluppatore.
 *
 * Supporto multilingua: BCP-47 completo (it-IT, en-US, en-GB, fr-FR, de-DE, es-ES, es-MX)
 * tramite resolveLocaleBag — nessun dict statico, nessun fallback IT/EN.
 *
 * Submit → POST /api/partner/apply
 * Success: feedback inline, nessun redirect.
 */
import React, { useState } from 'react';
import { useSite } from '../../site/SiteContext';
import { useStorefrontContent } from '../../site/useStorefrontContent';
import { resolveLocaleBag } from '../../site/localeResolver';
import { CheckSquare, Square, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import './home-iter150.css';
import './partner-application.css';

const API_BASE    = process.env.REACT_APP_BACKEND_URL;
const TENANT      = 'studio';
const TENANT_SLUG = (() => {
  if (typeof window === 'undefined') return 'studio';
  const host  = window.location.hostname || '';
  const first = (host.split('.')[0] || '').toLowerCase();
  if (host.includes('.preview.emergentagent.com')) return 'studio';
  if (['studio', 'blueprint', 'www', 'localhost'].some(h => first === h || first.startsWith(h))) return 'studio';
  return first || 'studio';
})();

const INITIAL_FORM = {
  first_name: '', last_name: '', company_name: '', email: '', phone: '',
  professional_category: '', company_website: '', instagram: '', linkedin: '',
  city: '', collaboration_intent: '', notes: '',
  interests: [],
};

export default function PartnerApplicationPage() {
  const { locale } = useSite();

  // ── CMS ──────────────────────────────────────────────────────────────────
  const cmsPa = useStorefrontContent(TENANT_SLUG, 'partner-application');
  const sections = cmsPa?.page?.sections || [];

  const heroSec      = sections.find(s => s.section_type === 'hero_editorial')    || null;
  const formLabelSec = sections.find(s => s.section_type === 'partner_form_labels') || null;

  const heroBag = heroSec      ? resolveLocaleBag(heroSec.locale_content      || {}, locale) : {};
  const c       = formLabelSec ? resolveLocaleBag(formLabelSec.locale_content  || {}, locale) : {};

  const heroEyebrow     = heroBag.eyebrow      || '';
  const heroTitle       = heroBag.title         || '';
  const heroSub         = heroBag.sub           || '';
  const heroBgImage     = heroSec?.settings?.bg_image || '';
  const heroSuccessTitle = heroBag.success_title || '';
  const heroSuccessBody  = heroBag.success_body  || '';

  // CMS-driven form options (roles, collab_types, interests)
  const cmsRoles       = Array.isArray(c.roles)        ? c.roles        : [];
  const cmsCollabTypes = Array.isArray(c.collab_types) ? c.collab_types : [];
  const cmsInterests   = Array.isArray(c.interests)    ? c.interests    : [];

  // ── Form state ────────────────────────────────────────────────────────────
  const [form,     setForm]     = useState(INITIAL_FORM);
  const [status,   setStatus]   = useState('idle'); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('');

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const toggleInterest = (id) => {
    setForm(prev => ({
      ...prev,
      interests: prev.interests.includes(id)
        ? prev.interests.filter(i => i !== id)
        : [...prev.interests, id],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.first_name || !form.last_name || !form.company_name || !form.email || !form.professional_category) {
      setErrorMsg(c.error_required || '');
      return;
    }
    setStatus('loading');
    setErrorMsg('');
    try {
      const payload = {
        tenant_slug:           TENANT,
        first_name:            form.first_name,
        last_name:             form.last_name,
        company_name:          form.company_name,
        email:                 form.email,
        phone:                 form.phone          || undefined,
        professional_category: form.professional_category,
        company_website:       form.company_website || undefined,
        territory:             form.city            || undefined,
        collaboration_intent:  form.collaboration_intent || undefined,
        notes:                 form.notes           || undefined,
        instagram_url:         form.instagram        || undefined,
        linkedin_url:          form.linkedin         || undefined,
      };
      const res = await fetch(`${API_BASE}/api/partner/apply`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg(c.error_generic || '');
    }
  };

  // Loading: mostra solo quando il CMS non ha ancora caricato
  if (cmsPa.loading && !formLabelSec) {
    return (
      <div className="mfd-pa-page" data-testid="partner-application-page">
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>
          <span style={{ fontFamily: 'var(--site-serif,"Playfair Display",Georgia,serif)', fontStyle: 'italic' }}>…</span>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="mfd-pa-page" data-testid="partner-application-page">
        <div className="mfd-pa-success" data-testid="partner-application-success">
          <CheckCircle size={48} strokeWidth={1.2} className="mfd-pa-success__icon" />
          <h1 className="mfd-pa-success__title">{heroSuccessTitle}</h1>
          <p className="mfd-pa-success__body">{heroSuccessBody}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mfd-pa-page" data-testid="partner-application-page">
      {/* Hero editoriale — CMS driven */}
      <header className="mfd-pa-hero">
        <div className="mfd-pa-hero__inner">
          {heroEyebrow && <p className="mfd-section-eyebrow mfd-pa-hero__eyebrow" data-testid="pa-hero-eyebrow">{heroEyebrow}</p>}
          {heroTitle && (
            <h1 className="mfd-pa-hero__title" data-testid="pa-hero-title">
              {heroTitle.split('\n').map((line, i, arr) => (
                <React.Fragment key={i}>
                  {line}
                  {i < arr.length - 1 && <br />}
                </React.Fragment>
              ))}
            </h1>
          )}
          {heroSub && <p className="mfd-pa-hero__sub" data-testid="pa-hero-sub">{heroSub}</p>}
        </div>
        <div className="mfd-pa-hero__image-col">
          {heroBgImage && <img src={heroBgImage} alt="" loading="eager" />}
        </div>
      </header>

      {/* Form */}
      <section className="mfd-pa-form-wrap">
        <div className="mfd-pa-form-inner">
          <form className="mfd-pa-form" onSubmit={handleSubmit} noValidate data-testid="partner-application-form">

            {/* S1 — Identità */}
            <div className="mfd-pa-form__section" data-testid="pa-section-identity">
              <h2 className="mfd-pa-form__section-title">{c.s1_title}</h2>
              <div className="mfd-pa-form__row mfd-pa-form__row--2col">
                <div className="mfd-pa-form__field">
                  <label>{c.field_nome}</label>
                  <input type="text" value={form.first_name} onChange={e => set('first_name', e.target.value)} data-testid="pa-input-nome" required />
                </div>
                <div className="mfd-pa-form__field">
                  <label>{c.field_cognome}</label>
                  <input type="text" value={form.last_name} onChange={e => set('last_name', e.target.value)} data-testid="pa-input-cognome" required />
                </div>
              </div>
              <div className="mfd-pa-form__field">
                <label>{c.field_studio}</label>
                <input type="text" value={form.company_name} onChange={e => set('company_name', e.target.value)} data-testid="pa-input-studio" required />
              </div>
              <div className="mfd-pa-form__row mfd-pa-form__row--2col">
                <div className="mfd-pa-form__field">
                  <label>{c.field_email}</label>
                  <input type="email" value={form.email} onChange={e => set('email', e.target.value)} data-testid="pa-input-email" required />
                </div>
                <div className="mfd-pa-form__field">
                  <label>{c.field_telefono}</label>
                  <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} data-testid="pa-input-telefono" />
                </div>
              </div>
            </div>

            {/* S2 — Profilo online */}
            <div className="mfd-pa-form__section" data-testid="pa-section-profile">
              <h2 className="mfd-pa-form__section-title">{c.s2_title}</h2>
              <div className="mfd-pa-form__field">
                <label>{c.field_ruolo}</label>
                <select value={form.professional_category} onChange={e => set('professional_category', e.target.value)} data-testid="pa-select-ruolo" required>
                  <option value="">{c.ph_ruolo}</option>
                  {cmsRoles.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className="mfd-pa-form__field">
                <label>{c.field_sito}</label>
                <input type="url" value={form.company_website} onChange={e => set('company_website', e.target.value)} placeholder="https://" data-testid="pa-input-sito" />
              </div>
              <div className="mfd-pa-form__row mfd-pa-form__row--2col">
                <div className="mfd-pa-form__field">
                  <label>{c.field_instagram}</label>
                  <input type="text" value={form.instagram} onChange={e => set('instagram', e.target.value)} placeholder="@studio" data-testid="pa-input-instagram" />
                </div>
                <div className="mfd-pa-form__field">
                  <label>{c.field_linkedin}</label>
                  <input type="url" value={form.linkedin} onChange={e => set('linkedin', e.target.value)} placeholder="https://linkedin.com/in/..." data-testid="pa-input-linkedin" />
                </div>
              </div>
            </div>

            {/* S3 — Area geografica */}
            <div className="mfd-pa-form__section" data-testid="pa-section-geo">
              <h2 className="mfd-pa-form__section-title">{c.s3_title}</h2>
              <div className="mfd-pa-form__field">
                <label>{c.field_area}</label>
                <input type="text" value={form.city} onChange={e => set('city', e.target.value)} data-testid="pa-input-area" />
              </div>
            </div>

            {/* S4 — Intenti di collaborazione */}
            <div className="mfd-pa-form__section" data-testid="pa-section-intent">
              <h2 className="mfd-pa-form__section-title">{c.s4_title}</h2>
              <div className="mfd-pa-form__field">
                <label>{c.field_tipo_collab}</label>
                <select value={form.collaboration_intent} onChange={e => set('collaboration_intent', e.target.value)} data-testid="pa-select-collab">
                  <option value="">{c.ph_collab}</option>
                  {cmsCollabTypes.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="mfd-pa-form__field">
                <label>{c.field_interessi}</label>
                <div className="mfd-pa-checkboxes" data-testid="pa-interests">
                  {cmsInterests.map(int => {
                    const checked = form.interests.includes(int.id);
                    return (
                      <button
                        key={int.id}
                        type="button"
                        className={`mfd-pa-checkbox${checked ? ' mfd-pa-checkbox--checked' : ''}`}
                        onClick={() => toggleInterest(int.id)}
                        data-testid={`pa-interest-${int.id}`}
                        aria-pressed={checked}
                      >
                        {checked ? <CheckSquare size={16} strokeWidth={1.8} /> : <Square size={16} strokeWidth={1.8} />}
                        <span>{int.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mfd-pa-form__field">
                <label>{c.field_racconto}</label>
                <textarea
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  placeholder={c.ph_racconto}
                  rows={5}
                  data-testid="pa-textarea-notes"
                />
              </div>
            </div>

            {/* Error message */}
            {errorMsg && (
              <div className="mfd-pa-form__error" data-testid="pa-form-error" role="alert">
                <AlertCircle size={15} strokeWidth={1.8} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Submit */}
            <div className="mfd-pa-form__footer">
              <button
                type="submit"
                disabled={status === 'loading'}
                className="mfd-pa-form__submit"
                data-testid="pa-submit-button"
              >
                {status === 'loading'
                  ? <span className="mfd-pa-form__submit-loading" />
                  : <>{c.cta_submit} <ArrowRight size={14} strokeWidth={1.8} /></>
                }
              </button>
              <p className="mfd-pa-form__privacy">{c.privacy_text}</p>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
