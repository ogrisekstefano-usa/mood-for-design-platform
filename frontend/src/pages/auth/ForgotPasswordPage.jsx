import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import Brand from '../../components/common/Brand';
import LocaleSwitcher from '../../components/common/LocaleSwitcher';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const ForgotPasswordPage = () => {
  const { t } = useBlueprint();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${BACKEND_URL}/api/auth/forgot-password`, { email });
    } catch (_) {}
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex auth-bg" data-testid="forgot-page">
      <div className="w-full max-w-md mx-auto flex flex-col justify-center px-10 py-12">
        <div className="flex items-center justify-between mb-12">
          <Brand />
          <LocaleSwitcher />
        </div>
        <h1 className="font-heading text-4xl font-light text-[#EFEBE4] mb-2">{t('auth.forgot.title')}</h1>
        <p className="text-[#6B6863] text-sm font-body mb-8">{t('auth.forgot.subtitle')}</p>

        {sent ? (
          <div data-testid="forgot-sent" className="px-4 py-3 bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-[3px] mb-6">
            <p className="text-[var(--bp-primary,#D4AF37)] text-sm font-body">{t('auth.forgot.sent')}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              data-testid="forgot-email"
              required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.login.email')}
              className="input-luxury w-full px-4 py-3 text-sm font-body rounded-[3px]"
            />
            <button data-testid="forgot-submit" type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[var(--bp-primary,#D4AF37)] hover:opacity-90 text-[#0A0A0B] font-semibold text-sm font-body rounded-[3px] disabled:opacity-50">
              {t('auth.forgot.submit')} <ArrowRight size={15} />
            </button>
          </form>
        )}
        <Link to="/auth/login" className="mt-6 inline-flex items-center gap-2 text-xs text-[#6B6863] hover:text-[#A19D98] font-body">
          <ArrowLeft size={12} /> {t('common.back')}
        </Link>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
