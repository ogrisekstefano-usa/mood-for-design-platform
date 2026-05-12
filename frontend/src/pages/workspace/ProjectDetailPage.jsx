import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { ArrowLeft, FileText, Layers, MapPin, Calendar, User, Edit3, ChevronRight } from 'lucide-react';

const STATUS_CONFIG = {
  discovery: { label: 'Discovery', color: 'text-blue-400 bg-blue-500/10' },
  design: { label: 'Design', color: 'text-purple-400 bg-purple-500/10' },
  execution: { label: 'Esecuzione', color: 'text-[#D4AF37] bg-[#D4AF37]/10' },
  completed: { label: 'Completato', color: 'text-emerald-400 bg-emerald-500/10' },
  on_hold: { label: 'In pausa', color: 'text-[#6B6863] bg-white/5' },
};

const TabBtn = ({ active, onClick, children }) => (
  <button onClick={onClick}
    className={`px-4 py-2 text-sm font-body font-medium border-b-2 transition-colors ${active ? 'border-[#D4AF37] text-[#D4AF37]' : 'border-transparent text-[#6B6863] hover:text-[#A19D98]'}`}>
    {children}
  </button>
);

const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3 py-3 border-b border-white/[0.04]">
    <Icon size={14} strokeWidth={1.5} className="text-[#4A4845] flex-shrink-0" />
    <span className="text-[#4A4845] text-xs font-body w-28">{label}</span>
    <span className="text-[#EFEBE4] text-sm font-body">{value || '—'}</span>
  </div>
);

const ProjectDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    api.get(`/api/projects/${id}`)
      .then(r => setProject(r.data))
      .catch(() => navigate('/workspace/projects'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="p-8 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!project) return null;
  const sc = STATUS_CONFIG[project.status] || STATUS_CONFIG.discovery;

  return (
    <div className="p-8 max-w-5xl mx-auto" data-testid="project-detail">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => navigate('/workspace/projects')} className="text-[#4A4845] hover:text-[#A19D98] transition-colors flex items-center gap-1.5">
          <ArrowLeft size={14} strokeWidth={1.5} />
          <span className="text-xs font-body">Tutti i progetti</span>
        </button>
        <ChevronRight size={12} className="text-[#3A3835]" />
        <span className="text-[#6B6863] text-xs font-body">{project.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="font-heading text-4xl font-light text-[#EFEBE4]">{project.name}</h1>
            <span className={`text-[11px] font-semibold font-body px-2 py-1 rounded-[3px] ${sc.color}`}>{sc.label}</span>
          </div>
          <div className="flex items-center gap-4 text-[#6B6863] text-xs font-body">
            {project.client_name && <span className="flex items-center gap-1.5"><User size={12} />{project.client_name}</span>}
            {project.location && <span className="flex items-center gap-1.5"><MapPin size={12} />{project.location}</span>}
          </div>
        </div>
        <button className="flex items-center gap-2 px-3 py-2 border border-white/[0.1] text-[#A19D98] text-xs font-body rounded-[3px] hover:bg-white/[0.03] transition-colors">
          <Edit3 size={12} strokeWidth={1.5} /> Modifica
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/[0.05] mb-6 flex gap-1">
        {[['overview', 'Panoramica'], ['proposals', 'Proposte'], ['moodboards', 'Moodboard'], ['files', 'File']].map(([k, l]) => (
          <TabBtn key={k} active={tab === k} onClick={() => setTab(k)}>{l}</TabBtn>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#141416] border border-white/[0.06] rounded-md p-6">
            <h3 className="text-[#EFEBE4] text-sm font-body font-semibold mb-4">Dettagli progetto</h3>
            <InfoRow icon={User} label="Cliente" value={project.client_name} />
            <InfoRow icon={MapPin} label="Localizzazione" value={project.location} />
            <InfoRow icon={Calendar} label="Inizio" value={project.start_date} />
            <InfoRow icon={Calendar} label="Fine prevista" value={project.end_date} />
            {project.budget && <InfoRow icon={ChevronRight} label="Budget" value={`€${project.budget.toLocaleString('it-IT')}`} />}
            {project.description && (
              <div className="pt-4">
                <p className="text-[#4A4845] text-xs font-body uppercase tracking-[0.1em] mb-2">Note</p>
                <p className="text-[#A19D98] text-sm font-body leading-relaxed">{project.description}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-[#141416] border border-white/[0.06] rounded-md p-4">
              <p className="text-[#4A4845] text-[10px] font-body uppercase tracking-[0.15em] mb-3">Proposte</p>
              <p className="font-heading text-3xl text-[#EFEBE4] font-light">{project._proposals?.length || 0}</p>
              <button onClick={() => navigate('/proposals')} className="mt-3 flex items-center gap-1.5 text-[#D4AF37] text-xs font-body hover:text-[#E2C365] transition-colors">
                <FileText size={12} /> Vedi proposte
              </button>
            </div>
            <div className="bg-[#141416] border border-white/[0.06] rounded-md p-4">
              <p className="text-[#4A4845] text-[10px] font-body uppercase tracking-[0.15em] mb-3">Moodboard</p>
              <p className="font-heading text-3xl text-[#EFEBE4] font-light">{project._moodboards_count || 0}</p>
              <button onClick={() => navigate('/moodboards')} className="mt-3 flex items-center gap-1.5 text-[#D4AF37] text-xs font-body hover:text-[#E2C365] transition-colors">
                <Layers size={12} /> Vedi moodboard
              </button>
            </div>
          </div>
        </div>
      )}

      {tab !== 'overview' && (
        <div className="text-center py-16">
          <p className="text-[#6B6863] font-body text-sm">Sezione in sviluppo</p>
          <p className="text-[#4A4845] font-body text-xs mt-1">Prossimamente disponibile</p>
        </div>
      )}
    </div>
  );
};

export default ProjectDetailPage;
