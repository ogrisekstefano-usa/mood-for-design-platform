# WEBSITE CONTENT CONSOLIDATION AUDIT
**MOOD for DESIGN · Cross-page consolidation map**
**`Home` · `Dedicato A` · `Caratteristiche` · `Versioni e Prezzi` · `Academy` · `FAQ` · `Design Journey™`**

> Audit di sola consolidazione narrativa. **Zero redesign · zero implementazione · zero CMS write · zero codice.**
> Status: 📊 cross-page analysis · ⏳ awaiting user ratification of remediation priorities.
> Date: 20 June 2026.
> Sister document: `DESIGN_JOURNEY_VISUAL_BRIEF.md`.
> Predecessors: `WEBSITE_CTA_CONSOLIDATION_REPORT.md` · `DESIGN_JOURNEY_*` trilogia.

---

## 0 · EXECUTIVE SUMMARY

### Diagnosi in una frase
Il sito MOOD oggi parla con **6 voci leggermente diverse** che dicono cose parzialmente sovrapposte. Inserire la pagina `/design-journey` senza un piano di consolidazione rischia di **moltiplicare** le voci anziché unificarle.

### I 7 problemi cardine emersi dall'audit

| # | Problema | Severità | Pagine coinvolte |
|---|---|---|---|
| 1 | **"Piattaforma" è ovunque, ma il Journey™ la rifiuta** | 🔴 P0 | Home, Audience, Features, Training |
| 2 | **L'anti-frase "Blueprint non è un CRM, non è un gestionale, non è un moodboard"** appare già su Features → duplicazione con §08 del Journey™ | 🟡 P1 | Features ↔ Design Journey™ |
| 3 | **"Vediamo se Blueprint è giusto per il tuo studio."** ripetuto identico su Features cta + Pricing cta | 🟡 P1 | Features, Pricing |
| 4 | **Zero trust element (case study · citazione · numero verificato)** in nessuna pagina | 🔴 P0 | Tutte |
| 5 | **Educational vs Conversion confusion**: Pricing è una pagina di decisione che si comporta come pagina educativa; Caratteristiche è educativa ma con CTA conversion-stage | 🟡 P1 | Pricing, Features |
| 6 | **Academy e FAQ sono pagine di servizio orfane** dal main narrative — non rimandano al Journey™ né al funnel | 🟡 P1 | Academy, FAQ |
| 7 | **Design Journey™ rischia di essere una pagina-isola** se non si rifattorizza il vocabolario delle altre | 🔴 P0 | Cross-cutting |

### Quattro decisioni che sbloccano la consolidazione
1. **Lessico cardine**: scegliere se "piattaforma" si abbandona ovunque (raccomandato) o si concede solo dove serve (rischio incoerenza)
2. **Ownership del messaggio anti-CRM**: solo `/design-journey` (raccomandato) o anche `/caratteristiche` (oggi)
3. **Cosa fa la pagina `/design-journey` per le altre pagine**: orchestratore (parla a tutti) o satellite (parla solo a chi arriva da link diretto)
4. **Trust elements**: introduzione minima di citazioni autorizzate prima del lancio, o lancio "manifesto" senza prova esterna

---

## 1 · CLASSIFICAZIONE FUNZIONALE DELLE PAGINE

Prima di parlare di duplicazioni, va chiarito **che lavoro fa ciascuna pagina** nel funnel.

| Pagina | Funzione primaria | Fase del visitatore | Stato di salute |
|---|---|---|---|
| **`/`** Home | Magnete + posizionamento | Awareness | 🟡 funziona ma diluita |
| **`/dedicato-a`** Audience | Segmentazione + riconoscimento di pubblico | Awareness → Consideration | 🟡 troppo abstract, hero CTA è self-anchor (già flaggato) |
| **`/caratteristiche`** Features | Educazione di prodotto | Consideration | 🟢 più chiara del resto · ma overlap con Journey™ |
| **`/versioni-prezzi`** Pricing | Decisione (alto intent) | Decision | 🔴 si comporta come educativa, divertimento CTA verso `/supporto` (già flaggato) |
| **`/formazione`** Academy | Service-tier (formazione post-vendita) | Onboarding / Retention | 🟡 contenuti presenti ma orfani dal main narrative |
| **`/faq`** FAQ | Service-tier (assistenza informativa) | Decision support / Retention | 🟢 appena ricostruita su CMS pulito · non ancora popolata |
| **`/design-journey`** Design Journey™ (in progetto) | **Manifesto metodologico** | Cross-funnel (sostiene tutte le fasi) | 🟢 strategia + content + visual brief completati |

### Problema strutturale individuato
**Pricing si comporta come una pagina educativa.** Il visitatore arrivato qui ha intent commerciale, ma la pagina spende energia a spiegare il metodo (intro.body: *"L'accesso a Blueprint è curato. Vogliamo conoscere il tuo studio…"* + ecosystem.headline: *"Blueprint è una piattaforma più un metodo."*). Questa narrazione è giusta — ma vive nel posto sbagliato. Va spostata su `/design-journey`, lasciando a Pricing solo il lavoro di **decisione**.

### Proposta di ruolo dopo consolidazione

| Pagina | Ruolo proposto post-consolidazione |
|---|---|
| `/` | **Magnete editoriale**: posizionamento + 1 invito a `/design-journey` come secondary education + 1 invito a `/studio` come primary action |
| `/dedicato-a` | **Riconoscimento di pubblico**: chi siamo per chi · sezione "Ti riconosci qui?" → rimanda a `/design-journey` |
| `/caratteristiche` | **Educazione di prodotto**: cosa fa Blueprint per chi lavora in studio · ferma sulle 3 famiglie funzionali, NON sul metodo (il metodo vive su `/design-journey`) |
| `/versioni-prezzi` | **Decisione di adozione**: configurazioni disponibili · come si entra · cosa contiene ciascuna · primary CTA al funnel |
| `/formazione` | **Continuity post-adozione**: come si impara il metodo dopo aver configurato Blueprint · link al Journey™ |
| `/faq` | **Assistenza informativa**: risposte alle domande pre/post-decisione · link al Journey™ per chi cerca contesto metodologico |
| `/design-journey` | **Manifesto metodologico orchestratore**: la pagina che dà senso a tutte le altre |

---

## 2 · DUPLICATED MESSAGES (overlap analitico)

Analisi di **quali messaggi sono ripetuti** tra pagine, con il rischio di dilution.

### 2.1 Overlap lessicale critico: "piattaforma"

| Pagina | Frase | Rischio |
|---|---|---|
| Home eyebrow | *"La piattaforma editoriale per i professionisti del design"* | 🔴 ancora |
| Audience hero | *"Una piattaforma per chi disegna il vivere."* | 🔴 stessa parola |
| Features hero | *"Una sola piattaforma per tutto il progetto."* | 🔴 stessa parola |
| Training intro | *"La piattaforma è uno strumento; il metodo è una cultura."* | 🟡 prova a distinguere ma usa di nuovo "piattaforma" |
| Pricing ecosystem | *"Blueprint è una piattaforma più un metodo."* | 🟡 stesso schema |
| **Design Journey™ §08** | *"Blueprint™ non è un software."* + *"l'infrastruttura editoriale"* | 🔴 **antitesi semantica diretta** alle altre 5 occorrenze |

**Sintesi**: il sito attualmente promuove Blueprint **come piattaforma**, ma il messaggio cardine del Journey™ è che Blueprint **non è una piattaforma, è infrastruttura editoriale**. Senza intervento, l'utente che legge Home → Design Journey™ percepisce contraddizione.

**Rimedio (proposto, non ancora eseguito)**: sostituire "piattaforma" con uno tra: *"infrastruttura editoriale"*, *"workspace editoriale"*, *"configurazione"*, *"ecosistema editoriale"*. Mai usare la parola "piattaforma" su pagine consultive premium. Riservarla, se necessario, solo a contesti di onboarding tecnico (admin documentation, non corporate).

### 2.2 Overlap concettuale: l'anti-frase di Blueprint

| Pagina | Frase | Origine |
|---|---|---|
| `/caratteristiche` intro.body | *"Blueprint non è un CRM, non è un gestionale, non è un moodboard tool. È la piattaforma che li riunisce."* | esistente |
| Design Journey™ §08 (in progetto) | *"Blueprint™ non è un CRM. Blueprint™ non vende materiali. Blueprint™ non gestisce il cantiere. Blueprint™ non sostituisce il rapporto umano. Blueprint™ non scrive il progetto al posto vostro."* | nuovo |

**Sintesi**: stessa idea, due manifestazioni. La versione del Journey™ è **5 negazioni**, più premium e completa. La versione di Features è **3 negazioni** seguite da una contraffermazione che usa la parola proibita "piattaforma".

**Rimedio**:
- **Spostare la dichiarazione anti-CRM** completamente su `/design-journey` (è il posto editorialmente corretto)
- **Sostituire l'intro.body di Features** con un focus operativo: *"In Blueprint convivono il vostro CRM editoriale, la curatela dei materiali, la conversazione con il cliente. Ogni famiglia di strumenti è progettata per uno specifico momento del lavoro."* (operativo, non manifesto)

### 2.3 Overlap di micro-copy: "Vediamo se Blueprint è giusto per il tuo studio."

| Pagina | Posizione | Rischio |
|---|---|---|
| `/caratteristiche` cta.headline | Final CTA | duplicata |
| `/versioni-prezzi` cta.headline | Final CTA | duplicata identica |

**Sintesi**: due final CTA con esattamente la stessa headline, fonte → stesso editorial_block riusato.

**Rimedio**:
- **Caratteristiche**: *"Vediamo se Blueprint è giusto per il vostro studio."* (manteniamo qui, è la pagina educativa più adatta a questa frase di valutazione)
- **Pricing**: cambia in *"Configurate il vostro Blueprint™."* (è la pagina decisionale — la frase deve invitare all'azione, non al sondaggio)

### 2.4 Overlap di concetto: "il metodo / la cultura / la metodologia"

Riferimenti a "metodo / metodologia / cultura editoriale" su almeno 4 pagine:
- Home (implicito nelle 3 voci hero)
- Training intro.body: *"La piattaforma è uno strumento; il metodo è una cultura."*
- Pricing ecosystem: *"Blueprint è una piattaforma più un metodo."*
- Design Journey™ (intero, manifesto del metodo)

**Rimedio**:
- **Pricing ecosystem.headline** → sostituire con riferimento puntuale al Journey™: *"Blueprint™ è l'infrastruttura. Design Journey™ è il metodo."*  + link `/design-journey`
- **Training intro.body** → mantenere la frase ma con link esplicito al Journey™
- **Design Journey™** rimane la **sede unica** dove il "metodo" è descritto in pieno

### 2.5 Overlap di tono: "ascolto"

| Pagina | Frase | Origine |
|---|---|---|
| Home hero_title | *"Il design nasce dall'ascolto delle persone."* | hero claim del sito |
| Design Journey™ §04 Discovery | *"Prima di iniziare, si ascolta."* | nuovo |
| Support intro.body | *"Il team MOOD ascolta, indirizza e accompagna…"* | nuovo |

**Sintesi**: l'idea dell'ascolto è correttamente diffusa. Non è un overlap dannoso — è un **leitmotiv** che il sito già possiede. Il Design Journey™ può ereditarlo, non deve sostituirlo.

**Rimedio**: nessuno. Mantenere come **firma editoriale ricorrente**.

---

## 3 · CONTRADICTORY POSITIONING

### 3.1 Contraddizione frontale: Blueprint è piattaforma o non lo è?

| Pagina | Dichiarazione |
|---|---|
| Home, Audience, Features, Training | Blueprint **è** una piattaforma |
| Design Journey™ (in progetto) | Blueprint **non è** un software, è infrastruttura editoriale |

**Severità**: 🔴 P0. Va risolta prima del lancio del Journey™, altrimenti la pagina manifesto contraddice l'intero sito.

### 3.2 Contraddizione di postura: gated o disponibile?

| Pagina | Dichiarazione |
|---|---|
| Features hero | *"Una sola piattaforma per tutto il progetto"* (tono di prodotto disponibile) |
| Pricing hero | *"Blueprint non si compra. Si configura."* (tono di servizio gated) |
| Pricing intro | *"L'accesso a Blueprint è curato. Vogliamo conoscere il tuo studio prima di proporti la configurazione."* (gated) |
| Design Journey™ Final | *"Non esiste un piano standard. Esiste una conversazione iniziale."* (gated) |

**Severità**: 🟡 P1. Il sito oscilla tra "prodotto disponibile" e "servizio curato". Il Design Journey™ rafforza la postura curated.

**Rimedio**: allineare Features alla postura curated. Sostituire il framing "una sola piattaforma" con qualcosa come *"Una sola configurazione per tutto il progetto"* — sottile ma decisivo.

### 3.3 Contraddizione di audience: pubblico ampio o pubblico selezionato?

| Pagina | Implicazione |
|---|---|
| Home eyebrow | *"per i professionisti del design"* (ampio) |
| Audience hero | *"per chi disegna il vivere"* (ampio + poetico) |
| Design Journey™ §11 | *"Design Journey™ non è per tutti."* (selezionato) |

**Severità**: 🟡 P1. È meno una contraddizione e più una **gradazione narrativa**. Il sito promette ampiezza; il Journey™ promette selettività. Questo è un trade-off intenzionale del lussuoso ("non per tutti = per voi"), ma va orchestrato consapevolmente.

**Rimedio**: nessuno strutturale. Mantenere la frase *"Design Journey™ non è per tutti"* solo nel suo contesto editoriale (la sezione §11), evitando di replicarla in Home o Audience dove rischierebbe di sembrare snob.

---

## 4 · CTA CONFLICTS

*(Riferimento principale: `WEBSITE_CTA_CONSOLIDATION_REPORT.md`. Qui solo gli effetti sull'ecosistema dopo l'arrivo del Journey™.)*

### 4.1 Stato attuale dopo l'aggiunta del Journey™

| Pagina | Primary CTA proposto | Secondary CTA proposto | Destinazione primary | Destinazione secondary |
|---|---|---|---|---|
| Home | Richiedi una configurazione Blueprint™ | Esplora il Design Journey™ | `/studio` | `/design-journey` |
| Audience | Trova la configurazione adatta al tuo studio | Esplora il Design Journey™ | `/studio` | `/design-journey` |
| Features | Esplora Blueprint™ | Esplora il Design Journey™ | `/studio` | `/design-journey` |
| Pricing | Richiedi una configurazione Blueprint™ | Esplora il Design Journey™ | `/studio` | `/design-journey` |
| Academy | Inizia il percorso Academy | Esplora il Design Journey™ | `/studio?focus=academy` *(o pagina dedicata futura)* | `/design-journey` |
| FAQ | Richiedi una configurazione Blueprint™ | Esplora il Design Journey™ | `/studio` | `/design-journey` |
| Design Journey™ | Richiedi una configurazione Blueprint™ | Esplora MOOD for DESIGN | `/studio` | `/` (autoreferenziale evitata) |

### 4.2 Conflitti residui
- ❌ Nessun conflitto strutturale: la consolidazione CTA proposta è coerente
- 🟡 Sotto-conflitto: in Pricing, i CTA dei tier individuali (Tier 01–05) puntano oggi a `/supporto`. La consolidazione richiesta li riallinea a `/studio`. Esecuzione CMS pending.

### 4.3 Nuovo rischio introdotto dal Journey™
Il secondary CTA *"Esplora il Design Journey™"* sarà su **6 pagine**. Rischio di **CTA fatigue**: il visitatore lo vede ovunque. Mitigazione: visivamente sobrio, mai trattato come bottone primario duplicato.

---

## 5 · EDUCATIONAL vs CONVERSION (split funzionale)

### 5.1 Mappatura attuale

| Pagina | Funzione dichiarata | Funzione effettiva | Gap |
|---|---|---|---|
| Home | Magnete + posizionamento | Magnete + posizionamento | ✅ allineata |
| Audience | Segmentazione | Segmentazione astratta | 🟡 funzione corretta ma esecuzione astratta |
| Features | Educazione di prodotto | Educazione + lieve manifesto | 🟡 sconfina nel territorio del Journey™ |
| Pricing | Decisione | **Educazione travestita** da pricing | 🔴 spende energia educativa invece di chiudere |
| Academy | Service-tier (post-vendita) | Service-tier orfano | 🟡 manca cerniera con il main funnel |
| FAQ | Service-tier (assistenza) | Vuota (appena ricostruita) | 🟢 opportunità di nascere già allineata |
| Design Journey™ | Manifesto orchestratore | (in costruzione) | 🟢 disegnata come orchestratore |

### 5.2 Rimedio
**Spostare il manifesto fuori da Pricing.** Pricing deve diventare una pagina di decisione pura: tier, cosa contengono, come si entra, primary CTA. Tutta la copy editoriale che spiega "perché Blueprint è un metodo" va su `/design-journey`.

**Rinforzare Features come pagina operativa.** Features non deve raccontare il metodo: deve raccontare **gli strumenti**. Il "perché" è altrove (Journey™), Features risponde a "cosa".

### 5.3 Risultato della consolidazione (funnel pulito)

```
AWARENESS
  /                        → magnete · primo invito al Journey™
  /dedicato-a              → riconoscimento di pubblico

EDUCATION
  /design-journey          → IL METODO (manifesto orchestratore)
  /caratteristiche         → GLI STRUMENTI (operativo)

DECISION
  /versioni-prezzi         → COME SI ENTRA (decisione pura)

CONVERSION
  /studio                  → la conversazione iniziale

SERVICE
  /formazione              → come si impara dopo (Continuity)
  /faq                     → risposte puntuali
  /supporto                → assistenza in vita del progetto
```

---

## 6 · NARRATIVE GAPS

### 6.1 Gap fra Home e il resto

La Home parla di *"il design nasce dall'ascolto"* — bellissimo claim, ma **non chiude** sul concetto di Journey™. Il visitatore che lascia la Home non porta con sé la parola "Design Journey™" né "Blueprint™". Il funnel comincia con un'idea evocativa che non è ancora un'identità di prodotto.

**Rimedio**: arricchire la Home con una sezione (o un semplice sottotitolo) che introduce esplicitamente il Journey™ come **risposta operativa alla promessa dell'ascolto**.

### 6.2 Gap fra Audience e Features

`/dedicato-a` segmenta il pubblico. `/caratteristiche` spiega gli strumenti. **In mezzo manca la spiegazione del metodo.** Senza il Journey™, il salto è troppo grande: si passa da *"per chi è"* a *"come funziona"* senza un *"perché è così"*. Il Journey™ riempie esattamente questo gap.

### 6.3 Gap fra Pricing e Studio

Pricing oggi è la pagina di decisione, ma il Final CTA porta a `/studio` che è il funnel. **Non c'è un'anticipazione di cosa succede dopo aver cliccato.** Il visitatore non sa cosa significa "richiedere una configurazione" — quanto dura, chi risponde, quali domande.

**Rimedio**: introdurre su Pricing un piccolo blocco *"Cosa succede dopo aver cliccato"* (3 step: ascolto · proposta · configurazione). Su `/studio` stessa migliorare le copy delle 3 fasi per mantenere la promessa.

### 6.4 Gap fra Features e Academy

Features mostra gli strumenti. Academy parla di formazione. **Non c'è transizione** tra i due. Un visitatore che vede gli strumenti dovrebbe poter chiedere *"e come imparo?"* — oggi questa domanda non ha un link diretto.

**Rimedio**: aggiungere un blocco su `/caratteristiche` finale: *"Ogni configurazione Blueprint™ include l'accesso a MOOD Academy."* → link a `/formazione`.

### 6.5 Gap mancante completamente: cosa succede DOPO l'adozione

Nessuna pagina racconta la vita dello studio **un anno dopo** aver adottato Blueprint. Niente lifecycle. Niente Continuity raccontata pubblicamente. Il sito si ferma al momento della firma.

**Rimedio (post-lancio)**: una pagina futura `/clienti` o `/voci` che mostri studi che usano MOOD da tempo (richiede pilot interviews — vedi gap in `DESIGN_JOURNEY_PAGE_STRATEGY.md` §11).

---

## 7 · MISSING TRUST ELEMENTS

Audit di **prove esterne** presenti sulle pagine. Trust = qualunque elemento che mostri che MOOD funziona per qualcuno che non è MOOD.

### 7.1 Inventario stato attuale

| Tipo di trust element | Presente? | Pagina | Note |
|---|---|---|---|
| Citazioni di clienti / studi pilota | ❌ | Nessuna | Mai presenti |
| Case study reali | ❌ | Nessuna | Mai presenti |
| Numero di studi che usano MOOD | ❌ | Nessuna | Non comunicato |
| Numero di progetti gestiti | ❌ | Nessuna | Non comunicato |
| Loghi di studi clienti | ❌ | Nessuna | Mai presenti |
| Press mentions / pubblicazioni | ❌ | Nessuna | Mai presenti |
| Riconoscimenti di settore | ❌ | Nessuna | Mai presenti |
| Partner showroom / brand citati | ❌ | Nessuna | Mai presenti |
| Linkedin profili / fondatori | ❌ | Nessuna | About non li espone |
| Testimonial editoriali (1 frase autorizzata) | ❌ | Nessuna | Mai presenti |

**Sintesi**: il sito è oggi **al 100% un'affermazione di sé**. Niente prova esterna.

### 7.2 Rischio reputazionale
Per un posizionamento premium consultivo, l'assenza totale di trust element è coerente nel **primo anno** (è il modello "manifesto" — Aesop, Loro Piana, Officine Buly funzionano così). Diventa fragile dal **secondo anno** in poi: a quel punto il visitatore si aspetta almeno una prova.

### 7.3 Rimedi proposti (per fasi)

**Fase 1 · Pre-lancio Design Journey™ (immediato)**
- Identificare 2–3 studi pilota disposti a fornire **una sola citazione autorizzata**, anche anonima ("Uno studio milanese di interior design") se necessario
- Posizionarle in §05 e §11 del Journey™ come "voci"
- Costo: alto in tempo umano (interviste, permessi), zero in produzione

**Fase 2 · 3 mesi dopo lancio**
- Pubblicare il primo **case study editoriale** di 1 progetto pilota completato
- Vive sul magazine, è citato in §11 del Journey™ e in fondo a `/dedicato-a`
- Diventa anche contenuto SEO per la prima volta

**Fase 3 · 6 mesi dopo lancio**
- Introdurre una **galleria di studi pilota** (opt-in) con loghi e link al loro portfolio
- Posizionata in fondo a `/dedicato-a` e `/caratteristiche`
- Costruisce social proof senza la patina SaaS dei "Trusted by" carousel

**Fase 4 · 12 mesi dopo**
- Pagina dedicata `/voci` o `/clienti` come spiegato in §6.5

---

## 8 · ECOSYSTEM MAP (come le 7 pagine lavorano insieme)

Lettura della rete di link interna che ciascuna pagina dovrebbe avere verso le altre, post-consolidazione.

### 8.1 Matrice "chi linka a chi" (raccomandata)

| Da ↓ \ A → | Home | Audience | Features | Pricing | Academy | FAQ | Journey™ | Studio |
|---|---|---|---|---|---|---|---|---|
| **Home** | — | secondary nav | secondary nav | secondary nav | footer | footer | **CTA hero** | **CTA hero** |
| **Audience** | logo | — | mid-CTA | footer | footer | footer | **CTA hero** | **CTA final** |
| **Features** | logo | inline link | — | inline link | mid-link | footer | **CTA hero** | **CTA final** |
| **Pricing** | logo | footer | inline link | — | inline link | inline link | **inline manifest link** | **CTA primary** |
| **Academy** | logo | footer | inline link | footer | — | inline link | **CTA secondary** | **CTA final** |
| **FAQ** | logo | footer | inline link | inline link | inline link | — | **CTA secondary** | **CTA primary** |
| **Journey™** | nav | mid-link | mid-link | mid-link | mid-link | footer | — | **CTA primary** |

### 8.2 Osservazioni
- **Journey™ riceve link da tutte le altre 6 pagine** ✅ (è l'orchestratore)
- **Journey™ rimanda solo a `/studio` come CTA primaria** ✅ (consolidazione confermata)
- **Studio è la destinazione finale di TUTTE le pagine** ✅ (singolo funnel)
- **Academy + FAQ acquisiscono cerniera con il main funnel** ✅ (gap risolto)
- **Pricing smette di rimandare a `/supporto` come CTA principale** ✅ (P0 dell'audit CTA confermato)

### 8.3 Hub & spoke pattern proposto

```
         (Home)
            │
            ▼
       (Design Journey™)  ←─── Audience · Features · Pricing · Academy · FAQ
            │                       ▲
            ▼                       │
        (Studio funnel)             │
                                    │
                              (Studio funnel risponde alla configurazione)
```

Design Journey™ è la **chiave di volta narrativa**. Lo Studio funnel è la **chiave di volta operativa**. Le 5 pagine satellite alimentano entrambe.

---

## 9 · LEXICAL CONSOLIDATION (vocabolario unificato)

Per evitare la deriva lessicale futura, definire un **glossario operativo** che vale per tutti gli editor di copy.

### 9.1 Termini canonici (sempre questi)

| Termine | Significato | Esempio d'uso |
|---|---|---|
| **Design Journey™** | la metodologia | *"Il vostro studio entra nel Design Journey™…"* |
| **Blueprint™** | l'infrastruttura editoriale | *"Configurate il vostro Blueprint™."* |
| **Configurazione** | l'atto di adattare Blueprint allo studio | *"Ogni configurazione è fatta per uno studio specifico."* |
| **Workspace editoriale** | sinonimo operativo di Blueprint, raro | *"Il workspace editoriale dello studio."* |
| **Infrastruttura editoriale** | sinonimo di Blueprint, premium | *"Blueprint è infrastruttura editoriale, non software."* |
| **Studio** | il cliente principale | *"Il vostro studio."* |
| **Cliente** | il committente del progetto | *"Il cliente legge la stessa storia che vedete voi."* |
| **Material Intelligence™** | la filosofia materica | *"Per MOOD, materiali sono decisioni — Material Intelligence™."* |
| **Project Memory** | la memoria longitudinale | *"Project Memory custodisce le decisioni."* |
| **Curatela** | il lavoro editoriale dello studio | *"La vostra curatela diventa traccia."* |
| **Decisione** | l'unità minima di valore nel Journey™ | *"Ogni decisione lascia una traccia."* |

### 9.2 Termini proibiti (mai usati, in nessuna pagina)

| Termine | Perché vietato | Sostituto |
|---|---|---|
| **Piattaforma** | Generic, SaaS-y, contraddice il manifesto Blueprint | Infrastruttura editoriale · workspace · configurazione |
| **Tool / Strumento (per Blueprint)** | Riduce Blueprint a utility | Infrastruttura · workspace |
| **App** | Mobile-first SaaS | (non usato) |
| **Dashboard** | UI vocabulary | Workspace · spazio di lavoro |
| **Feature** | Software vocabulary | Possibilità · capacità · attivazione |
| **Utente / User** | Generic SaaS | Studio · designer · cliente |
| **Plan / Piano** | Pricing SaaS | Configurazione |
| **Trial / Prova gratuita** | Vietato per posizionamento | (non offerto) |
| **Free / Gratis** | Posizionamento incompatibile | (non usato) |
| **Subscription / Abbonamento** | SaaS framing | Configurazione |
| **Power user** | Tech jargon | Studio esperto · profilo avanzato |
| **Onboarding** | SaaS jargon, ammesso solo internamente | Configurazione iniziale · inizio del Journey™ |
| **Engagement** | Marketing jargon | Conversazione · presenza |
| **Conversion rate / Funnel** | Marketing jargon | (non usato esternamente) |
| **All-in-one** | Marketing slogan | (vietato) |
| **Next-generation / Revolutionary / Game-changing** | Buzzwords | (vietati) |
| **AI-powered / Powered by AI** | Hype | Assistito dall'AI · l'AI nel Journey™ supporta… |

### 9.3 Espressioni canoniche (frasi-firma da preservare)

Queste frasi (oggi presenti o introdotte dal Journey™) sono parte dell'identità verbale MOOD. Devono essere preservate dagli editor futuri:

- *"Il design nasce dall'ascolto delle persone."* (Home — leitmotiv)
- *"Blueprint™ non si compra. Si configura."* (Pricing — già esistente, compatibile)
- *"Un progetto è una storia."* (Journey™ §01 hero)
- *"Le alternative scartate restano leggibili."* (Journey™ §05)
- *"Per MOOD, un materiale non è un articolo a catalogo: è una decisione."* (Journey™ §06)
- *"Un progetto custodito bene è il miglior business development che uno studio possa avere."* (Journey™ §10)

---

## 10 · CONSOLIDATION ACTION PLAN

Sintesi operativa delle modifiche raccomandate, in ordine di priorità.

### 🔴 P0 — Pre-launch del Design Journey™

| # | Azione | Pagina | Dove |
|---|---|---|---|
| 1 | Sostituire "piattaforma" con sinonimo canonico (infrastruttura editoriale · configurazione) | Home, Audience, Features, Training, Pricing | editorial_blocks |
| 2 | Spostare il manifesto anti-CRM (*"Blueprint non è un CRM, gestionale, moodboard…"*) da Features a Journey™ (esclusivo) | Features, Journey™ | editorial_blocks |
| 3 | Ridurre Pricing alla decisione pura: spostare le sezioni educative (intro + ecosystem) su Journey™ | Pricing | cms_sections (riordino visibilità) |
| 4 | Aggiornare tutti i CTA secondary delle 6 pagine satellite verso *"Esplora il Design Journey™"* → `/design-journey` | Home, Audience, Features, Pricing, Academy, FAQ | editorial_blocks + settings.links |
| 5 | Pricing tier CTAs: ripuntare a `/studio` invece di `/supporto` | Pricing | cms_sections settings.links |

### 🟡 P1 — Subito dopo il lancio

| # | Azione | Pagina | Dove |
|---|---|---|---|
| 6 | De-duplicare *"Vediamo se Blueprint è giusto per il tuo studio."* (tenerlo solo su Features) | Features, Pricing | editorial_blocks |
| 7 | Aggiungere su Pricing un blocco *"Cosa succede dopo aver cliccato"* (3 step) | Pricing | nuova cms_section |
| 8 | Cerniera Features → Academy: blocco finale *"Ogni configurazione include MOOD Academy"* | Features | editorial_blocks |
| 9 | Cerniera Academy → Journey™: introdurre link inline al Journey™ nelle anchor sections | Academy | settings.links |
| 10 | Popolare la FAQ con domande che rimandano al Journey™ per contesto metodologico | FAQ | faq_items |

### 🟢 P2 — Roadmap content (3–6 mesi)

| # | Azione | Pagina | Dove |
|---|---|---|---|
| 11 | Trust phase 1: 2–3 citazioni autorizzate inserite su Journey™ §05 e §11 | Journey™ | editorial_blocks |
| 12 | Trust phase 2: primo case study editoriale pubblicato sul magazine + linkato in §11 | Magazine + Journey™ | journal_articles |
| 13 | Trust phase 3: galleria opt-in di studi pilota | Audience, Features | nuove cms_sections |
| 14 | Pagina `/voci` o `/clienti` (life dello studio dopo l'adozione) | nuova pagina | cms_pages |
| 15 | Riscrittura completa di About per allinearlo a Journey™ (oggi è sparso) | About | editorial_blocks |

### 🟢 P3 — Long term

| # | Azione | Pagina | Dove |
|---|---|---|---|
| 16 | Manifesto PDF scaricabile (riscrittura editoriale del Journey™) | nuovo asset | static asset |
| 17 | Pagina dedicata `/per-showroom` se il programma showroom partner si avvia | nuova pagina | cms_pages |
| 18 | Pagina dedicata `/per-brand` se il programma brand si avvia | nuova pagina | cms_pages |

---

## 11 · LAUNCH READINESS CHECKLIST

Domande che richiedono ratifica utente **prima** di iniziare l'implementazione.

### Decisioni di lessico
- [ ] **Confermare il divieto della parola "piattaforma"** su tutto il sito front-of-house?
- [ ] **Confermare il glossario canonico** di §9.1 come unico vocabolario di riferimento?
- [ ] **Confermare la lista delle parole proibite** di §9.2 come policy editoriale interna?

### Decisioni di funzione
- [ ] **Confermare lo split funzionale**: Pricing decisione pura · Features operativa · Journey™ manifesto?
- [ ] **Confermare che il manifesto anti-CRM** vive solo su `/design-journey` (e va rimosso da `/caratteristiche`)?
- [ ] **Confermare il ruolo di orchestratore** del Journey™ rispetto alle altre 6 pagine?

### Decisioni di trust
- [ ] **Confermare l'approccio "manifesto senza prova esterna"** per il primo lancio?
- [ ] **Confermare l'apertura al programma pilot studios** per fase 1 di trust building?
- [ ] **Stabilire chi cura il programma pilot interviews** (founder · editor esterno · agenzia)?

### Decisioni di sequenza
- [ ] **Confermare l'ordine**: P0 prima di lanciare il Journey™ → P1 in parallelo → P2 nei 3–6 mesi successivi?
- [ ] **Decidere se il roll-out è "big bang"** (tutte le pagine consolidate il giorno X) o **progressivo** (pagina per pagina)?

---

## 12 · APPENDICE — Cosa NON è stato analizzato in questo audit

Per trasparenza sul perimetro:

- ❌ **Non analizzato**: contenuto del magazine (`/magazine`), che merita un audit dedicato
- ❌ **Non analizzato**: contenuto della galleria progetti (`/projects`), idem
- ❌ **Non analizzato**: contenuto della galleria materiali (`/materials`), idem
- ❌ **Non analizzato**: SEO meta tags e schema.org markup (audit tecnico separato)
- ❌ **Non analizzato**: localizzazione (EN-US, EN-GB, FR-FR, DE-DE, ES-ES, ES-MX) — sarà oggetto di un audit di traduzione dopo il consolidamento italiano
- ❌ **Non analizzato**: performance, accessibilità, SEO tecnico — fuori scope di questo documento
- ❌ **Non analizzato**: contenuti dell'area admin (Blueprint) — è back-of-house, non corporate

Questi punti restano disponibili come audit successivi, da richiedere quando opportuno.

---

*Documento di consolidazione del sito · MOOD for DESIGN · giugno 2026*
*Predecessor: `WEBSITE_CTA_CONSOLIDATION_REPORT.md` · `DESIGN_JOURNEY_*` trilogia.*
*Status: ⏳ Awaiting user ratification of the consolidation action plan (§10) and the launch readiness checklist (§11).*
