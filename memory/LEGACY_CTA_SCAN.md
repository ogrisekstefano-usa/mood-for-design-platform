# LEGACY CTA SCAN — Riferimenti residui a `/begin-journey`

> Generato: 2026-06-16  
> Sprint: Content & Credibility Sprint  
> Obiettivo: zero riferimenti attivi a `/begin-journey` nel frontend pubblico

---

## RIEPILOGO ESECUTIVO

| Categoria | Occorrenze trovate | Stato |
|-----------|-------------------|-------|
| JSX hardcoded (frontend pubblico) | 5 | DA FIXARE → FIXATO |
| Fallback valori (mapCmsToCopy) | 3 | DA FIXARE → FIXATO |
| CMS DB (nav_top) | 1 | DA FIXARE → FIXATO |
| CMS DB (about page, 4 CTAs) | 4 | DA FIXARE → FIXATO |
| Seed scripts (riferimento archivio) | 4 | AGGIORNATI |
| Backend internal (log/metadata) | 8 | NON RICHIEDONO FIX (identificatori interni) |

---

## DETTAGLIO COMPLETO

### A — JSX Hardcoded — `HomePage.jsx` (Frontend Pubblico)

| # | Componente | Riga | Vecchio URL | Nuovo URL | Stato |
|---|-----------|------|-------------|-----------|-------|
| 1 | `SiteHeader` (desktop) | 217 | `/begin-journey` | `copy.nav.cta_href \|\| '/consulenza'` | ✅ FIXATO |
| 2 | `SiteHeader` (mobile menu) | 250 | `/begin-journey` | `copy.nav.cta_href \|\| '/consulenza'` | ✅ FIXATO |
| 3 | `Hero` (CTA primario) | 293 | `/begin-journey` | `copy.hero.cta_primary_href \|\| '/consulenza'` | ✅ FIXATO |
| 4 | `HowItWorks` (CTA processo) | 362 | `/begin-journey` | `copy.howitworks.cta_href \|\| '/consulenza'` | ✅ FIXATO |
| 5 | `FinalCTA` (path privato) | 619 | `/begin-journey` | `copy.finalCTA.private_href \|\| '/consulenza'` | ✅ FIXATO |

### B — Fallback valori — `mapCmsToCopy()` — `HomePage.jsx`

| # | Sezione | Riga | Fallback vecchio | Fallback nuovo | Stato |
|---|---------|------|-----------------|----------------|-------|
| 6 | `hero_editorial` | 749 | `'/begin-journey'` | `'/consulenza'` | ✅ FIXATO |
| 7 | `cinematic_quote` | 824 | `'/begin-journey'` | `'/consulenza'` | ✅ FIXATO |
| 8 | `useNavBundle` | 907 | `'/begin-journey'` | `'/consulenza'` | ✅ FIXATO |

### C — CMS Database

| # | Tabella | Campo | Pagina/Sezione | Vecchio valore | Nuovo valore | Stato |
|---|---------|-------|---------------|----------------|--------------|-------|
| 9 | `cms_sections` | `settings.cta.href` | `nav_top` (navigation) | `/begin-journey` | `/consulenza` | ✅ FIXATO + RIPUBBLICATO |
| 10 | `cms_sections` | `settings.cta_primary_href` | `about` → `hero_editorial` | `/begin-journey` | `/consulenza` | ✅ FIXATO + RIPUBBLICATO |
| 11 | `cms_sections` | `settings.cta_href` | `about` → `team_identity_card` | `/begin-journey` | `/consulenza` | ✅ FIXATO + RIPUBBLICATO |
| 12 | `cms_sections` | `settings.cta_href` | `about` → `design_journey` | `/begin-journey` | `/consulenza` | ✅ FIXATO + RIPUBBLICATO |
| 13 | `cms_sections` | `settings.private_href` | `about` → `cinematic_quote` | `/begin-journey` | `/consulenza` | ✅ FIXATO + RIPUBBLICATO |

### D — Seed Scripts (Archivio)

| # | File | Riga | Contesto | Azione |
|---|------|------|----------|--------|
| 14 | `seed_about_page.py` | 61, 112, 137, 232 | CTAs pagina about | ✅ AGGIORNATO |
| 15 | `seed_canonical_homepage.py` | 84, 213 | Fallback hero + final CTA | ✅ AGGIORNATO |
| 16 | `seed_demo_content.py` | 444 | Link nav demo | NON CRITICO (tenant non-studio) |

### E — Backend Internal (Non richiedono fix)

| File | Occorrenze | Motivo |
|------|-----------|--------|
| `journey_initiate.py` | 7 | Identificatori interni audit log (`begin_journey_ritual`, `onboarding_path`) — NON URL pubblici |
| `leads.py` | 1 | Commento docstring — NON codice attivo |
| `editorial_runtime.py` | 1 | Commento — NON codice attivo |
| `tenant_email_governance.py` | 1 | Commento descrittivo — NON URL pubblico |
| `ModuleRouteGuard.jsx` | 1 | Identificatore modulo interno sidebar — NON URL pubblico |
| `BeginJourneyPage.jsx` | 4 | La pagina stessa — la route `/begin-journey` ESISTE ancora come form di acquisizione lead |

---

## NOTE

- La route `/begin-journey` (form acquisizione lead) **rimane attiva** nel sistema — è la destinazione legacy per lead diretti. I fix riguardano SOLO i CTA del frontend pubblico che ora puntano uniformemente a `/consulenza`.
- Le occorrenze in `BeginPartnershipPage.jsx` e `JourneyWelcomePage.jsx` sono riferimenti alla classe CSS `begin-journey.css` (fogli di stile condivisi), non URL di navigazione.
- La pagina `HomePageLegacy.jsx` è deprecata e non usata in produzione.

---

**Risultato finale: 0 CTA pubblici attivi puntano a `/begin-journey`.**
