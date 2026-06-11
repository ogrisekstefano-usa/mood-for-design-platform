# MODULE CONNECTION AUDIT — P0-B
# projects.client_user_id — Root Cause, Data Flow, Fix Plan, Rollout
> Prodotto: 10 Jun 2026 · Dati reali da DB produzione

---

## 1. CONTEGGI REALI

| Metrica | Valore |
|---------|--------|
| Total `projects` | **20** |
| `projects.client_user_id = NULL` | **19 (95%)** |
| `projects.client_user_id = SET` | **1 (5%)** |
| `users_profile` con `role=client` | **9** |
| Progetti backfillabili (match email→account→journey→project) | **12** |
| Progetti non backfillabili (nessun client profile corrispondente) | **7** |
| Journeys associati ai 19 progetti NULL | **15** |

---

## 2. ROOT CAUSE

### Root cause primaria — `client_provisioning.py` non aggiorna `projects.client_user_id`

`provision_client_after_journey()` è il servizio che:
1. ✅ Crea `auth.user` + `users_profile` (role=client)
2. ✅ Assegna il designer referente
3. ✅ Apre `relationship_thread`
4. ✅ Genera magic link
5. ❌ **NON aggiorna `projects.client_user_id`**

La colonna `projects.client_user_id` non viene mai scritta da questo servizio, né da alcun altro percorso (B, C, D).

### Conferma dai dati

Tutti i 9 client profiles esistenti sono stati creati via Path A (`begin_journey_ritual`), che è l'unico percorso che chiama `provision_client_after_journey()`. Tuttavia, anche su Path A, **nessuno** dei 12 matching projects ha `client_user_id` impostato. Questo conferma che il provisioning crea correttamente lo `users_profile` ma non completa il link al `project`.

### Root cause secondaria — Path B, C, D by design

Per i 7 progetti senza client profile corrispondente:
- **5 `Mario Rossi · Design Journey`** → creati via Path B (`lead_conversion`) → `lead_id` presente ma nessun `users_profile` role=client fu mai creato
- **1 `Design Journey · Test Showroom`** → creato via Path C (`account_journeys`, origin=`manual_modal`) → nessun provisioning invocato by design
- **1 `Residenziale Marco Test`** → Path D o manuale → nessun lead, nessun email match

---

## 3. DATA FLOW — Percorso del Gap

```
PATH A: journey_initiate.py
─────────────────────────────────────────────────────
  POST /api/public/journeys/initiate
  → INSERT accounts
  → INSERT projects                ← client_user_id non settato
  → INSERT design_journeys
  → provision_client_after_journey()
      → _find_auth_user()
      → _create_auth_user()
      → _ensure_profile()          ← crea users_profile (role=client)
      → ensure_owner()
      → _ensure_thread()
      → _generate_magic_link()
      ← MANCANTE: UPDATE projects SET client_user_id = profile_id
  → return journey_id, magic_link

PATH B: lead_conversion.py
─────────────────────────────────────────────────────
  POST /api/conversion/leads/{id}/start-journey
  → INSERT accounts (se non esiste)
  → INSERT projects                ← client_user_id non settato
  → INSERT design_journeys
  ← provision_client NON CHIAMATO

PATH C: account_journeys.py
─────────────────────────────────────────────────────
  POST /api/accounts/{aid}/journeys
  → INSERT projects                ← client_user_id non settato
  → INSERT design_journeys
  → ensure_owner()
  ← provision_client NON CHIAMATO

PATH D: design_journey.py
─────────────────────────────────────────────────────
  GET /api/projects/{pid}/journey
  → INSERT design_journeys (se non esiste)
  ← provision_client NON CHIAMATO
```

**Conseguenza sull'endpoint portal:**
```python
# client_portal.py — tutti i client endpoints:
c.table("projects").select(...).eq("client_user_id", profile_id)
# → restituisce 0 righe → zero_data: True
```

---

## 4. FIX PLAN

### Fix 1 — `provision_client_after_journey()` (patch chirurgica, Path A)

**File**: `/app/backend/services/client_provisioning.py`  
**Punto di inserzione**: dopo `result["profile_id"] = profile["id"]` (riga ~305)

```python
# Dopo aver ottenuto profile_id, linkare il project al client
if journey_id and profile_id:
    try:
        j_rows = c.table("design_journeys").select("project_id") \
                  .eq("id", journey_id).eq("tenant_id", tenant_id).limit(1).execute()
        if j_rows.data and j_rows.data[0].get("project_id"):
            c.table("projects").update({"client_user_id": profile_id}) \
             .eq("id", j_rows.data[0]["project_id"]) \
             .eq("tenant_id", tenant_id).execute()
            logger.info("projects.client_user_id linked: project=%s → profile=%s",
                        j_rows.data[0]["project_id"][:8], profile_id[:8])
    except Exception:
        logger.exception("client_user_id link update failed (non-fatal)")
```

**Effetto**: ogni nuovo `begin_journey_ritual` aggiorna automaticamente `client_user_id` nel momento in cui il profilo viene creato/trovato.

---

### Fix 2 — `lead_conversion.py` (Path B) — opzionale P1

Per Path B, il client profile potrebbe non esistere al momento della conversione (è il CRM interno, non il flow pubblico). La strategia corretta è diversa:

```python
# Dopo start-journey: cerca users_profile per email dell'account
# Solo se esiste → aggiorna client_user_id
acc = c.table("accounts").select("email").eq("id", account_id).limit(1).execute()
if acc.data and acc.data[0].get("email"):
    up = c.table("users_profile").select("id") \
          .eq("tenant_id", tid) \
          .eq("email", acc.data[0]["email"]) \
          .eq("role", "client").limit(1).execute()
    if up.data:
        c.table("projects").update({"client_user_id": up.data[0]["id"]}) \
         .eq("id", project_id).execute()
```

---

### Fix 3 — `account_journeys.py` (Path C) — opzionale P1

Identico a Fix 2, eseguito dopo il create journey.

---

## 5. ROLLOUT PLAN

### Step 1 — Fix chirurgico in `provision_client_after_journey()` (Fix 1)
- **Effort**: ~10 righe
- **Rischio**: basso — è NON-blocking, non può rompere il journey
- **Effetto forward**: tutti i nuovi journey da `/begin-journey` aggiornano `client_user_id`

### Step 2 — Backfill dei 12 record recuperabili
I 12 `UPDATE` specifici sono già pronti (generati dall'analisi DB reale):

```sql
-- Backfill 12 projects con client profile corrispondente
-- Valentina Conti
UPDATE projects SET client_user_id = 'eaab6aa9-e219-43b7-a3ee-fe5a472b924e'
WHERE id IN ('b3128504-4bbd-4f2f-ab79-d75fff011273',
             '4b32c9ba-2ea9-44fd-aaa1-176a840b4dae');

-- Marco Bianchi
UPDATE projects SET client_user_id = 'e75e6ca5-eab8-4439-be42-115acf899bcb'
WHERE id = '13897bdf-301e-4e20-a1ab-488eb4faf68c';

-- Solo2
UPDATE projects SET client_user_id = 'a75e8bb0-3f52-410f-ac5c-a88c574f317e'
WHERE id = '7ee7f3f7-d5b5-4564-a473-e5e7e96320a9';

-- TestVerify Cognome
UPDATE projects SET client_user_id = 'd6e176ef-9d4a-4bbf-a26c-d597740eac21'
WHERE id = 'bd89921b-0dda-4e92-889e-b54e41adf9a2';

-- TEST_I18N (4 record)
UPDATE projects SET client_user_id = 'cc274cd2-3db7-427a-802f-816c86d39b78'
WHERE id IN ('dd14c534-2a9c-4d93-b79a-e3ddcb43a840',
             '186829dc-cc4a-4bb8-bba7-f24df1be6f9b',
             'ffbbda65-601f-4c98-b50f-1f353b6716c5',
             'ef455b17-b317-435f-a55e-4efb45f8e230');

-- TEST_Pulse_NoShare
UPDATE projects SET client_user_id = '991a2f52-5aa6-41ea-9633-5d6bdedc1ae4'
WHERE id = '346aee7c-22d6-4998-8de8-3bf2dbd62389';

-- Giuseppe
UPDATE projects SET client_user_id = '4385a38e-d9de-4513-921e-c7e24d2a7d08'
WHERE id = '750cd569-260c-43b5-88a3-07b6bfb9cb3c';

-- Elena Ricci
UPDATE projects SET client_user_id = '114cb2f2-82e3-4ad1-86b1-601eca53d62d'
WHERE id = 'fa886612-4cd2-4817-bf2d-9aa25b289e3b';
```

**Risultato atteso dopo backfill**: da 1 progetto con portal funzionante → **13 progetti**

### Step 3 — 7 record non recuperabili
- 5 `Mario Rossi · Design Journey` → richiedono provisioning manuale (il cliente reale non ha un `users_profile`)
- 1 `Design Journey · Test Showroom` → progetto di test/demo
- 1 `Residenziale Marco Test` → progetto di test/demo
- **Azione suggerita**: lasciare NULL o eliminare i record di test

---

## 6. VERIFICA POST-FIX

Dopo backfill, verificare con:
```python
# Atteso: 13 progetti con client_user_id SET
c.table("projects").select("id", count="exact").not_.is_("client_user_id", "null").execute()

# Test portal per client profile cc274cd2 (TEST_I18N):
# GET /api/client/journeys → deve restituire 4 journey (non zero_data)
```

---

*Audit P0-B — MODULE CONNECTION SPRINT 1*
