# CLIENT_MODEL_CONSOLIDATION.md
> Sprint: NEXT-STABILIZATION · Extra obbligatorio
> Data: 11 giugno 2026
> Tipo: DOCUMENTO TECNICO — analisi + proposta
> Stato: IN ATTESA DI APPROVAZIONE

---

## 1. I TRE SISTEMI ATTUALI

### Sistema 1 — Public Journey (BeginJourneyPage)
**Percorso:** Sito pubblico → form multi-step → journey immediato

| Dati raccolti | Campo DB | Tabella |
|---|---|---|
| first_name, last_name | `accounts.primary_contact_name` split | `accounts` |
| email | `accounts.email`, `contacts.email` | `accounts`, `contacts` |
| phone | `contacts.phone` | `contacts` |
| how_to_feel, references | `design_journeys.atmosphere_json` | `design_journeys` |
| space_kinds, guests | `design_journeys.lifestyle_json` | `design_journeys` |
| materials, ambiance | `design_journeys.lifestyle_json` | `design_journeys` |
| Creazione auth.user + profilo | `users_profile` (role=client) | `users_profile` |

**Caratteristica:** Crea TUTTO in una transazione + async provisioning. Il cliente non è autenticato durante la compilazione.

---

### Sistema 2 — Lead Blueprint (CRM interno)
**Percorso:** Admin CRM → crea lead → qualifica → start-journey → provision client

| Dati raccolti | Campo DB | Tabella |
|---|---|---|
| first_name, last_name | `leads.first_name`, `leads.last_name` | `leads` |
| email | `leads.email` | `leads` |
| phone | `leads.phone` | `leads` |
| source, lead_type | `leads.source`, `leads.lead_type` | `leads` |
| project_type, timeline, budget | `leads.qualification_json` | `leads` |
| → Account creato da lead | `accounts.primary_contact_name` | `accounts` |
| → Profilo cliente creato | `users_profile` (role=client) | `users_profile` |

**Caratteristica:** Processo manuale. Dati duplicati: `leads.*` E `accounts.*` E `users_profile.*` — tre copie dello stesso cliente.

---

### Sistema 3 — Brief Guidato (non ancora esistente)
**Percorso:** Client Portal (post-auth) → form guidato → brief strutturato

**STATO ATTUALE:** NON ESISTE come flusso dedicato.

I dati di brief sono raccolti nello Step 2-3 del Public Journey (Pre-auth) e salvati come `atmosphere_json` e `lifestyle_json` nei `design_journeys`. Questo è un brief INFORMALE, non strutturato.

---

## 2. CAMPI DUPLICATI (MAPPA COMPLETA)

| Dato | `leads` | `accounts` / `contacts` | `users_profile` | Fonte di verità |
|---|---|---|---|---|
| Email | `leads.email` | `accounts.email`, `contacts.email` | `users_profile.email` | ❌ NESSUNA (3 copie) |
| Nome | `leads.first_name` / `last_name` | `accounts.primary_contact_name` (concatenato) | `users_profile.first_name` / `last_name` | ❌ NESSUNA (3 copie) |
| Telefono | `leads.phone` | `contacts.phone` | non presente | ❌ 2 copie |
| Lingua | — | — | `users_profile.preferred_locale_code` | OK (unica) |
| Owner referente | `human_assignments.assignee_user_id` | — | — | OK (unica) |
| Owner journey | `design_journey_assignments.user_id` | — | `projects.assigned_to` | ❌ 2 sistemi paralleli |
| ID collegamento | `leads.first_journey_id` | `design_journeys.account_id` | `projects.client_user_id` | ❌ 3 riferimenti distinti |

---

## 3. CAMPI INCOERENTI

| Campo | Incoerenza |
|---|---|
| `accounts.email` vs `users_profile.email` | Possono divergere se l'account viene creato prima del provisioning e poi l'email cambia |
| `design_journeys.account_id` vs `projects.client_user_id` | Due sistemi di ownership paralleli — uno per account (B2B), uno per user profile (auth) |
| `leads.qualification_json` vs `design_journeys.atmosphere_json` | Brief duplicato — uno pre-journey (lead stage), uno nel journey (dopo creazione) |
| `projects.assigned_to` vs `design_journey_assignments.owner` | Due colonne che dovrebbero dire la stessa cosa: chi segue il progetto |

---

## 4. IL PROBLEMA NARRATIVO (non solo tecnico)

Come descritto dall'utente:
> "MOOD oggi racconta tre storie diverse allo stesso cliente."

Concretamente:
- Un cliente che arriva dal sito pubblico vede il **Public Journey flow** — emozionale, cinematico
- Un cliente inserito manualmente dall'admin vede il **Lead Blueprint flow** — burocratico, transazionale
- Un cliente che compila il brief post-auth vedrebbe il **Brief Guidato** — ancora da costruire

Il problema non è tecnico. È che non esiste UN SOLO modello cliente che attraversa tutti i touchpoint in modo coerente.

---

## 5. PROPOSTA SINGLE SOURCE OF TRUTH

### Il modello unificato

```
auth.users (Supabase)          ← identità permanente (email, password/magic link)
     ↓ 1:N per tenant
users_profile                  ← profilo operativo (role, nome, locale, bio)
     ↓ 1:N 
accounts                       ← entità commerciale (privato/azienda)
     ↓ 1:N
projects                       ← progetto specifico (residential, retail, etc.)
     ↓ 1:1
design_journeys                ← journey operativo (milestone, moodboard, etc.)
```

### Regola di derivazione

| Dato | Fonte di verità | Tutti gli altri sono derivati |
|---|---|---|
| Email cliente | `users_profile.email` | `accounts.email` si sincronizza da `users_profile` |
| Nome cliente | `users_profile.first_name` + `last_name` | `accounts.primary_contact_name` è solo un alias |
| Referente | `design_journey_assignments` (role=owner) | `projects.assigned_to` viene deprecato |
| ID collegamento | `projects.client_user_id` (FK users_profile) | `design_journeys.account_id` resta per queries B2B |

### Cosa eliminare (o marcare deprecated)

| Campo | Azione |
|---|---|
| `projects.assigned_to` | Deprecare — usare `design_journey_assignments.owner` |
| `leads.*` (dopo conversione) | I lead convertiti in client mantengono `leads` solo come storico, non come fonte dati |
| `design_journeys.atmosphere_json` + `lifestyle_json` | Migrare nel Brief Guidato (post-auth, strutturato) |

---

## 6. PERCORSO UNIFICATO — PROPOSTA

```
[TOUCHPOINT 1 — SCOPERTA]
  Sito pubblico → BeginJourneyPage
  Cliente compila: nome, email, telefono → SOLO anagrafica
  Dati atomici, immediati.
  
[TOUCHPOINT 2 — ACCOGLIENZA]
  Sistema crea:
  → account → project → design_journey (lifecycle: conversation_open)
  → users_profile (role=client) + magic link
  → Email: "Il tuo spazio progettuale è pronto"
  
[TOUCHPOINT 3 — INGRESSO]
  Cliente clicca magic link → /auth/client/callback
  → Sessione client installata
  → Redirect a /client/welcome

[TOUCHPOINT 4 — BRIEF GUIDATO]  ← DA COSTRUIRE
  /client/brief → form guidato post-auth
  Cliente esprime: atmosfera, lifestyle, spazio, mercato
  Salvato in: client_brief_responses (tabella dedicata, versioned)
  NON in design_journeys.atmosphere_json (formato libero, non strutturato)

[TOUCHPOINT 5 — JOURNEY OPERATIVO]
  Designer attiva il journey: lifecycle → active
  Milestones operative: moodboard, materiali, proposta
  Dati brief già strutturati → disponibili al designer

[TOUCHPOINT 6 — PROPOSTA]
  Moodboard → Proposta → approvazione cliente → contratto
```

---

## 7. GAP DA COLMARE (in ordine di priorità)

| # | Gap | Azione | Stima |
|---|---|---|---|
| G1 | `users_profile.email` non viene sempre sincronizzata | Sync in `provision_client_after_journey()` — già parzialmente implementato | Piccolo |
| G2 | `projects.assigned_to` parallelo a `dja.owner` | Deprecare `assigned_to`, aggiornare queries che lo usano | Medio |
| G3 | Dati brief in `design_journeys.atmosphere_json` | Creare `client_brief_responses` + migrazione | Grande |
| G4 | `leads.*` duplica `accounts.*` dopo conversione | Marcare `leads` come storico, non come fonte dati operativa | Medio |
| G5 | Brief Guidato non esiste come percorso post-auth | Nuovo modulo client portal | Grande |
| G6 | `accounts.email` non sincronizzata con `users_profile.email` | Trigger/sync in provisioning | Piccolo |

---

## 8. RACCOMANDAZIONE

**Non costruire G3, G4, G5 finché G1 e G2 non sono stabili.**

L'ordine corretto:
1. ✅ F1: Session fix (fatto)
2. ✅ F3: Hardcoded purge (fatto)
3. ✅ F4: Messaging chain (fatto)
4. ✅ F5: Email validation (fatto)
5. **Prossimo:** G2 — deprecare `projects.assigned_to`, allineare i due sistemi di ownership
6. **Poi:** G5 — Brief Guidato come modulo dedicato post-auth

**La regola operativa:**

Prima che MOOD possa raccontare UNA storia al cliente, deve avere UN SOLO posto dove cercare chi è quel cliente, e UN SOLO posto dove capire chi lo segue.

Oggi non è così. Gli sprint sopra sono il percorso per arrivarci.
