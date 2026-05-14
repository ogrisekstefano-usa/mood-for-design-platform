import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useSite } from '../../site/SiteContext';
import { projects, projectCategories } from '../../site/content/projects';
import { Reveal, SiteImage } from '../../site/components/Reveal';

const ProjectsIndexPage = () => {
  const { pick } = useSite();
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(
    () => (filter === 'all' ? projects : projects.filter((p) => p.category === filter)),
    [filter],
  );

  useEffect(() => {
    document.title = 'Projects — MOOD for DESIGN™';
  }, []);

  const titleByLocale = {
    it: 'Progetti selezionati.\nStorie reali di spazi.',
    en: 'Selected projects.\nReal stories of space.',
    fr: 'Projets sélectionnés.\nVraies histoires d\u2019espaces.',
    de: 'Ausgewählte Projekte.\nEchte Geschichten von Räumen.',
    es: 'Proyectos seleccionados.\nHistorias reales de espacios.',
  };

  const eyebrow = {
    it: 'Archivio editoriale',
    en: 'Editorial archive',
    fr: 'Archives éditoriales',
    de: 'Redaktionsarchiv',
    es: 'Archivo editorial',
  };

  const filterLabel = {
    it: 'Filtra per categoria',
    en: 'Filter by category',
    fr: 'Filtrer par catégorie',
    de: 'Nach Kategorie filtern',
    es: 'Filtrar por categoría',
  };

  return (
    <div data-testid="site-projects-index">
      <section className="mfd-section" style={{ paddingTop: 'clamp(8rem, 14vw, 12rem)' }}>
        <div className="mfd-wrap" style={{ display: 'grid', gap: '2rem' }}>
          <Reveal as="span" className="mfd-eyebrow mfd-eyebrow--accent" data-testid="projects-eyebrow">
            {pick(eyebrow)}
          </Reveal>
          <Reveal as="h1" className="mfd-display" delay={2} data-testid="projects-title">
            {pick(titleByLocale)}
          </Reveal>
          <Reveal delay={3} className="mfd-rule" style={{ marginTop: '1.5rem' }} />
          <Reveal delay={3} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem', marginTop: '0.5rem' }}>
            <span className="mfd-eyebrow">{pick(filterLabel)}</span>
            <div className="mfd-filters" data-testid="projects-filters">
              {projectCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className="mfd-filters__btn"
                  aria-pressed={filter === cat.id}
                  onClick={() => setFilter(cat.id)}
                  data-testid={`projects-filter-${cat.id}`}
                >
                  {pick(cat.label)}
                </button>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mfd-section mfd-section--tight">
        <div className="mfd-wrap">
          {filtered.length === 0 ? (
            <p className="mfd-body" data-testid="projects-empty" style={{ padding: '4rem 0' }}>
              {pick({ it: 'Nessun progetto in questa categoria.', en: 'No projects in this category.', fr: 'Aucun projet dans cette catégorie.', de: 'Keine Projekte in dieser Kategorie.', es: 'No hay proyectos en esta categoría.' })}
            </p>
          ) : (
            <div className="mfd-masonry" data-testid="projects-grid">
              {filtered.map((p, i) => (
                <Reveal key={p.slug} delay={(i % 3) + 1} className="mfd-masonry__item">
                  <Link
                    to={`/projects/${p.slug}`}
                    className="mfd-masonry__item"
                    data-testid={`project-card-${p.slug}`}
                    style={{ display: 'block' }}
                  >
                    <div className="mfd-strip__media">
                      <SiteImage src={p.cover} aspect={p.aspect} alt={pick(p.title)} />
                    </div>
                    <div className="mfd-strip__meta">
                      <div className="mfd-strip__meta-row">
                        <h3 className="mfd-strip__title">{pick(p.title)}</h3>
                        <span className="mfd-strip__location">{pick(p.location)}</span>
                      </div>
                      <p className="mfd-body" style={{ maxWidth: '54ch' }}>{pick(p.subtitle)}</p>
                      <div className="mfd-tags" style={{ marginTop: '0.75rem' }}>
                        {p.tags.slice(0, 3).map((t, ti) => (
                          <span key={ti} className="mfd-tag">{pick(t)}</span>
                        ))}
                      </div>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mfd-section" data-testid="projects-final-cta">
        <div className="mfd-wrap mfd-final" style={{ padding: 0, border: 0 }}>
          <Reveal as="h2" className="mfd-h1">
            {pick({
              it: 'Vuoi vedere il tuo prossimo spazio\nentrare in questo archivio?',
              en: 'Want your next space\nto enter this archive?',
              fr: 'Envie de voir votre prochain espace\nentrer dans cette archive ?',
              de: 'Soll Ihr nächster Raum\nin dieses Archiv?',
              es: '¿Quieres que tu próximo espacio\nentre en este archivo?',
            })}
          </Reveal>
          <Reveal className="mfd-final__row" delay={2}>
            <Link to="/onboarding/private" className="mfd-btn mfd-btn--accent" data-testid="projects-cta-private">
              {pick({ it: 'Inizia il tuo progetto', en: 'Begin your project', fr: 'Commencer votre projet', de: 'Projekt beginnen', es: 'Comienza tu proyecto' })}
              <ArrowUpRight size={14} />
            </Link>
            <Link to="/onboarding/pro" className="mfd-btn" data-testid="projects-cta-pro">
              {pick({ it: 'Sono un professionista', en: 'I am a professional', fr: 'Je suis un professionnel', de: 'Ich bin Fachperson', es: 'Soy un profesional' })}
              <ArrowUpRight size={14} />
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
};

export default ProjectsIndexPage;
