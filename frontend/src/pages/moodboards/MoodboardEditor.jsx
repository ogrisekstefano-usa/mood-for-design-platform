/**
 * MoodboardEditor — V1 canvas editor for Blueprint Moodboards™.
 *
 * Features (V1):
 *  - Canvas with absolute-positioned blocks (image/text/palette/note/product/material)
 *  - Mouse drag + corner resize with autosave (debounced)
 *  - Add block toolbar
 *  - Inline content edit panel (right rail) when a block is selected
 *  - Approval workflow (draft → in_review → approved/rejected)
 *  - Share token (read-only client review at /moodboard/share/:token)
 *
 * Architectural prep (NOT implemented in V1):
 *  - PDF export endpoint stub
 *  - Hotspot system (block type accepted server-side)
 *  - AI material suggestions
 *  - Presentation mode
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import {
  ArrowLeft, Plus, Trash2, Save, Check, Share2, Eye, ExternalLink,
  Send, X, MoreHorizontal,
} from 'lucide-react';
import { resolveBlock, BLOCK_TYPES } from '../../blueprint/moodboard/BlockRegistry';

const CANVAS_W = 1400;
const CANVAS_H = 2400;

const StatusBadge = ({ status }) => {
  const tones = {
    draft: 'bg-[var(--bp-surface-2)] text-[var(--bp-text-muted)]',
    in_review: 'bg-amber-500/10 text-amber-400',
    approved: 'bg-emerald-500/10 text-emerald-400',
    rejected: 'bg-red-500/10 text-red-400',
  };
  return <span className={`bp-eyebrow !text-[10px] px-2 py-1 rounded-[var(--bp-radius-xs)] ${tones[status] || tones.draft}`}>{status || 'draft'}</span>;
};

const MoodboardEditor = ({ readOnly = false }) => {
  const { id, shareToken } = useParams();
  const navigate = useNavigate();
  const [mb, setMb] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [dirtyMap, setDirtyMap] = useState({}); // id → true
  const [savedAt, setSavedAt] = useState(null);
  const [drag, setDrag] = useState(null);
  const [shareDialog, setShareDialog] = useState(null);

  const canvasRef = useRef();
  const saveTimer = useRef();

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const url = readOnly
      ? `/api/moodboards/public/share/${shareToken}`
      : `/api/moodboards/${id}`;
    const fn = readOnly ? api.get : api.get;
    fn(url).then((r) => {
      setMb(r.data);
      setBlocks(r.data.elements || []);
    }).catch(() => { if (!readOnly) navigate('/moodboards'); });
  }, [id, shareToken, readOnly, navigate]);

  // ── Autosave (debounced) ──────────────────────────────────────────────────
  const flushSave = useCallback(async () => {
    if (readOnly) return;
    const ids = Object.keys(dirtyMap);
    if (!ids.length) return;
    const payload = blocks.filter((b) => ids.includes(b.id))
      .map((b) => ({ id: b.id, x: b.x, y: b.y, width: b.width, height: b.height, content: b.content, z_index: b.z_index }));
    try {
      await api.patch(`/api/moodboards/${id}/blocks/batch`, { blocks: payload });
      setDirtyMap({});
      setSavedAt(Date.now());
    } catch (e) { /* swallow — show inline error if needed */ }
  }, [blocks, dirtyMap, id, readOnly]);

  useEffect(() => {
    if (readOnly) return;
    if (!Object.keys(dirtyMap).length) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSave, 800);
    return () => clearTimeout(saveTimer.current);
  }, [dirtyMap, flushSave, readOnly]);

  const markDirty = (bid) => setDirtyMap((m) => ({ ...m, [bid]: true }));

  // ── Block CRUD ────────────────────────────────────────────────────────────
  const addBlock = async (type) => {
    if (readOnly) return;
    const meta = BLOCK_TYPES.find((b) => b.type === type);
    const payload = { type, x: 60, y: 60, ...meta.defaults };
    const r = await api.post(`/api/moodboards/${id}/blocks`, payload);
    setBlocks((bs) => [...bs, r.data]);
    setSelectedId(r.data.id);
  };

  const updateBlock = (bid, patch) => {
    setBlocks((bs) => bs.map((b) => b.id === bid ? { ...b, ...patch } : b));
    markDirty(bid);
  };

  const removeBlock = async (bid) => {
    if (readOnly) return;
    await api.delete(`/api/moodboards/${id}/blocks/${bid}`);
    setBlocks((bs) => bs.filter((b) => b.id !== bid));
    setSelectedId(null);
  };

  // ── Drag / resize ─────────────────────────────────────────────────────────
  const startDrag = (e, block, mode = 'move') => {
    if (readOnly) return;
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
      setBlocks((bs) => bs.map((b) => {
        if (b.id !== drag.id) return b;
        if (drag.mode === 'move') {
          return { ...b, x: Math.max(0, drag.origX + dx), y: Math.max(0, drag.origY + dy) };
        }
        return {
          ...b,
          width:  Math.max(80, drag.origW + dx),
          height: Math.max(60, drag.origH + dy),
        };
      }));
      markDirty(drag.id);
    };
    const onUp = () => setDrag(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [drag]);

  // ── Approval ──────────────────────────────────────────────────────────────
  const changeApproval = async (status) => {
    const r = await api.post(`/api/moodboards/${id}/approval`, { status });
    setMb((m) => ({ ...m, ...r.data }));
  };

  const createShareToken = async () => {
    const r = await api.post(`/api/moodboards/${id}/share`);
    const url = `${window.location.origin}/moodboard/share/${r.data.share_token}`;
    setShareDialog(url);
    setMb((m) => ({ ...m, share_token: r.data.share_token }));
  };

  const selectedBlock = useMemo(() => blocks.find((b) => b.id === selectedId), [blocks, selectedId]);

  if (!mb) {
    return <div className="p-10"><div className="w-5 h-5 border-2 border-[var(--bp-primary)] border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col h-screen bg-[var(--bp-bg)]" data-testid={readOnly ? 'moodboard-public' : 'moodboard-editor'}>
      {/* Topbar */}
      <header className="flex items-center justify-between gap-4 px-6 h-14 border-b border-[var(--bp-border)] bg-[var(--bp-surface-1)]/60 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-4">
          {!readOnly && (
            <button onClick={() => navigate(-1)} className="bp-caption text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]" data-testid="back-btn">
              <ArrowLeft size={13} strokeWidth={1.5} className="inline mr-1" /> Back
            </button>
          )}
          <h1 className="bp-h3 text-[var(--bp-text-primary)]">{mb.title || 'Untitled moodboard'}</h1>
          <StatusBadge status={mb.status} />
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            {savedAt && Object.keys(dirtyMap).length === 0 && (
              <span className="bp-caption text-[var(--bp-text-muted)] flex items-center gap-1">
                <Check size={12} strokeWidth={1.5} /> Saved
              </span>
            )}
            {mb.status === 'draft' && (
              <button onClick={() => changeApproval('in_review')} className="bp-btn bp-btn-ghost text-xs" data-testid="send-review-btn">
                <Send size={12} strokeWidth={1.5} /> Send for review
              </button>
            )}
            {mb.status === 'in_review' && (
              <>
                <button onClick={() => changeApproval('rejected')} className="bp-btn bp-btn-ghost text-xs" data-testid="reject-btn">Reject</button>
                <button onClick={() => changeApproval('approved')} className="bp-btn bp-btn-primary text-xs" data-testid="approve-btn">
                  <Check size={12} strokeWidth={1.5} /> Approve
                </button>
              </>
            )}
            <button onClick={createShareToken} className="bp-btn bp-btn-ghost text-xs" data-testid="share-btn">
              <Share2 size={12} strokeWidth={1.5} /> Share
            </button>
          </div>
        )}
      </header>

      <div className="flex flex-1 min-h-0">
        {/* LEFT — Add blocks toolbar */}
        {!readOnly && (
          <aside className="w-[200px] flex-shrink-0 border-r border-[var(--bp-border)] bg-[var(--bp-surface-1)]/40 p-4">
            <p className="bp-eyebrow mb-4">Add block</p>
            <div className="space-y-2">
              {BLOCK_TYPES.map((bt) => (
                <button key={bt.type} onClick={() => addBlock(bt.type)} data-testid={`add-${bt.type}`}
                  className="w-full px-3 py-2.5 bg-[var(--bp-surface-1)] hover:bg-[var(--bp-surface-2)] border border-[var(--bp-border)] rounded-[var(--bp-radius-sm)] text-left text-sm font-body text-[var(--bp-text-primary)] flex items-center gap-2 transition-colors">
                  <Plus size={12} strokeWidth={1.5} className="text-[var(--bp-text-muted)]" /> {bt.label}
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
            {blocks.map((b) => {
              const Component = resolveBlock(b.type);
              const isSelected = selectedId === b.id;
              return (
                <div key={b.id} data-testid={`block-${b.type}`}
                  className={`absolute group ${isSelected ? 'ring-2 ring-[var(--bp-primary)]' : 'hover:ring-1 hover:ring-[var(--bp-border-strong)]'}`}
                  style={{ left: b.x, top: b.y, width: b.width, height: b.height, zIndex: b.z_index || 0 }}
                  onMouseDown={(e) => startDrag(e, b, 'move')}
                  onClick={(e) => { e.stopPropagation(); setSelectedId(b.id); }}>
                  {Component ? <Component block={b} readOnly={readOnly} /> :
                    <div className="bp-caption text-[var(--bp-text-muted)] p-2">Unknown block: {b.type}</div>}
                  {!readOnly && isSelected && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); removeBlock(b.id); }}
                        data-testid={`delete-block-${b.id}`}
                        className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md">
                        <X size={12} strokeWidth={2} />
                      </button>
                      <div onMouseDown={(e) => startDrag(e, b, 'resize')}
                        className="absolute bottom-0 right-0 w-3 h-3 bg-[var(--bp-primary)] rounded-tl-[var(--bp-radius-xs)] cursor-se-resize" />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </main>

        {/* RIGHT — Inspector for selected block */}
        {!readOnly && selectedBlock && (
          <aside className="w-[300px] flex-shrink-0 border-l border-[var(--bp-border)] bg-[var(--bp-surface-1)]/40 p-5 overflow-y-auto">
            <p className="bp-eyebrow mb-1">{selectedBlock.type}</p>
            <h3 className="bp-h3 mb-5">Block inspector</h3>
            <BlockInspector block={selectedBlock} onChange={(content) => updateBlock(selectedBlock.id, { content })} />
          </aside>
        )}
      </div>

      {/* Share dialog */}
      {shareDialog && (
        <div className="fixed inset-0 z-50 bg-[var(--bp-overlay)] backdrop-blur-sm flex items-center justify-center" onClick={() => setShareDialog(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bp-glass p-6 rounded-[var(--bp-radius-md)] max-w-md">
            <p className="bp-eyebrow mb-2">Share link</p>
            <h3 className="bp-h3 mb-4">Send to client</h3>
            <input readOnly value={shareDialog} data-testid="share-url"
              className="input-luxury w-full px-3 py-2 text-sm rounded-[var(--bp-radius-sm)] mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShareDialog(null)} className="bp-btn bp-btn-ghost text-xs">Close</button>
              <a href={shareDialog} target="_blank" rel="noreferrer" className="bp-btn bp-btn-primary text-xs">
                <ExternalLink size={12} strokeWidth={1.5} /> Open
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Block Inspector ─────────────────────────────────────────────────────────
const InspectorInput = ({ label, value, onChange, ...rest }) => (
  <label className="block mb-3">
    <span className="bp-eyebrow !text-[10px] mb-1 block !text-[var(--bp-text-muted)]">{label}</span>
    <input value={value || ''} onChange={(e) => onChange(e.target.value)}
      className="input-luxury w-full px-2.5 py-1.5 text-sm rounded-[var(--bp-radius-sm)]" {...rest} />
  </label>
);

const InspectorTextarea = ({ label, value, onChange }) => (
  <label className="block mb-3">
    <span className="bp-eyebrow !text-[10px] mb-1 block !text-[var(--bp-text-muted)]">{label}</span>
    <textarea value={value || ''} onChange={(e) => onChange(e.target.value)} rows={4}
      className="input-luxury w-full px-2.5 py-1.5 text-sm rounded-[var(--bp-radius-sm)] resize-y" />
  </label>
);

const BlockInspector = ({ block, onChange }) => {
  const c = block.content || {};
  const set = (k, v) => onChange({ ...c, [k]: v });

  switch (block.type) {
    case 'image':
      return (<>
        <InspectorInput label="Image URL" value={c.src} onChange={(v) => set('src', v)} testid="block-src" />
        <InspectorInput label="Caption"   value={c.caption} onChange={(v) => set('caption', v)} />
      </>);
    case 'text':
      return (<>
        <InspectorTextarea label="Text" value={c.text} onChange={(v) => set('text', v)} />
        <label className="block mb-3">
          <span className="bp-eyebrow !text-[10px] mb-1 block !text-[var(--bp-text-muted)]">Size</span>
          <select value={c.size || 'h3'} onChange={(e) => set('size', e.target.value)}
            className="input-luxury w-full px-2.5 py-1.5 text-sm rounded-[var(--bp-radius-sm)]">
            {['display','h1','h2','h3','body','caption','eyebrow'].map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
      </>);
    case 'note':
      return <InspectorTextarea label="Note" value={c.text} onChange={(v) => set('text', v)} />;
    case 'palette':
      return (
        <div>
          <span className="bp-eyebrow !text-[10px] mb-2 block !text-[var(--bp-text-muted)]">Colors (HEX)</span>
          {(c.colors || []).map((col, i) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <input type="color" value={col} onChange={(e) => {
                const next = [...(c.colors || [])]; next[i] = e.target.value;
                set('colors', next);
              }} className="w-8 h-8 rounded-[var(--bp-radius-xs)] cursor-pointer bg-transparent" />
              <input value={col} onChange={(e) => {
                const next = [...(c.colors || [])]; next[i] = e.target.value;
                set('colors', next);
              }} className="input-luxury flex-1 px-2 py-1 text-xs font-mono rounded-[var(--bp-radius-xs)]" />
              <button onClick={() => set('colors', c.colors.filter((_, j) => j !== i))}
                className="text-[var(--bp-text-muted)] hover:text-red-400"><X size={11} /></button>
            </div>
          ))}
          <button onClick={() => set('colors', [...(c.colors || []), '#FFFFFF'])} className="bp-btn bp-btn-ghost text-xs w-full">
            <Plus size={11} strokeWidth={1.5} /> Add color
          </button>
        </div>
      );
    case 'product':
      return (<>
        <InspectorInput label="Name"   value={c.name}   onChange={(v) => set('name', v)} />
        <InspectorInput label="Vendor" value={c.vendor} onChange={(v) => set('vendor', v)} />
        <InspectorInput label="Price"  value={c.price}  onChange={(v) => set('price', v)} />
        <InspectorInput label="Image URL" value={c.image} onChange={(v) => set('image', v)} />
      </>);
    case 'material':
      return (<>
        <InspectorInput label="Name"     value={c.name}    onChange={(v) => set('name', v)} />
        <InspectorInput label="Finish"   value={c.finish}  onChange={(v) => set('finish', v)} />
        <InspectorInput label="Swatch URL" value={c.swatch} onChange={(v) => set('swatch', v)} />
      </>);
    default:
      return <p className="bp-caption text-[var(--bp-text-muted)]">No inspector for this block type.</p>;
  }
};

export default MoodboardEditor;
