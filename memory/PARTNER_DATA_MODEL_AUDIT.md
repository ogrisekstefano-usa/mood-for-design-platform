# PARTNER DATA MODEL AUDIT
## MOOD for DESIGN™ — Analisi architetturale completa

> **Data:** Giugno 2026  
> **Metodo:** Analisi statica di router, service layer, core permissions, schema DB  
> **Vincolo assoluto:** Nessuna nuova tabella · Nessuna migrazione · Nessun workaround  
> **Obiettivo:** Trovare la Source of Truth per l'entità Partner nel modello dati esistente

---

## PARTE 1 — MAPPA DI TUTTE LE ENTITÀ RILEVANTI

---

### 1. `auth.users` *(Supabase Auth — non modificabile)*

| Attributo | Valore |
|---|---|
| **Scopo reale** | Identità di autenticazione. Solo email + password hash + JWT. |
| **Chi la crea** | Supabase Auth (signup form) o Admin API (invite) |
| **Chi la aggiorna** | Supabase Auth service (refresh token, email confirm) |
| **Chi la legge** | Backend via `SUPABASE_SERVICE_ROLE_KEY` |
| **Lifecycle** | `unconfirmed → confirmed → active → deleted` |
| **Relazioni** | 1:1 con `users_profile.auth_user_id` |
| **Cosa NON è** | Non è il profilo business. Non ha ruoli RBAC. Non ha tenant. |
| **Compatibilità Partner** | ❌ Non direttamente rilevante. È solo il gate di autenticazione. Un partner candidato NON deve avere un account Auth. Viene creato solo al momento dell'invite (post-approvazione). |

---

### 2. `users_profile`

| Attributo | Valore |
|---|---|
| **Scopo reale** | Identità operativa di un utente autenticato dentro un tenant. Contiene ruolo RBAC, profilo display, stato. |
| **Chi la crea** | `routers/auth.py` (signup) · `routers/members.py` (invite) |
| **Chi la aggiorna** | L'utente stesso (avatar, bio) · Admin (role, status) |
| **Chi la legge** | Quasi tutto il backend (tenant_context, permissions, dashboard) |
| **Lifecycle** | `invited → accepted → active → suspended` |
| **Schema chiave** | `id, auth_user_id, tenant_id, email, first_name, last_name, role, status, metadata_json` |
| **Ruoli rilevanti per Partner** | `'ad_partner'` (READ-ONLY: projects, moodboards, inspirations) · `'advisor'` (READ-ONLY: leads, projects, proposals) |
| **Compatibilità Partner** | ⚠️ **Solo per partner POST-APPROVAZIONE** con accesso piattaforma. Richiede un `auth.user` → NON adatto per la fase di candidatura (il partner non ha ancora un account). Diventa la SSoT identity solo quando il partner viene invitato a collaborare attivamente. |

**Ruolo `ad_partner` in `permissions.py`:**
```python
"ad_partner": {P_PROJECTS_READ, P_MOODBOARDS_READ, P_INSPIRATIONS_READ}
```
*Esiste già. Zero modifiche necessarie.*

---

### 3. `tenant_memberships`

| Attributo | Valore |
|---|---|
| **Scopo reale** | Tabella di join per future multi-tenancy. Ogni `users_profile` ha una riga qui. |
| **Chi la crea** | `routers/members.py` (invite) in parallelo con `users_profile` |
| **Lifecycle** | `invited → active → suspended` (mirror di `users_profile.status`) |
| **Compatibilità Partner** | ✅ Viene creato automaticamente al momento dell'invite. Zero modifiche. |

---

### 4. `contacts`

| Attributo | Valore |
|---|---|
| **Scopo reale** | Persona fisica dentro un Account cliente. Il primary_contact di un `accounts` row. |
| **Chi la crea** | `journey_initiate.py` quando un cliente completa `/begin-journey` |
| **Vincolo critico** | `account_id NOT NULL FK → accounts` (hard constraint DB) |
| **Ciclo vita** | Derivato dal parent account. Non ha lifecycle autonomo. |
| **Compatibilità Partner** | ❌ **INCOMPATIBILE.** L'FK obbligatoria `account_id NOT NULL` rende impossibile inserire un partner standalone. Richiederebbe la creazione di un "account fantasma" — workaround inaccettabile che mescola clienti e partner nella stessa gerarchia. |

---

### 5. `accounts`

| Attributo | Valore |
|---|---|
| **Scopo reale** | L'entità centrale del CRM clienti. Rappresenta un cliente (privato o azienda) che acquista servizi dello studio. |
| **Chi la crea** | `journey_initiate.py` (dal form `/begin-journey`) |
| **Chi la aggiorna** | Designer via CRM UI · `account_lifecycle.py` (state machine) |
| **Lifecycle** | `new_inquiry → prospect → in_proposal → customer` (state machine rigida in `account_lifecycle.py`) |
| **Schema chiave** | `account_name NOT NULL, account_type, lifecycle_stage, luxury_perception_axis, editorial_register_affinity, mood_dominant, cultural_profile` |
| **Compatibilità Partner** | ❌ **INCOMPATIBILE SEMANTICAMENTE.** La state machine è orientata al cliente. Colonne come `luxury_perception_axis`, `mood_dominant`, `editorial_register_affinity` sono irrilevanti per un partner. L'inserimento di `account_type = 'partner'` richiederebbe bypass della state machine, inquinerebbe i KPI del CRM clienti, e confonde due persona fondamentalmente diverse. |

---

### 6. `leads` ← **ENTITÀ CHIAVE**

| Attributo | Valore |
|---|---|
| **Scopo reale** | Entità di intake universale. Chiunque manifesti interesse verso lo studio prima di essere qualificato. Progettata per essere eterogenea via `lead_type`. |
| **Chi la crea** | `routers/storefront.py` (form pubblici `/begin-journey`, `/partner-application`) · `workspace_genesis.py` (intake interno) |
| **Chi la aggiorna** | Designer via CRM UI · Backend su progression |
| **Chi la legge** | `client_relations.py` · `relationship_engine.py` · Blueprint UI |
| **Lifecycle** | `status` TEXT libero — NESSUNA state machine bloccante |
| **Standalone** | ✅ Nessun FK obbligatorio |
| **Campo discriminante** | `lead_type TEXT` — già usato per `'private_client'`, `'ad_partner'`, `'professional'` |
| **Campi esistenti rilevanti per partner** | `first_name, last_name, email, phone, company_name, company_website, portfolio_url, professional_category, collaboration_intent, market_sector, country, city, notes, metadata_json (JSONB)` |

#### Copertura campi form `/partner-application` → `leads`

| Campo Form | Campo `leads` | Status |
|---|---|---|
| Nome | `first_name` | ✅ nativo |
| Cognome | `last_name` | ✅ nativo |
| Studio / Azienda | `company_name` | ✅ nativo |
| Email professionale | `email` | ✅ nativo |
| Telefono | `phone` | ✅ nativo |
| Ruolo professionale | `professional_category` | ✅ nativo |
| Sito Web | `company_website` | ✅ nativo |
| Portfolio / Instagram | `portfolio_url` + `metadata_json.instagram` | ✅ nativo + JSONB |
| LinkedIn | `metadata_json.linkedin` | ✅ JSONB |
| Area geografica | `city` + `country` | ✅ nativo |
| Tipologia collaborazione | `collaboration_intent` | ✅ nativo |
| Settore | `market_sector` | ✅ nativo |
| Checkbox interessi | `metadata_json.interests[]` | ✅ JSONB |
| Testo libero | `notes` | ✅ nativo |

**Copertura: 100% senza nessuna modifica allo schema.**

---

### 7. `design_journey_assignments`

| Attributo | Valore |
|---|---|
| **Scopo reale** | Chi lavora su un Design Journey specifico e con quale ruolo. |
| **Chi la crea** | `journey_initiate.py` (owner auto) · `journeys.py` (assegnazioni manuali) |
| **Chi la aggiorna** | Admin tramite `core/journey_assignments.py` (change_owner, add_assignment, revoke) |
| **Chi la legge** | `design_journey.py` · `journeys.py` · Client Portal |
| **Lifecycle** | `assigned_at → revoked_at` (soft-delete) |
| **Ruoli** | `'owner'` (1 per journey, unico) · `'contributor'` · `'observer'` |
| **Vincolo** | `user_id FK → users_profile.id` — richiede un account autenticato |
| **Compatibilità Partner** | ✅ **PERFETTA per Caso C e D** — un partner approvato con `users_profile` ottiene una riga `assignment_role = 'contributor'`. Il ruolo `ad_partner` in `users_profile` gli dà visibilità controllata (READ-ONLY su projects, moodboards). |

---

### 8. `human_assignments`

| Attributo | Valore |
|---|---|
| **Scopo reale** | Assegna UN referente interno (designer/PM) a un subject (client, lead, account). |
| **Subject types** | `'client'`, `'studio_onboarding'`, altri soggetti |
| **Chi la crea** | `core/human_assignment.py` (round-robin automatico) |
| **Compatibilità Partner** | ❌ Non rilevante per partner. È il referente interno che gestisce una relazione, non il partner stesso. |

---

### 9. `design_journey_assignment_events` / `human_assignment_events`

Audit log per i sistemi sopra. Non direttamente rilevanti per la decisione.

---

### 10. `advisor_profiles` (router: `advisor_network.py`)

| Attributo | Valore |
|---|---|
| **Scopo reale** | Rete commerciale di advisor (rivenditori/referral commerciali) con commissioni. |
| **Lifecycle** | Legato a referral codes, subscription status, commission tracking |
| **Compatibilità Partner** | ❌ Totalmente diverso. Gli advisor sono entità commerciali che guadagnano commissioni sulle vendite. Un architetto partner è un collaboratore di progetto. Entità semanticamente incompatibili. |

---

## PARTE 2 — I 4 CASI D'USO

---

### CASO A — Architetto compila `/partner-application` e vuole solo collaborare

**Descrizione:** Visitatore anonimo. Compila il form. Nessun account esistente.

**Flusso dati:**
```
1. Submit form → POST /api/storefront/public/{tenant}/begin
2. Backend: leads.insert({ lead_type='partner_application', status='applied', ... })
3. Nessuna auth.user · Nessun users_profile
4. Studio riceve notifica (futuro: via email Blueprint)
5. Lead rimane in leads con status='applied'
```

**Entità coinvolte:** `leads` (unica)  
**Separazione da CRM clienti:** `leads.lead_type = 'partner_application'` (filtro netto)

---

### CASO B — Architetto porta un progetto

**Descrizione:** Un architetto fa da referente per un cliente che ha un progetto. L'architetto è sia un partner che una fonte di lead.

**Flusso dati:**
```
1. Architetto come partner → leads (lead_type='partner_application')
2. Cliente referito dall'architetto → leads (lead_type='private_client')
3. Collegamento: leads.metadata_json.referred_by_partner_lead_id = architetto.id
4. Il progetto segue il normale flusso Cliente → Account → Design Journey
5. L'architetto può essere invitato come contributor al DJ (vedi Caso C)
```

**Entità coinvolte:** `leads` (per l'architetto) + `leads` (per il cliente) → `accounts` + `design_journeys` (per il progetto)  
**Zero duplicazioni:** Architetto e Cliente sono due `leads` distinte.

---

### CASO C — Architetto invitato in un Design Journey

**Prerequisito:** L'architetto deve avere un account piattaforma.

**Flusso dati:**
```
1. Se l'architetto era già in leads → promuovere a users_profile via invite
2. POST /api/members/invite { role: 'ad_partner', ... }
3. Supabase crea auth.user + email magic link
4. Backend crea users_profile.role = 'ad_partner'
5. Studio assegna l'architetto al DJ: design_journey_assignments.role = 'contributor'
6. users_profile.metadata_json.partner_lead_id = leads.id (link alla candidatura originale)
```

**Entità coinvolte:** `leads` (storico) → `users_profile` (identity) → `design_journey_assignments` (partecipazione)  
**Una sola identità:** Un auth.user → un users_profile per tenant → N assignment rows su N journey

---

### CASO D — Professionista diventa membro stabile del team

**Descrizione:** L'architetto collabora così frequentemente da essere trattato come team member interno.

**Flusso dati:**
```
1. Inizia in leads (partner_application)
2. Passa a users_profile.role = 'ad_partner' (accesso limitato)
3. Upgrade del ruolo: PATCH /api/members/{id} { role: 'designer' | 'project_manager' }
4. Ora visibile in /team con ruolo operativo pieno
5. design_journey_assignments gestisce i suoi journey attivi
6. Il link a leads è preservato in metadata_json.partner_lead_id
```

**Entità coinvolte:** Tutto il normale team member flow — nessuna entità nuova.

---

## PARTE 3 — MATRICE CONFRONTO FINALE

| Entità | Standalone | No FK obbligatori | Campi partner 100% | Lifecycle libero | Separazione CRM | Relazione DJ |
|---|---|---|---|---|---|---|
| `contacts` | ❌ | ❌ | Parziale | ❌ | ❌ | ❌ |
| `users_profile` | ❌ (richiede Auth) | ❌ (richiede auth_user_id) | Parziale | ❌ | ✅ via role | ✅ via assignments |
| `accounts` | ✅ | ✅ | Parziale | ❌ state machine | ❌ | ✅ via FK |
| `leads` | ✅ | ✅ | **100%** | ✅ | ✅ via lead_type | Via metadata_json |
| `advisor_profiles` | Diverso | Diverso | No | Diverso | ✅ | ❌ |

**Vincitore: `leads` (fase candidatura/pre-approvazione) + `users_profile.role = 'ad_partner'` (fase post-approvazione)**

---

## PARTE 4 — MODIFICHE NECESSARIE ALLO SCHEMA

| Tipo | Modifica | Schema change | Impatto |
|---|---|---|---|
| Nessuna | `lead_type = 'partner_application'` è un nuovo valore TEXT nel campo esistente | ✅ ZERO | Nessuna migrazione |
| Nessuna | `status = 'applied' \| 'review' \| 'approved' \| 'active' \| 'archived'` sono valori TEXT | ✅ ZERO | Nessuna migrazione |
| Nessuna | `users_profile.role = 'ad_partner'` è già in `TENANT_ASSIGNABLE_ROLES` e `ROLE_PERMISSIONS` | ✅ ZERO | Esiste già |
| Nessuna | `design_journey_assignments.assignment_role = 'contributor'` è già nel sistema | ✅ ZERO | Esiste già |
| Minima | Backend: nuova route `POST /api/partner/apply` che forza `lead_type='partner_application'` | Backend only | Nuovo endpoint |
| Minima | Blueprint: nuova vista `leads?lead_type=partner_application` | Frontend only | Filtro view |

**TOTALE MODIFICHE SCHEMA: ZERO.**

---

*Audit prodotto da analisi statica: routers/, core/, permissions.py, schema implicito dai router*  
*Versione: 2.0 — Giugno 2026 — PARTNER AUTH FIX SPRINT*
