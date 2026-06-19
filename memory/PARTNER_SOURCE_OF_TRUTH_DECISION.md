# PARTNER SOURCE OF TRUTH DECISION
## MOOD for DESIGN™ — Decisione Architetturale Definitiva

> **Data:** Giugno 2026  
> **Stato:** PROPOSTA — in attesa di approvazione utente  
> **Prerequisito:** `PARTNER_DATA_MODEL_AUDIT.md` (v2.0)

---

## PRINCIPIO GUIDA

**Una persona esiste una sola volta nel sistema.**  
Poi assume ruoli differenti in contesti diversi.

```
                    UNA SOLA IDENTITÀ
                          │
              ┌───────────┼───────────┐
              │           │           │
           Cliente     Partner    Team Member
              │           │           │
           accounts    leads       users_profile
           (prospect/  (partner_   (designer /
           customer)   application) project_manager)
```

---

## DECISIONE DEFINITIVA

### Source of Truth per fase:

| Fase del Partner | Source of Truth | Tabella | Campo discriminante |
|---|---|---|---|
| **1 · Candidatura** | `leads` | `leads` | `lead_type = 'partner_application'` |
| **2 · In Review** | `leads` | `leads` | `status = 'review'` |
| **3 · Approvato** | `leads` | `leads` | `status = 'approved'` |
| **4 · Accesso Piattaforma** | `users_profile` | `users_profile` | `role = 'ad_partner'` |
| **5 · Partecipazione DJ** | `design_journey_assignments` | `design_journey_assignments` | `assignment_role = 'contributor'` |
| **6 · Membro Stabile** | `users_profile` | `users_profile` | `role = 'designer' \| 'project_manager'` |

---

## REGOLA FONDAMENTALE DI SEPARAZIONE

### FLUSSO CLIENTE
```
leads.lead_type IN ('private_client', 'ad_partner')
  → Promozione a → accounts
  → accounts → contacts + design_journeys
  → accounts.lifecycle_stage: prospect → in_proposal → customer
```

### FLUSSO PARTNER
```
leads.lead_type = 'partner_application'
  → Rimane in leads (non viene MAI promosso ad accounts)
  → Appare SOLO in Blueprint → Partner Network (vista filtrata)
  → Se approvato e invitato: leads → users_profile.role = 'ad_partner'
  → Partecipazione: design_journey_assignments.assignment_role = 'contributor'
```

**Un partner NON è mai un account. Un account cliente NON è mai un partner.**

---

## COME DISTINGUERE LE IDENTITÀ

| Persona | Entità primaria | Campo | Valore |
|---|---|---|---|
| Visitatore interessato (privato) | `leads` | `lead_type` | `'private_client'` |
| Professionista candidato | `leads` | `lead_type` | `'partner_application'` |
| Cliente attivo (ha un DJ) | `accounts` | `lifecycle_stage` | `'customer'` |
| Partner con accesso limitato | `users_profile` | `role` | `'ad_partner'` |
| Designer interno | `users_profile` | `role` | `'designer'` |
| Admin dello studio | `users_profile` | `role` | `'tenant_admin'` |
| Advisor commerciale | `advisor_profiles` | (tabella separata) | - |

---

## TABELLA DI NON-DUPLICAZIONE

```
REGOLA 1: Una persona → una sola riga in leads (per candidatura)
          Deduplicazione via: email + tenant_id UNIQUE (da implementare)

REGOLA 2: Una persona → una sola riga in users_profile per tenant
          Garantito da: members.py riga 239-243 (controllo email + tenant_id)

REGOLA 3: Un utente → max 1 assignment ATTIVO per journey
          Garantito da: journey_assignments.py riga 186-192 (existing check)

REGOLA 4: Un partner con users_profile mantiene il link alla sua candidatura
          Via: users_profile.metadata_json.partner_lead_id = leads.id
```

---

## CASI LIMITE

### "Il partner era già un cliente"
```
Scenario: Mario Rossi è sia cliente che partner.
Soluzione: Due entità distinte per due contesti diversi.
  - accounts.id = <cliente> (il suo progetto di arredo)
  - leads.id = <partner> (la sua candidatura come architetto)
  - Collegamento opzionale: leads.metadata_json.client_account_id = accounts.id
```

### "Il partner compila /partner-application due volte"
```
Scenario: Giulia Bianchi invia due candidature.
Soluzione: leads.email UNIQUE per tenant (da aggiungere come soft-check nel backend)
  - Primo submit: create
  - Secondo submit: return existing lead (aggiornare metadata, non duplicare)
```

### "Il partner porta un progetto cliente"
```
Scenario: Studio ABCD porta il cliente XYZ.
Soluzione:
  - leads (Studio ABCD, lead_type='partner_application')
  - leads (Cliente XYZ, lead_type='private_client')
  - leads.metadata_json.referred_by = leads.id di Studio ABCD
```

---

## PERCHÉ NON UNA NUOVA TABELLA

Argomenti contro una tabella `partner_profiles`:

1. **Senza FK obbligatori** — `leads` è già standalone. Aggiungere una tabella è overhead senza vantaggio.
2. **lead_type esiste già** — Il campo è progettato esattamente per questa eterogeneità.
3. **Zero costo di migrazione** — Nessuna migration, nessun downtime, nessun rischio.
4. **Coerenza** — Le viste Blueprint esistenti (CRM) già filtrano per `lead_type`. Aggiungere `partner_application` è un cambio da 0 a 1 in termini di complessità.
5. **`ad_partner` esiste già** — Il ruolo per l'accesso piattaforma è già nel RBAC. Zero schema change.

---

## DECISIONE: APPROVATA/RESPINTA?

Questa proposta attende conferma dell'utente prima di qualsiasi implementazione.

Le domande aperte sono:

1. ✅ o ❌ **La candidatura va in `leads.lead_type = 'partner_application'`?**
2. ✅ o ❌ **Un partner approvato diventa `users_profile.role = 'ad_partner'`?**
3. ✅ o ❌ **Il Partner Network in Blueprint è una vista filtrata di `leads`?**
4. ✅ o ❌ **Un partner nel DJ ha `design_journey_assignments.role = 'contributor'`?**

---

*Documento creato: Giugno 2026 — PARTNER AUTH FIX SPRINT*  
*Basato su: `PARTNER_DATA_MODEL_AUDIT.md` v2.0*
