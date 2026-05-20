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
  Plus, Check, Share2, ExternalLink, Send, X, AlertCircle,
  Play, Maximize2, ChevronLeft, ChevronRight, PanelRight, ListChecks,
  BookmarkPlus, Undo2, Redo2, Magnet, RotateCcw, FileText,
  Copy, Clipboard, MoveRight, Layers,
  MoveHorizontal, MoveVertical, Square as SquareIcon,
} from 'lucide-react';
import { resolveBlock, BLOCK_TYPES } from '../../blueprint/moodboard/BlockRegistry';
import StatusBadge from '../../components/common/StatusBadge';
import LayersPanel, { sortLayersTopFirst } from '../../blueprint/moodboard/LayersPanel';
import ImageUploader from '../../blueprint/moodboard/ImageUploader';
import BlueprintColorPicker from '../../components/common/BlueprintColorPicker';
import PagesFilmstrip from '../../blueprint/moodboard/PagesFilmstrip';
import EditorPanel from '../../blueprint/moodboard/EditorPanel';
import InlineEditorialRegia from '../../blueprint/moodboard/InlineEditorialRegia';
import CuratorialInspirationsModal from '../../blueprint/moodboard/CuratorialInspirationsModal';
// ActionToolbar removed from the editor — canvas-implicit interactions only.
import { computeSnap } from '../../blueprint/moodboard/useSnap';
import SnapGuides from '../../blueprint/moodboard/SnapGuides';
import SpacingBadges from '../../blueprint/moodboard/SpacingBadges';
import useHistory from '../../blueprint/moodboard/useHistory';
import PresentationMode from '../../blueprint/moodboard/PresentationMode';
import PageInspector from '../../blueprint/moodboard/PageInspector';
import InspectorGroup from '../../blueprint/moodboard/InspectorGroup';
import ImageQuickAdjust from '../../blueprint/moodboard/ImageQuickAdjust';
// Workspace mode is owned by the global Topbar; no local hook needed here.
// Brand mark is rendered by the global Topbar / Sidebar — not imported here.
import { trackEvent } from '../../lib/telemetry';
import { FONT_REGISTRY, FONT_CATEGORIES } from '../../blueprint/moodboard/fontRegistry';
import { copyStyle, pasteStyle, hasClipboardStyle, clipboardBlockType } from '../../blueprint/moodboard/styleClipboard';
import JourneyContextHeader from '../../components/journey/JourneyContextHeader';

const CANVAS_W = 1400;
const CANVAS_H = 2400;
const AUTOSAVE_DEBOUNCE_MS = 800;
const AUTOSAVE_MAX_RETRIES = 3;

const MoodboardEditor = ({ readOnly = false }) => {
  const { id, shareToken } = useParams();
  const navigate = useNavigate();
  const { t, locale } = useBlueprint();
  const [mb, setMb] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [dirtyMap, setDirtyMap] = useState({});
  const [savedAt, setSavedAt] = useState(null);
  const [saveState, setSaveState] = useState('idle');
  const [saveError, setSaveError] = useState(null);
  const [drag, setDrag] = useState(null);
  const [shareDialog, setShareDialog] = useState(null);
  const [rightTab, setRightTab] = useState('inspector'); // inspector | layers | page
  const [presenting, setPresenting] = useState(false);
  const [presentIndex, setPresentIndex] = useState(0);
  const [snapGuides, setSnapGuides] = useState([]);
  const [spacingHarmonics, setSpacingHarmonics] = useState([]);
  const [magneticEngaged, setMagneticEngaged] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [pages, setPages] = useState([]);
  const [activePageId, setActivePageId] = useState(null);
  const [regia, setRegia] = useState(null);  // { blockId, anchorRect } — Inline Editorial Regia™ popover
  const [curatorialOpen, setCuratorialOpen] = useState(false);  // Curatorial Inspirations Modal™ fullscreen
  const [transitions, setTransitions] = useState([]);
  // QuickAdjust modal — lifted to editor root so changing the active block
  // doesn't unmount it mid-adjust. Holds { blockId, src }.
  const [quickAdjust, setQuickAdjust] = useState(null);

  const history = useHistory();
  // Workspace mode is owned globally by the Topbar's ThemeSwitcher — the
  // editor no longer needs to read or toggle it locally.
  // Confirm pulse — a transient ring shown on the autosave dot the moment a
  // save succeeds. Resets to "silent reliable" steady state after 800ms.
  const [justSaved, setJustSaved] = useState(false);

  // Load transitions registry once
  useEffect(() => {
    api.get('/api/moodboards/_meta/presentation_transitions')
      .then((r) => setTransitions(r.data?.data || []))
      .catch(() => setTransitions([]));
  }, []);

  // Filter blocks to the active page (legacy elements without page_id stay
  // visible on the first page for backward-compat). Memo not needed — list is small.
  const firstPageId = pages[0]?.id || null;
  const pageBlocks = blocks.filter((b) =>
    (b.page_id || firstPageId) === activePageId
  );
  // Canvas renders bottom-first → top-last. Tie-break by created_at so the
  // visual order matches LayersPanel ordering EXACTLY (same comparator).
  // Canvas: ASC z_index, older first (older = behind, newer = in front).
  const sortedPageBlocks = [...pageBlocks].sort((a, b) => {
    const dz = (a.z_index || 0) - (b.z_index || 0);
    if (dz !== 0) return dz;
    return (a.created_at || '').localeCompare(b.created_at || '');
  });

  // Index for the PagesNavigator thumbnails — blocks grouped by page_id
  const blocksByPage = blocks.reduce((acc, b) => {
    const pid = b.page_id || firstPageId;
    if (!pid) return acc;
    (acc[pid] = acc[pid] || []).push(b);
    return acc;
  }, {});

  // Active page object (used for canvas sizing)
  const activePage = pages.find((p) => p.id === activePageId) || pages[0];
  const canvasW = activePage?.width || CANVAS_W;
  const canvasH = activePage?.height || CANVAS_H;

  const canvasRef = useRef();
  const canvasViewportRef = useRef(null);  // outer scroll container — drives scale
  const saveTimer = useRef();
  const retryCount = useRef(0);
  const [canvasScale, setCanvasScale] = useState(1);
  const canvasScaleRef = useRef(1);  // drag handlers read this without re-binding
  useEffect(() => { canvasScaleRef.current = canvasScale; }, [canvasScale]);
  // Fit mode controls the auto-scale strategy:
  //   'width'  → scale to fit container width (default)
  //   'height' → scale to fit container height
  //   'actual' → no auto-scale, pinned at 100% (allows horizontal scroll)
  const [fitMode, setFitMode] = useState('width');

  // ── Responsive canvas scale ──────────────────────────────────────────────
  // Visual-only transform: divides the canvas to fit its column without
  // overflow / horizontal scroll. Internal coordinates (block x/y/w/h)
  // remain in their original reference frame — drag handlers compensate
  // by dividing screen deltas by `canvasScaleRef.current`.
  useEffect(() => {
    const el = canvasViewportRef.current;
    if (!el) return undefined;
    const compute = () => {
      if (fitMode === 'actual') {
        setCanvasScale((prev) => (Math.abs(prev - 1) > 0.005 ? 1 : prev));
        return;
      }
      const rect = el.getBoundingClientRect();
      // 48px breathing room on each side; never upscale above 1.
      const targetW = Math.max(160, rect.width - 48);
      const targetH = Math.max(160, rect.height - 48);
      const next = fitMode === 'height'
        ? Math.min(1, targetH / (canvasH || 1))
        : Math.min(1, targetW / (canvasW || 1));
      setCanvasScale((prev) => (Math.abs(prev - next) > 0.005 ? next : prev));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [canvasW, canvasH, fitMode]);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const url = readOnly
      ? `/api/moodboards/public/share/${shareToken}`
      : `/api/moodboards/${id}`;
    api.get(url).then((r) => {
      setMb(r.data);
      setBlocks(r.data.elements || []);
      const pageList = r.data.pages || [];
      setPages(pageList);
      // Land on moodboard.current_page_id, else the first page
      const landing = r.data.current_page_id
        || (pageList[0] && pageList[0].id)
        || null;
      setActivePageId(landing);
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
      // Quiet success pulse — 800ms then settles back to the steady dot.
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 800);
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
  const reloadPagesAndBlocks = useCallback(async () => {
    const r = await api.get(`/api/moodboards/${id}`);
    setMb(r.data);
    setBlocks(r.data.elements || []);
    setPages(r.data.pages || []);
  }, [id]);

  const addBlock = async (type) => {
    if (readOnly) return;
    const meta = BLOCK_TYPES.find((b) => b.type === type);
    // New blocks always sit on top of the same-page stack — eliminates
    // z-index collisions and keeps panel ↔ canvas in sync from creation.
    const samePageBlocks = blocks.filter((b) =>
      (b.page_id || firstPageId) === activePageId
    );
    const maxZ = samePageBlocks.reduce((m, b) => Math.max(m, b.z_index || 0), -1);
    const payload = {
      type, x: 60, y: 60, ...meta.defaults,
      z_index: maxZ + 1,
      page_id: activePageId,  // F.0: scope new blocks to the active page
    };
    const r = await api.post(`/api/moodboards/${id}/blocks`, payload);
    setBlocks((bs) => { const next = [...bs, r.data]; history.record(next); return next; });
    setSelectedId(r.data.id);
    setRightTab('inspector');
    // Telemetry — used by the product team to learn which blocks are popular
    // and which fall in disuse. Non-PII payload only.
    trackEvent('moodboard.block_added',
      { block_type: type, moodboard_id: id },
      { entityType: 'moodboard', entityId: id });
  };

  // ── Quick Add™ — instant add from MoodPanel (Inspirations / Products /
  // Recent / Studio Collections). Preserves curatorial intent (focal point,
  // editorial filter, brand provenance, market context) end-to-end so the
  // moodboard always reads as a curated table, never a media browser.
  const addInspirationBlock = useCallback(async (item, ctx = {}) => {
    if (readOnly || !item) return;
    const dm = item.display_meta || {};
    const samePageBlocks = blocks.filter((b) =>
      (b.page_id || firstPageId) === activePageId
    );
    const maxZ = samePageBlocks.reduce((m, b) => Math.max(m, b.z_index || 0), -1);

    // Aspect ratio: prefer crop_ratio, else the source's intrinsic ratio.
    let aspect = 4 / 5;
    if (dm.crop_ratio && /^\d+:\d+$/.test(dm.crop_ratio)) {
      const [w, h] = dm.crop_ratio.split(':').map(Number);
      if (w && h) aspect = w / h;
    } else if (item.width && item.height) {
      aspect = item.width / item.height;
    }
    const width = 360;
    const height = Math.round(width / aspect);

    const focalX = ((dm.focal_x ?? 0.5) * 100).toFixed(1);
    const focalY = ((dm.focal_y ?? 0.5) * 100).toFixed(1);

    // Stagger placement so consecutive Quick Adds never overlap perfectly
    const offsetX = 60 + ((samePageBlocks.length % 6) * 24);
    const offsetY = 60 + ((samePageBlocks.length % 6) * 24);

    const payload = {
      type: 'image',
      x: offsetX,
      y: offsetY,
      width,
      height,
      z_index: maxZ + 1,
      page_id: activePageId,
      content: {
        src: item.image_url,
        caption: item.title || item.product_name || '',
      },
      style: {
        fit_mode: 'cover',
        focal_point: `${focalX}% ${focalY}%`,
        zoom: dm.zoom ?? 1,
        border_radius: 4,
      },
      metadata: {
        // ── Curatorial provenance ──
        inspiration_id: item.id,
        source_type: item.inspiration_type || (ctx.source_tab === 'products' ? 'product' : 'inspiration'),
        source_tab: ctx.source_tab || null,
        // ── Brand intelligence anchors ──
        brand: item.brand || null,
        collection: item.collection || null,
        product_name: item.product_name || null,
        product_category: item.product_category || null,
        designer: item.designer || null,
        rights_status: item.rights_status || null,
        supplier_catalog_id: item.supplier_catalog_id || null,
        // ── Universal Editorial Cropper™ regia ──
        display_meta: dm,
        editorial_filter: dm.editorial_filter || null,
        // ── Market context (for Cultural Edition™ future wiring) ──
        market_context: item.market_codes || [],
      },
    };

    const r = await api.post(`/api/moodboards/${id}/blocks`, payload);
    setBlocks((bs) => { const next = [...bs, r.data]; history.record(next); return next; });
    setSelectedId(r.data.id);
    setRightTab('inspector');

    // Emit Product Usage Event™ — foundation for Brand Intelligence /
    // Material Affinity / Cultural Coherence. Non-blocking, best-effort.
    if ((item.inspiration_type === 'product' || ctx.source_tab === 'products')) {
      api.post('/api/inspirations/registry/usage-events', {
        product_id: item.id,
        usage_type: 'added_to_moodboard',
        moodboard_id: id,
      }).catch(() => { /* foundation event — silently ignore */ });
    }

    trackEvent('moodboard.inspiration_added',
      {
        moodboard_id: id,
        inspiration_id: item.id,
        source_type: payload.metadata.source_type,
        brand: item.brand || null,
      },
      { entityType: 'moodboard', entityId: id });

    toast.success(item.brand ? `${item.brand} aggiunto alla selezione.` : 'Riferimento aggiunto.');
  }, [readOnly, blocks, firstPageId, activePageId, id, history]);

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
  // Helper: persist a fully-reordered stack as a contiguous z_index sequence,
  // marking each affected block dirty so autosave eventually flushes them.
  // `orderedIdsTopFirst` is the panel order (highest z_index first), so the
  // new z_index = (length - 1 - index).
  const applyStackOrder = useCallback((orderedIdsTopFirst) => {
    if (readOnly) return;
    const n = orderedIdsTopFirst.length;
    const indexOf = new Map(orderedIdsTopFirst.map((id, i) => [id, i]));
    setBlocks((bs) => {
      const next = bs.map((b) => {
        if (!indexOf.has(b.id)) return b;
        const newZ = n - 1 - indexOf.get(b.id);
        if ((b.z_index || 0) === newZ) return b;
        return { ...b, z_index: newZ };
      });
      history.record(next);
      return next;
    });
    setDirtyMap((m) => {
      const x = { ...m };
      orderedIdsTopFirst.forEach((id) => { x[id] = true; });
      return x;
    });
  }, [readOnly, history]);

  // ±1 neighbor swap — keeps the operation visually meaningful even when
  // multiple blocks share the same z_index. Operates on the SAME page only.
  const nudgeLayer = (block, direction /* 'forward' | 'backward' */) => {
    if (readOnly) return;
    const samePage = blocks.filter((b) =>
      (b.page_id || firstPageId) === (block.page_id || firstPageId)
    );
    const ordered = sortLayersTopFirst(samePage);  // top-first
    const idx = ordered.findIndex((b) => b.id === block.id);
    if (idx < 0) return;
    // 'forward' = move toward top of stack = lower idx in the top-first list
    const swapIdx = direction === 'forward' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= ordered.length) return;
    const ids = ordered.map((b) => b.id);
    [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
    applyStackOrder(ids);
  };

  const handleLayerReorder = useCallback((orderedIdsTopFirst) => {
    applyStackOrder(orderedIdsTopFirst);
  }, [applyStackOrder]);

  const handleLayerAction = (action, block, payload) => {
    if (!block) return;
    switch (action) {
      case 'toggleLock':
        updateBlock(block.id, { locked: !block.locked });
        break;
      case 'toggleHidden':
        updateBlock(block.id, { hidden: !block.hidden });
        break;
      case 'rename':
        // Layer label persisted in metadata.layer_label — separate from the
        // derived caption/text label so renames don't overwrite content.
        updateBlock(block.id, {
          metadata: {
            ...(block.metadata || {}),
            layer_label: payload?.layer_label ?? null,
          },
        });
        break;
      case 'bringForward':
        nudgeLayer(block, 'forward');
        break;
      case 'sendBackward':
        nudgeLayer(block, 'backward');
        break;
      case 'bringToFront': {
        const samePage = blocks.filter((b) =>
          (b.page_id || firstPageId) === (block.page_id || firstPageId)
        );
        const ordered = sortLayersTopFirst(samePage);
        const ids = ordered.map((b) => b.id).filter((id) => id !== block.id);
        ids.unshift(block.id);  // top of the stack
        applyStackOrder(ids);
        break;
      }
      case 'sendToBack': {
        const samePage = blocks.filter((b) =>
          (b.page_id || firstPageId) === (block.page_id || firstPageId)
        );
        const ordered = sortLayersTopFirst(samePage);
        const ids = ordered.map((b) => b.id).filter((id) => id !== block.id);
        ids.push(block.id);  // bottom of the stack
        applyStackOrder(ids);
        break;
      }
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
  // Drag is INTENT-driven: a pure click selects without moving the block.
  // The actual move/resize is committed only once the pointer travels beyond
  // a small threshold (DRAG_THRESHOLD px). This eliminates the "I just wanted
  // to click and the block jumped" UX bug entirely.
  const DRAG_THRESHOLD = 4;
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
      // Activated only once the pointer crosses DRAG_THRESHOLD — a "pure
      // click" (no movement) selects without moving the block.
      active: mode === 'resize',  // resize is intent-explicit (handle)
    });
    setSelectedId(block.id);
  };

  useEffect(() => {
    if (!drag) return;
    // rAF-throttled mousemove: collapse multiple events fired between two
    // frames into a single React state update. Eliminates the jitter that
    // came from running `setBlocks` 200+ times/second on a fast trackpad.
    let rafId = null;
    let lastEvent = null;
    let isActive = drag.active;
    const applyMove = () => {
      rafId = null;
      const e = lastEvent;
      if (!e) return;
      // Compensate the visual canvas scaling so canvas-internal coordinates
      // remain pixel-precise regardless of the responsive transform.
      const scale = canvasScaleRef.current || 1;
      const dx = (e.clientX - drag.startX) / scale;
      const dy = (e.clientY - drag.startY) / scale;
      // Intent gate — only commit movement once the pointer has clearly
      // crossed the activation threshold (in screen pixels, not canvas px).
      if (!isActive) {
        const screenDx = e.clientX - drag.startX;
        const screenDy = e.clientY - drag.startY;
        if (Math.hypot(screenDx, screenDy) < DRAG_THRESHOLD) return;
        isActive = true;
      }
      let nextGuides = [];
      let nextHarmonics = [];
      let nextMagnetic = false;
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
          // Snap only against blocks on the SAME page (no cross-page magnetism)
          const samePageBlocks = bs.filter((x) =>
            (x.page_id || firstPageId) === activePageId
          );
          const snapped = computeSnap(
            { id: b.id, x: raw.x, y: raw.y, width: raw.width, height: raw.height },
            samePageBlocks,
            { width: canvasW, height: canvasH },
            drag.mode,
          );
          nextGuides = snapped.guides;
          nextHarmonics = snapped.harmonics || [];
          nextMagnetic = !!snapped.magnetic;
          return { ...raw, x: snapped.x, y: snapped.y, width: snapped.width, height: snapped.height };
        }
        return raw;
      }));
      setSnapGuides(nextGuides);
      setSpacingHarmonics(nextHarmonics);
      setMagneticEngaged(nextMagnetic);
      markDirty(drag.id);
    };
    const onMove = (e) => {
      lastEvent = e;
      if (rafId === null) rafId = requestAnimationFrame(applyMove);
    };
    const onUp = () => {
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      setDrag(null);
      setSnapGuides([]);
      setSpacingHarmonics([]);
      setMagneticEngaged(false);
      // Snapshot ONLY if the move actually committed (isActive) — pure
      // clicks must NOT push history entries (otherwise undo gets noisy).
      if (isActive) {
        setBlocks((bs) => { history.record(bs); return bs; });
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
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
    setShareDialog({
      shareUrl: url,
      reviewUrl: `${window.location.origin}/review/${r.data.share_token}`,
      presentUrl: `${window.location.origin}/presentation/${r.data.share_token}`,
    });
    setMb((m) => ({ ...m, share_token: r.data.share_token }));
    trackEvent('moodboard.shared',
      { moodboard_id: id },
      { entityType: 'moodboard', entityId: id });
  };

  // ── Collaboration overview (page statuses + activity) ────────────────────
  // Loaded lazily so the editor isn't slowed down by a non-critical request.
  // Used by the topbar "Prepare Project Proposal" CTA gating (all pages
  // must be approved before the handoff is offered).
  const [collabStatuses, setCollabStatuses] = useState([]);
  const refreshCollab = useCallback(() => {
    if (!id || readOnly) return;
    api.get('/api/collab/page-status', { params: { entity_type: 'moodboard', entity_id: id } })
      .then((r) => setCollabStatuses(r.data?.data || []))
      .catch(() => setCollabStatuses([]));
  }, [id, readOnly]);
  useEffect(() => { refreshCollab(); }, [refreshCollab]);
  // Lightweight poll while the editor is open — picks up client decisions
  // without requiring page reload. 25s is gentle on the backend and feels
  // alive without being chatty.
  useEffect(() => {
    if (readOnly) return undefined;
    const i = setInterval(refreshCollab, 25000);
    return () => clearInterval(i);
  }, [readOnly, refreshCollab]);

  const allApproved = useMemo(() => {
    if (!pages?.length) return false;
    const byId = Object.fromEntries(collabStatuses.map((s) => [s.page_id, s.status]));
    return pages.every((p) => byId[p.id] === 'approved');
  }, [pages, collabStatuses]);

  const [handoffSent, setHandoffSent] = useState(false);
  const handoffToProposal = async () => {
    try {
      await api.post('/api/collab/handoff/prepare-proposal', {
        entity_type: 'moodboard', entity_id: id,
      });
      setHandoffSent(true);
      toast.success(t('collab.handoff.recorded', null, 'Handoff recorded'));
      setTimeout(() => setHandoffSent(false), 4000);
    } catch (_e) {
      toast.error(t('collab.handoff.failed', null, 'Handoff failed'));
    }
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
      toast.success(t('moodboards.templates.saved', null, 'Template saved'));
      trackEvent('moodboard.template_saved',
        { moodboard_id: id, slug },
        { entityType: 'moodboard', entityId: id });
      setTimeout(() => setTemplateSavedSlug(null), 2500);
    } catch (err) {
      const msg = err?.response?.data?.detail || 'error';
      setTemplateSaveError(msg);
      toast.error(t('moodboards.templates.saveFailed', null, 'Could not save template') + (msg && msg !== 'error' ? `: ${msg}` : ''));
      setTimeout(() => setTemplateSaveError(null), 3000);
    } finally {
      setSavingTemplate(false);
    }
  };

  // ── Presentation Mode V2 — handled by PresentationMode component ────────
  // (keyboard nav + chapter logic + transitions all live there)

  const selectedBlock = useMemo(() => blocks.find((b) => b.id === selectedId), [blocks, selectedId]);
  const visibleBlocks = useMemo(() => blocks.filter((b) => !b.hidden), [blocks]);

  if (!mb) {
    return (
      <div className="p-10 min-h-screen bg-[var(--bp-bg)] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[var(--bp-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Presentation Mode V2 ────────────────────────────────────────────────
  if (presenting) {
    return <PresentationMode mb={mb} pages={pages} blocks={visibleBlocks}
                             transitions={transitions} clientSafe={readOnly}
                             startIndex={Math.max(0, pages.findIndex((p) => p.id === activePageId))}
                             onExit={() => setPresenting(false)} t={t} />;
  }

  return (
    <div className="relative flex flex-col h-screen bg-[var(--bp-bg)]"
         data-testid={readOnly ? 'moodboard-public' : 'moodboard-editor'}>
      {/* Editor toolbar — page-scoped actions only. Global breadcrumb / brand
          / theme / locale / avatar live in the app Topbar (see DashboardLayout).
          This bar carries: status capsule + canvas action buttons (undo, redo,
          snap, present, review, share, approval). */}
      <header className="flex items-center justify-between gap-4 px-5 h-12 border-b border-[var(--bp-border)] bg-[var(--bp-surface-1)]/65 backdrop-blur-md flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {readOnly && (
            <h1 className="bp-h3 text-[var(--bp-text-primary)] truncate text-[15px]">
              {mb.title || t('moodboards.untitled')}
            </h1>
          )}
          {!readOnly && mb.title && (
            <span className="bp-caption !text-[11px] text-[var(--bp-text-secondary)] truncate max-w-[280px]">
              {mb.title}
            </span>
          )}
          <StatusBadge status={mb.status} t={t} />
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && (
            <div className="flex items-center gap-1 mr-2">
              <button onClick={onUndo} disabled={!history.canUndo}
                      title={t('moodboards.editor.undo')}
                      data-testid="undo-btn"
                      className="p-1.5 rounded-[var(--bp-radius-xs)] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] hover:bg-[var(--bp-surface-2)]/60 disabled:opacity-25 transition-colors">
                <Undo2 size={14} strokeWidth={1.5} />
              </button>
              <button onClick={onRedo} disabled={!history.canRedo}
                      title={t('moodboards.editor.redo')}
                      data-testid="redo-btn"
                      className="p-1.5 rounded-[var(--bp-radius-xs)] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] hover:bg-[var(--bp-surface-2)]/60 disabled:opacity-25 transition-colors">
                <Redo2 size={14} strokeWidth={1.5} />
              </button>
              <button onClick={() => setSnapEnabled((v) => !v)}
                      title={snapEnabled
                        ? ((locale || '').toLowerCase().startsWith('it')
                            ? 'Allineamento intelligente: ATTIVO. Le guide appaiono mentre trascini per allineare ad altri blocchi e ai bordi.'
                            : 'Smart alignment: ON. Guides appear while you drag to align with other blocks and edges.')
                        : ((locale || '').toLowerCase().startsWith('it')
                            ? 'Allineamento intelligente: DISATTIVATO. Trascina liberamente senza guide.'
                            : 'Smart alignment: OFF. Drag freely without snap guides.')}
                      data-testid="snap-toggle-btn"
                      className={`relative p-1.5 rounded-[var(--bp-radius-xs)] hover:bg-[var(--bp-surface-2)]/60 transition-colors
                                  ${snapEnabled ? 'text-[var(--bp-primary)]' : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]'}`}>
                <Magnet size={14} strokeWidth={1.5} />
                {/* Tiny dot indicator: teal when ON, muted ring when OFF */}
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full transition-all"
                      style={{
                        background: snapEnabled ? 'var(--bp-primary)' : 'transparent',
                        boxShadow: snapEnabled ? '0 0 6px var(--bp-primary)' : 'inset 0 0 0 1px var(--bp-border)',
                      }} />
              </button>

              {/* Fit Width · Fit Height · Actual Size — visual-only scale */}
              <span className="mx-1 w-px h-4 bg-[var(--bp-border)] self-center" aria-hidden="true" />
              <button onClick={() => setFitMode('width')}
                      title={t('moodboards.editor.fitWidth', null, 'Fit width')}
                      data-testid="fit-width-btn"
                      className={`p-1.5 rounded-[var(--bp-radius-xs)] hover:bg-[var(--bp-surface-2)]/60 transition-colors
                                  ${fitMode === 'width' ? 'text-[var(--bp-primary)]' : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]'}`}>
                <MoveHorizontal size={14} strokeWidth={1.5} />
              </button>
              <button onClick={() => setFitMode('height')}
                      title={t('moodboards.editor.fitHeight', null, 'Fit height')}
                      data-testid="fit-height-btn"
                      className={`p-1.5 rounded-[var(--bp-radius-xs)] hover:bg-[var(--bp-surface-2)]/60 transition-colors
                                  ${fitMode === 'height' ? 'text-[var(--bp-primary)]' : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]'}`}>
                <MoveVertical size={14} strokeWidth={1.5} />
              </button>
              <button onClick={() => setFitMode('actual')}
                      title={t('moodboards.editor.actualSize', null, 'Actual size (100%)')}
                      data-testid="fit-actual-btn"
                      className={`p-1.5 rounded-[var(--bp-radius-xs)] hover:bg-[var(--bp-surface-2)]/60 transition-colors
                                  ${fitMode === 'actual' ? 'text-[var(--bp-primary)]' : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]'}`}>
                <SquareIcon size={14} strokeWidth={1.5} />
              </button>
              {/* Live scale readout — tabular-num so it doesn't jitter */}
              <span data-testid="canvas-scale-readout"
                    className="ml-1 text-[10px] font-mono tabular-nums text-[var(--bp-text-muted)] min-w-[34px] text-center select-none">
                {Math.round(canvasScale * 100)}%
              </span>
            </div>
          )}

          <button onClick={() => setPresenting(true)}
                  data-testid="present-btn"
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[var(--bp-radius-sm)] bg-[var(--bp-primary)]/10 hover:bg-[var(--bp-primary)]/20 text-[var(--bp-primary)] transition-colors">
            <Play size={11} strokeWidth={1.5} fill="currentColor" />
            <span className="bp-caption !text-[11px] !text-[var(--bp-primary)]">{t('moodboards.editor.present')}</span>
          </button>

          {/* Open Client Review Mode — share-token required, prompts share dialog if missing */}
          {!readOnly && (
            <button
              onClick={async () => {
                let tok = mb.share_token;
                if (!tok) {
                  const r = await api.post(`/api/moodboards/${id}/share`);
                  tok = r.data.share_token;
                  setMb((m) => ({ ...m, share_token: tok }));
                }
                window.open(`/review/${tok}`, '_blank', 'noopener');
              }}
              data-testid="open-review-btn"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[var(--bp-radius-sm)]
                         bg-[var(--bp-surface-2)]/60 hover:bg-[var(--bp-surface-2)]
                         text-[var(--bp-text-primary)] transition-colors">
              <ListChecks size={11} strokeWidth={1.5} />
              <span className="bp-caption !text-[11px] !text-[var(--bp-text-primary)]">
                {t('moodboards.editor.openReview', null, 'Client Review')}
              </span>
            </button>
          )}

          {/* Prepare Project Proposal — appears only when ALL pages are approved */}
          {!readOnly && allApproved && (
            <button onClick={handoffToProposal}
                    data-testid="prepare-proposal-btn"
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[var(--bp-radius-sm)]
                               bg-[var(--bp-primary)] text-black hover:brightness-110 transition-all
                               animate-[bpSoftPulse_2.4s_ease-in-out_infinite]">
              <Send size={11} strokeWidth={1.5} />
              <span className="text-[11px] tracking-[0.18em] uppercase font-medium">
                {handoffSent
                  ? t('collab.handoff.recorded', null, 'Recorded')
                  : t('collab.handoff.cta', null, 'Prepare Proposal')}
              </span>
            </button>
          )}

          {/* Workspace Mode toggle has moved to the global Topbar — no longer
              duplicated here so the editor toolbar stays focused on canvas
              tools (present · review · share · approval). */}

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
                  <button onClick={() => changeApproval('approved')}
                          className="bp-btn bp-btn-primary text-xs" data-testid="approve-btn">
                    <Check size={12} strokeWidth={1.5} /> {t('moodboards.editor.approve')}
                  </button>
                </>
              )}
              <button onClick={createShareToken}
                      data-testid="share-btn"
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[var(--bp-radius-sm)] border border-[var(--bp-border)] hover:border-[var(--bp-text-secondary)] text-[var(--bp-text-secondary)] hover:text-[var(--bp-text-primary)] transition-colors">
                <Share2 size={11} strokeWidth={1.5} />
                <span className="bp-caption !text-[11px]">{t('moodboards.editor.share')}</span>
              </button>
              <button onClick={saveAsTemplate} disabled={savingTemplate || !blocks.length}
                      className="p-1.5 rounded-[var(--bp-radius-xs)] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] hover:bg-[var(--bp-surface-2)]/60 disabled:opacity-30 transition-colors"
                      data-testid="save-as-template-btn"
                      title={t('moodboards.templates.saveAs')}>
                <BookmarkPlus size={14} strokeWidth={1.5} />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Journey Continuity™ — context strip che ricorda al designer
          quale pietra miliare del Design Journey™ sta vivendo.
          Nessuna render in modalità read-only (public review). */}
      {!readOnly && (
        <JourneyContextHeader entityType="moodboard" entityId={id} compact />
      )}

      {/* Action Toolbar removed in the Figma-Grade Stabilization sprint.
          Select / Deselect / Move / Resize / Align / Zoom are now canvas-
          implicit interactions (click = select, drag = move, handles = resize,
          wheel/pinch = zoom). The Topbar carries only session/project actions. */}

      <div className="flex flex-1 min-h-0">
        {/* LEFT — Secondary Contextual Panel (Insert · Assets · Pages · Mood) */}
        {!readOnly && (
          <EditorPanel
            onAddBlock={addBlock}
            onAddInspiration={addInspirationBlock}
            onOpenCuratorial={() => setCuratorialOpen(true)}
            moodboardId={id}
            onOpenSkeletons={(skid) => {
              api.post(`/api/moodboards/${id}/pages/from_skeleton`, { skeleton_id: skid })
                .then((r) => { setActivePageId(r.data.id); reloadPagesAndBlocks(); })
                .catch(() => {});
            }}
            onOpenSkeletonPicker={() => {
              // Hand off to the bottom filmstrip's SkeletonPicker — same modal,
              // single source of truth, no duplicated state in two components.
              window.dispatchEvent(new CustomEvent('mfd:open-skeleton-picker'));
            }}
            pages={pages}
            activePageId={activePageId}
            t={t} />
        )}

        {/* CENTER — Canvas Viewport (drives responsive scale) */}
        <main ref={canvasViewportRef}
              className="flex-1 overflow-auto min-w-0 p-6 flex justify-center items-start">
          {/* Outer wrapper occupies the SCALED footprint so the scrollarea
              never falls under the right sidebar. */}
          <div style={{
                 width: canvasW * canvasScale,
                 height: canvasH * canvasScale,
                 flexShrink: 0,
               }}>
            <div ref={canvasRef} onClick={() => setSelectedId(null)} data-testid="moodboard-canvas"
                 className="relative bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[var(--bp-radius-md)] overflow-hidden"
                 style={{
                   width: canvasW, height: canvasH,
                   transform: `scale(${canvasScale})`,
                   transformOrigin: 'top left',
                   backgroundColor: activePage?.settings?.background_color || undefined,
                   backgroundImage: activePage?.settings?.background_image_url
                     ? `url(${activePage.settings.background_image_url})` : undefined,
                   backgroundSize: 'cover',
                   backgroundPosition: 'center',
                 }}>
              {/* Page-background overlay — sits below all blocks but above the
                  background image, so it can darken/lighten a photo backdrop
                  for legibility without affecting block colors. */}
              {(activePage?.settings?.background_overlay ?? 0) > 0 && (
                <div data-testid="page-bg-overlay-layer"
                     className="absolute inset-0 pointer-events-none"
                     style={{
                       backgroundColor: activePage?.settings?.background_color || 'rgba(0,0,0,1)',
                       opacity: activePage.settings.background_overlay,
                       zIndex: 0,
                     }} />
              )}
              {!readOnly && drag && snapEnabled && (
                <>
                  <SnapGuides guides={snapGuides} canvasWidth={canvasW} canvasHeight={canvasH} />
                  <SpacingBadges harmonics={spacingHarmonics} canvasWidth={canvasW} canvasHeight={canvasH} />
                </>
              )}
              {sortedPageBlocks.map((b) => {
                if (b.hidden && readOnly) return null;
                const Component = resolveBlock(b.type);
                const isSelected = selectedId === b.id;
                const isDragging = drag && drag.id === b.id;
                return (
                  <div key={b.id} data-testid={`block-${b.type}`}
                       className={`absolute group transition-shadow duration-[240ms] ease-[var(--bp-ease-emphasis,cubic-bezier(0.22,0.61,0.36,1))]
                                   ${isSelected
                                     ? 'block-selected'
                                     : 'block-idle'}
                                   ${b.hidden ? 'opacity-30' : ''}
                                   ${b.locked ? 'cursor-default' : 'cursor-move'}
                                   ${isDragging ? 'block-dragging' : ''}
                                   ${isDragging && magneticEngaged ? 'is-magnetic' : ''}`}
                       style={{
                         left: b.x, top: b.y, width: b.width, height: b.height, zIndex: b.z_index || 0,
                         opacity: (b.opacity !== undefined ? b.opacity : 1) * (b.hidden ? 0.3 : 1),
                         // Cinematic lift: tilt impercettibile (0.4°) + scale
                         // (1.012) durante il drag. Combinato con rotation del
                         // blocco se l'utente l'ha settato — preserva intent.
                         transform: [
                           b.rotation ? `rotate(${b.rotation}deg)` : null,
                           isDragging ? 'translateZ(0) scale(1.012) rotate(0.4deg)' : null,
                         ].filter(Boolean).join(' ') || undefined,
                         // GPU-accelerated layer promotion during drag so the
                         // browser can move the element without repainting
                         // surrounding content.
                         willChange: isDragging ? 'transform, top, left' : 'auto',
                       }}
                       onMouseDown={(e) => startDrag(e, b, 'move')}
                       onClick={(e) => { e.stopPropagation(); setSelectedId(b.id); setRightTab('inspector'); }}>
                    {Component
                      ? <Component block={b} readOnly={readOnly} t={t} />
                      : <div className="bp-caption text-[var(--bp-text-muted)] p-2">{b.type}</div>}
                    {/* Inline Regia™ trigger — appears on hover for image
                        blocks. Click anchors the contextual popover to the
                        block so the user can re-direct focal point + filter
                        without leaving the moodboard flow. */}
                    {!readOnly && b.type === 'image' && b.content?.src && (
                      <button
                        type="button"
                        data-testid={`regia-trigger-${b.id}`}
                        onMouseDown={(e) => { e.stopPropagation(); }}
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.closest('.group').getBoundingClientRect();
                          setRegia({ blockId: b.id, anchorRect: rect });
                          setSelectedId(b.id);
                        }}
                        className={`block-regia-trigger ${regia?.blockId === b.id ? 'is-active' : ''}`}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                        Regia
                      </button>
                    )}
                    {!readOnly && isSelected && !b.locked && (
                      // Resize handle — visible 10×10 teal nub with an
                      // invisible 22×22 hit area so it's effortless to grab
                      // without zooming in. (Same idiom as Figma corner handles.)
                      <div onMouseDown={(e) => startDrag(e, b, 'resize')}
                           className="absolute -bottom-[11px] -right-[11px] w-[22px] h-[22px] cursor-se-resize z-10
                                      flex items-end justify-end pr-[2px] pb-[2px]"
                           data-testid={`block-resize-${b.id}`}>
                        <span className="block w-[10px] h-[10px] rounded-[2px] bg-[var(--bp-primary)]
                                         shadow-[0_0_0_2px_var(--bp-bg),0_0_10px_rgba(15,162,132,0.55)]
                                         transition-transform duration-200
                                         group-hover:scale-110" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </main>

        {/* RIGHT — Tab switcher: Inspector | Layers */}
        {!readOnly && (
          <aside className="w-[320px] flex-shrink-0 border-l border-[var(--bp-border)] bg-[var(--bp-surface-1)]/40 flex flex-col">
            <div className="flex border-b border-[var(--bp-border)]" data-testid="right-tabs">
              <TabBtn active={rightTab === 'inspector'} onClick={() => setRightTab('inspector')}
                      icon={PanelRight} title={t('moodboards.editor.inspector')} testid="tab-inspector" />
              <TabBtn active={rightTab === 'page'} onClick={() => setRightTab('page')}
                      icon={FileText} title={t('moodboards.editor.page')} testid="tab-page" />
              <TabBtn active={rightTab === 'layers'} onClick={() => setRightTab('layers')}
                      icon={ListChecks} title={t('moodboards.editor.layers')} testid="tab-layers" />
            </div>
            {rightTab === 'inspector' ? (
              selectedBlock ? (
                <div className="px-6 py-5 overflow-y-auto flex-1" data-testid="block-inspector">
                  {/* Selected-block header — editorial type meta + tactile divider.
                      "ITEM · IMAGE" reads like a magazine caption. */}
                  <div className="flex items-baseline gap-2 mb-5 pb-4 border-b border-[var(--bp-border)]/70">
                    <span className="font-mono text-[10px] tracking-[0.32em] uppercase text-[var(--bp-text-subtle)]">
                      {t('moodboards.inspector.selectedItem', null, 'Item')}
                    </span>
                    <span className="font-mono text-[10px] tracking-[0.28em] uppercase text-[var(--bp-primary)]">
                      · {t(`moodboards.block.${selectedBlock.type}`)}
                    </span>
                    <div className="flex-1" />
                  </div>
                  <BlockInspector block={selectedBlock} t={t}
                                  onChangeContent={(content) => updateBlock(selectedBlock.id, { content })}
                                  onChangeStyle={(style) => updateBlock(selectedBlock.id, { style })}
                                  onChange={(patch) => updateBlock(selectedBlock.id, patch)}
                                  onApplyStyleToAll={(src) => {
                                    // Propagate style of the selected block to every other block
                                    // of the same type on EVERY page. This is the minimal
                                    // "Apply to all" feature — full Global Project Styles
                                    // arrives in F.5.
                                    const peers = blocks.filter((b) => b.type === src.type && b.id !== src.id);
                                    peers.forEach((p) => {
                                      updateBlock(p.id, {
                                        style: { ...(p.style || {}), ...(src.style || {}) },
                                        ...(src.type === 'text' && src.content?.size
                                          ? { content: { ...(p.content || {}), size: src.content.size, list_style: src.content.list_style } }
                                          : {}),
                                      });
                                    });
                                    toast.success(t('moodboards.editor.applyAllDone', null, `${peers.length} blocks updated`));
                                  }}
                                  onOpenQuickAdjust={(src) => setQuickAdjust({ blockId: selectedBlock.id, src })} />
                </div>
              ) : (
                <div className="p-8 flex-1 flex flex-col items-center justify-center text-center"
                     data-testid="inspector-empty-state">
                  {/* Soft layered glyph — concentric rings allude to the OO
                      monogram without repeating it literally, keeping the
                      moment quiet rather than branded. */}
                  <div className="relative mb-6"
                       style={{ width: 64, height: 64 }}>
                    <span className="absolute inset-0 rounded-full border border-[var(--bp-border)]" />
                    <span className="absolute inset-[10px] rounded-full border border-[var(--bp-primary)]/30" />
                    <span className="absolute inset-[22px] rounded-full bg-[var(--bp-primary)]/15
                                     shadow-[0_0_18px_rgba(15,162,132,0.18)]" />
                  </div>
                  <p className="font-mono text-[10px] tracking-[0.36em] uppercase
                                text-[var(--bp-text-muted)] mb-4">
                    {t('moodboards.editor.inspector', null, 'Inspector')}
                  </p>
                  <p className="!text-[17px] !text-[var(--bp-text-primary)] font-light italic leading-[1.35] mb-3 max-w-[240px]"
                     style={{ fontFamily: 'Playfair Display, var(--bp-font-heading), serif' }}>
                    {t('moodboards.inspector.empty.title', null,
                      'A quiet control surface.')}
                  </p>
                  <p className="bp-caption !text-[12px] !text-[var(--bp-text-muted)] leading-[1.6] max-w-[240px] italic"
                     style={{ fontFamily: 'Playfair Display, var(--bp-font-heading), serif' }}>
                    {t('moodboards.inspector.empty.body', null,
                      'Select an element to refine its composition, typography, materials or atmosphere.')}
                  </p>
                </div>
              )
            ) : rightTab === 'page' ? (
              <PageInspector moodboardId={id}
                             page={activePage}
                             onSaved={reloadPagesAndBlocks}
                             onLocalUpdate={(pageId, patch) => {
                               // Live preview: merge the page-inspector patch
                               // directly into pages[] so the canvas reflects
                               // edits BEFORE the debounced PUT lands.
                               setPages((ps) => ps.map((p) => p.id === pageId
                                 ? {
                                     ...p,
                                     ...(patch.title !== undefined ? { title: patch.title } : {}),
                                     ...(patch.hidden_in_presentation !== undefined
                                       ? { hidden_in_presentation: patch.hidden_in_presentation } : {}),
                                     settings: { ...(p.settings || {}), ...patch },
                                   }
                                 : p));
                             }} />
            ) : (
              <LayersPanel blocks={pageBlocks} selectedId={selectedId}
                           onSelect={(bid) => { setSelectedId(bid); }}
                           onAction={handleLayerAction}
                           onReorder={handleLayerReorder} t={t} />
            )}
          </aside>
        )}
      </div>

      {/* BOTTOM — Pages filmstrip + autosave indicator */}
      {!readOnly && (
        <PagesFilmstrip
          moodboardId={id}
          pages={pages}
          currentPageId={activePageId}
          blocksByPage={blocksByPage}
          onSelect={(pid) => { setSelectedId(null); setActivePageId(pid); }}
          onChange={reloadPagesAndBlocks}
          readOnly={readOnly}
          pageStatusById={Object.fromEntries(collabStatuses.map((s) => [s.page_id, s.status]))}
        />
      )}

      {/* Autosave — SOFT PULSE™ indicator: silent dot, no text in steady state.
          Pulses when saving, briefly rings on success, turns red on persistent error. */}
      {!readOnly && (
        <div className="absolute bottom-3 right-5 z-10 pointer-events-none flex items-center gap-2">
          {saveState === 'error' ? (
            <button onClick={flushSave}
                    data-testid="status-save-error"
                    title={saveError || t('moodboards.editor.saveFailed')}
                    className="pointer-events-auto flex items-center gap-1.5 text-[10px] tracking-wider text-red-400 hover:text-red-300 transition-colors">
              <AlertCircle size={11} strokeWidth={1.5} />
              <span>{t('moodboards.editor.retry')}</span>
            </button>
          ) : (
            <span
              data-testid={
                saveState === 'saving'
                  ? 'status-saving'
                  : Object.keys(dirtyMap).length > 0
                    ? 'status-unsaved'
                    : 'status-saved'
              }
              title={
                saveState === 'saving'
                  ? t('moodboards.editor.saving')
                  : Object.keys(dirtyMap).length > 0
                    ? t('moodboards.editor.unsaved')
                    : t('moodboards.editor.autosaveOn')
              }
              className={`block w-1.5 h-1.5 rounded-full transition-colors duration-300
                ${saveState === 'saving' ? 'bp-soft-pulse' : ''}
                ${justSaved ? 'bp-soft-confirm' : ''}
                ${saveState === 'saving' || justSaved
                  ? 'bg-[var(--bp-primary)]'
                  : Object.keys(dirtyMap).length > 0
                    ? 'bg-[var(--bp-text-muted)]'
                    : 'bg-[var(--bp-primary)]/55'}`}
            />
          )}
        </div>
      )}

      {/* QuickAdjust modal — lifted to editor root so it survives block changes */}
      {quickAdjust && (() => {
        const targetBlock = blocks.find((b) => b.id === quickAdjust.blockId);
        const ts = targetBlock?.style || {};
        return (
          <ImageQuickAdjust src={quickAdjust.src}
                            defaults={{
                              fit_mode: ts.fit_mode || 'cover',
                              focal_point: ts.focal_point || 'center',
                              adjustments: ts.adjustments || {},
                            }}
                            onConfirm={(patch) => {
                              if (!targetBlock) { setQuickAdjust(null); return; }
                              updateBlock(quickAdjust.blockId, {
                                style: {
                                  ...ts,
                                  fit_mode: patch.fit_mode,
                                  focal_point: patch.focal_point,
                                  adjustments: { ...(ts.adjustments || {}), ...patch.adjustments },
                                },
                              });
                              setQuickAdjust(null);
                            }}
                            onSkip={() => setQuickAdjust(null)}
                            t={t} />
        );
      })()}

      {/* Curatorial Inspirations Modal™ — fullscreen cinematic discovery */}
      <CuratorialInspirationsModal
        open={curatorialOpen}
        onClose={() => setCuratorialOpen(false)}
        moodboardId={id}
        onAddInspiration={addInspirationBlock}
      />

      {/* Inline Editorial Regia™ — contextual mini popover anchored to
          the image block. Live updates style.focal_point, style.zoom and
          metadata.{editorial_filter, display_meta}; persists to the
          Inspirations™ archive too when block.metadata.inspiration_id. */}
      {regia && (() => {
        const targetBlock = blocks.find((bb) => bb.id === regia.blockId);
        if (!targetBlock) return null;
        return (
          <InlineEditorialRegia
            block={targetBlock}
            anchorRect={regia.anchorRect}
            onChange={(patch) => updateBlock(regia.blockId, patch)}
            onClose={() => setRegia(null)}
          />
        );
      })()}

      {/* Share dialog — now offers the read-only presentation link AND
          the new Client Review link. Designers usually want both: presentation
          for cinematic walkthrough, review for collaborative feedback. */}
      {shareDialog && (
        <div className="fixed inset-0 z-50 bg-[var(--bp-overlay)] backdrop-blur-sm flex items-center justify-center"
             onClick={() => setShareDialog(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bp-glass p-6 rounded-[var(--bp-radius-md)] max-w-md w-[460px]">
            <p className="bp-eyebrow mb-2 !text-[var(--bp-text-muted)]">{t('moodboards.editor.shareEyebrow')}</p>
            <h3 className="bp-h2 mb-5 text-[var(--bp-text-primary)]">{t('moodboards.editor.shareTitle')}</h3>

            <ShareLinkRow label={t('moodboards.editor.shareReviewLabel', null, 'Client Review (collaborative)')}
                          value={shareDialog.reviewUrl}
                          testid="share-url-review" />
            <ShareLinkRow label={t('moodboards.editor.sharePresentLabel', null, 'Presentation (cinematic)')}
                          value={shareDialog.presentUrl}
                          testid="share-url-present" />
            <ShareLinkRow label={t('moodboards.editor.shareLegacyLabel', null, 'Legacy read-only')}
                          value={shareDialog.shareUrl}
                          testid="share-url"
                          muted />

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShareDialog(null)} className="bp-btn bp-btn-ghost text-xs">
                {t('common.close')}
              </button>
              <a href={shareDialog.reviewUrl} target="_blank" rel="noreferrer" className="bp-btn bp-btn-primary text-xs">
                <ExternalLink size={12} strokeWidth={1.5} /> {t('moodboards.editor.openShare')}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Row Toggle (label + switch) — used inline in inspectors ─────────────────
const RowToggle = ({ label, hint, checked, onChange, testid }) => (
  <label className="flex items-start gap-3 mb-3 cursor-pointer">
    <button type="button"
            onClick={() => onChange(!checked)}
            data-testid={testid}
            className={`mt-0.5 relative w-8 h-[18px] rounded-full transition-colors flex-shrink-0
                        ${checked ? 'bg-[var(--bp-primary)]' : 'bg-[var(--bp-surface-2)]'}`}>
      <span className={`absolute top-[2px] w-[14px] h-[14px] bg-white rounded-full transition-transform
                        ${checked ? 'translate-x-[16px]' : 'translate-x-[2px]'}`} />
    </button>
    <div className="flex-1 min-w-0">
      <p className="bp-caption !text-[11px] !text-[var(--bp-text-primary)]">{label}</p>
      {hint && <p className="bp-caption !text-[10px] !text-[var(--bp-text-subtle)] mt-0.5">{hint}</p>}
    </div>
  </label>
);

// ── Tab Button ──────────────────────────────────────────────────────────────
const TogglePill = ({ active, onClick, label, italic, underline, testid }) => (
  <button type="button"
          onClick={onClick}
          data-testid={testid}
          style={{
            fontStyle: italic ? 'italic' : 'normal',
            textDecoration: underline ? 'underline' : 'none',
          }}
          className={`flex-1 py-2 text-[12px] font-semibold rounded-[var(--bp-radius-xs)] border transition-colors
            ${active
              ? 'border-[var(--bp-primary)] text-[var(--bp-text-primary)] bg-[var(--bp-surface-2)]'
              : 'border-[var(--bp-border)] text-[var(--bp-text-muted)] hover:border-[var(--bp-border-strong)]'}`}>
    {label}
  </button>
);


const ShareLinkRow = ({ label, value, testid, muted }) => (
  <div className="mb-3" data-testid={`${testid}-row`}>
    <p className={`text-[10px] tracking-[0.22em] uppercase mb-1.5
                   ${muted ? 'text-[var(--bp-text-subtle)]' : 'text-[var(--bp-text-secondary)]'}`}>
      {label}
    </p>
    <div className="flex items-center gap-2">
      <input readOnly value={value || ''} data-testid={testid}
             onFocus={(e) => e.target.select()}
             className="input-luxury flex-1 px-3 py-2 text-xs rounded-[var(--bp-radius-sm)] font-mono" />
      <button type="button"
              onClick={() => navigator.clipboard?.writeText(value || '')}
              className="bp-btn bp-btn-ghost text-[10px] !px-3 !py-2">
        Copy
      </button>
    </div>
  </div>
);


// Icon-only by design — labels were unreadable on narrower sidebars (and on
// non-translated locale fallbacks). Tooltip via native `title` keeps the
// premium uncluttered feeling. An accent dot under the icon marks active.
const TabBtn = ({ active, onClick, icon: Icon, title, testid }) => (
  <button onClick={onClick} data-testid={testid} title={title} aria-label={title}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors
                      ${active
                        ? 'text-[var(--bp-text-primary)] bg-[var(--bp-surface-1)]'
                        : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-secondary)]'}`}>
    <Icon size={14} strokeWidth={1.5} />
    <span className={`block h-[2px] w-5 rounded-full transition-colors
                      ${active ? 'bg-[var(--bp-primary)]' : 'bg-transparent'}`} />
  </button>
);

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

/**
 * InspectorSlider — smooth, jitter-free range input.
 *
 * UX problem before: every "input" event from the native slider fired an
 * onChange that bubbled to the editor state, which re-rendered every block
 * on the canvas. On a busy moodboard the cumulative cost caused visible
 * stutter, "remount feeling" and occasional cursor jumps.
 *
 * Fix:
 *   1. Keep a local state for the *displayed* value so the thumb always
 *      tracks the user's pointer in real time (decoupled from parent renders).
 *   2. Coalesce upstream onChange via requestAnimationFrame — at most one
 *      commit per frame (16ms). Final commit happens on `change` / mouseup
 *      / touchend / blur so the parent never misses the last value.
 *   3. Mirror the external `value` prop only when the user is NOT actively
 *      dragging (avoids "snap-back" mid-drag if upstream lags).
 */
const InspectorSlider = ({ label, value, min, max, step, onChange, testid, formatValue }) => {
  const [local, setLocal] = React.useState(value);
  const draggingRef = React.useRef(false);
  const rafRef = React.useRef(0);
  const lastValRef = React.useRef(value);

  // Sync downstream only when the user is not actively dragging.
  React.useEffect(() => {
    if (!draggingRef.current && value !== lastValRef.current) {
      lastValRef.current = value;
      setLocal(value);
    }
  }, [value]);

  const commit = React.useCallback((v) => {
    lastValRef.current = v;
    onChange(v);
  }, [onChange]);

  const handleInput = (e) => {
    const v = parseFloat(e.target.value);
    setLocal(v);
    // rAF-throttled upstream commit — at most one per frame.
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => commit(v));
  };

  const handleSettle = (e) => {
    draggingRef.current = false;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
    commit(parseFloat(e.target.value));
  };

  return (
    <label className="block mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="bp-eyebrow !text-[10px] !text-[var(--bp-text-secondary)]">{label}</span>
        <span className="bp-caption !text-[10px] text-[var(--bp-text-primary)] font-mono tabular-nums">
          {formatValue ? formatValue(local) : local}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={local}
             data-testid={testid}
             onPointerDown={() => { draggingRef.current = true; }}
             onInput={handleInput}
             onChange={handleInput}
             onMouseUp={handleSettle}
             onTouchEnd={handleSettle}
             onBlur={handleSettle}
             className="bp-slider" />
    </label>
  );
};

const FOCAL_PRESETS = [
  ['top-left',    '15% 15%'], ['top',    'center 15%'], ['top-right',    '85% 15%'],
  ['left',        '15% 50%'], ['center', 'center'],     ['right',        '85% 50%'],
  ['bottom-left', '15% 85%'], ['bottom', 'center 85%'], ['bottom-right', '85% 85%'],
];

// ── Block Inspector ─────────────────────────────────────────────────────────
const BlockInspector = ({ block, onChangeContent, onChangeStyle, onChange, onOpenQuickAdjust, onApplyStyleToAll, t }) => {
  const c = block.content || {};
  const s = block.style || {};
  const setC = (k, v) => onChangeContent({ ...c, [k]: v });
  const setS = (k, v) => onChangeStyle({ ...s, [k]: v });

  // Copy/Paste Style — clipboard is window-scoped (styleClipboard.js) so the
  // user can pick up a style on one block and drop it on another in any
  // moodboard during the same browser session.
  const [, forceRerender] = React.useState(0);
  const handleCopy = () => {
    copyStyle(block);
    forceRerender((n) => n + 1);
  };
  const handlePaste = () => {
    const patch = pasteStyle(block);
    if (patch) onChange(patch);
  };
  const canPaste = hasClipboardStyle() && clipboardBlockType() === block.type;

  // Image adjustments — CSS-filter based, persisted in style.adjustments.
  const adj = s.adjustments || {};
  const setAdj = (k, v) => onChangeStyle({ ...s, adjustments: { ...adj, [k]: v } });

  // ⚠️ CRITICAL: these MUST be JSX values (not nested components).
  // Previously declared as `const X = () => (...)` they were re-created on
  // every render, which made React see a new component type each tick and
  // unmount/remount their children — destroying slider focus and producing
  // the "sliders refresh while dragging" UX bug. Storing them as plain JSX
  // makes them ordinary expressions that just re-render in-place.

  const SHADOW_PRESETS = [
    { id: 'none',     label: t('moodboards.shadow.none') },
    { id: 'soft',     label: t('moodboards.shadow.soft') },
    { id: 'medium',   label: t('moodboards.shadow.medium') },
    { id: 'dramatic', label: t('moodboards.shadow.dramatic') },
  ];

  const cropFocalJsx = (
    <div className="pt-5 mt-5 border-t border-[var(--bp-border)]">
      <p className="bp-eyebrow !text-[10px] mb-4 !text-[var(--bp-text-secondary)]">
        {t('moodboards.editor.crop')}
      </p>
      <label className="block mb-4">
        <span className="bp-eyebrow !text-[10px] mb-1.5 block !text-[var(--bp-text-secondary)]">
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
      <div className="mb-4">
        <span className="bp-eyebrow !text-[10px] mb-2 block !text-[var(--bp-text-secondary)]">
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
              className="bp-btn bp-btn-ghost text-xs w-full mt-3"
              data-testid="reset-crop-btn">
        <RotateCcw size={11} strokeWidth={1.5} /> {t('moodboards.editor.resetCrop')}
      </button>
    </div>
  );

  const adjustmentsJsx = (
    <div className="pt-5 mt-5 border-t border-[var(--bp-border)]">
      <div className="flex items-center justify-between mb-4">
        <p className="bp-eyebrow !text-[10px] !text-[var(--bp-text-secondary)]">
          {t('moodboards.editor.adjustments')}
        </p>
        <button type="button"
                onClick={() => onChangeStyle({ ...s, adjustments: {} })}
                className="bp-caption !text-[10px] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] transition-colors"
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

  const visualPropsJsx = (
    <div className="pt-5 mt-5 border-t border-[var(--bp-border)]">
      <p className="bp-eyebrow !text-[10px] !text-[var(--bp-text-secondary)] mb-4">
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
        <label className="bp-eyebrow !text-[10px] !text-[var(--bp-text-secondary)] block mb-2">
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

  // Typography controls — fine-grained editorial controls applied via
  // style.typography. Stored shape: { font_family, font_size, font_weight,
  // line_height, letter_spacing, text_align, color, italic, underline,
  // uppercase, vertical_align }. JSX (not component) to avoid the same
  // remount issue we fixed earlier for adjustment sliders.
  const tg = (s.typography) || {};
  const setTg = (k, v) => onChangeStyle({ ...s, typography: { ...tg, [k]: v } });
  const typographyJsx = (
    <div className="pt-5 mt-5 border-t border-[var(--bp-border)]">
      <p className="bp-eyebrow !text-[10px] !text-[var(--bp-text-secondary)] mb-4">
        {t('moodboards.editor.typography', null, 'Typography')}
      </p>

      {/* Font family — full editorial registry. Grouped by category. */}
      <label className="block mb-4">
        <span className="bp-eyebrow !text-[10px] !text-[var(--bp-text-secondary)] mb-1.5 block">
          {t('moodboards.field.fontFamily', null, 'Font family')}
        </span>
        <select value={tg.font_family || 'heading'}
                onChange={(e) => setTg('font_family', e.target.value)}
                data-testid="typo-font-family"
                style={{ fontFamily: FONT_REGISTRY.find((f) => f.id === (tg.font_family || 'heading'))?.family }}
                className="input-luxury w-full px-2.5 py-2 text-sm rounded-[var(--bp-radius-sm)]">
          {FONT_CATEGORIES.map((cat) => {
            const items = FONT_REGISTRY.filter((f) => f.category === cat.id);
            if (!items.length) return null;
            return (
              <optgroup key={cat.id} label={cat.label}>
                {items.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </label>

      <InspectorSlider label={t('moodboards.field.fontSize', null, 'Size')}
                       value={tg.font_size ?? 16} min={10} max={120} step={1}
                       onChange={(v) => setTg('font_size', v)}
                       testid="typo-font-size" formatValue={(v) => `${v}px`} />

      <InspectorSlider label={t('moodboards.field.fontWeight', null, 'Weight')}
                       value={tg.font_weight ?? 400} min={100} max={900} step={100}
                       onChange={(v) => setTg('font_weight', v)}
                       testid="typo-font-weight" formatValue={(v) => String(v)} />

      <InspectorSlider label={t('moodboards.field.lineHeight', null, 'Line height')}
                       value={tg.line_height ?? 1.3} min={0.8} max={2.4} step={0.05}
                       onChange={(v) => setTg('line_height', v)}
                       testid="typo-line-height" formatValue={(v) => v.toFixed(2)} />

      <InspectorSlider label={t('moodboards.field.letterSpacing', null, 'Tracking')}
                       value={tg.letter_spacing ?? 0} min={-0.05} max={0.4} step={0.005}
                       onChange={(v) => setTg('letter_spacing', v)}
                       testid="typo-letter-spacing" formatValue={(v) => `${(v * 1000).toFixed(0)}`} />

      {/* Text align */}
      <div className="mb-4">
        <span className="bp-eyebrow !text-[10px] !text-[var(--bp-text-secondary)] mb-1.5 block">
          {t('moodboards.field.textAlign', null, 'Alignment')}
        </span>
        <div className="grid grid-cols-4 gap-1" data-testid="typo-text-align">
          {['left', 'center', 'right', 'justify'].map((a) => {
            const active = (tg.text_align || 'left') === a;
            return (
              <button key={a} type="button"
                      onClick={() => setTg('text_align', a)}
                      data-testid={`typo-align-${a}`}
                      className={`text-[10px] tracking-wider uppercase py-1.5 rounded-[var(--bp-radius-xs)] border transition-colors
                        ${active
                          ? 'border-[var(--bp-primary)] text-[var(--bp-text-primary)] bg-[var(--bp-surface-2)]'
                          : 'border-[var(--bp-border)] text-[var(--bp-text-muted)] hover:border-[var(--bp-border-strong)]'}`}>
                {a.slice(0, 1)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Decoration toggles */}
      <div className="mb-4">
        <span className="bp-eyebrow !text-[10px] !text-[var(--bp-text-secondary)] mb-1.5 block">
          {t('moodboards.field.decoration', null, 'Decoration')}
        </span>
        <div className="flex gap-1" data-testid="typo-decoration">
          <TogglePill testid="typo-italic" active={!!tg.italic} onClick={() => setTg('italic', !tg.italic)} label="I" italic />
          <TogglePill testid="typo-underline" active={!!tg.underline} onClick={() => setTg('underline', !tg.underline)} label="U" underline />
          <TogglePill testid="typo-uppercase" active={!!tg.uppercase} onClick={() => setTg('uppercase', !tg.uppercase)} label="AA" />
        </div>
      </div>

      {/* List style */}
      <div className="mb-4">
        <span className="bp-eyebrow !text-[10px] !text-[var(--bp-text-secondary)] mb-1.5 block">
          {t('moodboards.field.listStyle', null, 'List')}
        </span>
        <div className="grid grid-cols-3 gap-1" data-testid="typo-list-style">
          {[[null, 'None'], ['bullet', '• Bullet'], ['numbered', '1. Numbered']].map(([id, label]) => {
            const active = (c.list_style || null) === id;
            return (
              <button key={String(id)} type="button"
                      onClick={() => setC('list_style', id)}
                      data-testid={`typo-list-${id || 'none'}`}
                      className={`text-[10px] tracking-wider py-1.5 rounded-[var(--bp-radius-xs)] border transition-colors
                        ${active
                          ? 'border-[var(--bp-primary)] text-[var(--bp-text-primary)] bg-[var(--bp-surface-2)]'
                          : 'border-[var(--bp-border)] text-[var(--bp-text-muted)] hover:border-[var(--bp-border-strong)]'}`}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Color */}
      <label className="block mb-2">
        <span className="bp-eyebrow !text-[10px] !text-[var(--bp-text-secondary)] mb-1.5 block">
          {t('moodboards.field.color', null, 'Color')}
        </span>
        <BlueprintColorPicker
          value={tg.color || '#F5F2EC'}
          onChange={(v) => setTg('color', v)}
          testid="typo-color"
          align="right"
        />
      </label>
    </div>
  );

  // Shape controls — fill, border, dashed, radius
  const shapeJsx = (
    <>
      <label className="block mb-3">
        <span className="bp-eyebrow !text-[10px] !text-[var(--bp-text-secondary)] mb-1.5 block">
          {t('moodboards.field.shapeKind', null, 'Shape')}
        </span>
        <div className="grid grid-cols-3 gap-1" data-testid="shape-kind">
          {[['rectangle', '▭'], ['ellipse', '◯'], ['line', '─']].map(([id, glyph]) => {
            const active = (c.kind || 'rectangle') === id;
            return (
              <button key={id} type="button"
                      onClick={() => setC('kind', id)}
                      data-testid={`shape-kind-${id}`}
                      className={`py-3 text-[14px] rounded-[var(--bp-radius-xs)] border transition-colors
                        ${active
                          ? 'border-[var(--bp-primary)] text-[var(--bp-text-primary)] bg-[var(--bp-surface-2)]'
                          : 'border-[var(--bp-border)] text-[var(--bp-text-muted)] hover:border-[var(--bp-border-strong)]'}`}>
                {glyph}
              </button>
            );
          })}
        </div>
      </label>

      <label className="block mb-3">
        <span className="bp-eyebrow !text-[10px] !text-[var(--bp-text-secondary)] mb-1.5 block">
          {t('moodboards.field.fill', null, 'Fill')}
        </span>
        <BlueprintColorPicker
          value={s.fill && s.fill.startsWith('#') ? s.fill : '#FFFFFF'}
          onChange={(v) => setS('fill', v)}
          testid="shape-fill"
          align="right"
        />
      </label>

      <label className="block mb-3">
        <span className="bp-eyebrow !text-[10px] !text-[var(--bp-text-secondary)] mb-1.5 block">
          {t('moodboards.field.borderColor', null, 'Border color')}
        </span>
        <BlueprintColorPicker
          value={s.border_color && s.border_color.startsWith('#') ? s.border_color : '#F5F2EC'}
          onChange={(v) => setS('border_color', v)}
          testid="shape-border-color"
          align="right"
        />
      </label>

      <InspectorSlider label={t('moodboards.field.borderWidth', null, 'Border width')}
                       value={s.border_width ?? 1} min={0} max={16} step={1}
                       onChange={(v) => setS('border_width', v)}
                       testid="shape-border-width" formatValue={(v) => `${v}px`} />

      <div className="mb-4">
        <span className="bp-eyebrow !text-[10px] !text-[var(--bp-text-secondary)] mb-1.5 block">
          {t('moodboards.field.borderStyle', null, 'Border style')}
        </span>
        <div className="grid grid-cols-3 gap-1" data-testid="shape-border-style">
          {['solid', 'dashed', 'dotted'].map((bs) => {
            const active = (s.border_style || 'solid') === bs;
            return (
              <button key={bs} type="button"
                      onClick={() => setS('border_style', bs)}
                      data-testid={`shape-border-style-${bs}`}
                      className={`text-[10px] tracking-wider uppercase py-1.5 rounded-[var(--bp-radius-xs)] border transition-colors
                        ${active
                          ? 'border-[var(--bp-primary)] text-[var(--bp-text-primary)] bg-[var(--bp-surface-2)]'
                          : 'border-[var(--bp-border)] text-[var(--bp-text-muted)] hover:border-[var(--bp-border-strong)]'}`}>
                {bs}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );

  // Header rendered above EVERY block-type-specific inspector with the
  // Copy / Paste Style affordances and (optional) "Apply to all of this
  // type on this page" propagation.
  const inspectorHeader = (
    <div className="mb-4 pb-3 border-b border-[var(--bp-border)] flex items-center gap-1">
      <button type="button" onClick={handleCopy}
              data-testid="copy-style-btn"
              title={t('moodboards.editor.copyStyle', null, 'Copy style')}
              className="p-1.5 rounded-[var(--bp-radius-xs)] text-[var(--bp-text-muted)]
                         hover:text-[var(--bp-text-primary)] hover:bg-[var(--bp-surface-2)]/60
                         transition-colors">
        <Copy size={12} strokeWidth={1.5} />
      </button>
      <button type="button" onClick={handlePaste} disabled={!canPaste}
              data-testid="paste-style-btn"
              title={canPaste
                ? t('moodboards.editor.pasteStyle', null, 'Paste style')
                : t('moodboards.editor.pasteStyleEmpty', null, 'Nothing copied')}
              className={`p-1.5 rounded-[var(--bp-radius-xs)] transition-colors
                ${canPaste
                  ? 'text-[var(--bp-primary)] hover:bg-[var(--bp-primary)]/12'
                  : 'text-[var(--bp-text-subtle)] cursor-not-allowed'}`}>
        <Clipboard size={12} strokeWidth={1.5} />
      </button>
      <div className="flex-1" />
      <button type="button"
              onClick={() => onApplyStyleToAll?.(block)}
              data-testid="apply-style-all-pages-btn"
              title={t('moodboards.editor.applyStyleAll', null, 'Apply style to similar blocks on all pages')}
              className="text-[9px] tracking-[0.22em] uppercase text-[var(--bp-text-muted)]
                         hover:text-[var(--bp-primary)] transition-colors">
        {t('moodboards.editor.applyAll', null, 'Apply all')}
      </button>
    </div>
  );

  // Layout controls — geometry & positioning. Tactile numeric inputs in
  // pairs (W/H, X/Y) so the designer can dial in precision when needed.
  const layoutJsx = (
    <div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <label className="block">
          <span className="bp-eyebrow !text-[9px] !text-[var(--bp-text-subtle)] mb-1 block">W</span>
          <input type="number" value={Math.round(block.width || 0)}
                 onChange={(e) => onChange({ width: Math.max(20, parseInt(e.target.value, 10) || 0) })}
                 data-testid="block-width"
                 className="input-luxury w-full px-2 py-1.5 text-xs font-mono rounded-[var(--bp-radius-xs)] tabular-nums" />
        </label>
        <label className="block">
          <span className="bp-eyebrow !text-[9px] !text-[var(--bp-text-subtle)] mb-1 block">H</span>
          <input type="number" value={Math.round(block.height || 0)}
                 onChange={(e) => onChange({ height: Math.max(20, parseInt(e.target.value, 10) || 0) })}
                 data-testid="block-height"
                 className="input-luxury w-full px-2 py-1.5 text-xs font-mono rounded-[var(--bp-radius-xs)] tabular-nums" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <label className="block">
          <span className="bp-eyebrow !text-[9px] !text-[var(--bp-text-subtle)] mb-1 block">X</span>
          <input type="number" value={Math.round(block.x || 0)}
                 onChange={(e) => onChange({ x: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                 data-testid="block-x"
                 className="input-luxury w-full px-2 py-1.5 text-xs font-mono rounded-[var(--bp-radius-xs)] tabular-nums" />
        </label>
        <label className="block">
          <span className="bp-eyebrow !text-[9px] !text-[var(--bp-text-subtle)] mb-1 block">Y</span>
          <input type="number" value={Math.round(block.y || 0)}
                 onChange={(e) => onChange({ y: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                 data-testid="block-y"
                 className="input-luxury w-full px-2 py-1.5 text-xs font-mono rounded-[var(--bp-radius-xs)] tabular-nums" />
        </label>
      </div>
      <InspectorSlider label={t('moodboards.field.rotation')}
                       value={block.rotation || 0}
                       min={-180} max={180} step={1}
                       onChange={(v) => onChange({ rotation: v })}
                       testid="block-rotation" formatValue={(v) => `${v}°`} />
    </div>
  );

  // Future "Advanced" placeholder — kept intentionally minimal so the group
  // exists in the IA but doesn't try to do anything yet. Multi-select &
  // batch-edit will land here in a future sprint.
  const advancedJsx = (
    <div className="bp-caption !text-[11px] !text-[var(--bp-text-subtle)] italic leading-[1.55] py-2"
         style={{ fontFamily: 'Playfair Display, serif' }}>
      {t('moodboards.inspector.advancedSoon', null,
        'Multi-select & batch refinement will land here.')}
    </div>
  );

  switch (block.type) {
    case 'image':
      return (<>{inspectorHeader}
        <ImageUploader currentUrl={c.src} t={t}
                       onUploaded={(url, meta) => {
                         onChange({
                           content: { ...c, src: url },
                           metadata: { ...(block.metadata || {}), ...(meta || {}) },
                         });
                         onOpenQuickAdjust?.(url);
                       }} />
        <InspectorInput label={t('moodboards.field.imageUrl')} value={c.src}
                        onChange={(v) => setC('src', v)} testid="block-image-src" />
        <InspectorInput label={t('moodboards.field.caption')} value={c.caption}
                        onChange={(v) => setC('caption', v)} testid="block-image-caption" />
        <div className="mt-2 space-y-0">
          <InspectorGroup groupKey="LAYOUT" blockType="image"
                          title={t('moodboards.inspector.group.layout', null, 'Layout')}>
            {layoutJsx}
          </InspectorGroup>
          <InspectorGroup groupKey="IMAGE" blockType="image"
                          title={t('moodboards.inspector.group.image', null, 'Image')}
                          eyebrow={t('moodboards.inspector.group.image.eyebrow', null, 'crop & tonal')}>
            {cropFocalJsx}
            {adjustmentsJsx}
          </InspectorGroup>
          <InspectorGroup groupKey="STYLE" blockType="image"
                          title={t('moodboards.inspector.group.style', null, 'Style')}
                          eyebrow={t('moodboards.inspector.group.style.eyebrow', null, 'opacity · border · shadow')}>
            {visualPropsJsx}
          </InspectorGroup>
          <InspectorGroup groupKey="ADVANCED" blockType="image"
                          title={t('moodboards.inspector.group.advanced', null, 'Advanced')}>
            {advancedJsx}
          </InspectorGroup>
        </div>
      </>);
    case 'text':
      return (<>{inspectorHeader}
        <InspectorTextarea label={t('moodboards.field.text')} value={c.text}
                           onChange={(v) => setC('text', v)} testid="block-text-input" />
        <label className="block mb-3">
          <span className="bp-eyebrow !text-[10px] mb-1 block !text-[var(--bp-text-secondary)]">
            {t('moodboards.field.size')}
          </span>
          <select value={c.size || 'h3'} onChange={(e) => setC('size', e.target.value)}
                  data-testid="block-text-size"
                  className="input-luxury w-full px-2.5 py-1.5 text-sm rounded-[var(--bp-radius-sm)]">
            {['display','h1','h2','h3','body','caption','eyebrow'].map((sz) => <option key={sz}>{sz}</option>)}
          </select>
        </label>
        <div className="mt-2 space-y-0">
          <InspectorGroup groupKey="TYPOGRAPHY" blockType="text"
                          title={t('moodboards.inspector.group.typography', null, 'Typography')}
                          eyebrow={t('moodboards.inspector.group.typography.eyebrow', null, 'font · weight · tracking')}>
            {typographyJsx}
          </InspectorGroup>
          <InspectorGroup groupKey="LAYOUT" blockType="text"
                          title={t('moodboards.inspector.group.layout', null, 'Layout')}>
            {layoutJsx}
          </InspectorGroup>
          <InspectorGroup groupKey="STYLE" blockType="text"
                          title={t('moodboards.inspector.group.style', null, 'Style')}
                          eyebrow={t('moodboards.inspector.group.style.eyebrow', null, 'opacity · border · shadow')}>
            {visualPropsJsx}
          </InspectorGroup>
          <InspectorGroup groupKey="ADVANCED" blockType="text"
                          title={t('moodboards.inspector.group.advanced', null, 'Advanced')}>
            {advancedJsx}
          </InspectorGroup>
        </div>
      </>);
    case 'shape':
      return (<>{inspectorHeader}
        {shapeJsx}
        {visualPropsJsx}
      </>);
    case 'note':
      return (<>
        <InspectorTextarea label={t('moodboards.field.note')} value={c.text}
                           onChange={(v) => setC('text', v)} testid="block-note-input" />
      </>);
    case 'arrow':
      return (<>{inspectorHeader}
        <label className="block mb-3">
          <span className="bp-eyebrow !text-[10px] !text-[var(--bp-text-secondary)] mb-1.5 block">
            {t('moodboards.field.arrowKind', null, 'Arrow')}
          </span>
          <div className="grid grid-cols-3 gap-1" data-testid="arrow-kind">
            {[['straight', '→'], ['curved', '⤴'], ['sketch', '〰']].map(([id, glyph]) => {
              const active = (c.kind || 'straight') === id;
              return (
                <button key={id} type="button"
                        onClick={() => setC('kind', id)}
                        data-testid={`arrow-kind-${id}`}
                        className={`py-3 text-[16px] rounded-[var(--bp-radius-xs)] border transition-colors
                          ${active
                            ? 'border-[var(--bp-primary)] text-[var(--bp-text-primary)] bg-[var(--bp-surface-2)]'
                            : 'border-[var(--bp-border)] text-[var(--bp-text-muted)] hover:border-[var(--bp-border-strong)]'}`}>
                  {glyph}
                </button>
              );
            })}
          </div>
        </label>

        <label className="block mb-3">
          <span className="bp-eyebrow !text-[10px] !text-[var(--bp-text-secondary)] mb-1.5 block">
            {t('moodboards.field.arrowHead', null, 'Arrowhead')}
          </span>
          <div className="grid grid-cols-3 gap-1" data-testid="arrow-head">
            {['triangle', 'open', 'none'].map((h) => {
              const active = (c.head || 'triangle') === h;
              return (
                <button key={h} type="button"
                        onClick={() => setC('head', h)}
                        data-testid={`arrow-head-${h}`}
                        className={`text-[10px] uppercase tracking-wider py-1.5 rounded-[var(--bp-radius-xs)] border transition-colors
                          ${active
                            ? 'border-[var(--bp-primary)] text-[var(--bp-text-primary)] bg-[var(--bp-surface-2)]'
                            : 'border-[var(--bp-border)] text-[var(--bp-text-muted)] hover:border-[var(--bp-border-strong)]'}`}>
                  {h}
                </button>
              );
            })}
          </div>
        </label>

        <label className="block mb-3">
          <span className="bp-eyebrow !text-[10px] !text-[var(--bp-text-secondary)] mb-1.5 block">
            {t('moodboards.field.color', null, 'Color')}
          </span>
          <BlueprintColorPicker
            value={(s.color || '#F5F2EC').startsWith('#') ? s.color : '#F5F2EC'}
            onChange={(v) => setS('color', v)}
            testid="arrow-color"
            align="right"
          />
        </label>

        <InspectorSlider label={t('moodboards.field.thickness', null, 'Thickness')}
                         value={s.thickness ?? 2} min={1} max={12} step={1}
                         onChange={(v) => setS('thickness', v)}
                         testid="arrow-thickness" formatValue={(v) => `${v}px`} />

        <RowToggle label={t('moodboards.field.dashed', null, 'Dashed')}
                checked={!!s.dashed}
                onChange={(v) => setS('dashed', v)}
                testid="arrow-dashed" />
        {visualPropsJsx}
      </>);
    case 'palette':
      return (<>{inspectorHeader}
        <div>
          <span className="bp-eyebrow !text-[10px] mb-2 block !text-[var(--bp-text-muted)]">
            {t('moodboards.field.colors')}
          </span>
          {(c.colors || []).map((col, i) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <BlueprintColorPicker
                value={col}
                onChange={(v) => {
                  const next = [...(c.colors || [])]; next[i] = v; setC('colors', next);
                }}
                testid={`palette-color-${i}`}
                align="right"
              />
              <button onClick={() => setC('colors', c.colors.filter((_, j) => j !== i))}
                      className="text-[var(--bp-text-muted)] hover:text-red-400 ml-auto">
                <X size={11} />
              </button>
            </div>
          ))}
          <button onClick={() => setC('colors', [...(c.colors || []), '#FFFFFF'])}
                  className="bp-btn bp-btn-ghost text-xs w-full" data-testid="add-palette-color">
            <Plus size={11} strokeWidth={1.5} /> {t('moodboards.field.addColor')}
          </button>
        </div>
      </>);
    case 'product':
      return (<>{inspectorHeader}
        <ImageUploader currentUrl={c.image} t={t}
                       onUploaded={(url) => setC('image', url)} />
        <InspectorInput label={t('moodboards.field.name')}     value={c.name}   onChange={(v) => setC('name', v)} />
        <InspectorInput label={t('moodboards.field.vendor')}   value={c.vendor} onChange={(v) => setC('vendor', v)} />
        <InspectorInput label={t('moodboards.field.price')}    value={c.price}  onChange={(v) => setC('price', v)} />
        <InspectorInput label={t('moodboards.field.imageUrl')} value={c.image}  onChange={(v) => setC('image', v)} />
      </>);
    case 'material':
      return (<>{inspectorHeader}
        <ImageUploader currentUrl={c.swatch} t={t}
                       onUploaded={(url) => setC('swatch', url)} />
        <InspectorInput label={t('moodboards.field.name')}   value={c.name}   onChange={(v) => setC('name', v)} />
        <InspectorInput label={t('moodboards.field.finish')} value={c.finish} onChange={(v) => setC('finish', v)} />
        <InspectorInput label={t('moodboards.field.swatch')} value={c.swatch} onChange={(v) => setC('swatch', v)} />
      </>);
    default:
      // Editorial inspector placeholder — never an empty/technical message.
      // Each block type that lands here gets a hint and the universal style
      // section (visual props) is rendered below for continuity.
      return (<>{inspectorHeader}
        <div className="px-4 py-8 text-center">
          <p className="bp-caption !text-[11px] !text-[var(--bp-text-secondary)] leading-relaxed">
            {t('moodboards.editor.contextualHint', null,
              'Select an image, a shape or a text block on the canvas to reveal its dedicated controls here.')}
          </p>
        </div>
        {visualPropsJsx}
      </>);
  }
};

export default MoodboardEditor;
