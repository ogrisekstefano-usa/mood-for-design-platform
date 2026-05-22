/**
 * AdvisorEditDrawer — Editorial relationship drawer for editing an Advisor.
 *
 * Single coherent surface. No fragmented forms. All editable in one place:
 *   • full name · email · phone · status
 *   • commission % · default discount % · payout cycle · qualified months
 *   • market specialization (free-form chip list)
 *   • relationship tags (free-form)
 *   • notes (internal)
 *   • territories — embedded TerritorySelector (connected mode)
 *
 * Tone: regional relationship presence orchestration, NOT sales territory
 * management software.
 */
import React, { useEffect, useState } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import TerritorySelector from '../../components/advisor/TerritorySelector';
import './advisor-edit-drawer.css';
import { useT } from '../../i18n/useT';
const STATUS_OPTS = [{
  v: 'active',
  l: 'Attivo'
}, {
  v: 'paused',
  l: 'In pausa'
}, {
  v: 'archived',
  l: 'Archiviato'
}];
const ChipInput = ({
  label,
  value,
  onChange,
  placeholder,
  testid
}) => {
  const {
    t
  } = useT();
  const [draft, setDraft] = useState('');
  const arr = Array.isArray(value) ? value : [];
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (arr.includes(v)) {
      setDraft('');
      return;
    }
    onChange([...arr, v]);
    setDraft('');
  };
  return <div className="aed-chip-field">
      <label className="aed-label">{label}</label>
      <div className="aed-chips" data-testid={testid}>
        {arr.map(t => <span key={t} className="aed-chip">
            {t}
            <button type="button" onClick={() => onChange(arr.filter(x => x !== t))} aria-label={`Rimuovi ${t}`}>×</button>
          </span>)}
        <input type="text" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          add();
        }
        if (e.key === 'Backspace' && !draft && arr.length) {
          onChange(arr.slice(0, -1));
        }
      }} onBlur={add} placeholder={placeholder} className="aed-chip-input" />
      </div>
    </div>;
};
const AdvisorEditDrawer = ({
  open,
  advisor,
  onClose,
  onSaved
}) => {
  const {
    t
  } = useT();
  const [form, setForm] = useState(() => ({}));
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open || !advisor) return;
    setForm({
      name: advisor.name || '',
      email: advisor.email || '',
      phone: advisor.phone || '',
      status: advisor.status || 'active',
      commission_percentage: advisor.commission_percentage ?? 10,
      default_discount_percentage: advisor.default_discount_percentage ?? 10,
      payout_cycle_months: advisor.payout_cycle_months ?? 6,
      minimum_qualified_months: advisor.minimum_qualified_months ?? 6,
      market_specialization: advisor.market_specialization || [],
      relationship_tags: advisor.relationship_tags || [],
      notes: advisor.notes || ''
    });
  }, [open, advisor]);
  if (!open || !advisor) return null;
  const set = (k, v) => setForm(p => ({
    ...p,
    [k]: v
  }));
  const save = async () => {
    if (!form.name?.trim()) {
      toast.error('Nome obbligatorio');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email?.trim() || null,
        phone: form.phone?.trim() || null,
        status: form.status,
        commission_percentage: Number(form.commission_percentage),
        default_discount_percentage: Number(form.default_discount_percentage),
        payout_cycle_months: Number(form.payout_cycle_months),
        minimum_qualified_months: Number(form.minimum_qualified_months),
        market_specialization: form.market_specialization,
        relationship_tags: form.relationship_tags,
        notes: form.notes?.trim() || null
      };
      await api.patch(`/api/advisor/admin/advisors/${advisor.id}`, payload);
      toast.success('Advisor aggiornato');
      onSaved?.();
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.detail || 'Salvataggio fallito');
    } finally {
      setSaving(false);
    }
  };
  return <div className="aed-backdrop" data-testid="advisor-edit-drawer-backdrop" onClick={e => {
    if (e.target === e.currentTarget) onClose?.();
  }}>
      <aside className="aed-drawer" data-testid="advisor-edit-drawer">
        <header className="aed-head">
          <div>
            <p className="aed-eyebrow">Relazione Advisor · {advisor.advisor_code}</p>
            <h2 className="aed-title">{advisor.name}</h2>
          </div>
          <button type="button" className="aed-close" onClick={onClose} aria-label={t("admin.advisor_edit.chiudi")} data-testid="advisor-edit-drawer-close">
            <X size={18} />
          </button>
        </header>

        <div className="aed-body">
          {/* ── Identità & contatti ─────────────────────────────── */}
          <section className="aed-section">
            <p className="aed-section__label">{t('admin.advisor_edit.identita_contatti')}</p>
            <div className="aed-grid">
              <div className="aed-field aed-field--span2">
                <label className="aed-label">Nome completo</label>
                <input type="text" value={form.name || ''} onChange={e => set('name', e.target.value)} data-testid="aed-name" className="aed-input" />
              </div>
              <div className="aed-field">
                <label className="aed-label">Email</label>
                <input type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} data-testid="aed-email" className="aed-input" />
              </div>
              <div className="aed-field">
                <label className="aed-label">Telefono</label>
                <input type="tel" value={form.phone || ''} onChange={e => set('phone', e.target.value)} data-testid="aed-phone" className="aed-input" />
              </div>
              <div className="aed-field">
                <label className="aed-label">Stato</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} data-testid="aed-status" className="aed-input">
                  {STATUS_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* ── Economia della relazione ───────────────────────── */}
          <section className="aed-section">
            <p className="aed-section__label">{t('admin.advisor_edit.economia_della_relazione')}</p>
            <div className="aed-grid">
              <div className="aed-field">
                <label className="aed-label">Commissione %</label>
                <input type="number" min="0" max="50" step="0.5" value={form.commission_percentage ?? ''} onChange={e => set('commission_percentage', e.target.value)} data-testid="aed-commission" className="aed-input" />
              </div>
              <div className="aed-field">
                <label className="aed-label">Sconto default %</label>
                <input type="number" min="0" max="50" step="0.5" value={form.default_discount_percentage ?? ''} onChange={e => set('default_discount_percentage', e.target.value)} data-testid="aed-discount" className="aed-input" />
              </div>
              <div className="aed-field">
                <label className="aed-label">Ciclo payout (mesi)</label>
                <input type="number" min="1" max="24" step="1" value={form.payout_cycle_months ?? ''} onChange={e => set('payout_cycle_months', e.target.value)} data-testid="aed-payout" className="aed-input" />
              </div>
              <div className="aed-field">
                <label className="aed-label">Mesi qualificati minimi</label>
                <input type="number" min="1" max="24" step="1" value={form.minimum_qualified_months ?? ''} onChange={e => set('minimum_qualified_months', e.target.value)} data-testid="aed-qualified" className="aed-input" />
              </div>
            </div>
          </section>

          {/* ── Specializzazione & relazione ──────────────────── */}
          <section className="aed-section">
            <p className="aed-section__label">{t('admin.advisor_edit.specializzazione_lettura_della_relazione')}</p>
            <ChipInput label="Specializzazione di mercato" value={form.market_specialization} onChange={v => set('market_specialization', v)} placeholder="es. Hospitality · Yacht client · Milano" testid="aed-specialization" />
            <ChipInput label="Tag relazionali" value={form.relationship_tags} onChange={v => set('relationship_tags', v)} placeholder={t("admin.advisor_edit.es_consigliere_architettura_partner_editoriale")} testid="aed-tags" />
            <div className="aed-field">
              <label className="aed-label">Note interne</label>
              <textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} placeholder={t("admin.advisor_edit.contesto_storia_sensibilita_della_relazione")} rows={4} data-testid="aed-notes" className="aed-input aed-textarea" />
            </div>
          </section>

          {/* ── Presenza territoriale (live edit) ──────────────── */}
          <section className="aed-section">
            <p className="aed-section__label">Presenza territoriale</p>
            <p className="aed-section__caption">
              {t("admin.advisor_edit.aree_di_rappresentanza_editoriale_cambi_sono_salva")}
            </p>
            <TerritorySelector advisorId={advisor.id} locale="it-IT" />
          </section>
        </div>

        <footer className="aed-foot">
          <button type="button" className="aed-btn aed-btn--ghost" onClick={onClose} disabled={saving} data-testid="aed-cancel">{t('admin.advisor_edit.annulla')}</button>
          <button type="button" className="aed-btn aed-btn--primary" onClick={save} disabled={saving} data-testid="aed-save">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {saving ? 'Salvo…' : 'Salva modifiche'}
          </button>
        </footer>
      </aside>
    </div>;
};
export default AdvisorEditDrawer;