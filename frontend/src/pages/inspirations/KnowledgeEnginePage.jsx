/**
 * KnowledgeEnginePage — ITER195 Phase 4A.
 *
 * Single-page landing for the Multi-PDF Brand Catalog Ingestion Workspace.
 * Lists brands accessible to the tenant, each with their Catalog Sets.
 * Allows creating a new brand or a new catalog set inline.
 *
 * Path: /inspirations/knowledge-engine
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import KE from '../../lib/knowledgeApi';
import './knowledge-engine.css';

const STATUS_LABEL = {
  draft: 'Bozza',
  uploading: 'Caricamento',
  extracting: 'Estrazione in corso',
  needs_review: 'Da validare',
  validated: 'Validato',
  published: 'Pubblicato',
  archived: 'Archiviato',
};
const STATUS_TONE = {
  draft: 'tone-neutral',
  uploading: 'tone-info',
  extracting: 'tone-info',
  needs_review: 'tone-warning',
  validated: 'tone-positive',
  published: 'tone-positive',
  archived: 'tone-neutral',
};

function NewBrandCard({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [country, setCountry] = useState('IT');
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const { data } = await KE.createBrand({
        name: name.trim(),
        category: category.trim() || null,
        country: country.trim() || null,
      });
      toast.success(`Brand "${data.name}" creato`);
      setName(''); setCategory(''); setOpen(false);
      onCreated?.(data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Errore creazione brand');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ke-newbrand-card" data-testid="ke-new-brand-card">
      {!open ? (
        <button
          type="button"
          className="ke-newbrand-trigger"
          onClick={() => setOpen(true)}
          data-testid="ke-new-brand-btn"
        >
          <Icons.Plus size={18} aria-hidden="true" />
          <span>Nuovo brand</span>
        </button>
      ) : (
        <form className="ke-newbrand-form" onSubmit={submit}>
          <input
            className="ke-input"
            placeholder="Nome brand (es. ARBI Bathroom)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            data-testid="ke-new-brand-name"
          />
          <div className="ke-row-2">
            <input
              className="ke-input"
              placeholder="Categoria (bathroom, kitchen…)"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              data-testid="ke-new-brand-category"
            />
            <input
              className="ke-input"
              placeholder="Paese (IT)"
              value={country}
              maxLength={2}
              onChange={(e) => setCountry(e.target.value.toUpperCase())}
              data-testid="ke-new-brand-country"
            />
          </div>
          <div className="ke-row-2">
            <button
              type="submit"
              className="ke-btn ke-btn-primary"
              disabled={busy || !name.trim()}
              data-testid="ke-new-brand-submit"
            >
              {busy ? 'Salvataggio…' : 'Crea brand'}
            </button>
            <button
              type="button"
              className="ke-btn"
              onClick={() => setOpen(false)}
              data-testid="ke-new-brand-cancel"
            >
              Annulla
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function NewCatalogSetInline({ brandId, onCreated }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const { data } = await KE.createCatalogSet(brandId, { name: name.trim() });
      toast.success(`Catalog Set creato`);
      setName(''); setOpen(false);
      onCreated?.(data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Errore creazione');
    } finally {
      setBusy(false);
    }
  };
  if (!open) {
    return (
      <button
        type="button"
        className="ke-inline-action"
        onClick={() => setOpen(true)}
        data-testid={`ke-new-set-btn-${brandId}`}
      >
        <Icons.Plus size={14} aria-hidden="true" />
        <span>Nuovo Catalog Set</span>
      </button>
    );
  }
  return (
    <form className="ke-inline-form" onSubmit={submit}>
      <input
        className="ke-input ke-input-sm"
        placeholder="Es. ARBI Master Library 2026"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        data-testid={`ke-new-set-name-${brandId}`}
      />
      <button
        type="submit"
        className="ke-btn ke-btn-sm ke-btn-primary"
        disabled={busy || !name.trim()}
        data-testid={`ke-new-set-submit-${brandId}`}
      >
        {busy ? '…' : 'Crea'}
      </button>
      <button
        type="button"
        className="ke-btn ke-btn-sm"
        onClick={() => setOpen(false)}
      >
        Annulla
      </button>
    </form>
  );
}

function CatalogSetRow({ set, onOpen }) {
  const tone = STATUS_TONE[set.status] || 'tone-neutral';
  const label = STATUS_LABEL[set.status] || set.status;
  return (
    <button
      type="button"
      className="ke-set-row"
      onClick={() => onOpen(set.id)}
      data-testid={`ke-set-row-${set.id}`}
    >
      <div className="ke-set-row__left">
        <div className="ke-set-row__title">{set.name}</div>
        <div className="ke-set-row__meta">
          <span>{set.document_count || 0} PDF</span>
          {set.total_pages ? <span> · {set.total_pages} pagine</span> : null}
          {set.extraction_progress > 0 && set.extraction_progress < 100 ? (
            <span> · {Math.round(set.extraction_progress)}% estratto</span>
          ) : null}
        </div>
      </div>
      <div className="ke-set-row__right">
        <span className={`ke-badge ${tone}`}>{label}</span>
        <Icons.ChevronRight size={16} aria-hidden="true" />
      </div>
    </button>
  );
}

function BrandBlock({ brand, onSetCreated, onOpenSet }) {
  const [sets, setSets] = useState(brand._sets || []);
  const [loaded, setLoaded] = useState(Boolean(brand._sets));
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (loaded) return;
    let alive = true;
    (async () => {
      try {
        const { data } = await KE.listCatalogSets(brand.id);
        if (alive) setSets(data.catalog_sets || []);
      } catch (_) { /* tolerate */ }
      if (alive) setLoaded(true);
    })();
    return () => { alive = false; };
  }, [brand.id, loaded]);

  return (
    <section className="ke-brand-block" data-testid={`ke-brand-block-${brand.id}`}>
      <header className="ke-brand-block__head">
        <button
          type="button"
          className="ke-brand-block__toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          data-testid={`ke-brand-toggle-${brand.id}`}
        >
          <Icons.ChevronDown
            size={16}
            aria-hidden="true"
            style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
                     transition: 'transform 160ms ease' }}
          />
          <span className="ke-brand-name">{brand.name}</span>
          <span className="ke-brand-meta">
            {brand.category ? `${brand.category} · ` : ''}
            {brand.country || ''}
          </span>
        </button>
        <NewCatalogSetInline
          brandId={brand.id}
          onCreated={(s) => {
            setSets((prev) => [s, ...prev]);
            onSetCreated?.(brand.id, s);
          }}
        />
      </header>
      {open && (
        <div className="ke-brand-block__sets">
          {sets.length === 0 && loaded ? (
            <div className="ke-empty-sets">
              Nessun Catalog Set. Creane uno per iniziare l'ingestion multi-PDF.
            </div>
          ) : null}
          {sets.map((s) => (
            <CatalogSetRow key={s.id} set={s} onOpen={onOpenSet} />
          ))}
          {!loaded && <div className="ke-empty-sets">Caricamento…</div>}
        </div>
      )}
    </section>
  );
}

export default function KnowledgeEnginePage() {
  const navigate = useNavigate();
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const reload = async () => {
    setLoading(true);
    try {
      const { data } = await KE.listBrands();
      setBrands(data.brands || []);
    } catch (err) {
      toast.error('Impossibile caricare i brand');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) =>
      (b.name || '').toLowerCase().includes(q)
      || (b.category || '').toLowerCase().includes(q)
      || (b.country || '').toLowerCase().includes(q)
    );
  }, [brands, filter]);

  const openSet = (setId) => {
    navigate(`/inspirations/knowledge-engine/catalog-sets/${setId}`);
  };

  return (
    <div className="ke-page" data-testid="ke-page">
      <header className="ke-page__head">
        <div>
          <div className="ke-eyebrow">MOOD AI KNOWLEDGE ENGINE™</div>
          <h1 className="ke-title">Workspace ingestion multi-PDF</h1>
          <p className="ke-subtitle">
            Crea un brand, raggruppa i suoi cataloghi in un Catalog Set, lancia
            l'estrazione e valida il <strong>Brand Knowledge Package™</strong>
            prima della pubblicazione.
          </p>
        </div>
        <div className="ke-page__head-actions">
          <input
            className="ke-input ke-input-search"
            placeholder="Filtra brand…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            data-testid="ke-filter-brands"
          />
          <button
            type="button"
            className="ke-btn"
            onClick={reload}
            data-testid="ke-refresh-brands"
            aria-label="Ricarica"
          >
            <Icons.RefreshCw size={14} aria-hidden="true" />
            <span>Aggiorna</span>
          </button>
        </div>
      </header>

      <NewBrandCard onCreated={(b) => setBrands((prev) => [b, ...prev])} />

      {loading ? (
        <div className="ke-loading" data-testid="ke-loading">
          <Icons.Loader2 className="ke-spin" size={18} />
          <span>Caricamento brand…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="ke-empty" data-testid="ke-empty">
          {filter
            ? 'Nessun brand corrisponde al filtro.'
            : 'Nessun brand ancora. Crea il primo per iniziare.'}
        </div>
      ) : (
        <div className="ke-brand-list" data-testid="ke-brand-list">
          {filtered.map((b) => (
            <BrandBlock
              key={b.id}
              brand={b}
              onOpenSet={openSet}
            />
          ))}
        </div>
      )}
    </div>
  );
}
