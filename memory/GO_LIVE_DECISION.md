# GO-LIVE DECISION
**Data**: 2026-06-20  
**Sprint**: Business Flow Certification — Pre Go-Live  
**Metodo**: 23 test API + 5 flussi UI simulati su dati reali

---

## LE 6 DOMANDE — RISPOSTA DEFINITIVA

---

### 1. Posso vendere una licenza oggi?

## ⚠️ PARTIAL — Non ancora, ma ci siamo quasi

**Perché NO ancora**:
- Un cliente che pubblica un progetto non lo vede nel listing pubblico (blocco critico — `featured_only=True` di default)
- Un commerciale non trova i lead ricevuti senza istruzioni (voce non nel sidebar)
- Il workflow partner→DJ richiede uno step di invito non guidato

**Perché SÌ parzialmente**:
- CMS completo (tutte le pagine pubbliche editabili)
- Progetti: creazione, gallery, hotspot, YouTube, traduzioni, SEO — tutto funziona
- Magazine: flusso completo end-to-end funziona
- Lead entry: begin-journey e partner-application funzionano

**Cosa manca prima della vendita**: 3 fix operativi (non nuove feature) per rendere il sistema guidato per un non-tecnico.

---

### 2. Posso fare una demo oggi?

## ✅ PASS

**Sì, con queste condizioni**:
- Mostrare la demo come percorso guidato (non libero)
- Preparare i dati: avere almeno 1 progetto con `homepage_featured=True` per mostrare il listing pubblico
- Il frontend pubblico è bello, funzionale, multilingua
- Blueprint Projects Studio è impressionante: gallery, hotspot, YouTube, traduzioni in 7 lingue

**Punti forti della demo**:
- `/projects` con i 6 progetti reali
- Blueprint Projects Studio con il flusso completo
- Partner Application in 7 lingue
- Magazine con 12 articoli

**Cosa evitare nella demo**: non mostrare il sidebar Blueprint liberamente senza guida (icon-only, potrebbe confondere).

---

### 3. Posso onboardare un cliente reale oggi?

## ⚠️ PARTIAL — Con un documento di onboarding

**Sì, se accompagnato da**:
- Un documento "Dove trovare X" (1 pagina): Lead su `/relations/accounts`, Magazine su Settings, Progetti su Projects Studio
- Istruzione: "Dopo aver pubblicato un progetto, attiva 'In evidenza in homepage' nella tab SEO & Visibilità"

**Senza questo documento**: alta probabilità che il cliente si perda nelle prime sessioni.

---

### 4. Posso gestire un progetto reale oggi?

## ⚠️ PARTIAL — Con una istruzione in più

**Flusso funziona al 90%**: crea → gallery → hotspot → YouTube → traduci → pubblica → ✅

**L'unico gap**: il progetto pubblicato non appare automaticamente nel listing `/projects`. L'admin deve attivare `homepage_featured = true` nella tab SEO & Visibilità. Questo campo esiste, ma non è collegato alla visibilità nel listing nella testa di un utente non tecnico che ha appena cliccato "Pubblica".

**Fix richiesto**: un testo nel Blueprint che spieghi "Il progetto è pubblicato. Per farlo apparire in /projects, attiva 'In evidenza in homepage'." — oppure cambiare il default del feed a `featured_only=false`.

---

### 5. Posso gestire un partner reale oggi?

## ⚠️ PARTIAL

**Funziona**:
- Ricezione candidature via `/partner-application` ✅
- Workflow approvazione: applied → review → approved → active ✅
- API completa con tutti gli stati ✅

**Non funziona autonomamente**:
- Assegnazione partner a un Design Journey richiede che il partner abbia prima un account piattaforma — step non guidato nell'UI

**Pratico per oggi**: un manager può ricevere, rivedere e approvare un partner. L'assegnazione a un DJ specifico richiede assistenza tecnica per il primo setup.

---

### 6. Posso pubblicare contenuti reali oggi?

## ✅ PASS

**Progetti**: ✅ Il dettaglio del progetto è raggiungibile e funziona. La pagina `/projects/slug` è live e renderizza gallery, hotspot, YouTube, traduzioni.

**Magazine**: ✅ Flusso completo funziona. Articolo pubblicato appare in `/magazine`. Tutto testato.

**CMS Pagine**: ✅ Tutte le pagine pubbliche (home, about, services, professionals, partner-application) editabili da Blueprint senza sviluppatore.

---

## RIEPILOGO DECISIONALE

| Domanda | Gate | Note |
|---------|------|------|
| Posso vendere una licenza oggi? | ⚠️ PARTIAL | 3 fix operativi prima della vendita |
| Posso fare una demo oggi? | ✅ PASS | Sì, con percorso guidato e dati preimpostati |
| Posso onboardare un cliente reale oggi? | ⚠️ PARTIAL | Sì, con documento onboarding (1 pagina) |
| Posso gestire un progetto reale oggi? | ⚠️ PARTIAL | Sì, con 1 istruzione su "In evidenza" |
| Posso gestire un partner reale oggi? | ⚠️ PARTIAL | Ricezione/approvazione sì. Assegnazione DJ no |
| Posso pubblicare contenuti reali oggi? | ✅ PASS | Magazine e Progetti (dettaglio) funzionano |

---

## I 3 FIX CHE SBLOCCANO IL GO-LIVE COMPLETO

Questi NON sono nuove feature — sono aggiustamenti operativi al comportamento attuale:

| # | Fix | File | Impatto |
|---|-----|------|---------|
| **F1** | Default feed pubblico: cambiare `featured_only=True` → `False` — OPPURE aggiungere nota nel Blueprint dopo Pubblica: "Attiva In evidenza per apparire in /projects" | `published_journeys.py` line 126 OPPURE UI hint | Sblocca "Posso gestire un progetto reale" |
| **F2** | Aggiungere redirect `/blueprint/leads` → `/relations/accounts` — OPPURE voce "Leads" nel sidebar | App.js / Sidebar | Sblocca "Il commerciale trova i lead" |
| **F3** | Aggiungere nota nel Partner Network: "Per assegnare questo partner a un DJ, prima invitalo alla piattaforma da Settings → Members" | PartnerNetworkPage.jsx | Sblocca "Posso gestire un partner reale" |

---

## CONCLUSIONE

**Il prodotto è solido. Il gap è di UX/workflow guidance, non di funzionalità.**

Con i 3 fix sopra (stimati 4–6 ore di lavoro totali):
- "Posso vendere una licenza oggi?" → ✅ PASS
- "Posso onboardare un cliente reale oggi?" → ✅ PASS
- "Posso gestire un progetto reale oggi?" → ✅ PASS

**RACCOMANDAZIONE**: implementare i 3 fix, poi eseguire 1 sessione di test con un utente reale non tecnico (30 minuti), poi go-live.
