/**
 * RecommendedActions — ITER181.A · Phase 3
 *                    → ITER181.A.1 compact Quick Actions rail
 *
 * 5 card compatte in una sola riga (desktop). Altezza ≤ 140px.
 * Icona inline, 1 riga di descrizione, CTA inline. Bassa enfasi visiva:
 * non devono dominare la dashboard.
 */
import React from 'react';
import { UserPlus, UserCheck, Compass, FolderOpen, CalendarRange, ArrowRight } from 'lucide-react';
import { useSmartCtaRouter } from '../../hooks/useSmartCtaRouter';

const ACTIONS = [
  {
    key: 'register-lead',
    icon: UserPlus,
    label: 'Registra un Lead',
    description: 'Apri una Nuova Relazione.',
    route: 'modal:new-relationship',
    opts: { choice: 'lead' },
  },
  {
    key: 'qualify-prospect',
    icon: UserCheck,
    label: 'Qualifica un Prospect',
    description: 'Promuovi un Lead dopo la Discovery.',
    route: '/relations/leads',
  },
  {
    key: 'open-journey',
    icon: Compass,
    label: 'Apri una Design Journey',
    description: 'Crea una Journey su un Prospect.',
    route: 'modal:new-relationship',
    opts: { choice: 'prospect' },
  },
  {
    key: 'upload-materials',
    icon: FolderOpen,
    label: 'Carica materiali',
    description: 'Immagini, prodotti, riferimenti.',
    route: '/library',
  },
  {
    key: 'editorial-calendar',
    icon: CalendarRange,
    label: 'Calendario editoriale',
    description: 'Pianifica contenuti e cadenze.',
    route: '/editorial/calendar',
  },
];

export default function RecommendedActions() {
  const route = useSmartCtaRouter();
  return (
    <div className="atd-recommended" data-testid="dashboard-recommended-actions-grid">
      {ACTIONS.map((a) => {
        const Icon = a.icon;
        return (
          <button
            key={a.key}
            type="button"
            className="atd-recommended__card"
            data-testid={`recommended-action-${a.key}`}
            onClick={() => route(a.route, a.opts || {})}
          >
            <span className="atd-recommended__icon">
              <Icon size={14} strokeWidth={1.6} />
            </span>
            <span className="atd-recommended__body">
              <span className="atd-recommended__label">{a.label}</span>
              <span className="atd-recommended__desc">{a.description}</span>
            </span>
            <ArrowRight size={12} strokeWidth={1.7} className="atd-recommended__arrow" />
          </button>
        );
      })}
    </div>
  );
}
