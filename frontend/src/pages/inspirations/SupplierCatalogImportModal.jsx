/**
 * SupplierCatalogImportModal — Supplier Catalog Import™
 *
 * 4-step wizard:
 *   1 · Identità del catalogo (brand, collezione, categoria, diritti)
 *   2 · Caricamento PDF + estrazione candidati (PyMuPDF backend)
 *   3 · Revisione assistita (griglia checkable con nome/categoria editabili)
 *   4 · Tagging batch (atmosfera, materia, mercati, luxury, profile) + Importa
 *
 * Linguaggio: editoriale italiano. ZERO jargon ('AI', 'OCR', 'parser', 'algoritmo').
 * Pattern: "MOOD ha preparato le anteprime del catalogo. Puoi selezionare le
 * immagini più utili e organizzarle come riferimenti prodotto."
 */
import React, { useEffect, useMemo, useState } from 'react';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { asErrorString } from '../../lib/asErrorString';
import './supplier-catalog.css';

const STEPS = [
  { key: 'identity',  label: 'Catalogo' },
  { key: 'upload',    label: 'Caricamento' },
  { key: 'review',    label: 'Revisione' },
  { key: 'tagging',   label: 'Tagging e import' },
];

const SupplierCatalogImportModal = ({ open, onClose, config, onImported }) => {
  const [step, setStep] = useState(0);
  const [taxonomy, setTaxonomy] = useState(null);

  // Step 1
  const [brand, setBrand] = useState('');             // legacy free text fallback
  const [brandObj, setBrandObj] = useState(null);     // { id, name, slug, category, … }
  const [collectionObj, setCollectionObj] = useState(null);  // { id, name, brand_id, year, … }
  const [supplierName, setSupplierName] = useState('');
  const [collection, setCollection] = useState('');   // free text fallback (when no collectionObj)
  const [year, setYear] = useState('');
  const [category, setCategory] = useState('arredi');
  const [rightsStatus, setRightsStatus] = useState('studio_uploaded');
  const [showAddBrand, setShowAddBrand] = useState(false);
  const [showAddCollection, setShowAddCollection] = useState(false);

  // Step 2/3
  const [catalogId, setCatalogId] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extraction, setExtraction] = useState(null);   // { candidates, pages, warnings }
  const [candidates, setCandidates] = useState([]);

  // Step 4
  const [batchAtmos, setBatchAtmos]   = useState([]);
  const [batchMat, setBatchMat]       = useState([]);
  const [batchMarkets, setBatchMarkets] = useState([]);
  const [batchLuxury, setBatchLuxury] = useState('');
  const [batchProfile, setBatchProfile] = useState('');
  const [importing, setImporting]   = useState(false);

  useEffect(() => {
    if (!open) return;
    api.get('/api/inspirations/registry/taxonomy')
      .then((r) => setTaxonomy(r.data))
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) {
      // Reset on close
      setStep(0); setCatalogId(null); setExtraction(null); setCandidates([]);
      setBrand(''); setBrandObj(null); setCollectionObj(null);
      setSupplierName(''); setCollection(''); setYear('');
      setCategory('arredi'); setRightsStatus('studio_uploaded');
      setBatchAtmos([]); setBatchMat([]); setBatchMarkets([]);
      setBatchLuxury(''); setBatchProfile('');
      setShowAddBrand(false); setShowAddCollection(false);
    }
  }, [open]);

  if (!open) return null;

  const goNext = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const goPrev = () => setStep((s) => Math.max(s - 1, 0));

  // ── Step 1 → 2: create catalog draft ───────────────────────────
  const createCatalog = async () => {
    if (!brandObj && !brand.trim()) {
      toast.error('Indica il produttore.'); return;
    }
    try {
      const r = await api.post('/api/inspirations/catalogs', {
        brand_id:      brandObj?.id || null,
        brand:         brandObj?.name || brand.trim() || null,
        collection_id: collectionObj?.id || null,
        collection:    collectionObj?.name || collection.trim() || null,
        supplier_name: supplierName.trim() || null,
        catalog_year:  year ? Number(year) : null,
        category,
        rights_status: rightsStatus,
      });
      setCatalogId(r.data.id);
      goNext();
    } catch (e) {
      toast.error(asErrorString(e, 'Impossibile creare il catalogo.'));
    }
  };

  // ── Step 2: upload PDF + extract candidates ────────────────────
  const onFilePick = async (file) => {
    if (!file || !catalogId) return;
    if (!file.type.includes('pdf')) {
      toast.error('Per ora supportiamo solo file PDF. Le immagini singole arriveranno presto.');
      return;
    }
    if (file.size > 60 * 1024 * 1024) {
      toast.error('Il PDF supera i 60 MB. Riduci il file prima di caricarlo.');
      return;
    }
    setExtracting(true);
    try {
      const fd = new FormData();
      fd.append('file', file, file.name);
      const r = await api.post(`/api/inspirations/catalogs/${catalogId}/upload-pdf`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 5 * 60 * 1000,
      });
      setExtraction(r.data);
      setCandidates(r.data.candidates || []);
      goNext();
    } catch (e) {
      toast.error(asErrorString(e, 'Estrazione non riuscita. Riprova con un altro PDF.'));
    } finally {
      setExtracting(false);
    }
  };

  // ── Step 3: edit a candidate locally ───────────────────────────
  const patchCandidate = (page, patch) => {
    setCandidates((prev) => prev.map((c) =>
      c.page_number === page ? { ...c, ...patch } : c
    ));
  };

  // Persist edits (debounced via "Continua" button — we send the whole batch)
  const saveCandidates = async () => {
    if (!catalogId) return;
    try {
      await api.patch(`/api/inspirations/catalogs/${catalogId}/candidates`, {
        candidates: candidates.map((c) => ({
          page_number:   c.page_number,
          product_name:  c.product_name,
          designer:      c.designer,
          category_hint: c.category_hint,
          selected:      c.selected,
        })),
      });
    } catch (e) {
      console.warn('candidates patch failed', e);
    }
  };

  // ── Step 4: finalize → persist as Product Inspirations ─────────
  const finalize = async () => {
    if (!catalogId) return;
    const selectedCount = candidates.filter((c) => c.selected).length;
    if (!selectedCount) {
      toast.error('Seleziona almeno un prodotto prima di importare.');
      return;
    }
    setImporting(true);
    try {
      await saveCandidates();
      const r = await api.post(`/api/inspirations/catalogs/${catalogId}/finalize`, {
        default_atmosphere:   batchAtmos,
        default_material:     batchMat,
        default_markets:      batchMarkets,
        default_luxury_level: batchLuxury || null,
        default_hospitality_profile: batchProfile || null,
      });
      onImported?.(r.data.imported || 0);
    } catch (e) {
      toast.error(asErrorString(e, "Import non riuscito."));
    } finally {
      setImporting(false);
    }
  };

  const selectedCount = candidates.filter((c) => c.selected).length;

  return (
    <div className="scim-backdrop" data-testid="catalog-import-modal" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="scim-modal">
        <header className="scim-head">
          <div>
            <p className="scim-eyebrow">Supplier Catalog Import™</p>
            <h2 className="scim-title">Importa catalogo fornitore</h2>
          </div>
          <button type="button" className="scim-close" onClick={onClose}
                  data-testid="catalog-import-close" aria-label="Chiudi">
            <Icons.X size={16} />
          </button>
        </header>

        <ol className="scim-steps" aria-label="Stato del wizard">
          {STEPS.map((s, i) => (
            <li key={s.key}
                className={`scim-step ${i === step ? 'is-active' : ''} ${i < step ? 'is-done' : ''}`}>
              <span className="scim-step__index">{i + 1}</span>
              <span className="scim-step__label">{s.label}</span>
            </li>
          ))}
        </ol>

        <div className="scim-body">
          {step === 0 && (
            <IdentityStep
              taxonomy={taxonomy}
              brand={brand} setBrand={setBrand}
              brandObj={brandObj} setBrandObj={setBrandObj}
              collectionObj={collectionObj} setCollectionObj={setCollectionObj}
              supplierName={supplierName} setSupplierName={setSupplierName}
              collection={collection} setCollection={setCollection}
              year={year} setYear={setYear}
              category={category} setCategory={setCategory}
              rightsStatus={rightsStatus} setRightsStatus={setRightsStatus}
              onOpenAddBrand={() => setShowAddBrand(true)}
              onOpenAddCollection={() => setShowAddCollection(true)}
            />
          )}

          {step === 1 && (
            <UploadStep
              brand={brand}
              collection={collection}
              onPick={onFilePick}
              extracting={extracting}
            />
          )}

          {step === 2 && (
            <ReviewStep
              extraction={extraction}
              candidates={candidates}
              onPatch={patchCandidate}
              selectedCount={selectedCount}
            />
          )}

          {step === 3 && (
            <TaggingStep
              config={config}
              batchAtmos={batchAtmos}     setBatchAtmos={setBatchAtmos}
              batchMat={batchMat}         setBatchMat={setBatchMat}
              batchMarkets={batchMarkets} setBatchMarkets={setBatchMarkets}
              batchLuxury={batchLuxury}   setBatchLuxury={setBatchLuxury}
              batchProfile={batchProfile} setBatchProfile={setBatchProfile}
              selectedCount={selectedCount}
              brand={brand}
            />
          )}
        </div>

        <footer className="scim-foot">
          {step > 0 && step !== 1 && (
            <button type="button" className="scim-btn-soft" onClick={goPrev}
                    data-testid="catalog-import-back">
              <Icons.ChevronLeft size={12} /> Indietro
            </button>
          )}
          <div className="scim-foot__spacer" />
          {step === 0 && (
            <button type="button" className="scim-btn" onClick={createCatalog}
                    disabled={!brandObj && !brand.trim()}
                    data-testid="catalog-import-create">
              Continua <Icons.ChevronRight size={12} />
            </button>
          )}
          {step === 1 && (
            <p className="scim-hint">
              {extracting
                ? 'MOOD sta preparando le anteprime del catalogo…'
                : 'Carica un PDF per procedere.'}
            </p>
          )}
          {step === 2 && (
            <button type="button" className="scim-btn"
                    onClick={async () => { await saveCandidates(); goNext(); }}
                    disabled={selectedCount === 0}
                    data-testid="catalog-import-confirm-review">
              Continua con {selectedCount} prodotti <Icons.ChevronRight size={12} />
            </button>
          )}
          {step === 3 && (
            <button type="button" className="scim-btn scim-btn--strong"
                    onClick={finalize}
                    disabled={importing}
                    data-testid="catalog-import-finalize">
              {importing
                ? 'Importazione in corso…'
                : <>Importa {selectedCount} prodotti in Inspirations™ <Icons.ChevronRight size={12} /></>}
            </button>
          )}
        </footer>
      </div>

      {/* Mini-drawer: Aggiungi produttore (Brand Registry™) */}
      {showAddBrand && (
        <AddBrandDrawer
          taxonomy={taxonomy}
          markets={config?.markets || []}
          initialName={brand}
          onClose={() => setShowAddBrand(false)}
          onCreated={(b) => {
            setBrandObj(b);
            setBrand(b.name);
            if (b.category) setCategory(b.category);
            setShowAddBrand(false);
            toast.success(`${b.name} aggiunto al Brand Registry™.`);
          }}
        />
      )}

      {/* Mini-drawer: Nuova collezione */}
      {showAddCollection && brandObj && (
        <AddCollectionDrawer
          brand={brandObj}
          onClose={() => setShowAddCollection(false)}
          onCreated={(col) => {
            setCollectionObj(col);
            setCollection(col.name);
            setShowAddCollection(false);
            toast.success(`Collezione “${col.name}” creata.`);
          }}
        />
      )}
    </div>
  );
};


// ── Step 1: identity ────────────────────────────────────────────────
const IdentityStep = ({ taxonomy, brand, setBrand, brandObj, setBrandObj,
                       collectionObj, setCollectionObj,
                       supplierName, setSupplierName,
                       collection, setCollection, year, setYear,
                       category, setCategory, rightsStatus, setRightsStatus,
                       onOpenAddBrand, onOpenAddCollection }) => {
  const rightsMeta = (taxonomy?.rights_permissions || []).find((r) => r.key === rightsStatus);
  return (
    <div className="scim-grid" data-testid="catalog-step-identity">
      <p className="scim-lead">
        Iniziamo dall'identità del catalogo. MOOD userà questi dati per organizzare
        ogni asset come <em>Product Inspiration™</em> dentro il <strong>Brand Registry™</strong> dello studio.
      </p>

      <Field label="Produttore" required>
        <BrandPicker
          value={brandObj}
          freeText={brand}
          onSelect={(b) => {
            setBrandObj(b);
            setBrand(b?.name || '');
            setCollectionObj(null);
            if (b?.category) setCategory(b.category);
          }}
          onFreeText={(s) => { setBrandObj(null); setBrand(s); setCollectionObj(null); }}
          onAddNew={onOpenAddBrand}
        />
        {brandObj && (
          <p className="scim-hint scim-hint--soft" data-testid="catalog-brand-meta">
            <Icons.BadgeCheck size={11} /> {brandObj.name}
            {brandObj.luxury_tier && <> · <em>{brandObj.luxury_tier}</em></>}
            {brandObj.country && <> · {brandObj.country}</>}
            {brandObj.visibility_level === 'studio_private' && <> · <em>privato dello studio</em></>}
          </p>
        )}
      </Field>

      <Field label="Collezione">
        <CollectionPicker
          brand={brandObj}
          value={collectionObj}
          freeText={collection}
          onSelect={(c) => {
            setCollectionObj(c);
            setCollection(c?.name || '');
            if (c?.year) setYear(String(c.year));
          }}
          onFreeText={(s) => { setCollectionObj(null); setCollection(s); }}
          onAddNew={onOpenAddCollection}
        />
      </Field>

      <div className="scim-row">
        <Field label="Anno catalogo">
          <input type="number" className="scim-input" value={year}
                 min="1990" max="2100"
                 onChange={(e) => setYear(e.target.value)}
                 placeholder="2026"
                 data-testid="catalog-field-year" />
        </Field>
        <Field label="Categoria principale">
          <select className="scim-input" value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  data-testid="catalog-field-category">
            {(taxonomy?.categories || []).map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Showroom / Studio (opzionale)">
        <input type="text" className="scim-input" value={supplierName}
               onChange={(e) => setSupplierName(e.target.value)}
               placeholder="Distributore / dealer / showroom"
               data-testid="catalog-field-supplier" />
      </Field>

      <Field label="Rights & Permissions™">
        <select className="scim-input" value={rightsStatus}
                onChange={(e) => setRightsStatus(e.target.value)}
                data-testid="catalog-field-rights">
          {(taxonomy?.rights_permissions || []).map((r) => (
            <option key={r.key} value={r.key}>{r.label}</option>
          ))}
        </select>
        {rightsMeta && (
          <div className="scim-rights-meta" data-testid="catalog-rights-meta">
            <RightsTag on={rightsMeta.publishable}    label="Pubblicabile" />
            <RightsTag on={rightsMeta.exportable}     label="Esportabile" />
            <RightsTag on={rightsMeta.commercial_use} label="Uso commerciale" />
            <RightsTag on={rightsMeta.modifiable}     label="Modificabile" />
          </div>
        )}
      </Field>
    </div>
  );
};

const RightsTag = ({ on, label }) => (
  <span className={`scim-rights-tag ${on ? 'is-on' : ''}`}>
    {on ? <Icons.Check size={10} strokeWidth={2.4} /> : <Icons.X size={10} strokeWidth={2.4} />}
    {label}
  </span>
);


// ── BrandPicker — autocomplete su Brand Registry™ ──────────────────
const BrandPicker = ({ value, freeText, onSelect, onFreeText, onAddNew }) => {
  const [q, setQ]           = useState(value?.name || freeText || '');
  const [items, setItems]   = useState([]);
  const [open, setOpen]     = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setQ(value?.name || freeText || ''); }, [value, freeText]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const t = setTimeout(() => {
      api.get(`/api/inspirations/registry/brands?q=${encodeURIComponent(q)}&limit=20`)
        .then((r) => setItems(r.data?.items || []))
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }, 180);
    return () => clearTimeout(t);
  }, [q, open]);

  return (
    <div className="scim-picker" data-testid="catalog-brand-picker">
      <input type="text" className="scim-input"
             value={q}
             onChange={(e) => { setQ(e.target.value); onFreeText?.(e.target.value); setOpen(true); }}
             onFocus={() => setOpen(true)}
             onBlur={() => setTimeout(() => setOpen(false), 180)}
             placeholder="Cerca produttore (Minotti, Poliform, …)"
             data-testid="catalog-field-brand" />
      {open && (
        <div className="scim-picker__panel" data-testid="catalog-brand-results">
          {loading && <div className="scim-picker__item is-muted">Cerco nel registro…</div>}
          {!loading && items.length === 0 && (
            <div className="scim-picker__item is-muted">Nessun produttore trovato.</div>
          )}
          {items.map((b) => (
            <button key={b.id} type="button"
                    className={`scim-picker__item ${value?.id === b.id ? 'is-on' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { onSelect(b); setOpen(false); }}
                    data-testid={`catalog-brand-opt-${b.slug}`}>
              <div className="scim-picker__item-main">
                <span className="scim-picker__item-name">{b.name}</span>
                {b.category && <span className="scim-picker__item-cat">{b.category}</span>}
              </div>
              <div className="scim-picker__item-meta">
                {b.luxury_tier && <span>{b.luxury_tier}</span>}
                {b.visibility_level === 'studio_private' && <em>· privato</em>}
              </div>
            </button>
          ))}
          <button type="button"
                  className="scim-picker__add"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setOpen(false); onAddNew?.(); }}
                  data-testid="catalog-brand-add-new">
            <Icons.Plus size={11} /> Aggiungi produttore
          </button>
        </div>
      )}
    </div>
  );
};


// ── CollectionPicker — autocomplete delle collezioni del brand ─────
const CollectionPicker = ({ brand, value, freeText, onSelect, onFreeText, onAddNew }) => {
  const [q, setQ]         = useState(value?.name || freeText || '');
  const [items, setItems] = useState([]);
  const [open, setOpen]   = useState(false);

  useEffect(() => { setQ(value?.name || freeText || ''); }, [value, freeText]);

  useEffect(() => {
    if (!open || !brand?.id) { setItems([]); return; }
    api.get(`/api/inspirations/registry/brands/${brand.id}/collections`)
      .then((r) => setItems(r.data?.items || []))
      .catch(() => setItems([]));
  }, [open, brand?.id]);

  const filtered = useMemo(() => {
    if (!q) return items;
    const ql = q.toLowerCase();
    return items.filter((c) => (c.name || '').toLowerCase().includes(ql));
  }, [items, q]);

  return (
    <div className="scim-picker" data-testid="catalog-collection-picker">
      <input type="text" className="scim-input"
             value={q}
             onChange={(e) => { setQ(e.target.value); onFreeText?.(e.target.value); setOpen(true); }}
             onFocus={() => setOpen(true)}
             onBlur={() => setTimeout(() => setOpen(false), 180)}
             placeholder={brand ? `Cerca collezione di ${brand.name}…` : 'Seleziona prima un produttore'}
             disabled={!brand}
             data-testid="catalog-field-collection" />
      {open && brand && (
        <div className="scim-picker__panel">
          {filtered.length === 0 && (
            <div className="scim-picker__item is-muted">
              Nessuna collezione registrata per {brand.name}.
            </div>
          )}
          {filtered.map((c) => (
            <button key={c.id} type="button"
                    className={`scim-picker__item ${value?.id === c.id ? 'is-on' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { onSelect(c); setOpen(false); }}
                    data-testid={`catalog-collection-opt-${c.slug}`}>
              <div className="scim-picker__item-main">
                <span className="scim-picker__item-name">{c.name}</span>
                {c.year && <span className="scim-picker__item-cat">{c.year}</span>}
              </div>
            </button>
          ))}
          <button type="button"
                  className="scim-picker__add"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setOpen(false); onAddNew?.(); }}
                  data-testid="catalog-collection-add-new">
            <Icons.Plus size={11} /> Nuova collezione
          </button>
        </div>
      )}
    </div>
  );
};


// ── AddBrandDrawer — Brand Registry™ insert ─────────────────────────
const AddBrandDrawer = ({ taxonomy, markets, initialName, onClose, onCreated }) => {
  const [name, setName]         = useState(initialName || '');
  const [website, setWebsite]   = useState('');
  const [category, setCategory] = useState('arredi');
  const [country, setCountry]   = useState('');
  const [positioning, setPositioning] = useState('');
  const [primary, setPrimary]   = useState([]);
  const [saving, setSaving]     = useState(false);
  const toggle = (k) => setPrimary((p) => p.includes(k) ? p.filter((x) => x !== k) : [...p, k]);
  const save = async () => {
    if (!name.trim()) { toast.error('Nome obbligatorio'); return; }
    setSaving(true);
    try {
      const r = await api.post('/api/inspirations/registry/brands', {
        name: name.trim(),
        website: website.trim() || null,
        category, country: country.trim() || null,
        positioning: positioning.trim() || null,
        primary_markets: primary,
      });
      onCreated(r.data.item);
    } catch (e) {
      toast.error(asErrorString(e, 'Salvataggio non riuscito'));
    } finally { setSaving(false); }
  };
  return (
    <div className="scim-drawer" data-testid="catalog-add-brand-drawer" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="scim-drawer__panel">
        <header className="scim-drawer__head">
          <p className="scim-eyebrow">Brand Registry™</p>
          <h3 className="scim-drawer__title">Nuovo produttore</h3>
          <button type="button" className="scim-close" onClick={onClose}><Icons.X size={14} /></button>
        </header>
        <div className="scim-drawer__body">
          <Field label="Nome" required>
            <input className="scim-input" value={name} onChange={(e) => setName(e.target.value)}
                   placeholder="es. Walter Knoll" data-testid="add-brand-name" />
          </Field>
          <Field label="Website">
            <input className="scim-input" value={website} onChange={(e) => setWebsite(e.target.value)}
                   placeholder="walterknoll.de" data-testid="add-brand-website" />
          </Field>
          <div className="scim-row">
            <Field label="Categoria">
              <select className="scim-input" value={category} onChange={(e) => setCategory(e.target.value)}
                      data-testid="add-brand-category">
                {(taxonomy?.categories || []).map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Paese">
              <input className="scim-input" value={country} onChange={(e) => setCountry(e.target.value)}
                     placeholder="IT, FR, DE…" maxLength={2} data-testid="add-brand-country" />
            </Field>
          </div>
          <Field label="Positioning curatoriale">
            <input className="scim-input" value={positioning} onChange={(e) => setPositioning(e.target.value)}
                   placeholder="es. editorial luxury · design contemporaneo"
                   data-testid="add-brand-positioning" />
          </Field>
          <Field label="Mercati principali">
            <div className="scim-chips" data-testid="add-brand-markets">
              {markets.map((m) => (
                <button key={m.code} type="button"
                        className={`scim-chip ${primary.includes(m.code) ? 'is-on' : ''}`}
                        onClick={() => toggle(m.code)}>
                  {m.label}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <footer className="scim-drawer__foot">
          <button type="button" className="scim-btn-soft" onClick={onClose}>Annulla</button>
          <button type="button" className="scim-btn" onClick={save} disabled={saving || !name.trim()}
                  data-testid="add-brand-save">
            {saving ? 'Salvataggio…' : 'Salva nel Brand Registry™'}
          </button>
        </footer>
      </div>
    </div>
  );
};


// ── AddCollectionDrawer — collection insert ─────────────────────────
const AddCollectionDrawer = ({ brand, onClose, onCreated }) => {
  const [name, setName]         = useState('');
  const [year, setYear]         = useState('');
  const [season, setSeason]     = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving]     = useState(false);
  const save = async () => {
    if (!name.trim()) { toast.error('Nome obbligatorio'); return; }
    setSaving(true);
    try {
      const r = await api.post(`/api/inspirations/registry/brands/${brand.id}/collections`, {
        name: name.trim(),
        year: year ? Number(year) : null,
        season: season.trim() || null,
        description: description.trim() || null,
      });
      onCreated(r.data.item);
    } catch (e) {
      toast.error(asErrorString(e, 'Salvataggio non riuscito'));
    } finally { setSaving(false); }
  };
  return (
    <div className="scim-drawer" data-testid="catalog-add-collection-drawer" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="scim-drawer__panel">
        <header className="scim-drawer__head">
          <p className="scim-eyebrow">Collections Registry™ · {brand.name}</p>
          <h3 className="scim-drawer__title">Nuova collezione</h3>
          <button type="button" className="scim-close" onClick={onClose}><Icons.X size={14} /></button>
        </header>
        <div className="scim-drawer__body">
          <Field label="Nome collezione" required>
            <input className="scim-input" value={name} onChange={(e) => setName(e.target.value)}
                   placeholder="es. Heritage · 26 Collection"
                   data-testid="add-collection-name" />
          </Field>
          <div className="scim-row">
            <Field label="Anno"><input type="number" className="scim-input" value={year}
                   onChange={(e) => setYear(e.target.value)} placeholder="2026"
                   data-testid="add-collection-year" /></Field>
            <Field label="Stagione"><input className="scim-input" value={season}
                   onChange={(e) => setSeason(e.target.value)} placeholder="Outdoor · Permanent"
                   data-testid="add-collection-season" /></Field>
          </div>
          <Field label="Descrizione">
            <textarea className="scim-input" rows={3} value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Una riga descrittiva…" />
          </Field>
        </div>
        <footer className="scim-drawer__foot">
          <button type="button" className="scim-btn-soft" onClick={onClose}>Annulla</button>
          <button type="button" className="scim-btn" onClick={save} disabled={saving || !name.trim()}
                  data-testid="add-collection-save">
            {saving ? 'Salvataggio…' : 'Salva collezione'}
          </button>
        </footer>
      </div>
    </div>
  );
};


// ── Step 2: upload ──────────────────────────────────────────────────
const UploadStep = ({ brand, collection, onPick, extracting }) => {
  const [dragging, setDragging] = useState(false);
  return (
    <div className="scim-upload" data-testid="catalog-step-upload">
      <p className="scim-lead">
        Carica il PDF del catalogo {brand && <strong>{brand}</strong>}
        {collection && <> · <em>{collection}</em></>}.
        MOOD estrarrà un'anteprima per prodotto da rivedere insieme a te.
      </p>

      <label
        htmlFor="scim-file-input"
        className={`scim-dropzone ${dragging ? 'is-drag' : ''} ${extracting ? 'is-busy' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onPick(f);
        }}
        data-testid="catalog-dropzone"
      >
        <input id="scim-file-input"
               type="file" accept="application/pdf,.pdf"
               style={{ display: 'none' }}
               disabled={extracting}
               onChange={(e) => onPick(e.target.files?.[0])} />
        {extracting ? (
          <>
            <span className="scim-dropzone__pulse" />
            <p className="scim-dropzone__title">MOOD sta preparando le anteprime del catalogo…</p>
            <p className="scim-dropzone__hint">
              I cataloghi più voluminosi richiedono fino a un minuto. Resta su questa schermata.
            </p>
          </>
        ) : (
          <>
            <Icons.UploadCloud size={32} strokeWidth={1.3} />
            <p className="scim-dropzone__title">Trascina qui il PDF del catalogo</p>
            <p className="scim-dropzone__hint">
              oppure clicca per selezionarlo. Limite 60 MB.
            </p>
          </>
        )}
      </label>

      <p className="scim-disclaimer">
        Il PDF sorgente viene conservato in libreria con accesso privato. Solo le
        immagini selezionate diventano Product Inspirations™ visibili nelle moodboard.
      </p>
    </div>
  );
};


// ── Step 3: review ──────────────────────────────────────────────────
const ReviewStep = ({ extraction, candidates, onPatch, selectedCount }) => {
  const [editing, setEditing] = useState(null);  // page_number
  if (!extraction) return null;
  const total = candidates.length;
  return (
    <div className="scim-review" data-testid="catalog-step-review">
      <div className="scim-review__intro">
        <p className="scim-lead">
          MOOD ha preparato {total} anteprime dalle {extraction.pages} pagine del
          catalogo. Seleziona le immagini più utili e correggi i nomi quando serve.
        </p>
        <span className="scim-review__counter" data-testid="catalog-review-counter">
          {selectedCount} di {total} selezionati
        </span>
      </div>

      {(extraction.warnings || []).length > 0 && (
        <ul className="scim-review__warnings">
          {extraction.warnings.map((w, i) => <li key={i}><Icons.Info size={11} /> {w}</li>)}
        </ul>
      )}

      <div className="scim-review__actions">
        <button type="button" className="scim-link" onClick={() =>
          candidates.forEach((c) => onPatch(c.page_number, { selected: true }))}
          data-testid="catalog-review-select-all">
          Seleziona tutto
        </button>
        <button type="button" className="scim-link" onClick={() =>
          candidates.forEach((c) => onPatch(c.page_number, { selected: false }))}
          data-testid="catalog-review-clear">
          Deseleziona tutto
        </button>
        <button type="button" className="scim-link" onClick={() =>
          candidates.forEach((c) => onPatch(c.page_number, { selected: !!c.product_name }))}
          data-testid="catalog-review-select-named">
          Solo i prodotti con nome
        </button>
      </div>

      <div className="scim-grid-cards">
        {candidates.map((c) => (
          <CandidateCard key={c.page_number}
                         c={c}
                         editing={editing === c.page_number}
                         onEditToggle={() => setEditing(editing === c.page_number ? null : c.page_number)}
                         onPatch={(patch) => onPatch(c.page_number, patch)} />
        ))}
      </div>
    </div>
  );
};

const CandidateCard = ({ c, editing, onEditToggle, onPatch }) => (
  <div className={`scim-cand ${c.selected ? 'is-on' : ''}`}
       data-testid={`catalog-cand-${c.page_number}`}>
    <button type="button"
            className="scim-cand__media"
            onClick={() => onPatch({ selected: !c.selected })}
            aria-pressed={c.selected}>
      <img src={c.image_url} alt={c.product_name || `pagina ${c.page_number}`} loading="lazy" />
      <span className={`scim-cand__check ${c.selected ? 'is-on' : ''}`}>
        {c.selected ? <Icons.Check size={12} strokeWidth={2.4} /> : null}
      </span>
      <span className="scim-cand__page">pag. {c.page_number}</span>
    </button>
    <div className="scim-cand__body">
      {editing ? (
        <>
          <input type="text" className="scim-input scim-input--inline"
                 value={c.product_name || ''}
                 onChange={(e) => onPatch({ product_name: e.target.value })}
                 placeholder="Nome prodotto"
                 data-testid={`catalog-cand-name-${c.page_number}`} />
          <input type="text" className="scim-input scim-input--inline"
                 value={c.category_hint || ''}
                 onChange={(e) => onPatch({ category_hint: e.target.value })}
                 placeholder="Categoria" />
          <input type="text" className="scim-input scim-input--inline"
                 value={c.designer || ''}
                 onChange={(e) => onPatch({ designer: e.target.value })}
                 placeholder="Designer (opzionale)" />
          <button type="button" className="scim-link" onClick={onEditToggle}>
            Fatto
          </button>
        </>
      ) : (
        <>
          <p className="scim-cand__name">{c.product_name || <em>Nome da definire</em>}</p>
          {(c.category_hint || c.designer) && (
            <p className="scim-cand__meta">
              {c.category_hint}{c.category_hint && c.designer && ' · '}
              {c.designer && <em>design {c.designer}</em>}
            </p>
          )}
          <button type="button" className="scim-link" onClick={onEditToggle}
                  data-testid={`catalog-cand-edit-${c.page_number}`}>
            <Icons.Pencil size={10} /> Modifica
          </button>
        </>
      )}
    </div>
  </div>
);


// ── Step 4: tagging batch ───────────────────────────────────────────
const TaggingStep = ({ config, batchAtmos, setBatchAtmos, batchMat, setBatchMat,
                      batchMarkets, setBatchMarkets,
                      batchLuxury, setBatchLuxury,
                      batchProfile, setBatchProfile,
                      selectedCount, brand }) => {
  const toggle = (arr, setArr, key) => {
    if (arr.includes(key)) setArr(arr.filter((k) => k !== key));
    else setArr([...arr, key]);
  };
  return (
    <div className="scim-tagging" data-testid="catalog-step-tagging">
      <p className="scim-lead">
        Applica un tagging base a tutti i {selectedCount} prodotti {brand && <>di <strong>{brand}</strong></>}.
        Sono solo i valori di partenza — potrai rifinire ogni Product Inspiration™
        singolarmente in seguito.
      </p>

      <TagGroup title="Atmosfera abituale"
                options={config?.atmosphere_tags || []}
                values={batchAtmos}
                onToggle={(k) => toggle(batchAtmos, setBatchAtmos, k)}
                testid="catalog-tag-atmos" />

      <TagGroup title="Materia"
                options={config?.material_tags || []}
                values={batchMat}
                onToggle={(k) => toggle(batchMat, setBatchMat, k)}
                testid="catalog-tag-mat" />

      <TagGroup title="Mercati di affinità"
                options={config?.markets || []}
                codeKey="code"
                values={batchMarkets}
                onToggle={(k) => toggle(batchMarkets, setBatchMarkets, k)}
                testid="catalog-tag-markets" />

      <div className="scim-row">
        <div>
          <p className="scim-label">Livello luxury</p>
          <select className="scim-input" value={batchLuxury}
                  onChange={(e) => setBatchLuxury(e.target.value)}
                  data-testid="catalog-tag-luxury">
            <option value="">Da definire</option>
            {(config?.luxury_levels || []).map((l) => (
              <option key={l.key} value={l.key}>{l.label}</option>
            ))}
          </select>
        </div>
        <div>
          <p className="scim-label">Destinazione</p>
          <select className="scim-input" value={batchProfile}
                  onChange={(e) => setBatchProfile(e.target.value)}
                  data-testid="catalog-tag-profile">
            <option value="">Da definire</option>
            {(config?.hospitality_profiles || []).map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

const TagGroup = ({ title, options, values, onToggle, codeKey = 'key', testid }) => (
  <div className="scim-taggroup" data-testid={testid}>
    <p className="scim-label">{title}</p>
    <div className="scim-chips">
      {options.map((opt) => {
        const k = opt[codeKey];
        const active = values.includes(k);
        return (
          <button key={k} type="button"
                  className={`scim-chip ${active ? 'is-on' : ''}`}
                  onClick={() => onToggle(k)}>
            {opt.label}
          </button>
        );
      })}
    </div>
  </div>
);


// ── Atom ────────────────────────────────────────────────────────────
const Field = ({ label, required, children }) => (
  <div className="scim-field">
    <label className="scim-label">
      {label}{required && <span className="scim-req">*</span>}
    </label>
    {children}
  </div>
);

export default SupplierCatalogImportModal;
