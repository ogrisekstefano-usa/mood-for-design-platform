# CRM PHASE 1 · IMPLEMENTATION REPORT
## ITER177.B · Nuova Relazione™ + Discovery Interview™ + Account → Journey

> **Status:** ✅ SHIPPED · 31 May 2026
> **Riferimento architettura:** `CRM_LIFECYCLE_CANON.md`, `CRM_LIFECYCLE_IMPLEMENTATION_PLAN.md`, `DESIGN_JOURNEY_CANON.md §18`
> **Test:** showroom flow end-to-end verificato via curl + screenshot Playwright

---

## §1 · DELIVERABLE CONSEGNATI

### 1.1 · Database
- ✅ **Migration `114_discovery_interviews.sql`** — applicata
  - Enum `discovery_status` (`pending | in_progress | qualified | unqualified | recycled`)
  - Tabella `discovery_interviews` (15 colonne, FK a `tenants`, `leads`, `users_profile`)
  - 3 indici (`lead`, `tenant_status`, `tenant_source`)
  - Trigger `touch_discovery_updated_at`
  - **Backfill:** ogni `leads.status='qualified'` esistente ha già la sua riga `discovery_interviews(qualified)`
  - View `v_discovery_stats` per audit/dashboard

### 1.2 · Backend
| File | Endpoints | Stato |
|---|---|---|
| `/app/backend/routers/discovery.py` (nuovo) | 7 endpoint sul lifecycle Discovery | ✅ |
| `/app/backend/routers/account_journeys.py` (nuovo) | `POST /api/accounts/{aid}/journeys` | ✅ |
| `/app/backend/routers/leads.py` (esteso) | `POST /api/leads/dedup-check`, `GET /api/leads/search` | ✅ |
| `/app/backend/routers/blueprint_chameleon.py` (nuovo) | 3 endpoint alias (vedi `BLUEPRINT_CHAMELEON_R1_REPORT.md`) | ✅ |
| `/app/backend/routers/journey_initiate.py` (patch) | emette `discovery_interviews(qualified, source='public_form')` esplicito | ✅ |

#### Endpoint Discovery (completi)
```
POST   /api/leads/{lid}/discovery         # crea/restituisce row pending
GET    /api/leads/{lid}/discovery         # ultimo record per lead
POST   /api/discovery/{did}/start         # pending → in_progress
PUT    /api/discovery/{did}               # autosave notes + signals
POST   /api/discovery/{did}/qualify       # → qualified + crea account(prospect)
POST   /api/discovery/{did}/disqualify    # → unqualified (con reason)
POST   /api/discovery/{did}/recycle       # unqualified → recycled
GET    /api/discovery/{did}               # get singolo
```

#### Endpoint Account → Journey (5 regole canon enforced)
```
POST   /api/accounts/{aid}/journeys       # body: {kickoff_note?, title?, force?}
```
- **R1** Lega sempre `account_id` (✅ enforced via signature)
- **R2** `account.lifecycle_stage ∈ ('prospect','in_proposal','customer')` → 400 `ACCOUNT-INVALID-STAGE`
- **R3** Permission `projects:write` → 403 se mancante
- **R4** Soft-check su discovery qualified (warning log se assente, non blocco — backfill può avere gap)
- **R5** Max 1 journey attiva per account → 409 `JOURNEY-ALREADY-ACTIVE` con `existing_journey_id`. Bypass con `?force=true`.

#### Side effects su qualify
- `leads.status = 'qualified'`
- `accounts(lifecycle_stage='prospect')` creato o aggiornato (idempotente)
- `discovery_interviews.metadata_json.qualified_account_id` settato
- Log strutturato `discovery.qualified discovery=... lead=... account=...`

### 1.3 · Frontend
| File | Ruolo |
|---|---|
| `/app/frontend/src/components/relations/NewRelationshipModal.jsx` (nuovo) | Modal 3-way (Lead · Prospect · Customer) |
| `/app/frontend/src/components/relations/DiscoveryInterviewPanel.jsx` (nuovo) | Inline panel Discovery con autosave |
| `/app/frontend/src/hooks/useNewRelationship.jsx` (nuovo) | Provider + hook globale per aprire il modal da qualsiasi superficie |
| `/app/frontend/src/components/layout/Sidebar.jsx` (patch) | Bottone CTA `+ Nuova Relazione` in alto |
| `/app/frontend/src/App.js` (patch) | `<NewRelationshipProvider>` montato globalmente |

### 1.4 · Server registration
`/app/backend/server.py` linee ~170-180 — registrazione di `blueprint_chameleon`, `discovery`, `account_journeys`.

---

## §2 · TEST · SHOWROOM FLOW END-TO-END

### Esecuzione automatica (curl)
```
Lead created       → id 965137a7-… status=new
Discovery opened   → id 172aee8b-… status=pending
Discovery start    → status=in_progress
Discovery qualify  → status=qualified · account_id 4a394879-… (prospect)
Journey created    → id 8e11cb68-… lifecycle_state=conversation_open
Second journey     → HTTP 409 (R5 enforced)
```

### Esecuzione frontend (Playwright)
- ✅ Login admin
- ✅ Sidebar mostra CTA `+ Nuova Relazione`
- ✅ Click → modal apre con 3 scelte (Lead, Prospect, Cliente)
- ✅ Layout pulito, copy `"Da dove vuoi iniziare?"` allineata a tone canon

Screenshots: `/tmp/modal_final.png`.

---

## §3 · DEDUP CHECK · PROTECTION

Endpoint `POST /api/leads/dedup-check`:
- **Email exact** → score 1.0, ricerca su `leads` + `accounts`
- **Phone fuzzy** (ultimi 8 digit, normalizzati) → score 0.85 su `leads`
- **First name prefix** (≥3 char) → score 0.5 come fallback

Lato UI (`NewRelationshipModal.jsx`):
- Trigger automatico `onBlur` su email/phone
- Banner ammonitivo `data-testid="new-relationship-dedup-warning"` quando match presente
- 2-step submission: 1° click esegue dedup-check, 2° click bypassa (con etichetta "Crea comunque")

---

## §4 · GLOBAL SEARCH INTEGRATION™ — Cmd+K (parziale)

### Implementato
- ✅ `GET /api/leads/search?q=…&limit=10` per autocomplete globale
- ✅ Modal `NewRelationshipModal` accetta `prefill` dal provider per popolare i form

### Non implementato in questa iterazione
- ⏸ Comando palette Cmd+K visivo (richiede nuovo componente sopra la sidebar)
  - Soluzione corrente: la ricerca avviene **dentro** la modale `Choice B/C` (prospect/customer)
- ⏸ Hotkey listener globale

Roadmap: nel prossimo sprint si può aggiungere un `CmdKPalette` che invoca lo stesso hook `useNewRelationship().open({prefill})`.

---

## §5 · BACKWARD COMPATIBILITY

| Vecchio path | Stato |
|---|---|
| `POST /api/public/journeys/initiate` | ✅ funziona + ora crea anche `discovery_interviews(qualified, source='public_form')` |
| Vecchi CTA "Nuova Journey" / "Inizia il tuo viaggio" nel Topbar | 🟡 **ancora presenti** — task di rimozione successivo |
| `leads.first_journey_id` colonna | 🟡 **deprecated audit-only**, lasciata sul DB |

---

## §6 · LIMITAZIONI NOTE

| Limitazione | Mitigazione |
|---|---|
| `lifecycle_state` usa il vecchio enum DB (`conversation_open`, `in_progress`, …). Il canon `DESIGN_JOURNEY_CANON §3` parla di `opened, discovery, concept, …`. | Migration enum target rimandata a successivo sprint. Mapping `conversation_open ↔ opened` lato UI. |
| `account_journeys.py` ha **soft-check R4** (warning invece di blocco) | Coerente con backfill non completo. Da promuovere a hard-check quando 100% backfill verificato. |
| Vecchie CTA "Nuova Journey" sparse non rimosse | Task `C2` (cleanup) — pianificato nel prossimo sprint. |

---

## §7 · ENDPOINT CATALOG (riassunto)

```
GET    /api/blueprint/chameleon/presets
GET    /api/blueprint/chameleon/active
PUT    /api/blueprint/chameleon/active

POST   /api/leads                          # (esistente) crea lead
GET    /api/leads/{lid}                    # (esistente)
POST   /api/leads/dedup-check              # ITER177.B nuovo
GET    /api/leads/search                   # ITER177.B nuovo

POST   /api/leads/{lid}/discovery          # ITER177.B nuovo (crea/get)
GET    /api/leads/{lid}/discovery          # ITER177.B nuovo
POST   /api/discovery/{did}/start          # ITER177.B nuovo
PUT    /api/discovery/{did}                # ITER177.B nuovo (autosave)
POST   /api/discovery/{did}/qualify        # ITER177.B nuovo (side fx: prospect)
POST   /api/discovery/{did}/disqualify     # ITER177.B nuovo
POST   /api/discovery/{did}/recycle        # ITER177.B nuovo
GET    /api/discovery/{did}                # ITER177.B nuovo

POST   /api/accounts/{aid}/journeys        # ITER177.B nuovo (R1-R5 enforced)
```

---

## §8 · PROSSIMI PASSI (non in questa iterazione)

1. Rimuovere ogni vecchio CTA "Nuova Journey" / "Inizia il tuo viaggio" / "Begin Journey" lato studio
2. Cmd+K command palette globale con prefill modale
3. Enum `account_lifecycle_stage` normalizzato (P3 plan §3.2)
4. Promozione manuale Prospect → Customer (legata a `signed_proposal_id`)
5. `POST /api/accounts/{aid}/put-on-hold` / `/resume` / `/churn`
6. UI per scenario E (partner referral) — assegnazione automatica `ad_partner`

---

**Fine report. Sprint chiuso, attesa user verification.**
