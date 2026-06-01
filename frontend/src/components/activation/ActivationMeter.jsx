/**
 * ActivationMeter™ + WorkspaceActivationChecklist™
 * ITER180 · AF2 + AF3 → ITER181.A.1 layout optimization
 *
 * Layout: single full-width card.
 *   - ActivationMeter renders a slim HEADER (eyebrow + bar + "N/total completati")
 *   - WorkspaceActivationChecklist renders the BODY (steps + inline CTAs)
 * Entrambi usano i token canonici del Design System (atelier-dashboard.css).
 */
import React from 'react';
import { CheckCircle2, Circle, ArrowRight, Sparkles } from 'lucide-react';
import { useActivationFoundation } from '../../hooks/useActivationFoundation';
import { useSmartCtaRouter } from '../../hooks/useSmartCtaRouter';

// ── ActivationMeter (slim header inside the full-width card) ─────
export function ActivationMeter({ compact = false }) {
  const { data } = useActivationFoundation();
  if (!data) return null;
  const { completed, total, activated, progress } = data;

  if (compact) {
    return (
      <span
        data-testid="activation-meter-compact"
        className="atd-activation__meter-badge"
      >
        {activated ? <Sparkles size={11} /> : null}
        {activated ? 'Workspace Activated™' : `Setup ${completed}/${total}`}
      </span>
    );
  }

  return (
    <div data-testid="activation-meter" className="atd-activation__header">
      <div className="atd-activation__header-row">
        <p className="atd-activation__header-eyebrow">Setup Workspace</p>
        <p className="atd-activation__header-counter" data-testid="activation-meter-counter">
          {completed}/{total} completati
        </p>
      </div>
      <div className="atd-activation__meter-bar">
        <div
          data-testid="activation-meter-progress"
          className="atd-activation__meter-bar-fill"
          style={{ width: `${progress}%` }}
        />
      </div>
      {activated && (
        <span className="atd-activation__meter-badge" style={{ marginTop: 10 }}>
          <Sparkles size={11} /> Workspace Activated™
        </span>
      )}
    </div>
  );
}

// ── WorkspaceActivationChecklist (body of the same card) ─────────
export function WorkspaceActivationChecklist() {
  const { data } = useActivationFoundation();
  const route = useSmartCtaRouter();
  if (!data) return null;
  const { items, activated } = data;

  if (activated) {
    return (
      <div data-testid="activation-checklist-completed" className="atd-activation__activated">
        <Sparkles size={18} className="atd-activation__activated-icon" />
        <p className="atd-activation__activated-title">Workspace Activated™</p>
        <p className="atd-activation__activated-desc">
          Setup completato. I moduli avanzati sono ora abilitati.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="activation-checklist" className="atd-activation__checklist">
      <ul className="atd-activation__list">
        {items.map((item) => (
          <li
            key={item.key}
            className="atd-activation__item"
            data-testid={`activation-step-${item.key}`}
            data-step-done={item.done ? 'true' : 'false'}
          >
            <div className="atd-activation__item-icon">
              {item.done
                ? <CheckCircle2 size={18} strokeWidth={1.6} />
                : <Circle size={18} strokeWidth={1.4} />}
            </div>
            <div className="atd-activation__item-body">
              <p className="atd-activation__item-title">
                <span className="atd-activation__item-ordinal">{item.ordinal}.</span>
                {item.title}
              </p>
              <p className="atd-activation__item-desc">{item.description}</p>
              {!item.done && item.metadata?.missing && item.metadata.missing.length > 0 && (
                <p className="atd-activation__item-missing">
                  Da completare: {item.metadata.missing.join(', ')}
                </p>
              )}
            </div>
            {!item.done && (
              <button
                type="button"
                data-testid={`activation-step-${item.key}-cta`}
                className="atd-activation__item-cta"
                onClick={() => route(item.cta_route)}
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
