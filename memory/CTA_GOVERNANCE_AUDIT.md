# CTA GOVERNANCE AUDIT
**Sprint:** CMS Consolidation & Multilingual Governance  
**Data:** Febbraio 2026

---

## MAPPATURA COMPLETA CTA — PAGINE PUBBLICHE

### CTA Primarie
| Testo IT | Testo EN | Destinazione | Provenienza CMS | Stato |
|----------|----------|-------------|-----------------|-------|
| Prenota una consulenza | Book a consultation | `/consulenza` | `hero_editorial.cta_primary` / `nav_top.settings.cta` | ✅ CMS |
| Compila il brief | Fill in the brief | `/begin-journey` | `design_journey.hl_cta` + `hl_cta_href` | ✅ CMS |
| Scopri il processo | Discover the process | `/about` | `design_journey.cta` + `settings.links.cta_href` | ✅ CMS |
| Candidati come partner | Apply as partner | `/partner-application` | `professionals_cta.locale_content` | ✅ CMS |
| Invia la tua candidatura | Submit your application | `#form` | `partner-application/hero_editorial.cta_primary` | ✅ CMS |

### CTA Secondarie
| Testo IT | Testo EN | Destinazione | Provenienza CMS | Stato |
|----------|----------|-------------|-----------------|-------|
| Rientra / Accedi | Re-enter / Sign in | `/access` | `nav_top.settings.login.label_i18n` | ✅ CMS |
| Contattaci | Contact us | `/consulenza` | `cinematic_quote.contact_link_label` + `settings.contact_href` | ✅ CMS |
| Esplora tutti gli articoli | Explore all articles | `/magazine` | `editorial_grid.explore` | ✅ CMS |
| Scopri il progetto | Discover project | `/projects/:slug` | `featured_design_journeys.discover_cta` | ✅ CMS |
| Leggi l'articolo | Read the article | `/magazine/:slug` | `editorial_grid.read_link` | ✅ CMS |

### CTA Navigation
| Elemento | Destinazione | Provenienza CMS | Stato |
|---------|-------------|-----------------|-------|
| Come lavoriamo | `/#how-it-works` | `nav_top.settings.links[how_it_works]` | ✅ CMS |
| Magazine | `/magazine` | `nav_top.settings.links[magazine]` | ✅ CMS |
| Progetti | `/projects` | `nav_top.settings.links[design_stories]` | ✅ CMS |
| Chi siamo | `/about` | `nav_top.settings.links[about]` | ✅ CMS |
| Per i professionisti | `/professionals` | `nav_top.settings.links[professionals]` | ✅ CMS |

### CTA Footer
| Elemento | Destinazione | Provenienza CMS | Stato |
|---------|-------------|-----------------|-------|
| Tutti i link footer | vari | `editorial_footer.cols[].links` | ✅ CMS |
| Social links | vari | `editorial_footer.settings.social_links` | ✅ CMS |

---

## CTA GOVERNANCE MODEL

```
CTA = { label: CMS locale_content, href: CMS settings }
```

**Regola universale:**
- `label` → sempre da `locale_content.{locale}` → multilingua
- `href` → sempre da `settings.{field}_href` → white-label
- ZERO testo hardcoded nel frontend

**DB Path Convention:**
```
cinematic_quote.locale_content.it.cta_label  → "Prenota una consulenza"
cinematic_quote.settings.cta_href            → "/consulenza"
```
