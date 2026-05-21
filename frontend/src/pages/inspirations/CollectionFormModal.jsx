/**
 * CollectionFormModal — editoriale Aggiungi/Modifica collezione.
 * Phase E · Sprint E2.
 *
 * Le collections sono "capitoli editoriali di un brand", NON folder.
 *
 * Linguaggio: "collezione", "anno", "stagione", "descrizione curatoriale".
 * MAI: "folder", "category bucket".
 */
import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import './brand-form.css';
import { useT } from "../../i18n/useT";
const SEASONS = [{
  value: '',
  label: '—'
}, {
  value: 'fw',
  label: 'Fall / Winter'
}, {
  value: 'ss',
  label: 'Spring / Summer'
}, {
  value: 'icon',
  label: 'Icon · senza stagione'
}];
const CATEGORIES = ['', 'Arredi', 'Illuminazione', 'Outdoor', 'Cucine', 'Bagni', 'Rivestimenti', 'Pietra naturale', 'Decor', 'Hospitality'];
const CollectionFormModal = ({
  open,
  mode = 'create',
  brand,
  collection,
  onClose,
  onSaved
}) => {
  const {
    t
  } = useT();
  const isEdit = mode === 'edit' && collection;
  const [form, setForm] = useState({
    name: '',
    year: '',
    season: '',
    category: '',
    description: ''
  });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      setForm({
        name: collection.name || '',
        year: collection.year || '',
        season: collection.season || '',
        category: collection.category || '',
        description: collection.description || ''
      });
    } else {
      setForm({
        name: '',
        year: new Date().getFullYear(),
        season: '',
        category: '',
        description: ''
      });
    }
  }, [open, isEdit, collection]);
  useEffect(() => {
    if (!open) return;
    const onKey = e => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  const canSubmit = useMemo(() => form.name.trim().length > 1 && !saving, [form.name, saving]);
  const submit = async e => {
    e?.preventDefault?.();
    if (!canSubmit) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        year: form.year ? parseInt(form.year, 10) : null,
        season: form.season || null,
        category: form.category || null,
        description: form.description.trim() || null
      };
      // Filter null values to keep PATCH payload clean
      Object.keys(payload).forEach(k => {
        if (payload[k] == null) delete payload[k];
      });
      if (isEdit) {
        const r = await api.patch(`/api/inspirations/registry/collections/${collection.id}`, payload);
        toast.success(`Collezione "${payload.name}" aggiornata`);
        onSaved?.(r.data, 'updated');
      } else {
        const r = await api.post(`/api/inspirations/registry/brands/${brand.id}/collections`, payload);
        const item = r.data?.item || r.data;
        toast.success(r.data?.created === false ? `Collezione "${item.name}" già presente` : `Collezione "${item.name}" aggiunta al brand`);
        onSaved?.(item, r.data?.created === false ? 'existing' : 'created');
      }
      onClose?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Impossibile salvare la collezione');
    } finally {
      setSaving(false);
    }
  };
  if (!open) return null;
  return createPortal(<div className="bf-backdrop" onMouseDown={e => {
    if (e.target === e.currentTarget) onClose?.();
  }}>
      <form className="bf-modal" data-testid="collection-form-modal" onSubmit={submit}>
        <header className="bf-head">
          <div>
            <p className="bf-eyebrow">{isEdit ? 'Modifica collezione' : 'Nuova collezione'}</p>
            <h2 className="bf-title">
              {isEdit ? <em>{collection.name}</em> : brand ? <>{t("inspirations.collection_form.capitolo_editoriale")} <em>{brand.name}</em></> : 'Aggiungi collezione'}
            </h2>
          </div>
          <button type="button" className="bf-close" onClick={onClose} data-testid="collection-form-close" aria-label={t("inspirations.collection_form.chiudi")}>
            <Icons.X size={13} />
          </button>
        </header>

        <div className="bf-body">
          <label className="bf-field">
            <span className="bf-field__label">Nome collezione <em>*</em></span>
            <input type="text" value={form.name} onChange={e => setForm(f => ({
            ...f,
            name: e.target.value
          }))} placeholder="es. Outdoor Living 2026" data-testid="collection-form-name" autoFocus />
          </label>

          <div className="bf-row">
            <label className="bf-field">
              <span className="bf-field__label">Anno</span>
              <input type="number" min="1950" max="2099" value={form.year} onChange={e => setForm(f => ({
              ...f,
              year: e.target.value
            }))} placeholder="2026" data-testid="collection-form-year" />
            </label>
            <label className="bf-field">
              <span className="bf-field__label">Stagione</span>
              <select value={form.season} onChange={e => setForm(f => ({
              ...f,
              season: e.target.value
            }))} data-testid="collection-form-season">
                {SEASONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
          </div>

          <label className="bf-field">
            <span className="bf-field__label">Categoria</span>
            <select value={form.category} onChange={e => setForm(f => ({
            ...f,
            category: e.target.value
          }))} data-testid="collection-form-category">
              {CATEGORIES.map(c => <option key={c} value={c}>{c || '—'}</option>)}
            </select>
          </label>

          <label className="bf-field">
            <span className="bf-field__label">Descrizione curatoriale</span>
            <textarea rows={3} value={form.description} onChange={e => setForm(f => ({
            ...f,
            description: e.target.value
          }))} placeholder={t("inspirations.collection_form.il_linguaggio_progettuale_di_questo_capitolo_le_ma")} data-testid="collection-form-description" />
          </label>
        </div>

        <footer className="bf-foot">
          <button type="button" className="bf-btn-soft" onClick={onClose} data-testid="collection-form-cancel">
            {t("inspirations.collection_form.annulla")}
          </button>
          <button type="submit" className="bf-btn" disabled={!canSubmit} data-testid="collection-form-submit">
            {saving ? <><Icons.Loader2 size={11} className="animate-spin" /> {t("inspirations.collection_form.salvataggio")}</> : isEdit ? <><Icons.Save size={11} /> {t("inspirations.collection_form.salva_modifiche")}</> : <><Icons.Plus size={11} /> {t("inspirations.collection_form.aggiungi_collezione")}</>}
          </button>
        </footer>
      </form>
    </div>, document.body);
};
export default CollectionFormModal;