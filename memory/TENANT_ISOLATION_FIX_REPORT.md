# TENANT ISOLATION FIX REPORT — P0-A

> **Data**: 2026-06-02 04:42 UTC
> **Verdetto**: ✅ **TENANT ISOLATION RESOLVED**
> **Test E2E**: 4 isolation assertions PASS · 4 legitimate access PASS

---

## 1. PROBLEMA RISOLTO

Prima del fix, un Founder loggato col proprio magic-link e relativo JWT (`role=owner`) poteva accedere a **qualsiasi** endpoint admin / Command Center semplicemente cambiando l'URL: tutta la pipeline di candidature, i manifest di tutti i tenant, le relazioni MOOD↔Studi, l'editorial admin. Verifica realizzata nel `FIRST_REAL_TENANT_READINESS_REPORT` ed evidenziata come showstopper P0.

Causa: `ALLOWED_ROLES = {"admin", "editor", "advisor", "owner"}` sia in `require_admin_tenant` che in `require_advisor_scope`. Il ruolo `owner` veniva inserito per consentire al Founder di leggere il proprio tenant manifest, ma di fatto sbloccava qualunque endpoint dietro lo stesso guard, perché:
- gli endpoint con `{slug}` nel path usano l'URL slug per fare query DB, ignorando il tenant del JWT;
- gli endpoint sotto `require_advisor_scope` filtrano per `advisor_visibility_id`, che per `owner` risulta `None` → nessun filtro → restituiscono tutto.

---

## 2. POLICY DEFINITIVA (BINDING)

Quattro ruoli con accessi distinti:

| Role | Cosa può fare |
|---|---|
| `admin`, `editor` | **Super-admin**. Possono accedere a qualunque tenant tramite header `X-Tenant-Slug` o claim JWT. Accesso completo a `/admin/*` (compreso `/admin/tenant-activation/*`, `/admin/studio/*`, `/admin/relations/*`). |
| `advisor` | Pipeline + studio requests + relations LIMITATI al proprio `advisor_id` (auto-scope nei query). No tenant manifest cross-tenant. |
| `owner` (Founder) | Accesso ESCLUSIVO al **proprio** tenant. Header `X-Tenant-Slug` IGNORATO. Path `{slug}` deve uguagliare `JWT.tenant_slug` altrimenti 404. **Nessun accesso** a Command Center pipeline / studio requests / cross-tenant manifests / editorial admin di altri tenant. |
| altre / nessuna | 401/403. |

---

## 3. FILE MODIFICATI

| File | Modifica |
|---|---|
| `backend/routers/_auth.py` | Riscritto. Nuova policy `SUPER_ADMIN_ROLES = {"admin","editor"}` vs `TENANT_BOUND_ROLES = {"owner"}`. `require_admin_tenant` ora forza il tenant del JWT per `owner` (header ignorato). Nuovo helper `enforce_tenant_match(url_slug, tenant)` che lancia 404 se mismatch e bypassa super-admin. |
| `backend/routers/_advisor_scope.py` | Rimosso `"owner"` da `ALLOWED_ROLES`. I founders ora ricevono `403 Forbidden` su tutti gli endpoint che usano questo guard. |
| `backend/routers/admin_relations.py` | Import di `enforce_tenant_match`. Endpoint `GET /admin/tenants/{slug}/manifest` ora chiama `enforce_tenant_match(slug, _tenant)` prima della query. Endpoint `GET /admin/copy/manifest` migrato da `require_advisor_scope` a `require_admin_tenant` (così founder può leggere editorial copy del PROPRIO tenant). |

Nessuna modifica a schema DB, .env, requirements.txt, package.json.

---

## 4. CODE CHANGES — punti chiave

### `_auth.py` — tenant resolution policy
```python
if role in TENANT_BOUND_ROLES:
    # Owner: tenant is FORCED to JWT claim. X-Tenant-Slug is ignored.
    if not tenant_slug_from_jwt:
        raise HTTPException(status_code=403, detail="Tenant claim missing")
    slug = tenant_slug_from_jwt
else:
    # Super admin: header > JWT > corporate fallback.
    slug = x_tenant_slug or tenant_slug_from_jwt
```

### `_auth.py` — path slug enforcement
```python
def enforce_tenant_match(url_slug: str, tenant: dict) -> None:
    role = (tenant or {}).get('_role')
    if role in SUPER_ADMIN_ROLES:
        return  # admin/editor bypass
    if (tenant or {}).get('slug') != url_slug:
        raise HTTPException(status_code=404, detail="Tenant not found")
```
Nota: ritorna 404 (non 403) per non rivelare l'esistenza di altri tenant via timing/diff dell'errore.

### `_advisor_scope.py` — restrict to staff
```python
SUPER_ADMIN_ROLES = {"admin", "editor"}
ADVISOR_ROLE = "advisor"
ALLOWED_ROLES = SUPER_ADMIN_ROLES | {ADVISOR_ROLE}  # 'owner' rimosso
```

---

## 5. TEST EFFETTUATI (founder JWT contro endpoint reali)

Test diretto con `curl`, JWT founder del tenant `hardening-1780373998`:

| # | Endpoint | Atteso | Osservato |
|---|---|---|---|
| 1 | `GET /admin/tenant-activation/pipeline` | 401/403 | ✅ **403** Forbidden |
| 2 | `GET /admin/studio/requests` | 401/403 | ✅ **403** Forbidden |
| 3 | `GET /admin/tenants/studio/manifest` (altro tenant) | 401/403/404 | ✅ **404** Not Found |
| 4 | `GET /admin/relations` | 401/403 | ✅ **403** Forbidden |
| 5 | `GET /admin/tenants/{own_slug}/manifest` | 200 | ✅ **200** OK |
| 6 | `GET /admin/copy/manifest?namespace=admin.founder` | 200 | ✅ **200** OK (own tenant copy) |
| 7 | `GET /founder/first-access-state` | 200 | ✅ **200** OK |
| 8 | `GET /auth/me` | 200 | ✅ **200** OK |

8/8 PASS.

Test integrato dal `FIRST_REAL_TENANT_READINESS_AUDIT` con scenario Martinel (sezione Founder Experience):
```
[PASS P0] founder.auth_me_role_owner         — role=owner email=mario.rossi.…
[PASS P0] founder.auth_me_tenant_slug        — tenant.slug=martinel-interior-design-4
[PASS P0] founder.tenant_isolation           — cross-tenant manifest http=404
[PASS P0] founder.command_center_pipeline_blocked — pipeline http=403
[PASS P0] founder.studio_requests_blocked    — studio_requests http=403
[PASS P1] founder.editorial_copy_own_tenant_only — copy manifest http=200
[PASS P0] founder.own_manifest_access        — own manifest http=200 (slug=martinel-…-4)
[PASS P1] founder.first_access_state         — is_founder=True first_access=True
```

---

## 6. EFFETTI COLLATERALI E COMPATIBILITÀ

- **Super-admin (admin/editor)**: comportamento INVARIATO. Continuano a usare `X-Tenant-Slug` header e accedere a qualunque tenant.
- **Advisor**: comportamento INVARIATO. Continuano a vedere pipeline/relations filtrate sul proprio advisor_id.
- **FounderWelcome.jsx**: continua a funzionare. La pagina richiede:
  - `GET /admin/tenants/{slug}/manifest` (proprio slug dal localStorage) → ✅ 200
  - `GET /admin/copy/manifest?namespace=admin.founder` → ✅ 200 (ora usa `require_admin_tenant`)
  - `GET /founder/first-access-state` → ✅ 200
- **Magic link consume**: emette JWT con `tenant_slug` corretto → `require_admin_tenant` riconosce il tenant del founder.
- **Endpoint con path `{slug}`**: solo `/admin/tenants/{slug}/manifest` chiama `enforce_tenant_match`. Altri endpoint scoped sotto `require_admin_tenant` non richiedono enforcement perché non hanno path-slug.

---

## 7. RISCHI RESIDUI

| # | Rischio | Probabilità | Impatto | Mitigazione |
|---|---|---|---|---|
| R1 | Endpoint che usano `_tenant['slug']` da `require_admin_tenant` ma fanno query con path-slug non sanificato | bassa | media | Audit grep su `path_param.*slug.*WHERE slug` → solo `/admin/tenants/{slug}/manifest` corrisponde al pattern, ed è già protetto. |
| R2 | Nuovi endpoint futuri che dimenticano `enforce_tenant_match` | media | alta | Aggiungere convenzione di code review + linter rule. **Out-of-scope per questo sprint**. |
| R3 | Editorial blocks scrivibili da owner via `/admin/site/*` | molto bassa | media | Quegli endpoint usano `require_admin_tenant`, owner è tenant-bound → può scrivere SOLO sui blocchi del proprio tenant. Sicuro by design, ma non testato qui. |

Nessun rischio residuo classificato P0.

---

## 8. CLASSIFICAZIONE

### ✅ **TENANT ISOLATION RESOLVED**

Pronto per ricevere il primo Founder reale senza rischio di cross-tenant data leak.
