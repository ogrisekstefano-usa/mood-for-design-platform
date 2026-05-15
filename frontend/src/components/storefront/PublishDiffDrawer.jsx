/**
 * PublishDiffDrawer — Draft vs Live visual diff + revisions timeline.
 *
 * Cinematic right-side drawer that lives ON TOP of StorefrontStudio.
 * Inspired by Vercel previews + Notion publishing + Linear polish.
 *
 * Three tabs:
 *   1. Changes — structured diff between live draft and published revision
 *      • Page-level field changes (title, locale_meta, page_content)
 *      • Sections added / removed / reordered
 *      • Per-section field changes with from→to highlight (inline)
 *   2. Revisions — newest-first timeline with one-click revert + label
 *   3. Confirm  — publish summary right before the user hits "Publish now"
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  X, GitCommit, Send, RotateCcw, Loader2, ArrowRight, Plus, Minus, Eye, History, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { storefrontApi } from './storefrontApi';
import AISuggestionPanel from '../ai/AISuggestionPanel';

// ── Helpers ─────────────────────────────────────────────────────────
const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
};

const fmtVal = (v) => {
  if (v == null) return '∅';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    try { return JSON.stringify(v, null, 2); } catch { return String(v); }
  }
  return String(v);
};

// Quick inline word diff — fast, no external dep. Highlights added (green) and
// removed (rose) tokens, preserves spacing. Suitable for short headline-style
// strings; full prose diffs would warrant a proper LCS algorithm.
const tokenize = (s) => (s || '').toString().split(/(\s+)/);

const InlineTextDiff = ({ from, to }) => {
  const a = tokenize(from);
  const b = tokenize(to);
  // Compute longest-common-subsequence with simple DP (short strings only)
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const parts = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) { parts.push({ kind: 'same', t: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { parts.push({ kind: 'del', t: a[i] }); i++; }
    else { parts.push({ kind: 'add', t: b[j] }); j++; }
  }
  while (i < m) { parts.push({ kind: 'del', t: a[i++] }); }
  while (j < n) { parts.push({ kind: 'add', t: b[j++] }); }
  return (
    <div className="text-[12px] font-body leading-relaxed break-words whitespace-pre-wrap">
      {parts.map((p, idx) =>
        p.kind === 'same' ? <span key={idx}>{p.t}</span>
        : p.kind === 'add' ? <span key={idx} className="bg-emerald-400/15 text-emerald-300 rounded-[2px] px-[1px]">{p.t}</span>
        : <span key={idx} className="bg-rose-500/15 text-rose-300 line-through rounded-[2px] px-[1px]">{p.t}</span>
      )}
    </div>
  );
};

const SideBySide = ({ from, to }) => (
  <div className="grid grid-cols-2 gap-3 mt-2">
    <div className="border border-rose-500/20 bg-rose-500/5 p-3 rounded-[var(--bp-radius-sm)]">
      <p className="text-[9px] font-body uppercase tracking-[0.22em] text-rose-300/80 mb-1.5">Live</p>
      <pre className="text-[11px] font-mono text-[var(--bp-text-secondary)] whitespace-pre-wrap break-words">{fmtVal(from)}</pre>
    </div>
    <div className="border border-emerald-400/20 bg-emerald-400/5 p-3 rounded-[var(--bp-radius-sm)]">
      <p className="text-[9px] font-body uppercase tracking-[0.22em] text-emerald-300/80 mb-1.5">Draft</p>
      <pre className="text-[11px] font-mono text-[var(--bp-text-secondary)] whitespace-pre-wrap break-words">{fmtVal(to)}</pre>
    </div>
  </div>
);

// ── Field row ──────────────────────────────────────────────────────
const FieldRow = ({ field, change, viewMode, aiContext, locale }) => {
  // `change` shape: {from, to} or just a value (for added/removed)
  const from = change?.from;
  const to   = change?.to;
  const isText = typeof from === 'string' || typeof to === 'string';
  // AI is offered only for textual field changes with a non-empty draft value
  // and only on fields that are editorial-friendly (skip ids, slugs, urls).
  const aiSkipFields = new Set([
    'id', 'slug', 'image_url', 'url', 'href', 'image', 'icon', 'asset_id',
    'created_at', 'updated_at', 'version',
  ]);
  const isEditorial = isText && typeof to === 'string' && to.trim().length >= 3
    && !aiSkipFields.has(field) && !field.endsWith('_url') && !field.endsWith('_id');
  return (
    <div className="py-2.5 border-b border-[var(--bp-border)]/40 last:border-b-0">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] font-body uppercase tracking-[0.18em] text-[var(--bp-text-muted)] flex-1">{field}</span>
        {isEditorial && (
          <AISuggestionPanel
            text={to}
            originalText={typeof from === 'string' ? from : null}
            context={{ ...(aiContext || {}), locale: locale || aiContext?.locale }}
            onAccept={(t) => {
              try {
                navigator.clipboard?.writeText(t);
                toast.success('Suggestion copied to clipboard');
              } catch {
                toast.success('Suggestion ready — copy it manually');
              }
            }}
            testIdPrefix={`ai-${field}`}
          />
        )}
      </div>
      {viewMode === 'inline' && isText
        ? <InlineTextDiff from={from} to={to} />
        : <SideBySide from={from} to={to} />}
    </div>
  );
};

const SimpleField = ({ field, value, tone = 'add' }) => (
  <div className="py-2 border-b border-[var(--bp-border)]/40 last:border-b-0">
    <div className="flex items-center gap-2 mb-1">
      {tone === 'add' ? <Plus size={10} className="text-emerald-300" /> : <Minus size={10} className="text-rose-300" />}
      <span className="text-[10px] font-body uppercase tracking-[0.18em] text-[var(--bp-text-muted)]">{field}</span>
    </div>
    <pre className={`text-[11px] font-mono whitespace-pre-wrap break-words ${tone === 'add' ? 'text-emerald-300' : 'text-rose-300 line-through'}`}>
      {fmtVal(value)}
    </pre>
  </div>
);

// ── Section block ─────────────────────────────────────────────────
const SectionBlock = ({ section, kind, viewMode, aiContext }) => {
  // kind: 'added' | 'removed' | 'modified'
  const tone = kind === 'added' ? 'border-emerald-400/30 bg-emerald-400/[0.04]'
             : kind === 'removed' ? 'border-rose-500/30 bg-rose-500/[0.04]'
             : 'border-amber-300/25 bg-amber-300/[0.03]';
  const label = kind === 'added' ? 'NEW SECTION' : kind === 'removed' ? 'REMOVED' : 'MODIFIED';
  const labelTone = kind === 'added' ? 'text-emerald-300'
                   : kind === 'removed' ? 'text-rose-300'
                   : 'text-amber-300';
  return (
    <div className={`mb-3 border ${tone} rounded-[var(--bp-radius-md)]`}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--bp-border)]/40">
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-body uppercase tracking-[0.22em] font-semibold ${labelTone}`}>{label}</span>
          <span className="text-[10px] font-body uppercase tracking-[0.18em] text-[var(--bp-text-primary)]">
            {section.section_type}
          </span>
        </div>
        {section.sort_order != null && (
          <span className="text-[10px] font-mono text-[var(--bp-text-muted)]">#{section.sort_order}</span>
        )}
      </div>
      {kind === 'modified' && section.changes && (
        <div className="p-4">
          {/* Visibility / type changes */}
          {section.changes.visibility && (
            <div className="mb-2 text-[10px] font-body text-[var(--bp-text-muted)]">
              Visibility: <span className="text-rose-300 line-through">{String(section.changes.visibility.from)}</span>
              {' '}<ArrowRight size={10} className="inline" />{' '}
              <span className="text-emerald-300">{String(section.changes.visibility.to)}</span>
            </div>
          )}
          {section.changes.section_type && (
            <div className="mb-2 text-[10px] font-body text-[var(--bp-text-muted)]">
              Type: <span className="text-rose-300 line-through">{section.changes.section_type.from}</span>
              {' '}<ArrowRight size={10} className="inline" />{' '}
              <span className="text-emerald-300">{section.changes.section_type.to}</span>
            </div>
          )}
          {/* Locale-keyed field changes */}
          {section.changes.locale_content && Object.entries(section.changes.locale_content).map(([locale, ld]) => {
            const sectionAiCtx = {
              ...(aiContext || {}),
              section_type: section.section_type,
              locale,
            };
            return (
              <div key={locale} className="mb-3">
                <p className="text-[9px] font-body uppercase tracking-[0.22em] text-[var(--bp-primary)] mb-1.5">{locale}</p>
                {Object.entries(ld.changed || {}).map(([f, c]) => (
                  <FieldRow key={`c-${f}`} field={f} change={c} viewMode={viewMode} aiContext={sectionAiCtx} locale={locale} />
                ))}
                {Object.entries(ld.added || {}).map(([f, v]) => (
                  <SimpleField key={`a-${f}`} field={f} value={v} tone="add" />
                ))}
                {Object.entries(ld.removed || {}).map(([f, v]) => (
                  <SimpleField key={`r-${f}`} field={f} value={v} tone="del" />
                ))}
              </div>
            );
          })}
          {/* settings diff */}
          {section.changes.settings && (
            <div className="mt-2 pt-2 border-t border-[var(--bp-border)]/40">
              <p className="text-[9px] font-body uppercase tracking-[0.22em] text-[var(--bp-text-muted)] mb-1.5">settings</p>
              {Object.entries(section.changes.settings.changed || {}).map(([f, c]) => (
                <FieldRow key={`s-${f}`} field={f} change={c} viewMode={viewMode} aiContext={aiContext} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main Drawer ───────────────────────────────────────────────────
const PublishDiffDrawer = ({ open, pageKey, onClose, onPublished, onReverted }) => {
  const [tab, setTab] = useState('changes');         // changes | revisions
  const [viewMode, setViewMode] = useState('inline');// inline | side-by-side
  const [diff, setDiff] = useState(null);
  const [revisions, setRevisions] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [label, setLabel] = useState('');
  const [reverting, setReverting] = useState(null);

  const load = useCallback(async () => {
    if (!pageKey || !open) return;
    try {
      const [d, r] = await Promise.all([
        storefrontApi.pageDiff(pageKey, 'published'),
        storefrontApi.listRevisions(pageKey, 30),
      ]);
      setDiff(d);
      setRevisions(r);
    } catch (e) {
      toast.error('Could not load diff');
    }
  }, [pageKey, open]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const summary = diff?.summary || {};
  const hasChanges = !!summary.has_changes;
  const totalBadge = useMemo(() => {
    if (!summary) return 0;
    return (summary.sections_added || 0) + (summary.sections_removed || 0) +
           (summary.sections_modified || 0) + (summary.sections_reordered || 0);
  }, [summary]);

  const handlePublish = async () => {
    if (!pageKey) return;
    setPublishing(true);
    try {
      await storefrontApi.publishPage(pageKey, label.trim() || null);
      toast.success(`"${pageKey}" published as live`);
      setLabel('');
      onPublished?.();
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Publish failed');
    } finally { setPublishing(false); }
  };

  const handleRevert = async (revId) => {
    if (!pageKey) return;
    if (!window.confirm('Revert the live draft to this revision? Your unsaved changes will be replaced.')) return;
    setReverting(revId);
    try {
      await storefrontApi.revertPage(pageKey, revId);
      toast.success('Reverted — review and republish to make it live');
      onReverted?.();
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Revert failed');
    } finally { setReverting(null); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex" data-testid="publish-diff-drawer">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="w-[640px] bg-[var(--bp-surface-1)] border-l border-[var(--bp-border)] flex flex-col">
        {/* Header */}
        <header className="flex items-start justify-between p-6 border-b border-[var(--bp-border)]">
          <div>
            <p className="text-[var(--bp-primary)] text-[10px] font-body uppercase tracking-[0.22em] font-semibold mb-1">
              Publishing Studio
            </p>
            <h2 className="font-heading text-2xl text-[var(--bp-text-primary)] capitalize">
              {pageKey?.replace('_', ' ')}
            </h2>
            <p className="text-[var(--bp-text-muted)] text-[12px] font-body mt-1">
              {hasChanges
                ? <>You have <span className="text-[var(--bp-primary)]">{summary.field_changes || 0} changes</span> across {totalBadge} section{totalBadge === 1 ? '' : 's'}.</>
                : 'Live storefront matches the current draft.'}
            </p>
          </div>
          <button onClick={onClose} data-testid="diff-drawer-close"
                  className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]">
            <X size={18} strokeWidth={1.5} />
          </button>
        </header>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-[var(--bp-border)]">
          <TabButton active={tab === 'changes'} onClick={() => setTab('changes')} icon={Eye} testid="diff-tab-changes">
            Changes {hasChanges && <span className="ml-1.5 text-[var(--bp-primary)] tabular-nums">·{totalBadge}</span>}
          </TabButton>
          <TabButton active={tab === 'revisions'} onClick={() => setTab('revisions')} icon={History} testid="diff-tab-revisions">
            Revisions <span className="ml-1.5 text-[var(--bp-text-muted)] tabular-nums">·{revisions?.revisions?.length || 0}</span>
          </TabButton>
          {tab === 'changes' && hasChanges && (
            <div className="ml-auto pb-2 flex items-center gap-1">
              {['inline', 'side'].map((m) => (
                <button key={m}
                  onClick={() => setViewMode(m)}
                  data-testid={`diff-view-${m}`}
                  className={`px-2.5 py-1 text-[9px] font-body uppercase tracking-[0.2em] rounded-[var(--bp-radius-xs)] transition-colors
                    ${viewMode === m ? 'bg-[var(--bp-surface-2)] text-[var(--bp-text-primary)]' : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]'}`}>
                  {m === 'inline' ? 'Inline' : 'Side-by-side'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'changes' && (
            !diff ? <Loading />
            : !hasChanges ? <NoChangesState />
            : <ChangesView diff={diff} viewMode={viewMode} />
          )}
          {tab === 'revisions' && (
            !revisions ? <Loading />
            : <RevisionsView revisions={revisions} onRevert={handleRevert} reverting={reverting} />
          )}
        </div>

        {/* Footer: publish */}
        {tab === 'changes' && (
          <footer className="border-t border-[var(--bp-border)] p-4 flex items-center justify-between gap-3 bg-[var(--bp-surface-1)]/80">
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Optional label (e.g. v1.2 hero copy)"
              data-testid="diff-publish-label"
              className="flex-1 px-3 py-2 bg-transparent border border-[var(--bp-border)] rounded-[var(--bp-radius-xs)] text-[var(--bp-text-primary)] text-[12px] font-body outline-none focus:border-[var(--bp-primary)] transition-colors placeholder:text-[var(--bp-text-subtle)]" />
            <button
              onClick={handlePublish}
              disabled={publishing || !hasChanges}
              data-testid="diff-publish-now-btn"
              className={`flex items-center gap-2 px-4 py-2 rounded-[var(--bp-radius-xs)] text-[10px] font-body uppercase tracking-[0.22em] transition-all
                ${hasChanges
                  ? 'bg-[var(--bp-primary)] text-black hover:brightness-110'
                  : 'bg-[var(--bp-surface-2)] border border-[var(--bp-border)] text-[var(--bp-text-muted)] cursor-not-allowed'}`}>
              {publishing ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} strokeWidth={1.8} />}
              {hasChanges ? 'Publish now' : 'No changes'}
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
};

const TabButton = ({ active, onClick, icon: Icon, children, testid }) => (
  <button onClick={onClick} data-testid={testid}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-body uppercase tracking-[0.22em] transition-colors border-b-2
            ${active
              ? 'border-[var(--bp-primary)] text-[var(--bp-text-primary)]'
              : 'border-transparent text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]'}`}>
    <Icon size={11} strokeWidth={1.5} /> {children}
  </button>
);

const Loading = () => (
  <div className="py-16 flex items-center justify-center text-[var(--bp-text-muted)]">
    <Loader2 size={16} className="animate-spin mr-2" />
    <span className="text-[11px] font-body uppercase tracking-[0.2em]">Computing diff…</span>
  </div>
);

const NoChangesState = () => (
  <div className="py-16 text-center" data-testid="diff-no-changes">
    <GitCommit size={32} strokeWidth={1} className="text-[var(--bp-text-subtle)] mx-auto mb-4" />
    <p className="text-[var(--bp-text-primary)] font-heading text-lg mb-1">Nothing to publish</p>
    <p className="text-[var(--bp-text-muted)] text-[12px] font-body max-w-xs mx-auto">
      The live storefront already reflects every change in your draft.
    </p>
  </div>
);

// ── Changes view ──────────────────────────────────────────────────
const ChangesView = ({ diff, viewMode, aiContext }) => {
  const sectionsAdded = diff?.sections?.added || [];
  const sectionsRemoved = diff?.sections?.removed || [];
  const sectionsModified = diff?.sections?.modified || [];
  const sectionsReordered = diff?.sections?.reordered || [];
  const pageDiff = diff?.page || {};
  const pageChangedKeys = Object.keys(pageDiff.changed || {});
  return (
    <>
      {(pageChangedKeys.length > 0 || Object.keys(pageDiff.added || {}).length > 0 || Object.keys(pageDiff.removed || {}).length > 0) && (
        <div className="mb-5">
          <p className="text-[10px] font-body uppercase tracking-[0.22em] text-[var(--bp-text-muted)] mb-2.5">Page meta</p>
          <div className="border border-[var(--bp-border)] rounded-[var(--bp-radius-md)] p-4 bg-[var(--bp-surface-2)]/30">
            {pageChangedKeys.map((k) => (
              <FieldRow key={k} field={k} change={pageDiff.changed[k]} viewMode={viewMode}
                aiContext={{ ...(aiContext || {}), section_type: 'page_meta' }} />
            ))}
            {Object.entries(pageDiff.added || {}).map(([k, v]) => (
              <SimpleField key={`a-${k}`} field={k} value={v} tone="add" />
            ))}
            {Object.entries(pageDiff.removed || {}).map(([k, v]) => (
              <SimpleField key={`r-${k}`} field={k} value={v} tone="del" />
            ))}
          </div>
        </div>
      )}

      {sectionsReordered.length > 0 && (
        <div className="mb-4 p-3 bg-amber-300/[0.04] border border-amber-300/20 rounded-[var(--bp-radius-md)] text-[11px] font-body text-amber-200/90">
          <span className="font-semibold">{sectionsReordered.length}</span> section{sectionsReordered.length === 1 ? '' : 's'} reordered
        </div>
      )}

      {sectionsAdded.map((s) => <SectionBlock key={`a-${s.id}`} section={s} kind="added" viewMode={viewMode} aiContext={aiContext} />)}
      {sectionsModified.map((s) => <SectionBlock key={`m-${s.id}`} section={s} kind="modified" viewMode={viewMode} aiContext={aiContext} />)}
      {sectionsRemoved.map((s) => <SectionBlock key={`r-${s.id}`} section={s} kind="removed" viewMode={viewMode} aiContext={aiContext} />)}
    </>
  );
};

// ── Revisions view ───────────────────────────────────────────────
const RevisionsView = ({ revisions, onRevert, reverting }) => {
  const list = revisions?.revisions || [];
  if (list.length === 0) {
    return (
      <div className="py-16 text-center" data-testid="revisions-empty">
        <History size={32} strokeWidth={1} className="text-[var(--bp-text-subtle)] mx-auto mb-4" />
        <p className="text-[var(--bp-text-primary)] font-heading text-lg mb-1">No revisions yet</p>
        <p className="text-[var(--bp-text-muted)] text-[12px] font-body max-w-xs mx-auto">
          Publish your draft for the first time to create the initial revision snapshot.
        </p>
      </div>
    );
  }
  return (
    <ol className="space-y-3">
      {list.map((rev, idx) => {
        const isCurrent = rev.id === revisions.published_revision_id;
        const sum = rev.change_summary || {};
        return (
          <li key={rev.id} data-testid={`revision-row-${rev.id}`}
              className={`relative border rounded-[var(--bp-radius-md)] p-4 ${isCurrent ? 'border-[var(--bp-primary)]/40 bg-[var(--bp-primary)]/5' : 'border-[var(--bp-border)] bg-[var(--bp-surface-2)]/30'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[var(--bp-text-primary)] font-body text-[12px]">
                    {rev.label || `Revision #${list.length - idx}`}
                  </span>
                  {isCurrent && (
                    <span className="px-1.5 py-0.5 rounded-full text-[8px] font-body uppercase tracking-[0.22em] bg-[var(--bp-primary)] text-black">
                      Live
                    </span>
                  )}
                </div>
                <p className="text-[10px] font-body text-[var(--bp-text-muted)]">{fmtDate(rev.created_at)} · {rev.kind}</p>
                {sum.has_changes && (
                  <p className="text-[10px] font-body text-[var(--bp-text-muted)] mt-1.5">
                    {sum.field_changes || 0} field changes · {sum.sections_modified || 0} modified · {sum.sections_added || 0} added · {sum.sections_removed || 0} removed
                  </p>
                )}
              </div>
              {!isCurrent && (
                <button onClick={() => onRevert(rev.id)}
                        disabled={reverting === rev.id}
                        data-testid={`revision-revert-${rev.id}`}
                        title="Revert to this revision"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--bp-radius-xs)] border border-[var(--bp-border)] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] hover:border-[var(--bp-border-strong)] text-[9px] font-body uppercase tracking-[0.22em] transition-all disabled:opacity-50">
                  {reverting === rev.id ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} strokeWidth={1.8} />}
                  Revert
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export default PublishDiffDrawer;
