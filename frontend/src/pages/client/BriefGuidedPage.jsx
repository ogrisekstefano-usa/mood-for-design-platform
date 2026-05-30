/**
 * BriefGuidedPage · Client Design Journey™ V1 · ITER172
 *
 * /journey/:jid/brief — pagina dedicata (non drawer, non modal).
 *
 * Cosa fa:
 *   1. Carica le indicazioni raccolte in fase di /begin-journey
 *      (atmosphere, lifestyle, materials, priority) via
 *      `GET /api/client/welcome-summary`.
 *   2. Mostra il brief leggibile in 4 capitoli editoriali (text-only,
 *      coerente con D3 — nessuna foto stock).
 *   3. Permette al cliente di lasciare una **voce libera** —
 *      arricchimento testuale del brief — usando l'endpoint esistente
 *      `POST /api/client/journeys/{jid}/voice`. Nessun nuovo endpoint,
 *      nessuna nuova tabella, nessuna nuova migration.
 *   4. CTA "Torna al Journey™" → /journey/:jid
 *
 * Layout: cinematic single-column, max-width 720px, lessico relazionale.
 * NIENTE dashboard SaaS, NIENTE timeline qui (vive nella Welcome V1).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ChevronLeft, Send, Sparkles, Home as HomeIcon, Leaf, Shield, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { buildAtelierViewModel } from '../../presets/client-profile/atelier/atelierViewModel';
import './brief-guided.css';

const ICON_LIB = {
  sparkles: Sparkles,
  home:     HomeIcon,
  leaf:     Leaf,
  shield:   Shield,
};

const BriefCard = ({ indication }) => {
  const Icon = ICON_LIB[indication.icon] || Sparkles;
  return (
    <article className="brief-card" data-testid={`brief-card-${indication.id}`}>
      <header className="brief-card__head">
        <span className="brief-card__icon" aria-hidden>
          <Icon size={14} strokeWidth={1.5} />
        </span>
        <p className="brief-card__label">{indication.label}</p>
      </header>
      <h3 className="brief-card__title">{indication.title}</h3>
      {indication.body && (
        <p className="brief-card__body">
          {indication.body.split('\n').map((ln, i, arr) => (
            <React.Fragment key={i}>
              {ln}
              {i < arr.length - 1 && <br />}
            </React.Fragment>
          ))}
        </p>
      )}
    </article>
  );
};

const BriefGuidedPage = () => {
  const { jid } = useParams();
  const navigate = useNavigate();
  const [vm, setVm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voice, setVoice] = useState('');
  const [sending, setSending] = useState(false);
  const [activeMilestoneId, setActiveMilestoneId] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      api.get('/api/client/welcome-summary'),
      api.get(`/api/client/journeys/${jid}/companion`),
    ]).then(([ws, comp]) => {
      if (!alive) return;
      const wsData = ws.status === 'fulfilled' ? ws.value.data : {};
      const compData = comp.status === 'fulfilled' ? comp.value.data : null;
      setVm(buildAtelierViewModel(wsData));
      // Find the brief milestone id from companion data
      const activeChapter = compData?.active_chapter?.milestone;
      if (activeChapter) setActiveMilestoneId(activeChapter.id);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [jid]);

  const handleSendVoice = async (e) => {
    e?.preventDefault?.();
    const trimmed = voice.trim();
    if (!trimmed) return;
    if (!activeMilestoneId) {
      toast.error('Il capitolo Brief non è disponibile in questo momento.');
      return;
    }
    setSending(true);
    try {
      await api.post(`/api/client/journeys/${jid}/voice`, {
        milestone_id: activeMilestoneId,
        text: trimmed,
      });
      toast.success('Grazie. Lo studio ha ricevuto la tua voce.');
      setVoice('');
    } catch (err) {
      toast.error('Non è stato possibile inviare la tua voce. Riprova tra un istante.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="brief-shell" data-testid="brief-guided-loading">
        <div className="brief-loading">Stiamo raccogliendo le tue prime indicazioni…</div>
      </div>
    );
  }

  const indications = vm?.indications || [];
  const firstName = vm?.client?.firstName || '';
  const studioName = vm?.studio?.name || 'Lo studio';

  return (
    <div className="brief-shell" data-testid="brief-guided-page">
      <header className="brief-topbar">
        <button
          type="button"
          onClick={() => navigate(`/journey/${jid}`)}
          className="brief-topbar__back"
          data-testid="brief-back"
        >
          <ChevronLeft size={14} strokeWidth={1.6} aria-hidden />
          <span>Torna al Journey™</span>
        </button>
        <span className="brief-topbar__studio">
          <em>Studio</em> {studioName}
        </span>
      </header>

      <main className="brief-main">
        <section className="brief-hero">
          <p className="brief-hero__eyebrow">Brief Guidato™</p>
          <h1 className="brief-hero__title">
            {firstName ? <>Le tue prime indicazioni, {firstName}.</> : <>Le tue prime indicazioni.</>}
          </h1>
          <p className="brief-hero__lede">
            Queste sono le impressioni che hai condiviso quando hai iniziato il
            tuo Design Journey™. Lo studio le sta leggendo per costruire la
            prima direzione progettuale.
            <br />
            Puoi arricchirle in qualsiasi momento: ogni dettaglio aiuta a
            disegnare uno spazio veramente tuo.
          </p>
        </section>

        <section className="brief-deck" data-testid="brief-deck">
          {indications.length === 0 ? (
            <p className="brief-empty">Non abbiamo ancora ricevuto indicazioni.</p>
          ) : (
            indications.map((ind) => <BriefCard key={ind.id} indication={ind} />)
          )}
        </section>

        <section className="brief-composer" data-testid="brief-composer">
          <header className="brief-composer__head">
            <MessageCircle size={14} strokeWidth={1.6} aria-hidden />
            <p className="brief-composer__title">Vuoi aggiungere qualcosa?</p>
          </header>
          <p className="brief-composer__sub">
            Note libere, ambienti da progettare, budget indicativo, tempi,
            vincoli, ispirazioni: tutto ciò che vuoi condividere con lo studio
            arriva direttamente al tuo referente.
          </p>

          <form onSubmit={handleSendVoice} className="brief-composer__form">
            <textarea
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              placeholder="Scrivi qui i tuoi pensieri, gli ambienti che hai in mente, i materiali che ti piacciono…"
              rows={5}
              className="brief-composer__textarea"
              data-testid="brief-composer-textarea"
              disabled={sending}
            />
            <div className="brief-composer__actions">
              <span className="brief-composer__hint">
                Le tue parole compaiono nel diario del Journey condiviso con lo studio.
              </span>
              <button
                type="submit"
                className="brief-composer__submit"
                disabled={sending || !voice.trim()}
                data-testid="brief-composer-submit"
              >
                <span>{sending ? 'Invio in corso…' : 'Condividi con lo studio'}</span>
                <Send size={14} strokeWidth={1.6} aria-hidden />
              </button>
            </div>
          </form>
        </section>

        <footer className="brief-foot">
          <Link
            to={`/journey/${jid}`}
            className="brief-foot__link"
            data-testid="brief-foot-return"
          >
            <ChevronLeft size={14} strokeWidth={1.6} aria-hidden />
            <span>Torna al tuo Design Journey™</span>
          </Link>
        </footer>
      </main>
    </div>
  );
};

export default BriefGuidedPage;
