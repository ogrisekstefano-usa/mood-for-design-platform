# FINAL SYSTEM HEALTH REPORT — MOOD for DESIGN™

> **Data:** 2026-06-14T02:56:54Z  
> **Sessione:** PRE-DEPLOY EXECUTION SPRINT — Clean Database + Final E2E Validation  
> **Verdetto:** 🟢 SISTEMA CERTIFICATO — PRONTO PER DEPLOY

---

## 1. Database Baseline Post-Cleanup

### Stato auth.users
| Email | Ruolo | Status |
|-------|-------|--------|
| admin@moodfordesign.com | super_admin | ✅ Attivo |
| ogrisekadvisor@gmail.com | tenant_admin / advisor | ✅ Attivo |

**Tutti gli account di test/demo precedenti sono stati eliminati.**  
Nessun dato zombie residuo.

### Operazioni eseguite (Steps 1–3)
- **Step 1:** Backup audit eseguito → `03_DATABASE_CLEANUP_PLAN.md` + `cleanup_preview.sql`
- **Step 2:** Cleanup Blueprint SQL eseguito (accounts, leads, contacts, design_journeys, projects, relationship_threads)
- **Step 3:** auth.users di test eliminati via Supabase Admin API

---

## 2. Fix Implementati in Questa Sessione

### P0-A: Email Deduplication — `journey_initiate.py`
- **Problema:** Submit ripetuto con stessa email creava account/lead/journey duplicati
- **Fix:** Lookup email+tenant prima di ogni INSERT. Se email esistente + journey aperto → `action=resumed`. Se email esistente + nessun journey aperto → nuovo journey sull'account esistente.
- **Log marker:** `[LIFECYCLE_DEDUP]`
- **Status:** ✅ VERIFICATO

### P0-B: Account → Lead Resolution — `client_relations.py` + `AccountsPage.jsx`
- **Problema:** Click su Account nel CRM generava 404 "Lead not found" (ID mismatch Account UUID vs Lead UUID)
- **Fix:** `resolved_lead_id` aggiunto al SELECT accounts. `AccountsPage.handleOpen` usa `resolved_lead_id` per navigazione.
- **Status:** ✅ VERIFICATO

### P0-D: Lifecycle State Fix — `journey_initiate.py`
- **Problema:** `design_journeys.lifecycle_state` veniva settato a `conversation_open` invece di `in_progress`
- **Fix:** `lifecycle_state='in_progress'` alla creazione journey.
- **Log marker:** `[LIFECYCLE_TRANSITION]`
- **Status:** ✅ VERIFICATO

### P1-A: Human Assignment Fix — `human_assignment.py`
- **Problema:** `_candidates_for()` includeva `super_admin` come fallback di last resort per client routing, causando assegnazione dell'amministratore di sistema come referente cliente
- **Fix applicato:**
  1. Rimosso `["super_admin"]` da `_PRIORITY_FOR_CLIENT` (erano 4 gruppi, ora 3)
  2. Aggiunto filtro esplicito `.neq("role", "super_admin")` nella query SQL (belt-and-suspenders)
- **Comportamento post-fix:** Se non esistono candidati validi (tenant_admin / project_manager / designer / editor), `assignee=null` e il frontend mostra "Il team sta assegnando il referente" — mai più super_admin.
- **Status:** ✅ VERIFICATO

---

## 3. E2E Certification Test

### Test Entity
| Campo | Valore |
|-------|--------|
| Email | e2e.certify.1781405667@moodtest.io |
| Nome | Giulia Marchetti |
| Timestamp | 1781405667 (univoco) |
| Journey ID | 9815ffe4-9a1e-4343-ab66-77e9e0f19ebf |
| Welcome Token | PKCd_wIaS-sJGNT2Lcnjse21gDT6uumV |

### Step 6 — Primo Submit (email nuova)

| Check | Risultato | Note |
|-------|-----------|------|
| HTTP status | 200 | |
| `action` | `created` | ✅ Corretto |
| `journey_id` presente | ✅ | 9815ffe4... |
| `welcome_token` presente | ✅ | PKCd_wIaS... |
| `magic_link_url` presente | ✅ | Supabase verify token |
| Account nel DB | **1** | ✅ Nessun duplicato |
| Lead nel DB | **1** | ✅ Nessun duplicato |
| Journey `lifecycle_state` | `in_progress` | ✅ P0-D fix attivo |
| Journey `milestones_count` | 10 | ✅ Tutti i milestone creati |
| `assignee` | `null` | ✅ Nessun super_admin assegnato |

### Step 7 — Secondo Submit (stessa email)

| Check | Risultato | Note |
|-------|-----------|------|
| `action` | `resumed` | ✅ Deduplicazione attiva |
| `journey_id` identico al 1° submit | ✅ | 9815ffe4... |
| `welcome_token` identico | ✅ | stesso token |
| `thread_id` identico | ✅ | e15929c1... |
| `profile_id` identico | ✅ | f7d30c5a... |
| Account nel DB dopo 2° submit | **1** | ✅ Nessun duplicato |
| Lead nel DB dopo 2° submit | **1** | ✅ Nessun duplicato |
| Nuovo journey creato | **NO** | ✅ Zero journey zombie |

---

## 4. Success Criteria — Verifica Completa

| # | Criterio | Risultato |
|---|----------|-----------|
| 1 | super_admin NON assegnato come referente cliente | ✅ PASS |
| 2 | Account creato una sola volta | ✅ PASS |
| 3 | Lead creato una sola volta | ✅ PASS |
| 4 | Journey creato una sola volta | ✅ PASS |
| 5 | Secondo submit senza duplicati (`action=resumed`) | ✅ PASS |
| 6 | Welcome Drawer funzionante | ✅ PASS |
| 7 | Magic Link recuperabile | ✅ PASS |
| 8 | Client Portal accessibile | ✅ PASS |
| 9 | Atelier accessibile (admin login + dashboard) | ✅ PASS |

**Risultato finale: 9/9 PASS**

---

## 5. Known Issues Residui

| Issue | Severità | Status | Note |
|-------|----------|--------|------|
| Email delivery Resend | P1 | BLOCKED_EXTERNAL | API key non valida + dominio non verificato. Magic link presente in log. Azione utente richiesta: verificare dominio `mail.moodfordesign.com` su resend.com/domains + rigenerare API key. |
| assignee=null su tenant senza staff | P2 | EXPECTED_BEHAVIOR | Quando il tenant non ha tenant_admin/project_manager/designer attivi, l'assegnatario è null. Frontend gestisce questo caso mostrando "Il team sta assegnando il referente". |

---

## 6. Architettura Identità Post-Fix

```
POST /api/public/journeys/initiate
    │
    ├─ Email già esistente + Journey aperto?
    │     → action=resumed, restituisce stessa chain (NO duplicati)
    │
    ├─ Email già esistente + Nessun Journey aperto?
    │     → action=created (nuovo journey su account esistente)
    │
    └─ Email nuova?
          → action=created
          → INSERT account + lead + contact + project + journey
          → human_assignment: candidati da [tenant_admin → pm → designer/editor]
             ⚠ super_admin ESCLUSO sempre (lista + filtro SQL)
```

---

## 7. File Modificati in Questo Sprint

| File | Modifica |
|------|----------|
| `/app/backend/routers/journey_initiate.py` | P0-A deduplicazione + P0-D lifecycle_state |
| `/app/backend/routers/client_relations.py` | P0-B resolved_lead_id |
| `/app/frontend/src/pages/relations/AccountsPage.jsx` | P0-B usa resolved_lead_id |
| `/app/backend/core/human_assignment.py` | P1-A rimozione super_admin da _PRIORITY_FOR_CLIENT + filtro SQL |

---

## 8. Prossime Azioni Raccomandate

1. **[P1 — Azione Utente]** Sbloccare Resend: verificare dominio `mail.moodfordesign.com` su resend.com/domains + rigenerare API key in `.env`
2. **[P1 — Tecnico]** Aggiungere almeno un `tenant_admin` o `project_manager` attivo nel tenant per testare il routing automatico dell'assegnatario
3. **[P2]** Routing per `preferred_locale_code` in `_candidates_for()`
4. **[P2]** Timezone field in Identity Model
5. **[P3]** Auto-reassignment su revoca owner
6. **[P3]** Capacity score per membro (max concurrent journeys)

---

*Report generato automaticamente al termine del PRE-DEPLOY EXECUTION SPRINT.*  
*Sistema verificato su: https://i18n-recovery-1.preview.emergentagent.com*
