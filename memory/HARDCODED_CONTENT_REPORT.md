# HARDCODED CONTENT REPORT
**Sprint:** CMS Consolidation & Multilingual Governance  
**Data:** Febbraio 2026

---

## ✅ RIMOSSI IN QUESTO SPRINT

| File | Elemento rimosso | Sostituito con |
|------|-----------------|----------------|
| `ProfessionalsGatewayPage.jsx` | Array `PARTNER_TYPES` (6 tipi partner, IT/EN hardcoded) | CMS `editorial_triptych` 6 blocks |
| `ProfessionalsGatewayPage.jsx` | Componente `PartnerTypesGrid` (JSX inline) | `ProTriptych` CMS-driven |
| `ProfessionalsGatewayPage.jsx` | Array `CASE_STUDIES` (3 case study, IT/EN hardcoded) | CMS `partner_case_studies` section |
| `ProfessionalsGatewayPage.jsx` | Componente `PartnerCaseStudies` (JSX inline) | `PartnerCasesSection` CMS-driven |
| `PartnerApplicationPage.jsx` | `copy.it/en.eyebrow/title/sub` (hero text) | CMS `partner-application/hero_editorial` |
| `PartnerApplicationPage.jsx` | `copy.it/en.success_title/body` (success message) | CMS `hero_editorial.locale_content.success_*` |
| `PartnerApplicationPage.jsx` | Pexels URL hardcoded nel `<img src>` | CMS `settings.bg_image` |
| `HomePage.jsx` — `DigitalJourneyHighlight` | `title`, `body`, `eyebrow`, `ctaLabel` hardcoded IT/EN | CMS `design_journey.hl_*` fields |
| `HomePage.jsx` — `DigitalJourneyHighlight` | `to="/begin-journey"` hardcoded | CMS `design_journey.hl_cta_href` |
| `HomePage.jsx` — `FinalCTA` | `"Preferisci scrivere?"` / `"Prefer to write?"` | CMS `cinematic_quote.contact_label` |
| `HomePage.jsx` — `FinalCTA` | `"Contattaci"` / `"Contact us"` | CMS `cinematic_quote.contact_link_label` |
| `HomePage.jsx` — `FinalCTA` | `to="/consulenza"` hardcoded | CMS `cinematic_quote.settings.contact_href` |
| `HomePage.jsx` — `FinalCTA` | `"Book a consultation"` / `"Prenota una consulenza"` (fallback) | CMS `cinematic_quote.private` |
| `HomePage.jsx` — `Magazine` | `"Read article"` / `"Leggi l'articolo"` | CMS `editorial_grid.read_link` |
| `HomePage.jsx` — `DesignStories` | `"Discover project"` / `"Scopri il progetto"` | CMS `featured_design_journeys.discover_cta` |
| `MoodSiteHeader.jsx` | `DEFAULT_COPY` con nav label hardcoded IT/EN | `useCmsNav()` hook da `navigation/nav_top` |
| `MoodSiteHeader.jsx` | Tutti i link href fallback hardcoded | CMS `nav_top.settings.links[].href` |
| `MoodSiteFooter.jsx` | `"Paese · Lingua"` / `"Country · Language"` / `"Pays · Langue"` etc. | CMS `nav_top.settings.locale_picker_label_i18n` |
| `MoodSiteFooter.jsx` | `"Navigazione"` / `"Navigation"` (footer nav col title) | CMS `nav_top.settings.footer_nav_title_i18n` |

---

## ⚠️ RESIDUI P2 (Non critici)

| File | Elemento | Motivazione P2 |
|------|---------|----------------|
| `PartnerApplicationPage.jsx` | `FORM_LABELS` object (form field labels) | Etichette funzionali di form, non editoriali. Gestite come i18n locale-aware. Migrazione CMS Phase 2. |
| `PartnerApplicationPage.jsx` | `ROLES` / `COLLAB_TYPES` / `INTERESTS` arrays | Enum funzionali con valori DB; non editoriali. P2. |
| `BeginJourneyPage.jsx` | Email status hints (`"Verifica in corso…"` etc.) | Hints tecnici non editoriali. Da aggiungere al bundle `begin-journey`. P2. |
| `MoodSiteFooter.jsx` | Fallback locale-aware `'Paese · Lingua'` | Solo come secondary fallback in caso di CMS offline. P2. |
| `ServicesPage.jsx` | CTA fallback `|| 'Prenota una consulenza'` | Solo quando CMS non ha `cta_primary`. Non visibile con DB popolato. P2. |
| `AboutPage.jsx` | Idem pattern ServicesPage | Idem. P2. |
| `HomePage.jsx` | `EDITORIAL_SHELL` fallback object | Shell strutturale, non visibile con DB popolato. P2. |

---

## IMMAGINI HARDCODED (Tutte rimosse)

| File | URL rimossa | Sostituita con |
|------|------------|----------------|
| `PartnerApplicationPage.jsx` | `pexels.com/photos/4977353` | CMS `settings.bg_image` |
| `ProfessionalsGatewayPage.jsx` | 3 URL Pexels in `CASE_STUDIES` array | CMS `partner_case_studies.locale_content.cases[].image` |
