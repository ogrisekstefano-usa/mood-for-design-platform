// MOOD for DESIGN™ — Professionals (A&D Gateway) Content
// Mirrors future DB shape:
//   `cms_pages` { tenant_id, page_key='professionals' }
//   `cms_onboarding_flows` { tenant_id, key='professional', steps jsonb }
// Each tenant may override `studioExternal.url` from /settings/branding.

const t = (it, en, fr, de, es) => ({ it, en, fr, de, es, 'en-US': en, 'en-GB': en });
const IMG = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=2000&q=85`;

export const professionalsContent = {
  meta: {
    title: t(
      'Professionisti — MOOD for DESIGN\u2122',
      'Professionals — MOOD for DESIGN\u2122',
      'Professionnels — MOOD for DESIGN\u2122',
      'Fachleute — MOOD for DESIGN\u2122',
      'Profesionales — MOOD for DESIGN\u2122',
    ),
  },

  gateway: {
    backgroundImage: IMG('photo-1600210491892-03d54c0aaf87'),
    eyebrow: t('Per i professionisti', 'For professionals', 'Pour les professionnels', 'Für Fachleute', 'Para profesionales'),
    headline: t(
      'Relazioni di design\nsenza confini.',
      'Design relationships\nwithout borders.',
      'Relations de design\nsans frontières.',
      'Design-Beziehungen\nohne Grenzen.',
      'Relaciones de diseño\nsin fronteras.',
    ),
    sub: t(
      'Un ecosistema editoriale internazionale per showroom, studi di architettura, interior designer, procurement, contractor e developer. Connettiamo progetti, materiali e persone.',
      'An international editorial ecosystem for showrooms, architecture studios, interior designers, procurement, contractors and developers. We connect projects, materials and people.',
      'Un écosystème éditorial international pour showrooms, studios d\u2019architecture, designers d\u2019intérieur, procurement, contractors et développeurs.',
      'Ein internationales redaktionelles Ökosystem für Showrooms, Architekturbüros, Interior Designer, Procurement, Contractors und Entwickler.',
      'Un ecosistema editorial internacional para showrooms, estudios de arquitectura, interioristas, procurement, contractors y desarrolladores.',
    ),
    ctas: {
      explore: {
        kicker: t('01 — Visita lo studio', '01 — Visit the studio', '01 — Visiter le studio', '01 — Studio besuchen', '01 — Visita el estudio'),
        title:  t('Scopri lo showroom', 'Explore the studio', 'Découvrir le studio', 'Studio entdecken', 'Descubre el estudio'),
        body:   t('Vedi i nostri progetti, le collezioni, l\u2019identità del brand.', 'See our projects, collections, brand identity.', 'Découvrez nos projets, collections, identité.', 'Sehen Sie unsere Projekte und Kollektionen.', 'Conoce nuestros proyectos y colecciones.'),
        label:  t('Esplora lo studio', 'Explore the studio', 'Explorer le studio', 'Studio entdecken', 'Explorar el estudio'),
        // URL comes from tenant config (see tenant.js). Falls back to /projects if unset.
      },
      start: {
        kicker: t('02 — Avvia un progetto', '02 — Start a project', '02 — Démarrer un projet', '02 — Projekt starten', '02 — Iniciar proyecto'),
        title:  t('Avvia una collaborazione professionale', 'Start a professional project', 'Démarrer un projet professionnel', 'Professionelles Projekt starten', 'Iniciar proyecto profesional'),
        body:   t('Sourcing arredi, materiali, FF&E, partnership creativa, supporto progettuale.', 'Furniture sourcing, materials, FF&E, creative partnership, design support.', 'Sourcing mobilier, matériaux, FF&E, partenariat créatif.', 'Möbel-Sourcing, Materialien, FF&E, kreative Partnerschaft.', 'Sourcing de muebles, materiales, FF&E, asociación creativa.'),
        label:  t('Avvia un progetto', 'Start a project', 'Démarrer un projet', 'Projekt starten', 'Iniciar proyecto'),
        href:   '/professionals/intake',
      },
      access: {
        kicker: t('03 — Accedi al Workspace', '03 — Access Workspace', '03 — Accès Workspace', '03 — Workspace betreten', '03 — Acceso Workspace'),
        title:  t('Accedi al Blueprint Workspace', 'Access Blueprint Workspace', 'Accéder au Blueprint Workspace', 'Blueprint Workspace betreten', 'Acceder al Blueprint Workspace'),
        body:   t('Per professionisti già registrati: moodboard, sourcing, proposte editoriali.', 'For registered professionals: moodboards, sourcing, editorial proposals.', 'Pour les pros enregistrés : moodboards, sourcing, propositions.', 'Für registrierte Profis: Moodboards, Sourcing, Angebote.', 'Para pros registrados: moodboards, sourcing, propuestas.'),
        label:  t('Accedi', 'Sign in', 'Connexion', 'Anmelden', 'Acceder'),
        href:   '/auth/login',
      },
    },
  },

  intake: {
    meta: {
      eyebrow: t('Step {n} di {total}', 'Step {n} of {total}', 'Étape {n} sur {total}', 'Schritt {n} von {total}', 'Paso {n} de {total}'),
      back: t('Indietro', 'Back', 'Retour', 'Zurück', 'Atrás'),
      continue: t('Continua', 'Continue', 'Continuer', 'Weiter', 'Continuar'),
      submit: t('Invia richiesta', 'Submit request', 'Envoyer', 'Senden', 'Enviar solicitud'),
      exitConfirm: t('Sei sicuro di voler uscire? I dati sono salvati localmente.', 'Are you sure? Inputs saved locally.', 'Voulez-vous quitter ?', 'Wirklich beenden?', '¿Seguro?'),
    },
    step1: {
      eyebrow: t('Intento', 'Intent', 'Intention', 'Anliegen', 'Intención'),
      title: t('Cosa stai cercando?', 'What are you looking for?', 'Que recherchez-vous ?', 'Was suchen Sie?', '¿Qué buscas?'),
      body: t('Selezionane uno o più — ci aiuta a indirizzarti.', 'Select one or more — it helps us route your request.', 'Sélectionnez-en un ou plusieurs.', 'Wählen Sie eine oder mehrere Optionen.', 'Selecciona uno o más.'),
      options: [
        { id: 'furniture',     label: t('Sourcing arredi',           'Furniture sourcing',         'Sourcing mobilier',          'Möbel-Sourcing',            'Sourcing de muebles') },
        { id: 'materials',     label: t('Sourcing materiali',        'Material sourcing',          'Sourcing matériaux',         'Material-Sourcing',         'Sourcing de materiales') },
        { id: 'collaboration', label: t('Collaborazione progettuale','Project collaboration',      'Collaboration projet',       'Projekt-Kollaboration',     'Colaboración en proyecto') },
        { id: 'partnership',   label: t('Partnership di interior',   'Interior design partnership','Partenariat design',         'Interior-Partnerschaft',    'Partnership de interior') },
        { id: 'ffe',           label: t('Procurement FF&E',          'FF&E procurement',           'Procurement FF&E',           'FF&E-Beschaffung',          'Procurement FF&E') },
        { id: 'hospitality',   label: t('Progetto hospitality',      'Hospitality project',        'Projet hospitality',         'Hospitality-Projekt',       'Proyecto hospitality') },
        { id: 'residential',   label: t('Progetto residenziale',     'Residential project',        'Projet résidentiel',         'Wohnprojekt',               'Proyecto residencial') },
        { id: 'retail',        label: t('Progetto retail',           'Retail project',             'Projet retail',              'Retail-Projekt',            'Proyecto retail') },
        { id: 'other',         label: t('Altro',                     'Other',                      'Autre',                      'Sonstiges',                 'Otro') },
      ],
    },
    step2: {
      eyebrow: t('Progetto', 'Project', 'Projet', 'Projekt', 'Proyecto'),
      title: t('Informazioni progetto', 'Project information', 'Informations projet', 'Projektinformationen', 'Información del proyecto'),
      body: t('Le informazioni essenziali per organizzare il lavoro.', 'The essentials so we can organize the work.', 'L\u2019essentiel pour organiser le travail.', 'Das Wesentliche für die Organisation.', 'Lo esencial para organizar.'),
      fields: {
        projectName: { label: t('Nome del progetto', 'Project name', 'Nom du projet', 'Projektname', 'Nombre del proyecto'), placeholder: t('Es. Hotel Mare di Sera', 'e.g. Hotel Mare di Sera', 'Ex. Hôtel Mare di Sera', 'z. B. Hotel Mare di Sera', 'Ej. Hotel Mare di Sera') },
        location:    { label: t('Località', 'Location', 'Lieu', 'Ort', 'Ubicación'), placeholder: t('Città, Paese', 'City, Country', 'Ville, Pays', 'Stadt, Land', 'Ciudad, País') },
        type: {
          label: t('Tipologia', 'Project type', 'Typologie', 'Projektart', 'Tipología'),
          placeholder: t('Seleziona', 'Select', 'Sélectionner', 'Auswählen', 'Selecciona'),
          options: [
            { id: 'hospitality', label: t('Hospitality', 'Hospitality', 'Hospitality', 'Hospitality', 'Hospitality') },
            { id: 'residential', label: t('Residenziale', 'Residential', 'Résidentiel', 'Wohnen', 'Residencial') },
            { id: 'retail',      label: t('Retail',       'Retail',      'Retail',      'Retail',     'Retail') },
            { id: 'office',      label: t('Office',       'Office',      'Bureau',      'Büro',       'Oficina') },
            { id: 'wellness',    label: t('Wellness',     'Wellness',    'Bien-être',   'Wellness',   'Wellness') },
            { id: 'mixed',       label: t('Mixed-use',    'Mixed-use',   'Mixte',       'Mixed-use',  'Uso mixto') },
          ],
        },
        timeline: {
          label: t('Tempistica prevista', 'Expected timeline', 'Calendrier prévu', 'Erwarteter Zeitplan', 'Calendario previsto'),
          placeholder: t('Seleziona', 'Select', 'Sélectionner', 'Auswählen', 'Selecciona'),
          options: [
            { id: 't1', label: t('Entro 3 mesi',  'Within 3 months',  'Sous 3 mois',  'Innerhalb 3 Monate',  'En 3 meses') },
            { id: 't2', label: t('3\u20136 mesi',  '3\u20136 months',  '3\u20136 mois', '3\u20136 Monate',     '3\u20136 meses') },
            { id: 't3', label: t('6\u201312 mesi', '6\u201312 months', '6\u201312 mois','6\u201312 Monate',    '6\u201312 meses') },
            { id: 't4', label: t('Oltre 12 mesi', 'Over 12 months',   'Plus de 12 mois','Mehr als 12 Monate','Más de 12 meses') },
          ],
        },
        budget: {
          label: t('Range di budget stimato', 'Estimated budget range', 'Fourchette budgétaire', 'Geschätztes Budget', 'Rango de presupuesto'),
          placeholder: t('Seleziona', 'Select', 'Sélectionner', 'Auswählen', 'Selecciona'),
          options: [
            { id: 'b1', label: t('Fino a € 100K', 'Up to € 100K', 'Jusqu\u2019à € 100K', 'Bis € 100K', 'Hasta € 100K') },
            { id: 'b2', label: t('€ 100K \u2013 500K', '€ 100K \u2013 500K', '€ 100K \u2013 500K', '€ 100K \u2013 500K', '€ 100K \u2013 500K') },
            { id: 'b3', label: t('€ 500K \u2013 2M', '€ 500K \u2013 2M', '€ 500K \u2013 2M', '€ 500K \u2013 2M', '€ 500K \u2013 2M') },
            { id: 'b4', label: t('Oltre € 2M', 'Over € 2M', 'Plus de € 2M', 'Über € 2M', 'Más de € 2M') },
            { id: 'b5', label: t('Da definire', 'TBD', 'À définir', 'Offen', 'Por definir') },
          ],
        },
      },
    },
    step3: {
      eyebrow: t('Direzione', 'Direction', 'Direction', 'Richtung', 'Dirección'),
      title: t('Direzione di design', 'Design direction', 'Direction design', 'Design-Richtung', 'Dirección de diseño'),
      body: t('Carica planimetrie, references, PDF, moodboard, link Pinterest. Tutto verrà collegato al progetto.', 'Upload plans, references, PDFs, moodboards, Pinterest links. All linked to your project.', 'Téléchargez plans, références, PDFs, moodboards.', 'Pläne, Referenzen, PDFs, Moodboards hochladen.', 'Sube planos, referencias, PDFs, moodboards.'),
      tabs: [
        { id: 'upload', label: t('Carica',     'Upload',    'Télécharger', 'Hochladen', 'Subir') },
        { id: 'link',   label: t('Link',       'Link',      'Lien',        'Link',      'Enlace') },
      ],
      addMore: t('Aggiungi', 'Add more', 'Ajouter', 'Hinzufügen', 'Añadir'),
      placeholder: t('Incolla un link\u2026', 'Paste a link\u2026', 'Collez un lien\u2026', 'Link einfügen\u2026', 'Pega un enlace\u2026'),
      empty: t('I file e i link appariranno qui.', 'Files and links will appear here.', 'Les fichiers apparaîtront ici.', 'Dateien erscheinen hier.', 'Los archivos aparecerán aquí.'),
    },
    step4: {
      eyebrow: t('Professionista', 'Professional', 'Professionnel', 'Fachperson', 'Profesional'),
      title: t('I tuoi dati professionali', 'Your professional details', 'Vos coordonnées pro', 'Ihre beruflichen Daten', 'Tus datos profesionales'),
      body: t('Per riconoscerti come partner — non come lead generico.', 'So we recognize you as a partner, not a generic lead.', 'Pour vous reconnaître comme partenaire.', 'Damit wir Sie als Partner erkennen.', 'Para reconocerte como partner.'),
      fields: {
        company: { label: t('Studio / Azienda', 'Studio / Company', 'Studio / Société', 'Studio / Unternehmen', 'Estudio / Empresa'), placeholder: t('Es. Studio Beltrame', 'e.g. Studio Beltrame', 'Ex. Studio Beltrame', 'z. B. Studio Beltrame', 'Ej. Studio Beltrame') },
        role:    { label: t('Ruolo', 'Role', 'Rôle', 'Rolle', 'Rol'), placeholder: t('Architetto / Interior Designer / Procurement\u2026', 'Architect / Interior Designer / Procurement\u2026', 'Architecte / Designer / Procurement\u2026', 'Architekt / Designer / Procurement\u2026', 'Arquitecto / Interiorista / Procurement\u2026') },
        email:   { label: t('Email', 'Email', 'Email', 'E-Mail', 'Email'), placeholder: t('nome@studio.com', 'name@studio.com', 'nom@studio.com', 'name@studio.com', 'nombre@estudio.com') },
        website: { label: t('Sito web', 'Website', 'Site web', 'Webseite', 'Sitio web'), placeholder: t('https://\u2026', 'https://\u2026', 'https://\u2026', 'https://\u2026', 'https://\u2026') },
        instagram:{ label: t('Instagram', 'Instagram', 'Instagram', 'Instagram', 'Instagram'), placeholder: t('@studio', '@studio', '@studio', '@studio', '@studio') },
        phone:   { label: t('Telefono', 'Phone', 'Téléphone', 'Telefon', 'Teléfono'), placeholder: t('+39 \u2026', '+1 \u2026', '+33 \u2026', '+49 \u2026', '+34 \u2026') },
        country: { label: t('Paese', 'Country', 'Pays', 'Land', 'País'), placeholder: t('Italia', 'Italy', 'Italie', 'Italien', 'Italia') },
        language:{ label: t('Lingua preferita', 'Preferred language', 'Langue préférée', 'Bevorzugte Sprache', 'Idioma preferido'), placeholder: t('Seleziona', 'Select', 'Sélectionner', 'Auswählen', 'Selecciona') },
      },
    },
    step5: {
      eyebrow: t('Conferma', 'Confirmation', 'Confirmation', 'Bestätigung', 'Confirmación'),
      title: t('La tua richiesta\u00a0di collaborazione è pronta.', 'Your collaboration\u00a0request is ready.', 'Votre demande\u00a0de collaboration est prête.', 'Ihre Kollaborations-Anfrage\u00a0ist bereit.', 'Tu solicitud de\u00a0colaboración está lista.'),
      body: t('Un membro del nostro team A&D ti contatterà entro 48 ore.', 'A member of our A&D team will reach out within 48 hours.', 'Un membre de l\u2019équipe A&D vous contactera sous 48h.', 'Ein A&D-Team-Mitglied meldet sich innerhalb 48 h.', 'Un miembro del equipo A&D te contactará en 48h.'),
      sectionLabels: {
        intent:    t('Intento selezionato',       'Selected intent',         'Intention',        'Anliegen',           'Intención'),
        project:   t('Panoramica progetto',       'Project overview',        'Aperçu du projet', 'Projektübersicht',   'Resumen del proyecto'),
        materials: t('Riferimenti caricati',      'References uploaded',     'Références',       'Referenzen',         'Referencias'),
        next:      t('Prossimi passi',            'Next steps',              'Prochaines étapes','Nächste Schritte',   'Siguientes pasos'),
      },
      nextSteps: [
        t('Verifica del team A&D entro 24 ore', 'A&D team review within 24 hours', 'Vérification A&D sous 24 h', 'A&D-Prüfung in 24 h', 'Revisión A&D en 24h'),
        t('Call di allineamento — opzionale',   'Alignment call — optional',       'Call de cadrage — optionnel','Abstimmungs-Call — optional','Call de alineamiento — opcional'),
        t('Accesso al Blueprint Workspace dedicato', 'Dedicated Blueprint Workspace access', 'Accès Blueprint dédié', 'Eigener Blueprint-Zugang', 'Acceso a Blueprint dedicado'),
      ],
      ctaPrimary: t('Continua al Blueprint', 'Continue to Blueprint', 'Continuer vers Blueprint', 'Weiter zu Blueprint', 'Continuar a Blueprint'),
      ctaSecondary: t('Richiedi collaborazione', 'Request collaboration', 'Demander la collaboration', 'Kollaboration anfragen', 'Solicitar colaboración'),
    },
  },
};
