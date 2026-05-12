import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from 'recharts';
import { TrendingUp, Users, FolderOpen, FileText } from 'lucide-react';

const MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const MOCK_TREND = MONTHS.map((m, i) => ({ month: m, leads: Math.floor(Math.random() * 12) + 2, projects: Math.floor(Math.random() * 5) + 1 }));
const MOCK_FUNNEL = [
  { stage: 'Lead', value: 48, color: '#3B82F6' },
  { stage: 'Qualificato', value: 24, color: '#8B5CF6' },
  { stage: 'Proposta', value: 12, color: '#D4AF37' },
  { stage: 'Convertito', value: 8, color: '#10B981' },
];

const customTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1C1C1F] border border-white/[0.1] rounded-[4px] px-3 py-2">
      <p className="text-[#6B6863] text-[10px] font-body mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="text-[#EFEBE4] text-xs font-body font-medium">
          {p.name}: <span style={{ color: p.color }}>{p.value}</span>
        </p>
      ))}
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, sub, color }) => (
  <div className="bg-[#141416] border border-white/[0.06] rounded-md p-5 card-hover">
    <div className={`w-9 h-9 rounded-[4px] flex items-center justify-center mb-4 ${color}`}>
      <Icon size={16} strokeWidth={1.5} />
    </div>
    <p className="font-heading text-3xl font-light text-[#EFEBE4] mb-0.5">{value}</p>
    <p className="text-[#6B6863] text-xs font-body font-medium uppercase tracking-[0.1em]">{label}</p>
    {sub && <p className="text-[#4A4845] text-[11px] font-body mt-1">{sub}</p>}
  </div>
);

const InsightsPage = () => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/api/insights/dashboard').then(r => setStats(r.data)).catch(() => {});
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto" data-testid="insights-page">
      <div className="mb-8">
        <p className="text-[#6B6863] text-[10px] font-body uppercase tracking-[0.2em] mb-1">Blueprint Intelligence</p>
        <h1 className="font-heading text-4xl font-light text-[#EFEBE4]">Insights</h1>
        <p className="text-[#4A4845] text-sm font-body mt-1">Panoramica analitica del tuo workspace</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Users} label="Total Leads" value={stats?.leads?.total ?? '—'} sub={`${stats?.leads?.new ?? 0} nuovi`} color="bg-blue-500/10 text-blue-400" />
        <StatCard icon={FolderOpen} label="Projects" value={stats?.projects?.total ?? '—'} sub={`${stats?.projects?.completed ?? 0} completati`} color="bg-purple-500/10 text-purple-400" />
        <StatCard icon={FileText} label="Proposals" value={stats?.proposals?.total ?? '—'} sub={`${stats?.proposals?.approved ?? 0} approvate`} color="bg-[#D4AF37]/10 text-[#D4AF37]" />
        <StatCard icon={TrendingUp} label="Conversion" value={stats?.leads?.total ? `${Math.round((stats.leads.converted / stats.leads.total) * 100)}%` : '—'} sub="Lead → Progetto" color="bg-emerald-500/10 text-emerald-400" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Trend chart */}
        <div className="lg:col-span-2 bg-[#141416] border border-white/[0.06] rounded-md p-5">
          <div className="mb-5">
            <h3 className="text-[#EFEBE4] text-sm font-body font-semibold">Trend Leads & Progetti</h3>
            <p className="text-[#4A4845] text-xs font-body">Anno corrente</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={MOCK_TREND}>
              <defs>
                <linearGradient id="leads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="projects" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" stroke="#3A3835" tick={{ fill: '#4A4845', fontSize: 10, fontFamily: 'Manrope' }} axisLine={false} tickLine={false} />
              <YAxis stroke="#3A3835" tick={{ fill: '#4A4845', fontSize: 10, fontFamily: 'Manrope' }} axisLine={false} tickLine={false} width={25} />
              <Tooltip content={customTooltip} cursor={{ stroke: 'rgba(255,255,255,0.06)' }} />
              <Area type="monotone" dataKey="leads" stroke="#3B82F6" strokeWidth={1.5} fill="url(#leads)" name="Leads" />
              <Area type="monotone" dataKey="projects" stroke="#D4AF37" strokeWidth={1.5} fill="url(#projects)" name="Progetti" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Funnel */}
        <div className="bg-[#141416] border border-white/[0.06] rounded-md p-5">
          <h3 className="text-[#EFEBE4] text-sm font-body font-semibold mb-5">Funnel Conversione</h3>
          <div className="space-y-3">
            {MOCK_FUNNEL.map((f, i) => (
              <div key={f.stage}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[#A19D98] text-xs font-body">{f.stage}</span>
                  <span className="text-[#EFEBE4] text-xs font-body font-semibold">{f.value}</span>
                </div>
                <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${(f.value / 48) * 100}%`, backgroundColor: f.color, opacity: 0.7 }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-5 border-t border-white/[0.04]">
            <p className="text-[#4A4845] text-[10px] font-body uppercase tracking-[0.1em] mb-1">Tasso conversione</p>
            <p className="font-heading text-2xl text-[#D4AF37] font-light">16.7%</p>
          </div>
        </div>
      </div>

      {/* Note */}
      {!stats?.leads?.total && (
        <div className="bg-[#141416] border border-[#D4AF37]/15 rounded-md p-5">
          <p className="text-[#D4AF37] text-xs font-semibold font-body uppercase tracking-wider mb-1">Dati simulati</p>
          <p className="text-[#6B6863] text-sm font-body">I grafici mostrano dati dimostrativi. Connetti Supabase per visualizzare i dati reali.</p>
        </div>
      )}
    </div>
  );
};

export default InsightsPage;
