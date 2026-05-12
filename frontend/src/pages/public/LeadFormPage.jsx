/**
 * Public lead capture form — tenant-scoped via slug in URL.
 */
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { ArrowRight } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const LeadFormPage = () => {
  const { slug } = useParams();
  const { t } = useBlueprint();
  const [tenant, setTenant] = useState(null);
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    project_type: '', budget_range: '', notes: '',
    lead_type: 'private_client',
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get(`${BACKEND_URL}/api/blueprint/tenant/by-slug/${slug}`)
      .then((r) => setTenant(r.data))
      .catch(() => setError(t('common.noResults')));
  }, [slug, t]);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await axios.post(`${BACKEND_URL}/api/leads/public?tenant_slug=${slug}`, form);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error');
    } finally {
      setLoading(false);
    }
  };

  if (error && !tenant) return <div className="min-h-screen flex items-center justify-center bg-[#0A0A0B] text-[#A19D98] font-body">{error}</div>;

  return (
    <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center p-6" data-testid="lead-form-page"
         style={{
           ...(tenant?.theme?.primary_color ? { '--bp-primary': tenant.theme.primary_color } : {}),
         }}>
      <div className="w-full max-w-lg">
        {tenant && (
          <div className="text-center mb-8">
            {tenant.theme?.logo_url ? (
              <img src={tenant.theme.logo_url} alt={tenant.name} className="h-10 mx-auto mb-3" />
            ) : (
              <p className="font-heading text-2xl text-[#EFEBE4] mb-2">{tenant.name}</p>
            )}
            <p className="text-[#6B6863] text-xs font-body uppercase tracking-[0.2em]">{t('auth.login.tagline')}</p>
          </div>
        )}

        {submitted ? (
          <div data-testid="lead-form-success" className="text-center bg-[#141416] border border-white/[0.06] rounded-md p-10">
            <h1 className="font-heading text-3xl text-[#EFEBE4] mb-2">{t('common.welcome')}</h1>
            <p className="text-[#A19D98] text-sm font-body">{t('auth.forgot.sent')}</p>
          </div>
        ) : (
          <form onSubmit={submit} className="bg-[#141416] border border-white/[0.06] rounded-md p-8 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <input data-testid="lf-first" required placeholder={t('leads.field.firstName')} value={form.first_name} onChange={set('first_name')} className="input-luxury px-3 py-2.5 text-sm rounded-[3px]" />
              <input data-testid="lf-last" required placeholder={t('leads.field.lastName')} value={form.last_name} onChange={set('last_name')} className="input-luxury px-3 py-2.5 text-sm rounded-[3px]" />
            </div>
            <input data-testid="lf-email" required type="email" placeholder={t('leads.field.email')} value={form.email} onChange={set('email')} className="input-luxury w-full px-3 py-2.5 text-sm rounded-[3px]" />
            <input data-testid="lf-phone" type="tel" placeholder={t('leads.field.phone')} value={form.phone} onChange={set('phone')} className="input-luxury w-full px-3 py-2.5 text-sm rounded-[3px]" />
            <input data-testid="lf-project-type" placeholder={t('leads.field.projectType')} value={form.project_type} onChange={set('project_type')} className="input-luxury w-full px-3 py-2.5 text-sm rounded-[3px]" />
            <input data-testid="lf-budget" placeholder={t('leads.field.budget')} value={form.budget_range} onChange={set('budget_range')} className="input-luxury w-full px-3 py-2.5 text-sm rounded-[3px]" />
            <textarea data-testid="lf-notes" rows={3} placeholder={t('leads.field.notes')} value={form.notes} onChange={set('notes')} className="input-luxury w-full px-3 py-2.5 text-sm rounded-[3px] resize-none" />
            {error && <p className="text-red-400 text-xs font-body">{error}</p>}
            <button data-testid="lf-submit" type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[var(--bp-primary,#D4AF37)] hover:opacity-90 text-[#0A0A0B] font-semibold text-sm font-body rounded-[3px] disabled:opacity-50">
              {loading ? t('common.loading') : <>{t('common.submit')} <ArrowRight size={15} /></>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default LeadFormPage;
