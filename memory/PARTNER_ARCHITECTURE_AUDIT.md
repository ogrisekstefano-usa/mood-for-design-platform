# PARTNER ARCHITECTURE AUDIT
## MOOD for DESIGN™ — Studio Professional Partnership Sprint

> **Data:** Giugno 2026  
> **Obiettivo:** Analisi dello stato attuale del DB e codebase per determinare la strategia di riutilizzo dell'architettura esistente.

---

## 1. TABELLE ESISTENTI — STATO

| Tabella | Esiste | Schema rilevante | Usabilità per Partner |
|---------|--------|-----------------|----------------------|
| `leads` | ✅ | 35 colonne. Già include: `lead_type`, `professional_category`, `company_name`, `company_website`, `portfolio_url`, `collaboration_intent`, `market_sector`, `metadata_json`, `status`, `progression_state` | **ALTA** — riutilizzabile al 90% con estensione `lead_type` |
| `contacts` | ✅ (vuota) | Richiede `account_id NOT NULL` | **BASSA** — legata a CRM Account, non adatta |
| `accounts` | ✅ (vuota) | CRM accounts (company-level) | **BASSA** — per aziende clienti, non partner |
| `design_journeys` | ✅ (vuota) | Richiede `project_id NOT NULL` | **MEDIA** — per integrazione DJ fase 6 |
| `leads` | ✅ | Già supporta `lead_type = 'professional'` nel commento del router | **ESTENDIBILE** |
| `partner_applications` | ❌ | Non esiste | NON CREARE — leads è sufficiente |
| `partners` | ❌ | Non esiste | NON CREARE — vedi sotto |
| `journey_members` | ❌ | Non esiste | Da valutare per fase 6 |

---

## 2. SCHEMA COMPLETO `leads` — CAMPO PER CAMPO

```
leads:
  id                UUID PK
  tenant_id         UUID FK → tenants
  client_user_id    UUID (null)
  source            TEXT              → 'public_form' | 'partner_page'
  lead_type         TEXT              → 'private_client' | 'ad_partner' | 'PARTNER_APPLICATION' ← NUOVO
  status            TEXT              → 'new' | 'applied' | 'review' | 'approved' | 'active' | 'archived'
  score             INT
  first_name        TEXT              ← partner: nome
  last_name         TEXT              ← partner: cognome
  email             TEXT              ← partner: email
  phone             TEXT              ← partner: telefono
  country           TEXT              ← partner: area geografica
  city              TEXT              ← partner: città
  language          TEXT
  project_type      TEXT              ← partner: tipologia collaborazione
  notes             TEXT              ← partner: "Raccontaci come immagini una collaborazione"
  metadata_json     JSONB             ← partner: instagram, linkedin, collaboration_checkboxes
  professional_category TEXT          ← partner: architect|interior_designer|contractor|showroom|brand|artisan|developer
  collaboration_intent TEXT           ← partner: intento di collaborazione
  market_sector     TEXT              ← partner: settore
  company_name      TEXT              ← partner: Studio/Azienda
  company_website   TEXT              ← partner: Sito Web
  portfolio_url     TEXT              ← partner: URL portfolio
  progression_state TEXT              → 'lead' | 'partner' ← NUOVO VALORE
  pipeline_stage    TEXT
  runtime_identity  JSONB
  [+ altri 12 campi analytics/AI non rilevanti per partner]
```

**COPERTURA CAMPI FORM PARTNER:**

| Campo Form | Campo DB | Disponibile |
|-----------|---------|------------|
| Nome | `first_name` | ✅ |
| Cognome | `last_name` | ✅ |
| Studio / Azienda | `company_name` | ✅ |
| Email | `email` | ✅ |
| Telefono | `phone` | ✅ |
| Ruolo professionale | `professional_category` | ✅ |
| Sito Web | `company_website` | ✅ |
| Instagram | `metadata_json.instagram` | ✅ (JSONB) |
| LinkedIn | `metadata_json.linkedin` | ✅ (JSONB) |
| Area geografica | `city` + `country` | ✅ |
| Tipologia collaborazione | `collaboration_intent` | ✅ |
| Checkbox interessi | `metadata_json.interests[]` | ✅ (JSONB) |
| Testo libero | `notes` | ✅ |

**COPERTURA TOTALE: 100%** — Zero nuove colonne necessarie.

---

## 3. ESTENSIONE RICHIESTA — `lead_type`

Aggiungere il valore `'partner_application'` all'enum/check esistente:
- Nessuna migrazione strutturale necessaria (TEXT, non enum PG)
- Solo aggiornamento whitelist nel router `/api/storefront/public/{tenant}/begin`

```python
# leads.py — ALLOWED whitelist già include tutti i campi necessari
# Aggiungere solo 'instagram', 'linkedin' come alias → metadata_json
lead_type = 'partner_application'  # ← nuovo valore accettato
progression_state = 'partner'       # ← nuovo valore
status = 'applied'                  # ← stato iniziale partner
```

---

## 4. DESIGN JOURNEYS — INTEGRAZIONE PARTNER (Fase 6)

```
design_journeys:
  id           UUID PK
  tenant_id    UUID FK
  project_id   UUID NOT NULL  → FK a projects
  status       TEXT: 'in_progress'
  [+ altri campi schema incompleto — da verificare con insert selettivo]
```

**Strategia per aggiungere partner a un DJ:**
- `metadata_json.team_partners` array di oggetti `{lead_id, role, added_at}`
- Zero nuove tabelle
- Query: `SELECT * FROM design_journeys WHERE metadata_json->'team_partners' @> '[{"lead_id":"..."}]'`

---

## 5. BLUEPRINT — PARTNER NETWORK VIEW

**Strategia**: Nessuna nuova sezione DB. Aggiungere tab/sezione nel Blueprint frontend che filtra:

```javascript
// Blueprint → Partner Network
GET /api/leads?lead_type=partner_application&tenant_id={tid}
```

Il backend `leads.py` già supporta `lead_type` come parametro di filtro (linea 40-41).

---

## 6. COSA NON CREARE

| Elemento | Motivazione |
|---------|------------|
| Tabella `partners` | `leads` con `lead_type=partner_application` è sufficiente |
| Tabella `partner_applications` | `leads` copre il 100% dei campi |
| Tabella `journey_members` | `design_journeys.metadata_json.team_partners` è sufficiente |
| Tabella `prospects` | Non esiste, non serve |

---

## 7. SEPARAZIONE CUSTOMER FLOW vs PARTNER FLOW

```
CUSTOMER FLOW:
  /begin-journey → lead_type='private_client' → progression_state='lead'
  Blueprint: Leads → Prospects → Accounts → Clients
  
PARTNER FLOW:
  /partner-application → lead_type='partner_application' → progression_state='partner'
  Blueprint: Partner Network (tab separato, filtro lead_type)
  
REGOLA: Mai mostrare partner_application nei tab Leads, Prospects, Accounts, Clients
```

---

## 8. ROTTE & COMPONENTI DA CREARE

```
Frontend:
  /professionals           ← aggiornare ProfessionalsGatewayPage.jsx (copy + sezioni)
  /partner-application     ← NUOVO PartnerApplicationPage.jsx
  
Backend:
  POST /api/storefront/public/{tenant}/partner-apply   ← NUOVO endpoint dedicato
       (riutilizza logica di /begin, lead_type='partner_application')
  GET  /api/blueprint/partner-network                  ← NUOVO endpoint Blueprint
       (riutilizza leads con filtro lead_type='partner_application')
  
Blueprint:
  /blueprint/partner-network   ← NUOVA sezione frontend Blueprint
```

---

*Generato da analisi statica + introspezione DB live*  
*Schema leads verificato con insert/delete di test*
