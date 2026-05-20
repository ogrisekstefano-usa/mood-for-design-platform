/**
 * ArchiveBanner · Sprint G.6
 *
 * Banner editoriale che ricontestualizza le pagine globali legacy
 * (Moodboards, Materials, Proposals) come ARCHIVI trasversali al Journey.
 *
 * Direction Lock G.6: queste pagine NON sono workspace principali. Il
 * workspace di una moodboard / materia vive DENTRO al suo Journey Step.
 * Qui si offre solo una vista d'archivio / indice di ricerca.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

const ArchiveBanner = ({ eyebrow, title, lede, ctaLabel = 'Apri Studio Pulse', ctaTo = '/dashboard', testid }) => (
  <div className="sw-archive-banner" data-testid={testid || 'archive-banner'}>
    <Compass size={20} className="sw-archive-banner__icon" />
    <div className="sw-archive-banner__body">
      <p className="sw-archive-banner__eyebrow">{eyebrow}</p>
      <p className="sw-archive-banner__title"><em>{title}</em></p>
      {lede && <p className="sw-archive-banner__lede">{lede}</p>}
    </div>
    <Link
      to={ctaTo}
      data-testid={`${testid || 'archive-banner'}-cta`}
      style={{
        padding: '9px 18px',
        borderRadius: 3,
        border: '1px solid color-mix(in srgb, var(--jo-accent, #d9b285) 45%, transparent)',
        color: 'var(--jo-accent, #d9b285)',
        fontSize: 11,
        letterSpacing: '0.02em',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {ctaLabel}
    </Link>
  </div>
);

export default ArchiveBanner;
