/**
 * PartnerApplicationPage — /partner-application
 * ═══════════════════════════════════════════════
 * Form di candidatura partner per professionisti.
 * 
 * Design: singola pagina scrollabile, stile editoriale premium.
 * Submit → POST /api/storefront/public/{tenant}/begin con lead_type='partner_application'
 * Success: feedback inline, nessun redirect.
 * 
 * Partner Sprint 2026 — Fase 4
 */
import React, { useState } from 'react';
import { useSite } from '../../site/SiteContext';
import { CheckSquare, Square, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import './home-iter150.css';
import './partner-application.css';

const API_BASE = process.env.REACT_APP_BACKEND_URL;
const TENANT   = 'studio';

const L = (obj, locale) => {
  if (!obj || typeof obj === 'string') return obj || '';
  return obj[locale] || obj['it'] || obj['_default'] || '';
};

const ROLES = [
  { value: 'architect',         it: 'Architetto',         en: 'Architect' },
  { value: 'interior_designer', it: 'Interior Designer',  en: 'Interior Designer' },
  { value: 'contractor',        it: 'General Contractor', en: 'General Contractor' },
  { value: 'showroom',          it: 'Showroom',           en: 'Showroom' },
  { value: 'brand',             it: 'Brand',              en: 'Brand' },
  { value: 'artisan',           it: 'Artigiano',          en: 'Artisan' },
  { value: 'developer',         it: 'Developer',          en: 'Developer' },
];

const COLLAB_TYPES = [
  { value: 'residential',       it: 'Progetti residenziali',      en: 'Residential projects' },
  { value: 'hospitality',       it: 'Progetti hospitality',       en: 'Hospitality projects' },
  { value: 'retail',            it: 'Retail / Showroom',          en: 'Retail / Showroom' },
  { value: 'contract',          it: 'Contract / Developer',       en: 'Contract / Developer' },
];

const INTERESTS = [
  { id: 'collab_residential', it: 'Vorrei collaborare su progetti residenziali',          en: 'I want to collaborate on residential projects' },
  { id: 'collab_hospitality', it: 'Vorrei collaborare su progetti hospitality',           en: 'I want to collaborate on hospitality projects' },
  { id: 'propose_services',   it: 'Vorrei proporre i miei servizi allo studio',           en: 'I want to propose my services to the studio' },
  { id: 'receive_opp',        it: 'Vorrei ricevere opportunità da MOOD for DESIGN',       en: 'I want to receive opportunities from MOOD for DESIGN' },
  { id: 'network',            it: 'Vorrei entrare nella rete professionale',              en: 'I want to join the professional network' },
];

const copy = {
  it: {
    eyebrow:      'CANDIDATURA PARTNER',
    title:        'Proponi una\ncollaborazione.',
    sub:          'Raccontaci il tuo studio e come immagini una collaborazione con noi. Valutiamo ogni profilo con cura entro 5 giorni lavorativi.',
    s1_title:     'Identità professionale',
    nome:         'Nome *',
    cognome:      'Cognome *',
    studio:       'Studio / Azienda *',
    email:        'Email professionale *',
    telefono:     'Telefono',
    s2_title:     'Profilo online',
    ruolo:        'Ruolo professionale *',
    ruolo_ph:     'Seleziona ruolo...',
    sito:         'Sito Web',
    instagram:    'Instagram (handle)',
    linkedin:     'LinkedIn (URL profilo)',
    s3_title:     'Contesto geografico',
    area:         'Area geografica (città, regione o paese)',
    s4_title:     'Intenti di collaborazione',
    tipo_collab:  'Tipologia di collaborazione desiderata',
    tipo_ph:      'Seleziona...',
    interessi:    'Seleziona tutto ciò che ti riguarda:',
    racconto:     'Raccontaci come immagini una collaborazione.',
    racconto_ph:  'Descrivici il tuo approccio al progetto, il tipo di clientela che segui, e come potreste collaborare con il nostro studio...',
    submit:       'Invia candidatura',
    privacy:      'I tuoi dati vengono utilizzati esclusivamente per valutare la collaborazione. Nessun dato viene condiviso con terzi.',
    success_title: 'Candidatura ricevuta.',
    success_body:  'Valuteremo il tuo profilo entro 5 giorni lavorativi e ti contatteremo all\'indirizzo email fornito.',
    error:        'Si è verificato un errore. Riprova o scrivici a info@studio.com.',
    required:     'Compila tutti i campi obbligatori.',
  },
  en: {
    eyebrow:      'PARTNER APPLICATION',
    title:        'Propose a\ncollaboration.',
    sub:          'Tell us about your studio and how you envision a collaboration with us. We evaluate every profile carefully within 5 business days.',
    s1_title:     'Professional identity',
    nome:         'First name *',
    cognome:      'Last name *',
    studio:       'Studio / Company *',
    email:        'Professional email *',
    telefono:     'Phone',
    s2_title:     'Online profile',
    ruolo:        'Professional role *',
    ruolo_ph:     'Select role...',
    sito:         'Website',
    instagram:    'Instagram (handle)',
    linkedin:     'LinkedIn (profile URL)',
    s3_title:     'Geographic context',
    area:         'Geographic area (city, region or country)',
    s4_title:     'Collaboration intent',
    tipo_collab:  'Desired type of collaboration',
    tipo_ph:      'Select...',
    interessi:    'Select all that apply:',
    racconto:     'Tell us how you envision a collaboration.',
    racconto_ph:  'Describe your approach to design, the type of clients you work with, and how you could collaborate with our studio...',
    submit:       'Submit application',
    privacy:      'Your data is used exclusively to evaluate the collaboration. No data is shared with third parties.',
    success_title: 'Application received.',
    success_body:  'We will review your profile within 5 business days and contact you at the email address provided.',
    error:        'An error occurred. Please try again or write to info@studio.com.',
    required:     'Please fill in all required fields.',
  },
};

const INITIAL_FORM = {
  first_name: '', last_name: '', company_name: '', email: '', phone: '',
  professional_category: '', company_website: '', instagram: '', linkedin: '',
  city: '', collaboration_intent: '', notes: '',
  interests: [],
};

export default function PartnerApplicationPage() {
  const { locale } = useSite();
  const c = copy[locale.startsWith('en') ? 'en' : 'it'];
  const en = locale.startsWith('en');

  const [form, setForm]         = useState(INITIAL_FORM);
  const [status, setStatus]     = useState('idle'); // idle | loading | success | error
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
    // Validazione required
    if (!form.first_name || !form.last_name || !form.company_name || !form.email || !form.professional_category) {
      setErrorMsg(c.required);
      return;
    }
    setStatus('loading');
    setErrorMsg('');

    try {
      const payload = {
        lead_type:              'partner_application',
        progression_state:      'partner',
        source:                 'professionals_page',
        first_name:             form.first_name,
        last_name:              form.last_name,
        company_name:           form.company_name,
        email:                  form.email,
        phone:                  form.phone || undefined,
        professional_category:  form.professional_category,
        company_website:        form.company_website || undefined,
        city:                   form.city || undefined,
        collaboration_intent:   form.collaboration_intent || undefined,
        notes:                  form.notes || undefined,
        metadata_json: {
          instagram: form.instagram || undefined,
          linkedin:  form.linkedin  || undefined,
          interests: form.interests.length > 0 ? form.interests : undefined,
        },
      };

      const res = await fetch(`${API_BASE}/api/storefront/public/${TENANT}/begin`, {
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
      console.error('[PartnerApplication] submit error:', err);
      setStatus('error');
      setErrorMsg(c.error);
    }
  };

  if (status === 'success') {
    return (
      <div className="mfd-pa-page" data-testid="partner-application-page">
        <div className="mfd-pa-success" data-testid="partner-application-success">
          <CheckCircle size={48} strokeWidth={1.2} className="mfd-pa-success__icon" />
          <h1 className="mfd-pa-success__title">{c.success_title}</h1>
          <p className="mfd-pa-success__body">{c.success_body}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mfd-pa-page" data-testid="partner-application-page">
      {/* Hero editoriale */}
      <header className="mfd-pa-hero">
        <div className="mfd-pa-hero__inner">
          <p className="mfd-section-eyebrow mfd-pa-hero__eyebrow" data-testid="pa-hero-eyebrow">{c.eyebrow}</p>
          <h1 className="mfd-pa-hero__title" data-testid="pa-hero-title">
            {c.title.split('\n').map((line, i) => <span key={i}>{line}</span>)}
          </h1>
          <p className="mfd-pa-hero__sub" data-testid="pa-hero-sub">{c.sub}</p>
        </div>
        <div className="mfd-pa-hero__image-col">
          <img
            src="https://images.pexels.com/photos/4977353/pexels-photo-4977353.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
            alt=""
            loading="eager"
          />
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
                  <label>{c.nome}</label>
                  <input type="text" value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="Mario" data-testid="pa-input-nome" required />
                </div>
                <div className="mfd-pa-form__field">
                  <label>{c.cognome}</label>
                  <input type="text" value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Rossi" data-testid="pa-input-cognome" required />
                </div>
              </div>
              <div className="mfd-pa-form__field">
                <label>{c.studio}</label>
                <input type="text" value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder={en ? 'Rossi Architecture Studio' : 'Studio Rossi Architetti'} data-testid="pa-input-studio" required />
              </div>
              <div className="mfd-pa-form__row mfd-pa-form__row--2col">
                <div className="mfd-pa-form__field">
                  <label>{c.email}</label>
                  <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="m.rossi@studio.it" data-testid="pa-input-email" required />
                </div>
                <div className="mfd-pa-form__field">
                  <label>{c.telefono}</label>
                  <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+39 02 0000000" data-testid="pa-input-telefono" />
                </div>
              </div>
            </div>

            {/* S2 — Profilo online */}
            <div className="mfd-pa-form__section" data-testid="pa-section-profile">
              <h2 className="mfd-pa-form__section-title">{c.s2_title}</h2>
              <div className="mfd-pa-form__field">
                <label>{c.ruolo}</label>
                <select value={form.professional_category} onChange={e => set('professional_category', e.target.value)} data-testid="pa-select-ruolo" required>
                  <option value="">{c.ruolo_ph}</option>
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>{en ? r.en : r.it}</option>
                  ))}
                </select>
              </div>
              <div className="mfd-pa-form__field">
                <label>{c.sito}</label>
                <input type="url" value={form.company_website} onChange={e => set('company_website', e.target.value)} placeholder="https://studio.it" data-testid="pa-input-sito" />
              </div>
              <div className="mfd-pa-form__row mfd-pa-form__row--2col">
                <div className="mfd-pa-form__field">
                  <label>{c.instagram}</label>
                  <input type="text" value={form.instagram} onChange={e => set('instagram', e.target.value)} placeholder="@studio" data-testid="pa-input-instagram" />
                </div>
                <div className="mfd-pa-form__field">
                  <label>{c.linkedin}</label>
                  <input type="url" value={form.linkedin} onChange={e => set('linkedin', e.target.value)} placeholder="https://linkedin.com/in/..." data-testid="pa-input-linkedin" />
                </div>
              </div>
            </div>

            {/* S3 — Area geografica */}
            <div className="mfd-pa-form__section" data-testid="pa-section-geo">
              <h2 className="mfd-pa-form__section-title">{c.s3_title}</h2>
              <div className="mfd-pa-form__field">
                <label>{c.area}</label>
                <input type="text" value={form.city} onChange={e => set('city', e.target.value)} placeholder={en ? 'Milan, Lombardy, Italy' : 'Milano, Lombardia, Italia'} data-testid="pa-input-area" />
              </div>
            </div>

            {/* S4 — Intenti di collaborazione */}
            <div className="mfd-pa-form__section" data-testid="pa-section-intent">
              <h2 className="mfd-pa-form__section-title">{c.s4_title}</h2>
              <div className="mfd-pa-form__field">
                <label>{c.tipo_collab}</label>
                <select value={form.collaboration_intent} onChange={e => set('collaboration_intent', e.target.value)} data-testid="pa-select-collab">
                  <option value="">{c.tipo_ph}</option>
                  {COLLAB_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{en ? t.en : t.it}</option>
                  ))}
                </select>
              </div>

              <div className="mfd-pa-form__field">
                <label>{c.interessi}</label>
                <div className="mfd-pa-checkboxes" data-testid="pa-interests">
                  {INTERESTS.map(int => {
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
                        {checked
                          ? <CheckSquare size={16} strokeWidth={1.8} />
                          : <Square      size={16} strokeWidth={1.8} />
                        }
                        <span>{en ? int.en : int.it}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mfd-pa-form__field">
                <label>{c.racconto}</label>
                <textarea
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  placeholder={c.racconto_ph}
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
                  : <>{c.submit} <ArrowRight size={14} strokeWidth={1.8} /></>
                }
              </button>
              <p className="mfd-pa-form__privacy">{c.privacy}</p>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
