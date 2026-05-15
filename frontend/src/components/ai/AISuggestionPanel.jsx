/**
 * AI Editorial Assistant — client + inline suggestion panel.
 *
 * Phase Q.1: invoked from the Diff Drawer FieldRow's sparkle icon.
 * NOT a chatbot. Single-shot rewrite with accept / reject / regenerate.
 *
 * Visual rules:
 *   - subtle, integrated, calm
 *   - NO glowing AI effects, NO neon, NO animated gradients
 *   - Uses Phase O cinematic palette + Inter
 */
import React, { useState, useCallback } from 'react';
import { Sparkles, Check, X, RotateCcw, Loader2, ChevronDown } from 'lucide-react';
import api from '../../lib/api';
import { toast } from 'sonner';

// Action catalogue is duplicated here to avoid a round-trip just for labels.
// Source of truth = backend ACTIONS dict in /app/backend/routers/ai_editorial.py
export const AI_ACTIONS = [
  { id: 'improve',            label: 'Improve copy',           desc: 'Editorial polish' },
  { id: 'premium',            label: 'More premium',           desc: 'Restrained luxury tone' },
  { id: 'concise',            label: 'More concise',           desc: 'Tighten · same meaning' },
  { id: 'readability',        label: 'Improve readability',    desc: 'Better flow & rhythm' },
  { id: 'storytelling',       label: 'Add storytelling',       desc: 'Subtle editorial cues' },
  { id: 'seo',                label: 'Improve SEO',            desc: 'Surface key phrase' },
  { id: 'audience_us',        label: 'Adapt for US audience',  desc: 'US-English · sophisticated' },
  { id: 'audience_luxury',    label: 'Adapt for luxury',       desc: 'HNW / A&D audience' },
  { id: 'improve_cta',        label: 'Improve CTA',            desc: 'Confident · short · action' },
  { id: 'rewrite_headline',   label: 'Rewrite headline',       desc: 'Single line · ≤80 chars' },
  { id: 'alternative_titles', label: 'Alternative titles',     desc: '3 distinct angles' },
];

export const useEditorialSuggest = () => {
  const call = useCallback(async (payload) => {
    const { data } = await api.post('/api/ai/editorial-suggest', payload);
    return data;
  }, []);
  return { call };
};

/**
 * Compact inline assistant.
 *
 * Props:
 *   text             — current (changed) text the editor wants AI to improve
 *   originalText     — pre-change text (gives the model the delta)
 *   context          — { locale, audience, page_type, section_type, page_title, tenant_name, tone_hint }
 *   onAccept(text)   — called when user accepts the suggestion
 *   defaultAction    — initial action id (default: 'improve')
 *
 * The panel is non-modal: it expands inline below the field row.
 */
export const AISuggestionPanel = ({
  text, originalText, context = {}, onAccept, defaultAction = 'improve', testIdPrefix = 'ai',
}) => {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState(defaultAction);
  const [suggestion, setSuggestion] = useState(null);
  const [reasoning, setReasoning] = useState('');
  const [latency, setLatency] = useState(null);
  const [loading, setLoading] = useState(false);
  const { call } = useEditorialSuggest();

  const run = useCallback(async (nextAction) => {
    const a = nextAction || action;
    if (!text?.trim()) {
      toast.error('No text to improve');
      return;
    }
    setLoading(true);
    try {
      const res = await call({
        action: a, text, original_text: originalText || null, ...context,
      });
      setSuggestion(res.suggested_text);
      setReasoning(res.reasoning);
      setLatency(res.latency_ms);
    } catch (e) {
      const msg = e?.response?.data?.detail || 'Suggestion failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [action, text, originalText, context, call]);

  const accept = () => {
    if (!suggestion) return;
    onAccept?.(suggestion);
    setOpen(false);
    setSuggestion(null);
    toast.success('Suggestion applied');
  };

  const reject = () => {
    setSuggestion(null);
    setReasoning('');
  };

  const onActionChange = (id) => {
    setAction(id);
    if (open) run(id);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setOpen(true); run(); }}
        data-testid={`${testIdPrefix}-trigger`}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[6px]
                   text-[10px] uppercase tracking-[0.16em] font-body
                   text-[var(--bp-text-muted)] hover:text-[var(--bp-primary)]
                   hover:bg-[var(--bp-primary-soft)] border border-transparent
                   hover:border-[var(--bp-border-active)] transition-colors"
        title="Suggest improvements with editorial AI"
      >
        <Sparkles size={11} strokeWidth={1.5} />
        Improve
      </button>
    );
  }

  return (
    <div
      data-testid={`${testIdPrefix}-panel`}
      className="mt-2 rounded-[10px] border border-[var(--bp-border-active)]
                 bg-[var(--bp-surface-2)] overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--bp-border)]/60 bg-[var(--bp-surface-elevated)]">
        <div className="flex items-center gap-2">
          <Sparkles size={11} strokeWidth={1.5} className="text-[var(--bp-primary)]" />
          <p className="text-[10px] uppercase tracking-[0.22em] font-body text-[var(--bp-text-secondary)]">
            Editorial Assistant
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setOpen(false); setSuggestion(null); }}
          data-testid={`${testIdPrefix}-close`}
          className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] transition-colors"
        >
          <X size={12} strokeWidth={1.5} />
        </button>
      </div>

      {/* Action chip row */}
      <div className="px-3 py-2 flex items-center gap-2 flex-wrap border-b border-[var(--bp-border)]/40">
        <select
          value={action}
          onChange={(e) => onActionChange(e.target.value)}
          data-testid={`${testIdPrefix}-action-select`}
          className="bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[5px]
                     px-2 py-1 text-[11px] text-[var(--bp-text-primary)] font-body
                     focus:outline-none focus:border-[var(--bp-border-hover)]"
        >
          {AI_ACTIONS.map((a) => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => run()}
          disabled={loading}
          data-testid={`${testIdPrefix}-regenerate`}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-[5px]
                     text-[10px] uppercase tracking-[0.16em] font-body
                     text-[var(--bp-text-muted)] hover:text-[var(--bp-primary)] transition-colors disabled:opacity-40"
        >
          <RotateCcw size={10} strokeWidth={1.5} />
          Regenerate
        </button>
      </div>

      {/* Suggestion body */}
      <div className="px-3 py-3 min-h-[64px]">
        {loading ? (
          <div className="flex items-center gap-2 text-[11px] text-[var(--bp-text-muted)] font-body">
            <Loader2 size={11} className="animate-spin" />
            <span>Composing editorial suggestion…</span>
          </div>
        ) : suggestion ? (
          <>
            <p
              data-testid={`${testIdPrefix}-suggestion`}
              className="text-[12.5px] text-[var(--bp-text-primary)] font-body whitespace-pre-wrap leading-relaxed"
            >
              {suggestion}
            </p>
            {reasoning && (
              <p className="mt-2 text-[10px] text-[var(--bp-text-muted)] font-body italic leading-relaxed">
                <span className="uppercase tracking-[0.18em] not-italic mr-1.5">Why</span>
                {reasoning}
              </p>
            )}
          </>
        ) : (
          <p className="text-[11px] text-[var(--bp-text-faint)] italic font-body">
            No suggestion yet — choose an action above.
          </p>
        )}
      </div>

      {/* Footer actions */}
      {suggestion && !loading && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-[var(--bp-border)]/40 bg-[var(--bp-surface-1)]">
          {latency != null && (
            <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-[var(--bp-text-faint)]">
              {latency}ms · claude
            </span>
          )}
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              type="button"
              onClick={reject}
              data-testid={`${testIdPrefix}-reject`}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[5px]
                         text-[10px] uppercase tracking-[0.18em] font-body
                         text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]
                         border border-transparent hover:border-[var(--bp-border)] transition-colors"
            >
              <X size={10} strokeWidth={1.5} />
              Discard
            </button>
            <button
              type="button"
              onClick={accept}
              data-testid={`${testIdPrefix}-accept`}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[5px]
                         text-[10px] uppercase tracking-[0.18em] font-body font-medium
                         bg-[var(--bp-primary)] text-black hover:opacity-90 transition-opacity"
            >
              <Check size={10} strokeWidth={2} />
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AISuggestionPanel;
