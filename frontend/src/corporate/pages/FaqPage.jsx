/**
 * FaqPage — 100% CMS-driven.
 *
 * No strings, no categories, no items, no labels are hardcoded.
 * All content is rendered from /api/site/faq?locale=…
 *
 * Hero + final CTA come from cms_sections.section_type='faq_page' (locale_content).
 * Categories + items come from faq_categories + faq_items (locale_content).
 *
 * Deep links: /faq#blueprint  → opens the "blueprint" category.
 * Search:     /faq?q=…        → filters server-side.
 */
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Search, ChevronDown, X } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const fetchFaq = async (locale, q) => {
  const params = new URLSearchParams({ locale });
  if (q) params.set('q', q);
  const { data } = await axios.get(`${BACKEND}/api/site/faq?${params}`);
  return data;
};

const Accordion = ({ item, defaultOpen }) => {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="border-b border-stone-200/60"
         data-testid={`faq-item-${item.id}`}>
      <button onClick={() => setOpen((v) => !v)}
              data-testid={`faq-item-toggle-${item.id}`}
              className="w-full text-left flex items-center gap-4 py-5 group"
              aria-expanded={open}>
        <span className="flex-1 text-[16px] md:text-[18px] leading-snug font-medium text-stone-900 group-hover:text-black tracking-tight">
          {item.question}
        </span>
        <ChevronDown
          size={18}
          className={`flex-shrink-0 text-stone-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div className={`overflow-hidden transition-[max-height,opacity] duration-500 ease-out ${
            open ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'
          }`}>
        <div className="pb-6 pr-8 text-[14.5px] md:text-[15px] leading-relaxed text-stone-600 whitespace-pre-wrap">
          {item.answer}
        </div>
      </div>
    </div>
  );
};

const CategoryBlock = ({ cat, expandedDeep }) => (
  <section id={cat.slug}
           data-testid={`faq-category-${cat.slug}`}
           className="mb-16 scroll-mt-32">
    <header className="mb-6">
      <h2 className="text-2xl md:text-3xl font-light tracking-tight text-stone-900"
          style={{ fontFamily: 'Playfair Display, serif' }}>
        {cat.title}
      </h2>
      {cat.description && (
        <p className="mt-2 text-[14px] text-stone-500 max-w-2xl">{cat.description}</p>
      )}
    </header>
    <div>
      {cat.items.map((it, idx) => (
        <Accordion key={it.id} item={it}
                   defaultOpen={expandedDeep && idx === 0} />
      ))}
    </div>
  </section>
);

const FaqPage = () => {
  const { locale } = useLocale();
  const [data, setData]     = useState(null);
  const [q, setQ]           = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  // Deep-link hash (e.g. /faq#blueprint)
  const deepHash = (typeof window !== 'undefined' ? window.location.hash.replace('#','') : '');

  // Debounced search
  const [debouncedQ, setDebouncedQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    fetchFaq(locale, debouncedQ)
      .then((d) => { if (!cancel) { setData(d); setError(null); }})
      .catch((e) => { if (!cancel) setError(e?.message || 'Errore caricamento'); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [locale, debouncedQ]);

  // Scroll to deep-link section after first paint
  useEffect(() => {
    if (data && deepHash) {
      const el = document.getElementById(deepHash);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  }, [data, deepHash]);

  const jsonld = useMemo(() => data?.jsonld
    ? JSON.stringify(data.jsonld)
    : null, [data]);

  const hero     = data?.page?.hero     || {};
  const finalCta = data?.page?.finalCta || {};
  const seo      = data?.page?.seo      || {};

  // Apply SEO + JSON-LD imperatively (no react-helmet dependency).
  useEffect(() => {
    if (seo.title) document.title = seo.title;
    const set = (sel, attrs) => {
      let el = document.querySelector(sel);
      if (!el) {
        el = document.createElement(attrs.tag);
        Object.entries(attrs).forEach(([k, v]) => { if (k !== 'tag') el.setAttribute(k, v); });
        document.head.appendChild(el);
      } else {
        Object.entries(attrs).forEach(([k, v]) => { if (k !== 'tag' && k !== 'name' && k !== 'property') el.setAttribute(k, v); });
      }
      return el;
    };
    if (seo.description) {
      set('meta[name="description"][data-faq="1"]',
          { tag: 'meta', name: 'description', content: seo.description, 'data-faq': '1' });
      set('meta[property="og:description"][data-faq="1"]',
          { tag: 'meta', property: 'og:description', content: seo.description, 'data-faq': '1' });
    }
    if (seo.title) {
      set('meta[property="og:title"][data-faq="1"]',
          { tag: 'meta', property: 'og:title', content: seo.title, 'data-faq': '1' });
    }
    // JSON-LD FAQPage schema — built ENTIRELY from CMS content.
    const prev = document.querySelector('script[type="application/ld+json"][data-faq="1"]');
    if (prev) prev.remove();
    if (jsonld) {
      const s = document.createElement('script');
      s.type = 'application/ld+json';
      s.setAttribute('data-faq', '1');
      s.textContent = jsonld;
      document.head.appendChild(s);
    }
    return () => {
      document.querySelectorAll('[data-faq="1"]').forEach((el) => el.remove());
    };
  }, [jsonld, seo.title, seo.description]);

  return (
    <main data-testid="faq-page" className="min-h-screen bg-stone-50">
      {/* HERO — all from CMS */}
      <header className="border-b border-stone-200 bg-white"
              data-testid="faq-hero">
        <div className="max-w-[1100px] mx-auto px-6 py-20 md:py-28">
          {hero.eyebrow && (
            <p className="text-[10.5px] uppercase tracking-[0.32em] text-stone-500 mb-5"
               data-testid="faq-hero-eyebrow">
              {hero.eyebrow}
            </p>
          )}
          {hero.title && (
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight text-stone-900 max-w-3xl leading-[1.05]"
                style={{ fontFamily: 'Playfair Display, serif' }}
                data-testid="faq-hero-title">
              {hero.title}
            </h1>
          )}
          {hero.body && (
            <p className="mt-6 text-[15px] md:text-[16px] leading-relaxed text-stone-600 max-w-2xl whitespace-pre-wrap"
               data-testid="faq-hero-body">
              {hero.body}
            </p>
          )}
          {hero.primary_cta_label && hero.primary_cta_url && (
            <a href={hero.primary_cta_url}
               data-testid="faq-hero-cta"
               className="inline-block mt-8 px-6 py-2.5 bg-black text-white text-[12px] uppercase tracking-[0.18em] hover:bg-stone-800 transition-colors">
              {hero.primary_cta_label}
            </a>
          )}
        </div>
      </header>

      {/* SEARCH */}
      <div className="sticky top-0 z-30 bg-stone-50/95 backdrop-blur border-b border-stone-200">
        <div className="max-w-[1100px] mx-auto px-6 py-4 flex items-center gap-3">
          <Search size={16} className="text-stone-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={hero.search_placeholder || ''}
            data-testid="faq-search-input"
            className="flex-1 bg-transparent text-[14px] text-stone-900 placeholder:text-stone-400 outline-none"
          />
          {q && (
            <button onClick={() => setQ('')} data-testid="faq-search-clear"
                    className="text-stone-400 hover:text-stone-700">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* BODY */}
      <div className="max-w-[1100px] mx-auto px-6 py-12 md:py-16">
        {loading && (
          <div className="text-stone-400 text-[14px]" data-testid="faq-loading">…</div>
        )}
        {error && (
          <div className="text-red-600 text-[14px]" data-testid="faq-error">{error}</div>
        )}
        {!loading && data?.categories?.length === 0 && (
          <div data-testid="faq-empty" className="py-16 text-center text-stone-400">
            {/* No content yet — empty state intentionally has no hardcoded copy.
                Admins should add a category from Blueprint. */}
          </div>
        )}

        {data?.categories?.map((cat) => (
          <CategoryBlock key={cat.id} cat={cat}
                         expandedDeep={cat.slug === deepHash} />
        ))}
      </div>

      {/* FINAL CTA — all from CMS */}
      {(finalCta.title || finalCta.body || finalCta.primary_label) && (
        <section data-testid="faq-final-cta"
                 className="border-t border-stone-200 bg-stone-900 text-stone-50">
          <div className="max-w-[1100px] mx-auto px-6 py-20 md:py-24 text-center">
            {finalCta.eyebrow && (
              <p className="text-[10.5px] uppercase tracking-[0.32em] text-stone-400 mb-5">
                {finalCta.eyebrow}
              </p>
            )}
            {finalCta.title && (
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-light tracking-tight leading-tight max-w-2xl mx-auto"
                  style={{ fontFamily: 'Playfair Display, serif' }}>
                {finalCta.title}
              </h2>
            )}
            {finalCta.body && (
              <p className="mt-5 text-stone-300 text-[15px] max-w-xl mx-auto whitespace-pre-wrap">
                {finalCta.body}
              </p>
            )}
            <div className="mt-9 flex items-center justify-center gap-3 flex-wrap">
              {finalCta.primary_label && finalCta.primary_url && (
                <a href={finalCta.primary_url}
                   data-testid="faq-cta-primary"
                   className="px-6 py-2.5 bg-stone-50 text-stone-900 text-[12px] uppercase tracking-[0.18em] hover:bg-white transition-colors">
                  {finalCta.primary_label}
                </a>
              )}
              {finalCta.secondary_label && finalCta.secondary_url && (
                <a href={finalCta.secondary_url}
                   data-testid="faq-cta-secondary"
                   className="px-6 py-2.5 border border-stone-50/40 text-stone-50 text-[12px] uppercase tracking-[0.18em] hover:bg-stone-800 transition-colors">
                  {finalCta.secondary_label}
                </a>
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  );
};

export default FaqPage;
