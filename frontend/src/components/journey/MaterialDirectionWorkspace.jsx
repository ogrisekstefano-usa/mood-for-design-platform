/**
 * MaterialDirectionWorkspace · Sprint G.6
 *
 * Step body per `material_direction`. Materiali NON sono catalogo. Sono
 * "decisioni materiche" del Journey.
 *
 * Tre raggruppamenti:
 *   · Selezionati  (la palette tattile scelta)
 *   · In ascolto   (alternative offerte al cliente)
 *   · Non scelti   (registrati come traccia progettuale)
 */
import React, { useMemo } from 'react';
import VersionStack from './VersionStack';
import { useT } from '../../i18n/useT';

const GROUP_META = {
  selected: { eyebrow: 'Palette tattile', title: 'La materia scelta' },
  alt:      { eyebrow: 'Alternative',     title: 'Materie ancora in ascolto' },
  rejected: { eyebrow: 'Non scelte',      title: 'Materie scartate · per memoria' },
};

const MaterialDirectionWorkspace = ({ artifacts, projectId, children }) => {
  const { t } = useT();
  const groups = useMemo(() => {
    const sel = []; const alt = []; const rej = [];
    (artifacts || []).forEach((a) => {
      const s = (a.selection || a.approval_state || 'selected').toLowerCase();
      if (['rejected', 'declined', 'scartato'].includes(s)) rej.push(a);
      else if (['alternative', 'pending', 'shared', 'in_progress', 'presented'].includes(s)) alt.push(a);
      else sel.push(a);
    });
    return { selected: sel, alt, rejected: rej };
  }, [artifacts]);

  const totalCount = artifacts?.length || 0;

  return (
    <div data-testid="sw-workspace-material">
      <section className="sw-section" data-testid="sw-section-rationale">
        <div className="sw-section__head">
          <div>
            <p className="sw-section__eyebrow">{t('atelier_voice.material_direction.eyebrow', null, 'Material direction')}</p>
            <h2 className="sw-section__title">
              <em>{t('journey.material_direction_workspace.il_tavolo_della_materia')}</em>
            </h2>
          </div>
          <span className="sw-section__count">
            {totalCount} {totalCount === 1 ? 'voce materica' : 'voci materiche'}
          </span>
        </div>
        <p style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 17, lineHeight: 1.65,
          color: 'color-mix(in srgb, var(--jo-text) 75%, transparent)',
          maxWidth: '64ch',
          fontStyle: 'italic',
        }}>
          Pietre, legni, tessuti, metalli, ceramiche — la Material Direction™
          è il primo gesto tattile del progetto. Ogni materia qui sotto è una
          scelta che il Journey ha attraversato.
        </p>
      </section>

      {totalCount === 0 ? (
        <VersionStack
          artifacts={[]}
          projectId={projectId}
          emptyHint="Quando inizierai a comporre la palette materica del progetto, ogni scelta comparirà qui — selezionata, in ascolto o scartata."
        />
      ) : (
        ['selected', 'alt', 'rejected'].map((key) => {
          const meta = GROUP_META[key];
          const items = groups[key];
          if (items.length === 0) return null;
          return (
            <section
              key={key}
              className="sw-section"
              data-testid={`sw-section-materials-${key}`}
            >
              <div className="sw-section__head">
                <div>
                  <p className="sw-section__eyebrow">{meta.eyebrow}</p>
                  <h3 className="sw-section__title"><em>{meta.title}</em></h3>
                </div>
                <span className="sw-section__count">
                  {items.length} {items.length === 1 ? 'voce' : 'voci'}
                </span>
              </div>
              <VersionStack artifacts={items} projectId={projectId} />
            </section>
          );
        })
      )}

      {children}
    </div>
  );
};

export default MaterialDirectionWorkspace;
