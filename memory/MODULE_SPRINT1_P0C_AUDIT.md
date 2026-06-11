# MODULE CONNECTION AUDIT — P0-C
# proposals.account_id — Audit Esecutivo con Impatto Reale
> Prodotto: 10 Jun 2026 · Dati reali da DB produzione

---

## 1. VERDETTO IMMEDIATO

> **`proposals.account_id` NON ESISTE come colonna nella tabella `proposals`.**
> Il check di sicurezza in `account_lifecycle.py` è strutturalmente disabilitato.
> L'impatto operativo oggi è ZERO (0 proposals in DB), ma il rischio è reale.

---

## 2. CONTEGGI REALI

| Metrica | Valore |
|---------|--------|
| Total `proposals` | **0** |
| Colonna `proposals.account_id` | ❌ NON ESISTE (errore DB: `42703`) |
| `account_lifecycle.py` check attivo | ❌ DISABILITATO di fatto |

---

## 3. ROOT CAUSE — Colonna Mai Creata

### Il check nel codice

In `account_lifecycle.py → convert_to_customer()` (riga 131):
```python
prop = pr.data[0]
if prop.get("account_id") and prop["account_id"] != account_id:
    raise HTTPException(422, "Proposal belongs to a different account")
```

### Perché è disabilitato

La query che carica la proposal è:
```python
pr = c.table("proposals").select("id, account_id, status, tenant_id")...
```

Questa query **fallisce silenziosamente** (ma non viene gestita come errore) oppure — come confermato dal DB — la colonna non esiste e la query restituisce solo le colonne esistenti (`id`, `status`, `tenant_id`). Il campo `account_id` non viene mai popolato nel dict `prop`, quindi `prop.get("account_id")` restituisce sempre `None` → la condizione è sempre `False` → il check non scatta mai.

**Comportamento effettivo**: chiunque abbia permesso `P_LEADS_WRITE` può passare `proposal_id` di qualsiasi proposta (anche di un altro account) e convertire un account a `customer` con una proposal altrui.

---

## 4. DATA FLOW — Percorso del Check Fallito

```
POST /api/accounts/{account_id}/convert-to-customer
  body: { proposal_id: "X", ... }
  
  ① Carica account → OK
  ② Verifica stage ∈ PROSPECT_SEMANTIC_STAGES → OK
  ③ Carica proposals WHERE id='X' AND tenant_id='T'
       SELECT id, account_id, status, tenant_id
       → account_id NON esiste come colonna
       → prop = {id: "X", status: "signed", tenant_id: "T"}
  ④ CHECK: prop.get("account_id") → None → condizione False → SKIP
  ⑤ Verifica status "signed/approved/won" → OK (se status è corretto)
  ⑥ UPDATE accounts.lifecycle_stage = 'customer' → ESEGUITO
  ⑦ accounts.signed_proposal_id = 'X' (proposal di un altro account) → ESEGUITO
```

---

## 5. IMPATTO REALE

| Scenario | Impatto | Attuale |
|----------|---------|---------|
| Proposals in DB | 0 | Nessun rischio operativo oggi |
| Proposals future (P1 rollout) | Integrità account→proposal | ⚠️ Rischio da gestire prima del primo uso |
| Cross-account proposal reuse | Un account può "rubare" la firma di un'altra proposta | ⚠️ Possibile (nessun guard) |
| Audit `funnel_events` | `funnel_events.lead_id = account.get("lead_id")` → sempre NULL su accounts CRM-only | ⚠️ (GAP-08) |

---

## 6. FIX PLAN

### Opzione A — Validazione via `project_id` (senza colonna)

Non aggiungere `account_id` a `proposals`, ma validare la relazione tramite la catena `proposals.project_id → design_journeys.project_id → design_journeys.account_id`:

```python
# In account_lifecycle.py — convert_to_customer()
if proposal_id:
    pr = c.table("proposals").select("id, project_id, status, tenant_id") \
         .eq("id", proposal_id).eq("tenant_id", tid).limit(1).execute()
    if not pr.data:
        raise HTTPException(404, "Proposal not found")
    prop = pr.data[0]
    
    # Verifica che la proposal appartenga a un progetto dell'account
    if prop.get("project_id"):
        dj = c.table("design_journeys").select("account_id") \
              .eq("project_id", prop["project_id"]).eq("tenant_id", tid) \
              .limit(1).execute()
        if dj.data and dj.data[0].get("account_id") != account_id:
            raise HTTPException(422, "Proposal belongs to a different account")
```

**Vantaggi**: Nessuna migrazione DB, sfrutta la catena esistente `proposal → project → journey → account`.  
**Limite**: Funziona solo se la proposal ha `project_id` e il project ha un journey associato.

---

### Opzione B — Aggiungere `account_id` a `proposals` (migration DB)

```sql
ALTER TABLE proposals ADD COLUMN account_id UUID REFERENCES accounts(id);
-- Backfill via project → journey → account
UPDATE proposals p
SET account_id = dj.account_id
FROM design_journeys dj
WHERE dj.project_id = p.project_id;
```

**Vantaggi**: FK esplicita, query più semplice.  
**Costo**: Migration Supabase, backfill, aggiornare `ProposalCreate` schema.

---

### Raccomandazione

Usare **Opzione A** come fix immediato (zero migration), poi valutare Opzione B se `proposals` diventa entità di primo livello.

---

## 7. PRIORITÀ RIVISTA

| Priorità originale | P0 |
|--------------------|----|
| Priorità rivista | **P1** — 0 proposals in DB, rischio futuro non attuale |
| Urgenza | Prima del primo uso di proposals in produzione |
| Effort | ~20 righe (Opzione A) |

---

*Audit P0-C — MODULE CONNECTION SPRINT 1*
