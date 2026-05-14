/**
 * ReviewMode — Blueprint Client Collaboration Layer™ public client surface.
 *
 *  Route: /review/:shareToken
 *
 *  This is the unauthenticated client experience for a shared moodboard
 *  (and, in the future, proposal). It is INTENTIONALLY separate from
 *  /presentation/:shareToken which is the cinematic read-only walkthrough.
 *
 *  Layout:
 *
 *    ┌─────────────────────────────────────────────────────────┐
 *    │  ●●●●  Review · 3 approved · 2 pending · 1 revision     │  ← progress strip
 *    ├─────────────────────────────────────────────────────────┤
 *    │                                                         │
 *    │              [Page Canvas with anchored pins]           │  ← center stage
 *    │                                                         │
 *    ├─────────────────────────────────────────────────────────┤
 *    │  ◐ Page 1   ◐ Page 2   ●●● Approved   …                 │  ← page rail
 *    ├─────────────────────────────────────────────────────────┤
 *    │  Decision: Approve · Revision · Comment                 │  ← decision bar
 *    └─────────────────────────────────────────────────────────┘
 *
 *  Side drawer toggles a 3-tab panel: Comments · Activity · Ideas & References.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../lib/api';
import {
  Check, Pencil, Plus, MessageCircle, Activity, Sparkles, X,
  Heart, RefreshCw, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { resolveBlock } from '../../blueprint/moodboard/BlockRegistry';
import IdentityModal from '../../blueprint/collab/IdentityModal';
import CommentPin from '../../blueprint/collab/CommentPin';
import CommentThreadDrawer from '../../blueprint/collab/CommentThreadDrawer';
import ActivityTimeline from '../../blueprint/collab/ActivityTimeline';
import IdeasReferencesPanel from '../../blueprint/collab/IdeasReferencesPanel';
import useClientIdentity from '../../blueprint/collab/useClientIdentity';

const STATUS_META = {
  pending_review:     { label: 'Pending',  color: 'var(--bp-text-muted)' },
  approved:           { label: 'Approved', color: 'var(--bp-primary)' },
  revision_requested: { label: 'Revision', color: '#E0A458' },
  rejected:           { label: 'Rejected', color: '#D86F6F' },
};

const ReviewMode = () => {
  const { shareToken } = useParams();
  const [moodboard, setMoodboard] = useState(null);
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState(null);
  const [activePageIdx, setActivePageIdx] = useState(0);
  const [drawer, setDrawer] = useState(null);              // 'comments' | 'activity' | 'ideas' | null
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [draftPin, setDraftPin] = useState(null);          // {x, y} during placement
  const [composer, setComposer] = useState(null);          // { x, y, body, kind } when writing
  const [pageDecisionAnim, setPageDecisionAnim] = useState(null); // 'approved' | 'revision'
  const [uploading, setUploading] = useState(false);

  const canvasRef = useRef(null);
  const entityId = moodboard?.id;
  const ident = useClientIdentity(entityId);

  // ── Load the moodboard + collab overview in parallel ───────────────────────
  useEffect(() => {
    if (!shareToken) return;
    api.get(`/api/moodboards/public/share/${shareToken}`)
      .then((r) => setMoodboard(r.data))
      .catch((err) => setError(err?.response?.status === 404
        ? 'not_found' : err?.response?.status === 403 ? 'not_ready' : 'error'));
    api.get(`/api/collab/public/${shareToken}/overview`)
      .then((r) => setOverview(r.data))
      .catch(() => setOverview({ comments: [], page_statuses: [], activity: [], inspirations: [] }));
  }, [shareToken]);

  const refreshOverview = useCallback(() => {
    if (!shareToken) return;
    api.get(`/api/collab/public/${shareToken}/overview`)
      .then((r) => setOverview(r.data))
      .catch(() => {});
  }, [shareToken]);

  const pages = useMemo(() => moodboard?.pages || [], [moodboard]);
  const activePage = pages[activePageIdx] || null;
  const allComments = overview?.comments || [];
  const allStatuses = overview?.page_statuses || [];
  const allActivity = overview?.activity || [];
  const allInspirations = overview?.inspirations || [];

  const pageComments = useMemo(() =>
    allComments.filter((c) => c.page_id === activePage?.id && !c.parent_id),
    [allComments, activePage]);
  const repliesByRoot = useMemo(() => {
    const map = {};
    for (const c of allComments) {
      if (c.parent_id) (map[c.parent_id] = map[c.parent_id] || []).push(c);
    }
    return map;
  }, [allComments]);
  const statusByPage = useMemo(() => {
    const m = {};
    for (const s of allStatuses) m[s.page_id] = s;
    return m;
  }, [allStatuses]);

  // Overview counts for the progress strip
  const counts = useMemo(() => {
    const c = { pending_review: 0, approved: 0, revision_requested: 0, rejected: 0 };
    for (const p of pages) {
      const st = statusByPage[p.id]?.status || 'pending_review';
      c[st] = (c[st] || 0) + 1;
    }
    return c;
  }, [pages, statusByPage]);

  // Filtered blocks for the active page (same logic as PresentationMode)
  const pageBlocks = useMemo(() => {
    if (!activePage) return [];
    const all = moodboard?.elements || [];
    return all.filter((b) => b.page_id === activePage.id && !b.hidden
                              && !b.metadata?.hidden_from_client);
  }, [moodboard, activePage]);
  const orderedBlocks = useMemo(() => [...pageBlocks].sort((a, b) => {
    const dz = (a.z_index || 0) - (b.z_index || 0);
    return dz !== 0 ? dz : (a.created_at || '').localeCompare(b.created_at || '');
  }), [pageBlocks]);

  // ── Canvas scaling — letterbox into available area ─────────────────────────
  const pw = activePage?.settings?.canvas_width || activePage?.canvas_width || 1200;
  const ph = activePage?.settings?.canvas_height || activePage?.canvas_height || 800;
  const [canvasFrame, setCanvasFrame] = useState({ w: 1000, h: 600 });
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => {
      setCanvasFrame({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [activePageIdx]);
  const scale = Math.min((canvasFrame.w * 0.96) / pw, (canvasFrame.h * 0.96) / ph) || 1;

  // ── Comment placement flow ─────────────────────────────────────────────────
  const handleCanvasClick = (e) => {
    if (!placing || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    // Find the rendered page rect (which is letterboxed inside the canvas area)
    const renderedW = pw * scale;
    const renderedH = ph * scale;
    const pageLeft = rect.left + (rect.width - renderedW) / 2;
    const pageTop  = rect.top  + (rect.height - renderedH) / 2;
    const xPct = ((e.clientX - pageLeft) / renderedW) * 100;
    const yPct = ((e.clientY - pageTop) / renderedH) * 100;
    if (xPct < 0 || xPct > 100 || yPct < 0 || yPct > 100) return;
    setDraftPin({ x: xPct, y: yPct });
    setComposer({ x: xPct, y: yPct, body: '', kind: 'suggestion' });
    setPlacing(false);
  };

  const submitComposer = () => {
    if (!composer?.body?.trim() || !activePage) return;
    const body = composer.body.trim();
    const send = (who) => {
      api.post(`/api/collab/public/${shareToken}/comments`, {
        entity_type: 'moodboard',
        entity_id: entityId,
        page_id: activePage.id,
        pin_x: composer.x,
        pin_y: composer.y,
        kind: composer.kind,
        body,
        author_name: who.name,
        author_email: who.email,
      }).then(() => {
        setComposer(null);
        setDraftPin(null);
        refreshOverview();
      });
    };
    ident.withIdentity(send);
  };

  const submitReply = (rootComment, replyText) => {
    const send = (who) => {
      api.post(`/api/collab/public/${shareToken}/comments`, {
        entity_type: 'moodboard',
        entity_id: entityId,
        page_id: rootComment.page_id,
        parent_id: rootComment.id,
        kind: 'suggestion',
        body: replyText,
        author_name: who.name,
        author_email: who.email,
      }).then(refreshOverview);
    };
    ident.withIdentity(send);
  };

  // ── Page decision flow ─────────────────────────────────────────────────────
  const setStatus = (status) => {
    if (!activePage) return;
    const send = (who) => {
      api.post(`/api/collab/public/${shareToken}/page-status`, {
        entity_type: 'moodboard',
        entity_id: entityId,
        page_id: activePage.id,
        status,
        decided_by_name: who?.name,
      }).then(() => {
        setPageDecisionAnim(status);
        setTimeout(() => setPageDecisionAnim(null), 900);
        refreshOverview();
      });
    };
    if (status === 'approved' || status === 'revision_requested' || status === 'rejected') {
      ident.withIdentity(send);
    } else {
      send({ name: ident.identity?.name });
    }
  };

  // ── Inspiration upload (client) ────────────────────────────────────────────
  const uploadInspiration = (file) => {
    ident.withIdentity((who) => {
      const form = new FormData();
      form.append('file', file);
      if (who?.name) form.append('uploaded_by_name', who.name);
      if (who?.email) form.append('uploaded_by_email', who.email);
      setUploading(true);
      api.post(`/api/collab/public/${shareToken}/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(() => {
        refreshOverview();
        setUploading(false);
      }).catch(() => setUploading(false));
    });
  };

  // ── Empty / error states ───────────────────────────────────────────────────
  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[var(--bp-bg)]
                      text-[var(--bp-text-secondary)]"
           data-testid="review-mode-error">
        <p className="text-[14px] font-light">—</p>
      </div>
    );
  }
  if (!moodboard) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[var(--bp-bg)]"
           data-testid="review-mode-loading">
        <div className="w-5 h-5 border-2 border-[var(--bp-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeStatus = activePage ? (statusByPage[activePage.id]?.status || 'pending_review') : null;
  const activeThread = allComments.find((c) => c.id === activeThreadId);
  const activeThreadReplies = activeThreadId ? (repliesByRoot[activeThreadId] || []) : [];

  return (
    <div className="fixed inset-0 flex flex-col bg-[var(--bp-bg)] text-[var(--bp-text-primary)]"
         data-testid="review-mode"
         onClick={() => setActiveThreadId(null)}>
      {/* ── Top progress strip ──────────────────────────────────────────── */}
      <header className="flex-shrink-0 h-14 px-7 flex items-center gap-6 border-b border-[var(--bp-border)]"
              onClick={(e) => e.stopPropagation()}>
        <p className="text-[10px] tracking-[0.32em] uppercase text-[var(--bp-text-muted)]">
          Review
        </p>
        <p className="text-[14px] font-light text-[var(--bp-text-primary)] truncate"
           style={{ fontFamily: 'var(--bp-font-heading)' }}>
          {moodboard.title}
        </p>
        <div className="flex-1" />
        <ProgressChip label="Approved" value={counts.approved} color="var(--bp-primary)" testid="progress-approved" />
        <ProgressChip label="Revision" value={counts.revision_requested} color="#E0A458" testid="progress-revision" />
        <ProgressChip label="Pending"  value={counts.pending_review} color="var(--bp-text-muted)" testid="progress-pending" />
        <span className="w-px h-5 bg-[var(--bp-border)]" />
        <DrawerTab icon={MessageCircle} label="Comments"
                   testid="drawer-tab-comments"
                   active={drawer === 'comments'}
                   onClick={() => setDrawer((d) => d === 'comments' ? null : 'comments')} />
        <DrawerTab icon={Activity} label="Activity"
                   testid="drawer-tab-activity"
                   active={drawer === 'activity'}
                   onClick={() => setDrawer((d) => d === 'activity' ? null : 'activity')} />
        <DrawerTab icon={Sparkles} label="Ideas"
                   testid="drawer-tab-ideas"
                   active={drawer === 'ideas'}
                   onClick={() => setDrawer((d) => d === 'ideas' ? null : 'ideas')} />
      </header>

      {/* ── Center stage ────────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0">
        <main ref={canvasRef}
              onClick={handleCanvasClick}
              data-testid="review-canvas"
              className={`relative flex-1 flex items-center justify-center overflow-hidden
                          ${placing ? 'cursor-crosshair' : 'cursor-default'}
                          ${pageDecisionAnim === 'approved' ? 'review-flash-approved' : ''}
                          ${pageDecisionAnim === 'revision_requested' ? 'review-flash-revision' : ''}`}>
          {/* Previous/next page chevrons (subtle, large hit area) */}
          {activePageIdx > 0 && (
            <button onClick={(e) => { e.stopPropagation(); setActivePageIdx((i) => i - 1); }}
                    data-testid="review-prev-page"
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full
                               text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]
                               hover:bg-[var(--bp-surface-2)]/40 transition-colors">
              <ChevronLeft size={20} strokeWidth={1.25} />
            </button>
          )}
          {activePageIdx < pages.length - 1 && (
            <button onClick={(e) => { e.stopPropagation(); setActivePageIdx((i) => i + 1); }}
                    data-testid="review-next-page"
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full
                               text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]
                               hover:bg-[var(--bp-surface-2)]/40 transition-colors">
              <ChevronRight size={20} strokeWidth={1.25} />
            </button>
          )}

          {/* Page surface (letterboxed) */}
          {activePage && (
            <div className="relative shadow-[0_30px_90px_rgba(0,0,0,0.45)] overflow-hidden
                            bg-[var(--bp-surface-1)] border border-[var(--bp-border)]"
                 data-testid={`review-page-${activePage.id}`}
                 style={{ width: pw * scale, height: ph * scale }}>
              {/* Scaled inner canvas (same scaling math as PresentationMode) */}
              <div className="absolute top-0 left-0"
                   style={{
                     width: pw, height: ph,
                     transform: `scale(${scale})`,
                     transformOrigin: 'top left',
                   }}>
                {orderedBlocks.map((b) => {
                  const Component = resolveBlock(b.type);
                  if (!Component) return null;
                  return (
                    <div key={b.id} className="absolute"
                         style={{
                           left: b.x, top: b.y, width: b.width, height: b.height,
                           zIndex: b.z_index || 0,
                           opacity: (b.opacity !== undefined ? b.opacity : 1),
                           transform: b.rotation ? `rotate(${b.rotation}deg)` : undefined,
                         }}>
                      <Component block={b} readOnly t={(k) => k} />
                    </div>
                  );
                })}
              </div>

              {/* Anchored comment pins layer — overlay on the rendered page rect */}
              <div className="absolute inset-0 pointer-events-none">
                {pageComments.map((c) => (
                  <CommentPin key={c.id} comment={c}
                              replies={repliesByRoot[c.id] || []}
                              active={c.id === activeThreadId}
                              onClick={(id) => setActiveThreadId(id)} />
                ))}
                {draftPin && (
                  <span data-testid="review-draft-pin"
                        className="absolute z-30 w-3 h-3 rounded-full bg-white border-2 border-[var(--bp-primary)] shadow-[0_4px_12px_rgba(0,0,0,0.4)] -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${draftPin.x}%`, top: `${draftPin.y}%` }} />
                )}
              </div>

              {/* Subtle status overlay corner pip */}
              {activeStatus && activeStatus !== 'pending_review' && (
                <span data-testid={`review-status-pip-${activeStatus}`}
                      className="absolute top-3 left-3 z-30 flex items-center gap-1.5 px-2 py-1
                                 text-[10px] tracking-[0.22em] uppercase rounded-[2px]
                                 bg-black/55 backdrop-blur text-white"
                      style={{ color: STATUS_META[activeStatus].color }}>
                  {STATUS_META[activeStatus].label}
                </span>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ── Decision bar (sticky at the bottom of the stage) ────────────── */}
      <footer className="flex-shrink-0 border-t border-[var(--bp-border)] px-7 py-3"
              onClick={(e) => e.stopPropagation()}>
        {/* Page rail */}
        <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1" data-testid="review-page-rail">
          {pages.map((p, idx) => {
            const st = statusByPage[p.id]?.status || 'pending_review';
            const isActive = idx === activePageIdx;
            return (
              <button key={p.id} onClick={() => setActivePageIdx(idx)}
                      data-testid={`review-page-tab-${idx}`}
                      title={p.title}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-[2px] text-[11px] tracking-wider
                                  flex-shrink-0 transition-all whitespace-nowrap
                                  ${isActive
                                    ? 'bg-[var(--bp-surface-2)] text-[var(--bp-text-primary)]'
                                    : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]'}`}>
                <span className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: STATUS_META[st].color }} />
                <span className="font-mono text-[10px] tabular-nums opacity-60">{String(idx + 1).padStart(2, '0')}</span>
                <span className="max-w-[160px] truncate">{p.title || `Page ${idx + 1}`}</span>
              </button>
            );
          })}
        </div>

        {/* Action row */}
        <div className="flex items-center gap-3">
          <button onClick={() => setPlacing((p) => !p)}
                  data-testid="review-add-comment-btn"
                  className={`flex items-center gap-2 px-4 py-2 rounded-[2px] text-[11px] tracking-[0.18em] uppercase
                              transition-all border
                              ${placing
                                ? 'bg-[var(--bp-primary)]/15 border-[var(--bp-primary)] text-[var(--bp-primary)]'
                                : 'border-[var(--bp-border)] text-[var(--bp-text-secondary)] hover:text-[var(--bp-text-primary)] hover:border-[var(--bp-text-muted)]'}`}>
            <Pencil size={11} strokeWidth={1.5} />
            {placing ? 'Click on canvas…' : 'Add comment'}
          </button>

          <div className="flex-1" />

          <button onClick={() => setStatus('revision_requested')}
                  data-testid="review-request-revision-btn"
                  className="flex items-center gap-2 px-4 py-2 rounded-[2px] text-[11px] tracking-[0.18em] uppercase
                             border border-[#E0A458]/40 text-[#E0A458] hover:bg-[#E0A458]/10 transition-colors">
            <RefreshCw size={11} strokeWidth={1.5} />
            Request revision
          </button>
          <button onClick={() => setStatus('approved')}
                  data-testid="review-approve-page-btn"
                  className="flex items-center gap-2 px-5 py-2 rounded-[2px] text-[11px] tracking-[0.18em] uppercase
                             bg-[var(--bp-primary)] text-black hover:brightness-110 transition-all">
            <Heart size={11} strokeWidth={1.5} />
            Approve page
          </button>
        </div>
      </footer>

      {/* ── Side drawer (Comments / Activity / Ideas) ─────────────────── */}
      {drawer && (
        <aside className="fixed top-14 right-0 bottom-0 z-[55] w-full sm:w-[380px]
                          bg-[var(--bp-surface-1)] border-l border-[var(--bp-border)]
                          shadow-[-20px_0_50px_rgba(0,0,0,0.4)] flex flex-col"
               onClick={(e) => e.stopPropagation()}
               data-testid={`review-side-drawer-${drawer}`}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--bp-border)]">
            <p className="text-[10px] tracking-[0.28em] uppercase text-[var(--bp-text-muted)]">
              {drawer === 'comments' ? 'Comments' : drawer === 'activity' ? 'Activity' : 'Ideas & References'}
            </p>
            <button onClick={() => setDrawer(null)}
                    className="p-1.5 rounded-[3px] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] hover:bg-[var(--bp-surface-2)]/60 transition-colors">
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {drawer === 'comments' && (
              <CommentsList comments={allComments.filter((c) => !c.parent_id)}
                            repliesByRoot={repliesByRoot}
                            onOpen={(c) => {
                              const idx = pages.findIndex((p) => p.id === c.page_id);
                              if (idx >= 0) setActivePageIdx(idx);
                              setActiveThreadId(c.id);
                              setDrawer(null);
                            }} />
            )}
            {drawer === 'activity' && <ActivityTimeline activity={allActivity} />}
            {drawer === 'ideas' && (
              <IdeasReferencesPanel inspirations={allInspirations}
                                    onUpload={uploadInspiration}
                                    uploading={uploading}
                                    asClient />
            )}
          </div>
        </aside>
      )}

      {/* ── Thread drawer (pin click) ────────────────────────────────── */}
      {activeThread && (
        <CommentThreadDrawer comment={activeThread}
                             replies={activeThreadReplies}
                             onClose={() => setActiveThreadId(null)}
                             onReply={(text) => submitReply(activeThread, text)}
                             asClient />
      )}

      {/* ── New-comment composer ──────────────────────────────────────── */}
      {composer && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[55] w-[440px] max-w-[92vw]
                        bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[3px]
                        shadow-[0_30px_70px_rgba(0,0,0,0.45)] p-5"
             data-testid="review-comment-composer"
             onClick={(e) => e.stopPropagation()}>
          <p className="text-[10px] tracking-[0.28em] uppercase text-[var(--bp-text-muted)] mb-2.5">
            Leave a thought
          </p>
          <textarea autoFocus rows={3} value={composer.body}
                    onChange={(e) => setComposer((c) => ({ ...c, body: e.target.value }))}
                    placeholder="Anything that helps your designer…"
                    data-testid="composer-body"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitComposer();
                    }}
                    className="w-full bg-[var(--bp-surface-2)]/40 border border-[var(--bp-border)]
                               rounded-[3px] px-3 py-2.5 text-[13px] text-[var(--bp-text-primary)]
                               placeholder-[var(--bp-text-subtle)] focus:outline-none
                               focus:border-[var(--bp-border-strong)] resize-none" />
          <div className="flex items-center gap-3 mt-3">
            <KindChip kind="suggestion" active={composer.kind === 'suggestion'} onClick={(k) => setComposer((c) => ({ ...c, kind: k }))} />
            <KindChip kind="issue"      active={composer.kind === 'issue'} onClick={(k) => setComposer((c) => ({ ...c, kind: k }))} />
            <KindChip kind="inspiration" active={composer.kind === 'inspiration'} onClick={(k) => setComposer((c) => ({ ...c, kind: k }))} />
            <div className="flex-1" />
            <button onClick={() => { setComposer(null); setDraftPin(null); }}
                    data-testid="composer-cancel"
                    className="text-[10px] tracking-[0.22em] uppercase text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]">
              Cancel
            </button>
            <button onClick={submitComposer} disabled={!composer.body.trim()}
                    data-testid="composer-submit"
                    className={`px-4 py-1.5 text-[10px] tracking-[0.18em] uppercase rounded-[2px] transition-all
                      ${composer.body.trim() ? 'bg-[var(--bp-primary)] text-black hover:brightness-110' : 'bg-[var(--bp-surface-2)] text-[var(--bp-text-muted)] cursor-not-allowed'}`}>
              Send
            </button>
          </div>
        </div>
      )}

      {/* ── Identity gate ─────────────────────────────────────────────── */}
      {ident.isAsking && (
        <IdentityModal onSubmit={ident.completeAsk} onCancel={ident.cancelAsk} />
      )}
    </div>
  );
};

// ── Sub-components ─────────────────────────────────────────────────────────
const ProgressChip = ({ label, value, color, testid }) => (
  <div className="flex items-center gap-2" data-testid={testid}>
    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
    <span className="text-[10px] tracking-[0.22em] uppercase text-[var(--bp-text-muted)]">{label}</span>
    <span className="text-[12px] tabular-nums font-mono text-[var(--bp-text-primary)]">{value}</span>
  </div>
);

const DrawerTab = ({ icon: Icon, label, active, onClick, testid }) => (
  <button onClick={onClick} data-testid={testid}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] text-[10px] tracking-[0.22em] uppercase transition-colors
            ${active
              ? 'text-[var(--bp-primary)] bg-[var(--bp-primary)]/10'
              : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]'}`}>
    <Icon size={12} strokeWidth={1.5} />
    {label}
  </button>
);

const KindChip = ({ kind, active, onClick }) => (
  <button onClick={() => onClick(kind)}
          data-testid={`composer-kind-${kind}`}
          className={`text-[9px] tracking-[0.22em] uppercase px-2 py-1 rounded-[2px] border transition-colors
            ${active
              ? 'border-[var(--bp-primary)] text-[var(--bp-primary)]'
              : 'border-[var(--bp-border)] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]'}`}>
    {kind}
  </button>
);

const CommentsList = ({ comments, repliesByRoot, onOpen }) => {
  if (comments.length === 0) {
    return <p className="text-[12px] text-[var(--bp-text-muted)] italic">No comments yet.</p>;
  }
  return (
    <ul className="space-y-4" data-testid="comments-list">
      {comments.map((c) => (
        <li key={c.id}>
          <button onClick={() => onOpen(c)}
                  data-testid={`comments-list-item-${c.id}`}
                  className="w-full text-left p-3 rounded-[3px] border border-[var(--bp-border)] bg-[var(--bp-surface-2)]/40
                             hover:border-[var(--bp-border-strong)] hover:bg-[var(--bp-surface-2)]/70 transition-colors">
            <p className="text-[10px] tracking-[0.22em] uppercase text-[var(--bp-text-muted)] mb-1.5 flex items-center gap-2">
              <span>{c.author_name || (c.author_role === 'designer' ? 'Designer' : 'Client')}</span>
              {(repliesByRoot[c.id] || []).length > 0 && (
                <span className="text-[var(--bp-text-subtle)]">· {repliesByRoot[c.id].length} replies</span>
              )}
              {c.resolved && <span className="text-[var(--bp-primary)]">· resolved</span>}
            </p>
            <p className="text-[13px] text-[var(--bp-text-primary)] leading-relaxed line-clamp-3">
              {c.body}
            </p>
          </button>
        </li>
      ))}
    </ul>
  );
};

export default ReviewMode;
