# IDENTITY & CLIENT PROVISIONING AUDIT — DOCUMENTO D: CLIENT PROFILE SOURCE OF TRUTH
> Prodotto: 11 Jun 2026 · Audit statico + dati reali DB

---

## 1. Mappa Campi — Dove Vivono Realmente

### `first_name`

| Dove | Tabella.colonna | Popolazione | Aggiornamento |
|------|----------------|-------------|--------------|
| ✅ SoT | `users_profile.first_name` | Signup / invite / provisioning | `PATCH /api/profile` o `PATCH /api/members/{id}` |
| Copia 1 | `auth.users.user_metadata.first_name` | Al momento della creazione (admin.create_user) | **MAI** sincronizzato dopo |
| Copia 2 | `leads.first_name` | Cattura form pubblico | Solo al momento della creazione lead |
| Copia 3 | `contacts.first_name` | `journey_initiate.py` step A | Solo al momento della creazione contatto |
| Copia 4 | `accounts.account_name` (parziale) | `"{first_name} {last_name}"` concatenato | Solo al momento della creazione account |

**Rischio**: se il cliente aggiorna il proprio nome tramite `/api/profile`, si aggiorna solo `users_profile`. Le copie in `leads`, `contacts`, `accounts` rimangono invariate.

---

### `last_name`

Identico a `first_name`. Stesso pattern di duplicazione su 4 tabelle.  
In `accounts` è concatenato in `account_name` — non separato.

---

### `email`

| Dove | Tabella.colonna | Mutation? | Nota |
|------|----------------|-----------|------|
| ✅ SoT auth | `auth.users.email` | Solo via Admin API | Immutabile via normale flow |
| ✅ SoT app | `users_profile.email` | Solo via Admin API + manual update | Non sincronizzato con auth se cambiato |
| Copia 1 | `leads.email` | Immutabile dopo creazione | Terza copia indipendente |
| Copia 2 | `contacts.email` | Aggiornabile via `client_relations.py` | Non sincronizzata con accounts |
| Copia 3 | `accounts.email` | Aggiornabile via `client_relations.py` | Usata dal portal come fallback di risoluzione identità |

**Conflitto critico**: `users_profile.email` è usato in `auth.py → get_current_user()` (riga 99) come fallback: `p.get('email') or payload.get('email', '')`. Se un admin modifica manualmente `users_profile.email` ma non aggiorna `auth.users.email`, il JWT porta la vecchia email ma il profilo ne mostra una diversa.

**Conflitto portale**: `client_portal.py → welcome-summary` risolve l'account via `accounts.email = users_profile.email`. Se le due email divergono, il portal non trova l'account del cliente.

---

### `phone`

| Dove | Tabella.colonna | Popolazione | Aggiornamento |
|------|----------------|-------------|--------------|
| ✅ SoT | `users_profile.phone` | **Non popolato** dal provisioning (`NULL`) | `PATCH /api/profile` |
| Copia 1 | `leads.phone` | Cattura form pubblico | Solo al momento della creazione |
| Copia 2 | `contacts.phone` | `journey_initiate.py` step A | Solo al momento della creazione |
| Copia 3 | `accounts.phone` | `journey_initiate.py` step A (da leads.phone) | Solo al momento della creazione |

**Gap**: `provision_client_after_journey()` non copia `phone` da `accounts` / `contacts` nel `users_profile`. Il campo è sempre NULL dopo provisioning.

---

### `language` / `locale`

| Dove | Tabella.colonna | Stato |
|------|----------------|-------|
| `users_profile.preferred_locale_code` | `EN_US` / `IT_IT` / NULL | Unica colonna per preferenza lingua. **Non standardizzata** (alcuni valori come `EN_US` vs `en-US`) |
| `users_profile.locale` | NULL su quasi tutti i record | Campo legacy o non utilizzato |
| `tenants.default_language` | `it` / `en-US` | Default del tenant, non del singolo utente |
| `leads.cultural_register` | JSONB | Profilo culturale (non lingua tecnica) |

**Gap**: non esiste un campo `language` canonico per l'utente. `preferred_locale_code` esiste ma:
- Non è sempre popolato
- Non ha un formato standardizzato (`EN_US` vs `en-US` vs `it`)
- Non è copiato nel `users_profile` dal form Begin Journey (che cattura la lingua dell'utente tramite il locale browser)

---

### `timezone`

| Dove | Tabella.colonna | Stato |
|------|----------------|-------|
| `users_profile` | ❌ **COLONNA ASSENTE** | Non esiste nel DB |
| `users_profile.metadata_json` | Potenzialmente presente come `metadata_json.timezone` | Non standardizzato |

**Gap**: timezone del cliente non è gestita da nessuna parte nel modello identità. Ogni riferimento a "ora" usa `datetime.utcnow()` o `datetime.now(timezone.utc)` senza considerare il timezone del cliente.

---

### Portal Access

| Dove | Meccanismo | Stato |
|------|-----------|-------|
| `projects.client_user_id` | FK a `users_profile.id` | ❌ SEMPRE NULL (bug P0-B) |
| `accounts.email = users_profile.email` | Lookup per email | ⚠️ Funziona solo se le email coincidono (fallback welcome-summary) |

**Il portal access è strutturalmente rotto** per tutti i journey creati da CRM (Path B, C, D). Solo `welcome-summary` funziona, ma tramite un meccanismo diverso e incoerente con gli altri endpoint.

---

## 2. Riepilogo Source of Truth

| Campo | Source of Truth | Duplicazioni | Campi mancanti |
|-------|----------------|-------------|----------------|
| `first_name` | `users_profile.first_name` | 4 copie | Nessuno |
| `last_name` | `users_profile.last_name` | 4 copie | Nessuno |
| `email` | `auth.users.email` + `users_profile.email` | 5 copie | Sincronizzazione mancante |
| `phone` | `users_profile.phone` (NULL) | 3 copie in leads/contacts/accounts | `users_profile.phone` mai popolato da provisioning |
| `language` | `users_profile.preferred_locale_code` | 1 copia non standard | Formato non uniformato |
| `timezone` | ❌ NON ESISTE | — | Colonna completamente assente |
| `portal_access` | `projects.client_user_id` | — | Sempre NULL (bug P0-B) |

---

## 3. Campi Mancanti nel Modello Client Profile

| Campo | Dove dovrebbe stare | Priorità |
|-------|--------------------|---------| 
| `timezone` | `users_profile.timezone` | 🟡 P2 |
| `language` (canonico) | `users_profile.preferred_locale_code` (standardizzare formato) | 🟠 P1 |
| `phone` (copiato da provisioning) | `users_profile.phone` = `accounts.phone` al momento del provisioning | 🟠 P1 |
| Sincronizzazione `email` tra strati | Webhook o trigger su cambio email | 🟡 P2 |

---

*Audit D — IDENTITY & CLIENT PROVISIONING AUDIT*
