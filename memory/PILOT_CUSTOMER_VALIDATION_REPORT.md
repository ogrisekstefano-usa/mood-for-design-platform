# PILOT CUSTOMER VALIDATION REPORT
**Data**: 2026-06-20  
**Sprint**: Pilot Customer Validation Sprint  
**Metodo**: Testing Agent v4 (iteration_256) + audit codice + screenshot reali  
**Utente creato durante il test**: Giulia Romano (giulia.test.pilot@test.com) — lead creato live via /begin-journey

---

> **Principio**: ogni punto in cui l'utente ha bisogno di conoscenza preventiva del sistema = problema UX.  
> Soglie: VERDE <15sec · GIALLO 15-45sec · ROSSO >45sec o richiede aiuto.

---

## PASS — Funzionalità intuitive

| Elemento | Tempo di scoperta | Note |
|---------|------------------|------|
| Login → Dashboard | VERDE | Immediato |
| Projects Studio — `+NUOVO PROGETTO` | VERDE | Chiaramente visibile. Badge PUBLISHED/DRAFT leggibili. |
| /professionals — valore collaborazione | VERDE | "Le migliori collaborazioni nascono da una visione condivisa" — CTA cristallina |
| /partner-application — form | VERDE | Sezioni chiare, bottone INVIA CANDIDATURA visibile |
| /begin-journey — form 3 step | VERDE | ATMOSFERA → COME VIVI → CONOSCIAMOCI. Email validation in tempo reale. |
| /begin-journey → CRM lead creation | VERDE | Giulia Romano comparsa in CRM come Account con status JOURNEY · PRIVATE CLIENT · IT dopo submit |
| /projects — listing e dettaglio | VERDE | 6 progetti cliccabili, filtri (TUTTI/RESIDENZIALE/OSPITALITÀ/RETAIL), detail page carica |
| Projects Studio — published vs draft | VERDE | Distinzione visiva immediata |

---

## WARNING — Funzionalità che richiedono spiegazione

### W1 — ROSSO · Sidebar Blueprint: icone-only senza etichette
**Funziona**: SI  
**Si capisce immediatamente**: NO  
**Tempo scoperta**: >45 secondi  

Alla prima apertura, la sidebar mostra 16 icone senza etichette. Un utente non tecnico non ha modo di capire dove andare senza fare hover su ogni icona o espandere la sidebar (il toggle di espansione non è intuitivo).

**Percorso per trovare CMS homepage**: (1) individuare l'icona sidebar (anonima), (2) capire che "Experience" = modifica homepage, (3) navigare a /blueprint/experience. Nessuna di queste azioni è autoesplicativa.

**Impatto**: chiunque entri per la prima volta senza training non riesce a orientarsi autonomamente.

---

### W2 — ROSSO · "Blueprint Experience" = CMS Homepage
**Funziona**: SI  
**Si capisce immediatamente**: NO  

L'entry point per modificare il sito pubblico si chiama "Experience" nella sidebar. Un owner di showroom che cerca "modifica homepage" o "modifica sito" non associa mai la parola "Experience" con questa funzione.

---

### W3 — GIALLO · Terminologia CRM in inglese
**Funziona**: SI  
**Si capisce immediatamente**: PARZIALMENTE  

Le colonne CRM si chiamano:
- DISCOVERY (non "Nuove Richieste")
- CULTIVATION (non "Relazioni in Sviluppo")
- ACTIVE STUDIO (non "Clienti Attivi")

Per uno showroom italiano non tecnico, questa terminologia richiede una spiegazione. La struttura visiva è comprensibile, ma i nomi creano friction.

**Impatto**: 15-45 secondi di orientamento per capire dove si trovano le nuove richieste.

---

### W4 — GIALLO · Terminologia inconsistente: "Consulenza" vs "Design Journey"
**Funziona**: SI (la CTA funziona correttamente)  
**Si capisce immediatamente**: PARZIALMENTE  

La CTA principale sulla homepage pubblica è **"PRENOTA UNA CONSULENZA"** e porta a `/consulenza`.  
La route `/consulenza` è un **alias valido di `/begin-journey`** — carica esattamente `BeginJourneyPage`.  

Il flusso tecnico funziona. Il problema è terminologico: l'homepage dice "Prenota una consulenza", mentre il form dice "Design Journey™". Un utente che ha sentito parlare di "Begin Journey" o "Design Journey" non riconosce il bottone "PRENOTA UNA CONSULENZA" come il punto di ingresso. E viceversa: chi ha cliccato "PRENOTA UNA CONSULENZA" si aspetta un processo diverso da "Design Journey™".

**Impatto**: lieve confusion sul brand name del processo. Non è un BLOCKER perché funziona — ma è incoerente.

---

### W5 — INFO · Partner Application Form: single-page
**Funziona**: SI  
**Si capisce immediatamente**: SI  

Il form `/partner-application` è una singola pagina scrollabile con 4 sezioni (Identità professionale, Profilo online, Contesto geografico, Tipo collaborazione). Non ha step indicator. È accessibile e funzionale ma potrebbe sembrare lungo su mobile.

---

### W6 — INFO · Onboarding setup "Workspace attivo" persistente
**Funziona**: SI  
**Si capisce immediatamente**: PARZIALMENTE  

Dopo il fix Chameleon, il banner mostra ora "Workspace attivo" come next action. Lo step richiede che esista almeno un progetto con `project_type` configurato nella tabella `projects`. I progetti Blueprint sono in `published_design_journeys` — tabella diversa. Per il tenant corrente, lo step "workspace" rimane pending.

**Opzione**: dismissare il banner (`POST /api/tenant-onboarding/dismiss`) prima della demo.

---

## BLOCKER — Problemi che impediscono il completamento del flusso

**NESSUN BLOCKER IDENTIFICATO.**

Tutti i flussi principali sono operativi e completabili senza aiuto esterno (tranne la navigazione dalla sidebar).

---

## SOURCE OF TRUTH VERIFICATION

| Tabella | Count | Stato |
|---------|-------|-------|
| `projects` (DJ workspace) | 4 | `project_type = null` su tutti — il workspace onboarding step rimane pending |
| `published_design_journeys` | 13 totali | 6 published + 7 archived (test di certificazione) |
| `/projects` frontend | 6 | Corretto — feed mostra solo `published` |
| `leads` via CRM | 11 leads + 5 accounts | Corretti, persistiti |
| `design_journeys` | 0 via `/api/journeys/mine` | L'admin non è il cliente del DJ — i journey sono visibili via `/api/relations/accounts` |

**Discrepanza rilevata e risolta**: l'endpoint `/api/public/studio/published-journeys/feed` (con tenant_slug come query param) restituisce 0. L'endpoint corretto è `/api/public/published-journeys/{tenant_slug}/feed`. Il frontend usa l'endpoint corretto — nessun bug operativo.

---

## DOMANDE RICORRENTI (attese dal primo cliente)

1. "Come modifico il testo della homepage?" → trovare "Experience" nella sidebar
2. "Dove vedo le richieste che mi arrivano?" → CRM Leads (sidebar non etichettata)
3. "Ho cliccato 'Prenota una consulenza' — ma questa si chiama Design Journey™?" → alias intenzionale
4. "Il mio progetto non appare sul sito" → verificare che sia PUBLISHED (non DRAFT) in Projects Studio
5. "Come invito un collega?" → Settings → Membri
6. "Dove pubblico un articolo?" → sidebar Growth → Magazine (post-fix)
7. "Cosa devo fare adesso?" → banner onboarding (se non dismissato)
8. "Cosa è Blueprint Chameleon?" → domanda garantita al primo accesso (banner era presente, ora opzionale)
9. "Come assegno un partner a un progetto?" → helper text presente nel modal (post-fix F3)
10. "Dove trovo i clienti già attivi?" → CRM → ACTIVE STUDIO (Accounts)

---

## QUICK WINS (alto impatto, modifica minima)

| # | Fix | Impatto | Tipo |
|---|-----|---------|------|
| QW1 | Dismissare il Setup banner prima della consegna al cliente (`POST /api/tenant-onboarding/dismiss`) | ALTO | Operativo |
| QW2 | Tenere la sidebar espansa nella prima sessione cliente (basta espanderla, rimane salvata) | ALTO | Operativo |
| QW3 | Aggiungere un documento onboarding 1 pagina: "dove trovare Lead, come pubblicare progetto, dove pubblicare articolo" | ALTO | Documentazione |
| QW4 | Fare la demo con un DJ precompilato (non vuoto) | MEDIO | Demo |
| QW5 | Rinominare la sezione CRM "DISCOVERY" → "Nuove Richieste", "ACTIVE STUDIO" → "Clienti Attivi" (modifica label senza cambio architettura) | MEDIO | UX fix |

---

## V2.0 BACKLOG (solo problemi osservati realmente)

| Problema | Osservato in | Gravità |
|---------|-------------|---------|
| Sidebar: etichette visibili di default | TEST 1A, 1B, 1D | ALTA |
| CRM label localizzate (IT) | TEST 1D | MEDIA |
| Guida contestuale DJ workspace (cosa fare in ogni fase) | TEST 4A | MEDIA |
| Coerenza terminologica "Consulenza" vs "Design Journey" | TEST 3A | BASSA |
| Workspace onboarding step: riconoscere `published_design_journeys` come "workspace configurato" | Source of Truth | BASSA |

---

*Report generato il 2026-06-20 — Pilot Customer Validation Sprint*
