/**
 * DemoOnboardingTour — guided 4-step micro-tour for the EXE interactive demo.
 *
 * Activation: presence of `?demo=1` in the URL on /settings/storefront.
 * Persistence: dismissal is stored in localStorage so a refresh respects it.
 *
 * Steps (designed to be self-paced, not pushy)
 *   1. Edit the hero headline
 *   2. Open the Diff Drawer to see Draft vs Live
 *   3. Publish the revision
 *   4. Inspect revision history
 *
 * Each step anchors to a real Studio control via [data-testid], highlights
 * it with a soft teal glow, and shows a cinematic instruction card. The
 * user can advance, skip, or close at any time.
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, X, CheckCircle2 } from 'lucide-react';
import { useSite } from '../../site/SiteContext';

const STORAGE_KEY = 'mfd_demo_tour_dismissed';

const STEPS = [
  {
    id: 'hero',
    anchor: 'studio-canvas',             // best-effort; falls back to viewport center
    title: {
      it: 'Modifica un titolo',  en: 'Edit a headline', fr: 'Modifier un titre',
      de: 'Eine Headline ändern', es: 'Edita un titular', ae: 'حرّر العنوان',
    },
    body: {
      it: 'Clicca su un blocco nella canvas e cambia un testo — il salvataggio è automatico.',
      en: 'Click any block on the canvas and change a text — autosave is on.',
      fr: 'Cliquez sur un bloc dans le canvas et modifiez un texte — sauvegarde automatique.',
      de: 'Klicken Sie auf einen Block im Canvas und ändern Sie einen Text — automatisches Speichern.',
      es: 'Haz clic en cualquier bloque y cambia un texto — autosave activado.',
      ae: 'انقر على أي عنصر في الكانفس وغيّر النص — الحفظ تلقائي.',
    },
  },
  {
    id: 'diff',
    anchor: 'studio-revisions-btn',
    title: {
      it: 'Confronta Draft vs Live', en: 'Compare Draft vs Live', fr: 'Comparer Brouillon et Live',
      de: 'Entwurf mit Live vergleichen', es: 'Compara borrador y live', ae: 'قارن المسودة باللايف',
    },
    body: {
      it: 'Apri il Diff Drawer (icona git-compare) per vedere esattamente cosa cambierà.',
      en: 'Open the Diff Drawer (git-compare icon) to see exactly what will change.',
      fr: 'Ouvrez le Diff Drawer (icône git-compare) pour voir précisément ce qui changera.',
      de: 'Öffnen Sie den Diff Drawer (git-compare-Symbol), um genau zu sehen, was sich ändert.',
      es: 'Abre el Diff Drawer (icono git-compare) para ver exactamente qué cambiará.',
      ae: 'افتح لوحة Diff (أيقونة git-compare) لمعرفة ما الذي سيتغير بالضبط.',
    },
  },
  {
    id: 'publish',
    anchor: 'studio-publish-btn',
    title: {
      it: 'Pubblica la revisione', en: 'Publish the revision', fr: 'Publier la révision',
      de: 'Revision veröffentlichen', es: 'Publica la revisión', ae: 'انشر النسخة',
    },
    body: {
      it: 'Clicca "Review & publish" e dai un nome alla tua revisione — niente sorprese.',
      en: 'Click "Review & publish" and label your revision — no surprises.',
      fr: 'Cliquez sur "Review & publish" et nommez votre révision — sans surprise.',
      de: 'Klicken Sie auf "Review & publish" und benennen Sie Ihre Revision — keine Überraschungen.',
      es: 'Haz clic en "Review & publish" y etiqueta tu revisión — sin sorpresas.',
      ae: 'انقر على "Review & publish" وأضف ملصقاً للنسخة — بلا مفاجآت.',
    },
  },
  {
    id: 'history',
    anchor: 'diff-tab-revisions',
    title: {
      it: 'Storico revisioni', en: 'Revision history', fr: 'Historique des révisions',
      de: 'Revisionsverlauf', es: 'Historial de revisiones', ae: 'سجل النسخ',
    },
    body: {
      it: 'Ogni publish è un punto di ripristino. Confronta, fai revert — sempre con la rete sotto.',
      en: 'Every publish is a restore point. Compare, revert — always with a safety net.',
      fr: 'Chaque publication est un point de restauration. Comparer, revenir — toujours sécurisé.',
      de: 'Jede Veröffentlichung ist ein Wiederherstellungspunkt. Vergleichen, zurücksetzen.',
      es: 'Cada publicación es un punto de restauración. Compara, revierte — siempre con red.',
      ae: 'كل نشر هو نقطة استعادة. قارن واسترجع بأمان دائم.',
    },
  },
];

const CARDS_COPY = {
  next:    { it: 'Avanti',  en: 'Next',   fr: 'Suivant', de: 'Weiter', es: 'Siguiente', ae: 'التالي' },
  finish:  { it: 'Inizia',  en: 'Start',  fr: 'Démarrer',de: 'Starten',es: 'Empezar',   ae: 'ابدأ' },
  skip:    { it: 'Salta tour', en: 'Skip tour', fr: 'Passer', de: 'Überspringen', es: 'Saltar', ae: 'تخطي' },
  ribbon:  { it: 'Workspace demo interattivo', en: 'Interactive Demo Workspace', fr: 'Workspace de démo interactif',
             de: 'Interaktiver Demo-Workspace', es: 'Workspace de demo interactivo', ae: 'مساحة تجريبية تفاعلية' },
  pill:    { it: 'Le modifiche in draft non sono pubbliche',
             en: 'Draft changes are not public',
             fr: 'Les modifications en brouillon ne sont pas publiques',
             de: 'Entwurfsänderungen sind nicht öffentlich',
             es: 'Los cambios en borrador no son públicos',
             ae: 'تغييرات المسودة ليست عامة' },
  stepLbl: { it: 'Passo', en: 'Step', fr: 'Étape', de: 'Schritt', es: 'Paso', ae: 'خطوة' },
};

const useAnchorRect = (testid, version) => {
  // Re-measure on a `version` bump so the highlight tracks scroll/resize too.
  return useMemo(() => {
    if (typeof document === 'undefined' || !testid) return null;
    const el = document.querySelector(`[data-testid="${testid}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testid, version]);
};

const DemoOnboardingTour = () => {
  const { pick, locale } = useSite();
  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [tick, setTick] = useState(0);          // forces anchor re-measure

  // Activation: ?demo=1 + not previously dismissed.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isDemo = params.get('demo') === '1' || localStorage.getItem('mfd_demo_mode') === '1';
    const dismissed = localStorage.getItem(STORAGE_KEY) === '1';
    if (isDemo && !dismissed) setActive(true);
  }, []);

  // Re-measure highlight on scroll/resize so the spotlight tracks the DOM.
  useEffect(() => {
    if (!active) return undefined;
    const bump = () => setTick((t) => t + 1);
    window.addEventListener('scroll', bump, { passive: true });
    window.addEventListener('resize', bump);
    const interval = setInterval(bump, 1500);   // covers async DOM mounts
    return () => {
      window.removeEventListener('scroll', bump);
      window.removeEventListener('resize', bump);
      clearInterval(interval);
    };
  }, [active]);

  const step = STEPS[stepIdx];
  const anchorRect = useAnchorRect(step?.anchor, tick);

  const dismiss = useCallback(() => {
    setActive(false);
    localStorage.setItem(STORAGE_KEY, '1');
  }, []);

  const next = useCallback(() => {
    if (stepIdx >= STEPS.length - 1) { dismiss(); return; }
    setStepIdx((i) => i + 1);
  }, [stepIdx, dismiss]);

  if (!active) {
    // Even if tour is dismissed, surface the demo ribbon while in demo mode.
    if (localStorage.getItem('mfd_demo_mode') === '1') {
      return createPortal(<DemoRibbon pick={pick} dir={locale === 'ar' ? 'rtl' : 'ltr'} />, document.body);
    }
    return null;
  }

  // Card position: anchored beneath the highlighted element when possible,
  // else falls back to a fixed bottom-right cinematic card.
  const cardStyle = anchorRect
    ? {
        position: 'fixed',
        top: Math.min(anchorRect.top + anchorRect.height + 16, window.innerHeight - 220),
        left: Math.max(16, Math.min(anchorRect.left, window.innerWidth - 380)),
        width: 360,
      }
    : { position: 'fixed', right: 24, bottom: 24, width: 360 };

  const isLast = stepIdx >= STEPS.length - 1;

  return createPortal(
    <>
      <DemoRibbon pick={pick} dir={locale === 'ar' ? 'rtl' : 'ltr'} />

      {/* Spotlight ring */}
      {anchorRect && (
        <div
          className="exe-tour__spotlight"
          aria-hidden="true"
          style={{
            position: 'fixed',
            top:   anchorRect.top    - 8,
            left:  anchorRect.left   - 8,
            width: anchorRect.width  + 16,
            height:anchorRect.height + 16,
          }}
          data-testid="demo-tour-spotlight"
        />
      )}

      {/* Instruction card */}
      <div className="exe-tour__card" style={cardStyle} role="dialog" aria-live="polite" data-testid="demo-tour-card">
        <div className="exe-tour__head">
          <span className="exe-tour__step">{pick(CARDS_COPY.stepLbl)} {stepIdx + 1} / {STEPS.length}</span>
          <button onClick={dismiss} className="exe-tour__close" aria-label="Close tour" data-testid="demo-tour-close">
            <X size={14} strokeWidth={1.7} />
          </button>
        </div>
        <h3 className="exe-tour__title" data-testid="demo-tour-title">{pick(step.title)}</h3>
        <p className="exe-tour__body">{pick(step.body)}</p>
        <div className="exe-tour__actions">
          <button onClick={dismiss} className="exe-tour__skip" data-testid="demo-tour-skip">{pick(CARDS_COPY.skip)}</button>
          <button onClick={next} className="exe-tour__next" data-testid="demo-tour-next">
            {isLast
              ? <><CheckCircle2 size={12} strokeWidth={1.8} /> {pick(CARDS_COPY.finish)}</>
              : <>{pick(CARDS_COPY.next)} <ArrowRight size={12} strokeWidth={1.8} /></>}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
};

const DemoRibbon = ({ pick, dir }) => (
  <div className="exe-tour__ribbon" dir={dir} data-testid="demo-ribbon">
    <span className="exe-tour__ribbon-dot" aria-hidden="true" />
    <span className="exe-tour__ribbon-label">{pick(CARDS_COPY.ribbon)}</span>
    <span className="exe-tour__ribbon-pill">{pick(CARDS_COPY.pill)}</span>
  </div>
);

export default DemoOnboardingTour;
