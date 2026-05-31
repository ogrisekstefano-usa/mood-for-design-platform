# PRICING & POSITIONING REVISION
## MOOD for DESIGN™ · Features + Pricing Pages

> **Status**: DESIGN ONLY · in attesa di approvazione · zero codice · zero CMS update · zero deploy
> **Versione**: 2026-05-31
> **Scope**: revisione completa di `/features` e `/pricing` (copy + IA + positioning)
> **Vincoli utente**: nessun prezzo pubblico · tier raccontano modello adozione · 3 alternative naming · hero parte da problemi cliente · uso progressivo dei nomi proprietari · niente linguaggio aulico

---

## 1. Audit struttura attuale

### 1.1 Pagina `/features` — 5 item, 1 hero, 1 intro, 1 CTA

| Sezione (CMS namespace `site.features`) | Copy attuale (estratto) | Verdetto |
|---|---|---|
| `hero.eyebrow` | "L'ecosistema operativo" | ❌ "ecosistema" senza contesto |
| `hero.title` | "Strumenti che pensano come voi." | ❌ aulico, antropomorfico |
| `hero.subtitle` | "Moodboard, flussi di progetto, libreria materia, narrazione editoriale…" | ❌ liste di moduli senza problemi prima |
| `hero.body` | "MOOD si adatta al tuo modo di lavorare, non il contrario." | ⚠️ vago, frase generica |
| `intro.body` | "Non una suite di funzioni, ma una grammatica condivisa." | ❌ teatrale |
| `item_01` (Moodboards) | "Dai forma alle idee." | ⚠️ vuoto, non dice cosa fai |
| `item_02` (Design Journey™) | "Ogni progetto, nel suo percorso." | ❌ poetico |
| `item_03` (Media Library) | "Tutto il tuo mondo visivo." | ⚠️ astratto |
| `item_04` (Hotspot Storytelling) | "Racconta ogni dettaglio." | ❌ marketing-y |
| `item_05` (Editorial Magazine) | "Contenuti che costruiscono cultura." | ❌ autocelebrativo |
| `item_06..15` | vuoti | — slot disponibili |

**Diagnosi**:
- Pagina parte dai **moduli**, non dai problemi
- Tone aulico ovunque (`grammatica condivisa`, `forma alle idee`, `mondo visivo`)
- Nessun collegamento esplicito tra problema cliente → capability MOOD → modulo proprietario
- Nomi proprietari (Design Journey™) buttati senza contesto

### 1.2 Pagina `/pricing` — 4 tier dichiarati nel codice, 3 popolati nel CMS

| Sezione (CMS namespace `site.pricing`) | Copy attuale (estratto) | Verdetto |
|---|---|---|
| `hero.eyebrow` | "Versioni e accesso" | ⚠️ "versioni" è ambiguo |
| `hero.title` | "Un sistema, più atelier." | ❌ slogan |
| `hero.subtitle` | "MOOD si adatta alla dimensione e alla cultura del vostro studio…" | ⚠️ generico |
| `intro.body` | "L'accesso è curato. Ogni piano nasce dopo un dialogo…" | ⚠️ buono nel concetto, lessico aulico |
| `philosophy.eyebrow` | "Un invito, non una sottoscrizione" | ❌ teatrale |
| `philosophy.headline` | "Ogni studio entra in MOOD nel modo che gli appartiene." | ❌ aulico |
| `philosophy.body` | "non parliamo di piani, ma di modalità operative. Sono soglie diverse di intensità, profondità di accompagnamento…" | ❌ inintelligibile per un americano |
| **`tier_01` (Atelier individuale)** | "da € 89 / mese" + "Moodboards illimitate", "Design Journey personale", "Magazine editoriale integrato" | ❌ prezzo da rimuovere · nome aulico · features-list |
| **`tier_02` (Studio professionale)** | "da € 249 / mese" + "Onboarding cinematografico dedicato" | ❌ prezzo da rimuovere · "cinematografico" |
| **`tier_03` (Gruppo & multi-brand / Maison)** | "su richiesta" + "Editorial intelligence dedicata" + "Team relazionale a disposizione" | ❌ "editorial intelligence", "team relazionale" |
| `tier_04`, `tier_05` | vuoti | — |
| `comparison` (tabella 4 tier) | "Essential / Studio / Professional / Enterprise" con righe: Utenti, Moodboard, Libreria, Design Journey, Client Portal, Analytics, Integrazioni, Supporto, Formazione | ⚠️ tier NAMES non coincidono con le card (incoerenza) · concetti tecnici esposti senza spiegazione |
| `ecosystem.eyebrow` | "Più che un software" | ❌ cliché |
| `ecosystem.headline` | "Entrare in MOOD significa entrare in un metodo." | ❌ autocelebrativo |
| `ecosystem.pillar_03_body` | "Un riferimento umano — non un ticket." | ⚠️ buona ma da rifinire |
| `cta.label` | "Richiedi una demo" | ⚠️ "demo" è linguaggio SaaS, può evolvere |

**Diagnosi**:
- **Incoerenza tier**: card hanno 3 nomi (Atelier/Studio/Gruppo), tabella ne ha 4 diversi (Essential/Studio/Professional/Enterprise). Risultato: utente confuso
- **Prezzi pubblicati** (€89, €249) → da rimuovere per nuova policy
- **Tone irriducibile**: "atelier indipendente", "onboarding cinematografico", "intelligence editoriale dedicata", "team relazionale" → tutto da riscrivere
- **Philosophy section** dice la cosa giusta in modo sbagliato: il concetto "accesso curato dopo dialogo" è ottimo, il copy lo seppellisce
- **Mancanza di legame** tra tier e problema risolto: oggi i tier si distinguono per numero utenti/GB, non per momento dello studio

### 1.3 Component frontend esistenti (intoccati in questa revisione)

| Component | Sezione | Note |
|---|---|---|
| `FeatureHeroSplit` | Features hero | OK strutturalmente |
| `FeatureNarrative` | Features intro | OK |
| `FeatureNumberedList` | Features items | OK |
| `PricingHeroCinematic` | Pricing hero | Rinominabile mentalmente come "Hero" — il "Cinematic" sparisce dal copy |
| `PricingPhilosophy` | Pricing manifesto | OK strutturalmente, copy da rifare |
| `PricingTiersEditorial` | Tier cards | OK |
| `PricingCards` | Card alternativa | — non usata nella revisione |
| `PricingComparisonTable` | Tabella comparativa | OK strutturalmente |
| `PricingEcosystemNote` | Footer note | OK |

**Decisione IA (utente: 1b)**: usiamo gli stessi component, riordinati e con copy nuovo. Possibile rimuovere `PricingPhilosophy` se la nuova narrativa lo rende ridondante (decisione finale in §3).

---

## 2. Proposta nuova struttura `/features`

### 2.1 Principio di costruzione

> **La pagina parte dai problemi che lo studio vive ogni giorno. I moduli proprietari emergono come risposta, non come catalogo.**

### 2.2 Information Architecture proposta

```
┌─────────────────────────────────────────────────────────────────┐
│  /features                                                       │
│                                                                  │
│  [1] HERO — Il problema (FeatureHeroSplit)                       │
│      Eyebrow:  "Blueprint"                                       │
│      Title:    "Una sola piattaforma per tutto il progetto."     │
│      Subtitle: Frase che dichiara il problema                    │
│      CTA:      "Candida il tuo studio"                           │
│                                                                  │
│  [2] CONTEXT — Cosa Blueprint organizza (FeatureNarrative)       │
│      Una sezione testuale che dichiara:                          │
│      "Blueprint organizza e registra ogni fase del Design        │
│       Journey: dal primo contatto alla selezione dei materiali,  │
│       dalla presentazione al cliente fino all'avanzamento."      │
│                                                                  │
│  [3] FUNZIONALITÀ — 6 item operativi (FeatureNumberedList)       │
│      Sequenza problema → capability MOOD → modulo                │
│                                                                  │
│      01. Organizzare clienti e contatti                          │
│      02. Strutturare il progetto in fasi                         │
│      03. Gestire materiali, finiture e fornitori                 │
│      04. Presentare le proposte al cliente                       │
│      05. Coordinare il team interno                              │
│      06. Costruire la presenza editoriale dello studio           │
│                                                                  │
│  [4] PROGRESSIVE NAMING — I tre layer (FeatureNarrative)         │
│      Solo qui appaiono i nomi proprietari, con contesto:         │
│      • Design Journey™                                           │
│      • Material Intelligence™                                    │
│      • Moodboard Experience™                                     │
│                                                                  │
│  [5] CTA finale                                                  │
│      "Candida il tuo studio" → /studio                           │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Copy proposto (IT source) — sezione per sezione

#### [1] HERO — `FeatureHeroSplit`
| key (proposta) | nuovo copy IT |
|---|---|
| `site.features.hero.eyebrow` | `Blueprint` |
| `site.features.hero.title` | `Una sola piattaforma per tutto il progetto.` |
| `site.features.hero.subtitle` | `Tieni insieme clienti, progetti, materiali, presentazioni e team. Smetti di rincorrere file, mail e fogli sparsi.` |
| `site.features.hero.body` | `Blueprint è la piattaforma operativa di MOOD for DESIGN. Organizza e registra ogni fase del Design Journey: dal primo contatto alla selezione dei materiali, dalla presentazione al cliente fino all'avanzamento del progetto.` |
| `site.features.hero.cta` | `Candida il tuo studio` |

#### [2] CONTEXT — `FeatureNarrative`
| key | nuovo copy IT |
|---|---|
| `site.features.context.eyebrow` | `Cosa fa Blueprint` |
| `site.features.context.headline` | `Tutto il lavoro dello studio in un unico posto.` |
| `site.features.context.body` | `Blueprint non è un CRM, non è un gestionale, non è un moodboard tool. È la piattaforma che li riunisce. Ogni cliente, ogni progetto, ogni materiale e ogni decisione restano collegati e ricostruibili nel tempo.` |

#### [3] FUNZIONALITÀ — 6 item (`FeatureNumberedList`)

Pattern di ogni item: **eyebrow** (capability operativa) → **title** (cosa accade) → **body** (problema risolto in 1–2 righe).

| key | eyebrow | title | body |
|---|---|---|---|
| `…item_01.*` | Clienti & contatti | Ogni relazione documentata. | Anagrafiche, conversazioni, contesto del cliente. Niente più appunti dispersi tra mail e telefonate. |
| `…item_02.*` | Fasi di progetto | Il progetto strutturato per momenti. | Dal brief alla consegna, ogni fase del lavoro è una sezione consultabile. Tu sai sempre a che punto sei. |
| `…item_03.*` | Materiali & fornitori | Una libreria materiali sempre aggiornata. | Schede tecniche, listini, contatti fornitori. Disponibili per tutto il team, ricercabili in pochi click. |
| `…item_04.*` | Presentazione al cliente | Moodboard e proposte pronte da condividere. | Preparare una presentazione richiede meno tempo. Il cliente la riceve in un formato curato, senza email allegate. |
| `…item_05.*` | Coordinamento team | Ruoli, accessi, attività in chiaro. | Designer, junior, project manager: ognuno vede ciò che serve. Le revisioni interne non si perdono. |
| `…item_06.*` | Presenza editoriale | Lo studio racconta i suoi progetti. | Una sezione magazine integrata. Pubblichi quando vuoi, senza dipendere da agenzie esterne. |

#### [4] PROGRESSIVE NAMING — `FeatureNarrative` con 3 mini-blocchi
| key | copy IT |
|---|---|
| `site.features.layers.eyebrow` | `Sotto la superficie` |
| `site.features.layers.headline` | `Tre strumenti che lavorano insieme.` |
| `site.features.layers.body` | `Quello che vedi in Blueprint è la sintesi di tre layer specializzati che operano dietro le quinte.` |
| `site.features.layers.l1.title` | `Design Journey™` |
| `site.features.layers.l1.body` | `Mantiene la storia di ogni progetto. Cosa è stato deciso, quando, da chi.` |
| `site.features.layers.l2.title` | `Material Intelligence™` |
| `site.features.layers.l2.body` | `Tiene insieme materiali, fornitori, schede tecniche e prezzi. Aggiornati per tutto lo studio.` |
| `site.features.layers.l3.title` | `Moodboard Experience™` |
| `site.features.layers.l3.body` | `Trasforma idee, immagini e materiali in presentazioni condivisibili in pochi minuti.` |

#### [5] CTA FINALE — `FeatureNarrative` o sezione dedicata
| key | copy IT |
|---|---|
| `site.features.cta.eyebrow` | `Pronto a iniziare?` |
| `site.features.cta.headline` | `Vediamo se Blueprint è giusto per il tuo studio.` |
| `site.features.cta.body` | `La candidatura richiede 3 minuti. Un Advisor MOOD ti contatterà per definire la configurazione più adatta.` |
| `site.features.cta.label` | `Candida il tuo studio` |
| `site.features.cta.link` | `/studio` |

### 2.4 Slot inutilizzati
- `item_07..15` vuoti → resteranno vuoti (lista di 6 voci è il target). Non riempire per riempire.
- Vecchie chiavi (`hero.title="Strumenti che pensano come voi"`, etc.): saranno sovrascritte dalle nuove. Vecchi values restano in `site_blocks_history` (se feature esistente) o vanno persi per la nuova adozione (decisione su retention da prendere prima dell'implementazione, non bloccante).

---

## 3. Proposta nuova struttura `/pricing`

### 3.1 Principio di costruzione

> **Pricing racconta il modello di adozione di Blueprint™. Non è un listino. Mostra "come si entra in MOOD" e "in che configurazione".** I prezzi non compaiono.

### 3.2 Information Architecture proposta

```
┌─────────────────────────────────────────────────────────────────┐
│  /pricing                                                        │
│                                                                  │
│  [1] HERO — Il modello (PricingHeroCinematic)                    │
│      Dichiara: "Blueprint si entra dopo un dialogo con un        │
│      Advisor. Non c'è un piano standard. C'è la configurazione   │
│      giusta per il tuo studio."                                  │
│                                                                  │
│  [2] HOW IT WORKS — Il percorso (PricingPhilosophy, ridisegnato) │
│      3 step orizzontali:                                         │
│      01. Candidatura  →  02. Dialogo Advisor  →  03. Attivazione │
│                                                                  │
│  [3] TIER NARRATIVI — 3 configurazioni (PricingTiersEditorial)   │
│      Niente prezzi. Ogni tier descrive:                          │
│      • per chi è                                                 │
│      • cosa contiene la configurazione                           │
│      • livello di accompagnamento                                │
│      CTA: "Parlane con un Advisor"                               │
│                                                                  │
│  [4] CONFRONTO CAPABILITY (PricingComparisonTable, ripensata)    │
│      Tabella che mostra cosa è incluso in ogni tier.             │
│      Niente celle quantitative (GB, n. utenti). Solo capability  │
│      e livello di accompagnamento.                               │
│                                                                  │
│  [5] ACCOMPAGNAMENTO — Più di un software (PricingEcosystemNote) │
│      3 pilastri: Onboarding curato · Formazione continua ·       │
│      Advisor dedicato                                            │
│                                                                  │
│  [6] FAQ minima (nuova, opzionale)                               │
│      4-5 domande tipiche di prospect B2B                         │
│                                                                  │
│  [7] CTA finale                                                  │
│      "Candida il tuo studio" → /studio                           │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Copy proposto (IT source)

#### [1] HERO — `PricingHeroCinematic`
| key | copy IT |
|---|---|
| `site.pricing.hero.eyebrow` | `Modalità di adozione` |
| `site.pricing.hero.title` | `Blueprint non si compra. Si configura.` |
| `site.pricing.hero.subtitle` | `Ogni studio ha la propria dimensione, il proprio team e i propri clienti. La configurazione di Blueprint nasce dopo un dialogo con un Advisor MOOD.` |
| `site.pricing.hero.body` | `Non c'è un listino pubblico. C'è la configurazione giusta per il tuo studio.` |

#### [2] HOW IT WORKS — `PricingPhilosophy` o nuova sezione dedicata
| key | copy IT |
|---|---|
| `site.pricing.flow.eyebrow` | `Come si entra in Blueprint` |
| `site.pricing.flow.headline` | `Tre passaggi, due settimane in media.` |
| `site.pricing.flow.body` | `L'accesso a Blueprint è curato. Vogliamo conoscere il tuo studio prima di proporti la configurazione.` |
| `site.pricing.flow.step_01.label` | `01 · Candidatura` |
| `site.pricing.flow.step_01.body` | `Compili la candidatura in 3 minuti. Raccogliamo categoria, sede, lingue operative, priorità.` |
| `site.pricing.flow.step_02.label` | `02 · Dialogo Advisor` |
| `site.pricing.flow.step_02.body` | `Un Advisor MOOD analizza la richiesta e ti contatta. Insieme definiamo la configurazione adatta.` |
| `site.pricing.flow.step_03.label` | `03 · Attivazione` |
| `site.pricing.flow.step_03.body` | `Ricevi il tuo workspace Blueprint dedicato. Il team viene formato. Sei operativo.` |

#### [3] TIER NARRATIVI — `PricingTiersEditorial`

> I tre tier sono **narrativi**, descrivono il momento dello studio. Nomi finali in §4 (3 alternative). Qui uso placeholder neutri `T1/T2/T3`.

| key | copy IT (T1) |
|---|---|
| `site.pricing.tier_01.eyebrow` | `<<NAME_T1>>` |
| `site.pricing.tier_01.title` | `Per chi inizia con MOOD.` |
| `site.pricing.tier_01.subtitle` | `Studio individuale o team ristretto che vuole strutturare il lavoro.` |
| `site.pricing.tier_01.body` | `Tutta la piattaforma Blueprint per la gestione del lavoro quotidiano. Onboarding guidato, supporto email, formazione iniziale.` |
| `site.pricing.tier_01.inc_1` | `Blueprint completa` |
| `site.pricing.tier_01.inc_2` | `Onboarding guidato` |
| `site.pricing.tier_01.inc_3` | `Formazione iniziale` |
| `site.pricing.tier_01.inc_4` | `Supporto email` |
| `site.pricing.tier_01.inc_5` | `Aggiornamenti continui` |
| `site.pricing.tier_01.price` | _(vuoto — nessun prezzo pubblico)_ |
| `site.pricing.tier_01.cta` | `Parlane con un Advisor` |

T2 (`tier_02`):
| key | copy IT |
|---|---|
| `…tier_02.eyebrow` | `<<NAME_T2>>` |
| `…tier_02.title` | `Per lo studio strutturato.` |
| `…tier_02.subtitle` | `Team di 5–15 persone, progetti articolati, più mercati.` |
| `…tier_02.body` | `Tutta la configurazione di <<NAME_T1>> più: accessi team avanzati, workspace personalizzato, supporto prioritario, Advisor di riferimento.` |
| `…tier_02.inc_1` | `Tutto della modalità <<NAME_T1>>` |
| `…tier_02.inc_2` | `Accessi team avanzati` |
| `…tier_02.inc_3` | `Workspace personalizzato` |
| `…tier_02.inc_4` | `Supporto prioritario` |
| `…tier_02.inc_5` | `Advisor di riferimento` |
| `…tier_02.price` | _(vuoto)_ |
| `…tier_02.cta` | `Parlane con un Advisor` |

T3 (`tier_03`):
| key | copy IT |
|---|---|
| `…tier_03.eyebrow` | `<<NAME_T3>>` |
| `…tier_03.title` | `Per il gruppo e il brand.` |
| `…tier_03.subtitle` | `Più studi, più mercati, più brand sotto la stessa governance.` |
| `…tier_03.body` | `Configurazione su misura. Multi-tenant, governance condivisa, integrazioni dedicate, Advisor e team relazionale dedicati.` |
| `…tier_03.inc_1` | `Tutto della modalità <<NAME_T2>>` |
| `…tier_03.inc_2` | `Multi-tenant e multi-brand` |
| `…tier_03.inc_3` | `Integrazioni su misura` |
| `…tier_03.inc_4` | `Advisor dedicato` |
| `…tier_03.inc_5` | `Workshop strategici` |
| `…tier_03.price` | _(vuoto)_ |
| `…tier_03.cta` | `Parlane con un Advisor` |

**Tier 04 e 05** → rimangono vuoti. La nuova narrativa è a 3 tier.

#### [4] CONFRONTO CAPABILITY — `PricingComparisonTable`

Tabella che racconta cosa è incluso. Niente numeri quantitativi. Niente prezzo.

| Row label | `<<T1>>` | `<<T2>>` | `<<T3>>` |
|---|---|---|---|
| Piattaforma Blueprint completa | ✓ | ✓ | ✓ |
| Design Journey™ | ✓ | ✓ | ✓ |
| Material Intelligence™ | ✓ | ✓ | ✓ |
| Moodboard Experience™ | ✓ | ✓ | ✓ |
| Editorial Magazine integrato | ✓ | ✓ | ✓ |
| Accessi team | Singolo / piccolo | Esteso | Multi-studio |
| Workspace personalizzato | Standard | Avanzato | Su misura |
| Multi-tenant / multi-brand | — | — | ✓ |
| Integrazioni con sistemi terzi | — | Standard | Su misura |
| Onboarding | Guidato | Strutturato | Dedicato |
| Formazione | Iniziale | Continua | Workshop strategici |
| Supporto | Email | Prioritario | Advisor dedicato |
| Aggiornamenti piattaforma | ✓ | ✓ | ✓ |

> Eliminate righe attuali tipo "GB libreria 10/100/500/Illimitata" — sono dettaglio implementativo, non narrazione di valore.

CMS mapping nuove rows (proposta):
- `site.pricing.comparison.row_01.label` = `Piattaforma Blueprint completa`
- `site.pricing.comparison.row_01.t1/t2/t3` = `✓/✓/✓`
- … etc, 13 rows totali

Drop delle vecchie `row_01..09` con concetti tecnici (GB, n. utenti) → rimpiazzate.

#### [5] ACCOMPAGNAMENTO — `PricingEcosystemNote`

| key | copy IT |
|---|---|
| `site.pricing.ecosystem.eyebrow` | `Più di un software` |
| `site.pricing.ecosystem.headline` | `Blueprint è una piattaforma più un metodo.` |
| `site.pricing.ecosystem.body` | `Entrare in MOOD significa essere accompagnati: dall'onboarding alla formazione, fino al supporto operativo continuo.` |
| `site.pricing.ecosystem.pillar_01.title` | `Onboarding curato` |
| `site.pricing.ecosystem.pillar_01.body` | `Importazione dei progetti esistenti, configurazione del workspace, prima formazione del team.` |
| `site.pricing.ecosystem.pillar_02.title` | `Formazione continua` |
| `site.pricing.ecosystem.pillar_02.body` | `Sessioni periodiche, materiali aggiornati, accesso a una community di studi che condividono pratiche.` |
| `site.pricing.ecosystem.pillar_03.title` | `Advisor di riferimento` |
| `site.pricing.ecosystem.pillar_03.body` | `Una persona MOOD ti conosce e ti segue. Non un ticket, non un chatbot.` |
| `site.pricing.ecosystem.cta_label` | `Vedi come ti accompagniamo` (link a contact / advisor page) |

#### [6] FAQ MINIMA (nuova, opzionale)

| key | copy IT |
|---|---|
| `site.pricing.faq.headline` | `Le domande più frequenti.` |
| `site.pricing.faq.q1` | `Perché non vedo i prezzi?` |
| `site.pricing.faq.a1` | `Blueprint non ha un listino standard. La configurazione dipende da come lavora il tuo studio, quanti siete, in quanti mercati operate. L'Advisor MOOD definisce la configurazione e il piano insieme a te.` |
| `site.pricing.faq.q2` | `Quanto tempo serve per essere operativi?` |
| `site.pricing.faq.a2` | `Dalla candidatura all'attivazione del workspace passano in media due settimane.` |
| `site.pricing.faq.q3` | `Posso cambiare configurazione nel tempo?` |
| `site.pricing.faq.a3` | `Sì. Le configurazioni evolvono con lo studio. Ne parli con il tuo Advisor di riferimento.` |
| `site.pricing.faq.q4` | `Cosa succede se decido di non continuare?` |
| `site.pricing.faq.a4` | `I tuoi dati restano tuoi. Sono esportabili in qualsiasi momento.` |

#### [7] CTA FINALE
| key | copy IT |
|---|---|
| `site.pricing.cta.headline` | `Vediamo se Blueprint è giusto per il tuo studio.` |
| `site.pricing.cta.body` | `La candidatura richiede 3 minuti. Un Advisor MOOD ti contatterà entro 2 giorni lavorativi.` |
| `site.pricing.cta.label` | `Candida il tuo studio` |
| `site.pricing.cta.link` | `/studio` |

---

## 4. Tre alternative di tier naming

> Tutte e tre rispettano: 3 tier · nomi internazionali (sopravvivono in IT/EN/FR/DE/ES) · zero numeri o livelli ("Tier 1/2/3" no) · raccontano un **momento dello studio**, non una taglia.

### 4.1 Alternativa A — Configuration Names *(consigliata)*

| Tier | Nome | Per chi |
|---|---|---|
| T1 | **Blueprint Studio** | Studio individuale o team ristretto |
| T2 | **Blueprint Atelier** | Studio strutturato, 5–15 persone, più mercati |
| T3 | **Blueprint Maison** | Gruppi, brand, network multi-studio |

**Razionale**
- Pattern `Blueprint + qualifier` unifica il brand
- "Studio" è universale e neutro (US/UK/IT/FR/DE/ES)
- "Atelier" e "Maison" sono internazionalmente comprensibili nel mondo del design senza essere ridicoli
- Coerente con la decisione canonical doc (Blueprint Origin™ tier)
- Funziona in EN: "Blueprint Studio · Blueprint Atelier · Blueprint Maison" — suona premium ma sobrio

**Rischio**: "Maison" può suonare un filo francese-luxury. Mitigation: nel copy del tier non enfatizziamo il nome, lo presentiamo come configurazione.

### 4.2 Alternativa B — Phase Names

| Tier | Nome | Per chi |
|---|---|---|
| T1 | **Foundation** | Studio individuale o team ristretto |
| T2 | **Practice** | Studio strutturato, 5–15 persone |
| T3 | **Network** | Gruppi, brand, network multi-studio |

**Razionale**
- Naming **funzionale**, descrive lo stadio di maturità dello studio
- Internazionale (parole comuni IT/EN/FR/DE/ES)
- Più "tech B2B" che "luxury"
- Funziona benissimo in EN: "Foundation · Practice · Network"

**Rischio**: "Foundation" può essere confuso con "entry-level/economy" → meno premium. "Practice" è universale ma poco evocativo.

### 4.3 Alternativa C — Plain Configuration

| Tier | Nome | Per chi |
|---|---|---|
| T1 | **Blueprint Essential** | Studio individuale o team ristretto |
| T2 | **Blueprint Professional** | Studio strutturato |
| T3 | **Blueprint Enterprise** | Gruppi, brand, network |

**Razionale**
- Linguaggio standard B2B SaaS, immediatamente comprensibile
- Zero rischio interpretativo
- Allineato alla tabella comparativa attuale (che già usava Essential/Studio/Professional/Enterprise)
- Massima chiarezza per buyer americani / corporate

**Rischio**: poco distintivo, suona "qualsiasi SaaS". Perde il posizionamento premium / editoriale di MOOD. Difficile differenziarsi.

### 4.4 Matrice di selezione

| Criterio | A (Studio/Atelier/Maison) | B (Foundation/Practice/Network) | C (Essential/Pro/Enterprise) |
|---|---|---|---|
| Coerenza brand MOOD | ✅ Alta | ⚠️ Media | ❌ Bassa |
| Comprensione internazionale | ✅ Alta | ✅ Alta | ✅ Massima |
| Premium positioning | ✅ Alta | ⚠️ Media | ❌ Bassa |
| Editorial test ("lo direi davanti a uno showroom milanese?") | ✅ Sì | ✅ Sì | ⚠️ Suona SaaS commodity |
| Differenziazione vs competitor | ✅ Buona | ✅ Discreta | ❌ Nulla |
| Rischio fraintendimento | ⚠️ "Maison" può suonare luxury | ⚠️ "Foundation" può sembrare entry-low | ✅ Zero |
| Coerenza con canonical doc (Blueprint Origin tier) | ✅ Diretta | ⚠️ Da rinominare | ⚠️ Da rinominare |

### 4.5 Raccomandazione

→ **Alternativa A — Blueprint Studio · Blueprint Atelier · Blueprint Maison**

Motivazione sintetica: unico naming che mantiene il posizionamento premium MOOD senza scadere nello slogan, è internazionale, allinea al Blueprint Origin™ tier nel canonical doc, e supera l'editorial test. Le alternative B e C restano valide come fallback (B se vuoi tono più tech, C se vuoi massima neutralità).

---

## 5. Copy strategy globale

### 5.1 Tono adottato (estratto da `01_COPY_AND_CMS.md` §1)

- Chiarezza · precisione · calma · controllo · competenza · sobrietà · autorevolezza
- Frasi brevi. Niente esclamativi. Niente metafore astratte.
- Vietato: "atelier digitale", "ecosistema curatoriale", "cinematografico", "grammatica condivisa", "ritual", "journey come slogan", "intelligence editoriale", "team relazionale", "presenza redazionale".
- Permesso e raccomandato: "piattaforma", "configurazione", "studio", "team", "Advisor", "fase del progetto", "cliente", "materiali", "presentazione".

### 5.2 Editorial test (obbligatorio per ogni nuova chiave)

> Lo direi davvero davanti al titolare di uno showroom milanese, a un architetto di Madrid o a un Brand Manager americano senza sembrare ridicolo?

Se la risposta è no → si riscrive.

### 5.3 Uso progressivo dei nomi proprietari

| Posizione nel funnel | Uso permesso |
|---|---|
| Hero Features | NO |
| Context Features | NO (introduce solo "Blueprint", il brand) |
| Item list Features | NO (parla di problema/capability) |
| Sezione "Layers" Features | ✅ Sì, con definizione + contesto |
| Hero Pricing | NO |
| Tier Pricing | NO (i tier non dicono "Design Journey", dicono "Blueprint completa") |
| Comparison Pricing | ✅ Sì, in tabella con righe dedicate |
| Ecosystem Pricing | NO |
| FAQ Pricing | NO |

Regola: **un nome proprietario è introdotto solo dopo aver spiegato cosa risolve**.

### 5.4 Traduzioni

Source `it`, target `en-us · fr · de · es`. Per ogni chiave, principio della traduzione:
- **Non letterale**. La traduzione cerca lo stesso registro (essenziale, professionale), non la corrispondenza parola-per-parola.
- Esempio: `"Blueprint non si compra. Si configura."` →
  - EN-US: `"Blueprint isn't bought. It's configured."`
  - FR: `"Blueprint ne s'achète pas. Il se configure."`
  - DE: `"Blueprint kauft man nicht. Man konfiguriert es."`
  - ES: `"Blueprint no se compra. Se configura."`

Le traduzioni complete saranno in `PRICING_POSITIONING_TRANSLATIONS.md` (separato, da produrre al go-ahead implementazione).

---

## 6. CMS mapping — chiavi nuove vs esistenti

### 6.1 Pagina `/features` — namespace `site.features`

| Chiave proposta | Azione | Mapping component |
|---|---|---|
| `hero.eyebrow`, `hero.title`, `hero.subtitle`, `hero.body`, `hero.cta` | **UPDATE** (chiavi esistenti, copy nuovo) | FeatureHeroSplit |
| `context.eyebrow`, `context.headline`, `context.body` | **CREATE** | FeatureNarrative |
| `item_01..06` × `eyebrow / title / body` | **UPDATE** (chiavi esistenti, copy nuovo) | FeatureNumberedList |
| `item_07..15.*` | **DEPRECATE** (resta vuoto, non rimuovere row) | — |
| `layers.eyebrow`, `…headline`, `…body`, `…l1/l2/l3.{title,body}` | **CREATE** | FeatureNarrative ripetuto o nuova sezione |
| `cta.eyebrow`, `cta.headline`, `cta.body`, `cta.label`, `cta.link` | **UPDATE + CREATE** | FeatureNarrative chiusura |
| `seo.title`, `seo.description` | **UPDATE** | head meta |

### 6.2 Pagina `/pricing` — namespace `site.pricing`

| Chiave proposta | Azione | Mapping component |
|---|---|---|
| `hero.eyebrow`, `hero.title`, `hero.subtitle`, `hero.body` | **UPDATE** | PricingHeroCinematic |
| `intro.*` | **DEPRECATE** o **UPDATE** (rimpiazzato da `flow`) | — |
| `philosophy.*` | **DEPRECATE** (rimpiazzato dal flow + ecosystem) | — |
| `flow.eyebrow`, `…headline`, `…body`, `…step_01/02/03.{label,body}` | **CREATE** | nuova sezione (può riusare PricingPhilosophy come container) |
| `tier_01/02/03 × {eyebrow,title,subtitle,body,inc_1..5,cta}` | **UPDATE** (esistenti, copy nuovo, **price = vuoto**) | PricingTiersEditorial |
| `tier_01/02/03 × {price, price_caption}` | **UPDATE → vuoto** | id. |
| `tier_04, tier_05.*` | **DEPRECATE** (lasciare vuoti) | — |
| `comparison.title`, `comparison.tier_01..03_name`, `comparison.row_01..13.{label,t1,t2,t3}` | **UPDATE + CREATE** (13 righe nuove) | PricingComparisonTable |
| `comparison.tier_04_name`, `comparison.row_*_v04` | **DEPRECATE → vuoti** | — |
| `comparison.contact_cta`, `comparison.footer_note` | **UPDATE** | id. |
| `ecosystem.*` | **UPDATE** (copy riscritto, struttura mantenuta) | PricingEcosystemNote |
| `faq.headline`, `faq.q1..4`, `faq.a1..4` | **CREATE** (opzionale) | nuova mini-sezione |
| `cta.headline`, `cta.body`, `cta.label`, `cta.link` | **UPDATE + CREATE** | CTA chiusura |
| `seo.title`, `seo.description` | **UPDATE** | head meta |

### 6.3 Stima volume operazioni CMS

| Operazione | Features | Pricing | Totale |
|---|---|---|---|
| UPDATE chiavi esistenti | 18 | 32 | 50 |
| CREATE nuove chiavi | 18 | 24 | 42 |
| DEPRECATE (vuotare, non rimuovere row) | 27 (item_07..15) | 35 (tier_04/05, row_*_v04, philosophy) | 62 |
| **Totale touch points** | **63** | **91** | **154** |

Tutte queste operazioni saranno additive/idempotenti via `PUT /api/admin/site/blocks`. Zero `DELETE` di rows. Compatibile con hold P0.

### 6.4 Strategia di rollout CMS (quando si va in implementazione)

1. **Staging keys** sotto un namespace temporaneo `site.features_v2` + `site.pricing_v2`
2. QA visivo su preview con `?cms=v2` query flag
3. Approvazione editoriale (IT + EN minimo)
4. Cutover: rename namespace `site.features` → `site.features_legacy`, `site.features_v2` → `site.features`
5. Mantenere `_legacy` per 30 giorni in caso di rollback
6. Eliminazione `_legacy` solo dopo audit

> Nota: l'implementazione richiede un endpoint admin per rename namespace, oggi non esistente. Alternativa più semplice: UPDATE in-place delle chiavi esistenti + creazione di nuove. Si perde la possibilità di rollback istantaneo ma è più rapida. Decisione finale all'implementazione.

---

## 7. Raccomandazione finale

### 7.1 Sintesi 1 pagina

> **/features** parte dal problema dello studio (clienti, fasi, materiali, presentazioni, team, presenza editoriale) e mostra come **Blueprint** li gestisce tutti. I nomi proprietari (**Design Journey™, Material Intelligence™, Moodboard Experience™**) appaiono **solo a fondo pagina**, come layer specializzati che lavorano sotto la superficie.
>
> **/pricing** non è un listino. Racconta il **modello di adozione**: 3 step (candidatura → dialogo Advisor → attivazione) e 3 configurazioni (**Blueprint Studio, Atelier, Maison** — Alternativa A consigliata), descritte per momento dello studio, non per quantità. Nessun prezzo pubblico. La call-to-action è sempre `Parlane con un Advisor` → /studio.
>
> Tone of voice: essenziale, professionale, internazionale. Niente "ecosistema", "atelier digitale", "cinematografico". Editorial test obbligatorio per ogni chiave.
>
> Operazioni stimate: ~154 touch points CMS, tutte additive/UPDATE — zero rischio per il DB. Implementazione differita.

### 7.2 Decisioni da chiudere prima dell'implementazione

| # | Domanda | Default proposto | Bloccante? |
|---|---|---|---|
| D1 | Naming tier? | Alternativa A (Studio/Atelier/Maison) | SÌ |
| D2 | Mantenere `PricingPhilosophy` come container per il "flow" o creare componente nuovo? | Riusare PricingPhilosophy (zero codice extra) | SÌ |
| D3 | Includere la FAQ in /pricing? | Sì (4 domande, alto valore percepito) | NO |
| D4 | Approccio rollout CMS: namespace v2 + cutover, oppure UPDATE in-place? | UPDATE in-place (più rapido) | NO |
| D5 | Le traduzioni EN/FR/DE/ES vengono prodotte in questa fase o in seconda battuta? | Seconda battuta, dopo IT approvato | NO |
| D6 | Mantenere i prezzi attuali (€89, €249) come fallback nascosto via CMS, o eliminarli del tutto? | Eliminarli (svuotare i blocchi `tier_*.price`) | SÌ |
| D7 | La CTA "Richiedi una demo" cambia in "Candida il tuo studio"? | Sì, ovunque | SÌ |
| D8 | Aggiornare anche la SEO title/description nel cutover? | Sì, IT + EN minimo | NO |

### 7.3 Sequenza implementazione (a go-ahead utente)

1. Approvazione naming tier (D1)
2. Produzione `PRICING_POSITIONING_TRANSLATIONS.md` (EN/FR/DE/ES)
3. Implementazione CMS (UPDATE 50 + CREATE 42 chiavi) — via Command Center / endpoint admin
4. QA visivo IT
5. QA visivo EN
6. Go-live + monitoring conversioni (CTA `/studio` click rate prima/dopo)
7. (Opzionale) rimozione chiavi deprecated dopo 30 giorni

### 7.4 Cosa NON è in scope di questo documento

- ❌ Modifiche ai component React esistenti (resta tutto com'è, solo copy diverso)
- ❌ Visual redesign delle pagine (decisione `1b`: copy + IA con stessi component)
- ❌ Implementazione CMS (decisione `5a`: solo documento)
- ❌ Studio Flow V2 (freezato fino a chiusura Pricing)
- ❌ Decisioni commerciali su pricing reale (resta lato Advisor)

---

## 8. Index documenti correlati

| File | Contenuto |
|---|---|
| `/app/memory/STUDIO_V2/00_OVERVIEW_AND_UX.md` | UX Studio Activation Funnel v2 |
| `/app/memory/STUDIO_V2/01_COPY_AND_CMS.md` | Tone of voice MOOD canonical |
| `/app/memory/STUDIO_V2/STUDIO_ACTIVATION_LIFECYCLE.md` | Lifecycle canonical (Blueprint Origin™ tier) |
| `/app/memory/STUDIO_V2/OPEN_DECISIONS_RESOLUTION.md` | 10 decisioni architettura |
| `/app/memory/STUDIO_V2/PRICING_POSITIONING_REVISION.md` | **Questo documento** |

---

*STOP — documento consegnato. In attesa di approvazione utente su:*
- *D1: scelta naming tier (A · B · C)*
- *eventuale conferma D2–D8*
- *eventuali revisioni sui copy proposti*

— *fine documento* —
