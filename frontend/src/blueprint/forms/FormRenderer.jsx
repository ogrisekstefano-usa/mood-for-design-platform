/**
 * FormRenderer — generic cinematic form renderer.
 *
 * Props:
 *  - form         : the form schema document
 *  - locale       : current locale code
 *  - onSubmit     : async (answers, meta) => void
 *  - initialAnswers
 *
 * Behaviour:
 *  - Multi-step navigation with progress bar
 *  - Per-step validation
 *  - Conditional visibility on steps + fields
 *  - Final thank-you state with optional redirect
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { resolveField, evaluateVisibility, resolveI18n } from './FieldRegistry';

const FormRenderer = ({ form, locale = 'en-US', onSubmit, initialAnswers = {} }) => {
  const [stepIdx, setStepIdx] = useState(0);
  const [answers, setAnswers] = useState(initialAnswers);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Filter steps by visibility rule
  const visibleSteps = useMemo(() => {
    return (form?.steps || []).filter((s) => !s.visibility || evaluateVisibility(s.visibility, answers));
  }, [form, answers]);

  const step = visibleSteps[stepIdx];
  const visibleFields = useMemo(() => {
    if (!step) return [];
    return (step.fields || []).filter((f) => !f.visibility || evaluateVisibility(f.visibility, answers));
  }, [step, answers]);

  // Validate current step
  const validateStep = () => {
    const e = {};
    for (const f of visibleFields) {
      const v = answers[f.key || f.id];
      if (f.required && (v === undefined || v === '' || v === null || (Array.isArray(v) && v.length === 0))) {
        e[f.key || f.id] = 'Required';
      }
      if (f.type === 'email' && v && !/^\S+@\S+\.\S+$/.test(v)) {
        e[f.key || f.id] = 'Invalid email';
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const isLast = stepIdx === visibleSteps.length - 1;

  const next = () => {
    if (!validateStep()) return;
    if (isLast) return submit();
    setStepIdx((i) => Math.min(i + 1, visibleSteps.length - 1));
    setErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const back = () => {
    setStepIdx((i) => Math.max(i - 1, 0));
    setErrors({});
  };

  const submit = async () => {
    if (!validateStep()) return;
    setSubmitting(true);
    try {
      await onSubmit?.(answers, { locale, started_at: Date.now() });
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  const setAnswer = (key, value) => setAnswers((prev) => ({ ...prev, [key]: value }));

  // Auto-redirect after submit
  useEffect(() => {
    if (!done) return;
    const ty = form?.settings?.thank_you || {};
    if (ty.redirect_url) {
      const t = setTimeout(() => { window.location.href = ty.redirect_url; }, ty.delay_ms || 2400);
      return () => clearTimeout(t);
    }
  }, [done, form]);

  if (!form) return null;

  // Thank-you state
  if (done) {
    const ty = form.settings?.thank_you || {};
    return (
      <div className="bp-container px-[var(--bp-section-x)] py-[var(--bp-section-y)] text-center bp-enter" data-testid="form-thankyou">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[var(--bp-primary)]/10 border border-[var(--bp-primary)]/30 mb-10">
          <Check size={28} strokeWidth={1.5} className="text-[var(--bp-primary)]" />
        </div>
        <h1 className="bp-display text-[var(--bp-text-primary)] font-light max-w-2xl mx-auto">
          {resolveI18n(ty.headline, locale) || 'Thank you.'}
        </h1>
        {ty.subline && (
          <p className="bp-lead mt-8 max-w-lg mx-auto">{resolveI18n(ty.subline, locale)}</p>
        )}
      </div>
    );
  }

  const submitLabel = resolveI18n(form.settings?.submit_label, locale) || 'Submit';
  const progress = visibleSteps.length > 1 ? ((stepIdx + 1) / visibleSteps.length) * 100 : 0;

  return (
    <div className="min-h-screen flex flex-col" data-testid="form-renderer">
      {/* Progress bar */}
      {form.settings?.show_progress !== false && visibleSteps.length > 1 && (
        <div className="h-px bg-[var(--bp-border)] sticky top-0 z-30">
          <div className="h-full bg-[var(--bp-primary)] transition-all duration-[var(--bp-duration-slow)] ease-[var(--bp-ease)]"
            style={{ width: `${progress}%` }} data-testid="form-progress" />
        </div>
      )}

      {/* Step content */}
      <main className="flex-1 flex items-center">
        <div className="bp-container px-[var(--bp-section-x)] py-[var(--bp-section-y)] w-full max-w-2xl mx-auto" key={stepIdx}>
          <div className="bp-enter">
            <p className="bp-eyebrow" data-testid="form-step-indicator">
              Step {stepIdx + 1} of {visibleSteps.length}
            </p>
            {step?.title && (
              <h1 className="bp-h1 text-[var(--bp-text-primary)] font-light mt-4">
                {resolveI18n(step.title, locale)}
              </h1>
            )}
            {step?.description && (
              <p className="bp-lead mt-6 max-w-xl">{resolveI18n(step.description, locale)}</p>
            )}
            <div className="mt-16 space-y-14">
              {visibleFields.map((field, fi) => {
                const Component = resolveField(field.type);
                if (!Component) return (
                  <div key={field.id} className="bp-caption text-[var(--bp-text-muted)]">
                    Unknown field type: <code>{field.type}</code>
                  </div>
                );
                const key = field.key || field.id;
                return (
                  <Component key={field.id} field={field} value={answers[key]}
                    onChange={(v) => setAnswer(key, v)}
                    locale={locale}
                    error={errors[key]}
                    autoFocus={fi === 0} />
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Sticky bottom bar */}
      <footer className="border-t border-[var(--bp-border)] bg-[var(--bp-surface-1)]/40 backdrop-blur-sm sticky bottom-0 z-30">
        <div className="bp-container px-[var(--bp-section-x)] h-20 flex items-center justify-between gap-4">
          <button onClick={back} disabled={stepIdx === 0}
            data-testid="form-back-btn"
            className={`bp-btn bp-btn-link ${stepIdx === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}>
            <ArrowLeft size={14} strokeWidth={1.5} /> Back
          </button>
          <button onClick={next} disabled={submitting}
            data-testid="form-next-btn"
            className="bp-btn bp-btn-primary">
            {submitting ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"/> :
              isLast ? submitLabel : 'Continue'}
            {!submitting && <ArrowRight size={14} strokeWidth={1.5} />}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default FormRenderer;
