# BLUEPRINT EDITOR GAP REPORT
**Sprint:** Magazine & Projects CMS Completion  
**Data:** 2026-06-20  
**Scope:** Audit degli editor Blueprint esistenti per Magazine e Projects  

---

## PARTE 1 — BLUEPRINT MAGAZINE EDITOR

### Editor esistente: `/settings/magazine` + `/settings/magazine/:id`

**File:** `MagazineAdminPage.jsx` (222 righe) + `MagazineEditorPage.jsx` (644 righe)  
**Stato:** ESISTE, FUNZIONANTE, MA INCOMPLETO

---

### Funzionalità ESISTENTI e FUNZIONANTI

| Funzionalità | Stato | Note |
|---|---|---|
| Lista articoli | ✅ Funzionante | `/settings/magazine` |
| Crea nuovo articolo (form modale) | ✅ Funzionante | Crea con locale `it`, blocchi hero+paragraph |
| Modifica titolo, kicker, categoria, summary | ✅ Funzionante | Per lingua selezionata |
| Selezione lingua editor | ✅ Funzionante (3 locale su 5) | Solo `it`, `en`, `fr` visibili |
| Hero image (picker dalla media library) | ✅ Funzionante | `AssetPickerModal` |
| Blocchi `paragraph` — edit testo | ✅ Funzionante | Con locale switching |
| Blocchi `quote` — edit testo + autore | ✅ Funzionante | Con locale switching |
| Blocchi `image` — picker media | ✅ Funzionante | Con drag&drop upload |
| Blocchi `image` — caption per locale | ✅ Funzionante | |
| Hotspot Design Reference™ — crea/sposta/elimina | ✅ Funzionante | `HotspotCanvas` |
| Hotspot — label, description, type, CTA | ✅ Funzionante | Per locale |
| Hotspot — drag&drop posizionamento | ✅ Funzionante | |
| Pubblicazione articolo | ✅ Funzionante | Cambia status → `published` |
| Preview pubblica | ✅ Funzionante | Link a `/magazine/{slug}` |
| Delete articolo | ✅ Funzionante | Con confirm |
| Upload diretto file su canvas | ✅ Funzionante | Via drag&drop |

---

### GAP EDITOR MAGAZINE — Classificazione

#### G1 — Locale BCP-47 (CRITICO)
| Aspetto | Stato | Dettaglio |
|---|---|---|
| LOCALES array | `[{id: 'it'}, {id: 'en'}, {id: 'fr'}, {id: 'de'}, {id: 'es'}]` | Codici brevi — NON BCP-47 |
| Editor locale switcher | Mostra solo `it`, `en`, `fr` | `fr` è il terzo, ma `de` e `es` non visibili |
| `locale_content` keys | Scrive come `{it: {...}, en: {...}}` | Non compatibile con `resolveLocaleBag` (che cerca `it-IT`) |
| Impatto | Il frontend pubblico usa `resolveLocaleBag` con BCP-47 | Articoli creati/modificati dall'editor non trovano la chiave giusta |
| Fix | Cambiare LOCALES a BCP-47, aggiungere `en-GB`, `es-ES`, ecc. | Esistente, non cablato |

#### G2 — Campi SEO (P1)
| Campo | Presente in editor | Note |
|---|---|---|
| `seo_title` (per locale) | **NO** | `article_localizations.seo_title` esiste ma non è esposto |
| `seo_description` (per locale) | **NO** | Idem |
| `og_image` (per locale) | **NO** | `article_localizations.og_image_asset_id` esiste |
| SEO preview | **NO** | Nessuna anteprima Google/FB |

> **Soluzione:** Aggiungere sezione "SEO & Sharing" nell'editor che scrive su `article_localizations`. Il backend ha già la tabella, mancano solo endpoint e UI.

#### G3 — YouTube / Video (P1)
| Aspetto | Stato | Dettaglio |
|---|---|---|
| Campo `youtube_url` in DB | **NO** | `magazine_articles` non ha questo campo |
| Blocco `youtube` nell'editor | **NO** | Non previsto |
| Blocco `youtube` nel frontend | **NO** | `MagazineArticlePage` non rende blocchi YouTube |
| `body_blocks` supporta custom types | ✅ | Il JSONB accetta qualsiasi struttura |

> **Soluzione minimale:** Aggiungere `youtube_url` alla tabella (o gestirlo come blocco `type: 'youtube'` nel `body_blocks`). Preferibile il blocco per mantenere flessibilità editoriale.

#### G4 — Author Display Name (P2)
| Aspetto | Stato | Dettaglio |
|---|---|---|
| Campo `author_display_name` in `magazine_articles` | **NO** | Non esiste |
| Campo autore visibile nell'editor | **NO** | — |
| Campo autore visibile nel frontend pubblico | **NO** | — |

> **Soluzione:** Aggiungere `author_display_name` a `magazine_articles` o usare `published_by → users_profile.display_name`.

#### G5 — Gestione Tag (P2)
| Aspetto | Stato | Dettaglio |
|---|---|---|
| Campo `tags` in DB | ✅ Esiste (ARRAY) | — |
| Editing tag nell'editor | **NO** | Non c'è UI per aggiungere/rimuovere tag |
| Impatto | I tag esistono ma non sono gestibili | L'editor crea articoli con `tags: []` |

#### G6 — Blocco `heading` (P2)
| Aspetto | Stato |
|---|---|
| Tipo blocco `heading` in frontend | NON renderizzato |
| Tipo blocco `heading` nell'editor | NON supportato |
| Schema body_blocks | Supporta qualsiasi `type` (JSONB) |

#### G7 — Ordinamento blocchi (P2)
| Aspetto | Stato | Dettaglio |
|---|---|---|
| Drag&drop per riordinare blocchi | **NO** | L'editor non ha UI per riordinare |
| Aggiunta blocchi nuovi | **NO** | Non c'è pulsante "Aggiungi blocco" |
| Impatto | Impossibile aggiungere o riordinare blocchi dall'editor | |

> **Nota:** Il campo `sort_order` esiste in `journal_article_blocks` ma NON in `magazine_articles.body_blocks` (è un JSONB inline).

#### G8 — Archiviazione articolo (P2)
| Aspetto | Stato |
|---|---|
| Funzione archivia | **NO** — solo `publish` e `delete` |
| Status `archived` in DB | ✅ Supportato |

#### G9 — Blocco `divider` (P3 — rimandare)
| Aspetto | Stato |
|---|---|
| Tipo blocco `divider` | NON supportato nell'editor, NON nel frontend |
| Priorità | P3 — non blocca il lancio |

---

### Riepilogo Gap Magazine Editor

| Gap | Priorità | Esistente | Da implementare |
|---|---|---|---|
| Locale BCP-47 (LOCALES array) | **P0** | LOCALES array | Aggiornare a BCP-47 |
| SEO fields | **P1** | `article_localizations` tabella | Endpoint + UI sezione SEO |
| YouTube blocco | **P1** | JSONB body_blocks | Campo + blocco editor + renderer |
| Author display name | **P2** | Nessuno | Campo DB + UI |
| Gestione tag | **P2** | Tags array nel DB | UI tag editor |
| Blocco heading | **P2** | JSONB body_blocks | Tipo + editor + renderer |
| Ordinamento blocchi | **P2** | — | Drag&drop + pulsante "Aggiungi" |
| Archiviazione | **P2** | Status nel DB | Pulsante + endpoint |

---

## PARTE 2 — BLUEPRINT PROJECTS EDITOR

### Editor esistente: `/blueprint/projects-studio`

**File:** `ProjectsStudioPage.jsx` (830 righe)  
**Stato:** ESISTE, MA LEGGE/SCRIVE SU UN SISTEMA DISALLINEATO

---

### Funzionalità ESISTENTI e FUNZIONANTI

| Funzionalità | Stato | Note |
|---|---|---|
| Lista masters (portfolio_projects) | ✅ Funzionante | Ma 0 record nel DB |
| Crea nuovo master | ✅ Funzionante | Scrive su `portfolio_projects` |
| Edit master: titolo, categoria, cliente, location, year | ✅ Funzionante | |
| Gallery editor | ✅ Funzionante | `ProjectGalleryEditor` |
| Story sections editor | ✅ Funzionante | `StorySectionsEditor` |
| Hero image | ✅ Funzionante | `EditorialMediaField` |
| Tab "Market Editions" | ✅ Funzionante | Crea varianti per mercato |
| Compose variant (AI) | ✅ Funzionante | Chiama `/compose` endpoint |
| Pubblica variante | ✅ Funzionante | Ma scrive su `portfolio_project_variants` |
| HotspotImage blocks | ✅ Funzionante | In story sections |

---

### GAP PROJECTS STUDIO — Classificazione

#### G1 — Disallineamento Architetturale (CRITICO P0)
| Aspetto | Stato |
|---|---|
| `ProjectsStudioPage` scrive su | `portfolio_projects` + `portfolio_project_variants` |
| `ProjectsIndexPage` (frontend pubblico) legge da | `published_design_journeys` |
| `ProjectDetailPage` (frontend pubblico) legge da | `portfolio_projects` (VUOTA) |
| Risultato | Frontend pubblico non mostra mai i progetti creati dal Blueprint |

> **Due sistemi paralleli non sincronizzati.** Nessun percorso da Blueprint → pubblica su sito.

> **Decisione architetturale necessaria:** Unificare su `published_design_journeys` oppure sincronizzare le due tabelle. (Vedi `IMPLEMENTATION_PLAN.md` per proposta)

#### G2 — Nessun Editor per `published_design_journeys` (P0)
| Aspetto | Stato |
|---|---|
| Editor CRUD per `published_design_journeys` | **NON ESISTE** |
| Endpoint admin per `published_design_journeys` | **NON ESISTE** |
| Tenant può creare/modificare un progetto pubblico | **NO** |

> I 6 progetti esistenti nel DB sono stati creati via script (`seed_sample_published_journeys.py`), non tramite Blueprint.

#### G3 — Traduzioni progetti non gestibili (P1)
| Aspetto | Stato |
|---|---|
| UI per aggiungere traduzione a un progetto | **NO** |
| Endpoint per `published_design_journey_translations` | **NON ESISTE** in admin |
| Impatto | Solo 3/6 progetti hanno `en-US`, nessuno ha altre lingue |

#### G4 — Gallery da `gallery_asset_ids` (P1)
| Aspetto | Stato |
|---|---|
| `gallery_asset_ids` in `published_design_journeys` | Array di UUID (media_library.id) |
| UI per gestire la gallery | **NO** — non esiste editor per `published_design_journeys` |
| Risoluzione UUID → URL | Richiede JOIN con `media_library` |

#### G5 — `project_stories` non cablata (P2)
| Aspetto | Stato |
|---|---|
| Tabella `project_stories` | Esiste (sections JSONB) |
| Legata a `published_design_journeys` | NO — solo FK verso `projects` e `journey_id` |

#### G6 — Hotspot progetti (P2)
| Aspetto | Stato |
|---|---|
| `article_hotspots.linked_project_id` | Esiste come FK |
| `hotspot_locale_variants` | Esiste, vuota |
| `ProjectDetailPage` → `PublicHotspotImage` | Esiste, renderizza hotspot dal `story_body` |
| Editor hotspot per progetti | Solo via `HotspotCanvas` in `StorySectionsEditor` |

---

### Riepilogo Gap Projects Editor

| Gap | Priorità | Esistente | Da implementare |
|---|---|---|---|
| Disallineamento portfolio vs published_journeys | **P0** | Entrambe le tabelle | Decisione architetturale + bridge |
| Editor CRUD per published_design_journeys | **P0** | Nessuno | Nuova sezione Blueprint |
| Gestione traduzioni progetti | **P1** | `published_design_journey_translations` | Endpoint admin + UI |
| Gallery editor per published_journeys | **P1** | `ProjectGalleryEditor` riusabile | Cablarla nel nuovo editor |
| Hotspot su progetti | **P2** | `hotspot_locale_variants`, `PublicHotspotImage` | Endpoint + cablaggio |

---

## COMPONENTI BLUEPRINT RIUTILIZZABILI

I seguenti componenti esistono e sono riutilizzabili per entrambe le superfici:

| Componente | File | Uso |
|---|---|---|
| `AssetPickerModal` | `settings/AssetPickerModal.jsx` | Hero image + gallery picker |
| `EditorialMediaField` | `components/common/EditorialMediaField.jsx` | Upload/pick media fields |
| `ProjectGalleryEditor` | `components/storytelling/ProjectGalleryEditor.jsx` | Gallery multi-immagine |
| `StorySectionsEditor` | `components/storytelling/StorySectionsEditor.jsx` | Blocchi narrativi story |
| `HotspotCanvas` (da MagazineEditorPage) | `settings/MagazineEditorPage.jsx` | Hotspot su immagini |
| `StatusPill` (da MagazineAdminPage) | `settings/MagazineAdminPage.jsx` | Pill status draft/published |
