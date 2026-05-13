/**
 * PagesNavigator — left sidebar pages panel for Moodboard PRO.
 *
 *  - Vertical thumbnail list with sort_order from the API
 *  - Click → switch active page
 *  - Drag-to-reorder (HTML5 dnd, no extra deps)
 *  - + button at the bottom opens the Master Layouts™ skeleton picker
 *    instead of creating a blank page directly.
 *
 *  Blueprint-driven: every label comes from t(), every skeleton comes from
 *  /api/moodboards/_meta/page_skeletons (server-side catalog).
 */
import React, { useEffect, useRef, useState } from 'react';
import api from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { Plus, Copy, Trash2, GripVertical, X } from 'lucide-react';
import SkeletonPicker from './SkeletonPicker';

// ── Sub-component: tiny in-card mini canvas preview ─────────────────────────
const PagePreview = ({ page, blocks, scale = 0.08 }) => {
  const w = page.width * scale;
  const h = page.height * scale;
  return (
    <div className="relative overflow-hidden rounded-[var(--bp-radius-xs)] bg-[var(--bp-bg)] border border-[var(--bp-border)]"
         style={{ width: `${w}px`, height: `${h}px`, maxWidth: '100%' }}>
      {(blocks || []).filter((b) => !b.hidden).map((b) => {
        const x = (b.x ?? 40) * scale;
        const y = (b.y ?? 40) * scale;
        const bw = Math.max(2, (b.width ?? 320) * scale);
        const bh = Math.max(2, (b.height ?? 240) * scale);
        const tint = b.type === 'image'    ? 'rgba(255,255,255,0.12)'
                   : b.type === 'palette'  ? 'rgba(255,255,255,0.05)'
                   : b.type === 'material' ? 'rgba(214,197,168,0.18)'
                   : b.type === 'note'     ? 'rgba(255,213,128,0.10)'
                   : 'rgba(255,255,255,0.05)';
        return (
          <div key={b.id}
               className="absolute"
               style={{
                 left: `${x}px`, top: `${y}px`,
                 width: `${bw}px`, height: `${bh}px`,
                 background: tint,
                 borderRadius: '1px',
               }} />
        );
      })}
    </div>
  );
};

// ── Main component ──────────────────────────────────────────────────────────
const PagesNavigator = ({ moodboardId, pages, currentPageId, blocksByPage, onSelect, onChange, readOnly }) => {
  const { t } = useBlueprint();
  const [skeletonPickerOpen, setSkeletonPickerOpen] = useState(false);
  const dragId = useRef(null);

  // Page skeletons catalog — loaded once. Frontend NEVER hardcodes layouts.
  const [skeletons, setSkeletons] = useState(null);
  useEffect(() => {
    api.get('/api/moodboards/_meta/page_skeletons')
      .then((r) => setSkeletons(r.data?.data || []))
      .catch(() => setSkeletons([]));
  }, []);

  const handleSkeletonPick = async (skeletonId) => {
    setSkeletonPickerOpen(false);
    const r = await api.post(`/api/moodboards/${moodboardId}/pages/from_skeleton`,
                             { skeleton_id: skeletonId });
    onSelect?.(r.data.id);
    onChange?.();
  };

  const handleDelete = async (e, pageId) => {
    e.stopPropagation();
    try {
      await api.delete(`/api/moodboards/${moodboardId}/pages/${pageId}`);
      onChange?.();
    } catch (_) { /* last-page guard surfaces via UI; ignore here */ }
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
      <aside data-testid="pages-navigator"
             className="relative w-[200px] flex-shrink-0 border-r border-[var(--bp-border)] bg-[var(--bp-surface-1)]/50 flex flex-col min-h-0">
        <div className="px-3 pt-4 pb-2 flex items-center justify-between">
          <p className="bp-eyebrow !text-[9px] !text-[var(--bp-text-muted)]">{t('moodboards.page.eyebrow')}</p>
          {!readOnly && (
            <button onClick={() => setSkeletonPickerOpen(true)}
                    data-testid="add-page-btn"
                    title={t('moodboards.page.add')}
                    className="w-6 h-6 flex items-center justify-center rounded-full
                               text-[var(--bp-text-muted)] hover:text-[var(--bp-primary)]
                               hover:bg-[var(--bp-surface-2)] transition-colors">
              <Plus size={12} strokeWidth={1.5} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2 min-h-0">
          {pages.map((p, i) => {
            const active = p.id === currentPageId;
            return (
              <div key={p.id}
                   draggable={!readOnly}
                   onDragStart={() => handleDragStart(p.id)}
                   onDragOver={(e) => e.preventDefault()}
                   onDrop={(e) => handleDrop(e, p.id)}
                   onClick={() => onSelect?.(p.id)}
                   data-testid={`page-card-${p.id}`}
                   className={`group cursor-pointer p-2 rounded-[var(--bp-radius-sm)] border transition-all
                     ${active
                       ? 'border-[var(--bp-primary)] bg-[var(--bp-surface-2)]'
                       : 'border-[var(--bp-border)] hover:border-[var(--bp-border-strong)] bg-[var(--bp-surface-1)]'}`}>
                <div className="flex items-start gap-1.5 mb-1.5">
                  <span className="bp-caption !text-[9px] text-[var(--bp-text-subtle)] mt-0.5">{i + 1}</span>
                  <p className="bp-body !text-[11px] !font-medium text-[var(--bp-text-primary)] flex-1 truncate">
                    {p.title || t('moodboards.page.untitled')}
                  </p>
                  {!readOnly && (
                    <GripVertical size={10} strokeWidth={1.5}
                                  className="text-[var(--bp-text-subtle)] opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
                  )}
                </div>
                <div className="flex justify-center">
                  <PagePreview page={p} blocks={blocksByPage?.[p.id] || []} />
                </div>
                <p className="bp-caption !text-[9px] !text-[var(--bp-text-muted)] mt-1.5 truncate">
                  {t(`moodboards.page.type.${p.page_type}`) || p.page_type}
                </p>
                {!readOnly && (
                  <div className="flex gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => handleDuplicate(e, p.id)}
                            data-testid={`page-duplicate-${p.id}`}
                            title={t('moodboards.page.duplicate')}
                            className="bp-caption !text-[10px] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] p-1">
                      <Copy size={10} strokeWidth={1.5} />
                    </button>
                    {pages.length > 1 && (
                      <button onClick={(e) => handleDelete(e, p.id)}
                              data-testid={`page-delete-${p.id}`}
                              title={t('moodboards.page.delete')}
                              className="bp-caption !text-[10px] text-[var(--bp-text-muted)] hover:text-red-400 p-1">
                        <Trash2 size={10} strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Inline "Add page" tile — always visible at the end of the list,
              scrolls with the pages so it never gets cut off by overflow. */}
          {!readOnly && (
            <button onClick={() => setSkeletonPickerOpen(true)}
                    data-testid="add-page-inline-btn"
                    className="group w-full p-2 rounded-[var(--bp-radius-sm)] border border-dashed
                               border-[var(--bp-border)] hover:border-[var(--bp-primary)]
                               bg-transparent hover:bg-[var(--bp-surface-1)]/60 transition-colors
                               flex flex-col items-center justify-center gap-1.5">
              <div className="w-7 h-7 rounded-full flex items-center justify-center
                              border border-[var(--bp-border)] group-hover:border-[var(--bp-primary)]
                              text-[var(--bp-text-muted)] group-hover:text-[var(--bp-primary)] transition-colors">
                <Plus size={12} strokeWidth={1.5} />
              </div>
              <span className="bp-caption !text-[10px] !text-[var(--bp-text-muted)] group-hover:text-[var(--bp-text-primary)] transition-colors">
                {t('moodboards.page.add')}
              </span>
            </button>
          )}
        </div>
      </aside>

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

export default PagesNavigator;
