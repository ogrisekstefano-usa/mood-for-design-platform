# STUDIO ACTIVATION FLOW V2 — IMPLEMENTATION PLAN

> **Data**: 2026-06-01
> **Scope**: SOLO il funnel pubblico visitor → submit. NON tocca Tenant
> Lifecycle, Advisor Workflow, Founder Invitation, Magic Link, Tenant
> Creation, Tenant Activation Console.
> **Stato**: ❗ ATTESA DI APPROVAZIONE. Nessun codice scritto fino a OK.

---

## 1. AUDIT DEL FLOW V1 ATTUALE

### 1.1 Route e componenti

| Route | Componente | Loc | Ruolo |
|---|---|---|---|
| `/studio` | `MovementEntrance.jsx` | 232 | Hero full-bleed + CTA |
| `/studio/practice` | `MovementPractice.jsx` | 434 | Scelta archetype (6 tile fotografiche) |
| `/studio/ecosystem` | `MovementEcosystem.jsx` | 292 | Multi-select Experiences (5 bande) |
| `/studio/identity` | `MovementIdentity.jsx` | 608 | Form lungo (studio + contatti + lingue + mercati + temperament) |
| `/studio/request` | `MovementRequest.jsx` | 173 | Receipt page con reference |
| layout | `StudioActivationLayout.jsx` | 142 | Chrome editoriale condiviso |
| hook | `useActivationDraft.js` | ~150 | Draft API client |
| hook | `useStudioManifest.js` | ~80 | Manifest API client |
| legacy | `StartStudioPage.jsx` | 209 | Vecchio one-pager (redirect → `/studio`) |

**Totale**: ~2.085 righe React + 209 legacy → da rivedere.

### 1.2 Backend in uso

| File | Funzione |
|---|---|
| `routers/studio_activation.py` | `/manifest`, `/draft` POST/PATCH, `/submit` |
| `services/studio_activation.py` | `manifest()`, `get_or_create_draft()`, `patch_draft()`, `submit_request()` |
| `services/site_resolver.py` | Resolve copy keys CMS per locale |

### 1.3 Violazioni della direttiva NO HARDCODED

#### 🔴 Frontend (`MovementIdentity.jsx:18-23`)
```js
const LANGUAGES = ['it', 'en-us', 'fr', 'de', 'es'];
const MARKETS = ['private_residential', 'hospitality', 'cultural', 'yacht',
                 'aviation', 'retail', 'office', 'showroom', 'restaurant'];
const TEMPERAMENTS = ['quiet', 'composed', 'vivid'];
```

#### 🔴 Backend (`services/studio_activation.py:184-263`)
- **6 archetipi** hardcoded nella funzione `manifest()` (interior_studio, luxury_showroom, architecture_firm, material_gallery, design_retail, stone_specialist)
- **5 Experiences** hardcoded (design_journey_os, material_intelligence, moodboard_experience, showroom_continuity, client_presentation_flow)
- `ARCHETYPE_TO_SUGGESTED` dict hardcoded (mapping archetype → suggested experiences)
- **Immagini Unsplash** hardcoded (URL CDN diretti)

### 1.4 Violazioni della linea editoriale (linguaggio aulico)

| Riferimento | Esempio |
|---|---|
| `MovementEntrance.jsx` | "ENTRANCE", "Compose your Studio.", "An editorial sequence in six movements" |
| `MovementPractice.jsx` | "Movement II", "studio practice... composing from", "cinematic tiles" |
| `MovementEcosystem.jsx` | "Five Experiences as horizontal editorial bands", "—inclusa nella tua composizione" |
| `MovementIdentity.jsx` | "Movement IV — Identity", "temperament: quiet/composed/vivid", "monogram" |
| `MovementRequest.jsx` | "NOT an 'activation complete' — a calm reception" |

Tutto questo viola le regole esplicite: linguaggio aulico, terminologia
autoreferenziale (Practice, Ecosystem, Temperament, Monogram, Movement),
frasi da manifesto.

### 1.5 Altri problemi UX rilevati

- **Fotografie** sugli archetipi non possono rappresentare correttamente
  studi di scala diversa (es. Gensler vs freelance).
- **5 schermate** per un B2B lead form è troppo: V2 mira a **4 schermate
  + 1 receipt = 5 totali** ma con friction radicalmente minore.
- Email check globale **NON implementato** — V1 verifica solo
  duplicati su `studio_requests`.
- **Mapbox** non integrato (controllato: nessuna referenza nel codice).

---

## 2. STRUTTURA V2 — MAPPA SCHERMATA-PER-SCHERMATA

### Step 1 — `/studio` · CHI SEI?

```
┌──────────────────────────────────────────────────────────┐
│  MOOD for DESIGN          ← logo discreto top-left       │
│                                                          │
│                                                          │
│       Parlaci del tuo studio.                            │
│       (h1, sans modern, ~48px, allineato sinistra)       │
│                                                          │
│       Una scelta singola.                                │
│       (sublead, 16px, opacity 0.7)                       │
│                                                          │
│   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐           │
│   │ icona  │ │ icona  │ │ icona  │ │ icona  │           │
│   │ Interior│ │Architect│ │Showroom│ │Retailer│           │
│   └────────┘ └────────┘ └────────┘ └────────┘           │
│   ┌────────┐ ┌────────┐ ┌────────┐                       │
│   │ icona  │ │ icona  │ │ icona  │                       │
│   │ D&Build │ │ Brand  │ │ Altro  │                       │
│   └────────┘ └────────┘ └────────┘                       │
│                                                          │
│                              [ Continua → ]              │
└──────────────────────────────────────────────────────────┘
```

- **Opzioni DB-driven** da nuova tabella `studio_archetypes_v2` (vedi §4).
- **Icone** Lucid-react o SVG astratte (no fotografie).
- **Linguaggio** professionale: nessun riferimento a Practice/Archetype.
- **Footer** discreto: link "Resume your application" se draft esistente.

### Step 2 — `/studio/location` · DOVE OPERI?

```
┌──────────────────────────────────────────────────────────┐
│  ← indietro                                              │
│                                                          │
│       Dove lavora principalmente il tuo studio?          │
│                                                          │
│       PAESE                                              │
│       [ Italia                              ▾ ]          │
│       (Select DB-driven da `markets`)                    │
│                                                          │
│       CITTÀ                                              │
│       [ Milano                                  ]        │
│       (Mapbox Autocomplete — placeholder)                │
│                                                          │
│       Operiamo anche in altri mercati (opzionale)        │
│       ☐ Francia  ☐ Germania  ☐ Spagna  ...               │
│                                                          │
│                              [ Continua → ]              │
└──────────────────────────────────────────────────────────┘
```

- **Paese**: dropdown da `markets.code` (NO testo libero). Default
  pre-popolato dal Market Selector globale (footer).
- **Città**: Mapbox Places API autocomplete (richiede Mapbox token).
- **Mercati addizionali**: multi-select sempre da `markets`.

### Step 3 — `/studio/contact` · CHI È IL REFERENTE?

```
┌──────────────────────────────────────────────────────────┐
│  ← indietro                                              │
│                                                          │
│       Chi sarà il referente principale?                  │
│                                                          │
│       NOME             COGNOME                           │
│       [           ]    [           ]                     │
│                                                          │
│       EMAIL                                              │
│       [ founder@studio.com               ]               │
│       ↑ verifica globale on-blur                         │
│                                                          │
│       TELEFONO                                           │
│       [ +39 ▾ ] [ 333 1234567                ]           │
│       (prefix DB-driven da markets.dial_code)            │
│                                                          │
│                              [ Continua → ]              │
└──────────────────────────────────────────────────────────┘
```

- **Email globale**: nuovo endpoint `GET /api/studio/v2/check-email?email=...`
  che cerca in `users`, `advisor_profiles`, `studio_requests`. Risposta
  immediata `{available, reason}`. Vedi §5.
- **Telefono prefix**: dropdown DB-driven (richiede colonna
  `markets.dial_code` — già presente? Da verificare in fase audit;
  altrimenti nuova micro-migration).

### Step 4 — `/studio/help` · COSA TI INTERESSA?

```
┌──────────────────────────────────────────────────────────┐
│  ← indietro                                              │
│                                                          │
│       Come possiamo aiutarti?                            │
│       Multi-selezione. Almeno 1.                         │
│                                                          │
│       ◯ Organizzare il processo di progettazione         │
│       ◯ Gestire materiali e fornitori                    │
│       ◯ Presentare progetti ai clienti                   │
│       ◯ Coordinare il team                               │
│       ◯ Sviluppare nuove opportunità commerciali         │
│       ◯ Altro:    [_____________________________]        │
│                                                          │
│                              [ Invia candidatura → ]     │
└──────────────────────────────────────────────────────────┘
```

- **Opzioni DB-driven** da nuova tabella `studio_help_topics` (vedi §4).
- **"Altro"** campo testo libero opzionale.
- **NO** riferimenti a Design Journey OS, Material Intelligence,
  Moodboard Experience (sono nomi prodotto interni).
- Internamente: `studio_help_topics.maps_to_experience` permette al
  backend di tradurre `["process_design"]` → `["design_journey_os"]`
  senza esporre i nomi proprietari al visitor.

### Step 5 — `/studio/received` · RICEVUTO

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│       Abbiamo ricevuto la tua candidatura.               │
│                                                          │
│       Reference:    MOOD-XXXX-XXXX                       │
│       Mercato:      Italia                               │
│                                                          │
│       Prossimi passi:                                    │
│       1. Un MOOD Advisor esaminerà la candidatura.       │
│       2. Verrai contattato entro 3 giorni lavorativi.    │
│       3. Riceverai una email di conferma a              │
│          founder@studio.com.                             │
│                                                          │
│       Tempi indicativi: 7–10 giorni dalla candidatura    │
│       alla configurazione del Blueprint.                 │
│                                                          │
│       [ Torna alla home ]                                │
└──────────────────────────────────────────────────────────┘
```

- Riferisce solo a comunicazione transazionale email (già
  testata nel REAL TENANT SIMULATION™).
- Linguaggio asciutto, niente "calm reception" / "no talk of accounts".

---

## 3. COMPONENTI — DELETE / REUSE / NEW

### 3.1 DA ELIMINARE (V1)

| File | Motivo |
|---|---|
| `MovementEntrance.jsx` | Hero fotografico full-bleed sostituito da scelta archetipo |
| `MovementPractice.jsx` | Concept "Practice" vietato + immagini fotografiche vietate |
| `MovementEcosystem.jsx` | Concept "Ecosystem"/"Experiences" vietato |
| `MovementIdentity.jsx` | Form mega + Temperament/Monogram vietati + hardcoded lists |
| `MovementRequest.jsx` | Linguaggio aulico ("calm reception") |
| `StartStudioPage.jsx` | Legacy redirect — già non in uso |

### 3.2 DA RIUTILIZZARE

| File | Motivo |
|---|---|
| `useActivationDraft.js` | API client `/api/studio/activation/draft` rimane invariato |
| `useStudioManifest.js` | Diventa più snello (manifest senza archetipi/experiences hardcoded) |
| `corporate/components/MarketSelectorModal.jsx` | Default paese da Market globale già pronto |
| `services/email_dispatcher.py` | Pipeline email transazionale già hardened |
| `services/studio_activation.submit_request()` | Già firing 3 email + audit log |
| `routers/studio_activation.py:/draft` POST/PATCH | Rimane invariato |
| `routers/studio_activation.py:/submit` | Rimane invariato |
| `StudioActivationLayout.jsx` | Solo se riscritto come chrome neutro (probabile rewrite) |

### 3.3 DA CREARE (V2)

#### Frontend
| Componente | Path | Note |
|---|---|---|
| `StudioFunnelV2Layout.jsx` | `corporate/pages/studio_v2/` | Chrome neutro (no "Movement N of 6") |
| `Step1Archetype.jsx` | `corporate/pages/studio_v2/` | Icone Lucid-react |
| `Step2Location.jsx` | `corporate/pages/studio_v2/` | Mapbox autocomplete city |
| `Step3Contact.jsx` | `corporate/pages/studio_v2/` | Email check globale on-blur |
| `Step4Help.jsx` | `corporate/pages/studio_v2/` | DB-driven multi-select |
| `Step5Received.jsx` | `corporate/pages/studio_v2/` | Receipt minimale |
| `StepProgressBar.jsx` | `corporate/pages/studio_v2/components/` | "1 di 4" sobrio |
| `IconArchetype.jsx` | `corporate/pages/studio_v2/components/` | Mappatura icona ← archetype.icon_key |
| `MapboxCityAutocomplete.jsx` | `corporate/pages/studio_v2/components/` | Wrapper Mapbox Places SDK |

#### Backend
| Endpoint | Note |
|---|---|
| `GET /api/studio/v2/manifest?locale=...` | Restituisce archetypes + help_topics dal DB |
| `GET /api/studio/v2/check-email?email=...` | Verifica globale email (users + advisors + studio_requests) |
| `GET /api/studio/v2/cities?country=IT&q=mila` | Proxy Mapbox Places (se preferiamo non esporre il token) |
| `POST /api/studio/v2/submit` | Wraps `submit_request` esistente + traduce `help_topics → experiences` internamente |

---

## 4. SCHEMA DB — NUOVE TABELLE

```sql
-- Migration 028 — Studio V2 catalog tables

CREATE TABLE studio_archetypes_v2 (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT NOT NULL UNIQUE,          -- es. 'interior_studio'
  display_order   INT  NOT NULL DEFAULT 100,
  icon_key        TEXT NOT NULL,                  -- lucid-react icon name
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  -- Mapping interno per il backend (non esposto al visitor)
  maps_to_archetype TEXT NOT NULL,                -- legacy archetype code
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Localizzazione: usa pattern editorial_blocks namespace='studio_v2.archetype'
-- block_key='{code}.label', '{code}.description'

CREATE TABLE studio_help_topics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT NOT NULL UNIQUE,           -- 'process_design'
  display_order   INT  NOT NULL DEFAULT 100,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  maps_to_experience TEXT,                        -- 'design_journey_os'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Localizzazione: editorial_blocks namespace='studio_v2.help' block_key='{code}.label'

CREATE TABLE studio_request_help_areas (
  request_id      UUID NOT NULL REFERENCES studio_requests(id) ON DELETE CASCADE,
  help_topic_code TEXT NOT NULL,
  PRIMARY KEY (request_id, help_topic_code)
);

-- Seed iniziale (7 archetypes + 6 help_topics)
INSERT INTO studio_archetypes_v2 (code, display_order, icon_key, maps_to_archetype) VALUES
  ('interior_studio',  10, 'Sofa',         'interior_studio'),
  ('architecture',     20, 'Building',     'architecture_firm'),
  ('showroom',         30, 'Store',        'luxury_showroom'),
  ('retailer',         40, 'ShoppingBag',  'design_retail'),
  ('design_build',     50, 'Hammer',       'interior_studio'),
  ('brand',            60, 'Tag',          'design_retail'),
  ('other',            70, 'MoreHorizontal','interior_studio');

INSERT INTO studio_help_topics (code, display_order, maps_to_experience) VALUES
  ('process_design',     10, 'design_journey_os'),
  ('materials',          20, 'material_intelligence'),
  ('client_presentation',30, 'moodboard_experience'),
  ('team_coordination',  40, 'design_journey_os'),
  ('business_growth',    50, 'client_presentation_flow'),
  ('other',              60, NULL);
```

**Verifiche su tabelle esistenti** (auditate adesso):
- `markets` → ESISTE, ha `code`, `display_name`, `countries`, `eff_locale`,
  `currency`. **Manca probabilmente `dial_code`** → micro-aggiunta.
- `platform_languages` → ESISTE (BCP-47 ready).
- `countries`, `studio_archetypes`, `studio_help_topics`,
  `studio_request_help_areas` → **NON ESISTONO**.

---

## 5. EMAIL CHECK GLOBALE

Endpoint nuovo:
```
GET /api/studio/v2/check-email?email=<x>
Response:
  { "available": true }
  { "available": false, "reason": "registered_user|advisor|pending_request" }
```

Tabelle interrogate:
- `users.email`
- `advisor_profiles.email`
- `studio_requests.contact_email` con `status IN ('received','reviewing','contacted','qualified')`

**Tabelle escluse**: `studio_requests.status IN ('not_aligned')` (può
riprovare) e tenant `archived`.

**Frontend**: debounce 400ms on-blur, mostra inline error sotto il campo
email con linguaggio sobrio:
- "Questa email è già registrata. Hai già un Blueprint? [Accedi]"
- "Una candidatura per questa email è già in revisione."

---

## 6. MANIFEST V2 BACKEND

**Endpoint**: `GET /api/studio/v2/manifest?locale=it-IT`

**Risposta**:
```json
{
  "archetypes": [
    { "code": "interior_studio", "icon": "Sofa",
      "label": "Interior Design Studio",
      "description": "Studi che progettano spazi residenziali e commerciali." },
    ...
  ],
  "help_topics": [
    { "code": "process_design",
      "label": "Organizzare il processo di progettazione" },
    ...
  ],
  "markets": [
    { "code": "IT", "display_name": "Italia", "dial_code": "+39" },
    ...
  ],
  "default_market_code": "IT"
}
```

- Tutta la copy via `editorial_blocks` `namespace IN ('studio_v2.archetype',
  'studio_v2.help')` con BCP-47 fallback (riusa `_fetch_block_values`).

---

## 7. SUBMIT V2

**Endpoint**: `POST /api/studio/v2/submit`

**Body**:
```json
{
  "draft_token": "...",
  "archetype_code": "interior_studio",
  "country": "IT",
  "city": "Milano",
  "additional_markets": ["FR", "DE"],
  "first_name": "Mario",
  "last_name": "Rossi",
  "contact_email": "mario@studio.com",
  "phone_prefix": "+39",
  "phone_number": "3331234567",
  "help_topics": ["process_design", "materials"],
  "help_other_text": "",
  "locale": "it-IT"
}
```

**Logica interna**:
1. Server traduce `archetype_code` (V2) → `maps_to_archetype` (V1)
   via `studio_archetypes_v2`.
2. Server traduce `help_topics` (V2) → `experiences` (V1) via
   `studio_help_topics.maps_to_experience`.
3. **Chiama `submit_request()` esistente** con i campi V1
   ricostruiti — riusa pipeline email + audit log + advisor attribution
   già hardened.
4. Persiste i `help_topics` originali su `studio_request_help_areas`
   per audit trail futuro.
5. Restituisce `{ ok, request_id, reference }`.

**NESSUNA duplicazione** della pipeline email — chiamiamo direttamente
`studio_activation.submit_request()` che è già la single source of truth.

---

## 8. FILE COINVOLTI

### Da creare
```
backend/db/migrations/028_studio_v2_catalog.sql        (NEW)
backend/routers/studio_v2.py                            (NEW)
backend/services/studio_v2.py                           (NEW)
backend/scripts/seed_studio_v2_catalog.py               (NEW)
frontend/src/corporate/pages/studio_v2/
  StudioFunnelV2Layout.jsx                              (NEW)
  Step1Archetype.jsx                                    (NEW)
  Step2Location.jsx                                     (NEW)
  Step3Contact.jsx                                      (NEW)
  Step4Help.jsx                                         (NEW)
  Step5Received.jsx                                     (NEW)
  components/StepProgressBar.jsx                        (NEW)
  components/IconArchetype.jsx                          (NEW)
  components/MapboxCityAutocomplete.jsx                 (NEW)
  hooks/useV2Manifest.js                                (NEW)
  hooks/useV2EmailCheck.js                              (NEW)
```

### Da modificare
```
backend/server.py                       (register studio_v2 router)
frontend/src/corporate/CorporateApp.jsx (replace /studio routes)
```

### Da eliminare
```
frontend/src/corporate/pages/StartStudioPage.jsx
frontend/src/corporate/pages/studio/MovementEntrance.jsx
frontend/src/corporate/pages/studio/MovementPractice.jsx
frontend/src/corporate/pages/studio/MovementEcosystem.jsx
frontend/src/corporate/pages/studio/MovementIdentity.jsx
frontend/src/corporate/pages/studio/MovementRequest.jsx
frontend/src/corporate/pages/studio/StudioActivationLayout.jsx
```

(*Il vecchio `useActivationDraft` e `useStudioManifest` rimangono se
servono ancora alla console admin; altrimenti anche loro vanno*.)

---

## 9. INTEGRAZIONI ESTERNE

### Mapbox Places API
- **Necessario** per Step 2 (autocomplete città).
- **Richiede token utente** → da chiedere all'utente.
- Alternativa low-cost: input testo libero per la città (Mapbox solo
  in fase II).

**🟡 DECISIONE RICHIESTA**:
a) Integrare Mapbox subito (richiede MAPBOX_PUBLIC_TOKEN dall'utente)
b) Step 2 con input testo libero adesso, Mapbox in fase successiva
c) OpenStreetMap Nominatim (gratuito, senza token, qualità minore)

---

## 10. EFFORT REALE

| Fase | Stima | Note |
|---|---|---|
| Migration 028 + seed | 1h | SQL + Python script |
| Backend studio_v2 router + service | 3h | check-email, manifest, submit wrapper |
| Frontend 5 step components + layout | 6h | Inclusi data-testid, validazioni, transizioni |
| Mapbox integration | 1h | (solo se opt-a) |
| CMS seed (archetype + help_topics copy it-IT + en-US) | 2h | Via script `seed_studio_v2_catalog.py` |
| Test E2E V2 (analoga simulazione visitor V1) | 2h | Cattura screenshot per ogni step + audit emails |
| Audit no-hardcoded post-implementazione | 1h | `test_no_hardcoded_locales.sh` esteso a markets/archetypes |
| **TOTALE realistico** | **15-16h** | Senza Mapbox = 14-15h |

---

## 11. SCREENSHOT/WIREFRAME

Wireframe ASCII forniti nelle sezioni §2.1-§2.5. Wireframe ad alta
fedeltà (Figma-style) NON inclusi in questo piano — verranno generati
dopo approvazione, in formato HTML/screenshot via screenshot tool come
prova visiva di ogni step prima del merge.

Per ora il riferimento visivo è:
- **Stile**: somiglia a Linear, Vercel, Stripe Onboarding — non a
  Squarespace/Wix/portfolio creativo.
- **Tipografia**: H1 sans modern 48px, body 16px, no serif (rimuove
  il sapore "manifesto editoriale" del V1).
- **Colori**: dark mode + accent teal MOOD `#00C9B3` solo su CTA.
- **Densità**: una domanda per schermata, spazio negativo abbondante,
  zero distrazioni laterali.

---

## 12. CHECKLIST APPROVAZIONE

Prima che io scriva codice, ho bisogno di OK su:

- [ ] **A) Step structure**: 5 schermate come da §2 (chi · dove · contatto · cosa · ricevuto). OK?
- [ ] **B) DB-driven catalog**: nuove tabelle `studio_archetypes_v2`, `studio_help_topics`, `studio_request_help_areas`. Migration 028. OK?
- [ ] **C) Mapbox**: scelgo opzione **a / b / c** dalla §9?
- [ ] **D) Email check globale**: query su `users` + `advisor_profiles` + `studio_requests`. Soglia status escluse: `not_aligned`. OK?
- [ ] **E) Pipeline email**: nessuna duplicazione, V2 chiama `submit_request()` esistente. OK?
- [ ] **F) Eliminazione V1**: 7 file frontend (vedi §8 "da eliminare"). OK?
- [ ] **G) Coabitazione temporanea**: vuoi che V1 resti raggiungibile a `/studio-legacy` durante il roll-out, o switch hard a V2 nello stesso deploy?
- [ ] **H) Tono editoriale**: ho fatto esempi di copy nelle wireframe (§2). Vanno bene o vuoi rivedere prima?

**STOP**.

Resto in attesa della tua approvazione punto per punto (o di un OK
globale). Non scrivo una sola riga di codice fino a tuo via libera.
