# COMMAND CENTER CRM™ — M1 EXECUTION PLAN
> Trasformare il Command Center in CRM relazionale operativo.
> **M0 resta prerequisito implementativo.** M1 può essere progettato in
> parallelo, ma non eseguito prima della migration 031.
> NESSUNA IMPLEMENTAZIONE in questo documento.

**Classificazione finale**: 🟢 **`READY_FOR_M1_IMPLEMENTATION`**

Schema, UX, API, permessi, acceptance criteria ed effort sono
specificati al livello necessario per partire allo "Vai" dell'utente.
Le 2 sole estensioni di schema rispetto al piano v2 (`relationship_owner`
sui contatti, `quick action` minimal-write su `relationship_activities`)
sono integrabili nella migration 031 con +0.5g.

---

## 0 · PRINCIPI ARCHITETTURALI (RATIFICATI)

1. **Vive dentro il Command Center**. Niente app separata, niente
   secondo pannello, nessuna sezione isolata. Una sola route radice
   `/command-center/tenants/:tid`.
2. **Tenant detail come hub canonico**. Da lì si vede tutto: Overview,
   Contatti, Attività (preview), Timeline (placeholder M2),
   Notifiche (placeholder M4).
3. **Multi-contatto = `tenant_contacts`** (D1 approvato).
4. **Founder isolation = D4**: founder vede SOLO il proprio tenant
   detail, scope-locked su ogni endpoint `/api/blueprint/*`.
5. **Tassonomie DB-driven**: ruoli, lingue, mercati, attività types,
   owner — tutto via catalog o FK.
6. **Scale target = 150 tenant × 500+ contatti**. Indici partial,
   paginazione cursor-based, anti-N+1 obbligatorio.

---

## 1 · UX — TENANT DETAIL LAYOUT

### 1.1 Surface
**Admin**: `/command-center/tenants/:tid`
**Founder**: `/blueprint/overview` (stesso shape, scope-locked)

### 1.2 Header (sempre visibile)
```
┌────────────────────────────────────────────────────────────────────┐
│ MARTINEL INTERIOR DESIGN                  Status: ACTIVATED        │
│ Interior Studio · Pordenone, IT                                    │
│                                                                    │
│ Founder:  Mario Rossi                Advisor:  R. Visentin         │
│ Markets:  Italia → US · UK · AE     Created:  6/2/2026             │
│ Last activity: 2 ore fa                                            │
└────────────────────────────────────────────────────────────────────┘
   [ Overview ] [ Contatti (4) ] [ Attività (12) ] [ Timeline ]  [ 🔔 ]
```

### 1.3 Tabs
| Tab | Stato M1 | Contenuto |
|---|---|---|
| **Overview** | ✅ M1 | Studio summary, Advisor, KPI box, ultime 3 attività, primary contact |
| **Contatti** | ✅ M1 | Tabella contatti + filtri + search + form modal |
| **Attività** | ⚠ M1 preview | Lista ultime 10, Quick Actions bar, no edit avanzato (M3) |
| **Timeline** | 🚧 M2 placeholder | "Disponibile in M2" + 1 CTA "Vedi log email" → `studio_email_dispatch_log` |
| **🔔 Notifiche** | 🚧 M4 placeholder | "Disponibile in M4" |

### 1.4 Sidebar Command Center
Nuova voce sopra "Studio Requests":
```
TENANTS
└── Lista tenant + search globale + filtri
    └── click → /command-center/tenants/:tid (Tenant Detail)
```

Lista tenant (`/command-center/tenants`):
- Colonne: Studio · Founder · Advisor · Status · Markets · Last Activity · Contacts count
- Filtri: advisor (catalog), market (catalog), status (enum), role (intersect con contatti)
- Search globale: vedi §5

### 1.5 Founder-side surfaces
- `/blueprint/overview` mostra **solo le tab abilitate al founder**:
  - ✅ Overview (read-only sul proprio tenant)
  - ✅ Contatti (CRUD su `tenant_contacts` del proprio tenant — D4)
  - ✅ Attività (preview + Quick Actions — solo proprie + visibili)
  - 🚧 Timeline placeholder
  - 🚧 Notifiche placeholder
- Header SENZA `Advisor: R. Visentin` (founder non gestisce advisor)

---

## 2 · SCHEMA FINALE (DELTA RISPETTO ALLA MIGRATION 031)

> M0 (migration 031) deve **incorporare** queste due aggiunte rispetto
> a quanto specificato nel `RELATIONSHIP_OS_FOUNDATION_PLAN.md` v2:

### 2.1 `tenant_contacts` — campi relationship owner + provenance + readiness (OBBLIGATORI in M1)

```sql
-- Aggiunte alla CREATE TABLE tenant_contacts (parte di 031):
  -- Relationship owner (chi segue commercialmente questo contatto)
  relationship_owner_user_id  UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  owner_assigned_at           TIMESTAMPTZ,
  owner_assigned_by           UUID NULL REFERENCES users(id) ON DELETE SET NULL,

  -- Contact Provenance (origine del contatto, catalog-driven)
  source_code                 TEXT NULL REFERENCES platform_contact_sources(code),
  source_reference            TEXT,    -- es. studio_request UUID, advisor email, import batch id

  -- Relationship Readiness (data signals, no logica applicativa in M1)
  relationship_score          INTEGER NOT NULL DEFAULT 0,
  last_touch_at               TIMESTAMPTZ,
```

E indici:
```sql
CREATE INDEX idx_tenant_contacts_owner
  ON tenant_contacts(relationship_owner_user_id, status)
  WHERE relationship_owner_user_id IS NOT NULL;
CREATE INDEX idx_tenant_contacts_score
  ON tenant_contacts(tenant_id, relationship_score DESC)
  WHERE status = 'active';
CREATE INDEX idx_tenant_contacts_source
  ON tenant_contacts(source_code) WHERE source_code IS NOT NULL;
```

**Regola business (relationship owner)**:
- `relationship_owner_user_id` può essere un MOOD user con
  role ∈ {admin, editor, advisor}.
- All'attivazione tenant, il `relationship_owner_user_id` di default
  del **primary contact** = `studio_relations.owner_advisor_id` se
  presente, altrimenti NULL.
- Founder PUÒ vedere chi è l'owner ma NON può cambiarlo (D4).
- Admin/Advisor PUÒ ri-assegnare.

**Regola business (provenance)** — catalog `platform_contact_sources`:
| code | label_it | label_en |
|---|---|---|
| `studio_request` | Candidatura V2 | Studio request V2 |
| `manual` | Inserito manualmente | Manual entry |
| `advisor` | Da advisor | Added by advisor |
| `import` | Importato (CSV/batch) | Imported (CSV/batch) |
| `api` | Tramite API | Via API |
| `erp_sync` | Sync da ERP | ERP sync |
| `website` | Form sito | Website form |
| `linkedin` | LinkedIn outreach | LinkedIn outreach |

**Regola business (readiness)**:
- `relationship_score` INTEGER DEFAULT 0 — placeholder per Health Score futuro. M1 non scrive ML/logic.
- `last_touch_at` — placeholder denorm. Sarà aggiornato in M3 dai writer di `relationship_activities`. M1 non scrive automaticamente.
- Solo predisposizione schema, **nessuna logica applicativa in M1**.

### 2.2 `platform_contact_roles` — seed M1 finale (11 codici)

| code | category | label_it | label_en | sort |
|---|---|---|---|---|
| `founder` | leadership | Founder | Founder | 10 |
| `owner` | leadership | Titolare | Owner | 20 |
| `administration` | operations | Amministrazione | Administration | 30 |
| `marketing` | commercial | Marketing | Marketing | 40 |
| `sales` | commercial | Sales | Sales | 50 |
| `project_manager` | operations | Project Manager | Project Manager | 60 |
| `purchasing` | operations | Acquisti | Purchasing | 70 |
| `architect` | creative | Architetto | Architect | 80 |
| `designer` | creative | Designer | Designer | 90 |
| `supplier` | external | Fornitore | Supplier | 100 |
| `consultant` | external | Consulente | Consultant | 110 |

> Nota: la lista del piano v2 aveva 12 codici (`sales_manager`,
> `supplier_contact`, `external_consultant`, `advisor`). In M1
> approvata **lista a 11** con etichette brevi. "Advisor" NON è un
> ruolo di `tenant_contacts` perché vive su `studio_relations.owner_advisor_id`
> + visibile nell'header Overview.

### 2.3 `platform_activity_types` — seed M1 (5 quick + 3 extended)

Per i Quick Actions M1, ne servono solo **5 base**. Gli altri (`visit`,
`task`, `internal_note` esteso) restano definiti nel catalog ma
appariranno nella UI completa in M3.

| code | icon | label_it | label_en | quick_action_m1 |
|---|---|---|---|---|
| `call` | phone | Chiamata | Call | ✅ |
| `email` | mail | Email | Email | ✅ |
| `whatsapp` | message-circle | WhatsApp | WhatsApp | ✅ |
| `linkedin` | linkedin | LinkedIn | LinkedIn | ✅ |
| `internal_note` | sticky-note | Nota interna | Internal Note | ✅ |
| `meeting` | users | Meeting | Meeting | M3 |
| `visit` | map-pin | Visita | Visit | M3 |
| `task` | check-square | Task | Task | M3 |

Aggiunta colonna catalog:
```sql
ALTER TABLE platform_activity_types
  ADD COLUMN quick_action_m1 BOOLEAN NOT NULL DEFAULT FALSE;
```

(modifica trascurabile alla migration 031, non posticipata)

### 2.4 `relationship_activities` — scope M1 minimale

Per M1 (preview + quick action), basta scrivere **3 campi reali**:
- `activity_type_code` (call/email/whatsapp/linkedin/internal_note)
- `subject` (es. "Chiamata introduttiva", "Email follow-up commerciale")
- `outcome` (free text, opzionale)

Tutti gli altri campi (`duration_min`, `next_step`, `next_step_due_at`,
`reminder_sent_at`, `payload`) restano `NULL` in M1 e vengono editati
in M3 dalla form completa.

### 2.5 Nessun altro schema change

`studio_relations`, `studio_relationship_events`, vista
`v_relationship_timeline` restano come da 031.

---

## 3 · API SURFACE

### 3.1 Tenant Detail aggregato (READ)

| Verb | Path | Note |
|---|---|---|
| GET | `/api/admin/tenants?role=&advisor=&market=&status=&q=&limit=50&cursor=` | Lista tenant + KPI count |
| GET | `/api/admin/tenants/:tid/overview` | Header + KPI + primary_contact + last_3_activities |
| GET | `/api/blueprint/overview` | Founder, scope-locked |

`overview` response shape:
```json
{
  "tenant": { "id", "slug", "name", "status", "created_at" },
  "relation": { "id", "studio_name", "city", "country",
                "operating_market", "target_countries[]",
                "owner_advisor": { "user_id", "full_name", "advisor_code" } },
  "primary_contact": { …tenant_contact },
  "kpis": {
    "contacts_total": 4,
    "activities_30d": 12,
    "last_activity_at": "2026-06-02T03:14:00Z"
  },
  "recent_activities": [ … last 3 … ]
}
```

### 3.2 Contacts (Modulo CRM)

| Verb | Path Admin | Path Founder (D4) | Note |
|---|---|---|---|
| GET | `/api/admin/tenants/:tid/contacts?role=&status=&owner=&q=&limit=&cursor=` | `/api/blueprint/contacts?…` | List |
| GET | `/api/admin/tenants/:tid/contacts/:cid` | `/api/blueprint/contacts/:cid` | Detail (con `activities_preview[5]`) |
| POST | `/api/admin/tenants/:tid/contacts` | `/api/blueprint/contacts` | Create, anti-dup `(tid, lower(email))` |
| PATCH | `/api/admin/tenants/:tid/contacts/:cid` | `/api/blueprint/contacts/:cid` | Update partial |
| POST | `/api/admin/tenants/:tid/contacts/:cid/set-primary` | `/api/blueprint/contacts/:cid/set-primary` | Mark primary (D4 OK) |
| POST | `/api/admin/tenants/:tid/contacts/:cid/assign-owner` | ❌ vietato founder | Set `relationship_owner_user_id` |
| DELETE | `/api/admin/tenants/:tid/contacts/:cid` | `/api/blueprint/contacts/:cid` | Soft (status='archived') |

### 3.3 Activities (preview + quick-action M1)

| Verb | Path | Note |
|---|---|---|
| GET | `/api/admin/tenants/:tid/activities?limit=10` | Preview ultime N |
| GET | `/api/blueprint/activities?limit=10` | Founder scope |
| POST | `/api/admin/tenants/:tid/activities/quick` | Quick action minimal (M1) |
| POST | `/api/blueprint/activities/quick` | Founder scope |

Quick activity body:
```json
{
  "activity_type_code": "call",
  "contact_id": "uuid-or-null",
  "subject": "Chiamata introduttiva",
  "outcome": "Interessato a Blueprint, ricontatto in 7gg"
}
```

Form completo (`POST /activities` full) → M3.

### 3.4 Catalog (cached 60s)

| Verb | Path | Cached |
|---|---|---|
| GET | `/api/catalogs/contact-roles?locale=it-IT` | client + server 60s |
| GET | `/api/catalogs/activity-types?quick_only=1&locale=it-IT` | server 60s |
| GET | `/api/catalogs/languages` | server 5min |
| GET | `/api/catalogs/markets` | server 5min |

### 3.5 Owner picker (chi può essere relationship_owner)

| Verb | Path | Restituisce |
|---|---|---|
| GET | `/api/admin/users/eligible-owners?q=` | users con role ∈ {admin, editor, advisor}, attivi, paginato 50 |

Solo admin/editor possono chiamarla. Per la UI advisor stesso che si auto-assegna, l'endpoint resta accessibile (filtro server-side).

### 3.6 Search globale

| Verb | Path | Note |
|---|---|---|
| GET | `/api/admin/search?q=&types=tenant,contact&limit=20` | Cross-entity, vedi §5 |

---

## 4 · DRAWER LAYOUT — Contact Card

Modal/drawer apertura da:
- "+ Nuovo contatto" → drawer vuoto
- Click su riga tabella → drawer pre-popolato

```
┌──────────────────────────────────────────────────┐
│ ◀ Mario Rossi · Founder              [⋯]         │
│                                                  │
│ ────────────────────────────────────────────     │
│ IDENTITY                                         │
│   Nome     ─────────────────────                 │
│   Cognome  ─────────────────────                 │
│   Ruolo    [Founder ▾]   ← catalog 11 codici     │
│   Lingua   [Italiano ▾]  ← platform_languages    │
│                                                  │
│ CONTATTI                                         │
│   Email    ─────────────────────                 │
│   Phone    [+39 ▾] ─────────────                 │
│   LinkedIn ─────────────────────                 │
│                                                  │
│ RELATIONSHIP                                     │
│   Status      [Active ▾]                         │
│   Primary     ☐ Imposta come primary             │
│   Owner       [R. Visentin ▾]  ← /eligible-owners│
│   Assigned    2026-06-02 by Admin                │
│                                                  │
│ NOTE                                             │
│   ┌────────────────────────────────────────┐     │
│   │ Free text…                             │     │
│   └────────────────────────────────────────┘     │
│                                                  │
│ ──────  ATTIVITÀ RECENTI (preview)  ──────       │
│  • 02/06 Call · "Chiamata introduttiva"          │
│  • 01/06 Email · "Follow-up Blueprint"           │
│  • [Vedi tutte →] (M3)                           │
│                                                  │
│ [ Annulla ]              [ Salva contatto ]      │
└──────────────────────────────────────────────────┘
   ─────── Quick actions (footer) ───────
   [ 📞 Call ] [ ✉ Email ] [ 💬 WhatsApp ] [ in LinkedIn ] [ 📝 Note ]
```

Quick action click → mini-modal con `subject` + `outcome` precompilato
sul `contact_id` corrente.

---

## 5 · SEARCH

### 5.1 Surface
- Search bar globale in `WorkspaceShell` topbar (visibile in tutto Command Center)
- Hotkey `cmd+k` / `ctrl+k` → focus
- Search bar nella lista Tenants

### 5.2 Backend `GET /api/admin/search?q=&types=`

Match across entities:
| Entity | Campi indicizzati |
|---|---|
| **Tenant** | `tenants.name`, `tenants.slug`, `studio_relations.studio_name`, `studio_relations.website` |
| **Contact** | `tenant_contacts.first_name`, `last_name`, `email`, `phone_number` |
| **Studio Request** (lead) | `studio_requests.contact_email`, `studio_name`, `reference` |

Response:
```json
{
  "q": "rossi",
  "results": [
    { "type": "tenant",  "id", "label": "Martinel Interior Design",
      "subtitle": "Pordenone, IT · Advisor: R. Visentin",
      "url": "/command-center/tenants/d346b762..." },
    { "type": "contact", "id", "label": "Mario Rossi · Founder",
      "subtitle": "Martinel Interior Design · mario.rossi@…",
      "url": "/command-center/tenants/d346b762.../contacts/8a1c..." }
  ]
}
```

### 5.3 Indici fulltext (parte di 031)
```sql
CREATE INDEX idx_tenant_contacts_search
  ON tenant_contacts USING gin (
    to_tsvector('simple',
      coalesce(first_name,'') ||' '|| coalesce(last_name,'') ||' '||
      coalesce(email,'') ||' '|| coalesce(phone_number,''))
  );
CREATE INDEX idx_studio_relations_search
  ON studio_relations USING gin (
    to_tsvector('simple',
      coalesce(studio_name,'') ||' '|| coalesce(website,'') ||' '||
      coalesce(legal_name,''))
  );
```

> ⚠ Aggiunta minore alla migration 031: indici GIN tsvector. ~0.1g.

### 5.4 Frontend
- Componente `<GlobalSearch />` → debounced 250ms
- Risultati raggruppati per `type` con icone Lucide

---

## 6 · FILTERS (lista Tenants + tabella Contatti)

### 6.1 Lista Tenants `/command-center/tenants`
| Filtro | Sorgente | Multi-select |
|---|---|---|
| Advisor | `users WHERE role IN ('admin','editor','advisor') AND status='active'` | ✅ |
| Operating Market | `markets WHERE enabled=TRUE` | ✅ |
| Status | enum `tenants.status` (active/suspended/trial/...) | ✅ |
| Has primary contact | boolean | — |
| Has activity last 30d | boolean | — |

Persisti scelte in `localStorage.cc_tenant_filters` per sessione.

### 6.2 Tabella Contatti (dentro Tenant Detail)
| Filtro | Sorgente |
|---|---|
| Ruolo | `platform_contact_roles` |
| Status | `active`/`inactive`/`archived` |
| Owner | `users` eligible |
| Lingua preferita | `platform_languages` |

---

## 7 · PERMISSIONS

Matrice ufficiale M1:

| Azione | Admin/Editor | Advisor | Founder | Team Member |
|---|---|---|---|---|
| Vedere lista tenant globale | ✅ | ✅ (solo propri) | ❌ | ❌ |
| Aprire `/command-center/tenants/:tid` qualsiasi | ✅ | ✅ se owner_advisor | ❌ | ❌ |
| Aprire `/blueprint/overview` propria | ✅ | ✅ (se assigned) | ✅ | ✅ |
| CRUD `tenant_contacts` propri | ✅ | ✅ (se assigned) | ✅ (D4) | ❌ (M1) |
| Assegnare `relationship_owner` | ✅ | ✅ self-assign | ❌ | ❌ |
| Cambiare `relationship_owner` altrui | ✅ | ❌ | ❌ | ❌ |
| Quick Action (log activity) | ✅ | ✅ (su own tenants) | ✅ (D4) | ❌ |
| Search globale | ✅ | scope-limitato | ❌ | ❌ |
| Vedere advisor nell'header | ✅ | ✅ | ✅ (read-only) | ❌ |

> Team Member CRUD su `tenant_contacts` arriva in M+ (multi-user
> tenant). Per M1, solo il primary founder (`tenant_memberships.role='owner'`)
> ha permessi founder.

Implementazione tecnica:
- Endpoint admin: dipendono da `require_advisor_scope` (estendere a
  filter su `studio_relations.owner_advisor_id`).
- Endpoint founder `/api/blueprint/*`: dipendono da
  `require_admin_tenant` che già scope-locka su tenant. Aggiungere
  test cross-tenant esplicito.

---

## 8 · ACCEPTANCE CRITERIA

### 8.1 Funzionali
- ✅ `/command-center/tenants` mostra lista paginata 50/page con count contatti per tenant
- ✅ Click su tenant apre `/command-center/tenants/:tid` con header completo + 5 tab
- ✅ Tab "Contatti" mostra tabella con anti-N+1 (single query)
- ✅ Click "+ Nuovo contatto" apre drawer; submit crea il record e refresh tabella
- ✅ Anti-duplicato: stesso email su stesso tenant → 409 con suggerimento "Vedi contatto esistente"
- ✅ Solo 1 `is_primary=TRUE` per tenant attivo (constraint DB)
- ✅ `relationship_owner` può essere assegnato e visualizzato (chip avatar+nome nella tabella)
- ✅ 5 Quick Actions inseriscono record in `relationship_activities` con `activity_type_code` corretto
- ✅ Tab "Attività" mostra ultime 10 con filtri (tipo, owner) — preview only
- ✅ Tab "Timeline" e "Notifiche" sono visibili con messaggio "Disponibile in M2/M4"
- ✅ Search globale `cmd+k` trova tenant, contatti, lead per nome/email/telefono
- ✅ Filtri lista tenant persistiti in localStorage
- ✅ 11 ruoli del catalog visibili nel select del drawer
- ✅ Lingue del platform_languages popolate nel select
- ✅ Founder vede `/blueprint/overview` con stesso shape, scope-locked

### 8.2 Sicurezza (D4 tenant isolation)
- ✅ JWT founder → `GET /api/blueprint/contacts` restituisce solo i contatti del proprio tenant
- ✅ JWT founder con `tid` forzato di altro tenant → 403/404
- ✅ JWT founder → `POST /api/admin/tenants/:other_tid/contacts` → 401/403
- ✅ JWT founder → tentativo di patch `relationship_owner_user_id` → 403
- ✅ JWT advisor → vede solo tenant con `owner_advisor_id = me.user_id`

### 8.3 Performance / scale (150 tenant · 500+ contatti)
- ✅ `GET /api/admin/tenants?limit=50` <300ms (EXPLAIN ANALYZE su mock 150 tenant)
- ✅ `GET /api/admin/tenants/:tid/overview` <250ms (anti-N+1, CTE singola)
- ✅ `GET /api/admin/tenants/:tid/contacts` <200ms con 500 contatti
- ✅ Search `GET /api/admin/search?q=` <150ms (tsvector GIN)

### 8.4 No hardcoded
- ✅ Nessun ruolo cablato nel frontend (tutto via `useCatalog('contact-roles')`)
- ✅ Nessuna lingua cablata
- ✅ Nessun mercato cablato
- ✅ Owner picker via `/api/admin/users/eligible-owners`

### 8.5 Regression
- ✅ `first_real_tenant_audit.py` continua a passare con 0 P0
- ✅ Auth, magic-link, Founder Welcome non subiscono regressioni

---

## 9 · EFFORT REALE

> Aggiornato dal piano roadmap (M1 = 5d) con scope dettagliato.

| Componente | Backend | Frontend | DB | QA | Note |
|---|---|---|---|---|---|
| **Setup (delta migration 031)** | 0.3 | — | 0.2 | — | 2 colonne owner + 1 col quick_action + 2 GIN |
| **Catalog endpoints + cache** | 0.4 | 0.3 | — | — | `useCatalog` hook |
| **Tenant list page + filtri + search bar** | 0.5 | 0.8 | — | 0.2 | Sidebar nav voce nuova |
| **Tenant detail header + tabs scaffold** | 0.2 | 0.6 | — | — | Layout + placeholders M2/M4 |
| **Overview tab (KPI + summary)** | 0.4 | 0.5 | — | — | Endpoint `overview` |
| **Contacts CRUD + drawer + roles select** | 0.6 | 1.0 | — | 0.3 | Anti-dup, primary unique |
| **Relationship owner picker + assign** | 0.3 | 0.3 | — | — | Endpoint eligible-owners |
| **Activities preview + 5 Quick Actions** | 0.4 | 0.6 | — | 0.2 | Mini-modal per quick |
| **Global search endpoint + frontend** | 0.4 | 0.4 | — | — | tsvector GIN |
| **Founder isolation: `/api/blueprint/*` mirror** | 0.5 | 0.3 | — | 0.3 | Cross-tenant test |
| **E2E test `command_center_crm_m1_e2e.py`** | — | — | — | 0.5 | Scenario "Atelier Verde" |
| **Subtotali** | **4.0** | **4.8** | **0.2** | **1.5** | |
| **Totale** | | | | | **~10.5 giorni-uomo** |

> 📌 **Incremento vs roadmap v2 (+5.5g)**: principalmente per (a) ricerca
> globale e indici fulltext, (b) lista Tenants + filtri persistenti
> (non originariamente in M1), (c) Quick Actions UI con mini-modal
> dedicato, (d) Founder mirror `/api/blueprint/*` completo. La roadmap
> v2 stimava 5d perché contava solo CRUD contatti core. Lo scope ratificato
> qui è più ampio (search, filtri, quick actions, mirror founder).
>
> **Suggerimento allocativo**: se 2 sviluppatori in parallelo →
> backend (4g) + frontend (4.8g) → ~5.5g calendario.

---

## 10 · DIPENDENZE & RISCHI

### Dipendenze
- 🔴 M0 (migration 031) obbligatoria PRIMA di toccare codice M1
- 🔴 Schema delta §2 (owner + quick + GIN + ts indexes) integrato in 031
- 🟡 Endpoint `eligible-owners` riusa `users` esistente → no nuovi modelli
- 🟢 `WorkspaceShell` esistente accomoda topbar search + nav voce Tenants

### Rischi
| Rischio | Sev | Mitigazione |
|---|---|---|
| Founder isolation regression | 🔴 P0 | Test E2E specifico cross-tenant per ogni endpoint `/api/blueprint/*` |
| Search performance senza GIN | 🟠 P1 | Aggiunta GIN obbligatoria in 031 (vedi §5.3) |
| Drawer UX con 11 ruoli + lingue | 🟡 P2 | Combobox con search interna, non plain select |
| Quick Activity → confusione con M3 form completa | 🟡 P2 | UI mini-modal chiaramente "Registrazione rapida" + link "Vedi tutte le opzioni (M3)" |
| Anti-dup contact email case sensitive | 🟢 | Unique partial index su `(tenant_id, lower(email))` già pianificato in 031 |
| `last_activity_at` denorm sync | 🟡 P2 | Trigger Postgres su INSERT in `relationship_activities` + servizio fallback |

---

## 11 · VERDETTO

🟢 **`READY_FOR_M1_IMPLEMENTATION`**

Tutti gli elementi tecnici sono specificati:
- ✅ UX layout dettagliato (header + 5 tabs + sidebar nav + drawer)
- ✅ Schema delta integrabile nella migration 031 con +0.5g
- ✅ API surface completa (admin + founder mirror)
- ✅ Search globale + filtri persistiti definiti
- ✅ Permission matrix esplicita
- ✅ Acceptance criteria funzionali + sicurezza + performance + no-hardcoded
- ✅ Effort reale ~10.5g (revisione al rialzo onesta vs roadmap v2)
- ✅ Rischi mitigati

**Bloccante implementativo**: solo l'esecuzione di M0 (migration 031
con le 2 aggiunte §2.1 + §2.3 + §5.3). Una volta applicata, M1 può
partire allo "Vai".

> Consiglio: prima di partire M1, eseguire un **piccolo dry-run su
> mock data** (es. 30 tenant + 100 contatti seedati) per validare
> EXPLAIN ANALYZE su `tenants` list e `overview` aggregato. ~0.5g extra
> ma evita di scoprire bottleneck dopo aver scritto tutto il frontend.

---

*Generato il 2 Giu 2026 da E1 (Emergent), su istruzione utente
"M1 — CONTACT CRM FOR COMMAND CENTER™".*
*Nessuna migration eseguita. Nessuna feature implementata. Solo piano esecutivo definitivo.*
