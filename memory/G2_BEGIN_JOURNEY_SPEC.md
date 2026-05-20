# Sprint G.2 — "Inizia il tuo Design Journey™" Spec
**Date**: 21 Feb 2026 · iter102  
**Type**: Welcome ritual · public-facing curatorial onboarding · NOT a lead form.  
**Architecture lock ref**: `/app/memory/JOURNEY_ALIGNMENT_AUDIT.md` · `/app/memory/G1_SEMANTIC_ARCHITECTURE_LOCK.md`

> Questo NON è un "lead form redesign".  
> È il **rituale di accoglienza** del Design Journey OS™.  
> Modello: showroom high-end + hospitality + atelier progettuale + welcome ritual.

---

## 1 · UX flow (3 step + welcome)

```
   ┌────────────────────────┐
   │   /begin-journey        │
   │                          │
   │   STEP 1 · Atmosfera     │
   │   (atmosfera che cerchi  │
   │    + riferimenti liberi) │
   └───────────┬──────────────┘
               ▼
   ┌────────────────────────┐
   │   STEP 2 · Lifestyle     │
   │   (come vivi gli spazi · │
   │    materia · ricevi      │
   │    ospiti?)              │
   └───────────┬──────────────┘
               ▼
   ┌────────────────────────┐
   │   STEP 3 · Welcome       │
   │   (solo: nome · email ·  │
   │    telefono opzionale)   │
   └───────────┬──────────────┘
               ▼
        ┌───────────────┐
        │   POST /api/   │
        │   public/      │
        │   journeys/    │
        │   initiate     │
        └───────┬────────┘
                ▼
   ┌──────────────────────────┐
   │ /journey/welcome/:token   │
   │                            │
   │ "Il tuo Design Journey™    │
   │  è iniziato."              │
   │                            │
   │ + atmosphere reflected     │
   │ + Brief chapter visibile   │
   │ + invito a "ricevere       │
   │   notizie" (no funnel)     │
   └──────────────────────────┘
```

---

## 2 · Copywriting (Italian editorial — locked)

### Home CTA principale
- Privato → **"Inizia il tuo Design Journey™"** (CTA primary)
- Professionista → "Lavora insieme a noi" (resta come è ora)

### Step 1 · Atmosfera
- **Eyebrow**: `PASSO PRIMO · ATMOSFERA`
- **Title**: `Quale atmosfera stai cercando?` *(italic Playfair)*
- **Subtitle**: `Inizia a raccontarci lo spazio che immagini — senza fretta.`
- **Fields**:
  1. `Quale spazio immagini?` (chip select: Casa · Showroom · Hospitality · Ufficio · Altro — multipla)
  2. `Come vuoi sentirti in questo spazio?` (textarea free, placeholder: `Una sensazione, un momento del giorno, un ricordo…`)
  3. `Hai riferimenti che ami?` (textarea free, placeholder: `Una città, un film, un materiale, un ricordo, un'immagine…`)
- **CTA**: `Continua il racconto →`
- **Skip**: nessuno step può essere obbligatorio tranne il consenso finale.

### Step 2 · Lifestyle
- **Eyebrow**: `PASSO SECONDO · COME VIVI`
- **Title**: `Come vivi gli spazi?` *(italic Playfair)*
- **Subtitle**: `Aiutaci a comprendere il tuo modo di abitare, non il tuo budget.`
- **Fields**:
  1. `Ricevi ospiti spesso?` (toggle chips: Sì, spesso · Qualche volta · Raramente · Vivo solo)
  2. `Quali materiali ti fanno stare bene?` (multi-chip: Legno · Pietra · Tessuti naturali · Metalli caldi · Vetro · Velluto · Marmo · Lino · Altro)
  3. `Preferisci ambienti…` (radio chips: Caldi e avvolgenti · Sobri e minimali · Luminosi e arieggiati · Materici e sensoriali · Cinematici)
- **CTA**: `Avvicinati al tuo Journey →`

### Step 3 · Welcome
- **Eyebrow**: `PASSO ULTIMO · ENTRIAMO IN CONTATTO`
- **Title**: `Da dove cominciamo?` *(italic Playfair)*
- **Subtitle**: `Tre dettagli soltanto — il resto nascerà dalla conversazione.`
- **Fields**:
  1. `Come ti chiamiamo?` (input · required)
  2. `Una mail per scriverti` (input email · required)
  3. `Un numero se preferisci sentirti` (input tel · optional, no marketing copy)
- **CTA**: **`Inizia il tuo Design Journey™`** (warm amber, large)
- **Microcopy**: `Nessun preventivo, nessuna pressione. Solo una conversazione.`

### Welcome state (post-submit)
- **Eyebrow**: `IL TUO DESIGN JOURNEY™ · È INIZIATO`
- **Title**: `Benvenuto/a, {first_name}.` *(italic Playfair, 56px hero)*
- **Subtitle**: `Questo è il tuo Design Journey™. Tutto ciò che condivideremo da ora vivrà qui — capitoli, atmosfere, conversazioni.`
- **Reflected atmosphere card**: mostra le risposte date — "L'atmosfera che cerchi" · "Il modo in cui abiti"
- **Brief chapter visible**: `Capitolo primo · Brief Cliente — in apertura.`
- **CTA secondaria**: `Salva questo link · ti scriveremo presto.` (con possibilità di copiare l'URL).
- **NO**: dashboard, NO "log in to continue", NO "thank you for your interest".

---

## 3 · Backend flow

### Endpoint
`POST /api/public/journeys/initiate` (no auth, rate-limited eventually).

### Payload
```json
{
  "tenant_slug": "mood-demo-studio-81a09e",   // optional, default = platform tenant
  "atmosphere": {
    "space_kinds": ["home"],                   // optional array
    "how_to_feel": "Voglio sentirmi accolta e silenziosa.",
    "references": "Stanze monastiche, Tadao Ando, una sera d'autunno."
  },
  "lifestyle": {
    "guests": "qualche_volta",
    "materials": ["legno","pietra","lino"],
    "ambiance": "caldi_avvolgenti"
  },
  "welcome": {
    "first_name": "Maria",
    "email": "maria@example.com",
    "phone": null
  }
}
```

### Created entities (atomic transaction)
1. **Account** — `account_name=first_name`, `account_type='private_client'`, `lifecycle_stage='conversation_open'`, `email=email`, `source='begin_journey_ritual'`.
2. **Contact** — linked to Account, primary contact, first_name/email/phone.
3. **Project** — minimal: `title='Conversazione di {first_name}'`, `status='inquiry'`, `metadata_json={journey_origin: 'begin_journey_ritual', atmosphere, lifestyle}`.
4. **Design Journey** — `project_id=new`, `account_id=new`, `lifecycle_state='conversation_open'`, `overall_status='in_progress'`, `welcome_token=<urlsafe-32-bytes>`.
5. **10 default milestones** (via `_ensure_journey` helper) — Brief auto-started.
6. **First Milestone Version** on Brief — `chapter_kind='initial_direction'`, `title='Direzione iniziale'`, `rationale=` composed from atmosphere/lifestyle (italian editorial paragraph).
7. **Timeline events**:
   - `event_canon='journey_created'`, narrative: `"Il Design Journey™ di {first_name} ha avuto inizio. Una conversazione apre il viaggio."`
   - `event_canon='brief_started'`, narrative: `"Brief Cliente — in apertura. {first_name} racconta la sua atmosfera."`

### Response
```json
{
  "journey_id": "uuid...",
  "welcome_token": "abc12...",
  "welcome_url": "/journey/welcome/abc12..."
}
```

### Public read endpoint
`GET /api/public/journeys/welcome/{token}` — returns public-safe payload:
```json
{
  "first_name": "Maria",
  "atmosphere": {...},
  "lifestyle": {...},
  "journey": {
    "id": "...",
    "lifecycle_state": "conversation_open",
    "first_chapter": {
      "kind_label": "Direzione iniziale",
      "rationale": "...",
      "created_at": "..."
    },
    "milestones_count": 10,
    "current_milestone": "Brief Cliente"
  },
  "studio_name": "MOOD Demo Studio"
}
```

---

## 4 · Schema change (Migration 064)

Single column add:
```sql
ALTER TABLE design_journeys
  ADD COLUMN IF NOT EXISTS welcome_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS design_journeys_welcome_token_idx
  ON design_journeys (welcome_token) WHERE welcome_token IS NOT NULL;
```

Soft index — token is nullable. Compatible con G.1.

---

## 5 · Responsive / States

### Responsive breakpoints
- ≥1100px: full editorial layout (left rail "passo 1 di 3" + right form)
- 760-1100px: single column, generous spacing
- <760px: stacked, larger touch targets, no left rail

### Empty state (no answers given)
- Step CTA disabled with subtle copy: `Lasciaci almeno un'impressione`.

### Transitional state (between steps)
- Cinematic fade 480ms cubic-bezier. Eyebrow text rotates. NO loading spinners.

### Submission state
- Button copy → `Sto aprendo il tuo Journey…`
- Full-screen overlay with italic Playfair: `Stiamo preparando il tuo Design Journey…`

### Error state
- Toast italiano: `Non sono riuscito a iniziare il tuo Journey. Riprova fra un istante.`

---

## 6 · Mapping Journey creation (G.1 compliance)

| G.1 entity | G.2 sets |
|---|---|
| `accounts.lifecycle_stage` | `'conversation_open'` |
| `accounts.source` | `'begin_journey_ritual'` |
| `design_journeys.lifecycle_state` | `'conversation_open'` (NEW canonical state from G.1) |
| `design_journeys.account_id` | populated |
| `design_journeys.welcome_token` | URL-safe 32-byte token |
| `journey_milestones` (Brief) | auto-started |
| `milestone_versions` (initial_direction) | rationale composed in italiano |
| `journey_timeline_events` (2 events) | event_canon = journey_created + brief_started |

---

## 7 · Files delivered

```
/app/supabase/migrations/064_journey_welcome_token.sql       (NEW)
/app/backend/scripts/apply_migration_064.py                  (NEW)
/app/backend/routers/journey_initiate.py                     (NEW)
/app/backend/server.py                                       (mount router)
/app/frontend/src/pages/site/BeginJourneyPage.jsx            (NEW · ~360 lines)
/app/frontend/src/pages/site/JourneyWelcomePage.jsx          (NEW · ~150 lines)
/app/frontend/src/styles/begin-journey.css                   (NEW · ~280 lines)
/app/frontend/src/App.js                                     (routes)
/app/frontend/src/pages/site/HomePage.jsx                    (CTA → /begin-journey)
/app/backend/tests/test_iteration_102_begin_journey.py       (NEW · 10 tests)
```

---

## 8 · Editorial lexicon guard (delta from F.B)

**MUST appear** in the new surfaces:
- "Inizia il tuo Design Journey™"
- "Atmosfera", "Lifestyle", "Come vivi", "Riferimenti che ami"
- "Direzione iniziale", "Capitolo primo · Brief Cliente"
- "Il tuo Design Journey™ è iniziato"

**MUST NOT appear** in the new surfaces (additions to F.B guard):
- "budget", "preventivo", "quote", "estimate", "pricing"
- "timing", "deadline", "ASAP", "urgenza"
- "lead", "funnel", "pipeline"
- "richiesta progetto", "consulenza gratuita", "demo gratuita"
- "Get a quote", "Get started for free", "Sign up", "Request a demo"
- Standard SaaS wizard tropes: "Step 1 of 3", "Progress bar percentage"

---

## 9 · Test plan (10 cases)

### Backend (6)
1. POST /initiate with full payload → 200, creates Account+Contact+Project+Journey, returns welcome_url.
2. POST /initiate without atmosphere/lifestyle (minimal welcome only) → 200, Brief still created.
3. POST /initiate rejects payload without email or first_name → 400.
4. GET /welcome/{valid_token} → 200 with public-safe shape.
5. GET /welcome/{invalid_token} → 404.
6. Created Journey has lifecycle_state='conversation_open' + event_canon='journey_created' + first Milestone Version.

### Frontend (4 — static + smoke)
7. BeginJourneyPage.jsx renders 3 step labels in IT.
8. JourneyWelcomePage.jsx renders welcome copy "Il tuo Design Journey™ è iniziato".
9. App.js mounts /begin-journey and /journey/welcome/:token routes.
10. NO forbidden lexicon in either page (budget / preventivo / lead / funnel).

---

## 10 · NOT in scope for G.2

- Cron / automation (silence_alert / drift_warning)
- AI nurturing / smart suggestions
- Magic-link auth claim flow
- Email notification to studio about new Journey
- Welcome page is read-only — no edit, no claim-account button
- LeadFormPage rewrite (resta legacy per `/form/:slug` tenant-specific)
- StartProjectWizard rewrite (resta legacy, deprecato)

🔒 **End of G.2 spec.** Pronto per implementazione.
