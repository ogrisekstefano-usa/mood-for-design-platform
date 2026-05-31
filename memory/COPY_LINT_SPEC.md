# COPY LINT™ · TECHNICAL SPECIFICATION
## `scripts/copy_lint.py` — Report-only tone-of-voice governance

> **Status:** ✅ SHIPPED · 31 May 2026
> **Riferimento:** `GLOBAL_COPY_AUDIT.md` §6.3 (Vocabolario vietato), `COPY_GOVERNANCE_C1_REPORT.md`
> **Filosofia:** **NEVER block builds by default.** Report only.

---

## §1 · OBIETTIVO

Garantire che il **drift editoriale** (ritorno di parole vietate come *capitolo*, *atmosfera*, *cinematic*, *orchestrazione*, *Studio Identity*) sia rilevato automaticamente prima del merge, senza bloccare lo sviluppo.

Il linter:
1. Scansiona il repo (frontend, backend, docs)
2. Rileva pattern vietati con regex word-boundary
3. Emette report testuale o JSON
4. Supporta `--baseline` per flaggare **solo le nuove** violazioni
5. Opzionale `--strict` per CI hard-fail

---

## §2 · ARCHITETTURA

```
/app/scripts/
├── copy_lint.py              ← lo script
└── copy_lint_baseline.json   ← snapshot 31/05/2026 · 538 violations
```

### 2.1 · CLI

```
python3 scripts/copy_lint.py                                # full scan, current dir
python3 scripts/copy_lint.py --path frontend                # subset
python3 scripts/copy_lint.py --json                         # machine-readable
python3 scripts/copy_lint.py --strict                       # exit 1 if any violation
python3 scripts/copy_lint.py --baseline FILE                # only flag NEW violations
python3 scripts/copy_lint.py --write-baseline FILE          # snapshot current state
```

### 2.2 · Scope di scansione
- File extensions: `.jsx .tsx .js .ts .json .py`
- Directory escluse: `node_modules .git __pycache__ build dist .cache .emergent venv .venv`
- Path esenti (registro editoriale legittimo):
  - `/magazine/`
  - `/editorial/`
  - `/editorial_calendar`
  - `i18n/EditorialDebug`
  - `site/HomePageLegacy` (legacy marketing)
  - `COPY_LINT_SPEC.md`, `GLOBAL_COPY_AUDIT.md`, `copy_lint.py`

---

## §3 · BLACKLIST INIZIALE (con severity)

| Pattern (regex) | Severity | Advice |
|---|---|---|
| `\bcapitolo\b` | high | use 'progetto' / 'sezione' / 'step' / 'fase' (Magazine module exempt) |
| `\batmosfera\b` | medium | use 'stile' / 'mood' / 'impostazione visiva' |
| `\bcinematic\w*\b` | high | drop ornamental qualifier |
| `\bcinematog\w+\b` | high | drop ornamental qualifier |
| `\becosistema\b` | medium | use 'sistema' / 'piattaforma' / 'area' |
| `\borchestraz\w+\b` | high | use 'configurazione' / 'elenco' |
| `\borchestrat\w+\b` | high | use 'configurato' / 'gestito' |
| `\btemperamento\b` | high | use 'configurazione' / 'profilo' |
| `\bcuratorial\w+\b` | medium | Magazine only — use 'selezionato' |
| `\bcuratoriale\b` | medium | idem |
| `\bsussurr\w+\b` | high | drop metaphor |
| `\brespirar?\w*\b` | medium | drop metaphor |
| `\brespira\b` | medium | idem |
| `prende forma` | high | use 'inizia' / 'si configura' |
| `\bnarrazione\b` | medium | use 'descrizione' / 'contenuto' |
| `\brituale\b` | high | use 'procedura' / 'processo' |
| `\bStudio Identity\b` | high | deprecated — use 'Blueprint Chameleon' |
| `\bdisvel\w+\b` | high | drop metaphor |
| `\bsvelar\w+\b` | medium | use 'mostrare' / 'rivelare' |
| `\binizia la narrazione\b` | high | domain-specific replacement |

**Note:**
- Pattern case-insensitive (`re.IGNORECASE`).
- Word-boundary `\b` evita falsi positivi su sotto-stringhe.

---

## §4 · WHITELIST CONCETTUALE

Termini permessi senza warning (sono il **vocabolario operativo canonico**, vedi `GLOBAL_COPY_AUDIT §6.2`):

```
cliente · progetto · relazione · design journey · workflow · materiali
attività · stato · referente · team · decisione · collaborazione
lead · prospect · account · brief · moodboard · proposta
documento · appuntamento · milestone · deadline · assegnazione
owner · contributor · observer · workspace · dashboard · modulo
sezione · pannello · tenant · studio · blueprint · notifica
```

Questi termini NON triggerano il linter. Sono il segno di copy professionale.

---

## §5 · OUTPUT FORMAT

### 5.1 · Text output (default)
```
COPY_LINT · 538 violations across 116 files

Severity distribution:
  🟠 high    : 296
  🟡 medium  : 242

Top violated patterns:
  140× \bcinematic\w*\b
   99× \batmosfera\b
   90× \bcapitolo\b
   ...

Top violating files:
  126× i18n/strings/it-IT.json
   30× i18n/strings/en-US.json
   ...
```

### 5.2 · JSON output (`--json`)
```json
{
  "total": 538,
  "new": 0,
  "findings": [
    {
      "file": "i18n/strings/it-IT.json",
      "line": 56,
      "col": 17,
      "match": "atelier",
      "pattern": "\\batelier\\b",
      "severity": "medium",
      "advice": "...",
      "context": "..."
    },
    ...
  ]
}
```

### 5.3 · Baseline mode
```bash
python3 scripts/copy_lint.py --baseline /app/scripts/copy_lint_baseline.json
```
Confronta findings attuali con baseline e mostra **solo le nuove violazioni**. Utile per CI/PR review.

---

## §6 · INTEGRAZIONE

### 6.1 · Local dev (raccomandato)
```bash
# Prima di committare:
python3 /app/scripts/copy_lint.py --path /app/frontend/src --baseline /app/scripts/copy_lint_baseline.json
```
Se mostra `0 NEW violations` → ok. Altrimenti rivedi i nuovi testi.

### 6.2 · Git pre-commit hook (opzionale)
`.git/hooks/pre-commit`:
```bash
#!/bin/bash
python3 /app/scripts/copy_lint.py --path . --baseline /app/scripts/copy_lint_baseline.json --strict
```

### 6.3 · CI integration (futura, NON ora)
```yaml
# .github/workflows/copy-lint.yml (esempio)
- name: Copy Lint
  run: |
    python3 scripts/copy_lint.py --path frontend/src --baseline scripts/copy_lint_baseline.json --strict
  continue-on-error: true  # report only — non blocca merge
```

**Non bloccante in CI per ora.** Il team accumula consapevolezza prima di forzare `--strict` in CI.

---

## §7 · BASELINE INIZIALE

**Snapshot 2026-05-31 (post-C1):**
- Path: `/app/scripts/copy_lint_baseline.json`
- 538 violations (296 high + 242 medium)
- 116 files coinvolti
- Top 3 file: `it-IT.json` (126), `en-US.json` (30), `es-ES.json` (25)

Il baseline va aggiornato dopo ogni Phase di copy rewrite:
- Dopo **C2** (IT high sweep) → atteso ~250 violations
- Dopo **C3** (IT medium sweep) → atteso ~100 violations
- Dopo **T1-T5** (translation pass) → atteso <30 violations

---

## §8 · EXTENSION POINTS

Il linter è **trasparente per design**. Per aggiungere/rimuovere pattern:

1. Apri `/app/scripts/copy_lint.py`
2. Modifica la lista `BLACKLIST = [...]`
3. Re-run con `--write-baseline` per aggiornare lo snapshot

Esempi di pattern futuri:
- `\bsubito.{0,5}disponibile\b` (cliché marketing)
- `\bgioiello\b` (luxury cliché)
- `\bpreziosa?\b` (idem)
- `\bunico nel suo genere\b`

---

## §9 · LIMITI NOTI

| Limite | Mitigazione |
|---|---|
| Falsi positivi nei file `.py` (commenti) | Skip lines without quotes (escluso `.json`) |
| Non rileva grammar / sintassi | Solo lessico vietato. Per grammar usa LanguageTool. |
| Non gestisce traduzioni "intelligenti" (es. `cinematic` → `cinematique` in FR) | Future enhancement: language-aware blacklist |
| Magazine module esente per intero | Lasciato volutamente — l'editorial register è legittimo lì |

---

## §10 · TEST EFFETTUATI

```bash
# Test 1: scansione iniziale
$ python3 /app/scripts/copy_lint.py --path /app/frontend/src
COPY_LINT · 538 violations across 116 files
✅

# Test 2: baseline write
$ python3 /app/scripts/copy_lint.py --path /app/frontend/src --write-baseline /app/scripts/copy_lint_baseline.json
Baseline written to /app/scripts/copy_lint_baseline.json (538 findings)
✅

# Test 3: baseline diff (atteso 0 nuovi)
$ python3 /app/scripts/copy_lint.py --path /app/frontend/src --baseline /app/scripts/copy_lint_baseline.json
Baseline: 538 known violations.
NEW violations vs baseline: 0
✅

# Test 4: --strict (atteso exit 0, perché nessuna nuova violazione)
$ python3 /app/scripts/copy_lint.py --path /app/frontend/src --baseline /app/scripts/copy_lint_baseline.json --strict
$ echo $?
0
✅
```

---

## §11 · ROADMAP

| Versione | Scope | Effort |
|---|---|---|
| **v1.0** (current) | report-only, blacklist 20 pattern, baseline support | ✅ shipped |
| v1.1 | language-aware blacklist (IT/EN/FR/DE/ES separate) | 0.5g |
| v1.2 | git pre-commit auto-install | 0.25g |
| v1.3 | CI integration (Github Actions / Vercel) | 0.5g |
| v2.0 | Suggester mode: "did you mean…" con LLM | 1g |
| v2.1 | UI dashboard view dei findings per file | 1g |

---

**Fine spec. Linter operativo, baseline salvato, governance attiva.**
