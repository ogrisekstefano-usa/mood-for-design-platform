# CLIENT DESIGN JOURNEY™ · HISTORY OF GENERATIONS
## ITER172 · Conservazione storica pre-consolidamento

> **Status:** 🔒 ARCHIVE · 30 May 2026
> **Scope:** documento storico delle 3 generazioni del Client Workspace
> precedenti alla promozione di Gen 3 (Atelier) come V1 canonica.
> **Filosofia:** FROZEN (come Advisor Network™ ITER172) — il codice resta
> sul filesystem in `snapshots/`, le pagine restano archiviate ma non
> mountate, recuperabili in qualunque momento.

---

## INDICE

1. [Gen 1 · ClientOverviewPage](#gen-1--clientoverviewpage)
2. [Gen 2 · ClientCompanionPage](#gen-2--clientcompanionpage)
3. [Gen 3 · AtelierWelcomePanel](#gen-3--atelierwelcomepanel)
4. [Decisione di consolidamento](#decisione-di-consolidamento)

---

## GEN 1 · ClientOverviewPage

| Campo | Valore |
|---|---|
| **Iterazione** | ~iter 120-130 (origine pre-iter140) |
| **Nome** | "Client Portal · Overview" |
| **Route storica** | `/client` (oggi: `/client/overview-legacy`) |
| **File sorgente** | `pages/client/ClientOverviewPage.jsx` (258 righe) |
| **Snapshot archiviato** | [`snapshots/gen1-ClientOverviewPage.jsx`](./snapshots/gen1-ClientOverviewPage.jsx) |
| **Endpoint** | `GET /api/client/overview` (con `zero_data` flag) |
| **Componenti chiave** | `ClientWelcomeHero` · `ClientHumanCard` · `HowItWorksSection` · `WhatYouWillFindSection` · `ProjectProgressTracker` · `CallBookingModal` · `DesignDirectionPanel` |

### Motivazione introduzione
Prima superficie cliente. Implementava un dual-mode classico SaaS:
1. **ZERO-DATA** → cinematic welcome con hero + "How it works" + "What you will find"
2. **HAS-DATA** → project hero card + ProjectProgressTracker + cards (approvals, moodboards, files)

Lessico: "Client Portal" · "Overview" · "Projects".

### Motivazione dismissione
- **Lessico SaaS** ("portal", "overview", "tracker") non coerente con la
  visione narrativa di MOOD for DESIGN.
- **Dual-mode** introdotto bias UX: la stessa entità (`/client`) cambiava
  faccia drasticamente, frustrando il design system.
- **`CallBookingModal`** SaaS-style (slot calendar) sostituito da
  `RecallRequestModal` relazionale ("Possiamo sentirci…").
- `ClientHumanCard` e `ProjectProgressTracker` sostituiti da
  `AtelierReferenceCard` e `AtelierTimeline` con linguaggio editoriale.

### Posizione attuale (post-ITER172)
- Route `/client/overview-legacy` viene **rimossa**.
- File `ClientOverviewPage.jsx` conservato in repo con marker `ITER172 · FROZEN`.
- Componenti orfani: `ClientWelcomeHero`, `ClientHumanCard`, `HowItWorksSection`,
  `WhatYouWillFindSection`, `ProjectProgressTracker`, `CallBookingModal`,
  `ClientWelcomePanel`, `CuratorialTeamCluster`, `ClientStubPages` →
  preservati senza mount, recuperabili.

---

## GEN 2 · ClientCompanionPage

| Campo | Valore |
|---|---|
| **Iterazione** | Sprint G.7 · iter ~155 |
| **Nome** | "Design Journey Companion Experience™" |
| **Route storica** | `/client/journey/:journeyId` (oggi: anche `/journey/:journeyId` via canonical alias) |
| **File sorgente** | `pages/client/ClientCompanionPage.jsx` (544 righe) |
| **Snapshot archiviato** | [`snapshots/gen2-ClientCompanionPage.jsx`](./snapshots/gen2-ClientCompanionPage.jsx) |
| **Endpoint** | `GET /api/client/journeys/{jid}/companion` |
| **Componenti chiave** | `CompanionHero` · `ActiveChapterSection` · `SharedDirectionsSection` · `ConversationsSection` · `EvolutionSection` · `MaterialsSection` · `SiteEvolutionSection` · `MemoryArchiveSection` · `DossierSection` |

### Struttura · 7 sezioni narrative anchor-based
```
#capitolo       — Active Chapter™
#direzioni      — Shared Directions™
#conversazioni  — Conversations™
#evoluzione     — Evolution Timeline™
#materia        — Materials & Atmospheres™
#cantiere       — Site Evolution™
#memoria        — Memory & Archive™
```
+ sidebar 7-voci (`ClientSidebar`) con anchor jump in-page.

### Motivazione introduzione
Risposta diretta alla critica di Gen 1: "non sembra un Design Journey™".
Sprint G.7 introdusse un linguaggio **narrativo curatoriale** dove ogni
sezione racconta un capitolo del percorso progettuale, anchor-based, con
copy editoriale + voce libera (`SharedVoiceComposer`) per ogni capitolo
attivo.

### Motivazione dismissione
- **Densità eccessiva**: 7 sezioni full-height intimidiscono al primo
  ingresso del cliente.
- **Lessico interno**: termini come "Active Chapter™", "Shared Directions™",
  "Memory & Archive™" sono comprensibili agli operatori interni ma
  ostacolano la comprensione del cliente finale (success criteria: capire
  in 10 secondi dove si è).
- **Manca focus operativo**: nessuna CTA prominente verso le 3 azioni
  primarie del cliente (continuare il brief, fissare una call, scrivere al
  referente). Tutto è narrazione, niente è invito all'azione.
- **Sidebar 7-voci** con anchor jump è una UX-pattern SaaS che reintroduce
  il problema risolto da Gen 1 (overload cognitivo).

### Posizione attuale (post-ITER172)
- Route `/journey/:jid` reindirizzata a Gen 3 (Atelier).
- Route `/client/journey/:journeyId` reindirizzata a `/journey/:jid`.
- File `ClientCompanionPage.jsx` conservato con marker `ITER172 · FROZEN`.
- Componenti `DossierSection`, `SiteEvolutionSection`, `SharedVoiceComposer`
  conservati: **potranno tornare in Phase 2 come sezioni opzionali** dentro
  Atelier una volta che il cliente sarà in fase avanzata del journey
  (post-Brief Guidato™).

---

## GEN 3 · AtelierWelcomePanel · 🏆 PROMOSSA A V1

| Campo | Valore |
|---|---|
| **Iterazione** | ITER162 · Atelier Preset |
| **Nome** | "Client Design Journey™ V1" (canonical post-ITER172) |
| **Route canonica** | `/journey/:jid` (e `/client/welcome` come alias di risoluzione) |
| **File sorgente** | `presets/client-profile/atelier/AtelierWelcomePanel.jsx` (96 righe wrapper) |
| **Snapshot archiviato** | [`snapshots/gen3-AtelierWelcomePanel.jsx`](./snapshots/gen3-AtelierWelcomePanel.jsx) |
| **Wrapper di routing** | `pages/client/ClientWelcomePresetPage.jsx` |
| **Preset engine** | `presets/client-profile/presetEngine.js` (resolveClientProfilePreset) |
| **Endpoint** | `GET /api/client/welcome-summary` + `GET /api/client/profile-config` |
| **View model puro** | `presets/client-profile/atelier/atelierViewModel.js` |

### Layout three-column cinematic
```
┌────────┬─────────────────────────────────────┬─────────────────┐
│ SX     │  TOPBAR · Studio name + 🔔 + 👤    │                 │
│ Side   ├─────────────────────────────────────┤  AtelierRef-    │
│ -bar   │  AtelierHero                        │  Card           │
│ narrat │  AtelierQuickSummary                │                 │
│ iva    │  ↑ ITER172: mode="text-only" def    │  Atelier-       │
│        │                                     │  ActionPanel    │
│        │                                     │  · Brief™       │
│        │                                     │  · Messaggi     │
│        │                                     │  · Possiamo     │
│        │                                     │    sentirci?    │
│        ├─────────────────────────────────────┴─────────────────┤
│        │  AtelierTimeline · AtelierNextStep                    │
│        └───────────────────────────────────────────────────────┘
│ Discreet bottom-right: AtelierPasswordPrompt
```

### Componenti Atelier
| Componente | Linee | Ruolo |
|---|---|---|
| `AtelierWelcomePanel.jsx` | 96 | layout shell three-column |
| `AtelierSidebar.jsx` | – | sidebar narrativa cliente + referente |
| `AtelierHero.jsx` | – | hero con cover + quote editoriale |
| `AtelierQuickSummary.jsx` | 59 | riassunto prime indicazioni (ITER172: `mode="text-only"`) |
| `AtelierReferenceCard.jsx` | – | card referente con foto + nome + ruolo |
| `AtelierActionPanel.jsx` | 78 | 3 CTA principali |
| `AtelierTimeline.jsx` | – | timeline cinematic 5-step |
| `AtelierNextStep.jsx` | – | prossimo capitolo |
| `AtelierPasswordPrompt.jsx` | – | floating discreet per password setup |
| `AtelierNotifications.jsx` | – | topbar bell |
| `AtelierUserMenu.jsx` | 363 | topbar avatar |
| `atelierViewModel.js` | – | mapping puro `/welcome-summary` → view model |
| `atelier.css` | – | tokens visuali three-column luxury |

### Motivazione introduzione
- Risposta a "Gen 2 è troppo narrativa, perdo il focus operativo".
- Three-column layout: sx sidebar narrativa (chi sei, chi ti segue) ·
  mid hero + summary (cosa abbiamo letto del tuo brief) · dx referente +
  3 CTA (cosa fare ora).
- Preset engine pronto per varianti future (Axis, Gallery, Residence) senza
  duplicare codice.
- View model **puro**: dati derivano da un solo endpoint
  (`/api/client/welcome-summary`).
- Lessico editoriale: "Cosa vuoi fare ora?" · "Possiamo sentirci?" ·
  "Scrivi al tuo referente" — mai SaaS.

### Estensioni ITER172 (consolidamento)
1. **`AtelierQuickSummary` ottiene `mode="text-only"` come default** —
   le foto stock di AtmosphericPanels diventano opzionali, attivabili
   solo quando esistono moodboard/materiali/contenuti reali.
2. **`AtelierActionPanel` CTA primaria "Continua il brief guidato"**
   ora punta a `/journey/:jid/brief` (pagina dedicata, non drawer).
3. **Brief Guidato™** è una pagina nuova (`BriefGuidedPage.jsx`),
   unica superficie autenticamente nuova autorizzata in ITER172.
4. **`/journey/:jid`** diventa canonical: monta direttamente
   `ClientWelcomePresetPage`/`AtelierWelcomePanel` (precedentemente
   montava `ClientCompanionPage` Gen 2).
5. **`/client/journey/:journeyId`** reindirizzato a `/journey/:journeyId`.

---

## Decisione di consolidamento

### Approvazione utente · 30 May 2026

| Decisione | Status | Note |
|---|---|---|
| **D1** Promuovere Gen 3 (Atelier) → V1 | ✅ APPROVATA | preserva il 90% del lavoro |
| **D2** `/journey/:jid` canonical, `/client/welcome` redirect | ✅ APPROVATA | single source of truth |
| **D3** Atmospheric Panels opzionali, default `text-only` | ✅ APPROVATA | immagini solo da contenuti reali |
| **D4** Brief Guidato™ pagina dedicata `/journey/:jid/brief` | ✅ APPROVATA | non drawer, non modal |

### Principio guida
> **Prima consolidare. Poi evoluzione. Mai una quarta UX.**
>
> Le 3 generazioni rappresentano il percorso evolutivo della
> comprensione del bisogno cliente. Gen 1 ha insegnato "non SaaS".
> Gen 2 ha insegnato "narrazione coerente". Gen 3 ha insegnato
> "narrazione + operativo + un solo riferimento".
> Tutte e tre hanno valore archivistico. Solo Gen 3 vive in produzione.

### Recupero futuro
Se mai servisse riattivare una generazione precedente:
```bash
# 1. Trovare i marker FROZEN
grep -rn "ITER172 · FROZEN" /app/frontend/src/pages/client/

# 2. Ripristinare le route in App.js (decommentare le righe sotto il marker)
# 3. Eseguire smoke test
# 4. Documentare la riattivazione in PRD.md
```

Nessuna migrazione DB richiesta. Tutti gli endpoint backend continuano a
servire tutte le UI (Gen 1/2/3 condividevano gli stessi endpoint).

---

## Allegati

- 📂 `snapshots/gen1-ClientOverviewPage.jsx` · sorgente integrale Gen 1
- 📂 `snapshots/gen2-ClientCompanionPage.jsx` · sorgente integrale Gen 2
- 📂 `snapshots/gen3-AtelierWelcomePanel.jsx` · sorgente integrale Gen 3
- 📄 [CLIENT_DESIGN_JOURNEY_AUDIT.md](../CLIENT_DESIGN_JOURNEY_AUDIT.md) · audit pre-consolidamento

> ℹ️ Note metodologica: gli screenshot live delle 3 UI non sono stati
> generati per ITER172 perché richiederebbero un consumo magic-link
> automatizzato (workflow Supabase). Gli snapshot di codice sono più
> resilienti — riproducono al 100% l'UI rendendo i file in dev.
