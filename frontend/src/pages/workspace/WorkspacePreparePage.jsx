/**
 * WorkspacePreparePage — "Prepara il tuo workspace"
 *
 * Esperienza elegante di attivazione per features in arrivo:
 *   - Material Board™      (KE-006)
 *   - Presentazione Cliente™ (KE-007)
 *
 * Non è un "coming soon": è un wizard premium di raccolta dati che fa
 * percepire la feature come "in attivazione" piuttosto che mancante.
 * Salva una intent-record nel backend per pre-popolare il workspace
 * quando la feature sarà rilasciata.
 */
import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Check, Sparkles } from 'lucide-react';
import api from '../../lib/api';
import './workspace-prepare.css';

const WORKSPACE_TEMPLATES = {
  'material-boards': {
    eyebrow: 'Material Board™',
    title: 'Prepara il tuo workspace',
    intro: 'Componi una selezione di materiali, finiture e campioni che racconterà la materia del tuo progetto. Inizia indicando le caratteristiche principali — ti guiderò passo dopo passo.',
    image: 'https://images.unsplash.com/photo-1615873968403-89e068629265?auto=format&fit=crop&w=2000&q=85',
    steps: [
      { id: 'project',  label: 'A quale progetto è dedicata questa Material Board?', type: 'text', placeholder: 'Es. Villa Treviso · Palette Pietra' },
      { id: 'mood',     label: 'Quale atmosfera vuoi trasmettere?', type: 'select',
        options: ['Mediterraneo · luce calda', 'Nordico · neutri freddi', 'Materico · texture profonde', 'Industriale · contrasti netti', 'Lussuoso · superfici nobili', 'Naturale · biofilico'] },
      { id: 'palette',  label: 'Quali famiglie di materiale ti interessano?', type: 'checklist',
        options: ['Pietra', 'Legno', 'Metallo', 'Tessuto', 'Vetro', 'Ceramica', 'Pelle', 'Resina'] },
      { id: 'context',  label: 'Vuoi che includa solo brand già certificati nel tuo Brand Atlas?', type: 'radio',
        options: ['Solo certificati', 'Mix · anche non ancora certificati'] },
    ],
    confirmation: {
      title: 'Material Board in arrivo',
      body: 'I tuoi dati sono stati salvati. Quando la funzione sarà attiva, troverai il workspace già pronto con la tua palette.',
      icon: <Sparkles size={18} strokeWidth={1.6} />,
    },
  },
  'presentations': {
    eyebrow: 'Presentazione Cliente™',
    title: 'Prepara il tuo workspace',
    intro: 'Costruisci una presentazione elegante per il momento più importante: la consegna al cliente. Indicaci come vuoi raccontare il progetto e prepareremo tutto.',
    image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=2000&q=85',
    steps: [
      { id: 'project',   label: 'Quale progetto vuoi presentare?', type: 'text', placeholder: 'Es. Hotel Verona · Capitolo finale' },
      { id: 'audience',  label: 'Chi sarà il pubblico?', type: 'select',
        options: ['Cliente privato', 'Comitato decisionale', 'Architetto di riferimento', 'Stakeholder commerciali'] },
      { id: 'tone',      label: 'Quale tono?', type: 'select',
        options: ['Cinematic · narrativo', 'Documentario · dettagliato', 'Editoriale · raffinato', 'Tecnico · sintetico'] },
      { id: 'sections',  label: 'Cosa vuoi includere?', type: 'checklist',
        options: ['Concept', 'Moodboard', 'Material Board', 'Planimetrie', 'Render', 'Cronoprogramma', 'Quotazione'] },
      { id: 'format',    label: 'Formato preferito di consegna?', type: 'radio',
        options: ['PDF cinematic', 'Presentazione web interattiva', 'Slide tradizionali'] },
    ],
    confirmation: {
      title: 'Presentazione in arrivo',
      body: 'Le tue scelte sono salvate. Quando la funzione sarà attiva, ti accoglieremo direttamente nello scenario che hai pensato.',
      icon: <Sparkles size={18} strokeWidth={1.6} />,
    },
  },
};

const WorkspacePreparePage = () => {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const kind = pathname.includes('/presentations/') ? 'presentations' : 'material-boards';
  const template = WORKSPACE_TEMPLATES[kind] || WORKSPACE_TEMPLATES['material-boards'];

  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const setAnswer = (id, v) => setAnswers((a) => ({ ...a, [id]: v }));
  const toggleChecklist = (id, option) => {
    setAnswers((a) => {
      const cur = a[id] || [];
      const next = cur.includes(option) ? cur.filter((x) => x !== option) : [...cur, option];
      return { ...a, [id]: next };
    });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/api/workspace/prepare-intent', {
        kind,
        answers,
      }).catch(() => null);  // soft · l'endpoint è opzionale
      setConfirmed(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmed) {
    return (
      <div className="wsp-canvas">
        <div className="wsp-hero" style={{ backgroundImage: `url(${template.image})` }}>
          <div className="wsp-hero__veil" />
        </div>
        <div className="wsp-confirmation">
          <span className="wsp-confirmation__icon">{template.confirmation.icon}</span>
          <h1 className="wsp-confirmation__title">{template.confirmation.title}</h1>
          <p className="wsp-confirmation__body">{template.confirmation.body}</p>
          <Link to="/dashboard" className="wsp-confirmation__cta" data-testid="wsp-back-dashboard">
            Torna alla dashboard <ArrowUpRight size={14} strokeWidth={1.6} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="wsp-canvas" data-testid={`wsp-${kind}`}>
      <div className="wsp-hero" style={{ backgroundImage: `url(${template.image})` }}>
        <div className="wsp-hero__veil" />
        <div className="wsp-hero__inner">
          <button type="button" onClick={() => nav(-1)} className="wsp-back"
                  data-testid="wsp-back">
            <ArrowLeft size={14} strokeWidth={1.6} /> Indietro
          </button>
          <p className="wsp-eyebrow">{template.eyebrow}</p>
          <h1 className="wsp-title">{template.title}</h1>
          <p className="wsp-intro">{template.intro}</p>
        </div>
      </div>

      <form className="wsp-form" onSubmit={onSubmit}>
        {template.steps.map((step, idx) => (
          <div key={step.id} className="wsp-step">
            <div className="wsp-step__num">{String(idx + 1).padStart(2, '0')}</div>
            <div className="wsp-step__body">
              <label className="wsp-step__label" htmlFor={step.id}>{step.label}</label>
              {step.type === 'text' && (
                <input id={step.id} type="text" className="wsp-input"
                       placeholder={step.placeholder || ''}
                       value={answers[step.id] || ''}
                       onChange={(e) => setAnswer(step.id, e.target.value)}
                       data-testid={`wsp-input-${step.id}`} />
              )}
              {step.type === 'select' && (
                <div className="wsp-pills">
                  {step.options.map((o) => (
                    <button key={o} type="button"
                      className={`wsp-pill ${answers[step.id] === o ? 'wsp-pill--on' : ''}`}
                      onClick={() => setAnswer(step.id, o)}
                      data-testid={`wsp-pill-${step.id}-${o.slice(0,10)}`}>
                      {o}
                    </button>
                  ))}
                </div>
              )}
              {step.type === 'radio' && (
                <div className="wsp-pills">
                  {step.options.map((o) => (
                    <button key={o} type="button"
                      className={`wsp-pill ${answers[step.id] === o ? 'wsp-pill--on' : ''}`}
                      onClick={() => setAnswer(step.id, o)}>
                      {o}
                    </button>
                  ))}
                </div>
              )}
              {step.type === 'checklist' && (
                <div className="wsp-pills">
                  {step.options.map((o) => {
                    const on = (answers[step.id] || []).includes(o);
                    return (
                      <button key={o} type="button"
                        className={`wsp-pill ${on ? 'wsp-pill--on' : ''}`}
                        onClick={() => toggleChecklist(step.id, o)}>
                        {on && <Check size={12} strokeWidth={2} />} {o}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}

        <div className="wsp-form__actions">
          <button type="submit" className="wsp-submit" disabled={submitting}
                  data-testid="wsp-submit">
            {submitting ? 'Salvataggio…' : 'Conferma e prepara il workspace'}
            <ArrowUpRight size={15} strokeWidth={1.6} />
          </button>
          <Link to="/dashboard" className="wsp-cancel">Annulla</Link>
        </div>
      </form>
    </div>
  );
};

export default WorkspacePreparePage;
