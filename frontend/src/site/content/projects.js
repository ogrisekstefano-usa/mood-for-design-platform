// MOOD for DESIGN™ — Projects Showcase Content
// Mirrors future DB: tables `projects` + `project_chapters` + `project_materials`
// Each project is a full editorial story — locale-keyed.

export const projectCategories = [
  { id: 'all', label: { it: 'Tutti', en: 'All', fr: 'Tous', de: 'Alle', es: 'Todos' } },
  { id: 'residential', label: { it: 'Residenziale', en: 'Residential', fr: 'Résidentiel', de: 'Wohnen', es: 'Residencial' } },
  { id: 'hospitality', label: { it: 'Ospitalità', en: 'Hospitality', fr: 'Hospitalité', de: 'Hospitality', es: 'Hospitalidad' } },
  { id: 'retail', label: { it: 'Retail', en: 'Retail', fr: 'Retail', de: 'Retail', es: 'Retail' } },
];

const tag = (it, en, fr, de, es) => ({ it, en, fr, de, es });

export const projects = [
  {
    slug: 'casa-naviglio',
    category: 'residential',
    year: 2025,
    location: { it: 'Milano, Italia', en: 'Milan, Italy', fr: 'Milan, Italie', de: 'Mailand, Italien', es: 'Milán, Italia' },
    studio: 'Studio Beltrame',
    designer: 'Elisabetta Conti',
    cover: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=2000&q=80',
    aspect: '3/4',
    title: {
      it: 'Casa Naviglio',
      en: 'Casa Naviglio',
      fr: 'Casa Naviglio',
      de: 'Casa Naviglio',
      es: 'Casa Naviglio',
    },
    subtitle: {
      it: 'Un appartamento del 1920 ridisegnato attorno alla luce dei Navigli.',
      en: 'A 1920 apartment redesigned around the light of the Navigli.',
      fr: 'Un appartement de 1920 redessiné autour de la lumière des Navigli.',
      de: 'Eine Wohnung von 1920, neu gestaltet um das Licht der Navigli.',
      es: 'Un apartamento de 1920 rediseñado en torno a la luz de los Navigli.',
    },
    summary: {
      it: 'Un intervento misurato, fatto di noce nazionale, marmo Verde Alpi e tessuti naturali. La scala originale resta protagonista; gli arredi sono italiani, dal 1960 a oggi.',
      en: 'A measured intervention of walnut, Verde Alpi marble and natural fabrics. The original staircase remains the protagonist; furnishings are Italian, from 1960 to today.',
      fr: 'Une intervention mesurée en noyer, marbre Verde Alpi et tissus naturels. L\u2019escalier d\u2019origine reste protagoniste ; mobilier italien, de 1960 à aujourd\u2019hui.',
      de: 'Ein behutsamer Eingriff aus Nussbaum, Verde Alpi Marmor und Naturstoffen. Die originale Treppe bleibt Hauptdarstellerin; Möbel italienisch, von 1960 bis heute.',
      es: 'Una intervención medida en nogal, mármol Verde Alpi y tejidos naturales. La escalera original sigue siendo protagonista; mobiliario italiano, de 1960 a hoy.',
    },
    tags: [
      tag('Residenziale', 'Residential', 'Résidentiel', 'Wohnen', 'Residencial'),
      tag('Editoriale', 'Editorial', 'Éditorial', 'Editorial', 'Editorial'),
      tag('Heritage', 'Heritage', 'Patrimoine', 'Heritage', 'Patrimonio'),
    ],
    gallery: [
      'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1800&q=80',
      'https://images.unsplash.com/photo-1615873968403-89e068629265?auto=format&fit=crop&w=1800&q=80',
      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1800&q=80',
      'https://images.unsplash.com/photo-1616627052149-22c4f8a6316e?auto=format&fit=crop&w=1800&q=80',
    ],
    chapters: [
      {
        id: 'concept',
        title: { it: 'Il concept', en: 'The concept', fr: 'Le concept', de: 'Das Konzept', es: 'El concepto' },
        body: {
          it: 'Riportare la luce dei Navigli dentro casa. Pavimento in rovere spazzolato, pareti in calce, una sola tenda di lino crudo lunga sette metri.',
          en: 'Bringing the Navigli light back inside. Brushed oak floor, lime-washed walls, a single seven-meter raw-linen curtain.',
          fr: 'Faire entrer la lumière des Navigli. Sol en chêne brossé, murs à la chaux, un unique rideau de lin brut de sept mètres.',
          de: 'Das Licht der Navigli zurück ins Haus. Gebürsteter Eichenboden, Kalkwände, ein einziger sieben Meter langer Rohleinenvorhang.',
          es: 'Devolver la luz de los Navigli al interior. Suelo de roble cepillado, paredes de cal, una única cortina de lino crudo de siete metros.',
        },
      },
      {
        id: 'materials',
        title: { it: 'I materiali', en: 'The materials', fr: 'Les matériaux', de: 'Die Materialien', es: 'Los materiales' },
        body: {
          it: 'Marmo Verde Alpi della Val d\u2019Ossola. Noce nazionale spazzolato. Lino crudo greggio. Ottone brunito a mano.',
          en: 'Verde Alpi marble from Val d\u2019Ossola. Brushed Italian walnut. Raw natural linen. Hand-burnished brass.',
          fr: 'Marbre Verde Alpi du Val d\u2019Ossola. Noyer italien brossé. Lin écru. Laiton bruni à la main.',
          de: 'Verde Alpi Marmor aus Val d\u2019Ossola. Gebürsteter Nussbaum. Rohleinen. Handpatiniertes Messing.',
          es: 'Mármol Verde Alpi del Val d\u2019Ossola. Nogal italiano cepillado. Lino crudo. Latón patinado a mano.',
        },
      },
    ],
    materials: [
      { name: { it: 'Marmo Verde Alpi', en: 'Verde Alpi marble', fr: 'Marbre Verde Alpi', de: 'Verde Alpi Marmor', es: 'Mármol Verde Alpi' }, supplier: 'Henraux' },
      { name: { it: 'Noce nazionale', en: 'Italian walnut', fr: 'Noyer italien', de: 'Italienischer Nussbaum', es: 'Nogal italiano' }, supplier: 'Listone Giordano' },
      { name: { it: 'Lino crudo', en: 'Raw linen', fr: 'Lin brut', de: 'Rohleinen', es: 'Lino crudo' }, supplier: 'C&C Milano' },
    ],
  },

  {
    slug: 'aman-residences-tokyo',
    category: 'hospitality',
    year: 2025,
    location: { it: 'Tokyo, Giappone', en: 'Tokyo, Japan', fr: 'Tokyo, Japon', de: 'Tokio, Japan', es: 'Tokio, Japón' },
    studio: 'Kerry Hill Architects',
    designer: 'Anouk Lefèvre',
    cover: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=2000&q=80',
    aspect: '4/5',
    title: { it: 'Aman Residences', en: 'Aman Residences', fr: 'Aman Residences', de: 'Aman Residences', es: 'Aman Residences' },
    subtitle: {
      it: 'Una suite verticale sospesa sopra Otemachi, fatta di hinoki e silenzio.',
      en: 'A vertical suite suspended over Otemachi, made of hinoki and silence.',
      fr: 'Une suite verticale suspendue au-dessus d\u2019Otemachi, de hinoki et de silence.',
      de: 'Eine vertikale Suite über Otemachi, aus Hinoki und Stille.',
      es: 'Una suite vertical suspendida sobre Otemachi, de hinoki y silencio.',
    },
    summary: {
      it: 'Una residenza-hotel di 220 mq sospesa al 33° piano. Pareti scorrevoli in carta washi, pavimento in hinoki giapponese, una vasca in pietra nera ricavata da un unico blocco.',
      en: 'A 220 m² residence-hotel on the 33rd floor. Sliding washi paper walls, Japanese hinoki floor, a black-stone bath carved from a single block.',
      fr: 'Une résidence-hôtel de 220 m² au 33ᵉ étage. Parois coulissantes en washi, sol en hinoki, baignoire en pierre noire monolithique.',
      de: 'Eine 220 m² Residenz-Hotel-Suite im 33. Stock. Schiebewände aus Washi, Hinoki-Boden, eine monolithische Schwarzsteinwanne.',
      es: 'Una residencia-hotel de 220 m² en la planta 33. Paneles correderos de washi, suelo de hinoki, bañera de piedra negra monolítica.',
    },
    tags: [
      tag('Ospitalità', 'Hospitality', 'Hospitalité', 'Hospitality', 'Hospitalidad'),
      tag('Suite', 'Suite', 'Suite', 'Suite', 'Suite'),
      tag('Wabi-sabi', 'Wabi-sabi', 'Wabi-sabi', 'Wabi-sabi', 'Wabi-sabi'),
    ],
    gallery: [
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1800&q=80',
      'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1800&q=80',
      'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?auto=format&fit=crop&w=1800&q=80',
      'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1800&q=80',
    ],
    chapters: [
      {
        id: 'concept',
        title: { it: 'Il concept', en: 'The concept', fr: 'Le concept', de: 'Das Konzept', es: 'El concepto' },
        body: {
          it: 'Una sequenza di vuoti. Tre soglie, tre materiali, tre temperature: legno chiaro, pietra, acqua.',
          en: 'A sequence of voids. Three thresholds, three materials, three temperatures: pale wood, stone, water.',
          fr: 'Une séquence de vides. Trois seuils, trois matériaux, trois températures : bois clair, pierre, eau.',
          de: 'Eine Sequenz von Leerräumen. Drei Schwellen, drei Materialien, drei Temperaturen: helles Holz, Stein, Wasser.',
          es: 'Una secuencia de vacíos. Tres umbrales, tres materiales, tres temperaturas: madera clara, piedra, agua.',
        },
      },
    ],
    materials: [
      { name: { it: 'Hinoki giapponese', en: 'Japanese hinoki', fr: 'Hinoki japonais', de: 'Japanischer Hinoki', es: 'Hinoki japonés' }, supplier: 'Nakamura Mokko' },
      { name: { it: 'Pietra Basaltina', en: 'Basaltina stone', fr: 'Pierre Basaltina', de: 'Basaltina Stein', es: 'Piedra Basaltina' }, supplier: 'Salvatori' },
    ],
  },

  {
    slug: 'galerie-saint-honore',
    category: 'retail',
    year: 2024,
    location: { it: 'Parigi, Francia', en: 'Paris, France', fr: 'Paris, France', de: 'Paris, Frankreich', es: 'París, Francia' },
    studio: 'Atelier Vincent Darré',
    designer: 'Camille Aubin',
    cover: 'https://images.unsplash.com/photo-1567016376408-0226e4d0c1ea?auto=format&fit=crop&w=2000&q=80',
    aspect: '5/4',
    title: { it: 'Galerie Saint-Honoré', en: 'Galerie Saint-Honoré', fr: 'Galerie Saint-Honoré', de: 'Galerie Saint-Honoré', es: 'Galerie Saint-Honoré' },
    subtitle: {
      it: 'Una galleria-boutique nel 1er arrondissement, fra ottone e velluto.',
      en: 'A gallery-boutique in the 1er arrondissement, between brass and velvet.',
      fr: 'Une galerie-boutique dans le 1er arrondissement, entre laiton et velours.',
      de: 'Eine Galerie-Boutique im 1er, zwischen Messing und Samt.',
      es: 'Una galería-boutique en el 1er, entre latón y terciopelo.',
    },
    summary: {
      it: 'Quattro vetrine, due livelli, un\u2019ossatura in ottone brunito. Pareti in stucco rosa cipria, tappeti in lana persiana, illuminazione da museo.',
      en: 'Four shop windows, two levels, a burnished brass armature. Powder-rose stucco walls, Persian wool rugs, museum-grade lighting.',
      fr: 'Quatre vitrines, deux niveaux, une ossature en laiton bruni. Stucs rose poudré, tapis en laine persane, éclairage muséal.',
      de: 'Vier Schaufenster, zwei Ebenen, ein Rahmen aus patiniertem Messing. Puderrosa Stuck, persische Wollteppiche, museale Beleuchtung.',
      es: 'Cuatro escaparates, dos niveles, una estructura de latón patinado. Estucos rosa polvo, alfombras persas, iluminación museística.',
    },
    tags: [
      tag('Retail', 'Retail', 'Retail', 'Retail', 'Retail'),
      tag('Boutique', 'Boutique', 'Boutique', 'Boutique', 'Boutique'),
      tag('Parigi', 'Paris', 'Paris', 'Paris', 'París'),
    ],
    gallery: [
      'https://images.unsplash.com/photo-1604014237800-1c9102c219da?auto=format&fit=crop&w=1800&q=80',
      'https://images.unsplash.com/photo-1583845112203-29329902332e?auto=format&fit=crop&w=1800&q=80',
      'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1800&q=80',
    ],
    chapters: [],
    materials: [
      { name: { it: 'Ottone brunito', en: 'Burnished brass', fr: 'Laiton bruni', de: 'Patiniertes Messing', es: 'Latón patinado' }, supplier: 'Mater Italia' },
      { name: { it: 'Stucco veneziano', en: 'Venetian stucco', fr: 'Stuc vénitien', de: 'Venezianischer Stuck', es: 'Estuco veneciano' }, supplier: 'Marmorino Carrara' },
    ],
  },

  {
    slug: 'villa-cap-ferrat',
    category: 'residential',
    year: 2024,
    location: { it: 'Saint-Jean-Cap-Ferrat, Francia', en: 'Saint-Jean-Cap-Ferrat, France', fr: 'Saint-Jean-Cap-Ferrat, France', de: 'Saint-Jean-Cap-Ferrat, Frankreich', es: 'Saint-Jean-Cap-Ferrat, Francia' },
    studio: 'Mlinaric, Henry & Zervudachi',
    designer: 'Marina Zervudachi',
    cover: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=2000&q=80',
    aspect: '3/4',
    title: { it: 'Villa Cap Ferrat', en: 'Villa Cap Ferrat', fr: 'Villa Cap Ferrat', de: 'Villa Cap Ferrat', es: 'Villa Cap Ferrat' },
    subtitle: {
      it: 'Una villa anni \u201930 affacciata sul Mediterraneo, restaurata in chiave contemporanea.',
      en: 'A 1930s villa overlooking the Mediterranean, restored with a contemporary hand.',
      fr: 'Une villa des années 1930 surplombant la Méditerranée, restaurée avec une main contemporaine.',
      de: 'Eine 1930er Villa über dem Mittelmeer, mit zeitgenössischer Hand restauriert.',
      es: 'Una villa de los años 30 sobre el Mediterráneo, restaurada con mano contemporánea.',
    },
    summary: {
      it: 'Restauro conservativo dei pavimenti in pietra di Burgundy. Nuovi infissi minimali in bronzo, biblioteca a doppia altezza, terrazza in calce con vasca a sfioro.',
      en: 'Conservative restoration of the Burgundy stone floors. New minimal bronze frames, double-height library, lime-rendered terrace with infinity pool.',
      fr: 'Restauration conservative des sols en pierre de Bourgogne. Nouvelles menuiseries minimales en bronze, bibliothèque double hauteur, terrasse à la chaux avec piscine à débordement.',
      de: 'Konservative Restaurierung der Bourgogne-Steinböden. Neue minimale Bronzefenster, doppelt hohe Bibliothek, Kalkterrasse mit Infinity-Pool.',
      es: 'Restauración conservadora de los suelos de piedra de Borgoña. Nuevos marcos minimalistas en bronce, biblioteca a doble altura, terraza de cal con piscina infinita.',
    },
    tags: [
      tag('Residenziale', 'Residential', 'Résidentiel', 'Wohnen', 'Residencial'),
      tag('Riviera', 'Riviera', 'Riviera', 'Riviera', 'Riviera'),
      tag('Heritage', 'Heritage', 'Patrimoine', 'Heritage', 'Patrimonio'),
    ],
    gallery: [
      'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1800&q=80',
      'https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?auto=format&fit=crop&w=1800&q=80',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1800&q=80',
    ],
    chapters: [],
    materials: [
      { name: { it: 'Pietra di Borgogna', en: 'Burgundy stone', fr: 'Pierre de Bourgogne', de: 'Bourgogne Stein', es: 'Piedra de Borgoña' }, supplier: 'Rocamat' },
      { name: { it: 'Bronzo brunito', en: 'Burnished bronze', fr: 'Bronze bruni', de: 'Patinierte Bronze', es: 'Bronce patinado' }, supplier: 'Secco Sistemi' },
    ],
  },

  {
    slug: 'hotel-orient-istanbul',
    category: 'hospitality',
    year: 2023,
    location: { it: 'Istanbul, Turchia', en: 'Istanbul, Turkey', fr: 'Istanbul, Turquie', de: 'Istanbul, Türkei', es: 'Estambul, Turquía' },
    studio: 'GA Group London',
    designer: 'Yusuf Karaca',
    cover: 'https://images.unsplash.com/photo-1542640244-7e672d6cef4e?auto=format&fit=crop&w=2000&q=80',
    aspect: '4/5',
    title: { it: 'Hotel Orient', en: 'Hotel Orient', fr: 'Hotel Orient', de: 'Hotel Orient', es: 'Hotel Orient' },
    subtitle: {
      it: 'Una hall di 600 mq nel cuore di Karaköy, dove l\u2019Asia incontra il Bosforo.',
      en: 'A 600 m² lobby in the heart of Karaköy, where Asia meets the Bosphorus.',
      fr: 'Un hall de 600 m² au cœur de Karaköy, où l\u2019Asie rencontre le Bosphore.',
      de: 'Eine 600 m² Lobby im Herzen von Karaköy, wo Asien auf den Bosporus trifft.',
      es: 'Un hall de 600 m² en el corazón de Karaköy, donde Asia se encuentra con el Bósforo.',
    },
    summary: {
      it: 'Tappeti annodati a mano, ottone martellato, lanterne in alabastro turco. Una sala da tè interna che diventa biblioteca dopo le 18:00.',
      en: 'Hand-knotted rugs, hammered brass, Turkish alabaster lanterns. An indoor tea room that becomes a library after 6pm.',
      fr: 'Tapis noués main, laiton martelé, lanternes en albâtre turc. Un salon de thé intérieur qui devient bibliothèque après 18h.',
      de: 'Handgeknüpfte Teppiche, gehämmertes Messing, türkische Alabasterlaternen. Ein Teesalon, der nach 18 Uhr zur Bibliothek wird.',
      es: 'Alfombras anudadas a mano, latón martillado, faroles de alabastro turco. Un salón de té que se vuelve biblioteca tras las 18:00.',
    },
    tags: [
      tag('Ospitalità', 'Hospitality', 'Hospitalité', 'Hospitality', 'Hospitalidad'),
      tag('Lobby', 'Lobby', 'Lobby', 'Lobby', 'Lobby'),
      tag('Levant', 'Levant', 'Levant', 'Levante', 'Levante'),
    ],
    gallery: [
      'https://images.unsplash.com/photo-1551776245-d20a40c4d6c4?auto=format&fit=crop&w=1800&q=80',
      'https://images.unsplash.com/photo-1631049035634-93b56a37fc6c?auto=format&fit=crop&w=1800&q=80',
      'https://images.unsplash.com/photo-1559599189-fe84dea4eb79?auto=format&fit=crop&w=1800&q=80',
    ],
    chapters: [],
    materials: [
      { name: { it: 'Alabastro turco', en: 'Turkish alabaster', fr: 'Albâtre turc', de: 'Türkischer Alabaster', es: 'Alabastro turco' }, supplier: 'Karaca Mermer' },
      { name: { it: 'Ottone martellato', en: 'Hammered brass', fr: 'Laiton martelé', de: 'Gehämmertes Messing', es: 'Latón martillado' }, supplier: 'Sahin Atelier' },
    ],
  },

  {
    slug: 'penthouse-tribeca',
    category: 'residential',
    year: 2025,
    location: { it: 'New York, USA', en: 'New York, USA', fr: 'New York, USA', de: 'New York, USA', es: 'Nueva York, EE.UU.' },
    studio: 'Studio Sofield',
    designer: 'Naomi Tate',
    cover: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=2000&q=80',
    aspect: '3/4',
    title: { it: 'Penthouse Tribeca', en: 'Penthouse Tribeca', fr: 'Penthouse Tribeca', de: 'Penthouse Tribeca', es: 'Penthouse Tribeca' },
    subtitle: {
      it: 'Un loft di 380 mq al 28° piano, fra acciaio brunito e quercia americana.',
      en: 'A 380 m² loft on the 28th floor, between burnished steel and American oak.',
      fr: 'Un loft de 380 m² au 28ᵉ étage, entre acier bruni et chêne américain.',
      de: 'Ein 380 m² Loft im 28. Stock, zwischen patiniertem Stahl und amerikanischer Eiche.',
      es: 'Un loft de 380 m² en la planta 28, entre acero patinado y roble americano.',
    },
    summary: {
      it: 'Pianta libera, soffitti a sette metri, finestre da pavimento a soffitto verso il fiume Hudson. Cucina-isola in marmo Calacatta Borghini. Soundscape acustico per la zona meditazione.',
      en: 'Open plan, seven-meter ceilings, floor-to-ceiling windows facing the Hudson river. Calacatta Borghini marble island kitchen. Acoustic soundscape for the meditation zone.',
      fr: 'Plan libre, plafonds de sept mètres, fenêtres pleine hauteur sur l\u2019Hudson. Cuisine îlot en marbre Calacatta Borghini. Soundscape acoustique pour la zone méditation.',
      de: 'Offener Grundriss, sieben Meter Decken, raumhohe Fenster zum Hudson. Calacatta Borghini Marmor-Inselküche. Akustisches Soundscape für die Meditationszone.',
      es: 'Planta libre, techos de siete metros, ventanales al Hudson. Cocina isla en mármol Calacatta Borghini. Soundscape acústico para la zona de meditación.',
    },
    tags: [
      tag('Residenziale', 'Residential', 'Résidentiel', 'Wohnen', 'Residencial'),
      tag('Penthouse', 'Penthouse', 'Penthouse', 'Penthouse', 'Ático'),
      tag('Manhattan', 'Manhattan', 'Manhattan', 'Manhattan', 'Manhattan'),
    ],
    gallery: [
      'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1800&q=80',
      'https://images.unsplash.com/photo-1600210491369-e753d80a41f3?auto=format&fit=crop&w=1800&q=80',
      'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1800&q=80',
    ],
    chapters: [],
    materials: [
      { name: { it: 'Calacatta Borghini', en: 'Calacatta Borghini', fr: 'Calacatta Borghini', de: 'Calacatta Borghini', es: 'Calacatta Borghini' }, supplier: 'Henraux' },
      { name: { it: 'Acciaio brunito', en: 'Burnished steel', fr: 'Acier bruni', de: 'Patinierter Stahl', es: 'Acero patinado' }, supplier: 'De Castelli' },
    ],
  },
];

export const findProjectBySlug = (slug) => projects.find((p) => p.slug === slug) || null;
