# STUDIO ACTIVATION JOURNEY™ — ARCHITECTURE
## "Non lasciare l'utente da solo"

> **Status:** 🔒 ARCHITECTURE AUDIT · 31 May 2026 · zero modifica codice/DB
> **Pre-condizione:** ITER174 Founder Only · ITER177 Team Foundation · ITER178 Journey Assignments
> **Vincolo Founder:** progress %, persistente, visibile in dashboard + header finché <100%

---

## §0 · Filosofia

Un nuovo tenant è **un foglio bianco**. L'esperienza deve essere:

1. **Guidata** (10 step checklist canonica)
2. **Progressiva** (% completamento visibile sempre)
3. **Persistente** (sopravvive logout, refresh, navigation)
4. **Skippable** (non bloccante, ma always-visible until done)
5. **Helpful** (ogni step ha CTA + help text + status)

Non è un wizard modale. Non è un onboarding pop-up. È un **compagno persistente** nella header e dashboard.

---

## §1 · Stato attuale

### 1.1 · Cosa esiste già
- `routers/tenant_onboarding.py` con 8 step (`profile_completed`, `owner_introduced`, `branding_completed`, `service_completed`, `team_invited`, `project_created`, `materials_uploaded`, `storefront_published`)
- Tabella `tenant_onboarding` come cache + auto-detection signals
- Frontend `StudioOnboardingPanel.jsx` — render in dashboard, dismissable
- Endpoint `GET /api/tenant-onboarding/status`, `POST /api/tenant-onboarding/mark-done`, `POST /api/tenant-onboarding/dismiss`

### 1.2 · GAP rispetto al target Founder

| Requisito Founder | Stato attuale |
|---|---|
| 10 step canonici | 🟡 esistono 8 step, mancano 2 (Chameleon, Calendario editoriale, Lead, Prospect, Journey, Dominio, Portal — alcuni sovrapposti, altri assenti) |
| Progress % | 🟢 esiste in `/status` response (`progress`, `completed`, `total`) |
| Persistenza in DB | 🟢 `tenant_onboarding` tabella |
| Visibilità in dashboard | 🟢 `StudioOnboardingPanel` |
| Visibilità in header | 🔴 MANCA — solo dashboard |
| Dismissable | 🟢 (ma vincolo Founder: NON deve essere dismissable finché <100%) |
| CTA per ogni step | 🟢 `link` field |
| Help text per ogni step | 🟡 `body` field esiste ma è solo descrizione, non help |
| Status per step | 🟢 `done` boolean |

---

## §2 · 10 Step canonici (Founder spec)

Mappatura proposta con stato attuale ai 10 step Founder:

| # | Step Founder | Stato attuale | DB field | Auto-detect | Help text proposto |
|---|---|---|---|---|---|
| 1 | Configura Blueprint Chameleon™ | 🔴 NUOVO | `chameleon_configured` | `tenant_atelier_identity.active_preset_code != 'mood_for_design' OR custom logo set` | "Scegli l'atmosfera del tuo studio tra i 6 preset Blueprint" |
| 2 | Configura Studio Profile | 🟢 esistente | `profile_completed` | `tenants.name + primary_color set` | "Nome studio, descrizione, contatti" |
| 3 | Invita primo collaboratore | 🟢 esistente | `team_invited` | `users_profile WHERE tenant + role != 'client' COUNT > 1` | "Designer, project manager, sales..." |
| 4 | Crea primo Lead | 🔴 NUOVO | `first_lead_created` | `leads COUNT >= 1` | "Aggiungi il primo contatto al tuo CRM" |
| 5 | Qualifica primo Prospect | 🔴 NUOVO | `first_prospect_qualified` | `discovery_interviews.status='qualified' OR accounts.lifecycle_stage='prospect' COUNT >= 1` | "Completa la prima Discovery Interview™" |
| 6 | Apri primo Design Journey™ | 🟡 esistente (`project_created`) ma da rinominare | `first_journey_opened` | `design_journeys COUNT >= 1` | "Avvia il primo progetto guidato" |
| 7 | Configura calendario editoriale | 🔴 NUOVO | `editorial_calendar_configured` | `editorial_calendar_entries COUNT >= 1 OR settings configured` | "Pianifica la prossima pubblicazione" |
| 8 | Pubblica primo contenuto | 🔴 NUOVO | `first_content_published` | `magazine_articles WHERE published_at IS NOT NULL COUNT >= 1` | "Inaugura il tuo Magazine" |
| 9 | Configura dominio | 🔴 NUOVO | `custom_domain_configured` | `tenant_domains WHERE verification_status='verified' AND hostname NOT LIKE '%.preview.%' COUNT >= 1` | "Collega il tuo dominio personalizzato" |
| 10 | Attiva client portal | 🟡 esistente (`storefront_published`) | `client_portal_activated` | `cms_pages WHERE status='published' COUNT >= 5 AND tenant_atelier_identity.logo_url IS NOT NULL` | "Apri le porte del tuo portfolio" |

**Step legacy da deprecare:**
- `owner_introduced` → fuse in #2 (Studio Profile)
- `service_completed` → potrebbe diventare opzionale (non in 10)
- `materials_uploaded` → potrebbe diventare opzionale (non in 10)
- `branding_completed` → fuse in #1 (Chameleon copre branding visivo)

---

## §3 · Schema DB target

### 3.1 · Tabella estesa `tenant_activation` (rinomina `tenant_onboarding`)

```sql
tenant_activation
─────────────────────────────────────────────
tenant_id                       uuid PK
chameleon_configured            boolean DEFAULT false
profile_completed               boolean DEFAULT false
team_invited                    boolean DEFAULT false
first_lead_created              boolean DEFAULT false
first_prospect_qualified        boolean DEFAULT false
first_journey_opened            boolean DEFAULT false
editorial_calendar_configured   boolean DEFAULT false
first_content_published         boolean DEFAULT false
custom_domain_configured        boolean DEFAULT false
client_portal_activated         boolean DEFAULT false
-- meta
completed_at        timestamptz NULL
dismissed_at        timestamptz NULL  -- legacy, da rimuovere (Founder: non dismissable)
created_at          timestamptz DEFAULT NOW()
updated_at          timestamptz DEFAULT NOW()
```

> **Backward compat:** mantenere `tenant_onboarding` come VIEW o table-alias finché refactor non completo.

### 3.2 · Tabella `activation_step_events` (audit)

```sql
activation_step_events
─────────────────────────────────────────────
id              uuid PK
tenant_id       uuid NOT NULL
step_key        text NOT NULL
event_type      text NOT NULL  -- 'started', 'completed', 'manually_marked', 'reset'
actor_user_id   uuid NULL
payload_json    jsonb DEFAULT '{}'
created_at      timestamptz DEFAULT NOW()
```

---

## §4 · Endpoint target

| Verb | Path | Scope | Note |
|---|---|---|---|
| `GET` | `/api/activation/status` | studio (block client) | progress%, items, completed, total, all_done — mirror dell'esistente |
| `POST` | `/api/activation/mark-done` | studio admin | manual mark per step |
| `POST` | `/api/activation/reset/{step_key}` | super_admin | reset di uno step (debug/test) |
| `GET` | `/api/activation/events` | studio | audit trail |
| ~~`POST /api/activation/dismiss`~~ | — | **rimosso** (Founder: non dismissable) |

---

## §5 · Frontend integration

### 5.1 · Surfaces che mostrano la progress

| Surface | Componente | Behaviour |
|---|---|---|
| **Dashboard cockpit** | `StudioActivationPanel` (rinomina `StudioOnboardingPanel`) | full panel con 10 cards, CTA per ognuna |
| **Header / Topbar** | `ActivationProgressMeter` (NUOVO) | progress bar mini + tooltip "Setup attivazione: 3/10 completati" cliccabile → naviga a dashboard panel |
| **Sidebar** | badge counter su voci attinenti | es. "Team (2)" + alert dot fino a `team_invited=true` |
| **Settings pages** | step cards inline | quando l'utente è già sulla pagina dello step, panel suggerisce next step |

### 5.2 · Visibilità rule
- Se `all_done=true` → nascondi tutti (panel + header meter)
- Altrimenti → header meter SEMPRE visibile, panel su dashboard SEMPRE visibile (non dismissable)
- Possibilità di "minimize" dell'header meter (non dismiss) — solo collapse visuale

### 5.3 · UX cinematic (canon Blueprint OS)

- No wizard modale invasivo (mai bloccare l'utente)
- Inline panel con cards (1 per step) + status badge (done · pending · in_progress)
- Click su card → navigate to `step.link`
- "Mark as done" disponibile solo se `auto_detect=false` (alcuni step richiedono attestazione)

---

## §6 · Auto-detection signals (per step)

| Step | Auto-signal | Implementation |
|---|---|---|
| 1. Chameleon | `tenant_atelier_identity.active_preset_code IS NOT NULL` | already exists |
| 2. Profile | `tenants.name AND tenants.primary_color NOT NULL` | existing |
| 3. Team invited | `SELECT COUNT FROM users_profile WHERE tenant_id=:t AND role NOT IN ('client') > 1` | existing |
| 4. First lead | `leads COUNT >= 1` | trivial |
| 5. First prospect | `discovery_interviews WHERE status='qualified' COUNT >= 1` | depends on §4 CRM canon |
| 6. First journey | `design_journeys COUNT >= 1` | trivial |
| 7. Editorial calendar | `editorial_calendar_entries COUNT >= 1` | tabelle da censire |
| 8. First content published | `magazine_articles WHERE published_at IS NOT NULL COUNT >= 1` | OR `journal_articles` |
| 9. Custom domain | `tenant_domains WHERE kind='custom' AND verification_status='verified' COUNT >= 1` | existing |
| 10. Client portal active | composite signal: branding set + 5+ cms pages published + chameleon configured | derived |

---

## §7 · Sequencing & dipendenze

**Ordine raccomandato (linear path)** ma steps independenti dove possibile:

```
  ┌─ 1. Chameleon  ─→ 2. Profile ─→ 3. Team ─┐
  │                                            ▼
  │                                4. Lead → 5. Prospect → 6. Journey
  │
  └────────────── 7. Calendar → 8. Publish ─→ 9. Domain → 10. Portal
```

**Dipendenze rigide:**
- 5 (Prospect) richiede 4 (Lead)
- 6 (Journey) richiede 5 (Prospect) [da CRM canon]
- 10 (Portal active) richiede 1 (Chameleon) + 2 (Profile)

**Soft dependencies (consigliato):**
- 8 (Publish) raccomanda 7 (Calendar) ma non lo richiede

---

## §8 · "Founder Demo Reset" (nice-to-have)

Bonus suggerito (NO da implementare ora): un endpoint `POST /api/activation/reset-all` gated `super_admin + is_root_superadmin=true` che azzera lo state per test. Utile post-ITER174 quando il founder vuole rivivere l'esperienza onboarding.

---

## §9 · Roadmap implementativa

| Pri | Item | Effort |
|---|---|---|
| 🔴 P0 | Migration `tenant_activation` table + audit events | 0.5g |
| 🔴 P0 | Backfill da `tenant_onboarding` esistente | 0.5g |
| 🔴 P0 | Rinominare endpoint `/api/activation/*` (alias compat /tenant-onboarding/*) | 0.5g |
| 🔴 P0 | Aggiungere 4 nuovi step signals (Chameleon, Lead, Prospect, Calendar, Domain, Portal) | 1g |
| 🟠 P1 | `StudioActivationPanel` rinomina + 10 cards | 1g |
| 🟠 P1 | `ActivationProgressMeter` in header | 0.5g |
| 🟡 P2 | Step events audit UI | 0.5g |
| 🟢 P3 | Founder Demo Reset endpoint | 0.5g |

**Totale Phase 1 minima:** ~4 giorni.

---

## §10 · Vincoli di canon

| # | Vincolo | Enforcement |
|---|---|---|
| 1 | **10 step** (no più, no meno) | catalogo frozen in code |
| 2 | **Non dismissable** finché <100% | rimozione `/dismiss` endpoint + UI gate |
| 3 | **Visibile in dashboard + header** finché <100% | mount in 2 surfaces |
| 4 | **Progress % calcolato live** | derive da auto-detect + manual flags |
| 5 | **Persistente in DB** | `tenant_activation` |
| 6 | **Audit per ogni transizione** | `activation_step_events` |
| 7 | **Step CTA porta direttamente a target page** | `link` field obbligatorio |
| 8 | **Help text professionale, non tutorial** | tone editoriale, non scolastico |
| 9 | **Auto-detect priorità su manual mark** | merged state |
| 10 | **Mai bloccare l'utente** | informativo, non interruttivo |
