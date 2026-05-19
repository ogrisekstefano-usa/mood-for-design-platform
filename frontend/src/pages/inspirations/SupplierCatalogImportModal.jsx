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
  const [brand, setBrand] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [collection, setCollection] = useState('');
  const [year, setYear] = useState('');
  const [category, setCategory] = useState('arredi');
  const [rightsStatus, setRightsStatus] = useState('uploaded_by_tenant');

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
    api.get('/api/inspirations/catalogs/taxonomy')
      .then((r) => setTaxonomy(r.data))
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) {
      // Reset on close
      setStep(0); setCatalogId(null); setExtraction(null); setCandidates([]);
      setBrand(''); setSupplierName(''); setCollection(''); setYear('');
      setCategory('arredi'); setRightsStatus('uploaded_by_tenant');
      setBatchAtmos([]); setBatchMat([]); setBatchMarkets([]);
      setBatchLuxury(''); setBatchProfile('');
    }
  }, [open]);

  if (!open) return null;

  const goNext = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const goPrev = () => setStep((s) => Math.max(s - 1, 0));

  // ── Step 1 → 2: create catalog draft ───────────────────────────
  const createCatalog = async () => {
    if (!brand.trim()) { toast.error('Indica il nome del brand o fornitore.'); return; }
    try {
      const r = await api.post('/api/inspirations/catalogs', {
        brand: brand.trim(),
        supplier_name: supplierName.trim() || null,
        collection:    collection.trim() || null,
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
              supplierName={supplierName} setSupplierName={setSupplierName}
              collection={collection} setCollection={setCollection}
              year={year} setYear={setYear}
              category={category} setCategory={setCategory}
              rightsStatus={rightsStatus} setRightsStatus={setRightsStatus}
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
                    disabled={!brand.trim()}
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
    </div>
  );
};


// ── Step 1: identity ────────────────────────────────────────────────
const IdentityStep = ({ taxonomy, brand, setBrand, supplierName, setSupplierName,
                       collection, setCollection, year, setYear,
                       category, setCategory, rightsStatus, setRightsStatus }) => (
  <div className="scim-grid" data-testid="catalog-step-identity">
    <p className="scim-lead">
      Iniziamo dall'identità del catalogo. MOOD userà questi dati per organizzare
      ogni asset estratto come <em>Product Inspiration™</em> dentro la tua libreria.
    </p>

    <Field label="Brand o fornitore" required>
      <input type="text" className="scim-input" value={brand}
             onChange={(e) => setBrand(e.target.value)}
             placeholder="es. Bonaldo · Minotti · Margraf"
             data-testid="catalog-field-brand" />
    </Field>

    <Field label="Collezione">
      <input type="text" className="scim-input" value={collection}
             onChange={(e) => setCollection(e.target.value)}
             placeholder="es. 26 Collection · Heritage · Outdoor 2026"
             data-testid="catalog-field-collection" />
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

    <Field label="Origine dei contenuti">
      <select className="scim-input" value={rightsStatus}
              onChange={(e) => setRightsStatus(e.target.value)}
              data-testid="catalog-field-rights">
        {(taxonomy?.rights_statuses || []).map((r) => (
          <option key={r.key} value={r.key}>{r.label}</option>
        ))}
      </select>
      <p className="scim-hint scim-hint--soft">
        Contenuto caricato dallo studio. Verifica i diritti d'uso prima della
        pubblicazione esterna.
      </p>
    </Field>
  </div>
);


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
