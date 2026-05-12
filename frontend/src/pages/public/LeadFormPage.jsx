import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import api, { formatError } from '../../lib/api';
import { ArrowRight, CheckCircle, Upload } from 'lucide-react';

const BG = 'https://images.unsplash.com/photo-1700822715338-3ed8b72fdb5a?w=1400&q=80';
const DEMO_SLUG = 'blueprint-demo';

const STEPS = [
  { id: 1, label: 'Dati personali' },
  { id: 2, label: 'Dettagli progetto' },
  { id: 3, label: 'Messaggio' },
];

const LeadFormPage = () => {
  const { slug } = useParams();
  const tenantSlug = slug || DEMO_SLUG;

  const [step, setStep] = useState(1);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', company: '',
    project_type: '', budget_range: '', location: '',
    message: '', type: 'client',
  });

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      await api.post(`/api/leads/public?tenant_slug=${tenantSlug}`, form);
      setSent(true);
    } catch (e) {
      setError(formatError(e));
    } finally {
      setLoading(false);
    }
  };

  if (sent) return (
    <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center px-4 auth-bg">
      <div className="text-center animate-fadeIn">
        <div className="w-16 h-16 bg-[#D4AF37]/15 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={32} className="text-[#D4AF37]" strokeWidth={1.5} />
        </div>
        <h2 className="font-heading text-4xl font-light text-[#EFEBE4] mb-3">Richiesta inviata</h2>
        <p className="text-[#A19D98] text-sm font-body max-w-sm mx-auto leading-relaxed">
          Grazie per la tua richiesta. Ti contatteremo entro 24 ore per discutere il tuo progetto.
        </p>
        <p className="text-[#D4AF37] text-sm font-body mt-4">MOOD for DESIGN™</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex">
      {/* Left — Form */}
      <div className="w-full lg:w-[520px] flex flex-col px-10 py-12 bg-[#0A0A0B] overflow-y-auto">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-10">
          <div className="w-8 h-8 bg-[#D4AF37] rounded-[3px] flex items-center justify-center">
            <span className="text-[#0A0A0B] text-sm font-bold font-body">M</span>
          </div>
          <div>
            <p className="text-[#EFEBE4] text-sm font-semibold font-body tracking-[0.1em] uppercase">Mood for Design</p>
            <p className="text-[#4A4845] text-[10px] font-body tracking-[0.2em] uppercase">Richiesta Progetto</p>
          </div>
        </div>

        <h1 className="font-heading text-4xl font-light text-[#EFEBE4] mb-2 leading-tight">
          Raccontaci il<br />tuo progetto
        </h1>
        <p className="text-[#6B6863] text-sm font-body mb-8 leading-relaxed">
          Compila il modulo per ricevere una consulenza personalizzata dal nostro team di designer.
        </p>

        {/* Steps */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold font-body transition-all ${
                  step >= s.id ? 'bg-[#D4AF37] text-[#0A0A0B]' : 'bg-white/[0.05] text-[#4A4845]'
                }`}>{s.id}</div>
                <span className={`text-[11px] font-body transition-colors ${step >= s.id ? 'text-[#A19D98]' : 'text-[#3A3835]'}`}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-px ${step > s.id ? 'bg-[#D4AF37]/30' : 'bg-white/[0.05]'}`} />}
            </React.Fragment>
          ))}
        </div>

        {error && (
          <div className="mb-5 px-4 py-3 bg-[#F44336]/10 border border-[#F44336]/20 rounded-[3px]">
            <p className="text-[#F44336] text-sm font-body">{error}</p>
          </div>
        )}

        {/* Step 1 */}
        {step === 1 && (
          <div className="space-y-4 animate-fadeIn">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B6863] font-body mb-1.5">Tipo richiesta</label>
              <div className="grid grid-cols-2 gap-3">
                {[['client', 'Cliente Privato'], ['partner', 'Studio A&D']].map(([val, lbl]) => (
                  <button key={val} type="button" onClick={() => setForm(p => ({ ...p, type: val }))}
                    className={`px-4 py-3 border rounded-[4px] text-sm font-body font-medium transition-all ${
                      form.type === val ? 'border-[#D4AF37] bg-[#D4AF37]/8 text-[#D4AF37]' : 'border-white/[0.1] text-[#6B6863] hover:border-white/[0.2] hover:text-[#A19D98]'
                    }`}>{lbl}</button>
                ))}
              </div>
            </div>
            {[['full_name', 'Nome Completo *', 'text'], ['email', 'Email *', 'email'], ['phone', 'Telefono', 'tel'], ['company', 'Azienda / Studio', 'text']].map(([k, l, t]) => (
              <div key={k}>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B6863] font-body mb-1.5">{l}</label>
                <input type={t} value={form[k]} onChange={set(k)} required={l.includes('*')}
                  className="input-luxury w-full px-4 py-3 text-sm font-body rounded-[3px]" />
              </div>
            ))}
            <button data-testid="step1-next" type="button" onClick={() => setStep(2)}
              disabled={!form.full_name || !form.email}
              className="w-full mt-2 flex items-center justify-center gap-2 px-6 py-3 bg-[#D4AF37] hover:bg-[#E2C365] text-[#0A0A0B] font-semibold text-sm font-body rounded-[3px] transition-colors disabled:opacity-40">
              Continua <ArrowRight size={15} />
            </button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-4 animate-fadeIn">
            {[['project_type', 'Tipo di progetto', ['Residenziale', 'Commerciale', 'Hospitality', 'Ufficio', 'Retail']], ['budget_range', 'Budget indicativo', ['< €30.000', '€30.000 – €80.000', '€80.000 – €200.000', '€200.000 – €500.000', '> €500.000']]].map(([k, l, opts]) => (
              <div key={k}>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B6863] font-body mb-1.5">{l}</label>
                <select value={form[k]} onChange={set(k)} className="input-luxury w-full px-4 py-3 text-sm font-body rounded-[3px]">
                  <option value="">Seleziona...</option>
                  {opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B6863] font-body mb-1.5">Città / Luogo</label>
              <input value={form.location} onChange={set('location')} placeholder="es. Milano, Roma..." className="input-luxury w-full px-4 py-3 text-sm font-body rounded-[3px]" />
            </div>
            <div className="flex gap-3 mt-2">
              <button type="button" onClick={() => setStep(1)} className="flex-1 px-4 py-3 border border-white/[0.1] text-[#A19D98] text-sm font-body rounded-[3px] hover:bg-white/[0.03] transition-colors">Indietro</button>
              <button data-testid="step2-next" type="button" onClick={() => setStep(3)} className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[#D4AF37] hover:bg-[#E2C365] text-[#0A0A0B] font-semibold text-sm font-body rounded-[3px] transition-colors">
                Continua <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="space-y-4 animate-fadeIn">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B6863] font-body mb-1.5">Messaggio</label>
              <textarea rows={5} value={form.message} onChange={set('message')} placeholder="Descrivi il tuo progetto, le tue aspettative e qualsiasi dettaglio utile..."
                className="input-luxury w-full px-4 py-3 text-sm font-body rounded-[3px] resize-none" />
            </div>
            <div className="flex gap-3 mt-2">
              <button type="button" onClick={() => setStep(2)} className="flex-1 px-4 py-3 border border-white/[0.1] text-[#A19D98] text-sm font-body rounded-[3px] hover:bg-white/[0.03] transition-colors">Indietro</button>
              <button data-testid="form-submit-btn" type="button" onClick={handleSubmit} disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[#D4AF37] hover:bg-[#E2C365] text-[#0A0A0B] font-semibold text-sm font-body rounded-[3px] transition-colors disabled:opacity-50">
                {loading ? <div className="w-4 h-4 border-2 border-[#0A0A0B] border-t-transparent rounded-full animate-spin" /> : <>Invia richiesta <ArrowRight size={15} /></>}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right — Image */}
      <div className="hidden lg:block flex-1 relative overflow-hidden">
        <img src={BG} alt="Luxury Material" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0B] via-[#0A0A0B]/20 to-transparent" />
        <div className="absolute bottom-12 right-12 text-right">
          <p className="font-heading text-4xl font-light text-white/70 leading-tight">
            Il tuo progetto,<br /><em>la nostra visione.</em>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LeadFormPage;
