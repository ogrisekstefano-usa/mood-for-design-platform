# DASHBOARD REFOCUS™ — Implementation Report (ITER181.A)

**Sprint:** ITER181.A · Founder Experience  
**Data chiusura:** 2026-06-01  
**Stato:** ✅ COMPLETATO · Backend 8/8 pytest PASS · Frontend 100% PASS · 0 ui_bugs residui  
**Tenant di riferimento:** `848354b9-a43e-4147-bdad-116fb93bd585`  
**Test reports:** `/app/test_reports/iteration_163.json`, `/app/test_reports/iteration_164.json`

---

## 1 · Obiettivo

Trasformare la dashboard da **piattaforma narrativa** a **sistema operativo dello studio di progettazione**:
- Rimuovere duplicazioni concettuali tra Activation Foundation e "Le prime mosse"
- Separare **setup workspace** (Activation %) da **attività operative** (Recommended Actions)
- Sostituire KPI editoriali con KPI business (Lead/Prospect/Clienti/Journey)
- Topbar CTA dinamica (Smart CTA) basata sullo stato del funnel
- Empty states educativi · copy professionale, esecutiva, mai poetica

---

## 2 · Fasi implementate

### Phase 1 · Remove Duplications ✅
Rimosso completamente:
- `<FirstMovesCards />` da `AtelierDashboardPage.jsx` (import + injection + logica `showStartCards` + `useGuidedTour` dipendente)
- Sezione "LE PRIME MOSSE · INIZIA DA QUI" e tutte le 5 card legacy (Accogli la prima relazione · Apri un Design Journey · Costruisci la libreria · Componi le tue atmosfere · Definisci il piano editoriale)

### Phase 2 · Activation Foundation Rework ✅
`_AF_CATALOGUE` ridotto a **5 step di solo setup workspace**:

| # | key | Titolo | CTA route |
|---|-----|--------|-----------|
| 0 | `identity` | Identità operativa | `/settings/identity` |
| 1 | `blueprint` | Blueprint Chameleon™ | `/settings` |
| 2 | `team` | Team | `/settings/members` |
| 3 | `market` | Mercato operativo | `/settings/identity` |
| 4 | `workspace` | Workspace attivo | `/workspace/projects` |

Rimossi dal foundation: `first_lead`, `first_prospect`, `first_journey` (sono attività operative, non setup).

### Phase 3 · Recommended Actions ✅
Nuovo blocco `<RecommendedActions />` (`/app/frontend/src/components/activation/RecommendedActions.jsx`) sotto Activation Foundation con 5 card:

| Card | CTA route | Modal opts |
|---|---|---|
| Registra un Lead | `modal:new-relationship` | `choice: 'lead'` |
| Qualifica un Prospect | `/relations/leads` | — |
| Apri una Design Journey | `modal:new-relationship` | `choice: 'prospect'` |
| Carica materiali | `/library` | — |
| Configura calendario editoriale | `/editorial/calendar` | — |

**Importante:** queste azioni NON influenzano la percentuale di attivazione.

### Phase 4 · Smart CTA Topbar ✅
`PrimaryCta` in `/app/frontend/src/components/layout/Topbar.jsx` ora legge `business_counts.prospects` da `useActivationFoundation`:

| Stato | data-testid | Label | Modal opts |
|---|---|---|---|
| prospects = 0 | `topbar-new-relationship-cta` | "Nuova Relazione" | `null` |
| prospects > 0 | `topbar-new-journey-cta` | "Nuovo Design Journey™" | `{ choice: 'prospect' }` |

Fixato il bug copy `nav.new_relationship` in `it-IT.json` (era erroneamente "Nuovo Design Journey™" — ora "Nuova Relazione").

### Phase 5 · Business Dashboard KPIs ✅
Hero KPI sostituiti completamente:

| Vecchio (rimosso) | Nuovo |
|---|---|
| `kpi-active` (Design Journey™ attivi) | `kpi-leads` (Lead) |
| `kpi-chapters` (Dossier in corso) | `kpi-prospects` (Prospect) |
| `kpi-voices` (In attesa di voce) | `kpi-customers` (Clienti) |
| `kpi-revisions` (Consegne della settimana) | `kpi-active-journeys` (Journey attive) |

Hero eyebrow: "Studio Pulse™ · Ritmo Progettuale" → "Dashboard operativa".  
Hero summary: "{leads} Lead · {prospects} Prospect · {journeys} Journey attive".  
Rimossa hero signature "Diamo forma a spazi belli.".

### Phase 6 · Empty States ✅
- "Journey attive" empty: *"Nessuna Journey attiva. Le Journey appariranno qui quando convertirai un Prospect."*
- "Attività recenti" empty: *"Nessuna attività registrata. Le attività appariranno qui quando inizierai a gestire relazioni e progetti."*
- "Prossime scadenze" empty: *"Nessuna scadenza in arrivo. Le scadenze appariranno qui quando avrai una Journey attiva con milestone configurate."*
- Rimossa colonna "Daily inspiration" (citazioni poetiche fuori tono); il `atd-desk` ora è 2-col.
- `RelationshipLiveTimeline`: copy aggiornata da "Vita relazionale / Memoria in evoluzione" → "Attività relazioni / Timeline relazioni".

---

## 3 · API consegnate / modificate

### `GET /api/tenant-onboarding/activation-foundation` (rework)
Risposta:
```json
{
  "tenant_id": "...",
  "items": [ /* esattamente 5 step: identity, blueprint, team, market, workspace */ ],
  "completed": <int 0-5>,
  "total": 5,
  "progress": <int 0-100>,
  "activated": <bool>,
  "next_action": <primo critical non done | null>,
  "business_counts": {
    "leads": <int>,
    "prospects": <int>,
    "customers": <int>,
    "active_journeys": <int>
  }
}
```

`business_counts` calcolati live da:
- `leads` → `leads` table
- `prospects` → `accounts.lifecycle_stage = 'prospect'`
- `customers` → `accounts.lifecycle_stage = 'customer'`
- `active_journeys` → `design_journeys.lifecycle_state NOT IN ('closed','abandoned')`

### `POST /api/tenant-onboarding/identity` (invariato)
Continua a funzionare (admin only, partial updates idempotent).

---

## 4 · File creati / modificati

### Creati
- `/app/frontend/src/components/activation/RecommendedActions.jsx`

### Modificati
- `/app/backend/routers/tenant_onboarding.py` (rework `_activation_state` → 5 step + nuova `_business_counts`)
- `/app/frontend/src/pages/dashboard/AtelierDashboardPage.jsx` (Hero KPI, no FirstMovesCards, no Inspiration, Recommended Actions, 2-col desk, empty states v2)
- `/app/frontend/src/components/layout/Topbar.jsx` (Smart CTA prospect-driven)
- `/app/frontend/src/components/dashboard/RelationshipLiveTimeline.jsx` (copy v2)
- `/app/frontend/src/i18n/strings/it-IT.json` (fix `nav.new_relationship` + seed nuove chiavi `atelier.dashboard.{hero,kpi,col,projects}.*_v2`)

### Backend test esistente
- `/app/backend/tests/test_iter180_activation_foundation.py` aggiornato dal testing agent per riflettere 5 step (8/8 PASS).

---

## 5 · Copy Governance · Tone of Voice

### Termini banditi confermati ASSENTI sulla dashboard
- ❌ atmosfera
- ❌ temperamento
- ❌ atelier interiore
- ❌ viaggio progettuale
- ❌ memoria in evoluzione (rimosso da `RelationshipLiveTimeline`)
- ❌ primo capitolo
- ❌ relazione che respira

### Vocabolario operativo adottato
Lead · Prospect · Cliente · Journey · Materiali · Attività · Progetto · Team · Workflow · Discovery · Workspace · Mercato.

**Tono:** professionale · internazionale · chiaro · credibile · executive. Mai poetico, mai teatrale, mai luxury-marketing.

> Nota: termini banditi residui esistono ancora in moduli **fuori scope** (Moodboard, Inspirations, Storefront, CulturalEditionReview). Non visibili dalla dashboard. Da gestire in sprint dedicato per ogni modulo.

---

## 6 · Criteri di accettazione · esito (testing agent v3)

| Criterio | Esito |
|---|---|
| FirstMovesCards rimosso dal dashboard | ✅ |
| Sezione "Il tuo studio inizia con cinque mosse" rimossa | ✅ |
| Activation Foundation a 5 step (setup only) | ✅ |
| Nessun legacy key (first_lead/first_prospect/first_journey) | ✅ |
| `business_counts` presente in risposta | ✅ |
| Recommended Actions con 5 card (data-testid stabili) | ✅ |
| Click `recommended-action-register-lead` apre modal CRM | ✅ |
| Click `recommended-action-open-journey` apre modal con choice=prospect | ✅ |
| Topbar smart CTA: prospects=0 → "Nuova Relazione" | ✅ |
| Topbar smart CTA: prospects>0 → "Nuovo Design Journey™" (logica) | ✅ |
| Hero KPI nuovi (Lead/Prospect/Clienti/Journey attive) | ✅ |
| Hero KPI legacy rimossi | ✅ |
| Inspiration column rimossa | ✅ |
| Empty states educativi (Journey/Attività/Scadenze) | ✅ |
| Nessuna delle 7 parole bandite visibile sulla dashboard | ✅ |
| Backend pytest | ✅ 8/8 |

---

## 7 · Limiti residui (out of scope)

Issue cosmetici pre-esistenti carried-over, non bloccanti, fuori scope ITER181.A:
- Console warning React "Cannot update a component while rendering" (Sidebar/LocalizationOverlay)
- Chiavi i18n `auth.login.*` e `auth.access.*` mancanti su schermata login
- Termini banditi ancora presenti in moduli **non-dashboard** (Moodboard, Inspirations, Storefront, Cultural)

---

**ITER181.A chiuso.** Dashboard ora opera come sistema operativo dello studio: lo stato del workspace è separato dalle azioni operative, il funnel CRM è il KPI principale, e la CTA topbar guida il founder dalla prima relazione alla prima Journey senza bivi narrativi.
