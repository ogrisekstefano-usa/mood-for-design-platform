# MULTILINGUAL COMPLETION REPORT
**Sprint:** CMS Governance & Multilingual Completion  
**Data:** 2026-06-20  
**Scope:** Mappa dei locale attivi nel DB vs copertura contenuti per pagina  

---

## Locale Profiles nel Database

| Codice DB (locale_profiles) | BCP-47 Normalizzato | Lingua | Mercato | Frontend Support |
|---|---|---|---|---|
| `IT_IT` | `it-IT` | Italiano | IT | **SI** |
| `EN_US` | `en-US` | English | US | **SI** |
| `EN_GB` | `en-GB` | English | GB | **SI** |
| `EN_AE` | `en-AE` | English | AE | PARZIALE (fallback su en-GB) |
| `FR_FR` | `fr-FR` | Français | FR | PARZIALE |
| `DE_DE` | `de-DE` | Deutsch | DE | PARZIALE |
| `ES_ES` | `es-ES` | Español | ES | PARZIALE |
| `ES_MX` | `es-MX` | Español | MX | **NON NEL DB** |

> **Nota critica:** `ES_MX` è richiesto come locale di test (P0-C del piano) ma non esiste tra i `locale_profiles`. I contenuti CMS non hanno chiavi `es-MX`. Il frontend deve gestire il fallback `es-MX → es → es-ES` tramite `resolveLocaleBag`.

---

## Copertura per Pagina e Locale

### Home (`/`)

| Section | `it` / `it-IT` | `en-US` | `en-GB` | `en` | `es-ES` | `fr-FR` | `de-DE` | `_default` |
|---|---|---|---|---|---|---|---|---|
| `hero_editorial` | SI | SI | NO | SI | NO | NO | NO | SI |
| `editorial_grid` | SI | SI | NO | NO | NO | NO | NO | SI |
| `design_journey` | SI | SI | SI | SI | NO | NO | NO | SI |
| `cinematic_quote` | SI | SI | SI | SI | SI | SI | NO | SI |
| `atmosphere_statement` | SI | SI | NO | SI | NO | NO | NO | SI |
| `magazine_highlights` | SI | SI | NO | NO | NO | NO | NO | SI |
| `materials_carousel` | SI | SI | NO | NO | NO | NO | NO | SI |
| `editorial_footer` | SI | SI | NO | SI | NO | NO | NO | SI |
| `featured_design_journeys` | SI | SI | NO | NO | NO | NO | NO | SI |
| `trust_marquee` | SI | SI | NO | NO | NO | NO | NO | NO |
| `professionals_cta` | SI | SI | NO | SI | NO | NO | NO | SI |

**Copertura home:**
- `it-IT` / `it`: 100%
- `en-US`: 100%
- `en-GB`: Solo 2/11 sezioni (design_journey, cinematic_quote) — **GAP**
- `fr-FR`: Solo 1/11 sezioni (cinematic_quote) — **GAP CRITICO**
- `es-ES`: Solo 1/11 sezioni (cinematic_quote) — **GAP CRITICO**
- `de-DE`: 0/11 sezioni — **MANCANTE TOTALE**

### About (`/about`)

| Section | `it` | `en-US` | `en-GB` | `fr-FR` | `de-DE` | `es-ES` | `_default` |
|---|---|---|---|---|---|---|---|---|
| `hero_editorial` | SI | SI | NO | NO | NO | NO | SI |
| `atmosphere_statement` | SI | SI | NO | NO | NO | NO | NO |
| `cinematic_quote` | SI | SI | NO | NO | NO | NO | NO |
| `design_journey` | SI | SI | NO | NO | NO | NO | NO |
| `featured_design_journeys` | SI | SI | NO | NO | NO | NO | NO |
| `stats_band` | SI | SI | NO | NO | NO | NO | NO |
| `team_identity_card` | SI | SI | NO | NO | NO | NO | NO |

**Copertura about:** `it` + `en-US` = 100%. Tutti gli altri locale = 0%.

### Services (`/services`)

| Section | `it` | `en-US` | `en-GB` | `en` | `fr-FR` | `de-DE` | `es-ES` | `_default` |
|---|---|---|---|---|---|---|---|---|
| `hero_editorial` | SI | SI | NO | SI | NO | NO | NO | SI |
| `atmosphere_statement` | SI | SI | NO | SI | NO | NO | NO | SI |
| `cinematic_quote` | SI | SI | NO | SI | NO | NO | NO | SI |
| `design_journey` | SI | SI | NO | SI | NO | NO | NO | SI |
| `editorial_triptych` | SI | NO | NO | SI | NO | NO | NO | SI |

**Copertura services:** `it` + `en` = 100%. `en-US` manca triptych. Tutti gli altri locale = 0%.

### Professionals (`/professionals`)

| Section | `it` | `en-US` | `en-GB` | `en` | `fr-FR` | `de-DE` | `es-ES` | `_default` |
|---|---|---|---|---|---|---|---|---|
| `hero_editorial` | SI | SI | NO | SI | NO | NO | NO | SI |
| `atmosphere_statement` | SI | SI | NO | SI | NO | NO | NO | SI |
| `cinematic_quote` | SI | SI | NO | SI | NO | NO | NO | SI |
| `design_journey` | SI | SI | NO | SI | NO | NO | NO | SI |
| `editorial_triptych` | SI | SI | SI | NO | NO | NO | NO | SI |
| `partner_case_studies` | SI | SI | SI | NO | SI | SI | SI | SI |
| `professionals_cta` | SI | SI | NO | SI | NO | NO | NO | SI |

**Copertura professionals:** `it` + `en-US` = 100%. `en-GB` copertua parziale. `partner_case_studies` ha la copertura più ampia (5 locale).

### Partner Application (`/partner-application`)

| Section | `it` | `en-US` | `en-GB` | `fr-FR` | `de-DE` | `es-ES` | `_default` |
|---|---|---|---|---|---|---|---|
| `hero_editorial` | SI | SI | SI | SI | SI | SI | SI |

**Copertura partner-application:** Hero 100% per tutti i locale. Form labels: 0% su CMS (solo `it`/`en` nel codice).

---

## GAP MULTILINGUAL CRITICI

### Gap 1 — EN-GB mancante per la maggior parte delle pagine
- **Impatto:** Utenti con locale `en-GB` vedono fallback su `en` o `_default`
- **Locale profiles:** `EN_GB` e `EN_AE` nel DB ma quasi nessun contenuto specifico
- **Sezioni interessate:** home (9/11), about (7/7), services (5/5), professionals (5/7)
- **Priorità:** P1

### Gap 2 — FR-FR, ES-ES, DE-DE quasi assenti
- **Impatto:** Utenti di lingua francese/spagnola/tedesca vedono testo in italiano (_default) o inglese (en-US)
- **Unica eccezione:** `home.cinematic_quote` ha `es-ES` e `fr-FR`. `professionals.partner_case_studies` ha `fr-FR`, `de-DE`, `es-ES`.
- **Priorità:** P1

### Gap 3 — ES-MX non esiste nel DB
- **Impatto:** Qualsiasi richiesta con locale `es-MX` ricade su `_default` (nessun chain verso `es-ES`)
- **Nota:** `resolveLocaleBag` non fa chain regionale. `es-MX → es` (2 lettere) viene cercato, non `es-ES`.
- **Soluzione:** Aggiungere profilo `ES_MX` nel DB + contenuti, oppure configurare fallback chain nel resolver
- **Priorità:** P1

### Gap 4 — Inconsistenza chiavi: mix `it` vs `it-IT`, `en` vs `en-US`
- **Impatto:** Dipendendo dall'ordine di fallback in `resolveLocaleBag`, alcuni locale trovano contenuti via `langCode` fallback
- **Soluzione:** Standardizzare le chiavi del DB su BCP-47 completo (da `it` a `it-IT`, da `en` a `en-US`)
- **Priorità:** P2 — `resolveLocaleBag` gestisce il fallback

---

## RIEPILOGO COPERTURA

| Locale | it-IT | en-US | en-GB | fr-FR | de-DE | es-ES | es-MX |
|---|---|---|---|---|---|---|---|
| Home | 100% | 100% | 18% | 9% | 0% | 9% | 0% |
| About | 100% | 100% | 0% | 0% | 0% | 0% | 0% |
| Services | 100% | 80% | 0% | 0% | 0% | 0% | 0% |
| Professionals | 100% | 100% | 29% | 14% | 14% | 14% | 0% |
| Partner App | 100% | 100% | 100% | 100% | 100% | 100% | 0% |

**Azioni raccomandate:**
1. Tradurre le sezioni home/about/services in `en-GB` (priorità alta per mercato UK)
2. Completare `fr-FR` per almeno 3 pagine principali
3. Aggiungere profilo `ES_MX` nel DB
4. Standardizzare le chiavi da `en` → `en-US`, `it` → `it-IT` in tutte le sezioni
