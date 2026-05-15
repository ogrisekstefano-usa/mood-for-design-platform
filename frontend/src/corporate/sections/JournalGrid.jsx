import React from 'react';
import { useReveal } from '../hooks/useReveal';

/**
 * JournalGrid — Editorial article grid.
 * Reads posts from content.posts array.
 */
const JournalGrid = ({ content = {}, config = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.05 });
  const posts = content.posts || [];
  const [featured, ...rest] = posts;

  return (
    <section className="py-24 bg-[#F9F9F8]" data-testid="journal-grid">
      <div className="max-w-7xl mx-auto px-8 md:px-16">

        {/* Featured post */}
        {featured && (
          <a
            href={featured.href}
            className="group grid grid-cols-1 lg:grid-cols-2 gap-0 mb-2 border border-[rgba(10,10,10,0.1)] hover:border-[#0A0A0A] transition-colors duration-300 block"
            data-testid="journal-featured-post"
          >
            <div className="relative overflow-hidden" style={{ minHeight: '400px' }}>
              <img
                src={featured.image}
                alt={featured.title}
                className="w-full h-full object-cover absolute inset-0 transition-transform duration-700 group-hover:scale-105"
              />
            </div>
            <div className="flex flex-col justify-center px-10 py-12 bg-white">
              {featured.category && (
                <span className="overline-teal mb-4">{featured.category}</span>
              )}
              <h2 className="font-serif font-light text-3xl md:text-4xl text-[#0A0A0A] tracking-tighter leading-tight mb-4">
                {featured.title}
              </h2>
              <p className="text-sm text-[#5A5A5A] leading-relaxed mb-8">{featured.excerpt}</p>
              <div className="flex items-center gap-4">
                <span className="text-xs text-[#5A5A5A]">{featured.author}</span>
                <span className="text-xs text-[rgba(10,10,10,0.2)]">—</span>
                <span className="text-xs text-[#5A5A5A]">{featured.date}</span>
              </div>
            </div>
          </a>
        )}

        {/* Grid of remaining posts */}
        <div
          ref={ref}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0"
        >
          {rest.map((post, i) => (
            <a
              key={post.id || i}
              href={post.href}
              className={`group border border-t-0 border-[rgba(10,10,10,0.1)] hover:border-[#0A0A0A] transition-colors duration-300 block reveal ${visible ? 'visible' : ''}`}
              style={{ transitionDelay: `${i * 0.08}s` }}
              data-testid={`journal-post-${post.id || i}`}
            >
              <div className="relative overflow-hidden" style={{ aspectRatio: '16/9' }}>
                <img
                  src={post.image}
                  alt={post.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <div className="p-8">
                {post.category && <span className="overline-teal block mb-3">{post.category}</span>}
                <h3 className="font-serif text-xl text-[#0A0A0A] leading-tight mb-3 tracking-tight group-hover:text-[#00C9B3] transition-colors">
                  {post.title}
                </h3>
                <p className="text-sm text-[#5A5A5A] leading-relaxed mb-6 line-clamp-2">{post.excerpt}</p>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#5A5A5A]">{post.author}</span>
                  <span className="text-xs text-[rgba(10,10,10,0.2)]">—</span>
                  <span className="text-xs text-[#5A5A5A]">{post.date}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default JournalGrid;
