# MOOD for DESIGN™ — Studio Activation Flow v2
## Documento 03 · Tenant Qualification Score™ · E2E Test Plan · Migration v1→v2

> **Stato**: DESIGN ONLY · in attesa di approvazione
> **Versione**: 2026-05-31

---

## 1. Tenant Qualification Score™ (TQS)

### 1.1 Purpose
Score numerico **0–100** calcolato automaticamente al submit di ogni `studio_requests_v2`, usato esclusivamente da **Advisor** e **Command Center** per:
- Prioritizzare la coda di review
- Routing automatico verso advisor specializzati (futuro)
- Analytics sulla qualità del traffico marketing

**NON è**:
- Una scoring di solvibilità (no credit check)
- Mostrato all'utente esterno
- Una decisione automatica di accept/reject (resta manuale)

### 1.2 Output schema

```json
{
  "qualification_score": 72,
  "qualification_tier": "WARM",
  "scoring_version": "v1.0.0",
  "scoring_breakdown": {
    "studio_type":           { "points": 18, "max": 20, "note": "interior_design_studio" },
    "geography":             { "points": 12, "max": 15, "note": "EU primary market" },
    "language_breadth":      { "points":  8, "max": 10, "note": "3 languages" },
    "goal_intent":           { "points": 14, "max": 20, "note": "ecosystem + leads" },
    "contact_quality":       { "points": 12, "max": 15, "note": "business domain, complete role" },
    "tenant_identity":       { "points":  8, "max": 10, "note": "clear studio_name + subdomain" },
    "behavioral":            { "points":  0, "max": 10, "note": "no flags" }
  },
  "computed_at": "2026-05-31T22:14:00Z"
}
```

### 1.3 Tier bands

| Score range | Tier | Color (Command Center) | SLA suggested advisor response |
|---|---|---|---|
| 80–100 | **HOT** | `#00C9B3` (teal) | < 24h |
| 60–79  | **WARM** | `#F5C44A` (amber) | < 48h |
| 40–59  | **COLD** | `#9AA0A6` (neutral) | < 5 business days |
| 0–39   | **OBSERVE** | `#7D6E83` (muted) | Batch review weekly |

### 1.4 Algorithm (deterministic, no ML)

```
total = Σ component_score
clamp 0..100
tier = band(total)
```

### 1.5 Component definitions

#### A · `studio_type` (max 20)
Mappa di pesi per categoria — modificabile via config table futura `tqs_weights`.

| `studio_type` | Points |
|---|---|
| `interior_design_studio` | 18 |
| `architecture_studio` | 18 |
| `multibrand_showroom` | 20 |
| `retail_design` | 14 |
| `stone_surface_specialist` | 16 |
| `contract_hospitality` | 18 |
| `furniture_brand` | 16 |
| `material_brand` | 16 |

**Rationale**: showroom multibrand è il segmento più allineato alla value proposition Material Intelligence™ + Moodboard Experience™.

#### B · `geography` (max 15)
- Primary markets (EU + NA + UK + UAE + JP + AU): **15 pts**
- Secondary markets (LATAM + Asia + IL + SG + ZA): **10 pts**
- Tertiary markets (rest): **6 pts**
- City unknown (mapbox_fallback=true): **−3 pts** (subtract from above)

| Region | Pts |
|---|---|
| EU member states | 15 |
| UK, NO, CH | 15 |
| US, CA | 15 |
| AE (UAE), QA, SA, KW, BH, OM | 14 |
| JP, KR, SG, HK, AU, NZ | 14 |
| IL | 13 |
| MX, BR, AR, CL, CO | 10 |
| TH, MY, ID, PH, VN | 10 |
| ZA | 10 |
| TR | 11 |
| RU, BY, UA | 6 |
| Altro | 6 |

#### C · `language_breadth` (max 10)
- 1 lingua: 4 pts
- 2 lingue: 7 pts
- 3 lingue: 9 pts
- 4+ lingue: 10 pts
- Bonus +1 se include lingua non locale (es. studio italiano che dichiara anche EN+FR): max comunque 10

#### D · `goal_intent` (max 20)
Pesi per `primary_goal` (somma poi capata a 20):

| Goal | Points |
|---|---|
| `digital_ecosystem` | 9 |
| `materials_suppliers` | 7 |
| `relationship_mgmt` | 6 |
| `project_presentation` | 6 |
| `team_coordination` | 4 |
| `new_leads` | 5 |

- Selezione di 1 goal: somma dei pesi
- Selezione di 4 goal: somma capata a 20
- Penalità: −2 pts se include solo `new_leads` (suggest meno deep intent)

#### E · `contact_quality` (max 15)
| Check | Pts |
|---|---|
| Email domain è custom (non gmail/hotmail/yahoo/outlook/icloud/protonmail/...) | +6 |
| Email domain ha record MX validi | +2 |
| `role_title` contiene keyword senior (founder, partner, director, head, principal, owner, CEO, manager) | +4 |
| `phone_e164` valido + parsable | +2 |
| `first_name` + `last_name` plausibili (no test/asdf/aaa) | +1 |

#### F · `tenant_identity` (max 10)
| Check | Pts |
|---|---|
| `studio_name` ≥ 4 char e contiene almeno 1 spazio o terminologia di mercato (atelier, studio, design, architects, lab) | +4 |
| `subdomain_slug` derivato cleanly da `studio_name` (similarity ≥ 0.7) | +3 |
| `subdomain_slug` available al primo tentativo (no race) | +3 |

#### G · `behavioral` (max 10)
Segnali raccolti durante il funnel:
| Signal | Pts |
|---|---|
| Tempo totale spent ≥ 90s (no bot rush) | +3 |
| Tempo totale spent ≤ 240s (no abbandono lungo) | +2 |
| Auto-save attivato (utente non ha chiuso e riaperto draft 3+ volte) | +2 |
| Email check passato al primo tentativo | +1 |
| Subdomain check passato al primo tentativo | +2 |
| Honeypot triggered | −10 (override → tier OBSERVE) |
| IP in tor exit list / known VPN abuse | −5 |

### 1.6 Recompute policy
- Calcolato al `submit` con `scoring_version = "v1.0.0"`
- Quando i pesi cambiano (`v1.1.0`, ecc.), **non** ricalcola automaticamente
- Admin può triggerare `POST /api/admin/studio-requests-v2/:id/score/recompute` per re-score (logged in events)
- Bulk recompute disponibile da CLI: `python -m backend.scripts.tqs_bulk_recompute --version=v1.1.0`

### 1.7 Visibilità Command Center
Su `/command-center/studio-requests-v2` mostra:
- Colonna **TQS** (numero + tier badge colorato)
- Filtro per tier
- Default sort: `tier ASC, score DESC, submitted_at DESC`
- Detail page: collapsible "Score breakdown" che mostra ogni componente, peso, note + bottone "Recompute"

### 1.8 Versioning
Tabella futura (P2):
```sql
CREATE TABLE IF NOT EXISTS tqs_versions (
  version       VARCHAR(16) PRIMARY KEY,
  weights       JSONB NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT false,
  activated_at  TIMESTAMPTZ,
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
Permette A/B test fra versioni di scoring senza ridistribuire codice.

### 1.9 Test snapshot
Lo scoring deve avere test deterministici con snapshot files (`backend/tests/snapshots/tqs/`). Esempio:

```python
def test_tqs_milan_interior_studio_full_ecosystem():
    payload = {
        "studio_type": "interior_design_studio",
        "country_code": "IT", "city": "Milano",
        "languages": ["it","en-us","fr"],
        "primary_goals": ["digital_ecosystem","materials_suppliers","relationship_mgmt"],
        "founder_email": "marco@studiomartinel.it",
        "founder_role_title": "Founder",
        "founder_phone_e164": "+393331234567",
        "studio_name": "Atelier Martinel",
        "subdomain_slug": "atelier-martinel",
        "behavioral": {"duration_s": 187, "honeypot": False, "first_try_email": True, "first_try_subdomain": True}
    }
    result = compute_tqs(payload, version="v1.0.0")
    assert result["qualification_score"] == 85  # exact snapshot
    assert result["qualification_tier"] == "HOT"
```

---

## 2. E2E Test Plan

### 2.1 Backend (pytest)

File: `backend/tests/test_studio_v2_*.py`

#### A · Manifest & taxonomy
- `test_manifest_returns_all_keys_for_active_locale` — verifica ~118 chiavi presenti
- `test_manifest_fallback_to_en_for_missing_locale_keys`
- `test_manifest_etag_returns_304_on_match`
- `test_countries_filtered_by_enabled`
- `test_countries_localized_native_names_present`
- `test_languages_only_enabled_returned`

#### B · Draft lifecycle
- `test_create_fresh_draft_returns_token_and_m1`
- `test_patch_movement_persists_payload`
- `test_resume_draft_returns_existing_payload`
- `test_resume_expired_draft_returns_new_token`
- `test_draft_token_unknown_returns_new`
- `test_patch_invalid_movement_returns_400_with_field_errors`
- `test_draft_rate_limit_per_ip_5_per_24h`

#### C · Email check (anti-enumeration)
- `test_check_email_available_for_unknown` — must include jitter timing assert (between 0.2 and 0.4s)
- `test_check_email_taken_for_known_user`
- `test_check_email_same_timing_window_for_available_and_taken` — statistical (n=20, σ check)
- `test_check_email_malformed_returns_same_shape`
- `test_check_email_no_db_log_row_after_call`
- `test_check_email_rate_limit_returns_neutral_available_true`
- `test_check_email_normalization_lowercase_trim`

#### D · Subdomain check
- `test_check_subdomain_available_basic`
- `test_check_subdomain_reserved_returns_reason_reserved`
- `test_check_subdomain_taken_in_tenants`
- `test_check_subdomain_soft_locked_in_studio_requests_v2`
- `test_check_subdomain_invalid_format_returns_invalid_format`
- `test_check_subdomain_suggestions_returned_when_taken`

#### E · Submit
- `test_submit_full_happy_path_returns_reference_uuid_tier`
- `test_submit_creates_studio_requests_v2_row_with_correct_fields`
- `test_submit_creates_event_submitted`
- `test_submit_persists_qualification_score_and_tier`
- `test_submit_already_submitted_returns_409_with_previous_reference`
- `test_submit_race_email_taken_returns_409_email_taken`
- `test_submit_race_subdomain_taken_returns_409_subdomain_taken`
- `test_submit_rate_limit_3_per_hour`
- `test_submit_triggers_resend_email_ack` (mock Resend client)
- `test_submit_triggers_advisor_notify_email`
- `test_submit_marks_draft_submitted_at`

#### F · TQS scoring
- `test_tqs_v1_snapshot_milan_interior_full` (vedi §1.9)
- `test_tqs_v1_snapshot_dubai_showroom_minimal`
- `test_tqs_v1_snapshot_generic_furniture_brand_only_leads`
- `test_tqs_honeypot_overrides_to_observe`
- `test_tqs_unknown_market_lower_score`
- `test_tqs_bulk_recompute_updates_all_pending_review`
- `test_tqs_breakdown_sums_match_total`

#### G · Admin endpoints
- `test_admin_list_requires_auth`
- `test_admin_list_filters_by_tier`
- `test_admin_list_filters_by_country_code`
- `test_admin_list_search_by_email`
- `test_admin_patch_status_creates_event`
- `test_admin_recompute_score_creates_event_rescored`
- `test_admin_assign_advisor_creates_event`

#### H · Validation
- `test_movement4_email_format_strict`
- `test_movement5_subdomain_rejects_uppercase`
- `test_movement5_subdomain_rejects_consecutive_hyphens`
- `test_movement2_languages_must_be_active`
- `test_movement2_country_must_be_enabled`
- `test_movement3_goals_min1_max4`

---

### 2.2 Frontend (Playwright)

File: `frontend/tests/e2e/studio-v2/*.spec.ts`

#### A · Happy path
- `studio_v2_complete_funnel_it_locale` — fill all 5 movements in IT, submit, verify success page + reference code visible
- `studio_v2_complete_funnel_en_locale` — same in EN, verify copy switched correctly
- `studio_v2_progress_indicator_updates_per_movement`

#### B · Resume
- `studio_v2_close_tab_then_reopen_resumes_at_same_movement`
- `studio_v2_invalid_draft_token_starts_fresh`
- `studio_v2_expired_draft_starts_fresh`

#### C · Validation
- `studio_v2_m1_cannot_proceed_without_category`
- `studio_v2_m4_email_duplicate_shown_inline_and_blocks_next`
- `studio_v2_m5_subdomain_reserved_shows_message`
- `studio_v2_m5_subdomain_taken_shows_suggestions`
- `studio_v2_m5_subdomain_auto_derives_from_studio_name`

#### D · Async UX
- `studio_v2_m4_email_check_shows_spinner_then_check`
- `studio_v2_m5_subdomain_check_debounced_400ms`
- `studio_v2_mapbox_city_autocomplete_shows_suggestions`
- `studio_v2_mapbox_fallback_to_text_input_after_2_failures`

#### E · Visual & accessibility
- `studio_v2_no_real_photos_present` — DOM scan, assert nessun img con src che matcha pattern stock photo / studio photo
- `studio_v2_keyboard_navigation_complete_funnel` — solo Tab/Enter/Space
- `studio_v2_focus_visible_on_all_interactive`
- `studio_v2_reduced_motion_respected`
- `studio_v2_color_contrast_aa` — axe-core scan

#### F · Edge cases
- `studio_v2_back_button_preserves_state`
- `studio_v2_network_failure_during_submit_shows_retry`
- `studio_v2_double_submit_prevented`
- `studio_v2_honeypot_field_invisible_but_present`

#### G · Mobile
- `studio_v2_iphone_se_complete_funnel`
- `studio_v2_sticky_nav_bar_visible_on_mobile`
- `studio_v2_m1_grid_single_column_on_xs`

---

### 2.3 Integration tests (cross-stack)

- `test_end2end_submit_then_admin_sees_request_in_list`
- `test_end2end_submit_creates_resend_email_to_founder` (Resend sandbox API)
- `test_end2end_submit_creates_resend_email_to_advisor_team`
- `test_end2end_advisor_assignment_via_command_center_updates_request`
- `test_end2end_email_already_in_v1_studio_requests_blocks_v2_submit` (cross-table uniqueness via view)

---

## 3. Migration Plan v1 → v2

### 3.1 Strategy: **dual-route coexistence + soft cutover**

Nessun hard-switch. Le due implementazioni convivono per ≥30 giorni dopo il go-live di v2.

### 3.2 Phases

#### Phase 0 · Pre-cutover (oggi)
- v1 attivo su `/studio` — invariato
- DB v1 schema invariato

#### Phase 1 · v2 hidden (week 1 implementazione)
- Tabelle nuove create (`countries`, `active_languages`, `reserved_subdomains`, `studio_requests_v2`, `studio_v2_drafts`, `v_global_email_registry`)
- Seed countries + languages + reserved + copy
- Endpoint `/api/studio/v2/*` deployati
- Route `/studio/v2` esistente ma protetta da feature flag `STUDIO_FLOW_V2_PUBLIC=false`
- Accesso interno tramite query param `?preview=<token>` per QA
- **Nessun impatto utente**

#### Phase 2 · v2 alpha (week 2)
- Feature flag `STUDIO_FLOW_V2_PUBLIC=true`
- `/studio/v2` raggiungibile pubblicamente da link diretto
- `/studio` (v1) **invariato** — non rimanda a v2
- A/B test manuale: marketing condivide link `/studio/v2` con canali selezionati
- Metriche raccolte: completion rate, time-to-submit, TQS distribution
- Submissions arrivano in `studio_requests_v2`, gestite nel Command Center v2

#### Phase 3 · v2 beta (week 3)
- Banner soft su `/studio` v1: "Stiamo introducendo una nuova candidatura. Provala qui →" link a v2
- 50% traffico organico naturalmente switcha
- Advisor team gestisce **entrambi** i flussi (separate inbox in Command Center)

#### Phase 4 · v2 default (week 4)
- Route `/studio` redirige 302 a `/studio/v2`
- Vecchio funnel raggiungibile solo via `/studio/v1` (per testing/regression)
- Marketing material e link esterni rimangono `/studio` → redirect automatico

#### Phase 5 · v1 deprecation (month 2)
- Banner su `/studio/v1`: "Questa candidatura legacy. Usa la nuova versione."
- DB v1 reads ancora supportati (lista admin), writes bloccati
- Endpoint `/api/studio/activation/*` (v1) flagged `deprecated`

#### Phase 6 · v1 removal (month 3+)
- Route `/studio/v1` rimossa (404)
- Endpoint v1 backend rimossi
- Tabella `studio_requests` v1 archiviata in read-only (rename a `studio_requests_legacy`)
- Mai eliminata fisicamente

---

### 3.3 Data mapping v1 → v2 (read-only join per advisor)

Durante coexistence, la pagina admin "All Requests" dovrebbe mostrare unificato:

```sql
-- Concept view (not implemented yet)
CREATE OR REPLACE VIEW v_all_studio_requests AS
SELECT
  id, reference, status, contact_email AS founder_email,
  studio_name, archetype AS studio_type_legacy,
  NULL::varchar(64) AS studio_type,
  city, NULL AS country_code,
  NULL::integer AS qualification_score,
  NULL::varchar(8) AS qualification_tier,
  'v1' AS source_version,
  created_at AS submitted_at
FROM studio_requests
UNION ALL
SELECT
  id, reference, status, founder_email,
  studio_name, NULL AS studio_type_legacy,
  studio_type,
  city, country_code,
  qualification_score, qualification_tier,
  'v2' AS source_version,
  submitted_at
FROM studio_requests_v2;
```

L'admin UI può poi filtrare per `source_version` o mostrare tutto unificato.

---

### 3.4 Feature flag implementation

```python
# backend/config.py
STUDIO_FLOW_V2_PUBLIC = os.environ.get("STUDIO_FLOW_V2_PUBLIC", "false").lower() == "true"
STUDIO_FLOW_V2_DEFAULT = os.environ.get("STUDIO_FLOW_V2_DEFAULT", "false").lower() == "true"
```

Frontend (`/studio` route):
```jsx
if (STUDIO_FLOW_V2_DEFAULT) {
  return <Navigate to="/studio/v2" replace />;
}
return <StudioV1Layout />;
```

Override per QA: query param `?force=v1` o `?force=v2` rispettato sempre (con secret token in dev).

---

### 3.5 Rollback plan

Se v2 ha issues critici post-cutover:

1. **Immediate**: `STUDIO_FLOW_V2_DEFAULT=false` → tutto torna a v1 (1 supervisor restart)
2. **Dati v2 già acquisiti**: restano in `studio_requests_v2`, gestiti manualmente dagli advisor finché problema risolto
3. **Hot fix**: deploy patch, ripeti `=true`

Nessun rollback dato — entrambe le tabelle sono fonte di verità per i rispettivi periodi.

---

### 3.6 Cutover acceptance criteria

Prima di abilitare `STUDIO_FLOW_V2_DEFAULT=true`:

- [ ] 100+ submissions di test/alpha in `studio_requests_v2` senza errori
- [ ] Completion rate v2 ≥ 85% del v1 baseline
- [ ] TQS distribution ragionevole (no skew estremo verso un tier)
- [ ] Email Resend ack delivered ≥ 98%
- [ ] Mapbox quota usage < 30% del free tier
- [ ] Tutti i test E2E backend + frontend passano
- [ ] Editorial team conferma copy IT/EN minimo (FR/DE/ES possono arrivare in cutover+7gg)
- [ ] Advisor team formato sull'uso del Command Center v2 + TQS
- [ ] Plan B di rollback testato in staging

---

## 4. Risk Register

| ID | Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| R1 | Mapbox quota exhaustion | Med | Low | Proxy server-side + caching + fallback a text input |
| R2 | TQS produces unfair scores per non-EU studios | High | Med | Geographic weights tunabili via `tqs_versions`, audit trimestrale |
| R3 | Email check timing oracle | High | Low | Jitter test statistico (§2.1.C) |
| R4 | Subdomain race condition al submit | Med | Med | Transactional re-check + retry 1× |
| R5 | Copy non tradotta in nuova lingua attivata | Med | High | Fallback automatico a EN + warning in CMS |
| R6 | Drop-off non recuperabile | Med | High | Email "resume draft" se M4 raggiunto |
| R7 | Bot submission flood | High | Med | Rate limit + honeypot + CAPTCHA gating |
| R8 | DB wipe ricorrenza (incident P0) | Critical | TBD | RCA in corso — vedi `SUPABASE_INCIDENT_…` |
| R9 | TQS bias bocciato dall'advisor team | Med | Med | Versionato (`v1.0.0`), opt-in re-score, mai hard decision |
| R10 | Convivenza v1+v2 confonde advisor | Med | Med | View unificata + label `source_version` chiaro |

---

## 5. Open Decisions ancora da chiudere

Prima dell'implementazione, decidere:

1. **Reference code format**: `MOOD-A3F7-9D21` (esadec 8 char) vs `MOOD-2026-00042` (anno + counter). Default proposto: hex perché unpredictable.
2. **TQS visibility nel detail richiesta**: solo aggregate (score+tier) o anche breakdown completo per ogni advisor? Default: breakdown sempre visibile (trasparenza interna).
3. **Email recovery (M4 abandon)**: invio dopo 24h, 48h, o entrambi? Default: solo 24h, no spam.
4. **Mapbox endpoint scelto**: Search Box API (più recente) vs Geocoding v6 (più stabile). Default: Search Box (session-based pricing più efficiente).
5. **Reserved subdomains updates UI**: solo super_admin oppure editor? Default: super_admin only.
6. **Categoria "Other"**: lasciar fuori dalla M1 e gestire via free-text in M5 nel `notes`? O aggiungere 9a card "Altro"? Default proposto: fuori, gestione futura tramite contatto advisor.
7. **Languages multi-select max**: confermare 6 o ridurre a 4? Default: 6.
8. **Submit confirmation modal**: dopo CTA "Invia richiesta", mostrare modal "Stai per inviare. OK?" o submit diretto? Default: submit diretto (riduce friction; back ancora possibile via browser back se preview).
9. **Telemetria — backend o anche analytics 3rd party**: solo backend log o anche Plausible/PostHog? Default: solo backend, no 3rd party (privacy first).
10. **Locale per i suggerimenti Mapbox**: passare il `locale` selezionato in homepage o `Accept-Language` browser? Default: locale homepage (consistency con resto del funnel).

---

## 6. Definition of Done (DoD) globale

Per dichiarare il redesign **complete & ready for cutover**:

- [x] Documento `00_OVERVIEW_AND_UX.md` approvato
- [x] Documento `01_COPY_AND_CMS.md` approvato + traduzioni complete IT/EN/FR/DE/ES
- [x] Documento `02_TECH_DESIGN.md` approvato + schema rivisto + endpoint contracts firmati
- [x] Documento `03_SCORE_E2E_MIGRATION.md` approvato (questo file)
- [ ] Migration 026/027/028 reviewed da peer
- [ ] Seed data files pronti (countries 250 rows, languages 5, reserved 80, copy 118×5)
- [ ] Mapbox playbook ricevuto via `integration_playbook_expert_v2`
- [ ] TQS v1.0.0 weights review e firmata dal copy/biz lead
- [ ] Test plan implementato 100% backend + 80% frontend Playwright
- [ ] Phase 0 (incident P0 RCA chiusa) ✅ — prerequisito hard
- [ ] User approval esplicito su questa proposta

---

## 7. Sintesi finale (1 pagina)

> Redesign integrale del funnel `/studio` da percorso editoriale-narrativo a **5 movimenti di qualificazione professionale**: categoria → sede + lingue → priorità → referente → identità tenant. Durata 3–4 minuti, mobile-first, copy revisionato in tono **professionale-essenziale** (non aulico), CMS-first multilingua (~118 chiavi × 5 lingue). Backend supporta nuove tabelle additive (`countries`, `active_languages`, `reserved_subdomains`, `studio_requests_v2`, `studio_v2_drafts`) + view `v_global_email_registry` per uniqueness globale email. Mapbox per autocomplete città con fallback grazioso. Ogni richiesta riceve un **Tenant Qualification Score™ (0–100, tier HOT/WARM/COLD/OBSERVE)** computato deterministicamente da 7 componenti pesati, usato internamente per priorità e advisor routing. Migration soft con coexistence v1+v2 30+ giorni, feature flag, rollback istantaneo. Zero side effects sul DB attuale durante il drafting; tutta la implementazione **bloccata fino a chiusura incident Supabase P0**.

---

— *fine documento 03 e del package di design* —
