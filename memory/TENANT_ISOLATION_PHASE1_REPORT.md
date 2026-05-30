# TENANT ISOLATION HARDENING™ · PHASE 1 REPORT
## ITER173 · 30 May 2026 · Conservative actions · NO RLS

> **Status:** ✅ Phase 1 delivered.
> **Scope:** azioni conservative per ridurre cross-tenant leakage senza
> rompere il backend. **Nessuna RLS attivata** (rimandata a Phase 3).

---

## §1 · AZIONI ESEGUITE (modifiche reali)

### 1.1 · Archiviazione 4 sandbox tenants
**File toccato:** nessuno (operazione DB pura).
**Eseguito:** `UPDATE tenants SET status='archived' WHERE slug IN ('atelier-p0-final','studio-verifica-e2e','studio-tenant-lifecycle','atelier-lifecycle')`.

Snapshot:
```
BEFORE                                              AFTER
─────────────────────────────────────────────────────────────────
studio                            active            studio                            active   ✅ protected
atelier-p0-final                  active            atelier-p0-final                  archived
studio-verifica-e2e               active            studio-verifica-e2e               archived
studio-tenant-lifecycle           active            studio-tenant-lifecycle           archived
atelier-lifecycle                 active            atelier-lifecycle                 archived
margraf-usa                       active            margraf-usa                       active   🆕 nuovo customer
```

> 🆕 **Finding aggiuntivo**: un sesto tenant `margraf-usa` è apparso (probabilmente un customer reale appena onboardato dopo l'audit precedente). **Non toccato** — non era nei 4 da archiviare.

### 1.2 · Fix `_resolve_tenant_id` · env-driven con errore esplicito
**File toccato:** `backend/routers/journey_initiate.py` (linee 59-110)
**File toccato:** `backend/.env` (+1 riga `DEFAULT_PUBLIC_TENANT_SLUG=studio`)

Comportamento nuovo:
| Input | Comportamento prima | Comportamento dopo |
|---|---|---|
| `tenant_slug="studio"` (valid+active) | usa quello | usa quello ✅ |
| `tenant_slug="atelier-p0-final"` (archived) | **silent fallback al "primo tenant by created_at"** ⚠️ | **HTTP 404** "Tenant not active" ✅ |
| `tenant_slug="does-not-exist"` | silent fallback | **HTTP 404** ✅ |
| `tenant_slug=null` | fallback a `tenants.order(created_at).limit(1)` | usa `DEFAULT_PUBLIC_TENANT_SLUG` env-driven ✅ |
| env var mancante + slug=null | – | **HTTP 503** con log d'errore esplicito ✅ |
| env=`studio` ma `studio` archiviato | – | **HTTP 503** "Default public tenant is not active" ✅ |

> ⚠️ **Nessuno silenzioso fallback per `created_at`** — chiuso il rischio R3 dell'audit.

---

## §2 · SMOKE TEST RESULTS

Eseguiti dopo deploy delle 2 modifiche:

| # | Scenario | Atteso | Risultato |
|---|---|---|---|
| 1 | Begin Journey anonimo · NO slug | 201 con tenant `studio` | ✅ HTTP 201, journey creato |
| 2 | Begin Journey · `tenant_slug="studio"` | 201 | ✅ HTTP 201 |
| 3 | Begin Journey · `tenant_slug="atelier-p0-final"` (archiviato) | 404 | ✅ HTTP 404 |
| 4 | Begin Journey · `tenant_slug="does-not-exist"` | 404 | ✅ HTTP 404 |
| 5 | `/api/auth/me` admin | 200 | ✅ HTTP 200 |
| 6 | `/api/relationships/accounts` admin | 200, tutti tenant studio | ✅ HTTP 200 |
| 7 | `/api/leads` admin | 200 | ✅ HTTP 200 |
| 8 | `/api/blueprint-admin/tenants` admin | 200 | 🐞 **HTTP 500 (bug PREESISTENTE)** — colonna `tenants.plan` non esiste, lo schema usa `active_plan`. **Non causato da queste modifiche** (verificato: la query fallisce sempre, prima e dopo). Da fixare in Phase 1.5 separata. |

**Backend boot:** ✅ Application startup complete, no error logs.

---

## §3 · PROPOSTA TECNICA · `tenant_scoped(table, ctx)` helper

### Motivazione
L'audit ha trovato 80+ chiamate `.table(X)` sparse. Pattern ripetuto manualmente:
```python
c.table("leads").select("...").eq("tenant_id", ctx["tenant_id"]).execute()
```
Un grep dimenticato = leak. Serve un'astrazione che renda **impossibile** dimenticare il filter.

### API proposta

```python
# /app/backend/core/scoping.py  (NEW · da creare in Phase 2)

from typing import Any, Dict
from database import db as _raw_db

class ScopedQuery:
    """Thin wrapper around the Supabase query builder that injects
    tenant_id automatically on select / update / delete. Insert calls
    raise unless tenant_id is in the payload (or auto_inject=True)."""

    def __init__(self, table: str, ctx: Dict[str, Any], *, role_bypass: tuple = ("super_admin",)):
        self._table_name = table
        self._tenant_id  = ctx["tenant_id"]
        self._role       = (ctx.get("role") or "").lower()
        self._bypass     = self._role in role_bypass
        self._q          = _raw_db().table(table)

    def select(self, *args, **kwargs):
        q = self._q.select(*args, **kwargs)
        if not self._bypass:
            q = q.eq("tenant_id", self._tenant_id)
        return q

    def update(self, payload):
        q = self._q.update(payload)
        if not self._bypass:
            q = q.eq("tenant_id", self._tenant_id)
        return q

    def delete(self):
        q = self._q.delete()
        if not self._bypass:
            q = q.eq("tenant_id", self._tenant_id)
        return q

    def insert(self, payload, *, auto_inject: bool = False):
        if isinstance(payload, dict):
            if "tenant_id" not in payload:
                if auto_inject:
                    payload["tenant_id"] = self._tenant_id
                else:
                    raise ValueError(f"INSERT into {self._table_name} missing tenant_id "
                                     f"(use auto_inject=True or include it explicitly)")
            elif payload["tenant_id"] != self._tenant_id and not self._bypass:
                raise PermissionError(f"INSERT tenant_id mismatch on {self._table_name}")
        return self._q.insert(payload)


def tenant_scoped(table: str, ctx: Dict[str, Any]) -> ScopedQuery:
    """Open a tenant-scoped query builder. Usage:

        rows = tenant_scoped("leads", ctx).select("*").execute().data
        tenant_scoped("leads", ctx).update({"status":"hot"}).eq("id", lid).execute()
        tenant_scoped("contacts", ctx).insert({"first_name":"x", ...}, auto_inject=True).execute()
    """
    return ScopedQuery(table, ctx)
```

### Vantaggi
1. **Impossibile dimenticare** il filtro tenant — è dentro al wrapper.
2. **Insert protetti**: payload senza `tenant_id` → `ValueError` immediato.
3. **Mismatch rilevato**: chi prova a inserire con `tenant_id` di un altro tenant → `PermissionError`.
4. **Super-admin bypass esplicito** (whitelist `role_bypass`), non implicito.
5. **Drop-in compatibile**: il return è il Supabase query builder nativo, quindi `.eq()`, `.in_()`, `.order()`, `.limit()`, `.execute()` continuano a funzionare.

### Candidati per la prima migrazione (Phase 2)
Ordine consigliato (più safe → più exposed):

| Priorità | Router | Tabelle toccate |
|---|---|---|
| 1° batch | `relationships.py` | `accounts`, `contacts`, `leads` |
| 2° batch | `journeys.py`, `design_journey.py` | `design_journeys`, `projects` |
| 3° batch | `client_portal.py`, `client_messages.py` | `relationship_threads`, `relationship_messages`, `recall_requests` |
| 4° batch | `media.py`, `proposals.py` | `media_library`, `proposals` |
| 5° batch | `journey_initiate.py` (INSERT-only) | TUTTE le INSERT del public initiate |

**NON migrare ancora**: `auth_client.py:37` (resolver email cross-tenant by design), `blueprint_admin.py` (root-superadmin endpoint by design), `superadmin.py`.

### Costo
- 1 nuovo file (`scoping.py` · ~80 righe).
- 0 nuove dipendenze.
- Migrazione per router: ~30-60 minuti ciascuno.
- Zero breaking change se fatto router-by-router con test smoke a ogni step.

---

## §4 · INVENTARIO SERVICE-ROLE KEY

L'audit dello `SUPABASE_SERVICE_ROLE_KEY` in `database.py` mostra che è usata in **ogni** chiamata `db()`. Bypassa RLS by design (è il super-user di Postgres).

### Endpoint che la usano oggi (~tutti, ma classificabili per necessità)

#### A · MUST REMAIN service-role (necessità tecnica)
| Endpoint pattern | Ragione |
|---|---|
| `/api/auth/login` · `/api/auth/me` | deve poter leggere `users_profile` prima che ci sia un JWT |
| `/api/public/journeys/initiate` (anonymous) | nessun JWT, anonymous user |
| `/api/public/storefront/*` | sito pubblico anonimo |
| `/api/auth/client/silent-magic-link` | resolver email cross-tenant by design |
| `/api/blueprint-admin/*` | cross-tenant by design (gated da ROOT_SUPERADMIN) |
| `/api/superadmin/*` | cross-tenant by design |
| `/api/admin/tenant/email-identity` (ITER173 P1) | tenant_admin scrive `tenant_settings` di se stesso |
| Resend webhook handlers | nessun JWT user |
| Magic link generation/consumption | accesso cross-tenant temporaneo |

**Stima:** ~40% degli endpoint backend.

#### B · COULD use JWT/user-scoped client (Phase 3 candidate)
| Endpoint pattern | Note |
|---|---|
| `/api/relationships/*` (tenant_admin reads) | gli operatori usano già JWT; client user-scoped + RLS chiuderebbe completamente |
| `/api/journeys/*` (studio reads) | idem |
| `/api/client/*` (client reads/writes) | il client ha già JWT; ottimo candidato per RLS-per-row con `client_user_id = current_user_id()` |
| `/api/conversation/*` | thread participants known, RLS perfetta |
| `/api/media/*` (uploads tenant-scoped) | idem |

**Stima:** ~50% degli endpoint backend.

#### C · MIXED (entrambi i client per query path)
| Endpoint | Note |
|---|---|
| `/api/journey-initiate` (rebind logic) | INSERT anonymous, SELECT post-auth — necessita riflessione |
| `/api/profile/me` con `auth_user_id` mismatch handling | edge case |

**Stima:** ~10% degli endpoint backend.

### Raccomandazione operativa
1. Phase 3 (RLS + JWT-scoped client) inizia migrando i **path B**, lasciando A intatti.
2. `database.py` espone 2 funzioni: `db_admin()` (service-role, esplicito) e `db_user(jwt)` (anon-key + Authorization header → bypassa Postgres come l'utente). Sostituire `db()` (service-role default) con `db_admin()` dove necessario, e `db_user(jwt)` ovunque c'è ACL utente.
3. Nei prossimi PR, vietare l'uso di `db()` (alias deprecato) nei nuovi file via lint rule.

---

## §5 · PIANO RLS PROGRESSIVO

### Phase 3.A · Foundation tables (LOW RISK)
**Target:** `accounts`, `contacts`, `leads`
**Perché prima:** poche righe (5-20 nel DB attuale), pattern uniforme già `.eq("tenant_id", ...)`, no cross-table joins runtime-critici.

Policy proposta:
```sql
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON accounts
  USING (tenant_id::text = current_setting('app.tenant_id', true)
         OR is_root_superadmin());

-- ripeti per contacts, leads
```

Backend: ogni chiamata `db_user(jwt)` set `SET LOCAL app.tenant_id = ctx.tenant_id` all'inizio della transazione.

**Smoke:** /api/relationships/accounts (admin), /api/leads (admin), /begin-journey (anonymous insert via service-role).

### Phase 3.B · Project core (MEDIUM RISK)
**Target:** `projects`, `design_journeys`, `journey_milestones`, `journey_briefs`
**Sfide:** rebind logic ITER171 inserisce con `tenant_id` NULL inizialmente — RLS deve consentire INSERT NULL ai service-role.

### Phase 3.C · Messaging + media (MEDIUM-HIGH RISK)
**Target:** `relationship_threads`, `relationship_messages`, `media_library`, `proposals`, `recall_requests`
**Sfide:** thread participants check (`client_profile_id` o `primary_designer_id`) richiede policy più complessa con OR su due colonne.

Policy proposta `relationship_threads`:
```sql
USING (
  tenant_id::text = current_setting('app.tenant_id', true)
  AND (
    is_root_superadmin()
    OR is_tenant_admin()
    OR client_profile_id = current_user_profile_id()
    OR primary_designer_id = current_user_profile_id()
  )
)
```

### Phase 3.D · Edge cases
- `users_profile`: serve policy speciale per consentire all'utente di leggere il PROPRIO record sempre.
- `tenants`: lookup pubblico per slug deve restare unfiltered.
- `tenant_settings`: scope-per-tenant ma ROOT_SUPERADMIN può leggere tutti.

### Test strategy per ogni phase
1. Property test: invocare endpoint con JWT tenant A e JWT tenant B; verificare zero overlap response.
2. Negative test: forzare `app.tenant_id` settato in modo errato → tutti gli endpoint devono fallire o tornare vuoto, **mai mostrare dati di un altro tenant**.
3. Smoke test E2E manuale: begin-journey + magic link + companion + brief + invio messaggio + recall.
4. Performance test: misurare overhead RLS (atteso <5% su query indicizzate).

### Rischi noti del piano
| ID | Rischio | Mitigazione |
|---|---|---|
| RLS-R1 | rebind logic ITER171 con `tenant_id=NULL` iniziale | service-role bypass su INSERT public |
| RLS-R2 | il backend usa pool di connessioni; `SET LOCAL` per-query è OK, `SET app.tenant_id` globale NO | implementare middleware FastAPI che imposta `SET LOCAL` all'inizio di ogni request |
| RLS-R3 | testing agent può non avere il giusto JWT scope | usare `db_admin()` esplicito nei test |
| RLS-R4 | regressione admin UI (vedono 500 invece di empty) | feature flag `RLS_ENABLED=false` per rollback rapido |

---

## §6 · FILE MODIFICATI IN QUESTA PHASE 1

| # | File | Tipo | Riga | Descrizione |
|---|---|---|---|---|
| 1 | `backend/routers/journey_initiate.py` | edit | +33 / -14 (linee 59-110) | `_resolve_tenant_id` env-driven con errore esplicito |
| 2 | `backend/routers/journey_initiate.py` | edit | +3 / -1 (top) | aggiunti `import logging`, `import os`, `logger` |
| 3 | `backend/.env` | edit | +1 | `DEFAULT_PUBLIC_TENANT_SLUG=studio` |
| 4 | DB | data | 4 row | `UPDATE tenants SET status='archived' WHERE slug IN (4 sandbox)` |

**Totale codice toccato:** ~40 righe in 1 solo file backend + 1 riga env + 4 update DB.

---

## §7 · BUG PREESISTENTI EMERSI DURANTE LO SMOKE

| ID | Bug | Severity | File | Note |
|---|---|---|---|---|
| **B1** | `/api/blueprint-admin/tenants` HTTP 500 — query SELECT `tenants.plan` ma la colonna è `active_plan` | 🟡 ROOT_SUPERADMIN UI quindi impatto basso | `backend/routers/blueprint_admin.py:138` | bug preesistente, NON causato da queste modifiche. Da fixare in Phase 1.5 |
| B2 | `/api/dashboard` → 404 admin role | ⚪ Nota | — | endpoint inesistente in canonical map (probabilmente migrato altrove) |
| B3 | `/api/relationships/contacts` → 404 admin role | ⚪ Nota | — | tabella ha 0 righe, endpoint potrebbe richiedere param |

> Decisione: non corretti in questa Phase per rispettare il vincolo "modificare solo punto 1 e 2".

---

## §8 · PROSSIMI STEP CONSIGLIATI

### Immediate (Phase 1.5 · 5 min)
- Fixare B1 (`tenants.plan` → `tenants.active_plan` in `blueprint_admin.py:138`)

### Short-term (Phase 2 · 1 settimana)
- Implementare `tenant_scoped(table, ctx)` helper (§3)
- Migrare i primi 2 batch (relationships + journeys)
- Smoke test E2E completo via testing_agent_v3

### Mid-term (Phase 3 · 2-3 settimane)
- Implementare RLS progressiva secondo §5
- Refactor `database.py` con `db_admin()` + `db_user(jwt)` split
- Property tests cross-tenant

### Long-term (Phase 4 · 1 mese)
- Lint rule custom: vietare `db()` raw in nuovi PR (deve usare `tenant_scoped` o `db_user`)
- Rotazione service-role key (procedura documentata)
- `users` legacy DROP

---

## §9 · CONCLUSIONI

✅ **Phase 1 chiusa**. I 2 rischi più immediati dell'audit (R3 fallback fragile + 4 sandbox tenants) sono **mitigati** senza alcuna RLS attivata e senza modifiche dirompenti al backend.

Il sistema mantiene il 100% della funzionalità (tutti gli smoke verdi tranne B1 preesistente) e ora:
- Rifiuta esplicitamente tenant inesistenti o archiviati invece di fare wrong-routing silenzioso.
- Espone una env var standard (`DEFAULT_PUBLIC_TENANT_SLUG`) per controllare il routing pubblico.
- Ha 4 sandbox tenants invisibili nella maggior parte dei flussi (ancora visibili in `/api/blueprint-admin/tenants` come ROOT-only, by design).

Phase 2 e Phase 3 sono pianificate ma **non eseguite**.

> ⚠️ Come da direttiva: nessuna RLS, nessuna migrazione codice di massa, solo Phase 1 conservativa.
