# TEAM SYSTEM AUDIT
> Analisi tecnica del sistema esistente — nessun codice prodotto.
> Prodotto: 11 giugno 2026

---

## 1. SCHEMA DATI ESISTENTE

### 1.1 `users_profile` (Members)

| Colonna | Tipo | Uso attuale | Note |
|---|---|---|---|
| `id` | UUID | PK | |
| `tenant_id` | UUID | FK tenant | |
| `auth_user_id` | UUID | FK Supabase Auth | |
| `first_name`, `last_name` | text | Anagrafica | |
| `email` | text | Contatto | |
| `role` | text | Ruolo sistema | Valori: `super_admin`, `tenant_admin`, `project_manager`, `designer`, `editor`, `client` |
| `status` | text | Stato utente | `active`, `invited`, `suspended` |
| `role_label` | text | Etichetta UI | Es: "Fondatore", libero |
| `short_bio` | text | Bio visibile | Usata in presentazione cliente |
| `response_time_label` | text | Stile di risposta | Es: "Rispondo entro 24h" |
| `contact_cta_label` | text | CTA contatto | Es: "Scrivimi" |
| `preferred_locale_code` | text | Lingua preferita | Es: `EN_US`, `IT`, `FR` |
| `metadata_json` | JSONB | Estensibile | **Attualmente solo `ui_density`** |
| `invited_by`, `invited_at`, `accepted_at` | | Onboarding | |
| `suspended_at`, `suspended_by`, `suspended_reason` | | Governance | |
| `is_root_superadmin` | bool | Protezione | |

**GAP RILEVATI:**
- Nessun campo `skills[]` (competenze tecniche: lighting, material, residential, retail...)
- Nessun campo `markets[]` (mercati serviti: IT, UK, FR, DE, GCC...)
- Nessun campo `languages[]` (lingue parlate per client-facing)
- Nessun campo `specializations[]` (Residential / Retail / Commercial / Hospitality)
- Nessun campo `capacity_score` o `max_active_journeys`

**ROUTING GIÀ POSSIBILE:**
- Routing per `role` (gerarchia esistente)
- Routing per `preferred_locale_code` (campo presente, non ancora usato nel router)

---

### 1.2 `human_assignments`

| Colonna | Tipo | Uso attuale |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK |
| `subject_type` | text | `client`, `lead`, `project`, `studio_onboarding` |
| `subject_id` | UUID | ID del soggetto assegnato |
| `assignee_user_id` | UUID | Chi riceve l'assegnazione |
| `assignment_reason` | text | Motivo: `only_available_user`, `round_robin`, ecc. |
| `status` | text | `active`, `completed`, `unassigned` |
| `first_contact_suggested_at` | timestamp | Workflow CRM |
| `first_contact_sent_at` | timestamp | Workflow CRM |
| `first_contact_status` | text | Workflow CRM |
| `metadata_json` | JSONB | Estensibile |
| `created_by` | UUID | Chi ha creato l'assegnazione |

**ROUTING ESISTENTE:**
```
_PRIORITY_FOR_CLIENT = [
    ["tenant_admin"],         ← 1° preferenza
    ["project_manager"],      ← 2°
    ["designer", "editor"],   ← 3°
    ["super_admin"],          ← fallback assoluto
]

_PRIORITY_FOR_STUDIO_ONBOARDING = [
    ["super_admin"],
    ["tenant_admin"],
    ["project_manager"],
]
```
Il tie-break è **round-robin per conteggio assegnazioni attive** (deterministic).

**GAP RILEVATI:**
- Il routing è solo per `role` — no matching su lingua, mercato, competenza
- `assignment_reason` non è ancora differenziato per causa reale
- `metadata_json` non usato

---

### 1.3 `design_journey_assignments`

| Colonna | Tipo | Uso attuale |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK |
| `journey_id` | UUID | FK design_journeys |
| `user_id` | UUID | FK users_profile |
| `assignment_role` | text | Ruolo nel journey: **solo `owner` usato** |
| `client_visible` | bool | Visibile al cliente? |
| `assigned_at` | timestamp | |
| `assigned_by` | UUID | Chi ha assegnato |
| `revoked_at` | timestamp | NULL = attivo |
| `revoked_by`, `revoke_reason` | | Revoca |
| `metadata_json` | JSONB | Estensibile |

**ROUTING GIÀ FUNZIONANTE (dopo P0 fix):**
- `assignment_role = 'owner'` assegnato su tutti i path (A, B, C, D)
- `ensure_owner()` + `change_owner()` + `revoke_all()` già implementati

**POSSIBILI ROLE NON ANCORA USATI:**
- `lead_designer` (non ancora assegnato)
- `reviewer` (non ancora assegnato)
- `collaborator` (non ancora assegnato)
- `client_rep` (non ancora assegnato)

---

### 1.4 `projects`

| Colonna rilevante | Uso |
|---|---|
| `assigned_to` | FK users_profile — assegnatario principale |
| `client_user_id` | FK users_profile — cliente autenticato |
| `metadata_json` | Contiene `account_id` per lazy-init |

**Gap:** `assigned_to` non è sincronizzato con `design_journey_assignments.owner`. Sono due sistemi paralleli.

---

### 1.5 Roles/Permissions dedicati

**NESSUNA tabella dedicata esiste:**
- Nessuna `roles`
- Nessuna `permissions`
- Nessuna `role_permissions`

I ruoli sono gestiti come `text` enum nella colonna `users_profile.role`.

---

## 2. MAPPA COMPETENZE, MERCATI, LINGUE

### 2.1 Cosa esiste già

| Attributo | Campo | Stato |
|---|---|---|
| Ruolo primario | `users_profile.role` | ✅ Presente e usato nel routing |
| Etichetta presentazione | `users_profile.role_label` | ✅ Presente, non usato nel routing |
| Lingua preferita | `users_profile.preferred_locale_code` | ✅ Presente, **non usato nel routing** |
| Bio breve | `users_profile.short_bio` | ✅ Presente, solo per presentazione cliente |
| Mercati | — | ❌ Non esiste |
| Competenze | — | ❌ Non esiste |
| Specializzazioni | — | ❌ Non esiste |
| Capacità (max journey) | — | ❌ Non esiste |

### 2.2 Routing già possibile senza nuove colonne

**Routing per lingua** (fattibile oggi):
```python
# _candidates_for() può essere esteso con:
.eq("preferred_locale_code", client_locale)
# ↓ Fallback se nessuno matcha la lingua
```

Questo richiede solo una modifica a `_candidates_for()` — nessuna migrazione DB.

**Routing per `project_type`** (parzialmente fattibile):
Il `project_type` è nei metadata di account/lead, non in `users_profile`. Per fare matching:
1. `users_profile.metadata_json["specializations"]` = `["residential", "retail"]` (da aggiungere)
2. Il router legge `specializations` e filtra i candidati

Richiede una **migrazione leggera**: solo aggiungere chiave in `metadata_json`.

---

## 3. ROUTING GIÀ FUNZIONANTE

| Path | File | Trigger | Owner assegnato |
|---|---|---|---|
| A — Begin Journey | `journey_initiate.py` | Public form | ✅ Primo admin/designer del tenant |
| B — Lead Conversion | `lead_conversion.py` | `start-journey` | ✅ Profile attivo o fallback |
| C — CRM Create Journey | `account_journeys.py` | CRM action | ✅ Utente corrente |
| D — Lazy Init Progetto | `design_journey.py` | GET journey | ✅ Utente corrente o fallback |

**Algoritmo:** `ensure_owner()` → check se esiste → se non esiste, inserisce → se esiste già l'owner corretto, no-op.

---

## 4. GAP REALI

### P1 — Critici (bloccanti per feature future)

| Gap | Impatto | Soluzione minima |
|---|---|---|
| Nessun campo `specializations` in `users_profile` | Routing per project_type impossibile | Aggiungere `metadata_json["specializations"]` |
| Nessun campo `markets` in `users_profile` | Routing per mercato editoriale impossibile | Aggiungere `metadata_json["markets"]` |
| `projects.assigned_to` non sincronizzato con `dja.owner` | Doppio stato | Allineare su evento post-assegnazione |

### P2 — Desiderabili

| Gap | Impatto | Soluzione |
|---|---|---|
| `preferred_locale_code` non usato nel routing | I clienti non-IT vengono assegnati a utenti che non parlano la loro lingua | Estendere `_candidates_for()` con filtro locale |
| `assignment_role` in `dja` solo 'owner' | Nessun ruolo lead_designer, reviewer, collaborator | Estendere `assignment_role` enum + UI |
| Nessuna tabella `permissions` | Nessun RBAC granulare | Aggiungere solo se necessario in futuro |

### P3 — Backlog

| Gap | Note |
|---|---|
| Capacità per membro (`max_concurrent_journeys`) | Round-robin cieco oggi |
| Storico performance assegnatario | Nessuna metrica di qualità |
| Auto-reassignment su revoca | Deve essere manuale oggi |

---

## 5. RACCOMANDAZIONI

**Prima stabilizzare** (in corso con P0/P1):
1. Journey ownership ✅ (completato oggi)
2. Milestone owner assignment (richiede migrazione `milestone_assignments`)
3. Sync `projects.assigned_to` con `dja.owner`

**Poi estendere** (sprint futuri):
1. Aggiungere `metadata_json["specializations"]` e `metadata_json["markets"]` a `users_profile` tramite UI settings/members
2. Estendere `_candidates_for()` per filtrare per lingua e specializzazione
3. Aggiungere `assignment_role` secondari nei `design_journey_assignments`

**Non sviluppare ora:**
- Tabelle `roles`/`permissions` dedicate (over-engineering per il tenant attuale)
- Sistema di performance/rating assegnatari
- Auto-reassignment automatica

---

## 6. STATO ATTUALE SISTEMA (post P0)

```
design_journey_assignments: 5 record
  - tutti con assignment_role = 'owner'
  - copertura: 4 path di creazione journey (A, B, C, D)

human_assignments: 2 record attivi
  - subject_type = 'client'
  - assignment_reason = 'only_available_user' (round-robin da 1 candidato)

users_profile (team non-client):
  - 2 utenti staff attivi (super_admin + project_manager)
  - preferred_locale_code: EN_US (admin), None (pm)
  - metadata_json: solo ui_density, nessuna specializzazione
```
