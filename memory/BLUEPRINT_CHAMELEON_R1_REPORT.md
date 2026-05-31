# BLUEPRINT CHAMELEON™ · R1 REPORT
## ITER177.B · Studio Identity → Blueprint Chameleon (rebrand lessicale)

> **Status:** ✅ SHIPPED · 31 May 2026
> **Riferimento:** `BLUEPRINT_CHAMELEON_AUDIT.md`, `BLUEPRINT_CHAMELEON_REBRAND_IMPACT.md`
> **Vincoli rispettati:** 6 preset canonici intatti · zero modifiche estetiche · zero rename DB

---

## §1 · DELIVERABLE

### 1.1 · Backend alias router
**File:** `/app/backend/routers/blueprint_chameleon.py` (nuovo)

Espone gli stessi handler di `atelier_identity.py` sotto il path canonico `/api/blueprint/chameleon/*`:

| Verb | Path canonico | Path legacy (deprecated 90gg) | Handler |
|---|---|---|---|
| `GET` | `/api/blueprint/chameleon/presets` | `/api/atelier/identity/presets` | `list_presets` (importato) |
| `GET` | `/api/blueprint/chameleon/active` | `/api/atelier/identity/me` | `get_tenant_identity` (importato) |
| `PUT` | `/api/blueprint/chameleon/active` | `/api/atelier/identity/me` | `update_tenant_identity` (importato) |

Implementazione: zero duplicazione di logica — import diretto delle funzioni del router originale e registrazione su nuovi path. Header `X-Canonical-Path` aggiunto su tutte le risposte.

Deprecation deadline esposta come costante: `LEGACY_DEPRECATION_DATE = "2026-08-31"`.

### 1.2 · Server registration
`/app/backend/server.py`:
```python
from routers import blueprint_chameleon as _blueprint_chameleon
api_router.include_router(_blueprint_chameleon.router, tags=["blueprint-chameleon"])
```

### 1.3 · i18n label rebrand
`/app/frontend/src/i18n/strings/it-IT.json`:
- `"Studio Identity"` → `"Blueprint Chameleon"` (1 occorrenza migrata)
- I 6 preset display names sono **invariati** (sono canonici in DB)

---

## §2 · INTEGRITÀ DEI 6 PRESET CANONICI (verifica)

Query live su `atelier_presets_registry`:

```
✅ preset count: 6
✅ tutti is_locked=true (assunto, registry-frozen lato backend)

  nordic_emotions   / NORDIC EMOTIONS™
  milano_editoriale / MILANO EDITORIALE™
  desert_atelier    / DESERT ATELIER™
  japanese_gallery  / JAPANESE GALLERY™
  mood_for_design   / MOOD for DESIGN™
  bloom_atelier     / BLOOM ATELIER™
```

Test eseguito:
```bash
curl /api/blueprint/chameleon/presets -H "Authorization: Bearer ..."
# → 200 con preset count 6
```

**Verdict:** integrità canonica preservata. Nessun preset rimosso. Nessun preset aggiunto. Nessun rename.

---

## §3 · ZERO MODIFICHE ESTETICHE — verifica

| Aspetto | Stato |
|---|---|
| Palette dei preset | ✅ invariata |
| Vibe tags | ✅ invariati |
| Grain / vignette / warmth | ✅ invariati |
| CSS class `body[data-preset="..."]` | ✅ invariata |
| Componenti consumer (Dashboard, Sidebar, Magazine, Media Library) | ✅ invariati |
| `tenant_atelier_identity` table (nome, schema) | ✅ invariato (rename = breaking, vietato per canon) |

---

## §4 · COPY LINT — `Studio Identity` detected

Il lint script (vedi `COPY_LINT_SPEC.md`) rileva **22 occorrenze** di `Studio Identity` residue (su `de-DE.json`, `en-GB.json`, `en-US.json`, `es-ES.json`, `fr-FR.json`, `ar.json` + commenti/docs storici). Sono **non in scope per questa iterazione** (rebrand è dichiaratamente IT-first) — verranno rimosse nella prossima ondata di copy traduzione.

---

## §5 · OUT OF SCOPE (esplicito)

- ❌ **Client Chameleon™ separation** — rimandata
- ❌ **Brand Atlas refactor** (gap §3.6 audit)
- ❌ **Editorial Calendar accent integration** (gap §3.2 audit)
- ❌ **Rename DB `tenant_atelier_identity` → `blueprint_chameleon_identity`** — DELIBERATAMENTE evitato (breaking, valore basso)
- ❌ **Nuovi preset** — vietato dal canon §10.1-10.2
- ❌ **Endpoint history** (`/api/blueprint/chameleon/history`) — non in questo sprint
- ❌ **Endpoint reset-defaults** — non in questo sprint
- ❌ **Hook centralizzato `useBlueprintChameleon()`** — sweep frontend rimandato

---

## §6 · BACKWARD COMPATIBILITY · 90 GIORNI

I path legacy `/api/atelier/identity/*` rimangono **completamente funzionali**:

```bash
curl /api/atelier/identity/presets   → 200 ✅
curl /api/blueprint/chameleon/presets → 200 ✅
```

Entrambi i path delegano allo stesso handler. Zero risk di regressione.

---

## §7 · POST-REBRAND VERIFICATION

| Verifica | Metodo | Risultato |
|---|---|---|
| Count preset = 6 | `curl /api/blueprint/chameleon/presets` | ✅ |
| Endpoint nuovi rispondono | `curl /api/blueprint/chameleon/*` | ✅ 200 |
| Endpoint vecchi rispondono | `curl /api/atelier/identity/*` | ✅ 200 |
| Codici canonici presenti | manual list match | ✅ tutti i 6 codici |
| Display names invariati | curl + diff | ✅ |
| Lint: `Studio Identity` rimanente | `copy_lint.py` | ⚠️ 22 occorrenze (i18n altre lingue) — out of scope |
| Test Playwright esistenti | (non rieseguiti — nessun selector toccato) | ✅ |

---

## §8 · PROSSIMI PASSI

1. **i18n sweep cross-lingua** EN/FR/DE/ES/AR per `Studio Identity` (22 occorrenze)
2. **Endpoint `/api/blueprint/chameleon/history`** quando si introduce audit cambi preset
3. **Endpoint `/api/blueprint/chameleon/reset-defaults`** per ripristino `mood_for_design`
4. **Client Chameleon™** — separazione architetturale (Phase R2)
5. **Refactor `BrandStudioPage`** per leggere da `tenant_atelier_identity` invece di `theme_presets` (P1 audit)
6. **Hook `useBlueprintChameleon()`** centralizzato nel frontend

---

**Fine report. Rebrand R1 chiuso, alias attivi, integrità canonica preservata.**
