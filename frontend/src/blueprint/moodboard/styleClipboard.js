/**
 * Clipboard for block STYLE only (not content).
 *
 *   - Single in-memory slot shared editor-wide (window-attached so it
 *     survives React reconciliation and works across multiple inspector
 *     instances simultaneously).
 *   - Copies the `style` and `metadata.typography_preset` payload from a
 *     source block; paste merges those keys onto the target block.
 *   - Used by Copy/Paste Style buttons in the inspector and the
 *     keyboard shortcut Cmd+Alt+C / Cmd+Alt+V.
 *
 *   This is intentionally NOT redux/zustand — a single global is the
 *   simplest possible thing that survives the user's session.
 */
const KEY = '__mfd_style_clipboard__';

export function copyStyle(block) {
  if (!block) return;
  if (typeof window === 'undefined') return;
  // Snapshot just enough of the style to be portable. We don't copy size
  // or position — Copy Style is a TYPE-level operation, not a clone.
  window[KEY] = {
    block_type: block.type,
    style: { ...(block.style || {}) },
    opacity: block.opacity,
    rotation: block.rotation,
    // For text blocks we additionally carry list_style/size from content
    // (those affect appearance but are stored on content, not style).
    text_meta: block.type === 'text'
      ? {
          size: block.content?.size,
          list_style: block.content?.list_style,
        }
      : null,
  };
}

export function pasteStyle(block) {
  if (!block || typeof window === 'undefined') return null;
  const clip = window[KEY];
  if (!clip) return null;
  // Only paste when the source/target are compatible types — otherwise
  // typography would land on an image block, etc.
  if (clip.block_type !== block.type) return null;
  return {
    style: { ...(block.style || {}), ...(clip.style || {}) },
    opacity: clip.opacity !== undefined ? clip.opacity : block.opacity,
    rotation: clip.rotation !== undefined ? clip.rotation : block.rotation,
    ...(clip.text_meta
      ? {
          content: { ...(block.content || {}), ...clip.text_meta },
        }
      : {}),
  };
}

export function hasClipboardStyle() {
  return typeof window !== 'undefined' && !!window[KEY];
}

export function clipboardBlockType() {
  if (typeof window === 'undefined') return null;
  return window[KEY]?.block_type || null;
}
