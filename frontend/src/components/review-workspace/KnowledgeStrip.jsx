/**
 * Knowledge Strip — V3 persistent top bar.
 * Shows brand name, 6 live metrics with delta indicators, validation
 * badge and Knowledge Score. Reads from the V3 endpoints exposed by
 * the parent (no extra fetches).
 */
import React from 'react';

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('it-IT') : (n ?? '—'));

export default function KnowledgeStrip({
  brandName,
  metrics = {},   // { pages, products, designers, materials, images, relations }
  deltas = {},    // optional same-keyed deltas
  score = null,   // 0-100
  needsValidation = 0,
  certMetrics = null,   // KE-004 · P0-4 · certification ledger metrics
}) {
  const items = [
    { key: 'pages', label: 'Pagine' },
    { key: 'products', label: 'Prodotti' },
    { key: 'designers', label: 'Designer' },
    { key: 'materials', label: 'Materiali' },
    { key: 'images', label: 'Immagini' },
    { key: 'relations', label: 'Relazioni' },
  ];

  // KE-004 · P0-4 · Format certification time human-readable
  const fmtTime = (sec) => {
    if (!sec || sec < 60) return `${sec || 0}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)} min`;
    if (sec < 86400) return `${Math.floor(sec / 3600)} h ${Math.floor((sec % 3600) / 60)} min`;
    return `${Math.floor(sec / 86400)} g ${Math.floor((sec % 86400) / 3600)} h`;
  };
  const hasCert = certMetrics && certMetrics.decisions_count > 0;

  return (
    <header className="rw-strip" data-testid="rw-v3-knowledge-strip">
      <div className="rw-strip__brand">
        <span>{brandName || 'Brand'}</span>
        <small style={{ marginLeft: 8 }}>Knowledge Package™</small>
      </div>
      <div className="rw-strip__metrics">
        {items.map((it) => (
          <div className="rw-metric" key={it.key} data-testid={`rw-metric-${it.key}`}>
            <span>{it.label}</span>
            <span className="rw-metric__val">{fmt(metrics[it.key])}</span>
            {deltas[it.key] ? (
              <span className="rw-metric__delta">+{deltas[it.key]}</span>
            ) : null}
          </div>
        ))}

        {/* KE-004 · P0-4 · Certification Metrics (tre celle live) */}
        {hasCert && (
          <>
            <span className="rw-metric__sep" aria-hidden />
            <div className="rw-metric rw-metric--cert" data-testid="rw-metric-decisions">
              <span>Decisioni</span>
              <span className="rw-metric__val">{fmt(certMetrics.decisions_count)}</span>
            </div>
            <div className="rw-metric rw-metric--cert" data-testid="rw-metric-propagated">
              <span>Propagate</span>
              <span className="rw-metric__val">{fmt(certMetrics.propagated_count)}</span>
            </div>
            <div className="rw-metric rw-metric--cert" data-testid="rw-metric-cert-time">
              <span>Tempo cert.</span>
              <span className="rw-metric__val">{fmtTime(certMetrics.certification_seconds)}</span>
            </div>
          </>
        )}
      </div>
      <div className="rw-strip__badges">
        {needsValidation > 0 && (
          <span className="rw-badge" data-testid="rw-needs-validation">
            <span className="rw-badge__dot" />
            {needsValidation} da validare
          </span>
        )}
        {score !== null && (
          <span className="rw-badge rw-badge--score" data-testid="rw-knowledge-score">
            Score · <strong className="rw-mono">{score}%</strong>
          </span>
        )}
      </div>
    </header>
  );
}
