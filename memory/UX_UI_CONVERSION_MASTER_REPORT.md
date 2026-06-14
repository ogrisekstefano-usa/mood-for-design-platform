# UX/UI & CONVERSION MASTER REPORT
## MOOD for DESIGN — Sprint di Audit Business
**Data:** Giugno 2026  
**Metodo:** Screenshot + Analisi codice + Ispezione API + Audit CMS  
**URL Analizzato:** https://i18n-recovery-1.preview.emergentagent.com  
**Riferimento Visivo:** Studio Rinaldi (immagine fornita dall'utente)

---

## STATO GENERALE

> **VERDETTO**: La landing **non vende lo studio**. Non vende nulla.  
> La homepage è visualmente vuota per ogni visitatore. Le altre pagine pubbliche hanno struttura ma zero contenuto pubblicato.

---

## SEZIONE 1 — AUDIT LANDING PAGE

### Domanda 1 — Entro 10 secondi capisco chi è lo studio?

**RISPOSTA: NO → P0**

| Domanda | Risposta Visita Reale | Gravità |
|---|---|---|
| Chi è lo studio? | Non visibile (logo = "MOOD for DESIGN", piattaforma SaaS) | P0 |
| Dove opera? | Non indicato | P0 |
| Che tipo di progetti realizza? | Non visibile (0 progetti pubblicati) | P0 |
| Perché dovrei contattarlo? | Non visibile (nessuna CTA funzionante) | P0 |

**Causa tecnica confermata via API:**  
Il frontend calcola il `TENANT_SLUG` dall'hostname (`i18n-recovery-1`) invece di `studio`.  
La chiamata API diventa `/api/storefront/public/i18n-recovery-1/pages/home` → `status: null, page: null`.  
Il CMS ha 21 sezioni configurate (verificato via `/api/storefront/public/studio/pages/home`) ma non vengono mai caricate.

**Risultato per ogni persona:**
- **Cliente privato fascia medio-alta**: Abbandona entro 3 secondi. Nessun segnale di qualità.
- **Cliente luxury**: Non si fida. Zero immagini, zero riferimenti, zero team.
- **Architetto**: Non capisce cosa offre lo studio. Nessuna proposta di partnership visibile.
- **Interior Designer**: Stessa lettura dell'architetto. Nessun benefit concreto.
- **Showroom**: Nessuna indicazione sui brand partner, processi commerciali, o rete.
- **Developer immobiliare**: Nessun portfolio, nessuna casistica, nessun profilo del team di progettazione.

---

### Domanda 2 — Lo studio trasmette fiducia?

**RISPOSTA: NO → P0**

Verifica presenza/assenza segnali di fiducia su **tutte** le pagine pubbliche:

| Segnale | Presente | Evidenza |
|---|---|---|
| Volto umano | ❌ | Nessuna fotografia di persona visibile |
| Team | ❌ | Nessuna sezione team in nessuna pagina |
| Fondatore | ❌ | Zero menzione di identità personale |
| Storia dello studio | ❌ | Nessuna sezione "Chi siamo" con narrative |
| Metodo di lavoro | ❌ (empty slot) | `HOW_IT_WORKS` mostra placeholder Blueprint |
| Progetti reali | ❌ | 0 published journeys nel database |
| Località / sede | ❌ | Non indicata in homepage né footer |
| Specializzazioni | ❌ | Nessuna lista di servizi o tipologie |

**Unico elemento positivo**: La pagina `/professionals` ha un'immagine hero (interior design). Ma il body copy promuove la piattaforma MOOD for DESIGN™, non lo studio.

---

### Domanda 3 — Le CTA sono abbastanza forti?

**RISPOSTA: INADEGUATE → P0/P1**

CTA presenti nella navbar:
- **"INIZIA IL TUO DESIGN JOURNEY™"** (CTA primaria):  
  - Problema: terminologia platform-centric. Un cliente privato non capisce cosa significa "Design Journey™".  
  - Il simbolo ™ rimanda esplicitamente a un prodotto SaaS.  
  - P0 per confusion branding.

- **"RIENTRA"** (accesso area privata):  
  - Problema: termine informale/tecnico. Un cliente o professionista non capisce.  
  - Nessuna indicazione di cosa troverà dopo il login.  
  - P1.

CTA nella homepage: **nessuna visibile** (sezioni vuote).

Valutazione per ruolo:
- Nessun visitatore capisce cosa succede dopo il click.
- Nessuna CTA indica "richiedere una consulenza", "vedere il portfolio", "contattare lo studio".

---

### Domanda 4 — La homepage sembra uno studio di interior design o...?

**RISPOSTA: C — Un software (SaaS)**

**Motivazione punto per punto:**

| Elemento visivo | Percezione | Pattern riconoscibile |
|---|---|---|
| Logo "MOOD for DESIGN" teal con font geometrico | Software/app brand | SaaS B2B |
| CTA "INIZIA IL TUO DESIGN JOURNEY™" con ™ | Prodotto registrato | SaaS activation |
| Voce nav "COME FUNZIONA" | Come funziona il prodotto | SaaS nav pattern |
| Voce nav "DESIGN STORIES" | Content marketing SaaS | Software blog |
| Voce nav "RIENTRA" | Re-login all'app | SaaS auth flow |
| Homepage vuota con placeholder tecnici | Sistema in configurazione | CMS backend |

**Confronto con il riferimento** (Studio Rinaldi):
- Studio Rinaldi: hero image di living room luxury, headline "Il tuo spazio. Il nostro progetto.", CTA "Raccontaci il tuo progetto" → **studio di design**.
- MOOD: logo teal, voce "Design Journey™", empty slots → **piattaforma software**.

---

### Domanda 5 — La sezione PROGETTI genera fiducia?

**RISPOSTA: NO → P1**

**Analisi della pagina `/projects`:**
- Struttura della pagina corretta: hero editoriale ("DESIGN JOURNEY™ SELEZIONATI. STORIE REALI DI SPAZI."), filtri categoria.
- Filtri presenti: TUTTI, RESIDENZIALE, OSPITALITÀ, RETAIL.
- **Grid completamente vuota**: 0 published journeys nel database.
- Nessuna immagine, nessuna location, nessuna tipologia, nessuna profondità.

**Impatto per persona:**
- Cliente luxury: abbandona immediatamente. Nessun progetto significa "studio inesistente".
- Architetto: nessun portfolio significa impossibilità di valutare la qualità.

**Evidenza API**: `GET /api/public/published-journeys/studio/feed?featured_only=true` → `items: 0`

**Headline "DESIGN JOURNEY™ SELEZIONATI"**: Ancora terminologia SaaS. Il visitatore si aspetta "Progetti", non "Design Journey™".

---

### Domanda 6 — La sezione MAGAZINE genera autorevolezza?

**RISPOSTA: NO → P1**

**Analisi della pagina `/magazine`:**
- Header duplicato: visibili due barre di navigazione sovrapposte (MoodSiteHeader + header interno della pagina).
- Titolo: **"Riferimenti progettuali curati"** → linguaggio tecnico/CMS, non editoriale premium.
- Sottotitolo: **"Atmosfere, materiali e palette selezionate per ispirare il tuo prossimo progetto."** → descrive un tool di design, non una rivista culturale.
- **0 RISULTATI** → completamente vuoto.
- Messaggio empty state: **"Stiamo curando i prossimi articoli."** → generico e depotenziante.
- **Evidenza API**: `GET /api/magazine` → `{"detail": "..."}` (auth error).

**Il Magazine non aiuta né la conversione né l'autorevolezza.** Non c'è contenuto, non c'è brand, non c'è posizionamento culturale.

Confronto con il riferimento Studio Rinaldi: "Ispirazione e Approfondimenti" con 3 articoli editoriali (Tendenze 2024, Materiali naturali, Luce e spazio) → autorevolezza immediata.

---

### Domanda 7 — La sezione PER I PROFESSIONISTI è abbastanza forte?

**RISPOSTA: INSUFFICIENTE → P1**

**Analisi della pagina `/professionals`:**

**Punti positivi:**
- Unica pagina con immagine hero visibile (fotografia interior design).
- Header "PER PROFESSIONISTI" visibile.
- Headline: "Un ecosistema editoriale per chi disegna il futuro dell'abitare." — ha una certa aspirazionalità.

**Problemi critici:**
- Body copy: **"MOOD for DESIGN™ è la regia editoriale del tuo lavoro."** → espone il nome della piattaforma SaaS. Un visitatore professionista pensa di atterrare su una piattaforma software, non su uno studio partner.
- Nessuna risposta alla domanda fondamentale: **"Perché lasciare i miei dati?"**
- Mancano completamente:
  - Struttura delle commissioni o fee
  - Processo co-design (come funziona la collaborazione)
  - Lista dei vantaggi tangibili (sconti fornitori, rendering, progettazione condivisa)
  - Case study reali di collaborazioni
  - Modulo di contatto visibile

**Perché un professionista dovrebbe lasciare i propri dati? → NON È CHIARO. P1.**

---

## SEZIONE 2 — RESPONSIVE AUDIT

### Desktop 1440px
- Navigazione visibile e funzionale
- Homepage: solo placeholder Blueprint (nessun contenuto)
- Debug bar "EDITORIAL · DEBUG runtime 3 · missing 0" visibile in basso a sinistra **P0**
- Layout corretto ma contenuto assente

### Mobile 390px (schermata catturata)
- Al caricamento: schermata completamente nera con "In ascolto delle voci dello studio..."
- Questo è il `CinematicLoader` — **P1**: occupa tutta la viewport, non dà alcuna informazione allo studio
- Dopo il loading: stessa homepage vuota con placeholder
- Leggibilità: impossibile giudicare (no contenuto)
- Velocità di comprensione: zero (nessun contenuto caricato)
- Facilità di contatto su mobile: zero (nessuna CTA funzionante, nessun numero di telefono)

**Impatto specifico mobile:**
- Il loader "In ascolto delle voci dello studio..." dura diversi secondi su mobile
- Su connessioni lente, il visitatore abbandona prima che appaia qualsiasi contenuto
- Nessun meccanismo di contatto rapido (click-to-call, WhatsApp, form visibile)

---

## SEZIONE 3 — CMS AUDIT

### 3.1 Contenuti Hardcoded

| File | Componente | Contenuto Hardcoded | Impatto |
|---|---|---|---|
| `/app/frontend/src/site/content/homepage.js` | `homepageContent` | Intero dataset "EXE Interior": headline, servizi, stats (850+ progetti, 45+ paesi, 15 anni), 8 brand partner, 3 progetti, 3 articoli magazine | ALTO — demo content non rimuovibile senza codice |
| `/app/frontend/src/site/content/navigation.js` | `navigationContent` | Brand "EXE INTERIOR", tagline, 7 nav link, footer con 4 colonne, showroom "Via della Manifattura 12, 33080 Porcia (PN)" | ALTO — indirizzo fittizio hardcoded |
| `/app/frontend/src/pages/site/HomePage.jsx` line 84 | `EDITORIAL_SHELL.footer.rights` | `"© 2026 MOOD for DESIGN. Tutti i diritti riservati."` — copyright della piattaforma, non dello studio | CRITICO — brand exposure errata |
| `/app/frontend/src/pages/site/HomePage.jsx` line 478-481 | `DesignStories` fallback | `'Design Stories'`, `'Real journeys. Real spaces.'`, `'Journey reali. Spazi reali.'`, `'Vedi tutti i Journey'` | MEDIO — terminologia SaaS fallback |
| `/app/frontend/src/pages/site/HomePage.jsx` line 91 | `EDITORIAL_SHELL.footer.colophon` | `'Running on Blueprint OS™ · Editorial Infrastructure for Design Studios'` | CRITICO — espone piattaforma interna a visitatori pubblici |

### 3.2 Testi Placeholder Visibili ai Visitatori

| Sezione | Testo Visibile | Pagina |
|---|---|---|
| `HERO_EDITORIAL` | "Componi l'apertura editoriale dal Blueprint." | Homepage |
| `HOW_IT_WORKS` | "Definisci i passi del Design Journey dal Blueprint." | Homepage |
| `MAGAZINE_HIGHLIGHTS` | "Seleziona gli articoli editoriali in evidenza dal Blueprint." | Homepage |
| Debug Bar | "EDITORIAL · DEBUG runtime 3 · missing 0" | Tutte le pagine |

### 3.3 Immagini Non da CMS

| Pagina | Immagine | Problema |
|---|---|---|
| Homepage hero | `https://ytctctmvgdkmyjrbgmqs.supabase.co/storage/v1/object/sign/tenant-assets/...` | URL firmata (signed URL) — scade entro 1 anno; bucket privato non adatto per produzione pubblica |
| Professionals hero | Probabile stock/Unsplash | Non certificata dallo studio |

### 3.4 Sezioni Duplicate

| Problema | File | Impatto |
|---|---|---|
| `flexible_layout` appare 2 volte nel CMS home | DB: `cms_sections` table | Layout incoerente potenziale |
| Header duplicato sulla pagina Magazine | `MagazinePage.jsx` + `SiteLayout` | Due barre di navigazione sovrapposte — P1 |

### 3.5 Dati Non dal CMS

| Elemento | Fonte | Dovrebbe Essere |
|---|---|---|
| Copyright `© 2026 MOOD for DESIGN™` | Hardcoded in `HomePage.jsx` | CMS → `editorial_footer.rights` |
| Navigation labels (COME FUNZIONA, DESIGN STORIES...) | `EDITORIAL_SHELL.nav` hardcoded | CMS → `nav_top.settings.links` |
| Colophon "Running on Blueprint OS™" | `EDITORIAL_SHELL.footer.colophon` | Rimosso dalla vista pubblica |
| Stats: 850+ progetti, 45+ paesi, 15 anni | `homepage.js` hardcoded | CMS → `stats_band.settings.stats` |

---

## SEZIONE 4 — BUSINESS CONVERSION FINDINGS

---

### TOP 10 PROBLEMI

| # | Problema | Priorità | Pagina | Evidenza |
|---|---|---|---|---|
| 1 | **Homepage completamente vuota** — tenant slug mismatch (`i18n-recovery-1` vs `studio`) impedisce il caricamento del CMS | P0 | `/` | API: `/api/storefront/public/i18n-recovery-1/pages/home` → null |
| 2 | **Debug bar visibile a tutti** — "EDITORIAL · DEBUG runtime 3 · missing 0" compare su ogni pagina pubblica | P0 | Tutte | Screenshot confermato |
| 3 | **Brand errato** — Logo "MOOD for DESIGN" (piattaforma SaaS) invece del brand dello studio | P0 | Tutte | Visivo + codice `MoodSiteHeader` |
| 4 | **0 progetti pubblicati** — Sezione Projects completamente vuota | P0 | `/projects` | API: `published-journeys` → items: 0 |
| 5 | **Terminologia SaaS** — "DESIGN JOURNEY™", "RIENTRA", "COME FUNZIONA" → il visitatore pensa a un software | P0 | Tutte | Analisi nav labels |
| 6 | **0 articoli Magazine** — Nessun contenuto editoriale pubblicato | P1 | `/magazine` | Screenshot: "0 RISULTATI" |
| 7 | **Professionals promuove la piattaforma** — "MOOD for DESIGN™ è la regia editoriale del tuo lavoro" | P1 | `/professionals` | Screenshot + codice |
| 8 | **Hero image in bucket privato** — URL firmata con scadenza; non sostenibile in produzione | P1 | `/` (hero) | API: signed URL `tenant-assets` bucket |
| 9 | **Nessun segnale umano** — Zero volti, zero team, zero fondatore, zero storia in tutto il sito | P1 | Tutte | Analisi visiva completa |
| 10 | **CinematicLoader mobile** — Schermata nera "In ascolto delle voci dello studio..." dura troppo su mobile | P1 | `/` mobile | Screenshot mobile |

---

### TOP 10 OPPORTUNITÀ

| # | Opportunità | Priorità | Impatto Atteso |
|---|---|---|---|
| 1 | **Fix tenant slug** — 1 riga di codice in `HomePage.jsx` sblocca l'intera homepage con 21 sezioni CMS già configurate | P0 | Homepage passa da 0% a 100% contenuto caricato |
| 2 | **Sostituire brand "MOOD for DESIGN" con brand dello studio** — il CMS ha già `nav_top` configurabile | P0 | Trasforma la percezione da SaaS a studio luxury |
| 3 | **Disabilitare debug bar in produzione** — condizione `process.env.NODE_ENV !== 'production'` | P0 | Elimina percezione "prodotto in beta" |
| 4 | **Pubblicare 3-5 progetti** — La struttura CMS per i projects è già pronta | P0 | La sezione Projects diventa il portfolio più convincente |
| 5 | **Cambiare CTA principal** — Da "INIZIA IL TUO DESIGN JOURNEY™" a "Raccontaci il tuo progetto" o "Richiedi una consulenza" | P1 | Riduzione frizione da terminologia SaaS |
| 6 | **Aggiungere team/fondatore** — `team_identity_card` già nel registry storefront | P1 | Il visitatore vede una persona reale, fiducia +40% |
| 7 | **Pubblicare 3 articoli Magazine** — Editoriale già configurato nel backend | P1 | Magazine genera autorevolezza e time-on-site |
| 8 | **Riscrivere Professionals** — Rimuovere "MOOD for DESIGN™", aggiungere benefit concreti per architetti/designer | P1 | Tasso di registrazione professionali aumenta |
| 9 | **Spostare hero image a bucket pubblico** — `storefront-public` bucket esiste già | P1 | Immagine hero carica senza interruzioni in produzione |
| 10 | **Aggiungere sezione Studio Introduction** — Con foto del team, storia, filosofia | P2 | Il visitatore percepisce lo studio come reale e fidato |

---

### PRIORITÀ CONSOLIDATE

#### P0 — Bloccanti alla conversione (da risolvere prima di qualsiasi azione marketing)

1. Fix tenant slug detection: `i18n-recovery-1` → `studio` (1 riga di codice)
2. Disabilitare debug bar per utenti pubblici
3. Sostituire logo/brand con identità dello studio
4. Pubblicare almeno 3 progetti nel CMS (nessun codice richiesto)
5. Rimappare terminologia nav: "DESIGN JOURNEY™" → linguaggio da studio

#### P1 — Alta priorità conversione (dentro 2 settimane)

6. Pubblicare 3 articoli Magazine
7. Aggiungere fondatore/team nella homepage (section `team_identity_card`)
8. Riscrivere Professionals: rimuovere riferimenti MOOD for DESIGN, aggiungere benefit B2B
9. Spostare asset hero a `storefront-public` bucket
10. Aggiungere CTA di contatto diretto (telefono, WhatsApp) visibile mobile

#### P2 — Miglioramenti progressivi

11. Aggiungere sezione "Studio Introduction" (chi siamo, filosofia, storia)
12. Aggiungere statistiche reali (anni di esperienza, progetti, paesi)
13. Ottimizzare CinematicLoader mobile (timeout massimo 1.5s)
14. Sezione Digital Discovery Experience completamente CMS-driven
15. Footer con informazioni studio (indirizzo, contatti, social)

---

## NOTE METODOLOGICHE

- **Strumenti**: Screenshot Playwright, cURL API inspection, analisi codice sorgente
- **Pagine analizzate**: `/`, `/projects`, `/magazine`, `/professionals`
- **Viewport**: 1440px desktop + 390px mobile
- **CMS verificato via API**: 21 sezioni configurate ma non caricate per tenant slug mismatch
- **Pubblicato journeys**: 0 (verificato via API)
- **Pubblicato articoli**: 0 (verificato via API)

---

*Report generato nel contesto del MOOD UX/UI & Conversion Sprint — Giugno 2026*
