# PARTNER DATA MODEL AUDIT
## MOOD for DESIGN™ — Analisi entità per Partner Network

> **Data:** Giugno 2026  
> **Vincoli:** Nessuna nuova tabella. Nessuna migrazione. Nessun workaround.  
> **Obiettivo:** Individuare quale entità esistente rappresenta meglio un professionista collaboratore.

---

## TABELLE ANALIZZATE

### 1. `contacts`

| Attributo | Valore |
|-----------|--------|
| **Esiste** | ✅ |
| **Schema** | `id, tenant_id, account_id (NOT NULL FK), first_name, last_name, email, phone, metadata_json, primary_contact, lifecycle_stage, created_at, updated_at` |
| **Source of Truth** | Persona fisica dentro un **Account cliente** |
| **Lifecycle** | `conversation_open` → stati derivati dal parent account |
| **Relazioni** | `account_id NOT NULL FK → accounts` (hard constraint non removibile senza migrazione) |
| **Utilizzo attuale** | Creato in `journey_initiate.py` quando un cliente completa `/begin-journey`. È il "primary contact" di un account privato cliente. |
| **Compatibilità Partner** | ❌ **INCOMPATIBILE** — richiede obbligatoriamente un `account_id` padre. Un partner non è un contact di un account cliente. Inserire un partner qui richiederebbe la creazione di un account-fantasma (workaround inaccettabile) e mescolerebbe persone di natura diversa nella stessa tabella con la stessa relazione FK. |

---

### 2. `users_profile`

| Attributo | Valore |
|-----------|--------|
| **Esiste** | ✅ |
| **Schema** | `id, auth_user_id, tenant_id, first_name, last_name, email, phone, avatar_url, role, status, metadata_json, last_login_at, invited_by, invited_at, accepted_at, suspended_at, short_bio, role_label, response_time_label, contact_cta_label, preferred_locale_code, is_root_superadmin` |
| **Source of Truth** | Identità autenticata di un **utente interno** alla piattaforma (designer, admin, client con login) |
| **Lifecycle** | `invited → accepted → active → suspended` (legato a Supabase Auth session) |
| **Relazioni** | Dipende da `auth_user_id` (FK → Supabase Auth). Richiede la creazione di un account Supabase Auth per ogni record. |
| **Utilizzo attuale** | Profili di tutti gli utenti che si autenticano alla piattaforma. I designer, admins, e clienti con accesso al portale sono qui. |
| **Compatibilità Partner** | ⚠️ **PARZIALE — solo per partner approvati con accesso piattaforma.** Non può essere usato come entità di candidatura (il partner non ha ancora un account Auth). Appropriato solo come stadio finale del ciclo di vita quando un partner viene promosso a collaboratore con login (es. ruolo `role = 'partner'`). Creare un `users_profile` prima dell'approvazione richiederebbe un invite Auth prematuro. |

---

### 3. `advisors` / `designers` / `team_members`

| Attributo | Valore |
|-----------|--------|
| **Esiste** | ❌ Nessuna di queste tabelle esiste nel DB corrente |
| **Compatibilità Partner** | ❌ Non applicabile |

---

### 4. `accounts`

| Attributo | Valore |
|-----------|--------|
| **Esiste** | ✅ |
| **Schema** | `id, tenant_id, account_name (NOT NULL), account_type, lifecycle_stage, source, country, city, address, website, phone, email, language, locale_code, primary_owner_id, relationship_score, relationship_health, notes, metadata_json, legacy_lead_id, market_id, cultural_profile, hospitality_positioning, editorial_register_affinity, design_intent_summary, luxury_perception_axis, relationship_journey_stage, mood_dominant, signal_snapshot` (35 colonne) |
| **Source of Truth** | **Account cliente B2C** (azienda o privato che acquista servizi dello studio) |
| **Lifecycle** | `new_inquiry → prospect → in_proposal → customer` — lifecycle rigido e bloccato da `account_lifecycle.py` con state machine esplicita |
| **Relazioni** | `contacts` sono i contatti del account. `design_journeys` richiedono un `account_id`. |
| **Utilizzo attuale** | Creato in `journey_initiate.py` quando un cliente completa `/begin-journey`. È la radice del customer CRM. |
| **Compatibilità Partner** | ❌ **INCOMPATIBILE SEMANTICAMENTE.** L'`account_type` è 'private_client' e la state machine (`account_lifecycle.py`) è strutturata per il ciclo `prospect → customer`. Un partner non è un "prospect" né un "customer". Aggiungere `account_type = 'partner'` richiederebbe bypass della state machine o modifiche strutturali. Il `lifecycle_stage` 'applied' | 'review' | 'approved' non ha senso nel contesto degli `accounts`. Le colonne `luxury_perception_axis`, `editorial_register_affinity`, `mood_dominant` sono irrilevanti per un partner. Inserire un partner qui inquinerebbe il CRM clienti. |

---

### 5. `leads`

| Attributo | Valore |
|-----------|--------|
| **Esiste** | ✅ |
| **Schema** | `id, tenant_id, client_user_id, source, lead_type, status, score, first_name, last_name, email, phone, country, city, language, project_type, notes, metadata_json, professional_category, collaboration_intent, market_sector, company_name, company_website, portfolio_url, progression_state, pipeline_stage, runtime_identity, behavioral_tags, ai_tags, narrative_seed, relationship_temperature, designer_assigned, first_journey_id` (35+ colonne) |
| **Source of Truth** | **Entità di intake** — qualsiasi entità esterna che manifesta interesse verso lo studio, prima di essere qualificata come cliente, account o partner. |
| **Lifecycle** | `new → [qualified/review/approved/active/archived]` — campo `status` TEXT libero, nessuna state machine bloccante |
| **Relazioni** | Standalone. Nessun FK obbligatorio. Può essere collegato a `accounts` via `legacy_lead_id` ma solo opzionalmente. |
| **Utilizzo attuale** | Creato dal form `/begin-journey` con `lead_type = 'private_client'`. Il campo `lead_type` supporta già `'professional'` nel codice del router (linea 538: `'partnership_request' if lead_type == 'professional'`). |
| **Compatibilità Partner** | ✅ **COMPATIBILE AL 100%** — vedi tabella di copertura campi sotto. |

#### Copertura campi form partner → `leads`

| Campo Form Partner | Campo `leads` | Copertura |
|-------------------|--------------|-----------|
| Nome | `first_name` | ✅ nativo |
| Cognome | `last_name` | ✅ nativo |
| Studio / Azienda | `company_name` | ✅ nativo |
| Email | `email` | ✅ nativo |
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

## MATRICE DI CONFRONTO

| Entità | Standalone | Nessun FK obbligatorio | Campi partner | Lifecycle libero | Separabile da CRM clienti |
|--------|-----------|----------------------|--------------|-----------------|--------------------------|
| `contacts` | ❌ | ❌ (account_id NOT NULL) | Parziale | ❌ | ❌ |
| `users_profile` | ❌ | ❌ (auth_user_id richiesto) | Parziale | ❌ | ✅ (per role) |
| `accounts` | ✅ | ✅ | Parziale | ❌ (state machine rigida) | ❌ |
| `leads` | ✅ | ✅ | **Completi** | ✅ | ✅ (filtro lead_type) |

---

## RACCOMANDAZIONE FINALE

### ► Entità: `leads` con `lead_type = 'partner_application'`

**Motivazione tecnica:**
- Unica entità standalone senza FK obbligatori
- 100% copertura campi senza modifiche schema
- Campo `lead_type` già progettato per discriminare entità eterogenee
- Ciclo di vita (`status`) libero da state machine rigide
- Separabile dal CRM clienti tramite filtro `lead_type = 'partner_application'`
- Il router `/api/storefront/public/{tenant}/begin` già include la whitelist di tutti i campi necessari

**Ciclo di vita partner:**
```
leads.lead_type = 'partner_application'
leads.status:
  'applied'  → candidatura ricevuta (al submit del form)
  'review'   → in valutazione (azione Blueprint)
  'approved' → approvato (azione Blueprint)
  'active'   → collaborazione attiva (azione Blueprint)
  'archived' → archiviato
```

**Separazione dal CRM clienti:**
```
CUSTOMER FLOW → leads.lead_type IN ('private_client', 'ad_partner')
                → promoted to: accounts → contacts → design_journeys
PARTNER FLOW  → leads.lead_type = 'partner_application'
                → stays in leads, appears ONLY in Blueprint → Partner Network
                → never promoted to accounts/contacts
```

**Promozione a `users_profile` (solo se necessario):**
Quando un partner approvato necessita di accesso alla piattaforma (futuro):
```
leads (approved) → invite → users_profile.role = 'partner'
                → users_profile.metadata_json.partner_lead_id = leads.id
```
Un `users_profile` creato solo on-demand, non come prerequisito.

---

## MODIFICHE RICHIESTE

| Tipo | Modifica | Impatto |
|------|---------|---------|
| Nessuna migrazione | `lead_type = 'partner_application'` è un nuovo valore TEXT | ✅ Zero |
| Nessuna migrazione | `status = 'applied'|'review'|'approved'|'active'|'archived'` sono nuovi valori TEXT | ✅ Zero |
| Nessuna nuova tabella | Tutto in `leads` esistente | ✅ Zero |
| Backend | Nuova route `POST /partner-apply` che forza `lead_type='partner_application'` | Minimo |
| Blueprint | Nuova vista filtrata `leads?lead_type=partner_application` | Solo frontend |

---

*Audit prodotto da analisi statica router + introspezione schema DB live*  
*Tabelle analizzate: contacts, users_profile, advisors, designers, team_members, leads, accounts*
