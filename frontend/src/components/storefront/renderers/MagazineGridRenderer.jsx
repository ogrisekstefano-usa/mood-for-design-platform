import React from 'react';
import {
  Plus, X, ChevronLeft, ChevronRight, ArrowUpRight, Star,
} from 'lucide-react';
import InlineText from '../InlineText';
import { pickLocale } from '../storefrontApi';
import {
  FALLBACK_CHAIN, getField, getSetting, EditableImage,
  BlockToolbar, ToolbarSegment, ToolbarChip,
} from './shared';

// ─── magazine_grid ──────────────────────────────────────────────────────
// Editorial 3-up journal grid. Drag/reorder, edit cover, category, headline,
// per-article slug. Layout density toggle. Featured-first highlight.

const MagazineGrid = ({ section, locale, draft, updateContent, updateSettings, openAssetPicker }) => {
  const articles = getSetting(section, 'articles') || [];
  const s = section.settings || {};
  const density = s.layout_density || 'comfortable'; // 'tight' | 'comfortable' | 'spacious'
  const showHighlight = s.featured_highlight !== false;

  const writeArticles = (next) => updateSettings('articles', next);
  const patchArticle = (idx, patcher) => writeArticles(articles.map((a, i) => (i === idx ? patcher(a) : a)));
  const setLocalized = (idx, field, value) => patchArticle(idx, (a) => {
    const bag = (a[field] && typeof a[field] === 'object') ? a[field] : {};
    return { ...a, [field]: { ...bag, [locale]: value } };
  });
  const move = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= articles.length) return;
    const next = articles.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    writeArticles(next);
  };
  const remove = (idx) => writeArticles(articles.filter((_, i) => i !== idx));
  const toggleFeatured = (idx) => writeArticles(
    articles.map((a, i) => ({ ...a, featured: i === idx ? !a.featured : false }))
  );
  const addArticle = () => {
    const id = `art_${Date.now().toString(36)}`;
    writeArticles([...articles, { id, slug: id, image_url: '', category: { [locale]: '' }, title: { [locale]: '' } }]);
  };

  const gap = density === 'tight' ? 'gap-4' : density === 'spacious' ? 'gap-10' : 'gap-6';

  return (
    <div className="bg-[var(--bp-bg)] py-20 px-12 relative" data-testid={`section-${section.id}`}>
      <BlockToolbar testid={`mag-toolbar-${section.id}`}>
        <ToolbarSegment label="Density">
          {['tight', 'comfortable', 'spacious'].map((k) => (
            <ToolbarChip key={k} active={density === k} onClick={() => updateSettings('layout_density', k)} testid={`mag-density-${k}-${section.id}`}>
              {k}
            </ToolbarChip>
          ))}
        </ToolbarSegment>
        <ToolbarSegment label="Featured">
          <ToolbarChip active={showHighlight} onClick={() => updateSettings('featured_highlight', !showHighlight)} testid={`mag-featured-toggle-${section.id}`}>
            <Star size={10} strokeWidth={1.6} className={showHighlight ? 'fill-current' : ''} />
            {showHighlight ? 'On' : 'Off'}
          </ToolbarChip>
        </ToolbarSegment>
      </BlockToolbar>

      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between mb-10 gap-6">
          <div className="flex flex-col gap-2 flex-1">
            <InlineText
              value={getField(section, draft, locale, 'section_kicker')}
              onChange={(v) => updateContent(locale, 'section_kicker', v)}
              placeholder="MAGAZINE"
              as="p"
              className="text-[#C9A36E] text-[10px] font-body uppercase tracking-[0.3em]"
              testid={`mag-kicker-${section.id}`}
            />
            <InlineText
              value={getField(section, draft, locale, 'section_title')}
              onChange={(v) => updateContent(locale, 'section_title', v)}
              placeholder="Editorial headline"
              multiline
              as="h2"
              className="font-heading text-3xl md:text-4xl font-light text-[var(--bp-text-primary)] leading-tight whitespace-pre-line"
              testid={`mag-title-${section.id}`}
            />
          </div>
          <InlineText
            value={getField(section, draft, locale, 'cta_label')}
            onChange={(v) => updateContent(locale, 'cta_label', v)}
            placeholder="EXPLORE"
            as="span"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 border border-[var(--bp-border)] text-[var(--bp-text-primary)] text-[10px] font-body uppercase tracking-[0.2em] whitespace-nowrap"
            testid={`mag-cta-${section.id}`}
          />
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-3 ${gap}`}>
          {articles.map((a, i) => (
            <article
              key={a.id || i}
              className={`group relative ${a.featured && showHighlight ? 'ring-2 ring-[#C9A36E]/40 ring-offset-2 ring-offset-[var(--bp-bg)]' : ''}`}
              data-testid={`mag-article-${a.id || i}`}
            >
              <EditableImage
                url={a.image_url}
                openAssetPicker={openAssetPicker}
                onPick={(asset) => patchArticle(i, (x) => ({ ...x, image_url: asset.public_url }))}
                aspect="aspect-[4/5]"
                testid={`mag-article-${a.id || i}-cover`}
                label="Replace cover"
              />
              <div className="pt-4 space-y-2">
                <InlineText
                  value={pickLocale(a.category, locale, FALLBACK_CHAIN)}
                  onChange={(v) => setLocalized(i, 'category', v)}
                  placeholder="CATEGORY"
                  as="p"
                  className="text-[var(--bp-text-muted)] text-[10px] font-body uppercase tracking-[0.22em]"
                  testid={`mag-article-${a.id || i}-category`}
                />
                <InlineText
                  value={pickLocale(a.title, locale, FALLBACK_CHAIN)}
                  onChange={(v) => setLocalized(i, 'title', v)}
                  placeholder="Article headline"
                  multiline
                  as="h3"
                  className="font-heading text-xl text-[var(--bp-text-primary)] leading-snug whitespace-pre-line"
                  testid={`mag-article-${a.id || i}-title`}
                />
                <span className="inline-flex items-center gap-1 text-[var(--bp-text-muted)] text-[10px] font-body uppercase tracking-[0.18em] pt-1">
                  Read <ArrowUpRight size={10} strokeWidth={1.6} />
                </span>
              </div>

              <div className="absolute top-2 left-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <input
                  type="text"
                  value={a.slug || ''}
                  onChange={(e) => patchArticle(i, (x) => ({ ...x, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 80) }))}
                  placeholder="slug"
                  data-testid={`mag-article-${a.id || i}-slug`}
                  className="w-28 px-2 py-1 bg-black/70 backdrop-blur-md border border-white/15 rounded-[2px] text-white/85 text-[10px] font-mono outline-none focus:border-white/45"
                />
                <button type="button" onClick={() => toggleFeatured(i)}
                        className={`w-6 h-6 flex items-center justify-center rounded-[2px] bg-black/70 border ${a.featured ? 'border-[#C9A36E] text-[#C9A36E]' : 'border-white/15 text-white/70'}`}
                        title="Featured" data-testid={`mag-article-${a.id || i}-feature`}>
                  <Star size={11} strokeWidth={1.6} className={a.featured ? 'fill-current' : ''} />
                </button>
              </div>

              <div className="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                        className="w-6 h-6 flex items-center justify-center rounded-[2px] bg-black/70 border border-white/15 text-white/85 hover:text-white disabled:opacity-30"
                        title="Move left" data-testid={`mag-article-${a.id || i}-left`}>
                  <ChevronLeft size={11} strokeWidth={1.6} />
                </button>
                <button type="button" onClick={() => move(i, +1)} disabled={i === articles.length - 1}
                        className="w-6 h-6 flex items-center justify-center rounded-[2px] bg-black/70 border border-white/15 text-white/85 hover:text-white disabled:opacity-30"
                        title="Move right" data-testid={`mag-article-${a.id || i}-right`}>
                  <ChevronRight size={11} strokeWidth={1.6} />
                </button>
                <button type="button" onClick={() => remove(i)}
                        className="w-6 h-6 flex items-center justify-center rounded-[2px] bg-black/70 border border-white/15 text-white/85 hover:text-rose-300"
                        title="Remove" data-testid={`mag-article-${a.id || i}-remove`}>
                  <X size={11} strokeWidth={1.6} />
                </button>
              </div>
            </article>
          ))}
          {articles.length < 9 && (
            <button
              type="button"
              onClick={addArticle}
              data-testid={`mag-add-${section.id}`}
              className="aspect-[4/5] flex flex-col items-center justify-center border border-dashed border-[var(--bp-border)] text-[var(--bp-text-muted)] hover:text-[var(--bp-primary)] hover:border-[var(--bp-primary)] transition-colors"
            >
              <Plus size={20} strokeWidth={1.4} />
              <span className="text-[10px] font-body uppercase tracking-[0.22em] mt-2">Add article</span>
            </button>
          )}
        </div>

        {articles.length === 0 && (
          <p className="text-[var(--bp-text-muted)] text-xs font-body italic text-center pt-8">
            Add curated journal articles above.
          </p>
        )}
      </div>
    </div>
  );
};

export default MagazineGrid;
