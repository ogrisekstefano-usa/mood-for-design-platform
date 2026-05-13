/**
 * PagesNavigator — left sidebar pages panel for Moodboard PRO.
 *
 *  - Vertical thumbnail list with sort_order from the API
 *  - Click → switch active page
 *  - Drag-to-reorder (HTML5 dnd, no extra deps)
 *  - + button at the bottom opens an aspect-ratio + type picker
 *  - Each card exposes hover actions: duplicate · delete · rename
 *
 *  Blueprint-driven: every label comes from t(), every preset comes from the
 *  /api/moodboards/_meta/page_presets registry.
 */
import React, { useEffect, useRef, useState } from 'react';
import api from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { Plus, Copy, Trash2, GripVertical, X } from 'lucide-react';

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

// ── Sub-component: add-page picker ──────────────────────────────────────────
const AddPagePicker = ({ presets, onAdd, onClose, t }) => {
  const [ratio, setRatio] = useState('portrait_a4');
  const [type, setType] = useState('blank');
  const submit = () => { onAdd({ aspect_ratio: ratio, page_type: type }); onClose(); };
  return (
    <div className="absolute bottom-12 left-3 right-3 bp-glass p-3 rounded-[var(--bp-radius-sm)] z-40"
         data-testid="add-page-picker"
         onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-2">
        <p className="bp-eyebrow !text-[9px] !text-[var(--bp-text-muted)]">{t('moodboards.page.add')}</p>
        <button onClick={onClose} className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]">
          <X size={11} strokeWidth={1.5} />
        </button>
      </div>

      <label className="bp-caption !text-[10px] !text-[var(--bp-text-muted)] block mb-1">Aspect</label>
      <select value={ratio} onChange={(e) => setRatio(e.target.value)}
              data-testid="add-page-ratio"
              className="input-luxury w-full text-[11px] px-2 py-1.5 mb-2 rounded-[var(--bp-radius-xs)]">
        {presets?.aspect_ratios?.map((r) => (
          <option key={r.id} value={r.id}>{t(r.label_key) || r.id}</option>
        ))}
      </select>

      <label className="bp-caption !text-[10px] !text-[var(--bp-text-muted)] block mb-1">Type</label>
      <select value={type} onChange={(e) => setType(e.target.value)}
              data-testid="add-page-type"
              className="input-luxury w-full text-[11px] px-2 py-1.5 mb-2 rounded-[var(--bp-radius-xs)]">
        {presets?.page_types?.map((p) => (
          <option key={p.id} value={p.id}>{t(p.label_key) || p.id}</option>
        ))}
      </select>

      <button onClick={submit} data-testid="add-page-confirm"
              className="bp-btn bp-btn-primary text-[11px] w-full">
        {t('moodboards.page.add')}
      </button>
    </div>
  );
};

// ── Main component ──────────────────────────────────────────────────────────
const PagesNavigator = ({ moodboardId, pages, currentPageId, blocksByPage, onSelect, onChange, readOnly }) => {
  const { t } = useBlueprint();
  const [presets, setPresets] = useState(null);
  const [picker, setPicker] = useState(false);
  const dragId = useRef(null);

  useEffect(() => {
    api.get('/api/moodboards/_meta/page_presets').then((r) => setPresets(r.data)).catch(() => {});
  }, []);

  const handleAdd = async (payload) => {
    const r = await api.post(`/api/moodboards/${moodboardId}/pages`, payload);
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
    <aside data-testid="pages-navigator"
           className="relative w-[200px] flex-shrink-0 border-r border-[var(--bp-border)] bg-[var(--bp-surface-1)]/50 flex flex-col min-h-0">
      <div className="px-3 pt-4 pb-2 flex items-center justify-between">
        <p className="bp-eyebrow !text-[9px] !text-[var(--bp-text-muted)]">{t('moodboards.page.eyebrow')}</p>
        {!readOnly && (
          <button onClick={() => setPicker(true)}
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
            scrolls with the pages so it never gets cut off by overflow.   */}
        {!readOnly && (
          <button onClick={() => setPicker(true)}
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

      {/* Sticky bottom picker overlay */}
      {picker && (
        <div className="absolute bottom-2 left-3 right-3 z-40">
          <AddPagePicker presets={presets} onAdd={handleAdd} onClose={() => setPicker(false)} t={t} />
        </div>
      )}
    </aside>
  );
};

export default PagesNavigator;
