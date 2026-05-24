/**
 * ITER144.1 · Cinematic Module Blocked State™
 *
 * Intentional, not broken. When a tenant runtime configuration disables
 * a module, the router renders THIS instead of a 403/blank/redirect-loop.
 *
 * Variants:
 *   LOCKED         — feature requires upgrade (cyan/gold)
 *   DISABLED       — module turned off by tenant/operator (gray)
 *   COMING_SOON    — module enabled but not yet released (beta amber)
 *   HIDDEN         — module exists but is invisible (silent gray)
 *   BETA_RESTRICTED — module enabled but caller lacks beta access
 *
 * Editorial copy resolves through useEditorialBlock (Editorial Runtime™
 * namespace `system.module_guard.*`). Falls back to platform default
 * cinematic copy when the bundle is not yet seeded.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, EyeOff, MoonStar, Sparkles, ShieldOff, ArrowLeft } from 'lucide-react';
import { useBlueprint } from '../../contexts/BlueprintContext';

const VARIANT_META = {
  locked: {
    Icon: Lock,
    accent: '#c084fc',
    eyebrowDefault: 'Locked module',
    titleDefault: 'Questo capitolo è riservato.',
    ledeDefault: 'L\'accesso a questo modulo è custodito. Contattaci per attivarlo nel tuo runtime.',
  },
  disabled: {
    Icon: ShieldOff,
    accent: 'rgba(255,255,255,0.45)',
    eyebrowDefault: 'Modulo disattivato',
    titleDefault: 'Questo spazio è in silenzio.',
    ledeDefault: 'Il tuo studio ha scelto di non operare in questa zona del runtime.',
  },
  coming_soon: {
    Icon: MoonStar,
    accent: '#f4c97a',
    eyebrowDefault: 'In arrivo',
    titleDefault: 'Stiamo componendo questo capitolo.',
    ledeDefault: 'Quando sarà pronto, apparirà naturalmente nel tuo runtime.',
  },
  hidden: {
    Icon: EyeOff,
    accent: 'rgba(255,255,255,0.30)',
    eyebrowDefault: 'Nascosto',
    titleDefault: 'Niente da vedere qui, per ora.',
    ledeDefault: 'Questa superficie esiste, ma è invisibile per il tuo runtime.',
  },
  beta_restricted: {
    Icon: Sparkles,
    accent: 'var(--atelier-cyan)',
    eyebrowDefault: 'Beta riservata',
    titleDefault: 'Accesso anticipato richiesto.',
    ledeDefault: 'Questo modulo è in beta e attende una manciata di studi pilota.',
  },
  unavailable: {
    Icon: ShieldOff,
    accent: 'rgba(244, 201, 122, 0.75)',
    eyebrowDefault: 'Stato runtime non riconosciuto',
    titleDefault: 'Questa superficie è momentaneamente indisponibile.',
    ledeDefault: 'Il runtime ha ricevuto uno stato non mappato per questo modulo. Stiamo rendendo una superficie neutra mentre indaghiamo.',
  },
};

const ModuleBlockedState = ({ moduleCode, state = 'disabled', fallbackTo = '/dashboard' }) => {
  const variant = (state || 'disabled').toLowerCase();
  const meta = VARIANT_META[variant] || VARIANT_META.disabled;
  const Icon = meta.Icon;

  // Editorial Runtime resolution via useBlueprint.t() — ALE-driven.
  // The blocked surface is always rendered inside the BlueprintProvider
  // tree, so this hook call is safe and consistent.
  const { t } = useBlueprint();

  const ns = 'system.module_guard';
  const eyebrow = t(`${ns}.${variant}.eyebrow`, null, meta.eyebrowDefault);
  const title   = t(`${ns}.${variant}.title`,   null, meta.titleDefault);
  const lede    = t(`${ns}.${variant}.lede`,    null, meta.ledeDefault);
  const ctaHome = t(`${ns}.cta.home`,           null, 'Torna alla dashboard');

  return (
    <div
      data-testid="module-blocked-state"
      data-module-code={moduleCode}
      data-module-state={variant}
      style={{
        minHeight: '70vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'radial-gradient(ellipse at top left, rgba(124,228,245,0.05), transparent 50%), ' +
          'radial-gradient(ellipse at bottom right, rgba(192,132,252,0.04), transparent 55%), ' +
          'var(--bp-bg, #050608)',
        padding: '64px 32px',
      }}
    >
      <div style={{
        maxWidth: 560,
        textAlign: 'center',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 20,
        padding: '56px 48px',
        backdropFilter: 'blur(18px)',
        boxShadow: `0 0 80px ${meta.accent}10`,
      }}>
        <div style={{
          width: 56, height: 56,
          margin: '0 auto 28px',
          borderRadius: 14,
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${meta.accent}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 32px ${meta.accent}25`,
        }}>
          <Icon size={22} strokeWidth={1.5} color={meta.accent} />
        </div>

        <div style={{
          fontFamily: 'var(--atelier-mono)',
          fontSize: 10,
          letterSpacing: '0.32em',
          textTransform: 'uppercase',
          color: meta.accent,
          marginBottom: 14,
        }}>
          {eyebrow}
        </div>

        <h1 style={{
          fontFamily: 'var(--atelier-serif)',
          fontStyle: 'italic',
          fontSize: 32,
          fontWeight: 400,
          color: '#f5f7fa',
          margin: 0,
          letterSpacing: '-0.015em',
          lineHeight: 1.15,
        }}>
          {title}
        </h1>

        <p style={{
          color: 'var(--bp-text-soft)',
          fontSize: 14,
          lineHeight: 1.65,
          marginTop: 18,
          marginBottom: 32,
        }}>
          {lede}
        </p>

        <Link
          to={fallbackTo}
          data-testid="module-blocked-home-cta"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '11px 24px',
            border: '1px solid var(--atelier-cyan)',
            borderRadius: 999,
            color: 'var(--atelier-cyan)',
            fontFamily: 'var(--atelier-mono)',
            fontSize: 10.5,
            letterSpacing: '0.26em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            transition: 'background 220ms var(--bp-ease-cinema)',
          }}
        >
          <ArrowLeft size={13} strokeWidth={1.5} />
          {ctaHome}
        </Link>

        {moduleCode && (
          <div style={{
            marginTop: 36,
            paddingTop: 18,
            borderTop: '1px solid rgba(255,255,255,0.04)',
            fontFamily: 'var(--atelier-mono)',
            fontSize: 9.5,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.32)',
          }}>
            module · {moduleCode} · {variant}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModuleBlockedState;
