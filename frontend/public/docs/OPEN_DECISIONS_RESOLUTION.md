# OPEN DECISIONS — RESOLUTION PACK
## MOOD for DESIGN™ · Studio Activation Lifecycle™

> **Scope**: chiusura delle 10 Open Architectural Decisions di `STUDIO_ACTIVATION_LIFECYCLE.md` §9
> **Format**: A/B con raccomandazione · zero teoria · zero codice
> **Action required**: approvare il "Recommended Package" finale o fare override per le decisioni che vuoi cambiare
> **Versione**: 2026-05-31

---

# DECISION 01
## Subdomain pattern

### Problema
Ogni tenant avrà un proprio URL. Servono due possibili pattern:
`<slug>.moodfordesign.com` oppure `<slug>.app.moodfordesign.com`. La scelta è permanente: condiziona DNS, certificati, branding URL su tutto il materiale di marketing.

### Opzione A — `<slug>.moodfordesign.com` (apex subdomain)
**Vantaggi**
- URL più corto, premium, brand-first
- Identico al pattern già usato dai competitor B2B premium (Notion, Linear, Figma)
- Più memorabile per il cliente del founder

**Svantaggi**
- Lo spazio degli slug è "sacro": ogni nome consumato è perso per sempre (resta in `reserved_subdomains` lifetime)
- Marketing site convive nello stesso namespace → ogni nuova route corporate deve evitare collisioni

### Opzione B — `<slug>.app.moodfordesign.com`
**Vantaggi**
- Separazione netta marketing (apex) vs app (sotto `app.`)
- DNS più semplice da gestire, certificato wildcard più isolato
- Zero collisione tra slug tenant e route corporate

**Svantaggi**
- URL più lungo e meno premium
- Suona "SaaS commodity" più che "atelier"

### Raccomandazione
**Opzione A**. Il posizionamento MOOD richiede un URL premium. Lo spazio slug si gestisce con `reserved_subdomains` ben curato e un naming review per ogni nuova rotta marketing.

### Impatto
**Alto** (DNS + cert + tutti i link futuri)

### Bloccante implementazione?
**SÌ** — va decisa prima di Phase D (provisioning).

---

# DECISION 02
## Bring Your Own Domain (BYOD)

### Problema
In futuro un tenant potrà voler usare il proprio dominio (es. `studio.martinel.it`) come puntamento al proprio Blueprint, in alternativa o in parallelo al subdomain MOOD?

### Opzione A — Sì (in roadmap P3)
**Vantaggi**
- Up-sell premium tier ("White-label")
- Adatto a brand consolidati che non vogliono URL terzo

**Svantaggi**
- Complessità infra: DNS verification, cert provisioning per dominio terzo, monitoring uptime
- Effort di engineering non banale (P3 stimato: 4-6 settimane)

### Opzione B — No, mai
**Vantaggi**
- Tutti i tenant vivono sotto `moodfordesign.com` → brand consistency totale
- Infra semplificata permanentemente

**Svantaggi**
- Esclude tenant brand-first che vogliono URL proprio
- Possibile blocker commerciale su clienti enterprise

### Raccomandazione
**Opzione A**, posizionata in P3 (roadmap, non backlog frozen). Non implementare ora ma tenerla viva come leva commerciale futura. Documentare nel data model che `tenant_custom_domain` è un campo previsto ma null per default.

### Impatto
**Basso oggi · Alto in P3**

### Bloccante implementazione?
**NO** — decisione di roadmap, non architetturale immediata.

---

# DECISION 03
## Founder = singolo utente o multipli co-founder?

### Problema
Un tenant ha 1 founder fisso o può avere N co-founder con stessi poteri sul Blueprint?

### Opzione A — Single founder, multipli "co-owner" promossi
**Vantaggi**
- Modello semplice: 1 founder = 1 billing owner = 1 owner legale
- Chiarezza giuridica (responsabilità contrattuale, signature)
- Resto del team gestito via `tenant_memberships` con ruoli granulari

**Svantaggi**
- Se il founder lascia lo studio fisicamente, serve un transfer-of-ownership esplicito
- Un solo punto di failure su billing/legal

### Opzione B — Multi-founder paritari fin dall'attivazione
**Vantaggi**
- Riflette la realtà degli studi a 2-3 soci paritari
- Nessun transfer-of-ownership necessario

**Svantaggi**
- Conflitti: chi decide sulle modifiche al billing? Sulla suspension?
- Modello legale ambiguo
- Complica `studio_request` (chi è il referente?) e provisioning (chi riceve il magic-link?)

### Raccomandazione
**Opzione A**. 1 founder = 1 billing owner. I co-founder reali vengono aggiunti come `role=co_founder` con permessi Blueprint identici al founder ma **senza** controllo billing. Il transfer-of-ownership è una feature P2 (raro ma tracciato).

### Impatto
**Medio** (schema `tenant_memberships` deve prevederlo)

### Bloccante implementazione?
**SÌ** — definisce il modello dati `users` + `tenant_memberships`.

---

# DECISION 04
## UX di tenant suspension

### Problema
Quando un Super Admin sospende un tenant (per insoluti, ToS violation, security incident), cosa vede il founder atterrando sul proprio subdomain?

### Opzione A — Pagina minima "Workspace suspended"
**Vantaggi**
- Comunicazione chiara, no ambiguità
- Email di pre-notifica 48h prima (vedi V41 futuro)
- CTA "Contact support" → riapertura strutturata

**Svantaggi**
- Se la suspension è per security incident, esporre la causa al founder può essere problematico
- Va modulato il messaggio per ragione (billing vs security vs ToS)

### Opzione B — Redirect silente alla home corporate
**Vantaggi**
- Nessuna esposizione del problema (utile in caso di compromesso)
- Il founder è costretto a contattare MOOD per capire

**Svantaggi**
- Esperienza opaca, anti-pattern
- Genera ticket di supporto inutili ("perché non si apre più?")
- Suona come bug, non come decisione

### Raccomandazione
**Opzione A** con templating per ragione: 3 varianti di pagina (`suspended_billing`, `suspended_review`, `suspended_security`), tutte con CTA support, email di pre-notifica obbligatoria 48h prima salvo casi `security`.

### Impatto
**Basso** (1 pagina + 3 template email)

### Bloccante implementazione?
**NO** — feature post-MVP. La suspension stessa è P2.

---

# DECISION 05
## Blueprint Origin™ versioning — auto-migration?

### Problema
Quando rilasciamo Blueprint Origin v2 (con miglioramenti strutturali), i tenant esistenti su Origin v1 vengono migrati automaticamente?

### Opzione A — Sì, auto-migrate
**Vantaggi**
- Tutti i tenant sempre allineati all'ultima versione
- Manutenzione singola
- Nessuna "lost generation" su vecchie versioni

**Svantaggi**
- Migration può rompere customizzazioni del tenant (brand, override editoriali)
- Rischio outage durante migration di massa
- Nessun controllo del founder sulla data di upgrade

### Opzione B — No, stay-on-version + opt-in upgrade
**Vantaggi**
- Sicurezza: nulla cambia senza azione esplicita advisor/founder
- Tenant possono pianificare l'upgrade
- A/B comparative possibile (v1 vs v2 in produzione)

**Svantaggi**
- Frammentazione: codebase deve supportare più versioni Origin in parallelo
- Onere manutenzione su versioni vecchie
- Deprecation policy serve eventualmente

### Raccomandazione
**Opzione B**. Stay-on-version. Upgrade tramite job dedicato `POST /api/admin/tenants/:id/blueprint/upgrade` triggerato dall'advisor previa conferma founder. Deprecation policy: una versione Origin è supportata per ≥ 24 mesi.

### Impatto
**Medio** (richiede `origin_version` su tutto il blueprint scoped)

### Bloccante implementazione?
**SÌ** — perché il campo `origin_version` va sui dati dal giorno 1.

---

# DECISION 06
## Provisioning failure — auto-rollback o escalation?

### Problema
Se gli Step 6/7 (clone + DNS) falliscono dopo i 3 retry programmati, il sistema cosa fa?

### Opzione A — Auto-rollback (cleanup automatico)
**Vantaggi**
- Stato consistente garantito
- Nessun "tenant zombie" in `provisioning`
- Pulizia automatica di DNS orfani

**Svantaggi**
- Una transient failure (es. DNS provider momentaneo) può cancellare lavoro recuperabile
- Founder già notificato dell'approvazione potrebbe non capire perché "scompare"
- Audit più difficile

### Opzione B — Escalation a Super Admin + tenant resta "provisioning" finché manualmente risolto
**Vantaggi**
- Nessuna perdita di stato
- Super Admin può intervenire chirurgicamente (skip step, force retry, manual DNS)
- Audit chiaro

**Svantaggi**
- Tenant resta in stato anomalo finché qualcuno non lo guarda
- SLA dipendente da reattività HQ

### Raccomandazione
**Opzione B**. Escalation. Generare un ticket interno automatico (`/command-center/ops/incidents`) con full payload + ultimo errore. Founder riceve email "stiamo finalizzando il tuo workspace" (no panic). Tenant resta `provisioning`, mai auto-rollback.

### Impatto
**Medio** (sistema di ticket + queue worker behavior)

### Bloccante implementazione?
**SÌ** — definisce il comportamento del Provisioning Engine™.

---

# DECISION 07
## Reserved subdomains — chi può gestirli a runtime?

### Problema
La lista `reserved_subdomains` evolve nel tempo (nuove route MOOD, brand protection, ecc.). Chi può modificarla a runtime?

### Opzione A — Solo Super Admin via Command Center
**Vantaggi**
- Massima protezione: nessun rischio di cancellare per errore una protezione critica
- Audit chiaro

**Svantaggi**
- Bottleneck su Super Admin per richieste comuni (es. "aggiungiamo `pinterest` ai reserved")

### Opzione B — Super Admin + Advisor con permission `manage_reserved`
**Vantaggi**
- Decentralizzato, più rapido
- Advisor di trust può estendere

**Svantaggi**
- Più rischio di errore
- Audit più complesso (chi ha aggiunto cosa quando?)

### Raccomandazione
**Opzione A**. Lista riservata = perimetro di sicurezza. Solo Super Admin tramite `/command-center/system-config/reserved-subdomains` (P2 backlog). Ogni write logga in audit con motivazione obbligatoria.

### Impatto
**Basso** (1 pagina admin)

### Bloccante implementazione?
**NO** — il seed iniziale copre 95% dei casi. La UI di gestione è P2.

---

# DECISION 08
## Advisor commission attribution — token vs assignment

### Problema
Se un visitatore arriva con un referral token advisor (`?ref=X`) e poi viene approvato da advisor Y (perché X non è disponibile), a chi va la commissione?

### Opzione A — Token wins (referral originator)
**Vantaggi**
- Premia il lavoro di prospezione/marketing dell'advisor X
- Coerente con il modello "chi porta il lead"
- Trasparente: il token nel link è il contratto

**Svantaggi**
- Disincentiva advisor Y a chiudere lead di altri
- Se X è inattivo da mesi, è giusto che incassi?

### Opzione B — Assignment wins (chi chiude)
**Vantaggi**
- Premia il lavoro di chiusura/review
- Mantiene gli advisor attivi motivati
- Se X non risponde, Y prende tutto

**Svantaggi**
- Toglie incentivo al referral
- Tensione interna nel team advisor

### Raccomandazione
**Split 50/50 con default token-wins se assignment = token**. Se referral token presente E advisor diverso chiude → 50% al token originator, 50% al closer. Se è la stessa persona → 100% a quella. Configurabile per advisor tier in `tqs_versions` futuri. Decisione FROZEN finché Commercial Terms Engine non parte (P3).

### Impatto
**Alto** (modello commerciale)

### Bloccante implementazione?
**NO** — il sistema può registrare entrambi i campi (token + assignment) e il calcolo commissioni arriva con Billing Engine in P3.

---

# DECISION 09
## TQS visibility al Founder

### Problema
Il Tenant Qualification Score™ (0-100, tier HOT/WARM/COLD/OBSERVE) è dato interno. Il founder può vedere il proprio score?

### Opzione A — Mai. Solo interno.
**Vantaggi**
- Tutela del founder da feedback potenzialmente offensivo (`COLD/OBSERVE`)
- Lo score è strumento operativo MOOD, non un giudizio sul cliente
- Coerente con il posizionamento: "ti ascoltiamo, non ti misuriamo"

**Svantaggi**
- Founder non sa perché è stato rifiutato (se rifiutato): serve copy human-friendly nel rejection
- Trasparenza vs paternalismo

### Opzione B — Visibile al founder dopo l'approvazione (no tier, solo "high potential" badge)
**Vantaggi**
- Sensazione di status per HOT
- Trasparenza minima

**Svantaggi**
- Crea aspettative ("ho 92, perché sono COLD?")
- Toglie utilità diagnostica interna

### Raccomandazione
**Opzione A**. Mai esposto. Le rejection comunicano motivazione editoriale (umana, non numerica). Lo score è uno strumento operativo MOOD, fine. **Già pre-confermato nel canonical doc** — qui riconferma esplicita.

### Impatto
**Basso**

### Bloccante implementazione?
**NO** — basta non implementare l'esposizione lato Blueprint.

---

# DECISION 10
## Re-submission policy dopo rejection

### Problema
Un studio_request `rejected` può essere ri-submitted dalla stessa email/founder? Quando, come?

### Opzione A — Sì, dopo 30 giorni · stessa email permessa
**Vantaggi**
- Il founder può evolvere lo studio e ri-candidarsi
- Coerente con un funnel "open ma curato"
- Capture growth a medio termine

**Svantaggi**
- Possibile spam di re-submission
- Advisor team deve riconoscere il caso ("hai già rifiutato 2 mesi fa")

### Opzione B — No, hard-block · serve nuova email
**Vantaggi**
- Niente complessità di tracking storico
- Chi è stato rifiutato non torna

**Svantaggi**
- Esperienza brutale ("non sei mai più benvenuto")
- Aggira facilmente con altra email → block illusorio
- Perde lead che evolvono nel tempo

### Raccomandazione
**Opzione A**. Stesso email permesso dopo 30 giorni dal `rejected_at`. Il nuovo `studio_request` riceve un flag `previous_attempts_count` visibile all'advisor nel Command Center, così la review parte con contesto storico. Hard block solo per email flaggata `abuse`.

### Impatto
**Basso** (1 campo aggiuntivo + 1 check sul submit)

### Bloccante implementazione?
**SÌ** — minimo: il campo `previous_attempts_count` va creato in `studio_requests_v2` dal giorno 1.

---

# Recommended Package

> **Approvato dall'utente il 2026-05-31.**
> Lo storico delle scelte effettive è di seguito; la sezione di scelta originale è preservata come reference.

```
Decision 01 → A   · APPROVED   · subdomain: <slug>.moodfordesign.com
Decision 02 → A   · DEFAULT    · BYOD: roadmap P3
Decision 03 → A   · APPROVED   · 1 founder + co-founder come ruolo
Decision 04 → A   · DEFAULT    · suspension UX con template per ragione
Decision 05 → B   · APPROVED W/NOTE · Origin: stay-on-version + opt-in MVP
                                       Nota utente: "rivalutare aggiornamenti modulari
                                       dopo Blueprint Origin™"
Decision 06 → B   · APPROVED W/NOTE · provisioning failure: escalation manuale
                                       Nota utente: "ammessa solo come policy operativa MVP.
                                       Obiettivo futuro: provisioning engine resiliente
                                       e automatizzato"
Decision 07 → A   · APPROVED   · reserved subdomains: Super Admin only
Decision 08 → FROZEN          · Congelata fino a definizione di Advisor Program™,
                                  Billing™, Commissions™ e Attribution™
Decision 09 → A   · APPROVED   · TQS mai esposto al founder
Decision 10 → A   · APPROVED   · re-submission permessa dopo 30 giorni
```

## Action items derivati

| Decision | Implementazione richiede |
|---|---|
| 01 | DNS wildcard `*.moodfordesign.com` + cert wildcard + ingress configurabile |
| 03 | Schema `users` con ruoli `founder` + `co_founder` + `tenant_memberships` con billing_owner flag |
| 05 | Campo `origin_version` su tutto il Blueprint scoped + endpoint `POST /api/admin/tenants/:id/blueprint/upgrade` (P2) |
| 06 | Queue worker con max 3 retry + tabella `provisioning_incidents` per escalation HQ |
| 07 | Pagina admin `/command-center/system-config/reserved-subdomains` (P2) |
| 09 | Nessuna esposizione TQS in API Blueprint-facing |
| 10 | Campo `previous_attempts_count` + `previous_rejection_at` su `studio_requests_v2` |

## In FROZEN

- **Decision 08 — Commission Attribution**: il sistema registra entrambi i campi (`referrer_advisor_token` + `advisor_assigned_to`) dal giorno 1. Il calcolo commissioni resta non-implementato fino a definizione completa di Advisor Program™ + Billing™ + Commissions™ + Attribution™ (P3).

---

## Bloccanti riepilogati

Le decisioni marcate **SÌ** in "Bloccante implementazione" devono essere chiuse prima di iniziare Phase A (DB foundation):

| Decision | Bloccante | Motivo |
|---|---|---|
| 01 · Subdomain pattern | SÌ | Definisce DNS + cert + URL su tutto il materiale |
| 03 · Single founder model | SÌ | Schema `users` + `tenant_memberships` |
| 05 · Origin versioning | SÌ | Campo `origin_version` su Blueprint dal giorno 1 |
| 06 · Provisioning failure | SÌ | Comportamento Provisioning Engine™ |
| 10 · Re-submission | SÌ | Campo `previous_attempts_count` su `studio_requests_v2` |

Le altre 5 (02, 04, 07, 08, 09) possono essere chiuse anche dopo MVP senza ritardare l'implementazione.

---

## Come rispondere

**Approva tutto il pacchetto raccomandato**:
> ✅ Approvo Recommended Package

**Override puntuali**:
> Approvo Recommended Package con override:
> Decision 03 → B
> Decision 06 → A

**Richiedi revisione**:
> Voglio discutere Decision NN, vai più in profondità su XYZ

---

*STOP — in attesa di approvazione utente.*
