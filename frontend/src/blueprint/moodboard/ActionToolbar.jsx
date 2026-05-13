/**
 * ActionToolbar — horizontal action toolbar above the canvas.
 *
 * Mirror of the reference mockup's centered tool strip. Each tool is an
 * icon + label pair with a tooltip; spacing is intentionally generous so the
 * row reads as a single editorial element rather than a cluttered ribbon.
 *
 * Active state (currently only for the "select" pointer tool) shows a teal
 * underline + brighter foreground.
 *
 * Items grouped:
 *   • Pointer tools   : Seleziona · Deseleziona · Sposta · Ridimensiona
 *   • Insert tools    : Testo · Immagine · Galleria · Prodotto · Materiale
 *   • Decoration tools: Forma · Linea · Hotspot · Note
 *
 * Future-ready tools (Forma, Linea, Hotspot, Galleria) render as elegant
 * disabled icons until their primitives ship.
 */
import React from 'react';
import {
  MousePointer2, Square, Move, Scale, Type, Image as ImageIcon,
  LayoutGrid, Package, Layers, Hexagon, Minus, Crosshair, StickyNote,
} from 'lucide-react';

const TOOL_GROUPS = [
  // pointer tools — first group always active "select"
  [
    { key: 'select',      icon: MousePointer2, kind: 'pointer' },
    { key: 'deselect',    icon: Square,        kind: 'pointer' },
    { key: 'move',        icon: Move,          kind: 'pointer' },
    { key: 'resize',      icon: Scale,         kind: 'pointer' },
  ],
  // insert tools — primary block creation
  [
    { key: 'text',     icon: Type,        block: 'text' },
    { key: 'image',    icon: ImageIcon,   block: 'image' },
    { key: 'gallery',  icon: LayoutGrid,  skeleton: 'gallery_spread' },
    { key: 'product',  icon: Package,     block: 'product' },
    { key: 'material', icon: Layers,      block: 'material' },
  ],
  // decoration — palette / quote / note
  [
    { key: 'palette', icon: Hexagon, block: 'palette' },
    { key: 'shape',   icon: Square,  disabled: true },
    { key: 'line',    icon: Minus,   disabled: true },
    { key: 'hotspot', icon: Crosshair, disabled: true },
    { key: 'note',    icon: StickyNote, block: 'note' },
  ],
];

const ToolBtn = ({ tool, active, onClick, label }) => {
  const Icon = tool.icon;
  const disabled = !!tool.disabled;
  return (
    <button type="button"
            onClick={disabled ? undefined : onClick}
            disabled={disabled}
            data-testid={`tool-${tool.key}`}
            title={`${label}${disabled ? ' · coming soon' : ''}`}
            className={`group flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-[var(--bp-radius-xs)]
                        transition-colors min-w-[58px]
                        ${disabled
                          ? 'text-[var(--bp-text-subtle)] opacity-35 cursor-not-allowed'
                          : active
                            ? 'text-[var(--bp-primary)]'
                            : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] hover:bg-[var(--bp-surface-1)]/60'}`}>
      <Icon size={16} strokeWidth={1.25} />
      <span className="bp-caption !text-[9px] !tracking-[0.06em] leading-none whitespace-nowrap">
        {label}
      </span>
      {active && (
        <span className="block h-[1.5px] w-7 mt-0.5 bg-[var(--bp-primary)] rounded-full" />
      )}
    </button>
  );
};

const ActionToolbar = ({ onAddBlock, onOpenSkeleton, activeTool = 'select', onToolChange, t }) => {
  const handleClick = (tool) => {
    if (tool.kind === 'pointer') {
      onToolChange?.(tool.key);
    } else if (tool.block) {
      onAddBlock?.(tool.block);
    } else if (tool.skeleton) {
      onOpenSkeleton?.(tool.skeleton);
    }
  };

  return (
    <div data-testid="action-toolbar"
         className="flex-shrink-0 px-6 py-3 border-b border-[var(--bp-border)] bg-[var(--bp-surface-1)]/45 backdrop-blur-sm">
      <div className="flex items-center justify-center gap-6 flex-wrap">
        {TOOL_GROUPS.map((group, i) => (
          <React.Fragment key={i}>
            <div className="flex items-center gap-1">
              {group.map((tool) => (
                <ToolBtn key={tool.key} tool={tool}
                         active={tool.kind === 'pointer' && tool.key === activeTool}
                         onClick={() => handleClick(tool)}
                         label={t(`moodboards.tool.${tool.key}`)} />
              ))}
            </div>
            {i < TOOL_GROUPS.length - 1 && (
              <span className="w-px h-7 bg-[var(--bp-border)]" aria-hidden="true" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default ActionToolbar;
