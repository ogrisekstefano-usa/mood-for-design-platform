/**
 * PagesFilmstrip — bottom horizontal page navigator for Moodboard Builder PRO.
 *
 * Renders the multi-page sequence as a cinematic filmstrip along the BOTTOM of
 * the editor (replacing the legacy left vertical sidebar). Same data + handlers
 * as the original PagesNavigator — only the orientation changes.
 *
 *  ┌── Filmstrip ──────────────────────────────────────────────────────────┐
 *  │ [thumb] [thumb✓teal] [thumb] [thumb]  ...  [+ Aggiungi pagina]        │
 *  │  01 Cover  02 Mood   03 Living                                        │
 *  └────────────────────────────────────────────────────────────────────────┘
 */
import React, { useEffect, useRef, useState } from 'react';
import api from '../../lib/api';
import { trackEvent } from '../../lib/telemetry';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { Plus, Copy, Trash2 } from 'lucide-react';
import SkeletonPicker from './SkeletonPicker';
import TemplateProgressOverlay from './TemplateProgressOverlay';
import { applyPremiumTemplate } from './premiumTemplates';
import { toast } from 'sonner';

// ── Page-type visual language ──────────────────────────────────────────────
// Each page-type gets its own semantic identity in the thumbnail so the
// designer can read the narrative rhythm of the deck without zooming in.
const PAGE_TYPE_VISUAL = {
  cover:              { label: 'COVER',      tone: '#E0A458', glyph: 'C' },
  blank:              { label: 'BLANK',      tone: '#6F6A65', glyph: '·' },
  mood:               { label: 'MOOD',       tone: '#8FB3A8', glyph: 'M' },
  material_board:     { label: 'MATERIAL',   tone: '#C9AE8C', glyph: 'm' },
  product_grid:       { label: 'PRODUCTS',   tone: '#A6A3CC', glyph: 'P' },
  palette:            { label: 'PALETTE',    tone: '#D6B79A', glyph: 'p' },
  gallery:            { label: 'GALLERY',    tone: '#9B917F', glyph: 'G' },
  split_story:        { label: 'STORY',      tone: '#B59A78', glyph: 'S' },
  quote:              { label: 'QUOTE',      tone: '#7A8C9B', glyph: '"' },
  technical_board:    { label: 'TECHNICAL',  tone: '#869099', glyph: 'T' },
  floorplan:          { label: 'FLOORPLAN',  tone: '#7A6B58', glyph: 'F' },
  proposal_summary:   { label: 'SUMMARY',    tone: '#A8B5B3', glyph: 'Σ' },
  approval:           { label: 'APPROVAL',   tone: '#15AC8B', glyph: '✓' },
};

// Empty-state silhouette per page-type — drawn only when the page has no
// blocks yet so an empty placeholder still hints at the chapter's intent.
const TypeSilhouette = ({ type }) => {
  const palette = '#3A332C';
  switch (type) {
    case 'cover': return (
      <>
        <div className="absolute inset-[8%] rounded-[1px] opacity-25" style={{ background: palette }} />
        <div className="absolute left-[12%] right-[12%] bottom-[12%] h-[14%] rounded-[1px] opacity-40" style={{ background: palette }} />
      </>);
    case 'palette': return (
      <div className="absolute inset-[14%] flex gap-[3px]">
        {[0.15, 0.25, 0.35, 0.55, 0.75].map((o, i) => (
          <div key={i} className="flex-1" style={{ background: palette, opacity: o, borderRadius: 1 }} />
        ))}
      </div>);
    case 'material_board': return (
      <div className="absolute inset-[10%] grid grid-cols-2 gap-[3px]">
        {[0.18, 0.30, 0.24, 0.36].map((o, i) => (
          <div key={i} style={{ background: palette, opacity: o, borderRadius: 1 }} />
        ))}
      </div>);
    case 'gallery':
    case 'product_grid': return (
      <div className="absolute inset-[10%] grid grid-cols-3 grid-rows-2 gap-[2px]">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ background: palette, opacity: 0.18 + (i % 3) * 0.08, borderRadius: 1 }} />
        ))}
      </div>);
    case 'quote': return (
      <>
        <div className="absolute left-[18%] top-[20%] text-[18px] leading-none opacity-30" style={{ color: palette, fontFamily: 'Playfair Display, serif' }}>"</div>
        <div className="absolute left-[20%] right-[20%] top-[44%] h-[2px] opacity-25" style={{ background: palette }} />
        <div className="absolute left-[24%] right-[28%] top-[52%] h-[2px] opacity-20" style={{ background: palette }} />
        <div className="absolute left-[22%] right-[22%] top-[60%] h-[2px] opacity-15" style={{ background: palette }} />
      </>);
    case 'split_story': return (
      <>
        <div className="absolute left-[8%] top-[12%] w-[40%] bottom-[12%] rounded-[1px] opacity-28" style={{ background: palette }} />
        <div className="absolute right-[10%] top-[18%] w-[32%] h-[6%] rounded-[1px] opacity-30" style={{ background: palette }} />
        <div className="absolute right-[10%] top-[28%] w-[26%] h-[3%] rounded-[1px] opacity-20" style={{ background: palette }} />
        <div className="absolute right-[10%] top-[36%] w-[32%] h-[44%] rounded-[1px] opacity-26" style={{ background: palette }} />
      </>);
    case 'mood': return (
      <>
        <div className="absolute left-[8%] top-[10%] w-[58%] h-[62%] rounded-[1px] opacity-30" style={{ background: palette }} />
        <div className="absolute right-[8%] top-[12%] w-[26%] h-[30%] rounded-[1px] opacity-22" style={{ background: palette }} />
        <div className="absolute right-[8%] top-[46%] w-[26%] h-[26%] rounded-[1px] opacity-18" style={{ background: palette }} />
        <div className="absolute left-[8%] right-[8%] bottom-[8%] h-[8%] opacity-20" style={{ background: palette, borderRadius: 1 }} />
      </>);
    case 'approval': return (
      <>
        <div className="absolute left-[20%] right-[20%] top-[22%] h-[3%] opacity-25" style={{ background: palette, borderRadius: 1 }} />
        <div className="absolute left-[20%] right-[30%] top-[30%] h-[2%] opacity-15" style={{ background: palette, borderRadius: 1 }} />
        <div className="absolute left-[28%] right-[28%] bottom-[18%] h-[14%] rounded-[2px]" style={{ background: 'var(--bp-primary)', opacity: 0.55 }} />
      </>);
    default: return (
      <div className="absolute inset-[14%] rounded-[1px] opacity-12" style={{ background: palette }} />
    );
  }
};

// Tiny preview that renders the page's block geometry at scale.
// When the page has no blocks (just-created from skeleton), draw a typed
// silhouette so the thumbnail communicates intent immediately.
const MiniPreview = ({ page, blocks, active }) => {
  const w = 112;
  const h = (page.height / page.width) * w;
  const scale = w / (page.width || 1400);
  const visibleBlocks = (blocks || []).filter((b) => !b.hidden);
  const hasBlocks = visibleBlocks.length > 0;
  const bgColor = page?.settings?.background_color || page?.background?.color || 'var(--bp-bg)';
  return (
    <div className={`relative overflow-hidden rounded-[3px] transition-all duration-300
                     ${active ? 'shadow-[0_8px_22px_rgba(15,162,132,0.22)]' : ''}`}
         style={{ width: `${w}px`, height: `${h}px`, background: bgColor }}>
      {/* Empty silhouette per page-type (only when no blocks placed) */}
      {!hasBlocks && <TypeSilhouette type={page.page_type} />}
      {/* Real block geometry */}
      {visibleBlocks.map((b) => {
        // Render real palette swatches if available
        if (b.type === 'palette') {
          const cols = b?.content?.colors || [];
          if (cols.length) {
            return (
              <div key={b.id} className="absolute flex" style={{
                left: (b.x ?? 40) * scale, top: (b.y ?? 40) * scale,
                width: Math.max(4, (b.width ?? 320) * scale),
                height: Math.max(2, (b.height ?? 60) * scale),
                borderRadius: 1,
              }}>
                {cols.slice(0, 5).map((c, i) => (
                  <span key={i} className="flex-1" style={{ background: c }} />
                ))}
              </div>
            );
          }
        }
        // Render actual image thumbnails for image blocks — this is what
        // makes the filmstrip read as a real preview of the deck (instead
        // of a grid of colored rectangles).
        if (b.type === 'image') {
          const src = b?.content?.src || b?.image_url;
          if (src) {
            return (
              <img key={b.id} src={src} alt=""
                   loading="lazy" draggable={false}
                   className="absolute object-cover pointer-events-none"
                   style={{
                     left: (b.x ?? 40) * scale,
                     top: (b.y ?? 40) * scale,
                     width: Math.max(2, (b.width ?? 320) * scale),
                     height: Math.max(2, (b.height ?? 240) * scale),
                     borderRadius: 1,
                   }}
                   onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            );
          }
        }
        // Render material thumb if available
        if (b.type === 'material') {
          const src = b?.content?.image || b?.content?.image_url;
          if (src) {
            return (
              <img key={b.id} src={src} alt=""
                   loading="lazy" draggable={false}
                   className="absolute object-cover pointer-events-none"
                   style={{
                     left: (b.x ?? 40) * scale,
                     top: (b.y ?? 40) * scale,
                     width: Math.max(2, (b.width ?? 320) * scale),
                     height: Math.max(2, (b.height ?? 240) * scale),
                     borderRadius: 1, opacity: 0.85,
                   }}
                   onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            );
          }
        }
        let tint = 'rgba(58,51,44,0.18)';
        if (b.type === 'image')         tint = 'linear-gradient(135deg, rgba(58,46,32,0.55) 0%, rgba(28,20,14,0.40) 100%)';
        else if (b.type === 'palette')  tint = 'rgba(214,197,168,0.30)';
        else if (b.type === 'material') tint = 'rgba(214,197,168,0.30)';
        else if (b.type === 'product')  tint = 'rgba(166,163,204,0.24)';
        else if (b.type === 'text')     tint = 'rgba(245,242,236,0.32)';
        else if (b.type === 'note')     tint = 'rgba(224,164,88,0.22)';
        else if (b.type === 'shape')    tint = b?.style?.fill_color || 'rgba(120,120,120,0.20)';
        return (
          <div key={b.id} className="absolute"
               style={{
                 left: (b.x ?? 40) * scale,
                 top: (b.y ?? 40) * scale,
                 width: Math.max(2, (b.width ?? 320) * scale),
                 height: Math.max(2, (b.height ?? 240) * scale),
                 background: tint,
                 borderRadius: '1px',
               }} />
        );
      })}
      {/* Cinematic active overlay — soft top edge highlight */}
      {active && (
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: 'linear-gradient(180deg, rgba(15,162,132,0.18) 0%, rgba(15,162,132,0) 35%)' }} />
      )}
    </div>
  );
};

const PagesFilmstrip = ({ moodboardId, pages, currentPageId, blocksByPage, onSelect, onChange, readOnly, pageStatusById }) => {
  const { t } = useBlueprint();
  const [skeletonPickerOpen, setSkeletonPickerOpen] = useState(false);
  const [skeletons, setSkeletons] = useState(null);
  // When set, the next picker-template will be inserted RIGHT AFTER this page id.
  // Null = append at the end (default).
  const [insertAfterPageId, setInsertAfterPageId] = useState(null);
  // Cinematic overlay state while a multi-page template is being applied
  const [progress, setProgress] = useState({
    active: false, templateName: null, current: 0, total: 0, pages: [],
  });
  const dragId = useRef(null);

  useEffect(() => {
    api.get('/api/moodboards/_meta/page_skeletons')
      .then((r) => setSkeletons(r.data?.data || []))
      .catch(() => setSkeletons([]));
  }, []);

  // External trigger — let other parts of the editor open the skeleton picker
  // without prop-drilling. The Pages tab in EditorPanel dispatches this event
  // when the user clicks "Explore all layouts".
  useEffect(() => {
    if (readOnly) return undefined;
    const handler = () => setSkeletonPickerOpen(true);
    window.addEventListener('mfd:open-skeleton-picker', handler);
    return () => window.removeEventListener('mfd:open-skeleton-picker', handler);
  }, [readOnly]);

  const handleSkeletonPick = async (skeletonId) => {
    setSkeletonPickerOpen(false);
    const insertAfter = insertAfterPageId;
    setInsertAfterPageId(null);
    try {
      const r = await api.post(`/api/moodboards/${moodboardId}/pages/from_skeleton`,
                               { skeleton_id: skeletonId });
      const newId = r.data.id;
      // Insert-here support — reorder so the new page sits after the chosen one
      if (insertAfter && newId) {
        try {
          const listRes = await api.get(`/api/moodboards/${moodboardId}/pages`);
          const all = (listRes.data || []).slice().sort(
            (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
          const existingIds = all.map((p) => p.id).filter((id) => id !== newId);
          const idx = existingIds.indexOf(insertAfter);
          if (idx >= 0) {
            const reordered = [
              ...existingIds.slice(0, idx + 1), newId,
              ...existingIds.slice(idx + 1),
            ];
            await api.post(`/api/moodboards/${moodboardId}/pages/reorder`,
              { page_ids: reordered });
          }
        } catch (_) { /* best-effort */ }
      }
      trackEvent('moodboard.skeleton_applied',
        { skeleton_id: skeletonId, moodboard_id: moodboardId,
          inserted_after: insertAfter || null },
        { entityType: 'moodboard', entityId: moodboardId });
      onSelect?.(newId);
      onChange?.();
      toast.success(t('moodboards.skeleton.applied', null, 'Page added.'));
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'unknown error';
      toast.error(t('moodboards.skeleton.applyFailed', null, `Could not add page: ${detail}`));
    }
  };

  // Premium pre-built template — multi-page presentation. Creates 6-7 pages
  // sequentially using the same /pages + /blocks endpoints, so canvas
  // autosave / history continue to work without any backend changes.
  // See premiumTemplates.js for the multi-page structure.
  const handlePremiumPick = async (templateId) => {
    setSkeletonPickerOpen(false);
    // Snapshot the insertion point so a state update during apply doesn't
    // affect this run (and reset the state right after picking).
    const insertAfter = insertAfterPageId;
    setInsertAfterPageId(null);
    try {
      const result = await applyPremiumTemplate(api, moodboardId, templateId, {
        insertAfterPageId: insertAfter,
        onProgress: (ev) => {
          if (ev.stage === 'start') {
            setProgress({
              active: true,
              templateName: ev.templateName,
              current: 0,
              total: ev.total,
              pages: ev.pages || [],
            });
          } else if (ev.stage === 'page') {
            setProgress((s) => ({
              ...s,
              active: true,
              current: ev.current,
              total: ev.total,
              templateName: ev.templateName,
              pages: ev.pages || s.pages,
            }));
          } else if (ev.stage === 'complete') {
            setProgress((s) => ({ ...s, current: ev.total, total: ev.total }));
            // Hold the "complete" frame for a beat before fading the
            // overlay — this is the moment the designer sees ALL chips
            // glow teal. Dismiss after 850ms.
            setTimeout(() => setProgress((s) => ({ ...s, active: false })), 850);
          }
        },
      });
      trackEvent('moodboard.premium_template_applied',
        { template_id: templateId, moodboard_id: moodboardId,
          pages_created: result?.pagesCreated, pages_total: result?.pagesTotal,
          blocks_created: result?.blocksCreated, blocks_total: result?.blocksTotal,
          inserted_after: insertAfter || null },
        { entityType: 'moodboard', entityId: moodboardId });
      if (result?.pageId) onSelect?.(result.pageId);
      onChange?.();
      if (result?.pagesCreated === 0) {
        toast.error(t('moodboards.premium.failed', null,
          'Template could not be applied. Please retry.'));
      } else if (result?.pagesCreated < result?.pagesTotal) {
        toast.warning(t('moodboards.premium.partialPages', null,
          `Multi-page template partially applied: ${result.pagesCreated}/${result.pagesTotal} pages.`));
      } else {
        const n = result.pagesCreated;
        const word = n === 1
          ? t('moodboards.premium.pageCount.singular', null, 'page')
          : t('moodboards.premium.pageCount.plural', null, 'pages');
        toast.success(t('moodboards.premium.appliedMulti', null,
          `Multi-page template applied: ${n} ${word} added.`));
      }
    } catch (err) {
      setProgress((s) => ({ ...s, active: false }));
      const detail = err?.response?.data?.detail || err?.message || 'unknown error';
      toast.error(t('moodboards.premium.applyFailed', null, `Could not apply template: ${detail}`));
    }
  };

  const handleDelete = async (e, pageId) => {
    e.stopPropagation();
    try {
      await api.delete(`/api/moodboards/${moodboardId}/pages/${pageId}`);
      onChange?.();
    } catch (_) { /* last-page guard */ }
  };

  const handleDuplicate = async (e, pageId) => {
    e.stopPropagation();
    const r = await api.post(`/api/moodboards/${moodboardId}/pages/${pageId}/duplicate`);
    onSelect?.(r.data.id);
    onChange?.();
  };

  const handleDragStart = (id) => { dragId.current = id; };
  const handleDrop = async (e, targetId) => {
    e.preventDefault();
    const fromId = dragId.current;
    dragId.current = null;
    if (!fromId || fromId === targetId) return;
    const ids = pages.map((p) => p.id);
    const fromIdx = ids.indexOf(fromId);
    const targetIdx = ids.indexOf(targetId);
    ids.splice(fromIdx, 1);
    ids.splice(targetIdx, 0, fromId);
    await api.post(`/api/moodboards/${moodboardId}/pages/reorder`, { page_ids: ids });
    onChange?.();
  };

  return (
    <>
      <footer data-testid="pages-filmstrip"
              className="flex-shrink-0 border-t border-[var(--bp-border)] bg-[var(--bp-surface-1)]/55 backdrop-blur-sm">
        <div className="overflow-x-auto overflow-y-hidden scroll-smooth">
          <ul className="flex items-end gap-1 px-7 py-4 min-w-fit">
            {pages.map((p, i) => {
              const active = p.id === currentPageId;
              const visual = PAGE_TYPE_VISUAL[p.page_type] || PAGE_TYPE_VISUAL.blank;
              const isLast = i === pages.length - 1;
              return (
                <React.Fragment key={p.id}>
                <li
                    draggable={!readOnly}
                    onDragStart={() => handleDragStart(p.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, p.id)}
                    onClick={() => onSelect?.(p.id)}
                    data-testid={`page-card-${p.id}`}
                    className="group flex flex-col items-center gap-2 cursor-pointer ml-2.5">
                  <div className={`relative rounded-[4px] transition-all duration-[var(--bp-duration-cinematic)] ease-[var(--bp-ease-emphasis)]
                                   ${active
                                     ? 'ring-1 ring-[var(--bp-primary)] scale-[1.045] -translate-y-0.5'
                                     : 'opacity-65 hover:opacity-100 hover:-translate-y-0.5 hover:ring-1 hover:ring-[var(--bp-border-strong)]'}`}
                       style={active
                         ? { boxShadow: '0 0 0 3px rgba(15,162,132,0.10), 0 14px 32px rgba(15,162,132,0.22), 0 2px 6px rgba(0,0,0,0.35)' }
                         : undefined}>
                    <MiniPreview page={p} blocks={blocksByPage?.[p.id] || []} active={active} />
                    {/* Page-type chip — ALWAYS visible, color-coded per type */}
                    <span
                      data-testid={`page-type-${p.id}`}
                      className="absolute top-1.5 left-1.5 px-1.5 py-[1.5px] rounded-[2px]
                                 text-[7.5px] tracking-[0.22em] uppercase font-body
                                 bg-black/55 backdrop-blur-sm transition-colors duration-300"
                      style={{ color: active ? visual.tone : 'rgba(255,255,255,0.75)' }}
                    >
                      {visual.label}
                    </span>
                    {/* Client decision badge — small colored dot in the corner. */}
                    {pageStatusById?.[p.id] && pageStatusById[p.id] !== 'pending_review' && (
                      <span
                        data-testid={`page-status-badge-${p.id}-${pageStatusById[p.id]}`}
                        title={pageStatusById[p.id]}
                        style={{
                          backgroundColor:
                            pageStatusById[p.id] === 'approved' ? 'var(--bp-primary)'
                            : pageStatusById[p.id] === 'revision_requested' ? '#E0A458'
                            : '#D86F6F',
                        }}
                        className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-[var(--bp-bg)]" />
                    )}
                    {!readOnly && (
                      <div className="absolute -bottom-2 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => handleDuplicate(e, p.id)}
                                data-testid={`page-duplicate-${p.id}`}
                                title={t('moodboards.page.duplicate')}
                                className="w-5 h-5 rounded-full bg-[var(--bp-surface-2)] hover:bg-[var(--bp-primary)] text-[var(--bp-text-muted)] hover:text-[var(--bp-bg)] flex items-center justify-center shadow-[var(--bp-shadow-sm)]">
                          <Copy size={9} strokeWidth={1.5} />
                        </button>
                        {pages.length > 1 && (
                          <button onClick={(e) => handleDelete(e, p.id)}
                                  data-testid={`page-delete-${p.id}`}
                                  title={t('moodboards.page.delete')}
                                  className="w-5 h-5 rounded-full bg-[var(--bp-surface-2)] hover:bg-red-500 text-[var(--bp-text-muted)] hover:text-white flex items-center justify-center shadow-[var(--bp-shadow-sm)]">
                            <Trash2 size={9} strokeWidth={1.5} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <p className={`bp-caption !text-[10px] tabular-nums whitespace-nowrap max-w-[120px] truncate transition-colors
                                 ${active ? '!text-[var(--bp-primary)] !font-medium' : '!text-[var(--bp-text-muted)]'}`}>
                    <span className="font-mono opacity-55 mr-1.5">{String(i + 1).padStart(2, '0')}</span>
                    {p.title || t('moodboards.page.untitled')}
                  </p>
                </li>
                {/* "Insert template here" — between-page affordance.
                    Hidden by default, fades in on hover of the spacer zone.
                    Sets insertAfterPageId then opens the picker so the chosen
                    template lands RIGHT AFTER this page instead of at the end. */}
                {!readOnly && !isLast && (
                  <li className="group/insert relative flex items-center self-stretch"
                      data-testid={`insert-after-${p.id}`}
                      style={{ width: 22 }}>
                    <button type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setInsertAfterPageId(p.id);
                              setSkeletonPickerOpen(true);
                            }}
                            data-testid={`insert-after-btn-${p.id}`}
                            title={t('moodboards.page.insertHere', null, 'Insert template here')}
                            className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[22px]
                                       flex items-center justify-center
                                       opacity-0 group-hover/insert:opacity-100
                                       transition-opacity duration-200">
                      <span className="block w-[1.5px] h-[60%] bg-[var(--bp-primary)]/40
                                       group-hover/insert:bg-[var(--bp-primary)] transition-colors" />
                      <span className="absolute w-6 h-6 rounded-full
                                       bg-[var(--bp-primary)] text-[var(--bp-bg)]
                                       flex items-center justify-center
                                       shadow-[0_0_18px_rgba(15,162,132,0.55)]
                                       scale-90 group-hover/insert:scale-100
                                       transition-transform duration-200">
                        <Plus size={12} strokeWidth={2.2} />
                      </span>
                    </button>
                  </li>
                )}
                </React.Fragment>
              );
            })}
            {!readOnly && (
              <li className="ml-2.5">
                <button onClick={() => { setInsertAfterPageId(null); setSkeletonPickerOpen(true); }}
                        data-testid="add-page-btn"
                        className="group flex flex-col items-center gap-2 cursor-pointer">
                  <div className="w-[112px] h-[150px] rounded-[4px]
                                  bg-[var(--bp-surface-2)]/25 hover:bg-[var(--bp-surface-2)]/45
                                  border border-dashed border-[var(--bp-border)] hover:border-[var(--bp-primary)]/65
                                  transition-all duration-300 flex flex-col items-center justify-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[var(--bp-primary)]/12 border border-[var(--bp-primary)]/35
                                    text-[var(--bp-primary)]
                                    group-hover:bg-[var(--bp-primary)]/22 group-hover:border-[var(--bp-primary)]/55
                                    transition-all flex items-center justify-center
                                    group-hover:scale-110 group-hover:shadow-[0_0_18px_rgba(15,162,132,0.35)]">
                      <Plus size={14} strokeWidth={1.7} />
                    </div>
                    <span className="text-[8.5px] tracking-[0.24em] uppercase text-[var(--bp-text-muted)]
                                     group-hover:text-[var(--bp-text-primary)] transition-colors">
                      {t('moodboards.page.new', null, 'New page')}
                    </span>
                  </div>
                  <p className="bp-caption !text-[10px] !text-[var(--bp-text-subtle)] whitespace-nowrap">
                    {t('moodboards.page.fromTemplate', null, 'from template')}
                  </p>
                </button>
              </li>
            )}
          </ul>
        </div>
      </footer>

      {skeletonPickerOpen && (
        <SkeletonPicker
          skeletons={skeletons}
          onPick={handleSkeletonPick}
          onPickPremium={handlePremiumPick}
          onClose={() => { setSkeletonPickerOpen(false); setInsertAfterPageId(null); }}
          insertAfterPageTitle={insertAfterPageId
            ? (pages.find((p) => p.id === insertAfterPageId)?.title || null)
            : null}
        />
      )}
      {/* Cinematic progress overlay — shown while a multi-page premium
          template is being applied. Owns its own backdrop so the editor
          underneath stays untouched. */}
      <TemplateProgressOverlay state={progress} />
    </>
  );
};

export default PagesFilmstrip;
