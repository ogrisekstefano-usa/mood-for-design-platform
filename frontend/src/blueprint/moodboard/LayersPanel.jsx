/**
 * LayersPanel — luxury floating layer manager for the Moodboard editor.
 *
 * Two interaction patterns coexist:
 *   1. ±1 nudge arrows (per-layer) — swap z_index with the immediate neighbor
 *      in the visual stack, NOT push to top/bottom.
 *   2. Native HTML5 Drag & Drop — drag a row onto another row to reorder.
 *      An insertion line indicates the drop position. After drop we re-emit
 *      a contiguous z_index sequence for the whole stack, so visual order and
 *      panel order stay 1:1 forever (no z-collisions).
 *
 * Persistence: every action calls back into the parent through `onAction` /
 * `onReorder`. The parent patches the affected blocks; autosave eventually
 * pushes the change to the API.
 *
 * Pure Blueprint-driven: all labels via t(), all colors via theme tokens.
 */
import React, { useRef, useState } from 'react';
import {
  Layers as LayersIcon,
  ChevronUp, ChevronDown, ChevronsUp, ChevronsDown,
  Lock, Unlock, Eye, EyeOff, Copy, Trash2, GripVertical,
} from 'lucide-react';

const BLOCK_ICON_MAP = {
  image:    'image',
  text:     'text',
  palette:  'palette',
  note:     'note',
  product:  'product',
  material: 'material',
};

// Sort: top-most first (highest z_index). Tie-break by created_at so the
// LayersPanel ordering is fully deterministic — same rule used in the canvas
// render path so panel ↔ canvas stay perfectly in sync. Newer blocks float
// to the top in the panel (which mirrors their visual "in front" position).
export const sortLayersTopFirst = (blocks) =>
  [...blocks].sort((a, b) => {
    const dz = (b.z_index || 0) - (a.z_index || 0);
    if (dz !== 0) return dz;
    return (b.created_at || '').localeCompare(a.created_at || '');
  });

const LayerRow = ({
  block, selected, onSelect, onAction, t,
  dragging, dropTarget, dropPosition,
  onDragStart, onDragOver, onDrop, onDragEnd,
}) => {
  const fallbackLabel = block.content?.caption
              || block.content?.text
              || block.content?.name
              || t(`moodboards.block.${block.type}`);
  // Custom rename persisted in metadata.layer_label. Falls back to derived
  // label so the LayersPanel keeps natural names for un-renamed blocks.
  const customLabel = block.metadata?.layer_label;
  const label = customLabel || fallbackLabel;

  const [renaming, setRenaming] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const commitRename = () => {
    const next = draft.trim();
    setRenaming(false);
    if (next && next !== customLabel) {
      onAction('rename', block, { layer_label: next });
    } else if (!next && customLabel) {
      // Empty rename → clear the custom label, restore fallback
      onAction('rename', block, { layer_label: null });
    }
  };

  const isDropTarget = dropTarget === block.id;
  const showIndicatorTop    = isDropTarget && dropPosition === 'above';
  const showIndicatorBottom = isDropTarget && dropPosition === 'below';

  return (
    <li
      data-testid={`layer-row-${block.id}`}
      draggable={!renaming}
      onDragStart={(e) => onDragStart(e, block.id)}
      onDragOver={(e) => onDragOver(e, block.id)}
      onDrop={(e) => onDrop(e, block.id)}
      onDragEnd={onDragEnd}
      onClick={() => onSelect(block.id)}
      className={`relative group flex items-center gap-1.5 px-2 py-1.5 rounded-[var(--bp-radius-xs)] cursor-pointer transition-colors ${
        selected
          ? 'bg-[var(--bp-primary)]/10 ring-1 ring-[var(--bp-primary)]/30'
          : 'hover:bg-[var(--bp-surface-2)]'
      } ${block.hidden ? 'opacity-50' : ''} ${dragging ? 'opacity-30' : ''}`}
    >
      {/* Drop-indicator line — sub-pixel hairline in primary accent with glow */}
      {showIndicatorTop && (
        <span data-testid="layer-drop-indicator-above"
              className="absolute left-1 right-1 -top-px h-[2px] bg-[var(--bp-primary)] rounded-full pointer-events-none shadow-[0_0_8px_var(--bp-primary)]" />
      )}
      {showIndicatorBottom && (
        <span data-testid="layer-drop-indicator-below"
              className="absolute left-1 right-1 -bottom-px h-[2px] bg-[var(--bp-primary)] rounded-full pointer-events-none shadow-[0_0_8px_var(--bp-primary)]" />
      )}

      <GripVertical
        size={10}
        strokeWidth={1.5}
        className="text-[var(--bp-text-subtle)] opacity-0 group-hover:opacity-100 transition-opacity cursor-grab flex-shrink-0"
      />

      <div className="w-6 h-6 flex-shrink-0 rounded-[var(--bp-radius-xs)] bg-[var(--bp-surface-2)] flex items-center justify-center">
        {block.image_url || block.content?.src
          ? <img src={block.image_url || block.content?.src} alt=""
                 className="w-full h-full object-cover rounded-[var(--bp-radius-xs)]" />
          : <span className="bp-caption !text-[9px] text-[var(--bp-text-muted)] uppercase">
              {(BLOCK_ICON_MAP[block.type] || block.type)?.slice(0, 1)}
            </span>}
      </div>

      {renaming ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') { setRenaming(false); }
            e.stopPropagation();
          }}
          onClick={(e) => e.stopPropagation()}
          data-testid={`layer-rename-input-${block.id}`}
          className="flex-1 bg-transparent border-b border-[var(--bp-primary)]
                     text-[var(--bp-text-primary)] text-[11px] py-0.5 focus:outline-none"
        />
      ) : (
        <span
          data-testid={`layer-label-${block.id}`}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setDraft(customLabel || '');
            setRenaming(true);
          }}
          className={`flex-1 bp-caption truncate text-[var(--bp-text-${selected ? 'primary' : 'secondary'})]`}>
          {label}
        </span>
      )}

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          data-testid={`layer-lock-${block.id}`}
          title={t(`moodboards.editor.${block.locked ? 'unlock' : 'lock'}`)}
          onClick={(e) => { e.stopPropagation(); onAction('toggleLock', block); }}
          className="p-1 text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]"
        >
          {block.locked
            ? <Lock size={11} strokeWidth={1.5} className="text-[var(--bp-primary)]" />
            : <Unlock size={11} strokeWidth={1.5} />}
        </button>
        <button
          data-testid={`layer-hide-${block.id}`}
          title={t(`moodboards.editor.${block.hidden ? 'show' : 'hide'}`)}
          onClick={(e) => { e.stopPropagation(); onAction('toggleHidden', block); }}
          className="p-1 text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]"
        >
          {block.hidden
            ? <EyeOff size={11} strokeWidth={1.5} />
            : <Eye size={11} strokeWidth={1.5} />}
        </button>
      </div>
    </li>
  );
};

const LayersPanel = ({ blocks, selectedId, onSelect, onAction, onReorder, t }) => {
  // Render top-most first — same sort key used by the canvas renderer
  const ordered = sortLayersTopFirst(blocks);
  const selectedBlock = blocks.find((b) => b.id === selectedId);

  const [dragId, setDragId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [dropPosition, setDropPosition] = useState(null); // 'above' | 'below'
  const dragMeta = useRef({ id: null });

  const handleDragStart = (e, id) => {
    dragMeta.current.id = id;
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    // Required for Firefox to fire dragover events
    try { e.dataTransfer.setData('text/plain', id); } catch (_) { /* noop */ }
  };

  const handleDragOver = (e, targetId) => {
    if (!dragMeta.current.id || dragMeta.current.id === targetId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientY - rect.top) < (rect.height / 2) ? 'above' : 'below';
    if (dropTarget !== targetId || dropPosition !== pos) {
      setDropTarget(targetId);
      setDropPosition(pos);
    }
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    const fromId = dragMeta.current.id;
    dragMeta.current.id = null;
    setDragId(null);
    setDropTarget(null);
    setDropPosition(null);
    if (!fromId || fromId === targetId || !onReorder) return;

    // Compute new ordered list of ids (top-most first)
    const ids = ordered.map((b) => b.id);
    const fromIdx = ids.indexOf(fromId);
    const targetIdx = ids.indexOf(targetId);
    if (fromIdx < 0 || targetIdx < 0) return;
    ids.splice(fromIdx, 1);
    // Re-resolve targetIdx after the splice — when moving down, targetIdx
    // shifts by 1 (the source row was above it)
    const adjustedTargetIdx = targetIdx > fromIdx ? targetIdx - 1 : targetIdx;
    const insertIdx = dropPosition === 'below' ? adjustedTargetIdx + 1 : adjustedTargetIdx;
    ids.splice(insertIdx, 0, fromId);
    onReorder(ids);
  };

  const handleDragEnd = () => {
    dragMeta.current.id = null;
    setDragId(null);
    setDropTarget(null);
    setDropPosition(null);
  };

  return (
    <div data-testid="layers-panel" className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--bp-border)]">
        <div className="flex items-center gap-1.5">
          <LayersIcon size={11} strokeWidth={1.5} className="text-[var(--bp-text-muted)]" />
          <p className="bp-eyebrow !text-[var(--bp-text-muted)]">{t('moodboards.editor.layers')}</p>
        </div>
        <span className="bp-caption !text-[10px] text-[var(--bp-text-subtle)]">{blocks.length}</span>
      </div>

      {/* Per-block toolbar for the selected block — ±1 nudge swaps z with neighbor */}
      {selectedBlock && (
        <div className="px-2 py-2 border-b border-[var(--bp-border)] grid grid-cols-6 gap-0.5">
          <LayerActionBtn icon={ChevronsUp}   title={t('moodboards.editor.bringToFront')}
                          onClick={() => onAction('bringToFront', selectedBlock)} testid="layer-action-front" />
          <LayerActionBtn icon={ChevronUp}    title={t('moodboards.editor.bringForward')}
                          onClick={() => onAction('bringForward', selectedBlock)} testid="layer-action-forward" />
          <LayerActionBtn icon={ChevronDown}  title={t('moodboards.editor.sendBackward')}
                          onClick={() => onAction('sendBackward', selectedBlock)} testid="layer-action-backward" />
          <LayerActionBtn icon={ChevronsDown} title={t('moodboards.editor.sendToBack')}
                          onClick={() => onAction('sendToBack', selectedBlock)} testid="layer-action-back" />
          <LayerActionBtn icon={Copy} title={t('moodboards.editor.duplicate')}
                          onClick={() => onAction('duplicate', selectedBlock)} testid="layer-action-duplicate" />
          <LayerActionBtn icon={Trash2} title={t('moodboards.editor.delete')}
                          danger onClick={() => onAction('delete', selectedBlock)}
                          testid="layer-action-delete" />
        </div>
      )}

      <ul className="flex-1 overflow-y-auto px-1 py-1 space-y-0.5"
          onDragOver={(e) => e.preventDefault()}>
        {ordered.map((b) => (
          <LayerRow
            key={b.id} block={b} selected={b.id === selectedId}
            onSelect={onSelect} onAction={onAction} t={t}
            dragging={dragId === b.id}
            dropTarget={dropTarget}
            dropPosition={dropPosition}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          />
        ))}
      </ul>
    </div>
  );
};

const LayerActionBtn = ({ icon: Icon, title, onClick, danger, testid }) => (
  <button
    title={title}
    data-testid={testid}
    onClick={onClick}
    className={`p-1.5 rounded-[var(--bp-radius-xs)] hover:bg-[var(--bp-surface-2)] flex items-center justify-center ${
      danger ? 'text-red-400 hover:text-red-300' : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]'
    }`}
  >
    <Icon size={12} strokeWidth={1.5} />
  </button>
);

export default LayersPanel;
