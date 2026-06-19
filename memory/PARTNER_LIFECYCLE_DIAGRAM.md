# PARTNER LIFECYCLE DIAGRAM
## MOOD for DESIGN™ — Cicli di vita dei 4 casi partner

> **Data:** Giugno 2026  
> **Tabelle usate:** `leads`, `users_profile`, `design_journey_assignments`  
> **Nuove tabelle:** NESSUNA

---

## DIAGRAMMA PRINCIPALE — Ciclo di vita Partner

```
VISITATORE ANONIMO
        │
        │  compila /partner-application
        ▼
┌───────────────────────────────────────────────────────────┐
│                        leads                              │
│  lead_type = 'partner_application'                        │
│  status    = 'applied'                                    │
│  email, first_name, last_name, company_name               │
│  professional_category, collaboration_intent              │
│  market_sector, portfolio_url, metadata_json              │
└───────────────────────┬───────────────────────────────────┘
                        │
                   Studio review
                        │
              ┌─────────┴─────────┐
              │                   │
         Prosegue             Archivia
              │                   │
              ▼                   ▼
         status='review'    status='archived'
              │                   │
         Approvato?           FINE CICLO
              │
    ┌─────────┴──────────────┐
    │                        │
Accesso solo               Invito
come referenza             piattaforma
(status='approved')             │
    │                           ▼
    │              POST /api/members/invite
    │              { role: 'ad_partner' }
    │                           │
    │                 ┌─────────────────────┐
    │                 │    users_profile     │
    │                 │  role = 'ad_partner' │
    │                 │  status = 'invited'  │
    │                 │  metadata_json       │
    │                 │  .partner_lead_id    │ ← link a leads.id
    │                 │  = leads.id          │
    │                 └──────────┬──────────┘
    │                            │
    │                   Accetta invite
    │                            │
    │                 status = 'active'
    │                            │
    │                            ▼
    │               PARTECIPAZIONE A DESIGN JOURNEY
    │                            │
    │              ┌─────────────────────────────┐
    │              │  design_journey_assignments  │
    │              │  user_id = users_profile.id  │
    │              │  assignment_role = 'contributor'│
    │              │  client_visible = true       │
    │              └─────────────────────────────┘
    │
    └─────────────────────► UPGRADE RUOLO (opzionale)
                            PATCH /api/members/{id}
                            role: 'designer' | 'project_manager'
                            → Membro stabile del team
```

---

## CASO A — Solo candidatura (anonimo)

```
/partner-application
      │
      ▼
leads (lead_type='partner_application', status='applied')
      │
      └── Nessun users_profile
      └── Nessun auth.user
      └── Nessun account
      └── Nessun DJ
```

**Entità create: 1 (`leads`)**

---

## CASO B — Architetto porta un progetto cliente

```
Architetto Studio ABCD compila /partner-application
                │
                ▼
        leads_A (lead_type='partner_application')
        metadata_json.referred_client = 'Cliente XYZ'

Poi Cliente XYZ compila /begin-journey
                │
                ▼
        leads_B (lead_type='private_client')
        metadata_json.referred_by_partner_lead_id = leads_A.id
                │
                ▼ (flusso normale)
        accounts + contacts + design_journeys

Se l'architetto vuole entrare nel DJ → Caso C
```

**Entità create: 2 `leads` distinte (nessuna cross-contaminazione)**

---

## CASO C — Architetto invitato in un DJ

```
leads (partner_application, approved)
      │
      │  Studio: POST /api/members/invite { role: 'ad_partner' }
      ▼
users_profile (role='ad_partner')
      │
      │  Studio: POST /api/journeys/{id}/assignments
      │          { user_id, role: 'contributor' }
      ▼
design_journey_assignments (role='contributor', client_visible=true)
      │
      └── Permessi: READ projects + moodboards + inspirations
      └── Visibile al cliente (client_visible=true)
      └── Non ha owner del journey (owner è sempre un designer interno)
```

**Entità create: `users_profile` (1) + `design_journey_assignments` (1 per DJ)**

---

## CASO D — Membro stabile del team

```
leads → users_profile (ad_partner) → UPGRADE
                                          │
                PATCH /api/members/{id} { role: 'designer' }
                                          │
                                          ▼
                          users_profile (role='designer')
                                          │
                                          ▼
                    design_journey_assignments (owner / contributor)
                                          │
                                          └── Accesso completo come designer
                                          └── Appare nella sidebar team
                                          └── Visibile in /relations/designers
```

---

## SEPARAZIONE IDENTITÀ — Schema visivo

```
┌─────────────────────────────────────────────────────────────────┐
│                     SISTEMA MOOD for DESIGN™                    │
│                                                                 │
│  ┌───────────────────┐        ┌───────────────────────────────┐ │
│  │   CRM CLIENTI     │        │      PARTNER NETWORK          │ │
│  │                   │        │                               │ │
│  │  leads            │        │  leads                        │ │
│  │  lead_type=       │  ≠≠≠   │  lead_type=                   │ │
│  │  'private_client' │        │  'partner_application'        │ │
│  │       │           │        │        │                      │ │
│  │       ▼           │        │        ▼ (se invitato)        │ │
│  │  accounts         │        │  users_profile                │ │
│  │  lifecycle_stage  │        │  role='ad_partner'            │ │
│  │  prospect→customer│        │        │                      │ │
│  │       │           │        │        ▼ (se nel DJ)          │ │
│  │       ▼           │        │  design_journey_assignments   │ │
│  │  design_journeys  │        │  role='contributor'           │ │
│  │  (per il cliente) │        │                               │ │
│  └───────────────────┘        └───────────────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   TEAM INTERNO                          │   │
│  │  users_profile                                          │   │
│  │  role='designer' | 'project_manager' | 'tenant_admin'   │   │
│  │  NON presente in leads · NON presente in accounts       │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## LIFECYCLE STATUS COMPLETO — `leads` per partner

```
leads.status (per lead_type='partner_application'):

  'applied'   ← Creato al submit del form /partner-application
      │           Notifica interna allo studio
      ▼
  'review'    ← Azione manuale: Studio apre la candidatura
      │           Designer/Admin la esamina
      ├──────────────────────────────────────────────────────┐
      ▼                                                      │
  'approved'  ← Azione manuale: Studio approva              │
      │           Possibile invite a users_profile           │
      ▼                                                      │
  'active'    ← Collaborazione attiva                       │
                Collegato a users_profile via              │
                metadata_json.partner_lead_id               │
                                                            │
                                          'archived' ◄──────┘
                                           (in qualsiasi fase)
```

---

## REGOLE INVARIANTI

```
INVARIANTE 1: leads.lead_type = 'partner_application'
              NON viene mai promosso ad accounts.
              (accounts è solo per clienti)

INVARIANTE 2: users_profile esiste SOLO se il partner è stato
              esplicitamente invitato dallo studio.
              NON viene creato al submit del form.

INVARIANTE 3: design_journey_assignments.user_id
              punta SEMPRE a users_profile.id
              (mai a leads.id direttamente)

INVARIANTE 4: Un partner non può essere owner di un DJ.
              Solo designer/PM interni possono essere owner.
              (enforced da journey_assignments.py)

INVARIANTE 5: La tabella leads non viene modificata
              quando il partner viene invitato come users_profile.
              Il link è solo in metadata_json (unidirezionale).
```

---

*Documento creato: Giugno 2026 — PARTNER AUTH FIX SPRINT*  
*Basato su: `PARTNER_DATA_MODEL_AUDIT.md` v2.0 + analisi `core/journey_assignments.py`*
