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

// Tiny wireframe preview that renders the page's block geometry at scale.
const MiniPreview = ({ page, blocks }) => {
  const w = 96;
  const h = (page.height / page.width) * w;
  const scale = w / (page.width || 1400);
  return (
    <div className="relative overflow-hidden rounded-[var(--bp-radius-xs)] bg-[var(--bp-bg)] border border-[var(--bp-border)]"
         style={{ width: `${w}px`, height: `${h}px` }}>
      {(blocks || []).filter((b) => !b.hidden).map((b) => {
        const tint = b.type === 'image'    ? 'rgba(255,255,255,0.16)'
                   : b.type === 'palette'  ? 'rgba(255,255,255,0.08)'
                   : b.type === 'material' ? 'rgba(214,197,168,0.22)'
                   : b.type === 'product'  ? 'rgba(255,255,255,0.12)'
                   : 'rgba(255,255,255,0.06)';
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
    </div>
  );
};

const PagesFilmstrip = ({ moodboardId, pages, currentPageId, blocksByPage, onSelect, onChange, readOnly, pageStatusById }) => {
  const { t } = useBlueprint();
  const [skeletonPickerOpen, setSkeletonPickerOpen] = useState(false);
  const [skeletons, setSkeletons] = useState(null);
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
    const r = await api.post(`/api/moodboards/${moodboardId}/pages/from_skeleton`,
                             { skeleton_id: skeletonId });
    trackEvent('moodboard.skeleton_applied',
      { skeleton_id: skeletonId, moodboard_id: moodboardId },
      { entityType: 'moodboard', entityId: moodboardId });
    onSelect?.(r.data.id);
    onChange?.();
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
        <div className="overflow-x-auto overflow-y-hidden">
          <ul className="flex items-end gap-3 px-6 py-3 min-w-fit">
            {pages.map((p, i) => {
              const active = p.id === currentPageId;
              return (
                <li key={p.id}
                    draggable={!readOnly}
                    onDragStart={() => handleDragStart(p.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, p.id)}
                    onClick={() => onSelect?.(p.id)}
                    data-testid={`page-card-${p.id}`}
                    className="group flex flex-col items-center gap-1.5 cursor-pointer">
                  <div className={`relative rounded-[var(--bp-radius-xs)] transition-all duration-300
                                   ${active
                                     ? 'ring-1 ring-[var(--bp-primary)] shadow-[0_0_0_3px_rgba(15,162,132,0.12),0_8px_28px_rgba(15,162,132,0.18)]'
                                     : 'opacity-60 hover:opacity-100 hover:ring-1 hover:ring-[var(--bp-border-strong)]'}`}>
                    <MiniPreview page={p} blocks={blocksByPage?.[p.id] || []} />
                    {/* Page-type indicator — a soft eyebrow chip in the corner so
                        the user can read the narrative rhythm at a glance. */}
                    {p.page_type && p.page_type !== 'cover' && (
                      <span
                        data-testid={`page-type-${p.id}`}
                        className="absolute bottom-1 left-1 px-1.5 py-[1px] rounded-full
                                   text-[7px] tracking-[0.18em] uppercase font-body
                                   bg-black/45 text-white/85 backdrop-blur-sm
                                   opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {p.page_type.replace(/_/g, ' ')}
                      </span>
                    )}
                    {/* Client decision badge — small colored dot in the corner.
                        Shown only when collab data is available + status is set. */}
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
                        className="absolute -top-1.5 -left-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-[var(--bp-bg)]" />
                    )}
                    {!readOnly && (
                      <div className="absolute -top-1 -right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
                  <p className={`bp-caption !text-[10px] tabular-nums whitespace-nowrap
                                 ${active ? '!text-[var(--bp-primary)]' : '!text-[var(--bp-text-muted)]'}`}>
                    <span className="font-mono opacity-60 mr-1">{String(i + 1).padStart(2, '0')}</span>
                    {p.title || t('moodboards.page.untitled')}
                  </p>
                </li>
              );
            })}
            {!readOnly && (
              <li>
                <button onClick={() => setSkeletonPickerOpen(true)}
                        data-testid="add-page-btn"
                        className="group flex flex-col items-center gap-1.5 cursor-pointer">
                  <div className="w-24 h-[136px] rounded-[var(--bp-radius-xs)]
                                  bg-[var(--bp-surface-2)]/30 hover:bg-[var(--bp-surface-2)]/50
                                  border border-[var(--bp-border)] hover:border-[var(--bp-primary)]/60
                                  transition-all duration-200 flex flex-col items-center justify-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[var(--bp-primary)]/12 border border-[var(--bp-primary)]/30
                                    text-[var(--bp-primary)]
                                    group-hover:bg-[var(--bp-primary)]/22 group-hover:border-[var(--bp-primary)]/55
                                    transition-colors flex items-center justify-center">
                      <Plus size={13} strokeWidth={1.8} />
                    </div>
                    <span className="text-[8px] tracking-[0.22em] uppercase text-[var(--bp-text-muted)]
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
          onClose={() => setSkeletonPickerOpen(false)}
        />
      )}
    </>
  );
};

export default PagesFilmstrip;
