/**
 * MaterialDetailPage — first-class material page (Phase N.3).
 *
 * Layout:
 *   Hero (name + primary image + technical strip)
 *   ┌───────────────────────────────────────────────┐
 *   │ Slab images        │  Sidebar                  │
 *   │ Finish samples     │  ─ Supplier               │
 *   │ Renders            │  ─ Technical notes         │
 *   │ Catalogs (PDF)     │  ─ Linked projects        │
 *   │ Detail shots       │  ─ Linked moodboards      │
 *   └───────────────────────────────────────────────┘
 *
 * Each asset attached has a `role` (slab / finish / render / catalog / detail / swatch / application).
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Gem, Plus, ArrowLeft, Edit3, X, Check, Loader2, Image as ImageIcon, FileText, Layers,
  Upload, Trash2, Save, Archive,
} from 'lucide-react';
import { materials as matApi, media, uploadMediaFile } from '../../lib/mediaApi';
import { toast } from 'sonner';

const ROLES = [
  { id: 'slab',        label: 'Slab' },
  { id: 'finish',      label: 'Finish' },
  { id: 'render',      label: 'Render' },
  { id: 'application', label: 'Application' },
  { id: 'detail',      label: 'Detail' },
  { id: 'swatch',      label: 'Swatch' },
  { id: 'catalog',     label: 'Catalog (PDF)' },
  { id: 'spec',        label: 'Spec sheet' },
];

const RoleSection = ({ role, items, onAttach, onDetach, onSetPrimary }) => (
  <section data-testid={`role-section-${role.id}`} className="mb-10">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-[11px] tracking-[0.28em] uppercase text-[var(--bp-text-muted)] font-body">
        {role.label}
      </h3>
      <button
        type="button"
        onClick={() => onAttach(role.id)}
        data-testid={`attach-${role.id}-btn`}
        className="inline-flex items-center gap-1.5 text-[11px] text-[var(--bp-text-muted)]
                   hover:text-[var(--bp-primary)] transition-colors font-body"
      >
        <Plus size={12} />
        Attach
      </button>
    </div>
    {items.length === 0 ? (
      <div className="border border-dashed border-[var(--bp-border)] rounded-md
                      h-32 flex items-center justify-center cursor-pointer
                      hover:border-[var(--bp-border-strong)] transition-colors"
           onClick={() => onAttach(role.id)}
           data-testid={`role-empty-${role.id}`}>
        <p className="text-[11px] text-[var(--bp-text-muted)] uppercase tracking-[0.18em] font-body">
          + Drop or attach {role.label.toLowerCase()}
        </p>
      </div>
    ) : (
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}
      >
        {items.map((a) => (
          <div
            key={a.id}
            className="group relative rounded-[5px] border border-[var(--bp-border)] overflow-hidden bg-[var(--bp-surface-1)]"
            style={{ aspectRatio: role.id === 'catalog' || role.id === 'spec' ? '4/5' : '1/1' }}
            data-testid={`attached-${role.id}-${a.id}`}
          >
            {a.asset?.file_type?.startsWith('image/') ? (
              <img src={a.asset.display_url || a.asset.file_url} alt={a.caption || ''} className="absolute inset-0 w-full h-full object-cover" />
            ) : a.asset?.file_type === 'application/pdf' ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--bp-surface-2)]">
                <FileText size={28} className="text-[var(--bp-text-muted)] mb-2" strokeWidth={1.3} />
                <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--bp-text-muted)] font-mono px-2 truncate">
                  PDF
                </p>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--bp-surface-2)]">
                <Layers size={24} className="text-[var(--bp-text-muted)]" />
              </div>
            )}
            {a.caption && (
              <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/80 to-transparent">
                <p className="text-[10px] text-white/90 truncate font-body">{a.caption}</p>
              </div>
            )}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
              <button
                type="button"
                onClick={() => onSetPrimary(a.asset?.id)}
                title="Set as primary image"
                className="p-1 rounded bg-black/50 text-white/80 hover:text-[var(--bp-primary)] hover:bg-black/70 transition-colors"
              >
                <Check size={11} />
              </button>
              <button
                type="button"
                onClick={() => onDetach(a.id)}
                title="Detach"
                className="p-1 rounded bg-black/50 text-white/80 hover:text-red-300 hover:bg-black/70 transition-colors"
              >
                <X size={11} />
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
  </section>
);

const AttachAssetModal = ({ materialId, role, onClose, onAttached }) => {
  const fileRef = React.useRef(null);
  const [tab, setTab] = useState('upload');
  const [existing, setExisting] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [busy, setBusy] = useState(false);

  const loadLibrary = useCallback(async () => {
    const r = await media.list({ q: searchInput, limit: 60 });
    setExisting(r.data || []);
  }, [searchInput]);

  useEffect(() => { if (tab === 'library') loadLibrary(); }, [tab, loadLibrary]);

  const onUpload = async (files) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (let i = 0; i < files.length; i += 1) {
        const f = files[i];
        const row = await uploadMediaFile({ file: f, folder: `library/materials/${materialId}` });
        await matApi.attachAsset(materialId, { asset_id: row.id, role });
      }
      toast.success(`${files.length} attached as ${role}`);
      onAttached?.();
      onClose();
    } catch (e) {
      toast.error('Attach failed');
    } finally { setBusy(false); }
  };

  const attachExisting = async (asset) => {
    setBusy(true);
    try {
      await matApi.attachAsset(materialId, { asset_id: asset.id, role });
      toast.success(`Attached as ${role}`);
      onAttached?.();
      onClose();
    } catch (e) {
      toast.error('Attach failed');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
         onClick={onClose}
         data-testid="attach-asset-modal">
      <div onClick={(e) => e.stopPropagation()}
           className="w-full max-w-4xl bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-md p-6 max-h-[90vh] overflow-y-auto">
        <p className="text-[9px] uppercase tracking-[0.28em] text-[var(--bp-text-muted)] font-body mb-1">
          Attach
        </p>
        <h3 className="text-[20px] font-heading tracking-tight text-[var(--bp-text-primary)] mb-5">
          Add asset as <span className="text-[var(--bp-primary)]">{role}</span>
        </h3>

        <div className="flex gap-1 border-b border-[var(--bp-border)] mb-5">
          <button
            type="button"
            onClick={() => setTab('upload')}
            data-testid="attach-tab-upload"
            className={`px-4 py-2 text-[12px] font-body uppercase tracking-wider transition-colors ${
              tab === 'upload'
                ? 'text-[var(--bp-primary)] border-b-2 border-[var(--bp-primary)]'
                : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]'
            }`}
          >
            Upload new
          </button>
          <button
            type="button"
            onClick={() => setTab('library')}
            data-testid="attach-tab-library"
            className={`px-4 py-2 text-[12px] font-body uppercase tracking-wider transition-colors ${
              tab === 'library'
                ? 'text-[var(--bp-primary)] border-b-2 border-[var(--bp-primary)]'
                : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]'
            }`}
          >
            From library
          </button>
        </div>

        {tab === 'upload' && (
          <>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,application/pdf,video/*"
              onChange={(e) => onUpload(e.target.files)}
              className="hidden"
              data-testid="attach-upload-input"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              data-testid="attach-pick-files-btn"
              className="w-full py-10 rounded-[5px] border border-dashed border-[var(--bp-border-strong)]
                         hover:border-[var(--bp-primary)]/50 transition-colors flex flex-col items-center
                         justify-center gap-3 disabled:opacity-50"
            >
              <Upload size={20} className="text-[var(--bp-text-muted)]" strokeWidth={1.4} />
              <p className="text-[13px] text-[var(--bp-text-primary)] font-body">
                {busy ? 'Uploading…' : 'Drop or browse files'}
              </p>
              <p className="text-[11px] text-[var(--bp-text-muted)] font-body">
                Images, PDF, video
              </p>
            </button>
          </>
        )}

        {tab === 'library' && (
          <>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search archive…"
              data-testid="attach-search-input"
              className="w-full bg-transparent border-0 border-b border-[var(--bp-border)] py-1.5 text-[13px]
                         text-[var(--bp-text-primary)] focus:outline-none focus:border-[var(--bp-primary)] mb-4 transition-colors"
            />
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
              {existing.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => attachExisting(a)}
                  disabled={busy}
                  data-testid={`attach-existing-${a.id}`}
                  className="aspect-square rounded-[4px] border border-[var(--bp-border)] overflow-hidden
                             hover:border-[var(--bp-primary)] transition-colors group relative"
                >
                  {a.file_type?.startsWith('image/') ? (
                    <img src={a.display_url || a.file_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-[var(--bp-surface-2)]">
                      <FileText size={20} className="text-[var(--bp-text-muted)]" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="flex justify-end mt-6">
          <button
            type="button"
            onClick={onClose}
            data-testid="attach-modal-close-btn"
            className="px-3 py-1.5 text-[12px] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] font-body"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const EditableField = ({ label, value, onChange, area = false, placeholder, testid }) => {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value || '');
  useEffect(() => { setV(value || ''); }, [value]);

  const save = () => {
    if (v !== (value || '')) onChange(v);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div data-testid={testid} className="group cursor-text" onClick={() => setEditing(true)}>
        <p className="text-[9px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] font-body mb-1">{label}</p>
        {value ? (
          <p className="text-[14px] text-[var(--bp-text-primary)] font-body whitespace-pre-wrap group-hover:text-[var(--bp-primary)] transition-colors">
            {value}
          </p>
        ) : (
          <p className="text-[13px] text-[var(--bp-text-muted)] italic font-body group-hover:text-[var(--bp-text-secondary)] transition-colors">
            {placeholder || `Add ${label.toLowerCase()}`}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="text-[9px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] font-body mb-1">{label}</p>
      {area ? (
        <textarea
          rows={4}
          autoFocus
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={save}
          className="w-full bg-transparent border border-[var(--bp-border)] rounded-[4px] py-1.5 px-2 text-[13px]
                     text-[var(--bp-text-primary)] focus:outline-none focus:border-[var(--bp-primary)] transition-colors"
        />
      ) : (
        <input
          autoFocus
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setV(value || ''); setEditing(false); } }}
          className="w-full bg-transparent border-0 border-b border-[var(--bp-border)] py-1 text-[14px]
                     text-[var(--bp-text-primary)] focus:outline-none focus:border-[var(--bp-primary)] transition-colors"
        />
      )}
    </div>
  );
};

const MaterialDetailPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attachRole, setAttachRole] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await matApi.bySlug(slug);
      setData(d);
    } catch (e) {
      toast.error('Material not found');
      navigate('/library/materials');
    } finally { setLoading(false); }
  }, [slug, navigate]);

  useEffect(() => { load(); }, [load]);

  const updateField = async (key, value) => {
    if (!data?.material?.id) return;
    try {
      await matApi.update(data.material.id, { [key]: value || null });
      load();
    } catch (e) { toast.error('Save failed'); }
  };

  const detach = async (attId) => {
    await matApi.detachAsset(data.material.id, attId);
    toast.success('Detached');
    load();
  };

  const setPrimary = async (assetId) => {
    await matApi.update(data.material.id, { primary_asset_id: assetId });
    toast.success('Primary image updated');
    load();
  };

  const archive = async () => {
    if (!confirm('Archive this material?')) return;
    await matApi.archive(data.material.id);
    toast.success('Archived');
    navigate('/library/materials');
  };

  if (loading || !data) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--bp-bg)]">
        <Loader2 size={20} className="animate-spin text-[var(--bp-text-muted)]" />
      </div>
    );
  }

  const mat = data.material;
  const attachmentsByRole = (roleId) => (data.attachments || []).filter((a) => a.role === roleId);

  const linkedProjects   = (data.linked_entities?.project || []).filter(Boolean);
  const linkedMoodboards = (data.linked_entities?.moodboard || []).filter(Boolean);

  return (
    <div data-testid="material-detail-page" className="h-full overflow-y-auto bg-[var(--bp-bg)]">
      {/* Hero */}
      <div className="relative">
        <div className="aspect-[21/9] w-full bg-[var(--bp-surface-2)] overflow-hidden">
          {mat.primary_asset?.file_url || mat.primary_asset?.display_url ? (
            <img
              src={mat.primary_asset.display_url || mat.primary_asset.file_url}
              alt={mat.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ background: mat.dominant_color || undefined }}>
              <Gem size={48} className="text-[var(--bp-text-muted)] opacity-40" strokeWidth={1.2} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bp-bg)] via-[var(--bp-bg)]/30 to-transparent" />
        </div>

        <div className="absolute top-6 left-10">
          <Link
            to="/library/materials"
            data-testid="back-to-materials-btn"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[5px] bg-black/40 backdrop-blur-md
                       border border-white/10 text-white/90 hover:text-white text-[12px] font-body transition-colors"
          >
            <ArrowLeft size={12} />
            Back
          </Link>
        </div>

        <div className="relative -mt-32 px-10 z-10">
          <p className="text-[10px] tracking-[0.28em] uppercase text-[var(--bp-text-muted)] font-body mb-2">
            {mat.subcategory || mat.category || 'Material'}
          </p>
          <h1 className="text-[56px] font-heading tracking-tight text-[var(--bp-text-primary)] leading-[0.95]">
            {mat.name}
          </h1>
          <div className="mt-4 flex items-center gap-4 flex-wrap text-[12px] text-[var(--bp-text-secondary)] font-body">
            {mat.supplier && <span><span className="text-[var(--bp-text-muted)] uppercase tracking-wider text-[10px] mr-1.5">Supplier</span>{mat.supplier}</span>}
            {mat.finish && <span><span className="text-[var(--bp-text-muted)] uppercase tracking-wider text-[10px] mr-1.5">Finish</span>{mat.finish}</span>}
            {mat.thickness && <span><span className="text-[var(--bp-text-muted)] uppercase tracking-wider text-[10px] mr-1.5">Thickness</span>{mat.thickness}</span>}
            {mat.origin && <span><span className="text-[var(--bp-text-muted)] uppercase tracking-wider text-[10px] mr-1.5">Origin</span>{mat.origin}</span>}
          </div>
        </div>
      </div>

      <div className="px-10 py-10 grid grid-cols-3 gap-10">
        {/* Main column: roles */}
        <div className="col-span-2">
          {ROLES.map((role) => (
            <RoleSection
              key={role.id}
              role={role}
              items={attachmentsByRole(role.id)}
              onAttach={(r) => setAttachRole(r)}
              onDetach={detach}
              onSetPrimary={setPrimary}
            />
          ))}
        </div>

        {/* Sidebar */}
        <div className="col-span-1 space-y-8">
          <div className="space-y-5 pb-6 border-b border-[var(--bp-border)]">
            <EditableField label="Supplier"     value={mat.supplier}     onChange={(v) => updateField('supplier', v)} testid="field-supplier" />
            <EditableField label="Supplier SKU" value={mat.supplier_sku} onChange={(v) => updateField('supplier_sku', v)} testid="field-sku" />
            <EditableField label="Finish"       value={mat.finish}       onChange={(v) => updateField('finish', v)} testid="field-finish" />
            <EditableField label="Thickness"    value={mat.thickness}    onChange={(v) => updateField('thickness', v)} testid="field-thickness" />
            <EditableField label="Origin"       value={mat.origin}       onChange={(v) => updateField('origin', v)} testid="field-origin" />
          </div>

          <div className="space-y-5 pb-6 border-b border-[var(--bp-border)]">
            <EditableField label="Editorial description" value={mat.description}     onChange={(v) => updateField('description', v)}     area testid="field-description" />
            <EditableField label="Technical notes"       value={mat.technical_notes} onChange={(v) => updateField('technical_notes', v)} area testid="field-technical-notes" />
          </div>

          {/* Linked entities */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--bp-text-muted)] font-body mb-3">
              Used in
            </p>
            {linkedProjects.length === 0 && linkedMoodboards.length === 0 && (
              <p className="text-[12px] text-[var(--bp-text-muted)] italic font-body">
                Not yet linked to projects or moodboards
              </p>
            )}
            {linkedProjects.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] uppercase tracking-wider text-[var(--bp-text-muted)] mb-1.5 font-mono">Projects</p>
                <div className="space-y-1">
                  {linkedProjects.map((pid) => (
                    <Link
                      key={pid}
                      to={`/workspace/projects/${pid}`}
                      className="block text-[12px] text-[var(--bp-text-secondary)] hover:text-[var(--bp-primary)] transition-colors"
                    >
                      · {pid?.slice(0, 8)}…
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {linkedMoodboards.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--bp-text-muted)] mb-1.5 font-mono">Moodboards</p>
                <div className="space-y-1">
                  {linkedMoodboards.map((mid) => (
                    <Link
                      key={mid}
                      to={`/moodboards/${mid}`}
                      className="block text-[12px] text-[var(--bp-text-secondary)] hover:text-[var(--bp-primary)] transition-colors"
                    >
                      · {mid?.slice(0, 8)}…
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Danger */}
          <div className="pt-4 border-t border-[var(--bp-border)]">
            <button
              type="button"
              onClick={archive}
              data-testid="archive-material-btn"
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-[4px]
                         border border-red-900/40 text-[11px] text-red-300/80
                         hover:bg-red-900/10 hover:border-red-900/60 hover:text-red-300
                         font-body transition-colors"
            >
              <Archive size={11} />
              Archive material
            </button>
          </div>
        </div>
      </div>

      {attachRole && (
        <AttachAssetModal
          materialId={mat.id}
          role={attachRole}
          onClose={() => setAttachRole(null)}
          onAttached={load}
        />
      )}
    </div>
  );
};

export default MaterialDetailPage;
