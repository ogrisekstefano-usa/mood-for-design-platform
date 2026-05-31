# BLUEPRINT CHAMELEON™ · CONSUMPTION AUDIT
## (ex Studio Identity™ — rinominato canonico)

> **Status:** 🔒 ARCHITECTURE AUDIT · 31 May 2026 · zero modifica codice/DB
> **Pre-condizione:** ITER174 (Founder Only), ITER177 (Team Foundation), ITER178 (Journey Assignments) completati
> **Vincolo Founder:** Studio Identity™ è DEPRECATO. Nome canonico = **Blueprint Chameleon™**. Preset = ESATTAMENTE 6, immutabili.

---

## §0 · I 6 preset canonici (immutabili)

Verificati su `public.atelier_presets_registry` (count = 6):

| Position | Code | Display Name | Filtro estetico (vibe) |
|---|---|---|---|
| 1 | `nordic_emotions` | NORDIC EMOTIONS™ | Restraint · cool desaturation · architectural calm |
| 2 | `milano_editoriale` | MILANO EDITORIALE™ | Editorial precision · deep blacks · cinematic register |
| 3 | `desert_atelier` | DESERT ATELIER™ | Warm hospitality · soft sepia bias · fireplace register |
| 4 | `japanese_gallery` | JAPANESE GALLERY™ | Wabi-sabi · soft light · editorial neutrality |
| 5 | `mood_for_design` | MOOD for DESIGN™ | House voice · architectural dawn · editorial precision |
| 6 | `bloom_atelier` | BLOOM ATELIER™ | Soft botanic warmth · floral grading · hospitality |

**Tutti `is_locked=true`. Nessuno può essere clonato, rinominato, esteso.**

**ZOMBIE da depurare** (non in scope di questo audit, ma documentato):
- `theme_presets` (33 righe) → catalogo "theme color tokens" legacy.
  È un sistema **separato** da `atelier_presets_registry`. Non sono Blueprint Chameleon. Sono palette CSS storiche. Usato in `branding.py` per CMS-side color tokens.
  Decisione architetturale richiesta: **lasciarlo dov'è** (independent layer) ma RINOMINARE concettualmente in "Color Tokens" (mai più "preset" per evitare confusione con Chameleon).

---

## §1 · Tabelle DB coinvolte

| Tabella | Ruolo | Stato |
|---|---|---|
| `atelier_presets_registry` | **catalogo canonico Chameleon** (6 righe) | ✅ canonico |
| `tenant_atelier_identity` | **scelta di tenant**: `active_preset_code` + override (palette/accent/logo/locale) | ✅ canonico |
| `tenant_atelier_identity_history` | audit cambio preset | non verificato in DB (assumed exists) |
| `theme_presets` | catalogo color tokens (33 righe) **NON Chameleon** | 🟡 separato, da rinominare concettualmente |
| `tenants` | branding fields legacy (logo_url, primary_color, ...) | 🟡 sovrapposizione parziale con identity |

### Schema `tenant_atelier_identity` (1 row per tenant)
```
tenant_id              uuid PK → tenants.id
active_preset_code     text NOT NULL → atelier_presets_registry.code
logo_url               text
palette_override       jsonb         -- override colori del preset
accent_system          jsonb         -- accent tokens
editorial_tone         text          -- tone of voice
default_locale         text
fallback_locales       text[]
created_at, updated_at
```

---

## §2 · Endpoint backend

| Endpoint | Scope | File | Funzione |
|---|---|---|---|
| `GET /api/atelier/identity/presets` | studio | `routers/atelier_identity.py:41` | Lista i 6 preset |
| `GET /api/atelier/identity/me` | studio | `routers/atelier_identity.py:53` | Identity del tenant corrente |
| `PUT /api/atelier/identity/me` | studio admin | `routers/atelier_identity.py:94` | Aggiorna `active_preset_code` + overrides |
| `GET /api/atelier-media/*` | atelier media | `routers/atelier_media.py` | Variants legati al preset attivo (filtro estetico) |
| `GET /api/blueprint-admin/tenants/{id}` | super admin | `routers/blueprint_admin.py` | Visualizza preset attivo per tenant (dashboard governance) |

**Mancante:**
- 🔴 `GET /api/blueprint/chameleon/preset-history` (audit chi ha cambiato cosa e quando)
- 🔴 `POST /api/blueprint/chameleon/reset` (ripristino al preset default `mood_for_design`)

---

## §3 · Mappa di consumo (preset → componente → pagina → API → DB field)

### 3.1 · Dashboard 🟢

| Componente | Pagina | API | DB field letto |
|---|---|---|---|
| `AtelierDashboardPage` | `/atelier-dashboard` | `GET /api/dashboard/pulse` + `GET /api/atelier/identity/me` | `tenant_atelier_identity.active_preset_code` |
| `StudioOnboardingPanel` | `/dashboard` | `GET /api/tenant-onboarding/status` | — (no preset usage) |
| Hero gradient + tipografia | `DashboardPage` | derived from preset code (CSS module) | `active_preset_code` |

**Verdetto:** consume corretto. Il preset code guida hero gradient + filtro estetico hero image.

### 3.2 · Editorial Calendar 🟡

| Componente | Pagina | API | DB field |
|---|---|---|---|
| Calendar view | `MagazineAdminPage.jsx` | `GET /api/editorial/calendar` (router `editorial_calendar`) | — preset NON usato |
| Article editor | `MagazineEditorPage.jsx` | `GET /api/editorial/articles/...` | — preset NON usato |

**Verdetto:** 🟡 Editorial Calendar **non legge** il Chameleon preset. Dovrebbe usare la palette accent per tag colorati + filtro estetico per le card preview. **Gap da chiudere in implementazione**.

### 3.3 · Magazine (site frontend) 🟢

| Componente | Pagina | API | DB field |
|---|---|---|---|
| Magazine list | `pages/site/MagazinePage.jsx` | `GET /api/storefront/public/{slug}/magazine` | `tenant_atelier_identity.active_preset_code` (per filtro estetico CSS) |
| Article view | `MagazineArticlePage.jsx` | idem | idem |

**Verdetto:** consume corretto via storefront preset injection.

### 3.4 · Design Journey Workspace 🟡

| Componente | Pagina | API | DB field |
|---|---|---|---|
| AtelierSidebar | `/journey/:jid` (client) | `GET /api/client/journeys/{jid}/companion` | `active_preset_code` indirettamente via tenant settings → ma client deve usare **Client Chameleon™ (vedi §6)** |
| BriefGuidedPage | `/journey/:jid/brief` | idem | idem |

**Verdetto:** 🟡 **CONFUSIONE ARCHITETTURALE**. Il client workspace eredita il Blueprint Chameleon™ dello studio. Decisione Founder approvata: deve usare **Client Design Journey Chameleon™** (sistema separato). Vedi `§6 · Separation Plan`.

### 3.5 · Media Library 🟡

| Componente | Pagina | API | DB field |
|---|---|---|---|
| Media filters | `MediaLibraryPage.jsx` (admin) | `GET /api/atelier-media/variants` | `active_preset_code` → guida grain/vignette/warmth applicate |
| Filter presets | `media_filter_presets` (8 righe) | — | catalogo separato che applica i tweak |

**Verdetto:** consume parziale. Le **variants** generate (`media_with_usage`) sono pre-bruciate al momento dell'upload con il preset attivo. **Se il tenant cambia preset, le variants storiche restano vincolate al preset originale** (corretto per audit/coerenza ma poco chiaro).

### 3.6 · Brand Atlas 🔴

| Componente | Pagina | API | DB field |
|---|---|---|---|
| `BrandStudioPage` | `/settings/brand` | `GET /api/branding/*` | `tenants.primary_color`, `tenants.logo_url`, `theme_presets.theme` |

**Verdetto:** 🔴 **NON CONNESSO** al Chameleon. La pagina Brand Atlas usa il vecchio sistema `theme_presets` (color tokens) e legge da `tenants.primary_color`, non da `tenant_atelier_identity`. **Gap critico**: l'utente che cambia il preset Chameleon non vede sincronizzarsi i Brand colors.

### 3.7 · Material View 🟡

| Componente | Pagina | API | DB field |
|---|---|---|---|
| Material gallery | `MaterialView.jsx` (atelier) | `GET /api/atelier-materials/*` | `active_preset_code` (filtro estetico thumbnail) |

**Verdetto:** simile a Media Library. Le thumbnails respect del preset, ma palette material card non guida da Chameleon.

### 3.8 · Client Portal 🔴

| Componente | Pagina | API | DB field |
|---|---|---|---|
| `ClientWelcomePresetPage` | `/welcome/:token` | `GET /api/client/welcome-summary` | eredita tutto da `tenant_atelier_identity` |
| `BriefGuidedPage` | `/journey/:jid/brief` | `GET /api/client/journeys/{jid}/companion` | idem |
| Atelier Gen3 wrappers | `/journey/:jid` | idem | idem |

**Verdetto:** 🔴 **CONFUSIONE CRITICA**. Il client portal usa il preset dello studio (Blueprint Chameleon™). Decisione Founder: deve passare a **Client Design Journey Chameleon™** dedicato.

---

## §4 · Frontend reference grep

`grep -rln "active_preset_code\|atelier_identity" /app/frontend/src` → 0 risultati diretti.
Il consume nel frontend avviene via **CSS classes** generate da `tenant.active_preset_code` (es. `body[data-preset="milano_editoriale"]`) e **hooks contesto** che derivano lo style da `TenantContext.brand_preset`.

**Action required (in implementazione):** centralizzare in un hook `useBlueprintChameleon()` che restituisce:
```js
{ preset_code, label, vibe_tags, palette_override, accent_system, ... }
```

---

## §5 · Inconsistenze rilevate (TOP 5)

| # | Inconsistenza | Severità | Action |
|---|---|---|---|
| 1 | Brand Atlas (`BrandStudioPage`) usa `theme_presets` invece di Chameleon | 🔴 ALTA | Riallineamento: leggere palette da `tenant_atelier_identity.palette_override` con fallback su `atelier_presets_registry.filter_json` |
| 2 | Editorial Calendar non legge il preset | 🟡 MEDIA | Iniettare accent_color preset per tag/badge calendar |
| 3 | Client portal eredita Blueprint Chameleon (concettualmente sbagliato) | 🔴 ALTA | Vedi §6 — separazione |
| 4 | Frontend grep 0 → uso indiretto via CSS class names, fragile | 🟡 MEDIA | Hook `useBlueprintChameleon` |
| 5 | `theme_presets` (33 righe) confonde con Chameleon (6 righe) | 🟡 MEDIA | Rinominare concettualmente "Color Tokens", non "preset" |

---

## §6 · Separation Plan: Blueprint vs Client Chameleon

Decisione Founder approvata: due sistemi indipendenti.

### Blueprint Chameleon™
- **Scope:** studio workspace (dashboard, sidebar, magazine, editorial calendar, brand atlas, media library, material view)
- **DB:** `tenant_atelier_identity` (`active_preset_code` + overrides)
- **Catalog:** `atelier_presets_registry` (6 preset)
- **Header label:** "Atmosfera Studio" o "Blueprint Chameleon"
- **Visibile a:** team member

### Client Design Journey Chameleon™
- **Scope:** client portal (welcome page, journey workspace, brief, conversation)
- **DB proposto:** nuova tabella `client_journey_chameleon` ↔ scope `(journey_id)` o `(tenant_id, journey_template_id)`
- **Catalog proposto:** può riusare gli stessi 6 codici Chameleon, MA con assegnazione differente per cliente
  - Es. Studio uses `milano_editoriale`, ma Cliente VIP riceve esperienza `nordic_emotions` per la propria journey
- **Header label:** "Atmosfera della tua Journey"
- **Visibile a:** cliente

### Separazione DB minima richiesta (in fase di implementazione)

```sql
-- Nuova tabella canonica (non implementare ora)
CREATE TABLE client_journey_chameleon (
  id                uuid PK,
  tenant_id         uuid NOT NULL,
  journey_id        uuid UNIQUE NOT NULL → design_journeys.id,
  active_preset_code text NOT NULL → atelier_presets_registry.code,
  palette_override  jsonb,
  set_by_user_id    uuid → users_profile.id,
  set_at            timestamptz NOT NULL DEFAULT NOW()
);
```

**Idea Cardinale:** il preset di studio NON deve cambiare il portal cliente. Il preset cliente è una **decisione editoriale separata**, scelta dall'owner della journey in fase di assegnazione.

---

## §7 · Endpoint da costruire per il sistema target

| Verb | Path | Scope | Note |
|---|---|---|---|
| `GET`  | `/api/blueprint/chameleon/presets` | studio admin | esposizione canonica (mirror `/atelier/identity/presets`, rebranding) |
| `GET`  | `/api/blueprint/chameleon/active` | studio | identity tenant attiva (mirror `/atelier/identity/me`) |
| `PUT`  | `/api/blueprint/chameleon/active` | studio admin | cambia preset + scrive audit |
| `GET`  | `/api/blueprint/chameleon/history` | studio | log cambi preset |
| `POST` | `/api/blueprint/chameleon/reset-defaults` | studio admin | torna a `mood_for_design` |
| `GET`  | `/api/journey/{jid}/chameleon` | studio + cliente | preset journey (Client Chameleon) |
| `PUT`  | `/api/journey/{jid}/chameleon` | studio admin | imposta preset per cliente specifica journey |

---

## §8 · Matrice di consumo finale (Blueprint Chameleon™)

| Surface | Stato consume | Conforme ai 6 preset? | Azione richiesta |
|---|---|---|---|
| 1. Dashboard | 🟢 corretto | ✅ | nessuna |
| 2. Editorial Calendar | 🟡 non legge | ⚠️ | aggiungere accent dal preset |
| 3. Magazine (storefront) | 🟢 corretto | ✅ | nessuna |
| 4. Design Journey Workspace | 🟡 confuso (vedi §6) | ⚠️ | passaggio a Client Chameleon |
| 5. Media Library | 🟡 parziale | ✅ | OK ma comunicare "bake-in" |
| 6. Brand Atlas | 🔴 disconnesso | ❌ | riallineare lettura palette |
| 7. Material View | 🟡 parziale | ✅ | OK |
| 8. Client Portal | 🔴 erroneo (vedi §6) | ❌ | migrare a Client Chameleon |

---

## §9 · Roadmap consigliata (per future iterations, NON questa)

| Pri | Item | Effort |
|---|---|---|
| 🔴 P0 | Migration `client_journey_chameleon` table | 0.5g |
| 🔴 P0 | Endpoint Client Chameleon (GET/PUT) | 0.5g |
| 🔴 P0 | Refactor client portal per leggere da Client Chameleon (non Blueprint) | 1g |
| 🟠 P1 | Refactor `BrandStudioPage` per leggere da `tenant_atelier_identity` | 0.5g |
| 🟠 P1 | Iniettare Chameleon accent in Editorial Calendar | 0.5g |
| 🟡 P2 | Centralizzare consume frontend via `useBlueprintChameleon()` hook | 1g |
| 🟢 P3 | Endpoint `/blueprint/chameleon/history` + UI audit | 1g |

---

## §10 · Vincoli di canon (immutabili)

| # | Vincolo | Conseguenza |
|---|---|---|
| 1 | I 6 preset Chameleon sono fissi | `atelier_presets_registry.is_locked=true` per tutte le righe |
| 2 | Mai aggiungere preset alternativi | nessuna migration può fare INSERT in `atelier_presets_registry` |
| 3 | Mai rinominare i preset | display_name è source-of-truth in `atelier_presets_registry` |
| 4 | Blueprint Chameleon ≠ Client Chameleon | due tabelle, due endpoint, due UX |
| 5 | Studio Identity™ è deprecato | rebranding label + comments + UI strings |
| 6 | `theme_presets` (33) ≠ Chameleon (6) | mai chiamarli "preset" in docs nuovi |
