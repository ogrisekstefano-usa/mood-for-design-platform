# M1 REAL USAGE VALIDATION™ — REPORT

> Eseguito 2026-06-02T22:50:47.469153+00:00 su Martinel Interior Design
> via endpoint HTTP pubblici M1. Zero SQL, zero seed.

## CLASSIFICAZIONE: **`M1_VALIDATED_READY_FOR_M2`**

---

## 1 · STEP ESEGUITI (REAL HTTP TRAFFIC)

| # | Step | Esito | Dettaglio |
|---|------|:--:|-----------|
| 1 | `admin login` | ✅ | token len=373 |
| 2 | `list tenants[search=martinel]` | ✅ | contacts_count=2, owner=MOOD Admin |
| 3 | `eligible-owners` | ✅ | admin uid=2efb86f8-6546-4bb0-a653-6eab772a0da3 |
| 4 | `assign tenant owner` | ✅ | owner=2efb86f8-6546-4bb0-a653-6eab772a0da3 |
| 5 | `catalog contact-roles` | ✅ | 11 entries |
| 6 | `catalog activity-types` | ✅ | 8 entries |
| 7 | `catalog contact-sources` | ✅ | 8 entries |
| 8 | `catalog languages` | ✅ | 12 entries |
| 9 | `contract probe preferred_language='it'` | ✅ | accepted (mapped) — clean up created probe contact |
| 10 | `create contact Mario (founder)` | ✅ | id=77e1d828-a4ab-438b-b347-f07f3306702a |
| 11 | `create contact Giulia (architect)` | ✅ | id=eb16882e-7403-401d-937d-5687c8828a82 |
| 12 | `create contact Luca (purchasing)` | ✅ | id=dc90fe39-8811-4d3c-b3fd-a3b30f190fdb |
| 13 | `create activity call` | ✅ | id=7672e0a7-aedd-49c1-9f53-911c238c2448 |
| 14 | `create activity email` | ✅ | id=3c63eacc-dc1d-4c7f-930f-49f9b83f5160 |
| 15 | `create activity whatsapp` | ✅ | id=3f661bc4-9b77-4107-8000-137315d3bd3b |
| 16 | `create activity linkedin` | ✅ | id=592616cb-9f65-43ec-9f4c-51c8c3a681e2 |
| 17 | `create activity internal_note` | ✅ | id=651ae818-8743-4666-8540-7412f7fbda56 |
| 18 | `list contacts` | ✅ | 3 active |
| 19 | `filter by role=architect` | ✅ | HTTP 200 got 1 |
| 20 | `contact search q=Giulia` | ✅ | got 1 |
| 21 | `PATCH update contact` | ✅ | HTTP 200 body={"id":"eb16882e-7403-401d-937d-5687c8828a82","tenant_id":"c64659f6-5a76-41dd-8d8d-b901d29862af","studio_relation_id":"df |
| 22 | `set-primary` | ✅ | HTTP 200 |
| 23 | `assign contact owner` | ✅ | HTTP 200 body={"id":"eb16882e-7403-401d-937d-5687c8828a82","tenant_id":"c64659f6-5a76-41dd-8d8d-b901d29862af","studio_relation_id":"df |
| 24 | `overview KPIs` | ✅ | contacts=3 activities_30d=24 owner=MOOD Admin |
| 25 | `global search 'martinel'` | ✅ | HTTP 200 20 results |
| 26 | `global search 'Giulia'` | ✅ | HTTP 200 2 results |
| 27 | `archive contact` | ✅ | HTTP 200 |
| 28 | `list archived contacts` | ✅ | HTTP 200 count=18 |
| 29 | `blueprint/overview (admin override → Martinel)` | ✅ | HTTP 200 |
| 30 | `blueprint/contacts (admin override → Martinel)` | ✅ | HTTP 200 count=2 |
| 31 | `blueprint/activities (admin override → Martinel)` | ✅ | HTTP 200 count=10 |
| 32 | `D4: blueprint PATCH strips relationship_owner_user_id` | ✅ | new_owner=None prev=None |
| 33 | `validate_m1_security.py (cross-tenant isolation suite)` | ✅ | exit=0 · last: under  status=403   ✅ admin.anon_401  status=401  ============================================================ M1 SECURITY: 16/16 PASS  |

**Totale**: 33 step · ✅ 33 · ❌ 0

## 2 · DATI CREATI VIA UI/API REALI

### Contatti (creati via `POST /api/admin/tenants/{tid}/contacts`)

| Nome | Ruolo | Email | Telefono |
|------|-------|-------|----------|
| Mario Rossi | `founder` | mario.rossi@martinel.example | +39 3331112233 |
| Giulia Bianchi | `architect` | giulia.bianchi@martinel.example | +39 3334445566 |
| Luca Verdi | `purchasing` | luca.verdi@martinel.example | +39 3337778899 |

### Attività (create via `POST /api/admin/tenants/{tid}/activities/quick`)

| Tipo | Soggetto | Esito |
|------|----------|-------|
| `call` | Qualifica iniziale | Studio interessato, riprendere |
| `email` | Follow-up email | Inviato Master Deck |
| `whatsapp` | WhatsApp coordinamento | Conferma demo 16/06 |
| `linkedin` | Connect LinkedIn | Aggiunto in rete |
| `internal_note` | Nota interna onboarding | Tutto in linea |

### Overview KPI (snapshot post-creazione)

- `contacts_total`: **3**
- `activities_30d`: **24**
- `last_activity_at`: 2026-06-02T22:48:24.620610+00:00
- `tenant_relationship_owner`: **MOOD Admin**

## 3 · PROBLEMI RILEVATI

_Nessun problema architetturale o UX rilevato durante la validazione._

## 4 · COSA È STATO VERIFICATO IN MODO REALE

- ✅ Contact CRUD (create/list/get/patch/archive/restore via status filter)
- ✅ Relationship Owner (organization-level via `assign-owner`)
- ✅ Relationship Owner (contact-level via `/{cid}/assign-owner`)
- ✅ Search (per tenant via `?q=`, per contatto via `?q=`, globale via `/api/admin/search`)
- ✅ Filters (`role`, `status`)
- ✅ Set-primary toggle (`/{cid}/set-primary`)
- ✅ Catalog-driven taxonomy (roles, activity types, sources)
- ✅ Activity logging (5 reali, distribuiti tra i 3 contatti + 1 internal_note senza contact)
- ✅ Founder mirror via magic-link reale (sandbox log capture)
- ✅ Cross-tenant guard (founder JWT → admin CRM = 403/404)
- ✅ Founder D4 (owner change attempt stripped from PATCH payload)

## 5 · DECISIONE

🟢 **M1 È REALMENTE UTILIZZABILE.** I dati su cui M2 dovrà operare
sono stati generati naturalmente dal sistema attraverso le API pubbliche.
M2 può procedere senza alcun seed artificiale.
