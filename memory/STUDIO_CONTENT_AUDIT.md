# STUDIO CONTENT AUDIT
## Inventario Completo Contenuti Pubblici — White Label Studio
**Data**: Giugno 2026  
**Stato**: Audit completato  
**Metodologia**: Analisi API live + ispezione codice sorgente

---

## LEGENDA CLASSIFICAZIONE

| Classe | Criterio |
|--------|----------|
| **P0** | Impatto diretto sulla conversione. Visibile ora a qualsiasi visitatore. Da correggere immediatamente. |
| **P1** | Impatto sulla credibilità. Visibile in condizioni normali. Da correggere nel prossimo ciclo. |
| **P2** | Miglioramento estetico/UX. Visibile solo in contesti specifici. Backlog. |

---

# HOMEPAGE (`/`) — 21 sezioni CMS

## P0 — Blockers immediati

| ID | Elemento | Problema | Sezione CMS | Localizzazione |
|----|----------|----------|-------------|----------------|
| H-P0-1 | Hero CTA href | `/begin-journey` — termine SaaS, URL non ha senso per uno studio | `hero_editorial._settings.cta_primary_href` | settings |
| H-P0-2 | Hero CTA secondaria href | `/professionals` — non converge su "Prenota una consulenza" | `hero_editorial._settings.cta_secondary_href` | settings |
| H-P0-3 | `design_journey` CTA label | "Inizia il tuo percorso" → ricorda ancora Journey/SaaS | `design_journey.locale_content.it.cta` | CMS content |
| H-P0-4 | `design_journey` CTA href | `cta_href: '/about'` — non converge su CTA primaria | `design_journey._settings.links.cta_href` | settings |
| H-P0-5 | Footer social Instagram | `instagram.com/moodfordesign` — brand MOOD visibile nel footer | `editorial_footer._settings.social_links[0].href` | settings |
| H-P0-6 | Footer social LinkedIn | `linkedin.com/company/moodfordesign` — brand MOOD visibile nel footer | `editorial_footer._settings.social_links[1].href` | settings |
| H-P0-7 | Footer colophon | `https://www.moodfordesign.com` — link MOOD visibile | `editorial_footer._settings.colophon_link` | settings |
| H-P0-8 | Footer link "Inizia un progetto" | href `/begin-journey` nel footer | `editorial_footer.locale_content.it.cols[2].links[0]` | CMS content |

## P1 — Impatto sulla credibilità

| ID | Elemento | Problema | Sezione CMS |
|----|----------|----------|-------------|
| H-P1-1 | CTA disperse (6) | "Inizia il tuo progetto", "Inizia il tuo percorso", "Prenota una consulenza", "Entra nella rete", "Scopri il metodo", "Scopri il progetto" — nessuna CTA primaria dominante | Multipla |
| H-P1-2 | `professionals_cta` CTA label | "Entra nella rete" → linguaggio da community/platform | `professionals_cta.locale_content.it.cta` |
| H-P1-3 | `final_cta_immersive` href | `/studio` e `/accedi` — `/accedi` è termine da login platform | `final_cta_immersive._settings.links` |
| H-P1-4 | `atmospheric_statement` eyebrow | "IL NOSTRO STUDIO" — generico | `atmosphere_statement.locale_content.it.eyebrow` |
| H-P1-5 | Hero secondary href | `/professionals` — non converge su CTA primaria | `hero_editorial._settings.cta_secondary_href` |

## P2 — Miglioramenti estetici/UX

| ID | Elemento | Problema |
|----|----------|----------|
| H-P2-1 | `editorial_triptych` | Sezione presente ma senza contenuto locale IT |
| H-P2-2 | `platform_pillars` | Section type richiama ancora il concetto di "pillars" da SaaS |
| H-P2-3 | `flexible_layout` (×2) | Due sezioni flexible_layout vuote — nessun contenuto |

---

# CHI SIAMO (`/about`) — 7 sezioni CMS

## Stato attuale: ✅ CMS-driven via `AboutPage.jsx`

| Sezione | Section Type | Stato Contenuto IT |
|---------|-------------|--------------------|
| Hero | `hero_editorial` | ✅ Titolo: "Progettiamo spazi che raccontano chi sei." |
| Manifesto | `atmosphere_statement` | ✅ "Il design non è solo ciò che vedi." |
| Team | `team_identity_card` | ⚠️ Title vuoto — nessun dato |
| Processo | `design_journey` | ✅ "Tre atti. Una storia." |
| Numeri | `stats_band` | ⚠️ Title vuoto — stats non configurate |
| Progetti | `featured_design_journeys` | ✅ "Ogni spazio, una storia reale." |
| CTA finale | `cinematic_quote` | ✅ "Hai un progetto? Parlaci." |

## P0 — Blockers

| ID | Elemento | Problema |
|----|----------|----------|
| A-P0-1 | `AboutPage.jsx` fallback CTA | `href='/begin-journey'` hardcoded come fallback in 3 punti |
| A-P0-2 | `design_journey.settings.links.cta_href` | `/about` — CTA non converge su "Prenota una consulenza" |

## P1 — Credibilità

| ID | Elemento | Problema |
|----|----------|----------|
| A-P1-1 | `stats_band` vuoto | Numeri dello studio non configurati (anni, progetti, paesi) |
| A-P1-2 | `team_identity_card` vuoto | Sezione team senza dati — mostra EmptySlot |
| A-P1-3 | Hero CTA | Testo hardcoded fallback "Inizia un progetto" (non "Prenota una consulenza") |

---

# PROFESSIONISTI (`/professionals`) — 0 sezioni CMS

## Stato attuale: ❌ NON CMS-driven

`ProfessionalsGatewayPage.jsx` usa:
- `professionalsContent.js` — file JS hardcoded (non CMS)
- `EditorialBundleProvider` — sistema editorial legacy
- `tenantConfig.js` — URL hardcoded per "studioExternal"
- `professionalsContent.gateway.backgroundImage` — URL immagine hardcoded
- `professionalsContent.gateway.ctas.start.href` — href hardcoded
- `professionalsContent.gateway.ctas.access.href` — href hardcoded

## P0 — Blockers

| ID | Elemento | Problema |
|----|----------|----------|
| PR-P0-1 | Intera pagina | 100% hardcoded, non CMS-driven — impossibile modificare senza codice |
| PR-P0-2 | Struttura narrativa | La pagina vende l'accesso a un workspace — non la collaborazione con uno studio |
| PR-P0-3 | CTA 3 titoli | "Accedi al workspace", "Esplora lo studio" — terminologia platform |

---

# SERVIZI (`/services`) — 0 sezioni CMS

## Stato attuale: ❌ PAGINA NON ESISTENTE

- `cms_pages` ha record per `services` ma senza sezioni
- Nessuna route `/servizi` nell'app
- Nessun componente `ServicesPage.jsx`

## P1 — Credibilità

| ID | Elemento | Problema |
|----|----------|----------|
| SV-P1-1 | Pagina assente | Il footer linka a `/services` ma la pagina non esiste |
| SV-P1-2 | Nessuna narrazione servizi | I visitatori non sanno esattamente cosa fa lo studio |

---

# MAGAZINE (`/magazine`) — Esistente

## Stato attuale: ✅ Funzionante

| ID | Elemento | Problema |
|----|----------|----------|
| MAG-P2-1 | Titolo tab | Potrebbe non riflettere brand studio |
| MAG-P2-2 | Categoria labels | URL params come `?cat=interviews` non localizzati |

---

# FOOTER — Sezione `editorial_footer`

## P0 — Visibile ora

| ID | Campo | Valore attuale | Valore atteso |
|----|-------|---------------|---------------|
| F-P0-1 | `social_links[0].href` | `https://instagram.com/moodfordesign` | `https://instagram.com/[STUDIO_HANDLE]` o vuoto |
| F-P0-2 | `social_links[1].href` | `https://linkedin.com/company/moodfordesign` | `https://linkedin.com/company/[STUDIO]` o vuoto |
| F-P0-3 | `colophon_link` | `https://www.moodfordesign.com` | Vuoto o URL studio |
| F-P0-4 | `cols[2].links[0].href` | `/begin-journey` | `/consulenza` |
| F-P0-5 | `cols[2].links[0].label` | "Inizia un progetto" | "Prenota una consulenza" |

## P1 — Struttura

| ID | Campo | Problema |
|----|-------|---------|
| F-P1-1 | Indirizzo studio | Non presente — il footer non ha indirizzo |
| F-P1-2 | Email di contatto | `mailto:i[...]` troncato nel DB |
| F-P1-3 | Città servite | Non presenti — informazione di credibilità mancante |
| F-P1-4 | Frase manifesto | Non presente nel footer |

---

# CTA — Mappa Completa

## Inventario CTA presenti nel sito

| CTA Label | Href | Pagina | Tipo |
|-----------|------|--------|------|
| "Prenota una consulenza" | N/A (nav) | Header nav | Primaria |
| "Inizia il tuo progetto" | `/begin-journey` | Hero homepage | Primaria |
| "Per i professionisti" | `/professionals` | Hero homepage | Secondaria |
| "Inizia il tuo percorso" | `/about` | HowItWorks | Contestuale |
| "Scopri il metodo" | `/about` | Editorial Statement | Contestuale |
| "Entra nella rete" | `/professionals` | Professionals CTA | Conversione |
| "Prenota consulenza (privati)" | `/begin-journey?audience=private` | FinalCTA | Primaria |
| "Collabora come professionista" | `/professionals` | FinalCTA | Secondaria |
| "Inizia un progetto" | `/begin-journey` | Footer | Convertente |

## Problemi CTA

1. **9 CTA diverse** con messaggi differenti
2. **`/begin-journey`** appare in 4 punti — URL SaaS
3. **Nessuna CTA punta a una pagina di contatto reale** (form o calendario)
4. **"Entra nella rete"** — metafora platform/community

---

# RIEPILOGO P0 PRIORITIZZATO

| Priorità | ID | Azione richiesta | Effort |
|----------|----|-----------------|--------|
| 1 | F-P0-1,2,3 | Fix footer social links + colophon (CMS patch) | XS |
| 2 | F-P0-4,5 | Fix footer CTA href + label (CMS patch) | XS |
| 3 | H-P0-1..4 | Fix homepage CTA hrefs + `design_journey` CTA (CMS patch) | S |
| 4 | PR-P0-1..3 | Rebuild ProfessionalsGatewayPage CMS-driven | L |
| 5 | A-P0-1..2 | Fix `/begin-journey` fallback in AboutPage.jsx | XS |
| 6 | SV-P1-1 | Creare ServicesPage | M |

---

# SECTION TYPES DISPONIBILI — Mappa riutilizzo

| Section Type | Usata in | Riutilizzo proposto |
|-------------|---------|-------------------|
| `hero_editorial` | home, about | professionals, services |
| `atmosphere_statement` | home, about | professionals, services |
| `design_journey` | home, about, (services) | services (processo) |
| `editorial_triptych` | home | services (tipologie 3-block) |
| `professionals_cta` | home | professionals (blocchi collaborazione) |
| `stats_band` | about | — |
| `team_identity_card` | about | — |
| `cinematic_quote` | home, about | professionals, services |
| `flexible_layout` | home | services (contenuto libero) |
| `magazine_highlights` | home | — |

**Conclusione**: Tutte le sezioni necessarie per professionals e services possono essere costruite con i section types esistenti. Nessuna nuova tabella necessaria.
