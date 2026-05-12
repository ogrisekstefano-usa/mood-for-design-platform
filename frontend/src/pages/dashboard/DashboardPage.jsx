import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';
import { Users, FolderOpen, FileText, Layers, TrendingUp, ArrowRight, Plus, Activity } from 'lucide-react';

const StatusDot = ({ color }) => <span className={`inline-block w-1.5 h-1.5 rounded-full ${color}`} />;

const KpiCard = ({ icon: Icon, label, value, sub, color, testId }) => (
  <div data-testid={testId} className="bg-[#141416] border border-white/[0.06] rounded-md p-5 card-hover animate-fadeIn">
    <div className="flex items-start justify-between mb-4">
      <div className={`w-9 h-9 rounded-[4px] flex items-center justify-center ${color}`}>
        <Icon size={16} strokeWidth={1.5} />
      </div>
    </div>
    <p className="font-heading text-3xl font-light text-[#EFEBE4] mb-0.5">{value}</p>
    <p className="text-[#6B6863] text-xs font-body font-medium uppercase tracking-[0.1em]">{label}</p>
    {sub && <p className="text-[#4A4845] text-[11px] font-body mt-1">{sub}</p>}
  </div>
);

const ACTIVITY_MOCK = [
  { id: 1, type: 'lead', text: 'Nuova richiesta da Marco Rossi — Residenziale Milano', time: '2h fa', dot: 'bg-blue-400' },
  { id: 2, type: 'proposal', text: 'Proposta approvata — Villa Como, Cliente: Sofia Conti', time: '4h fa', dot: 'bg-[#D4AF37]' },
  { id: 3, type: 'project', text: 'Avanzamento progetto → Fase Design — Penthouse Roma', time: '1g fa', dot: 'bg-purple-400' },
  { id: 4, type: 'moodboard', text: 'Nuovo moodboard creato — Suite Venezia', time: '2g fa', dot: 'bg-emerald-400' },
  { id: 5, type: 'lead', text: 'Richiesta partnership A&D — Studio Ferrari', time: '3g fa', dot: 'bg-blue-400' },
];

const QuickAction = ({ label, to, icon: Icon, navigate }) => (
  <button onClick={() => navigate(to)} data-testid={`quick-action-${label.toLowerCase().replace(' ', '-')}`}
    className="flex items-center gap-3 p-3 bg-[#1C1C1F] border border-white/[0.05] rounded-[4px] hover:border-white/[0.1] hover:bg-[#222226] transition-all text-left group w-full">
    <div className="w-8 h-8 bg-[#0A0A0B] rounded-[3px] flex items-center justify-center flex-shrink-0">
      <Icon size={14} strokeWidth={1.5} className="text-[#D4AF37]" />
    </div>
    <span className="text-[#A19D98] text-xs font-body font-medium group-hover:text-[#EFEBE4] transition-colors">{label}</span>
    <ArrowRight size={12} className="ml-auto text-[#3A3835] group-hover:text-[#6B6863] transition-colors" />
  </button>
);

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/api/insights/dashboard').then(r => setStats(r.data)).catch(() => {});
  }, []);

  const firstName = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Studio';

  const kpis = [
    { icon: Users, label: 'Active Leads', value: stats?.leads?.total ?? '—', sub: `${stats?.leads?.new ?? 0} nuovi`, color: 'bg-blue-500/10 text-blue-400', testId: 'kpi-leads' },
    { icon: FolderOpen, label: 'Projects', value: stats?.projects?.total ?? '—', sub: `${stats?.projects?.design ?? 0} in design`, color: 'bg-purple-500/10 text-purple-400', testId: 'kpi-projects' },
    { icon: FileText, label: 'Proposals', value: stats?.proposals?.total ?? '—', sub: `${stats?.proposals?.sent ?? 0} inviate`, color: 'bg-[#D4AF37]/10 text-[#D4AF37]', testId: 'kpi-proposals' },
    { icon: Layers, label: 'Moodboards', value: '—', sub: 'connetti Supabase', color: 'bg-emerald-500/10 text-emerald-400', testId: 'kpi-moodboards' },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fadeIn" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <p className="text-[#6B6863] text-xs font-body uppercase tracking-[0.15em] mb-1">Blueprint Workspace</p>
          <h1 className="font-heading text-4xl font-light text-[#EFEBE4] leading-tight">
            Benvenuto, <em>{firstName}</em>
          </h1>
          <p className="text-[#4A4845] text-sm font-body mt-1">{new Date().toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <button data-testid="new-project-btn" onClick={() => navigate('/workspace/projects')}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#D4AF37] hover:bg-[#E2C365] text-[#0A0A0B] font-semibold text-xs font-body rounded-[3px] transition-colors">
          <Plus size={14} /> Nuovo Progetto
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity feed */}
        <div className="lg:col-span-2 bg-[#141416] border border-white/[0.06] rounded-md p-5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Activity size={14} strokeWidth={1.5} className="text-[#D4AF37]" />
              <h3 className="text-[#EFEBE4] text-sm font-body font-semibold">Attività recente</h3>
            </div>
          </div>
          <div className="space-y-4">
            {ACTIVITY_MOCK.map(item => (
              <div key={item.id} className="flex items-start gap-3 group">
                <div className="mt-1.5 flex-shrink-0">
                  <StatusDot color={item.dot} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#A19D98] text-xs font-body leading-relaxed">{item.text}</p>
                </div>
                <span className="text-[#3A3835] text-[10px] font-body flex-shrink-0 mt-0.5">{item.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="bg-[#141416] border border-white/[0.06] rounded-md p-5">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={14} strokeWidth={1.5} className="text-[#D4AF37]" />
            <h3 className="text-[#EFEBE4] text-sm font-body font-semibold">Azioni rapide</h3>
          </div>
          <div className="space-y-2">
            <QuickAction label="Nuovo Lead" to="/workspace/leads" icon={Users} navigate={navigate} />
            <QuickAction label="Nuovo Progetto" to="/workspace/projects" icon={FolderOpen} navigate={navigate} />
            <QuickAction label="Nuova Proposta" to="/proposals" icon={FileText} navigate={navigate} />
            <QuickAction label="Nuovo Moodboard" to="/moodboards" icon={Layers} navigate={navigate} />
          </div>

          {/* Setup banner */}
          {!stats?.leads?.total && (
            <div className="mt-5 p-4 bg-[#D4AF37]/5 border border-[#D4AF37]/15 rounded-[4px]">
              <p className="text-[#D4AF37] text-[11px] font-semibold font-body uppercase tracking-wider mb-1">Setup Supabase</p>
              <p className="text-[#6B6863] text-[11px] font-body leading-relaxed">
                Aggiungi le credenziali Supabase nell'ambiente per attivare il database.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
