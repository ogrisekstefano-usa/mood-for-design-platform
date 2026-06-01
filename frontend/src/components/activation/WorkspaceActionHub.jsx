/**
 * WorkspaceActionHub™ — ITER181.A.2
 *
 * Blocco operativo unico sotto l'Hero. Sostituisce le sezioni separate
 * "Activation Foundation" + "Quick Actions" con un singolo contenitore.
 *
 * Modes:
 *   - "setup"      → header con progress bar + body 70/30 (Checklist | Quick Actions)
 *   - "ready"      → header "Workspace Ready" + Quick Actions full-width
 *   - "contextual" → reserved (P2) — restituisce null in questa iterazione
 *
 * Architettura predisposta per futura Next-Best-Action engine.
 * NO chiamate backend, NO nuove API: usa solo dati di useActivationFoundation.
 */
import React from 'react';
import {
  CheckCircle2, Circle, ArrowRight, Sparkles,
  UserPlus, Compass, FolderOpen, CalendarRange, Users,
} from 'lucide-react';
import { useActivationFoundation } from '../../hooks/useActivationFoundation';
import { useSmartCtaRouter } from '../../hooks/useSmartCtaRouter';

// ── Quick Actions catalogue (permanente, sempre disponibile) ─────
const QUICK_ACTIONS = [
  {
    key: 'new-relationship',
    icon: UserPlus,
    label: 'Nuova Relazione',
    description: 'Registra un Lead e apri la Discovery.',
    route: 'modal:new-relationship',
  },
  {
    key: 'new-journey',
    icon: Compass,
    label: 'Nuovo Design Journey',
    description: 'Crea una Journey su un Prospect.',
    route: 'modal:new-relationship',
    opts: { choice: 'prospect' },
  },
  {
    key: 'media-library',
    icon: FolderOpen,
    label: 'Media Library',
    description: 'Immagini, prodotti, riferimenti.',
    route: '/library',
  },
  {
    key: 'editorial-calendar',
    icon: CalendarRange,
    label: 'Calendario Editoriale',
    description: 'Pianifica contenuti e cadenze.',
    route: '/editorial/calendar',
  },
  {
    key: 'team',
    icon: Users,
    label: 'Team',
    description: 'Membri, ruoli e permessi.',
    route: '/settings/members',
  },
];

// ── Public component (mode-switch) ───────────────────────────────
export default function WorkspaceActionHub({ mode }) {
  const { data } = useActivationFoundation();
  // Auto-detect mode if not forced by caller.
  const resolvedMode = mode || (data?.activated ? 'ready' : 'setup');

  if (resolvedMode === 'contextual') {
    // Reserved for future Next-Best-Action engine.
    return null;
  }
  if (resolvedMode === 'ready') {
    return <HubReady />;
  }
  return <HubSetup />;
}

// ── Setup mode (completion < 100%) ───────────────────────────────
function HubSetup() {
  const { data } = useActivationFoundation();
  const route = useSmartCtaRouter();
  if (!data) return null;
  const { items, completed, total, progress } = data;

  return (
    <section
      className="atd-section"
      data-testid="dashboard-workspace-hub"
      data-hub-mode="setup"
    >
      <div className="atd-hub" data-testid="workspace-hub-card">
        <header
          className="atd-hub__header"
          data-testid="workspace-hub-header"
        >
          <div className="atd-hub__header-row">
            <p className="atd-hub__eyebrow">Setup Workspace</p>
            <p
              className="atd-hub__counter"
              data-testid="workspace-hub-counter"
            >
              {completed}/{total} completati
            </p>
          </div>
          <div className="atd-hub__bar">
            <div
              data-testid="workspace-hub-progress"
              className="atd-hub__bar-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </header>

        <div className="atd-hub__body atd-hub__body--setup">
          {/* 70% · Checklist */}
          <div
            className="atd-hub__col atd-hub__col--checklist"
            data-testid="workspace-hub-checklist"
          >
            <p className="atd-hub__col-eyebrow">Checklist</p>
            <ul className="atd-hub__list">
              {items.map((item) => (
                <li
                  key={item.key}
                  className="atd-hub__item"
                  data-testid={`activation-step-${item.key}`}
                  data-step-done={item.done ? 'true' : 'false'}
                >
                  <span className="atd-hub__item-icon">
                    {item.done
                      ? <CheckCircle2 size={17} strokeWidth={1.6} />
                      : <Circle size={17} strokeWidth={1.4} />}
                  </span>
                  <span className="atd-hub__item-body">
                    <span className="atd-hub__item-title">
                      <span className="atd-hub__item-ordinal">{item.ordinal}.</span>
                      {item.title}
                    </span>
                    <span className="atd-hub__item-desc">{item.description}</span>
                    {!item.done && item.metadata?.missing?.length > 0 && (
                      <span className="atd-hub__item-missing">
                        Da completare: {item.metadata.missing.join(', ')}
                      </span>
                    )}
                  </span>
                  {!item.done && (
                    <button
                      type="button"
                      data-testid={`activation-step-${item.key}-cta`}
                      className="atd-hub__item-cta"
                      onClick={() => route(item.cta_route)}
                    >
                      {item.cta_label} <ArrowRight size={11} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* 30% · Quick Actions list */}
          <div
            className="atd-hub__col atd-hub__col--actions"
            data-testid="workspace-hub-quick-actions"
          >
            <p className="atd-hub__col-eyebrow">Azioni rapide</p>
            <ul className="atd-hub__actions-list">
              {QUICK_ACTIONS.map((a) => {
                const Icon = a.icon;
                return (
                  <li key={a.key}>
                    <button
                      type="button"
                      className="atd-hub__action-row"
                      data-testid={`quick-action-${a.key}`}
                      onClick={() => route(a.route, a.opts || {})}
                    >
                      <span className="atd-hub__action-icon">
                        <Icon size={14} strokeWidth={1.6} />
                      </span>
                      <span className="atd-hub__action-label">{a.label}</span>
                      <ArrowRight
                        size={12}
                        strokeWidth={1.7}
                        className="atd-hub__action-arrow"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Ready mode (completion = 100%) ───────────────────────────────
function HubReady() {
  const route = useSmartCtaRouter();
  return (
    <section
      className="atd-section"
      data-testid="dashboard-workspace-hub"
      data-hub-mode="ready"
    >
      <div className="atd-hub" data-testid="workspace-hub-card">
        <header
          className="atd-hub__ready"
          data-testid="workspace-hub-ready"
        >
          <Sparkles size={16} strokeWidth={1.7} className="atd-hub__ready-icon" />
          <div>
            <p className="atd-hub__eyebrow">Workspace Ready</p>
            <p className="atd-hub__ready-text">
              Lo studio è configurato e operativo.
            </p>
          </div>
        </header>

        <div className="atd-hub__body atd-hub__body--ready">
          <p className="atd-hub__col-eyebrow">Azioni rapide</p>
          <div className="atd-hub__actions-rail" data-testid="workspace-hub-quick-actions">
            {QUICK_ACTIONS.map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.key}
                  type="button"
                  className="atd-hub__action-card"
                  data-testid={`quick-action-${a.key}`}
                  onClick={() => route(a.route, a.opts || {})}
                >
                  <span className="atd-hub__action-icon">
                    <Icon size={14} strokeWidth={1.6} />
                  </span>
                  <span className="atd-hub__action-body">
                    <span className="atd-hub__action-label">{a.label}</span>
                    <span className="atd-hub__action-desc">{a.description}</span>
                  </span>
                  <ArrowRight
                    size={12}
                    strokeWidth={1.7}
                    className="atd-hub__action-arrow"
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
