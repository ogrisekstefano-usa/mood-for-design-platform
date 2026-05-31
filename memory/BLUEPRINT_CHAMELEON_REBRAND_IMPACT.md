# BLUEPRINT CHAMELEON™ · REBRAND IMPACT REPORT
## Da "Studio Identity" a "Blueprint Chameleon" — superficie a superficie

> **Status:** 📋 IMPACT REPORT · ITER176.B · 31 May 2026
> **Scope:** rinominare **Studio Identity™** → **Blueprint Chameleon™** in tutto il codice e UI, verificare l'allineamento con i **6 preset canonici**, **nessuna modifica estetica**, **nessun nuovo preset**.
> **Riferimento architetturale:** `BLUEPRINT_CHAMELEON_AUDIT.md`
> **Pre-condizione:** ITER178 completato (Journey Assignments) — non interferisce con rebranding.

---

## §0 · Executive summary

Il rebrand **Studio Identity → Blueprint Chameleon** è un'operazione **architetturale + lessicale**, non estetica. Il sistema attuale ha:
- ✅ **DB schema corretto** (6 preset in `atelier_presets_registry`, tabella `tenant_atelier_identity`)
- 🟡 **Endpoint che usano `/atelier/identity/*`** (vanno mantenuti come deprecati con alias verso `/blueprint/chameleon/*`)
- 🔴 **Frontend con label "Studio Identity"** in stringhe i18n e component names
- 🔴 **Docs con terminologia mista** (Studio Identity / Atelier Identity / Chameleon usati come sinonimi)
- 🔴 **Drift architetturale**: il client portal eredita Blueprint Chameleon, ma per canon (Design Journey §17.13) deve passare a Client Chameleon — questo è documentato MA NON IMPLEMENTATO

**Scope del rebrand (questa iterazione):**
- Solo **rinominazione concettuale** Studio Identity → Blueprint Chameleon.
- **Verifica integrità** dei 6 preset (NESSUNA modifica al loro contenuto).
- **Mappatura completa surfaces** che usano il preset (chi legge, da dove).
- **NON** include la separazione Client Chameleon (rimandata a roadmap successiva).
- **NON** include la creazione di nuovi preset (vietata dal canon §10.1-10.2).

**Stima effort rebrand puro:** ~2 giorni full-stack.

---

## §1 · I 6 preset canonici — VERIFICA INTEGRITÀ

Query attesa su `public.atelier_presets_registry`:

```sql
SELECT code, display_name, is_locked, vibe_tags
FROM atelier_presets_registry
ORDER BY display_order;
```

Risultato canonico atteso:

| # | code | display_name | is_locked | vibe (sintesi) |
|---|---|---|---|---|
| 1 | `nordic_emotions` | **NORDIC EMOTIONS™** | `true` | Restraint · cool desaturation · architectural calm |
| 2 | `milano_editoriale` | **MILANO EDITORIALE™** | `true` | Editorial precision · deep blacks · cinematic |
| 3 | `desert_atelier` | **DESERT ATELIER™** | `true` | Warm hospitality · soft sepia · fireplace |
| 4 | `japanese_gallery` | **JAPANESE GALLERY™** | `true` | Wabi-sabi · soft light · editorial neutrality |
| 5 | `mood_for_design` | **MOOD for DESIGN™** | `true` | House voice · architectural dawn |
| 6 | `bloom_atelier` | **BLOOM ATELIER™** | `true` | Soft botanic warmth · floral grading |

**Vincoli canon (immutabili — §10 audit):**
- ✅ Count = ESATTAMENTE 6, mai 5, mai 7.
- ✅ Tutti `is_locked=true`.
- ✅ Nessun preset può essere clonato, rinominato, esteso.
- ✅ Display name è source-of-truth — il frontend NON deve hardcodare nomi alternativi.

**Check di verifica pre-rebrand (acceptance gate):**

```sql
-- Test 1: count = 6
SELECT COUNT(*) = 6 FROM atelier_presets_registry;

-- Test 2: tutti locked
SELECT bool_and(is_locked) FROM atelier_presets_registry;

-- Test 3: codici canonici presenti
SELECT array_agg(code ORDER BY code) =
       ARRAY['bloom_atelier','desert_atelier','japanese_gallery',
             'milano_editoriale','mood_for_design','nordic_emotions']
FROM atelier_presets_registry;
```

Tutti i 3 test devono ritornare `true`. Se anche solo uno fallisce → **STOP REBRAND** e remediation prima.

---

## §2 · MAPPA REBRAND · file-by-file

### 2.1 · Backend (Python)

| File | Stato attuale | Azione |
|---|---|---|
| `/app/backend/routers/atelier_identity.py` | Endpoint `/atelier/identity/*` | **Mantenere come deprecato.** Creare nuovo `/app/backend/routers/blueprint_chameleon.py` che monta gli STESSI endpoint su `/api/blueprint/chameleon/*` come alias. Nessuna logica duplicata: importa funzioni handler dal vecchio router. |
| `/app/backend/routers/atelier_media.py` | OK (non rebranding necessario — è "atelier_media") | Nessuna azione |
| `/app/backend/core/identity_helpers.py` (se esiste) | Da verificare | Se esiste, alias modulo `core/chameleon_helpers.py` |
| Docstrings & commenti che dicono "Studio Identity" | Vari | Find & replace verso "Blueprint Chameleon" |
| Variabili Python `studio_identity`, `atelier_identity` come var name | Vari | Lasciare invariate (refactor rischioso, low value) — solo rinominare in commenti/docs |

**Vincolo:** NESSUNA modifica DB. La tabella resta `tenant_atelier_identity` (rename = breaking, non vale il rischio).

### 2.2 · Frontend (React)

| File / Componente | Azione |
|---|---|
| `src/pages/atelier/AtelierIdentityPage.jsx` (se esiste) | Rinominare lessicalmente in UI strings: title "Blueprint Chameleon" invece di "Studio Identity". File name può restare. |
| `src/components/atelier/IdentityPicker.jsx` | UI label rebrand |
| `src/components/atelier/PresetSelector.jsx` | UI label rebrand |
| `src/locales/it/*.json` | Find: `"studio_identity"`, `"Studio Identity"`, `"identità studio"`. Replace con `"blueprint_chameleon"`, `"Blueprint Chameleon"`. |
| `src/locales/en/*.json` | Idem (versione inglese) |
| `src/contexts/TenantContext.jsx` (campo `brand_preset`) | Aggiungere alias `chameleon_preset` come getter computed (back-compat). |
| Stringhe hardcoded in components ("Atelier Identity", "Studio Brand") | Find & replace caso-per-caso |

**Test ID & data attributes:**
- Mantenere `data-testid` esistenti per non rompere Playwright tests.
- Aggiungere alias dove utile: `data-testid="blueprint-chameleon-picker"`.

### 2.3 · CSS e theming

- Le CSS class `body[data-preset="..."]` restano invariate (i codici sono già canonici).
- Custom properties `--studio-identity-*` (se esistono) → alias `--blueprint-chameleon-*` con stesso valore.
- Nessuna modifica a palette, accent, vibe.

### 2.4 · Email templates

| Template | Azione |
|---|---|
| `templates/email/space_ready.html` | Label "Atelier" nel signature → mantenere (è branding tenant, non Chameleon). |
| Welcome email subject | Verifica che usi `tenant.display_name` non hardcoded |

### 2.5 · Documenti `/app/memory`

| File | Azione |
|---|---|
| `BLUEPRINT_CHAMELEON_AUDIT.md` | ✅ già canonico |
| `DESIGN_JOURNEY_CANON.md` | ✅ già canonico (usa "Blueprint Chameleon™" + "Client Chameleon™") |
| `CRM_LIFECYCLE_CANON.md` | nessun riferimento diretto |
| `TEAM_LIFECYCLE_AUDIT.md` | nessun riferimento diretto |
| `STUDIO_ACTIVATION_ARCHITECTURE.md` | step "Selezione Blueprint Chameleon™" — verifica presente |
| Vecchi report ITER (pre-176) | leave as-is (storici) |

---

## §3 · MATRICE DELLE SURFACES CONSUMER (chi legge il preset?)

Riassunto dalla §3 di `BLUEPRINT_CHAMELEON_AUDIT.md`, qui con focus sull'**impatto rebrand**:

| # | Surface | Componente | Source data | Rebrand impact | Verifica post-rebrand |
|---|---|---|---|---|---|
| 1 | Dashboard hero | `AtelierDashboardPage` | `GET /api/atelier/identity/me` | 🟢 label only | screenshot pre/post identico |
| 2 | Magazine list (storefront) | `MagazinePage.jsx` | tenant CSS class | 🟢 zero (CSS class invariata) | screenshot identico |
| 3 | Sidebar atelier | `AtelierSidebar` | preset hook | 🟢 label only | screenshot identico |
| 4 | Media Library variants | `MediaLibraryPage` | preset baked in upload | 🟢 zero | upload test |
| 5 | Editorial Calendar | `MagazineAdminPage` | NON LEGGE (gap noto) | 🟡 gap pre-esistente, non chiuso da rebrand | TODO future iter |
| 6 | Brand Atlas | `BrandStudioPage` | `theme_presets` + `tenants.primary_color` | 🔴 gap pre-esistente (vedi §5 audit), NON chiuso da rebrand | TODO future iter |
| 7 | Client portal welcome | `ClientWelcomePresetPage` | eredita preset studio | 🔴 gap critico (canon §17.13: deve usare Client Chameleon, non Blueprint) — **OUT OF SCOPE rebrand** | TODO future iter (separation plan) |
| 8 | Material View | `MaterialView` (atelier) | preset hook | 🟢 label only | screenshot identico |
| 9 | Brief Guided | `BriefGuidedPage` | eredita preset studio | 🔴 stesso gap di #7 — OUT OF SCOPE | TODO future iter |
| 10 | Header app | `AppHeader` (eventuale label "Studio Identity" picker) | preset hook | 🟢 label only | screenshot identico |

**Verdetto rebrand puro:** impatto **lessicale al 100%**, zero impatto estetico. Le surface 7-9 (client portal) hanno un gap **pre-esistente** non risolto da questo rebrand, ma diventerà più visibile dopo (perché ora chiamarlo "Blueprint Chameleon" del client è chiaramente sbagliato — è studio-side).

---

## §4 · ENDPOINT ALIAS · backward compatibility

### 4.1 · Rotte deprecate (mantenute funzionanti per 90 giorni)

| Vecchio path | Nuovo alias canonico | Stato |
|---|---|---|
| `GET /api/atelier/identity/presets` | `GET /api/blueprint/chameleon/presets` | deprecated, alias attivo |
| `GET /api/atelier/identity/me` | `GET /api/blueprint/chameleon/active` | deprecated, alias attivo |
| `PUT /api/atelier/identity/me` | `PUT /api/blueprint/chameleon/active` | deprecated, alias attivo |

**Implementazione alias:** in `blueprint_chameleon.py` importare le funzioni handler dal modulo `atelier_identity` e registrarle anche su nuovi path. Zero duplicazione di logica.

```python
# /app/backend/routers/blueprint_chameleon.py (futuro, NON ora)
from fastapi import APIRouter
from .atelier_identity import (
    list_presets as _list_presets,
    get_my_identity as _get_my_identity,
    update_my_identity as _update_my_identity,
)

router = APIRouter(prefix="/api/blueprint/chameleon", tags=["Blueprint Chameleon"])
router.add_api_route("/presets", _list_presets, methods=["GET"])
router.add_api_route("/active", _get_my_identity, methods=["GET"])
router.add_api_route("/active", _update_my_identity, methods=["PUT"])
```

### 4.2 · Nuovi endpoint canonici (rebrand-aware, da implementare ora o successivamente)

| Path | Quando | Note |
|---|---|---|
| `GET /api/blueprint/chameleon/history` | rebrand | nuovo, legge `tenant_atelier_identity_history` |
| `POST /api/blueprint/chameleon/reset-defaults` | rebrand | resetta a `mood_for_design` |

---

## §5 · CHECKLIST OPERATIVA REBRAND

### Phase R1 · Backend alias (1 giorno)
- [ ] Crea `/app/backend/routers/blueprint_chameleon.py` con alias router
- [ ] Registra in `/app/backend/server.py` (`app.include_router(blueprint_chameleon.router)`)
- [ ] Smoke test: `curl /api/blueprint/chameleon/presets` ritorna i 6 preset
- [ ] Smoke test: `curl /api/atelier/identity/presets` continua a funzionare (backward compat)
- [ ] Aggiungi deprecation warning header `X-Deprecated: 2026-08-31, use /api/blueprint/chameleon/*`

### Phase R2 · Frontend label rebrand (0.5 giorno)
- [ ] `src/locales/it/*.json`: find & replace `"studio_identity" → "blueprint_chameleon"`, `"Studio Identity" → "Blueprint Chameleon"`
- [ ] `src/locales/en/*.json`: idem
- [ ] Componenti con label hardcoded: find & replace manuale per safety
- [ ] Update `data-testid` aggiunti come alias (non rimuovere quelli esistenti)

### Phase R3 · Documenti (0.25 giorno)
- [ ] `DESIGN_JOURNEY_CANON.md` — già canonico, verifica reference
- [ ] `STUDIO_ACTIVATION_ARCHITECTURE.md` — verifica step "Blueprint Chameleon"
- [ ] Aggiorna eventuali README

### Phase R4 · Smoke + screenshot diff (0.25 giorno)
- [ ] Screenshot pre-rebrand: dashboard, sidebar, header, magazine, media library
- [ ] Apply rebrand
- [ ] Screenshot post-rebrand
- [ ] Diff visivo: deve essere **zero estetico**, solo lessicale
- [ ] Test e2e Playwright: tutti i test esistenti devono passare senza modifiche

### Phase R5 · Verifica preset integrity (continuativo)
- [ ] Run 3 SQL test da §1 prima e dopo deployment
- [ ] Audit RLS policies su `atelier_presets_registry` (deve restare read-only)

---

## §6 · RISCHI E MITIGATION

| Rischio | Probabilità | Severità | Mitigation |
|---|---|---|---|
| Test Playwright si rompono per cambio label | Media | Bassa | usa `data-testid` esistenti, mai label come selector |
| Endpoint vecchio path consumato da integrazione esterna | Bassa | Media | mantieni alias 90 giorni + deprecation header |
| User confonde "Blueprint Chameleon" con "Client Chameleon" | Alta | Bassa | UI title sempre "Atmosfera Studio · Blueprint Chameleon" per disambiguare |
| Migration `tenant_atelier_identity` rename → rompe tutto | — | Critica | NON FARLO. La tabella resta col vecchio nome. Rebrand solo concettuale. |
| Drift docs (alcuni doc dicono Atelier Identity, altri Blueprint Chameleon) | Alta | Bassa | grep finale `grep -ri "studio identity" /app/memory` |

---

## §7 · OUT OF SCOPE (esplicitamente NON inclusi)

- ❌ Separazione Client Chameleon (canon §6 audit) — roadmap futura
- ❌ Nuovi preset (vietato dal canon)
- ❌ Modifica estetica preset esistenti (vietato dal canon)
- ❌ Refactor `BrandStudioPage` (gap audit §3.6, roadmap futura)
- ❌ Editorial Calendar accent integration (gap audit §3.2, roadmap futura)
- ❌ Hook `useBlueprintChameleon()` centralizzato (roadmap futura P2)
- ❌ Rename DB tabella `tenant_atelier_identity` → `blueprint_chameleon_identity` (TROPPO RISCHIOSO, valore basso)

---

## §8 · POST-REBRAND · VERIFICA FINALE

Dopo il rebrand, il sistema deve garantire:

| Verifica | Metodo | Atteso |
|---|---|---|
| 6 preset integri | SQL §1 | ✅ tutti 6 locked, codici canonici |
| Endpoint nuovi rispondono | `curl /api/blueprint/chameleon/presets` | ✅ 6 entries |
| Endpoint vecchi rispondono | `curl /api/atelier/identity/presets` | ✅ 6 entries (alias) |
| UI label "Blueprint Chameleon" visibile | Screenshot dashboard | ✅ |
| Nessuna estetica cambiata | Diff visivo pre/post | ✅ zero diff non-testuali |
| Test Playwright passano | CI run | ✅ 100% |
| Test backend passano | `pytest` o smoke | ✅ |
| Docs allineati | `grep -ri "studio identity"` | ⚠️ residui solo in storici (ITER pre-176) |

---

## §9 · APPROVAZIONE FOUNDER

Per procedere con il rebrand, il Founder deve confermare:

- [ ] Approvo il rebrand **lessicale** Studio Identity → Blueprint Chameleon (nessuna estetica)
- [ ] Approvo l'integrità dei 6 preset canonici (immutabili)
- [ ] Approvo l'aggiunta degli alias endpoint `/api/blueprint/chameleon/*` (deprecation di 90 giorni sui vecchi)
- [ ] Approvo l'OUT OF SCOPE (§7): no Client Chameleon ora, no Brand Atlas refactor, no nuovi preset
- [ ] Approvo l'effort stimato di ~2 giorni full-stack

Solo dopo OK → si procede con Phase R1.

---

## §10 · DELIVERABLE FINALI ATTESI

- ✅ `/app/backend/routers/blueprint_chameleon.py` (alias router)
- ✅ `server.py` aggiornato con `include_router(blueprint_chameleon.router)`
- ✅ `src/locales/it/*.json` + `en/*.json` rebrand label
- ✅ Componenti con label aggiornato (zero refactor logico)
- ✅ Screenshot diff pre/post (proof of zero estetico)
- ✅ Smoke test backend (alias + originale entrambi funzionanti)
- ✅ Update `BLUEPRINT_CHAMELEON_AUDIT.md` con sezione "✅ REBRAND COMPLETATO 2026-XX-XX"

---

**Fine documento. In attesa di approvazione Founder.**
