/**
 * ContinuationInterviewDrawer · Sprint C · Continuation Interview™.
 *
 * Steps through the closed-question catalog one group at a time.
 * Records each chosen option as an answer-event (append-only audit log).
 *
 * Catalog source : GET  /api/relationships/intake/groups?lead_type=…
 * Answer sink    : POST /api/relationships/intake/answer-event
 *   → body: { question_key, option_value, lead_id, session_id, source_surface: 'continuation_interview' }
 */
import React, { useEffect, useMemo, useState } from 'react';
import { X, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import api from '../../lib/api';

const sessionId = () => {
  let s = window.sessionStorage.getItem('cr_interview_session');
  if (!s) {
    s = (window.crypto?.randomUUID?.() || `cr-${Date.now()}-${Math.random()}`);
    window.sessionStorage.setItem('cr_interview_session', s);
  }
  return s;
};

const ContinuationInterviewDrawer = ({ open, lead, tenantSlug, onClose, onCompleted }) => {
  const [groups, setGroups]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep]       = useState(0);
  const [answered, setAnswered] = useState({}); // question_key → option_value
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);

  // Reset state when (re)opening.
  useEffect(() => {
    if (!open) return;
    setStep(0); setAnswered({}); setError(null);
    setLoading(true);
    const leadType = lead?.lead_type || 'private_client';
    api.get(`/api/relationships/intake/groups?lead_type=${encodeURIComponent(leadType)}`)
      .then((r) => setGroups(Array.isArray(r.data) ? r.data : (r.data?.groups || [])))
      .catch((e) => setError(e?.response?.data?.detail || 'Unable to load catalog'))
      .finally(() => setLoading(false));
  }, [open, lead]);

  // Flat list of (group, question) pairs in order.
  const questions = useMemo(() => {
    const out = [];
    (groups || []).forEach((g) => {
      (g.questions || []).forEach((q) => {
        out.push({ group: g, question: q });
      });
    });
    return out;
  }, [groups]);

  const total = questions.length;
  const current = questions[step] || null;

  if (!open) return null;

  const submitAnswer = async (option) => {
    if (!current || saving) return;
    setSaving(true); setError(null);
    try {
      await api.post(`/api/relationships/intake/answer-event?tenant_slug=${encodeURIComponent(tenantSlug || 'mood-demo-studio-81a09e')}`, {
        question_key:  current.question.question_key,
        option_value:  option.value,
        lead_id:       lead?.id,
        session_id:    sessionId(),
        source_surface:'continuation_interview',
      });
      setAnswered((prev) => ({ ...prev, [current.question.question_key]: option.value }));
      if (step + 1 < total) {
        setStep(step + 1);
      } else if (onCompleted) {
        onCompleted({ answered_count: Object.keys(answered).length + 1 });
      }
    } catch (e) {
      setError(e?.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ci-drawer" data-testid="ci-drawer" role="dialog" aria-modal="true">
      <div className="ci-drawer__scrim" onClick={onClose} aria-hidden="true" />
      <aside className="ci-drawer__panel">
        <header className="ci-drawer__top">
          <span className="ci-drawer__eyebrow">Continuation Interview™</span>
          <button type="button" className="ci-drawer__close" onClick={onClose} aria-label="Close" data-testid="ci-drawer-close">
            <X size={18} strokeWidth={1.5} />
          </button>
        </header>

        {loading && <div className="ci-drawer__loading">Listening to your studio dictionary…</div>}
        {error && <div className="ci-drawer__error" data-testid="ci-drawer-error">{error}</div>}

        {!loading && !error && total === 0 && (
          <div className="ci-drawer__empty" data-testid="ci-drawer-empty">
            <p>No further questions in the catalog for this register.</p>
          </div>
        )}

        {!loading && current && total > 0 && (
          <div className="ci-drawer__body" data-testid="ci-drawer-body">
            <div className="ci-drawer__progress" data-testid="ci-drawer-progress">
              <span className="ci-drawer__progress-step">{step + 1} of {total}</span>
              <span className="ci-drawer__progress-track">
                <span className="ci-drawer__progress-fill" style={{ width: `${((step + 1) / total) * 100}%` }} />
              </span>
              <span className="ci-drawer__progress-group">{current.group.label || current.group.key}</span>
            </div>

            <h3 className="ci-drawer__question" data-testid="ci-drawer-question">
              {current.question.label || current.question.question_key}
            </h3>
            {current.question.sub && (
              <p className="ci-drawer__question-sub">{current.question.sub}</p>
            )}

            <ul className="ci-drawer__options" data-testid="ci-drawer-options">
              {(current.question.options || []).map((opt, i) => {
                const picked = answered[current.question.question_key] === opt.value;
                return (
                  <li key={i}>
                    <button
                      type="button"
                      className={`ci-drawer__option ${picked ? 'is-picked' : ''}`}
                      onClick={() => submitAnswer(opt)}
                      disabled={saving}
                      data-testid={`ci-drawer-option-${opt.value}`}
                    >
                      <span className="ci-drawer__option-label">{opt.label || opt.value}</span>
                      {picked
                        ? <Check size={16} strokeWidth={2} />
                        : <ArrowRight size={16} strokeWidth={1.6} />}
                    </button>
                  </li>
                );
              })}
            </ul>

            <footer className="ci-drawer__nav">
              <button
                type="button"
                className="ci-drawer__back"
                onClick={() => setStep(Math.max(0, step - 1))}
                disabled={step === 0}
                data-testid="ci-drawer-back"
              >
                <ArrowLeft size={15} /> back
              </button>
              <button
                type="button"
                className="ci-drawer__skip"
                onClick={() => step + 1 < total ? setStep(step + 1) : onClose()}
                data-testid="ci-drawer-skip"
              >
                {step + 1 < total ? 'skip this' : 'close'} <ArrowRight size={15} />
              </button>
            </footer>
          </div>
        )}
      </aside>
    </div>
  );
};

export default ContinuationInterviewDrawer;
