/**
 * ProjectsPage — list + create. Plan-aware.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api, { formatError } from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { useLocaleRuntime } from '../../contexts/LocaleRuntimeContext';
import { useLicense, refreshLicense } from '../../hooks/useLicense';
import UsageChip from '../../components/common/UsageChip';
import { toast } from 'sonner';
import { Plus, FolderOpen, MapPin, Lock } from 'lucide-react';

const STATUS_TONES = {
  new: 'bg-blue-500/10 text-blue-400',
  in_review: 'bg-purple-500/10 text-purple-400',
  brief_completed: 'bg-purple-500/10 text-purple-400',
  proposal_in_progress: 'bg-[var(--bp-primary)]/10 text-[var(--bp-primary)]',
  proposal_sent: 'bg-[var(--bp-primary)]/10 text-[var(--bp-primary)]',
  approved: 'bg-emerald-500/10 text-emerald-400',
  won: 'bg-emerald-500/10 text-emerald-400',
  rejected: 'bg-red-500/10 text-red-400',
  lost: 'bg-red-500/10 text-red-400',
  archived: 'bg-white/5 text-[var(--bp-text-muted)]',
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
      refreshLicense();
      onSaved();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (detail && typeof detail === 'object' && detail.code === 'LICENSE_LIMIT_REACHED') {
        toast.error(`Project limit reached (${detail.current}/${detail.limit}). Upgrade your ${detail.plan} plan to add more.`);
      } else {
        toast.error(formatError(err));
      }
    }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-testid="new-project-modal">
      <div className="bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-md w-full max-w-lg animate-fadeIn">
        <div className="flex items-center justify-between p-6 border-b border-[var(--bp-border)]">
          <h3 className="font-heading text-xl text-[var(--bp-text-primary)]">{t('projects.newProject')}</h3>
          <button onClick={onClose} className="text-[var(--bp-text-subtle)] hover:text-[var(--bp-text-secondary)] text-lg">×</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--bp-text-muted)] font-body mb-1.5">{t('projects.field.title')}</label>
            <input required value={form.title} onChange={set('title')} className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px]" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[['project_type', 'projects.field.projectType'], ['budget_range', 'projects.field.budget'], ['timeline', 'projects.field.timeline'], ['priority', 'projects.field.priority']].map(([k, lk]) => (
              <div key={k}>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--bp-text-muted)] font-body mb-1.5">{t(lk)}</label>
                <input value={form[k]} onChange={set(k)} className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px]" />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--bp-text-muted)] font-body mb-1.5">{t('projects.field.description')}</label>
            <textarea rows={3} value={form.description} onChange={set('description')} className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px] resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-[var(--bp-border-strong)] text-[var(--bp-text-secondary)] text-sm font-body rounded-[3px]">{t('common.cancel')}</button>
            <button data-testid="save-project-btn" type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-[var(--bp-primary)] hover:opacity-90 text-[var(--bp-bg)] font-semibold text-sm font-body rounded-[3px] disabled:opacity-50">
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
          className="block bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-md p-5 cursor-pointer card-hover group hover:border-[var(--bp-border-strong)] transition-colors">
      <div className="flex items-start justify-between mb-3">
        <FolderOpen size={18} strokeWidth={1.5} className="text-[var(--bp-primary)]" />
        <span className={`text-[10px] font-semibold font-body px-2 py-0.5 rounded-[3px] ${STATUS_TONES[project.status] || STATUS_TONES.new}`}>
          {t(`projects.status.${project.status}`)}
        </span>
      </div>
      <h3 className="font-heading text-xl text-[var(--bp-text-primary)] leading-tight mb-2">{project.title}</h3>
      {project.description && <p className="text-[var(--bp-text-muted)] text-xs font-body line-clamp-2 mb-3">{project.description}</p>}
      <div className="flex items-center gap-4 text-[10px] text-[var(--bp-text-subtle)] font-body">
        {project.project_type && <span className="capitalize">{project.project_type}</span>}
        {project.budget_range && <span>{project.budget_range}</span>}
        {project.timeline && <span className="flex items-center gap-1"><MapPin size={10} />{project.timeline}</span>}
      </div>
    </Link>
  );
};

const ProjectsPage = () => {
  const { t } = useBlueprint();
  const runtime = useLocaleRuntime();
  const navigate = useNavigate();
  const { capacityFor, license } = useLicense();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('');
  const [showModal, setShowModal] = useState(false);

  const cap = capacityFor('projects');

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

  const onCta = () => {
    if (cap.atCap) navigate('/settings/plan');
    else setShowModal(true);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto" data-testid="projects-page">
      {showModal && <NewProjectModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />}
      <div className="flex items-start justify-between mb-8 gap-6">
        <div>
          <p className="text-[var(--bp-text-muted)] text-[10px] font-body uppercase tracking-[0.2em] mb-1"
             data-testid="projects-page-eyebrow">
            {runtime.copy('projects.page.eyebrow')}
          </p>
          <h1 className="font-heading text-4xl font-light text-[var(--bp-text-primary)]"
              data-testid="projects-page-title">
            {runtime.copy('projects.page.title')}
          </h1>
          <p className="text-[var(--bp-text-subtle)] text-sm font-body mt-1">{t('projects.count', { n: projects.length })}</p>
        </div>
        <div className="flex items-center gap-3">
          {license && (
            <UsageChip label="Projects" current={cap.current} limit={cap.limit}
                       unlimited={cap.unlimited} atCap={cap.atCap} nearCap={cap.nearCap}
                       testid="projects-usage-chip" />
          )}
          <button data-testid="new-project-btn" onClick={onCta}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-body font-semibold rounded-[3px] transition-all
              ${cap.atCap
                ? 'bg-[var(--bp-surface-2)] border border-[var(--bp-border)] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] hover:border-[var(--bp-border-strong)]'
                : 'bg-[var(--bp-primary)] hover:opacity-90 text-[var(--bp-bg)]'}`}>
            {cap.atCap
              ? (<><Lock size={12} strokeWidth={1.8} /> Upgrade to create more</>)
              : (<><Plus size={14} /> {runtime.copy('projects.new.cta')}</>)}
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[4px] p-1 mb-6 w-fit flex-wrap">
        {tabs.map((tk) => (
          <button key={tk || 'all'} data-testid={`tab-${tk || 'all'}`} onClick={() => setTab(tk)}
            className={`px-3 py-1.5 text-xs font-body font-medium rounded-[3px] ${tab === tk ? 'bg-[var(--bp-surface-2)] text-[var(--bp-text-primary)]' : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-secondary)]'}`}>
            {tk ? t(`projects.status.${tk}`) : t('common.all')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1,2,3].map(i => <div key={i} className="h-44 skeleton rounded-md" />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20" data-testid="projects-empty"
             data-locale-code={runtime.localeCode}>
          <FolderOpen size={36} className="text-[var(--bp-text-subtle)] mx-auto mb-4" strokeWidth={1} />
          <h3 className="font-heading text-[20px] font-light text-[var(--bp-text-primary)] mb-2"
              data-testid="projects-empty-title">
            {runtime.copy('projects.empty.title')}
          </h3>
          <p className="text-[var(--bp-text-muted)] font-body mb-5 max-w-md mx-auto leading-relaxed"
             data-testid="projects-empty-subtitle">
            {runtime.copy('projects.empty.subtitle')}
          </p>
          <button onClick={onCta}
                  data-testid="projects-empty-cta"
                  className="text-[var(--bp-primary)] text-sm font-body hover:opacity-80
                             inline-flex items-center gap-1.5">
            {cap.atCap ? 'Upgrade plan to create projects' : `+ ${runtime.copy('projects.empty.cta')}`}
          </button>
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
