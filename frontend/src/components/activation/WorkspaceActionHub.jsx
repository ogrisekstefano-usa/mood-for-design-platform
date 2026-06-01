/**
 * WorkspaceActionHub™ — ITER181.A.2 → ITER181.A.3 (UX & Business Logic)
 *
 * Blocco operativo unico sotto l'Hero. Sostituisce le sezioni separate
 * "Activation Foundation" + "Quick Actions" con un singolo contenitore.
 *
 * Modes:
 *   - "setup"      → header con progress bar + body 70/30 (Checklist | Quick Actions)
 *   - "ready"      → header "Workspace Operativo" + Quick Actions full-width
 *   - "contextual" → reserved (P2) — restituisce null in questa iterazione
 *
 * ITER181.A.3:
 *   - "Nuova Relazione" → "Nuovo Contatto" (lessico operativo per showroom/sales)
 *   - Quick Actions DINAMICHE basate su business_counts (4 scenari A/B/C/D)
 *   - Team rimosso dalle Quick Actions (è configurazione, non operatività)
 *   - Material View + Moodboard + Blueprint Chameleon come azioni aggiuntive
 *   - Ready mode label "Workspace Operativo"
 * NO chiamate backend, NO nuove API: usa solo dati di useActivationFoundation.
 */
import React from 'react';
import {
  CheckCircle2, Circle, ArrowRight, Sparkles,
  UserPlus, UserCheck, Compass, FolderOpen, CalendarRange,
  Layers, Image as ImageIcon, FolderTree,
} from 'lucide-react';
import { useActivationFoundation } from '../../hooks/useActivationFoundation';
import { useSmartCtaRouter } from '../../hooks/useSmartCtaRouter';

// ── Action library (route audit pass — tutti i path verificati in App.js) ─
const A = {
  newLead: {
    key: 'new-lead',
    icon: UserPlus,
    label: 'Nuovo Lead',
    description: 'Registra un Lead e apri la Discovery.',
    route: 'modal:new-relationship',
    opts: { choice: 'lead' },
  },
  qualifyProspect: {
    key: 'qualify-prospect',
    icon: UserCheck,
    label: 'Qualifica Prospect',
    description: 'Promuovi un Lead dopo la Discovery.',
    route: '/relations/leads',
  },
  newJourney: {
    key: 'new-journey',
    icon: Compass,
    label: 'Nuovo Design Journey',
    description: 'Crea una Journey su un Prospect.',
    route: 'modal:new-relationship',
    opts: { choice: 'prospect' },
  },
  openJourney: {
    key: 'open-journey',
    icon: Compass,
    label: 'Apri Journey',
    description: 'Riprendi una Design Journey attiva.',
    route: '/workspace/projects',
  },
  mediaLibrary: {
    key: 'media-library',
    icon: FolderOpen,
    label: 'Media Library',
    description: 'Immagini, prodotti, riferimenti.',
    route: '/library',
  },
  materials: {
    key: 'materials',
    icon: FolderTree,
    label: 'Materiali',
    description: 'Catalogo prodotti e finiture.',
    route: '/library/materials',
  },
  materialView: {
    key: 'material-view',
    icon: Layers,
    label: 'Material View',
    description: 'Catalogo materiali e finiture.',
    route: '/library/materials',
  },
  moodboard: {
    key: 'moodboard',
    icon: ImageIcon,
    label: 'Moodboard',
    description: 'Costruisci moodboard editoriali.',
    route: '/moodboards',
  },
  editorialCalendar: {
    key: 'editorial-calendar',
    icon: CalendarRange,
    label: 'Calendario Editoriale',
    description: 'Pianifica contenuti e cadenze.',
    route: '/blueprint/editorial-calendar',
  },
};

/**
 * Priority function: dato lo stato del funnel CRM,
 * restituisce le Quick Actions ordinate per rilevanza.
 *
 * Scenario A — studio vuoto                : Nuovo Lead, Nuovo Design Journey, Media Library, Material View, Calendario
 * Scenario B — leads>0 & prospects=0       : Qualifica Prospect, Nuovo Lead, Media Library, Calendario
 * Scenario C — prospects>0 & journeys=0    : Nuovo Design Journey, Media Library, Material View, Calendario
 * Scenario D — journeys>0 (regime)         : Apri Journey, Nuovo Design Journey, Materiali, Moodboard, Calendario
 */
function getQuickActionsForState(biz) {
  const leads     = biz?.leads || 0;
  const prospects = biz?.prospects || 0;
  const journeys  = biz?.active_journeys || 0;

  if (journeys > 0) {
    // D
    return [A.openJourney, A.newJourney, A.materials, A.moodboard, A.editorialCalendar];
  }
  if (prospects > 0) {
    // C
    return [A.newJourney, A.mediaLibrary, A.materialView, A.editorialCalendar];
  }
  if (leads > 0) {
    // B
    return [A.qualifyProspect, A.newLead, A.mediaLibrary, A.editorialCalendar];
  }
  // A — empty studio: Nuovo Lead + Nuovo Design Journey + Media Library + Material View + Calendario Editoriale
  return [A.newLead, A.newJourney, A.mediaLibrary, A.materialView, A.editorialCalendar];
}

// ── Public component (mode-switch) ───────────────────────────────
export default function WorkspaceActionHub({ mode }) {
  const { data } = useActivationFoundation();
  // Auto-detect mode if not forced by caller.
  const resolvedMode = mode || (data?.activated ? 'ready' : 'setup');

  if (resolvedMode === 'contextual') {
    // Reserved for future enhancements (kept as architecture hook).
    return null;
  }
  if (resolvedMode === 'ready') {
    // ITER181.C: setup completato → il blocco scompare.
    // Le Quick Actions vengono renderizzate come sezione standalone full-width.
    return null;
  }
  return <HubSetup />;
}

/**
 * Standalone Quick Actions section.
 * - Setup mode in corso: NON renderizza (le actions vivono dentro il Hub).
 * - Setup completato:    renderizza full-width come sezione operativa.
 */
export function StandaloneQuickActions() {
  const { data } = useActivationFoundation();
  const route = useSmartCtaRouter();
  if (!data) return null;
  // Mostriamo le Quick Actions standalone SOLO dopo il completamento del setup.
  if (!data.activated) return null;
  const quickActions = getQuickActionsForState(data.business_counts);
  return (
    <section
      className="atd-section"
      data-testid="dashboard-quick-actions"
      data-hub-mode="ready-standalone"
    >
      <p className="atd-section__eyebrow">Quick Actions</p>
      <div className="atd-hub__actions-rail" data-testid="standalone-quick-actions-rail">
        {quickActions.map((a) => {
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
              <ArrowRight size={12} strokeWidth={1.7} className="atd-hub__action-arrow" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ── Setup mode (completion < 100%) ───────────────────────────────
function HubSetup() {
  const { data } = useActivationFoundation();
  const route = useSmartCtaRouter();
  if (!data) return null;
  const { items, completed, total, progress, business_counts } = data;
  const quickActions = getQuickActionsForState(business_counts);

  return (
    <section
      className="atd-section"
      data-testid="dashboard-workspace-hub"
      data-hub-mode="setup"
    >
      <div className="atd-hub" data-testid="workspace-hub-card">
        <header className="atd-hub__header" data-testid="workspace-hub-header">
          <div className="atd-hub__header-row">
            <p className="atd-hub__eyebrow">Setup Workspace</p>
            <p className="atd-hub__counter" data-testid="workspace-hub-counter">
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
          <div className="atd-hub__col atd-hub__col--checklist" data-testid="workspace-hub-checklist">
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

          {/* 30% · Quick Actions list (dynamic) */}
          <div className="atd-hub__col atd-hub__col--actions" data-testid="workspace-hub-quick-actions">
            <p className="atd-hub__col-eyebrow">Azioni rapide</p>
            <ul className="atd-hub__actions-list">
              {quickActions.map((a) => {
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
                      <ArrowRight size={12} strokeWidth={1.7} className="atd-hub__action-arrow" />
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

// HubReady removed in ITER181.C · Problem 9:
// after setup completion the hub disappears entirely;
// Quick Actions become a standalone full-width section
// rendered by <StandaloneQuickActions />.
