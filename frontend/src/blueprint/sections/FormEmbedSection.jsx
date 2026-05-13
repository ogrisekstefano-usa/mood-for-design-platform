/**
 * FormEmbedSection — pulls a published Blueprint Form by slug and renders inline,
 * OR shows a CTA button that opens a modal with the form.
 *
 * Reuses FormRenderer — ZERO duplicated rendering logic.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Section, Container, Eyebrow, H2, Lead, Button } from '../Kit';
import FormRenderer from '../forms/FormRenderer';
import { X } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

const FormEmbedSection = ({ content = {} }) => {
  const [tenantSlug, setTenantSlug] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const variant = content.variant || 'inline';

  useEffect(() => {
    // Derive tenant slug from URL: /:tenantSlug or /:tenantSlug/:pageSlug
    const segs = window.location.pathname.split('/').filter(Boolean);
    setTenantSlug(segs[0] || null);
  }, []);

  useEffect(() => {
    if (!tenantSlug || !content.form_slug) return;
    axios.get(`${BACKEND}/api/forms/public/${tenantSlug}/${content.form_slug}`)
      .then((r) => setForm(r.data))
      .catch(() => setError(true));
  }, [tenantSlug, content.form_slug]);

  const submit = async (answers, meta) => {
    await axios.post(`${BACKEND}/api/forms/public/${tenantSlug}/${content.form_slug}/submit`,
      { answers, meta, draft: false });
  };

  return (
    <Section data-testid="section-form-embed">
      <Container narrow>
        {content.eyebrow && <Eyebrow>{content.eyebrow}</Eyebrow>}
        {content.headline && <H2 className="mt-4">{content.headline}</H2>}
        {content.subline && <Lead className="mt-6">{content.subline}</Lead>}

        {error && (
          <p className="bp-caption text-[var(--bp-text-muted)] mt-10">
            Form unavailable. Please check the form slug or publish it.
          </p>
        )}

        {!error && variant === 'inline' && form && (
          <div className="mt-12 border border-[var(--bp-border)] rounded-[var(--bp-radius-md)] bg-[var(--bp-surface-1)]/40 overflow-hidden">
            <FormRenderer form={form} onSubmit={submit} />
          </div>
        )}

        {!error && variant === 'modal_trigger' && (
          <div className="mt-10">
            <Button onClick={() => setOpen(true)} variant="primary" testid="open-form-modal">
              {content.cta_label || 'Start the brief'}
            </Button>
            {open && form && (
              <div className="fixed inset-0 z-50 bg-[var(--bp-overlay)] backdrop-blur-md animate-fadeIn" onClick={() => setOpen(false)}>
                <div onClick={(e) => e.stopPropagation()} className="absolute inset-x-0 top-10 bottom-10 mx-auto max-w-2xl bg-[var(--bp-bg)] border border-[var(--bp-border)] rounded-[var(--bp-radius-md)] overflow-hidden flex flex-col">
                  <button onClick={() => setOpen(false)} className="absolute top-4 right-4 z-10 p-2 text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]" data-testid="close-form-modal">
                    <X size={18} strokeWidth={1.5} />
                  </button>
                  <div className="flex-1 overflow-auto">
                    <FormRenderer form={form} onSubmit={submit} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Container>
    </Section>
  );
};

export default FormEmbedSection;
