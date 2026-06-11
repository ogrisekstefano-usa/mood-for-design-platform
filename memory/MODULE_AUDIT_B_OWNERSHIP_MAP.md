# MODULE CONNECTION AUDIT — DOCUMENTO B: OWNERSHIP MAP
> Prodotto: 10 Jun 2026 · Audit statico completo del codebase

---

## 1. Owner per Entità

| Entità | Colonna owner primaria | Tipo | Popolata? | Note |
|--------|----------------------|------|-----------|------|
| `leads` | `tenant_id` | tenant scope | ✅ sempre | Nessun `owner_user_id` — scoping tenant-wide |
| `accounts` | `primary_owner_id` | `users_profile.id` | ⚠️ nullable | Popolato solo se settato manualmente in CRM. Path A/B/C non lo settano |
| `contacts` | (via `account_id`) | FK account | ✅ | Proprietà derivata dall'account |
| `projects` | `client_user_id` | `users_profile.id` | ⚠️ CRITICO | Popolato **solo** da `client_provisioning.py`. Path B, C, D non lo settano |
| `design_journeys` | `created_by` + `owner_user_id` | `users_profile.id` | ⚠️ parziale | `created_by` = chi ha aperto il journey. `owner_user_id` = designer assegnato (nullable). Solo path C usa `ensure_owner()` |
| `journey_milestones` | `owner_user_id` | `users_profile.id` | ⚠️ parziale | Solo il milestone `brief` riceve `owner_user_id = user_id`. Gli altri 9 NULL |
| `moodboards` | `created_by` | `users_profile.id` | ✅ | Designer che ha creato il moodboard. Nessun `account_id` come FK |
| `proposals` | `created_by` | `users_profile.id` | ✅ | Designer/PM che ha creato la proposta. Nessun `account_id` come FK |
| `proposal_signoffs` | `client_user_id` | `users_profile.id` | ✅ | Chi ha firmato (client role) |

---

## 2. Mappatura account_id per Entità

Questa colonna è il perno di quasi tutto il sistema. Il suo stato è disomogeneo:

| Entità | Colonna `account_id` | Stato |
|--------|---------------------|-------|
| `design_journeys` | `account_id` (NOT NULL in canon) | ✅ presente, ma storicamente alcune righe hanno NULL (bug noto: `88c072b7`) |
| `moodboards` | `account_id` | ⚠️ non è colonna standard. Presente solo su moodboard creati via flussi specifici; `client_relations.py` la legge best-effort |
| `proposals` | `account_id` | ❌ non è colonna standard. `account_lifecycle.py` fa `.get("account_id")` che torna sempre None → check disabilitato di fatto |
| `contacts` | `account_id` FK | ✅ sempre presente, FK rigorosa |
| `accounts` | `legacy_lead_id` | ⚠️ link retroattivo al lead di origine (non FK formale, solo convenzione) |
| `projects` | `metadata_json.account_id` | ⚠️ solo per path D (fragile, non colonna) |

---

## 3. owner_user_id — Mappa Dettagliata

### 3a. `design_journeys.created_by`
| Path | Valore |
|------|--------|
| A (journey_initiate) | `NULL` — pubblico, nessun user autenticato |
| B (lead_conversion) | `ctx["profile_id"]` ✅ |
| C (account_journeys) | `current_user.get("user_id")` ✅ + `ensure_owner()` |
| D (design_journey/get_or_create) | `user_id` dal context ✅ |

### 3b. `design_journeys.owner_user_id`
| Path | Valore |
|------|--------|
| A (journey_initiate) | `NULL` ❌ |
| B (lead_conversion) | `NULL` — campo non settato ❌ |
| C (account_journeys) | Delegato a `ensure_owner()` → `journey_assignments` ✅ |
| D (design_journey) | `NULL` ❌ o settabile via PATCH |

### 3c. `projects.client_user_id`
| Path | Valore |
|------|--------|
| A (journey_initiate) | Settato da `provision_client_after_journey()` (NON-blocking) → ⚠️ può fallire silenziosamente |
| B (lead_conversion) | `NULL` ❌ non settato |
| C (account_journeys) | `NULL` ❌ non settato |
| D (design_journey) | `NULL` ❌ non settato |

**Conseguenza**: il `client_portal.py` che filtra via `projects.client_user_id = profile_id` funziona **SOLO** per i journey creati via Path A + provisioning. Tutti gli altri journey **NON** compaiono nel portal del cliente.

---

## 4. Doppio Meccanismo di Ownership nel Client Portal

```
/api/client/overview          → projects.client_user_id = profile_id
/api/client/journeys          → projects.client_user_id = profile_id (via _client_project_ids)
/api/client/welcome-summary   → accounts.email = profile.email → design_journeys.account_id
/api/client/journeys/{jid}/companion → design_journeys → projects.client_user_id check
```

Due meccanismi di risoluzione coesistono:
- **Meccanismo 1** (principale): `projects.client_user_id` — presente solo se provisioning OK
- **Meccanismo 2** (welcome-summary): `accounts.email` → `design_journeys.account_id` — più robusto ma usato solo nell'endpoint welcome

---

## 5. Pipeline di Ownership — Rischi

| # | Entità | Rischio ownership | Percorso affetto |
|---|--------|-------------------|-----------------|
| O1 | `projects.client_user_id = NULL` | Journey non appare nel portal del cliente | B, C, D |
| O2 | `accounts.primary_owner_id = NULL` | CRM non sa a quale designer appartiene l'account | A, B, C |
| O3 | `design_journeys.owner_user_id = NULL` | Journey non ha designer assegnato | A, B, D |
| O4 | `proposals.account_id` assente | Impossibile validare che la proposta appartenga all'account prima della conversione | Tutti |
| O5 | `moodboards.account_id` inconsistente | `Used-In` counts nel CRM imprecisi | Tutti |

---

*Audit statico — MODULE CONNECTION AUDIT*
