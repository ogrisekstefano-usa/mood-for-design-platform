/**
 * StartYourAtelierCards — ITER154 First Experience Activation
 *
 * 5 cinematic action cards shown to studios that haven't built
 * their atelier yet. Renders ABOVE the journey grid only when:
 *   - the user has 0 active journeys (silent atelier state)
 *   - OR the guided tour was just completed
 *
 * NOT a "dashboard vuota with CTA". An invito operativo,
 * almost an initial direction.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import {
  UserPlus, Compass, BookOpen, Sparkles, Calendar,
} from 'lucide-react';

const CARDS = [
  {
    code: 'create-lead',
    icon: UserPlus,
    eyebrow: 'PRIMO MOVIMENTO',
    title: 'Accogli la prima relazione',
    body: 'Un nome, un\u2019atmosfera, un\u2019intenzione. È così che lo studio comincia a esistere.',
    cta: 'Crea il primo contatto',
    to: '/workspace/leads',
    accent: 'cyan',
    testid: 'guided-tour-create-lead',
  },
  {
    code: 'new-journey',
    icon: Compass,
    eyebrow: 'IL VIAGGIO',
    title: 'Apri un Design Journey',
    body: 'Un cammino progettuale che accompagna il cliente dall\u2019intuizione iniziale all\u2019atmosfera finale.',
    cta: 'Apri un Journey',
    to: '/workspace/projects',
    accent: 'cyan',
    testid: 'guided-tour-new-journey',
  },
  {
    code: 'media-library',
    icon: BookOpen,
    eyebrow: 'LA MEMORIA',
    title: 'Costruisci l\u2019archivio',
    body: 'Materiali, immagini, riferimenti culturali. Tutto ciò che nutre l\u2019atmosfera dei tuoi progetti.',
    cta: 'Apri Media Library',
    to: '/library',
    accent: 'bronze',
    testid: 'guided-tour-media-library',
  },
  {
    code: 'moodboards',
    icon: Sparkles,
    eyebrow: 'L\u2019ATMOSFERA',
    title: 'Componi le tue atmosfere',
    body: 'I moodboard parlano al cliente prima delle parole. Ogni board è una direzione progettuale.',
    cta: 'Crea un moodboard',
    to: '/inspirations/moodboards',
    accent: 'bronze',
    testid: 'guided-tour-moodboards',
  },
  {
    code: 'editorial-plan',
    icon: Calendar,
    eyebrow: 'IL RITMO',
    title: 'Definisci il piano editoriale',
    body: 'La voce dello studio nel tempo: pubblicazioni, ispirazioni curate, presenza culturale.',
    cta: 'Apri il calendario',
    to: '/editorial/calendar',
    accent: 'ivory',
    testid: 'guided-tour-editorial-plan',
  },
];

const StartYourAtelierCards = () => {
  return (
    <section
      className="sya-section"
      data-testid="start-your-atelier"
      aria-label="Start your atelier"
    >
      <header className="sya-section__head">
        <p className="sya-section__eyebrow">START YOUR ATELIER™ · INVITO OPERATIVO</p>
        <h2 className="sya-section__title">
          <em>Il tuo atelier inizia</em> con cinque movimenti.
        </h2>
        <p className="sya-section__lede">
          Nessuna fretta. Ogni gesto è una direzione progettuale, non un task da spuntare.
        </p>
      </header>

      <div className="sya-grid">
        {CARDS.map((c, idx) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.code}
              to={c.to}
              className={`sya-card sya-card--${c.accent}`}
              data-testid={c.testid}
              style={{ '--sya-index': idx }}
            >
              <div className="sya-card__rail" aria-hidden />
              <div className="sya-card__icon" aria-hidden>
                <Icon size={20} strokeWidth={1.4} />
              </div>
              <p className="sya-card__eyebrow">{c.eyebrow}</p>
              <h3 className="sya-card__title">{c.title}</h3>
              <p className="sya-card__body">{c.body}</p>
              <span className="sya-card__cta">
                {c.cta}
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.4"
                        strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default StartYourAtelierCards;
