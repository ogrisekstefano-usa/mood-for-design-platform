# CHAMELEON GOVERNANCE CLEANUP
**Data**: 2026-06-20  
**Sprint**: Chameleon Cleanup Sprint  
**Tipo**: Fix minimo — nessuna nuova feature, nessuna modifica architetturale  

---

## PROBLEMA

Blueprint Chameleon™ era classificato come step **critico** nell'Activation Foundation™ (passo 1/6).

Questo generava:
1. Un banner persistente su **ogni pagina** Blueprint finché Chameleon non veniva configurato
2. La piattaforma risultava `activated: False` per qualsiasi tenant che non configurava Chameleon
3. Chameleon influenza esclusivamente i Moodboard interni — zero effetto sul sito pubblico, CRM, DJ

---

## FIX APPLICATO

**File**: `/app/backend/routers/tenant_onboarding.py`

### 1. `_AF_CATALOGUE` — step "blueprint"

```python
# PRIMA
{
    "key": "blueprint",
    "title": "Blueprint Chameleon™",
    "critical": True,
}

# DOPO
{
    "key": "blueprint",
    "title": "Blueprint Chameleon™",
    "critical": False,
    "optional": True,   # CHAMELEON CLEANUP · non blocca l'attivazione
}
```

### 2. `get_activation_foundation` — calcolo `total` e `activated`

```python
# PRIMA
completed = sum(1 for i in items if i["done"])
total = len(items)
next_critical = next((i for i in items if i["critical"] and not i["done"]), None)

# DOPO
required_items = [i for i in items if not i.get("optional")]
completed = sum(1 for i in required_items if i["done"])
total = len(required_items)
next_critical = next((i for i in required_items if i["critical"] and not i["done"]), None)
```

---

## VERIFICA POST-FIX

```
completed=4/5  activated=False
next_action=workspace — Workspace attivo

  [DONE]    [CRITICAL] identity: Identità operativa
  [pending] [OPTIONAL] blueprint: Blueprint Chameleon™   ← non blocca più
  [DONE]               team: Team
  [DONE]    [CRITICAL] market: Mercato operativo
  [pending] [CRITICAL] workspace: Workspace attivo
  [DONE]    [CRITICAL] first_lead: Primo Lead
```

**Chameleon**: `[OPTIONAL]` — non compare nel `total` (5, non 6), non è il `next_action`.  
**Banner**: ora mostra "Workspace attivo" come prossimo step, non più "Blueprint Chameleon™".

---

## CHAMELEON: RIMANE ACCESSIBILE

Chameleon rimane completamente accessibile dalla sidebar Blueprint:
- **Percorso**: Settings → Studio Identity → Personalizza ogni dettaglio → Controlli (sezione Chameleon)
- **API**: `GET /api/blueprint/chameleon/active`, `PUT /api/blueprint/chameleon/active`
- Non è rimosso — è semplicemente non obbligatorio

---

## GATE FINALE

> **Un nuovo tenant risulta completo senza configurare Chameleon?**

| Step | Tipo | Senza Chameleon |
|------|------|-----------------|
| identity | CRITICAL | completabile |
| blueprint (Chameleon) | **OPTIONAL** | ignorabile |
| team | — | completabile |
| market | CRITICAL | completabile |
| workspace | CRITICAL | completabile |
| first_lead | CRITICAL | completabile |

**Un nuovo tenant può raggiungere `activated: True` completando i 5 step non opzionali, senza mai aprire Blueprint Chameleon.**

**GATE: PASS**

---

## CLASSIFICAZIONE FINALE CHAMELEON

| Elemento | Decisione | Motivazione |
|---------|-----------|-------------|
| Step nell'Activation Foundation | **OPTIONAL** | Non influenza sito pubblico, CRM, DJ |
| Banner persistente su Chameleon | **RIMOSSO** | Non appare più come `next_action` |
| Accessibilità dalla sidebar | **KEEP** | Funzionalità avanzata per workflow Moodboard |
| API `/api/blueprint/chameleon/*` | **KEEP** | Utilizzata dai Moodboard interni |
| Preset visivi (grain, vignette, ecc.) | **FUTURE** | Espansione potenziale al sito pubblico |
