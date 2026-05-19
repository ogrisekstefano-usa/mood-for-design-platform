/**
 * StageChangeModal — Editorial stage transition.
 * Used when a stage pill is clicked. Carries optional note + follow-up
 * date so the relationship history captures the why, not just the what.
 */
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';

export const CANONICAL_STAGES = [
  { key: 'lead',              label: 'Lead',              color: '#9CA3AF' },
  { key: 'prospect',          label: 'Prospect',          color: '#88c0d0' },
  { key: 'qualified',         label: 'Qualificato',       color: '#5B7CA0' },
  { key: 'active_project',    label: 'Progetto attivo',   color: '#C9A36E' },
  { key: 'client',            label: 'Cliente',           color: '#10B981' },
  { key: 'returning_client',  label: 'Cliente di ritorno',color: '#059669' },
  { key: 'archived',          label: 'Archiviato',        color: '#6B7280' },
];

export const StageChangeModal = ({ open, accountId, currentStage, targetStage, onClose, onChanged }) => {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open || !targetStage) return null;

  const target = CANONICAL_STAGES.find((s) => s.key === targetStage) || { key: targetStage, label: targetStage };

  const save = async () => {
    setSaving(true);
    try {
      await api.post(`/api/relationships/accounts/${accountId}/stage`, {
        lifecycle_stage: target.key,
        note: note || null,
      });
      toast.success(`Stage aggiornato · ${target.label}`);
      onChanged?.(target.key);
      onClose?.();
    } catch (e) {
      console.error(e); toast.error('Cambio stage fallito');
    } finally { setSaving(false); }
  };

  return (
    <div className="rl-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="rl-modal" data-testid="stage-change-modal">
        <div className="rl-modal__head">
          <div>
            <p className="rl-modal__eyebrow">Evoluzione relazione</p>
            <h2 className="rl-modal__title">
              {currentStage ? <>Da <em>{currentStage}</em> → </> : ''}{target.label}
            </h2>
          </div>
          <button className="rl-modal__close" onClick={onClose} aria-label="Chiudi" data-testid="stage-modal-close">
            <X size={18} />
          </button>
        </div>

        <div className="rl-field">
          <label className="rl-field__label">Nota (opzionale)</label>
          <textarea className="rl-field__textarea" value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Perché stiamo cambiando fase? Il contesto rimane in timeline."
                    data-testid="stage-note-input" />
          <p className="rl-field__hint">Il cambio sarà tracciato come evento in timeline.</p>
        </div>

        <div className="rl-modal__actions">
          <button className="rl-btn rl-btn--ghost" onClick={onClose} data-testid="stage-cancel">
            Annulla
          </button>
          <button className="rl-btn rl-btn--primary" onClick={save}
                  disabled={saving} data-testid="stage-confirm">
            {saving ? 'Salvo…' : `Conferma · ${target.label}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StageChangeModal;
