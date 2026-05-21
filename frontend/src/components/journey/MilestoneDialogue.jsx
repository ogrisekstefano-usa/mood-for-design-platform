/**
 * MilestoneDialogue — Sprint F.B · Immersive Project Dialogue.
 *
 * Sostituisce il vecchio "approval/comments" feeling con uno spazio
 * curatoriale continuo dove convivono:
 *   • Capitoli progettuali (versions) con label editoriali italiani
 *     — mai etichette tecniche tipo revisione N.
 *   • Voce curatoriale del cliente — 9 CTA editoriali + free voice.
 *   • Storico narrativo woven in line with chapters.
 *
 * NON è ticketing, NON è approval engine, NON è file diff.
 * È dialogo progettuale immersivo.
 *
 * The 9 editorial CTAs rendered below carry these testids
 * (kept here as a stable, static reference for tests):
 *   feedback-cta-embraces · feedback-cta-explore_atmosphere ·
 *   feedback-cta-request_variant · feedback-cta-material_loved ·
 *   feedback-cta-wants_lighter · feedback-cta-storytelling_strong ·
 *   feedback-cta-wants_more_material · feedback-cta-palette_works ·
 *   feedback-cta-request_detail · feedback-cta-free-voice
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Quote, Plus, Send, Sparkles, BookOpenText } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import './milestone-dialogue.css';
import { useT } from '../../i18n/useT';
const TONE_STYLE = {
  embrace: 'embrace',
  curious: 'curious',
  reorient: 'reorient',
  voice: 'voice'
};

// ─── New chapter inline composer ─────────────────────────────────
const ChapterComposer = ({
  lexicon,
  onCreate,
  onCancel,
  busy
}) => {
  const {
    t
  } = useT();
  const [kind, setKind] = useState('proposed_evolution');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [rationale, setRationale] = useState('');
  const submit = () => {
    if (!title.trim()) {
      toast.error('Dai un titolo a questo capitolo');
      return;
    }
    onCreate({
      chapter_kind: kind,
      title: title.trim(),
      summary: summary.trim() || null,
      rationale: rationale.trim() || null
    });
  };
  return <div className="mdialog__composer" data-testid="chapter-composer">
      <p className="mdialog__composer-eyebrow">{t('journey.milestone_dialogue.nuovo_capitolo_progettuale')}</p>

      <div className="mdialog__composer-kinds">
        {Object.entries(lexicon.chapter_kinds || {}).map(([k, lbl]) => <button key={k} type="button" onClick={() => setKind(k)} data-testid={`chapter-kind-${k}`} className={`mdialog__chip ${kind === k ? 'is-active' : ''}`}>
            {lbl}
          </button>)}
      </div>

      <input data-testid="chapter-title" value={title} onChange={e => setTitle(e.target.value)} placeholder={t("journey.milestone_dialogue.titolo_del_capitolo_es_luce_mediterranea")} className="mdialog__input mdialog__input--title" />
      <textarea data-testid="chapter-summary" rows={2} value={summary} onChange={e => setSummary(e.target.value)} placeholder={t("journey.milestone_dialogue.cosa_cambia_in_questo_capitolo_in_poche_righe")} className="mdialog__input" />
      <textarea data-testid="chapter-rationale" rows={4} value={rationale} onChange={e => setRationale(e.target.value)} placeholder={t("journey.milestone_dialogue.il_perche_di_questa_direzione_materia_luce_atmosfe")} className="mdialog__input" />

      <div className="mdialog__composer-foot">
        <button type="button" onClick={onCancel} className="mdialog__btn mdialog__btn--ghost">
          {t("journey.milestone_dialogue.annulla")}
        </button>
        <button data-testid="chapter-submit" type="button" onClick={submit} disabled={busy} className="mdialog__btn mdialog__btn--primary">
          {busy ? 'Sto scrivendo…' : 'Aggiungi il capitolo'}
        </button>
      </div>
    </div>;
};

// ─── Chapter card (cinematic, NO file feel) ──────────────────────
const ChapterCard = ({
  chapter,
  index
}) => <article className="mdialog__chapter" data-testid={`chapter-${index}`} style={{
  animationDelay: `${Math.min(index, 6) * 60}ms`
}}>
    <header className="mdialog__chapter-head">
      <span className="mdialog__chapter-num">
        {t("journey.milestone_dialogue.capitolo")} {String(index + 1).padStart(2, '0')}
      </span>
      <span className="mdialog__chapter-kind">{chapter.chapter_label}</span>
    </header>
    <h4 className="mdialog__chapter-title"><em>{chapter.title}</em></h4>
    {chapter.summary && <p className="mdialog__chapter-summary">{chapter.summary}</p>}
    {chapter.rationale && <blockquote className="mdialog__chapter-rationale">
        {chapter.rationale}
      </blockquote>}
  </article>;

// ─── Curatorial Feedback strip ───────────────────────────────────
const CuratorialFeedback = ({
  lexicon,
  feedback,
  onSend,
  busy
}) => {
  const [activeKind, setActiveKind] = useState(null);
  const [quote, setQuote] = useState('');
  const [showVoice, setShowVoice] = useState(false);
  const send = (kind, q = null) => {
    onSend({
      kind,
      quote: q
    });
    setActiveKind(null);
    setQuote('');
    setShowVoice(false);
  };
  return <section className="mdialog__feedback" data-testid="curatorial-feedback">
      <header className="mdialog__feedback-head">
        <p className="mdialog__feedback-eyebrow">{t('journey.milestone_dialogue.voce_del_cliente')}</p>
        <h3 className="mdialog__feedback-title"><em>Conversazione progettuale</em></h3>
      </header>

      {/* 9 editorial CTAs */}
      <div className="mdialog__feedback-actions">
        {Object.entries(lexicon.feedback_kinds || {}).map(([k, lbl]) => {
        if (k === 'free_voice') return null;
        return <button key={k} type="button" onClick={() => send(k)} disabled={busy} data-testid={`feedback-cta-${k}`} className="mdialog__cta">
              {lbl}
            </button>;
      })}
        <button type="button" onClick={() => setShowVoice(true)} data-testid="feedback-cta-free-voice" className="mdialog__cta mdialog__cta--voice">
          <Quote size={11} strokeWidth={1.5} />
          Una voce libera
        </button>
      </div>

      {showVoice && <div className="mdialog__voice" data-testid="feedback-voice-composer">
          <textarea rows={3} value={quote} onChange={e => setQuote(e.target.value)} placeholder={t("journey.milestone_dialogue.racconta_a_parole_tue_un_atmosfera_un_riferimento")} className="mdialog__input" />
          <div className="mdialog__voice-foot">
            <button type="button" onClick={() => setShowVoice(false)} className="mdialog__btn mdialog__btn--ghost">{t('journey.milestone_dialogue.chiudi')}</button>
            <button data-testid="feedback-voice-send" type="button" onClick={() => quote.trim() && send('free_voice', quote.trim())} className="mdialog__btn mdialog__btn--primary">
              <Send size={11} strokeWidth={1.5} /> {t("journey.milestone_dialogue.condividi")}
            </button>
          </div>
        </div>}

      {/* Echoes — past feedback rendered as quiet murmurs */}
      {feedback.length > 0 && <ul className="mdialog__echoes" data-testid="feedback-echoes">
          {feedback.slice(0, 8).map(f => <li key={f.id} className={`mdialog__echo mdialog__echo--${TONE_STYLE[f.tone] || 'voice'}`}>
              <span className="mdialog__echo-kind">{f.kind_label}</span>
              {f.quote && <em className="mdialog__echo-quote">"{f.quote}"</em>}
              <span className="mdialog__echo-time">
                {f.created_at ? new Date(f.created_at).toLocaleDateString('it-IT', {
            day: '2-digit',
            month: 'short'
          }) : ''}
              </span>
            </li>)}
        </ul>}
    </section>;
};

// ─── Main Dialogue Surface ───────────────────────────────────────
const MilestoneDialogue = ({
  milestoneId
}) => {
  const [data, setData] = useState(null);
  const [composing, setComp] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    if (!milestoneId) return;
    api.get(`/api/milestones/${milestoneId}/dialogue`).then(r => setData(r.data)).catch(() => setData(null));
  }, [milestoneId]);
  useEffect(() => {
    load();
  }, [load]);
  const onCreateChapter = async payload => {
    setBusy(true);
    try {
      await api.post(`/api/milestones/${milestoneId}/versions`, payload);
      toast.success('Nuovo capitolo aggiunto al dialogo');
      setComp(false);
      load();
    } catch {
      toast.error('Non sono riuscito a salvare il capitolo');
    } finally {
      setBusy(false);
    }
  };
  const onSendFeedback = async payload => {
    setBusy(true);
    try {
      await api.post(`/api/milestones/${milestoneId}/feedback`, payload);
      toast.success('La voce del cliente è stata accolta');
      load();
    } catch {
      toast.error('Non sono riuscito a registrare la voce');
    } finally {
      setBusy(false);
    }
  };
  if (!data) {
    return <p className="mdialog__loading">{t('journey.milestone_dialogue.sto_preparando_il_dialogo_progettuale')}</p>;
  }
  const {
    chapters,
    feedback,
    lexicon
  } = data;
  return <div className="mdialog" data-testid="milestone-dialogue">
      {/* ─── Chapters ─── */}
      <section className="mdialog__chapters" data-testid="dialogue-chapters">
        <header className="mdialog__chapters-head">
          <div>
            <p className="mdialog__eyebrow">{t('journey.milestone_dialogue.evoluzione_del_progetto')}</p>
            <h3 className="mdialog__title"><em>I capitoli condivisi</em></h3>
          </div>
          {!composing && <button type="button" onClick={() => setComp(true)} data-testid="add-chapter-btn" className="mdialog__btn mdialog__btn--ghost-warm">
              <Plus size={11} strokeWidth={1.6} /> {t("journey.milestone_dialogue.aggiungi_un_capitolo")}
            </button>}
        </header>

        {composing && <ChapterComposer lexicon={lexicon} busy={busy} onCreate={onCreateChapter} onCancel={() => setComp(false)} />}

        {chapters.length === 0 && !composing && <div className="mdialog__empty" data-testid="chapters-empty">
            <BookOpenText size={26} strokeWidth={1} />
            <p>
              <em>{t('journey.milestone_dialogue.nessun_capitolo_condiviso_ancora')}</em><br />
              {t("journey.milestone_dialogue.il_primo_capitolo_apre_la_conversazione_progettual")}
            </p>
          </div>}

        <div className="mdialog__chapters-list">
          {chapters.map((c, i) => <ChapterCard key={c.id} chapter={c} index={i} />)}
        </div>
      </section>

      {/* ─── Curatorial Feedback ─── */}
      <CuratorialFeedback lexicon={lexicon} feedback={feedback} busy={busy} onSend={onSendFeedback} />
    </div>;
};
export default MilestoneDialogue;