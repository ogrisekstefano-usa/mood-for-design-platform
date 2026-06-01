# DASHBOARD INFORMATION ARCHITECTURE FIX — ITER181.C

**Sprint:** ITER181.C · Dashboard Governance Fix™  
**Data chiusura:** 2026-06-01  
**Scope:** mappa finale della dashboard, gerarchie, transizioni, ridondanze rimosse.

---

## 1 · Principio guida

> Una sola superficie. Una sola gerarchia. Una sola azione operativa.  
> Niente blocchi visivamente o concettualmente duplicati per la stessa funzione.

---

## 2 · Ridondanze risolte

### A · Sezione "Setup Workspace" vs "Activation Foundation"

| Prima | Dopo |
|---|---|
| 2 blocchi separati con stessi step | **1 blocco unico** `WorkspaceActionHub` |
| Activation Foundation card + Quick Actions card | **1 contenitore con HEADER (progress) + BODY 70/30 (Checklist | Azioni rapide)** |

### B · CTA "Nuova Relazione" sparpagliata

| Prima | Dopo |
|---|---|
| Topbar `+ Nuova Relazione` (sempre uguale) | Topbar smart: **+ Nuovo Lead** (prospects=0) · **+ Nuovo Design Journey** (prospects>0) |
| Sidebar Active Journey Rail empty CTA "Apri Nuova Relazione →" | (rimossa · empty state ora solo testuale) |
| Quick Action "Nuova Relazione" | (sostituita da entità reali: Nuovo Lead, Nuovo Design Journey) |

### C · Indice Journey / Inizia un Journey / Apri Nuova Relazione

3 modi diversi di indicare la stessa cosa nella sidebar.  
Risolto in **2 voci coerenti**:
- `Design Journey` (lista)
- `+ Nuovo Design Journey` (azione)

### D · Quick Actions stand-alone in fondo alla pagina + Recommended Actions dopo Activation

| Prima | Dopo |
|---|---|
| `RecommendedActions` sotto Activation + `QuickActions` in fondo | **1 sola fonte di Quick Actions** dentro il `WorkspaceActionHub` (setup) o come sezione standalone (ready) |

---

## 3 · Mappa finale della dashboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│ PERSISTENT ALERT BANNER (sticky, dismissable 24h)                        │
│ Setup workspace · 2/5 · [next step title] · [next step desc] · [CTA pill]│
└─────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────┐
│ TOPBAR                                                                   │
│ [Workspace pill] [Dashboard nav] ............... [+ Nuovo Lead] [profile]│
└─────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────┐
│ HERO                                                                     │
│ DASHBOARD OPERATIVA · Buongiorno, Stefano. · {N} Lead · {N} Prospect ... │
│ [KPI Lead] [KPI Prospect] [KPI Clienti] [KPI Journey attive]             │
└─────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────┐
│ WORKSPACE ACTION HUB (setup mode, sparirà al 5/5)                        │
│ SETUP WORKSPACE · 2/5 completati · [progress bar]                        │
│ ┌─────────────────────────────────┬─────────────────────────────────┐    │
│ │ CHECKLIST (70%)                 │ AZIONI RAPIDE (30%)             │    │
│ │ ✓ 0. Identità operativa         │ + Nuovo Lead                    │    │
│ │ ○ 1. Blueprint Chameleon  [CTA] │ + Nuovo Design Journey          │    │
│ │ ○ 2. Team                 [CTA] │ Media Library                   │    │
│ │ ○ 3. Mercato operativo    [CTA] │ Material View                   │    │
│ │ ○ 4. Workspace attivo     [CTA] │ Calendario Editoriale           │    │
│ └─────────────────────────────────┴─────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                          ↓ (al 5/5 il blocco scompare)
┌─────────────────────────────────────────────────────────────────────────┐
│ QUICK ACTIONS (sezione standalone, post-setup) [dynamic per scenario]    │
│ [Apri Journey][+ Nuovo Journey][Materiali][Moodboard][Calendario]        │
└─────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────┐
│ DESIGN JOURNEY ATTIVE                                       Vedi tutte → │
│ [Card Journey 1] [Card Journey 2] [Card Journey 3] [Card Journey 4]      │
│ (empty: "Nessuna Design Journey attiva.")                                │
└─────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────┐
│ DESK 2-COL                                                               │
│ ┌─────────────────────────────────┬─────────────────────────────────┐    │
│ │ ATTIVITÀ RECENTI                │ PROSSIME SCADENZE               │    │
│ └─────────────────────────────────┴─────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────┐
│ ATTIVITÀ RELAZIONALI (live timeline)                                     │
│ Pending Bookings · Live polling 5s                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4 · State machine — transizioni della dashboard

| Stato | Hub visible? | Standalone Quick Actions? | KPI hero | Scenario Quick Actions |
|---|---|---|---|---|
| Setup 0–4/5 | ✅ setup mode | ❌ | tutti 0 (probabilmente) | calcolato da business_counts |
| Setup 5/5 (activated) | ❌ scompare | ✅ full-width | popolato | Scenario A→D dinamico |

Transizione: passare da 4/5 a 5/5 fa scomparire il blocco e promuove le Quick Actions a sezione operativa permanente.  
**Niente "buco" visivo:** la dashboard si **densifica** non si svuota.

---

## 5 · Quick Actions logic (Next-Best-Action)

```
if (active_journeys > 0)   → Scenario D
elif (prospects > 0)       → Scenario C
elif (leads > 0)           → Scenario B
else                       → Scenario A
```

| Scenario | Trigger | Card 1 (next-best) | Cards seguenti |
|---|---|---|---|
| A | studio vuoto | **+ Nuovo Lead** | + Nuovo Design Journey · Media Library · Material View · Calendario Editoriale |
| B | leads>0, prospects=0 | **Qualifica Prospect** | + Nuovo Lead · Media Library · Calendario Editoriale |
| C | prospects>0, journeys=0 | **+ Nuovo Design Journey** | Media Library · Material View · Calendario Editoriale |
| D | journeys>0 (regime) | **Apri Journey** | + Nuovo Design Journey · Materiali · Moodboard · Calendario Editoriale |

---

## 6 · Topbar primary CTA (smart switch)

```
if (business_counts.prospects > 0)
    label = "+ Nuovo Design Journey™"
    modal_args = { choice: 'prospect' }
else
    label = "+ Nuovo Lead"
    modal_args = { choice: 'lead' }
```

---

## 7 · Sidebar (post-rebrand)

| Sezione | Items |
|---|---|
| Workspace | Dashboard · Workspace · Calendar · Calendar Light |
| **Design Journey** (era "Studio Pulse" + "Indice Journey" + "Inizia un Journey") | Design Journey · + Nuovo Design Journey |
| CRM | Leads · Prospects · Accounts · Clienti |
| Library | Media Library · Materiali · Moodboard |
| Editorial | Calendario Editoriale · Cultural Editions · Copy CMS |
| Settings | Identità · Team · Languages |

---

## 8 · Pagina Leads · IA fix

| Elemento | Cambiamento |
|---|---|
| Hero CTA primaria | aggiunta **+ Nuovo Lead** nel toolbar (mai esistita prima) |
| Filtri toolbar | rimossi i 5 filter chips fake (warm_editorial, nordic_silence, midnight_mood, mediterranean_light, architectural_dawn) |
| Search input | invariato (è un filtro reale che funziona) |
| Reset chip | mostrato solo se `q != ''` |
| Result bar | conteggio + plurale italiano corretto |
| Empty state | testuale + invito a usare la CTA primaria |

---

## 9 · Decisioni di architettura

1. **Single source of Quick Actions**: una sola fonte (`getQuickActionsForState` in `WorkspaceActionHub.jsx`). Il setup-mode la rende in colonna 30%; il ready-mode la rende in rail full-width 5-up. **Niente duplicazione**.
2. **Hub scompare a 5/5**: il blocco è onboarding-driven; finito l'onboarding non ha più ragione di esistere. Le sue Quick Actions migrano a sezione standalone — la dashboard diventa **purely operational**.
3. **Topbar CTA è smart**: una sola pill che cambia label/azione in base allo stadio del funnel; il founder non deve mai cercare la prossima azione altrove.
4. **Niente filtri se non ci sono filtri**: principio applicato alla pagina Leads. Se in futuro nasceranno filtri reali (es. fonte = showroom/sito/referral/architetto), saranno aggiunti — ma mai placeholder.
5. **Empty state = 1 frase**: niente narrazione. La gerarchia ottica resta forte anche su una pagina vuota.

---

## 10 · Follow-up · P1 successivi (fuori scope ITER181.C)

| Item | Priorità | Note |
|---|---|---|
| **Lead Wizard 5-step** | **P1** | Problem 5 del brief utente: STEP 1 Chi è · STEP 2 Da dove arriva (showroom/sito/referral/architetto/evento/social/altro) · STEP 3 Cosa cerca (cucina/living/bagno/pietra/interior/contract/altro) · STEP 4 Note · STEP 5 Salva. Da costruire come nuovo `NewLeadWizardModal` o come estensione del `NewRelationshipModal` esistente. |
| App-wide Naming Lock | P1 | Estendere il refactor "Studio Pulse" / "Nuova Relazione" / "atmosfera" a moduli non-dashboard (CrmAccountsPage, RelationshipsPage, JourneyPulsePage, CommandPalette, Moodboard, Inspirations, CulturalEditionReview). |
| Journey Assignments Phase 2 | P1 | UI drawer + Team cards + "Le mie journey". |
| Notification Bus | P1 | Sistema notifiche unificato. |
| Editorial Onboarding | P1 | `editorial_demo_catalog` con 3 contenuti demo read-only. |
| Error Registry completo | P1 | Codici `DOMAIN-NNN` + interceptors axios + i18n mapping. |
| Quick Actions Insight micro-suggerimento | P2 | "Action Insight" 1-riga sotto la prima Quick Action, contestuale al funnel (es. "3 Lead in attesa di Discovery da > 7 giorni"). |
| Client Chameleon avanzato | P2 | — |

---

**Mappa IA dashboard finalizzata. La gerarchia è chiara, le ridondanze sono eliminate, le transizioni di stato sono fluide e non lasciano vuoti.**
