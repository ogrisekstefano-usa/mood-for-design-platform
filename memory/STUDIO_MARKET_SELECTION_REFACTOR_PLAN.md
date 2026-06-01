# STUDIO V2 · MARKET SELECTION REFACTOR — PLAN

> **Data**: 2026-06-01
> **Scope**: Step 02/05 del funnel `/studio` + integrazione Mapbox + tabella Paesi globale + impact su Command Center.
> **Stato**: ❗ ATTESA APPROVAZIONE. Nessun codice fino al tuo OK.

---

## 1. AUDIT DELLO STEP 02 ATTUALE

### 1.1 Cosa l'utente vede oggi (problemi)

| Componente | Problema |
|---|---|
| Dropdown "Paese" | Mostra 49 ISO codes con label CMS, MA `display_name` JSONB su `markets` ancora contiene stringhe tipo `"USA Sud / Florida"`, `"spanish_latam"`, `"gcc_luxury"` quando entrato dal V1 hardcoded. |
| Multi-select "altri mercati" | Mostra `mk.replace('_', ' ')` cioè letteralmente `"spanish latam"`, `"dach"`, `"gcc luxury"` — codici interni esposti al visitor. ❌ |
| City | Input testo libero (Mapbox non integrato) — zero validazione, zero coordinate. ❌ |
| Concetto unico "mercato" | Confonde 2 concetti diversi: **MOOD Operating Market** (routing, locale, advisor) e **Tenant Target Countries** (analisi commerciale, espansione). ❌ |

### 1.2 Schema esistente

#### Tabella `markets` (esistente, riusabile)
- `id` UUID, `code` text (slug interno), `display_name` JSONB localizzato,
  `macro_region`, `countries[]` (ISO array), `primary_locale`,
  `fallback_locale`, `currency`, `measurement_system`, `sort_order`,
  `active`, `dial_code`.
- **17 record** già seedati: italy, dach, france_fr_europe, uk_ireland,
  spain_iberian, scandinavia, usa_national, usa_east_coast,
  usa_south_florida, usa_midwest, usa_mountain_central, usa_west_coast,
  gcc_luxury, central_america, spanish_latam, brazil, spanish_mexico.
- **Problema**: `display_name` JSONB ha valori inconsistenti (alcuni
  belli, altri tecnici).

#### Tabella `studio_requests` (esistente)
- Ha: `country` text, `city` text, `markets` text[], `locale` text.
- **Manca**: `primary_operating_market_id` (UUID FK),
  `headquarter_country_iso` (text), `headquarter_lat/lng` (float),
  `mapbox_place_id` (text — per riferimento Mapbox stabile).

#### Tabelle MANCANTI (da creare)
- ❌ `countries` — tabella globale Paesi (verificato: non esiste).
- ❌ `studio_request_target_countries` — bridge tenant→countries.

#### `studio_archetypes_v2`, `studio_help_topics`, `studio_request_help_areas`
Esistono dalla migration 028, restano invariati.

---

## 2. PRINCIPI ARCHITETTURALI

### 2.1 Separazione netta dei due concetti

```
┌────────────────────────────────────────────────────────────────┐
│  STUDIO V2 STEP 2 — DOVE OPERATE?                               │
│  ───────────────────────────────────────────────────────────── │
│                                                                 │
│  ▶ A · MOOD Operating Market (scelta singola, obbligatoria)    │
│      ↳ Source: markets WHERE public_enabled = TRUE             │
│      ↳ Fields:  primary_operating_market_id                    │
│                                                                 │
│  ▶ B · Headquarter (Paese + Città con Mapbox)                  │
│      ↳ Source: countries (globale, ~250 paesi ISO)             │
│      ↳ Fields:  headquarter_country_iso, headquarter_city,     │
│                 headquarter_lat, headquarter_lng,              │
│                 mapbox_place_id                                │
│                                                                 │
│  ▶ C · Target Countries (multi-select, opzionale)              │
│      ↳ Source: countries (globale, qualsiasi paese)            │
│      ↳ Fields:  studio_request_target_countries[]              │
│                 (bridge table)                                  │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 Source of truth

| Concetto | Tabella | Label fonte |
|---|---|---|
| MOOD Operating Market | `markets` | `display_name` JSONB (localized) |
| Headquarter / Target Country | `countries` (NUOVA) | `name_en` + CMS `studio_v2.country.<ISO>.label` per altre lingue |
| Locale per ogni mercato | `markets.primary_locale` | DB |

---

## 3. MIGRATION 029 — Schema additivo

### 3.1 Tabella `countries` (NUOVA)

```sql
CREATE TABLE countries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iso2         CHAR(2) NOT NULL UNIQUE,        -- 'IT'
  iso3         CHAR(3) NOT NULL UNIQUE,        -- 'ITA'
  name_en      TEXT NOT NULL,                  -- 'Italy'
  name_local   TEXT,                           -- 'Italia'
  continent    TEXT,                           -- 'Europe'
  region       TEXT,                           -- 'Southern Europe'
  flag_emoji   TEXT,                           -- '🇮🇹'
  dial_code    TEXT,                           -- '+39'
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order   INT NOT NULL DEFAULT 100,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_countries_active ON countries(is_active, sort_order);
CREATE INDEX idx_countries_iso2   ON countries(iso2);
```

**Seed**: 250 paesi ISO-3166-1 da uno snapshot statico mantenuto come
script Python (`scripts/seed_countries.py`) — l'eseguibile NON contiene
copy localizzato in arrays nel codice di runtime; popola la tabella
una sola volta. Le label localizzate (italiano, spagnolo, ecc.) vivono
in `editorial_blocks` namespace `geo.country.<ISO>.label`.

### 3.2 Tabella bridge `studio_request_target_countries`

```sql
CREATE TABLE studio_request_target_countries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_request_id UUID NOT NULL REFERENCES studio_requests(id) ON DELETE CASCADE,
  country_iso2      CHAR(2) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (studio_request_id, country_iso2)
);

CREATE INDEX idx_srtc_request ON studio_request_target_countries(studio_request_id);
CREATE INDEX idx_srtc_country ON studio_request_target_countries(country_iso2);
```

### 3.3 Colonne aggiuntive su `studio_requests`

```sql
ALTER TABLE studio_requests
  ADD COLUMN IF NOT EXISTS primary_operating_market_id UUID
    REFERENCES markets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS headquarter_country_iso CHAR(2),
  ADD COLUMN IF NOT EXISTS headquarter_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS headquarter_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS mapbox_place_id TEXT;

CREATE INDEX IF NOT EXISTS idx_sr_op_market
  ON studio_requests(primary_operating_market_id);
```

### 3.4 Patch `markets.display_name` con label pulite

Update one-shot via script per garantire label business-friendly
(non da array hardcoded ma script di **bonifica dati**):

| code | display_name.it-IT | display_name.en-US |
|---|---|---|
| `italy` | Italia | Italy |
| `dach` | DACH (Germania, Austria, Svizzera) | DACH (Germany, Austria, Switzerland) |
| `france_fr_europe` | Francia & Europa Francofona | France & French Europe |
| `uk_ireland` | Regno Unito e Irlanda | United Kingdom & Ireland |
| `spain_iberian` | Spagna e Portogallo | Spain & Portugal |
| `scandinavia` | Scandinavia | Scandinavia |
| `usa_national` | Stati Uniti (Nazionale) | United States (National) |
| `usa_east_coast` | USA · Costa Est | United States · East Coast |
| `usa_south_florida` | USA · Sud e Florida | United States · South & Florida |
| `usa_midwest` | USA · Midwest | United States · Midwest |
| `usa_mountain_central` | USA · Mountain & Centro | United States · Mountain & Central |
| `usa_west_coast` | USA · Costa Ovest | United States · West Coast |
| `gcc_luxury` | Golfo Persico (GCC) | Gulf & Middle East (GCC) |
| `central_america` | America Centrale | Central America |
| `spanish_latam` | America Latina | Latin America |
| `brazil` | Brasile | Brazil |
| `spanish_mexico` | Messico | Mexico |

---

## 4. NUOVA UX — STEP 2 (refactor completo)

```
┌──────────────────────────────────────────────────────────┐
│  ← indietro                                  02 / 05     │
│                                                          │
│  ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ Dove operate?    │
│                                                          │
│  A · MERCATO OPERATIVO PRINCIPALE                        │
│     Qual è il vostro mercato operativo principale?       │
│     Lo useremo per assegnare la richiesta al team MOOD   │
│     più adatto.                                          │
│                                                          │
│     [ Italia                                 ▾ ]         │
│     ↳ markets WHERE public_enabled = TRUE                │
│                                                          │
│  ─────────────────────────────────────────────────────── │
│                                                          │
│  B · SEDE DELLO STUDIO                                   │
│     Dove ha sede il vostro studio?                       │
│                                                          │
│     PAESE                                                │
│     [ Italia                                 ▾ ]         │
│     ↳ countries WHERE is_active = TRUE                   │
│                                                          │
│     CITTÀ                                                │
│     [ Milano                                    ]        │
│       ↳ Mapbox autocomplete (suggestions dropdown)       │
│       ↳ Salva lat/lng/place_id quando selezionato        │
│                                                          │
│  ─────────────────────────────────────────────────────── │
│                                                          │
│  C · PAESI TARGET (opzionale)                            │
│     Ci sono altri Paesi in cui lavorate o vorreste       │
│     espandervi?                                          │
│     Puoi indicare mercati attuali o futuri. Ci aiuterà   │
│     a capire meglio il vostro percorso.                  │
│                                                          │
│     [ 🔍 Cerca paesi…                          ]         │
│     [🇸🇬 Singapore] [🇿🇦 South Africa] [🇦🇺 Australia]   │
│     [+ aggiungi]                                         │
│     ↳ countries searchable combobox (multi)              │
│                                                          │
│                              [ Continua → ]              │
└──────────────────────────────────────────────────────────┘
```

### 4.1 Componenti nuovi
| Componente | Path | Responsabilità |
|---|---|---|
| `OperatingMarketSelect.jsx` | `studio_v2/components/` | Dropdown markets DB-driven con label pulita |
| `CountryHeadquarterSelect.jsx` | `studio_v2/components/` | Dropdown countries + bandiera + Mapbox geocoder bind |
| `MapboxCityAutocomplete.jsx` | `studio_v2/components/` | Wrapper Mapbox Places API con caching debounce |
| `TargetCountriesCombobox.jsx` | `studio_v2/components/` | Searchable multi-select countries con chip removibili |
| `Step2Location.jsx` | refactor | Compone A·B·C |

### 4.2 Hook
| Hook | Funzione |
|---|---|
| `useCountries(locale)` | Fetch `/api/geo/countries?locale=…` con caching |
| `useMapboxAutocomplete(country, q)` | Debounced city search |

---

## 5. NUOVI ENDPOINT BACKEND

### 5.1 Geo API (read-only, pubblica)
| Metodo | Path | Descrizione |
|---|---|---|
| `GET` | `/api/geo/countries?locale=it-IT&q=`(opt) | Lista globale countries ordinata, con label localizzata |
| `GET` | `/api/geo/operating-markets?locale=it-IT` | Solo `markets` pubblici (riusa `markets_resolver` esistente con filtro `public_enabled` o equivalente) |

### 5.2 Mapbox Geocoder Proxy (estensione esistente)
Già presente `/api/studio/v2/cities?country=IT&q=...`. Estendere risposta
con:
```json
{
  "items": [
    { "name": "Milano", "full_name": "Milano, Lombardia, Italia",
      "lat": 45.4642, "lng": 9.1900, "place_id": "place.123456" }
  ]
}
```
(le coordinate ci sono già; aggiungiamo `place_id` di Mapbox e ETag-cache server-side.)

### 5.3 Submit V2 — payload esteso
```json
POST /api/studio/v2/submit
{
  "draft_token": "...",
  "archetype_code": "interior_design",

  "primary_operating_market_code": "italy",     // ← NUOVO

  "headquarter_country_iso": "IT",              // ← NUOVO (separato)
  "headquarter_city":  "Milano",
  "headquarter_lat":   45.4642,                 // ← NUOVO
  "headquarter_lng":   9.1900,                  // ← NUOVO
  "mapbox_place_id":   "place.123456",          // ← NUOVO

  "target_country_isos": ["SG","ZA","AU","JP"], // ← NUOVO (rinomina additional_markets)

  "first_name": "Marco",  "last_name":  "Rossi",
  "contact_email": "...", "phone_prefix": "+39", "phone_number": "...",
  "help_topics": ["..."], "locale": "it-IT"
}
```

Internamente `submit_v2()` continua a delegare a
`studio_activation.submit_request()` (zero duplicazione del lifecycle
hardenizzato). Il mapping V2→V1:
- `primary_operating_market_code` → risolto a `markets.id` → salvato in
  `studio_requests.primary_operating_market_id` (nuova colonna) +
  copia legacy in `studio_requests.markets[0]` per retrocompatibilità.
- `headquarter_country_iso`/`city`/`lat`/`lng`/`place_id` →
  popolano `studio_requests.country/city/headquarter_lat/lng/mapbox_place_id`.
- `target_country_isos` → bulk INSERT in `studio_request_target_countries`.

---

## 6. MAPPING V2 → LIFECYCLE ESISTENTE

```
┌──────── V2 Step 2 ─────────────┐    ┌──── studio_requests ────┐
│ primary_operating_market_code  │ →  │ primary_operating_market_id │
│ headquarter_country_iso        │ →  │ country                      │
│ headquarter_city               │ →  │ city                         │
│ headquarter_lat / lng          │ →  │ headquarter_lat / lng        │
│ mapbox_place_id                │ →  │ mapbox_place_id              │
│ target_country_isos[]          │ →  │ studio_request_target_       │
│                                │    │   countries (bridge)          │
└────────────────────────────────┘    └──────────────────────────────┘
                                              ↓
                              email_dispatcher (variables include:
                              market_name, hq_city, hq_country,
                              target_countries_count)
                                              ↓
                              Pipeline lifecycle invariata
                              (Tenant Activation Console
                               mostra i nuovi campi nel drawer)
```

---

## 7. IMPATTO SU COMMAND CENTER

### 7.1 Tenant Activation Console — drawer dettaglio

Sezione nuova **"Geografia commerciale"**:
- 🎯 Mercato operativo: `Italia (italy)` · advisor pool: 2
- 🏢 Sede: Milano, Italia (45.46° N, 9.19° E) — Mapbox: place.123456
- 🌍 Paesi target: 🇸🇬 🇿🇦 🇦🇺 🇯🇵 (4)
- 🗣 Locale risolto: `it-IT` (eredita da market)
- 💱 Currency: `EUR` (eredita da market — non esposta al visitor)

### 7.2 Nuova vista "Geo Intelligence" (futura, fuori scope sprint)

Tab Command Center con:
- Heatmap mondiale di tutti gli studi richiedenti (lat/lng aggregati).
- Top paesi target richiesti.
- Conversion rate per Operating Market.
- Pipeline by macro_region.

Dati pronti dal primo submit V2 grazie a `headquarter_lat/lng` +
`studio_request_target_countries`.

---

## 8. CMS / i18n

| Sezione | Namespace editorial_blocks |
|---|---|
| Step 2 titoli e helper | `studio_v2.ui.step2.*` |
| Label market display | `markets.display_name` JSONB |
| Label country | `geo.country.<ISO>.label` |
| Helper text "useremo per assegnare…" | `studio_v2.ui.step2.market.helper` |
| Helper text "puoi indicare mercati attuali o futuri…" | `studio_v2.ui.step2.targets.helper` |

Locales seedati: `it-IT` (source) + `en-US` (translation).
Resto delle lingue (es-ES, fr-FR, de-DE, pt-BR...) seedabili in fase 2
quando saranno `enabled` su `platform_languages`.

---

## 9. MAPBOX — Configurazione

### 9.1 Variabili ENV
```
MAPBOX_ACCESS_TOKEN=<pk.xxxx>     # backend (proxy)
```

### 9.2 Endpoint Mapbox usato
```
GET https://api.mapbox.com/geocoding/v5/mapbox.places/{q}.json
    ?access_token={TOKEN}
    &country={iso_lowercase}
    &types=place
    &limit=5
    &language={locale_lang}
    &autocomplete=true
```

### 9.3 Fallback graceful
- Token mancante → endpoint backend ritorna `{items: [], reason: "mapbox_not_configured"}`.
- Frontend mostra avviso sobrio: "Inserisci manualmente il nome della città."
- Validazione minima lato server: `city` non vuoto + lunghezza < 100.

### 9.4 Costi e quote
Mapbox free tier: **50.000 geocoding requests/month**. Considerare:
- Debounce 350ms lato frontend
- Cache server-side TTL 7 giorni per query identica (Redis o
  `cms_cache` esistente).

---

## 10. FILE COINVOLTI (preview)

### Nuovi backend
- `db/migrations/029_countries_and_target_geo.sql` (NEW)
- `scripts/apply_migration_029.py` (NEW)
- `scripts/seed_countries.py` (NEW · ISO-3166-1 dump · esegui 1 volta)
- `scripts/patch_markets_display_names.py` (NEW · bonifica display_name)
- `routers/geo.py` (NEW · `/api/geo/countries`, `/api/geo/operating-markets`)
- `services/geo.py` (NEW · resolver locale countries)
- `services/studio_v2.py` (PATCH · submit accetta nuovi campi, persistenza target)

### Nuovi frontend
- `corporate/pages/studio_v2/components/OperatingMarketSelect.jsx`
- `corporate/pages/studio_v2/components/CountryHeadquarterSelect.jsx`
- `corporate/pages/studio_v2/components/MapboxCityAutocomplete.jsx`
- `corporate/pages/studio_v2/components/TargetCountriesCombobox.jsx`
- `corporate/pages/studio_v2/Step2Location.jsx` (REWRITE)
- `corporate/pages/studio_v2/hooks/useCountries.js` (NEW)
- `corporate/pages/studio_v2/hooks/useMapboxAutocomplete.js` (NEW)

### Frontend Admin
- `admin/pages/TenantActivationConsole.jsx` (PATCH · nuova sezione drawer)

### CMS seeds
- `scripts/seed_studio_v2_step2_copy.py` (NEW · titoli, helper, errori)
- `scripts/patch_markets_display_names.py` (vedi §3.4)

---

## 11. TEST E2E RICHIESTI

### 11.1 Backend (curl)
1. `GET /api/geo/countries?locale=it-IT` → 250 paesi, label localizzata, flag emoji.
2. `GET /api/geo/operating-markets?locale=it-IT` → ~17 mercati con label pulita.
3. `GET /api/studio/v2/cities?country=IT&q=mila` → Mapbox suggestions con lat/lng/place_id.
4. `POST /api/studio/v2/submit` con nuovi campi → verifica:
   - `studio_requests.primary_operating_market_id` valorizzato
   - `headquarter_lat/lng` valorizzati
   - `studio_request_target_countries` popolato

### 11.2 Frontend (Playwright via screenshot tool)
1. Step 2 carica: dropdown Operating Markets con label pulite (no `_`).
2. Headquarter Country dropdown elenca 250 paesi con bandiera.
3. Digitando "Milano" appaiono i suggerimenti Mapbox.
4. Selezionando un suggerimento → city/lat/lng/place_id salvati.
5. Target Countries combobox: ricerca "Singap…" → mostra Singapore.
6. Submit completo → reference + DB check + advisor email.

### 11.3 Command Center
1. Aprire la nuova richiesta nel drawer → sezione "Geografia commerciale"
   mostra Operating Market, Sede con coordinate, Target Countries.

### 11.4 Non-regression
- Funnel V2 esistente (Step 1, 3, 4, 5) deve rimanere invariato.
- Lifecycle email (visitor + admin + advisor + status emails) deve
  continuare a funzionare.
- `/studio-legacy` deve continuare a rispondere.

---

## 12. EFFORT REALE

| Fase | Stima |
|---|---|
| Migration 029 + seed countries (250 record) | 2h |
| Bonifica `markets.display_name` (script) | 0.5h |
| Backend geo router + service + studio_v2 submit patch | 3h |
| Frontend 4 nuovi componenti + refactor Step 2 | 6h |
| Mapbox integration (con caching server-side) | 1.5h |
| CMS seed step 2 + helper text (it-IT/en-US) | 1.5h |
| Drawer Tenant Activation Console update | 1h |
| E2E test (backend + UI) | 2h |
| **TOTALE** | **17.5h** |

---

## 13. APERTI / DECISIONI RICHIESTE

### D1 — Sorgente dei Paesi
a) Seed statico ISO-3166-1 (default proposto, ~250 paesi, una volta sola).
b) Lookup da Mapbox Boundaries API (costoso, da evitare).
c) Pacchetto npm/python `pycountry` (semplice ma offline).

→ **Proposta**: a). Approvi?

### D2 — `markets.public_enabled`
Oggi la colonna non esiste. Vuoi che la aggiunga (booleano) per
distinguere mercati attivi pubblicamente vs mercati interni / pilot?
Default: tutti `TRUE`.

a) Sì, aggiungi colonna + UI Command Center per editarla
b) No, usa solo `markets.active`
c) Aggiungi colonna ma niente UI per ora

### D3 — Mapbox token
Hai un account Mapbox? Mi serve `MAPBOX_ACCESS_TOKEN` (chiave pubblica
`pk.…`). Se non lo hai ancora, procedo predisponendo l'integrazione +
fallback testo libero; appena lo fornirai si attiva.

### D4 — Bandierine emoji
Le bandiere emoji rendono il dropdown molto più leggibile ma non sono
testo localizzato. OK includerle? (Sì proposto.)

### D5 — Rename `additional_markets` → `target_country_isos`
Il payload V2 attuale ha `additional_markets` (codici market interni).
Lo rinomino in `target_country_isos` (codici paese ISO-3166-1) per
allineare al nuovo concetto. Il vecchio campo viene rimosso (non è in
production ancora).

a) OK rename
b) Mantieni anche `additional_markets` per back-compat

### D6 — Migration 029 vs split
Posso fare:
a) **Una migration unica 029** con countries + target bridge + studio_requests ALTER.
b) Tre migration separate (029a, 029b, 029c) per granularità di rollback.

→ Proposta: a) singola, è additiva e idempotente.

---

## 14. CHECKLIST APPROVAZIONE

Servono OK su:
- [ ] **Architettura** §2 (split netto Operating Market vs Target Countries)
- [ ] **Schema DB** §3 (countries + bridge + nuove colonne studio_requests)
- [ ] **Bonifica markets.display_name** §3.4 (tabella label proposta)
- [ ] **UX layout** §4 (A·B·C blocchi)
- [ ] **Payload submit** §5.3 (nuovi campi)
- [ ] **Mapbox proxy** §9 (con fallback + cache)
- [ ] **Command Center drawer** §7.1 (nuova sezione "Geografia commerciale")
- [ ] **Decisioni** D1-D6 (§13)

STOP. Attendo approvazione punto-per-punto o OK globale.
Zero codice fino al tuo via libera.
