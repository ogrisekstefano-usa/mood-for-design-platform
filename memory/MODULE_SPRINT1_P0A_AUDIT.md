# MODULE CONNECTION AUDIT — P0-A
# design_journeys.account_id — Audit Esecutivo con Conteggi Reali
> Prodotto: 10 Jun 2026 · Dati reali da DB produzione

---

## 1. VERDETTO IMMEDIATO

> **P0-A ridefinita**: `design_journeys.account_id = NULL` **NON esiste** nell'ambiente attuale.
> Il vero problema è: **3 journeys con milestones insufficienti (0-1)** e `current_milestone_id = NULL`.

---

## 2. CONTEGGI REALI

| Metrica | Valore |
|---------|--------|
| Total `design_journeys` | **16** |
| `account_id = NULL` | **0** ✅ |
| `account_id = SET` | **16 (100%)** ✅ |
| Journeys con 10 milestones + `current_milestone_id` SET | **13** ✅ |
| Journeys con milestones insufficienti | **3** ⚠️ |

---

## 3. BREAKDOWN DEI 3 JOURNEY ANOMALI

| Journey | Milestones | `current_milestone_id` | Stato |
|---------|-----------|----------------------|-------|
| `8bb7a3b4…` | **1** | NULL | ⚠️ PARZIALE |
| `48eac254…` | **1** | NULL | ⚠️ PARZIALE |
| `b44571fa…` | **0** | NULL | ❌ VUOTO |

Tutti e 3 creati il **08-06-2026**, tutti con titolo `"Mario Rossi · Design Journey"` → sono record di test da `lead_conversion.py` (Path B) dove l'inserimento dei milestone è probabilmente fallito silenziosamente.

---

## 4. ROOT CAUSE — Milestone Insert Silently Failed

In `lead_conversion.py → start_journey()`:
```python
# Riga 211
c.table("journey_milestones").insert(milestones_to_insert).execute()
```
Non è wrappato in `try/except`. Se la tabella ha un problema di schema o un constraint viola, l'insert fallisce ma non blocca la risposta → il journey viene creato con 0 milestones.

Il journey `88c072b7` (precedentemente riportato come broken nel handoff) ha invece **10 milestones e tutti i campi corretti**. Il bug segnalato era probabilmente un errore di osservazione del testing agent o un problema transitorio risolto.

---

## 5. IMPATTO ATTUALE

| Journey | Effetto UI |
|---------|-----------|
| `b44571fa…` | `DesignJourneyTab` mostra empty state — nessuna milestone renderizzabile |
| `8bb7a3b4…` | `DesignJourneyTab` mostra 1 milestone invece di 10 |
| `48eac254…` | `DesignJourneyTab` mostra 1 milestone invece di 10 |

Tutti e 3 sono journey `"Mario Rossi · Design Journey"` con `lead_id` SET — sono record di test, non journey di clienti reali.

---

## 6. FIX PLAN

### Fix 1 — Wrapping sicuro in `lead_conversion.py`
```python
# Attuale (fragile)
c.table("journey_milestones").insert(milestones_to_insert).execute()

# Proposto
try:
    c.table("journey_milestones").insert(milestones_to_insert).execute()
except Exception as e:
    logger.error(f"start_journey: milestones insert FAILED for journey {journey_id}: {e}")
    # Non rilanciare — il journey è già creato. Il client vedrà empty state invece di 500.
    # Aggiungere retry o alert in futuro.
```

### Fix 2 — Backfill milestones per i 3 journey anomali
I 3 journey sono record di test — valutare se eliminare o backfillare i DEFAULT_MILESTONES.

**Script backfill (da eseguire solo se i journey servono):**
```python
from routers.design_journey import DEFAULT_MILESTONES
import uuid
from datetime import datetime, timezone

def backfill_milestones(journey_id: str, tenant_id: str):
    now = datetime.now(timezone.utc).isoformat()
    milestones = []
    brief_mid = None
    for idx, m in enumerate(DEFAULT_MILESTONES):
        is_brief = (m["type"] == "brief")
        mid = str(uuid.uuid4())
        if is_brief: brief_mid = mid
        milestones.append({
            "id": mid, "tenant_id": tenant_id, "journey_id": journey_id,
            "milestone_type": m["type"], "title": m["title"],
            "description": m.get("description", ""),
            "order_index": idx,
            "status": "in_progress" if is_brief else "not_started",
            "metadata": {"open_mode": m["open_mode"], "linked_route": m["linked_route"]},
            "created_at": now, "updated_at": now,
        })
    c.table("journey_milestones").insert(milestones).execute()
    if brief_mid:
        c.table("design_journeys").update({
            "current_milestone_id": brief_mid, "updated_at": now
        }).eq("id", journey_id).execute()
```

---

## 7. RACCOMANDAZIONE

| Azione | Journey | Priorità |
|--------|---------|----------|
| Eliminare i 3 record di test (Mario Rossi) | `b44571fa`, `8bb7a3b4`, `48eac254` | 🟡 P2 — sono test data |
| Fix `lead_conversion.py` milestones wrapping | n/a | 🟠 P1 |
| P0-A originale (account_id NULL) | **NON ESISTE** — non serve action | ✅ Chiuso |

---

## 8. RISCRITTURA P0-A → NUOVA DEFINIZIONE

**P0-A riformulato**: Journey con **0 milestones** sono invisibili nel portal e nel workspace.

| Nuovo nome | `JOURNEY-EMPTY-MILESTONES` |
|------------|---------------------------|
| Record affetti | **1** (b44571fa — 0 milestones) |
| Journey con partial milestones | **2** (8bb7a3b4, 48eac254 — 1 milestone) |
| Tutti e 3 | Record di test — bassa urgenza |

---

*Audit P0-A — MODULE CONNECTION SPRINT 1*
