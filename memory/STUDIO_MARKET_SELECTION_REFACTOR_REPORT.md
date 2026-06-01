# STUDIO MARKET SELECTION REFACTOR — IMPLEMENTATION REPORT

> **Data**: 2026-06-01
> **Sprint**: Studio V2 · Step 02 Market Selection Refactor
> **Classificazione finale**: ✅ **READY_FOR_USER_ACCEPTANCE**
> **Validation cross-reference**: `STUDIO_V2_IMPLEMENTATION_REPORT.md` (funnel V2 base) + E2E DB + UI eseguiti.

---

## 1. Sintesi esecutiva

Lo Step 02/05 del funnel `/studio` è stato refactorizzato in 3 sezioni
nette (A · Mercato Operativo · B · Sede · C · Paesi Target) con
catalogo paesi globale DB-driven (245 paesi ISO-3166-1), integrazione
Mapbox geocoder con fallback graceful, label business-friendly per i
mercati MOOD e visualizzazione "Geografia commerciale" nel drawer del
Command Center. Zero codici tecnici esposti al visitor.

---

## 2. Migrations applicate (3, additive)

| File | Effetto |
|---|---|
| `029a_countries_foundation.sql` | `countries` table (245 record seedati via `scripts/seed_countries.py`) |
| `029b_studio_request_geography.sql` | `studio_requests` + 5 colonne (`primary_operating_market_id`, `headquarter_country_iso`, `headquarter_lat`, `headquarter_lng`, `mapbox_place_id`) + bridge `studio_request_target_countries` |
| `029c_markets_public_labels.sql` | `markets.public_enabled` boolean + bonifica `display_name` JSONB (17 label pulite) |

**Verifica DB**:
```
countries: 245 rows
studio_request_target_countries: ready
markets.public_enabled: TRUE × 17 markets
markets.display_name['it-IT']: ‹clean labels› (es. "Italia", "Stati Uniti · Costa Est", "Golfo Persico e Medio Oriente")
```

---

## 3. File modificati / creati

### Backend
| File | Tipo |
|---|---|
| `db/migrations/029a_countries_foundation.sql` | NEW |
| `db/migrations/029b_studio_request_geography.sql` | NEW |
| `db/migrations/029c_markets_public_labels.sql` | NEW |
| `scripts/seed_countries.py` | NEW (245 paesi statici, una volta sola) |
| `scripts/seed_country_labels.py` | NEW (CMS `geo.country.<ISO>.label` it-IT + en-US) |
| `services/geo.py` | NEW (`list_countries`, `list_operating_markets`) |
| `routers/geo.py` | NEW (`/api/geo/countries`, `/api/geo/operating-markets`) |
| `services/studio_v2.py` | PATCH (submit_v2 accetta nuovi campi geo, persiste su DB + bridge) |
| `routers/studio_v2.py` | PATCH (mappa nuovi campi del body) |
| `routers/tenant_activation.py` | PATCH (response item include `geo` con operating market label + coordinate + target ISO) |
| `server.py` | PATCH (registra `geo_router`) |
| `backend/.env` | ADD `MAPBOX_ACCESS_TOKEN` |

### Frontend
| File | Tipo |
|---|---|
| `corporate/pages/studio_v2/Step2Location.jsx` | REWRITE (sezioni A/B/C, no hardcoded) |
| `corporate/pages/studio_v2/components/TargetCountriesCombobox.jsx` | NEW |
| `corporate/pages/studio_v2/hooks/useCountries.js` | NEW |
| `corporate/pages/studio_v2/hooks/useOperatingMarkets.js` | NEW |
| `corporate/pages/studio_v2/hooks/useV2Draft.js` | PATCH (form schema esteso) |
| `corporate/pages/studio_v2/Step3Contact.jsx` | PATCH (phone prefix da `countries.dial_code`) |
| `corporate/pages/studio_v2/Step4Help.jsx` | PATCH (submit body con nuovi campi geo) |
| `corporate/pages/studio_v2/Step5Received.jsx` | PATCH (display HQ country da nuovo schema) |
| `admin/pages/TenantActivationConsole.jsx` | PATCH (sezione "Geografia commerciale" nel drawer) |

---

## 4. Architettura finale — Step 2

```
┌────────────────────────────────────────────────────────────────┐
│  STUDIO V2 STEP 2/5 — DOVE OPERATE?                             │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  ▶ A · MOOD Operating Market   /api/geo/operating-markets       │
│      ↳ markets WHERE active = TRUE AND public_enabled = TRUE    │
│      ↳ Label = display_name->>locale (no codici tecnici)        │
│      ↳ Persisted: studio_requests.primary_operating_market_id   │
│                                                                  │
│  ▶ B · Headquarter             /api/geo/countries               │
│      ↳ 245 paesi ISO-3166-1 con flag emoji + dial code          │
│      ↳ Mapbox /api/studio/v2/cities → lat/lng/place_id          │
│      ↳ Fallback graceful: free-text se token assente/forbidden  │
│      ↳ Persisted: headquarter_country_iso, headquarter_lat,     │
│        headquarter_lng, mapbox_place_id                          │
│                                                                  │
│  ▶ C · Target Countries         /api/geo/countries              │
│      ↳ Multi-select searchable (250+ paesi, qualsiasi)          │
│      ↳ Chip removibili con flag                                  │
│      ↳ Persisted: studio_request_target_countries (bridge)      │
│                                                                  │
│  Submit → /api/studio/v2/submit → V1 lifecycle invariato       │
└────────────────────────────────────────────────────────────────┘
```

---

## 5. Test E2E eseguiti

### 5.1 Backend (curl)
```
✅ GET /api/geo/countries?locale=it-IT       → 245 paesi con label IT
   IT: 🇮🇹 Italia · FR: 🇫🇷 Francia · DE: 🇩🇪 Germania
   US: 🇺🇸 Stati Uniti · AE: 🇦🇪 Emirati Arabi Uniti
   BR: 🇧🇷 Brasile · MX: 🇲🇽 Messico · SG: 🇸🇬 Singapore

✅ GET /api/geo/operating-markets?locale=it-IT → 17 mercati pulito
   italy → "Italia"
   dach → "DACH (Germania, Austria, Svizzera)"
   france_fr_europe → "Francia e Europa francofona"
   gcc_luxury → "Golfo Persico e Medio Oriente"
   spanish_latam → "America Latina"
   (NO più "spanish_latam" / "usa_national" / "gcc_luxury" lato visitor)

⚠ GET /api/studio/v2/cities?country=IT&q=Milano
   Mapbox token configurato in .env ma risposta "Forbidden" (403)
   → Probabile scope mancante sul token, da abilitare in dashboard Mapbox
   → Fallback graceful attivo: città testo libero, nessun blocco submit
```

### 5.2 Frontend E2E (Playwright)
Funnel completo eseguito automaticamente:
1. Step 1 — selezionato "Studio Interior Design"
2. Step 2 — A: Italia preselezionata · B: Italy + "Milano" · C: Singapore + Giappone selezionati
3. Step 3 — Sofia Verdi · v7.full.geo@example.com · phone prefix +39 (da dial_code DB)
4. Step 4 — process_design + business_growth
5. Step 5 — Reference `MOOD-37BD-ECC9` mostrato

### 5.3 DB verification post-submit
```sql
studio_requests WHERE contact_email='v7.full.geo@example.com'
→ id:                          37bdecc9-de0d-4aab-b307-ebb10ad9d390
→ primary_operating_market_id: 1476d3f7-…b76affb80606   (italy)
→ headquarter_country_iso:     IT
→ headquarter_lat / _lng:      NULL (Mapbox 403 → free text)
→ mapbox_place_id:             NULL

studio_request_target_countries WHERE request_id = …
→ SG
→ JP

studio_email_dispatch_log (last 5 min):
→ studio_request_received → v7.full.geo@example.com  (sent)
→ admin_new_studio_request → admin@moodfordesign.com (sent)
```

### 5.4 Command Center drawer
**Screenshot**: `/app/memory/STUDIO_V2/screenshots/v7_console_drawer_geo.jpg`

Nuova sezione **"Geografia commerciale"** mostra:
- Mercato MOOD: **Italia**
- Sede: **Milano, IT**
- Paesi target: chip teal **JP · SG**
- Locale: `it-IT`
- (Coordinate omesse perché Mapbox è in fallback mode)

---

## 6. Verifiche di conformità

### ✅ NO HARDCODED
| Punto | Esito |
|---|---|
| Frontend ha array di paesi hardcoded? | NO — 245 paesi via `useCountries()` |
| Frontend ha array di mercati hardcoded? | NO — 17 markets via `useOperatingMarkets()` |
| Frontend ha label tecniche tipo `usa_national`? | NO — solo `display_name` da DB |
| Backend serializza codici interni nel manifest? | NO — solo label localizzate |
| Service traduce `archetype_code` → V1 in DB? | SI — via `studio_archetypes_v2.maps_to_archetype` |
| Lista paesi target è limitata ai mercati MOOD? | NO — qualsiasi paese del catalogo globale |

### ✅ NO label tecniche visibili
Confrontato manualmente nello screenshot dropdown Operating Market:
- Visibile: "Italia", "DACH (Germania, Austria, Svizzera)", "Francia e Europa francofona", "Stati Uniti (Nazionale)", "Golfo Persico e Medio Oriente", "America Latina"
- NON visibile: `spanish_latam`, `usa_national`, `gcc_luxury`, `france_fr_europe`, `dach`, `uk_ireland`

### ✅ BCP-47 + CMS-driven
- 7 nuove UI key in `editorial_blocks` namespace `studio_v2.ui` (step2.market.title, step2.market.helper, step2.hq.title, step2.targets.*)
- 245 country labels in `editorial_blocks` namespace `geo.country` × 2 locales (it-IT + en-US) = **490 traduzioni**
- 17 markets con `display_name` JSONB sanitizzato

### ✅ Operating Market ≠ Target Countries
Schema chiaramente separato:
- `studio_requests.primary_operating_market_id` (UUID FK → markets) — uno solo, obbligatorio
- `studio_request_target_countries` (bridge N:M → countries.iso2) — molti, opzionale

### ✅ Email uniqueness globale (mantenuto)
Verifica `users` + `advisor_profiles` + `studio_requests` con status non-rejected.

### ✅ Lifecycle riusato (no duplicazione)
`submit_v2()` chiama esplicitamente `studio_activation.submit_request()`,
firing le 3 email transazionali esistenti via pipeline hardenizzata.

---

## 7. Configurazione Mapbox

**Variabile ENV**: `MAPBOX_ACCESS_TOKEN=pk.eyJ1Ijoic2xhYnJlYWxpdHki…`
(impostata su `/app/backend/.env`).

**Stato**: Il token risponde **403 Forbidden** dall'endpoint
`/geocoding/v5/mapbox.places/`. Cause probabili:
- Scope "Geocoding" non abilitato sul token
- Token con sole permission "Maps:read" / "Styles:read"

**Comportamento attuale**: `/api/studio/v2/cities` ritorna `{items: []}`
in modo silenzioso. Il frontend Step 2 mostra l'input città come campo
testo libero — l'utente può scrivere "Milano" e procedere normalmente.
`headquarter_lat/lng/mapbox_place_id` rimangono `NULL` su `studio_requests`.

**Azione richiesta**: nel dashboard Mapbox (account `slabreality`),
abilita lo scope `Geocoding` sul token oppure crea un nuovo token
public con quel scope. Appena fatto, l'autocomplete partirà
automaticamente senza modifiche al codice.

---

## 8. Backlog post-acceptance

### P1
- Abilitare lo scope Mapbox Geocoding sul token.
- Caching server-side delle query Mapbox (TTL 7gg) per ridurre il consumo
  del free tier 50k/mese.
- Backfill `headquarter_lat/lng` per le richieste già esistenti via job
  batch quando il token sarà attivo.

### P2
- UI Command Center per gestire `markets.public_enabled` (toggle visibilità
  pubblica per ogni mercato).
- Heatmap mondiale "Geo Intelligence" nel Command Center (dati pronti su
  `studio_requests.headquarter_lat/lng` + `studio_request_target_countries`).
- Traduzioni country label per altre 10 lingue quando `platform_languages`
  abiliterà fr-FR, de-DE, es-ES, pt-BR, etc.

---

## 9. Screenshot consegnati

| File | Cosa mostra |
|---|---|
| `v6_step2_new_A_B_C.jpg` | Step 2 con 3 sezioni A/B/C |
| `v7_step2_italian.jpg` | Country dropdown ordinato per label italiana |
| `v7_step2_filled.jpg` | Target chips Singapore + Giappone con flag |
| `v7_step5_received.jpg` | Reference MOOD-37BD-ECC9 ricevuto |
| `v7_console_drawer_geo.jpg` | Drawer Command Center con sezione "Geografia commerciale" |

---

## 10. Classificazione finale

### ▶ **READY_FOR_USER_ACCEPTANCE**

Lo Step 02/05 è production-ready, completamente DB-driven, multi-lingua
BCP-47, senza label tecniche esposte al visitor, con separazione netta
tra Operating Market e Target Countries, pipeline lifecycle invariata e
visibilità completa nel Command Center.

L'unico caveat è il **Mapbox token in fallback** per uno scope mancante:
quando lo riattiverai dalla dashboard Mapbox, l'autocomplete città
inizierà a popolarsi senza modifiche al codice e i nuovi submit
porteranno `headquarter_lat/lng/mapbox_place_id` valorizzati.
