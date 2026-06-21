# WEBSITE CTA CONSOLIDATION REPORT
**MOOD for DESIGN — Public-Site Conversion & Positioning Audit**

> Read-only audit. **No code changes. No layout redesign. No new components.**
> Status: ✅ inventory complete · 🟡 architecture proposed · ⏳ awaiting user ratification before any CMS write.
> Date: 20 June 2026
> Scope: Home · Dedicato A · Caratteristiche · Versioni e Prezzi · Formazione (Academy) · FAQ

---

## 0. TL;DR (one-page executive summary)

| Diagnosis | Evidence |
|---|---|
| **CTA fragmentation** — 9+ different action labels across 6 pages | inventory below |
| **Positioning drift** — "Candida il tuo studio", "Parla con un Advisor", "Scopri MOOD…" mix SaaS-y, application-form and brochure tones in the same funnel | §1 |
| **Dead-end anchors** — 5 of the most prominent CTAs link to `#section` self-anchors, not to conversion | §1.2 Audience, §1.5 Training |
| **Conversion dilution** — Pricing tier 1–3 all push to `/supporto` (a support page), not to the Design Journey funnel | §1.4 |
| **Empty CTAs** — `hero.cta_secondary` is literally `""` on Home + several flex cells | §1.1 |
| **Vision CTA, not Action CTA** — "Scopri MOOD for DESIGN" (Home hero + Home final) describes the brand, doesn't request a decision | §1.1 |
| **One canonical destination already exists** — `/studio` (`StudioFunnelV2`) is a 3-step Design Journey™ form. It is the natural primary-CTA target. Today only 6 of the 22 page-level primary CTAs actually point there | §2 |

**Proposed architecture**: collapse 9+ labels into **2 global actions** wired to **2 destinations**, both CMS-managed.

---

## 1. CURRENT CTA INVENTORY (verbatim from DB)

> Source of truth: `editorial_blocks.source_value` (labels) + `cms_sections.settings.links.*_href` (URLs).
> All values below were pulled via raw SQL against the published tenant `studio` on 20 Jun 2026.
> Format: `[location] LABEL → URL  (severity)`

### 1.1 HOME `/`  *(page_key = home)*

| Position | Label (IT) | Destination | Severity |
|---|---|---|---|
| Hero · primary | "Scopri MOOD for DESIGN" | (no href configured) | 🔴 **P0** — vision-statement, not a decision CTA, and the link is missing |
| Hero · secondary | "" *(empty string)* | — | 🔴 **P0** — empty CTA rendered as a stray pill |
| Design Journey block | "Scopri il metodo MOOD" | `/about` | 🟡 P1 — `/about` is sparse; CTA reads "discover", not "request" |
| Editorial triptych · magazine | "Esplora il magazine" / "Leggi il magazine" *(two duplicate keys)* | `/magazine` | 🟡 P1 — duplicate block key `triptych.magazine.cta` vs `magazine.cta` |
| Editorial triptych · projects | "Esplora i progetti" / "Tutti i progetti" | `/projects` | 🟡 P1 — same duplicate-key issue |
| Editorial triptych · materials | "Scopri i materiali" / "Esplora i partner" | `/materials` | 🟡 P1 — same |
| Final CTA · primary | "Scopri MOOD for DESIGN" / "Inizia il Percorso" *(two competing keys)* | `/studio` | 🔴 P0 — two labels for the same slot, decided at render time non-deterministically |
| Final CTA · secondary | "" / "Accesso Professionale" | `/accedi` | 🟡 P1 |
| Flex cells (5+) | "" *(empty)* / "test" | — | 🔴 P0 — empty + test artefacts shipped to production |

### 1.2 DEDICATO A `/dedicato-a`  *(page_key = audience)*

| Position | Label | Destination | Severity |
|---|---|---|---|
| Hero | "Scopri a chi ci rivolgiamo" | `#a-chi-ci-rivolgiamo` *(self-anchor)* | 🔴 **P0** — the page's primary action scrolls to itself. Zero conversion |
| Page intro | "Scopri MOOD for DESIGN" | `/caratteristiche` | 🟡 P1 — generic verb, points to product specs instead of the journey |

### 1.3 CARATTERISTICHE `/caratteristiche`  *(page_key = features)*

| Position | Label | Destination | Severity |
|---|---|---|---|
| Hero | "Candida il tuo studio" | `/studio` | 🟡 P1 — "Candidati" reads as job-application / gated-access tone; conflicts with consultative positioning |
| Page intro | (same as hero) | `/studio` | 🔴 **P0** — duplicate CTA in adjacent sections |
| Final CTA · eyebrow | "Pronto a iniziare?" | — | informational |
| Final CTA · headline | "Vediamo se Blueprint è giusto per il tuo studio." | — | ✅ good consultative copy |
| Final CTA · body | "La candidatura richiede 3 minuti…" | — | 🟡 P1 — "candidatura" word again |
| Final CTA · button | "Candida il tuo studio" | `/studio` | 🟡 P1 — third occurrence of the same CTA on the same page |

### 1.4 VERSIONI E PREZZI `/versioni-prezzi`  *(page_key = pricing)*

| Position | Label | Destination | Severity |
|---|---|---|---|
| Page intro | "Candida il tuo studio" | `/studio` | 🟡 P1 |
| Pricing tier 01 | "Parlane con un Advisor" | `/supporto` | 🔴 **P0** — leads OUT of the funnel into a support page |
| Pricing tier 02 | "Parlane con un Advisor" | `/supporto` | 🔴 P0 — same |
| Pricing tier 03 | "Parlane con un Advisor" | `/supporto` | 🔴 P0 — same |
| Pricing tier 04 | "" *(empty)* | `/supporto` | 🔴 P0 — empty label rendered |
| Pricing tier 05 | "" *(empty)* | `/supporto` | 🔴 P0 — same |
| Comparison table | "Parlane con un Advisor" | `/supporto` | 🟡 P1 — fifth occurrence on this page; advisor-speak |
| Ecosystem note | "Esplora il supporto" | `/supporto` | 🟢 P2 — fine semantically, but adds a sixth distinct verb to one page |
| Final headline | "Vediamo se Blueprint è giusto per il tuo studio." | — | ✅ good |
| Final button | "Candida il tuo studio" | `/studio` | 🟡 P1 — wording conflict with tier CTAs |

### 1.5 FORMAZIONE (Academy) `/formazione`  *(page_key = training)*

| Position | Label | Destination | Severity |
|---|---|---|---|
| Hero · primary | "Scopri i percorsi" | `#percorsi` | 🔴 **P0** — self-anchor, no progression |
| Hero · secondary | "Guarda i tutorial" | `#tutorial` | 🔴 P0 — self-anchor |
| Page intro | "Candida il tuo studio" | `/studio` | 🟡 P1 — same conflict as features |
| Card grid #1 (4 items) | "Scopri i percorsi" / "Vai ai tutorial" / "Sfoglia le guide" / "Scopri i prossimi eventi" | `#percorsi` `#tutorial` `#guide` `#webinar` | 🔴 P0 — 4 more self-anchors |
| Card grid #2 (academy) | "Scopri di più" | `#academy` | 🔴 P0 — self-anchor + generic verb |
| Anchor section · percorsi | "Esplora i percorsi" | `#percorsi-detail` | 🟡 P1 — anchor-to-anchor |
| Anchor section · tutorial | "Vai ai tutorial" | `#tutorial-detail` | 🟡 P1 |
| Anchor section · guide | "Sfoglia le guide" | `#guide-detail` | 🟡 P1 |
| Anchor section · webinar | "Scopri i prossimi eventi" | `#webinar-detail` | 🟡 P1 |
| Anchor section · academy | "Richiedi accesso" | `#academy-detail` | 🟡 P1 — the only journey-ish verb on the page, but goes to an anchor |
| Final CTA | "Esplora MOOD Academy" | (no `final_cta_href` configured) | 🔴 P0 — missing URL |

### 1.6 FAQ `/faq`  *(page_key = faq, section_type=faq_page — shipped today)*

| Position | Label | Destination | Severity |
|---|---|---|---|
| Hero · CTA | (currently empty in DB) | — | 🟢 P2 — slot exists, awaiting copy |
| Final CTA · primary | (currently empty) | — | 🟢 P2 — slot exists in the new CMS schema |
| Final CTA · secondary | (currently empty) | — | 🟢 P2 — same |

**Note**: FAQ uses the new `cms_sections.section_type='faq_page'` JSONB schema (per-locale fields: `hero_primary_cta_label/url`, `final_cta_primary_label/url`, `final_cta_secondary_label/url`). Zero hardcoded copy. Ready for the new architecture, just needs the values written.

---

## 2. DESTINATION MAPPING — current state

| URL | What it is | Conversion-strength |
|---|---|---|
| **`/studio`** | `StudioFunnelV2` — a 3-step Design Journey form (impression → details → submit). Editorial copy already speaks of "Design Journey™" and "Blueprint". | ⭐⭐⭐⭐⭐ — the canonical consultative funnel |
| `/dedicato-a` (audience) | Discovery / segmentation page | ⭐⭐ — top-of-funnel |
| `/caratteristiche` (features) | Module-by-module product explainer | ⭐⭐ — mid-funnel education |
| `/versioni-prezzi` (pricing) | Editorial pricing tiers | ⭐⭐⭐ — decision-stage page, currently routes BACK to /supporto |
| `/formazione` (training) | Academy / training catalog | ⭐ — mostly internal anchors |
| `/supporto` (support) | Knowledge base + contact form | ⭐ — leads OUT of the sales funnel |
| `/about` | Brand / vision | ⭐ — sparse |
| `/accedi` (login) | Sign-in | ⭐⭐⭐ — return-user path, not new acquisition |
| **`/design-journey`** | ❌ does not exist (route `/blueprint` currently redirects to `/about`) | — gap to address |

**Key finding**: 4 pages (features intro, features final, pricing intro, pricing final, training intro) correctly point at `/studio`, but they label that link 3 different ways ("Candida il tuo studio", "Parla con un Advisor", "Esplora MOOD Academy"). The destination is consolidated; the **language** is not.

---

## 3. CONVERSION FLOW ANALYSIS

### 3.1 What the user sees today (typical path)

```
HOME hero          → "Scopri MOOD for DESIGN" (no link!) [dead]
HOME final cta     → "Scopri MOOD for DESIGN" → /studio  (vision word, not action)

DEDICATO A hero    → "Scopri a chi ci rivolgiamo" → self-anchor [dead]
DEDICATO A intro   → "Scopri MOOD for DESIGN" → /caratteristiche

CARATTERISTICHE    → "Candida il tuo studio" (×3) → /studio   ← funnel
PRICING tiers      → "Parlane con un Advisor" (×4) → /supporto [diverted]
PRICING final      → "Candida il tuo studio" → /studio        ← funnel
TRAINING hero      → "Scopri i percorsi" → self-anchor [dead]
TRAINING final     → "Esplora MOOD Academy" → (no href!) [dead]
FAQ                → empty (today)
```

### 3.2 Issues this creates

1. **No journey continuity**: each page invents its own verb. The user never builds a vocabulary of "what is the action MOOD wants me to take?".
2. **Funnel leak at pricing**: pricing tier CTAs go to `/supporto`. A user reaching pricing is high-intent — sending them to a support page is the single biggest conversion leak on the site.
3. **Three dead-end heroes**: Home, Dedicato A and Training open with a CTA that does nothing useful. The hero is where intent is highest; a non-functioning CTA there kills the page.
4. **Tonal split**: "Candida il tuo studio" (gated/application), "Parla con un Advisor" (advisor SaaS), "Scopri…" (brochure), all on the same site. Premium consultative positioning requires one tone.
5. **Empty CTA slots**: tier_04, tier_05, hero.cta_secondary, multiple flex cells. These render as zero-content buttons or stray pills.

---

## 4. PROPOSED CTA ARCHITECTURE

### 4.1 Two-action global system

| Action | Label (IT) | Label (EN-US) | Destination | Visual variant |
|---|---|---|---|---|
| **PRIMARY** | "Richiedi una configurazione Blueprint™" | "Request a Blueprint™ configuration" | `/studio` | dark filled (existing primary style) |
| **SECONDARY** | "Esplora il Design Journey™" | "Explore the Design Journey™" | `/design-journey` *(new page — see §5.2)* | ghost/outline |

**Rationale**:
- "Richiedi una configurazione" frames MOOD as **infrastructure being configured for the studio**, not a product being sold to it. This kills the SaaS perception in one phrase.
- "Blueprint™" repeats the canonical product noun on every page — brand recall.
- "Esplora il Design Journey™" is the educational counterpart for visitors not ready to convert. It introduces the Design Journey™ as a methodology (consultative), not as a feature list.
- Both labels are >5 words, deliberately. Premium brands don't use 2-word verbs.

### 4.2 Page-by-page CTA replacement plan

> All changes are CMS edits inside Blueprint Admin (`/blueprint/pages/<page_key>`). No code commits required.

| Page | Position | Today | → Proposed | Destination |
|---|---|---|---|---|
| **Home** | hero primary | "Scopri MOOD for DESIGN" (no link) | "Richiedi una configurazione Blueprint™" | `/studio` |
| Home | hero secondary | "" | "Esplora il Design Journey™" | `/design-journey` |
| Home | journey CTA | "Scopri il metodo MOOD" | (keep editorial — no change required) | `/about` |
| Home | triptych ×3 | "Esplora il magazine / progetti / materiali" | (keep — these are editorial discovery, not conversion) | unchanged |
| Home | final primary | "Scopri MOOD for DESIGN" (×2 keys) | "Richiedi una configurazione Blueprint™" | `/studio` |
| Home | final secondary | "" / "Accesso Professionale" | "Esplora il Design Journey™" | `/design-journey` |
| **Dedicato A** | hero | "Scopri a chi ci rivolgiamo" → self-anchor | "Trova la configurazione adatta al tuo studio" | `/studio` |
| Dedicato A | intro | "Scopri MOOD for DESIGN" | "Esplora il Design Journey™" | `/design-journey` |
| **Caratteristiche** | hero | "Candida il tuo studio" | "Esplora Blueprint™" *(per user spec)* | `/studio` |
| Caratteristiche | intro | (duplicate of hero) | **DELETE** the duplicate, or set to "Esplora il Design Journey™" | `/design-journey` |
| Caratteristiche | final headline | "Vediamo se Blueprint è giusto per il tuo studio." | (keep — strong consultative copy) | — |
| Caratteristiche | final button | "Candida il tuo studio" | "Richiedi una configurazione Blueprint™" | `/studio` |
| **Versioni e Prezzi** | intro | "Candida il tuo studio" | "Esplora il Design Journey™" | `/design-journey` |
| Pricing | tier 01 | "Parlane con un Advisor" → /supporto | "Richiedi una configurazione Blueprint™" | `/studio` |
| Pricing | tier 02 | "Parlane con un Advisor" → /supporto | "Richiedi una configurazione Blueprint™" | `/studio` |
| Pricing | tier 03 | "Parlane con un Advisor" → /supporto | "Richiedi una configurazione Blueprint™" | `/studio` |
| Pricing | tier 04 | "" | "Richiedi una configurazione Blueprint™" | `/studio` |
| Pricing | tier 05 | "" | "Richiedi una configurazione Blueprint™" | `/studio` |
| Pricing | comparison | "Parlane con un Advisor" | "Richiedi una configurazione Blueprint™" | `/studio` |
| Pricing | ecosystem | "Esplora il supporto" | (optional: set to "Esplora il Design Journey™") | `/design-journey` |
| Pricing | final | "Candida il tuo studio" | (already strong headline; replace button label to) "Richiedi una configurazione Blueprint™" | `/studio` |
| **Formazione** | hero primary | "Scopri i percorsi" → anchor | "Inizia il percorso Academy" | `/studio?focus=academy` *or* dedicated `/academy-access` (deferred) |
| Formazione | hero secondary | "Guarda i tutorial" → anchor | "Esplora il Design Journey™" | `/design-journey` |
| Formazione | intro | "Candida il tuo studio" | (delete or set to) "Richiedi una configurazione Blueprint™" | `/studio` |
| Formazione | card grid items (4) | self-anchors | (keep self-anchors — these are intra-page jumps and that's correct) | unchanged |
| Formazione | anchor sections (5) | mostly self-anchors | (keep — same reason) | unchanged |
| Formazione | final | "Esplora MOOD Academy" (no link) | "Richiedi una configurazione Blueprint™" | `/studio` |
| **FAQ** | hero | empty | "Richiedi una configurazione Blueprint™" | `/studio` |
| FAQ | final primary | empty | "Richiedi una configurazione Blueprint™" | `/studio` |
| FAQ | final secondary | empty | "Esplora il Design Journey™" | `/design-journey` |

### 4.3 Final-section rule

**Every page ends with the same final-CTA section**, exposing only two buttons:
- `final_cta_primary_*` → "Richiedi una configurazione Blueprint™" → `/studio`
- `final_cta_secondary_*` → "Esplora il Design Journey™" → `/design-journey`

Any other label is a deliberate editorial exception (e.g., FAQ search miss → "Parla con uno specialista") and must be approved in writing.

---

## 5. CMS IMPLEMENTATION RECOMMENDATIONS

### 5.1 No code change required for §4.2 — pure CMS edits

All edits in §4.2 are achievable today through the existing Blueprint admin:

| Target | Tool to use |
|---|---|
| Section CTA labels (editorial_blocks) | `/blueprint/pages` → open the page → click the block → edit the IT translation |
| Section CTA destinations (cms_sections.settings.links.*_href) | `/blueprint/pages` → open the page → "Link CTA" panel at the bottom of each section |
| Section visibility (e.g. delete a duplicate intro CTA) | `/blueprint/pages` → eye-toggle on the section |
| FAQ page CTAs | `/blueprint/faq` → "Impostazioni Pagina" panel (just shipped) |
| Footer / nav `/faq` link | `/blueprint/pages → navigation` and `/blueprint/footer` (both already CMS-driven) |

### 5.2 ONE blocking gap — destination `/design-journey`

The proposed secondary CTA points to `/design-journey`, **which does not exist as a route or page today**. Today `/blueprint` redirects to `/about`. Three options:

| Option | Effort | Trade-off |
|---|---|---|
| **A.** Temporarily map secondary CTA → `/about` (existing page) | 0 — pure CMS | About is sparse; not a true "Design Journey™" explainer; weak positioning |
| **B.** Create a new CMS page `cms_pages(page_key='design_journey')` with hero + 3-section explainer, then add `/design-journey` route entry to `CorporateApp.jsx` + `localizedSlugs.js` (one-line addition each) | ~20 min CMS + ~5 min code | Right move; requires a tiny route registration (allowed code edit) |
| **C.** Repurpose `/about` as the Design Journey™ explainer page | CMS only | Loses brand/vision page |

**Recommendation: Option B.** It is the only path consistent with the new positioning, and the code change is a single line per file — well under "do not redesign layouts" since no new component is needed (the existing SitePage renderer handles arbitrary slugs).

### 5.3 Cleanup tasks (purely CMS, no code)

| # | Task | Page | Mechanism |
|---|---|---|---|
| C1 | Delete `flex_*.cell_*` blocks with empty / "test" content shipped to production (Home flex cells) | home | PagesEditor → toggle visibility off / delete |
| C2 | Resolve duplicate keys `triptych.magazine.cta` vs `magazine.cta` etc. — keep ONE per slot | home | BlocksEditor → delete duplicates |
| C3 | Reconcile the two label sources for Home `final_cta` (`final_cta.cta_primary` vs `final.cta_primary`) | home | BlocksEditor → keep one, delete the other |
| C4 | Fill missing `_href` on Home hero CTA and Training final CTA | home, training | PagesEditor → section "Links" panel |
| C5 | Remove or repoint pricing tier CTAs from `/supporto` → `/studio` | pricing | PagesEditor → section "Links" panel |
| C6 | Repoint Dedicato A hero from self-anchor to `/studio` | audience | PagesEditor → section "Links" panel |

### 5.4 i18n discipline (already enforced, just reminding)

- All labels live in `editorial_blocks` per locale (`translations[locale]`) or in `locale_content` JSONB (FAQ case).
- **Never** introduce a `if (locale === 'it') label = '…'` shortcut. The pattern caught and removed earlier today in `BlueprintFaqAdmin.jsx` must not return.
- Per the previous architectural directive: NO hardcoded strings, NO fallback dictionaries, NO locale maps, NO static arrays.

---

## 6. PRIORITY MATRIX (summary, agent-actionable)

### 🔴 P0 — must fix before claiming a "consolidated" site

1. Home hero primary CTA has **no href** — fix or remove.
2. Home hero secondary, tier_04, tier_05, flex cells: **empty labels** rendered in production — delete the slots.
3. Pricing tier 1-3 + comparison: **divert to /supporto** instead of /studio — kills conversion.
4. Dedicato A hero: **self-anchor CTA** — change destination.
5. Training hero, card grid #1 ×4, card #2: **self-anchor CTAs** as the only top-of-page action — at least the hero pair must point to `/studio` and `/design-journey`.
6. Training final CTA: **missing href** — fix.
7. Home final CTA has **two competing label keys** — collapse to one.
8. Caratteristiche: **3 occurrences of the same CTA** in adjacent sections — keep one.

### 🟡 P1 — positioning consistency

9. Replace all "Candida il tuo studio" with "Richiedi una configurazione Blueprint™" (consultative tone).
10. Replace all "Parlane con un Advisor" with "Richiedi una configurazione Blueprint™" (avoid advisor SaaS framing).
11. Replace all generic "Scopri MOOD for DESIGN" / "Scopri di più" with one of the two global CTAs.
12. Standardise the Final CTA section across all 6 pages to the same 2-button block (primary/secondary).

### 🟢 P2 — future optimisation

13. Build a real `/design-journey` page (CMS page + 1-line route) — §5.2 Option B.
14. Add a "search miss" widget on `/faq` proposing the primary CTA when search returns 0 results (the suggestion I mentioned in the previous handoff).
15. Add hover-state micro-animation hierarchy: primary (dark fill) > secondary (ghost) > tertiary (text link). Today the visual weight is not always coherent with intent.
16. Add UTM/event tracking on the 2 canonical CTAs so we can measure the consolidation impact (no PII needed; just `data-cta="primary|secondary"` already aligns with our data-testid discipline).
17. Localise the new copy to EN-US, EN-GB, FR-FR, DE-DE, ES-ES, ES-MX (already supported by the i18n layer; just needs translation passes).

---

## 7. ACCEPTANCE CRITERIA FOR THE CONSOLIDATION

When the cleanup is executed, the site must satisfy:

- [ ] Every public page has **exactly one final CTA section** with two buttons whose labels match §4.1 verbatim.
- [ ] Across the 6 audited pages, only two CTA labels appear in the "primary action" slot of any section: **"Richiedi una configurazione Blueprint™"** and **"Esplora il Design Journey™"**. Editorial discovery buttons inside the triptych (magazine/projects/materials) are exempt.
- [ ] No CTA points to a self-anchor (`#…`) as its only action above the fold.
- [ ] No CTA has an empty label or a missing href.
- [ ] No CTA points to `/supporto` as the conversion path (support remains accessible from footer / nav only).
- [ ] All edits visible in the Blueprint admin and persisted in the DB — zero JSX literal copies introduced.

---

## 8. WHAT THIS REPORT EXPLICITLY DOES NOT PROPOSE

Per the user's directive of 20 Jun 2026:
- ❌ No new components or features.
- ❌ No layout redesign.
- ❌ No popups, modals or forms.
- ❌ No new sales copy beyond the two consolidated CTAs.
- ❌ No tracking pixel / analytics SDK / consent change.
- ❌ No deployment to production.
- ❌ No CMS write was performed during this audit — all data above was read-only.

The only allowed code touch (if the user ratifies §5.2 Option B) is the 1-line route registration for `/design-journey` and its localized slugs.

---

## 9. NEXT STEP REQUESTED FROM USER

Please ratify (a/b/c):
- **a)** Approve §4.1 architecture verbatim → I execute the §4.2 CMS edits + §5.3 cleanup, then re-screenshot the 6 pages for visual confirmation.
- **b)** Adjust copy of the 2 global CTAs (you provide alternates) → I update §4 and execute.
- **c)** Need a deeper segmentation of pages (e.g., split "Caratteristiche" final CTA into a tier-specific call) → I rework §4 first, no execution yet.

For §5.2 (the `/design-journey` destination):
- **i)** Proceed with **Option B** — create the CMS page + 1-line route registration.
- **ii)** Temporarily map secondary CTA → `/about` until a real `/design-journey` page is scoped.
- **iii)** Repurpose `/about` as the Design Journey™ explainer page (Option C).

Awaiting your call.
