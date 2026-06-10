# I18N Stabilization — Decision Gate Memo
## Review & Validation Pass · D0/D1/D2/D3/D4
**Data**: 10 Giugno 2026 · READ-ONLY · Nessuna modifica al codice

---

## 1. Analisi Architetturale — R1: Motore Canonico

> *Il precedente report ha raccomandato E1. Questa sezione produce un'analisi delle opzioni senza scegliere. La scelta appartiene al team.*

### Contesto

Tre opzioni architetturali sono valutabili:
- **Opzione A** — E1 (`i18n/useT.jsx`) diventa il motore canonico unico
- **Opzione B** — E3 (`BlueprintContext.t`) diventa il motore canonico unico
- **Opzione C** — Convergenza ibrida (E1 esteso ad assorbire le capacità E3)

---

### Opzione A — E1 Canonico

**Benefici**

| # | Beneficio | Fonte |
|---|-----------|-------|
| A1 | Già adottato da ~30 file (maggioranza del codebase) | Analisi import paths |
| A2 | Hook completo: `t`, `locale`, `fmtDate`, `fmtNumber`, `fmtCurrency`, `pickLabel` | `useT.jsx:56-67` |
| A3 | `STRICT_LOCALIZATION_MODE`: token visibili `⟦key⟧` in dev, rilevamento leak italiani | `engine.js:38-67` |
| A4 | Locale source: `LocaleRuntimeContext` (server-authoritative, auth-aware) | `useT.jsx:30-33` |
| A5 | Zero dipendenza da chiamata di rete per le traduzioni base | Static JSON bundled |

**Rischi**

| # | Rischio | Severità |
|---|---------|---------|
| RA1 | ~20 file E3 usano `t(key, vars, fallback)` — 3° arg non esiste in E1. Migrazione silenziosa rompe UI | ALTA |
| RA2 | Alcune chiavi esistono SOLO nel backend dict. Migrazione E3→E1 senza aggiornare i JSON le perde silenziosamente | ALTA |
| RA3 | `useTaxonomy()` (tracking separato taxonomy-miss) non ha equivalente in E1 | MEDIA |
| RA4 | Backend dict diventa deprecato → ogni chiave editoriale deve essere "congelata" in un JSON statico | MEDIA |

**Complessità migrazione**: ALTA — 3 fasi: (1) audit chiavi backend-only, (2) aggiunta ai JSON, (3) migrazione 20+ file con gestione 3-arg

**Impatto compatibilità**: ROMPENTE per ogni componente E3 che usa il 3° arg `fallback`

**Source-of-truth implicazione**: Sorgente unica = JSON statici + CMS overrides; backend dict DEPRECATO; ogni cambiamento traduzione richiede commit al repository

---

### Opzione B — E3 Canonico

**Benefici**

| # | Beneficio | Fonte |
|---|-----------|-------|
| B1 | Backend dict: contenuto dinamico, editoriale, tenant-specific senza commit | `BlueprintContext:239-244` |
| B2 | 3° arg `fallback` permette migrazione graduale senza UI rotta | `BlueprintContext:346-373` |
| B3 | `useTaxonomy` già implementato con tracking separato | `BlueprintContext:434-447` |
| B4 | Zero refactoring per i ~20 file E3 esistenti | — |

**Rischi**

| # | Rischio | Severità |
|---|---------|---------|
| RB1 | Dipendenza di rete: `/api/blueprint/i18n/{loc}` deve rispondere prima di avere traduzioni | ALTA |
| RB2 | ~30 file E1 da migrare — perdono `fmtDate`, `fmtNumber`, `fmtCurrency` (non presenti in E3) | ALTA |
| RB3 | Backend dict opaco: nessuna analisi statica di quali chiavi esistono; chiavi mancanti silenziosamente invisibili | MEDIA |
| RB4 | Il 3° arg `fallback` sopprime la registrazione dei missing key → gap invisibili nel GovernanceOverlay | MEDIA |
| RB5 | Locale source: `BlueprintContext.locale` (localStorage, non server-authoritative) — vedi F1 nel D3 | MEDIA |

**Complessità migrazione**: ALTA (direzione inversa) — aggiungere formatters a E3 + migrare ~30 file E1

**Impatto compatibilità**: ROMPENTE per ogni componente E1 che usa i formatters

**Source-of-truth implicazione**: Sorgente primaria = backend dict (runtime); JSON statici come fallback; ogni deploy backend può alterare le traduzioni

---

### Opzione C — Convergenza Ibrida (E1 esteso)

**Descrizione**: `BlueprintI18nProvider` viene arricchito con accesso opzionale al backend dict `messages`. L'hook `useT()` da `i18n/useT.jsx` aggiunge:
- accesso a `messages` (overlay sul JSON statico, stessa precedenza di E3)
- 3° arg `fallback` opzionale (backward-compatible)

E3 (`BlueprintContext`) mantiene locale/tenant/permissions/navigation ma cede la funzione `t` a E1.

**Benefici**

| # | Beneficio |
|---|-----------|
| C1 | Nessuna migrazione degli import: `useT()` da `i18n/useT.jsx` già domina (~30 file) |
| C2 | Aggiunta del `fallback` arg opzionale in E1 = backward-compatible (2-arg esistente non si rompe) |
| C3 | Formatters (`fmtDate`, `fmtNumber`, `fmtCurrency`) preservati senza refactoring |
| C4 | Backend dict diventa overlay (stessa precedenza di E3 attuale) |
| C5 | Migrazione E3→E1: operazione per file, uno alla volta, senza sprint bloccante |

**Rischi**

| # | Rischio | Severità |
|---|---------|---------|
| RC1 | `BlueprintI18nProvider` deve ricevere `messages` — richiede nuovo data flow da `BlueprintContext` o separata fetch | MEDIA |
| RC2 | Se `BlueprintI18nProvider` legge da `BlueprintContext`, i due provider diventano accoppiati (rischio di ciclo) | MEDIA |
| RC3 | `useTaxonomy` necessita di un nuovo home nel sistema E1 | BASSA |
| RC4 | Complessità transitoria: durante la migrazione coesistono ancora E1 e E3 (stesso problema attuale) | BASSA |

**Complessità migrazione**: MEDIA — 2 fasi: (1) estensione di E1 con backend dict + fallback arg, (2) migrazione graduale dei ~20 file E3

**Impatto compatibilità**: ADDITIVO — nessuna firma esistente si rompe

**Source-of-truth implicazione**: Hook unico (`useT()` da `i18n/useT.jsx`); backend dict è overlay; JSON statici sono il piano di terra; locale source unificato su `LocaleRuntimeContext`

---

### Matrice Comparativa

| Criterio | Opzione A | Opzione B | Opzione C |
|---|---|---|---|
| **Complessità migrazione** | ALTA | ALTA | MEDIA |
| **Rottura componenti esistenti** | ~20 file E3 | ~30 file E1 | 0 (additivo) |
| **Dipendenza di rete** | No | Sì (bloccante) | Opzionale |
| **Formatters preservati** | Sì (già lì) | No (da aggiungere) | Sì (già lì) |
| **Backend dict support** | Solo dopo migrazione | Nativo | Estendibile |
| **Locale source authority** | LocaleRuntime (server) | Blueprint (localStorage) | LocaleRuntime (server) |
| **Analisi statica possibile** | Sì (JSON) | No (backend opaque) | Sì (JSON + overlay) |
| **Backward compatibility** | ROMPENTE (3-arg) | ROMPENTE (formatters) | COMPLETA |

> **Questa sezione non esprime una scelta.** I dati sono presentati per una decisione informata.

---

## 2. Validazione R2 — EditorialOverridesProvider Bug

### Evidenze accertate

**Evidenza 1 — Codice** (statica):
- `App.js:428`: `<EditorialOverridesProvider>` — nessun prop passato
- `EditorialOverridesProvider.jsx:21`: `({ children, locale = 'it' })` — default fisso
- Endpoint sempre chiamato: `/api/editorial-copy/runtime?locale=it`
- `engine.js:_resolveRuntimeOverride`: cross-locale fallback su `_runtimeOverrides.it` attivo

**Evidenza 2 — Dati runtime** (verificata via API live, no-auth):

```
Override IT attivi in produzione: 3 chiavi
  nav.new_journey                       → "Inizia il tuo viaggio"
  atelier.dashboard.kpi.active_journeys → "Design Journey™ attivi"
  atelier.dashboard.hero.summary_template → "{active} Design Journey™ in respiro · {voices} voci ricevute oggi"
```

**Evidenza 3 — Impatto sugli utenti EN** (derivata):

Confronto con en-US.json:
```
nav.new_journey                         EN json: "New Lead"
atelier.dashboard.kpi.active_journeys   EN json: "Active Journeys"
atelier.dashboard.hero.summary_template EN json: "{active} Journeys unfolding · {voices} voices received today"
```

Per un utente EN, `pickString('nav.new_journey', 'en-US')` restituisce `"Inizia il tuo viaggio"` (da override IT) invece di `"New Lead"` (da en-US.json). **Il testo italiano viene servito agli utenti inglesi come fatto deterministic.**

### Edge Cases esaminati

| Case | Esito |
|---|---|
| CMS overrides vuoti → bug invisibile? | **NON APPLICABILE** — 3 overrides attivi confermati |
| `sessionStorage('mfd-editorial-overrides-disabled') = '1'` → nessun override caricato | ✓ True, ma è un flag di bypass manuale — non si applica agli utenti normali |
| Override con valore non-linguistico (URL, ID, numero) → nessun danno linguistico | Non si applica — tutti e 3 gli override attivi contengono testo italiano |
| Fix P0-C rimuove cross-locale fallback? | NO — il fix passerebbe il locale corretto a `EditorialOverridesProvider`, che caricherebbe gli override per quel locale. Il cross-locale fallback `_runtimeOverrides.it` rimarrebbe disponibile SOLO se il locale richiesto non ha override per quella chiave |

### Effetto collaterale del fix

Il fix di P0-C (passare `locale` prop a `EditorialOverridesProvider`) non elimina il cross-locale fallback nell'engine. Cambia il comportamento come segue:

- **Pre-fix**: Utente EN → `_runtimeOverrides.en = {}` → fallback IT → riceve testo italiano
- **Post-fix**: Utente EN → `_runtimeOverrides.en = {chiavi EN dal CMS}` → riceve testo EN; se chiave non presente in override EN → fallback IT → **comportamento invariato per chiavi non overridden**

**Il cross-locale fallback IT non viene rimosso.** Rimane come safety net per chiavi che hanno override IT ma non EN. Questo è l'effetto atteso — se qualcuno ha impostato un override IT ma non EN, l'utente EN vedrà il testo italiano come fallback deliberato.

### Verdetto

**CONFERMATO** — con alta confidenza.

Il bug è:
- Deterministic (dipende dal codice, non da condizioni runtime)
- Attivo in produzione (3 overrides italiani esistenti)
- Con impatto visibile confermato: `nav.new_journey` mostra "Inizia il tuo viaggio" agli utenti EN
- Il fix non introduce regressioni nei componenti italiani

---

## 3. Analisi Approfondita — R3: Refresh Bug

### Fatti Provati

| ID | Fatto | Fonte codice |
|----|-------|--------------|
| **F1** | `LocaleSwitcher` usa `BlueprintContext.setLocale()` — SCRIVE su `localStorage.mfd_locale` | `LocaleSwitcher.jsx:10,42` + `BlueprintContext.jsx:327-334` |
| **F2** | `UserMenu` usa `BlueprintContext.setLocale()` — SCRIVE su `localStorage.mfd_locale` | `UserMenu.jsx:32,155` |
| **F3** | `CulturalPerspectivePanel` usa `LocaleRuntimeContext.setLocale()` — NON scrive su `localStorage.mfd_locale` | `CulturalPerspectivePanel.jsx:51` + `LocaleRuntimeContext.jsx:229-238` |
| **F4** | Il path LocaleRuntime autenticato scrive la preferenza solo sul server via `PUT /api/locale-runtime/preference` | `LocaleRuntimeContext.jsx:220-226` |
| **F5** | `opts.silent` in `setLocaleInternal` è dichiarato ma non letto nel corpo della funzione | `LocaleRuntimeContext.jsx:196-227` |
| **F6** | `BlueprintContext.onCrossContext` chiama `setLocaleState(next)` — non `setLocale(next)` — NON aggiorna `localStorage.mfd_locale` | `BlueprintContext.jsx:310-313` |
| **F7** | Alla refresh, `BlueprintContext.detectInitialLocale()` legge SOLO da `localStorage.mfd_locale` | `BlueprintContext.jsx:32-39` |
| **F8** | Alla refresh, `LocaleRuntimeContext._initialLocaleFromStorage()` legge `mfd_public_locale` || `mfd_locale` | `LocaleRuntimeContext.jsx:80-97` |

### Ipotesi Supportate (non provate)

**H1 — Flash transiente via CulturalPerspectivePanel**

*Meccanismo*:
1. Utente cambia locale via `CulturalPerspectivePanel` → chiama `runtime.setLocale('EN_US')`
2. Server aggiornato, ma `mfd_locale` localStorage NON aggiornato (F4)
3. `mfd:locale:change` dispatched → `BlueprintContext.setLocaleState('en-US')` (in-memory, NON localStorage) (F6)
4. Refresh: BlueprintContext legge `mfd_locale` = valore precedente (F7) → parte in italiano
5. `fetchRuntime()` risponde → LocaleRuntimeContext aggiorna a EN → `mfd:locale:change` → BlueprintContext aggiorna in-memory
6. *Risultato*: flash di italiano per la durata della chiamata API

*Supporto*: F3, F4, F6, F7 — tutti evidenze dirette da codice.  
*Non provato*: durata effettiva del flash, visibilità percepita dall'utente.

**H2 — Divergenza transiente E1/E3 durante cambio locale**

*Meccanismo*: Durante l'esecuzione asincrona di `setLocaleInternal` (F5 — doppia chiamata API non soppressa), `LocaleRuntimeContext.localeCode` ha ancora il valore precedente. E1 (`BlueprintI18nProvider`) legge da LocaleRuntime → locale vecchio. E3 (`BlueprintContext.locale`) già aggiornato in-memory via event bridge. Pagine con mix E1/E3 mostrano due lingue per ~200-500ms.

*Supporto*: F5 + struttura provider nesting (LocaleRuntime wrappato dentro Blueprint) + asincronia API.  
*Non provato*: osservazione diretta del comportamento su pagina con mix reale E1/E3.

### Ipotesi Non Verificate

**H3 — Reset permanente da risposta server sbagliata**

*Descrizione*: Se `/api/locale-runtime/resolve` restituisce IT nonostante la preferenza salvata sia EN (es. per un bug nella priority chain server-side), il reset sarebbe permanente ad ogni refresh.

*Stato*: Non verificabile da analisi statica. Richiede test runtime.

**H4 — `localStorage.mfd_locale` corrotta da race condition**

*Descrizione*: Se `LocaleSwitcher` e `CulturalPerspectivePanel` sono utilizzati nello stesso ciclo di vita, potrebbero scrivere valori conflittuali in `mfd_locale`.

*Stato*: Scenario improbabile (due switcher diversi nello stesso momento), non investigato.

### Risposta alle Domande Esplicite

**E1/E3 spiegano la divergenza transiente?**  
**SÌ** — con supporto diretto da codice. Il meccanismo è: E1 legge da `LocaleRuntimeContext` (aggiornato async), E3 legge da `BlueprintContext` (aggiornato sync dall'event bridge). Durante la finestra asincrona i due locali divergono.

**E1/E3 spiegano il reset permanente?**  
**NON PROVATO** — non negato, non confermato. L'unico path confermato di reset-al-refresh è via `CulturalPerspectivePanel` (F3, F4, F7). Ma questo è un reset transitorio, non permanente: al termine della chiamata `fetchRuntime()` il locale si corregge.

**Evidenze ancora mancanti**:
1. Chiamata diretta `GET /api/locale-runtime/resolve` (autenticato) dopo cambio locale via CulturalPerspectivePanel → verifica se il server persiste correttamente
2. Osservazione diretta del localStorage prima/dopo cambio locale via entrambi i switcher
3. Verifica visiva su una pagina con componenti E1 e E3 contemporaneamente durante il cambio

---

## 4. Rivalidazione Priorità — R4

### Nuovo elemento critico

Il fatto F1 (LocaleSwitcher e UserMenu usano BlueprintContext.setLocale) **cambia materialmente la stima di urgenza**:

- Il 95%+ dei cambi locale utente avviene via `LocaleSwitcher` o `UserMenu` → path Blueprint → `mfd_locale` aggiornato correttamente
- Solo `CulturalPerspectivePanel` usa LocaleRuntime path → impacca probabilmente una minoranza di utenti (Settings → Cultural Perspective)
- La persistenza al refresh è quindi corretta per il flusso principale

### Ordine corretto delle azioni

**Decisioni gate (prima di qualsiasi codice):**

| Gate | Cosa decidere | Perché è bloccante |
|------|---------------|-------------------|
| GATE-0 | Validare H3: chiamare `GET /api/locale-runtime/resolve` dopo cambio locale | Determina se il refresh bug è permanente o solo transitorio |
| GATE-1 | Scegliere l'opzione architetturale (A, B, o C) | Blocca qualsiasi migrazione engine |
| GATE-2 | Verificare le 13 missing key (Piano D2) | Informa tutte le azioni P1 |

**P0 — Blockers con impatto utente confermato:**

| # | Azione | Urgenza | Evidenza |
|---|--------|---------|---------|
| P0-C | Fix `EditorialOverridesProvider` locale prop | **ALTA** | 3 CMS overrides italiani attivi in produzione — utenti EN vedono "Inizia il tuo viaggio" come nav label |

**P0-C è più urgente di quanto stimato nel report precedente.** Non è un rischio teorico: è un impatto produzione attivo e misurabile.

**P1 — Stability risks:**

| # | Azione | Urgenza | Note |
|---|--------|---------|------|
| P1-C | Persistenza `mfd_locale` da LocaleRuntime path | MEDIA | Impacta solo CulturalPerspectivePanel, flusso minoritario |
| P1-D | 24 chiavi JSON de-sync IT/EN | MEDIA | Indipendente, basso rischio, fattibile dopo GATE-2 |
| P1-B | `opts.silent` implementazione | BASSA | Solo efficienza API — nessun impatto utente |
| P1-E | Journey data integrity (dangling milestone_id) | BASSA-MEDIA | Indipendente dall'i18n |

**Ordine P1 proposto corretto**: P0-C > P1-D > P1-C > P1-B > P1-E

Il motivo del cambio: P1-D (24 chiavi JSON) impacta qualsiasi utente non-italiano che usa le pagine de-synced — numericamente più significativo di P1-C (solo CulturalPerspectivePanel) e P1-B (invisible).

---

## 5. Memo Decisionale Esecutivo

### Findings Confermati

| Finding | Tipo | Fonte |
|---------|------|-------|
| `EditorialOverridesProvider` carica solo IT overrides per tutti i locali | **BUG ATTIVO IN PRODUZIONE** | Codice + API live |
| 3 overrides italiani attivi causano testo italiano su navigazione EN | **IMPATTO UTENTE CONFERMATO** | API `/api/editorial-copy/runtime?locale=it` |
| `LocaleSwitcher` e `UserMenu` persistono correttamente su `mfd_locale` | **FATTO** | `LocaleSwitcher.jsx:10`, `UserMenu.jsx:32` |
| `CulturalPerspectivePanel` NON persiste su `localStorage.mfd_locale` | **FATTO** | `CulturalPerspectivePanel.jsx:51` + `LocaleRuntimeContext.jsx:220-226` |
| `opts.silent` ignorato → doppia chiamata API ad ogni cambio locale | **FATTO** | `LocaleRuntimeContext.jsx:196-227` |
| E1 e E3 divergono transitoriamente (~200-500ms) ad ogni cambio locale | **IPOTESI SUPPORTATA** | Analisi statica flusso asincrono |

### Findings Non Ancora Provati

| Finding | Stato | Validazione richiesta |
|---------|-------|----------------------|
| E1/E3 causano reset permanente del locale al refresh | **NON PROVATO** | `GET /api/locale-runtime/resolve` prima/dopo cambio |
| Divergenza E1/E3 visibile contemporaneamente su stessa pagina | **NON PROVATO** | Osservazione diretta con DevTools |
| `localStorage.mfd_locale` corrotta da race condition multi-switcher | **NON PROBABILE** | Nessuna evidenza attiva |

### Azioni Sicure Ora (zero rischio)

1. **Eseguire Piano D2** — GovernanceOverlay o console `getMissing()` → nessuna modifica al codice
2. **Chiamare `GET /api/locale-runtime/resolve`** (curl autenticato) → valida H3
3. **Verificare localStorage** dopo cambio locale da LocaleSwitcher → valida F7 empiricamente
4. **Compilare il documento di policy motore canonico** (Opzione A/B/C) → nessuna modifica al codice

### Azioni che Richiedono Ulteriori Evidenze

| Azione | Evidenza mancante |
|--------|------------------|
| Implementare fix P1-C (persistenza mfd_locale) | Conferma che il refresh bug è effettivamente percepito da utenti che cambiano locale via CulturalPerspectivePanel |
| Iniziare migrazione E3→E1 | Decisione gate GATE-1 (scelta opzione A/B/C) |
| Estendere E1 con backend dict | Scelta Opzione C approvata + analisi chiavi backend-only |

### Decision Gates Prima di Qualsiasi Implementazione

| Gate | Prerequisito | Sblocca |
|------|-------------|---------|
| **DG-1** | Eseguire Piano D2 (13 missing key identificati) | P1-D (24 JSON de-sync) — per non aggiungere doppioni |
| **DG-2** | `GET /api/locale-runtime/resolve` (H3 validation) | P1-C — se server è corretto, urgenza cala |
| **DG-3** | Decisione architetturale (Opzione A/B/C approvata) | Qualsiasi migrazione engine |
| **DG-4** | P0-C approvato | Fix `EditorialOverridesProvider` — può procedere subito, pre-DG-3 |

---

> **DG-4 (P0-C) è l'unica azione che può procedere ora senza dipendenze.** Il finding è confermato, l'impatto è attivo in produzione, il fix è reversibile (1 riga), il rischio di regressione è documentato e gestibile.

---

*Memo prodotto: 10 Giugno 2026 · Analisi basata su codice sorgente + API live · Nessuna modifica al codebase*
