/**
 * EditorialContextRail™
 * ────────────────────────────────────────────────────────────────────
 * Replaces the technical breadcrumb. Persistent, compact, always-visible
 * editorial context.
 *
 * Shows WHAT the user is orchestrating — not where they are.
 *
 *   MASTER · MARKET · STATUS · NEXT STEP · SCHEDULE · CTA ·
 *   SEO GOAL · EDITORIAL REGISTER · PUBLIC STATE
 *
 * Plus: Next Step Intelligence™ — a lightweight operational advisor
 * (heuristic, NOT generative) surfacing the single most actionable
 * gap (missing locale, no schedule, CTA imbalance, review aging, …).
 */
import React, { useMemo } from 'react';
import {
  Compass, Globe2, Sparkles, CalendarClock, Megaphone, Search,
  ScrollText, Eye, ArrowRight, AlertTriangle, ChevronDown,
} from 'lucide-react';

// ─── Status palette (per user spec) ──────────────────────────────────
const STATUS_PALETTE = {
  draft:               { label: 'Drafting',          color: '#9CA3AF' }, // stone gray
  awaiting_review:     { label: 'Awaiting Review',   color: '#F59E0B' }, // amber
  in_review:           { label: 'In Review',         color: '#F59E0B' },
  scheduled:           { label: 'Scheduled',         color: '#5B7CA0' }, // blue steel
  publishing_today:    { label: 'Publishing Today',  color: '#D4AF37' }, // soft gold
  published:           { label: 'Published',         color: '#10B981' }, // emerald
  live:                { label: 'Published',         color: '#10B981' },
  diverged:            { label: 'Diverged',          color: '#C77B7B' }, // muted rose
  approved:            { label: 'Approved',          color: '#10B981' },
  composing:           { label: 'Composing',         color: '#9CA3AF' },
  direction_defined:   { label: 'Direction Defined', color: '#9CA3AF' },
  ready_for_editorial_review: { label: 'Ready for Review', color: '#F59E0B' },
  rebalancing:         { label: 'Rebalancing',       color: '#F59E0B' },
};

const PUBLIC_STATE = {
  draft:   { label: 'Internal Only',  tone: 'muted' },
  internal:{ label: 'Internal Only',  tone: 'muted' },
  scheduled: { label: 'Scheduled',    tone: 'steel' },
  published: { label: 'Public Live',  tone: 'emerald' },
  live:    { label: 'Public Live',    tone: 'emerald' },
  archived:{ label: 'Archived',       tone: 'muted' },
  awaiting_review: { label: 'Awaiting Review', tone: 'amber' },
};

const publicStateFor = (variant) => {
  if (!variant) return PUBLIC_STATE.internal;
  if (variant.status === 'published' || variant.status === 'live') return PUBLIC_STATE.published;
  if (variant.status === 'scheduled') return PUBLIC_STATE.scheduled;
  if (variant.status === 'archived')  return PUBLIC_STATE.archived;
  if (['awaiting_review', 'in_review', 'ready_for_editorial_review'].includes(variant.status)) return PUBLIC_STATE.awaiting_review;
  return PUBLIC_STATE.internal;
};

// ─── Next Step Intelligence™ heuristics (NOT AI) ──────────────────────
const computeNextStep = ({ master, variant, market, allVariantsForMaster = [] }) => {
  if (!master) return { label: 'Crea un Editorial Master', tone: 'amber' };
  if (!variant) return { label: 'Componi la prima Market Edition', tone: 'amber' };

  const status = variant.status;
  if (status === 'draft' || status === 'composing') {
    if (!variant.body_blocks || variant.body_blocks.length === 0) {
      return { label: 'Componi i body blocks o sincronizza dal master', tone: 'amber' };
    }
    return { label: 'Manda in review quando pronto', tone: 'amber' };
  }
  if (['ready_for_editorial_review', 'awaiting_review', 'in_review'].includes(status)) {
    return { label: 'Review pending', tone: 'amber' };
  }
  if (status === 'approved') return { label: 'Pronto per la programmazione', tone: 'steel' };
  if (status === 'scheduled') {
    const when = variant.scheduled_at ? new Date(variant.scheduled_at) : null;
    if (when && (when - new Date()) < 86400000) {
      return { label: 'Publishing today', tone: 'gold' };
    }
    return { label: 'In programmazione', tone: 'steel' };
  }
  if (status === 'published' || status === 'live') {
    // Detect missing market editions for this master
    const otherMarkets = (allVariantsForMaster || []).filter((v) => v.market_id !== variant.market_id);
    if (otherMarkets.length === 0) {
      return { label: 'Aggiungi adattamenti per altri mercati', tone: 'amber' };
    }
    return { label: 'Live · monitora performance', tone: 'emerald' };
  }
  return { label: 'Continua la composizione', tone: 'amber' };
};

// ─── Compact field ───────────────────────────────────────────────────
const Field = ({ icon: Icon, label, value, tone, testid, dimmed }) => (
  <div
    className={`ectx-field ${dimmed ? 'is-dimmed' : ''}`}
    data-testid={testid}
    data-tone={tone || 'neutral'}
  >
    <div className="ectx-field__head">
      <Icon size={11} strokeWidth={1.5} className="ectx-field__icon" />
      <span className="ectx-field__label">{label}</span>
    </div>
    <div className="ectx-field__value" title={typeof value === 'string' ? value : undefined}>
      {value || <span className="ectx-field__empty">—</span>}
    </div>
  </div>
);

const StatusField = ({ status, testid }) => {
  const meta = STATUS_PALETTE[status] || STATUS_PALETTE.draft;
  return (
    <div className="ectx-field" data-testid={testid}>
      <div className="ectx-field__head">
        <span className="ectx-field__dot" style={{ backgroundColor: meta.color }} />
        <span className="ectx-field__label">Adaptation Status</span>
      </div>
      <div className="ectx-field__value" style={{ color: meta.color }}>
        {meta.label}
      </div>
    </div>
  );
};

const PublicStateField = ({ variant, testid }) => {
  const s = publicStateFor(variant);
  return (
    <div className="ectx-field" data-tone={s.tone} data-testid={testid}>
      <div className="ectx-field__head">
        <Eye size={11} strokeWidth={1.5} className="ectx-field__icon" />
        <span className="ectx-field__label">Public State</span>
      </div>
      <div className="ectx-field__value">{s.label}</div>
    </div>
  );
};

// ─── Main rail ───────────────────────────────────────────────────────
const EditorialContextRail = ({
  master, variant, market, allVariantsForMaster = [], onAct,
}) => {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const nextStep = useMemo(() =>
    computeNextStep({ master, variant, market, allVariantsForMaster }),
  [master, variant, market, allVariantsForMaster]);

  const scheduledLabel = useMemo(() => {
    if (!variant?.scheduled_at) return 'Not scheduled';
    try { return new Date(variant.scheduled_at).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch { return variant.scheduled_at; }
  }, [variant?.scheduled_at]);

  const ctaLabel = useMemo(() => {
    const set = variant?.cta_set || master?.cta_set || [];
    if (Array.isArray(set) && set.length > 0) {
      const primary = set[0];
      return primary?.label || primary?.title || 'Custom CTA';
    }
    return 'Default Private Consultation';
  }, [variant?.cta_set, master?.cta_set]);

  const seoGoal = variant?.seo?.goal || master?.seo_goal || master?.conceptual_direction || 'Define editorial intent';
  const register = market?.governance_json?.editorial_register
    || variant?.tone_label
    || master?.editorial_register
    || 'Define register';

  return (
    <section
      className="ectx-rail"
      data-testid="editorial-context-rail"
      data-open={mobileOpen}
    >
      {/* Mobile sticky chip — visible <640px only */}
      <button
        type="button"
        className="ectx-rail__mobile-chip"
        data-testid="ectx-mobile-chip"
        onClick={() => setMobileOpen((v) => !v)}
      >
        <Compass size={11} />
        <span className="ectx-rail__mobile-chip-text">
          {master?.title || master?.code || 'No master'} · {market?.code || variant?.target_locale || '—'} · {STATUS_PALETTE[variant?.status]?.label || 'Empty'}
        </span>
        <ChevronDown size={11} style={{ transform: mobileOpen ? 'rotate(180deg)' : 'none' }} />
      </button>

      <div className="ectx-rail__grid">
        <Field
          icon={Compass}
          label="Editorial Master"
          value={master?.title || master?.code || 'No master selected'}
          dimmed={!master}
          testid="ectx-master"
        />
        <Field
          icon={Globe2}
          label="Market"
          value={market
            ? `${market.code}${market.name ? ` · ${market.name}` : ''}`
            : variant?.target_locale || 'Select market'}
          dimmed={!variant}
          testid="ectx-market"
        />
        <StatusField status={variant?.status || 'draft'} testid="ectx-status" />
        <Field
          icon={Sparkles}
          label="Next Step"
          value={nextStep.label}
          tone={nextStep.tone}
          testid="ectx-next-step"
        />
        <Field
          icon={CalendarClock}
          label="Schedule"
          value={scheduledLabel}
          tone={variant?.scheduled_at ? 'steel' : 'muted'}
          testid="ectx-schedule"
        />
        <Field
          icon={Megaphone}
          label="CTA"
          value={ctaLabel}
          testid="ectx-cta"
        />
        <Field
          icon={Search}
          label="SEO Goal"
          value={seoGoal}
          testid="ectx-seo"
        />
        <Field
          icon={ScrollText}
          label="Editorial Register"
          value={register}
          testid="ectx-register"
        />
        <PublicStateField variant={variant} testid="ectx-public-state" />
      </div>

      {/* Next Step Intelligence™ advisory bar */}
      {nextStep.tone === 'amber' && (
        <div className="ectx-advisory" data-testid="ectx-advisory">
          <AlertTriangle size={12} strokeWidth={1.6} className="ectx-advisory__icon" />
          <p className="ectx-advisory__text">{nextStep.label}</p>
          {onAct && (
            <button type="button" onClick={() => onAct(nextStep)} className="ectx-advisory__cta" data-testid="ectx-advisory-cta">
              Risolvi <ArrowRight size={11} strokeWidth={1.8} />
            </button>
          )}
        </div>
      )}
    </section>
  );
};

export default EditorialContextRail;
