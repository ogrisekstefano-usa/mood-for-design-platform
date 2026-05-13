/**
 * TemplatePicker — editorial template gallery for the create-moodboard flow.
 *
 * Visual language:
 *  - Adaptive aspect-ratio tiles (taller cards for editorial / wider for retail)
 *  - SVG preview generated server-side from `position_json` of each template
 *  - Palette swatch row revealing the actual color story of each template
 *  - Lineage badge ("Derivato da {parent}") for tenant forks
 *  - Soft hover lift (transform translateY) with cinematic easing
 *  - Two-column masonry that adapts to viewport — wide on desktop, narrow on mobile
 *
 * Feeling: editorial archive · design catalog · architectural references.
 * NOT: marketplace grid · ecommerce thumbnails.
 */
import React, { useEffect, useState } from 'react';
import { FilePlus, Check, GitBranch, Layers } from 'lucide-react';
import api from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';

// Editorial aspect ratios — derived from category for typographic rhythm.
// Tighter ratios = more poster-like; taller = magazine-cover feel.
const RATIOS = {
  luxury_editorial: '3 / 4',
  concept:          '3 / 4',
  residential:      '4 / 5',
  materials_board:  '4 / 5',
  hospitality:      '1 / 1',
  retail:           '5 / 4',
  ff_e:             '5 / 4',
};

const Swatches = ({ colors }) => {
  if (!colors || colors.length === 0) return null;
  return (
    <div className="flex gap-[3px] mt-2.5">
      {colors.slice(0, 5).map((c, i) => (
        <span key={i} className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: c, boxShadow: '0 0 0 0.5px rgba(255,255,255,0.08) inset' }} />
      ))}
    </div>
  );
};

const PreviewBox = ({ tpl, ratio }) => {
  const pages = tpl.pages_preview || [];
  const isMulti = pages.length > 1;

  if (isMulti) {
    // Layered card-stack to telegraph the structural multi-page nature
    return (
      <div className="relative w-full overflow-hidden rounded-[var(--bp-radius-xs)] bg-[var(--bp-bg)]"
           style={{ aspectRatio: ratio }}>
        {pages.slice(0, 3).map((p, idx) => {
          const offset = (2 - idx) * 6;
          const scale  = 1 - (2 - idx) * 0.05;
          const opacity = idx === Math.min(2, pages.length - 1) ? 1 : 0.55;
          return (
            <div key={p.id}
                 className="absolute inset-0 [&>svg]:w-full [&>svg]:h-full"
                 style={{
                   transform: `translate(${offset}px, ${offset}px) scale(${scale})`,
                   opacity, transformOrigin: 'top left',
                 }}
                 // eslint-disable-next-line react/no-danger
                 dangerouslySetInnerHTML={{ __html: p.preview_svg || '' }} />
          );
        })}
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 60%, rgba(0,0,0,0.32) 100%)' }} />
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden rounded-[var(--bp-radius-xs)] bg-[var(--bp-bg)]"
         style={{ aspectRatio: ratio }}>
      {tpl.preview_svg ? (
        <div className="absolute inset-0 [&>svg]:w-full [&>svg]:h-full"
             // eslint-disable-next-line react/no-danger
             dangerouslySetInnerHTML={{ __html: tpl.preview_svg }} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <FilePlus size={20} strokeWidth={1} className="text-[var(--bp-text-subtle)]" />
        </div>
      )}
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 60%, rgba(0,0,0,0.32) 100%)' }} />
    </div>
  );
};

const TemplateCard = ({ tpl, active, onClick, t }) => {
  const ratio = RATIOS[tpl.category] || '4 / 5';
  const categoryKey = `moodboards.templates.category.${tpl.category || ''}`;
  const categoryLabel = tpl.category ? t(categoryKey) : '';
  // Hide eyebrow gracefully if i18n key is not registered (t() returns the raw key)
  const eyebrow = categoryLabel && categoryLabel !== categoryKey
    ? categoryLabel
    : (tpl.is_starter ? '' : t('moodboards.templates.tenantPreset'));
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`template-card-${tpl.slug}`}
      className={`group relative text-left flex flex-col rounded-[var(--bp-radius-sm)] overflow-hidden
        border transition-all duration-[var(--bp-duration-cinematic)] ease-[var(--bp-ease-emphasis)]
        ${active
          ? 'border-[var(--bp-primary)] -translate-y-0.5 shadow-[var(--bp-elevation-md)]'
          : 'border-[var(--bp-border)] hover:border-[var(--bp-border-strong)] hover:-translate-y-0.5'}`}
    >
      <PreviewBox tpl={tpl} ratio={ratio} />
      <div className="p-3 bg-[var(--bp-surface-1)]">
        <div className="flex items-start justify-between gap-2 min-h-[12px]">
          {eyebrow && (
            <p className="bp-eyebrow !text-[9px] !text-[var(--bp-text-muted)] truncate">
              {eyebrow}
            </p>
          )}
          {active && <Check size={12} strokeWidth={2} className="text-[var(--bp-primary)] flex-shrink-0 ml-auto" />}
        </div>
        <h4 className="bp-body !text-[13px] !font-medium text-[var(--bp-text-primary)] mt-1 truncate">
          {tpl.name}
        </h4>
        <Swatches colors={tpl.palette} />
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {(tpl.page_count || 1) > 1 && (
            <span className="bp-caption !text-[10px] !text-[var(--bp-primary)] flex items-center gap-1"
                  data-testid={`template-page-count-${tpl.slug}`}>
              <Layers size={9} strokeWidth={1.5} />
              {t('moodboards.templates.pageCount', { count: tpl.page_count })}
            </span>
          )}
          {tpl.parent_id && (
            <span className="bp-caption !text-[10px] !text-[var(--bp-text-subtle)] flex items-center gap-1">
              <GitBranch size={9} strokeWidth={1.5} />
              <span className="truncate">{t('moodboards.templates.derivedFrom')}</span>
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

const BlankTile = ({ active, onClick, t }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid="template-blank"
    className={`group relative text-left flex flex-col rounded-[var(--bp-radius-sm)] overflow-hidden
      border transition-all duration-[var(--bp-duration-cinematic)] ease-[var(--bp-ease-emphasis)]
      ${active
        ? 'border-[var(--bp-primary)] -translate-y-0.5 shadow-[var(--bp-elevation-md)]'
        : 'border-[var(--bp-border)] hover:border-[var(--bp-border-strong)] hover:-translate-y-0.5'}`}
  >
    <div className="relative w-full overflow-hidden rounded-[var(--bp-radius-xs)] bg-[var(--bp-bg)]"
         style={{ aspectRatio: '4 / 5' }}>
      <div className="absolute inset-0 flex items-center justify-center">
        <FilePlus size={22} strokeWidth={0.75} className="text-[var(--bp-text-muted)]" />
      </div>
    </div>
    <div className="p-3 bg-[var(--bp-surface-1)]">
      <p className="bp-eyebrow !text-[9px] !text-[var(--bp-text-muted)]">
        {t('moodboards.templates.startBlank')}
      </p>
      <h4 className="bp-body !text-[13px] !font-medium text-[var(--bp-text-primary)] mt-1 truncate">
        {t('moodboards.templates.blank')}
      </h4>
      <p className="bp-caption !text-[10px] !text-[var(--bp-text-subtle)] mt-1 line-clamp-2">
        {t('moodboards.templates.blankDesc')}
      </p>
    </div>
  </button>
);

const TemplatePicker = ({ value, onChange }) => {
  const { t, locale } = useBlueprint();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get('/api/templates', { params: { locale, with_preview: true } })
      .then((r) => { if (!cancelled) setItems(r.data?.data || []); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [locale]);

  return (
    <div data-testid="template-picker">
      <p className="bp-eyebrow !text-[10px] !text-[var(--bp-text-muted)] mb-3">
        {t('moodboards.templates.eyebrow')}
      </p>

      {loading ? (
        <div className="py-10 flex justify-center">
          <div className="w-4 h-4 border-2 border-[var(--bp-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div
          className="grid gap-3 max-h-[440px] overflow-y-auto pr-1 pb-1"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}
        >
          <BlankTile active={!value} onClick={() => onChange(null)} t={t} />
          {items.map((tpl) => (
            <TemplateCard
              key={tpl.id}
              tpl={tpl}
              active={value === tpl.id}
              onClick={() => onChange(tpl.id)}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TemplatePicker;
