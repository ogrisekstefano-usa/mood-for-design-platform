import React, { useState } from 'react';
import { Globe, ChevronDown } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';
import MarketSelectorModal from './MarketSelectorModal';

/**
 * MarketTrigger — pill displayed in the footer.
 *
 * Reads the current market from LocaleContext. On click, opens
 * <MarketSelectorModal /> which fully drives market selection.
 *
 * NO hardcoded labels, codes, or currencies — everything from DB.
 */
const MarketTrigger = () => {
  const { market, ready } = useLocale();
  const [open, setOpen] = useState(false);

  if (!ready || !market) {
    // Render a discreet placeholder until catalogs are hydrated.
    return (
      <button
        disabled
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'var(--mood-text-3)',
          padding: '0.85rem 1.4rem', borderRadius: 9999,
          fontFamily: 'Inter, sans-serif', fontSize: '0.85rem',
          letterSpacing: '0.04em', cursor: 'not-allowed',
        }}
        data-testid="market-trigger-loading"
      >
        <Globe size={14} strokeWidth={1.4} />
        <span>Mercato…</span>
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        data-testid="market-trigger"
        aria-expanded={open}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: 'var(--mood-text-1)',
          padding: '0.85rem 1.4rem', borderRadius: 9999,
          fontFamily: 'Inter, sans-serif', fontSize: '0.86rem',
          letterSpacing: '0.04em', cursor: 'pointer',
          transition: 'border-color 0.2s, background 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--mood-teal, #00C9B3)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
      >
        <Globe size={14} strokeWidth={1.4} color="var(--mood-teal, #00C9B3)" />
        <span style={{ fontWeight: 500 }}>{market.display_name || market.code}</span>
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>·</span>
        <span style={{ color: 'rgba(255,255,255,0.75)' }}>{market.primary_locale}</span>
        <ChevronDown size={14} strokeWidth={1.6} style={{ opacity: 0.5, marginLeft: 4 }} />
      </button>

      <MarketSelectorModal open={open} onClose={() => setOpen(false)} />
    </>
  );
};

export default MarketTrigger;
