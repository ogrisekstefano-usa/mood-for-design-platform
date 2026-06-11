# CORE FLOW CERTIFICATION REPORT™
**Versione:** 1.0  
**Data audit:** 11 giugno 2026  
**Ambiente:** `https://i18n-recovery-1.preview.emergentagent.com`  
**Stato:** CERTIFICAZIONE FALLITA — n. 8 blocchi P0 identificati  
**Autore:** Agent E1 — Sprint UX Certification

---

## LEGENDA PARAMETRI UX

| Codice | Descrizione |
|--------|-------------|
| UX-01 | **Copywriting** — Il testo accompagna o interroga? |
| UX-02 | **Lingua** — Italiano coerente al 100%? |
| UX-03 | **Continuità narrativa** — Il percorso racconta una storia lineare? |
| UX-04 | **Dream Score** (1–10) — Il cliente si sente ispirato? |
| UX-05 | **Professional Score** (1–10) — Lo studio appare credibile e preciso? |

---

## FLOW A — PERCORSO PUBBLICO (Begin Journey)

### A-STEP-1: `/begin-journey` — Schermata iniziale

**UX-01 — COPYWRITING:** `CRITICO`  
La schermata apre con "What ambiance are you seeking?" — domanda in inglese. Il tono editoriale è presente ("the impressions, not the technical specifications, that guide us") ma completamente nella lingua sbagliata.

**UX-02 — LINGUA:** `FAIL`  
- Tutti i titoli, sottotitoli e label: **inglese**
- Step rail: "AMBIANCE", "HOW YOU LIVE", "LET'S CONNECT" — inglese
- Chips spazio: "Residence", "Showroom", "Hospitality", "Office", "A dedicated space" — inglese
- Textarea label: "How do you wish to feel in this space?" — inglese
- Nessun testo italiano in Step 1

**UX-03 — CONTINUITÀ:** `PASSA` (condizionato)  
Il form ha una logica narrativa coerente in 3 step. La progressione step 1→2→3 è chiara.

**UX-04 — Dream Score:** `3/10`  
Il concetto è giusto ("impressioni, non specifiche tecniche") ma tutto in inglese per un cliente italiano vanifica completamente l'esperienza MOOD.

**UX-05 — Professional Score:** `5/10`  
Il design grafico è curato. Il bug linguistico abbatte la credibilità.

---

### A-STEP-2: Step 2 — "How You Inhabit Space"

**UX-02 — LINGUA:** `FAIL`  
- Header: "SECOND STEP · HOW YOU INHABIT SPACE" — inglese
- Domanda: "How do you experience space?" — inglese
- Sub-testo: "Help us understand how you live — not the furniture you'll want, but the gestures, the routines, the light as it moves through your day." — inglese
- Chips ospiti: "Yes, frequently", "At times", "Seldom", "I inhabit space in solitude" — inglese
- Chips materiali: "Wood", "Stone", "Natural fabrics", "Warm Metals", "Glass", "Velvet", "Marble", "Linen" — inglese
- Chips ambiance: "Warm and enveloping", "Understated and minimal", "Light-filled and airy", "Tactile and sensorial" — inglese

**UX-04 — Dream Score:** `3/10`  
**UX-05 — Professional Score:** `4/10`  

---

### A-STEP-3: Step 3 — "Let's Connect"

**UX-02 — LINGUA:** `FAIL PARZIALE` (inconsistenza grave)  
- Header: "FINAL STEP · LET'S CONNECT" — inglese
- H1: "Where shall we begin?" — inglese
- Sottotitolo: "Just three details. The rest will unfold as we talk." — inglese
- Label nome: "How shall we address you?" — inglese
- Label cognome: **"Cognome"** — ITALIANO (unica parola italiana nello step!)
- Label email: "A note to reach you" — inglese
- Label telefono: "A number, if you prefer to speak" — inglese
- Validazione email: "Email disponibile" — italiano ✓ (solo qui funziona)

**UX-01 — COPYWRITING:** `PROBLEMA`  
"Cognome" in italiano circondato da tutto inglese crea una dissonanza cognitiva che trasmette trascuratezza, non cura.

**UX-04 — Dream Score:** `4/10`  
**UX-05 — Professional Score:** `3/10` — Un campo in italiano e 10 in inglese segnala un bug non risolto.

---

### A-STEP-4: Submission — `/journey/preparing`

**UX-02 — LINGUA:** `FAIL TOTALE`  
- Messaggio di conferma: **"We're opening your Design Journey™..."** — inglese
- Navigazione: "HOW IT WORKS", "MAGAZINE", "DESIGN STORIES", "FOR PROFESSIONALS" — inglese
- Bottoni: "RE-ENTER", "BEGIN YOUR DESIGN JOURNEY™" — inglese

**UX-01 — COPYWRITING:** `CRITICO`  
Questo è il momento più importante del percorso cliente — il cliente ha appena condiviso la sua visione. Il messaggio di risposta deve essere in italiano, caldo, emozionale. "We're opening your Design Journey™..." in inglese è una doccia fredda.

**UX-04 — Dream Score:** `2/10`  
**UX-05 — Professional Score:** `2/10`  

---

### A-STEP-5: Email di benvenuto

**STATUS: `BLOCKED_EXTERNAL_DEPENDENCY`**  
- Motivo 1: Resend API key invalida/scaduta
- Motivo 2: Dominio `mail.moodfordesign.com` non verificato su Resend

**Nota:** La magic link è stata generata correttamente dal sistema Supabase Auth. Il redirect URL punta a `https://blueprint.moodfordesign.com` (produzione), non all'ambiente preview. Questo è un comportamento corretto per l'ambiente di produzione, ma da verificare in test.

---

### A-STEP-6: Thread conversazione admin

**STATUS: `PASSA CON RISERVA`**

La submission pubblica crea correttamente:
- Lead (source: `begin_journey_ritual`)
- Thread conversazione con messaggio di sistema
- `unread_for_designer: 1` correttamente impostato

**PROBLEMA:** Il badge notifiche nell'header admin (campanella) NON mostra l'unread. I dati sono presenti nel DB (`unread_for_designer: 1`) ma il frontend non riflette questo stato.

---

### A-STEP-7: Dati del Lead (Model)

**Campi raccolti da Flow A:**
| Campo | Raccolto | Salvato DB |
|-------|----------|-----------|
| space_type | ✓ | ✓ (nel brief testuale) |
| how_to_feel | ✓ | ✓ (nel brief testuale) |
| references | ✓ | ✓ (nel brief testuale) |
| guests | ✓ | ✓ (nel brief testuale) |
| materials | ✓ | ✓ (nel brief testuale) |
| ambiance | ✓ | ✓ (nel brief testuale) |
| first_name | ✓ | ✓ |
| last_name | ✓ | ✓ |
| email | ✓ | ✓ |
| phone | opzionale | ✓ |
| project_type | **NON RACCOLTO** | — |
| budget | **NON RACCOLTO** | — |
| timeline | **NON RACCOLTO** | — |

**SCORE LEAD: 0** — Il sistema non calcola uno score dalla submission pubblica.

---

## FLOW B — PERCORSO BLUEPRINT (Lead Admin + Journey)

### B-STEP-1: CRM — Pagina Leads `/relations/leads`

**UX-02 — LINGUA:** `FAIL PARZIALE`
- Descrizione pagina: italiano ✓
- Bottone "New Lead": inglese (invece di "Nuovo Lead") ❌
- Search placeholder: "Search by name or email..." inglese ❌
- Contatore: "14 Leads registered" inglese ❌
- Tab "DISCOVERY", "CULTIVATION", "ACTIVE STUDIO": inglese ❌

**Nota:** La stessa pagina senza sessione admin mostra "Nuovo Lead" in italiano. Con sessione admin mostra "New Lead" in inglese. **Session-dependent language flip.** Possibile lingua admin impostata su EN.

---

### B-STEP-2: Modal Nuovo Lead

**UX-02 — LINGUA:** `PASSA`  
Il modal "Aggiungi un nuovo lead" è completamente in italiano.
- Label: NOME, COGNOME, EMAIL, TELEFONO ✓
- Helper: "Opzionale se hai il telefono" ✓
- Origini: Showroom, Telefono, Email, Sito web, Referral, Architetto, Evento, Import, Altro ✓
- CTA: "Crea Lead" ✓

**UX-04 — Dream Score:** `6/10` — Form funzionale, senza aspirazione.  
**UX-05 — Professional Score:** `7/10` — Pulito e chiaro.

---

### B-STEP-3: Lead Detail Page

**UX-02 — LINGUA:** `FAIL PARZIALE`
- Header: "CRM · LEAD" ✓ (ma in inglese)
- Data registrazione: "registered on 11 giu 2026" — **MIX** (inglese + mese abbreviato italiano)
- Banner CTA: "PRONTO A TRASFORMARLO IN PROGETTO?" ✓ italiano
- Bottone CTA: **"CREATE DESIGN JOURNEY™"** — inglese ❌
- Section header: "DISCOVERY INTERVIEW" — inglese ❌
- Badge status: **"IN AT TESA"** — BUG DI VISUALIZZAZIONE: "ATTESA" spezzato in "AT TESA" per il line-break CSS

**UX-05 — Professional Score:** `5/10` — Il bug "IN AT TESA" è visibile e trasmette carelessness.

---

### B-STEP-4: Qualification Modal (CREATE DESIGN JOURNEY™)

**UX-02 — LINGUA:** `FAIL PARZIALE`
- Step counter: "QUALIFICATION™ · STEP 1 OF 4" — inglese ❌ (dovrebbe essere "PASSO 1 DI 4")
- Titolo: "Possiamo aiutarti?" ✓ italiano
- Step 1 domanda: "Cosa stai progettando?" ✓ italiano
- **Step 1 opzioni: "Kitchen", "Living", "Bathroom", "Bedroom", "Outdoor", "Office", "Retail", "Hospitality", "Full Home", "Other" — TUTTE IN INGLESE ❌**
- Step 2 domanda: "Hai già uno spazio definito?" ✓ italiano
- Step 2 opzioni: "Sì, definito", "Lo sto cercando", "Non ancora" ✓ italiano
- Step 3 domanda: "Quando pensi di iniziare?" ✓ italiano
- Step 3 opzioni: "Entro 30 giorni", "1–3 mesi", "3–6 mesi", "Oltre 6 mesi", "Sto esplorando" ✓ italiano
- Step 4 domanda: "Vorresti una proposta di design?" ✓ italiano
- CTA finale: "CREA DESIGN JOURNEY" ✓ italiano
- Navigation: "INDIETRO", "AVANTI" ✓ italiano

**UX-04 — Dream Score:** `5/10` — Le domande sono giuste. Il mix linguistico è stridulo.  
**UX-05 — Professional Score:** `5/10`

---

### B-STEP-5: Errore "Avvia Discovery"

**STATUS: `BUG P0 — Funzione non accessibile`**

Clicking "Avvia Discovery" mostra il toast: **"Impossibile aprire la Discovery"**  
La Discovery Interview è un percorso alternativo di qualifica (diverso dal Qualification Modal). Non funziona. Nessuna schermata Discovery viene visualizzata.

---

### B-STEP-6: Journey Workspace `/studio/journey/:jid`

**UX-02 — LINGUA:** `FAIL` (missing count: 13 chiavi)
- "DESIGN JOURNEY™" — label inglese
- "CLIENT", "STATUS", "NEXT ACTION" — inglese
- "Discover · In progress" — mix
- "Begin Inspire" → "Brief & Questionnaire" — inglese
- "JOURNEY ROADMAP" — inglese
- "PHASE 1 OF 7" — inglese
- "Understand the client." — inglese
- "DESIGN DISCOVERY™" — inglese
- "Open the first design conversation." — inglese
- "Visual-first wizard · 5–8 minutes · generates Style DNA™, Material DNA™ and AI Recommendations." — inglese
- "Open Discovery Engine" — inglese
- "CHECKLIST" — inglese
- Status roadmap: "DISCOVER in progress", "INSPIRE Upcoming", "CURATE Upcoming" — inglese

**UX-04 — Dream Score:** `4/10`  
**UX-05 — Professional Score:** `5/10`

**Dati propagati correttamente dalla Qualification:**
- PROJECT TYPE: "Kitchen" ✓
- TIMELINE: "1-3m" ✓
- BUDGET RANGE: "Not set" (non raccolto nel modal) — accettabile

---

### B-STEP-7: Propagazione dati Lead → Journey

**STATUS: `PASSA`**  
Dopo la Qualification Modal, i campi `project_type` e `timeline` vengono correttamente salvati nel Journey. Il nome del cliente (Marco Bianchi) viene correttamente visualizzato come titolo della Journey ("Marco Bianchi · Design Journey").

---

## MESSAGING CHAIN AUDIT

**Catena verificata:** cliente → messaggio → notifica designer → click → conversazione → risposta → cliente

| Passaggio | Status | Dettaglio |
|-----------|--------|-----------|
| Lead submission pubblica | ✓ PASSA | Lead creato correttamente |
| Thread creazione automatica | ✓ PASSA | Thread creato con messaggio sistema |
| `unread_for_designer` | ✓ PASSA | Correttamente = 1 dopo submission |
| Badge notifica header | ✗ FAIL | `/api/notifications` restituisce array vuoto; il badge campana non mostra il conteggio |
| Notifica email al designer | ✗ BLOCKED_EXTERNAL_DEPENDENCY | Resend API key invalida |
| Click → conversazione | NON TESTABILE | Non esiste un thread con messaggi client reali |
| Risposta designer | NON TESTABILE | Client provisioning non completato |

---

## HARDCODED DATA AUDIT

| Item | Trovato dove | Priorità |
|------|-------------|---------|
| `TEST_AdminSession` | 3 lead con email `admin@moodfordesign.com` nel DB | P0 |
| `Stef Rientro` | Lead con email `ogriusa@gmail.com` | P1 |
| `Stef None` | Lead con email `ogriusa@gmail.com` | P1 |
| `Admin Test` | Lead con email `admin@moodfordesign.com` | P1 |
| `Cliente Nuovo` | Lead `nuovo.1781151710@test.it` | P1 |

---

## RIEPILOGO BLOCCHI PER PRIORITÀ

### P0 — BLOCCANTI ASSOLUTI

| ID | Schermata | Problema | Impatto |
|----|-----------|----------|---------|
| P0-01 | `/begin-journey` Step 1,2,3 | Intero form pubblico in inglese | Cliente italiano = esperienza fallita |
| P0-02 | `/journey/preparing` | Conferma submission in inglese | Momento più emotivo = fredda e straniera |
| P0-03 | Journey Workspace | 13 traduzioni mancanti | Il designer lavora in inglese |
| P0-04 | Lead Detail | "Avvia Discovery" → errore "Impossibile aprire la Discovery" | Funzione inaccessibile |
| P0-05 | Header admin | Badge notifiche non si aggiorna dopo submission pubblica | Designer non sa che arrivato lead |
| P0-06 | Lead Detail | "IN AT TESA" — bug CSS che spezza il testo | Errore visuale in produzione |
| P0-07 | DB | `TEST_AdminSession None` come nome lead (3 record) | Dati sporchi in produzione |
| P0-08 | Qualification Modal | Project types in inglese (Kitchen, Living, Bathroom...) | Incoerenza linguistica critica |

### P1 — IMPORTANTI

| ID | Problema |
|----|----------|
| P1-01 | Step counter "STEP 1 OF 4" invece di "PASSO 1 DI 4" |
| P1-02 | Bottone "CREATE DESIGN JOURNEY™" in inglese nel Lead Detail |
| P1-03 | "registered on 11 giu 2026" — mix italiano/inglese |
| P1-04 | Lead Score = 0 per tutti — scoring non attivo |
| P1-05 | Leads test non ripuliti (Stef Rientro, Admin Test, Cliente Nuovo) |
| P1-06 | "New Lead" / "Search by name or email..." inglese con sessione admin |

### P2 — MIGLIORAMENTI

| ID | Problema |
|----|----------|
| P2-01 | Nessuna referenza estesa del cliente nel profile dal Flow A |
| P2-02 | BUDGET RANGE mai raccolto in nessun flow |
| P2-03 | Timeline "1-3m" nel workspace invece di "1–3 mesi" |
| P2-04 | Magic link redirect verso `blueprint.moodfordesign.com` anziché preview |

---

## DREAM SCORE E PROFESSIONAL SCORE — RIEPILOGO

| Schermata | Dream Score | Professional Score | Nota |
|-----------|-------------|-------------------|------|
| `/begin-journey` Step 1 | 3/10 | 5/10 | Tutto inglese |
| `/begin-journey` Step 2 | 3/10 | 4/10 | Tutto inglese |
| `/begin-journey` Step 3 | 4/10 | 3/10 | Mix "Cognome" + inglese |
| `/journey/preparing` | 2/10 | 2/10 | Momento clou fallito |
| Login admin | 8/10 | 9/10 | Eccellente — tutto italiano |
| CRM Leads | 5/10 | 6/10 | Mix linguistico |
| Lead Detail | 5/10 | 5/10 | Bug "IN AT TESA" |
| Qualification Modal | 5/10 | 5/10 | Domande giuste, opzioni sbagliate |
| Journey Workspace | 4/10 | 5/10 | 13 traduzioni mancanti |

**Media totale — Dream Score:** `4.3/10` — SOTTO SOGLIA  
**Media totale — Professional Score:** `4.9/10` — SOTTO SOGLIA  

**Soglia accettabile per produzione:** Dream ≥ 7/10, Professional ≥ 7/10

---

## RISPOSTA ALLA DOMANDA CHIAVE

> **MOOD racconta una sola storia al cliente oppure tre storie diverse?**

In questo momento, MOOD racconta **due storie diverse** al cliente:

**Storia 1 — Se il cliente arriva da solo (`/begin-journey`):**
Viene accolto da un form in inglese che gli chiede di parlare delle sue atmosfere e materiali. Viene "aperto" da un messaggio in inglese. Non sa cosa succederà dopo. Il suo profilo non ha project_type né timeline.

**Storia 2 — Se il designer crea il lead dall'admin:**
Il cliente esiste solo come nome+email+origine nel CRM. Viene qualificato attraverso 4 domande operative (Kitchen, Sì, 1-3 mesi, Sì). La Journey viene creata con dati operativi ma senza anima.

Le due storie non si incontrano mai. Non esiste un modello unificato. Vedi `MODEL_CONSISTENCY_REPORT.md` per l'analisi dettagliata.

---

*Report generato il 11/06/2026 — Sprint Certification P0 Assoluto*
