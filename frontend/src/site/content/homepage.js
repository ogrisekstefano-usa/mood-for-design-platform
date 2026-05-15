// EXE INTERIOR — Cinematic Demo Storefront Content
// Demo of an Italian luxury interior design studio running on MOOD for DESIGN™.
// Strategy: the prospect visiting this homepage feels they ALREADY OWN a licence —
// the storefront is theirs, ready to be edited via the Studio.
// EVERY string is locale-keyed { it, en, fr, de, es, ae } — ZERO hardcoded.

const T = (it, en, fr, de, es, ae) => ({ it, en, fr, de, es, ae });

export const homepageContent = {
  meta: {
    title: T(
      'EXE Interior — Italian Design. Tailored for Visionaries.',
      'EXE Interior — Italian Design. Tailored for Visionaries.',
      'EXE Interior — Design italien sur mesure pour visionnaires.',
      'EXE Interior — Italienisches Design für Visionäre.',
      'EXE Interior — Diseño italiano para visionarios.',
      'إكزي إنتيريور — تصميم إيطالي للرؤيويين.',
    ),
  },

  // ── HERO ─────────────────────────────────────────────────────────────
  hero: {
    backgroundImage: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=2400&q=85',
    eyebrow: T(
      'ARREDI SU MISURA. PROGETTI SENZA TEMPO.',
      'BESPOKE INTERIORS. TIMELESS PROJECTS.',
      'INTÉRIEURS SUR MESURE. PROJETS INTEMPORELS.',
      'MASSGESCHNEIDERTE INTERIEURS. ZEITLOSE PROJEKTE.',
      'INTERIORES A MEDIDA. PROYECTOS ATEMPORALES.',
      'تصاميم داخلية مخصصة. مشاريع خالدة.',
    ),
    headline: T(
      'Italian Design.\nTailored for Visionaries.',
      'Italian Design.\nTailored for Visionaries.',
      'Italian Design.\nTailored for Visionaries.',
      'Italian Design.\nTailored for Visionaries.',
      'Italian Design.\nTailored for Visionaries.',
      'تصميم إيطالي.\nصُمِّم للرؤيويين.',
    ),
    sub: T(
      'Progettiamo ambienti unici e collezioni su misura\nper Clienti privati e Professionisti A&D in tutto il mondo.',
      'We design one-of-a-kind spaces and bespoke collections\nfor private clients and A&D professionals worldwide.',
      'Nous concevons des espaces uniques et des collections sur mesure\npour clients privés et professionnels A&D dans le monde entier.',
      'Wir gestalten einzigartige Räume und maßgeschneiderte Kollektionen\nfür Privatkunden und A&D-Fachleute weltweit.',
      'Diseñamos espacios únicos y colecciones a medida\npara clientes privados y profesionales A&D en todo el mundo.',
      'نصمم مساحات فريدة ومجموعات مخصصة لعملاء القطاع الخاص والمحترفين في جميع أنحاء العالم.',
    ),
    ctaPrimary: {
      label: T('RICHIEDI IL TUO PROGETTO', 'REQUEST YOUR PROJECT', 'DEMANDER VOTRE PROJET', 'PROJEKT ANFRAGEN', 'SOLICITA TU PROYECTO', 'اطلب مشروعك'),
      href: '/start-project',
    },
    ctaSecondary: {
      label: T('SCOPRI I SERVIZI', 'DISCOVER OUR SERVICES', 'DÉCOUVRIR LES SERVICES', 'LEISTUNGEN ENTDECKEN', 'DESCUBRE LOS SERVICIOS', 'اكتشف الخدمات'),
      href: '#services',
    },
    videoLabel: {
      kicker: T('Guarda il video', 'Watch the video', 'Voir la vidéo', 'Video ansehen', 'Ver el vídeo', 'شاهد الفيديو'),
      title:  T('EXE Interior World', 'EXE Interior World', 'EXE Interior World', 'EXE Interior World', 'EXE Interior World', 'عالم EXE'),
      href: '#video',
    },
    scrollLabel: T('SCROLL', 'SCROLL', 'SCROLL', 'SCROLL', 'SCROLL', 'SCROLL'),
  },

  // ── SERVICES (5 cards · light bg) ───────────────────────────────────
  services: {
    kicker: T('COSA POSSIAMO FARE PER TE', 'WHAT WE CAN DO FOR YOU', 'CE QUE NOUS POUVONS FAIRE', 'WAS WIR FÜR SIE TUN', 'LO QUE PODEMOS HACER', 'ما يمكننا تقديمه'),
    title:  T('Soluzioni di design su misura', 'Bespoke design solutions', 'Solutions de design sur mesure', 'Maßgeschneiderte Designlösungen', 'Soluciones de diseño a medida', 'حلول تصميم مخصصة'),
    moreLabel: T('SCOPRI DI PIÙ', 'LEARN MORE', 'EN SAVOIR PLUS', 'MEHR ERFAHREN', 'DESCUBRIR MÁS', 'اعرف المزيد'),
    items: [
      {
        id: 'progettazione', icon: 'pencil-ruler', href: '/services/progettazione',
        title: T('Progettazione\nSu Misura', 'Bespoke\nDesign', 'Conception\nSur Mesure', 'Maßgeschneiderte\nPlanung', 'Diseño\nA Medida', 'تصميم\nمخصص'),
        body:  T('Soluzioni personalizzate per interni residenziali e commerciali.',
                 'Bespoke solutions for residential and commercial interiors.',
                 'Solutions sur mesure pour intérieurs résidentiels et commerciaux.',
                 'Maßgeschneiderte Lösungen für Wohn- und Geschäftsräume.',
                 'Soluciones a medida para interiores residenciales y comerciales.',
                 'حلول مخصصة للداخليات السكنية والتجارية.'),
      },
      {
        id: 'arredi', icon: 'armchair', href: '/services/arredi',
        title: T('Arredi\nMade in Italy', 'Made in Italy\nFurniture', 'Mobilier\nMade in Italy', 'Möbel\nMade in Italy', 'Mobiliario\nMade in Italy', 'أثاث\nصنع في إيطاليا'),
        body:  T('Selezione esclusiva dei migliori brand e manifatture italiane di design.',
                 'Exclusive selection of Italy’s finest design brands and ateliers.',
                 'Sélection exclusive des meilleures marques et manufactures italiennes.',
                 'Exklusive Auswahl der besten italienischen Marken und Manufakturen.',
                 'Selección exclusiva de las mejores marcas y manufacturas italianas.',
                 'مجموعة حصرية من أفضل العلامات والمصانع الإيطالية.'),
      },
      {
        id: 'moodboard', icon: 'layout-grid', href: '/services/moodboard',
        title: T('Moodboard\n& Concept', 'Moodboards\n& Concept', 'Moodboards\n& Concept', 'Moodboards\n& Konzept', 'Moodboards\ny Concepto', 'لوحات إلهام\nوكونسبت'),
        body:  T('Idee, materiali e atmosfere in moodboard dinamiche e interattive.',
                 'Ideas, materials and atmospheres in interactive moodboards.',
                 'Idées, matériaux et atmosphères en moodboards interactifs.',
                 'Ideen, Materialien und Atmosphären in interaktiven Moodboards.',
                 'Ideas, materiales y atmósferas en moodboards interactivos.',
                 'أفكار ومواد وأجواء في لوحات إلهام تفاعلية.'),
      },
      {
        id: 'project_management', icon: 'file-text', href: '/services/project-management',
        title: T('Project\nManagement', 'Project\nManagement', 'Gestion de\nProjet', 'Projekt-\nManagement', 'Gestión de\nProyecto', 'إدارة\nالمشاريع'),
        body:  T('Gestione completa del progetto: dal concept alla realizzazione, senza pensieri.',
                 'End-to-end project management: from concept to delivery, hassle-free.',
                 'Gestion de A à Z : du concept à la livraison, sans souci.',
                 'Vollumfängliches Management: vom Konzept bis zur Übergabe.',
                 'Gestión integral: del concepto a la entrega, sin preocupaciones.',
                 'إدارة شاملة للمشروع: من الفكرة إلى التنفيذ.'),
      },
      {
        id: 'ad_partnership', icon: 'handshake', href: '/services/ad-partnership',
        title: T('A&D\nPartnership', 'A&D\nPartnership', 'Partenariat\nA&D', 'A&D\nPartnerschaft', 'Partnership\nA&D', 'شراكة\nA&D'),
        body:  T('Collaborazioni su misura per Architetti, Designer e Contract.',
                 'Tailored partnerships for architects, designers and contract.',
                 'Partenariats sur mesure pour architectes, designers et contract.',
                 'Maßgeschneiderte Partnerschaften für Architekten und Designer.',
                 'Colaboraciones a medida para arquitectos, diseñadores y contract.',
                 'شراكات مخصصة للمعماريين والمصممين وقطاع المقاولات.'),
      },
    ],
  },

  // ── STATS BAND (dark with gold accents) ──────────────────────────────
  stats: {
    kicker: T('FIDUCIA, ESPERIENZA, ECCELLENZA', 'TRUST · EXPERIENCE · EXCELLENCE', 'CONFIANCE · EXPÉRIENCE · EXCELLENCE', 'VERTRAUEN · ERFAHRUNG · EXZELLENZ', 'CONFIANZA · EXPERIENCIA · EXCELENCIA', 'ثقة · خبرة · تميز'),
    title:  T('Numeri che raccontano il nostro impegno',
              'Numbers that tell our commitment',
              'Les chiffres qui racontent notre engagement',
              'Zahlen, die unser Engagement erzählen',
              'Cifras que cuentan nuestro compromiso',
              'أرقام تروي التزامنا'),
    items: [
      { id: 'projects',  value: '850+', label: T('Progetti completati',     'Projects completed',     'Projets réalisés',           'Abgeschlossene Projekte',     'Proyectos completados',     'مشاريع منجزة') },
      { id: 'countries', value: '45+',  label: T('Paesi serviti',            'Countries served',       'Pays servis',                'Belieferte Länder',           'Países atendidos',          'دول مخدومة') },
      { id: 'brands',    value: '120+', label: T('Brand partner',            'Partner brands',         'Marques partenaires',        'Partnermarken',               'Marcas asociadas',          'علامات شريكة') },
      { id: 'csat',      value: '98%',  label: T('Clienti soddisfatti',      'Satisfied clients',      'Clients satisfaits',         'Zufriedene Kunden',           'Clientes satisfechos',      'عملاء راضون') },
      { id: 'years',     value: '15',   label: T('Anni di esperienza',       'Years of experience',    'Années d’expérience',        'Jahre Erfahrung',             'Años de experiencia',       'سنوات من الخبرة') },
    ],
  },

  // ── FEATURED PROJECTS ───────────────────────────────────────────────
  projectsInspire: {
    kicker: T('PROGETTI IN EVIDENZA', 'FEATURED PROJECTS', 'PROJETS EN VEDETTE', 'AUSGEWÄHLTE PROJEKTE', 'PROYECTOS DESTACADOS', 'مشاريع مميزة'),
    title:  T('Ambienti unici.\nStorie straordinarie.',
              'Unique spaces.\nExtraordinary stories.',
              'Espaces uniques.\nHistoires extraordinaires.',
              'Einzigartige Räume.\nAußergewöhnliche Geschichten.',
              'Espacios únicos.\nHistorias extraordinarias.',
              'فضاءات فريدة.\nقصص استثنائية.'),
    ctaLabel: T('VEDI TUTTI I PROGETTI', 'VIEW ALL PROJECTS', 'VOIR TOUS LES PROJETS', 'ALLE PROJEKTE ANZEIGEN', 'VER TODOS LOS PROYECTOS', 'عرض جميع المشاريع'),
    ctaHref:  '/projects',
    moreLabel: T('SCOPRI DI PIÙ', 'DISCOVER', 'DÉCOUVRIR', 'ENTDECKEN', 'DESCUBRIR', 'اكتشف'),
    items: [
      {
        id: 'villa-contemporanea', slug: 'villa-contemporanea',
        image: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1600&q=85',
        category: T('Villa Contemporanea', 'Contemporary Villa', 'Villa Contemporaine', 'Zeitgenössische Villa', 'Villa Contemporánea', 'فيلا معاصرة'),
        location: T('Lago di Como, Italia', 'Lake Como, Italy', 'Lac de Côme, Italie', 'Comer See, Italien', 'Lago di Como, Italia', 'بحيرة كومو، إيطاليا'),
      },
      {
        id: 'residenza-privata-dubai', slug: 'residenza-privata-dubai',
        image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1600&q=85',
        category: T('Residenza Privata', 'Private Residence', 'Résidence Privée', 'Privatresidenz', 'Residencia Privada', 'إقامة خاصة'),
        location: T('Dubai, UAE', 'Dubai, UAE', 'Dubaï, EAU', 'Dubai, VAE', 'Dubái, EAU', 'دبي، الإمارات'),
      },
      {
        id: 'boutique-hotel-nyc', slug: 'boutique-hotel-nyc',
        image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1600&q=85',
        category: T('Boutique Hotel Project', 'Boutique Hotel Project', 'Boutique Hôtel', 'Boutique-Hotel Projekt', 'Boutique Hotel', 'مشروع فندق بوتيك'),
        location: T('New York, USA', 'New York, USA', 'New York, USA', 'New York, USA', 'Nueva York, EE.UU.', 'نيويورك، الولايات المتحدة'),
      },
    ],
  },

  // ── MAGAZINE GRID ───────────────────────────────────────────────────
  magazine: {
    kicker: T('DAL MAGAZINE', 'FROM THE MAGAZINE', 'DEPUIS LE MAGAZINE', 'AUS DEM MAGAZIN', 'DESDE LA REVISTA', 'من المجلة'),
    title:  T('Ispirazione e cultura del design',
              'Design inspiration and culture',
              'Inspiration et culture du design',
              'Designinspiration und Kultur',
              'Inspiración y cultura del diseño',
              'إلهام وثقافة التصميم'),
    ctaLabel: T('VAI AL MAGAZINE', 'GO TO THE MAGAZINE', 'ALLER AU MAGAZINE', 'ZUM MAGAZIN', 'IR A LA REVISTA', 'إلى المجلة'),
    ctaHref:  '/magazine',
    readLabel: T('Leggi l’articolo', 'Read the article', 'Lire l’article', 'Artikel lesen', 'Leer el artículo', 'اقرأ المقال'),
    items: [
      {
        id: 'minimalismo', slug: 'minimalismo-italiano',
        image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1400&q=85',
        category: T('DESIGN', 'DESIGN', 'DESIGN', 'DESIGN', 'DESIGN', 'تصميم'),
        title:    T('Il nuovo minimalismo italiano', 'The new Italian minimalism', 'Le nouveau minimalisme italien', 'Der neue italienische Minimalismus', 'El nuevo minimalismo italiano', 'البساطة الإيطالية الجديدة'),
      },
      {
        id: 'colori-materiali-2024', slug: 'colori-materiali-2024',
        image: 'https://images.unsplash.com/photo-1615875221691-c63d6a4a83a7?auto=format&fit=crop&w=1400&q=85',
        category: T('TENDENZE', 'TRENDS', 'TENDANCES', 'TRENDS', 'TENDENCIAS', 'الاتجاهات'),
        title:    T('Colori e materiali 2024', 'Colours and materials 2024', 'Couleurs et matériaux 2024', 'Farben und Materialien 2024', 'Colores y materiales 2024', 'الألوان والمواد 2024'),
      },
      {
        id: 'luce-naturale', slug: 'luce-naturale-benessere',
        image: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1400&q=85',
        category: T('ISPIRAZIONI', 'INSPIRATIONS', 'INSPIRATIONS', 'INSPIRATIONEN', 'INSPIRACIONES', 'إلهامات'),
        title:    T('Luce naturale e benessere', 'Natural light and wellbeing', 'Lumière naturelle et bien-être', 'Natürliches Licht und Wohlbefinden', 'Luz natural y bienestar', 'الضوء الطبيعي والرفاهية'),
      },
    ],
  },

  // ── BRAND PARTNERS ──────────────────────────────────────────────────
  brandLogos: {
    kicker: T('PARTNER & BRAND', 'PARTNERS & BRANDS', 'PARTENAIRES & MARQUES', 'PARTNER & MARKEN', 'SOCIOS Y MARCAS', 'الشركاء والعلامات'),
    items: [
      { id: 'minotti',       wordmark: 'Minotti',        href: '#brand' },
      { id: 'poliform',      wordmark: 'Poliform',       href: '#brand' },
      { id: 'bb-italia',     wordmark: 'B&B Italia',     href: '#brand' },
      { id: 'flexform',      wordmark: 'Flexform',       href: '#brand' },
      { id: 'molteni',       wordmark: 'Molteni & C',    href: '#brand' },
      { id: 'porada',        wordmark: 'porada',         href: '#brand' },
      { id: 'flos',          wordmark: 'FLOS',           href: '#brand' },
      { id: 'antonio-lupi',  wordmark: 'Antonio Lupi',   href: '#brand' },
    ],
  },
};
