import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { formatError } from '../../lib/api';

const SignupPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', email: '', password: '', company_name: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setError('');
    setLoading(true);
    try {
      await register(form);
      navigate('/dashboard');
    } catch (e) {
      setError(formatError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center px-4 py-12 auth-bg">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-10 justify-center">
          <div className="w-8 h-8 bg-[#D4AF37] rounded-[3px] flex items-center justify-center">
            <span className="text-[#0A0A0B] text-sm font-bold font-body">M</span>
          </div>
          <div>
            <p className="text-[#EFEBE4] text-sm font-semibold font-body tracking-[0.1em] uppercase">Mood for Design</p>
            <p className="text-[#4A4845] text-[10px] font-body tracking-[0.2em] uppercase">Blueprint OS™</p>
          </div>
        </div>

        <div className="bg-[#141416] border border-white/[0.06] rounded-[6px] p-8 animate-fadeIn">
          <div className="mb-7">
            <h1 className="font-heading text-3xl font-light text-[#EFEBE4] mb-1">Crea il tuo workspace</h1>
            <p className="text-[#6B6863] text-sm font-body">Inizia il tuo percorso Blueprint OS™</p>
          </div>

          {error && (
            <div data-testid="signup-error" className="mb-5 px-4 py-3 bg-[#F44336]/10 border border-[#F44336]/20 rounded-[3px]">
              <p className="text-[#F44336] text-sm font-body">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { key: 'full_name', label: 'Full Name', placeholder: 'Marco Rossi', type: 'text', testid: 'signup-name-input' },
              { key: 'company_name', label: 'Studio / Company', placeholder: 'Studio Rossi Interiors', type: 'text', testid: 'signup-company-input' },
              { key: 'email', label: 'Email', placeholder: 'you@studio.com', type: 'email', testid: 'signup-email-input' },
            ].map(({ key, label, placeholder, type, testid }) => (
              <div key={key}>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B6863] font-body mb-2">{label}</label>
                <input data-testid={testid} type={type} required value={form[key]} onChange={set(key)} placeholder={placeholder}
                  className="input-luxury w-full px-4 py-3 text-sm font-body rounded-[3px]" />
              </div>
            ))}

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B6863] font-body mb-2">Password</label>
              <div className="relative">
                <input data-testid="signup-password-input" type={showPw ? 'text' : 'password'} required minLength={8}
                  value={form.password} onChange={set('password')} placeholder="Min. 8 characters"
                  className="input-luxury w-full px-4 py-3 pr-11 text-sm font-body rounded-[3px]" />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A4845] hover:text-[#A19D98] transition-colors">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button data-testid="signup-submit-btn" type="submit" disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 px-6 py-3 bg-[#D4AF37] hover:bg-[#E2C365] text-[#0A0A0B] font-semibold text-sm font-body rounded-[3px] transition-colors disabled:opacity-50">
              {loading ? <div className="w-4 h-4 border-2 border-[#0A0A0B] border-t-transparent rounded-full animate-spin" /> : <>Crea workspace <ArrowRight size={15} /></>}
            </button>
          </form>

          <p className="mt-6 text-center text-[#4A4845] text-xs font-body">
            Hai già un account?{' '}
            <Link to="/auth/login" className="text-[#D4AF37] hover:text-[#E2C365] transition-colors">Accedi</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
