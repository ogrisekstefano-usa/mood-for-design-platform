# PREVIEW REVIEW REPORT — V2
## PRE-DEPLOY FINAL REVIEW · MOOD for DESIGN™ Public Site

> **Data review:** 2026-05-31
> **Reviewer:** Agent E1 (handoff fork)
> **Ambiente analizzato:** `https://editorial-platform-4.preview.emergentagent.com/`
> **Metodo:** Screenshot reali + ispezione DOM + lettura `document.body.innerText` lato browser
> **Locale verificata:** `it-IT` (default, per direttiva `LOCALE_ARCHITECTURE_DIRECTIVE.md`)
> **Output API `/api/site/locales`:** `{default: "it-IT", enabled: ["it-IT", "en-US"]}` ✅

---

## 0 · Verdetto sintetico

> ### 🟡 NEEDS_ONE_MORE_ITERATION
>
> 2 problemi **P1** bloccanti per la copy/posizionamento, 2 problemi **P2** UX/contenuti, 1 alert **P0** già noto e congelato (DB Wipe).
> La pagina **`/versioni-prezzi`** è al 95% — manca solo una rimozione residua di "Atelier" nel blocco support.
> La pagina **`/caratteristiche`** è completa nel copy ma ha **1 asset mancante** (item 06).
> L'esperienza **Studio Activation Entry** (`/studio`) è funzionante in V1, ma non ancora aggiornata al brief V2.
> Manca un **Locale Switcher visibile** nel header — l'architettura BCP-47 è dinamica lato server ma l'utente non può cambiare lingua.

Si raccomanda **una sola iterazione di pulizia** prima del go-live.

---

## 1 · Verifica priorità ASSOLUTA — secondo direttiva utente

### 1.1 🥇 Pricing (`/versioni-prezzi`)

| Controllo | Atteso | Trovato | Esito |
|---|---|---|---|
| Prezzi numerici (€, $, /mese) | **0** occorrenze | 0 occorrenze | ✅ PASS |
| Tier naming Opzione A | `Blueprint Studio` · `Blueprint Practice` · `Blueprint Enterprise` | Tutti e 3 presenti come eyebrow + tabella | ✅ PASS |
| Manifesto "Blueprint non si compra. Si configura." | Hero positioning visibile sopra la fold | ✅ Presente, hero gigante | ✅ PASS |
| Sezione "Come viene adottato Blueprint" | 3 passaggi (Candidatura → Dialogo → Attivazione) | "Tre passaggi per entrare in Blueprint. L'accesso è curato. Conosciamo lo studio, proponiamo la configurazione, attiviamo il workspace." | ✅ PASS |
| CTA per singolo tier | `Parlane con un Advisor` × 3 | ✅ Presente su tutti e 3 i tier | ✅ PASS |
| CTA primaria | `Candida il tuo studio` | ✅ Presente nella sezione adoption | ✅ PASS |
| CTA "Demo" rimosse | **0** occorrenze | 0 occorrenze (case-insensitive) | ✅ PASS |
| Registro aulico ("Atelier", "Maison") | **0** occorrenze | **1** occorrenza di `Atelier` nel blocco "PIÙ DI UN SOFTWARE → Team dedicato (03)" | ❌ **FAIL P1** |
| Tabella comparativa configurazioni | Comparison matrix con 3 colonne | ✅ Presente: Utenti / Moodboard / Libreria / Design Journey™ / Client Portal / Analytics / Integrazioni / Supporto / Formazione | ✅ PASS |
| Disclaimer "La configurazione esatta viene definita dall'Advisor MOOD" | Presente sotto la tabella | ✅ Presente | ✅ PASS |
| Card "Consigliato" sul tier intermedio | Badge sul Blueprint Practice | ✅ Badge "CONSIGLIATO" su Practice | ✅ PASS |
| Sezione "Più di un software" (Blueprint = piattaforma + metodo) | Onboarding · Formazione continua · Team dedicato | ✅ Presente | ✅ PASS (con bug P1 ↑) |

**Conclusione Pricing:** 11/12 PASS. **1 bug P1** (Atelier residuo).

---

### 1.2 🥈 Features (`/caratteristiche`)

| Controllo | Atteso | Trovato | Esito |
|---|---|---|---|
| Hero "Una sola piattaforma per tutto il progetto" | Headline e subtitle dal copy approvato | ✅ Esatto | ✅ PASS |
| Eyebrow hero "BLUEPRINT" | Eyebrow color verde MOOD | ✅ Presente | ✅ PASS |
| Body hero menziona "MOOD for DESIGN" e "Design Journey" | Coerenza brand | ✅ Presente | ✅ PASS |
| Intro narrativa anti-categoria | "Blueprint non è un CRM, non è un gestionale, non è un moodboard tool. È la piattaforma che li riunisce" | ✅ Esatto | ✅ PASS |
| 6 numbered items (01–06) | Eyebrow + Title + Body per ciascuno | ✅ Tutti e 6 presenti | ✅ PASS |
| Item 01 — Clienti & contatti | "Ogni relazione documentata" | ✅ Esatto | ✅ PASS |
| Item 02 — Fasi di progetto | "Il progetto strutturato per momenti" | ✅ Esatto | ✅ PASS |
| Item 03 — Materiali & fornitori | "Una libreria materiali sempre aggiornata" | ✅ Esatto | ✅ PASS |
| Item 04 — Presentazione al cliente | "Moodboard e proposte pronte da condividere" | ✅ Esatto | ✅ PASS |
| Item 05 — Coordinamento team | "Ruoli, accessi, attività in chiaro" | ✅ Esatto | ✅ PASS |
| Item 06 — Presenza editoriale | Copy + immagine asset | ⚠️ Copy presente, **asset immagine mancante** (rettangolo vuoto sulla destra) | ❌ **FAIL P2** |
| CTA Hero | `Candida il tuo studio` | ✅ Presente | ✅ PASS |
| CTA "Demo" / "Richiedi una demo" | **0** occorrenze | 0 occorrenze | ✅ PASS |
| Prezzi numerici | **0** occorrenze | 0 occorrenze | ✅ PASS |
| Registro aulico ("Atelier", "Maison") | **0** occorrenze | 0 occorrenze | ✅ PASS |
| Coerenza header/footer brand | Logo, nav, copyright "© 2026 MOOD for DESIGN™" | ✅ Tutto coerente | ✅ PASS |

**Conclusione Features:** 15/16 PASS. **1 bug P2** (asset mancante item 06).

---

### 1.3 🥉 Studio Activation Entry (`/studio`)

> Punto d'ingresso del funnel di candidatura. Linkato da `Attiva Blueprint™` (header, testid `nav-right-activate_blueprint`) e dal CTA `Candida il tuo studio`.

| Controllo | Atteso | Trovato | Esito |
|---|---|---|---|
| Routing `Attiva Blueprint™` → `/studio` | Link funzionante | ✅ `href="/studio"`, testid corretto | ✅ PASS |
| Hero copy V1 | "Apri un nuovo capitolo del tuo studio." | ✅ Presente | ✅ PASS |
| Subtitle V1 | "MOOD for DESIGN compone lo spazio operativo delle pratiche che modellano l'interior contemporaneo." | ✅ Presente | ✅ PASS |
| Background editoriale immersivo | Foto living room curata, dark overlay | ✅ Eccellente qualità visiva | ✅ PASS |
| CTA primaria | `INIZIA LA COMPOSIZIONE` | ✅ Presente, button verde MOOD | ✅ PASS |
| Link secondario per utenti esistenti | "Sei già dentro MOOD? Continua il tuo Design Journey →" | ✅ Presente | ✅ PASS |
| Allineamento col brief Studio Activation V2 (`00_OVERVIEW_AND_UX.md`) | Movimenti 1–4 (Identità → Progettualità → Modalità → Riconoscimento) | ❌ Schermata ferma sul Movimento 0 (entry) V1. **Movimenti 1–4 non ancora implementati** | ❌ **FAIL P2** (task tracciato, non blocca preview) |
| Coerenza terminologica con Pricing | "Candida"/"Configurazione"/"Advisor" presenti nel funnel | ⚠️ Sull'entry V1 non compaiono ancora — sono nel post-CTA | ⚠️ Tracked |
| Registro aulico | 0 occorrenze | 0 occorrenze | ✅ PASS |

**Conclusione Studio Activation:** Entry V1 funzionante e coerente esteticamente. **V2 non implementato** — è un task formalmente "NOT STARTED" nell'handoff e dipende dalla risoluzione del P0 DB.

---

### 1.4 🏅 Founder Perception (composito)

> Cosa percepisce un **Founder di studio** che atterra per la prima volta sul sito? Sintesi qualitativa dei 3 percorsi seguiti (Home → Caratteristiche → Pricing → Studio).

| Dimensione | Atteso | Trovato | Esito |
|---|---|---|---|
| **Tono editoriale, non commerciale** | Naming italiano elevato, niente "subscribe now"/"buy now" | "Blueprint non si compra. Si configura.", "Apri un nuovo capitolo del tuo studio.", "L'accesso è curato." → tono **editoriale forte e differenziante** | ✅ PASS |
| **Posizionamento premium senza prezzi pubblici** | Nessun €, processo di adozione esplicito | 0 prezzi, "Tre passaggi per entrare in Blueprint", "La configurazione esatta viene definita dall'Advisor" | ✅ PASS |
| **Brand consistency tier** | "Blueprint Studio/Practice/Enterprise" identico in IT e EN | Tutti i 3 tier presenti come eyebrow + tabella + descrizioni italiane | ✅ PASS |
| **Path-to-action chiaro** | CTA primario stabile "Candida il tuo studio" → `/studio` | Presente in `/caratteristiche` e `/versioni-prezzi`; CTA tier "Parlane con un Advisor" coerente | ✅ PASS |
| **Aspetto visivo curato** | Tipografia editoriale (serif + sans), palette dark + accenti verde MOOD, asset immagine premium | ✅ Tipografia DM Serif/Inter coerente, dark coerente, asset immagine premium (eccetto item 06) | ⚠️ Quasi PASS (asset item 06 mancante) |
| **Coerenza linguistica end-to-end** | Zero deriva da "Atelier"/"Maison" | **1 residuo "Atelier"** nel blocco Team dedicato di `/versioni-prezzi` | ❌ **FAIL P1** |
| **Possibilità di cambiare lingua** | Switcher locale visibile (IT-IT / EN-US) | ❌ **0** switcher nel header (testato via DOM); architettura BCP-47 dinamica ma non esposta UI | ❌ **FAIL P1** |
| **Sensazione di "platform OS"** | Footer "Running on Blueprint OS™ · Editorial Infrastructure for Design Studios" | ✅ Presente | ✅ PASS |
| **Coerenza Founder Journey con Activation Flow** | Founder vede dove va dopo aver candidato | Entry V1 funziona, ma il **percorso post-CTA non è ancora il funnel V2** | ⚠️ Tracked (P2) |

**Conclusione Founder Perception:** Esperienza forte e coerente al 90%. I 2 fail P1 incidono direttamente sulla percezione di brand precision (Atelier residuo) e accessibilità internazionale (no locale switcher).

---

## 2 · Categorie secondarie (background check)

### 2.1 Locale Architecture (BCP-47)

| Controllo | Esito | Note |
|---|---|---|
| API `/api/site/locales` ritorna BCP-47 | ✅ PASS | `{enabled: ["it-IT","en-US"], default: "it-IT"}` |
| `<html lang>` ha valore BCP-47 | ✅ PASS | `lang="it-IT"` confermato |
| `site_resolver.py` legge da `platform_languages` | ✅ PASS | refactor già completato (handoff §completed work) |
| `editorial_blocks` migrato a BCP-47 | ✅ PASS | testo letto dalle pagine è in `it-IT` corretto |
| Locale switcher nel header | ❌ **FAIL P1** | nessun elemento data-testid `locale-*` o button di switch trovato nel DOM |
| Persistenza scelta locale (cookie/localStorage) | ⚠️ Non testato | dipende dal punto sopra |
| Fallback `en-US → en-US` | ✅ PASS | (dato API) |

### 2.2 Command Center vs Blueprint (Architectural Separation)

| Controllo | Esito | Note |
|---|---|---|
| `/` (Marketing public) servito senza dipendenza da Command Center | ✅ PASS | nav pubblica e CMS-driven, nessun leak |
| `/studio` (Activation entry) lato Marketing / Public | ✅ PASS | servito da `corporate/pages/studio` |
| `/command-center` non esposto pubblicamente | ⚠️ Non verificato in questo report | richiede smoke test separato post-DB-restore |
| Branding nav: solo elementi tenant (Dedicato a, Caratteristiche, Versioni e Prezzi, Formazione, Supporto, Accedi, Attiva Blueprint™) | ✅ PASS | nessun leak governance |

### 2.3 CTA Inventory (sito pubblico)

| CTA | Pagina | Target | Esito |
|---|---|---|---|
| `Attiva Blueprint™` | Header globale | `/studio` | ✅ |
| `Candida il tuo studio` | `/caratteristiche` hero | (CTA in attesa di routing) | ✅ visivo, routing da verificare |
| `Parlane con un Advisor` × 3 | `/versioni-prezzi` tier cards | (CTA in attesa di routing) | ✅ visivo |
| `Candida il tuo studio` | `/versioni-prezzi` adoption section | (CTA in attesa di routing) | ✅ visivo |
| `Parlane con un Advisor` | `/versioni-prezzi` comparison section | (CTA in attesa di routing) | ✅ visivo |
| `INIZIA LA COMPOSIZIONE` | `/studio` hero | apre Movimento 1 (Activation V1) | ✅ |
| `Continua il tuo Design Journey →` | `/studio` link secondario | login tenant | ✅ |
| `Scopri il tuo Design Journey™` | `/` home hero | (CMS-driven section) | ✅ |

→ **Eliminazioni "Demo" verificate:** 0 occorrenze sull'intero sito pubblico. ✅
→ **Routing target dei CTA**: non testato cliccando, ma URL visibili. Da verificare in QA finale.

### 2.4 SEO / META

Non verificato in questo report (fuori scope). Da affrontare separatamente.

---

## 3 · Problemi trovati — riepilogo ordinato per priorità

### 🔴 P0 (Critico — DB Operational Wipe)

**Issue P0-001 — Database operational wiped**
- **Stato:** BLOCKED (utente ha messo in pausa la RCA in attesa dei log Supabase dashboard).
- **Impatto preview:** ❌ Login/Onboarding non testabili. **Il sito pubblico funziona** perché CMS-driven, ma qualsiasi flusso post-CTA che richieda `users`/`studio_requests` non risponderà.
- **Azione:** Nessuna — utente ha esplicitamente vietato qualsiasi operazione di restore o reseed fino al ritorno dei log.
- **NON BLOCCA** il deploy della **vetrina pubblica**, ma blocca il deploy del **funnel di activation reale**.

---

### 🔴 P1 (Bloccante per il deploy della vetrina)

**Issue P1-001 — "Atelier" residuo nel blocco support di /versioni-prezzi**
- **Localizzazione:** Sezione "PIÙ DI UN SOFTWARE → Team dedicato (03)" su `/versioni-prezzi`.
- **Testo trovato:** *"Un riferimento umano — non un ticket. **Dalla modalità Atelier in poi**, una persona vi conosce, vi segue e vi accompagna nei momenti decisivi del progetto."*
- **Causa:** Lo script `cms_update_pricing_positioning.py` ha aggiornato i namespace `site.features.*` e `site.pricing.*` (tier cards, comparison, adoption), ma **non** ha aggiornato i blocchi `site.pricing.support.*` (eredità da `seed_iter151_pricing.py` linee 120, 132).
- **Fix richiesto:**
  - Estendere lo script con UPSERT per le chiavi `site.pricing.support.philosophy.body` e `site.pricing.support.team_block.body` (e similari) per sostituire "Atelier" con il naming corretto (es. "Blueprint Practice").
  - Eseguire lo script idempotente in preview.
- **Stima:** 15 min sviluppo + 5 min QA.

**Issue P1-002 — Locale Switcher UI assente nel header**
- **Localizzazione:** Header globale, tutte le pagine pubbliche.
- **Sintomo:** L'utente non ha modo di passare da `it-IT` a `en-US` (e viceversa) nonostante l'API esponga entrambi e l'architettura BCP-47 sia dinamica.
- **Causa:** L'integrazione frontend del `LocaleContext.js` con il `platform_languages` API è completata, ma manca la **componente UI di switch** (es. `LocaleSwitcher.jsx` nel header).
- **Fix richiesto:**
  - Aggiungere componente `<LocaleSwitcher />` nel header pubblico (es. `corporate/components/Header.jsx`).
  - Popolato dinamicamente dalla `enabled[]` dell'API `/api/site/locales` (nessun hardcoding).
  - Persistere la scelta in `localStorage` con key `mood.locale`.
  - data-testid: `locale-switcher`, `locale-option-{code}`.
- **Stima:** 45–60 min sviluppo + screenshot test.

---

### 🟡 P2 (Non bloccante per la vetrina, da pianificare)

**Issue P2-001 — Asset immagine mancante in /caratteristiche item 06 ("Presenza editoriale")**
- **Localizzazione:** `/caratteristiche` block 06.
- **Sintomo:** Il container immagine appare come **rettangolo nero vuoto** sulla destra del testo.
- **Causa:** Asset non ancora caricato nel CMS (`editorial_blocks.image_url` per `site.features.item_06.image` non popolato).
- **Fix richiesto:** Selezione/upload di un'immagine editoriale rappresentativa di "studio che pubblica i propri progetti" → upload nel CMS → reference nell'editorial block.
- **Stima:** 15 min image selection + 5 min CMS update.

**Issue P2-002 — Studio Activation Entry su Copy V1, V2 non implementato**
- **Localizzazione:** `/studio`.
- **Sintomo:** L'entry mostra ancora il copy V1 ("Apri un nuovo capitolo del tuo studio." / "INIZIA LA COMPOSIZIONE"), non i 4 movimenti del brief V2 (Identità → Progettualità → Modalità → Riconoscimento) — `00_OVERVIEW_AND_UX.md`.
- **Causa:** Il task "Implementation of Studio Activation Flow V2" è formalmente **NOT STARTED** (handoff §In progress Task List).
- **Fix:** Dipende dalla risoluzione del P0 DB (per migrazione `studio_requests` schema e nuovi API). Vedi `02_TECH_DESIGN.md`.
- **Stima:** 2–3 giornate di sviluppo (post-P0 unblock).

**Issue P2-003 — Routing target dei CTA "Candida" e "Parlane con un Advisor" non testati cliccando**
- **Localizzazione:** Tutti i CTA su `/caratteristiche` e `/versioni-prezzi`.
- **Sintomo:** I CTA appaiono visivamente ma il routing destinazione non è stato verificato in questo report (per non saturare il contesto).
- **Fix:** QA dedicato con click-through test prima del go-live.
- **Stima:** 30 min QA.

---

## 4 · Checklist finale pre-deploy

| # | Item | Stato | Azione |
|---|---|---|---|
| 1 | Pricing senza prezzi numerici | ✅ | — |
| 2 | Tier naming "Blueprint Studio/Practice/Enterprise" | ✅ | — |
| 3 | CTA "Demo" rimosse globalmente | ✅ | — |
| 4 | CTA "Candida il tuo studio" / "Parlane con un Advisor" | ✅ | QA routing target (P2-003) |
| 5 | "Atelier" rimosso globalmente | ❌ | **Fix P1-001 prima del deploy** |
| 6 | Locale architecture BCP-47 backend | ✅ | — |
| 7 | Locale Switcher UI nel header | ❌ | **Fix P1-002 prima del deploy** |
| 8 | Asset immagine item 06 features | ❌ | Fix P2-001 (idealmente prima del deploy) |
| 9 | Studio Activation Entry funzionante (V1) | ✅ | V2 post-P0 |
| 10 | Brand asset (logo, favicon) aggiornati | ✅ | (handoff §completed work) |
| 11 | Footer / disclaimer / Blueprint OS™ | ✅ | — |
| 12 | DB operational state | ❌ P0 | **Sblocco esterno (log Supabase)** |

---

## 5 · Raccomandazione finale

### ✅ Cosa è pronto per il go-live della **vetrina pubblica**
- Home, Caratteristiche, Versioni e Prezzi (al 95%), Studio Entry (V1), Formazione, Supporto.
- Naming tier, registro editoriale, assenza prezzi pubblici, assenza "Demo".
- Architettura backend BCP-47.

### ❌ Cosa serve **prima** del go-live (1 sola iterazione, ~2 ore di sviluppo)
1. **Fix P1-001**: estendere `cms_update_pricing_positioning.py` per coprire `site.pricing.support.*` ed eliminare l'ultimo "Atelier".
2. **Fix P1-002**: aggiungere `LocaleSwitcher` UI nel header pubblico, popolato dinamicamente da `/api/site/locales`.
3. **Fix P2-001**: caricare l'asset mancante per `site.features.item_06.image`.

### ⛔ Cosa **NON** può andare in produzione finché P0 non è chiuso
- Il **funnel reale di Studio Activation** (`/studio` post-CTA → submission → email Advisor → onboarding) dipende da `users` e `studio_requests` che sono attualmente vuoti. La vetrina pubblica può comunque essere deployata, **ma con la consapevolezza che chi clicca "INIZIA LA COMPOSIZIONE" oggi non riuscirà a completare il flusso**. Si suggerisce di mettere un placeholder "Stiamo finalizzando la piattaforma — riapriamo le candidature il [data]" finché P0 non è risolto.

---

## 6 · Conclusione

> # 🟡 NEEDS_ONE_MORE_ITERATION

**Effort residuo stimato per go-live vetrina:** ~2 ore (P1-001 + P1-002 + P2-001).
**Effort residuo stimato per go-live funnel completo:** dipende dal P0 + 2–3 giornate per Studio Activation V2.

La preview è **coerente al 90%** con la nuova architettura editoriale. I 2 fix P1 sono chirurgici e non richiedono refactor profondi. Una volta applicati, lo stato `READY_FOR_PRODUCTION` può essere dichiarato per la vetrina pubblica.

---

*— fine report —*
