/**
 * CommentThreadDrawer — opens when a pin is clicked. Single-level replies.
 *
 *   - Root comment + chronological replies
 *   - Reply composer (uses client identity capture if anonymous)
 *   - "Mark resolved" (designer-side action, hidden for clients)
 */
import React, { useState } from 'react';
import { X, Check } from 'lucide-react';

const ROLE_LABEL = {
  designer: 'Designer',
  pm: 'PM',
  project_manager: 'PM',
  super_admin: 'PM',
  client: 'Client',
};

const Bubble = ({ comment }) => (
  <div className="flex items-start gap-3" data-testid={`comment-bubble-${comment.id}`}>
    <div className="flex-shrink-0 mt-0.5">
      <p className="text-[9px] tracking-[0.18em] uppercase text-[var(--bp-text-muted)]">
        {ROLE_LABEL[comment.author_role] || 'Guest'}
      </p>
      <p className="text-[12px] text-[var(--bp-text-primary)] font-medium">
        {comment.author_name || '—'}
      </p>
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[14px] text-[var(--bp-text-primary)] leading-relaxed whitespace-pre-wrap break-words">
        {comment.body}
      </p>
      <p className="text-[10px] text-[var(--bp-text-subtle)] mt-1 tabular-nums">
        {comment.created_at ? new Date(comment.created_at).toLocaleString() : ''}
      </p>
    </div>
  </div>
);

const CommentThreadDrawer = ({ comment, replies, onClose, onReply, onResolve, asClient }) => {
  const [draft, setDraft] = useState('');

  const submit = () => {
    if (!draft.trim()) return;
    onReply(draft.trim());
    setDraft('');
  };

  return (
    <div className="fixed top-0 right-0 bottom-0 z-[65] w-full sm:w-[420px]
                    bg-[var(--bp-surface-1)] border-l border-[var(--bp-border)]
                    shadow-[-30px_0_70px_rgba(0,0,0,0.45)] flex flex-col"
         data-testid="comment-thread-drawer"
         onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--bp-border)]">
        <p className="text-[10px] tracking-[0.28em] uppercase text-[var(--bp-text-muted)]">
          Comment thread
        </p>
        <button onClick={onClose} data-testid="thread-drawer-close"
                className="p-1.5 rounded-[3px] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]
                           hover:bg-[var(--bp-surface-2)]/60 transition-colors">
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        <Bubble comment={comment} />
        {replies.length > 0 && <div className="h-px bg-[var(--bp-border)]" />}
        {replies.map((r) => <Bubble key={r.id} comment={r} />)}
      </div>

      {!comment.resolved ? (
        <div className="px-6 pt-4 pb-5 border-t border-[var(--bp-border)] flex-shrink-0">
          <textarea value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Write a reply…"
                    rows={3}
                    data-testid="thread-reply-input"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
                    }}
                    className="w-full bg-[var(--bp-surface-2)]/50 border border-[var(--bp-border)]
                               rounded-[3px] px-3 py-2.5 text-[13px] text-[var(--bp-text-primary)]
                               placeholder-[var(--bp-text-subtle)] focus:outline-none
                               focus:border-[var(--bp-border-strong)] resize-none" />
          <div className="flex items-center gap-3 mt-3">
            {!asClient && (
              <button type="button" onClick={onResolve}
                      data-testid="thread-resolve-btn"
                      className="flex items-center gap-1.5 text-[10px] tracking-[0.22em] uppercase
                                 text-[var(--bp-text-muted)] hover:text-[var(--bp-primary)] transition-colors">
                <Check size={12} strokeWidth={1.5} />
                Resolve
              </button>
            )}
            <div className="flex-1" />
            <button type="button" onClick={submit} disabled={!draft.trim()}
                    data-testid="thread-reply-submit"
                    className={`px-4 py-2 text-[10px] tracking-[0.18em] uppercase rounded-[2px] transition-all
                      ${draft.trim()
                        ? 'bg-[var(--bp-primary)] text-black hover:brightness-110'
                        : 'bg-[var(--bp-surface-2)] text-[var(--bp-text-muted)] cursor-not-allowed'}`}>
              Reply
            </button>
          </div>
        </div>
      ) : (
        <div className="px-6 py-5 border-t border-[var(--bp-border)] flex-shrink-0">
          <p className="flex items-center gap-2 text-[11px] text-[var(--bp-primary)]"
             data-testid="thread-resolved-indicator">
            <Check size={12} strokeWidth={1.5} /> Resolved
          </p>
        </div>
      )}
    </div>
  );
};

export default CommentThreadDrawer;
