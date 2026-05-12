/**
 * DashboardPage — fully Blueprint-driven.
 * Widgets are rendered from /api/blueprint/dashboard config.
 * No hardcoded copy or mock data.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useBlueprint } from '../../contexts/BlueprintContext';
import api from '../../lib/api';

const TONE_CLASSES = {
  blue: 'bg-blue-500/10 text-blue-400',
  purple: 'bg-purple-500/10 text-purple-400',
  gold: 'bg-[var(--bp-primary,#D4AF37)]/10 text-[var(--bp-primary,#D4AF37)]',
  emerald: 'bg-emerald-500/10 text-emerald-400',
};

function getNested(obj, path) {
  return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

const KpiCard = ({ widget, dashboardData }) => {
  const Icon = Icons[widget.icon] || Icons.Square;
  const { t } = useBlueprint();
  const value = getNested(dashboardData, widget.metric);
  return (
    <div data-testid={`kpi-${widget.id}`} className="bg-[#141416] border border-white/[0.06] rounded-md p-5 card-hover animate-fadeIn">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-9 h-9 rounded-[4px] flex items-center justify-center ${TONE_CLASSES[widget.tone] || TONE_CLASSES.gold}`}>
          <Icon size={16} strokeWidth={1.5} />
        </div>
      </div>
      <p className="font-heading text-3xl font-light text-[#EFEBE4] mb-0.5">{value ?? '—'}</p>
      <p className="text-[#6B6863] text-xs font-body font-medium uppercase tracking-[0.1em]">{t(widget.labelKey)}</p>
    </div>
  );
};

const ActivityFeed = ({ widget }) => {
  const { t } = useBlueprint();
  const [events, setEvents] = useState(null);
  useEffect(() => {
    api.get(widget.source + '?limit=8').then((r) => setEvents(r.data.data || [])).catch(() => setEvents([]));
  }, [widget.source]);

  return (
    <div data-testid={`widget-${widget.id}`} className="bg-[#141416] border border-white/[0.06] rounded-md p-5">
      <div className="flex items-center gap-2 mb-5">
        <Icons.Activity size={14} strokeWidth={1.5} className="text-[var(--bp-primary,#D4AF37)]" />
        <h3 className="text-[#EFEBE4] text-sm font-body font-semibold">{t(widget.labelKey)}</h3>
      </div>
      {events == null ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-8 skeleton rounded-[3px]" />)}</div>
      ) : events.length === 0 ? (
        <p className="text-[#4A4845] text-sm font-body py-6 text-center">{t('dashboard.activity.empty')}</p>
      ) : (
        <div className="space-y-4">
          {events.map((e, i) => {
            const dotMap = { blue: 'bg-blue-400', purple: 'bg-purple-400', gold: 'bg-[var(--bp-primary,#D4AF37)]', emerald: 'bg-emerald-400' };
            return (
              <div key={`${e.type}-${e.id || i}`} className="flex items-start gap-3" data-testid={`activity-${i}`}>
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotMap[e.tone] || dotMap.gold}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[#A19D98] text-xs font-body leading-relaxed">
                    <span className="text-[#6B6863] capitalize">[{t(`nav.${e.type === 'lead' ? 'leads' : e.type + 's'}`)}]</span>{' '}
                    {e.title || '—'}
                  </p>
                </div>
                <span className="text-[#3A3835] text-[10px] font-body flex-shrink-0 mt-0.5">
                  {e.created_at ? new Date(e.created_at).toLocaleDateString() : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const QuickActions = ({ widget }) => {
  const { t } = useBlueprint();
  const navigate = useNavigate();
  return (
    <div data-testid={`widget-${widget.id}`} className="bg-[#141416] border border-white/[0.06] rounded-md p-5">
      <div className="flex items-center gap-2 mb-5">
        <Icons.TrendingUp size={14} strokeWidth={1.5} className="text-[var(--bp-primary,#D4AF37)]" />
        <h3 className="text-[#EFEBE4] text-sm font-body font-semibold">{t(widget.labelKey)}</h3>
      </div>
      <div className="space-y-2">
        {widget.actions.map((a) => {
          const Icon = Icons[a.icon] || Icons.ArrowRight;
          return (
            <button key={a.labelKey} data-testid={`action-${a.labelKey}`} onClick={() => navigate(a.to)}
              className="flex items-center gap-3 p-3 bg-[#1C1C1F] border border-white/[0.05] rounded-[4px] hover:border-white/[0.1] hover:bg-[#222226] transition-all text-left group w-full">
              <div className="w-8 h-8 bg-[#0A0A0B] rounded-[3px] flex items-center justify-center flex-shrink-0">
                <Icon size={14} strokeWidth={1.5} className="text-[var(--bp-primary,#D4AF37)]" />
              </div>
              <span className="text-[#A19D98] text-xs font-body font-medium group-hover:text-[#EFEBE4] transition-colors">{t(a.labelKey)}</span>
              <Icons.ArrowRight size={12} className="ml-auto text-[#3A3835] group-hover:text-[#6B6863] transition-colors" />
            </button>
          );
        })}
      </div>
    </div>
  );
};

const Widget = ({ widget, dashboardData }) => {
  if (widget.type === 'kpi') return <KpiCard widget={widget} dashboardData={dashboardData} />;
  if (widget.type === 'feed') return <ActivityFeed widget={widget} />;
  if (widget.type === 'actions') return <QuickActions widget={widget} />;
  return null;
};

const DashboardPage = () => {
  const { user } = useAuth();
  const { t, dashboardConfig } = useBlueprint();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!dashboardConfig) return;
    const sources = [...new Set(dashboardConfig.widgets.filter((w) => w.source && w.type === 'kpi').map((w) => w.source))];
    Promise.all(sources.map((s) => api.get(s).then((r) => [s, r.data]).catch(() => [s, null])))
      .then((rows) => {
        const map = {};
        rows.forEach(([s, d]) => { map[s] = d; });
        setData(map);
      });
  }, [dashboardConfig]);

  const widgets = dashboardConfig?.widgets || [];
  const kpis = widgets.filter((w) => w.type === 'kpi');
  const others = widgets.filter((w) => w.type !== 'kpi');

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fadeIn" data-testid="dashboard-page">
      <div className="flex items-start justify-between mb-10">
        <div>
          <p className="text-[#6B6863] text-xs font-body uppercase tracking-[0.15em] mb-1">{t('nav.section.workspace')}</p>
          <h1 className="font-heading text-4xl font-light text-[#EFEBE4] leading-tight">
            {t('dashboard.title')}, <em>{user?.first_name || user?.email?.split('@')[0]}</em>
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((w) => <Widget key={w.id} widget={w} dashboardData={data?.[w.source]} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {others.map((w) => (
          <div key={w.id} className={w.size === 'wide' ? 'lg:col-span-2' : ''}>
            <Widget widget={w} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default DashboardPage;
