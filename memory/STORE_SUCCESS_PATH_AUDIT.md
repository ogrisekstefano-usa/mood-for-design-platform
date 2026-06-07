# STORE SUCCESS PATH AUDIT™ · MOOD for DESIGN™

> **Sprint**: Store Success Path Audit · READ-ONLY
> **Mission**: definire il percorso più semplice e potente per trasformare
> un cliente in un progetto approvato entro il **go-live del 4 luglio 2026**.
> **Pubblico target**: showroom · rivenditori di arredamento · consulenti
> progettuali.
> **Filtro di valutazione unico**:
> *Questo aiuta uno showroom a vendere un progetto? Se NO → posticipo post go-live.*
> **Data**: 07 Giugno 2026 · iteration 224
> **Modalità**: zero modifiche al codice · sola lettura.

---

## 0 · TL;DR

# 🟡 **PIATTAFORMA AL 60% DELLO STORE PATH**

* Le fasi **1-6** (Lead → Moodboard) sono **completamente operative**.
* Le fasi **7-10** (Material Board → Specification → Presentation → Approval)
  sono **frammentate** o **non finite**: esistono i dati lato backend ma la
  surface di vendita non esiste come surface dedicata.
* Esiste **molta funzionalità laterale** (CRM operativo · governance ·
  editoriale magazine · admin pages · cultural editions ·
  conversations · multi-locale) che NON serve allo showroom e che oggi
  rende il prodotto difficile da raccontare.

**Strategia consigliata per il 4 luglio**: una **modalità STORE** che
nasconde tutto ciò che non sta sull'asse Cliente→Approvazione, lasciando
intatto il codice (zero refactor distruttivo). 3 schermate critiche da
finalizzare: **Material Board UI**, **Specification Package**, **Client
Presentation reale** (non il wizard onboarding).

---

## A · CURRENT STATE MAP

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          STORE SUCCESS PATH · LINEARE                        │
└─────────────────────────────────────────────────────────────────────────────┘

   1. LEAD            ✅ LIVE      2. PROSPECT       ✅ LIVE       3. CLIENTE      ✅ LIVE
   ──────────────────────────      ─────────────────────────       ────────────────────────
   /begin-partnership                 /relations/prospects             /relations/accounts
   /relations/leads                                                    /workspace/clients
   /professionals/intake                                               /crm/accounts/:id
   /f/:tenantSlug/:formSlug                                            
                          │                              │                            │
                          └──────────────┬───────────────┘                            │
                                         ▼                                            ▼
   ┌───────────────────────────────────────────────────────────────────────────────┐
   │              4. BRIEF            🟡 PARZIALE                                  │
   │              ─────────────                                                    │
   │              /journey/:jid/brief                                              │
   │              · AI Studio Brief route LIVE                                     │
   │              · Mancano: questionario cliente intelligente,                    │
   │                conversion verso Design Journey con un click                  │
   └───────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
   ┌───────────────────────────────────────────────────────────────────────────────┐
   │              5. DESIGN JOURNEY     ✅ LIVE                                    │
   │              ────────────────────                                              │
   │              /studio/journey/:jid                                              │
   │              /studio/journey/:jid/step/:milestoneType                          │
   │              · Step Workspace · Milestone Dialogue · KE-005B.2 entity refs    │
   └───────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
   ┌───────────────────────────────────────────────────────────────────────────────┐
   │              6. MOODBOARD          ✅ LIVE (knowledge-native KE-005B.2)       │
   │              ────────────────                                                  │
   │              /moodboards · /moodboards/:id · /moodboard/share/:shareToken     │
   │              · EntityPicker + EntityContextPanel                              │
   └───────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
   ┌───────────────────────────────────────────────────────────────────────────────┐
   │              7. MATERIAL BOARD     ❌ MANCA UI (solo wizard onboarding)       │
   │              ──────────────────                                                │
   │              /workspace/material-boards/new (è SOLO il wizard "Prepara")      │
   │              · Backend data live via MaterialDirectionWorkspace journey-side  │
   │              · Manca: una surface autonoma per costruire una palette          │
   │                materiali da consegnare al cliente o discutere in showroom    │
   └───────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
   ┌───────────────────────────────────────────────────────────────────────────────┐
   │              8. SPECIFICATION      ❌ NON ESISTE                              │
   │              ──────────────                                                    │
   │              Nessuna route dedicata                                            │
   │              · Pezzi sparsi in `proposals.router` + `proposal_composer`        │
   │              · Manca il documento "Specification Package" come surface        │
   │                vendibile (somma di Moodboard + Material Board + Pricing)     │
   └───────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
   ┌───────────────────────────────────────────────────────────────────────────────┐
   │              9. CLIENT PRESENTATION 🟡 PARZIALE                               │
   │              ───────────────────────                                           │
   │              /workspace/presentations/new (wizard onboarding, NON real UI)    │
   │              /presentation/:shareToken (link condiviso per esterni)           │
   │              · Moodboard Presentation Mode esiste (cinematic, fullscreen)     │
   │              · Manca: cinematic UI che combina moodboard + material           │
   │                + specification in una sola consegna                           │
   └───────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
   ┌───────────────────────────────────────────────────────────────────────────────┐
   │              10. APPROVAL          🟡 PARZIALE                                │
   │              ───────────────                                                   │
   │              /review/:shareToken (per stakeholder esterni · approve/reject)   │
   │              /client/approvals (portal cliente · vede sue approvazioni)       │
   │              · Esiste `approval_state` su moodboards/journeys                 │
   │              · Manca: workflow unico "approva l'intero progetto"             │
   │                con firma o conferma legalmente valida                         │
   └───────────────────────────────────────────────────────────────────────────────┘
```

### Dettaglio · fase per fase

#### Fase 1 · LEAD
| Voce | Valore |
|------|--------|
| Schermate | `/begin-partnership` (public form) · `/relations/leads` (studio side) · `/professionals/intake` |
| Components | `LeadIntakeForm.jsx` · `LeadsListPage.jsx` · `LeadCard` |
| Backend | `routers/lead_intake.py` · `routers/leads.py` · `routers/forms.py` |
| Stato | ✅ LIVE · 107 lead reali nel tenant |
| Criticità UX | Form pubblico richiede fine-tuning per showroom (oggi forse troppo "studio") |
| Duplicati | `/relations/leads`, `/workspace/leads`, `/crm/inbox` · 3 viste alternative → POTARE 2 |

#### Fase 2 · PROSPECT
| Voce | Valore |
|------|--------|
| Schermate | `/relations/prospects` |
| Components | `ProspectsPage.jsx` (CRM list) |
| Backend | `routers/relationship_engine.py` · `routers/crm_intelligence.py` |
| Stato | ✅ LIVE · 26 prospect |
| Criticità UX | Il concetto "Prospect" non è autoesplicativo per uno showroom. Suggerimento: rinomina "Lead caldi" o "In trattativa". |

#### Fase 3 · CLIENTE
| Voce | Valore |
|------|--------|
| Schermate | `/relations/accounts` · `/workspace/clients` · `/crm/accounts/:id` |
| Components | `AccountWorkspacePage.jsx` · `RelationshipLiveTimeline.jsx` |
| Backend | `routers/client_relations.py` · `routers/account_journeys.py` |
| Stato | ✅ LIVE · 19 clienti |
| Criticità UX | 3 route alternative per "accounts" creano confusione · LEGACY_ISLAND tra `/relations/accounts` e `/crm/accounts` |

#### Fase 4 · BRIEF
| Voce | Valore |
|------|--------|
| Schermate | `/journey/:jid/brief` (BriefPage) |
| Components | `BriefPage.jsx` · `JourneyInitiate` page · `ClientBriefIntake` |
| Backend | `routers/ai_studio_brief.py` · `routers/journey_initiate.py` |
| Stato | 🟡 PARZIALE · AI brief generation esiste · il questionario cliente non è interattivo come dovrebbe |
| Criticità UX | Salto narrativo Lead → Brief poco fluido per uno showroom (manca CTA prominente "Trasforma lead in progetto") |
| Duplicati | `Brief intake` e `client_brief_intake` coesistono in storia |

#### Fase 5 · DESIGN JOURNEY
| Voce | Valore |
|------|--------|
| Schermate | `/studio/journey/:jid` · `/studio/journey/:jid/step/:milestoneType` · `/journey/preparing` · `/journey/welcome/:token` |
| Components | `StepWorkspacePage.jsx` · `MoodboardDirectionWorkspace` · `MaterialDirectionWorkspace` · `MilestoneDialogue` · `JourneyClosureCeremony` |
| Backend | `routers/design_journey.py` · `routers/journey_step_workspace.py` · `routers/milestone_dialogue.py` |
| Stato | ✅ LIVE · KE-005B.2 wirato (entity_refs su milestone) |
| Criticità UX | Il flusso ha **molti milestone type** (material_direction, moodboard_direction, site_evolution, render, hotspots, documents). Showroom probabilmente ne usa 3-4 max. |
| Duplicati | `journey_step_workspace` ridondante con `step_workspace_v2`? Verificare. |

#### Fase 6 · MOODBOARD
| Voce | Valore |
|------|--------|
| Schermate | `/moodboards` · `/moodboards/:id` · `/moodboard/share/:shareToken` |
| Components | `MoodboardEditor.jsx` (2400+ lines) · `MoodboardLibrary.jsx` · `EntityPicker` · `EntityContextPanel` |
| Backend | `routers/moodboards.py` · `routers/moodboards_v1.py` (blocks) · `routers/knowledge_surfaces.py` |
| Stato | ✅ LIVE knowledge-native |
| Criticità UX | Editor è potentissimo ma **complesso** per uno showroom. Servirebbe una "Quick Moodboard" mode (pre-template, 1-click). |
| Duplicati | `MoodboardEditor` interno + `presentation_mode` + `share` · ottimo · zero potatura |

#### Fase 7 · MATERIAL BOARD
| Voce | Valore |
|------|--------|
| Schermate | `/workspace/material-boards/new` (SOLO wizard onboarding) |
| Components | `WorkspacePreparePage.jsx` (placeholder elegante) |
| Backend | enum `material_board` in `entity_operational_usage` + hooks pronti |
| Stato | ❌ **NESSUNA UI VERA** · esiste solo lo schema |
| Gap | **P0 BLOCKER per showroom**: lo showroom DEVE poter consegnare una palette materiali in vetrina |

#### Fase 8 · SPECIFICATION PACKAGE
| Voce | Valore |
|------|--------|
| Schermate | nessuna dedicata |
| Components | `ProposalComposerPage.jsx` (per proposte commerciali separate) |
| Backend | `routers/proposals.py` · `routers/proposal_composer.py` |
| Stato | ❌ **NON ESISTE COME CONCEPT** |
| Gap | **P0 BLOCKER**: la "Specification" è il documento ufficiale che lo showroom firma con il cliente · oggi i designer devono comporlo a mano |

#### Fase 9 · CLIENT PRESENTATION
| Voce | Valore |
|------|--------|
| Schermate | `/workspace/presentations/new` (wizard onboarding) · `/presentation/:shareToken` (esterno) · moodboard `presentation_mode` (cinematic) |
| Components | `PresentationMode.jsx` (moodboard internal) · `WorkspacePreparePage` (onboarding) |
| Backend | `client_preview.py` · routing share-token |
| Stato | 🟡 PARZIALE · esiste tecnicamente ma **non è un cinematic deck cliente-ready** |
| Gap | **P0**: serve una presentazione che combini Moodboard + Material Board + Specification → 1 link che lo showroom condivide |

#### Fase 10 · APPROVAL
| Voce | Valore |
|------|--------|
| Schermate | `/review/:shareToken` (review esterno) · `/client/approvals` (cliente) |
| Components | `ClientApprovalsPage.jsx` · `ApprovalActions` (review workspace) |
| Backend | `journey_closure.py` · `moodboards.approval_state` |
| Stato | 🟡 PARZIALE · approval su moodboard funziona · approval "del progetto intero" non esiste |
| Gap | **P0/P1**: workflow "approva progetto" unificato · firma o conferma cliente formalmente valida |

---

## B · GAP ANALYSIS

### B.1 · Gap critici per il 4 luglio

| # | Gap | Impatto showroom | Priorità |
|---|-----|------------------|----------|
| G1 | **Material Board UI** non esiste come surface autonoma | Showroom non può consegnare la palette materiali al cliente | 🔴 **P0** |
| G2 | **Specification Package** non esiste | Non c'è il "documento commerciale" che chiude la trattativa | 🔴 **P0** |
| G3 | **Client Presentation reale** (non wizard) | Manca il deck cinematic che combina tutto in 1 link condivisibile | 🔴 **P0** |
| G4 | **Lead → Project conversion CTA** poco prominente | Showroom perde tempo per partire da un lead | 🟡 **P1** |
| G5 | **Approval del progetto intero** (non solo moodboard) | Cliente non ha un "firmo l'intero progetto" | 🟡 **P1** |
| G6 | **Brief intake interattivo** smart (oggi è statico) | Showroom non raccoglie info qualitative in modo guidato | 🟡 **P1** |
| G7 | **3 route alternative per Account/Client** | Confusione, training più lungo | 🟢 **P2** |
| G8 | **Pricing/Quotation** non integrato nello Specification | Showroom deve uscire dall'app per prezzi | 🟡 **P1** |
| G9 | **PDF Export presentation** non ufficiale | Cliente vuole anche il PDF nostalgico | 🟡 **P1** |
| G10 | **Mobile responsive client portal** non testato a fondo | Cliente apre da telefono in showroom | 🟢 **P2** |

### B.2 · Gap di "narrativa di vendita"

Lo showroom non lavora a "milestone" come uno studio di architettura.
Lavora a **conversion events**:
1. Cliente entra in negozio.
2. Showroom apre MOOD su iPad/desktop.
3. Mostra moodboard di un progetto simile (referenza).
4. Compila brief con il cliente in 10 minuti.
5. Crea moodboard al volo (template + 3-5 prodotti).
6. Aggiunge material board (palette).
7. Genera specification (somma + prezzi).
8. Manda link presentazione al cliente.
9. Cliente approva.

**Oggi MOOD richiede passaggi tra route diverse e modi mentali diversi.**
Il go-live mira a comprimere questo in **un unico flusso lineare**.

---

## C · REMOVE LIST · non utili al go-live 4 luglio

> Filtro: *"Aiuta uno showroom a vendere un progetto?"* · risposta NO →
> nascondere via flag (NON cancellare codice).

### C.1 · Surfaces da nascondere in modalità STORE

| Surface | Route | Motivo della rimozione | Azione |
|---------|-------|------------------------|--------|
| Cultural editions | `/workspace/cultural-editions/*` | Editoriale interno · non shop-facing | Nascondi sidebar |
| Magazine | `/magazine`, `/settings/magazine` | Magazine = brand journalism, non vendita | Nascondi sidebar |
| Editorial calendar | `/blueprint/editorial-calendar` | Pianificazione contenuti | Nascondi sidebar |
| Cultural / Design Stories | `/content/design-stories`, `/cultural` | Content marketing | Nascondi sidebar |
| Studio Pulse | `/studio-pulse`, `/dashboard/pulse` | Analytics interne | Sposta in /admin |
| Workspace Activity | `/workspace/activity` | Log tecnico | Sposta in /admin |
| Workspace Conversations | `/workspace/conversations` | Già coperta da /communications/mail | Nascondi sidebar |
| Workspace Reports | `/workspace/reports` | Reportistica interna | Nascondi sidebar |
| Workspace References | `/workspace/references` | Database interno | Nascondi sidebar |
| Journey · documents | `/journey/documents` | Sotto-pagina · accessibile in journey | OK lasciata |
| Journey · render | `/journey/render` | Feature laterale 3D | Nascondi |
| Journey · hotspots | `/journey/hotspots` | Feature laterale | Nascondi |
| Advisor workspace | `/advisor` | Per consulenti esterni · non priorità showroom | Nascondi |
| Editorial inbox | `/editorial/inbox` | Inbox editoriale | Nascondi |
| Studio Identity | `/studio-identity` | Setup brand · ok in settings | OK in settings |
| Atmospheric preview | `/dev/atmospheric-preview` | Dev tool | OK già hidden |

### C.2 · Backend routers che restano ma non hanno UI shop-facing

* `crm_voice_notes` → resta backend, UI nascosta dalla store mode
* `advisor_suggestions` → resta backend
* `editorial_variants` → resta backend (potenzialmente utile in futuro)
* `market_perspectives` → resta backend
* `magazine_*` → resta backend
* `site_evolution` → resta backend

### C.3 · Multi-locale (de/fr/es/en)

I router multi-locale (`/de/*`, `/fr/*`, ecc.) sono **utili** per
showroom internazionali, NON da rimuovere. Solo verificare che il
contenuto STORE sia tradotto.

---

## D · PRIORITY MATRIX

### 🔴 P0 · INDISPENSABILI ENTRO 4 LUGLIO

| # | Sprint | Sforzo | Note |
|---|--------|--------|------|
| P0-1 | **STORE MODE** flag (mostra solo route critiche) | 🟢 ½ giornata | gate via tenant feature flag + sidebar filter |
| P0-2 | **Material Board UI** (riusa EntityPicker + EntityContextPanel KE-005B.2) | 🟡 2-3 giorni | Surface autonoma + share link |
| P0-3 | **Specification Package surface** (somma Moodboard + Material + Pricing → 1 PDF/link) | 🔴 3-5 giorni | Componente nuovo basato su `proposal_composer` |
| P0-4 | **Client Presentation cinematic** (la vera UI · sostituisce wizard `/workspace/presentations/new`) | 🟡 2-3 giorni | Combina moodboard presentation mode + material board + specification |
| P0-5 | **Lead → Project 1-click conversion** | 🟢 1 giornata | CTA prominente in `/relations/leads/:id` |
| P0-6 | **Approve project (entire)** workflow | 🟡 2 giorni | `journey_closure` esteso · firma cliente |
| P0-7 | **Hardening Brief intake** smart questionnaire | 🟡 2 giorni | Brief diventa il punto di ingresso al journey |

**Totale P0**: ~14-18 giornate · fattibile in 4 settimane con focus.

### 🟡 P1 · IMPORTANTI MA POST 4 LUGLIO

| # | Sprint | Sforzo |
|---|--------|--------|
| P1-1 | Pricing/Quotation integrato nello Specification | 3 giorni |
| P1-2 | PDF Export elegante della Presentation | 2 giorni |
| P1-3 | Re-route potatura: unica `/clients` invece di 3 alternative | 1 giorno |
| P1-4 | Brief con domande adaptive (AI · usa universal key) | 3 giorni |
| P1-5 | Showroom dashboard quick-actions (refactor della home per pubblico negozio) | 2 giorni |
| P1-6 | KE-005C · sync-on-rename batch | 2 giorni |
| P1-7 | KPI Knowledge Adoption nella Control Room | 1 giorno |

### 🟢 P2 · POST GO-LIVE · BACKLOG

| # | Sprint |
|---|--------|
| P2-1 | Material Board + Presentation come surface knowledge-native (riuso pieno EntityPicker) |
| P2-2 | Magazine integration (per brand journalism) |
| P2-3 | Cultural Editions surface (editoriale curato) |
| P2-4 | Advisor workspace ripreso (M5) |
| P2-5 | CRM full refactor (relations/* merged) |
| P2-6 | M7 Project Impact (analytics avanzate) |
| P2-7 | Render / hotspots journey features |
| P2-8 | Multi-tenant onboarding workflow per nuovi rivenditori |

---

## E · ROADMAP UNICA SUGGERITA · "STORE PATH 4 LUGLIO"

```
SETTIMANA 1 (10-14 giu)
  · P0-1 Store Mode flag        [½ giorno]
  · P0-2 Material Board UI       [3 giorni]
  · P0-5 Lead → Project          [1 giorno]
  · P0-7 Brief hardening (start) [½ giorno]

SETTIMANA 2 (17-21 giu)
  · P0-3 Specification Package   [5 giorni]
  · P0-7 Brief hardening (end)   [1.5 giorni]

SETTIMANA 3 (24-28 giu)
  · P0-4 Client Presentation     [3 giorni]
  · P0-6 Approve Project         [2 giorni]

SETTIMANA 4 (1-4 lug)
  · QA E2E completo del flusso Cliente→Approvazione
  · Testing showroom pilot
  · Hotfix
  · Go-live ufficiale 4 luglio
```

**Risultato atteso**: una piattaforma che, in **modalità Store**, presenta
**solo le route critiche** sull'asse Cliente→Approvazione, mantenendo
tutto il resto disponibile in modalità Studio per i power-user (designer
interni, consulenti, advisor).

---

## F · LA DOMANDA UNICA · scorecard

| Funzionalità | Aiuta a vendere? | Decisione |
|--------------|------------------|-----------|
| Dashboard editoriale (KE-005B post) | ✅ sì | TIENI |
| Lead intake form pubblico | ✅ sì | TIENI |
| Relations/Accounts | ✅ sì | TIENI (semplifica a 1 route) |
| Brief intake | ✅ sì | TIENI + hardening |
| Design Journey workspace | ✅ sì (semplifica milestone) | TIENI |
| Moodboard editor | ✅ sì | TIENI |
| Material Board | ✅ sì (DA COSTRUIRE) | P0 BUILD |
| Specification Package | ✅ sì (DA COSTRUIRE) | P0 BUILD |
| Client Presentation cinematic | ✅ sì (DA COMPLETARE) | P0 BUILD |
| Approval flow | ✅ sì (DA COMPLETARE) | P0 BUILD |
| Client portal `/client/*` | ✅ sì | TIENI |
| Brand Atlas / Knowledge Engine | ✅ sì (la chiave differenziante) | TIENI |
| CRM Voice Notes | 🟡 nice-to-have | NASCONDI per ora |
| Magazine / Cultural / Editorial | ❌ no | NASCONDI · P2 |
| Studio Pulse / Reports / Activity | ❌ no | NASCONDI · P2 |
| Advisor workspace | ❌ no | NASCONDI · P2 |
| Workspace References | ❌ no | NASCONDI · P2 |
| Render / Hotspots journey | ❌ no | NASCONDI · P2 |
| 3 alternative per accounts/leads | ❌ no | RIDUCI a 1 |

---

## G · CONCLUSIONE

# 🎯 **Per arrivare al 4 luglio servono 3 nuove surface vere e 1 store mode flag.**

1. **STORE MODE flag**: nasconde TUTTE le funzionalità che non aiutano a
   vendere un progetto. Reversibile, non distruttivo.
2. **Material Board UI**: la palette materiali consegnabile al cliente.
3. **Specification Package**: il documento ufficiale di trattativa.
4. **Client Presentation cinematic**: il deck pieno (moodboard +
   material + specification) condivisibile in 1 link.

Tutto il resto (Magazine · Cultural · Advisor · Reports · Activity ·
Hotspots · Render · Multi-account) → **disabilitato in modalità Store**
fino a quando uno showroom non chiederà esplicitamente quella capacità.

Il **Knowledge Engine + KE-005B.2 Knowledge-Native Surfaces** già fatto
è il vero **vantaggio competitivo MOOD** rispetto a soluzioni standard
(Pinterest · SampleBoard · Morpholio). Materiali, prodotti e designer
sono certificati, non snapshot. Una modifica si propaga ovunque. Questa
è la storia che lo showroom racconta al cliente.

---

> **Firma report**: Main Agent · iteration 224 · 07 Jun 2026 22:15 UTC
> **Modalità**: READ-ONLY · zero modifiche al codice
> **Sprint precedenti rilevanti**: KE-005B.1 Foundation · KE-005B.2 Surfaces UI
> **Test credentials**: `admin@moodfordesign.com` / `Blueprint2024!`
