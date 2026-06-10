# MOOD for DESIGN™ — I18N Stabilization Phase
## Root Cause Analysis Report · D0 / D1 / D2 / D3 / D4
**Data**: 10 Giugno 2026  
**Tipo**: READ-ONLY · Nessuna modifica al codice  
**Autore**: E1 Agent (analisi basata su evidenze dirette del codice sorgente)

---

## INDICE

1. [D0 · Single Source of Truth Map](#d0)
2. [D1 · Translation Engine Dependency Map](#d1)
3. [D2 · Runtime Missing Key Capture Plan](#d2)
4. [D3 · Language Refresh Investigation](#d3)
5. [D4 · Stabilization Roadmap](#d4)
6. [Risposta ai 5 Success Criteria](#success-criteria)

---

<a name="d0"></a>
## D0 · Single Source of Truth Map

### Gerarchia dei Provider (confermata da App.js)

```
AuthProvider
  └── BlueprintProvider                    ← LAYER A: locale BCP-47, messages dict backend
      └── TenantConfigurationProvider
          └── TenantThemeProvider
              └── StudioPaletteProvider
                  └── LocaleRuntimeProvider    ← LAYER B: locale composite (IT_IT), profilo server
                      └── BlueprintI18nProvider    ← LAYER C: legge da LocaleRuntime, JSON statici
                          └── EditorialOverridesProvider  ← LAYER D: [NESSUN locale prop → 'it' fisso]
                              └── [tutte le route autenticate]
```

**SiteContext** (per pagine pubbliche) è un sistema **completamente separato** — non interagisce con nessuno dei layer sopra.

---

### Layer per Layer — Proprietà e Responsabilità

#### LAYER 0 — Language Registry (`languages.js`)

| Campo | Valore |
|---|---|
| **Proprietario** | `getLanguageRegistry()` → `_dbMirror → DB cache → LANGUAGE_REGISTRY` |
| **Input** | DB via `bootstrapLanguagesFromDB()` → `/api/platform/languages` |
| **Fix I18N-STABILIZATION-P0** | `mfd_language_registry_override` RIMOSSO dalla catena (era root cause del bug 7/9) |
| **Chiave localStorage** | `mfd_language_registry_db_cache_v1` (solo cache, non source of truth) |
| **Consumatori** | `BlueprintContext` (availableLocales), `LocaleRuntimeContext` (indirettamente), `SiteContext` |

---

#### LAYER A — `BlueprintContext.jsx` (E3)

| Campo | Valore |
|---|---|
| **Formato locale** | BCP-47: `'it-IT'`, `'en-US'`, `'en-GB'` |
| **Inizializzazione** | `detectInitialLocale()` → legge `localStorage.mfd_locale` → `resolveLanguage(stored).code` |
| **Persistenza** | **Scrive** su `localStorage.mfd_locale` (solo via `setLocale()`) |
| **Carica dizionario** | `loadMessages(locale, tenant.slug)` → `/api/blueprint/i18n/{loc}` |
| **Emette** | `CustomEvent('mfd:locale:change', { detail: { locale: bcp47 } })` |
| **Ascolta** | `mfd:locale:change` → `setLocaleState(next)` (solo in-memory, NON localStorage) |
| **Ascolta** | `storage` su `mfd_locale` → `setLocaleState(e.newValue)` (solo in-memory) |

> **OSSERVAZIONE CRITICA (A1)**: Quando `BlueprintContext` riceve un evento `mfd:locale:change` da un'altra sorgente, chiama `setLocaleState()` internamente — **non** `setLocale()`. Di conseguenza `localStorage.mfd_locale` **non viene aggiornato** dalla propagazione cross-context. Solo il cambio esplicito dell'utente via `setLocale()` persiste in localStorage.

---

#### LAYER B — `LocaleRuntimeContext.jsx` (sorgente per E1)

| Campo | Valore |
|---|---|
| **Formato locale** | Composite: `'IT_IT'`, `'EN_US'`, `'EN_GB'` |
| **Inizializzazione** | `_initialLocaleFromStorage()` → `localStorage.mfd_public_locale` oppure `localStorage.mfd_locale` |
| **Persistenza autenticato** | API `PUT /api/locale-runtime/preference` + **NON scrive** su `mfd_locale` |
| **Persistenza anonimo** | Scrive su `localStorage.mfd_public_locale` (chiave DIVERSA da Blueprint) |
| **Emette** | `CustomEvent('mfd:locale:change', { detail: { locale: bcp47 } })` |
| **Ascolta** | `mfd:locale:change` → `setLocaleInternal(composite, { silent: true })` |
| **Bug confermato** | `{ silent: true }` è DICHIARATO ma **mai implementato** in `setLocaleInternal` — la chiamata API viene eseguita ugualmente |
| **supported[]** | Hardcodato: 9 codici composite — **non** alimentato dinamicamente dal DB |

> **OSSERVAZIONE CRITICA (B1)**: `LocaleRuntimeContext.setLocale()` (path autenticato) **non scrive su `mfd_locale`**. Se l'utente cambia lingua tramite il path LocaleRuntime (e.g. selector di LocaleRuntimeContext), alla prossima refresh `BlueprintContext` leggerà `mfd_locale` con il valore precedente.

---

#### LAYER C — `BlueprintI18nProvider` in `i18n/useT.jsx` (E1)

| Campo | Valore |
|---|---|
| **Locale source** | `LocaleRuntimeContext.localeCode` → `toBcp47()` |
| **Dizionari** | Static JSON (`it-IT.json`, `en-US.json`, `en-GB.json`, `es-ES.json`, `fr-FR.json`, `de-DE.json`, `ar.json`) |
| **Runtime overrides** | Sì, via `_runtimeOverrides` in `engine.js` (popolato da EditorialOverridesProvider) |
| **`t(key, params)`** | 2 argomenti — NO argomento `fallback` |

---

#### LAYER D — `EditorialOverridesProvider.jsx`

| Campo | Valore |
|---|---|
| **Locale prop in App.js** | **NESSUNO** → default `locale = 'it'` |
| **Endpoint chiamato** | `/api/editorial-copy/runtime?locale=it` (sempre e solo italiano) |
| **Effetto** | Popola `_runtimeOverrides.it` in `engine.js` |
| **Bug confermato** | `_resolveRuntimeOverride()` ha un cross-locale fallback: se chiave non trovata nel locale richiesto, cerca in `_runtimeOverrides.it`. Gli override italiani leakano in TUTTI i locali tramite questo fallback. |

---

### Catena di Precedenza — `pickString(key, locale)` in `engine.js`

```
1. _runtimeOverrides[base][key]          ← CMS override per lingua specifica
2. _runtimeOverrides.it[key]             ← [RISCHIO] cross-locale fallback IT → leaks in non-IT
3. _runtimeOverrides.en[key]             ← fallback EN
4. STRINGS[locale][key]                  ← JSON statico locale richiesto
5. STRINGS[sibling][key]                 ← fratello (en-GB → en-US, etc.)
6. STRINGS[tenantDefault][key]           ← tenant default (se configurato, non-IT per utenti non-IT)
7. STRINGS['it-IT'][key]                 ← solo se locale target è 'it-*'
8. STRINGS['en-US'][key]                 ← safety net universale
9. ⟦key⟧                                ← strict mode (dev/staging)
10. key literal                          ← produzione
```

### Catena di Precedenza — `BlueprintContext.t(key, vars, fallback)` (E3)

```
1. messages[key]                         ← backend dict per locale (da /api/blueprint/i18n/{loc})
2. pickString(key, locale, vars)         ← catena sopra (tutti i 10 step)
3. fallback (3° argomento)               ← stringa di riserva hardcodata nel JSX
4. key literal                           ← mai raggiunto se fallback è fornito
```

### Matrice Conflitti — Split-Brain Risks

| # | Tipo | Stato | Descrizione |
|---|------|--------|-------------|
| **SB-1** | Storage divergence | **CONFERMATO** | Due chiavi localStorage separate: BlueprintContext usa `mfd_locale`, LocaleRuntimeContext usa `mfd_public_locale`. Path di scrittura non convergono. |
| **SB-2** | Silent option non implementata | **CONFERMATO** | `setLocaleInternal(code, {silent: true})` ignora `silent` → doppia chiamata API ad ogni cross-context event |
| **SB-3** | EditorialOverrides locale fisso | **CONFERMATO** | `EditorialOverridesProvider` carica solo override IT → leakano in tutti i locali via fallback |
| **SB-4** | supported[] hardcodato | **DOCUMENTATO** | `LocaleRuntimeContext.supported[]` = 9 codici composite — non alimentato dal DB (rischio futuro) |
| **SB-5** | `buildFallbackChain` duplicata | **OSSERVATO** | `languages.js` e `engine.js` esportano entrambi `buildFallbackChain` con implementazioni **diverse**. Nessun conflitto attuale (usi separati), ma ambiguità futura. |

---

<a name="d1"></a>
## D1 · Translation Engine Dependency Map

### Grafo delle dipendenze

```
engine.js
  ├── exports: pickString, pickLocaleValue, buildFallbackChain, toBcp47, setRuntimeOverrides
  ├── importato da: useT.jsx (E1), BlueprintContext.jsx (E3)
  └── legge: STRINGS{} (JSON statici), _runtimeOverrides (in-memory, popolato da EditorialOverridesProvider)

i18n/useT.jsx  [E1]
  ├── importa: engine.js (pickString, pickLocaleValue, buildFallbackChain, toBcp47)
  ├── importa: LocaleRuntimeContext (useLocaleRuntime)
  ├── esporta: useT(), BlueprintI18nProvider, useLookups, invalidateLookupsCache
  └── re-esportato in: i18n/index.js

contexts/BlueprintContext.jsx  [E3]
  ├── importa: engine.js (pickString)
  ├── importa: languages.js (blueprintLanguages, getDefaultLocale, resolveLanguage)
  ├── esporta: useBlueprint(), BlueprintProvider
  ├── esporta: useT() [E2 — re-export di E3.t come hook standalone]
  └── esporta: useTaxonomy()

i18n/EditorialOverridesProvider.jsx  [E4]
  ├── importa: engine.js (setRuntimeOverrides)
  └── popola: engine.js._runtimeOverrides.it (solo IT — BUG locale prop mancante)

site/editorial/EditorialBundleProvider.jsx  [E5]
  ├── importa: SiteContext (useSite) — ISOLATO da Blueprint/LocaleRuntime
  └── Non interagisce con engine.js, useT, BlueprintContext

contexts/LocaleRuntimeContext.jsx  [E6]
  ├── Non importa engine.js
  ├── Non importa BlueprintContext
  └── Sorgente di localeCode (composite) per BlueprintI18nProvider (E1)
```

### Grafo Import/Export critico — il problema E2

```
i18n/useT.jsx           → export function useT()    [E1]
BlueprintContext.jsx     → export const useT()       [E2 = re-export di E3.t]

i18n/index.js           → re-esporta useT da i18n/useT.jsx (E1)
```

**Il punto di ambiguità**: Due moduli diversi esportano `useT`. Il comportamento dipende dall'import path:
- `import { useT } from '../../i18n/useT'` → E1 (context-based, full hook `{t, locale, fmtDate...}`)
- `import { useT } from '../../i18n'` → E1 (via barrel index)
- `import { useT } from '../../contexts/BlueprintContext'` → E2 (solo `t` function, non il full context)

### Confronto Semantico E1 vs E3

| Proprietà | E1 (`i18n/useT.jsx`) | E3 (`BlueprintContext.t`) |
|---|---|---|
| **Locale source** | `LocaleRuntimeContext.localeCode` → `toBcp47()` | `BlueprintContext.locale` (BCP-47) |
| **Backend dict** | NO — solo JSON statici | SÌ — `messages[key]` prima di tutto |
| **Firma** | `t(key, params)` — 2 argomenti | `t(key, vars, fallback)` — 3 argomenti |
| **3° arg fallback** | IGNORATO (non esiste nel tipo) | USATO — stringa di riserva |
| **Missing key result** | `⟦key⟧` (strict) oppure `key` | `fallback` oppure `key` |
| **Registra missing** | Sì, via `recordMissing()` in `engine.js:pickString` | Sì, ma SOLO se `!fallback` |
| **Runtime overrides** | Sì (via `engine.js`) | Sì (via `engine.js:pickString`) |
| **Risposta formato** | Full hook object `{t, locale, pickLabel, fmtDate...}` | Solo funzione `t` |
| **Contesto richiesto** | `BlueprintI18nProvider` (o fallback su LocaleRuntime) | `BlueprintProvider` (throw se assente) |

### Consumatori per motore

| Motore | File consumatori (campione) | Totale stimato |
|---|---|---|
| **E1** (`i18n/useT.jsx`) | AccountDetailDrawer, CrmAccountsPage, MembersPage, DesignJourneyTab, DashboardPage, ProjectDetailPage, RelationshipsPage, StepWorkspacePage, InsightsPage, MagazineEditorPage, CulturalEditionReviewPage, JourneyWelcomePage | ~30+ file |
| **E3** (`useBlueprint().t`) | LanguagesPage, SettingsPage, DomainsPage, LeadsPage, AdminAuditPage, AdminTenantsPage, StudioLibraryPage, CollectionDetailPage, DesignerDetailPage | ~20+ file |
| **E2** (`useT` da BlueprintContext) | Nessun consumatore diretto trovato (1 file usa il pattern `useBlueprint().t` non il re-export `useT`) | ~0 |

### Risk Profile

| Rischio | Severità | Descrizione |
|---|---|---|
| **R1: Firma incompatibile** | ALTA | Un componente migrato da E3→E1 che usava il 3° arg `fallback` smette silenziosamente di usare il fallback — mostra `⟦key⟧` invece del testo di riserva |
| **R2: Locale source divergente** | MEDIA | E1 legge da `LocaleRuntimeContext`, E3 da `BlueprintContext.locale`. In condizioni di race condition (cambio locale in volo), i due locali possono divergere temporaneamente |
| **R3: Backend dict esclusivo** | MEDIA | Chiavi presenti SOLO nel backend dict (da `/api/blueprint/i18n`) sono invisibili a E1. Un componente migrato da E3→E1 perde queste traduzioni silenziosamente |
| **R4: Missing key registration** | BASSA | E3 non registra missing key se è fornito un `fallback` → 13 key esistenti potrebbero essere sotto-registrate |

### Motore Canonico Raccomandato

**Raccomandazione: E1 (`i18n/useT.jsx`) come motore canonico futuro.**

Rationale:
1. E1 è già il motore più adottato (~30+ file vs ~20 E3)
2. E1 espone un hook completo con `fmtDate`, `fmtNumber`, `fmtCurrency`, `pickLabel` — E3 espone solo `t`
3. E1 ha la fallback chain più rigorosa (STRICT_LOCALIZATION_MODE, leak detection)
4. E1 deriva il locale da `LocaleRuntimeContext`, che è il layer più vicino al server e alla preferenza utente autenticata

**Prerequisito prima della migrazione** (NON in questo sprint): E1 deve essere arricchito con l'accesso al backend dict `messages` (attualmente esclusivo di E3) oppure le chiavi "backend-only" devono essere aggiunte ai JSON statici.

---

<a name="d2"></a>
## D2 · Runtime Missing Key Capture Plan

### Obiettivo

Identificare i 13 missing key di runtime senza modificare la logica applicativa e senza alterare il comportamento dell'utente.

### Stato attuale di `missingI18nRegistry.js`

Il registry è già pienamente funzionale. Registra ogni miss con:
- `key` — chiave i18n non trovata
- `locale` — locale attivo al momento del miss
- `fallback_src` — origine (`key-literal`, `backend-fallback`, `italian-leak`, `taxonomy-missing`)
- `page` — `window.location.pathname` al momento del miss
- `count` — numero di occorrenze
- `is_taxonomy` — flag per chiavi `taxonomy.*`

### Piano di strumentazione temporanea

**Nessuna modifica al codice richiesta.** La strumentazione si effettua interamente via **DevTools Console** del browser durante una sessione di navigazione autenticata.

#### Step 1 — Navigazione di cattura

Navigare le seguenti route (nell'ordine — le 13 chiavi pre-esistenti sono concentrate nelle pagine CRM/workspace):

```
/dashboard
/relationships  (o /crm/accounts)
/studio/journey/:jid  (journey qualsiasi)
/settings/members
/settings
/blueprint/editorial
/blueprint/editorial/inbox
```

Attendere che ogni pagina si carichi completamente prima di navigare alla successiva.

#### Step 2 — Lettura del registry (via DevTools Console)

```javascript
// Incollare nella console del browser dopo la navigazione completa:
const { getMissing } = await import('/src/design-system/missingI18nRegistry.js');
const missing = getMissing();
console.table(missing.map(m => ({
  key: m.key,
  locale: m.locale,
  source: m.fallback_src,
  page: m.page,
  count: m.count,
  is_taxonomy: m.is_taxonomy
})));
```

> **Nota**: Su app bundlata (non dev server), usare il metodo alternativo sotto.

#### Step 2 alternativo — Via GovernanceOverlay (già integrato)

Il registry è già esposto nel pannello **GovernanceOverlay LiveQA** (Governance → Missing translations → N). Aprire il pannello dopo la navigazione e leggere le N chiavi mancanti.

#### Step 3 — Export strutturato (opzionale)

```javascript
// Nella console del browser:
const { getMissing } = window.__MFD_I18N_REGISTRY__ || 
  (window.__MFD_I18N_REGISTRY__ = { getMissing: () => [] });
// oppure, se accessibile:
copy(JSON.stringify(getMissing(), null, 2));
```

#### Step 4 — Classificazione post-cattura

Una volta ottenute le 13 chiavi, classificarle in:

| Categoria | Criterio | Azione |
|---|---|---|
| **A: Mancanti nei JSON statici** | `fallback_src === 'key-literal'`, chiave non presente in nessun locale | Aggiungere la chiave ai file JSON |
| **B: Backend-only** | Chiave presente nel backend dict ma non in JSON statici | Nessuna azione se il componente usa E3; aggiungere ai JSON se si vuole migrare a E1 |
| **C: Italian leak** | `fallback_src === 'italian-leak'` | Tradurre il valore nel locale corretto nel JSON |
| **D: Taxonomy** | `is_taxonomy === true` | Aggiungere a `/api/blueprint/i18n/{loc}` come `taxonomy.{type}.{key}` |

### Strumentazione opzionale — aggiunta di un console dump automatico

**Descrizione** (nessun codice da scrivere ora): In una sessione futura, si potrebbe aggiungere nella riga ~48 di `missingI18nRegistry.js` (dopo `_emit()`) un `console.warn` opzionale controllato da una variabile d'ambiente:

```javascript
// Pseudo-codice — non implementare ora:
if (process.env.REACT_APP_LOG_MISSING_KEYS === 'true') {
  console.warn('[i18n·MISSING]', { key, locale, fallbackSrc, page: ... });
}
```

Questo è **rimovibile con un singolo commit** (rimozione del blocco `if`).

### Meccanismo di rimozione

La strumentazione via console non richiede rollback. Se si implementasse il console dump opzionale, la rimozione è:
1. Eliminare il blocco `if (REACT_APP_LOG_MISSING_KEYS === 'true')` da `missingI18nRegistry.js`
2. Rimuovere la variabile da `.env.development`

---

<a name="d3"></a>
## D3 · Language Refresh Investigation

> **Premessa metodologica**: Questa sezione separa esplicitamente **fatti accertati dal codice** da **ipotesi supportate** e **ipotesi non ancora verificate**. E1/E3 sono un'ipotesi probabile, non un root cause provato, fino a quando non si dispone di un test di riproduzione controllato.

### Fatto F1 — Due chiavi localStorage indipendenti

**Evidenza**: Lettura diretta del codice sorgente.

| Chiave | Scritto da | Scritto quando |
|---|---|---|
| `mfd_locale` | `BlueprintContext.setLocale()` | Cambio esplicito locale via Blueprint selector |
| `mfd_public_locale` | `LocaleRuntimeContext.setLocaleInternal()` (anonimo) | Cambio locale in sessione anonima |
| Nessuna chiave | `LocaleRuntimeContext.setLocaleInternal()` (autenticato) | Il path autenticato scrive solo su server, non su localStorage |

**Implicazione diretta (F1a)**: Se l'utente cambia lingua tramite il selettore che chiama `LocaleRuntimeContext.setLocale()` in sessione autenticata:
1. La preferenza viene scritta sul server (DB)
2. `mfd_locale` NON viene aggiornato
3. Al prossimo refresh, `BlueprintContext.detectInitialLocale()` legge `mfd_locale` → valore vecchio
4. `LocaleRuntimeContext._initialLocaleFromStorage()` legge `mfd_public_locale` (vuoto in sessione autenticata) o `mfd_locale` → stesso valore vecchio
5. Entrambi i context inizializzano con il locale vecchio, poi si correggono dal server

Questo spiega un **flash di locale vecchio** al refresh (durata: il tempo dell'API call). NON spiega un reset permanente.

**Implicazione diretta (F1b)**: Il fix I18N-STABILIZATION-P0 ha rimosso il `mfd_language_registry_override` (che causava 7/9 lingue), ma **non** ha unificato le due chiavi localStorage.

---

### Fatto F2 — `setLocaleInternal` ignora `opts.silent`

**Evidenza**: Codice sorgente `LocaleRuntimeContext.jsx`, righe 196-227.

```javascript
const setLocaleInternal = useCallback(async (code, opts = {}) => {
  // opts.silent è ricevuto ma mai letto nel corpo della funzione
  if (!user) { /* ... localStorage.setItem(PUBLIC_LOCALE_STORAGE_KEY, code); ... */ }
  // Authenticated: sempre chiamata API, indipendentemente da opts.silent
  await api.put('/api/locale-runtime/preference', { locale_code: code });
  await fetchRuntime();
}, [user, fetchRuntime]);
```

**Implicazione**: Ogni volta che `BlueprintContext.setLocale()` dispatchea `mfd:locale:change`, `LocaleRuntimeContext` riceve l'evento e chiama nuovamente `PUT /api/locale-runtime/preference`. Questo produce:
- **Doppia scrittura server** ad ogni cambio locale
- **Una async race** durante la quale `LocaleRuntimeContext.localeCode` è stale
- Conseguenza: `BlueprintI18nProvider` (E1) ha il locale vecchio per la durata della chiamata API

---

### Fatto F3 — `EditorialOverridesProvider` carica solo override italiani

**Evidenza**: `App.js` linea 428 — `<EditorialOverridesProvider>` senza prop.  
`EditorialOverridesProvider.jsx` linea 21 — `{ children, locale = 'it' }`.

**Implicazione**: `_runtimeOverrides` in `engine.js` ha solo `it` popolato. La funzione `_resolveRuntimeOverride()` fa cross-locale fallback a `_runtimeOverrides.it` per tutti i locali. Questo significa che un override CMS italiano può sovrascrivere qualsiasi chiave per qualsiasi utente, indipendentemente dal locale. L'override bypassa il leak detector di STRICT_LOCALIZATION_MODE.

---

### Fatto F4 — Il bridge cross-context aggiorna solo `setLocaleState` (non `setLocale`)

**Evidenza**: `BlueprintContext.jsx` righe 309-325.

```javascript
const onCrossContext = (e) => {
  const next = e?.detail?.locale;
  if (next && next !== locale) setLocaleState(next);  // solo stato interno
};
```

`setLocaleState` è il setter React dello `useState`. Non chiama `localStorage.setItem('mfd_locale', ...)`. Quindi quando `LocaleRuntimeContext` dispatchea `mfd:locale:change`, `BlueprintContext` aggiorna il proprio stato in-memory ma **non persiste su localStorage**.

---

### Ipotesi supportata H1 — Flash di locale al refresh (bassa severità, alta probabilità)

**Stato**: IPOTESI SUPPORTATA — richiede test di riproduzione controllato per conferma.

**Meccanismo ipotizzato**:
1. Utente cambia locale da IT a EN via LocaleRuntime path (autenticato)
2. Server aggiornato, `mfd_public_locale` non scritto, `mfd_locale` non scritto
3. Refresh: entrambi i context partono da IT (localStorage vecchio)
4. Dopo ~200-500ms le API rispondono → entrambi i context si aggiornano a EN
5. Risultato visibile: flash IT → EN al caricamento

**Test di validazione richiesto**:
```
1. Aprire DevTools → Application → Local Storage
2. Notare il valore di mfd_locale e mfd_public_locale
3. Cambiare locale via LocaleSwitcher
4. Refresh
5. Verificare se mfd_locale si è aggiornato e se c'è flash visibile
```

---

### Ipotesi supportata H2 — Divergenza transiente E1/E3 durante cambio locale

**Stato**: IPOTESI SUPPORTATA — supportata da F1a + F2.

**Meccanismo ipotizzato**: Durante la finestra asincrona di `setLocaleInternal()` (da F2), `LocaleRuntimeContext.localeCode` è stale. `BlueprintI18nProvider` (E1) legge da LocaleRuntime → locale vecchio. `BlueprintContext.locale` (E3) già aggiornato tramite event. Le pagine con mix di E1 e E3 mostrano due lingue contemporaneamente per ~200-500ms.

**Durata**: Transiente (API call latency). Non persistente dopo refresh.

**Test di validazione richiesto**:
```
1. Aprire una pagina con mix di E1 e E3 (e.g. LanguagesPage usa E3, DashboardPage usa E1)
2. Cambiare locale velocemente
3. Verificare se i testi si aggiornano in momenti diversi (non simultanei)
```

---

### Ipotesi non verificata H3 — Reset permanente da risposta server `/api/locale-runtime/resolve`

**Stato**: IPOTESI NON VERIFICATA.

**Descrizione**: Il server potrebbe restituire un locale diverso dalla preferenza utente (es. se la preferenza non è stata salvata correttamente, o se la tenant configuration override la user preference). Se `fetchRuntime()` risponde con IT quando l'utente vuole EN, il reset sarebbe permanente ad ogni refresh.

**Validazione richiesta**: Chiamata diretta a `GET /api/locale-runtime/resolve` con token autenticato EN, verificare il campo `locale_code` nella risposta.

---

### Ipotesi non verificata H4 — E1/E3 come causa esclusiva del language reset

**Stato**: IPOTESI NON VERIFICATA.

**Avvertenza esplicita**: La coesistenza E1/E3 produce una divergenza transiente (H2), ma non è automaticamente la causa del "language reset" descritto dall'utente. Il reset potrebbe essere causato da:
- H3 (risposta server sbagliata)
- Una chiave localStorage corrotta o in conflitto
- Un componente specifico che chiama `setLocale` con il valore sbagliato

**Non dichiarare E1/E3 come root cause del refresh bug senza riproduzione controllata.**

---

<a name="d4"></a>
## D4 · Stabilization Roadmap

### P0 — Release Blocker

Questi problemi possono causare comportamenti errati visibili agli utenti in produzione.

---

**P0-A · Decisione di ownership del motore canonico**

| Campo | Valore |
|---|---|
| **Descrizione** | Fintanto che E1 e E3 coesistono senza regole chiare, ogni migrazione può rompere silenziosamente le traduzioni. Serve una decisione documentata: quale motore è canonico, quando è ammessa l'eccezione. |
| **Rischio** | Una migrazione E3→E1 senza aggiornare il 3° arg `fallback` mostra `⟦key⟧` in produzione |
| **Azione** | Documento interno: "E1 è il motore canonico per tutte le nuove superfici. E3 rimane per le superfici che richiedono il backend dict. Firma 3-arg non permessa in nuovi componenti." |
| **Effort** | 1 documento · 0 righe di codice |

---

**P0-B · Identificazione dei 13 missing key**

| Campo | Valore |
|---|---|
| **Descrizione** | I 13 missing key di runtime sono sconosciuti per namespace — non è possibile valutarne la severità senza identificarli |
| **Rischio** | Potrebbero includere chiavi visibili agli utenti in EN/FR/DE mostrando `⟦key⟧` |
| **Azione** | Seguire il Piano D2 (sessione di navigazione + console dump) |
| **Effort** | 30 minuti · 0 righe di codice |

---

**P0-C · Fix `EditorialOverridesProvider` locale prop**

| Campo | Valore |
|---|---|
| **Descrizione** | `EditorialOverridesProvider` riceve sempre `locale='it'` → carica solo override italiani → leakano in tutti i locali via cross-locale fallback |
| **Rischio** | Qualsiasi override CMS italiano si applica silenziosamente a utenti EN/FR/DE |
| **Fix** | Passare `locale={activeLocale}` come prop in App.js. Richiede 1 riga di codice. |
| **Blocca** | Non blocca il fix — ma è il bug più semplice e immediatamente risolvibile |

---

### P1 — Stability Risk

Questi problemi non bloccano la release ma causano inconsistenze visibili o perdita di dati di telemetria.

---

**P1-A · Validazione H3 — Risposta server `/api/locale-runtime/resolve`**

| Campo | Valore |
|---|---|
| **Descrizione** | Verificare se l'API restituisce il locale corretto dopo un cambio utente |
| **Azione** | Test manuale: cambio locale → refresh → curl `GET /api/locale-runtime/resolve` → confronto |

---

**P1-B · Fix `setLocaleInternal` `opts.silent` non implementato**

| Campo | Valore |
|---|---|
| **Descrizione** | Il parametro `silent` è ignorato → doppia chiamata API ad ogni cambio locale |
| **Fix** | Aggiungere `if (opts.silent) return;` prima delle chiamate API in `setLocaleInternal` |
| **Effort** | 3 righe di codice |

---

**P1-C · Persistenza `mfd_locale` da LocaleRuntime path**

| Campo | Valore |
|---|---|
| **Descrizione** | `LocaleRuntimeContext.setLocale()` (path autenticato) non scrive su `localStorage.mfd_locale` → flash al refresh |
| **Fix** | Aggiungere `localStorage.setItem('mfd_locale', bcp47Code)` nel path autenticato di `setLocaleInternal` dopo la chiamata API |
| **Effort** | 2 righe di codice |

---

**P1-D · IT/EN JSON de-sync — 24 chiavi rimanenti**

| Campo | Valore |
|---|---|
| **Descrizione** | Audit Consolidation ha trovato 25 chiavi presenti in IT ma non in EN. 1 fixata (`members.toast_required_fields`). Ne restano 24. |
| **Fix** | Aggiungere le 24 chiavi mancanti in `en-US.json` con traduzioni EN |
| **Effort** | ~2 ore · 24 righe di codice |

---

**P1-E · Journey Data Integrity — dangling `current_milestone_id`**

| Campo | Valore |
|---|---|
| **Descrizione** | Journey `88c072b7...` ha `current_milestone_id` impostato ma `milestones_flat = []` → `progressNarrative` non testabile, potenziale crash |
| **Fix** | Script SQL di cleanup: `UPDATE design_journeys SET current_milestone_id = NULL WHERE id = '88c072b7...' AND milestones_flat = '[]'` |
| **Effort** | Script SQL + 1 esecuzione DB |

---

### P2 — Technical Debt

Questi problemi non causano bug visibili oggi ma aumentano il rischio futuro.

---

**P2-A · Pianificazione migrazione E3 → E1**

| Campo | Valore |
|---|---|
| **Prerequisito** | Completamento P0-A + P0-B + P0-C |
| **Descrizione** | Mappa dei ~20 file che usano E3 → piano di migrazione graduale, namespace per namespace |
| **Vincolo** | I file E3 che usano il 3° arg `fallback` richiedono prima che le chiavi siano nei JSON statici |

---

**P2-B · Namespace consolidation**

| Campo | Valore |
|---|---|
| **Descrizione** | 3 namespace CRM paralleli: `crm.*` (223 chiavi) + `clientRelations.*` (59) + `leads.*` (18). "Annulla" esiste come `common.cancel` + 11 alias separati. |
| **Azione** | Definire il namespace canonico, deprecare gli alias |

---

**P2-C · `LocaleRuntimeContext.supported[]` da DB**

| Campo | Valore |
|---|---|
| **Descrizione** | `supported` è hardcodato con 9 codici — non si aggiorna se si aggiungono lingue al DB |
| **Fix** | Alimentare `supported` dalla risposta di `/api/locale-runtime/resolve` |

---

### P3 — Future Improvements

**P3-A · Translation Management Layer Blueprint**  
Schema DB + Context Menu UI per modifiche CMS inline — in attesa di istruzione utente.

**P3-B · Canonicalizzazione `buildFallbackChain`**  
Due implementazioni con lo stesso nome in `engine.js` e `languages.js` — valutare unificazione o rinomina.

**P3-C · Normalizzazione 27+ stringhe editoriali**  
Le stringhe narrative hardcodate nel JSX (DesignJourneyTab, AccountsPage, etc.) — da mettere nel Translation Management Layer quando pronto.

---

<a name="success-criteria"></a>
## Risposta ai 5 Success Criteria

### SC1 · Qual è l'effettiva source of truth per le traduzioni?

**Risposta**: Non esiste una singola source of truth — esistono due sistemi paralleli.

Per i componenti che usano **E1** (`useT` da `i18n/useT.jsx`):
> Source of truth = JSON statici (`/i18n/strings/*.json`) + runtime overrides CMS (solo IT in pratica)

Per i componenti che usano **E3** (`useBlueprint().t`):
> Source of truth = Backend dict (`/api/blueprint/i18n/{loc}`) → JSON statici → fallback hardcoded

La chiave di locale attivo per E1 viene da `LocaleRuntimeContext` (sorgente: server).  
La chiave di locale attivo per E3 viene da `BlueprintContext` (sorgente: localStorage → event bridge).

---

### SC2 · E1/E3 spiegano il refresh bug — probabile o improbabile?

**Risposta**: **Parzialmente probabile per un flash transiente. Non ancora confermato per un reset permanente.**

- E1/E3 **spiegano** una divergenza transiente al cambio locale (F2 + divergenza locale source) → PROBABILE
- E1/E3 **non spiegano necessariamente** un reset permanente dopo refresh — questo richiederebbe che la risposta server di `/api/locale-runtime/resolve` sia sbagliata (H3, non verificata)
- Il fatto confermato più rilevante per il refresh è **F1a**: `LocaleRuntimeContext.setLocale()` (autenticato) non scrive su `mfd_locale`, quindi al refresh entrambi i context partono dal locale vecchio

---

### SC3 · Come catturare i 13 missing key?

**Risposta**: Il registry è già attivo e funzionante. Procedura: navigare le 7 route indicate nel Piano D2, poi leggere `getMissing()` via GovernanceOverlay o DevTools Console. Zero modifiche al codice necessarie.

---

### SC4 · Quali problemi bloccano la stabilizzazione?

**Risposta**:
- **P0-A**: Decisione motore canonico (documentazione)
- **P0-B**: Identificazione dei 13 missing key (navigazione + console)
- **P0-C**: Fix `EditorialOverridesProvider` locale prop (1 riga codice)

---

### SC5 · Quali problemi sono solo technical debt?

**Risposta**:
- P2-A: Piano migrazione E3→E1 (non blocca nulla oggi)
- P2-B: Namespace consolidation (cosmetic/DX)
- P2-C: `supported[]` da DB (risk futuro, non attuale)
- P3-A/B/C: Future improvements

---

## Appendice — File di riferimento

| File | Ruolo |
|---|---|
| `/app/frontend/src/i18n/useT.jsx` | E1 — hook `useT()` + `BlueprintI18nProvider` |
| `/app/frontend/src/contexts/BlueprintContext.jsx` | E3 — `BlueprintProvider`, `useBlueprint().t`, E2 re-export |
| `/app/frontend/src/i18n/engine.js` | Core engine: `pickString`, `buildFallbackChain`, `setRuntimeOverrides` |
| `/app/frontend/src/design-system/missingI18nRegistry.js` | Registry missing key — già attivo |
| `/app/frontend/src/contexts/LocaleRuntimeContext.jsx` | Locale source per E1 (composite format) |
| `/app/frontend/src/i18n/EditorialOverridesProvider.jsx` | Popola runtime overrides (bug: solo IT) |
| `/app/frontend/src/site/editorial/EditorialBundleProvider.jsx` | E5 — isolato, solo site pubblico |
| `/app/frontend/src/site/content/languages.js` | Language registry + `getLanguageRegistry()` |
| `/app/frontend/src/App.js` | Gerarchia provider confermata |

---

*Report generato: 10 Giugno 2026 · Basato su analisi statica del codice sorgente · Nessuna modifica al codebase*
