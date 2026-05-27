/**
 * RecallRequestModal · ITER161 · P0.2
 *
 * "Possiamo sentirci quando preferisci."
 * NON è un calendar SaaS. Il cliente lascia preferenze, lo studio propone.
 */
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import './clientWelcome.css';

const DAYS = [
  { v: 'mon', l: 'Lun' },
  { v: 'tue', l: 'Mar' },
  { v: 'wed', l: 'Mer' },
  { v: 'thu', l: 'Gio' },
  { v: 'fri', l: 'Ven' },
  { v: 'sat', l: 'Sab' },
];

const TIMES = [
  { v: 'morning',   l: 'Mattina' },
  { v: 'afternoon', l: 'Pomeriggio' },
  { v: 'evening',   l: 'Sera' },
  { v: 'any',       l: 'Quando preferisci' },
];

const CHANNELS = [
  { v: 'phone',    l: 'Telefono' },
  { v: 'video',    l: 'Videochiamata' },
  { v: 'whatsapp', l: 'WhatsApp' },
  { v: 'any',      l: 'Indifferente' },
];

const RecallRequestModal = ({ onClose, journeyId }) => {
  const [days, setDays] = useState([]);
  const [time, setTime] = useState(null);
  const [channel, setChannel] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const toggle = (arr, v, setter) =>
    setter(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const submit = async (e) => {
    e?.preventDefault?.();
    setBusy(true);
    try {
      await api.post('/api/client/recall-requests', {
        preferred_days: days,
        preferred_time: time,
        preferred_channel: channel,
        note: note.trim() || null,
        journey_id: journeyId,
      });
      setSent(true);
    } catch (err) {
      toast.error('Non riusciamo a inviare la richiesta. Riprova fra poco.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="cw-modal-backdrop"
      onClick={onClose}
      data-testid="client-recall-backdrop"
    >
      <div
        className="cw-modal"
        onClick={(e) => e.stopPropagation()}
        data-testid="client-recall-modal"
      >
        <button
          type="button"
          className="cw-close cw-close--modal"
          onClick={onClose}
          aria-label="Chiudi"
          data-testid="client-recall-close"
        >
          <X size={18} />
        </button>

        {!sent ? (
          <form onSubmit={submit}>
            <p className="cw-eyebrow">Una chiamata, quando preferisci</p>
            <h2 className="cw-modal__title">
              <em>Possiamo sentirci?</em>
            </h2>
            <p className="cw-modal__lede">
              Lascia le tue preferenze. Il tuo referente ti proporrà un momento
              che funziona per entrambi.
            </p>

            <div className="cw-field">
              <p className="cw-microlabel">Giorni preferiti</p>
              <div className="cw-chips" data-testid="client-recall-days">
                {DAYS.map((d) => (
                  <button
                    key={d.v}
                    type="button"
                    className={`cw-chip ${days.includes(d.v) ? 'is-active' : ''}`}
                    onClick={() => toggle(days, d.v, setDays)}
                    data-testid={`client-recall-day-${d.v}`}
                  >
                    {d.l}
                  </button>
                ))}
              </div>
            </div>

            <div className="cw-field">
              <p className="cw-microlabel">Fascia oraria</p>
              <div className="cw-chips" data-testid="client-recall-times">
                {TIMES.map((tt) => (
                  <button
                    key={tt.v}
                    type="button"
                    className={`cw-chip ${time === tt.v ? 'is-active' : ''}`}
                    onClick={() => setTime(time === tt.v ? null : tt.v)}
                    data-testid={`client-recall-time-${tt.v}`}
                  >
                    {tt.l}
                  </button>
                ))}
              </div>
            </div>

            <div className="cw-field">
              <p className="cw-microlabel">Canale preferito</p>
              <div className="cw-chips" data-testid="client-recall-channels">
                {CHANNELS.map((c) => (
                  <button
                    key={c.v}
                    type="button"
                    className={`cw-chip ${channel === c.v ? 'is-active' : ''}`}
                    onClick={() => setChannel(channel === c.v ? null : c.v)}
                    data-testid={`client-recall-channel-${c.v}`}
                  >
                    {c.l}
                  </button>
                ))}
              </div>
            </div>

            <div className="cw-field">
              <p className="cw-microlabel">Vuoi aggiungere qualcosa?</p>
              <textarea
                className="cw-textarea"
                placeholder="Una frase è più che sufficiente."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                data-testid="client-recall-note"
              />
            </div>

            <div className="cw-actions">
              <button
                type="button"
                className="cw-btn cw-btn--ghost"
                onClick={onClose}
                data-testid="client-recall-cancel"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="cw-btn cw-btn--primary"
                disabled={busy}
                data-testid="client-recall-submit"
              >
                {busy ? 'Inviamo…' : 'Invia preferenze'}
              </button>
            </div>
          </form>
        ) : (
          <div className="cw-modal__done" data-testid="client-recall-done">
            <p className="cw-eyebrow">Ricevuta</p>
            <h2 className="cw-modal__title">
              <em>Lo studio ti proporrà un momento.</em>
            </h2>
            <p className="cw-modal__lede">
              Trovi la richiesta nella conversazione con il tuo referente.
            </p>
            <button
              type="button"
              className="cw-btn cw-btn--primary"
              onClick={onClose}
              data-testid="client-recall-close-done"
            >
              Torna allo spazio
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecallRequestModal;
