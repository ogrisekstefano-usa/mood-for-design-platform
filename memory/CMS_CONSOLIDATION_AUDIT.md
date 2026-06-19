# CMS CONSOLIDATION AUDIT
**Sprint:** CMS Consolidation & Multilingual Governance  
**Data:** Febbraio 2026  
**Stato:** ✅ Sprint Completato

---

## INVENTARIO SEZIONI — TUTTE LE ROUTE PUBBLICHE

### `/` — HomePage
| Sezione | Componente | Stato CMS | Section Type DB |
|---------|-----------|-----------|-----------------|
| Hero | `Hero` | ✅ CMS-Driven | `hero_editorial` |
| Trust Strip | `TrustStrip` | ✅ CMS-Driven | `trust_marquee` |
| How It Works | `HowItWorks` | ✅ CMS-Driven | `design_journey` |
| Editorial Statement | `EditorialStatement` | ✅ CMS-Driven | `atmosphere_statement` |
| Design Stories | `DesignStories` | ✅ CMS-Driven | `featured_design_journeys` |
| Digital Journey Highlight | `DigitalJourneyHighlight` | ✅ CMS-Driven | `design_journey` (hl_* fields) |
| Magazine | `Magazine` | ✅ CMS-Driven | `editorial_grid` |
| Final CTA | `FinalCTA` | ✅ CMS-Driven | `cinematic_quote` |
| Header Nav | `MoodSiteHeader` | ✅ CMS-Driven | `nav_top` (navigation page) |
| Footer | `MoodSiteFooter` | ✅ CMS-Driven | `editorial_footer` + `nav_top` |

### `/about` — AboutPage
| Sezione | Componente | Stato CMS |
|---------|-----------|-----------|
| Hero | `AboutHero` | ✅ CMS-Driven |
| Manifesto | `AboutManifesto` | ✅ CMS-Driven |
| Approach | `ApproachSection` | ✅ CMS-Driven |
| Design Journeys | `AboutDesignJourneys` | ✅ CMS-Driven |
| Quote | `AboutQuote` | ✅ CMS-Driven |
| Press | `AboutPress` | ✅ CMS-Driven |
| Final CTA | `AboutFinalCTA` | ✅ CMS-Driven |

### `/services` — ServicesPage
| Sezione | Componente | Stato CMS |
|---------|-----------|-----------|
| Hero | `ServicesHero` | ✅ CMS-Driven |
| Triptych | `ServicesTriptych` | ✅ CMS-Driven |
| Atmosphere | `ServicesAtmosphere` | ✅ CMS-Driven |
| Process | `ServicesProcess` | ✅ CMS-Driven |
| Final CTA | `ServicesFinalCTA` | ✅ CMS-Driven |

### `/professionals` — ProfessionalsGatewayPage
| Sezione | Componente | Stato CMS | Note |
|---------|-----------|-----------|------|
| Hero | `ProHero` | ✅ CMS-Driven | |
| Manifesto | `ProManifesto` | ✅ CMS-Driven | |
| 6 Partner Types | `ProTriptych` | ✅ CMS-Driven | **Migrato da PARTNER_TYPES hardcoded** |
| Process | `ProProcess` | ✅ CMS-Driven | |
| Case Studies | `PartnerCasesSection` | ✅ CMS-Driven | **Migrato da CASE_STUDIES hardcoded** |
| Collaborators | `ProCollaborators` | ✅ CMS-Driven | |
| Final CTA | `ProFinalCTA` | ✅ CMS-Driven | |

### `/partner-application` — PartnerApplicationPage
| Sezione | Componente | Stato CMS | Note |
|---------|-----------|-----------|------|
| Hero | Inline | ✅ CMS-Driven | **Migrato da `copy` hardcoded** |
| Hero Image | `<img>` | ✅ CMS-Driven | Via `settings.bg_image` |
| Success Message | Inline | ✅ CMS-Driven | Via `hero_editorial.locale_content` |
| Form Labels | `FORM_LABELS` | ⚠️ P2 — i18n object | Locale-aware, non editoriale |
| Dropdown Options | `ROLES`, `COLLAB_TYPES`, `INTERESTS` | ⚠️ P2 | Enum funzionale, non editoriale |

### `/begin-journey` — BeginJourneyPage
| Sezione | Componente | Stato CMS |
|---------|-----------|-----------|
| Tutta la pagina | `EditorialBundleProvider` | ✅ CMS-Driven |
| Email status hints | Inline | ⚠️ P2 — hardcoded hint strings |

### Navigazione Globale
| Elemento | Componente | Stato CMS |
|---------|-----------|-----------|
| Logo | `MoodSiteHeader` | ✅ CMS-Driven |
| Nav Links | `MoodSiteHeader` | ✅ CMS-Driven |
| CTA Label+Href | `MoodSiteHeader` | ✅ CMS-Driven |
| Login Label | `MoodSiteHeader` | ✅ CMS-Driven |
| Footer Cols | `MoodSiteFooter` | ✅ CMS-Driven |
| Footer Logo | `MoodSiteFooter` | ✅ CMS-Driven |
| Footer Socials | `MoodSiteFooter` | ✅ CMS-Driven |
| Locale Picker Label | `MoodSiteFooter` | ✅ CMS-Driven |
| Footer Nav Title | `MoodSiteFooter` | ✅ CMS-Driven |

---

## ROUTE NON ANCORA AUDITATE (P2)
- `/projects` (ProjectsIndexPage)
- `/magazine` (MagazinePage)
- `/consulenza` (ConsulenzaPage)
- `/access` (AccessPage)

---

## POLICY APPLICATA
✅ `if (!sec) return null` — ZERO fallback hardcoded  
✅ Ogni sezione pubblica usa `locale_content` per tutte le lingue  
✅ Locales supportati: IT, EN-US, EN-GB, FR-FR, DE-DE, ES-ES  
