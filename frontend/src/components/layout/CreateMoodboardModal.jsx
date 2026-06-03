/**
 * ITER204 · Create Moodboard™ — two-path entry modal.
 *
 * Triggered from the global Create Modal "Moodboard" card. Offers:
 *
 *   1. From Studio Library™ (Recommended)
 *      → pre-fills the moodboard with brands/materials/products already
 *        curated by the studio.
 *
 *   2. Start Blank Canvas
 *      → opens a fresh moodboard editor.
 *
 * Critical constraint: a Moodboard MUST belong to a Design Journey.
 * If no `activeJourney` is provided, the modal exposes a path to select
 * (or create) a Journey before continuing.
 *
 * Theme: 100% Blueprint tokens. i18n: every label via t().
 */
import React, { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useBlueprint } from '../../contexts/BlueprintContext';
import SL from '../../lib/studioLibraryApi';
import './create-modal.css';

export const CREATE_MOODBOARD_OPEN_EVENT = 'mood:create-moodboard:open';

/** Open the modal. `activeJourney` is optional but recommended. */
export function openCreateMoodboardModal(detail = {}) {
  window.dispatchEvent(new CustomEvent(CREATE_MOODBOARD_OPEN_EVENT, { detail }));
}

export default function CreateMoodboardModal() {
  const { t } = useBlueprint();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [journey, setJourney] = useState(null);
  const [stats, setStats] = useState({ total: 0, counts: {} });

  // Pick up activeJourney lazily — works even without context.
  useEffect(() => {
    const onOpen = (e) => {
      setJourney(e?.detail?.journey || null);
      setOpen(true);
    };
    window.addEventListener(CREATE_MOODBOARD_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(CREATE_MOODBOARD_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    SL.libraryStats().then((r) => setStats(r.data || { total: 0, counts: {} }))
                     .catch(() => {});
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const hasLibrary = (stats?.total || 0) > 0;
  const journeyId = journey?.id || journey?.journey_id;

  const goFromLibrary = () => {
    setOpen(false);
    if (!journeyId) {
      // Take user to journey picker with a moodboard intent flag.
      navigate('/workspace/projects?intent=new-moodboard&source=library');
      return;
    }
    navigate(`/projects/${journeyId}/moodboards/new?source=library`);
  };

  const goBlank = () => {
    setOpen(false);
    if (!journeyId) {
      navigate('/workspace/projects?intent=new-moodboard&source=blank');
      return;
    }
    navigate(`/projects/${journeyId}/moodboards/new?source=blank`);
  };

  const goSelectJourney = () => {
    setOpen(false);
    navigate('/workspace/projects?intent=new-moodboard');
  };

  return (
    <div
      className="cm-backdrop"
      data-testid="create-moodboard-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="cm-modal" role="dialog" aria-modal="true"
            data-testid="create-moodboard-modal">
        <header className="cm-modal__head">
          <div>
            <h2 className="cm-modal__title" data-testid="create-moodboard-title">
              {t('create.moodboard.modal.title', null, 'Create Moodboard')}
              <span className="sl-mark" style={{ marginLeft: 8 }}>™</span>
            </h2>
            <p className="cm-modal__subtitle">
              {journey?.name
                ? t('create.moodboard.modal.subtitle_in_journey', null,
                    `Per il Design Journey "${journey.name}"`)
                : t('create.moodboard.modal.subtitle_no_journey', null,
                    'Le Moodboard appartengono sempre a un Design Journey.')}
            </p>
          </div>
          <button
            type="button"
            className="cm-modal__close"
            onClick={() => setOpen(false)}
            aria-label={t('common.close', null, 'Chiudi')}
            data-testid="create-moodboard-close"
          >
            <Icons.X size={16} />
          </button>
        </header>

        {!journeyId && (
          <div
            className="cm-moodboard__notice"
            data-testid="create-moodboard-no-journey"
            style={{
              margin: '0 32px 16px',
              padding: '12px 14px',
              border: '1px solid var(--bp-border, rgba(255,255,255,.1))',
              borderRadius: 10,
              background: 'var(--bp-surface-1, rgba(255,255,255,.03))',
              color: 'var(--bp-text-muted, rgba(255,255,255,.65))',
              fontSize: 12.5,
              lineHeight: 1.5,
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
            }}
          >
            <Icons.Info size={14} strokeWidth={1.6}
                        style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              {t('create.moodboard.requires_journey', null,
                  'Per continuare seleziona o crea un Design Journey: ogni Moodboard vive dentro un percorso progettuale.')}
              <button
                type="button"
                onClick={goSelectJourney}
                data-testid="create-moodboard-select-journey"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-primary, var(--atelier-cyan, #5dd9c4))',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                  marginLeft: 6,
                  fontSize: 'inherit',
                  fontFamily: 'inherit',
                }}
              >
                {t('create.moodboard.go_select_journey', null, 'Scegli un Journey →')}
              </button>
            </div>
          </div>
        )}

        <div className="cm-modal__grid"
              style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}
              data-testid="create-moodboard-paths">
          {/* ── Path 1 · From Studio Library™ (Recommended) */}
          <button
            type="button"
            className="cm-card"
            onClick={goFromLibrary}
            data-testid="create-moodboard-from-library"
            style={{ '--cm-card-accent': 'var(--accent-primary, #5dd9c4)' }}
          >
            <span className="cm-moodboard__badge">
              {t('create.moodboard.recommended', null, 'Consigliato')}
            </span>
            <span className="cm-card__icon" aria-hidden>
              <Icons.LibraryBig size={20} strokeWidth={1.5} />
            </span>
            <span className="cm-card__title">
              {t('create.moodboard.from_library.title', null,
                  'From Studio Library™')}
            </span>
            <span className="cm-card__desc">
              {t('create.moodboard.from_library.desc', null,
                  'Utilizza brand, materiali, prodotti e collezioni già selezionati nella Studio Library.')}
            </span>
            <span className="cm-moodboard__meta">
              {hasLibrary
                ? t('create.moodboard.from_library.count', null,
                    `${stats.total} elementi disponibili`)
                : t('create.moodboard.from_library.empty', null,
                    'Library vuota — salva prima qualche brand dall’Atlas')}
            </span>
            <span className="cm-card__arrow" aria-hidden>
              <Icons.ArrowUpRight size={14} />
            </span>
          </button>

          {/* ── Path 2 · Blank Canvas */}
          <button
            type="button"
            className="cm-card"
            onClick={goBlank}
            data-testid="create-moodboard-blank"
            style={{ '--cm-card-accent': 'var(--accent-secondary, #c9a875)' }}
          >
            <span className="cm-card__icon" aria-hidden>
              <Icons.LayoutDashboard size={20} strokeWidth={1.5} />
            </span>
            <span className="cm-card__title">
              {t('create.moodboard.blank.title', null, 'Start Blank Canvas')}
            </span>
            <span className="cm-card__desc">
              {t('create.moodboard.blank.desc', null,
                  'Inizia una moodboard libera e aggiungi contenuti successivamente.')}
            </span>
            <span className="cm-card__arrow" aria-hidden>
              <Icons.ArrowUpRight size={14} />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
