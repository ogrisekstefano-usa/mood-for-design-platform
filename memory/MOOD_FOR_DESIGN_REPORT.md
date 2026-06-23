# MOOD FOR DESIGN — Report tecnico-prodotto
**Cosa è MOOD for DESIGN e come il sito principale genera tenant**
*23 giugno 2026*

---

## PARTE A · Cosa è MOOD for DESIGN

### A.1 · La definizione canonica

**MOOD for DESIGN** è un **ecosistema editoriale per la conduzione del progetto di design contemporaneo**, pensato per studi di interior design, architetti, showroom di alta gamma, retailer del mobile, brand e organizzazioni multi-sede operanti tra Stati Uniti ed Europa.

Tecnicamente è una **piattaforma B2B multi-tenant in SaaS verticale**, ma il suo posizionamento di mercato la racconta come **una nuova categoria di prodotto**: il primo *editorial operating system* del settore design — non un CRM, non un PM tool, non un moodboard tool, non un material database.

### A.2 · I due pilastri di marca

| Pilastro | Cosa è | Cosa NON è |
|---|---|---|
| **Design Journey™** | La **metodologia** in 7 fasi (Discovery · Definition · Inspiration · Material Exploration · Shared Decisions · Presentation · Continuity) con cui MOOD ritiene si debba condurre un progetto | Un workflow, un kanban, un funnel commerciale |
| **Blueprint™** | L'**infrastruttura editoriale** dove il Journey™ vive: un workspace configurato per ogni singolo studio | Un'app, un software, un piano in abbonamento |

Il glossario interno è esplicito: si usano *infrastruttura editoriale · configurazione · workspace · metodologia · ecosistema*. Sono **proibite** le parole *piattaforma · software · tool · feature · plan · trial · subscription · user* su tutto il front-of-house.

### A.3 · Architettura applicativa (in sintesi)

| Layer | Stack | Note |
|---|---|---|
| **Backend** | FastAPI (Python) + SQLAlchemy + PostgreSQL (Supabase) | API REST esposte sotto `/api/*`, multi-tenant con isolamento a livello applicativo e database |
| **Frontend** | React + Tailwind + shadcn/ui · multilingue via `LocaleContext` con 7 locali pubblici (it-IT, en-US, en-GB, fr-FR, de-DE, es-ES, es-MX) | CMS-driven su praticamente ogni stringa |
| **CMS** | Sistema proprietario "Blueprint OS" con: `cms_pages` · `cms_sections` (JSONB `locale_content` + `settings`) · `editorial_blocks` (+ tabella `editorial_block_translations`) | Editor visivo accessibile da `/blueprint/*` per admin |
| **Auth** | Magic-link only per founder neo-attivati (no password) · JWT admin · ruoli `owner` · `admin` · `staff` | Vedi `access_continuity` service |
| **Integrations** | Mapbox (city autocomplete · target countries), Resend (transactional email), Stripe test mode, OpenAI Whisper (voice-to-text per CRM) | Via Emergent LLM Key per AI assistive layer |
| **Deploy** | Preview Kubernetes (cluster Emergent) · Produzione su `https://moodfordesign.com` | Hot reload in preview, deploy manuale in produzione |

### A.4 · Modello B2B multi-tenant

Ogni cliente è un **tenant** isolato sul DB, con:
- `tenants` row (slug, nome, lingue attive, moduli abilitati, branding/theme settings, status, plan)
- `users` collegati al tenant (founder + collaboratori)
- `tenant_modules` (lista dei moduli attivati: studio · interior · showroom · brand)
- Dati operativi tenant-scoped: progetti, materiali, contatti, attività CRM, presentazioni
- Moduli CMS pubblici sono **shared** tra tenant (le pagine pubbliche del sito sono multi-tenant ma servono il tenant `studio` come "vetrina")

Il **tenant pubblico** (`slug='studio'`) è quello che alimenta tutto il sito vetrina `moodfordesign.com`. I tenant cliente vivono ciascuno con il proprio Blueprint™ configurato dopo l'attivazione.

### A.5 · Il modello commerciale

- **Niente listino pubblico, niente carrello, niente self-signup attivo.** Ogni configurazione Blueprint™ è proposta dopo una **conversazione iniziale** advisor-cliente di 30-45 minuti.
- **Niente trial gratuito.** La prima conversazione è il filtro reciproco di compatibilità.
- Modello assimilabile al **consultative SaaS premium** (più vicino a Salesforce Sales Cloud Enterprise o a un setup ad alto contatto come Notion for Enterprise che a un PLG self-serve).

---

## PARTE B · Come il sito genera tenant (flusso end-to-end)

### B.1 · La rotta cardine: `/studio`

Il **funnel di acquisizione** vive a `/studio` (alias `/start-studio` · `/start-project` su altre lingue). Il componente è **`StudioFunnelV2`** (`frontend/src/corporate/pages/studio_v2/StudioFunnelV2.jsx`), una **multi-step form a 5 step**.

| Step | File | Cosa raccoglie |
|---|---|---|
| **Step 1 — Archetype** | `Step1Archetype.jsx` | Tipo di realtà che il visitatore rappresenta (interior · architetto · showroom · brand · organizzazione multi-sede) → `archetype_code` |
| **Step 2 — Location** | `Step2Location.jsx` | Mercato operativo primario + paese HQ (ISO2) + città + coordinate Mapbox + mercati aggiuntivi target |
| **Step 3 — Contact** | `Step3Contact.jsx` | Nome studio · nome+cognome contatto · email contatto · prefisso telefonico internazionale + numero |
| **Step 4 — Help** | `Step4Help.jsx` | "Cosa cerca lo studio?" (multiselect di `help_topics`, mappabili a esperienze v1) + testo libero opzionale |
| **Step 5 — Received** | `Step5Received.jsx` | Schermata di conferma. Reset del draft. Email di ricevuta inviata. |

Tutti i 5 step sono **CMS-driven** via il manifest `/api/studio/v2/manifest?locale=...`: copy, label, opzioni dropdown, validation messages vengono dal DB.

### B.2 · Il draft persistente

L'utente può **interrompere e riprendere** il funnel:
- Al primo click di "Inizia" viene creato un `studio_requests` row con `status='draft'` + `draft_token` salvato in `localStorage`
- Ogni step chiama `POST /api/studio/v2/draft` per persistere lo stato parziale
- Il token sblocca la ripresa del flusso quando il visitatore torna al sito
- L'email viene anche pre-validata via `GET /api/studio/v2/check-email` (controlla unicità su `studio_requests` e `users`)

### B.3 · La submission

L'invio finale chiama `POST /api/studio/v2/submit` con il payload completo. Il servizio (`backend/services/studio_v2.py::submit_v2`) esegue:

1. **Validazione archetype** → mappatura a archetipo v1 (legacy)
2. **Validazione help_topics** → mappatura a `experiences` v1
3. **Risoluzione mercato operativo** → lookup `markets.code` → `markets.id`
4. **Patch finale del draft** con tutti i campi v2 (geo, archetype, help topics, target countries)
5. **Chiamata a `studio_activation.submit_request`** che cambia lo status del `studio_requests` da `draft` a `submitted`
6. **Inserimento dei link many-to-many**:
   - `studio_request_help_areas` (1:N con i help_topics scelti)
   - `studio_request_target_countries` (1:N con i Paesi target ISO2)
7. **Email di ricevuta** al contatto (transactional via Resend, template CMS-driven)
8. **Notifica interna** agli advisor MOOD

A questo punto **NON esiste ancora un tenant**. Esiste un `studio_request` in pipeline, in attesa di valutazione umana.

### B.4 · Il sistema di "studio relations" (la pipeline advisor)

Tra la submission e l'attivazione del tenant si frappone un **CRM interno proprietario** (`/blueprint/relationships`) — la cosiddetta **Relationship Center** o M6:

- Ogni `studio_request` diventa una `studio_relation` con stato (`new → qualified → discovery → proposal → activated`)
- Ogni relation ha: contatto · archetype · esperienze · mercati · advisor assegnato · attività (chiamate, note, voice memo via Whisper) · timeline · documenti
- Advisor MOOD entrano qui per: qualificare, contattare, condurre la discovery call, costruire la proposta di configurazione

Solo dopo che l'advisor approva l'attivazione, parte la **creazione del tenant**.

### B.5 · L'attivazione del tenant (creazione vera e propria)

La funzione cardine è in `backend/services/studio_relations.py::activate_relation` (~riga 615 in poi). In una sola transazione:

```
INSERT INTO tenants  (slug, name, status='active', default_language, default_locale_code,
                      active_languages, enabled_modules JSONB,
                      branding_settings JSONB, theme_settings JSONB,
                      plan_assigned_at=NOW(), subscription_status='active',
                      active_plan='studio') RETURNING id
```

Lo **slug** viene derivato dal nome dello studio con disambiguazione progressiva (`mariorossi-studio`, `mariorossi-studio-2`, …). Il **branding_settings JSONB** include: monogram, archetype, country, website, city — usato per popolare l'admin UI del tenant subito dopo il login.

In cascata vengono inserite:

```
INSERT INTO tenant_modules (tenant_id, module_key, state='active')
   per ogni esperienza scelta (studio · interior · showroom · brand)

INSERT INTO users (tenant_id, email, role='owner', is_active=true,
                   password_hash='!magic-link-only')
   per il founder
```

Successivamente:

- La `studio_relation` passa a `status='activated'`, e la `studio_request` collegata pure
- Si emette un **magic-link** via `services.access_continuity.issue_magic_link` con TTL configurabile (default 30 giorni per inviti founder)
- Si invia l'**email di attivazione** (`studio_request_approved`) con il magic-link come CTA target — il template è CMS-driven (`email_templates`)
- Viene loggato l'evento di attivazione nell'audit trail (`_log_event`)

Il founder riceve la mail, clicca il magic-link, e atterra direttamente nel proprio Blueprint™ configurato — autenticato come `owner` del nuovo tenant. **Mai una password** in questo flusso: solo magic-link.

### B.6 · Schema DB del flusso (vista d'insieme)

```
studio_requests
  ↓ (status: draft → submitted)
  ↓ (manual qualification by advisor)
studio_relations
  ↓ (status: new → qualified → discovery → proposal → activated)
  ↓ (activate_relation atomic transaction)
tenants ──────── tenant_modules
   │                 │
   ↓                 ↓
users (role=owner)   modules enabled
   │
   ↓
magic-link sent via email
   │
   ↓
founder logs in → /blueprint/* admin del nuovo tenant
```

### B.7 · Strutture dati ausiliarie del funnel

| Tabella | Scopo |
|---|---|
| `studio_archetypes_v2` | Tassonomia dei 5 archetipi (interior, architect, showroom, brand, multi-site) con mappatura a v1 |
| `studio_help_topics` | Tassonomia delle aree di aiuto (multiselect dello Step 4), mappabili a `experiences` v1 |
| `studio_request_help_areas` | Many-to-many request ↔ help_topic |
| `studio_request_target_countries` | Many-to-many request ↔ paese target con priority |
| `markets` | Anagrafica mercati operativi (codici ISO regionali) |
| `platform_languages` | 7 locali pubblici (it-IT default, en-US, en-GB, fr-FR, de-DE, es-ES, es-MX) |
| `email_templates` + `email_template_translations` | Tutti i template transazionali (ricevuta, attivazione, magic-link) sono CMS-driven multilingue |
| `editorial_blocks` + `editorial_block_translations` | Copy del funnel multilingue (5 step, label, button, validation) |

### B.8 · Sicurezza e isolamento

- Ogni endpoint admin riceve `tenant_id` dal JWT e usa **strict tenant scoping** in ogni query (`WHERE tenant_id = :tid`)
- I CSRF / brute-force / rate-limit endpoint sono attivi sul login e sul reset password
- Le sessioni sono token-based (JWT) con expiry sliding
- Il magic-link è single-use con TTL configurabile e nonce anti-replay
- Media library: ogni asset è tenant-isolated tramite `tenant_id` esplicito (audit dedicato risolto da una settimana)

### B.9 · Strumenti di osservabilità del funnel

L'admin (`/blueprint/relationships`) espone:

- **Pipeline view**: tutte le studio_relations per stato, ordinate cronologicamente
- **Detail view**: timeline cronologica delle attività · note vocali Whisper-trascritte · email inviate · meta-dati di richiesta
- **Email Console** (`/blueprint/emails` via `tenant_activation.py`): tutte le email transazionali con stato di delivery
- **Activation pipeline** (`/api/admin/tenant-activation/pipeline`): visione di tutte le attivazioni in corso, retry delle email fallite, recovery di magic-link spirati

### B.10 · Cosa il sito NON fa (volutamente)

- ❌ Nessun signup self-service
- ❌ Nessun "Start free trial" / "Try it now"
- ❌ Nessuna creazione automatica di tenant senza approvazione advisor
- ❌ Nessun pagamento online via pagina pricing (Stripe è integrato ma usato in setup interno post-attivazione)
- ❌ Nessuna pagina di "compare plans" con bottone "Sign up"

**Il sito è una vetrina editoriale + un filtro consultivo**, non un funnel di e-commerce.

---

## PARTE C · Sintesi del flusso end-to-end

1. **Visitatore arriva** sul sito (`https://moodfordesign.com`) da search, referral, network del founder
2. **Legge il manifesto editoriale** (Home, Audience, Features, Pricing, Academy, FAQ, futuro Design Journey™)
3. **Clicca un primary CTA** *"Richiedi una configurazione Blueprint™"* → `/studio`
4. **Compila il funnel 5-step** con persistenza draft + ripresa
5. **Submit** → riceve email di ricevuta + viene creata `studio_request`
6. **Advisor MOOD valuta** in `/blueprint/relationships` (CRM interno)
7. **Discovery call** (manuale, fuori sistema)
8. **Proposta di configurazione** preparata dall'advisor
9. **Approvazione** → `activate_relation` esegue la transazione atomica:
   - Crea `tenants` row
   - Crea `tenant_modules`
   - Crea `users` (role=owner)
   - Emette magic-link
   - Invia email di attivazione
10. **Founder clicca il link** → atterra nel proprio Blueprint™ configurato
11. **Inizia ad usare l'infrastruttura** (CRM editoriale · Material Intelligence · Design Journey · Project Memory · Academy)

Tempo medio dichiarato: **2 settimane** dalla submission alla configurazione operativa.

---

## RIASSUNTO IN UNA RIGA

> *MOOD for DESIGN è un B2B multi-tenant SaaS posizionato come "editorial operating system" per il settore design, in cui il sito vetrina genera tenant attraverso un funnel a 5 step (`/studio`) che produce una `studio_request`, qualificata umanamente da advisor interni nel CRM proprietario, attivata via transazione atomica `activate_relation` che crea `tenants + users + modules + magic-link`, senza self-signup né trial automatico.*

---

*Report tecnico-prodotto · MOOD for DESIGN · 23 giugno 2026*
*Generato leggendo: `backend/routers/studio_v2.py`, `backend/services/studio_v2.py`, `backend/services/studio_relations.py`, `frontend/src/corporate/pages/studio_v2/`, schema DB live.*
