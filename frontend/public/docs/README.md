# MOOD for DESIGN™ — Studio Activation Flow v2
## Design Package — Index

> **Status**: DESIGN ONLY · in attesa di approvazione utente
> **Author**: Engineering / drafting agent
> **Date**: 2026-05-31
> **Scope**: Redesign integrale di `/studio`, conforme al brief utente + addendum copy/voice/CMS
> **Blocker**: Incidente P0 Supabase (DB wipe) — implementazione bloccata fino a RCA chiusa

---

## Decisioni approvate (ask_human)

| # | Tema | Scelta |
|---|---|---|
| 1 | Stato hold DB | **b** — additive only (drafting permesso, esecuzione differita) |
| 2 | Mapbox | **b** — via `integration_playbook_expert_v2` in fase impl. |
| 3 | Lingue attive | **c** — hybrid: tabella `active_languages` con seed dalle locale esistenti |
| 4 | Email uniqueness | **a** — view SQL `v_global_email_registry` |
| 5 | Output | **a** — solo documenti, zero implementazione |
| Extra | Scoring | **Tenant Qualification Score™** incluso |

---

## Struttura del package

| File | Contenuto | LOC |
|---|---|---|
| `00_OVERVIEW_AND_UX.md` | Executive summary, UX map, 5 movimenti, visual direction, post-submit, accessibilità, abbandono, telemetria, open questions | ~400 |
| `01_COPY_AND_CMS.md` | Tone of voice, editorial test, naming convention chiavi, copy audit vecchio→nuovo, traduzioni IT/EN/FR/DE/ES, CMS mapping, governance lingue | ~450 |
| `02_TECH_DESIGN.md` | Schema DB additivo (countries, active_languages, reserved_subdomains, studio_requests_v2, studio_v2_drafts, v_global_email_registry), API contracts, Pydantic/Zod rules, Mapbox spec, rate-limit, anti-enumeration | ~500 |
| `03_SCORE_E2E_MIGRATION.md` | Tenant Qualification Score™ (algoritmo + pesi + tier), test plan E2E (pytest + Playwright + integration), migration plan v1→v2 con feature flag e rollback, risk register | ~400 |

**Totale**: ~1.750 righe di documentazione

---

## Cosa NON è stato fatto

In rispetto della direttiva 5→a (solo documenti) **e** dell'hold P0 incidente DB:

- ❌ Zero codice nuovo in `/app/backend/`
- ❌ Zero codice nuovo in `/app/frontend/` (salvo task UI logo già autorizzato in messaggio precedente)
- ❌ Zero migration eseguita
- ❌ Zero seed eseguito
- ❌ Zero modifica al funnel `/studio` attuale (v1)
- ❌ Zero modifica al CMS esistente
- ❌ Zero chiamata a `integration_playbook_expert_v2` (sarà fatta in fase implementazione)

---

## Approvazione richiesta

Prima di procedere con l'implementazione (e prima ancora del riavvio dei lavori sul DB), serve:

1. ✅ Conferma chiusura RCA incidente Supabase + recovery DB
2. ✅ Approvazione esplicita di **ciascuno dei 4 documenti** (o richieste di revisione)
3. ✅ Risposta alle **Open Decisions** in `03_…` §5 (10 punti)
4. ✅ Validazione editoriale delle copy IT da parte di un copy lead
5. ✅ Validazione traduzioni EN/FR/DE/ES (o accordo a posticipare a copy review esterno)

---

## Next agent action (quando utente sblocca)

1. `integration_playbook_expert_v2` → Mapbox Search Box API + token strategy
2. Phase A · DB foundation (Migration 026 + seed)
3. Phase B · Backend stubs + endpoint
4. Phase C · Copy seed (Migration 028)
5. Phase D · Frontend redesign behind feature flag
6. Phase E · TQS implementation
7. Phase F · Mapbox integration
8. Phase G · Command Center admin UX
9. Phase H · Cutover (feature flag flip)

Vedere `03_SCORE_E2E_MIGRATION.md` §3.2 per dettaglio fasi.

---

## Quick links to key sections

| Topic | File · Section |
|---|---|
| 5 Movimenti in dettaglio | `00_…` §3 |
| Visual direction & asset rules | `00_…` §5 |
| Tone of voice & editorial test | `01_…` §1 |
| Copy audit table vecchio→nuovo | `01_…` §3 |
| Traduzioni IT/EN/FR/DE/ES | `01_…` §4 |
| Schema `studio_requests_v2` | `02_…` §1.4 |
| View `v_global_email_registry` | `02_…` §1.6 |
| API endpoint contracts | `02_…` §2 |
| Anti-enumeration email check | `02_…` §6 |
| Tenant Qualification Score™ algorithm | `03_…` §1 |
| TQS component weights | `03_…` §1.5 |
| Backend test catalogue | `03_…` §2.1 |
| Frontend Playwright test catalogue | `03_…` §2.2 |
| Migration phases v1→v2 | `03_…` §3.2 |
| Feature flag implementation | `03_…` §3.4 |
| Risk register | `03_…` §4 |
| Open decisions ancora aperte | `03_…` §5 |

---

— *Design package consegnato. In attesa di approvazione.* —
