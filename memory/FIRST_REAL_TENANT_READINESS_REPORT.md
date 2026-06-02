# FIRST REAL TENANT READINESS AUDIT REPORT

> **Data**: 2026-06-02 02:15 UTC
> **Audit eseguito su**: 1 simulazione realistica (Martinel Interior Design / Mario Rossi / Pordenone IT → US/GB/AE)
> **Script di riferimento**: `/app/backend/scripts/first_real_tenant_audit.py`
> **JSON dettagliato**: `/tmp/first_real_tenant_audit.json`
> **Verdetto finale**: 🔴 **NOT_READY**

---

## 0. EXECUTIVE SUMMARY

Il lifecycle tecnico funziona: 25/30 controlli passano. La submission V2 persiste geo + target countries, il Command Center lavora la richiesta fino all'attivazione, il magic link (30 giorni) viene emesso e consumato dal Founder, il redirect porta a `/command-center/welcome`.

**Ma due gap rendono il sistema NON SICURO per un cliente reale**:

1. 🔴 **Tenant isolation rotto** — un Founder loggato col proprio magic link ha accesso libero a tutti gli endpoint admin cross-tenant (vede TUTTE le candidature di studi concorrenti, può leggere i manifest di altri tenant).
2. 🔴 **Studio Name non chiesto nel funnel V2** — il `studio_name` viene auto-popolato con "Nome + Cognome" del founder. Se l'advisor dimentica di correggere lo slug nel modal, lo studio "Martinel Interior Design" diventa il tenant `mario-rossi` con name "Mario Rossi". Email, branding, URL ne escono ridicoli.

Aggiungo un terzo problema collaterale, P1 ma con effetto a regime: la submission V2 non chiede le **lingue di lavoro** dello studio, quindi `studio_requests.languages` resta sempre `[]`. Non bloccante per il primo cliente, ma persistenza dati perduta in modo permanente per ogni candidatura.

**Se domani invitassimo davvero uno showroom**, l'esperienza tecnica funziona (signup → email → magic link → workspace). Quello che mi preoccuperebbe è: (a) il rischio di leakage se il Founder fosse anche solo curioso e provasse a navigare `/admin/tenant-activation/pipeline` col suo JWT in mano, e (b) il rischio di un'attivazione affrettata in cui l'advisor non si accorge che il tenant è stato nominato col nome del founder anziché dello studio.

---

## 1. TASK 1 — SIMULAZIONE TENANT REALE

**Dati di test** (realistici, headless):
- Studio Name (atteso): Martinel Interior Design
- Founder: Mario Rossi
- HQ: Pordenone, Friuli-Venezia Giulia, Italy (lat 45.9626 / lng 12.6536)
- Operating Market: italy
- Target Countries: US (P1) · GB (P2) · AE (P3)
- Archetipo: interior_design → V1 `interior_studio`
- Help Topics: design_journey_os, moodboard_experience

**Esito**:
- ✅ V2 submit HTTP 200 · `MOOD-1897-2BF1` · request_id `18972bf1-…`
- ✅ Geo persistito (lat, lng, country_iso, region, mapbox_place_id)
- ✅ Bridge target_countries 3/3 (US P1 · GB P2 · AE P3, status `planned` di default)
- ⚠ `studio_requests.studio_name` = `"Mario Rossi"` (non "Martinel Interior Design") — vedi P0 #2.

---

## 2. TASK 2 — EMAIL AUDIT

### Visitor

| Verifica | Esito |
|---|---|
| Email `studio_request_received` ricevuta | ✅ `sent` |
| Subject IT corretto | ✅ "Abbiamo ricevuto la tua candidatura · MOOD-1897-2BF1" |
| Locale | ✅ `it-IT` |
| Branding CMS-driven | ✅ (no hardcoded) |
| Email `studio_request_review` | ✅ `sent` |
| Email `studio_request_qualified` | ✅ `sent` |

### Super Admin

| Verifica | Esito |
|---|---|
| Email `admin_new_studio_request` | ✅ `sent` |
| Destinatario | ✅ `admin@moodfordesign.com` |
| Link al request | ✅ presente (request_id nelle variabili) |

### Advisor

| Verifica | Esito |
|---|---|
| Email `advisor_new_lead` | ❌ NON ricevuta |
| Motivo | **By design**: il template parte solo per submission con `attribution_advisor_id` (cioè con `?ref=ADV-XXXX`). Per lead organici nessuna notifica. Persiste come P1 dal Readiness Report precedente (digest pool). |

### Founder

| Verifica | Esito |
|---|---|
| Email `studio_request_approved` | ✅ `sent` |
| Subject | ✅ "Il tuo Blueprint è pronto · Mario Rossi" *(P0 #2: dovrebbe essere "Martinel Interior Design")* |
| CTA funzionante | ✅ "Apri il tuo Blueprint" linka al magic link |
| Magic link nel template (variables) | ✅ `magic_link_url` presente |
| Validity 30 giorni | ✅ `magic_link_validity_days=30`, TTL DB-side = 30.0 giorni |
| Locale IT corretto | ✅ |

---

## 3. TASK 3 — COMMAND CENTER AUDIT

| Verifica | Esito |
|---|---|
| Request compare in `/tenant-activation` | ✅ bucket `new` |
| Geografia commerciale nel drawer | ✅ market=italy · HQ=Pordenone (Friuli-Venezia Giulia, IT) · targets US/GB/AE |
| Transitions `received → reviewing → contacted → qualified` | ✅ tutte HTTP 200 |
| Bottone "Attiva Studio & invia invito Founder" | ✅ visibile (status ≠ activated) |
| Modal `TenantActivationModal` apre con preview | ✅ |
| Preview: `tenant_name`, `suggested_slug`, `founder_email`, `validity_days=30` | ✅ tutti presenti |
| Slug editabile | ✅ sanitizzato kebab-case |
| Submit modal → tenant creato | ✅ HTTP 200 |
| Audit event `activated` in `studio_relationship_events` | ✅ |

**Osservazione critica P0 #2**:
Il `suggested_slug` ritornato dalla preview era `mario-rossi` (derivato da `studio_name=Mario Rossi`). Se l'advisor non interviene a mano, il tenant nasce con slug `mario-rossi` e display name "Mario Rossi". Solo la mia correzione manuale del modal ha generato `martinel-interior-design-2` (suffisso `-2` perché lo slug `martinel-interior-design` era già occupato da un test precedente, comportamento atteso).

---

## 4. TASK 4 — FOUNDER EXPERIENCE AUDIT

### Login & accesso

| Verifica | Esito |
|---|---|
| Magic link consumato (HTTP 200, ok=true) | ✅ |
| JWT emesso | ✅ |
| Redirect target | ✅ `/command-center/welcome` |
| `/auth/me` → `role=owner` | ✅ |
| `/auth/me` → `tenant.slug` corretto | ✅ (`martinel-interior-design-2`) |
| Manifest proprio tenant `GET /admin/tenants/{my_slug}/manifest` | ✅ HTTP 200 |
| Founder first-access state | ✅ `is_founder=true · first_access=true` |

### Isolamento tenant (🔴 SHOWSTOPPER)

| Verifica | Esito |
|---|---|
| Lettura manifest di un ALTRO tenant `/admin/tenants/studio/manifest` | ❌ HTTP **200** (atteso 401/403) |
| Lettura `/admin/tenant-activation/pipeline` (super-admin) | ❌ HTTP **200** (vede TUTTE le candidature) |
| Lettura `/admin/studio/requests` | ❌ HTTP **200** (vede TUTTE le candidature) |
| Lettura `/admin/copy/manifest` | ❌ HTTP **200** |

**Root cause**: in `routers/_auth.py::require_admin_tenant` e in `routers/_advisor_scope.py::require_advisor_scope` la role `"owner"` è inclusa in `ALLOWED_ROLES = {"admin", "editor", "advisor", "owner"}`. Conseguenze:

- `require_admin_tenant` (manifest endpoint): `slug` viene letto dal `path-parameter` URL ma `_tenant` torna sempre OK per chiunque abbia un JWT con role allowed → un founder può leggere qualsiasi tenant cambiando l'URL.
- `require_advisor_scope` (pipeline + studio_requests endpoints): `is_super_admin` resta `False` per owner ma il filtraggio downstream usa `advisor_visibility_id = None if is_super_admin else advisor_id`. Per un owner: `is_super_admin=False`, `advisor_id=None` → `advisor_visibility_id=None` → **nessun filtro** applicato → ritornano TUTTE le righe.

> **Mi sentirei tranquillo a mostrarlo a un cliente vero?** → **NO**. Un curioso col DevTools aperto può navigare `/admin/tenant-activation/pipeline` col proprio JWT e leggere tutte le 26+ candidature di studi concorrenti. Verifica fatta nello script: HTTP 200 ottenuto col JWT del nuovo founder.

### Onboarding (out of scope per questa simulazione)
Non audito a fondo: il founder al primo login viene atteso da un modal "Imposta la password". Quello esiste già (`SetPasswordModal.jsx`). Da rifinire con video-walkthrough in iterazione UX dedicata.

---

## 5. TASK 5 — DATA COLLECTION AUDIT

| Campo | Persistito? | Valore osservato |
|---|---|---|
| `operating_market` | ✅ | `markets.italy` (UUID linkato) |
| `headquarter_country` | ✅ | `IT` |
| `headquarter_city` | ✅ | `Pordenone` |
| `latitude` | ✅ | `45.9626` |
| `longitude` | ✅ | `12.6536` |
| `headquarter_region` | ✅ | `Friuli-Venezia Giulia` |
| `mapbox_place_id` | ✅ | `place.simulation.pordenone` |
| `target_countries` (bridge 3 righe) | ✅ | US/GB/AE con `priority` 1-3 |
| `locale` | ✅ | `it-IT` |
| `archetype` (mappato V1) | ✅ | `interior_studio` |
| `archetype_code` (V2 originale) | ✅ | nel payload JSON `payload.v2.archetype_code` |
| `help_topics` (mappati a experiences V1) | ✅ | `design_journey_os, moodboard_experience` |
| `phone_prefix` + `phone_number` | ✅ | `+39 345 1234567` |
| `monogram` | ✅ | `MD` (dal payload draft) |
| `studio_name` | ⚠ **DATA QUALITY** | `"Mario Rossi"` invece di "Martinel Interior Design" |
| `languages` (array TEXT[]) | ❌ **PERSO** | `[]` — il funnel V2 non chiede in che lingue lavora lo studio |
| `markets` (singolo array TEXT[]) | ❌ **PERSO** | `[]` — V2 sostituisce con `operating_market_id` + `additional_markets`, ma quest'ultimo non viene popolato dal funnel V2 |
| `advisor_attribution` | ⚪ N/A | NULL per lead organici (atteso) |
| `tenant.plan_assigned_at` (attivazione) | ✅ | `2026-06-02 02:05:49 UTC` |
| `tenant.slug` | ✅ | come scelto dall'advisor, dedup `-2` se collisione |
| `tenant.name` | ✅ | come scelto dall'advisor (override del default "studio_name") |

**Dati persi definitivamente per ogni candidatura V2 attuale**:
- `studio_requests.languages` (servirebbe per matching multilingue advisor↔founder)
- `studio_requests.markets` legacy (sostituito da operating_market + target_countries, ma intanto il drawer Command Center è cablato per leggere entrambi)
- Studio Name reale (perso a meno che l'advisor non lo digiti nel modal — non c'è "fonte di verità" lato visitor)

---

## 6. TASK 6 — CRITICAL ISSUES (CLASSIFICAZIONE)

### 🔴 P0 — BLOCCANTI PER IL PRIMO TENANT REALE

| # | Titolo | Sintesi | Effort |
|---|---|---|---|
| **P0-A** | Tenant Isolation rotto per role=owner | Founder ha accesso libero a `/admin/tenant-activation/pipeline`, `/admin/studio/requests`, `/admin/tenants/{slug}/manifest`, `/admin/copy/manifest`. Cross-tenant data leak verificato con HTTP 200 sul JWT del founder appena creato. | 4-6h |
| **P0-B** | Studio Name non raccolto dal funnel V2 | `studio_name` viene popolato col nome+cognome del founder, non con il nome dello studio. Slug suggerito nasce sbagliato di default. L'advisor deve correggere manualmente sia tenant_name che slug nel modal — se dimentica, il tenant si chiama "Mario Rossi" anziché "Martinel Interior Design". | 2-3h (aggiungere step "Studio name" nel funnel V2 + validazione + persistenza) |

### 🟡 P1 — IMPATTO REALE MA NON BLOCCANTI

| # | Titolo | Sintesi |
|---|---|---|
| **P1-A** | `studio_requests.languages` mai popolato | V2 non chiede in che lingue lavora lo studio. Persa l'occasione per matching multilingue advisor↔founder e per il bridge `tenants.active_languages` post-activation. |
| **P1-B** | Notifica advisor per lead organici assente | Senza `attribution_advisor_id`, nessuna email `advisor_new_lead`. Già documentato come gap (digest pool, P1-1 nel Readiness Report). |
| **P1-C** | `studio_requests.markets` legacy non popolato | Il drawer Command Center mostra "—" se si guarda il vecchio campo markets, perché V2 lo lascia vuoto e usa solo `primary_operating_market_id`. Da deprecare o backfill. |

### 🟢 P2 — NESSUNO REALE

Nessun P2 identificato in questa simulazione che sia un problema concreto, non solo cosmetico.

---

## 7. CHE COSA HA FUNZIONATO BENE (PASS confermati)

- Studio V2 submit completo (geo + target countries + help topics + archetypes mapping).
- Pipeline Command Center: bucket `new`, drawer geografia completo, transitions di status sicuri.
- Modal di attivazione: anteprima OK, slug editabile e sanitizzato, dedup automatica, validity_days esposto.
- Tenant + Founder user creati atomicamente. Magic link 30-day persistito.
- Email `studio_request_approved` con magic link CTA come overide URL, locale `it-IT`, subject corretto.
- Magic link consumed → JWT con `role=owner` e `tenant.slug` corretto. Redirect a `/command-center/welcome`.
- Idempotenza replay-window 60s validata.
- Audit trail completo: `studio_email_dispatch_log` + `studio_relationship_events` + `tenant_modules` + `users` + `access_magic_links`.

---

## 8. VERDETTO FINALE

### 🔴 NOT_READY

**Non posso autorizzare l'invito a uno showroom reale finché non vengono chiusi P0-A e P0-B.**

P0-A è una falla di sicurezza concreta — non un'edge case. Un founder anche solo curioso, aprendo le dev-tools del browser, può leggere le candidature di studi concorrenti. Non è accettabile mostrare il sistema a un cliente vero in queste condizioni.

P0-B è un fallimento di brand experience. Un studio premium chiamato "Martinel Interior Design" non può essere onboardato come tenant `mario-rossi`. È esattamente il tipo di dettaglio che fa apparire amatoriale tutto il resto.

---

## 9. SE DOMANI INVITASSIMO UNO SHOWROOM REALE, COSA MI PREOCCUPEREBBE DI PIÙ?

In ordine di preoccupazione decrescente:

1. **Che il founder scopra Vista Pipeline e Studio Requests cross-tenant col suo magic link**. È il rischio più concreto. Non richiede malice: basta che il founder, dopo essere atterrato su `/command-center/welcome`, clicchi sulla sidebar "Studio Requests" (presente nel template del Command Center per via della role `owner`) e veda di colpo le candidature dei suoi concorrenti. Disastro reputazionale.

2. **Che l'advisor invii un invito col nome sbagliato**. Il default slug `mario-rossi` e la default tenant name "Mario Rossi" sono trappole UX. Basta che l'advisor sia di fretta una volta sola e il tenant nasce col nome del founder. L'email parte con "Il tuo Blueprint è pronto · Mario Rossi". Il founder apre, vede il workspace intestato a sé stesso anziché allo studio, sospetta un errore di configurazione, perde fiducia.

3. **Che il founder cerchi di impostare la lingua del workspace** e ci accorgiamo che non l'abbiamo mai chiesta. Per un primo cliente italiano va bene il default `it`, ma per il prossimo cliente francese o tedesco non sappiamo nemmeno che lingua si aspettano.

4. **Che nessun advisor noti per ore una nuova candidatura organica**. Il sistema non notifica nessuno se non c'è `attribution_advisor_id`. Il founder rimane in attesa, l'advisor non lo sa, e ci scappa il primo cliente perché perdiamo 24h di silenzio operativo.

5. **Cosmetico ma fastidioso**: il `CorporateFooter` mostra ancora qualche stringa hardcoded in italiano nel locale switcher, già notato nel Readiness Report. Non blocca, ma sarebbe imbarazzante in una demo in inglese.

---

## 10. RACCOMANDAZIONI OPERATIVE

**Per uscire da NOT_READY → READY_FOR_FIRST_REAL_TENANT** serve un singolo sprint focalizzato:

1. **Chiusura P0-A (Tenant Isolation)** — ~4-6h
   - Rimuovere `"owner"` da `ALLOWED_ROLES` di `require_admin_tenant` e `require_advisor_scope`, oppure introdurre un nuovo guard `require_super_admin_or_advisor` separato dal guard "tenant-scoped owner".
   - Aggiungere un check esplicito: se `role=owner`, validare che `URL.slug == JWT.tenant_slug`.
   - Test E2E aggiornato a includere "founder JWT su tutti gli endpoint admin → 403".

2. **Chiusura P0-B (Studio Name)** — ~2-3h
   - Aggiungere un campo "Studio name" nello Step 3 (Contact) del funnel V2, obbligatorio.
   - Persistere su `studio_requests.studio_name` (oggi sovrascritto dal full name).
   - Default del modal di attivazione = vero studio_name.

**Effort totale per uscire dal NOT_READY**: ~8h (una giornata di lavoro focalizzata).

Solo a quel punto, con un retest del flow Martinel completo, si potrà passare a **READY_FOR_FIRST_REAL_TENANT** in sicurezza.

---

STOP. Nessuna implementazione fatta. In attesa di autorizzazione esplicita per partire con P0-A e P0-B, o per altri approfondimenti.
