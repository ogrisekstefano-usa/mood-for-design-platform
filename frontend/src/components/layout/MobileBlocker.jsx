/**
 * MobileBlocker — Atelier Nordic™ desktop-first blocker.
 *
 * ITER138 · Phase 3 (Responsive Cinematic Hardening™).
 *
 * Rendered ONLY on narrow viewports (< 768px). Replaces the entire OS
 * shell with a single cinematic still frame instead of collapsing every
 * dashboard module into a reduced SaaS layout. The intent: preserve the
 * brand's atmospheric weight even when the device cannot host the studio
 * operating system.
 *
 * Copy is fully i18n via t('atelier.blocker.*'). The hero image resolves
 * from the existing DB-driven dashboard media (kind='hero') so the
 * blocker breathes the same Atelier Nordic family as the live dashboard.
 */
import React, { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import api from '../../lib/api';
import { useT, useBlueprint } from '../../contexts/BlueprintContext';
import './mobile-blocker.css';

const MobileBlocker = () => {
  const t = useT();
  const { locale } = useBlueprint();
  const [heroUrl, setHeroUrl] = useState(null);

  useEffect(() => {
    let alive = true;
    api.get(`/api/atelier/dashboard/config?locale=${encodeURIComponent(locale || 'en-US')}`)
      .then(r => { if (alive) setHeroUrl(r.data?.hero_media?.file_url || null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [locale]);

  return (
    <div className="abk" data-testid="atelier-mobile-blocker">
      {heroUrl && (
        <div className="abk__bg" aria-hidden>
          <img src={heroUrl} alt="" />
          <div className="abk__veil" />
        </div>
      )}

      <header className="abk__top">
        <span className="abk__brand">MOOD</span>
        <span className="abk__brand-sub">for Design™</span>
      </header>

      <main className="abk__body">
        <p className="abk__eyebrow">
          {t('atelier.blocker.eyebrow', null, 'Blueprint Atelier™')}
        </p>

        <h1 className="abk__title">
          {t('atelier.blocker.title', null, 'Designed for the studio workstation.')}
        </h1>

        <p className="abk__lede">
          {t('atelier.blocker.lede', null,
            'Your atelier breathes on a wide canvas. The cinematic operating system rests on desktop architecture — return to your studio to continue.')}
        </p>

        <a className="abk__cta" href="mailto:?subject=Open%20MOOD%20for%20Design&body=Open this link on your studio workstation:%0A%0A"
           data-testid="atelier-mobile-blocker-cta">
          {t('atelier.blocker.cta', null, 'Send to my workstation')}
          <ArrowUpRight size={14} strokeWidth={1.6} />
        </a>

        <p className="abk__whisper">
          {t('atelier.blocker.whisper', null,
            'Recommended canvas · 1280 px and wider.')}
        </p>
      </main>

      <footer className="abk__foot">
        <span>© {new Date().getFullYear()} Blueprint OS™</span>
      </footer>
    </div>
  );
};

export default MobileBlocker;
