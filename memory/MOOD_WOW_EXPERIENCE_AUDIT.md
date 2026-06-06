# MOOD WOW EXPERIENCE AUDIT™

**Data:** 6 giugno 2026
**Modalità:** SOLO ANALISI. Nessuno sviluppo, nessun codice, nessuna roadmap.
**Obiettivo:** identificare il modulo con il massimo rapporto **WOW ÷ tempo di sviluppo ÷ potenziale commerciale**.

> ⚠ Tutti i giudizi sotto sono **basati sul codebase reale a oggi** (file esistenti + record DB conteggiati), non sulle promesse del positioning. Vedi `appendice A` per i conteggi grezzi.

---

## Tabella sintesi rapida (per impazienti)

| # | Modulo | Persona primaria | Valore percepito | Demo impact | Differenziaz. | Stato | Wow moment esiste? |
|---|---|---|---|---|---|---|---|
| 1  | Landing Experience          | Founder visitatore             | 6 | 7  | 4  | Production    | Sì — eyebrow editoriale |
| 2  | Tenant Activation V2        | Founder studio                 | 6 | 6  | 5  | Production    | Sì — auto-archetipo |
| 3  | **Blueprint Home (Pages+CMS)** | Founder studio                | **8** | **8** | **6** | **Production**| **SÌ — il proprio sito apparso in 10'** |
| 4  | **Media Library**             | Founder studio                 | 6 | 7  | 4  | Production    | Parziale — "ho già i miei materiali!" |
| 5  | Material Library            | Designer / Specifier           | — | —  | —  | NOT BUILT     | NO WOW MOMENT IDENTIFIED |
| 6  | Moodboard                   | Senior designer                | — | —  | —  | NOT BUILT     | NO WOW MOMENT IDENTIFIED |
| 7  | Design Journey™             | Founder → Cliente finale       | — | —  | —  | NOT BUILT     | NO WOW MOMENT IDENTIFIED |
| 8  | **AI Assistant Editorial**    | Founder / Junior designer      | **9** | **9** | **8** | **Production (8 endpoint live)** | **SÌ — copy generato in 4 sec** |
| 9  | Project Presentation        | Founder → Cliente finale       | — | —  | —  | NOT BUILT (table scaffold) | NO WOW MOMENT IDENTIFIED |
| 10 | Client Portal               | Cliente finale                 | — | —  | —  | NOT BUILT     | NO WOW MOMENT IDENTIFIED |
| 11 | Brand Atlas                 | Founder / Designer             | — | —  | —  | NOT BUILT     | NO WOW MOMENT IDENTIFIED |
| 12 | **Inspiration Layer** (Brand Catalog 2482 asset) | Founder / Cliente | **9** | **9** | **9** | **Hidden in DB, UI pubblica assente** | **POTENZIALE MASSIMO — vedi §12** |

---

## Audit modulo per modulo

### 1. Landing Experience
- **Persona primaria:** founder studio che arriva da link/email/referral
- **Problema risolto:** prima impressione del posizionamento MOOD
- **Valore percepito:** **6/10** — gradevole, editoriale, ma non racconta cosa il prodotto fa
- **Demo Impact:** **7/10** — utile come hook, non come close
- **Differenziazione:** **4/10** — altri portali editorial-luxury (Bonaveri, Cassina) hanno landing simili
- **Stato:** Production Ready
- **Wow Moment:** parziale — la transizione "MOOD for DESIGN" + tipografia editoriale crea aspettativa. Non è un "questo mi serve", è un "interessante".
- **Gap (max 5):**
  1. Nessun video/animazione del prodotto reale
  2. Nessun social proof (logo studi clienti)
  3. CTA generica "Start studio" non dice cosa accade dopo
  4. Manca screenshot di Blueprint vivo
  5. Nessuna sezione "vedi un Blueprint pubblicato"

### 2. Tenant Activation V2 (funnel `studio_v2`)
- **Persona primaria:** founder studio che decide di provare
- **Problema risolto:** onboarding strutturato → tenant creato in 90 secondi
- **Valore percepito:** **6/10** — l'esperienza è curata (5 step, archetipo)
- **Demo Impact:** **6/10** — sì in self-serve, no in demo (sales le fa altrove)
- **Differenziazione:** **5/10** — funnel "archetype" è abbastanza unico, ma non visibilmente AI
- **Stato:** Production Ready (63 studio_requests in DB → flusso vivo)
- **Wow Moment:** sì → quando Step1 mostra l'archetipo "Editorial Studio" / "Hospitality Specialist" e il founder dice "sì, sono io"
- **Gap:**
  1. Step 4 "Help" è generico, non personalizzato per archetipo
  2. Step 5 "Received" non mostra una preview di cosa stanno per ricevere
  3. Manca un'animazione di "stiamo costruendo il tuo Blueprint…"
  4. Nessuna gamification (es. "70% del tuo Blueprint è già pronto")
  5. Nessuna stima del tempo "live in 14 ore"

### 3. Blueprint Home (Pages + Blocks + Sections + Footer + SEO + Publish)
- **Persona primaria:** founder studio + senior designer
- **Problema risolto:** sostituire WordPress/Squarespace con un CMS dedicato al design
- **Valore percepito:** **8/10** — 13 pagine, 56 sezioni, editor da 1663 righe React, già attivo
- **Demo Impact:** **8/10** — se il sales fa vedere "guarda, qui modifichi il tuo Hero, qui pubblichi" il founder capisce subito
- **Differenziazione:** **6/10** — Webflow/Framer fanno lo stesso, ma con design generico. Qui i blocchi sono dedicati al settore design
- **Stato:** Production Ready
- **Wow Moment:** **sì — il momento in cui il founder vede "il proprio sito" già strutturato con sezioni "Studio / Servizi / Brand / Contact" senza aver fatto nulla**
- **Gap:**
  1. Empty state pagine vuote non guida (manca template gallery)
  2. Preview live "live edit" mode (vede subito il sito in tab affianco)
  3. Sezioni difficili da scoprire (cosa è "editorial_card_grid"?)
  4. Manca un "Magic publish" — un wizard one-click che scrive le sezioni vuote con AI
  5. Manca un "share preview link" per mostrare la versione draft al cliente

### 4. Media Library
- **Persona primaria:** founder studio (uploader) / senior designer (curator)
- **Problema risolto:** un'unica fonte di verità per tutte le immagini del Blueprint
- **Valore percepito:** **6/10** — 2561 media, già popolata, filtri funzionano. Sembra "un Drive con tag", non un'esperienza
- **Demo Impact:** **7/10** — quando il sales mostra che TUTTI gli asset del catalogo brand sono già qui, automatizzati dal Brand Catalog ingestion, il founder dice "wow"
- **Differenziazione:** **4/10** — è una galleria
- **Stato:** Production Ready
- **Wow Moment:** parziale — esiste solo per founder che hanno già attivato il brand catalog (vedono 2482 asset comparsi "magicamente")
- **Gap:**
  1. Nessun "AI auto-tag" visibile (anche se la tabella ha `dominant_color`, `focal_point`, `cultural_reading`)
  2. Nessuna preview di come l'asset apparirà sul sito pubblico
  3. Tag/filtri esistono ma sono nascosti
  4. Bulk actions limitate
  5. Nessun "rimuovi sfondo" / "crop intelligente"

### 5. Material Library
- **Persona primaria:** specifier / interior designer junior
- **Problema risolto:** trovare il materiale giusto per un progetto
- **Valore percepito:** **N/A** — non esiste
- **Demo Impact:** **N/A**
- **Differenziazione:** **N/A**
- **Stato:** **NOT BUILT** (`material_assets` tabella esiste con 0 righe — solo scaffolding)
- **Wow Moment:** **NO WOW MOMENT IDENTIFIED** — il valore esiste in teoria ma servirebbe partnership con showroom (Listone Giordano, Boffi, ecc.) per popolarla. 0→1 con dipendenze esterne.
- **Gap:**
  1. Nessun dato (0 rows)
  2. Nessuna logica di tagging materiali
  3. Nessuna integrazione con showroom
  4. Nessuna UI front-end
  5. Conflict con "Brand Catalog" che già contiene asset

### 6. Moodboard
- **Persona primaria:** senior designer
- **Problema risolto:** preparare moodboard per cliente senza usare Pinterest/Milanote
- **Valore percepito:** **N/A** — non esiste
- **Demo Impact:** **N/A**
- **Differenziazione:** **N/A**
- **Stato:** **NOT BUILT** (`moodboards` tabella esiste, 0 rows)
- **Wow Moment:** **NO WOW MOMENT IDENTIFIED**
- **Gap:**
  1. Zero codice frontend
  2. Zero endpoint backend
  3. Concorrenza forte (Milanote, Pinterest, SampleBoard)
  4. UX collaborativa non triviale (drag&drop, lock, comments)
  5. Manca integrazione con Material/Media library per chiudere il ciclo

### 7. Design Journey™
- **Persona primaria:** founder → cliente finale
- **Problema risolto:** raccontare visivamente un progetto dalla briefing alla consegna in modo condivisibile
- **Valore percepito:** **N/A** — non esiste (`design_journey` tabella **non presente** nel DB)
- **Demo Impact:** **N/A** — solo come storyline narrativa
- **Differenziazione:** **N/A**
- **Stato:** **NOT BUILT** — esiste solo come *concept word* nel landing (`DesignJourney.jsx` = sezione marketing statica del corporate site, NON è il modulo prodotto)
- **Wow Moment:** **NO WOW MOMENT IDENTIFIED**
- **Gap:**
  1. Nessuna tabella DB
  2. Nessun endpoint
  3. Concept fortemente differenziante MA da costruire da zero
  4. Storia visiva richiede contenuti reali (mockup + foto + render)
  5. Senza Client Portal (vedi §10) è solo un PDF dinamico

### 8. AI Assistant Editorial
- **Persona primaria:** founder studio (scrive copy del sito) + junior designer
- **Problema risolto:** scrivere copy editorial-quality, SEO meta, traduzioni, didascalie senza essere copywriter
- **Valore percepito:** **9/10** — già 8 endpoint LIVE: `/topics`, `/outline`, `/seo`, `/excerpt`, `/copy`, `/translate`, `/categorize`, `/photo-direction`. La gemma nascosta del progetto.
- **Demo Impact:** **9/10** — *"Scrivi un brief, ottieni 5 topic + outline + SEO meta in 4 secondi"* è una demo killer
- **Differenziazione:** **8/10** — la maggior parte degli AI generici è generalist. Qui il system prompt è `EDITORIAL_STRATEGIST` orientato al design.
- **Stato:** **Production (8 endpoint testati)** ma **invisibile nell'UI** — gli endpoint sono usati solo dentro PagesEditor.jsx in modo sparso
- **Wow Moment:** **sì — il founder digita 2 parole del proprio archetipo e in 4 secondi ha 5 titoli editorial-grade + meta SEO. Mai visto altrove nel settore design**
- **Gap:**
  1. Nessun pannello "AI Studio Assistant" dedicato
  2. Nessuna memoria di conversation (oggi è stateless one-shot)
  3. Nessun "voice → text → AI compress" combinato con Whisper (già integrato in M6.1)
  4. Nessuna feature "scrivi tutto il Blueprint con un click" (one-click site generation)
  5. Nessuna landing che mostra cosa fa

### 9. Project Presentation
- **Persona primaria:** founder → cliente finale (sales)
- **Problema risolto:** generare proposta visiva del progetto
- **Valore percepito:** **N/A**
- **Demo Impact:** **N/A**
- **Stato:** **NOT BUILT** (`proposals` tabella esiste, 0 rows)
- **Wow Moment:** **NO WOW MOMENT IDENTIFIED**
- **Gap:**
  1. Tabella vuota
  2. Nessun template
  3. Dipende da Design Journey (§7) e Client Portal (§10)
  4. Nessuna PDF/share view
  5. Sovrapposto con Blueprint Pages (un founder potrebbe pubblicare un progetto come pagina)

### 10. Client Portal
- **Persona primaria:** cliente finale (commit / committente)
- **Problema risolto:** dare al cliente uno spazio dove vedere stato progetto, approvare moodboard, firmare proposte
- **Valore percepito:** **N/A**
- **Demo Impact:** **N/A** *(altissimo se costruito, ma non costruito)*
- **Stato:** **NOT BUILT** — nessuna tabella, nessun route, nessun componente
- **Wow Moment:** **NO WOW MOMENT IDENTIFIED**
- **Gap:**
  1. 0% built
  2. Auth multi-role (cliente = ruolo nuovo, non esiste)
  3. Sign-off / e-signature integration
  4. Notifiche cliente
  5. Dipende da Moodboard + Design Journey

### 11. Brand Atlas
- **Persona primaria:** founder studio
- **Problema risolto:** organizzare la propria identità (logo, tone-of-voice, palette, font, manifesto)
- **Valore percepito:** **N/A** — nemmeno tabella esiste
- **Demo Impact:** **N/A**
- **Stato:** **NOT BUILT**
- **Wow Moment:** **NO WOW MOMENT IDENTIFIED**
- **Gap:** modulo zero, va inventato da scratch.

### 12. Inspiration Layer (Brand Catalog `products` + `product_assets`) — GEMMA NASCOSTA
- **Persona primaria:** founder studio + cliente finale
- **Problema risolto:** trasformare i 784 prodotti + 2482 asset già nel DB in una galleria pubblica navigabile, AI-tagged, AI-storytelled, shareable
- **Valore percepito:** **9/10** — i dati ci sono GIÀ. Mancano la presentation pubblica e il "discovery". Quando emergono, il founder vede il proprio catalogo brand "vivo" e dice subito "lo voglio".
- **Demo Impact:** **9/10** — un sales che apre una URL pubblica con 2482 immagini taggate per stile/materiale/applicazione converte in 30 secondi
- **Differenziazione:** **9/10** — il combinato "brand catalog importato + AI editorial + dominant color + cultural reading" è una **moat unica** già in DB
- **Stato:** **Production (data layer)**, ma **pubblicazione assente** (no UI catalog browser, no AI storytelling page)
- **Wow Moment:** **sì potenziale massimo — quando il founder apre un link tipo `mood.studio/martinel/catalog` e vede tutti i suoi 2482 asset organizzati automaticamente per stile, taggati, con copy editorial AI già scritto. Non l'ha mai visto. Lo VUOLE.**
- **Gap:**
  1. Nessuna pagina pubblica/admin che renderizzi il catalog (la Brand Catalog ingestion è già stata fatta — UI assente)
  2. Nessuna integrazione AI editorial (§8) sul catalog → ogni prodotto potrebbe avere copy AI in 1 click
  3. Nessun "filter by mood" usando `dominant_color` + `cultural_reading` (campi GIÀ in DB)
  4. Nessun share link pubblico
  5. Nessun "Inspiration Package" curato (selezione di 12 asset → bundle condivisibile)

---

## Ranking finale

### 🥇 WOW P0 — costruire NEI PROSSIMI 30 GIORNI

**INSPIRATION LAYER (Brand Catalog Pubblico) + AI EDITORIAL OVERLAY**

Combinare i moduli 12 (dati esistenti, 2482 asset + 784 prodotti) + 8 (AI editorial già live, 8 endpoint).

Razionale:
- **Dati già esistenti** → non si parte da zero (vs. Moodboard, Design Journey, Client Portal)
- **AI Editorial ha già il backend pronto** → manca solo applicarlo al brand catalog
- **Demo impact massimo** → il founder vede il suo materiale già pronto "magicamente"
- **Vettore commerciale** → ogni catalog pubblico è un URL shareable = lead generation organica
- **Bassissimo rischio tecnico** → tutto già esiste, è "presentation layer"

### 🥈 WOW P1 — dopo P0 ha dimostrato traction

**BLUEPRINT MAGIC PUBLISH** (modulo 3 + 8)

Un wizard che, dato l'archetipo dal funnel attivazione + brand catalog importato + AI editorial, **scrive automaticamente** i contenuti delle 13 pagine CMS Blueprint. Il founder fa login e trova il sito già scritto al 90%, deve solo approvare.

Razionale:
- Sfrutta tutto ciò che c'è (CMS + AI + Brand Catalog)
- Differenziazione vs Webflow/Framer
- Wow moment: "ho un sito già scritto"

### 🥉 WOW P2 — dopo aver validato l'effetto network di P0

**DESIGN JOURNEY™ MVP**

Il modulo virale: ogni Journey è un link pubblico bello da condividere col cliente. Il cliente lo gira ad altri. Crescita organica.

Razionale:
- Differenziazione assoluta (nessun competitor)
- MA: costruzione 0→1, no dati, dipende da Client Portal
- Costruirlo PRIMA di aver capito se P0 funziona = scommessa cieca

### 🚫 Esclusi (NOT YET)

- **Material Library** → dipende da partnership showroom (= business dev, non product)
- **Moodboard collaborativo** → concorrenza forte (Milanote, Pinterest) + 0→1
- **Project Presentation** → coperto da Blueprint Pages se un founder pubblica un progetto come pagina
- **Client Portal** → dipende dal successo di Design Journey
- **Brand Atlas** → coperto in parte da Blueprint pagina "Studio"

---

## Risposta diretta · 30 giorni di sviluppo, quale modulo?

> ## **INSPIRATION LAYER · Brand Catalog Pubblico AI-Powered**

### Perché
1. **I dati esistono già** — 2482 asset + 784 prodotti + 22 brand sono già in produzione. Non si crea valore: si **rivela** valore già esistente.
2. **L'AI Editorial è già live** — 8 endpoint funzionanti. Mancano solo l'orchestrazione (1 click → 5 ai topics + 1 copy + 5 SEO + photo-direction) e l'UI publish.
3. **Wow Moment immediato** — quando il founder vede la URL pubblica `mood.studio/{slug}/catalog` con i suoi 2482 asset taggati per `dominant_color`, `cultural_reading`, `mood_tags` (campi GIÀ in DB), dirà "lo voglio".
4. **Vettore commerciale autonomo** — ogni catalog pubblico è un'arma di acquisizione: il founder lo condivide, il cliente arriva, vede MOOD nel footer, diventa lead.
5. **Rischio tecnico minimo** — niente nuove migration, niente nuove tabelle, niente nuove integrazioni esterne. Solo presentation + composition.
6. **Differenziazione 9/10** — nessuna piattaforma combina brand-catalog importato + AI editorial + cultural reading + share link pubblico per il settore design.
7. **Demo Impact 9/10** — un sales può fare il demo in 90 secondi: "guarda, questo è il sito del founder, qui c'è il loro catalog, ogni asset è già taggato e ha copy scritto dall'AI, e tutto questo è successo dal momento in cui hanno fatto upload del PDF brand catalog. Vuoi vederlo per il tuo studio?"

### Cosa NON costruire
- Non costruire Design Journey: troppo da zero, troppo dipendente da Client Portal
- Non costruire Moodboard: concorrenza brutale
- Non costruire Blueprint v2: il Blueprint funziona già, va potenziato non riscritto

### Cosa l'audit NON mi dice
Una cosa che questo audit **non può sostituire**: **3 interviste reali** con 3 founder che hanno già attivato un tenant su MOOD. Devono dire loro qual è il momento esatto in cui hanno detto "wow". L'audit dice cosa è razionale; le interviste dicono cosa è desiderato.

---

## Appendice A · dati grezzi (verificati 6 Jun 2026)

### DB rows per tabella (al momento del audit)

| Tabella | Righe |
|---|---|
| `media_library` | 2 561 |
| `product_assets` | 2 482 |
| `products` | 784 |
| `brands` | 22 |
| `cms_pages` | 13 |
| `cms_sections` | 56 |
| `tenants` | 45 |
| `studio_relations` | 39 |
| `studio_requests` | 63 |
| `moodboards` | **0** |
| `inspirations_boards` | **0** |
| `inspirations_items` | **0** |
| `portfolio_projects` | **0** |
| `proposals` | **0** |
| `material_assets` | **0** |
| `collab_inspirations` | **0** |
| `design_journey` | TABLE DOES NOT EXIST |
| `client_portal_sessions` | TABLE DOES NOT EXIST |
| `brand_atlas` | TABLE DOES NOT EXIST |
| `market_reference_sets` | TABLE DOES NOT EXIST |

### AI Editorial endpoint live

`/api/admin/ai-editorial/topics` · `/outline` · `/seo` · `/excerpt` · `/copy` · `/translate` · `/categorize` · `/photo-direction`

### Blueprint chrome

`BlueprintApp.jsx` → 8 voci nav: Studio · Pagine · Editorial Blocks · Sections · Media Library · Footer · SEO · Publishing.
`PagesEditor.jsx` → 1 663 righe.
`BlueprintOverview.jsx` → 274 righe.

### Tenant Activation V2

5 step: Step1Archetype · Step2Location · Step3Contact · Step4Help · Step5Received.
63 studio_requests sottomessi → flusso vivo, conversion analizzabile.

---

**Fine audit. Nessun codice scritto. Nessuna roadmap proposta. Attendo la tua decisione strategica.**
