/**
 * Project Impact™ Card — M7 PLACEHOLDER.
 * Renders the foundation rows (residential / hospitality / retail /
 * office / home_staging) with all-zero counters. NO economic KPIs.
 */
import React from 'react';

const LABELS = {
  residential: 'Residenziale',
  hospitality: 'Hospitality',
  retail: 'Retail',
  office: 'Office',
  home_staging: 'Home Staging',
};

export default function ProjectImpactCard({ data, loading = false }) {
  if (loading) {
    return (
      <div className="rw-project-impact" data-testid="rw-project-impact-loading">
        <div className="rw-project-impact__title">Project Impact™</div>
        <div className="rw-project-impact__note">Caricamento…</div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="rw-project-impact" data-testid="rw-project-impact-card">
      <div className="rw-project-impact__title">Project Impact™</div>
      <div className="rw-project-impact__note">{data.note || 'M7 · foundation'}</div>
      <div className="rw-project-impact__grid">
        {(data.rows || []).map((r) => (
          <div
            className="rw-project-impact__row"
            key={r.project_type}
            data-testid={`rw-project-impact-${r.project_type}`}
          >
            <span className="rw-project-impact__label">
              {LABELS[r.project_type] || r.project_type}
            </span>
            <span className="rw-project-impact__value">{r.project_count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
