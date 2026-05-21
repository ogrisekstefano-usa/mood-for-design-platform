/**
 * SharedVoiceComposer — Sprint G.7-ter · Shared Voice™.
 *
 * NON è un commento. NON è una chat. NON è un thread.
 * È un gesto editoriale che il cliente lascia sul capitolo attivo.
 *
 * UX:
 *   · Quattro gesti possibili: testo · riferimento (Pinterest/Instagram)
 *     · immagine · nota.
 *   · NO selettore icone, NO menzioni, NO replica, NO typing indicator,
 *     NO online presence.
 *   · Calma estrema, molto breathing room, copy editoriale italiana.
 *
 * Dopo la consegna: la voce torna nel companion via onSubmitted(),
 * che il caller usa per refresh ottimistico di conversations + timeline.
 */
import React, { useState } from 'react';
import { Send, Link2, ImagePlus, NotebookPen, X, Sparkles } from 'lucide-react';
import api from '../../lib/api';
import { toast } from 'sonner';
import { useT } from "../../i18n/useT";
const MAX_TEXT = 600;
const SharedVoiceComposer = ({
  journeyId,
  milestoneId,
  chapterTitle,
  onSubmitted
}) => {
  const {
    t
  } = useT();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [ref, setRef] = useState('');
  const [img, setImg] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [showRef, setShowRef] = useState(false);
  const [showImg, setShowImg] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const reset = () => {
    setText('');
    setRef('');
    setImg('');
    setNote('');
    setShowRef(false);
    setShowImg(false);
    setShowNote(false);
  };
  const close = () => {
    setOpen(false);
    reset();
  };
  const canSend = text.trim().length >= 2 && !busy;
  const submit = async () => {
    if (!canSend) return;
    setBusy(true);
    try {
      const {
        data
      } = await api.post(`/api/client/journeys/${journeyId}/voice`, {
        milestone_id: milestoneId,
        text: text.trim(),
        reference_url: ref.trim() || null,
        image_url: img.trim() || null,
        note: note.trim() || null
      });
      toast.success('Voce condivisa nel Journey');
      close();
      onSubmitted && onSubmitted(data);
    } catch (e) {
      toast.error('Non riesco a condividere la voce in questo momento.');
    } finally {
      setBusy(false);
    }
  };
  if (!milestoneId) return null;
  if (!open) {
    return <div className="cj-sv-invite" data-testid="shared-voice-invite">
        <p className="cj-sv-invite__lede">
          Vuoi raccontarci qualcosa su <em>{chapterTitle || 'questo capitolo'}</em>?
          <br />
          {t("client.shared_voice_composer.una_sensazione_un_dettaglio_che_senti_piu_vicino_u")}
        </p>
        <button type="button" onClick={() => setOpen(true)} className="cj-sv-cta" data-testid="shared-voice-open">
          <Sparkles size={14} />
          {t("client.shared_voice_composer.condividi_una_voce")}
        </button>
      </div>;
  }
  return <div className="cj-sv-card" data-testid="shared-voice-composer">
      <div className="cj-sv-card__head">
        <div>
          <p className="cj-section__eyebrow" style={{
          color: 'var(--cp-gold, #d9b285)'
        }}>
            Shared Voice™
          </p>
          <h4 className="cj-sv-card__title">
            <em>Raccontaci una impressione</em>
          </h4>
        </div>
        <button type="button" onClick={close} className="cj-sv-card__close" aria-label={t("client.shared_voice_composer.chiudi")} data-testid="shared-voice-close">
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>

      <textarea data-testid="shared-voice-text" value={text} onChange={e => setText(e.target.value.slice(0, MAX_TEXT))} placeholder={`Una nota, un'impressione, un dettaglio che senti più vicino…`} rows={4} className="cj-sv-textarea" />
      <div className="cj-sv-counter">
        {MAX_TEXT - text.length} caratteri rimasti
      </div>

      {/* Optional gesture pickers — calma, NON commenti tradizionali */}
      <div className="cj-sv-gestures" data-testid="shared-voice-gestures">
        <button type="button" className={`cj-sv-gesture ${showRef ? 'is-on' : ''}`} onClick={() => setShowRef(v => !v)} data-testid="shared-voice-toggle-ref">
          <Link2 size={13} /> {t("client.shared_voice_composer.aggiungi_un_riferimento")}
        </button>
        <button type="button" className={`cj-sv-gesture ${showImg ? 'is-on' : ''}`} onClick={() => setShowImg(v => !v)} data-testid="shared-voice-toggle-img">
          <ImagePlus size={13} /> {t("client.shared_voice_composer.condividi_una_atmosfera")}
        </button>
        <button type="button" className={`cj-sv-gesture ${showNote ? 'is-on' : ''}`} onClick={() => setShowNote(v => !v)} data-testid="shared-voice-toggle-note">
          <NotebookPen size={13} /> {t("client.shared_voice_composer.aggiungi_una_nota")}
        </button>
      </div>

      {showRef && <input type="url" data-testid="shared-voice-ref" value={ref} onChange={e => setRef(e.target.value)} placeholder="Pinterest · Instagram · qualsiasi link" className="cj-sv-input" />}
      {showImg && <input type="url" data-testid="shared-voice-img" value={img} onChange={e => setImg(e.target.value)} placeholder={t("client.shared_voice_composer.url_di_un_immagine_che_racconta_l_atmosfera")} className="cj-sv-input" />}
      {showNote && <input type="text" data-testid="shared-voice-note" value={note} onChange={e => setNote(e.target.value.slice(0, 400))} placeholder={t("client.shared_voice_composer.una_nota_privata_per_lo_studio_facoltativa")} className="cj-sv-input" />}

      <div className="cj-sv-actions">
        <button type="button" className="cj-sv-cancel" onClick={close} data-testid="shared-voice-cancel">
          {t("client.shared_voice_composer.annulla")}
        </button>
        <button type="button" className="cj-sv-send" onClick={submit} disabled={!canSend} data-testid="shared-voice-send">
          <Send size={13} />
          {busy ? 'Sto inviando…' : 'Condividi la voce'}
        </button>
      </div>
    </div>;
};
export default SharedVoiceComposer;