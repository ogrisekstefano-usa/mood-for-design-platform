/**
 * BeginPartnershipPage · ITER146.A · Pro Pipeline Orchestration™
 *
 * The strategic, collaborative counterpart to /begin-journey.
 * Targets: architects · interior designers · developers · retailers ·
 * fabricators · partner studios · collaborators.
 *
 * Pipeline: lead row (lead_type=professional, onboarding_path=
 * begin_partnership) + ALE-localized partnership_request email + internal
 * notification. NO frontend-only success state — every submit is a real
 * traceable CRM event.
 */
import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, Check, Loader2, Sparkles } from 'lucide-react';
import '../../styles/begin-journey.css';
import { tenantConfig } from '../../site/content/tenant';

const API = process.env.REACT_APP_BACKEND_URL;

const CATEGORIES = [
  { v: 'architect',          l: 'Architetto',           sub: 'Studi e singoli professionisti' },
  { v: 'interior_designer',  l: 'Interior Designer',    sub: 'Composizione di atmosfere' },
  { v: 'developer',          l: 'Developer',            sub: 'Real estate & promozioni' },
  { v: 'retailer',           l: 'Retailer',             sub: 'Boutique, showroom, marketplace' },
  { v: 'fabricator',         l: 'Fabricator',           sub: 'Falegnamerie, atelier, artigiani' },
  { v: 'partner_studio',     l: 'Studio Partner',       sub: 'Collaborazione multi-marca' },
];

const COLLABORATION = [
  { v: 'partnership',        l: 'Partnership editoriale' },
  { v: 'referral',           l: 'Referral network' },
  { v: 'fabrication',        l: 'Fabrication & artigianato' },
  { v: 'distribution',       l: 'Distribuzione prodotti' },
  { v: 'studio_network',     l: 'Network di studi' },
  { v: 'cultural_edition',   l: 'Edizione culturale' },
];

const SECTORS = [
  { v: 'residential',  l: 'Residenziale luxury' },
  { v: 'hospitality',  l: 'Hospitality & boutique hotel' },
  { v: 'retail',       l: 'Retail & flagship' },
  { v: 'office',       l: 'Office & corporate' },
  { v: 'cultural',     l: 'Cultural & istituzionale' },
  { v: 'mixed_use',    l: 'Mixed-use & developer' },
  { v: 'product',      l: 'Product & design industriale' },
];

const BeginPartnershipPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // form state
  const [category, setCategory] = useState(null);
  const [intent, setIntent] = useState(null);
  const [sector, setSector] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  const step0Valid = category && intent && sector;
  const step1Valid = companyName.trim().length >= 2;
  const step2Valid = useMemo(() => (
    firstName.trim() && email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ), [firstName, email]);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const slug = (typeof window !== 'undefined' &&
                    window.location.hostname.split('.')[0]) || 'studio';
      // ITER146.A — preview & known platform hosts default to the
      // Golden Demo Tenant™. True wildcard tenants resolve via the
      // backend TenantResolverMiddleware once DNS is propagated.
      const PLATFORM_HOSTS = ['studio', 'blueprint', 'www',
                              'content-hub-pro-22'];
      const tenantSlug = PLATFORM_HOSTS.some(h => slug.startsWith(h))
        ? 'studio' : slug;
      const urlParams = new URLSearchParams(window.location.search);
      const utmQs = ['utm_source', 'utm_medium', 'utm_campaign',
                     'utm_term', 'utm_content']
        .filter((k) => urlParams.get(k))
        .map((k) => `${k}=${encodeURIComponent(urlParams.get(k))}`)
        .join('&');

      const payload = {
        email, first_name: firstName, last_name: lastName, phone,
        lead_type: 'professional',
        onboarding_path: 'begin_partnership',
        professional_category: category,
        collaboration_intent: intent,
        market_sector: sector,
        company_name: companyName,
        company_website: companyWebsite || undefined,
        portfolio_url: portfolioUrl || undefined,
        notes: notes || undefined,
        locale_code: 'it-IT',
        source: 'begin_partnership_form',
      };
      const url = `${API}/api/leads/public?tenant_slug=${tenantSlug}${utmQs ? '&' + utmQs : ''}`;
      const r = await axios.post(url, payload);
      if (r.status === 201) {
        toast.success('Richiesta inviata.');
        setDone(true);
      }
    } catch (e) {
      const msg = e?.response?.data?.detail || 'Errore durante l\'invio';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div data-testid="begin-partnership-success"
           style={{
             minHeight: '70vh', display: 'flex', alignItems: 'center',
             justifyContent: 'center', padding: 40,
             background: 'radial-gradient(ellipse at top left, rgba(124,228,245,0.05), transparent 50%), #050608',
           }}>
        <div style={{
          maxWidth: 540, textAlign: 'center',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 20, padding: '56px 48px',
        }}>
          <div style={{
            width: 56, height: 56, margin: '0 auto 28px',
            borderRadius: 14, background: 'rgba(124,228,245,0.06)',
            border: '1px solid rgba(124,228,245,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={22} strokeWidth={1.5} color="#7ce4f5" />
          </div>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
            letterSpacing: '0.32em', textTransform: 'uppercase',
            color: '#7ce4f5', marginBottom: 14,
          }}>
            Conversazione avviata
          </div>
          <h1 style={{
            fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic',
            fontSize: 32, fontWeight: 400, color: '#f5f7fa',
            margin: 0, lineHeight: 1.2,
          }}>
            Grazie. La tua proposta di partnership è in mano nostra.
          </h1>
          <p style={{ color: 'rgba(232,235,240,0.65)', fontSize: 14,
                       lineHeight: 1.65, marginTop: 18, marginBottom: 32 }}>
            Ti scriveremo a breve per costruire insieme i prossimi passi.
            Una conversazione di partnership inizia con attenzione.
          </p>
          <button onClick={() => navigate('/')}
                  data-testid="begin-partnership-back-home"
                  style={{
                    padding: '11px 24px', border: '1px solid #7ce4f5',
                    borderRadius: 999, color: '#7ce4f5', background: 'transparent',
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5,
                    letterSpacing: '0.26em', textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}>
            Torna al sito
          </button>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="begin-partnership-page"
         className="begin-journey-root">
      <div className="begin-journey-shell">
        <div className="bj-eyebrow" data-testid="bp-eyebrow">
          {tenantConfig.brand.name}{tenantConfig.brand.suffix} · Partnership
        </div>
        <h1 className="bj-title" data-testid="bp-title"
            style={{ fontFamily: 'Cormorant Garamond, serif',
                      fontStyle: 'italic' }}>
          Esplora una collaborazione con lo studio.
        </h1>
        <p className="bj-lede" data-testid="bp-lede">
          Architetti, designer, developer, fabricator, retailer.
          Una conversazione strategica per costruire insieme.
        </p>

        {/* Step indicator */}
        <div className="bj-steps" data-testid="bp-steps">
          {[0, 1, 2].map((i) => (
            <span key={i}
                  className={`bj-step ${i === step ? 'bj-step--active' : ''} ${i < step ? 'bj-step--done' : ''}`}
                  data-testid={`bp-step-${i}`}>
              {i + 1}
            </span>
          ))}
        </div>

        {/* STEP 0 — qualification */}
        {step === 0 && (
          <div data-testid="bp-step-content-0" className="bj-step-block">
            <h2 className="bj-h2">Chi siete e cosa cercate.</h2>

            <label className="bj-field-label">Categoria professionale</label>
            <div className="bj-chips" data-testid="bp-category-chips">
              {CATEGORIES.map((c) => (
                <button key={c.v} type="button"
                        data-testid={`bp-category-${c.v}`}
                        className={`bj-chip ${category === c.v ? 'bj-chip--active' : ''}`}
                        onClick={() => setCategory(c.v)}>
                  <span className="bj-chip__label">{c.l}</span>
                  <span className="bj-chip__sub">{c.sub}</span>
                </button>
              ))}
            </div>

            <label className="bj-field-label">Intento di collaborazione</label>
            <div className="bj-chips" data-testid="bp-intent-chips">
              {COLLABORATION.map((c) => (
                <button key={c.v} type="button"
                        data-testid={`bp-intent-${c.v}`}
                        className={`bj-chip bj-chip--single ${intent === c.v ? 'bj-chip--active' : ''}`}
                        onClick={() => setIntent(c.v)}>
                  {c.l}
                </button>
              ))}
            </div>

            <label className="bj-field-label">Settore di mercato</label>
            <div className="bj-chips" data-testid="bp-sector-chips">
              {SECTORS.map((s) => (
                <button key={s.v} type="button"
                        data-testid={`bp-sector-${s.v}`}
                        className={`bj-chip bj-chip--single ${sector === s.v ? 'bj-chip--active' : ''}`}
                        onClick={() => setSector(s.v)}>
                  {s.l}
                </button>
              ))}
            </div>

            <div className="bj-actions">
              <button data-testid="bp-step-0-next"
                      disabled={!step0Valid}
                      onClick={() => setStep(1)}
                      className="bj-btn bj-btn--primary">
                Continua <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 1 — company */}
        {step === 1 && (
          <div data-testid="bp-step-content-1" className="bj-step-block">
            <h2 className="bj-h2">Raccontaci dello studio.</h2>

            <label className="bj-field-label">Nome dello studio o azienda *</label>
            <input data-testid="bp-company-name" type="text"
                   value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                   className="bj-input" placeholder="es. Studio Architettura" />

            <label className="bj-field-label">Sito web</label>
            <input data-testid="bp-company-website" type="url"
                   value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)}
                   className="bj-input" placeholder="https://…" />

            <label className="bj-field-label">Portfolio / referenze</label>
            <input data-testid="bp-portfolio-url" type="url"
                   value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)}
                   className="bj-input" placeholder="https://…/projects" />

            <div className="bj-actions">
              <button data-testid="bp-step-1-back"
                      onClick={() => setStep(0)}
                      className="bj-btn bj-btn--ghost">Indietro</button>
              <button data-testid="bp-step-1-next"
                      disabled={!step1Valid}
                      onClick={() => setStep(2)}
                      className="bj-btn bj-btn--primary">
                Continua <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 — contact */}
        {step === 2 && (
          <div data-testid="bp-step-content-2" className="bj-step-block">
            <h2 className="bj-h2">Apriamo la conversazione.</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="bj-field-label">Nome *</label>
                <input data-testid="bp-first-name" type="text"
                       value={firstName} onChange={(e) => setFirstName(e.target.value)}
                       className="bj-input" />
              </div>
              <div>
                <label className="bj-field-label">Cognome</label>
                <input data-testid="bp-last-name" type="text"
                       value={lastName} onChange={(e) => setLastName(e.target.value)}
                       className="bj-input" />
              </div>
            </div>

            <label className="bj-field-label">Email *</label>
            <input data-testid="bp-email" type="email"
                   value={email} onChange={(e) => setEmail(e.target.value)}
                   className="bj-input" placeholder="tu@studio.com" />

            <label className="bj-field-label">Telefono</label>
            <input data-testid="bp-phone" type="tel"
                   value={phone} onChange={(e) => setPhone(e.target.value)}
                   className="bj-input" />

            <label className="bj-field-label">Una nota di contesto</label>
            <textarea data-testid="bp-notes" rows={4}
                      value={notes} onChange={(e) => setNotes(e.target.value)}
                      className="bj-textarea"
                      placeholder="Racconta brevemente lo studio e il tipo di progetti su cui collaborereste con noi." />

            <div className="bj-actions">
              <button data-testid="bp-step-2-back"
                      onClick={() => setStep(1)}
                      className="bj-btn bj-btn--ghost">Indietro</button>
              <button data-testid="bp-submit"
                      disabled={!step2Valid || submitting}
                      onClick={submit}
                      className="bj-btn bj-btn--primary">
                {submitting ? <><Loader2 size={14} className="bj-spin" /> Invio…</>
                            : <>Avvia la conversazione <Check size={14} /></>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BeginPartnershipPage;
