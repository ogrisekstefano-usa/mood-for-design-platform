# M5_ADVISOR_JOURNEY_VALIDATION™

**Versione**: 1.0 · **Data**: 03 Giugno 2026 · **Stato**: ⏸ In attesa di approvazione · **Classificazione proposta**: `READY_FOR_M5_IMPLEMENTATION` (con scope ridotto)

**Predecessori chiusi**: M0 · M1 · M2 · M3 · M4 ✅
**Scope di questo documento**: validazione del workflow quotidiano · NO codice · NO migration · NO componenti

---

## 0 · Le 4 primary questions

Ogni schermata M5 deve rispondere SUBITO a queste 4 domande. Se una sezione non ne risolve almeno una, viene rimossa.

| # | Domanda                                       | Schermata responsabile                            |
| - | --------------------------------------------- | ------------------------------------------------- |
| 1 | Qual è la prima cosa che vedo?                | **My Day** (hero, sopra la fold)                  |
| 2 | Cosa richiede attenzione?                     | My Day · sezione **CRITICO** + bell M4            |
| 3 | Quale azione devo fare per prima?             | My Day · primo item dello stack `Next up`         |
| 4 | Perché dovrei tornare domani?                 | **My Studios** ranked per health + **My Pipeline** |

---

## 1 · Advisor Journey · 5 scenari minuto-per-minuto

### SCENARIO 1 · Nuovo advisor (3 studi · 8 contatti · 0 attività)

**Stato emotivo entrando**: smarrito. Non sa da dove partire. Rischio: chiusura tab a minuto 2.

| Minuto | Vede                                                                                         | Azione mentale                                            |
| :----: | -------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
|   0    | Topbar `Benvenuta, Raffaella` · Bell `0` · My Day **stato vuoto editoriale**, NON una pagina bianca: «I tuoi 3 studi ti aspettano. Inizia da quello che ti sembra più caldo.» | "Ok, qualcuno mi guida"                                   |
|   1    | Sotto: card **I tuoi 3 studi** ordinati per data assegnazione · ognuno con: nome, città, founder primario, 1 CTA: `Apri scheda relazione`         | Click sul primo studio                                    |
|   2    | Atterra in **Relationship Center** del tenant · vede contatti, ma timeline vuota              | "Inizio dalla prima call"                                 |
|   3    | Clicca **Annota attività** → drawer · seleziona Call · scrive Esito · setta prossimo passo   | Prima riga di memoria creata                              |
|   4    | Bell badge `1` lampeggia (un'altra notifica arrivata in background) · ignora                  | Conferma di essere sul binario giusto                     |
|   5    | Torna a My Day: l'attività appena creata appare in **Last 7 days** + 1 follow-up futuro      | "Domani torno a chiudere il follow-up"                    |

**Quindi vede in 5 minuti**: la propria identità (header), il perimetro (3 studi), la prima azione concreta (annota call), il primo loop chiuso (creo attività → genera follow-up → torno domani).

**Verdict**: ✅ Funziona se My Day ha **stati vuoti editoriali** + lista perimetro come primo bloco. ❌ Non funziona con KPI cards generici.

---

### SCENARIO 2 · Advisor attivo (15 studi · 120 contatti · 80 attività · 12 follow-up)

**Stato emotivo**: di fretta. Caffè in mano. Ha 8 conversazioni in coda. Rischio: paralisi da info.

| Minuto | Vede                                                                                              | Azione mentale                                          |
| :----: | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
|   0    | **My Day** hero · prima riga: «**Oggi: 4 azioni · 2 critiche**» · poi stack ordinato per urgenza  | "Bene, so dove guardare"                                |
|   1    | Stack: ▌ Overdue 2g — Sintesi call Luca C. · ▌ Overdue 1g — Quote materiali Sara P. · ● Today 15:00 Demo Mario R. · ● Today 17:00 Inviare brief Sara | Scansione visiva di 5 secondi          |
|   2    | Click sulla prima overdue → atterra nel drawer attività · scrive l'esito · marca completata    | Closure 1 fatta                                         |
|   3    | Auto-ritorno a My Day. Stack ora `3 azioni · 1 critica` · si sente in controllo                  | Continua con la seconda overdue                         |
|   4    | Marca completata la seconda · stack `2 azioni · 0 critiche`                                       | "Le due demo le faccio nel pomeriggio"                  |
|   5    | Va a `My Studios` per dare un'occhiata ai 2 studi che hanno avuto poca attività (`temperature: cold`) → identifica un re-engage · annota un task per dopodomani | "Sto governando il quarter"  |

**Verdict**: ✅ Stack ordinato per urgenza + completion in-place = workflow operativo. Mai 15 KPI cards da scrollare.

---

### SCENARIO 3 · Advisor con molti overdue (8 overdue activities · 3 overdue meetings · 2 inactive tenants)

**Stato emotivo**: in ritardo, ansioso. Rischio: si sente sopraffatto, abbandona la piattaforma.

**Come MOOD risolve l'urgenza**:

1. **Bell** M4 mostra badge rosso (has_critical = true) con conteggio.
2. **My Day** apre con **una sola riga in alto**: il vero "fire" del giorno. Non 13 alert: **il più critico** (es. lo studio cold da più tempo + overdue di più giorni). Sotto, `+12 altri in ritardo · vedi tutti`.
3. **Bucket visual** con counter (`Overdue · 11` in rosso `Today · 0` `Week · 5`) per orientarsi.
4. **Bulk action**: pulsante `Riprogramma tutti gli overdue di +X giorni` per recuperare in un click la situazione, con audit log.

**Cosa appare per primo**:
```
TUE 4 GIU · 08:30
─────────────────────────────────────────
▌  AZIONE CRITICA · da 3 giorni
   Studio Bianchi & Co.
   "Sintesi call con Luca Conti"
   [Apri →]  [Riprogramma]  [Completa rapidamente]
─────────────────────────────────────────
 + 10 altre attività in ritardo · [Vedi tutte]
 + 2 tenant senza attività da 15g · [Apri lista]
```

**Cosa può aspettare**: i 2 inactive tenants restano in coda visibile ma sotto i fire — vengono mostrati come *opportunità di re-engagement* (vedi Scenario 5).

**Verdict**: ✅ Solo se l'overdue ha **gerarchia visiva** + **bulk reschedule**. ❌ Una lista flat di 13 item è il peggior modo: blocca l'advisor.

---

### SCENARIO 4 · Advisor con nuove richieste (4 introductions · 2 awaiting review · 1 activation pending)

**Workflow target**: Notification → Review → Qualification → Activation

```
            ┌──────────────────────────────────┐
[bell M4 click]   →   notifica "lead_awaiting_review"
            └──────────────────────────────────┘
                              ↓
                  My Introductions (tab dedicato)
                              ↓
            ┌──────────────────────────────────┐
            │  ◌ 4 in attesa di accettazione  │
            │  ◇ 2 in revisione                │
            │  ● 1 pronto per attivazione      │
            └──────────────────────────────────┘
                              ↓
                       Apri introduction
                              ↓
            ┌──────────────────────────────────┐
            │ Studio Verri Milano              │
            │ Profilo · founder · referente    │
            │ archetype · esperienze · note    │
            │ [Accept] [Decline] [Defer]       │
            └──────────────────────────────────┘
                              ↓
                Acceptance → status: in_review
                              ↓
              (qualification call con founder)
                              ↓
                  Marca "Pronto attivazione"
                              ↓
                  Click [Attiva tenant]
                              ↓
            studio_activation.activate_request_full_auto()
                              ↓
                  Magic link inviato + tenant_activated notifica
```

**Schermate strettamente necessarie per M5**:
- `My Introductions` con 3 colonne stato (`Awaiting accept` / `In review` / `Ready to activate`)
- Drawer dettaglio introduction (riusa `StudioRequestDrawer` esistente in Command Center)
- CTA `Attiva tenant` → riusa endpoint già in produzione

**Verdict**: ✅ Esistono già backend (`studio_requests` table + `activate_request_full_auto`) e drawer in Command Center. M5 deve solo esporli con perimetro advisor.

---

### SCENARIO 5 · Advisor inattivo (10 studi · zero attività recenti · zero follow-up)

**Stato emotivo**: dimentica MOOD. Rischio: churn dell'advisor stesso.

**Come MOOD genera opportunità**:

1. **My Day** invece di essere vuoto, propone **3 suggerimenti automatici** ranked:
   - `▲ Studio Martinel — ultima attività 21g fa. Tempo per un check-in?` → click → drawer nuova attività precompilata
   - `▲ Studio Bianchi — relationship_health è sceso da 82 a 64 in 30g` → apri scheda
   - `▲ Mario Rossi (Martinel) — nessuna nota dopo la demo. Vuoi aggiungerne una?` → drawer attività
2. **My Studios** ordina per `last_activity_at ASC` invece che per nome, così i "freddi" sono in cima quando l'advisor non ha urgenze.
3. **Daily summary email** (M4.1, future) lo richiama: «Domani 2 studi hanno 30 giorni di silenzio.»

**Backend già pronto** per generare i 3 suggerimenti:
- M2 `last_touch_at` + M3 `relationship_score` + M2 `relationship_temperature` (futuro) — tutte colonne esistenti.

**Verdict**: ✅ Possibile day-1 senza nuovo data engineering. I "Suggested actions" sono semplici query SQL ordinate.

---

## 2 · Sezioni autorizzate · decisioni P0/P1/P2

Per ogni sezione l'advisor risponde a: **"Che azione mi aiuta a fare?"**

| Sezione               | Azione concreta                                     | Verdict per M5 v1                                                  |
| --------------------- | --------------------------------------------------- | ------------------------------------------------------------------ |
| **My Day** 🟢         | Decidere cosa fare *adesso* (priorità ranked)        | **P0 · MUST-HAVE** · è la pagina di atterraggio                    |
| **My Notifications** 🟢| Vedere cosa è successo mentre non c'ero             | **P0** · già esistente come drawer M4 · serve anche un tab/page    |
| **My Follow-Ups** 🟢  | Chiudere impegni presi                              | **P0** · è il singolo strumento più usato quotidianamente          |
| **My Studios** 🟢     | Capire chi gestisco · navigare allo studio          | **P0** · perimetro chiaro                                          |
| **My Introductions** 🟢| Accettare/declinare lead in attesa                  | **P0** · scenario 4 lo richiede + è già in pipeline M4             |
| **My Activities** 🟡  | Vedere storico globale delle MIE attività           | **P1 · DEFERRED** · ridondante con `My Day` + `My Follow-Ups` + Activity Tab in ogni studio · non aggiunge nuove azioni · solo lettura |
| **My Pipeline** 🔴    | Vedere lo stato commerciale degli studi (cold/warm/hot, stage) | **P2 · DEFERRED** · richiede modello "pipeline stages" non esistente · diventa M6 |

**Conclusione**: **M5 v1 ha 5 sezioni** (non 7). My Activities e My Pipeline sono rinviate finché non emerge un bisogno operativo non coperto.

---

## 3 · Information Architecture (M5 v1)

```
/workspace/  (sostituisce /command-center per role=advisor — nuovo namespace mentale)
│
├── /workspace/                          → redirect a /workspace/my-day
│
├── /workspace/my-day                    ⬅ HERO · landing page advisor
│   ├── sezione hero: data + saluto + counter azioni del giorno
│   ├── stack azioni (ranked): critical + overdue + today + suggerimenti
│   ├── strip: My studios snapshot (top 3 health/temperature)
│   └── strip: ultime notifiche (5 più recenti, link al drawer M4)
│
├── /workspace/notifications             ⬅ pagina completa M4 (oltre al drawer)
│   ├── stessi 6 filtri del drawer
│   ├── viewport più ampia con preview narrative
│   └── archive history visibile
│
├── /workspace/follow-ups                ⬅ queue completa
│   ├── tabs: Overdue · Today · This week · Snoozed · Done (last 30g)
│   ├── bulk: complete · reschedule · reassign
│   └── filtra per tenant
│
├── /workspace/studios                   ⬅ My Studios list
│   ├── sort di default: last_activity_at DESC
│   ├── alternative sort: health · temperature · alphabetical
│   └── click → /workspace/studios/{tid} (mirror del Relationship Center, ma scope advisor)
│
├── /workspace/studios/{tid}             ⬅ Relationship Center scoped
│   └── stesso layout M6 (deferred) o, finché M6 non esiste,
│       atterra in /command-center/tenants/{tid} con badge "advisor view"
│
└── /workspace/introductions             ⬅ Pending lead inbox
    ├── kanban 3 colonne: Awaiting accept · In review · Ready to activate
    └── drawer detail riusa StudioRequestDrawer esistente
```

**Note**:
- Le rotte non in elenco (`/workspace/activities`, `/workspace/pipeline`, `/workspace/commissions`, `/workspace/dashboard`) **non esistono in v1**. Se l'utente le digita a mano → redirect a `/workspace/my-day` con toast «Sezione non ancora disponibile».
- **Commissions**: rimossa da v1. Si torna in fase M5.1 con modello reale di calcolo, non con foundation mock.

---

## 4 · Navigation Tree (sidebar advisor)

```
┌─────────────────────────────┐
│  MOOD · Workspace           │   <— shell scuro come oggi
│  Raffaella · advisor        │
├─────────────────────────────┤
│  ◆  My Day              ●   │   <— sempre active al landing
│  ◇  Notifications      12   │   <— badge da unread-count
│  ◇  Follow-Ups          5   │   <— badge da overdue+today count
│  ◇  Studios            12   │   <— count assigned
│  ◇  Introductions       3   │   <— pending count
├─────────────────────────────┤
│  RECENT                     │   <— breadcrumb di shortcut
│  · Martinel ID              │
│  · Studio Bianchi & Co.     │
│  · Atelier Verde Milano     │
├─────────────────────────────┤
│  ⊕  Annota attività         │   <— global quick-add CTA
└─────────────────────────────┘
```

**5 voci principali · niente di più.** Niente "Pipeline", "Activities", "Commissions" finché non hanno copy chiaro per la domanda *"che azione abilita?"*

---

## 5 · Dashboard (My Day) · struttura widget

L'unica pagina veramente nuova di M5 è **My Day**. Le altre sono liste/drawer su API esistenti.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ MAR 4 GIU 2026 · 08:30                              [Bell 12]  [⊕ Annota]│
│ Buongiorno, Raffaella                                                    │
│ Oggi · 4 azioni · 2 critiche                                             │
└──────────────────────────────────────────────────────────────────────────┘

┌──── CRITICO ───────────────────────────────────────────────────────────┐
│ ▌ Da 3 giorni · Sintesi call con Luca Conti                            │
│   Studio Bianchi & Co. · founder primario                              │
│   [Apri →]  [Completa rapidamente]  [Riprogramma]                      │
│                                                                        │
│ ▌ Da 1 giorno · Quote materiali Q3                                     │
│   Sara Pellegrini (Martinel) · purchasing                              │
│   [Apri →]  [Completa]  [Riprogramma]                                  │
└────────────────────────────────────────────────────────────────────────┘

┌──── OGGI ──────────────────────────────────────────────────────────────┐
│ ● 15:00 · Demo Material Intelligence                                   │
│   Mario Rossi (Martinel) · founder · canale: call                      │
│ ● 17:00 · Inviare brief showroom                                       │
│   Sara Pellegrini · WhatsApp                                           │
└────────────────────────────────────────────────────────────────────────┘

┌──── SUGGERIMENTI ──────────────────────────────────────────────────────┐
│ ◇ Atelier Verde Milano · ultima attività 18g fa · vuoi un check-in?    │
│ ◇ Studio Conti · health passato da 82 a 64 in 30g · apri scheda        │
└────────────────────────────────────────────────────────────────────────┘

┌──── I MIEI STUDI · top 3 per health ───────────────────────────────────┐
│ 95  Conti Architetti          · warm  · ultimo: 2g  · next: —          │
│ 82  Atelier Verde Milano      · warm  · ultimo: 3g  · next: 9 Giu      │
│ 64  Martinel Interior Design  · warm  · ultimo: 2h  · next: 10 Giu     │
│                                                  → Vedi tutti (12)      │
└────────────────────────────────────────────────────────────────────────┘

┌──── ULTIME NOTIFICHE ──────────────────────────────────────────────────┐
│ ▲ Lead Awaiting Review · Studio Verri Milano · 8 min fa                │
│ ◆ Activity Assigned · "Demo Material Intelligence" · 12 min fa         │
│ ▲ Follow-Up Overdue · Sintesi call con Luca Conti · 3g                 │
│                                              → Apri tutte (12)          │
└────────────────────────────────────────────────────────────────────────┘
```

**5 widget · ognuno motivato**:

| Widget          | Azione abilitata                                              | Senza questo, l'advisor…                              |
| --------------- | ------------------------------------------------------------- | ----------------------------------------------------- |
| **Critico**     | Chiude immediatamente le code rosse                           | …perde clienti perché dimentica i ritardi             |
| **Oggi**        | Pianifica la giornata                                         | …deve aprire 3 schermate per ricostruirla             |
| **Suggerimenti**| Re-engaga relazioni in raffreddamento                         | …diventa inattivo (scenario 5)                        |
| **Top studi**   | Vede dove sta funzionando · referenze possibili               | …perde memoria del proprio successo                   |
| **Notifiche**   | Vede cosa è successo mentre era assente                       | …apre il drawer ogni volta (friction)                 |

**Cosa NON è in My Day** (rifiutati):
- ❌ KPI cards "Attività totali", "Studi attivi", "Tasso conversione" — vanity, nessuna azione
- ❌ Grafici a torta/barre — decorativi senza CTA
- ❌ Welcome video tour — friction
- ❌ Onboarding checklist (resta per advisor onboarding, non in My Day)

---

## 6 · Widget justification table (decisione esplicita)

| Sezione/Widget candidato         | Domanda "che azione abilita?"                                | Verdict |
| -------------------------------- | ------------------------------------------------------------ | :-----: |
| Hero saluto + counter            | Orientarsi sulla giornata                                    |  ✅ IN  |
| Critico (overdue ranked)         | Chiudere i fire                                              |  ✅ IN  |
| Oggi (due today)                 | Sapere cosa farai prossimo                                   |  ✅ IN  |
| Suggerimenti (cold tenants)      | Re-engage proattivo                                          |  ✅ IN  |
| Top 3 studi per health           | Conferma di stato + entry point a Relationship Center        |  ✅ IN  |
| Ultime notifiche                 | Awareness di eventi recenti senza aprire bell                |  ✅ IN  |
| KPI "Attività totali Q2"         | Nessuna · vanity                                             |  ❌ OUT |
| Grafico relationship_score trend | Nessuna · decorativo · serve a M6 KPI dashboard              |  ❌ OUT |
| Commissions estimate             | Lettura, non azione                                          |  ❌ OUT |
| My calendar this week            | Già coperto da "Oggi" + "Follow-Ups This Week"               |  ❌ OUT |
| Quote of the day                 | Niente. Mai.                                                 |  ❌ OUT |

---

## 7 · Notification integration (M4 ↔ M5)

| Notifica M4               | Atterraggio M5                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| `studio_request_received` | `/workspace/introductions` con focus sull'item (`?id={lead_id}`)                              |
| `lead_awaiting_review`    | `/workspace/introductions?id={lead_id}` colonna `Awaiting accept`                             |
| `tenant_activated`        | `/workspace/studios/{tid}` (se l'advisor è l'owner della relazione)                           |
| `workspace_first_access`  | `/workspace/studios/{tid}` (anche per advisor: «il founder è entrato! Ottimo momento per scrivere.») |
| `advisor_assigned`        | `/workspace/studios/{tid}` (entrata nello studio appena assegnato)                            |
| `activity_assigned`       | `/workspace/studios/{tid}?tab=activities&activity={aid}`                                      |
| `followup_overdue`        | `/workspace/follow-ups?activity={aid}`                                                        |
| `new_contact`             | `/workspace/studios/{tid}?tab=contacts&contact={cid}`                                         |
| `new_activity`            | `/workspace/studios/{tid}?tab=activities&activity={aid}`                                      |

Tutti i deep link sono **già generati da M4** (`_build_action_url` ha già la branch `/workspace/*`). **Niente da costruire lato notifiche** · M5 deve solo cablare le rotte.

---

## 8 · Relationship Center integration (M5 ↔ M6)

**Problema**: M6 (Relationship Center 3-col redesign) è deferred dopo M5.

**Soluzione per M5 v1**:
- `/workspace/studios/{tid}` redirige a `/command-center/tenants/{tid}` con flag `view=advisor`
- Aggiungiamo solo un **chip header** che dichiara «Tu stai vedendo questo studio come advisor di riferimento» + nascondiamo CTA admin-only (es. "Riassegna advisor", "Sospendi tenant")
- Quando M6 esiste, `/workspace/studios/{tid}` punterà al nuovo layout senza altre modifiche all'URL.

**Cosa NON facciamo in M5**:
- ❌ Niente nuovo layout RC in M5
- ❌ Niente nuove API tenant — il backend RBAC `advisor` è già esposto dal Command Center
- ❌ Niente duplicazione di codice "Contacts", "Activities", "Timeline"

---

## 9 · Mobile experience (390px viewport)

**Principio**: la mobile non è uno spreadsheet. Un advisor in mobile fa 3 cose:
1. Marca un follow-up come completato.
2. Annota una nota veloce dopo una telefonata.
3. Legge una notifica e atterra.

**Mobile layout My Day**:
```
┌──────────────────────────┐
│ ☰ MOOD Workspace · Bell 12│
├──────────────────────────┤
│ MAR 4 GIU · 08:30        │
│ Raffaella                │
│ 4 azioni · 2 critiche    │
├──────────────────────────┤
│ ▌ CRITICO · 3g           │
│   Studio Bianchi         │
│   Sintesi call Luca C.   │
│   [Completa] [Apri]      │
├──────────────────────────┤
│ ▌ CRITICO · 1g           │
│   Sara P. · Martinel     │
│   Quote materiali Q3     │
├──────────────────────────┤
│ Oggi (2) · vedi tutti →  │
│ Suggerimenti (2) →       │
│ I miei studi (12) →      │
│ Notifiche (12) →         │
└──────────────────────────┘
                ⊕ Annota
                  (FAB)
```

**Sidebar in mobile**: hamburger drawer da sinistra. FAB `⊕ Annota attività` in basso a destra (fixed).

**Sezioni full-screen** (no 3-col): ogni list view ha layout flat. Critical highlight resta (bordo rosso 3px). Sezioni "collassate" si aprono come accordion.

---

## 10 · Empty State strategy

Niente pagine bianche. Ogni empty state è **editoriale, attivo, generativo**.

| Schermo                     | Stato vuoto                                              | CTA                                  |
| --------------------------- | -------------------------------------------------------- | ------------------------------------ |
| `My Day` (0 azioni)         | «Tutto sotto controllo per oggi. È un buon momento per scrivere a uno studio fermo da settimane.» | → `Apri Suggerimenti`        |
| `My Day` (0 studi assegnati)| «Non hai ancora studi assegnati. L'admin ti li attribuirà al primo brief.» | → email all'admin (mailto:) |
| `Follow-Ups` (0)            | «Niente in sospeso. Domani torna a controllare.»          | →                                    |
| `Studios` (0)               | Identico a My Day (0 studi)                              | →                                    |
| `Introductions` (0)         | «Nessuna nuova introduzione. MOOD ti scriverà quando arriva un lead.» | → `Vai a My Day`     |
| `Notifications` (0)         | «Sei tutto aggiornato. Le notifiche compaiono qui.»       | →                                    |
| `Studio/Activities` (0)     | Stato già definito in M3                                 | (riusato)                            |

**Stato "primo accesso"** (advisor mai loggato prima):
- Banner una-volta-sola in My Day: «Benvenuta su MOOD Workspace. Sei advisor di {N} studi. Il primo passo è aprire la scheda di uno di loro e annotare la prima attività.»
- Cookie `mood_advisor_first_seen = true` lo nasconde.

---

## 11 · Cosa NON è in M5 v1 (deferred)

Esplicito per rifiutare scope creep:

| Funzione                              | Motivo deferral                                       | Quando ritorna         |
| ------------------------------------- | ----------------------------------------------------- | ---------------------- |
| My Pipeline (kanban stage commerciali)| Richiede modello `pipeline_stages` non esistente      | M6 / M7                |
| My Activities (log globale advisor)   | Ridondante con My Day + Follow-Ups + studio detail    | mai se non emerge bisogno |
| Commissions reale (calcolo)           | Manca modello business · attendere fase B            | M5.1                   |
| Email digest mattutino                | M4.1 future (Resend integrabile)                      | M5.1                   |
| Voice quick capture mobile            | M3.1 voice notes foundation                           | M3.1                   |
| Push notifications                    | M4.2 future                                           | M4.2                   |
| Reportistica advisor performance      | È un'altra persona (admin) la consumer                | M7 KPI dashboard       |
| Calendar sync (Google/Outlook)        | Integrazione esterna · scope a parte                  | M8                     |

---

## 12 · Risposte alle 4 primary questions

> _"An advisor logs into MOOD at 08:30. What is the first thing they see? What requires attention? What action should they take first? Why should they return tomorrow?"_

| Domanda                          | Risposta                                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| Prima cosa che vede              | My Day · header data + saluto + counter del giorno + sezione **CRITICO**                       |
| Cosa richiede attenzione         | La sezione CRITICO mostra fino a 2 fire del giorno · il resto in `+N altri in ritardo`         |
| Quale azione fa per prima        | Top of stack della sezione Critico · 1-click CTA `Completa rapidamente` o `Riprogramma`        |
| Perché torna domani              | La sezione `Oggi` mostra ciò che ha pianificato · i `Suggerimenti` mostrano gli studi cold · le notifiche M4 lo cercano via email (M4.1 futuro) e tramite badge bell |

Se queste 4 risposte fossero ambigue, M5 sarebbe `NEEDS_REWORK`. Sono chiare. M5 è `READY_FOR_M5_IMPLEMENTATION` **a patto di stare al scope ridotto** (5 sezioni, non 7).

---

## 13 · Effort revisione (post-validation)

| Fase | Scope                                                          | Stima       |
| ---- | -------------------------------------------------------------- | ----------- |
| 1    | Schema: `users.workspace_role`, `advisor_studio_assignments` (se manca), eventi `assigned` | 0.5 giorno  |
| 2    | API `/api/workspace/my-day` (aggregator) + scoping endpoints   | 1.5 giorni  |
| 3    | API `/api/workspace/follow-ups`, `/studios`, `/introductions`  | 1 giorno    |
| 4    | Frontend shell `/workspace/*` + sidebar advisor                | 1 giorno    |
| 5    | Page `My Day` con i 5 widget                                   | 1.5 giorni  |
| 6    | Page `Follow-Ups`, `Studios`, `Introductions`                  | 1.5 giorni  |
| 7    | Page `Notifications` (full-page, drawer continua a funzionare) | 0.5 giorno  |
| 8    | Mobile responsive + FAB                                        | 0.5 giorno  |
| 9    | Empty states + first-access banner                             | 0.25 giorno |
| 10   | `validate_m5.py` + testing agent                               | 0.75 giorno |
| 11   | Docs + M5_IMPLEMENTATION_REPORT.md                             | 0.25 giorno |
| **Totale**                                                            | **~9 giorni** |

(Stima rivista al ribasso rispetto alla forbice 7 giorni del deliverable architetturale, perché My Activities + My Pipeline + Commissions sono fuori scope · My Studios/Studio detail = riuso del Command Center con flag scope.)

---

## 14 · Deliverable check-list utente

| # | Deliverable                                           | Sezione           |
| - | ----------------------------------------------------- | ----------------- |
| 1 | Advisor Journey Validation Report                     | §1 (5 scenari)    |
| 2 | Advisor Workspace Information Architecture            | §3                |
| 3 | Navigation Tree                                       | §4                |
| 4 | Dashboard Structure                                   | §5                |
| 5 | Widget Justification                                  | §6                |
| 6 | Notification Integration                              | §7                |
| 7 | Relationship Center Integration                       | §8                |
| 8 | Mobile Experience                                     | §9                |
| 9 | Empty State Strategy                                  | §10               |

Tutte coperte. Classificazione: **`READY_FOR_M5_IMPLEMENTATION`** con **scope ridotto a 5 sezioni** (no My Activities · no My Pipeline · no My Commissions in v1).

---

## 15 · Domanda finale all'utente

Prima di implementare, conferma:

**A. Scope sezioni**
- a1) ✅ Approvo: M5 v1 = My Day · Notifications · Follow-Ups · Studios · Introductions
- a2) 🔧 Voglio includere My Activities anche se ridondante
- a3) 🔧 Voglio includere My Pipeline anche se manca il modello

**B. Studio detail**
- b1) ✅ Approvo: `/workspace/studios/{tid}` redirige a `/command-center/tenants/{tid}?view=advisor` (riuso M0-M3, niente M6 in M5)
- b2) 🔧 Voglio M6 prima di M5 (Relationship Center 3-col redesign)

**C. Suggerimenti automatici (Scenario 5)**
- c1) ✅ Approvo · query SQL su `last_touch_at` + `relationship_score` (no AI in v1)
- c2) 🔧 Voglio AI-driven da subito (es. GPT/Gemini sui dati)
- c3) 🔧 Niente suggerimenti in v1, solo dati grezzi

**D. Suggerimento mio**
Vorrei aggiungere una sola feature soft: **"Streak"** in My Day (es. "Hai completato attività per 4 giorni di fila"). È un nudge gentile che mantiene l'advisor attivo, allineato con i tuoi 5 advisor in onboarding. Vuoi includerlo?
- d1) Sì, gentile e silenzioso
- d2) No, vogliamo restare freddi/operativi

**Risposta minima ammessa**: `A:a1 B:b1 C:c1 D:d2` → procedo direttamente con la migration M5 e l'esecuzione completa.

⚠️ STOP fino alla tua conferma.
