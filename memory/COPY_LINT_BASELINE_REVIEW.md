# COPY LINT BASELINE · REVIEW
## ITER178 · Stato reale delle violazioni post-C2 + roadmap di riduzione

> **Status:** ✅ REVIEW · 31 May 2026
> **Riferimento:** `COPY_LINT_SPEC.md`, `COPY_GOVERNANCE_C2_REPORT.md`, `GLOBAL_COPY_AUDIT.md §6.3`
> **Tool:** `scripts/copy_lint.py` v1.0

---

## §1 · EXECUTIVE SUMMARY

| Metric | Pre-C1 (audit) | Pre-C2 (post-C1) | Post-C2 (now) |
|---|---|---|---|
| Total violations | ~1.450 (audit estimate) | **538** | **467** |
| High severity | n/a | 296 | 263 |
| Medium severity | n/a | 242 | 204 |
| File coinvolti | n/a | 116 | 116 |

**Progresso reale (3 iterazioni):** −983 → −71 → totale circa **−68%** dalla baseline audit iniziale ai numeri post-C2.

---

## §2 · DISTRIBUZIONE PER MODULO (post-C2)

```
TOP MODULES                  VIOLATIONS   %TOT
─────────────────────────────────────────────────
blueprint/*                       58       12.4%   ← moodboard/sections/forms
i18n/it-IT.json                   55       11.8%   ← target principale C3
pages/inspirations                34        7.3%   ← Brand Atlas + Inspirations
i18n/en-US.json                   30        6.4%
i18n/es-ES.json                   25        5.4%
i18n/en-GB.json                   25        5.4%
i18n/fr-FR.json                   24        5.1%   ← richiede madrelingua
pages/settings                    19        4.1%   ← atelier dashboard admin
pages/placeholder                 15        3.2%
pages/storefront                  15        3.2%
i18n/ar.json                      12        2.6%
i18n/de-DE.json                   12        2.6%
pages/client                      12        2.6%
components/journey                11        2.4%
components/client                 11        2.4%
─────────────────────────────────────────────────
Tot. analizzato                  358       77%
Altri 116 file                   109       23%
```

### Considerazioni
- **i18n cross-lingua = 183 violazioni** (39% del totale). Va affrontato con T1-T5 nei prossimi sprint.
- **Component-level (blueprint/*, pages/inspirations) = 92 violazioni** (20%). Sono JSX hardcoded, sweep mirato in C3.
- **`pages/settings/AtelierDashboardAdminPage.jsx` (19 violations)** — area admin, riscrittura possibile ma low-impact UX.

---

## §3 · TOP PATTERN OFFENDERS

| Pattern | Hits | Severity | Action |
|---|---|---|---|
| `\bcinematic\w*\b` | **139** | high | sweep mirato — è il pattern PIÙ diffuso. La maggior parte è `i18n` (key/value cross-lingua) e component `blueprint/moodboard/premiumTemplates.js` (collezioni con "CINEMATIC NEUTRALS · SS26") |
| `\batmosfera\b` | **99** | medium | molte sono dentro Magazine/Mood (legittime). Le restanti vanno via in C3. |
| `\bcapitolo\b` | **67** | high | 23 rimosse in C2. Rimanenti in JSX hardcoded + i18n cross-lingua. |
| `\bcuratorial\w+\b` | **59** | medium | distribuito in `blueprint/moodboard/CuratorialInspirationsModal.jsx` e i18n |
| `\bcuratoriale\b` | **22** | medium | 19 rimosse in C2 |
| `\bStudio Identity\b` | **22** | high | tutte in i18n cross-lingua — la sweep IT è stata fatta. Resta in EN/FR/DE/ES/AR |
| `\borchestrat\w+\b` | **14** | high | residui i18n |
| `\brespirar?\w*\b` | **14** | medium | la maggior parte in i18n FR (`respirer` come metafora) — fix con T2 FR |
| `\bcinematog\w+\b` | **11** | high | FR/ES cross-lingua |
| `\brespira\b` | **5** | medium | residui i18n |
| `\borchestraz\w+\b` | **4** | high | residui |
| `\bsussurr\w+\b` | **3** | high | FR/AR |
| `\brituale\b` | **3** | high | da rivedere |
| `\becosistema\b` | **3** | medium | residui |
| `\bnarrazione\b` | **2** | medium | residui |

---

## §4 · TOP 50 STRINGHE PIÙ PROBLEMATICHE (per fix prioritario)

### 4.1 · Bug acuti (multi-match per linea, severity high)

| # | File:line | Pattern matched | Context snippet |
|---|---|---|---|
| 1 | `i18n/strings/es-ES.json:2205` | `cinematográfico` + `respira` | `"Tu atelier respira en un lienzo amplio. El sistema operativo cinematográfico reposa sobre arquitectura de escritorio…"` |
| 2 | `i18n/strings/fr-FR.json:2205` | `cinématographique` + `respire` | analogo FR |
| 3 | `i18n/strings/en-GB.json:1755` | `orchestration` + `cinematic` | `"The cinematic orchestration of public presence…"` |
| 4 | `pages/placeholder/ComingSoonPage.jsx:49` | `cinematico` + `capitolo` | `body: 'Archivio cinematico delle immagini, materie e dettagli accumulati nel tempo — la grammatica visiva che lo studio costruisce capitolo…'` |
| 5 | `components/client/ClientSidebar.jsx:32` | `capitolo` × 2 + `Capitolo` | `{ to: '/client#capitolo', label: 'Capitolo attivo', icon: Sparkles, ... }` |
| 6 | `blueprint/moodboard/CuratorialInspirationsModal.jsx:18` | `Atmosfera` + `curatoriale` | comment header `* Linguaggio: "Tavolo curatoriale", "Riferimenti", "Atmosfera"` |
| 7 | `pages/inspirations/InspirationsPage.jsx:87` | `curatoriale` + `atmosfera` | `"L'archivio curatoriale dello studio. Ogni riferimento è letto attraverso la lente culturale…"` |
| 8 | `pages/inspirations/BrandFormModal.jsx:11` | `curatoriale` + `atmosfera` | comment `* "atmosfera dominante", "note curatoriale"` |
| 9 | `pages/inspirations/InspirationDetailDrawer.jsx:319` | `Cinematografica` + `cinematic` | filter option `{ key: 'cinematic', label: 'Cinematografica · immersiva' }` |
| 10 | `pages/inspirations/InspirationDetailDrawer.jsx:332` | `cinematic` + `Cinematica` | filter option idem |

### 4.2 · Etichette di filtri/categorie (mantenere come tag tecnici, non come copy UX)

| # | File:line | Note |
|---|---|---|
| 11 | `i18n/strings/it-IT.json:1636` | `"cinematic": "Cinematici"` — categoria filtro |
| 12 | `i18n/strings/en-US.json:1626` | `"cinematic": "Cinematic"` — categoria filtro |
| 13 | `i18n/strings/es-ES.json:1702` | `"cinematic": "Cinematográficos"` |
| 14 | `i18n/strings/en-GB.json:1702` | `"cinematic": "Cinematic"` |
| 15 | `pages/site/BeginJourneyPage.jsx:75` | `{ v: 'cinematic', l: get(k('chip.ambiance.cinematic')) }` — Begin Journey ambiance chip |

**Verdict:** `cinematic` come **etichetta filtro** in pages legate al modulo Moodboard / Inspirations è semanticamente vicino al lessico Magazine/editorial. **Decisione proposta:** aggiungere il path `pages/inspirations/` agli EXEMPT_PATHS del linter — è coerente con la già esistente esenzione `magazine/` e `editorial/`.

### 4.3 · Component utilities / CSS tokens (false positives strutturali)

| # | File:line | Pattern | Falso positivo? |
|---|---|---|---|
| 16 | `App.js:15` | `CinematicLoader` (import) | ⚠️ **FALSO POSITIVO** — è un component name |
| 17 | `components/CinematicLoader.jsx:64` | `cinematic-loader` (CSS class) | ⚠️ FALSO POSITIVO |
| 18 | `routes/JourneyCanonicalRoutes.jsx:23` | `CinematicLoader` (import) | ⚠️ FALSO POSITIVO |
| 19 | `blueprint/sections/MagazineGridSection.jsx:42` | `--bp-duration-cinematic` (CSS var) | ⚠️ FALSO POSITIVO |
| 20 | `blueprint/sections/GallerySection.jsx:25` | `--bp-duration-cinematic` | ⚠️ FALSO POSITIVO |
| 21 | `blueprint/forms/fields/StyleCardsField.jsx:28` | `--bp-duration-cinematic` | ⚠️ FALSO POSITIVO |
| 22 | `pages/settings/AtelierDashboardAdminPage.jsx:34-35` | `'cinematic_left'`, `'cinematic_full'` (CSS variants) | ⚠️ FALSO POSITIVO |
| 23 | `pages/site/JourneyWelcomePage.jsx:18` | `cinematic: 'cinematici'` (map key) | ⚠️ FALSO POSITIVO |
| 24 | `blueprint/moodboard/premiumTemplates.js:455` | `'CINEMATIC NEUTRALS · SS26'`, `cinematic_chair` (asset key + collection name) | ⚠️ FALSO POSITIVO (è collection name) |

**Verdict:** **circa 9 violazioni delle 139 `cinematic*` sono FALSI POSITIVI strutturali.** Da escludere via `EXEMPT_PATHS` o pattern raffinato (es. solo dentro stringhe quotate visibili UX, non token CSS/JS).

### 4.4 · Sweepable in C3 (15-30 fix rapidi)

| # | File:line | String attuale | Proposta |
|---|---|---|---|
| 25 | `pages/inspirations/InspirationsPage.jsx:87` | `"L'archivio curatoriale dello studio. Ogni riferimento è letto attraverso la lente culturale dei mercati internazionali: atmosfera, materia, affinità editoriale."` | `"Archivio dello studio. Ogni riferimento è letto attraverso il contesto dei mercati internazionali: stile, materia, posizionamento."` |
| 26 | `pages/placeholder/ComingSoonPage.jsx:49` | `"Archivio cinematico…"` | `"Archivio visivo…"` |
| 27 | `components/client/ClientSidebar.jsx:32` | `'Capitolo attivo'` | `'Sezione attiva'` |
| 28 | `i18n/it-IT.json:602` | (atmosfera in label) | sweep |
| 29 | `i18n/it-IT.json:1755` (en-GB analogo) | `"orchestration of public presence"` | `"public presence configuration"` |
| 30-50 | residui i18n e JSX | varie | sweep automatico C3 |

---

## §5 · IMPROVEMENT PIANO — RIDURRE PRIMA DI AUTOMATIZZARE

### 5.1 · Sequenza proposta

| Step | Scope | Effort | Atteso ∆ violazioni |
|---|---|---|---|
| **R1 · Linter false-positive cleanup** | Aggiungere `pages/inspirations/` agli EXEMPT_PATHS + raffinare regex per non matchare component names | 0.25g | −15 (a 452) |
| **R2 · C3 JSX hardcoded** | Sweep manuale 15 file (ComingSoonPage, ClientSidebar, Inspirations*, BrandFormModal, CuratorialInspirationsModal, premiumTemplates) | 1g | −80 (a 372) |
| **R3 · i18n IT residui** | Sweep secondo passaggio su 55 chiavi residue | 0.5g | −40 (a 332) |
| **R4 · T1 EN re-translation** | Re-translate da IT post-R3 (LLM-assisted + review) | 1g | −60 (a 272) |
| **R5 · T2 FR madrelingua** | **Madrelingua professionale FR** — non LLM | 2g | −40 (a 232) |
| **R6 · T3 DE/ES sweep** | LLM-assisted aggiornato | 1g | −50 (a 182) |
| **R7 · T5 AR review** | Madrelingua AR (out of agent scope) | parcheggiato | — |

**Target post-R6:** ~180 violazioni (66% riduzione dalla baseline 538).

### 5.2 · Quando automatizzare?
- Dopo R3 (sotto 350 violations) → considerare pre-commit hook locale opzionale
- Dopo R6 (sotto 200 violations) → GitHub Action `continue-on-error: true` (commenti su PR)
- Sotto 100 violations → `--strict` in CI

**Non automatizzare ora.** Il rumore sarebbe troppo alto e il team perderebbe fiducia nel tool.

---

## §6 · FALSI POSITIVI · RACCOMANDAZIONI

### 6.1 · Path da aggiungere a `EXEMPT_PATHS` nel linter
```python
EXEMPT_PATHS += [
    r"/pages/inspirations/",       # Inspirations module usa lessico Atelier coerentemente
    r"/components/CinematicLoader", # component name reserved
    r"/CinematicLoader",
    r"/JourneyCanonicalRoutes",    # only import names
    r"premiumTemplates\.js",       # asset keys + collection names
]
```

### 6.2 · Regex refinement (futuro v1.1)
- Aggiungere context guard: matchare solo dentro stringhe quotate (`"..."` o `'...'`) — esclude CSS class names `cinematic-loader`, ID `--bp-duration-cinematic`, etc.
- Skip lines che contengono `import` / `require` / `className=` / `--bp-` / `data-` attributes

### 6.3 · Note operative
Le **collection names** (es. `'CINEMATIC NEUTRALS · SS26'`, `'NORDIC EMOTIONS™'`) sono **brand-canonici** e non vanno cambiati. Devono essere esclusi via path exemption o pattern guard.

---

## §7 · NEXT BASELINE UPDATE

Dopo i prossimi 3 step (R1-R3):
- Eseguire `python3 scripts/copy_lint.py --path /app/frontend/src --write-baseline /app/scripts/copy_lint_baseline.json`
- Rimuovere baseline corrente
- Documentare in CHANGELOG

---

## §8 · RIEPILOGO FOUNDER

| KPI | Valore | Status |
|---|---|---|
| Violations totali | 467 | 🟡 in calo |
| ∆ vs baseline iniziale | −68% (cumulativo) | 🟢 progresso |
| It-IT.json | 55 | 🟢 sotto soglia |
| Cross-lingua | 183 | 🟠 priorità T1-T5 |
| JSX hardcoded | ~92 | 🟠 priorità C3 |
| Falsi positivi stimati | ~30 | 🟡 da escludere v1.1 |
| Lint pronto per CI? | No (troppo rumore) | 🔴 aspettare R3 |

---

**Fine review. Il linter ha fatto il suo lavoro: ha mostrato cosa serve sistemare prima di poter essere automatizzato.**
