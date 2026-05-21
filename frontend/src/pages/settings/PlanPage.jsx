/**
 * PlanPage — Billing & Plan tile.
 *
 * Session G: READ-ONLY view of active plan + live usage meters + module list.
 * Plan changes happen out-of-band (super_admin via SuperAdmin dashboard) until
 * Stripe is wired in Session H.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Users, Briefcase, HardDrive, Sparkles, Globe, Layers, CheckCircle2, AlertCircle, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { useAuth } from '../../contexts/AuthContext';
import { refreshLicense } from '../../hooks/useLicense';
import api from '../../lib/api';
const fmt = n => n == null ? '∞' : new Intl.NumberFormat().format(n);
const UsageMeter = ({
  icon: Icon,
  label,
  current,
  limit,
  unit = '',
  testid
}) => {
  const unlimited = limit == null;
  const pct = unlimited ? 0 : Math.min(100, Math.round(current / Math.max(limit, 1) * 100));
  const tone = unlimited ? 'safe' : pct >= 100 ? 'danger' : pct >= 80 ? 'warn' : 'safe';
  const tones = {
    safe: {
      bar: 'bg-[var(--bp-primary)]',
      fg: 'text-[var(--bp-text-primary)]'
    },
    warn: {
      bar: 'bg-amber-300',
      fg: 'text-amber-200'
    },
    danger: {
      bar: 'bg-rose-400',
      fg: 'text-rose-300'
    }
  };
  return <div className="bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[var(--bp-radius-md)] p-5" data-testid={testid}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-[var(--bp-text-muted)] text-[10px] font-body uppercase tracking-[0.2em]">
          <Icon size={12} strokeWidth={1.5} />
          {label}
        </div>
        {unlimited && <span className="text-[var(--bp-primary)] text-[10px] font-body uppercase tracking-[0.18em]">Unlimited</span>}
      </div>
      <p className={`font-heading text-3xl ${tones[tone].fg}`}>
        {fmt(current)}<span className="text-[var(--bp-text-muted)] text-base font-body">{unit} / {fmt(limit)}{unit}</span>
      </p>
      <div className="mt-3 h-1 w-full bg-[var(--bp-surface-2)] rounded-full overflow-hidden">
        <div className={`h-full ${tones[tone].bar} transition-[width] duration-700`} style={{
        width: `${unlimited ? 12 : pct}%`
      }} />
      </div>
      {tone === 'warn' && <p className="mt-2 text-amber-200 text-[10px] font-body flex items-center gap-1">
          <AlertCircle size={10} strokeWidth={1.5} /> Approaching limit
        </p>}
      {tone === 'danger' && <p className="mt-2 text-rose-300 text-[10px] font-body flex items-center gap-1">
          <AlertCircle size={10} strokeWidth={1.5} /> Limit reached — upgrade to add more
        </p>}
    </div>;
};
const PlanCard = ({
  plan,
  isCurrent,
  isSuper,
  onAssign
}) => <div className={`relative bg-[var(--bp-surface-1)] border rounded-[var(--bp-radius-md)] p-6 transition-colors
    ${isCurrent ? 'border-[var(--bp-primary)] bg-[var(--bp-primary)]/4' : 'border-[var(--bp-border)] hover:border-[var(--bp-border-strong)]'}`} data-testid={`plan-card-${plan.key}`}>
    {isCurrent && <span className="absolute top-4 right-4 px-2 py-0.5 rounded-full bg-[var(--bp-primary)] text-black text-[9px] font-body uppercase tracking-[0.18em]">
        Current
      </span>}
    <h3 className="font-heading text-2xl text-[var(--bp-text-primary)] mb-1">{plan.label}</h3>
    <p className="text-[var(--bp-text-muted)] text-[12px] font-body mb-5">{plan.description}</p>
    <ul className="space-y-2 mb-5">
      <li className="flex items-center gap-2 text-[12px] font-body text-[var(--bp-text-secondary)]">
        <CheckCircle2 size={11} className="text-[var(--bp-primary)]" strokeWidth={1.8} /> {fmt(plan.max_users)} seats
      </li>
      <li className="flex items-center gap-2 text-[12px] font-body text-[var(--bp-text-secondary)]">
        <CheckCircle2 size={11} className="text-[var(--bp-primary)]" strokeWidth={1.8} /> {fmt(plan.max_projects)} projects
      </li>
      <li className="flex items-center gap-2 text-[12px] font-body text-[var(--bp-text-secondary)]">
        <CheckCircle2 size={11} className="text-[var(--bp-primary)]" strokeWidth={1.8} /> {fmt(plan.max_moodboards)} moodboards
      </li>
      <li className="flex items-center gap-2 text-[12px] font-body text-[var(--bp-text-secondary)]">
        <CheckCircle2 size={11} className="text-[var(--bp-primary)]" strokeWidth={1.8} /> {fmt(plan.max_storage_gb)} GB storage
      </li>
      <li className="flex items-center gap-2 text-[12px] font-body text-[var(--bp-text-secondary)]">
        <CheckCircle2 size={11} className="text-[var(--bp-primary)]" strokeWidth={1.8} /> {fmt(plan.max_domains)} domain{plan.max_domains === 1 ? '' : 's'}
      </li>
      <li className="flex items-center gap-2 text-[12px] font-body text-[var(--bp-text-secondary)]">
        <CheckCircle2 size={11} className="text-[var(--bp-primary)]" strokeWidth={1.8} /> {plan.enabled_modules.length} modules
      </li>
    </ul>
    {isSuper && !isCurrent && <button onClick={() => onAssign(plan.key)} data-testid={`plan-assign-${plan.key}`} className="w-full px-4 py-2 rounded-[var(--bp-radius-xs)] bg-[var(--bp-primary)] text-black text-[11px] font-body uppercase tracking-[0.22em] hover:brightness-110 transition-all">
        Assign this plan
      </button>}
    {!isSuper && !isCurrent && <button disabled className="w-full px-4 py-2 rounded-[var(--bp-radius-xs)] border border-[var(--bp-border)] text-[var(--bp-text-muted)] text-[11px] font-body uppercase tracking-[0.22em] flex items-center justify-center gap-2 cursor-not-allowed">
        <Lock size={11} strokeWidth={1.5} /> Contact sales to upgrade
      </button>}
  </div>;
const PlanPage = () => {
  const navigate = useNavigate();
  const {
    t
  } = useBlueprint();
  const {
    user
  } = useAuth();
  const [license, setLicense] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const isSuper = user?.role === 'super_admin';
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [licRes, plansRes] = await Promise.all([api.get('/api/license'), api.get('/api/license/plans')]);
      setLicense(licRes.data);
      setPlans(plansRes.data?.plans || []);
    } catch (e) {
      toast.error('Could not load license');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const assign = async planKey => {
    if (!license?.tenant_id) return;
    try {
      await api.post(`/api/license/${license.tenant_id}/assign`, {
        plan_key: planKey
      });
      toast.success(`Plan changed to ${planKey}`);
      refreshLicense();
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not change plan');
    }
  };
  if (loading) {
    return <div className="p-10 flex items-center justify-center text-[var(--bp-text-muted)]">
        <Loader2 className="animate-spin mr-2" size={16} /> Loading plan…
      </div>;
  }
  if (!license) return null;
  const lim = license.limits || {};
  const use = license.usage || {};
  return <div className="p-10 max-w-5xl mx-auto" data-testid="plan-page">
      <button onClick={() => navigate('/settings')} data-testid="plan-back" className="flex items-center gap-1.5 text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] text-[10px] font-body uppercase tracking-[0.22em] mb-4">
        <ArrowLeft size={11} strokeWidth={1.5} /> {t('common.back', null, 'Back')}
      </button>
      <p className="text-[var(--bp-primary)] text-[10px] font-body uppercase tracking-[0.22em] font-semibold mb-1">
        Workspace · Billing & Plan
      </p>
      <h1 className="font-heading text-4xl font-light text-[var(--bp-text-primary)] leading-none mb-2">
        {license.plan_label}
      </h1>
      <p className="text-[var(--bp-text-muted)] text-[13px] font-body mb-8 max-w-xl">
        Subscription is <span className="text-[var(--bp-text-primary)]">{license.subscription_status}</span>.
        {license.billing_cycle && <> Billed {license.billing_cycle}.</>}
      </p>

      {/* Usage meters */}
      <h2 className="font-heading text-xl text-[var(--bp-text-primary)] mb-3">Usage</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        <UsageMeter icon={Users} label="Seats" current={use.users} limit={lim.max_users} testid="meter-users" />
        <UsageMeter icon={Briefcase} label="Projects" current={use.projects} limit={lim.max_projects} testid="meter-projects" />
        <UsageMeter icon={Layers} label="Moodboards" current={use.moodboards} limit={lim.max_moodboards} testid="meter-moodboards" />
        <UsageMeter icon={HardDrive} label="Storage" current={use.storage_gb} limit={lim.max_storage_gb} unit=" GB" testid="meter-storage" />
        <UsageMeter icon={Globe} label="Domains" current={use.domains} limit={lim.max_domains} testid="meter-domains" />
        <UsageMeter icon={Sparkles} label={t("settings.plan.ai_credits")} current={use.ai_credits_used} limit={lim.max_ai_credits} testid="meter-ai" />
      </div>

      {/* Modules enabled in current plan */}
      <h2 className="font-heading text-xl text-[var(--bp-text-primary)] mb-3">Modules enabled</h2>
      <div className="flex flex-wrap gap-1.5 mb-10">
        {(license.enabled_modules || []).map(m => <span key={m} data-testid={`module-${m}`} className="px-3 py-1 rounded-full bg-[var(--bp-surface-2)] border border-[var(--bp-border)] text-[var(--bp-text-secondary)] text-[10px] font-body uppercase tracking-[0.18em]">
            {m}
          </span>)}
      </div>

      {/* Plan catalog */}
      <h2 className="font-heading text-xl text-[var(--bp-text-primary)] mb-3">Plans</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map(p => <PlanCard key={p.key} plan={p} isCurrent={p.key === license.plan_key} isSuper={isSuper} onAssign={assign} />)}
      </div>

      <p className="text-[var(--bp-text-muted)] text-[11px] font-body mt-8 max-w-2xl">
        <CreditCard size={11} className="inline mr-1" strokeWidth={1.5} />
        Self-serve checkout is rolling out soon. Until then, {isSuper ? 'use the buttons above' : 'contact sales'} to change plan.
      </p>
    </div>;
};
export default PlanPage;