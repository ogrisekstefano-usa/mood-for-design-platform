/**
 * RecommendedActions — ITER181.A · Phase 3 → ITER181.C visual consolidation
 *
 * Card operative sotto Activation Foundation. Stesso linguaggio visuale
 * delle Project Cards: superfici dark, bordi sottili, accent cyan,
 * tipografia canonica. Nessun white-panel fuori contesto.
 */
import React from 'react';
import { UserPlus, UserCheck, Compass, FolderOpen, CalendarRange, ArrowRight } from 'lucide-react';
import { useSmartCtaRouter } from '../../hooks/useSmartCtaRouter';

const ACTIONS = [
  {
    key: 'register-lead',
    icon: UserPlus,
    label: 'Registra un Lead',
    description: 'Apri una Nuova Relazione e avvia la Discovery.',
    cta: 'Nuova Relazione',
    route: 'modal:new-relationship',
    opts: { choice: 'lead' },
  },
  {
    key: 'qualify-prospect',
    icon: UserCheck,
    label: 'Qualifica un Prospect',
    description: 'Promuovi un Lead a Prospect dopo la Discovery.',
    cta: 'Vai ai Lead',
    route: '/relations/leads',
  },
  {
    key: 'open-journey',
    icon: Compass,
    label: 'Apri una Design Journey',
    description: 'Crea una Journey su un Prospect o un Cliente.',
    cta: 'Nuova Journey',
    route: 'modal:new-relationship',
    opts: { choice: 'prospect' },
  },
  {
    key: 'upload-materials',
    icon: FolderOpen,
    label: 'Carica materiali',
    description: 'Immagini, prodotti e riferimenti nella libreria studio.',
    cta: 'Apri libreria',
    route: '/library',
  },
  {
    key: 'editorial-calendar',
    icon: CalendarRange,
    label: 'Calendario editoriale',
    description: 'Pianifica contenuti, pubblicazioni e cadenze.',
    cta: 'Apri calendario',
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
              <Icon size={15} strokeWidth={1.6} />
            </span>
            <p className="atd-recommended__label">{a.label}</p>
            <p className="atd-recommended__desc">{a.description}</p>
            <span className="atd-recommended__cta">
              {a.cta} <ArrowRight size={11} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
