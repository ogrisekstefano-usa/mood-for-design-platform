/**
 * StepContextHeader™ · Sprint G.6
 *
 * Il contesto precede l'artefatto.
 *
 * Mostra dove ci si trova nel Journey:
 *   · breadcrumb editoriale (Journey · Capitolo)
 *   · titolo del Capitolo
 *   · descrizione narrativa
 *   · stato del lifecycle del Journey
 *   · stato del Capitolo
 *   · progresso (X capitoli su N) — NO percentuali
 *   · prev / next chapter chips
 *
 * NON è un breadcrumb SaaS. È una soglia narrativa.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { useT } from '../../i18n/useT';

const STATE_TONE = {
  conversation_open: 'cool',
  in_progress:       'cool',
  presenting:        'amber',
  drifting:          'amber',
  on_pause:          'muted',
  approved:          'gold',
  closed:            'gold',
  editioned:         'gold',
  abandoned:         'muted',
};

const STEP_TONE = {
  not_started:        'muted',
  in_progress:        'cool',
  presented:          'amber',
  revision_requested: 'amber',
  partially_approved: 'amber',
  approved:           'gold',
  closed:             'gold',
};

const StepContextHeader = ({ context, projectId }) => {
  const { t } = useT();
  const { project, account, journey, step, prev_step, next_step, progress } = context || {};
  if (!step) return null;

  const stepTone   = STEP_TONE[step.status] || 'muted';
  const journeyTone = STATE_TONE[journey?.lifecycle_state] || 'cool';
  const pct = progress
    ? Math.max(0, Math.min(100,
        ((progress.current_step_index + 1) / Math.max(1, progress.total_steps)) * 100))
    : 0;

  // Narrative progress — NO "%". Editorial only.
  const narrative = progress
    ? (() => {
        const cur = progress.current_step_index + 1;
        const n   = progress.total_steps;
        return `Capitolo ${cur} di ${n} · ${progress.completed_steps} ${progress.completed_steps === 1 ? 'pietra miliare approvata' : 'pietre miliari approvate'}`;
      })()
    : null;

  return (
    <header className="sw-context" data-testid="sw-context-header">
      {/* Breadcrumb editoriale */}
      <nav className="sw-context__crumbs" aria-label="Posizione nel Journey">
        <Link to="/dashboard" data-testid="sw-crumb-pulse">Studio Pulse</Link>
        <span className="sw-crumb-sep" aria-hidden="true">/</span>
        <Link to={`/workspace/projects/${projectId}`} data-testid="sw-crumb-journey">
          {project?.title || 'Journey'}
        </Link>
        <span className="sw-crumb-sep" aria-hidden="true">/</span>
        <span style={{ color: 'var(--jo-text-soft, #c8c2b3)' }}>{step.title}</span>
      </nav>

      <div className="sw-context__head">
        <div>
          <p className="sw-context__eyebrow">
            {journey?.lifecycle_label || 'Design Journey™'}
            {account?.display_name && <> · {account.display_name}</>}
          </p>
          <h1 className="sw-context__title" data-testid="sw-context-title">
            {step.title.replace(/™/g, '')}
            {step.title.includes('™') && <span className="sw-context__title-tm">™</span>}
          </h1>
          {step.description && (
            <p className="sw-context__lede">{step.description}</p>
          )}

          <div className="sw-context__meta" style={{ marginTop: 24 }}>
            <span className={`sw-meta-pill`} data-testid="sw-meta-step-state">
              <span className={`sw-meta-pill__dot sw-meta-pill__dot--${
                stepTone === 'cool' ? 'cool' :
                stepTone === 'gold' ? 'gold' :
                stepTone === 'amber' ? 'amber' : 'muted'
              }`} />
              {step.status_label}
            </span>
            <span className="sw-meta-pill" data-testid="sw-meta-journey-state">
              <span className={`sw-meta-pill__dot sw-meta-pill__dot--${
                journeyTone === 'gold' ? 'gold' :
                journeyTone === 'amber' ? 'amber' :
                journeyTone === 'muted' ? 'muted' : 'cool'
              }`} />
              {journey?.lifecycle_label}
            </span>
          </div>
        </div>

        {progress && (
          <div className="sw-context__progress" data-testid="sw-context-progress">
            <span className="sw-context__progress-label">Avanzamento</span>
            <div className="sw-context__progress-track">
              <div className="sw-context__progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="sw-context__progress-text">{narrative}</span>
          </div>
        )}
      </div>

      {(prev_step || next_step) && (
        <div className="sw-context__nav" data-testid="sw-context-nav">
          {prev_step ? (
            <Link
              to={`/journey/${projectId}/step/${prev_step.milestone_type}`}
              className="sw-nav-chip"
              data-testid="sw-context-prev"
            >
              <Icons.ArrowLeft size={13} />
              <span>
                <span className="sw-nav-chip__eyebrow">{t('journey.step_context_header.capitolo_precedente')}</span>
                <span className="sw-nav-chip__title">{prev_step.title}</span>
              </span>
            </Link>
          ) : <span />}
          {next_step && (
            <Link
              to={`/journey/${projectId}/step/${next_step.milestone_type}`}
              className="sw-nav-chip"
              data-testid="sw-context-next"
            >
              <span style={{ textAlign: 'right' }}>
                <span className="sw-nav-chip__eyebrow">{t('journey.step_context_header.capitolo_seguente')}</span>
                <span className="sw-nav-chip__title">{next_step.title}</span>
              </span>
              <Icons.ArrowRight size={13} />
            </Link>
          )}
        </div>
      )}
    </header>
  );
};

export default StepContextHeader;
