/**
 * ComingSoonPage — Placeholder editoriale per moduli del Design Journey™
 * non ancora costruiti (Render · Hotspots · Site Evolution · Documents ·
 * Design Stories · Visual Archive · Product Gallery).
 *
 * NO admin chrome, NO "construction site" tropes. Solo un capitolo che
 * arriverà. Linguaggio editoriale, dark cinematic, breathing space.
 */
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Compass, ArrowUpRight } from 'lucide-react';
import JourneyContextHeader from '../../components/journey/JourneyContextHeader';
import { useT } from '../../i18n/useT';

const PLACEHOLDERS = {
  render: {
    eyebrow:  'Capitolo · Render',
    title:    'Il progetto trova la sua immagine',
    body:     'Renderizzazioni, viste cinematiche, presentazioni finali — il momento in cui la direzione progettuale diventa visibile al cliente. In sviluppo. Disponibile a breve.',
    milestone: 'Final Presentation',
  },
  hotspots: {
    eyebrow:  'Capitolo · Hotspots',
    title:    'Punti di lettura visiva',
    body:     'Hotspots curatoriali per guidare lo sguardo del cliente attraverso le immagini del progetto. In sviluppo. Disponibile a breve.',
    milestone: 'Curated Selections',
  },
  'site-evolution': {
    eyebrow:  'Capitolo · Site Evolution',
    title:    'L\u2019evoluzione reale del progetto',
    body:     'Timeline fotografica del cantiere, prima e dopo, dettagli che maturano nel tempo. Il progetto raccontato per immagini in ordine cronologico. In sviluppo. Disponibile a breve.',
    milestone: 'Site Evolution',
  },
  documents: {
    eyebrow:  'Capitolo · Documents',
    title:    'Il Technical Package',
    body:     'Tavole tecniche, schede materia, documenti firmati — il progetto pronto per il cantiere. In sviluppo. Disponibile a breve.',
    milestone: 'Technical Package',
  },
  'design-stories': {
    eyebrow:  'Capitolo · Design Stories',
    title:    'Progetti che diventano storie',
    body:     'Case narrative editoriali, showcase, journey pubblicati. Il momento in cui un progetto completato si trasforma in contenuto culturale per lo studio. In sviluppo. Disponibile a breve.',
    milestone: null,
  },
  'visual-archive': {
    eyebrow:  'Capitolo · Visual Archive',
    title:    'La memoria visuale dello studio',
    body:     'Archivio visivo delle immagini, materie e dettagli accumulati nel tempo — la grammatica visiva che lo studio costruisce progetto dopo progetto. In sviluppo. Disponibile a breve.',
    milestone: null,
  },
  'product-gallery': {
    eyebrow:  'Capitolo · Product Gallery',
    title:    'Il visual atelier dei prodotti',
    body:     'Composizioni curatoriali, atmosfere, accostamenti — l\u2019atlante visivo dei prodotti viene aperto direttamente da Inspirations o dal Design Journey™.',
    milestone: null,
  },
};

const slugFromPath = (pathname) => {
  // Last meaningful segment, sanitised
  const parts = pathname.split('/').filter(Boolean);
  return parts[parts.length - 1] || 'render';
};

const ComingSoonPage = () => {
  const { t } = useT();
  const location = useLocation();
  const slug = slugFromPath(location.pathname);
  const meta = PLACEHOLDERS[slug] || {
    eyebrow:  'Capitolo · In costruzione',
    title:    'Sarà disponibile presto',
    body:     'Questo ambiente è in lavorazione. Tornerà presto come parte del Design Journey™.',
    milestone: null,
  };

  return (
    <div
      className="min-h-[calc(100vh-3rem)] bg-[var(--bp-bg,#0a0b0c)] text-[var(--bp-text-primary,#e8e6e1)]"
      data-testid={`coming-soon-${slug}`}
    >
      <JourneyContextHeader compact />

      <div className="max-w-3xl mx-auto px-8 py-24 sm:py-28">
        <p
          data-testid="coming-soon-eyebrow"
          className="text-[10.5px] tracking-[0.28em] uppercase font-mono mb-8"
          style={{ color: 'var(--bp-primary, #d9b285)' }}
        >
          {meta.eyebrow}
        </p>

        <h1
          data-testid="coming-soon-title"
          className="font-heading text-[44px] sm:text-[52px] leading-[1.05] font-light tracking-[-0.012em] mb-8"
          style={{ fontFamily: 'Playfair Display, Cormorant Garamond, Georgia, serif' }}
        >
          <em>{meta.title}</em>
        </h1>

        <p
          data-testid="coming-soon-body"
          className="text-[16px] leading-[1.75] max-w-[58ch] mb-12"
          style={{
            color: 'var(--bp-text-secondary, #a8a8a4)',
            fontFamily: 'Playfair Display, Georgia, serif',
            fontStyle: 'italic',
            fontWeight: 300,
          }}
        >
          {meta.body}
        </p>

        <div className="flex items-center gap-6 flex-wrap">
          <Link
            to="/workspace/projects"
            data-testid="coming-soon-journey-link"
            className="inline-flex items-center gap-2 px-5 py-3 text-[11px] tracking-[0.22em] uppercase
                       border border-[var(--bp-border,#272727)]
                       hover:border-[var(--bp-primary,#d9b285)] transition-colors duration-300
                       font-mono"
          >
            <Compass size={14} strokeWidth={1.4} />
            <span>{t('placeholder.coming_soon.torna_ai_progetti')}</span>
            <ArrowUpRight size={12} strokeWidth={1.4} />
          </Link>

          {meta.milestone && (
            <span
              className="text-[10.5px] tracking-[0.22em] uppercase font-mono"
              style={{ color: 'var(--bp-text-faint, #6e6e6a)' }}
            >
              Collegato a · {meta.milestone}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComingSoonPage;
