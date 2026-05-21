/**
 * ActivityModal — Quick activity entry (call · meeting · note · visit ·
 * email · whatsapp · proposal · moodboard share · hospitality visit).
 *
 * Editorial luxury feeling: Notion calm spacing × Apple typography ×
 * AD restraint. Never enterprise.
 */
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import VoiceRecorder from './VoiceRecorder';
import { useT } from "../../i18n/useT";
const TYPE_LABELS = {
  call: 'Telefonata',
  business_meeting: 'Meeting',
  showroom_visit: 'Visita showroom',
  external_visit: 'Visita esterna',
  voice_note: 'Nota vocale',
  email: 'Email',
  whatsapp: 'WhatsApp',
  moodboard_sent: 'Moodboard condivisa',
  proposal_sent: 'Proposta inviata',
  internal_note: 'Nota interna',
  post_visit_report: 'Report di visita',
  follow_up: 'Follow-up'
};
export const ActivityModal = ({
  open,
  account,
  defaultType = 'internal_note',
  onClose,
  onCreated
}) => {
  const {
    t
  } = useT();
  const [type, setType] = useState(defaultType);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [saving, setSaving] = useState(false);
  React.useEffect(() => {
    if (!open) return;
    setType(defaultType);
    setTitle('');
    setSummary('');
    setNextStep('');
    setNextDate('');
  }, [open, defaultType]);
  if (!open) return null;
  const isVoice = type === 'voice_note';
  const accountId = account?.id;
  const save = async () => {
    if (!accountId) return;
    setSaving(true);
    try {
      const payload = {
        interaction_type: type,
        title: title || TYPE_LABELS[type] || type,
        summary,
        next_step: nextStep || null,
        next_follow_up_date: nextDate || null
      };
      const r = await api.post(`/api/relationships/accounts/${accountId}/interactions`, payload);
      toast.success('Attività registrata in timeline');
      onCreated?.(r.data.interaction);
      onClose?.();
    } catch (e) {
      console.error(e);
      toast.error('Salvataggio fallito');
    } finally {
      setSaving(false);
    }
  };
  return <div className="rl-modal-backdrop" onClick={e => {
    if (e.target === e.currentTarget) onClose?.();
  }}>
      <div className="rl-modal" data-testid="activity-modal">
        <div className="rl-modal__head">
          <div>
            <p className="rl-modal__eyebrow">Nuova attività</p>
            <h2 className="rl-modal__title">{TYPE_LABELS[type] || 'Attività'}</h2>
          </div>
          <button className="rl-modal__close" onClick={onClose} aria-label={t("crm.activity.chiudi")} data-testid="activity-modal-close">
            <X size={18} />
          </button>
        </div>

        <div className="rl-field">
          <label className="rl-field__label">Tipo</label>
          <select className="rl-field__select" value={type} onChange={e => setType(e.target.value)} data-testid="activity-type-select">
            {Object.entries(TYPE_LABELS).map(([k, lbl]) => <option key={k} value={k}>{lbl}</option>)}
          </select>
        </div>

        {isVoice ? <VoiceRecorder accountId={accountId} onSaved={it => {
        onCreated?.(it);
        onClose?.();
      }} onClose={onClose} /> : <>
            <div className="rl-field">
              <label className="rl-field__label">Titolo</label>
              <input className="rl-field__input" type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Es. Visita showroom · Maya Aldhabi" data-testid="activity-title-input" />
            </div>
            <div className="rl-field">
              <label className="rl-field__label">Note</label>
              <textarea className="rl-field__textarea" value={summary} onChange={e => setSummary(e.target.value)} placeholder="Racconta l'essenziale — pensieri, impressioni, prossimi step…" data-testid="activity-summary-input" />
            </div>
            <div className="rl-field">
              <label className="rl-field__label">Prossimo passo (opzionale)</label>
              <input className="rl-field__input" type="text" value={nextStep} onChange={e => setNextStep(e.target.value)} placeholder={t("crm.activity.es_inviare_proposta_materiali")} data-testid="activity-nextstep-input" />
            </div>
            <div className="rl-field">
              <label className="rl-field__label">Data follow-up (opzionale)</label>
              <input className="rl-field__input" type="date" value={nextDate} onChange={e => setNextDate(e.target.value)} data-testid="activity-nextdate-input" />
              <p className="rl-field__hint">Sarà aggiunto come follow-up aperto sull'account.</p>
            </div>
            <div className="rl-modal__actions">
              <button className="rl-btn rl-btn--ghost" onClick={onClose} data-testid="activity-cancel">
                {t("crm.activity.annulla")}
              </button>
              <button className="rl-btn rl-btn--primary" onClick={save} disabled={saving} data-testid="activity-save">
                {saving ? 'Salvo…' : 'Salva attività'}
              </button>
            </div>
          </>}
      </div>
    </div>;
};
export default ActivityModal;