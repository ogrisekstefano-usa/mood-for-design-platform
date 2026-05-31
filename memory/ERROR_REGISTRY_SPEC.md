# MOOD Error Registry™ — SPECIFICATION
## "L'utente non deve mai vedere errori tecnici"

> **Status:** 🔒 ARCHITECTURE SPEC · 31 May 2026 · zero modifica codice
> **Vincolo Founder:** sostituire ogni "Request failed with status code 404" con messaggi umani.

---

## §0 · Filosofia

Ogni errore esposto all'utente deve:

1. **Essere umano** (linguaggio naturale, italiano nativo)
2. **Essere identificabile** (codice univoco `DOMAIN-NNN`)
3. **Essere azionabile** (sempre suggerire una `ACTION`)
4. **Mantenere debug info backstage** (HTTP status + technical details in console DevTools, non in UI)
5. **Essere localizzabile** (i18n ready)

---

## §1 · Schema canonico di un errore

```json
{
  "code":         "AUTH-001",
  "title":        "Sessione scaduta",
  "description": "La tua sessione è terminata per inattività. Per continuare devi accedere di nuovo.",
  "action":       "Vai al login",
  "action_href":  "/login",
  "severity":     "warning",
  "telemetry": {
    "http_status": 401,
    "backend_code": "session_expired",
    "trace_id":   "..."
  }
}
```

Campi:
- **`code`** (string, format `DOMAIN-NNN`): univoco · stabile · documentato
- **`title`** (string, ≤ 60 chars): titolo breve, action-friendly
- **`description`** (string, ≤ 240 chars): spiegazione umana
- **`action`** (string ≤ 40 chars): label del CTA
- **`action_href`** (string): URL or `null`
- **`severity`** (enum `info | warning | error | critical`): UI styling
- **`telemetry`** (object): dettagli per dev tools (no UI)

---

## §2 · Catalogo iniziale (proposed)

### 2.1 · AUTH domain

| Code | Title | Description | Action |
|---|---|---|---|
| **AUTH-001** | Sessione scaduta | La tua sessione è terminata. Accedi di nuovo per continuare. | Vai al login |
| **AUTH-002** | Credenziali non valide | Email o password non corretti. Riprova o usa "Password dimenticata". | Riprova |
| **AUTH-003** | Account sospeso | Il tuo account è momentaneamente sospeso. Contatta il tuo studio per riattivarlo. | Contatta supporto |
| **AUTH-004** | Email già registrata | Questa email risulta già usata. Vuoi accedere o resettare la password? | Accedi |
| **AUTH-005** | Magic link scaduto | Il link di accesso non è più valido. Richiedine uno nuovo dalla pagina di login. | Richiedi un nuovo link |
| **AUTH-006** | Profilo non trovato | Non troviamo il tuo profilo. Contatta il tuo studio per assistenza. | Contatta supporto |
| **AUTH-007** | Permesso negato | Non hai il permesso necessario per questa operazione. Chiedi al tuo admin. | Indietro |

### 2.2 · TEAM domain

| Code | Title | Description | Action |
|---|---|---|---|
| **TEAM-001** | Membro già invitato | Hai già invitato un collaboratore con questa email. Controlla la lista membri. | Vai a Membri |
| **TEAM-002** | Limite licenza raggiunto | Hai raggiunto il numero massimo di membri previsto dal tuo piano. Aggiorna il piano per invitarne altri. | Aggiorna piano |
| **TEAM-003** | Membro non eliminabile | Non puoi rimuovere l'ultimo amministratore. Nomina prima un altro admin. | Vai a Membri |
| **TEAM-004** | Membro sospeso | Questo membro è sospeso e non può ricevere nuove assegnazioni. Riattivalo prima. | Vai a Membri |
| **TEAM-005** | Ruolo non valido | Il ruolo selezionato non è supportato. Scegli tra quelli proposti. | Riprova |

### 2.3 · JOURNEY domain

| Code | Title | Description | Action |
|---|---|---|---|
| **JOURNEY-001** | Journey non trovata | Non riusciamo a trovare questa Journey. Forse è stata chiusa o non hai accesso. | Vai a Journey |
| **JOURNEY-002** | Owner sempre richiesto | Una Journey deve sempre avere un owner. Assegna prima un nuovo owner prima di rimuovere quello attuale. | Cambia owner |
| **JOURNEY-003** | Membro già assegnato | Questo collaboratore è già attivo su questa Journey. | Indietro |
| **JOURNEY-004** | Non puoi assegnare un cliente | I clienti non possono essere assegnati come team. | Indietro |
| **JOURNEY-005** | Journey chiusa | Non puoi modificare una Journey che è già stata chiusa. Riaprila per intervenire. | Vai a Journey |
| **JOURNEY-006** | Lead non qualificato | Non puoi aprire una Journey su un Lead. Prima qualificalo con la Discovery Interview™. | Apri Discovery |

### 2.4 · CRM domain

| Code | Title | Description | Action |
|---|---|---|---|
| **CRM-001** | Lead duplicato | Un Lead con questa email esiste già nel tuo CRM. | Apri Lead esistente |
| **CRM-002** | Discovery in corso | Questo Lead ha già una Discovery aperta. Continua quella anziché crearne una nuova. | Continua Discovery |
| **CRM-003** | Account non qualificato | Solo Prospect e Cliente possono aprire una nuova Journey. | Qualifica account |
| **CRM-004** | Email obbligatoria | L'email è necessaria per creare un Lead. | Riprova |

### 2.5 · EMAIL domain

| Code | Title | Description | Action |
|---|---|---|---|
| **EMAIL-001** | Email non inviata | Non siamo riusciti a inviare la mail. Controlla la configurazione SMTP o riprova. | Riprova |
| **EMAIL-002** | Template non configurato | Il template email selezionato non è ancora configurato per la tua lingua. | Configura template |
| **EMAIL-003** | Mittente non verificato | Il tuo dominio mittente non è ancora verificato in Resend. Completa la verifica DNS. | Vai a Email Identity |

### 2.6 · CHAMELEON domain

| Code | Title | Description | Action |
|---|---|---|---|
| **CHAMELEON-001** | Preset non valido | Il preset selezionato non è tra i 6 ufficiali Blueprint Chameleon™. | Scegli un preset |
| **CHAMELEON-002** | Salvataggio non riuscito | Non siamo riusciti a salvare la nuova atmosfera. Riprova tra un istante. | Riprova |

### 2.7 · STORAGE / MEDIA domain

| Code | Title | Description | Action |
|---|---|---|---|
| **MEDIA-001** | Upload fallito | Il file non è stato caricato correttamente. Verifica connessione e riprova. | Riprova |
| **MEDIA-002** | Formato non supportato | Questo formato file non è ammesso. Usa JPG, PNG o WEBP. | Carica un altro file |
| **MEDIA-003** | File troppo grande | Il file supera il limite di dimensione (10MB). Comprimilo prima di caricarlo. | Carica un altro file |
| **MEDIA-004** | Spazio storage esaurito | Hai raggiunto il limite di storage del tuo piano. | Aggiorna piano |

### 2.8 · NETWORK / TECHNICAL domain (fallback)

| Code | Title | Description | Action |
|---|---|---|---|
| **NET-001** | Connessione instabile | Sembra che la connessione abbia avuto un'interruzione. Riprova. | Riprova |
| **NET-002** | Servizio momentaneamente non disponibile | Stiamo recuperando dal database. Riprova tra qualche secondo. | Riprova |
| **NET-003** | Richiesta scaduta | L'operazione ha impiegato troppo. Riprova o contatta il supporto. | Riprova |
| **SYS-001** | Errore inatteso | Qualcosa è andato storto. Il nostro team è già stato avvertito. Riprova più tardi. | Indietro |

### 2.9 · BILLING / LICENSE domain

| Code | Title | Description | Action |
|---|---|---|---|
| **BILLING-001** | Piano non sufficiente | Questa funzionalità richiede un piano superiore. | Aggiorna piano |
| **BILLING-002** | Pagamento scaduto | Il pagamento del tuo piano è scaduto. Aggiorna il metodo di pagamento. | Vai a Billing |

---

## §3 · Mapping HTTP / backend → registry code

Strategia: il backend resta uniforme (HTTPException con detail in inglese tecnico). Il **frontend interceptor** traduce.

```
Backend → Frontend translation map
─────────────────────────────────────────
HTTP 401                          → AUTH-001 (session_expired)
HTTP 401 + detail="invalid_credentials" → AUTH-002
HTTP 403 + detail="Account suspended"    → AUTH-003
HTTP 403 + detail="Permission denied"    → AUTH-007
HTTP 404 + path=/api/auth/me              → AUTH-006
HTTP 404 + path=/api/admin/journeys/*     → JOURNEY-001
HTTP 409 + detail="email_already_registered" → TEAM-001 OR AUTH-004 (context-aware)
HTTP 409 + detail="capacity_exceeded"     → TEAM-002
HTTP 409 + detail="user_already_assigned" → JOURNEY-003
HTTP 409 + detail="cannot_revoke_owner_without_replacement" → JOURNEY-002
HTTP 409 + detail="cannot_assign_client"  → JOURNEY-004
HTTP 422                          → SYS-001 (validation, raro per utente finale)
HTTP 500                          → SYS-001
HTTP 502 / 503 / 504              → NET-002
Network timeout                    → NET-003
ECONNREFUSED                       → NET-001
```

---

## §4 · Implementazione frontend (specifica)

### 4.1 · Modulo `/app/frontend/src/lib/errorRegistry.js`

```js
export const REGISTRY = {
  "AUTH-001": { title: "Sessione scaduta", description: "...", action: "Vai al login", action_href: "/login", severity: "warning" },
  // ... etc.
};

export function resolveError(input) {
  // input può essere: AxiosError, fetch Response, custom code string
  // → ritorna { code, title, description, action, action_href, severity, telemetry }
}
```

### 4.2 · Toast adapter

```js
import { toast } from 'sonner';
import { resolveError } from './errorRegistry';

api.interceptors.response.use(undefined, (err) => {
  const e = resolveError(err);
  if (e.severity === 'critical' || e.severity === 'error') {
    toast.error(e.title, { description: e.description, action: e.action_href ? { label: e.action, onClick: () => navigate(e.action_href) } : undefined });
  } else {
    toast.warning(e.title, { ... });
  }
  // re-throw for caller-specific handling
  return Promise.reject(e);
});
```

### 4.3 · I18N

`/app/frontend/src/i18n/strings/{locale}/errors.json` con stessa struttura. Default fallback IT.

```json
{
  "AUTH-001": { "title": "...", "description": "...", "action": "..." }
}
```

---

## §5 · Backend integration (optional Phase 2)

Per maggior precisione, il backend può iniziare a includere `error_code` nei `HTTPException`:

```python
raise HTTPException(401, detail={"error_code": "AUTH-001", "message": "session expired"})
```

Frontend resolveError priorizza `response.data.error_code` se presente, fallback a HTTP status + detail string matching.

---

## §6 · Telemetry (DevTools backstage)

- HTTP status + url + method
- Response body (truncated 500 chars)
- Frontend stack trace
- User profile_id (no PII)
- Tenant id

Mai in UI. Sempre in `console.error` + Sentry (se attivo).

---

## §7 · Tone of voice (vincoli editoriali)

- Italiano formale ma caldo (no "Si è verificato un errore" — troppo burocratico).
- Mai usare "errore" nel title se evitabile (preferire causa).
- Mai "Si prega di..." (preferire imperativo gentile: "Riprova").
- Action label sempre **verbo all'imperativo singolo** (Riprova, Indietro, Vai a, Contatta, Aggiorna).
- Description max 240 char → leggibile in toast.
- Mai "Internal Server Error" o codici HTTP nudi.

---

## §8 · Esempi prima/dopo

| Prima (oggi) | Dopo (registry) |
|---|---|
| `Request failed with status code 404` | **Journey non trovata** — Non riusciamo a trovare questa Journey. Forse è stata chiusa o non hai accesso. → *Vai a Journey* |
| `Error 401: Unauthorized` | **Sessione scaduta** — La tua sessione è terminata. Accedi di nuovo per continuare. → *Vai al login* |
| `Error: Network request failed` | **Connessione instabile** — Sembra che la connessione abbia avuto un'interruzione. Riprova. → *Riprova* |
| `409: user_already_assigned: caee7b92...` | **Membro già assegnato** — Questo collaboratore è già attivo su questa Journey. → *Indietro* |
| `Error: cannot_revoke_owner_without_replacement: use change_owner() to handoff to a different user` | **Owner sempre richiesto** — Una Journey deve sempre avere un owner. Assegna prima un nuovo owner. → *Cambia owner* |

---

## §9 · Maintenance & governance

- Catalog source-of-truth: `/app/frontend/src/lib/errorRegistry.js` (frontend) + `/app/memory/ERROR_REGISTRY_SPEC.md` (questo doc)
- Mai introdurre un codice senza aggiornare ENTRAMBI i file.
- Format codice: `DOMAIN-NNN` (3 cifre) → permette 999 codici per dominio.
- Domini riservati: AUTH, TEAM, JOURNEY, CRM, EMAIL, CHAMELEON, MEDIA, NET, SYS, BILLING, PORTAL, EDITORIAL.

---

## §10 · Roadmap implementativa

| Pri | Item | Effort |
|---|---|---|
| 🔴 P0 | Creare `/app/frontend/src/lib/errorRegistry.js` con catalogo §2 | 0.5g |
| 🔴 P0 | Axios interceptor → `resolveError` → toast | 0.5g |
| 🔴 P0 | Migrare tutti i `toast.error` esistenti al nuovo schema | 1g |
| 🟠 P1 | i18n (errors.json per 7 lingue) | 1g |
| 🟠 P1 | Backend backend HTTPException + error_code field (optional) | 0.5g |
| 🟡 P2 | Sentry integration (telemetry backstage) | 0.5g |

**Totale Phase 1 minima:** ~3 giorni.

---

## §11 · Vincoli canon

| # | Vincolo |
|---|---|
| 1 | Mai esporre HTTP status, stack trace, codici tecnici |
| 2 | Ogni errore ha codice univoco e azione |
| 3 | Italiano formale ma umano |
| 4 | Tutti i toast esistenti passano dal registry |
| 5 | Telemetry resta backstage (console + Sentry) |
| 6 | Catalog source-of-truth = 1 file (registry.js + spec.md mirror) |
