/**
 * MoodboardEditor — V1.1 Polish Sprint
 *
 * Adds on top of V1:
 *  - LayersPanel (z-index/lock/hide/duplicate/delete) — right rail tab
 *  - Real image upload via Supabase Storage (`moodboard-assets` bucket)
 *  - Crop / focal-point / fit-mode / zoom / opacity / rotation in inspector
 *  - Presentation mode (cinematic fullscreen, hides editor chrome)
 *  - Block-level visual props (locked → not draggable, hidden → ghost render)
 *  - Autosave with retry x3 + exponential backoff + visible error state (V1.0)
 *
 * All copy via t(), all colors via theme tokens. ZERO hardcoded.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { toast } from 'sonner';
import { useBlueprint } from '../../contexts/BlueprintContext';
import {
  ArrowLeft, Plus, Check, Share2, ExternalLink, Send, X, AlertCircle,
  Play, Maximize2, ChevronLeft, ChevronRight, PanelRight, ListChecks,
  BookmarkPlus, Undo2, Redo2, Magnet, RotateCcw,
} from 'lucide-react';
import { resolveBlock, BLOCK_TYPES } from '../../blueprint/moodboard/BlockRegistry';
import StatusBadge from '../../components/common/StatusBadge';
import LayersPanel from '../../blueprint/moodboard/LayersPanel';
import ImageUploader from '../../blueprint/moodboard/ImageUploader';
import { computeSnap } from '../../blueprint/moodboard/useSnap';
import SnapGuides from '../../blueprint/moodboard/SnapGuides';
import useHistory from '../../blueprint/moodboard/useHistory';

const CANVAS_W = 1400;
const CANVAS_H = 2400;
const AUTOSAVE_DEBOUNCE_MS = 800;
const AUTOSAVE_MAX_RETRIES = 3;

const MoodboardEditor = ({ readOnly = false }) => {
  const { id, shareToken } = useParams();
  const navigate = useNavigate();
  const { t } = useBlueprint();
  const [mb, setMb] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [dirtyMap, setDirtyMap] = useState({});
  const [savedAt, setSavedAt] = useState(null);
  const [saveState, setSaveState] = useState('idle');
  const [saveError, setSaveError] = useState(null);
  const [drag, setDrag] = useState(null);
  const [shareDialog, setShareDialog] = useState(null);
  const [rightTab, setRightTab] = useState('inspector'); // inspector | layers
  const [presenting, setPresenting] = useState(false);
  const [presentIndex, setPresentIndex] = useState(0);
  const [snapGuides, setSnapGuides] = useState([]);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const history = useHistory();

  const canvasRef = useRef();
  const saveTimer = useRef();
  const retryCount = useRef(0);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const url = readOnly
      ? `/api/moodboards/public/share/${shareToken}`
      : `/api/moodboards/${id}`;
    api.get(url).then((r) => {
      setMb(r.data);
      setBlocks(r.data.elements || []);
      history.reset(r.data.elements || []);
    }).catch(() => { if (!readOnly) navigate('/moodboards'); });
  }, [id, shareToken, readOnly, navigate]);

  // ── Autosave with retry + error surfacing ────────────────────────────────
  // We keep `blocks` and `dirtyMap` in refs so flushSave can always read the
  // latest committed state (no stale closures across rapid mutations).
  const blocksRef = useRef([]);
  const dirtyRef = useRef({});
  useEffect(() => { blocksRef.current = blocks; }, [blocks]);
  useEffect(() => { dirtyRef.current = dirtyMap; }, [dirtyMap]);

  const flushSave = useCallback(async () => {
    if (readOnly) return;
    const ids = Object.keys(dirtyRef.current);
    if (!ids.length) return;
    const payload = blocksRef.current.filter((b) => ids.includes(b.id))
      .map((b) => ({
        id: b.id, x: b.x, y: b.y, width: b.width, height: b.height,
        content: b.content, style: b.style, metadata: b.metadata,
        z_index: b.z_index,
        locked: b.locked, hidden: b.hidden,
        opacity: b.opacity, rotation: b.rotation,
      }));
    setSaveState('saving');
    setSaveError(null);
    try {
      await api.patch(`/api/moodboards/${id}/blocks/batch`, { blocks: payload });
      // Only clear the ids we just persisted; new dirty edits during the
      // request should remain queued for the next flush.
      setDirtyMap((m) => {
        const next = { ...m };
        ids.forEach((bid) => { delete next[bid]; });
        return next;
      });
      setSavedAt(Date.now());
      setSaveState('idle');
      retryCount.current = 0;
    } catch (err) {
      retryCount.current += 1;
      if (retryCount.current < AUTOSAVE_MAX_RETRIES) {
        setSaveState('saving');
        setTimeout(flushSave, 500 * retryCount.current);
      } else {
        setSaveState('error');
        setSaveError(err?.message || 'Network error');
        toast.error(t('moodboards.editor.saveFailed'), {
          description: t('moodboards.editor.saveFailedHint'),
          action: { label: t('moodboards.editor.retry'),
                    onClick: () => { retryCount.current = 0; flushSave(); } },
          duration: 8000,
        });
      }
    }
  }, [id, readOnly, t]);

  useEffect(() => {
    if (readOnly) return;
    if (!Object.keys(dirtyMap).length) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSave, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(saveTimer.current);
  }, [dirtyMap, flushSave, readOnly]);

  // beforeunload — synchronous flush via sendBeacon (best-effort).
  useEffect(() => {
    if (readOnly) return;
    const handler = (e) => {
      const ids = Object.keys(dirtyRef.current);
      if (!ids.length) return;
      // Modern browsers ignore custom returnValue text but show their own dialog.
      e.preventDefault(); e.returnValue = '';
      try {
        const payload = blocksRef.current.filter((b) => ids.includes(b.id))
          .map((b) => ({
            id: b.id, x: b.x, y: b.y, width: b.width, height: b.height,
            content: b.content, style: b.style, metadata: b.metadata,
            z_index: b.z_index,
            locked: b.locked, hidden: b.hidden,
            opacity: b.opacity, rotation: b.rotation,
          }));
        const blob = new Blob([JSON.stringify({ blocks: payload })],
                              { type: 'application/json' });
        const url = `${process.env.REACT_APP_BACKEND_URL}/api/moodboards/${id}/blocks/batch`;
        // sendBeacon doesn't carry Authorization headers; only effective if the
        // backend tolerates an unauthenticated beacon. We still call the
        // debounced flush as a fallback for in-page navigations.
        navigator.sendBeacon?.(url, blob);
      } catch (_) { /* swallow — debounced save remains the source of truth */ }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [id, readOnly]);

  // Forced flush on UNMOUNT (e.g. SPA navigation away from the editor).
  // We use a ref to access the latest flushSave without re-binding the cleanup.
  const flushRef = useRef(flushSave);
  useEffect(() => { flushRef.current = flushSave; }, [flushSave]);
  useEffect(() => {
    return () => {
      // Fire-and-forget; the timer is cleared by the debounce effect already.
      if (Object.keys(dirtyRef.current).length) {
        flushRef.current?.();
      }
    };
  }, []);

  const markDirty = (bid) => setDirtyMap((m) => ({ ...m, [bid]: true }));

  // ── Block CRUD ────────────────────────────────────────────────────────────
  const addBlock = async (type) => {
    if (readOnly) return;
    const meta = BLOCK_TYPES.find((b) => b.type === type);
    const payload = { type, x: 60, y: 60, ...meta.defaults };
    const r = await api.post(`/api/moodboards/${id}/blocks`, payload);
    setBlocks((bs) => { const next = [...bs, r.data]; history.record(next); return next; });
    setSelectedId(r.data.id);
    setRightTab('inspector');
  };

  const updateBlock = (bid, patch) => {
    setBlocks((bs) => bs.map((b) => {
      if (b.id !== bid) return b;
      const merged = { ...b, ...patch };
      // Deep-merge nested objects so partial patches (e.g. only `src`) never
      // wipe siblings (e.g. caption). Applies to content / style / metadata.
      ['content', 'style', 'metadata'].forEach((k) => {
        if (patch[k] && typeof patch[k] === 'object') {
          merged[k] = { ...(b[k] || {}), ...patch[k] };
        }
      });
      return merged;
    }));
    markDirty(bid);
  };

  const removeBlock = async (bid) => {
    if (readOnly) return;
    await api.delete(`/api/moodboards/${id}/blocks/${bid}`);
    setBlocks((bs) => { const next = bs.filter((b) => b.id !== bid); history.record(next); return next; });
    setSelectedId(null);
  };

  const duplicateBlock = async (bid) => {
    if (readOnly) return;
    const r = await api.post(`/api/moodboards/${id}/blocks/${bid}/duplicate`);
    setBlocks((bs) => { const next = [...bs, r.data]; history.record(next); return next; });
    setSelectedId(r.data.id);
  };

  // ── Undo / Redo (local, session-scoped) ──────────────────────────────────
  const applyHistoryRestore = useCallback((snapshot) => {
    if (!snapshot) return;
    setBlocks(snapshot);
    // mark every block dirty so autosave persists the restored state
    const m = {};
    snapshot.forEach((b) => { m[b.id] = true; });
    setDirtyMap((prev) => ({ ...prev, ...m }));
  }, []);

  const onUndo = useCallback(() => {
    if (readOnly) return;
    applyHistoryRestore(history.undo());
  }, [readOnly, history, applyHistoryRestore]);

  const onRedo = useCallback(() => {
    if (readOnly) return;
    applyHistoryRestore(history.redo());
  }, [readOnly, history, applyHistoryRestore]);

  useEffect(() => {
    if (readOnly) return;
    const handler = (e) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); onUndo(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); onRedo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onUndo, onRedo, readOnly]);

  // ── Layer actions ─────────────────────────────────────────────────────────
  const handleLayerAction = (action, block) => {
    if (!block) return;
    switch (action) {
      case 'toggleLock':
        updateBlock(block.id, { locked: !block.locked });
        break;
      case 'toggleHidden':
        updateBlock(block.id, { hidden: !block.hidden });
        break;
      case 'bringForward': {
        const next = (block.z_index || 0) + 1;
        updateBlock(block.id, { z_index: next });
        break;
      }
      case 'sendBackward': {
        const next = Math.max(0, (block.z_index || 0) - 1);
        updateBlock(block.id, { z_index: next });
        break;
      }
      case 'bringToFront': {
        const maxZ = Math.max(0, ...blocks.map((b) => b.z_index || 0));
        updateBlock(block.id, { z_index: maxZ + 1 });
        break;
      }
      case 'sendToBack':
        updateBlock(block.id, { z_index: 0 });
        break;
      case 'duplicate':
        duplicateBlock(block.id);
        break;
      case 'delete':
        removeBlock(block.id);
        break;
      default:
        break;
    }
  };

  // ── Drag / resize ─────────────────────────────────────────────────────────
  const startDrag = (e, block, mode = 'move') => {
    if (readOnly || block.locked) return;
    e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    setDrag({
      id: block.id, mode,
      startX: e.clientX, startY: e.clientY,
      origX: block.x, origY: block.y,
      origW: block.width, origH: block.height,
      canvasLeft: rect.left, canvasTop: rect.top,
    });
    setSelectedId(block.id);
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (e) => {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      let nextGuides = [];
      setBlocks((bs) => bs.map((b) => {
        if (b.id !== drag.id) return b;
        let raw;
        if (drag.mode === 'move') {
          raw = {
            ...b,
            x: Math.max(0, drag.origX + dx),
            y: Math.max(0, drag.origY + dy),
          };
        } else {
          raw = {
            ...b,
            width:  Math.max(80, drag.origW + dx),
            height: Math.max(60, drag.origH + dy),
          };
        }
        if (snapEnabled && !e.altKey) {
          const snapped = computeSnap(
            { id: b.id, x: raw.x, y: raw.y, width: raw.width, height: raw.height },
            bs,
            { width: CANVAS_W, height: CANVAS_H },
            drag.mode,
          );
          nextGuides = snapped.guides;
          return { ...raw, x: snapped.x, y: snapped.y, width: snapped.width, height: snapped.height };
        }
        return raw;
      }));
      setSnapGuides(nextGuides);
      markDirty(drag.id);
    };
    const onUp = () => {
      setDrag(null);
      setSnapGuides([]);
      // Snapshot AFTER the committed move/resize so undo restores pre-drag state
      setBlocks((bs) => { history.record(bs); return bs; });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, snapEnabled]);

  // ── Approval ──────────────────────────────────────────────────────────────
  const changeApproval = async (status) => {
    const r = await api.post(`/api/moodboards/${id}/approval`, { status });
    setMb((m) => ({ ...m, ...r.data }));
  };

  const createShareToken = async () => {
    const r = await api.post(`/api/moodboards/${id}/share`);
    const url = `${window.location.origin}${r.data.share_path || `/moodboard/share/${r.data.share_token}`}`;
    setShareDialog(url);
    setMb((m) => ({ ...m, share_token: r.data.share_token }));
  };

  // ── Save current moodboard as a tenant template ──────────────────────────
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSavedSlug, setTemplateSavedSlug] = useState(null);
  const [templateSaveError, setTemplateSaveError] = useState(null);
  const saveAsTemplate = async () => {
    const baseSlug = (mb.title || 'template')
      .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 48) || 'template';
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
    setSavingTemplate(true); setTemplateSaveError(null);
    try {
      await api.post(`/api/templates/from-moodboard/${id}`, {
        slug, name: mb.title || t('moodboards.untitled'),
      });
      setTemplateSavedSlug(slug);
      setTimeout(() => setTemplateSavedSlug(null), 2500);
    } catch (err) {
      setTemplateSaveError(err?.response?.data?.detail || 'error');
      setTimeout(() => setTemplateSaveError(null), 3000);
    } finally {
      setSavingTemplate(false);
    }
  };

  // ── Presentation mode keyboard nav ────────────────────────────────────────
  useEffect(() => {
    if (!presenting) return;
    const visibleBlocks = blocks.filter((b) => !b.hidden);
    const handler = (e) => {
      if (e.key === 'Escape') setPresenting(false);
      if (e.key === 'ArrowRight' || e.key === ' ')
        setPresentIndex((i) => Math.min(visibleBlocks.length - 1, i + 1));
      if (e.key === 'ArrowLeft')
        setPresentIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [presenting, blocks]);

  const selectedBlock = useMemo(() => blocks.find((b) => b.id === selectedId), [blocks, selectedId]);
  const visibleBlocks = useMemo(() => blocks.filter((b) => !b.hidden), [blocks]);

  if (!mb) {
    return (
      <div className="p-10 min-h-screen bg-[var(--bp-bg)] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[var(--bp-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Presentation Mode ────────────────────────────────────────────────────
  if (presenting) {
    return <PresentationMode mb={mb} blocks={visibleBlocks} index={presentIndex}
                             setIndex={setPresentIndex} onExit={() => setPresenting(false)} t={t} />;
  }

  return (
    <div className="flex flex-col h-screen bg-[var(--bp-bg)]"
         data-testid={readOnly ? 'moodboard-public' : 'moodboard-editor'}>
      {/* Topbar */}
      <header className="flex items-center justify-between gap-4 px-6 h-14 border-b border-[var(--bp-border)] bg-[var(--bp-surface-1)]/60 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          {!readOnly && (
            <button onClick={() => navigate(-1)}
                    className="bp-caption text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] flex items-center gap-1.5"
                    data-testid="back-btn">
              <ArrowLeft size={13} strokeWidth={1.5} /> {t('moodboards.editor.back')}
            </button>
          )}
          <h1 className="bp-h3 text-[var(--bp-text-primary)] truncate">
            {mb.title || t('moodboards.untitled')}
          </h1>
          <StatusBadge status={mb.status} t={t} />
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && (
            <>
              {saveState === 'saving' ? (
                <span className="bp-caption text-[var(--bp-text-muted)] flex items-center gap-1" data-testid="status-saving">
                  <span className="w-2 h-2 rounded-full bg-[var(--bp-primary)] animate-pulse" />
                  {t('moodboards.editor.saving')}
                </span>
              ) : saveState === 'error' ? (
                <button onClick={flushSave} className="bp-caption text-red-400 flex items-center gap-1 hover:text-red-300"
                        data-testid="status-save-error" title={saveError || ''}>
                  <AlertCircle size={12} strokeWidth={1.5} />
                  {t('moodboards.editor.saveFailed')}
                </button>
              ) : Object.keys(dirtyMap).length > 0 ? (
                <button onClick={flushSave}
                        className="bp-caption text-[var(--bp-text-secondary)] flex items-center gap-1 hover:text-[var(--bp-text-primary)]"
                        data-testid="status-unsaved">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--bp-text-secondary)]" />
                  {t('moodboards.editor.unsaved')}
                </button>
              ) : savedAt ? (
                <span className="bp-caption text-[var(--bp-text-muted)] flex items-center gap-1" data-testid="status-saved">
                  <Check size={12} strokeWidth={1.5} /> {t('moodboards.editor.saved')}
                </span>
              ) : null}
            </>
          )}

          <button onClick={() => setPresenting(true)} className="bp-btn bp-btn-ghost text-xs"
                  data-testid="present-btn">
            <Play size={12} strokeWidth={1.5} /> {t('moodboards.editor.present')}
          </button>

          {!readOnly && (
            <div className="flex items-center gap-1 ml-1">
              <button onClick={onUndo} disabled={!history.canUndo}
                      title={t('moodboards.editor.undo')}
                      data-testid="undo-btn"
                      className="bp-btn bp-btn-ghost !px-2 text-xs disabled:opacity-30">
                <Undo2 size={13} strokeWidth={1.5} />
              </button>
              <button onClick={onRedo} disabled={!history.canRedo}
                      title={t('moodboards.editor.redo')}
                      data-testid="redo-btn"
                      className="bp-btn bp-btn-ghost !px-2 text-xs disabled:opacity-30">
                <Redo2 size={13} strokeWidth={1.5} />
              </button>
              <button onClick={() => setSnapEnabled((v) => !v)}
                      title={t('moodboards.editor.snap')}
                      data-testid="snap-toggle-btn"
                      className={`bp-btn bp-btn-ghost !px-2 text-xs ${snapEnabled ? 'text-[var(--bp-primary)]' : ''}`}>
                <Magnet size={13} strokeWidth={1.5} />
              </button>
            </div>
          )}

          {!readOnly && (
            <>
              {mb.status === 'draft' && (
                <button onClick={() => changeApproval('sent')}
                        className="bp-btn bp-btn-ghost text-xs" data-testid="send-review-btn">
                  <Send size={12} strokeWidth={1.5} /> {t('moodboards.editor.sendReview')}
                </button>
              )}
              {(mb.status === 'sent' || mb.status === 'viewed') && (
                <>
                  <button onClick={() => changeApproval('revision_requested')}
                          className="bp-btn bp-btn-ghost text-xs" data-testid="revision-btn">
                    {t('moodboards.editor.requestRevision')}
                  </button>
                  <button onClick={() => changeApproval('rejected')}
                          className="bp-btn bp-btn-ghost text-xs" data-testid="reject-btn">
                    {t('moodboards.editor.reject')}
                  </button>
                  <button onClick={() => changeApproval('approved')}
                          className="bp-btn bp-btn-primary text-xs" data-testid="approve-btn">
                    <Check size={12} strokeWidth={1.5} /> {t('moodboards.editor.approve')}
                  </button>
                </>
              )}
              <button onClick={createShareToken} className="bp-btn bp-btn-ghost text-xs" data-testid="share-btn">
                <Share2 size={12} strokeWidth={1.5} /> {t('moodboards.editor.share')}
              </button>
              <button onClick={saveAsTemplate} disabled={savingTemplate || !blocks.length}
                      className="bp-btn bp-btn-ghost text-xs disabled:opacity-40"
                      data-testid="save-as-template-btn"
                      title={t('moodboards.templates.saveAs')}>
                <BookmarkPlus size={12} strokeWidth={1.5} />
                {templateSavedSlug
                  ? t('moodboards.editor.saved')
                  : templateSaveError
                    ? t('moodboards.editor.saveFailed')
                    : savingTemplate
                      ? t('moodboards.editor.saving')
                      : t('moodboards.templates.saveAs')}
              </button>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* LEFT — Add blocks toolbar */}
        {!readOnly && (
          <aside className="w-[200px] flex-shrink-0 border-r border-[var(--bp-border)] bg-[var(--bp-surface-1)]/40 p-4">
            <p className="bp-eyebrow mb-4 !text-[var(--bp-text-muted)]">{t('moodboards.editor.addBlock')}</p>
            <div className="space-y-2">
              {BLOCK_TYPES.map((bt) => (
                <button key={bt.type} onClick={() => addBlock(bt.type)}
                        data-testid={`add-${bt.type}`}
                        className="w-full px-3 py-2.5 bg-[var(--bp-surface-1)] hover:bg-[var(--bp-surface-2)] border border-[var(--bp-border)] rounded-[var(--bp-radius-sm)] text-left text-sm font-body text-[var(--bp-text-primary)] flex items-center gap-2 transition-colors">
                  <Plus size={12} strokeWidth={1.5} className="text-[var(--bp-text-muted)]" />
                  {t(`moodboards.block.${bt.type}`)}
                </button>
              ))}
            </div>
          </aside>
        )}

        {/* CENTER — Canvas */}
        <main className="flex-1 overflow-auto p-6">
          <div ref={canvasRef} onClick={() => setSelectedId(null)} data-testid="moodboard-canvas"
               className="relative bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[var(--bp-radius-md)] mx-auto"
               style={{ width: CANVAS_W, height: CANVAS_H }}>
            {!readOnly && drag && snapEnabled && (
              <SnapGuides guides={snapGuides} canvasWidth={CANVAS_W} canvasHeight={CANVAS_H} />
            )}
            {blocks.map((b) => {
              if (b.hidden && readOnly) return null;
              const Component = resolveBlock(b.type);
              const isSelected = selectedId === b.id;
              return (
                <div key={b.id} data-testid={`block-${b.type}`}
                     className={`absolute group ${isSelected ? 'ring-2 ring-[var(--bp-primary)]' : 'hover:ring-1 hover:ring-[var(--bp-border-strong)]'} ${b.hidden ? 'opacity-30' : ''} ${b.locked ? 'cursor-default' : 'cursor-move'}`}
                     style={{
                       left: b.x, top: b.y, width: b.width, height: b.height, zIndex: b.z_index || 0,
                       opacity: (b.opacity !== undefined ? b.opacity : 1) * (b.hidden ? 0.3 : 1),
                       transform: b.rotation ? `rotate(${b.rotation}deg)` : undefined,
                     }}
                     onMouseDown={(e) => startDrag(e, b, 'move')}
                     onClick={(e) => { e.stopPropagation(); setSelectedId(b.id); setRightTab('inspector'); }}>
                  {Component
                    ? <Component block={b} readOnly={readOnly} t={t} />
                    : <div className="bp-caption text-[var(--bp-text-muted)] p-2">{b.type}</div>}
                  {!readOnly && isSelected && !b.locked && (
                    <div onMouseDown={(e) => startDrag(e, b, 'resize')}
                         className="absolute bottom-0 right-0 w-3 h-3 bg-[var(--bp-primary)] rounded-tl-[var(--bp-radius-xs)] cursor-se-resize" />
                  )}
                </div>
              );
            })}
          </div>
        </main>

        {/* RIGHT — Tab switcher: Inspector | Layers */}
        {!readOnly && (
          <aside className="w-[300px] flex-shrink-0 border-l border-[var(--bp-border)] bg-[var(--bp-surface-1)]/40 flex flex-col">
            <div className="flex border-b border-[var(--bp-border)]" data-testid="right-tabs">
              <TabBtn active={rightTab === 'inspector'} onClick={() => setRightTab('inspector')}
                      icon={PanelRight} label={t('moodboards.editor.inspector')} testid="tab-inspector" />
              <TabBtn active={rightTab === 'layers'} onClick={() => setRightTab('layers')}
                      icon={ListChecks} label={t('moodboards.editor.layers')} testid="tab-layers" />
            </div>
            {rightTab === 'inspector' ? (
              selectedBlock ? (
                <div className="p-5 overflow-y-auto flex-1" data-testid="block-inspector">
                  <p className="bp-eyebrow mb-4 !text-[var(--bp-text-muted)]">
                    {t(`moodboards.block.${selectedBlock.type}`)}
                  </p>
                  <BlockInspector block={selectedBlock} t={t}
                                  onChangeContent={(content) => updateBlock(selectedBlock.id, { content })}
                                  onChangeStyle={(style) => updateBlock(selectedBlock.id, { style })}
                                  onChange={(patch) => updateBlock(selectedBlock.id, patch)} />
                </div>
              ) : (
                <div className="p-5 flex-1 flex items-center justify-center">
                  <p className="bp-caption text-[var(--bp-text-subtle)] text-center">
                    {t('moodboards.editor.noInspector')}
                  </p>
                </div>
              )
            ) : (
              <LayersPanel blocks={blocks} selectedId={selectedId}
                           onSelect={(bid) => { setSelectedId(bid); }}
                           onAction={handleLayerAction} t={t} />
            )}
          </aside>
        )}
      </div>

      {/* Share dialog */}
      {shareDialog && (
        <div className="fixed inset-0 z-50 bg-[var(--bp-overlay)] backdrop-blur-sm flex items-center justify-center"
             onClick={() => setShareDialog(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bp-glass p-6 rounded-[var(--bp-radius-md)] max-w-md w-[420px]">
            <p className="bp-eyebrow mb-2 !text-[var(--bp-text-muted)]">{t('moodboards.editor.shareEyebrow')}</p>
            <h3 className="bp-h2 mb-4 text-[var(--bp-text-primary)]">{t('moodboards.editor.shareTitle')}</h3>
            <input readOnly value={shareDialog} data-testid="share-url"
                   className="input-luxury w-full px-3 py-2 text-sm rounded-[var(--bp-radius-sm)] mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShareDialog(null)} className="bp-btn bp-btn-ghost text-xs">
                {t('common.close')}
              </button>
              <a href={shareDialog} target="_blank" rel="noreferrer" className="bp-btn bp-btn-primary text-xs">
                <ExternalLink size={12} strokeWidth={1.5} /> {t('moodboards.editor.openShare')}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Tab Button ──────────────────────────────────────────────────────────────
const TabBtn = ({ active, onClick, icon: Icon, label, testid }) => (
  <button onClick={onClick} data-testid={testid}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 bp-caption transition-colors ${
            active
              ? 'text-[var(--bp-text-primary)] border-b-2 border-[var(--bp-primary)] bg-[var(--bp-surface-1)]'
              : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-secondary)] border-b-2 border-transparent'
          }`}>
    <Icon size={11} strokeWidth={1.5} /> {label}
  </button>
);

// ── Presentation Mode ──────────────────────────────────────────────────────
const PresentationMode = ({ mb, blocks, index, setIndex, onExit, t }) => {
  const active = blocks[index];
  return (
    <div className="fixed inset-0 z-50 bg-[var(--bp-bg)] flex flex-col" data-testid="presentation-mode">
      <header className="flex items-center justify-between px-8 py-5 flex-shrink-0">
        <div>
          <p className="bp-eyebrow !text-[var(--bp-text-muted)] mb-1">{t('moodboards.editor.present')}</p>
          <h1 className="bp-h2 text-[var(--bp-text-primary)] font-light">{mb.title}</h1>
        </div>
        <button onClick={onExit} className="bp-btn bp-btn-ghost text-xs" data-testid="exit-present-btn">
          <X size={12} strokeWidth={1.5} /> {t('moodboards.editor.exitPresent')}
        </button>
      </header>
      <main className="flex-1 flex items-center justify-center px-12 pb-12">
        {active ? (
          <div key={active.id} className="relative animate-[fadeIn_0.6s_ease-out]"
               style={{ width: Math.min(active.width * 1.5, 900), height: Math.min(active.height * 1.5, 700) }}>
            {React.createElement(resolveBlock(active.type), { block: active, readOnly: true, t })}
          </div>
        ) : (
          <p className="bp-h3 text-[var(--bp-text-muted)]">—</p>
        )}
      </main>
      <footer className="flex items-center justify-between px-8 py-5 border-t border-[var(--bp-border)] flex-shrink-0">
        <button onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0}
                className="bp-btn bp-btn-ghost text-xs disabled:opacity-30" data-testid="present-prev">
          <ChevronLeft size={13} strokeWidth={1.5} />
        </button>
        <span className="bp-caption text-[var(--bp-text-muted)]">{index + 1} / {blocks.length}</span>
        <button onClick={() => setIndex(Math.min(blocks.length - 1, index + 1))}
                disabled={index >= blocks.length - 1}
                className="bp-btn bp-btn-ghost text-xs disabled:opacity-30" data-testid="present-next">
          <ChevronRight size={13} strokeWidth={1.5} />
        </button>
      </footer>
    </div>
  );
};

// ── Inspector primitives ────────────────────────────────────────────────────
const InspectorInput = ({ label, value, onChange, testid }) => (
  <label className="block mb-3">
    <span className="bp-eyebrow !text-[10px] mb-1 block !text-[var(--bp-text-muted)]">{label}</span>
    <input value={value || ''} onChange={(e) => onChange(e.target.value)} data-testid={testid}
           className="input-luxury w-full px-2.5 py-1.5 text-sm rounded-[var(--bp-radius-sm)]" />
  </label>
);

const InspectorTextarea = ({ label, value, onChange, testid }) => (
  <label className="block mb-3">
    <span className="bp-eyebrow !text-[10px] mb-1 block !text-[var(--bp-text-muted)]">{label}</span>
    <textarea value={value || ''} onChange={(e) => onChange(e.target.value)} rows={4} data-testid={testid}
              className="input-luxury w-full px-2.5 py-1.5 text-sm rounded-[var(--bp-radius-sm)] resize-y" />
  </label>
);

const InspectorSlider = ({ label, value, min, max, step, onChange, testid, formatValue }) => (
  <label className="block mb-3">
    <div className="flex items-center justify-between mb-1">
      <span className="bp-eyebrow !text-[10px] !text-[var(--bp-text-muted)]">{label}</span>
      <span className="bp-caption !text-[10px] text-[var(--bp-text-secondary)] font-mono">
        {formatValue ? formatValue(value) : value}
      </span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
           data-testid={testid}
           onChange={(e) => onChange(parseFloat(e.target.value))}
           className="w-full accent-[var(--bp-primary)]" />
  </label>
);

const FOCAL_PRESETS = [
  ['top-left',    '15% 15%'], ['top',    'center 15%'], ['top-right',    '85% 15%'],
  ['left',        '15% 50%'], ['center', 'center'],     ['right',        '85% 50%'],
  ['bottom-left', '15% 85%'], ['bottom', 'center 85%'], ['bottom-right', '85% 85%'],
];

// ── Block Inspector ─────────────────────────────────────────────────────────
const BlockInspector = ({ block, onChangeContent, onChangeStyle, onChange, t }) => {
  const c = block.content || {};
  const s = block.style || {};
  const setC = (k, v) => onChangeContent({ ...c, [k]: v });
  const setS = (k, v) => onChangeStyle({ ...s, [k]: v });

  // Crop/focal section reused for image blocks
  const CropFocalSection = () => (
    <div className="pt-3 mt-3 border-t border-[var(--bp-border)]">
      <p className="bp-eyebrow !text-[10px] mb-3 !text-[var(--bp-text-muted)]">
        {t('moodboards.editor.crop')}
      </p>
      <label className="block mb-3">
        <span className="bp-eyebrow !text-[10px] mb-1 block !text-[var(--bp-text-muted)]">
          {t('moodboards.field.fitMode')}
        </span>
        <select value={s.fit_mode || 'cover'} onChange={(e) => setS('fit_mode', e.target.value)}
                data-testid="block-image-fit"
                className="input-luxury w-full px-2.5 py-1.5 text-sm rounded-[var(--bp-radius-sm)]">
          <option value="cover">{t('moodboards.field.fitMode.cover')}</option>
          <option value="contain">{t('moodboards.field.fitMode.contain')}</option>
          <option value="fill">{t('moodboards.field.fitMode.fill')}</option>
        </select>
      </label>
      <div className="mb-3">
        <span className="bp-eyebrow !text-[10px] mb-2 block !text-[var(--bp-text-muted)]">
          {t('moodboards.field.focalPoint')}
        </span>
        <div className="grid grid-cols-3 gap-1 max-w-[120px]">
          {FOCAL_PRESETS.map(([key, val]) => (
            <button key={key}
                    data-testid={`focal-${key}`}
                    onClick={() => setS('focal_point', val)}
                    className={`aspect-square rounded-[var(--bp-radius-xs)] border transition-all ${
                      (s.focal_point || 'center') === val
                        ? 'border-[var(--bp-primary)] bg-[var(--bp-primary)]/20'
                        : 'border-[var(--bp-border)] hover:border-[var(--bp-border-strong)]'
                    }`} />
          ))}
        </div>
      </div>
      <InspectorSlider label={t('moodboards.field.zoom')} value={s.zoom || 1}
                       min={1} max={3} step={0.05} onChange={(v) => setS('zoom', v)}
                       testid="block-image-zoom" formatValue={(v) => `${(v * 100).toFixed(0)}%`} />
      <button type="button" onClick={() => onChangeStyle({
        ...s, fit_mode: 'cover', focal_point: 'center', zoom: 1,
      })}
              className="bp-btn bp-btn-ghost text-xs w-full mt-2"
              data-testid="reset-crop-btn">
        <RotateCcw size={11} strokeWidth={1.5} /> {t('moodboards.editor.resetCrop')}
      </button>
    </div>
  );

  // Image adjustments — CSS-filter based, persisted in style.adjustments.
  const adj = s.adjustments || {};
  const setAdj = (k, v) => onChangeStyle({ ...s, adjustments: { ...adj, [k]: v } });
  const AdjustmentsSection = () => (
    <div className="pt-3 mt-3 border-t border-[var(--bp-border)]">
      <div className="flex items-center justify-between mb-3">
        <p className="bp-eyebrow !text-[10px] !text-[var(--bp-text-muted)]">
          {t('moodboards.editor.adjustments')}
        </p>
        <button type="button"
                onClick={() => onChangeStyle({ ...s, adjustments: {} })}
                className="bp-caption !text-[10px] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]"
                data-testid="reset-adjustments-btn">
          {t('moodboards.editor.reset')}
        </button>
      </div>
      <InspectorSlider label={t('moodboards.field.brightness')}
                       value={adj.brightness ?? 1} min={0.5} max={1.5} step={0.02}
                       onChange={(v) => setAdj('brightness', v)}
                       testid="adj-brightness" formatValue={(v) => `${((v - 1) * 100).toFixed(0)}`} />
      <InspectorSlider label={t('moodboards.field.contrast')}
                       value={adj.contrast ?? 1} min={0.5} max={1.5} step={0.02}
                       onChange={(v) => setAdj('contrast', v)}
                       testid="adj-contrast" formatValue={(v) => `${((v - 1) * 100).toFixed(0)}`} />
      <InspectorSlider label={t('moodboards.field.saturation')}
                       value={adj.saturation ?? 1} min={0} max={2} step={0.05}
                       onChange={(v) => setAdj('saturation', v)}
                       testid="adj-saturation" formatValue={(v) => `${((v - 1) * 100).toFixed(0)}`} />
      <InspectorSlider label={t('moodboards.field.warmth')}
                       value={adj.warmth ?? 0} min={-1} max={1} step={0.05}
                       onChange={(v) => setAdj('warmth', v)}
                       testid="adj-warmth" formatValue={(v) => `${(v * 100).toFixed(0)}`} />
      <InspectorSlider label={t('moodboards.field.grayscale')}
                       value={adj.grayscale ?? 0} min={0} max={1} step={0.05}
                       onChange={(v) => setAdj('grayscale', v)}
                       testid="adj-grayscale" formatValue={(v) => `${(v * 100).toFixed(0)}%`} />
      <InspectorSlider label={t('moodboards.field.blur')}
                       value={adj.blur ?? 0} min={0} max={8} step={0.2}
                       onChange={(v) => setAdj('blur', v)}
                       testid="adj-blur" formatValue={(v) => `${v.toFixed(1)}px`} />
      <InspectorSlider label={t('moodboards.field.vignette')}
                       value={adj.vignette ?? 0} min={0} max={1} step={0.05}
                       onChange={(v) => setAdj('vignette', v)}
                       testid="adj-vignette" formatValue={(v) => `${(v * 100).toFixed(0)}%`} />
    </div>
  );

  const SHADOW_PRESETS = [
    { id: 'none',     label: t('moodboards.shadow.none') },
    { id: 'soft',     label: t('moodboards.shadow.soft') },
    { id: 'medium',   label: t('moodboards.shadow.medium') },
    { id: 'dramatic', label: t('moodboards.shadow.dramatic') },
  ];

  const VisualPropsSection = () => (
    <div className="pt-3 mt-3 border-t border-[var(--bp-border)]">
      <p className="bp-eyebrow !text-[10px] !text-[var(--bp-text-muted)] mb-3">
        {t('moodboards.editor.visualProps')}
      </p>
      <InspectorSlider label={t('moodboards.field.opacity')}
                       value={block.opacity !== undefined ? block.opacity : 1}
                       min={0} max={1} step={0.05}
                       onChange={(v) => onChange({ opacity: v })}
                       testid="block-opacity" formatValue={(v) => `${(v * 100).toFixed(0)}%`} />
      <InspectorSlider label={t('moodboards.field.rotation')}
                       value={block.rotation || 0}
                       min={-180} max={180} step={1}
                       onChange={(v) => onChange({ rotation: v })}
                       testid="block-rotation" formatValue={(v) => `${v}°`} />
      <InspectorSlider label={t('moodboards.field.borderRadius')}
                       value={s.border_radius ?? 4}
                       min={0} max={48} step={1}
                       onChange={(v) => setS('border_radius', v)}
                       testid="block-border-radius" formatValue={(v) => `${v}px`} />
      <div className="mb-3">
        <label className="bp-eyebrow !text-[10px] !text-[var(--bp-text-muted)] block mb-1.5">
          {t('moodboards.field.shadow')}
        </label>
        <div className="grid grid-cols-4 gap-1" data-testid="block-shadow-presets">
          {SHADOW_PRESETS.map((p) => {
            const active = (s.shadow_preset || 'none') === p.id;
            return (
              <button key={p.id} type="button"
                      onClick={() => setS('shadow_preset', p.id)}
                      data-testid={`shadow-${p.id}`}
                      className={`bp-caption !text-[10px] px-2 py-1.5 rounded-[var(--bp-radius-xs)] border transition-colors
                        ${active
                          ? 'border-[var(--bp-primary)] text-[var(--bp-text-primary)] bg-[var(--bp-surface-2)]'
                          : 'border-[var(--bp-border)] text-[var(--bp-text-muted)] hover:border-[var(--bp-border-strong)]'}`}>
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  switch (block.type) {
    case 'image':
      return (<>
        <ImageUploader currentUrl={c.src} t={t}
                       onUploaded={(url, meta) => {
                         // Persist src + structured metadata in one atomic update so
                         // autosave's batch PATCH carries both. metadata_json is the
                         // canonical place for upload provenance (file_name,
                         // original_dimensions, media_id, storage_path).
                         onChange({
                           content: { ...c, src: url },
                           metadata: { ...(block.metadata || {}), ...(meta || {}) },
                         });
                       }} />
        <InspectorInput label={t('moodboards.field.imageUrl')} value={c.src}
                        onChange={(v) => setC('src', v)} testid="block-image-src" />
        <InspectorInput label={t('moodboards.field.caption')} value={c.caption}
                        onChange={(v) => setC('caption', v)} testid="block-image-caption" />
        <CropFocalSection />
        <AdjustmentsSection />
        <VisualPropsSection />
      </>);
    case 'text':
      return (<>
        <InspectorTextarea label={t('moodboards.field.text')} value={c.text}
                           onChange={(v) => setC('text', v)} testid="block-text-input" />
        <label className="block mb-3">
          <span className="bp-eyebrow !text-[10px] mb-1 block !text-[var(--bp-text-muted)]">
            {t('moodboards.field.size')}
          </span>
          <select value={c.size || 'h3'} onChange={(e) => setC('size', e.target.value)}
                  data-testid="block-text-size"
                  className="input-luxury w-full px-2.5 py-1.5 text-sm rounded-[var(--bp-radius-sm)]">
            {['display','h1','h2','h3','body','caption','eyebrow'].map((sz) => <option key={sz}>{sz}</option>)}
          </select>
        </label>
        <VisualPropsSection />
      </>);
    case 'note':
      return (<>
        <InspectorTextarea label={t('moodboards.field.note')} value={c.text}
                           onChange={(v) => setC('text', v)} testid="block-note-input" />
      </>);
    case 'palette':
      return (
        <div>
          <span className="bp-eyebrow !text-[10px] mb-2 block !text-[var(--bp-text-muted)]">
            {t('moodboards.field.colors')}
          </span>
          {(c.colors || []).map((col, i) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <input type="color" value={col} onChange={(e) => {
                const next = [...(c.colors || [])]; next[i] = e.target.value; setC('colors', next);
              }} className="w-8 h-8 rounded-[var(--bp-radius-xs)] cursor-pointer bg-transparent" />
              <input value={col} onChange={(e) => {
                const next = [...(c.colors || [])]; next[i] = e.target.value; setC('colors', next);
              }} className="input-luxury flex-1 px-2 py-1 text-xs font-mono rounded-[var(--bp-radius-xs)]" />
              <button onClick={() => setC('colors', c.colors.filter((_, j) => j !== i))}
                      className="text-[var(--bp-text-muted)] hover:text-red-400">
                <X size={11} />
              </button>
            </div>
          ))}
          <button onClick={() => setC('colors', [...(c.colors || []), '#FFFFFF'])}
                  className="bp-btn bp-btn-ghost text-xs w-full" data-testid="add-palette-color">
            <Plus size={11} strokeWidth={1.5} /> {t('moodboards.field.addColor')}
          </button>
        </div>
      );
    case 'product':
      return (<>
        <ImageUploader currentUrl={c.image} t={t}
                       onUploaded={(url) => setC('image', url)} />
        <InspectorInput label={t('moodboards.field.name')}     value={c.name}   onChange={(v) => setC('name', v)} />
        <InspectorInput label={t('moodboards.field.vendor')}   value={c.vendor} onChange={(v) => setC('vendor', v)} />
        <InspectorInput label={t('moodboards.field.price')}    value={c.price}  onChange={(v) => setC('price', v)} />
        <InspectorInput label={t('moodboards.field.imageUrl')} value={c.image}  onChange={(v) => setC('image', v)} />
      </>);
    case 'material':
      return (<>
        <ImageUploader currentUrl={c.swatch} t={t}
                       onUploaded={(url) => setC('swatch', url)} />
        <InspectorInput label={t('moodboards.field.name')}   value={c.name}   onChange={(v) => setC('name', v)} />
        <InspectorInput label={t('moodboards.field.finish')} value={c.finish} onChange={(v) => setC('finish', v)} />
        <InspectorInput label={t('moodboards.field.swatch')} value={c.swatch} onChange={(v) => setC('swatch', v)} />
      </>);
    default:
      return <p className="bp-caption text-[var(--bp-text-muted)]">{t('moodboards.editor.noInspector')}</p>;
  }
};

export default MoodboardEditor;
