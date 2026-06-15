# HOMEPAGE REAL CONTENT REVIEW
## MOOD for Design — Content Population Sprint
**Data:** Giugno 2026  
**Sprint:** Content Population  
**Metodo:** Popolazione DB → Pubblicazione revisione → Screenshot Desktop/Tablet/Mobile

---

## STEP 1 — INVENTARIO COMPLETO 21 SEZIONI

| # | Sezione | Tipo | Contenuto Presente | Contenuto Mancante | Visibile Frontend |
|---|---|---|---|---|---|
| 1 | `footer` | Layout | ❌ No locale_content | nav links, brand, contatti | 🔒 HIDDEN |
| 2 | `navigation` | Layout | ❌ No locale_content | link labels, brand name | 🔒 HIDDEN |
| 3 | `hero_editorial` | Hero | ✅ IT/EN — title, image, CTA | hero video, slideshow | ✅ RENDERED |
| 4 | `featured_design_journeys` | Progetti | ✅ IT/EN — title, sub | (ora 3 journeys pubblicati) | ✅ RENDERED |
| 5 | `curated_brands` | Brand | ❌ No locale_content | brand items, heading | 🔒 HIDDEN |
| 6 | `editorial_grid` | Magazine | ✅ IT/EN — 3 items hardcoded | items da DB, country targeting | ✅ RENDERED |
| 7 | `trust_marquee` | Brand Strip | ✅ IT/EN — 8+ brand | — | ✅ RENDERED |
| 8 | `platform_pillars` | Features | ❌ No locale_content | pillar items, heading | 🔒 HIDDEN |
| 9 | `design_journey` | How It Works | ✅ settings (4 steps) + IT locale | step icons, step CTA | ✅ RENDERED |
| 10 | `atmosphere_statement` | Studio | ✅ IT/EN — title aggiornato | body mapping issue (campo errato) | ⚠️ PARZIALE |
| 11 | `magazine_highlights` | Magazine | ✅ IT/EN — sub title | (doppione di editorial_grid) | ⚠️ DOPPIONE |
| 12 | `editorial_triptych` | Editorial | ❌ No locale_content | tripla immagine con testo | 🔒 HIDDEN |
| 13 | `professionals_cta` | CTA | ✅ IT/EN — titolo, body, CTA | immagine background | ✅ RENDERED |
| 14 | `final_cta_immersive` | CTA | ❌ No locale_content | title, CTA, immagine | 🔒 HIDDEN |
| 15 | `materials_carousel` | Materiali | ✅ IT/EN — 7+ materiali | materiali da DB | ✅ RENDERED |
| 16 | `cinematic_quote` | Final CTA | ✅ IT/EN — aggiornato | phone, email | ✅ RENDERED |
| 17 | `flexible_layout` #1 | Layout | ❌ No locale_content | — | 🔒 HIDDEN |
| 18 | `flexible_layout` #2 | Layout | ❌ No locale_content | — | 🔒 HIDDEN |
| 19 | `editorial_footer` | Footer | ✅ IT/EN — rights, cols | colophon da rimuovere | ⚠️ PARZIALE |
| 20 | `block_heading` | Block | ❌ No locale_content | — | 🔒 HIDDEN |
| 21 | `block_text` | Block | ❌ No locale_content | — | 🔒 HIDDEN |

**Sommario**: 11/21 con contenuto • 7/21 visibili e renderizzate • 4 parziali/problematiche • 10 hidden/vuote

---

## STEP 2 — CONTENUTO DEMO POPOLATO

### Published Design Journeys (3 creati / aggiornati)

| Progetto | Location | Tipo | Status |
|---|---|---|---|
| Villa Residenziale — Lago di Como | Lago di Como, Lombardia | Residenziale | ✅ published, featured |
| Penthouse — Milano Porta Nuova | Milano, Porta Nuova | Residenziale | ✅ published, featured |
| Boutique Suite — Costa Amalfitana | Positano, Campania | Ospitalità | ✅ published, featured |

### Magazine Articles (6 creati / aggiornati)

| Articolo | Lingua | Categoria | Status |
|---|---|---|---|
| Il ritorno della materia. Pietra, lino e legno non verniciato. | IT | Tendenze | ✅ published |
| La cucina non è più un servizio. È il centro gravitazionale della casa. | IT | Progettazione | ✅ published |
| La luce non è arredo. È architettura. | IT | Benessere | ✅ published |
| The return of raw materials. Stone, linen and untreated wood. | EN | Tendenze | ✅ published |
| Light is not decoration. It is architecture. | EN | Wellness | ✅ published |
| The kitchen is no longer a service room. | EN | Design | ✅ published |

### CMS Sections Aggiornate (5 sezioni)

| Sezione | Aggiornamento | Visibile |
|---|---|---|
| `design_journey` | Aggiunto locale_content IT/EN (eyebrow: "COME LAVORIAMO") | ✅ |
| `atmosphere_statement` | Aggiornato IT/EN (titolo + body + CTA) | ⚠️ Parziale |
| `professionals_cta` | Aggiornato IT/EN (titolo professionisti, body, CTA "Entra nella rete") | ✅ |
| `cinematic_quote` | Aggiornato IT/EN ("Pronto a trasformare il tuo spazio?", sub, CTAs) | ✅ |
| `editorial_footer` | Aggiornato IT (rights "© 2026 Studio.", cols navigazione) | ⚠️ Parziale |

### Architettura pubblicazione
> Scoperta critica: la homepage usa `published_revision_id` — snapshot congelato.  
> Le modifiche a `cms_sections` NON sono visibili finché non viene eseguita una nuova pubblicazione.  
> **Soluzione**: `POST /api/storefront/admin/pages/home/publish` → nuova revisione `dd9f41c3` pubblicata.

---

## STEP 3 — SCREENSHOT POST-CONTENT

### Desktop 1440px — Hero + Trust Marquee

**FUNZIONA:**
- Hero image reale (rooftop terrace al tramonto) — premium, coinvolgente ✅
- Headline CMS: "Il tuo spazio. Il tuo Design Journey™." ✅
- Subtitle: "Inizia un'esperienza di design personale con studi italiani di alta gamma." ✅
- CTAs: teal + outline ✅
- Trust marquee: B&B Italia, Minotti, FLOS, Cattelan Italia, Porro, Poltrona Frau, Poliform, Molteni ✅
- Debug bar: ASSENTE ✅

### Desktop 1440px — How It Works

**FUNZIONA:**
- Step 01: "Briefing & Mood — Definiamo insieme atmosfere, materiali e funzioni dello spazio." ✅
- Step 02: "Concept di progetto — Lo studio italiano sviluppa il concept con render fotografici e tavole." ✅
- Step 03: [cut off in screenshot]
- Step 04: "Realizzazione — Coordiniamo produzione, logistica e installazione, in Italia e all'estero." ✅

### Desktop 1440px — Magazine Section (homepage)

**FUNZIONA:**
- "MAGAZINE — Ispirazione. Materiali. Atmosfere." ✅
- 3 card editoriali con immagini reali ✅
- Titoli editoriali (da `editorial_grid.locale_content.it.items`, NON da DB articles):
  - "Materia & Luce: il dialogo silenzioso del residenziale italiano" ✅
  - "Pietra naturale, legno bruciato, ottone: nuove grammatiche tattili" ✅
  - "Il ritratto dello studio: come gli studi italiani disegnano la casa contemporanea" ✅
- "ESPLORA TUTTI GLI ARTICOLI →" ✅

### Desktop 1440px — Projects Section (homepage)

**FUNZIONA:**
- "DESIGN STORIES — Progetti reali. Spazi reali." ✅
- "VEDI TUTTI I PROGETTI →" ✅
- 3 card con immagini:
  - **Villa Residenziale — Lago di Como** — LAGO DI COMO, LOMBARDIA ✅
  - **Penthouse — Milano Porta Nuova** — MILANO, PORTA NUOVA ✅
  - **Boutique Suite — Costa Amalfitana** — POSITANO, CAMPANIA ✅
- Excerpts visibili sotto ogni titolo ✅
- Atmosfere in italic sotto ogni card ✅

### Desktop 1440px — Materials Carousel

**FUNZIONA:**
- "MATERIALI & BRAND — Una selezione curata dei migliori materiali." ✅
- Swatches: MARBLE, WALNUT, OAK, LINEN, TRAVERTINE, BRASS, TERRAZZO ✅
- Frecce navigazione ← → ✅

### Desktop 1440px — Final CTA

**FUNZIONA (aggiornato):**
- "Pronto a trasformare il tuo spazio?" ✅ (da seeded content)
- "Raccontaci il progetto che hai in mente. Il primo incontro è sempre un momento di ascolto." ✅
- CTA "INIZIA IL TUO DESIGN JOURNEY™ — Richiedi una consulenza" ✅
- CTA "PER I PROFESSIONISTI — Sei un professionista?" ✅

### Tablet 768px

**FUNZIONA:**
- Hamburger menu ✅
- Hero full-width ✅
- Trust marquee ✅
- How It Works scrollabile ✅
- Leggibilità buona ✅

### Mobile 390px

**FUNZIONA:**
- Logo + hamburger ✅
- Hero con testo e CTA ✅
- "MATERIALI SELEZIONATI & DESIGN PARTNER" + brand ✅
- "01 Briefing & Mood" visibile ✅
- Leggibilità buona ✅

### /projects page

**FUNZIONA:**
- "ARCHIVIO EDITORIALE — DESIGN JOURNEY™ SELEZIONATI. STORIE REALI DI SPAZI." ✅
- Filtri: TUTTI, RESIDENZIALE, OSPITALITÀ, RETAIL ✅
- 3 project cards con immagini visibili ✅

### /magazine page

**FUNZIONA:**
- "6 RISULTATI" ✅ (era 0 prima)
- Tags: 2025, BENESSERE, BIOFILIA, BIOPHILIA, CUCINA, DESIGN, FUNCTIONAL, FUNZIONALE ✅
- Filtri per categoria e tempo di lettura ✅
- Prima immagine articolo visibile ✅

---

## STEP 4 — COSA FUNZIONA / COSA NON FUNZIONA / COSA MANCA DAVVERO

---

### COSA FUNZIONA ✅

1. **Hero CMS-driven** — immagine reale, headline, subtitle, due CTA da Blueprint
2. **Trust marquee** — 8+ brand premium (B&B Italia, Minotti, FLOS...) scorrevole
3. **How It Works** — 4 step correttamente renderizzati da `settings.steps`
4. **Magazine section homepage** — 3 articoli con immagini editoriali reali
5. **Projects section homepage** — 3 progetti con immagini reali + locations + excerpts
6. **Materials carousel** — 7+ swatches di materiali con navigazione
7. **Final CTA** — testo aggiornato, CTA segmentate (privato / professionista)
8. **/projects page** — 3 progetti visibili con filtri funzionanti
9. **/magazine page** — 6 risultati (IT+EN), filtri categoria + tempo lettura
10. **Revisione CMS** — architettura publish/revision funzionante e verificata
11. **Debug bar** — assente ovunque ✅
12. **Multibreakpoint** — layout stabile su Desktop 1440, Tablet 768, Mobile 390

---

### COSA NON FUNZIONA ❌

1. **Footer hardcoded** — `© 2026 MOOD for DESIGN™` e `Running on Blueprint OS™ · Editorial Infrastructure for Design Studios` e `Questo servizio è fornito da MOOD for DESIGN` sono in `EDITORIAL_SHELL` e NON sovrascrivibili via CMS. Richiedono una modifica codice in `HomePage.jsx`.

2. **Footer logo e tagline** — Logo "MOOD" e "INSPIRATION DESIGN SOLUTIONS" nel footer dark sono hardcoded (non dallo studio).

3. **atmosphere_statement — body non renderizzato** — Il componente legge un campo diverso rispetto a `body`. Lo screenshot mostra solo "Lo studio italiano disegna ambienti dove materia e luce si incontrano." che è il vecchio `body` della sezione, non il testo aggiornato. Il mapping `copy.atmosphere.body` → `locale_content.it.body` ha una discrepanza.

4. **editorial_footer.rights non applica** — Il componente footer legge da `EDITORIAL_SHELL.footer.rights` come fallback, non da `copy.footer.rights` che avrei aggiornato via CMS.

5. **Professionals CTA — immagine mancante** — La sezione `professionals_cta` mostra testo ma non ha immagine background. Risultato: sezione testuale senza impatto visivo.

6. **Magazine page — header duplicato** — Doppio header visibile su `/magazine`: barra principale + logo "MOOD for DESIGN" immagine + "START PROJECT" button. Bug strutturale nel layout della pagina Magazine.

7. **Magazine page — titolo hardcoded** — "Riferimenti progettuali curati" e "Atmosfere, materiali e palette selezionate..." sono hardcoded nel componente `MagazinePage.jsx`, non dal CMS.

8. **editorial_grid usa locale_content.it.items** — I 3 articoli mostrati nella homepage sono hardcoded in `locale_content.it.items`, NON provengono dal DB (`magazine_articles`). Gli articoli del DB compaiono solo nella pagina `/magazine`.

9. **design_journey — CTA button invisibile** — Il bottone CTA della sezione How It Works (passo 4, `settings.links`) è presente ma appare come rectangle bianco vuoto.

10. **/projects page title** — "DESIGN JOURNEY™ SELEZIONATI." usa ancora la terminologia SaaS.

---

### COSA MANCA DAVVERO 🔴

#### Identità dello studio (P0)

1. **Nessun brand dello studio** — Logo, nome, tagline, indirizzo sono tutti "MOOD for DESIGN". Non c'è identità dello studio cliente su nessuna pagina.
2. **Nessun volto umano** — Zero fotografie di persone (fondatore, team, studio) in tutta la homepage.
3. **Team / About section** — La sezione `atmosphere_statement` aveva il potenziale ma non rende il corpo del testo aggiornato. Manca una vera sezione "Chi siamo" con foto.

#### Contenuto reale (P1)

4. **Immagini progetti = stock Unsplash** — Le 3 immagini dei progetti sono placeholder Unsplash, non fotografie reali dei progetti realizzati. Accettabile per demo, non per produzione.
5. **Articoli Magazine = testo demo** — I 6 articoli sono testo redazionale creato per il demo, non editoriale reale dello studio.
6. **Hero image = AI-generated rooftop** — L'immagine hero non mostra un lavoro reale dello studio.

#### Sistema (P1)

7. **Homepage editorial_grid NON legge dal DB** — Il Magazine nella homepage mostra `locale_content.it.items` hardcoded. Non legge da `magazine_articles`. Serve un componente che legga gli ultimi 3 articoli dal DB.

8. **CMS revision workflow nascosto** — Non esiste UI per pubblicare la homepage da Blueprint. L'utente deve usare l'API `POST /admin/pages/home/publish` manualmente.

9. **Footer EDITORIAL_SHELL** — Copyright, colophon, logo, tagline sono in `EDITORIAL_SHELL` nel frontend. Non sovrascrivibili da Blueprint senza modifica codice.

#### Pagine secondarie (P2)

10. **Pagina /professionals** — Il contenuto promuove ancora "MOOD for DESIGN™" come piattaforma. Manca proposta di valore B2B concreta con foto e benefit specifici.
11. **Pagina /services** — Non verificata in questo sprint.
12. **Pagina /about** — Non esiste (404).

---

## RACCOMANDAZIONI PER FASE SUCCESSIVA

### Prima (senza codice — solo Blueprint)
- Completare contenuto sezioni vuote: `navigation`, `footer`, `curated_brands`
- Aggiungere immagine background a `professionals_cta`
- Sostituire Hero image con fotografia reale dello studio

### Con modifica codice minima
- Fix footer: rimuovere `colophon` e `"Questo servizio..."` da `EDITORIAL_SHELL` (2 righe in `HomePage.jsx`)
- Fix copyright footer: leggere da `copy.footer.rights` CMS invece di `EDITORIAL_SHELL.footer.rights`
- Fix `editorial_grid`: leggere ultimi 3 articoli da DB invece di `locale_content.it.items`
- Fix `atmosphere_statement`: verificare campo `body` mappato correttamente nel componente
- Fix duplicato header `/magazine`

### Valutazione Homepage Builder (SOLO DOPO i fix sopra)
- Tutti i fix sopra richiesti in Blueprint richiedono attualmente l'API
- Un Homepage Builder UI risolverebbe: publish workflow, edit contenuto, toggle sezioni
- MA: non ha senso costruirlo su sezioni che non renderizzano correttamente

---

## VERDETTO FINALE

La homepage funziona. Non è ancora pronta per produzione.

| Dimensione | Prima del sprint | Dopo il sprint |
|---|---|---|
| Homepage visivamente vuota | ✅ Critico | ✅ Risolto |
| Progetti visibili | 0 | 3 ✅ |
| Articoli magazine | 0 | 6 ✅ |
| Sezioni con contenuto | 0 visibili | 7-8 renderizzate ✅ |
| Brand dello studio | MOOD for DESIGN | Ancora MOOD for DESIGN ❌ |
| Footer brand exposure | MOOD for DESIGN | Ancora MOOD for DESIGN ❌ |
| Debug bar | Visibile | Assente ✅ |
| Percepito come studio | No | Parzialmente ⚠️ |

**Il CMS funziona. Il modello dati è solido. I blocchi tecnici principali sono la pulizia del footer EDITORIAL_SHELL e la mancanza di identità dello studio.**

---

*Report generato nel contesto del Content Population Sprint — Giugno 2026*
