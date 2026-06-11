# IDENTITY & CLIENT PROVISIONING AUDIT — DOCUMENTO A: IDENTITY MAP
> Prodotto: 11 Jun 2026 · Audit statico + dati reali DB

---

## 1. Modello Identità Completo

Il sistema MOOD gestisce l'identità attraverso **6 strati sovrapposti**, ognuno con un ciclo di vita indipendente:

```
┌─────────────────────────────────────────────────────────────┐
│  STRATO 1: auth.users (Supabase Auth)                       │
│  → identità crittografica, JWT, sessioni                    │
├─────────────────────────────────────────────────────────────┤
│  STRATO 2: users_profile (DB applicativo)                   │
│  → identità operativa, ruolo, tenant, first/last name       │
├─────────────────────────────────────────────────────────────┤
│  STRATO 3: contacts (anagrafica fisica)                     │
│  → nome, telefono, email fisica — account_id FK             │
├─────────────────────────────────────────────────────────────┤
│  STRATO 4: accounts (cliente CRM)                           │
│  → entità commerciale, pipeline stage, email commerciale    │
├─────────────────────────────────────────────────────────────┤
│  STRATO 5: leads (prospect pre-account)                     │
│  → prima cattura, email raw, pipeline entry                 │
├─────────────────────────────────────────────────────────────┤
│  STRATO 6: projects.client_user_id (access portal)         │
│  → puntatore al profilo per l'accesso al portal             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Dettaglio per Entità

### STRATO 1 — `auth.users` (Supabase Auth)

| Attributo | Valore |
|-----------|--------|
| Chi crea | `auth.signup` → `client.auth.admin.create_user()` (backend, mai dal client diretto) |
| Quando | 4 entry point: (1) `/api/auth/signup`, (2) `/api/members/invite`, (3) `provision_client_after_journey()`, (4) `/api/onboarding/*/submit` |
| Chi aggiorna | Supabase Admin API via backend (password grant, magic link, recovery) |
| Chi legge | JWT decoder in `middleware/auth.py` → sub claim = `auth_user_id` |
| Relazione email | Email è PK logica in Supabase Auth. **Non modificabile** post-creazione senza Admin API |
| email_confirm | **Sempre `True`** — confermata automaticamente su tutti i path (MVP bypass) |
| Stato attuale | **2 auth.users** rimanenti: admin + ogrisekadvisor |

**Campi chiave restituiti nel JWT:**
- `sub` → `auth_user_id` (UUID)
- `email` → email dell'utente
- `role` → `authenticated` (fisso Supabase, non il ruolo applicativo)
- `aud` → `authenticated`

---

### STRATO 2 — `users_profile` (DB applicativo)

| Attributo | Valore |
|-----------|--------|
| Chi crea | Backend in 4 contesti: signup, invite, client provisioning, onboarding wizard |
| Quando | Subito dopo `auth.users`, in sequenza atomica (con rollback dell'auth user se fallisce) |
| Chi aggiorna | `auth.py → _accept_invite_if_pending()`, `auth.py → /login` (last_login_at), `profile.py → PATCH`, `members.py → PATCH` |
| Chi legge | `middleware/auth.py → get_current_user()` — ogni request autenticata |
| Relazione email | `email` campo separato da `auth.users.email`. **Non sincronizzato automaticamente** → rischio divergenza |
| Ruoli applicativi | `super_admin`, `tenant_admin`, `designer`, `project_manager`, `client`, `editor`, `advisor`, `sales`, `ad_partner`, `analyst` |
| Campi presenti | `id`, `auth_user_id`, `tenant_id`, `email`, `first_name`, `last_name`, `role`, `status`, `avatar_url`, `phone` (nullable), `locale` (nullable), `preferred_locale_code`, `is_root_superadmin`, `metadata_json`, `last_login_at`, `invited_at`, `accepted_at`, `suspended_at` |
| Campi mancanti | `timezone` (non presente), `language` (solo `preferred_locale_code`) |

---

### STRATO 3 — `contacts`

| Attributo | Valore |
|-----------|--------|
| Chi crea | `journey_initiate.py` (path A, come parte del journey pubblico) |
| Quando | Contemporaneamente alla creazione di `accounts` nel flow Begin Journey |
| Chi aggiorna | `client_relations.py` (patch contatto) |
| Chi legge | `client_relations.py`, `account_lifecycle.py`, `client_portal.py` |
| Relazione email | `contacts.email` copiata dall'input del form — **non collegata** a `auth.users` né a `users_profile` |
| Nota | `contacts` è l'anagrafica "fisica" della persona. `accounts` è l'entità "commerciale". Stesso soggetto, rappresentato due volte |

---

### STRATO 4 — `accounts`

| Attributo | Valore |
|-----------|--------|
| Chi crea | 3 path: (A) `journey_initiate.py`, (B) `lead_conversion.py`, (C) `account_journeys.py` via upsert |
| Quando | Path A: atomico nel begin journey pubblico · Path B: al momento della conversione lead → cliente · Path C: al momento della creazione manuale da CRM |
| Chi aggiorna | `client_relations.py` (lifecycle stage), `account_lifecycle.py` (signed_proposal_id), `lead_conversion.py` (legacy_lead_id) |
| Chi legge | `client_portal.py` (welcome-summary via email), `client_relations.py`, `auth_client.py` (resend) |
| Relazione email | `accounts.email` = email commerciale del cliente. Usata come chiave di ricerca nel portal welcome-summary. **Non FK** verso `users_profile` né `auth.users` |
| Nota critica | `accounts.email` è il fallback di risoluzione identity nel portal — ma può divergere da `users_profile.email` se creati separatamente |

---

### STRATO 5 — `leads`

| Attributo | Valore |
|-----------|--------|
| Chi crea | `leads.py → fast-capture`, `journey_initiate.py` (NON-blocking, retroattivo), `lead_intake.py` |
| Quando | Lead capture manuale o retroattiva post-journey |
| Chi aggiorna | `lead_conversion.py` (status, pipeline_stage, first_journey_id) |
| Chi legge | `client_relations.py`, `lead_conversion.py` |
| Relazione email | `leads.email` = email catturata al momento del primo contatto. Terza copia dell'email |

---

### STRATO 6 — `projects.client_user_id`

| Attributo | Valore |
|-----------|--------|
| Chi crea/setta | **Solo `client_provisioning.py`** — MA NON LO FA (bug P0-B documentato) |
| Quando dovrebbe essere settato | Subito dopo la creazione di `users_profile` con `role=client` |
| Chi legge | `client_portal.py` — tutti gli endpoint che richiedono accesso al portal |
| Relazione email | Indiretta: `users_profile.email → accounts.email → design_journeys.account_id → projects.id → client_user_id` |
| Stato attuale | **Sempre NULL** per tutti i journey (bug P0-B) |

---

## 3. Grafo di Relazione Identità

```
auth.users.id ──────────────────────► users_profile.auth_user_id
                                              │
                                     ┌────────┴────────┐
                                     │                 │
                                  email            tenant_id
                                     │
               ┌─────────────────────┤
               │                     │
        accounts.email          leads.email
         (terza copia)          (seconda copia)
               │
               ↓
        accounts.id
               │
               ↓ account_id
        design_journeys
               │
               ↓ project_id
           projects
               │ client_user_id (NON SETTATO — P0-B)
               ↓
        users_profile.id
        (NON RAGGIUNTO)
```

**Il grafo è spezzato** a livello `projects.client_user_id`: il collegamento che chiude il cerchio tra client profile e portal access non esiste.

---

*Audit A — IDENTITY & CLIENT PROVISIONING AUDIT*
