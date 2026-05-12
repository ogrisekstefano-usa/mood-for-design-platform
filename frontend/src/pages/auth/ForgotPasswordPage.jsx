import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { formatError } from '../../lib/api';
import { ArrowLeft, CheckCircle } from 'lucide-react';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/api/auth/forgot-password', { email });
      setSent(true);
    } catch (e) {
      setError(formatError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center px-4 auth-bg">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-10 justify-center">
          <div className="w-8 h-8 bg-[#D4AF37] rounded-[3px] flex items-center justify-center">
            <span className="text-[#0A0A0B] text-sm font-bold font-body">M</span>
          </div>
        </div>

        <div className="bg-[#141416] border border-white/[0.06] rounded-[6px] p-8 animate-fadeIn">
          {sent ? (
            <div className="text-center">
              <CheckCircle size={40} className="text-[#D4AF37] mx-auto mb-4" strokeWidth={1} />
              <h2 className="font-heading text-2xl text-[#EFEBE4] mb-2">Email inviata</h2>
              <p className="text-[#6B6863] text-sm font-body mb-6">
                Se l'account esiste, riceverai le istruzioni per reimpostare la password.
              </p>
              <Link to="/auth/login" className="text-[#D4AF37] text-sm font-body hover:text-[#E2C365] transition-colors">
                ← Torna al login
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="font-heading text-3xl font-light text-[#EFEBE4] mb-1">Password dimenticata</h1>
                <p className="text-[#6B6863] text-sm font-body">Inserisci la tua email per reimpostare la password.</p>
              </div>

              {error && (
                <div className="mb-5 px-4 py-3 bg-[#F44336]/10 border border-[#F44336]/20 rounded-[3px]">
                  <p className="text-[#F44336] text-sm font-body">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B6863] font-body mb-2">Email</label>
                  <input data-testid="forgot-email-input" type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="your@studio.com" className="input-luxury w-full px-4 py-3 text-sm font-body rounded-[3px]" />
                </div>
                <button data-testid="forgot-submit-btn" type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#D4AF37] hover:bg-[#E2C365] text-[#0A0A0B] font-semibold text-sm font-body rounded-[3px] transition-colors disabled:opacity-50">
                  {loading ? <div className="w-4 h-4 border-2 border-[#0A0A0B] border-t-transparent rounded-full animate-spin" /> : 'Invia istruzioni'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link to="/auth/login" className="flex items-center justify-center gap-1.5 text-[#6B6863] text-xs font-body hover:text-[#A19D98] transition-colors">
                  <ArrowLeft size={12} /> Torna al login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
