/**
 * PersistentAlertBanner™ — ITER180 · AF1 → ITER181.C visual consolidation
 *
 * Banner sticky in alto a tutta l'app. Usa token canonici --bp-surface-2
 * (dark Nordic), --atelier-cyan come accento, tipografia atelier-sans.
 * Visible IFF:
 *   - utente è studio member (non client)
 *   - tenant non ancora Activated (completed < total)
 *   - esiste almeno uno step critico mancante
 *   - banner non dismissed nelle ultime 24h
 */
import React from 'react';
import { useLocation } from 'react-router-dom';
import { AlertCircle, X, ArrowRight } from 'lucide-react';
import { useActivationFoundation } from '../../hooks/useActivationFoundation';
import { useSmartCtaRouter } from '../../hooks/useSmartCtaRouter';

export default function PersistentAlertBanner() {
  const { data, bannerDismissed, dismissBanner } = useActivationFoundation();
  const route = useSmartCtaRouter();
  const { pathname } = useLocation();

  if (!data || data.activated || bannerDismissed || data.dismissed) return null;
  // Editorial Dashboard (Feb 2026) · banner NON deve dominare /dashboard
  if (pathname === '/dashboard' || pathname === '/dashboard/') return null;
  const next = data.next_action;
  if (!next) return null;

  return (
    <div
      data-testid="activation-banner"
      data-step={next.key}
      className="atd-banner"
    >
      <AlertCircle size={15} strokeWidth={1.6} className="atd-banner__icon" />
      <span className="atd-banner__body">
        <span className="atd-banner__title">Setup workspace · {data.completed}/{data.total}</span>
        <span className="atd-banner__sep">·</span>
        <span>{next.title}</span>
        <span className="atd-banner__sep">·</span>
        <span className="atd-banner__desc">{next.description}</span>
      </span>
      <button
        type="button"
        data-testid="activation-banner-cta"
        className="atd-banner__cta"
        onClick={() => route(next.cta_route)}
      >
        {next.cta_label} <ArrowRight size={11} />
      </button>
      <button
        type="button"
        data-testid="activation-banner-dismiss"
        className="atd-banner__dismiss"
        onClick={dismissBanner}
        aria-label="Nascondi per 24 ore"
        title="Nascondi per 24 ore"
      >
        <X size={13} />
      </button>
    </div>
  );
}
