import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { ArrowRight } from 'lucide-react';
import { formatError } from '../../lib/api';
import Brand from '../../components/common/Brand';
import LocaleSwitcher from '../../components/common/LocaleSwitcher';

const SignupPage = () => {
  const { signUp } = useAuth();
  const { t, locale } = useBlueprint();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', password: '', company_name: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signUp({ ...form, locale });
      navigate('/dashboard');
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex auth-bg" data-testid="signup-page">
      <div className="w-full lg:w-[480px] flex flex-col justify-center px-10 py-12 bg-[#0A0A0B]">
        <div className="flex items-center justify-between mb-12">
          <Brand />
          <LocaleSwitcher />
        </div>

        <div className="mb-8">
          <h1 className="font-heading text-4xl font-light text-[#EFEBE4] mb-2 leading-tight">
            {t('auth.signup.title')}
          </h1>
          <p className="text-[#6B6863] text-sm font-body">{t('auth.signup.subtitle')}</p>
        </div>

        {error && (
          <div data-testid="signup-error" className="mb-6 px-4 py-3 bg-[#F44336]/10 border border-[#F44336]/20 rounded-[3px]">
            <p className="text-[#F44336] text-sm font-body">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[['first_name', 'auth.signup.firstName'], ['last_name', 'auth.signup.lastName']].map(([k, lk]) => (
              <div key={k}>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B6863] font-body mb-2">{t(lk)}</label>
                <input data-testid={`signup-${k}`} required value={form[k]} onChange={set(k)} className="input-luxury w-full px-4 py-3 text-sm font-body rounded-[3px]" />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B6863] font-body mb-2">{t('auth.signup.company')}</label>
            <input data-testid="signup-company" required value={form.company_name} onChange={set('company_name')} className="input-luxury w-full px-4 py-3 text-sm font-body rounded-[3px]" />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B6863] font-body mb-2">{t('auth.login.email')}</label>
            <input data-testid="signup-email" required type="email" value={form.email} onChange={set('email')} className="input-luxury w-full px-4 py-3 text-sm font-body rounded-[3px]" />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B6863] font-body mb-2">{t('auth.login.password')}</label>
            <input data-testid="signup-password" required type="password" minLength={8} value={form.password} onChange={set('password')} className="input-luxury w-full px-4 py-3 text-sm font-body rounded-[3px]" />
            <p className="text-[10px] text-[#4A4845] mt-1 font-body">{t('form.password_min')}</p>
          </div>

          <button data-testid="signup-submit-btn" type="submit" disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 px-6 py-3 bg-[var(--bp-primary,#D4AF37)] hover:opacity-90 text-[#0A0A0B] font-semibold text-sm font-body rounded-[3px] disabled:opacity-50">
            {loading ? <div className="w-4 h-4 border-2 border-[#0A0A0B] border-t-transparent rounded-full animate-spin" /> : <>{t('auth.signup.submit')} <ArrowRight size={15} /></>}
          </button>
        </form>

        <p className="mt-8 text-center text-[#4A4845] text-xs font-body">
          {t('auth.signup.hasAccount')}{' '}
          <Link data-testid="link-login" to="/auth/login" className="text-[var(--bp-primary,#D4AF37)] hover:opacity-80">{t('auth.signup.signin')}</Link>
        </p>
      </div>

      <div className="hidden lg:block flex-1 bg-gradient-to-br from-[#0A0A0B] to-[#141416]" />
    </div>
  );
};

export default SignupPage;
