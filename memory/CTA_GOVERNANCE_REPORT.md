# CTA GOVERNANCE REPORT
**Sprint:** CMS Governance & Multilingual Completion  
**Data:** 2026-06-20  
**Scope:** Audit completo di tutti i CTA pubblici — label, URL, origine, traducibilità, editabilità Blueprint  
**Obiettivo:** Identificare tutti i CTA che non rispettano il modello CMS-Driven · Multi-Tenant · Multilingua · White-Label  

---

## Modello CTA Ideale

Un CTA conforme al modello CMS Governance deve soddisfare tutti e 4 i criteri:

| Criterio | Definizione |
|---|---|
| **CMS-Driven** | La label e l'URL provengono da `cms_sections.locale_content` o `cms_sections.settings` |
| **Multi-Tenant** | Il CTA può essere configurato diversamente per tenant differenti |
| **Multilingua** | La label CTA cambia in base al locale attivo (es: "Prenota" in IT, "Book" in EN-US) |
| **White-Label** | Il tenant può rinominare e reindirizzare il CTA senza modificare il codice |

**Conformità piena:** Label da `locale_content`, URL da `settings`, entrambi editabili in Blueprint.  
**Non conforme:** Label e/o URL hardcoded nel file `.jsx`.

---

## INVENTARIO CTA — HomePage (`/`)

| CTA ID | Posizione | Label (IT) | URL | Origine Label | Origine URL | Traducibile | Editabile Blueprint | Conforme |
|---|---|---|---|---|---|---|---|---|
| `header-cta-start-project` | Header fisso | `copy.nav.cta` (CMS) | `copy.nav.cta_href \|\| '/consulenza'` | **CMS** | CMS con fallback HC | **SI** | **SI** | **PARZIALE** |
| `header-cta-mobile` | Menu burger | `copy.nav.cta` (CMS) | `copy.nav.cta_href \|\| '/consulenza'` | **CMS** | CMS con fallback HC | **SI** | **SI** | **PARZIALE** |
| `hero-cta-primary` | Hero section | `copy.hero.cta_primary` (CMS) | `copy.hero.cta_primary_href \|\| '/consulenza'` | **CMS** | CMS con fallback HC | **SI** | **SI** | **PARZIALE** |
| `hero-cta-secondary` | Hero section | `copy.hero.cta_secondary` (CMS) | `copy.hero.cta_secondary_href` | **CMS** | **CMS** | **SI** | **SI** | **SI** |
| `how-cta` | "Come lavoriamo" | `copy.howitworks.cta` (CMS) | `copy.howitworks.cta_href \|\| '/consulenza'` | **CMS** | CMS con fallback HC | **SI** | **SI** | **PARZIALE** |
| `magazine-explore` | Magazine section | `copy.magazine.explore` (CMS) | `/magazine` (hardcoded nel Link) | **CMS** | **HARDCODED** | **SI** | NO | **NO** |
| `stories-view-all` | Design stories | `copy.stories.viewAll` (CMS) | `/projects` (hardcoded nel Link) | **CMS** | **HARDCODED** | **SI** | NO | **NO** |
| `final-cta-private` | Final CTA | `copy.finalCTA.private` (CMS) | `copy.finalCTA.private_href \|\| '/consulenza'` | **CMS** | CMS con fallback HC | **SI** | **SI** | **PARZIALE** |
| `final-cta-pro` | Final CTA | `copy.finalCTA.pro` (CMS) | `copy.finalCTA.pro_href` | **CMS** | **CMS** | **SI** | **SI** | **SI** |
| Footer nav links | Footer | `L(l.label, fullLocale)` (CMS) | `l.href` (CMS) | **CMS** | **CMS** | **SI** | **SI** | **SI** |

---

## INVENTARIO CTA — AboutPage (`/about`)

| CTA ID | Posizione | Label | URL | Origine Label | Origine URL | Traducibile | Editabile Blueprint | Conforme |
|---|---|---|---|---|---|---|---|---|
| `about-hero-cta-primary` | Hero | `bag.cta_primary` (CMS) | `settings.cta_primary_href \|\| '/consulenza'` | **CMS** | CMS con fallback HC | **SI** | **SI** | **PARZIALE** |
| `about-hero-cta-secondary` | Hero | `bag.cta_secondary` (CMS) | `settings.cta_secondary_href \|\| '/professionals'` | **CMS** | CMS con fallback HC | **SI** | **SI** | **PARZIALE** |
| `about-manifesto-cta` | Manifesto | `bag.cta` (CMS) | `settings.cta_href \|\| '/projects'` | **CMS** | CMS con fallback HC | **SI** | **SI** | **PARZIALE** |
| `about-approach-cta` | Approach | `bag.cta` (CMS) | `settings.cta_href \|\| '/consulenza'` | **CMS** | CMS con fallback HC | **SI** | **SI** | **PARZIALE** |
| `about-cta-private` | Final CTA | `bag.private` (CMS) | `settings.private_href \|\| '/consulenza'` | **CMS** | CMS con fallback HC | **SI** | **SI** | **PARZIALE** |
| `about-cta-pro` | Final CTA | `bag.pro` (CMS) | `settings.pro_href \|\| '/professionals'` | **CMS** | CMS con fallback HC | **SI** | **SI** | **PARZIALE** |

---

## INVENTARIO CTA — ServicesPage (`/services`)

| CTA ID | Posizione | Label | URL | Origine Label | Origine URL | Traducibile | Editabile Blueprint | Conforme |
|---|---|---|---|---|---|---|---|---|
| `services-manifesto-cta` | Manifesto | `bag.cta` (CMS) | `settings.cta_href \|\| '/about'` | **CMS** | CMS con fallback HC | **SI** | **SI** | **PARZIALE** |
| `services-process-cta` | Process | `bag.cta` (CMS) | `settings.cta_href \|\| '/consulenza'` | **CMS** | CMS con fallback HC | **SI** | **SI** | **PARZIALE** |
| `services-finalcta-cta1` | Final CTA | `bag.private` (CMS) | `settings.private_href \|\| '/consulenza'` | **CMS** | CMS con fallback HC | **SI** | **SI** | **PARZIALE** |
| `services-finalcta-cta2` | Final CTA | `bag.pro` (CMS) | `settings.pro_href \|\| '/projects'` | **CMS** | CMS con fallback HC | **SI** | **SI** | **PARZIALE** |

---

## INVENTARIO CTA — ProfessionalsGatewayPage (`/professionals`)

| CTA ID | Posizione | Label | URL | Origine Label | Origine URL | Traducibile | Editabile Blueprint | Conforme |
|---|---|---|---|---|---|---|---|---|
| Tutti i CTA | Varie sezioni | Da `resolveLocaleBag` (CMS) | Da `settings.*` (CMS) | **CMS** | **CMS** | **SI** | **SI** | **SI** |

> **Nota:** `ProfessionalsGatewayPage` è il file più conforme — nessun hardcoding rilevato post-refactoring.

---

## INVENTARIO CTA — PartnerApplicationPage (`/partner-application`)

| CTA ID | Posizione | Label | URL | Origine Label | Origine URL | Traducibile | Editabile Blueprint | Conforme |
|---|---|---|---|---|---|---|---|---|
| Submit form | Form | `c.submit` (FORM_LABELS statico) | `POST /api/partner-applications` | **HARDCODED** | N/A (API call) | Parziale (2 lingue) | NO | **NO** |

---

## INVENTARIO CTA — Navigation (Header/Footer)

| CTA ID | Posizione | Label | URL | Origine Label | Origine URL | Traducibile | Editabile Blueprint | Conforme |
|---|---|---|---|---|---|---|---|---|
| Nav links | Header top | `L(label_i18n, locale)` da `nav_top.settings.links` | `l.href` da CMS | **CMS** | **CMS** | **SI** | **SI** | **SI** |
| Footer locale picker | Footer | `localPickerLabel` (CMS) con fallback `'Country · Language'` | Apre CountryLanguageSelector | **CMS** | N/A | **SI** | **SI** | **SI** |
| Footer nav links | Footer | `L(l.label, fullLocale)` (CMS) | `l.href` (CMS) | **CMS** | **CMS** | **SI** | **SI** | **SI** |

---

## RIEPILOGO CONFORMITÀ

| Stato | Count CTA | %  |
|---|---|---|
| **CONFORME** (CMS-Driven + Multi-Tenant + Multilingua + White-Label) | 8 | 30% |
| **PARZIALE** (Label CMS, URL con fallback hardcoded) | 17 | 63% |
| **NON CONFORME** (Label o URL completamente hardcoded) | 3 | 11% |

---

## CTA NON CONFORMI — Dettaglio

### NC-1: `magazine-explore` (HomePage)
- **Problema:** URL `/magazine` hardcoded nel `<Link to="/magazine">`
- **Fix:** Aggiungere `settings.explore_href` al CMS section `magazine_highlights`
- **Impatto:** Basso (URL non cambierà mai per questo tenant), ma non white-label

### NC-2: `stories-view-all` (HomePage)
- **Problema:** URL `/projects` hardcoded nel `<Link to="/projects">`
- **Fix:** Aggiungere `settings.view_all_href` al CMS section `featured_design_journeys`
- **Impatto:** Basso, ma non white-label

### NC-3: Submit Form Partner Application
- **Problema:** Label "Invia candidatura" / "Submit application" da `FORM_LABELS` dict statico
- **Fix:** Creare sezione `form_labels` CMS per `partner-application`
- **Impatto:** Medio — tenant non può personalizzare il CTA del form

---

## CTA PARZIALI — Pattern comune

Tutti i 17 CTA "PARZIALI" seguono il pattern:
```jsx
<Link to={settings.cta_href || '/consulenza'}>
```

**Analisi:**
- **La label è già CMS-driven** — conforme per multilingua e white-label
- **L'URL è CMS-first** — conforme se il DB ha `settings.cta_href` popolato
- **Il fallback hardcoded** è un safety net tecnico, non un bypass del CMS
- **Raccomandazione:** Verificare che tutte le sezioni in produzione abbiano `settings.cta_href` popolato. Se il DB è completo, questi CTA sono di fatto conformi.

---

## AZIONI PRIORITARIE

| Priorità | Azione | File | Impatto |
|---|---|---|---|
| P1 | Popolare `settings.cta_href` in tutte le sezioni che ancora hanno NULL | Blueprint UI | Rende i 17 "PARZIALI" completamente conformi |
| P1 | Migrare `FORM_LABELS` su CMS `form_labels` section | `PartnerApplicationPage.jsx` | Risolve NC-3 |
| P2 | Aggiungere `settings.explore_href` a `magazine_highlights` | Blueprint + CMS | Risolve NC-1 |
| P2 | Aggiungere `settings.view_all_href` a `featured_design_journeys` | Blueprint + CMS | Risolve NC-2 |
| P3 | Audit e verifica di `ConsulenzaPage.jsx` e `BeginJourneyPage.jsx` | — | Completamento audit |
