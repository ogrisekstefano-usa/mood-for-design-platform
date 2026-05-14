import React, { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowUpRight, ArrowLeft, Mail } from 'lucide-react';
import { useSite } from '../../site/SiteContext';
import { Reveal } from '../../site/components/Reveal';

const COPY = {
  private: {
    eyebrow: { it: 'Per i privati', en: 'For private clients', fr: 'Pour les particuliers', de: 'Für Privatkunden', es: 'Para clientes privados' },
    title: {
      it: 'Stiamo preparando\nun onboarding all\u2019altezza.',
      en: 'We\u2019re preparing\nan onboarding to match.',
      fr: 'Nous préparons\nun onboarding à la hauteur.',
      de: 'Wir bereiten\nein passendes Onboarding vor.',
      es: 'Estamos preparando\nun onboarding a la altura.',
    },
    body: {
      it: 'Un percorso emotivo, in 7 passi: la tua visione, il tuo spazio, le tue referenze. Alla fine, ti affianchiamo a un designer reale. Aprirà a breve.',
      en: 'An emotional 7-step path: your vision, your space, your references. At the end, we pair you with a real designer. Opening soon.',
      fr: 'Un parcours émotionnel en 7 étapes : votre vision, votre espace, vos références. À la fin, un designer réel. Bientôt disponible.',
      de: 'Ein emotionaler 7-Schritte-Pfad: Vision, Raum, Referenzen. Am Ende ein echter Designer. Bald verfügbar.',
      es: 'Un recorrido emocional en 7 pasos: tu visión, tu espacio, tus referencias. Al final, un diseñador real. Próximamente.',
    },
    cta: { it: 'Scrivici intanto', en: 'Write to us', fr: 'Écrivez-nous', de: 'Schreiben Sie uns', es: 'Escríbenos' },
  },
  pro: {
    eyebrow: { it: 'Per i professionisti', en: 'For professionals', fr: 'Pour les professionnels', de: 'Für Fachleute', es: 'Para profesionales' },
    title: {
      it: 'Lo studio operativo\nsta arrivando.',
      en: 'The operating studio\nis on its way.',
      fr: 'Le studio opérationnel\narrive bientôt.',
      de: 'Das Studio-Betriebssystem\nkommt bald.',
      es: 'El estudio operativo\nestá llegando.',
    },
    body: {
      it: 'Workspace, moodboard cinematografici, sourcing tracciato, proposte editoriali, relazione con il cliente. Accedi al Blueprint Workspace o richiedi un onboarding dedicato.',
      en: 'Workspace, cinematic moodboards, traced sourcing, editorial proposals, client relationship. Access the Blueprint Workspace or request a dedicated onboarding.',
      fr: 'Workspace, moodboards cinématiques, sourcing tracé, propositions éditoriales, relation client. Accédez au Blueprint Workspace ou demandez un onboarding dédié.',
      de: 'Workspace, kinematische Moodboards, verfolgtes Sourcing, redaktionelle Angebote, Kundenbeziehung. Greifen Sie auf Blueprint Workspace zu oder fordern Sie ein Onboarding an.',
      es: 'Workspace, moodboards cinematográficos, sourcing trazado, propuestas editoriales, relación con el cliente. Accede al Blueprint Workspace o solicita onboarding.',
    },
    cta: { it: 'Accedi al Workspace', en: 'Access the Workspace', fr: 'Accéder au Workspace', de: 'Workspace betreten', es: 'Acceder al Workspace' },
    ctaHref: '/auth/login',
  },
};

const OnboardingPlaceholderPage = () => {
  const { kind } = useParams();
  const { pick } = useSite();
  const c = COPY[kind] || COPY.private;
  const isPro = kind === 'pro';

  useEffect(() => {
    document.title = `${pick(c.eyebrow)} — MOOD for DESIGN™`;
  }, [pick, c.eyebrow]);

  return (
    <div data-testid={`site-onboarding-${kind}`}>
      <section className="mfd-section" style={{ paddingTop: 'clamp(8rem, 14vw, 12rem)', minHeight: '80vh', display: 'flex', alignItems: 'center' }}>
        <div className="mfd-wrap" style={{ display: 'grid', gap: '2rem', maxWidth: '1100px' }}>
          <Reveal as="span" className="mfd-eyebrow mfd-eyebrow--accent">{pick(c.eyebrow)}</Reveal>
          <Reveal as="h1" className="mfd-display" delay={2}>{pick(c.title)}</Reveal>
          <Reveal as="p" className="mfd-lead" delay={3}>{pick(c.body)}</Reveal>
          <Reveal delay={4} style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', marginTop: '1rem' }}>
            {isPro ? (
              <Link to={c.ctaHref} className="mfd-btn mfd-btn--accent" data-testid="onboarding-cta-primary">
                {pick(c.cta)} <ArrowUpRight size={14} />
              </Link>
            ) : (
              <a href="mailto:hello@moodfordesign.com" className="mfd-btn mfd-btn--accent" data-testid="onboarding-cta-primary">
                {pick(c.cta)} <Mail size={14} />
              </a>
            )}
            <Link to="/projects" className="mfd-btn" data-testid="onboarding-cta-projects">
              {pick({ it: 'Esplora i progetti', en: 'Explore projects', fr: 'Voir les projets', de: 'Projekte ansehen', es: 'Ver proyectos' })}
              <ArrowUpRight size={14} />
            </Link>
            <Link to="/" className="mfd-btn mfd-btn--ghost" data-testid="onboarding-cta-home">
              <ArrowLeft size={14} /> {pick({ it: 'Torna alla home', en: 'Back home', fr: 'Retour', de: 'Zurück', es: 'Volver' })}
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
};

export default OnboardingPlaceholderPage;
