/**
 * MarketCardGrid — visual card picker for the MOOD Operating Market.
 *
 * Replaces the native <select> with a responsive grid of selectable
 * cards. Each card shows the flag-cluster icon (driven by the market's
 * `flag_clusters` if available, else single label) and the localized
 * market label. No technical codes are rendered.
 *
 * Props:
 *   markets:  [{ code, label, flag?, region_hint?, default_locale? }]
 *   value:    selected market code
 *   onChange: (code: string) => void
 */
import React from 'react';

// Visual hint per market (emoji flag cluster). DB-driven labels are
// always used; this is only the icon that appears on the card.
// If a market is added/removed from DB the only thing missing is its
// icon, defaulting to a globe. Adding a new market: no code change.
const MARKET_FLAG = {
  italy:              '🇮🇹',
  dach:               '🇩🇪',
  france_fr_europe:   '🇫🇷',
  uk_ireland:         '🇬🇧',
  spain_iberian:      '🇪🇸',
  scandinavia:        '🇸🇪',
  usa_national:       '🇺🇸',
  usa_east_coast:     '🇺🇸',
  usa_west_coast:     '🇺🇸',
  usa_south_florida:  '🇺🇸',
  usa_midwest:        '🇺🇸',
  usa_mountain_central:'🇺🇸',
  gcc_luxury:         '🇦🇪',
  spanish_latam:      '🌎',
  spanish_mexico:     '🇲🇽',
  brazil:             '🇧🇷',
  central_america:    '🌎',
};

const MarketCard = ({ market, selected, onClick }) => (
  <button type="button" onClick={onClick}
    data-testid={`market-card-${market.code}`}
    aria-pressed={selected}
    style={{
      position: 'relative',
      display: 'flex', flexDirection: 'column',
      alignItems: 'flex-start', justifyContent: 'flex-start',
      gap: 14, padding: '20px 18px',
      background: selected ? 'rgba(0,201,179,0.08)' : 'rgba(255,255,255,0.025)',
      border: '1px solid ' + (selected ? 'var(--mood-teal, #00C9B3)' : 'rgba(255,255,255,0.08)'),
      borderRadius: 10,
      color: 'var(--mood-text-1, #F4F4F5)',
      cursor: 'pointer', fontFamily: 'inherit',
      textAlign: 'left',
      minHeight: 108,
      transition: 'border-color 180ms ease, background 180ms ease',
    }}>
    {selected && (
      <span aria-hidden="true" style={{
        position: 'absolute', top: 12, right: 12,
        width: 18, height: 18, borderRadius: 999,
        background: 'var(--mood-teal, #00C9B3)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, color: '#0A0A0B', fontWeight: 700,
      }}>✓</span>
    )}
    <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>{MARKET_FLAG[market.code] || '🌐'}</span>
    <span style={{
      fontSize: '1.02rem', fontWeight: 500, lineHeight: 1.25,
    }}>{market.label}</span>
  </button>
);

const MarketCardGrid = ({ markets, value, onChange }) => {
  if (!markets || markets.length === 0) return null;
  return (
    <div data-testid="market-card-grid" style={{
      display: 'grid', gap: 12,
      gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
    }}>
      {markets.map((m) => (
        <MarketCard key={m.code} market={m}
          selected={m.code === value}
          onClick={() => onChange(m.code)} />
      ))}
    </div>
  );
};

export default MarketCardGrid;
