# KE-002 · Knowledge Engine Control Room™ — Visual Review Report

> **Scope** · Valutazione di percezione, comprensione, chiarezza e valore commerciale del lavoro consegnato in KE-002 prima di autorizzare KE-003 / KE-004.
> **Soggetto** · Sprint KE-002 (Mission Control panel on Catalog Set Workspace).
> **Brand di riferimento** · **RIVA1920** · Catalog Set "Master Library" · 12 PDF · 1.623 pagine totali · stato attuale `needs_review` (7 review · 4 failed · 1 pending).
> **Persona** · Produttore italiano di arredamento / illuminazione / superfici · primo accesso post upload cataloghi.
> **Data** · 06 Giugno 2026 · sessione `iteration 212`.
> **Asset visivi** · `/app/memory/ke002_screenshots/`.

---

## 1 · ASSET PRODOTTI

### 1.1 Desktop (1920×1080)

| # | File | Cosa mostra |
|---|------|-------------|
| 01 | `01_desktop_full.png` | Pagina catalog set workspace · full page · scroll completo |
| 02 | `02_desktop_viewport.png` | Above-the-fold con Master Library header + Upload PDF |
| 03 | `03_desktop_controlroom_inview.png` | Control Room scrollato in vista · tutti gli 5 sub-component visibili |
| 04 | `04_desktop_controlroom_only.png` | Solo `[data-testid="ke-cr-root"]` isolato (header → KPI → 2 col → Doc Queue) |
| 05 | `05_desktop_document_queue.png` | Document Queue zoom · 12 documenti RIVA1920 con OPEN / REVIEW / RETRY |

### 1.2 Mobile (414×900) e Tablet (768×1024)

| # | File | Cosa mostra |
|---|------|-------------|
| 06 | `06_mobile_full.png` | **GATING PAGE** — "Blueprint Atelier · Disegnato per la postazione di studio · Tela consigliata: da 1280 px in su" |
| 07 | `07_mobile_viewport.png` | Idem · above the fold |
| 15 | `15_tablet_full.png` | Tablet 768px · UI accessibile ma compressa |

> **NOTA CRITICA · MOBILE** · Il Control Room **non è raggiungibile** da viewport <1280px. La piattaforma forza un blocco editoriale "torna alla postazione di studio". Decisione UX coerente con un tool da scrivania ma da esplicitare nel posizionamento commerciale.

### 1.3 Stati Worker (mock via Playwright route interception)

> Gli stati `ACTIVE`, `STALLED`, `STALLED · RECOVERY`, `CERTIFIED`, `FAILED` non sono naturalmente presenti su RIVA1920 (che è in `REVIEW REQUIRED`). Sono stati renderizzati intercettando l'endpoint `/worker-status` con payload realistici per validare la pipeline visiva delle pill.

| # | File | Stato | Pill testid |
|---|------|-------|-------------|
| 10 | `10_state_active.png` | **ACTIVE** · estrazione in corso (CEDRO-1, pag. 87/194, ETA 3 min) | `ke-cr-state-active` |
| 11 | `11_state_stalled.png` | **STALLED** · nessun progresso da 142s (NOTTE pag. 42/138) | `ke-cr-state-stalled` |
| 12 | `12_state_stalled_recovery.png` | **STALLED · RECOVERY** · nuovo worker `pod-9:f8e1` ripreso | `ke-cr-state-stalled_recovery` |
| 13 | `13_state_certified.png` | **CERTIFIED** · 12 documenti validati · CTA Launchpad visibile | `ke-cr-state-certified` |
| 14 | `14_state_failed.png` | **FAILED** · "OCR service timeout dopo 5 retries" · CTA Riprova falliti | `ke-cr-state-failed` |

### 1.4 REVIEW REQUIRED (stato reale RIVA1920)

| Cattura | Contenuto |
|---------|-----------|
| `03_desktop_controlroom_inview.png` + `04_desktop_controlroom_only.png` | Pill **REVIEW REQUIRED** · copy "Ambiguità da risolvere prima della certificazione" · Queue summary inline "0 pending · 1 active · 4 failed · 7 review" · Warning Center con solo `Documenti falliti = 4` populated · CTA "APRI REVIEW WORKSPACE™ (4)" · Live Stream con 20 eventi reali (timestamp 02:47-03:14) |

---

## 2 · WALKTHROUGH PRODUTTORE — Scenario RIVA1920

### STEP 1 · Carico cataloghi

**Cosa accade.** Il produttore atterra su `/inspirations/knowledge-engine/catalog-sets/{setId}`. La parte alta dello schermo (cattura `02_desktop_viewport.png`) presenta in ordine:
- header "Master Library" con pill `DA VALIDARE` · "12 PDF · 1623 pagine totali"
- Sezione 1: dropzone "Trascina i PDF qui · fino a 50 PDF in un singolo batch"
- 12 card documento già caricati con pill stato (`PRONTO PER LA REVIEW` / `NECESSITA CONTROLLO` / `ESTRAZIONE`)

**Commento.** ✅ Buono. Il sense-of-place è chiaro: stai gestendo la libreria documentale di un brand. ⚠️ Manca però una "pre-CTA": nessun copy che dica al produttore "carica almeno X PDF per attivare l'analisi automatica". L'upload è solo un'azione, non un invito.

### STEP 2 · Knowledge Engine attivo

**Cosa accade.** Scrollando si entra nel Control Room (cattura `04_desktop_controlroom_only.png`). Il primo elemento visibile è:
- **Worker Status Bar** · pill colorata `REVIEW REQUIRED` + copy + Queue summary inline.
- Subito sotto: **KPI Strip** · 6 celle (Prodotti, Designer, Materiali, Immagini, Relazioni, Brand Alias) con valore e delta.

**Commento.** ⚠️ **PROBLEMA CRITICO #1**. Sulle 6 celle KPI **tutti i valori sono `0` · tutte le delta sono `·`**. Per un produttore che ha appena caricato 12 cataloghi e 1.623 pagine, vedere "0 prodotti · 0 designer · 0 materiali" trasmette un messaggio devastante: **"il sistema non ha trovato nulla"** — l'opposto del valore promesso. La causa tecnica è che `validation_summary` non è ancora aggregato sui contatori reali di `brand_detected_entities`, ma l'effetto percettivo è "engine vuoto".

### STEP 3 · Il sistema identifica prodotti, designer, materiali, immagini

**Cosa accade.** Il Live Activity Stream (colonna sinistra, cattura `04_*.png`) elenca 20 eventi reali:
```
03:14:05  DOC  Document started: Riva1920_Outdoor-2024
03:14:05  DOC  Document completed: RIVA1920_If It's Real Wood, It Lasts Forever
03:10:55  DOC  Document started: RIVA1920_If It's Real Wood, It Lasts Forever
03:10:55  DOC  Document completed: Riva1920_FoodWine_2025
...
```

**Commento.** ⚠️ **PROBLEMA CRITICO #2**. Tutti gli eventi mostrati sono **operazionali** (`Document started` / `Document completed`) — sono log di pipeline, **non eventi di valore**. Il backend supporta event types specifici (`IMAGE_FOUND`, `PRODUCT_FOUND`, `DESIGNER_FOUND`, `MATERIAL_FOUND`, `BRAND_ALIAS_FOUND`, `RELATION_FOUND`) ma il publisher attualmente emette **solo** `DOCUMENT_STARTED` / `DOCUMENT_COMPLETED`. Risultato: il produttore vede una specie di "cron log" anziché un flusso che dichiara cosa è stato scoperto. Una riga come `"03:14:05 · PROD · Identificato: Tavolo Cleopatra (C.R. & S. Riva 1920) · pag. 47 cat. NOTTE"` sarebbe un colpo di teatro. Oggi non c'è.

### STEP 4 · Compaiono warning

**Cosa accade.** Warning Center colonna destra (cattura `04_*.png`):

| Categoria | Count |
|---|---|
| Designer ambigui | 0 |
| Materiali ambigui | 0 |
| Brand duplicati | 0 |
| Prodotti sconosciuti | 0 |
| Immagini senza match | 0 |
| Confidence < 60% | 0 |
| **Documenti falliti** | **4** |

CTA finale: `APRI REVIEW WORKSPACE™ (4) →`.

**Commento.** ⚠️ **PROBLEMA CRITICO #3**. Sei categorie su sette sono a zero. È implausibile che 1.623 pagine non producano alcun designer ambiguo, alcun materiale ambiguo, alcuna confidence < 60%. Significa che:
- (a) la classificazione delle anomalie non è ancora distribuita sulle 7 categorie semantiche (probabilmente tutto cade in `failed_document`); oppure
- (b) gli `extraction_anomalies` per RIVA1920 non sono mai stati popolati nel detail.

Effetto percettivo: il produttore non capisce **cosa** deve correggere. Vede solo "4 documenti falliti", che è un problema tecnico, non semantico. Il messaggio commerciale che doveva passare ("la tua libreria contiene N ambiguità che minano il Knowledge Package") non passa.

✅ **Positivo**: la CTA "APRI REVIEW WORKSPACE™ (4)" è ben visibile (cyan/teal su sfondo cupo), il contatore tra parentesi crea urgenza. Il design del bottone è coerente con la palette Blueprint Chameleon.

### STEP 5 · Entro nel Review Workspace

**Cosa accade.** Il bottone scrolla la pagina al `[data-testid="rw-v3-root"]` (sezione 3 sotto il Control Room). Lo `scrollIntoView` è smooth e funzionale.

**Commento.** ✅ Il "ponte" Control Room → Review Workspace V3 esiste. ⚠️ Ma non c'è transizione visiva (highlight, pulse, narrative bridge "stai per certificare 4 documenti"). Lo scroll arriva al Review Workspace V3.1, che è una vista separata già esistente. KE-003 (polish) dovrà rinforzare questa transizione.

### STEP 6 · Certifico il Brand Knowledge Package™

**Cosa accade.** Solo quando lo stato passa a `certified`, il Worker Status Bar mostra (cattura `13_state_certified.png`):
- pill verde **CERTIFIED**
- copy "Brand Knowledge Package certificato"
- CTA "🚀 Launchpad"

**Commento.** ✅ La metafora del "Launchpad" è forte e coerente con l'idea che la certificazione apre l'ecosistema (Moodboard, Design Journey, Brand Atlas). ⚠️ Ma manca **completamente** un riepilogo post-certificazione nel Control Room: "Hai certificato 142 prodotti, 23 designer, 89 materiali → ora disponibili in 3 design journey e 12 moodboard". Il salto da "CERTIFIED" a "Launchpad" è meccanico, non epico.

---

## 3 · AUDIT UX — 6 DOMANDE

| # | Domanda | Risposta | Evidenza |
|---|---------|----------|----------|
| 1 | In meno di 10s capisce che il sistema è vivo? | **SÌ** | Pill colorata animata, Live Stream con timestamp recenti, Queue summary numerica. `04_*.png` |
| 2 | Capisce cosa sta succedendo? | **PARZIALMENTE** | Capisce che ci sono 4 documenti falliti e che servono review. Non capisce *perché* (causa tecnica vs semantica) né *cosa* è stato estratto fino a ora. KPI a zero confonde. |
| 3 | Capisce perché alcuni elementi richiedono review? | **NO** | 6 warning su 7 sono a zero; tutto è collassato su "Documenti falliti". Non c'è una storia ("designer Mario Rossi compare in 4 cataloghi con grafia diversa"). |
| 4 | Capisce cosa deve fare dopo? | **SÌ (debole)** | CTA "APRI REVIEW WORKSPACE™ (4)" + pulsanti per-row "Retry" sui falliti. Action set chiaro, ma poco narrativo. |
| 5 | Capisce il valore economico di costruire il Knowledge Package? | **NO** | Zero comunicazione di ROI. Nessuna riga del tipo "Le entità validate alimenteranno N Moodboard / M Design Journey / X Brand Atlas". L'utente vede un task queue, non un investimento. |
| 6 | Sembra una Control Room o una dashboard amministrativa? | **MISSION CONTROL TECNICO** | L'estetica c'è (dark, glassmorphism leggero, pill semaforico, KPI strip), ma il **contenuto** è log-pipeline. Tecnicamente premium, semanticamente operativo. Linear-adjacent ma non emozionale. |

**Sintesi punteggio percettivo** (1-5):

| Asse | Voto | Note |
|---|---|---|
| Estetica / Cromia / Glassmorphism | **4.5 / 5** | Coerente con Blueprint Chameleon. Nessuna fuga da "AI slop". |
| Architettura informazione | **4 / 5** | 5 sub-component ben separati, gerarchia chiara. |
| Comunicazione del valore | **2 / 5** | KPI a zero, eventi solo operazionali, warning collassati. |
| Senso di vita / "system is alive" | **4 / 5** | Polling 2s, Live Stream popolato, pill animata. |
| Storytelling Brand Knowledge Package | **1.5 / 5** | Manca il "perché". Manca il "cosa stai costruendo". |
| Affordance azioni successive | **4 / 5** | OPEN / REVIEW / RETRY per riga, CTA principale ben evidente. |

**Totale** = **20 / 30** = soglia tecnica ottima, soglia commerciale insufficiente.

---

## 4 · GAP RILEVATI — Da chiudere prima di KE-003

| # | Gap | Severità | Fix proposto (high level, NO sviluppo ora) |
|---|---|---|---|
| G1 | KPI strip a zero su catalog set con 1.623 pagine | 🔴 P0 | Wire `validation_summary` su counts reali da `brand_detected_entities` per `catalog_set_id`. |
| G2 | Live Stream emette solo `DOCUMENT_*` eventi | 🔴 P0 | Estendere `extraction_event_publisher` per emettere `PRODUCT_FOUND`, `DESIGNER_FOUND`, `MATERIAL_FOUND`, `IMAGE_FOUND` (event types già definiti in `KIND_LABEL` ma mai prodotti). |
| G3 | Warning Center: 6/7 categorie a zero | 🔴 P0 | Popolare le 7 classi semantiche su `extraction_anomalies` o derivare le 6 categorie da query reali su `brand_detected_entities` con confidence/ambiguity flags. |
| G4 | Nessun "Knowledge Impact" preview prima della certificazione | 🟡 P1 | Aggiungere card riassuntiva: "Validare queste 4 entità sbloccherà X Moodboard, Y Design Journey, Z Brand Atlas". |
| G5 | Post-certificazione: nessun riepilogo "Knowledge Package shipped" | 🟡 P1 | Quando `state=certified`, sostituire KPI strip con un blocco "Hai certificato N entità · Vai al Launchpad". |
| G6 | Mobile completamente gated | 🟢 P2 | OK come decisione editoriale, ma esplicitarlo nel posizionamento ("tool da postazione di studio"). |
| G7 | Stream eventi: nessuna iconografia per kind | 🟢 P2 | I tag `DOC` / `JOB` / `IMG` / `PROD` sono testuali. Sostituire con micro-icons lucid-react. |

---

## 5 · CLASSIFICAZIONE

### 🟡 **NEEDS_ITERATION**

**Razionale.** Il Control Room **passa** su tutti gli assi tecnici (stato semantico, polling, recovery, queue, retry, scroll bridge). **Non passa** su tre assi narrativi cruciali:

1. **KPI a zero** → comunica "engine vuoto" su un set che ha 1.623 pagine. Devastante per il primo impatto.
2. **Live Stream solo operazionale** → comunica "task queue", non "scoperta di valore". Il backend supporta già event kinds semantici (PRODUCT_FOUND, DESIGNER_FOUND...) ma non vengono emessi.
3. **Warning Center collassato** → 6/7 categorie a zero · l'unico segnale è "documenti falliti", che è una metrica tecnica, non semantica.

Per un produttore di arredamento, questi tre punti **annullano** la percezione di "engine che costruisce un Brand Atlas". La macchina sembra accesa ma non sembra produrre valore visibile.

### ✅ Cosa è già **READY**

- Architettura del componente (5 sub-component coerenti, separati, testabili).
- Estetica Blueprint Chameleon™ rispettata · zero fughe da "AI slop".
- Polling e refresh: il senso di "live" è reale, non simulato.
- Document Queue con OPEN / REVIEW / RETRY per riga (chiaro, immediato, B2B-grade).
- CTA "APRI REVIEW WORKSPACE™" visibilità OK.
- Stato semantico Worker Status Bar: 7 stati renderizzati correttamente (verificato via mock per ACTIVE / STALLED / STALLED·RECOVERY / CERTIFIED / FAILED — vedi `10–14`).

### 🚧 Cosa serve **prima** di aprire KE-003

Tre azioni minime (chiameremo questo "Sprint KE-002.1 · Value Wiring"):

1. **Wire KPI counters** alle entità realmente estratte (`brand_detected_entities` aggregata per tipo).
2. **Estendere event publisher** in `extraction_job_runner` per emettere almeno `PRODUCT_FOUND`, `DESIGNER_FOUND`, `MATERIAL_FOUND` durante l'estrazione.
3. **Distribuire le 7 warning categories** su query reali (non solo `failed_document`).

Solo allora il Control Room comunicherà valore al produttore. A quel punto, KE-003 (polish Review Workspace) e KE-004 (Future Uses™ + Knowledge Impact™) avranno una base credibile.

---

## 6 · RACCOMANDAZIONE OPERATIVA

**Non autorizzare ancora KE-003.**

Aprire prima **KE-002.1 · Value Wiring** (stimato 1 sessione di 3-4 step, solo backend):
- Step 1 · `validation_summary` → counts reali (1 file modificato)
- Step 2 · `extraction_job_runner` → emettere 4 event kinds in più (1 file)
- Step 3 · `needs-review?type=` → distribuire su 7 categorie semantiche (1 query SQL + 1 endpoint adapter)
- Step 4 · Re-screenshot + re-classify

Tempo stimato totale: **un singolo sprint corto**, zero impatto su frontend (i componenti UI sono già pronti a ricevere i dati corretti).

---

> **Firma report**: Main Agent · iteration 212 · 06 Jun 2026 03:25 UTC.
> **Stato lavoro**: review visiva eseguita · classificazione consegnata · in attesa direttiva utente.
