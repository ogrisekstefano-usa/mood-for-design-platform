/**
 * CallBookingModal — ITER151 Sprint C
 *
 * Curatorial conversation request — NOT a Calendly clone.
 * Client picks 2-3 windows + conversation kind + optional note.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { X, Plus, Trash2 } from 'lucide-react';
import { createBooking } from '../../lib/orchestra';
import './call-booking-modal.css';

const KINDS = {
  it: [
    { key: 'discovery',        label: 'Conoscenza iniziale' },
    { key: 'proposal_review',  label: 'Lettura della proposta' },
    { key: 'material_walk',    label: 'Camminata fra i materiali' },
    { key: 'site_walk',        label: 'Sopralluogo' },
    { key: 'follow_up',        label: 'Continuiamo il dialogo' },
  ],
  en: [
    { key: 'discovery',        label: 'Initial conversation' },
    { key: 'proposal_review',  label: 'Proposal walk-through' },
    { key: 'material_walk',    label: 'Materials walk-through' },
    { key: 'site_walk',        label: 'Site visit' },
    { key: 'follow_up',        label: 'Continuing the dialogue' },
  ],
};

const tomorrowAt = (h) => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(h, 0, 0, 0);
  return d;
};

const toInputValue = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const CallBookingModal = ({ open, onClose, onConfirmed, locale = 'it' }) => {
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome', []);
  const [slots, setSlots] = useState([
    toInputValue(tomorrowAt(10)),
    toInputValue(tomorrowAt(15)),
  ]);
  const [kind, setKind] = useState('discovery');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const updateSlot = (i, v) => setSlots(s => s.map((x, idx) => idx === i ? v : x));
  const addSlot = () => setSlots(s => s.length < 5 ? [...s, toInputValue(tomorrowAt(11 + s.length))] : s);
  const removeSlot = (i) => setSlots(s => s.length > 1 ? s.filter((_, idx) => idx !== i) : s);

  const submit = async () => {
    if (slots.filter(Boolean).length < 1) {
      toast.error(locale === 'it' ? 'Proponi almeno un orario.' : 'Propose at least one slot.');
      return;
    }
    setSubmitting(true);
    try {
      await createBooking({
        preferred_slots: slots.filter(Boolean).map(s => ({
          start: new Date(s).toISOString(), tz,
        })),
        client_timezone: tz,
        conversation_kind: kind,
        note: note || null,
        locale,
      });
      toast.success(locale === 'it'
        ? 'Richiesta inviata. Il tuo studio confermerà uno degli orari.'
        : 'Request sent. Your studio will confirm one of the slots.');
      onConfirmed?.();
      onClose?.();
    } catch {
      toast.error(locale === 'it' ? 'Invio non riuscito.' : 'Send failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const kinds = KINDS[locale] || KINDS.it;

  return (
    <div className="cbm-overlay" onClick={onClose} data-testid="call-booking-modal">
      <div className="cbm-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="cbm-close" onClick={onClose} aria-label="close" data-testid="cbm-close">
          <X size={16} />
        </button>
        <p className="cbm-eyebrow">{locale === 'it' ? 'Richiesta di incontro' : 'Conversation request'}</p>
        <h2 className="cbm-title">
          {locale === 'it' ? 'Quando ci sentiamo?' : 'When shall we talk?'}
        </h2>
        <p className="cbm-sub">
          {locale === 'it'
            ? 'Proponi due o tre finestre. Il tuo studio ne confermerà una. Il fuso orario è già allineato sul tuo.'
            : 'Propose two or three windows. Your studio will confirm one. Your timezone is already aligned.'}
        </p>

        <section className="cbm-section">
          <p className="cbm-section__head">{locale === 'it' ? 'Tipo di conversazione' : 'Kind of conversation'}</p>
          <div className="cbm-chips">
            {kinds.map(k => (
              <button
                key={k.key}
                type="button"
                className={`cbm-chip ${kind === k.key ? 'cbm-chip--active' : ''}`}
                onClick={() => setKind(k.key)}
                data-testid={`cbm-kind-${k.key}`}
              >
                {k.label}
              </button>
            ))}
          </div>
        </section>

        <section className="cbm-section">
          <p className="cbm-section__head">
            {locale === 'it' ? 'Orari che proponi' : 'Slots you propose'}
            <span className="cbm-tz"> · {tz}</span>
          </p>
          <ul className="cbm-slots">
            {slots.map((v, i) => (
              <li key={i} className="cbm-slot">
                <input
                  type="datetime-local"
                  value={v}
                  onChange={e => updateSlot(i, e.target.value)}
                  className="cbm-input"
                  data-testid={`cbm-slot-${i}`}
                />
                {slots.length > 1 && (
                  <button
                    type="button"
                    className="cbm-slot-x"
                    onClick={() => removeSlot(i)}
                    aria-label="remove slot"
                  ><Trash2 size={14} /></button>
                )}
              </li>
            ))}
          </ul>
          {slots.length < 5 && (
            <button type="button" className="cbm-add" onClick={addSlot} data-testid="cbm-add-slot">
              <Plus size={14} /> {locale === 'it' ? 'Aggiungi un altro orario' : 'Add another slot'}
            </button>
          )}
        </section>

        <section className="cbm-section">
          <p className="cbm-section__head">
            {locale === 'it' ? 'Una nota per lo studio' : 'A note for the studio'}
          </p>
          <textarea
            className="cbm-textarea"
            placeholder={locale === 'it'
              ? 'Ad esempio: "Vorrei rivedere insieme le proposte di materiali"'
              : 'For example: "I would like to revisit the material proposals"'}
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            data-testid="cbm-note"
          />
        </section>

        <div className="cbm-foot">
          <button type="button" className="cbm-ghost" onClick={onClose} data-testid="cbm-cancel">
            {locale === 'it' ? 'Annulla' : 'Cancel'}
          </button>
          <button
            type="button"
            className="cbm-primary"
            onClick={submit}
            disabled={submitting}
            data-testid="cbm-submit"
          >
            {submitting
              ? (locale === 'it' ? 'Invio…' : 'Sending…')
              : (locale === 'it' ? 'Invia richiesta' : 'Send request')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallBookingModal;
