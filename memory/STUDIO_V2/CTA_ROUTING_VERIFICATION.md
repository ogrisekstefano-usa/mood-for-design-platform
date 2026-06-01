# CTA ROUTING VERIFICATION
## Post-Patch Verification · MOOD for DESIGN™ Public Site

> **Data verifica:** 2026-05-31
> **Patch eseguita:** `/app/backend/scripts/cms_patch_cta_routing.py` — 8 sezioni aggiornate, idempotente
> **Reviewer:** Agent E1 (handoff fork)
> **Ambiente:** Preview · `https://editorial-platform-4.preview.emergentagent.com/`

---

## 0 · Verdetto sintetico

> ### ✅ ALL_CTAS_ALIGNED
>
> - **8/8 sezioni CMS** patched correttamente
> - **0** CTA pubblici che puntano ancora a `/dedicato-a` (eccetto il nav-link legittimo)
> - **0** CTA che puntano a percorsi legacy (`/begin-journey`, `/professional-access`)
> - **Funnel di attivazione coerente**: tutti i `Candida il tuo studio` / `Attiva Blueprint™` → `/studio`
> - **Dialogo Advisor coerente**: tutti i `Parlane con un Advisor` → `/supporto`

---

## 1 · Funnel di attivazione (`→ /studio`)

| Pagina | CTA testid | Label | Target | Stato |
|---|---|---|---|:---:|
| Globale (header) | `nav-right-activate_blueprint` | Attiva Blueprint™ | `/studio` | ✅ OK |
| Home `/` | `final-cta-primary` | Entra nel Design Journey™ | `/studio` | ✅ OK |
| Features `/caratteristiche` | `feature-hero-cta` | Candida il tuo studio | `/studio` | ✅ OK |
| Pricing `/versioni-prezzi` | `page-intro-cta` | Candida il tuo studio | `/studio` | ✅ OK |
| Training `/formazione` | `page-intro-cta` | Esplora MOOD Academy | `/studio` | ✅ OK |
| Support `/supporto` | `page-intro-cta` | Contatta il team | `/studio` | ✅ OK |

---

## 2 · Dialogo Advisor (`→ /supporto`)

| Pagina | CTA testid | Label | Target | Stato |
|---|---|---|---|:---:|
| Pricing `/versioni-prezzi` | `pricing-tier-cta-01` | Parlane con un Advisor (tier Blueprint Studio) | `/supporto` | ✅ OK |
| Pricing `/versioni-prezzi` | `pricing-tier-cta-02` | Parlane con un Advisor (tier Blueprint Practice) | `/supporto` | ✅ OK |
| Pricing `/versioni-prezzi` | `pricing-tier-cta-03` | Parlane con un Advisor (tier Blueprint Enterprise) | `/supporto` | ✅ OK |
| Pricing `/versioni-prezzi` | `pricing-comparison-contact-cta` | Parlane con un Advisor (comparison) | `/supporto` | ✅ OK |
| Pricing `/versioni-prezzi` | `pricing-ecosystem-cta` | Esplora il supporto | `/supporto` | ✅ OK |
| Global (header) | `nav-right-support` | Supporto | `/supporto` | ✅ OK |

> _Nota:_ tier_04 e tier_05 (legacy, non più previsti dal naming Opzione A) sono stati puliti da `/dedicato-a` a `/supporto` per consistency, anche se i loro blocchi `cta` label sono vuoti e non vengono renderizzati.

---

## 3 · Navigazione di Header / Login / Cross-link (audit completo)

| Pagina | CTA testid | Label | Target | Stato | Note |
|---|---|---|---|:---:|---|
| Globale | `nav-link-audience` | Dedicato a | `/dedicato-a` | ✅ OK | Link legittimo (pagina target è proprio audience) |
| Globale | `nav-link-features` | Caratteristiche | `/caratteristiche` | ✅ OK | |
| Globale | `nav-link-pricing` | Versioni e Prezzi | `/versioni-prezzi` | ✅ OK | |
| Globale | `nav-link-training` | Formazione | `/formazione` | ✅ OK | |
| Globale | `nav-right-login` | Accedi | `/accedi` | ✅ OK | |
| Audience `/dedicato-a` | `audience-hero-cta` | Scopri a chi ci rivolgiamo | `/dedicato-a#a-chi-ci-rivolgiamo` | ✅ OK | Anchor interno |
| Audience `/dedicato-a` | `page-intro-cta` | Scopri MOOD for DESIGN | `/caratteristiche` | ✅ OK | Cross-link narrativo |
| Home `/` | `hero-cta-primary` | Scopri il tuo Design Journey™ | `#` | ⚠️ Anchor placeholder — non blocking |
| Home `/` | `journey-cta` | Scopri il metodo MOOD for DESIGN™ | `/about` | ⚠️ `/about` route — vedi §6 |
| Home `/` | `triptych-magazine` | Magazine teaser | `/magazine` | ⚠️ Sub-feature route — non in lifecycle test |
| Home `/` | `triptych-projects` | Projects teaser | `/projects` | ⚠️ Sub-feature route |
| Home `/` | `triptych-materials` | Materials teaser | `/materials` | ⚠️ Sub-feature route |
| Studio `/studio` | `entrance-return` | Sei già dentro MOOD? Continua il tuo Design Journey | `/accedi` | ✅ OK |
| Training `/formazione` | `training-hero-cta-primary` | Scopri i percorsi | `/formazione#percorsi` | ✅ OK |
| Training `/formazione` | `training-hero-cta-secondary` | Guarda i tutorial | `/formazione#tutorial` | ✅ OK |
| Training `/formazione` | `editorial-card-cta-01..04` | Cards di sezione | `/formazione#…` | ✅ OK (anchor interni) |
| Training `/formazione` | `anchor-cta` × 5 | Sub-anchor CTAs | `/formazione#…-detail` | ✅ OK (anchor interni) |
| Support `/supporto` | `support-hero-quick-01..04` | Quick links hero | `/supporto#…` | ✅ OK |
| Support `/supporto` | `editorial-card-cta-01..04` | Cards di sezione | `/supporto#…` | ✅ OK |
| Footer (globale) | `footer-link-privacy` | Privacy Policy | `/privacy` | ✅ OK |
| Footer (globale) | `footer-link-cookies` | Cookie Policy | `/cookies` | ✅ OK |
| Footer (globale) | `footer-link-terms` | Termini di Servizio | `/terms` | ✅ OK |

---

## 4 · Legacy paths — scan finale

| Legacy path | Occorrenze public CTAs |
|---|---:|
| `/begin-journey` | **0** ✅ (era 1 → home final_cta_immersive primary) |
| `/professional-access` | **0** ✅ (era 1 → home final_cta_immersive secondary) |
| `/dedicato-a` (in CTA, non nav-link) | **0** ✅ (erano 8: features×2, pricing×6, support, training, login) |

---

## 5 · CMS patch summary

| # | Section ID | Page / Type | Old target | New target |
|---|---|---|---|---|
| 1 | `a03d6736-…` | pricing / page_intro | `cta_href: /dedicato-a` | `cta_href: /studio` |
| 2 | `94e3aebd-…` | pricing / pricing_tiers_editorial | `tier_01..05_href: /dedicato-a` | `tier_01..05_href: /supporto` |
| 3 | `d49ece95-…` | features / feature_hero_split | `cta_href: /dedicato-a` | `cta_href: /studio` |
| 4 | `88e3f6e9-…` | features / page_intro | `cta_href: /dedicato-a` | `cta_href: /studio` |
| 5 | `729d11b3-…` | support / page_intro | `cta_href: /dedicato-a` | `cta_href: /studio` |
| 6 | `dca880a8-…` | training / page_intro | `cta_href: /dedicato-a` | `cta_href: /studio` |
| 7 | `b9e8b80c-…` | login / page_intro | `cta_href: /dedicato-a` | `cta_href: /studio` |
| 8 | `20b8e610-…` | home / final_cta_immersive | `cta_primary_href: /begin-journey`<br>`cta_secondary_href: /professional-access` | `cta_primary_href: /studio`<br>`cta_secondary_href: /accedi` |

**Script:** `/app/backend/scripts/cms_patch_cta_routing.py` (idempotente · single transaction · zero DELETE)

---

## 6 · CTA non-critical da nota (per future micro-iterazioni — non bloccanti)

Sono fuori dallo scope della direttiva ("nessun CTA deve più puntare a /dedicato-a / percorsi legacy"), ma li segnalo per trasparenza:

1. **Home `[hero-cta-primary]` → `#`** — anchor placeholder; il CTA hero Home punta a un anchor non risolto. Visualmente innocuo (no navigation), ma non triggera il funnel. Da valutare in P2 se sostituirlo con `/studio`.
2. **Home `[journey-cta]` → `/about`** — pagina `/about` non risulta nel nav e potrebbe non esistere. Da verificare in P2.
3. **Home `[triptych-*]` → `/magazine`, `/projects`, `/materials`** — sub-feature routes editoriali. Non sono nel lifecycle test ma potrebbero non avere pagine target esistenti. P2.
4. **Home `[journey-cta]` label "Scopri il metodo MOOD for **DEDIGN**™"** — typo: `DEDIGN` invece di `DESIGN`. Da correggere in CMS (block separato, P2 copy fix).

Nessuno di questi punti interferisce con il lifecycle test "Visitor → Studio Request → Advisor → Founder → Blueprint Access".

---

## 7 · Service health (re-check)

| Service | PID | Status |
|---|---:|:---:|
| backend (FastAPI) | 47 | RUNNING ✅ |
| frontend (React) | 2283 | RUNNING ✅ |
| mongodb | 51 | RUNNING ✅ (vedi nota §8) |
| nginx-code-proxy | 45 | RUNNING ✅ |

---

## 8 · Nota MongoDB — perché RUNNING nello stack?

> ### TL;DR: MongoDB è un container **standard Emergent**, **NON è utilizzato come datastore applicativo MOOD**. Tutto il dominio MOOD vive su Supabase PostgreSQL.

### 8.1 Dove è usato realmente

| Modulo | Uso effettivo |
|---|---|
| `/app/backend/server.py` (linee 10, 21–23, 57, 65) | Unico file che importa `motor.motor_asyncio.AsyncIOMotorClient` e si connette a `MONGO_URL`. |
| Endpoint `/api/status` (POST / GET) | Salva/legge una collection `status_checks` (status check generici). **Funzionalità ereditata dal boilerplate FastAPI Emergent.** Non usata da nessun flusso MOOD. |
| Commento in codice (server.py:20) | _"MongoDB connection (temporary — Supabase-ready adapter in db/adapter.py)"_ — dichiarazione esplicita di transitorietà. |

### 8.2 Dove **NON** è usato

Il dominio MOOD vive **interamente su Supabase PostgreSQL** (chiave `SESSION_POOLER_URL` / `DATABASE_URL` in `backend/.env`):

- `editorial_blocks` + `editorial_block_translations` — CMS dinamico (Postgres)
- `cms_pages` + `cms_sections` — Struttura pagine (Postgres)
- `platform_languages` — Locale architecture BCP-47 (Postgres)
- `users` / `studio_requests` / `studio_relations` — Lifecycle tenants (Postgres · attualmente wiped da P0)
- `media_library` + variants — Assets (Postgres + Supabase Storage)
- `tenants`, `advisors`, `crm_*` — Modello operativo (Postgres)

### 8.3 Perché allora `mongodb` è RUNNING?

Il container Emergent ha un supervisor pre-configurato che avvia automaticamente MongoDB:

```ini
[program:mongodb]
command=/usr/bin/mongod --bind_ip_all
autostart=true
autorestart=true
```

Questo è il **default di tutti gli ambienti Emergent K8s** — destinato ad app full-stack che usano MongoDB come datastore primario. Nel caso di MOOD, abbiamo optato per Supabase PostgreSQL fin dall'inizio per esigenze SQL relazionali (CMS, lifecycle multi-tenant, RLS, locale joins, ecc.), ma il container MongoDB resta acceso a costo zero come container "standby" dell'ambiente.

### 8.4 Risposta strutturata

> - **È utilizzato realmente?**
>   ❌ No, **non dal dominio MOOD**. Viene toccato solo dagli endpoint demo `/api/status` GET/POST, che sono boilerplate Emergent FastAPI residuo e non collegati ad alcun flusso di business MOOD.
>
> - **Quale modulo lo utilizza?**
>   Solo `/app/backend/server.py` (4 righe attive: import, client init, insert_one, find).
>
> - **È solo un container standard dell'ambiente Emergent?**
>   ✅ Sì. È avviato automaticamente dalla configurazione supervisor di default dell'immagine Emergent. **Non porta alcun dato MOOD.** Se vuoi, può essere disabilitato in `/etc/supervisor/conf.d/*.conf` impostando `autostart=false`, ma non è richiesto: occupa solo memoria residua ed è isolato.

> **Nessuna modifica architetturale richiesta**, come da tua direttiva. Nota documentale completa.

---

## 9 · Authorization gate

Il sistema è in stato **READY for full lifecycle test**:

- ✅ Vetrina pubblica deployata in Preview
- ✅ Zero termini proibiti nel CMS (`ZERO_OCCURRENCES_REPORT.md`)
- ✅ Locale Switcher dinamico funzionale (it-IT ↔ en-US, BCP-47, RTL-ready)
- ✅ Tutti i CTA del funnel di attivazione e del dialogo Advisor correttamente routati
- ✅ Zero CTA su percorsi legacy

Puoi procedere con il test manuale:

```
Visitor
  → Studio Request (via /studio dopo qualsiasi CTA "Candida il tuo studio" / "Attiva Blueprint™")
  → Advisor Assignment
  → Review
  → Founder Invitation
  → Magic Link
  → Founder Access
```

> ⚠️ **Reminder caveat P0:** le tabelle operative (`users`, `studio_requests`, `studio_relations`) sono ancora vuote per via dell'incidente DB in attesa di risoluzione log Supabase. Quando ti registri come Visitor, verifica con calma — se i dati non vengono persistiti, il P0 RCA resta il prossimo blocker.

---

*— fine report —*
