# PARTNER NETWORK IMPLEMENTATION PLAN
## MOOD for DESIGN™ — Studio Professional Partnership Sprint

> **Data:** Giugno 2026  
> **Versione architetturale:** Riutilizzo massimo — ZERO nuove tabelle DB

---

## PIANO A 6 FASI

### FASE 1 — UX/Copy + Hero (`/professionals`)
**Effort:** M (3-4 ore)  
**File:** `ProfessionalsGatewayPage.jsx`, `professionals.css`, seed CMS

**Azioni:**
- [x] Aggiornare copy hero: nuova headline + subheadline
- [x] Sostituire immagine hero con foto autentica (architettura reale)
- [x] Aggiornare CTA primaria: "Proponi una collaborazione" → `/partner-application`
- [x] Aggiornare CTA secondaria: "Entra nella rete professionale" → `/partner-application`
- [x] Aggiornare CTA finale: "Parliamo del prossimo progetto" → `/partner-application`
- [x] Rimuovere ogni riferimento a "consulenza cliente" dal copy
- [x] Aggiornare sezione ProProcess: CTA → `/partner-application`
- [x] Aggiornare sezione ProCollaborators: CTA → `/partner-application`

**Nota CMS:** Aggiornare `cms_sections` della pagina `professionals` + ripubblicare.

---

### FASE 2 — Nuove sezioni pagina `/professionals`
**Effort:** L (5-6 ore)  
**File:** `ProfessionalsGatewayPage.jsx`, `professionals.css`

**Nuovi componenti JSX:**

**A. `PartnerTypesGrid` — Chi collabora con noi**
```
Card grid (3×2 o 2×3):
  [Architetti]  [Interior Designer]  [Contractor]
  [Showroom]    [Brand]              [Developer]
Ogni card: icona lineare + label + mini-descrizione 1 riga
```

**B. `PartnerCaseStudies` — Progetti sviluppati insieme**
```
3 mini-card orizzontali:
  [Logo Partner] + [Studio MOOD for DESIGN]
  → Titolo progetto
  → Risultato (1 riga)
Contenuto: placeholder fino a dati reali in CMS
```

**C. `PartnerProcess` — Come nasce una collaborazione**
```
Timeline verticale/orizzontale 4 step:
  1. Applicazione
  2. Valutazione (5 gg lavorativi)
  3. Primo confronto
  4. Collaborazione attiva
```

**CSS:** Nuove classi in `professionals.css`, nessun impatto su altri componenti.

---

### FASE 3 — Backend endpoint partner-apply
**Effort:** S (1-2 ore)  
**File:** `backend/routers/leads.py` (o nuovo `backend/routers/partners.py`)

**Strategia:**
Aggiungere endpoint pubblico dedicato che riutilizza la logica di `/begin`:

```python
# POST /api/storefront/public/{tenant}/partner-apply
@router.post("/public/{tenant_slug}/partner-apply")
async def partner_apply(tenant_slug: str, body: dict, request: Request):
    """
    Endpoint dedicato per le candidature partner.
    
    Differenze da /begin:
    - Forza lead_type='partner_application'
    - Forza progression_state='partner'  
    - Forza status='applied'
    - Accetta: instagram, linkedin (→ metadata_json)
    - Non genera onboarding_url
    """
```

**Campi aggiuntivi da gestire:**
- `instagram` → `metadata_json.instagram`
- `linkedin` → `metadata_json.linkedin`
- `interests` (array) → `metadata_json.interests`
- `area_geografica` → `city` + `country`

---

### FASE 4 — Frontend Partner Application Form
**Effort:** L (4-5 ore)  
**File:** `src/pages/site/PartnerApplicationPage.jsx` (NUOVO)  
**Route:** `/partner-application`

**Struttura del form:**
- Design: stesso stile di `/begin-journey` ma layout form singola pagina (non wizard)
- Sezioni: 5 section accordion o sequential scroll
- Validazione client-side: email, campi required
- Submit → POST `/api/storefront/public/studio/partner-apply`
- Success state: messaggio inline, no redirect

**Route da aggiungere in `App.js`:**
```javascript
<Route path="/partner-application" element={<PartnerApplicationPage />} />
```

---

### FASE 5 — Blueprint: Partner Network section
**Effort:** M (3-4 ore)  
**File:** `src/pages/blueprint/PartnerNetworkPage.jsx` (NUOVO)  
**Backend:** `GET /api/blueprint/partners` (NUOVO filtro su leads)

**Funzionalità:**
- Tab nel Blueprint nav: "Partner Network"
- Lista partner applicants con filtri per status
- Scheda partner: dati di contatto + professional_category + interests
- Action buttons: review → approved → active
- KPI header: Totale / In attesa / Approvati / Attivi

**Backend endpoint:**
```python
GET /api/blueprint/partners?status=applied&tenant_id={tid}
# → SELECT * FROM leads WHERE lead_type='partner_application'
```

---

### FASE 6 — DJ Integration
**Effort:** M (3-4 ore)  
**File:** `design_journeys` table via `metadata_json`, Blueprint DJ view

**Implementazione:**
1. Partner approvato appare in un "Directory" picker nella UI Blueprint DJ
2. Il PM può aggiungere un partner al team del DJ → `metadata_json.team_partners[]`
3. Il partner compare nella scheda DJ come "Membro esterno"

```python
# PATCH /api/blueprint/journeys/{dj_id}/team/add-partner
body: { partner_lead_id: str, role: str }
# → update design_journeys.metadata_json.team_partners += {lead_id, role, added_at}
```

**Condizione:** Solo partner con `status='approved'|'active'`

---

## PRIORITY ORDER

```
[P0 — Lancia subito]
  FASE 1: Copy + CTA professionisti (nessun DB, solo frontend + CMS)
  FASE 4: Form partner application (frontend only, POST endpoint)
  FASE 3: Backend partner-apply endpoint

[P1 — Completa il funnel]
  FASE 2: Nuove sezioni pagina
  FASE 5: Blueprint Partner Network

[P2 — Dopo primo partner approvato]
  FASE 6: DJ Integration
```

---

## FILES SUMMARY

### Nuovi file da creare
| File | Tipo | Fase |
|------|------|------|
| `src/pages/site/PartnerApplicationPage.jsx` | React | F3 |
| `src/pages/site/partner-application.css` | CSS | F3 |
| `src/pages/blueprint/PartnerNetworkPage.jsx` | React | F5 |

### File da modificare
| File | Modifica | Fase |
|------|---------|------|
| `ProfessionalsGatewayPage.jsx` | Copy + CTA + nuove sezioni | F1+F2 |
| `professionals.css` | Nuove classi sezioni | F1+F2 |
| `App.js` | Aggiungere route `/partner-application` | F3 |
| `backend/routers/leads.py` | Aggiungere endpoint partner-apply | F3 |

### Script CMS
| Script | Fase |
|--------|------|
| `scripts/seed_professionals_partner.py` | F1 — aggiorna CMS professionals page |

---

## VINCOLI ARCHITETTURALI RISPETTATI

| Vincolo | Status |
|---------|--------|
| Nessuna nuova tabella | ✅ leads esteso |
| Nessuna duplicazione identità | ✅ un solo record lead per partner |
| Partner ≠ CRM clienti | ✅ filtro lead_type, tab Blueprint separato |
| Partner → DJ team | ✅ via metadata_json.team_partners |
| CUSTOMER FLOW ≠ PARTNER FLOW | ✅ endpoint, progression_state, Blueprint section separati |
