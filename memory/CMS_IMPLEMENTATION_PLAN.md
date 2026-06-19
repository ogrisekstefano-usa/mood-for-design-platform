# CMS IMPLEMENTATION PLAN
**Sprint:** CMS Consolidation & Multilingual Governance  
**Data:** Febbraio 2026

---

## COMPLETATO IN QUESTO SPRINT ✅

### Database
- [x] Aggiornato `professionals/editorial_triptych` con 6 partner types (IT/EN/FR/DE/ES)
- [x] Creata sezione `partner_case_studies` per pagina professionals (IT/EN + tutti i locales)
- [x] Creata pagina CMS `partner-application` con sezione `hero_editorial`
- [x] Aggiornato `home/design_journey` con campi `hl_*` (hl_title, hl_body, hl_eyebrow, hl_cta, hl_cta_href)
- [x] Aggiornato `home/cinematic_quote` con campi `contact_label`, `contact_link_label`
- [x] Aggiornato `navigation/nav_top.settings` con `locale_picker_label_i18n`, `footer_nav_title_i18n`
- [x] Verificato `editorial_grid.read_link` presente in IT/EN

### Frontend
- [x] `ProfessionalsGatewayPage.jsx` — rimosso `PARTNER_TYPES` (hardcoded array)
- [x] `ProfessionalsGatewayPage.jsx` — rimosso componente `PartnerTypesGrid` (JSX inline)
- [x] `ProfessionalsGatewayPage.jsx` — rimosso `CASE_STUDIES` (hardcoded array)
- [x] `ProfessionalsGatewayPage.jsx` — rimosso componente `PartnerCaseStudies` (JSX inline)
- [x] `ProfessionalsGatewayPage.jsx` — aggiunto `PartnerCasesSection` (100% CMS-driven)
- [x] `PartnerApplicationPage.jsx` — hero CMS-driven via `useStorefrontContent('partner-application')`
- [x] `PartnerApplicationPage.jsx` — hero image CMS-driven via `settings.bg_image`
- [x] `PartnerApplicationPage.jsx` — success message CMS-driven
- [x] `PartnerApplicationPage.jsx` — `copy` hardcoded sostituito con `FORM_LABELS` locale-aware
- [x] `HomePage.jsx` — `DigitalJourneyHighlight` usa CMS `hl_*` fields
- [x] `HomePage.jsx` — `FinalCTA` usa CMS `contact_label`, `contact_link_label`, `contact_href`
- [x] `HomePage.jsx` — `Magazine` usa CMS `read_cta`
- [x] `HomePage.jsx` — `DesignStories` usa CMS `discover_cta`
- [x] `HomePage.jsx` — mapper aggiornato per `read_cta`, `discover_cta`, `hl_*`, `contact_*`
- [x] `MoodSiteHeader.jsx` — `DEFAULT_COPY` sostituito con `useCmsNav()` hook
- [x] `MoodSiteHeader.jsx` — nav labels, CTA label/href, login label tutti CMS-driven
- [x] `MoodSiteFooter.jsx` — locale picker label CMS-driven
- [x] `MoodSiteFooter.jsx` — footer nav column title CMS-driven

---

## BACKLOG P1 (Prossimo Sprint)

1. **Traduzione FR/DE/ES** per sezioni principali (home hero, about, services)
   - Azione: Aggiungere `fr-FR`, `de-DE`, `es-ES` alle sezioni esistenti via Blueprint admin

2. **Projects/Magazine Pages audit**
   - File: `ProjectsIndexPage.jsx`, `MagazinePage.jsx`
   - Azione: Audit hardcoded + CMS seeding

3. **ConsulenzaPage audit**
   - File: `/consulenza`
   - Azione: Audit + CMS seeding

---

## BACKLOG P2

4. **Form labels CMS migration (PartnerApplicationPage)**
   - Creare CMS page `partner-application/form`
   - Tipo sezione: `form_labels`
   - Campi: nome, cognome, studio, email, telefono, ruolo, ruolo_ph, submit, privacy, error, required

5. **Email status hints (BeginJourneyPage)**
   - Aggiungere bundle keys: `email.status.checking`, `email.status.available`, `email.status.existing`, `email.status.invalid`

6. **es-MX locale support**
   - Aggiungere alias `es-MX` → `es-ES` nel resolver `bag()`

7. **Blueprint Admin CMS Editor per PartnerCasesSection**
   - Aggiungere sezione `partner_case_studies` ai section types editabili in `PagesAdminPage.jsx`

---

## ARCHITETTURA CMS

```
cms_pages (tenant_id, page_key)
    └── cms_sections (page_id, section_type, sort_order)
            ├── locale_content: { it: {...}, en-US: {...}, _default: {...} }
            └── settings: { hrefs, images, config }

Frontend Pattern:
const sec = sections.find(s => s.section_type === 'x');
if (!sec) return null;  ← ZERO fallback
const b = bag(sec, locale);  ← risolve locale_content
```

**Section Types usati:**
- `hero_editorial` — hero a due colonne
- `editorial_triptych` — 3-6 card editoriali
- `partner_case_studies` — 3 case study con immagine
- `design_journey` — processo a 4 step
- `atmosphere_statement` — manifesto testuale
- `cinematic_quote` — CTA finale dark
- `professionals_cta` — CTA collaboratori
- `editorial_footer` — footer con colonne
- `nav_top` — navigazione principale
- `trust_marquee` — strip loghi fiducia
- `editorial_grid` — griglia magazine
- `featured_design_journeys` — design stories
