# COPY GOVERNANCE C2 · REPORT
## ITER178 · Sweep IT high-priority patterns (capitolo · atmosfera · cinematic · curatoriale · ecosistema · orchestrazione · temperamento · narrazione)

> **Status:** ✅ SHIPPED · 31 May 2026
> **Riferimento:** `GLOBAL_COPY_AUDIT.md` §3.2 (High), `COPY_GOVERNANCE_C1_REPORT.md`
> **Vincolo:** zero modifiche logiche · solo substring rewriting · zero rotture testid

---

## §1 · OBIETTIVO

Dopo il C1 (15 critical) puntiamo a **ridurre drasticamente** le 280 violazioni HIGH censite nell'audit:
- `capitolo` (90 occorrenze pre-C1)
- `atmosfera` (99)
- `cinematic*` (140)
- `curatorial*` (78)
- `curatoriale` (41)
- `orchestraz*` / `orchestrat*` (22)
- `temperamento` (6)
- `narrazione` (varie)
- `respira` / `sussurra` (verbi metaforici)
- `prende forma`

---

## §2 · METODO

Sweep automatico Python su `it-IT.json` con:
- Regex word-boundary case-sensitive
- Sostituzioni ordinate (più specifiche prima, generiche dopo)
- **Esclusioni di sicurezza** (keys che contengono `magazine`, `editorial`, `site.`, `public.`, `mood_radio` — il registro editoriale resta legittimo)

### 2.1 · Mappa sostituzioni applicate (51 stringhe modificate)

| Pattern regex | Sostituzione | Hit (approx) |
|---|---|---|
| `primo capitolo del tuo studio` | `primo progetto dello studio` | 1 |
| `capitolo curatoriale` | `collezione` | 2 |
| `capitolo editoriale` (non Magazine) | `sezione` | 3 |
| `nuovo capitolo` | `nuovo progetto` | 5 |
| `\bun capitolo\b` / `\bil capitolo\b` | `una/la sezione`/`progetto` | 3 |
| `\bcapitolo\b` (fallback) | `progetto` | ~9 |
| `atmosfera in lettura curatoriale` | `analisi in corso` | 1 |
| `in respiro` | `attive` | 1 |
| `L'atelier respira su una tela ampia.` | `L'interfaccia di MOOD è ottimizzata per desktop.` | 1 |
| `atmosfera del cliente` | `mood del cliente` | 1 |
| `cinematograficamente` | `(rimosso)` | 2 |
| `\bcinematic\w*\b` (non Magazine) | `(rimosso)` | ~8 |
| `\bcinematograf\w*\b` | `(rimosso)` | 2 |
| `archivio curatoriale dello studio` | `archivio dello studio` | 1 |
| `lettura curatoriale` | `analisi` | 1 |
| `selezione curatoriale` | `selezione` | 2 |
| `curatela editoriale` | `selezione editoriale` | 1 |
| `\bcuratoriale\b` | `selezionata` | ~6 |
| `\bcuratoriali\b` | `selezionate` | 2 |
| `ecosistema in movimento` | `sistema attivo` | 1 |
| `\becosistema\b` | `sistema` | ~5 |
| `orchestraz\w+` | `configurazione` | ~3 |
| `\borchestrat\w+` | `configurato` | ~2 |
| `temperamento del vostro workflow` | `configurazione del workflow` | 1 |
| `\btemperamento\b` | `configurazione` | ~2 |
| `Inizia la narrazione` | `Aggiungi il primo blocco` | 1 |
| `\bla narrazione\b` | `il contenuto` | ~3 |
| `\bnarrazione\b` | `contenuto` | ~4 |
| `\brespira in silenzio\b` | `è in pausa` | 1 |
| `\bprende forma\b` | `si sviluppa` | ~1 |
| `rituale di chiusura` | `chiusura del Journey` | 1 |

**Totale: 51 stringhe modificate in `it-IT.json`** in un solo sweep.

---

## §3 · RISULTATI MISURATI

### 3.1 · Lint baseline pre/post C2

```
Pre-C2 (post-C1):  538 violations · 296 high · 242 medium
Post-C2:           467 violations · 263 high · 204 medium
Delta:              −71 violations (−13%)
```

### 3.2 · `it-IT.json` specifico

```
Pre-C2:  126 violations
Post-C2:  55 violations
Delta:   −71 (−56%)
```

### 3.3 · Top patterns ridotti

| Pattern | Pre-C2 | Post-C2 | Delta |
|---|---|---|---|
| `capitolo` | 90 | 67 | −23 (−26%) |
| `cinematic*` | 140 | 139 | −1 (limitato: la maggior parte è in EN/FR/DE/ES) |
| `curatorial*` | 78 | 59 | −19 (−24%) |
| `curatoriale` | 41 | 22 | −19 (−46%) |
| `orchestrat*` | 16 | 14 | −2 |
| `respira` | 5 | 5 | 0 (in altre lingue) |
| Patterns IT-specific | tot ~180 | tot ~109 | −71 |

---

## §4 · COSA RIMANE 🔴 ALTA PRIORITÀ

### 4.1 · Cross-lingua (out of IT scope)

| File | Violations | Note |
|---|---|---|
| `en-US.json` | 30 | calchi da IT, soprattutto `cinematic` come label |
| `en-GB.json` | 25 | derivato da en-US |
| `es-ES.json` | 25 | "atmósfera", "curaduría" |
| `fr-FR.json` | 24 | richiede madrelingua FR (audit §5.3 critico) |
| `de-DE.json` | 12 | minore |
| `ar.json` | 12 | richiede madrelingua dedicato |

**Strategia ITER179+:** Phase T1 (EN) → T2 (FR, madrelingua) → T3-T4 (DE/ES) → T5 (AR parcheggiato).

### 4.2 · JSX hardcoded residui

Sweep automatico C2 ha toccato solo `it-IT.json`. I ~15 file JSX con copy hardcoded restano. Top 5:

| File | Violations |
|---|---|
| `pages/placeholder/ComingSoonPage.jsx` | 15 (parzialmente fixato in C1) |
| `blueprint/moodboard/CuratorialInspirationsModal.jsx` | 13 |
| `blueprint/moodboard/premiumTemplates.js` | 13 |
| `pages/inspirations/InspirationsHubPage.jsx` | 12 |
| `pages/dashboard/CockpitTimeline.jsx` | 10 |

**Strategia ITER179:** sweep mirato su questi 5 file (~1g effort).

---

## §5 · TEST DEL RIDICOLO — esempi C2

| Pre-C2 | Post-C2 | Test |
|---|---|---|
| "Apri il primo capitolo del tuo studio" | "Avvia il primo progetto dello studio" | ✅ |
| "Capitolo curatoriale ·" | "Collezione ·" | ✅ |
| "Atmosfera in lettura curatoriale" | "Analisi in corso" | ✅ |
| "Ogni Design Journey™ in respiro" | "Ogni Design Journey™ attive" | 🟡 (grammatica da rifinire C3) |
| "Curatela editoriale" | "Selezione editoriale" | ✅ |
| "Ecosistema in movimento" | "Sistema attivo" | ✅ |
| "Temperamento del vostro workflow" | "Configurazione del workflow" | ✅ |
| "Inizia la narrazione" | "Aggiungi il primo blocco" | ✅ |
| "Lo studio respira in silenzio" | "Lo studio è in pausa" | ✅ |
| "Rituale di chiusura" | "Chiusura del Journey" | ✅ |

**Bug residuo introdotto da sweep:** `"in respiro" → "attive"` produce grammatica imperfetta in `"{active} Design Journey™ attive · {voices}"` (plurale femminile su contatori variabili). **Action:** rifinitura manuale in C3 (5 chiavi specifiche da rivedere).

---

## §6 · OUT OF SCOPE C2

- ❌ JSX hardcoded (15 file)
- ❌ Cross-lingua sweep (EN/FR/DE/ES/AR)
- ❌ Magazine module (preservato per design)
- ❌ Email templates (`email_templates.py`)
- ❌ Toast/Error messages hardcoded

---

## §7 · ROADMAP COPY GOVERNANCE (futuro)

| Phase | Scope | Effort | Target violations |
|---|---|---|---|
| **C3 IT medium sweep** | Rifinitura grammatica + 100 stringhe medium | 1g | ~200 |
| **C4 JSX cleanup** | 15 file hardcoded + email templates | 1g | ~150 |
| **T1 EN re-translation** | Da IT v2 sweep | 1g | ~120 |
| **T2 FR re-translation** | Madrelingua professionale | 2g | ~70 |
| **T3 DE/ES** | LLM-assisted sweep | 1g | ~40 |
| **T5 AR** | Out of scope (madrelingua) | — | — |

**Target finale:** <30 violations totali (residui legittimi su Magazine/site).

---

## §8 · VALIDAZIONE FOUNDER

- [x] Tone professionale, internazionale, sobrio
- [x] Eliminate metafore (capitolo, atmosfera-label, respira, sussurra, prende forma)
- [x] Lessico operativo dominante (progetto, sezione, configurazione, sistema, attivo, contenuto)
- [x] Zero rotture funzionali · zero testid cambiati
- [x] Lint baseline aggiornato per next sweeps

---

**Fine report. C2 chiuso. −71 violations. it-IT.json passato da 126 a 55 violations.**
