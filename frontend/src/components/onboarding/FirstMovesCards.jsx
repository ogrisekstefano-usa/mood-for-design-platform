/**
 * FirstMovesCards — ITER154 First Experience Activation
 *
 * 5 cinematic action cards shown to studios that haven't built
 * their first Design Journey yet. Renders ABOVE the journey grid
 * only when:
 *   - the user has 0 active journeys (silent studio state)
 *   - OR the guided tour was just completed
 *
 * NOT a "dashboard vuota con CTA". An invito operativo,
 * almost an initial direction.
 *
 * Semantic note (ITER154 rev): "Atelier" terminology removed —
 * we speak about Studio (workspace), Blueprint (platform),
 * Design Journey (single client path). "Atelier" stays only
 * for the visual preset (Atelier Mode™).
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
    eyebrow: 'PRIMA MOSSA',
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
    cta: 'Apri un Design Journey™',
    to: '/workspace/projects',
    accent: 'cyan',
    testid: 'guided-tour-new-journey',
  },
  {
    code: 'media-library',
    icon: BookOpen,
    eyebrow: 'LA MEMORIA',
    title: 'Costruisci la libreria',
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

const FirstMovesCards = () => {
  return (
    <section
      className="fm-section"
      data-testid="first-moves"
      aria-label="Le prime mosse"
    >
      <header className="fm-section__head">
        <p className="fm-section__eyebrow">LE PRIME MOSSE · INIZIA DA QUI</p>
        <h2 className="fm-section__title">
          <em>Il tuo studio inizia</em> con cinque mosse.
        </h2>
        <p className="fm-section__lede">
          Nessuna fretta. Ogni gesto è una direzione progettuale, non un task da spuntare.
        </p>
      </header>

      <div className="fm-grid">
        {CARDS.map((c, idx) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.code}
              to={c.to}
              className={`fm-card fm-card--${c.accent}`}
              data-testid={c.testid}
              style={{ '--fm-index': idx }}
            >
              <div className="fm-card__rail" aria-hidden />
              <div className="fm-card__icon" aria-hidden>
                <Icon size={20} strokeWidth={1.4} />
              </div>
              <p className="fm-card__eyebrow">{c.eyebrow}</p>
              <h3 className="fm-card__title">{c.title}</h3>
              <p className="fm-card__body">{c.body}</p>
              <span className="fm-card__cta">
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

export default FirstMovesCards;
