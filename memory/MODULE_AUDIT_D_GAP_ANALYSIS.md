# MODULE CONNECTION AUDIT — DOCUMENTO D: GAP ANALYSIS
> Prodotto: 10 Jun 2026 · Audit statico completo del codebase

---

## 1. Gap Critici (P0)

### GAP-01 · `projects.client_user_id` non settato su Path B, C, D

**Impatto**: Il client portal filtra i progetti via `projects.client_user_id = profile_id`. Tutti i journey creati via CRM (path B: lead_conversion, path C: account_journeys, path D: project-first) **non compaiono nel portal del cliente**.

**Superfici affette**:
- `GET /api/client/overview` → zero_data: true
- `GET /api/client/journeys` → zero_data: true
- `GET /api/client/moodboards` → vuoto
- `GET /api/client/approvals` → vuoto

**Workaround attuale**: `welcome-summary` usa `accounts.email` come fallback (diverso meccanismo, non allineato agli altri endpoint).

**Dati a rischio**: Tutti i journey creati manualmente dal designer (path C + B) non sono mai visibili al cliente nel portal, a meno che `client_provisioning.py` non sia stato eseguito manualmente.

---

### GAP-02 · `design_journeys.account_id = NULL` su record storici (Path D)

**Impatto**: `GET /api/journeys/{jid}/overview` — quando `account_id` è NULL, non può caricare l'account. `DesignJourneyTab` mostra milestone list vuota.

**Root cause**: Path D (`/api/projects/{pid}/journey`) legge `account_id` da `projects.metadata_json.account_id`. Se il project è stato creato senza questo campo (prima di ITER173), il journey nasce con `account_id = NULL`.

**Caso noto**: journey `88c072b7` — `account_id = NULL` + `milestones_flat = []` (dangling milestone ID).

**Dati a rischio**: Tutti i journey pre-ITER173 creati via workspace (path D).

---

### GAP-03 · `proposals.account_id` assente

**Impatto**: `account_lifecycle.py → convert_to_customer` esegue il check:
```python
if prop.get("account_id") and prop["account_id"] != account_id:
    raise HTTPException(422, "Proposal belongs to a different account")
```
Siccome `proposals.account_id` non è una colonna, `prop.get("account_id")` restituisce sempre `None` → la condizione è sempre falsa → **il check è disabilitato di fatto**. Una proposta di un altro account potrebbe essere usata per convertire qualsiasi account a customer.

**Dati a rischio**: Integrità della transizione Prospect → Customer.

---

## 2. Gap Significativi (P1)

### GAP-04 · `leads` creato NON-blocking nel path A

**Impatto**: In `journey_initiate.py`, l'insert di `leads` è avvolto in `try/except` (non-blocking). Se fallisce, il CRM non ha traccia di questo prospect. L'account esiste ma la pipeline CRM mostra `leads count = 0` per quell'utente.

**Condizione di trigger**: Errori DB temporanei, schema divergence, campi non validi.

**Workaround attuale**: Nessuno. Il fallimento è silenzioso (solo log).

---

### GAP-05 · `accounts.email` deduplicazione assente su percorsi multipli

**Impatto**: Due path diversi possono creare due account con la stessa email:
- Path A (`journey_initiate`) → crea sempre un nuovo account
- Path B (`lead_conversion/start-journey`) → verifica `legacy_lead_id`, non l'email

Se un utente completa sia il form pubblico (Path A) che viene convertito via CRM (Path B), esistono due account con la stessa email. Il portal mostra il più recente via email match.

**Dati a rischio**: Duplicazione account, profili cliente incompleti.

---

### GAP-06 · `design_journeys.owner_user_id` non populato su Path A e B

**Impatto**: Journey senza designer assegnato. Solo Path C chiama `ensure_owner()`. Gli altri path lasciano `owner_user_id = NULL` → gli endpoint che filtrano per owner non trovano il journey.

**Tabella affetta**: `journey_assignments` non riceve una riga per questi journey.

---

### GAP-07 · `moodboards.journey_id` non sempre settato

**Impatto**: Moodboard creati dal workspace studio (`POST /api/moodboards`) ricevono solo `project_id`. `journey_id` è nullable e spesso NULL. Gli endpoint concept-directions del portal (`GET /api/client/journeys/{jid}/concept-directions`) filtrano per `journey_id` → moodboard studio non compaiono al cliente.

**Superfici affette**: `client_concept_feedback`, `client_list_concept_directions`.

---

### GAP-08 · `accounts.lead_id` vs `accounts.legacy_lead_id` — naming inconsistente

**Impatto**: Il link Lead → Account usa `legacy_lead_id` (colonna), ma `funnel_events` usa `lead_id` (non FK formale su accounts). `account_lifecycle.py` `funnel_events.lead_id = account.get("lead_id")` → questa colonna non esiste sugli account → `funnel_events.lead_id = None` per tutti gli account creati via path C.

**Tabelle affette**: `funnel_events`, tracciabilità audit pipeline.

---

## 3. Gap Minori (P2)

### GAP-09 · 4 template diversi per `projects.title`

**Impatto**: Nomi progetto non uniformi. Difficoltà identificazione nei log e nelle UI. Nessun impatto funzionale.

---

### GAP-10 · Cultural profile triplicato (leads / projects.metadata_json / journey_briefs)

**Impatto**: Se il cliente aggiorna le preferenze atmosferiche dopo la creazione del journey, i tre campi divergono. La UI del portal mostra dati vecchi da `projects.metadata_json`.

---

### GAP-11 · `proposal_signoffs.project_id` vs `proposal_signoffs.client_user_id`

**Impatto**: La signoff usa `project_id` come FK ma non verifica che il client che firma sia il `projects.client_user_id` del progetto. Un admin potrebbe firmare per conto di qualsiasi client.

---

### GAP-12 · `discovery_interviews.lead_id` — nullable senza FK formale

**Impatto**: `discovery_interviews` usa `lead_id` come reference, ma non è una FK DB. Se un lead viene eliminato, le discovery_interviews diventano orfane silenziosamente.

---

## 4. Duplicazioni e Campi Ridondanti

| Campo | Tabelle duplicate | Causa | Rischio |
|-------|-------------------|-------|---------|
| `email` | `leads`, `accounts`, `contacts`, `users_profile` | Ogni entità cattura l'email autonomamente | Divergenza se l'utente cambia email |
| `first_name`/`last_name` | `leads`, `contacts`, `users_profile` | Creazione in fasi separate | Discrepanze anagrafiche |
| `atmosphere_signals` | `leads`, `projects.metadata_json`, `journey_briefs` | Cattura su step diversi | Profilo culturale non aggiornato nel portal |
| `pipeline_stage` | `leads.pipeline_stage`, `leads.progression_state`, `leads.status` | Evoluzione iterativa del modello | Confusione sul campo canonico |
| `account_id` | `design_journeys` (colonna), `moodboards` (best-effort), `proposals` (assente), `projects.metadata_json` (fragile) | Propagazione inconsistente | Ownership resolution fallisce |
| `tenant_id` | Ogni tabella | Corretto per multi-tenancy | Nessuno — è by design |

---

*Audit statico — MODULE CONNECTION AUDIT*
