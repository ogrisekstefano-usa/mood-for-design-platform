/**
 * FormBuilderPage — tenant-facing form management.
 *
 * Two views:
 *   - LIST: forms catalog, create / duplicate / delete / publish
 *   - EDIT: full form schema editor (steps + fields + settings) with live preview
 *
 * Schema-driven via the field registry. ZERO hardcoded UI.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { formatError } from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import FormRenderer from '../../blueprint/forms/FormRenderer';
import {
  Plus, Trash2, Copy, Save, RotateCcw, Check, ChevronUp, ChevronDown, X,
  Pencil, ExternalLink, ArrowLeft, GripVertical,
} from 'lucide-react';

const StatusBadge = ({ status }) => (
  <span className={`bp-eyebrow !text-[10px] px-2 py-1 rounded-[var(--bp-radius-xs)] ${
    status === 'published' ? 'bg-[var(--bp-primary)]/10 !text-[var(--bp-primary)]' : 'bg-[var(--bp-surface-2)] !text-[var(--bp-text-muted)]'
  }`}>{status || 'draft'}</span>
);

// ────────────────────────────────────────────────────────────────────────────
// List view
// ────────────────────────────────────────────────────────────────────────────
const FormsListView = ({ onOpen, onCreate }) => {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const r = await api.get('/api/forms');
    setForms(r.data.data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    const slug = prompt('Form slug (lowercase, dashes):', `form-${Date.now().toString(36)}`);
    if (!slug) return;
    await api.put(`/api/forms/${slug}`, { title: {_default: slug}, status: 'draft' });
    onOpen(slug);
  };

  const handleDuplicate = async (slug) => {
    const r = await api.post(`/api/forms/${slug}/duplicate`, {});
    load();
    onOpen(r.data.slug);
  };

  const handleDelete = async (slug) => {
    if (!window.confirm(`Delete form "${slug}"?`)) return;
    await api.delete(`/api/forms/${slug}`);
    load();
  };

  return (
    <div className="p-10 w-full" data-testid="forms-list-view">
      <div className="flex items-start justify-between mb-10">
        <div>
          <p className="bp-eyebrow">Blueprint Form Engine™</p>
          <h1 className="bp-h1 mt-2">Forms</h1>
          <p className="bp-body text-[var(--bp-text-muted)] mt-3 max-w-md">
            Compose dynamic forms for leads, onboarding, approvals, surveys and concierge requests.
          </p>
        </div>
        <button onClick={handleCreate} className="bp-btn bp-btn-primary" data-testid="create-form-btn">
          <Plus size={14} strokeWidth={1.5} /> New form
        </button>
      </div>

      {loading ? (
        <p className="bp-caption text-[var(--bp-text-muted)]">Loading…</p>
      ) : forms.length === 0 ? (
        <div className="border border-dashed border-[var(--bp-border-strong)] rounded-[var(--bp-radius-md)] p-16 text-center">
          <p className="bp-body text-[var(--bp-text-muted)]">No forms yet.</p>
          <button onClick={handleCreate} className="bp-btn bp-btn-ghost mt-6">
            <Plus size={14} strokeWidth={1.5} /> Create your first form
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {forms.map((f) => (
            <div key={f.slug} data-testid={`form-row-${f.slug}`}
              className="bg-[var(--bp-surface-1)] border border-[var(--bp-border)] hover:border-[var(--bp-border-strong)] rounded-[var(--bp-radius-md)] p-5 flex items-center gap-6 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="bp-h3 text-[var(--bp-text-primary)] truncate">{f.title?._default || f.slug}</h3>
                  <StatusBadge status={f.status} />
                </div>
                <p className="bp-caption text-[var(--bp-text-muted)]">
                  /{f.slug} · {f.purpose || 'design_request'} · {f.steps} step{f.steps !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => onOpen(f.slug)} className="bp-btn bp-btn-ghost text-xs" data-testid={`open-${f.slug}`}>
                  <Pencil size={12} strokeWidth={1.5} /> Edit
                </button>
                <button onClick={() => handleDuplicate(f.slug)} className="p-2 text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]">
                  <Copy size={13} strokeWidth={1.5} />
                </button>
                <button onClick={() => handleDelete(f.slug)} className="p-2 text-[var(--bp-text-muted)] hover:text-red-400">
                  <Trash2 size={13} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Edit view
// ────────────────────────────────────────────────────────────────────────────
const FormEditView = ({ slug, onBack }) => {
  const { tenant, availableLocales } = useBlueprint();
  const [form, setForm] = useState(null);
  const [registry, setRegistry] = useState(null);
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [locale, setLocale] = useState('_default');
  const [view, setView] = useState('build'); // build | preview
  const [error, setError] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/api/forms/${slug}`),
      api.get('/api/forms/registry'),
    ]).then(([f, r]) => { setForm(f.data); setRegistry(r.data); });
  }, [slug]);

  const setI18n = (path, val) => {
    setForm((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let o = next;
      for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]] = o[keys[i]] || {};
      const existing = o[keys[keys.length - 1]] || {};
      o[keys[keys.length - 1]] = { ...existing, [locale]: val, _default: existing._default ?? val };
      return next;
    });
    setDirty(true);
  };

  const update = (mut) => { setForm(mut); setDirty(true); };

  const save = async () => {
    setSaving(true); setError('');
    try {
      const r = await api.put(`/api/forms/${form.slug}`, {
        title: form.title, description: form.description,
        purpose: form.purpose, status: form.status,
        layout: form.layout, atmosphere: form.atmosphere,
        settings: form.settings, ai: form.ai,
        scoring: form.scoring, integrations: form.integrations,
        steps: form.steps,
      });
      setForm(r.data);
      setDirty(false); setSavedAt(Date.now());
    } catch (e) { setError(formatError(e)); }
    finally { setSaving(false); }
  };

  const reset = async () => {
    if (!window.confirm('Reset to default template?')) return;
    const r = await api.post(`/api/forms/${slug}/reset`);
    setForm(r.data); setDirty(false); setActiveStepIdx(0);
  };

  const togglePublish = () => {
    update((p) => ({ ...p, status: p.status === 'published' ? 'draft' : 'published' }));
  };

  // Step ops
  const addStep = () => {
    update((p) => ({ ...p,
      steps: [...(p.steps || []), { id: `tmp-${Date.now()}`, title: {_default: 'New step'}, fields: [] }]
    }));
  };
  const deleteStep = (i) => update((p) => ({ ...p, steps: p.steps.filter((_, idx) => idx !== i) }));
  const moveStep = (i, dir) => update((p) => {
    const arr = [...p.steps]; const j = i + dir;
    if (j < 0 || j >= arr.length) return p;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    return { ...p, steps: arr };
  });

  // Field ops
  const updateField = (sIdx, fIdx, key, val) => update((p) => ({
    ...p,
    steps: p.steps.map((s, si) => si !== sIdx ? s : {
      ...s, fields: s.fields.map((f, fi) => fi !== fIdx ? f : { ...f, [key]: val }),
    }),
  }));
  const updateFieldI18n = (sIdx, fIdx, key, val) => update((p) => ({
    ...p,
    steps: p.steps.map((s, si) => si !== sIdx ? s : {
      ...s, fields: s.fields.map((f, fi) => fi !== fIdx ? f : {
        ...f, [key]: { ...(f[key] || {}), [locale]: val, _default: f[key]?._default ?? val },
      }),
    }),
  }));
  const deleteField = (sIdx, fIdx) => update((p) => ({
    ...p,
    steps: p.steps.map((s, si) => si !== sIdx ? s : { ...s, fields: s.fields.filter((_, fi) => fi !== fIdx) }),
  }));
  const addField = (sIdx, type) => update((p) => ({
    ...p,
    steps: p.steps.map((s, si) => si !== sIdx ? s : {
      ...s, fields: [...(s.fields || []), {
        id: `tmp-${Date.now()}`, type, key: `field_${Date.now()}`,
        label: { _default: 'New field' }, required: false,
      }],
    }),
  }));

  const publicUrl = useMemo(() => {
    return tenant?.slug && form?.slug ? `/f/${tenant.slug}/${form.slug}` : null;
  }, [tenant, form]);

  if (!form || !registry) return <div className="p-10 text-[var(--bp-text-muted)]">Loading…</div>;
  const activeStep = form.steps?.[activeStepIdx];

  return (
    <div className="flex flex-col h-full" data-testid="form-edit-view">
      <header className="flex items-center justify-between gap-4 px-6 h-14 border-b border-[var(--bp-border)] bg-[var(--bp-surface-1)]/60 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="bp-caption text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]" data-testid="back-to-forms">
            ← Forms
          </button>
          <div className="w-px h-5 bg-[var(--bp-border)]" />
          <span className="bp-eyebrow">/f/{tenant?.slug}/{form.slug}</span>
          <StatusBadge status={form.status} />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-[var(--bp-surface-2)] rounded-[var(--bp-radius-sm)] p-0.5">
            <button onClick={() => setView('build')} className={`px-3 py-1 text-xs rounded-[var(--bp-radius-xs)] ${view === 'build' ? 'bg-[var(--bp-surface-3)] text-[var(--bp-text-primary)]' : 'text-[var(--bp-text-muted)]'}`} data-testid="view-build">Build</button>
            <button onClick={() => setView('preview')} className={`px-3 py-1 text-xs rounded-[var(--bp-radius-xs)] ${view === 'preview' ? 'bg-[var(--bp-surface-3)] text-[var(--bp-text-primary)]' : 'text-[var(--bp-text-muted)]'}`} data-testid="view-preview">Preview</button>
          </div>
          <select value={locale} onChange={(e) => setLocale(e.target.value)} data-testid="locale-select"
            className="input-luxury px-2 py-1.5 text-xs font-mono rounded-[var(--bp-radius-sm)]">
            <option value="_default">_default</option>
            {availableLocales.map((l) => <option key={l.code} value={l.code}>{l.code}</option>)}
          </select>
          <button onClick={togglePublish} className={`bp-btn text-xs ${form.status === 'published' ? 'bp-btn-primary' : 'bp-btn-ghost'}`} data-testid="publish-toggle">
            {form.status === 'published' ? 'Published' : 'Publish'}
          </button>
          {publicUrl && form.status === 'published' && (
            <a href={publicUrl} target="_blank" rel="noreferrer" className="bp-btn bp-btn-ghost text-xs" data-testid="visit-form-link">
              <ExternalLink size={12} strokeWidth={1.5} />
            </a>
          )}
          <button onClick={reset} className="bp-btn bp-btn-ghost text-xs" data-testid="reset-form-btn">
            <RotateCcw size={12} strokeWidth={1.5} /> Reset
          </button>
          <button onClick={save} disabled={!dirty || saving} data-testid="save-form-btn"
            className={`bp-btn ${dirty ? 'bp-btn-primary' : 'bp-btn-ghost opacity-50 cursor-not-allowed'} text-xs`}>
            {saving ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"/> :
              savedAt && !dirty ? <Check size={12} strokeWidth={1.5} /> : <Save size={12} strokeWidth={1.5} />}
            {saving ? 'Saving' : savedAt && !dirty ? 'Saved' : 'Save'}
          </button>
        </div>
      </header>

      {error && <div className="px-6 py-2 bg-red-500/10 border-b border-red-500/20 text-red-300 bp-caption">{error}</div>}

      {view === 'preview' ? (
        <div className="flex-1 overflow-auto">
          <FormRenderer form={form} locale={locale === '_default' ? 'en-US' : locale} onSubmit={() => Promise.resolve()} />
        </div>
      ) : (
        <div className="flex flex-1 min-h-0">
          {/* LEFT — steps stack */}
          <aside className="w-[280px] flex-shrink-0 border-r border-[var(--bp-border)] bg-[var(--bp-surface-1)]/40 flex flex-col">
            <div className="flex items-center justify-between px-5 h-12 border-b border-[var(--bp-border)]">
              <span className="bp-eyebrow">Steps</span>
              <button onClick={addStep} className="bp-btn bp-btn-ghost text-xs" data-testid="add-step-btn">
                <Plus size={12} strokeWidth={1.5} />
              </button>
            </div>
            <div className="overflow-y-auto p-3 space-y-1.5">
              {(form.steps || []).map((s, i) => (
                <div key={s.id} data-testid={`step-row-${i}`}
                  className={`border rounded-[var(--bp-radius-sm)] ${activeStepIdx === i ? 'border-[var(--bp-primary)]/60 bg-[var(--bp-surface-1)]' : 'border-[var(--bp-border)] bg-[var(--bp-surface-1)]/50'}`}>
                  <button onClick={() => setActiveStepIdx(i)} className="w-full text-left px-3 py-2.5 flex items-start gap-2">
                    <span className="text-[var(--bp-text-subtle)] font-mono text-[10px] mt-0.5">{String(i + 1).padStart(2,'0')}</span>
                    <span className={`flex-1 text-sm font-body truncate ${activeStepIdx === i ? 'text-[var(--bp-text-primary)]' : 'text-[var(--bp-text-secondary)]'}`}>
                      {s.title?._default || `Step ${i + 1}`}
                    </span>
                  </button>
                  <div className="flex items-center gap-1 px-2 pb-1.5 border-t border-[var(--bp-border)] pt-1.5">
                    <button onClick={() => moveStep(i, -1)} disabled={i === 0} className="p-1 text-[var(--bp-text-muted)] disabled:opacity-30"><ChevronUp size={11} strokeWidth={1.5} /></button>
                    <button onClick={() => moveStep(i, 1)} disabled={i === form.steps.length - 1} className="p-1 text-[var(--bp-text-muted)] disabled:opacity-30"><ChevronDown size={11} strokeWidth={1.5} /></button>
                    <span className="flex-1" />
                    <button onClick={() => deleteStep(i)} className="p-1 text-[var(--bp-text-muted)] hover:text-red-400"><Trash2 size={11} strokeWidth={1.5} /></button>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          {/* CENTER — step editor */}
          <main className="flex-1 overflow-auto p-10">
            {activeStep ? (
              <div className="max-w-3xl mx-auto">
                <p className="bp-eyebrow">Step {activeStepIdx + 1}</p>
                <input value={activeStep.title?.[locale] || activeStep.title?._default || ''}
                  onChange={(e) => setI18n(`steps.${activeStepIdx}.title`, e.target.value)}
                  placeholder="Step title"
                  data-testid="step-title-input"
                  className="w-full bg-transparent border-0 border-b border-[var(--bp-border)] focus:border-[var(--bp-primary)] focus:outline-none py-3 mt-4 bp-h2 text-[var(--bp-text-primary)]" />
                <textarea value={activeStep.description?.[locale] || activeStep.description?._default || ''}
                  onChange={(e) => setI18n(`steps.${activeStepIdx}.description`, e.target.value)}
                  placeholder="Optional description"
                  className="w-full bg-transparent border-0 border-b border-[var(--bp-border)] focus:border-[var(--bp-primary)] focus:outline-none py-3 mt-4 bp-body text-[var(--bp-text-secondary)] resize-none" rows={2} />

                <div className="mt-12 space-y-4">
                  {(activeStep.fields || []).map((f, fi) => (
                    <FieldEditor key={f.id} field={f} idx={fi} locale={locale} registry={registry}
                      onChange={(key, val) => updateField(activeStepIdx, fi, key, val)}
                      onChangeI18n={(key, val) => updateFieldI18n(activeStepIdx, fi, key, val)}
                      onDelete={() => deleteField(activeStepIdx, fi)} />
                  ))}
                </div>

                <button onClick={() => setAddOpen(true)} className="mt-6 bp-btn bp-btn-ghost text-xs" data-testid="add-field-btn">
                  <Plus size={13} strokeWidth={1.5} /> Add field
                </button>

                {addOpen && (
                  <div className="fixed inset-0 z-50 bg-[var(--bp-overlay)] backdrop-blur-sm flex items-center justify-center animate-fadeIn" onClick={() => setAddOpen(false)}>
                    <div onClick={(e) => e.stopPropagation()} className="w-[640px] max-h-[80vh] flex flex-col bp-glass rounded-[var(--bp-radius-md)] overflow-hidden">
                      <div className="flex items-center justify-between p-5 border-b border-[var(--bp-border)]">
                        <h3 className="bp-h3">Add field</h3>
                        <button onClick={() => setAddOpen(false)} className="text-[var(--bp-text-muted)]"><X size={16} /></button>
                      </div>
                      <div className="overflow-y-auto p-5 grid grid-cols-2 gap-3">
                        {(registry.field_types || []).map((ft) => {
                          const comingSoon = ft.coming_soon;
                          return (
                            <button key={ft.type} disabled={comingSoon}
                              onClick={() => { if (!comingSoon) { addField(activeStepIdx, ft.type); setAddOpen(false); } }}
                              data-testid={`field-type-${ft.type}`}
                              className={`text-left p-4 border rounded-[var(--bp-radius-sm)] bg-[var(--bp-surface-1)] transition-colors ${
                                comingSoon ? 'border-[var(--bp-border)] opacity-40 cursor-not-allowed' : 'border-[var(--bp-border)] hover:border-[var(--bp-primary)]/40'
                              }`}>
                              <div className="bp-eyebrow !text-[var(--bp-text-muted)]">
                                {ft.category}{comingSoon && ' · coming soon'}
                              </div>
                              <div className="bp-h3 text-[var(--bp-text-primary)] mt-1">{ft.label}</div>
                              {ft.description && <p className="bp-caption text-[var(--bp-text-muted)] mt-2">{ft.description}</p>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="bp-caption text-[var(--bp-text-muted)]">No step selected.</p>
            )}
          </main>
        </div>
      )}
    </div>
  );
};

// Field editor row (collapsed property panel)
const FieldEditor = ({ field, idx, locale, onChange, onChangeI18n, onDelete, registry }) => {
  const [open, setOpen] = useState(false);
  const ftMeta = registry.field_types.find((f) => f.type === field.type);
  return (
    <div className="border border-[var(--bp-border)] rounded-[var(--bp-radius-sm)] bg-[var(--bp-surface-1)]" data-testid={`field-editor-${idx}`}>
      <div className="flex items-center gap-3 p-3">
        <GripVertical size={13} strokeWidth={1.5} className="text-[var(--bp-text-subtle)]" />
        <span className="bp-eyebrow !text-[10px] !text-[var(--bp-text-muted)]">{ftMeta?.label || field.type}</span>
        <input value={field.label?.[locale] || field.label?._default || ''}
          onChange={(e) => onChangeI18n('label', e.target.value)}
          className="flex-1 bg-transparent border-0 focus:outline-none text-sm text-[var(--bp-text-primary)]" placeholder="Field label" />
        <label className="flex items-center gap-1 bp-caption text-[var(--bp-text-muted)] cursor-pointer">
          <input type="checkbox" checked={!!field.required} onChange={(e) => onChange('required', e.target.checked)} className="accent-[var(--bp-primary)]" />
          Required
        </label>
        <button onClick={() => setOpen(!open)} className="p-1 text-[var(--bp-text-muted)]" title="Options">
          <Pencil size={12} strokeWidth={1.5} />
        </button>
        <button onClick={onDelete} className="p-1 text-[var(--bp-text-muted)] hover:text-red-400">
          <Trash2 size={13} strokeWidth={1.5} />
        </button>
      </div>
      {open && (
        <div className="p-3 border-t border-[var(--bp-border)] space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="bp-eyebrow !text-[10px]">Key</span>
              <input value={field.key || ''} onChange={(e) => onChange('key', e.target.value)} className="input-luxury w-full px-2 py-1.5 text-sm rounded-[var(--bp-radius-sm)]" />
            </label>
            {['single_choice','multi_choice','image_choice'].includes(field.type) && (
              <label className="block">
                <span className="bp-eyebrow !text-[10px]">UI variant</span>
                <select value={field.ui || ''} onChange={(e) => onChange('ui', e.target.value)} className="input-luxury w-full px-2 py-1.5 text-sm rounded-[var(--bp-radius-sm)]">
                  <option value="cards">Cards</option><option value="pills">Pills</option><option value="list">List</option>
                </select>
              </label>
            )}
          </div>
          {(field.options) && (
            <div>
              <span className="bp-eyebrow !text-[10px]">Options</span>
              {(field.options || []).map((opt, oi) => (
                <div key={oi} className="grid grid-cols-3 gap-2 mt-1">
                  <input value={opt.value} onChange={(e) => {
                    const next = [...field.options]; next[oi] = { ...opt, value: e.target.value };
                    onChange('options', next);
                  }} placeholder="value" className="input-luxury px-2 py-1 text-xs rounded-[var(--bp-radius-xs)]" />
                  <input value={opt.label?.[locale] || opt.label?._default || ''}
                    onChange={(e) => {
                      const next = [...field.options];
                      next[oi] = { ...opt, label: { ...(opt.label || {}), [locale]: e.target.value, _default: opt.label?._default ?? e.target.value } };
                      onChange('options', next);
                    }} placeholder="label" className="input-luxury px-2 py-1 text-xs rounded-[var(--bp-radius-xs)] col-span-2" />
                </div>
              ))}
              <button onClick={() => onChange('options', [...(field.options || []), {value: 'new', label: {_default: 'New'}}])}
                className="mt-2 bp-btn bp-btn-ghost text-xs">
                <Plus size={11} strokeWidth={1.5} /> Add option
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Page wrapper
// ────────────────────────────────────────────────────────────────────────────
const FormBuilderPage = () => {
  const [params, setParams] = useSearchParams();
  const slug = params.get('slug');
  const navigate = useNavigate();
  return slug
    ? <FormEditView slug={slug} onBack={() => setParams({})} />
    : <FormsListView onOpen={(s) => setParams({ slug: s })} onCreate={() => {}} />;
};

export default FormBuilderPage;
