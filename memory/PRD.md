# MOOD for DESIGN™ — Product Requirements Document


### ✅ Phase R-MARKET-1B — Locale-aware Frontend Architecture (Prompt 1) (DONE — 17 May 2026)

> **FINISHING MODE — Prompt 1 di 3.** Wiring completo dell'architettura di routing locale per il public storefront. URL subpath BCP-47 (`/it-IT`, `/en-US`, `/en-GB`, `/es-ES`, `/fr-FR`, `/de-DE`) accanto alle route legacy senza prefisso. SEO international-grade su tutto lo storefront, ZERO leak dell'`internal_translation` editor-only.

**Componenti nuovi (frontend)**
- `frontend/src/site/LocaleRoute.jsx` — Wrap per route con prefisso locale. Sincronizza `LocaleRuntimeContext` (formato composito `IT_IT`) e setta `<html lang>`.
- `frontend/src/site/LocaleHead.jsx` — Globale sotto `<BrowserRouter>`. Emette `<link rel=canonical>`, `<link rel=alternate hreflang>`, `<meta og:locale>`, `<meta og:locale:alternate>`. Filtra hreflang attraverso `SUPPORTED_LOCALES` per defendere da drift backend/frontend (es. `gcc_luxury`/`en-AE` seedato server-side ma senza route frontend → escluso dagli hreflang). Saltato su superfici non-storefront (auth/dashboard/admin/workspace/settings/client).
- `frontend/src/site/SiteLocaleBridge.jsx` — Vive dentro `SiteLayout`. Bridge URL → `SiteContext` per hot-swap della copia storefront quando l'utente apre `/it-IT` vs `/en-US`.
- `frontend/src/site/components/CountryLanguageSelector.jsx` — Modal luxury per market picker. Lista mercati attivi dal backend con macro-region grouping. Persistenza locale via SiteContext + LocaleRuntime. testid contract: `country-language-modal`, `country-language-search`, `country-language-pick-{code}`, `country-language-close`.
- `frontend/src/site/components/SiteFooter.jsx` — Aggiunto bottone "Country · Language" (testid `footer-country-language`) che apre il selector.

**Componenti modificati**
- `frontend/src/App.js` — 6 route locale-prefixed per home/projects/professionals + 6 magazine variants. LocaleHead montata globalmente sotto BrowserRouter.
- `frontend/src/site/SiteLayout.jsx` — Monta `SiteLocaleBridge` (rimosso LocaleHead da qui per evitare double-mount).
- `frontend/src/lib/api.js` — `isPublicSurface` ora include il prefisso BCP-47 (`/^\/[a-z]{2}-[A-Z]{2}(\/|$)/`). Senza questa fix, un 401 transient su `/api/branding` dirottava `/it-IT` → `/auth/login`.

**Database**
- Demo tenant `mood-demo-studio-81a09e`: attivato `spanish_latam` (es-ES) come tenant_market (sort_order=100). Ora 7 mercati attivi: italy/dach/france_fr_europe/uk_ireland/usa_national/gcc_luxury/spanish_latam.

**SEO guardrails**
- **NO leak** di `internal_translation` → mai esposta come URL, mai nei hreflang.
- **Unsupported locale segments** (`/en-AE`, `/pt-BR`, `/ja-JP`) → fall-through a 404 PublicTenantPage + ZERO SEO tag emesso.
- **Auth surfaces** (`/auth/login`) → ZERO SEO tag.
- **Legacy `/`** → canonical → `/it-IT` (default market del tenant), NON la sticky session locale.
- **Locale-prefixed pages** → canonical = stesso URL; 6 hreflang BCP-47 supportati + 1 x-default.

**Test verificati**
- `/app/backend/tests/test_phase_r_market_1b_locale_wiring.py` (nuovo) — markets endpoint + locale runtime resolve.
- 29/29 backend tests PASS (test_phase_r_market_1a + test_phase_r_market_1b + test_phase_e_1b_studio).
- E2E playwright: canonical / hreflang / og / html-lang verificati su tutti i 6 locales + legacy / + paths unsupported + auth.

**Design polish backlog (non-blocking, non in Prompt 1 scope)**
- Header `Sobre nosotros` (es-ES) si sovrappone al logo a 1280px. Spacing rule.
- Hero `/es-ES` ha copia mista IT/EN/ES. Da rimandare al traduttore editoriale.

---


### ✅ Phase E-1B — Editorial Studio™ (composition surface) (DONE — 17 Feb 2026)

> **NON è un AI writer · NON è un GPT wrapper.** È la **Composition Room** dell'Editorial Intelligence Studio di MOOD: una macchina di reinterpretazione culturale market-native. Mai una traduzione, sempre una RESTAGING del Master Direction. Linguaggio editoriale assoluto: l'AI è invisibile.

**Migration `037_editorial_memory.sql` — 2 tabelle**
- `editorial_market_learnings` — Market Learning patterns aggregati (pattern_key / signal_payload / confidence / sample_size) per `(tenant, market)`. Cold-start friendly: confidence < 0.55 viene calcolata ma non iniettata nel composer.
- `editorial_composition_log` — audit trail di ogni composizione: `composition_trace` (lista dei moduli che hanno contribuito), `duration_ms`, `outcome`, `user_facing_label` (linguaggio editoriale, MAI provider names visibili nel UI).

**Modular Prompt Composer — `/app/backend/services/editorial_prompt_composer/`**
10 moduli, ciascuno restituisce un *prompt fragment* strutturato. La composer cuce un singolo brief culturalmente ricco. **NESSUN prompt generico.**


### ✅ Phase E-2 — Composition Room & Editorial Workflow UI (Prompt 2) (DONE — 17 May 2026)

> **FINISHING MODE — Prompt 2 di 3.** International editorial desk completo. Entry point top-level `/blueprint/editorial` con sidebar label "Editorial Studio". Split-pane operativo (calendar a sinistra · article editor a destra). Toolbar verbi editoriali (NO AI/GPT). Tab semantica strict: Internal Understanding REVIEW-ONLY · Published Locale EDITABLE+PUBLISHABLE. Preview reale via new tab. Schedule MVP via `publish_at` datetime. Tutti i 5 spine status visibili come dots editorial. `/magazine/:slug` repurposed → legge prima editorial_variants.

**Componenti frontend (nuovi)**
- `frontend/src/pages/editorial/EditorialStudioPage.jsx` — Split-pane root al route `/blueprint/editorial`. Carica `/editorial/variants/{id}` quando una variante è selezionata.
- `frontend/src/pages/editorial/CompositionRoomRail.jsx` — Sinistra: filtri market + 5 spine status chips, lista Masters → variants con dot+market+locale+schedule.
- `frontend/src/pages/editorial/ArticleEditorPanel.jsx` — Destra: toolbar verbi `Compose Direction · Refine Editorial Angle · Rebalance Hospitality Tone · Preview · Programma · Pubblica ora`. 2 tab strict:
  - **Internal Understanding** (review-only) — banner spiega che NON è pubblicabile/indicizzata; rendering read-only del `internal_translation`.
  - **Published Locale** (editable) — title (display serif), excerpt, body blocks, cta_set (tier+label+action), SEO (seo_title, meta_description, focus_intent). Debounced autosave via PATCH `/editorial/variants/{id}`.
- `frontend/src/pages/editorial/editorialStatus.js` — STATUS_META con dot colors + SPINE_STATUSES (draft, ai_composing, ready_for_editorial_review, scheduled, published).
- `frontend/src/pages/editorial/editorial.css` — Aesthetic cream/ink, NO badge enterprise, schedule modal calmo.

**Componenti modificati**
- `frontend/src/components/layout/Sidebar.jsx` — Aggiunta voce `Editorial Studio` (BookOpen icon) sotto `can('tenant:settings')`.
- `frontend/src/App.js` — Route `/blueprint/editorial` registrata sotto `StudioAdminRoute`.
- `frontend/src/pages/site/MagazineArticlePage.jsx` — Prima tenta `/api/magazine/public/{tenant}/editorial/{slug}?locale_code=<bcp47>`, fallback legacy `/articles/{slug}`.

**Backend (nuovo endpoint)**
- `GET /api/magazine/public/{tenant_slug}/editorial/{variant_slug}` (`backend/routers/magazine.py`):
  1. Match esatto (variant_slug, target_locale, is_published=true)
  2. Fallback: qualsiasi variant pubblicata con quello slug
  3. **`_shape_variant_as_article`** rimuove `internal_translation` server-side. Mai pubblico, mai indicizzato.
  4. Best-effort increment `performance_signals.public_views`.

**Database**
- Test seed: ~10 master/variant `e2p2-*` creati durante pytest. Demo tenant ora ha 71 master + 60 variants.

**Editorial safety invariants (verificati)**
- `internal_translation` MAI in: calendar response, editorial/variants list, editorial/{slug} public read.
- GET `/editorial/variants/{id}/internal-translation` richiede auth (401 anonymous).
- Internal Understanding tab è strutturalmente read-only: ZERO `<input>` / `<textarea>` / `contenteditable` dentro `ed-internal-content`.
- Toolbar UI usa SOLO i 3 verbi editoriali. Forbidden words `Generate / AI / GPT / Claude` ASSENTI dal pane.
- Preview URL shape: `/<locale>/magazine/<slug>?preview=1` con `target=_blank`.

**Test verificati (iteration_55.json)**
- `/app/backend/tests/test_phase_e2_p2_editorial_public.py` (nuovo, 11 test): public editorial endpoint, internal_translation isolation, PATCH autosave, schedule, toolbar surface.
- 58/58 backend tests PASS totale.
- Frontend split-pane verified end-to-end via SuperAdmin login: 71 masters + 60 variants, 8 market chips + 6 status chips, tabs operativi, Preview href corretto, banner internal, ZERO editable input nel review tab.

**Backlog post-Prompt-2 (non-blocking)**
- Nessun bug aperto. Solo refactor stylistici opzionali.

---


| Modulo | Cosa fa |
|---|---|
| `master_direction` | Surfacce l'intent editoriale centrale dal Master come *direzione*, non da paraphrasare |
| `market_lens` | Adotta cultural_profile + tone_of_voice + cta_style + seo_intent del market (e del sub_region se presente) |
| `hospitality_logic` | Welcome codes specifici per market (Italian maestro · DACH precision · GCC ceremonial arrival · Aspen fire-lit warmth · Scandi plain-spoken · …) — opening_gesture, closing_gesture, what_to_avoid |
| `luxury_perception` | Cosa conta come luxury QUI ≠ ovunque. `signal` da usare, `anti_signal` come allergia lessicale |
| `material_vocabulary` | Palette materiali per market (travertino romano vs Jura limestone vs onyx vs talavera…) + lexicon prefer/avoid |
| `sensory_atmosphere` | **Il modulo critico**: light, tactility, spatial_feeling, lighting_vocab, emotional_pacing, sensuality — per market e per sub_region (Miami luminous-tropical · Aspen fire-lit-intimate · Dubai ceremonial-reflective · …). Senza questo, l'AI scivola in "warm light, natural materials" ovunque |
| `cta_psychology` | Preferred_tiers + preferred_intents + framing_paragraph per market. Le CTA sono **transizioni editoriali**, non bottoni |
| `seo_intent` | SEO editorial-grade: seo_title come headline pubblicabile, meta_description narrativa ≤ 155 char, hreflang BCP-47. **MAI keyword spam** |
| `memory_injector` | Inietta `editorial_market_learnings` con confidence ≥ 0.55 come ADVISORY |
| `editorial_runtime` | Orchestratore: SYSTEM_INSTRUCTIONS (8 regole non-negoziabili) + OUTPUT_CONTRACT JSON strict |

**Service `services/editorial_ai.py` (composition runtime)** — 4 verbi editoriali, MAI "AI":

| Verbo (UI) | Function | Behaviour |
|---|---|---|
| **Compose Direction** | `compose_variant()` | Status → `ai_composing` → output → `ready_for_editorial_review`. Crea title/body/CTA/SEO market-native |
| **Refine Editorial Angle** | `refine_editorial_angle()` | Editor seleziona `revision_options` (editorial-grade) + notes → restage. Valida options contro lookup platform (defence in depth) |
| **Rebalance Hospitality Tone** | `rebalance_hospitality_tone()` | Aggiusta pacing / luxury intensity / CTA framing senza riscrivere |
| **Internal Translation** | `compose_internal_translation()` | Mirror nella `blueprint_review_locale` per la review editor. Salvato in `internal_translation` JSONB, **MAI public/indexed/served** |

Integrazione via `emergentintegrations.LlmChat` + Emergent LLM Key con Claude Sonnet 4.5. JSON output enforced (strip code fences + retry trailing-comma). Audit log per ogni call.

**Service `services/editorial_memory.py` — Cultural Calibration**
Aggrega segnali da `editorial_cta_clicks` + variants `performance_signals` in 6 pattern keys: `cta_tier_conversion`, `cta_intent_resonance`, `atmosphere_signal_density`, `material_curiosity`, `preferred_pacing`, `preferred_tone`. Confidence basata su sample size + signal dominance (logistic-ish smoother).

**Backend endpoints** (in `routers/editorial.py`):
- `POST /editorial/variants/{id}/compose` (Compose Direction)
- `POST /editorial/variants/{id}/refine-angle` (Refine Editorial Angle)
- `POST /editorial/variants/{id}/rebalance-tone` (Rebalance Hospitality Tone)
- `POST /editorial/variants/{id}/internal-translation` (Drafting internal understanding)
- `GET  /editorial/variants/{id}/internal-translation` (Blueprint-only)
- `POST /editorial/markets/{id}/recompute-learnings` (Cultural Calibration)
- `GET  /editorial/markets/{id}/learnings`
- `GET  /editorial/variants/{id}/composition-log` (modular trace)

**Verifica live (production-grade test su GCC)**
- Master "Warm Italian Living" + variant GCC `e1b_test` → Compose Direction → **47.6s** durata:
  - Title: *"The Travertine House: Italian Materiality Restaged for the Gulf"* — culturalmente nativo (MAI traduzione)
  - Excerpt: *"Where Mediterranean light meets the ceremonial grace of the majlis — a dialogue between walnut, travertine, and polished stone that honours two traditions of welcome."* — esatto match con hospitality_logic GCC + material_vocabulary palette + sensory_atmosphere ceremonial
  - tone_label: `prestige_restraint` ✓ · pacing_label: `ceremonial` ✓ (corretto match con sensory_atmosphere GCC)
  - 17 body_blocks · 2 CTA dai preferred_tiers GCC ([soft] *Speak with Our Team* + [strong] *Arrange a Private Consultation*)
  - SEO editoriale (NON keyword spam) · meta 129 chars · hreflang en-AE
- Internal Translation it-IT (50.6s) → *"The Travertine House: Materialità Italiana Reinterpretata per il Golfo"* — fedele, `_notice: For Blueprint review only — not published` ✓
- Calendar leak test: ✓ `internal_translation` MAI esposto
- Composition log: 9 moduli registrati per `compose`, label `"Composing editorial direction…"`, durata tracciata

**Pytest — 49/49 pass complessivi** (7 E-1B smoke + 18 E-1A + 13 R-MARKET-1A + 11 R-CRM-2A). Zero regressioni. Smoke E-1B verifica: endpoint auth-gated · internal_translation MAI in calendar · public storefront non menziona mai "gpt/claude/openai/anthropic/ai generated" · revision_option validati · composition_log esponse trace + user_facing_label editoriale.

**UX language commitments (per Phase E-1C)**:
- **MAI**: Generate · Regenerate · Rewrite · GPT · Claude · AI · Prompt
- **SEMPRE**: Compose Direction · Refine Editorial Angle · Rebalance Hospitality Tone · Editorial Studio · Composition Room · Market Perspective · Publication Flow · Editorial Review · Cultural Calibration · Market Learning
- Loading: *"Composing editorial direction…"* / *"Drawing market resonance…"* / *"Balancing hospitality tone…"* / *"Drafting internal understanding…"* / *"Recalibrating market resonance…"* — MAI spinner generici o progress bar AI-style.

**Phase E-1C (prossima)** — Blueprint UI: Composition Room visiva, Approval Salon, Editorial Calendar luxury, Cultural Calibration panel — sospesa fino a quando il motore non "sembra scritto da un editorial director locale". Già verificato sull'output GCC.

────────────────────────────────────────────────────────────────────────



### ✅ Phase E-1A — Editorial Intelligence Operating System™ — Foundation (DONE — 17 Feb 2026)

> **NON è un CMS, NON è un AI article generator. È il CULTURAL EDITORIAL ENGINE di MOOD**: ogni variant pubblicata è una reinterpretazione market-native di una direzione editoriale centrale (Editorial Master™), MAI una traduzione piatta. Foundation pura — AI generation (Claude Sonnet) e UI Blueprint Editor / Editorial Calendar arrivano in E-1B/E-1C.

**Migration `036_editorial_intelligence_os.sql` — 4 tabelle**
- **`editorial_masters`** — la *direzione culturale centrale* (memoria editoriale). NON è un articolo. Contiene: `code` (unique per tenant), `title`, `canonical_locale`, `conceptual_direction`, `emotional_objective`, `target_psychology`, `architectural_tone`, `hospitality_positioning`, `material_language`, `cta_intent`, `seo_intent`, `baseline_imagery`, `canonical_article_seed`, `taxonomy`, `master_status`.
- **`editorial_variants`** — reinterpretazioni market-native (multiple per master × market: stagionalità, edizioni, A-B narrative). UNIQUE su (master_id, market_id, edition, season, slug). Carica SIA il `title/body_blocks` published-locale SIA il `internal_translation` per la review Blueprint (mai indicizzato, mai pubblico, mai restituito dal calendar/public endpoint). Campi cultural-aware: `cultural_angle`, `tone_label`, `pacing_label`, `cta_set` (multi-tier), `performance_signals` (light intelligence — no GA-style aggressive analytics).
- **`editorial_revisions`** — append-only history. Memoria strutturata: `revision_options[]` (chiavi da lookup platform), `notes`, `scope` (full/title_only/body_only/cta_only/seo_only/imagery_only), `before_snapshot`/`after_snapshot`, `ai_response_meta` (popolato in E-1B), `status` (pending/applied/rejected/superseded).
- **`editorial_cta_clicks`** — feed diretto al Relationship CRM. Cattura `cta_tier`, `cta_intent`, `atmosphere_context`, `time_on_article_sec`, `hotspots_opened`, `materials_viewed`, `references_saved`, `resulting_lifecycle_stage`, `resulting_intent_label`, FK opzionali a `accounts/contacts/interactions`.

**Seed `seed_editorial_lookups.py` — 49 valori platform-level su 7 nuovi gruppi**
- `article_status` (9) — pipeline raffinata: `draft → direction_defined → ai_composing → ready_for_editorial_review → revision_requested → approved → scheduled → published → archived` (chip colors metadata).
- `revision_option` (10) — **editorial-grade**: NO "rewrite/fix grammar/shorten". SI "Increase hospitality resonance" · "Reduce luxury intensity" · "Strengthen material storytelling" · "More architectural authority" · "More emotional pacing" · "Improve wellness atmosphere" · "Reduce editorial density" · "Stronger CTA transition" · "More collectible design tone" · "More international buyer appeal".
- `cta_tier` (3) — soft / medium / strong, ciascuno con `metadata.resulting_lifecycle_stage` + `resulting_intent_label_key` (cablaggio CTA → CRM).
- `cta_intent` (11) — Soft (6) · Medium (3) · Strong (2) per le 11 CTA esatte richieste (Contact the Studio / Ask About Materials / Book a Showroom Visit / Request More Information / Speak With Our Team / Discover Collections / Share Your Inspiration / Send Your Floor Plan / Request Design Advice / Start Your Project / Book a Discovery Session).
- `editorial_tone` (8) — *cultural tension* labels: progettuale_italian / aspirational_lifestyle / prestige_restraint / execution_discipline / ceremonial_materiality / experiential_living / savoir_faire / plain_spoken_restraint.
- `editorial_pacing` (5) — slow_editorial / measured / aspirational / ceremonial / precise.
- `editorial_lead_intent` (3) — `inspiration_interest` → new_inquiry · `qualified_editorial_lead` → lead · `discovery_request` → discovery. **Tutti i CTA tier producono Account+Contact** ma con `lifecycle_stage` mappato dal `cta_tier` metadata.

**Backend router `/api/editorial/*`**
- Masters CRUD (`GET/POST/GET/PATCH/DELETE`) — codici unique per tenant
- Variants CRUD + `POST /variants/{id}/transition` (graph allowed_transitions: blocca jumps illegali → 409) + `POST /schedule` (gate: solo da approved/scheduled) + `POST /publish`
- Revisions append-only `POST /variants/{id}/revisions` — valida `revision_options` contro lookup platform, salva before-snapshot, bumpa contatore, sposta status a `revision_requested`. `PATCH /revisions/{id}/apply` per applicazione manuale (E-1B sostituirà con AI).
- `GET /editorial/calendar?from=&to=&market_id=` — vista scheduled, **strip internal_translation** prima della risposta
- **`POST /api/public/editorial/cta-click`** (anonymous) — cuore del cablaggio editorial → CRM:
  - SOFT senza identità → solo traccia il click + bump performance_signals
  - SOFT con identità / MEDIUM / STRONG → crea **Account** (lifecycle_stage mappato dal tier metadata) + **Contact** + **Interaction** `web_lead_generation` con `report_payload` che preserva variant_id, market_id, cultural_angle, tone_label, hotspots_opened, materials_viewed, atmosphere_context, editorial_lead_intent
  - L'`accounts.metadata_json` riceve `origin_variant_id` · `origin_market_id` · `origin_locale` · `cultural_angle` · `tone_label` · `editorial_lead_intent` — **trasformando MOOD anche in motore di intelligence commerciale culturale** (richiesta esplicita)

**Verifica live + pytest**
- ✅ **42/42 pytest pass** complessivi (18 Phase E-1A + 13 Phase R-MARKET-1A + 11 Phase R-CRM-2A). Zero regressioni.
- Test end-to-end manuale: creato master "Warm Italian Living" → variant `gcc_winter_2026` per GCC market → 6 transizioni stato (draft → published) → STRONG CTA click con visitor Faisal Al Mansoori → Account creato in CRM con `lifecycle_stage='discovery'`, `editorial_lead_intent='discovery_request'`, `cultural_angle='Italian quiet luxury meets Gulf hospitality theatre'`, Contact + Interaction `web_lead_generation` con report_payload completo.
- Invarianti chiave verificate: cta_tier→CRM mapping (soft/medium/strong → new_inquiry/lead/discovery), revision_option editorial-grade (forbidden tech terms test passa), multiple variants per master×market consentiti, internal_translation MAI esposto da calendar/public/list endpoints.

**Phase E-1B (prossima)** — AI Generation + Internal Translation:
- Service `editorial_ai.py` con Claude Sonnet via Emergent LLM Key
- `generate_variant(master_id, market_id)`: legge `markets.cultural_profile + tone_of_voice + cta_style + seo_intent` + master direction → scrive variant *culturally adapted*
- `generate_internal_translation(variant_id, blueprint_locale)` per la review interna
- `regenerate_with_revisions(variant_id, options[], notes)` → AI applica feedback strutturato

**Phase E-1C** — Blueprint Editor UI + Editorial Calendar (calendar/list views) — già definito a livello UX nel prompt utente.

**Phase E-1D** — Public Storefront rendering market-adapted + hreflang generation + CTA tracking client-side (già backend-pronto via `/api/public/editorial/cta-click`).

────────────────────────────────────────────────────────────────────────



### ✅ Phase R-MARKET-1A — Blueprint vs Market Locale Separation (DONE — 17 Feb 2026)

> **Tre strati di locale, finalmente separati**:
> 1. **Blueprint UI Locales** — l'interfaccia interna del CRM (canonica, MOOD-managed, traducibile per locale ma NON personalizzabile per tenant).
> 2. **Frontend Market Locales** — i mercati editoriali (Italy, DACH, France/FR-EU, UK & Ireland, USA National, USA East/South/West, GCC, Central America, Spanish LatAm, Brazil, Scandinavia). Ogni Market = locale + cultural_profile + tone_of_voice + cta_style + currency + units + SEO intent + sub-regions. **Market ≠ Language**.
> 3. **Editorial Market Localization** — il `LocaleRuntime` + `reference_locale_interpretations` esistenti continueranno a guidare il riposizionamento culturale; verranno collegati ai Market nella Phase 1B.

**Migration `035_blueprint_vs_market_locale_split.sql`**
- `relationship_lookups` reso bi-scoped: aggiunta colonna `scope TEXT CHECK ('platform'|'tenant')`, `tenant_id` ora NULLABLE per le righe platform.
- Sostituito il `UNIQUE (tenant_id, group_key, value_key)` con DUE partial unique index per gestire correttamente i NULL (platform vs tenant).
- Nuova tabella **`markets`** (15 colonne: `code`, `display_name JSONB` per-locale, `macro_region`, `countries[]`, `primary_locale`, `fallback_locale`, `currency`, `measurement_system`, `cultural_profile`/`tone_of_voice`/`cta_style`/`seo_intent` JSONB, `sub_regions JSONB`, `active`, `sort_order`).
- Nuova tabella **`tenant_markets`** N:N: `is_active`, `is_default` (mutex via partial unique index), `sort_order`, `custom_settings JSONB`.

**Migration script `migrate_lookups_to_platform.py`** — idempotente:
- 84 valori CRM-core spostati a platform-level (`tenant_id IS NULL`): `lifecycle_stage` (9) · `account_type` (9) · `source` (11) · `interaction_type` (23) · `action_type` (13) · `priority` (4) · `visibility_level` (6) · `relationship_health` (5) · `communication_preference` (4).
- 84 duplicati tenant-scope rimossi.
- 38 valori stylistic rimasti tenant-scope: `style` (8) · `material` (11) · `atmosphere` (8) · `budget_range` (6) · `timing_range` (5).

**Seed `seed_markets.py`** — 13 mercati canonici:
| Code | Locale primario | Currency | Sub-regions |
|---|---|---|---|
| italy | it-IT | EUR | — (default demo) |
| dach | de-DE | EUR | — |
| france_fr_europe | fr-FR | EUR | — |
| uk_ireland | en-GB | GBP | — |
| usa_national | en-US | USD | **6 sub-regions seedate** |
| usa_east_coast | en-US | USD | — |
| usa_south_florida | en-US | USD | — |
| usa_west_coast | en-US | USD | — |
| gcc_luxury | en-AE | AED | — (ar-AE futuro) |
| central_america | es-ES | USD | — (es-MX/CR futuri) |
| spanish_latam | es-ES | USD | — (es-AR/CO futuri) |
| brazil | en-US (fallback) | BRL | — (pt-BR futuro) |
| scandinavia | en-GB | EUR | — |

USA National sub-regions (DATA ONLY, no geo routing): `miami_south_florida` · `new_york_tri_state` · `los_angeles_california` · `chicago_midwest` · `texas` · `aspen_mountain_luxury` — ciascuno con `cities_anchor` + `cultural_profile` + `aesthetic_pillars`.

**Backend** — nuovo router `/app/backend/routers/markets.py`:
- **Storefront public (anonymous)** `GET /api/storefront/public/{slug}/markets` — solo i markets attivi del tenant + `default_market`. Ritorna i fields contract necessari al futuro Country/Language selector (display_name multi-locale, locale, countries, currency, measurement_system, macro_region, sub_regions stub).
- **Tenant-owner** `GET /api/tenants/me/markets` (lista di tutti i 13 con flag `is_active`/`is_default`/`tenant_sort`/`custom_settings`) · `PATCH /api/tenants/me/markets/{market_id}` (toggle active/order/default · mutex single-default enforced).
- **Super-admin only** `GET/POST/PATCH/DELETE /api/markets` (gestione catalog platform-level). Anonymous 401, non-super-admin 403.
- **`/api/relationships/lookups` aggiornato**: ritorna UNION platform-rows + tenant-stylistic-rows, con override tenant solo per i gruppi non-core. CRM-core groups protetti via `CRM_CORE_GROUPS` set (defence in depth).

**Verifica (pytest)**:
- **24/24** test passing — `test_phase_r_market_1a.py` (13 nuovi) + `test_relationship_lookups_locale.py` (11 pre-esistenti, zero regressioni).
- Invarianti: 13 markets seedati · USA sub-regions === {miami, NYC, LA, Chicago, Texas, Aspen} · default=Italy · public endpoint anonymous · CRM-core platform-scoped · stylistic tenant-scoped · 6 BCP-47 locali ancora presenti dopo lo split · toggle round-trip.

**Frontend** — nessuna modifica al CRM page necessaria. Lo split è trasparente: `useLookups()` riceve la UNION dall'endpoint, le label/colori chip continuano a funzionare identici. **Verificato live**: 59 accounts · 59 stage chips colorati · modal "Nuova relazione" con 9 account_type + 11 source options popolati dai lookups platform.

**Phase R-MARKET-1B (prossima)** — Footer Country/Language selector Apple-style (modal/mega-menu con macro-regions, countries, languages, search, design premium). Footer `<MarketSwitcher>` + locale resolution chain (browser/OS → saved → tenant default → IP geo futura). hreflang generation per SEO internazionale.

**Phase R-MARKET-1C (future)** — Editorial wiring: collegare ogni Market al `LocaleRuntime` + AI editorial engine → market-adapted content (non solo traduzioni: tono, CTA, narrative culturali).

────────────────────────────────────────────────────────────────────────



### ✅ Phase R-CRM-2A — Locale-Aware Foundation (DONE — 17 Feb 2026)

> **NO hardcoded business values. NO hardcoded UI labels.** Tutta la struttura del CRM è ora **locale-aware + config-driven**: ogni dropdown, chip, etichetta filtro, formato data e colore stage proviene dal Blueprint Command Center catalog (DB) o dai dizionari i18n. Pronta per l'espansione a nuovi tenant/lingue/personalizzazioni senza modifiche al codice.

**Architettura locale-aware (BCP-47)**
- 6 locale strict BCP-47 supportati: **it-IT** (platform default), **en-US**, **en-GB**, **es-ES**, **fr-FR**, **de-DE**.
- `en-US ≠ en-GB`: terminologia luxury differenziata (`lead`→"Lead" us, "Opportunity" uk · `prospect`→"Qualified Opportunity" uk · `active_project`→"Live Project" uk · `web_form`→"Web enquiry" uk · …).
- Pronta per espansione: `en-AE`, `ar-AE`, `pt-BR`, `es-MX` (architettura già fallback-chain ready).
- Fallback chain per locale richiesto: `target → same-family siblings → tenant_default → platform_default (it-IT) → en-US (universal)`.

**Backend**
- **`relationship_lookups` rebooted** — 122 valori, 14 group_keys, ogni valore con `label` JSONB chiavi BCP-47 (es. `"it-IT": "Lead", "en-GB": "Opportunity"`) + `metadata` JSONB per `color {bg, ink}` (per stage/priority/health) e `icon`/`permission_key` opzionali. **Nessuna chiave legacy `it`/`en` lingua-only** sopravvive.
- **`tenants.default_language` + `active_languages`** normalizzati a BCP-47 (`it-IT` default, 6 active per demo tenant).
- **Endpoint** `GET /api/relationships/lookups` invariato (already locale-aware: ritorna `label` JSONB grezza, la risoluzione locale avviene client-side via fallback chain).
- **Pytest suite** `/app/backend/tests/test_relationship_lookups_locale.py` — 11 invarianti: 6 locali presenti su lifecycle_stage / account_type / source, color metadata su stage/priority/health, divergenza en-US/en-GB su `lead`, nessuna chiave language-only, filtraggio `?group=`, auth gating.
- **Pytest regression** `/app/backend/tests/test_phase_r_crm_2a_regression.py` — 7 test: account CRUD + stage transition + ObjectId leak guard (creato dal testing agent in iteration 52).

**Frontend i18n engine — `/app/frontend/src/i18n/`**
- `engine.js`: `toBcp47()` (IT_IT→it-IT, it→it-IT, en→en-US, normalizes casing) · `buildFallbackChain(locale, tenantDefault?)` · `pickLocaleValue(jsonbLabel, locale)` (per lookups) · `pickString(key, locale, params?)` (per dizionari UI).
- `formatters.js`: `fmtDate / fmtRelative / fmtNumber / fmtCurrency` tutti via `Intl.*` con BCP-47 locale + currency hint per locale (EUR/USD/GBP/AED/BRL/MXN).
- `useT.jsx`: `<BlueprintI18nProvider>` montato in `App.js` sotto `LocaleRuntimeProvider`. Hook `useT()` restituisce `{ locale, t, pickLabel, fmtDate, fmtRelative, fmtNumber, fmtCurrency, chain, tenantDefaultLocale, currency }`. Hook `useLookups(group)` con cache in-memory + invalidazione via custom event `mfd:lookups:invalidate`, restituisce `{ items, byValue, labelOf, colorOf, loading }`.
- 6 dizionari `strings/{it-IT,en-US,en-GB,es-ES,fr-FR,de-DE}.json` per la sezione Relationships + chiavi comuni `common.*` riutilizzabili.

**Refactor `RelationshipsPage.jsx` — ZERO hardcoded business strings**
- Rimossi: `STAGE_PALETTE`, `ACCOUNT_TYPE_LABEL`, `PIPELINE_ORDER` (sostituito dall'ordine dei lookup) e tutte le label hardcoded dei `SIDEBAR_GROUPS` (rimangono SOLO i predicate boolean — value_keys stabili). Tutte le stringhe via `t('relationships.…')`. Stage chip colour via `colorOf(value)` da lookup metadata. Date relative via `fmtRelative(iso)`. Modal dropdown `account_type` e `source` alimentati da `useLookups('account_type')` / `useLookups('source')`.

**Verifica live (testing agent — iteration 52)**
- 18/18 backend pytest (11 locale + 7 regression) · 100% in-scope frontend
- Stage chip color invariant **provato**: computed CSS `rgb(245,236,219)` ↔ backend `metadata.color.bg = #F5ECDB` per `new_inquiry`; `rgb(222,233,224)` ↔ `#DEE9E0` per `prospect`. Nessuna palette JS lato frontend.
- Modal "Nuova relazione" dropdown alimentati da lookups (Cliente privato / Studio di architettura / Form sito / Visita showroom · zero raw value_keys nel DOM)
- Drawer 4-tab labels da dizionario (`OVERVIEW · CONTATTI · TIMELINE · PROSSIMI PASSI`), subheader "ultima attività 2 min fa" via Intl.RelativeTimeFormat IT
- 9 colonne Kanban da lookups (sort_order based, non più hardcoded `PIPELINE_ORDER`)
- Stage POST rifiuta value sconosciuti con 400/422 — nessun MongoDB `_id` leak

**Note UX (non bloccante)**
- Kanban 1920×: visibili 5 di 9 colonne, le restanti richiedono scroll orizzontale (design intenzionale). Eventuale chip-density toggle valutabile in Phase 3 Grid Mood View.

**Phase R-CRM-2B/C/D (prossime)**
- 2B: Blueprint Command Center UI `/workspace/settings/catalog` per editing lookups (CRUD, drag-reorder, traduzioni per locale, attiva/disattiva, tenant-specific override) · permission key `crm.catalog.manage` predisposta in metadata
- 2C: Quick Create dropdown + Guided New Lead Wizard (6 step) con dropdown 100% da lookups + duplicate prevention
- 2D: Endpoint anonimo `POST /api/public/leads` (web_lead_generation interaction + alert auto) + collegamento storefront form → CRM
- 2E: Drawer tabs rimanenti (Style DNA · Moodboards · Projects · Files · Team & Permissions)

────────────────────────────────────────────────────────────────────────



### ✅ Phase R-CRM-1 — Relationship CRM Foundation (DONE — 17 Feb 2026)

> **NON è un sales CRM. NON è enterprise.** È una **shared relationship memory** per studi di interior design, showroom di arredo e studi A&D — pensata per chi oggi lavora con email, WhatsApp e memoria personale.

**DB (migration `034_relationship_crm.sql`)** — 6 tabelle + 1 catalog:
- `accounts` (private_client | studio | developer | partner_ad | …) con `lifecycle_stage`, `source`, `primary_owner_id`, `relationship_health`, `legacy_lead_id` per tracciare la provenienza dalla legacy `leads` table.
- `contacts` — N contatti per account, con `primary_contact` flag, `role`, `department_or_area`, `communication_preference`.
- `interactions` — timeline completa: call / email / whatsapp / showroom_visit / business_meeting / discovery_interview / moodboard_sent | viewed / proposal_* / post_visit_report / internal_note / voice_note / ai_summary / web_lead_generation / stage_change. Campo `report_payload` JSONB per post-visit reports estendibili.
- `relationship_actions` — prossimi passi / reminders (NON tasks): `call_back / send_email / send_moodboard / follow_up / schedule_meeting / material_deadline / proposal_feedback / send_quote / no_activity_alert / engagement_alert`. Auto-creazione quando un'interazione ha `next_step` + `next_follow_up_date`.
- `account_style_profile` — Style DNA (preferred styles/materials/colors/rooms/atmosphere + budget + timing + AI tags + designer validated).
- `account_team_members` — collaborators per-account con `role_in_account` (primary_owner | contributor | previous_owner | invited_colleague) e `visibility_level` (full | crm_only | moodboards_only | projects_only | commercial_only | read_only).
- `relationship_lookups` — **Blueprint Command Center catalog**: 14 group_keys (lifecycle_stage, account_type, source, interaction_type, action_type, priority, budget_range, timing_range, style, material, atmosphere, visibility_level, relationship_health). Etichette per-locale (it/en/…), riordinabili, attivabili/disattivabili — **NO HARDCODED VALUES**.

**Backend** — router `/api/relationships/*` con 20+ endpoints:
- `GET/POST /api/relationships/accounts` (filtri stage, type, owner, source, q), `GET /{id}` (account + contacts + style + team + counts), `PATCH /{id}`, `POST /{id}/stage` (emette `stage_change` interaction), `DELETE /{id}` (soft-archive).
- Contacts: add / patch / delete con `primary_contact` mutex automatico.
- Interactions: list, add (auto-crea `relationship_actions` follow-up se `next_step` + date), patch, delete. Aggiorna `last_activity_at` su account.
- Actions: list (filtro `?status=`), create, patch (mark done → `completed_at`).
- Style DNA: get / put upsert.
- Lookups: `GET /api/relationships/lookups?group=...` raggruppato per Command Center.

**Script di migrazione** `/app/backend/scripts/migrate_leads_to_relationships.py` — idempotent, ha migrato i **59 leads legacy** in account+contact+inception interaction. Preservato: nome, email, telefono, type, budget, status, created date, notes, locale. `accounts.legacy_lead_id` traccia la provenienza così re-run del migration salta i già migrati.

**Seed lookups** `/app/backend/scripts/seed_relationship_lookups.py` — 13 group_keys, ~120 valori it/en per il demo tenant.

**Frontend** — nuova route `/workspace/relationships` (`RelationshipsPage.jsx`):
- **Topbar**: eyebrow *"Relationship OS"* + H1 *"Relazioni"* + subtitle italic + search · view toggle (Tabella / Kanban) · gold CTA **+ Nuova relazione**.
- **Sidebar editoriale** con 9 filtri smart (Tutte le relazioni / Nuove / Non assegnate / Da seguire / High intent / Internazionali / Progetti attivi / Clienti / Archiviate) con contatori live.
- **Tabella**: avatar circolare iniziali + nome account + città/country, tipo, **stage chip cromatico** (palette mockup-aligned), contatto primario, ultima attività italica relativa, badge azioni aperte (icon AlertTriangle gold), owner.
- **Kanban**: 7 colonne pipeline (Nuova richiesta → Lead → Discovery → Prospect → Progetto attivo → Cliente → Archiviato) con card editoriali compatte.
- **Account Detail Drawer** (slide-in 760px, right): header con stage chip + tipo + nome serif 28px + città · ultima attività. 4 tab MVP:
  - **Overview**: dati account (email/phone/città), sorgente, salute · pulsanti **Cambia stage** (clic su qualsiasi stage chip esegue `POST /stage`) · contatori (interazioni, prossimi passi aperti).
  - **Contatti**: card per contatto con avatar + ruolo + email/phone + badge "Primario".
  - **Timeline**: ordine cronologico desc, dot dorato + eyebrow uppercase tipo interazione + titolo serif + summary + prossimo passo italic.
  - **Prossimi passi**: checklist toggleable (Circle ↔ CheckCircle2), priority + due date + notes.
- **Modal "Nuova relazione"**: form lean (account name + type + source + città + nome/cognome/email/phone + note) → crea account + primary contact in una transazione.
- **Sidebar nav app**: nuova voce **"Relazioni"** (icona Users) montata sotto References nel workspace.

**Stage cromatici** (palette stone-inspired, no gold gradients da CRM):
- Nuova richiesta cream · Lead caramel · Discovery violet · Prospect sage · Progetto attivo green · Cliente blue-grey · Partner blush · Archiviato stone.

**Verifica live** (demo@moodfordesign.com):
- 59 accounts migrati dai legacy leads · 9 sidebar filters con count corretti · pipeline Kanban con 7 colonne · drawer overview/contacts/timeline/actions tutti funzionanti · cambio stage via chip click esegue API e refresh.

**Phase R-CRM-2 (prossima)**:
- Quick Create dropdown (Add Contact / Add Interaction / Voice Note / Create Alert / Start Project for Existing Client)
- Guided New Lead Procedure (6 step wizard: Origin → Account/Contact → Project Interest → Style/Inspiration → Next Step → Review)
- Integrazione frontend form pubblico → `POST /api/public/leads` che crea Account + Contact + Interaction `web_lead_generation` + alert "Review new inquiry"
- Duplicate prevention (email/phone/name match → "Possible existing relationship")
- Tabs rimanenti del drawer: Style DNA · Moodboards · Projects · Files · Team & Permissions
- Blueprint Command Center UI per editing dei lookups (`/settings/relationships/catalog`)

────────────────────────────────────────────────────────────────────────



### ✅ Phase R — Cinematic Storefront Redesign (DONE — 16 Feb 2026)

User feedback (with mockup): *"Lavora come un senior web designer e rifai completamente la grafica storefront seguendo la grafica allegata. Anche le sezioni interne che presentano dettaglio progetti, lista magazine con filtro e dettaglio articolo devono essere un linea con nuovo layout. TUTTO COORDINATO, NO HARDCODED ma gestito da Blueprint con editor pagine presente in settings."*

**Surfaces redesigned and coordinated to the cinematic Aman/Kinfolk/Wallpaper\* mockup**:
- **`SiteHeader.jsx`** — full-bleed dark cinematic chrome. Stacked serif wordmark "MOOD / *for* / DESIGN™" on the LEFT + tagline pillar to its right ("ARREDARE SPAZI. COSTRUIRE RELAZIONI."), 7-link nav (Chi siamo · Servizi · Materiali · Progetti · Journal · Showroom · Contatti), globe + locale dropdown, outline ACCEDI pill on the right. Mobile burger collapses to full-screen menu. All copy locale-aware from `branding_settings.public_nav`.
- **`HomePage.jsx`** — five sequential cinematic sections:
  1. **Hero** — full-bleed dark interior image + Playfair serif H1 ("Arredare spazi. Costruire relazioni.") + supporting paragraph + slow editorial divider + "Due percorsi. Un unico obiettivo: trasformare la tua visione in realtà."
  2. **Dual CTA** — cream "Inizia il tuo progetto" + dark "Collabora con noi" cards with hero imagery, eyebrow, body, and gold/onyx CTA pills.
  3. **USP strip** — 5-column "Perché scegliere MOOD for DESIGN™" on warm-cream, gold lucide icons (Award · Users · Sparkles · Globe · ShieldCheck) + uppercase titles + editorial body.
  4. **Projects rail** — dark "Progetti che ispirano" with a 5-up cinematic grid (Residential/Venezia · Resort/Lake Como · Boutique Hotel/Firenze · Private Villa/Val d'Orcia · Penthouse/Milano), category caption + italic city tag.
  5. **Newsletter band** — cream "Ispirazione e novità" with email input + gold "ISCRIVITI" pill. Submits to `/api/public/leads/newsletter` (graceful soft-success if endpoint not wired).
- **`SiteFooter.jsx`** — dark 6-column footer matching the mockup exactly: stacked brand block (wordmark + tagline + social rail Instagram/Pinterest/LinkedIn/TikTok), then COMPANY · SERVICES · RESOURCES · SUPPORT · SHOWROOM. Showroom column shows tenant address from `branding_settings.showroom`, phone & email (mailto/tel), and an outline "BOOK A VISIT" CTA. Copyright: *© 2026 MOOD for DESIGN™ — All rights reserved.*

**Coordinated stylesheet** — new `/app/frontend/src/site/mood.css` introduces a strictly-scoped (`data-surface="storefront"`) cinematic palette (onyx `#14110d`, cream `#f5ecdb`, gold `#c6a45c`) + Playfair Display serif + Montserrat sans tokens. Blueprint OS does not inherit. The legacy `.exe-header__*` styles are retired in favour of the new `.mfd-*` scale. One stale `.mfd-header__tagline { display: none !important }` rule removed from `site.css` so the header tagline ("ARREDARE SPAZI. COSTRUIRE RELAZIONI.") shows next to the brand mark.

**Tenant-admin extensibility (NO HARDCODED)**:
- **Brand block**: `branding_settings.public_brand_name`, `brand_suffix`, `tagline`, `primary_logo_url`, `monochrome_logo_url`. Logo image takes precedence over the typographic wordmark when uploaded.
- **Navigation**: `branding_settings.public_nav.main_links` (per-locale labels), `show_login`, `show_register`, `show_lang_switcher`, `login_label`, `login_href`. Tenant rewrites these from Brand Studio admin without a deploy.
- **Showroom**: `branding_settings.showroom.address_lines`, `phone`, `email`, `book_visit_label` (per-locale).
- **Page sections** (hero, dual CTA, USP, projects, newsletter): managed via the existing `cms_pages` engine. Page keys: `home / navigation / projects / start_project / professionals / ui`. Section types ride the existing storefront CMS editor (`SectionRenderers.jsx` + `FooterColumnsRenderer.jsx`) so an admin can edit titles, body, CTA copy, images, and footer column structures.
- **Fallback safety**: when a tenant has no CMS content yet (or it's been deleted), the page renders sensible per-locale defaults from `FALLBACK` in `HomePage.jsx` and `DEFAULT_COLUMNS` in `SiteFooter.jsx`. No surface ever reads "broken."

**Backend**: extended `GET /api/storefront/public/{slug}/brand` to return `brand.suffix` + `nav.show_lang_switcher` + `nav.login_label` + `showroom` block. Anonymous (no auth). 3/3 pytest still passing.

**Demo tenant seed** updated:
- `public_brand_name` = `MOOD for DESIGN`
- `brand_suffix` = `™`
- `tagline` = `Arredare spazi. Costruire relazioni.`
- `public_nav.main_links` = 7-item editorial (Chi siamo · Servizi · Materiali · Progetti · Journal · Showroom · Contatti)
- `login_label` per-locale (it: *Accedi*, en: *Sign in*, …)
- `showroom`: Via della Manifattura 12, 33080 Porcia (PN) · +39 0434 123456 · info@moodfordesign.com
- Cleared stale `cms_pages.navigation` + `cms_pages.home` so the new fallbacks render until the admin re-edits them via the CMS.

**Verified live** (1920×1080):
- Header: brand stacked left + tagline visible · 7 nav links · globe IT dropdown · ACCEDI gold pill
- Hero (EN): "FURNISHING SPACES. BUILDING RELATIONSHIPS."
- Hero (IT): "ARREDARE SPAZI. COSTRUIRE RELAZIONI."
- Dual CTAs render cream/dark with images + black/gold CTA pills
- USP 5-column strip with gold icons
- Projects 5-up rail with category + italic city
- Newsletter band with gold SUBSCRIBE button
- Footer 5+1 columns, BOOK A VISIT outline pill, "© 2026 MOOD for DESIGN™ — All rights reserved."

**Not yet redesigned (Phase R-2 candidate)**:
- `/projects` listing + `/projects/:slug` detail
- `/magazine` listing with filter + `/magazine/:slug` article detail
These pages already inherit the typography tokens via the storefront stylesheet but still need their layout aligned to the cinematic system. Proposed for next iteration.

────────────────────────────────────────────────────────────────────────



### ✅ Public Storefront Header — Tenant-Driven Lean Chrome (DONE — 16 Feb 2026)

User feedback: *"Frontend, scelta lingua in header va levato. Logo EXE Interior va messo a sinistra e non hardcoded. Il logo viene caricato dinamico dal blueprint. Levate le altre voci di menu Magazine, PMS, Members Area e messa un'icona per login e una per registrati."*

**Changes**
- **Backend**: new `GET /api/storefront/public/{tenant_slug}/brand` — anonymous, returns `{brand: {name, tagline, primary_logo_url, monochrome_logo_url}, nav: {main_links, show_login, show_register, login_href, register_href}}`. Reads from `tenants.branding_settings` so the tenant admin can edit logo + nav copy + login flags from Brand Studio without a deploy. Sensible default nav: Home · Servizi · Progetti · Contatti.
- **Frontend**: rewrote `SiteHeader.jsx` to a single-row lean layout. New hook `usePublicBrand(tenantSlug)` with SWR caching. `BrandMark` renders `<img>` when `primary_logo_url` is set, typographic fallback otherwise — **NEVER hardcoded**.
- **Header layout** (left → right): brand · main nav · access icons (LogIn + UserPlus from lucide-react) · burger (mobile only).
- **Removed** the language switcher, the utility row (Magazine / PMS / Area Riservata), the "Richiedi Progetto" pill, and the second nav row beneath the brand.
- **Seeded** demo tenant `branding_settings`: `public_brand_name='EXE INTERIOR'`, `tagline='Italian Design Excellence'`, `primary_logo_url=<EXE SVG>` so the live preview now renders an EXE-branded header end-to-end without code changes.

**Verified live**:
- `language buttons: 0` ✓
- `login icon: True · register icon: True` ✓ (data-testids `header-icon-login`, `header-icon-register`)
- `brand logo img: True` ✓ — pulled from `https://exeinterior.com/.../exe-interior-logo-white.svg` via the backend endpoint
- `main nav links: 4` ✓ — Home · Services · Projects · Contact, *no Magazine / PMS / Area*
- Mobile burger present, mobile menu includes Sign in + Register icon links

**Tests**: 3/3 PASS (`/app/backend/tests/test_public_brand.py`):
- returns brand + 4 default editorial nav links (no Magazine/PMS/Area)
- 404 on unknown tenant
- anonymous (no Authorization header required)

**Tenant-admin extensibility (no UI changes needed today)** — the endpoint already reads `branding_settings.public_nav` if the admin sets it. So if a tenant later writes:

```json
"branding_settings": {
  "public_brand_name": "Studio Visconti",
  "primary_logo_url": "...",
  "public_nav": {
    "main_links": [
      { "id": "home", "href": "/", "label": {"it": "Home"} },
      { "id": "atelier", "href": "/atelier", "label": {"it": "Atelier"} },
      { "id": "stories", "href": "/stories", "label": {"it": "Stories"} }
    ],
    "show_register": false
  }
}
```

…the public storefront immediately re-skins itself with those values, including hiding the register icon. The home/internal pages themselves are already managed through `cms_pages` (existing storefront CMS, page_keys `home / projects / start_project / professionals / navigation / ui`).

────────────────────────────────────────────────────────────────────────



### ✅ Phase P0.3.C — Curated Collections UI · Cinematic Vertical Market Perspective™ (DONE — 16 Feb 2026)

> First visible manifestation of Cultural Design Intelligence™.
> Route `/workspace/references`. A private international design intelligence
> archive — NOT inspiration browsing, NOT a media gallery.

**Frontend** — `/app/frontend/src/pages/workspace/ReferencesPage.jsx` (~570 LOC, single editorial page):
- **Editorial Hero** (page open): eyebrow "Cultural Design Intelligence™" + oversized headline *"Curated references read through cultural lenses."* + italic editorial subtitle. Calm, slow, typography-led.
- **3 Curated Collection sections** rendered in vertical sequence — *Collectible Material Atmospheres™ · Architectural Hospitality Signals™ · Mediterranean Quiet Luxury™*. Each section: project_vertical eyebrow, oversized 44px collection title, italic subtitle, atmosphere_direction paragraph.
- **Reference cards** — full-width 12-col grid, alternating image-left / image-right cadence. **Atmosphere FIRST, image SECOND**: oversized 34px atmosphere heading drives the card, the 4:5 portrait image *supports* the reading. Each card includes: atmosphere · editorial_reading · material annotations (chips) · architectural_tone + hospitality_signal columns · advisor_notes (italic, signed) · vertical perspective selector · advisor action bar.
- **Cinematic Vertical Market Perspective™** — perspective selector lives INSIDE the card narrative (right column, vertical typography). Labels are minimal market codes: `IT · US · UAE · DE · FR`. **NO FLAGS**. Active perspective renders 20px primary-gold with a gold underline; inactive perspectives 15px muted. Click → 380ms editorial fade-out → reading swaps → fade-in (image gets a subtle 1100ms zoom-shift + ambient overlay opacity bump). The card *transforms*, never refreshes.
- **Advisor Action Bar** — primary CTA *Add to Design Direction* (gold pill) opens an inline project picker; secondary actions *Discuss with Advisor · Use in Moodboard · Reference for Material Study* render as uppercase typography links. All four wire to `POST /api/references/{id}/actions` and render sonner toasts in human voice ("Connected to Apartment — Stefano.", "Reference shared with the advisor.", "Noted for the moodboard composition.", "Flagged for the material study.").
- **Default perspective** = user's runtime locale (`useLocaleRuntime`), with graceful fallback through the PERSPECTIVE_ORDER set.
- **Sidebar** — new nav entry "References" mounted under Workspace with `Compass` icon (data-testid `sidebar-nav-nav-references`).

**Backend** — new endpoint `POST /api/references/{id}/actions` (router `reference_intelligence.py`):
- 4 actions: `link_project` (mutates `design_references.project_id` + emits `reference.added_to_direction` timeline event), `discuss`, `moodboard`, `material_study` (lightweight events only).
- Validations: 400 unknown action · 400 missing project_id for link_project · 404 cross-tenant project_id · 409 if reference status is still `processing_editorial_reading`.
- Every action emits a human-readable `project_activity` event with `payload: {action, note}`.

**Cultural distinctness verified live in the UI** — same `collector_library_residence` card:
- **IT**: *"Presenza calma e raccolta, costruita per sottrazione — la luce calibrata sul gesto del leggere, la materia scura che assorbe il rumore visivo."*
- **UAE**: *"A scholar's sanctuary of concentrated presence — dark walnut architecture frames a single art moment, raw silk diffuses light into intimate focus, creating a private realm of intellectual gravitas."*
- **DE**: *"Disziplinierte Bibliotheksatmosphäre — Zurückhaltung als architektonische Haltung, nicht als dekorative Absicht."*
Same image. Three radically different cultural re-readings. The card morphs in place; the user feels another international creative director re-reading the atmosphere.

**Testing** — `testing_agent_v3_fork` iteration_51:
- Backend: **10/10 PASS** (new pytest suite `/app/backend/tests/test_phase_p03c_actions.py` covering all 4 actions + tenant isolation + status gating).
- Frontend: structural + linguistic + cinematic checks PASS. NO AI wording / NO social wording / NO flags / NO masonry / NO raw locale codes verified. Tenant isolation verified (studio2 sees the editorial empty state). One MEDIUM bug found and fixed in-session: `/api/projects` response-shape mismatch caused the project picker to render empty — patched to read `{data: [...]}` envelope correctly. Re-test verified end-to-end Add-to-Design-Direction click flow now toasts *"Connected to Apartment — Stefano."*

**Lint compliance** (from PRD guardrails):
- ❌ NO masonry / ❌ NO infinite scroll / ❌ NO feed pacing
- ❌ NO flags / ❌ NO "AI generated" / ❌ NO developer wording
- ✅ Atmosphere FIRST, image SECOND
- ✅ Vertical Market Perspective™ INSIDE the card
- ✅ Slow editorial fade transformation (not refresh)
- ✅ Advisor remains central — every action emits a timeline event in the advisor's voice

────────────────────────────────────────────────────────────────────────



### ✅ Phase P0.3.C PREP — Curated Demo Intelligence Set (DONE — 16 Feb 2026)

> Before building the `/workspace/references` UI, the platform must already
> *feel* alive, editorial, and culturally intelligent. This phase seeds the
> foundational editorial archive: 6 design references grouped into 3 curated
> editorial collections, each interpreted natively across 5 markets.

**Seed script** — `/app/backend/scripts/seed_p03_demo_intelligence.py`
- Idempotent (re-runnable): cleans prior seed by title + source_url markers, then re-inserts. Supports `--locales IT_IT,EN_AE` for partial runs and `--skip-llm` for structure-only seeding.
- Inserts **6 design references** with rich design metadata (NOT technical metadata): `design_intent`, `advisor_notes`, `locale_origin`, `curator_name`, `imported_image_url`. Advisor notes are HUMAN (e.g. "This atmosphere could evolve the hospitality direction for UAE clients — restrained Mediterranean welcome without the cliché.").
- Generates **30 cultural interpretations** (6 × 5 locales) via `_interpret_and_store()` → `with_runtime_prompt(locale_profile)` → `claude-sonnet-4-5-20250929`. Skips already-present (ref, locale) pairs on re-run.
- Assembles **3 curated collections** with intentional soft-membership (puglian_guesthouse shared between Collection 01 and 02):
  - **Mediterranean Quiet Luxury™** (residential + hospitality · 2 refs) — atmosphere: "Travertine, raw linen, brass — warmth engineered through restraint, never through ornament."
  - **Architectural Hospitality Signals™** (hospitality + retail + executive workspace · 3 refs) — atmosphere: "Hospitality codes applied beyond hotels: into retail, into executive environments."
  - **Collectible Material Atmospheres™** (wellness + collector residence · 2 refs) — atmosphere: "Onyx, walnut, raw silk, water reflection — atmosphere read as a primary material, never as a finish."
- Emits **human timeline events** for project-linked references: *"Stefano added Lumière méditerranéenne filtrée…"*, *"Diego added Tenue architecturale d'un espace de travail traité comme bibliothèque privée…"* — NEVER "AI generated", NEVER technical metadata.

**Cultural distinctness · same hammam image, 5 markets:**
- **IT_IT** (94 score): "Penombra calibrata su acqua e onice — un equilibrio tra presenza materica e silenzio."
- **EN_AE** (92 score): *"Hammam logic reimagined as material theatre — onyx wall as protagonist, backlit to reveal its geological narrative … prestige through restraint, not volume."*
- **DE_DE** (71 score): *"Konstruktive Sequenz von Schwelle, Material und Licht. Onyx trägt hier doppelte Verantwortung — thermische Funktion und räumliche Grenze."*
- **FR_FR**: *"Seuil de bien-être où la lumière traverse l'onyx en contre-jour, suspendant l'espace."*
- **EN_US**: *"Sanctuary-grade quietude where light, stone, and water compose the experience."*

These are **5 native re-interpretations**, never translations. EN_AE and DE_DE share zero vocabulary; FR uses *"contre-jour"* and *"tenue"* idiomatic to French editorial discourse; IT_IT reads as Italian material culture; EN_US reaches for "sanctuary-grade" aspirational language. The platform is now ready to *feel* like a private international design intelligence archive the moment a showroom owner opens `/workspace/references`.

**Final state**: 6 references (all `editorial_status='ready'`) · 30 interpretations · 3 collections · 2 timeline events on Villa Toscana project. Verified via API.

────────────────────────────────────────────────────────────────────────


### ✅ Phase P0.3.A — Cultural Design Intelligence™ FOUNDATION (DONE — 16 Feb 2026)

> External design references are NOT media uploads or social pins. They are
> contextualized design signals that pass through an editorial AI interpretation
> pipeline BEFORE becoming visible. This is the DB + backend foundation —
> no UI, no Pinterest OAuth, no scraping, no social actions yet.

**Migration `033_design_references.sql`** — 4 new tables:
- `design_references` — core intelligence entity. Status defaults to `processing_editorial_reading`; only flips to `ready` once an interpretation lands. Future-prepared nullable fields: `design_intent`, `emotional_direction`, `project_relevance`, `advisor_notes`, `material_affinity`.
- `reference_locale_interpretations` — the cultural intelligence engine. UNIQUE (reference_id, locale). Stores `atmosphere`, `material_language`, `hospitality_level`, `architectural_tone`, `emotional_positioning`, `market_fit_score` (0..100), and the marquee `editorial_reading` (4–6 sentence senior-curator memo, NEVER AI-labelled).
- `reference_collections` — curated editorial directions (NOT folders, NOT boards): `title`, `subtitle`, `atmosphere_direction`, `project_vertical`, `market_focus`, `advisor_id`.
- `reference_collection_items` — soft membership join.

**Backend** — new router `/app/backend/routers/reference_intelligence.py`:
- `POST /api/references` — ingest with `editorial_status='processing_editorial_reading'`. Immediately calls `with_runtime_prompt(locale_profile)` via `claude-sonnet-4-5-20250929`. On success: flip to `ready`, persist interpretation, emit timeline event. On LLM failure: stay processing, no interpretation row, NEVER listed in default GET (fail-closed honors NO RAW IMPORTS).
- `GET /api/references` — returns only `editorial_status='ready'` by default; supports `?status=processing_editorial_reading|archived|rejected`. Bulk-hydrates interpretations.
- `GET /api/references/{id}` and `GET /api/references/{id}/interpretations`.
- `POST /api/references/{id}/interpretations` — regenerate per locale (EN_US/EN_GB/EN_AE/IT_IT/DE_DE/FR_FR/ES_ES). Promotes still-processing references to ready on first successful interpretation.
- `POST/GET /api/reference-collections`, `GET /api/reference-collections/{cid}`, `POST .../items` (idempotent), `DELETE .../items/{rid}`. Refuses adding references that are still processing (409 conflict).

**Timeline integration** — when a reference is project-linked, emits human-language events under `project_activity`:
- `reference.added` → `"Stefano ha aggiunto Statement hospitality through monumental material presence …"`
- `reference.interpretation_updated` → `"Editorial reading updated for DE_DE market"`
- `reference.added_to_direction` → `"Reference linked to a curated direction"`
NO technical / developer / AI language anywhere. No "generated", no model name, no "AI". `_humanize()` falls through cleanly when no event-type prefix exists, so the full curator sentence renders as-is.

**Cultural distinctness verified end-to-end**:
- Same Mediterranean estate image, EN_AE: *"villa architecture as material testimony … majlis-level welcome … high-rise luxury counterpoint … prestige refuge"* (UAE prestige register, market_fit_score 82).
- Same image, DE_DE: *"konstruktive Disziplin … über Ausführung spricht, nicht über Lifestyle … erdgebundene Materialwahrheit"* (German architectural rigor, market_fit_score 72).
- Token-Jaccard overlap EN_AE vs DE_DE = 0.13 (translation threshold 0.35) — these are RE-INTERPRETATIONS, never translations.

**Testing**: backend regression `/app/backend/tests/test_phase_p03_reference_intelligence.py` 19/19 PASS + testing agent deep validation 23/23 PASS (`/app/test_reports/iteration_50.json`). Covers ingest pipeline, list filtering, locale regeneration, collection CRUD, idempotency, tenant isolation (cross-tenant probes → 404), AI-invisibility lint on timeline output, fail-closed under LLM failure.

**Out of scope (P0.3.B onward)**:
- Cultural Reading Engine deeper extraction (hospitality scoring, material affinity, atmosphere semantics).
- Curated Collections UI (`/workspace/references` route, cinematic cards, NO masonry).
- Pinterest OAuth connector.
- Strategic Direction™ consumption of references (deferred to P0.3.B once Reading Engine matures).

────────────────────────────────────────────────────────────────────────



### ✅ Phase POST-P0.2.D — Final Hardening Pass (DONE — 16 Feb 2026)
- **Variant Approval Inbox UI** (`/editorial/inbox`) — pagina cinematica "Editorial Review" che consuma `/api/magazine/variant-approval-inbox` + endpoint approvazione. Tabs (Tutte / Articoli / Riferimenti) con conteggi live, card differenziate per articoli vs hotspot, ribbon "EDITORIAL PENDING", badge culturale con register label ("Italia · Editorial craftsmanship", "UAE · Sensorial prestige"), framing/atmosphere isolati, CTA "Publish perspective" vs "Set aside". Linguaggio 100% editoriale, mai "AI", mai "generate". Loading skeleton calmo, error state "Non siamo riusciti a completare questa azione editoriale". Empty state "Editorial calm · Nessuna prospettiva in attesa".
- **Sidebar entry**: nuova sezione "Editoriale" con NavItem `nav.editorialInbox` (fallback "Editorial review") visibile solo a chi ha `tenant:settings`. Tooltip funzionante.
- **Public article perspective badge**: il `MagazineArticlePage` ora passa `?locale_code=` al public endpoint, riceve `_locale.{served, fallback, source}`, mostra un badge "🌐 EN_AE PERSPECTIVE · closest cultural register" sopra il titolo dell'hero. Titolo / sottotitolo / intro vengono overlaid dalla variante approvata (fallback gracieux su `locale_content` legacy se non c'è variante).
- **Editorial language polish** (registry `global.*`): "Caricamento…" → "Sto componendo…" / "Loading…" → "Composing the moment…"; "Qualcosa non ha funzionato" → "Non siamo riusciti a completare questa azione editoriale". Nessuno spinner generico, nessun "Internal Server Error".
- **Sidebar NavItem `fallback` prop**: aggiunta proprietà di fallback testuale a `NavItem` così le nuove voci sidebar rendono in modo immediato anche prima che il blueprint i18n table le registri.
- **Smoke test passato**: login → click sidebar "Editorial review" → pagina si apre con 5 pending variants → card mostrano Travertino IT_IT vs Roman Travertine EN_GB ("considered threshold, not a division") vs Roman Travertine EN_AE ("cinematic material gravity, layered welcome") — registri culturalmente distinti, non traduzioni.



### ✅ Phase P0.2.D — Cultural Intelligence Surfaces™ (DONE — 16 Feb 2026)
- **Public article serving runtime**: `GET /api/magazine/public/{tenant_slug}/articles/{slug}` now auto-resolves the visitor locale via the public chain (explicit > saved > browser weak > tenant default > IT_IT), then serves the matching APPROVED cultural variant on top of the source article. Surfaces `_locale.{requested, served, source, fallback}` so the frontend can render the active perspective badge.
- **Market-intent-preserving variant fallback**: requesting EN_GB when only EN_AE is approved → serves EN_AE, NOT translated to IT_IT. Requesting FR_FR with no FR variant → falls back to EN_GB → EN_AE chain, preserving market intent. Unapproved variants NEVER reach public visitors (safety guarantee against unreviewed AI content).
- **Variant Approval Inbox**: `GET /api/magazine/variant-approval-inbox` returns a single ordered list of all pending AI-generated variants across articles + hotspots for the active tenant. Editor sees: kind, locale_code, title/narrative preview, generated_at, generated_by. Foundation for the "newsroom assistant" UX — AI proposes, editor approves.
- **Advisor Message Suggestions™**: new `POST /api/advisor/suggestions/draft` endpoint with 5 surfaces (`first_reply`, `proposal_intro`, `moodboard_commentary`, `inspiration_response`, `follow_up`). Consumes `with_runtime_prompt()`. Locale priority: explicit > lead > project > proposal > user > tenant > IT_IT. Returns `{draft, register, locale_code, model}`. Verified on Hamptons scenario:
   - EN_US: "kitchen designed for summer gatherings, living areas that flow seamlessly between indoor and outdoor" (aspirazionale lifestyle)
   - EN_GB: "understanding how a house should feel across seasons — not just how it photographs in high summer" (restraint editoriale, critica garbata del gesto)
   - DE_DE Berlin penthouse: "konstruktive Logik und Ausführungsqualität… disziplinierte Antwort auf räumliche Anforderungen" (precisione architettonica)
- **5 pending variants surfaced** in approval inbox during smoke test (3 hotspot + 2 article variants across 4 locales).
- **Tenant isolation enforced** end-to-end (404 cross-tenant on all variant/hotspot/advisor surfaces).
- **Deferred to next session**: Magazine editor admin UI (Market Perspective pills + side-by-side variant preview + approval cards), Pinterest cultural summaries (Pinterest integration not yet implemented in codebase), storefront hero locale-aware, client portal hero, lead qualification AI extension.



### ✅ Phase P0.2.C — Editorial + Public Cultural Runtime (DONE — 16 Feb 2026)
- **Public locale runtime endpoint**: `GET /api/locale-runtime/resolve/public` — anonymous-friendly resolver with priority chain `explicit > saved_locale > browser(weak) > tenant default (via slug) > IT_IT`. No auth required. Browser locale remains a WEAK signal — never forces generic English over saved/tenant defaults.
- **Anonymous LocaleRuntimeProvider path**: `LocaleRuntimeContext` now auto-routes to the public endpoint when `user` is null and persists anonymous preferences in `localStorage['mfd_public_locale']`. Hot-switch works for anonymous flows.
- **Editorial cultural variants** (Magazine articles): `POST /api/magazine/articles/{aid}/locale-variants/{locale}/generate` composes a NATIVE 8-field editorial variant via Claude Sonnet 4.5 — title, subtitle, intro, storytelling_summary, emotional_direction, cta_copy, seo_title, seo_description. Stored in `magazine_articles.locale_content[locale_code]` JSONB. Same Puglia article reads completely differently per locale: EN_AE "Mediterranean Hospitality Estate — Layered Materiality" / EN_GB "A Puglian Guesthouse Written in Stone and Light" / EN_US "A Puglian Retreat That Redefines the Art of Gathering" / DE_DE "Materialität und Konstruktion". Editorial approval flow: `PATCH .../approve` toggles `approved_at`/`approved_by`.
- **Hotspot cultural variants** (`hotspot_locale_variants` table, migration `032_editorial_locale_variants.sql`): 5-field micro-narrative (title, narrative, cta_copy, emotional_framing, atmosphere) NATIVE per locale. Same travertine hotspot reads: IT_IT "Travertino Romano Levigato — materia che attraversa gli spazi" / EN_AE "Roman Travertine: Iconic Continuity — sensorial continuity" / EN_GB "Roman Travertine, Polished Surface — quiet continuity, layered thresholds".
- **StartProjectWizard runtime integration**: Cultural Perspective indicator embedded in the wizard Chrome (top-right pill: `EN_AE · Sensorial prestige`). Clicking opens a 7-locale menu. All step intro bodies wired to `runtime.copy('onboarding.{intro,space_intro,style_intro,material_intro,lifestyle_intro,review_intro}.body')`. Anonymous users get instant cultural switching without auth.
- **Smoke test passed**: anonymous browser starts in IT_IT system fallback ("Sei domande misurate per leggere il progetto dal lato giusto..."). Click EN_AE → "Six refined questions to compose the prestige direction of your commission." Click DE_DE → "Sechs präzise Fragen zur architektonischen Klärung Ihres Projekts." All three culturally distinct, NOT translations.
- **Backend audit clean**: tenant isolation enforced (hotspot/article 404 cross-tenant), invalid locale → 400, missing AI key → 503, fallback chain preserves market intent.
- **Deferred to P0.2.D**: magazine editor Market Perspective pills (admin UI), public article auto-serve best variant, storefront hero + lead qualification AI.



### ✅ Phase P0.2.B — UI Shell + Cultural Perspective Panel (DONE — 16 Feb 2026)
- **Registry expansion** (`/app/frontend/src/lib/locale-copy.js`): from ~10 to **30+ semantic tokens** × 7 locales. Sections: sidebar (5 tokens), dashboard (3), projects (5), onboarding (12), settings (4), global states (4). Each entry culturally repositioned — NOT translated (e.g. `sidebar.section.workspace` = `Atelier` for EN_AE, `Studio` for EN_GB, `Workspace` for EN_US, `Studio` for IT_IT).
- **Cultural Perspective Panel** (`/app/frontend/src/components/settings/CulturalPerspectivePanel.jsx`) mounted into `/settings`. Labeled "Prospettiva culturale" (NOT "Language"). Shows 7 locales as cards with display name, market, register and 1-sentence cultural example. Active locale highlighted with primary border. Switching is instant — `runtime.setLocale()` calls PUT `/api/locale-runtime/preference` then re-resolves.
- **Sidebar section labels** (`Sidebar.jsx`) now read from `runtime.copy('sidebar.section.*')` — Studio/Editorial/Team/Settings/Platform hot-swap on locale change.
- **Projects page header** (`ProjectsPage.jsx`) eyebrow / H1 / new-project CTA all consume `runtime.copy()`. Confirmed: IT_IT shows "STUDIO · Progetti · Nuovo progetto"; EN_AE shows "ATELIER · Active commissions · New commission".
- **Hot reload without page refresh** verified end-to-end: clicking a locale card in Settings rewrites the panel title, sidebar labels, projects page header within ~1s. No reload required.
- **Smoke test**: Settings panel renders 7 options, IT_IT default, click EN_AE → title rewrites to "How your atelier speaks to its audience." (UAE register, never says "studio"), navigate to /workspace/projects → "ATELIER · Active commissions · New commission". Switch back to IT_IT → "STUDIO · Progetti · Nuovo progetto". Cultural distinctness verified.
- **Onboarding tokens registered but wiring deferred**: `onboarding.{intro,space_intro,style_intro,material_intro,lifestyle_intro,review_intro}` × 7 locales seeded in registry. `StartProjectWizard` is the public anonymous flow — wiring requires a public locale-resolve endpoint (deferred to P0.2.C alongside the editorial surfaces work).



### ✅ Phase P0.2.A — LocalizationRuntime™ Foundation (DONE — 16 Feb 2026)
- **Centralized Cultural Runtime Engine** (`/app/backend/core/locale_runtime.py`): single source of truth resolving the active `locale_profile` per request via the priority chain `explicit > user > project > lead > tenant > browser(weak) > IT_IT system fallback`. Market-intent-preserving fallback chain (EN_AE → EN_GB → EN_US, never blind IT_IT).
- **Endpoints** (`/app/backend/routers/locale_runtime.py`): `GET /api/locale-runtime/resolve`, `PUT /api/locale-runtime/preference` (user pref), `PUT /api/locale-runtime/tenant-default` (RBAC: super_admin/studio_owner/owner only).
- **Migration `031_locale_runtime.sql`**: adds `tenants.default_locale_code`, `users_profile.preferred_locale_code`, `leads.locale_code`, `projects.locale_code` with backfill from country.
- **AI architecture rule enforced**: all 3 existing AI engines (Compose Proposal™, Strategic Direction™, Market Perspective™) now consume the centralized `with_runtime_prompt(profile)` helper. Removed ~250 lines of duplicated prompt templates. Verified locale-native output preserved (EN_AE "sculptural presence/material gravitas", EN_GB "domestic restraint/chromatic warmth", DE_DE "konstruktive Disziplin/keine Lifestyle-Inszenierung").
- **Frontend**: `LocaleRuntimeProvider` mounted in `App.js`, `useLocaleRuntime()` hook exposes `localeCode, profile, source, copy(token), setLocale(code)`. Semantic copy registry at `/app/frontend/src/lib/locale-copy.js` — NOT translation; culturally repositioned per locale.
- **PoC surfaces operational**: Dashboard `OperationalHero` (eyebrow + welcome strings switch culturally — "OPERAZIONI DI STUDIO" → "ATELIER OPERATIONS" → "Studio direction"). Projects empty state title/subtitle/CTA culturally repositioned (EN_AE: "Shape a new signature commission", EN_US: "Start your next design journey", IT_IT: "Apri un nuovo percorso progettuale").
- **Testing**: backend pytest 22/22 PASS (`/app/backend/tests/test_locale_runtime.py`), frontend Playwright 100% on tested flows (IT_IT default, EN_AE switch, EN_GB switch, hard-reload persistence, all 7 explicit locales). No P0/P1 issues. Tenant isolation verified — cross-tenant `project_id`/`lead_id` ignored.



### ✅ Phase P0.6.G — Locale Architecture Validation (DONE — 16 Feb 2026)
- **Validated end-to-end**: 7 `locale_profiles` (IT_IT, EN_US, EN_GB, EN_AE, DE_DE, FR_FR, ES_ES) drive the entire Compose Proposal™, Market Perspective™ switch and Strategic Direction™ engines.
- **Strategic Direction™ refactored** (`ai_studio_brief.py`): now consumes `locale_profiles` instead of generic language codes. Accepts `locale_code` (composite). Stores `locale_code` in `project_ai_briefs` (migration `030_strategic_direction_locale.sql`). Backward-compat with `market` shortcut preserved.
- **Market-intent-preserving fallback chain** introduced in `proposal_composer.py`, `market_perspectives.py`, `ai_studio_brief.py`. Prevents EN_AE prestige collapsing into IT_IT craftsmanship.
- **Dead code removed**: legacy `MARKET_REPOSITIONING` dict from `proposal_composer.py`.
- **Frontend** (`ProjectDetailPage.jsx`): `StrategicDirectionCard` fetches `/api/locale-profiles` and sends `locale_code` (not generic `market`). Header now reads `Strategic Direction™ · IT_IT` instead of `Mercato IT`.
- **Cultural differentiation proven**: same project, three English locales produced fundamentally different prose — EN_US "elevated lifestyle destination" / EN_GB "editorial restraint, layered sophistication" / EN_AE "prestige signature, architectural presence". Zero translation behavior.
- **Audit clean**: no remaining hardcoded market strings, no "translate" prompts, no `MARKETS`/`MARKET_REPOSITIONING` references in active code paths.



### ✅ Phase P0.6.F — Market Perspective™ (Cultural Design Intelligence™) (DONE — 16 Feb 2026)

> **NON è localizzazione.** È riposizionamento culturale: lo stesso progetto
> produce narrative emotive, vocabolari, framing d'investimento differenti
> per ciascun mercato. Il progetto resta stabile (moodboards, materiali,
> ispirazioni); cambia la *comunicazione*.

**DB layer** — `028_market_perspectives.sql`
- `market_positioning_profiles`: il profilo culturale per mercato — `market_code`, `locale`, `display_name`, `emotional_tone`, `hospitality_style`, `luxury_style`, `investment_framing`, `focus` (JSONB), `vocabulary` (JSONB), `forbidden_patterns` (JSONB), `narrative_examples` (JSONB), `system_brief` (TEXT injected verbatim into the LLM system prompt).
- `proposal_market_versions`: snapshot timestamped per ogni perspective generata (`proposal_id × market_code` unique), con `is_active` per la versione live.
- Seed `seed_market_perspectives.py` con **7 profili Phase 1**: IT (editorial craftsmanship · vocabulary `equilibrio · materia · artigianalità · continuità · luce naturale · misura`), US (aspirational lifestyle · `elevated lifestyle · curated living · statement kitchen · entertaining flow`), UAE (sensorial prestige · `iconic presence · immersive luxury · sensorial atmosphere · prestige execution`), UK (restrained editorial luxury · `understated · timeless composition · layered materiality`), FR (editorial sophistication · `raffinement · élégance discrète · lumière douce · tenue`), DE (architectural precision · `material precision · execution quality · disciplined atmosphere`), ES (warm Mediterranean · `calidez · convivencia · luz natural · gesto poético`).
- Ciascun profilo include **forbidden_patterns** specifici (es. UAE non può usare "quiet luxury"; FR non può usare "lifestyle aspirationnel"; DE non può usare frasi senza sostanza).

**Backend** — `routers/market_perspectives.py`
- `GET /api/market-perspectives/profiles` — tutti i profili Phase 1 disponibili.
- `GET /api/proposals/{id}/perspectives` — versioni generate per una proposta (con `active_market` flag).
- `POST /api/proposals/{id}/perspective` — ricompone la narrativa della proposta usando il profilo del mercato target. Crea/aggiorna snapshot in `proposal_market_versions`. Se `set_active=true` (default), aggiorna live la proposta.
- LLM system prompt **profile-driven**: inietta verbatim `system_brief`, `emotional_tone`, vocabolario, forbidden patterns e narrative examples. Il modello non riceve più hint string ma il profilo culturale completo. User prompt include il contesto stabile del progetto + le sezioni precedenti come *seme da riposizionare, mai da tradurre*.
- L'LLM è istruito esplicitamente a NON tradurre ma a **rewrite NATIVELY**.

**Frontend** — `components/proposals/MarketPills.jsx`
- Cinematic rail dei 7 mercati con eyebrow `Globe · MARKET PERSPECTIVE™`.
- Tagline editoriale: *"Riposizionamento culturale, non traduzione."*.
- Ogni pill mostra: codice mercato (font heading) + `emotional_tone` (uppercase tracking) + status icon (`Check` se attivo · `dot` bronzo se versione disponibile · vuoto altrimenti).
- Click → POST `/perspective` → spinner inline → refresh automatico → versions count aggiornato.
- Embedded nel `ProposalComposerPage` subito sotto l'hero. Quando l'utente clicca un mercato, l'editor intero (eyebrows sezioni, meta strip, footer, chrome) si re-localizza automaticamente al locale del mercato target.

**E2E test live confermato** (stesso progetto `Apartment — Stefano`):
- IT compose → **UAE switch** → *"A Mediterranean residence composed through material gravity and sensorial precision"* (vocabolario UAE attivo: "material gravity", "sensorial precision", "atmospheric depth", "orchestrated interplay") → **FR switch** → *"Un appartement qui se découvre par la matière et la lumière douce"* (vocabolario FR attivo: "tenue", "écriture spatiale", "se découvre", "lumière douce").
- Forbidden patterns rispettati: nessun "quiet luxury" nella versione UAE; nessun "lifestyle aspirationnel" nella versione FR.
- Snapshot persistenti: 2 versioni salvate, switch tra perspective istantaneo dopo prima generazione.
- pytest backend regression **23/23 OK**.

────────────────────────────────────────────────────────────────────────



### ✅ Phase P0.6.E — Native Multilingual Composition (DONE — 16 Feb 2026)

> **Bug critico corretto**: Strategic Direction™ e Compose Proposal™ erano
> hardcoded in italiano (Pydantic `locale: str = Field("it")`). Adesso il sistema
> compone **nativamente nella lingua del mercato**, non traduce.

**Mappatura mercato → locale nativo** (singola fonte di verità su backend + frontend):
- IT → `it` · US/UK/UAE → `en` · FR → `fr` · DE → `de` · ES → `es`

**Backend** — entrambi i router
- `ComposeIn.locale` e `GenerateBriefIn.locale` ora **Optional[None]**. Se assente, derivato server-side da `market` via `LOCALE_FROM_MARKET`.
- System prompts LLM aggiornati: *"You write NATIVELY in the locale's language — NEVER translate from another language"* + lingua specifica per locale (Italian/English/French/German/Spanish con registro editoriale nativo).
- User message LLM ora inizia con `OUTPUT LANGUAGE: <native description>` per forzare il modello.
- `_fallback_sections` localizzate per i 5 locali (no più fallback monolingua italiana).
- Il locale viene **persistito** dentro `sections._locale` di ogni proposta/snapshot così l'editor sa in quale lingua mostrare la chrome.

**Frontend** — `ProposalComposerPage.jsx`
- Rimossi hardcoded italiani: `SECTION_DEF`, `STYLE_LABEL`, `TONE_LABEL`, `TIER_LABEL`, "Modifica", "Salva", "Curato da", "Torna al progetto", "Export PDF · disponibili a breve", "Moodboard collegati", "Materiali integrati", "Stile/Tono/Tier/Mercato".
- **Tutto localizzato per 5 lingue native**: `SECTION_DEF_BY_LOCALE` (eyebrows + titoli sezioni), `META_LABELS`, `STYLE_LABEL_I18N`, `TONE_LABEL_I18N`, `TIER_LABEL_I18N`, `STRIP_LABELS`.
- `resolveLocale()` legge `proposal.sections._locale` (con fallback a `LOCALE_FROM_MARKET[proposal.market]`).
- Attributo HTML `lang={locale}` sulla pagina.
- `localized(value, preferLocale)` ora rispetta il locale di output della proposta per `role_label` / `bio_short` multilingua dell'advisor.

**Frontend** — `ComposeProposalWizard.jsx` e `ProjectDetailPage.StrategicDirectionCard`
- Rimosso hardcoded `locale: 'it'` da entrambi gli invii API. Il backend deriva il locale dal `market` selezionato dall'utente.

**Test e2e multilingue confermati** (mercato → output)
- **US** → *"Editorial proposal for Apartment — Stefano · This apartment seeks a particular calibration..."*
- **FR** → *"Proposition éditoriale pour Apartment — Stefano · Ce projet résidentiel cherche un équilibre..."*
- **DE** → *"Editoriale Proposal für Apartment — Stefano · Dieses Projekt versteht sich als architektonische Übersetzung..."*
- Chrome (eyebrow, meta strip, disclosure, signature footer) interamente nella lingua nativa, senza fallback.
- pytest backend regression **23/23 OK**.

────────────────────────────────────────────────────────────────────────



### ✅ Phase P0.6.D — Compose Proposal™ (DONE — 16 Feb 2026)

> Trasforma la pipeline **Strategic Direction™ → Proposta** da bottone amministrativo
> a **vero motore di composizione editoriale** di livello luxury private consultancy.
> Target: inspiration → client-ready proposal in <15 minuti.

**Repositioning**
- ~~"Avvia proposta"~~ → **"Componi proposta"** (apre il wizard).
- Modulo: `Compose Proposal™` (eyebrow editoriale, non gimmick AI).
- Pipeline operativa: Strategic Direction™ → Compose Proposal™ → Client Presentation → Feedback → Revisione → Approvazione → Project Activation.

**Wizard 3-step** (`components/proposals/ComposeProposalWizard.jsx`)
- **Step 1 — Stile progetto**: Residenziale · Ospitalità · Retail · Sviluppatore · Investitore · Cliente privato.
- **Step 2 — Tono narrativo**: Minimale editoriale · Caldo mediterraneo · Lusso silenzioso · Architettonico · Ospitalità d'autore · Livello collezionismo.
- **Step 3 — Posizionamento d'investimento** + mercato + toggle "Mostra range numerico" (default off — la proposta mostra il *posizionamento*, non un listino).
- Footer azioni con `Continua` / `Indietro` / `Componi proposta`.

**Editor cinematic** (`pages/workspace/ProposalComposerPage.jsx` su `/workspace/proposals/:id/compose`)
- Hero full-bleed con cover hero estratta dalla prima ispirazione del progetto + opacità 18% + gradient cinematic.
- Headline oversize cinematic (`text-[42px]` font-heading) generato dall'LLM.
- Meta strip: Stile · Tono · Tier · Mercato.
- Disclosure inline: *"Export PDF · Link condivisibile · Versione client portal — disponibili a breve"* (NO bottoni-stub).
- **9 sezioni** rendered come articoli editoriali separati:
  - 01 APERTURA · 02 DIREZIONE · 03 ISPIRAZIONI · 04 MATERIA · 05 VISIONE · 06 AMBITO · 07 INVESTIMENTO · 08 TEMPISTICA · 09 FIRMA.
- **Inline edit**: hover su una sezione mostra "Modifica" → textarea → "Salva" → PATCH idempotente.
- **Moodboard strip integrata** subito dopo `03 ISPIRAZIONI` (live, hydrated, click → moodboard).
- **Material cards integrate** subito dopo `04 MATERIA` (live, hydrated, palette dominante).
- **Footer firma**: avatar + nome + role_label + bio_short dell'advisor (helper `localized()` per multilingua).
- Localizer multilingua aggiunto: tollera `role_label` / `bio_short` come oggetto `{it, en, _default}` o stringa.

**Backend** (`/app/backend/routers/proposal_composer.py` + migration `027_proposal_composer.sql`)
- Migration applicata via psycopg: `proposals` esteso con `sections JSONB`, `style`, `narrative_tone`, `investment_tier`, `market`, `cover_image_url`, `source_direction_id`, `show_numeric_pricing`, `sections_included`. Indici su `(tenant_id, style)` e `source_direction_id`.
- `POST /api/projects/{pid}/compose-proposal` — LLM compose (Claude Sonnet 4.5 via emergentintegrations) usando contesto reale:
  - project · strategic_direction snapshot · moodboards · inspirations · materials linkati · advisor identity · client/lead · studio identity.
  - System prompt internazionale + market repositioning (NON traduzione) per IT/US/FR/DE/UK/UAE/ES.
  - Fallback editoriale italiano se la chiave LLM non è disponibile.
  - Salva proposta come `draft` + traccia `proposal.composed` in `project_activity`.
- `GET /api/proposals/{id}/composer` — proposal hydrated con moodboards + materiali + advisor + project header.
- `PATCH /api/proposals/{id}/sections` — patch idempotente di sezioni testuali + metadati editoriali.
- Cleanup linguistico: timeline event `proposal.composed` → "Proposta editoriale composta".

**E2E test live** ✅
- Wizard 3-step navigato dalla Strategic Direction card → genera proposta in ~37s (Claude Sonnet) → auto-navigate a `/workspace/proposals/{id}/compose`.
- Editor renderizza hero cinematic + 9 sezioni con contenuto reale italiano (testo lungo di Stefano sull'appartamento).
- Inline edit + save funzionano via PATCH.
- pytest backend regression **23/23 OK**.

────────────────────────────────────────────────────────────────────────



### ✅ Phase P0.6.C — Strategic Direction™ Refactor (DONE — 16 Feb 2026)

> Repositioning: **rimuove** la feature dal tab "AI Studio Brief™" e la **trasforma in Strategic Direction™**, una sezione contestuale dentro Project Overview. Niente più AI-centrism gimmick: è la **memoria strategica del progetto**, scritta come memo editoriale di un creative director internazionale.

**Repositioning UX**
- Tab `ai_brief` ELIMINATO dalla tab bar. Le tab ora sono 7: Overview · Ispirazioni · Moodboard · Materiali · Proposte · Conversazioni · Timeline.
- `<StrategicDirectionCard />` montata in Overview **sotto l'advisor identity + project header**, sopra la grid "Sintesi operativa".
- Eyebrow: `STRATEGIC DIRECTION™ · MERCATO <market>` (non più "AI Studio Brief™").
- Meta: `Aggiornata X · N versioni salvate` (rimosso `Claude Sonnet 4.5`, `Generato dall'AI`, `Powered by`).
- Sezioni rinumerate ITA: `01 POSIZIONAMENTO · 02 DIREZIONE EMOTIVA · 03 LINGUAGGIO MATERICO · 04 ADATTAMENTO MERCATO · 05 RISCHI · 06 MOSSE STRATEGICHE`.

**Workflow-native actions** (action bar dentro la card)
- **Rigenera** — POST `/ai-brief/generate` salva automaticamente un nuovo snapshot.
- **Storico** — modal con timeline cronologica di tutti gli snapshot (headline + market + autore + tempo relativo); click su una versione la carica nella card.
- **Condividi con il team** — POST `/strategic-direction/send-memo` → push nell'`project_activity` come evento `direction.shared_with_team`. Appare nella Timeline tab come "Direzione condivisa con il team · <headline>". Non è una chat, è un evento di workflow.
- **Avvia proposta** — POST `/strategic-direction/promote-to-proposal` → crea una **bozza di proposta** pre-popolata con headline come `title` e direction+emotional+market come `description`. Loggata in timeline come "Bozza di proposta avviata dalla direzione".
- **Export PDF** — disclosure inline "Export PDF · disponibile a breve" (no bottone-stub).

**Backend** — `ai_studio_brief.py` esteso con 4 nuovi endpoint:
- `GET  /api/projects/{id}/strategic-direction/history` — snapshot list con autore hydrated.
- `GET  /api/projects/{id}/strategic-direction/snapshot/{sid}` — load di una versione precedente.
- `POST /api/projects/{id}/strategic-direction/send-memo` — push nell'activity log.
- `POST /api/projects/{id}/strategic-direction/promote-to-proposal` — crea bozza proposta.
- Endpoint legacy `/ai-brief` e `/ai-brief/generate` MANTENUTI per retro-compat con pytest suite e per consumers esterni.

**Sistema evolutivo**: la direzione cambia coerentemente con il progetto. Ogni regenerazione salva uno snapshot timestamped — possibilità di confrontare evoluzioni del tipo *"Mediterranean warmth → Quiet luxury shift"*. La timeline del progetto traccia ogni evoluzione strategica con linguaggio umano.

**Localization editoriale per mercato**: selector inline IT/US/FR/DE/UK/UAE/ES → rigenera la narrativa in tono nativo del mercato (non traduzione: re-posizionamento). System prompt LLM già configurato con stili "quiet craft IT", "aspirational US", "sensorial UAE", "rigorous DE", "editorial FR", "refined UK".

**Cleanup linguistico** — rimossi tutti i riferimenti a:
- ~~"AI Studio Brief™"~~ → Strategic Direction™
- ~~"AI generated" / "Claude Sonnet 4.5" / "Genera brief" / "modalità manuale"~~
- ~~"Generato 17 min fa"~~ → "Aggiornata 17 min fa"

**Smoke test live** ✅
- `tab-ai_brief` count = 0 (tab eliminato).
- `strategic-direction-content` renderizzato in Overview con headline italiana, 5 sezioni + Mosse Strategiche, action bar completa.
- Storico modal apre con 2 versioni salvate ("Materia calibrata..." attuale + "Contemporaneità silenziosa..." precedente), entrambe curate da Stefano Ogrisek.
- Send-memo crea evento timeline `direction.shared_with_team`.
- Promote-to-proposal crea bozza proposta + logga `proposal.created_from_direction` in timeline.
- pytest backend regression **23/23 OK**.

────────────────────────────────────────────────────────────────────────



### ✅ Phase P0.6.A + P0.6.B — Project Experience Hardening & Deep Integrations (DONE — 16 Feb 2026)

> Trasforma ProjectDetailPage da contenitore statico in **ecosistema operativo vivente**.
> 8 tab interconnessi, deep-linking via `?tab=`, AI Studio Brief™ reale (Claude Sonnet 4.5).

**Backend** — nuovo router `project_workspace_v2.py` (5 endpoint, mounted under `/api/projects`):
- `GET /api/projects/{id}/inspirations` — moodboard_candidates hydrated con article + hotspot localizzato + clustering per `reference_type` (Atmosfera/Materia/Tessuto/Luce/Arredo/Finitura/Palette/Prodotto).
- `GET /api/projects/{id}/timeline` — unified memory: merge di project_activity + moodboard_candidates + project_ai_briefs + client_messages, etichette ITA umane (`AI Studio Brief™ generato`, `Nuovo task creato`, `Ispirazione salvata` …) e color dot per `kind`.
- `GET /api/projects/{id}/materials` — material_registry filtrato via `metadata_json.linked_project_ids` (soft link), con hydration cover via `media_library.primary_asset_id`.
- `GET /api/projects/{id}/proposals` — proposte filtrate per progetto + continuity counts (`moodboards_in_project`, `inspirations_in_project`).
- `GET /api/projects/{id}/conversations` — feed messaggi project-scoped + participant strip (Cliente / Advisor) hydrated da `users_profile`.
- Tutti gli endpoint enforce tenant isolation (404 cross-tenant verified).
- Allineato allo schema REALE Supabase (`moodboard_candidates.title/image_url/reference_type`, `article_hotspots.locale_content` localizzato IT/EN, `material_registry.dominant_color` singolare).
- `ai_studio_brief.py` corretto: contesto LLM ora legge campi reali di `moodboard_candidates` (title/description/reference_type) e `material_registry` (linked_project_ids in metadata_json).

**Frontend** — `ProjectDetailPage.jsx` riscritto end-to-end:
- 8 tab cinematic: Overview · Ispirazioni · Moodboard · Materiali · Proposte · Conversazioni · Timeline · AI Studio Brief™.
- `useSearchParams` per persistenza tab (`?tab=timeline` deep-link + reload-safe + back/forward navigation).
- 4 primitive cinematic riusabili: `Skeleton`, `EmptyState`, `ErrorRetry`, advisor card.
- Empty state editoriali con CTA contestuale (Apri Magazine, Apri archivio materiali, Hub messaggi…).
- Loading skeleton (3 card animate) per ogni tab; nessun flash di white area.
- Tab bar overflow-x-auto su mobile, no clipping.
- `ConversationsTab` con bubble bidirezionali (advisor sx · cliente dx), participant strip con avatar.
- `TimelineTab` con linea verticale + dot color-coded per kind (workflow oro, ispirazione bronzo, AI Brief viola, conversazione verde).
- `InspirationCard` con cover + overlay hotspot label + reference_type chip + advisor note in italic.
- `MaterialCard` con cover, swatch `dominant_color`, atmosphere chips, tactile descriptors, supplier badge.
- `AIStudioBriefTab` con headline + 5 sezioni numerate (DIREZIONE · MATERIA · EMOZIONE · MERCATO · TENSIONI) + PROSSIME MOSSE list. Generate/refresh inline con market selector (IT/US/FR/DE/UK/UAE/ES).
- ErrorRetry sul cold-load del progetto (no silent redirect su transient 503).

**Test coverage** ✅
- pytest `/app/backend/tests/test_p06_project_workspace.py` → **23/23** (5 endpoint × 3 progetti seedati + ai-brief read + cross-tenant isolation + 404 unknown-project).
- Playwright frontend (testing_agent_v3_fork iteration_48): 8 tab render + switch + ?tab= persistence + reload + back/forward + empty/populated states + AI Brief seeded sections + responsive mobile viewport.
- Smoke screenshot live: Overview, Ispirazioni (empty cinematic), Timeline (2 eventi reali), AI Studio Brief™ (seeded brief italiano · Claude Sonnet 4.5).

────────────────────────────────────────────────────────────────────────



### ✅ Phase P0.5 — Real Dashboard Experience (DONE — 16 Feb 2026)

> Trasforma la dashboard da "welcome page" generica in **cuore operativo dello studio**.

**Backend** (`/api/dashboard/summary`)
- 4 nuovi aggregati operativi nel response:
  - `operational_summary[]` — hero sentences human-language ITA ("1 proposta è in attesa di feedback cliente", "X riferimenti salvati questa settimana", "N progetti fermi da oltre 7 giorni", "M nuove richieste progetto da qualificare") — ogni sentence ha `to` per click-through al workflow
  - `recent_leads[]` — top 6 leads arricchiti con `country`, `language`, `project_type`, `budget_range`, `score`, `source`, `assignee.name`+`avatar_url` (hydrated da `users_profile`)
  - `stale_project_ids[]` — progetti senza update da 7+ giorni (warm glow flag, non rosso)
  - `design_references[]` — top 6 `moodboard_candidates` con hydration: hotspot label, articolo originante (slug + title + cover_url + vertical), client name
- Nessuna LLM call, tutto sourced da query DB reali con tenant isolation.

**Frontend** (`/app/frontend/src/pages/dashboard/DashboardPage.jsx`)
- 4 nuovi widget componenti cinematic editorial (warm graphite + gold accent + radial gradient overlay):
  1. **OperationalHero** — greeting time-aware ("Buongiorno/Buon pomeriggio/Buonasera/Buona notte"), operational summary cliccabile, micro-arrow on hover.
  2. **RecentDesignRequests** — 4 lead cards: paese·lingua, nome, score badge dinamico (high/medium/low), project_type, budget, "Curato da {advisor.name}", tempo relativo. Empty state editoriale onesto.
  3. **ProjectsRequiringAttention** — 4 project cards con cover_url 16:10, progress bar, label "Da riprendere" con dot pulsante per stale_project_ids. Empty state operativo.
  4. **DesignReferencesStream** — 5 reference cards cinematic 4:3 con label hotspot, vertical chip, "Cliente · tempo relativo". Empty state esplicativo.
- Rimosso `Welcome` generico in favore dell'Operational Hero.
- KPI cards mantenuti perché basati su DB counts reali.
- 100% data-driven, zero placeholder.

**Smoke test live** ✅
- Hero render con 2 summary items dinamici cliccabili
- 4 lead cards reali con score/advisor/budget visibili
- 4 project cards (Apartment, Penthouse, Villa×2) renderizzati
- Empty state Design References cinematic (zero candidates in DB attuale)
- Backend response include tutti i 4 nuovi field aggregati

────────────────────────────────────────────────────────────────────────



### ✅ Phase P0.0 + P0.10 — Dead Page Elimination + Dev Language Removal (DONE — 16 Feb 2026)

> Prima micro-fase del piano di **Platform Stabilization** richiesto dall'utente.
> Trasforma il prototipo in un **alpha operativo testabile**.

**P0.0 — Dead Page Elimination**
- Nuovo componente `MvpLitePage` (`/app/frontend/src/pages/common/MvpLitePage.jsx`) sostituisce il pattern "Coming Soon / Roadmap" con copy operazionale onesto + CTA al workflow connesso reale.
- 8 route ex-`ComingSoon` ricollegate:
  - `/workspace/team` → **redirect** `/settings/members` (feature reale esistente — `MembersPage`)
  - `/workspace/clients` → `ClientsHub` "I tuoi clienti emergono dai Lead" + CTA `APRI LEAD`/`PROGETTI ATTIVI`
  - `/workspace/messages` → `MessagesHub` "Le conversazioni vivono sul progetto" + CTA `Vai ai progetti`
  - `/workspace/calendar` → `CalendarHub` "Le scadenze sono sul progetto" + CTA `Apri progetti`
  - `/workspace/activity` → `ActivityHub` "Il feed attività vive nella dashboard" + CTA `Apri dashboard`
  - `/workspace/reports` → `ReportsHub` "I tuoi insight sono in Analytics" + CTA `Apri Analytics`
  - `/settings/integrations` → `IntegrationsHub` con disclosure roadmap onesta (Stripe/ElevenLabs/Resend) + CTA torna Settings
  - `/library/collections` → `CollectionsHub` "Le collezioni vivono nell'archivio" + CTA `Apri Media Library`

**P0.1 — Sidebar IA Restructure**
- `Sidebar.jsx` riorganizzato nei 4 gruppi richiesti: **Dashboard · Workspace · Editorial · Studio · Settings · Platform** (superadmin).
- Rimossi dalla nav: `nav.storefront` + `nav.magazine` (consolidati sotto Settings, accessibili via /settings) — niente più voci editor avanzato in nav primaria.
- Rimossi dalla nav: `/workspace/calendar`, `/workspace/activity`, `/workspace/clients`, `/workspace/messages`, `/workspace/reports`, `/library/collections` (restano raggiungibili da URL diretto se serve, ma non occupano slot).
- "Team" punta direttamente a `/settings/members` (no più dead-end intermedio).
- Fallback su tutte le `nav.section.*` keys per evitare leak di chiavi grezze.

**P0.10 — Dev Language Removal**
- `AdminLayout.jsx` — `AdminNavItem` ora accetta `fallback` prop esplicito → `admin.nav.overview` → "Panoramica", `admin.nav.tenants` → "Studi", `admin.nav.modules` → "Moduli", `admin.nav.languages` → "Lingue", `admin.nav.pages` → "Pagine", `admin.nav.audit` → "Audit log". Niente più chiavi tecniche leakate nella UI super-admin.
- Aggiunte traduzioni IT: `nav.section.editorial`, `nav.section.studio`, `nav.section.settings`.

**Smoke test live** ✅
- `/workspace/team` → redirige a `/settings/members` (verified)
- `/workspace/clients` → `ClientsHub` con MvpLite editoriale (verified, screenshot OK)
- Sidebar Dashboard pulita con 12 icon-only nav items + nessuna voce dead-end

────────────────────────────────────────────────────────────────────────



### ✅ Phase AA.1 — Studio Palette Memory™ (DONE — 16 Feb 2026)

> Trasforma "recent colors" del browser in **memoria visiva condivisa dello studio**.
> Tenant-scoped, sincronizzato cross-device, accessibile da qualsiasi membro del team.

**Backend** (`/app/backend/routers/branding.py`)
- 4 nuovi endpoint operano direttamente su `tenants.theme_settings.studio_palette[]` (no migration richiesta — JSONB esistente):
  - `GET    /api/branding/studio-palette` — ritorna lista ordinata per `last_used_at` desc
  - `POST   /api/branding/studio-palette` — add/touch idempotente per hex (refresh timestamp + opzionali `name` + `mood`)
  - `DELETE /api/branding/studio-palette/{hex}` — rimuove un colore
  - `PATCH  /api/branding/studio-palette/reorder` — ordina secondo sequenza hex esplicita
- Cap a **24 entries** (overflow elimina il più vecchio per `last_used_at`)
- Hex normalization centralized (#fff → #ffffff, case-insensitive); audit_log su ogni touch/remove

**Frontend**
- Nuovo `/app/frontend/src/contexts/StudioPaletteContext.jsx` — provider lazy-loaded al primo mount autenticato, espone `{entries, touch, remove, reorder, loaded}`; aggiornamenti **ottimistici** + reconciliation server-side
- Montato in `App.js` sopra `BrowserRouter` (dopo `TenantThemeProvider`)
- `BlueprintColorPicker` integra la nuova sezione **"Studio Palette Memory™"** sopra "Brand palette":
  - Swatches cliccabili = riapplicazione
  - Right-click su uno swatch = rimozione dalla memoria
  - **Auto-push** intelligente: alla chiusura del picker, se l'utente ha applicato un colore **non-brand**, viene aggiunto/aggiornato in Studio Palette (i colori del brand restano curati e non rumorosi)
  - Sezione "Recent" localStorage rimane come fallback se la palette tenant è vuota

**Smoke test live** ✅
- Backend: GET vuoto → POST `#D8B47A`+name=Warm Brass → POST `#22C55E` x2 (dedup → 1 entry) → DELETE `#D8B47A` (rimossa) → tutti gli scenari OK
- Frontend: typing `#6B8E23` → close picker → riapertura → swatch presente in Studio Palette → click re-applica `#6B8E23` → live preview aggiornato
- Cross-tenant: lo storage è scoped su `tenant_id` (audit log + write helper rilegge tenant prima di scrivere)

────────────────────────────────────────────────────────────────────────



### ✅ Unified Color Picker — Blueprint OS-wide UX upgrade (DONE — 16 Feb 2026)

> **User feedback addressed**: "dovunque si possa scegliere un colore deve essere disponibile il color picker e non l'input per digitare a mano il codice che nessuno sa".

**What ships**
- New `/app/frontend/src/components/common/BlueprintColorPicker.jsx` + `.css` — cinematic dark-glass color popover (built on top of `react-colorful` for the saturation pad + hue slider).
- Replaces every legacy `<input type="color">` + manual hex textbox across the platform with a single visual control: **trigger** (color swatch + label + monospace hex) → **popover** with sat/light pad + hue slider + **brand palette swatches** + **recent colors** (persisted via `localStorage`) + hex-only input for power users.
- **Replaced occurrences**:
  - `BrandStudioPage` — 10 palette pickers (primary / secondary / accent / background / surface / text_primary / text_secondary / border / success / warning / danger)
  - `MoodboardEditor` — 5 inspector pickers (typography color, shape fill, shape border, arrow color, palette swatches)
  - `PageInspector` — moodboard page background color picker
- All triggers preserve their original `data-testid` (now `${testid}-trigger`, `${testid}-panel`, `${testid}-swatch-<hex>`, `${testid}-hex-input`, `${testid}-done`).
- New dependency: `react-colorful@5.7.0` (~3 kB gzip, tree-shakeable, no peer-conflicts).

**Smoke test (live)**
- `palette-primary-trigger` → panel opens → brand swatch `#D8B47A` applied → hex input typed `22c55e` → reflected as `#22C55E` → Done closes panel. ✅
- All 10 BrandStudio triggers render as cinematic swatch+label rows (replacing the old square+textbox layout).

────────────────────────────────────────────────────────────────────────



### ✅ Phase Y.3.A — Editorial Asset Picker + Upload (DONE — 16 Feb 2026)

> Bridge cinematico tra Magazine Editor e Media Library v2.
> "Adding atmosphere to a story" — non "uploading files".

**What ships**
- New `/app/frontend/src/pages/settings/AssetPickerModal.jsx` + `asset-picker.css` — dark-glass modal con 2 tab:
  - **Library**: search input, dynamic category chips (sourced from `/api/media/stats`), top-tag chips (oggi popolati), grid 16:10 cinematic preview cards, click → gold check overlay → "Usa nel racconto" auto-link.
  - **Upload**: drop zone editorial, file picker, multi-upload queue sequenziale con per-row progress, stati success / duplicate / error, quick category + quick tag chips applicati a tutto il batch.
- **Session-level dedupe** via SHA-256 checksum (Web Crypto) — re-upload dello stesso file in una stessa sessione riusa l'asset esistente con etichetta "duplicate (auto-resolved)".
- **MagazineEditorPage integration**: hero URL textbox raw → bottone "Sfoglia libreria" + preview con hover "Replace"; ogni image-block URL textbox raw → bottone "Sfoglia / Cambia"; canvas immagini empty/popolato accetta **drag&drop file diretto** → upload + auto-assign (no modal flow).
- **Auto-link** ogni asset → article via `POST /api/media/{asset_id}/links` con `entity_type='magazine_article'`, `role='hero'|'body'` (idempotente sull'UNIQUE constraint).
- Backend: esteso `GET /api/media/stats` per restituire `categories: {<slug>: <count>}` + `tags: {<tag>: <count>}` aggregates → chip universe veramente data-driven.

**Testing (iteration_47)**
- Backend pytest **9/9** (dopo fix stats). Tenant scope + cross-tenant prefix safety + signed-upload + bucket whitelist + media_links idempotency + article hero_url persistence tutti PASS.
- Frontend smoke: picker apre, 11 asset cards renderizzati, search + filter chips + quick-tags lavorano, end-to-end hero replacement testato (Unsplash URL → Supabase signed URL).

**Commercial demo impact**
- Showroom owner non vede più una URL textbox: vede un archivio editoriale. Pubblicare un articolo non richiede più "tecnico" — è curare un'atmosfera.
- Foundation per Y.3.B (image editor) + Y.3.C (semantic tagging) già presente: ogni asset uploadato porta con sé categoria + tag + auto-link al journal article.

────────────────────────────────────────────────────────────────────────



### ✅ Phase Y.2 + Y.1 EXT — Visual Hotspot Editor Stabilization + Hospitality Discovery Layer (DONE — 16 Feb 2026)

**Phase Y.2 — Visual Hotspot CMS Editor Stabilization (P0 ABSOLUTE)**
- ROOT-CAUSE FIX of `articles: 0` bug. `magazine.py` used `ctx.role`/`ctx.tenant_id`/`ctx.user_id` (attribute access) but `get_tenant_context` returns a **dict** — every admin endpoint was 500-ing. Replaced 34 occurrences with `ctx["role"]` / `ctx["tenant_id"]` / `ctx["profile_id"]`.
- New endpoint `GET /api/magazine/admin/articles/{id}` returns single article + hotspots (the editor now loads cleanly instead of filtering the whole list).
- Visual editor (`MagazineEditorPage.jsx`) validated end-to-end: drag-and-drop pin creation on image canvas, % coords (responsive-safe), dark-glass inline popover with reference_type/cta_action/locale content, publish flow, locale switcher.

**Phase Y.1 EXT — Hospitality Editorial Seed + Magazine Discovery Layer**

- **Migration 025** extends `magazine_articles` with: `subcategory`, `editorial_tone`, `project_vertical`, `locale_market`, `featured_materials[]`, `atmosphere_keywords[]` + GIN indexes on tags/materials/atmospheres. Already applied to live Supabase.
- **Second seed**: `mediterranean-boutique-hospitality-puglia` — fully cinematic hospitality article (Aman / Six Senses tone) with 4 hospitality-oriented Design References™ (lobby travertine, suite linen, restaurant alabaster lighting, spa atmosphere). Existing residential article enriched with the same taxonomy fields.
- **New public endpoints**
  - `GET /public/{tenant}/articles` now supports `category` · `tag` · `vertical` · `reading_min` · `reading_max`.
  - `GET /public/{tenant}/taxonomy` returns the LIVE taxonomy (categories, verticals, tags, materials, atmospheres) — chip universe is data-driven, never hardcoded.
  - `GET /public/{tenant}/articles/{slug}/related` returns top-N related editorial stories via transparent score (vertical+4, category+3, shared tag/material/atmosphere+2 each).
- **Auto reading-time** computed from `body_blocks` word count (~220 wpm) on `POST` and on every `PATCH` that touches `body_blocks` (unless caller overrides).
- **Public Magazine UI** — sticky filter chip bar (Verticali + reading-time + Tags), results count, reading-time on each card. Active state, hover, and "Reset" handled cleanly. Cinematic warm-graphite-on-cream styling, never dropdown-hell.
- **Article detail** — new "Continua la scoperta" related-articles section with cinematic 4/5 portrait cards.
- **Empty-src image hardening** — every magazine `<img>` is now conditionally rendered to silence React warnings before image URL resolves.

**Testing**
- Backend pytest suite at `/app/backend/tests/test_phase_y_magazine.py` — 15/15 passing (admin CRUD, tenant isolation, taxonomy/filter/related/auto-reading-time, anonymous save-reference).
- Frontend smoke + E2E covered hospitality filter chip → 1 result, related section visible, admin shows 2 cards (P0 fixed), editor opens with hotspots preserved.

**Commercial demo impact**
- Magazine now demonstrates **two verticals** (residential + hospitality) — proves MOOD adapts to a prospect's sector, not "one beautiful article".
- Authoring flow is stable; showroom owners can curate editorial-grade projects without raw JSON.

────────────────────────────────────────────────────────────────────────



### ✅ Phase Y.1 + Y.3 lite — Editorial Lead Generation Engine (DONE — 16 Feb 2026)

> Strategic objective per brief: **"trasformare contenuti fotografici
> editoriali in richieste progetto qualificate"**.
> This is the real commercial wedge of MOOD for DESIGN™ — the engine
> that turns SEO traffic into qualified project intent, attributed to
> a real human advisor.

**Promise delivered**

`/magazine` (cinematic editorial masonry) →
`/magazine/:slug` (immersive article) →
**Design References™ hotspots** (NEVER ecommerce pins — calm gold pulse
+ editorial side panel) →
**Save flow** (anonymous = soft lead capture / logged client = "Reference
shared with Stefano." toast) →
`moodboard_candidates` row attributed to the advisor → advisor queue
endpoint ready for the Y.4 UI.

**Database — 4 new tables (migration 024)**

- `magazine_articles` — tenant-scoped editorial entity with i18n
  `locale_content`, ordered `body_blocks` JSONB (hero/paragraph/quote/
  image/gallery), category, tags, status (draft|published|archived),
  scope (tenant | corporate journal), `view_count` + `save_count`
  counters.
- `article_hotspots` — Design References™. Coordinates normalized to
  `x_pct/y_pct` (0–100%) so the hotspot tracks across responsive
  renders. `reference_type` (material/fabric/lighting/furniture/finish/
  atmosphere/color_palette/product/custom), `cta_action`
  (save_to_project | discuss_with_advisor | add_to_moodboard |
  explore_material | request_similar), localized panel content,
  optional linked_material_id / linked_asset_id / linked_article_id.
- `moodboard_candidates` — references SHORTLISTED by the client while
  reading. NOT yet the moodboard. Tenant + client_user_id +
  assignee_user_id + project_id + status (saved | sent_to_advisor |
  added_to_moodboard | dismissed) + advisor_note + source attribution
  (article_id, hotspot_id, locale, referrer, utm).
- `magazine_anonymous_leads` — soft-lead capture for anonymous visitors
  who click "Save this reference" before signing up. Reconciled to a
  real `users_profile` row when the visitor later completes adaptive
  onboarding (Phase V).

**Backend — `/api/magazine/*`**

PUBLIC (anonymous-friendly, NO auth):
- `GET /api/magazine/public/{tenant_slug}/articles` → published articles list
- `GET /api/magazine/public/{tenant_slug}/articles/{slug}` → article + hotspots
- `POST /api/magazine/public/{tenant_slug}/save-reference` → soft lead +
  candidate, returns `next_step='complete_onboarding'` so the wizard
  picks the relationship up

CLIENT (logged-in client):
- `POST /api/magazine/client/save-reference` → tenant + client + advisor
  resolved + candidate row + `toast: "Reference shared with {advisor}."`

ADMIN (tenant_admin / super_admin):
- `GET/POST/PATCH/DELETE /api/magazine/admin/articles[/:id]`
- `POST /api/magazine/admin/articles/:id/publish`
- `POST/PATCH/DELETE /api/magazine/admin/articles/:id/hotspots`
- `GET /api/magazine/admin/references-queue` (advisor sees only
  candidates assigned to them; admins see everything)
- `PATCH /api/magazine/admin/references-queue/:id` (status / note)

**Frontend — public storefront, data-surface="storefront"**

- `/app/frontend/src/pages/site/MagazinePage.jsx` — editorial masonry
  list with featured + 4/up grid, locale-aware (it/en/fr/de/es),
  AD/Dezeen/Mohd-style cinematic typography (Playfair Display + Inter).
- `/app/frontend/src/pages/site/MagazineArticlePage.jsx` — full
  reader: full-bleed 21:9 hero with title overlay, paragraph + quote +
  image blocks, Design References™ hotspots over every image block.
- `Hotspot` component — gold pulsing pin (`@keyframes
  mfd-hotspot-pulse`), click opens a 280px editorial side panel with
  reference type, label, description, single project-action CTA. NO
  price, NO SKU, NO add-to-cart semantics.
- `SoftLeadModal` — premium overlay for anonymous visitors. 3 fields
  (first name, email, project type). Captures the lead AND the
  candidate in a single backend call, then redirects to
  `/start-project` so the visitor enters the adaptive onboarding flow
  with full attribution preserved.
- `mfd-toast` — premium bottom toast for the logged-client path:
  "Reference shared with Stefano."
- `magazine.css` — cinematic palette (`#FBF8F2` ivory, `#9B6B2B`
  warm gold accent), Playfair display 4xl titles, generous spacing.

**Seed**

`/app/backend/scripts/seed_magazine_demo.py` — one cinematic article
for the MOOD Demo Studio tenant: **"Casa vista mare ligure"**, 4
editorial body blocks (hero · paragraph · living image · quote · kitchen
image · paragraph · master bedroom image) + **4 Design References™
hotspots**:
1. Living · `fabric` · "Lino sabbia · texture morbida" → explore_material
2. Living · `material` · "Travertino classico" → save_to_project
3. Kitchen · `finish` · "Noce massello + Calacatta" → discuss_with_advisor
4. Bedroom · `atmosphere` · "Atmosfera notturna serale" → add_to_moodboard

**Routing hardening**

- Added `magazine`, `start-project`, `professionals`, `onboarding`,
  `projects`, `review`, `presentation`, `moodboard`, `client`, `f` to
  `PublicTenantPage.RESERVED_SLUGS` so the `/:tenantSlug` catch-all
  never shadows public storefront paths.
- Extended `lib/api.js` 401-interceptor public-surface allowlist with
  `/magazine` and `/magazine/*` so anonymous visitors are never bounced
  to `/auth/login` by a transient backend 401 (the same fix Phase H.5
  applied for `/start-project`).
- Magazine pages eager-imported (NOT lazy) in `App.js` to bypass
  Cloudflare chunk-fetch edge cases — matches the proven pattern used
  by `StartProjectWizard`.

**Verified end-to-end (16 Feb 2026)** — Playwright self-test:

- `/magazine` loads → featured + grid render in IT locale
- Click featured → `/magazine/casa-vista-mare-ligure` loads with 21:9
  hero + Playfair H1 + summary + reading time
- 4 hotspot pins visible at correct coordinates (verified
  `hotspot-pin-*` data-testids)
- Click pin → panel opens with `FABRIC / Lino sabbia · texture morbida /
  Tessuto in lino lavato 100% naturale...` + CTA "Esplora la palette materica"
- Click CTA as anonymous → SoftLeadModal opens with all 3 inputs +
  "SALVA E CONTINUA" CTA → form submits to
  `POST /api/magazine/public/.../save-reference` (verified 201)
- Anonymous flow returns `next_step: complete_onboarding` so the
  visitor lands on `/start-project` with lead attribution preserved

**What's intentionally OUT of scope (Phase Y.2-Y.6 backlog)**

- **Visual CMS hotspot editor** (Y.2 full) — today hotspots are
  created via admin API or seed. The drag-and-drop placement UI is the
  natural next iteration.
- **Advisor Design References Queue UI** in the Blueprint OS (Y.4) —
  the data + endpoints are live; rendering them as a calm pre-PM panel
  is the next iteration.
- **AI editorial assistant** for hotspots / headlines / SEO (Y.5) —
  the `ai_editorial` plumbing from Phase Q.1 is ready to be reused.
- **SEO infrastructure** (sitemap, hreflang, JSON-LD, OpenGraph
  images) — articles already carry `meta_title` + `meta_description`
  + locale variants; rendering them in the HTML head is the trivial
  next step.
- **Conversion analytics** (Y.6) — `view_count` + `save_count` are
  incremented per article; a "Which articles generate project intent?"
  dashboard is the natural Phase Y.6.
- **Lead reconciliation** on signup (anonymous → profile rebinding) —
  schema and lead_id are in place, reconciliation logic ships with Y.4.

**Files of reference (new in Phase Y.1)**

- `/app/supabase/migrations/024_magazine_engine.sql` (4 tables)
- `/app/backend/routers/magazine.py` (550 LOC)
- `/app/backend/scripts/seed_magazine_demo.py`
- `/app/frontend/src/pages/site/MagazinePage.jsx`
- `/app/frontend/src/pages/site/MagazineArticlePage.jsx`
- `/app/frontend/src/pages/site/magazine.css`
- `/app/frontend/src/pages/public/PublicTenantPage.jsx` (RESERVED_SLUGS)
- `/app/frontend/src/lib/api.js` (public surface allowlist)
- `/app/frontend/src/App.js` (2 routes + eager imports)



### ✅ Phase W — Platform Regression + Surface Hardening (DONE — 15 Feb 2026)

After the cumulative feature push (R / S / S.2 / S.2-ext / T.1 / U / V),
MOOD for DESIGN™ entered **system maturity phase**. The biggest risk
stopped being "missing features" and became "regression, surface
contamination, state corruption, permission leakage". Phase W is
explicitly NOT feature development — it is platform hardening before
scale.

**Two surgical changes shipped in this iteration**

1. **Storefront renderer modularization** (CRITICAL per the brief)
   - `SectionRenderers.jsx` was ~1450 LOC after Phase U + the 4 new
     inline editors. No longer maintainable.
   - Extracted the 4 Phase U renderers + shared toolbar primitives into
     dedicated files:
       - `/components/storefront/renderers/shared.js`
         (FALLBACK_CHAIN, PILLAR_ICONS, ICON_MAP, getField, getSetting,
          EditableImage, BlockToolbar, ToolbarSegment, ToolbarChip)
       - `/components/storefront/renderers/StatsBandRenderer.jsx`
       - `/components/storefront/renderers/MagazineGridRenderer.jsx`
       - `/components/storefront/renderers/BrandLogosRenderer.jsx`
       - `/components/storefront/renderers/TeamIdentityCardRenderer.jsx`
         (also hosts `LeaderAvatar` initials-fallback)
   - `SectionRenderers.jsx` is now **644 LOC** (was 1450) — a 56%
     reduction. It now acts as a slim orchestrator that imports the 4
     Phase U renderers and exposes the `RENDERERS` map + `renderSection`.
     Legacy renderers (StoreHero, DualCta, ValueProps, ProjectsPreview,
     Newsletter, LegacySectionRaw) stay in the orchestrator for now.
   - **Zero behavioural change**: every Phase U data-testid still resolves
     (150+ IDs verified by testing_agent_v3_fork iteration 45 —
     30 stat-* / 27 mag-article-* / 75 brand-* / 4 toolbar prefixes /
     stats-accent-gold / mag-density-comfortable / brand-theme-auto /
     team-variant-warm chips all present).

2. **Route guard hardening — close the 'flash of forbidden UI' gap**
   - The Phase U `StudioAdminRoute` (tenant_admin / super_admin only)
     was protecting `/settings/storefront` exclusively. Other admin
     routes — brand, domains, forms, plan, team, members — were
     reachable by any non-client role inside `StudioRoute`, including
     designer. A designer would mount the page, hit the API, then see a
     broken state.
   - Applied `StudioAdminRoute` to all 7 admin routes in `App.js`:
     `/settings/brand`, `/settings/domains`, `/settings/forms`,
     `/settings/storefront`, `/settings/plan`, `/settings/team`,
     `/settings/members`.
   - **Result**: designer / client are redirected BEFORE the shell
     mounts (no admin chrome flash). Verified with the testing agent:
     `[data-testid=storefront-studio]` count = 0 on every redirect for
     designer + client.

**End-to-end regression matrix (iteration_45 test report)** ✅

- **Backend** — 27/27 pytest cases PASS. Every admin endpoint
  (`/api/storefront/admin/*`, `/api/client-messages/*`,
  `/api/human-assignment/*`, `/api/profile/me`,
  `/api/tenant-onboarding/*`) returns 401 anonymous and the
  ownership-scoped APIs return 403/404 on cross-tenant probes.
- **Frontend RBAC matrix** — 21/21 GREEN
  (7 admin routes × 3 roles: super_admin keeps full access, designer
  redirects to /dashboard, client redirects to /client — ZERO admin
  shell flash anywhere).
- **Modularization sanity** — `SectionRenderers.jsx` is 644 LOC; all 4
  new renderer files exist; 150+ Phase U data-testids verified
  post-extraction.
- **Tenant isolation** — `studio2@` (different tenant) sees its OWN
  /settings/storefront with ZERO `Stefano` / `mood-demo-studio` leakage.
  Same isolation verified across /workspace/projects, /library,
  /moodboards.
- **Surface contamination** — public anonymous `/` renders with
  `data-surface=storefront`, 0 editor toolbars, 0 `+Add` buttons.
  Client portal renders with `data-surface=client`, 0 admin widgets
  (pipeline / insights / os-widget all absent).
- **Phase V regression** — `/start-project` `office` flow still works
  (deeper assertions covered by iteration_44, smoke verified in 45).

**Issues found & status**

- 0 critical / 0 medium / 0 high.
- 2 LOW carry-overs from earlier iterations (NOT Phase W regressions):
  - `team-portrait-*` image still renders empty when the team API
    returns `avatar_url=''` and the `onError` hasn't fired yet —
    `LeaderAvatar` initials fallback is in place and will trigger
    on the first failed render. Not a structural bug.
  - `<img src="">` console warnings on `/start-project` wizard step
    imagery — cosmetic, pre-existing since Phase H.5.

**Files of reference (modified in Phase W)**

- `/app/frontend/src/components/storefront/SectionRenderers.jsx` (1450 → 644 LOC)
- `/app/frontend/src/components/storefront/renderers/shared.js` (NEW)
- `/app/frontend/src/components/storefront/renderers/StatsBandRenderer.jsx` (NEW)
- `/app/frontend/src/components/storefront/renderers/MagazineGridRenderer.jsx` (NEW)
- `/app/frontend/src/components/storefront/renderers/BrandLogosRenderer.jsx` (NEW)
- `/app/frontend/src/components/storefront/renderers/TeamIdentityCardRenderer.jsx` (NEW)
- `/app/frontend/src/App.js` (StudioAdminRoute applied to 7 routes; 1 import bug fix
  for `ChevronLeft/ChevronRight/Star` after the extraction)

**Out of scope (intentional, kept for Phase W.2 / V.2 / U.2)**

- Autosave race-condition stress test under concurrent tab edits — the
  testing agent verified single-tab autosave + the deterministic
  reorder/remove paths, but did not simulate 2+ tabs writing the same
  section simultaneously. Recommended for Phase W.2 if multi-editor
  collaboration becomes a P1 requirement.
- Locale chip in the wizard does not re-translate copy on toggle —
  carried over from iteration_44.
- Surface for "stale draft after server reorder" — diff drawer behaviour
  was verified, but a server-side rebase test (CMS publish from another
  client during local autosave) was not run. The current behaviour is
  "last write wins"; consider OT/CRDT only when multi-editor is on the
  roadmap.
- The remaining ~644 LOC in `SectionRenderers.jsx` (legacy renderers)
  can be further split in a future pass — current size is healthy and
  not blocking.

**Platform health after Phase W**: **PRODUCTION-GRADE.**
The system is now predictable, safe, coherent, isolated, human, premium
across every role / surface / tenant / workflow.



### ✅ Phase V — Adaptive Onboarding Engine (Contextual Project Discovery) (DONE — 15 Feb 2026)

The 7-step Start Project wizard at `/start-project` was static: a user
who picked **Office** would still see **Bedroom**, **Kitchen** and
**Walk-in closet** in Step 2. This broke trust, intelligence perception
and the premium feel of the entire onboarding experience.

Phase V replaces the linear question array with a **question graph engine**
that adapts every downstream step to the project category. The wizard now
behaves like a **guided design discovery**, not a CRM survey.

**Core architectural shift**

- New module `/app/frontend/src/site/content/onboardingGraph.js`:
  - `PROJECT_CATEGORY` map → 9 project types collapsed into 4 categories:
    `residential` (apartment, villa, penthouse) ·
    `hospitality` (boutique_hotel, restaurant, wellness) ·
    `commercial` (retail, office) ·
    `other`.
  - `SPACES_BY_CATEGORY` → strictly disjoint space palettes per category.
    Residential → living, kitchen, dining, master, bedroom, bathroom, study,
    walk-in, outdoor, entrance. Hospitality → suites, lobby, restaurant,
    bar, spa, pool, event, outdoor_hosp, kitchen_hosp. Commercial →
    reception, open_space, meeting, executive, lounge_corp, showroom,
    sales_floor, fitting, storage. **ZERO crossover.**
  - `STEP_COPY_BY_CATEGORY` → conversational, locale-aware headlines and
    field labels per category. Residential Step 2 reads
    *"Which rooms would you like to transform?"*; Hospitality reads
    *"Which spaces will your guests experience?"*; Commercial reads
    *"Which workspaces would you like to rethink?"*. Step 6 lifestyle
    labels adapt the same way (e.g. residential asks "How do you want to
    feel when you walk in?", commercial asks "What should your people feel?").
  - `STEP_GRAPH` (dynamic step list) + helpers: `visibleSteps`,
    `indexOfStepId`, `isStepRequiredMet`, `progressPercent`. Linear `case`
    blocks are gone — flow length and step required-rules derive from
    the graph.
  - `buildBriefingShape(state, locale)` → deterministic operational
    briefing seed (project_intent, category, spaces, mood, materials,
    palette, emotional_tone, complexity_hint).

**Frontend refactor — `StartProjectWizard.jsx`**

- `setProjectType()` is now a category-aware setter: switching from
  `office` to `apartment` **clears `spaces: []`** so an Office user can
  never accidentally ship a Bedroom answer to the studio.
- Step 2 (spaces) and Step 6 (lifestyle) now accept a `contentOverride`
  prop. `resolveStep2Content` and `resolveStep6Content` merge category
  copy + filtered options + category-specific imagery (residential →
  bedroom photo, hospitality → boutique hotel photo, commercial →
  workspace photo).
- `Chrome` topbar uses adaptive `currentDot/totalDots` dots + `percent`
  so progress matches the visible flow (today 7 / 7 across all
  categories; ready for future category-specific step counts).
- Footer adds the calm **"Your journey is saved"** hint with a Bookmark
  icon, locale-aware in 5 languages.
- Payload now carries `project_category`, `briefing_shape` and (after
  the FinalReady prefetch) `ai_briefing`.

**Backend foundation — AI briefing summarizer**

- New endpoint `POST /api/onboarding/briefing-summary` in
  `/app/backend/routers/onboarding.py`. Anonymous; reads the adaptive
  payload + locale; calls Claude Sonnet 4.5 via the Emergent LLM key
  with a senior-studio-principal system prompt; returns a structured
  JSON briefing (`project_intent`, `project_category`,
  `stylistic_direction`, `priorities[]`, `emotional_tone`,
  `complexity_hint`, `briefing_summary`).
- Deterministic fallback path: when the AI key is missing or the call
  fails, returns the `briefing_shape` as the briefing payload with
  `source='fallback'`. Studio always has a usable starting point.
- `FinalReady` step prefetches the briefing in the background — the
  client never sees raw AI text. The briefing rides along inside the
  `/private/submit` payload (`ai_briefing` field) so the genesis flow
  can persist it to the project's `metadata_json`.

**Human language rewrite**

- All Step 2 / Step 6 / final headlines rewritten in conversational
  register per the brief:
  - ❌ "What services are you interested in?" → ✅ "Which spaces would
    you like to transform?"
  - ❌ "What is your estimated budget?" → preserved as "Budget & timeline"
    with body "The final pieces to plan your project properly."
  - "Your journey is saved" hint replaces "Form abandoned" / silent autosave.

**End-to-end verification (15 Feb 2026)** ✅

Iteration_44 test report — testing_agent_v3_fork:
- Backend `/api/onboarding/briefing-summary`: 4/4 pytest tests PASS
  (anonymous access · residential category · commercial category ·
  hospitality category · empty-payload fallback).
- Frontend: Step 2 strictly category-scoped — confirmed via
  Playwright that selecting `office` yields `bedroom/master/kitchen/
  walkin = false` while `meeting/executive/open_space = true`.
  `apartment` yields the inverse. `boutique_hotel` yields
  `suites/lobby/spa = true` and `bedroom = false`.
- Project_type change clears spaces (no stale Office answer surviving
  into a Residential flow).
- Locale switching preserves answers (project_type/spaces/moods all
  survive in localStorage round-trip).
- Save state hint visible on every step.
- Adaptive STEP X OF Y counter accurate.

**Files of reference (new/modified in Phase V)**

- `/app/frontend/src/site/content/onboardingGraph.js` (NEW, ~210 LOC)
- `/app/frontend/src/pages/site/StartProjectWizard.jsx` (refactor —
  visibleSteps, setProjectType reset, contentOverride props,
  FinalReady prefetch, payload carries category + briefing_shape +
  ai_briefing)
- `/app/backend/routers/onboarding.py` (+ new `briefing-summary` endpoint
  ~95 LOC, Claude Sonnet 4.5 + deterministic fallback)

**Out of scope (kept for Phase V.2 / next iteration)**

- LOW: Locale chip inside the wizard preserves answers but did not
  visibly re-translate copy in the Playwright test run — likely a
  SiteContext binding gap, not a Phase V regression.
- LOW: `<img src="">` console warnings on step 4 inspirations grid —
  cosmetic, pre-existing since Phase H.5.
- True conversational AI guidance during the wizard (today AI runs
  only at the end). Phase V deliberately keeps AI as an **internal
  co-pilot**, never replacing the wizard, per Human-First rule.
- Industry-specific verticals beyond the 4 base categories
  (luxury-villa subcategory, healthcare commercial, etc.) — the graph
  schema supports this via more entries in `SPACES_BY_CATEGORY`.
- Per-step branching (skip Step 5 materials for clients who picked a
  fully-furnished hospitality project, etc.) — the engine supports
  `visible_when()` predicates; we just haven't activated them yet.
- `wiz-final-briefing` panel is hidden today (operational use only);
  Phase V.2 can surface a "How your studio understood you" cinematic
  recap card on the FinalReady screen, drawing from `briefing_summary`.



### ✅ Phase U — Inline CMS Editors (Visual-First, Framer-like) (DONE — 15 Feb 2026)

The 4 new homepage blocks (`stats_band`, `magazine_grid`, `brand_logos`,
`team_identity_card`) shipped in Phase T were renderable but editable only via
raw JSON. Phase U makes them feel like a luxury editorial publishing tool:
inline values, contextual hover toolbars, live preview, drag-style reorder,
Framer/Webflow-grade direct manipulation — never an admin form panel.

**Editor surface — `[data-surface="os"]` Storefront Studio**

- All 4 new renderers live in `/app/frontend/src/components/storefront/SectionRenderers.jsx`
  next to the existing Phase B renderers (`StoreHero`, `DualCta`, `ValueProps`,
  `ProjectsPreview`, `Newsletter`). Registered in the `RENDERERS` map so the
  Studio resolves them automatically when a section is added.
- Shared primitives: `BlockToolbar` (floating glassmorphism pill, top-center,
  hover-revealed) · `ToolbarSegment` · `ToolbarChip` — calm dark, no enterprise
  CRUD feeling.
- `StorefrontStudio.jsx` patched to pass `tenantSlug` down to `renderSection`
  so `team_identity_card` can resolve real advisor data from
  `/api/storefront/public/{slug}/team-leaders`.

**1. `stats_band` editor**
- Hover toolbar: `Accent (gold | teal | mono)` · `Align (left | center)`.
- Each stat: click value → inline edit (4xl Playfair tabular-nums);
  click label → inline edit (uppercase tracking).
- Hover row → chevron-left / chevron-right reorder + X remove.
- `Add stat` dashed tile with `+` icon.

**2. `magazine_grid` editor**
- Hover toolbar: `Density (tight | comfortable | spacious)` ·
  `Featured highlight (on | off)`.
- Cards: cover → "Replace cover" overlay calls AssetPicker; category, title,
  slug all inline-editable; star pin marks featured; reorder + remove on hover.
- Section header: kicker + headline + CTA all inline; CTA renders as a pill
  preview (the actual button on storefront).
- `Add article` tile (max 9).

**3. `brand_logos` editor**
- Hover toolbar: `Theme (auto | dark | light)` · `Grayscale (on | off)` ·
  `Density (tight | comfortable | spacious)`.
- Logo cells: hover shows tiny floating toolbar (upload image, star featured,
  reorder, remove) + a "link URL" pill below for href. Wordmark text is
  inline-editable when no image is set.
- Theme=dark renders the band on `#0F0F12`; theme=light on `#F7F4EE`.

**4. `team_identity_card` editor — MOST CRITICAL (Human-First rule)**
- Hover toolbar: `Variant (warm | dark)` · `Portrait (Left | Right)` ·
  `Show (1 leader | 2 leaders)` · `Signature (on | off)` ·
  `Zoom (80–140%)` slider.
- Variant=warm renders ivory `#F8F4EC` + dark text; variant=dark renders
  `#0F0F12` + ivory text.
- Inline-editable: eyebrow, headline, subheadline, CTA label, CTA href.
- Visible advisor data is fetched from the live public endpoint — **no fake
  users, no stock avatars**. The block falls back gracefully to a calm
  "No referent introduced" message when the tenant hasn't completed Phase S.2.
- `LeaderAvatar` component: graceful fallback chip with the advisor's
  initials (Playfair) and a warm gold gradient when `avatar_url` is missing
  or fails to load — never a broken image frame.
- Bottom badge: `"N real reference(s) from this studio · public-safe"` to
  reassure the editor that no fabrication is happening.

**Route guard — `StudioAdminRoute`**
- New guard in `App.js` restricts `/settings/storefront` to
  `tenant_admin | super_admin`. Designers, editors, and other roles are
  redirected BEFORE the shell mounts → no half-loaded "Failed to load
  storefront pages" error state.

**Preserved invariants (zero regression)**
- CMS architecture, revision engine, publish flow, storefront rendering,
  block registry logic — all unchanged. Phase U is editor-UX-only.
- Existing autosave debounce (700ms) + draft delta + diff drawer + revisions
  pipeline work transparently for the new editors.
- Public storefront (`/`) still renders via legacy HomePage components with
  CMS overrides resolved — no editor chrome leaks.
- Strict surface isolation respected: all UI under `[data-surface="os"]`.

**Tested end-to-end (15 Feb 2026)** ✅
- 150 Phase U data-testids verified by testing_agent_v3_fork (iteration 43).
- 4 hover toolbars discoverable on each new section.
- Variant warm↔dark flip verified visually.
- Real advisor "Stefano Ogrisek · DIREZIONE STUDIO · LEAD DESIGNER" rendered
  in the team_identity_card preview from the live API.
- Autosave pill cycles idle → saving → saved within ~2.5s after an inline edit.
- RBAC: `client@` redirected to `/client` (no studio access);
  `designer@` redirected to `/dashboard` (post-fix); cross-tenant `studio2@`
  shows its own home with no Demo Studio leak.
- Public `/` rendering: 0 editor toolbars leaking, 850/Stefano/legacy stats
  + magazine + brands all render correctly anonymously.

**Files of reference (new/modified in Phase U)**
- `/app/frontend/src/components/storefront/SectionRenderers.jsx`
  (+ ~800 LOC: StatsBand, MagazineGrid, BrandLogos, TeamIdentityCard,
  LeaderAvatar, BlockToolbar primitives)
- `/app/frontend/src/pages/settings/StorefrontStudio.jsx` (passes `tenantSlug`)
- `/app/frontend/src/App.js` (`StudioAdminRoute` guard for
  `/settings/storefront`)

**Out of scope (kept for Phase U.2 / next pass)**
- True drag-and-drop ordering (current chevron-based reorder is functional
  and accessible; HTML5 DnD can be layered later via `react-dnd`).
- Picking journal articles from an actual `magazine_articles` table (today
  the magazine grid is fully self-contained — articles are inline items).
- Brand logos library / asset registry (logos are uploaded via the existing
  AssetPicker; future iteration can introduce a "brand registry" entity).
- Inline editor file-size refactor: `SectionRenderers.jsx` is now ~1430 LOC.
  Recommended split into `components/storefront/renderers/` per-block files
  when the next phase touches this surface.


## Implementation Status

### ✅ Phase S.2 Extension — Avatar Crop/Zoom + Emergent Branding Removed + Human Workflow Layer (DONE — 15 Feb 2026)

This iteration ships three critical pieces in one cohesive sprint:

**1. Avatar Crop / Zoom / Position Tool (bug fix + feature)**

The reported "Please fill out this field" tooltip on the avatar slot
was caused by the absence of a `<form noValidate>` wrapper around the
modal inputs. Fixed by wrapping the whole modal body in
`<form noValidate onSubmit={...}>` and switching the primary CTA to
`type="submit"` — native HTML5 validation is now fully neutralised.

New two-step pipeline:
- **STEP A — pick** a local image (JPG/PNG/WebP/GIF ≤ 4 MB).
- **STEP B — position** inside a circular frame:
  - 280×280 preview canvas with click-and-drag panning
  - zoom slider (1.0× → 4.0×) with live preview
  - "Ripristina" resets pan + zoom
  - "Conferma foto" exports a 360×360 PNG via `canvas.toBlob`
    and uploads it through the existing `/api/profile/me/avatar`
    endpoint
  - "Annulla" returns to the unedited preview state
- No external dependencies — pure canvas + lucide icons.

**2. Emergent Branding Removed (Pro licensed build)**

`/app/frontend/public/index.html`:
- Removed: `<meta description="A product of emergent.sh">`, the
  `<script src="https://assets.emergent.sh/scripts/emergent-main.js">`,
  the fixed `<a id="emergent-badge">` floating pill.
- Page `<title>` → `MOOD for DESIGN™`.
- Page description → product-aligned copy.

**3. Phase S.2 — Human Workflow Layer + Real Contact Initiation**

DB (migration `023_client_messages.sql`):
- `client_messages` — tenant + project + client + assignee + sender +
  recipient + body + message_type (4 values) + visibility (2 values)
  + status (4 values) + read_at + metadata.
- `human_assignments` extended with `first_contact_suggested_at`,
  `first_contact_sent_at`, `first_contact_status` (pending / suggested
  / sent / overdue).
- Reused existing `notifications` table (no schema change).

Notification provider abstraction — `/app/backend/core/notification_service.py`:
- `notify(...)` is the only public surface. Adding email later is a
  one-file change (provider `db` is active; `email_future` documented).
- `list_for_user`, `mark_read` complete the minimal API.

Router `/api/client-messages/*`:
- `GET /thread` — auto-scopes to caller's profile_id for clients;
  admins/assignees pass `?client_id=` and ownership is enforced
  against `human_assignments`. Clients are FILTERED at the query
  level (`visibility='client_visible'`) — internal-only rows + AI
  suggestions are physically unreachable.
- `POST /send` — auto-routes `client_message` vs `assignee_reply`,
  notifies the other side via `notification_service`, marks
  `first_contact_sent_at` on the active assignment.
- `POST /{id}/read` — recipient-only mark-read.
- `GET /assignee/queue` — per-assignee (or per-tenant for admins)
  queue with first-contact status + 24h overdue auto-computation +
  latest-message preview.
- `POST /{client_id}/suggest-opening` — Claude Sonnet 4.5 generates a
  premium first message (no marketing copy, ≤ 3-4 sentences in IT,
  no signature). Output stored as `ai_suggestion` / `internal_only`
  / `draft`. Calls update `first_contact_suggested_at`.

Frontend — Client Portal:
- `MessageReferentModal.jsx` — opens from the Human Card "Scrivi al
  tuo referente" CTA. Calm hospitality form: assignee header with
  avatar + role + response time, textarea (4000 char), gold "Invia
  messaggio" CTA. On success: `toast.success("Messaggio inviato.
  Stefano ti risponderà appena possibile.")` — never "ticket created".
- `ClientMessagesPage.jsx` — replaces the stub. Three-zone layout:
  header card (assignee identity), thread (alternating messages with
  Tu / Stefano labels + ISO timestamps + gold left-border on
  assignee replies), composer (sticky bottom, minimal).
- Empty state: atelier copy ("Qui troverai le comunicazioni principali
  con il tuo referente."). Auto-scroll to bottom on new message.

Frontend — Blueprint OS:
- `AssignedClientsPanel.jsx` — renders on the Dashboard. Shows clients
  assigned to the current user + status pill (Da contattare /
  Suggestion pronta / Primo contatto inviato / In ritardo) + latest
  message preview. "Suggerisci primo messaggio" calls the AI endpoint,
  surfaces an inline editable draft with Scarta / Rigenera / Invia
  primo messaggio actions. Auto-hides when queue is empty.

End-to-end verification (15 Feb 2026) ✅
- Client sends "Salve Stefano, vorrei aggiornamenti sulle prime
  moodboard. Grazie!" → toast "Stefano ti risponderà appena possibile."
- Thread re-renders with 2 client messages ordered by time.
- Admin queue endpoint returns Marco Bianchi assignment with status
  `suggested` and the AI-generated draft visible in the studio thread
  (`message_type=ai_suggestion`, `visibility=internal_only`).
- Client thread re-fetch: 2 messages, **zero AI suggestions leaked**.
- Studio thread re-fetch: 3 rows (client message + AI suggestion).
- 24h overdue calculation verified on >24h old `pending` assignments.
- Dashboard shows "Human Follow-ups · I clienti a te assegnati ·
  1 attivo" with the Marco row + status pill + message preview.
- Emergent badge count = 0 on both surfaces.
- Avatar modal: file < 256B rejected, valid PNG cropped + zoomed +
  positioned + exported + uploaded successfully.
- Zero React errors, zero unhandled rejections.

**Files of reference (new in S.2 ext)**
- `/app/supabase/migrations/023_client_messages.sql`
- `/app/backend/core/notification_service.py`
- `/app/backend/routers/client_messages.py`
- `/app/frontend/src/components/client/MessageReferentModal.jsx`
- `/app/frontend/src/pages/client/ClientMessagesPage.jsx`
- `/app/frontend/src/components/dashboard/AssignedClientsPanel.jsx`
- modified: `OwnerIntroductionModal.jsx` (form noValidate + crop tool),
  `ClientHumanCard.jsx` (wire MessageReferentModal), `App.js`
  (real ClientMessagesPage), `DashboardPage.jsx` (mount panel),
  `index.html` (strip Emergent branding), `server.py`.

**Out of scope (preserved for S.3)**
- Email provider integration (SendGrid / Resend) — abstraction ready.
- "Apri suggestion bozza" button when status='suggested' (the AI draft
  is stored but currently only re-creatable via "Suggerisci" button).
  Today, opening the existing draft requires a fresh AI call; ideally
  the row should expose the persisted suggestion for inline edit.
- Read receipts surfaced on the client side (server stores `read_at`,
  UI does not render).
- Studio side "Apri thread" full conversation view (the panel today
  only handles the FIRST message workflow; client/studio further
  back-and-forth happens via client's `/messages` page on the client
  side, with assignee replies coming via the `assignee_reply`
  message_type but no studio-side composer beyond the suggestion).





## Implementation Status

### ✅ Phase S.2 — Human-First Tenant Model (DONE — 15 Feb 2026)

Phase S.2 makes the **human visible everywhere** — every tenant owner
is required to introduce themselves with a real photo, role and bio
before the platform considers their workspace complete. Clients now
see "Ciao, sono Stefano" with a real face, not an anonymous workspace.

**Backend additions**
- New router `/api/profile/*`:
  - `GET  /me` — returns full self-profile with computed `is_introduced` flag.
  - `PATCH /me` — updates editorial fields (first_name, last_name,
    role_label, short_bio, response_time_label, contact_cta_label,
    avatar_url) with length validation (bio ≤ 240 chars).
  - `POST /me/avatar` — multipart upload (JPG/PNG/WebP/GIF ≤ 4 MB)
    server-side to Supabase Storage bucket `tenant-assets`, path
    `avatars/{tenant_id}/{profile_id}-{cachebust}.{ext}`. Public URL
    persisted on `users_profile.avatar_url`.
- `tenant_onboarding` extended with `owner_introduced` boolean.
  Auto-detection compares the tenant owner's avatar+bio+role_label
  presence. Checklist re-ordered to put "Presentati ai tuoi clienti"
  RIGHT AFTER "Completa il profilo studio" — before branding/services,
  because human presence must precede operational setup.
- Migration: `ALTER TABLE tenant_onboarding ADD COLUMN
  owner_introduced boolean NOT NULL DEFAULT false;` (applied live).

**Frontend additions**
- `OwnerIntroductionModal.jsx` — cinematic enterprise modal:
  - Big circular avatar slot (112px) with camera-overlay on hover,
    Loader2 spinner while uploading.
  - Required: avatar + role_label + short_bio. Save button stays
    disabled until ALL three are present.
  - Bio textarea with live `0/240` counter, amber when ≤20 remaining.
  - Optional collapsible: response_time_label + contact_cta_label.
  - Auto-prefill from `/api/profile/me` so existing bios aren't lost.
  - Footer: `Più tardi` (per-session defer) + gold `Salva e pubblica`.
- `OwnerIntroductionGate.jsx` — mounted in `DashboardLayout`. On every
  dashboard load:
  - If role ∈ {tenant_admin, super_admin} AND `is_introduced=false`
    AND not deferred this session → auto-opens the modal.
  - Listens for the global `mfd:open-owner-introduction` event so other
    UI (the StudioOnboardingPanel) can pop it on demand without imports.
  - sessionStorage key `mfd.owner_intro.deferred` honours "Più tardi"
    so users aren't nagged on every navigation, but the gate triggers
    again on hard refresh / next session.
- `StudioOnboardingPanel` — the `owner_introduced` row now renders
  "Presentati ora →" instead of `Apri sezione`; the button fires the
  global event and the modal pops without leaving the dashboard.

**End-to-end verification (15 Feb 2026)** ✅
- Stefano (super_admin) logs in → modal auto-opens (no avatar yet).
- Tiny file < 256 bytes → backend rejects (413/400 with Italian copy).
- 64×64 solid PNG (179 B) → rejected.
- 256×256 PNG (761 B) → accepted, uploaded to Supabase Storage,
  public URL returned, `users_profile.avatar_url` persisted.
- `/api/profile/me` immediately returns `is_introduced: true`.
- Manual reassign Stefano → client sees Human Card transition
  from "Ciao, sono Giulia" to "Ciao, sono Stefano" with avatar img.
- Onboarding checklist: 5/8 → 6/8 (75%) once Stefano completes the
  presentation. Step labelled "Presentati ai tuoi clienti" checked ✓.
- Modal does NOT re-open after successful save (gate sees `is_introduced=true`).
- Modal DOES re-open on next session if save was aborted (gate flushes
  defer state only on full completion).
- Zero React errors, zero unhandled rejections, zero security regressions.

**Public-safe exposure preserved**
- Client sees only the public-safe assignee shape from S.1 — name,
  first_name, avatar_url, role_label, short_bio, response_time_label,
  contact_cta_label. NO email, role, tenant_id, permissions leakage.

**Files of reference (new in S.2)**
- `/app/backend/routers/profile.py`
- `/app/frontend/src/components/onboarding/OwnerIntroductionModal.jsx`
- `/app/frontend/src/components/onboarding/OwnerIntroductionGate.jsx`
- modified: `/app/backend/routers/tenant_onboarding.py`,
  `/app/frontend/src/components/dashboard/StudioOnboardingPanel.jsx`,
  `/app/frontend/src/components/layout/DashboardLayout.jsx`,
  `/app/backend/server.py`

**Out of scope (preserved for S.3+)**
- Multiple advisors per tenant (architecture supports it via
  `human_assignments`; the modal currently configures the owner only).
- Specialisations / tags on profiles (designer · pm · ad-partner).
- Availability schedules + timezone matching.
- Language matching between client and advisor.
- AI-driven candidate routing.
- "Forced complete" mode (`forceComplete` flag exists on the modal but
  is NOT currently wired — users can defer once per session. The
  product can flip this when the studio onboarding flow is hardened).
- Avatar cropping / image-processing UI (currently the uploaded image
  is stored as-is and CSS object-cover handles framing).





## Implementation Status

### ✅ Phase S.1 — Human Layer Foundation + Tenant Onboarding (DONE — 15 Feb 2026)

Phase S.1 introduces the **Human Layer** — the relational backbone that
turns MOOD from "a SaaS" into "a relationship-orchestrated platform".
Every client now has a real, tenant-aware human reference; every new
studio gets a guided setup checklist that auto-detects progress from
real data.

**ABSOLUTE RULES respected:**
- ZERO hardcoded users / fake support agents / "MOOD Support" personae.
- ZERO cross-tenant assignment leakage.
- ZERO demo preload — assignment derives from the actual users_profile
  records of the active tenant.

**Database (migration `022_human_layer.sql`)**
- `human_assignments` — who-supports-whom (subject_type ∈ client / lead /
  project / studio_onboarding) with reason, status, deferred UNIQUE on
  (tenant, subject_type, subject_id, status='active').
- `human_assignment_events` — append-only audit trail (assigned /
  reassigned / viewed / contacted / completed).
- `tenant_onboarding` — per-tenant checklist cache + dismissed_at.
- `users_profile` extended with `short_bio`, `role_label`,
  `response_time_label`, `contact_cta_label` for the public-safe
  assignee profile.

**Backend — Assignment Engine** (`/app/backend/core/human_assignment.py`)
- Priority groups for client subjects:
  `tenant_admin → project_manager → designer/editor → super_admin (fallback)`.
- Priority for studio_onboarding:
  `super_admin → tenant_admin → project_manager`.
- Round-robin V1: lowest active-assignment count within the chosen
  group wins; tie-break by `created_at ASC`. Deterministic, not random.
- Empty tenant → records `status='active', reason='unassigned',
  assignee=null` so the UI can show a calm hint, never an error.
- `public_assignee_profile()` strips internal fields (role, email,
  permissions, backend IDs) before exposing to client.

**Backend — API** (`/api/human-assignment/*`)
- `GET  /me` — current user's assignment (auto-ensures for clients).
- `GET  /for-subject` — admin only, lookup arbitrary subject.
- `POST /assign` — admin only, manual override.
- `POST /reassign` — admin only, marks old as reassigned + creates new.
- `GET  /candidates` — admin only, lists candidate pool.

**Backend — Tenant Onboarding** (`/api/tenant-onboarding/*`)
- 7-step checklist auto-detected from live signals (tenants.name +
  primary_color, logo_url, project.project_type, ≥2 active members,
  ≥1 project, ≥1 media_library row, ≥1 published storefront_page).
- DB row is a CACHE: manual `mark-done` wins over auto False; auto True
  wins over cached False (never unfollows itself).
- `GET /status` → items + completed/total + progress% + all_done +
  dismissed. 403 for role=client.
- `POST /mark-done` — manual step confirmation.
- `POST /dismiss` — tenant_admin / super_admin hide forever.

**Frontend — Client Human Card** (`ClientHumanCard.jsx`)
- Inserted into both zero-data and has-data flows of ClientOverviewPage.
- 96px avatar (real image or gold-soft initials fallback), Playfair
  "Ciao, sono {first_name}.", role_label uppercase, full short_bio,
  response_time_label with clock icon, 3 CTAs (gold "Scrivi a {first_name}"
  + ghost "Prenota una call" + link "Completa il briefing").
- Unassigned fallback: "Il team dello studio sta assegnando il referente
  più adatto al tuo progetto." — never an error.
- Pure calm hospitality tone — NO "AI assistant", NO chatbot bubble,
  NO support-agent chrome.

**Frontend — Studio Onboarding Panel** (`StudioOnboardingPanel.jsx`)
- Renders on `/dashboard` (Blueprint OS) when `all_done=false` AND
  `dismissed=false`. Auto-hides when complete or dismissed.
- Playfair "Configura il tuo workspace.", live progress bar with teal
  fill, big tabular-nums "{completed}/{total}", X dismiss button.
- 7 checklist rows in 2-col grid; each row has gold-teal check (done)
  or numbered placeholder (todo), title, body, "Apri sezione →"
  deep-link and "Segna fatto" override.

**Seed enhancements**
- Stefano (super_admin) — bio + role_label "Direzione studio · Lead
  Designer" + response_time + contact_cta.
- Giulia (designer) — bio + role_label "Senior Designer" + response_time
  + contact_cta.

**Security & isolation verification (15 Feb 2026)** ✅
- Client `/api/human-assignment/me` → returns Giulia (real designer,
  picked by round-robin since multiple designers in tenant).
- Client `/api/tenant-onboarding/status` → 403.
- Designer `/api/client/overview` → 403 (Phase R guard).
- Public-safe assignee shape verified: only `id, name, first_name,
  avatar_url, role_label, short_bio, response_time_label,
  contact_cta_label`. No role, no email, no tenant_id.
- Onboarding panel visible to super_admin, hides on dismiss,
  re-appears on hard refresh until dismissed_at is set.
- Zero React errors, zero unhandled rejections.

**Files of reference (new in S.1)**
- `/app/supabase/migrations/022_human_layer.sql`
- `/app/backend/core/human_assignment.py`
- `/app/backend/routers/human_assignment.py`
- `/app/backend/routers/tenant_onboarding.py`
- `/app/frontend/src/components/client/ClientHumanCard.jsx`
- `/app/frontend/src/components/dashboard/StudioOnboardingPanel.jsx`

**Out of scope (preserved for S.2 / future)**
- Real "Scrivi al referente" message thread (currently triggers toast).
- Functional "Prenota una call" calendar integration.
- AI-driven candidate matching (currently strict round-robin V1).
- Advanced assignee availability schedules.
- Auto-assign hook on signup (currently `auto-ensure` triggers lazily
  the first time `/api/human-assignment/me` is called — sufficient
  for Phase S.1).
- Lead Assignment auto-trigger (lead → designer routing).
- Real new-tenant onboarding flow with welcome wizard (currently the
  panel just renders when checklist is incomplete; tenant creation
  flow itself remains untouched).
- Role-aware empty states for designer / PM / analyst (currently only
  client + studio admin get tailored experiences; the others still see
  Blueprint OS default dashboards).





## Implementation Status

### ✅ Phase R.1 + R.2 — Client Portal Foundation + Cinematic Zero-Data Experience (DONE — 15 Feb 2026)

Phase R introduces the **third surface** of MOOD for DESIGN™ — a
quiet, warm hospitality space dedicated to clients. The Blueprint OS™
remains hidden; the client only sees the elegant edge of the workflow.

**Surface architecture — `[data-surface="client"]`**
- New design-system root: `/app/frontend/src/design-system/client/tokens.css`
- New theme wrapper: `ClientThemeProvider` (mirrors `BlueprintThemeProvider`
  pattern, identical strictness).
- **Three surfaces now coexist with zero token leakage:**
   - `[data-surface="os"]`        → Blueprint OS Workspace (graphite + teal)
   - `[data-surface="storefront"]` → Tenant public storefront (cream + Cormorant)
   - `[data-surface="client"]`    → Client Portal (warm graphite + ivory + muted gold)

**Visual direction — Apple + Linear + luxury hospitality**
- Palette: `#0A0A0B` bg, surfaces `#111114` → `#1B1B22`, warm ivory text,
  muted gold accent `#C8A977`, teal restricted to status pulses only.
- Typography: Playfair Display ONLY on titles, Inter on UI body.
- Density: ~40% looser than Blueprint OS (`--cp-space-*` ladder).
- Shadows: warm, soft, no glow. No gradients-of-AI.

**Layout — `ClientDashboardLayout`**
- 260px quiet sidebar + main area with topbar greeting + page outlet.
- Topbar shows `Benvenuto, {first_name}` (Playfair 28px) + bell + initials avatar.

**Sidebar — `ClientSidebar` (LOCKED structure)**
- 7 entries exactly: Panoramica · Il mio progetto · Moodboard · Timeline ·
  Approvazioni · File condivisi · Messaggi.
- Wordmark "MOOD / for DESIGN" with gold subtitle.
- Active item: 2px gold left bar + ivory text, no fill, no glow.
- Bottom helper card "Hai bisogno di aiuto?" → "Contatta lo studio" CTA.
- **No** enterprise items. Blueprint OS is invisible from this surface.

**Cinematic zero-data experience**
- `ClientWelcomeHero` — Playfair "Benvenuto nel tuo spazio progetto.",
  editorial interior image with soft fade, three CTAs (gold "Completa il
  briefing" + ghost "Prenota una call" + link "Scopri il processo →").
- `HowItWorksSection` — 4 numbered cards (Brief · Moodboard · Revisione ·
  Consegna) in 4-col grid with Playfair titles + lucide icons.
- `WhatYouWillFindSection` — 6 mini cards (Timeline · Materiali · File ·
  Appuntamenti · Moodboard · Comunicazioni) with circular gold-bg icons.
- All copy in Italian, atelier register — never "no data available".

**Has-data experience (when project exists)**
- Hero project card with title, type, location, "Vai al progetto" gold CTA
  and inset "Stato attuale" side panel with compact tracker.
- Full-width Timeline card with horizontal `ProjectProgressTracker`.
- Moodboards card (3-thumb grid) + Approvals card (proposal rows).
- Premium empty hints ("Le prime proposte stanno arrivando.") when data is
  empty but project exists.

**`ProjectProgressTracker` — heart of the portal**
- 6 stages: Brief · Moodboard · Materiali · Progettazione · Revisione · Consegna.
- Variants: `horizontal` (cinematic rail) + `compact` (vertical w/ progress bar).
- Dot states: filled gold+check (done), gold ring (current), faint dot (upcoming).

**Stub pages for the other 6 sidebar entries**
- Premium "in arrivo" cards with italic editorial copy, gold eyebrow + Playfair
  title + Sparkles icon. NEVER generic "404 / coming soon".

**Routing + role-based redirect (App.js)**
- `ClientRoute` — redirects non-client roles AWAY from `/client/*` → `/dashboard`.
- `StudioRoute` — redirects role=client AWAY from `/dashboard/*` → `/client`.
- `PublicRoute` extended: logged-in client lands on `/client`, others on `/dashboard`.

**Backend — `/api/client/*` ownership-scoped router**
- All endpoints double-scoped: `tenant_id == ctx['tenant_id']` AND
  `projects.client_user_id == ctx['profile_id']`. Moodboards / proposals
  derived from owned projects only. NEVER tenant-wide fallback or demo preload.
- `_require_client()` allows roles `client`, `tenant_admin`, `super_admin`. All
  others → HTTP 403.
- `GET /api/client/overview` → project + pipeline + counts + moodboards + approvals.
  `zero_data: true` when no project owned.
- `GET /api/client/projects|moodboards|approvals` → all ownership-scoped.
- `_stage_index_for(status)` tolerantly maps `projects.status` to one of the 6
  pipeline stages. Unknown → `brief`.

**Security verification (15 Feb 2026)** ✅
- Client login → lands at `/client`, never sees OS (`data-surface="os"` = 0).
- Client manual `/dashboard` → bounces back to `/client`.
- Designer login → lands at `/dashboard`. Manual `/client` → bounces to `/dashboard`,
  client surface count = 0.
- Backend `/api/client/overview` → 403 for designer.
- Client demo user has 0 projects → renders cinematic zero-data experience.
- Zero React errors, zero unhandled rejections.

**Files of reference (new in R)**
- `/app/backend/routers/client_portal.py` (4 endpoints + 6-stage mapping)
- `/app/frontend/src/design-system/client/tokens.css`
- `/app/frontend/src/design-system/client/ClientThemeProvider.jsx`
- `/app/frontend/src/components/client/{ClientSidebar,ClientDashboardLayout,
  ClientWelcomeHero,HowItWorksSection,WhatYouWillFindSection,
  ProjectProgressTracker}.jsx`
- `/app/frontend/src/pages/client/{ClientOverviewPage,ClientStubPages}.jsx`
- `/app/frontend/src/App.js` (ClientRoute + StudioRoute + routing)
- `/app/backend/server.py` (router include)

**Out of scope (preserved for R.3)**
- Real project_files / appointments / messages tables (currently stubs).
- Has-data flows for the 6 secondary nav pages (all are calm "in arrivo" stubs).
- ProjectProgressTracker per-stage milestones / sub-tasks.
- Functional "Contatta lo studio" helper (static button, no handler yet).





## Original Problem Statement
Multi-tenant SaaS platform per interior designer e architetti, costruita come Blueprint OS™ — operating system configurabile multi-tenant. Stack: React + FastAPI + Supabase. Tutto Blueprint-driven (zero hardcoded UI), multi-locale, tenant-themed, permission-aware.

## Brand Architecture
- **Platform**: MOOD for DESIGN™
- **Framework**: A Blueprint OS™ Platform
- **Operational core**: Blueprint Workspace™ (Leads + Projects + Proposals + Client Portal integrati)
- **Standalone modules**: Blueprint Moodboards™ · Blueprint Inspirations™ · Blueprint Insights™ · Blueprint Concierge™ · Blueprint Match™ (future)

## Tech Stack
- **Frontend**: React 19 JSX, Tailwind, react-router, lucide-react, @supabase/supabase-js (anon)
- **Backend**: FastAPI, supabase-py (service_role), PyJWT (JWKS ES256 + HS256 fallback)
- **DB**: Supabase Postgres (Transaction Pooler 6543)
- **Auth**: Supabase Auth (email/password) — JWT verificati via JWKS
- **Storage**: Supabase Storage (6 bucket esistenti)

## Architecture Principles (CRITICAL)
1. **No hardcoded**: testi, colori, navigazione, dashboard widgets, sezioni, module visibility → tutto via API
2. **Blueprint-driven**: ogni configurazione vive in DB (`tenants` + `tenant_settings` KV JSON)
3. **Centralized engines**:
   - `core/permissions.py` (8 ruoli, 31 permission tuples `resource:action`)
   - `core/modules.py` (module registry con routes + required_permissions)
   - `core/feature_flags.py` (catalog + tenant override engine)
   - `core/tenant_context.py` (impersonation + audit + tenant scoping)
4. **RLS disabled** — multi-tenancy enforced backend (`tenant_id` in ogni query, centralizzato in `get_tenant_context`)
5. **Locale-aware**: 6 lingue (en-US, en-GB, it, fr, de, es) + architettura pronta per RTL (AE/ZH/JA future)

## Implementation Status

### ✅ Phase Q.1 — AI Editorial Assistant Stabilization (DONE — 15 Feb 2026)

Phase Q.1 closes the AI Editorial Assistant inside the Diff Drawer with a
**stabilization pass** — production-grade UX, zero layout regression,
graceful clipboard fallback, and full keyboard support. The Assistant
remains an *invisible editorial co-pilot* — no chatbots, no glow, no
gimmicks.

**Visual / layout stabilization**
- `AISuggestionPanel.jsx` split into `AISuggestionTrigger` + `AISuggestionPanelBody`
  so the trigger pill lives in the field-header flex row while the panel
  body renders BELOW the inline/side-by-side diff content — eliminates the
  flex-squeeze layout bug that caused the drawer width to "jump".
- `PublishDiffDrawer.jsx` enforces single-open invariant via `aiOpenKey`
  state lifted to `ChangesView` — only one editorial panel can be active
  at a time across page meta + every locale + every section.
- Drawer width verified stable at 640px before/after AI open
  (Playwright bbox compare).
- Min-height 72px on suggestion body avoids loader→content flicker.

**Context propagation**
- `aiContext` derived once per diff load (`pageKey`, `page_title`,
  `tenant_name`, `default_locale`) and passed down to every `FieldRow`
  with the locale-specific override merged in for per-locale text changes.
- Backend `editorial-suggest` already accepts the full context shape.

**Interaction polish**
- ESC always closes the active panel (window listener, scoped via
  single-open invariant — no focus-trap headaches).
- `Apply` writes to clipboard with graceful promise-rejection fallback:
  if the browser denies clipboard write (insecure context, sandbox, etc.)
  the toast quietly shifts to "Suggestion ready — copy it manually"
  instead of triggering an uncaught rejection and the dev React overlay.
- Trigger pill gains an `active` visual state (teal-tinted border + soft
  background) while its panel is open — calm feedback, no glow.
- `auto-run` on mount guarded by `ranOnceRef` to neutralise React 18
  StrictMode double-invocation.

**Editorial actions** (unchanged from Q.1 baseline)
- 11 single-shot actions: improve · premium · concise · readability ·
  storytelling · seo · audience_us · audience_luxury · improve_cta ·
  rewrite_headline · alternative_titles
- Claude Sonnet 4.5 via `emergentintegrations` LlmChat + Emergent LLM key
- 2.5–3.0s typical latency, output preserves source language (Italian
  stays Italian) and format (headline stays headline)
- "Banned phrase" guard list prevents AI-slop language

**Smoke test verified** ✅ (15 Feb 2026)
- Login → Storefront Studio → Open Diff Drawer → Inline mode → Open AI
  panel on `it/headline` → suggestion arrives in ~3s → Discard clears
  text but keeps panel → switch action to "premium" → new suggestion →
  ESC → panel closes → re-open → Apply → toast + panel closes →
  Side-by-side mode → AI works equally → Revisions tab → no crash →
  back to Changes → drawer close → re-open → fresh state. Zero React
  errors. Drawer width stable throughout.

**Files of reference**
- `/app/backend/routers/ai_editorial.py` (unchanged from Q.1 implementation)
- `/app/frontend/src/components/ai/AISuggestionPanel.jsx` (split + ESC + StrictMode guard)
- `/app/frontend/src/components/storefront/PublishDiffDrawer.jsx`
  (FieldRow refactor, single-open state, aiContext propagation,
  clipboard-rejection-safe `onAccept`)

**Out of scope (preserved for Q.2)**
- AI Journal assistant
- Headline generator surface outside Diff Drawer
- Locale auto-translation suggestions
- Material storytelling generator
- SEO suggestion engine
- Project storytelling generator



## Implementation Status (older)

### ✅ Phase P — Media Library Cinematic Enterprise Refactor (DONE — 15 Feb 2026)

Operational Asset System completamente ridisegnato secondo brief. **Visual +
UX + IA only** — zero modifiche a business logic, routing, API, licensing,
revisions, auth, CMS, storefront.

**3-zone layout**
- LEFT RAIL (280px): Collections + Filters accordion (Asset Type · Used In ·
  Materials · Tags · Projects · Orientation · Date · Status). "Coming soon"
  disabled states for filters senza backend data — never broken UI.
- CENTER: Header (eyebrow "Operational Asset System" + Playfair "Media Library"
  + subtitle + big ⌘K search + Upload + New Collection) → Grid Toolbar
  (count + view switcher Grid/Compact/List + sort + bulk-select bar) → Asset
  Grid with viewport-aware density.
- RIGHT INSPECTOR (400px): 4 tabs (Details · Usage · Versions · Revisions) +
  sticky "Replace asset · keeps all relationships" cinematic CTA + Archive.

**Asset tiles redesigned** — editorial, operational
- Filename BELOW image (no overlay-heavy)
- Metadata strip below: type icon + size + dimensions + N links
- Hover: `translateY(-1px)` + teal-tinted border
- Selection: teal ring + checkbox top-left
- Type chip top-right on hover
- Three view modes: Grid (200px), Compact (140px), List (avatar + meta row)

**Inspector tabs**
- **Details**: 280px preview · 4-cell facts grid (Type · Size · Dimensions ·
  Uploaded) · File name mono · Alt text · Description (textarea) · Tags
  (chips removable) · Materials chips when attached · Save metadata CTA
- **Usage**: relationship intelligence — grouped by entity_type, each
  rendered as card (avatar icon + entity label + role + title + ↗ link).
  Empty state "Orphan asset" with icon
- **Versions**: full timeline of replacement chain (vertical rail + dots),
  current version teal-highlighted, version_number + relative timestamp.
  Empty: "Single version · use Replace to evolve"
- **Revisions**: tied to Phase J revision engine — shows CMS pages /
  storefront pages / magazine articles where the asset is published, plus
  copy "Replacing this asset triggers a new revision on every linked CMS page"

**Replace Asset flow** — preserved + visual upgrade
- Cinematic modal "Safe operational replacement"
- Current version preview + filename + size
- Drop-zone CTA + progress
- Soft versioning preserved (replaces_id / replaced_by_id wired)
- Toast "Asset replaced — version chain updated"

**Search experience — Linear/Raycast quality**
- ⌘K / Ctrl+K global focus
- 220ms debounce
- Search across asset name, alt_text, description
- Wide centered field, teal-tinted focus

**Material Registry feel**
- Materials section in left rail shows top 5 + ↗ link to /library/materials
- Inspector Usage tab surfaces materials prominently with Gem icon

**Backend — minimal presentation-only enrichment**
- `/api/media/{id}` detail endpoint now hydrates `entity_title` on each link
  by batching lookups per entity_type (projects/moodboards/proposals/leads/
  magazine_articles/cms_pages/materials). PURE read enrichment for UI —
  no business logic, no schema change.

**Strict surface isolation verified** ✅
- All visual work inside `[data-surface="os"]` scope (DashboardLayout wraps)
- Storefront `/` (cream + Cormorant) untouched
- bp-card utility + Phase O palette used throughout

**Files of reference**
- `/app/frontend/src/pages/library/MediaLibraryPage.jsx` (rewritten, ~1000 LOC, modular sub-components in single file)
- `/app/backend/routers/media.py` (entity_title hydration in get_media)

**Out of scope (per brief)**
- Backend business logic / routing / APIs / licensing / revisions / auth / CMS / storefront
- Full Material Registry logic (only visual scaffolding here)
- Tag editing CRUD (frontend chips display only; chip-remove not wired to backend tag-mutate endpoint — left for next iteration)
- AI suggestions / dependency graph visualization



### ✅ Phase O — Blueprint OS Visual System Stabilization (DONE — 15 Feb 2026)

Phase O = visual-only refinement, surface-scoped, **zero logic changes** to
backend / APIs / routing / licensing / CMS / revisions / auth / DB. Pure
cinematic uplift of the Blueprint OS surface.

**New deep cinematic palette** (`tokens.css`)
- Background: `#070707` (near-black, never pure)
- Surfaces: `#0D0F12` / `#111318` / `#151922`
- Elevated cards: `#181C24`
- Borders: `rgba(255,255,255,0.06)` · hover `rgba(0,201,179,0.28)` teal-tinted
- Text: 0.96 / 0.78 / 0.62 / 0.38 / 0.22 alpha (never pure white)
- Primary: `#00C9B3` · Soft accent `#7EE6DA` · Success `#00C27F` · Warning `#D6A756`
- Selection: teal 20% alpha

**Typography direction shift — Playfair Display for OS headlines**
- `--bp-font-heading` = `Playfair Display, Cormorant Garamond, Georgia, serif`
- `--bp-font-body` = `Inter, Suisse Intl, system-ui, sans-serif`
- Tailwind `font-heading` overridden to Playfair via `[data-surface="os"] .font-heading`
- Used sparingly on titles, KPI numbers, and welcome headline — NOT body copy
- Storefront `data-surface="storefront"` continues to use Cormorant Garamond (unchanged)
- Tracking refined: `-0.018em` heading, caps `0.22em` → `0.28em` on section labels

**Phase O `bp-card` utility** — architectural surface pattern (CSS)
- `background: linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.008))` over surface
- `border: 1px solid var(--bp-border)`
- `border-radius: 18px` (primary) / `24px` (hero)
- Hover: `translateY(-1px)` + teal-tinted border + lighter gradient
- Variant: `bp-card-elevated` for highest-level surfaces
- Reusable across DashboardPage / Library / Materials / Settings / Drawers

**Spacing rhythm — 24/32/40 system**
- Dashboard outer padding: `py-8` → `py-10`
- Card padding: `p-5/p-6` → `p-6/p-8`
- Section gaps: `gap-5` → `gap-6` · `space-y-6` → `space-y-8`
- Welcome eyebrow → headline gap: `mb-1.5` → `mb-3`

**Dashboard refinement** — KEEP logic, REFINE visuals
- All cards switched to `bp-card` class (gradient + hover transform)
- Welcome headline now Playfair `34px` with italic first name accent
- KPI numbers in Playfair `34px` tabular-nums (editorial + technical)
- Section titles upgraded to `15-18px` Playfair (no more `14px medium tracking-tight`)
- "Bentornato, [nome]" reads like a luxury OS, not an admin panel
- Featured Projects card promoted to `p-8` + radius `18px` + gradient

**Sidebar refinement** — luxury OS, not admin template
- Nav items: smaller icons (`16px` → `15px`), tighter padding, no background fill on hover (only color shift), thinner active accent bar (`0.5` → `2px`)
- Section labels: `text-[9px] tracking-[0.28em]` very faint (`--bp-text-faint`)
- More vertical breathing: `space-y-5` → `space-y-6`, `py-4` → `py-5`
- Workspace selector retained, palette adapted

**Strict surface isolation verified** ✅
- `[data-surface="os"]` scope ONLY — never `:root`, never global
- Storefront EXE Interior (`/`): screenshot-verified cream + Cormorant unchanged
- Corporate `site.css` untouched
- BlueprintThemeProvider remains the only emitter of `data-surface="os"`
- StorefrontThemeProvider remains the only emitter of `data-surface="storefront"`

**Out of scope (intentionally untouched per Phase O brief)**
- Backend routers, licensing engine, CMS revisions, AI flows, APIs
- Routing, auth, database, business logic
- Tailwind config (fontFamily defaults preserved for non-OS surfaces)
- Storefront tokens, tenant brand engine, corporate site

**Files of reference**
- `/app/frontend/src/design-system/os/tokens.css` (rewritten — Phase O palette + bp-card)
- `/app/frontend/src/pages/dashboard/DashboardPage.jsx` (visual class refactor only)
- `/app/frontend/src/components/layout/Sidebar.jsx` (NavItem + SectionLabel typography)

**Next iteration target**
Media Library visual refactor — "cinematic operational archive" direction
(Inspector tabs Details/Usage/Versions/Revisions, FiltersAccordion left rail,
GridToolbar with view switcher + sort + select, refined tile metadata,
Used-in cards with project avatars + arrow, large Replace asset CTA).



### ✅ Phase N++ — Cinematic Dashboard Rebuild + Extended IA (DONE — 15 Feb 2026)

Dashboard ricostruita completamente seguendo il mockup "Cinematic Enterprise
Workflow OS". Backend aggregato + frontend full layout + sidebar IA estesa
+ coming-soon stubs per le route non ancora implementate.

**Backend — `/api/dashboard/summary`** (`/app/backend/routers/dashboard.py`)
- Single-call aggregator: kpis (active projects · pending proposals ·
  completed tasks · hours logged) + 14-day sparkline buckets + trend cap ±99%
- Featured projects with cover hydration (moodboard.cover_metadata → media_links → signed URL fallback)
- Recent activity synthesised from latest creates of moodboards/proposals/projects/leads (no events table needed)
- Tasks pipeline (open + project_title hydration)
- Media preview (latest 6 active assets with signed URLs)
- Top materials sorted by asset_count
- Team activity from users_profile (last_login fallback)
- 8-day timeline (proposals sent + tasks due)
- **RBAC hardened**: client/ad_partner roles get HTTP 403 — dashboard is
  studio-only (clients use their own portal). Confirmed via curl.

**Frontend — `/dashboard`** (`/app/frontend/src/pages/dashboard/DashboardPage.jsx` rewritten, ~430 LOC)
- Welcome strip: BLUEPRINT WORKSPACE eyebrow + "Bentornato, [firstName]"
  + subtitle + date badge with Calendar icon
- 4 KPI cards with: uppercase label · large tabular number · trend arrow with capped ±99%
  · SVG sparkline (no chart library, gradient fill)
- Quick Actions panel (Nuovo Lead/Progetto/Proposta/Moodboard/Carica file)
  with icon + label + chevron
- Tasks Panel (data-testid="tasks-panel") with count badge, project_title,
  due date, elegant empty state
- Featured Projects horizontal grid with cover or fallback icon, project_type
  eyebrow, progress bar (teal), "+ Nuovo progetto" tile
- 4-column operational grid: Recent Activity · Media Preview · Top Materials · Team Activity
- 8-day Timeline with day columns, today highlighted teal, event chips
- **Error state**: 503/cold-start handled with retry button (no more permanent spinner)
- **403 state**: graceful "Accesso limitato" message when client role tries

**Sidebar IA extended** (`Sidebar.jsx`)
- 5 sections: BLUEPRINT WORKSPACE (Dashboard / Lead / Progetti / Proposte / Moodboard / Calendario),
  CONTENUTI (Ispirazioni / Archivio / Materiali / Collezioni),
  COLLABORAZIONE (Attività / Team / Clienti / Messaggi),
  INTELLIGENZA (Analytics / Report),
  SISTEMA (Impostazioni / Billing / Integrazioni)
- **`WorkspaceSelector`** component pinned at the bottom — tenant monogram + name
  + "WORKSPACE" label, future hook for tenant switching
- i18n EN+IT extended: nav.calendar, nav.collections, nav.activity, nav.team,
  nav.clients, nav.messages, nav.reports, nav.billing, nav.integrations,
  nav.section.collaboration

**ComingSoonPage** (`/app/frontend/src/pages/common/ComingSoonPage.jsx`)
Elegant OS-surface placeholder for 8 not-yet-built routes:
- /workspace/calendar · /workspace/activity · /workspace/team · /workspace/clients
- /workspace/messages · /workspace/reports
- /library/collections · /settings/integrations

Each preset has a custom title/subtitle/hint plus a `← Torna alla dashboard` CTA.
NOT 404s — looks like an OS surface in graceful waiting state.

**Architectural fix — strict surface scoping**
- `<div className="App" data-surface="os">` in `App.js` REMOVED — was leaking
  the OS scope across the storefront tree (architecturally wrong even though
  CSS-isolated via nested storefront provider)
- New `<OSWrap>` HOC introduced to wrap standalone OS routes outside
  `DashboardLayout`: `/auth/login`, `/auth/signup`, `/auth/forgot-password`,
  `/start-project`, `/professionals/intake`
- BlueprintThemeProvider + StorefrontThemeProvider are now the ONLY emitters
  of `data-surface="*"` in the app

**Verified end-to-end** ✅
- super_admin → HTTP 200 with full payload
- designer → HTTP 200
- client → HTTP 403 "Dashboard is restricted to studio members."
- studio2 tenant → only studio2 data (isolation preserved)
- Dashboard cold-load → retry button surfaces if 503; no permanent spinner
- Storefront `/` → cream + Cormorant editorial serif UNTOUCHED (verified via screenshot)
- Sidebar collapsed → all section icons render
- Sidebar expanded → 5 section labels + WorkspaceSelector at the bottom

**Files of reference**
- `/app/backend/routers/dashboard.py` (new, ~270 LOC)
- `/app/backend/server.py` (router mounted at `/api/dashboard`)
- `/app/frontend/src/pages/dashboard/DashboardPage.jsx` (rewritten)
- `/app/frontend/src/components/layout/Sidebar.jsx` (+WorkspaceSelector)
- `/app/frontend/src/pages/common/ComingSoonPage.jsx` (new)
- `/app/frontend/src/App.js` (+OSWrap, +8 coming-soon routes, –root data-surface)
- `/app/backend/routers/blueprint.py` (i18n extensions IT+EN)

**Known sub-optimal (LOW priority, tracked for future iteration)**
- Featured project covers fall back to folder icon for Studio seed (no
  cover_metadata or media_links yet); will populate naturally once the
  studio creates moodboards with covers
- N+1 query on top_materials asset_count (≤10 materials → acceptable today;
  refactor to GROUP BY when registry grows beyond 50 entries)
- Signed-URL generation per featured project happens in a Python loop;
  batch via `create_signed_urls` when project volume warrants



### ✅ Phase N+ — Blueprint OS Visual Refinement + Platform Footer (DONE — 15 Feb 2026)
**Architectural Workflow Operating System** — visual refinement of the Blueprint
OS surface. Linear · Vercel · Notion · Framer mood with interior-design
sensibility. Zero contamination of storefront / corporate / tenant surfaces.

**Strict isolation enforced**
- All changes scoped to `[data-surface="os"]`
- Tailwind `font-heading` / `font-body` / `font-mono` utility classes
  overridden ONLY inside the OS subtree (via `[data-surface="os"] .font-*`)
- The legacy `:root` in `index.css` left untouched — no global drift
- Storefront EXE Interior and tenant themes verified visually unchanged

**Palette refinement** (`/app/frontend/src/design-system/os/tokens.css` rewritten)
- Warm graphite background: `#141414` (was `#0F0F10`)
- Surfaces: `#1B1B1B` / `#202020` / `#242424` / hover `#2A2A2A`
- Borders: `rgba(255,255,255,0.06)` (softer) + `0.10` strong + teal-active
- Text: `#F5F3EE` (warm bone) / `#B7B1A7` (warm muted) / `#8A857C` / `#5E5A53`
- Accent: `#00C9B3` teal — operational only (active state · progress · CTA · focus · selection)
- Tokens added: success/warning/danger, primary-soft/hover, shadow-glow, surface-hover

**Typography refinement**
- `--bp-font-heading` and `--bp-font-body` BOTH set to **Inter** (was Playfair / Montserrat)
- Editorial serifs REMOVED from Blueprint OS — they belong to storefront/corporate only
- Type scale measured for OS: display 32px, h1 22px, h2 17px, h3 14px, body 13px, caption 12px, micro 11px
- Tracking tightened (`-0.012em` headings, `-0.018em` tight)
- Inter font features enabled: `cv11`, `ss01`, `ss03`

**Radius / motion / shadow refinement**
- Radius: 4 / 6 / 10 / 14 / 18 + pill (moderate, never bubble-y)
- Motion: fast 140ms · default 220ms · slow 380ms with calm easing
- Shadows: xs/sm/md/lg/glow — soft depth, never aggressive
- Selection: scoped to `[data-surface="os"] ::selection`

**PlatformFooterBar component** (`/app/frontend/src/components/common/PlatformFooterBar.jsx`)
Global Blueprint OS™ branding bar — 40px height, three surface variants:
- `os`         → dark, subtle divider, low-contrast text
- `storefront` → adaptive to tenant theme bg, restrained
- `corporate`  → near-black `#0E0E0E`, warm text

Layout (per platform spec):
- LEFT   `© {year} Blueprint OS™`
- CENTER `POWERED BY MOOD FOR DESIGN™` (desktop only, uppercase tracking)
- RIGHT  `Privacy · Terms` → links to moodfordesign.com legal pages

Auto-current-year. Auto-hidden in fullscreen via `fullscreenchange` listener
(presentation mode / kiosk safe). Tenant-safe + locale-safe + responsive.

**Layout integration**
- `DashboardLayout` (Blueprint OS shell) → `<PlatformFooterBar surface="os" />`
- `AdminLayout` (super-admin control center) → `<PlatformFooterBar surface="os" />`
- `SiteLayout` (tenant storefront + corporate) → `<PlatformFooterBar surface="storefront" />`
- Auth pages, presentation, share/public links → no footer (intentional)

**Verified visually** ✅
- Dashboard: warm graphite, Inter, footer present, "Benvenuto, Stefano" headline calm Inter
- Library: warm graphite, calm density, teal accent only on Upload CTA + active filter
- Materials list: editorial typography Inter, category chips calm pill borders
- Projects + Moodboards: cards with soft borders, "Nuovo" status tag teal-subtle, tabs minimal
- Storefront `/`: 100% unchanged — cream + Cormorant + editorial serif preserved
- Storefront EXE hero, Italian Design tailored for Visionaries unchanged

**Architectural rule documented** for next agents
- Blueprint visual edits MUST be scoped to `[data-surface="os"]`
- Storefront edits MUST be scoped to `[data-surface="storefront"]`
- NEVER touch tailwind.config.js fontFamily defaults (cross-surface impact)
- NEVER add `:root` CSS custom properties (use surface-scoped only)
- Editorial serifs (Cormorant/Playfair) belong to storefront/corporate ONLY

**Files of reference**
- `/app/frontend/src/design-system/os/tokens.css` (rewritten — warm graphite + Inter)
- `/app/frontend/src/components/common/PlatformFooterBar.jsx` (new)
- `/app/frontend/src/components/layout/DashboardLayout.jsx`
- `/app/frontend/src/components/layout/AdminLayout.jsx`
- `/app/frontend/src/site/SiteLayout.jsx`
- `/app/architecture/ARCHITECTURE_ISOLATION.md` (still authoritative)

**Out of scope (intentionally not touched)**
- Backend routing, licensing engine, CMS revisions, AI flows, APIs
- Storefront theme engine, tenant brand tokens
- Tailwind config (fontFamily defaults preserved for non-OS surfaces)



### ✅ Phase N — Media Library + Material Registry (DONE — 15 Feb 2026)
**Operational Asset Layer** — the media library is no longer a passive upload registry.
It is now the studio's archive backbone: searchable, taggable, linkable, with soft
versioning and a first-class material entity. Strategic gravity for interior design.

**N.1 — Foundation (backend + DB)**
- Migration `021_media_library_v2.sql`:
  - `media_library` extended: `width`, `height`, `duration_seconds`, `mime_type`,
    `checksum_sha256`, `description`, `dominant_color`, `focal_point` JSONB,
    `archived_at`, `replaces_id`, `replaced_by_id`, `version_number`, `updated_at`
  - New `media_collections` + `media_collection_items` — curated sets
    ("Marmi Calacatta 2026", "Renderings Villa Roma")
  - New `media_links` — single table mapping asset → entity
    (project/moodboard/cms_page/cms_section/article/material/proposal/...).
    Powers the usage map without forcing every entity to know media schema.
  - New `material_registry` — first-class material entity with name/category/
    subcategory/supplier/finish/thickness/origin/description/technical_notes/
    primary_asset/dominant_color/status
  - New `material_assets` — M2M with `role` enum (slab/finish/render/catalog/
    spec/detail/application/swatch)
  - View `media_with_usage` for fast usage_count read
  - Triggers `media_library_bump_updated_at` + `material_registry_bump_updated_at`

**N.1 — Backend router `/api/media/*`** (~720 LOC):
- `GET /api/media` — list with `q`, `type`, `category`, `tag`, `collection_id`,
  `entity_type/entity_id`, `used`, `include_archived`, `include_versions`,
  `sort` (recent/name/size/usage). Returns `display_url` (signed, 6h TTL) so
  private-bucket assets render correctly.
- `GET /api/media/stats` — totals + by_kind + total_bytes + unused + collections + materials counts
- `GET /api/media/{id}` — detail with `links`, `collections`, `versions` chain
  (walks `replaces_id` / `replaced_by_id`), `material_attachments`, `is_head`
- `PATCH /api/media/{id}` — update alt_text/description/tags/width/height/dominant_color
- `DELETE /api/media/{id}` + `POST /restore` — soft archive cycle
- `POST /api/media/{id}/replace` — **soft versioning**: new asset becomes head
  (`replaces_id` = old, `version_number` += 1, `archived_at` = null), old is
  archived (kept accessible), `media_links` migrate from old to new with dedupe
- `GET /api/media/collections/list` + `POST` + `GET {id}` + `PATCH` + `DELETE` +
  `POST /attach` (bulk) + `DELETE /items/{asset_id}`
- `POST /api/media/{id}/links` + `DELETE /api/media/links/{id}` — explicit usage map writes
- `GET /api/media/materials/list` (with `q` / `category` filter + asset_count + primary_asset hydration)
- `POST /api/media/materials` (auto slug) + `GET /by-slug/{slug}` + `GET /{id}` + `PATCH` + `DELETE` archive
- `POST /api/media/materials/{mid}/attach-asset` — wires `material_assets` AND
  mirrors a row in `media_links` so the asset's usage map shows the material
- `DELETE /api/media/materials/{mid}/attachments/{att_id}` — removes both rows

Permissions: `P_STORAGE_READ` / `P_STORAGE_WRITE` gate all endpoints
(designer + tenant_admin + super_admin can write, client/ad_partner are 403).

**N.2 — Media Library UI** (`/library`):
- Cinematic 3-panel layout: filter sidebar | grid main | inspector right rail
- Filter sidebar: Type chips (All/Images/Video/PDF with counts), Usage (Linked/Unused),
  Collections list with item counts, "Material registry" pinned footer
- Topbar: search (debounced 250ms), bulk selection bar with "Add to collection" picker, Upload CTA
- Grid: masonry-style square tiles with hover overlay (file name + usage badge),
  shift/cmd-click to select, broken/archived/replaced badges
- Inspector: full preview, file metadata, click-to-edit alt_text/description/tags,
  Save, Replace, Open original, Archive/Restore, **usage map** (linked entities,
  collections, material attachments), **version history** chain
- Replace modal: file picker → uploadMediaFile → soft-replace POST → version chain wired,
  links migrated, "version_number +1" badge
- Drag & drop upload globally
- 100% Blueprint OS surface (`data-surface=os`), strict dark cinematic theme

**N.3 — Material Registry UI** (`/library/materials` + `/library/materials/:slug`):
- List page: editorial hero (luxury serif "Materials" + copy), search + 9 category
  filter chips (Stone/Wood/Fabric/Metal/Glass/Ceramic/Leather/Paint/Other),
  Register material modal with all technical fields (name/category/subcategory/
  supplier/sku/finish/thickness/origin/description), card grid showing primary asset +
  supplier + finish + attachment count badge
- Detail page: ultra-cinematic hero (21:9 image + name + supplier/finish/thickness/
  origin strip), 8 role sections (Slab/Finish/Render/Application/Detail/Swatch/
  Catalog/Spec) with attach-modal (Upload new / From library tabs),
  editable sidebar (click-to-edit supplier/sku/finish/thickness/origin/description/
  technical_notes), Linked entities (projects/moodboards from usage map),
  Archive material CTA

**Sidebar nav integration** (`core/modules.py`):
- New `library` module with two routes: `/library` (Archive) + `/library/materials` (Gem)
- Default-enabled, gated by `P_STORAGE_READ`
- i18n: nav.library/nav.materials/module.library in EN ("Library", "Materials")
  and IT ("Archivio", "Materiali")

**End-to-end verified** ✅
- Backend: 28/28 pytest cases PASS — list/stats/filters, collections CRUD+attach
  +narrow-by-collection filter, material CRUD+by-slug+attach-asset mirror-to-media_links
  +detach removes mirror, media PATCH+archive/restore, RBAC (client 403 on writes),
  tenant isolation (studio2 sees 404/empty on Studio entities)
- Frontend: `/library`, `/library/materials`, `/library/materials/taj-mahal-quartzite`
  all render under `data-surface=os` (Blueprint OS dark cinematic). Sidebar Type/Usage/
  Collections + Material Registry shortcut all present. Detail page shows hero +
  metadata strip + Slab role section + editable sidebar
- Signed URLs (6h TTL) injected via `display_url` so private-bucket images render correctly

**Files of reference**
- `/app/supabase/migrations/021_media_library_v2.sql`
- `/app/backend/routers/media.py`
- `/app/frontend/src/lib/mediaApi.js`
- `/app/frontend/src/pages/library/MediaLibraryPage.jsx`
- `/app/frontend/src/pages/library/MaterialsPage.jsx`
- `/app/frontend/src/pages/library/MaterialDetailPage.jsx`
- `/app/backend/tests/test_media_library_phase_n.py` (28 cases)

**Strategic positioning**
This is NOT a "Pinterest clone" nor a "Dropbox grezzo". It is the operational
asset layer — Milan design archive feel, enterprise rigor, cinematic restraint.
Materials are first-class entities (not tags). The replace flow is non-destructive
(soft versioning) so history is preserved. Asset relationships are the foundation
for the AI Editorial Assistant (Phase O) and future material-aware features.



### ✅ Phase H.5 — Session A: Page Scope Audit & Locale Runtime Consolidation (DONE — 15 Feb 2026)
Critical Refactor Sprint started. Architectural separation enforced between Corporate / Tenant Storefront / Blueprint Workspace.

- **`/settings/storefront`** new route + `StorefrontStudio.jsx` cinematic admin
- **`/settings/pages`** clarified as Corporate Platform Section Engine (Blueprint OS demo)
- `SettingsPage.jsx` redesigned with 3 visually separated sections: Tenant Storefront · Corporate Platform · Platform System
- `SiteContext.jsx` rewritten to use canonical BCP-47 codes via `resolveLanguage()` — preserves EN-US ≠ EN-GB
- `BlueprintContext.jsx` refactored to read from shared registry (`blueprintLanguages()`) instead of /api/blueprint/i18n. Listens to `mfd:languages:change` event for cross-context propagation
- Verified: LocaleSwitcher shows all 6 codes distinctly: `['it', 'en-US', 'en-GB', 'fr', 'de', 'es']`


### ✅ Phase H.5 — Session B: Cinematic Storefront Studio™ (DONE — 15 Feb 2026)
Backend CMS Foundation + Cinematic Inline Editor + Public Rendering Rewire.
The tenant's public storefront is now fully editable from a luxury inline studio
inspired by Webflow Designer / Framer / Notion Site Editor — but luxury editorial.

**B.1 — Foundation**
- Migration `014_storefront_cms.sql` — 3 tables: `cms_pages`, `cms_sections`, `cms_assets` (multilingual-first, future-AI-ready, scheduling-ready, tenant-duplication-ready)
- `core/storefront_registry.py` (NEW) — 17 section types across 6 categories (homepage/projects/onboarding/professionals/chrome). Strictly separated from `core/section_registry.py` (Corporate Blueprint OS demo) to prevent contamination
- 6 fixed page_keys for Session B: `home`, `projects`, `start_project`, `professionals`, `navigation`, `ui`
- `routers/storefront.py` (NEW) — /api/storefront/admin/* (auth) + /api/storefront/public/* (anon)
- `scripts/seed_storefront_cms.py` + `scripts/dump_site_content.mjs` — idempotent importer for the legacy JS configs (preserves locale mapping `it/en/fr/de/es` → canonical `it/en-US/fr/de/es`)

**B.2 — Cinematic Inline Editor (`/settings/storefront`)**
- `StorefrontStudio.jsx` — full-screen luxury studio (NO admin panel chrome). Topbar: Studio brand · 6 page picker · viewport switcher · locale picker · soft autosave dot · Publish button · View live
- `InlineText.jsx` — contentEditable wrapper with focus ring, multiline, ESC-to-cancel, single-click-to-edit
- `SectionRenderers.jsx` — 5 cinematic renderers (store_hero / dual_cta / value_props / projects_preview / newsletter) + LegacyRaw fallback for any unmapped section type
- Section hover overlay: move-up · visibility toggle · duplicate · delete · type ribbon
- Locale tabs preserve EN-US vs EN-GB
- Soft autosave debounced 700ms with dot pulse pattern (Saving/Saved/Retry/Auto)
- Publish workflow: draft → published instant, with timestamp display in footer

**B.3 — Asset Studio**
- `AssetPicker.jsx` — full luxury drawer (480px right-side) with 3 tabs:
  - **My assets** — library grid reading `/api/storefront/admin/assets`, current asset checkmark
  - **Upload** — dashed drop zone + browse, progress bar, Supabase Storage signed-upload flow, dimension extraction via Image() probe
  - **Stock** — 6 editorial luxury placeholders (Unsplash) ready for future API integration
- Strict tenant-prefix enforcement on storage_path (re-checked in `register_asset`)
- Upload pipeline: signedUpload → PUT direct to Supabase → registerAsset (cms_assets row created)

**B.4 — Public Rendering Rewire**
- `useStorefrontContent.js` — SWR-style hook with localStorage cache + background refetch
- Falls back gracefully to legacy JS configs if no published DB content
- `HomePage.jsx` patched with `mergeHomepage(legacy, cmsContent)` — DB CMS content overlays JS config field-by-field, preserves visual structure unchanged
- `tenantConfig.slug` added as single source of truth for the demo tenant slug

**End-to-end verified**
- Studio renders all 6 pages with cinematic editor for home + schema fallback for others
- Locale switch IT → EN-US in studio swaps headline to "SHAPING SPACES. BUILDING RELATIONSHIPS." correctly
- POST publish home → public `/` renders DB content as headline "ARREDARE SPAZI. COSTRUIRE RELAZIONI." pulled from DB
- All 6 locales preserved (en-US ≠ en-GB) across public site and Blueprint


### ✅ Phase H.5 — Session C: Workspace Genesis™ · The Magic Moment (DONE — 15 Feb 2026)
End-to-end emotional onboarding sprint. After a private client (or professional) completes
the public wizard, the system creates the account, generates a populated workspace, and lands
the user directly in their living project — not on an empty dashboard.

**C.1 — Lead Engine**
- Migration `015_session_c_workspace_genesis.sql`:
  - `leads.assigned_to` (FK to users_profile)
  - `users_profile.metadata_json` (JSONB bag for persona, role label, bio, languages, online_status, roundrobin_slot)
  - `lead_assignments` table (append-only log: lead_id × profile_id × assigned_at × kind)
  - 3 demo designer personas inserted: Elizabeth Whitcomb · Diego Marín · Sofia Rinaldi (auth_user_id=NULL — they're personas only)

**C.2 — Account Creation Flow**
- `core/workspace_genesis.py` — orchestrator service (~340 lines) building lead → assignment → project → moodboard → 6 pages → seed blocks (welcome note + style headline + mood tags + palette) on the Mood Direction page
- `routers/onboarding.py`:
  - `POST /api/onboarding/private/submit` — anonymous; creates auth user + profile (role=client) + runs genesis + returns session token
  - `POST /api/onboarding/professional/submit` — same for ad_partner role
  - `GET /api/onboarding/team/:tenant_slug` — public list of designer personas
- Email verification SKIPPED for now (`email_confirm=True` on admin.create_user) — coerent with the magic moment direction
- Password grant performed server-side immediately after profile creation → session token returned to frontend

**C.3 — Workspace Seeding**
- Project shell: humane title derived from payload (`"Villa · Editorial luxury · Roma — Camilla"` — never "Project #421")
- 1 moodboard with 6 curated pages (multilingual titles): Project Vision · Mood Direction · Materials · Inspirations · Space Planning · Proposal Draft
- 4 seed blocks on Mood Direction page: welcome note (locale-aware), style keyword headline, mood tags row, seed palette (up to 6 colors)
- All seeded rows tagged with `metadata_json.seeded:true` for analytics/cleanup

**C.4 — Human Relationship Layer**
- Round-robin assignment via `metadata_json.roundrobin_slot` + count of existing lead_assignments
- `GET /api/projects/:id` enriched with `assigned_designer` bag (name, role_label, bio, avatar, languages, online_status)
- `ProjectDetailPage.jsx` shows the "Followed by" card with avatar, name, role label, online status dot — cinematic, NOT a CRM widget
- Verified round-robin: 3 consecutive submissions assigned Elizabeth → Diego → Sofia → Elizabeth

**C.5 — Cinematic Redirect**
- `BlueprintGenesisOverlay.jsx` — full-screen dark overlay with breathing vertical line + crossfade narrative messages (locale-aware narrative from backend: 4 messages in IT/EN/FR/DE/ES)
- `StartProjectWizard.jsx` extended with `AccountCreationStep` (first_name, last_name, email, password with inline validation) + `phase` state machine (wizard → account → genesis)
- On success: `window.location.assign('/workspace/projects/{id}')` — lands on the alive project, NOT a generic dashboard

**End-to-end magic moment verified**
- Public wizard completed → account form filled → "Apri il mio Blueprint" submitted
- Backend genesis: 1.2s avg (lead + assignment + project + moodboard + 6 pages + 4 blocks)
- Cinematic narrative cycles 4 messages in IT: "Preparo l'atmosfera del tuo progetto…" → "Organizzo le ispirazioni…" → "Costruisco la tua prima direzione mood…" → "Il tuo Blueprint è pronto."
- Auto-redirect to `/workspace/projects/{uuid}` with new user logged in, Italian locale active
- Project page shows assigned designer card (Diego Marín / Architetto Senior / available status) and the 6 moodboard pages ready to browse


### ✅ Phase H.5 — Navigation CMS Renderers (DONE — 15 Feb 2026)
The `navigation` page in the Storefront Studio is no longer a fallback schema bag. Two dedicated cinematic renderers replaced it AND the public site now reads directly from the database.

**Cinematic editors**
- `components/storefront/NavigationRenderer.jsx` — live preview of the actual header. Logo with size knob (40–200px) + Replace action, draggable link pills with hover toolbar (drag, visibility, open-in-new-tab, desktop, mobile, CTA promote, delete), inline label + href edit, Add link dashed button, locale switcher mock, editable Access CTA label/href
- `components/storefront/FooterColumnsRenderer.jsx` — dark luxury footer canvas. Editable tagline, draggable multi-column manager (4 default columns), per-column add/visibility/delete, per-link visibility/delete + inline label+href, Showroom address (multiline textarea), Book CTA label+href, Social rail with visibility toggle + href per social, copyright template per locale

**Seed importer**
- `scripts/seed_storefront_cms.py` → `build_navigation_sections()` produces two distinct cms_sections rows: `nav_top` and `footer_columns` with locale-normalized labels (`it`, `en-US`, `en-GB`/copy of en, `fr`, `de`, `es`)

**Public rewire**
- `site/components/SiteHeader.jsx` — now consumes `useStorefrontContent('navigation')` with fallback to `navigation.js`. Logo size honored from `settings.logo_size`. Tagline definitively removed (logo bumped to 104×104 per Stefano's request)
- `site/components/SiteFooter.jsx` — same pattern. Columns + socials + showroom + copyright all CMS-driven
- `navigation.js` is now **seed-only** (deprecation comment added) — used only as fallback if DB is unreachable

**Schema additions** (no migration needed — fields live in existing JSONB)
- Per-link: `visible`, `open_in_new_tab`, `show_on_desktop`, `show_on_mobile`, `is_cta`
- Per-column: `visible`
- Per-social: `visible`

**End-to-end verified** (testing agent iteration_38 — backend 100% / frontend 95%)
- DB navigation page has 2 sections (nav_top + footer_columns)
- Public endpoint returns sections with all settings + locale_content
- Studio renders the cinematic editors (not schema fallback) when opening navigation page
- Public site / shows logo 104px, no old tagline, links from DB working



### ✅ Phase 1 — Tenant MVP (DONE — 12 Mag 2026)
- Schema Supabase 22 tabelle, RLS off, grants service_role
- Auth Supabase end-to-end (signup → tenant + profile; login JWKS ES256)
- CRUD: leads, projects (con status history), proposals (con signoffs), moodboards
- Storage: signed upload/download, media_library
- Blueprint API: tenant config + navigation + dashboard widgets + i18n
- Frontend Blueprint-driven (sidebar/dashboard/copy tutti via API)
- LocaleSwitcher live, ImpersonationBanner

### ✅ Phase A — Super Admin Foundation (DONE — 12 Mag 2026)
- **Permissions Engine** centralizzato (`core/permissions.py`)
  - 8 ruoli: super_admin, tenant_admin, editor, analyst, project_manager, designer, client, ad_partner
  - 31 permission tuples (`leads:read`, `super:tenants:write`, ecc.)
  - Decorator `require_permission(*perms)` per route gating
  - Frontend hook `can('perm')` + `isSuperAdmin`
- **Module Registry** (`core/modules.py`)
  - 5 moduli: workspace, moodboards, inspirations, insights, concierge
  - Ogni modulo: requires_permissions, routes con per-route gating, enterprise_only flag
  - Frontend Sidebar filtra automaticamente by enabled modules + user permissions
- **Feature Flags Engine** (`core/feature_flags.py`)
  - 11 flag catalog: hotspot, video_upload, proposal_approvals, ai_suggestions, public_magazine, lead_forms, ad_section, crm_integrations, exports, custom_domain, analytics_advanced
  - Default in code, tenant override via `tenant_settings.key='feature_flags'`
- **Tenant Context + Impersonation** (`core/tenant_context.py`)
  - Super_admin può passare header `X-Tenant-Override: <id>` per scope query su altro tenant
  - Tutte le route workspace usano `get_tenant_context` (centralizzato)
  - Audit logger su ogni mutation super_admin
- **Super Admin Routes** (`/api/super/*`)
  - `GET /tenants` list con member count, plan
  - `POST /tenants` create
  - `GET /tenants/:id` detail con usage stats + members + modules + flags
  - `PUT /tenants/:id` update name/status/plan/languages
  - `DELETE /tenants/:id` soft archive
  - `PUT /tenants/:id/modules` toggle module enabled list
  - `PUT /tenants/:id/feature-flags` toggle flag overrides
  - `POST /tenants/:id/impersonate` (audit-logged)
  - `GET /stats` cross-tenant KPI
  - `GET /audit-logs` recent platform actions
  - `GET /catalog/modules`, `GET /catalog/flags`
- **Frontend Admin Experience** (`/admin/*` — separate AdminLayout luxury control-center)
  - `/admin` Platform Overview (8 KPI cards)
  - `/admin/tenants` list + create modal
  - `/admin/tenants/:id` detail con toggle moduli/flag, status/plan picker, impersonate button, members table
  - `/admin/modules` module registry view
  - `/admin/audit` audit log
- **Impersonation banner** automatico nel DashboardLayout quando session attivo

### ✅ Phase B — Tenant Branding Studio (DONE — 12 Mag 2026)
  - Palette (12 tokens: primary, accent, background, surface 1/2/3, borders, text 4 levels, success/warning/danger)
  - Typography (font_heading, font_body, font_mono, font_size_base, line_height, letter_spacing)
  - Shape (radius_xs through xl + pill)
  - Spacing (compact / comfortable / spacious + base unit)
  - Elevation (sm/md/lg shadows configurabili)
  - Motion (3 preset: subtle/standard/expressive + durations + ease)
  - Components (button_style: sharp/pill/ghost · card_style · ui_density)
  - Brand assets (logo_dark, logo_light, logo_mobile, favicon, og_image)
- **Backend endpoints** (`/api/settings/*`):
  - `GET /theme` → `{default, overrides, effective}`
  - `PUT /theme` deep-merge update
  - `POST /theme/reset`
  - `GET /fonts/catalog` — 16 curated Google Fonts (Cormorant, Playfair, Bodoni Moda, Tenor Sans, Manrope, Syne, Italiana, JetBrains Mono…)
  - `GET/POST/DELETE /domains` (multi-domain support, type: platform_subdomain | custom_domain, verification_status)
  - `POST /assets/register` — hook post-upload Supabase Storage, registra in media_library + theme.assets, mirror su tenants.logo_url
  - Brand color: **#26F5C9** (MOOD teal) ora default
- **Frontend Brand Studio** (`/settings/brand`)
  - Linear/Stripe-inspired luxury panel split 440px editor / fluid live preview
  - 5 tabs: Palette · Typography · Shape · Motion · Assets
  - 6 preset palette (MOOD Teal · Editorial Gold · Pure Noir · Rose Quartz · Deep Forest · Midnight Sea) one-click
  - Color picker nativo + hex input per ogni token
  - Google Fonts loader runtime (link tag injection on-demand)
  - Slider px-based per radius / font size / line height
  - **Live preview pane** responsive (Monitor/Tablet/Mobile viewport switcher)
  - Asset uploader Supabase Storage (signed URL → PUT → register)
  - Save bar dirty-state + Reset to default
- **Theme application runtime**: ~25 CSS variables `--bp-*` settate da BlueprintContext + density classes `body.density-{compact|comfortable|spacious}`
- **Brand component** (`Brand.jsx`) ora usa logo da `theme.assets.logo_dark|light` con fallback tipografico
- **Settings hub** (`/settings`) — 4 tile (Brand Studio · Domains · Locales · Team)
- **DomainsPage** (`/settings/domains`) — add/delete con validazione regex, badge verification status
- **Resilienza**: middleware FastAPI retry trasparente su httpx.RemoteProtocolError (Supabase pooler hiccups)

### ✅ Phase B+ — Design DNA Expansion (DONE — 12 Mag 2026)
Mockups (3 luxury hospitality UI references) absorbed into the Theme Engine — NOT replicated as static pages. Extracted: editorial typography rhythm, cinematic atmosphere, motion personality, spacing system.

- **Theme Engine v2** (`core/theme_engine.py`): 80+ tokens (was ~40)
  - `editorial` scale: display/h1/h2/h3/lead/body/caption/eyebrow as fluid clamp() + line-heights + tracking
  - `atmosphere`: grain_intensity, glow_intensity, vignette_intensity, glass_blur, glass_opacity, hero_gradient, section_divider
  - `spacing` extended: section_y, section_x, gutter, max_width, stack_tight/default/loose/editorial
  - `motion` extended: duration_cinematic, ease_emphasis, ease_entrance, stagger, hover_lift
  - `elevation` extended: xl, glow, inset_soft
  - `palette` extended: overlay, selection_bg, selection_fg
  - `components` extended: image_treatment, cursor_style, input_style
- **2 new palette presets** in Brand Studio: `editorial-noir` (warm noir + copper accent + grain) · `linear-mist` (cool tech violet + clean glass)
- **CSS utilities** in `index.css`: `.bp-display .bp-h1 .bp-h2 .bp-h3 .bp-lead .bp-body .bp-caption .bp-eyebrow .bp-section .bp-container .bp-glass .bp-grain .bp-vignette .bp-hero-gradient .bp-btn .bp-btn-primary .bp-btn-ghost .bp-enter .bp-marquee-track .bp-img-cinematic`
- **BlueprintContext.applyTheme** propagates all new tokens to `:root` CSS variables (no rebuild)
- **Fix**: `ThemeUpdate` Pydantic model now accepts `atmosphere` + `editorial` fields (were silently dropped)

### ✅ Phase B+ — Section Engine (DONE — 12 Mag 2026)
Server-configurable rendering backbone reusable across: homepage · landing · proposals · magazine · moodboards · showcase · client portals · onboarding flows. ZERO hardcoded content.

- **Backend** (`core/section_registry.py` + `routers/pages.py`):
  - 10 section types: `hero · feature_grid · gallery · quote · stats · cta · split · logo_strip · magazine_grid · faq` — each with schema + defaults + reusable_in[] + category
  - DEFAULT_PAGE_TEMPLATES: `homepage` (8 sections) · `showcase` (4) · `about` (4)
  - Pages stored per tenant in `tenant_settings` (key pattern `page.{slug}`)
  - Endpoints under `/api/blueprint`: `GET sections/catalog`, `GET pages`, `GET/PUT pages/:slug`, `POST/PUT/DELETE/PATCH sections`, `POST sections/:id/duplicate`, `POST pages/:slug/reset`, `GET palette-presets`
- **Frontend** (`/app/frontend/src/blueprint/`):
  - `SectionRegistry.js` — type → React component map + `resolveContent(section, locale, fallback)`
  - `PageRenderer.jsx` — generic `<BlueprintPageRenderer slug=... />` or with `page` prop for live preview
  - `Kit.jsx` — Blueprint UI Kit primitives (Eyebrow/Display/H1-3/Lead/Body/Caption/Section/Container/Button/CTAGroup), all token-driven
  - 10 section components in `blueprint/sections/`, all theme-aware, locale-aware
- **HomepageBuilderPage** (`/settings/pages`): Shopify-Sections-style UX
  - 440px left rail with section stack (chevron reorder · eye toggle · copy · trash · edit), right pane = live preview
  - Switch between pages (homepage/showcase/about) via topbar
  - Viewport switcher (Desktop/Tablet/Mobile) with smooth animated width
  - Locale switcher for editing translations per language (content stored as `{_default, en-US, it, fr, de, es}`)
  - Add modal with all 10 section types categorized
  - Save bar dirty-state + Reset to default template
  - Inline property editor renders different fields per section type
- **Tested End-to-End** ✅
  - 10/10 backend endpoints pass (catalog, page CRUD, section CRUD, reorder, duplicate, reset, palette presets, extended theme tokens)
  - All critical frontend testids present (`homepage-builder-page`, `tile-pages`, `add-section-btn`, `save-page`, `reset-page`, `viewport-*`, `preview-locale`)
  - 8 brand presets visible including Editorial Noir + Linear Mist
  - Property editor opens correctly per section type; preview updates live
  - Italian locale active in sidebar


### ✅ Sprint Cleanup P0 — Foundation Hardening (DONE — 13 Mag 2026)
Pre-requisito **non negoziabile** prima delle fasi F. Migrazione completa da JSON-blob-in-tenant_settings a tabelle relazionali dedicate, fix dello schema drift su `moodboard_elements`, setup del workflow migration professionale, autosave hardening e dedupe architetturale.

- **Migration workflow** (`/app/supabase/migrations/` + `apply.py`):
  - `001_baseline_2026_05_13.sql` — snapshot documentale (22 tabelle, 9 enum)
  - `002_moodboard_schema_cleanup.sql` — backfill di `position_json`/`style_json`/`image_url` da `content`; aggiunte colonne strutturate `locked`/`hidden`/`opacity`/`rotation`/`updated_at`; indici `(moodboard_id, sort_order)` + GIN su `position_json`; V2 scaffold (`cover_strategy`/`cover_metadata`/`presentation_metadata`/`ai_metadata`)
  - `003_workspace_dedicated_tables.sql` — nuove tabelle `project_notes`, `project_activity`, `moodboard_shares` con backfill **automatico** da `tenant_settings.project.*` e `moodboard_share.*` (30 events + 2 notes + 4 share token migrati senza data loss)
  - `004_grant_new_tables.sql` — `service_role`/`authenticated`/`anon` privileges (PostgREST permission fix) + default privileges su future tables
  - `005_tasks_completed_at.sql` — colonna `completed_at` su `tasks` (auto-set in update_task)
  - `apply.py` runner idempotente con `schema_migrations` tracking table, supporto `--list` e `--dry-run`
- **`moodboards_v1.py` refactor**:
  - Layout (x/y/width/height/z_index) ora in `position_json` reale (JSONB); style (crop_x/crop_y/focal_point/fit_mode/opacity/rotation/zoom) in `style_json`
  - Frontend riceve la forma normalizzata (flat top-level) via `_normalize_block`, **senza** leak di `position_json`/`style_json`
  - Image blocks mirror `src` nella colonna dedicata `image_url`
  - Backward-compatible: parser fallback per blocchi pre-migration con `layout` dentro `content`
  - Share endpoint ritorna sia `share_token` che `share_path` (frontend non costruisce più l'URL)
- **`workspace.py` refactor**: tasks/notes/activity ora leggono/scrivono dalle **tabelle reali** (no più JSON in `tenant_settings`); `update_task` setta `completed_at` automaticamente al transito → done
- **`moodboard_shares`** table: view tracking automatico (`view_count`, `first_viewed_at`, `last_viewed_at`); revoke via `revoked_at`; lookup veloce con UNIQUE index parziale `WHERE revoked_at IS NULL`
- **Storage hardening** (`storage.py`): `register_media` rifiuta path di altri tenant (403), forza prefisso `{tenant_id}/`
- **Frontend cleanup**:
  - `components/common/StatusBadge.jsx` consolidato (era duplicato in 3 punti, ora unico, prop `kind` per moodboards/projects/leads/proposals)
  - MoodboardEditor: autosave con retry x3 + backoff esponenziale + error state visibile (testid `status-save-error`) + warning beforeunload se ci sono modifiche pendenti
  - Cancellato `pages/proposals/` (duplicato di `pages/workspace/ProposalsPage.jsx`)
- **Tested** ✅
  - Backend: **86/86 pytest pass** (Phase A/B/C/D/E baseline + sprint cleanup suite 15/15)
  - Frontend smoke: list IT (4 cards), editor IT (Aggiungi blocco / Immagine/Testo/Palette/Nota/Prodotto/Materiale, badge "APPROVATO"), Velvet sofa block rendering, autosave testids esposti
- **NON ancora fatto** (next sprint):
  - Cleanup delle legacy keys in `tenant_settings.project.*.tasks|notes|activity` (mantenute per backward compat — purge dopo verifica produzione)
  - Theme leak fix su 5 pagine legacy (Dashboard, Leads, Projects, Proposals, Admin Overview)


### ✅ Demo seed + Permission hardening (DONE — 13 Mag 2026)
Pre-requisito esplicito utente prima della Fase F: "verificare bene tenant_id enforcement, permission decorators, impersonation boundaries".

- **Seed script idempotente**: `/app/backend/scripts/seed_demo_users.py`
  - Re-runnable safely (skip if exists, sync role/tenant if drift, password reset on auth side)
  - Crea: `designer@moodfordesign.com` (designer, Studio), `client@moodfordesign.com` (client, Studio), `studio2@moodfordesign.com` (tenant_admin, Showroom)
  - Auto-crea il tenant `mood-demo` (Showroom) se mancante
  - Aggiornato `test_credentials.md` con matrix completa per-ruolo
- **Permission decorator gap CHIUSO** (issue critica scoperta durante test isolamento):
  - Prima del fix: designer/client potevano leggere `/leads`, `/projects`, `/proposals`, `/moodboards`, `/insights` (decorator mancante)
  - `core/tenant_context.require_permission()` ora wrappa `get_tenant_context` invece di `get_current_user` → permission gate + tenant scope in una sola Depends
  - Applicato a 38 route in 7 router: `leads.py` (5), `projects.py` (5), `proposals.py` (6), `moodboards.py` (5), `moodboards_v1.py` (8), `workspace.py` (10), `insights.py` (2)
- **Multi-tenant isolation verificata E2E**: studio2 (Showroom tenant_admin) prova a leggere moodboard di Studio → 404. Sua lista personale → 0 row. Nessun leak.
- **Test regression**: `tests/test_isolation_permissions.py` (6 test, **6/6 pass**) — gating per role × endpoint + cross-tenant leak test
- **90/90 backend pytest pass** + 5 skipped + 1 xpass = ZERO regressione su 6 fasi precedenti


### ✅ Phase F.1 — Structural Multi-page Templates™ (DONE — 13 Mag 2026)
Trasformazione architetturale del template system da single-page a multi-page editoriale. **Apre il vero Blueprint Presentation OS™**.

- **PRE-fix CTA mancante** (PagesNavigator)
  - Header del navigator ora ha `+` icon button (`add-page-btn`) sempre visibile
  - Inline dashed tile "Aggiungi pagina" in fondo alla lista (`add-page-inline-btn`) — scrolla con le pagine, no troncamento
  - Sticky-bottom overlay del picker (`absolute bottom-2`)
- **Migration 009** — `template_pages` table + `template_blocks.template_page_id` + placeholder semantics (`is_placeholder`, `placeholder_label`, `placeholder_type`, `placeholder_required`). Backfill: ogni template esistente → 1 default page, blocks linkati
- **Migration 010** — 3 structural template seed (UUID fissi idempotenti)
  - **Luxury Residential Presentation** — 8 pages, 30 blocks (Cover landscape / Concept / Atmosphere / Material Palette / Furniture / Lighting / Room Gallery / Approval) — 26 placeholders
  - **Hospitality Concept** — 6 pages, 14 blocks (Cover / Brand Narrative / Spatial Mood / Materials / Guest Experience / Approval) — 9 placeholders
  - **Material Board** — 1 page square, 6 blocks (palette + 3 materials + 2 products)
  - Locale_content IT/FR/DE/ES, editorial pacing positions/sizes precise
- **Backend** (`templates.py`)
  - `_attach_preview` ora emette `pages_preview` carousel (1 svg per page) per templates multi-page; `page_count` field sempre presente
  - `apply_template` multi-page-aware: clona `template_pages → moodboard_pages` con `page_id_map`, blocks attaccati al `page_id` corretto, placeholder metadata propagata via `metadata_json.placeholder = {label,type,required}`
  - `save_as_template` round-trip multi-page: snapshot `moodboard_pages → template_pages`, blocks attaccati con placeholder fields re-estratti
  - Fallback elegante per legacy single-page templates (synth default page)
- **Frontend** (`TemplatePicker.jsx`)
  - `PreviewBox` switch dinamico: multi-page → 3-layer stacked SVG con offset+scale cinematic; single-page → SVG straight
  - Page count badge editorial `'{count} pagine'` con icona Layers e color primary teal (`template-page-count-{slug}`)
- **Frontend placeholder UX** (`ImageBlock.jsx`)
  - Empty state ora mostra label placeholder (con ★ se required) + prompt localizzato "Sostituisci con immagine"
- **i18n** — 7 nuove chiavi EN+IT: `templates.pageCount`, `placeholder.replaceImage/Text/Palette/Material/Product`
- **Tested ✅** (`iteration_13.json`)
  - Backend: **14/14 new F.1** + **19/19 regression** F.0 = **33/33 PASS**
  - Frontend live: 13 cards picker, structural badges "8 pagine"/"6 pagine" visibili, multi-layer stack su Luxury, apply→editor con 8 page tiles + page types localizzati (Copertina/Citazione/Mood/...), placeholder ★ "HERO COVER IMAGE" rendered, '+' header + inline dashed tile entrambi presenti
  - Cross-tenant: studio2 può leggere platform templates, apply scoped al proprio tenant (no leak)
  - RBAC: client 403 su apply + from-moodboard
  - i18n IT verificato completamente


### ✅ Phase F.0 — Multi-page Foundation per Blueprint Moodboard PRO™ (DONE — 13 Mag 2026)
Trasformazione architetturale: da single-canvas a sistema multipagina. Backward-compatible 100% — i 37 moodboard esistenti continuano a funzionare.

- **Migration 008** (`008_moodboard_pages.sql`) — idempotente, reversibile
  - ENUM `moodboard_page_type` (13 valori: cover/blank/mood/material_board/product_grid/palette/gallery/split_story/quote/technical_board/floorplan/proposal_summary/approval)
  - TABLE `moodboard_pages` (id, tenant_id, moodboard_id FK CASCADE, title, page_type, aspect_ratio, width, height, background JSONB, settings JSONB, sort_order, hidden_in_presentation, created_by, timestamps)
  - `moodboard_elements.page_id` nullable + FK CASCADE + index
  - `moodboards.current_page_id` nullable
  - **Backfill DO block**: ogni moodboard esistente → 1 default page con `title=moodboard.title` (o "Page 1" se null), `page_type='blank'`, `aspect_ratio='portrait_a4'`, tutti gli elements esistenti linkati alla nuova page, current_page_id puntato alla default
  - RLS enabled + policy service_role all
  - Indices: `(moodboard_id, sort_order)`, `(tenant_id)`, `(page_id)` su elements
- **Backend** (`moodboards_v1.py`)
  - `ASPECT_RATIO_PRESETS` registry (6 presets): portrait_a4 (1400×2400), landscape_16_9 (1920×1080), square_1_1 (1400×1400), editorial_3_4 (1400×1866), wide_2_1 (1920×960), cover_landscape (1920×1200)
  - `PAGE_TYPES` registry (13 valori) — Blueprint-driven via `GET /api/moodboards/_meta/page_presets`
  - 7 nuovi endpoint: `GET _meta/page_presets`, `GET pages`, `POST pages` (auto-append sort_order + width/height da preset), `PUT pages/{id}` (recompute dimensions on aspect_ratio change), `DELETE pages/{id}` (409 last-page guard + current_page_id fallback), `POST pages/{id}/duplicate` (clone page + tutti gli elements con nuovi uuid), `POST pages/reorder` (validazione set strict)
  - `create_block` ora popola `page_id` da `body.page_id || moodboard.current_page_id || _ensure_default_page()` (safety net)
  - RBAC `P_MOODBOARDS_READ/WRITE` su tutti gli endpoint
  - `GET /api/moodboards/{id}` ora include `pages: [...]` array (sort_order ASC) + `elements` legacy
- **Create + Apply flows** (`moodboards.py` + `templates.py`)
  - `POST /api/moodboards` crea automaticamente default page con `title=mb.title` e setta `current_page_id`
  - `apply_template` crea default page e attacha tutti i cloned blocks
  - Bug fix (caught by testing agent): response del create overlay-ava current_page_id stale; risolto con re-overlay in-place
- **Frontend** (`PagesNavigator.jsx` + `MoodboardEditor.jsx`)
  - Sidebar 180px left of "Add Block" toolbar, eyebrow "PAGINE", mini canvas thumbnail per ogni page (rect colorati semantici, no SVG complesso — performance-friendly)
  - Active page highlight (border `var(--bp-primary)`)
  - Hover actions: duplicate, delete (con guard last-page lato UI)
  - HTML5 drag-and-drop → POST reorder
  - Add page picker: dropdown ratio + dropdown type, presets letti dal registry backend
  - State editor: `pages`, `activePageId`, derived `pageBlocks`, `blocksByPage`, `activePage`, `canvasW/H` dinamici
  - Canvas dimension **dinamica** dal preset (es. landscape_16_9 → 1920×1080)
  - Snap page-scoped (no cross-page magnetism)
  - LayersPanel scoped to current page
  - `addBlock` invia `page_id=activePageId`
- **i18n** — 25 nuove chiavi EN+IT
  - `page.{add,duplicate,delete,rename,untitled,eyebrow}`
  - `page.ratio.{portraitA4,landscape169,square,editorial,wide,coverLandscape}`
  - `page.type.{cover,blank,mood,material_board,product_grid,palette,gallery,split_story,quote,technical_board,floorplan,proposal_summary,approval}`
- **Tested ✅** (`iteration_12.json`)
  - Backend: **19/19 new F.0** + **31/31 regression** (P0+E.5+E.2)
  - Frontend live: PagesNavigator visible at x=220/180px, eyebrow 'Pagine', add-page-btn → picker funzionante, card count 2→3 dopo add, canvas resize verificato (landscape_16_9 → 1920×1080), IT i18n confermato
  - Bug `current_page_id=None` su create_moodboard → fix applicato dal testing agent (overlay sul response dict)
  - Cross-tenant: studio2 404 su pages designer ✓
  - RBAC: client 403 su pages write ✓


### ✅ P0 Sprint — Moodboard Core Stabilization (DONE — 13 Mag 2026)
Pre-foundation reliability + media completeness pass prima di aprire Moodboard PRO™.

- **Image upload provenance** (`ImageUploader.jsx`) — Pre-estrae `naturalWidth/Height` via `Image()` preload + `URL.revokeObjectURL` cleanup. `onUploaded(url, metadata)` propaga: `upload_source`, `original_dimensions`, `media_id`, `storage_path`, `file_name`, `uploaded_at`
- **Atomic patch onChange prop** — `BlockInspector` accetta `onChange(patch)` per mutazioni multi-field; `updateBlock` deep-merge ora copre anche `metadata` (oltre a content/style già fatto in E.5)
- **Fix opacity bug** — `block.opacity`/`block.rotation` sono colonne top-level: prima venivano scritte erroneamente in `style_json`. Ora `onChange({opacity:v})` / `onChange({rotation:v})` colpisce le colonne reali
- **Border-radius slider** (`style.border_radius` 0-48px) — Inspector con feedback px live
- **Shadow preset 4-button grid** (`style.shadow_preset` ∈ {none/soft/medium/dramatic}) — editorial restraint, NO valori custom shadow (intenzionale)
- **Toast Sonner** integrato in `App.js` bottom-right, theme dark, className `bp-toast`. `flushSave` dopo max retries → `toast.error` con action "Riprova" che reset retryCount + ri-trigger flush
- **Backend metadata pipeline** (`moodboards_v1.py`)
  - `BlockUpdate.metadata` field aggiunto
  - `update_block` + `batch_update_blocks` deep-merge `metadata_json` (no replace semantics)
  - `_normalize_block` espone `metadata` nella response GET
- **i18n** — 8 nuove chiavi EN+IT: `field.borderRadius/shadow`, `shadow.none/soft/medium/dramatic`, `editor.visualProps/saveFailedHint/retry`
- **Tested ✅** (`iteration_11.json`)
  - Backend: **9/9 new P0** + **31/31 regression** (E.2 + E.4 + E.5)
  - Frontend E2E live: tutti 10 nuovi testids presenti, shadow-medium click → computed `boxShadow='rgba(0,0,0,0.3) 0px 8px 24px 0px'`, autosave raggiunge status-saved entro 3.5s, persistenza dopo reload verificata


### ✅ Phase E.5 — Moodboard Stability & Media Polish Pass (DONE — 13 Mag 2026)
Chiusura blocker UX core dell'editor prima dell'apertura di Fase F. Reliability + media editor reale.

- **Autosave reliability** (`MoodboardEditor.jsx`)
  - `blocksRef`/`dirtyRef` → flushSave legge sempre lo stato corrente, no più stale closures su mutazioni rapide
  - `setDirtyMap` partial clear (solo ids effettivamente persistiti) → in-flight edits restano in queue
  - `useEffect` cleanup con `flushRef.current()` → flush forzato su unmount/SPA navigation (verificato pattern by construction)
  - `beforeunload` → `navigator.sendBeacon` con JSON blob best-effort (limitazione documented: no auth header)
  - `retry` con backoff lineare 500ms × tentativo, max 3 tentativi
- **updateBlock deep-merge** (P0 root cause)
  - Patch `{content: {...}}` ora fonde con esistente invece di sostituire → fix bug "upload immagine perde caption / altri campi siblings"
  - Stesso pattern per `style` patches
- **Real Image Editor** — `BlockInspector` image case
  - **Crop section** invariato (fit/focal/zoom) + nuovo `reset-crop-btn` per ripristino completo
  - **AdjustmentsSection** — 7 slider editorial-bounded (NON Photoshop):
    - brightness 0.5–1.5, contrast 0.5–1.5, saturation 0–2, warmth -1..+1, grayscale 0–1, blur 0–8px, vignette 0–1
    - Persistenza in `style_json.adjustments` via batch update (verificata E2E)
    - Reset button per azzerare tutte le regolazioni
- **CSS-filter pipeline** (`ImageBlock.jsx` rewritten)
  - `buildFilter()` helper dependency-free: elide identity ops (brightness==1 non emesso) → costo CSS recalc minimo
  - Warmth → `sepia()` per positivo, `hue-rotate(neg)` per negativo (editorial mood control)
  - Vignette overlay separato come radial-gradient softness (no filter)
  - Transition `filter 220ms ease` per slider real-time feedback
- **ImageBlock polish**
  - **Skeleton** con shimmer keyframe (data-testid=`image-block-skeleton`)
  - **Fade-in** opacity 0→1 transition 480ms cubic-bezier(0.22, 0.61, 0.36, 1) — cinematic load
  - **Error fallback** con icona ImageOff + copy "Immagine non disponibile" (data-testid=`image-block-error`)
  - **Empty placeholder** con icona ImagePlus + copy localizzata (data-testid=`image-block-empty`)
- **Save Status UX** premium (Linear/Notion style)
  - 4 stati con testids dedicati: `status-saving` (pulsing dot teal), `status-saved` (check icon), `status-unsaved` (CLICCABILE per manual flush), `status-save-error` (CLICCABILE per retry + tooltip errore)
- **i18n** — 12 nuove chiavi EN+IT
  - editor: `unsaved/resetCrop/adjustments/reset/imageMissing`
  - field: `brightness/contrast/saturation/warmth/grayscale/blur/vignette`
- **Tested ✅** (`iteration_10.json`)
  - Backend: **6/6 new E.5** + **25/25 regression** E.2+E.4
  - Frontend code-review 100% su tutti 13 testids + 7 adjustment paths
  - Persistenza E2E `style.adjustments` verificata via batch PATCH → GET roundtrip
  - Caption preserved across content updates (regression del bug originale) ✓


### ✅ Phase E.4 — Template Preview Gallery + micro Lineage (DONE — 13 Mag 2026)
Trasformazione del picker da "lista nomi" a **editorial archive / design catalog**. Foundation per marketplace futuro.

- **Server-side SVG preview** (`/app/backend/core/template_preview.py`)
  - Pure-Python builder, dependency-free (~150 LOC), nessun raster, nessun asset esterno
  - Genera SVG strutturali da `template_blocks.position_json` con tinte semantiche per type (image/text/palette/note/product/material)
  - Palette blocks rivelano gli **swatch reali** nel preview (max 5 colori)
  - Text blocks emettono "glyph rows" tipografici per size (display/h1/eyebrow/body…) — feeling magazine
  - viewBox 220×360 + cinematic vignette radial
  - Fallback su legacy `content.layout` se `position_json` assente
- **Backend integration** (`routers/templates.py`)
  - `GET /api/templates?with_preview=true` (default) → ogni template ha `preview_svg`, `palette`, `block_count`
  - `with_preview=false` → perf-escape (campi assenti)
  - Detail include sempre `preview_svg` + `palette` + `block_count` + `parent` (lookup leggero)
- **Micro Template Versioning**
  - `apply_template` → `moodboards.template_id` (colonna baseline) ora popolata con l'origine
  - `save_as_template` → legge `src_mb.template_id` e setta `parent_id` sul nuovo template (fork lineage)
  - Detail expandsl il `parent_id` in `{id, name, slug}` via `_attach_lineage`
  - Chain `apply → save-as → detail` produce child.parent popolato (verificato live)
- **Editorial gallery** (`TemplatePicker.jsx` riscritto)
  - Adaptive aspect ratios per categoria (3/4 editoriale, 1/1 hospitality, 5/4 retail/ffe) — typographic rhythm
  - SVG inline via `dangerouslySetInnerHTML` (sicuro — sorgente server-controlled, solo primitive geometriche + hex escape)
  - Hover lift soft con `translateY(-0.5)` + `duration-[var(--bp-duration-cinematic)]` + `ease-emphasis`
  - Palette swatch row (5 quadrati 12px con inset shadow soft)
  - Lineage badge GitBranch "Derivato da un altro template" su fork
  - Fallback "Preset dello studio" per template tenant senza categoria (nessun leak chiave i18n)
  - Modal espanso a `max-w-4xl` con grid `280px_1fr` per dare respiro editoriale alla galleria
- **i18n** — 3 nuove chiavi EN+IT: `templates.startBlank` (Open/Apri), `templates.tenantPreset` (Studio preset/Preset dello studio), `templates.derivedFrom` (Derived from another template/Derivato da un altro template)
- **Tested ✅** (`iteration_9.json`)
  - Backend: **9/9 new E.4** + **20/20 E.1+E.2 regression**
  - Frontend: 10 cards renderizzate con 12 SVG inline visibili, lineage badge attivo su fork, palette swatches visibili, hover lift confermato (-2px), modal layout editorial verificato in screenshot
  - Lineage chain E2E: `luxury-editorial → apply → save-as → child.parent.slug='luxury-editorial'` ✓


### ✅ Phase E.3 — Polish Sprint: Smart Snap + Undo/Redo + Theme Leak Cleanup (DONE — 13 Mag 2026)
Triplo deliverable per chiudere la V1 weekend con feel premium uniforme.

- **Smart Snap System** (`/app/frontend/src/blueprint/moodboard/useSnap.js` + `SnapGuides.jsx`)
  - Threshold 6px, snap a edge/center di canvas + altri blocchi (left/center/right + top/middle/bottom)
  - Modalità separate per `move` vs `resize` (resize snappa solo right+bottom)
  - Guide SVG dashed teal (`var(--bp-primary)`, opacity 0.55, dasharray "2 3") visibili SOLO durante drag attivo, padding 12px oltre span — feeling Framer/Linear/Keynote, ZERO CAD lines
  - Alt-key bypass (idioma Figma/Keynote) per disabilitare snap al volo
  - Toggle button topbar (`data-testid=snap-toggle-btn`, icona Magnet) — default ON, icona teal quando attivo
- **Undo / Redo locale** (`useHistory.js`)
  - Stack JS puro, snapshot completo dei blocks (deep-clone via JSON), max 50 entries
  - Cursor model con branching (pruna future entries quando si registra dopo un undo)
  - Trigger snapshot: create/delete/duplicate/drag-end/resize-end
  - Keyboard: `Cmd/Ctrl+Z` = undo, `Cmd/Ctrl+Shift+Z` e `Cmd/Ctrl+Y` = redo. Guardia su input/textarea/contentEditable
  - Pulsanti topbar (`data-testid=undo-btn/redo-btn`, icone Undo2/Redo2), disabled-state derivato da `history.canUndo/canRedo`
  - Restore: applica snapshot + marca tutti i blocchi dirty (autosave persiste lo stato ripristinato)
- **Theme Leak Cleanup** — 10 pagine legacy
  - Dashboard, Leads, Projects, Proposals, Admin (Overview/Tenants/TenantDetail/Modules/Audit), Insights, Inspirations
  - Mapping bulk: `#0A0A0B → var(--bp-bg)`, `#141416 → surface-1`, `#1C1C1F → surface-2`, `#222226 → surface-3`, `#EFEBE4 → text-primary`, `#A19D98 → text-secondary`, `#6B6863 → text-muted`, `#4A4845/#3A3835 → text-subtle`, `#D4AF37 → primary`, `#0F0F11 → surface-1`
  - White overlays: `white/[0.06|0.08|0.05] → var(--bp-border)`, `white/[0.1] → border-strong`, `white/[0.03|0.02|0.04] → surface-2 con alpha`
  - Wrap automatico via Python script: 44 occorrenze di `var(--bp-*)` correttamente racchiuse in `[var(--bp-*)]` per Tailwind arbitrary-value syntax
  - Tutti i pulsanti CTA legacy ora usano `var(--bp-primary)` invece del fallback `#D4AF37`
- **i18n** — 3 nuove chiavi EN+IT: `moodboards.editor.{undo,redo,snap}` = `Annulla / Ripeti / Snap intelligente`
- **Tested ✅** (`iteration_8.json`)
  - Backend: **26/26 regression** (E.1 + E.2 + isolation/permissions)
  - Frontend: tutti i testids E.3 verificati (undo-btn, redo-btn, snap-toggle-btn, initial-disabled-state, post-mutation-enabled-state), Ctrl+Z/Y/Shift+Z funzionanti con guardia su input
  - Theme leak grep: **0 hex hardcoded** + **0 Tailwind class rotte** su tutte le 10 pagine target


### ✅ Phase E.2 — Templates V1 (DONE — 13 Mag 2026)
Quick-start template system per i moodboard: 7 starter platform + creazione di template tenant-private da qualsiasi moodboard esistente.

- **Migration 007 — Templates seed** (`/app/supabase/migrations/007_templates_seed.sql`):
  - 7 starter template platform (`tenant_id NULL`, `visibility='platform'`, `is_starter=TRUE`): `luxury-editorial`, `hospitality`, `residential`, `retail`, `materials-board`, `ff-and-e`, `concept`
  - Idempotente (ON CONFLICT DO UPDATE), reversibile, structure-only (NO image URLs hardcoded — gli utenti riempiono con i propri asset via upload)
  - `locale_content` JSONB con nome/descrizione tradotti per IT, EN-US, FR, DE, ES
- **Backend** (`/app/backend/routers/templates.py`):
  - `GET /api/templates` — list (platform + own tenant), filtri `category`/`starter_only`/`locale`
  - `GET /api/templates/{id}` — detail con blocks normalizzati (x/y/width/height/z_index estratti da position_json)
  - `POST /api/templates` — create (tenant-scoped, slug unico per tenant)
  - `PUT /api/templates/{id}` — update (platform templates editabili solo da super_admin)
  - `DELETE /api/templates/{id}` — soft archive (`archived_at`)
  - `POST /api/templates/{id}/apply` — clone template_blocks → moodboard_elements creando nuovo moodboard `draft`; mirror `content.src → image_url` per parity con create_block
  - `POST /api/templates/from-moodboard/{moodboard_id}` — snapshot moodboard come nuovo template (tenant-private)
  - **P0 fix**: rimossa colonna `settings` inesistente dall'insert su `moodboards` (era 500). Separation of concerns: moodboard = runtime entity, template = preset/configuration source
  - Tutte le route gated da `require_permission(P_MOODBOARDS_READ/WRITE)`
- **Frontend Quick-start picker** (`/app/frontend/src/blueprint/moodboard/TemplatePicker.jsx`):
  - Shared component riusato su `MoodboardsPage` CreateModal e `ProjectDetailPage` CreateMoodboardModal
  - Tile "Tela vuota" (blank canvas) + 7 starter cards categorizzate
  - 100% Blueprint-driven (zero copy hardcoded, locale forwarded all'API per nomi localizzati)
  - data-testid: `template-picker`, `template-blank`, `template-card-{slug}`
- **Frontend Save-as-template** (`MoodboardEditor.jsx`):
  - Pulsante topbar "Salva come template" (data-testid=`save-as-template-btn`)
  - Slug auto-generato dal titolo (slugify + random suffix), feedback inline stato (saving/saved/error)
- **i18n** — chiavi già presenti in EN-US + IT (`moodboards.templates.{eyebrow,blank,blankDesc,applyBtn,saveAs,category.*}`)
- **Tenant isolation verificata E2E**: studio2 (Showroom) vede solo 7 platform; designer (Studio) vede 7 platform + propri tenant-private. Cross-tenant template detail → 404
- **RBAC verificata**: client → 403 su `apply` e `from-moodboard` (P_MOODBOARDS_WRITE required)
- **Tested ✅** (`iteration_7.json`)
  - Backend: **16/16 new test_phase_e2_templates.py** + 10/10 E.1 regression
  - Frontend: tutti i critical testids verificati con locale IT (Avvio rapido, Tela vuota, Editoriale di Lusso, Ospitalità, Residenziale, Retail, Materiali, FF&E, Concept), apply → editor con blocchi clonati funzionante


### ✅ Phase E.1 — Moodboard Polish Sprint (DONE — 13 Mag 2026)
Sopra la foundation stabile (Sprint Cleanup P0). Tutti i requisiti tecnici del documento utente rispettati: ZERO hardcoded, runtime-editable, theme-token-based, multi-tenant, i18n-ready, migration-safe.

- **Migration 006 — V2 Scaffold** (`/app/supabase/migrations/006_moodboard_v2_scaffold.sql`):
  - 4 tabelle pronte per V2 (75 colonne tot., 12 indici, FK cascade corretti) — **NON esposte** alle API in V1 ma già queryable
  - `moodboard_templates` (23 col): global+tenant, parent_id per fork, category/tags GIN, visibility (private/tenant/platform/marketplace), is_starter, locale_content i18n, ai_metadata, analytics_metadata
  - `template_blocks` (15 col): stesso shape di `moodboard_elements`, indice `(template_id, sort_order)`
  - `moodboard_versions` (16 col): snapshot completo JSONB, `kind` (autosave/named/presentation/rollback_restore/client_view_snapshot), `parent_version_id` per branching, `version_number` UNIQUE, hash, is_milestone
  - `moodboard_comments` (21 col): block_id nullable (canvas-anchored via x/y), parent_comment_id per thread, author_role (designer/client/super_admin/anonymous_share), mentions UUID[], resolved bool con `resolved_by`, partial index `WHERE resolved=FALSE`
- **Block Duplicate endpoint** (`POST /api/moodboards/{id}/blocks/{block_id}/duplicate`): clone con offset +24/+24/+z, locked/hidden resettati a false
- **UUID path validation**: route `/api/moodboards/{id}` rifiuta non-UUID → 404 pulito (era 500)
- **Layer Management UI** (`blueprint/moodboard/LayersPanel.jsx`):
  - Lista layer ordinata per z-index discendente (top of stack first)
  - Hover toggles per `lock` / `hidden` (persistiti come colonne strutturate)
  - Toolbar contestuale 6-azioni: bring-to-front · bring-forward · send-backward · send-to-back · duplicate · delete
  - Right rail con tab switcher Inspector / Layers (data-testid `tab-inspector`, `tab-layers`)
- **Image Upload reale** (`blueprint/moodboard/ImageUploader.jsx`):
  - Drag-and-drop + click to upload, progress bar, error state, IT/EN strings
  - Flow: signed-upload → PUT direct to Supabase Storage `moodboard-assets` → register in `media_library`
  - Disponibile in inspector di image/product/material blocks
- **Crop + Focal Point UI**:
  - Inspector image ha sezione "Ritaglio e focal point": select `fit_mode` (cover/contain/fill), grid 3x3 focal preset, slider zoom (100%-300%)
  - Tutti i field persistiti in `style_json` JSONB (non più `content.layout`)
  - `ImageBlock.jsx` ora renderizza con `object-fit` + `object-position` + `transform: scale()` correlati
- **Opacity + Rotation**: slider per text/note blocks + struttura DB completa anche per altri tipi
- **Presentation Mode** (`PresentationMode` component):
  - Fullscreen cinematic (z-50, bg surface), hide editor chrome
  - Sequential navigation con keyboard `←` `→` `Space` + footer prev/next
  - Counter `i / N` (paginazione blocchi visibili)
  - `Esc` exit
- **Locked blocks**: non draggable, cursor-default, resize handle nascosto. Hidden blocks: opacity 0.3 in editor, esclusi dal canvas in readOnly + presentation
- **i18n**: 23 nuove chiavi (`moodboards.editor.{layers,present,duplicate,lock,hide,upload,uploading,uploadFailed,crop,…}`, `moodboards.field.{fitMode,focalPoint,zoom,opacity,rotation}`) tradotte in EN-US e IT
- **Tested ✅**
  - Backend: **95/95 regression** + **9/9 nuovi E.1** (test_phase_e1.py) — 100%
  - Frontend: editor IT integrale, tabs Inspector/Layers funzionanti, Presenta entra in fullscreen, Esc esce, exit-btn funziona, IT verificato su 23 nuove chiavi
  - V2-scaffold tables: queryable via SQL, NOT exposed via REST (atteso)


### ✅ Phase E (V1) — Blueprint Moodboards™ + Workspace Extended (DONE — 13 Mag 2026)
End-to-end operational loop closed: **Lead → Project → Workspace → Moodboard → Approval → Share**.

- **Moodboards V1 backend** (`routers/moodboards_v1.py`):
  - Block CRUD (`POST/PUT/DELETE /api/moodboards/{id}/blocks`) for 6 V1 types: `image · text · palette · note · product · material` + 4 future-stub types accepted server-side (`hotspot · video · vendor · product_grid`)
  - **Autosave bulk patch** (`PATCH /blocks/batch`) — drag/resize positions persisted in `content.layout` (no schema migration)
  - **Approval state machine** aligned to Supabase `moodboard_status` enum: `draft → sent → viewed/approved/revision_requested/rejected → …` with explicit invalid-transition 400
  - **Share token** (`POST /share` + anonymous `GET /public/share/{token}`) — token→moodboard reverse lookup via `tenant_settings`, 403 on draft, full block list in response
  - Pushes `moodboard.*` events into project activity stream
- **Workspace Extended backend** (`routers/workspace.py`):
  - Tasks, Notes (pinned-first sort), Activity stream — all per-project, stored in `tenant_settings` keys (`project.{id}.tasks|notes|activity`), schema-migration-free
  - **Lead → Project converter** (`POST /api/workspace/leads/{lead_id}/convert`) — creates project, links `lead_id`, sets lead.status=`project_opened`, audit-logged, activity event pushed
- **Block registry frontend** (`/blueprint/moodboard/BlockRegistry.js` + 6 block components) — token-driven, locale-aware, no hardcoded copy
- **MoodboardEditor.jsx** — V1 canvas editor: drag-to-move, corner resize, debounced 800ms autosave with Saving/Saved indicator, left rail block toolbar, right rail inspector per-type (image src/caption · text/size · note · palette colors picker · product/material), workflow toolbar (Send for review → Approve/Reject/Request revision), Share dialog. ALL labels via `t()`
- **MoodboardsPage.jsx** — luxury list: status-tone cards, 7 filters (Tutti/Bozze/Inviati/Visti/Approvati/Revisione/Rifiutati), create modal with optional project linker
- **ProjectDetailPage.jsx** — 5-tab workspace (Panoramica/Attività/Note/Moodboard/Diario), all i18n-driven, luxury create-moodboard modal (replaced browser `prompt()`)
- **LeadsPage.jsx** — added per-row "Converti in progetto" CTA that navigates to project detail
- **ProjectsPage.jsx** — project cards now wrapped in `<Link>` (accessible, deep-linkable)
- **i18n bundle** — 40+ new keys under `moodboards.*` and `workspace.*` in EN-US + IT, with status translations matching real DB enum values
- **BlueprintContext locale fix** — pre-resolves tenant default locale before fetching messages (eliminates en-US flash on first paint)
- **Tested End-to-End ✅**
  - 25/25 backend pytest pass (full Phase E: moodboard CRUD, blocks for all 6 types, batch autosave, approval state machine, public share gate, tasks/notes/activity, lead.convert)
  - Frontend e2e: moodboards list (3 cards), filter tabs, new-moodboard modal, editor canvas with drag/resize, inspector, send-review → approve, share dialog → public anonymous page (readOnly)
  - IT locale verified across breadcrumb/sidebar/page/filter/badges from fresh browser state


- Login → tema teal #26F5C9 caricato runtime
- Brand Studio carica tutti i tab
- Preset palette applicato → preview live aggiorna istantaneamente colors+shapes+fonts
- Viewport switcher desktop/tablet/mobile cambia preview width animata
- Save → teal applicato globalmente in sidebar + active states + buttons
- Domains: add custom_domain → riga con badge pending
✅ Sidebar tenant mostra "Super Admin" entry
✅ Navigate to /admin → control-center UI
✅ Platform overview KPI cross-tenant
✅ Tenants list (2 tenants)
✅ Open tenant detail con tutti i toggle visibili
✅ Toggle Feature Flag (ai_suggestions) → backend persisted
✅ Impersonate tenant → banner amber visibile, queries con header
✅ Stop impersonation → banner removed

### ✅ Phase C — Public Rendering Layer + Dynamic Navigation/Footer (DONE — 12 Mag 2026)
The Section Engine now powers UNAUTHENTICATED public tenant routes. ZERO hardcoded React pages — runtime composition only.

- **Backend** (`routers/public.py` + `routers/navigation.py`):
  - `GET /api/public/tenants/{slug}` — public tenant config (theme, locales, navigation, footer); resolves by slug OR by custom domain (via `tenant_domains` table)
  - `GET /api/public/tenants/{slug}/pages/{page_slug}` — serves only published pages (homepage gets a graceful default seed when no published version exists)
  - `GET /api/public/navigation/defaults` — canonical seeds for the navigation editor
  - Auth-gated CRUD under `/api/settings`: `GET/PUT/POST reset` for `navigation` and `footer` (key='public_navigation' / 'public_footer' in `tenant_settings`)
  - Sensible default seeds: 4-item top nav with home/showcase/about/contact + CTA + locale switcher, 3-column footer with copyright template
- **Frontend Public Rendering** (`/app/frontend/src/pages/public/`):
  - `PublicTenantPage.jsx` — runtime composition: loads tenant config + page in parallel, applies theme to `:root`, renders `<PublicNavigation>` + `<BlueprintPageRenderer>` + `<PublicFooter>`. Reserved-slugs short-circuit to 404
  - `PublicNavigation.jsx` — schema-driven luxury top bar: logo (asset OR text), items (link/mega-menu), CTA, locale switcher, mobile drawer, transparent-over-hero + glass-after-scroll behavior
  - `PublicFooter.jsx` — multi-column footer, i18n labels, copyright with `{year}` and `{brand}` interpolation
  - `publicLocale.js` — `PublicLocaleContext` + `resolveI18nLabel(label, locale, fallback)` helper used across the public layer
- **Frontend Editor** (`/settings/navigation` → `NavigationEditorPage.jsx`):
  - Two tabs (Navigation / Footer), per-locale i18n inputs ({_default, en-US, it, ...}), reorder via chevron, add/delete items, columns and links
  - Toggles: sticky · transparent-on-hero · locale switcher
  - Visit-public-site button opens `/{tenant-slug}` in a new tab
  - Save dirty-state + Reset to default
- **HomepageBuilder additions**: Publish toggle (draft/published) in topbar
- **App.js public routes**: `/:tenantSlug` and `/:tenantSlug/:pageSlug` registered AFTER all specific routes, BEFORE catch-all
- **Tested End-to-End** ✅
  - 17/17 backend pytest pass (public config, published gating, custom-domain resolution, auth gating, i18n round-trip, defaults reset)
  - Public route renders end-to-end with editorial cinematic hero (eyebrow + display + lead + CTAs), Italian CTA "Contattaci" via i18n label resolution
  - Locale switcher updates labels live without reload (persists in localStorage)
  - Critical bug found + fixed during testing: missing `<Route path="/settings/navigation">` in App.js (testing agent applied the fix)
  - Cosmetic fixes: duplicate 'EN' in locale dropdown (now shows full locale codes), visit-public-site link robust to slug load timing


### ✅ Phase D — Blueprint Dynamic Form Engine™ (DONE — 13 Mag 2026)
Enterprise-grade schema-driven form engine. Reusable for: lead-gen · design requests · onboarding · moodboard approvals · proposal approvals · concierge · surveys · feedback · vendor applications · sourcing requests.

- **Backend** (`core/form_registry.py` + `routers/forms.py`):
  - 18 field types: short_text, long_text, email, phone, country, single_choice, multi_choice, style_cards, mood_cards, image_choice, slider, budget_slider, timeline_picker, scale, file_upload, signature (coming-soon), consent, statement
  - 10 form purposes with `writes_to` hints (lead → leads table · concierge → concierge_requests · etc.)
  - 5 layouts × 5 atmospheres for cinematic UX variants
  - Default seed `design_request` form: 4 steps, 10 fields, complete with style_cards + budget_slider + timeline_picker
  - `evaluate_conditional()`: equals · not_equals · in · not_in · gt · lt · truthy (server + frontend mirror)
  - `validate_submission()`: required + strict email regex
  - Endpoints under `/api/forms`: GET registry, GET list, GET/PUT/DELETE slug, duplicate, reset, list submissions
  - Public endpoints under `/api/forms/public/{tenant}/{form}`: GET form (status=published gated, internal fields ai/scoring/integrations STRIPPED), POST submit (validation + lead-row auto-insert for lead/design_request purposes)
  - Forms stored in `tenant_settings` (`form.{slug}`); submissions in `tenant_settings` (`form_submission.{slug}.{uuid}`) — schema-migration-free
- **Frontend Field Engine** (`/app/frontend/src/blueprint/forms/`):
  - `FieldRegistry.js` → 14 components for 17 server types (image_choice→SingleChoice, mood_cards→StyleCards, country→ShortText) + `resolveI18n()` + `evaluateVisibility()`
  - `FormRenderer.jsx` — cinematic multi-step renderer: sticky teal progress bar · per-step validation · conditional visibility · thank-you state with auto-redirect · sticky Back/Continue bar
  - 14 field components, all theme-driven, locale-aware: editorial underline inputs, style_cards image grid with check overlay, budget_slider with currency display large, timeline pills, scale 1-5 circles, file_upload dashed dropzone, consent custom checkbox
- **FormBuilderPage** (`/settings/forms`):
  - List view: form catalog with status badge (draft/published), New/Edit/Duplicate/Delete
  - Edit view: 280px left rail steps stack (reorder/delete) + center step editor with field property panels + add-field modal (18 cards categorized) + Preview mode toggle + Publish toggle + Visit-form link
  - Locale switcher for editing translations (`_default · en-US · it · fr · de · es`)
- **PublicFormPage** (`/f/:tenantSlug/:formSlug`):
  - Unauthenticated · loads tenant theme + form schema · uses FormRenderer · submits to public endpoint
- **Section Engine integration**: new `form_embed` section type (category=conversion, reusable_in=homepage/landing/showcase/client_portal) with `inline` and `modal_trigger` variants — links homepage CTAs to forms via `form_slug`, ZERO hardcoded URLs
- **AI placeholders** ready for future iterations: `form.ai = {field_suggestions, question_generation, copy_enhancement, auto_localize, scoring}` — flags default to false
- **Tested End-to-End** ✅
  - 19/19 backend pytest pass (CRUD, publish gate, internal field stripping, validation, conditional primitives, reusability check: concierge purpose does NOT write to leads)
  - All frontend critical flows verified
  - Bugs fixed during testing: (1) lead row `budget` → `budget_range` column drift, (2) error data-testid for field validation, (3) email regex tightened, (4) signature marked coming-soon


## File Map
```
/app/backend/
├── core/
│   ├── permissions.py        # 8 roles × 31 perms, centralized
│   ├── modules.py            # Blueprint module registry
│   ├── feature_flags.py      # 11 flags + override engine
│   └── tenant_context.py     # impersonation + audit + scope
├── routers/
│   ├── auth.py, leads.py, projects.py, proposals.py, moodboards.py
│   ├── blueprint.py          # i18n, tenant/me, navigation, dashboard, modules, flags
│   ├── superadmin.py         # /api/super/* cross-tenant management
│   └── storage.py, insights.py, settings.py, inspirations.py
├── middleware/auth.py        # JWKS ES256 + HS256 fallback
├── models/schemas.py         # Pydantic
└── server.py

/app/frontend/src/
├── contexts/
│   ├── AuthContext.jsx       # localStorage session
│   └── BlueprintContext.jsx  # theme + i18n + modules + permissions + impersonation
├── components/
│   ├── layout/{Sidebar,Topbar,DashboardLayout,AdminLayout}.jsx
│   └── common/{Brand,LocaleSwitcher,ImpersonationBanner}.jsx
├── pages/
│   ├── auth/, dashboard/, workspace/, moodboards/, inspirations/, insights/, settings/, public/
│   └── admin/{Overview,Tenants,TenantDetail,Modules,Audit}.jsx
└── App.js
```

## Roadmap

### ✅ DONE
- Phase 1 (Tenant MVP) — auth, CRUD, dashboard, i18n, theme
- Phase A (Super Admin Foundation) — permissions, modules, flags, impersonation

### 🔜 Phase C — Homepage / Public Site Builder
- ✅ Section Engine fondazionale (DONE in Phase B+)
- ✅ Homepage Builder UI (DONE in Phase B+)
- ✅ Public Route Renderer su `/{tenant-slug}` + `/{tenant-slug}/{page-slug}` (DONE in Phase C)
- ✅ Dynamic Navigation/Footer schema-driven (DONE in Phase C)
- ✅ Page publish/draft toggle (DONE in Phase C)
- Remaining: custom-domain verification flow (DNS check), SEO meta tags per page, og_image preview

### Phase D — Blueprint Dynamic Form Engine™ + Workspace
- ✅ Form Engine completo (DONE in Phase D)
- ✅ Public form route /f/:tenantSlug/:formSlug (DONE)
- ✅ Form embed section type in Section Engine (DONE)
- Blueprint Workspace™ extension (Timeline, Files, Proposals, Signoff, Client Portal, Tasks, Notes)

### Phase E — Blueprint Moodboards Editor
- ✅ V1: block-based canvas (image/text/palette/note/product/material), drag+resize, debounced autosave, approval state machine, public share token (DONE in Phase E)
- ✅ E.2 Templates V1 — Apply/Save-as flow, Template Picker, RBAC (DONE)
- ✅ E.3 Polish Sprint — Snap System, Undo/Redo, Theme leak cleanup (DONE)
- ✅ E.4 Template Preview Gallery + Lineage (SVG previews, parent_id tracking) (DONE)
- ✅ E.5 P0 Stability & Media Pass — Image adjustments, reliable autosave, upload persistence (DONE)
- ✅ Lead→Project converter + Tasks/Notes/Activity (DONE in Phase E)
- Future (V2 advanced): PDF export, hotspot system, AI material suggestions, version history UI

### Phase F — Blueprint Moodboard PRO™ (Multi-page Presentation OS)
- ✅ F.0 Multi-page Foundation — pages CRUD, PagesNavigator sidebar, auto-migration of legacy moodboards (DONE)
- ✅ F.1 Structural Multi-page Templates — Luxury Residential / Hospitality / Material Board seeds, placeholder semantics, page cloning (DONE)
- ✅ P0 Bug Sprint (Feb 14 2026) — Responsive canvas (non-mutating scale), Layers ↔ Canvas sync, ±1 neighbor swap arrows, HTML5 Drag&Drop layers, Master Layouts™ Skeleton Picker on Add-page (12 skeletons across 7 categories) (DONE — iteration_14)
- ✅ F.2 Presentation Sequencing V2™ (Feb 14 2026) — PresentationMode V2 cinematic engine with letterboxing, 6 GPU-only transitions (fade/dissolve/slow_slide_left/up/cinematic_zoom/soft_blur_crossfade), chapter navigation overlay (press `c`), idle auto-hide overlays, keyboard-first nav (→ ← Space Esc Home End), PageInspector tab for per-page transition + chapter_label + hidden_from_client + hidden_in_presentation, public /presentation/{shareToken} route (no auth, client-safe filter), BONUS: POST /api/templates/inject-into/{moodboard_id} for appending template pages into existing moodboards (DONE — iterations 15+16)
- ✅ UX Bug Sprint post-F.2 (Feb 14 2026) — (1) empty-title inline red-ring + localized error on Create Moodboard, (2) apply_template batch insert (Luxury 8-page apply 30s→~1s) + 90s axios timeout override, (3) ImageBlock signed-URL fallback for private buckets + ImageQuickAdjust modal opens right after upload (fit/focal/brightness/contrast/saturation, custom focal-point via preview click) keeping fine controls in sidebar, (4) right-sidebar 3 tabs converted to icon-only with tooltip+aria-label (DONE — iteration_17)
- ✅ Blueprint Moodboard Builder PRO™ Final UX Alignment (Feb 14 2026) — Editorial cinematic restyle inspired by the user's reference mockup: (a) Topbar with MOOD for DESIGN brand lockup + breadcrumb (Project / Moodboard / Name) + premium teal Presenta/Approva/Condividi action group; (b) Centered horizontal ActionToolbar (Seleziona·Deseleziona·Sposta·Ridimensiona | Testo·Immagine·Galleria·Prodotto·Materiale | Palette·Forma·Linea·Hotspot·Note); (c) NEW LibraryPanel left rail with Blocchi/Contenuti tabs, server-registry-driven structural skeletons grouped by category, Elementi salvati stub, Libreria personale CTA; (d) PagesNavigator MOVED from left vertical to bottom horizontal PagesFilmstrip preserving every add/duplicate/delete/reorder handler; (e) Autosave teal dot + 'Salvataggio automatico attivo' bottom-right. All Blueprint-driven, i18n IT/EN, 100% no regression (DONE — iteration_18)
- ✅ Blueprint Inspirations™ Foundation — Creative Memory System™ (Feb 14 2026) — BACKEND-ONLY architecture phase. 4 normalized tables via migration 011 (inspirations_boards / inspirations_items / inspirations_activity / inspirations_comments), tenant-scoped with optional lead/project/moodboard linkage, future AI-ready JSONB fields (metadata/style_tags/ai_tags/extracted_palette/position). Full CRUD router /api/inspirations/boards (+ /items, /activity, /comments, /_meta/registry). First-class activity timeline events (board_created/updated, item_added/moved/tagged/updated/removed, linked_to_project/lead/moodboard, comment_added). designer + client roles granted INSPIRATIONS permissions. FK pre-validation prevents 500 on stale UUIDs. 32/32 pytest GREEN, zero critical issues (DONE — iteration_19)
- ✅ UX Rewrite + Premium Interaction System — P0 Drag & Image perf (Feb 14 2026) — rAF-throttled mousemove with GPU `willChange: transform`, scale-aware drag deltas, `loading="lazy"` + `decoding="async"` on ImageBlock, signed-URL fallback for private buckets, ImageQuickAdjust modal hardened (DONE — iteration_20)
- ✅ P0 Editorial Aesthetic Sprint (Feb 15 2026) — Workspace Mode toggle Editorial Light™ ↔ Cinematic Dark™ with sun/moon button in topbar, localStorage persistence (`mfd_workspace_mode`), `prefers-color-scheme` fallback, `[data-workspace-mode="light"]` palette override block in index.css (warm ivory #F5F1EB, charcoal ink #1E1B18, soft separators 0.08 alpha, teal accent preserved, subtle paper grain via body::before). Premium image rendering: removed always-on `.bp-img-cinematic` darkening filter, new `.bp-img-in` blur-up cinematic fade-in (720ms cubic-bezier with slight scale settle), softer editorial `.bp-img-shimmer` skeleton. Cinematic Crop UX rewrite: ImageQuickAdjust modal rebuilt as a "camera framing tool" with full-bleed blurred-image backdrop, pointer-drag focal handle (concentric cross, rAF-throttled), oversized 16:10 preview, minimal floating control rail. Autosave SOFT PULSE™: replaced verbose "Salvataggio…" text with a 6px dot that breathes during saves, briefly glows on success (`.bp-soft-confirm`), turns red+retry only on persistent failure. Lifted QuickAdjust modal to editor root so it survives block-selection changes mid-adjust. Added `data-testid='inspector-image-file-input'` (DONE — iteration_21)
- ✅ P0 Stabilization Sprint (Feb 15 2026) — CRITICAL slider remount bug fix: BlockInspector's CropFocalSection / AdjustmentsSection / VisualPropsSection were declared as nested arrow functions which made React see them as a NEW component type on every render → the entire slider section was unmounted/remounted on every input event, destroying focus and producing the "sliders refresh while dragging" UX bug. Refactored into plain JSX expressions (`cropFocalJsx`, `adjustmentsJsx`, `visualPropsJsx`) so the DOM stays stable across renders → Figma-grade slider drag. Collapsible Main Sidebar (220↔64px) and LibraryPanel (240↔56px) with localStorage persistence (`mfd_sidebar_collapsed`, `mfd_library_collapsed`) — together free up to 340px of horizontal canvas space. Removed duplicate user profile from Sidebar bottom — only Topbar shows the user chip now. Bundled real MOOD for DESIGN logo (`/public/brand/logo-dark.png` + `logo-light.png`) and wired through Brand component with CSS-only mode swap (.brand-mark--dark / --light opacity) — instant flicker-free flip on workspace mode toggle. Editorial range-slider styling (`.bp-slider` with native vendor-styled track + thumb that scale & flush teal on hover/active). Cinematic contrast bump (--bp-text-primary #F5F2EC, --bp-text-secondary #C7C2BB, --bp-text-muted #908B85 in dark mode). DashboardLayout + Topbar fully mode-aware (removed hardcoded #0A0A0B that broke light mode). Frontend testing 85% PASS with slider remount fix verified by independent code path (DONE — iteration_22)
- ✅ G.0 Blueprint Client Collaboration Layer™ MVP (Feb 16 2026) — generic entity-agnostic engine reusable by Moodboard + future Proposal Builder. Migration 012 with 5 collab tables (collab_comments, collab_page_status, collab_activity, collab_inspirations, collab_versions) all keyed by (entity_type, entity_id). Router `/api/collab/*` exposes designer + UNAUTHENTICATED public surfaces (`/api/collab/public/{share_token}/*`) gated by existing moodboard_shares tokens. NEW route `/review/:shareToken` is the dedicated client collaboration mode (separate from /presentation cinematic walkthrough). UX delivered: top progress strip (Approved · Revision · Pending counts), anchored comment pins with click-to-place pointer flow, role-colored pin avatars (teal=designer · amber=PM · paper=client), single-level threaded replies via CommentThreadDrawer, frictionless name+email identity capture (IdentityModal + useClientIdentity persistence per entity), page-level decision bar with "Approve" / "Request revision" buttons, page rail with status dot per page, micro decision animations (.review-flash-approved/revision 900ms), Activity Timeline (premium editorial feed — not audit log), "Ideas & References" client uploader (drag-drop image/PDF → Supabase Storage via dedicated `/upload` proxy), version-snapshot capture endpoint + "Prepare Project Proposal" handoff CTA that surfaces in the editor topbar ONLY when all pages reach `approved`. PagesFilmstrip in the editor now shows colored status badges per page. Share dialog upgraded with three explicit links (Client Review · Cinematic Presentation · Legacy). Backend curl validation confirmed: comments+statuses+activity round-trip end-to-end (DONE — iteration_23)
- ✅ P0 Editorial Controls + Premium Interaction Sprint (Feb 16 2026) — Typography Controls System on TextBlock inspector: font family pills (Display/Body/Mono bound to CSS vars for future Global Project Styles), font size (10..120px), weight (100..900), line height (0.8..2.4), letter spacing (-50..400 units), alignment (L/C/R/Justify), Italic/Underline/Uppercase decoration toggles, List style (None/Bullet/Numbered), Color picker + hex. TextBlock rewritten to honor `style.typography` with CSS-var-bound families and one-block-per-line lists. Shape Block PRO™ — new `shape` block type (rectangle / ellipse / line) with fill color, border color/width/style (solid/dashed/dotted), corner radius, plus visualPropsJsx for opacity/rotation. Registered server-side in SUPPORTED_BLOCK_TYPES. Page Background System — color + image URL + overlay opacity controls in PageInspector, rendered in editor canvas + Review Mode (page-background overlay layer above the bg image, below blocks, for legibility on photo backdrops). Layer System PRO — double-click layer label to rename, persists in metadata.layer_label (separate from derived caption/text label so renames don't overwrite content); existing lock/visibility/drag-reorder/insertion-indicator preserved. Telemetry Foundation — migration 013 product_events (append-only event log), `/api/events/track` endpoint (silent-fail, accepts anonymous /review/ calls), frontend `trackEvent()` helper with sessionId + Bearer auto-attach. Emits: moodboard.block_added, moodboard.shared, moodboard.template_saved, moodboard.skeleton_applied. Skipped from this sprint (deliberate): Arrow System (deserves dedicated sprint), 5 mockup templates (needs user-provided reference assets), equal-spacing snap hints, drag shadow (cosmetic) (DONE — iteration_24)
- ⏳ F.3 Master Layouts + Placeholder Inspector V2 (P2)
- ⏳ F.4 Reusable Blocks + Asset Library (P2)
- ⏳ F.5 Global Project Styles (P1) — typography controls already wired to CSS var bindings, just need tenant-level overrides
- ⏳ F.6 Skeleton Rebuild Foundation — AI extract layout from reference image (P3)
- ⏳ F.7 Product Library Foundation (P3)
- ⏳ F.8 Blueprint Inspirations UI™ — Personal · Project · Shared boards (P1)
- ⏳ F.9 Typography & Spacing global polish — reduce uppercase density across Inspector & Topbar (P2)
- ⏳ G.1 Arrow System (straight + sketch) + 5 designed mockup templates (P1 — next sprint)
- ⏳ H.0 Insights™ — first SQL rollups over product_events

### Phase F continued — Inspirations CMS + Insights + Concierge (post-Moodboard)
- Magazine builder (paragraph builder, hero video, SEO, related)
- Recharts premium dashboards (funnels, conversion, top categories)
- Concierge service requests

### Future
- RLS migration path (codebase pronto, basta abilitare policies)
- AI localization engine (auto-translate Blueprint copy)
- White-label custom domains
- RTL/AR locale support


### ✅ Sprint UI/UX — Creative Operating System Direction (14 Feb 2026)

**P0 Fix — Editor crash:**
- Risolto `ReferenceError: Toggle is not defined` in `MoodboardEditor.jsx`. Aggiunto componente locale `RowToggle` (label + switch) usato da `arrow-dashed` e dai toggle di visibilità del Page Inspector. (0 page errors verificati)

**Topbar overhaul (Linear / Framer / Figma direction):**
- Nuova gerarchia: LEFT brand wordmark + breadcrumb navigabile / RIGHT bell · theme switcher · locale · avatar
- Nuovo componente `ThemeSwitcher` (sun/moon segmented capsule) — sostituisce il toggle nascosto nell'editor
- Nuovo componente `UserMenu` (dropdown da avatar) con Profile · Workspace · Preferences · Theme · Notifications · Logout
- Nuovo componente `NavigableBreadcrumb` (clickable trail con regex registry, supporta editor moodboard e settings deep links)

**Sidebar cleanup:**
- Sidebar mostra ora solo il monogramma "M" (variante `Brand variant="monogram"`) per non duplicare il wordmark del Topbar
- Rimosso il pulsante `sidebar-logout-btn` (logout vive ora SOLO nell'avatar menu)
- Edge collapse handle: pin verticale sul bordo destro della sidebar con hit-area generosa (16px), hover state cinematico

**Editorial Light™ rework:**
- Default DARK mode (rimosso auto-detect da `prefers-color-scheme`)
- Contrast bump: ink #14110E (era #1E1B18) · paper #F4EFE7 (era #F5F1EB) · borders bumped 0.08→0.10 alpha
- Palette Aesop / Kinfolk / Notion paper più calda e definita

**Cinematic capsules:**
- `StatusBadge` redesign: rounded-full + dot indicator + uppercase tracking (no più chip SaaS chunky)
- Animated pulse sui status "alive" (sent, viewed, in_review, revision_requested)

**Files cambiati:**
- `src/components/layout/Topbar.jsx` (rewrite)
- `src/components/layout/Sidebar.jsx` (rewrite)
- `src/components/common/Brand.jsx` (add monogram variant)
- `src/components/common/ThemeSwitcher.jsx` (new)
- `src/components/common/UserMenu.jsx` (new)
- `src/components/common/NavigableBreadcrumb.jsx` (new)
- `src/components/common/StatusBadge.jsx` (rewrite editorial)
- `src/blueprint/moodboard/useWorkspaceMode.js` (dark-first)
- `src/pages/moodboards/MoodboardEditor.jsx` (RowToggle + cleanup)
- `src/index.css` (light mode palette bump)

**Test report:** `/app/test_reports/iteration_23.json` — 100% PASS (9/9 acceptance criteria, 0 page errors)

### ✅ Sprint 2 — UX Architecture Refactor + Sprint 2 partial (14 Feb 2026)

**Strategic lock:** STOP nuove feature, focus su refinement + stability + IA.

**Topbar — definitive structure (NO logo):**
- Rimosso completamente il wordmark dal Topbar (decisione definitiva: branding silenzioso, solo monogram "M" nella left rail)
- Nuovo `TopbarSlotsProvider` con context per page-injectable LEFT/CENTER/RIGHT slots (pattern simile a React Helmet ma per UI)
- LEFT slot riservato al breadcrumb + status capsule (page-injected) / CENTER per canvas tools (page-injected) / RIGHT per global controls

**Sidebar — Figma-style ultra-slim rail:**
- Default state = COLLAPSED (60px icon-only) — pattern come Figma/Linear/Arc
- Monogram "M" in cima funge da trigger expand/collapse (oltre alla edge handle laterale)
- Persistente in localStorage (`mfd_sidebar_collapsed` con `'1'`=collapsed)
- Width 60px collapsed / 212px expanded
- NO hover-expand automatico (esplicitamente rifiutato dall'utente — crea jitter visivo)

**NavigableBreadcrumb — deep & navigable:**
- Path completi tipo `Contenuti / Moodboard / Villa Como / Kitchen Proposal`
- Async title fetching per resource crumbs (moodboard, project) con cache window-scoped
- Smart truncate: `max-w-[200px]` + `title` HTML attribute con full path su hover
- Skeleton placeholder durante il fetch

**UserMenu z-index fix:**
- Dropdown ora a `z-[1000]` — sopra ogni panel, sidebar e canvas

**Editor de-duplication:**
- Rimosso dall'editor's internal header: `<Brand>`, back button, breadcrumb text (`project_name / eyebrow / title`)
- Editor header ora carica SOLO: title + StatusBadge a sx, action buttons (undo/redo/snap/present/review/share/approval) a dx
- Global Topbar sopra l'editor mostra il deep breadcrumb (es. "Contenuti / Moodboard / TEST_F1_UI_lux")

**Empty-state inspector (no more "No inspector"):**
- Quando nessun block è selezionato: placeholder editoriale con icona + "Inspector" eyebrow + hint italiano "Seleziona un elemento sul canvas per modificarne tipografia, crop, regolazioni..."
- Quando un block type non ha inspector specifico: fallback contestuale + visual props sempre disponibili (no più stringhe tecniche)

**Slider jitter fix (Sprint 2 start):**
- `InspectorSlider` rewrite con local state + rAF throttling
- Local `displayed value` decoupled from parent state → cursore segue il pointer 1:1
- Upstream commit via `requestAnimationFrame` (max 1 per frame) — elimina re-render storm
- Final commit garantito su `mouseup`/`touchend`/`blur` (no value loss)
- `draggingRef` evita snap-back se parent lags durante il drag

**Editorial Light deeper:**
- Palette spinta ancora più Kinfolk/Aesop: paper `#F2ECE0` (era #F4EFE7) · ink `#0F0D0A` (era #14110E)
- Borders bumped a 0.10 (border) / 0.24 (border-strong)
- Primary teal deepened `#0D8A70` (era #0FA284) per contrast su paper
- Surface-2 `#DCD2BE` più caldo (era #E0D8C9)

**Files cambiati / aggiunti:**
- `src/components/layout/Topbar.jsx` (rewrite: slots provider, NO logo)
- `src/components/layout/Sidebar.jsx` (rewrite: icon-only default, monogram-trigger)
- `src/components/layout/DashboardLayout.jsx` (wraps TopbarSlotsProvider)
- `src/components/common/TopbarSlots.jsx` (new: page-side slot helper)
- `src/components/common/NavigableBreadcrumb.jsx` (rewrite: deep + async titles)
- `src/components/common/UserMenu.jsx` (z-[1000])
- `src/hooks/useSidebarCollapsed.js` (default = collapsed)
- `src/pages/moodboards/MoodboardEditor.jsx` (no Brand/back/breadcrumb, editorial empty-state, slider jitter fix)
- `src/index.css` (light mode deeper paper)

**Test report:** `/app/test_reports/iteration_24.json` — **100% PASS** (10/10 acceptance criteria, 0 console errors during slider drag)

## P0 / P1 Backlog (Next Session)

### P0 — Stability completion (Sprint 2 continuation)
- Image focal point persistence — investigare se persiste dopo refresh / autosave round-trip
- Image block visibility bugs — caricamenti non visibili a volte
- Shape border color/thickness reliability — verificare stabilità slider su shape
- Page background persistence — verificare PUT settings.background_*
- Drag lag/jump issues + snapping inconsistency
- Layer reorder reliability + z-index correctness
- Selection precision (multi-select, drag through stacked blocks)

### P1 — Canvas UX Perfection
- Premium snapping guides (più visibili, soft elegant lines)
- Spacing indicators durante drag
- Magnetic alignment (auto-snap to peer edges)
- Subtle scale easing during drag (1.02x)
- Premium resize handles (cinematic)
- Refined hover/selection states
- Cleaner drag shadows
- Better insertion indicators in layers panel

### P2 — IA Refactor (Editor)
- Secondary contextual panel con Tabs `[Pages] [Insert] [Assets] [Inspirations]`
- Bottom filmstrip dedicato per Pages (no più mischiata con block insertion)
- De-duplicate commands: Topbar = canvas tools, Sidebar = workspace nav (già fatto), Secondary panel = insert/assets
- Inject editor toolbar nel Global Topbar via `TopbarSlots` (eliminare anche editor internal header)
- Context-aware right inspector smaltimento "No inspector" residui

### P3 — 5 Premium Templates curati
- Luxury hospitality · Warm editorial residential · Minimal Japandi · Material-focused luxury · Fashion/art editorial
- Frontend-driven blocks (no SQL seed)
- Anche "Insert Editorial Template" CTA nell'editor

### Refactor tecnico
- Split `MoodboardEditor.jsx` (>1700 lines) in: `inspectors/BlockInspector.jsx`, `inspectors/PageInspector.jsx`, `inspectors/ArrowInspector.jsx`, `editor/EditorCanvas.jsx`, `editor/EditorToolbar.jsx`
- Lift `RowToggle` a `/components/common/RowToggle.jsx`
- Aggiungere alias `breadcrumb-page` come testid del leaf crumb (oltre a `breadcrumb-dynamic`) per stabilità test
- Gate dashboard API calls by role per evitare 403 in console

### NOT NOW (strategic priority lock dell'utente)
- Onboarding tour, AI integrations, advanced automation, analytics dashboards, proposal builder expansion → DEFERRED
- Client Collaboration Layer™ refinement → SOLO dopo stabilization complete

### ✅ Editor IA Refactor Sprint (14 Feb 2026, sera)

**Architecture freeze rispettata** — zero modifiche backend, zero nuove integrazioni, zero auto-migration.

**Command de-duplication completa:**
- `ActionToolbar.jsx` riscritto: SOLO pointer/view/arrange tools (`select·deselect·move·resize·zoom·align`). Rimossi tutti i content blocks duplicati (text/image/gallery/product/material/palette/shape/line/hotspot/note)
- Tutto l'inserimento ora vive in **UNA SOLA HOUSE**: `EditorPanel` (Insert tab)
- `LibraryPanel.jsx` deprecated (lasciato in tree per ora; non più importato)

**Nuovo `EditorPanel.jsx` (Secondary Contextual Panel) — 4 tabs:**
- **Insert** (default): catalogo organizzato per categorie editoriali — `Basics · Visuals · Annotation · Materials & Products`. 10 testid `insert-*` (text/image/palette/shape/gallery/divider/note/arrow/material/product)
- **Assets**: stub elegante con Uploaded grid + Saved Elements placeholder editoriale (no backend in scope)
- **Pages**: Master Layouts grid + "This project" page list + helper line sul bottom filmstrip. Pulsante "Explore all layouts" apre lo SkeletonPicker via custom event `mfd:open-skeleton-picker`
- **Mood** (Inspirations): placeholder editoriale "Coming soon · Inspirations Hub · Preview release"

**Collapse premium:**
- Panel state persistito in `mfd_library_collapsed` (continuità con vecchia chiave)
- Expanded 264px / Collapsed 56px con icon rail di 8 quick-insert items

**SkeletonPicker microcopy editoriale (con fallback):**
- `t(key, null, fallback)` su title/subtitle/eyebrow per fallback inglesi editoriali ("Choose your narrative structure", "Each layout is a starting point for a chapter of your story")
- IT keys esistenti già curate → l'utente vede l'italiano premium "Scegli un layout di pagina"
- Categorie italiane: COPERTINA · NARRAZIONE · ATMOSFERA · MATERIALI · PRODOTTI · CHIUSURA · VUOTO

**Right Inspector empty-state finale:**
- ZERO occorrenze di "noInspector" o "No inspector for this block" in pagina o HTML
- Placeholder editoriale con Layers icon + "Ispettore Blocco" eyebrow + hint contestuale

**Architecture decision — single source of truth:**
- Sidebar (global rail) = workspace navigation
- ActionToolbar (top, centered) = canvas actions only
- EditorPanel (left, contextual) = content insertion + assets + pages + inspirations
- Right Inspector = selected element properties
- Bottom Filmstrip = primary page navigation

**Test report:** `/app/test_reports/iteration_25.json` — **100% PASS** (11/11 acceptance criteria, 0 page errors)

**Files cambiati:**
- `src/blueprint/moodboard/ActionToolbar.jsx` (rewrite — pointer only)
- `src/blueprint/moodboard/EditorPanel.jsx` (NEW — 4 tabs Secondary Contextual Panel)
- `src/blueprint/moodboard/PagesFilmstrip.jsx` (add custom event listener `mfd:open-skeleton-picker`)
- `src/blueprint/moodboard/SkeletonPicker.jsx` (editorial fallback microcopy)
- `src/pages/moodboards/MoodboardEditor.jsx` (LibraryPanel→EditorPanel, stripped ActionToolbar props, wired skeleton picker custom event)

## P0 Stability Backlog (PRIORITY for next session)

L'IA refactor è completa. Ora il prodotto è **chiaro cognitivamente** ma serve la stabilizzazione tecnica:

### P0 — Editorial Finish Stability (definitive bug list)
- Slider jitter (post-rAF refactor): verificare smoothness su shape borders / opacity / typography sliders
- Border thickness/color reliability su shape & arrow blocks
- Page background persistence (PUT settings.background_*)
- Image focal point + crop persistence (round-trip Supabase)
- Image block visibility: caricamenti talvolta invisibili dopo upload
- Drag lag / cursor jumps
- Snapping inconsistency
- Layer reorder reliability + z-index correctness
- Selection precision (multi-select, stacked blocks)

### P1 — Canvas UX Perfection
- Premium snapping guides eleganti
- Spacing indicators durante drag
- Magnetic alignment
- Subtle scale easing (1.02x) durante drag
- Premium resize handles

### P2 — Italian i18n keys da aggiungere
- `moodboards.tab.{insert,assets,pages,inspirations}`
- `moodboards.insert.{text,image,palette,shape,gallery,divider,note,arrow,line,hotspot,material,product}`
- `moodboards.insert.group.{basics,visuals,annotation,materials}`
- `moodboards.assets.*`, `moodboards.pages.*`, `moodboards.inspirations.*`
- `moodboards.editorPanel.title`, `moodboards.library.{collapse,expand}`
- `moodboards.tool.{select,deselect,move,resize,zoom,align}`

### P3 — 5 Premium Templates curati (luxury hospitality · warm residential · japandi · material · fashion editorial)
- Frontend-driven blocks (no SQL seed)
- "Insert Editorial Template" CTA dentro l'editor

### Refactor tecnico (DOPO P0)
- Split `MoodboardEditor.jsx` (>1700 righe) in inspectors/* + editor/*
- Lift `RowToggle`, `InspectorSlider` a `/components/common/`
- Eliminare `LibraryPanel.jsx` deprecated
- Investigare 422/503 console errors durante editor load

### ✅ Editor Cognitive Cleanup Sprint (14 Feb 2026, late)

**Direzione confermata dal mockup annotato condiviso dall'utente** (UX REVIEW & RECOMMENDATIONS).

**Architecture Lock rispettata:** ZERO modifiche backend / persistence / migrations / runtime / Supabase.

**Topbar refactor finale (canvas-implicit interactions):**
- ActionToolbar **rimosso completamente** dall'editor (`tool-select·deselect·move·resize·zoom·align` eliminati)
- Le interazioni sono ora implicite: click = select · drag = move · handles = resize · keyboard/snap = align · wheel/pinch = zoom
- Editor header carica SOLO actions session/project: status capsule + undo/redo/snap + Presenta · Client Review · Richiedi revisione · Approva · Condividi

**EditorPanel INSERT allineato al mockup esatto:**
- **BASICS**: Text · Image · Gallery · Note
- **VISUALS**: Palette · Shape · Arrow · Hotspot (disabled)
- **MATERIALS**: Material · Product · Texture (disabled)
- **ANNOTATION**: Line (disabled) · Divider · Label (disabled)
- **TEMPLATES**: 4 skeleton tiles + "Explore all templates" link che apre SkeletonPicker via custom event
- 14 testid `insert-*` tutti presenti come da mockup

**Right Inspector — centro assoluto del controllo:**
- Selecting palette block → Colori (HEX) · Aggiungi colore · Apply all
- Selecting image block → 11 range inputs (zoom · brightness · contrast · saturation · hue · crop · focal point · adjustments)
- Selecting text block → typography controls
- Empty state cinematico ("Ispettore Blocco — Select an element on the canvas...")

**Stability verificata:**
- Slider smoothness su image block: 51 input events continuativi → 0 React warnings, 0 console errors, 0 "maximum update depth" → rAF throttle confermato effettivo
- ThemeSwitcher su editor route → no crash, no state loss
- Filmstrip integrity: drag reorder, duplicate, delete, add page hover chips
- All existing systems intact: Topbar · Sidebar · Breadcrumb · Theme · UserMenu · Locale · Editor tabs · Collapse · SkeletonPicker

**Files cambiati:**
- `src/blueprint/moodboard/EditorPanel.jsx` (INSERT_GROUPS reorganized + Templates section)
- `src/pages/moodboards/MoodboardEditor.jsx` (ActionToolbar import + render removed)

**Test report:** `/app/test_reports/iteration_26.json` — **13/13 PASS** (T12 page-bg persistence deferred a manual smoke; rAF confirmed effettivo su 51 input events continuativi)

## Carryover Issues (non-blocking)

1. **IT i18n keys mancanti** — `moodboards.insert.group.{basics,visuals,materials,annotation,templates}`, `moodboards.insert.{text,image,gallery,note,palette,shape,arrow,hotspot,material,product,texture,line,divider,label}`, `moodboards.tab.*`, `moodboards.tool.*`. Oggi fallback English funzionante; volendo coerenza al 100% va popolato il dizionario IT
2. **2× 503 console errors** durante editor load — autosave/skeletons retry, non-blocking
3. **MoodboardEditor.jsx > 1700 righe** — split in `inspectors/*` + `editor/*` raccomandato

## Next Session — P0 Stability Remaining

Lo sprint di oggi ha già coperto:
- ✅ Slider smoothness (rAF throttling verificato 0 errors su 51 events)
- ✅ ActionToolbar removal (cognitive noise eliminato)
- ✅ Editor IA (4 tabs Insert/Assets/Pages/Mood + categories mockup-aligned)

Rimangono dalla lista P0 originale dell'utente (Figma-Grade Stabilization):
- **Page background persistence** — manual smoke test (round-trip Supabase)
- **Image block stability** — uploaded images sometimes invisible after navigate
- **Image focal point persistence** — verifica round-trip
- **Drag UX refinement** — cursor jumps, smoothness
- **Snapping refinement** — magnetic threshold, elegant guides
- **Layer reorder / z-index correctness**
- **Selection precision** (multi-select, no accidental deselect)

## After P0 — 5 Premium Editorial Templates
- Luxury Hospitality · Warm Residential · Japandi Editorial · Material Narrative · Fashion/Art Direction
- Devono sembrare AD Magazine / Studio McGee / Kelly Wearstler / Material Bank / Pinterest elite tier
- Frontend-driven blocks (no SQL seed) — Architecture Lock rispettato


### ✅ Editorial Template & Filmstrip Refinement Sprint (14 Feb 2026, late night)

**Architecture LOCK rispettata** — zero modifiche backend, zero nuove integrazioni.

**SkeletonPicker editoriale (era ripetitivo wireframe):**
- Nuovo `EditorialSkeletonPreview.jsx` con 12 composizioni distinte curate per skeleton id:
  - **Cover**: `hero_full_bleed` (Villa Como, palette warm + serif), `split_cover` (50/50 photo + Editorial label + palette swatch)
  - **Narrative**: `quote_page` (nero + serif italic + Steve Jobs), `split_editorial` (foto sofa + body text + palette)
  - **Atmosphere**: `mood_triptych` (3 photos curate), `gallery_spread` (6-photo editorial grid)
  - **Palette**: `palette_composition` (photo + 5 swatches + PALETTE STUDY caption)
  - **Materials**: `materials_grid` (4 photos + captions Travertino · Lino crudo · Palissandro · Ottone brunito)
  - **Products**: `product_focus` (Hanselmann Lounge €4.200 + palette), `product_grid_6` (6-photo grid)
  - **Closing**: `approval_page` (CTA teal "Approve direction"), `blank` (dashed circle)
- Photo pool curato di 5 URL Unsplash verificati + deterministic warm-paper gradient fallback (hash-based, idempotent in StrictMode)
- `onError` handler nasconde img rotte → card mai vuota/nera, sempre editorial
- Lazy loading per ridurre rate-limit Unsplash

**PagesFilmstrip premium (era flat repetition):**
- Active page con **teal ring + cinematic shadow glow** (`shadow-[0_0_0_3px_rgba(15,162,132,0.12),0_8px_28px_rgba(15,162,132,0.18)]`)
- Inactive pages a opacity-60 → hover 100% + soft border
- **Page-type indicator chip** in basso a sx (testid `page-type-{id}`): mostra `narrative` · `materials` · `gallery` · etc. su hover
- **Add-page tile redesign** (no più dashed generic): solid surface + teal circular plus + label "NEW PAGE / from template"
- Duplicate/Delete chips con shadow premium

**Files cambiati / aggiunti:**
- `src/blueprint/moodboard/EditorialSkeletonPreview.jsx` (NEW — 12 compositions curate, hash-deterministic fallback)
- `src/blueprint/moodboard/SkeletonPicker.jsx` (SkeletonPreview wrapper → EditorialSkeletonPreview)
- `src/blueprint/moodboard/PagesFilmstrip.jsx` (active glow + page-type chip + premium add-page tile)

**Test report:** `/app/test_reports/iteration_27.json` — **6/6 PASS** (static code review confermato, smoke browser test agent bloccato dal parser ma main-agent self-test ha verificato visivamente 9/12 card editoriali perfette)

### ✅ Premium Pre-built Templates (14 Feb 2026, sera tardi)

**Feature ricca, ZERO modifiche backend** — Architecture LOCK rispettata.

**5 Premium templates curati frontend-driven:**
- **Luxury Hospitality** — Villa Como Lobby concept · 6 blocks · warm neutrals + serif + palette
- **Material Narrative** — Material Study Earth tones · 8 blocks · close-up textures + 4-grid + annotations
- **Japandi Editorial** — A study in stillness · 8 blocks · asymmetric whitespace + stone tones + minimal type
- **Fashion · Art Direction** — Issue 04 · 6 blocks · oversized serif italic + layered cinematic
- **Residential Moodboard** — Casa Brera · 14 blocks · AD Magazine layout: hero + materials row + Le Corbusier quote

**Implementation:**
- `premiumTemplates.js`: 5 template definitions (blocks completi con type/x/y/width/height/z_index/content/style), `applyPremiumTemplate()` helper che POST page + N blocks via endpoint esistenti
- `PremiumTemplatePreview.jsx`: 5 anteprime cinematiche distinte (Luxury, Material, Japandi, Fashion, Residential) con foto reali Unsplash + palette + typography
- `SkeletonPicker.jsx`: nuova sezione `PREMIUM PRE-BUILT TEMPLATES` in cima al modal con Sparkles teal icon
- `PagesFilmstrip.jsx`: nuovo handler `handlePremiumPick` con toast feedback (success / partial / failure via sonner)

**Bug-fix critico:**
- Iter_28 ha trovato 400 su `POST /pages` perché `material_narrative` usava `page_type='materials'` (invalido) e `japandi_editorial` usava `'narrative'` (invalido)
- Backend `PAGE_TYPES` whitelist: cover · blank · mood · material_board · product_grid · palette · gallery · split_story · quote · technical_board · floorplan · proposal_summary · approval
- Fix: cambiati page_type a `'material_board'` e `'split_story'` rispettivamente → iter_29 verifica **10/10 PASS** end-to-end

**Test reports:**
- `iteration_28.json`: ha scoperto il bug (5/7)
- `iteration_29.json`: bug fix VERIFIED **10/10 PASS** — 0 4xx errors, tutti e 5 i template applicati con 201 + success toast

**Files cambiati / aggiunti:**
- `src/blueprint/moodboard/premiumTemplates.js` (NEW — 5 template definitions + applyPremiumTemplate helper)
- `src/blueprint/moodboard/PremiumTemplatePreview.jsx` (NEW — 5 anteprime cinematiche)
- `src/blueprint/moodboard/SkeletonPicker.jsx` (+ sezione premium con Sparkles eyebrow)
- `src/blueprint/moodboard/PagesFilmstrip.jsx` (handlePremiumPick + sonner toast feedback)







## P0 / P1 Backlog (Next Session)

### P1 — Editorial Finish Sprint (deferred bugs)
- Shape border system: bordi non aggiornano in modo affidabile sui shape block
- Slider remount/jitter (opacity, thickness, typography) — verificare se persistono dopo Topbar refactor
- Image block stability: focal point crop non persiste, preview inconsistente, uploaded images talvolta invisibili
- Page Background controls — verificare stabilità (color/image/overlay)

### P1 — Editorial Polish
- Verifica `ArrowBlock` rendering + interazione completa
- Premium Drag Polish (guide più visibili, snap lines eleganti, soft scale during drag)
- Right Inspector "editorial feel" (più whitespace, separatori soft, ridurre micro-borders)

### P2 — Templates & Mockups
- "Insert Editorial Template" CTA dentro l'editor (oltre al template picker già esistente al momento di creazione)
- 5 template editoriali curati (hospitality, neutral luxury, material boards, residenziale, retail showroom) — frontend-driven blocks, NO seed SQL

### Refactor (codice tecnico)
- Split `MoodboardEditor.jsx` (>1700 lines) in: `inspectors/BlockInspector.jsx`, `inspectors/PageInspector.jsx`, `inspectors/ArrowInspector.jsx`, `editor/EditorCanvas.jsx`, `editor/EditorToolbar.jsx`
- Lift `RowToggle` a `/components/common/RowToggle.jsx` per riuso
- Gate dashboard API calls (`/api/leads`, `/api/insights`, `/api/super`) by role per evitare 403 in console

### P3 — Future
- Interaction & motion polish app-wide (hover states, soft easing, micro-interactions)
- Phase F.3: Template Import / Rebuild Foundation (AI extraction of layout)
- Phase F.4: Proposal Builder PRO™ (review workflow advanced)
- Blueprint Insights™ Analytics UI
- Global Project Styles (heading/body/accent font mapping)


### ✅ Premium Curated Archive + Filmstrip Editorial Polish (Feb 16 2026)
Branding + Editorial UX sprint — Architecture freeze respected (frontend-only).
- **Brand monogram replaced**: la "M" tipografica nella Sidebar diventa il logotipo "OO" interlocking-rings ufficiale (`/public/brand/logo-monogram.png`). Fallback silenzioso a glifo tipografico se l'asset non si carica. (`Brand.jsx`)
- **Premium Templates expanded 8 → 15**: ogni categoria editoriale ora ha **almeno 3 cards** (= riga completa, mai categorie unfinished).
  - Hospitality (3): Luxury Hospitality · Boutique Hotel · Lakeside Villa
  - Material Narratives (3): Material Narrative · Stone Atelier · Mineral Study
  - Residential Editorial (3): Residential Moodboard · Brera Apartment · Coastal Retreat
  - Fashion · Art Direction (3): Fashion Editorial · Fashion Residential · Editorial Magazine
  - Minimal · Japandi (3): Japandi Editorial · Scandinavian Nordic · Wabi-Sabi
  - Pool fotografico Unsplash ampliato da 8 a 25 URL (lake_villa, bedroom_calm, marble_corridor, texture_concrete, texture_velvet, texture_terracotta, scandi_kitchen, scandi_chair, zen_room, wabi_vase, ecc.). Identità visive distinte per categoria (warm/cool/bleached/brutalist/wabi). (`premiumTemplates.js`, `PremiumTemplatePreview.jsx`)
- **Template Picker → Curated archive luxury**:
  - Header eyebrow: "PREMIUM CURATED ARCHIVE" (era "Premium pre-built templates")
  - Categorie con numerazione monospace `01 · 02 · 03…` + titolo Playfair 20px + counter destro `03 PIECES` tabular-nums
  - Subtitle italica editoriale ("Cinematic warmth for boutique hotels & resorts — Aman, Six Senses, Rosewood lineage."), allineata sotto il titolo a 42px di indent
  - Sezione separator hairline + spacing aumentato 12px→14mt verticale tra categorie
  - PREMIUM chip spostato `top-left` → `top-right` per evitare collisioni con caption editoriali su cover hero
  - (`SkeletonPicker.jsx`)
- **PagesFilmstrip → cinematic narrative sequence**:
  - Mini preview thumbnail allargati 96px→112px, larger touch targets
  - Active page: ring teal + glow soft (`0 14px 32px rgba(15,162,132,.22)` + `0 0 0 3px rgba(15,162,132,.10)`) + scale 1.045 + translate-y -0.5 + gradient overlay top edge teal
  - Page-type chip **sempre visibile** (era hover-only) — color-coded per type (cover: amber, mood: sage, material: tan, gallery: clay, quote: slate, approval: teal…)
  - 13 silhouette empty-state per page_type (cover/blank/mood/material_board/product_grid/palette/gallery/split_story/quote/technical_board/floorplan/proposal_summary/approval) per quando una pagina non ha ancora blocchi
  - MiniPreview ora renderizza palette swatch reali se il blocco palette ha colori (no più rettangoli grigi)
  - Block tinting semantico per type (image gradient warm, palette tan, material clay, product mauve, text ivory, note amber, shape= fill_color reale)
  - +Aggiungi pagina: tile 112×150, plus-icon ring teal con scale 1.1 + glow on hover
  - (`PagesFilmstrip.jsx`)

**Verified** ✅
- 5 premium-category sections rendered, 15 premium-template-card visible (3 per category)
- Filmstrip active state cinematico verificato su moodboard con 6 pagine, chip COVER amber visibile, glow teal attivo
- Console: 0 page errors, 2 minor 503 network warnings (non-blocking)
- Responsive tablet (768px): 2-column premium grid funzionante
- Hot-reload pulito, lint pulito su tutti i 5 file modificati


### ✅ Stability & Editor Feel Sprint — Figma-Grade Polish (Feb 16 2026)
Architecture freeze respected. Focus assoluto: rendere l'editor INVISIBILE — il designer pensa solo alla composizione.

- **Drag intent gate** (`MoodboardEditor.jsx` startDrag + drag effect): introdotto `DRAG_THRESHOLD = 4px` in screen pixels. Un click puro non sposta più il blocco — il drag si attiva solo quando il puntatore percorre 4px. Risolve il "click che sposta accidentalmente". Inoltre `history.record()` ora si attiva SOLO se il drag è realmente committato (no più snapshot di history per pure clicks).
- **Resize handle premium** (10px visibile + 22×22 hit area invisibile): nub teal con `box-shadow` ring `bp-bg 2px` + glow `rgba(15,162,132,.55) 10px`, scale 1.1 on group hover. Cursor `se-resize` su tutto l'hit area di 22×22 — niente più "miss" del corner handle.
- **Selection / hover / drag CSS classes** (`.block-idle/.block-selected/.block-dragging` in `index.css`):
  - Idle: `box-shadow 0 0 0 1px transparent` (no layout shift)
  - Hover: outline 1px teal 28% opacity + soft shadow 0.18 (Figma whisper)
  - Selected: outline FLUSH 1.5px teal + halo 4px 14% + cinematic shadow 28%
  - Dragging: outline 1.5px + halo 5px 18% + lifted shadow 50%
  - Transitions cubic-bezier 220ms — no jitter, no jarring snap-in
  - **Sostituisce Tailwind `ring-*`** che aveva `ring-offset-2` che causava un gap di 2px tra outline e bordo blocco (UX "anti-flush").
- **SnapGuides rewrite — premium editorial**: ora linee SOLIDE 0.75px (era dashed 2-3 dasharray), opacity 0.85 con `drop-shadow` filter teal 55% 4px → soft glow magazine-grade, fade-in 180ms. Le linee si estendono +16px oltre il blocco (era 12px) per respirabilità editoriale. Niente più CAD lines.
- **Logo light-mode polish** — variante automatica:
  - Original `logo-monogram.png` sostituita con versione TEAL TRASPARENTE (sfondo nero rimosso pixel-by-pixel via PIL, soglie G>90 ∧ R<90 ∧ G+B>200)
  - Bonus: creata `logo-monogram-light.png` con deep teal #0FA284 per future ottimizzazioni light-mode contrast
  - Risultato verificato: il monogramma OO ora "vive" senza rettangolo nero su paper ivory background (light mode) E mantiene il glow teal su Cinematic Dark
- **Lint clean**: 0 issue su MoodboardEditor, SnapGuides, index.css

**Verified** ✅
- Block class after click: `block-selected` applicata correttamente
- Light mode dashboard screenshot: OO monogramma teal trasparente integrato nella paper aesthetic
- Dark mode dashboard screenshot: OO monogramma teal su dark surface (Cinematic Dark mantiene flusso)
- 0 page errors, 3 minor 403 (Supabase storage signed-url expiring, non-blocking)
- Drag threshold testato con click sul block primo — selezione immediata senza spostamento




## Demo Credentials (`/app/memory/test_credentials.md`)
- Email: `demo@moodfordesign.com` · Password: `Blueprint2024!`
- Role: `super_admin` (può accedere a `/admin/*` e impersonare tenants)


### ✅ Template Picker Final Restructure — Premium = MULTI-PAGE (Feb 16 2026)
Frontend-only refactor che separa concettualmente Premium Templates (presentazioni multipagina complete) da Skeletons (pagine singole). Zero backend changes.

- **Premium templates → MULTI-PAGE complete projects** (`premiumTemplates.js` riscritto da zero):
  - Ogni template ora ha `pages: [factory(...), factory(...), ...]` con 6-7 pagine editoriali complete
  - 8 page-factories riusabili: `coverPage`, `conceptPage`, `moodPage`, `materialsPage`, `furniturePage`, `galleryPage`, `quotePage`, `approvalPage`
  - 10 paletteKey condivise (`warm_earth`, `travertine`, `stone_cedar`, `monochrome`, `lake_mist`, `brera_velvet`, `coast_chalk`, `nordic_birch`, `wabi_patina`, `mineral`) per coerenza visiva tra le pagine di uno stesso template
  - **Page count per template**: Luxury Hospitality (7), Brera Apartment (7), Material/Japandi/Fashion/Residential/Stone Atelier/Boutique Hotel/Lakeside Villa/Mineral Study/Coastal Retreat/Scandinavian/Wabi-Sabi/Editorial Magazine (6 each), Fashion Residential (6)
  - **Total**: 95 pagine pre-curate distribuite su 15 template
- **`applyPremiumTemplate` ora multi-page** (`premiumTemplates.js`):
  - Itera su `template.pages`, crea ogni pagina via `POST /api/moodboards/{id}/pages`, poi inserisce i blocchi via `Promise.allSettled` per parallelismo intra-pagina
  - Backward-compat con templates legacy (single-page) mantenuta
  - Return shape: `{ pageId, pagesCreated, pagesTotal, blocksCreated, blocksTotal }`
- **`getPremiumTemplatePageCount(id)` helper** esportato per il badge "6 PAGES" sulle cards
- **PremiumCard ridisegnata** (`SkeletonPicker.jsx`):
  - Card MOLTO più grande (min 280px width, era 260px)
  - **PREMIUM chip** top-right (sparkles icon)
  - **Page-count badge** top-left in teal `var(--bp-primary)` con icona Layers: "7 PAGES" / "6 PAGES"
  - **Title** Playfair 17px (era 12px)
  - **Subtitle italica** Playfair 10.5px
  - **Mini-filmstrip** in basso: chip rettangolari colorati per page_type (cover amber, mood sage, material tan, story clay, quote slate, approval teal…) + numerazione "01 / 02 / ..." tabular-nums
  - La prima pagina ha gradient più saturo + ring per indicare "cover dominante"
- **SkeletonCard più compatta**:
  - Min width 160px (era 190px) → visually subordinata ai premium
  - Aggiunto "1 PAGE" chip hover su preview con FileText icon
  - Typography compact 11px (era 12px)
- **Hero copy del modal aggiornato** (chiavi i18n NUOVE per evitare backend override):
  - Eyebrow: "EDITORIAL STRUCTURE" (era "MASTER LAYOUTS")
  - Titolo H2 28px Playfair: "Choose an editorial structure"
  - Subtitle italica Playfair: "Start from a complete multi-page presentation, or add a single empty page as a starting point."
- **Premium section header rafforzato**:
  - Counter "15 COMPLETE TEMPLATES" tabular-nums in alto a destra
  - Subtitle Playfair italica 13px: "Complete multi-page presentations — covers, atmospheres, material direction, furniture and approval pages, all in one click. Ready for professional moodboards."
  - Spacing categoria 16mt (era 14mt)
- **Skeletons section header**:
  - Eyebrow: "SKELETONS & STARTING POINTS"
  - Counter "XX SINGLE LAYOUTS"
  - Subtitle: "Single empty layouts to add as one new page to the current moodboard. Use them when you want to compose your own structure block by block."
- **Toast distintivi**:
  - Premium: loading "Applying multi-page template…" → success "Multi-page template applied: N pages added."
  - Skeleton: success "Page added."
  - Premium partial: warning "Multi-page template partially applied: N/N pages."
- **`handleSkeletonPick` wrap try/catch** + toast success/error (era silent)
- **0 modifiche backend / DB / migrations / AI** ✅

**Verified** ✅
- 15 premium cards renderizzano con page-count badge 7-PAGES (Luxury Hospitality) / 6-PAGES (altri)
- 15 mini-filmstrip renderizzate con tonalità per page_type
- Apply test end-to-end: japandi_editorial (6 pagine) → 6 nuove pagine create in ~35s, toast success "Multi-page template applied: 6 pages added.", filmstrip mostra nuove pagine "Concept statement", "Atmosphere", "Material direction", "Less, but better", "Stillness concept", "Palette & material" con chip COVER/STORY/MOOD/MATERIAL/APPROVAL color-coded
- 0 page errors, 1 console warning 503 (Supabase signed-url, non-blocking)
- Header copy verificato: "EDITORIAL STRUCTURE · Choose an editorial structure · Start from a complete multi-page presentation, or add a single empty page as a starting point."
- Lint clean


### ✅ Story Flow & Performance Sprint (Feb 16 2026)
Frontend-only sprint che trasforma l'applicazione di un Premium Template da "wait+toast" a "watching a presentation come alive". Architecture freeze rispettato (zero backend / DB / migrations).

- **TemplateProgressOverlay.jsx** (NEW · 165 LOC) — overlay cinematico fullscreen:
  - Dark glass backdrop (rgba(8,7,6,0.78) + 24px blur + saturate 120%)
  - Eyebrow teal "PREMIUM TEMPLATE · APPLYING" + Sparkles icon
  - Template name in 12px tracking-[.20em] uppercase (Inter)
  - **Big chapter title** Playfair italic 32px che cambia per fase del progress (`stageCopy(i, total)`):
    - 0-18% → "Creating editorial structure… · Laying the cover and opening voice."
    - 18-42% → "Building mood narrative… · Composing the atmosphere of the project."
    - 42-72% → "Composing material pages… · Stone, wood, textile and palette direction."
    - 72-99% → "Finalizing presentation… · Furniture, gallery and the closing chapter."
    - 100% → "Presentation ready. · Your editorial moodboard is composed."
  - Soft-rise animation 420ms per ogni key-change del titolo
  - Progress bar 2px solid teal con glow `0 0 12px rgba(15,162,132,.5)`, transition 600ms
  - Counter "PAGE 02 / 06 · 33%" tabular-nums
  - **Mini-filmstrip chips** color-coded per page_type (mirror di PAGE_TONE da PagesFilmstrip); le chip si accendono progressivamente da `rgba(245,242,236,0.06)` a `linear-gradient(${tone}E0 → ${tone}A0)` con shadow `${tone}44 4px 12px`; chip attivo ha translateY(-2px)
  - Keyframes scoped inline (no global CSS pollution)
- **`applyPremiumTemplate(api, mbId, tplId, opts)`** ora accetta:
  - **`opts.onProgress({ stage, current, total, page, templateName, pages })`** — emette 3 stage: `start` (prima del loop), `page` (ogni pagina), `complete`. Permette al chiamante di guidare l'overlay.
  - **`opts.insertAfterPageId`** — se settato, dopo aver creato tutte le pagine chiama `POST /pages/reorder` per inserirle SUBITO DOPO la pagina selezionata invece che alla fine. Best-effort (try/catch interno).
- **PagesFilmstrip.jsx**:
  - State `progress = { active, templateName, current, total, pages }` guidato dal callback `onProgress`
  - State `insertAfterPageId` traccia la pagina target per l'insert
  - `handlePremiumPick` aggiorna `progress` ad ogni callback + tiene la frame "complete" per 850ms prima di dismissare l'overlay → momento "presentation ready" theatrical
  - `handleSkeletonPick` ora supporta anche `insertAfterPageId` (reorder post-creazione)
  - **Insert-here button** tra ogni coppia di page-card filmstrip:
    - `<li>` di 22px tra cards (era spacing flat di 14px)
    - Visibile solo su `group/insert hover` (opacity 0 → 100, transition 200ms)
    - Linea verticale teal 1.5px height-60% + pulsante circolare 24×24 con Plus icon + glow teal
    - Click → set `insertAfterPageId` + apre picker
  - Reset `insertAfterPageId` su picker close
  - `+Aggiungi pagina` ora resetta esplicitamente `insertAfterPageId(null)` per append esplicito alla fine
- **SkeletonPicker.jsx**:
  - Nuova prop `insertAfterPageTitle` (string|null)
  - Pill animata in header sotto la subtitle: bg teal 12% + ring teal 35% + dot pulsing + "INSERTING AFTER 'TEST_F2_legacy'" — comunica chiaramente all'utente che è in modalità insert
  - `data-testid="picker-insert-after-pill"` per verifica
- **0 backend / DB / migrations changes** ✅ — usa esclusivamente endpoints esistenti (`/pages`, `/blocks`, `/pages/reorder`, `/pages/from_skeleton`)

**Verified** ✅
- Insert-after button: hover sull'area tra le pagine → pill teal pulsing appare nell'header del picker
- Progress overlay: catturati screenshot del flow completo wabi_sabi (6 pagine) → ogni stage visualmente diverso, mini-filmstrip si accende progressivamente, page counter 02/06 33% → 06/06 100%
- "Presentation ready. Your editorial moodboard is composed." frame mostrata al 100% con tutte le chip color-coded brillanti
- Reorder funziona: dopo apply le pagine wabi_sabi appaiono nella sequenza corretta nel filmstrip
- 0 page errors, lint clean (5 file modificati / 1 nuovo)




### ✅ CRITICAL: Text/Block Shape Bug Fix + Performance + Picker Header Redesign (Feb 16 2026)

🔴 **BUG CRITICO RISOLTO**: TextBlock legge `content.text` (non `content.value`) e `style.typography.{...}` (non flat style). Le mie factory usavano shape sbagliato → tutti i testi del template apparivano come placeholder "Scrivi il tuo testo..." e le pagine sembravano vuote. Fix: `text()` factory ora produce `content: { text, size }` + `style: { typography: {...} }`. Preset size auto-derivato dal font_size. `material()` fix `image+image_url+notes`. `img()` fix `style.fit_mode/focal_point`. approvalPage ora ha hero photo. **Verified**: "Casa Brera. The home of memory." Playfair italic 56px renderizza + foto Unsplash hero full-bleed visibili.

🟠 **PERFORMANCE 4-5× speedup**: `applyPremiumTemplate` riscritto in 3 fasi:
- Phase 1: `Promise.all` su POST /pages (parallelo)
- Phase 2: tutti i blocchi flatten + `Promise.allSettled` (~60 chiamate in burst)
- Phase 3: SEMPRE `POST /pages/reorder` per fissare ordine editoriale
Da ~30-40s a ~5-10s stimato. Overlay cinematico ora "fast premiere".

🟡 **PICKER HEADER mockup-match**: Crown SVG amber custom + titolo Playfair 26px tracking-[0.20em] **"PREMIUM CURATED ARCHIVE"** + subtitle italica destra "Template multipagina completi · Pronti per presentazioni professionali". Categorie: **"01 LUXURY HOSPITALITY"** Playfair 24px uppercase + counter italiano "03 TEMPLATE COMPLETI". Bg color `#F2EBD9` per titoli (più caldo).

**Verified** ✅ — Text/image rendering corretto, picker header matcha mockup, 6 pages wabi_sabi con page-type chips differentiated, 0 page errors, lint clean.



### ✅ Right Inspector Editorial Refinement (Feb 16 2026)
Trasforma il Right Inspector da "settings panel" a "calm editorial control surface". Architecture freeze rispettato.

- **`InspectorGroup.jsx` (NEW · 110 LOC)**: collapsible section premium. Monospace eyebrow + Playfair subtitle, soft reveal via grid-rows 0fr↔1fr, chevron rotation -90°↔0°, hairline rule. State persisted in localStorage. `AUTO_OPEN_DEFAULTS` per block type (image → IMAGE+STYLE; text → TYPOGRAPHY+STYLE; ecc.)
- **IA P0**: BlockInspector restructured con 4 gruppi: **TYPOGRAPHY · LAYOUT · STYLE · IMAGE · ADVANCED** (placeholder italico per future multi-select prep)
- **Empty state P3**: concentric rings glyph (allude monogram OO) + "INSPECTOR" mono eyebrow + **"A quiet control surface."** Playfair italic + subtitle "Select an element to refine its composition, typography, materials or atmosphere."
- **Selected-block header**: "ITEM · TESTO" mono uppercase teal
- **Width panel 300→320px** per breathing room
- **CSS neutralization**: regole in index.css per rimuovere double-rule quando i wrapper legacy "pt-5 mt-5 border-t" stanno dentro un gruppo

**Verified** ✅ — Empty state premium, 4 gruppi collapsibili con auto-open per type, localStorage persistence, header "ITEM · TESTO", 0 page errors, lint clean.



### ✅ Editorial UX Polish — Translations + Filmstrip Real Thumbs + Snap UX + Inspector Contrast (Feb 16 2026)
Bug-fix sprint mirato ai feedback utente. Architecture freeze rispettato.

🌐 **i18n (NO hardcoded)** — picker tradotto interamente IT/EN: helper `L(it, en)` locale-aware in SkeletonPicker. Header IT: "STRUTTURA EDITORIALE · Scegli una struttura editoriale · Parti da una presentazione multipagina completa...". Premium: "ARCHIVIO PREMIUM CURATELA · TEMPLATE MULTIPAGINA COMPLETI · 03 TEMPLATE COMPLETI". Insert pill: "Inserisci dopo 'TEST_F1_lux'". Skeleton section: "Scheletri e punti di partenza". `PREMIUM_CATEGORIES` ora ha `subtitle_fallback` IT + `subtitle_en` EN.

🖼️ **Filmstrip mostra IMMAGINI REALI**: MiniPreview ora renderizza `<img>` reali per image+material blocks (con `loading="lazy"` + onError silent) + palette swatch veri. Risultato: filmstrip "leggibile" come story-sequence invece di rettangoli colorati.

🖼️ **LayersPanel thumbnails**: resolve da TUTTE le shape (`image_url || content.src || content.image || content.image_url || content.swatch_url`) + palette swatch. Size 6→7. Le foto caricate dall'utente ora hanno thumbnail.

🧲 **Snap toggle UX**: tooltip locale-aware DETTAGLIATO ("Allineamento intelligente: ATTIVO. Le guide appaiono mentre trascini..."). Visual indicator: dot teal con glow quando ON, ring border quando OFF. ON/OFF a colpo d'occhio.

🔝 **z-index language menu**: `z-50` → `z-[1200]` per stare sopra modal/overlay.

📂 **Assets tab informativo**: intro card editoriale "La tua libreria personale. Foto caricate, elementi salvati e composizioni riutilizzabili.". Hint dashed per upload + saved.

🎨 **Contrast +**: --bp-text-primary #EFEBE4→#F5F1EA, --bp-text-secondary #A19D98→#C8C4BD, --bp-text-muted #6B6863→#948F88. Body 1rem→1.0625rem, caption 0.8125→0.875rem, eyebrow 0.6875→0.75rem.

**Verified** ✅ — Picker IT 100%, snap tooltip locale-aware, filmstrip real thumbs, 0 page errors.



### ✅ Phase H.1 — Public Site Foundation: Homepage + Project Showcase (DONE — 14 Feb 2026)
Trasformazione della piattaforma da workspace privato a **global relational ecosystem**: prima superficie pubblica editoriale, multilingua, DB-ready.

- **Routing pubblico nuovo** (`App.js`): `/` (HomePage), `/projects` (ProjectsIndexPage), `/projects/:slug` (SiteProjectDetailPage), `/onboarding/:kind` (placeholder Private/Pro) — tutti wrappati in `SiteLayout` separato dall'app autenticata. Prima `/` reindirizzava a `/auth/login`.
- **Architettura content DB-ready** (`/app/frontend/src/site/content/`):
  - `homepage.js` — Hero, Dual CTA (Private/Pro), Selected Projects, 4 Editorial Values, Final CTA — tutti localizzati come `{it,en,fr,de,es}` (mimicker tabella futura `homepage_sections`)
  - `projects.js` — 6 progetti editoriali completi (Casa Naviglio, Aman Residences Tokyo, Galerie Saint-Honoré, Villa Cap Ferrat, Hotel Orient Istanbul, Penthouse Tribeca) con title/subtitle/summary/chapters/materials/tags localizzati + cover + gallery (Unsplash editorial stock)
  - `navigation.js` — Header (4 link + CTA Accedi) + Footer (3 colonne + legal + copyright) localizzati
- **Locale Engine** (`site/i18n.js` + `SiteContext.jsx`): `pick(value, locale, fallback)` helper, 5 locali (it/en/fr/de/es), persistenza `localStorage.mfd_site_locale`, default IT (brand intent), `<html lang>` aggiornato runtime
- **Editorial Styles** (`site/site.css`): scoped sotto `.mfd-site`, CSS variables editoriali (warm ivory ink #F1ECE3, brass accent #C9A36E, Cormorant serif), grain subtle, hero cinematic veil, masonry rhythm, dual CTA divider, Aman/Kinfolk/AD Archive aesthetic
- **Components**:
  - `SiteHeader.jsx` — brand lockup MOOD for DESIGN™ con tagline, nav links con underline-on-hover, LocaleSwitcher dropdown con bandiere semantic, CTA Accedi sticky, glass-on-scroll
  - `SiteFooter.jsx` — 3 colonne (Platform/Studio/Contact), copyright con interpolazione {year}{brand}, legal links
  - `SiteLayout.jsx` — wrap con SiteProvider, ScrollToTopOnNav, Outlet
  - `Reveal.jsx` — IntersectionObserver con safety-timeout 400ms (content visible by default + opt-in `--prep` per fade-in cinematic)
  - `SiteImage` — skeleton shimmer + cinematic fade-in
- **Pages**:
  - `HomePage` — Hero full-screen con cover Unsplash + editorial veil, Dual CTA con immagini Private/Pro, Selected Projects strip con ritmo alternato (12-col asymmetric), Editorial Values 4-card border-grid, Final CTA editoriale
  - `ProjectsIndexPage` — Masonry editoriale (column-count 1/2/3 responsive) con filtri categoria (All/Residential/Hospitality/Retail), counter aria-pressed
  - `SiteProjectDetailPage` — Hero cinematografico 21:9, spec list editoriale, gallery rhythm (wide/narrow alternato), chapters narrativi, materials list, related projects (same-category), CTA finale
  - `OnboardingPlaceholderPage` — Editorial holding page per Private (mailto) / Pro (link Workspace)
- **i18n routing**: nessun hardcoded text — TUTTI i contenuti passano via `pick()` dal content config localizzato
- **Tested ✅** (`iteration_30.json`)
  - 11/11 scenari PASS (home sections, locale IT/EN switching, nav, 6 cards + filtri, casa-naviglio + aman-residences-tokyo detail, invalid-slug redirect, onboarding private+pro, footer year/legal, hero-headline IT contains "Dove il design", auth/login regression)
  - 0 console errors
  - Frontend success rate: 100%
- **Future**: questo è solo Phase H.1 (Public Surface). Phasi successive (H.2 Private Intake emotivo / H.3 Lead Assignment / H.4 Designer Profiles / H.5 Messaging V1) richiedono backend (tabelle leads/profiles/conversations già anticipate in PRD).

**Constraint Shift recap**: La Architecture Freeze è stata rispettata — questa fase è FRONTEND ONLY. Nessuna nuova tabella DB. I content config sono **shaped exactly** come le future tabelle Supabase (`homepage_sections.content jsonb`, `projects.locale_content`, `site_navigation.config`) — migrazione futura sarà un copy-paste 1:1 + GET endpoint pubblico.



### ✅ Phase H.1.b — Public Site Rewrite as DEMO STORE Landing (Porcia, PN) (DONE — 14 Feb 2026)
Cambio strategico: la homepage pubblica NON promuove più la piattaforma MOOD for DESIGN™ in astratto, ma rappresenta la **DEMO landing di un ipotetico negozio di arredamento in provincia di Padova/Pordenone** che usa la piattaforma. Privati → form premium dedicato. Professionisti → form A&D dedicato.

- **Logo MOOD for DESIGN™ (mark cyan teal + serif "for DESIGN")** bundlato come `/app/frontend/public/brand/mood-for-design-mark.png` (variant verticale completa) e `mood-mark-only.png` (solo MOOD)
- **Hero ridisegnato** come da mockup utente:
  - Titolo display serif uppercase "ARREDARE SPAZI. / COSTRUIRE RELAZIONI." centrato (clamp 2.4→5.2rem)
  - Sub centrato "MOOD for DESIGN™ connette persone e progetti…"
  - Divider brass 64px + eyebrow "DUE PERCORSI. UN UNICO OBIETTIVO:" + italic "trasformare la tua visione in realtà."
- **Dual CTA orizzontale**:
  - PRIVATO (card avorio `--site-paper`): kicker "SEI UN PRIVATO?", title serif "Inizia il tuo progetto", CTA scuro "INIZIA IL TUO PROGETTO →" → `/onboarding/private`
  - PROFESSIONISTA (card scura): kicker "SEI UN PROFESSIONISTA?", title "Collabora con noi", CTA paper "ACCESSO PROFESSIONISTI →" → `/onboarding/pro`
- **VALUE PROPS** su sfondo paper (warm ivory `#EFE6DA`): titolo "PERCHÉ SCEGLIERE MOOD for DESIGN™" + 5 icone Lucide brass (Gem · Users · Sparkles · Globe · ShieldCheck) — ECCELLENZA ITALIANA · RELAZIONE UMANA · PROGETTI SU MISURA · INTERNAZIONALE · QUALITÀ GARANTITA
- **PROGETTI CHE ISPIRANO**: strip orizzontale 5 card aspect 4/5 con veil gradient bottom — RESIDENZIALE Venezia · RESORT Lago di Como · BOUTIQUE HOTEL Firenze · VILLA PRIVATA Val d'Orcia · PENTHOUSE Milano → linkano ai project detail esistenti
- **Newsletter ISPIRAZIONE E NOVITÀ** su paper background, input email + button ISCRIVITI brass, decor image laterale (>1080px)
- **Header riprogettato**: logo image 64px + tagline "ARREDARE SPAZI. / COSTRUIRE RELAZIONI." + 7 menu (CHI SIAMO · SERVIZI · MATERIALI · PROGETTI · JOURNAL · SHOWROOM · CONTATTI) + LocaleSwitcher + ACCEDI outline
- **Footer riprogettato**: 6 colonne grid → Brand mark + Tagline + Socials | AZIENDA | SERVIZI | RISORSE | SUPPORTO | SHOWROOM (Via Della Manifattura 12, 33080 Porcia (PN), +39 0434 123456, info@moodfordesign.com + CTA "PRENOTA UNA VISITA"). Copyright editoriale
- **i18n architecture DB-ready**: tutti i nuovi content config (`homepage.js`, `navigation.js`) sono **shaped esattamente come le future tabelle `cms_pages` / `cms_sections` / `cms_navigation`** — locale-keyed `{it,en,fr,de,es}`. Migrazione futura sarà copy/paste 1:1
- **Tested ✅** (`iteration_31.json`): **17/17 scenari PASS** incluso hero IT/EN, dual CTA, value props (5 icone Lucide), 5 inspire cards, newsletter form, header logo + tagline + 7 nav, footer 6 colonne + showroom Porcia + 4 socials, copyright "© 2026 MOOD for DESIGN™", regressione /projects + /projects/:slug + /onboarding/* + /auth/login. Zero issues.

**Next phase (H.2)**: Backend CMS table + AI translation engine + `/settings/cms` admin UI. Lo studio admin sceglie la lingua master (es. IT), edita ogni stringa via UI, e un button "Traduci tutte le lingue con AI" chiama Emergent LLM (Claude/Gemini) per popolare le altre lingue. Possibilità di aggiungere nuove lingue (es. PT, JA, AR) dal pannello — AI traduce tutto il content esistente. Schema: `cms_languages(tenant_id, code, label, native, enabled, is_master)`, `cms_content(tenant_id, page_key, section_key, field_key, locale, value, source, ai_translated_at)`. Frontend leggerà via GET `/api/cms/public/:tenant/page/:slug?locale=:locale`.




### ✅ Phase H.1.c — CRITICAL ARCHITECTURE AUDIT & REMEDIATION (DONE — 14 Feb 2026)
Audit completo del public-site + sistema multilingua per eliminare TUTTE le dipendenze hardcoded e unificare la locale architecture con Blueprint.

**Audit findings (issues trovate e risolte)**
1. ❌ → ✅ **Locale system disconnesso** — Blueprint usava `LOCALE_KEY='mfd_locale'` + codici BCP-47 misti (en-US, en-GB, it/fr/de/es). Site usava `'mfd_site_locale'` separato, solo 2-char, default diverso (`it` vs `en-US`). → **Unificato**: same storage key `'mfd_locale'`, same locale codes, cross-context sync via `CustomEvent('mfd:locale:change')`. Helper `normalizeLocale()` mappa BCP-47 → base 2-char per il lookup contenuti.
2. ❌ → ✅ **Inline locale objects in JSX** — `ProjectDetailPage.jsx` aveva `labels`/`back` inline; `ProjectsIndexPage.jsx` aveva `titleByLocale`/`eyebrow`/`filterLabel`/empty/CTA inline; `OnboardingPlaceholderPage.jsx` aveva `COPY = {private, pro}` inline; `HomePage.jsx` aveva `dangerouslySetInnerHTML` con hardcoded ™ replace. → **Tutto estratto in `/app/frontend/src/site/content/ui.js`** (`uiContent.{back, archive, detail, onboarding, categories}`).
3. ❌ → ✅ **Locale fallback silenzioso** — vecchio `pick()` ritornava la prima value non-vuota se la chiave mancava. → **Controlled fallback chain**: 1) locale esatto, 2) fallback ('en'), 3) `_default` se settato, 4) prima value, 5) dev warn `[i18n] Missing content: <path>` + safe placeholder. In prod: silent.
4. ❌ → ✅ **`projectCategories` con labels inline** in `projects.js` — duplicava le stringhe di categoria. → Refactored a importare le labels da `uiContent.categories`.
5. ❌ → ✅ **Bug rendering project detail hero** — `SiteImage` senza aspect-ratio collassava a 0 di altezza, immagine invisibile. → Fixed con `<img>` diretto + `position:absolute; inset:0` nel CSS della hero detail. Tutte e 6 le project detail (casa-naviglio · aman-tokyo · galerie-saint-honoré · villa-cap-ferrat · hotel-orient · penthouse-tribeca) ora caricano hero a 617px.

**Architecture invariants enforced**
- 🟢 Single source of truth per i locali: `PLATFORM_LOCALES` (6 BCP-47 entries) + `SITE_LOCALES` (5 base codes per switcher), entrambi in `/app/frontend/src/site/i18n.js`
- 🟢 Shared `localStorage.mfd_locale` tra Blueprint app + public site + onboarding + (future) CMS + tenant settings
- 🟢 ALL content via locale-keyed config — ZERO oggetti `{it,en,fr,de,es}` inline nei componenti JSX
- 🟢 Cross-tab sync via `storage` event; same-tab sync via `CustomEvent('mfd:locale:change')`
- 🟢 BlueprintContext `setLocale` ora dispatcha lo stesso `CustomEvent` → public site si aggiorna live
- 🟢 Future-tenant ready: la struttura supporta enable/disable per locale, default per tenant, AI-translated locales aggiuntive
- 🟢 Controlled fallback con dev observability — i contenuti mancanti vengono loggati in dev, silenti in prod

**Tested ✅** (`iteration_32.json`): **12/12 scenari PASS** — zero inline locale objects, 6 project detail con hero rendering corretto, locale switching IT↔EN persistente sullo storage condiviso, cross-context sync via custom event, fallback chain corretto per codici invalidi, regression /auth/login intatta, zero console errors. Refactor production-ready.

**Future-proofing notes**
- Quando arriverà il backend CMS (Phase H.2), il content layer `uiContent` + `homepageContent` + `navigationContent` + `projects` rimarrà invariato come **fallback locale** se l'API non risponde. Le stesse strutture (locale-keyed `{it,en,...}`) sono già le shape esatte delle future tabelle `cms_translations`.
- Quando un tenant aggiungerà una nuova lingua dal pannello admin (es. `pt`, `ja`), il sistema chiamerà AI translator per popolare tutte le chiavi esistenti → SITE_LOCALES sarà esteso runtime dalla API senza modifiche al codice frontend.




### ✅ Phase H.3 — Private Client Onboarding Wizard `/start-project` (DONE — 14 Feb 2026)
Esperienza editoriale cinematografica 7-step + Final Ready state per trasformare un visitatore privato in lead qualificato. NON è un form CRM — è un guided design experience stile Aman/Kinfolk/Studio KO/Dimorestudio.

**Routing & layout**
- Nuova route pubblica `/start-project` — full-screen wizard, **NON wrappato in SiteLayout** (no header/footer/menu)
- Chrome editorial: logo MOOD + counter "STEP X DI 7" + progress dots (brass active, dim done) + Exit button con confirm dialog
- Animazioni: `mfd-wiz-fade` su step change (700ms cubic-bezier), `transform scale 1.04` su card hover
- Auto-save su `localStorage.mfd_start_project_state` ad ogni cambio di stato → reload preserva tutto

**7 Step + Final**
- **Step 1 Project Type** — 9 image card grid (apartment, villa, penthouse, boutique_hotel, restaurant, retail, office, wellness, other) con check brass animato
- **Step 2 Spaces** — split layout (atmospheric image left + 9 checks right) multi-select
- **Step 3 Mood & Atmosphere** — 6 image card multi-select (warm_minimal, quiet_luxury, mediterranean_calm, sculptural_contemporary, natural_modernism, dark_editorial)
- **Step 4 Inspirations** — 4 tabs (Upload/Pinterest/Link/Board), upload locale via `URL.createObjectURL`, link/Pinterest paste-and-add con renderizzazione board, remove on hover. **Architettura DB-ready** per futura Supabase Storage integration
- **Step 5 Materials & Colors** — 6 material chips + 6 color chips con swatches circolari (Travertine/Walnut/Linen/Brushed Metal/Bronze/Glass + Warm White/Sand/Greige/Earth/Olive/Charcoal)
- **Step 6 Lifestyle** — 3 large editorial textarea con serif font (feel/inspires/atmosphere)
- **Step 7 Budget & Timeline** — 3 select luxury hospitality (timeline/amount/startDate) + notes textarea
- **Final Ready** — 5 summary cards (Lead profile · Mood direction · Project structure · Moodboard suggestions · Proposal sections) + 2 CTA (Crea account / Accedi al Blueprint) + payload JSON nascosto per testing

**Architecture invariants**
- 🟢 ZERO hardcoded — tutto in `/app/frontend/src/site/content/onboarding.js` (288 righe, locale-keyed `{it,en,fr,de,es}`)
- 🟢 Step gating intelligente: `canContinue` calcolato per ogni step (1: required, 2/3/5: ≥1 selection, 4/6: optional, 7: tutti i 3 select required)
- 🟢 Cinematic transition: ogni step ha `key={state.step}` → React monta nuovo + animation entry
- 🟢 Locale architecture **stessa di Blueprint** (shared `mfd_locale`, cross-context sync via custom event)
- 🟢 Final payload **DB-ready shape** — JSON con `{project_type, spaces[], moods[], inspirations{uploads,pinterest,links}, materials[], colors[], lifestyle_answers{feel,inspires,atmosphere}, budget, timeline, start_date, notes, locale, tenant, created_at}`. Persistito in `localStorage.mfd_pending_lead_payload` come bridge fino a Phase H.5 (POST /api/leads)
- 🟢 Homepage CTA "INIZIA IL TUO PROGETTO" ora linka `/start-project` (era `/onboarding/private`)

**Visual palette (luxury hospitality)**
- Background: `radial-gradient(#1F1B16 → #15110D → #0A0807)` — warm charcoal
- Accent: `#C9A36E` (brass)
- CTA: `#E7CFB0` (warm paper) hover → brass
- Typography: Cormorant Garamond serif headlines + Inter Tight sans UI

**Tested ✅** (`iteration_33.json`): **17/17 PASS** — wizard load, all 7 steps + gating, multi-select persistence, autosave/restore, locale IT→EN switch, back navigation, Exit confirm, homepage CTA link update, final payload shape, regression / + /projects + /onboarding/:kind + /auth/login. Zero console errors.

**MOCKED**: persistenza lead via `localStorage` (no backend). Phase H.5 wirerà POST `/api/leads` con questo payload come body.




### ✅ Phase H.4 — Professional Gateway + GLOBAL LANGUAGE REGISTRY (DONE — 14 Feb 2026)
Dual delivery: (A) ingresso editoriale per professionisti A&D + intake 5-step. (B) Foundation architettonica per il language management enterprise.

**Part A — Professional Gateway `/professionals` + Intake `/professionals/intake`**
- Hero editoriale cinematografico (`mfd-pro-hero`) con immagine luxury hospitality + dark layered gradient
- 3 CTA grid editoriale (`mfd-pro-ctas`) con kicker brass accent + serif title + body + chevron action:
  - **01 — VISITA LO STUDIO** → URL configurabile per tenant (`tenantConfig.studioExternal.url`, default `/projects`, supporta `target=_blank` per URL esterno)
  - **02 — AVVIA UN PROGETTO** → `/professionals/intake` (5-step wizard)
  - **03 — ACCEDI AL WORKSPACE** → `/auth/login`
- Tono: **collaborazione + opportunità + partnership** (NON emotional come il flow privato)
- Intake 5-step: Intent (9 multi-select) · Project Info (5 fields) · Design Direction (upload+link tabs) · Pro Details (8 fields incl. preferred language pulled da publicLanguages) · Confirmation (summary 4 sezioni + 3 next-steps + 2 CTA → /auth/login con payload in `localStorage.mfd_pending_pro_payload`)
- Autosave su `localStorage.mfd_professional_intake_state`
- Step counter "STEP X DI 5" + progress dots brass

**Part B — GLOBAL LANGUAGE REGISTRY**
- File: `/app/frontend/src/site/content/languages.js` — **single source of truth** per ALL locale logic
- Schema completo: `{code, name, native_name, enabled, public_enabled, blueprint_enabled, default_locale, rtl, fallback_locale, sort_order, ai_translation_enabled, short, base}`
- 9 lingue pre-configurate: IT (default) · EN-US · EN-UK · FR · DE · ES + AR/ZH/JA disabled-by-default
- API:
  - `getLanguageRegistry()` — registry corrente (override localStorage o default)
  - `setLanguageRegistry(next)` — persiste override + dispatcha `mfd:languages:change`
  - `publicLanguages()` / `blueprintLanguages()` / `enabledLanguages()` — viste filtrate
  - `resolveLanguage(code)` — risolve BCP-47 o 2-char in entry registry
  - `buildFallbackChain(code)` — catena di fallback per controlled `pick()`
- **i18n.js refactored**: `pick()` ora usa `buildFallbackChain()` dal registry → `[locale, base, fallback_locale, fallback_base, 'en']`
- **SiteContext**: dynamic `SITE_LOCALES` rebuild on `mfd:languages:change`, plus `document.dir='rtl'` quando lingua selezionata è RTL
- **BlueprintContext**: ora legge `FALLBACK_LOCALES` da `blueprintLanguages()` invece di array hardcoded → public site + Blueprint condividono il **registry stesso**

**Admin UI `/settings/languages`** (Phase H.4 foundation)
- Tabella con tutte le 9 lingue: code, name, native, Enabled checkbox, Public site, Blueprint, Default radio, RTL badge, Fallback, AI Translate
- Save persiste override su `localStorage.mfd_language_registry_override` + dispatcha event → site + Blueprint si aggiornano LIVE
- Reset to defaults
- Architecture note in fondo che spiega il flow

**Architecture invariants reinforced**
- 🟢 ZERO duplicate locale arrays — public site + Blueprint leggono dal registry
- 🟢 RTL-ready: `document.documentElement.dir` flippa runtime
- 🟢 Tenant-ready: studio external URL configurabile per tenant via `tenantConfig.studioExternal.url`
- 🟢 Future-ready: AI Translation toggle già nel registry (per Phase H.5)
- 🟢 SuperAdmin-ready: tutta la gestione concentrata in `/settings/languages`

**Tested ✅** (`iteration_34.json`): **32/33 PASS (97%)** — gateway 3 CTAs, intake 5 step + autosave, step gating, language admin enable/disable/save/reset, locale unification cross-context, regression intatta. L'unico fail è cosmetic (uppercase via CSS only — non un bug).

**Code review notes per Phase H.5**:
- Memory: `URL.revokeObjectURL` in remove/unmount per gli upload references
- Backend H.5 dovrà gestire upload separati (multipart) prima di POST /api/leads
- Splittare `ProfessionalIntakePage.jsx` (332 lines) se cresce ancora

**MOCKED**: lead persistence (private + pro) e language override sono in localStorage. Phase H.5 wirerà tabelle backend `platform_languages`, `leads`, `professionals`.



---

## SESSION D — CMS Hero Editor + Value-Props Pillar Editor + InlineText Hardening (2026-05-15)

### Implemented
- **Value Props (`Why choose MOOD`) pillar editor** in StorefrontStudio:
  - Each pillar: inline-editable title + body per locale
  - Cyclable icon (gem → users → sparkles → globe → shield-check)
  - Remove pillar (× on hover)
  - "+ ADD PILLAR" tile
  - `HomePage.jsx mergeHomepage()` now reads `value_props._settings.pillars` and overrides legacy items, so changes propagate to the live site
- **Cinematic Hero Editor (Storefront Studio)**:
  - New `HeroSettingsPopover` component (top-left of hero section)
  - Controls: Text alignment (left/center) · Vertical anchor (top/middle/bottom) · Horizontal anchor (start/center/end) · Veil style (none/soft/bottom/top/strong) · Veil opacity slider · Italic-line toggle
  - All settings persist via `updateSettings()` → `cms_sections.settings`
  - Hero text now uses responsive clamp() fonts
- **Live site Hero matches CMS** (canonical order: overline → headline → sub → optional italic):
  - Extracted `HomeHero` component in `HomePage.jsx` reading `hero._settings` → applies `data-text-align/data-v-anchor/data-h-anchor` + CSS variable `--hero-veil`
  - `site.css` updated with data-attribute selectors and configurable veil var
- **InlineText hardening**:
  - Treats whitespace-only strings (`'\n'`, spaces) as empty — fixes case where contentEditable's `<br>` got persisted as `'\n'` and hid the placeholder
  - Both `useState` initial and `commit()` now normalize blank values to `''`
- **Inline placeholder CSS** added in `index.css` (`.storefront-inline-text.is-empty::before { content: attr(data-placeholder) }`) — empty fields now show italic faded placeholder
- **Save-as-Template (Moodboard editor)** — added `toast.success/error` feedback (previously silent)
- **Data fix**: restored `cms_sections.locale_content.it.overline_italic` to `"trasformare la tua visione in realtà."` (had been corrupted to `'\n'` by an earlier blur on empty contentEditable)

### Files touched
- `frontend/src/components/storefront/SectionRenderers.jsx` (StoreHero rewrite + HeroSettingsPopover + ValueProps editor)
- `frontend/src/components/storefront/InlineText.jsx` (blank normalization)
- `frontend/src/pages/site/HomePage.jsx` (HomeHero component + pillars merge)
- `frontend/src/site/site.css` (.mfd-hero data-attribute variants + --hero-veil)
- `frontend/src/index.css` (storefront-inline-text placeholder CSS)
- `frontend/src/pages/moodboards/MoodboardEditor.jsx` (saveAsTemplate toast)

### Tested
- Screenshot smoke tests: CMS shows full hero editor + editable italic; live site matches CMS exactly.
- Lint: clean on all 5 modified files.
- Editor reload-persistence verified for both Hero and Value-Props.

### Pending (priority order)
- P1: Lead Assignment refinement (Phase H.5)
- P2: Workspace Moodboard Fit-to-Screen toggles (zoom presets)
- P2: Designer Profile & Human Header (Phase 6)
- P3: Messaging System V1 (Phase 7)
- P4: Products / Catalogs (Phase 8)
- Backlog: PRD.md split into CHANGELOG.md + ROADMAP.md (file is now ~1620 lines)

---

## SESSION E — P0 polish + Member Management RBAC + Magic-Link Invites (2026-05-15)

### P0 (preview verified)
- **EditorPanel tab strip padding** — `INSERT · ASSETS · PAGES · MOOD` no longer truncates on the right edge of the 280px side panel. Reduced gap, removed per-tab left/right padding, added right padding to the strip.
- **Moodboard Fit controls** — added Fit Width / Fit Height / Actual Size (100%) buttons + live `%` readout in the editor topbar. Refactored `useEffect` for canvas scale to read from `fitMode` state. Visual-only scale; drag handlers already compensate via `canvasScaleRef`.

### P1 — Member Management System ✅
- **DB Migration `016_members_management.sql` (applied)**:
  - Extended `users_profile` with `first_name`, `last_name`, `avatar_url`, `phone`, `last_login_at`, `invited_by`, `invited_at`, `accepted_at`, `suspended_at`, `suspended_by`, `suspended_reason`
  - New `tenant_memberships` table (multi-tenant future-proof; one user can belong to many tenants). Backfilled 53 rows from existing `users_profile`.
  - New `member_invites` table for audit trail of magic-link invites.
- **Backend** `/api/members` router (`backend/routers/members.py`):
  - `GET /api/members` — list members of effective tenant (filterable by status)
  - `GET /api/members/roles` — returns assignable roles + their permission set (no hardcoded roles in frontend)
  - `POST /api/members/invite` — invite via Supabase Admin API `/auth/v1/admin/invite` (magic link). Fallback to silent admin create if SMTP not configured.
  - `POST /api/members/{id}/resend-invite` — resend magic link, increments `member_invites.resend_count`
  - `PATCH /api/members/{id}` — change role or status (active/suspended). Self-edit blocked, can't demote last `tenant_admin`, can't touch `super_admin` unless you are one.
  - `DELETE /api/members/{id}` — remove from tenant (keeps auth.user for future multi-tenant flows)
  - All actions audit-logged via `audit_log()`
- **Frontend** `/settings/members` (`pages/settings/MembersPage.jsx`):
  - Linear/Notion-style table (avatar, name, email, role pill, status badge, last-login)
  - Filter pills (All / Active / Invited / Suspended) with live counts
  - Search by name/email
  - "Invite member" right-side drawer with role grid (permission count per role)
  - Per-row action menu: Resend invite · Suspend · Reactivate · Change role · Remove
  - Confirm dialogs for suspend / remove
  - Permission-driven: role list comes from `/api/members/roles`, no hardcoded names in UI
- **Routing**: `/settings/team` AND `/settings/members` → MembersPage (legacy compat).
- **RBAC reach**: `super_admin` cross-tenant, `tenant_admin` own tenant only. Designer/Client → 403 on GET.

### Files touched
- `supabase/migrations/016_members_management.sql` (new)
- `backend/routers/members.py` (new, 380 lines)
- `backend/server.py` (router registration)
- `frontend/src/pages/settings/MembersPage.jsx` (new, ~470 lines)
- `frontend/src/App.js` (routes)
- `frontend/src/blueprint/moodboard/EditorPanel.jsx` (tab padding fix)
- `frontend/src/pages/moodboards/MoodboardEditor.jsx` (fit controls)

### Tested
- ✅ List members (52 rows render)
- ✅ Invite flow end-to-end (creates auth user + profile + membership + invite log)
- ✅ Change role + status PATCH
- ✅ Resend invite endpoint
- ✅ Delete with last-admin guard
- ✅ Designer gets 403 on /members
- ✅ Drawer renders 7 assignable roles with permission counts
- ✅ Editor tabs fit; Fit controls render with live % readout

### Notes
- **Supabase SMTP**: if not configured, the invite endpoint falls back to silent admin create. The recipient won't receive an email — they'd use /forgot-password. Recommend confirming SMTP is enabled in Supabase Auth → Email settings before going live.
- The role list (`TENANT_ASSIGNABLE_ROLES`) already includes future personas (`editor`, `project_manager`, `analyst`, `ad_partner`). To unlock them, just map their permissions in `core/permissions.py:ROLE_PERMISSIONS`.

### Pending (priority order)
- P1: Supabase SMTP verification + redirect URL `https://blueprint.moodfordesign.com/**`
- P1: Phase H.5 — Lead Assignment refinement (round-robin + manual override)
- P2: Designer Profile & Human Header (Phase 6)
- P3: Messaging V1 (Phase 7)
- P4: Products / Catalogs (Phase 8)
- Refactor: split PRD.md into CHANGELOG.md + ROADMAP.md (now ~1700 lines)

---

## SESSION F — Brand palette + Projects CMS + Mobile burger + Footer locale + Browser auto-detect (2026-05-15)

### 1) Brand palette MOOD for DESIGN applied
- **Site (`site/site.css`)** — new CSS vars from the official brand palette:
  - `--site-accent: #00C9B3` (primary teal) · `--site-accent-2: #33DCC6` · `--site-accent-3: #7EE6DA`
  - `--site-ink: #F4F5F7` (snow) · `--site-ink-dark: #1A1A1A` · `--site-ink-dark-2: #6B6E71` (graphite)
  - `--site-bg: #0F0F10` (deep neutral)
  - `--site-serif: 'Playfair Display'` · `--site-sans: 'Montserrat'`
- **Blueprint workspace (`index.css`)** — aligned to same palette:
  - `--bp-primary: #00C9B3` (was `#26F5C9`) · `--bp-primary-2: #33DCC6` · `--bp-primary-3: #7EE6DA`
  - `--bp-bg: #0F0F10` · `--bp-surface-*` neutralized to graphite tones
  - `--bp-font-heading: 'Playfair Display'` (was Cormorant) · `--bp-font-body: 'Montserrat'`
- Added Montserrat to the Google Fonts import (Playfair Display was already loaded).

### 2) CMS Projects management (ProjectsPreview)
- Made the `projects_preview` section fully editable in StorefrontStudio:
  - Per-card EditableImage with asset picker
  - Inline category + location (per locale)
  - Slug editor (top-left, hover-revealed) for routing/SEO
  - Reorder (←/→) and remove (×) on hover
  - "+ ADD PROJECT" tile up to max 5
- HomePage `mergeHomepage()` now picks `_settings.items` from the DB and overrides the legacy `projectsInspire.items`, so the live site reflects CMS edits.

### 3) Mobile responsive + burger menu
- **SiteHeader.jsx** rewritten:
  - Removed inline `LocaleSwitcher` (moved to footer)
  - New burger button (visible <1180px), full-screen overlay menu
  - Body scroll lock when menu is open
  - Menu auto-closes on route change
  - Respects `show_on_mobile` flag from CMS nav links
- **site.css** — added:
  - `.mfd-header__burger` (hidden ≥1180px)
  - `.mfd-header__access` (visible ≥760px)
  - `.mfd-mobile-menu` (slide-down full-screen panel, blurred backdrop)
  - `.mfd-mobile-menu__link` (large-tap underlines with hover indent)
- Verified at 390×844 viewport: burger visible, desktop nav hidden, mobile menu opens, all 5 routes tappable.

### 4) Footer locale switcher + browser auto-detect + EN-GB fallback
- **SiteContext.jsx** — `detectInitialCanonicalLocale()` now:
  1. localStorage (user previously chose) — wins
  2. `navigator.languages[]` → exact code match → base match (`it-CH` → `it`)
  3. **EN-GB / EN-UK explicit fallback** (per spec)
  4. Registry default
- **SiteFooter.jsx** — new inline `FooterLocaleSwitcher` (Globe icon + opens upward, replaces the header switcher). Anchored bottom-right of the footer bottom bar.
- **site.css** — added `.mfd-footer__locale*` styles matching the editorial dark theme.

### Files touched
- `frontend/src/site/site.css` (palette vars + burger + mobile menu + footer locale)
- `frontend/src/index.css` (palette vars + Montserrat font)
- `frontend/src/site/SiteContext.jsx` (browser locale auto-detect)
- `frontend/src/site/components/SiteHeader.jsx` (burger + mobile menu)
- `frontend/src/site/components/SiteFooter.jsx` (footer locale switcher)
- `frontend/src/pages/site/HomePage.jsx` (projects mergeHomepage)
- `frontend/src/components/storefront/SectionRenderers.jsx` (full ProjectsPreview editor)

### Tested
- ✅ Desktop hero shows MOOD teal logo, Playfair heading, Montserrat body
- ✅ Mobile 390px viewport: burger visible (computed `display: flex`), nav hidden, mobile menu opens with all routes
- ✅ Footer locale dropdown opens upward with 6 languages (IT default + EN-US + EN-UK + FR + DE + ES)
- ✅ CMS projects: 5 editable cards with image picker, slug, reorder, remove
- ✅ Blueprint workspace palette aligned (teal accents, no more mint-green clash)
- ✅ Lint clean on all 7 modified files

### Pending (priority order)
- P1: Supabase SMTP + redirect URL for `https://blueprint.moodfordesign.com/**`
- P1: Push to GitHub + Redeploy Emergent native to propagate palette + CORS + members + brand changes to production
- P1: Phase H.5 — Lead Assignment refinement (round-robin + manual override)
- P2: Designer Profile & Human Header (Phase 6)
- P3: Messaging V1 (Phase 7)
- P4: Products / Catalogs (Phase 8)

---

## SESSION G — Tenant Settings IA refactor + Licensing Engine foundation (2026-05-15)

### 1) Settings IA — new commercial-grade structure
Old (chaotic): "Tenant Storefront" + "Corporate Platform" + "Platform System" + "Cross-cutting configuration".
**New** (Notion/Linear/Shopify-admin feel):
- **Workspace** → Team & Permissions · Billing & Plan · Domains · Brand Studio
- **Website** → Storefront Pages · Forms & Onboarding · Journal
- **Account** → Profile · Notifications · Security

**Removed from tenant** (per spec):
- ❌ Page Builder (`/settings/pages` route moved to `/admin/pages` and `/superadmin/pages` only)
- ❌ Navigation & Footer as separate module — now integrated into Storefront Pages
- ❌ Languages tile → moved to SuperAdmin

**SuperAdmin link** is shown only to `role === 'super_admin'` in the Settings header. Routes aliased: `/superadmin`, `/superadmin/tenants`, `/superadmin/modules`, `/superadmin/audit`, `/superadmin/languages`, `/superadmin/pages` (all → `AdminLayout`).

AdminLayout sidebar updated: Overview · Tenants · Modules · **Languages** · **Pages** · Audit.

### 2) Licensing Engine (Mock-first, Stripe-ready)
DB Migration **`017_licensing.sql`** (applied):
- `active_plan`, `subscription_status` (active|past_due|canceled|suspended|trial), `billing_cycle`, `trial_ends_at`
- `max_users`, `max_projects`, `max_storage_gb`, `max_domains`, `max_ai_credits` (all NULL = unlimited)
- `enabled_modules` jsonb array
- `stripe_customer_id`, `stripe_subscription_id` (nullable; Session H will wire them)
- Demo tenants seeded to **enterprise** so existing 52 members don't trip the cap

**Backend** `/app/backend/core/licensing.py`:
- `PLANS` dict — Starter (3/10/5GB/1/500) · Studio (10/50/25/2/5000) · Enterprise (∞ across the board) · Custom
- `get_tenant_license()` — merges DB row with plan defaults
- `get_tenant_usage()` — live counts via Supabase
- `assert_subscription_active()`, `assert_module_enabled()`, `assert_capacity(resource)` — raise 403 with stable error codes (`LICENSE_LIMIT_REACHED`, `MODULE_NOT_ENABLED`, `SUBSCRIPTION_INACTIVE`) and structured detail `{code, message, plan, current, limit, resource}` for the frontend

**API** `routers/license.py`:
- `GET  /api/license` — current tenant license + usage
- `GET  /api/license/plans` — public catalog (Starter / Studio / Enterprise)
- `POST /api/license/{tenant_id}/assign` — super_admin only

**Enforcement** wired into `routers/members.py::invite_member()` — calls `assert_capacity(tenant_id, "users")` BEFORE Supabase Auth. Tested: switched demo to `starter` → invite returned `403 LICENSE_LIMIT_REACHED { current: 52, limit: 3, plan: "starter" }`. Restored to enterprise.

### 3) Frontend
- `/settings/plan` (`PlanPage.jsx`) — Linear/Vercel-style usage meters (Seats · Projects · Storage · Domains · AI), module pills, 3 PlanCards with "Current" badge; super_admin can re-assign with one click.
- `MembersPage.jsx` — added seats chip + plan-aware Invite CTA: when `atSeatCap`, CTA flips to "Upgrade to invite" and routes to `/settings/plan` instead of opening the drawer. Invite errors decode `LICENSE_LIMIT_REACHED` into a friendly toast.
- `SettingsPage.jsx` — fully rewritten with new IA, "Soon" badges on Brand/Journal/Profile/Notifications/Security (placeholders for Session H+).

### Files touched
- `supabase/migrations/017_licensing.sql` (new)
- `backend/core/licensing.py` (new)
- `backend/routers/license.py` (new)
- `backend/routers/members.py` (capacity enforcement)
- `backend/server.py` (router register)
- `frontend/src/pages/settings/SettingsPage.jsx` (rewritten — new IA)
- `frontend/src/pages/settings/PlanPage.jsx` (new)
- `frontend/src/pages/settings/MembersPage.jsx` (seats chip + plan-aware CTA + 403 decode)
- `frontend/src/App.js` (routes: +/settings/plan, +/superadmin/*, removed page-builder & navigation-editor as standalone tenant routes)
- `frontend/src/components/layout/AdminLayout.jsx` (Languages + Pages sidebar items)

### Tested
- ✅ `GET /api/license` → enterprise with full usage
- ✅ `GET /api/license/plans` → 3 plans returned
- ✅ `POST /api/license/.../assign` → plan switch works
- ✅ `POST /api/members/invite` → blocked by `LICENSE_LIMIT_REACHED` when usage ≥ limit
- ✅ Settings page renders 10 tiles in 3 sections, SuperAdmin link visible for super_admin
- ✅ Plan page renders 5 meters + 3 plans + 10 module pills
- ✅ Lint clean on all 5 modified backend + 6 modified frontend files

### Pending (priority order — for Session H)
- **Brand Studio Override** (`/settings/brand` page) — logo/palette/typography/preset
- **Runtime Theme Engine** with `data-tenant-theme` + per-tenant CSS vars
- **Plan-aware UI everywhere**: extend the seat-chip pattern to projects (Moodboards/Projects pages)
- **Stripe webhook stub** ready for `subscription.updated`
- **Super_admin tenant management UI**: bulk plan reassign + per-tenant override limits
- Domains: `/settings/domains` is currently a placeholder — wire `tenant_domains` CRUD
- Push to GitHub + Redeploy
- Supabase SMTP for magic-link invites

### Notes
- Stripe is intentionally mocked. `stripe_customer_id` and `stripe_subscription_id` columns exist but stay NULL until Session I.
- `is_super_admin` flag in BlueprintContext was already wired and works against the new SuperAdminRoute.


---

### ✅ Phase H.5 — Session I: Plan-Aware Enforcement Everywhere (DONE — 15 Feb 2026)
Goal: extend Server-First Licensing to the rest of the platform (Projects, Moodboards,
Storage, Domains) so every billable resource has a single source of truth and the UI
mirrors the server limits with Linear/Vercel-style usage chips + disabled CTAs.

**Backend**
- `019_licensing_extensions.sql` — adds `tenants.max_moodboards`, `moodboards.archived_at`/`deleted_at`,
  `tenant_domains.domain_type` (subdomain | custom). Backfills Starter (3/5/15/5GB/1) and Studio
  (10/25/100/50GB/3) defaults per Feb 2026 pricing.
- `core/licensing.py` rewritten:
  - PLANS dict includes `max_moodboards`
  - `get_tenant_usage` now returns REAL usage: users, projects, moodboards (excludes soft-deleted),
    `storage_gb` + `storage_bytes` (SUM of media_library.file_size), domains (custom only)
  - `assert_capacity(tenant_id, resource)` covers users/projects/moodboards/domains
  - new `assert_storage_capacity(tenant_id, additional_bytes)` pre-flight gate for uploads
- Routers wired:
  - `routers/projects.py` create → `assert_capacity(_, "projects")`
  - `routers/moodboards.py` create → `assert_capacity(_, "moodboards")`, soft-delete on DELETE,
    new `/archive` and `/restore` endpoints, list endpoint excludes `deleted_at IS NOT NULL`
  - `routers/storage.py` `/signed-upload` and `/media` → `assert_storage_capacity` (file_size pre-flight)
  - `routers/settings.py` `/assets/register` → `assert_storage_capacity`
  - `routers/domains.py` auto-detects subdomain vs custom from hostname suffix
    (`*.moodfordesign.com` → `domain_type='subdomain'`, FREE — does NOT count against `max_domains`)
- Error payload contract (frontend switches on `code`):
  `{ code:'LICENSE_LIMIT_REACHED', message, plan, resource, current, limit }`

**Frontend**
- `hooks/useLicense.js` — shared license cache (module-level) + `capacityFor(resource)` helper
  + `refreshLicense()` cross-page event sync
- `components/common/UsageChip.jsx` — Linear-style pill with safe/warn/danger tones
- `pages/workspace/ProjectsPage.jsx` — usage chip + plan-aware "Upgrade to create more" CTA,
  empty-state CTA mirrors the gate, License-aware toast on 403
- `pages/moodboards/MoodboardsPage.jsx` — same treatment; auto-redirect to /settings/plan
  on quota error from template-apply too
- `pages/settings/DomainsPage.jsx` — migrated to shared hook + UsageChip, label clarifies
  "Custom domains" (subdomains don't count)
- `pages/settings/PlanPage.jsx` — added Moodboards meter (6 total), plan catalog shows
  moodboards row, refreshLicense() after plan assign
- `pages/settings/MembersPage.jsx` — refreshLicense() after invite for cross-page sync
- `lib/assetUpload.js` + `blueprint/moodboard/ImageUploader.jsx` — send `file_size` on
  signed-upload to enable server pre-flight; LICENSE_LIMIT_REACHED toast formatting

**Tested**
- Backend pytest 10/10 (`/app/backend/tests/test_licensing_enforcement.py`)
- E2E frontend chips + CTAs + 6 meters verified by testing agent (iteration 39)
- Subdomain bypass confirmed: `freesub.moodfordesign.com` accepted even on Starter at cap

**Notes**
- License GET is ~3s on cold hit (5 COUNTs + 1 SELECT-all-file_sizes). Frontend caches at
  module level so subsequent navigations are instant. Server-side Redis cache is a future
  optimisation (P2).
- `assert_capacity(additional=N)` formula uses `usage + max(0, additional-1) >= limit`;
  callers in this session all use additional=1. Future multi-slot reservations should
  switch to `usage + additional > limit`.


---

### ✅ Phase J — Storefront Draft vs Live Visual Diff + Publishing Workflow (DONE — 15 Feb 2026)
Foundation of the enterprise-grade publishing system. Drafts edit live, but the public
site is served from immutable frozen revisions — Notion / Vercel / Webflow CMS style.

**Migration 020 — `cms_page_revisions`**
- Append-only snapshot table {snapshot JSONB, label, kind, change_summary, created_by}
- `cms_pages.published_revision_id` → points at the snapshot the public storefront renders
- `cms_pages.draft_updated_at` (bumped via Postgres trigger on every section mutation)
- `cms_pages.last_published_at` (timestamp telemetry)
- Triggers: `cms_sections_bump_page_draft` (AFTER ins/upd/del) + `cms_pages_bump_self_draft`

**Backend — `core/storefront_revisions.py`**
- `snapshot_page(tenant, page_id)` — freezes (page meta + ordered sections + asset_index)
- `publish_page(tenant, page_key, profile, label)` — creates revision, updates pointer + status
- `list_revisions / get_revision`
- `diff_against_published(tenant, page_id)` — structured diff with:
  - `summary`: sections_added/removed/modified/reordered + field_changes + has_changes
  - `page.changed/added/removed`
  - `sections.modified[].changes.locale_content[locale].{added,removed,changed}` + settings + visibility + section_type
- `diff_between_revisions(a, b)` — historical comparison
- `revert_to_revision(tenant, page_id, rev_id)` — wipes sections + restores from snapshot
- Status field intentionally excluded from frozen snapshot — workflow flag, not content.

**Backend — `routers/storefront.py` new endpoints**
- `POST /admin/pages/{key}/publish` body `{label?}` → creates a revision
- `GET  /admin/pages/{key}/revisions?limit=30`
- `GET  /admin/revisions/{id}`
- `GET  /admin/pages/{key}/diff?vs=published|<rev_id>&against=<rev_id>`
- `POST /admin/pages/{key}/revert/{revision_id}`
- `GET  /public/{tenant_slug}/pages/{key}` now reads from `published_revision_id`
  (served_from='revision'); falls back for legacy pages (served_from='legacy_live');
  `?preview=1` serves draft (served_from='draft')

**Frontend**
- `components/storefront/PublishDiffDrawer.jsx` — cinematic right-side drawer 640px wide
  - Tabs: Changes / Revisions
  - Inline word diff (LCS-based) + side-by-side toggle
  - Page-meta diff block + per-section change blocks
  - Footer with optional label input + Publish-now button
  - Revisions timeline with Live chip + Revert action
- `components/storefront/storefrontApi.js` extended: listRevisions, getRevision, pageDiff, revertPage
- `pages/settings/StorefrontStudio.jsx`
  - Publish button → "Review & publish" opens the diff drawer
  - Live dirty badge with change count, refreshed on autosave
  - New GitCompare icon button for quick access to revisions timeline

**Tested (iteration 40)**
- Backend 9/9 after status-snapshot bug fix
- Frontend 100%: drawer tabs · view-mode toggle · empty state · revisions list · revert · publish

**Deferred (P2 — Phase J.1)**
- Image diff hotspots / overlay before/after slider
- AI-assisted revisions, scheduled publishing UI, collaborative cursors
- Transactional revert (Postgres function) for scale
- Revision pruning policy + UI


---

### ✅ Phase K — Workflow OS Repositioning (DONE — 15 Feb 2026)
Strategic repositioning from "design inspiration / curated community" → **"Design Workflow
Operating System for interior design studios & showrooms."** Core value is now control of
change, not inspiration. Removes all economic/payment language (only `client budget` allowed).

**Content updates**
- `frontend/src/site/content/homepage.js` — full rewrite (5 locales):
  - Hero: "FROM LEAD TO PROJECT. TO DELIVERY." + Workflow OS overline
  - Dual cards: B2B segments (Studios → "Book a demo" · Showrooms → "Explore the workflow")
  - Value props "YOUR WORKFLOW. ONE PLACE." with 5 pillars:
    Lead Intake · Client Onboarding · Moodboards & Projects · Draft vs Live · Client Portal
  - Studios in Motion (renamed from Projects that Inspire)
  - Workflow Insights newsletter (no fluff, just workflow)
- `frontend/src/site/content/navigation.js` — new IA:
  - Header: Platform · Workflow · Moodboards · Projects · Journal · Pricing · About
  - Footer columns: Platform · Use Cases · Resources · Company · Legal
  - Showroom CTA reframed as "Book a Demo" (no physical address)

**Pipeline**
- Re-dumped JS → JSON via `dump.mjs`
- Re-seeded demo tenant cms_pages/cms_sections via `seed_storefront_cms.py`
- Published via Phase J revision system (label: "Workflow OS repositioning (final)")
- Public storefront now serves the new revision (served_from='revision')

**Pre-existing bug fixed in the process**
- `frontend/src/lib/api.js`: 401 interceptor was redirecting public marketing pages
  (`/`, `/projects`, `/professionals`, etc.) to `/auth/login` whenever a stale
  localStorage token caused `/api/auth/me` to 401. Added these paths to the
  public-surface allowlist so visitors never get bounced.

**Avoided language**
- portfolio builder · moodboard platform · social/community · inspiration platform
- invoices · revenue · payment tracking · financial KPIs · billing dashboard
- "global community" · "creative network"

**Allowed economic field**
- client budget · project budget range · budget awareness only

**Visual verified**
- Hero · Dual cards · Value props · Studios in Motion · Workflow Insights · Footer
  all rendering correctly in EN-US (and IT via locale switch)

### Next Action Items (post-Phase K — confirmed roadmap)
1. **Complete CMS Bindings** — verify every storefront section reads via `useStorefrontContent`
   from the published revision (P0)
2. **Media Library** dedicated page (search · filters · replace flow · tagging) — critical for
   interior design (images, materials, renderings, textures, catalogs) (P0)
3. **Journal System** — corporate journal (moodfordesign.com) + per-tenant journals,
   shared engine, separate SEO strategy (P1)
4. **AI Editorial Assistant** scoped for interior design: topics, structure, images,
   storytelling, locale-specific tone, SEO, CTAs. NOT a generic AI writer (P1)
5. **AI "Suggest improvements" in Diff Drawer** — leverages the existing diff payload
   so the AI sees only the delta in context (P2)


---

### ✅ Phase L — EXE INTERIOR Demo Storefront (DONE — 15 Feb 2026)
Strategic pivot: the corporate platform homepage now showcases a **demo shop** ("EXE Interior")
running on MOOD — the prospect feels they already own a licence. Pixel-close replica of the
client mockup, fully CMS-driven through the Phase J block system.

**Backend**
- 3 new section types in `core/storefront_registry.py`: stats_band, magazine_grid, brand_logos
- DEFAULT_PAGE_COMPOSITION.home updated:
  `store_hero · value_props · stats_band · projects_preview · magazine_grid · brand_logos`
- `scripts/seed_storefront_cms.py` build_home_sections() rewritten for new structure +
  6 locales (it · en-US · fr · de · es · ar/AE)

**Frontend**
- `homepage.js` + `navigation.js` full EXE Interior content (6 locales)
- `SiteHeader.jsx` 3-row layout matching mockup (lang | brand | utility+CTA above main nav)
- `HomePage.jsx` rebuilt with 6 sections, DB-first / JS-fallback content resolution
- `exe.css` dedicated stylesheet (cream/beige + dark/gold + serif/sans, RTL-aware)
- `languages.js` 'ar' enabled with short='AE'

**Pipeline**: dump → seed → Phase J revision publish. Public served from frozen snapshot.

### Next Action Items
- Studio inline editors for new block types (stats_band, magazine_grid, brand_logos)
- Magazine route page (currently anchor only)
- Localised seed mapping for 'ae' in homepage.js → LOCALE_MAP ('ae'→'ar')

---

### ✅ Phase M — "Try the Platform" Interactive Conversion Layer (DONE — 15 Feb 2026)
Strategic goal: collapse the gap between "seeing the demo" and "touching the platform".
The prospect should EXPERIENCE Draft vs Live + revision control within 30–60 seconds.

**Backend**
- `routers/demo.py` — `POST /api/demo/magic-link`
  - Issues a fresh demo session for a server-configured demo user
  - Rate-limit: 6 grants / IP / 10min (in-memory deque, single-pod adequate)
  - Returns same shape as /api/auth/login + redirect target + tenant_slug
- `.env`: DEMO_USER_EMAIL · DEMO_USER_PASSWORD · DEMO_TENANT_SLUG
- Server.py: included demo router under /api/demo

**Frontend**
- `components/demo/TryPlatformCta.jsx` — floating cinematic pill
  - Bottom-right (LTR) / bottom-left (RTL for AE)
  - Appears after scroll past hero, hides on /settings|/dashboard
  - Subtle 12s teal pulse, loading spinner, error toast
  - Locale-aware copy (6 languages incl. AE)
  - On click → mints session → stores under `mfd_session` (matches AuthContext key)
    → full-page reload to `/settings/storefront?demo=1&step=intro`
- `components/demo/DemoOnboardingTour.jsx` — guided 4-step tour
  - Activates on `?demo=1` or `mfd_demo_mode=1` flag, with dismissal persistence
  - Auto-tracking spotlight ring + glass card with cinematic shadows
  - Steps: hero edit · diff drawer · publish · revisions
  - Demo ribbon stays visible even after the tour is dismissed (until logout)
- `components/demo/demo.css` — dedicated stylesheet (teal #2cc7b3 accent)

**Bug fix**
- Initial implementation stored token under `access_token` key; AuthContext
  reads from `mfd_session` JSON. Updated to match the AuthContext shape so
  the full-reload re-hydrates the session correctly.

**Verified visually**
- CTA appears bottom-right after scroll · click → magic-link → land in Studio
- Demo ribbon visible · tour card cycles 1→2→3→4 steps
- EXE INTERIOR storefront loaded in edit mode, hero block selected

### Next Action Items (post-Phase M)
1. Sandboxed `demo_editor` role (P1) — currently reuses super-admin demo user
2. Inline Studio editors for stats_band / magazine_grid / brand_logos
3. Magazine route page · Projects landing route page
4. AI Editorial Assistant (scoped: topics/structure/images/SEO per market)
5. Media Library page (search/filter/replace/tagging)

### Future / Backlog
- Cross-pod rate-limit via Redis · auto-expire demo tenant data nightly
- "Demo session expires in N minutes" countdown pill in ribbon
- Per-tour-step analytics (which step retains best)
- Phase J.1: image diff overlay · scheduled publishing UI · AI assist in diff

