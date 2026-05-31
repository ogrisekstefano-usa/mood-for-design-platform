# GLOBAL COPY & TONE OF VOICE AUDIT™
## MOOD for DESIGN · Audit completo del linguaggio di piattaforma

> **Status:** 📋 AUDIT REPORT · ITER176.B · 31 May 2026
> **Scope:** revisione del linguaggio in tutta la piattaforma (workspace, client portal, sistema, email, traduzioni).
> **Vincolo:** zero modifiche a frontend, backend, database, file di traduzione. Solo audit, proposte e guida editoriale.
> **Approvazione necessaria del Founder** prima di applicare qualsiasi riscrittura.

---

## §0 · EXECUTIVE SUMMARY

### Cosa è stato fatto
Sono stati analizzati:
- **7 file di stringhe i18n** (`it-IT`, `en-US`, `en-GB`, `fr-FR`, `de-DE`, `es-ES`, `ar`) — circa 2.260 chiavi per lingua, ~750 KB totali
- **140+ componenti React** con copy hardcoded (JSX inline) — `pages/`, `components/`, `routers/`
- **Template email** (`backend/services/email_templates.py`)
- **Errori, empty states, toast, modal, CTA** in tutte le aree principali

### Verdetto generale
🔴 **Il linguaggio attuale viola sistematicamente il nuovo tone of voice ufficiale.**

La piattaforma adotta una scrittura **editoriale-emozionale** che la posiziona come "brochure di interior design" più che come **strumento operativo professionale**. Le metafore (atelier che "respira", giornata che "sussurra", "cinematic", "capitolo", "narrazione") sono pervasive in IT — ma replicate **letteralmente** nelle altre lingue (specialmente FR), generando traduzioni **artificiali, eccessivamente poetiche e poco credibili** in contesto business internazionale.

### Distribuzione delle violazioni (stima)
| Severità | Casi stimati | % del totale |
|---|---|---|
| 🔴 Critical | ~120 stringhe | 5% |
| 🟠 High | ~280 stringhe | 12% |
| 🟡 Medium | ~450 stringhe | 20% |
| 🟢 Low | ~600 stringhe | 26% |
| ⚪ OK (compliant) | ~810 stringhe | 37% |

### Top 5 problemi sistemici
1. **"Capitolo" abusato** come sinonimo di Journey/Step/Section in ~40 stringhe IT (e tradotto letteralmente in EN/FR/DE/ES come `chapter`, `chapitre`, `Kapitel`, `capítulo` con risultato innaturale)
2. **"Atmosfera" / "ritmo" / "respira"** usati come ornamento testuale in oltre 60 stringhe — il client non vuole "leggere il ritmo dello studio", vuole vedere lo stato del progetto
3. **Traduzioni FR letterarie** (es. *"gardiens d'un regard et d'un geste qui façonnent la matière du conseil"*) che farebbero sorridere un manager parigino di studio architettura
4. **Possessivi rivolti al cliente** in 2a plurale maiestatica ("il vostro ecosistema", "il vostro atelier", "vostro lavoro") che suonano **autocelebrativi e pesanti**
5. **"Curatoriale", "cinematic", "editoriale"** usati ovunque come aggettivi auto-elogiativi, depotenziando il vocabolario operativo

### Costo operativo del fix completo (estimate)
- ~3 giorni di riscrittura IT (chiavi + JSX hardcoded)
- ~2 giorni di ri-traduzione professionale (EN, FR, DE, ES) — con madrelingua o LLM in modalità "professional business voice"
- ~1 giorno di QA visivo
- ~1 giorno di applicazione delle Future Copy Rules ai testi nuovi
- **Totale stimato: 7 giorni** distribuiti in 2-3 sprint

---

## §1 · POSITIONING COMPLIANCE

### 1.1 · Verifica positioning per sezione

| Sezione piattaforma | Positioning attuale | Compliance | Note |
|---|---|---|---|
| **Login / Auth** | neutro | 🟢 OK | poche parole, focus operativo |
| **Dashboard** | editoriale-emozionale ("Studio Pulse · ritmo progettuale", "decisioni che la giornata sussurra") | 🔴 Non-compliant | trasformare in "Dashboard · indicatori operativi" |
| **CRM / Leads** | misto | 🟠 Parziale | terminologia OK, lede testuali poetici |
| **Prospects** | misto | 🟠 Parziale | idem |
| **Accounts** | poetico ("ogni account è un ecosistema in movimento") | 🔴 Non-compliant | va riscritto |
| **Studio Activation** | poetico-onboarding ("primo capitolo del tuo studio") | 🔴 Non-compliant | va riscritto |
| **Blueprint Chameleon** (ex Studio Identity) | editoriale ("Atmosfera Studio") | 🟠 Parziale | rebrand previsto in ITER176.B-Phase-R |
| **Editorial Calendar** | editoriale (giustificato — è il modulo editoriale del magazine) | 🟢 OK in scope | l'editoriale è il *contenuto* — qui il vocabolario è coerente |
| **Magazine** | editoriale (giustificato) | 🟢 OK in scope | come sopra |
| **Market Matrix** | tecnico + lede poetici | 🟠 Parziale | i lede vanno asciugati |
| **Media Library** | poetico ("asset che respirano", "cinematograficamente") | 🔴 Non-compliant | va riscritto |
| **Material View / Inspirations** | poetico ("atlante curatoriale", "capitolo editoriale del brand") | 🔴 Non-compliant | va riscritto |
| **Brand Atlas** | poetico ("orchestrazione", "tessitura") | 🟠 Parziale | va asciugato |
| **Forms & Journeys** | misto | 🟡 Medium | accettabile, qualche aggettivo va via |
| **Settings / Members** | EN business-like ("A magic-link email will be sent") | 🟢 OK | ✅ benchmark del tono giusto |
| **Client Portal · Overview** | editoriale ("primo capitolo del vostro percorso") | 🔴 Non-compliant | il cliente non vuole "vivere un percorso", vuole accedere ai materiali |
| **Client Portal · Brief** | misto | 🟠 Parziale | toast e empty states troppo lirici |
| **Client Portal · Moodboard** | giustificato (oggetto = visuale) | 🟢 OK in scope | "moodboard" è il nome del modulo |
| **Client Portal · Appointments** | tecnico | 🟢 OK | |
| **Client Portal · Conversations** | tecnico | 🟢 OK | |
| **Client Portal · Documents** | tecnico | 🟢 OK | |
| **Email templates** | misto ("Il tuo spazio progettuale ti aspetta", "Il tuo Design Journey™ è iniziato") | 🟠 Parziale | i subject vanno asciugati |
| **Error messages / Toast** | misto | 🟠 Parziale | troppi "Sto preparando…", "Il capitolo non è disponibile…" |

### 1.2 · Verdict per macro-area
- **Workspace Blueprint:** 60% delle pagine non-compliant
- **Client Portal:** 40% delle pagine non-compliant (la parte business funziona, la parte "narrative wrapper" no)
- **Sistema / Email / Modal:** 30% non-compliant
- **Editorial / Magazine:** compliant per design — è il modulo dove il linguaggio editoriale ha senso

---

## §2 · TONE VIOLATIONS — pattern systemici

### 2.1 · I 10 pattern problematici ricorrenti

Ogni pattern è documentato con: definizione · esempi reali · perché viola il tono · severità default.

#### Pattern V1 · "Capitolo" come metafora di Journey/Step
- **Definizione:** uso di `capitolo` per indicare una fase del Design Journey, un progetto, una collezione, una sezione UI.
- **Esempi reali (IT):**
  - `"Apri il primo capitolo del tuo studio."` (`projects.ProjectsPage:346`)
  - `"Apri il primo capitolo dello studio."` (`workspace.ProjectsPage`)
  - `"Quando il tuo studio aprirà un nuovo capitolo, lo troverai qui."` (i18n)
  - `"Crea capitolo"` (button label, `inspirations.CuratedCollectionDrawer:166`)
  - `"Nessun capitolo condiviso ancora."`
  - `"Sarà disponibile in un prossimo capitolo."` × 6 pagine `ComingSoonPage`
- **Perché viola:** un team operativo non apre "capitoli", apre progetti o journey. Il termine è poetico, ambiguo (capitolo del libro?), e introduce un metalinguaggio che il cliente non condivide.
- **Severità:** 🔴 **Critical** (alta frequenza × bassa credibilità professionale)

#### Pattern V2 · "Atmosfera / Ritmo / Respira" come ornamento
- **Definizione:** uso di parole atmosferiche per descrivere stati operativi.
- **Esempi reali:**
  - `"Studio Pulse™ · ritmo progettuale"` (eyebrow dashboard)
  - `"Lettura del ritmo progettuale…"` (loading state)
  - `"Decisioni che la giornata sussurra"` (subtitle)
  - `"L'atelier respira su una tela ampia"` (mobile blocker)
  - `"Asset che respirano attraverso la tua dashboard"`
  - `"Atmosfera, materia, ritmo"` (placeholder search)
  - `"Atmosfera in lettura curatoriale"` (status pill)
- **Perché viola:** un PM o uno studio non legge atmosfere — controlla deadline, milestone, journey status. La metafora è coerente con un brand di interior design, NON con uno strumento operativo.
- **Severità:** 🔴 **Critical**

#### Pattern V3 · "Cinematica / Cinematograficamente / Cinematic"
- **Definizione:** uso pervasivo di `cinematic*` come aggettivo di valore.
- **Esempi reali:**
  - `"Elaboriamo l'asset cinematograficamente e lo conserviamo dentro l'atelier"`
  - `"il punto focale — l'ancora cinematografica di questo asset"`
  - `"L'orchestrazione cinematica della presenza pubblica"`
  - `"sistema operativo cinematografico"`
- **Perché viola:** parola da pitch deck. In UI ripetitiva, ridondante, priva di significato funzionale.
- **Severità:** 🟠 **High**

#### Pattern V4 · "Curatoriale / Curato da MOOD / Cura"
- **Definizione:** uso di `curato` / `curatoriale` come aggettivo di prestigio.
- **Esempi reali:**
  - `"Curated by MOOD"` badge × multiple pages
  - `"Curatela editoriale — non raccomandazione algoritmica"`
  - `"L'atlante curatoriale è in costruzione"`
  - `"Capitolo curatoriale del tuo atelier"`
  - `"Una vista a sé per le tue raccolte curate di asset"`
- **Perché viola:** "curated by" è un cliché del fashion luxury 2015. Per uno studio professionale, "selezionato", "raccolto", "scelto" sono più credibili.
- **Severità:** 🟠 **High**

#### Pattern V5 · Possessivo maiestatico "il vostro / la vostra"
- **Definizione:** uso di 2a persona plurale formale ("vostro") che suona pomposo nel SaaS contemporaneo.
- **Esempi reali:**
  - `"Lo studio sta preparando il primo capitolo del vostro percorso"`
  - `"Il tuo Brief è il seme da cui tutto il Design Journey™ prende forma"` (qui è "tuo", OK)
  - In FR replicato come `"votre regard"` ovunque
- **Perché viola:** "voi/vostro" oggi è formale-aulico in italiano. SaaS moderni usano "tu" diretto o impersonale. Non in tutti i casi però — clienti b2b possono volere "voi" — vedi Future Rules §6.4.
- **Severità:** 🟡 **Medium**

#### Pattern V6 · "Ecosistema / Universo / Mondo"
- **Definizione:** termini iperbolici per descrivere il sistema.
- **Esempi reali:**
  - `"Ogni account è un ecosistema in movimento"` (`AccountsPage:195`)
  - `"Accedi a un ecosistema di prodotti, competenze e servizi"` (HomePage)
  - In FR: `"univers Advisor"` (FR translation della stessa stringa)
- **Perché viola:** non aggiunge informazione, sostituibile con sostantivi semplici (sistema, piattaforma, area).
- **Severità:** 🟡 **Medium**

#### Pattern V7 · "Tela / Lente / Filo / Seme" come metafore
- **Definizione:** metafore organiche/artigianali fuori contesto.
- **Esempi reali:**
  - `"Il tuo atelier respira su una tela ampia"`
  - `"Letto attraverso la lente culturale dei mercati internazionali"`
  - `"Il Brief è il seme da cui tutto il Design Journey™ prende forma"`
- **Perché viola:** richiede al lettore di decodificare. In UI lo sforzo cognitivo va minimizzato.
- **Severità:** 🟠 **High**

#### Pattern V8 · Orchestrazione / Tessitura / Composizione
- **Definizione:** sostantivi musicali/sartoriali usati come sinonimo di "configurazione" o "elenco".
- **Esempi reali:**
  - `"Caricamento dell'orchestrazione…"` (loading)
  - `"Catalogo dei moduli orchestrati dalla piattaforma"`
  - `"L'orchestrazione delle voci che compongono l'atelier"`
  - `"L'orchestrazione cinematica della presenza pubblica"`
- **Perché viola:** "orchestrazione" è jargon backend (microservices) o jargon musicale. Sostituibile con "configurazione", "panoramica", "elenco".
- **Severità:** 🟠 **High**

#### Pattern V9 · "Editoriale" usato come aggettivo di tutto
- **Definizione:** `editoriale` come booster di prestigio applicato a qualsiasi cosa.
- **Esempi reali:**
  - `"Capitolo editoriale ·"`, `"Aggiungi capitolo editoriale"`
  - `"Curatela editoriale"`
  - `"Direzione editoriale del brand"`
  - `"Cinematica editoriale"`
- **Perché viola:** solo nel modulo Magazine ha senso. Altrove è ornamento. Va limitato.
- **Severità:** 🟡 **Medium**

#### Pattern V10 · CTA emotivi invece di funzionali
- **Definizione:** bottoni che dicono cosa il sistema "vorrebbe" invece di cosa farà.
- **Esempi reali:**
  - `"Apri il rituale di chiusura"` (button — closure ritual??)
  - `"+ Apri il primo viaggio"` (button)
  - `"Apri il prossimo capitolo"` (CTA card)
  - `"Apri il benvenuto"` (button)
- **Perché viola:** un bottone deve dire cosa fa, non evocare. `"Chiudi la Journey"`, `"Crea Journey"`, `"Accedi"`.
- **Severità:** 🔴 **Critical** (impatta direttamente l'usabilità)

### 2.2 · Heatmap pattern × area (intensità violazioni)

| Pattern | Dashboard | CRM | Studio Act. | Inspirations | Client Portal | Email | Errors |
|---|---|---|---|---|---|---|---|
| V1 Capitolo | 🟠 | 🟢 | 🔴 | 🔴 | 🔴 | 🟡 | 🟠 |
| V2 Atmosfera | 🔴 | 🟡 | 🔴 | 🔴 | 🟠 | 🟡 | 🟡 |
| V3 Cinematic | 🟠 | 🟢 | 🟡 | 🟡 | 🟠 | 🟢 | 🟢 |
| V4 Curatoriale | 🟠 | 🟢 | 🟡 | 🔴 | 🟡 | 🟢 | 🟢 |
| V5 Maiestatico | 🟡 | 🟢 | 🟠 | 🟡 | 🔴 | 🟡 | 🟢 |
| V6 Ecosistema | 🟡 | 🟠 | 🟡 | 🟢 | 🟢 | 🟢 | 🟢 |
| V7 Metafore | 🟠 | 🟡 | 🟡 | 🟠 | 🟠 | 🟡 | 🟡 |
| V8 Orchestrazione | 🟠 | 🟢 | 🟡 | 🟢 | 🟢 | 🟢 | 🟢 |
| V9 Editoriale | 🟡 | 🟢 | 🟡 | 🔴 | 🟢 | 🟢 | 🟢 |
| V10 CTA emotivi | 🔴 | 🟡 | 🔴 | 🔴 | 🔴 | 🟡 | 🟢 |

Legenda: 🔴 critico / 🟠 alto / 🟡 medio / 🟢 basso o assente

---

## §3 · SEVERITY RANKING (catalogo problematiche)

### 3.1 · 🔴 CRITICAL · risolvere prima della prossima implementazione

| # | File / chiave | Stringa attuale | Perché critico |
|---|---|---|---|
| C1 | `it-IT.json :179`, `:526`, `:527` + JSX `ProjectsPage:346` | `"Apri il primo capitolo del tuo studio."` / `"+ Apri il primo viaggio"` | CTA primario su dashboard vuoto — primo touch — non si capisce cosa apre |
| C2 | `AccountsPage.jsx:195` lede | `"Ogni account è un ecosistema in movimento — moodboard, proposte, approvazioni, conversazioni. La memoria del progetto vive qui."` | pagina core CRM, lede pesante e auto-celebrativo |
| C3 | `it-IT.json` dashboard | `"Studio Pulse™ · ritmo progettuale"` eyebrow + `"Lettura del ritmo progettuale…"` loading | header della dashboard — primo impatto |
| C4 | `it-IT.json :398` | `"Decisioni che la giornata sussurra"` (subtitle card) | una dashboard non sussurra decisioni — qui ci sono le tue alert |
| C5 | `client.ClientJourneysIndexPage:152` | `"Lo studio sta preparando il primo capitolo del vostro percorso."` | empty state lato cliente — pretenzioso |
| C6 | `placeholder.ComingSoonPage` × 6 | `"Sarà disponibile in un prossimo capitolo."` (ripetuto su 6 moduli WIP) | inutilmente lirico, sostituibile con "In sviluppo. Disponibile a breve." |
| C7 | `inspirations.BrandDetailPage:237` | `"Nessuna collezione registrata — il primo capitolo editoriale apre la lettura curatoriale del brand."` | descrittivo, illeggibile per un utente operativo |
| C8 | `inspirations.ProductGalleryPage:403, 423` | `"o crea un nuovo capitolo curatoriale"` / `"Crea il primo capitolo del tuo atelier"` | UX di product gallery, deve essere chirurgica |
| C9 | `JourneyClosedBanner` lede | `"Chiusura certificata · capitolo concluso"` | event-level banner — info legale, non poetica |
| C10 | `it-IT.json :440` | `"Apri il rituale di chiusura"` CTA | è il bottone di chiusura journey: dire `"Chiudi la Journey"` |
| C11 | `it-IT.json :2241` mobile blocker | `"Il tuo atelier respira su una tela ampia. Il sistema operativo cinematografico riposa sull'architettura desktop"` | utente su mobile vede un poema invece di "Accedi da desktop" |
| C12 | `it-IT.json :1599` brief | `"Inizia a raccontarci lo spazio che immagini — senza fretta."` | è un brief, non un memoir |
| C13 | `it-IT.json :1758` editor | `"Nessun blocco ancora. Inizia la narrazione."` | è un editor, non un romanzo |
| C14 | `it-IT.json :2256, 2263, 2258` media | `"asset cinematograficamente"` / `"ancora cinematografica"` / `"elaboriamo cinematograficamente"` | spam terminologico |
| C15 | `inspirations.collection_form.il_linguaggio_progettuale_di_questo_capitolo_le_ma` | `"Il linguaggio progettuale di questo capitolo, le materialità prevalenti, l'atmosfera."` | placeholder textarea — testo poetico in un form input |

### 3.2 · 🟠 HIGH · risolvere nella prossima riscrittura

| # | File / area | Stringa attuale | Problema |
|---|---|---|---|
| H1 | i18n `:564` | `"L'archivio curatoriale dello studio. Ogni riferimento è letto attraverso la lente culturale dei mercati internazionali: atmosfera, materia, affinità editoriale."` | lede pesante × 3 metafore |
| H2 | i18n `:332-333` | `"Studio Pulse™ · ritmo progettuale"` | rinominare in `"Dashboard · stato dei progetti"` |
| H3 | i18n `:1147` | `"Narrazioni visive curate per ogni Design Journey™ del tuo studio."` | va in `"Moodboard di ogni Design Journey"` |
| H4 | i18n `:856-857` | `"Catalogo dei moduli orchestrati dalla piattaforma"` | `"Catalogo dei moduli della piattaforma"` |
| H5 | i18n `:885` | `"Totale degli atelier serviti dalla piattaforma"` | `"Totale studi attivi sulla piattaforma"` |
| H6 | i18n `:1672` | `"Caricamento dell'orchestrazione…"` | `"Caricamento…"` |
| H7 | i18n `:2165` | `"{active} Design Journey™ in respiro · {voices} voci ricevute oggi"` | `"{active} Design Journey™ attive · {voices} messaggi ricevuti oggi"` |
| H8 | i18n `:2193` | `"Nessun movimento. Lo studio respira in silenzio."` | `"Nessuna attività recente."` |
| H9 | i18n `:990, 993` | `"MOOD adatta tono, ritmo, CTA e narrativa al mercato selezionato"` | `"MOOD adatta tono, CTA e contenuti al mercato selezionato"` |
| H10 | `magazine` page i18n | `"Apri il prossimo capitolo"` (CTA generico) | `"Apri il prossimo articolo"` |
| H11 | i18n `:189` | `"Lo studio sta preparando il primo capitolo del vostro percorso."` | `"Il tuo studio sta preparando il primo aggiornamento."` (vedi anche C5) |
| H12 | `inspirations.brand_detail.aggiungi_capitolo_editoriale` | `"Aggiungi capitolo editoriale"` | `"Aggiungi collezione"` (button title) |
| H13 | `inspirations.curated_collection.description_placeholder` | `"Cosa raccoglie questo capitolo curatoriale?"` | `"Cosa raccoglie questa collezione?"` |
| H14 | i18n `:701` | `"Archivio curatoriale dello studio"` | `"Archivio dello studio"` |
| H15 | i18n `:693-694` | `"Product Gallery™ · Visual Atelier"` / `"Atmosfera in lettura curatoriale"` | `"Galleria prodotti"` / `"Analisi in corso"` |
| H16 | i18n `:992` | `"hospitality expectations, visual rhythm e luxury perception del cluster scelto"` (descrizione AI adaptation) | inglesismi vuoti, sostituire con: `"aspettative del mercato, ritmo visivo e posizionamento del segmento scelto"` (o togliere) |
| H17 | i18n `:838` | `"Network degli Advisor"` | `"Rete Advisor"` (l'articolo "degli" è italianizzato male) |
| H18 | i18n `:890` | `"Quest'area è riservata agli Advisor di MOOD"` | OK (questa frase è già professionale) |
| H19 | i18n `:1027` | `"Ogni edizione è un atto editoriale: un tuo contenuto adattato a una specifica cultura di mercato — tono, riferimenti, atmosfera."` | `"Ogni edizione è la versione del contenuto adattata a un mercato specifico — tono, riferimenti, struttura."` |
| H20 | i18n `:1133` | `"Questa è una vista d'archivio per ritrovare le moodboard composte attraverso tutti i Journey. La composizione vera avviene nel capitolo Moodboard Direction™ del singolo Journey."` | `"Archivio delle moodboard di tutti i Journey. La modifica avviene nel modulo Moodboard Direction™ del singolo Journey."` |

### 3.3 · 🟡 MEDIUM · sweep finale di rifinitura

Casi tipici (non elencati uno per uno — sono ~450 stringhe):
- Sostituzione `"atmosfera"` → `"stile"` o `"impostazione visiva"` nei placeholder
- Sostituzione `"il vostro …"` → `"il tuo …"` o impersonale (vedi rules §6.4 sulla scelta voi/tu)
- Sostituzione `"esperienza"` → termine specifico (form, brief, journey, modulo)
- Rimozione `editoriale` come aggettivo gratuito (es. `"calendario editoriale"` resta — è il nome del modulo; `"capitolo editoriale"` no)
- Rimozione `cinematic*` salvo dove il prodotto è effettivamente video/cinematografico

### 3.4 · 🟢 LOW · piccoli refinement
- Punctuation editoriale (`·` middle-dot) usata anche in CTA: OK su titoli/eyebrow, da rimuovere su button label
- "—" em-dash sostituito con "·" o "/" dove non è composizione tipografica
- Capitalizzazione coerente nei title case (oggi misto)

---

## §4 · REWRITE PROPOSALS (Before / After)

### 4.1 · Esempi indicati dal Founder

| # | Versione attuale | Versione proposta |
|---|---|---|
| 1 | "Chi guiderà l'esperienza?" | **"Referente principale"** |
| 2 | "Dove prende forma il vostro lavoro?" | **"Sede e mercato operativo"** |
| 3 | "Il vostro ecosistema è pronto." | **"Blueprint pronto."** oppure **"Workspace attivato."** |
| 4 | "Percorso introdotto da un Advisor MOOD." | **"Richiesta collegata a un Advisor MOOD."** |
| 5 | "Ogni studio ha una propria identità. Iniziamo da qui." | **"Configura il Blueprint dello studio."** |
| 6 | "Apri un nuovo capitolo del tuo studio" | **"Crea un nuovo progetto"** |
| 7 | "Il temperamento del vostro workflow" | **"Configurazione del workflow"** |
| 8 | "La composizione del vostro atelier" | **"Struttura del tuo studio"** |
| 9 | "Con cura, il team curatoriale" | **"Il team di MOOD"** (o togliere completamente la firma) |

### 4.2 · Dashboard

| # | Attuale | Proposto |
|---|---|---|
| D1 | `"Studio Pulse™ · ritmo progettuale"` | `"Dashboard · stato dei progetti"` |
| D2 | `"Lettura del ritmo progettuale…"` | `"Caricamento dashboard…"` |
| D3 | `"Decisioni che la giornata sussurra"` | `"Decisioni del giorno"` o `"Azioni da prendere oggi"` |
| D4 | `"Carica un riferimento o crea una moodboard per dare ritmo alla giornata."` | `"Carica un riferimento o crea una moodboard per iniziare."` |
| D5 | `"MOOD sta iniziando a leggere il ritmo del tuo studio."` | `"MOOD sta analizzando l'attività dello studio."` |
| D6 | `"Apri il primo viaggio"` | `"Crea la prima Journey"` |
| D7 | `"Apri il primo capitolo del tuo studio."` | `"Avvia il primo progetto."` |
| D8 | `"Nessun movimento. Lo studio respira in silenzio."` | `"Nessuna attività recente."` |
| D9 | `"{active} Design Journey™ in respiro · {voices} voci ricevute oggi"` | `"{active} Design Journey attive · {voices} messaggi ricevuti oggi"` |

### 4.3 · Inspirations / Material View

| # | Attuale | Proposto |
|---|---|---|
| I1 | `"Atlante curatoriale è in costruzione. Aggiungi un produttore o importa un catalogo per iniziare la lettura."` | `"Atlante in costruzione. Aggiungi un produttore o importa un catalogo per iniziare."` |
| I2 | `"Aggiungi capitolo editoriale"` | `"Aggiungi collezione"` |
| I3 | `"Crea il primo capitolo del tuo atelier."` | `"Crea la prima collezione del tuo studio."` |
| I4 | `"Capitolo editoriale ·"` | `"Collezione ·"` |
| I5 | `"Curated by MOOD"` (badge) | `"Selezionato da MOOD"` |
| I6 | `"Curatela editoriale — non raccomandazione algoritmica."` | (eliminare la frase, o `"Selezione editoriale a cura del team MOOD."`) |
| I7 | `"Archivio curatoriale dello studio"` | `"Archivio dello studio"` |
| I8 | `"Atmosfera in lettura curatoriale"` (status) | `"Analisi in corso"` |
| I9 | `"Atmosfera"` (campo form) | `"Stile"` o `"Mood"` (se vogliamo conservare il termine: solo come tag, non come label di campo libero) |

### 4.4 · Studio Activation / Onboarding

| # | Attuale | Proposto |
|---|---|---|
| S1 | `"Ogni studio ha una propria identità. Iniziamo da qui."` | `"Configura il Blueprint dello studio."` |
| S2 | `"Il vostro ecosistema è pronto."` | `"Workspace attivato."` |
| S3 | `"Apri il primo capitolo dello studio."` | `"Avvia il primo progetto."` |
| S4 | `"Lo studio sta preparando il primo capitolo del vostro percorso."` (client side) | `"Il tuo studio sta preparando i primi aggiornamenti."` |
| S5 | Empty `"Quando il tuo studio aprirà un nuovo capitolo, lo troverai qui."` | `"Quando il tuo studio attiverà un nuovo progetto, lo troverai qui."` |

### 4.5 · Errors / Empty States / Toast

| # | Attuale | Proposto |
|---|---|---|
| E1 | `"Sto preparando il capitolo…"` (loading) | `"Caricamento…"` |
| E2 | `"Questo capitolo è in attesa"` (empty) | `"In attesa di aggiornamenti"` |
| E3 | `"Non riesco ad aprire questo capitolo del Journey."` (error) | `"Impossibile aprire questa sezione della Journey."` |
| E4 | `"Il capitolo Brief non è disponibile in questo momento."` (toast) | `"Brief non disponibile in questo momento."` |
| E5 | `"Sarà disponibile in un prossimo capitolo."` (placeholder) | `"In sviluppo. Disponibile a breve."` |

### 4.6 · CTA (button labels) — punto critico UX

| # | Attuale | Proposto |
|---|---|---|
| B1 | `"Apri il rituale di chiusura"` | `"Chiudi la Journey"` |
| B2 | `"Apri il prossimo capitolo"` | `"Apri il prossimo articolo"` o `"Vai al prossimo step"` |
| B3 | `"Apri il benvenuto"` | `"Apri benvenuto"` o `"Vedi messaggio di benvenuto"` |
| B4 | `"+ Apri il primo viaggio"` | `"+ Crea Journey"` |
| B5 | `"Entra nell'atelier"` | `"Apri studio"` |
| B6 | `"Aggiungi un capitolo"` | `"Aggiungi sezione"` o `"Aggiungi step"` (a seconda del contesto) |

### 4.7 · Client Portal

| # | Attuale | Proposto |
|---|---|---|
| P1 | `"Il prossimo capitolo verrà condiviso dal tuo studio"` | `"Il prossimo aggiornamento sarà condiviso dal tuo studio"` |
| P2 | `"Ogni capitolo approvato entrerà qui — diventerà parte della memoria firmata del tuo percorso."` | `"Ogni step approvato sarà archiviato qui."` |
| P3 | `"Inizia a raccontarci lo spazio che immagini — senza fretta."` (brief intro) | `"Descrivici lo spazio che hai in mente."` |
| P4 | `"Nessun blocco ancora. Inizia la narrazione."` (block editor) | `"Nessun elemento. Aggiungi il primo blocco."` |
| P5 | `"La materialità che dialoga con l'atmosfera del progetto"` | `"I materiali del progetto."` |
| P6 | `"capitolo_primo_brief_cliente"` eyebrow | `"Brief cliente · primo step"` |

### 4.8 · Email subjects (`backend/services/email_templates.py`)

| # | Attuale | Proposto |
|---|---|---|
| EM1 | `"{studio_name} · Il tuo spazio progettuale ti aspetta"` | `"{studio_name} · Accedi alla tua area progetto"` |
| EM2 | `"Apri il link per continuare il tuo Design Journey™."` (preheader) | `"Accedi per continuare la tua Design Journey."` |
| EM3 | `"Il tuo Design Journey™ è iniziato."` (onboarding preheader) | `"La tua Design Journey è attiva."` |
| EM4 | `"Abbiamo ricevuto la tua richiesta"` (lead_captured subject) | OK (già professionale) |

---

## §5 · TRANSLATION ISSUES (per lingua)

### 5.1 · 🇮🇹 it-IT — baseline

Il file IT è la **lingua sorgente**: tutto il resto traduce da qui. Risultati:
- ~120 chiavi 🔴 critical, ~280 🟠 high (vedi §3.1, §3.2)
- Lessico target: **professionale, contemporaneo, essenziale**.
- Problematiche specifiche:
  - Italianismi auto-celebrativi ("ecosistema", "atelier", "atmosfera", "capitolo", "narrazione", "cinematica")
  - Possessivi maiestatici ("vostro", "vostra", "vostri")
  - Verbi metaforici ("respira", "sussurra", "danza", "compone")
  - Aggettivi-cliché ("curatoriale", "editoriale", "cinematica", "preziosa")

### 5.2 · 🇬🇧 en-US / en-GB

| Status | Note |
|---|---|
| 🟠 High issues | meno poetico dell'IT, ma alcuni calchi visibili |

**Esempi problematici:**

| Chiave | Stringa EN | Problema | Proposta |
|---|---|---|---|
| `decisioni_che_la_giornata_sussurra` | `"Decisions whispered by the day"` | calco letterario | `"Today's decisions"` |
| `nessun_blocco_ancora_inizia_la_narrazione` | `"No blocks yet. Begin the narrative."` | "narrative" qui suona pretentious | `"No blocks yet. Add the first one."` |
| `inizia_a_raccontarci_lo_spazio_che_immagini_senza` | `"Start sharing the space you envision with us — take your time."` | OK, ma "envision" è eccessivamente cool — un manager USA scriverebbe `"Tell us about the space you have in mind."` | `"Tell us about the space you have in mind."` |
| `cinematic` | `"Cinematic"` (filter category) | conserva il termine — OK in luxury context | OK se è label di un filtro estetico, NON OK come aggettivo di funzionalità |
| `curated_by_mood` | `"Curated by MOOD"` | OK in luxury, sbagliato in business operational | `"Selected by MOOD"` o `"MOOD's pick"` |

**Verdetto EN:** ~80% accettabile, ~20% calchi da asciugare.

### 5.3 · 🇫🇷 fr-FR — **il caso più grave**

Il francese è stato tradotto in modalità **iper-letteraria**, con espressioni che farebbero **sorridere o irritare** un PM francese di studio.

**Esempi clamorosi (citazioni reali dal file):**

| Chiave | Stringa FR attuale | Verdetto | Proposta |
|---|---|---|---|
| `quest_area_e_riservata_agli_advisor_di_mood` | `"Cet espace est dédié aux Advisors de MOOD, gardiens d'un regard et d'un geste qui façonnent la matière du conseil."` | 🔴 IRRICEVIBILE — "guardians of a gaze and a gesture that shape the matter of consulting" | `"Cet espace est réservé aux Advisors MOOD."` |
| `il_tuo_account_non_e_collegato_a_un_profilo_advisor` | `"Votre accès demeure en suspend, sans inscription à l'univers Advisor : si vous êtes partenaire territorial et percevez là une anomalie, nous vous invitons à solliciter l'équipe MOOD afin que votre présence soit pleinement reconnue."` | 🔴 IRRICEVIBILE — frase di 40+ parole, registro 19° secolo | `"Votre compte n'est pas relié à un profil Advisor. Si vous êtes partenaire territorial, contactez l'équipe MOOD pour activer votre accès."` |
| `decisioni_che_la_giornata_sussurra` | `"Les décisions que murmure la journée dans l'atelier"` | 🔴 troppo letterario | `"Décisions du jour"` |
| `nessun_segnale_operativo_critico_…` | `"Le rythme de publication respire dans la présence constante de vos marchés, sans turbulence ni signal qui réclame le geste."` | 🔴 illeggibile | `"Aucune alerte. Publication régulière sur vos marchés."` |
| `dashed` (border style label) | `"Une ligne discrète qui respire, fragmentée dans sa présence, silencieuse dans son geste"` | 🔴 è un label CSS!!! | `"Pointillé"` |
| `shadow` (label) | `"Épaisseur de l'ombre, là où la lumière se retire et laisse respirer la matière"` | 🔴 idem | `"Ombre"` |
| `inizia_a_raccontarci_lo_spazio_che_immagini_senza` | `"Racontez-nous l'espace que vous imaginez — prenez le temps du récit, celui de la matière et du regard."` | 🔴 | `"Décrivez-nous l'espace que vous avez en tête."` |
| `nessun_blocco_ancora_inizia_la_narrazione` | `"Aucun fragment pour l'instant. Posez le premier geste du récit."` | 🔴 | `"Aucun élément. Ajoutez le premier bloc."` |
| `l_orchestrazione_cinematica_della_presenza_pubblic` | `"La mise en scène de votre présence publique se déploie comme un récit à géométrie variable. Chaque surface narrative adapte son timbre, sa respiration, son geste d'appel au regard qui la parcourt."` | 🔴 testo di mostra d'arte | `"Configuration de la présence publique. Chaque section adapte ton, rythme et CTA au marché ciblé."` |
| `activity_empty` | `"Aucun mouvement. L'atelier respire en silence."` | 🟠 | `"Aucune activité récente."` |
| `lede` mobile blocker | `"Votre atelier respire sur une vaste toile. Le système d'exploitation cinématographique repose sur une architecture de bureau — retournez à votre studio pour continuer."` | 🔴 | `"L'interface MOOD est optimisée pour desktop. Revenez sur ordinateur pour continuer."` |
| `le_presentazioni_vivono_dentro_i_loro_journey` | `"Chaque présentation prend corps et respire à l'intérieur du récit qui la porte"` | 🔴 | `"Chaque présentation vit dans la Journey qui l'a générée."` |

**Verdetto FR:** ~40% del file è da **ri-tradurre interamente** (NON correggere parola per parola — è la cifra del traduttore che è poetica/letteraria).

### 5.4 · 🇩🇪 de-DE — registrato troppo formale

Il tedesco non è teatrale, ma è **stiff and ceremonial** in punti dove un PM tedesco preferirebbe la concisione.

**Esempi:**

| Chiave | Stringa DE | Problema | Proposta |
|---|---|---|---|
| `decisioni_che_la_giornata_sussurra` | `"Entscheidungen, die der Tag formuliert"` | OK, neutro | OK |
| `il_tuo_account_non_e_collegato_a_un_profilo_advisor` | `"Ihr Zugang ist derzeit keinem Advisor-Profil zugeordnet. Falls Sie als territorialer Partner registriert sind und dies nicht korrekt erscheint, wenden Sie sich bitte an das MOOD Team zur Freischaltung."` | 🟡 OK ma può essere più diretto | `"Ihr Konto ist keinem Advisor-Profil zugeordnet. Wenden Sie sich an das MOOD Team."` |
| `inizia_a_raccontarci_lo_spazio_che_immagini_senza` | `"Beschreiben Sie den Raum, den Sie sich vorstellen — in Ihrer Geschwindigkeit."` | OK già | OK |
| `quest_area_e_riservata_agli_advisor_di_mood` | `"Dieser Bereich ist den Advisors von MOOD vorbehalten."` | OK | OK |

**Verdetto DE:** ~85% accettabile. Necessita solo sweep dei "capitolo" → "Kapitel" che non si dice in business context (usare `"Abschnitt"`, `"Phase"`, `"Schritt"`).

### 5.5 · 🇪🇸 es-ES — naturalezza media

| Chiave | Stringa ES | Problema | Proposta |
|---|---|---|---|
| `decisioni_che_la_giornata_sussurra` | `"Decisiones que la jornada sugiere en voz baja"` | 🟠 poetico | `"Decisiones del día"` |
| `il_tuo_account_non_e_collegato_a_un_profilo_advisor` | `"Tu cuenta no está vinculada a un perfil Advisor. Si eres partner territorial y consideras que esto es un error, te invitamos a contactar al equipo MOOD para activar tu acceso."` | 🟢 OK | OK |

**Verdetto ES:** ~70% accettabile, ~30% con calchi italianismi (`capítulo`, `atmósfera`, `curaduría`) da sostituire.

### 5.6 · 🇸🇦 ar — caso a parte

L'arabo richiede **revisione madrelingua obbligatoria**. Le metafore italiane sono state tradotte in arabo letterario classico (`تهمس بها ساعات اليوم` — "whispered by the hours of the day") che NON è il registro standard di una piattaforma SaaS in lingua araba moderna.

**Verdetto AR:** richiede **traduttore madrelingua professionale** — non LLM auto-translate. Out of scope per audit, in scope per future translation work.

### 5.7 · Riassunto translation issues

| Lingua | Compliance | Effort ri-traduzione |
|---|---|---|
| 🇮🇹 it-IT | 🔴 30% | 3 giorni |
| 🇬🇧 en-US | 🟠 75% | 1 giorno |
| 🇬🇧 en-GB | 🟠 75% | 0.5 giorni (deriva da en-US) |
| 🇫🇷 fr-FR | 🔴 40% | 3 giorni (richiede traduttore) |
| 🇩🇪 de-DE | 🟢 85% | 0.5 giorni |
| 🇪🇸 es-ES | 🟠 70% | 1 giorno |
| 🇸🇦 ar | ⚪ — | richiede madrelingua, out of scope per ora |

---

## §6 · FUTURE COPY RULES (manuale editoriale)

> **Questa è la guida operativa per chiunque (umano o agente) scriva nuovi testi su MOOD for DESIGN. Da seguire SEMPRE prima di scrivere copy.**

### 6.1 · I 7 principi cardinali

1. **Chiarezza prima di tutto.** Se una persona non capisce in 2 secondi, riscrivere.
2. **Luxury = controllo, non poesia.** Frasi brevi. Punteggiatura sobria. Nessun aggettivo gratuito.
3. **Funzione prima del feeling.** Un button dice cosa fa, non come ti senti.
4. **Niente metalinguaggio.** No "capitolo", "narrazione", "atmosfera" se non sta descrivendo letteralmente quella cosa.
5. **Internazionale di default.** Se la frase non regge tradotta letteralmente in EN, non funziona neanche in IT.
6. **Madrelingua obbligatorio.** Mai traduzione automatica per FR/DE/ES/AR senza revisione.
7. **Test del "ridicolo" Founder.** Se non lo direi al titolare di uno showroom americano senza imbarazzo → riscrivere.

### 6.2 · Vocabolario PERMESSO (use freely)

Termini operativi che possono apparire ovunque:

- Design Journey · Journey
- Cliente · Lead · Prospect · Account · Referente
- Progetto · Brief · Moodboard · Proposta
- Materiali · Materiale · Materioteca
- Conversazione · Messaggio · Thread
- Appuntamento · Calendario · Milestone · Deadline
- Documento · Sign-off · Approvazione · Firma
- Team · Membro · Ruolo · Assegnazione · Owner · Contributor · Observer
- Workflow · Attività · Stato · Avanzamento · Step · Fase
- Workspace · Dashboard · Modulo · Sezione · Pannello
- Tenant · Studio · Blueprint
- Notifica · Alert · Promemoria
- Decisione · Azione · Approvazione

### 6.3 · Vocabolario VIETATO o STRETTAMENTE LIMITATO

| Termine | Status | Sostituire con |
|---|---|---|
| Capitolo | 🚫 vietato (salvo Magazine) | progetto · sezione · step · fase |
| Atmosfera | 🚫 vietato come label | stile · impostazione visiva · mood (solo come tag, mai come label di campo) |
| Cinematica/Cinematic | 🚫 vietato (salvo dove descrive un effetto video reale) | (rimuovere) |
| Curatoriale | 🚫 vietato come aggettivo gratuito | selezionato · raccolto |
| Curato da | ⚠️ limitato a Magazine | selezionato da · scelto da |
| Editoriale | ⚠️ solo in Magazine / Calendar | (rimuovere altrove) |
| Ecosistema | 🚫 vietato | sistema · piattaforma · area · panoramica |
| Orchestrazione | 🚫 vietato | configurazione · elenco · catalogo |
| Atelier | ⚠️ limitato a contesti Magazine / brand voice esterno | studio · workspace |
| Respira / Sussurra / Mormora | 🚫 vietato | (eliminare verbo metaforico, usare verbo letterale) |
| Tela / Lente / Filo / Seme | 🚫 metafore vietate | (descrivere letteralmente) |
| Narrazione / Narrare / Raccontare | 🚫 vietato (salvo contenuti) | descrivere · indicare · spiegare |
| Rituale | 🚫 vietato | procedura · processo · operazione |
| Capitolo editoriale | 🚫 vietato | collezione · sezione |
| Atmospheric / Vibe / Aura | 🚫 vietato | (descrizione concreta) |
| Vostro · Vostra · Vostri | ⚠️ vedi §6.4 (formal vs informal) | tuo / il (impersonale) — vedi regole |
| Universo · Mondo | 🚫 vietato | sezione · area |
| Magic · Magico | 🚫 vietato | (descrivere la feature) |
| Viaggio (come metafora) | 🚫 vietato | Design Journey™ (NOME proprio del modulo) — non sostituire mai con "viaggio" |

### 6.4 · Pronouns: TU vs LEI vs VOI

| Contesto | Pronome | Esempio |
|---|---|---|
| Team workspace (utente loggato) | **TU** | `"Apri la tua Journey"` |
| Cliente nel portale | **TU** | `"Compila il brief"` |
| Email di sistema / transazionali | **TU** | `"Hai ricevuto un nuovo messaggio"` |
| Comunicazioni a CEO/decision maker B2B | **LEI** (raro) | solo nel modulo Advisor / sales-led, mai default |
| **VOI / VOSTRO** | 🚫 mai default | possibile solo se il tenant lo configura esplicitamente |
| Pagine pubbliche / marketing | **TU** o impersonale | `"Avvia il tuo studio digitale"` |
| EN | **YOU** singolare informale-professionale | `"Open your Journey"` |
| FR | **VOUS** (tutoiement è troppo casual per B2B) | `"Ouvrez votre Journey"` |
| DE | **SIE** | `"Öffnen Sie Ihre Journey"` |
| ES | **TÚ** (B2B Spagna/LATAM contemporanea) | `"Abre tu Journey"` |

### 6.5 · CTA · regole d'oro

1. **Imperativo + sostantivo.** `"Crea Journey"`, `"Chiudi Journey"`, `"Aggiungi Lead"`. Mai `"Apri il rituale di…"`.
2. **Max 3-4 parole.** Se non ci sta → cambiare verbo.
3. **Nessun aggettivo emotivo.** Mai `"Apri il primo viaggio"` → `"+ Crea Journey"`.
4. **Verbo coerente con l'azione.** `"Apri"` per navigare; `"Crea"` per generare; `"Aggiungi"` per inserire; `"Chiudi"` per terminare.
5. **Eccezione magazine/editoriale:** ok eyebrow editoriali del tipo `"Apri il prossimo articolo"` ma il button label resta `"Leggi"`.

### 6.6 · Empty States · regole d'oro

1. **Descrizione neutra + CTA chiara.** Mai poesia.
2. Struttura: `[stato] · [azione possibile]`. Esempio: `"Nessuna Journey attiva. Crea la prima Journey."`
3. **Mai "Lo studio respira", "L'archivio è in attesa", "Il primo capitolo arriverà".**

### 6.7 · Error Messages · regole d'oro

1. **Cosa è andato storto + cosa fare.** Esempio: `"Brief non disponibile in questo momento. Riprova tra qualche secondo."`
2. **Mai colpevolizzare l'utente.** Mai `"Hai dimenticato di…"` — usare `"Manca …"` o `"Inserisci …"`.
3. **Mai metafore.** Mai `"Il capitolo non risponde"`.
4. Mappare a `DOMAIN-NNN` codes (vedi Error Registry spec) per audit/i18n consistency.

### 6.8 · Toast / Success / Info Messages

1. **Verbo passato neutro.** `"Journey creata"`, `"Lead salvato"`, `"Invito inviato"`.
2. **Mai esclamazioni.** No `"Fantastico! La tua Journey è pronta!"` — sì `"Journey creata"`.
3. **Mai compliment all'utente.** `"Hai fatto bene"`, `"Ottimo lavoro"` → fuori.

### 6.9 · Email Subjects · regole d'oro

1. **`[Studio name] · [azione concreta]`.** Esempio: `"MOOD for DESIGN · Accedi alla tua area progetto"`.
2. **Max 60 caratteri.**
3. **Niente emoji** (salvo eccezioni branding tenant-specifiche).
4. **Niente poesia.** No `"Il tuo spazio progettuale ti aspetta"` → sì `"Accedi alla tua area progetto"`.

### 6.10 · Placeholders di campi form

1. **Esempio realistico tra parentesi.** `"Es. Via Manzoni 12, Milano"`.
2. **Mai prompt poetico.** Mai `"L'angolo emotivo che apre l'articolo nel mercato target"` → sì `"Es. Apertura del primo paragrafo"`.

### 6.11 · Title Case vs Sentence case

| Surface | Stile | Esempio |
|---|---|---|
| Page title (H1) | Title Case (parole-chiave maiuscole) | `"Design Journey · Nuova Relazione"` |
| Eyebrow | UPPERCASE o Title Case | `"DASHBOARD"` o `"Dashboard"` |
| Section heading (H2/H3) | Sentence case | `"I tuoi clienti attivi"` |
| Button labels | Sentence case | `"Crea Journey"` |
| Toast / Error | Sentence case | `"Journey creata"` |
| Email subject | Sentence case | `"MOOD for DESIGN · Accedi alla tua area progetto"` |

### 6.12 · Punctuation editoriale

- `·` (middle dot) usabile su titoli/eyebrow per separare scope: `"Dashboard · Stato dei progetti"`.
- `—` (em-dash) usabile in body text per inciso lungo.
- `—` da **rimuovere** dai button label (es. `"+ Apri il primo viaggio"` non ha bisogno di em-dash).
- `:` per liste/elenchi.
- `…` solo per stati loading o frasi sospese (mai per stilizzazione).

### 6.13 · Trademark `™`

- Applicabile ai concetti canonici di MOOD: **Design Journey™**, **Blueprint Chameleon™**, **Discovery Interview™**, **Client Chameleon™**, **Studio Pulse™**, **Begin Journey™**.
- **NON** applicabile a parole comuni: `"Lead™"`, `"Brief™"` 🚫.
- In UI compatte può essere omesso (solo prima occorrenza per pagina).

### 6.14 · Branding voice — registro per audience

| Audience | Registro | Esempio |
|---|---|---|
| **Studio (team)** | professionale + diretto | `"Crea Journey · assegna referente · invia magic-link"` |
| **Cliente (portale)** | professionale + accogliente | `"Il tuo studio ha aggiornato la moodboard."` |
| **Advisor / Partner** | professionale + collaborativo | `"Richiesta collegata a un Advisor MOOD"` |
| **Founder / Admin (governance)** | tecnico + sintetico | `"Tenant attivato · 3 ruoli · 2 invii pendenti"` |
| **Public site (marketing)** | aspirazionale ma sobrio | `"Una piattaforma per organizzare ogni fase del rapporto tra studio, cliente, materiali e progetto."` |
| **Magazine (contenuti editoriali)** | editoriale-letterario (qui è OK) | `"Capitolo 3 · La materia del progetto"` |

### 6.15 · Process di approvazione copy

Prima di committare nuova copy (UI, email, error message, modal):

1. **Self-check:** rileggere applicando i 7 principi §6.1
2. **Test del "ridicolo":** la frase si potrebbe dire davanti a uno studio architettura newyorkese?
3. **Test "una sola idea":** la frase comunica UNA cosa? Se >2 → spezzare.
4. **Test traduzione mentale:** se non regge in EN letteralmente → riscrivere IT.
5. **Pull request label:** `[copy]` deve essere flaggata per review da Founder o copy-owner.

### 6.16 · Casi in cui il linguaggio editoriale resta legittimo

NON tutto va asciugato. Mantenere il registro editoriale solo in:

- **Magazine** (editoriale per definizione)
- **Editorial Calendar** (label moduli interni del magazine)
- **Welcome editoriale** del cliente nel portale (1 frase di benvenuto, NON tutta la UX)
- **Site pubblico** (marketing & storytelling)
- **Storefront content** (campagne pubbliche, hero text)
- **Email of welcome** (1-2 frasi di apertura)

Tutto il resto = registro operativo.

---

## §7 · TRADEMARK ™ AUDIT (uso del simbolo)

I termini ™ usati nella piattaforma — verifica di pertinenza:

| Termine | Pertinente? | Note |
|---|---|---|
| Design Journey™ | ✅ | concetto core MOOD |
| Blueprint Chameleon™ | ✅ | post-rebrand ITER176.B |
| Studio Pulse™ | ✅ | dashboard signal system |
| Discovery Interview™ | ✅ | concetto CRM |
| Begin Journey™ | ✅ | public form ritual |
| Client Chameleon™ | ✅ | client-side preset |
| Moodboard Direction™ | ⚠️ | accettabile ma sovrabbondante — valutare se basta "Moodboard" |
| Voice Journal™ | ⚠️ | accettabile, frequenza media |
| Studio Identity™ | 🚫 | deprecato (rebrand to Blueprint Chameleon) |
| Atelier Atmosphere™ | 🚫 | violazione tono — eliminare ™ |
| Visual Atelier™ | 🚫 | violazione tono — eliminare ™ |
| Product Gallery™ | ⚠️ | OK ma non serve ™ (è genericissimo) |

**Regola:** ™ va riservato a concetti **architetturali e pubblicabili**. Eliminarlo dove è solo decorazione.

---

## §8 · IMPLEMENTAZIONE — proposta operativa

> Questo audit **non modifica nulla**. Per applicare le proposte, segue una procedura.

### 8.1 · Phase plan (proposto)

| Phase | Scope | Output | Effort |
|---|---|---|---|
| **C1 · IT critical** | Rewrite 🔴 critical (~120 chiavi) + JSX hardcoded | new `it-IT.json` + diff JSX | 1.5g |
| **C2 · IT high** | Rewrite 🟠 high (~280 chiavi) | `it-IT.json` | 1.5g |
| **C3 · IT medium sweep** | Sweep `capitolo` → `progetto/sezione/step`, `atmosfera`, `curatoriale`, `editoriale` | `it-IT.json` | 1g |
| **T1 · Translation EN** | Re-translate from IT v2 (LLM-assisted + review) | `en-US.json` + `en-GB.json` | 1g |
| **T2 · Translation FR** | **Madrelingua FR raccomandato** (Sonnet può aiutare ma serve review) | `fr-FR.json` | 2g |
| **T3 · Translation DE** | Sweep + minor rewrites | `de-DE.json` | 0.5g |
| **T4 · Translation ES** | Sweep + minor rewrites | `es-ES.json` | 1g |
| **T5 · Translation AR** | Out of scope (requires native review) | — | parcheggiato |
| **QA1 · Visual regression** | Screenshot diff pre/post in 6 lingue | report | 0.5g |
| **QA2 · End-to-end** | Playwright sui 6 scenari (showroom flow) testandolo in EN + FR | test report | 0.5g |
| **R1 · Future rules deployment** | Linking `GLOBAL_COPY_AUDIT.md` come canon doc + agent prompt update | docs update | 0.5g |

**Totale stimato: ~9 giorni full team (1 copy writer IT + 1 madrelingua FR + agent execution).**

### 8.2 · Out of scope ESPLICITO
- Modifica codice (`pages/`, `components/`, `routers/`) — solo lessicale, mai logica
- AR translation (richiede traduttore madrelingua dedicato)
- Branding voice site pubblico (storefront marketing copy — diverso project)
- Magazine content editoriale (per design, mantiene registro letterario)

### 8.3 · Risk register

| Rischio | Mitigation |
|---|---|
| LLM traduce troppo letterale e ricade in tono editoriale | Prompt fix: "use professional business voice, no metaphors" + glossary `GLOBAL_COPY_AUDIT §6.3` |
| Stringhe rotte da i18n key rename | Mantenere le **key** invariate, cambiare solo i **value** |
| Regressione UI per length differente (es. EN più corto di IT) | QA1 screenshot diff |
| Discrepanza tra `data-testid` (label-based) e nuove copy | Verificare nessun testid usa il label come selector |
| Comunicazione interna confusione (Stefano vede vecchie copy in cache) | Service worker bust + comunicazione changelog |

---

## §9 · POSITIONING STATEMENT — versione canonica

Per coerenza con tutto il resto della piattaforma, il positioning di MOOD diventa:

> **MOOD for DESIGN è una piattaforma che organizza e registra ogni fase del rapporto tra studio, cliente, materiali e progetto.**
>
> *Non è un CRM. Non è un gestionale. Non è un software per moodboard. Non è un software editoriale. È l'infrastruttura operativa del design system.*

Questo statement va usato:
- Come **subtitle** del logo nella login page
- Come **meta description** del site pubblico
- Come **footer** delle email di sistema (versione corta)
- Come **about** nelle settings tenant
- Come **prima riga** del README pubblico

---

## §10 · APPROVAZIONE FOUNDER

Per procedere con l'implementazione delle rewrites, il Founder deve confermare:

- [ ] Approvo il nuovo Tone of Voice ufficiale (§0, §6.1)
- [ ] Approvo il vocabolario permesso (§6.2) e vietato (§6.3)
- [ ] Approvo l'eliminazione sistemica di "capitolo", "atmosfera" come label, "curatoriale", "cinematic", "orchestrazione"
- [ ] Approvo le rewrites proposte (§4) — eventualmente con modifiche puntuali
- [ ] Approvo la priorità di intervento (§8.1 phases C1, C2, C3, T1, T2)
- [ ] Approvo l'OUT OF SCOPE (§8.2)
- [ ] Approvo il positioning statement ufficiale (§9)
- [ ] Mantengo "Atelier" / "Editoriale" solo nei moduli Magazine, Editorial Calendar, Site pubblico (§6.16)
- [ ] Per il FR la ri-traduzione richiede madrelingua professionale (nessuna LLM auto-publish)

Solo dopo OK → si procede con Phase C1.

---

## §11 · APPENDICE · Glossary translation table (IT → EN/FR/DE/ES)

Glossario operativo da fornire al copywriter e ai traduttori. Termini canonici MOOD sempre uguali in tutte le lingue (sono brand-specific).

| IT canonico | EN | FR | DE | ES | Note |
|---|---|---|---|---|---|
| Design Journey | Design Journey | Design Journey | Design Journey | Design Journey | invariato (TM) |
| Cliente | Client | Client | Kunde | Cliente | |
| Lead | Lead | Lead | Lead | Lead | invariato |
| Prospect | Prospect | Prospect | Prospect | Prospect | invariato |
| Account | Account | Compte | Konto | Cuenta | |
| Progetto | Project | Projet | Projekt | Proyecto | |
| Brief | Brief | Brief | Brief | Brief | invariato |
| Moodboard | Moodboard | Moodboard | Moodboard | Moodboard | invariato |
| Materiali | Materials | Matériaux | Materialien | Materiales | |
| Conversazione | Conversation | Conversation | Konversation | Conversación | |
| Appuntamento | Appointment | Rendez-vous | Termin | Cita | |
| Documento | Document | Document | Dokument | Documento | |
| Team | Team | Équipe | Team | Equipo | |
| Workflow | Workflow | Flux de travail | Workflow | Flujo de trabajo | |
| Attività | Activity | Activité | Aktivität | Actividad | |
| Decisione | Decision | Décision | Entscheidung | Decisión | |
| Stato | Status | Statut | Status | Estado | |
| Assegnazione | Assignment | Affectation | Zuweisung | Asignación | |
| Referente | Lead contact / Owner | Référent | Ansprechpartner | Responsable | |
| Studio | Studio | Studio | Studio | Estudio | |
| Tenant | Workspace | Workspace | Workspace | Workspace | "tenant" sparisce in UI esterna |
| Blueprint Chameleon | Blueprint Chameleon | Blueprint Chameleon | Blueprint Chameleon | Blueprint Chameleon | invariato (TM) |

---

**Fine documento. In attesa di approvazione Founder per procedere con Phase C1 (IT critical rewrite).**
