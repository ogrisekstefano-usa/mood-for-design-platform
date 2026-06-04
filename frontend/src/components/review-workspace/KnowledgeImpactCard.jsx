/**
 * Knowledge Impact Card — V3.
 * Shows the ROI payload returned by /apply-correction.
 * Renders only when an impact is present (post-approval feedback).
 */
import React from 'react';

const ROWS = [
  { key: 'products_improved', label: 'prodotti migliorati' },
  { key: 'images_linked', label: 'immagini collegate' },
  { key: 'future_moodboards_unlocked', label: 'moodboard future disponibili' },
  { key: 'materials_consolidated', label: 'materiale consolidato' },
  { key: 'designers_consolidated', label: 'designer consolidato' },
];

export default function KnowledgeImpactCard({ impact, occurrences }) {
  if (!impact) return null;
  const visible = ROWS.filter((r) => (impact[r.key] || 0) > 0);
  if (visible.length === 0 && !occurrences) return null;

  return (
    <div className="rw-impact" data-testid="rw-knowledge-impact-card">
      <div className="rw-impact__title">
        Impatto sull'Ecosistema MOOD
        {occurrences ? ` · ${occurrences} occorrenze corrette` : ''}
      </div>
      <ul className="rw-impact__list">
        {visible.map((r) => (
          <li key={r.key} data-testid={`rw-impact-${r.key}`}>
            <span className="rw-impact__delta">+{impact[r.key]}</span>
            <span>{r.label}</span>
          </li>
        ))}
        {visible.length === 0 && (
          <li style={{ color: 'var(--rw-text-muted)', fontSize: 11 }}>
            Nessun delta osservabile per questa correzione.
          </li>
        )}
      </ul>
    </div>
  );
}
