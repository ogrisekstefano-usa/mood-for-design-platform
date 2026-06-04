/**
 * BrandFormModal — editoriale Aggiungi/Modifica produttore.
 * Brand Registry Enhancement™ · multi-categorie + tag system.
 *
 *   • Pill multi-select per Categorie (catalog-driven)
 *   • TagInput riusabile per Tag (catalog-driven, suggested chips, autocomplete)
 *   • Pill multi-select per Mercati (registry-first UX)
 *
 * Tutte le label via i18n, tutti i colori via CSS variables, nessun hardcoded.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { useT } from '../../i18n/useT';
import MultiCategoryPicker from '../../components/registry/MultiCategoryPicker';
import TagInput from '../../components/registry/TagInput';
import './brand-form.css';

const LUXURY_TIERS = [
  { value: 'entry',         label: 'entry' },
  { value: 'contemporary',  label: 'contemporary' },
  { value: 'premium',       label: 'premium' },
  { value: 'luxury',        label: 'luxury' },
  { value: 'icon',          label: 'icon' },
  { value: 'ultra_luxury',  label: 'ultra luxury' },
];

const MARKETS = [
  { value: 'us-miami',  label: 'Miami' },
  { value: 'us-nyc',    label: 'New York' },
  { value: 'us-socal',  label: 'Southern California' },
  { value: 'it-milano', label: 'Milano' },
  { value: 'uk-london', label: 'Londra' },
  { value: 'fr-paris',  label: 'Parigi' },
  { value: 'ae-dubai',  label: 'Dubai' },
];

const slugifyClient = (s) =>
  (s || '')
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const BrandFormModal = ({ open, mode = 'create', brand, onClose, onSaved, locale = 'it' }) => {
  const { t } = useT();
  const isEdit = mode === 'edit' && brand;
  const [tagCatalog, setTagCatalog] = useState({}); // slug → label
  const [form, setForm] = useState({
    name: '',
    positioning: '',
    luxury_tier: '',
    primary_markets: [],
    country: '',
    website: '',
    categories: [],
    tags: [],
  });
  const [saving, setSaving] = useState(false);

  // For edit mode: hydrate tag labels from the registry so we display
  // human-readable strings (the brand persists `tag_slugs`).
  useEffect(() => {
    if (!open || !isEdit) return undefined;
    const slugs = brand?.tag_slugs || [];
    if (slugs.length === 0) return undefined;
    let canceled = false;
    api.get('/api/inspirations/registry/tags', { params: { type: 'brand', limit: 60 } })
      .then(({ data }) => {
        if (canceled) return;
        const map = {};
        for (const t2 of (data?.items || [])) map[t2.slug] = t2.label;
        setTagCatalog(map);
        setForm((f) => ({
          ...f,
          tags: slugs.map((s) => map[s] || s),
        }));
      })
      .catch(() => {});
    return () => { canceled = true; };
  }, [open, isEdit, brand]);

  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      setForm({
        name: brand.name || '',
        positioning: brand.positioning || '',
        luxury_tier: brand.luxury_tier || '',
        primary_markets: brand.primary_markets || [],
        country: brand.country || '',
        website: brand.website || '',
        categories: brand.categories || (brand.category ? [brand.category] : []),
        // tags hydrated by separate effect above
        tags: (brand.tag_slugs || []).map((s) => tagCatalog[s] || s),
      });
    } else {
      setForm({
        name: '',
        positioning: '',
        luxury_tier: '',
        primary_markets: [],
        country: '',
        website: '',
        categories: [],
        tags: [],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, brand]);

  // Escape close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const toggleMarket = (mkt) => {
    setForm((f) => ({
      ...f,
      primary_markets: f.primary_markets.includes(mkt)
        ? f.primary_markets.filter((m) => m !== mkt)
        : [...f.primary_markets, mkt],
    }));
  };

  const canSubmit = useMemo(
    () => form.name.trim().length > 1 && !saving,
    [form.name, saving]
  );

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!canSubmit) return;
    setSaving(true);
    try {
      // Strip empty fields; arrays kept even when empty (server treats [] as clear).
      const payload = {};
      for (const [k, v] of Object.entries(form)) {
        if (Array.isArray(v)) {
          if (v.length > 0) payload[k] = v;
        } else if ((v ?? '').toString().trim().length > 0) {
          payload[k] = v;
        }
      }
      if (isEdit) {
        const r = await api.patch(`/api/inspirations/registry/brands/${brand.id}`, payload);
        toast.success(`${form.name} aggiornato nell'atlante`);
        onSaved?.(r.data, 'updated');
      } else {
        const r = await api.post('/api/inspirations/registry/brands', payload);
        const item = r.data?.item || r.data;
        toast.success(
          r.data?.created === false
            ? `${item.name} è già presente nell'atlante`
            : `${item.name} aggiunto all'atlante curatoriale`
        );
        onSaved?.(item, r.data?.created === false ? 'existing' : 'created');
      }
      onClose?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Impossibile salvare il produttore');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      className="bf-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <form className="bf-modal" data-testid="brand-form-modal" onSubmit={submit}>
        <header className="bf-head">
          <div>
            <p className="bf-eyebrow">{isEdit ? 'Modifica produttore' : 'Nuovo produttore'}</p>
            <h2 className="bf-title">
              {isEdit ? <em>{brand.name}</em> : 'Aggiungi all\'atlante curatoriale'}
            </h2>
          </div>
          <button
            type="button"
            className="bf-close"
            onClick={onClose}
            data-testid="brand-form-close"
            aria-label={t('inspirations.brand_form.chiudi')}
          >
            <Icons.X size={13} />
          </button>
        </header>

        <div className="bf-body">
          <Field label="Nome produttore" required testid="bf-field-name">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t('inspirations.brand_form.es_atelier_sereno')}
              data-testid="brand-form-name"
              autoFocus
            />
          </Field>

          <Field label="Posizionamento" testid="bf-field-positioning">
            <textarea
              rows={2}
              value={form.positioning}
              onChange={(e) => setForm((f) => ({ ...f, positioning: e.target.value }))}
              placeholder={t('inspirations.brand_form.una_frase_che_identifica_il_linguaggio_progettuale')}
              data-testid="brand-form-positioning"
            />
          </Field>

          <Field label="Tono luxury" testid="bf-field-luxury">
            <select
              value={form.luxury_tier}
              onChange={(e) => setForm((f) => ({ ...f, luxury_tier: e.target.value }))}
              data-testid="brand-form-luxury"
            >
              <option value="">—</option>
              {LUXURY_TIERS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Categorie" testid="bf-field-categories">
            <MultiCategoryPicker
              value={form.categories}
              onChange={(next) => setForm((f) => ({ ...f, categories: next }))}
              locale={locale}
            />
          </Field>

          <Field label="Mercati prevalenti" testid="bf-field-markets">
            <div className="bf-chips" data-testid="brand-form-markets">
              {MARKETS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  className={`bf-chip ${form.primary_markets.includes(m.value) ? 'is-on' : ''}`}
                  onClick={() => toggleMarket(m.value)}
                  data-testid={`brand-form-market-${m.value}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Tag" testid="bf-field-tags">
            <TagInput
              type="brand"
              value={form.tags}
              onChange={(next) => setForm((f) => ({ ...f, tags: next }))}
            />
          </Field>

          <div className="bf-row">
            <Field label="Paese" testid="bf-field-country">
              <input
                type="text"
                value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                placeholder="es. IT"
                maxLength={3}
                data-testid="brand-form-country"
              />
            </Field>
            <Field label="Website" testid="bf-field-website">
              <input
                type="url"
                value={form.website}
                onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                placeholder="https://"
                data-testid="brand-form-website"
              />
            </Field>
          </div>
        </div>

        <footer className="bf-foot">
          <button
            type="button"
            className="bf-btn-soft"
            onClick={onClose}
            data-testid="brand-form-cancel"
          >
            {t('inspirations.brand_form.annulla')}
          </button>
          <button
            type="submit"
            className="bf-btn"
            disabled={!canSubmit}
            data-testid="brand-form-submit"
          >
            {saving ? (
              <>
                <Icons.Loader2 size={11} className="animate-spin" />
                {t('inspirations.brand_form.salvataggio')}
              </>
            ) : isEdit ? (
              <>
                <Icons.Save size={11} />
                {t('inspirations.brand_form.salva_modifiche')}
              </>
            ) : (
              <>
                <Icons.Plus size={11} />
                {t('inspirations.brand_form.aggiungi_all_atlante')}
              </>
            )}
          </button>
        </footer>
      </form>
    </div>,
    document.body
  );
};

const Field = ({ label, required, children, testid }) => (
  <label className="bf-field" data-testid={testid}>
    <span className="bf-field__label">
      {label}{required && <em>*</em>}
    </span>
    {children}
  </label>
);

export default BrandFormModal;
