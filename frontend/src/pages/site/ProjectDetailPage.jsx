import React, { useEffect, useMemo } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { ArrowUpRight, ArrowLeft } from 'lucide-react';
import { useSite } from '../../site/SiteContext';
import { findProjectBySlug, projects } from '../../site/content/projects';
import { uiContent } from '../../site/content/ui';
import { Reveal, SiteImage } from '../../site/components/Reveal';

const ProjectDetailPage = () => {
  const { slug } = useParams();
  const { pick } = useSite();
  const project = useMemo(() => findProjectBySlug(slug), [slug]);
  const ui = uiContent.detail;

  useEffect(() => {
    if (project) document.title = `${pick(project.title, `projects.${slug}.title`)} — MOOD for DESIGN\u2122`;
  }, [project, pick, slug]);

  if (!project) return <Navigate to="/projects" replace />;

  const related = projects.filter((p) => p.slug !== project.slug && p.category === project.category).slice(0, 3);
  const relatedFallback = related.length === 0 ? projects.filter((p) => p.slug !== project.slug).slice(0, 3) : related;
  const gallery = project.gallery || [];

  return (
    <div data-testid="site-project-detail">
      {/* Hero */}
      <section className="mfd-detail-hero" data-testid="project-hero">
        <img src={project.cover} alt={pick(project.title, `projects.${slug}.title`)} loading="eager" decoding="async" />
        <div className="mfd-detail-hero__veil" />
        <div className="mfd-detail-hero__caption">
          <Reveal as="span" className="mfd-eyebrow mfd-eyebrow--accent">
            {pick(ui.label, 'ui.detail.label')}{' · '}{project.year}
          </Reveal>
          <Reveal as="h1" className="mfd-display" delay={2} style={{ fontSize: 'clamp(2.2rem, 5vw, 4.6rem)' }}>
            {pick(project.title, `projects.${slug}.title`)}
          </Reveal>
          <Reveal as="p" className="mfd-lead" delay={3}>{pick(project.subtitle, `projects.${slug}.subtitle`)}</Reveal>
        </div>
      </section>

      <section className="mfd-section mfd-section--tight" style={{ paddingTop: '2rem', paddingBottom: 0 }}>
        <div className="mfd-wrap">
          <Link to="/projects" className="mfd-btn mfd-btn--outline-paper" data-testid="project-back" style={{ padding: '0.7rem 1.2rem' }}>
            <ArrowLeft size={14} /> {pick(uiContent.backToArchive, 'ui.backToArchive')}
          </Link>
        </div>
      </section>

      <section className="mfd-section" data-testid="project-overview">
        <div className="mfd-wrap">
          <div className="mfd-detail-grid">
            <Reveal>
              <dl className="mfd-detail-spec">
                <dt>{pick(ui.studio, 'ui.detail.studio')}</dt>
                <dd>{project.studio}</dd>
                <dt>{pick(ui.designer, 'ui.detail.designer')}</dt>
                <dd>{project.designer}</dd>
                <dt>{pick(ui.location, 'ui.detail.location')}</dt>
                <dd>{pick(project.location, `projects.${slug}.location`)}</dd>
                <dt>{pick(ui.year, 'ui.detail.year')}</dt>
                <dd>{project.year}</dd>
              </dl>
              <div className="mfd-tags" style={{ marginTop: '1rem' }}>
                {project.tags.map((t, i) => (<span key={i} className="mfd-tag">{pick(t, `projects.${slug}.tags.${i}`)}</span>))}
              </div>
            </Reveal>
            <Reveal delay={2}>
              <span className="mfd-eyebrow">{pick(ui.overview, 'ui.detail.overview')}</span>
              <h2 className="mfd-h1" style={{ marginTop: '1rem' }}>{pick(project.subtitle, `projects.${slug}.subtitle`)}</h2>
              <p className="mfd-lead" style={{ marginTop: '1.5rem' }}>{pick(project.summary, `projects.${slug}.summary`)}</p>
            </Reveal>
          </div>
        </div>
      </section>

      {gallery.length > 0 && (
        <section className="mfd-section" data-testid="project-gallery">
          <div className="mfd-wrap">
            <div className="mfd-gallery">
              {gallery.map((src, i) => {
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

      {project.chapters && project.chapters.length > 0 && (
        <section className="mfd-section" data-testid="project-chapters">
          <div className="mfd-wrap" style={{ display: 'grid', gap: 'clamp(2rem, 4vw, 3.5rem)' }}>
            {project.chapters.map((ch, i) => (
              <Reveal key={ch.id} delay={(i % 3) + 1} style={{ maxWidth: '70ch' }}>
                <span className="mfd-eyebrow mfd-eyebrow--accent">0{i + 1}</span>
                <h3 className="mfd-h1" style={{ marginTop: '0.75rem' }}>{pick(ch.title, `projects.${slug}.chapters.${ch.id}.title`)}</h3>
                <p className="mfd-lead" style={{ marginTop: '1.25rem' }}>{pick(ch.body, `projects.${slug}.chapters.${ch.id}.body`)}</p>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {project.materials && project.materials.length > 0 && (
        <section className="mfd-section mfd-section--tight" data-testid="project-materials">
          <div className="mfd-wrap" style={{ display: 'grid', gap: '2rem' }}>
            <Reveal as="span" className="mfd-eyebrow">{pick(ui.materials, 'ui.detail.materials')}</Reveal>
            <Reveal as="div" delay={2}>
              <div className="mfd-materials">
                {project.materials.map((m, i) => (
                  <div key={i} className="mfd-materials__row">
                    <span className="mfd-materials__name">{pick(m.name, `projects.${slug}.materials.${i}.name`)}</span>
                    <span className="mfd-materials__supplier">{m.supplier}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>
      )}

      <section className="mfd-section" data-testid="project-final-cta">
        <div className="mfd-wrap" style={{ display: 'grid', gap: '2rem' }}>
          <Reveal as="h2" className="mfd-display" style={{ fontSize: 'clamp(2.2rem, 4.6vw, 4rem)' }}>
            {pick(ui.cta, 'ui.detail.cta')}
          </Reveal>
          <Reveal style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
            <Link to="/onboarding/private" className="mfd-btn mfd-btn--paper" data-testid="project-cta-begin">
              {pick(ui.beginProject, 'ui.detail.beginProject')} <ArrowUpRight size={14} />
            </Link>
            <Link to="/projects" className="mfd-btn" data-testid="project-cta-explore">
              {pick(ui.explore, 'ui.detail.explore')} <ArrowUpRight size={14} />
            </Link>
          </Reveal>
        </div>
      </section>

      {relatedFallback.length > 0 && (
        <section className="mfd-section" data-testid="project-related">
          <div className="mfd-wrap" style={{ display: 'grid', gap: '2rem' }}>
            <Reveal as="span" className="mfd-eyebrow">{pick(ui.related, 'ui.detail.related')}</Reveal>
            <Reveal delay={2}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
                {relatedFallback.map((p) => (
                  <Link
                    key={p.slug}
                    to={`/projects/${p.slug}`}
                    style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
                    data-testid={`project-related-${p.slug}`}
                  >
                    <div className="mfd-strip__media">
                      <SiteImage src={p.cover} aspect={p.aspect} alt={pick(p.title, `projects.${p.slug}.title`)} />
                    </div>
                    <div className="mfd-strip__meta">
                      <div className="mfd-strip__meta-row">
                        <h4 className="mfd-strip__title" style={{ fontSize: 'clamp(1.1rem, 1.6vw, 1.5rem)' }}>{pick(p.title, `projects.${p.slug}.title`)}</h4>
                        <span className="mfd-strip__location">{pick(p.location, `projects.${p.slug}.location`)}</span>
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
