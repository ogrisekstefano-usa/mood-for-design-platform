/**
 * BrandFormModal — editoriale Aggiungi/Modifica produttore.
 * Phase E · Sprint E1.
 *
 * Stile: atelier curatoriale, NON form enterprise.
 *   • dark layered + soft glow + Playfair italic eyebrow
 *   • select per luxury_tier / mercati (registry-first UX, NO input liberi)
 *   • bottoni pill rounded, conferma elegante
 *
 * Linguaggio: "produttore", "posizionamento", "mercati prevalenti",
 * "atmosfera dominante", "note curatoriale".
 * MAI: vendor, supplier, brand entity.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import './brand-form.css';

// Curated taxonomies (mirrors backend BrandCreate / BrandUpdate accepted values)
import { useT } from "../../i18n/useT";
const LUXURY_TIERS = [{
  value: 'entry',
  label: 'entry'
}, {
  value: 'contemporary',
  label: 'contemporary'
}, {
  value: 'premium',
  label: 'premium'
}, {
  value: 'luxury',
  label: 'luxury'
}, {
  value: 'icon',
  label: 'icon'
}, {
  value: 'ultra_luxury',
  label: 'ultra luxury'
}];
const MARKETS = [{
  value: 'us-miami',
  label: 'Miami'
}, {
  value: 'us-nyc',
  label: 'New York'
}, {
  value: 'us-socal',
  label: 'Southern California'
}, {
  value: 'it-milano',
  label: 'Milano'
}, {
  value: 'uk-london',
  label: 'Londra'
}, {
  value: 'fr-paris',
  label: 'Parigi'
}, {
  value: 'ae-dubai',
  label: 'Dubai'
}];
const CATEGORIES = [{
  value: 'arredi',
  label: 'Arredi'
}, {
  value: 'illuminazione',
  label: 'Illuminazione'
}, {
  value: 'outdoor',
  label: 'Outdoor'
}, {
  value: 'cucine',
  label: 'Cucine'
}, {
  value: 'bagni',
  label: 'Bagni'
}, {
  value: 'rivestimenti',
  label: 'Rivestimenti'
}, {
  value: 'pietra_naturale',
  label: 'Pietra naturale'
}, {
  value: 'decor',
  label: 'Decor'
}, {
  value: 'hospitality',
  label: 'Hospitality'
}, {
  value: 'workspace',
  label: 'Workspace'
}, {
  value: 'materials',
  label: 'Materials'
}];
const BrandFormModal = ({
  open,
  mode = 'create',
  brand,
  onClose,
  onSaved
}) => {
  const {
    t
  } = useT();
  const isEdit = mode === 'edit' && brand;
  const [form, setForm] = useState({
    name: '',
    positioning: '',
    luxury_tier: '',
    primary_markets: [],
    country: '',
    website: '',
    category: ''
  });
  const [saving, setSaving] = useState(false);
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
        category: brand.category || ''
      });
    } else {
      setForm({
        name: '',
        positioning: '',
        luxury_tier: '',
        primary_markets: [],
        country: '',
        website: '',
        category: ''
      });
    }
  }, [open, isEdit, brand]);

  // Escape close
  useEffect(() => {
    if (!open) return;
    const onKey = e => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  const toggleMarket = mkt => {
    setForm(f => ({
      ...f,
      primary_markets: f.primary_markets.includes(mkt) ? f.primary_markets.filter(m => m !== mkt) : [...f.primary_markets, mkt]
    }));
  };
  const canSubmit = useMemo(() => form.name.trim().length > 1 && !saving, [form.name, saving]);
  const submit = async e => {
    e?.preventDefault?.();
    if (!canSubmit) return;
    setSaving(true);
    try {
      // Strip empty fields so we don't store empty strings as positioning, etc.
      const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => Array.isArray(v) ? v.length > 0 : v?.toString().trim().length > 0));
      if (isEdit) {
        const r = await api.patch(`/api/inspirations/registry/brands/${brand.id}`, payload);
        toast.success(`${form.name} aggiornato nell'atlante`);
        onSaved?.(r.data, 'updated');
      } else {
        const r = await api.post('/api/inspirations/registry/brands', payload);
        const item = r.data?.item || r.data;
        toast.success(r.data?.created === false ? `${item.name} è già presente nell'atlante` : `${item.name} aggiunto all'atlante curatoriale`);
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
  return createPortal(<div className="bf-backdrop" onMouseDown={e => {
    if (e.target === e.currentTarget) onClose?.();
  }}>
      <form className="bf-modal" data-testid="brand-form-modal" onSubmit={submit}>
        <header className="bf-head">
          <div>
            <p className="bf-eyebrow">{isEdit ? 'Modifica produttore' : 'Nuovo produttore'}</p>
            <h2 className="bf-title">
              {isEdit ? <em>{brand.name}</em> : 'Aggiungi all\'atlante curatoriale'}
            </h2>
          </div>
          <button type="button" className="bf-close" onClick={onClose} data-testid="brand-form-close" aria-label={t("inspirations.brand_form.chiudi")}>
            <Icons.X size={13} />
          </button>
        </header>

        <div className="bf-body">
          <Field label="Nome produttore" required testid="bf-field-name">
            <input type="text" value={form.name} onChange={e => setForm(f => ({
            ...f,
            name: e.target.value
          }))} placeholder={t("inspirations.brand_form.es_atelier_sereno")} data-testid="brand-form-name" autoFocus />
          </Field>

          <Field label="Posizionamento curatoriale" testid="bf-field-positioning">
            <textarea rows={2} value={form.positioning} onChange={e => setForm(f => ({
            ...f,
            positioning: e.target.value
          }))} placeholder={t("inspirations.brand_form.una_frase_che_identifica_il_linguaggio_progettuale")} data-testid="brand-form-positioning" />
          </Field>

          <div className="bf-row">
            <Field label="Tono luxury" testid="bf-field-luxury">
              <select value={form.luxury_tier} onChange={e => setForm(f => ({
              ...f,
              luxury_tier: e.target.value
            }))} data-testid="brand-form-luxury">
                <option value="">—</option>
                {LUXURY_TIERS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </Field>
            <Field label="Categoria principale" testid="bf-field-category">
              <select value={form.category} onChange={e => setForm(f => ({
              ...f,
              category: e.target.value
            }))} data-testid="brand-form-category">
                <option value="">—</option>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Mercati prevalenti" testid="bf-field-markets">
            <div className="bf-chips" data-testid="brand-form-markets">
              {MARKETS.map(m => <button key={m.value} type="button" className={`bf-chip ${form.primary_markets.includes(m.value) ? 'is-on' : ''}`} onClick={() => toggleMarket(m.value)} data-testid={`brand-form-market-${m.value}`}>
                  {m.label}
                </button>)}
            </div>
          </Field>

          <div className="bf-row">
            <Field label="Paese" testid="bf-field-country">
              <input type="text" value={form.country} onChange={e => setForm(f => ({
              ...f,
              country: e.target.value
            }))} placeholder="es. IT" maxLength={3} data-testid="brand-form-country" />
            </Field>
            <Field label="Website" testid="bf-field-website">
              <input type="url" value={form.website} onChange={e => setForm(f => ({
              ...f,
              website: e.target.value
            }))} placeholder="https://" data-testid="brand-form-website" />
            </Field>
          </div>
        </div>

        <footer className="bf-foot">
          <button type="button" className="bf-btn-soft" onClick={onClose} data-testid="brand-form-cancel">
            {t("inspirations.brand_form.annulla")}
          </button>
          <button type="submit" className="bf-btn" disabled={!canSubmit} data-testid="brand-form-submit">
            {saving ? <><Icons.Loader2 size={11} className="animate-spin" /> {t("inspirations.brand_form.salvataggio")}</> : isEdit ? <><Icons.Save size={11} /> {t("inspirations.brand_form.salva_modifiche")}</> : <><Icons.Plus size={11} /> {t("inspirations.brand_form.aggiungi_all_atlante")}</>}
          </button>
        </footer>
      </form>
    </div>, document.body);
};
const Field = ({
  label,
  required,
  children,
  testid
}) => <label className="bf-field" data-testid={testid}>
    <span className="bf-field__label">
      {label}{required && <em>*</em>}
    </span>
    {children}
  </label>;
export default BrandFormModal;