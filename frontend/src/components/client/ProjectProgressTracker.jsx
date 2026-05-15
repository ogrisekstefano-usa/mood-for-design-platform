/**
 * ProjectProgressTracker — cinematic horizontal timeline of the
 * 6 project pipeline stages (Brief → Moodboard → Materiali →
 * Progettazione → Revisione finale → Consegna).
 *
 * Driven entirely by the `pipeline` array returned by
 * /api/client/overview — each item has { key, label_it, status,
 * index } where status ∈ {done, current, upcoming}.
 *
 * Visual:
 *   - thin gold rail crossing all dots
 *   - dots: filled gold for done, ring gold for current, faint dot
 *     for upcoming
 *   - labels below each dot in muted ivory
 *   - on hover: dot scales slightly + gold glow shifts (no neon)
 *
 * Variants:
 *   - default (horizontal): used inside ClientOverviewPage hero
 *   - compact: used in side card "Stato attuale" (small list)
 */
import React from 'react';
import { Check } from 'lucide-react';

const ProjectProgressTracker = ({ pipeline, currentLabel, variant = 'horizontal' }) => {
  if (!pipeline || pipeline.length === 0) return null;

  if (variant === 'compact') {
    return <CompactTracker pipeline={pipeline} currentLabel={currentLabel} />;
  }

  return (
    <div data-testid="client-progress-tracker" className="w-full">
      {/* Rail */}
      <div className="relative">
        <div
          aria-hidden
          className="absolute left-0 right-0 top-[14px] h-px bg-[var(--cp-border)]"
        />
        {/* Filled rail up to current stage */}
        <FillRail pipeline={pipeline} />

        <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${pipeline.length}, 1fr)` }}>
          {pipeline.map((st) => (
            <li
              key={st.key}
              data-testid={`client-progress-step-${st.key}`}
              className="flex flex-col items-center text-center"
            >
              <Dot status={st.status} />
              <p className={`mt-4 text-[12.5px] font-body leading-tight ${
                st.status === 'current'
                  ? 'text-[var(--cp-text-primary)]'
                  : st.status === 'done'
                    ? 'text-[var(--cp-text-secondary)]'
                    : 'text-[var(--cp-text-muted)]'
              }`}>
                {st.label_it}
              </p>
              <p className={`mt-1 text-[10px] uppercase tracking-[0.2em] font-body ${
                st.status === 'current'
                  ? 'text-[var(--cp-gold)]'
                  : st.status === 'done'
                    ? 'text-[var(--cp-text-faint)]'
                    : 'text-[var(--cp-text-subtle)]'
              }`}>
                {st.status === 'done' ? 'Completato' : st.status === 'current' ? 'In corso' : 'Prossimo'}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};

const FillRail = ({ pipeline }) => {
  const total = pipeline.length;
  const currentIdx = pipeline.findIndex((s) => s.status === 'current');
  const doneCount = pipeline.filter((s) => s.status === 'done').length;
  // Width = portion of the rail to fill (done dots + half of current dot)
  let fraction;
  if (currentIdx >= 0) {
    fraction = (currentIdx) / (total - 1);
  } else {
    fraction = total > 0 && doneCount === total ? 1 : (doneCount - 1) / Math.max(total - 1, 1);
    if (fraction < 0) fraction = 0;
  }
  return (
    <div
      aria-hidden
      className="absolute left-0 top-[14px] h-px bg-[var(--cp-gold)] origin-left transition-[width] duration-500"
      style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%` }}
    />
  );
};

const Dot = ({ status }) => {
  if (status === 'done') {
    return (
      <span
        aria-label="Completato"
        className="relative z-10 w-7 h-7 rounded-full bg-[var(--cp-gold)] text-[var(--cp-text-on-gold)] flex items-center justify-center"
      >
        <Check size={13} strokeWidth={2.2} />
      </span>
    );
  }
  if (status === 'current') {
    return (
      <span
        aria-label="In corso"
        className="relative z-10 w-7 h-7 rounded-full bg-[var(--cp-bg)] border-[2px] border-[var(--cp-gold)] flex items-center justify-center"
      >
        <span className="w-[7px] h-[7px] rounded-full bg-[var(--cp-gold)]" />
      </span>
    );
  }
  return (
    <span
      aria-label="Prossimo"
      className="relative z-10 w-7 h-7 rounded-full bg-[var(--cp-bg)] border border-[var(--cp-border-strong)] flex items-center justify-center"
    >
      <span className="w-[5px] h-[5px] rounded-full bg-[var(--cp-text-subtle)]" />
    </span>
  );
};

/* ── Compact vertical list — used in side "Stato attuale" card ───── */
const CompactTracker = ({ pipeline, currentLabel }) => (
  <div data-testid="client-progress-tracker-compact" className="space-y-3">
    {currentLabel && (
      <div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--cp-text-muted)] mb-1">
          Stato attuale
        </p>
        <p className="font-heading text-[26px] leading-[1.1] text-[var(--cp-text-primary)] mb-3">
          {currentLabel}
        </p>
        <ProgressBar pipeline={pipeline} />
      </div>
    )}
    <ul className="space-y-2.5 pt-2">
      {pipeline.map((st) => (
        <li key={st.key} className="flex items-center gap-3">
          <span
            aria-hidden
            className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
              st.status === 'done'
                ? 'bg-[var(--cp-gold)] text-[var(--cp-text-on-gold)]'
                : st.status === 'current'
                  ? 'border-[2px] border-[var(--cp-gold)] bg-transparent'
                  : 'border border-[var(--cp-border-strong)] bg-transparent'
            }`}
          >
            {st.status === 'done' && <Check size={9} strokeWidth={2.5} />}
            {st.status === 'current' && (
              <span className="w-[5px] h-[5px] rounded-full bg-[var(--cp-gold)]" />
            )}
          </span>
          <span className={`text-[13px] font-body ${
            st.status === 'current'
              ? 'text-[var(--cp-text-primary)]'
              : st.status === 'done'
                ? 'text-[var(--cp-text-secondary)]'
                : 'text-[var(--cp-text-muted)]'
          }`}>
            {st.label_it}
          </span>
        </li>
      ))}
    </ul>
  </div>
);

const ProgressBar = ({ pipeline }) => {
  const total = pipeline.length;
  const currentIdx = pipeline.findIndex((s) => s.status === 'current');
  const doneCount = pipeline.filter((s) => s.status === 'done').length;
  let pct;
  if (currentIdx >= 0) {
    pct = ((currentIdx + 0.5) / total) * 100;
  } else {
    pct = (doneCount / total) * 100;
  }
  return (
    <div className="w-full h-[3px] rounded-full bg-[var(--cp-border)] overflow-hidden mb-2">
      <div
        className="h-full bg-[var(--cp-gold)] rounded-full transition-[width] duration-500"
        style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
      />
    </div>
  );
};

export default ProjectProgressTracker;
