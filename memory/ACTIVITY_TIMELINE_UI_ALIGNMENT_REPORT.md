# ACTIVITY_TIMELINE_UI_ALIGNMENT_REPORT

**Data**: 03/06/2026
**Scope**: M2 (TimelineFeed) + M3 (ActivityFeed) — allineamento UI al Command Center
**Classificazione**: `UI_ALIGNMENT_COMPLETED`

---

## OBIETTIVO

Portare `ActivityFeed.jsx` e `TimelineFeed.jsx` allo stesso linguaggio visuale del Command Center, senza creare un nuovo design né reinterpretarlo. `ActivityDrawer.jsx` era già stato allineato nella sessione precedente.

---

## DESIGN SYSTEM APPLICATO

Token estratti da `ContactDrawer.jsx` (sorgente di verità):

| Categoria         | Token                                                        |
| ----------------- | ------------------------------------------------------------ |
| Sfondo primario   | `bg-black` (active state, primary CTA)                       |
| Sfondo pannello   | `bg-white` (contenitori contenuto su shell scuro)            |
| Bordi             | `border-stone-200` (separazioni) · `border-stone-300` (input/chip) · `border-stone-100` (divisorie righe) |
| Testo primario    | `text-stone-900`                                             |
| Testo secondario  | `text-stone-700` · `text-stone-600`                          |
| Testo terziario   | `text-stone-500` · `text-stone-400`                          |
| Eyebrow           | `text-[10px] uppercase tracking-wider text-stone-400`        |
| Input             | `border border-stone-300 px-3 py-2 text-sm`                  |
| CTA primaria      | `bg-black text-white px-3 py-2 text-xs uppercase tracking-wide` |
| CTA secondaria    | `border border-stone-300 px-3 py-2 text-xs uppercase tracking-wide hover:bg-stone-50` |
| Bordi             | Quadrati (NESSUN `rounded-*`)                                |

Lo shell `WorkspaceShell` rende l'area principale su sfondo `#0A0A0B` con `color: #FFFFFF`: il pattern Command Center è **dark shell + white content panels**, come usato già in `ActivityDrawer`, `ContactDrawer` e nei panel overview di `TenantDetail`.

---

## COMPONENTI MODIFICATI

### 1. `/app/frontend/src/admin/components/ActivityFeed.jsx`

| Prima                                                   | Dopo                                                            |
| ------------------------------------------------------- | --------------------------------------------------------------- |
| `rounded bg-stone-100` icon badge                       | `border border-stone-200 bg-white` square                       |
| `rounded` outcome chip con bg semi-trasparente          | `border` quadrato con `borderColor` dal catalogo `outcome_color`|
| Emoji indicatori (`👤 👁 📥 ✓ ⊘`)                      | Icone Lucide: `User`, `Eye`, `Inbox`, `CheckCircle2`, `Archive` |
| CTA primaria `bg-stone-900`                             | `bg-black` (Command Center token)                               |
| Marcatori unicode su section titles (`▣` / `◯`)         | Eyebrow puro `text-[10px] uppercase tracking-wider text-stone-400` |
| Icona riga da map statico `ICONS = {call: Phone, ...}` | Icona dal catalogo `platform_activity_types.icon` (via `type_icon` / fallback su `useCatalog`) |
| Stato vuoto solo testuale                               | Stato vuoto con icona Lucide `Clock` + white panel              |
| Pulsanti senza tracciamento maiuscolo                   | `uppercase tracking-wide` per uniformità                        |
| Grid filtri fissa `grid-cols-4`                         | Responsive `grid-cols-1 md:grid-cols-4`                         |

**Cataloghi consumati** (zero hardcoded sui dati):
* `platform_activity_types` → `type_label_it`, `type_icon`
* `platform_activity_outcomes` → `outcome_label_it`, `outcome_color`
* `platform_activity_sources` → `source_label_it`

### 2. `/app/frontend/src/admin/components/TimelineFeed.jsx`

| Prima                                                    | Dopo                                                            |
| -------------------------------------------------------- | --------------------------------------------------------------- |
| `rounded bg-stone-100` icon badge                        | `border border-stone-200 bg-white` square                       |
| Chip filtro attiva `bg-stone-900 text-white`             | `bg-black text-white` (token allineato)                         |
| Chip filtro inattiva senza colore testo esplicito (invisibile su shell scuro) | `bg-white text-stone-700 hover:bg-stone-100`             |
| `border-dashed` su empty state                           | `border border-stone-300 bg-white` (panel pulito)               |
| Pallino timeline `rounded-full` colorato dinamicamente   | Quadrato `2x2` `bg-stone-400` (monocromia coerente)             |
| Lista timeline senza contenitore (testo invisibile su shell scuro) | Ogni gruppo-giorno wrappato in `border border-stone-200 bg-white p-4` |
| `SOURCE_LABELS` con bilingual map `{it, en}` non usato   | Mappa snella `{event:'Eventi', email:'Email', activity:'Attività'}` — categorie UI-interne (NON sono catalogo DB) |
| Owner reso come testo libero `Owner: ...`                | Eyebrow `OWNER · <nome>` (text-stone-400 + valore in stone-700) |
| Pulsante "Filtri" / "Aggiorna" senza tracciamento        | `uppercase tracking-wide`                                       |

**Cataloghi consumati**:
* `/timeline/filter-options` → `sources`, `type_codes[].{label_it, icon, occurrences}`
* `v_relationship_timeline` → `label_it`, `icon`, `subject`, `owner_display`

---

## VALIDAZIONE VISIVA

5 screenshot catturati live sulla preview environment (admin@moodfordesign.com su tenant `Martinel Interior Design`):

### 1. Activity Feed Admin (populated + filtri aperti)
* Toolbar: search `border-stone-300` · CTA `Nuova attività` `bg-black uppercase tracking-wide`
* Pannello filtri 4 colonne (Tipo / Esito / Sorgente / Stato) con eyebrow `text-[10px] uppercase`
* Sezione **Pending follow-up · 5** dentro contenitore `border-stone-300 bg-white`
* Righe attività con icona quadrata, chip esito **COMPLETATO / INTERESSATO** colorate dal catalogo
* Meta riga: `User · Giulia Bianchi`, `Eye · MOOD Admin`, `Inbox · Manuale` (lucide icons)

### 2. Timeline Admin (filtri aperti + day grouping)
* Toolbar: "Visualizzati **30** eventi" + `FILTRI` + `AGGIORNA`
* Chip sorgente **ATTIVITÀ / EMAIL / EVENTI** + Solo manuali
* Chip tipo evento dal catalogo: `Contatto aggiunto (25)`, `Chiamata (15)`, `Nota interna (8)`, `Email (5)`, `LinkedIn (5)`, `Meeting (5)`, `WhatsApp (5)`, `Visita (3)`, `Task (2)`, `Tenant attivato (1)`, ecc.
* Giorno: `MERCOLEDÌ 3 GIUGNO 2026` (eyebrow)
* Items in white panel: icona quadrata + label catalogo + chip sorgente + ora tabular-nums

### 3. Activity Feed Empty (Martinel-32)
* "STORICO RECENTE · 0" eyebrow
* White panel con icona Lucide `Clock` (stone-300) + copy "Nessuna attività. Inizia con una chiamata, un meeting o una nota."

### 4. Timeline Founder (Blueprint /blueprint/overview tab=timeline)
* Stesso linguaggio del Command Center: shell scuro + white content panels
* Toolbar `Nessun evento ancora registrato per questo tenant.` + `FILTRI` + `AGGIORNA`
* Empty state white panel con `Clock` icon + "Nessun evento per i filtri selezionati."
* **Founder e Admin percepiscono lo stesso prodotto** (stessi token, stessi cataloghi)

### 5. Mobile viewport (390×844)
* `ActivityFeed` mantiene leggibilità: filtri si collassano (`grid-cols-1 md:grid-cols-4`)
* `TimelineFeed` mantiene struttura day-grouping + white panels
* Sidebar 260px del `WorkspaceShell` resta laterale (non-collapsible — comportamento di shell esistente, fuori scope)

---

## NO-HARDCODED CHECK

| Vincolo                       | Status                                                       |
| ----------------------------- | ------------------------------------------------------------ |
| activity type label hardcoded | ✅ Risolto: tutte le etichette tipo da `platform_activity_types.label_it` |
| activity outcome hardcoded    | ✅ Risolto: chip esito da `platform_activity_outcomes.label_it` + colore da `outcome_color` |
| activity source hardcoded     | ✅ Risolto: filtro sorgente da `platform_activity_sources.label_it` |
| timeline type hardcoded       | ✅ Risolto: chip e label da `/timeline/filter-options` (`label_it`) |
| visibility hardcoded          | ✅ Risolto: filtro `founder` applicato server-side (esclude `visibility='admin_only'`) |
| icone hardcoded               | ✅ Risolto: tutte le icone da `platform_*.icon` via `iconFor(name)` + lucide |
| UI-chrome / pulsanti          | UI chrome italiano in linea con `ContactDrawer.jsx` (es. "Nuova attività", "Filtri", "Annulla") — coerente con sorgente di verità |

Nota sulle 3 categorie timeline `event / email / activity`: non sono dati di catalogo DB ma categorie strutturali UI-interne. Mappate in modo minimale (`SOURCE_LABELS`) come fa `ContactDrawer.jsx` con i suoi titoli di sezione (`Identity`, `Contatti`, ecc.).

---

## REGRESSIONI

Nessuna regressione funzionale rilevata:
* `useCatalog` API invariato
* Tutti i `data-testid` esistenti preservati: `activity-feed-{scope}`, `activity-row-{id}`, `outcome-chip-{id}`, `activity-search-input`, `activity-toggle-filters`, `activity-refresh`, `activity-new`, `activity-filters-panel`, `activity-filter-type/outcome/source/status`, `activity-pending-section`, `activity-feed-empty`, `activity-load-more`, `timeline-{scope}`, `timeline-toggle-filters`, `timeline-refresh`, `timeline-filters-panel`, `timeline-source-{s}`, `timeline-manual-only`, `timeline-clear-filters`, `timeline-type-{code}`, `timeline-error`, `timeline-empty`, `timeline-day-{day}`, `timeline-item-{id}`, `timeline-load-more`
* Lint pulito su entrambi i file (`eslint`: ✅)
* API consumate identiche: `GET /activities/v2`, `/activities/search`, `/activities/open-followups`, `/timeline`, `/timeline/filter-options`

---

## INCOERENZE RESIDUE

Nessuna entro lo scope autorizzato (ActivityFeed + TimelineFeed). Annotazioni fuori scope (NON da trattare senza nuova autorizzazione):

* **TenantDetail.jsx Overview panels**: alcuni `text-stone-700/800` rendono poco leggibili su shell scuro. Non in scope (già esistente prima di M2/M3, è il pattern dello shell).
* **WorkspaceShell mobile**: sidebar 260px fissa (no hamburger). Pre-esistente, fuori scope.
* **Notifications placeholder**: ancora con `border-dashed` + emoji `🔔` nel testo descrittivo (M4 placeholder). Riguarda lo scope di M4, non in questo task.

---

## DELIVERABLE

| File                                                       | Stato                |
| ---------------------------------------------------------- | -------------------- |
| `/app/frontend/src/admin/components/ActivityFeed.jsx`      | ✅ Allineato         |
| `/app/frontend/src/admin/components/TimelineFeed.jsx`      | ✅ Allineato         |
| `/app/frontend/src/admin/components/ActivityDrawer.jsx`    | ✅ Già allineato (sessione precedente) |
| `/app/memory/ACTIVITY_TIMELINE_UI_ALIGNMENT_REPORT.md`     | ✅ Questo documento  |

**Classificazione finale**: `UI_ALIGNMENT_COMPLETED`

**STOP** — Nessun avvio di M4 / M5 / M1.1 senza nuova autorizzazione.
