// MOOD for DESIGN™ — DEMO STORE Homepage Content (Porcia, PN)
// This is the DEMO landing page of a fictional Italian furniture/design store
// using MOOD for DESIGN™ platform. Structure mirrors future DB tables
// `cms_pages` { tenant_id, page_key='home', sections [] } and
// `cms_sections` { section_key, content jsonb (locale-keyed) }.
// EVERY string is locale-keyed { it, en, fr, de, es } — ZERO hardcoded.

export const homepageContent = {
  meta: {
    title: {
      it: 'MOOD for DESIGN™ — Arredare spazi. Costruire relazioni.',
      en: 'MOOD for DESIGN™ — Shaping spaces. Building relationships.',
      fr: 'MOOD for DESIGN™ — Aménager des espaces. Bâtir des relations.',
      de: 'MOOD for DESIGN™ — Räume gestalten. Beziehungen aufbauen.',
      es: 'MOOD for DESIGN™ — Diseñar espacios. Construir relaciones.',
    },
  },

  hero: {
    backgroundImage: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=2400&q=85',
    headline: {
      it: 'ARREDARE SPAZI.\nCOSTRUIRE RELAZIONI.',
      en: 'SHAPING SPACES.\nBUILDING RELATIONSHIPS.',
      fr: 'AMÉNAGER DES ESPACES.\nBÂTIR DES RELATIONS.',
      de: 'RÄUME GESTALTEN.\nBEZIEHUNGEN AUFBAUEN.',
      es: 'DISEÑAR ESPACIOS.\nCONSTRUIR RELACIONES.',
    },
    sub: {
      it: 'MOOD for DESIGN™ connette persone e progetti\ncon il saper fare italiano e una rete selezionata\ndi designer, architetti e artigiani.',
      en: 'MOOD for DESIGN™ connects people and projects\nwith Italian craftsmanship and a curated network\nof designers, architects and artisans.',
      fr: 'MOOD for DESIGN™ relie personnes et projets\nau savoir-faire italien et à un réseau choisi\nde designers, architectes et artisans.',
      de: 'MOOD for DESIGN™ verbindet Menschen und Projekte\nmit italienischer Handwerkskunst und einem kuratierten Netzwerk\naus Designern, Architekten und Handwerkern.',
      es: 'MOOD for DESIGN™ conecta personas y proyectos\ncon el saber hacer italiano y una red seleccionada\nde diseñadores, arquitectos y artesanos.',
    },
    overline: {
      it: 'DUE PERCORSI. UN UNICO OBIETTIVO:',
      en: 'TWO PATHS. ONE GOAL:',
      fr: 'DEUX PARCOURS. UN SEUL BUT :',
      de: 'ZWEI WEGE. EIN ZIEL:',
      es: 'DOS CAMINOS. UN OBJETIVO:',
    },
    overlineItalic: {
      it: 'trasformare la tua visione in realtà.',
      en: 'turning your vision into reality.',
      fr: 'transformer votre vision en réalité.',
      de: 'Ihre Vision Wirklichkeit werden lassen.',
      es: 'transformar tu visión en realidad.',
    },
  },

  dualPath: {
    private: {
      kicker: {
        it: 'SEI UN PRIVATO?',
        en: 'PRIVATE CLIENT?',
        fr: 'PARTICULIER ?',
        de: 'PRIVATKUNDE?',
        es: '¿CLIENTE PRIVADO?',
      },
      title: {
        it: 'Inizia il tuo progetto',
        en: 'Begin your project',
        fr: 'Commencez votre projet',
        de: 'Beginnen Sie Ihr Projekt',
        es: 'Comienza tu proyecto',
      },
      body: {
        it: 'Raccontaci la tua idea, i tuoi desideri e le tue esigenze.\nTi guideremo passo dopo passo nella creazione\ndel tuo spazio ideale.',
        en: 'Tell us your idea, your wishes and your needs.\nWe will guide you step by step\nin creating your ideal space.',
        fr: 'Racontez-nous votre idée, vos envies et vos besoins.\nNous vous guidons pas à pas\ndans la création de votre espace idéal.',
        de: 'Erzählen Sie uns Ihre Idee, Ihre Wünsche und Bedürfnisse.\nWir begleiten Sie Schritt für Schritt\nzu Ihrem idealen Raum.',
        es: 'Cuéntanos tu idea, tus deseos y tus necesidades.\nTe guiamos paso a paso\nen la creación de tu espacio ideal.',
      },
      cta: {
        it: 'INIZIA IL TUO PROGETTO',
        en: 'BEGIN YOUR PROJECT',
        fr: 'COMMENCER VOTRE PROJET',
        de: 'PROJEKT BEGINNEN',
        es: 'COMIENZA TU PROYECTO',
      },
      href: '/onboarding/private',
      image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1400&q=85',
      variant: 'light',
    },
    pro: {
      kicker: {
        it: 'SEI UN PROFESSIONISTA?',
        en: 'A PROFESSIONAL?',
        fr: 'PROFESSIONNEL ?',
        de: 'FACHPERSON?',
        es: '¿PROFESIONAL?',
      },
      title: {
        it: 'Collabora con noi',
        en: 'Collaborate with us',
        fr: 'Collaborez avec nous',
        de: 'Arbeiten Sie mit uns',
        es: 'Colabora con nosotros',
      },
      body: {
        it: 'Accedi a un ecosistema di prodotti, competenze\ne servizi dedicati ai professionisti dell\u2019interior\ndesign e dell\u2019architettura.',
        en: 'Access an ecosystem of products, expertise\nand services dedicated to professionals\nof interior design and architecture.',
        fr: 'Accédez à un écosystème de produits, compétences\net services dédiés aux professionnels\nde l\u2019architecture et du design intérieur.',
        de: 'Zugang zu einem Ökosystem aus Produkten, Expertise\nund Services für Fachleute der Innenarchitektur\nund Architektur.',
        es: 'Accede a un ecosistema de productos, competencias\ny servicios dedicados a profesionales\ndel diseño de interiores y la arquitectura.',
      },
      cta: {
        it: 'ACCESSO PROFESSIONISTI',
        en: 'PROFESSIONAL ACCESS',
        fr: 'ACCÈS PROFESSIONNELS',
        de: 'PROFI-ZUGANG',
        es: 'ACCESO PROFESIONAL',
      },
      href: '/onboarding/pro',
      image: 'https://images.unsplash.com/photo-1615875221691-c63d6a4a83a7?auto=format&fit=crop&w=1400&q=85',
      variant: 'dark',
    },
  },

  valueProps: {
    title: {
      it: 'PERCHÉ SCEGLIERE MOOD for DESIGN\u2122',
      en: 'WHY CHOOSE MOOD for DESIGN\u2122',
      fr: 'POURQUOI CHOISIR MOOD for DESIGN\u2122',
      de: 'WARUM MOOD for DESIGN\u2122',
      es: 'POR QUÉ ELEGIR MOOD for DESIGN\u2122',
    },
    items: [
      {
        id: 'italy',
        icon: 'gem',
        title: {
          it: 'ECCELLENZA ITALIANA',
          en: 'ITALIAN EXCELLENCE',
          fr: 'EXCELLENCE ITALIENNE',
          de: 'ITALIENISCHE EXZELLENZ',
          es: 'EXCELENCIA ITALIANA',
        },
        body: {
          it: 'Selezioniamo i migliori brand\ne artigiani del Made in Italy.',
          en: 'We curate the finest brands\nand artisans of Made in Italy.',
          fr: 'Nous sélectionnons les meilleures marques\net artisans du Made in Italy.',
          de: 'Wir wählen die besten Marken\nund Handwerker des Made in Italy.',
          es: 'Seleccionamos las mejores marcas\ny artesanos del Made in Italy.',
        },
      },
      {
        id: 'human',
        icon: 'users',
        title: {
          it: 'RELAZIONE UMANA',
          en: 'HUMAN RELATIONSHIP',
          fr: 'RELATION HUMAINE',
          de: 'MENSCHLICHE BEZIEHUNG',
          es: 'RELACIÓN HUMANA',
        },
        body: {
          it: 'Ogni progetto è seguito\nda un professionista dedicato.',
          en: 'Every project is followed\nby a dedicated professional.',
          fr: 'Chaque projet est suivi\npar un professionnel dédié.',
          de: 'Jedes Projekt wird von\neinem dedizierten Profi betreut.',
          es: 'Cada proyecto lo sigue\nun profesional dedicado.',
        },
      },
      {
        id: 'tailored',
        icon: 'sparkles',
        title: {
          it: 'PROGETTI SU MISURA',
          en: 'TAILORED PROJECTS',
          fr: 'PROJETS SUR MESURE',
          de: 'MASSGESCHNEIDERTE PROJEKTE',
          es: 'PROYECTOS A MEDIDA',
        },
        body: {
          it: 'Soluzioni personalizzate per spazi\nresidenziali e contract.',
          en: 'Bespoke solutions for residential\nand contract spaces.',
          fr: 'Solutions sur mesure pour espaces\nrésidentiels et contract.',
          de: 'Maßgeschneiderte Lösungen für\nWohn- und Contract-Räume.',
          es: 'Soluciones a medida para espacios\nresidenciales y contract.',
        },
      },
      {
        id: 'global',
        icon: 'globe',
        title: {
          it: 'INTERNAZIONALE',
          en: 'INTERNATIONAL',
          fr: 'INTERNATIONAL',
          de: 'INTERNATIONAL',
          es: 'INTERNACIONAL',
        },
        body: {
          it: 'Supportiamo privati e professionisti\nin tutto il mondo.',
          en: 'We support private clients and\nprofessionals worldwide.',
          fr: 'Nous accompagnons particuliers et\nprofessionnels dans le monde entier.',
          de: 'Wir betreuen Privatkunden und\nFachleute weltweit.',
          es: 'Apoyamos a particulares y\nprofesionales en todo el mundo.',
        },
      },
      {
        id: 'quality',
        icon: 'shield-check',
        title: {
          it: 'QUALITÀ GARANTITA',
          en: 'GUARANTEED QUALITY',
          fr: 'QUALITÉ GARANTIE',
          de: 'GARANTIERTE QUALITÄT',
          es: 'CALIDAD GARANTIZADA',
        },
        body: {
          it: 'Materiali, design e servizio\nsenza compromessi.',
          en: 'Materials, design and service\nwithout compromise.',
          fr: 'Matériaux, design et service\nsans compromis.',
          de: 'Materialien, Design und Service\nohne Kompromisse.',
          es: 'Materiales, diseño y servicio\nsin compromisos.',
        },
      },
    ],
  },

  projectsInspire: {
    title: {
      it: 'PROGETTI CHE ISPIRANO',
      en: 'PROJECTS THAT INSPIRE',
      fr: 'PROJETS QUI INSPIRENT',
      de: 'PROJEKTE, DIE INSPIRIEREN',
      es: 'PROYECTOS QUE INSPIRAN',
    },
    items: [
      {
        id: 'residenziale-venezia',
        slug: 'casa-naviglio',
        image: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1600&q=85',
        category: { it: 'RESIDENZIALE', en: 'RESIDENTIAL', fr: 'RÉSIDENTIEL', de: 'WOHNEN', es: 'RESIDENCIAL' },
        location: { it: 'Venezia', en: 'Venice', fr: 'Venise', de: 'Venedig', es: 'Venecia' },
      },
      {
        id: 'resort-como',
        slug: 'villa-cap-ferrat',
        image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1600&q=85',
        category: { it: 'RESORT', en: 'RESORT', fr: 'RESORT', de: 'RESORT', es: 'RESORT' },
        location: { it: 'Lago di Como', en: 'Lake Como', fr: 'Lac de Côme', de: 'Comer See', es: 'Lago de Como' },
      },
      {
        id: 'boutique-firenze',
        slug: 'galerie-saint-honore',
        image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1600&q=85',
        category: { it: 'BOUTIQUE HOTEL', en: 'BOUTIQUE HOTEL', fr: 'BOUTIQUE HÔTEL', de: 'BOUTIQUE HOTEL', es: 'BOUTIQUE HOTEL' },
        location: { it: 'Firenze', en: 'Florence', fr: 'Florence', de: 'Florenz', es: 'Florencia' },
      },
      {
        id: 'villa-valdorcia',
        slug: 'aman-residences-tokyo',
        image: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1600&q=85',
        category: { it: 'VILLA PRIVATA', en: 'PRIVATE VILLA', fr: 'VILLA PRIVÉE', de: 'PRIVATE VILLA', es: 'VILLA PRIVADA' },
        location: { it: 'Val d\u2019Orcia', en: 'Val d\u2019Orcia', fr: 'Val d\u2019Orcia', de: 'Val d\u2019Orcia', es: 'Val d\u2019Orcia' },
      },
      {
        id: 'penthouse-milano',
        slug: 'penthouse-tribeca',
        image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1600&q=85',
        category: { it: 'PENTHOUSE', en: 'PENTHOUSE', fr: 'PENTHOUSE', de: 'PENTHOUSE', es: 'ÁTICO' },
        location: { it: 'Milano', en: 'Milan', fr: 'Milan', de: 'Mailand', es: 'Milán' },
      },
    ],
  },

  newsletter: {
    title: {
      it: 'ISPIRAZIONE E NOVITÀ',
      en: 'INSPIRATION & NEWS',
      fr: 'INSPIRATION & ACTUALITÉS',
      de: 'INSPIRATION & NEUES',
      es: 'INSPIRACIÓN Y NOVEDADES',
    },
    body: {
      it: 'Iscriviti alla nostra newsletter\nper ricevere contenuti esclusivi\ne aggiornamenti dal mondo\ndel design.',
      en: 'Subscribe to our newsletter\nto receive exclusive content\nand updates from the world\nof design.',
      fr: 'Abonnez-vous à notre newsletter\npour des contenus exclusifs\net des actualités du monde\ndu design.',
      de: 'Abonnieren Sie unseren Newsletter\nfür exklusive Inhalte und\nNeuigkeiten aus der Designwelt.',
      es: 'Suscríbete a nuestra newsletter\npara recibir contenidos exclusivos\ny novedades del mundo\ndel diseño.',
    },
    placeholder: {
      it: 'La tua email',
      en: 'Your email',
      fr: 'Votre email',
      de: 'Ihre E-Mail',
      es: 'Tu email',
    },
    submit: {
      it: 'ISCRIVITI',
      en: 'SUBSCRIBE',
      fr: 'S\u2019INSCRIRE',
      de: 'ABONNIEREN',
      es: 'SUSCRIBIRSE',
    },
    decorImage: 'https://images.unsplash.com/photo-1567016376408-0226e4d0c1ea?auto=format&fit=crop&w=1200&q=85',
  },
};
