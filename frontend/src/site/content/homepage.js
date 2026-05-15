// MOOD for DESIGN™ — Corporate Platform Homepage Content
// Positioning: Design Workflow Operating System for interior design studios + showrooms.
// NOT: portfolio builder, moodboard tool, inspiration platform, social network.
// Voice: cinematic outside / rigorous inside. Premium SaaS. Teal accent. Editorial tone.
// EVERY string is locale-keyed { it, en, fr, de, es } — ZERO hardcoded.

export const homepageContent = {
  meta: {
    title: {
      it: 'MOOD for DESIGN™ — Il workflow OS per studi di interior design',
      en: 'MOOD for DESIGN™ — The workflow OS for interior design studios',
      fr: 'MOOD for DESIGN™ — Le workflow OS pour les studios d’interior design',
      de: 'MOOD for DESIGN™ — Das Workflow-OS für Interior-Design-Studios',
      es: 'MOOD for DESIGN™ — El workflow OS para estudios de interior design',
    },
  },

  hero: {
    backgroundImage: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=2400&q=85',
    headline: {
      it: 'DAL LEAD AL PROGETTO.\nALLA CONSEGNA.',
      en: 'FROM LEAD TO PROJECT.\nTO DELIVERY.',
      fr: 'DU PROSPECT AU PROJET.\nÀ LA LIVRAISON.',
      de: 'VOM LEAD ZUM PROJEKT.\nZUR ÜBERGABE.',
      es: 'DEL LEAD AL PROYECTO.\nA LA ENTREGA.',
    },
    sub: {
      it: 'MOOD for DESIGN™ è il workflow operativo per studi di interior design e showroom.\nGestisci ogni cliente, ogni moodboard, ogni approvazione e ogni progetto\nin un unico workspace cinematografico.',
      en: 'MOOD for DESIGN™ is the workflow operating system for interior design studios and showrooms.\nManage every client, every moodboard, every approval and every project\nin one cinematic workspace.',
      fr: 'MOOD for DESIGN™ est le système d’exploitation workflow pour studios d’interior design et showrooms.\nGérez chaque client, chaque moodboard, chaque approbation et chaque projet\ndans un seul workspace cinématographique.',
      de: 'MOOD for DESIGN™ ist das Workflow-Betriebssystem für Interior-Design-Studios und Showrooms.\nVerwalten Sie jeden Kunden, jedes Moodboard, jede Freigabe und jedes Projekt\nin einem einzigen cinematischen Workspace.',
      es: 'MOOD for DESIGN™ es el sistema operativo de workflow para estudios de interior design y showrooms.\nGestiona cada cliente, cada moodboard, cada aprobación y cada proyecto\nen un único workspace cinematográfico.',
    },
    overline: {
      it: 'IL WORKFLOW OS PER L’INTERIOR DESIGN',
      en: 'THE WORKFLOW OS FOR INTERIOR DESIGN',
      fr: 'LE WORKFLOW OS POUR L’INTERIOR DESIGN',
      de: 'DAS WORKFLOW-OS FÜR INTERIOR DESIGN',
      es: 'EL WORKFLOW OS PARA EL INTERIOR DESIGN',
    },
    overlineItalic: {
      it: 'ogni cliente, ogni revisione, ogni approvazione — in un solo flusso.',
      en: 'every client, every revision, every approval — in one workflow.',
      fr: 'chaque client, chaque révision, chaque approbation — dans un seul flux.',
      de: 'jeder Kunde, jede Revision, jede Freigabe — in einem Workflow.',
      es: 'cada cliente, cada revisión, cada aprobación — en un solo flujo.',
    },
  },

  // Two B2B segments — both lead to the SaaS conversion funnel.
  // NOT private client vs designer. NOT showroom vs end-user.
  // STUDIOS = interior designers, architects, freelancers.
  // SHOWROOMS = furniture retailers, contract dealers, agencies.
  dualPath: {
    private: {
      kicker: {
        it: 'PER GLI STUDI',
        en: 'FOR STUDIOS',
        fr: 'POUR LES STUDIOS',
        de: 'FÜR STUDIOS',
        es: 'PARA ESTUDIOS',
      },
      title: {
        it: 'Da progettista a operatore',
        en: 'From designer to operator',
        fr: 'Du designer à l’opérateur',
        de: 'Vom Designer zum Operator',
        es: 'Del diseñador al operador',
      },
      body: {
        it: 'Centralizza brief, moodboard, revisioni e approvazioni.\nGuida ogni cliente dalla prima richiesta\nfino alla consegna finale — senza WhatsApp e PDF sparsi.',
        en: 'Centralise briefs, moodboards, revisions and approvals.\nGuide every client from first inquiry\nto final delivery — no more scattered WhatsApp and PDFs.',
        fr: 'Centralisez briefs, moodboards, révisions et approbations.\nGuidez chaque client du premier contact\nà la livraison finale — sans WhatsApp dispersés et PDF.',
        de: 'Bündeln Sie Briefings, Moodboards, Revisionen und Freigaben.\nFühren Sie jeden Kunden von der ersten Anfrage\nbis zur finalen Übergabe — kein verteiltes WhatsApp und PDF mehr.',
        es: 'Centraliza briefs, moodboards, revisiones y aprobaciones.\nGuía a cada cliente desde la primera consulta\nhasta la entrega final — sin WhatsApp dispersos ni PDFs.',
      },
      cta: {
        it: 'PRENOTA UNA DEMO',
        en: 'BOOK A DEMO',
        fr: 'RÉSERVER UNE DÉMO',
        de: 'DEMO BUCHEN',
        es: 'RESERVAR UNA DEMO',
      },
      href: '/professionals',
      image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1400&q=85',
      variant: 'light',
    },
    pro: {
      kicker: {
        it: 'PER GLI SHOWROOM',
        en: 'FOR SHOWROOMS',
        fr: 'POUR LES SHOWROOMS',
        de: 'FÜR SHOWROOMS',
        es: 'PARA SHOWROOMS',
      },
      title: {
        it: 'Da vetrina a piattaforma',
        en: 'From storefront to platform',
        fr: 'De la vitrine à la plateforme',
        de: 'Vom Schaufenster zur Plattform',
        es: 'Del escaparate a la plataforma',
      },
      body: {
        it: 'Trasforma il tuo showroom in un workspace digitale.\nTraccia ogni richiesta, ogni progetto e ogni cliente —\ncon il rigore di un sistema operativo enterprise.',
        en: 'Turn your showroom into a digital workspace.\nTrack every inquiry, every project and every client —\nwith the rigour of an enterprise operating system.',
        fr: 'Transformez votre showroom en workspace numérique.\nSuivez chaque demande, chaque projet et chaque client —\navec la rigueur d’un système d’exploitation enterprise.',
        de: 'Verwandeln Sie Ihren Showroom in einen digitalen Workspace.\nVerfolgen Sie jede Anfrage, jedes Projekt und jeden Kunden —\nmit der Strenge eines Enterprise-Betriebssystems.',
        es: 'Convierte tu showroom en un workspace digital.\nRastrea cada consulta, cada proyecto y cada cliente —\ncon el rigor de un sistema operativo enterprise.',
      },
      cta: {
        it: 'ESPLORA IL WORKFLOW',
        en: 'EXPLORE THE WORKFLOW',
        fr: 'EXPLORER LE WORKFLOW',
        de: 'WORKFLOW ENTDECKEN',
        es: 'EXPLORA EL WORKFLOW',
      },
      href: '/professionals',
      image: 'https://images.unsplash.com/photo-1615875221691-c63d6a4a83a7?auto=format&fit=crop&w=1400&q=85',
      variant: 'dark',
    },
  },

  // 5 core modules — picked to fit the existing icon set (gem · users · sparkles · globe · shield-check).
  // These are the visible pillars; the full 10-module roadmap lives on /platform.
  valueProps: {
    title: {
      it: 'IL TUO WORKFLOW. UN SOLO POSTO.',
      en: 'YOUR WORKFLOW. ONE PLACE.',
      fr: 'VOTRE WORKFLOW. UN SEUL ENDROIT.',
      de: 'IHR WORKFLOW. EIN ORT.',
      es: 'TU WORKFLOW. UN SOLO LUGAR.',
    },
    items: [
      {
        id: 'lead_intake',
        icon: 'gem',
        title: {
          it: 'LEAD INTAKE',
          en: 'LEAD INTAKE',
          fr: 'LEAD INTAKE',
          de: 'LEAD-INTAKE',
          es: 'LEAD INTAKE',
        },
        body: {
          it: 'Cattura e qualifica le nuove richieste\ncon form multilingua eleganti.',
          en: 'Capture and qualify new project requests\nwith elegant multilingual forms.',
          fr: 'Captez et qualifiez les nouvelles demandes\navec des formulaires multilingues élégants.',
          de: 'Erfassen und qualifizieren Sie neue Anfragen\nmit eleganten mehrsprachigen Formularen.',
          es: 'Capta y califica nuevas solicitudes\ncon formularios multilingües elegantes.',
        },
      },
      {
        id: 'client_onboarding',
        icon: 'users',
        title: {
          it: 'CLIENT ONBOARDING',
          en: 'CLIENT ONBOARDING',
          fr: 'CLIENT ONBOARDING',
          de: 'CLIENT-ONBOARDING',
          es: 'CLIENT ONBOARDING',
        },
        body: {
          it: 'Raccogli brief, preferenze e budget\nin un flusso strutturato e professionale.',
          en: 'Collect briefs, preferences and budgets\nin a structured, professional flow.',
          fr: 'Collectez briefs, préférences et budgets\ndans un parcours structuré et professionnel.',
          de: 'Erfassen Sie Briefings, Präferenzen und Budgets\nin einem strukturierten, professionellen Ablauf.',
          es: 'Recoge briefs, preferencias y presupuestos\nen un flujo estructurado y profesional.',
        },
      },
      {
        id: 'moodboards_projects',
        icon: 'sparkles',
        title: {
          it: 'MOODBOARD & PROGETTI',
          en: 'MOODBOARDS & PROJECTS',
          fr: 'MOODBOARDS & PROJETS',
          de: 'MOODBOARDS & PROJEKTE',
          es: 'MOODBOARDS Y PROYECTOS',
        },
        body: {
          it: 'Presenta concept cinematografici\nche aiutano il cliente a capire e approvare.',
          en: 'Present cinematic concepts that help\nclients understand and approve a direction.',
          fr: 'Présentez des concepts cinématographiques\nqui aident le client à comprendre et approuver.',
          de: 'Präsentieren Sie cinematische Konzepte,\ndie Kunden verstehen und freigeben können.',
          es: 'Presenta conceptos cinematográficos\nque ayudan al cliente a comprender y aprobar.',
        },
      },
      {
        id: 'draft_vs_live',
        icon: 'shield-check',
        title: {
          it: 'DRAFT vs LIVE',
          en: 'DRAFT vs LIVE',
          fr: 'DRAFT vs LIVE',
          de: 'DRAFT vs LIVE',
          es: 'DRAFT vs LIVE',
        },
        body: {
          it: 'Controlla cosa è in lavorazione e cosa è\nufficialmente pubblicato — versioni, diff, revert.',
          en: 'Control what is in progress and what is\nofficially live — versions, diff, revert.',
          fr: 'Contrôlez ce qui est en cours et ce qui est\nofficiellement publié — versions, diff, revert.',
          de: 'Steuern Sie, was in Arbeit und was\noffiziell live ist — Versionen, Diff, Revert.',
          es: 'Controla qué está en curso y qué está\noficialmente publicado — versiones, diff, revert.',
        },
      },
      {
        id: 'client_portal',
        icon: 'globe',
        title: {
          it: 'CLIENT PORTAL',
          en: 'CLIENT PORTAL',
          fr: 'CLIENT PORTAL',
          de: 'CLIENT-PORTAL',
          es: 'CLIENT PORTAL',
        },
        body: {
          it: 'Un unico spazio polished dove il cliente\nrivede, approva e segue il progetto.',
          en: 'One polished place where clients\nreview, approve and follow the project.',
          fr: 'Un seul espace poli où le client\nrévise, approuve et suit le projet.',
          de: 'Ein eleganter Ort, an dem Kunden\nprüfen, freigeben und das Projekt verfolgen.',
          es: 'Un único espacio elegante donde el cliente\nrevisa, aprueba y sigue el proyecto.',
        },
      },
    ],
  },

  // Real interior projects — visual proof that MOOD powers premium studios.
  // Repositioned title: studios in motion (workflow), not "projects that inspire".
  projectsInspire: {
    title: {
      it: 'STUDI IN MOVIMENTO',
      en: 'STUDIOS IN MOTION',
      fr: 'STUDIOS EN MOUVEMENT',
      de: 'STUDIOS IN BEWEGUNG',
      es: 'ESTUDIOS EN MOVIMIENTO',
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

  // Repositioned: workflow insights, not "inspiration & news".
  // The newsletter feeds the Journal which doubles as SEO + lead gen.
  newsletter: {
    title: {
      it: 'WORKFLOW INSIGHTS',
      en: 'WORKFLOW INSIGHTS',
      fr: 'WORKFLOW INSIGHTS',
      de: 'WORKFLOW INSIGHTS',
      es: 'WORKFLOW INSIGHTS',
    },
    body: {
      it: 'Ricevi pratiche, casi studio e novità di prodotto\npensate per studi di interior design e showroom.\nNiente fluff. Solo workflow.',
      en: 'Get practices, case studies and product updates\ncrafted for interior design studios and showrooms.\nNo fluff. Just workflow.',
      fr: 'Recevez pratiques, études de cas et nouveautés produit\npensées pour studios d’interior design et showrooms.\nPas de bla-bla. Juste du workflow.',
      de: 'Erhalten Sie Praktiken, Fallstudien und Produkt-Updates\nfür Interior-Design-Studios und Showrooms.\nKein Geschwätz. Nur Workflow.',
      es: 'Recibe prácticas, casos de estudio y novedades de producto\npensados para estudios de interior design y showrooms.\nSin fluff. Solo workflow.',
    },
    placeholder: {
      it: 'La tua email professionale',
      en: 'Your work email',
      fr: 'Votre e-mail professionnel',
      de: 'Ihre geschäftliche E-Mail',
      es: 'Tu email profesional',
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
