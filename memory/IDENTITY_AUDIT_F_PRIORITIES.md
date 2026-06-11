# IDENTITY & CLIENT PROVISIONING AUDIT — DOCUMENTO F: PRIORITÀ P0/P1/P2
> Prodotto: 11 Jun 2026 · Sintesi audit completo

---

## P0 — BLOCCANTI (rompono flussi operativi reali)

### P0-B · `projects.client_user_id` mai settato

**File**: `client_provisioning.py`  
**Impatto**: Portal cliente completamente vuoto per tutti i journey CRM (Path B/C/D). Anche per Path A (Begin Journey), il provisioning chiama `provision_client_after_journey()` che crea correttamente il profilo ma **non esegue mai** `UPDATE projects SET client_user_id`.  
**Symptom**: cliente accede al portal → `zero_data: true` → nessun journey visibile.  
**Fix**: 1 UPDATE dentro `provision_client_after_journey()` dopo la riga `result["profile_id"] = profile["id"]`.  
**Backfill disponibile**: 12 record recuperabili via email→account→journey→project (SQL pronto nel documento `MODULE_SPRINT1_P0B_AUDIT.md`).  
**Effort**: ~10 righe + SQL backfill.

---

### P0-IDENTITY-1 · `users_profile.email` non sincronizzata con `auth.users.email`

**Impatto**: Se `users_profile.email` e `accounts.email` divergono, `client_portal.py → welcome-summary` non trova l'account del cliente. Il portal mostra dati vuoti anche con `projects.client_user_id` settato.  
**Root cause**: non esiste nessun meccanismo di sincronizzazione tra i 5 strati che contengono l'email.  
**Fix immediato**: in `provision_client_after_journey()`, copiare `accounts.email` come valore di `users_profile.email` al momento della creazione del profilo.  
**Effort**: 2 righe.

---

### P0-PORTAL-1 · Portal risoluzione doppio meccanismo inconsistente

**Impatto**: `/api/client/journeys` usa `client_user_id`, `/api/client/welcome-summary` usa `accounts.email`. Due meccanismi diversi sullo stesso portal → comportamento imprevedibile.  
**Fix**: unificare dopo fix P0-B (una volta che `client_user_id` è sempre settato, sostituire il fallback email con lookup diretto via `client_user_id`).  
**Effort**: 1-2 endpoint da aggiornare.

---

## P1 — IMPORTANTI (causano dati inconsistenti)

### P1-PHONE · `users_profile.phone` mai copiato da `accounts.phone`

**Impatto**: il profilo cliente nel portal non ha telefono. L'unica copia del telefono è in `accounts.phone` (e `contacts.phone`).  
**Fix**: in `provision_client_after_journey()`, copiare `phone` da `accounts` nel `users_profile` al momento della creazione.  
**Effort**: 3 righe.

---

### P1-LOCALE · `preferred_locale_code` formato non standardizzato

**Impatto**: `LocaleRuntimeContext` risolve il locale del cliente ma riceve valori come `EN_US` (underscore) invece di `en-US` (hyphen, standard BCP-47). Può causare mismatch nella risoluzione i18n.  
**Fix**: normalizzare il formato in `provision_client_after_journey()` e nel PATCH profile.  
**Effort**: 1 helper di normalizzazione.

---

### P1-LEAD-NONBLOCKING · Lead insert NON-blocking in Path A

**Impatto**: il lead può non essere creato se l'insert fallisce silenziosamente. L'account esiste ma il CRM non ha traccia del prospect.  
**Fix**: wrappare in try/except con retry o rendere bloccante con timeout breve.  
**Effort**: 5 righe.

---

### P1-DUPLICATE-ACCOUNT · Deduplicazione account assente in Path A

**Impatto**: se lo stesso cliente completa il Begin Journey due volte, vengono creati 2 account con la stessa email → CRM duplicati → portal può trovare il record sbagliato.  
**Fix**: in `journey_initiate.py`, verificare `SELECT accounts WHERE email=? AND tenant_id=?` prima di INSERT.  
**Effort**: 8 righe.

---

### P1-OGRISEK · `ogrisekadvisor@gmail.com` status `invited` da 11+ giorni

**Impatto**: utente staff mai attivato. Occupa una slot license. Non può operare finché non accetta l'invito.  
**Fix**: decidere se mantenere (resend invite) o rimuovere (DELETE).  
**Effort**: decisione business.

---

## P2 — DEBITO TECNICO

### P2-TZ · Timezone cliente assente

**Impatto**: nessuna personalizzazione di orario per il cliente. Tutte le date mostrate in UTC.  
**Fix**: aggiungere `timezone TEXT` a `users_profile`. Catturare dal browser in `journey_initiate.py`.  
**Effort**: migration + 2 righe cattura.

---

### P2-EMAIL-COPY · Email triplicata su 5 tabelle senza sincronizzazione

**Impatto**: divergenza potenziale nel tempo se un cliente cambia email.  
**Fix**: designare `auth.users.email` come SoT assoluta. Aggiungere webhook Supabase `user.updated` → sincronizza `users_profile.email`.  
**Effort**: webhook Supabase + 1 endpoint.

---

### P2-NAMECOPY · first_name/last_name quadruplicati senza sincronizzazione

**Impatto**: divergenza potenziale.  
**Fix**: `users_profile` come SoT. Le altre copie (`leads`, `contacts`) diventano read-only al momento della creazione.  
**Effort**: documentazione architetturale.

---

### P2-TENANT-CLEANUP · 47 tenant test/simulazione

**Impatto**: nessuno sul tenant produzione. Rumore nel DB admin.  
**Fix**: script di cleanup dei tenant con `slug LIKE 'martinel-%' OR slug LIKE 'studio-simulazione%'` + tutti i loro dati figli.  
**Effort**: analisi + SQL.

---

## Riepilogo

| # | Gap | Priorità | Effort |
|---|-----|----------|--------|
| P0-B | Portal vuoto — `client_user_id` mai settato | 🔴 P0 | ~10 righe + SQL |
| P0-IDENTITY-1 | Email `users_profile` ≠ `accounts.email` | 🔴 P0 | 2 righe |
| P0-PORTAL-1 | Doppio meccanismo portal | 🔴 P0 (post P0-B) | 1-2 endpoint |
| P1-PHONE | `users_profile.phone` NULL | 🟠 P1 | 3 righe |
| P1-LOCALE | Formato locale non standard | 🟠 P1 | 1 helper |
| P1-LEAD | Lead NON-blocking fallisce silente | 🟠 P1 | 5 righe |
| P1-DEDUP | Account duplicati per stessa email | 🟠 P1 | 8 righe |
| P1-OGRISEK | Invito mai accettato | 🟠 P1 | Decisione business |
| P2-TZ | Timezone assente | 🟡 P2 | Migration |
| P2-EMAIL | Email 5× senza sync | 🟡 P2 | Webhook |
| P2-NAME | Name 4× senza sync | 🟡 P2 | Architetturale |
| P2-TENANT | 47 tenant test nel DB | 🟡 P2 | Script cleanup |

---

## Sequenza di Fix Raccomandata

```
Sprint 1 (identità e portal):
  P0-B      → provision_client_after_journey() + backfill SQL 12 record
  P0-IDENTITY-1 → sincronizzare email in provisioning
  P1-PHONE  → copiare phone in provisioning
  P1-LOCALE → normalizzare preferred_locale_code

Sprint 2 (pipeline):
  P0-PORTAL-1 → unificare meccanismo portal
  P1-LEAD     → lead insert bloccante
  P1-DEDUP    → dedup account per email

Sprint 3 (debito):
  P2-TZ, P2-TENANT, P2-EMAIL (bassa urgenza)
```

---

*Audit F — IDENTITY & CLIENT PROVISIONING AUDIT*
