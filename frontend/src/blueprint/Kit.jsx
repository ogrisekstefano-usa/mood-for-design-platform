/**
 * Blueprint UI Kit — token-driven primitives reused across section components.
 * All visuals come from CSS variables set by BlueprintContext.applyTheme.
 */
import React from 'react';
import { ArrowUpRight } from 'lucide-react';

export const Eyebrow = ({ children, className = '', as: As = 'span' }) =>
  <As className={`bp-eyebrow ${className}`}>{children}</As>;

export const Display = ({ children, className = '', as: As = 'h1' }) =>
  <As className={`bp-display text-[var(--bp-text-primary)] ${className}`}>{children}</As>;

export const H1 = ({ children, className = '' }) =>
  <h1 className={`bp-h1 text-[var(--bp-text-primary)] ${className}`}>{children}</h1>;

export const H2 = ({ children, className = '' }) =>
  <h2 className={`bp-h2 text-[var(--bp-text-primary)] ${className}`}>{children}</h2>;

export const H3 = ({ children, className = '' }) =>
  <h3 className={`bp-h3 text-[var(--bp-text-primary)] ${className}`}>{children}</h3>;

export const Lead = ({ children, className = '' }) =>
  <p className={`bp-lead ${className}`}>{children}</p>;

export const Body = ({ children, className = '' }) =>
  <p className={`bp-body text-[var(--bp-text-secondary)] ${className}`}>{children}</p>;

export const Caption = ({ children, className = '' }) =>
  <p className={`bp-caption ${className}`}>{children}</p>;

export const Section = ({ children, className = '', atmosphere, ...rest }) => {
  const atmosphereClass = {
    cinematic: 'bp-vignette',
    grain:     'bp-grain',
    glass:     '',
    clean:     '',
  }[atmosphere] || '';
  return (
    <section className={`bp-section ${atmosphereClass} ${className}`} {...rest}>
      {children}
    </section>
  );
};

export const Container = ({ children, className = '', narrow = false }) =>
  <div className={`bp-container ${narrow ? 'max-w-3xl mx-auto' : ''} ${className}`}>{children}</div>;

export const Divider = () => <div className="bp-divider my-12" />;

export const Button = ({ children, variant = 'primary', as = 'a', href, onClick, className = '', testid, ...rest }) => {
  const variants = {
    primary: 'bp-btn-primary',
    ghost:   'bp-btn-ghost',
    link:    'bp-btn-link',
  };
  const cls = `bp-btn ${variants[variant] || variants.primary} ${className}`;
  if (as === 'a' || href) {
    return (
      <a href={href} data-testid={testid} className={cls} onClick={onClick} {...rest}>
        {children}
        {variant === 'link' && <ArrowUpRight size={14} strokeWidth={1.5} />}
      </a>
    );
  }
  return (
    <button data-testid={testid} className={cls} onClick={onClick} {...rest}>
      {children}
    </button>
  );
};

/** Render an array of CTAs (label/href pairs). */
export const CTAGroup = ({ primary, secondary, className = '' }) => {
  if (!primary && !secondary) return null;
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {primary?.label && (
        <Button href={primary.href || '#'} variant="primary" testid="cta-primary">
          {primary.label}
        </Button>
      )}
      {secondary?.label && (
        <Button href={secondary.href || '#'} variant="ghost" testid="cta-secondary">
          {secondary.label}
        </Button>
      )}
    </div>
  );
};
