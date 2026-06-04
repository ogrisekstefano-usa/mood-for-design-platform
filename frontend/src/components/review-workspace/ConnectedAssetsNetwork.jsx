/**
 * Connected Assets™ Network — V3.
 * Hub-and-spoke SVG visualization of the entity's first-degree
 * relationships, grouped by entity type. Future-proof: shows empty
 * groups as 0 so the structure is always visible.
 */
import React, { useMemo } from 'react';

const TYPE_COLORS = {
  PRODUCT: '#00e5ff',
  MATERIAL: '#a78bfa',
  DESIGNER: '#f472b6',
  IMAGE: '#facc15',
  COLLECTION: '#00b4d8',
  BRAND: '#ededed',
  DOCUMENT: '#a1a1aa',
  PROJECT: '#52525b',
  MOODBOARD: '#52525b',
  JOURNEY: '#52525b',
};

const TYPE_LABELS = {
  PRODUCT: 'Prod', MATERIAL: 'Mat', DESIGNER: 'Des',
  IMAGE: 'Img', COLLECTION: 'Coll', BRAND: 'Brand',
  DOCUMENT: 'Doc', PROJECT: 'Proj', MOODBOARD: 'Mood', JOURNEY: 'Jour',
};

export default function ConnectedAssetsNetwork({ data, loading = false }) {
  const layout = useMemo(() => {
    if (!data) return [];
    const collected = [];
    const groups = data.groups || {};
    Object.entries(groups).forEach(([type, nodes]) => {
      (nodes || []).slice(0, 3).forEach((n) => {
        collected.push({ ...n, type });
      });
    });
    // Distribute up to 12 nodes around the center
    const max = Math.min(collected.length, 12);
    return collected.slice(0, 12).map((n, i) => {
      const angle = (2 * Math.PI * i) / Math.max(max, 1);
      const r = 80;
      return {
        ...n,
        x: 50 + Math.cos(angle) * r * 0.5,   // % units
        y: 50 + Math.sin(angle) * r * 0.5,
      };
    });
  }, [data]);

  if (loading) {
    return (
      <div className="rw-network" data-testid="rw-connected-loading">
        <div className="rw-network__title">Connected Assets™</div>
        <div style={{ fontSize: 11, color: 'var(--rw-text-muted)', textAlign: 'center', padding: 24 }}>
          Caricamento rete…
        </div>
      </div>
    );
  }
  if (!data) return null;

  const counts = data.counts || {};
  const totalRelations = data.total_relations || 0;

  return (
    <div className="rw-network" data-testid="rw-connected-assets-network">
      <div className="rw-network__title">Connected Assets™ · Brand Atlas</div>
      <svg className="rw-network__svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        {/* Wires */}
        {layout.map((n, i) => (
          <line
            key={`w-${i}`}
            x1="50" y1="50"
            x2={n.x} y2={n.y}
            stroke="rgba(0,229,255,0.25)"
            strokeWidth="0.3"
            strokeDasharray="1.2 1.2"
          />
        ))}
        {/* Surrounding nodes */}
        {layout.map((n, i) => (
          <g key={n.id || `n-${i}`}>
            <circle
              cx={n.x} cy={n.y} r="3.2"
              fill="rgba(10,10,10,0.95)"
              stroke={TYPE_COLORS[n.type] || '#a1a1aa'}
              strokeWidth="0.4"
            />
            <text
              x={n.x} y={n.y + 0.8}
              fontSize="1.6" textAnchor="middle"
              fill={TYPE_COLORS[n.type] || '#a1a1aa'}
              fontFamily="'JetBrains Mono', monospace"
            >
              {TYPE_LABELS[n.type] || '?'}
            </text>
          </g>
        ))}
        {/* Center node */}
        <circle cx="50" cy="50" r="5.5" fill="rgba(0,229,255,0.2)" stroke="#00e5ff" strokeWidth="0.6" />
        <text x="50" y="51" fontSize="2.2" textAnchor="middle" fill="#00e5ff" fontFamily="'Cormorant Garamond', serif">
          {(data.center?.label || '').slice(0, 14)}
        </text>
      </svg>
      <div className="rw-network__counts">
        {Object.entries(counts).map(([k, v]) => (
          <span key={k} className="rw-network__count">
            {k.charAt(0) + k.slice(1).toLowerCase()} <strong>{v}</strong>
          </span>
        ))}
        <span className="rw-network__count" style={{ width: '100%', textAlign: 'center', marginTop: 6 }}>
          Totale relazioni: <strong>{totalRelations}</strong>
        </span>
      </div>
    </div>
  );
}
