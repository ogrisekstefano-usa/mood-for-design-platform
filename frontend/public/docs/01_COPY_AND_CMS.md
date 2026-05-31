# MOOD for DESIGN™ — Studio Activation Flow v2
## Documento 01 · Copy Audit, Tone of Voice, CMS & Translation Strategy

> **Stato**: DESIGN ONLY · in attesa di approvazione
> **Versione**: 2026-05-31

---

## 1. Tone of Voice — Regole editoriali

### Cosa MOOD NON è
| Tono da evitare | Esempio (v1) | Perché è sbagliato |
|---|---|---|
| Aulico/teatrale | "Dove prende forma il vostro lavoro" | Suona finto luxury |
| Poetico/cerimoniale | "Apri un nuovo capitolo del tuo studio" | Da brochure profumeria |
| Autocelebrativo | "Il vostro ecosistema è pronto" | L'utente non sa cosa sia un ecosistema MOOD |
| Tecnico-criptico | "Il temperamento del vostro workflow" | Privo di significato concreto |
| Italianizzante | "Atelier" / "Curatoriale" usati ovunque | Non traducibili senza ridicolo in EN/DE |

### Cosa MOOD È
**MOOD è professionale, contemporaneo, essenziale, internazionale, concreto.**

| Valore | Implicazione concreta |
|---|---|
| **Chiarezza** | Niente metafore. "Sede" non "Dove prende forma il lavoro". |
| **Precisione** | Numeri, fatti, ruoli definiti. |
| **Calma** | Frasi brevi, no esclamativi, no urgenza fittizia. |
| **Controllo** | L'utente sa sempre cosa sta facendo e cosa succederà dopo. |
| **Competenza** | Vocabolario di industry (studio, mercato, referente) non emotivo. |
| **Sobrietà** | No "★ esclusivo ★", no "magic", no "atelier digitale". |
| **Autorevolezza** | Dichiarazioni semplici, mai vendute. |

### Editorial test (obbligatorio per ogni copy)
> **Lo direi davvero, in italiano corrente, davanti al titolare di uno showroom milanese, a un architetto di Madrid o a un Brand Manager americano — senza sentirmi ridicolo?**
>
> Se NO → riscrivere.

### Positioning di MOOD
> MOOD è una piattaforma che organizza e registra ogni fase del rapporto tra professionista, cliente, materiali e progetto.

- Concetti chiave ammessi: **flow, design journey, decisioni, materiali, progetto, relazione cliente, continuità operativa**
- Concetti da NON sovraesporre: **moodboard, ecosistema, atelier, curatoriale, temperamento, blueprint, ritual, journey come termine isolato**

---

## 2. Translation Key Naming Convention

### Pattern
```
studio.activation.v2.<movement>.<element>[.<sub>]
```

| Segmento | Valori validi | Esempio |
|---|---|---|
| `studio.activation.v2` | namespace fisso | — |
| `<movement>` | `landing`, `m1`, `m2`, `m3`, `m4`, `m5`, `submit`, `success`, `errors`, `nav`, `email` | `m4` |
| `<element>` | `title`, `subtitle`, `eyebrow`, `helper`, `cta`, `field.<name>.label`, `field.<name>.placeholder`, `cat.<slug>.title`, `cat.<slug>.desc` | `field.email.label` |
| `<sub>` | opzionale (varianti, stati) | `helper`, `success`, `error` |

### Esempi
```
studio.activation.v2.m1.title
studio.activation.v2.m1.subtitle
studio.activation.v2.m1.cta_next
studio.activation.v2.m1.cat.interior_design_studio.title
studio.activation.v2.m1.cat.interior_design_studio.desc
studio.activation.v2.m4.field.email.label
studio.activation.v2.m4.field.email.placeholder
studio.activation.v2.m4.field.email.helper
studio.activation.v2.errors.email_taken
studio.activation.v2.errors.subdomain_reserved
studio.activation.v2.success.title
studio.activation.v2.success.cta_home
studio.activation.v2.email.ack.subject
studio.activation.v2.email.ack.body
```

### Storage
- Tabella esistente: `site_blocks` (namespace + block_key) + `block_localizations` (locale → value)
- Nuovo namespace: `studio.activation.v2`
- Tipo: `text` per single-line, `markdown` per multi-line (paragrafi, email body)
- Source locale: `it` (sorgente primaria) — fallback finale: `en-us`

### Fallback cascade
```
locale richiesto (es. fr)
  → se mancante → en-us
  → se mancante → it (source)
  → se mancante → key string stessa (visible bug indicator)
```

---

## 3. Copy Audit — Vecchio vs Nuovo

> **Legenda colonne**:
> - **Old** = testo attualmente presente in v1 (hardcoded o in `site_blocks` legacy)
> - **New (IT)** = proposta v2 in italiano
> - **Key** = chiave CMS finale
> - Le traduzioni EN/FR/DE/ES sono nella sezione §4

### 3.1 Landing & Navigation

| Old | New (IT) | Key |
|---|---|---|
| "Apri un nuovo capitolo del tuo studio" | "Candida il tuo studio a MOOD." | `studio.activation.v2.landing.headline` |
| "Inizia il percorso editoriale" | "Compila la richiesta in 3 minuti. Un Advisor MOOD ti contatterà." | `studio.activation.v2.landing.subheadline` |
| "Inizia" | "Inizia" | `studio.activation.v2.landing.cta_start` |
| (nuovo) | "Hai già un account? Accedi" | `studio.activation.v2.landing.link_signin` |
| "Indietro" | "Indietro" | `studio.activation.v2.nav.back` |
| "Avanti" | "Avanti" | `studio.activation.v2.nav.next` |
| "Salva e continua dopo" | "Riprendi più tardi" | `studio.activation.v2.nav.save_resume` |

### 3.2 Movimento 1 — Identità professionale

| Old | New (IT) | Key |
|---|---|---|
| "Chi entrerà in MOOD?" / "Chi guiderà l'esperienza?" | "Categoria professionale" | `studio.activation.v2.m1.title` |
| "Ogni studio ha una propria identità. Iniziamo da qui." | "Seleziona la categoria che descrive meglio il tuo studio." | `studio.activation.v2.m1.subtitle` |
| (eyebrow) | "01 / 05" | `studio.activation.v2.m1.eyebrow` |
| "Studio di Interior Design" | "Studio di interior design" | `studio.activation.v2.m1.cat.interior_design_studio.title` |
| "Studio di Architettura" | "Studio di architettura" | `studio.activation.v2.m1.cat.architecture_studio.title` |
| "Showroom" | "Showroom multibrand" | `studio.activation.v2.m1.cat.multibrand_showroom.title` |
| (nuovo) | "Retail design" | `studio.activation.v2.m1.cat.retail_design.title` |
| (nuovo) | "Stone & surface specialist" | `studio.activation.v2.m1.cat.stone_surface_specialist.title` |
| (nuovo) | "Contract & hospitality" | `studio.activation.v2.m1.cat.contract_hospitality.title` |
| (nuovo) | "Furniture brand" | `studio.activation.v2.m1.cat.furniture_brand.title` |
| (nuovo) | "Material brand" | `studio.activation.v2.m1.cat.material_brand.title` |

**Descrizione card** (opzionale, 1 riga sotto il titolo, max 80 char):
| Key | Testo (IT) |
|---|---|
| `…cat.interior_design_studio.desc` | "Progetti residenziali, retail, hospitality" |
| `…cat.architecture_studio.desc` | "Architettura, ristrutturazioni, masterplan" |
| `…cat.multibrand_showroom.desc` | "Spazio espositivo con brand multipli" |
| `…cat.retail_design.desc` | "Concept e progettazione punti vendita" |
| `…cat.stone_surface_specialist.desc` | "Marmi, pietre naturali, superfici tecniche" |
| `…cat.contract_hospitality.desc` | "Forniture per hotel, ristoranti, uffici" |
| `…cat.furniture_brand.desc` | "Produzione e distribuzione arredamento" |
| `…cat.material_brand.desc` | "Produzione di materiali e finiture" |

### 3.3 Movimento 2 — Sede e mercato operativo

| Old | New (IT) | Key |
|---|---|---|
| "Dove prende forma il vostro lavoro?" | "Sede e mercato operativo" | `studio.activation.v2.m2.title` |
| (nuovo) | "Dove ha sede lo studio e in quali lingue operate." | `studio.activation.v2.m2.subtitle` |
| (nuovo) | "Nazione" | `studio.activation.v2.m2.field.country.label` |
| (nuovo) | "Seleziona una nazione" | `studio.activation.v2.m2.field.country.placeholder` |
| (nuovo) | "Città" | `studio.activation.v2.m2.field.city.label` |
| (nuovo) | "Inizia a digitare il nome della città" | `studio.activation.v2.m2.field.city.placeholder` |
| (nuovo) | "Suggerimenti forniti da Mapbox" | `studio.activation.v2.m2.field.city.helper` |
| (nuovo) | "Lingue operative" | `studio.activation.v2.m2.field.languages.label` |
| (nuovo) | "Seleziona da 1 a 6 lingue" | `studio.activation.v2.m2.field.languages.placeholder` |
| (nuovo) | "Le lingue in cui interagite con clienti e fornitori." | `studio.activation.v2.m2.field.languages.helper` |

### 3.4 Movimento 3 — Priorità operative

| Old (rimosso) | New (IT) | Key |
|---|---|---|
| (nuovo) | "Priorità operative" | `studio.activation.v2.m3.title` |
| (nuovo) | "Cosa vorresti migliorare per primo? Seleziona da 1 a 4 voci." | `studio.activation.v2.m3.subtitle` |
| (nuovo) | "Generare nuovi contatti" | `studio.activation.v2.m3.goal.new_leads.title` |
| (nuovo) | "Trovare clienti, partner e fornitori in modo organizzato." | `studio.activation.v2.m3.goal.new_leads.desc` |
| (nuovo) | "Organizzare relazioni e clienti" | `studio.activation.v2.m3.goal.relationship_mgmt.title` |
| (nuovo) | "Tenere traccia di contatti, conversazioni, progetti." | `studio.activation.v2.m3.goal.relationship_mgmt.desc` |
| (nuovo) | "Gestire materiali e fornitori" | `studio.activation.v2.m3.goal.materials_suppliers.title` |
| (nuovo) | "Catalogare materiali, finiture, schede tecniche e listini." | `studio.activation.v2.m3.goal.materials_suppliers.desc` |
| (nuovo) | "Migliorare la presentazione dei progetti" | `studio.activation.v2.m3.goal.project_presentation.title` |
| (nuovo) | "Presentare proposte, moodboard e selezioni al cliente." | `studio.activation.v2.m3.goal.project_presentation.desc` |
| (nuovo) | "Coordinare il lavoro del team" | `studio.activation.v2.m3.goal.team_coordination.title` |
| (nuovo) | "Gestire ruoli, task e fasi del progetto." | `studio.activation.v2.m3.goal.team_coordination.desc` |
| (nuovo) | "Costruire un ecosistema digitale per lo studio" | `studio.activation.v2.m3.goal.digital_ecosystem.title` |
| (nuovo) | "Un'unica piattaforma per il lavoro quotidiano dello studio." | `studio.activation.v2.m3.goal.digital_ecosystem.desc` |

### 3.5 Movimento 4 — Referente principale

| Old | New (IT) | Key |
|---|---|---|
| "Chi guiderà l'esperienza?" | "Referente principale" | `studio.activation.v2.m4.title` |
| (nuovo) | "La persona che dialogherà con l'Advisor MOOD." | `studio.activation.v2.m4.subtitle` |
| (nuovo) | "Nome" | `studio.activation.v2.m4.field.first_name.label` |
| (nuovo) | "Cognome" | `studio.activation.v2.m4.field.last_name.label` |
| (nuovo) | "Ruolo" | `studio.activation.v2.m4.field.role_title.label` |
| (nuovo) | "Es. Founder, Senior Designer, Buyer" | `studio.activation.v2.m4.field.role_title.placeholder` |
| (nuovo) | "Email professionale" | `studio.activation.v2.m4.field.email.label` |
| (nuovo) | "nome@studio.com" | `studio.activation.v2.m4.field.email.placeholder` |
| (nuovo) | "Useremo questa email per contattarti e per il login futuro." | `studio.activation.v2.m4.field.email.helper` |
| (nuovo) | "Prefisso" | `studio.activation.v2.m4.field.phone_prefix.label` |
| (nuovo) | "Telefono" | `studio.activation.v2.m4.field.phone_number.label` |

### 3.6 Movimento 5 — Identità del tenant

| Old | New (IT) | Key |
|---|---|---|
| "Come si chiamerà il vostro spazio?" | "Identità del tenant" | `studio.activation.v2.m5.title` |
| (nuovo) | "Il nome del tuo studio e l'indirizzo MOOD dedicato." | `studio.activation.v2.m5.subtitle` |
| (nuovo) | "Nome dello studio" | `studio.activation.v2.m5.field.studio_name.label` |
| (nuovo) | "Es. Atelier Martinel" | `studio.activation.v2.m5.field.studio_name.placeholder` |
| (nuovo) | "Subdomain" | `studio.activation.v2.m5.field.subdomain.label` |
| (nuovo) | "atelier-martinel" | `studio.activation.v2.m5.field.subdomain.placeholder` |
| (nuovo) | "Sarà l'indirizzo del tuo workspace. Modificabile prima dell'attivazione." | `studio.activation.v2.m5.field.subdomain.helper` |
| (nuovo) | "Disponibile" | `studio.activation.v2.m5.field.subdomain.status.available` |
| (nuovo) | "Non disponibile" | `studio.activation.v2.m5.field.subdomain.status.unavailable` |
| (nuovo) | "Riservato" | `studio.activation.v2.m5.field.subdomain.status.reserved` |

### 3.7 Submit & Success

| Old | New (IT) | Key |
|---|---|---|
| "Invia" | "Invia richiesta" | `studio.activation.v2.submit.cta` |
| (nuovo) | "Stiamo registrando la tua richiesta…" | `studio.activation.v2.submit.loading` |
| "Il vostro ecosistema è pronto." | "Richiesta ricevuta" | `studio.activation.v2.success.title` |
| (nuovo) | "Codice riferimento: {reference}" | `studio.activation.v2.success.reference` |
| "Un Advisor MOOD analizzerà la candidatura…" | "Un Advisor MOOD analizzerà la richiesta e ti contatterà entro 2 giorni lavorativi." | `studio.activation.v2.success.body` |
| (nuovo) | "Riceverai a breve un'email di conferma a {email}." | `studio.activation.v2.success.email_ack` |
| "Torna alla home" | "Torna alla home" | `studio.activation.v2.success.cta_home` |

### 3.8 Errori & Validazioni

| Stato | New (IT) | Key |
|---|---|---|
| Campo required vuoto | "Questo campo è obbligatorio." | `studio.activation.v2.errors.required` |
| Email formato | "Inserisci un'email valida." | `studio.activation.v2.errors.email_invalid` |
| Email duplicata | "Questa email è già associata a un account esistente." | `studio.activation.v2.errors.email_taken` |
| Email check fallito (transient) | "Verifica in corso, riprova fra qualche secondo." | `studio.activation.v2.errors.email_check_failed` |
| Telefono formato | "Numero di telefono non valido." | `studio.activation.v2.errors.phone_invalid` |
| Subdomain formato | "Usa solo lettere minuscole, numeri e trattini (3–30 caratteri)." | `studio.activation.v2.errors.subdomain_format` |
| Subdomain in uso | "Questo indirizzo è già richiesto. Scegline un altro." | `studio.activation.v2.errors.subdomain_taken` |
| Subdomain riservato | "Questo nome è riservato. Scegline un altro." | `studio.activation.v2.errors.subdomain_reserved` |
| Subdomain check fallito | "Verifica in corso, riprova fra qualche secondo." | `studio.activation.v2.errors.subdomain_check_failed` |
| Categoria mancante | "Seleziona una categoria per continuare." | `studio.activation.v2.errors.studio_type_required` |
| Lingue mancanti | "Seleziona almeno una lingua." | `studio.activation.v2.errors.languages_required` |
| Lingue troppe | "Massimo 6 lingue." | `studio.activation.v2.errors.languages_too_many` |
| Goals mancanti | "Seleziona almeno una priorità." | `studio.activation.v2.errors.goals_required` |
| Goals troppi | "Massimo 4 priorità." | `studio.activation.v2.errors.goals_too_many` |
| Network/5xx | "Connessione interrotta. Riprova tra poco." | `studio.activation.v2.errors.network` |
| Submit fallito | "Non siamo riusciti a registrare la richiesta. Riprova o contatta il supporto." | `studio.activation.v2.errors.submit_failed` |

### 3.9 Email Transactional (Resend)

#### Acknowledge founder
| Key | Testo (IT) |
|---|---|
| `studio.activation.v2.email.ack.subject` | "Abbiamo ricevuto la tua richiesta — {reference}" |
| `studio.activation.v2.email.ack.preheader` | "Un Advisor MOOD ti contatterà entro 2 giorni lavorativi." |
| `studio.activation.v2.email.ack.greeting` | "Ciao {first_name}," |
| `studio.activation.v2.email.ack.body` | (markdown — 4–5 righe, sotto) |
| `studio.activation.v2.email.ack.signoff` | "Il team MOOD for DESIGN" |

**Body (markdown, IT)**:
```
Grazie per aver candidato **{studio_name}** a MOOD for DESIGN.

Abbiamo registrato la tua richiesta con il codice **{reference}**.

Un Advisor MOOD analizzerà la candidatura e ti contatterà
entro 2 giorni lavorativi all'indirizzo {email}.

Nel frattempo, se hai domande puoi rispondere a questa email.
```

---

## 4. Traduzioni — IT / EN / FR / DE / ES

> Tutte le chiavi del §3 vanno tradotte. Qui sotto le 25 chiavi più visibili. Le restanti seguono lo stesso registro (essenziale, professionale).

### 4.1 Landing & Movimenti — titoli/sottotitoli

| Key | IT | EN-US | FR | DE | ES |
|---|---|---|---|---|---|
| `landing.headline` | Candida il tuo studio a MOOD. | Apply your studio to MOOD. | Présentez votre studio à MOOD. | Bewerben Sie Ihr Studio bei MOOD. | Postula tu estudio a MOOD. |
| `landing.subheadline` | Compila la richiesta in 3 minuti. Un Advisor MOOD ti contatterà. | Complete the request in 3 minutes. A MOOD Advisor will contact you. | Remplissez la demande en 3 minutes. Un Advisor MOOD vous contactera. | Antrag in 3 Minuten ausfüllen. Ein MOOD Advisor meldet sich. | Completa la solicitud en 3 minutos. Un Advisor MOOD te contactará. |
| `m1.title` | Categoria professionale | Professional category | Catégorie professionnelle | Berufskategorie | Categoría profesional |
| `m1.subtitle` | Seleziona la categoria che descrive meglio il tuo studio. | Select the category that best describes your studio. | Sélectionnez la catégorie qui décrit le mieux votre studio. | Wählen Sie die Kategorie, die Ihr Studio am besten beschreibt. | Selecciona la categoría que mejor describa tu estudio. |
| `m2.title` | Sede e mercato operativo | Location and operating market | Siège et marché opérationnel | Standort und Tätigkeitsmarkt | Sede y mercado operativo |
| `m2.subtitle` | Dove ha sede lo studio e in quali lingue operate. | Where the studio is based and the languages you work in. | Où le studio est basé et les langues utilisées. | Wo Ihr Studio sitzt und in welchen Sprachen Sie arbeiten. | Dónde está el estudio y los idiomas en que operan. |
| `m3.title` | Priorità operative | Operational priorities | Priorités opérationnelles | Operative Prioritäten | Prioridades operativas |
| `m3.subtitle` | Cosa vorresti migliorare per primo? Seleziona da 1 a 4 voci. | What would you improve first? Select 1 to 4 items. | Que voulez-vous améliorer en premier ? Sélectionnez 1 à 4 éléments. | Was möchten Sie zuerst verbessern? Wählen Sie 1 bis 4 Punkte. | ¿Qué te gustaría mejorar primero? Selecciona de 1 a 4 elementos. |
| `m4.title` | Referente principale | Main contact | Référent principal | Hauptansprechpartner | Contacto principal |
| `m4.subtitle` | La persona che dialogherà con l'Advisor MOOD. | The person who will talk with the MOOD Advisor. | La personne qui échangera avec l'Advisor MOOD. | Die Person, die mit dem MOOD Advisor sprechen wird. | La persona que hablará con el Advisor MOOD. |
| `m5.title` | Identità del tenant | Tenant identity | Identité du tenant | Tenant-Identität | Identidad del tenant |
| `m5.subtitle` | Il nome del tuo studio e l'indirizzo MOOD dedicato. | Your studio name and dedicated MOOD address. | Le nom de votre studio et l'adresse MOOD dédiée. | Der Name Ihres Studios und die dedizierte MOOD-Adresse. | El nombre de tu estudio y la dirección MOOD dedicada. |

### 4.2 Categorie M1 (8 card)

| slug | IT | EN-US | FR | DE | ES |
|---|---|---|---|---|---|
| `interior_design_studio` | Studio di interior design | Interior design studio | Studio de design d'intérieur | Innenarchitekturbüro | Estudio de interiorismo |
| `architecture_studio` | Studio di architettura | Architecture studio | Studio d'architecture | Architekturbüro | Estudio de arquitectura |
| `multibrand_showroom` | Showroom multibrand | Multi-brand showroom | Showroom multimarque | Multibrand-Showroom | Showroom multimarca |
| `retail_design` | Retail design | Retail design | Design retail | Retail Design | Diseño retail |
| `stone_surface_specialist` | Stone & surface specialist | Stone & surface specialist | Spécialiste pierres et surfaces | Naturstein- und Oberflächenspezialist | Especialista en piedra y superficies |
| `contract_hospitality` | Contract & hospitality | Contract & hospitality | Contract et hospitality | Contract & Hospitality | Contract y hospitality |
| `furniture_brand` | Furniture brand | Furniture brand | Marque de mobilier | Möbelmarke | Marca de mobiliario |
| `material_brand` | Material brand | Material brand | Marque de matériaux | Materialmarke | Marca de materiales |

### 4.3 Priorità M3 (6 voci) — titoli

| slug | IT | EN-US | FR | DE | ES |
|---|---|---|---|---|---|
| `new_leads` | Generare nuovi contatti | Generate new leads | Générer de nouveaux contacts | Neue Kontakte generieren | Generar nuevos contactos |
| `relationship_mgmt` | Organizzare relazioni e clienti | Manage relationships and clients | Organiser relations et clients | Beziehungen und Kunden organisieren | Organizar relaciones y clientes |
| `materials_suppliers` | Gestire materiali e fornitori | Manage materials and suppliers | Gérer matériaux et fournisseurs | Materialien und Lieferanten verwalten | Gestionar materiales y proveedores |
| `project_presentation` | Migliorare la presentazione dei progetti | Improve project presentation | Améliorer la présentation des projets | Projektpräsentation verbessern | Mejorar la presentación de proyectos |
| `team_coordination` | Coordinare il lavoro del team | Coordinate team work | Coordonner le travail d'équipe | Teamarbeit koordinieren | Coordinar el trabajo del equipo |
| `digital_ecosystem` | Costruire un ecosistema digitale per lo studio | Build a digital ecosystem for the studio | Construire un écosystème numérique pour le studio | Ein digitales Ökosystem für das Studio aufbauen | Construir un ecosistema digital para el estudio |

### 4.4 Errori più frequenti

| key | IT | EN-US | FR | DE | ES |
|---|---|---|---|---|---|
| `errors.required` | Questo campo è obbligatorio. | This field is required. | Ce champ est obligatoire. | Dieses Feld ist erforderlich. | Este campo es obligatorio. |
| `errors.email_invalid` | Inserisci un'email valida. | Enter a valid email. | Saisissez un e-mail valide. | Geben Sie eine gültige E-Mail ein. | Introduce un email válido. |
| `errors.email_taken` | Questa email è già associata a un account esistente. | This email is already linked to an existing account. | Cet e-mail est déjà associé à un compte existant. | Diese E-Mail ist bereits einem Konto zugeordnet. | Este email ya está asociado a una cuenta. |
| `errors.subdomain_taken` | Questo indirizzo è già richiesto. Scegline un altro. | This address is already requested. Choose another. | Cette adresse est déjà demandée. Choisissez-en une autre. | Diese Adresse ist bereits angefragt. Wählen Sie eine andere. | Esta dirección ya está solicitada. Elige otra. |
| `errors.subdomain_reserved` | Questo nome è riservato. Scegline un altro. | This name is reserved. Choose another. | Ce nom est réservé. Choisissez-en un autre. | Dieser Name ist reserviert. Wählen Sie einen anderen. | Este nombre está reservado. Elige otro. |

### 4.5 Success page

| key | IT | EN-US | FR | DE | ES |
|---|---|---|---|---|---|
| `success.title` | Richiesta ricevuta | Request received | Demande reçue | Antrag erhalten | Solicitud recibida |
| `success.body` | Un Advisor MOOD analizzerà la richiesta e ti contatterà entro 2 giorni lavorativi. | A MOOD Advisor will review the request and contact you within 2 business days. | Un Advisor MOOD examinera la demande et vous contactera sous 2 jours ouvrés. | Ein MOOD Advisor prüft den Antrag und meldet sich innerhalb von 2 Werktagen. | Un Advisor MOOD revisará la solicitud y te contactará en 2 días hábiles. |
| `success.cta_home` | Torna alla home | Back to home | Retour à l'accueil | Zur Startseite | Volver al inicio |

### 4.6 Email transactional — subject

| key | IT | EN-US | FR | DE | ES |
|---|---|---|---|---|---|
| `email.ack.subject` | Abbiamo ricevuto la tua richiesta — {reference} | We received your request — {reference} | Nous avons reçu votre demande — {reference} | Wir haben Ihren Antrag erhalten — {reference} | Hemos recibido tu solicitud — {reference} |

---

## 5. CMS Mapping — come tutto questo si traduce in dati

### 5.1 Tabella `site_blocks` (esistente)
- Una riga per ogni `block_key` sotto namespace `studio.activation.v2`
- Colonne usate: `namespace`, `block_key`, `block_type` (`text` | `markdown`), `source_locale='it'`, `source_value` (IT)
- Esempio:
```
namespace        = 'studio.activation.v2'
block_key        = 'm1.title'
block_type       = 'text'
source_locale    = 'it'
source_value     = 'Categoria professionale'
```

### 5.2 Tabella `block_localizations` (esistente)
- Una riga per ogni `(block_id, locale)` per locale ≠ `it`
- Esempio:
```
block_id = <FK to site_blocks>
locale   = 'en-us'
value    = 'Professional category'
```

### 5.3 Strategy di import iniziale
1. Generare seed SQL `026_studio_v2_copy_seed.sql` (NON eseguito in questa fase — solo disegnato)
2. Tutte le ~140 chiavi (vedi count §6) inserite con IT come source + 4 traduzioni
3. Idempotente: `INSERT … ON CONFLICT (namespace, block_key) DO UPDATE`
4. Marker `cms_version='studio_v2_2026_05_31'` per audit

### 5.4 Editing workflow (Command Center)
- Editor esistente: `/command-center/blocks` (BlocksEditor.jsx)
- Filtro per namespace: aggiungere quick-filter chip `studio.activation.v2`
- Permessi: solo `role IN ('super_admin', 'editor')` può modificare questo namespace
- Versioning: ogni `PUT /api/admin/site/blocks` crea snapshot in `site_blocks_history` (se esiste, altrimenti TODO backlog)
- Anteprima live: il funnel `/studio/v2` ha un query param `?preview=1&token=<admin_token>` che pulla draft non pubblicati

### 5.5 Fallback resolver (server)
Endpoint `GET /api/site/block?key=<full_key>&locale=<l>`:
```
1. SELECT value FROM block_localizations WHERE block_id=X AND locale=l
2. if null → SELECT value FROM block_localizations WHERE block_id=X AND locale='en-us'
3. if null → SELECT source_value FROM site_blocks WHERE id=X
4. if null → return key itself + log warning
```

### 5.6 Bulk fetch per il funnel
- Endpoint nuovo: `GET /api/studio/v2/manifest?locale=<l>`
- Restituisce **tutte** le 140 chiavi del namespace in un singolo payload (~25KB minified)
- Client lo carica una volta a `/studio/v2` mount
- TTL cache server-side: 5 min
- Versioning: header `ETag` + `If-None-Match` per 304 Not Modified

---

## 6. Conta chiavi (stima)

| Sezione | Chiavi |
|---|---|
| Landing + Nav | 7 |
| M1 (titoli + 8 cat × 2) | 19 |
| M2 (titoli + 3 field × 3) | 11 |
| M3 (titoli + 6 goal × 2) | 14 |
| M4 (titoli + 6 field × 2) | 14 |
| M5 (titoli + 2 field × 3 + 3 status) | 11 |
| Submit + Success | 8 |
| Errors | 18 |
| Email transactional | 6 |
| Misc (helper, legals) | ~10 |
| **Totale stimato** | **~118 chiavi** |

Con 5 locale (IT source + 4) → **~590 rows in `block_localizations`** (escluse source rows).

---

## 7. Governance lingue attive (decisione 3→c)

### Tabella `active_languages` (vedi `02_TECH_DESIGN.md` §1.2)
- Seed iniziale: `it`, `en-us`, `fr`, `de`, `es` (dalle locale già usate in `block_localizations`)
- Tutte `is_enabled=true`, `sort_order` definito
- Admin UI futura in Command Center → `/command-center/languages` (P1, backlog)

### Impatto sul funnel
- Endpoint `GET /api/studio/v2/languages` filtra `WHERE is_enabled=true`
- Se admin disabilita una lingua:
  - Funnel non la mostra più nel multi-select M2
  - Richieste già submitted con quella lingua mantengono il dato (no rewrite)
- Quando si aggiunge una NUOVA lingua (es. `pt-br`):
  - Le chiavi `studio.activation.v2.*` devono esistere in `block_localizations` per `pt-br`
  - Finché non esistono → fallback automatico a `en-us` (vedi §5.5)
  - Warning in Command Center: "Lingua attivata ma X/118 chiavi mancanti per `pt-br`"

---

## 8. Checklist editoriale (acceptance criteria)

Prima del go-live, per ogni chiave:
- [ ] Supera l'editorial test (§1)
- [ ] IT validato da copy lead
- [ ] EN-US validato da native speaker
- [ ] FR / DE / ES validate da native speaker o agenzia
- [ ] Lunghezza compatibile con UI (max 60 char per titoli, 120 per subtitle, 280 per body)
- [ ] Nessun riferimento a "ecosistema", "atelier", "curatoriale", "temperamento" salvo dove brand-positivo

---

— *fine documento 01* —
