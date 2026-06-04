/**
 * AtelierModal — shared luxury-modal primitive (MOOD for DESIGN™).
 *
 * Tutti i modal devono avere questa estetica (dark · serif · monospace eyebrow
 * · backdrop blur · framer-motion entrance). NON usare <Dialog> shadcn diretto
 * per nuovi modal: importa questi primitive.
 *
 * Usage:
 *   <AtelierModal open={open} onClose={close} eyebrow="CRM · Nuovo Lead" title="Da dove vuoi iniziare?">
 *     <AtelierField label="Nome">
 *       <AtelierInput value={...} onChange={...} />
 *     </AtelierField>
 *     <AtelierFooter>
 *       <AtelierButton variant="ghost" onClick={back}>Indietro</AtelierButton>
 *       <AtelierButton onClick={submit}>Crea</AtelierButton>
 *     </AtelierFooter>
 *   </AtelierModal>
 *
 * Tokens: only var(--bp-*) / var(--accent-*) / var(--cm-*) — no hardcoded colors.
 */
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import './atelier-modal.css';

const EASE = [0.16, 1, 0.3, 1];

export function AtelierModal({
  open,
  onClose,
  eyebrow,
  title,
  subtitle,
  children,
  maxWidth = 640,
  testid = 'atelier-modal',
  hideClose = false,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="am-root">
          {/* Backdrop */}
          <motion.div
            className="am-backdrop"
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(14px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            transition={{ duration: 0.45, ease: EASE }}
            onClick={onClose}
            data-testid={`${testid}-backdrop`}
          />

          {/* Surface */}
          <motion.div
            className="am-surface"
            role="dialog"
            aria-modal="true"
            data-testid={testid}
            style={{ maxWidth }}
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.99 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.05 }}
          >
            {/* Ambient corner glow */}
            <div className="am-glow" aria-hidden />

            {!hideClose && (
              <button
                type="button"
                className="am-close"
                onClick={onClose}
                aria-label="Chiudi"
                data-testid={`${testid}-close`}
              >
                <X size={16} strokeWidth={1.6} />
              </button>
            )}

            <header className="am-head">
              {eyebrow && (
                <p className="am-eyebrow" data-testid={`${testid}-eyebrow`}>
                  {eyebrow}
                </p>
              )}
              {title && (
                <h2 className="am-title" data-testid={`${testid}-title`}>
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="am-subtitle" data-testid={`${testid}-subtitle`}>
                  {subtitle}
                </p>
              )}
            </header>

            <div className="am-body" data-testid={`${testid}-body`}>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export function AtelierFooter({ children, align = 'right' }) {
  return (
    <div className={`am-footer am-footer--${align}`}>{children}</div>
  );
}

export function AtelierField({ label, hint, required, error, children }) {
  return (
    <label className="am-field">
      {label && (
        <span className="am-field__label">
          {label}{required && <em className="am-field__req">*</em>}
        </span>
      )}
      {children}
      {hint && !error && <span className="am-field__hint">{hint}</span>}
      {error && <span className="am-field__error">{error}</span>}
    </label>
  );
}

export const AtelierInput = React.forwardRef(function AtelierInput(
  { className = '', ...props }, ref
) {
  return <input ref={ref} className={`am-input ${className}`} {...props} />;
});

export const AtelierTextarea = React.forwardRef(function AtelierTextarea(
  { className = '', rows = 3, ...props }, ref
) {
  return <textarea ref={ref} rows={rows} className={`am-input am-textarea ${className}`} {...props} />;
});

export const AtelierSelect = React.forwardRef(function AtelierSelect(
  { className = '', children, ...props }, ref
) {
  return (
    <select ref={ref} className={`am-input am-select ${className}`} {...props}>
      {children}
    </select>
  );
});

/**
 * AtelierButton — primary / ghost / minimal variants.
 * Primary uses --accent-primary for the glow.
 */
export function AtelierButton({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  type = 'button',
  testid,
  ...rest
}) {
  return (
    <button
      type={type}
      data-testid={testid}
      className={`am-btn am-btn--${variant} am-btn--${size} ${loading ? 'is-loading' : ''}`}
      disabled={disabled || loading}
      {...rest}
    >
      <span className="am-btn__label">{children}</span>
    </button>
  );
}

/**
 * AtelierChip — pill selector (single or multi). For multi-select grids
 * pass `active` to highlight. Use for source pickers, market chips, etc.
 */
export function AtelierChip({
  active,
  children,
  onClick,
  testid,
  variant = 'default',
  ...rest
}) {
  return (
    <button
      type="button"
      data-testid={testid}
      className={`am-chip am-chip--${variant} ${active ? 'is-active' : ''}`}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * AtelierCard — for "choice" lists inside a modal (replaces the old
 * grey ChoiceCard with a luxury doorway feel).
 */
export function AtelierCard({
  index,
  icon,
  title,
  desc,
  onClick,
  accent = 'var(--accent-primary, #5dd9c4)',
  testid,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="am-card"
      data-testid={testid}
      style={{ '--am-card-accent': accent }}
    >
      {typeof index === 'number' && (
        <span className="am-card__index">{String(index).padStart(2, '0')}</span>
      )}
      {icon && <span className="am-card__icon">{icon}</span>}
      <span className="am-card__body">
        <span className="am-card__title">{title}</span>
        {desc && <span className="am-card__desc">{desc}</span>}
      </span>
      <span className="am-card__arrow" aria-hidden>→</span>
    </button>
  );
}

export default AtelierModal;
