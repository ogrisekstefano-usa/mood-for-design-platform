# RELATIONSHIP OS™ — FOUNDATION PLAN (v2 · APPROVED)
> Trasformare il Command Center da pipeline di candidature a **sistema
> relazionale**. Versione MVP. **DECISIONI ARCHITETTURALI APPROVATE**
> il 2 Giu 2026. NESSUNA implementazione in questo documento.

**Classificazione finale**: 🟢 **`FOUNDATION_READY`**

Le 5 decisioni di modello dati sono state ratificate dall'utente. Il
modello canonico è definito, le legacy table sono congelate come
READ-ONLY, l'isolation founder è approvata. M0 può partire appena viene
dato l'OK implementativo.

**Scale target**: 150 tenant · 500+ contatti · advisor multipli ·
mercati multipli. Tutto il design (indici, FK, viste, paginazione)
deve sostenere questo obiettivo, non il primo tenant.

---

## 0 · DECISIONI APPROVATE (RATIFICATE)

| # | Decisione | Stato |
|---|---|---|
| D1 | `tenant_contacts` è il modello **canonico** multi-contatto. Una persona = un record. Ruoli supportati: Founder, Owner, Administration, Marketing, Sales Manager, Project Manager, Purchasing, Architect, Designer, Supplier Contact, External Consultant, Advisor (+ estendibili via catalog DB). | ✅ |
| D2 | Legacy `contacts` + `accounts` + `studio_team_members` restano **LEGACY · READ-ONLY**. Niente drop, niente migration ora. Documentato percorso di migrazione futuro (vedi §3.4). | ✅ |
| D3 | `relationship_notifications` è lo storage **canonico** per tutte le notifiche interne. Destinatari supportati: Admin MOOD · Advisor · Founder · Team Member. La tabella generica `notifications` resta legacy. | ✅ |
| D4 | Il Founder **può** gestire i contatti del proprio tenant: creare/modificare/disattivare. **NON può** accedere ad altri tenant, modificare utenti MOOD o riassegnare advisor. Tenant isolation obbligatoria su ogni endpoint. | ✅ |
| D5 | Timeline mostra solo eventi **ad alto valore relazionale**. Eventi tecnici (open/click/retry/bounce/delivery) restano in `studio_email_dispatch_log` per diagnostica. Whitelist di template_key nella view. | ✅ |

---

## 1 · AUDIT — STATO ATTUALE (invariato dalla v1)

> Sezione mantenuta dalla v1 per memoria storica. La tabella seguente è il
> riassunto strutturato delle tabelle DB rilevanti, con classificazione
> AGGIORNATA secondo le decisioni del §0.

🟢 = canonico (sviluppo attivo) · 🟡 = pronta ma vuota, da popolare · 🟠 = LEGACY READ-ONLY (D2) · 🔴 = da deprecare/non-canonico

| Tabella | Rows | Stato post-D | Note |
|---|---|---|---|
| `studio_relations` | 19 | 🟢 canonico | Ancora relazionale advisor↔studio |
| `studio_relationship_events` | 38 | 🟢 canonico (esteso) | Timeline narrativa. Aggiungeremo `tenant_id` + `event_type_code` |
| `advisor_followups` | 0 | 🟢 canonico | Reminder/next action |
| `studio_visit_reports` | 0 | 🟢 canonico | Visit reports curatoriali |
| `studio_email_dispatch_log` | 165+ | 🟢 canonico | Log email — diagnostica |
| `platform_languages` | 12 | 🟢 catalog | Lingue per `preferred_language` |
| `markets` / `countries` | many | 🟢 catalog | Geo |
| **`tenant_contacts`** (NEW) | — | 🟢 canonico | D1 — Single source of truth per contatti |
| **`relationship_activities`** (NEW) | — | 🟢 canonico | Activity log commerciale |
| **`platform_relationship_event_types`** (NEW) | — | 🟢 catalog | Tassonomia DB-driven |
| **`platform_contact_roles`** (NEW) | — | 🟢 catalog | Tassonomia DB-driven |
| **`platform_activity_types`** (NEW) | — | 🟢 catalog | Tassonomia DB-driven |
| `relationship_notifications` | 0 | 🟢 canonico (D3) | Notifiche interne |
| `contacts` | 0 | 🟠 LEGACY · READ-ONLY | D2 — congelata |
| `accounts` | 0 | 🟠 LEGACY · READ-ONLY | D2 — congelata |
| `studio_team_members` | 0 | 🟠 LEGACY · READ-ONLY | D2 — congelata |
| `notifications` | 0 | 🟠 LEGACY · READ-ONLY | D3 — congelata |
| `tenant_activity_events` | 0 | 🟠 LEGACY · READ-ONLY | Troppo povera, sostituita |
| `advisor_lead_activities` | 0 | 🟠 LEGACY · READ-ONLY | Sostituita da `relationship_activities` |
| `advisor_notes` | 0 | 🟠 LEGACY · READ-ONLY | Sostituita dal campo `notes` su `tenant_contacts` + `internal_note` in activities |

---

## 2 · GAP ANALYSIS (post-decisioni)

Tutti i gap P0 sono **chiusi** dalle decisioni D1–D5. Restano i task
implementativi documentati nella roadmap separata (M0–M5).

| Gap | Risolto da | Milestone |
|---|---|---|
| Modello multi-contatto frammentato | D1 + nuova `tenant_contacts` | M0+M1 |
| Notification system doppio | D3 + canonical `relationship_notifications` | M0+M4 |
| Activity log doppio | Nuova `relationship_activities` | M0+M3 |
| `kind`/`event_type` hardcoded | 3 cataloghi `platform_*` | M0 |
| Tenant Overview surface assente | Nuova `/command-center/tenants/:id` | M5 (vedi anche §5 sotto su anticipo) |
| Advisor KPI assenti | Estensione `AdvisorConsole` | M5 |
| Email events nel timeline | Vista filtrata per template whitelist (D5) | M2 |
| Internal notification badge UI | `<NotificationBell />` + polling | M4 |

---

## 3 · SCHEMA DB CANONICO (post-D1/D2/D3)

### 3.1 Migration `031_relationship_os_foundation.sql` (specifica finale)

```sql
-- ─── CATALOGS (D1, D5) ────────────────────────────────────────────────
CREATE TABLE platform_relationship_event_types (
  code              TEXT PRIMARY KEY,
  category          TEXT NOT NULL,    -- 'lifecycle'|'communication'|'manual'|'system'
  source            TEXT NOT NULL,    -- 'auto'|'manual'
  show_in_timeline  BOOLEAN NOT NULL DEFAULT TRUE,  -- D5 filter flag
  icon              TEXT,
  color             TEXT,
  label_it          TEXT NOT NULL,
  label_en          TEXT NOT NULL,
  sort_order        INT NOT NULL DEFAULT 100,
  enabled           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE platform_contact_roles (
  code              TEXT PRIMARY KEY,
  category          TEXT NOT NULL,    -- 'leadership'|'operations'|'commercial'|'creative'|'external'
  label_it          TEXT NOT NULL,
  label_en          TEXT NOT NULL,
  sort_order        INT NOT NULL DEFAULT 100,
  enabled           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE platform_activity_types (
  code              TEXT PRIMARY KEY,
  icon              TEXT,
  default_duration_min INT,
  show_in_timeline  BOOLEAN NOT NULL DEFAULT TRUE,
  label_it          TEXT NOT NULL,
  label_en          TEXT NOT NULL,
  sort_order        INT NOT NULL DEFAULT 100,
  enabled           BOOLEAN NOT NULL DEFAULT TRUE
);

-- ─── tenant_contacts (D1 canonical) ────────────────────────────────────
CREATE TABLE tenant_contacts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  studio_relation_id  UUID NULL REFERENCES studio_relations(id) ON DELETE SET NULL,
  user_id             UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  first_name          TEXT NOT NULL,
  last_name           TEXT,
  role_code           TEXT NOT NULL REFERENCES platform_contact_roles(code),
  email               TEXT,
  phone_prefix        TEXT,
  phone_number        TEXT,
  linkedin_url        TEXT,
  notes               TEXT,
  preferred_language  TEXT REFERENCES platform_languages(code),
  is_primary          BOOLEAN NOT NULL DEFAULT FALSE,
  status              TEXT NOT NULL DEFAULT 'active',   -- active|inactive|archived
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by          UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at    TIMESTAMPTZ,
  archived_at         TIMESTAMPTZ
);
-- Indici dimensionati per 150 tenant × 500+ contatti (~75k righe stimate)
CREATE INDEX idx_tenant_contacts_tenant_status
  ON tenant_contacts(tenant_id, status);
CREATE INDEX idx_tenant_contacts_relation
  ON tenant_contacts(studio_relation_id) WHERE studio_relation_id IS NOT NULL;
CREATE INDEX idx_tenant_contacts_email_lower
  ON tenant_contacts(tenant_id, lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX uq_tenant_contacts_primary_active
  ON tenant_contacts(tenant_id) WHERE is_primary = TRUE AND status = 'active';
CREATE INDEX idx_tenant_contacts_role
  ON tenant_contacts(tenant_id, role_code) WHERE status = 'active';

-- ─── relationship_activities (activity log canonical) ─────────────────
CREATE TABLE relationship_activities (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  studio_relation_id  UUID NULL REFERENCES studio_relations(id) ON DELETE SET NULL,
  contact_id          UUID NULL REFERENCES tenant_contacts(id) ON DELETE SET NULL,
  owner_user_id       UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  activity_type_code  TEXT NOT NULL REFERENCES platform_activity_types(code),
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_min        INT,
  subject             TEXT,
  outcome             TEXT,
  next_step           TEXT,
  next_step_due_at    TIMESTAMPTZ,
  reminder_sent_at    TIMESTAMPTZ,
  payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  archived_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_relationship_activities_tenant_when
  ON relationship_activities(tenant_id, occurred_at DESC);
CREATE INDEX idx_relationship_activities_owner_due
  ON relationship_activities(owner_user_id, next_step_due_at)
  WHERE next_step_due_at IS NOT NULL AND archived_at IS NULL;
CREATE INDEX idx_relationship_activities_contact
  ON relationship_activities(contact_id, occurred_at DESC)
  WHERE contact_id IS NOT NULL;
CREATE INDEX idx_relationship_activities_relation
  ON relationship_activities(studio_relation_id, occurred_at DESC)
  WHERE studio_relation_id IS NOT NULL;

-- ─── ALTER studio_relationship_events ─────────────────────────────────
ALTER TABLE studio_relationship_events
  ADD COLUMN IF NOT EXISTS tenant_id UUID NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS event_type_code TEXT NULL REFERENCES platform_relationship_event_types(code);

CREATE INDEX IF NOT EXISTS idx_relationship_events_tenant_when
  ON studio_relationship_events(tenant_id, occurred_at DESC);

-- ─── relationship_notifications (D3 canonical) — solo ALTER se servono indici ─
-- La tabella è già pronta. Aggiungere solo:
CREATE INDEX IF NOT EXISTS idx_relationship_notifications_recipient_unread
  ON relationship_notifications(recipient_user_id, created_at DESC)
  WHERE read_at IS NULL AND archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_relationship_notifications_tenant_unread
  ON relationship_notifications(tenant_id, created_at DESC)
  WHERE read_at IS NULL AND archived_at IS NULL;

-- ─── v_relationship_timeline (D5 — filtrata) ──────────────────────────
-- Mostra solo eventi/email/attività con show_in_timeline = TRUE
CREATE OR REPLACE VIEW v_relationship_timeline AS
  -- 1) Eventi narrativi (lifecycle/manual)
  SELECT
    'event'::TEXT                 AS source,
    e.id, e.tenant_id, e.relation_id,
    e.event_type_code             AS type_code,
    NULL::TEXT                    AS subject,
    e.payload,
    e.actor_id                    AS owner_user_id,
    e.occurred_at                 AS at
  FROM studio_relationship_events e
  JOIN platform_relationship_event_types t ON t.code = e.event_type_code
  WHERE t.show_in_timeline = TRUE
  UNION ALL
  -- 2) Email ad alto valore (D5 whitelist su template_key)
  SELECT
    'email'::TEXT                 AS source,
    l.id,
    l.tenant_id,
    NULL::UUID                    AS relation_id,
    l.template_key                AS type_code,
    l.subject,
    l.variables                   AS payload,
    NULL::UUID                    AS owner_user_id,
    l.created_at                  AS at
  FROM studio_email_dispatch_log l
  WHERE l.template_key IN (
    -- Whitelist D5 — solo eventi relazionali ad alto valore
    'studio_request_received',
    'studio_request_review',
    'studio_request_qualified',
    'studio_request_approved',
    'admin_new_studio_request',
    'founder_invitation_resent',
    'tenant_activated_notice'
    -- ESCLUSI deliberatamente: open/click/retry/bounce/magic_link_only ecc.
  )
  UNION ALL
  -- 3) Attività manuali commerciali
  SELECT
    'activity'::TEXT              AS source,
    a.id, a.tenant_id,
    a.studio_relation_id          AS relation_id,
    a.activity_type_code          AS type_code,
    a.subject,
    a.payload,
    a.owner_user_id,
    a.occurred_at                 AS at
  FROM relationship_activities a
  JOIN platform_activity_types t ON t.code = a.activity_type_code
  WHERE a.archived_at IS NULL
    AND t.show_in_timeline = TRUE;
```

### 3.2 Seed scripts (NON eseguiti — pronti per M0)

- `seed_relationship_event_types.py` — 20 codici (vedi §3.5)
- `seed_contact_roles.py` — **12 codici approvati**: founder, owner, administration, marketing, sales_manager, project_manager, purchasing, architect, designer, supplier_contact, external_consultant, advisor
- `seed_activity_types.py` — 8 codici: call, meeting, email, whatsapp, linkedin, visit, internal_note, task

### 3.3 Tenant isolation rules (D4)

Tutti gli endpoint multi-tenant **devono**:
- per Founder (`role=owner`): filtrare WHERE `tenant_id = me.tenant_id`
- per Advisor: filtrare WHERE `studio_relation.owner_advisor_id = me.user_id`
- per Admin/Editor: nessun filtro
- Founder NON può: leggere/scrivere `tenant_memberships` cross-tenant, riassegnare advisor, modificare ruoli MOOD-side.
- Founder PUÒ: CRUD `tenant_contacts` (D4), CRUD `relationship_activities` con `tenant_id = me.tenant_id`, lettura della propria timeline e delle proprie notifiche.

### 3.4 Percorso di migrazione futuro (D2 — documentato, non implementato)

> **Non eseguire ora.** Riportato qui solo per memoria storica.

1. M+6 mesi: contare quante righe ci sono in `contacts`/`accounts`/
   `studio_team_members`/`notifications`/`tenant_activity_events`/
   `advisor_lead_activities`/`advisor_notes`. Se ancora vuote → DROP
   senza migrazione.
2. Se popolate (improbabile): script `migrate_legacy_contacts.py`
   transcoderà `contacts` → `tenant_contacts` con join su `accounts.tenant_id`.
3. Le tabelle legacy verranno marcate `pg_dump`-excluded e poi
   eliminate in una migration `040_legacy_contacts_drop.sql`.

### 3.5 Codici tassonomia (specifica seed, NON eseguito)

#### `platform_relationship_event_types` (20 codici)
| code | category | source | show_in_timeline | trigger |
|---|---|---|---|---|
| `relation_opened` | lifecycle | auto | ✅ | Quando `studio_relations` insert |
| `studio_request_submitted` | lifecycle | auto | ✅ | V2 submit |
| `status_changed` | lifecycle | auto | ✅ | Status transition |
| `temperature_changed` | lifecycle | auto | ❌ | Diagnostica advisor |
| `ownership_changed` | lifecycle | auto | ✅ | Reassign advisor |
| `qualification_done` | lifecycle | auto | ✅ | qualified status |
| `activated` | lifecycle | auto | ✅ | Tenant attivato |
| `magic_link_issued` | communication | auto | ✅ | Activation |
| `magic_link_consumed` | communication | auto | ✅ | First login |
| `blueprint_first_access` | communication | auto | ✅ | First Blueprint visit |
| `password_set` | communication | auto | ❌ | Diagnostica |
| `password_reset_requested` | communication | auto | ❌ | Diagnostica |
| `contact_added` | manual | auto | ✅ | Contact creato |
| `contact_archived` | manual | auto | ❌ | Cosmetico |
| `note_added` | manual | manual | ✅ | Internal note |
| `visit_recorded` | manual | manual | ✅ | Visit report saved |
| `presentation_scheduled` | manual | manual | ✅ | Manual scheduling |
| `presentation_delivered` | manual | manual | ✅ | Manual delivery |
| `ecosystem_aligned` | manual | manual | ✅ | Quality milestone |
| `archived` | lifecycle | auto | ✅ | Status=archived |

---

## 4 · MODULI MVP — ORDINE FINALE APPROVATO

L'ordine implementativo è stato approvato dall'utente come segue:

1. **M0** — DB Consolidation (obbligatorio)
2. **M1** — Contact CRM (priorità assoluta) ⭐
3. **M2** — Relationship Timeline
4. **M3** — Activity Log
5. **M4** — Notification Center
6. **M5** — Advisor Workspace + KPI

> Il suggerimento "Timeline prima del CRM" è stato esplicitamente
> **rifiutato**. Motivazione utente: prima sapere CHI segue cosa, poi
> raccontare COSA succede.

I dettagli implementativi per ciascun milestone sono in:
**`/app/memory/RELATIONSHIP_OS_IMPLEMENTATION_ROADMAP.md`**.

---

## 5 · DATA STRATEGY — Verso la Scala (150 tenant)

Ogni relazione deve accumulare in modo strutturato:

| Dato | Tabella canonica | Volume stimato @ 150 tenant |
|---|---|---|
| Contatti | `tenant_contacts` | ~3-5 contatti/tenant → **~750** righe |
| Attività | `relationship_activities` | ~5/mese/tenant → **~9k/anno** |
| Timeline events | `studio_relationship_events` | ~12/tenant/anno → **~1.8k/anno** |
| Email events | `studio_email_dispatch_log` | ~50/tenant/anno → **~7.5k/anno** |
| Mercati | `tenant_markets` (esiste) | ~4 mercati/tenant → 600 |
| Ruoli | `platform_contact_roles` × `tenant_contacts.role_code` | n/a |
| Lingue | `tenant_contacts.preferred_language` | n/a |
| Project Types | (futuro) `platform_project_types` × `tenant_project_types` | M6+ |
| Specializzazioni | (futuro) `platform_specializations` × `tenant_specializations` | M6+ |
| Touchpoints | derivati da `relationship_activities` JOIN `contacts` | n/a |

Tutti questi dati saranno consumabili da:
- **Advisor Intelligence** — matching advisor↔studio per affinità mercato/specializzazione
- **Editorial Intelligence** — personalizzazione editoriale per cluster di tenant
- **Market Intelligence** — aggregati per geo/archetipo
- **Specification Intelligence** — pattern di richiesta materiali
- **AI Services** — features ML su payload eterogenei

> **Principio architetturale**: i JSONB `payload` su `relationship_activities`
> e `studio_relationship_events` sono **estendibili** senza migration.
> Permettono di accumulare feature signals senza romperel lo schema.

---

## 6 · DOCUMENTI CORRELATI

- 📄 `/app/memory/RELATIONSHIP_OS_FOUNDATION_PLAN.md` — questo documento (architettura)
- 📄 `/app/memory/RELATIONSHIP_OS_IMPLEMENTATION_ROADMAP.md` — roadmap dettagliata M0-M5
- 📄 `/app/memory/FIRST_REAL_TENANT_CERTIFICATION_REPORT.md` — base di partenza certificata

---

## 7 · VERDETTO FINALE

🟢 **`FOUNDATION_READY`**

Tutte le 5 decisioni architetturali approvate. Schema canonico
definito. Legacy tables congelate come READ-ONLY senza rischio
regressione. Tenant isolation founder esplicitamente progettata.
Timeline filtering D5 specificato. Scale target (150 tenant · 500+
contatti) considerato negli indici e nei volumi previsti.

L'implementazione può partire da M0 con un singolo "Vai" dell'utente.

---

*Aggiornato il 2 Giu 2026 da E1 (Emergent), su istruzione utente
"APPROVAZIONE ARCHITETTURALE — RELATIONSHIP OS™ FOUNDATION".*
*Nessuna migration eseguita. Solo consolidamento architetturale definitivo.*
