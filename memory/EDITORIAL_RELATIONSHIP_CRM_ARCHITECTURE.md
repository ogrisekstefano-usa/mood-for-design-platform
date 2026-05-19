# Editorial Relationship CRM™ — Architecture Document

> "Architecture first. Generic CRM patterns must be rejected immediately."
>
> _Direttiva MOOD for DESIGN™ · Feb 2026_

---

## 0 · Filosofia

Il CRM di MOOD for DESIGN™ **non è** uno strumento di vendita. È
un **layer di orchestrazione internazionale delle relazioni** per
luxury interiors, hospitality, architettura, specification ed
editoriale Made-in-Italy.

### Linguaggio rifiutato (vocabolario CRM generico)

| ❌ Generic CRM       | ✅ Editorial Relationship   |
|----------------------|------------------------------|
| Contact              | Relationship                 |
| Lead                 | Discovery                    |
| Opportunity          | Active Direction             |
| Deal                 | Collaboration                |
| Funnel / Pipeline    | Relationship Journey™        |
| Lead Source          | Discovery Origin             |
| Deal Stage           | Collaboration Stage          |
| Follow-up            | Editorial Follow-up          |
| Won/Lost             | Active / Long-term / Closed  |
| Conversion Rate      | Direction Crystallization    |
| Touch Point          | Relational Surface           |
| Sales Cycle          | Editorial Cadence            |

Tutto il sistema parla questo linguaggio — non solo le label UI, ma
anche table names, API namespaces, event types.

---

## 1 · Relationship Entity Model

### 1.1 Tabella `accounts` (entità primaria)

Già esistente, va estesa con i campi editoriali sotto. Una row =
una relazione orchestrabile (privato, studio, showroom, hotel
group, yacht client, luxury retail, partner brand).

**Campi attuali (mantenere):**
- `id`, `tenant_id`, `account_name`, `account_type`, `lifecycle_stage`
- `city`, `country`, `email`, `phone`
- `relationship_health` (canonical: healthy · stable · needs_support · at_risk · dormant)
- `primary_owner_id`
- `mood_dominant`, `market_submarket`, `next_followup_at`, `signal_snapshot`
- `last_activity_at`

**Campi nuovi (migration 053):**
```sql
ALTER TABLE accounts
  ADD COLUMN cultural_profile        TEXT,
  ADD COLUMN hospitality_positioning TEXT,
  ADD COLUMN preferred_atmosphere    JSONB DEFAULT '[]',
  ADD COLUMN preferred_materials     JSONB DEFAULT '[]',
  ADD COLUMN editorial_register      TEXT,   -- "concierge" | "editorial" | "consultative"
  ADD COLUMN discovery_origin        JSONB DEFAULT '{}',
  ADD COLUMN luxury_perception_tier  TEXT,   -- "atelier" | "couture" | "prêt-à-porter"
  ADD COLUMN preferred_locale        TEXT,
  ADD COLUMN relationship_graph      JSONB DEFAULT '{}'; -- denormalized linkages
```

### 1.2 Tabella `contacts` (persone)

Una relazione (Account) può avere molti Contacts. Mantieni come è —
contacts NON sono Team. Sono persone esterne (architetti, decision
maker, designer dello studio cliente, project manager dell'hotel).

### 1.3 Tabella `editorial_engagement` (NUOVA)

**Questa è la differenza chiave dal CRM generico.** Ogni
interazione editoriale viene loggata qui — non solo "ha aperto la
mail", ma "ha letto questo articolo, in questa edizione di mercato,
con questo CTA al fondo".

```sql
CREATE TABLE editorial_engagement (
  id              UUID PRIMARY KEY,
  tenant_id       UUID NOT NULL,
  account_id      UUID REFERENCES accounts(id),
  contact_id      UUID REFERENCES contacts(id),
  resource_type   TEXT NOT NULL, -- 'article' | 'moodboard' | 'material' | 'project' | 'edition'
  resource_id     UUID NOT NULL,
  resource_meta   JSONB,  -- snapshot of edition/locale/cluster at engagement time
  signal          TEXT NOT NULL, -- 'view' | 'dwell_long' | 'open_hotspot' | 'save' | 'share' | 'cta_click' | 'sample_request'
  signal_payload  JSONB,
  market_code     TEXT,
  cultural_cluster TEXT,
  occurred_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id)
);
```

### 1.4 Tabella `relationship_linkages` (NUOVA — il "graph layer")

Una relazione non è lineare. **Collegamenti many-to-many** con:
- progetti
- moodboard
- edizioni di mercato
- direzioni editoriali
- materiali
- ispirazioni Pinterest
- consultation requests

```sql
CREATE TABLE relationship_linkages (
  id               UUID PRIMARY KEY,
  tenant_id        UUID,
  account_id       UUID REFERENCES accounts(id),
  linked_type      TEXT NOT NULL, -- 'project' | 'moodboard' | 'market_edition' | 'article' | 'material' | 'inspiration_board' | 'form_response'
  linked_id        UUID NOT NULL,
  linkage_kind     TEXT NOT NULL, -- 'owns' | 'engaged' | 'specified' | 'shared_with' | 'considered'
  weight           INT DEFAULT 1, -- editorial strength of the linkage
  meta             JSONB,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON relationship_linkages (account_id, linked_type);
```

Esempio: account "Bulgari Hotels" → linked_type='project' (5 progetti),
linked_type='moodboard' (12 moodboard), linked_type='market_edition'
(Milano, Dubai, Tokyo, Bali).

### 1.5 Tabella `material_affinity` (NUOVA)

Tracciamento materico per relazione — capire **quali materiali**
attraggono attenzione, **per quanto tempo**, **in quale contesto
culturale**.

```sql
CREATE TABLE material_affinity (
  id                UUID PRIMARY KEY,
  tenant_id         UUID,
  account_id        UUID REFERENCES accounts(id),
  material_id       UUID,
  material_family   TEXT, -- 'marble' | 'wood' | 'metal' | 'textile' | 'glass' | 'composite'
  affinity_score    NUMERIC, -- 0.0 - 1.0 weighted from engagement signals
  last_engaged_at   TIMESTAMPTZ,
  cultural_context  TEXT, -- which submarket they engaged in
  meta              JSONB
);
```

Aggiornato editorialmente dal compute service (non manuale).

---

## 2 · Relationship Journey™ Stages

**Sostituisce il funnel di vendita generico.**

I 10 stage NON sono "lead/prospect/client" — sono *fasi della
relazione editoriale*. Ogni stage ha tono, comportamento atteso,
indicatori narrativi.

| # | Stage                       | Mood                                  | Editorial trigger                                       |
|---|-----------------------------|---------------------------------------|---------------------------------------------------------|
| 1 | **Discovery**               | primo riconoscimento                  | viewed at least one editorial surface                   |
| 2 | **Inspiration**             | curiosità materica/estetica           | saved moodboard / opened gallery                        |
| 3 | **Editorial Engagement**    | lettura attiva e ricorrente           | dwell_long su 2+ articoli / market edition specifica    |
| 4 | **Project Conversation**    | scambi su un brief                    | first direct interaction logged (call/email/visit)      |
| 5 | **Material Exploration**    | esplorazione tattile                  | sample_request OR material gallery deep-dive            |
| 6 | **Strategic Direction**     | scelta del registro narrativo         | moodboard share with approval / direction note written  |
| 7 | **Specification**           | scelta tecnica concreta               | spec sheet generated / proposal draft started           |
| 8 | **Proposal**                | proposta editoriale completa          | proposal_sent interaction                               |
| 9 | **Active Collaboration**    | progetto in corso                     | project linked & in active status                       |
| 10| **Long-Term Relationship**  | ritorno / referenza                   | 2+ projects OR referral_made flag                       |

**Bonus stati orizzontali (non lineari):**
- `Dormant` (no signal > 90 giorni)
- `Archived` (chiusura editoriale, no scartato)
- `Editorial Ambassador` (porta nuove relazioni)

### 2.1 Stage advancement rules

Lo stage **non è un toggle**. Cambia via:
1. **Esplicito**: utente clicca stage pill → StageChangeModal con nota relazionale obbligatoria
2. **Automatico**: signal computation (cron) propone uno stage advance → mostra suggestion "Questa relazione mostra segnali di Strategic Direction. Conferma?"

L'automatismo **propone**, non decide. La conferma rimane editoriale.

---

## 3 · Editorial Engagement Tracking

### 3.1 Segnali tracciati

Per ogni resource_type (`article`, `moodboard`, `material`, `project`,
`edition`, `material_sample`, `cta`, `form`):

| Signal             | Significato                                            |
|--------------------|--------------------------------------------------------|
| `view`             | apertura semplice                                      |
| `dwell_short`      | < 15s (curiosità)                                      |
| `dwell_long`       | > 60s (lettura attiva)                                 |
| `scroll_complete`  | letto fino in fondo                                    |
| `open_hotspot`     | click su un hotspot specifico (moodboard)              |
| `save`             | salvato in lista personale                             |
| `share`            | condiviso con un altro contact                         |
| `cta_click`        | click su una CTA (con `cta_id` in payload)             |
| `sample_request`   | richiesta campione materico                            |
| `consultation_req` | richiesta consulenza                                   |
| `showroom_interest`| RSVP/visita showroom                                   |
| `proposal_open`    | apertura proposta inviata                              |
| `material_zoom`    | zoom-in su materiale                                   |

### 3.2 Ingestion API

```
POST /api/relationships/engagement/ingest
Body: {
  account_id, contact_id, resource_type, resource_id,
  signal, signal_payload, market_code, cultural_cluster
}
```

Hook frontend già esistente: `useMarketSignal.js` esteso per inviare
anche al CRM (oggi va solo a `market_behavior_events`).

### 3.3 Aggregation views

Materialized view `relationship_engagement_summary`:
- top 3 articles
- top 3 moodboards
- top 3 materials
- preferred cluster
- preferred atmosphere (calcolato)
- preferred CTA type
- engagement cadence (settimanale/mensile/sporadica)

Refresh: ogni 6 ore.

---

## 4 · Project Linkage System

### 4.1 Cardinality

Una relazione **può** avere:
- 0..N progetti (Specification phase può vivere senza un progetto formale)
- 0..N moodboard
- 0..N market_edition
- 0..N material direction
- 0..N form_response

### 4.2 Linkage UX

Nella AccountDetailPage™ — nuova sezione **"Relationship Graph™"**
nel pannello destro o come tab dedicata:

```
RELATIONSHIP GRAPH™
├─ Progetti collegati (3)
│   ├─ Villa Maremma · in corso
│   ├─ Apartment Milano · proposta
│   └─ Yacht Iris · long-term
├─ Moodboard condivisi (8)
├─ Market Editions toccate (4)
│   └─ Milano · Dubai · Miami · Tokyo
├─ Materiali esplorati (12)
└─ Direzioni editoriali (2)
```

Ogni voce è un chip cliccabile che apre il record collegato senza
perdere il contesto della relazione.

### 4.3 Linkage creation patterns

- **Implicit**: quando l'utente registra un'interazione e
  seleziona "progetto collegato", la linkage viene creata
  automaticamente con `linkage_kind='engaged'`.
- **Explicit**: nuovo bottone "Aggiungi progetto al graph" nella
  Relationship Graph section.
- **Inferred**: signal computation può inferire una linkage debole
  (`linkage_kind='considered'`) se l'engagement è ripetuto ma non
  esiste un legame esplicito.

---

## 5 · Market Intelligence Integration

### 5.1 Per-relationship market lens

Ogni AccountDetailPage™ mostra:
- **Mercato culturale dominante** (calcolato dai signal aggregati)
- **Cluster di submarket** (top 2)
- **Cultural profile match** vs preferred_atmosphere

### 5.2 Insights editoriali (NO analytics)

Frasi concierge generate dai signal aggregates, esempio:
- "Questo cliente reagisce meglio a narrative hospitality-first."
- "Le gallery immersive performano meglio con questo profilo."
- "La cadenza editoriale ottimale è settimanale, registro concierge."
- "Materiale dominante: marmo Calacatta — affinità 0.84 in cluster Miami."

Generate da `crm_intelligence._micro_insights()` (già esistente),
da estendere con i nuovi signal types.

### 5.3 Cross-market behavior

Quando una relazione tocca submarket diversi, l'insight diventa:
> "Cliente con orientamento internazionale: profilo Milano (atelier)
> + profilo Miami (hospitality)."

Suggerisce automaticamente "Create a Cultural Edition™" per la
seconda città.

---

## 6 · Moodboard Linkage

### 6.1 Quando una moodboard è linkata

Trigger di creazione `relationship_linkages` con `linked_type='moodboard'`:
- shared via `shared_with` → linkage_kind=`shared_with`, weight=3
- opened by contact → linkage_kind=`engaged`, weight=1
- hotspot opened → linkage_kind=`engaged`, weight=2
- specified in proposal → linkage_kind=`specified`, weight=4

### 6.2 Mood signal extraction

Da ogni moodboard ingaggiata estraiamo:
- atmosphere_tags top 3
- material_families top 3
- cultural_register inferito

Aggrega in `accounts.signal_snapshot.mood_signals[]` cache (già
esistente, da estendere).

---

## 7 · Material Affinity Tracking

### 7.1 Computation

Score 0.0-1.0 per ogni `(account, material)` pair:

```
affinity = w1 * view_count
         + w2 * dwell_minutes
         + w3 * sample_request (3.0 boost)
         + w4 * specification_inclusion (4.0 boost)
         + w5 * moodboard_inclusion (1.5 boost)
         + w6 * cta_click_count
```

Normalized in [0, 1]. Computed daily by `material_affinity_compute`
background job (nuovo).

### 7.2 UI display

Nella AccountDetailPage™ → block **"Materiali preferiti"**:
```
─────────────────────────────────────
MATERIALI PREFERITI
─────────────────────────────────────
■ Marmo Calacatta       0.84
■ Noce Canaletto        0.71
■ Ottone brunito        0.58
■ Lino crudo            0.42
```

Bar visuali sottili, palette MOOD primary (non heatmap aggressiva).

---

## 8 · International Market Behavior Mapping

### 8.1 Per-relationship market footprint

Vista calcolata in tempo reale:
```
{
  "primary_market": "italy_lombardy",
  "primary_submarket": "milano",
  "active_markets": ["italy_lombardy", "usa_south_florida"],
  "considered_markets": ["uae_dubai", "japan_tokyo"],
  "language_preferred": "it-IT",
  "hospitality_orientation_score": 0.78,
  "specification_orientation_score": 0.34
}
```

### 8.2 Display surface

Nuovo **block "International Footprint"** nella Relationship
Summary Panel™ con icona globo MOOD style. Mostra primary + active
con chip cromatici per cluster culturale.

### 8.3 Editorial actions

Quando un account ha **2+ active_markets**, mostra CTA:
> _"Questa relazione vive in più mercati. Considera una **Edition
> Strategy™** che li abbracci."_

---

## 9 · Relationship Profile™ (full UI spec)

Già implementato come AccountDetailPage™ (Sprint CRM Phase 1).
Phase 2 estende con:

| Sezione (oggi)           | Aggiunte Phase 2                                        |
|--------------------------|----------------------------------------------------------|
| Stage pills              | + suggested next stage (auto-proposed)                  |
| Timeline                 | + filter by signal type · pin importanti                |
| Relationship Summary     | + International Footprint block + Material Affinity     |
| Quick actions            | + "Aggiungi al graph"                                   |
| Micro insights           | + cross-market suggestions                              |
| Cultural Edition CTA     | (esistente)                                              |
| **Relationship Graph**   | NEW — progetti · moodboard · editions · materiali       |

---

## 10 · Data Flow & Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       FRONTEND (workspace)                       │
│                                                                  │
│  Storefront · CRM · Editorial Studio · Moodboards · Library     │
│                          │                                       │
│        Hook: useMarketSignal.js + useRelationshipSignal.js      │
│                          ▼                                       │
└────────────────────┬─────────────────────┬───────────────────────┘
                     │                     │
   POST /signals/event             POST /relationships/engagement/ingest
                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                          BACKEND                                 │
│                                                                  │
│  market_signals_router (existing) ──┐                            │
│                                     ▼                            │
│  crm_engagement_router (NEW)        market_behavior_events       │
│      │                                                           │
│      ├─ writes editorial_engagement                              │
│      ├─ writes relationship_linkages (inferred)                  │
│      └─ schedules material_affinity recompute                    │
│                                                                  │
│  crm_intelligence_router (existing, extended)                    │
│      ├─ /summary  → relationship summary (panel right)          │
│      ├─ /graph   NEW → relationship_linkages aggregated         │
│      ├─ /footprint NEW → international market footprint         │
│      └─ /affinity NEW → material_affinity ranked                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11 · Implementation Phases

### Phase 2A · Foundation (sprint corrente proposto)
**[1 sprint · 2-3 giorni]**

1. Migration 053: ALTER accounts + create editorial_engagement +
   relationship_linkages + material_affinity tables
2. Backend endpoint: POST `/api/relationships/engagement/ingest`
3. Backend endpoint: GET `/api/relationships/accounts/:id/graph`
4. Estendere `_compute_mood` e `_micro_insights` con i nuovi signal
5. Frontend: nuovo block "Relationship Graph™" nella AccountDetailPage™
6. Frontend: estensione hook `useMarketSignal` per CRM ingest

### Phase 2B · Material Affinity
**[1 sprint · 2 giorni]**

1. Background compute job (cron-style FastAPI scheduled task)
2. Endpoint GET `/api/relationships/accounts/:id/affinity`
3. Frontend: block "Materiali preferiti" con bar visuali editoriali

### Phase 2C · International Footprint
**[1 sprint · 1-2 giorni]**

1. Endpoint GET `/api/relationships/accounts/:id/footprint`
2. Frontend: block "International Footprint"
3. CTA "Edition Strategy™" suggerita

### Phase 2D · Auto-stage suggestion
**[1 sprint · 1 giorno]**

1. Stage inference rules (engine in `crm_intelligence`)
2. Suggestion banner nella AccountDetailPage™
3. Accept/dismiss workflow → conferma editoriale

### Phase 2E · Editorial Engagement filtering & analytics-free intelligence
**[1 sprint · 2 giorni]**

1. Materialized view `relationship_engagement_summary`
2. Timeline filter by signal type
3. "Insights settimanali" newsletter editoriale (opzionale)

---

## 12 · Naming & Tone Guidelines

### Sempre

- "**Relazione**" / "**Relationship**" per i record
- "**Direzione**" / "**Direction**" per le scelte di progetto
- "**Editoriale**" / "**Editorial**" per ogni interazione mediata
- "**Cadenza**" / "**Cadence**" per la frequenza
- "**Concierge**" come tone descriptor

### Mai

- ❌ Lead, Deal, Opportunity, Funnel
- ❌ Convert, Conversion, Close
- ❌ Won, Lost, Hot, Warm, Cold
- ❌ KPI, ROI, Performance
- ❌ Sales, Sales cycle

### Esempi micro-copy

| Contesto                | Copy ufficiale                                        |
|-------------------------|--------------------------------------------------------|
| Empty state timeline    | "La memoria della relazione è ancora bianca."         |
| Stage advance suggestion| "Questa relazione mostra segnali di Strategic Direction." |
| Cultural Edition CTA    | "MOOD adatterà tono, ritmo, CTA e narrativa al mercato selezionato." |
| Material affinity       | "Affinità materica · ricavata dall'engagement editoriale." |
| Graph empty             | "Nessun progetto ancora collegato. Avvia una direzione." |

---

## 13 · Non-Goals (esplicito)

Il CRM **non**:
- gestisce SLA commerciali
- mostra conversion funnel
- ha "won/lost" stage
- calcola sales velocity
- emette previsioni di fatturato
- ha lead scoring meccanico
- usa "hot/cold" labeling

Per metriche commerciali esiste **PlatformAnalytics™** (futura,
separata).

---

## 14 · Validation Criteria

Una build è considerata **Editorial Relationship CRM™-compliant** se:

- [ ] Nessuna stringa UI contiene Lead/Deal/Funnel/Opportunity
- [ ] Stage labels usano i 10 stage Relationship Journey™
- [ ] Materiale, moodboard, market_edition appaiono nel Relationship Graph
- [ ] Material affinity è visibile per ogni relazione con >= 5 signal
- [ ] International Footprint è calcolato per ogni relazione
- [ ] Engagement signal API accetta tutti i 12 signal type
- [ ] Micro insights generate frasi concierge (non KPI)
- [ ] Empty states usano linguaggio editoriale (non "no data")
- [ ] Stage advancement passa sempre per modal con nota relazionale
- [ ] AccountDetailPage™ visualmente: calmo, editoriale, no rosso enterprise

---

## 15 · Riferimenti

- Migration foundation: `041_editorial_relationship_crm.sql`
- Migration canonical pipeline: `051_crm_canonical_pipeline.sql`
- AccountDetailPage™: `/app/frontend/src/pages/crm/AccountDetailPage.jsx`
- Hook signal: `/app/frontend/src/hooks/useMarketSignal.js`
- Backend intelligence: `/app/backend/routers/crm_intelligence.py`
- Linguaggio platform: `/app/memory/PRD.md` (Sprint CRM-REFACTOR-PHASE-1)

---

**Versione**: 1.0 · Feb 19, 2026
**Maintainer**: Editorial Direction · MOOD for DESIGN™
**Status**: APPROVED for Phase 2 implementation
