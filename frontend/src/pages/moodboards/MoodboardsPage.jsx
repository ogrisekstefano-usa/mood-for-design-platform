/**
 * MoodboardsPage — luxury list of all moodboards across projects. Plan-aware.
 * Pure Blueprint-driven (i18n via t(), tokens via CSS vars).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { useLicense, refreshLicense } from '../../hooks/useLicense';
import UsageChip from '../../components/common/UsageChip';
import { toast } from 'sonner';
import { Plus, Layers, X, Lock } from 'lucide-react';
import StatusBadge from '../../components/common/StatusBadge';
import TemplatePicker from '../../blueprint/moodboard/TemplatePicker';

const CreateModal = ({ projects, onClose, onCreate, t }) => {
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [templateId, setTemplateId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError(t('moodboards.create.titleRequired'));
      return;
    }
    setSubmitting(true);
    try {
      await onCreate({ title: title.trim(), project_id: projectId || null, template_id: templateId });
    } catch (err) {
      // Surface backend / network failures instead of silently stopping the spinner.
      const detail = err?.response?.data?.detail;
      const msg = err?.code === 'ECONNABORTED'
        ? t('moodboards.create.timeout')
        : (typeof detail === 'string' ? detail : err?.message) || t('moodboards.create.failed');
      setError(msg);
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bp-overlay)] backdrop-blur-sm flex items-center justify-center p-4"
         onClick={onClose} data-testid="moodboard-create-modal">
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit}
            className="bp-glass w-full max-w-4xl p-7 rounded-[var(--bp-radius-md)] max-h-[88vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="bp-eyebrow !text-[var(--bp-text-muted)] mb-1">{t('moodboards.tab.title')}</p>
            <h3 className="bp-h2 text-[var(--bp-text-primary)]">{t('moodboards.create.title')}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-7 mb-6">
          <div>
            <label className="block mb-4">
              <span className="bp-eyebrow !text-[10px] !text-[var(--bp-text-muted)] block mb-1.5">{t('moodboards.create.titleLabel')}</span>
              <input autoFocus value={title}
                     onChange={(e) => { setTitle(e.target.value); if (error) setError(null); }}
                     data-testid="moodboard-title-input"
                     placeholder={t('moodboards.create.titlePh')}
                     className={`input-luxury w-full px-3 py-2.5 text-sm rounded-[var(--bp-radius-sm)] ${error && !title.trim() ? 'ring-1 ring-red-400/60' : ''}`} />
              {error && (
                <p data-testid="moodboard-create-error"
                   className="bp-caption !text-[10px] !text-red-400 mt-1.5 leading-snug">
                  {error}
                </p>
              )}
            </label>
            <label className="block">
              <span className="bp-eyebrow !text-[10px] !text-[var(--bp-text-muted)] block mb-1.5">{t('moodboards.create.projectLabel')}</span>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
                      data-testid="moodboard-project-select"
                      className="input-luxury w-full px-3 py-2.5 text-sm rounded-[var(--bp-radius-sm)]">
                <option value="">{t('moodboards.create.projectPh')}</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </label>
          </div>
          <TemplatePicker value={templateId} onChange={setTemplateId} />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="bp-btn bp-btn-ghost text-xs">
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={submitting}
                  data-testid="moodboard-create-submit"
                  className="bp-btn bp-btn-primary text-xs disabled:opacity-50">
            {submitting ? t('common.loading') : t('moodboards.create.submit')}
          </button>
        </div>
      </form>
    </div>
  );
};

const MoodboardsPage = () => {
  const { t } = useBlueprint();
  const navigate = useNavigate();
  const { capacityFor, license } = useLicense();
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState('');

  const cap = capacityFor('moodboards');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mbR, prR] = await Promise.all([
        api.get('/api/moodboards'),
        api.get('/api/projects'),
      ]);
      setItems(mbR.data?.data || []);
      setProjects(prR.data?.data || []);
    } catch (_) { /* ignore */ }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleCreate = async ({ title, project_id, template_id }) => {
    try {
      // Template apply clones N pages + M blocks server-side and can blow past
      // the 30s default axios timeout for rich templates. Use a 90s window for
      // this specific call so the user never sees a phantom timeout.
      const r = template_id
        ? await api.post(`/api/templates/${template_id}/apply`, { title, project_id }, { timeout: 90000 })
        : await api.post('/api/moodboards', { title, project_id });
      refreshLicense();
      setShowCreate(false);
      navigate(`/moodboards/${r.data.id}`);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (detail && typeof detail === 'object' && detail.code === 'LICENSE_LIMIT_REACHED') {
        toast.error(`Moodboard limit reached (${detail.current}/${detail.limit}). Upgrade your ${detail.plan} plan.`);
        setShowCreate(false);
        navigate('/settings/plan');
        return;
      }
      throw err;
    }
  };

  const onCta = () => {
    if (cap.atCap) navigate('/settings/plan');
    else setShowCreate(true);
  };

  const filtered = filter ? items.filter((m) => (m.status || 'draft') === filter) : items;
  const filters = ['', 'draft', 'sent', 'viewed', 'approved', 'revision_requested', 'rejected'];

  return (
    <div className="p-10 max-w-7xl mx-auto" data-testid="moodboards-page">
      <div className="flex items-start justify-between mb-10 gap-6">
        <div>
          <p className="bp-eyebrow !text-[var(--bp-text-muted)] mb-2">{t('nav.section.content')}</p>
          <h1 className="bp-h1 text-[var(--bp-text-primary)] font-light">{t('moodboards.title')}</h1>
          <p className="bp-body !text-sm text-[var(--bp-text-muted)] mt-2 max-w-md">{t('moodboards.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {license && (
            <UsageChip label="Moodboards" current={cap.current} limit={cap.limit}
                       unlimited={cap.unlimited} atCap={cap.atCap} nearCap={cap.nearCap}
                       testid="moodboards-usage-chip" />
          )}
          <button onClick={onCta}
                  data-testid="new-moodboard-btn"
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-body uppercase tracking-[0.18em] rounded-[var(--bp-radius-sm)] transition-all
                    ${cap.atCap
                      ? 'bg-[var(--bp-surface-2)] border border-[var(--bp-border)] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] hover:border-[var(--bp-border-strong)]'
                      : 'bp-btn bp-btn-primary !uppercase !tracking-[0.18em]'}`}>
            {cap.atCap
              ? (<><Lock size={11} strokeWidth={1.8} /> Upgrade to create more</>)
              : (<><Plus size={13} strokeWidth={1.5} /> {t('moodboards.new')}</>)}
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[var(--bp-radius-sm)] p-1 mb-8 w-fit">
        {filters.map((f) => (
          <button key={f || 'all'} onClick={() => setFilter(f)}
                  data-testid={`filter-${f || 'all'}`}
                  className={`px-3 py-1.5 text-xs font-body rounded-[var(--bp-radius-xs)] transition-colors ${
                    filter === f
                      ? 'bg-[var(--bp-surface-2)] text-[var(--bp-text-primary)]'
                      : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-secondary)]'
                  }`}>
            {t(`moodboards.filter.${f || 'all'}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <div className="w-5 h-5 border-2 border-[var(--bp-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24" data-testid="moodboards-empty">
          <Layers size={36} className="text-[var(--bp-text-subtle)] mx-auto mb-5" strokeWidth={1} />
          <p className="bp-body text-[var(--bp-text-muted)] mb-4">{t('moodboards.empty')}</p>
          <button onClick={onCta} className="bp-btn bp-btn-ghost text-xs">
            {cap.atCap
              ? (<><Lock size={11} strokeWidth={1.5} /> Upgrade plan to create moodboards</>)
              : (<><Plus size={12} strokeWidth={1.5} /> {t('moodboards.emptyCta')}</>)}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((m) => {
            const project = projects.find((p) => p.id === m.project_id);
            return (
              <Link key={m.id} to={`/moodboards/${m.id}`}
                    data-testid={`moodboard-card-${m.id}`}
                    className="group block bg-[var(--bp-surface-1)] border border-[var(--bp-border)] hover:border-[var(--bp-border-strong)] rounded-[var(--bp-radius-md)] overflow-hidden transition-colors">
                <div className="aspect-[4/3] bg-[var(--bp-surface-2)] relative overflow-hidden">
                  <div className="absolute inset-0 bg-[var(--bp-hero-gradient)] opacity-60" />
                  <Layers size={42} strokeWidth={0.75}
                          className="text-[var(--bp-text-subtle)] absolute inset-0 m-auto group-hover:scale-110 transition-transform duration-[var(--bp-duration-cinematic)]" />
                  <div className="absolute top-3 right-3">
                    <StatusBadge status={m.status} t={t} />
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="bp-h3 text-[var(--bp-text-primary)] truncate">
                    {m.title || t('moodboards.untitled')}
                  </h3>
                  {project && (
                    <p className="bp-caption text-[var(--bp-text-muted)] mt-1.5 truncate">
                      {project.title}
                    </p>
                  )}
                  {m.updated_at && (
                    <p className="bp-caption !text-[10px] text-[var(--bp-text-subtle)] mt-3">
                      {new Date(m.updated_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateModal projects={projects} t={t}
                     onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      )}
    </div>
  );
};

export default MoodboardsPage;
