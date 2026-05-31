# JOURNEY LEGACY CTA · AUDIT
## ITER178 · Mappa di ogni CTA "Nuova Journey / Crea Journey / Inizia Journey / Apri Journey"

> **Status:** ✅ AUDIT + 3 CTA RILOCATE · 31 May 2026
> **Riferimento:** `CRM_LIFECYCLE_CANON.md §4`, `CRM_ENTRY_POINTS_AUDIT.md`
> **Vincolo canon:** **NESSUN punto di ingresso può creare Journey senza passare per Account(prospect|customer)**

---

## §0 · Executive summary

Sono state mappate **14 CTA legacy** che storicamente facilitavano un percorso Lead→Journey diretto o usavano il lessico "Nuova Journey" come ingresso primario.

**Post-ITER178:**
- ✅ **3 CTA rilocate** (Topbar, ActiveJourneyRail, Sidebar) — ora puntano a Nuova Relazione™ o `/relations/leads`
- 🟡 **5 CTA segnalate** come correttezza testuale ma legittime (Public Site `/begin-journey`)
- 🔴 **6 CTA da rimuovere/sostituire** nei prossimi sprint

---

## §1 · CTA TROVATE — full inventory

| # | File | Linea | Label attuale | testid | Severity post-ITER178 | Action |
|---|---|---|---|---|---|---|
| 1 | `components/layout/Topbar.jsx` | 58-72 | `Nuova Relazione` (era `New Journey`) | `topbar-new-relationship-cta` (era `topbar-new-journey-cta`) | ✅ FIXED | redirected al Modal |
| 2 | `components/layout/ActiveJourneyRail.jsx` | 52-57 | `Apri Nuova Relazione →` (era `Inizia una conversazione →`) | `sidebar-new-relationship-cta` (era `sidebar-begin-journey-cta`) | ✅ FIXED | redirected a `/relations/leads` |
| 3 | `components/layout/Sidebar.jsx` | 339+ | `+ Nuova Relazione` | `sidebar-new-relationship-trigger` | ✅ ALIGNED | nuovo (ITER177.B) |
| 4 | `dashboard/JourneyPulsePage.jsx` | 146 | "+ Inizia il tuo viaggio" (Link a `/begin-journey`) | inline | 🔴 RED | da sostituire con `Nuova Relazione` modal trigger |
| 5 | `pages/site/HomePage.jsx` | 237 | "Inizia il tuo viaggio" | `header-cta-start-project` (public site) | 🟢 GREEN (public marketing) | lessico OK |
| 6 | `pages/site/HomePage.jsx` | 270 | testo CTA | inline | 🟢 GREEN | lessico OK |
| 7 | `pages/site/HomePage.jsx` | 313 | "Inizia il tuo viaggio" | `hero-cta-primary` | 🟢 GREEN | lessico OK |
| 8 | `pages/site/HomePage.jsx` | 379 | "Vedi come funziona" | `how-cta` | 🟢 GREEN | navigation |
| 9 | `pages/site/HomePage.jsx` | 564 | "Inizia da privato" | `final-cta-private` | 🟢 GREEN | lessico OK |
| 10 | `pages/auth/AccessEntryPage.jsx` | 203 | "Nuovo qui? Inizia il tuo viaggio" | inline | 🟡 YELLOW | corretto contesto onboarding |
| 11 | `site/components/MoodSiteHeader.jsx` | 121, 163 | CTA `/begin-journey` | inline | 🟢 GREEN (public site) | lessico OK |
| 12 | `pages/workspace/LeadsPage.jsx` | 110 | "Converti" (richiama `convert-lead-btn`) | inline | 🔴 RED | bypassa Discovery — vedi `CRM_ENTRY_POINTS_AUDIT §5 R1/R2` |
| 13 | `pages/site/HomePage.jsx` | 692, 767, 834 | fallback link `/begin-journey` | inline | 🟢 GREEN | OK |
| 14 | i18n `nav.new_journey` | (default `'New Journey'`) | tradotto in tutte le lingue | i18n key | 🟡 YELLOW | da rinominare a `nav.new_relationship` cross-lingua |

---

## §2 · CTA RILOCATE IN ITER178 — dettaglio

### 2.1 · Topbar (`Topbar.jsx :58-72`)
**Prima:**
```jsx
<button data-testid="topbar-new-journey-cta"
        onClick={() => navigate('/begin-journey')}>
  + New Journey
</button>
```

**Dopo:**
```jsx
<button data-testid="topbar-new-relationship-cta"
        onClick={() => openModal ? openModal() : window.location.assign('/relations/leads')}>
  + Nuova Relazione
</button>
```

Risultato: l'operatore in workspace **non finisce più sul form pubblico** ma apre la modale 3-way nel proprio contesto.

### 2.2 · ActiveJourneyRail empty state (`ActiveJourneyRail.jsx :45-60`)
**Prima:**
```jsx
<p>Nessun Journey vivo al momento.</p>
<NavLink to="/begin-journey" testid="sidebar-begin-journey-cta">
  Inizia una conversazione →
</NavLink>
```

**Dopo:**
```jsx
<p>Nessuna Design Journey attiva.</p>
<NavLink to="/relations/leads" testid="sidebar-new-relationship-cta">
  Apri Nuova Relazione →
</NavLink>
```

### 2.3 · Sidebar `+ Nuova Relazione` (`Sidebar.jsx :339+`)
Aggiunto in ITER177.B. È il CTA primario per aprire la modal. Visibile sia in modalità espansa che collassata.

---

## §3 · CTA DA CORREGGERE — PIANO DI RIMOZIONE

### 3.1 · 🔴 `JourneyPulsePage.jsx :146` — "+ Inizia il tuo viaggio"
Empty state della dashboard journey. Quando l'utente non ha journey attive, viene rimandato al **form pubblico** `/begin-journey` — assurdo per uno studio.

**Action proposta (ITER179):**
- Sostituire `<Link to="/begin-journey">` con button che apre il Modal Nuova Relazione™
- Label nuovo: `+ Nuova Relazione`
- testid: `journey-pulse-empty-new-relationship-cta`

### 3.2 · 🔴 `LeadsPage.jsx :110` — "Converti in Account"
Chiama `POST /api/workspace/leads/{lid}/convert` che bypassa la Discovery. Documentato in `CRM_ENTRY_POINTS_AUDIT §5 R1`.

**Action proposta (ITER179):**
- Rimuovere il bottone "Converti"
- Sostituire con "Apri Discovery" che apre il pannello inline `DiscoveryInterviewPanel`
- Eventualmente deprecare l'endpoint `/api/workspace/leads/{lid}/convert` con redirect a `qualify_discovery` se discovery row esiste

### 3.3 · 🟡 i18n key `nav.new_journey` — cross-lingua
Cambiata in IT (`nav.new_relationship`). Tradurre nelle altre 6 lingue (EN/FR/DE/ES/AR).

**Action proposta (ITER180):**
- Rename i18n key `nav.new_journey` → `nav.new_relationship`
- Aggiungere fallback transitorio per non rompere i bundle
- Pulire dopo 1 release

---

## §4 · CTA NON DA TOCCARE (rationale)

I CTA del **public site** (`HomePage.jsx`, `MoodSiteHeader.jsx`, `BeginJourneyPage.jsx`, `AccessEntryPage.jsx`) restano legittimamente con lessico "Inizia il tuo viaggio" / "Begin Journey":
- Sono pubblici, non workspace
- Targetizzano cliente finale, non operatore showroom
- Conducono al **public form** `/begin-journey` che è OK (post ITER177.B emette `discovery_interviews(qualified, source='public_form')`)

---

## §5 · CTA CORRETTE — riassunto

| Area | CTA canon | Path | Trigger |
|---|---|---|---|
| Workspace globale | `+ Nuova Relazione` (Sidebar) | Modal | click |
| Workspace globale | `+ Nuova Relazione` (Topbar) | Modal | click |
| Cmd+K | `Crea nuovo Lead «query»` | Modal con prefill | Cmd+K + Enter |
| Empty state sidebar | `Apri Nuova Relazione →` | `/relations/leads` | NavLink |
| Empty state journey pulse | (DA FIXARE in ITER179) | Modal | — |
| Lead Detail | "Apri Discovery" | inline panel | — |
| Discovery panel | "Promuovi a Prospect" | qualify endpoint | — |
| Prospect Detail (futuro) | "Apri Design Journey" | Modal Choice B | — |
| Account Detail (futuro) | "Apri Design Journey" | Modal Choice C | — |

---

## §6 · TESTING

### 6.1 · Playwright manual smoke
- ✅ Topbar `+ Nuova Relazione` apre modale
- ✅ Sidebar `+ Nuova Relazione` apre modale
- ✅ Cmd+K apre palette
- ✅ Cmd+K "no results" → CTA → modale aperto con prefill

### 6.2 · Test ID changes (per testing agent)
| Old | New |
|---|---|
| `topbar-new-journey-cta` | `topbar-new-relationship-cta` |
| `sidebar-begin-journey-cta` | `sidebar-new-relationship-cta` |

**Eventuali test Playwright esistenti** che riferiscono a quei testid devono essere aggiornati.

---

## §7 · RIASSUNTO FINALE · prima/dopo

|  | Pre-ITER178 | Post-ITER178 | Delta |
|---|---|---|---|
| CTA workspace che portano a `/begin-journey` | 2 (Topbar + Sidebar empty) | 0 | ✅ −2 |
| CTA workspace che aprono Modal Nuova Relazione | 0 | 4 (Sidebar new + Topbar + Cmd+K + Sidebar empty) | ✅ +4 |
| CTA legacy "Nuova Journey" labeled in italiano | 3 (Topbar default · empty Sidebar · JourneyPulse) | 1 (JourneyPulse) | ✅ −2 |
| Cmd+K Showroom Flow disponibile | 🚫 No | ✅ Sì | ✅ NEW |

---

**Fine audit. 3 CTA legacy rimosse. 1 da fixare nel prossimo sprint. 5 CTA pubbliche legittime preservate.**
