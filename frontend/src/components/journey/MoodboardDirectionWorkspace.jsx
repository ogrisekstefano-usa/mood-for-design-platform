/**
 * MoodboardDirectionWorkspace · Sprint G.6
 *
 * Step body per `moodboard_direction`. La moodboard non è più "un file"
 * ma una manifestazione narrativa di questo capitolo del Journey.
 *
 * Renderizza tre fasce verticali:
 *   1. Rationale + palette (orizzonte progettuale)
 *   2. Version Stack™ (i capitoli moodboard)
 *   3. Client Interaction Layer™ (voci sul capitolo)
 */
import React from 'react';
import VersionStack from './VersionStack';
import { useT } from '../../i18n/useT';

const MoodboardDirectionWorkspace = ({ context, artifacts, voices, projectId, children }) => {
  const { t } = useT();
  return (
    <div data-testid="sw-workspace-moodboard">
      {/* Rationale / Direction note */}
      <section className="sw-section" data-testid="sw-section-rationale">
        <div className="sw-section__head">
          <div>
            <p className="sw-section__eyebrow">{t('journey.moodboard_direction_workspace.direzione_editoriale')}</p>
            <h2 className="sw-section__title">
              <em>{t('journey.moodboard_direction_workspace.l_orizzonte_di_questo_capitolo')}</em>
            </h2>
          </div>
        </div>
        <p style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 17, lineHeight: 1.65,
          color: 'color-mix(in srgb, var(--jo-text) 75%, transparent)',
          maxWidth: '64ch',
          fontStyle: 'italic',
        }}>
          La Moodboard Direction™ non racconta un file. Racconta la prima
          forma del progetto: come la casa vuole respirare, quale materia
          la abita, quale luce la attraversa. Ogni capitolo qui sotto è una
          proposta visiva offerta al cliente — e una conversazione aperta.
        </p>
      </section>

      {/* Version Stack — i capitoli moodboard */}
      <section className="sw-section" data-testid="sw-section-versions">
        <div className="sw-section__head">
          <div>
            <p className="sw-section__eyebrow">{t('journey.moodboard_direction_workspace.capitoli_moodboard')}</p>
            <h2 className="sw-section__title">
              <em>{t('journey.moodboard_direction_workspace.le_direzioni_proposte')}</em>
            </h2>
          </div>
          <span className="sw-section__count">
            {artifacts?.length || 0} {artifacts?.length === 1 ? 'capitolo' : 'capitoli'}
          </span>
        </div>
        <VersionStack
          artifacts={artifacts}
          projectId={projectId}
          emptyHint="Apri una direzione moodboard per iniziare a comporre il primo capitolo visivo di questo Journey."
        />
      </section>

      {children}
    </div>
  );
};

export default MoodboardDirectionWorkspace;
