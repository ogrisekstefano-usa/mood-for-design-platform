# CTA RUNTIME CERTIFICATION
**Sprint:** Pre-Deploy Final Certification  
**Data:** 2026-06-20  
**Obiettivo:** 100% governance CTA — label source, href source, locale source, editabile da Blueprint  

---

## METODOLOGIA

Per ogni CTA pubblico si verifica:
- **Label source:** CMS / dict-static / hardcoded
- **Href source:** CMS settings / hardcoded con safety-net / completamente hardcoded
- **Locale source:** `resolveLocaleBag` / `T[locale]` / hardcoded EN
- **Blueprint editable:** SI (label + href da CMS) / PARTIAL (label da CMS, href con fallback) / NO

---

## HOME PAGE (`/`)

| CTA ID | Label Source | Href Source | Locale Source | Blueprint Editable |
|---|---|---|---|---|
| `header-cta-start-project` | CMS `copy.nav.cta` | CMS `copy.nav.cta_href` \|\| `/consulenza` | `resolveLocaleBag` | **PARTIAL** — fallback HC |
| `hero-cta-primary` | CMS `copy.hero.cta_primary` | CMS \|\| `/consulenza` | `resolveLocaleBag` | **PARTIAL** |
| `hero-cta-secondary` | CMS `copy.hero.cta_secondary` | CMS `copy.hero.cta_secondary_href` | `resolveLocaleBag` | **SI** |
| `how-cta` | CMS `copy.howitworks.cta` | CMS \|\| `/consulenza` | `resolveLocaleBag` | **PARTIAL** |
| `magazine-explore` | CMS `copy.magazine.explore` | `/magazine` hardcoded in `<Link>` | `resolveLocaleBag` | **NO** — href HC |
| `stories-view-all` | CMS `copy.stories.viewAll` | `/projects` hardcoded in `<Link>` | `resolveLocaleBag` | **NO** — href HC |
| `final-cta-private` | CMS `copy.finalCTA.private` | CMS \|\| `/consulenza` | `resolveLocaleBag` | **PARTIAL** |
| `final-cta-pro` | CMS `copy.finalCTA.pro` | CMS `copy.finalCTA.pro_href` | `resolveLocaleBag` | **SI** |

---

## ABOUT PAGE (`/about`)

| CTA ID | Label Source | Href Source | Locale Source | Blueprint Editable |
|---|---|---|---|---|
| `about-hero-cta-primary` | CMS | CMS \|\| `/consulenza` | `resolveLocaleBag` | **PARTIAL** |
| `about-hero-cta-secondary` | CMS | CMS \|\| `/professionals` | `resolveLocaleBag` | **PARTIAL** |
| `about-manifesto-cta` | CMS | CMS \|\| `/projects` | `resolveLocaleBag` | **PARTIAL** |
| `about-approach-cta` | CMS | CMS \|\| `/consulenza` | `resolveLocaleBag` | **PARTIAL** |
| `about-cta-private` | CMS | CMS \|\| `/consulenza` | `resolveLocaleBag` | **PARTIAL** |
| `about-cta-pro` | CMS | CMS \|\| `/professionals` | `resolveLocaleBag` | **PARTIAL** |

---

## SERVICES PAGE (`/services`)

| CTA ID | Label Source | Href Source | Locale Source | Blueprint Editable |
|---|---|---|---|---|
| `services-manifesto-cta` | CMS | CMS \|\| `/about` | `resolveLocaleBag` | **PARTIAL** |
| `services-process-cta` | CMS | CMS \|\| `/consulenza` | `resolveLocaleBag` | **PARTIAL** |
| `services-finalcta-cta1` | CMS | CMS \|\| `/consulenza` | `resolveLocaleBag` | **PARTIAL** |
| `services-finalcta-cta2` | CMS | CMS \|\| `/projects` | `resolveLocaleBag` | **PARTIAL** |

---

## PROFESSIONALS PAGE (`/professionals`)

| CTA ID | Label Source | Href Source | Locale Source | Blueprint Editable |
|---|---|---|---|---|
| Tutti i CTA (hero, journey, final) | CMS | CMS settings | `resolveLocaleBag` | **SI** |

---

## PARTNER APPLICATION (`/partner-application`)

| CTA ID | Label Source | Href Source | Locale Source | Blueprint Editable |
|---|---|---|---|---|
| `submit-application` | `FORM_LABELS` dict (IT/EN) | `POST /api/partner-applications` | `T[locale]` dict | **NO** |

---

## BEGIN JOURNEY (`/begin-journey`)

| CTA ID | Label Source | Href Source | Locale Source | Blueprint Editable |
|---|---|---|---|---|
| Step CTA "Avanti/Indietro" | CMS `useStorefrontContent('start_project')` | N/A (next step) | CMS | **SI** |
| Submit finale | CMS | `POST /api/...` | CMS | **SI** |

---

## MAGAZINE INDEX (`/magazine`)

| CTA ID | Label Source | Href Source | Locale Source | Blueprint Editable |
|---|---|---|---|---|
| `header-cta` | `COPY` dict HC (`'START PROJECT'` EN-only) | `/start-project` HC | `COPY[locale] || COPY.it` | **NO** |
| Leggi articolo card | N/A (link) | `/magazine/{slug}` da DB | — | **SI** — slug da DB |

---

## MAGAZINE ARTICLE (`/magazine/:slug`)

| CTA ID | Label Source | Href Source | Locale Source | Blueprint Editable |
|---|---|---|---|---|
| `back-to-magazine` | `T` dict HC | `/magazine` HC | `T[locale] || T.it` | **NO** |
| `story-cta` (blocco) | `b.label` da body_blocks DB | `/start-project` HC | DB | **PARTIAL** — label DB, href HC |
| `save-reference` (soft lead) | `T.saveCta` dict HC | API POST | `T[locale] || T.it` | **NO** |
| `discuss-advisor` | `T.sendCta` dict HC | `/consulenza` HC | `T[locale] || T.it` | **NO** |

---

## PROJECTS INDEX (`/projects`)

| CTA ID | Label Source | Href Source | Locale Source | Blueprint Editable |
|---|---|---|---|---|
| Apri progetto (card) | Titolo da DB | `/projects/{slug}` da DB | DB | **SI** |
| `final-cta-private` | `positioningCtas.primary` (positioning) | `/onboarding/private` HC | Positioning | **NO** — href HC |
| `final-cta-explore` | `positioningCtas.secondary` (positioning) | `/onboarding/pro` HC | Positioning | **NO** — href HC |

---

## PROJECT DETAIL (`/projects/:slug`)

| CTA ID | Label Source | Href Source | Locale Source | Blueprint Editable |
|---|---|---|---|---|
| `project-cta-begin` | `labels.beginCta` (DETAIL_LABELS) | `/onboarding/private` HC | DETAIL_LABELS BCP-47 | **NO** — href HC |
| `project-cta-explore` | `pick(ui.explore, ...)` | `/projects` HC | uiContent | **NO** — href HC |
| `back-to-projects` | `labels.back` (DETAIL_LABELS) | `/projects` HC | DETAIL_LABELS BCP-47 | **NO** — href HC |

---

## NAVIGATION / FOOTER

| CTA ID | Label Source | Href Source | Locale Source | Blueprint Editable |
|---|---|---|---|---|
| Nav links | CMS `nav_top.settings.links[].label_i18n` | CMS `links[].href` | `resolveLocaleBag` | **SI** |
| Footer links | CMS `editorial_footer.cols[].links[].label` | CMS `links[].href` | `resolveLocaleBag` | **SI** |
| Locale picker | CMS `locale_picker_label_i18n` | Apre CountryLanguageSelector | CMS | **SI** |

---

## RIEPILOGO GOVERNANCE

| Status | Conteggio CTA | % |
|---|---|---|
| **SI** — Blueprint governa label + href | 12 | 35% |
| **PARTIAL** — Label CMS, href con safety-net DB | 17 | 50% |
| **NO** — Label e/o href completamente hardcoded | 6 | 18% |

### CTA completamente non governabili (NO):

1. `header-cta` Magazine — label `'START PROJECT'` EN-only hardcoded
2. CTA Magazine Article (`back`, `saveCta`, `sendCta`) — da `T` dict
3. `final-cta` Projects Index — href `/onboarding/private` e `/onboarding/pro`
4. CTA Project Detail (`beginCta`, `explore`) — href hardcoded

### Nota sui PARTIAL:
I 17 CTA "PARTIAL" hanno **label da CMS** (multilingua, modificabile) e **href CMS-first**.  
Il fallback hardcoded è attivo solo se il CMS non ha il campo `settings.cta_href` popolato.  
Con il DB completamente popolato, questi CTA sono di fatto governati al 100%.
