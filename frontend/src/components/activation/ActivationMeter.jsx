/**
 * ActivationMeter™ + WorkspaceActivationChecklist™ — ITER180 · AF2 + AF3
 *
 * - ActivationMeter: widget compatto con %, badge "Activated" quando 6/6
 * - WorkspaceActivationChecklist: dettaglio in-card con 6 step + CTA Smart
 */
import React from 'react';
import { CheckCircle2, Circle, ArrowRight, Sparkles } from 'lucide-react';
import { useActivationFoundation } from '../../hooks/useActivationFoundation';
import { useSmartCtaRouter } from '../../hooks/useSmartCtaRouter';

// ── ActivationMeter (compact) ──────────────────────────────────────
export function ActivationMeter({ compact = false }) {
  const { data } = useActivationFoundation();
  if (!data) return null;
  const { completed, total, activated, progress } = data;

  if (compact) {
    return (
      <div
        data-testid="activation-meter-compact"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '4px 10px', background: activated ? '#dcfce7' : '#f1f1f3',
          color: activated ? '#15803d' : '#0c0e12',
          borderRadius: 999, fontSize: 11, fontWeight: 500, letterSpacing: '0.04em',
        }}
      >
        {activated ? <Sparkles size={12} /> : null}
        <span>{activated ? 'Workspace Activated' : `Activation ${completed}/${total}`}</span>
      </div>
    );
  }

  return (
    <div
      data-testid="activation-meter"
      style={{
        background: '#ffffff', border: '1px solid #e6e6e8', borderRadius: 12,
        padding: '20px 22px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7a7d83' }}>
            Activation Foundation™
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, marginTop: 2, color: '#0c0e12' }}>
            {completed} / {total} step
          </div>
        </div>
        {activated && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', background: '#dcfce7', color: '#15803d',
            borderRadius: 999, fontSize: 11, fontWeight: 500,
          }}>
            <Sparkles size={12} /> Workspace Activated
          </div>
        )}
      </div>
      <div style={{
        height: 6, borderRadius: 3, background: '#f1f1f3', overflow: 'hidden',
      }}>
        <div
          data-testid="activation-meter-progress"
          style={{
            width: `${progress}%`, height: '100%',
            background: activated ? '#16a34a' : '#0c0e12',
            transition: 'width 320ms ease',
          }}
        />
      </div>
    </div>
  );
}

// ── WorkspaceActivationChecklist (full panel) ─────────────────────
export function WorkspaceActivationChecklist() {
  const { data } = useActivationFoundation();
  const route = useSmartCtaRouter();
  if (!data) return null;
  const { items, activated } = data;

  if (activated) {
    return (
      <div
        data-testid="activation-checklist-completed"
        style={{
          background: '#ffffff', border: '1px solid #dcfce7', borderRadius: 12,
          padding: 22, color: '#15803d',
        }}
      >
        <Sparkles size={18} />
        <div style={{ fontSize: 16, fontWeight: 600, marginTop: 8, color: '#0c0e12' }}>
          Workspace Activated™
        </div>
        <div style={{ fontSize: 13, color: '#5a5d63', marginTop: 4 }}>
          Lo studio ha completato tutti i 6 passi della Foundation. I moduli avanzati sono ora abilitati.
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="activation-checklist"
      style={{
        background: '#ffffff', border: '1px solid #e6e6e8', borderRadius: 12,
        padding: '8px 0',
      }}
    >
      <div style={{ padding: '12px 22px 8px', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7a7d83', fontWeight: 600 }}>
        Cosa fare adesso
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {items.map((item) => (
          <li
            key={item.key}
            data-testid={`activation-step-${item.key}`}
            data-step-done={item.done ? 'true' : 'false'}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: '12px 22px',
              borderTop: '1px solid #f1f1f3',
              opacity: item.done ? 0.65 : 1,
            }}
          >
            <div style={{ flexShrink: 0, paddingTop: 2 }}>
              {item.done
                ? <CheckCircle2 size={18} color="#16a34a" strokeWidth={1.6} />
                : <Circle size={18} color="#9b9da3" strokeWidth={1.4} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 14, fontWeight: 500, color: '#0c0e12',
                textDecoration: item.done ? 'line-through' : 'none',
              }}>
                <span style={{ opacity: 0.6, marginRight: 8 }}>{item.ordinal}.</span>
                {item.title}
              </div>
              <div style={{ fontSize: 12, color: '#5a5d63', marginTop: 2 }}>
                {item.description}
              </div>
              {!item.done && item.metadata?.missing && item.metadata.missing.length > 0 && (
                <div style={{ fontSize: 11, color: '#92400e', marginTop: 6 }}>
                  Manca: {item.metadata.missing.join(', ')}
                </div>
              )}
            </div>
            {!item.done && (
              <button
                data-testid={`activation-step-${item.key}-cta`}
                onClick={() => route(item.cta_route)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '6px 12px', background: '#0c0e12', color: '#ffffff',
                  border: 0, borderRadius: 6, cursor: 'pointer',
                  fontSize: 12, fontWeight: 500, flexShrink: 0,
                }}
              >
                {item.cta_label} <ArrowRight size={11} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
