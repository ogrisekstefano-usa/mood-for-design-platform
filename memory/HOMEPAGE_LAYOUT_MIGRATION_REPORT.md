# HOMEPAGE LAYOUT MIGRATION REPORT
## Versione 2 — Layout Editoriale Premium
**Data**: Giugno 2026  
**Sprint**: HOMEPAGE LAYOUT CONSOLIDATION SPRINT  
**Stato**: ✅ COMPLETATO — 100% test superati

---

## 1. Obiettivo del Sprint

Trasformare la homepage pubblica da layout SaaS ("MOOD for DESIGN™ platform") a layout editoriale premium per uno studio di interior design internazionale.

**Success Criterion**: Quando si apre la homepage, la percezione deve essere:  
> *"Sto entrando nel sito di uno studio di architettura/interior design"*  
> e NON *"Sto entrando in una piattaforma software"*.

---

## 2. Sezioni Versione 2 — Sequenza Finale

| Ordine | Sezione              | CMS Section Type          | Stato      |
|--------|----------------------|---------------------------|------------|
| 1      | Header               | `nav_top` (navigation)    | ✅ CMS     |
| 2      | Hero Full Screen     | `hero_editorial`          | ✅ CMS     |
| 3      | Partner Strip        | `trust_marquee`           | ✅ CMS     |
| 4      | Come Lavoriamo       | `design_journey`          | ✅ CMS     |
| 5      | Magazine             | `editorial_grid`          | ✅ CMS     |
| 6      | Progetti             | `featured_design_journeys` | ✅ CMS    |
| 7      | Materiali            | `materials_carousel`      | ✅ CMS     |
| 8      | Manifesto Studio     | `atmosphere_statement`    | ✅ CMS     |
| 9      | CTA Finale           | `cinematic_quote`         | ✅ CMS     |
| 10     | Footer               | `editorial_footer`        | ✅ CMS     |

**Nessuna nuova tabella, nessun nuovo section_type creato.**

---

## 3. Modifiche al Layout — Dettaglio

### A. Hero Full Screen
- **Prima**: `min-height: clamp(560px, 72vh, 820px)`
- **Dopo**: `min-height: 100vh; min-height: 100svh;`
- **Verifica**: height=900px a viewport 900px ✅
- **Safari iOS / Chrome Mobile**: usa `100svh` (esclude la barra browser) con fallback `100vh` per browser legacy

### B. HowItWorks — Colonne Dinamiche
- **Prima**: `grid-template-columns: repeat(3, 1fr)` (hardcoded 3)
- **Dopo**: `grid-template-columns: repeat(var(--how-cols, 3), 1fr)` (dinamico da CMS)
- **Meccanismo**: React imposta `style={{ '--how-cols': Math.min(steps.length, 4) }}`
- **Risultato CMS 4 step**: 4 colonne a 1440px (289px × 4) ✅
- **Responsive**:
  - 1280px → 2 colonne (via `--how-cols: 2 !important`)
  - 880px → 1 colonna (via `--how-cols: 1 !important`)
- **Adattabilità**: CMS 3 step → 3 col; 5 step → 4 col max (cap in JS)

### C. DesignStories — 3 Colonne
- **Prima**: `grid-template-columns: repeat(4, 1fr)`
- **Dopo**: `grid-template-columns: repeat(3, 1fr)`
- **Verifica**: 3 card landscape (425px × 3) su desktop ✅
- **Responsive**: 2 col a 1280, 1 col a 880

### D. EditorialStatement — Sezione Manifesto Studio
- **Nuova sezione** aggiunta al render order (tra Materials e FinalCTA)
- **Section Type CMS**: `atmosphere_statement` (già esistente — nessun nuovo type)
- **Contenuto**: "Il design non è solo ciò che vedi. È come vivi." ✅
- **Layout**: Grid 2 colonne (citazione grande + corpo/CTA)
- **Verifica**: Componente visibile e correttamente posizionato ✅

### E. Padding Sezioni — Respiro Editoriale
| Sezione       | Prima                          | Dopo                           |
|---------------|--------------------------------|--------------------------------|
| HowItWorks    | `clamp(20px, 2.5vw, 36px) 0`  | `clamp(80px, 8vw, 120px) 0`   |
| Magazine      | `clamp(16px, 2vw, 32px) 0 0`  | `clamp(80px, 8vw, 120px) 0`   |
| DesignStories | `margin: clamp(28px, 4vw, 64px) 0` | `padding: clamp(80px, 8vw, 120px) 0` |
| Materials     | `clamp(16px, 2vw, 32px) 0`    | `clamp(80px, 8vw, 120px) 0`   |
| EditorialStmt | —                              | `clamp(96px, 10vw, 144px) 0`  |

### F. Section Head Margin
- **Prima**: `margin: 0 0 18px`
- **Dopo**: `margin: 0 0 56px` (testa sezione più distanziata dal contenuto)

### G. Section Eyebrow Margin
- **Prima**: `margin: 0 0 18px`
- **Dopo**: `margin: 0 0 24px`

---

## 4. Rimozione Terminologia SaaS / P0 Fixes

### File Frontend (tsx/jsx) — Testi Utente
| Testo rimosso                                          | Testo aggiornato                                              |
|--------------------------------------------------------|---------------------------------------------------------------|
| "Componi l'apertura editoriale dal Blueprint."         | "Personalizza questa sezione dal pannello amministrativo."    |
| "Definisci i passi del Design Journey dal Blueprint."  | "Personalizza i passaggi del processo creativo dal pannello." |
| "Seleziona articoli editoriali in evidenza dal Blueprint." | "Seleziona gli articoli in evidenza dal pannello."        |
| "Componi il carosello materiali dal Blueprint."        | "Componi la selezione materiali dal pannello amministrativo." |
| "Apri Blueprint Experience →"                          | "Personalizza questa sezione →"                               |
| "Real journeys. Real spaces."                          | "Real projects. Real spaces."                                 |
| "View all journeys"                                    | "View all projects"                                           |
| "Journey reali. Spazi reali."                          | "Progetti reali. Spazi reali."                                |
| "Vedi tutti i Journey"                                 | "Vedi tutti i progetti"                                       |

### CMS Database — Contenuto Patched
| Section          | Campo            | Prima                                      | Dopo                                     |
|------------------|------------------|--------------------------------------------|------------------------------------------|
| `hero_editorial` | `it.eyebrow`     | "MOOD for DESIGN™"                         | "STUDIO DI INTERIOR DESIGN"              |
| `hero_editorial` | `it.title`       | "Il tuo spazio.\nIl tuo Design Journey™."  | "Il tuo spazio.\nIl tuo progetto."       |
| `hero_editorial` | `it.cta_primary` | "Inizia il tuo Design Journey™"            | "Inizia il tuo progetto"                 |
| `hero_editorial` | `en-US.eyebrow`  | "MOOD for DESIGN™"                         | "INTERIOR DESIGN STUDIO"                 |
| `hero_editorial` | `en-US.title`    | "Your space.\nYour Journey."               | "Your space.\nYour vision."              |
| `hero_editorial` | `en-US.cta_primary` | "Begin Your Journey™"                  | "Begin your project"                     |
| `cinematic_quote` | `it.title`      | "Pronti ad iniziare il tuo Design Journey?" | "Pronti a trasformare il vostro spazio?" |
| `cinematic_quote` | `en-US.title`   | "Ready to start your design journey?"      | "Ready to transform your space?"         |
| `nav_top`        | `cta.label_i18n` | "Inizia il tuo Design Journey™"            | "Prenota una consulenza"                 |

---

## 5. Componenti Modificati

| File                                                     | Tipo modifica             |
|----------------------------------------------------------|---------------------------|
| `/app/frontend/src/pages/site/HomePage.jsx`              | Layout + Mapper + CMS     |
| `/app/frontend/src/pages/site/home-iter150.css`          | CSS layout + nuovi stili  |
| `/app/backend/scripts/fix_homepage_saas_terms.py`        | Script patch DB (nuovo)   |

### HomePage.jsx — Dettaglio Modifiche
- Header file: rimossi riferimenti "MOOD for DESIGN™" e "Blueprint Command Center™"
- `EDITORIAL_SHELL`: aggiunto `editorialStatement` slot
- `EmptyEditorialSlot`: testi aggiornati (rimosso "Blueprint")
- `HowItWorks`: aggiunto `style={{ '--how-cols': ... }}` per griglia dinamica
- `DesignStories`: fallback testi aggiornati ("Journey" → "progetti")
- `mapCmsToCopy`: aggiunto mapper per `atmosphere_statement` → `editorialStatement`
- `EditorialStatement`: nuovo componente React (manifesto dello studio)
- `HomePageBody`: aggiunto `<EditorialStatement>` nel render order

### home-iter150.css — Dettaglio Modifiche
- `.mfd-home-hero`: `100svh` full screen
- `.mfd-section-head`: margin aumentato `18px` → `56px`
- `.mfd-section-eyebrow`: margin aumentato `18px` → `24px`
- `.mfd-how`: padding editoriale `clamp(80px, 8vw, 120px) 0`
- `.mfd-how__steps`: griglia dinamica con `var(--how-cols, 3)`
- `.mfd-home-magazine`: padding editoriale `clamp(80px, 8vw, 120px) 0`
- `.mfd-stories`: padding editoriale, griglia `repeat(3, 1fr)`
- `.mfd-materials`: padding editoriale
- Aggiunto blocco `.mfd-editorial-stmt` (manifesto editoriale)
- Breakpoint 1280: `--how-cols: 2`, stories 2-col
- Breakpoint 880: `--how-cols: 1`, stories 1-col, hero corretto
- Breakpoint 480: aggiornato `100svh`
- Breakpoint 1180-1440: nuovo (gap reduction per 4-col HowItWorks)
- Fix: rimossa regola CSS rotta `ading { min-height: 30vh; }`

---

## 6. Verifica CMS-Driven (Zero Hardcoding)

| Dato                         | Provenienza                  | Verifica    |
|------------------------------|------------------------------|-------------|
| Hero image                   | `hero_editorial._settings`   | ✅ CMS      |
| Hero title (IT/EN)           | `hero_editorial.locale_content.it/en-US` | ✅ CMS |
| Hero CTA label               | `hero_editorial.locale_content.it.cta_primary` | ✅ CMS |
| HowItWorks step count        | `design_journey._settings.steps.length` | ✅ CMS |
| HowItWorks step titles       | `design_journey._settings.steps[].title.it` | ✅ CMS |
| Magazine cards               | `editorial_grid._settings.cards` + live articles API | ✅ CMS |
| Projects                     | `published_design_journeys` feed API | ✅ CMS |
| Materials swatches           | `materials_carousel._settings.swatches` | ✅ CMS |
| Manifesto (EditorialStmt)    | `atmosphere_statement.locale_content.it` | ✅ CMS |
| FinalCTA title               | `cinematic_quote.locale_content.it` | ✅ CMS |
| Footer links                 | `editorial_footer.locale_content.it` | ✅ CMS |
| Nav CTA label                | `nav_top.settings.cta.label_i18n` | ✅ CMS |

---

## 7. Verifica Multilingua

| Sezione           | IT (verifica)                            | EN (verifica)                       |
|-------------------|------------------------------------------|-------------------------------------|
| Hero eyebrow      | "STUDIO DI INTERIOR DESIGN"              | "INTERIOR DESIGN STUDIO"            |
| Hero title        | "Il tuo spazio. Il tuo progetto."        | "Your space. Your vision."          |
| Hero CTA          | "Inizia il tuo progetto"                 | "Begin your project"                |
| Nav CTA           | "Prenota una consulenza"                 | "Book a consultation"               |
| HowItWorks steps  | IT da `steps[].title.it`                | EN da `steps[].title.en`            |
| Manifesto eyebrow | "IL NOSTRO STUDIO"                       | "OUR STUDIO"                        |
| FinalCTA title    | "Pronti a trasformare il vostro spazio?" | "Ready to transform your space?"    |
| Projects viewAll  | "Vedi tutti i progetti"                  | "View all projects"                 |

---

## 8. Test Results (Testing Agent v4 — Iteration 244)

| Test                          | Risultato |
|-------------------------------|-----------|
| Hero 100svh (900px viewport)  | ✅ PASS   |
| HowItWorks 4 col desktop      | ✅ PASS — `289px × 4`, `--how-cols=4` |
| HowItWorks 1 col mobile       | ✅ PASS — `342px` (single column)     |
| DesignStories 3 col           | ✅ PASS — `425px × 3`                 |
| EditorialStatement visibile   | ✅ PASS — "Il design non è solo ciò che vedi. È come vivi." |
| Nav CTA aggiornato            | ✅ PASS — "PRENOTA UNA CONSULENZA"   |
| Hero title aggiornato         | ✅ PASS — "Il tuo spazio. Il tuo progetto." |
| FinalCTA aggiornata           | ✅ PASS — "Pronti a trasformare il vostro spazio?" |
| Nessun testo "Blueprint"      | ✅ PASS   |
| Nessun EmptyEditorialSlot     | ✅ PASS — CMS data caricata correttamente |

**Success rate: 100% (10/10)**

---

## 9. Breakpoint Responsivi

| Viewport | HowItWorks | Projects | Hero          |
|----------|------------|----------|---------------|
| 1440px   | 4 col      | 3 col    | 100svh        |
| 1280px   | 2 col      | 2 col    | 100svh        |
| 1024px   | 2 col      | 2 col    | 100svh        |
| 768px    | 1 col      | 1 col    | 100svh        |
| 390px    | 1 col      | 1 col    | 100svh        |

---

## 10. Script di Supporto

| Script                                                  | Scopo                                              |
|---------------------------------------------------------|----------------------------------------------------|
| `/app/backend/scripts/fix_homepage_saas_terms.py`       | Patch DB per rimozione MOOD/Journey + pubblica     |

---

## Note Tecniche

- **`100svh` vs `100vh`**: `svh` esclude la barra del browser su Safari iOS e Chrome mobile. Fallback `100vh` garantisce compatibilità con browser legacy (pre-iOS 15.4).
- **CSS Custom Property `--how-cols`**: impostato da React in base a `steps.length` dal CMS. Max 4 colonne per leggibilità. Nessun hardcoding del numero.
- **`atmosphere_statement`**: section type esistente, nessun nuovo tipo creato. Solo aggiunto mapper frontend + componente renderer.
- **Publish**: tutte le modifiche al DB sono state pubblicate tramite `core.storefront_revisions.publish_page()` — il frontend serve sempre la revision snapshot, non il draft.
