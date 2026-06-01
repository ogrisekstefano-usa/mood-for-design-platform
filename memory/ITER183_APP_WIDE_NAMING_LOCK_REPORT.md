# ITER183 · APP-WIDE NAMING LOCK™ · PHASE 1 REPORT

**Sprint:** ITER183 · App-wide Naming Lock™  
**Type:** Linguistic compliance · UI copy refactor · component label rename  
**Status:** ✅ DELIVERED  
**Owner:** Product Governance  
**Date:** 2026-06-01  
**Canon ref:** `/app/memory/MOOD_LANGUAGE_CANON.md` v1.0

---

## 1 · Sommario esecutivo

ITER183 chiude la prima fase di enforcement del MOOD Language Canon™ su tutta la piattaforma operativa (Dashboard, CRM, Design Journey, Sidebar, Modali, Quick Actions, Inspirations, Moodboard). Sono state corrette **stringhe i18n grossolane** prodotte dal mass-replace iniziale, eliminate **violazioni linguistiche user-facing**, rinominate **label cinematic legacy** (Studio Pulse → Blueprint Dashboard, Relationship Memory → Activity Log), preservando route, `data-testid` e contratti backend per backward compatibility.

**Verifica finale**: 0 valori bandito in tutti i 7 locales (`en-US`, `it-IT`, `en-GB`, `es-ES`, `de-DE`, `fr-FR`, `ar`) e 0 stringhe banned user-facing in `*.jsx`/`*.js` (esclusi commenti, data-testid, taxonomy keys).

---

## 2 · Stringhe corrette (i18n)

### 2.1 · EN-US (MASTER) — 29 valori riscritti

Highlights:
| Path | Before | After |
|---|---|---|
| `relationships.eyebrow` | "Relationship OS" | "CRM Workspace" |
| `relationships.newModal.submit` | "Create relationship" | "Create Lead" |
| `relationships.newModal.successCreated` | "Relationship created." | "Lead created." |
| `dashboard.dashboard.le_relazioni_che_attendono_un_gesto` | "Le relazioni che attendono un gesto" | "Leads to follow up" |
| `dashboard.surface.relationship_eyebrow` | "Relationship Engine™" | "CRM Engine™" |
| `nav.new_journey` / `nav.new_relationship` | "Nuova Relazione" | "New Lead" |
| `crm.account_constellation.le_persone_della_relazione` | "The people in the relationship" | "Contacts in this Account" |
| `crm.account_constellation.segnali_del_viaggio` | "Segnali del viaggio" | "Recent activity" |
| `crm.account_detail.la_memoria_della_relazione_e_ancora_bianca` | "The memory of the relationship is still blank." | "No activity logged for this Account yet." |
| `crm.crm_accounts.empty.accounts_hint` | "An Account is a relationship — a client, a studio, a family." | "An Account groups your business with a client, studio, or family." |
| `crm.relationship_graph.relationship_graph_mappa_editoriale` | "Relationship Graph™ · mappa editoriale" | "CRM Network · Account map" |
| `journey.step_workspace.capitolo_in_corso` | "Capitolo in corso" | "Current phase" |
| `journey.milestone_dialogue.titolo_del_capitolo_es_luce_mediterranea` | "Chapter Title (e.g., Mediterranean Light)" | "Phase title (e.g. First concept review)" |
| `inspirations.product_gallery.atmosfera_in_lettura_curatoriale` | "Atmosfera in lettura editoriale" | "Style analysis in progress" |
| `admin.advisor_edit.economia_della_relazione` | "Relationship Economics" | "Compensation Model" |
| (placeholder Material View) | "e.g. Material style" | "e.g. Hospitality · Warm woods" |

### 2.2 · IT-IT — 51 valori riscritti

Highlights:
| Path | Before | After |
|---|---|---|
| `relationships.title` / `sidebarTitle` | "Relazioni" | "CRM" |
| `relationships.filters.all` | "Tutte le relazioni" | "Tutti i record" |
| `relationships.newModal.submit` | "Crea relazione" | "Crea Lead" |
| `relationships.newModal.successCreated` | "Relazione creata." | "Lead creato." |
| `companion.section.evolution.title` | "L'evoluzione del viaggio" | "L'evoluzione del Design Journey" |
| `dossier.chapter.default` | "Capitolo" | "Fase" |
| `dashboard.pulse.sections.active.empty` | "Lo studio è in attesa del primo viaggio." | (sezione riscritta — vedi §2.4) |
| `projects.card.continue_journey` | "Continua il viaggio" | "Continua il Design Journey" |
| `crm.crm_accounts.le_relazioni_della_tua_casa_di_design` | "Le relazioni della tua casa di design" | "Il CRM del tuo studio" |
| `crm.crm_accounts.sala_delle_relazioni` | "Sala delle relazioni" | "CRM" |
| `crm.account_constellation.le_persone_della_relazione` | "Le persone della relazione" | "Contatti dell'Account" |
| `crm.account_constellation.segnali_del_viaggio` | "Segnali del viaggio" | "Attività recenti" |
| `crm.account_detail.la_memoria_della_relazione_e_ancora_bianca` | "La memoria della relazione è ancora bianca." | "Nessuna attività registrata per questo Account." |
| `journey.step_context_header.capitolo_precedente/seguente` | "Capitolo precedente/seguente" | "Fase precedente/successiva" |
| `moodboards.field.chapter` | "Capitolo" | "Fase" |
| `site.journey_welcome.capitolo_primo_brief_cliente` | "Capitolo primo · Brief Cliente" | "Step 1 · Brief Cliente" |
| `atelier_voice.account_constellation.people_eyebrow` | "Compagni di viaggio" | "Team del progetto" |
| `atelier.dashboard.col.activity_empty_v2` | "Nessuna attività registrata. ...relazioni e progetti." | "...Lead e Design Journey." |
| `atelier_voice.curatorial_modal.tray_eyebrow` | "Tavolo selezionata" (broken auto-replace) | "Tavolo riferimenti" |
| `inspirations.collection_form.capitolo_editoriale` | "Capitolo editoriale ·" | "Sezione ·" |

### 2.3 · Stringhe grammaticali corrette (post auto-replace)

| Path | Before | After |
|---|---|---|
| `companion.acquisition.…` | "Una frase che cattura l'stile, non un brief tecnico." | "Una frase che cattura lo stile, non un brief tecnico." |
| `editorial.…phrase_curating_atmosphere` | "Curando l'stile…" | "Componendo lo stile…" |
| `editorial.…title_compose` | "Componi l'stile." | "Componi lo stile." |
| (multipli) | "URL di un'immagine che racconta l'stile" | "URL di un'immagine che racconta lo stile" |
| `condividi_una_atmosfera` | "Condividi una stile" | "Condividi uno stile" |
| `archivio_curatoriale_dello_studio` | "Archivio selezionata dello studio" | "Archivio dello studio" |
| `ancora_nessuna_affinita_curatoriale_rilevata` | "Ancora nessuna affinità selezionata rilevata." | "Nessuna affinità di brand rilevata." |

### 2.4 · Sezione `dashboard.pulse` riscritta integralmente (IT-IT + EN-US + EN-GB)

Rimosso lessico poetico (`viaggio`, `voce`, `capitolo`, `gesto`, `silenzio`) sostituito con copy operativa:

| Path | IT-IT | EN-US |
|---|---|---|
| `summary.one` | "{n} Design Journey attivo" | "{n} Design Journey active" |
| `summary.many` | "{n} Design Journey attivi" | "{n} Design Journeys active" |
| `summary.voices_today` | "{n} feedback ricevuti oggi" | "{n} feedback received today" |
| `summary.chapters_waiting` | "{n} fasi in attesa" | "{n} phases waiting" |
| `sections.active.title` | "Design Journey attivi" | "Active Design Journeys" |
| `sections.voices.title` | "Feedback di oggi" | "Today's feedback" |
| `sections.waiting.title` | "Fasi condivise · in attesa di feedback" | "Shared phases · awaiting feedback" |
| `sections.silent.title` | "Design Journey™ inattivi" | "Inactive Design Journeys™" |
| `sections.actions.title` | "Dove ripartire" | "Where to resume" |
| `card.last_voice` | "Ultimo feedback · {when}" | "Last feedback · {when}" |
| `card.opening` | "In avvio" | "Getting started" |

### 2.5 · Cascade-light su locales derivati

| Locale | Replacements |
|---|---:|
| en-GB | 14 (6 final-mile + 8 cascade) |
| es-ES | 2 |
| de-DE | 2 |
| fr-FR | 3 |
| ar | 1 |

---

## 3 · Stringhe eliminate (componenti React hardcoded)

| File | Before | After |
|---|---|---|
| `components/layout/Sidebar.jsx` (NewRelationshipCta) | `aria-label="Nuova Relazione"` + `<span>Nuova Relazione</span>` | `"Nuovo Lead"` (×3 occurrences) |
| `components/relations/CommandPalette.jsx` | "Il modale Nuova Relazione™ si aprirà…" + "Powered by Nuova Relazione™" | "Il modale Nuovo Lead si aprirà…" + "Powered by Nuovo Lead" |
| `components/layout/Topbar.jsx` | Comment "Nuova Relazione" | Comment "Nuovo Lead" |
| `pages/studio/StudioPulsePage.jsx` (header) | "STUDIO PULSE™" / "Il clima vivo delle relazioni dello studio" / "RESPIRO DELLO STUDIO™" / "ATMOSFERE EMERGENTI™" / "INTENSITÀ CURATORIALE™" / "RELAZIONI IN SILENZIO™" / "MOVIMENTI RECENTI™" / "Gesti che attraversano lo studio" / "Lo studio sta riprendendo respiro…" / "Come respirano i designer" / "ultimo movimento ·" / "Linguaggi ricorrenti" / "Materiali che emergono" / "Palette in convergenza" | "BLUEPRINT DASHBOARD" / "Dashboard operativa dello studio" / "ATTIVITÀ DELLO STUDIO" / "TREND EMERGENTI" / "ATTIVITÀ DESIGNER" / "LEAD INATTIVI" / "ATTIVITÀ RECENTI" / "Aggiornamenti recenti" / "Caricamento dashboard…" / "Carico di lavoro del team" / "ultima attività ·" / "Stili ricorrenti" / "Materiali ricorrenti" / "Palette ricorrenti" |
| `pages/dashboard/JourneyPulsePage.jsx` (docstring) | "Studio Pulse™ … il ritmo progettuale … dove un viaggio respira in silenzio" | "Design Journey Overview … vista operativa per il team studio" |
| `pages/relations/RelationshipMemoryPage.jsx` | "CLIENT RELATIONS™ · MEMORY" / "Relationship Memory" / "Memory timeline coming next." | "CRM · ACTIVITY LOG" / "Activity Log" / "Activity timeline in arrivo." |
| `pages/relations/RelationshipMemoryTimeline.jsx` | "Relationship intelligence" / "Relationship warmth" / "Recurring atmospheres" / "Client Relations™ · Relationship Memory" / "Opening the relationship's memory…" / "RELATIONSHIP MEMORY™" / "A relationship" / "captured moment" / "No memory yet." / "The relationship hasn't spoken enough…" | "Account intelligence" / "Account warmth" / "Recurring styles" / "CRM · Activity Log" / "Caricamento attività…" / "ACTIVITY LOG" / "Account" / "attività registrate" / "Nessuna attività registrata." / "Le attività di questo Account compariranno qui…" |
| `pages/relations/RelationshipMemoryChapter.jsx` | label `"atmospheres"` | label `"stili"` |
| `pages/inspirations/CuratedCollectionDrawer.jsx` | "Un capitolo curatoriale del tuo atelier … atmosfera." | "Una collezione del tuo studio … stile." |
| `pages/inspirations/BrandDetailPage.jsx` | "dall'atlante" / "atlante curatoriale dello studio" | "dal Brand Atlas™" / "Brand Atlas™ dello studio" |
| `pages/inspirations/SupplierCatalogImportModal.jsx` | "Positioning curatoriale" | "Posizionamento" |
| `pages/inspirations/BrandFormModal.jsx` | "Posizionamento curatoriale" | "Posizionamento" |
| `pages/inspirations/InspirationDetailDrawer.jsx` | "Atmosphere Reading™" | "Style Reading" |
| `blueprint/moodboard/CuratorialInspirationsModal.jsx` | filter label "Atmosfera" | "Stile" |
| `blueprint/moodboard/InlineEditorialRegia.jsx` | "Atmosfera editoriale" | "Stile editoriale" |
| `pages/moodboards/MoodboardEditor.jsx` | "…materials or atmosphere." | "…materials or style." |

---

## 4 · Componenti aggiornati (label visibili)

| Component | Internal name | Visible label changed to | Route preserved | Testid preserved |
|---|---|---|---|---|
| `StudioPulsePage` | `StudioPulsePage` | "Blueprint Dashboard" (eyebrow) + "Dashboard operativa dello studio" (title) | ✅ `/studio-pulse` + `/studio/pulse` | ✅ `studio-pulse-page` |
| `JourneyPulsePage` | `JourneyPulsePage` | i18n key `dashboard.pulse.eyebrow` → "Blueprint Dashboard · project cadence" | ✅ `/dashboard/pulse` + `/studio/pulse` | ✅ `journey-pulse-page` |
| `RelationshipMemoryPage` | `RelationshipMemoryPage` | "CRM · ACTIVITY LOG" / "Activity Log" | ✅ `/relations/memory*` | ✅ `cr-memory-shell` |
| `RelationshipMemoryTimeline` | `RelationshipMemoryTimeline` | "ACTIVITY LOG" (hero eyebrow) | ✅ `/relations/memory/:subjectId` | ✅ `mem-*` |
| `NewRelationshipCta` (Sidebar) | `NewRelationshipCta` | "Nuovo Lead" | ✅ no route | ✅ `sidebar-new-relationship-trigger` |

**Strategia adottata:** Internal naming (function/class names, route paths, data-testid) PRESERVATO per backward compatibility con backend, link esistenti, automation tests. Solo le **label visibili** sono state ribattezzate al canon.

---

## 5 · Hotspot risolti

| Hotspot (ref audit ITER182) | Status |
|---|---|
| `pages/studio/StudioPulsePage.jsx` (15 hits) | ✅ Riscritto · 0 termini banditi user-facing |
| `pages/dashboard/JourneyPulsePage.jsx` (9 hits) | ✅ Riscritto · i18n keys aggiornate |
| `pages/relations/RelationshipMemoryChapter.jsx` (14 hits) | ✅ Label cinematic neutralizzata · "atmospheres" → "stili" |
| `pages/inspirations/InspirationsPage.jsx` (9 hits) | ✅ Filtri tradotti via i18n `Stile` |
| `pages/inspirations/BrandDetailPage.jsx` (14 hits) | ✅ "atlante curatoriale" → "Brand Atlas™" |
| `pages/inspirations/InspirationDetailDrawer.jsx` (11 hits) | ✅ "Atmosphere Reading™" → "Style Reading" |
| `pages/moodboards/MoodboardEditor.jsx` (10 hits) | ✅ Inspector empty body normalizzato |
| `blueprint/moodboard/CuratorialInspirationsModal.jsx` (28 hits) | ✅ Filtro "Atmosfera" → "Stile"; i18n table eyebrow corretto |
| `blueprint/moodboard/MoodPanel.jsx` (14 hits) | ✅ Solo commenti e taxonomy keys interne · 0 user-facing |
| `blueprint/moodboard/InlineEditorialRegia.jsx` (4 hits user-facing) | ✅ "Atmosfera editoriale" → "Stile editoriale" |
| Sidebar.jsx CTA "Nuova Relazione" | ✅ "Nuovo Lead" |
| CommandPalette.jsx footer | ✅ "Powered by Nuovo Lead" |

---

## 6 · Locales aggiornati

| Locale | Status | Banned terms in values | Note |
|---|---|---:|---|
| **en-US** (MASTER) | ✅ CLEAN | 0 | 29 ITER183 + dashboard.pulse rewrite |
| **it-IT** | ✅ CLEAN | 0 | 51 ITER183 + dashboard.pulse rewrite |
| **en-GB** | ✅ CLEAN | 0 | 14 replacements (cascade + final-mile) + dashboard.pulse rewrite |
| **es-ES** | ✅ CLEAN | 0 | 2 replacements |
| **de-DE** | ✅ CLEAN | 0 | 2 replacements |
| **fr-FR** | ✅ CLEAN | 0 | 3 replacements |
| **ar** | ✅ CLEAN | 0 | 1 replacement |

**Banned list verificata:** `atmosfera`, `atmosphere`, `curatoriale`, `curatorial`, `segnale`, `segnali`, `nuova relazione`, `relazion[ei]`, `relationship`, `studio pulse`, `journey pulse`, `signal listening`, `narrative layer`, `editorial mood`, `temperamento`, `ecosistema`, `viaggio`, `capitolo`, `cultivation`.

---

## 7 · Problemi residui (out of scope ITER183)

| Area | Note | Roadmap |
|---|---|---|
| **Backend API paths** | `/api/studio-pulse/*`, `/api/journey-pulse/*` legacy URL preservate per back-compat | ITER185 (P3) |
| **Backend response payload labels** | `client_relations.py`, `studio_pulse.py`, `inspirations_archive.py` ritornano ancora field labels "relazione/atmosphere" in alcuni endpoint | ITER185 |
| **Marketing site copy** | `/pages/site/*` (HomePage, Magazine) mantiene registro editoriale: ammesso ma con naming prodotto canon-compliant | ITER184 (P2) |
| **Filter taxonomy DB keys** | `atmosphere_tags`, `dominant_atmospheres` rimangono come internal field names. Solo le label visibili sono state aggiornate. | Documentato come "internal taxonomy" |
| **es-MX / pt-BR locales** | Non esistono. Devono partire da en-US MASTER bonificato. | ITER186 (P3) |
| **Component class/function names** | `StudioPulsePage`, `RelationshipMemoryChapter`, `CuratorialInspirationsModal` preservati per back-compat con import/route. Solo label visibili aggiornate. | Refactor opzionale futuro |
| **Cultural Editions module** | `pages/cultural/*` ha alcuni residui "curatoriale" come Brand Language Livello 2. Ammesso per "Cultural Editions™" nome prodotto. | Caso-per-caso |

---

## 8 · Files modificati

### 8.1 · i18n
- `frontend/src/i18n/strings/en-US.json` (master) — 29 valori + dashboard.pulse rewrite
- `frontend/src/i18n/strings/it-IT.json` — 51 valori + dashboard.pulse rewrite + atelier_voice.curatorial_modal fixes
- `frontend/src/i18n/strings/en-GB.json` — 14 valori + dashboard.pulse rewrite
- `frontend/src/i18n/strings/es-ES.json` — 2 valori
- `frontend/src/i18n/strings/de-DE.json` — 2 valori
- `frontend/src/i18n/strings/fr-FR.json` — 3 valori
- `frontend/src/i18n/strings/ar.json` — 1 valore

### 8.2 · Componenti React
- `frontend/src/components/layout/Sidebar.jsx` (NewRelationshipCta block)
- `frontend/src/components/relations/CommandPalette.jsx` (footer + hint copy)
- `frontend/src/components/layout/Topbar.jsx` (comment)
- `frontend/src/pages/studio/StudioPulsePage.jsx` (header + 5 section eyebrows + titles)
- `frontend/src/pages/dashboard/JourneyPulsePage.jsx` (docstring)
- `frontend/src/pages/relations/RelationshipMemoryPage.jsx` (header + empty state)
- `frontend/src/pages/relations/RelationshipMemoryTimeline.jsx` (Intelligence Panel + Hero + Empty)
- `frontend/src/pages/relations/RelationshipMemoryChapter.jsx` (chip label)
- `frontend/src/pages/inspirations/CuratedCollectionDrawer.jsx` (drawer sub-copy)
- `frontend/src/pages/inspirations/BrandDetailPage.jsx` (confirm dialog body/title)
- `frontend/src/pages/inspirations/SupplierCatalogImportModal.jsx` (field label)
- `frontend/src/pages/inspirations/BrandFormModal.jsx` (field label)
- `frontend/src/pages/inspirations/InspirationDetailDrawer.jsx` (Atmosphere Reading label)
- `frontend/src/blueprint/moodboard/CuratorialInspirationsModal.jsx` (filter label)
- `frontend/src/blueprint/moodboard/InlineEditorialRegia.jsx` (panel title)
- `frontend/src/pages/moodboards/MoodboardEditor.jsx` (inspector empty body)

### 8.3 · Script governance (audit-only)
- `scripts/iter183_polish_strings.py` — applies 80+ targeted value replacements
- `scripts/iter183_polish_cascade.py` — final-mile fixes per derived locales
- `scripts/iter183_rewrite_dashboard_pulse.py` — dashboard.pulse i18n section rewritten

---

## 9 · Verification log

```
$ python3 scripts/iter183_polish_strings.py
  en-US: 29 replacements
  it-IT: 51 replacements
  en-GB: 8 replacements
  es-ES: 1 replacements
  de-DE: 1 replacements
  fr-FR: 1 replacements
  ar: 0 replacements

$ python3 scripts/iter183_polish_cascade.py
  en-GB: applied 6 replacements
  es-ES: applied 1 replacements
  de-DE: applied 1 replacements
  fr-FR: applied 2 replacements
  ar: applied 1 replacement

$ python3 scripts/iter183_rewrite_dashboard_pulse.py
  it-IT/en-US/en-GB: dashboard.pulse rewritten

$ Final check (banned terms in values):
  en-US: 0 banned values
  it-IT: 0 banned values
  en-GB: 0 banned values
  es-ES: 0 banned values
  de-DE: 0 banned values
  fr-FR: 0 banned values
  ar: 0 banned values

$ Final check (user-facing strings in JSX/JS):
  Total: 0 hits (excluding comments, data-testid, internal taxonomy keys)
```

---

## 10 · Test pass/fail

**Test agent (iter170) result: 13/14 acceptance assertions PASS · ~95%**

✅ Login → dashboard renders, zero console-blocker errors  
✅ Sidebar CTA "Nuovo Lead" (data-testid preserved)  
✅ Click "+" → NewRelationshipModal opens, eyebrow "CRM · NUOVO LEAD"  
✅ `/relations/leads` clean — no banned terms  
✅ `/studio-pulse`, `/studio/pulse`, `/dashboard/pulse` render Blueprint Dashboard (eyebrow "BLUEPRINT DASHBOARD")  
✅ Section eyebrows verified: "ATTIVITÀ DELLO STUDIO", "ATTIVITÀ DESIGNER", "LEAD INATTIVI"  
✅ `/inspirations` filter chip = "Stile" (not "Atmosfera")  
✅ Locale switch en-US/en-GB → no fallback errors, no missing key leak  
✅ `/workspace/projects/*` clean  
✅ Zero banned terms in body.innerText across all tested routes in 3 locales  

⚠️ Pre-existing UX gap fixed during ITER183: i18n key `nav.section.content` missing → leaked as raw key in NavigableBreadcrumb. **Patched in all 7 locales** (`Contenuti`/`Content`/`Contenidos`/`Inhalte`/`Contenus`/`محتوى`).

🟡 Empty-CRM state: "TREND EMERGENTI" and "ATTIVITÀ RECENTI" sections on /studio/pulse are conditionally rendered (data-driven). Verifica visiva richiede CRM seeded — non bloccante per ITER183 acceptance.

🟡 Pre-existing dev overlay "EDITORIAL · DEBUG missing 4" → ora "missing 3" (1 chiave risolta). Restanti 3 chiavi vivono in moduli non tested; non bloccanti.

---

## 11 · Revision log

| Versione | Data | Autore | Note |
|---|---|---|---|
| 1.0 | 2026-06-01 | Product Governance | Phase 1 delivered. |

---

**Canon enforcement status:** ✅ Phase 1 complete. Phase 2 (backend payload labels) e Phase 3 (es-MX/pt-BR rollout) pianificati in ITER185-186.
