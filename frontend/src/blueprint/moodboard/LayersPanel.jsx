/**
 * LayersPanel — luxury floating layer manager for the Moodboard editor.
 *
 * Pure Blueprint-driven:
 *   - all labels via t()
 *   - no hardcoded colors (theme tokens only)
 *
 * Persistence: every action calls back into the parent which patches the block;
 * the parent's autosave debouncer eventually pushes the change to the API.
 */
import React from 'react';
import {
  Layers as LayersIcon,
  ChevronUp, ChevronDown, ChevronsUp, ChevronsDown,
  Lock, Unlock, Eye, EyeOff, Copy, Trash2,
} from 'lucide-react';

const BLOCK_ICON_MAP = {
  image:    'image',
  text:     'text',
  palette:  'palette',
  note:     'note',
  product:  'product',
  material: 'material',
};

const LayerRow = ({ block, selected, onSelect, onAction, t }) => {
  const label = block.content?.caption
              || block.content?.text
              || block.content?.name
              || t(`moodboards.block.${block.type}`);
  return (
    <li
      data-testid={`layer-row-${block.id}`}
      onClick={() => onSelect(block.id)}
      className={`group flex items-center gap-2 px-2 py-1.5 rounded-[var(--bp-radius-xs)] cursor-pointer transition-colors ${
        selected
          ? 'bg-[var(--bp-primary)]/10 ring-1 ring-[var(--bp-primary)]/30'
          : 'hover:bg-[var(--bp-surface-2)]'
      } ${block.hidden ? 'opacity-50' : ''}`}
    >
      <div className="w-6 h-6 flex-shrink-0 rounded-[var(--bp-radius-xs)] bg-[var(--bp-surface-2)] flex items-center justify-center">
        {block.image_url || block.content?.src
          ? <img src={block.image_url || block.content?.src} alt=""
                 className="w-full h-full object-cover rounded-[var(--bp-radius-xs)]" />
          : <span className="bp-caption !text-[9px] text-[var(--bp-text-muted)] uppercase">
              {(BLOCK_ICON_MAP[block.type] || block.type)?.slice(0, 1)}
            </span>}
      </div>
      <span className={`flex-1 bp-caption truncate text-[var(--bp-text-${selected ? 'primary' : 'secondary'})]`}>
        {label}
      </span>
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

const LayersPanel = ({ blocks, selectedId, onSelect, onAction, t }) => {
  // Render top-most first (highest z_index)
  const ordered = [...blocks].sort((a, b) => (b.z_index || 0) - (a.z_index || 0));
  const selectedBlock = blocks.find((b) => b.id === selectedId);

  return (
    <div data-testid="layers-panel" className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--bp-border)]">
        <div className="flex items-center gap-1.5">
          <LayersIcon size={11} strokeWidth={1.5} className="text-[var(--bp-text-muted)]" />
          <p className="bp-eyebrow !text-[var(--bp-text-muted)]">{t('moodboards.editor.layers')}</p>
        </div>
        <span className="bp-caption !text-[10px] text-[var(--bp-text-subtle)]">{blocks.length}</span>
      </div>

      {/* Per-block toolbar for the selected block */}
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

      <ul className="flex-1 overflow-y-auto px-1 py-1 space-y-0.5">
        {ordered.map((b) => (
          <LayerRow key={b.id} block={b} selected={b.id === selectedId}
                    onSelect={onSelect} onAction={onAction} t={t} />
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
