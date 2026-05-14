import React, { useEffect, useMemo } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { ArrowUpRight, ArrowLeft } from 'lucide-react';
import { useSite } from '../../site/SiteContext';
import { findProjectBySlug, projects } from '../../site/content/projects';
import { Reveal, SiteImage } from '../../site/components/Reveal';

const ProjectDetailPage = () => {
  const { slug } = useParams();
  const { pick } = useSite();
  const project = useMemo(() => findProjectBySlug(slug), [slug]);

  useEffect(() => {
    if (project) document.title = `${pick(project.title)} — MOOD for DESIGN™`;
  }, [project, pick]);

  if (!project) return <Navigate to="/projects" replace />;

  // Related: same category, exclude self, max 3
  const related = projects.filter((p) => p.slug !== project.slug && p.category === project.category).slice(0, 3);
  const relatedFallback = related.length === 0 ? projects.filter((p) => p.slug !== project.slug).slice(0, 3) : related;

  const back = {
    it: 'Torna all\u2019archivio',
    en: 'Back to archive',
    fr: 'Retour aux archives',
    de: 'Zurück zum Archiv',
    es: 'Volver al archivo',
  };

  const labels = {
    overview: { it: 'Il progetto', en: 'Overview', fr: 'Le projet', de: 'Das Projekt', es: 'El proyecto' },
    studio: { it: 'Studio', en: 'Studio', fr: 'Studio', de: 'Studio', es: 'Estudio' },
    designer: { it: 'Designer', en: 'Designer', fr: 'Designer', de: 'Designer', es: 'Diseñador' },
    location: { it: 'Luogo', en: 'Location', fr: 'Lieu', de: 'Ort', es: 'Ubicación' },
    year: { it: 'Anno', en: 'Year', fr: 'Année', de: 'Jahr', es: 'Año' },
    category: { it: 'Categoria', en: 'Category', fr: 'Catégorie', de: 'Kategorie', es: 'Categoría' },
    materials: { it: 'Materiali e fornitori', en: 'Materials & suppliers', fr: 'Matériaux et fournisseurs', de: 'Materialien & Lieferanten', es: 'Materiales y proveedores' },
    related: { it: 'Continua a esplorare', en: 'Continue exploring', fr: 'Continuer l\u2019exploration', de: 'Weiter erkunden', es: 'Sigue explorando' },
    cta: { it: 'Inizia un progetto come questo', en: 'Begin a project like this', fr: 'Commencer un projet similaire', de: 'Ein ähnliches Projekt beginnen', es: 'Comienza un proyecto como este' },
  };

  // Build gallery layout: wide-narrow-narrow-wide rhythm
  const gallery = project.gallery || [];

  return (
    <div data-testid="site-project-detail">
      {/* Hero */}
      <section className="mfd-detail-hero" data-testid="project-hero">
        <SiteImage src={project.cover} aspect={undefined} alt={pick(project.title)} priority />
        <div className="mfd-detail-hero__veil" />
        <div className="mfd-detail-hero__caption">
          <Reveal as="span" className="mfd-eyebrow mfd-eyebrow--accent">
            {pick({ it: 'Progetto', en: 'Project', fr: 'Projet', de: 'Projekt', es: 'Proyecto' })}{' · '}{project.year}
          </Reveal>
          <Reveal as="h1" className="mfd-display" delay={2} style={{ fontSize: 'clamp(2.2rem, 5vw, 4.6rem)' }}>
            {pick(project.title)}
          </Reveal>
          <Reveal as="p" className="mfd-lead" delay={3}>{pick(project.subtitle)}</Reveal>
        </div>
      </section>

      {/* Back link */}
      <section className="mfd-section mfd-section--tight" style={{ paddingTop: '2rem', paddingBottom: 0 }}>
        <div className="mfd-wrap">
          <Link to="/projects" className="mfd-btn mfd-btn--ghost" data-testid="project-back">
            <ArrowLeft size={14} /> {pick(back)}
          </Link>
        </div>
      </section>

      {/* Overview + specs grid */}
      <section className="mfd-section" data-testid="project-overview">
        <div className="mfd-wrap">
          <div className="mfd-detail-grid">
            <Reveal>
              <dl className="mfd-detail-spec">
                <dt>{pick(labels.studio)}</dt>
                <dd>{project.studio}</dd>
                <dt>{pick(labels.designer)}</dt>
                <dd>{project.designer}</dd>
                <dt>{pick(labels.location)}</dt>
                <dd>{pick(project.location)}</dd>
                <dt>{pick(labels.year)}</dt>
                <dd>{project.year}</dd>
              </dl>
              <div className="mfd-tags" style={{ marginTop: '1rem' }}>
                {project.tags.map((t, i) => (
                  <span key={i} className="mfd-tag">{pick(t)}</span>
                ))}
              </div>
            </Reveal>
            <Reveal delay={2}>
              <span className="mfd-eyebrow">{pick(labels.overview)}</span>
              <h2 className="mfd-h1" style={{ marginTop: '1rem' }}>{pick(project.subtitle)}</h2>
              <p className="mfd-lead" style={{ marginTop: '1.5rem' }}>{pick(project.summary)}</p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Gallery — alternating rhythm */}
      {gallery.length > 0 && (
        <section className="mfd-section" data-testid="project-gallery">
          <div className="mfd-wrap">
            <div className="mfd-gallery">
              {gallery.map((src, i) => {
                // alt: even index wide, odd index narrow pair — pattern
                const wide = i === 0 || (i % 3 === 0 && i !== 0);
                return (
                  <Reveal key={i} delay={(i % 3) + 1} className={wide ? 'mfd-gallery__wide' : ''}>
                    <SiteImage src={src} aspect={wide ? '16/9' : '4/5'} alt="" />
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Chapters */}
      {project.chapters && project.chapters.length > 0 && (
        <section className="mfd-section" data-testid="project-chapters">
          <div className="mfd-wrap" style={{ display: 'grid', gap: 'clamp(2rem, 4vw, 3.5rem)' }}>
            {project.chapters.map((ch, i) => (
              <Reveal key={ch.id} delay={(i % 3) + 1} style={{ maxWidth: '70ch' }}>
                <span className="mfd-eyebrow mfd-eyebrow--accent">0{i + 1}</span>
                <h3 className="mfd-h1" style={{ marginTop: '0.75rem' }}>{pick(ch.title)}</h3>
                <p className="mfd-lead" style={{ marginTop: '1.25rem' }}>{pick(ch.body)}</p>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* Materials */}
      {project.materials && project.materials.length > 0 && (
        <section className="mfd-section mfd-section--tight" data-testid="project-materials">
          <div className="mfd-wrap" style={{ display: 'grid', gap: '2rem' }}>
            <Reveal as="span" className="mfd-eyebrow">{pick(labels.materials)}</Reveal>
            <Reveal as="div" delay={2}>
              <div className="mfd-materials">
                {project.materials.map((m, i) => (
                  <div key={i} className="mfd-materials__row">
                    <span className="mfd-materials__name">{pick(m.name)}</span>
                    <span className="mfd-materials__supplier">{m.supplier}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="mfd-section" data-testid="project-final-cta">
        <div className="mfd-wrap mfd-final" style={{ padding: 0, border: 0 }}>
          <Reveal as="h2" className="mfd-display" style={{ fontSize: 'clamp(2.2rem, 4.6vw, 4rem)' }}>
            {pick(labels.cta)}
          </Reveal>
          <Reveal className="mfd-final__row" delay={2}>
            <Link to="/onboarding/private" className="mfd-btn mfd-btn--accent" data-testid="project-cta-begin">
              {pick({ it: 'Inizia il tuo progetto', en: 'Begin your project', fr: 'Commencer', de: 'Beginnen', es: 'Comenzar' })}
              <ArrowUpRight size={14} />
            </Link>
            <Link to="/projects" className="mfd-btn" data-testid="project-cta-explore">
              {pick({ it: 'Esplora altri progetti', en: 'Explore other projects', fr: 'Voir d\u2019autres projets', de: 'Weitere Projekte', es: 'Otros proyectos' })}
              <ArrowUpRight size={14} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Related */}
      {relatedFallback.length > 0 && (
        <section className="mfd-section" data-testid="project-related">
          <div className="mfd-wrap" style={{ display: 'grid', gap: '2rem' }}>
            <Reveal as="span" className="mfd-eyebrow">{pick(labels.related)}</Reveal>
            <Reveal delay={2}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
                {relatedFallback.map((p, i) => (
                  <Link
                    key={p.slug}
                    to={`/projects/${p.slug}`}
                    style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
                    data-testid={`project-related-${p.slug}`}
                  >
                    <div className="mfd-strip__media">
                      <SiteImage src={p.cover} aspect={p.aspect} alt={pick(p.title)} />
                    </div>
                    <div className="mfd-strip__meta">
                      <div className="mfd-strip__meta-row">
                        <h4 className="mfd-strip__title" style={{ fontSize: 'clamp(1.1rem, 1.6vw, 1.5rem)' }}>{pick(p.title)}</h4>
                        <span className="mfd-strip__location">{pick(p.location)}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </Reveal>
          </div>
        </section>
      )}
    </div>
  );
};

export default ProjectDetailPage;
