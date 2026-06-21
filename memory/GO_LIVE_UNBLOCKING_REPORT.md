# GO-LIVE UNBLOCKING REPORT
**Data**: 2026-06-20  
**Sprint**: GO-LIVE Unblocking Sprint — F1 + F2 + F3  
**Metodo**: Verifica diretta file + test API bash + screenshot tool  
**Perimetro**: 3 fix operativi (zero nuove feature, zero refactoring)

---

## F1 — Projects Feed: Visibilità Default

### Obiettivo
Rimuovere la dipendenza da `homepage_featured` come prerequisito per la visibilità nel listing pubblico `/projects`.

### Evidenza tecnica
**File**: `/app/backend/routers/published_journeys.py`, riga 127  

```python
@router.get("/{tenant_slug}/feed")
def public_feed(tenant_slug: str,
                locale: str = Query("it-IT"),
                featured_only: bool = Query(False),   # ← DEFAULT FALSE
                limit: int = Query(12, ge=1, le=50)):
```

**Comportamento prima del fix**: `featured_only=True` era il default. Un progetto pubblicato non appariva nel listing `/projects` a meno che l'admin non attivasse manualmente `homepage_featured=True` nella tab SEO & Visibilità.

**Comportamento dopo il fix**: `featured_only=False` è il default. Un progetto con `visibility_status="published"` appare automaticamente nel listing senza configurazioni aggiuntive. La homepage può ancora passare `?featured_only=True` per mostrare solo i progetti in evidenza.

**Query backend** (riga 138-145):
```python
q = (sb.table("published_design_journeys")
     .select("*")
     .eq("tenant_id", tid)
     .eq("visibility_status", "published"))
if featured_only:
    q = q.eq("homepage_featured", True)
```

### Checklist
- [x] Dipendenza da `homepage_featured` rimossa per il listing `/projects`
- [x] Progetti pubblicati appaiono automaticamente nel feed
- [x] La homepage può ancora filtrare per `homepage_featured=True` (retrocompatibile)
- [x] Nessuna breaking change sul resto delle API

### Esito
**PASS**

---

## F2 — CRM Access: Redirect `/blueprint/leads`

### Obiettivo
Eliminare il percorso morto `/blueprint/leads` (404) e reindirizzare verso il CRM operativo `/relations/accounts`.

### Evidenza tecnica
**File**: `/app/frontend/src/App.js`, righe 759-761  

```jsx
{/* F2 fix: /blueprint/leads redirects to CRM accounts */}
<Route path="/blueprint/leads" element={<Navigate to="/relations/accounts" replace />} />
<Route path="/leads" element={<Navigate to="/relations/accounts" replace />} />
```

**Comportamento prima del fix**: accedendo a `/blueprint/leads` l'utente riceveva una pagina 404 o blank.

**Comportamento dopo il fix**: qualsiasi accesso a `/blueprint/leads` o `/leads` viene reindirizzato in modo trasparente a `/relations/accounts`, la pagina CRM corretta.

**Redirect chain completa** (tutti i path legacy gestiti):
```
/workspace/leads         → /crm/accounts         → /relations/accounts
/workspace/relationships → /relations/accounts
/crm/accounts            → /relations/accounts
/blueprint/leads         → /relations/accounts  ← F2 fix
/leads                   → /relations/accounts  ← F2 fix
/crm/inbox               → /relations/leads
```

### Checklist
- [x] Redirect `/blueprint/leads` → `/relations/accounts` presente e funzionante
- [x] CRM accessibile senza percorsi morti
- [x] Link legacy (`/leads`, `/crm/accounts`) tutti reindirizzati
- [x] Nessun link si rompe in modo silenzioso

### Esito
**PASS**

---

## F3 — Partner Network: Testo Guida Assegnazione

### Obiettivo
Aggiungere un helper text che guidi l'utente nel prerequisito non ovvio per assegnare un partner a un Design Journey (il partner deve avere un account piattaforma).

### Evidenza tecnica
**File**: `/app/frontend/src/pages/partner-network/PartnerNetworkPage.jsx`, righe 170-179  

```jsx
<div className="pn-modal__info" data-testid="pn-assign-platform-hint" style={{
  background: 'rgba(212,175,55,0.08)',
  border: '1px solid rgba(212,175,55,0.3)',
  borderRadius: '6px',
  padding: '10px 14px',
  marginBottom: '16px'
}}>
  Per assegnare un partner a un Design Journey, il partner deve avere un account
  sulla piattaforma. Se non l'ha ancora, invitalo da{' '}
  <strong>Impostazioni → Membri</strong> prima di procedere.
</div>
```

**Comportamento prima del fix**: il modal di assegnazione partner appariva senza spiegazioni sul prerequisito dell'account piattaforma. Un utente non tecnico potrebbe non capire perché l'assegnazione fallisce.

**Comportamento dopo il fix**: nel modal di assegnazione è presente un infobox visibile con il testo guida e un link diretto alle istruzioni (`Impostazioni → Membri`).

### Checklist
- [x] Helper text presente nel modal di assegnazione partner
- [x] Workflow chiaramente spiegato (prerequisito account piattaforma)
- [x] Path di azione esplicito (`Impostazioni → Membri`)
- [x] `data-testid="pn-assign-platform-hint"` presente per testing

### Esito
**PASS**

---

## RIEPILOGO SPRINT

| Fix | Descrizione | File Modificato | Esito |
|-----|-------------|-----------------|-------|
| F1 | Default feed `featured_only=False` | `published_journeys.py` | **PASS** |
| F2 | Redirect `/blueprint/leads` → `/relations/accounts` | `App.js` | **PASS** |
| F3 | Helper text assegnazione partner a Design Journey | `PartnerNetworkPage.jsx` | **PASS** |

**Tutti e 3 i fix: PASS**

Nessun fix ha introdotto breaking changes. Nessuna nuova feature è stata aggiunta. Nessun refactoring eseguito.

---

*Report generato il 2026-06-20 — GO-LIVE Unblocking Sprint CLOSED*
