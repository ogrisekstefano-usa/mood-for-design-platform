// MOOD for DESIGN™ — START PROJECT (Private Onboarding) Content
// 7 steps + final ready state. Mirrors future DB shape:
//   `cms_onboarding_flows(tenant_id, key='private', steps jsonb)`
//   `cms_onboarding_options(step_key, value, label_locale jsonb, image)`
// ZERO hardcoded UI — every label is locale-keyed { it,en,fr,de,es }.

const t = (it, en, fr, de, es) => ({ it, en, fr, de, es });

const IMG = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=85`;

export const onboardingContent = {
  meta: {
    title: t(
      'Inizia il tuo progetto — MOOD for DESIGN\u2122',
      'Begin your project — MOOD for DESIGN\u2122',
      'Commencer votre projet — MOOD for DESIGN\u2122',
      'Projekt beginnen — MOOD for DESIGN\u2122',
      'Comienza tu proyecto — MOOD for DESIGN\u2122',
    ),
    eyebrow: t('Step {n} di {total}', 'Step {n} of {total}', 'Étape {n} sur {total}', 'Schritt {n} von {total}', 'Paso {n} de {total}'),
    backStep: t('Indietro', 'Back', 'Retour', 'Zurück', 'Atrás'),
    continue: t('Continua', 'Continue', 'Continuer', 'Weiter', 'Continuar'),
    submit: t('Invia il progetto', 'Submit project', 'Envoyer le projet', 'Projekt senden', 'Enviar proyecto'),
    skip: t('Salta', 'Skip', 'Ignorer', 'Überspringen', 'Saltar'),
    optional: t('Facoltativo', 'Optional', 'Facultatif', 'Optional', 'Opcional'),
    selectAll: t('Seleziona tutto', 'Select all', 'Tout sélectionner', 'Alle auswählen', 'Seleccionar todo'),
    exitConfirm: t(
      'Sei sicuro di voler uscire? I dati inseriti vengono salvati localmente.',
      'Are you sure you want to exit? Your inputs are saved locally.',
      'Voulez-vous vraiment quitter ? Vos saisies sont sauvegardées localement.',
      'Möchten Sie wirklich beenden? Ihre Eingaben werden lokal gespeichert.',
      '¿Seguro que quieres salir? Tus respuestas se guardan localmente.',
    ),
  },

  // STEP 1 — PROJECT TYPE
  step1: {
    eyebrow: t('Inizia', 'Begin', 'Commencer', 'Beginnen', 'Comenzar'),
    title: t('Cosa stiamo\u00a0progettando?', 'What are we\u00a0designing?', 'Que concevons-nous\u00a0?', 'Was gestalten wir?', '¿Qué estamos\u00a0diseñando?'),
    body: t('Raccontaci il tuo progetto, per iniziare.', 'Tell us about your project, to get started.', 'Parlez-nous de votre projet, pour commencer.', 'Erzählen Sie uns von Ihrem Projekt.', 'Cuéntanos sobre tu proyecto, para empezar.'),
    options: [
      { id: 'apartment',     label: t('Appartamento',  'Apartment',     'Appartement',   'Wohnung',     'Apartamento'),    image: IMG('photo-1560448204-e02f11c3d0e2') },
      { id: 'villa',         label: t('Villa',         'Villa',         'Villa',         'Villa',       'Villa'),          image: IMG('photo-1600210492486-724fe5c67fb0') },
      { id: 'penthouse',     label: t('Attico',        'Penthouse',     'Penthouse',     'Penthouse',   'Ático'),          image: IMG('photo-1600585154526-990dced4db0d') },
      { id: 'boutique_hotel',label: t('Boutique hotel','Boutique hotel','Boutique hôtel','Boutique-Hotel','Boutique hotel'), image: IMG('photo-1564013799919-ab600027ffc6') },
      { id: 'restaurant',    label: t('Ristorante',    'Restaurant',    'Restaurant',    'Restaurant',  'Restaurante'),    image: IMG('photo-1517248135467-4c7edcad34c4') },
      { id: 'retail',        label: t('Retail',        'Retail',        'Retail',        'Retail',      'Retail'),         image: IMG('photo-1567016376408-0226e4d0c1ea') },
      { id: 'office',        label: t('Ufficio',       'Office',        'Bureau',        'Büro',        'Oficina'),        image: IMG('photo-1497366216548-37526070297c') },
      { id: 'wellness',      label: t('Wellness',      'Wellness',      'Bien-être',     'Wellness',    'Wellness'),       image: IMG('photo-1540555700478-4be289fbecef') },
      { id: 'other',         label: t('Altro',         'Other',         'Autre',         'Sonstiges',   'Otro'),           image: IMG('photo-1505691938895-1758d7feb511') },
    ],
  },

  // STEP 2 — SPACES
  step2: {
    eyebrow: t('Gli spazi', 'The spaces', 'Les espaces', 'Die Räume', 'Los espacios'),
    title: t('Quali ambienti\nsono coinvolti?', 'Which spaces are\ninvolved?', 'Quels espaces\nsont concernés ?', 'Welche Räume\nsind betroffen?', '¿Qué espacios\nestán involucrados?'),
    body: t('Seleziona tutti gli ambienti\u00a0che vuoi farci considerare.', 'Select all the spaces you\u2019d like\u00a0us to consider.', 'Sélectionnez tous les espaces\u00a0à considérer.', 'Wählen Sie alle Räume aus,\u00a0die wir berücksichtigen sollen.', 'Selecciona todos los espacios\u00a0a considerar.'),
    image: IMG('photo-1616594039964-ae9021a400a0'),
    options: [
      { id: 'living',    label: t('Soggiorno',         'Living Room',       'Salon',                 'Wohnzimmer',        'Sala de estar') },
      { id: 'kitchen',   label: t('Cucina',            'Kitchen',           'Cuisine',               'Küche',             'Cocina') },
      { id: 'dining',    label: t('Sala da pranzo',    'Dining Room',       'Salle à manger',        'Esszimmer',         'Comedor') },
      { id: 'bedroom',   label: t('Camera da letto',   'Bedroom',           'Chambre',               'Schlafzimmer',      'Dormitorio') },
      { id: 'bathroom',  label: t('Bagno',             'Bathroom',          'Salle de bain',         'Badezimmer',        'Baño') },
      { id: 'outdoor',   label: t('Esterni',           'Outdoor',           'Extérieurs',            'Außenbereich',      'Exteriores') },
      { id: 'office',    label: t('Ufficio / Workspace','Office / Workspace','Bureau / Workspace',   'Büro / Workspace',  'Oficina / Workspace') },
      { id: 'entrance',  label: t('Ingresso / Lobby',  'Entrance / Lobby',  'Entrée / Hall',         'Eingang / Lobby',   'Entrada / Lobby') },
      { id: 'other',     label: t('Altro',             'Other',             'Autre',                 'Sonstiges',         'Otro') },
    ],
  },

  // STEP 3 — STYLE & ATMOSPHERE
  step3: {
    eyebrow: t('Stile & atmosfera', 'Style & atmosphere', 'Style & ambiance', 'Stil & Atmosphäre', 'Estilo y atmósfera'),
    title: t('Quale stile e atmosfera\nti rappresentano?', 'What style and atmosphere\ndo you love?', 'Quel style et atmosphère\nvous correspondent ?', 'Welcher Stil und welche\nAtmosphäre passen zu Ihnen?', '¿Qué estilo y atmósfera\nte representan?'),
    body: t('Seleziona uno o più mood (multi-selezione consentita).', 'Choose the mood that resonates most with you (multi-select allowed).', 'Choisissez le ou les mood qui vous parlent.', 'Wählen Sie das Mood, das Sie am meisten anspricht.', 'Elige uno o más moods que más te resuenen.'),
    options: [
      { id: 'warm_minimal',         label: t('Warm minimal',          'Warm minimal',         'Warm minimal',          'Warm minimal',          'Warm minimal'),          image: IMG('photo-1615875221691-c63d6a4a83a7') },
      { id: 'quiet_luxury',         label: t('Quiet luxury',          'Quiet luxury',         'Quiet luxury',          'Quiet luxury',          'Quiet luxury'),          image: IMG('photo-1600585154340-be6161a56a0c') },
      { id: 'mediterranean_calm',   label: t('Mediterranean calm',    'Mediterranean calm',   'Calme méditerranéen',   'Mediterrane Ruhe',      'Calma mediterránea'),    image: IMG('photo-1600210492486-724fe5c67fb0') },
      { id: 'sculptural_contemporary', label: t('Sculptural contemporary', 'Sculptural contemporary', 'Sculptural contemporain', 'Skulptural zeitgenössisch', 'Escultural contemporáneo'), image: IMG('photo-1600210492493-0946911123ea') },
      { id: 'natural_modernism',    label: t('Natural modernism',     'Natural modernism',    'Modernisme naturel',    'Natürliche Moderne',    'Modernismo natural'),    image: IMG('photo-1556909114-f6e7ad7d3136') },
      { id: 'dark_editorial',       label: t('Dark editorial',        'Dark editorial',       'Dark editorial',        'Dark editorial',        'Dark editorial'),        image: IMG('photo-1616627052149-22c4f8a6316e') },
    ],
  },

  // STEP 4 — INSPIRATIONS
  step4: {
    eyebrow: t('Le tue ispirazioni', 'Your inspirations', 'Vos inspirations', 'Ihre Inspirationen', 'Tus inspiraciones'),
    title: t('Condividi le\u00a0tue ispirazioni', 'Share your\u00a0inspirations', 'Partagez vos\u00a0inspirations', 'Teilen Sie Ihre\u00a0Inspirationen', 'Comparte tus\u00a0inspiraciones'),
    body: t('Carica immagini, incolla link o crea un mini-board con tutto ciò che ami.', 'Upload images, paste links or create a board with everything you love.', 'Téléchargez des images, collez des liens ou créez un mini-board.', 'Bilder hochladen, Links einfügen oder ein Mini-Board erstellen.', 'Sube imágenes, pega enlaces o crea un mini-tablero.'),
    tabs: [
      { id: 'upload',    label: t('Carica',     'Upload',    'Télécharger', 'Hochladen', 'Subir') },
      { id: 'pinterest', label: t('Pinterest',  'Pinterest', 'Pinterest',   'Pinterest', 'Pinterest') },
      { id: 'link',      label: t('Link',       'Link',      'Lien',        'Link',      'Enlace') },
      { id: 'board',     label: t('Board',      'Board',     'Board',       'Board',     'Tablero') },
    ],
    addMore: t('Aggiungi', 'Add more', 'Ajouter', 'Hinzufügen', 'Añadir'),
    placeholder: {
      pinterest: t('Incolla un link Pinterest\u2026', 'Paste a Pinterest link\u2026', 'Collez un lien Pinterest\u2026', 'Pinterest-Link einfügen\u2026', 'Pega un enlace de Pinterest\u2026'),
      link:      t('Incolla un link a un\u2019immagine o un articolo\u2026', 'Paste a link to an image or article\u2026', 'Collez un lien vers une image ou un article\u2026', 'Link zu Bild oder Artikel einfügen\u2026', 'Pega un enlace a una imagen o artículo\u2026'),
    },
    emptyBoard: t('Le tue ispirazioni appariranno qui.', 'Your inspirations will appear here.', 'Vos inspirations apparaîtront ici.', 'Ihre Inspirationen erscheinen hier.', 'Tus inspiraciones aparecerán aquí.'),
  },

  // STEP 5 — MATERIALS & COLORS
  step5: {
    eyebrow: t('Materiali & palette', 'Materials & palette', 'Matériaux & palette', 'Materialien & Palette', 'Materiales y paleta'),
    title: t('Materiali\u00a0& colori', 'Materials\u00a0& colors', 'Matériaux\u00a0& couleurs', 'Materialien\u00a0& Farben', 'Materiales\u00a0y colores'),
    body: t('Seleziona i materiali e la palette\u00a0che ti rappresentano.', 'Select the materials and colors\u00a0you are drawn to.', 'Sélectionnez les matériaux et\u00a0couleurs qui vous correspondent.', 'Wählen Sie Materialien und\u00a0Farben, die zu Ihnen passen.', 'Selecciona materiales y colores\u00a0que te representen.'),
    materialsTitle: t('Materiali', 'Materials', 'Matériaux', 'Materialien', 'Materiales'),
    colorsTitle: t('Colori', 'Colors', 'Couleurs', 'Farben', 'Colores'),
    materials: [
      { id: 'travertine',     label: t('Travertino',     'Travertine',      'Travertin',      'Travertin',      'Travertino'),     swatch: '#C9B89C' },
      { id: 'walnut',         label: t('Noce',           'Walnut',          'Noyer',          'Nussbaum',       'Nogal'),          swatch: '#5C3A1E' },
      { id: 'linen',          label: t('Lino',           'Linen',           'Lin',            'Leinen',         'Lino'),           swatch: '#D6CDB6' },
      { id: 'brushed_metal',  label: t('Metallo spazzolato', 'Brushed metal', 'Métal brossé',  'Gebürstetes Metall', 'Metal cepillado'), swatch: '#A8A09A' },
      { id: 'bronze',         label: t('Bronzo',         'Bronze',          'Bronze',         'Bronze',         'Bronce'),         swatch: '#8C6A3D' },
      { id: 'glass',          label: t('Vetro',          'Glass',           'Verre',          'Glas',           'Vidrio'),         swatch: '#C5CFD3' },
    ],
    colors: [
      { id: 'warm_white', label: t('Bianco caldo', 'Warm White', 'Blanc chaud', 'Warmweiß',  'Blanco cálido'), swatch: '#EFE6D9' },
      { id: 'sand',       label: t('Sabbia',       'Sand',       'Sable',       'Sand',      'Arena'),         swatch: '#C9B388' },
      { id: 'greige',     label: t('Greige',       'Greige',     'Greige',      'Greige',    'Greige'),        swatch: '#8C8576' },
      { id: 'earth',      label: t('Terra',        'Earth',      'Terre',       'Erde',      'Tierra'),        swatch: '#7A4A2B' },
      { id: 'olive',      label: t('Oliva',        'Olive',      'Olive',       'Oliv',      'Oliva'),         swatch: '#6E7A4A' },
      { id: 'charcoal',   label: t('Antracite',    'Charcoal',   'Anthracite',  'Anthrazit', 'Antracita'),     swatch: '#2E2C28' },
    ],
  },

  // STEP 6 — LIFESTYLE
  step6: {
    eyebrow: t('Il tuo lifestyle', 'Your lifestyle', 'Votre mode de vie', 'Ihr Lifestyle', 'Tu estilo de vida'),
    title: t('Raccontaci\u00a0del tuo stile di vita', 'Tell us about your\u00a0lifestyle', 'Parlez-nous de votre\u00a0mode de vie', 'Erzählen Sie uns von\u00a0Ihrem Lifestyle', 'Cuéntanos sobre\u00a0tu estilo de vida'),
    body: t('Aiutaci a capire come vivi e cosa\u00a0conta davvero per te.', 'Help us understand how you live and what\u00a0matters most to you.', 'Aidez-nous à comprendre votre quotidien et\u00a0vos priorités.', 'Helfen Sie uns, Ihren Alltag zu verstehen.', 'Ayúdanos a entender cómo vives y qué\u00a0te importa.'),
    image: IMG('photo-1556909114-f6e7ad7d3136'),
    fields: [
      {
        id: 'feel',
        label: t('Come vuoi sentirti in questo spazio?', 'How do you want to feel in this space?', 'Comment voulez-vous vous sentir dans cet espace ?', 'Wie möchten Sie sich in diesem Raum fühlen?', '¿Cómo quieres sentirte en este espacio?'),
        placeholder: t('Calmo, ispirato, rilassato, sorpreso\u2026', 'Calm, inspired, relaxed, surprised\u2026', 'Calme, inspiré, détendu, surpris\u2026', 'Ruhig, inspiriert, entspannt, überrascht\u2026', 'Tranquilo, inspirado, relajado, sorprendido\u2026'),
      },
      {
        id: 'inspires',
        label: t('Cosa ti ispira di più?', 'What inspires you most?', 'Qu\u2019est-ce qui vous inspire le plus ?', 'Was inspiriert Sie am meisten?', '¿Qué te inspira más?'),
        placeholder: t('Viaggi, natura, arte, semplicità, design\u2026', 'Travel, nature, art, simplicity, design\u2026', 'Voyages, nature, art, simplicité, design\u2026', 'Reisen, Natur, Kunst, Einfachheit, Design\u2026', 'Viajes, naturaleza, arte, simplicidad\u2026'),
      },
      {
        id: 'atmosphere',
        label: t('Descrivi l\u2019atmosfera che immagini', 'Describe the atmosphere you imagine', 'Décrivez l\u2019atmosphère que vous imaginez', 'Beschreiben Sie die Atmosphäre, die Sie sich vorstellen', 'Describe la atmósfera que imaginas'),
        placeholder: t('Calda, luminosa, minimale, accogliente, sofisticata\u2026', 'Warm, bright, minimal, cozy, sophisticated\u2026', 'Chaude, lumineuse, minimale, cosy, sophistiquée\u2026', 'Warm, hell, minimal, gemütlich, sophisticated\u2026', 'Cálida, luminosa, mínima, acogedora\u2026'),
      },
    ],
  },

  // STEP 7 — BUDGET & TIMELINE
  step7: {
    eyebrow: t('Budget & tempi', 'Budget & timeline', 'Budget & timing', 'Budget & Zeitplan', 'Presupuesto y plazos'),
    title: t('Budget\u00a0& tempi', 'Budget\u00a0& timeline', 'Budget\u00a0& timing', 'Budget\u00a0& Zeitplan', 'Presupuesto\u00a0y plazos'),
    body: t('Le ultime informazioni\u00a0per organizzare al meglio il progetto.', 'The final pieces\u00a0to plan your project properly.', 'Les dernières informations\u00a0pour bien organiser le projet.', 'Die letzten Angaben\u00a0für die Projektplanung.', 'Las últimas piezas\u00a0para organizar el proyecto.'),
    image: IMG('photo-1505691938895-1758d7feb511'),
    timeline: {
      label: t('Tempistica del progetto', 'Project timeline', 'Calendrier du projet', 'Projektzeitraum', 'Calendario del proyecto'),
      placeholder: t('Seleziona un\u2019opzione', 'Select an option', 'Sélectionner une option', 'Bitte wählen', 'Selecciona una opción'),
      options: [
        { id: 'urgent',    label: t('Entro 1 mese',     'Within 1 month',     'Sous 1 mois',        'Innerhalb 1 Monat',      'En 1 mes') },
        { id: 'soon',      label: t('1\u20133 mesi',    '1\u20133 months',    '1\u20133 mois',      '1\u20133 Monate',        '1\u20133 meses') },
        { id: 'planned',   label: t('3\u20136 mesi',    '3\u20136 months',    '3\u20136 mois',      '3\u20136 Monate',        '3\u20136 meses') },
        { id: 'longterm',  label: t('Oltre 6 mesi',     'Over 6 months',      'Plus de 6 mois',     'Mehr als 6 Monate',      'Más de 6 meses') },
        { id: 'flexible',  label: t('Sono flessibile',  'I\u2019m flexible',  'Je suis flexible',   'Flexibel',               'Soy flexible') },
      ],
    },
    budget: {
      label: t('Budget stimato', 'Estimated budget', 'Budget estimé', 'Geschätztes Budget', 'Presupuesto estimado'),
      placeholder: t('Seleziona un\u2019opzione', 'Select an option', 'Sélectionner une option', 'Bitte wählen', 'Selecciona una opción'),
      options: [
        { id: 'b1', label: t('Fino a € 50.000',          'Up to € 50,000',          'Jusqu\u2019à € 50 000',         'Bis € 50.000',           'Hasta € 50.000') },
        { id: 'b2', label: t('€ 50.000 \u2013 150.000',  '€ 50,000 \u2013 150,000', '€ 50 000 \u2013 150 000',       '€ 50.000 \u2013 150.000','€ 50.000 \u2013 150.000') },
        { id: 'b3', label: t('€ 150.000 \u2013 500.000', '€ 150,000 \u2013 500,000','€ 150 000 \u2013 500 000',      '€ 150.000 \u2013 500.000','€ 150.000 \u2013 500.000') },
        { id: 'b4', label: t('Oltre € 500.000',          'Over € 500,000',          'Plus de € 500 000',             'Über € 500.000',         'Más de € 500.000') },
        { id: 'b5', label: t('Preferisco discuterne',    'I\u2019d rather discuss', 'Je préfère en discuter',        'Lieber besprechen',      'Prefiero conversarlo') },
      ],
    },
    startDate: {
      label: t('Quando vorresti iniziare?', 'When would you like to start?', 'Quand souhaitez-vous commencer ?', 'Wann möchten Sie beginnen?', '¿Cuándo te gustaría empezar?'),
      placeholder: t('Seleziona un\u2019opzione', 'Select an option', 'Sélectionner une option', 'Bitte wählen', 'Selecciona una opción'),
      options: [
        { id: 's1', label: t('Subito',                 'Immediately',         'Immédiatement',     'Sofort',                  'De inmediato') },
        { id: 's2', label: t('Entro 30 giorni',        'Within 30 days',      'Sous 30 jours',     'Innerhalb 30 Tage',       'En 30 días') },
        { id: 's3', label: t('Nel prossimo trimestre', 'Next quarter',        'Trimestre prochain','Nächstes Quartal',        'Próximo trimestre') },
        { id: 's4', label: t('Più avanti nell\u2019anno', 'Later this year',  'Plus tard dans l\u2019année', 'Später dieses Jahr', 'Más adelante este año') },
        { id: 's5', label: t('Sto solo esplorando',    'Just exploring',      'Je découvre',       'Erstmal erkunden',        'Estoy explorando') },
      ],
    },
    notes: {
      label: t('Qualcos\u2019altro che dovremmo sapere?', 'Anything else we should know?', 'Autre chose à savoir ?', 'Sonst etwas, das wir wissen sollten?', '¿Algo más que debamos saber?'),
      placeholder: t('Aggiungi qualsiasi dettaglio aggiuntivo\u2026', 'Add any additional details\u2026', 'Ajoutez tout détail supplémentaire\u2026', 'Weitere Details hinzufügen\u2026', 'Añade cualquier detalle adicional\u2026'),
    },
  },

  // ACCOUNT — Quick creation step before the cinematic Genesis transition
  account: {
    eyebrow: t('Crea il tuo accesso', 'Create your access', 'Créez votre accès', 'Erstelle deinen Zugang', 'Crea tu acceso'),
    title: t(
      'Un ultimo passaggio prima del tuo Blueprint.',
      'One last step before your Blueprint.',
      'Une dernière étape avant votre Blueprint.',
      'Ein letzter Schritt vor deinem Blueprint.',
      'Un último paso antes de tu Blueprint.',
    ),
    body: t(
      'Servono solo due dettagli per portarti dentro al tuo spazio.',
      'Just two details to bring you into your space.',
      'Seulement deux détails pour entrer dans votre espace.',
      'Nur zwei Angaben, um in deinen Raum zu gelangen.',
      'Solo dos datos para entrar en tu espacio.',
    ),
    fields: {
      firstName: t('Nome', 'First name', 'Prénom', 'Vorname', 'Nombre'),
      lastName:  t('Cognome', 'Last name', 'Nom', 'Nachname', 'Apellido'),
      email:     t('Email', 'Email', 'E-mail', 'E-Mail', 'Correo'),
      password:  t('Crea una password (min. 8 caratteri)', 'Create a password (min. 8 characters)', 'Créez un mot de passe (min. 8)', 'Erstelle ein Passwort (mind. 8)', 'Crea una contraseña (mín. 8)'),
    },
    submit: t('Apri il mio Blueprint', 'Open my Blueprint', 'Ouvrir mon Blueprint', 'Mein Blueprint öffnen', 'Abrir mi Blueprint'),
    consent: t(
      'Procedendo accetti i Termini di servizio e la Privacy Policy.',
      'By proceeding you accept the Terms and Privacy Policy.',
      'En continuant vous acceptez les Conditions et la Politique.',
      'Mit dem Fortfahren akzeptierst du AGB und Datenschutz.',
      'Al continuar aceptas los Términos y la Política.',
    ),
    errorEmail: t('Email non valida', 'Invalid email', 'E-mail invalide', 'Ungültige E-Mail', 'Correo no válido'),
    errorPasswordShort: t('Almeno 8 caratteri', 'At least 8 characters', 'Au moins 8 caractères', 'Mindestens 8 Zeichen', 'Al menos 8 caracteres'),
    errorEmailExists: t('Email già registrata', 'Email already registered', 'E-mail déjà enregistré', 'E-Mail bereits registriert', 'Correo ya registrado'),
    errorGeneric: t('Qualcosa è andato storto. Riprova.', 'Something went wrong. Try again.', 'Une erreur est survenue. Réessayez.', 'Etwas ist schief gelaufen. Erneut versuchen.', 'Algo salió mal. Inténtalo de nuevo.'),
  },

  // FINAL — Project ready
  final: {
    eyebrow: t('Il tuo progetto', 'Your project', 'Votre projet', 'Ihr Projekt', 'Tu proyecto'),
    title: t('Il tuo progetto\u00a0è quasi pronto.', 'Your project is\u00a0almost ready.', 'Votre projet est\u00a0presque prêt.', 'Ihr Projekt ist\u00a0fast bereit.', 'Tu proyecto está\u00a0casi listo.'),
    body: t('Ecco cosa abbiamo creato\u00a0per te.', 'Here\u2019s what we\u2019ve created\u00a0for you.', 'Voici ce que nous avons créé\u00a0pour vous.', 'Das haben wir für Sie\u00a0vorbereitet.', 'Esto es lo que hemos creado\u00a0para ti.'),
    items: [
      { id: 'lead_profile', icon: 'user', title: t('Lead profile', 'Lead profile', 'Profil du lead', 'Lead-Profil', 'Perfil de lead'), body: t('Le tue informazioni e una sintesi del progetto.', 'Your info and project overview.', 'Vos infos et un résumé du projet.', 'Ihre Daten und Projektübersicht.', 'Tu información y resumen del proyecto.') },
      { id: 'mood',         icon: 'palette', title: t('Direzione mood', 'Mood direction', 'Direction mood', 'Mood-Richtung', 'Dirección mood'), body: t('Lo stile e l\u2019atmosfera selezionati.', 'Your selected style and atmosphere.', 'Le style et l\u2019ambiance sélectionnés.', 'Ausgewählter Stil und Atmosphäre.', 'Estilo y atmósfera elegidos.') },
      { id: 'structure',    icon: 'layout', title: t('Struttura del progetto', 'Project structure', 'Structure du projet', 'Projektstruktur', 'Estructura del proyecto'), body: t('Spazi e aree da progettare.', 'Spaces and areas to design.', 'Espaces et zones à concevoir.', 'Räume und Bereiche zur Gestaltung.', 'Espacios y áreas a diseñar.') },
      { id: 'moodboard',    icon: 'images', title: t('Moodboard suggerite', 'Moodboard suggestions', 'Moodboards suggérés', 'Moodboard-Vorschläge', 'Moodboards sugeridos'), body: t('Pagine consigliate per la tua moodboard.', 'Suggested pages for your moodboard.', 'Pages suggérées pour votre moodboard.', 'Empfohlene Seiten für Ihr Moodboard.', 'Páginas sugeridas para tu moodboard.') },
      { id: 'proposal',     icon: 'file-text', title: t('Sezioni di proposta', 'Proposal sections', 'Sections de proposition', 'Angebotsabschnitte', 'Secciones de propuesta'), body: t('Struttura consigliata per la proposta.', 'Recommended structure for your proposal.', 'Structure recommandée pour votre proposition.', 'Empfohlene Angebotsstruktur.', 'Estructura recomendada para tu propuesta.') },
    ],
    primary: { label: t('Crea il tuo account', 'Create your account', 'Créer votre compte', 'Konto erstellen', 'Crea tu cuenta'), href: '/auth/login' },
    secondary: { label: t('Accedi al Blueprint', 'Access your Blueprint', 'Accéder au Blueprint', 'Blueprint betreten', 'Acceder al Blueprint'), href: '/auth/login' },
    note: t('La registrazione avviene\u00a0in modo sicuro tramite email.', 'Registration is secure\u00a0via email.', 'L\u2019inscription est sécurisée\u00a0par email.', 'Anmeldung erfolgt sicher\u00a0per E-Mail.', 'El registro es seguro\u00a0por email.'),
  },
};
