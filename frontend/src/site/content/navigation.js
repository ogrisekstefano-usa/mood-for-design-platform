// MOOD for DESIGN™ — Site Navigation (Header + Footer) Content
// Mirrors future DB: table `site_navigation` (header/footer JSON per tenant)

export const navigationContent = {
  brand: {
    name: 'MOOD for DESIGN',
    suffix: '\u2122',
    tagline: {
      it: 'A Blueprint OS\u2122 Platform',
      en: 'A Blueprint OS\u2122 Platform',
      fr: 'Une plateforme Blueprint OS\u2122',
      de: 'Eine Blueprint OS\u2122 Plattform',
      es: 'Una plataforma Blueprint OS\u2122',
    },
  },
  header: {
    links: [
      {
        id: 'projects',
        href: '/projects',
        label: {
          it: 'Progetti',
          en: 'Projects',
          fr: 'Projets',
          de: 'Projekte',
          es: 'Proyectos',
        },
      },
      {
        id: 'private',
        href: '/onboarding/private',
        label: {
          it: 'Privati',
          en: 'Private clients',
          fr: 'Particuliers',
          de: 'Privatkunden',
          es: 'Privados',
        },
      },
      {
        id: 'pro',
        href: '/onboarding/pro',
        label: {
          it: 'Professionisti',
          en: 'Professionals',
          fr: 'Professionnels',
          de: 'Fachleute',
          es: 'Profesionales',
        },
      },
      {
        id: 'about',
        href: '#about',
        label: {
          it: 'Manifesto',
          en: 'Manifesto',
          fr: 'Manifeste',
          de: 'Manifest',
          es: 'Manifiesto',
        },
      },
    ],
    access: {
      label: {
        it: 'Accedi',
        en: 'Sign in',
        fr: 'Connexion',
        de: 'Anmelden',
        es: 'Acceder',
      },
      href: '/auth/login',
    },
  },
  footer: {
    blurb: {
      it: 'Un ecosistema editoriale globale dedicato al design d\u2019interni. Costruito per relazioni reali fra clienti privati, studi, showroom e brand.',
      en: 'A global editorial ecosystem for interior design. Built for real relationships between private clients, studios, showrooms and brands.',
      fr: 'Un écosystème éditorial global dédié au design d\u2019intérieur. Conçu pour des relations réelles entre clients, studios, showrooms et marques.',
      de: 'Ein globales redaktionelles Ökosystem für Innenarchitektur. Für echte Beziehungen zwischen Kunden, Studios, Showrooms und Marken.',
      es: 'Un ecosistema editorial global para el diseño de interiores. Pensado para relaciones reales entre clientes, estudios, showrooms y marcas.',
    },
    columns: [
      {
        id: 'platform',
        title: {
          it: 'Piattaforma',
          en: 'Platform',
          fr: 'Plateforme',
          de: 'Plattform',
          es: 'Plataforma',
        },
        links: [
          { href: '/projects', label: { it: 'Progetti', en: 'Projects', fr: 'Projets', de: 'Projekte', es: 'Proyectos' } },
          { href: '/onboarding/private', label: { it: 'Per privati', en: 'For clients', fr: 'Pour particuliers', de: 'Für Kunden', es: 'Para clientes' } },
          { href: '/onboarding/pro', label: { it: 'Per professionisti', en: 'For professionals', fr: 'Pour pros', de: 'Für Profis', es: 'Para pros' } },
          { href: '/auth/login', label: { it: 'Workspace', en: 'Workspace', fr: 'Workspace', de: 'Workspace', es: 'Workspace' } },
        ],
      },
      {
        id: 'studio',
        title: {
          it: 'Studio',
          en: 'Studio',
          fr: 'Studio',
          de: 'Studio',
          es: 'Estudio',
        },
        links: [
          { href: '#manifesto', label: { it: 'Manifesto', en: 'Manifesto', fr: 'Manifeste', de: 'Manifest', es: 'Manifiesto' } },
          { href: '#journal', label: { it: 'Journal', en: 'Journal', fr: 'Journal', de: 'Journal', es: 'Journal' } },
          { href: '#press', label: { it: 'Stampa', en: 'Press', fr: 'Presse', de: 'Presse', es: 'Prensa' } },
          { href: '#careers', label: { it: 'Lavora con noi', en: 'Careers', fr: 'Rejoindre', de: 'Karriere', es: 'Únete' } },
        ],
      },
      {
        id: 'contact',
        title: {
          it: 'Contatti',
          en: 'Contact',
          fr: 'Contact',
          de: 'Kontakt',
          es: 'Contacto',
        },
        links: [
          { href: 'mailto:hello@moodfordesign.com', label: { it: 'hello@moodfordesign.com', en: 'hello@moodfordesign.com', fr: 'hello@moodfordesign.com', de: 'hello@moodfordesign.com', es: 'hello@moodfordesign.com' } },
          { href: '#milano', label: { it: 'Milano', en: 'Milan', fr: 'Milan', de: 'Mailand', es: 'Milán' } },
          { href: '#paris', label: { it: 'Parigi', en: 'Paris', fr: 'Paris', de: 'Paris', es: 'París' } },
          { href: '#newyork', label: { it: 'New York', en: 'New York', fr: 'New York', de: 'New York', es: 'Nueva York' } },
        ],
      },
    ],
    copyright: {
      it: '© {year} MOOD for DESIGN\u2122. Tutti i diritti riservati.',
      en: '© {year} MOOD for DESIGN\u2122. All rights reserved.',
      fr: '© {year} MOOD for DESIGN\u2122. Tous droits réservés.',
      de: '© {year} MOOD for DESIGN\u2122. Alle Rechte vorbehalten.',
      es: '© {year} MOOD for DESIGN\u2122. Todos los derechos reservados.',
    },
    legal: [
      { id: 'privacy', href: '#privacy', label: { it: 'Privacy', en: 'Privacy', fr: 'Confidentialité', de: 'Datenschutz', es: 'Privacidad' } },
      { id: 'terms', href: '#terms', label: { it: 'Termini', en: 'Terms', fr: 'CGU', de: 'AGB', es: 'Términos' } },
      { id: 'cookies', href: '#cookies', label: { it: 'Cookie', en: 'Cookies', fr: 'Cookies', de: 'Cookies', es: 'Cookies' } },
    ],
  },
};
