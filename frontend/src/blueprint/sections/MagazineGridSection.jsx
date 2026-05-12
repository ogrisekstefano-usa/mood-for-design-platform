/**
 * MagazineGridSection — pulls a list from API (eg /api/inspirations).
 * content: { eyebrow, headline, source, columns }
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Section, Container, Eyebrow, H2 } from '../Kit';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

const MagazineGridSection = ({ content = {} }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const cols = content.columns || '3';
  const colCls = { '2': 'md:grid-cols-2', '3': 'md:grid-cols-3', '4': 'md:grid-cols-4' }[cols];

  useEffect(() => {
    const src = content.source || '/api/inspirations?limit=6';
    axios.get(`${BACKEND}${src}`)
      .then((r) => setItems(r.data?.data || r.data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [content.source]);

  return (
    <Section data-testid="section-magazine-grid">
      <Container>
        {content.eyebrow && <Eyebrow>{content.eyebrow}</Eyebrow>}
        {content.headline && <H2 className="mt-4">{content.headline}</H2>}
        <div className={`grid grid-cols-1 ${colCls} gap-8 mt-14`}>
          {loading && Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] skeleton" />
          ))}
          {!loading && items.length === 0 && (
            <p className="bp-caption text-[var(--bp-text-muted)]">No articles yet.</p>
          )}
          {!loading && items.map((a, i) => (
            <article key={a.id || i} className="group cursor-pointer">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--bp-radius-md)] bg-[var(--bp-surface-1)] mb-5">
                {a.cover_image_url && (
                  <img src={a.cover_image_url} alt={a.title || ''}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-[var(--bp-duration-cinematic)] ease-[var(--bp-ease)] group-hover:scale-[1.03] bp-img-cinematic" loading="lazy" />
                )}
              </div>
              <span className="bp-eyebrow">{a.category || 'Editorial'}</span>
              <h3 className="bp-h3 text-[var(--bp-text-primary)] mt-3 group-hover:text-[var(--bp-primary)] transition-colors">
                {a.title || 'Untitled'}
              </h3>
              {a.excerpt && <p className="bp-body text-[var(--bp-text-secondary)] mt-2 line-clamp-2">{a.excerpt}</p>}
            </article>
          ))}
        </div>
      </Container>
    </Section>
  );
};

export default MagazineGridSection;
