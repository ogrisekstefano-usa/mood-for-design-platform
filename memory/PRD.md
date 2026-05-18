# MOOD for DESIGN™ — Cultural Design Intelligence Operating System™

## Original Problem Statement
Multi-tenant SaaS "Design Workflow Operating System" (Blueprint OS) for interior designers, architects, retailers. Evolve into a **Cultural Design Intelligence Operating System™** with luxury Relationship CRM and multi-market, culturally-native Editorial Intelligence Engine. Public-facing storefronts must be 100% DB-driven and culturally adaptive.

**Active mandate**: ZERO HARDCODED POLICY. Every public surface must be editable from Blueprint, traceable, intentional. No new features until cleanup batches complete.

**Language**: Italian (Italiano).

## Tenancy & users
- SuperAdmin: `demo@moodfordesign.com` / `Blueprint2024!`
- Roles: `super_admin`, `tenant_admin`, `client`, `member`

## Information Architecture (Fase 0 — locked)
Blueprint sidebar canonical structure:
```
DASHBOARD
WORKSPACE      — Leads · Projects · Moodboards · References · Relationships
EXPERIENCE     — Experience Studio™
PROJECTS       — Projects Studio™ · Library · Materials · Collections
EDITORIAL      — Editorial Studio™ · Editorial Review
FORMS & JOURNEYS — Forms & Journeys™ (luxury lead architecture)
INTERNATIONAL  — International Presence™
TEAM           — Members · Insights
SETTINGS       — Tenant config · Brand · Billing · Integrations
PLATFORM       — Super Admin
```

Canonical admin routes:
- `/blueprint/experience` (canonical) — Experience Studio™
- `/blueprint/storefront` → redirects to `/blueprint/experience` (legacy alias)
- `/blueprint/projects-studio`
- `/blueprint/editorial`
- `/blueprint/forms-journeys`
- `/settings/international-presence`

## Public surface — DB-driven sections
| Surface | Section type | Editor (Experience Studio) | Status |
|---|---|---|---|
| Hero | `store_hero` | cinematic generic | ✅ |
| Value props | `value_props` | cinematic generic | ✅ |
| Dual CTA | `dual_cta` | cinematic specialized (private/professional sub-cards) | ✅ NEW |
| Stats Band | `stats_band` | cinematic specialized (KPI items array) | ✅ NEW |
| Projects rail | `projects_preview` + portfolio runtime | cinematic generic (title) | ✅ |
| Magazine Grid | `magazine_grid` | cinematic specialized (auto/manual mode + limit) | ✅ NEW |
| Brand Logos | `brand_logos` | cinematic specialized (logo cards) | ✅ NEW |
| Newsletter | `newsletter` | cinematic specialized | ✅ NEW |
| Header nav | `nav_top`/`main_links` | tabular specialized (link list + visibility + reorder) | ✅ NEW |
| Footer columns | `footer_columns` | tabular specialized (columns + links + socials) | ✅ NEW |
| Footer brand/showroom | `branding_settings` (i18n) | Brand Studio | ✅ |

Each editor displays a **"Controls public experience: X"** traceability chip.

## Completed Sessions

### Fase R-CRM-2 (Feb 18, 2026 — iteration 63) — Editorial Relationship CRM™ architecture
**Architecture-only sprint. NO UI per direttiva utente. 17/17 pytest GREEN.**

Sostituisce il vocabolario CRM generico con un editorial-native relationship orchestration layer.

#### Migration `041_editorial_relationship_crm.sql` (applicata su dev)
- **`accounts` esteso** con 7 nuove colonne editorial-native: `market_id`, `cultural_profile` JSONB, `hospitality_positioning`, `editorial_register_affinity`, `design_intent_summary`, `luxury_perception_axis`, `relationship_journey_stage`.
- **5 nuove tabelle**:
  - `account_markets` — relazione N:N account ↔ markets con `is_primary` e `engagement_strength`.
  - `relationship_engagement_signals` — ogni segnale editoriale (viewed_article, viewed_market_edition, clicked_cta, requested_sample, scrolled_long_form, …) con cultural overlay denormalizzato (market_id, locale_code, editorial_register, atmosphere_tags, material_tags, cta_intent, signal_weight, dwell_seconds, scroll_depth_pct).
  - `relationship_affinities` — snapshot 1:1 di Relationship Intelligence™ (preferred_atmosphere, preferred_materials, preferred_cta_intent, preferred_editorial_register, 5 score 0-100: hospitality_orientation, specification_orientation, long_form_engagement, editorial_cadence, luxury_perception_alignment).
  - `relationship_projects` — junction con `role` (client/architect/specifier/observer/referral_source) e `collaboration_stage` snapshot al momento del link.
  - `relationship_inspirations` — junction account ↔ design_references con `source` (saved_by_account/shared_by_advisor/inferred_from_engagement).
  - `relationship_material_affinities` — material attraction tracking con `attraction_score` 0-100, `sample_requested`, `specified`.
- **View `relationship_intelligence_v`** — aggrega counts (signal_count_total/30d/7d, linked_project_count, linked_inspiration_count, material_affinity_count, market_count) + ultimo snapshot affinities.
- **Seed 10 Editorial Journey™ stages canoniche** in `relationship_lookups.lifecycle_stage` con `metadata.canonical=true` + `metadata.editorial_journey=true` (non-breaking: stages legacy convivono).

Canonical journey stages (ordinati): discovery → inspiration → editorial_engagement → project_conversation → material_exploration → strategic_direction → specification → proposal → active_collaboration → long_term_relationship.

#### Backend router (`/app/backend/routers/relationships.py` — 14 nuovi endpoint)
- `POST/GET /accounts/{aid}/engagement` — log/list signal con cultural overlay completo.
- `GET /accounts/{aid}/affinities` · `POST /accounts/{aid}/affinities/recompute` — snapshot intelligence (heuristic deterministico via `collections.Counter` su signal_weight + atmosphere/material/cta/register/market aggregations + score normalizzati 0-100).
- `GET/POST/DELETE /accounts/{aid}/projects[/{pid}]` — project linkage CRUD.
- `GET/POST/DELETE /accounts/{aid}/inspirations[/{ref_id}]` — design_references linkage CRUD.
- `GET/POST /accounts/{aid}/material-affinities` — material attraction upsert.
- `GET/POST/DELETE /accounts/{aid}/markets[/{mid}]` — multi-market linkage + primary demotion logic + accounts.market_id pointer sync.
- `GET /intelligence` — dashboard view reading `relationship_intelligence_v` con filtri `?journey_stage=` e `?market_id=`.

#### Architecture documentation
- `/app/architecture/EDITORIAL_RELATIONSHIP_CRM.md` — 12 sezioni: design principle, vocabulary rename map, entity model, journey stages (con tone), engagement signal taxonomy, intelligence model, project linkage roles, market integration, moodboard/inspiration linkage, material affinity, endpoint catalog, UX principles per il futuro sprint UI.

#### Frontend types stub (no UI yet)
- `/app/frontend/src/lib/relationshipTypes.js` — JSDoc + 7 exported constants (EDITORIAL_JOURNEY_STAGES, SIGNAL_TYPES, PROJECT_LINK_ROLES, CTA_INTENTS, ENGAGEMENT_SURFACES, EDITORIAL_REGISTERS, HOSPITALITY_POSITIONINGS, LUXURY_PERCEPTION_AXES).

#### Test & validazione
- Backend pytest **17/17 GREEN in 30s** (`/app/backend/tests/test_iteration_63_editorial_relationship_crm.py`): migration sanity (5 tabelle + view); 10 canonical journey stages presenti con metadata flags; engagement signal POST/GET con filtro; affinities recompute deterministico (preferred_atmosphere=mediterranean, preferred_cta_intent=private_consultation, preferred_editorial_register=Ceremonial Hospitality verificati); project/inspiration link round-trip POST→GET→DELETE; material affinity upsert idempotente; account_markets primary demotion + accounts.market_id sync; intelligence view 9 campi + filtri; regressione R-CRM-1 (zero breaking changes).
- Curl smoke verificato live: POST/DELETE markets endpoint funziona (201/204).
- Lint Python clean.

#### Quick fixes applicati post-testing-agent
- DELETE `/accounts/{aid}/markets/{mid}` endpoint aggiunto (parity con projects/inspirations).
- Sanitizzato 409 error message su project re-link (rimosso DB exception leak).
- Defence-in-depth: aggiunto `tenant_id` filter sulle UPDATE writes su accounts + account_markets.

#### Cosa NON è incluso
- **NO UI** — esplicito per direttiva utente ("Architecture first").
- **NO AI affinity worker** — heuristic deterministico sufficiente per v1; AI overlay scriverà in `relationship_affinities.intelligence_payload`.
- **NO web pixel SDK pubblico** — i signal vengono loggati via API interna da renderer magazine/storefront in un workstream separato.
- **NO permission decorators** sui nuovi endpoint — gated solo via `_assert_account_owned` (tenant-scoped). Aggiungere `require_permission` matrix in iteration successiva.
- Code-review: `relationships.py` è ora 1054 righe — split in `relationships_core.py` + `relationships_editorial.py` consigliato in sprint cleanup futuro.



### Fase EDITORIAL-GOVERNANCE v1 (Feb 18, 2026 — iteration 62) — Context Rail + Adaptation Status + Market Matrix
**P1 directive eseguita: 4 fasi, testing agent 6/6 backend + 100% frontend GREEN.**

#### FASE A — `<EditorialContextRail />` (replace breadcrumb)
File: `/app/frontend/src/pages/editorial/EditorialContextRail.jsx` + styles in `editorial.css`.

Persistent rail tra MarketEditionsToolbar e studio grid. **9 campi** (mostra cosa stai orchestrando, non dove sei):
- Editorial Master · Market · **Adaptation Status** (palette: stone gray draft / amber awaiting / blue steel scheduled / soft gold publishing today / emerald published / muted rose diverged) · Next Step · Schedule · CTA · SEO Goal · Editorial Register · Public State

**Next Step Intelligence™** (euristico, NON generativo): advisory bar amber con `AlertTriangle` + "Risolvi →" CTA, visibile solo quando lo stato richiede un'azione. Esempi: "Crea un Editorial Master", "Componi i body blocks o sincronizza dal master", "Aggiungi adattamenti per altri mercati".

**Responsive**: XL=tutti i 9 campi · Laptop (1024-1439) = 5 campi essenziali · Tablet (640-1023) = 3 campi + schedule nascosta · Mobile <640 = grid collapsed sotto un chip cliccabile (`ectx-mobile-chip`).

#### FASE B — Editorial Adaptation Status™ (rename + 8 states + 7 actions)
- **Rinominato globalmente** "Translation Status" → "Adaptation Status" (sia UI che testid: `ed-variant-adaptation-<vid>` rimpiazza `ed-variant-translation-<vid>` — vecchio testid completamente rimosso).
- **8 stati canonici** mappati su Variant.status + `internal_translation` + body_blocks:
  - Synced With Master (cyan), Adapted (primary), Manually Curated (gold), Diverged (rose), Requires Review (amber), Awaiting Composition (gray), Scheduled (steel), Published (emerald).
- **`<AdaptationOperationsPanel />`** sotto il context rail (visibile solo con variant selezionato). 7 azioni:
  1. **Compose From Master** → POST `/api/editorial/variants/{vid}/compose` (canonical endpoint che esisteva già — chiama `editorial_ai.compose_variant()` server-side, rigenera body_blocks dalla `conceptual_direction` del master)
  2. **Re-sync** → POST `/api/editorial/variants/{vid}/transition` to_status='rebalancing'
  3. **Compare Against Master** — coming soon chip (rimandato P2)
  4. **Preserve Manual** → PATCH variant.metadata_json.preserve_manual=true
  5. **Restore Composition** (danger) → reset preserve_manual + ricompone
  6. **Lock Manual Version** → PATCH variant.metadata_json.manual_locked=true
  7. **Open Public Preview** → naviga a `/magazine/<locale>/<slug>?preview=1`

#### FASE C — Market Matrix™ Language Governance (nuova pagina `/blueprint/markets`)
File: `/app/frontend/src/pages/governance/MarketMatrixPage.jsx` + `market-matrix.css`. Lazy route + Sidebar nav entry "Market Matrix · Governance" sotto Editorial Operations.

Tabella governance separa esplicitamente **LANGUAGE ≠ MARKET ≠ EDITORIAL REGISTER**. 9 colonne:
- Market (code + locale anchor) · Language (derivato da primary_locale) · Macro Region · Editorial Register · Hospitality Profile · CTA Psychology · SEO Behavior · Publishing Windows · Luxury Perception

**Inline-editable cells** (click → input → blur/Enter): PATCH `/api/markets/{id}` su 4 JSONB:
- `cultural_profile.editorial_register/hospitality_profile/publishing_windows/luxury_perception_model`
- `cta_style.psychology`
- `seo_intent.behavior`

Verificato dal testing agent: italy market patch + revert idempotente. Funziona su 15+ mercati visibili.

#### FASE D — Stop Silent Fallbacks (partial)
- Variant cards mostrano "Da comporre" (gray) quando body_blocks è vuoto e locale ≠ canonical (`awaiting_composition` state esplicito invece di silent fallback).
- Editorial Context Rail mostra "No master selected" dimmed esplicito invece di nascondere il campo.
- Field `register` ha `Define register` placeholder quando vuoto invece di mostrare il locale del master.

#### Tech: bug fix master hydration
`EditorialStudioPage.onSelectVariant` ora chiama `GET /api/editorial/masters/{mid}` lazy per popolare il context rail con title+code del master invece di solo `{id}`.

#### Test & validazione
- Backend pytest **6/6 GREEN** (`/app/backend/tests/test_iteration_62_editorial_governance.py`): markets list+patch x2 (editorial_register + cta.psychology) con revert, master detail, variants list, compose endpoint non-500.
- Frontend Playwright **100% PASS** ai 3 viewport (1440x900 desktop XL, 1024x768 laptop, 600x800 mobile + 768 per Market Matrix): all 9 context rail fields visible at 1440; exactly 5 at 1024; mobile chip expand at <640; advisory bar amber-only; variant hydration master/market/status/CTA/SEO/register/public-state populated; adaptation panel 7 actions con compare disabled+'soon'+danger styling su restore; `ed-variant-adaptation-<vid>` confermato (translation testid completamente rimosso, 0 matches); Market Matrix 9 columns + 15 rows + inline edit triggers PATCH + persists + revert; sidebar nav entry; `?openAdd=1` regression OK; ZERO horizontal overflow.
- Lint JS clean su tutti i 6 file modificati.
- **Live curl verification**: `POST /api/editorial/variants/{vid}/compose` → 200 OK in 43s con Claude Sonnet 4 reasoning.

#### Cosa NON è incluso (rimandato a P2)
- **Compare Against Master** — UI placeholder con "soon" chip. Richiede side-by-side diff view (Master conceptual_direction vs Variant body_blocks).
- **Real-time "Diverged" detection** — attualmente inferito da `metadata_json.diverged=true`. Andrebbe calcolato server-side comparando hash di master+variant editorial_state.
- **Editorial Register history** — Market Matrix non mostra ancora la timeline delle modifiche al register. Audit log da abilitare in `markets.governance_json.changelog`.



### Fase EDITORIAL-OPS-WORKBENCH v1 (Feb 18, 2026 — current iteration 61) — Delete Protection + Market Editions Operability + Responsive + Translation Badges
**P0 directive eseguita: 4 fasi sequenziali, tutte verdi al testing agent (5/5 backend + 100% frontend).**

#### FASE 0 — `<MediaDeleteProtectionDrawer />` (P0 DAM safety net)
File: `/app/frontend/src/components/common/MediaDeleteProtectionDrawer.jsx` + wire in `MediaLibraryPage.jsx` Inspector.

- Intercetta `archive()` quando `detail.links.length > 0` invece di triggerare `confirm()`.
- Drawer right-aligned (max-width 680px) con:
  - Header sticky "⚠ Questo asset è utilizzato in N luoghi" (amber-icon)
  - Editorial Relationships Graph: usage list raggruppata per `entity_type`, ogni riga con thumbnail mini + entity label + role + locale chip + click-to-open deeplink (Link `react-router-dom` quando `ENTITY_META[type].href` è definito per project/moodboard/magazine/branding/storefront/reference).
  - 5 azioni: **Sostituisci ovunque** (upload nuovo file → `media.replace(id, {new_asset_id, migrate_links:true})`), Sostituisci selettivamente (Coming Soon disabled), **Archivia mantenendo i collegamenti**, **Rimuovi forzatamente** (two-step confirm), **Apri le superfici interessate** (chiude drawer + jump to usage tab).
- Footer sticky con philosophy reminder: "Il DAM ragiona come un editorial relationships graph, non come un file system".

#### FASE 1 — `<MarketEditionsToolbar />` (Operability in `/blueprint/editorial`)
File: `/app/frontend/src/pages/editorial/MarketEditionsToolbar.jsx`.

**Sticky top action bar** con 7 CTA:
1. `+ Nuovo Master` (primary verde) → apre `NewMasterModal` → POST `/api/editorial/masters` (code + title + canonical_locale + conceptual_direction)
2. `+ Nuova Market Edition` (disabled finché non c'è master) → apre `NewMarketEditionModal` con market grid + locale + slug → POST `/api/editorial/masters/{mid}/variants`
3. `Duplica` (disabled finché non c'è variant) → GET variant → POST stesso payload con slug `-copy-<id>`
4. `Programma` (disabled finché variant.status non è in `['approved','scheduled']`) → apre `ScheduleModal` (datetime-local) → POST `/api/editorial/variants/{vid}/schedule`
5. `Apri Calendario` → navigate `/blueprint/editorial-calendar`
6. `Da Pinterest` → navigate `/workspace/references?openAdd=1` (auto-opens AddReferenceModal on landing)
7. `Da Progetto` → navigate `/blueprint/projects-studio`

**Flow Strip permanente** sotto la toolbar: 5 stage canonical (1. Master → 2. Market Editions → 3. Review → 4. Schedule → 5. Publish). Stage attivo derivato da `selectedVariant.status` via `STAGE_FOR_STATUS()` mapping. Stage passati con opacity ridotta.

#### FASE 2 — Responsive Rebuild Editorial Studio (`editorial.css`)
- Wrapper `.ed-studio-wrap` flex column con toolbar sticky + studio grid.
- Breakpoints precisi:
  - **Desktop XL ≥1440**: `grid-template-columns: 380px 1fr` (rail full + composition)
  - **Laptop 1024–1439**: `grid-template-columns: 320px 1fr` (rail narrower)
  - **Tablet/Mobile <1024**: `grid-template-columns: 1fr` con rail stacked (`max-height: 320px`, border-bottom invece di border-right)
  - **Mobile <640**: toolbar buttons icon-only (`.me-btn span { display: none }`), flow strip horizontal-scroll
- Zero overflow orizzontale verificato dal testing agent ai 3 viewport (1440/1024/768).

#### FASE 3 — Translation Status Badges (groundwork)
Modifiche a `CompositionRoomRail.jsx`:
- Card variant arricchita: thumbnail (img da `hero_image_url` oppure placeholder dashed) + status dot + market + locale + status label + **translation badge** + scheduled date.
- Translation badge testid `ed-variant-translation-<vid>`. Inferenza:
  - `Master` (cyan) → variant nel locale canonico
  - `Manuale` (gold) → variant ha `internal_translation` data
  - `Da tradurre` (orange) → variant ha target_locale ≠ canonical ma nessuna traduzione registrata
  - `Tradotto` (primary) → riservato per stato pieno
  - `Diverge` (red) → riservato per master-divergence detection
- Header rail rinominato "Composition Room" → "Market Editions™" (utente l'aveva richiesto esplicitamente).

#### Backend
**Nessuna nuova endpoint**. Riutilizzo totale dello stack esistente:
- `POST /api/editorial/masters`
- `POST /api/editorial/masters/{mid}/variants`
- `POST /api/editorial/variants/{vid}/schedule` (richiede status='approved')
- `media.replace`, `media.archive`, `media.detail` (links hydration)

#### Test & validazione
- Backend pytest **5/5 GREEN** (`/app/backend/tests/test_iteration_61_market_editions.py`): masters POST + variants POST + schedule 409 guard + schedule success after approval chain + media list/detail.
- Frontend Playwright **100% PASS** su 3 viewport (1440x900, 1024x768, 768x1024): toolbar + 7 CTA + selection-state enablement; flow strip 5 stage; tutte e 3 le modal aperte e validate; translation badge renderizzato; deep-link `?openAdd=1` auto-apre AddReferenceModal; ZERO horizontal overflow.
- Lint JS clean su tutti i file modificati.

#### Cosa NON è incluso (rimandato a P1)
- **MediaDeleteProtectionDrawer live trigger** — codice in place ma testing agent non ha potuto smoke-testare perché il demo seed non ha asset con `usage_count > 0` raggiungibili dall'Inspector. Seed fixture necessaria.
- **Full Translation Status System** — i badge sono inferiti client-side; manca endpoint `GET /api/editorial/{master_id}/translation-status` che ritorni stato per locale + history. Manca anche pannello action (Traduci dal master / Re-sync / Compare / Lock manual / Restore AI / Show divergence).
- **Language Governance™ separazione esplicita LANGUAGE ≠ MARKET** — UI ancora mostra locale + market come due chip ma non c'è enforcement esplicito (EN-US ≠ EN-GB ≠ EN-AE).
- **Replace Selectively** — disabled placeholder con "Coming Soon" nel drawer. Richiede UI per per-link replace.
- **3rd column Operations Sidebar** a XL — riservata in CSS ma non popolata ancora.



### Fase GLOBAL-MEDIA-DAM v1 (Feb 18, 2026 — current) — `<EditorialMediaField />` + Pinterest Research Add Flow
**P0 GLOBAL MEDIA INPUT REFACTOR™ — Foundation of MOOD's editorial DAM.**

#### Nuovo componente globale: `<EditorialMediaField />`
File: `/app/frontend/src/components/common/EditorialMediaField.jsx` + `editorial-media-field.css`.

Sostituisce TUTTI gli input URL grezzi nel Blueprint admin. Supporta:
- **Upload locale** (drag & drop o file picker) → `/api/storage/signed-upload` → `/api/storage/media` (Supabase Storage, tenant-prefisso enforced).
- **Media Library picker** (riusa `AssetPickerModal`, generalizzato per accettare `entityType`/`entityId`/`bucket`/`folder`).
- **URL esterno fallback** (esplicito, mostrato come chip "EXTERNAL").
- **Preset crop responsive** via `aspect-ratio` CSS: `logo` (3:1), `hero` (16:9), `gallery` (4:3), `square` (1:1), `portrait` (4:5), `story` (9:16), `thumbnail` (1:1).
- **Visual states espliciti**: `empty` (dashed border + CTA), `uploading` (loader + progress bar), `ready` (preview + actions on hover), `library`/`external`/`multi` (chip badge differenziati).
- **Metadata inline**: alt_text + Image Intent enum (Editorial Atmosphere · Product Detail · Hospitality Emotion · Material Texture · …).
- **Usage Relationships chip**: legge `media.detail(asset_id)` → `links.length` → mostra "Usato in N luoghi" o "asset orfano".
- **Auto-link** alla `entityType/entityId/role` passati come prop (registra `media_links` row).
- **Focal point**: applicato come `object-position` CSS (preview-only — controls UI in v2).

Contratto value (backwards compat):
```jsx
<EditorialMediaField value="https://…" onChange={(url) => …} />  // legacy URL string
<EditorialMediaField value={{url, asset_id, alt_text, image_intent, focal_point}}
                     onChange={(obj) => …} valueShape="object" />
```

#### Sostituzioni effettuate (Fase 1)
- **Brand Studio** `/settings/brand`: `primary_logo_url` raw input → EMF preset=logo, entity=`branding_asset`.
- **Experience Studio** `/blueprint/experience`:
  - Hero `cover_url` → EMF preset=hero, entity=`cms_section`.
  - `brand_logos.logo_url` (per item) → EMF preset=logo, role=`brand_logo_<idx>`.
  - `dual_cta.<kind>_image` (private + professional) → EMF preset=hero, role=`dual_cta_<kind>_image`.

#### Pinterest Research™ Add Flow
File: `/app/frontend/src/pages/workspace/AddReferenceModal.jsx` + integrato in `ReferencesPage.jsx`.

- Pulsante CTA `+ Aggiungi riferimento` (top-right dell'EditorialHero + emptystate CTA).
- Modal sticky (header + footer fissi, body scrollabile) con 3 source tabs:
  - **Upload manuale** — drag & drop su zona 16:9 → POST `/api/storage/*` → POST `/api/references` (source_type='upload').
  - **URL Pinterest** — input URL pin → POST `/api/references` (source_type='pinterest', source_url + imported_image_url=pinUrl). NO scraping (rimandato a P2 con Pinterest API).
  - **Media Library** — apre `AssetPickerModal` per scegliere un asset esistente → POST `/api/references` (source_type='media_library').
- Metadata: curator_name, project_id (dropdown progetti), design_intent, tag tematici (#mood, #material, #hospitality, #mediterranean, …), note.
- Submit → POST `/api/references` → backend `_interpret_and_store` (Cultural Design Intelligence pipeline via Claude Sonnet) → reference appare nella research room una volta `editorial_status='ready'`.

#### Backend (no schema change)
Riutilizzo dello stack esistente (Phase N/P già completo):
- `/api/storage/signed-upload` (tenant prefix enforced).
- `/api/storage/media` (register row in `media_library`).
- `/api/media/*` (list, stats, detail con `media_with_usage` view, links).
- `/api/references` (ingest + cultural interpretation).

#### Test & validazione
- `pytest /app/backend/tests/test_iteration_60_media_field.py` — **7/7 GREEN**: signed-upload contract, media stats shape, media list, references list, reference-collections, POST happy path + 422 validation.
- Playwright (1440x900): Brand Studio EMF empty + external URL flow; AddReferenceModal CTA + 3 tabs + submit enable + tag toggle + close (post-stickyfication); Experience Studio store_hero/dual_cta/brand_logos tutti renderizzano EMF.
- Lint JS clean su 7 file modificati.

#### Cosa NON è incluso (rimandato)
- Crop UI interattivo (gli aspect-ratio preset sono visual hints, non crop tools veri).
- Filtri immagine (luminosità, contrasto, color grade) — placeholder per P1.
- Atmosphere keywords, photographer, copyright fields — rimangono in `metadata_json` ma senza UI dedicata (P1).
- Pinterest API scraping — P2.
- Auto-translation UI status indicators — P0 prossima sessione.
- Market Editions Operability batch (sticky CTAs, onboarding strip, empty states) — P0 prossima sessione.
- Responsive Rebuild Editorial Studio — P0 prossima sessione.



### Fase LIGHT-MODE-FIX (Feb 18, 2026 — current) — Editorial Paper Mode™ Restored
**P0 BLOCKER RISOLTO**: il toggle light/dark (`[data-testid="theme-switch-light"]`) ora funziona su TUTTI gli admin surface.

#### Root cause
`/design-system/os/tokens.css` definiva `[data-surface="os"] { --bp-bg: #070707; … }` con specificity più alta del `:root[data-workspace-mode="light"]` di `index.css`. Il toggle modificava `<html data-workspace-mode="light">` correttamente, ma le CSS variables venivano sovrascritte dal blocco surface-scoped.

#### Fix
Aggiunto override `:root[data-workspace-mode="light"] [data-surface="os"]` in `tokens.css` (2 attribute selectors > 1, vince specificity senza `!important`). Mantiene il pattern surface-scoped intatto, attiva Editorial Paper Mode™ (ivory `#F2ECE0`, ink `#0F0D0A`, accent verde scuro `#0D8A70`, paper grain) su tutta la chrome OS quando il toggle è light.

#### Test live PASSATO (3 screenshot)
- DARK default ✓
- LIGHT toggled — sidebar bg `rgb(242, 236, 224)`, topbar paper, cards Today's International Presence, calendar grid, Operations Intelligence sidebar tutti in modalità paper ✓
- Back to DARK ✓

### Fase OPERATIONS-CORE v3 (Feb 18, 2026) — Public Preview Drawer + Zero Confusion
**P0 UX refactor**: clicking a calendar event ora apre un drawer con la **superficie pubblica**, non il Blueprint admin.

#### Public Preview Drawer™
- Componente `PublicPreviewDrawer.jsx` accessibile da ogni event pill (sia month sia week view).
- Mostra: cover image, EDIZIONE · COUNTRY · LOCALE kicker, status chip cromatico (PUBBLICATO/PROGRAMMATO/BOZZA), titolo, excerpt, meta strutturata (pianificazione · mercato editoriale · CTA · SEO goal · approval state · URL pubblico).
- Azioni: **APRI SUL SITO PUBBLICO** (target=_blank verso `/magazine/{slug}` o `/projects/{slug}` o `/{page_key}`), **MODIFICA MARKET EDITION** (→ Editorial Studio), **RIPROGRAMMA (drag&drop)** hint, **DUPLICA PER ALTRO MERCATO**, **PUBBLICA ORA** (CTA verde solo se status≠published).
- Footer: hint "Anteprima della superficie pubblica. Tutte le azioni qui sopra rispettano la separazione UI admin · contenuto editoriale."

#### Header CTAs visibili (Zero Confusion)
- `+ NUOVO EDITORIAL MASTER` (primary) → `/blueprint/editorial?new=master`
- `+ NUOVA MARKET EDITION` (ghost) → `/blueprint/editorial?new=variant`
- `+ NUOVO PROGETTO` (ghost) → `/blueprint/projects-studio?new=1`
- Hint "Trascina sul giorno per programmare" allineato a destra.

#### Backend enrichment per drawer
- Event payload ora include `cover_url`, `excerpt`, `public_url` (separato da `edit_href`).
- Magazine: cover dal record `cover_url`, excerpt da `locale_content[locale].excerpt`.
- Project: cover da `cover_image_url`, excerpt da `location`.
- Page: cover null, public_url = `/` per home altrimenti `/{page_key}`.

#### Renames operativi
- **Editorial Review** → **Publication Review™** (Publication Review · in Italian: "Publication Review™" + subtitle "Approva i contenuti prima del rilascio pubblico").
- **Composition Room** → **Market Editions™** (Editorial Studio empty-state ora ha kicker "Editorial Operations · Magazine", titolo "Market Editions™", body "Crea versioni culturalmente native di un'unica direzione editoriale").
- Helper subtitle: "Crea versioni culturalmente native di un'unica direzione editoriale."

### Fase OPERATIONS-CORE v2 (Feb 18, 2026) — Drag&Drop + Intelligence
- **Drag & drop scheduling**: ogni event pill è `draggable`. Si trascina sulla cella di un altro giorno (mese o settimana) → `PATCH /api/blueprint/calendar/{event_id}/schedule` aggiorna:
  - `magazine_articles.published_at` + `status='scheduled'` (se non già `published`)
  - `portfolio_projects.published_at` + `status='scheduled'`
  - `cms_pages.scheduled_publish_at` + `status='scheduled'`
  Optimistic UI + toast conferma; preserva l'ora del giorno originale, cambia solo la data.
- **Weekly view**: switcher Mese/Settimana. 7 colonne lun-dom con eventi ordinati per ora. OGGI evidenziato. Drag target on column. Prev/Next salta una settimana invece di un mese.
- **Operations Intelligence sidebar** (`/api/blueprint/calendar/intelligence`):
  - Rule 1: mercato attivo senza pubblicazioni 30gg → `under-published` HIGH
  - Rule 2: SEO pressure bassa (articoli < 30% del totale) → `seo-pressure` MEDIUM
  - Rule 3: pipeline futura vuota → `empty-pipeline` HIGH
  - Rule 4: mercato primario con cadenza < 2/mese → `primary-cadence` MEDIUM
  - Rule 5: rapporto authority gap progetti pubblicati pochi → `authority-gap`
  Ogni suggestion ha severity + body + CTA deep-link verso editor appropriato. Footer indica "rule-based · evolves into AI operations layer" (Sora 2 / GPT-5.2 future integration).
- **Saturation heatmap**: celle del mese mostrano densità eventi via opacity progressiva del colore primary (1→5 eventi = scaling background).
- Test live PASSATO: month + week view + intelligence + drag&drop API verificato via curl.

### Fase OPERATIONS-CORE (Feb 18, 2026) — Editorial Calendar™ + Renames
**Nuovo cuore operativo della piattaforma**: international editorial operations system, no AI experimentation, no metaphor.

#### Editorial Calendar™ — `/blueprint/editorial-calendar`
- **Backend**: nuovo `/api/blueprint/calendar` aggrega in unico stream `magazine_articles` + `portfolio_projects` + `cms_pages` con datetime, locale, country flag, status, CTA target, SEO goal, approval state.
- **Frontend**: pagina monthly grid (42 celle) + Today's International Presence (tabella per mercato con today/scheduled/published) + stream operativo prossimi 7 giorni.
- Event pill = type-aware deep link verso editor specifico (Magazine, Projects Studio, Experience Studio).
- Filtri: all | article | project | page. Nav mese: prev/today/next.
- Test live PASSATO: tenant demo mostra 9 eventi · 2 mercati (Global + Italia) · 6 live.

#### Renames per direttiva
- "Editorial Review" → **Publishing Queue™** (sidebar `nav.publishingQueue`)
- "Composition Room" → **Market Editions™** (label sidebar `Magazine · Market Editions`)
- "Archivio" / "Library" → **Media Library™** (sidebar `nav.mediaLibrary`)
- "Ispirazioni" / "References" → **Pinterest Research Feed™** (`nav.pinterestResearch`)
- Section header "Editorial" → **Editorial Operations** (promoted to top after Dashboard)

#### Sidebar IA refactored
Nuovo ordine: Dashboard → **Editorial Operations** (Calendar · Magazine · Publishing Queue) → Workspace → Experience → Projects (+ Media Library) → Forms & Journeys → International → Team → Settings → Platform.

### Fase EMERGENCY-STABILIZATION (Feb 18, 2026) — Route Collapse + Single Render Pipeline
**P0 stabilization mode**: rollback architectural complexity. ONE frontend, ONE runtime, ONE render pipeline, ONE source of truth.

#### Route Forensics findings
- `OSWrap` (BlueprintThemeProvider) era applicato a `/magazine`, `/magazine/:slug`, 12 magazine locale-prefix routes, `/start-project`, `/professionals/intake`, `/auth/*` — questo causava il "two frontends mentally coexisting" segnalato.
- 6 blocchi locale-prefix con SiteLayout duplicavano `projects`, `projects/:slug`, `professionals` (corretto perché annidato, ma il magazine era esterno con OSWrap).
- `/blueprint/storefront` redirect + `/settings/storefront` redirect = dead aliases.
- `/blueprint/experience` aveva un sub-route `/editor` introdotto col command center.
- `ExperienceOverviewPage` era una nuova abstraction non richiesta.

#### Rollback eseguito
- **DELETED** `ExperienceOverviewPage.jsx` + `experienceOverview.css`.
- `/blueprint/experience` → torna a essere lo Storefront Studio editor direttamente.
- **DELETED** route `/blueprint/storefront` (redirect).
- **DELETED** route `/settings/storefront` (redirect).
- **DELETED** route `/blueprint/experience/editor`.
- **UNIFIED** Magazine sotto `<SiteLayout>` (rimosso OSWrap dalle 14 route magazine: 2 base + 12 locale).
- **UNIFIED** `/start-project`, `/professionals`, `/professionals/intake`, `/onboarding/:kind` sotto SiteLayout block (prima erano sparpagliati con OSWrap o duplicati).
- **ADDED** sub-route magazine ai 6 locale blocks (it-IT, en-US, en-GB, es-ES, fr-FR, de-DE) sotto stesso SiteLayout — un solo renderer.
- `OSWrap` rimane SOLO per `/auth/login`, `/auth/signup`, `/auth/forgot-password` (corretto — admin theme).

#### Broken deep-link fix
- `pages/settings/SettingsPage.jsx`: tile `tile-storefront` → `/blueprint/experience` (label "Experience Studio").
- `pages/settings/SettingsPage.jsx`: tile `tile-forms` → `/blueprint/forms-journeys`.
- `components/demo/TryPlatformCta.jsx`: redirect default → `/blueprint/experience?demo=1&step=intro`.
- `components/demo/DemoOnboardingTour.jsx`: comment updated.

#### Test PASSED end-to-end
- `/magazine` ora ha `.mfd-header` + `.mfd-footer` (SiteLayout pubblico) ✓
- `/blueprint/experience` renderizza Studio editor con 8 bande ✓
- ESLint 0 issues ✓
- Niente 404 sui main entry points (Home, Magazine, Brand Studio, Experience, Settings) ✓

### Fase 0.6 (Feb 18, 2026) — Experience Overview™ (REVERTED in stabilization)
- **NEW**: `/blueprint/experience` ora è la **command center di orchestrazione** (Experience Overview™), non più l'editor diretto.
- **NEW**: `/blueprint/experience/editor` → Storefront Studio editor (deep-link via `?page={page_key}`).
- KPI bar: Public surfaces · Live · Drafts · Sections orchestrated · Locales attive · Mercati
- Card grid: una card per ogni surface (Homepage, Projects, Magazine, Navigation, Footer, About, Contact, Start a project, Professionals, UI labels) con:
  - Status badge cromatico (LIVE / DRAFT / SCHEDULED / ARCHIVED)
  - Visible sections / total sections
  - Locale chips (prime 6 + "+N")
  - Last updated (italian locale formatted)
  - Page key (mono)
  - EDIT (deep-link) + PREVIEW (apre il sito pubblico in tab)
- Header con "← Experience Overview" link nello Studio editor per tornare al hub.
- Filosofia footnote: chiarezza dei confini (Brand Studio = identità · Experience = orchestrazione · International = mercati · Editorial = magazine · Forms & Journeys = acquisizione).

### Fase 0.5 (Feb 18, 2026) — HEADER UNIFICATION + Multi-locale fix + i18n cleanup
- **HEADER P0 BLOCKER RESOLVED**: backend `/api/storefront/public/{slug}/brand` ora legge la nav UNICAMENTE da `cms_sections.nav_top` (Experience Studio).
  - **DEFAULT_LINKS hardcoded ELIMINATO** dal backend.
  - **branding_settings.public_nav.main_links** stripped (migration `migrate_unify_nav_source.py`).
  - **Empty nav → empty array** sul frontend (intentional empty-state, niente silent fallback).
  - **Test end-to-end PASSED**: edit `cms_sections.nav_top.settings.links` → `/brand` endpoint reflects immediately → `SiteHeader` rende il nuovo link nel public storefront.
- **Multi-locale Brand identity FIX**: i campi `public_brand_name_i18n`, `tagline_i18n`, `short_description_i18n` aggiunti al modello Pydantic `Branding` (prima venivano scartati silenziosamente — causa per cui EN-GB, ES-MX, AR-AE non venivano persistiti).
- **Brand Studio scope LOCK**: copy aggiornato — Brand Studio controlla SOLO identità · palette · tipografia · logo · contatti · showroom. Nav/footer/sezioni vivono solo in Experience Studio.
- **Traceability chip "● Controls public storefront theme · NOT Blueprint admin"** aggiunto a Palette + Presets in Brand Studio.
- **i18n cleanup Blueprint admin** (sezione brand): nuove chiavi `brand.*` aggiunte a `DEFAULT_I18N["it"]` + `["en-US"]` (title, intro, controls, section.identityKicker, section.identity, section.paletteKicker, section.paletteTitle, section.typographyKicker, section.typographyTitle, field.public_name, field.tagline, field.short_desc, field.support_email, field.phone, field.website, field.primary_logo, field.display, field.body, i18nHint, save, discard, livePreview, paletteTrace, presetsTrace). Tutti gli hardcoded inglesi sostituiti da `t('brand.…', null, '…italiano fallback…')`.

### Fase 0 + Fase 1 (Feb 18, 2026)
- Renamed `Storefront Studio` → **Experience Studio™** (label + canonical route `/blueprint/experience`)
- Legacy `/blueprint/storefront` → automatic redirect (preserves bookmarks)
- Sidebar IA refactored into 9 canonical sections (Workspace · Experience · Projects · Editorial · Forms & Journeys · International · Team · Settings · Platform)
- `/blueprint/forms-journeys` route added (currently maps to FormBuilderPage; full Luxury Lead Architecture in Fase 3)
- DELETED legacy `/pages/settings/StorefrontPage.jsx` (Session A placeholder)
- DELETED legacy `/pages/settings/StorefrontStudio.jsx` (Session B duplicate)
- `/settings/storefront` route redirects to canonical Experience Studio
- Hybrid renderer architecture implemented in `/app/frontend/src/pages/storefront/bandEditors.jsx`:
  - **Tabular**: `NavTopEditor`, `FooterColumnsEditor`
  - **Cinematic**: `StatsBandEditor`, `BrandLogosEditor`, `MagazineGridEditor`, `NewsletterEditor`, `DualCtaEditor`
- Traceability chip "● CONTROLS PUBLIC EXPERIENCE: …" on every editor
- Seeded `dual_cta`, `stats_band`, `brand_logos`, `magazine_grid`, `newsletter` sections on demo tenant home page (idempotent merge — never overwrites admin edits)
- Deduped legacy duplicate sections (home, projects, professionals, start_project, ui, navigation pages)
- Public HomePage renderers added: `StatsBand`, `BrandLogosStrip`, `MagazineGrid` (no silent fallback when DB empty → editorial empty-state)
- `DualCTA` rebound to canonical `dual_cta` section (private/professional sub-fields)
- `Newsletter` `success` message now sourced from CMS

### Previous sessions
- Projects Studio™ Backend & UI + cultural adaptation
- Editorial Studio palette alignment
- Phase S-CONNECT Step B Phases 1–3 (frontend runtime binding for projects, positioning consumption)
- International Presence™ Positioning Modes (`custom_settings.positioning`)
- Brand Studio Multilingual Support (`public_brand_name_i18n`, `tagline_i18n`)
- Seeded Demo Tenant Header/Footer into `storefront_content` DB

## Roadmap / Pending

### Fase 2 — Magazine Parity™ (NEXT)
- Backend `editorial.py`: master/variants/publish-per-locale identical to Projects pattern
- Editorial Studio: Market Editions tab + publish workflow completo
- Public bind `MagazinePage` + `MagazineArticlePage` to runtime articles endpoint
- Remove `ui.js` magazine labels
- Collapse 12 magazine locale routes into `SiteLayout` (refactor away copy-paste)

### Fase 3 — Forms & Journeys™ (Luxury Lead Architecture)
- Schema extension: `journey_type · target_audience · market_visibility · locale_adaptation · cta_source · destination_routing · assigned_pipeline · lead_classification · editorial_framing · hospitality_tone · qualification_logic`
- Build DB-driven `/start-project/private`, `/start-project/professional`, `/contact`
- DELETE legacy: `/onboarding/*`, `/professionals`, `/professionals/intake`, `OnboardingPlaceholderPage`, `ProfessionalsGatewayPage`, `StartProjectWizard`, `onboardingGraph.js`, `professionals.js`, `onboarding.js`

### Fase 4 — Project 3-CTA System + Homepage Dynamic Orchestration
- Project Detail final CTAs: Private Client · Pro/Architect · General (market-aware, positioning-adapted)
- Homepage runtime: 4–5 random published projects + 3 editorial articles filtered by locale × market × cultural compatibility

### Fase 5 — UI String Override Architecture
- `tenants.ui_overrides_i18n` JSONB column
- Hybrid loader (code defaults + DB overrides per tenant)
- Override panel in Experience Studio

### Fase 6 — Polish & Guardrails
- "Controls public experience: X" trace labels on every Blueprint admin form (Brand Studio, Editorial, Forms, International)
- ESLint rule: blocco imports da `site/content/*` in nuovo codice
- Remove `homepage.js` + `navigation.js` fallback paths entirely (P0 cleanup leftover — still imported as last-resort safety net; will be removed once empty-state UX is validated)
- Empty-state design for Projects/Magazine when no DB content
- Editorial Presence Calendar™ + License Architecture (prepaid credits)

### Backlog (Future)
- Phase 2 Visual CRM Quick Create / Guided New Lead Procedure
- Client Portal luxury concierge experience
- Editorial Presence Calendar™

## Code Architecture
```
/app/
├── backend/
│   ├── routers/      # storefront.py · markets.py · editorial.py · portfolio.py · magazine.py · settings.py
│   ├── services/     # project_market_composer.py · editorial_ai.py
│   └── scripts/      # seed_storefront_navigation.py · seed_storefront_home_bands.py
└── frontend/src/
    ├── pages/
    │   ├── storefront/   # StorefrontStudioPage.jsx (Experience Studio) · bandEditors.jsx (hybrid renderers)
    │   ├── settings/     # InternationalPresencePage.jsx · BrandStudioPage.jsx · FormBuilderPage.jsx
    │   ├── projects/     # ProjectsStudioPage.jsx
    │   ├── editorial/    # EditorialStudioPage.jsx · VariantApprovalInboxPage.jsx
    │   └── site/         # HomePage.jsx · ProjectsIndexPage.jsx · ProjectDetailPage.jsx · MagazinePage.jsx
    └── site/
        ├── components/   # SiteHeader.jsx · SiteFooter.jsx · …
        ├── usePositioning.js · usePublicBrand.js · useStorefrontContent.js
        └── content/      # tenant.js · languages.js · ui.js (i18n) + LEGACY fallbacks (homepage.js/navigation.js — pending removal)
```

## Key DB schemas
- `tenant_markets.custom_settings` JSONB (positioning_mode, business_intent, primary_audience, cultural_editorial_lens)
- `cms_pages` (page_key, status, published_revision_id)
- `cms_sections` (section_type, locale_content JSONB, settings JSONB, sort_order, visible)
- `portfolio_projects` + `portfolio_project_variants`
- `branding_settings` (public_brand_name_i18n, tagline_i18n)

## Tech stack
React 19 · Tailwind · FastAPI · Supabase Postgres · Claude Sonnet via emergentintegrations (Universal LLM Key)

## Frontend Runtime Audit
See `/app/memory/FRONTEND_RUNTIME_AUDIT.md` for the running cleanup ledger. After Fase 0+1:
- 7 missing admin renderers → ✅ implemented (hybrid: tabular for structural · cinematic for experiential)
- Storefront duplicates (`StorefrontPage.jsx`, `StorefrontStudio.jsx`) → ✅ deleted
- Traceability gaps on header/footer/stats/logos/magazine grid → ✅ closed
- Remaining: legacy `homepage.js` / `navigation.js` fallbacks (kept for now as last-resort safety net, removal scheduled in Fase 6)
