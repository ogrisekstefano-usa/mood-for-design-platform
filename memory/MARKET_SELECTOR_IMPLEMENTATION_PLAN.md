# MARKET SELECTOR — IMPLEMENTATION PLAN
## Footer → Market Modal → Market Selection → Locale Resolution

> **Modalità:** piano operativo + implementazione minima funzionante.
> **Vincoli inderogabili:** NO HARDCODED · Lingua ≠ Mercato · BCP-47 obbligatorio.
> **Source of truth:** `markets` + `platform_languages` (vedi `MARKETS_SCHEMA_AUDIT.md`).

---

## 1 · Decisioni architetturali

### 1.1 Catalogo Markets esposto al pubblico

- API `GET /api/markets` → tutti i records `markets WHERE active=true ORDER BY sort_order`.
- 15 markets visibili nel selector.
- Side-car validation: `effective_locale = primary_locale IF enabled ELSE fallback_locale`.

### 1.2 Stato applicativo

Esteso `LocaleContext` con campi:

```
{
  // Lingua (BCP-47)
  locale            : string         // sempre BCP-47 valido + enabled
  setLocale(code)   : function       // legacy support
  // Mercato (concept-primario)
  market            : object         // intero record markets corrente
  setMarket(code)   : function       // applica locale, currency, rtl, etc
  // Cataloghi runtime (NO hardcoded)
  locales           : array          // da /api/site/locales
  markets           : array          // da /api/markets
  // Derivati dal mercato
  currency          : string         // ISO 4217
  direction         : 'ltr' | 'rtl'  // da platform_languages.rtl
  countries         : string[]       // da markets.countries
  effectiveLocale   : string         // primary_locale risolto via enabled-check
  localeLabel       : string         // short_label da platform_languages
  ready             : boolean        // true dopo bootstrap async
}
```

### 1.3 Bootstrap sequence

```
mount LocaleProvider
   ├─ Promise.all([
   │    GET /api/site/locales   → platform_languages enabled+public
   │    GET /api/markets        → markets active
   │  ])
   ├─ resolveInitialMarket():
   │    1) URL slug (LOCALIZED_SLUGS) → market via reverse-lookup
   │    2) localStorage.mood-market → markets[code]
   │    3) localStorage.mood-locale → markets[primary_locale]
   │    4) navigator.language → markets[primary_locale base match]
   │    5) markets[code='italy']  ← fallback default DA DB (markets con
   │                                  primary_locale = platform_languages default)
   ├─ setReady(true)
   └─ render children
```

**Zero hardcoded:** anche il "default fallback" (point 5) viene da DB:
- `platform_languages WHERE default_locale = true` → `it-IT`
- `markets WHERE primary_locale = 'it-IT'` → `italy`

### 1.4 LocalStorage keys (consolidamento)

| Old key | Nuova key | Note |
|---|---|---|
| `mood-locale` | `mood-locale` | mantenuta per backward compat |
| `mood_locale` (legacy) | rimossa lettura | un solo read path |
| `mood_pref_locale` (Footer) | rimossa | consolidata in `mood-locale` |
| _none_ | `mood-market` | nuova chiave per market code (es. `italy`) |

---

## 2 · API contract

### 2.1 `GET /api/markets?locale={requested}`

Response:

```json
{
  "default_market": "italy",
  "markets": [
    {
      "code": "italy",
      "display_name": "Italia",           // risolto via locale fallback chain
      "macro_region": "europe",
      "countries": ["IT", "SM", "VA"],
      "primary_locale": "it-IT",
      "fallback_locale": "en-GB",
      "effective_locale": "it-IT",        // = primary_locale se enabled, altrimenti fallback
      "currency": "EUR",
      "measurement_system": "metric",
      "rtl": false,                       // join da platform_languages.rtl
      "sort_order": 10
    },
    ...
  ],
  "groups": [
    {"key": "europe",        "label": "Europe",        "markets": [...codes]},
    {"key": "north_america", "label": "North America", "markets": [...codes]},
    ...
  ]
}
```

I `groups` sono **derivati al volo** da `markets.macro_region`, non un'altra tabella → nessuna DDL aggiuntiva.

### 2.2 `GET /api/markets/default`

Response: il record default (primo per `sort_order` tra `active=true` la cui `primary_locale` è `enabled=true public_enabled=true`).

---

## 3 · Componenti frontend

### 3.1 Da eliminare / modificare

| File | Azione |
|---|---|
| `MinimalNav.jsx` | Rimuovere `import LocaleSwitcher` + i 2 mount (desktop + mobile) |
| `EditorialFooter.jsx` | Rimuovere `COUNTRY_OPTIONS` + `CountryLanguagePicker` |
| `LocaleContext.js` | Eliminare `LOCALE_LABELS`, `LOCALE_FULL_NAMES`, `LEGACY_ALIAS`, `BOOTSTRAP_DEFAULT`, fallback `useState locales`. Refactor con bootstrap async + market state. |

### 3.2 Da creare

| File | Ruolo |
|---|---|
| `corporate/components/MarketTrigger.jsx` | Pill nel footer "Italia · IT · EUR ⌄" → onClick apre `<MarketSelectorModal>` |
| `corporate/components/MarketSelectorModal.jsx` | Modal full-screen, raggruppa markets per `macro_region`, mostra search, applica setMarket() |
| `corporate/hooks/useMarkets.js` | Hook che ritorna `{ markets, groups, defaultMarket, loading }` da `/api/markets` |
| `backend/routers/markets.py` | Nuovo router con 2 endpoint sopra |
| `backend/services/markets_resolver.py` | Resolver: query DB + join `platform_languages` per `rtl` + risolve `effective_locale` |

### 3.3 Backend test (anti-regression)

| File | Ruolo |
|---|---|
| `backend/tests/test_markets_api.py` | Verifica `/api/markets` ritorna >0 rows, ogni record ha campi obbligatori, fallback chain risolto, no hardcoded |

---

## 4 · Behavior — Market Selection

**Step 1:** Utente clicca pill nel footer "Italia · IT · EUR ⌄".

**Step 2:** Modal apre con 15 mercati raggruppati per `macro_region`:

```
EUROPE              NORTH AMERICA       LATAM            MENA          AMERICAS
─────               ─────────────       ─────            ────          ────────
Italia              USA National        Central America  GCC Luxury    Mexico
DACH                USA East Coast      Spanish LatAm
France              USA South Florida   Brazil
UK & Ireland        USA West Coast
Scandinavia
Spain
```

(Ordinati per `sort_order` all'interno di ogni gruppo.)

**Step 3:** Click su "GCC Luxury" → frontend chiama `setMarket('gcc_luxury')`:

```js
// gcc_luxury → primary_locale=en-AE, fallback_locale=en-GB, rtl=false, currency=AED

// platform_languages lookup:
//   en-AE: not in table → fallback en-GB
//   en-GB: enabled=false → fallback en-US (chain in platform_languages.fallback_locale)
//   en-US: enabled=true ✓

// effective_locale = 'en-US'
// direction = 'ltr' (en-US.rtl = false)
// currency = 'AED'
// market = 'gcc_luxury'
```

Set state:

```js
setLocale('en-US')          // BCP-47 enabled
setMarketState(gcc_luxury)  // full record
localStorage.setItem('mood-market', 'gcc_luxury')
localStorage.setItem('mood-locale', 'en-US')
document.documentElement.lang = 'en-US'
document.documentElement.dir  = 'ltr'
```

**Step 4:** Navigate to slug equivalent (es. `/dedicato-a` IT → `/audience` EN).

---

## 5 · Anti-regression test

### 5.1 Backend (pytest-like, run via python directly)

`/app/backend/tests/test_markets_api.py`:

- `GET /api/markets` → 200, body ha `markets` array di lunghezza > 0.
- Ogni market ha tutti i campi obbligatori (`code`, `display_name`, `primary_locale`, `effective_locale`, `currency`, `countries`, `macro_region`, `rtl`).
- `effective_locale` di ogni market è in `platform_languages WHERE enabled=true`.
- Lo schema risposta non contiene array hardcoded di lingue/paesi (validato verificando che markets count matchi `SELECT count(*) FROM markets WHERE active=true`).

### 5.2 Frontend grep check (CI-friendly)

Script di linting che fallisce se nel frontend trova:
- pattern array `['it-IT', 'en-US', ...]` con 2+ codici BCP-47 consecutivi
- pattern array `{code: 'it', country: ...}` con codici NON BCP-47
- pattern `LOCALE_LABELS`, `LOCALE_FULL_NAMES`, `LEGACY_ALIAS`, `COUNTRY_OPTIONS` come identifier

`/app/backend/tests/test_no_hardcoded_locales.sh`:

```bash
#!/bin/bash
# Anti-regression: ensure NO hardcoded locale/market arrays in frontend src
set -e
ROOT=/app/frontend/src
forbidden=(
  "LOCALE_LABELS\s*="
  "LOCALE_FULL_NAMES\s*="
  "LEGACY_ALIAS\s*="
  "COUNTRY_OPTIONS\s*="
  "BOOTSTRAP_DEFAULT\s*="
)
exit_code=0
for pat in "${forbidden[@]}"; do
  hits=$(grep -rn --include='*.jsx' --include='*.js' -E "$pat" "$ROOT" || true)
  if [ -n "$hits" ]; then
    echo "❌ HARDCODED FOUND: $pat"
    echo "$hits"
    exit_code=1
  fi
done
exit $exit_code
```

---

## 6 · Sequenza implementativa

1. **Backend** (`markets_resolver.py` + `routers/markets.py` + register in `server.py`).
2. **Backend test** `test_markets_api.py`.
3. **Frontend LocaleContext** refactor.
4. **Rimozione LocaleSwitcher dalla navbar** (`MinimalNav.jsx`).
5. **Creazione `MarketSelectorModal` + `MarketTrigger`**.
6. **Update `EditorialFooter.jsx`**: rimuovere hardcoded, montare `MarketTrigger`.
7. **Anti-regression shell test** + run finale.
8. **Screenshot before/after**.
9. **Restart frontend** + verifica visuale.

---

*— fine implementation plan —*
