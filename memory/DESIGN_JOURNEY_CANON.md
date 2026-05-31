# DESIGN JOURNEY CANON™
## Il documento fondativo di MOOD for DESIGN

> **Status:** 🔒 STRATEGIC FOUNDATION · 31 May 2026 · zero modifica codice/DB/migration/API
> **Companion canon docs:**
>   - `CRM_LIFECYCLE_CANON.md` (Lead → Discovery → Prospect → Journey)
>   - `JOURNEY_ASSIGNMENTS_ARCHITECTURE.md` (owner / contributor / observer)
>   - `TEAM_LIFECYCLE_AUDIT.md` (Team Foundation)
>   - `BLUEPRINT_CHAMELEON_AUDIT.md` (6 preset Studio + Client separation)
>   - `STUDIO_ACTIVATION_ARCHITECTURE.md` (10 step founder)
>   - `EDITORIAL_ONBOARDING_SPEC.md`
>   - `ERROR_REGISTRY_SPEC.md`
>
> **Questo documento è la legge.** Tutto il resto della piattaforma deve essere coerente con il modello qui definito.

---

## 0 · EXECUTIVE SUMMARY

La **Design Journey™** è il cuore di MOOD for DESIGN: il singolo asse intorno a cui ruotano CRM, Team, Client Portal, Moodboard, Brief, Materials, Conversations, Appointments, Editorial, Notifications, AI Assistant.

**3 verità fondative:**

1. **Una Journey non nasce mai da sola.** Nasce sempre dopo un atto di qualifica — sia esplicito (Discovery completata) sia implicito (form pubblico Begin Journey che agisce come Discovery condensata).

2. **Una Journey ha sempre 2 lati.** Il **lato studio** (team, ownership, materials, governance) e il **lato cliente** (brief guidato, conversazione, atmosfera). I due lati condividono dati ma vedono visualizzazioni filtrate.

3. **Una Journey è un organismo vivo che attraversa stati canonici.** Non è un ticket. Non è un progetto chiuso. È un percorso editoriale che ha ritmo, evoluzione, gravità, milestones, atmosfera.

**Risposta canonica alla domanda principale:**

> *"Quando un cliente entra in negozio (showroom, sito, referral, evento), il team raccoglie un **Lead**. Una **Discovery Interview™** trasforma il Lead in **Prospect**. Il Prospect autorizza l'apertura di una **Design Journey™**: il team studio assegna **owner + contributor + observer**, comunica al cliente un **Referente Principale** (visibile), e apre il **portale cliente** con Brief Guidato, Moodboard, Conversazione, Atmosfera. La Journey evolve attraverso 9 stati canonici (Opened → Discovery → Concept → Moodboard → Proposal → Approval → Execution → Delivery → Completed), genera eventi che alimentano notification bus + timeline + activity feed, ha un Health Model che monitora salute (attività, milestone, conversazione, materiale). Si conclude in 1 di 3 modi: **Completed** (success), **Closed-Lost** (cancellata), **Archived** (terminata dopo Completed). Il cliente sperimenta tutto questo come un'esperienza editoriale guidata, mai come un workflow gestionale."*

---

## 1 · QUANDO NASCE UNA DESIGN JOURNEY™

### 1.1 · Ingressi possibili (8 path canonici)

| Path | Origine | Trigger | Discovery? |
|---|---|---|---|
| **P1 · Public Form** | Sito storefront pubblico (Begin Journey) | Cliente compila il welcome form | Implicita (form contiene qualifica) |
| **P2 · Manual Lead** | Team importa un contatto (call, evento, sito esterno) | Designer/Sales crea Lead manuale | Esplicita (`discovery_interviews` row) |
| **P3 · Showroom Walk-in** | Cliente entra fisicamente | Team registra il contatto su tablet/laptop | Esplicita (Discovery sul posto) |
| **P4 · Referral** | Cliente esistente raccomanda | Team crea Lead con `source='referral'` + `referrer_id` | Esplicita o accelerata |
| **P5 · Architect / Interior Designer Partner** | Professionista esterno porta il cliente | Team crea Lead con `lead_type='partner_referral'` | Esplicita ma collaborativa |
| **P6 · Cliente esistente** | Account già `lifecycle_stage='customer'` apre nuovo progetto | Team apre direttamente Journey N+1 | **SKIP Discovery** |
| **P7 · A&D Partner Network** | Partner di rete porta cliente | Workflow simile a P5 ma tracked nel modulo Advisor (oggi FROZEN ITER173) | Esplicita |
| **P8 · Magazine Lead** | Lettore Magazine richiede info | Lead da `magazine_anonymous_leads` → conversione | Esplicita |

### 1.2 · Modello canonico

**Una Design Journey™ nasce sempre via uno dei due gate:**

```
GATE A · Qualifying Gate          GATE B · Returning Customer Gate
─────────────────────             ─────────────────────────────
Lead → Discovery → Prospect      Customer (account.lifecycle='customer')
       ↓                                          ↓
       qualified()                          open_new_journey()
       ↓                                          ↓
       PROSPECT (account.lifecycle='prospect') ← entrambi convergono
                       ↓
                  Open Journey™
```

**Regola assoluta:** NESSUNA Journey nasce da `lead.status != 'qualified'`. Una Journey richiede sempre un account `lifecycle_stage ∈ {'prospect', 'customer'}`.

### 1.3 · Eventi di nascita

Quando una Journey nasce, il sistema emette in ordine:
1. `journey.created` (audit)
2. `assignment.owner_assigned` (Journey Assignments — auto-owner del referente)
3. `human_assignment.created` (referente account-level se non esiste)
4. `client_provisioning.thread_opened` (relationship thread)
5. `email.welcome_sent` (template `space_ready:locale`)
6. `magic_link.generated` (per primo accesso cliente)
7. `activation_step.first_journey_opened` (toggle nello Studio Activation™)
8. `notification.dispatch` (al referente + contributors)

---

## 2 · CHI PUÒ CREARE UNA DESIGN JOURNEY™

### 2.1 · Matrice autorizzazione

| Ruolo | Può aprire Journey? | Tramite | Note |
|---|---|---|---|
| **`super_admin` / Founder** | ✅ Sì | UI Modal "+ Nuova Relazione" + public form + API | full access |
| **`tenant_admin`** | ✅ Sì | idem | manager dello studio |
| **`project_manager`** | ✅ Sì | idem | apre journey su prospect/customer |
| **`designer`** | ✅ Sì | UI Modal "+ Nuova Relazione" | può aprire ma di solito è assegnato post-creazione |
| **`creative_director`** | ✅ Sì | idem | come `project_manager` |
| **`material_specialist`** | ⚠️ No (default) | — | può solo contribuire a una journey aperta |
| **`account_director`** | ✅ Sì | UI Modal | spesso è chi qualifica il prospect |
| **`sales`** | ✅ Sì (post-qualifica) | UI Modal | apre journey su prospect che ha qualificato |
| **`editor`** | ❌ No | — | content/editorial role |
| **`analyst`** | ❌ No | — | read-only |
| **`ad_partner`** | ❌ No | — | external partner read-only |
| **`advisor`** | ❌ No (frozen) | — | modulo frozen ITER173 |
| **`observer`** | ❌ No | — | sola lettura |
| **`client`** | ❌ No direttamente | — | indirettamente via Public Form (P1) |

### 2.2 · Permission canonico

```
P_JOURNEY_CREATE = "journey:create"
   ↓
Granted to: super_admin, tenant_admin, project_manager, designer,
            creative_director, account_director, sales
```

### 2.3 · Constraint operativi
- Una journey **viene sempre creata su un account specifico** (FK `design_journeys.account_id NOT NULL`).
- Il creatore (`design_journeys.created_by`) **non è automaticamente owner**: l'owner viene assegnato via `design_journey_assignments` (ITER178).
- Una journey **può essere creata su un account suspended** ma il sistema deve mostrare un warning.

---

## 3 · STATI UFFICIALI DELLA JOURNEY™

### 3.1 · 9 stati canonici (`design_journeys.lifecycle_state`)

```
[opened] → [discovery] → [concept] → [moodboard] →
[proposal] → [approval] → [execution] → [delivery] → [completed]
                              ↓                ↓
                         [on_hold]       [closed_lost]
                              ↓
                          [archived]
```

| # | Stato | Descrizione | Surface principale | Trigger di entrata |
|---|---|---|---|---|
| 1 | `opened` | Journey appena aperta, primo contatto in corso | Conversazione · Brief vuoto | `journey.created` |
| 2 | `discovery` | Cliente sta compilando brief / il team raccoglie informazioni | Brief Guidato (cliente) · Discovery panel (team) | `brief.started` o `discovery_interview.opened` |
| 3 | `concept` | Team elabora concept direction (palette, mood, tipologia) | Moodboard draft · Concept board | `concept.started` (manual gate) |
| 4 | `moodboard` | Moodboard condiviso con cliente, iterazioni in corso | Moodboard collaboration · Conversazione | `moodboard.shared_with_client` |
| 5 | `proposal` | Proposta tecnica/economica preparata | Proposal editor · Materials picker | `proposal.draft_created` |
| 6 | `approval` | Cliente sta valutando, in attesa firma | Proposal viewer (cliente) · Approval tracker (team) | `proposal.shared` |
| 7 | `execution` | Lavoro effettivo in corso (cantiere, produzione, sourcing) | Milestones · Documents · Appointments | `proposal.approved` |
| 8 | `delivery` | Consegna finale, controllo qualità, walkthrough cliente | Final walkthrough · Sign-off | `execution.completed` |
| 9 | `completed` | Journey conclusa con successo, in cooling-off | Read-only summary · Testimonial request | `delivery.signed_off` |

### 3.2 · Stati eccezionali

| Stato | Significato | Reversibile? |
|---|---|---|
| `on_hold` | Sospensione temporanea (cliente in viaggio, decisione in attesa, partner in standby) | ✅ → torna allo stato precedente |
| `closed_lost` | Journey cancellata prima del completamento (cliente abbandona, proposta rifiutata) | ❌ |
| `archived` | Journey `completed` da >180 giorni → archiviata (cold storage UI) | ✅ → può essere unarchived per upsell |

### 3.3 · Regole di transizione

- **Forward-only** salvo: `on_hold → previous_state` (recovery), `archived → completed` (unarchive)
- **Skip-allowed**: alcuni stati possono essere saltati (es. cliente high-trust può saltare `proposal` → `approval` se il team usa quotation orale)
- **Owner gate**: solo `owner` (e `super_admin`/`tenant_admin`) può promuovere stato
- **Audit obbligatorio**: ogni transizione genera `journey_lifecycle_events` row + notification

### 3.4 · Velocità tipica per stato (KPI baseline)

| Stato | Durata sana | Trigger warning Health |
|---|---|---|
| `opened` | 0–3 giorni | > 7 giorni senza attività |
| `discovery` | 1–7 giorni | > 14 giorni senza brief completion |
| `concept` | 3–14 giorni | > 21 giorni senza moodboard |
| `moodboard` | 7–21 giorni | > 28 giorni di iterazione senza approval |
| `proposal` | 3–7 giorni | > 14 giorni dalla concept approval |
| `approval` | 1–14 giorni | > 21 giorni senza decisione |
| `execution` | 30–180 giorni | dipende dal tipo progetto |
| `delivery` | 3–14 giorni | > 21 giorni dopo execution completion |
| `completed` | indefinito (post-success) | — |

---

## 4 · RELAZIONE CRM ↔ JOURNEY™

### 4.1 · Mapping entità → stato

```
LEADS                                    DESIGN_JOURNEYS
─────                                    ───────────────
status='new'           ❌ NO journey
status='in_discovery'  ❌ NO journey         ← (Discovery Interview™ aperta)
status='qualified'     ✅ può aprire ──→     ACCOUNT.lifecycle_stage='prospect'
status='unqualified'   ❌ chiusa
                                              ↓
                                         JOURNEY.lifecycle_state='opened'
                                              ↓
                                         (evolve attraverso 9 stati)
                                              ↓
                                         JOURNEY.lifecycle_state='delivery'
                                              ↓
                                       PROPOSAL signed                  
                                              ↓
                                         ACCOUNT.lifecycle_stage='customer'
                                              ↓
                                         JOURNEY.lifecycle_state='completed'
                                              ↓
                                         eventuale nuovo journey su stesso account
```

### 4.2 · Eventi che cambiano stato CRM

| Evento Journey | Effetto CRM |
|---|---|
| `discovery_interview.qualified()` | `lead.status='qualified'` + `account.lifecycle_stage='prospect'` |
| `proposal.signed_by_client` | `account.lifecycle_stage='customer'` |
| `journey.closed_lost` | `account.lifecycle_stage='churned'` (se era prospect) |
| `journey.archived` | nessun effetto CRM |

### 4.3 · Account ricorrenti

Un `account.lifecycle_stage='customer'` può avere:
- 1 journey attiva contemporanea (canonico)
- N journey storiche `lifecycle_state ∈ {completed, archived}`
- **Mai 2 journey attive sullo stesso account** (regola: aprire un'estensione richiede chiudere/completare la precedente, oppure marcarla `on_hold`)

---

## 5 · CHI VEDE COSA (Visibility Matrix)

### 5.1 · Per attore × fase

Legenda: 🟢 vede tutto · 🟡 vede filtrato · ⚪ vede meta-info · ❌ non vede

| Fase Journey | Founder/Admin | Owner | Contributor | Observer | Client | Sales | Material Spec |
|---|---|---|---|---|---|---|---|
| `opened` | 🟢 | 🟢 | 🟢 | 🟡 | 🟡 (welcome) | 🟡 (pipeline) | ❌ |
| `discovery` | 🟢 | 🟢 | 🟢 | 🟡 | 🟢 (brief guidato) | 🟡 | ❌ |
| `concept` | 🟢 | 🟢 | 🟢 | 🟡 | 🟡 (atmosfera teaser) | ❌ | 🟡 (su richiesta) |
| `moodboard` | 🟢 | 🟢 | 🟢 | 🟡 | 🟢 (versione cliente) | ❌ | 🟡 |
| `proposal` | 🟢 | 🟢 | 🟢 | 🟡 | ❌ (fino a `proposal.shared`) | 🟡 | 🟡 |
| `approval` | 🟢 | 🟢 | 🟢 | 🟡 | 🟢 (viewer proposta) | 🟡 | ❌ |
| `execution` | 🟢 | 🟢 | 🟢 | 🟡 | 🟡 (milestones + foto) | ❌ | 🟢 (sourcing) |
| `delivery` | 🟢 | 🟢 | 🟢 | 🟡 | 🟢 (final walkthrough) | ❌ | 🟢 |
| `completed` | 🟢 | 🟢 | 🟢 | 🟡 | 🟢 (read-only summary) | ⚪ | ⚪ |

### 5.2 · Visibilità cliente — Cosa vede SEMPRE

- **Atmosfera Journey** (Client Chameleon™ preset assegnato dalla owner)
- **Referente principale** (1 persona — l'`assignee_user_id` di `human_assignments`)
- **Membri Team con `client_visible=true`** in `design_journey_assignments`
- **Conversazione** (thread + messaggi `client_visible=true`)
- **Brief Guidato** (proprio brief, sempre)
- **Atmosphere preview** (palette, moodboard cliente-version)
- **Proposal** (quando `proposal.shared`)
- **Milestones pubblici** (filtered)
- **Final walkthrough** (in `delivery`)

### 5.3 · Visibilità cliente — Cosa NON vede MAI

- **Email, phone, last_login_at** dei team member
- **Internal notes** (campo `internal_notes` su qualsiasi entità)
- **Discovery scoring** (`discovery_interviews.qualification_signals`)
- **Proposal margins / cost breakdown** (solo gli importi finali)
- **Conversazioni interne team** (thread con `is_internal=true`)
- **Observer roles** (mai)
- **Tenant admin/super_admin** (default — toggle `tenant_settings.show_founder_in_team`)
- **Materials sourcing details** (chi, da dove, a quanto)
- **Other clients** (isolamento totale)

### 5.4 · Visibilità founder

Il Founder vede tutto. Sempre. Senza eccezioni. È il superuser per design — non per UX. La superuser-ità è strumentale: governance, audit, intervento d'emergenza.

---

## 6 · REFERENTE vs TEAM

### 6.1 · Due sistemi indipendenti che coesistono

```
┌─────────────────────────────────────────┐
│ human_assignments                       │
│ ─────────────────                       │
│ subject_type='client'                   │
│ subject_id=client_profile_id            │
│ assignee_user_id=<UNICO>                │
│                                         │
│ → Il REFERENTE master del CLIENTE       │
│   (vale per TUTTE le sue journey)       │
└─────────────────────────────────────────┘
                  +
┌─────────────────────────────────────────┐
│ design_journey_assignments              │
│ ─────────────────────────────           │
│ journey_id, user_id, assignment_role    │
│ (owner | contributor | observer)        │
│                                         │
│ → Il TEAM della JOURNEY specifica       │
│   (può differire tra journey diverse)   │
└─────────────────────────────────────────┘
```

### 6.2 · Regole canonical

| Domanda | Risposta canonica |
|---|---|
| **Chi è il referente del cliente?** | `human_assignments.assignee_user_id` per `subject_type='client'` (1 persona unica per cliente, indipendente da quante journey ha) |
| **Quando cambia il referente?** | Manualmente dal team via "Riassegna referente". Eventi: `human_assignment.reassigned`. |
| **Il cliente vede il referente?** | ✅ SÌ sempre (`/api/client/welcome-summary.referente`) |
| **Il cliente vede il team della journey?** | ✅ SÌ ma filtrato (`/api/client/journeys/{jid}/team` con `client_visible=true`) — vedi §5.2 |
| **Il referente è automaticamente owner della journey?** | Default sì (auto-owner ITER178). Può essere disaccoppiato manualmente |
| **Il founder è visibile?** | ❌ Default NO. Toggle `tenant_settings.show_founder_in_team` |
| **Un cliente può avere referente A e journey owner B?** | ✅ Sì (caso comune: Stefano è referente master ma Designer A è owner della specifica journey) |
| **Cosa succede se referente viene suspeso?** | Auto-revoke + alert founder per riassegnazione. Journey owner separato resta. |

### 6.3 · Cascade visibility

Quando il client opens journey:
```
1. Verifica `human_assignments.assignee_user_id` → mostra come "Referente"
2. Verifica `design_journey_assignments WHERE journey_id=X AND client_visible=true`
3. Se referente == journey owner → collapse a 1 card "Referente + Owner"
4. Se diversi → mostra 2 schede: "Referente" + "Owner della Journey"
5. Mostra contributors visibili sotto, observers MAI mostrati
```

---

## 7 · DESIGN JOURNEY DASHBOARD™ (i pilastri concettuali)

A livello concettuale, una Journey è composta da **8 pilastri** (NON 8 pagine UI — 8 concetti):

### 7.1 · I pilastri canonici

| # | Pilastro | Significato | Surfaces (esempi) |
|---|---|---|---|
| 1 | **Brief** | Cosa il cliente vuole, come si esprime | BriefGuidedPage, Voice Journal |
| 2 | **Mood** | L'atmosfera condivisa, palette, references | Moodboard, Inspirations, Atelier Atmosphere |
| 3 | **Materials** | Catalogo dei materiali scelti | Materials picker, Brand registry, Supplier catalogs |
| 4 | **Conversations** | Il flusso umano studio↔cliente | Thread, Messages, AI Assistant |
| 5 | **Milestones** | Tappe temporali del progetto | Timeline, Calendar, Deadlines |
| 6 | **Documents** | Proposta, fatture, sign-off, foto stato | Document vault, signed proposals, photo gallery |
| 7 | **Appointments** | Incontri programmati (showroom, sopralluoghi, walkthrough) | Calendar, Call Me Back™, Showroom visits |
| 8 | **Deliverables** | Gli output finali consegnati | Final walkthrough, sign-off, testimonial |

### 7.2 · Mapping pilastro × stato Journey

| Pilastro | Domina nello stato |
|---|---|
| **Brief** | `discovery` |
| **Mood** | `concept`, `moodboard` |
| **Materials** | `moodboard`, `proposal`, `execution` |
| **Conversations** | TUTTI |
| **Milestones** | `execution`, `delivery` |
| **Documents** | `proposal`, `approval`, `delivery` |
| **Appointments** | `discovery`, `execution`, `delivery` |
| **Deliverables** | `delivery`, `completed` |

### 7.3 · Pilastri visibili al cliente

| Pilastro | Visibile cliente | Modalità |
|---|---|---|
| Brief | ✅ | Editing proprio brief |
| Mood | ✅ (cliente version) | Lettura + commento |
| Materials | 🟡 | Solo materiali shared esplicitamente |
| Conversations | ✅ | Thread principale |
| Milestones | 🟡 | Filtered (public-facing) |
| Documents | ✅ (filtered) | Proposta, sign-off, final |
| Appointments | ✅ | Calendario suo |
| Deliverables | ✅ | Output finali |

---

## 8 · CLIENT PORTAL™ — Il percorso ideale del cliente

### 8.1 · Timeline cliente (T0 → T-final)

```
T+0    Magic-link arriva via email "Spazio pronto"
T+1m   Click → ClientWelcomePresetPage (lessico studio, atmosfera Chameleon)
T+5m   Vede il proprio Referente + benvenuto editoriale
T+10m  Compila Brief Guidato™ (rooms, budget, timing, files, voice notes)
T+1d   Riceve risposta dal Referente in Conversazione
T+3d   Vede primo concept atmospheric (palette teaser)
T+1w   Vede Moodboard versione cliente → commenta
T+2w   Iterazioni Moodboard
T+3w   Riceve Proposal completa (proposal viewer)
T+4w   Firma proposta → diventa cliente confermato
T+ESEC Riceve aggiornamenti milestones + foto cantiere
T+END  Final walkthrough scheduling
T+END  Sign-off finale
T+30d  Testimonial request (read-only journey summary)
```

### 8.2 · Esperienza cliente per stato Journey

| Stato Journey | UX cliente |
|---|---|
| `opened` | Welcome screen + Referente avatar + "Compila il tuo Brief" CTA |
| `discovery` | Brief Guidato wizard + Voice Journal + uploads + Conversazione attiva |
| `concept` | Atmosphere teaser (palette anteprima) + "Il tuo team sta lavorando" status |
| `moodboard` | Moodboard cliente version (commentabile) + iterazione references |
| `proposal` | Conversazione + "Proposta in arrivo" status |
| `approval` | Proposal viewer (interattivo) + Firma digitale + Q&A |
| `execution` | Milestone timeline + foto cantiere + Call Me Back™ + Appointments |
| `delivery` | Final walkthrough scheduling + checklist sign-off |
| `completed` | Journey summary read-only + Testimonial request + opzione "Open new journey" |

### 8.3 · 4 pilastri non-negoziabili nell'esperienza cliente

1. **Atmosfera** — il cliente sperimenta SEMPRE un'estetica curatoriale, mai un form business
2. **Referente umano** — ogni surface mostra l'avatar del referente, mai bot interfaccia
3. **Brief sempre accessibile** — il cliente può tornare al suo brief in qualsiasi stato
4. **Conversazione persistente** — il thread è canale primario in TUTTI gli stati

---

## 9 · TEAM WORKSPACE™ — Il percorso ideale del designer

### 9.1 · Timeline designer (dall'assegnazione alla chiusura)

```
T+0    Notification: "Sei stato assegnato alla Journey X" (event journey.assigned_to_me)
T+1m   Apre AssignedClientsPanel → vede la card cliente
T+1m   Apre /workspace/journeys/mine → vede la journey
T+5m   Apre journey detail → vede 8 pilastri popolati
T+5m   Legge il Brief
T+5m   Risponde al primo messaggio
T+1d   Crea Moodboard draft
T+3d   Condivide Moodboard con cliente
T+1w   Riceve commenti, itera
T+2w   Convoca Material Specialist (contributor)
T+3w   Apre Proposal editor
T+4w   Condivide Proposal
T+END  Esegue + traccia milestones
T+END  Convoca walkthrough finale
T+END  Sign-off cliente → marca journey completed
```

### 9.2 · Designer cockpit canonico

- **Dashboard cockpit**: AssignedClientsPanel + StudioActivationPanel (header progress) + Pulse signals
- **/workspace/journeys/mine**: lista journey owner/contributor/observer
- **Journey detail**: 8 pilastri navigabili
- **Conversation inbox**: tutti i thread dei clienti assegnati
- **Milestone tracker**: deadline-aware per le sue journey
- **Notification center**: pulse + email + in-app fan-out (Phase 3)

### 9.3 · Differenze per ruolo

| Ruolo | Cockpit focus |
|---|---|
| **owner** | dashboard cliente + responsabilità globale |
| **contributor** | i suoi pilastri assegnati (es. Material Specialist vede solo Materials) |
| **observer** | read-only, mai notifiche obbligatorie, no CTA |

---

## 10 · EVENTI FONDAMENTALI (canonical event catalog)

### 10.1 · Domain events della Journey

Lista canonica degli eventi che generano (1) notifica, (2) audit log, (3) timeline entry, (4) activity feed:

#### Creazione & ciclo vita
- `journey.created`
- `journey.state_changed` (con `from_state`, `to_state`)
- `journey.put_on_hold` / `journey.resumed`
- `journey.closed_lost` (con reason)
- `journey.completed`
- `journey.archived` / `journey.unarchived`

#### Assignments (vedi ITER178)
- `assignment.owner_assigned`
- `assignment.owner_changed`
- `assignment.contributor_added` / `assignment.contributor_removed`
- `assignment.observer_added` / `assignment.observer_removed`

#### Brief & Discovery
- `brief.started` / `brief.updated` / `brief.completed`
- `discovery_interview.opened` / `discovery_interview.qualified` / `discovery_interview.disqualified`
- `voice_note.uploaded`
- `brief.file_uploaded`

#### Moodboard & Concept
- `moodboard.created` / `moodboard.updated`
- `moodboard.shared_with_client` / `moodboard.client_commented`
- `concept.approved`
- `inspiration.added`

#### Materials
- `material.added_to_journey` / `material.removed`
- `material.shared_with_client`
- `supplier.contacted`

#### Conversations
- `message.sent_to_client` / `message.sent_to_studio`
- `thread.first_contact_overdue` (24h+ pending)
- `ai_suggestion.generated`

#### Milestones & Appointments
- `milestone.created` / `milestone.completed` / `milestone.delayed`
- `appointment.scheduled` / `appointment.confirmed` / `appointment.rescheduled` / `appointment.cancelled`
- `call_me_back.requested` / `call_me_back.confirmed`

#### Proposal & Approval
- `proposal.drafted` / `proposal.shared` / `proposal.viewed_by_client`
- `proposal.signed` / `proposal.rejected`
- `proposal.amended`

#### Execution & Delivery
- `execution.started`
- `site_photo.uploaded`
- `delivery.walkthrough_scheduled` / `delivery.signed_off`

#### Health
- `health.warning_triggered` (con kpi-key)
- `health.recovered`

### 10.2 · Routing canale

| Severity | Email | In-app | Pulse | Audit |
|---|---|---|---|---|
| **critical** (e.g., `journey.closed_lost`) | ✅ | ✅ | ✅ | ✅ |
| **high** (e.g., `proposal.signed`) | ✅ | ✅ | ✅ | ✅ |
| **medium** (e.g., `moodboard.shared`) | 🟡 (digest) | ✅ | ✅ | ✅ |
| **low** (e.g., `material.added`) | ❌ | ✅ | ✅ | ✅ |
| **silent** (e.g., `audit-only`) | ❌ | ❌ | ❌ | ✅ |

### 10.3 · Audience targeting

| Evento | Audience |
|---|---|
| `journey.created` | owner + contributors + founder (digest) |
| `proposal.signed` | tutti i partecipanti journey + cliente |
| `brief.completed` | owner + contributors |
| `message.sent_to_studio` | tutti i partecipanti journey assigned |
| `assignment.assigned_to_me` | il singolo membro |
| `health.warning_triggered` | owner + founder |

---

## 11 · DESIGN JOURNEY HEALTH™

### 11.1 · KPI ufficiali (4 famiglie)

#### A · Activity health
- `days_without_activity` (no message, no event, no state change)
  - 🟢 ≤ 3 · 🟡 4-7 · 🔴 ≥ 8
- `last_team_response_lag_hours`
  - 🟢 ≤ 24h · 🟡 24-72h · 🔴 ≥ 72h
- `client_inactive_days` (no client message/access)
  - 🟢 ≤ 7 · 🟡 8-14 · 🔴 ≥ 15

#### B · Milestone health
- `overdue_milestones_count`
  - 🟢 0 · 🟡 1-2 · 🔴 ≥ 3
- `next_milestone_distance_days` (forward-looking)
  - 🟢 well-paced · 🟡 close · 🔴 already passed

#### C · Approval health
- `proposal_awaiting_signature_days`
  - 🟢 ≤ 7 · 🟡 8-14 · 🔴 ≥ 15
- `concept_awaiting_approval_days`
  - 🟢 ≤ 5 · 🟡 6-10 · 🔴 ≥ 11

#### D · Material health
- `materials_awaiting_choice_count`
- `materials_in_sourcing_status`
- `material_lead_time_risk`

### 11.2 · Health Score composito

Score 0-100 per journey, computato come weighted average:
- 40% Activity health
- 25% Milestone health
- 20% Approval health
- 15% Material health

Soglie:
- 🟢 80-100 (Excellent)
- 🟡 60-79 (Attention)
- 🟠 40-59 (At Risk)
- 🔴 0-39 (Critical)

### 11.3 · Health surfaces

- **Pulse dashboard**: aggregato per tenant (count by health tier)
- **Journey card**: badge color-coded
- **Owner cockpit**: lista delle journey "at risk" o "critical"
- **Founder oversight**: trend nel tempo + outlier detection
- **AI Assistant** (futuro): suggerimenti automatici quando salute scende

---

## 12 · ARCHIVIAZIONE & CONCLUSIONE

### 12.1 · 3 modi in cui una Journey termina

| Modalità | Trigger | Stato finale | Reversibile? |
|---|---|---|---|
| **Completed** (success) | Sign-off cliente in `delivery` | `completed` | ✅ sempre re-openable |
| **Closed-Lost** (cancellata) | Manuale (cliente abbandona, proposta rifiutata, brief incompatibile) | `closed_lost` | ⚠️ raramente (richiede unfreeze) |
| **Archived** (terminata + cold) | Auto-180d post `completed` o manuale | `archived` | ✅ unarchive disponibile |

### 12.2 · Cosa succede a entità collegate

| Entità | Su `completed` | Su `closed_lost` | Su `archived` |
|---|---|---|---|
| `design_journey_assignments` | active resta active | auto-revoke con reason="journey_closed_lost" | active resta active (read-only) |
| `human_assignments` | invariato (account-level) | invariato | invariato |
| Conversation thread | resta accessibile | resta read-only | cold storage UI |
| Moodboard, Brief, Materials | resta accessibile | resta read-only | cold storage UI |
| Notification subscriptions | continua sospensione `silent` | tutti unsubscribe | hard-stop |
| Account `lifecycle_stage` | → `customer` (se non già) | → `churned` (se era prospect) | nessun effetto |

### 12.3 · Audit & retention

- **Hot retention**: `completed` + `closed_lost` per 180 giorni → tutte le surfaces normali
- **Cold retention**: `archived` per 7 anni (compliance) → solo accesso via "Archivio" search
- **Hard delete**: mai automatico. Solo via ITER174-style cleanup esplicito autorizzato dal Founder

### 12.4 · Testimonial & follow-up (post-completion)

- Su `completed` + 30 giorni: invio email "Come è andata?" con form testimonial
- Su `completed` + 90 giorni: prompt "Hai un nuovo progetto?" → CTA "Apri nuova Journey su questo account"
- Su `archived`: nessun follow-up automatico

---

## 13 · OPEN QUESTIONS (decisioni Founder pendenti)

### Q1 · Discovery: tabella separata o stato di lead?
- **Opzione A:** nuova tabella `discovery_interviews` (raccomandato — vedi CRM_LIFECYCLE_CANON §4)
- **Opzione B:** flag su `leads.status='in_discovery'` + JSON `discovery_payload`
- **Default suggerito:** A (cleaner, audit-friendly)

### Q2 · Skip Discovery per cliente esistente (P6)?
- **Default suggerito:** SÌ — un cliente confermato apre direttamente Journey
- Implementation: gate `account.lifecycle_stage='customer' → bypass Discovery`

### Q3 · Owner e Referente: forzare coincidenza o disaccoppiare?
- **Default suggerito:** auto-coincidenza alla creazione, disaccoppiabili manualmente
- Caso d'uso: Stefano (Founder) è referente, Designer A è owner journey specifica

### Q4 · Stato `proposal` skippabile?
- **Default suggerito:** SÌ — alcune journey high-trust passano `concept → execution` (cliente già firmato in concept call)
- Audit: emettere `journey.skipped_proposal` event

### Q5 · Health Score: gating azioni?
- Es. journey `🔴 critical` blocca apertura nuova journey sullo stesso owner?
- **Default suggerito:** NO blocco hard, ma warning visivo + notification al Founder

### Q6 · Reopening completed journey?
- **Default suggerito:** sempre permesso (`archived → completed`, `completed → execution` per estensioni)
- Audit obbligatorio + nuovo `journey_reopen_reason` field

### Q7 · Multi-journey per cliente
- **Default suggerito:** **1 journey attiva** per account `lifecycle_stage='customer'`. Estensioni richiedono N+1 journey separate
- Caso d'uso: Casa Milano → Journey 1 (architettura) + Journey 2 (interior styling) — separate, parallel

### Q8 · Public Form bypassa Discovery?
- Oggi sì (auto-qualified). Approvato continuare così?
- **Default suggerito:** SÌ — il form pubblico contiene già qualifica implicita. Crea `discovery_interviews(status='qualified', source='public_form')` per audit consistency

### Q9 · Material Specialist auto-assigned su `moodboard`?
- **Default suggerito:** NO. Owner decide manualmente quando convocare Materials Specialist
- Future: AI assist può suggerire "Questa journey beneficerebbe di un material specialist"

### Q10 · Editorial Calendar legato alle Journey?
- Es. ogni journey ha 1 articolo magazine post-completion?
- **Default suggerito:** opt-in. Su `completed` → CTA "Trasforma in case study Magazine"

---

## 14 · MATRICE FINALE DI COERENZA

Tabella riassuntiva: 8 pilastri × 9 stati × 4 attori (founder/owner/contributor/client)

| Pilastro | `opened` | `discovery` | `concept` | `moodboard` | `proposal` | `approval` | `execution` | `delivery` | `completed` |
|---|---|---|---|---|---|---|---|---|---|
| **Brief** | C: WIP / T: ⏳ | C: WIP / T: 👁 | C: 👁 / T: 👁 | C: 👁 / T: 👁 | C: 👁 / T: 👁 | C: 👁 / T: 👁 | C: 👁 / T: 👁 | C: 👁 / T: 👁 | C: 👁 / T: 👁 |
| **Mood** | — | — | T: WIP / C: ⏳ | T: WIP / C: WIP | C: 👁 / T: 👁 | C: 👁 / T: 👁 | C: 👁 / T: 👁 | C: 👁 / T: 👁 | C: 👁 / T: 👁 |
| **Materials** | — | — | T: WIP | T: WIP / C: 🟡 | T: WIP / C: 🟡 | T: 👁 / C: 🟡 | T: WIP / C: 🟡 | T: 👁 / C: 🟡 | T: 👁 / C: 🟡 |
| **Conversations** | C: ✓ / T: ✓ | C: ✓ / T: ✓ | C: ✓ / T: ✓ | C: ✓ / T: ✓ | C: ✓ / T: ✓ | C: ✓ / T: ✓ | C: ✓ / T: ✓ | C: ✓ / T: ✓ | C: 👁 / T: 👁 |
| **Milestones** | — | — | T: WIP | T: WIP | T: WIP | T: WIP | T: WIP / C: 🟡 | T: WIP / C: 🟡 | T: 👁 / C: 🟡 |
| **Documents** | — | — | — | — | T: WIP | C: WIP / T: WIP | T: ✓ / C: 🟡 | T: ✓ / C: ✓ | T: 👁 / C: 👁 |
| **Appointments** | — | T: WIP / C: 🟡 | — | — | T: WIP | T: WIP / C: 🟡 | T: WIP / C: 🟡 | T: WIP / C: ✓ | T: 👁 |
| **Deliverables** | — | — | — | — | — | — | T: WIP | T: WIP / C: ✓ | T: 👁 / C: 👁 |

Legenda: `C=Client`, `T=Team`, `WIP=in lavorazione`, `👁=visibile read`, `🟡=visibile filtrato`, `✓=interagibile`, `⏳=teasing`, `—=non rilevante`.

---

## 15 · IL TEST DI VALIDAZIONE

> *"Quando un cliente entra in negozio, come nasce, evolve, viene gestita e si conclude una Design Journey™ all'interno di MOOD for DESIGN?"*

### Risposta canonica (in 12 frasi)

1. Il cliente entra in showroom. Un team member apre il tablet e crea un **Lead** con i suoi dati (P3 showroom walk-in).
2. Avvia una **Discovery Interview™** seduto con lui: 15 minuti di conversazione, qualifica, briefing iniziale.
3. Al termine, marca la Discovery `qualified()`. Il Lead diventa `qualified` e l'`account.lifecycle_stage` diventa `prospect`.
4. Da "+ Nuova Relazione" sceglie "Prospect esistente" → apre la **Design Journey™**. Il sistema auto-assegna **owner** (lui stesso) e **referente** (lui stesso).
5. Il cliente riceve email magic-link "Spazio pronto" col template tenant identity. Apre il portale: vede l'**atmosfera Client Chameleon™** scelta per lui, il **Referente** in alto, accede al **Brief Guidato™**.
6. La Journey è in stato `opened` → `discovery`. Cliente compila brief, team risponde in **Conversazione**. Atmosphere e team **client_visible** appaiono nei pilastri.
7. Team apre `concept` → elabora Moodboard. Lo condivide → cliente vede `moodboard` cliente-version. Itera commenti.
8. Team passa a `proposal`. Material Specialist viene **aggiunto come contributor** dall'owner. Proposta drafted, poi `proposal.shared`.
9. Cliente firma → `account.lifecycle_stage='customer'` + Journey passa `execution`. Milestones tracked, foto cantiere uploaded, Call Me Back™ richiesta dal cliente.
10. Walkthrough finale in `delivery`. Sign-off cliente → Journey `completed`. Notifications + audit dispatched.
11. Dopo 30 giorni email testimonial. Dopo 180 giorni Journey passa `archived` automaticamente.
12. Tutto è tracciato in `journey_lifecycle_events`, monitorato dal **Health Score**, governato da **8 pilastri**, mai mescolato con il CRM di altri clienti (tenant isolation).

✅ **Il documento risponde alla domanda. Il canon è completo.**

---

## 16 · DERIVED DOCS

Questo canon è la sorgente di verità. Tutti i seguenti documenti DEVONO essere coerenti con esso:

| Doc | Coerenza richiesta |
|---|---|
| `CRM_LIFECYCLE_CANON.md` | Lead → Discovery → Prospect → Journey (§1, §4) |
| `JOURNEY_ASSIGNMENTS_ARCHITECTURE.md` | owner/contributor/observer + client_visible (§6, §5) |
| `TEAM_LIFECYCLE_AUDIT.md` | Team Foundation + invito (§2) |
| `BLUEPRINT_CHAMELEON_AUDIT.md` | Studio Chameleon ≠ Client Chameleon (§8) |
| `STUDIO_ACTIVATION_ARCHITECTURE.md` | First journey step (§1) |
| `ERROR_REGISTRY_SPEC.md` | Domain `JOURNEY-*` codes (§10) |
| `EDITORIAL_ONBOARDING_SPEC.md` | Journey → case study (§13 Q10) |

Eventuali divergenze → questo canon vince. Aggiornare i derived docs.

---

## 17 · VINCOLI DI CANON (immutabili)

| # | Regola |
|---|---|
| 1 | Una Journey NON esiste senza qualifica (Discovery completata OR cliente customer) |
| 2 | Una Journey ha SEMPRE 1 owner attivo |
| 3 | Una Journey ha SEMPRE 1 referente master (`human_assignments`) |
| 4 | Una Journey passa attraverso 9 stati canonici (+3 eccezionali) |
| 5 | Una Journey ha 8 pilastri concettuali (mai più, mai meno) |
| 6 | Una Journey vive su 2 lati: Studio (team) + Cliente (portal) |
| 7 | Il cliente NON vede internal notes, costs breakdown, observers, suspended members |
| 8 | Il founder vede TUTTO (governance) |
| 9 | Il sistema emette eventi canonici per ogni transizione (audit obbligatorio) |
| 10 | Health Score è computato 4 famiglie KPI weighted average |
| 11 | Conclusione: 3 modi (Completed, Closed-Lost, Archived) — mai hard-delete automatico |
| 12 | Tenant isolation: una Journey vive in 1 tenant, mai cross-tenant |
| 13 | Client Chameleon ≠ Studio Chameleon (atmosfera separata) |
| 14 | Discovery → Journey: transizione richiede un atto esplicito (mai automatico salvo `customer` returning) |
| 15 | Mai più di 1 Journey attiva sullo stesso account contemporaneamente |
