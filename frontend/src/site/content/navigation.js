// MOOD for DESIGN™ — Corporate Platform Navigation
// Information architecture: Platform · Workflow · Moodboards · Projects · Journal · Pricing · About
// Mirrors future DB: `cms_navigation` { tenant_id, scope:'header'|'footer', config jsonb }

export const navigationContent = {
  brand: {
    name: 'MOOD for DESIGN',
    suffix: '\u2122',
    logoSrc: '/brand/mood-for-design-mark.png',
    tagline: {
      it: 'Dal lead al progetto. Alla consegna.',
      en: 'From lead to project. To delivery.',
      fr: 'Du prospect au projet. À la livraison.',
      de: 'Vom Lead zum Projekt. Zur Übergabe.',
      es: 'Del lead al proyecto. A la entrega.',
    },
  },
  header: {
    // Top-level IA for the corporate platform site.
    // Order matters — Platform comes first (the OS itself), then the
    // capability surfaces, then resources & commercial pages.
    links: [
      { id: 'platform',   href: '/platform',   label: { it: 'PLATFORM',    en: 'PLATFORM',    fr: 'PLATEFORME',  de: 'PLATTFORM',    es: 'PLATAFORMA' } },
      { id: 'workflow',   href: '#workflow',   label: { it: 'WORKFLOW',    en: 'WORKFLOW',    fr: 'WORKFLOW',    de: 'WORKFLOW',     es: 'WORKFLOW' } },
      { id: 'moodboards', href: '#moodboards', label: { it: 'MOODBOARD',   en: 'MOODBOARDS',  fr: 'MOODBOARDS',  de: 'MOODBOARDS',   es: 'MOODBOARDS' } },
      { id: 'projects',   href: '/projects',   label: { it: 'PROGETTI',    en: 'PROJECTS',    fr: 'PROJETS',     de: 'PROJEKTE',     es: 'PROYECTOS' } },
      { id: 'journal',    href: '#journal',    label: { it: 'JOURNAL',     en: 'JOURNAL',     fr: 'JOURNAL',     de: 'JOURNAL',      es: 'JOURNAL' } },
      { id: 'pricing',    href: '#pricing',    label: { it: 'PIANI',       en: 'PRICING',     fr: 'TARIFS',      de: 'PREISE',       es: 'PRECIOS' } },
      { id: 'about',      href: '#about',      label: { it: 'AZIENDA',     en: 'ABOUT',       fr: 'À PROPOS',    de: 'ÜBER UNS',     es: 'NOSOTROS' } },
    ],
    access: {
      label: { it: 'ACCEDI', en: 'SIGN IN', fr: 'CONNEXION', de: 'ANMELDEN', es: 'ACCEDER' },
      href: '/auth/login',
    },
    cta: {
      label: { it: 'PRENOTA UNA DEMO', en: 'BOOK A DEMO', fr: 'RÉSERVER UNE DÉMO', de: 'DEMO BUCHEN', es: 'RESERVAR DEMO' },
      href: '/professionals',
    },
  },
  footer: {
    tagline: {
      it: 'Il workflow OS per studi di interior design e showroom.\nDal lead al progetto, alla consegna.',
      en: 'The workflow OS for interior design studios and showrooms.\nFrom lead to project, to delivery.',
      fr: 'Le workflow OS pour studios d’interior design et showrooms.\nDu prospect au projet, à la livraison.',
      de: 'Das Workflow-OS für Interior-Design-Studios und Showrooms.\nVom Lead zum Projekt, zur Übergabe.',
      es: 'El workflow OS para estudios de interior design y showrooms.\nDel lead al proyecto, a la entrega.',
    },
    columns: [
      {
        id: 'platform',
        title: { it: 'PIATTAFORMA', en: 'PLATFORM', fr: 'PLATEFORME', de: 'PLATTFORM', es: 'PLATAFORMA' },
        links: [
          { href: '/platform',           label: { it: 'Panoramica',       en: 'Overview',        fr: 'Aperçu',          de: 'Überblick',       es: 'Resumen' } },
          { href: '#workflow',           label: { it: 'Workflow',         en: 'Workflow',        fr: 'Workflow',        de: 'Workflow',        es: 'Workflow' } },
          { href: '#moodboards',         label: { it: 'Moodboard',        en: 'Moodboards',      fr: 'Moodboards',      de: 'Moodboards',      es: 'Moodboards' } },
          { href: '#draft-live',         label: { it: 'Draft vs Live',    en: 'Draft vs Live',   fr: 'Draft vs Live',   de: 'Draft vs Live',   es: 'Draft vs Live' } },
        ],
      },
      {
        id: 'use_cases',
        title: { it: 'CASI D’USO', en: 'USE CASES', fr: 'CAS D’USAGE', de: 'ANWENDUNGEN', es: 'CASOS DE USO' },
        links: [
          { href: '#studios',            label: { it: 'Studi di design',  en: 'Design studios',  fr: 'Studios de design', de: 'Design-Studios', es: 'Estudios de diseño' } },
          { href: '#showrooms',          label: { it: 'Showroom',         en: 'Showrooms',       fr: 'Showrooms',         de: 'Showrooms',      es: 'Showrooms' } },
          { href: '#architects',         label: { it: 'Architetti',       en: 'Architects',      fr: 'Architectes',       de: 'Architekten',    es: 'Arquitectos' } },
          { href: '#contract',           label: { it: 'Contract',         en: 'Contract',        fr: 'Contract',          de: 'Contract',       es: 'Contract' } },
        ],
      },
      {
        id: 'resources',
        title: { it: 'RISORSE', en: 'RESOURCES', fr: 'RESSOURCES', de: 'RESSOURCEN', es: 'RECURSOS' },
        links: [
          { href: '#journal',  label: { it: 'Journal',   en: 'Journal',   fr: 'Journal',   de: 'Journal',     es: 'Journal' } },
          { href: '#cases',    label: { it: 'Case study', en: 'Case studies', fr: 'Études de cas', de: 'Fallstudien', es: 'Casos de estudio' } },
          { href: '#guides',   label: { it: 'Guide',     en: 'Guides',    fr: 'Guides',    de: 'Guides',      es: 'Guías' } },
          { href: '#faq',      label: { it: 'FAQ',       en: 'FAQ',       fr: 'FAQ',       de: 'FAQ',         es: 'FAQ' } },
        ],
      },
      {
        id: 'company',
        title: { it: 'AZIENDA', en: 'COMPANY', fr: 'ENTREPRISE', de: 'UNTERNEHMEN', es: 'EMPRESA' },
        links: [
          { href: '#about',    label: { it: 'Chi siamo',     en: 'About us',    fr: 'À propos',     de: 'Über uns',    es: 'Nosotros' } },
          { href: '#pricing',  label: { it: 'Piani',          en: 'Pricing',    fr: 'Tarifs',       de: 'Preise',      es: 'Precios' } },
          { href: '#careers',  label: { it: 'Lavora con noi', en: 'Careers',    fr: 'Rejoindre',    de: 'Karriere',    es: 'Únete' } },
          { href: '#contact',  label: { it: 'Contatti',       en: 'Contact',    fr: 'Contact',      de: 'Kontakt',     es: 'Contacto' } },
        ],
      },
      {
        id: 'legal',
        title: { it: 'LEGAL', en: 'LEGAL', fr: 'LÉGAL', de: 'RECHTLICH', es: 'LEGAL' },
        links: [
          { href: '#privacy',  label: { it: 'Privacy Policy',          en: 'Privacy Policy',          fr: 'Politique de confidentialité', de: 'Datenschutz',          es: 'Política de privacidad' } },
          { href: '#cookies',  label: { it: 'Cookie Policy',           en: 'Cookie Policy',           fr: 'Politique cookies',           de: 'Cookie-Richtlinie',    es: 'Política de cookies' } },
          { href: '#terms',    label: { it: 'Termini e Condizioni',    en: 'Terms & Conditions',     fr: 'CGU',                          de: 'AGB',                  es: 'Términos y Condiciones' } },
          { href: '#security', label: { it: 'Sicurezza & DPA',         en: 'Security & DPA',         fr: 'Sécurité & DPA',              de: 'Sicherheit & DPA',     es: 'Seguridad y DPA' } },
        ],
      },
    ],
    // Showroom block becomes a "Get a demo" CTA instead of a physical address.
    showroom: {
      title: { it: 'PRENOTA UNA DEMO', en: 'BOOK A DEMO', fr: 'RÉSERVER UNE DÉMO', de: 'DEMO BUCHEN', es: 'RESERVAR UNA DEMO' },
      addressLines: [
        'hello@moodfordesign.com',
        'Milano · Porcia · Remote-first',
      ],
      bookCta: {
        label: { it: 'PRENOTA UNA DEMO', en: 'BOOK A DEMO', fr: 'RÉSERVER UNE DÉMO', de: 'DEMO BUCHEN', es: 'RESERVAR UNA DEMO' },
        href: '/professionals',
      },
    },
    socials: [
      { id: 'linkedin',  href: 'https://linkedin.com/',  label: 'LinkedIn',  icon: 'linkedin' },
      { id: 'instagram', href: 'https://instagram.com/', label: 'Instagram', icon: 'instagram' },
    ],
    copyright: {
      it: '© {year} MOOD for DESIGN\u2122 — Tutti i diritti riservati.',
      en: '© {year} MOOD for DESIGN\u2122 — All rights reserved.',
      fr: '© {year} MOOD for DESIGN\u2122 — Tous droits réservés.',
      de: '© {year} MOOD for DESIGN\u2122 — Alle Rechte vorbehalten.',
      es: '© {year} MOOD for DESIGN\u2122 — Todos los derechos reservados.',
    },
  },
};
