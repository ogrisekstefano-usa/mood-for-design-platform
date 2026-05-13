/**
 * Admin Overview — global stats across all tenants.
 */
import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { Building2, Users, FolderOpen, FileText, Layers, BookOpen } from 'lucide-react';

const Stat = ({ icon: Icon, label, value, sub, tone, testId }) => {
  const tones = {
    amber: 'bg-amber-500/10 text-amber-400',
    purple: 'bg-purple-500/10 text-purple-400',
    blue: 'bg-blue-500/10 text-blue-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
    gold: 'bg-[var(--bp-primary)]/10 text-[var(--bp-primary)]',
  };
  return (
    <div data-testid={testId} className="bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-md p-5 hover:border-[var(--bp-border-strong)] transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-[4px] flex items-center justify-center ${tones[tone]}`}>
          <Icon size={16} strokeWidth={1.5} />
        </div>
      </div>
      <p className="font-heading text-3xl font-light text-[var(--bp-text-primary)] mb-1">{value ?? '—'}</p>
      <p className="text-[var(--bp-text-muted)] text-xs font-body uppercase tracking-[0.1em]">{label}</p>
      {sub && <p className="text-[var(--bp-text-subtle)] text-[11px] font-body mt-1">{sub}</p>}
    </div>
  );
};

const AdminOverviewPage = () => {
  const { t } = useBlueprint();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/api/super/stats').then((r) => setStats(r.data)).catch(() => setStats({}));
  }, []);

  return (
    <div className="p-10 max-w-7xl mx-auto" data-testid="admin-overview">
      <div className="mb-10">
        <p className="text-amber-400/80 text-[10px] font-body uppercase tracking-[0.2em] font-semibold mb-2">{t('admin.nav.overview')}</p>
        <h1 className="font-heading text-5xl font-light text-[var(--bp-text-primary)]">{t('admin.overview.title', null, 'Platform Overview')}</h1>
        <p className="text-[var(--bp-text-muted)] text-sm font-body mt-2">{t('admin.overview.subtitle', null, 'Real-time intelligence across every tenant on the platform.')}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat testId="stat-tenants-total" icon={Building2} label={t('admin.stats.tenants', null, 'Tenants')} value={stats?.tenants?.total} sub={`${stats?.tenants?.active || 0} active`} tone="amber" />
        <Stat testId="stat-users" icon={Users} label={t('admin.stats.users', null, 'Users')} value={stats?.users} tone="blue" />
        <Stat testId="stat-leads" icon={Users} label={t('admin.stats.leads', null, 'Leads')} value={stats?.leads} tone="blue" />
        <Stat testId="stat-projects" icon={FolderOpen} label={t('admin.stats.projects', null, 'Projects')} value={stats?.projects} tone="purple" />
        <Stat testId="stat-proposals" icon={FileText} label={t('admin.stats.proposals', null, 'Proposals')} value={stats?.proposals} tone="gold" />
        <Stat testId="stat-moodboards" icon={Layers} label={t('admin.stats.moodboards', null, 'Moodboards')} value={stats?.moodboards} tone="emerald" />
        <Stat testId="stat-magazine" icon={BookOpen} label={t('admin.stats.magazine', null, 'Articles')} value={stats?.magazine_posts} tone="amber" />
        <Stat testId="stat-tenants-suspended" icon={Building2} label={t('admin.stats.suspended', null, 'Suspended')} value={stats?.tenants?.suspended} tone="purple" />
      </div>
    </div>
  );
};

export default AdminOverviewPage;
