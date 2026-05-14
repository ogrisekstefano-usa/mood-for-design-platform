// MOOD for DESIGN™ — DEMO STORE Navigation Content
// Mirrors future DB: `cms_navigation` { tenant_id, scope:'header'|'footer', config jsonb }

export const navigationContent = {
  brand: {
    name: 'MOOD for DESIGN',
    suffix: '\u2122',
    logoSrc: '/brand/mood-for-design-mark.png',
    tagline: {
      it: 'Arredare spazi.\nCostruire relazioni.',
      en: 'Shaping spaces.\nBuilding relationships.',
      fr: 'Aménager des espaces.\nBâtir des relations.',
      de: 'Räume gestalten.\nBeziehungen aufbauen.',
      es: 'Diseñar espacios.\nConstruir relaciones.',
    },
  },
  header: {
    links: [
      { id: 'about',     href: '#about',      label: { it: 'CHI SIAMO',  en: 'ABOUT',      fr: 'À PROPOS',   de: 'ÜBER UNS',     es: 'NOSOTROS' } },
      { id: 'services',  href: '#services',   label: { it: 'SERVIZI',    en: 'SERVICES',   fr: 'SERVICES',   de: 'LEISTUNGEN',   es: 'SERVICIOS' } },
      { id: 'materials', href: '#materials',  label: { it: 'MATERIALI',  en: 'MATERIALS',  fr: 'MATÉRIAUX', de: 'MATERIALIEN',  es: 'MATERIALES' } },
      { id: 'projects',  href: '/projects',   label: { it: 'PROGETTI',   en: 'PROJECTS',   fr: 'PROJETS',   de: 'PROJEKTE',     es: 'PROYECTOS' } },
      { id: 'journal',   href: '#journal',    label: { it: 'JOURNAL',    en: 'JOURNAL',    fr: 'JOURNAL',   de: 'JOURNAL',      es: 'JOURNAL' } },
      { id: 'showroom',  href: '#showroom',   label: { it: 'SHOWROOM',   en: 'SHOWROOM',   fr: 'SHOWROOM',  de: 'SHOWROOM',     es: 'SHOWROOM' } },
      { id: 'contact',   href: '#contact',    label: { it: 'CONTATTI',   en: 'CONTACT',    fr: 'CONTACT',   de: 'KONTAKT',      es: 'CONTACTO' } },
    ],
    access: {
      label: { it: 'ACCEDI', en: 'SIGN IN', fr: 'CONNEXION', de: 'ANMELDEN', es: 'ACCEDER' },
      href: '/auth/login',
    },
  },
  footer: {
    tagline: {
      it: 'Arredare spazi.\nCostruire relazioni.',
      en: 'Shaping spaces.\nBuilding relationships.',
      fr: 'Aménager des espaces.\nBâtir des relations.',
      de: 'Räume gestalten.\nBeziehungen aufbauen.',
      es: 'Diseñar espacios.\nConstruir relaciones.',
    },
    columns: [
      {
        id: 'company',
        title: { it: 'AZIENDA', en: 'COMPANY', fr: 'ENTREPRISE', de: 'UNTERNEHMEN', es: 'EMPRESA' },
        links: [
          { href: '#about',    label: { it: 'Chi siamo',     en: 'About us',    fr: 'À propos',     de: 'Über uns',    es: 'Nosotros' } },
          { href: '#showroom', label: { it: 'Showroom',      en: 'Showroom',    fr: 'Showroom',     de: 'Showroom',    es: 'Showroom' } },
          { href: '#careers',  label: { it: 'Lavora con noi', en: 'Careers',    fr: 'Rejoindre',    de: 'Karriere',    es: 'Únete' } },
          { href: '#press',    label: { it: 'Press',          en: 'Press',      fr: 'Presse',       de: 'Presse',      es: 'Prensa' } },
        ],
      },
      {
        id: 'services',
        title: { it: 'SERVIZI', en: 'SERVICES', fr: 'SERVICES', de: 'LEISTUNGEN', es: 'SERVICIOS' },
        links: [
          { href: '#progettazione', label: { it: 'Progettazione',  en: 'Design service',  fr: 'Conception',    de: 'Planung',          es: 'Proyecto' } },
          { href: '#consulenza',    label: { it: 'Consulenza',     en: 'Consulting',      fr: 'Conseil',       de: 'Beratung',         es: 'Consultoría' } },
          { href: '#styling',       label: { it: 'Interior Styling', en: 'Interior styling', fr: 'Styling intérieur', de: 'Interior Styling', es: 'Interior styling' } },
          { href: '#contract',      label: { it: 'Contract',       en: 'Contract',        fr: 'Contract',      de: 'Contract',         es: 'Contract' } },
        ],
      },
      {
        id: 'resources',
        title: { it: 'RISORSE', en: 'RESOURCES', fr: 'RESSOURCES', de: 'RESSOURCEN', es: 'RECURSOS' },
        links: [
          { href: '#materials', label: { it: 'Materiali', en: 'Materials', fr: 'Matériaux', de: 'Materialien', es: 'Materiales' } },
          { href: '#brand',     label: { it: 'Brand',     en: 'Brands',    fr: 'Marques',   de: 'Marken',      es: 'Marcas' } },
          { href: '#journal',   label: { it: 'Journal',   en: 'Journal',   fr: 'Journal',   de: 'Journal',     es: 'Journal' } },
          { href: '#faq',       label: { it: 'FAQ',       en: 'FAQ',       fr: 'FAQ',       de: 'FAQ',         es: 'FAQ' } },
        ],
      },
      {
        id: 'support',
        title: { it: 'SUPPORTO', en: 'SUPPORT', fr: 'SUPPORT', de: 'SUPPORT', es: 'SOPORTE' },
        links: [
          { href: '#contact',  label: { it: 'Contatti',   en: 'Contact',         fr: 'Contact',         de: 'Kontakt',          es: 'Contacto' } },
          { href: '#privacy',  label: { it: 'Privacy Policy', en: 'Privacy Policy', fr: 'Politique de confidentialité', de: 'Datenschutz', es: 'Política de privacidad' } },
          { href: '#cookies',  label: { it: 'Cookie Policy',  en: 'Cookie Policy',  fr: 'Politique cookies',           de: 'Cookie-Richtlinie', es: 'Política de cookies' } },
          { href: '#terms',    label: { it: 'Termini e Condizioni', en: 'Terms & Conditions', fr: 'CGU', de: 'AGB', es: 'Términos y Condiciones' } },
        ],
      },
    ],
    showroom: {
      title: { it: 'SHOWROOM', en: 'SHOWROOM', fr: 'SHOWROOM', de: 'SHOWROOM', es: 'SHOWROOM' },
      addressLines: [
        'Via Della Manifattura, 12',
        '33080 Porcia (PN) — Italia',
        '+39 0434 123456',
        'info@moodfordesign.com',
      ],
      bookCta: {
        label: { it: 'PRENOTA UNA VISITA', en: 'BOOK A VISIT', fr: 'PRENDRE RENDEZ-VOUS', de: 'BESUCH BUCHEN', es: 'RESERVAR UNA VISITA' },
        href: '#book',
      },
    },
    socials: [
      { id: 'instagram', href: 'https://instagram.com/', label: 'Instagram', icon: 'instagram' },
      { id: 'pinterest', href: 'https://pinterest.com/', label: 'Pinterest', icon: 'pinterest' },
      { id: 'linkedin',  href: 'https://linkedin.com/',  label: 'LinkedIn',  icon: 'linkedin' },
      { id: 'tiktok',    href: 'https://tiktok.com/',    label: 'TikTok',    icon: 'tiktok' },
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
