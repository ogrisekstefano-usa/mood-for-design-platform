# ITER160 — Studio Activation Onboarding Flow™
*Master PRD · Editorial Operating Specification*
*MOOD for DESIGN · Feb 28, 2026*

---

## §1 — Philosophy & Positioning

### 1.1 What this is NOT
This onboarding is **not** a SaaS signup. It does not collect a "team", a "billing plan", or a "subscription". It is not "Get started — free trial / no credit card required". It is not a wizard with progress bars and disabled CTAs.

The vocabulary forbidden across the whole experience:
*Sign up · Account · Subscribe · Plan · Free trial · Set up · Configure · Get started · Workspace · Dashboard · CRM · Pipeline · Onboarding · Tenant · Workspace owner · Admin*

### 1.2 What this IS
> The ceremonial activation of a contemporary design ecosystem.

The user is not "creating an account" — they are **claiming a studio's editorial space inside the MOOD architecture**. The same way a member is welcomed into a luxury hotel suite, or a designer enters a private atelier: the experience is **received**, not **set up**.

The verbs we use instead:
*Begin · Activate · Open · Compose · Welcome · Receive · Enter · Continue*

### 1.3 The unifying metaphor
**Design Journey™** is the platform's central narrative. Onboarding is the first chapter of that journey. The studio's first ten minutes inside MOOD must feel like the first ten minutes inside a beautifully kept atelier — not a software installation.

---

## §2 — Architecture: Tenant Layer vs Client Layer

MOOD operates on **two distinct relational layers** that must never be confused:

```
┌──────────────────────────────────────────────────────────────┐
│  TENANT LAYER (operators)                                    │
│  ─────────────────────────                                   │
│  Studio owners · Showroom owners · Architects · Designers    │
│  PMs · Staff · Advisors                                       │
│                                                              │
│  Entry → ITER160 Studio Activation                           │
│  Re-entry → ITER167 Access Continuity™ (/accedi)             │
│                                                              │
│  Owns: workspace, projects, moodboards, materials,           │
│        client invitations, presentations                     │
└──────────────────────────────────────────────────────────────┘
                          │
                          │  (invitations / presentations)
                          ▼
┌──────────────────────────────────────────────────────────────┐
│  CLIENT LAYER (private clients — out of scope for ITER160)   │
│  ─────────────────────────                                   │
│  Private clients enter via:                                  │
│   • Invitation link  • Project portal                        │
│   • Moodboard approval  • Material review                    │
│   • Immersive presentation                                   │
│                                                              │
│  Never lands on /accedi. Never sees onboarding.              │
│  Sees ONLY their Design Journey™.                            │
└──────────────────────────────────────────────────────────────┘
```

ITER160 is **strictly the tenant-layer entrance**.
The client layer is a separate iteration (ITER180+ in roadmap).

---

## §3 — Mental Model: Onboarding Psychology

Three psychological forces shape every screen:

**(1) Slow Reveal** — one decision per screen. No multi-field forms above the fold. Each step reveals the next as a quiet transition, not a "wizard step 3 of 7".

**(2) Reflective Identity** — the studio sees itself **as it composes itself**. The right side of every screen previews how the studio's choices materialize into editorial moments (a moodboard tile, a project cover, a presentation page). This is **identity-in-formation**, not "preview disabled until form complete".

**(3) Calm Authority** — the platform never asks the studio to "trust us". It demonstrates discretion by what it *doesn't* ask: no credit card upfront, no marketing checkboxes, no "How did you hear about us", no NPS.

---

## §4 — The Five Movements

The full activation is a **five-movement composition**. Each movement is one URL.
None of them carries a "Step 1 of 5" indicator. Progress is expressed as a quiet ascending vertical line on the left margin, no numbers.

```
                           movements
   I. ENTRANCE    →   II. PRACTICE   →   III. ECOSYSTEM
       /studio          /studio/practice    /studio/ecosystem
                                                  ▼
   V. CONTINUITY  ←   IV. IDENTITY
       /accedi          /studio/identity
```

### 4.1 Movement I — `ENTRANCE` *(landing on the activation)*

**Route**  `/studio` (replaces the current `/start-studio` shortcut)
**Time on screen**  ~12 seconds
**Cognitive load**  zero — just contemplation.

**What is shown**
- Full-bleed editorial photograph with subtle Ken-Burns drift (a Milanese atelier at dusk, soft natural light spilling over material samples).
- Single serif headline, top-aligned:
  > *Open a new chapter of your studio.*
- Single italic sublead beneath it:
  > *MOOD for DESIGN composes the operating space for the practices that shape contemporary interior design.*
- Single CTA: **Begin the composition** → leads to Movement II.
- Small italic exit affordance bottom-left: *Already inside MOOD?* → `/accedi`.

**What is NOT shown**
No feature list. No pricing. No social proof. No testimonials. No "trusted by X studios".

**Microcopy variants (IT / EN / FR / DE / ES)** — see §10.

---

### 4.2 Movement II — `PRACTICE` *(what kind of studio is this)*

**Route**  `/studio/practice`
**Decision**  Studio archetype.

**What is shown**
Six archetypes presented as **cinematic tiles**, not radio buttons. Each tile is a small editorial composition with a representative photograph + serif label + italic descriptor. Tile hover: slow scale 1.02 + opacity rise on the descriptor.

The six archetypes (DB-driven, namespace `studio.archetype.*`):
| key | label | descriptor |
|---|---|---|
| `interior_studio` | Interior Design Studio | Practices composing private residential and hospitality environments. |
| `luxury_showroom` | Luxury Showroom | Spaces where materials, brands and clients meet in curated dialogue. |
| `architecture_firm` | Architecture Firm | Practices designing the architectural envelope and its interiors. |
| `material_gallery` | Material Gallery | Curators of finishes, surfaces, and storied materials. |
| `design_retail` | Design Retail | Selectors who bring authored objects to discerning audiences. |
| `stone_specialist` | Stone Specialist | Custodians of natural stone — from quarry to interior. |

**Interaction**
Click a tile → tile expands edge-to-edge with a 600ms ease-out, the others fade away. A confirming line appears in italic:
> *You are entering MOOD as a {practice.label}.*
Below: **Continue →**.

The selection is stored client-side (and later persisted with the workspace). The user can return by clicking the studio's editorial monogram in the top-left.

**Why six and not "Other"**
The absence of "Other" is intentional. If a visitor's practice does not match these six, they are gently directed to **journey@moodfordesign.com** via a calm sublink: *Your practice lives somewhere else? Compose with us.* — this routes to a concierge conversation, not a form.

---

### 4.3 Movement III — `ECOSYSTEM` *(which modules form your operating space)*

**Route**  `/studio/ecosystem`
**Decision**  One or more **Experiences** to activate.

**What is shown**
Five **Experiences** presented as horizontal editorial bands (one above the other, full-width). Each band has:
- A serif title (DB-driven, `studio.experience.{key}.title`).
- One italic line of poetic descriptor.
- A right-aligned media tile (8s slow-loop video or large still).
- A toggle that is **never** a checkbox — it is a small italic phrase: *— include in your composition* / *— included.*

The five Experiences:
| key | title | descriptor |
|---|---|---|
| `design_journey_os` | Design Journey OS™ | The editorial operating system for every project, from listening to realization. |
| `material_intelligence` | Material Intelligence™ | A relational memory of materials, finishes, and the projects they shaped. |
| `moodboard_experience` | Moodboard Experience™ | Composed atmospheres — relational, not visual storage. |
| `showroom_continuity` | Showroom Continuity™ | The connective tissue between physical showroom moments and the digital atelier. |
| `client_presentation_flow` | Client Presentation Flow™ | Immersive presentations where decisions become a moment, not a meeting. |

**Adaptive logic**
The experiences pre-selected on arrival depend on the archetype chosen in Movement II:

| archetype | pre-suggested experiences |
|---|---|
| Interior Design Studio | Design Journey OS · Moodboard Experience · Client Presentation Flow |
| Luxury Showroom | Showroom Continuity · Material Intelligence · Client Presentation Flow |
| Architecture Firm | Design Journey OS · Material Intelligence |
| Material Gallery | Material Intelligence · Showroom Continuity |
| Design Retail | Showroom Continuity · Client Presentation Flow |
| Stone Specialist | Material Intelligence · Showroom Continuity |

The studio can include or exclude any of the five — no minimum, no maximum. The framing is **"compose your operating space"**, never "select modules".

A single quiet line at the bottom:
> *You can always invite new experiences into your composition. Nothing is locked.*

**Continue →**

---

### 4.4 Movement IV — `IDENTITY` *(the studio composes its own portrait)*

**Route**  `/studio/identity`
**Decision**  Studio personhood.

This is the only movement that asks for inputs. Even here, the form is **vertical, one field per breath, no Save button** — the form auto-pings the API on blur, displaying a quiet italic confirmation:
> *Composed.*

**Fields, in order of appearance** *(each appears as the previous one is completed, slow staggered reveal)*:

1. **Studio name** — single-line, large serif input (typed text appears in 1.6rem Playfair, like a book title).
2. **Editorial monogram** *(optional)* — single character or two-letter sigil. Displayed live as the studio's emerging mark in the top-left.
3. **Where you compose from** — city + country. Subtle dropdown with no flag emoji; pure typography. Multi-select allowed (a studio may have Milano + Paris).
4. **Languages you speak** — multi-select; defaults pre-checked to the navigator language + English. The languages selected here become the studio's published languages on MOOD.
5. **The atelier** — 1 to 5 names + roles, added inline. Roles are not "Manager / Engineer / Sales" — they are *Founder · Partner · Designer · Project Lead · Curator · Advisor · Studio Manager*. Each name added appears as a small portrait card (no actual photo required — a quiet typographic plate is shown in its place).
6. **Markets you serve** — multi-select. Options curated, no "Other": *Private residential · Hospitality · Cultural · Yacht · Aviation · Retail · Office · Showroom · Restaurant.*
7. **Workflow temperament** — three editorial cards, one to be chosen:
   - **Quiet** — *Decisions ripen slowly. The studio prefers contemplation to velocity.*
   - **Composed** — *A rhythm of considered iteration. Most studios begin here.*
   - **Vivid** — *Rapid composition, daily turnover, immediate decisions.*
   This single choice will later inform notification cadence, the default density of moodboards, the temperature of palette suggestions, and the rhythm of the digest emails. It is not exposed as "settings" — it is exposed as **temperament**.

**Continue →**

---

### 4.5 Movement V — `CONTINUITY` *(the studio crosses the threshold)*

**Route**  `/studio/activate`
**What happens**

A **single, slow cinematic moment**.
For ~3 seconds the screen is dark with the studio's monogram emerging in the center. A single line of italic typography:
> *We are opening {studio.name}'s editorial space.*

Then a **soft fade** into the studio's brand-new home — directly into the Design Journey OS dashboard (if activated) or into the first activated experience.

The studio's email — the email of the founder added in Movement IV — receives **a single editorial welcome email** that doubles as the **first Access Continuity link**. The studio never types a password.

When the studio leaves and returns later, they land on `/accedi` (ITER167) and pick up the same email — magic link delivered.

---

## §5 — The Quiet Mechanics

### 5.1 No "Save & Exit"
At every movement there is no Save button. The composition autosaves silently. Closing the tab and reopening it from the same browser resumes the same movement (localStorage + a server-side "draft_studios" row keyed by an anonymous draft_id cookie).

### 5.2 No mandatory account first
A draft studio exists **without an email** until the founder is added in Movement IV. Email is captured as part of identity, not as a gate. This collapses "Sign up" and "Compose your studio" into a single act.

### 5.3 No pricing screen
ITER160 deliberately ends without a pricing screen. The studio enters fully composed and operational. Commercial conversation is handled later, **inside** the studio's editorial environment, framed as **partnership tiers** rather than "Choose a plan".

### 5.4 No re-confirmation
The activated studio is **the moment of activation**. No "Verify your email", no "Click here to confirm". The magic-link email is the first thing they receive *after* they're already inside. This is hospitality-first: the room is ready when the guest arrives, the key is sent in advance.

---

## §6 — Cinematic Visual Direction

### 6.1 Atmosphere
- Background: **deep black** `#050505` with a single slow-drifting radial pool of warm light (the "Chicago atelier at dusk" lighting MOOD already uses).
- Negative space: **at least 60% of the viewport**. The composition is never crowded.
- Typography:
  - **Headlines** — Playfair Display, weight 400, sizes clamp(2.4rem, 4.6vw, 4.2rem), letter-spacing -0.01em.
  - **Sublead** — Helvetica Neue / Inter, weight 400, 1.05rem, line-height 1.65, max-width 46ch, opacity 0.72.
  - **Body inputs** — Playfair Display 1.6rem for *Studio name* and *monogram*. All other inputs: Helvetica Neue 1.05rem, underline only (no boxes).
  - **Eyebrow & overline** — Helvetica Neue 0.72rem, letter-spacing 0.28em, uppercase, teal `#00C9B3`.
  - **Italic accents** — Playfair Display italic at 0.95–1.2rem for moments of editorial intimacy (*Composed.*, *— included.*).

### 6.2 Motion
- **Transitions between movements**: 720ms cubic-bezier(0.22, 1, 0.36, 1) — fade + 8px vertical translation.
- **Stagger reveals**: each field in Movement IV appears with a 140ms stagger.
- **Selection feedback**: tile hover → scale 1.02, descriptor opacity 0 → 1 in 260ms.
- **Edge-to-edge expansion** of archetype tile on click: 600ms ease-out.

### 6.3 Sound (optional, opt-in via a small bottom-right speaker icon)
A single ambient soundbed — soft Milanese street rain + distant piano — plays only if the user clicks the icon. **Never autoplay.** When enabled, persists across all five movements. This is a **luxury hospitality detail**, not a feature.

### 6.4 Photography & video
- Movement I: 1 hero still (Milanese atelier at dusk, ~3MB, lazyloaded with blur-up).
- Movement III: 5 short 8s muted loops (one per experience), <2MB each, MP4 H.264.
- All photography curated to feel like a Magazine spread, never a Stock Photo site. Same direction as the homepage cinematic photography already in production.

### 6.5 What we never show
- No emojis.
- No spinners (replaced by italic *Composing…* and concierge-style pulses).
- No red error banners (concierge intercept — same as ITER167).
- No "Step 3 of 5" indicators.
- No "75% complete" progress bars.
- No "Trusted by" rows.
- No checkboxes for marketing consent (privacy summary inline, in editorial italic).

---

## §7 — Multi-tenant Structure

Every activation creates **one new row in `tenants`** with:
```
tenants:
  id                uuid
  slug              text   (auto-derived from studio name, slugified)
  name              text
  practice          text   (FK semantic — archetype key)
  monogram          text   (optional, 1–3 chars)
  temperament       enum   ('quiet','composed','vivid')
  primary_locale    text
  languages         text[] (enabled locales)
  status            enum   ('draft','active','suspended')
  created_at, updated_at
```

A new `studio_activation_drafts` table holds the in-progress state:
```
studio_activation_drafts:
  id                uuid
  draft_token       text   (cookie + localStorage)
  archetype         text
  experiences       text[]
  payload           jsonb  (full identity blob)
  current_movement  text   (entrance|practice|ecosystem|identity|activate)
  founder_email     text   (null until movement IV)
  resumed_count     int
  ip, user_agent
  created_at, updated_at, completed_at
```

`tenant_modules` records which Experiences a tenant has activated:
```
tenant_modules:
  tenant_id   uuid (FK)
  module_key  text   ('design_journey_os' | 'material_intelligence' | …)
  state       enum   ('active','paused','archived')
  activated_at
```

This module table is what the rest of the platform reads to decide which sections to render on the studio's home, and what their `useStudioModules()` hook returns.

---

## §8 — Adaptive Flow Logic

### 8.1 Suggested experiences by archetype
See table in §4.3.

### 8.2 Suggested languages by composition location
If the studio adds *Milano* → IT auto-checked.
If they add *Paris* → FR auto-checked.
If they add *Madrid* or *Barcelona* → ES auto-checked.
If they add *München* / *Berlin* / *Zürich* → DE auto-checked.
All studios auto-get EN.

### 8.3 Temperament-driven defaults
| temperament | digest cadence | moodboard density | palette suggestions |
|---|---|---|---|
| Quiet | weekly, Friday morning | spacious (4 tiles / row) | warm neutrals, low saturation |
| Composed | twice-weekly, Tue + Fri | balanced (6 tiles / row) | warm neutrals + selected accents |
| Vivid | daily, morning | dense (8 tiles / row) | full chromatic range |

These defaults are **invisible to the studio** — they are the platform expressing the choice the studio made. Each can be retuned later, but the language used is never "settings" — it is *atmosphere*.

### 8.4 Re-entry as a returning draft
If `draft_token` cookie matches an unfinished draft, the user lands directly on their last movement with a quiet italic line:
> *We kept your composition exactly where you left it.*

No "Resume" button. The continuation **is** the page.

---

## §9 — Onboarding Psychology Principles (the canon)

These five principles govern every UI decision in ITER160:

1. **One decision per breath** — never two choices on the same screen.
2. **Pre-composed defaults** — the platform always arrives with an opinion the studio can edit, never with a blank page.
3. **Editorial confirmation** — every action is acknowledged with a single italic word (*Composed. · Welcomed. · Continued.*) not a toast.
4. **Visible identity-in-formation** — what the studio builds is always visible somewhere on the screen.
5. **No exit penalty** — leaving is never undone; coming back is never re-explained.

---

## §10 — Microcopy Library (excerpt)

Every line below is multilingual (IT / EN / FR / DE / ES). Stored under namespace `studio.activation.*` in `editorial_blocks`. Sample (IT primary):

### 10.1 Movement I — Entrance
- `studio.activation.entrance.headline` — *Apri un nuovo capitolo del tuo studio.*
- `studio.activation.entrance.sublead` — *MOOD for DESIGN compone lo spazio operativo delle pratiche che modellano l'interior contemporaneo.*
- `studio.activation.entrance.cta` — *Inizia la composizione*
- `studio.activation.entrance.return_link` — *Sei già dentro MOOD?*

### 10.2 Movement II — Practice
- `studio.activation.practice.headline` — *Da quale pratica entri in MOOD?*
- `studio.activation.practice.sublead` — *Ognuno compone in modo diverso. Da qui prepariamo il tuo ecosistema.*
- `studio.activation.practice.confirm_line` — *Entri in MOOD come **{practice}**.*
- `studio.activation.practice.fallback_link` — *La tua pratica vive altrove? Componiamola insieme.*

### 10.3 Movement III — Ecosystem
- `studio.activation.ecosystem.headline` — *Componi il tuo spazio operativo.*
- `studio.activation.ecosystem.sublead` — *Le esperienze che inviti oggi possono crescere con lo studio. Niente è bloccato.*
- `studio.activation.ecosystem.included_line` — *— inclusa nella tua composizione.*
- `studio.activation.ecosystem.exclude_line` — *— non per ora.*

### 10.4 Movement IV — Identity
- `studio.activation.identity.headline` — *Lascia che il tuo studio si presenti.*
- `studio.activation.identity.studio_name.label` — *Il nome del tuo studio*
- `studio.activation.identity.studio_name.placeholder` — *Atelier, studio, casa…*
- `studio.activation.identity.monogram.label` — *Il vostro monogramma editoriale*
- `studio.activation.identity.monogram.helper` — *Una o due lettere, come una firma.*
- `studio.activation.identity.where.label` — *Dove componete*
- `studio.activation.identity.languages.label` — *Le lingue del vostro studio*
- `studio.activation.identity.atelier.label` — *L'atelier — chi compone con voi*
- `studio.activation.identity.atelier.add` — *Invita un altro nome*
- `studio.activation.identity.markets.label` — *I mondi in cui progettate*
- `studio.activation.identity.temperament.label` — *Il temperamento del vostro workflow*
- `studio.activation.identity.temperament.quiet.title` — *Quieto*
- `studio.activation.identity.temperament.quiet.body` — *Le decisioni maturano con lentezza. Lo studio preferisce la contemplazione alla velocità.*
- `studio.activation.identity.temperament.composed.title` — *Composto*
- `studio.activation.identity.temperament.composed.body` — *Un ritmo di iterazioni meditate. La maggior parte degli studi inizia qui.*
- `studio.activation.identity.temperament.vivid.title` — *Vivido*
- `studio.activation.identity.temperament.vivid.body` — *Composizione rapida, decisioni quotidiane, ritmo immediato.*
- `studio.activation.identity.confirm_inline` — *Composto.*

### 10.5 Movement V — Activate
- `studio.activation.activate.headline` — *Stiamo aprendo lo spazio editoriale di {studio.name}.*
- `studio.activation.activate.email_subject` — *{studio.name} è dentro MOOD.*
- `studio.activation.activate.email_body` — *Lo studio è stato aperto. Vi accompagniamo dentro il vostro Design Journey.*

(All keys exist in IT / EN / FR / DE / ES — full library generated at seed time.)

### 10.6 Concierge intercepts (no error banners)
| situation | line |
|---|---|
| Network failure during identity save | *La connessione si è interrotta — la tua composizione è al sicuro.* |
| Slugify collision (studio name already taken) | *Un altro studio porta già questo nome. Possiamo aggiungere un dettaglio?* |
| Email already linked to an existing studio | *Questo indirizzo è già parte di un altro studio. Continuiamo da lì?* (offers to switch to /accedi) |
| Resend down | *Il vostro accesso è pronto. La conferma vi raggiungerà tra poco.* |

---

## §11 — Backend Surface

New endpoints (all under `/api/studio/activation`):

| method | path | purpose |
|---|---|---|
| POST | `/draft` | Create or fetch a draft (idempotent via `draft_token` cookie). Returns the draft + current movement. |
| PATCH | `/draft` | Update fields. Accepts `archetype`, `experiences[]`, `identity{...}`, `movement`. Autosave on every blur. |
| POST | `/complete` | Finalize the draft → creates `tenants` row, `tenant_modules` rows, founder `users` row, issues first magic-link, marks draft completed. |
| GET | `/manifest` | Returns the archetypes, experiences and microcopy keys map (one call, used by the page on mount to avoid 28 site-block requests). |

The `complete` endpoint is also responsible for slugifying the studio name into a unique `tenants.slug`. On collision it returns the concierge intercept payload (see §10.6) rather than a 409.

---

## §12 — Frontend Surface

```
/app/frontend/src/corporate/pages/studio/
  StudioActivationLayout.jsx     — shared chrome (monogram top-left, ambient backdrop, music toggle)
  MovementEntrance.jsx           — /studio
  MovementPractice.jsx           — /studio/practice
  MovementEcosystem.jsx          — /studio/ecosystem
  MovementIdentity.jsx           — /studio/identity
  MovementActivate.jsx           — /studio/activate
  hooks/
    useActivationDraft.js        — autosave + resume
    useStudioManifest.js         — single /manifest call
```

The existing legacy `/start-studio` page is redirected to `/studio` and slated for deletion after ITER160 ships.

---

## §13 — Acceptance Criteria (for the engineering pass)

A movement is "shipped" only when **every** item below is true:

- [ ] **Tone** — A native Italian designer can read the screen for 30 seconds without seeing a single SaaS / engineering word.
- [ ] **One decision per breath** — Exactly one primary decision is visible above the fold.
- [ ] **Identity-in-formation** — The studio monogram (or its placeholder) is visible top-left from Movement IV onward.
- [ ] **Autosave** — Refreshing the page or closing the tab and reopening returns the user to the same movement, with the same selections.
- [ ] **Multilingual** — All visible strings come from `editorial_blocks` (`studio.activation.*` namespace) in IT / EN / FR / DE / ES.
- [ ] **Concierge** — No raw error, no red banner, no 4xx/5xx code, no English "Oops" text appears to the user under any failure path.
- [ ] **No stock SaaS UI** — No checkboxes, no spinners, no progress bars, no "Step 3 of 5", no required-field asterisks.
- [ ] **Accessibility** — All interactive surfaces reachable by keyboard; focus rings styled to match the editorial aesthetic (1px teal underline, never the browser default).

---

## §14 — Out of scope (explicitly deferred)

These are **intentionally** not part of ITER160 and live in later iterations:

| iteration | scope |
|---|---|
| ITER161 | Founder invites additional team members (post-activation). |
| ITER162 | Studio billing & partnership tiers, presented inside the activated workspace. |
| ITER170 | Domain mapping for studio subdomains (`{slug}.moodfordesign.com`). |
| ITER180 | **Client Layer** — private client portal, invitation links, moodboard approvals, immersive presentations. |

---

## §15 — One-paragraph compass

> *MOOD for DESIGN does not onboard studios. It welcomes them. The five movements of ITER160 are the slow choreography by which a contemporary design practice composes its own editorial space inside MOOD — naming itself, choosing its experiences, voicing its temperament — and crosses the threshold into a working environment that already belongs to it. Every detail of this experience must read as a luxury hospitality moment, not a software setup.*

*End of PRD.*
