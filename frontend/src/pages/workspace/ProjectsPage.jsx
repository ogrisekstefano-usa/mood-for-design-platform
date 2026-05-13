/**
 * ProjectsPage — list + create.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api, { formatError } from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { Plus, FolderOpen, MapPin } from 'lucide-react';

const STATUS_TONES = {
  new: 'bg-blue-500/10 text-blue-400',
  in_review: 'bg-purple-500/10 text-purple-400',
  brief_completed: 'bg-purple-500/10 text-purple-400',
  proposal_in_progress: 'bg-[var(--bp-primary,#D4AF37)]/10 text-[var(--bp-primary,#D4AF37)]',
  proposal_sent: 'bg-[var(--bp-primary,#D4AF37)]/10 text-[var(--bp-primary,#D4AF37)]',
  approved: 'bg-emerald-500/10 text-emerald-400',
  won: 'bg-emerald-500/10 text-emerald-400',
  rejected: 'bg-red-500/10 text-red-400',
  lost: 'bg-red-500/10 text-red-400',
  archived: 'bg-white/5 text-[#6B6863]',
};

const NewProjectModal = ({ onClose, onSaved }) => {
  const { t, locale } = useBlueprint();
  const [form, setForm] = useState({ title: '', description: '', project_type: '', priority: 'normal', budget_range: '', timeline: '', language: locale });
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/projects', form);
      onSaved();
    } catch (err) { alert(formatError(err)); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-testid="new-project-modal">
      <div className="bg-[#141416] border border-white/[0.08] rounded-md w-full max-w-lg animate-fadeIn">
        <div className="flex items-center justify-between p-6 border-b border-white/[0.06]">
          <h3 className="font-heading text-xl text-[#EFEBE4]">{t('projects.newProject')}</h3>
          <button onClick={onClose} className="text-[#4A4845] hover:text-[#A19D98] text-lg">×</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B6863] font-body mb-1.5">{t('projects.field.title')}</label>
            <input required value={form.title} onChange={set('title')} className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px]" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[['project_type', 'projects.field.projectType'], ['budget_range', 'projects.field.budget'], ['timeline', 'projects.field.timeline'], ['priority', 'projects.field.priority']].map(([k, lk]) => (
              <div key={k}>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B6863] font-body mb-1.5">{t(lk)}</label>
                <input value={form[k]} onChange={set(k)} className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px]" />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B6863] font-body mb-1.5">{t('projects.field.description')}</label>
            <textarea rows={3} value={form.description} onChange={set('description')} className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px] resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-white/[0.1] text-[#A19D98] text-sm font-body rounded-[3px]">{t('common.cancel')}</button>
            <button data-testid="save-project-btn" type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-[var(--bp-primary,#D4AF37)] hover:opacity-90 text-[#0A0A0B] font-semibold text-sm font-body rounded-[3px] disabled:opacity-50">
              {loading ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ProjectCard = ({ project, index }) => {
  const { t } = useBlueprint();
  return (
    <Link to={`/workspace/projects/${project.id}`}
          data-testid={`project-card-${index}`}
          className="block bg-[#141416] border border-white/[0.06] rounded-md p-5 cursor-pointer card-hover group hover:border-white/[0.12] transition-colors">
      <div className="flex items-start justify-between mb-3">
        <FolderOpen size={18} strokeWidth={1.5} className="text-[var(--bp-primary,#D4AF37)]" />
        <span className={`text-[10px] font-semibold font-body px-2 py-0.5 rounded-[3px] ${STATUS_TONES[project.status] || STATUS_TONES.new}`}>
          {t(`projects.status.${project.status}`)}
        </span>
      </div>
      <h3 className="font-heading text-xl text-[#EFEBE4] leading-tight mb-2">{project.title}</h3>
      {project.description && <p className="text-[#6B6863] text-xs font-body line-clamp-2 mb-3">{project.description}</p>}
      <div className="flex items-center gap-4 text-[10px] text-[#4A4845] font-body">
        {project.project_type && <span className="capitalize">{project.project_type}</span>}
        {project.budget_range && <span>{project.budget_range}</span>}
        {project.timeline && <span className="flex items-center gap-1"><MapPin size={10} />{project.timeline}</span>}
      </div>
    </Link>
  );
};

const ProjectsPage = () => {
  const { t } = useBlueprint();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('');
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = tab ? `?status=${tab}` : '';
      const { data } = await api.get(`/api/projects${params}`);
      setProjects(data.data || []);
    } catch { setProjects([]); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const tabs = ['', 'new', 'in_review', 'proposal_sent', 'won', 'archived'];

  return (
    <div className="p-8 max-w-7xl mx-auto" data-testid="projects-page">
      {showModal && <NewProjectModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[#6B6863] text-[10px] font-body uppercase tracking-[0.2em] mb-1">{t('nav.section.workspace')}</p>
          <h1 className="font-heading text-4xl font-light text-[#EFEBE4]">{t('projects.title')}</h1>
          <p className="text-[#4A4845] text-sm font-body mt-1">{t('projects.count', { n: projects.length })}</p>
        </div>
        <button data-testid="new-project-btn" onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--bp-primary,#D4AF37)] hover:opacity-90 text-[#0A0A0B] font-semibold text-xs font-body rounded-[3px]">
          <Plus size={14} /> {t('projects.newProject')}
        </button>
      </div>

      <div className="flex gap-1 bg-[#141416] border border-white/[0.06] rounded-[4px] p-1 mb-6 w-fit flex-wrap">
        {tabs.map((tk) => (
          <button key={tk || 'all'} data-testid={`tab-${tk || 'all'}`} onClick={() => setTab(tk)}
            className={`px-3 py-1.5 text-xs font-body font-medium rounded-[3px] ${tab === tk ? 'bg-[#1C1C1F] text-[#EFEBE4]' : 'text-[#6B6863] hover:text-[#A19D98]'}`}>
            {tk ? t(`projects.status.${tk}`) : t('common.all')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1,2,3].map(i => <div key={i} className="h-44 skeleton rounded-md" />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <FolderOpen size={36} className="text-[#3A3835] mx-auto mb-4" strokeWidth={1} />
          <p className="text-[#6B6863] font-body mb-2">{t('projects.empty')}</p>
          <button onClick={() => setShowModal(true)} className="text-[var(--bp-primary,#D4AF37)] text-sm font-body hover:opacity-80">+ {t('projects.emptyCta')}</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((p, i) => <ProjectCard key={p.id} project={p} index={i} />)}
        </div>
      )}
    </div>
  );
};

export default ProjectsPage;
