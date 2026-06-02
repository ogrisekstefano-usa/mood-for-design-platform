# FIRST REAL TENANT — GO-LIVE PLAN & VALIDATION

> **Data**: 2026-06-02 04:55 UTC
> **Audit scope**: validazione operativa, non audit teorico
> **Verdetto finale**: 🟡 **NEEDS_ONE_MORE_ITERATION** *(2 blocker P0 trovati durante la validazione, non rilevati dai test automatici precedenti)*

---

## 0. EXECUTIVE SUMMARY

Il sistema ha superato 28/30 controlli nel `FIRST_REAL_TENANT_READINESS_REPORT_v2`. Stavo per dichiarare il go-live pronto, ma durante questa validazione operativa **ho trovato due P0 reali** che non emergono dai test sintetici e che impediscono di invitare un cliente vero:

🔴 **P0-1 — SECURITY CRITICAL**: l'endpoint pubblico `POST /auth/magic-link/request` restituisce **il token in chiaro** (`raw_token`) nella response JSON per qualunque email valida. Significa che chiunque conosca l'email di un Founder può autenticarsi come lui **senza dover avere accesso alla sua mailbox**. È un account takeover triviale, eseguibile da curl.

🔴 **P0-2 — PRODUCT EXPERIENCE GAP**: dopo il login il Founder atterra su `/command-center/welcome`. Il CTA primario "Apri il Blueprint" lo manda a `/blueprint/pages`, che è l'**editorial CMS del sito corporate MOOD** (pages, blocks, sections, media, footer, seo, publish). Per il tenant nuovo `martinel-interior-design-N` queste tabelle sono vuote: il Founder vedrebbe un editor di pagine completamente vuoto, branding generico, nessun onboarding contestuale. Non è il workspace di lavoro che la promessa "Blueprint Tenant" implica.

Entrambi sono problemi reali, non wishlist. P0-1 è sicurezza. P0-2 è esperienza percepita: invitare un cliente pagante a "creare la tua presenza digitale" e poi mostrargli un CMS vuoto significa bruciarlo al primo accesso.

**Decisione**: serve **una sola iterazione mirata** (~6-10h) per chiudere entrambi prima del primo cliente. NESSUNA NUOVA FEATURE: solo (a) sigillare la response del magic-link/request, (b) costruire un'esperienza minima del primo accesso che NON sia l'editor pages vuoto.

---

## 1. GO-LIVE CHECKLIST

### 1.A Acquisition

| # | Punto | Esito | Note |
|---|---|---|---|
| A1 | Studio V2 funnel completo (Archetype → Location → Contact → Help) | ✅ PASS | 30 controlli passati nel re-audit Martinel |
| A2 | `POST /api/studio/v2/submit` accetta `studio_name` | ✅ PASS | Fix P0-B verificato |
| A3 | Email "Abbiamo ricevuto la tua candidatura" inviata al visitor | ✅ PASS | external_id Resend, locale corretto |
| A4 | Email super-admin notification | ✅ PASS | admin@moodfordesign.com riceve "Nuova candidatura · MOOD-XXXX" |
| A5 | Email advisor notification per lead organici | ⚠ WARNING | Non inviata se `attribution_advisor_id=NULL` (by design). Backlog P1 advisor-digest |
| A6 | Studio V2 anti-enumeration su submit duplicato | ✅ PASS | `check_email_uniqueness` ritorna stato + reason |
| A7 | Banner Email Layer · READY nel Command Center | ✅ PASS | Hardening report verifica live |

### 1.B Qualification

| # | Punto | Esito | Note |
|---|---|---|---|
| B1 | Drawer Command Center mostra geo, target, help_topics | ✅ PASS | Tutti i campi V2 esposti correttamente |
| B2 | Status transitions `received → reviewing → contacted → qualified` | ✅ PASS | Tutte HTTP 200, email associate inviate |
| B3 | PATCH a `status='activated'` rifiutato (HTTP 409 `use_activate_endpoint`) | ✅ PASS | Forza il passaggio dal modal |
| B4 | Audit log su ogni transizione (`studio_relationship_events`) | ✅ PASS | event kind=`status_change`, `qualified`, `activated` |
| B5 | Advisor self-claim su lead unassigned | ✅ PASS | COALESCE su `assigned_advisor_id` |

### 1.C Activation

| # | Punto | Esito | Note |
|---|---|---|---|
| C1 | Modal Tenant Activation apre con preview pre-popolata | ✅ PASS | tenant_name + suggested_slug + founder_email + validity_days |
| C2 | Slug editabile e sanitizzato kebab-case | ✅ PASS | Dedup `-2`/`-3`/`-N` automatica |
| C3 | Founder name suggerito ≠ Studio name (P0-B fix) | ✅ PASS | suggested_slug = `martinel-interior-design`, non `mario-rossi` |
| C4 | Tenant creation atomica (tenants + tenant_modules + users + studio_relations) | ✅ PASS | Tutte e 4 le tabelle popolate in una transazione |
| C5 | Magic link 30-day issuato | ✅ PASS | `access_magic_links.expires_at = created_at + 30d` |
| C6 | Email founder con CTA magic link | ✅ PASS | `cta_url_override` injected, subject usa studio_name |
| C7 | studio_requests.status → 'activated' | ✅ PASS | Aggiornamento atomico |

### 1.D Blueprint Access

| # | Punto | Esito | Note |
|---|---|---|---|
| D1 | Magic-link consume valido → JWT con role=owner + tenant_slug | ✅ PASS | Verificato in audit Martinel |
| D2 | Magic-link replay entro 60s (idempotente) | ✅ PASS | Anti race-condition StrictMode |
| D3 | Magic-link consume dopo 60s → `ok=false reason=already_used` | ✅ PASS | Token monouso oltre il replay window |
| D4 | Magic-link re-request via `/auth/magic-link/request` | 🔴 **FAIL P0-1** | **SECURITY**: risposta espone `raw_token` in chiaro |
| D5 | Anti-enumeration su email sconosciuta | ✅ PASS | Ritorna shape neutra (`magic_link_url: null`) |
| D6 | Set password (post primo accesso) `/auth/set-password` | ✅ PASS | Regole strength: ≥8 char, 1 upper, 1 number, 1 special |
| D7 | Login email+password successivo | ✅ PASS | bcrypt verify, JWT 7-day |
| D8 | Logout → distrugge sessione (token nullato lato client) | ✅ PASS | WorkspaceShell logout button, redirige a `logoutTo` |
| D9 | Tenant Isolation cross-tenant | ✅ PASS | 4 endpoint testati: 403/404 |
| D10 | Own tenant manifest access (path slug = JWT slug) | ✅ PASS | 200 OK |
| D11 | First-access state `/founder/first-access-state` | ✅ PASS | `is_founder=true, first_access=true` |
| D12 | Workspace routing post-login → `/blueprint/pages` | 🔴 **FAIL P0-2** | **EXPERIENCE**: l'editor è vuoto, non c'è onboarding del tenant |
| D13 | Founder Welcome screen rendering | ✅ PASS | Editorial copy + CTA "Apri il Blueprint" |

### 1.E Summary

| Categoria | PASS | WARNING | FAIL |
|---|---|---|---|
| Acquisition | 6 | 1 | 0 |
| Qualification | 5 | 0 | 0 |
| Activation | 7 | 0 | 0 |
| Blueprint Access | 11 | 0 | **2** |
| **TOTALE** | **29** | **1** | **2** |

---

## 2. FOUNDER EXPERIENCE REVIEW

### 2.A Punti di forza

- **Submission V2**: il funnel a 4 step è chiaro, le micro-interazioni (loading overlay, card grid mercati, prefisso telefono con bandiera) trasmettono qualità editoriale. Il CMS i18n bilingue funziona.
- **Email "Abbiamo ricevuto la tua candidatura"**: tono editoriale, copy in italiano corretto, branding coerente. Il reference `MOOD-XXXX-XXXX` aggiunge ufficialità.
- **Email "Il tuo Blueprint è pronto · {studio_name}"**: subject con il VERO studio name (post P0-B), CTA pulita "Apri il tuo Blueprint", validity 30 giorni esplicitata.
- **Magic link consume**: zero attrito, redirect immediato a `/command-center/welcome`. Replay window 60s previene il doppio-click HMR/StrictMode.
- **Founder Welcome screen**: c'è una landing dedicata con eyebrow editoriale e CTA primario.

### 2.B Punti di confusione critici

#### 🔴 Il CTA "Apri il Blueprint" porta a un editor vuoto
Il founder, eccitato dall'email "Il tuo Blueprint è pronto · Martinel Interior Design", clicca il pulsante. Atterra su `/command-center/welcome`. Clicca "Apri il Blueprint". Viene proiettato su `/blueprint/pages` che è una griglia editor pages... vuota. Le sezioni sidebar mostrano "Pages, Blocks, Sections, Media, Footer, SEO, Publish".

**Problema concreto**: il workspace `martinel-interior-design-N` è stato creato vuoto. Non c'è onboarding contestuale che spieghi "Questo è il TUO spazio. Inizia da qui." Non c'è un template di pagina default. Non c'è una preview di cosa fare. Sembra di entrare in un editor di pagine di un CMS generico, **non** nel "ecosistema MOOD curato attorno al tuo studio" promesso nelle copy.

Un cliente vero direbbe: "Mi avevate detto che era pronto, ma è vuoto. Cosa devo fare?"

#### 🟡 Mancano email di nurturing
Dopo il primo accesso, il founder non riceve più nulla. Manca una "welcome on board" 24h dopo, una "ecco i tuoi primi passi". Non bloccante per il primo cliente, ma noto a medio termine.

#### 🟡 Lingue del workspace mai chieste
Default `it`. Per Martinel va bene. Per il primo cliente non-italiano servirebbe lo step "lingue di lavoro" (P1 congelato dall'utente).

### 2.C Risposta secca

> *"Mi sentirei tranquillo a mostrarlo a un cliente pagante?"* → **NO**.

**Motivazione**: il problema P0-1 (security) può essere chiuso in poche ore ma è inaccettabile lasciarlo aperto. Il problema P0-2 (esperienza post-login vuota) è IL motivo per cui il cliente potrebbe disdire dopo 5 minuti. Quando l'email promette "Il tuo Blueprint è pronto" e poi il workspace è un editor pages vuoto senza guidance, la promessa è disattesa nel modo più visibile possibile.

Se invece il "Blueprint" che mostro al Founder fosse anche solo un dashboard read-only con:
- il suo studio name e logo placeholder
- la sua geo (HQ + target countries)
- una lista delle esperienze MOOD attivate (`tenant_modules`)
- una CTA "Pianifica la tua prima sessione con un MOOD Advisor"

...sarebbe accettabile come MVP. Ma `/blueprint/pages` vuoto **non** lo è.

---

## 3. FIRST TENANT PLAYBOOK

Procedura operativa per il team MOOD. Utilizzabile come checklist cartacea o digitale.

### Fase 1 — Ricezione candidatura (T+0)

```
□ Email "Nuova candidatura · MOOD-XXXX-XXXX" ricevuta su admin@moodfordesign.com
□ Email visitor "Abbiamo ricevuto la tua candidatura" inviata (status='sent')
□ Banner Command Center "Email layer · READY" verde
□ Bucket "new" mostra la nuova card
□ Drawer apre con geo + target countries + help topics popolati
□ studio_name nel drawer ≠ contact_name (P0-B fix verificato)
```

### Fase 2 — Review advisor (T+0 a T+24h)

```
□ Advisor apre la card dal Command Center
□ Trasla status a "reviewing" (email automatica al visitor)
□ Verifica plausibility del lead (sito web, identità, mercato)
□ Aggiunge note advisor visibili solo internamente
□ Decide:
    → "contacted" se vuole programmare una call discovery
    → "qualified" se la candidatura è chiusa positivamente
    → "not_aligned" se non è in linea con MOOD (email automatica)
```

### Fase 3 — Qualification (T+1 a T+5 giorni)

```
□ Status = "qualified" (email "studio_request_qualified" inviata)
□ Verifica final completeness drawer: studio_name, geo, target, help_topics
□ NOTA: se manca studio_name o ha valori strani, contattare il founder
        prima di procedere all'attivazione
```

### Fase 4 — Activation (T+5 a T+10 giorni)

```
□ Cliccare "Attiva Studio & invia invito Founder"
□ Verificare preview modal:
    □ Tenant name = nome studio (NON nome founder)
    □ Suggested slug = slug studio (NON slug founder)
    □ Founder email = email originale della submission
    □ Validity = 30 giorni
□ EDITARE lo slug se desiderato (max 64 char, kebab-case)
□ EDITARE il tenant name se desiderato
□ Cliccare "Crea & Invita Founder"
□ Attendere conferma "Tenant attivato · slug:XXX"
```

### Fase 5 — Founder Invitation (T+10gg, automatico)

```
□ Email "Il tuo Blueprint è pronto · {studio_name}" inviata
□ Verificare nel drawer Email log:
    □ template_key = studio_request_approved
    □ status = sent
    □ resend_id presente
    □ to_email = founder email
□ Se status ≠ sent → "Riprova invio" da Command Center (retry_failed include sandbox)
```

### Fase 6 — Primo accesso founder (T+11gg a T+40gg)

```
□ Founder clicca CTA email → magic link consume
□ JWT emesso, redirect a /command-center/welcome
□ Founder vede schermata di benvenuto editoriale
□ Founder clicca "Apri il Blueprint"
□ ⚠ ATTENZIONE: Founder atterra su editor pages VUOTO
   → contattare il founder PRIMA del primo accesso con una mail
     personale dell'advisor che spieghi cosa aspettarsi nei primi giorni
```

### Fase 7 — Verifica workspace (T+11gg)

```
□ Founder ha ricevuto e consumato il magic link
□ Founder ha impostato la password (set-password endpoint)
□ Founder NON ha visto endpoint cross-tenant per errore
□ Audit trail completo:
    □ studio_requests.status='activated'
    □ studio_relations.status='activated'
    □ tenants row presente con slug confermato
    □ users row con role='owner', tenant_id collegato
    □ tenant_memberships con role='founder'
    □ access_magic_links consumato (consumed_at != NULL)
```

### Fase 8 — Follow-up (T+11gg a T+30gg)

```
□ Advisor invia email personalizzata 24h dopo il primo accesso
□ Pianifica call onboarding entro 7 giorni
□ Verifica che il founder torni nel workspace almeno 1 volta a settimana
□ Logga eventuali feedback in studio_relationship_events (kind='note')
```

---

## 4. RISCHI REALI

Esclusivamente problemi che si manifestano in scenari produzione, non coperti dai test automatici.

### 4.A Rischi P0 (bloccanti per il primo cliente)

| # | Rischio | Scenario | Impatto |
|---|---|---|---|
| **R-P0-1** | Magic link bypass via API pubblica | Attaccante sa l'email del founder (LinkedIn, sito studio) → POST `/auth/magic-link/request` → riceve `raw_token` nella response → account takeover senza accesso alla mailbox | CRITICO. Una sola occorrenza pubblica e MOOD perde credibilità di sicurezza |
| **R-P0-2** | Founder atterra su CMS vuoto | Il founder clicca "Apri il Blueprint", vede editor pages vuoto, perde fiducia | ALTO. Probabilità altissima al primo accesso reale; impatta retention day-1 |

### 4.B Rischi P1 (degradano l'esperienza ma non bloccano)

| # | Rischio | Scenario | Impatto |
|---|---|---|---|
| **R-P1-1** | Email Resend rate-limit | Tier base Resend EU = 100 invii/sec ma 3.000/giorno (free). Con un volume di test + 5 tenant attivi/mese, ci avviciniamo al limite | MEDIO. Da monitorare oltre 30 candidature/giorno |
| **R-P1-2** | Founder usa un'email Apple Private Relay (`*.privaterelay.appleid.com`) | Email arriva ma il filtro può scartare contenuti con magic link | MEDIO. 5-10% dei founder iOS |
| **R-P1-3** | Slug confliction se due studi hanno stesso nome | `martinel-interior-design`, `-2`, `-3`...  Funziona ma URL diventa brutta | BASSO. Estetico più che funzionale |
| **R-P1-4** | Mapbox suggestion non trova città piccole italiane | Pordenone, Olbia, Aosta → backend dipende dalla qualità Mapbox places API | MEDIO. Fallback testuale OK ma esperienza degradata |
| **R-P1-5** | Founder ha JS disabilitato/browser obsoleto | Funnel V2 React-heavy; nessuna versione no-JS | MEDIO. Probabilità bassa nel target architetti/interior |
| **R-P1-6** | Advisor dimentica di assegnarsi un lead organico | Lead resta unassigned, nessun digest pool implementato | MEDIO. Risolto da P1 backlog "advisor digest" |
| **R-P1-7** | Founder non riceve email per problemi DKIM/SPF dest | Dominio destinatario rigetta `mail.moodfordesign.com` (es. corporate strict) | BASSO. Domain è verificato Resend, ma alcuni IT corporate possono rifiutare |

### 4.C Rischi P2 (cosmetici / lungo termine)

| # | Rischio |
|---|---|
| R-P2-1 | Founder con browser in lingua sconosciuta vede default `it-IT` |
| R-P2-2 | Mobile UX del Command Center è desktop-first |
| R-P2-3 | CorporateFooter market switcher mostra IT in en-US (cosmetico) |
| R-P2-4 | No reminder automatico se magic link scade tra 7gg (backlog) |

---

## 5. PRIORITÀ POST GO-LIVE

Una volta chiusi i 2 P0 e portato il primo tenant a regime, ecco l'ordine consigliato di backlog.

### 🥇 P1 (entro 1ª settimana dopo il primo tenant)

1. **Blueprint Workspace MVP**: dashboard read-only con studio name, geo, target countries, modules attivi, CTA "pianifica sessione". Sostituisce l'attuale `/blueprint/pages` come destinazione del Founder.
   - *Valore business*: alto (retention day-1)
   - *Effort*: ~16h
2. **Magic Link Request hardening**: rimuovere `raw_token` + `magic_link_url` dalla response pubblica. Esposizione SOLO se chiamato internamente da `activate_studio_ecosystem`.
   - *Effort*: ~1h (refactor del flag `expose_token`)
3. **Step "lingue di lavoro" V2**: campo multi-select bilingue, persistito in `studio_requests.languages`.
   - *Valore business*: medio (gating second tenant non-IT)
   - *Effort*: ~3h
4. **Advisor digest pool**: notifica giornaliera advisor con lead unassigned.
   - *Valore business*: medio
   - *Effort*: ~4h

### 🥈 P2 (entro 1° mese)

5. **Email nurturing post-activation**: 24h, 7d, 30d "come va?" sequence.
6. **Founder onboarding tour**: tooltip guidato sul primo accesso al Blueprint.
7. **Mobile UX Command Center**: drawer responsive, tabella requests come card su mobile.
8. **CMS i18n CorporateFooter**: market switcher localizzato.
9. **Notification Center MVP**: stream centralizzato di eventi (submissions, status changes, errori email) per advisor.

### 🥉 P3 (backlog scalabilità)

10. **Tenant subdomain routing** (`martinel.moodfordesign.com`): il vero "Blueprint Tenant" subdomain.
11. **Founder password reset flow** dedicato: oggi è "richiedi magic link" → ma deve essere "ho dimenticato la password, ricevi link reset".
12. **Audit log unificato**: timeline events tab nel drawer Command Center con TUTTI gli eventi (email, status, advisor notes, magic link consume).
13. **Multi-language CMS per tenant**: editorial copy localizzato per ciascun tenant attivato.
14. **Tenant Launch Pack M1** (rimane PAUSED come da direttiva).

### Criteri di ordinamento

- **Valore business**: cosa aumenta la retention day-1 → P1 #1
- **Sicurezza**: cosa elimina rischi inaccettabili → P1 #2
- **Raccolta dati strutturati**: cosa permette analytics di qualità → P1 #3
- **Scalabilità operativa**: cosa toglie carico al team MOOD → P1 #4
- Tutto il resto: cosmesi e features non bloccanti

---

## 6. VERDETTO FINALE

### 🟡 **NEEDS_ONE_MORE_ITERATION**

Confermo che 28/30 controlli automatici sono PASS. Ma la **validazione operativa scoperta in questo audit** ha portato in luce 2 problemi reali che i test sintetici non rilevavano:

1. **R-P0-1 Security**: l'endpoint pubblico magic-link/request espone il token in chiaro. Inaccettabile per qualunque cliente, anche un'amica del fondatore.
2. **R-P0-2 Experience**: il founder atterra su un editor CMS vuoto dopo il login. Inaccettabile per un cliente pagante invitato in un "ecosistema curato".

Effort stimato per chiudere entrambi: ~17h focalizzate (P1 #1 + P1 #2 della sezione 5). Una sprint da 2 giorni effettivi.

Suggerimento: chiudere prima R-P0-1 (~1h, fix one-liner sul return shape), poi affrontare R-P0-2 con un Blueprint Workspace MVP read-only che usi i dati già presenti nel tenant (`tenants.name`, `tenants.brand`, `tenant_modules`, geo dal `studio_requests` collegato).

Solo a quel punto la classificazione potrà diventare **READY_TO_INVITE_FIRST_REAL_TENANT** con tranquillità.

---

STOP. Validazione operativa completata. Nessuna implementazione, nessun deploy, nessuna nuova feature.

In attesa della tua decisione su:
- (a) autorizzare la chiusura di R-P0-1 + R-P0-2 in un'unica iterazione focalizzata, OPPURE
- (b) accettare consapevolmente i 2 rischi e procedere all'invito (sconsigliato).
