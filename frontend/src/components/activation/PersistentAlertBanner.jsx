/**
 * PersistentAlertBanner™ — ITER180 · AF1
 *
 * Banner sticky in alto a tutta l'app.
 * Visible IFF:
 *   - utente è studio member (non client)
 *   - tenant non è ancora Activated (completed < total)
 *   - esiste almeno uno step critico mancante
 *   - banner non dismissed nelle ultime 24h
 */
import React from 'react';
import { AlertCircle, X, ArrowRight } from 'lucide-react';
import { useActivationFoundation } from '../../hooks/useActivationFoundation';
import { useSmartCtaRouter } from '../../hooks/useSmartCtaRouter';

export default function PersistentAlertBanner() {
  const { data, bannerDismissed, dismissBanner } = useActivationFoundation();
  const route = useSmartCtaRouter();

  if (!data || data.activated || bannerDismissed) return null;
  const next = data.next_action;
  if (!next) return null;

  return (
    <div
      data-testid="activation-banner"
      data-step={next.key}
      style={{
        position: 'sticky', top: 0, zIndex: 90,
        background: '#0c0e12', color: '#ffffff',
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '10px 22px',
        borderBottom: '1px solid #1f2329',
        fontSize: 13,
      }}
    >
      <AlertCircle size={16} strokeWidth={1.7} style={{ flexShrink: 0, opacity: 0.85 }} />
      <span style={{ flex: 1, lineHeight: 1.4 }}>
        <strong style={{ fontWeight: 600 }}>Activation Foundation™ · {data.completed}/{data.total}</strong>
        {' · '}
        <span style={{ opacity: 0.85 }}>{next.title}</span>
        {' — '}
        <span style={{ opacity: 0.7 }}>{next.description}</span>
      </span>
      <button
        data-testid="activation-banner-cta"
        onClick={() => route(next.cta_route)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', background: '#ffffff', color: '#0c0e12',
          border: 0, borderRadius: 6, cursor: 'pointer',
          fontSize: 12, fontWeight: 500,
        }}
      >
        {next.cta_label} <ArrowRight size={12} />
      </button>
      <button
        data-testid="activation-banner-dismiss"
        onClick={dismissBanner}
        aria-label="Nascondi per 24 ore"
        title="Nascondi per 24 ore"
        style={{
          background: 'transparent', border: 0, color: 'rgba(255,255,255,0.55)',
          cursor: 'pointer', padding: 4,
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
