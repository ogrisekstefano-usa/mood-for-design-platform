import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { ArrowLeft, FileText, Layers, FolderOpen, ChevronRight } from 'lucide-react';

const STATUS_TONES = {
  new: 'bg-blue-500/10 text-blue-400',
  in_review: 'bg-purple-500/10 text-purple-400',
  proposal_sent: 'bg-[var(--bp-primary,#D4AF37)]/10 text-[var(--bp-primary,#D4AF37)]',
  won: 'bg-emerald-500/10 text-emerald-400',
  lost: 'bg-red-500/10 text-red-400',
};

const ProjectDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useBlueprint();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/projects/${id}`).then((r) => setProject(r.data)).catch(() => navigate('/workspace/projects')).finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[var(--bp-primary,#D4AF37)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!project) return null;
  const tone = STATUS_TONES[project.status] || STATUS_TONES.new;

  return (
    <div className="p-8 max-w-5xl mx-auto" data-testid="project-detail">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => navigate('/workspace/projects')} className="text-[#4A4845] hover:text-[#A19D98] flex items-center gap-1.5">
          <ArrowLeft size={14} strokeWidth={1.5} />
          <span className="text-xs font-body">{t('common.back')}</span>
        </button>
        <ChevronRight size={12} className="text-[#3A3835]" />
        <span className="text-[#6B6863] text-xs font-body">{project.title}</span>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="font-heading text-4xl font-light text-[#EFEBE4]">{project.title}</h1>
            <span className={`text-[11px] font-semibold font-body px-2 py-1 rounded-[3px] ${tone}`}>{t(`projects.status.${project.status}`)}</span>
          </div>
          {project.description && <p className="text-[#A19D98] text-sm font-body max-w-2xl">{project.description}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#141416] border border-white/[0.06] rounded-md p-6 space-y-3">
          <h3 className="text-[#EFEBE4] text-sm font-body font-semibold mb-3">{t('common.actions')}</h3>
          {[['projects.field.projectType', project.project_type], ['projects.field.budget', project.budget_range],
            ['projects.field.timeline', project.timeline], ['projects.field.priority', project.priority]].map(([lk, v]) => (
            <div key={lk} className="flex justify-between py-2 border-b border-white/[0.04]">
              <span className="text-[#4A4845] text-xs font-body">{t(lk)}</span>
              <span className="text-[#EFEBE4] text-sm font-body">{v || '—'}</span>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="bg-[#141416] border border-white/[0.06] rounded-md p-4">
            <p className="text-[#4A4845] text-[10px] font-body uppercase tracking-[0.15em] mb-3">{t('nav.proposals')}</p>
            <p className="font-heading text-3xl text-[#EFEBE4] font-light">{project.proposals?.length || 0}</p>
            <button onClick={() => navigate('/workspace/proposals')} className="mt-3 flex items-center gap-1.5 text-[var(--bp-primary,#D4AF37)] text-xs font-body hover:opacity-80">
              <FileText size={12} /> {t('common.actions')}
            </button>
          </div>
          <div className="bg-[#141416] border border-white/[0.06] rounded-md p-4">
            <p className="text-[#4A4845] text-[10px] font-body uppercase tracking-[0.15em] mb-3">{t('nav.moodboards')}</p>
            <p className="font-heading text-3xl text-[#EFEBE4] font-light">{project.moodboards?.length || 0}</p>
            <button onClick={() => navigate('/moodboards')} className="mt-3 flex items-center gap-1.5 text-[var(--bp-primary,#D4AF37)] text-xs font-body hover:opacity-80">
              <Layers size={12} /> {t('common.actions')}
            </button>
          </div>
          <div className="bg-[#141416] border border-white/[0.06] rounded-md p-4">
            <p className="text-[#4A4845] text-[10px] font-body uppercase tracking-[0.15em] mb-3">Files</p>
            <p className="font-heading text-3xl text-[#EFEBE4] font-light">{project.files_count || 0}</p>
            <FolderOpen size={14} strokeWidth={1.5} className="mt-3 text-[var(--bp-primary,#D4AF37)]" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailPage;
