# 03_DATABASE_CLEANUP_PLAN.md
# MOOD for DESIGN™ — Pre-Deploy Database Cleanup Plan
> Versione: 1.0 — Audit runtime 2026-06-12
> Stato: PRONTO PER APPROVAZIONE
> Zero modifiche eseguite.

---

## OBIETTIVO

Rimuovere esclusivamente dati demo, test e placeholder.
Lasciare intatto l'ambiente Blueprint con admin, configurazioni e dati reali di sistema.

---

## 1. CLASSIFICAZIONE GLOBALE

### KEEP — Non toccare

| Categoria | Entità | Motivazione |
|-----------|--------|-------------|
| Tenant | Blueprint (848354b9) | Tenant produzione |
| Staff admin | admin@moodfordesign.com | Super Admin sistema |
| Staff advisor | ogrisekadvisor@gmail.com | Project Manager invitato |
| Advisor legacy | raffaella@moodfordesign.com | Advisor attivo |
| Advisor legacy | ogrisek.stefano@gmail.com | Advisor attivo |
| Config tenant | tenant_configuration (1 riga) | Config Blueprint |
| Config tenant | tenant_atelier_identity (1 riga) | Identità Atelier |
| Config tenant | tenant_email_settings (1 riga) | Config email |
| Config tenant | tenant_settings (8 righe) | Impostazioni |
| Config tenant | tenant_onboarding (1 riga) | Onboarding config |
| Config tenant | tenant_markets (8 righe) | Mercati attivi |
| Config tenant | tenant_memberships (1 riga) | Membership Blueprint |
| Atelier media | atelier_dashboard_media (13 righe Blueprint) | Media Atelier reali |
| Brand catalog | brands, brand_catalog_*, brand_detected_entities | Catalogo reale |
| Catalogo prodotti | products (784), product_sections (1171) | Catalogo reale |
| Editorial | editorial_blocks (1684), editorial_masters (42) | Contenuti reali |
| Media library | media_library (2562) | Asset reali |
| Lookup/config | countries, markets, cultural_descriptors, etc. | Dati sistema |
| Config tabelle | moodboard_chapters, moodboard_rooms | Config generiche |
| CMS | cms_pages, cms_sections, cms_page_revisions | Pagine sito |

### DELETE — Tutti i dati demo/test

**Blueprint tenant — dati CRM/journey test:**

| Tabella | Record da eliminare | Classificazione |
|---------|---------------------|-----------------|
| accounts | 20 | TUTTI test (Stef, Stef Rientro, GateTest, Lucia, Elena, TestCert, etc.) |
| leads | 15 | TUTTI test |
| contacts | 15 | TUTTI test |
| design_journeys | 19 | TUTTI test |
| projects | 21 | TUTTI test |
| discovery_interviews | 13 | TUTTI test |
| relationship_threads | 14 | TUTTI test |
| relationship_messages | 17 | TUTTI test |
| relationship_notifications | 67 | TUTTI test |
| human_assignments | 10 | TUTTI test |
| human_assignment_events | 10 | TUTTI test |
| funnel_events | 32 | TUTTI test |
| journey_milestones | 190 | TUTTI test |
| journey_briefs | 14 | TUTTI test |
| journey_timeline_events | 47 | TUTTI test |
| milestone_versions | 14 | TUTTI test |
| design_journey_assignments | 19 | TUTTI test |
| design_journey_assignment_events | 19 | TUTTI test |
| moodboards | 7 | TUTTI test |
| moodboard_pages | 7 | TUTTI test |
| moodboard_elements | 90 | TUTTI test |
| access_magic_links (Blueprint) | 3 | Link test generati |
| email_events (Blueprint) | 68 | Email test tracciate |
| audit_logs (Blueprint) | 70 | Log operazioni test |
| recall_requests | 1 | Richiesta test (ogriusa) |
| users_profile (role=client) | 9 | TUTTI client test |
| users (legacy, non-admin) | 1 (Blueprint) | Utente legacy test |

**Non-Blueprint tenants (44) — eliminazione completa:**

| Tenant | Slug | Conteggio |
|--------|------|-----------|
| Studio Verifica E2E | studio-verifica-e2e | 1 |
| Atelier P0 Final | atelier-p0-final | 1 |
| Studio Tenant Lifecycle | studio-tenant-lifecycle | 1 |
| Margraf USA | margraf-usa | 1 |
| Atelier Lifecycle | atelier-lifecycle | 1 |
| Studio Simulazione E2E | studio-simulazione-e2e × 4 | 4 |
| Martinel Interior Design | martinel-interior-design × 26 | 26 |
| Studio Hardening | hardening-1780373998 | 1 |
| Studio Completion | completion-... × 2 | 2 |
| **TOTALE** | | **44 tenant** |

Data correlata ai tenant non-Blueprint:
- users (legacy): 39 righe
- access_magic_links: 46 righe
- studio_email_dispatch_log: 275 righe (no tenant_id — delete tutti)

**auth.users da eliminare (9 account client test):**

| email | auth_user_id |
|-------|-------------|
| ogriusa@gmail.com | 30e6b309 |
| test.owner.a@example.com | 061d8eb4 |
| nuovo.1781151710@test.it | 6641a979 |
| lucia.ferri.certtest@gmail.com | 3fbad649 |
| elena.romano.cert2@gmail.com | f88d7e25 |
| cert.flow.1781225541@test.it | 2a34ad33 |
| testcert242@test.com | 5d96399a |
| direz242@test.com | 84758511 |
| p0gate.1781286727@example.com | c1dd971a |

---

## 2. RIEPILOGO NUMERI

### Blueprint tenant

| Stato | Tabella | Keep | Delete |
|-------|---------|------|--------|
| accounts | | 0 | **20** |
| leads | | 0 | **15** |
| contacts | | 0 | **15** |
| design_journeys | | 0 | **19** |
| projects | | 0 | **21** |
| journey_milestones | | 0 | **190** |
| journey_briefs | | 0 | **14** |
| journey_timeline_events | | 0 | **47** |
| milestone_versions | | 0 | **14** |
| design_journey_assignments | | 0 | **19** |
| design_journey_assignment_events | | 0 | **19** |
| discovery_interviews | | 0 | **13** |
| funnel_events | | 0 | **32** |
| relationship_threads | | 0 | **14** |
| relationship_messages | | 0 | **17** |
| relationship_notifications | | 0 | **67** |
| human_assignments | | 0 | **10** |
| human_assignment_events | | 0 | **10** |
| moodboards | | 0 | **7** |
| moodboard_pages | | 0 | **7** |
| moodboard_elements | | 0 | **90** |
| users_profile (client) | | 0 | **9** |
| access_magic_links | | 0 | **3** |
| email_events | | 0 | **68** |
| audit_logs | | 0 | **70** |
| recall_requests | | 0 | **1** |
| **TOTALE Blueprint** | | **0** | **1,011** |

### Non-Blueprint tenants e auth

| Categoria | Delete |
|-----------|--------|
| tenants non-Blueprint | **44** |
| auth.users non-staff | **9** |
| users (legacy) non-admin | **39** |
| access_magic_links non-BP | **46** |
| studio_email_dispatch_log | **275** |
| **TOTALE** | **413** |

**TOTALE RECORD DA ELIMINARE: ~1,424**

---

## 3. DIPENDENZE FK (catena completa)

```
tenants
  ├── accounts
  │     ├── contacts
  │     ├── human_assignments → human_assignment_events
  │     └── design_journeys → design_journey_assignments → design_journey_assignment_events
  │                         → journey_milestones → milestone_versions
  │                         → journey_briefs
  │                         → journey_timeline_events
  │
  ├── leads
  │     ├── discovery_interviews
  │     ├── funnel_events
  │     └── projects (projects.lead_id → leads)
  │             ├── moodboards → moodboard_pages
  │             │             → moodboard_elements
  │             └── project_stories
  │
  ├── relationship_threads (lead_id→leads, client_profile_id→users_profile)
  │     ├── relationship_messages
  │     └── relationship_notifications (lead_id→leads)
  │
  └── users_profile (role=client)
        └── (linked via auth.users.id)

auth.users
  └── users_profile (auth_user_id)
```

---

## 4. ORDINE CORRETTO DI ELIMINAZIONE

```
FASE 1 — Blueprint: foglie (tabelle senza figli da eliminare)
─────────────────────────────────────────────────────────────
 1.  relationship_messages        (17 righe)
 2.  design_journey_assignment_events  (19)
 3.  human_assignment_events      (10)
 4.  milestone_versions           (14)
 5.  funnel_events                (32)
 6.  relationship_notifications   (67)
 7.  moodboard_elements           (90)
 8.  moodboard_pages              ( 7)
 9.  email_events                 (68)
10.  audit_logs                   (70)  [opzionale]
11.  recall_requests              ( 1)
12.  access_magic_links           ( 3)

FASE 2 — Blueprint: tabelle intermedie
──────────────────────────────────────
13.  relationship_threads         (14)
14.  design_journey_assignments   (19)
15.  human_assignments            (10)
16.  journey_milestones           (190)
17.  journey_briefs               (14)
18.  journey_timeline_events      (47)
19.  discovery_interviews         (13)
20.  moodboards                   ( 7)

FASE 3 — Blueprint: core entities
───────────────────────────────────
21.  design_journeys              (19)
22.  contacts                     (15)
23.  projects                     (21)  ← prima di leads (FK projects.lead_id)
24.  leads                        (15)
25.  accounts                     (20)

FASE 4 — Blueprint: utenti
───────────────────────────
26.  users_profile WHERE role='client'  (9)
27.  users (legacy) non-admin           (1)

FASE 5 — auth.users (via Supabase)
────────────────────────────────────
28.  auth.users × 9 ID non-staff
     ⚠ RICHIEDE admin Supabase o service_role su schema auth

FASE 6 — Non-Blueprint tenants
────────────────────────────────
29.  Per ogni tabella con tenant_id: DELETE WHERE tenant_id NOT IN (Blueprint)
     Ordine: stesso di Fase 1-4 ma con filtro tenant
30.  users (legacy) non-Blueprint    (39)
31.  studio_email_dispatch_log       (275) [no tenant_id, delete tutti]
32.  access_magic_links non-Blueprint (46)
33.  DELETE FROM tenants WHERE id != Blueprint
```

---

## 5. RISCHI

| # | Rischio | Probabilità | Impatto | Mitigazione |
|---|---------|-------------|---------|-------------|
| R1 | FK violation se ordine sbagliato | Alta | Rollback | Rispettare ordine Fase 1→6 |
| R2 | auth.users richiede schema `auth` (non `public`) | Media | Blocco | Usare Supabase Dashboard > Authentication > Users |
| R3 | studio_email_dispatch_log senza tenant_id → delete totale | Bassa | Log persi | Accettato: sono log di test |
| R4 | moodboard_chapters/rooms sono config globali → NON eliminare | Alta | Rottura UI | Script esclude esplicitamente |
| R5 | media_library condivisa tra tenant | Media | Asset mancanti | Script non tocca media_library |
| R6 | advisor_profiles (3) → NON eliminare (staff) | Media | Rottura advisor | Script esclude advisor_profiles |
| R7 | Supabase CDC/realtime subscriptions attive | Bassa | Spike load | Eseguire in orario basso traffico |
| R8 | Non-Blueprint tenants con dati aggiuntivi non mappati | Bassa | Dati orfani | SQL usa WHERE tenant_id → cascade completo |

---

## 6. COSA NON VIENE TOCCATO

- `tenants` Blueprint (848354b9) — KEEP
- `users_profile` admin@moodfordesign.com — KEEP
- `users_profile` ogrisekadvisor@gmail.com — KEEP  
- `advisor_profiles` × 3 — KEEP
- `tenant_configuration`, `tenant_atelier_identity`, `tenant_email_settings` — KEEP
- `tenant_settings`, `tenant_onboarding`, `tenant_markets`, `tenant_memberships` — KEEP
- `atelier_dashboard_media` (13 Blueprint) — KEEP
- Tutto il catalogo: `brands`, `brand_catalog_*`, `products`, `editorial_*` — KEEP
- `media_library` (2562) — KEEP
- `moodboard_chapters`, `moodboard_rooms` (config) — KEEP
- Tabelle lookup: `countries`, `markets`, `locale_profiles`, `cultural_descriptors` — KEEP
- `notification_categories`, `platform_*` — KEEP
- `cms_pages`, `cms_sections` — KEEP
- `knowledge_graph_edges` (1155) — KEEP (catalogo semantico)

---

*Fine documento — 03_DATABASE_CLEANUP_PLAN.md*
*Nessuna modifica eseguita. Attendere approvazione.*
