/**
 * Global Create Modal — single entry point for creating anything in MOOD.
 *
 * Configuration-driven: add a new card by appending to `creationOptions`.
 * Theme tokens only (no hardcoded colors), i18n labels, responsive grid.
 *
 * Card schema:
 *   {
 *     id: 'design_journey',
 *     icon: <LucideIcon />,
 *     accent: 'var(--accent-primary)',   // pulled from active preset
 *     i18nTitleKey: 'create.designJourney.title',
 *     i18nDescKey:  'create.designJourney.desc',
 *     fallbackTitle: 'Nuovo Design Journey',
 *     fallbackDesc:  '…',
 *     action: (ctx) => void,
 *     requires?: (ctx) => string | null     // when truthy, blocks action with hint
 *   }
 */
import React, { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useBlueprint } from '../../contexts/BlueprintContext';

import './create-modal.css';

export const CREATE_MODAL_OPEN_EVENT = 'mood:create-modal:open';

export function openCreateModal() {
  window.dispatchEvent(new CustomEvent(CREATE_MODAL_OPEN_EVENT));
}

/* ───────────────────────────────────────────────────────────────────
 *  Configuration — extend with new cards without touching JSX below.
 * ─────────────────────────────────────────────────────────────────── */
function buildCreationOptions({ navigate, t, openNewRelationship, activeJourney }) {
  return [
    {
      id: 'design_journey',
      icon: <Icons.Compass size={20} strokeWidth={1.5} />,
      accent: 'var(--cm-accent-journey, var(--accent-primary, #5dd9c4))',
      titleKey: 'create.designJourney.title',
      descKey:  'create.designJourney.desc',
      fallbackTitle: 'Nuovo Design Journey',
      fallbackDesc: 'Avvia un nuovo progetto e guida il cliente dalla scoperta alla realizzazione.',
      action: () => {
        if (typeof openNewRelationship === 'function') {
          openNewRelationship({ choice: 'prospect' });
        } else {
          navigate('/relations/prospects');
        }
      },
    },
    {
      id: 'lead',
      icon: <Icons.UserPlus size={20} strokeWidth={1.5} />,
      accent: 'var(--cm-accent-lead, var(--accent-secondary, #c9a875))',
      titleKey: 'create.lead.title',
      descKey:  'create.lead.desc',
      fallbackTitle: 'Nuovo Lead',
      fallbackDesc: 'Aggiungi un nuovo contatto o opportunità commerciale.',
      action: () => {
        if (typeof openNewRelationship === 'function') {
          openNewRelationship({ choice: 'lead' });
        } else {
          navigate('/relations/leads');
        }
      },
    },
    {
      id: 'moodboard',
      icon: <Icons.Layout size={20} strokeWidth={1.5} />,
      accent: 'var(--cm-accent-moodboard, #f0a868)',
      titleKey: 'create.moodboard.title',
      descKey:  'create.moodboard.desc',
      fallbackTitle: 'Nuova Moodboard',
      fallbackDesc: 'Crea una moodboard collegata a un progetto esistente.',
      action: () => {
        // ITER204 · Open the Create Moodboard™ two-path modal
        // (From Studio Library™ · Blank Canvas). The picker enforces
        // the Design Journey association internally.
        try {
          // eslint-disable-next-line global-require
          require('./CreateMoodboardModal').openCreateMoodboardModal({
            journey: activeJourney || null,
          });
        } catch (_) {
          // Fallback: direct navigation if the modal module is missing
          if (activeJourney?.id) {
            navigate(`/projects/${activeJourney.id}/moodboards/new`);
          } else {
            navigate('/workspace/projects?intent=new-moodboard');
          }
        }
      },
    },
    {
      id: 'brand',
      icon: <Icons.Building2 size={20} strokeWidth={1.5} />,
      accent: 'var(--cm-accent-brand, #a78bfa)',
      titleKey: 'create.brand.title',
      descKey:  'create.brand.desc',
      fallbackTitle: 'Nuovo Brand',
      fallbackDesc: 'Aggiungi un produttore o partner alla libreria.',
      action: () => navigate('/inspirations/brands?intent=add'),
    },
    {
      id: 'inspiration',
      icon: <Icons.Sparkles size={20} strokeWidth={1.5} />,
      accent: 'var(--cm-accent-inspiration, #f472b6)',
      titleKey: 'create.inspiration.title',
      descKey:  'create.inspiration.desc',
      fallbackTitle: 'Nuova Ispirazione',
      fallbackDesc: 'Salva immagini, link o idee nella Inspiration Library.',
      action: () => navigate('/inspirations?intent=add'),
    },
    {
      id: 'material',
      icon: <Icons.Palette size={20} strokeWidth={1.5} />,
      accent: 'var(--cm-accent-material, #38bdf8)',
      titleKey: 'create.material.title',
      descKey:  'create.material.desc',
      fallbackTitle: 'Nuovo Materiale',
      fallbackDesc: 'Aggiungi un materiale alla Material Library.',
      action: () => navigate('/inspirations/materials?intent=add'),
    },
  ];
}

/* ─────────────────────────────────────────────────────────────────── */
export default function CreateModal() {
  const { t } = useBlueprint();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Lazy hooks — tolerate absence so the modal works even outside a journey ctx
  let openNewRelationship = null;
  try {
    // eslint-disable-next-line global-require
    openNewRelationship = require('../../hooks/useNewRelationship').useNewRelationship().open;
  } catch (_) { /* noop */ }
  let activeJourney = null;
  try {
    // eslint-disable-next-line global-require
    activeJourney = require('../../hooks/useActiveJourney').useActiveJourney?.()?.journey;
  } catch (_) { /* noop */ }

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(CREATE_MODAL_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(CREATE_MODAL_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const options = buildCreationOptions({
    navigate, t, openNewRelationship, activeJourney,
  });

  const handleClick = (opt) => {
    const block = opt.requires?.();
    if (block) {
      toast.message(block, { duration: 4500 });
      return;
    }
    setOpen(false);
    setTimeout(() => opt.action?.(), 20);
  };

  return (
    <div className="cm-backdrop" data-testid="create-modal-backdrop"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="cm-modal" role="dialog" aria-modal="true"
            data-testid="create-modal">
        <header className="cm-modal__head">
          <div>
            <h2 className="cm-modal__title" data-testid="create-modal-title">
              {t('create.modal.title', null, 'Crea nuovo')}
            </h2>
            <p className="cm-modal__subtitle" data-testid="create-modal-subtitle">
              {t('create.modal.subtitle', null, 'Scegli cosa vuoi creare')}
            </p>
          </div>
          <button type="button"
                   className="cm-modal__close"
                   onClick={() => setOpen(false)}
                   aria-label={t('common.close', null, 'Chiudi')}
                   data-testid="create-modal-close">
            <Icons.X size={16} />
          </button>
        </header>

        <div className="cm-modal__grid" data-testid="create-modal-grid">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="cm-card"
              onClick={() => handleClick(opt)}
              data-testid={`create-modal-card-${opt.id}`}
            >
              <span className="cm-card__icon"
                     style={{ '--cm-card-accent': opt.accent }}
                     aria-hidden>
                {opt.icon}
              </span>
              <span className="cm-card__title">
                {t(opt.titleKey, null, opt.fallbackTitle)}
              </span>
              <span className="cm-card__desc">
                {t(opt.descKey, null, opt.fallbackDesc)}
              </span>
              <span className="cm-card__arrow" aria-hidden>
                <Icons.ArrowUpRight size={14} />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
