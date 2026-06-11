# SESSION_LEAK_FIX.md
> Sprint: NEXT-STABILIZATION · F1 — SESSION LEAKAGE FIX
> Data: 11 giugno 2026
> Stato: ✅ IMPLEMENTATO E VERIFICATO

---

## ROOT CAUSE IDENTIFICATA

### Bug primario — `_ensure_profile()` senza filtro `tenant_id`

**File:** `backend/services/client_provisioning.py`

**Comportamento pre-fix:**
```python
# ❌ PRIMA: ricerca globale su auth_user_id senza tenant_id
existing = (c.table("users_profile").select("*")
            .eq("auth_user_id", auth_user_id)  # solo questo
            .limit(1).execute().data or [])
```

Se `_find_auth_user(email)` trovava un admin Supabase con la stessa email, il sistema:
1. Recuperava l'auth_user_id dell'admin
2. `_ensure_profile()` trovava il profilo dell'admin (senza filtro tenant)
3. Impostava `projects.client_user_id = admin_profile_id`
4. Il journey risultava intestato all'admin

**Comportamento post-fix:**
```python
# ✅ DOPO: (auth_user_id × tenant_id) + role conflict guard
existing = (c.table("users_profile").select("*")
            .eq("auth_user_id", auth_user_id)
            .eq("tenant_id", tenant_id)          # ← AGGIUNTO
            .limit(1).execute().data or [])
if existing:
    bound_role = (p.get("role") or "").lower()
    if bound_role and bound_role != "client":
        raise ValueError("session_guard:role_conflict ...")  # ← AGGIUNTO
```

---

### Bug secondario — Bypass link in `JourneyPreparingPage.jsx`

**File:** `frontend/src/pages/journey/JourneyPreparingPage.jsx`

**Comportamento pre-fix:**
- Il `magic_link_url` veniva passato come param `?m=` nella URL di `/journey/preparing`
- Era visibile come link cliccabile: `Apri direttamente il tuo spazio →`
- Se l'admin cliccava quel link nel STESSO browser → `AuthClientCallback` sovrascriveva la sessione admin

**Comportamento post-fix:**
- Link rimosso completamente
- Il magic link non è più accessibile dalla UI
- La via d'accesso rimane solo: email → link

---

### Bug terziario — `AuthClientCallback.jsx` senza role guard

**File:** `frontend/src/pages/auth/AuthClientCallback.jsx`

**Comportamento pre-fix:**
- Nessun controllo sul ruolo della sessione installata
- Se un admin apriva un magic link → la sessione admin veniva sovrascritta silenziosamente

**Comportamento post-fix:**
```javascript
// ITER180 · SESSION-GUARD
const profileRole = (profile?.profile?.role || profile?.role || '').toLowerCase();
if (profileRole && profileRole !== 'client') {
  // Staff session → remove stale token, redirect to /dashboard
  try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  cleanUrl();
  navigate('/dashboard', { replace: true });
  return;
}
```

---

## EVIDENZA SQL — PRIMA/DOPO

### Snapshot PRE-FIX

```
users_profile:
  caee7b92 | super_admin | admin@moodfordesign.com   | tenant: 848354b9
  07898723 | client      | ogriusa@gmail.com          | tenant: 848354b9
  1ea4434b | client      | test.owner.a@example.com  | tenant: 848354b9

projects.client_user_id:
  "Conversazione di Test OwnerA"  → 1ea4434b (client) ✅
  "Conversazione di Stef"         → 07898723 (client) ✅
  Altri progetti test              → NULL
```

### Test eseguiti

| Scenario | Email | Risultato atteso | Risultato ottenuto |
|---|---|---|---|
| 1 | `nuovo.xxx@test.it` (nuova) | Journey → client profile nuovo | ✅ role=client, profilo creato |
| 2 | `admin@moodfordesign.com` (admin) | Journey → provisioning RIFIUTATO | ✅ client_user_id=NULL, log: role_conflict |
| 3 | `ogriusa@gmail.com` (client esistente) | Journey → client profile esistente riusato | ✅ role=client, profilo idempotente |
| 4 | Isolamento tenant | Profilo scoped a tenant_id | ✅ query filtra per (auth_user_id × tenant_id) |

### Snapshot POST-FIX

```
projects.client_user_id (nuovi journey):
  "Conversazione di Cliente Nuovo"  → 4b369543 (client) ✅
  "Conversazione di Admin Test"     → NULL ✅ (leakage bloccato)
  "Conversazione di Stef Rientro"   → 07898723 (client) ✅ (idempotente)
```

### Log backend scenario 2 (email admin come client)
```
ERROR [session-guard] auth_user_id=18712745 already bound to role=super_admin 
in tenant=848354b9 — refusing client provisioning for email=admin@moodfordesign.com
```

---

## FILE MODIFICATI

| File | Tipo | Cambio |
|---|---|---|
| `backend/services/client_provisioning.py` | Backend | `_ensure_profile()`: aggiunto `.eq("tenant_id", tenant_id)` + role conflict guard |
| `frontend/src/pages/journey/JourneyPreparingPage.jsx` | Frontend | Rimosso bypass link `?m=` |
| `frontend/src/pages/auth/AuthClientCallback.jsx` | Frontend | Aggiunto role guard: se profileRole != 'client' → redirect a /dashboard |

---

## SCENARI RESIDUI NON ANCORA RISOLTI

| Scenario | Stato |
|---|---|
| Admin crea lead con email B (CRM) → provisioning background chiama `provision_client_after_journey` | ✅ Coperto dal fix `_ensure_profile()` |
| Email B è un'altra staff member dello stesso tenant | ✅ Coperto dal role conflict guard |
| Email B appartiene a un utente di un altro tenant | ✅ Coperto dal filtro tenant_id |
| Magic link scade dopo 24h | ✅ Già gestito da `AuthClientCallback` (concierge UX) |
| `projects.client_user_id = NULL` (provisioning rifiutato) → cliente non può accedere | 🟡 NOTO: il journey esiste ma non è raggiungibile dal cliente. Richiede intervento admin manuale o email differente. |
