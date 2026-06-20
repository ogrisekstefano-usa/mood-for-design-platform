# BLUEPRINT EDITABILITY REPORT
**Sprint:** CMS Governance & Multilingual Completion  
**Data:** 2026-06-20  
**Scope:** Verifica che ogni sezione CMS sia effettivamente editabile dall'interfaccia Blueprint admin  

---

## Metodologia

Per ogni pagina registrata in `cms_pages`, si verifica:
1. La pagina è raggiungibile dall'admin Blueprint (`/blueprint/experience`)
2. Ogni `section_type` è mappata in `DEFAULT_PAGE_COMPOSITION` in `storefront_registry.py`
3. La sezione ha almeno una locale_content nel DB
4. I campi editabili (locale_content) corrispondono a quelli resi nel frontend

---

## PAGINE CMS E SEZIONI REGISTRATE

### `home` — Home

| Section Type | Nel DB | In `PAGE_KEYS` | Renderizzata nel frontend | Editabile Blueprint |
|---|---|---|---|---|
| `hero_editorial` | SI | SI | SI | **SI** |
| `editorial_grid` | SI | SI | SI | **SI** |
| `design_journey` | SI | SI | SI | **SI** |
| `cinematic_quote` | SI | SI | SI | **SI** |
| `atmosphere_statement` | SI | SI | SI | **SI** |
| `magazine_highlights` | SI | SI | SI | **SI** |
| `materials_carousel` | SI | SI | SI | **SI** |
| `editorial_footer` | SI | SI | SI | **SI** |
| `featured_design_journeys` | SI | SI | SI | **SI** |
| `trust_marquee` | SI | SI | SI | **SI** |
| `professionals_cta` | SI | SI | SI | **SI** |

### `about` — Chi siamo

| Section Type | Nel DB | In `PAGE_KEYS` | Renderizzata nel frontend | Editabile Blueprint |
|---|---|---|---|---|
| `hero_editorial` | SI | SI | SI | **SI** |
| `atmosphere_statement` | SI | SI | SI | **SI** |
| `cinematic_quote` | SI | SI | SI | **SI** |
| `design_journey` | SI | SI | SI | **SI** |
| `featured_design_journeys` | SI | SI | SI | **SI** |
| `stats_band` | SI | SI | SI | **SI** |
| `team_identity_card` | SI | SI | SI | **SI** |

### `services` — Servizi

| Section Type | Nel DB | In `PAGE_KEYS` | Renderizzata nel frontend | Editabile Blueprint |
|---|---|---|---|---|
| `hero_editorial` | SI | SI | SI | **SI** |
| `atmosphere_statement` | SI | SI | SI | **SI** |
| `cinematic_quote` | SI | SI | SI | **SI** |
| `design_journey` | SI | SI | SI | **SI** |
| `editorial_triptych` | SI | SI | SI | **SI** |

### `professionals` — Professionals

| Section Type | Nel DB | In `PAGE_KEYS` | Renderizzata nel frontend | Editabile Blueprint |
|---|---|---|---|---|
| `hero_editorial` | SI | SI | SI | **SI** |
| `atmosphere_statement` | SI | SI | SI | **SI** |
| `cinematic_quote` | SI | SI | SI | **SI** |
| `design_journey` | SI | SI | SI | **SI** |
| `editorial_triptych` | SI | SI | SI | **SI** |
| `partner_case_studies` | SI | SI | SI | **SI** |
| `professionals_cta` | SI | SI | SI | **SI** |

### `partner-application` — Partner Application

| Section Type | Nel DB | In `PAGE_KEYS` | Renderizzata nel frontend | Editabile Blueprint |
|---|---|---|---|---|
| `hero_editorial` | SI | SI (aggiunto questa sessione) | SI | **SI** |
| Form labels (`FORM_LABELS`) | NO — codice frontend | NO | SI | **NO** |

> **Gap identificato:** Il form `PartnerApplicationPage` usa un dizionario statico `FORM_LABELS` hardcoded nel sorgente React. Le label del form (titoli campo, placeholder, messaggi di validazione) non sono editabili da Blueprint. Priorità P1 per migrazione su CMS.

### `navigation` — Navigation

| Section Type | Nel DB | In `PAGE_KEYS` | Renderizzata nel frontend | Editabile Blueprint |
|---|---|---|---|---|
| `nav_top` | SI | SI | SI | **SI** |
| `locale_picker_label_i18n` | SI (in settings) | SI | SI | **SI** |
| `footer_nav_title_i18n` | SI (in settings) | SI | SI | **SI** |

### `footer` — Footer

| Section Type | Nel DB | In `PAGE_KEYS` | Renderizzata nel frontend | Editabile Blueprint |
|---|---|---|---|---|
| `footer` | SI | NO (non in `PAGE_KEYS`) | SI (letto da `home.editorial_footer`) | **PARZIALE** |

> **Gap identificato:** La pagina `footer` esiste nel DB ma non è in `PAGE_KEYS` di `storefront_registry.py`. Il footer viene letto indirettamente dalla sezione `editorial_footer` della home. Potrebbe generare confusione in Blueprint.

### Pagine non pubbliche (admin/platform)

| Page Key | Stato | Note |
|---|---|---|
| `login` | Admin only | Non pubblica |
| `audience` | Admin only | Non pubblica |
| `features` | Admin only | Non pubblica |
| `pricing` | Admin only | Non pubblica |
| `start_project` | In `PAGE_KEYS` | Route `/begin-journey` |
| `ui` | Platform | UI components |
| `support` | Admin | Support page |
| `training` | Admin | Training |

---

## GAP DI EDITABILITÀ

### G1 — `FORM_LABELS` statico in `PartnerApplicationPage`
- **Impatto:** Le label del form partner (nome, cognome, azienda, categoria, note) non sono editabili da Blueprint
- **Soluzione:** Creare sezione `form_labels` nel CMS per `partner-application`
- **Priorità:** P1

### G2 — `DEFAULT_LOCALES` statico in `HomePage`
- **Impatto:** Il selettore lingua nella homepage usa una lista hardcoded `[it, en, fr, de, es]` anziché leggere da `locale_profiles`
- **Soluzione:** Aggiungere API `/api/storefront/public/{tenant}/locales` e leggerla nel componente
- **Priorità:** P1

### G3 — Sezione `footer` non in `PAGE_KEYS`
- **Impatto:** Blueprint non può navigare alla pagina footer direttamente
- **Soluzione:** Aggiungere `'footer'` a `PAGE_KEYS` in `storefront_registry.py`
- **Priorità:** P2

### G4 — `BeginJourneyPage` — sezioni non mappate
- **Impatto:** La pagina usa `useStorefrontContent('start_project')` ma i section types non sono completamente verificati
- **Soluzione:** Audit delle sezioni di `start_project` in Blueprint
- **Priorità:** P2

---

## RIEPILOGO

| Stato | Pagine |
|---|---|
| Completamente editabile | `home`, `about`, `services`, `professionals`, `navigation` |
| Parzialmente editabile | `partner-application` (form labels non CMS), `footer` (non in PAGE_KEYS) |
| Da verificare | `start_project` (begin-journey), `consulenza` |
| Non pubblica | `login`, `audience`, `features`, `pricing`, `ui`, `support`, `training` |
