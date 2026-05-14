import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useSite } from '../../site/SiteContext';
import { projects, projectCategories } from '../../site/content/projects';
import { uiContent } from '../../site/content/ui';
import { Reveal, SiteImage } from '../../site/components/Reveal';

const ProjectsIndexPage = () => {
  const { pick } = useSite();
  const [filter, setFilter] = useState('all');
  const ui = uiContent.archive;

  const filtered = useMemo(
    () => (filter === 'all' ? projects : projects.filter((p) => p.category === filter)),
    [filter],
  );

  useEffect(() => { document.title = 'Projects — MOOD for DESIGN\u2122'; }, []);

  return (
    <div data-testid="site-projects-index">
      <section className="mfd-section" style={{ paddingTop: 'clamp(8rem, 14vw, 12rem)' }}>
        <div className="mfd-wrap" style={{ display: 'grid', gap: '2rem' }}>
          <Reveal as="span" className="mfd-eyebrow mfd-eyebrow--accent" data-testid="projects-eyebrow">
            {pick(ui.eyebrow, 'ui.archive.eyebrow')}
          </Reveal>
          <Reveal as="h1" className="mfd-display" delay={2} data-testid="projects-title">
            {pick(ui.title, 'ui.archive.title')}
          </Reveal>
          <Reveal delay={3} className="mfd-rule" style={{ marginTop: '1.5rem', height: 1, background: 'var(--site-line)' }} />
          <Reveal delay={3} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem', marginTop: '0.5rem' }}>
            <span className="mfd-eyebrow">{pick(ui.filterLabel, 'ui.archive.filterLabel')}</span>
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
                  {pick(cat.label, `projectCategories.${cat.id}`)}
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
              {pick(ui.empty, 'ui.archive.empty')}
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
                      <SiteImage src={p.cover} aspect={p.aspect} alt={pick(p.title, `projects.${p.slug}.title`)} />
                    </div>
                    <div className="mfd-strip__meta">
                      <div className="mfd-strip__meta-row">
                        <h3 className="mfd-strip__title">{pick(p.title, `projects.${p.slug}.title`)}</h3>
                        <span className="mfd-strip__location">{pick(p.location, `projects.${p.slug}.location`)}</span>
                      </div>
                      <p className="mfd-body" style={{ maxWidth: '54ch' }}>{pick(p.subtitle, `projects.${p.slug}.subtitle`)}</p>
                      <div className="mfd-tags" style={{ marginTop: '0.75rem' }}>
                        {p.tags.slice(0, 3).map((t, ti) => (
                          <span key={ti} className="mfd-tag">{pick(t, `projects.${p.slug}.tags.${ti}`)}</span>
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
        <div className="mfd-wrap" style={{ display: 'grid', gap: '2rem' }}>
          <Reveal as="h2" className="mfd-h1">{pick(ui.finalTitle, 'ui.archive.finalTitle')}</Reveal>
          <Reveal style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }} delay={2}>
            <Link to="/onboarding/private" className="mfd-btn mfd-btn--paper" data-testid="projects-cta-private">
              {pick(ui.ctaPrivate, 'ui.archive.ctaPrivate')} <ArrowUpRight size={14} />
            </Link>
            <Link to="/onboarding/pro" className="mfd-btn" data-testid="projects-cta-pro">
              {pick(ui.ctaPro, 'ui.archive.ctaPro')} <ArrowUpRight size={14} />
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
};

export default ProjectsIndexPage;
