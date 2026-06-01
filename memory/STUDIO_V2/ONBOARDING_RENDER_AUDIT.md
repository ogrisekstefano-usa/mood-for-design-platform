# ONBOARDING RENDER AUDIT
## Root Cause Analysis · Studio Activation Flicker

> **Issue verbale dall'utente:** _"L'onboarding mostra per un istante il nuovo contenuto e poi ritorna al vecchio."_
> **Ambito:** `/studio` (Movement I — Entrance) e l'intero funnel di Studio Activation (5 movimenti)
> **Modalità:** **Solo RCA — nessuna correzione applicata, nessun deploy, nessun aggiornamento CMS.**
> **Reviewer:** Agent E1 (handoff fork) — 2026-05-31

---

## 0 · TL;DR

> ## 🎯 ROOT CAUSE
>
> **Il file `useStudioManifest.js` contiene un blocco hardcoded `IT_DEFAULTS` con il copy NUOVO** (versione `STUDIO_V2`), che viene mostrato al primo paint. Subito dopo, un `useEffect` esegue `GET /api/studio/activation/manifest?locale=it-IT` e il backend restituisce il copy **VECCHIO** (versione `ITER160`, ancora presente nel CMS `editorial_blocks`). Il merge nel reducer di stato del React è:
>
> ```js
> setT({ ...IT_DEFAULTS, ...(r.data?.copy || {}) })
> //     ^^^^^^^^^^^^^^   ^^^^^^^^^^^^^^^^^^^^^^^
> //     NEW (paint 0)    OLD (CMS — vince per spread order)
> ```
>
> Lo **spread del CMS è dopo lo spread di `IT_DEFAULTS`**, quindi le chiavi CMS sovrascrivono i defaults bundled. Risultato: NEW lampeggia per ~200–800ms, poi viene sostituito da OLD.

---

## 1 · Componenti coinvolti

### 1.1 Componente che renderizza gli step
| Component | File | Movimento | Note |
|---|---|---|---|
| `MovementEntrance` | `/app/frontend/src/corporate/pages/studio/MovementEntrance.jsx` | I — Entrance | **Pagina entry `/studio`** |
| `MovementPractice` | `…/MovementPractice.jsx` | II — Practice | `/studio/practice` |
| `MovementEcosystem` | `…/MovementEcosystem.jsx` | III — Ecosystem | `/studio/ecosystem` |
| `MovementIdentity` | `…/MovementIdentity.jsx` | IV — Identity | `/studio/identity` |
| `MovementRequest` | `…/MovementRequest.jsx` | V — Request/Submit | `/studio/activate` |
| `StudioActivationLayout` | `…/StudioActivationLayout.jsx` | Chrome editoriale comune | Wrapper |

Tutti e 5 i componenti usano il **medesimo hook** `useStudioManifest` (`…/useStudioManifest.js`).

### 1.2 Sequenza render esatta — `MovementEntrance`

```
[paint 0 — Components mount]
   useStudioManifest() invocato
   ├─ readCache(locale)                → null (first visit) o {ts,data} (returning)
   ├─ useState(t) = { ...IT_DEFAULTS, ...(cached?.copy || {}) }
   │  └─ first visit  → t = IT_DEFAULTS                                 (NEW)
   │  └─ returning ≤24h → t = {NEW, ...OLD-cached}                       (OLD takes over)
   ├─ React renders → t['studio.activation.entrance.headline'] mostrato
   │
[useEffect fires after first paint]
   ├─ axios.get(/api/studio/activation/manifest?locale=…)
   │  └─ response { copy: {...OLD CMS values...} }   (~150–800ms)
   ├─ setT({ ...IT_DEFAULTS, ...(r.data.copy || {}) })
   │  └─ OLD overwrites NEW
   ├─ writeCache(locale, data)          → la cache locale diventa OLD per 24h
   └─ React re-renders → OLD mostrato
```

**È esattamente il "flash NEW → OLD" che hai osservato.**

---

## 2 · Sorgenti di verità coinvolte

### 2.1 Hardcoded bundle JS (NEW — vince al paint 0)
**File:** `/app/frontend/src/corporate/pages/studio/useStudioManifest.js` linee 24-31

```js
const IT_DEFAULTS = {
  'studio.activation.entrance.eyebrow':            'Composizione',
  'studio.activation.entrance.headline':           'Componi il tuo Studio.',
  'studio.activation.entrance.sublead':            'Una sequenza editoriale di sei movimenti per attivare il tuo Blueprint™ con MOOD.',
  'studio.activation.entrance.cta':                'Inizia la composizione',
  'studio.activation.entrance.return_link':        'Hai già iniziato?',
  'studio.activation.entrance.return_destination': 'Riprendi da dove sei',
};
```

Copre **solo Movement I** (6 chiavi). I movimenti II–V non hanno fallback bundled → al paint 0 mostrano stringhe vuote (l'hook fa `t[key] || ' '` per evitare blank fatale).

### 2.2 CMS Supabase (OLD — vince dopo il fetch)
**Tabella:** `editorial_blocks` (+ `editorial_block_translations`) — namespace `studio.activation`

| block_key | source_value (CMS) | Updated at |
|---|---|---|
| `entrance.eyebrow` | "Composizione" | 2026-05-31 20:46:35 UTC |
| `entrance.headline` | **"Apri un nuovo capitolo del tuo studio."** | 2026-05-31 20:46:35 UTC |
| `entrance.sublead` | **"MOOD for DESIGN compone lo spazio operativo delle pratiche che modellano l'interior contemporaneo."** | 2026-05-31 20:46:35 UTC |
| `entrance.cta` | "Inizia la composizione" | 2026-05-31 20:46:35 UTC |
| `entrance.return_link` | **"Sei già dentro MOOD?"** | 2026-05-31 20:46:35 UTC |
| `entrance.return_destination` | **"Continua il tuo Design Journey"** | 2026-05-31 20:46:35 UTC |

> Tutti i 6 blocchi sono `is_active=true` e tutti hanno **una sola traduzione** `it-IT` allineata al `source_value`.

### 2.3 Endpoint backend (relayer del CMS)
**File:** `/app/backend/services/studio_activation.py`

- `manifest()` (linee 240-300+): restituisce un dict statico hardcoded (immagini, archetypes, copy_keys lista di 108 chiavi). **Non contiene il copy in chiaro** — solo l'elenco delle chiavi da risolvere.
- `manifest_with_copy(locale='it')` (linee 391-405): chiama `_fetch_block_values(session, tenant_id, keys, locale)` di `services/site_resolver.py` per popolare `base['copy'] = {k: values.get(k) or ''}`.

Il valore restituito dal manifest endpoint dipende **interamente** dallo stato attuale del CMS. Verificato live:

```bash
$ curl /api/studio/activation/manifest?locale=it-IT | jq .copy
{
  "studio.activation.entrance.cta": "Inizia la composizione",
  "studio.activation.entrance.eyebrow": "Composizione",
  "studio.activation.entrance.headline": "Apri un nuovo capitolo del tuo studio.",    ← OLD
  "studio.activation.entrance.return_destination": "Continua il tuo Design Journey",  ← OLD
  "studio.activation.entrance.return_link": "Sei già dentro MOOD?",                   ← OLD
  "studio.activation.entrance.sublead": "MOOD for DESIGN compone lo spazio operativo delle pratiche che modellano l'interior contemporaneo."  ← OLD
}
```

### 2.4 LocalStorage cache (vincola visite successive)
**Key pattern:** `mood_studio_manifest_v1::<locale>`
**TTL:** 24 ore
**Effetto:** Dalla seconda visita entro 24h, lo stato iniziale di `t` è già "OLD + IT_DEFAULTS sotto" — il flicker NEW non si verifica perché la cache risolve sincrono in `useState` initializer, **ma il copy mostrato resta OLD permanentemente** finché:
- (a) la cache scade (24h), o
- (b) l'utente svuota localStorage, o
- (c) il CMS viene aggiornato e ri-fetchato (ma siccome la priorità è sempre CMS > IT_DEFAULTS, l'OLD continuerà a vincere finché il CMS non viene aggiornato).

---

## 3 · Diff per chiave (NEW bundle vs OLD CMS)

| Chiave | NEW (bundle, paint 0) | OLD (CMS, paint 1+) | Vince render finale |
|---|---|---|---|
| `entrance.eyebrow` | `"Composizione"` | `"Composizione"` | ✅ Stessa stringa — no diff visibile |
| `entrance.headline` | `"Componi il tuo Studio."` | `"Apri un nuovo capitolo del tuo studio."` | **OLD (CMS)** |
| `entrance.sublead` | `"Una sequenza editoriale di sei movimenti per attivare il tuo Blueprint™ con MOOD."` | `"MOOD for DESIGN compone lo spazio operativo delle pratiche che modellano l'interior contemporaneo."` | **OLD (CMS)** |
| `entrance.cta` | `"Inizia la composizione"` | `"Inizia la composizione"` | ✅ Stessa stringa — no diff visibile |
| `entrance.return_link` | `"Hai già iniziato?"` | `"Sei già dentro MOOD?"` | **OLD (CMS)** |
| `entrance.return_destination` | `"Riprendi da dove sei"` | `"Continua il tuo Design Journey"` | **OLD (CMS)** |

> **4 chiavi su 6** mostrano un diff visibile NEW → OLD durante il flicker.
> **2 chiavi su 6** (eyebrow, cta) coincidono nelle due fonti — non flickrano.

---

## 4 · Per gli altri 4 Movimenti (II–V)

I componenti `MovementPractice`, `MovementEcosystem`, `MovementIdentity`, `MovementRequest` usano lo stesso hook `useStudioManifest` ma **non hanno chiavi corrispondenti in `IT_DEFAULTS`**.

Quindi:

| Movimento | Paint 0 | Paint 1+ (post-fetch) | Comportamento |
|---|---|---|---|
| I — Entrance | NEW (6 chiavi bundle) | OLD (CMS) | **Flicker visibile** |
| II — Practice | _stringhe vuote `' '`_ | OLD (CMS) | "Pop-in" — testo appare dopo il primo paint, ma non flicker |
| III — Ecosystem | _stringhe vuote `' '`_ | OLD (CMS) | "Pop-in" |
| IV — Identity | _stringhe vuote `' '`_ | OLD (CMS) | "Pop-in" |
| V — Request | _stringhe vuote `' '`_ | OLD (CMS) | "Pop-in" |

Il fenomeno descritto (flash NEW → OLD) si manifesta **solo su `/studio` (Movement I)**, perché è l'unico movimento con bundle defaults.

---

## 5 · Feature flags / Version switches / Namespace duplicati / Legacy blocks

Scansione completa eseguita su `/app/backend/` e `/app/frontend/src/`:

| Tipo | Esito | Note |
|---|:---:|---|
| Feature flags | ❌ Nessuno | grep `feature_flag\|version_switch\|onboarding_v\|activation_v2`: 0 risultati funzionali |
| Version switch | ❌ Nessuno | Nessun selector tra `studio.activation` e `studio.activation.v2`. L'unico riferimento a "STUDIO_V2" è il nome della cartella documentale `/app/memory/STUDIO_V2/` (no impatto runtime) |
| Namespace duplicati | ❌ Nessuno | `editorial_blocks.namespace = 'studio.activation'` è univoco; ogni `block_key` unico per `(tenant_id, namespace, block_key)` (UNIQUE constraint) |
| Blocchi legacy CMS | ⚠️ **Sì — sono proprio loro che vincono il render** | I 6 blocchi `studio.activation.entrance.*` nel CMS sono **gli stessi seedati da `seed_iter160_studio_phase1.py` (mar 2026)**. Non c'è una versione "v2" parallela — i blocchi attivi sono uno per chiave e contengono il copy OLD. |
| Conflitti di hook | ❌ Nessuno | Tutti i Movimenti usano `useStudioManifest` (singolo hook), no varianti |
| Conflitti di endpoint | ❌ Nessuno | Solo `/api/studio/activation/manifest` esposto |
| CDN / SW cache | ❌ Nessuno | No Service Worker registrato sul frontend. La cache è esclusivamente `localStorage` lato client |

> **L'unico "version switch" effettivo è la priorità di merge nel `setT(...)` del hook**, che decide chi vince tra NEW (bundle) e OLD (CMS).

---

## 6 · Perché _appare per un istante_ il nuovo e poi viene sostituito dal vecchio

Sequenza temporale precisa, con riferimenti al codice:

| Tempo | Evento | Cosa è visibile |
|---|---|---|
| `t=0ms` | React mount di `MovementEntrance` → `useStudioManifest()` invocato | — |
| `t=0ms` | `readCache(locale)` legge `localStorage['mood_studio_manifest_v1::it-IT']` | First visit: `null` |
| `t=0ms` | `useState(t)` inizializza a `{ ...IT_DEFAULTS, ...(null?.copy \|\| {}) }` = **IT_DEFAULTS** | (stato in memoria — non ancora renderizzato) |
| `t=~50ms` | **Paint 0 — React commit del primo render** | ✅ NEW copy visibile: _"Componi il tuo Studio. — Una sequenza editoriale di sei movimenti per attivare il tuo Blueprint™ con MOOD."_ |
| `t=~50ms` | `useEffect(...)` fires → `axios.get('/api/studio/activation/manifest?locale=it-IT')` | (rete) |
| `t=~250-800ms` | Risposta backend con `copy = {OLD CMS values}` | (rete completata) |
| `t=~270-820ms` | `setT({ ...IT_DEFAULTS, ...(r.data.copy \|\| {}) })` — **CMS OVERRIDES IT_DEFAULTS** | (stato in memoria aggiornato) |
| `t=~280-830ms` | **Paint 1 — re-render** | ❌ OLD copy visibile: _"Apri un nuovo capitolo del tuo studio. — MOOD for DESIGN compone lo spazio operativo delle pratiche che modellano l'interior contemporaneo."_ |
| `t=~280-830ms` | `writeCache(locale, r.data)` — localStorage ora contiene OLD | Persistenza locale |
| Visite successive ≤24h | `readCache` ritorna OLD direttamente | First paint = OLD, no flicker, **ma copy resta OLD** |

> Il **flash NEW → OLD** che hai osservato è di circa **200ms-1s** (dipende dalla latenza Supabase EU-West-1 → preview K8s) ed è **deterministico** per ogni first visit dopo cache miss / cache expiry.

---

## 7 · "Chi vince" — riepilogo finale

| Sorgente | Priorità nel merge React | Chi vince all'utente |
|---|---:|---|
| `IT_DEFAULTS` bundle (NEW) | base (1° spread) | ❌ Perde dopo `t=~280ms` |
| `cached?.copy` (OLD da localStorage) | 2° spread (in `useState` initializer) | ✅ Vince al paint 0 per returning visitors |
| `r.data.copy` (OLD da CMS — fresh) | 2° spread (in `setT` post-fetch) | ✅ Vince per tutti dopo il fetch |
| Stringa vuota `' '` fallback in JSX (`t[key] \|\| ' '`) | salvataggio anti-blank | Mai visibile se almeno una sorgente esiste |

**Vincitore stabile del render finale, per tutti i visitatori:** **CMS (copy OLD)**.

---

## 8 · Implicazioni e considerazioni di natura RCA

> ⚠️ Le seguenti sono **osservazioni**, non azioni: nessuna correzione viene proposta in questo report.

1. **Il bundle `IT_DEFAULTS` è di fatto un "fantasma cosmico"**: viene mostrato per ~200-800ms e poi sovrascritto definitivamente. Non porta beneficio funzionale duraturo (l'utente vede solo OLD entro 1 secondo).

2. **Per i Movimenti II-V, non c'è bundle**: il primo paint è "soft empty" (stringhe `' '`) finché non arriva il manifest, e quando arriva mostra direttamente OLD. Nessun flicker NEW→OLD per questi movimenti, ma c'è "pop-in" del testo.

3. **Il CMS contiene il copy `ITER160` (mar 2026)**, antecedente alla canonical doc `STUDIO_ACTIVATION_LIFECYCLE.md` di `STUDIO_V2`. Il documento V2 è stato approvato ma **non è mai stato applicato al CMS** — è ancora solo brief documentale.

4. **La cache locale `mood_studio_manifest_v1::<locale>` (TTL 24h)** intrappola l'OLD per 24h dopo il primo fetch. Anche se aggiornassimo il CMS, gli utenti che hanno visitato la pagina nelle ultime 24h vedrebbero ancora OLD finché la cache non scade. Per un rollout pulito di un eventuale fix sarà utile considerare il CACHE_PREFIX (`v1`) come elemento di versioning manuale.

5. **`copy_keys` nel backend contiene 108 chiavi** ma `IT_DEFAULTS` ne copre solo 6 (Entrance). L'asimmetria suggerisce che il bundle è stato un add-on tattico per evitare blank-flash sulla landing page, non una strategia coerente di internazionalizzazione client-side.

6. **Nessuna divergenza locale**: il problema è isolato a `it-IT` (l'unica locale attivamente popolata in CMS per `studio.activation.*`). In `en-US` il manifest restituisce stringhe vuote o fallback `_default` per ogni chiave (l'iter160 era IT-only).

---

## 9 · File di riferimento

| Path | Ruolo |
|---|---|
| `/app/frontend/src/corporate/pages/studio/useStudioManifest.js` | Hook + IT_DEFAULTS bundle (NEW) |
| `/app/frontend/src/corporate/pages/studio/MovementEntrance.jsx` | Componente Movement I |
| `/app/frontend/src/corporate/pages/studio/MovementPractice.jsx` | Movement II |
| `/app/frontend/src/corporate/pages/studio/MovementEcosystem.jsx` | Movement III |
| `/app/frontend/src/corporate/pages/studio/MovementIdentity.jsx` | Movement IV |
| `/app/frontend/src/corporate/pages/studio/MovementRequest.jsx` | Movement V |
| `/app/frontend/src/corporate/pages/studio/StudioActivationLayout.jsx` | Chrome editoriale comune |
| `/app/backend/services/studio_activation.py` | `manifest_with_copy()` + lista `copy_keys` |
| `/app/backend/services/site_resolver.py` | `_fetch_block_values` (resolver CMS) |
| `/app/backend/db/seed_iter160_studio_phase1.py` | Seed iniziale del copy `studio.activation.entrance.*` — copy OLD |
| `editorial_blocks` table | CMS source of truth (Supabase PostgreSQL) |

---

## 10 · Conclusioni

> **Non è un problema di deploy.** Il preview è coerente, il deploy production riflette esattamente lo stesso comportamento (avendo lo stesso CMS Supabase come backing store).
>
> **Non è un cache problem in senso CDN/SW.** Non c'è cache HTTP rilevante per `/api/studio/activation/manifest` (verificare comunque le headers `Cache-Control` lato backend per completezza).
>
> **È un disallineamento di sorgenti di verità nel codice client:** un bundle JS hardcoded `IT_DEFAULTS` (NEW) viene mostrato per primo, ma il merge con il CMS (OLD) avviene con priorità a vantaggio del CMS, generando il flicker NEW → OLD.
>
> Le decisioni di **come risolvere** (CMS update vs rimozione bundle vs inversione priorità merge vs version-switching) **non sono incluse in questo report** come da tua direttiva.

---

*— fine RCA report —*
