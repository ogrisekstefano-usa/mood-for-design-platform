import React, { useEffect, useState, useMemo } from 'react';
import { Globe, X, Search, Check } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';

/**
 * MarketSelectorModal — Market-first UI, fully DB-driven.
 *
 * Reads `markets` + `marketGroups` from LocaleContext (which itself hydrates
 * from /api/markets). NO hardcoded country/locale arrays anywhere.
 *
 * Behaviour:
 *   • Renders 1 column per macro_region; markets sorted by sort_order
 *     within each region.
 *   • Search filters by display_name OR country code OR market code.
 *   • Click on market → ctx.setMarket(code) → context updates locale,
 *     currency, direction, and persists to localStorage.
 */
const MarketSelectorModal = ({ open, onClose }) => {
  const { market, markets, marketGroups, setMarket, ready } = useLocale();
  const [query, setQuery] = useState('');

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    if (!query.trim()) return markets;
    const q = query.trim().toLowerCase();
    return markets.filter((m) =>
      (m.display_name || '').toLowerCase().includes(q) ||
      m.code.toLowerCase().includes(q) ||
      (m.countries || []).some((c) => c.toLowerCase().includes(q)),
    );
  }, [markets, query]);

  // Group filtered markets per macro_region, preserve groups order
  const filteredGroups = useMemo(() => {
    const filteredCodes = new Set(filtered.map((m) => m.code));
    return marketGroups
      .map((g) => ({
        ...g,
        markets: g.markets.filter((code) => filteredCodes.has(code)),
      }))
      .filter((g) => g.markets.length > 0);
  }, [marketGroups, filtered]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="market-modal-title"
      data-testid="market-modal"
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(10, 12, 16, 0.92)',
        backdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 1100, margin: '5vh auto 4rem',
          background: 'rgba(18,18,18,0.97)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 4,
          padding: '3rem 3rem 4rem',
          color: 'var(--mood-text-1)',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <p style={{
              fontFamily: 'Inter, sans-serif', fontSize: '0.72rem',
              letterSpacing: '0.22em', textTransform: 'uppercase',
              color: 'var(--mood-text-2)', marginBottom: '0.5rem',
            }}>
              <Globe size={12} strokeWidth={1.6} style={{ display:'inline', marginRight:8, marginTop:-2 }} />
              Mercato di riferimento
            </p>
            <h2
              id="market-modal-title"
              style={{
                fontFamily: 'DM Serif Display, serif',
                fontSize: '2rem', fontWeight: 400, lineHeight: 1.15,
                color: '#FFF', letterSpacing: '-0.01em',
              }}
            >
              Scegli il mercato MOOD.
            </h2>
            <p style={{
              fontFamily: 'Inter, sans-serif', fontSize: '0.92rem',
              color: 'var(--mood-text-2)', marginTop: '0.8rem',
              maxWidth: 560, lineHeight: 1.55,
            }}>
              Ogni mercato definisce lingua, valuta, advisor di riferimento e
              il modo in cui MOOD si presenta al tuo studio.
            </p>
          </div>
          <button
            onClick={onClose}
            data-testid="market-modal-close"
            aria-label="Chiudi"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--mood-text-2)', padding: '0.5rem',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#FFF')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--mood-text-2)')}
          >
            <X size={22} strokeWidth={1.4} />
          </button>
        </div>

        {/* Search */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '0.85rem 1.2rem', borderRadius: 4,
            marginBottom: '2.5rem',
          }}
        >
          <Search size={16} strokeWidth={1.5} color="var(--mood-text-2)" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per mercato, paese (IT, US, AE…)"
            data-testid="market-modal-search"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontFamily: 'Inter, sans-serif', fontSize: '0.95rem',
              color: '#FFF',
            }}
          />
        </div>

        {/* Loading state */}
        {!ready && (
          <p style={{ color: 'var(--mood-text-2)', fontFamily: 'Inter, sans-serif' }}>
            Caricamento mercati…
          </p>
        )}

        {/* Empty state after search */}
        {ready && filteredGroups.length === 0 && (
          <p style={{ color: 'var(--mood-text-2)', fontFamily: 'Inter, sans-serif' }}>
            Nessun mercato corrisponde a “{query}”.
          </p>
        )}

        {/* Groups grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {filteredGroups.map((grp) => {
            const groupMarkets = grp.markets
              .map((code) => markets.find((m) => m.code === code))
              .filter(Boolean)
              .sort((a, b) => a.sort_order - b.sort_order);
            return (
              <div key={grp.key} data-testid={`market-group-${grp.key}`}>
                <p style={{
                  fontFamily: 'Inter, sans-serif', fontSize: '0.7rem',
                  letterSpacing: '0.2em', textTransform: 'uppercase',
                  color: 'var(--mood-text-3)', marginBottom: '1.4rem',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  paddingBottom: '0.7rem',
                }}>
                  {grp.key.replace(/_/g, ' ')}
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {groupMarkets.map((m) => {
                    const isCurrent = market?.code === m.code;
                    return (
                      <li key={m.code}>
                        <button
                          onClick={() => { setMarket(m.code); onClose(); }}
                          data-testid={`market-option-${m.code}`}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'baseline',
                            justifyContent: 'space-between', gap: 12,
                            padding: '0.75rem 0',
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: isCurrent ? 'var(--mood-teal, #00C9B3)' : '#FFF',
                            fontFamily: 'Inter, sans-serif',
                            textAlign: 'left',
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            transition: 'color 0.15s',
                          }}
                          onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.color = 'var(--mood-teal, #00C9B3)'; }}
                          onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.color = '#FFF'; }}
                        >
                          <span style={{ fontWeight: isCurrent ? 600 : 400, fontSize: '0.94rem' }}>
                            {m.display_name || m.code}
                          </span>
                          <span style={{
                            fontSize: '0.7rem', letterSpacing: '0.06em',
                            color: 'var(--mood-text-3)', fontFamily: 'Inter, sans-serif',
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                          }}>
                            <span>{m.effective_locale}</span>
                            <span style={{ opacity: 0.4 }}>·</span>
                            <span>{m.currency}</span>
                            {isCurrent && <Check size={13} strokeWidth={2} color="var(--mood-teal, #00C9B3)" />}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MarketSelectorModal;
