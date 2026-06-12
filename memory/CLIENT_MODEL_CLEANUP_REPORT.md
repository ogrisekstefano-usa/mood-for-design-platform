# CLIENT MODEL CLEANUP REPORT
> Data: 08 Feb 2026 | Sprint: Post-Certification Consolidation P1  
> Entità analizzate: leads, accounts, contacts, journey_briefs, discovery_interviews

---

## METODOLOGIA

Per ogni colonna di ogni entità:
- `ALWAYS NULL` = 0% non-null → mai scritto in produzione
- `SPARSE` = < 20% non-null → scritto raramente
- `USED` = > 20% non-null → campo attivo

---

## 1. ENTITY: `leads` (48 colonne, 14 righe)

### Campi ALWAYS NULL — mai scritti (24 campi)

| Colonna | Tipo | Note | Azione |
|---------|------|------|--------|
| `client_user_id` | UUID | Dovrebbe linkarei Supabase auth user — mai popolato | ⛔ **DEPRECATED** |
| `country` | TEXT | Localizzazione — mai raccolta | ⛔ DEPRECATED |
| `city` | TEXT | Localizzazione — mai raccolta | ⛔ DEPRECATED |
| `budget_range` | TEXT | Budget — non raccolto nel begin-journey ritual | ⛔ DEPRECATED |
| `style_preference` | TEXT | Stile — duplicato in `journey_briefs` | ♻️ MERGE INTO JOURNEY |
| `notes` | TEXT | Note libere — mai usate | ⛔ DEPRECATED |
| `assigned_to` | UUID | Designer assegnato — usa `design_journey_assignments` | ⛔ DEPRECATED |
| `professional_category` | TEXT | B2B category — non raccolta via public form | ⛔ DEPRECATED |
| `collaboration_intent` | TEXT | Intent B2B — non raccolta | ⛔ DEPRECATED |
| `market_sector` | TEXT | Settore mercato — non raccolto | ⛔ DEPRECATED |
| `company_name` | TEXT | Azienda B2B — non raccolta via public form | ⛔ DEPRECATED |
| `company_website` | TEXT | Sito aziendale — non raccolto | ⛔ DEPRECATED |
| `portfolio_url` | TEXT | URL portfolio — non raccolta | ⛔ DEPRECATED |
| `closed_answers` | JSONB | Brief chiuso — usa `journey_briefs.closed_answers` | ♻️ MERGE INTO JOURNEY |
| `behavioral_tags` | JSONB | Tags comportamentali — mai calcolati | ⛔ DEPRECATED |
| `ai_tags` | JSONB | Tags AI — mai calcolati | ⛔ DEPRECATED |
| `atmosphere_signals` | JSONB | Segnali atmosfera — usa `journey_briefs` | ♻️ MERGE INTO JOURNEY |
| `material_signals` | JSONB | Segnali materiali — usa `journey_briefs` | ♻️ MERGE INTO JOURNEY |
| `cultural_register` | TEXT | Registro culturale — mai calcolato | ⛔ DEPRECATED |
| `luxury_perception_tier` | TEXT | Tier lusso — mai calcolato | ⛔ DEPRECATED |
| `narrative_seed` | TEXT | Seme narrativo — usa `journey_briefs` | ♻️ MERGE INTO JOURNEY |
| `intake_completed_at` | TIMESTAMP | Timestamp intake — mai valorizzato | ⛔ DEPRECATED |
| `designer_assigned` | UUID | Ridondante con `design_journey_assignments` | ⛔ DEPRECATED |

### Campi SPARSE (< 20%) — parzialmente usati

| Colonna | % Non-null | Note | Azione |
|---------|-----------|------|--------|
| `phone` | 14% | Opzionale nel form | ✅ KEEP |
| `first_journey_id` | 28% | Solo 4/14 — FK al journey | ✅ KEEP (consolidare) |

### Campi ATTIVI (> 20%) — da mantenere

`id`, `tenant_id`, `source`, `lead_type`, `status`, `score`, `first_name`, `last_name`, `email`, `language`, `project_type`, `timeline`, `metadata_json`, `locale_code`, `onboarding_path`, `runtime_identity`, `pipeline_stage`, `progression_state`, `progression_score`, `intake_version`, `relationship_temperature`, `created_at`, `updated_at`

**Totale campi mai usati su 48**: **24 (50%) sempre null**

---

## 2. ENTITY: `accounts` (34 colonne, 18 righe)

### Campi ALWAYS NULL — mai scritti (18 campi)

| Colonna | Azione |
|---------|--------|
| `city` | ⛔ DEPRECATED |
| `address` | ⛔ DEPRECATED |
| `website` | ⛔ DEPRECATED |
| `relationship_score` | ⛔ DEPRECATED |
| `relationship_health` | ⛔ DEPRECATED |
| `notes` | ⛔ DEPRECATED |
| `last_activity_at` | ⛔ DEPRECATED |
| `market_id` | ⛔ DEPRECATED |
| `cultural_profile` | ⛔ DEPRECATED |
| `hospitality_positioning` | ⛔ DEPRECATED |
| `editorial_register_affinity` | ⛔ DEPRECATED |
| `design_intent_summary` | ⛔ DEPRECATED |
| `luxury_perception_axis` | ⛔ DEPRECATED |
| `relationship_journey_stage` | ⛔ DEPRECATED (sostituito da `design_journeys.lifecycle_state`) |
| `mood_dominant` | ⛔ DEPRECATED |
| `market_submarket` | ⛔ DEPRECATED |
| `next_followup_at` | ⛔ DEPRECATED |
| `signal_snapshot` | ⛔ DEPRECATED |

### Campi SPARSE (< 20%)

| Colonna | % | Azione |
|---------|---|--------|
| `country` | 16% | ✅ KEEP |
| `phone` | 5% | ✅ KEEP |
| `primary_owner_id` | 5% | ⚠️ LEGACY (usa design_journey_assignments) |

### Campi ATTIVI (> 20%)

`id`, `tenant_id`, `account_name`, `account_type`, `lifecycle_stage`, `source`, `email`, `language`, `locale_code`, `metadata_json`, `first_name`, `last_name`, `created_at`, `updated_at`, `avatar_url` (se presente)

**Totale campi mai usati su 34**: **18 (53%) sempre null**

---

## 3. ENTITY: `contacts` (17 colonne, 13 righe)

### Campi ALWAYS NULL — 5 campi

| Colonna | Azione |
|---------|--------|
| `role` | ⛔ DEPRECATED |
| `department_or_area` | ⛔ DEPRECATED |
| `communication_preference` | ⛔ DEPRECATED |
| `notes` | ⛔ DEPRECATED |
| `last_activity_at` | ⛔ DEPRECATED |

### Campi SPARSE

`phone` (7%) — opzionale, mantenere

### Campi ATTIVI

`id`, `tenant_id`, `account_id`, `first_name`, `email`, `primary_contact`, `lifecycle_stage`, `created_at`, `updated_at`

**Tabella relativamente pulita**: solo 5 campi (29%) sempre null.

---

## 4. ENTITY: `journey_briefs` (13 colonne, 13 righe)

### Campi ALWAYS NULL — 6 campi

| Colonna | Nota | Azione |
|---------|------|--------|
| `atmosphere_signals` | Duplicato di `closed_answers.atmosphere` | ♻️ MERGE / rimuovere scrittura |
| `material_signals` | Duplicato di `closed_answers.materials` | ♻️ MERGE / rimuovere scrittura |
| `cultural_register` | Mai calcolato | ⛔ DEPRECATED |
| `luxury_perception_tier` | Mai calcolato | ⛔ DEPRECATED |
| `narrative_seed` | Mai valorizzato | ⚠️ FUTURA (AI enrichment) |
| `source_lead_id` | Link al lead di origine — mai scritto | ⛔ DEPRECATED |

### Campi ATTIVI (core della Journey)

`id`, `tenant_id`, `journey_id`, `closed_answers`, `intake_version`, `created_at`, `updated_at`

**`closed_answers` (100%)**: Contiene TUTTI i dati del brief — rooms, atmosphere, lifestyle, budget, timeline. **Questa è la SSoT del brief.**

**Tabella essenzialmente sana**: 6 campi null su 13, ma il core (`closed_answers`) è completo.

---

## 5. ENTITY: `discovery_interviews` (15 colonne, 12 righe)

### Campi ALWAYS NULL — 3 campi

| Colonna | Azione |
|---------|--------|
| `conducted_by` | ⛔ DEPRECATED |
| `disqualification_reason` | ⛔ DEPRECATED |
| `recording_url` | ⛔ DEPRECATED |

→ Vedi `DISCOVERY_CONSOLIDATION_REPORT.md` per analisi completa.

---

## METRICHE AGGREGATE

| Entità | Colonne totali | Sempre NULL | % Spreco | Azione richiesta |
|--------|---------------|------------|----------|-----------------|
| `leads` | 48 | 24 | **50%** | Alta priorità |
| `accounts` | 34 | 18 | **53%** | Alta priorità |
| `contacts` | 17 | 5 | 29% | Bassa priorità |
| `journey_briefs` | 13 | 6 | 46% | Media (core sano) |
| `discovery_interviews` | 15 | 3 | 20% | Bassa (showroom) |
| **TOTALE** | **127** | **56** | **44%** | |

**44% dei campi del modello cliente non è mai stato scritto.**

---

## RACCOMANDAZIONI PRIORITIZZATE

### P0 — Impatto immediato

**Rimuovere scritture ridondanti** da `leads` e `journey_initiate.py`:

- Non scrivere più `leads.closed_answers`, `leads.atmosphere_signals`, `leads.material_signals` — i dati sono già in `journey_briefs.closed_answers`
- Non scrivere `leads.pipeline_stage` — `leads.progression_state` è il campo letto

### P1 — Cleanup campi mai usati

**Stop alle scritture dei campi ALWAYS NULL**:
- `leads.client_user_id` — non viene mai assegnato un auth user al lead
- `leads.behavioral_tags`, `leads.ai_tags` — analisi AI mai implementata
- `accounts.relationship_score`, `accounts.cultural_profile` — feature mai costruite

### P2 — Database cleanup (futuro)

DROP COLUMN (futura migrazione, non urgente):
- I campi NULL non impattano le performance in PostgreSQL
- Rinviare il DROP COLUMN al momento di una migrazione pianificata

### NON FARE

- Non eliminare `leads.pipeline_stage` subito — aspettare P0-1 lifecycle canonicalization
- Non modificare `journey_briefs.closed_answers` — è la SSoT del brief
- Non eliminare colonne sparse senza verifica con team

---

## SSoT DEL BRIEF CLIENTE

```
journey_briefs.closed_answers (JSONB)  ← SSoT del brief
├── sections.project.rooms
├── sections.atmosphere.how_to_feel
├── sections.atmosphere.references
├── sections.lifestyle.ambiance
├── sections.lifestyle.guests
├── sections.lifestyle.materials
├── sections.budget.investment_range
└── sections.timeline.months
```

**Tutto il resto è ridondante.**

