/**
 * RecommendedActions — ITER181.A · Phase 3
 *
 * Operational actions panel below Activation Foundation.
 * Suggests the next operational steps in the studio workflow,
 * WITHOUT influencing the activation percentage.
 */
import React from 'react';
import { UserPlus, UserCheck, Compass, FolderOpen, CalendarRange, ArrowRight } from 'lucide-react';
import { useSmartCtaRouter } from '../../hooks/useSmartCtaRouter';

const ACTIONS = [
  {
    key: 'register-lead',
    icon: UserPlus,
    label: 'Registra un Lead',
    description: 'Aggiungi un nuovo contatto al CRM e apri la Discovery.',
    cta: 'Apri Nuova Relazione',
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
    description: 'Crea una Journey su un Prospect qualificato o un Cliente attivo.',
    cta: 'Apri Nuova Relazione',
    route: 'modal:new-relationship',
    opts: { choice: 'prospect' },
  },
  {
    key: 'upload-materials',
    icon: FolderOpen,
    label: 'Carica materiali',
    description: 'Aggiungi immagini, prodotti e riferimenti alla libreria studio.',
    cta: 'Apri libreria',
    route: '/library',
  },
  {
    key: 'editorial-calendar',
    icon: CalendarRange,
    label: 'Configura calendario editoriale',
    description: 'Pianifica contenuti, pubblicazioni e cadenze editoriali.',
    cta: 'Apri calendario',
    route: '/editorial/calendar',
  },
];

export default function RecommendedActions() {
  const route = useSmartCtaRouter();
  return (
    <section
      data-testid="dashboard-recommended-actions"
      style={{ margin: '24px 0' }}
    >
      <div style={{
        fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase',
        color: '#9b9da3', fontWeight: 600, marginBottom: 12,
      }}>
        Azioni consigliate
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 12,
      }}>
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.key}
              type="button"
              data-testid={`recommended-action-${a.key}`}
              onClick={() => route(a.route, a.opts || {})}
              style={{
                textAlign: 'left',
                background: '#ffffff',
                border: '1px solid #e6e6e8',
                borderRadius: 10,
                padding: '14px 16px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                transition: 'border-color 160ms ease, transform 160ms ease',
                color: '#0c0e12',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#0c0e12';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e6e6e8';
              }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                color: '#0c0e12',
              }}>
                <Icon size={16} strokeWidth={1.6} />
                <span style={{ fontSize: 14, fontWeight: 500 }}>{a.label}</span>
              </div>
              <div style={{
                fontSize: 12, color: '#5a5d63',
                lineHeight: 1.4,
              }}>
                {a.description}
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                marginTop: 2,
                fontSize: 12, fontWeight: 500,
                color: '#0c0e12',
              }}>
                {a.cta} <ArrowRight size={11} />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
