# MOOD for DESIGN™ — Studio Activation Flow v2
## Documento 02 · Technical Design (DB · API · Validations · Mapbox)

> ⚠️ **OVERRIDE DIRETTIVA LOCALE 2026-05-31** — Vedi `LOCALE_ARCHITECTURE_DIRECTIVE.md`
> Lo schema `active_languages` in §1.2 è **superseded** dalla versione canonical in `LOCALE_ARCHITECTURE_DIRECTIVE.md` §4.
> Aggiunte obbligatorie: `text_direction` (LTR/RTL), `is_default`, `fallback_locale`, region tag `xx-XX`.
> Il seed in §1.2 è **starter, non definitivo** — il Command Center governa attivazioni runtime.

> **Stato**: DESIGN ONLY — nessuna migration sarà eseguita finché l'incidente DB Supabase non sarà chiuso
> **Versione**: 2026-05-31
> **Vincolo**: tutte le tabelle qui descritte sono **ADDITIVE** — zero `ALTER TABLE` su tabelle esistenti, zero `DROP`, zero `DELETE`/`UPDATE` di dati esistenti

---

## 1. DB Schema — tabelle nuove (additive)

### 1.1 `countries`

```sql
-- Migration 026 (drafted, NOT executed)
CREATE TABLE IF NOT EXISTS countries (
  code            CHAR(2)       PRIMARY KEY,                  -- ISO-3166-1 alpha-2 (IT, FR, US…)
  alpha3          CHAR(3)       NOT NULL UNIQUE,              -- ISO-3166-1 alpha-3 (ITA, FRA, USA…)
  numeric_code    SMALLINT      NOT NULL UNIQUE,              -- 380, 250, 840…
  english_name    TEXT          NOT NULL,                     -- "Italy", "France"
  native_names    JSONB         NOT NULL DEFAULT '{}'::jsonb, -- {"it":"Italia","fr":"Italie",...}
  flag_emoji      TEXT          NOT NULL,                     -- "🇮🇹"
  dial_code       TEXT          NOT NULL,                     -- "+39"
  region          TEXT          NOT NULL,                     -- "EU", "NA", "APAC", "MENA", "LATAM", "AF"
  subregion       TEXT,                                       -- "Southern Europe"
  capital         TEXT,
  currency_code   CHAR(3),                                    -- "EUR", "USD"
  is_enabled      BOOLEAN       NOT NULL DEFAULT true,        -- can be hidden without delete
  sort_order      INTEGER       NOT NULL DEFAULT 1000,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_countries_region ON countries(region) WHERE is_enabled = true;
CREATE INDEX idx_countries_sort   ON countries(sort_order, english_name) WHERE is_enabled = true;
```

**Seed**: ~250 nazioni (ISO standard). Source dataset proposto:
- Base: ISO-3166 + REST Countries API (snapshot import)
- Native names per IT/EN/FR/DE/ES da i18n-iso-countries (npm) o seed manuale curato
- Idempotent: `INSERT … ON CONFLICT (code) DO UPDATE`

---

### 1.2 `active_languages`

> ⚠️ **SUPERSEDED** — lo schema canonical definitivo è in `LOCALE_ARCHITECTURE_DIRECTIVE.md` §4 (include `text_direction`, `is_default`, `fallback_locale`, region tag `xx-XX` obbligatorio, max 1 default attivo).
> Il seed iniziale al MVP è ridotto a `it-IT` + `en-US` enabled; tutte le altre locale (`fr-FR`, `de-DE`, `es-ES`, `es-MX`, `pt-BR`, `ar-AE`, `zh-CN`, `ja-JP`, …) sono **pre-registrate disabilitate** e attivabili runtime dal Command Center senza release.
> Nessuna lista hardcoded di locale è ammessa nel codice o nei documenti.

Vedi `LOCALE_ARCHITECTURE_DIRECTIVE.md` §4 per lo schema completo e §4.1 per il seed.

---

### 1.3 `reserved_subdomains`

```sql
CREATE TABLE IF NOT EXISTS reserved_subdomains (
  slug            VARCHAR(63)   PRIMARY KEY,
  reason          TEXT          NOT NULL,                     -- 'system_route', 'brand', 'legal', 'security'
  scope           TEXT          NOT NULL DEFAULT 'global',    -- 'global', 'future', 'tier_specific'
  notes           TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_reserved_subdomains_reason ON reserved_subdomains(reason);
```

**Seed** (vedi `00_OVERVIEW_AND_UX.md` §3.5 per la lista completa): ~80 slug iniziali, raggruppati per `reason`:
- `system_route` (~40): admin, api, app, blueprint, studio, command-center…
- `auth_route` (~10): login, signin, signup, password, account…
- `infra` (~15): cdn, assets, static, media, mail, billing…
- `legal_brand` (~10): mood, mood-core, legal, privacy, terms…
- `security` (~5): noreply, postmaster, webmaster, abuse…

**Estendibilità**: Command Center → `/command-center/reserved-subdomains` per aggiungere a runtime (P2 backlog).

---

### 1.4 `studio_requests_v2`

Decisione architetturale: **NUOVA tabella** (non extend di `studio_requests` v1) per:
- Migration cleanly atomica
- Schema indipendente
- Convivenza temporanea v1+v2 durante cutover

```sql
CREATE TABLE IF NOT EXISTS studio_requests_v2 (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  reference             VARCHAR(20)   NOT NULL UNIQUE,         -- "MOOD-A3F7-9D21"
  status                VARCHAR(32)   NOT NULL DEFAULT 'pending_review',
    -- enum: pending_review | reviewing | approved | rejected | needs_info | duplicate

  -- M1
  studio_type           VARCHAR(64)   NOT NULL,
    -- enum: interior_design_studio | architecture_studio | multibrand_showroom |
    --       retail_design | stone_surface_specialist | contract_hospitality |
    --       furniture_brand | material_brand

  -- M2
  country_code          CHAR(2)       NOT NULL REFERENCES countries(code),
  city                  TEXT          NOT NULL,
  city_lat              NUMERIC(9,6),
  city_lng              NUMERIC(9,6),
  city_mapbox_id        TEXT,
  region_admin1         TEXT,
  mapbox_fallback       BOOLEAN       NOT NULL DEFAULT false,
  languages             TEXT[]        NOT NULL,                 -- BCP-47 codes, length 1..6

  -- M3
  primary_goals         TEXT[]        NOT NULL,                 -- length 1..4

  -- M4
  founder_first_name    TEXT          NOT NULL,
  founder_last_name     TEXT          NOT NULL,
  founder_role_title    TEXT          NOT NULL,
  founder_email         TEXT          NOT NULL,
  founder_email_norm    TEXT          NOT NULL,                 -- lowercase, trimmed (uniqueness key)
  founder_phone_prefix  TEXT          NOT NULL,
  founder_phone_number  TEXT          NOT NULL,
  founder_phone_e164    TEXT          NOT NULL,
  email_check_status    VARCHAR(16)   NOT NULL DEFAULT 'ok',    -- ok | deferred | duplicate_at_submit

  -- M5
  studio_name           TEXT          NOT NULL,
  subdomain_slug        VARCHAR(63)   NOT NULL,
  subdomain_status      VARCHAR(16)   NOT NULL DEFAULT 'requested',
    -- enum: requested | reserved_lock | available_at_submit

  -- Scoring (cfr. 03_SCORE_…)
  qualification_score   INTEGER,                                -- 0..100, computed at submit
  qualification_tier    VARCHAR(8),                             -- HOT | WARM | COLD | OBSERVE
  scoring_breakdown     JSONB         NOT NULL DEFAULT '{}'::jsonb,
  scoring_version       VARCHAR(16),                            -- "v1.0.0"

  -- Locale used at submit (for advisor context)
  submission_locale     VARCHAR(10)   NOT NULL DEFAULT 'it',

  -- Audit
  ip_address            INET,
  user_agent            TEXT,
  referrer              TEXT,
  draft_token           VARCHAR(64)   NOT NULL UNIQUE,
  submitted_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  reviewed_at           TIMESTAMPTZ,
  reviewed_by           UUID,                                   -- FK to users (NO constraint to evitare lock cross-table)
  advisor_assigned_to   UUID,
  advisor_notes         TEXT,
  rejection_reason      TEXT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_srv2_status         ON studio_requests_v2(status);
CREATE INDEX idx_srv2_email_norm     ON studio_requests_v2(founder_email_norm);
CREATE INDEX idx_srv2_subdomain      ON studio_requests_v2(subdomain_slug);
CREATE INDEX idx_srv2_country        ON studio_requests_v2(country_code);
CREATE INDEX idx_srv2_tier_score     ON studio_requests_v2(qualification_tier, qualification_score DESC) WHERE status = 'pending_review';
CREATE INDEX idx_srv2_advisor        ON studio_requests_v2(advisor_assigned_to) WHERE advisor_assigned_to IS NOT NULL;
CREATE INDEX idx_srv2_submitted_at   ON studio_requests_v2(submitted_at DESC);
```

**Eventi audit** (tabella già esistente o nuova `studio_request_v2_events`):
```sql
CREATE TABLE IF NOT EXISTS studio_request_v2_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id     UUID NOT NULL REFERENCES studio_requests_v2(id) ON DELETE CASCADE,
  event_type     VARCHAR(32) NOT NULL,
    -- submitted | viewed | assigned | status_changed | scored | contacted | approved | rejected | rescored
  actor_id       UUID,
  payload        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_srv2_events_req ON studio_request_v2_events(request_id, created_at DESC);
```

---

### 1.5 `studio_v2_drafts`

Draft separato dal v1 per evitare contaminazione schema.

```sql
CREATE TABLE IF NOT EXISTS studio_v2_drafts (
  draft_token    VARCHAR(64) PRIMARY KEY,
  payload        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    -- chiavi: studio_type, country_code, city, ..., founder_email_norm, ...
  current_movement VARCHAR(8) NOT NULL DEFAULT 'm1',  -- m1..m5 | submit
  founder_email_for_resume TEXT,                      -- opt-in recovery email
  locale         VARCHAR(10) NOT NULL DEFAULT 'it',
  ip_hash        TEXT,                                -- sha256(IP) per rate limit
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  submitted_at   TIMESTAMPTZ,
  CONSTRAINT chk_movement CHECK (current_movement IN ('m1','m2','m3','m4','m5','submit','done'))
);

CREATE INDEX idx_srv2drafts_email      ON studio_v2_drafts(founder_email_for_resume) WHERE submitted_at IS NULL;
CREATE INDEX idx_srv2drafts_expires    ON studio_v2_drafts(expires_at) WHERE submitted_at IS NULL;
CREATE INDEX idx_srv2drafts_iphash_day ON studio_v2_drafts(ip_hash, (created_at::date));
```

Cleanup job (cron daily): `DELETE FROM studio_v2_drafts WHERE submitted_at IS NULL AND expires_at < now()`. **NOTA**: questo è l'unico DELETE programmato; deve avere safeguard `EXECUTE_ONLY_ON_REPLICA=false` esplicito e logging.

---

### 1.6 `v_global_email_registry` (view — decision 4→a)

```sql
CREATE OR REPLACE VIEW v_global_email_registry AS
  SELECT lower(trim(email)) AS email_norm, 'users' AS source_table, id::text AS source_id
    FROM users
    WHERE email IS NOT NULL
  UNION ALL
  SELECT lower(trim(contact_email)), 'studio_requests', id::text
    FROM studio_requests
    WHERE contact_email IS NOT NULL
  UNION ALL
  SELECT lower(trim(founder_email)), 'studio_requests_v2', id::text
    FROM studio_requests_v2
    WHERE founder_email IS NOT NULL
      AND status NOT IN ('rejected', 'duplicate')
  UNION ALL
  SELECT lower(trim(email)), 'advisor_profiles', id::text
    FROM advisor_profiles
    WHERE email IS NOT NULL
  UNION ALL
  SELECT lower(trim(email)), 'advisor_leads', id::text
    FROM advisor_leads
    WHERE email IS NOT NULL;
```

**Performance check**: la view è semplicemente espansa nel planner. Per query `WHERE email_norm = 'x@y.it'`, gli indici sottostanti devono coprire:
- `users.email` → già `CREATE UNIQUE INDEX` su `lower(email)` (verificare)
- `studio_requests.contact_email` → indice presente
- `studio_requests_v2.founder_email_norm` → indice creato (1.4)
- `advisor_profiles.email` → da verificare nell'esistente
- `advisor_leads.email` → da verificare in migration 025

Se mancano indici functional `lower(email)`, l'implementazione li aggiungerà additive senza toccare i dati.

---

## 2. API Contracts

Tutti i nuovi endpoint vivono sotto `/api/studio/v2/...`. Non sovrascrivono nulla del v1.

### 2.1 `GET /api/studio/v2/manifest`

**Query**: `?locale=it` (default `it`, must be in `active_languages.code` enabled)

**Response 200**:
```json
{
  "version": "studio_v2_2026_05_31",
  "locale": "it",
  "copy": {
    "studio.activation.v2.landing.headline": "Candida il tuo studio a MOOD.",
    "studio.activation.v2.m1.title": "Categoria professionale",
    "...": "..."
  },
  "categories": [
    { "slug": "interior_design_studio", "image_url": "/cdn/studio-v2/m1/interior_design_studio.webp" },
    { "...": "..." }
  ],
  "goals": [
    { "slug": "new_leads", "icon": "user-plus" },
    { "...": "..." }
  ]
}
```

**Cache**: server-side 5 min; ETag + `Cache-Control: public, max-age=300, must-revalidate`

---

### 2.2 `GET /api/studio/v2/countries`

**Query**: `?locale=it`

**Response 200**:
```json
{
  "countries": [
    { "code": "IT", "name": "Italia", "english_name": "Italy", "flag": "🇮🇹", "dial_code": "+39", "region": "EU" },
    { "code": "FR", "name": "Francia", "english_name": "France", "flag": "🇫🇷", "dial_code": "+33", "region": "EU" }
  ]
}
```

Ordinato per `sort_order, english_name`. Filtra `is_enabled=true`. Cache 1 ora.

---

### 2.3 `GET /api/studio/v2/languages`

**Response 200**:
```json
{
  "languages": [
    { "code": "it",    "native_name": "Italiano",  "english_name": "Italian",      "flag": "🇮🇹" },
    { "code": "en-us", "native_name": "English",   "english_name": "English (US)", "flag": "🇺🇸" }
  ]
}
```

Filtra `is_enabled=true`. Cache 1 ora.

---

### 2.4 `POST /api/studio/v2/check-email`

**Body**:
```json
{ "email": "Marco@Studio.it" }
```

**Server behavior (anti-enumeration CRITICO)**:
1. Validate RFC 5322 — invalid → `{"available": false, "reason": "invalid_format"}` con jitter 200..400ms
2. Normalize: `lower(trim(email))`
3. Query: `SELECT 1 FROM v_global_email_registry WHERE email_norm = $1 LIMIT 1`
4. Add jitter: `await asyncio.sleep(uniform(0.20, 0.40))` SEMPRE (uniform timing)
5. Return:
```json
{ "available": true | false }
```
Nessun campo aggiuntivo. Nessun rate-limit reveal. Stessa shape, stesso timing.

**Rate limit**: 30 req/min per IP-hash (sliding window). Burst protection via `studio_v2_drafts.ip_hash`.

---

### 2.5 `POST /api/studio/v2/check-subdomain`

**Body**:
```json
{ "slug": "atelier-martinel" }
```

**Server behavior**:
1. Sync validate: `^[a-z0-9-]{3,30}$` + no leading/trailing `-` + no `--`
2. If invalid → `{"available": false, "reason": "invalid_format"}`
3. Check `reserved_subdomains` → if found: `{"available": false, "reason": "reserved"}`
4. Check `tenants.subdomain` → if found: `{"available": false, "reason": "taken"}`
5. Check `studio_requests_v2.subdomain_slug` WHERE status IN ('pending_review', 'reviewing', 'approved'): `{"available": false, "reason": "soft_locked"}`
6. Else: `{"available": true}`

**Suggerimenti opzionali** quando taken/soft_locked (UX): server può proporre `[slug-2, slug-studio, slug-design]` in array `"suggestions"`. Disattivabile via flag.

**Rate limit**: 60 req/min per IP-hash.

---

### 2.6 `POST /api/studio/v2/draft`

Create OR resume.

**Body** (create):
```json
{}
```

**Body** (resume):
```json
{ "draft_token": "abc123..." }
```

**Response 200 (new)**:
```json
{
  "draft_token": "xyz789...",
  "current_movement": "m1",
  "payload": {},
  "expires_at": "2026-06-30T00:00:00Z"
}
```

**Response 200 (resume)**:
```json
{
  "draft_token": "xyz789...",
  "current_movement": "m3",
  "payload": {
    "studio_type": "interior_design_studio",
    "country_code": "IT",
    "city": "Milano",
    "city_lat": 45.4642,
    "city_lng": 9.19,
    "languages": ["it", "en-us"]
  },
  "resumed": true,
  "expires_at": "2026-06-30T00:00:00Z"
}
```

If `draft_token` not found or expired → returns NEW draft.

---

### 2.7 `PATCH /api/studio/v2/draft`

Per-movement save (incremental).

**Body**:
```json
{
  "draft_token": "xyz789...",
  "movement": "m2",
  "patch": {
    "country_code": "IT",
    "city": "Milano",
    "city_lat": 45.4642,
    "city_lng": 9.19,
    "city_mapbox_id": "place.123",
    "languages": ["it", "en-us"]
  }
}
```

**Validation**: server applica le regole del movimento corrispondente (vedi §3). Invalid → `400` con error map per field. Movimenti precedenti vengono rivalidati silenziosamente (se diventano invalid per qualche ragione di consistency, vengono marked nel response ma il save procede).

**Response 200**:
```json
{
  "ok": true,
  "current_movement": "m2",
  "payload": { /* full updated payload */ },
  "validation_warnings": []
}
```

---

### 2.8 `POST /api/studio/v2/submit`

**Body**:
```json
{
  "draft_token": "xyz789...",
  "confirm_terms": true,
  "submission_locale": "it"
}
```

**Server behavior**:
1. Load draft. If `submitted_at IS NOT NULL` → `409 already_submitted` with previous `reference`
2. Re-validate **all** movements server-side (defense in depth)
3. Re-check email uniqueness in transaction (race-safe via `SELECT … FOR SHARE` semantics + retry on conflict)
4. Re-check subdomain availability (same)
5. Generate `reference` = `MOOD-XXXX-XXXX` (8 hex chars + dash)
6. Compute `qualification_score`, `qualification_tier`, `scoring_breakdown` (vedi `03_…` §1)
7. INSERT into `studio_requests_v2`
8. INSERT `studio_request_v2_events` (`event_type='submitted'`)
9. Mark draft `submitted_at = now()`
10. Enqueue Resend email (founder ack + advisor notify) — async fire-and-forget
11. Return:
```json
{
  "ok": true,
  "reference": "MOOD-A3F7-9D21",
  "request_id": "uuid",
  "submitted_at": "2026-05-31T22:14:00Z",
  "tier": "WARM"
}
```

**Error cases**:
- `400 validation_failed` con error map field-by-field
- `409 email_taken` (race)
- `409 subdomain_taken` (race)
- `429 rate_limited`
- `500 internal_error` (transactional rollback)

---

### 2.9 Admin endpoints (Command Center)

Mounted under `/api/admin/studio-requests-v2/...`. Require `super_admin` or `advisor` role.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/studio-requests-v2` | List with filters: status, tier, country, advisor_id, q (search) |
| `GET` | `/api/admin/studio-requests-v2/:id` | Detail |
| `PATCH` | `/api/admin/studio-requests-v2/:id` | Update status, notes, assigned_advisor |
| `POST` | `/api/admin/studio-requests-v2/:id/score/recompute` | Re-run scoring with current weights |
| `POST` | `/api/admin/studio-requests-v2/:id/events` | Append audit event manually |
| `GET` | `/api/admin/studio-requests-v2/:id/timeline` | Aggregated events history |

Tutti i mutational endpoint creano automaticamente eventi in `studio_request_v2_events`.

---

## 3. Validation Rules

### 3.1 Frontend (Zod schemas)

```typescript
// Pseudocode — to be implemented with Zod
const movement1 = z.object({
  studio_type: z.enum([
    'interior_design_studio', 'architecture_studio', 'multibrand_showroom',
    'retail_design', 'stone_surface_specialist', 'contract_hospitality',
    'furniture_brand', 'material_brand'
  ])
});

const movement2 = z.object({
  country_code: z.string().length(2).regex(/^[A-Z]{2}$/),
  city: z.string().min(2).max(120),
  city_lat: z.number().min(-90).max(90).optional(),
  city_lng: z.number().min(-180).max(180).optional(),
  city_mapbox_id: z.string().optional(),
  mapbox_fallback: z.boolean().default(false),
  languages: z.array(z.string()).min(1).max(6)
});

const movement3 = z.object({
  primary_goals: z.array(z.enum([
    'new_leads', 'relationship_mgmt', 'materials_suppliers',
    'project_presentation', 'team_coordination', 'digital_ecosystem'
  ])).min(1).max(4)
});

const movement4 = z.object({
  first_name: z.string().min(2).max(60).regex(/^[\p{L}\s'-]+$/u),
  last_name:  z.string().min(2).max(60).regex(/^[\p{L}\s'-]+$/u),
  role_title: z.string().min(2).max(80),
  email:      z.string().email().max(180),
  phone_prefix: z.string().regex(/^\+\d{1,4}$/),
  phone_number: z.string().regex(/^\d{6,15}$/)
});

const movement5 = z.object({
  studio_name: z.string().min(2).max(120),
  subdomain_slug: z.string()
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/)
    .refine(s => !s.includes('--'), 'no consecutive hyphens')
});

const fullSchema = movement1
  .merge(movement2)
  .merge(movement3)
  .merge(movement4)
  .merge(movement5);
```

### 3.2 Backend (Pydantic v2)

```python
# Pseudocode — to be implemented
class Movement2(BaseModel):
    country_code: constr(regex=r'^[A-Z]{2}$')
    city: constr(min_length=2, max_length=120)
    city_lat: Optional[Decimal] = Field(None, ge=-90, le=90)
    city_lng: Optional[Decimal] = Field(None, ge=-180, le=180)
    city_mapbox_id: Optional[str] = None
    mapbox_fallback: bool = False
    languages: conlist(str, min_length=1, max_length=6)

    @field_validator('country_code')
    @classmethod
    def check_country_exists(cls, v):
        # query countries WHERE code = v AND is_enabled = true
        ...

    @field_validator('languages')
    @classmethod
    def check_languages_active(cls, v):
        # query active_languages WHERE code = ANY(v) AND is_enabled = true
        # all must exist
        ...
```

### 3.3 Cross-field & domain rules

| Rule | Where | Action on fail |
|---|---|---|
| `phone_prefix` ∈ `countries.dial_code` | server only | 400 `phone_prefix_invalid` |
| `phone_e164` derivable | server only | 400 `phone_invalid` |
| `email` not in `v_global_email_registry` | server only | 409 `email_taken` |
| `subdomain_slug` not reserved + not taken | server only | 409 `subdomain_taken` |
| `city_lat/lng` required unless `mapbox_fallback` | server | 400 `city_geo_missing` |
| `languages` subset di `active_languages` enabled | server | 400 `languages_invalid` |
| `studio_type` ∈ enum | sync both sides | 400 `studio_type_invalid` |
| `primary_goals` length 1..4 + enum | both | 400 `goals_invalid` |

---

## 4. Mapbox Integration Spec

> **Nota**: l'integrazione formale sarà richiesta via `integration_playbook_expert_v2` in fase implementazione (decision 2→b). Qui solo il design preliminare.

### 4.1 Use case
- Solo **City autocomplete** in M2
- Niente mappa visuale (no Mapbox GL JS map)
- Niente reverse geocoding lato client

### 4.2 Stack proposto
| Layer | Choice |
|---|---|
| API | Mapbox Search Box API (`/search/searchbox/v1/suggest` + `/retrieve`) o Geocoding v6 |
| SDK | Nessuno → fetch diretto (no bundle bloat) |
| Token | **Public token (pk.*)** ristretto a `*.moodfordesign.com` + `*.preview.emergentagent.com` |
| Proxy | Optional: `GET /api/studio/v2/mapbox/suggest?q=&country=` per nascondere token + applicare rate limit lato server |

### 4.3 Endpoint Mapbox usato
```
GET https://api.mapbox.com/search/searchbox/v1/suggest?
  q=<text>
  &country=<ISO2>
  &types=place,locality
  &limit=5
  &language=<locale-prefix>
  &session_token=<uuid>
  &access_token=<pk>
```

Selezione → `GET /retrieve?session_token=…&id=<mapbox_id>` → ritorna `geometry.coordinates` + `properties.context`.

### 4.4 Token management
- Variabile env: `MAPBOX_PUBLIC_TOKEN` (frontend, exposed)
- Restrizione URL: configurata su Mapbox dashboard
- Free tier: 100k requests/mese — sufficiente con debounce 250ms

### 4.5 Fallback strategy
Se la richiesta Mapbox fallisce 2 volte consecutive o ritorna 0 suggerimenti dopo 1.5s:
- Switcha UI a `<input type="text" placeholder="Es. Milano, Italia">`
- Set `mapbox_fallback=true` su draft
- Advisor vedrà il flag in Command Center per follow-up manuale

---

## 5. Rate Limiting & Anti-abuse

### 5.1 Per-IP limits (sliding window)
| Endpoint | Limit |
|---|---|
| `POST /draft` (create) | 5 / 24h |
| `PATCH /draft` | 120 / 5min |
| `POST /check-email` | 30 / 1min |
| `POST /check-subdomain` | 60 / 1min |
| `POST /submit` | 3 / 1h |
| `POST /mapbox/suggest` (proxy) | 200 / 1min |

### 5.2 Implementation
- Tabella `rate_limit_buckets` (esistente o nuova) con `(key, window_start, count)`
- Key format: `studio_v2:<endpoint>:<ip_hash>`
- IP hash: `sha256(ip + daily_salt)` — privacy-friendly
- Header response: `X-RateLimit-Remaining`, `Retry-After`

### 5.3 Bot/crawler protection
- CAPTCHA (hCaptcha o Cloudflare Turnstile) **solo** se rate-limit triggered 2 volte in 24h dallo stesso IP
- Honeypot field invisibile in M4 (CSS hidden, se compilato → silenzioso `200 ok` ma `studio_request_v2_events` log `honeypot_triggered`)

---

## 6. Email Uniqueness — Anti-enumeration Deep Dive

### 6.1 Threat model
Un attaccante itera email note per scoprire chi è registrato. Mitigation obbligatorie:

| Vector | Mitigation |
|---|---|
| Timing oracle | Jitter uniforme 200..400ms su **tutte** le risposte di `check-email`, sia available che taken |
| Status code oracle | Stessa shape JSON, stesso HTTP 200, anche per email malformate |
| Verbose error oracle | Nessun campo `reason` dettagliato in production |
| Rate-limit reveal | Quando rate limit triggers, ritorna `{"available": true}` (intenzionalmente neutro) per non confermare/negare |
| Browser autofill leak | Server non logga email failed checks oltre 24h |
| Magic link enumeration | (esistente in v1) — già mitigato in `magic-link/request` |

### 6.2 Logging
- DB: nessuna log row per `check-email` (zero footprint)
- Stdout: solo aggregate (`email_check.count_5min=…`) — mai email plain text

---

## 7. Sicurezza generale

| Concern | Misura |
|---|---|
| CORS | Allow-list `*.moodfordesign.com` + preview origin; deny `*` |
| CSRF | `POST/PATCH/DELETE` richiedono `X-Studio-Draft-Token` header che matcha `draft_token` nel body (double-submit pattern) |
| SQL injection | Tutte le query via parametric `psycopg2` o SQLAlchemy text bind |
| XSS in user input | Tutto sanitized server-side prima di salvare; rendering React auto-escape; no `dangerouslySetInnerHTML` |
| PII at rest | `founder_email_norm` indicizzato in lowercase; PII full text in `studio_requests_v2` non encrypted (è dato fornito volontariamente, no GDPR Art.9) |
| PII in logs | Mai loggare `founder_email`, `founder_phone_number` in plain text. Solo `email_norm[:3] + '***@' + domain` |
| Subdomain takeover | `reserved_subdomains` + `tenants.subdomain` + status-locked period 14gg |

---

## 8. Cosa NON viene modificato

Per chiarezza assoluta — questo redesign **non tocca**:

- ❌ `users` table
- ❌ `studio_requests` v1 table (resta intatta per backward compatibility durante cutover)
- ❌ `studio_relations` table
- ❌ `access_magic_links` table
- ❌ `tenants` table (eccetto SELECT su `subdomain` per il check)
- ❌ `advisor_profiles`, `advisor_leads`, `advisor_activation_tokens`
- ❌ `site_blocks`, `block_localizations` (SOLO INSERT nuove rows per namespace `studio.activation.v2`)
- ❌ Esistenti endpoint `/api/studio/activation/*` v1
- ❌ Esistenti endpoint `/api/admin/studio/requests` v1

---

## 9. Sequenza di delivery proposta (a implementazione approvata)

1. **Phase A — DB foundation** (1 PR):
   - Migration 026: create `countries`, `active_languages`, `reserved_subdomains`
   - Seed countries (ISO-3166 import)
   - Seed active_languages (5 lingue)
   - Seed reserved_subdomains (~80 slug)
2. **Phase B — Backend stubs** (1 PR):
   - Migration 027: `studio_requests_v2`, `studio_v2_drafts`, `studio_request_v2_events`, `v_global_email_registry`
   - Router `/api/studio/v2/*` con tutti gli endpoint (no UI ancora)
   - Pydantic models + validators
   - Pytest unit tests
3. **Phase C — Copy seed** (1 PR):
   - Migration 028: INSERT site_blocks `studio.activation.v2.*` (~118 rows source IT)
   - INSERT block_localizations per EN/FR/DE/ES
4. **Phase D — Frontend redesign** (1+ PR):
   - Route `/studio/v2` dietro feature flag `STUDIO_FLOW_V2`
   - Componenti: `<MovementStudioType>`, `<MovementLocation>`, `<MovementGoals>`, `<MovementFounder>`, `<MovementIdentity>`, `<MovementSubmit>`
   - Hook: `useStudioV2Manifest`, `useStudioV2Draft`
   - Componenti base: `<CountrySelect>`, `<CityAutocomplete>`, `<LanguageMultiSelect>`, `<EmailFieldGlobalCheck>`, `<SubdomainField>`
5. **Phase E — Tenant Qualification Score** (1 PR):
   - Implementazione `services/studio_qualification_score.py`
   - Test fixtures e snapshot
6. **Phase F — Mapbox integration** (1 PR):
   - Playbook call → ottenere setup + token
   - Implementazione `<CityAutocomplete>` reale
7. **Phase G — Admin UX (Command Center)** (1+ PR):
   - Pagina `/command-center/studio-requests-v2` con filtri tier/score/country
   - Detail page con TQS breakdown visible
   - Re-score action
8. **Phase H — Cutover** (1 PR):
   - Feature flag `STUDIO_FLOW_V2=true`
   - Redirect `/studio` → `/studio/v2`
   - Deprecazione soft v1 (resta routable per 30gg)

---

— *fine documento 02* —
