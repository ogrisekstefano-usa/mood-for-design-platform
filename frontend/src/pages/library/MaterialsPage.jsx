/**
 * MaterialsPage — Material Registry list (Phase N.3).
 *
 * Materials are first-class entities (NOT tags). Each has its own page
 * with images (slab / finish / render / catalog), supplier, technical
 * notes, linked projects/moodboards.
 *
 * Surface: Blueprint OS dark cinematic.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Gem, Plus, Search, Loader2, X, Archive } from 'lucide-react';
import { materials as matApi } from '../../lib/mediaApi';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { toast } from 'sonner';
import ArchiveBanner from '../../components/journey/ArchiveBanner';
import '../journey/step-workspace.css';
import { useT } from "../../i18n/useT";
const CATEGORIES = [{
  id: 'stone',
  label: 'Stone'
}, {
  id: 'wood',
  label: 'Wood'
}, {
  id: 'fabric',
  label: 'Fabric'
}, {
  id: 'metal',
  label: 'Metal'
}, {
  id: 'glass',
  label: 'Glass'
}, {
  id: 'ceramic',
  label: 'Ceramic'
}, {
  id: 'leather',
  label: 'Leather'
}, {
  id: 'paint',
  label: 'Paint'
}, {
  id: 'other',
  label: 'Other'
}];
const NewMaterialModal = ({
  onClose,
  onCreated
}) => {
  const {
    t
  } = useT();
  const [form, setForm] = useState({
    name: '',
    category: '',
    subcategory: '',
    supplier: '',
    finish: '',
    thickness: '',
    origin: '',
    description: ''
  });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const m = await matApi.create({
        name: form.name.trim(),
        category: form.category || null,
        subcategory: form.subcategory || null,
        supplier: form.supplier || null,
        finish: form.finish || null,
        thickness: form.thickness || null,
        origin: form.origin || null,
        description: form.description || null
      });
      toast.success('Material created');
      onCreated?.(m);
      onClose();
    } catch (e) {
      toast.error('Create failed');
    } finally {
      setSaving(false);
    }
  };
  const F = ({
    label,
    k,
    area,
    ...rest
  }) => <div>
      <label className="block text-[9px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] mb-1 font-body">
        {label}
      </label>
      {area ? <textarea rows={3} value={form[k]} onChange={e => setForm(f => ({
      ...f,
      [k]: e.target.value
    }))} className="w-full bg-transparent border border-[var(--bp-border)] rounded-[4px] py-1.5 px-2 text-[13px]
                     text-[var(--bp-text-primary)] focus:outline-none focus:border-[var(--bp-primary)] transition-colors" {...rest} /> : <input type="text" value={form[k]} onChange={e => setForm(f => ({
      ...f,
      [k]: e.target.value
    }))} className="w-full bg-transparent border-0 border-b border-[var(--bp-border)] py-1.5 text-[13px]
                     text-[var(--bp-text-primary)] focus:outline-none focus:border-[var(--bp-primary)] transition-colors" {...rest} />}
    </div>;
  return <div data-testid="new-material-modal" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-2xl bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-md p-6 max-h-[90vh] overflow-y-auto">
        <p className="text-[9px] uppercase tracking-[0.28em] text-[var(--bp-text-muted)] font-body mb-1">
          New
        </p>
        <h3 className="text-[20px] font-heading tracking-tight text-[var(--bp-text-primary)] mb-6">
          {t("library.materials.register_material")}
        </h3>

        <div className="grid grid-cols-2 gap-5">
          <div className="col-span-2">
            <F label="Name" k="name" autoFocus placeholder="Taj Mahal Quartzite" data-testid="material-name-input" />
          </div>
          <div>
            <label className="block text-[9px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] mb-1 font-body">
              Category
            </label>
            <select value={form.category} onChange={e => setForm(f => ({
            ...f,
            category: e.target.value
          }))} data-testid="material-category-select" className="w-full bg-transparent border-0 border-b border-[var(--bp-border)] py-1.5 text-[13px]
                         text-[var(--bp-text-primary)] focus:outline-none focus:border-[var(--bp-primary)] transition-colors">
              <option value="">—</option>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <F label="Subcategory" k="subcategory" placeholder="Quartzite, oak, boucle…" />
          <F label="Supplier" k="supplier" placeholder="Antolini, Boffi…" />
          <F label="Finish" k="finish" placeholder="Polished / Matte / Brushed" />
          <F label="Thickness" k="thickness" placeholder="20mm, 1.2cm" />
          <F label="Origin" k="origin" placeholder="Brazil, Carrara, Italy…" />
          <div className="col-span-2">
            <F label="Editorial description" k="description" area placeholder="Quartzite with cream tone and gold + copper veins…" />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onClose} data-testid="new-material-cancel-btn" className="px-3 py-1.5 text-[12px] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] font-body">
            Cancel
          </button>
          <button type="button" disabled={!form.name.trim() || saving} onClick={submit} data-testid="new-material-submit-btn" className="px-4 py-1.5 rounded-[4px] bg-[var(--bp-primary)] text-black font-body text-[12px]
                       hover:opacity-90 transition-opacity disabled:opacity-40">
            {saving ? 'Creating…' : 'Create material'}
          </button>
        </div>
      </div>
    </div>;
};
const MaterialCard = ({
  material
}) => <Link to={`/library/materials/${material.slug}`} data-testid={`material-card-${material.slug}`} className="group block rounded-md border border-[var(--bp-border)] bg-[var(--bp-surface-1)]
               hover:border-[var(--bp-border-strong)] transition-colors overflow-hidden">
    <div className="aspect-[4/5] bg-[var(--bp-surface-2)] relative overflow-hidden">
      {material.primary_asset?.file_url || material.primary_asset?.display_url ? <img src={material.primary_asset.display_url || material.primary_asset.file_url} alt={material.primary_asset.alt_text || material.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center" style={{
      background: material.dominant_color || undefined
    }}>
          <Gem size={28} className="text-[var(--bp-text-muted)] opacity-60" strokeWidth={1.3} />
        </div>}
      {material.asset_count > 0 && <div className="absolute top-3 right-3 px-2 py-0.5 rounded
                        bg-black/60 text-white/90 text-[10px] font-mono uppercase tracking-wider">
          {material.asset_count} assets
        </div>}
    </div>
    <div className="p-4">
      {material.category && <p className="text-[9px] uppercase tracking-[0.28em] text-[var(--bp-text-muted)] font-body mb-1.5">
          {material.subcategory || material.category}
        </p>}
      <h3 className="text-[15px] font-heading tracking-tight text-[var(--bp-text-primary)] mb-1 truncate">
        {material.name}
      </h3>
      <div className="flex items-center gap-2 text-[11px] text-[var(--bp-text-muted)] font-body">
        {material.supplier && <span className="truncate">{material.supplier}</span>}
        {material.finish && <>
            <span>·</span>
            <span className="truncate">{material.finish}</span>
          </>}
      </div>
    </div>
  </Link>;
const MaterialsPage = () => {
  const {
    t
  } = useT();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (q) params.q = q;
      if (category) params.category = category;
      const r = await matApi.list(params);
      setMaterials(r.data || []);
    } finally {
      setLoading(false);
    }
  }, [q, category]);
  useEffect(() => {
    const h = setTimeout(load, 250);
    return () => clearTimeout(h);
  }, [load]);
  return <div data-testid="materials-page" className="flex flex-col h-full bg-[var(--bp-bg)]">
      {/* Sprint G.6 · Archive context — la pagina è una vista trasversale,
          NON un workspace. Le materie scelte vivono nel capitolo
          Material Direction™ del singolo Journey. */}
      <div className="px-10 pt-10">
        <ArchiveBanner testid="materials-archive-banner" eyebrow="Archivio · Sprint G.6" title={t("library.materials.le_materie_scelte_vivono_dentro_i_loro_journey")} lede="Questo archivio elenca ogni voce materica registrata dallo studio. Selezione, alternative e decisioni materiche di un progetto si trovano nel Material Direction™ del Design Journey." ctaLabel="Apri Blueprint Dashboard" ctaTo="/dashboard" />
      </div>
      {/* Hero */}
      <div className="px-10 pt-10 pb-8 border-b border-[var(--bp-border)]">
        <p className="text-[9px] tracking-[0.28em] uppercase text-[var(--bp-text-muted)] font-body mb-2">
          {t("library.materials.material_registry")}
        </p>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-[36px] font-heading tracking-tight text-[var(--bp-text-primary)] leading-none">
              Materials
            </h1>
            <p className="mt-3 text-[14px] text-[var(--bp-text-muted)] font-body max-w-xl leading-relaxed">
              Every stone, wood, fabric and finish your studio works with — registered
              as a first-class entity. Slab images, technical specs, suppliers, and the projects
              they live in. One archive, every reference.
            </p>
          </div>
          <button type="button" onClick={() => setShowNew(true)} data-testid="new-material-btn" className="inline-flex items-center gap-2 px-4 py-2 rounded-[5px] bg-[var(--bp-primary)] text-black
                       hover:opacity-90 transition-opacity text-[13px] font-body">
            <Plus size={14} />
            {t("library.materials.register_material")}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-10 py-4 border-b border-[var(--bp-border)] flex items-center gap-4 flex-wrap">
        <div className="flex-1 max-w-md relative min-w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--bp-text-muted)]" />
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search materials, suppliers, finishes…" data-testid="materials-search-input" className="w-full bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[5px]
                       pl-9 pr-3 py-2 text-[13px] text-[var(--bp-text-primary)]
                       focus:outline-none focus:border-[var(--bp-primary)]/50 transition-colors" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button type="button" onClick={() => setCategory('')} data-testid="filter-category-all" className={`px-3 py-1 rounded-full text-[11px] font-body uppercase tracking-wider transition-colors ${!category ? 'bg-[var(--bp-primary)]/10 text-[var(--bp-primary)] border border-[var(--bp-primary)]/30' : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] border border-[var(--bp-border)]'}`}>
            All
          </button>
          {CATEGORIES.map(c => <button key={c.id} type="button" onClick={() => setCategory(c.id)} data-testid={`filter-category-${c.id}`} className={`px-3 py-1 rounded-full text-[11px] font-body uppercase tracking-wider transition-colors ${category === c.id ? 'bg-[var(--bp-primary)]/10 text-[var(--bp-primary)] border border-[var(--bp-primary)]/30' : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] border border-[var(--bp-border)]'}`}>
              {c.label}
            </button>)}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-10 py-8">
        {loading && materials.length === 0 ? <div className="h-64 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-[var(--bp-text-muted)]" />
          </div> : materials.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-center pt-12">
            <div className="w-16 h-16 rounded-full bg-[var(--bp-surface-2)] border border-[var(--bp-border)] flex items-center justify-center mb-4">
              <Gem size={24} className="text-[var(--bp-text-muted)]" strokeWidth={1.3} />
            </div>
            <p className="text-[9px] tracking-[0.28em] uppercase text-[var(--bp-text-muted)] mb-2 font-body">
              No materials yet
            </p>
            <h3 className="text-[22px] font-heading tracking-tight text-[var(--bp-text-primary)] mb-2">
              Build your material library
            </h3>
            <p className="text-[13px] text-[var(--bp-text-muted)] font-body max-w-md mb-6 leading-relaxed">
              Each material becomes its own page with slab images, supplier, finish, and every project it's used in.
            </p>
            <button type="button" onClick={() => setShowNew(true)} data-testid="empty-state-new-material-btn" className="inline-flex items-center gap-2 px-5 py-2 rounded-[5px] bg-[var(--bp-primary)] text-black
                         hover:opacity-90 transition-opacity text-[13px] font-body">
              <Plus size={14} />
              {t("library.materials.register_first_material")}
            </button>
          </div> : <div className="grid gap-5" style={{
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))'
      }} data-testid="materials-grid">
            {materials.map(m => <MaterialCard key={m.id} material={m} />)}
          </div>}
      </div>

      {showNew && <NewMaterialModal onClose={() => setShowNew(false)} onCreated={() => load()} />}
    </div>;
};
export default MaterialsPage;