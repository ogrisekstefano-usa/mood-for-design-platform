import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { formatError } from '../../lib/api';
import { Plus, FolderOpen, MapPin, Calendar, Users } from 'lucide-react';

const STATUS_CONFIG = {
  discovery: { label: 'Discovery', bg: 'bg-blue-500/10', text: 'text-blue-400' },
  design: { label: 'Design', bg: 'bg-purple-500/10', text: 'text-purple-400' },
  execution: { label: 'Esecuzione', bg: 'bg-[#D4AF37]/10', text: 'text-[#D4AF37]' },
  completed: { label: 'Completato', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  on_hold: { label: 'In pausa', bg: 'bg-white/5', text: 'text-[#6B6863]' },
};

const StatusBadge = ({ status }) => {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.discovery;
  return <span className={`text-[11px] font-semibold font-body px-2 py-1 rounded-[3px] ${c.bg} ${c.text}`}>{c.label}</span>;
};

const NewProjectModal = ({ onClose, onSave }) => {
  const [form, setForm] = useState({ name: '', client_name: '', client_email: '', type: '', location: '', budget: '' });
  const [loading, setLoading] = useState(false);
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/projects', { ...form, budget: form.budget ? parseFloat(form.budget) : null });
      onSave();
    } catch (err) { alert(formatError(err)); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#141416] border border-white/[0.08] rounded-md w-full max-w-lg animate-fadeIn">
        <div className="flex items-center justify-between p-6 border-b border-white/[0.06]">
          <h3 className="font-heading text-xl text-[#EFEBE4]">Nuovo Progetto</h3>
          <button onClick={onClose} className="text-[#4A4845] hover:text-[#A19D98] transition-colors text-lg">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[['name', 'Nome Progetto', 'col-span-2'], ['client_name', 'Nome Cliente', ''], ['client_email', 'Email Cliente', ''], ['location', 'Città / Luogo', '']].map(([k, l, cls]) => (
              <div key={k} className={cls}>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B6863] font-body mb-1.5">{l}</label>
                <input type={k === 'client_email' ? 'email' : 'text'} value={form[k]} onChange={set(k)} required={k === 'name'}
                  className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px]" />
              </div>
            ))}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B6863] font-body mb-1.5">Tipo</label>
              <select value={form.type} onChange={set('type')} className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px]">
                <option value="">Seleziona tipo</option>
                {['Residenziale', 'Commerciale', 'Hospitality', 'Ufficio', 'Retail'].map(t => <option key={t} value={t.toLowerCase()}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B6863] font-body mb-1.5">Budget (€)</label>
              <input type="number" placeholder="es. 150000" value={form.budget} onChange={set('budget')}
                className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px]" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-white/[0.1] text-[#A19D98] text-sm font-body rounded-[3px] hover:bg-white/[0.03] transition-colors">Annulla</button>
            <button type="submit" disabled={loading} data-testid="save-project-btn"
              className="flex-1 px-4 py-2.5 bg-[#D4AF37] hover:bg-[#E2C365] text-[#0A0A0B] font-semibold text-sm font-body rounded-[3px] transition-colors disabled:opacity-50">
              {loading ? 'Salvataggio...' : 'Crea Progetto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const COVER_IMGS = [
  'https://images.unsplash.com/photo-1749766878223-6ceae855b28b?w=400&q=70',
  'https://images.unsplash.com/photo-1777604602765-1d5114114891?w=400&q=70',
  'https://images.unsplash.com/photo-1765767056681-9583b29007cf?w=400&q=70',
];

const ProjectCard = ({ project, index, onClick }) => {
  const cover = COVER_IMGS[index % COVER_IMGS.length];
  return (
    <div data-testid={`project-card-${index}`} onClick={() => onClick(project.id)}
      className="bg-[#141416] border border-white/[0.06] rounded-md overflow-hidden cursor-pointer card-hover group">
      <div className="h-36 overflow-hidden relative">
        <img src={cover} alt={project.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#141416] via-transparent to-transparent" />
        <div className="absolute bottom-3 left-3">
          <StatusBadge status={project.status} />
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-heading text-lg text-[#EFEBE4] leading-tight mb-1">{project.name}</h3>
        <p className="text-[#6B6863] text-xs font-body mb-3">{project.client_name || 'Cliente privato'}</p>
        <div className="flex items-center gap-4 text-[10px] text-[#4A4845] font-body">
          {project.location && <span className="flex items-center gap-1"><MapPin size={10} />{project.location}</span>}
          {project.type && <span className="capitalize">{project.type}</span>}
          {project.budget && <span>€{(project.budget/1000).toFixed(0)}k</span>}
        </div>
      </div>
    </div>
  );
};

const STATUS_TABS = [{ key: '', label: 'Tutti' }, { key: 'discovery', label: 'Discovery' }, { key: 'design', label: 'Design' }, { key: 'execution', label: 'Esecuzione' }, { key: 'completed', label: 'Completati' }];

const ProjectsPage = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('');
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const params = tab ? `?status=${tab}` : '';
      const { data } = await api.get(`/api/projects${params}`);
      setProjects(data.data || []);
    } catch { setProjects([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [tab]);

  return (
    <div className="p-8 max-w-7xl mx-auto" data-testid="projects-page">
      {showModal && <NewProjectModal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load(); }} />}

      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[#6B6863] text-[10px] font-body uppercase tracking-[0.2em] mb-1">Blueprint Workspace</p>
          <h1 className="font-heading text-4xl font-light text-[#EFEBE4]">Projects</h1>
          <p className="text-[#4A4845] text-sm font-body mt-1">{projects.length} progetti</p>
        </div>
        <button data-testid="new-project-btn" onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#D4AF37] hover:bg-[#E2C365] text-[#0A0A0B] font-semibold text-xs font-body rounded-[3px] transition-colors">
          <Plus size={14} /> Nuovo Progetto
        </button>
      </div>

      <div className="flex gap-1 bg-[#141416] border border-white/[0.06] rounded-[4px] p-1 mb-6 w-fit">
        {STATUS_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-xs font-body font-medium rounded-[3px] transition-colors ${tab === t.key ? 'bg-[#1C1C1F] text-[#EFEBE4]' : 'text-[#6B6863] hover:text-[#A19D98]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1,2,3].map(i => <div key={i} className="bg-[#141416] border border-white/[0.06] rounded-md h-64 skeleton" />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <FolderOpen size={36} className="text-[#3A3835] mx-auto mb-4" strokeWidth={1} />
          <p className="text-[#6B6863] font-body mb-2">Nessun progetto trovato</p>
          <button onClick={() => setShowModal(true)} className="text-[#D4AF37] text-sm font-body hover:text-[#E2C365] transition-colors">+ Crea il primo progetto</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((p, i) => <ProjectCard key={p.id} project={p} index={i} onClick={id => navigate(`/workspace/projects/${id}`)} />)}
        </div>
      )}
    </div>
  );
};

export default ProjectsPage;
