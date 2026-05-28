/**
 * AtmosphericPreviewPage · ITER168 internal QA surface
 *
 * Standalone preview of the Atmospheric Panels™ component, used by
 * the design team + QA to validate visual rendering without needing
 * a real client login.
 *
 * Mounted at `/dev/atmospheric-preview` (public, but the route is
 * intentionally under `/dev/*` so it never leaks into the client
 * narrative path).
 */
import React, { useState } from 'react';
import AtmosphericPanels from '../components/chameleon/AtmosphericPanels';
import '../components/chameleon/atmospheric-panels.css';

const AtmosphericPreviewPage = () => {
  const [market, setMarket] = useState('');
  const [tone, setTone]     = useState('');
  const [surface, setSurface] = useState('light'); // light | dark

  return (
    <div
      data-surface={surface}
      style={{
        minHeight: '100vh',
        background: surface === 'dark' ? '#0a0a0c' : '#F5F2ED',
        padding: '64px clamp(24px, 5vw, 88px)',
      }}
    >
      <header style={{ marginBottom: 32 }}>
        <p style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 10.5,
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          color: surface === 'dark' ? 'rgba(245,242,237,0.5)' : 'rgba(26,23,20,0.5)',
          margin: '0 0 6px',
        }}>
          ITER168 · QA
        </p>
        <h1 style={{
          fontFamily: 'Cormorant Garamond, serif',
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: 36,
          color: surface === 'dark' ? '#f5f2ed' : '#1a1714',
          margin: '0 0 24px',
        }}>
          Atmospheric Panels™ — preview
        </h1>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontFamily: 'Inter,sans-serif', fontSize: 12 }}>
          <select value={market} onChange={(e) => setMarket(e.target.value)} data-testid="atm-preview-market" style={{ padding: '8px 12px' }}>
            <option value="">All markets</option>
            <option value="IT">IT</option>
            <option value="US">US</option>
            <option value="AE">AE</option>
            <option value="FR">FR</option>
            <option value="CH">CH</option>
          </select>
          <select value={tone} onChange={(e) => setTone(e.target.value)} data-testid="atm-preview-tone" style={{ padding: '8px 12px' }}>
            <option value="">All tones</option>
            <option value="calm">calm</option>
            <option value="warm">warm</option>
            <option value="reflective">reflective</option>
            <option value="ceremonial">ceremonial</option>
            <option value="editorial">editorial</option>
            <option value="hospitality">hospitality</option>
            <option value="contemplative">contemplative</option>
          </select>
          <select value={surface} onChange={(e) => setSurface(e.target.value)} data-testid="atm-preview-surface" style={{ padding: '8px 12px' }}>
            <option value="light">light surface</option>
            <option value="dark">dark surface</option>
          </select>
        </div>
      </header>

      <AtmosphericPanels
        market={market || undefined}
        limit={6}
        eyebrow={tone ? `Atmosfere · ${tone}` : 'Quello che iniziamo a leggere'}
      />
    </div>
  );
};

export default AtmosphericPreviewPage;
