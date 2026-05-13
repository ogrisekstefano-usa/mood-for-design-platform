/**
 * PublicFormPage — `/f/:tenantSlug/:formSlug` cinematic public form.
 *
 * Loads tenant theme + form schema, renders the FormRenderer, submits to
 * /api/forms/public/{tenant}/{form}/submit. NO auth required.
 */
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { applyTheme } from '../../contexts/BlueprintContext';
import FormRenderer from '../../blueprint/forms/FormRenderer';
import { detectInitialLocale } from './publicLocale';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

const PublicFormPage = () => {
  const { tenantSlug, formSlug } = useParams();
  const [tenant, setTenant] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [locale, setLocale] = useState(detectInitialLocale());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [tRes, fRes] = await Promise.all([
          axios.get(`${BACKEND}/api/public/tenants/${tenantSlug}`),
          axios.get(`${BACKEND}/api/forms/public/${tenantSlug}/${formSlug}`),
        ]);
        if (cancelled) return;
        setTenant(tRes.data);
        setForm(fRes.data);
        applyTheme(tRes.data?.theme);
        if (!localStorage.getItem('mfd_public_locale')) {
          setLocale(tRes.data?.locales?.default || 'en-US');
        }
        document.title = `${(fRes.data?.title || {})._default || 'Form'} — ${tRes.data?.name || ''}`;
      } catch (_) {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [tenantSlug, formSlug]);

  const handleSubmit = async (answers, meta) => {
    await axios.post(`${BACKEND}/api/forms/public/${tenantSlug}/${formSlug}/submit`, {
      answers, meta, draft: false,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bp-bg)]">
        <div className="w-5 h-5 border-2 border-[var(--bp-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (notFound || !tenant || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bp-bg)] flex-col gap-4">
        <p className="bp-eyebrow text-[var(--bp-text-muted)]">404</p>
        <h1 className="bp-h1">Form not available.</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bp-bg)] text-[var(--bp-text-primary)]" data-testid="public-form-page">
      <FormRenderer form={form} locale={locale} onSubmit={handleSubmit} />
    </div>
  );
};

export default PublicFormPage;
