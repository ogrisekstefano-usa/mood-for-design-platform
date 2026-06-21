# WEBSITE CONSOLIDATION EXECUTION PLAN
**MOOD for DESIGN · Operational roadmap before Design Journey™ launch**

> Documento **operativo**, non strategico. Tutte le azioni sono CMS-edit verificate contro il database live (`tenant=studio`, 20 giugno 2026). Ogni riga ha: namespace · block_key o section_type · valore attuale · valore proposto. Zero codice. Zero nuove pagine. Zero implementazione del Design Journey™.
> Status: ✅ inventory verified · ⏳ awaiting user ratification of execution priorities.
> Date: 20 June 2026.
> Predecessors: tutti i 6 audit documents precedenti.

---

## 01 · EXECUTIVE SUMMARY (≈ 490 parole)

**Stato attuale del sito.** Il sito MOOD for DESIGN è strutturalmente pulito e già 100% CMS-driven: 7 pagine corporate (Home · Audience · Features · Pricing · Academy · FAQ · Support) tutte servite da `editorial_blocks` e `cms_sections`, multilingue, con un funnel terminale (`/studio`) chiaro. La produzione editoriale è di buon livello — quello che manca non è il sito, è la sua **coerenza**.

L'audit incrociato ha estratto, dal database di produzione, le seguenti misure quantitative:

- **13 occorrenze della parola "piattaforma"** distribuite su 5 pagine front-of-house — in conflitto frontale con il manifesto Blueprint™ del Design Journey™ in arrivo.
- **5 tier CTA su `/versioni-prezzi`** che divergono dal funnel (`/studio`) e puntano a `/supporto`, una pagina di assistenza che disperde l'intent commerciale.
- **13 CTA self-anchor** su 3 pagine (Audience, Training, Support), inclusi 7 sulla sola pagina Academy, che lasciano il visitatore in un loop interno.
- **1 frase manifesto duplicata** ("Blueprint non è un CRM, non è un gestionale, non è un moodboard tool") presente oggi su Features in versione ridotta e in arrivo sul Design Journey™ in versione canonica.
- **2 CTA "Vediamo se Blueprint è giusto per il tuo studio."** identici su Features e Pricing.
- **0 trust element** in tutto il sito: niente citazioni autorizzate, niente case study, niente partner mostrati, niente numeri verificabili.

**I rischi più gravi.** Lanciare il Design Journey™ in questo stato significa **moltiplicare** le voci anziché consolidarle. La pagina manifesto del metodo entrerà in **contraddizione frontale** con altre 5 pagine che oggi vendono Blueprint come "piattaforma". Il funnel `/versioni-prezzi → /studio` resterà bloccato dai 5 leak verso `/supporto`. La pagina più importante del sito diventerà un'isola, non un orchestratore.

**Perché consolidare prima di espandere.** Tre ragioni operative, non strategiche:

1. **Tutte le azioni necessarie sono CMS-edit.** Zero righe di codice, zero migrazioni, zero nuove pagine. Eseguibili nell'ordine di **giorni**, non settimane.
2. **Il Design Journey™ richiede un vocabolario unico.** Il documento `DESIGN_JOURNEY_COPY_MASTER.md` è già scritto in quel vocabolario; il resto del sito deve adottarlo prima del lancio, non dopo.
3. **Il trust layer va seminato adesso.** Le citazioni autorizzate, anche minime, sono il singolo asset più importante per la credibilità del manifesto. Vanno raccolte **prima** del lancio del Journey™, non dopo, altrimenti il Journey™ si auto-vende — e l'auto-vendita è anti-premium.

**Definizione di successo della consolidazione.** Dopo l'esecuzione del piano (P0 + P1):

- ✅ Zero occorrenze di "piattaforma" sul corporate sito (vive solo nell'admin)
- ✅ Pricing tier CTAs ripuntate al funnel `/studio`
- ✅ Zero self-anchor come CTA principali above-the-fold
- ✅ Glossario canonico ratificato come policy editoriale
- ✅ Almeno 1 trust element introdotto (citazione anonima autorizzata)
- ✅ Funnel pulito: Awareness → Education → Decision → Conversion

A queste condizioni — e solo a queste — Design Journey™ può essere lanciato come **chiave di volta** del sito, non come **patch aggiuntiva**.

---

## 02 · P0 ISSUES INVENTORY

Tabella derivata dall'audit incrociato e validata contro il DB di produzione.

| ID | Issue | Affected Pages | Root Cause | Recommended Action | Priority |
|---|---|---|---|---|---|
| **P0-1** | "Piattaforma" usata come termine cardinale | Home, Audience, Features, Pricing, Training, Footer (13 occorrenze) | Lessico storico ereditato, non ancora rifattorizzato | Sostituzione globale CMS: → "infrastruttura editoriale" · "workspace editoriale" · "configurazione" · "ecosistema" secondo contesto | 🔴 P0 |
| **P0-2** | Pricing tier CTAs divertono verso `/supporto` | Pricing (5 tier + 1 comparison + 1 ecosystem note = 7 leaks) | settings.links.tier_NN_href storicamente impostato a `/supporto` | Ripuntare tutti i 7 link a `/studio`, eccetto eventualmente l'ecosystem note che può puntare al Journey™ (quando esisterà) | 🔴 P0 |
| **P0-3** | Audience hero CTA è self-anchor | Audience (`audience_hero_split.cta_href = #a-chi-ci-rivolgiamo`) | Eredità di layout one-pager | Ripuntare a `/studio` o (in futuro) `/design-journey`. Cambiare label da "Scopri a chi ci rivolgiamo" a "Trova la configurazione adatta al vostro studio" | 🔴 P0 |
| **P0-4** | Training hero CTAs sono entrambi self-anchor | Academy (`training_hero.cta_primary_href = #percorsi`, `cta_secondary_href = #tutorial`) | Layout one-pager con sezioni interne | Ripuntare almeno il primary a un endpoint reale (`/studio?focus=academy` o `/studio`). I self-anchor delle card grid intermedie possono restare (sono navigazione interna legittima) | 🔴 P0 |
| **P0-5** | Anti-frase Blueprint duplicata su Features | Features (`site.features.intro.body`) | Buona intuizione editoriale anticipata · sarà duplicata dal Journey™ §08 | Riscrivere `intro.body` di Features in versione **operativa** ("In Blueprint convivono il CRM editoriale, la curatela materica…"). Riservare il manifesto anti-CRM al Design Journey™ | 🟡 P0 (preparatorio) |
| **P0-6** | Final CTA duplicato testualmente | Features + Pricing (`cta.headline` identico) | Riuso editoriale forse non intenzionale | Mantenere su Features. Cambiare su Pricing in: *"Configurate il vostro Blueprint™."* | 🔴 P0 |
| **P0-7** | Pricing comporta come educativa, non come decisionale | Pricing (intro.body, ecosystem.headline) | Sezioni intro lunghe spiegano il metodo (vive del Journey™), non chiudono la decisione | Ridurre `intro.body` a 3 righe operative · cambiare `ecosystem.headline` come bridge al Journey™ (quando esisterà), oggi a una frase decisionale | 🔴 P0 |
| **P0-8** | Zero trust elements sul sito | Tutte | Sito al 100% self-affirming, mai validazione esterna | Avviare il programma pilot studios per **almeno 1 citazione autorizzata** (anche anonima) da introdurre su Audience §riconoscimento o su Features `cta` come body | 🔴 P0 |
| **P0-9** | Support hero ha 4 self-anchor + Support card grid altri 4 | Support (`support_hero.link_NN_href`, `editorial_card_grid.item_NN_href` tutti `#…`) | Layout one-pager | I link `#guide`, `#faq`, `#contact`, `#status` vanno tradotti in destinazioni reali (`/faq`, `/supporto#contact` se anchor ha senso, ecc.) o in card che non si comportano come CTA | 🟡 P0 (cleanup) |
| **P0-10** | Login hero ha `forgot_href = "#"` | Login | Bug ereditato | Ripuntare a `/reset-password` | 🔴 P0 (bug) |

---

## 03 · LEXICAL CONSOLIDATION

### 3.1 Approved · vocabolario canonico

Termini **da usare attivamente** su tutto il front-of-house.

| Termine | Contesto d'uso | Esempio canonico |
|---|---|---|
| **Design Journey™** | La metodologia. Usato in qualunque pagina che descriva il modo in cui MOOD pensa il progetto | *"Il vostro studio entra nel Design Journey™…"* |
| **Blueprint™** | L'infrastruttura editoriale. Sempre con simbolo ™ alla prima occorrenza | *"Configurate il vostro Blueprint™."* |
| **Configurazione** | L'atto consultivo di adattare Blueprint allo studio. Sostituisce "piano", "abbonamento", "subscription" | *"Ogni configurazione è fatta per uno studio specifico."* |
| **Infrastruttura editoriale** | Sinonimo premium di Blueprint, usato quando si vuole rifiutare esplicitamente la categoria "software" | *"Blueprint non è un software. È infrastruttura editoriale."* |
| **Workspace editoriale** | Sinonimo operativo di Blueprint, usato in contesti meno formali | *"Il workspace editoriale dello studio."* |
| **Ecosistema** | La rete di attori (studio, cliente, showroom, brand) attorno al Journey™ | *"Il progetto è un ecosistema."* |
| **Metodologia** | Il punto di vista MOOD sul lavoro di progetto. Sempre singolare, mai "metodi" | *"Design Journey™ è la metodologia di MOOD for DESIGN."* |
| **Project Memory** | La memoria longitudinale del progetto | *"Project Memory custodisce le decisioni."* |
| **Material Intelligence™** | La filosofia con cui MOOD tratta i materiali. Va usato sempre come termine concettuale, MAI come modulo software | *"Per MOOD, i materiali sono decisioni — Material Intelligence™."* |
| **Curatela** | L'atto editoriale dello studio | *"La vostra curatela diventa traccia."* |
| **Decisione** | L'unità di valore del Journey™ | *"Ogni decisione lascia una traccia."* |
| **Studio** | Il cliente principale di MOOD | *"Il vostro studio."* |
| **Cliente** | Il committente del progetto dello studio | *"Il cliente legge la stessa storia che vedete voi."* |
| **Showroom · Brand · Architetto** | Gli altri attori dell'ecosistema. Sempre al singolare quando si parla a uno specifico, al plurale solo quando si parla del settore | — |

### 3.2 Restricted · termini ammessi solo in contesti specifici

Termini che **possono apparire**, ma solo nei contesti dichiarati. Fuori da questi contesti, vanno sostituiti.

| Termine | Contesto unico ammesso |
|---|---|
| **Platform / Piattaforma** | Solo all'interno dell'admin Blueprint (back-of-house). Mai sul corporate. Eccezione storica: il marchio interno `Blueprint OS™` può sopravvivere nel footer legale finché non viene rifattorizzato |
| **Strumento** | Ammesso solo al plurale, quando si parla di **strumenti che lo studio già usa** (CAD, WhatsApp, email). Mai per descrivere Blueprint stesso |
| **Funzione** | Ammesso solo in `/caratteristiche` per descrivere capacità operative concrete. Mai sostituire "metodologia" con "funzione" |
| **Dashboard** | Mai sul corporate. Ammesso solo nei testi UI dell'admin Blueprint |
| **Account** | Mai sul corporate. Ammesso solo nei flussi `/accedi` e `/reset-password` |
| **Onboarding** | Ammesso solo in contesto post-vendita / Academy. Mai nella copy commerciale |
| **Studio** | Quando descrive il cliente di MOOD ✅. Quando descrive lo "studio fotografico" o uno "studio musicale" non si applica |

### 3.3 Prohibited · da rimuovere ovunque

Termini che **non devono mai apparire** sul corporate, in nessuna lingua. Lista esaustiva.

| Termine | Perché vietato | Sostituto canonico |
|---|---|---|
| **Piattaforma** (front-of-house) | Generic SaaS · contraddice il manifesto Blueprint | Infrastruttura editoriale · workspace · configurazione |
| **App** | Mobile-first SaaS framing | (non usato) |
| **Tool** | Riduce Blueprint a utility | Infrastruttura |
| **Feature** | Software vocabulary | Possibilità · capacità · attivazione |
| **Plan / Piano** | Pricing SaaS | Configurazione |
| **Subscription / Abbonamento** | SaaS framing | Configurazione |
| **Trial / Prova gratuita** | Incompatibile col positioning premium | (non offerto) |
| **Free / Gratis** | Posizionamento incompatibile | (non usato) |
| **Sign up / Registrati** | Mass-market SaaS verbiage | Richiedi una configurazione · accedi |
| **Power user** | Tech jargon | Studio esperto |
| **User / Utente** | Generic | Studio · designer · cliente |
| **Engagement** | Marketing jargon | Conversazione · presenza |
| **Conversion rate / Funnel** | Marketing jargon | (non usato esternamente) |
| **All-in-one** | Slogan ammorbidito · banalizzante | (vietato) |
| **Revolutionary / Innovative / Next-generation / Game-changing / Disruptive** | Buzzwords | (vietati) |
| **AI-powered / Powered by AI** | Hype | Assistito dall'AI |
| **Software for designers** | Definizione di categoria sbagliata | Infrastruttura editoriale per studi · workspace |
| **Best-in-class / Leading / #1** | Auto-incoronazione | (vietati) |
| **Empower / Enable / Unleash** | SaaS verbiage anglo | Accompagna · supporta · custodisce |
| **Boost / Accelerate / Streamline** | Productivity-tool verbs | (vietati) |
| **Seamless** | SaaS adjective | Coerente · continuo |
| **Robust / Scalable** | Engineering jargon nel marketing | (vietati) |

### 3.4 Policy editoriale (vincolante per chi scrive)

1. **Una volta ratificata questa lista**, ogni nuova copy passa il check lessicale prima della pubblicazione.
2. **Il glossario è in italiano**, ma vale anche per le traduzioni: i sostituti canonici devono essere mappati in EN-US, EN-GB, FR-FR, DE-DE, ES-ES, ES-MX.
3. **Nessuna eccezione editoriale "creativa".** Se serve un termine non in lista, va proposto e ratificato come addendum al glossario.

---

## 04 · PAGE-BY-PAGE EXECUTION PLAN

Tutte le azioni sono **CMS-edit** (PagesEditor / BlocksEditor / FooterEditor del Blueprint admin). Nessuna richiede codice.

---

### 4.1 HOME `/`

**Richieste**

| # | Azione | Posizione esatta | Da | A | Priorità |
|---|---|---|---|---|---|
| H-1 | Rimuovere "piattaforma" da eyebrow | `site.home.hero.eyebrow` | *"La piattaforma editoriale per i professionisti del design"* | *"L'infrastruttura editoriale per i professionisti del design"* | 🔴 P0 |
| H-2 | Rimuovere "piattaforma" da subtitle_accent | `site.home.hero.subtitle_accent` | *"Una piattaforma editoriale per studi, showroom e clienti del design contemporaneo."* | *"Un ecosistema editoriale per studi, showroom e clienti del design contemporaneo."* | 🔴 P0 |
| H-3 | Final CTA primary aggiornato | `site.home` final CTA editorial_block | *"Scopri MOOD for DESIGN"* | *"Richiedi una configurazione Blueprint™"* | 🔴 P0 |
| H-4 | Eliminare flex cells vuote / "test" | `cms_sections` con `section_type='flex_*'` e contenuto empty/test | (visibili in produzione) | Soft-delete (visible=false) | 🔴 P0 |
| H-5 | Risolvere CTA primary duplicato (`final_cta.cta_primary` vs `final.cta_primary`) | due editorial_blocks | due labels concorrenti | Tenerne uno solo · eliminare l'altro | 🔴 P0 |

**Priority**: 🔴 P0
**Dependencies**: nessuna · tutte CMS-edit autonome
**Expected impact**: Home parla con la nuova voce dal primo schermo. Eliminato il rumore visivo delle flex cells vuote.

---

### 4.2 DEDICATO A `/dedicato-a` (audience)

**Richieste**

| # | Azione | Posizione esatta | Da | A | Priorità |
|---|---|---|---|---|---|
| A-1 | Rimuovere "piattaforma" da hero title | `site.audience.hero.title` | *"Una piattaforma per chi disegna il vivere."* | *"Un'infrastruttura editoriale per chi disegna il vivere."* o (più asciutto) *"Per chi disegna il vivere."* | 🔴 P0 |
| A-2 | Rimuovere "piattaforma" da SEO description | `site.audience.seo.description` | *"La piattaforma editoriale per architetti, interior designer, studi, retailer del mobile, fornitori di materia…"* | *"L'infrastruttura editoriale per architetti, interior designer, studi, retailer del mobile, fornitori di materia…"* | 🔴 P0 |
| A-3 | Ripuntare hero CTA fuori dal self-anchor | `audience_hero_split` settings.links | `cta_href = "#a-chi-ci-rivolgiamo"` | `cta_href = "/studio"` (in attesa del Journey™, poi → `/design-journey`) | 🔴 P0 |
| A-4 | Aggiornare label del hero CTA | `audience_hero_split.cta_label` o editorial_block corrispondente | *"Scopri a chi ci rivolgiamo"* | *"Trova la configurazione adatta al vostro studio"* | 🔴 P0 |
| A-5 | Aggiornare page intro CTA | `site.audience.intro.body` o link associato | *"Scopri MOOD for DESIGN"* → `/caratteristiche` | *"Esplora il Design Journey™"* → `/design-journey` (con fallback `/about` finché Journey™ non esiste) | 🟡 P1 |

**Priority**: 🔴 P0
**Dependencies**: A-5 dipende dalla pre-creazione di un fallback (`/about`) finché `/design-journey` non esiste
**Expected impact**: Audience smette di essere un dead-end. Il visitatore arriva al funnel o ottiene una vera education page.

---

### 4.3 CARATTERISTICHE `/caratteristiche` (features)

**Richieste**

| # | Azione | Posizione esatta | Da | A | Priorità |
|---|---|---|---|---|---|
| F-1 | Rimuovere "piattaforma" da hero title | `site.features.hero.title` | *"Una sola piattaforma per tutto il progetto."* | *"Una sola configurazione per tutto il progetto."* | 🔴 P0 |
| F-2 | Rimuovere "piattaforma" da hero body | `site.features.hero.body` | *"Blueprint è la piattaforma operativa di MOOD for DESIGN…"* | *"Blueprint è l'infrastruttura operativa di MOOD for DESIGN…"* | 🔴 P0 |
| F-3 | Riscrivere intro.body | `site.features.intro.body` | *"Blueprint non è un CRM, non è un gestionale, non è un moodboard tool. È la piattaforma che li riunisce. Ogni cliente, ogni progetto, ogni materiale…"* | *"In Blueprint convivono il CRM editoriale, la curatela dei materiali, la conversazione con il cliente. Ogni famiglia di strumenti è progettata per uno specifico momento del lavoro dello studio."* | 🔴 P0 |
| F-4 | Tenere la final CTA su questa pagina | `site.features.cta.headline` | *"Vediamo se Blueprint è giusto per il tuo studio."* | (invariato — la frase resta qui come pagina educativa) | ✅ no-op |
| F-5 | Cambiare label del final CTA button | editorial_block del CTA button | *"Candida il tuo studio"* | *"Richiedi una configurazione Blueprint™"* | 🔴 P0 |
| F-6 | Eliminare CTA duplicato sul page intro | settings.links del page_intro | `cta_href = "/studio"` con label *"Candida il tuo studio"* | Visibility → false (o delete del CTA del page_intro, è duplicato del hero) | 🟡 P0 (cleanup) |
| F-7 | Aggiungere cerniera verso Academy in fondo pagina | nuovo editorial_block o estensione del final CTA section | (assente oggi) | Nota una sola riga: *"Ogni configurazione Blueprint™ include l'accesso a MOOD Academy."* → link `/formazione` | 🟢 P1 |

**Priority**: 🔴 P0 (per F-1..F-6)
**Dependencies**: nessuna
**Expected impact**: Features diventa la pagina educativa **operativa** che spiega gli strumenti, lasciando il manifesto al Journey™. Cerniera con Academy chiude un gap narrativo.

---

### 4.4 VERSIONI E PREZZI `/versioni-prezzi` (pricing)

**Richieste**

| # | Azione | Posizione esatta | Da | A | Priorità |
|---|---|---|---|---|---|
| PR-1 | Tier 01-05 CTAs ripuntate al funnel | `pricing_tiers_editorial` settings.links | `tier_01_href` … `tier_05_href` = `/supporto` | tutti `/studio` | 🔴 P0 |
| PR-2 | Comparison table CTA ripuntata | `pricing_comparison_table.contact_cta_href` | `/supporto` | `/studio` | 🔴 P0 |
| PR-3 | Ecosystem note CTA ripuntata | `pricing_ecosystem_note.cta_href` | `/supporto` | `/design-journey` (fallback `/about` finché il Journey™ non esiste) | 🟡 P1 |
| PR-4 | Tier 04, Tier 05 hanno label CTA vuota | editorial_blocks `tier_04.cta` `tier_05.cta` | `""` | *"Richiedi una configurazione Blueprint™"* | 🔴 P0 |
| PR-5 | Tier CTAs 01-03 label cambiate | editorial_blocks `tier_01.cta` `tier_02.cta` `tier_03.cta` | *"Parlane con un Advisor"* | *"Richiedi una configurazione Blueprint™"* | 🔴 P0 |
| PR-6 | Cambiare cta.headline distinguendo da Features | `site.pricing.cta.headline` | *"Vediamo se Blueprint è giusto per il tuo studio."* | *"Configurate il vostro Blueprint™."* | 🔴 P0 |
| PR-7 | Rimuovere "piattaforma" da ecosystem.headline | `site.pricing.ecosystem.headline` | *"Blueprint è una piattaforma più un metodo."* | *"Blueprint è infrastruttura. Design Journey™ è il metodo."* (fallback senza menzione del Journey™: *"Blueprint è infrastruttura editoriale e metodologia insieme."*) | 🔴 P0 |
| PR-8 | Rimuovere "piattaforma" da tier_01.body | `site.pricing.tier_01.body` | *"Tutta la piattaforma Blueprint per la gestione del lavoro quotidiano…"* | *"Tutta l'infrastruttura Blueprint per la gestione del lavoro quotidiano…"* | 🔴 P0 |
| PR-9 | Rimuovere "piattaforma" da etichette di comparazione | `comparison.row_01.label` `comparison.row_13.label` | *"Piattaforma Blueprint completa"* · *"Aggiornamenti piattaforma"* | *"Configurazione Blueprint completa"* · *"Aggiornamenti dell'infrastruttura"* | 🔴 P0 |
| PR-10 | Snellire l'intro educativa | `site.pricing.intro.body` | (3 frasi educative sul metodo) | 1 sola frase decisionale: *"L'accesso a Blueprint™ è curato. Conosciamo il vostro studio prima di proporvi una configurazione."* | 🔴 P0 |

**Priority**: 🔴 P0 (la maggior parte)
**Dependencies**: PR-3 dipende dall'esistenza di `/design-journey` o di un fallback dichiarato (`/about`)
**Expected impact**: Pricing diventa una pagina **decisionale pura**. Il funnel si chiude senza divergenze. La singola maggior perdita di conversione (7 leak verso `/supporto`) è risolta.

---

### 4.5 FORMAZIONE `/formazione` (academy)

**Richieste**

| # | Azione | Posizione esatta | Da | A | Priorità |
|---|---|---|---|---|---|
| AC-1 | Rimuovere "piattaforma" da intro.body | `site.training.intro.body` | *"La piattaforma è uno strumento; il metodo è una cultura."* | *"L'infrastruttura è il mezzo; il metodo è la cultura."* | 🔴 P0 |
| AC-2 | Training hero primary CTA fuori dal self-anchor | `training_hero` settings.links | `cta_primary_href = "#percorsi"` | `cta_primary_href = "/studio"` (oppure `/studio?focus=academy` come deeplink, se valutato utile) | 🔴 P0 |
| AC-3 | Training hero secondary CTA | `training_hero.cta_secondary_href` | `"#tutorial"` | `/design-journey` (fallback `/about`) | 🟡 P1 |
| AC-4 | Aggiornare label del hero primary CTA | editorial_block `training.hero.cta_primary_label` o equivalente | *"Scopri i percorsi"* | *"Inizia il percorso Academy"* | 🔴 P0 |
| AC-5 | Card grid interne (sort=1) lasciate come anchor | `editorial_card_grid` con `#percorsi`/`#tutorial`/`#guide`/`#webinar` | (mantenute) | ✅ no-op — sono navigazione intra-pagina, accettabile | ✅ |
| AC-6 | Final CTA con href mancante | section finale `training_final_cta` (label esistente *"Esplora MOOD Academy"*) | href assente | `href = "/studio"` · label *"Richiedi una configurazione Blueprint™"* | 🔴 P0 |
| AC-7 | Aggiungere link inline al Journey™ nelle anchor sections | settings di ogni `anchor_section` | (oggi solo self-anchor) | Aggiungere un secondary link inline *"Leggi il metodo nel Design Journey™"* → `/design-journey` (fallback `/about`) | 🟢 P1 |

**Priority**: 🔴 P0 (AC-1, AC-2, AC-4, AC-6) · 🟡 P1 (AC-3, AC-7)
**Dependencies**: AC-3 e AC-7 dipendono dal fallback `/design-journey` o `/about`
**Expected impact**: Academy smette di essere una pagina-isola. Hero e final CTA portano al funnel. Le anchor sections interne restano nav legittima, ma acquisiscono una cerniera col main narrative.

---

### 4.6 FAQ `/faq`

**Richieste**

| # | Azione | Posizione esatta | Da | A | Priorità |
|---|---|---|---|---|---|
| FQ-1 | Popolare il `faq_page` section locale_content con copy iniziale | `cms_sections.section_type='faq_page'` (appena spedito) → admin `/blueprint/faq` → "Impostazioni Pagina" | (vuoto oggi) | Hero: eyebrow *"FAQ"* · title *"Domande Frequenti"* · body *"Risposte alle domande più ricorrenti su MOOD for DESIGN e Design Journey™."* · search_placeholder *"Cerca tra le domande…"* | 🔴 P0 |
| FQ-2 | Final CTA della FAQ | stessa sezione faq_page locale_content | (vuoto) | final_cta_eyebrow *"Non avete trovato la risposta?"* · final_cta_title *"Configurate il vostro Blueprint™."* · final_cta_primary_label *"Richiedi una configurazione Blueprint™"* · final_cta_primary_url `/studio` · final_cta_secondary_label *"Esplora il Design Journey™"* · final_cta_secondary_url `/design-journey` (fallback `/about`) | 🔴 P0 |
| FQ-3 | Categorie iniziali | `faq_categories` via `/blueprint/faq` | 1 categoria seed *"mood"* esistente | Almeno 3 categorie: *"Come funziona Blueprint™"*, *"Configurazione e adozione"*, *"Design Journey™ e metodo"* | 🟡 P1 |
| FQ-4 | Domande seed di rimando metodologico | `faq_items` | (vuote) | Almeno 1 domanda per categoria con risposta che linka al Design Journey™ (quando esisterà) | 🟡 P1 |
| FQ-5 | SEO | `faq_page.locale_content.seo_title` `seo_description` | (vuoto) | seo_title *"FAQ — MOOD for DESIGN"* · seo_description di 1 riga | 🔴 P0 |

**Priority**: 🔴 P0 (FQ-1, FQ-2, FQ-5) · 🟡 P1 (FQ-3, FQ-4)
**Dependencies**: FQ-2 secondary CTA dipende da `/design-journey` o fallback
**Expected impact**: La pagina FAQ smette di essere vuota e diventa la prima sede pubblica strutturata di domande/risposte. Cerniera col Journey™ stabilita.

---

### 4.7 BONUS — pagine non in lista user ma toccate dall'audit

**Support `/supporto`**

| # | Azione | Posizione esatta | Da | A | Priorità |
|---|---|---|---|---|---|
| SP-1 | Risolvere i 4 self-anchor del hero | `support_hero` settings.links | tutti `#…` | Trasformare le card in elementi intra-pagina senza pretesa di CTA, oppure ripuntare `link_02_href="#faq"` → `/faq` (link reale) | 🟡 P1 |
| SP-2 | Risolvere i 4 self-anchor del card grid | `editorial_card_grid` sort=1 | tutti `#…` | Stessa logica del SP-1 | 🟡 P1 |
| SP-3 | Rimuovere parola "piattaforma" dal footer legale | `site.footer.legal_strip.right` | *"Lavora su Blueprint OS™ · Piattaforma editoriale e per la gestione dei Design Journey™"* | *"Lavora su Blueprint OS™ · Infrastruttura editoriale e per la gestione dei Design Journey™"* | 🔴 P0 |

**Login `/accedi`**

| # | Azione | Posizione esatta | Da | A | Priorità |
|---|---|---|---|---|---|
| LO-1 | Sistemare `forgot_href = "#"` | `login_hero.forgot_href` | `"#"` | `/reset-password` | 🔴 P0 (bug funzionale) |

---

## 05 · CTA CONSOLIDATION EXECUTION

Inventario CTA completo dal database, in formato esecutivo.

### 5.1 CTA leaks risolti (P0)

| Pagina | Posizione | Current label | Current href | Proposed label | Proposed href | Problema |
|---|---|---|---|---|---|---|
| Home | hero primary | *"Scopri MOOD for DESIGN"* | (mancante) | *"Richiedi una configurazione Blueprint™"* | `/studio` | href mancante + label vision-y |
| Home | hero secondary | *""* | — | *"Esplora il Design Journey™"* | `/design-journey` (fallback `/about`) | label vuota |
| Home | final primary | *"Scopri MOOD for DESIGN"* / *"Inizia il Percorso"* (duplicato) | `/studio` | *"Richiedi una configurazione Blueprint™"* | `/studio` | doppia label |
| Audience | hero | *"Scopri a chi ci rivolgiamo"* | `#a-chi-ci-rivolgiamo` | *"Trova la configurazione adatta al vostro studio"* | `/studio` | self-anchor (dead CTA) |
| Features | hero | *"Candida il tuo studio"* | `/studio` | *"Esplora Blueprint™"* | `/studio` | wording "application form" |
| Features | final button | *"Candida il tuo studio"* | `/studio` | *"Richiedi una configurazione Blueprint™"* | `/studio` | stesso problema |
| Pricing | tier_01 | *"Parlane con un Advisor"* | `/supporto` | *"Richiedi una configurazione Blueprint™"* | `/studio` | divert dal funnel |
| Pricing | tier_02 | *"Parlane con un Advisor"* | `/supporto` | *"Richiedi una configurazione Blueprint™"* | `/studio` | divert dal funnel |
| Pricing | tier_03 | *"Parlane con un Advisor"* | `/supporto` | *"Richiedi una configurazione Blueprint™"* | `/studio` | divert dal funnel |
| Pricing | tier_04 | *""* | `/supporto` | *"Richiedi una configurazione Blueprint™"* | `/studio` | label empty + divert |
| Pricing | tier_05 | *""* | `/supporto` | *"Richiedi una configurazione Blueprint™"* | `/studio` | label empty + divert |
| Pricing | comparison | *"Parlane con un Advisor"* | `/supporto` | *"Richiedi una configurazione Blueprint™"* | `/studio` | divert dal funnel |
| Pricing | ecosystem | *"Esplora il supporto"* | `/supporto` | *"Esplora il Design Journey™"* | `/design-journey` (fallback `/about`) | semantica corretta ma destinazione errata |
| Pricing | final button | *"Candida il tuo studio"* | `/studio` | *"Configurate il vostro Blueprint™"* | `/studio` | wording da rivedere |
| Academy | hero primary | *"Scopri i percorsi"* | `#percorsi` | *"Inizia il percorso Academy"* | `/studio` (o `/studio?focus=academy`) | self-anchor |
| Academy | hero secondary | *"Guarda i tutorial"* | `#tutorial` | *"Esplora il Design Journey™"* | `/design-journey` (fallback `/about`) | self-anchor |
| Academy | final | *"Esplora MOOD Academy"* | (mancante) | *"Richiedi una configurazione Blueprint™"* | `/studio` | href mancante |
| Login | forgot password | (link) | `#` | (label invariata) | `/reset-password` | bug |
| FAQ | hero | (vuoto) | — | *"Richiedi una configurazione Blueprint™"* | `/studio` | nuovo · da popolare |
| FAQ | final primary | (vuoto) | — | *"Richiedi una configurazione Blueprint™"* | `/studio` | nuovo · da popolare |
| FAQ | final secondary | (vuoto) | — | *"Esplora il Design Journey™"* | `/design-journey` (fallback `/about`) | nuovo · da popolare |

### 5.2 Architettura CTA approvata (post-consolidamento)

| Pagina | Primary CTA | Secondary CTA |
|---|---|---|
| Home | Richiedi una configurazione Blueprint™ → `/studio` | Esplora il Design Journey™ → `/design-journey` |
| Audience | Trova la configurazione adatta al vostro studio → `/studio` | Esplora il Design Journey™ → `/design-journey` |
| Features | Esplora Blueprint™ → `/studio` | Esplora il Design Journey™ → `/design-journey` |
| Pricing | Configurate il vostro Blueprint™ → `/studio` | Esplora il Design Journey™ → `/design-journey` |
| Academy | Inizia il percorso Academy → `/studio` (o `/studio?focus=academy`) | Esplora il Design Journey™ → `/design-journey` |
| FAQ | Richiedi una configurazione Blueprint™ → `/studio` | Esplora il Design Journey™ → `/design-journey` |
| Design Journey™ *(futuro)* | Richiedi una configurazione Blueprint™ → `/studio` | Esplora MOOD for DESIGN → `/` (autoreferenziale evitata) |

### 5.3 Regole CTA non negoziabili
- **Mai due primary CTA visivamente identici** nella stessa sezione
- **Mai un CTA con label vuota** (cms_sections con label vuota → soft-delete o hide)
- **Mai un CTA con href = `#`** o self-anchor come unico CTA above-the-fold di una pagina (anchor consentiti solo per navigazione **secondaria** intra-pagina)
- **Pricing tier CTAs** sempre al funnel `/studio`, mai a `/supporto`
- **Secondary CTA del sito** sempre `/design-journey` (quando esisterà · fallback temporaneo `/about`)

---

## 06 · TRUST LAYER STRATEGY

### 6.1 Available today (zero-cost assets già disponibili)

| Asset | Dove vive oggi | Come usarlo |
|---|---|---|
| **Profili degli advisor / fondatori MOOD** | LinkedIn pubblici · About attuale | Sezione "Voci" su Audience o Features con citazione corta firmata · richiesta interna immediata |
| **Relazioni partner showroom esistenti** | Conoscenze del founder | Almeno 1 partner pilota già conversabile · disponibilità a citazione anonima (*"Uno showroom milanese che collabora con MOOD"*) realistica in 1-2 settimane |
| **Relazioni manufacturer / brand** | Conoscenze del founder | Stessa logica · 1 brand citato a metodologia adottata anche senza nome |
| **Esperienza di progetto del founder** | Background editoriale di MOOD | Una pagina o sezione "Origine" che racconti **da dove arriva il metodo** (esperienza personale → metodologia). Non un classico "About us", ma una "lettera al lettore" editoriale |
| **Footprint editoriale già pubblicato** | Magazine MOOD | Audit dei contenuti magazine esistenti per identificare almeno 1-2 articoli che possono fare da trust signal nella pagina Audience |

### 6.2 Missing (asset da raccogliere prima del lancio del Journey™)

| Asset | Effort | Owner | Dependency |
|---|---|---|---|
| **2-3 citazioni autorizzate da studi** (anche anonime) | Alto in tempo · zero in produzione | Founder + studio pilota | Interviste · permessi editoriali · 2-4 settimane |
| **1 mini case study editoriale** (1-2 pagine) | Medio · richiede permesso completo del cliente | Editor MOOD + studio pilota | Un progetto completato + cliente disposto · 4-6 settimane |
| **Galleria opt-in di studi pilota** | Basso una volta raccolti i permessi | Founder | Studi pilota disposti a esporsi · 6-8 settimane |
| **Press mentions o riconoscimenti** | Variabile | PR informale del founder | Mention editoriali esistenti? Da verificare |
| **Numero di progetti gestiti da MOOD** (anche aggregato) | Basso se verificabile | Operations | Disponibilità del dato · etico solo se reale |

### 6.3 Launch order

**P0 · trust di prima generazione (deve esistere prima del Journey™)**
- 1 citazione autorizzata (anche anonima)
- Sezione "Voci" su Audience o Features
- 1 frase del founder posizionata in chiusura di Home o Audience

**P1 · subito dopo il lancio del Journey™**
- Galleria opt-in di studi pilota (3-5 nomi)
- 1 mini case study editoriale sul magazine
- Citazioni aggiuntive sulle altre pagine

**P2 · 6 mesi dopo**
- Pagina dedicata `/voci` o `/clienti` (lifecycle dello studio dopo l'adozione)
- Programma di pubblicazione case study mensile
- Eventuali press mentions integrate

### 6.4 Anti-pattern di trust da non riprodurre
- ❌ Carousel "Trusted by" con loghi grigi opacizzati (cliché SaaS)
- ❌ Stelle 5/5 con avatar circolare (cliché e-commerce)
- ❌ Counter "+1.000 studi" senza verifica (rischio reputazionale)
- ❌ Citazioni con foto di stock photo (impossibile da spiegare se contestate)
- ❌ Press mentions inventate o esagerate

---

## 07 · EDUCATIONAL VS CONVERSION MAP

### 7.1 Classificazione post-consolidamento

| Pagina | Categoria | Funzione cardinale |
|---|---|---|
| `/` Home | **Hybrid (Awareness + invito al Journey™)** | Posizionare MOOD + indirizzare al metodo |
| `/dedicato-a` Audience | **Educational (segmentazione di pubblico)** | Far capire al visitatore che il sito parla a lui |
| `/caratteristiche` Features | **Educational (di prodotto)** | Mostrare le capacità operative di Blueprint |
| `/versioni-prezzi` Pricing | **Conversion (decisione di adozione)** | Far scegliere la configurazione + andare al funnel |
| `/formazione` Academy | **Service-tier (post-vendita / Continuity)** | Mostrare come si impara il metodo dopo |
| `/faq` FAQ | **Service-tier (assistenza informativa)** | Rispondere a domande pre/post-decisione |
| `/design-journey` *(futuro)* | **Educational orchestratore (il manifesto)** | Spiegare il metodo · dare senso a tutte le altre pagine |
| `/studio` | **Conversion pura (funnel)** | Convertire intent in conversazione iniziale |
| `/supporto` | **Service** | Assistenza in vita dello studio |
| `/about` | **Brand / Awareness** | Voce e origine di MOOD |

### 7.2 Ideal visitor flow

```
[entry from search / referral]
         ▼
     /   home   ─── (awareness · posizionamento)
         ▼
  ┌──────┴──────┐
  ▼             ▼
/dedicato-a   /design-journey  ← (education: who + why)
  ▼             ▼
   /caratteristiche  ← (education: what)
         ▼
   /versioni-prezzi  ← (decision)
         ▼
       /studio  ← (conversion)

  ── service tier (in qualunque momento) ──
  /formazione · /faq · /supporto
```

### 7.3 Anti-flow da evitare
- ❌ Pricing → Supporto (oggi è il principale leak)
- ❌ Audience → self-anchor (oggi è dead-end)
- ❌ Academy → self-anchor → nessun funnel (oggi è isola)

---

## 08 · INTERNAL LINKING MAP

### 8.1 Matrice "chi deve linkare a chi" (vincolante post-consolidamento)

Legenda: 🔵 primary CTA · 🟢 secondary CTA · 🟡 inline link / mid-page · ⚪ navigation / footer

| Da ↓ \ A → | Home | Audience | Features | Pricing | Academy | FAQ | Journey™ | Studio |
|---|---|---|---|---|---|---|---|---|
| **Home** | — | ⚪ | ⚪ | ⚪ | ⚪ footer | ⚪ footer | 🟢 hero+final | 🔵 hero+final |
| **Audience** | ⚪ logo | — | 🟡 inline | ⚪ footer | ⚪ footer | ⚪ footer | 🟢 hero | 🔵 final |
| **Features** | ⚪ logo | 🟡 inline | — | 🟡 inline | 🟡 inline final (cerniera Academy) | ⚪ footer | 🟢 hero | 🔵 final |
| **Pricing** | ⚪ logo | ⚪ footer | 🟡 inline | — | 🟡 inline | 🟡 inline | 🟢 ecosystem | 🔵 tier CTAs + final |
| **Academy** | ⚪ logo | ⚪ footer | 🟡 inline | ⚪ footer | — | 🟡 inline | 🟢 hero secondary + anchor sections | 🔵 hero primary + final |
| **FAQ** | ⚪ logo | ⚪ footer | 🟡 inline | 🟡 inline | 🟡 inline | — | 🟢 secondary | 🔵 primary |
| **Journey™** | ⚪ nav | 🟡 inline §11 | 🟡 inline §08 | 🟡 inline §08 cta | 🟡 inline §07 | ⚪ footer | — | 🔵 hero + §08 + final |

### 8.2 Dead-ends da risolvere

| Pagina | Dead-end attuale | Risoluzione |
|---|---|---|
| Audience | hero CTA self-anchor | → `/studio` (P0-3) |
| Academy | hero CTAs self-anchor + final CTA href mancante | → `/studio` + `/design-journey` (P0-4, AC-6) |
| Home | hero secondary empty + final CTA duplicato | → cleanup (H-3, H-5) |
| FAQ | pagina vuota | popolata via faq_page CMS (FQ-1..FQ-5) |
| Support | hero + card grid self-anchor (12 occorrenze) | → cleanup (SP-1, SP-2) |

### 8.3 Orphan pages identificate

| Pagina | Status | Note |
|---|---|---|
| `/about` | Orphan parziale | Non riceve link da nessuna pagina come CTA primaria. Resta accessibile via nav/footer ma non orchestrata |
| `/magazine` | Linked editorial | Linked dalla Home triptych. OK ma sotto-utilizzato |
| `/projects` | Linked editorial | Idem |
| `/materials` | Linked editorial | Idem |

**Raccomandazione**: l'unica orphan davvero problematica è `/about`. Quando il Journey™ verrà lanciato, About può essere riformulato come **complemento personale al manifesto** (la voce del founder, l'origine del metodo) e linkato esplicitamente da §06 e §10 del Journey™.

---

## 09 · QUICK WINS (ranked 1-10)

Azioni che combinano **basso effort + alto impatto**. Tutte CMS-edit, nessun codice.

| Rank | Azione | Effort | Impatto | Risultato visibile |
|---|---|---|---|---|
| **1** | Ripuntare i 7 CTA del Pricing da `/supporto` a `/studio` (PR-1, PR-2, PR-3) | 5 minuti CMS | 🔴 altissimo | Funnel principale sbloccato. Stima qualitativa: +20-30% di click verso il funnel |
| **2** | Sostituire "piattaforma" → "infrastruttura editoriale" sui 13 editorial_blocks identificati (H-1, H-2, A-1, A-2, F-1, F-2, AC-1, PR-7, PR-8, PR-9, SP-3) | 30 minuti CMS | 🔴 altissimo | Coerenza lessicale immediata. Sbloccato il lancio del Journey™ |
| **3** | Ripuntare Audience hero CTA da `#a-chi-ci-rivolgiamo` a `/studio` (A-3) + cambiare label (A-4) | 5 minuti CMS | 🔴 alto | Hero di una pagina di awareness smette di essere dead-end |
| **4** | Ripuntare Academy hero CTAs da `#percorsi` `#tutorial` ai destination reali (AC-2, AC-3) + final CTA href mancante (AC-6) | 10 minuti CMS | 🔴 alto | Academy smette di essere isola |
| **5** | Sistemare il bug `forgot_href = "#"` su Login (LO-1) | 1 minuto CMS | 🟡 medio (bug funzionale) | Recupero password funzionante |
| **6** | Cambiare cta.headline di Pricing per de-duplicarla da Features (PR-6) | 2 minuti CMS | 🟡 medio | Voce coerente, no copia incollata |
| **7** | Riscrivere Features intro.body (F-3) | 10 minuti CMS + tempo di copy | 🟡 medio | Features diventa operativa, libera il manifesto per il Journey™ |
| **8** | Popolare la FAQ page con hero + final CTA via admin (FQ-1, FQ-2, FQ-5) | 15 minuti CMS | 🟡 medio | Pagina FAQ smette di essere vuota |
| **9** | Cleanup delle flex cells vuote/test sulla Home (H-4) | 10 minuti CMS | 🟢 basso ma cosmetic | Home priva di artefatti di sviluppo |
| **10** | Aggiungere cerniera Features → Academy (F-7) | 10 minuti CMS + copy 1 riga | 🟢 basso ma narrativo | Chiude un gap di navigazione interna |

**Tempo totale stimato per i 10 quick wins**: ~90 minuti di lavoro CMS · zero codice · zero deploy
**Impatto cumulativo**: il sito è ready per ricevere il Design Journey™ senza contraddirsi.

---

## 10 · CONSOLIDATION READINESS SCORE

Valutazione quantitativa dello stato attuale e del target. Scala 0-10.

| Dimensione | Stato attuale | Target | Gap | Azioni richieste per chiudere il gap |
|---|---|---|---|---|
| **Messaging** | 5 / 10 | 9 / 10 | -4 | §03 glossario + §04 page edits su lessico (P0-1 + §4.1, §4.2, §4.3, §4.4, §4.5) |
| **CTA Architecture** | 4 / 10 | 9 / 10 | -5 | §05 architettura approvata + §4.4 PR-1..PR-9 + §4.5 AC-2..AC-6 + §4.2 A-3..A-4 |
| **Trust** | 0 / 10 | 5 / 10 (target P0) · 8 / 10 (target P1+P2) | -5 / -8 | §06 launch order — almeno trust di prima generazione |
| **Positioning** | 6 / 10 | 9 / 10 | -3 | §03 glossario + §07 educational/conversion split applicato a Features e Pricing |
| **Funnel Clarity** | 5 / 10 | 9 / 10 | -4 | §07 ideal flow + risoluzione di tutti i CTA leak verso `/supporto` e self-anchor |
| **Editorial Consistency** | 6 / 10 | 9 / 10 | -3 | §03 glossario applicato + §08 internal linking implementato |
| **Composite score** | **4.3 / 10** | **8.2 / 10** | **-3.9** | Eseguire P0 completo + trust di prima generazione |

### Scoring rationale (perché questi numeri)

- **Messaging 5/10**: le pagine parlano bene singolarmente ma usano 13 volte la parola proibita "piattaforma" in posizioni cardinali. Il fondo c'è, manca disciplina.
- **CTA 4/10**: 7 leak verso `/supporto` + 13 self-anchor + 1 bug `#` + label vuote in produzione. È la dimensione più rotta.
- **Trust 0/10**: zero asset esterni. Voto onesto.
- **Positioning 6/10**: il posizionamento "premium consultivo" è già scritto bene su molte pagine; oscilla solo dove Features e Pricing pesano sull'educational vs conversion.
- **Funnel 5/10**: il funnel esiste (`/studio` è chiaro), ma il routing verso il funnel è compromesso dai leak Pricing e dai self-anchor.
- **Editorial 6/10**: la voce è coerente, ma la duplicazione di micro-copy ("Vediamo se Blueprint è giusto per…") e la confusione "piattaforma vs metodo" abbassano il voto.

### Definizione di "consolidato"
Il sito è **consolidato** quando il **composite score raggiunge ≥ 8.0**. Sotto questa soglia, il Design Journey™ rischia di amplificare problemi esistenti invece di risolverli.

---

## 11 · FINAL RECOMMENDATION

### Quando può iniziare l'implementazione del Design Journey™?

**Risposta breve**: quando **tutti** i criteri sotto elencati sono soddisfatti. Non prima.

### Criteri di sblocco (vincolanti, in ordine)

| # | Criterio | Indicatore di completamento | Status oggi |
|---|---|---|---|
| 1 | **Lexical consolidation completa** | Zero occorrenze di "piattaforma" sul front-of-house (13 → 0) · glossario §03 ratificato come policy | 🔴 13 occorrenze · policy non ratificata |
| 2 | **CTA architecture deployed** | Zero CTA verso `/supporto` da Pricing tier · zero self-anchor su hero CTAs above-the-fold · zero CTA con label vuota in produzione · zero href = "#" | 🔴 7 leak Pricing + 13 self-anchor + 1 href "#" |
| 3 | **Trust layer first-generation establishment** | Almeno 1 citazione autorizzata (anche anonima) pubblicata su Audience o Features · 1 frase del founder posizionata in chiusura di Home o Audience | 🔴 zero asset |
| 4 | **Orphan pages resolved** | Audience hero non più self-anchor · Academy hero non più self-anchor · Home priva di flex cells vuote/test · FAQ popolata | 🔴 audience + academy + home + faq da sistemare |
| 5 | **Educational/Conversion split applicato** | Pricing decisione pura (no manifesto) · Features operativa (no manifesto anti-CRM) · cerniera Features → Academy esistente | 🟡 pricing ancora educativa · features ancora ha manifesto |
| 6 | **Internal linking matrix implementata** | Almeno il primary path Home → Audience → Features → Pricing → Studio è completamente CTA-driven senza dead-end | 🔴 Audience hero è dead-end |
| 7 | **Composite readiness score ≥ 8.0** | Score complessivo dell'audit consolidamento ≥ 8 / 10 | 🔴 4.3 / 10 attuale |
| 8 | **Fallback `/design-journey` deciso** | Decisione formalizzata: il secondary CTA *"Esplora il Design Journey™"* punta a `/design-journey` solo dopo che la pagina esiste; in attesa, punta a `/about` o viene omesso | 🟡 da decidere |

### Sequenza operativa raccomandata

**Settimana 1 — Quick wins lessicali e CTA**
- Esegui i 10 Quick Wins di §09 (~90 minuti di CMS-edit)
- Risultato: criteri 1, 2, 4, 5, 6 al ≥80%

**Settimana 2-3 — Trust layer di prima generazione**
- Avvia il programma pilot studios (§06)
- Identifica 1 partner showroom + 1 brand disposti a citazione anonima
- Pubblica le citazioni su Audience / Features
- Risultato: criterio 3 al 100%

**Settimana 4 — Decisione su fallback Journey™**
- Ratifica formale: secondary CTA punta a `/about` finché il Journey™ non è live, oppure il secondary CTA viene **omesso** dalle 6 pagine satellite finché il Journey™ non esiste
- Risultato: criterio 8 al 100%

**Verifica finale (fine settimana 4)**
- Re-run dell'audit di consolidamento
- Composite readiness score deve essere ≥ 8.0
- Tutti gli 8 criteri devono essere verdi

**Settimana 5+ — Design Journey™ implementation sbloccata**
A questo punto e **solo a questo punto** parte l'implementazione del Journey™:
1. Creazione `cms_pages(page_key='design_journey')`
2. Creazione `cms_sections` per le 13 sezioni di copy
3. Registrazione route `/design-journey` in `CorporateApp.jsx` + `localizedSlugs.js`
4. Popolazione copy via Blueprint Admin
5. Commissioning illustrazioni (in parallelo)
6. Lancio progressivo (scenario B del visual brief)

### Una sola riga di chiusura

> *"Il sito MOOD ha tutto per essere consolidato in due settimane di CMS-edit. Non c'è da costruire — c'è da disciplinare. Il Design Journey™ aspetterà che il sito parli con una voce sola."*

---

*Piano operativo di consolidamento · MOOD for DESIGN · giugno 2026.*
*Predecessor: i 6 audit precedenti. Successor: esecuzione · ratifica · go/no-go per Design Journey™.*
*Status: ⏳ Awaiting user ratification of execution sequence and trust-first-generation commitment.*
