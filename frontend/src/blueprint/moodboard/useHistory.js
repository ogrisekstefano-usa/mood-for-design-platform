/**
 * useHistory — minimal local undo/redo stack for the moodboard editor.
 *
 * Scope:
 *  - Session-only, in-memory
 *  - Per-editor instance (no cross-tab sync, no CRDT, no remote merge)
 *  - Captures full snapshots of the `blocks` array (it stays small — < 100 items)
 *
 * API:
 *  - record(blocks)        snapshot AFTER a committed mutation
 *  - undo() / redo()       returns the snapshot to restore (or null)
 *  - canUndo / canRedo     boolean derived state
 *  - reset(blocks)         clear the stack and seed with an initial snapshot
 */
import { useCallback, useRef, useState } from 'react';

const MAX_ENTRIES = 50;

const clone = (blocks) => JSON.parse(JSON.stringify(blocks || []));

export default function useHistory() {
  const stackRef = useRef([]);   // array<snapshot>
  const cursorRef = useRef(-1);  // index of current state in stack
  const [version, setVersion] = useState(0); // forces re-render on stack change

  const refresh = () => setVersion((v) => v + 1);

  const reset = useCallback((blocks) => {
    stackRef.current = [clone(blocks)];
    cursorRef.current = 0;
    refresh();
  }, []);

  const record = useCallback((blocks) => {
    // Drop any "future" entries beyond the cursor (we're branching off)
    const next = stackRef.current.slice(0, cursorRef.current + 1);
    next.push(clone(blocks));
    // Trim to MAX_ENTRIES from the start (oldest)
    while (next.length > MAX_ENTRIES) next.shift();
    stackRef.current = next;
    cursorRef.current = next.length - 1;
    refresh();
  }, []);

  const undo = useCallback(() => {
    if (cursorRef.current <= 0) return null;
    cursorRef.current -= 1;
    refresh();
    return clone(stackRef.current[cursorRef.current]);
  }, []);

  const redo = useCallback(() => {
    if (cursorRef.current >= stackRef.current.length - 1) return null;
    cursorRef.current += 1;
    refresh();
    return clone(stackRef.current[cursorRef.current]);
  }, []);

  return {
    record, undo, redo, reset,
    canUndo: cursorRef.current > 0,
    canRedo: cursorRef.current < stackRef.current.length - 1,
    _version: version,
  };
}
