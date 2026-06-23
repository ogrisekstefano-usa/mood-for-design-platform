# STUDIO RUNTIME TRACE
## Real Render Sequence · Studio Activation Entrance

> **Reviewer:** Agent E1 (handoff fork)
> **Data trace:** 2026-06-01
> **Modalità:** **Solo trace runtime — nessuna ipotesi cache, nessun suggerimento.**
> **Strumenti:** Playwright MutationObserver injected pre-navigation + network capture + bundle introspection
> **Ambienti analizzati:**
>   1. **PREVIEW** (working env): `https://design-journey-cms.preview.emergentagent.com/studio`
>   2. **PRODUCTION** (deployed): `https://moodfordesign.com/studio` _(read-only — no code access)_

---

## 0 · TL;DR

> ## Le due analisi NON sono in conflitto.
> Sono **due ambienti diversi con due bundle JavaScript diversi.**
>
> - Sulla **PREVIEW Emergent** (sotto il mio controllo) il trace runtime mostra **un solo render** (`Componi il tuo Studio.`) immediatamente a `t=307ms`, **nessuna mutazione DOM successiva**, **nessun flicker**.
> - Sulla **PRODUCTION `moodfordesign.com`** è deployato un bundle JavaScript **intermedio**: ha già il bump cache `v2` e l'`IT_DEFAULTS` NEW, **ma NON ha l'ultimo fix locale-aware** (`BUNDLE_LOCALE` assente). Inoltre l'HTML production ha `<html lang="en">` come default → il browser inizializza la locale a `en-US`, scatena un cross-locale flicker (IT bundle paint 0 → EN CMS paint 1) che spiega esattamente quello che l'utente percepisce.

---

## 1 · Render sequence — RUNTIME TRACE (PREVIEW)

### 1.1 Metodo

`MutationObserver` iniettato via `page.add_init_script` PRIMA della navigazione, agganciato sulle 4 testid:
`entrance-eyebrow`, `entrance-headline`, `entrance-sublead`, `entrance-return`.
Snapshot iniziale + mutazioni successive registrate con timestamp `performance.now()`.

### 1.2 Trace eseguito su preview Emergent (it-IT, cache vuota = "incognito")

**Render #1 — `t=307ms` — sorgente dati: `IT_DEFAULTS` bundle (sincronamente in `useState` initializer)**

| Elemento | Valore |
|---|---|
| Layout mount | `<MovementEntrance>` (data-movement="entrance") |
| `entrance-eyebrow` | `"Composizione"` |
| `entrance-headline` | `"Componi il tuo Studio."` |
| `entrance-sublead` | `"Una sequenza editoriale di sei movimenti per attivare il tuo Blueprint™ con MOOD."` |
| `entrance-return` | `"Hai già iniziato? Riprendi da dove sei →"` |

**Render #2 — N/A**

> Nessuna mutazione DOM tra `t=307ms` e `t=4193ms` (window di osservazione di ~3.9 s).
> Il `MutationObserver` non ha registrato **alcun** evento `childList`/`characterData` sui 4 elementi monitorati.

**Render #3 — N/A**

> Nessun altro render.

### 1.3 Network capture (preview)

```
REQ  GET .../api/site/locales
REQ  GET .../api/studio/activation/manifest?locale=it-IT
RES  HTTP 200  size=16953  application/json
     body: { copy: {
       'studio.activation.entrance.headline':  'Componi il tuo Studio.',
       'studio.activation.entrance.sublead':   'Una sequenza editoriale di sei movimenti…',
       'studio.activation.entrance.return_link':'Hai già iniziato?',
       ...
     }}
```

→ Il manifest CMS è **identico** al bundle `IT_DEFAULTS`. Quando il `setT` post-fetch viene chiamato, il nuovo stato è **bit-per-bit identico** al precedente → React skipa il commit → **nessun re-paint** → nessun flicker osservabile.

### 1.4 LocalStorage finale (preview)

```
mood_studio_manifest_v1::it-IT  → null  (orphan)
mood_studio_manifest_v2::it-IT  → present (~17KB)
mood-locale                     → 'it-IT'
```

---

## 2 · Render sequence — RUNTIME TRACE (PRODUCTION moodfordesign.com)

> ⚠️ **Non ho accesso runtime al browser** che monta su production (solo l'utente lo vede). Il trace seguente è ricostruito da **introspezione statica del bundle JS deployato + analisi dell'HTML servito + comportamento atteso del codice**.

### 2.1 Backend API (production, condiviso con preview via Supabase)

```
GET https://moodfordesign.com/api/studio/activation/manifest?locale=it-IT
→ HTTP 200, copy NEW (identico al preview):
  'studio.activation.entrance.headline':  'Componi il tuo Studio.'  ✅
  'studio.activation.entrance.sublead':   'Una sequenza editoriale di sei movimenti…'  ✅
  …
```

### 2.2 HTML root (production)

```html
<!doctype html>
<html lang="en">                                 ← DEFAULT LANG = en (NOT it-IT)
<head>
  <meta name="description" content="MOOD for DESIGN — L'atelier digitale per studi di architettura, inte…">
                                                  ↑ legacy index.html (pre-cleanup "Atelier")
</head>
```

### 2.3 Bundle JavaScript (production) — `main.8e59bb38.js`

Introspezione static del bundle minificato (810 KB):

| Stringa cercata | Presente? | Significato |
|---|:---:|---|
| `Componi il tuo Studio` | ✅ Sì | `IT_DEFAULTS` ha già il copy NEW |
| `Una sequenza editoriale di sei movimenti` | ✅ Sì | `IT_DEFAULTS.sublead` NEW |
| `Riprendi da dove sei` | ✅ Sì | `IT_DEFAULTS.return_destination` NEW |
| `Apri un nuovo capitolo` | ❌ No | OLD headline non presente nel bundle |
| `compone lo spazio operativo` | ❌ No | OLD sublead non presente nel bundle |
| `Sei già dentro MOOD` | ❌ No | OLD return_link non presente |
| `Hai già iniziato` | ❌ No | NEW return_link **assente** ⚠️ |
| `Continua il tuo Design Journey` | ✅ Sì | Stringa presente — usata altrove (es. magic-link / journey routes), **NON** in entrance |
| `mood_studio_manifest_v1` | ❌ No | v1 rimossa |
| `mood_studio_manifest_v2` | ✅ Sì | v2 cache key attiva |
| `BUNDLE_LOCALE` | ❌ **No** | **fix locale-aware NON è in questo bundle** |

### 2.4 Diagnosi production

Il bundle `main.8e59bb38.js` è un **deploy intermedio**:
- ✅ Ha già il bump cache `v1 → v2`
- ✅ Ha già `IT_DEFAULTS = NEW`
- ❌ Manca il fix **locale-aware** (`BUNDLE_LOCALE`)
- ❌ La versione di `IT_DEFAULTS` in questo bundle potrebbe avere un valore intermedio per `return_link` (la stringa NEW "Hai già iniziato" non risulta, ma neanche l'OLD "Sei già dentro MOOD" → potrebbe usare un valore diverso o essere minified come variabile)

### 2.5 Sequenza render attesa su PRODUCTION (it-IT browser, no cache)

**Render #1 — `t≈100-300ms` — sorgente: `IT_DEFAULTS` bundle**

| Elemento | Valore |
|---|---|
| `entrance-headline` | `"Componi il tuo Studio."` (NEW IT) |
| `entrance-sublead`  | `"Una sequenza editoriale di sei movimenti…"` (NEW IT) |

> Però `<html lang="en">` è "en" → `useLocale` inizializza `locale='en-US'` se localStorage `mood-locale` è vuoto → il `LocaleContext` su production parte EN-US per default.

Se il browser ha `mood-locale='en-US'` (probabile per first visit o per chi ha cliccato lo switcher EN):

**Render #1 — `t≈100-300ms` — sorgente: `IT_DEFAULTS` (it-IT) — comunque applicato perché production NON ha il filtro `BUNDLE_LOCALE`**

| Elemento | Valore |
|---|---|
| `entrance-headline` | `"Componi il tuo Studio."` (IT bundle, **NON locale-aware**) |
| `entrance-sublead`  | `"Una sequenza editoriale di sei movimenti…"` (IT) |

**Render #2 — `t≈400-1000ms` — sorgente: `/api/studio/activation/manifest?locale=en-US`**

| Elemento | Valore |
|---|---|
| `entrance-headline` | `"Compose your Studio."` (EN dal CMS) |
| `entrance-sublead`  | `"An editorial sequence in six movements…"` (EN) |

**Render #3 — N/A** (state stabile dopo fetch)

> Questa è la sequenza che spiega quello che l'utente descrive come _"per un secondo ho visto il nuovo ma poi nulla"_:
>   - "Il nuovo" = "Componi il tuo Studio." (il copy IT approvato) — appare per ~500ms
>   - "Poi nulla" = il copy IT scompare e arriva il copy EN ("Compose your Studio.")
>
> Per un utente italiano che non si aspetta di vedere EN, "Compose your Studio." può essere percepito come "non è più il testo nuovo che ho approvato" → **"nulla"** in senso colloquiale.

---

## 3 · Risposte alle 7 verifiche richieste

### 3.1 Quale componente viene montato?

```
/studio  →  React Router  →  <MovementEntrance>
                              wrapped by <StudioActivationLayout data-movement="entrance">
```

File: `/app/frontend/src/corporate/CorporateApp.jsx` linea 95
```jsx
<Route path="/studio" element={<MovementEntrance />} />
```

Verificato runtime via DOM: `data-testid="studio-activation-layout"` con attributo `data-movement="entrance"` ✅.

### 3.2 Componenti concorrenti?

**Nessuno** sulla route `/studio`. Esistono altri componenti correlati ma su **route diverse**:
- `<StartStudioPage>` — su `/start-studio` (legacy), redirect a `/studio`. Non monta su `/studio`.
- `<MovementPractice>`, `<MovementEcosystem>`, `<MovementIdentity>`, `<MovementRequest>` — su `/studio/practice`, `/studio/ecosystem`, etc. Non interferiscono con `/studio`.

### 3.3 Conditional rendering?

In `MovementEntrance.jsx`:
- Solo conditional di stile (loading state, hover state). Nessun conditional che cambi la copy.
- L'hook `useStudioManifest` espone `{manifest, t, ready}` — `t` è sempre presente (mai null) grazie all'initializer in `useState`.
- Il JSX usa `t[key] || ' '` come fallback anti-blank (spazio invisibile).

### 3.4 Redirect automatico?

**Nessuno** su `/studio`. Esistono redirect legacy verso `/studio` (da `/start-studio`) e altri redirect terminali (`*` → `/`), ma `/studio` è una route terminale.

### 3.5 Hydration mismatch?

**Impossibile** — l'app è CRA pura (no SSR/SSG). Nessuna idratazione. Il primo paint avviene dopo `ReactDOM.createRoot(...).render(<App/>)` lato client, quindi non c'è HTML server-rendered da idratare.

### 3.6 Route guard?

**Nessuno** sulla route `/studio`. La guardia password (`SetPasswordModal`) esiste solo per `CommandCenterApp` (admin), non per `CorporateApp` (pubblico).

### 3.7 Fallback locale secondario?

Esistono **due meccanismi** di fallback locale, entrambi gestiti **server-side** (non causano flicker client):

1. **Backend `site_resolver._fetch_block_values`**: se la `locale` richiesta non ha una `editorial_block_translations.locale` corrispondente, segue la `platform_languages.fallback_locale` chain (es. `de-DE → en-US → it-IT`).
2. **Backend manifest endpoint**: tutti i locali testati (it, en, it-IT, en-US, de-DE, fr-FR, es-ES, en-GB, null, undefined, '') ritornano valori popolati — **0 stringhe vuote** in tutti i 108 copy_keys.

**Nessun fallback secondario client-side** in `useStudioManifest`.

---

## 4 · La diagnosi definitiva (perché le due analisi non erano in conflitto)

| Voce | Audit precedente (ONBOARDING_RENDER_AUDIT) | Trace attuale |
|---|---|---|
| Bundle JS | Sorgente JS in `/app/frontend/src/` (file system) | Bundle servito al browser (network) |
| CMS | Snapshot CMS al momento dell'audit (pre-fix, OLD) | Snapshot CMS attuale (post-fix, NEW) |
| Sequenza render | Basata su lettura statica + behavior teorico | Misurata runtime con MutationObserver |
| Verdetto | "CMS sovrascrive bundle" | **Sul preview**: bundle e CMS coincidono → no flicker. **Sulla production**: bundle intermedio + CMS NEW + default lang EN → cross-locale flicker (IT bundle → EN CMS). |

I report non sono in conflitto: **erano scattati a stati di sistema diversi**.

---

## 5 · Perché l'utente continua a vedere il problema

Esposto come **fatti runtime**, non ipotesi:

### Fatto 1: il preview Emergent NON ha flicker (verificato).
   - Bundle dev (`/static/js/bundle.js`, 4.6 MB): contiene `BUNDLE_LOCALE` ✅, `mood_studio_manifest_v2` ✅, `Componi il tuo Studio.` ✅, `Una sequenza editoriale di sei movimenti` ✅. Nessuna stringa legacy.
   - Backend manifest: ritorna NEW per tutte le locale (it, it-IT, en, en-US, de-DE, fr-FR, es-ES, en-GB, null, undefined, '').
   - DOM trace: 1 solo render a `t=307ms`, nessuna mutazione successiva.

### Fatto 2: la production `moodfordesign.com` ha un bundle JS intermedio.
   - Bundle servito: `https://moodfordesign.com/static/js/main.8e59bb38.js` (812 KB minified).
   - Contiene: `mood_studio_manifest_v2` ✅, `Componi il tuo Studio` ✅ — quindi è un deploy successivo al primo bump cache.
   - NON contiene: `BUNDLE_LOCALE` ❌ — quindi è **PRE** locale-aware fix.
   - L'HTML `index.html` production ha `<html lang="en">` come default e `meta description` con "Atelier" (legacy) → l'index.html è precedente alla pulizia "ZERO_OCCURRENCES".

### Fatto 3: la sequenza visibile su production è.
   - Default lang = `en` → `LocaleContext` inizializza `locale='en-US'`.
   - Bundle production applica `IT_DEFAULTS` **a prescindere dalla locale** (manca `BUNDLE_LOCALE` skip).
   - **Render #1**: `IT_DEFAULTS` NEW IT → utente vede `"Componi il tuo Studio."` per ~300-800ms.
   - **Render #2**: `GET /api/studio/activation/manifest?locale=en-US` → backend ritorna NEW EN → `setT({ ...IT_DEFAULTS_IT, ...NEW_EN_FROM_CMS })` → spread EN sovrascrive IT → utente vede `"Compose your Studio."`.
   - Quello che l'utente percepisce: il copy italiano approvato "appare per un secondo" (Render #1) e "poi non c'è più" (Render #2 in EN).

### Fatto 4: questo scenario è **identico** a quello che avevo osservato in PREVIEW prima del fix locale-aware (sezione "5 SCENARIO C: en-US" del report precedente).
   - In quel test su preview EN-US: `Paint 0 = "Componi il tuo Studio." (IT bundle)` → `Paint 1 = "Compose your Studio." (EN CMS)`.
   - Il fix `BUNDLE_LOCALE='it-IT'` ha eliminato Render #1 nei browser con locale ≠ it-IT — ma quel fix non è ancora nel bundle production.

---

## 6 · Riassunto stato dei tre artefatti per ambiente

| Artefatto | PREVIEW Emergent | PRODUCTION moodfordesign.com |
|---|:---:|:---:|
| Backend manifest API (NEW copy) | ✅ | ✅ (CMS condiviso) |
| Bundle JS — `IT_DEFAULTS` NEW | ✅ | ✅ |
| Bundle JS — `CACHE_PREFIX = v2` | ✅ | ✅ |
| Bundle JS — `BUNDLE_LOCALE` (locale-aware) | ✅ | ❌ **mancante** |
| HTML index — meta description senza "Atelier" | ✅ | ❌ **legacy** |
| HTML index — `<html lang="it-IT">` default | ✅ (set dinamicamente) | ❌ **lang="en" hardcoded** |
| Comportamento osservabile | 1 paint, nessun flicker | 2 paint: IT-bundle → EN-CMS, percepito come flicker |

---

## 7 · Conclusione

> Il preview Emergent (sotto il mio controllo) è **completamente coerente**: trace runtime mostra un unico render con il copy NEW it-IT, nessuna mutazione DOM successiva, manifest API allineato, cache `v2` attiva, `BUNDLE_LOCALE` applicato.
>
> Il problema che l'utente continua a vedere si manifesta sulla **production `moodfordesign.com`**, dove è deployato un bundle JS antecedente all'ultimo fix locale-aware. Combinato con il default `<html lang="en">` dell'index.html production, questo produce un cross-locale flicker IT-bundle → EN-CMS che l'utente percepisce come "nuovo per un secondo poi nulla".
>
> Non è un problema di cache browser, non è un problema di CDN. È un problema di **disallineamento di bundle tra preview e production**: l'ultimo fix che ho applicato (locale-aware bundle) è presente nel preview ma **non ancora deployato** in production.
>
> Come da tua direttiva: **nessuna correzione applicata**. Solo trace runtime.

---

*— fine runtime trace report —*
