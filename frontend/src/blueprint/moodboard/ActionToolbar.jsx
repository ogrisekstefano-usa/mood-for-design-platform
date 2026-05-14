/**
 * ActionToolbar — centered CANVAS ACTION strip (Sprint: Editor IA Refactor).
 *
 * Strict scope after the IA refactor (locked by the user):
 *   ACTIONS ONLY · NEVER content insertion.
 *
 * Allowed groups:
 *   • Pointer    : Select · Deselect · Move · Resize
 *   • View       : Zoom (placeholder — coming soon)
 *   • Arrange    : Align (placeholder — coming soon)
 *
 * Insert/decoration tools (text · image · gallery · product · material ·
 * palette · shape · arrow · note · hotspot) used to live here too. They have
 * been moved to the LEFT SECONDARY PANEL's Insert tab — single source of
 * truth for content insertion. Do NOT re-add them here.
 *
 * Snap toggle, undo/redo, present, share/review live in the editor's slim
 * action header just above this strip — they remain there because they are
 * global canvas actions, not content actions.
 */
import React from 'react';
import { MousePointer2, Square, Move, Scale, ZoomIn, AlignVerticalSpaceAround } from 'lucide-react';

const TOOL_GROUPS = [
  // pointer tools — first group always active "select"
  [
    { key: 'select',   icon: MousePointer2, kind: 'pointer' },
    { key: 'deselect', icon: Square,        kind: 'pointer' },
    { key: 'move',     icon: Move,          kind: 'pointer' },
    { key: 'resize',   icon: Scale,         kind: 'pointer' },
  ],
  // view tools — placeholder until the zoom primitive ships
  [
    { key: 'zoom',     icon: ZoomIn,                       disabled: true },
  ],
  // arrange tools — placeholder until align primitives ship
  [
    { key: 'align',    icon: AlignVerticalSpaceAround,     disabled: true },
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

// Editorial labels — kept short, never duplicating the Insert panel terminology.
const LABEL_FALLBACK = {
  select:   'Select',
  deselect: 'Deselect',
  move:     'Move',
  resize:   'Resize',
  zoom:     'Zoom',
  align:    'Align',
};

const ActionToolbar = ({ activeTool = 'select', onToolChange, t }) => {
  const handleClick = (tool) => {
    if (tool.kind === 'pointer') onToolChange?.(tool.key);
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
                         label={t(`moodboards.tool.${tool.key}`, null, LABEL_FALLBACK[tool.key])} />
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
