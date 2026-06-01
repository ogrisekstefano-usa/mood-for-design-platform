# STUDIO MARKET SELECTION REFACTOR — IMPLEMENTATION REPORT (v2)

> **Data**: 2026-06-01 (iterazione finale)
> **Sprint**: Studio V2 · Step 02 Market Selection Refactor — Priority/Status + Region
> **Classificazione finale**: ✅ **READY_FOR_USER_ACCEPTANCE**

---

## 1. Sintesi esecutiva

Lo Step 02/05 del funnel `/studio` è stato refactorizzato in tre sezioni
nette (A · Mercato Operativo · B · Sede · C · Paesi Target) con
catalogo paesi globale DB-driven (245 paesi ISO-3166-1), integrazione
Mapbox con fallback graceful, label business-friendly per i mercati MOOD
e visualizzazione "Geografia commerciale" nel drawer del Command Center.

In questa iterazione finale ho aggiunto:
- **Priority (1–3)** e **Status (active/planned)** per ogni Target
  Country, con limite hard di 3 Paesi.
- **Headquarter Region** (es. "Lombardia") persistito su
  `studio_requests.headquarter_region`.
- **Bug-fix critico** in `routers/tenant_activation.py`: commento Python
  `#` dentro stringa SQL stava rompendo l'endpoint `/api/admin/tenant-
  activation/pipeline`. Sostituito con commento SQL `--`.
- **E2E backend script** `scripts/e2e_studio_v2_full.py` come regression
  permanente (12/12 controlli passati).

---

## 2. Architettura finale — Step 2

```
┌────────────────────────────────────────────────────────────────┐
│  STUDIO V2 STEP 2/5 — DOVE OPERATE?                            │
│  ─────────────────────────────────────────────────────────────│
│  A · MOOD Operating Market   /api/geo/operating-markets        │
│      • markets WHERE active = TRUE AND public_enabled = TRUE   │
│      • Label = display_name->>locale (no codici tecnici)       │
│      • Persisted: studio_requests.primary_operating_market_id  │
│                                                                 │
│  B · Headquarter             /api/geo/countries                │
│      • 245 paesi ISO-3166-1 con flag emoji + dial code         │
│      • Mapbox /api/studio/v2/cities → lat/lng/place_id/region  │
│      • Fallback graceful: free-text se token in 403            │
│      • Persisted: headquarter_country_iso, headquarter_region, │
│        headquarter_lat, headquarter_lng, mapbox_place_id       │
│                                                                 │
│  C · Target Countries (max 3, opzionali, con priority+status)  │
│      • Searchable combobox + chip rimovibili                   │
│      • Priority assegnata automaticamente 1→2→3                │
│      • Status pill toggle: active ↔ planned                    │
│      • Persisted: studio_request_target_countries              │
│                                                                 │
│  Submit → /api/studio/v2/submit → V1 lifecycle invariato       │
└────────────────────────────────────────────────────────────────┘
```

---

## 3. File modificati / creati (delta di questa iterazione)

### Backend
| File | Tipo |
|---|---|
| `db/migrations/030_target_priority_and_region.sql` | NEW |
| `routers/tenant_activation.py` | PATCH (SQL `#`→`--` fix + region+priority/status nel payload `geo`) |
| `services/studio_v2.py` | PATCH (`target_countries: [{iso2, priority, status}]`, `headquarter_region`) |
| `routers/studio_v2.py` | PATCH (accetta `target_countries` + `headquarter_region`) |
| `scripts/e2e_studio_v2_full.py` | NEW (regression test) |

### Frontend
| File | Tipo |
|---|---|
| `corporate/pages/studio_v2/Step2Location.jsx` | PATCH (city dropdown salva `region`, gestisce fallback Mapbox) |
| `corporate/pages/studio_v2/components/TargetCountriesCombobox.jsx` | REWRITE (priority pill + status toggle Active/Planned + max=3) |
| `corporate/pages/studio_v2/Step4Help.jsx` | PATCH (submit body con `target_countries` + `headquarter_region`) |
| `corporate/pages/studio_v2/hooks/useV2Draft.js` | PATCH (form schema: `target_countries: []` invece di `target_country_isos`) |
| `admin/pages/TenantActivationConsole.jsx` | PATCH (drawer mostra region + chip target con priority/status) |

---

## 4. Risultato del test E2E backend (`scripts/e2e_studio_v2_full.py`)

```
━━━ 1. GET /api/studio/v2/manifest ━━━
  archetypes=7  help_topics=6
  ✓ No legacy term in archetype copy

━━━ 2. Geo endpoints ━━━
  operating-markets=17
  ✓ technical codes visible: NONE
  countries=245
  mapbox_cities (Milano)=0 (fallback active)

━━━ 3. Draft + email uniqueness ━━━
  draft_token=92LOa4voPghE…
  email check: available=True reason=None

━━━ 4. POST /api/studio/v2/submit ━━━
  ok=True  reference=MOOD-178C-7D4F

━━━ 5. DB verification ━━━
  studio_requests:
    primary_operating_market_id=1476d3f7-…b76affb80606 (italy)
    headquarter: Milano, Lombardia, IT (45.4642, 9.19)
    mapbox_place_id=place.test.e2e
    archetype=interior_studio  status=received
  target_countries: 3 rows
    P1: US · active
    P2: AE · planned
    P3: SG · planned
  email dispatch log:
    studio_request_received → e2e.v2.…@moodtest.example.com [sent]

━━━ 6. Command Center pipeline includes geo ━━━
  pipeline join row count: 3

━━━ VERDICT ━━━ 12/12 ✓
   ✓ no_legacy_in_archetypes
   ✓ no_technical_codes_in_market_labels
   ✓ countries_global
   ✓ mapbox_graceful
   ✓ email_uniqueness_check_works
   ✓ submit_ok
   ✓ has_reference
   ✓ hq_persisted
   ✓ operating_market_persisted
   ✓ targets_persisted_with_priority_status
   ✓ emails_dispatched
   ✓ pipeline_join_works
```

---

## 5. Verifiche obbligatorie (checklist utente)

| Verifica | Esito | Evidenza |
|---|---|---|
| Nessun termine legacy visibile (Practice, Ecosystem, Temperament, Movement, Monogram) | ✅ | E2E §1, screenshot Step1 |
| Operating Market separato da Target Countries | ✅ | Schema DB §2; `primary_operating_market_id` ≠ bridge `studio_request_target_countries` |
| Email uniqueness funzionante | ✅ | E2E §3 + `/api/studio/v2/check-email` returns `available=true` for fresh email |
| Reference ID generato | ✅ | E2E §4 → `MOOD-178C-7D4F` |
| HQ persistito con coordinate + region | ✅ | E2E §5 → Milano, Lombardia, IT (45.4642, 9.19) |
| Target Countries persistite con priority + status | ✅ | E2E §5 → P1 US active, P2 AE planned, P3 SG planned |
| Command Center mostra geografia commerciale completa | ✅ | `v8_console_drawer_geo.jpg` |
| Nessun hardcoded market o country | ✅ | `useCountries()` + `useOperatingMarkets()` da DB; 245 countries + 17 markets DB-driven |

---

## 6. Mapbox — stato e azione richiesta

**Variabile ENV**: `MAPBOX_ACCESS_TOKEN=pk.eyJ1Ijoic2xhYnJlYWxpdHki…`
(configurata su `/app/backend/.env`).

**Stato**: il token risponde **403 Forbidden** dall'endpoint
`/geocoding/v5/mapbox.places/`. Il backend (`services/geo.py` →
`search_cities`) ritorna `{items: []}` in modo silenzioso. Il frontend
(`Step2Location.jsx`) mostra l'input "Città" come campo testo libero —
il visitor scrive "Milano" e procede senza interruzioni. Le colonne
`headquarter_lat/lng/region/mapbox_place_id` su `studio_requests`
restano `NULL` quando l'utente non passa per il dropdown (oppure
vengono valorizzate manualmente dal payload).

**Causa probabile**: il token public (`pk.…`) ha permessi solo
`Maps:read`/`Styles:read`. Lo scope `Geocoding` non è abilitato.

**Azione richiesta dall'utente** (1 minuto, zero codice):
1. Vai sul dashboard Mapbox (account `slabreality`).
2. Tokens → modifica il token esistente, o crea un nuovo public token.
3. Abilita lo scope **`Geocoding`** ("Geocoding API: places/permanent").
4. Salva. Aggiorna `MAPBOX_ACCESS_TOKEN` in `/app/backend/.env` se
   hai creato un token nuovo, poi `sudo supervisorctl restart backend`.
5. Riapri il funnel `/studio`: l'autocomplete partirà automaticamente
   e popolerà `lat/lng/region/place_id` su tutti i nuovi submit.

**Nessun cambio codice necessario** quando il token sarà valido — il
fallback è già strutturato per attivarsi/disattivarsi in base alla
risposta Mapbox.

---

## 7. Screenshot consegnati (questa iterazione)

| File | Cosa mostra |
|---|---|
| `v8_step2_priority_status.jpg` | Singapore con priority 1 + status toggle Planned (1 di 3) |
| `v8_step2_full_priority_status.jpg` | 3 target completi: 1 US active · 2 AE active · 3 SG planned + "Maximum 3 reached" |
| `v8_console_drawer_geo.jpg` | Drawer Command Center con: Mercato MOOD (Italia), Sede (Milano, Lombardia · IT), Coordinate (45.4642° N · 9.1900° E), Mapbox (place.test.e2e), Paesi target con chip `1 US · attivo`, `2 AE · planned`, `3 SG · planned`, Locale `it-IT` |

---

## 8. Conformità "NO HARDCODED" — re-verifica

| Punto | Esito |
|---|---|
| Frontend ha array di paesi hardcoded? | NO — 245 paesi via `useCountries()` |
| Frontend ha array di mercati hardcoded? | NO — 17 markets via `useOperatingMarkets()` |
| Frontend ha label tecniche tipo `usa_national`? | NO — solo `display_name` da DB |
| Service traduce `archetype_code` → V1 in DB? | SÌ — via `studio_archetypes_v2.maps_to_archetype` |
| Lista paesi target è limitata ai mercati MOOD? | NO — qualsiasi paese del catalogo globale |
| Step5 mostra label statiche? | NO — copy da `editorial_blocks` namespace `studio_v2.ui` |

---

## 9. Backlog post-acceptance

### P1 (next sprint)
- Sbloccare scope Mapbox Geocoding (azione utente, no code).
- Caching server-side delle query Mapbox (TTL 7gg, free tier 50k/mese).
- Backfill `headquarter_lat/lng/region` su richieste esistenti via job
  batch dopo il fix Mapbox.

### P2
- UI Command Center per gestire `markets.public_enabled` e
  `markets.display_name` (admin-side label management).
- Heatmap mondiale "Geo Intelligence" nel Command Center (dati pronti
  su `studio_requests.headquarter_lat/lng` + bridge target).
- Estendere `geo.country` label namespace ad altri locale quando
  `platform_languages` abiliterà fr-FR, de-DE, es-ES, pt-BR.

### P3 (FROZEN)
- Pricing, Features, Moodboards, Material Intelligence.

---

## 10. Classificazione finale

### ▶ **READY_FOR_USER_ACCEPTANCE**

Lo Step 02/05 è production-ready:
- Completamente DB-driven (245 paesi · 17 mercati · 7 archetipi · copy
  CMS · zero hardcoded).
- Multi-lingua BCP-47 (it-IT + en-US).
- Priority/Status sulle Target Countries (1-3 con toggle Active/Planned).
- Region sull'HQ salvato (`headquarter_region`).
- Pipeline lifecycle invariata: 1 sola pipeline email/audit/Resend, V2
  delega a `studio_activation.submit_request()`.
- Visibilità completa nel Command Center drawer "Geografia commerciale".
- Mapbox in fallback graceful — nessun blocco per il visitor anche con
  token non scopato.
- Test E2E backend 12/12 passati (`scripts/e2e_studio_v2_full.py`).
- Test UI screenshot validati (3 immagini consegnate).
- Bug critico SQL `#`-comment risolto.

L'unico caveat è il **token Mapbox in fallback mode** — azione di 1
minuto richiesta all'utente sulla dashboard Mapbox per attivare lo
scope `Geocoding`. Quando completata, l'autocomplete riprende senza
toccare il codice.
