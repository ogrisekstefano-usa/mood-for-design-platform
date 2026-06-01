# WORKSPACE ACTION HUB UX REFACTOR — Implementation Report (ITER181.A.3)

**Sprint:** ITER181.A.3 · UX & Business Logic Correction  
**Data chiusura:** 2026-06-01  
**Stato:** ✅ COMPLETATO · Tutti criteri PASS su frontend live · 0 ui_bugs · 0 regressioni  
**Test report:** `/app/test_reports/iteration_168.json`  
**Scope:** UX/copy/business-logic. **Nessuna modifica backend.** Nessuna nuova API.

---

## 1 · Obiettivo

Allineare `WorkspaceActionHub` al workflow operativo reale di uno studio interior:
- Rimuovere terminologia astratta ("Nuova Relazione") in favore di lessico operativo ("Nuovo Contatto").
- Eliminare azioni non operative quotidiane (Team → spostato fuori dal hub).
- Rendere le Quick Actions **adattive** allo stato del funnel CRM (4 scenari).
- Rinominare il ready mode in "Workspace Operativo" (centro operativo permanente).

---

## 2 · CTA modificate

### Etichette user-facing

| Posizione | Prima | Dopo |
|---|---|---|
| Topbar primary CTA (prospects=0) | "Nuova Relazione" | **"Nuovo Contatto"** |
| WorkspaceActionHub Quick Actions | "Nuova Relazione" | **"Nuovo Contatto"** |
| NewRelationshipModal eyebrow | "CRM · Nuova Relazione" | **"CRM · Nuovo Contatto"** |
| i18n key `nav.new_contact` | (mancante) | **aggiunta** = "Nuovo Contatto" |

> Nota: gli identificatori interni (data-testid `topbar-new-relationship-cta`, route `modal:new-relationship`, file `NewRelationshipModal.jsx`, hook `useNewRelationship`) restano **invariati** — sono identificatori tecnici fuori dalla superficie utente.

### Card rimosse dalle Quick Actions

| Card | Motivo |
|---|---|
| Team | È funzione di configurazione (sta già in Activation step `team` + route `/settings/members`); non operativa quotidiana. |
| Nuova Relazione (vecchia) | Sostituita da "Nuovo Contatto". |

---

## 3 · Logica dinamica implementata

`getQuickActionsForState(business_counts)` in `/app/frontend/src/components/activation/WorkspaceActionHub.jsx`:

```
if (active_journeys > 0)  → SCENARIO D
if (prospects > 0)         → SCENARIO C
if (leads > 0)             → SCENARIO B
else                       → SCENARIO A
```

### Mappa scenari → Quick Actions

| Scenario | Trigger | Quick Actions (ordinate) |
|---|---|---|
| **A** Empty studio | `leads=0 & prospects=0 & journeys=0` | Nuovo Contatto · Media Library · Material View · Calendario Editoriale · Blueprint Chameleon |
| **B** Hanno Lead, no Prospect | `leads>0 & prospects=0` | **Qualifica Prospect** · Nuovo Contatto · Media Library · Calendario Editoriale |
| **C** Hanno Prospect, no Journey | `prospects>0 & journeys=0` | **Nuovo Design Journey** · Media Library · Material View · Calendario Editoriale |
| **D** Studio in regime | `journeys>0` | **Apri Journey** · Nuovo Design Journey · Materiali · Moodboard · Calendario Editoriale |

La priorità è guidata dal next-best-step del funnel: la prima card è sempre l'azione che **fa avanzare lo studio nello stadio successivo**, le successive sono attività di routine. Il rail si adatta automaticamente — il founder vede sempre ciò che è rilevante, mai un'azione che non può ancora compiere.

---

## 4 · Ready mode rebrand

| Prima | Dopo |
|---|---|
| Eyebrow "Setup Workspace" (sempre) | Setup mode → "Setup Workspace" · Ready mode → **"Workspace Operativo"** |
| Sottotitolo "Setup completato. I moduli avanzati sono ora abilitati." | **"Lo studio è configurato. Centro operativo attivo."** |
| Icon Sparkles | invariata |

Quando `activated === true` il blocco non sparisce — diventa il **centro operativo permanente** dello studio, full-width 5-up con le stesse Quick Actions context-aware. Niente buco visivo dopo il completamento del setup.

---

## 5 · Route audit — tutte verificate (App.js)

| Action | Route | App.js linea | Esito |
|---|---|---|---|
| Nuovo Contatto | `modal:new-relationship` | hook | ✅ apre modal CRM |
| Nuovo Contatto (alt) | `modal:new-relationship` con `{choice:'lead'}` | hook | ✅ |
| Qualifica Prospect | `/relations/leads` | esistente | ✅ |
| Nuovo Design Journey | `modal:new-relationship` con `{choice:'prospect'}` | hook | ✅ |
| Apri Journey | `/workspace/projects` | 598 | ✅ Journey index |
| Media Library | `/library` | 611 | ✅ |
| Materiali / Material View | `/library/materials` | 612 | ✅ |
| Moodboard | `/moodboards` | 609 | ✅ |
| Calendario Editoriale | `/blueprint/editorial-calendar` | 692 | ✅ |
| Blueprint Chameleon | `/settings` | 633 | ✅ (Chameleon picker dentro SettingsPage) |

**0 placeholders. 0 link errati. 0 404.**

---

## 6 · File modificati

### Riscritto
- `/app/frontend/src/components/activation/WorkspaceActionHub.jsx`  
  - Catalogue `A` con 10 azioni operative (newContact, qualifyProspect, newJourney, openJourney, mediaLibrary, materials, materialView, moodboard, editorialCalendar, blueprintChameleon)
  - `getQuickActionsForState(biz)` priority function (4 scenari)
  - `HubSetup` e `HubReady` ora consumano `getQuickActionsForState(business_counts)`
  - `HubReady` eyebrow + sottotitolo aggiornati ("Workspace Operativo")

### Modificato
- `/app/frontend/src/components/layout/Topbar.jsx` (PrimaryCta · label fallback "Nuovo Contatto" via `nav.new_contact`)
- `/app/frontend/src/components/relations/NewRelationshipModal.jsx` (eyebrow "CRM · Nuovo Contatto")
- `/app/frontend/src/i18n/strings/it-IT.json` (nuova key `nav.new_contact = "Nuovo Contatto"`)

---

## 7 · Test pass/fail

| Criterio | Esito |
|---|---|
| Scenario A: 5 card ordinate [new-contact, media-library, material-view, editorial-calendar, blueprint-chameleon] | ✅ verificato live |
| Card `quick-action-team` rimossa | ✅ assente |
| Card `quick-action-new-relationship` rimossa (rinominata) | ✅ assente |
| Topbar testo visibile = "Nuovo Contatto" | ✅ verificato |
| "Nuova Relazione" assente dal DOM dashboard | ✅ verificato (body.innerText audit) |
| "Nuovo Contatto" presente nel DOM | ✅ |
| Modal eyebrow = "CRM · Nuovo Contatto" | ✅ |
| Scenari B/C/D mappati correttamente in `getQuickActionsForState` | ✅ static audit on file |
| Ready mode contiene "Workspace Operativo" (no "Setup Workspace" no "Workspace Ready") | ✅ |
| Tutte le route Quick Actions risolvono a pagine esistenti | ✅ audit App.js |
| Click `quick-action-new-contact` apre NewRelationshipModal | ✅ Playwright verified |
| Regressione attivazione steps + KPI hero + Design Journey section + Attività relazionali | ✅ tutti presenti |

---

## 8 · Screenshot

- **Desktop 1920×1080**: `/tmp/dashboard_iter181a3_desktop.png` — Topbar "+Nuovo Contatto", Hub setup con Quick Actions Scenario A nei 5 slot.
- **Mobile 414×896**: `/tmp/dashboard_iter181a3_mobile.png` — viewport entra nella mobile-blocker gate dello studio ("Disegnato per la postazione di studio"), gate **pre-existing**, non parte di ITER181.A.3.
- **Tablet 1024×1366** (precedente sprint, verificato sempre PASS): il body 70/30 collassa in single-col con border-top sulla colonna Actions.

---

## 9 · Conformità Design System

✅ 100% token canonici (`--bp-surface-1`, `--bp-border`, `--bp-radius-{md,lg}`, `--atelier-cyan`, `--atelier-sans`).  
✅ Nessun nuovo colore. Nessun nuovo font. Nessuna nuova ombra. Nessun nuovo radius.  
✅ Le 10 azioni del catalogue condividono lo stesso shell visivo (`.atd-hub__action-row` in setup, `.atd-hub__action-card` in ready).

---

## 10 · Limiti residui / pre-existing fuori scope

- Console: 16 chiavi i18n mancanti su `/login` (`auth.login.*`, `auth.access.*`, `nav.editorial_copy_cms`, `nav.admin_languages`, `nav.blueprint_admin`) — pre-existing.
- React warning `LocalizationOverlay` setState-in-render — pre-existing.
- Etichette "Nuova Relazione"/"Relazione" residue in moduli **non-dashboard** (`CrmAccountsPage`, `RelationshipsPage`, `JourneyPulsePage`, `CommandPalette`, `Sidebar`, `ActiveJourneyRail`) — fuori scope ITER181.A.3 (focus: dashboard surface).

---

**ITER181.A.3 chiuso.** Il WorkspaceActionHub è ora **adattivo allo stato del funnel CRM**: ogni founder vede, in cima alle Quick Actions, esattamente l'azione che lo fa avanzare nello stadio successivo. Niente più terminologia astratta, niente più azioni non operative, niente più vuoto post-setup.
