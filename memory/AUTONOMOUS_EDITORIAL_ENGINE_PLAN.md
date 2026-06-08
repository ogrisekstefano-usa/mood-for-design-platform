# BLUEPRINT AI · AUTONOMOUS EDITORIAL ENGINE™ · PLAN
**Date:** 08 Jun 2026
**Status:** PLAN ONLY · nessuna implementazione
**Owner:** Main Agent · MOOD for DESIGN™
**Scope:** Audit → Architettura target → Sprint MVP per go-live

---

## 0 · TL;DR

Il sistema editoriale di MOOD ha **già il 90% delle fondamenta tecniche** per diventare un motore autonomo (Master/Variants pattern · hotspot table · media library con categorie · locale profiles con tone/CTA/vocabolario · tenant_markets per mercato attivo).

Il problema **non è tecnico ma di esperienza**:
1. UI fa vedere allo showroom strumenti da agenzia (Editorial Master, Market Editions, Compose, Re-sync) invece di una pipeline "AI ha preparato 7 contenuti · approva o chiedi modifica"
2. Manca lo *scheduler autonomo* che pianifica e genera autonomamente in base a `tenant_markets.custom_settings.weekly_frequency`
3. Manca la *proofreading view* bilingue (target locale + spiegazione in lingua tenant)
4. Manca un gate **"MEDIA REQUIRED"** che impedisce a Blueprint AI di pubblicare con stock photos non autorizzate
5. Manca il flusso operativo "Autopilot / Review Only / Manual"

Il piano sostituisce il chrome tecnico con **Editorial Autopilot™** + **Proofreading Inbox™**, riusa al 100% l'infrastruttura esistente, e aggiunge solo 2 tabelle leggere + 1 scheduler worker.

---

## 1 · Architettura editoriale attuale (audit)

### 1.1 · Data model esistente (riutilizzabile in toto)

| Tabella | Cols | Ruolo nel nuovo sistema |
|---------|------|------------------------|
| `editorial_masters` | 22 | **Canonical content concept** — già contiene `conceptual_direction`, `target_psychology`, `architectural_tone`, `hospitality_positioning`, `material_language`, `cta_intent`, `seo_intent`, `baseline_imagery`, `canonical_article_seed`, `taxonomy`. Niente da aggiungere. |
| `editorial_variants` | 36 | **Per-market variant** · già contiene `market_id`, `target_locale`, **`blueprint_review_locale`** (proofreading language!), `title`, `excerpt`, `body_blocks`, `hero_image_url`, **`hotspot_data` JSONB**, **`internal_translation` JSONB** (la "spiegazione in italiano" già esiste!), `cultural_angle`, `tone_label`, `seo`, `cta_set`, `status`, `scheduled_at`, `published_at`, `ai_meta`. **Match diretto** con il brief. |
| `article_hotspots` | 18 | Già supporta `x_pct`/`y_pct`, `locale_content` JSONB, `linked_material_id`, `linked_asset_id`, `linked_article_id`, `linked_project_id`, `linked_collection_id`, `cta_action`. **Match diretto** con i 5 tipi di hotspot del brief. |
| `media_library` | 33 | Già supporta `category`, `tags`, `alt_text`, `focal_point`, `is_inspiration`, `cultural_reading`, versioning (`replaces_id`, `version_number`). Pronto per la categoria "Magazine & Social Content". |
| `media_collections` | 12 | Con `kind` + `slug` → modello perfetto per le collection editoriali ("magazine-content", "social-content", "newsletter-content", per-market overrides). |
| `media_asset_usage` + `media_asset_variants` + `media_links` | — | Tracking già esistente di dove un'immagine è usata. **Audit trail per anti-stock-photo è già nelle ossa.** |
| `tenant_markets` | 8 | Già contiene `is_active`, `is_default`, `custom_settings` JSONB. La **frequenza per mercato** va qui in `custom_settings.weekly_frequency`. |
| `locale_profiles` | 19 | Per locale ha già `emotional_style`, `editorial_tone`, `cta_style`, `vocabulary_rules`, `forbidden_patterns`, `positioning_examples`, `system_brief`. **Questo è il fuel del Market Adaptation Engine™.** |
| `markets` + `markets_canonical` | — | Tassonomia mercati. |
| `market_cultural_profiles` + `market_positioning_profiles` + `market_narrative_profiles` | — | Tre tabelle ricchissime di contesto culturale già aggregato. |
| `editorial_phrases` + `editorial_phrase_overrides` + `editorial_translations` | — | Microcopy localizzato (già 100% i18n-ready). |
| `published_design_journeys` + `published_design_journey_translations` | — | Pattern di pubblicazione localizzata già provato in PRODUZIONE per le Project Story. **Lo stesso pattern si applica agli articoli.** |
| `editorial_composition_log` + `editorial_market_learnings` | — | Audit trail e learning loop già esistenti. |

### 1.2 · Routers backend esistenti

```
backend/routers/
├── ai_editorial.py                      ← AI generation (esistente)
├── editorial.py                         ← CRUD masters/variants (esistente, da nascondere a showroom)
├── editorial_calendar.py                ← Calendar API (esistente)
├── editorial_copy_cms.py                ← Microcopy admin (esistente, da tenere admin-only)
├── editorial_runtime.py                 ← Public rendering (esistente)
├── editorial_runtime_overrides.py       ← Tenant overrides (esistente)
├── editorial_variants.py                ← Variants CRUD (esistente, da nascondere a showroom)
├── locale_runtime.py                    ← Locale resolution (esistente)
├── magazine.py                          ← Magazine surface (esistente)
├── market_intelligence.py + market_perspectives.py + markets.py
└── blueprint.py + blueprint_admin.py    ← Admin tooling (esistente)
```

### 1.3 · Frontend surface attuali

`/blueprint/editorial` (Content Studio · ora gated da `is_store_mode` SHOWROOM-friendly entry)
`/blueprint/editorial-calendar` (Calendar)
`/blueprint/projects-studio` (legacy editorial stories · già nascosto da STORE-001)
`/admin/editorial-copy` (microcopy CMS · admin-only)

### 1.4 · Conclusione audit

**La base esiste · manca l'orchestratore.** Il sistema oggi è uno strumento d'agenzia per chi sa cosa fa. Va trasformato in un servizio che lavora da solo e mostra al showroom solo il prodotto finito.

---

## 2 · Cosa va NASCOSTO allo showroom

Tutti questi termini/UI sono **strumenti tecnici** che devono restare in Blueprint admin · non devono mai comparire nel ruolo `tenant_admin/tenant_member` showroom:

| Voce tecnica | Dove vive oggi | Trattamento |
|--------------|----------------|-------------|
| Editorial Master | `/blueprint/editorial/masters` (route admin) | Nascosto · solo super_admin/agency |
| Market Editions | UI variant manager | Sostituito da **Proofreading Inbox** |
| Compose From Master | bottone Variant builder | Sostituito da **Autopilot scheduled run** |
| Re-sync / Preserve Manual | conflict resolution UI | Spostato in advanced admin tab |
| Registry / Adaptation Operations | bulk ops UI | Spostato in Blueprint admin |
| `editorial_phrases` admin | `/admin/editorial-copy` | OK, già admin-only |
| Variant slug / status raw | Variant editor | Mostrato come "Bozza · In proofreading · Approvato · Pubblicato" |
| Internal Translation JSON | Variant editor | Mostrato come "Spiegazione in italiano" (humanized) |

**Regola**: tutto ciò che richiede di sapere "cos'è un master/variant/locale-profile" va nascosto dietro `role=blueprint_admin`.

---

## 3 · Cosa RESTA in Blueprint admin

Surface tecniche preservate per agenzia/team MOOD (route `/admin/*` o `/blueprint/admin/*`):

1. **Editorial Master Studio** — creazione/editing di canonical seeds, taxonomy, baseline imagery
2. **Variant Composer** — manual override di variant specifici se l'AI sbaglia
3. **Editorial Copy CMS** — gestione `editorial_phrases` (microcopy globale)
4. **Locale Profile Editor** — gestione `locale_profiles` (vocabulary_rules, forbidden_patterns, system_brief)
5. **Market Cultural Profiles** — fine-tuning culturale mercato per mercato
6. **Re-sync & Adaptation Operations** — bulk ops e conflict resolution
7. **Editorial Composition Log** — debug del Market Adaptation Engine
8. **Market Learnings Feedback** — chiusura del loop AI → feedback umano

Questi rimangono a costo zero (già implementati), basta NON mostrarli al ruolo showroom.

---

## 4 · Nuovo flow · Editorial Autopilot™

### 4.1 · Schermata principale `/blueprint/editorial` (per showroom)

```
┌──────────────────────────────────────────────────────────────┐
│  EDITORIAL AUTOPILOT™                                        │
│  Questa settimana Blueprint AI ha preparato per te:          │
│                                                              │
│  USA · 🇺🇸           Francia · 🇫🇷         UK · 🇬🇧             │
│  3 contenuti         5 contenuti          2 contenuti        │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  📥 IN PROOFREADING        7                                 │
│  ✓ DA APPROVARE            4                                 │
│  🚀 PRONTI PER PUBBLIC.    3                                 │
│  ⚠️  BLOCCATI               1   (MEDIA REQUIRED)              │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  MERCATI COPERTI · 3 / 5                                     │
│  MERCATI SCOPERTI · Germania, Spagna (Blueprint sta          │
│                     preparando il primo ciclo)               │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 · Modalità operative (configurabili in tenant settings)

| Modalità | Comportamento |
|----------|---------------|
| **Autopilot** | Blueprint AI genera + auto-approva + pubblica seguendo le regole di approvazione. Tenant vede solo "Pubblicati questa settimana". |
| **Review Only** ⭐ default showroom | Blueprint AI genera + mette in proofreading. Tenant approva/chiede modifica/rigenera/pubblica. |
| **Manual** | Blueprint AI suggerisce solo · tenant decide tutto manualmente. |

### 4.3 · Pipeline operativa (asincrona)

```
[Tenant config: lingua principale + markets + frequency + tone + categories + brands prioritari]
              │
              ▼
[CRON · Autopilot Planner runs daily 03:00 UTC]
              │
              ├─ Calcola gap settimanale per mercato:
              │  want = tenant_markets.custom_settings.weekly_frequency
              │  have = COUNT(editorial_variants WHERE created_at > NOW()-7d)
              │  gap  = max(0, want - have)
              │
              ▼
[Per ogni gap × market:]
   1. Choose content type rotation (article / newsletter / linkedin / pinterest / case_study)
   2. Choose source pillar (Brand Atlas / Material / Project Story / Moodboard)
   3. Generate Editorial Master (if not existing) using emergent_llm_key Gemini/Claude
   4. Generate Editorial Variant for target market using market_cultural_profiles
   5. **Select media from media_library WHERE category IN ('magazine','social','market_xxx') AND archived_at IS NULL**
      → if empty → status='media_required' (block)
   6. **Suggest hotspots** for each block_id (AI proposes 3-5 per image; status=proposed)
   7. Translate body → blueprint_review_locale (tenant's primary language)
   8. Persist editorial_variant with status='in_proofreading'
   9. Emit notification: "Blueprint ha preparato N contenuti"
              │
              ▼
[Tenant opens Proofreading Inbox]
   Sees: target version | explanation in IT | AI notes in IT | strategic motivation in IT
   Actions: APPROVA · CHIEDI MODIFICA · RIGENERA · PUBBLICA
              │
              ▼
[Pubblicazione]
   - status='approved' → calendar slot
   - status='published' → live + audit trail + content_revisions log
   - Update Editorial Calendar surface
   - Update Publishing Queue
```

---

## 5 · Data model · gap minimi (3 tabelle leggere)

### 5.1 · `tenant_editorial_settings` (NEW · 1 row per tenant)

```sql
CREATE TABLE tenant_editorial_settings (
  tenant_id              UUID PRIMARY KEY REFERENCES tenants(id),
  primary_locale         TEXT NOT NULL,                  -- es 'it-IT'
  proofreading_locale    TEXT,                            -- default = primary_locale
  autopilot_mode         TEXT NOT NULL DEFAULT 'review_only', -- 'autopilot'|'review_only'|'manual'
  tone_of_voice          JSONB,                           -- {brand, audience, vocabulary, forbidden}
  content_categories     JSONB,                           -- {seo:true, newsletter:true, linkedin:true, pinterest:true, instagram:true, case_study:true, landing_page:false}
  channels               JSONB,                           -- channel-specific config
  approval_rules         JSONB,                           -- {min_words:300, required_hotspots:true, require_media_library:true, require_brand_link:true}
  prioritized_brand_ids  UUID[],                          -- top brand_detected_entities
  prioritized_material_ids UUID[],
  prioritized_project_ids  UUID[],
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);
```

**Note**:
- `tenant_markets.custom_settings.weekly_frequency` (esistente!) → frequenza per mercato. Nessuna nuova colonna lì.
- `approval_rules.require_media_library=true` → enforces "no stock photo" rule.

### 5.2 · `editorial_autopilot_runs` (NEW · audit log scheduler)

```sql
CREATE TABLE editorial_autopilot_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  run_date        DATE NOT NULL,
  market_id       UUID REFERENCES markets(id),
  planned_count   INT NOT NULL DEFAULT 0,
  generated_count INT NOT NULL DEFAULT 0,
  blocked_count   INT NOT NULL DEFAULT 0,             -- media_required, etc.
  outcome         TEXT NOT NULL,                      -- 'success'|'partial'|'failed'|'blocked'
  variant_ids     UUID[],                             -- created editorial_variants
  error_log       JSONB,
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  finished_at     TIMESTAMPTZ
);
CREATE INDEX ON editorial_autopilot_runs (tenant_id, run_date);
```

### 5.3 · `editorial_variant_media` (NEW · enforce media library link)

```sql
CREATE TABLE editorial_variant_media (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id       UUID NOT NULL REFERENCES editorial_variants(id) ON DELETE CASCADE,
  media_library_id UUID NOT NULL REFERENCES media_library(id),  -- enforces source of truth
  block_id         TEXT,                                          -- which body block
  role             TEXT NOT NULL,                                 -- 'hero'|'inline'|'social'|'newsletter'
  position         INT DEFAULT 0,
  approved         BOOLEAN DEFAULT FALSE,
  approved_by      UUID,
  approved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
```

**Rule**: Blueprint AI **non può pubblicare** un `editorial_variant` se non c'è almeno 1 riga `editorial_variant_media` con `role='hero'` e l'image_url di tutti i blocchi `{type:image}` deve risolvere a un `media_library.id` del tenant. Check eseguito sia at-write che at-publish.

**Existing `article_hotspots.linked_asset_id`** già punta a `media_library.id` → hotspot system già allineato al pattern.

---

## 6 · Architettura del worker · Autopilot Scheduler

### 6.1 · Tech stack

- **Cron**: `cron`/`celery-beat` (oppure semplice `APScheduler` in FastAPI). Daily 03:00 UTC.
- **Job**: `services/editorial_autopilot.py` (NEW · ~300 righe)
- **LLM**: emergent_llm_key · Gemini 3 Flash per generazione massiva, Claude Sonnet 4.5 per fine-tuning culturale dei mercati premium (es. UK heritage tone).

### 6.2 · Pseudocode

```python
def autopilot_daily_run():
    for tenant in tenants_with(autopilot_mode != 'manual'):
        settings = get_tenant_editorial_settings(tenant.id)
        if settings.autopilot_mode == 'manual':
            continue
        for market in tenant.tenant_markets.active:
            want = market.custom_settings.weekly_frequency or 0
            have = count_variants_last_7d(tenant.id, market.id)
            gap = max(0, want - have)
            for _ in range(gap):
                generate_one_variant(tenant, market, settings)

def generate_one_variant(tenant, market, settings):
    # 1. Pick a source pillar
    source = pick_source(tenant.id, settings.prioritized_*)  # brand/material/project rotation
    # 2. Ensure editorial_master exists (create if needed)
    master = get_or_create_master(source)
    # 3. Resolve locale_profile for cultural angle
    locale_prof = resolve_locale_profile(market.target_locale)
    # 4. Generate variant via LLM
    variant_payload = llm_generate_variant(
        master=master,
        locale_profile=locale_prof,
        tone=settings.tone_of_voice,
        forbidden=locale_prof.forbidden_patterns
    )
    # 5. Select media from media_library
    media = pick_media(tenant.id, source, role='hero')
    if not media:
        save_variant(status='media_required', error='no_authorized_media')
        return
    # 6. AI hotspot suggestions
    hotspots = llm_suggest_hotspots(media, source)
    save_variant(
        master_id=master.id, market_id=market.id,
        target_locale=market.target_locale,
        blueprint_review_locale=settings.proofreading_locale,
        title=variant_payload.title,
        body_blocks=variant_payload.body_blocks,
        internal_translation=variant_payload.explanation_in_tenant_language,
        hotspot_data={'proposed': hotspots},
        ai_meta={'sources': [source.id], 'llm_model':..., 'cultural_angle': locale_prof.editorial_tone},
        status='in_proofreading'
    )
    create_editorial_variant_media(variant.id, media.id, role='hero')
```

### 6.3 · Failure modes & retry

- `media_required` → blocking, requires tenant action (no retry)
- `llm_timeout` → retry × 3 with exponential backoff
- `quota_exceeded` → notify tenant: "Upgrade your Universal Key balance"
- `forbidden_pattern_detected` → regenerate with stricter system_brief

---

## 7 · UI · Proofreading Inbox™ (NEW frontend page)

Route: `/blueprint/editorial/inbox` (visibile a showroom)
Replaces: today's `/blueprint/editorial/variants/:id/edit` (admin-only)

### 7.1 · Layout (Linear/Notion-inspired)

```
┌──────────────────────────────────────────────────────────────┐
│  PROOFREADING INBOX                              7 in attesa │
├──────────────────────────────────────────────────────────────┤
│  ┌─ LIST (320px) ─────┐  ┌─ DETAIL ───────────────────────┐ │
│  │ ● Marmo Calacatta · │  │ HERO IMAGE (from Media Library)│ │
│  │   Lifestyle USA     │  │                                │ │
│  │   2h fa             │  │ TARGET (English US):           │ │
│  │ ───────────────────│  │ "Calacatta Marble: a designer's│ │
│  │ ● Cucina Luxury · │  │  durability statement..."      │ │
│  │   Art de Vivre FR   │  │                                │ │
│  │   ieri              │  │ ── SPIEGAZIONE IN ITALIANO ── │ │
│  │ ───────────────────│  │ "Questo articolo è scritto    │ │
│  │ ⚠️ Heritage UK ·   │  │  per il mercato USA. Il taglio │ │
│  │   MEDIA REQUIRED   │  │  è lifestyle + designer        │ │
│  │   ieri              │  │  collaboration..."             │ │
│  │                     │  │                                │ │
│  │                     │  │ NOTE AI:                      │ │
│  │                     │  │ - Tone: confident, residential │ │
│  │                     │  │ - SEO target: 'kitchen marble' │ │
│  │                     │  │ - Source: Material Board #134  │ │
│  │                     │  │ - Hotspot proposti: 4         │ │
│  │                     │  │                                │ │
│  │                     │  │ MOTIVAZIONE STRATEGICA:       │ │
│  │                     │  │ "Mercato USA premia durability │ │
│  │                     │  │  + residential value. Il copy  │ │
│  │                     │  │  enfatizza questi punti..."    │ │
│  │                     │  │                                │ │
│  │                     │  │ ── Hotspots proposti ────────  │ │
│  │                     │  │  ⊕ Noce Canaletto              │ │
│  │                     │  │  ⊕ Dettaglio materiale         │ │
│  │                     │  │  ⊕ Brand: Cesar Cucine         │ │
│  │                     │  │                                │ │
│  │                     │  │ ┌─────────────────────────────┐│ │
│  │                     │  │ │ [APPROVA] [CHIEDI MODIFICA] ││ │
│  │                     │  │ │ [RIGENERA]    [PUBBLICA]    ││ │
│  │                     │  │ └─────────────────────────────┘│ │
│  │                     │  └────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 · Componenti

- `ProofreadingInboxPage.jsx` (NEW · ~250 righe)
- `ProofreadingDetail.jsx` (NEW · ~300 righe)
- `HotspotOverlay.jsx` (NEW · ~150 righe) · renders proposed hotspots on hero image, click to approve/edit
- `MediaRequiredBanner.jsx` (NEW · ~50 righe) · prompts to select images when blocked
- Riusa `MediaPickerModal.jsx` (esistente)

### 7.3 · API endpoints (NEW)

```
GET   /api/editorial/inbox                              → list of variants in_proofreading
GET   /api/editorial/inbox/:variant_id                  → detail with hotspot suggestions
POST  /api/editorial/inbox/:variant_id/approve          → status='approved'
POST  /api/editorial/inbox/:variant_id/request-changes  → body: {notes} → status='changes_requested', notifies AI to regenerate
POST  /api/editorial/inbox/:variant_id/regenerate       → triggers LLM regen (full or block-level)
POST  /api/editorial/inbox/:variant_id/publish          → status='published', publish_at=NOW, emit calendar event
POST  /api/editorial/inbox/:variant_id/media/select     → set hero media from media_library
POST  /api/editorial/inbox/:variant_id/hotspots/:hid/approve  → approve a proposed hotspot
GET   /api/editorial/autopilot/dashboard                → counts per market + per status (for the entry screen)
```

Tutti questi endpoint **wrappano la logica già esistente in `editorial_variants.py`** — solo restringono il payload per nascondere i campi tecnici.

---

## 8 · Calendario editoriale automatico

Riusa `/blueprint/editorial-calendar` esistente (route già montata in STORE-001 sidebar Growth).

### 8.1 · Cosa cambia

- **Auto-fill**: ogni variant con `status='approved'` o `'published'` produce un evento calendar automatico (oggi richiede manual scheduling).
- **Visual layout**: month/week view con dots colorati per mercato (USA blu · FR rosa · UK verde · IT amber).
- **Slot suggestion**: AI suggerisce migliore giorno/ora di pubblicazione basandosi su `market_behavior_events` (engagement orari per locale).
- **Drag & drop**: tenant può spostare uno slot (PATCH `editorial_variants.scheduled_at`).

### 8.2 · Endpoint

`GET /api/editorial/calendar?from=2026-06-08&to=2026-07-15&markets=us-us,fr-fr,uk-en`

Ritorna eventi raggruppati per giorno, includendo: variant_id, market, channel, status, suggested_slot_score.

### 8.3 · NEW endpoint per smart-scheduling

`POST /api/editorial/calendar/suggest-slot { variant_id }` → ritorna `{date, time, confidence_score}` basato su market_behavior_events.

---

## 9 · Publishing Queue semplificata

Route: `/blueprint/editorial/queue` (visibile a showroom).

Sostituisce le `editorial_variants` list page tecniche con:

```
┌──────────────────────────────────────────────────────────────┐
│  PUBLISHING QUEUE                                            │
│                                                              │
│  PRONTI PER PUBBLICAZIONE         3                          │
│  ──────────────────────────                                  │
│  ● "Calacatta Lifestyle"   USA   LinkedIn  Domani 09:00 [▷] │
│  ● "Art de Vivre Cucina"   FR    Pinterest Mar 14:30   [▷] │
│  ● "Heritage Craftsmanship" UK   Newsletter Gio 07:00  [▷] │
│                                                              │
│  IN PROOFREADING (clicca per rivedere)            7          │
│  PROGRAMMATI (futuri)                            12          │
│  PUBBLICATI (storico ultimi 30g)                 42          │
└──────────────────────────────────────────────────────────────┘
```

Endpoint: `GET /api/editorial/queue?status=ready_to_publish|in_proofreading|scheduled|published&days=30`

Riusa `editorial_variants` esistenti, solo filtra/raggruppa diversamente.

---

## 10 · Media Library · regola "No Unauthorized Media"

### 10.1 · Categorie obbligatorie (config nel setup tenant)

- `magazine_content` — immagini per articoli editoriali
- `social_content` — immagini per LinkedIn/Instagram/Pinterest
- `newsletter_content` — immagini per newsletter
- `case_study_content` — immagini per Project Story / case study
- `hero_images` — immagini hero per landing page

(Sono valori `media_library.category` text · 0 migration, già supportato).

Le `media_collections` permettono raggruppamenti per mercato, brand, materiale, progetto.

### 10.2 · Setup service workflow (manuale, parte del valore commerciale MOOD)

Durante l'onboarding del tenant, team MOOD / advisor:
1. Carica immagini autorizzate via `POST /api/media-library/upload` (esistente)
2. Imposta categoria + tags + market tags
3. Collega a brand/material/project via `media_links` (esistente)
4. Definisce hero/social/magazine/newsletter via `media_library.category`

Risultato: ogni tenant ha un **patrimonio editoriale autorizzato** prima del primo run Autopilot.

### 10.3 · Enforcement Blueprint AI

```python
def pick_media(tenant_id, source, role):
    """Strict picker · ZERO stock photos · ZERO external URLs."""
    return query(
        media_library,
        tenant_id=tenant_id,
        category__in=ROLE_TO_CATEGORIES[role],
        archived_at__isnull=True,
        is_inspiration=False,                          # exclude private inspirations
        source_kind__in=('upload', 'curated', 'brand_authorized')  # NEVER 'stock', 'scraped', 'unverified'
    ).order_by_relevance_to(source).first()

# If returns None → variant.status='media_required'
```

Settings: `approval_rules.require_media_library=true` (default TRUE).

### 10.4 · Audit trail

Ogni asset usato in un variant viene tracciato via `editorial_variant_media` + `media_asset_usage` (esistente). Un'agenzia o un brand può chiedere "dove è usata questa immagine?" e ottenere lista variant + dates + markets.

---

## 11 · Hotspot System · piano operativo

### 11.1 · Riuso totale di `article_hotspots`

La tabella esiste già con tutti i campi che servono:
- Posizione (`x_pct`, `y_pct`)
- Locale content JSONB (titolo + testo per locale)
- 5 tipi di link: `linked_material_id`, `linked_asset_id`, `linked_article_id`, `linked_project_id`, `linked_collection_id`
- `cta_action`, `sort_order`, `visible`

### 11.2 · Estensioni minime (no migration distruttiva)

`hotspot_locale_variants` (esistente) già supporta translation locale per locale.

**Aggiunte tramite `locale_content` JSONB** (no schema changes):
```json
{
  "en-US": {
    "title": "Calacatta marble",
    "body": "Natural durability for residential designs",
    "media_id": "uuid",     // optional photo or video
    "external_url": "...",  // optional external link
    "status": "proposed"    // proposed | approved | rejected
  },
  "it-IT": { ... }
}
```

### 11.3 · 5 tipi di hotspot del brief → mapping

| Tipo brief | Implementation |
|------------|----------------|
| 1. Titolo + testo | `locale_content[locale] = {title, body}` |
| 2. Titolo + testo + foto | `locale_content[locale] = {title, body, media_id}` (media_id ∈ media_library) |
| 3. Titolo + testo + video | `locale_content[locale] = {title, body, media_id}` (media_id con file_type=video) |
| 4. Link interno | `linked_material_id` / `linked_asset_id` / `linked_article_id` / `linked_project_id` / `linked_collection_id` |
| 5. Link esterno | `locale_content[locale].external_url` + `cta_action='external_link'` |

### 11.4 · AI hotspot suggestion flow

```python
def llm_suggest_hotspots(media_asset, source_pillar):
    """
    Input: hero image + source (brand/material/project)
    Output: 3-5 proposed hotspots with x/y/title/body/link suggestion
    """
    prompt = f"""
    Analizza questa immagine: {media_asset.alt_text}, {media_asset.cultural_reading}.
    Source pillar: {source_pillar.summary}.
    Proponi 3-5 hotspot rilevanti per il mercato {market.code}.
    Per ogni hotspot dai: {x_pct, y_pct, title, body, suggested_link_type}.
    """
    return gemini_3_flash(prompt).parse_hotspots()
```

Status: `proposed`. Nessun hotspot va live senza `tenant_admin` approval via `POST /api/editorial/inbox/:vid/hotspots/:hid/approve`.

---

## 12 · UI proofreading · dettaglio Blueprint Chameleon

### 12.1 · Wireframe (vedi §7)

Stile Linear/Notion/Apple Business · dark · serif solo titoli · sans Inter ad alto contrasto.

### 12.2 · Token visivi

- Stato chip: `IN_PROOFREADING` (amber dot) · `APPROVED` (cyan) · `PUBLISHED` (white) · `MEDIA_REQUIRED` (orange warning)
- Mercato chip: bandiera ASCII (🇺🇸 🇫🇷 🇬🇧) + locale code
- Diff badge: "AI rewrote 3 paragraphs since last review" (link al revision history via `content_revisions` esistente)

### 12.3 · Animazioni

- Hotspot hover · pulse glow (cyan)
- Approve button click · check icon morph + slide-out card
- Media required state · subtle red border pulse

---

## 13 · Sprint MVP plan per go-live

### Sprint 1 · "Autopilot Dashboard + Settings" (5 giorni)

**Goal**: showroom apre `/blueprint/editorial` e vede una landing che ha senso.

- ⬛ Migration 137: `tenant_editorial_settings` table
- ⬛ Migration 138: `editorial_autopilot_runs` table
- ⬛ Migration 139: `editorial_variant_media` table
- ⬛ Backend: `routers/editorial_autopilot.py` (GET /dashboard, GET /settings, PUT /settings)
- ⬛ Frontend: replace EditorialStudioPage hero with EditorialAutopilotPage (counts per market + per status)
- ⬛ Frontend: Settings page (Autopilot mode toggle, primary locale, tone preset)
- ✅ Testing: backend tests + screenshot E2E

### Sprint 2 · "Autopilot Scheduler Worker" (5 giorni)

**Goal**: scheduler genera autonomamente variant per il mercato MOOD (italiano · 1 contenuto/settimana).

- ⬛ Service: `services/editorial_autopilot.py` (planner + generator)
- ⬛ APScheduler integration in FastAPI startup (daily 03:00 UTC)
- ⬛ LLM wiring: emergent_llm_key Gemini 3 Flash + Claude Sonnet 4.5
- ⬛ Media picker: `services/media_picker.py` with strict source-of-truth
- ⬛ AI hotspot suggestion (`services/hotspot_suggester.py`)
- ⬛ Persistence flow: master → variant → variant_media → hotspots
- ⬛ Manual trigger endpoint `POST /api/editorial/autopilot/run-now` (admin only)
- ⬛ Testing: dry-run su tenant MOOD (mercato USA, FR, UK), verifica `editorial_autopilot_runs` log

### Sprint 3 · "Proofreading Inbox + Approval Flow" (5 giorni)

**Goal**: tenant può approvare/chiedere modifica/rigenerare/pubblicare.

- ⬛ `ProofreadingInboxPage.jsx` (list + detail)
- ⬛ `HotspotOverlay.jsx` con drag/edit/approve
- ⬛ `MediaRequiredBanner.jsx` con picker modal
- ⬛ 6 endpoint REST (`/inbox/*`)
- ⬛ Diff view (target ↔ internal_translation)
- ⬛ Audit trail (content_revisions esistente)
- ⬛ Testing: full E2E (autopilot run → 1 variant in_proofreading → approve → published)

### Sprint 4 · "Publishing Queue + Calendar" (4 giorni)

**Goal**: showroom vede pipeline di pubblicazione visiva.

- ⬛ PublishingQueuePage (lista raggruppata per status)
- ⬛ EditorialCalendar refactor (auto-fill + slot suggestion)
- ⬛ Notifiche in-app: "Blueprint ha preparato 3 contenuti"
- ⬛ Email digest settimanale (Resend integration)
- ⬛ Testing: 2 cicli completi su tenant MOOD

### Sprint 5 · "Media Library Setup Service + Hotspot AI" (4 giorni)

**Goal**: setup workflow per nuovo tenant + hotspot suggestion live.

- ⬛ Media Library category management UI (con `magazine_content`, `social_content`, etc.)
- ⬛ Bulk-tag tools
- ⬛ "Link asset to brand/material/project" UI
- ⬛ AI hotspot suggestion live integration
- ⬛ Approval workflow per hotspot
- ⬛ Testing: setup completo su tenant demo · 50 asset · 3 mercati

**Total**: ~23 giorni · ~5 settimane · 1 sviluppatore senior. Compatibile con timeline aggressiva grazie al massivo riuso di infrastruttura esistente.

---

## 14 · Vincoli rispettati

| Brief constraint | Implementazione |
|------------------|-----------------|
| Non aspettare il tenant | Scheduler giornaliero · autonomous run |
| Nascondere strumenti tecnici (Editorial Master, Compose, etc.) | Tutti rimangono in `/admin/*` · ruolo `blueprint_admin` |
| Lingua proofreading = lingua tenant | `editorial_variants.blueprint_review_locale` (esistente!) + UI Proofreading Inbox |
| Frequenze configurabili per mercato | `tenant_markets.custom_settings.weekly_frequency` (esistente!) |
| 7 content types | Già in `editorial_variants.editorial_edition` + new `content_type` enum |
| Market Adaptation (non traduzione) | `locale_profiles` + `market_cultural_profiles` (esistenti!) |
| Media obbligatori dalla Media Library | `editorial_variant_media` table + strict picker |
| Hotspot 5 tipi | `article_hotspots` esistente con tutti i field richiesti |
| AI suggerisce hotspot · tenant approva | `hotspot.locale_content.{locale}.status='proposed'` → `'approved'` |
| 3 modalità: Autopilot / Review Only / Manual | `tenant_editorial_settings.autopilot_mode` |
| MEDIA REQUIRED state | `editorial_variants.status='media_required'` (nuovo enum value) |

---

## 15 · Rischi & mitigazioni

| Rischio | Mitigazione |
|---------|-------------|
| LLM costs out of control | Budget cap per tenant in `tenant_editorial_settings.approval_rules.monthly_llm_budget_eur` · cron stops generation if exceeded |
| Hallucinated brand facts | Strict source citation in `ai_meta.sources[]` · pre-publish guard checks all referenced entity_ids exist in tenant's Brand Atlas |
| Mercati culturalmente sensibili (es. DACH, MENA) | Start with locale_profiles iniziale solo per `en-US`, `fr-FR`, `en-GB`, `it-IT` · ramp up con feedback agency |
| Image rights tracking | `media_library.metadata_json.license` (esistente) · enforce ≠ NULL prima del primo Autopilot run |
| Showroom disabilita autopilot perché spaventato | Default `review_only` · zero rischio di pubblicazione non autorizzata · sempre human-in-the-loop |

---

## 16 · Messaggio commerciale (vendita del servizio)

> MOOD non ti dà solo AI.
> MOOD costruisce il tuo patrimonio editoriale autorizzato e lo trasforma automaticamente in contenuti internazionali pronti per LinkedIn, Pinterest, newsletter e SEO.
>
> Tu carichi le foto · noi facciamo il resto.
>
> Ogni settimana ricevi 5-15 contenuti pronti in italiano, già adattati culturalmente per i tuoi mercati target. Approva con un click. Pubblichiamo per te.

Questo è il vero deliverable: trasformare MOOD da SaaS a **servizio professionale assistito da AI**.

---

## 17 · Conclusione · next step decisionale

Il piano è completo. Per partire serve solo la sua scelta sullo scope:

a. **Full sprint plan** (5 sprint · ~5 settimane) → autonomous engine completo per go-live
b. **MVP solo Sprint 1+3** (10 giorni) → Autopilot Dashboard + Proofreading Inbox manuali (no scheduler · genera on-demand)
c. **Discovery sprint** (2 giorni) → solo migration 137-139 + endpoint settings · validare l'IA prima di costruire il resto

Default consigliato: **(b) MVP Sprint 1+3** per validare l'esperienza utente con tenant reale prima di investire nello scheduler autonomo.

---

> **Firma piano**: Main Agent · MOOD for DESIGN™ · 08 Jun 2026
> **Stato**: PLAN APPROVED PENDING USER · NESSUNA IMPLEMENTAZIONE
> **Riferimenti documenti**: `STORE_SUCCESS_PATH_AUDIT.md`, `STORE009_DESIGN_JOURNEY_REBUILD_REPORT.md`
