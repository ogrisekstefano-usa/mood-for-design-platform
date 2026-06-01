# MARKETS SCHEMA AUDIT
## Inventario completo · DB MOOD for DESIGN™

> **Data audit:** 2026-06-01
> **Modalità:** Read-only — solo inventario, nessuna modifica DB
> **Source of truth:** Supabase PostgreSQL · tabelle `markets`, `platform_languages`, `tenant_markets`

---

## 1 · Tabella `markets` — schema completo

| # | Column | Type | Null | Default |
|---:|---|---|:---:|---|
| 1 | `id` | uuid | NO | `gen_random_uuid()` |
| 2 | `code` | text | NO | — (univoco logico) |
| 3 | `display_name` | jsonb | NO | `'{}'` — multi-locale (es. `{"it-IT":"Italia","en-US":"Italy"}`) |
| 4 | `macro_region` | text | NO | — (es. `europe`, `north_america`, `latam`, `mena`, `americas`) |
| 5 | `countries` | jsonb | NO | `'[]'` — ISO 3166-1 alpha-2 (es. `["IT","SM","VA"]`) |
| 6 | `primary_locale` | text | NO | — BCP-47 (es. `it-IT`, `en-AE`) |
| 7 | `fallback_locale` | text | NO | `'en-US'` |
| 8 | `currency` | text | NO | `'EUR'` (ISO 4217) |
| 9 | `measurement_system` | text | NO | `'metric'` |
| 10 | `cultural_profile` | jsonb | NO | `'{}'` (design_culture, aesthetic_pillars) |
| 11 | `tone_of_voice` | jsonb | NO | `'{}'` (pronoun, register) |
| 12 | `cta_style` | jsonb | NO | `'{}'` (shape, verbs) |
| 13 | `seo_intent` | jsonb | NO | `'{}'` (hreflang, keywords_primary) |
| 14 | `sub_regions` | jsonb | NO | `'[]'` |
| 15 | `active` | boolean | NO | `true` |
| 16 | `sort_order` | integer | NO | `0` |
| 17 | `created_at` | timestamptz | NO | `now()` |
| 18 | `updated_at` | timestamptz | NO | `now()` |
| 19 | `editorial_tone` | text | YES | NULL |
| 20 | `luxury_positioning` | text | YES | NULL |
| 21 | `hospitality_profile` | text | YES | NULL |
| 22 | `storefront_behavior` | text | YES | NULL |
| 23 | `market_behavior` | jsonb | YES | `'{}'` (decision_speed, emotional_pacing, trust_requirement, …) |
| 24 | `cta_style_default` | text | YES | NULL (es. "Schedule a consultation") |
| 25 | `luxury_perception` | text | YES | NULL |
| 26 | `market_intelligence` | jsonb | NO | `'{}'` (insights multi-locale, keywords multi-locale) |

**Vincoli:** PK `id` · `code` univoco logico · `active` filter standard.
**FK in entrata:** `tenant_markets.market_id`, `account_markets.market_id` _(via `tenants`)_, `editorial_variants.market_id`, `editorial_cta_clicks.market_id`, `editorial_market_learnings.market_id`, `portfolio_project_variants.market_id`.

---

## 2 · Records attivi (15/15)

| sort | code | primary_locale | fallback | currency | macro_region | countries | display (en-US) |
|---:|---|---|---|---|---|---|---|
| 0 | `spain_iberian` | es-ES | en-US | EUR | europe | _empty_ | Spain / Iberian Europe |
| 0 | `spanish_mexico` | es-MX | en-US | EUR | americas | _empty_ | Mexico Luxury Residential |
| 10 | `italy` | **it-IT** | en-GB | EUR | europe | IT, SM, VA | Italy |
| 20 | `dach` | de-DE | en-US | EUR | europe | DE, AT, CH, LI | DACH |
| 30 | `france_fr_europe` | fr-FR | en-GB | EUR | europe | FR, BE, LU, MC | France / French-speaking Europe |
| 40 | `uk_ireland` | en-GB | en-US | GBP | europe | GB, IE, IM, JE, GG | UK & Ireland |
| 50 | `usa_national` | en-US | en-GB | USD | north_america | US | USA National |
| 60 | `usa_east_coast` | en-US | en-GB | USD | north_america | US | USA East Coast |
| 70 | `usa_south_florida` | en-US | en-GB | USD | north_america | US | USA South / Florida |
| 80 | `usa_west_coast` | en-US | en-GB | USD | north_america | US | USA West Coast |
| 90 | `gcc_luxury` | en-AE | en-GB | AED | mena | AE, SA, QA, KW, BH, OM | GCC Luxury Market |
| 100 | `central_america` | es-ES | en-US | USD | latam | MX, GT, BZ, SV, HN, NI, CR, PA | Central America |
| 110 | `spanish_latam` | es-ES | en-US | USD | latam | AR, CL, CO, PE, EC, UY, PY, BO, VE, DO, CU, PR | Spanish-speaking LatAm |
| 120 | `brazil` | en-US | es-ES | BRL | latam | BR | Brazil |
| 130 | `scandinavia` | en-GB | en-US | EUR | europe | SE, NO, DK, FI, IS | Scandinavia |

**Macro-region distribution:** europe ×6, north_america ×4, latam ×4 (incl. Brazil), mena ×1, americas ×1.

**Distinct primary_locale values (8):** `de-DE`, `en-AE`, `en-GB`, `en-US`, `es-ES`, `es-MX`, `fr-FR`, `it-IT`.

---

## 3 · Tabella `platform_languages` — schema completo

| # | Column | Type |
|---:|---|---|
| 1 | `code` | text (PK, BCP-47) |
| 2 | `name` | text (English name) |
| 3 | `native_name` | text |
| 4 | `region` | text |
| 5 | `dial_code` | text |
| 6 | `enabled` | boolean |
| 7 | `public_enabled` | boolean |
| 8 | `blueprint_enabled` | boolean |
| 9 | `default_locale` | boolean |
| 10 | `rtl` | boolean |
| 11 | `fallback_locale` | text |
| 12 | `sort_order` | integer |
| 13 | `ai_translation_enabled` | boolean |
| 14 | `short_label` | text |
| 15 | `base_code` | text |
| 16 | `metadata` | jsonb |
| 17 | `created_at` | timestamptz |
| 18 | `updated_at` | timestamptz |

### 3.1 Records (12 totali)

| code | native | enabled | public | default | rtl | fallback | short |
|---|---|:---:|:---:|:---:|:---:|---|---|
| `it-IT` | Italiano | ✅ | ✅ | ✅ | — | en-US | IT-IT |
| `en-US` | English (US) | ✅ | ✅ | — | — | en-US | EN-US |
| `en-GB` | English (UK) | — | — | — | — | en-US | EN-UK |
| `fr-FR` | Français | — | — | — | — | en-US | FR-FR |
| `de-DE` | Deutsch | — | — | — | — | en-US | DE-DE |
| `es-ES` | Español | — | — | — | — | en-US | ES-ES |
| `es-MX` | Español | — | — | — | — | es-ES | ES-MX |
| `ar-AE` | العربية | — | — | — | ✅ | en-US | AR-AE |
| `pt-BR` | Português | — | — | — | — | en-US | PT-BR |
| `pt-PT` | Português | — | — | — | — | pt-BR | PT-PT |
| `zh-CN` | 中文 | — | — | — | — | en-US | ZH-CN |
| `ja-JP` | 日本語 | — | — | — | — | en-US | JA-JP |

### 3.2 Stato critico

- **Solo 2 locale `enabled=true`**: `it-IT`, `en-US`.
- Le altre 10 sono **catalogate** ma **non abilitate** al pubblico.
- ⚠️ **Disallineamento markets ↔ platform_languages**:
  - 13 markets su 15 hanno `primary_locale` che **NON è enabled** in `platform_languages` (de-DE, en-AE, en-GB, es-ES, es-MX, fr-FR).
  - 1 anomalia: `gcc_luxury` → `primary_locale='en-AE'` ma `en-AE` non esiste come row in `platform_languages` (esiste solo `ar-AE` con `rtl=true`).
  - Solo `italy` (primary_locale='it-IT') ha la locale primaria **già abilitata**.

---

## 4 · Relazioni

```
                       ┌──────────────────────┐
                       │  platform_languages  │ (catalog, 12 BCP-47)
                       │   code (PK)          │
                       └──────────┬───────────┘
                                  │ (logical FK by string)
                  ┌───────────────┴────────────────┐
                  │                                │
           ┌──────▼──────┐                  ┌──────▼─────────┐
           │   markets   │                  │ editorial_*   │
           │  primary_   │                  │  variants etc │
           │  locale     │                  └────────────────┘
           └──────┬──────┘
                  │ id
        ┌─────────┴──────────────┐
        │                        │
┌───────▼────────┐      ┌────────▼─────────┐
│ tenant_markets │      │ account_markets │
│  market_id FK  │      │  (via tenant)   │
│  tenant_id FK  │      └──────────────────┘
└────────────────┘
```

**Note:**
- `markets.primary_locale` e `markets.fallback_locale` puntano a `platform_languages.code` **logicamente** (no FK strutturale a livello DB, per flessibilità). Validazione applicativa richiesta.
- `tenant_markets`: 8 rows totali — collega Studio a uno o più mercati di operatività (M:N).
- 5 tabelle editoriali (variants, cta_clicks, learnings, portfolio_variants) referenziano `markets.id` per personalizzazioni cultural-aware.

---

## 5 · Conclusioni inventario

| Voce | Stato |
|---|:---:|
| Schema `markets` ricco e BCP-47 compliant | ✅ |
| 15 records attivi, copertura globale (EU/NA/LatAm/MENA) | ✅ |
| `platform_languages` ha tutte le BCP-47 richieste dal brief | ✅ |
| `platform_languages.enabled` allineato a `markets.primary_locale` | ❌ Disallineamento — 10 lingue non enabled |
| FK strutturale `markets → platform_languages` | ❌ Solo logica, no constraint DB |
| `tenant_markets` populated | ⚠️ 8 rows (test data, da espandere) |

**Raccomandazione operativa:** per il Market Selector MVP, esporre tutti i 15 markets attivi, ma side-car validation: se `market.primary_locale` non è `enabled` in `platform_languages`, fallback automatico a `market.fallback_locale` (che a sua volta deve essere enabled). Inverno-2026: enablare progressivamente le altre 10 locale via Command Center.

---

*— fine schema audit —*
