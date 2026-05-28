import React, { useState } from 'react';
import { useCorporatePage } from '../hooks/useCorporatePage';
import SectionRenderer from '../sections/SectionRenderer';
import { Check } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const STUDIO_FEATURES = [
  'Blueprint visual editor',
  'Unlimited projects & moodboards',
  'Custom subdomain',
  'Product & material library',
  'Client collaboration portal',
  '14-day free trial — no card required',
];

/**
 * StartStudioPage — Tenant onboarding + studio registration.
 * Future: auto-provision tenant.blueprint.moodfordesign.com
 */
const StartStudioPage = () => {
  const { sections } = useCorporatePage('start-studio');
  const [form, setForm] = useState({
    studio_name: '', first_name: '', last_name: '', email: '',
    role: 'studio_owner', plan: 'starter',
  });
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await axios.post(`${BACKEND_URL}/api/corporate/studio/register`, form);
      setResult(res.data);
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  return (
    <main data-testid="page-start-studio">
      {/* Hero section from CMS */}
      {sections.map(s => <SectionRenderer key={s.id} section={s} />)}

      {/* Registration form */}
      <section className="py-24 bg-[#F9F9F8]" data-testid="start-studio-form-section">
        <div className="max-w-5xl mx-auto px-8 md:px-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">

            {/* Left: what you get */}
            <div className="lg:col-span-5">
              <p className="overline-teal mb-6">What's included</p>
              <h2 className="font-serif font-light text-4xl text-[#0A0A0A] tracking-tighter leading-tight mb-8">
                Everything you need to build your studio.
              </h2>
              <ul className="space-y-4">
                {STUDIO_FEATURES.map((f, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check size={15} className="text-[#00C9B3] mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-[#5A5A5A]">{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-12 pt-8 border-t border-[rgba(10,10,10,0.1)]">
                <p className="text-xs text-[#5A5A5A]">
                  Already inside MOOD?{' '}
                  <a href="/accedi" className="text-[#00C9B3] font-semibold hover:underline" data-testid="signin-link">
                    Continue your Journey →
                  </a>
                </p>
              </div>
            </div>

            {/* Right: form */}
            {status === 'success' && result ? (
              <div className="lg:col-span-7 bg-white p-10 border border-[#00C9B3]" data-testid="studio-success">
                <p className="overline-teal mb-4">Studio Created</p>
                <h3 className="font-serif text-3xl text-[#0A0A0A] mb-4">{result.studio?.name}</h3>
                <p className="text-sm text-[#5A5A5A] mb-6">{result.message}</p>
                <div className="bg-[#F9F9F8] px-6 py-4 mb-6">
                  <p className="text-xs text-[#5A5A5A] mb-1">Your Blueprint workspace:</p>
                  <p className="text-sm font-semibold text-[#0A0A0A] font-mono">{result.studio?.subdomain}</p>
                </div>
                <p className="text-sm text-[#00C9B3]">{result.next_step}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="lg:col-span-7 bg-white p-10 space-y-6" data-testid="start-studio-form">
                <p className="overline mb-2">Create your studio</p>
                <h3 className="font-serif font-light text-3xl text-[#0A0A0A] tracking-tight mb-8">Your Blueprint workspace awaits.</h3>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-[#0A0A0A] block mb-2">Studio Name *</label>
                  <input
                    type="text"
                    value={form.studio_name}
                    onChange={e => setForm(f => ({ ...f, studio_name: e.target.value }))}
                    placeholder="Studio Rossi"
                    className="w-full border border-[rgba(10,10,10,0.2)] bg-transparent px-4 py-3 text-sm text-[#0A0A0A] focus:outline-none focus:border-[#00C9B3] transition-colors"
                    data-testid="studio-name-input"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest text-[#0A0A0A] block mb-2">First Name *</label>
                    <input
                      type="text"
                      value={form.first_name}
                      onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                      className="w-full border border-[rgba(10,10,10,0.2)] bg-transparent px-4 py-3 text-sm text-[#0A0A0A] focus:outline-none focus:border-[#00C9B3] transition-colors"
                      data-testid="first-name-input"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest text-[#0A0A0A] block mb-2">Last Name *</label>
                    <input
                      type="text"
                      value={form.last_name}
                      onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                      className="w-full border border-[rgba(10,10,10,0.2)] bg-transparent px-4 py-3 text-sm text-[#0A0A0A] focus:outline-none focus:border-[#00C9B3] transition-colors"
                      data-testid="last-name-input"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-[#0A0A0A] block mb-2">Work Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full border border-[rgba(10,10,10,0.2)] bg-transparent px-4 py-3 text-sm text-[#0A0A0A] focus:outline-none focus:border-[#00C9B3] transition-colors"
                    data-testid="email-input"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-[#0A0A0A] block mb-2">I am a</label>
                  <select
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full border border-[rgba(10,10,10,0.2)] bg-transparent px-4 py-3 text-sm text-[#0A0A0A] focus:outline-none focus:border-[#00C9B3] transition-colors"
                    data-testid="role-select"
                  >
                    <option value="studio_owner">Studio Owner / Founder</option>
                    <option value="designer">Interior Designer / Architect</option>
                    <option value="brand">Brand / Manufacturer</option>
                    <option value="retailer">Retailer / Showroom</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-[#0A0A0A] block mb-3">Plan</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'starter', name: 'Essentials', price: 'Free' },
                      { id: 'professional', name: 'Professional', price: '€79/mo' },
                      { id: 'brand', name: 'Brand', price: '€199/mo' },
                    ].map(plan => (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, plan: plan.id }))}
                        className={`px-3 py-3 border text-xs font-semibold transition-colors ${form.plan === plan.id ? 'border-[#00C9B3] bg-[#00C9B3]/5 text-[#0A0A0A]' : 'border-[rgba(10,10,10,0.2)] text-[#5A5A5A] hover:border-[#0A0A0A]'}`}
                        data-testid={`plan-select-${plan.id}`}
                      >
                        <span className="block uppercase tracking-wide">{plan.name}</span>
                        <span className="block mt-1 font-normal" style={{ color: form.plan === plan.id ? '#00C9B3' : '#5A5A5A' }}>{plan.price}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {status === 'error' && (
                  <div className="bg-red-50 border border-red-200 px-4 py-3" data-testid="studio-error">
                    <p className="text-sm text-red-600">Something went wrong. Please try again.</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="btn-primary w-full justify-center"
                  data-testid="start-studio-submit"
                >
                  {status === 'loading' ? 'Creating your studio...' : 'Create My Studio'} <span>→</span>
                </button>

                <p className="text-xs text-center text-[#5A5A5A]">
                  14-day free trial. No credit card required.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>
    </main>
  );
};

export default StartStudioPage;
