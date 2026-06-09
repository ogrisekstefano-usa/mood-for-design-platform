/**
 * ConceptPulseCard · STORE-012D · CONCEPT PULSE™
 *
 * Operational signal card surfacing the latest client feedback as
 * actionable design intelligence. Lives inside JourneyOperatingPage
 * (INSPIRE / CURATE phases).
 *
 * Rules:
 * · Never display the raw Client Alignment Score™ number — only the
 *   human-readable band (High / Medium / Low alignment).
 * · Never auto-approve, never change moodboard statuses.
 * · "Mood, design assistant" tone — short, decisive, never reporting.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles, Star, ArrowRight, Compass, Layers, MessageSquare, Heart,
  ChevronRight, RefreshCw, Loader2,
} from 'lucide-react';
import api from '../../lib/api';
import './concept-pulse.css';

const BAND_CLASS = { high: 'cp-band--high', medium: 'cp-band--medium', low: 'cp-band--low' };
const REACTION_ICON = {
  interested:      Heart,
  explore_further: Compass,
  preferred:       Star,
  comment:         MessageSquare,
};
const REACTION_LABEL = {
  interested: 'Interesting',
  explore_further: 'Explore Further',
  preferred: 'Preferred',
  comment: 'Comments',
};

const ConceptPulseCard = ({ journeyId }) => {
  const [pulse, setPulse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const reload = async () => {
    try {
      const r = await api.get(`/api/journeys/${journeyId}/concept-pulse`);
      setPulse(r.data);
    } catch (e) {
      console.error('concept-pulse load failed', e?.response?.data || e);
    }
  };

  useEffect(() => {
    let cancel = false;
    api.get(`/api/journeys/${journeyId}/concept-pulse`)
      .then((r) => { if (!cancel) setPulse(r.data); })
      .catch(() => {})
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [journeyId]);

  if (loading) {
    return (
      <section className="cp-card" data-testid="concept-pulse-loading">
        <div className="cp-loading"><Loader2 size={14} className="cp-spin" /> Reading client signals…</div>
      </section>
    );
  }
  if (!pulse) return null;

  const onQuickAction = async (qa) => {
    if (qa.kind === 'api' && qa.key === 'generate_alternatives') {
      setGenerating(true);
      try {
        await api.post(qa.href, {});
        await reload();
      } finally {
        setGenerating(false);
      }
    }
  };

  return (
    <section className="cp-card" data-testid="concept-pulse">
      <header className="cp-card__hdr">
        <Sparkles size={14} />
        <span className="cp-card__brand">Concept Pulse™</span>
        {pulse.set && (
          <span className="cp-card__set" data-testid="cp-set-label">{pulse.set.set_label}</span>
        )}
      </header>

      {/* Suggested next action (always present) */}
      <div className="cp-action" data-testid="cp-suggested-action">
        <p className="cp-action__eyebrow">Suggested next move</p>
        <p className="cp-action__headline">{pulse.suggested_next_action.headline}</p>
        <p className="cp-action__hint">{pulse.suggested_next_action.hint}</p>
      </div>

      {/* Preferred direction strip */}
      {pulse.preferred_direction ? (
        <div className="cp-preferred" data-testid="cp-preferred">
          <span className="cp-preferred__star"><Star size={12} strokeWidth={2.5} /></span>
          <div className="cp-preferred__body">
            <p className="cp-preferred__eyebrow">Client preferred direction</p>
            <p className="cp-preferred__name">
              <span className="cp-preferred__letter">{pulse.preferred_direction.direction_letter}</span>
              {pulse.preferred_direction.direction_name}
            </p>
          </div>
          <Link
            to={`/studio/moodboards/working/${pulse.preferred_direction.moodboard_id}`}
            className="cp-preferred__cta"
            data-testid="cp-open-preferred"
            onClick={(e) => {
              // If no Working Moodboard exists yet, generate then navigate.
              if (!pulse.preferred_has_working) {
                e.preventDefault();
                api.post(`/api/journeys/${journeyId}/working-moodboards/from-concept/${pulse.preferred_direction.moodboard_id}`, {})
                  .then((r) => {
                    const wid = r.data?.moodboard_id;
                    if (wid) window.location.href = `/studio/moodboards/working/${wid}`;
                  });
              }
            }}
          >
            Open <ArrowRight size={12} />
          </Link>
        </div>
      ) : pulse.has_shared_set ? (
        <p className="cp-empty" data-testid="cp-no-preferred">
          The client has not picked a preferred direction yet.
        </p>
      ) : null}

      {/* Alignment ranking */}
      {pulse.ranking && pulse.ranking.length > 0 && (
        <ul className="cp-rank" data-testid="cp-ranking">
          {pulse.ranking.map((r) => (
            <li key={r.moodboard_id} className={`cp-rank__row ${r.is_preferred ? 'is-preferred' : ''}`}
                data-testid={`cp-rank-${r.moodboard_id}`}>
              <span className="cp-rank__num">#{r.rank}</span>
              <span className="cp-rank__letter">{r.direction_letter}</span>
              <span className="cp-rank__name">{r.direction_name}</span>
              <span className={`cp-band ${BAND_CLASS[r.alignment_band]}`}
                    data-testid={`cp-band-${r.moodboard_id}`}>
                {r.alignment_label}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Feedback summary chips */}
      {pulse.feedback_summary && (
        <div className="cp-fb" data-testid="cp-feedback-summary">
          {Object.entries(pulse.feedback_summary).map(([key, value]) => {
            const Icon = REACTION_ICON[key];
            return (
              <span key={key}
                    className={`cp-fb__chip ${value > 0 ? 'is-on' : ''}`}
                    data-testid={`cp-fb-${key}`}>
                <Icon size={11} strokeWidth={1.8} />
                <span>{REACTION_LABEL[key]}</span>
                <span className="cp-fb__count">{value}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Quick actions */}
      {pulse.quick_actions && pulse.quick_actions.length > 0 && (
        <div className="cp-quick" data-testid="cp-quick-actions">
          {pulse.quick_actions.map((qa) => {
            if (qa.kind === 'navigate') {
              return (
                <Link
                  key={qa.key}
                  to={qa.href}
                  className="cp-quick__btn"
                  data-testid={`cp-qa-${qa.key}`}
                >
                  <span>{qa.label}</span>
                  <ChevronRight size={13} />
                </Link>
              );
            }
            return (
              <button
                key={qa.key}
                type="button"
                onClick={() => onQuickAction(qa)}
                className="cp-quick__btn"
                disabled={generating}
                data-testid={`cp-qa-${qa.key}`}
              >
                {generating && qa.key === 'generate_alternatives' ? (
                  <Loader2 size={13} className="cp-spin" />
                ) : (
                  <RefreshCw size={12} />
                )}
                <span>{qa.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default ConceptPulseCard;
