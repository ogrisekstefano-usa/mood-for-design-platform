/**
 * HomepageBuilderPage — Blueprint Section Engine UI (Shopify Sections-inspired).
 *
 * UX:
 *  - LEFT (440px): section stack with reorder/duplicate/hide/edit
 *  - RIGHT (fluid): live preview rendered via <BlueprintPageRenderer page={...} />
 *
 * Operates on any page slug (homepage / showcase / about / proposal-template…)
 * via /api/blueprint/pages/:slug. Default slug: "homepage".
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api, { formatError } from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import BlueprintPageRenderer from '../../blueprint/PageRenderer';
import {
  ChevronUp, ChevronDown, Copy, Eye, EyeOff, Trash2, Plus, Save,
  Monitor, Tablet, Smartphone, RotateCcw, Check, Pencil, X
} from 'lucide-react';

// ──────────────────────────────────────────────────────────────────────────
// Property editor — renders the right form for a given section type
// ──────────────────────────────────────────────────────────────────────────

const Field = ({ label, children, hint }) => (
  <label className="block mb-4">
    <span className="block text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--bp-text-muted)] font-body mb-1.5">{label}</span>
    {children}
    {hint && <span className="block text-[11px] text-[var(--bp-text-subtle)] mt-1 font-body">{hint}</span>}
  </label>
);

const Input = (props) => (
  <input {...props} className={`input-luxury w-full px-3 py-2 text-sm font-body rounded-[var(--bp-radius-sm)] ${props.className || ''}`} />
);

const Textarea = (props) => (
  <textarea {...props} className={`input-luxury w-full px-3 py-2 text-sm font-body rounded-[var(--bp-radius-sm)] resize-y min-h-[88px] ${props.className || ''}`} />
);

const Select = ({ value, onChange, options, testid }) => (
  <select data-testid={testid} value={value || ''} onChange={(e) => onChange(e.target.value)}
    className="input-luxury w-full px-3 py-2 text-sm font-body rounded-[var(--bp-radius-sm)]">
    {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

const CTAEditor = ({ label, value, onChange }) => (
  <Field label={label}>
    <div className="grid grid-cols-2 gap-2">
      <Input placeholder="Label" value={value?.label || ''} onChange={(e) => onChange({ ...(value || {}), label: e.target.value })} />
      <Input placeholder="URL" value={value?.href || ''} onChange={(e) => onChange({ ...(value || {}), href: e.target.value })} />
    </div>
  </Field>
);

const ItemListEditor = ({ value, onChange, fields, addLabel = 'Add item' }) => {
  const items = value || [];
  const update = (i, key, val) => {
    const next = items.map((it, idx) => idx === i ? { ...it, [key]: val } : it);
    onChange(next);
  };
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => {
    const newItem = {};
    fields.forEach((f) => { newItem[f.key] = ''; });
    onChange([...items, newItem]);
  };
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i} className="border border-[var(--bp-border)] rounded-[var(--bp-radius-sm)] p-3 bg-[var(--bp-surface-2)]/40">
          <div className="flex items-center justify-between mb-3">
            <span className="bp-eyebrow !text-[var(--bp-text-muted)]">Item {i + 1}</span>
            <button onClick={() => remove(i)} className="text-[var(--bp-text-subtle)] hover:text-red-400 transition-colors" data-testid={`remove-item-${i}`}>
              <Trash2 size={13} strokeWidth={1.5} />
            </button>
          </div>
          {fields.map((f) => (
            <div key={f.key} className="mb-2 last:mb-0">
              <span className="block text-[10px] uppercase tracking-[0.12em] text-[var(--bp-text-muted)] mb-1">{f.label}</span>
              {f.type === 'textarea' ? (
                <Textarea value={it[f.key] || ''} onChange={(e) => update(i, f.key, e.target.value)} />
              ) : (
                <Input value={it[f.key] || ''} onChange={(e) => update(i, f.key, e.target.value)} placeholder={f.placeholder} />
              )}
            </div>
          ))}
        </div>
      ))}
      <button onClick={add} className="w-full bp-btn bp-btn-ghost justify-center text-xs">
        <Plus size={13} strokeWidth={1.5} /> {addLabel}
      </button>
    </div>
  );
};

/** Section-specific property editor */
const PROPERTY_EDITORS = {
  hero: ({ content, onChange }) => (
    <>
      <Field label="Eyebrow"><Input value={content.eyebrow || ''} onChange={(e) => onChange({ ...content, eyebrow: e.target.value })} placeholder="Overline text" /></Field>
      <Field label="Headline"><Textarea value={content.headline || ''} onChange={(e) => onChange({ ...content, headline: e.target.value })} /></Field>
      <Field label="Subline"><Textarea value={content.subline || ''} onChange={(e) => onChange({ ...content, subline: e.target.value })} /></Field>
      <CTAEditor label="Primary CTA"   value={content.primary_cta}   onChange={(v) => onChange({ ...content, primary_cta: v })} />
      <CTAEditor label="Secondary CTA" value={content.secondary_cta} onChange={(v) => onChange({ ...content, secondary_cta: v })} />
      <Field label="Hero image URL"><Input value={content.media?.src || ''} onChange={(e) => onChange({ ...content, media: { ...(content.media || {}), src: e.target.value } })} placeholder="https://..." /></Field>
      <Field label="Layout"><Select value={content.layout} onChange={(v) => onChange({ ...content, layout: v })}
        options={[{value:'editorial',label:'Editorial'},{value:'centered',label:'Centered'}]} /></Field>
      <Field label="Atmosphere"><Select value={content.atmosphere} onChange={(v) => onChange({ ...content, atmosphere: v })}
        options={[{value:'cinematic',label:'Cinematic'},{value:'clean',label:'Clean'},{value:'grain',label:'Grain'}]} /></Field>
      <Field label="Height"><Select value={content.height} onChange={(v) => onChange({ ...content, height: v })}
        options={[{value:'compact',label:'Compact'},{value:'tall',label:'Tall'},{value:'fullscreen',label:'Full screen'}]} /></Field>
    </>
  ),
  feature_grid: ({ content, onChange }) => (
    <>
      <Field label="Eyebrow"><Input value={content.eyebrow || ''} onChange={(e) => onChange({ ...content, eyebrow: e.target.value })} /></Field>
      <Field label="Headline"><Textarea value={content.headline || ''} onChange={(e) => onChange({ ...content, headline: e.target.value })} /></Field>
      <Field label="Columns"><Select value={content.columns} onChange={(v) => onChange({ ...content, columns: v })}
        options={[{value:'2',label:'2'},{value:'3',label:'3'},{value:'4',label:'4'}]} /></Field>
      <Field label="Items">
        <ItemListEditor value={content.items} onChange={(v) => onChange({ ...content, items: v })}
          fields={[
            {key:'icon', label:'Icon (Lucide name)', placeholder:'Layers / Sparkles / FolderOpen'},
            {key:'title', label:'Title'},
            {key:'description', label:'Description', type:'textarea'},
          ]}
          addLabel="Add feature" />
      </Field>
    </>
  ),
  gallery: ({ content, onChange }) => (
    <>
      <Field label="Eyebrow"><Input value={content.eyebrow || ''} onChange={(e) => onChange({ ...content, eyebrow: e.target.value })} /></Field>
      <Field label="Headline"><Input value={content.headline || ''} onChange={(e) => onChange({ ...content, headline: e.target.value })} /></Field>
      <Field label="Variant"><Select value={content.variant} onChange={(v) => onChange({ ...content, variant: v })}
        options={[{value:'mosaic',label:'Mosaic'},{value:'grid',label:'Grid'},{value:'marquee',label:'Marquee'}]} /></Field>
      <Field label="Aspect ratio"><Select value={content.aspect} onChange={(v) => onChange({ ...content, aspect: v })}
        options={[{value:'varied',label:'Varied'},{value:'square',label:'Square'},{value:'portrait',label:'Portrait'},{value:'landscape',label:'Landscape'}]} /></Field>
      <Field label="Images">
        <ItemListEditor value={content.items} onChange={(v) => onChange({ ...content, items: v })}
          fields={[{key:'src', label:'Image URL', placeholder:'https://...'},{key:'alt', label:'Alt text'},{key:'caption', label:'Caption'}]}
          addLabel="Add image" />
      </Field>
    </>
  ),
  quote: ({ content, onChange }) => (
    <>
      <Field label="Quote"><Textarea value={content.quote || ''} onChange={(e) => onChange({ ...content, quote: e.target.value })} /></Field>
      <Field label="Author"><Input value={content.author || ''} onChange={(e) => onChange({ ...content, author: e.target.value })} /></Field>
      <Field label="Role"><Input value={content.role || ''} onChange={(e) => onChange({ ...content, role: e.target.value })} /></Field>
      <Field label="Alignment"><Select value={content.alignment} onChange={(v) => onChange({ ...content, alignment: v })}
        options={[{value:'center',label:'Center'},{value:'left',label:'Left'}]} /></Field>
    </>
  ),
  stats: ({ content, onChange }) => (
    <Field label="Stats">
      <ItemListEditor value={content.items} onChange={(v) => onChange({ ...content, items: v })}
        fields={[{key:'value', label:'Value', placeholder:'120'},{key:'suffix', label:'Suffix', placeholder:'+'},{key:'label', label:'Label'}]}
        addLabel="Add stat" />
    </Field>
  ),
  cta: ({ content, onChange }) => (
    <>
      <Field label="Eyebrow"><Input value={content.eyebrow || ''} onChange={(e) => onChange({ ...content, eyebrow: e.target.value })} /></Field>
      <Field label="Headline"><Textarea value={content.headline || ''} onChange={(e) => onChange({ ...content, headline: e.target.value })} /></Field>
      <Field label="Subline"><Textarea value={content.subline || ''} onChange={(e) => onChange({ ...content, subline: e.target.value })} /></Field>
      <CTAEditor label="Primary CTA"   value={content.primary_cta}   onChange={(v) => onChange({ ...content, primary_cta: v })} />
      <CTAEditor label="Secondary CTA" value={content.secondary_cta} onChange={(v) => onChange({ ...content, secondary_cta: v })} />
      <Field label="Atmosphere"><Select value={content.atmosphere} onChange={(v) => onChange({ ...content, atmosphere: v })}
        options={[{value:'glass',label:'Glass'},{value:'cinematic',label:'Cinematic'},{value:'clean',label:'Clean'}]} /></Field>
    </>
  ),
  split: ({ content, onChange }) => (
    <>
      <Field label="Eyebrow"><Input value={content.eyebrow || ''} onChange={(e) => onChange({ ...content, eyebrow: e.target.value })} /></Field>
      <Field label="Headline"><Textarea value={content.headline || ''} onChange={(e) => onChange({ ...content, headline: e.target.value })} /></Field>
      <Field label="Body"><Textarea value={content.body || ''} onChange={(e) => onChange({ ...content, body: e.target.value })} /></Field>
      <Field label="Media URL"><Input value={content.media?.src || ''} onChange={(e) => onChange({ ...content, media: { ...(content.media || {}), src: e.target.value } })} placeholder="https://..." /></Field>
      <Field label="Media side"><Select value={content.side} onChange={(v) => onChange({ ...content, side: v })}
        options={[{value:'right',label:'Right'},{value:'left',label:'Left'}]} /></Field>
      <CTAEditor label="Primary CTA" value={content.primary_cta} onChange={(v) => onChange({ ...content, primary_cta: v })} />
    </>
  ),
  logo_strip: ({ content, onChange }) => (
    <>
      <Field label="Eyebrow"><Input value={content.eyebrow || ''} onChange={(e) => onChange({ ...content, eyebrow: e.target.value })} /></Field>
      <Field label="Logos">
        <ItemListEditor value={content.items} onChange={(v) => onChange({ ...content, items: v })}
          fields={[{key:'src',label:'Logo URL'},{key:'alt',label:'Alt'},{key:'href',label:'Link URL'}]}
          addLabel="Add logo" />
      </Field>
    </>
  ),
  magazine_grid: ({ content, onChange }) => (
    <>
      <Field label="Eyebrow"><Input value={content.eyebrow || ''} onChange={(e) => onChange({ ...content, eyebrow: e.target.value })} /></Field>
      <Field label="Headline"><Input value={content.headline || ''} onChange={(e) => onChange({ ...content, headline: e.target.value })} /></Field>
      <Field label="Data source"><Input value={content.source || ''} onChange={(e) => onChange({ ...content, source: e.target.value })} placeholder="/api/inspirations?limit=6" /></Field>
      <Field label="Columns"><Select value={content.columns} onChange={(v) => onChange({ ...content, columns: v })}
        options={[{value:'2',label:'2'},{value:'3',label:'3'},{value:'4',label:'4'}]} /></Field>
    </>
  ),
  faq: ({ content, onChange }) => (
    <>
      <Field label="Eyebrow"><Input value={content.eyebrow || ''} onChange={(e) => onChange({ ...content, eyebrow: e.target.value })} /></Field>
      <Field label="Headline"><Input value={content.headline || ''} onChange={(e) => onChange({ ...content, headline: e.target.value })} /></Field>
      <Field label="Questions">
        <ItemListEditor value={content.items} onChange={(v) => onChange({ ...content, items: v })}
          fields={[{key:'question', label:'Question'},{key:'answer', label:'Answer', type:'textarea'}]}
          addLabel="Add question" />
      </Field>
    </>
  ),
};

// ──────────────────────────────────────────────────────────────────────────
// Section row in the stack
// ──────────────────────────────────────────────────────────────────────────
const SectionRow = ({ section, catalog, index, total, isActive, onSelect, onMove, onToggle, onDuplicate, onDelete }) => {
  const meta = catalog.find((c) => c.type === section.type);
  return (
    <div data-testid={`section-row-${section.type}`}
      className={`group border ${isActive ? 'border-[var(--bp-primary)]/60' : 'border-[var(--bp-border)]'} rounded-[var(--bp-radius-sm)] bg-[var(--bp-surface-1)] transition-colors`}>
      <button onClick={onSelect}
        className="w-full px-3 py-3 flex items-center gap-3 text-left">
        <span className="text-[var(--bp-text-subtle)] font-mono text-[10px] w-5">{String(index + 1).padStart(2,'0')}</span>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-body ${section.visible ? 'text-[var(--bp-text-primary)]' : 'text-[var(--bp-text-muted)] line-through'} truncate`}>
            {meta?.label || section.type}
          </div>
          <div className="bp-caption text-[var(--bp-text-subtle)]">{meta?.category}</div>
        </div>
        <Pencil size={13} strokeWidth={1.5} className={`flex-shrink-0 ${isActive ? 'text-[var(--bp-primary)]' : 'text-[var(--bp-text-subtle)] group-hover:text-[var(--bp-text-secondary)]'}`} />
      </button>
      <div className="px-3 pb-2 flex items-center gap-1.5 border-t border-[var(--bp-border)] pt-2">
        <button onClick={() => onMove(-1)} disabled={index === 0} title="Move up"
          className="p-1.5 rounded-[var(--bp-radius-xs)] hover:bg-[var(--bp-surface-2)] text-[var(--bp-text-muted)] disabled:opacity-30 disabled:hover:bg-transparent">
          <ChevronUp size={13} strokeWidth={1.5} />
        </button>
        <button onClick={() => onMove(1)} disabled={index === total - 1} title="Move down"
          className="p-1.5 rounded-[var(--bp-radius-xs)] hover:bg-[var(--bp-surface-2)] text-[var(--bp-text-muted)] disabled:opacity-30 disabled:hover:bg-transparent">
          <ChevronDown size={13} strokeWidth={1.5} />
        </button>
        <button onClick={onToggle} title={section.visible ? 'Hide' : 'Show'}
          className="p-1.5 rounded-[var(--bp-radius-xs)] hover:bg-[var(--bp-surface-2)] text-[var(--bp-text-muted)]">
          {section.visible ? <Eye size={13} strokeWidth={1.5} /> : <EyeOff size={13} strokeWidth={1.5} />}
        </button>
        <button onClick={onDuplicate} title="Duplicate"
          className="p-1.5 rounded-[var(--bp-radius-xs)] hover:bg-[var(--bp-surface-2)] text-[var(--bp-text-muted)]">
          <Copy size={13} strokeWidth={1.5} />
        </button>
        <span className="flex-1" />
        <button onClick={onDelete} title="Delete"
          className="p-1.5 rounded-[var(--bp-radius-xs)] hover:bg-red-500/10 text-[var(--bp-text-muted)] hover:text-red-400">
          <Trash2 size={13} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────────────────────────────────

const PAGE_SLUGS = [
  { slug: 'homepage', label: 'Homepage' },
  { slug: 'showcase', label: 'Showcase' },
  { slug: 'about',    label: 'About' },
];

const HomepageBuilderPage = () => {
  const [params, setParams] = useSearchParams();
  const slug = params.get('slug') || 'homepage';
  const navigate = useNavigate();
  const { locale, availableLocales } = useBlueprint();

  const [catalog, setCatalog] = useState([]);
  const [page, setPage] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [viewport, setViewport] = useState('desktop');
  const [previewLocale, setPreviewLocale] = useState(locale);
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState('');

  // Load catalog + page
  useEffect(() => {
    api.get('/api/blueprint/sections/catalog')
      .then((r) => setCatalog(r.data.sections || []))
      .catch((e) => setError(formatError(e)));
  }, []);

  useEffect(() => {
    setActiveId(null); setDirty(false); setError('');
    api.get(`/api/blueprint/pages/${slug}`)
      .then((r) => setPage(r.data))
      .catch((e) => setError(formatError(e)));
  }, [slug]);

  const sections = useMemo(() => page?.sections || [], [page]);
  const activeSection = useMemo(() => sections.find((s) => s.id === activeId), [sections, activeId]);
  const activeMeta = useMemo(() => catalog.find((c) => c.type === activeSection?.type), [catalog, activeSection]);

  // ── Section ops (optimistic, then save in bulk via PUT page) ─────────────
  const updateSection = useCallback((id, mutator) => {
    setPage((p) => {
      const next = { ...p, sections: p.sections.map((s) => s.id === id ? mutator(s) : s) };
      return next;
    });
    setDirty(true);
  }, []);

  const moveSection = (id, dir) => {
    setPage((p) => {
      const arr = [...p.sections];
      const i = arr.findIndex((s) => s.id === id);
      const j = i + dir;
      if (j < 0 || j >= arr.length) return p;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      arr.forEach((s, idx) => { s.order = idx; });
      return { ...p, sections: arr };
    });
    setDirty(true);
  };

  const toggleVisible = (id) => updateSection(id, (s) => ({ ...s, visible: !s.visible }));

  const duplicateSection = (id) => {
    setPage((p) => {
      const arr = [...p.sections];
      const i = arr.findIndex((s) => s.id === id);
      const clone = { ...arr[i], id: `tmp-${Date.now()}` };
      arr.splice(i + 1, 0, clone);
      arr.forEach((s, idx) => { s.order = idx; });
      return { ...p, sections: arr };
    });
    setDirty(true);
  };

  const deleteSection = (id) => {
    setPage((p) => ({ ...p, sections: p.sections.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i })) }));
    if (activeId === id) setActiveId(null);
    setDirty(true);
  };

  const addSection = (type) => {
    const meta = catalog.find((c) => c.type === type);
    if (!meta) return;
    setPage((p) => {
      const newSec = {
        id: `tmp-${Date.now()}`,
        type,
        visible: true,
        order: p.sections.length,
        content: { _default: meta.defaults || {} },
        settings: {},
      };
      return { ...p, sections: [...p.sections, newSec] };
    });
    setDirty(true);
    setAddOpen(false);
  };

  const updateContent = (id, nextContent) =>
    updateSection(id, (s) => ({ ...s, content: { ...(s.content || {}), [previewLocale]: nextContent, _default: s.content?._default || nextContent } }));

  // ── Save / reset ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!page) return;
    setSaving(true); setError('');
    try {
      const r = await api.put(`/api/blueprint/pages/${page.slug}`, {
        title: page.title,
        published: page.published,
        sections: page.sections.map((s, i) => ({
          ...s,
          id: s.id?.startsWith('tmp-') ? undefined : s.id,
          order: i,
        })),
      });
      setPage(r.data);
      setDirty(false);
      setSavedAt(Date.now());
    } catch (e) {
      setError(formatError(e));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset this page to its default template? This will discard your changes.')) return;
    try {
      const r = await api.post(`/api/blueprint/pages/${slug}/reset`);
      setPage(r.data);
      setDirty(false); setActiveId(null);
    } catch (e) { setError(formatError(e)); }
  };

  // Resolve preview content (locale-aware)
  const previewContent = useMemo(() => {
    if (!activeSection) return null;
    const c = activeSection.content || {};
    return c[previewLocale] || c._default || {};
  }, [activeSection, previewLocale]);

  const PropertyEditor = activeSection ? PROPERTY_EDITORS[activeSection.type] : null;

  const viewportW = { desktop: '100%', tablet: '820px', mobile: '390px' }[viewport];

  return (
    <div className="flex flex-col h-full" data-testid="homepage-builder-page">
      {/* Topbar */}
      <header className="flex items-center justify-between gap-4 px-6 h-14 border-b border-[var(--bp-border)] bg-[var(--bp-surface-1)]/60 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/settings')} className="bp-caption text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]" data-testid="back-settings">
            ← Settings
          </button>
          <div className="w-px h-5 bg-[var(--bp-border)]" />
          <select value={slug} onChange={(e) => setParams({ slug: e.target.value })}
            data-testid="page-slug-select"
            className="bg-transparent text-sm font-body text-[var(--bp-text-primary)] focus:outline-none cursor-pointer">
            {PAGE_SLUGS.map((p) => <option key={p.slug} value={p.slug}>{p.label}</option>)}
          </select>
          <span className="bp-caption text-[var(--bp-text-subtle)]">/{slug}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-[var(--bp-surface-2)] rounded-[var(--bp-radius-sm)] p-0.5">
            {[{v:'desktop',Icon:Monitor},{v:'tablet',Icon:Tablet},{v:'mobile',Icon:Smartphone}].map(({v, Icon}) => (
              <button key={v} onClick={() => setViewport(v)} data-testid={`viewport-${v}`}
                className={`p-1.5 rounded-[var(--bp-radius-xs)] transition-colors ${viewport === v ? 'bg-[var(--bp-surface-3)] text-[var(--bp-text-primary)]' : 'text-[var(--bp-text-muted)]'}`}>
                <Icon size={13} strokeWidth={1.5} />
              </button>
            ))}
          </div>
          <select value={previewLocale} onChange={(e) => setPreviewLocale(e.target.value)}
            data-testid="preview-locale"
            className="input-luxury px-2 py-1.5 text-xs font-mono rounded-[var(--bp-radius-sm)]">
            {availableLocales.map((l) => <option key={l.code} value={l.code}>{l.code}</option>)}
          </select>
          <button onClick={handleReset} className="bp-btn bp-btn-ghost text-xs" title="Reset to default" data-testid="reset-page">
            <RotateCcw size={12} strokeWidth={1.5} /> Reset
          </button>
          <label className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--bp-radius-sm)] border border-[var(--bp-border)] bg-[var(--bp-surface-2)] cursor-pointer" data-testid="publish-toggle-wrap">
            <input type="checkbox" checked={!!page?.published}
              onChange={(e) => { setPage((p) => ({ ...p, published: e.target.checked })); setDirty(true); }}
              data-testid="publish-toggle"
              className="accent-[var(--bp-primary)]" />
            <span className="bp-eyebrow !text-[10px]">{page?.published ? 'Published' : 'Draft'}</span>
          </label>
          <button onClick={handleSave} disabled={!dirty || saving}
            data-testid="save-page"
            className={`bp-btn ${dirty ? 'bp-btn-primary' : 'bp-btn-ghost opacity-50 cursor-not-allowed'} text-xs`}>
            {saving ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"/> :
              savedAt && !dirty ? <Check size={12} strokeWidth={1.5} /> : <Save size={12} strokeWidth={1.5} />}
            {saving ? 'Saving' : savedAt && !dirty ? 'Saved' : 'Save'}
          </button>
        </div>
      </header>

      {error && <div className="px-6 py-2 bg-red-500/10 border-b border-red-500/20 text-red-300 bp-caption">{error}</div>}

      <div className="flex flex-1 min-h-0">
        {/* LEFT — sections stack + property editor */}
        <aside className="w-[440px] flex-shrink-0 border-r border-[var(--bp-border)] bg-[var(--bp-surface-1)]/40 flex flex-col">
          {activeSection ? (
            // Property editor
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex items-center justify-between px-5 h-12 border-b border-[var(--bp-border)] flex-shrink-0">
                <div>
                  <span className="bp-eyebrow">{activeMeta?.category}</span>
                  <h3 className="bp-h3 text-[var(--bp-text-primary)]">{activeMeta?.label || activeSection.type}</h3>
                </div>
                <button onClick={() => setActiveId(null)} className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]" data-testid="close-editor">
                  <X size={16} strokeWidth={1.5} />
                </button>
              </div>
              <div className="overflow-y-auto p-5 flex-1">
                {PropertyEditor && (
                  <PropertyEditor content={previewContent || {}} onChange={(c) => updateContent(activeSection.id, c)} />
                )}
                <p className="bp-caption text-[var(--bp-text-subtle)] mt-6 pt-4 border-t border-[var(--bp-border)]">
                  Editing in <code className="text-[var(--bp-primary)]">{previewLocale}</code>. Switch locale in topbar to edit translations.
                </p>
              </div>
            </div>
          ) : (
            // Section list
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex items-center justify-between px-5 h-12 border-b border-[var(--bp-border)] flex-shrink-0">
                <div>
                  <span className="bp-eyebrow">Page</span>
                  <h3 className="bp-h3 text-[var(--bp-text-primary)]">{page?.title || slug}</h3>
                </div>
                <button onClick={() => setAddOpen(true)} className="bp-btn bp-btn-ghost text-xs" data-testid="add-section-btn">
                  <Plus size={12} strokeWidth={1.5} /> Add
                </button>
              </div>
              <div className="overflow-y-auto p-3 space-y-2 flex-1">
                {sections.map((s, i) => (
                  <SectionRow key={s.id} section={s} catalog={catalog} index={i} total={sections.length}
                    isActive={activeId === s.id}
                    onSelect={() => setActiveId(s.id)}
                    onMove={(dir) => moveSection(s.id, dir)}
                    onToggle={() => toggleVisible(s.id)}
                    onDuplicate={() => duplicateSection(s.id)}
                    onDelete={() => deleteSection(s.id)}
                  />
                ))}
                {sections.length === 0 && (
                  <p className="bp-caption text-[var(--bp-text-muted)] text-center py-8">No sections yet. Click "Add" to start.</p>
                )}
              </div>
            </div>
          )}
        </aside>

        {/* RIGHT — live preview */}
        <main className="flex-1 overflow-auto bg-[var(--bp-bg)] py-6 px-6 flex justify-center">
          <div data-testid="preview-frame" className="bg-[var(--bp-bg)] transition-[max-width] duration-[var(--bp-duration-slow)] ease-[var(--bp-ease)] border border-[var(--bp-border)] rounded-[var(--bp-radius-md)] overflow-hidden shadow-[var(--bp-shadow-xl)] w-full" style={{ maxWidth: viewportW }}>
            {page && <BlueprintPageRenderer page={page} previewLocale={previewLocale} />}
          </div>
        </main>
      </div>

      {/* Add section modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bp-overlay)] backdrop-blur-sm animate-fadeIn" onClick={() => setAddOpen(false)}>
          <div onClick={(e) => e.stopPropagation()}
            className="w-[640px] max-h-[80vh] flex flex-col bp-glass rounded-[var(--bp-radius-md)] overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-[var(--bp-border)]">
              <div>
                <span className="bp-eyebrow">Section library</span>
                <h3 className="bp-h3 text-[var(--bp-text-primary)]">Add section</h3>
              </div>
              <button onClick={() => setAddOpen(false)} className="text-[var(--bp-text-muted)]"><X size={16} /></button>
            </div>
            <div className="overflow-y-auto p-5 grid grid-cols-2 gap-3">
              {catalog.map((s) => (
                <button key={s.type} onClick={() => addSection(s.type)} data-testid={`add-${s.type}`}
                  className="text-left p-4 border border-[var(--bp-border)] hover:border-[var(--bp-primary)]/40 rounded-[var(--bp-radius-sm)] bg-[var(--bp-surface-1)] transition-colors">
                  <div className="bp-eyebrow !text-[var(--bp-text-muted)]">{s.category}</div>
                  <div className="bp-h3 text-[var(--bp-text-primary)] mt-1">{s.label}</div>
                  <p className="bp-caption text-[var(--bp-text-muted)] mt-2">{s.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomepageBuilderPage;
