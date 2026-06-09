/**
 * ClientConceptReviewPage · STORE-012C · CLIENT PORTAL CONCEPT REVIEW™
 *
 * Where the client reviews the design directions shared by the studio and
 * gives structured feedback. No external mini-flows — single source of
 * truth is the Design Journey.
 *
 * Reactions vocabulary (professional, never casual):
 *   · Interesting          (interested)
 *   · Explore Further      (explore_further)
 *   · Preferred Direction  (preferred · one per set, switching is allowed)
 *   · Comment              (free text)
 *
 * The Client Alignment Score™ is computed server-side and NEVER displayed
 * to the client.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Heart, Compass, Star, MessageSquare, Loader2, Check, X, ArrowLeft,
} from 'lucide-react';
import api from '../../lib/api';
import './client-concept-review.css';

const ACTIONS = [
  { key: 'interested',      label: 'Interesting',         icon: Heart },
  { key: 'explore_further', label: 'Explore Further',     icon: Compass },
  { key: 'preferred',       label: 'Preferred Direction', icon: Star },
  { key: 'comment',         label: 'Comment',             icon: MessageSquare },
];

const ClientConceptReviewPage = () => {
  const { jid } = useParams();
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(null);            // {mbId, action}
  const [commentTarget, setCommentTarget] = useState(null); // direction obj
  const [commentText, setCommentText] = useState('');
  const [toast, setToast] = useState(null);

  const reload = async () => {
    try {
      const r = await api.get(`/api/client/journeys/${jid}/concept-directions`);
      setSets(r.data.sets || []);
    } catch {/* keep prior state */}
  };

  useEffect(() => {
    let cancel = false;
    api.get(`/api/client/journeys/${jid}/concept-directions`)
      .then(r => { if (!cancel) setSets(r.data.sets || []); })
      .catch(() => {})
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [jid]);

  const submitReaction = async (moodboardId, reaction, comment) => {
    setPending({ moodboardId, reaction });
    try {
      const payload = { reaction };
      if (comment) payload.comment = comment;
      const r = await api.post(`/api/client/concept-directions/${moodboardId}/feedback`, payload);
      setToast({ narrative: r.data.narrative });
      setTimeout(() => setToast(null), 3200);
      await reload();
    } catch (e) {
      console.error('feedback failed', e?.response?.data || e);
      setToast({ narrative: 'Could not save your feedback. Please retry.', error: true });
      setTimeout(() => setToast(null), 3200);
    } finally {
      setPending(null);
    }
  };

  const onAction = (direction, actionKey) => {
    if (actionKey === 'comment') {
      setCommentTarget(direction);
      setCommentText('');
      return;
    }
    submitReaction(direction.moodboard_id, actionKey);
  };

  const submitComment = () => {
    if (!commentText.trim() || !commentTarget) return;
    submitReaction(commentTarget.moodboard_id, 'comment', commentText.trim());
    setCommentTarget(null);
    setCommentText('');
  };

  const totals = useMemo(() => {
    return sets.reduce((acc, s) => acc + (s.directions?.length || 0), 0);
  }, [sets]);

  if (loading) {
    return (
      <div className="ccr-shell" data-testid="ccr-loading">
        <div className="ccr-loading"><Loader2 size={20} className="ccr-spin" /> Loading your design directions…</div>
      </div>
    );
  }

  if (!sets.length) {
    return (
      <div className="ccr-shell" data-testid="ccr-empty">
        <div className="ccr-empty">
          <p className="ccr-empty__eyebrow">Concept Review</p>
          <h2 className="ccr-empty__title">No directions shared yet.</h2>
          <p className="ccr-empty__hint">
            When your studio shares design directions with you, they will appear here for your review.
          </p>
          <Link to={`/client`} className="ccr-btn ccr-btn--ghost">
            <ArrowLeft size={14} /> Back to my journey
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="ccr-shell" data-testid="ccr-shell">
      <header className="ccr-top">
        <Link to={`/client`} className="ccr-top__back" data-testid="ccr-back">
          <ArrowLeft size={14} /> My journey
        </Link>
        <div className="ccr-top__title">
          <p className="ccr-top__eyebrow">Concept Review</p>
          <h1 className="ccr-top__heading">Design Directions for you</h1>
          <p className="ccr-top__hint">Your studio shared {totals} concept{totals === 1 ? '' : 's'} for your reaction. Choose one as your preferred direction, or share your thoughts.</p>
        </div>
      </header>

      <main className="ccr-body">
        {sets.map((s) => (
          <section key={s.set_id} className="ccr-set" data-testid={`ccr-set-${s.set_index}`}>
            <header className="ccr-set__hdr">
              <p className="ccr-set__eyebrow">{s.set_label}</p>
              <p className="ccr-set__date">
                Shared {s.set_shared_at ? new Date(s.set_shared_at).toLocaleDateString() : ''}
              </p>
            </header>

            <div className="ccr-set__grid">
              {s.directions.map((d) => (
                <article
                  key={d.moodboard_id}
                  className={`ccr-card ${d.is_preferred ? 'is-preferred' : ''}`}
                  data-testid={`ccr-card-${d.moodboard_id}`}
                >
                  {d.is_preferred && (
                    <span className="ccr-card__preferred-flag" title="Your preferred direction">
                      <Star size={12} strokeWidth={2.5} /> Preferred direction
                    </span>
                  )}
                  <header className="ccr-card__hdr">
                    <span className="ccr-card__letter">{d.direction_letter}</span>
                    <h3 className="ccr-card__name">{d.direction_name}</h3>
                  </header>

                  {d.cover_url ? (
                    <div className="ccr-card__cover">
                      <img src={d.cover_url} alt="" loading="lazy" />
                    </div>
                  ) : (
                    <div className="ccr-card__cover ccr-card__cover--placeholder" />
                  )}

                  {d.color_palette?.length > 0 && (
                    <div className="ccr-card__palette">
                      {d.color_palette.map((hex, i) => (
                        <span key={i} className="ccr-card__swatch" style={{ background: hex }} title={hex} />
                      ))}
                    </div>
                  )}

                  {d.style_dna_snapshot?.length > 0 && (
                    <ul className="ccr-card__styles">
                      {d.style_dna_snapshot.slice(0, 3).map((sd) => (
                        <li key={sd.key}>
                          <span>{sd.label}</span>
                          <span className="ccr-card__styles-score">{sd.score}%</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {d.designer_notes && (
                    <p className="ccr-card__notes">“{d.designer_notes}”</p>
                  )}

                  {d.my_reactions?.length > 0 && (
                    <div className="ccr-card__history" data-testid={`ccr-history-${d.moodboard_id}`}>
                      {d.my_reactions.slice(-3).map((rx, i) => (
                        <span key={i} className="ccr-card__history-pill">
                          {rx.reaction.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="ccr-card__actions" role="group" aria-label="reactions">
                    {ACTIONS.map((a) => {
                      const Icon = a.icon;
                      const isPending = pending?.moodboardId === d.moodboard_id && pending?.reaction === a.key;
                      const isPreferredBtn = a.key === 'preferred' && d.is_preferred;
                      return (
                        <button
                          key={a.key}
                          type="button"
                          onClick={() => onAction(d, a.key)}
                          disabled={!!pending}
                          className={`ccr-action ccr-action--${a.key} ${isPreferredBtn ? 'is-on' : ''}`}
                          data-testid={`ccr-action-${a.key}-${d.moodboard_id}`}
                          title={a.label}
                        >
                          {isPending ? <Loader2 size={14} className="ccr-spin" /> : <Icon size={14} strokeWidth={1.8} />}
                          <span>{a.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </main>

      {/* Comment modal */}
      {commentTarget && (
        <div className="ccr-modal" data-testid="ccr-comment-modal" role="dialog" aria-modal="true">
          <div className="ccr-modal__panel">
            <button type="button" className="ccr-modal__close" onClick={() => setCommentTarget(null)} aria-label="close" data-testid="ccr-comment-close">
              <X size={16} />
            </button>
            <p className="ccr-modal__eyebrow">Leave a comment</p>
            <h3 className="ccr-modal__title">{commentTarget.direction_name}</h3>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="What do you like, what would you change, what should we explore?"
              rows={5}
              className="ccr-modal__textarea"
              data-testid="ccr-comment-text"
              autoFocus
            />
            <footer className="ccr-modal__footer">
              <button type="button" className="ccr-btn ccr-btn--ghost" onClick={() => setCommentTarget(null)} data-testid="ccr-comment-cancel">
                Cancel
              </button>
              <button
                type="button"
                className="ccr-btn ccr-btn--primary"
                onClick={submitComment}
                disabled={!commentText.trim() || !!pending}
                data-testid="ccr-comment-submit"
              >
                {pending ? <><Loader2 size={14} className="ccr-spin" /> Sending…</> : 'Send comment'}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`ccr-toast ${toast.error ? 'ccr-toast--error' : ''}`} data-testid="ccr-toast">
          {toast.error ? <X size={14} /> : <Check size={14} strokeWidth={3} />}
          <span>{toast.narrative}</span>
        </div>
      )}
    </div>
  );
};

export default ClientConceptReviewPage;
