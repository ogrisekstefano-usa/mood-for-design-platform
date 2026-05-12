import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { formatError } from '../../lib/api';
import Brand from '../../components/common/Brand';
import LocaleSwitcher from '../../components/common/LocaleSwitcher';

const BG_IMAGE = 'https://images.unsplash.com/photo-1776935359455-94263068537c?w=1400&q=80';

const LoginPage = () => {
  const { signIn } = useAuth();
  const { t } = useBlueprint();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(form.email, form.password);
      navigate('/dashboard');
    } catch (e) {
      setError(formatError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex auth-bg" data-testid="login-page">
      <div className="w-full lg:w-[480px] flex flex-col justify-center px-10 py-12 bg-[#0A0A0B] relative z-10">
        <div className="flex items-center justify-between mb-12">
          <Brand />
          <LocaleSwitcher />
        </div>

        <div className="mb-8">
          <h1 className="font-heading text-4xl font-light text-[#EFEBE4] mb-2 leading-tight">
            {t('auth.login.title')}
          </h1>
          <p className="text-[#6B6863] text-sm font-body">{t('auth.login.subtitle')}</p>
        </div>

        {error && (
          <div data-testid="login-error" className="mb-6 px-4 py-3 bg-[#F44336]/10 border border-[#F44336]/20 rounded-[3px]">
            <p className="text-[#F44336] text-sm font-body">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B6863] font-body mb-2">
              {t('auth.login.email')}
            </label>
            <input
              data-testid="login-email-input"
              type="email"
              required
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              placeholder="you@studio.com"
              className="input-luxury w-full px-4 py-3 text-sm font-body rounded-[3px]"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B6863] font-body">
                {t('auth.login.password')}
              </label>
              <Link to="/auth/forgot-password" className="text-[11px] text-[var(--bp-primary,#D4AF37)] hover:opacity-80 font-body">
                {t('auth.login.forgot')}
              </Link>
            </div>
            <div className="relative">
              <input
                data-testid="login-password-input"
                type={showPw ? 'text' : 'password'}
                required
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="••••••••"
                className="input-luxury w-full px-4 py-3 pr-11 text-sm font-body rounded-[3px]"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A4845] hover:text-[#A19D98] transition-colors"
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button
            data-testid="login-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 px-6 py-3 bg-[var(--bp-primary,#D4AF37)] hover:opacity-90 text-[#0A0A0B] font-semibold text-sm font-body rounded-[3px] transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-[#0A0A0B] border-t-transparent rounded-full animate-spin" />
            ) : (
              <>{t('auth.login.submit')} <ArrowRight size={15} /></>
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-[#4A4845] text-xs font-body">
          {t('auth.login.noAccount')}{' '}
          <Link data-testid="link-signup" to="/auth/signup" className="text-[var(--bp-primary,#D4AF37)] hover:opacity-80">
            {t('auth.login.signup')}
          </Link>
        </p>

        <p className="mt-auto pt-8 text-[#3A3835] text-[10px] text-center font-body tracking-wide">
          © {new Date().getFullYear()} {t('brand.name')}. {t('brand.tagline')}
        </p>
      </div>

      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        <img src={BG_IMAGE} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0B] via-[#0A0A0B]/30 to-transparent" />
        <div className="absolute bottom-12 right-12 text-right">
          <p className="font-heading text-5xl font-light text-white/80 leading-tight">
            {t('auth.login.tagline')}
          </p>
          <p className="text-white/30 text-sm font-body mt-3 tracking-wide">{t('auth.login.taglineSub')}</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
