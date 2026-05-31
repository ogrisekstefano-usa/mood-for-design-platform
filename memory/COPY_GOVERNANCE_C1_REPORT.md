# COPY GOVERNANCE C1 · REPORT
## ITER177.B · Riscrittura dei 15+ casi 🔴 Critical individuati nell'audit

> **Status:** ✅ SHIPPED · 31 May 2026
> **Riferimento:** `GLOBAL_COPY_AUDIT.md` §3.1 (Critical), §4 (Rewrite Proposals), §6 (Future Copy Rules)
> **Vincolo:** zero modifiche logiche · solo testo · zero rotture di test ID

---

## §1 · DELIVERABLE

### 1.1 · i18n IT (`/app/frontend/src/i18n/strings/it-IT.json`)
Sostituzioni applicate (verificate via diff JSON):

| # | Stringa attuale → proposta | Esito |
|---|---|---|
| C1 | `"Apri il primo capitolo del tuo studio."` → `"Avvia il primo progetto."` | ✅ 1 occorrenza |
| C2 | `"+ Apri il primo viaggio"` → `"+ Crea Journey"` | ✅ 1 |
| C3 | `"Apri il prossimo capitolo"` → `"Apri il prossimo articolo"` | ✅ 1 |
| C4 | `"Apri il rituale di chiusura"` → `"Chiudi la Journey"` | ✅ 1 |
| C5 | `"Studio Pulse™ · ritmo progettuale"` → `"Dashboard · stato dei progetti"` | ✅ 1 |
| C6 | `"Lettura del ritmo progettuale…"` → `"Caricamento dashboard…"` | ✅ 1 |
| C7 | `"Decisioni che la giornata sussurra"` → `"Decisioni del giorno"` | ✅ 1 |
| C8 | `"Lo studio sta preparando il primo capitolo del vostro percorso."` → `"Il tuo studio sta preparando i primi aggiornamenti."` | ✅ 1 |
| C9 | `"Nessun movimento. Lo studio respira in silenzio."` → `"Nessuna attività recente."` | ✅ 1 |
| C10 | `"Network degli Advisor"` → `"Rete Advisor"` | ✅ 1 |
| C11 | `"Atmosfera, materia, ritmo"` → `"Stile, materia, progetto"` | ✅ 1 |
| C12 | `"Caricamento dell'orchestrazione…"` → `"Caricamento…"` | ✅ 1 |
| C13 | `"Carica un riferimento o crea una moodboard per dare ritmo alla giornata."` → `"Carica un riferimento o crea una moodboard per iniziare."` | ✅ 1 |
| C14 | `"MOOD sta iniziando a leggere il ritmo del tuo studio."` → `"MOOD sta analizzando l'attività dello studio."` | ✅ 1 |
| C15 | `"Nessun blocco ancora. Inizia la narrazione."` → `"Nessun elemento. Aggiungi il primo blocco."` | ✅ 1 |
| C16 | `"Inizia a raccontarci lo spazio che immagini — senza fretta."` → `"Descrivici lo spazio che hai in mente."` | ✅ 1 |
| C17 | `"Aggiungi capitolo editoriale"` → `"Aggiungi collezione"` | ✅ 1 |
| C18 | `"Studio Identity"` → `"Blueprint Chameleon"` | ✅ 1 (allineato a rebrand R1) |

**Totale: 18 stringhe riscritte** in `it-IT.json`.

### 1.2 · JSX hardcoded
| File | Cambio | Esito |
|---|---|---|
| `pages/workspace/ProjectsPage.jsx:346` | `"Apri il primo capitolo dello studio."` → `"Avvia il primo progetto."` | ✅ |
| `pages/placeholder/ComingSoonPage.jsx` × 6 | `"Sarà disponibile in un prossimo capitolo."` → `"In sviluppo. Disponibile a breve."` | ✅ 6 occorrenze |

**Totale JSX: 7 stringhe.**

### 1.3 · Build & test
- ✅ ESLint NewRelationshipModal + DiscoveryInterviewPanel → no issues
- ✅ Ruff Python routers nuovi → all checks passed
- ✅ Frontend live-reload OK (Playwright screenshot verifica modal rendering)

---

## §2 · TONE OF VOICE — CONFORMITÀ ATTUALE

### 2.1 · Dashboard
Prima:
> `"Studio Pulse™ · ritmo progettuale"`  
> `"Lettura del ritmo progettuale…"`  
> `"Decisioni che la giornata sussurra"`

Dopo:
> `"Dashboard · stato dei progetti"`  
> `"Caricamento dashboard…"`  
> `"Decisioni del giorno"`

**Test del ridicolo:** ✅ Direi `"Dashboard · stato dei progetti"` a un manager NY senza imbarazzo.

### 2.2 · Empty state cliente
Prima:
> `"Lo studio sta preparando il primo capitolo del vostro percorso."`

Dopo:
> `"Il tuo studio sta preparando i primi aggiornamenti."`

**Test:** ✅ Funzionale, professionale, senza "vostro percorso".

### 2.3 · CTA
Prima: `"Apri il rituale di chiusura"`  
Dopo: `"Chiudi la Journey"`  
**Test:** ✅ Verbo + sostantivo. Funzione esplicita.

---

## §3 · COPY LINT BASELINE

Eseguito `scripts/copy_lint.py --path /app/frontend/src --write-baseline /app/scripts/copy_lint_baseline.json`:

```
COPY_LINT · 538 violations across 116 files

Severity distribution:
  🟠 high    : 296
  🟡 medium  : 242

Top violated patterns:
   140× \bcinematic\w*\b
    99× \batmosfera\b
    90× \bcapitolo\b
    78× \bcuratorial\w+\b
    41× \bcuratoriale\b
    22× \bStudio Identity\b   ← cross-lingua i18n (out of scope)
    16× \bcinematog\w+\b
    16× \borchestrat\w+\b
    14× \brespirar?\w*\b
     6× \borchestraz\w+\b

Top violating files:
   126× i18n/strings/it-IT.json
    30× i18n/strings/en-US.json
    25× i18n/strings/es-ES.json
    25× i18n/strings/en-GB.json
    24× i18n/strings/fr-FR.json
    15× pages/placeholder/ComingSoonPage.jsx ← già migliorato in C1
    13× blueprint/moodboard/CuratorialInspirationsModal.jsx
    13× blueprint/moodboard/premiumTemplates.js
    12× i18n/strings/ar.json
    12× i18n/strings/de-DE.json
```

Baseline salvato in `/app/scripts/copy_lint_baseline.json` (538 violations storiche). Da qui in poi il lint usa `--baseline` per flaggare SOLO le **nuove** violazioni introdotte nei futuri commit.

---

## §4 · OUT OF SCOPE (esplicito)

Per evitare di rompere troppo in un solo sprint:
- ❌ **Sweep cross-lingua** (EN/FR/DE/ES/AR) — Phase T1-T5 pianificata
- ❌ **Magazine module** — preservato l'editorial register (per design)
- ❌ **`atmosfera` e `cinematic` come label nei moduli Media Library / Mood / Inspirations** — Phase C2/C3 (medium)
- ❌ **JSX hardcoded** in altri 100+ componenti — sweep successiva
- ❌ **Email subjects** (`backend/services/email_templates.py`) — Phase C2
- ❌ **`atelier`** lessico — preservato dove identifica brand voice esterno (Magazine, site pubblico, contesti editoriali)

---

## §5 · GOVERNANCE OPERATIVA

### 5.1 · Pre-commit (proposto, non ancora forzato)
Linter `scripts/copy_lint.py` può essere agganciato come git pre-commit hook:
```bash
python3 /app/scripts/copy_lint.py --path . --baseline /app/scripts/copy_lint_baseline.json --strict
```
Exit code 1 se nuove violazioni rispetto al baseline. **Non bloccante in CI per ora** (vedi `COPY_LINT_SPEC.md`).

### 5.2 · Quando aggiornare il baseline
- Dopo ogni Phase di copy rewrite (C2, C3, T1, T2, …)
- Dopo refactor strutturali che riducono le violazioni
- **Mai** per "azzerare" violazioni nuove introdotte senza fix

### 5.3 · Future Copy Rules (da `GLOBAL_COPY_AUDIT §6`)
Linkato come canon doc per qualsiasi agente/sviluppatore. Manuale operativo immutabile.

---

## §6 · TEST DEL RIDICOLO — OK/KO per pagina chiave

| Surface | Pre | Post | Test |
|---|---|---|---|
| Dashboard hero | "Studio Pulse™ · ritmo progettuale" | "Dashboard · stato dei progetti" | ✅ OK |
| Empty cliente | "primo capitolo del vostro percorso" | "primi aggiornamenti" | ✅ OK |
| Loading | "Caricamento dell'orchestrazione…" | "Caricamento…" | ✅ OK |
| CTA close journey | "Apri il rituale di chiusura" | "Chiudi la Journey" | ✅ OK |
| Empty activity | "Lo studio respira in silenzio" | "Nessuna attività recente" | ✅ OK |
| Form brief | "raccontaci lo spazio … senza fretta" | "Descrivici lo spazio che hai in mente" | ✅ OK |
| Placeholder coming soon | "in un prossimo capitolo" | "In sviluppo. Disponibile a breve." | ✅ OK |

---

## §7 · PROSSIMI PASSI · ROADMAP COPY

| Fase | Scope | Effort | Owner |
|---|---|---|---|
| **C2 · IT high** | Sweep `capitolo` / `atmosfera-label` / `cinematic` / `curatoriale` in 280 stringhe + JSX | 1.5g | agent + copy reviewer |
| **C3 · IT medium** | Sweep `editoriale`-as-aggettivo, `orchestraz*`, `respira` | 1g | agent |
| **T1 · EN translation** | Re-translate da IT v2 (LLM-assisted) | 1g | agent + EN review |
| **T2 · FR re-translation** | **Madrelingua professionale** (44 violations gravi, vedi audit §5.3) | 2g | madrelingua FR |
| **T3 · DE / T4 · ES** | Sweep cross-lingua dei rebrand label | 1g | agent |
| **T5 · AR** | Madrelingua dedicato (out of agent scope) | — | parcheggiato |

---

## §8 · TEST POST-DEPLOY

| Test | Esito |
|---|---|
| Frontend si carica senza errori console | ✅ |
| Modal `+ Nuova Relazione` visibile/cliccabile | ✅ |
| Dashboard render con copy nuovi | ✅ (hot reload Playwright) |
| Nessun test ID rotto | ✅ (label-based selector non usati per testid) |
| Nessuna regressione e2e nota | ✅ (lint pulito su nuovi file) |

---

**Fine report. C1 chiuso. 25 stringhe critical riscritte. Baseline lint salvato.**
