/**
 * StudioOnboardingPanel — Phase S.1 setup checklist for Blueprint OS.
 *
 * Renders on the Dashboard when /api/tenant-onboarding/status indicates
 * the tenant has uncompleted steps AND the panel has not been dismissed.
 *
 * Visual: Blueprint OS cinematic enterprise (Playfair headline, bp-card,
 * gradient surfaces, teal accent for done steps). Never wizard-style /
 * modal-invasive — inline panel only.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Check, ArrowUpRight, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';

const StudioOnboardingPanel = () => {
  const [state, setState] = useState({ loading: true, data: null, dismissed: false });

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/api/tenant-onboarding/status');
      setState({ loading: false, data, dismissed: !!data?.dismissed });
    } catch (e) {
      setState({ loading: false, data: null, dismissed: false });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markDone = async (key) => {
    try {
      await api.post('/api/tenant-onboarding/mark-done', { key });
      toast.success('Passo segnato come completato.');
      load();
    } catch (e) {
      toast.error('Impossibile segnare il passo.');
    }
  };

  const dismiss = async () => {
    try {
      await api.post('/api/tenant-onboarding/dismiss', {});
      setState((s) => ({ ...s, dismissed: true }));
      toast.success('Pannello onboarding nascosto.');
    } catch (e) {
      toast.error('Impossibile nascondere il pannello.');
    }
  };

  if (state.loading || !state.data) return null;
  if (state.dismissed) return null;
  if (state.data.all_done) return null;

  const { items, completed, total, progress } = state.data;

  return (
    <section
      data-testid="studio-onboarding-panel"
      className="bp-card rounded-[18px] p-7 lg:p-8 mb-8"
    >
      <header className="flex items-start justify-between gap-6 mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--bp-primary)] mb-3 font-body">
            Setup studio
          </p>
          <h2 className="font-heading text-[26px] leading-[1.15] text-[var(--bp-text-primary)] tracking-[-0.005em]">
            Configura il tuo workspace.
          </h2>
          <p className="text-[13px] text-[var(--bp-text-muted)] mt-2 font-body">
            Sette passi per portare lo studio a pieno regime in Blueprint OS™.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)]">
              Progresso
            </p>
            <p className="font-heading text-[28px] leading-[1] tabular-nums text-[var(--bp-text-primary)] mt-1">
              {completed}<span className="text-[var(--bp-text-faint)]">/{total}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            data-testid="studio-onboarding-dismiss"
            aria-label="Dismiss"
            className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] transition-colors p-1"
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-[3px] w-full rounded-full bg-[var(--bp-border)] overflow-hidden mb-7">
        <div
          className="h-full bg-[var(--bp-primary)] rounded-full transition-[width] duration-500"
          style={{ width: `${Math.max(3, progress)}%` }}
        />
      </div>

      {/* Checklist */}
      <ol className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((it, i) => (
          <ChecklistRow key={it.key} {...it} index={i + 1} onComplete={() => markDone(it.key)} />
        ))}
      </ol>
    </section>
  );
};

const ChecklistRow = ({ index, key: _k, title, body, link, done, onComplete }) => {
  const isOwnerIntro = _k === 'owner_introduced';
  const openIntroModal = () => {
    window.dispatchEvent(new CustomEvent('mfd:open-owner-introduction'));
  };
  return (
    <li
      data-testid={`onboarding-step-${_k || index}`}
      className={`group flex items-start gap-3 rounded-[12px] p-4 border transition-colors
                  ${done
                    ? 'border-[var(--bp-primary)]/25 bg-[var(--bp-primary)]/[0.04]'
                    : 'border-[var(--bp-border)] hover:border-[var(--bp-border-strong)] bg-[var(--bp-surface-2)]/30'}`}
    >
      <span
        aria-hidden
        className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center mt-0.5
                    ${done
                      ? 'bg-[var(--bp-primary)] text-black'
                      : 'border border-[var(--bp-border-strong)] text-[var(--bp-text-muted)] font-mono text-[10px]'}`}
      >
        {done ? <Check size={12} strokeWidth={2.4} /> : String(index).padStart(2, '0')}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] font-body leading-tight mb-1 ${
          done ? 'text-[var(--bp-text-secondary)]' : 'text-[var(--bp-text-primary)]'
        }`}>
          {title}
        </p>
        <p className="text-[11px] text-[var(--bp-text-muted)] font-body leading-relaxed">
          {body}
        </p>
        {!done && (
          <div className="mt-3 flex items-center gap-3">
            {isOwnerIntro ? (
              <button
                type="button"
                onClick={openIntroModal}
                className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-[var(--bp-primary)] hover:opacity-80 transition-opacity"
              >
                Presentati ora <ArrowUpRight size={11} strokeWidth={1.8} />
              </button>
            ) : link ? (
              <a
                href={link}
                className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-[var(--bp-primary)] hover:opacity-80 transition-opacity"
              >
                Apri sezione <ArrowUpRight size={11} strokeWidth={1.8} />
              </a>
            ) : null}
            {!isOwnerIntro && (
              <button
                type="button"
                onClick={onComplete}
                className="text-[10px] uppercase tracking-[0.18em] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] transition-colors"
              >
                Segna fatto
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
};

export default StudioOnboardingPanel;
