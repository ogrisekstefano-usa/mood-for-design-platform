/**
 * DiscoveryProgressWidget — ITER185 · Phase 1
 *
 * Visual progress with named checklist (Founder UX preference: section names
 * over % text). Used in LeadDetailPage hero, DiscoveryInterviewPanel header,
 * and LeadsPage row hover.
 *
 * Props:
 *   - progress: { progress_pct, sections, qualify_eligible }
 *   - compact?: boolean — single-line mini bar (LeadsPage row)
 *   - showSections?: boolean — show named checklist (default: true on detail)
 */
import React from 'react';

export default function DiscoveryProgressWidget({ progress, compact = false, showSections = true }) {
  if (!progress) return null;
  const pct = Number(progress.progress_pct ?? 0);
  const sections = progress.sections || [];
  const eligible = progress.qualify_eligible;

  if (compact) {
    return (
      <div
        data-testid="discovery-progress-mini"
        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
      >
        <div
          style={{
            flex: 1, minWidth: 80, maxWidth: 140,
            height: 4, background: '#e9eaed', borderRadius: 2, overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${pct}%`, height: '100%',
              background: pct >= 75 ? '#0c6e3f' : pct >= 50 ? '#b5680a' : '#9b9da3',
              transition: 'width 240ms ease',
            }}
          />
        </div>
        <span style={{ fontSize: 11, color: '#5a5d62', letterSpacing: '0.02em', minWidth: 32 }}>
          {pct}%
        </span>
      </div>
    );
  }

  return (
    <div
      data-testid="discovery-progress-widget"
      style={{
        background: '#ffffff',
        border: '1px solid #e9eaed',
        borderRadius: 12,
        padding: '16px 18px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <span style={{ fontSize: 11, letterSpacing: '0.08em', color: '#9b9da3', textTransform: 'uppercase' }}>
          Discovery
        </span>
        <span
          data-testid="discovery-progress-pct"
          style={{
            fontSize: 13, fontWeight: 500,
            color: pct >= 75 ? '#0c6e3f' : '#3a3d44',
          }}
        >
          {pct}%
        </span>
      </div>

      {/* Visual bar */}
      <div
        style={{
          height: 6, background: '#e9eaed', borderRadius: 3, overflow: 'hidden',
          marginBottom: 14,
        }}
      >
        <div
          data-testid="discovery-progress-bar"
          style={{
            width: `${pct}%`, height: '100%',
            background: pct >= 75 ? '#0c6e3f' : pct >= 50 ? '#b5680a' : '#3a3d44',
            transition: 'width 320ms ease',
          }}
        />
      </div>

      {showSections && (
        <ul
          data-testid="discovery-progress-sections"
          style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}
        >
          {sections.map((s) => (
            <li
              key={s.key}
              data-testid={`discovery-section-${s.key}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 12, color: s.completed ? '#3a3d44' : '#9b9da3',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 14, height: 14, borderRadius: 3,
                  border: '1px solid #c8cad0',
                  background: s.completed ? '#0c6e3f' : '#ffffff',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  color: '#ffffff', fontSize: 10, fontWeight: 700, lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                {s.completed ? '✓' : ''}
              </span>
              <span style={{ textDecoration: s.completed ? 'none' : 'none' }}>
                {s.label}
              </span>
            </li>
          ))}
        </ul>
      )}

      {eligible && (
        <div
          data-testid="discovery-qualify-hint"
          style={{
            marginTop: 12, padding: '8px 10px',
            background: '#e8f1e9', border: '1px solid #b5dac0', borderRadius: 6,
            fontSize: 11, color: '#0c6e3f', letterSpacing: '0.01em',
          }}
        >
          Pronto per qualifica. Promuovi a Prospect quando vuoi.
        </div>
      )}
    </div>
  );
}
