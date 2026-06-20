# BLUEPRINT EDITABILITY CERTIFICATION
**Data**: 2026-06-20  
**Sprint**: Final Sales Readiness Sprint

---

## CERTIFICAZIONE: Editabilità completa da Blueprint

Questa certificazione risponde alle 9 domande chiave del cliente.

---

### Checklist Definitiva

| Domanda | Risposta | Come | Dove nel Blueprint |
|---------|----------|------|-------------------|
| Posso creare un progetto da Blueprint? | **SÌ** | Bottone "+ Nuovo progetto" → modale | `/blueprint/projects-studio` |
| Posso pubblicarlo? | **SÌ** | Bottone "Pubblica" nella testata del progetto | `/blueprint/projects-studio` → seleziona progetto |
| Posso tradurlo? | **SÌ** | Tab "Traduzioni" → seleziona locale → compila → salva | `/blueprint/projects-studio` → Tab Traduzioni |
| Posso modificare CTA? | **SÌ** | Sezioni `dual_cta`, `nav_top`, `pro_hero` in Experience Studio | `/blueprint/experience-studio` |
| Posso modificare immagini? | **SÌ** | `EditorialMediaField` + `ProjectGalleryEditor` nel tab Progetto | `/blueprint/projects-studio` → Tab Progetto → Gallery |
| Posso modificare hotspot? | **SÌ** | Pin editor in `ProjectGalleryEditor` → hotspot per ogni immagine | `/blueprint/projects-studio` → Tab Progetto → Gallery |
| Posso modificare video? | **SÌ** | `StorySectionsEditor` → Aggiungi blocco → Video YouTube | `/blueprint/projects-studio` → Tab Progetto → Body |
| Posso modificare il form partner? | **SÌ** | Sezione `partner_form_labels` nel CMS | `/blueprint/experience-studio` → partner-application |
| Posso modificare tutte le lingue? | **SÌ** | BCP-47 per tutte le sezioni + Tab Traduzioni (7 locali) | Ovunque |

---

### Architettura Blueprint

| Componente | Tipo | Fonte dati |
|------------|------|-----------|
| `ProjectsStudioPage` | Admin page | `/api/admin/published-journeys/` |
| `ProjectGalleryEditor` | Componente | `story_content.gallery` |
| `StorySectionsEditor` | Componente | `story_content.body_blocks` |
| `TraduzioniTab` | Subcomponente | `published_design_journey_translations` |
| `SeoTab` | Subcomponente | `published_design_journeys.seo_*` |
| `experience-studio` CTAs | Admin page | `cms_sections` (nav_top, dual_cta, etc.) |
| Form partner labels | CMS section | `cms_sections.partner_form_labels` |

### Nessuna Nuova Tabella
Tutte le feature sono implementate usando:
- `published_design_journeys` (story_content JSONB)
- `published_design_journey_translations`
- `cms_sections` (partner_form_labels)

---

**VERDICT: ✅ PASS — Frontend Public Sales Readiness = PASS**
