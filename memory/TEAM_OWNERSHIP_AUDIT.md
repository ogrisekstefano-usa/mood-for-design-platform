# TEAM OWNERSHIP & DESIGN JOURNEY RESPONSIBILITY AUDIT
# Documento completo — 7 sezioni
> Prodotto: 11 Jun 2026 · Audit statico + dati reali DB · NESSUN CODICE

---

# SEZIONE 1 — OWNERSHIP MAP ATTUALE

## 1.1 Per Entità

### `users_profile`
| Campo owner | `id` (PK) |
|-------------|-----------|
| Può essere NULL? | No |
| Chi assegna | Signup / invite / provisioning |
| Ownership display | `role_label` (custom), `short_bio`, `response_time_label`, `contact_cta_label` — configurabili via PATCH `/api/profile` |
| Campo in UI | Portal welcome, sidebar referente |
| Fallback | Email prefix come display name |

---

### `tenant_memberships`
| Campo owner | `profile_id` FK + `invited_by` FK |
|-------------|-----------------------------------|
| Può essere NULL? | No |
| Chi assegna | `members.py → /invite` |
| Chi legge | Auth flow, onboarding |
| UI | Settings → Team |
| Colonne chiave | `role`, `status` (invited/active/suspended), `is_primary`, `invited_by`, `invited_at`, `accepted_at` |

---

### `accounts`
| Campo owner | `primary_owner_id` FK → `users_profile.id` |
|-------------|---------------------------------------------|
| Può essere NULL? | **Sì — sempre NULL in tutti i path attuali** |
| Chi assegna | Nessuno (non settato automaticamente) |
| Chi legge | `journeys.py → CLIENT_REBIND` (riga 865) + `client_relations.py` |
| UI | CRM account detail |
| Fallback | `human_assignments` per subject_type=client (separate da primary_owner_id) |

---

### `projects`
| Campo | Tipo | NULL? | Assegnato da |
|-------|------|-------|-------------|
| `client_user_id` | FK → users_profile | NULL se no provisioning | `provision_client_after_journey()` (FIX P0-B ora attivo) |
| `assigned_to` | UUID (nullable) | Sì | Path manuale o `account_journeys.py` |
| `created_by` | UUID | No | Chi ha aperto il journey |
| `project_type` | TEXT | Sì | Form begin-journey o creazione manuale |
| `lead_id` | UUID | Sì | Solo Path B (lead_conversion) |

---

### `design_journeys`
| Campo | Tipo | NULL? | Note |
|-------|------|-------|------|
| `created_by` | UUID | No | Profile ID di chi ha avviato |
| `account_id` | UUID | No (canon) | Account cliente |
| `project_id` | UUID | No | Project shell 1:1 |
| `owner_user_id` | — | — | **COLONNA NON ESISTE** — owner è in `design_journey_assignments` |
| Ownership reale | `design_journey_assignments.assignment_role = 'owner'` | Sì se non assegnato | Vedi §1.2 |

---

### `design_journey_assignments` (TABELLA CENTRALE)
| Campo | Valore |
|-------|--------|
| Ruoli supportati | `owner`, `contributor`, `observer` |
| Cardinalità owner | 1 UNICO per journey (DB unique partial index) |
| Cardinalità contributor | N per journey |
| Cardinalità observer | N per journey |
| client_visible | Bool per ruolo: owner=True, contributor=True, observer=False |
| Revoca owner | Solo via `change_owner()` — non revocabile senza sostituto |
| Audit | `design_journey_assignment_events` (ogni mutation) |
| Stato tabella | **Vuota** (nessuna journey attuale) |
| Chi chiama `ensure_owner()` | Solo `account_journeys.py` Path C — NON chiamato da Path A/B/D |

---

### `journey_milestones`
| Campo owner | `metadata.assigned_to` (JSONB — non colonna dedicata) |
|-------------|-----------------------------------------------------|
| Colonna `owner_user_id` | **NON ESISTE** nel DB |
| Colonna `assigned_to` | **NON ESISTE** nel DB |
| Ownership attuale | Nessuna — milestone non ha un owner a livello di colonna |
| In metadata JSONB | Possibile (non strutturato), ma non letto da nessun endpoint |
| Fallback | Il journey owner (da `design_journey_assignments`) viene considerato responsabile di tutti i milestone |

---

### `moodboards`
| Campo owner | `created_by` FK → users_profile |
|-------------|----------------------------------|
| Può essere NULL? | No |
| Collaboratori | Non gestiti (nessuna tabella di assegnazione moodboard) |
| Chi legge | `insights.py`, `client_portal.py` |

---

### `proposals`
| Campo owner | `created_by` FK → users_profile |
|-------------|----------------------------------|
| Può essere NULL? | No |
| Reviewer | `proposal_signoffs.client_user_id` (chi firma lato cliente) |
| Account link | Nessuna colonna `account_id` (gap P0-C) |

---

## 1.2 `human_assignments` — Il Motore di Assegnazione Automatica

Il sistema ha un motore separato (`human_assignment.py`) per assegnare un "referente umano" a ogni subject:

| subject_type | Cosa rappresenta | Priority stack |
|-------------|-----------------|----------------|
| `client` | Profile cliente | tenant_admin → project_manager → designer/editor → super_admin |
| `lead` | Lead in pipeline | (stesso stack) |
| `project` | Progetto | (stesso stack) |
| `studio_onboarding` | Onboarding wizard | super_admin → tenant_admin → project_manager |

**Algoritmo**: round-robin basato su `COUNT(active assignments)` — l'utente con meno assegnazioni attive riceve la nuova. Deterministico.

**Problema**: `ensure_assignment_for_client()` viene chiamato da `provision_client_after_journey()` — ma solo se ci sono candidati attivi nel tenant. Con solo `admin@moodfordesign.com` (super_admin) e `ogrisekadvisor@gmail.com` (invited, non active), il motore usa il super_admin come fallback.

---

# SEZIONE 2 — RESPONSIBILITY MAP

## 2.1 Flusso Lead → Portal

```
LEAD
  owner:       nessuno (tenant-wide, scoping solo tenant_id)
  collaborator: —
  reviewer:     —
  fallback:     human_assignments subject_type=lead (automatico)
      ↓
ACCOUNT
  owner:       accounts.primary_owner_id (sempre NULL oggi)
  human ref:   human_assignments subject_type=client
  reviewer:     —
  fallback:     human_assignments round-robin → super_admin
      ↓
PROJECT
  owner:       projects.assigned_to (nullable)
  client link: projects.client_user_id (ora settato → P0-B fix)
  reviewer:     —
  fallback:     dal journey owner (join via project_id)
      ↓
DESIGN JOURNEY
  owner:       design_journey_assignments.assignment_role='owner' (1:1)
  contributor: design_journey_assignments.assignment_role='contributor' (0:N)
  observer:    design_journey_assignments.assignment_role='observer' (0:N, client_visible=false)
  reviewer:     —
  fallback:     nessuno (journey senza owner è unassigned)
      ↓
MILESTONE
  owner:       nessuno (ereditato dal journey owner by convention)
  collaborator: nessuno
  reviewer:     milestone_feedback.author_user_id (chi lascia feedback)
  fallback:     journey owner implicito
      ↓
MOODBOARD
  owner:       moodboards.created_by
  collaborator: nessuno (tabella assegnazione non esiste)
  reviewer:     concept_direction feedback via client_portal
  fallback:     created_by
      ↓
PROPOSAL
  owner:       proposals.created_by
  reviewer:    proposal_signoffs.client_user_id (firma cliente)
  fallback:    created_by
      ↓
PORTAL
  access:      projects.client_user_id → users_profile (FIX P0-B attivo)
  viewer:      il cliente (role=client)
  reviewer:    cliente (concept feedback, signoff, voice notes)
```

---

# SEZIONE 3 — DESIGN JOURNEY: RUOLI SUPPORTATI SENZA NUOVE TABELLE

## 3.1 Verifica del modello esistente

La tabella `design_journey_assignments` supporta già **N utenti per journey con ruolo esplicito**:

| Ruolo richiesto | Campo/tabella | Supportato? | Come |
|----------------|---------------|-------------|------|
| **A. Journey Owner** | `dja.assignment_role = 'owner'` | ✅ | 1 per journey, DB-enforced |
| **B. Milestone Owner** | `journey_milestones` — nessun campo | ❌ Non supportato | Nessuna colonna owner. Solo via `metadata` JSONB (non strutturato) |
| **C. Project Manager** | `dja.assignment_role = 'contributor'` + `users_profile.role = 'project_manager'` | ✅ | Aggiungere come contributor |
| **D. Designer** | `dja.assignment_role = 'contributor'` + `users_profile.role = 'designer'` | ✅ | Aggiungere come contributor |
| **E. Advisor** | `dja.assignment_role = 'contributor'` + `users_profile.role = 'advisor'` | ✅ | Aggiungere come contributor |
| **F. Material Specialist** | Non esiste un ruolo `material_specialist` in `users_profile` | ⚠️ Parziale | Usare `users_profile.role = 'designer'` + `role_label = 'Material Specialist'` |

### Conclusione §3.1

**5 su 6 ruoli sono già supportati senza nuove tabelle.**

L'unico gap è **Milestone Owner** (B) — non ha un campo dedicato nella tabella `journey_milestones`. Può essere simulato aggiungendo `metadata.assigned_to = user_id` nel JSONB di ogni milestone, ma non è strutturato né indicizzato.

---

## 3.2 Differenziazione Ruoli in `design_journey_assignments`

Il modello attuale (owner/contributor/observer) è **troppo piatto** per esprimere la semantica di PM vs Designer vs Advisor. Però non serve una nuova tabella: la combinazione `assignment_role + users_profile.role` risolve:

| Persona reale | `assignment_role` in dja | `role` in users_profile | `role_label` custom |
|---------------|-------------------------|------------------------|---------------------|
| Journey Owner (Designer lead) | `owner` | `designer` | "Designer Lead" |
| Project Manager | `contributor` | `project_manager` | "Project Manager" |
| Designer Junior | `contributor` | `designer` | "Designer" |
| Advisor | `contributor` | `advisor` | "Consulente" |
| Material Specialist | `contributor` | `designer` | "Specialista Materiali" |
| Osservatore interno | `observer` | qualsiasi | — |
| Cliente | nessuna riga dja | `client` | — (portal) |

---

# SEZIONE 4 — JOURNEY TYPE E OWNERSHIP DIFFERENZIATA

## 4.1 `projects.project_type` — Campo Già Esistente

Il campo `projects.project_type` è già presente nel DB e usato in:
- `client_portal.py` (letto e restituito)
- `concept_directions.py` (usato per products pool)
- `advisor_suggestions.py` (filtro consigli)
- `ai_studio_brief.py` (brief generazione)

Valori in uso nel codebase:
```
Residential · Retail · Hospitality · Contract · Kitchen · Outdoor
```

## 4.2 Ownership per Tipologia — Supporto Attuale

Il modello esistente **supporta già** l'ownership differenziata per tipologia senza nuove tabelle:

| Scenario | Come | Campo |
|----------|------|-------|
| Journey Residential → designer residenziale | Assegnare `contributor` con `role_label='Residential Designer'` | `dja + users_profile.role_label` |
| Journey Hospitality → PM hospitality | Assegnare `contributor` con `role_label='Hospitality PM'` | `dja + users_profile.role_label` |
| Journey Contract → material specialist | Assegnare `contributor` con `role_label='Material Specialist'` | `dja + users_profile.role_label` |
| Regola automatica "assegna X per Residential" | **NON supportata** — round-robin in `human_assignment.py` non considera `project_type` | Gap P2 |

**La differenziazione è manuale oggi** — non esiste routing automatico "Residential → designer A, Hospitality → designer B". Questa logica richiederebbe modificare `_candidates_for()` in `human_assignment.py` per filtrare per specializzazione, usando `users_profile.metadata_json.specializations` o un campo dedicato.

---

# SEZIONE 5 — TEAM SETTINGS: RUOLI E PERMESSI

## 5.1 Ruoli `users_profile.role`

| Ruolo | Label default | Priority stack (human_assignment) | Note |
|-------|--------------|----------------------------------|------|
| `super_admin` | "Direzione MOOD for DESIGN" | Fallback ultimo | `is_root_superadmin` separato |
| `tenant_admin` | "Direzione studio" | Primo nel round-robin | Può fare tutto nel tenant |
| `project_manager` | "Project Manager" | Secondo | Gestisce journey e team |
| `designer` | "Designer" | Terzo (con editor) | Owner journey |
| `editor` | "Editor" | Terzo (con designer) | Contenuto editoriale |
| `advisor` | "Studio" | Non nel round-robin client | Consulenza specialistica |
| `sales` | "Studio" | Non nel round-robin | Pipeline commerciale |
| `analyst` | "Studio" | Non nel round-robin | Report e analytics |
| `ad_partner` | "Studio" | Non nel round-robin | Partner affiliati |
| `client` | — | Non staff | Solo accesso portal |

## 5.2 Permission System

**Non esiste una tabella `permissions`** separata. Il sistema usa `require_roles(*roles)` in `auth.py`:

```python
def require_roles(*roles):
    def checker(user = Depends(get_current_user)):
        if user.get('role') not in roles:
            raise HTTPException(403, 'Insufficient permissions')
```

Le permission sono **hardcoded per endpoint** nel router, non in DB.

Esempio pattern:
```python
@router.post("/accounts/{aid}/journeys")
async def create_journey(user = Depends(require_roles("tenant_admin","project_manager","designer","super_admin"))):
```

**Non esiste RBAC granulare** — le permission sono binarie per ruolo a livello di endpoint.

## 5.3 Campi Profilo per Display Pubblico

`users_profile` ha già campi per personalizzazione pubblica:

| Campo | Tipo | Default | Usato in |
|-------|------|---------|---------|
| `role_label` | TEXT nullable | `_default_role_label(role)` | Portal welcome, human_assignment |
| `short_bio` | TEXT nullable | "" | Portal welcome |
| `response_time_label` | TEXT nullable | "Risponde in giornata" | Portal welcome |
| `contact_cta_label` | TEXT nullable | "Scrivi al tuo referente" | Portal welcome |
| `avatar_url` | TEXT nullable | NULL | Ovunque |

---

# SEZIONE 6 — GAP ANALYSIS

## Gap G1 — Milestone Owner non supportato

**Problema**: `journey_milestones` non ha nessun campo owner/assigned_to a livello di colonna.  
**Impatto**: non è possibile assegnare un designer specifico a un singolo milestone.  
**Soluzione senza nuove tabelle**: usare `journey_milestones.metadata_json.assigned_to = user_id` → leggibile dal backend, non strutturato.  
**Soluzione con colonna** (migration): aggiungere `owner_user_id UUID REFERENCES users_profile(id) NULL` a `journey_milestones`.

---

## Gap G2 — `accounts.primary_owner_id` mai valorizzato

**Problema**: il CRM non sa a quale designer appartiene un account.  
**Impatto**: `human_assignments` è usato come sostituto, ma è separato e non compare nel CRM account detail.  
**Soluzione senza nuove tabelle**: in `account_journeys.py` (Path C), settare `accounts.primary_owner_id = current_user.profile_id` al momento della creazione del journey.

---

## Gap G3 — `ensure_owner()` non chiamato da Path A e B

**Problema**: Begin Journey (A) e Lead Conversion (B) non chiamano `ensure_owner()` su `design_journey_assignments`.  
**Impatto**: Journey senza owner in `design_journey_assignments`. `list_user_journeys()` non trova questi journey per il designer.  
**Soluzione**: aggiungere chiamata a `ensure_owner(tenant_id, journey_id, user_id=admin_profile_id)` nei path A e B.

---

## Gap G4 — Routing automatico per tipologia assente

**Problema**: `human_assignment._candidates_for()` non considera `project_type`. Tutti i journey Residential, Hospitality, Contract, Kitchen ricevono lo stesso designer (round-robin generico).  
**Impatto**: nessuna specializzazione automatica del team per tipologia progetto.  
**Soluzione senza nuove tabelle**: aggiungere `users_profile.metadata_json.specializations: ["residential","hospitality"]` e usarlo come filtro in `_candidates_for()`.

---

## Gap G5 — `projects.assigned_to` vs `design_journey_assignments`

**Problema**: `projects.assigned_to` esiste come campo ma è separato da `design_journey_assignments.user_id (owner)`. Non sono sincronizzati.  
**Impatto**: CRM project detail e journey assignment list mostrano dati potenzialmente diversi.  
**Soluzione**: usare solo `design_journey_assignments` come source of truth per l'owner, e `projects.assigned_to` come cache di lettura veloce (aggiornarlo quando cambia il journey owner).

---

# SEZIONE 7 — PRIORITÀ P0/P1/P2

| # | Gap | Priorità | Effort | Note |
|---|-----|----------|--------|------|
| G3 | `ensure_owner()` non chiamato da Path A/B | 🔴 **P0** | 5 righe per path | Journey senza owner in dja → designer non trova i propri journey |
| G2 | `accounts.primary_owner_id` mai valorizzato | 🟠 **P1** | 3 righe in Path C | CRM non sa a chi appartiene l'account |
| G1 | Milestone owner assente | 🟠 **P1** | JSONB (senza migration): 2 righe · colonna dedicata: migration | Decide dopo: colonna o metadata |
| G4 | Routing automatico per project_type assente | 🟠 **P1** | `metadata_json.specializations` + filtro in _candidates_for() | Utile quando il team cresce |
| G5 | `projects.assigned_to` ≠ `dja.owner` | 🟡 **P2** | Trigger o sync manuale | Coerenza display CRM |

---

## Riepilogo: cosa abbiamo già senza nuove tabelle

| Feature | Supportato | Come |
|---------|-----------|------|
| Journey Owner (1:1) | ✅ | `design_journey_assignments.assignment_role='owner'` |
| Multiple contributors per journey | ✅ | `dja.assignment_role='contributor'` |
| Observer interno (non visibile al cliente) | ✅ | `dja.assignment_role='observer', client_visible=false` |
| Owner handoff con audit | ✅ | `change_owner()` + `design_journey_assignment_events` |
| Referente umano per account/lead (round-robin) | ✅ | `human_assignments` |
| Profilo pubblico del referente (foto, bio, CTA) | ✅ | `users_profile.role_label/short_bio/response_time_label` |
| Project Manager come ruolo | ✅ | `users_profile.role='project_manager'` + contributor dja |
| Advisor come ruolo | ✅ | `users_profile.role='advisor'` + contributor dja |
| Material Specialist | ⚠️ Parziale | `role='designer'` + `role_label='Material Specialist'` |
| Milestone Owner | ❌ | Nessuna colonna — serve migration o JSONB convention |
| Routing automatico per project_type | ❌ | Non implementato — richiede logica in `_candidates_for()` |
| RBAC granulare (permessi per azione) | ❌ | Solo role-level check per endpoint — nessuna tabella permissions |

---

*Audit completo — nessun codice modificato — TEAM OWNERSHIP & DESIGN JOURNEY RESPONSIBILITY AUDIT*
