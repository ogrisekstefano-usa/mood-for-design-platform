# PARTNER ONBOARDING FLOW
## MOOD for DESIGN™ — Studio Professional Partnership

> **Data:** Giugno 2026

---

## FLOW COMPLETO: DAL SITO AL BLUEPRINT

```
Visitatore professionista
        │
        ▼
/professionals
  "Le migliori collaborazioni nascono da una visione condivisa."
  CTA Primaria: "Proponi una collaborazione" → /partner-application
  CTA Secondaria: "Entra nella rete professionale" → /partner-application#network
  CTA Finale: "Parliamo del prossimo progetto" → /partner-application
        │
        ▼
/partner-application
  [PartnerApplicationForm]
  Campi: Nome, Cognome, Studio, Email, Telefono, Ruolo
         Sito Web, Instagram, LinkedIn, Area geografica
         Tipologia collaborazione, Checkbox interessi, Testo libero
        │
        ▼
  POST /api/storefront/public/{tenant}/partner-apply
  → DB: leads { lead_type='partner_application', status='applied', progression_state='partner' }
        │
        ▼
  Confirmation Page / Feedback inline
  "Grazie — valuteremo la tua candidatura entro 5 giorni lavorativi."
        │
        ▼
  [SISTEMA INTERNO]
  Blueprint → Partner Network → status: 'applied'
        │
        ▼
  Studio Review
  status: 'applied' → 'review'
        │
        ▼
  Primo confronto (email / call)
  status: 'review' → 'approved'
        │
        ▼
  Partner attivo nella directory
  status: 'approved' → 'active'
  progression_state: 'partner' → 'active_partner'
        │
        ▼
  [OPZIONALE] Aggiunta a Design Journey
  design_journeys.metadata_json.team_partners[] += {
    lead_id: partner.id,
    role: 'architect' | 'contractor' | ...,
    added_at: timestamp
  }
```

---

## STATI DEL PARTNER

| Status | Descrizione | Visualizzazione Blueprint |
|--------|------------|--------------------------|
| `applied` | Form inviato, in attesa di revisione | Partner Network → In attesa |
| `review` | Studio sta valutando | Partner Network → In valutazione |
| `approved` | Partner approvato | Partner Network → Approvati |
| `active` | Collaborazione attiva, può entrare in DJ | Partner Network → Attivi |
| `archived` | Collaborazione conclusa o archiviata | Partner Network → Archivio |

---

## FORM PARTNER APPLICATION — STRUTTURA

### Sezione 1 — Identità Professionale
```
Nome *
Cognome *
Studio / Azienda *
Email professionale *
Telefono
```

### Sezione 2 — Profilo Online
```
Ruolo professionale * [select]
  □ Architetto
  □ Interior Designer
  □ Contractor
  □ Showroom
  □ Brand
  □ Artigiano
  □ Developer

Sito Web
Instagram (handle)
LinkedIn (URL)
```

### Sezione 3 — Contesto Geografico
```
Area geografica (città, regione o paese)
```

### Sezione 4 — Intenti di Collaborazione
```
Tipologia di collaborazione desiderata [select]
  □ Progetti Residenziali
  □ Progetti Hospitality
  □ Retail / Showroom
  □ Contract / Developer

Checkbox multipli:
  □ Vorrei collaborare su progetti residenziali
  □ Vorrei collaborare su progetti hospitality
  □ Vorrei proporre i miei servizi allo studio
  □ Vorrei ricevere opportunità da MOOD for DESIGN
  □ Vorrei entrare nella rete professionale

Raccontaci come immagini una collaborazione. [textarea]
```

### Sezione 5 — Invio
```
[Invia candidatura]

Note privacy: "I tuoi dati vengono utilizzati esclusivamente per valutare la collaborazione. 
Nessun dato viene condiviso con terzi."
```

---

## DB MAPPING FORM → LEADS TABLE

```json
{
  "lead_type":            "partner_application",
  "progression_state":    "partner",
  "status":               "applied",
  "source":               "professionals_page",
  "first_name":           "← input.nome",
  "last_name":            "← input.cognome",
  "company_name":         "← input.studio",
  "email":                "← input.email",
  "phone":                "← input.telefono",
  "professional_category": "← select.ruolo",
  "company_website":      "← input.sito_web",
  "city":                 "← input.area_geografica",
  "collaboration_intent": "← select.tipologia_collaborazione",
  "notes":                "← textarea.racconto",
  "metadata_json": {
    "instagram":           "← input.instagram",
    "linkedin":            "← input.linkedin",
    "interests":           "← checkboxes[]"
  }
}
```

---

## CONFIRMATION UX

Dopo il submit:
1. **Inline feedback** nella pagina form: icona check + messaggio
2. **Nessun redirect forzato** — il visitatore rimane su `/partner-application`
3. **Messaggio:**
   > "Candidatura ricevuta. Valuteremo il tuo profilo entro 5 giorni lavorativi e ti contatteremo all'indirizzo email fornito."

---

## DIFFERENZE RISPETTO AL CUSTOMER FLOW

| Aspetto | Customer Flow | Partner Flow |
|---------|--------------|--------------|
| Entry point | `/begin-journey` | `/partner-application` |
| Lead type | `private_client` | `partner_application` |
| Progression | lead → prospect → client | partner → approved → active |
| Blueprint section | Leads / Prospects / Accounts | Partner Network |
| DJ integration | Client del progetto | Membro del team / Fornitore |
| Onboarding guidato | Sì (wizard multi-step) | No (form singola pagina) |
| Budget/timeline | Richiesti | Non richiesti |
| Portfolio/azienda | Non richiesti | Richiesti |
