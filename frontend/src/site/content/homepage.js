// MOOD for DESIGN™ — Homepage Content Config
// Mirrors future DB: table `homepage_sections` { section_key, content jsonb (locale-keyed) }
// ZERO hardcoded text. Every label is locale-keyed: { it, en, fr, de, es }

export const homepageContent = {
  meta: {
    title: {
      it: 'MOOD for DESIGN™ — Dove il design diventa relazione',
      en: 'MOOD for DESIGN™ — Where design becomes a relationship',
      fr: 'MOOD for DESIGN™ — Le design comme relation',
      de: 'MOOD for DESIGN™ — Wo Design zur Beziehung wird',
      es: 'MOOD for DESIGN™ — Donde el diseño es una relación',
    },
  },

  hero: {
    eyebrow: {
      it: 'Un ecosistema editoriale per il design d\u2019interni',
      en: 'An editorial ecosystem for interior design',
      fr: 'Un écosystème éditorial pour le design d\u2019intérieur',
      de: 'Ein redaktionelles Ökosystem für Innenarchitektur',
      es: 'Un ecosistema editorial para el diseño de interiores',
    },
    headline: {
      it: 'Dove il design\nincontra la relazione.',
      en: 'Where design\nbecomes relationship.',
      fr: 'Là où le design\ndevient relation.',
      de: 'Wo Design\nzur Beziehung wird.',
      es: 'Donde el diseño\nse vuelve relación.',
    },
    sub: {
      it: 'Una piattaforma globale che collega clienti privati, studi di architettura, showroom e brand del design — attraverso progetti reali, persone reali, materiali reali.',
      en: 'A global platform connecting private clients, architecture studios, showrooms and design brands — through real projects, real people, real materials.',
      fr: 'Une plateforme globale reliant clients privés, studios d\u2019architecture, showrooms et marques du design — par des projets, des personnes et des matériaux réels.',
      de: 'Eine globale Plattform, die Privatkunden, Architekturstudios, Showrooms und Designmarken verbindet — durch echte Projekte, echte Menschen, echte Materialien.',
      es: 'Una plataforma global que conecta clientes privados, estudios de arquitectura, showrooms y marcas de diseño — a través de proyectos, personas y materiales reales.',
    },
    primaryCta: {
      label: {
        it: 'Inizia il tuo progetto',
        en: 'Begin your project',
        fr: 'Commencer votre projet',
        de: 'Projekt beginnen',
        es: 'Comienza tu proyecto',
      },
      href: '/onboarding/private',
    },
    secondaryCta: {
      label: {
        it: 'Sono un professionista',
        en: 'I am a professional',
        fr: 'Je suis un professionnel',
        de: 'Ich bin Fachperson',
        es: 'Soy un profesional',
      },
      href: '/onboarding/pro',
    },
    backgroundImage: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=2400&q=80',
  },

  dualPath: {
    eyebrow: {
      it: 'Due percorsi, una sola visione',
      en: 'Two paths, one vision',
      fr: 'Deux parcours, une même vision',
      de: 'Zwei Wege, eine Vision',
      es: 'Dos caminos, una visión',
    },
    title: {
      it: 'Scegli come entrare\nnel nostro ecosistema.',
      en: 'Choose how to enter\nour ecosystem.',
      fr: 'Choisissez votre entrée\ndans l\u2019écosystème.',
      de: 'Wählen Sie Ihren\nZugang zum Ökosystem.',
      es: 'Elige cómo entrar\nen el ecosistema.',
    },
    private: {
      kicker: {
        it: 'Per i privati',
        en: 'For private clients',
        fr: 'Pour les particuliers',
        de: 'Für Privatkunden',
        es: 'Para clientes privados',
      },
      title: {
        it: 'La tua casa\u00a0— curata da chi la pensa.',
        en: 'Your home\u00a0— shaped by those who think it.',
        fr: 'Votre maison\u00a0— pensée par ceux qui la conçoivent.',
        de: 'Ihr Zuhause\u00a0— gestaltet von denen, die es denken.',
        es: 'Tu hogar\u00a0— diseñado por quienes lo piensan.',
      },
      body: {
        it: 'Raccontaci la tua visione. Ti affianchiamo a un designer reale — non a un algoritmo. Materiali, moodboard, sourcing, relazione umana.',
        en: 'Tell us your vision. We pair you with a real designer — not an algorithm. Materials, moodboards, sourcing, a human relationship.',
        fr: 'Racontez-nous votre vision. Nous vous mettons en relation avec un designer réel — pas un algorithme. Matériaux, moodboards, sourcing, relation humaine.',
        de: 'Erzählen Sie uns Ihre Vision. Wir vermitteln Ihnen einen echten Designer — keinen Algorithmus. Materialien, Moodboards, Sourcing, menschliche Beziehung.',
        es: 'Cuéntanos tu visión. Te conectamos con un diseñador real — no con un algoritmo. Materiales, moodboards, sourcing, relación humana.',
      },
      cta: {
        it: 'Inizia il tuo progetto',
        en: 'Begin your project',
        fr: 'Commencer votre projet',
        de: 'Projekt beginnen',
        es: 'Comienza tu proyecto',
      },
      href: '/onboarding/private',
      image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1600&q=80',
    },
    pro: {
      kicker: {
        it: 'Per i professionisti',
        en: 'For professionals',
        fr: 'Pour les professionnels',
        de: 'Für Fachleute',
        es: 'Para profesionales',
      },
      title: {
        it: 'Lo studio operativo\u00a0per chi disegna case.',
        en: 'The operating studio\u00a0for those who shape homes.',
        fr: 'Le studio opérationnel\u00a0pour ceux qui conçoivent.',
        de: 'Das Studio-Betriebssystem\u00a0für Gestaltende.',
        es: 'El estudio operativo\u00a0para quienes diseñan.',
      },
      body: {
        it: 'Architetti, interior designer, showroom: un workspace editoriale per moodboard, sourcing, proposte e relazione con il cliente. Tutto in un linguaggio comune.',
        en: 'Architects, interior designers, showrooms: an editorial workspace for moodboards, sourcing, proposals and client relationship. One shared language.',
        fr: 'Architectes, designers d\u2019intérieur, showrooms : un espace éditorial pour moodboards, sourcing, propositions et relation client. Un langage commun.',
        de: 'Architekten, Innendesigner, Showrooms: ein redaktioneller Arbeitsbereich für Moodboards, Sourcing, Angebote und Kundenbeziehung. Eine gemeinsame Sprache.',
        es: 'Arquitectos, interioristas, showrooms: un espacio editorial para moodboards, sourcing, propuestas y relación con el cliente. Un lenguaje común.',
      },
      cta: {
        it: 'Accedi al Blueprint Workspace',
        en: 'Access Blueprint Workspace',
        fr: 'Accéder au Blueprint Workspace',
        de: 'Blueprint Workspace betreten',
        es: 'Acceder al Blueprint Workspace',
      },
      href: '/onboarding/pro',
      image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80',
    },
  },

  selectedProjects: {
    eyebrow: {
      it: 'Selected projects',
      en: 'Selected projects',
      fr: 'Projets sélectionnés',
      de: 'Ausgewählte Projekte',
      es: 'Proyectos seleccionados',
    },
    title: {
      it: 'Storie di spazi.\nFirmate da designer reali.',
      en: 'Stories of spaces.\nSigned by real designers.',
      fr: 'Histoires d\u2019espaces.\nSignées par des designers réels.',
      de: 'Geschichten von Räumen.\nVon echten Designern.',
      es: 'Historias de espacios.\nFirmadas por diseñadores reales.',
    },
    cta: {
      it: 'Esplora tutti i progetti',
      en: 'Explore all projects',
      fr: 'Explorer tous les projets',
      de: 'Alle Projekte ansehen',
      es: 'Explorar todos los proyectos',
    },
    href: '/projects',
  },

  editorialValues: {
    eyebrow: {
      it: 'Cosa siamo',
      en: 'What we are',
      fr: 'Ce que nous sommes',
      de: 'Wer wir sind',
      es: 'Lo que somos',
    },
    title: {
      it: 'Non un marketplace.\nUn ecosistema relazionale.',
      en: 'Not a marketplace.\nA relational ecosystem.',
      fr: 'Pas une marketplace.\nUn écosystème relationnel.',
      de: 'Kein Marktplatz.\nEin Beziehungs-Ökosystem.',
      es: 'No un marketplace.\nUn ecosistema relacional.',
    },
    items: [
      {
        id: 'materials',
        kicker: {
          it: '01\u00a0— Materiali',
          en: '01\u00a0— Materials',
          fr: '01\u00a0— Matériaux',
          de: '01\u00a0— Materialien',
          es: '01\u00a0— Materiales',
        },
        title: {
          it: 'Provenienza reale.',
          en: 'Real provenance.',
          fr: 'Provenance réelle.',
          de: 'Echte Herkunft.',
          es: 'Procedencia real.',
        },
        body: {
          it: 'Marmi, legni, tessuti, ceramiche. Selezionati con showroom e brand reali — non resi rendering.',
          en: 'Marble, wood, fabrics, ceramics. Curated with real showrooms and brands — not renderings.',
          fr: 'Marbres, bois, tissus, céramiques. Sélectionnés avec de vrais showrooms et marques.',
          de: 'Marmor, Holz, Textilien, Keramik. Mit echten Showrooms und Marken kuratiert.',
          es: 'Mármoles, maderas, tejidos, cerámicas. Seleccionados con showrooms y marcas reales.',
        },
      },
      {
        id: 'relationships',
        kicker: {
          it: '02\u00a0— Relazioni',
          en: '02\u00a0— Relationships',
          fr: '02\u00a0— Relations',
          de: '02\u00a0— Beziehungen',
          es: '02\u00a0— Relaciones',
        },
        title: {
          it: 'Persone, non profili.',
          en: 'People, not profiles.',
          fr: 'Des personnes, pas des profils.',
          de: 'Menschen, keine Profile.',
          es: 'Personas, no perfiles.',
        },
        body: {
          it: 'Ogni progetto è seguito da una persona reale: il tuo designer, il tuo showroom di riferimento.',
          en: 'Every project is followed by a real human: your designer, your reference showroom.',
          fr: 'Chaque projet est suivi par une personne réelle : votre designer, votre showroom.',
          de: 'Jedes Projekt wird von einer echten Person betreut: Ihrem Designer, Ihrem Showroom.',
          es: 'Cada proyecto lo sigue una persona real: tu diseñador, tu showroom de referencia.',
        },
      },
      {
        id: 'sourcing',
        kicker: {
          it: '03\u00a0— Sourcing',
          en: '03\u00a0— Sourcing',
          fr: '03\u00a0— Sourcing',
          de: '03\u00a0— Sourcing',
          es: '03\u00a0— Sourcing',
        },
        title: {
          it: 'Tracciato, non casuale.',
          en: 'Traced, not random.',
          fr: 'Tracé, pas aléatoire.',
          de: 'Nachverfolgt, nicht zufällig.',
          es: 'Trazado, no casual.',
        },
        body: {
          it: 'Dal moodboard alla fornitura: ogni pezzo è collegato al suo brand, alla sua origine, al suo prezzo.',
          en: 'From moodboard to delivery: every piece is linked to its brand, its origin, its price.',
          fr: 'Du moodboard à la livraison : chaque pièce est liée à sa marque, son origine, son prix.',
          de: 'Vom Moodboard zur Lieferung: jedes Stück mit Marke, Herkunft und Preis verknüpft.',
          es: 'Del moodboard a la entrega: cada pieza vinculada a su marca, origen y precio.',
        },
      },
      {
        id: 'global',
        kicker: {
          it: '04\u00a0— Globale',
          en: '04\u00a0— Global',
          fr: '04\u00a0— Global',
          de: '04\u00a0— Global',
          es: '04\u00a0— Global',
        },
        title: {
          it: 'Collaborazioni senza confini.',
          en: 'Collaborations without borders.',
          fr: 'Collaborations sans frontières.',
          de: 'Kollaborationen ohne Grenzen.',
          es: 'Colaboraciones sin fronteras.',
        },
        body: {
          it: 'Studi, showroom e brand di Milano, Parigi, New York, Dubai. Un solo linguaggio editoriale.',
          en: 'Studios, showrooms and brands across Milan, Paris, New York, Dubai. One editorial language.',
          fr: 'Studios, showrooms et marques entre Milan, Paris, New York, Dubaï. Un seul langage.',
          de: 'Studios, Showrooms und Marken in Mailand, Paris, New York, Dubai. Eine Sprache.',
          es: 'Estudios, showrooms y marcas entre Milán, París, Nueva York, Dubái. Un solo lenguaje.',
        },
      },
    ],
  },

  finalCta: {
    eyebrow: {
      it: 'Inizia',
      en: 'Begin',
      fr: 'Commencer',
      de: 'Beginnen',
      es: 'Comenzar',
    },
    title: {
      it: 'Il tuo prossimo spazio\ninizia da una conversazione.',
      en: 'Your next space\nstarts with a conversation.',
      fr: 'Votre prochain espace\ncommence par une conversation.',
      de: 'Ihr nächster Raum\nbeginnt mit einem Gespräch.',
      es: 'Tu próximo espacio\nempieza con una conversación.',
    },
    primary: {
      label: {
        it: 'Inizia il tuo progetto',
        en: 'Begin your project',
        fr: 'Commencer votre projet',
        de: 'Projekt beginnen',
        es: 'Comienza tu proyecto',
      },
      href: '/onboarding/private',
    },
    secondary: {
      label: {
        it: 'Accedi al Blueprint Workspace',
        en: 'Access Blueprint Workspace',
        fr: 'Accéder au Blueprint Workspace',
        de: 'Blueprint Workspace betreten',
        es: 'Acceder al Blueprint Workspace',
      },
      href: '/auth/login',
    },
  },
};
