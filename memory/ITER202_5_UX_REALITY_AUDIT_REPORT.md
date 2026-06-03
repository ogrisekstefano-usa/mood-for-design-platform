# ITER202.5 · UX REALITY AUDIT™
## Cosa vede davvero un interior designer al primo accesso

> Audit eseguito navigando la piattaforma come un utente che apre MOOD
> per la prima volta. Nessun nuovo sviluppo. Solo identificazione attriti.

---

## 🎯 Sintesi esecutiva

Il percorso ideale **"Scopro un brand → uso un prodotto in moodboard"**
oggi richiede **8-12 click**, non i 3-4 obiettivo. Il prodotto è ricco
sul layer dati (ITER200/201/202) ma povero sulla connessione UX fra
moduli. I tre attriti più gravi:

1. **Sidebar a icone senza label** (30 destinazioni cieche)
2. **Nessun link Brand Atlas → Moodboard / Studio Library granulare**
3. **Dashboard CRM-centric** che non comunica il valore Brand Atlas

---

## 🚶 Walkthrough dei 10 step richiesti

### Step 1 · Scoprire Brand Atlas dalla Dashboard

**Cosa vede l'utente**
- "Buongiorno Stefano" + 4 KPI vuoti (0 Lead · 0 Prospect · 0 Clienti · 0 Journey)
- "Design Journey attive: Nessuna"
- "Attività recenti: Nessuna · Prossime scadenze: Nessuna"
- Top CTA: `+ Nuovo Lead`

**Click richiesti per arrivare a Brand Atlas**
1. Hover sull'icona compass (cieca, no label visibile)
2. Probabile errore: clicca su Design Journey / Leads / Prospects
3. Eventualmente trova sidebar item "Brand Atlas" → clicca

**Numero click reale**: 1 se conosce l'icona, **2-4 con tentativi falliti**

| Issue                                                                 | Pri |
|-----------------------------------------------------------------------|:---:|
| Dashboard CRM-centric: nessuna menzione di Brand Atlas / Inspirations |  P0  |
| Sidebar a icone senza label/tooltip visibili — 30 destinazioni cieche |  P0  |
| Top CTA "+ Nuovo Lead" non corrisponde al mental model designer       |  P1  |
| Titolo "Dashboard Operativa" è linguaggio sales/CRM, non design       |  P2  |

---

### Step 2 · Aprire ARBI

**Cosa vede l'utente** una volta su `/inspirations/brands`
- Header bello: "I produttori come linguaggi progettuali"
- Card grid con 15+ brand (ARBI, Artemide, B&B, Boffi, Cassina, Edra, Flexform, Margraf, ...)
- ❌ **ARBI compare DUE volte** (ARBI Test Bathroom × 2 — duplicato visibile)
- Pill filter: Tutti / Premium / Icon / Contemporary
- Search bar: "Cerca per nome, stile, materia…"
- "Aggiungi produttore" admin button visibile a tutti i ruoli

**Click**: 1 (su card ARBI → `Entra nell'atelier`)

| Issue                                                            | Pri |
|------------------------------------------------------------------|:---:|
| Duplicato visibile "ARBI Test Bathroom × 2"                       |  P0  |
| "Aggiungi produttore" visibile a tutti i ruoli, anche non-admin   |  P1  |
| Doppio CTA per la stessa azione: card cliccabile + "Entra nell'atelier" |  P2  |
| Nessun ordinamento esplicito (alfabetico/recenti/per certificazione)    |  P2  |

---

### Step 3 · Comprendere il valore del Brand Atlas

**Cosa vede l'utente** nella Brand Embassy ARBI (ITER202 ✅)
- Hero cinematic "ARBI · Italian Bathroom Architecture™"
- MOOD DNA tags premium
- Collection Universe (24) · Material Intelligence (12) · Designers (10)
- Brand Story narrativa
- Products gallery 60 elementi con immagini
- Add to Studio Library™ CTA

**Verdetto**: la pagina **comunica chiaramente il valore**. ✅

| Issue                                                        | Pri |
|--------------------------------------------------------------|:---:|
| Solo il "Share Brand" copia URL — nessuna preview esterna    |  P2  |
| Materials senza immagini reali (solo gradient swatch placeholder) |  P2  |
| Designer card senza foto (solo iniziali) — sembra incompleto |  P2  |

---

### Step 4 · Collegare ARBI allo studio

**Click**: 1 (bottone "Add to Studio Library™" in topbar o sezione CTA)

Stato: ✅ funziona, persiste in `studio_brand_links`.

**Problema dopo il click**: dove finisce il brand collegato?
- Non appare in nessuna sezione di Studio Library™
- Non c'è un sidebar item "Studio Library"
- L'utente non sa dove ritrovare i brand collegati

| Issue                                                                | Pri |
|----------------------------------------------------------------------|:---:|
| Brand collegati a Studio Library **non sono visibili da nessuna parte** |  P0  |
| Manca pagina/hub "I miei brand" (filtra solo i linkati)              |  P0  |
| Nessun feedback contestuale post-link (es. "Vedi in Studio Library →") |  P1  |

---

### Step 5 · Trovare i materiali

**Possibili percorsi (e ognuno mostra dati diversi!)**

| Path                                  | Cosa mostra                                       |
|---------------------------------------|---------------------------------------------------|
| Sidebar → Material View               | "L'atlante materico è ancora vuoto" (0 elementi)  |
| Sidebar → Media Library → filtri Materials | Filtri vuoti, asset generici                 |
| `/library/materials`                  | "Build your material library" (0 materials)       |
| Brand Embassy ARBI → Material Intelligence | 12 materiali ARBI ✅                         |

**Verdetto**: i materiali ARBI esistono **solo** dentro la Brand Embassy.
Le tre pagine "centralizzate" di materiali sono **morte** (vuote).

| Issue                                                                          | Pri |
|--------------------------------------------------------------------------------|:---:|
| 3 pagine materials separate, tutte vuote eccetto Brand Embassy                 |  P0  |
| `/inspirations/materials` (Material View) NON aggrega i materiali dei brand certificati |  P0  |
| `/library/materials` e `/inspirations/materials` sono duplicati funzionali     |  P1  |
| Nessuna ricerca cross-brand sui materiali                                      |  P1  |
| Material View ha CTA "Aggiungi Materiale" ma non importa dai Brand Atlas       |  P0  |

---

### Step 6 · Trovare i prodotti

**Possibili percorsi**

| Path                                              | Cosa mostra                       |
|---------------------------------------------------|-----------------------------------|
| Sidebar → Inspirations (`/inspirations`)          | "L'archivio è ancora vuoto"       |
| Tab "PRODOTTI" sotto Inspirations                 | Vuoto                             |
| `/inspirations/products/:id` (singolo prodotto)   | Esiste route ma nessun hub       |
| `/inspirations/products` redirect → `/inspirations?type=product` | Stessa pagina vuota |
| Brand Embassy ARBI → Products section             | 398 prodotti ARBI ✅               |

**Verdetto**: stesso pattern dei materiali. Solo la Brand Embassy
contiene i prodotti reali. Tutte le altre "pagine prodotti" sono vuote.

| Issue                                                            | Pri |
|------------------------------------------------------------------|:---:|
| Nessun hub centralizzato Prodotti aggregato                       |  P0  |
| Tab "PRODOTTI" di Inspirations non legge i prodotti certificati  |  P0  |
| Filtri categoria solo dentro Embassy, no cross-brand              |  P1  |
| Click su un prodotto Embassy non apre dettaglio (card non clickable) |  P1  |

---

### Step 7 · Creare una moodboard

**Cosa vede l'utente** su `/moodboards`
- Eyebrow: "ARCHIVIO TRASVERSALE · SPRINT G.6"
- Disclaimer: *"Le moodboard vivono dentro i loro Journey. Questa è una
  vista d'archivio. La composizione vera avviene nel progetto Moodboard
  Direction™ del singolo Journey."*
- CTA: "+ Nuova Moodboard" + "Componi la prima moodboard"
- ✅ I CTA esistono — ma il messaggio confonde

**Click reali per creare una moodboard**:
1. Sidebar → Moodboards
2. CTA "Nuova Moodboard"
3. (oppure secondo il disclaimer: enter Journey → Moodboard Direction → compose)

**Numero click reale**: 2-4

| Issue                                                            | Pri |
|------------------------------------------------------------------|:---:|
| Disclaimer contraddice il bottone "Nuova Moodboard"               |  P1  |
| "Apri Blueprint Dashboard" è un terzo bottone — destination ambigua |  P2  |
| Tab di stato (Tutti/Bozza/Inviati/Visualizzati/Approvati/Revisione/Rifiutati) eccessivi quando l'archivio è vuoto |  P2  |

---

### Step 8 · Utilizzare prodotti/materiali ARBI nella moodboard

**Il blocker definitivo P0**.

- Brand Embassy → ProductCard: nessun bottone "Add to Moodboard"
- Brand Embassy → MaterialCard: nessun bottone "Add to Moodboard"
- Moodboard Editor: nessun selettore "brand source"

Il dato ESISTE (398 prodotti ARBI, 12 materiali) ma è **inaccessibile**
da dentro l'editor moodboard. L'utente deve:
1. Andare in Embassy ARBI
2. Salvare manualmente le immagini
3. Tornare in Moodboard
4. Caricarle come asset generici

**= 6-8 click + perdita di tutta la metadata** (collection, designer, finitura).

| Issue                                                                              | Pri |
|------------------------------------------------------------------------------------|:---:|
| **Nessun ponte UX Brand Embassy → Moodboard Editor**                                |  P0  |
| ProductCard senza "Add to Moodboard"                                                |  P0  |
| MaterialCard senza "Add to Moodboard"                                               |  P0  |
| Moodboard Editor non ha picker "brand library"                                      |  P0  |
| Asset aggiunti perdono il link al brand certificato (no traceability post-spec)     |  P1  |

---

### Step 9 · Comprendere differenza fra 5 sezioni concorrenti

| Sezione                          | Cosa è                                          | Confusione                                       |
|----------------------------------|-------------------------------------------------|--------------------------------------------------|
| `/inspirations`                  | "Cultural Design Intelligence Layer" — hub con 4 sotto-bottoni | Acts come hub MA ha anche tab interni (TUTTI/EDITORIALI/PRODOTTI). Doppia natura. |
| `/inspirations/brands` (Brand Atlas)        | Atlante produttori MOOD-curated  | Chiarissimo ✅ |
| `/inspirations/collections` (Studio Collections) | Archivio dei brand/collezioni che lo studio importa | ARBI qui ha "0 prodotti importati" mentre nel Brand Atlas ha 398. Confusione TOTALE.  |
| `/inspirations/materials` (Material View)        | "Atlante materico" — vuoto      | Sovrappone Material Intelligence dell'Embassy + `/library/materials` |
| `/moodboards`                                     | Archivio trasversale read-only  | Vita reale dentro Journey/Moodboard Direction™  |

**Verdetto**: 5 destinazioni, **3 sono concettualmente lo stesso archivio** (Studio Collections ≈ Studio Library ≈ Library), 1 è vuota perché upstream non popolata (Material View), 1 è schizofrenica (Moodboards).

| Issue                                                                            | Pri |
|----------------------------------------------------------------------------------|:---:|
| 5 archivi concorrenti senza gerarchia chiara                                      |  P0  |
| Studio Collections mostra 0 prodotti ARBI mentre Brand Atlas mostra 398          |  P0  |
| Material View vuota perché non auto-aggrega dai brand certificati                |  P0  |
| Studio Library™ (introdotta in ITER202) non ha pagina propria                    |  P0  |
| Nessuna onboarding tour / glossario per spiegare la differenza                   |  P1  |

---

### Step 10 · Tornare facilmente al punto di partenza

**Test**: da `/inspirations/brands/ab1399…` (Brand Embassy ARBI) tornare alla Dashboard.

**Percorsi disponibili**
1. Topbar Embassy → `< Brands` → poi sidebar → Dashboard (icona cieca) — **2 click**
2. Sidebar Dashboard direttamente — **1 click**
3. Breadcrumb in alcune pagine — manca o incompleto

Il logo "M" in alto a sinistra **non** è cliccabile per tornare a Dashboard (è expand sidebar).

| Issue                                                            | Pri |
|------------------------------------------------------------------|:---:|
| Logo M non riporta a Dashboard                                    |  P1  |
| Breadcrumb assente o incoerente fra pagine                        |  P1  |
| Sidebar item Dashboard nascosto fra 30 icone cieche               |  P1  |

---

## 📊 Tabella priorità consolidata

### 🔴 P0 — impediscono l'uso del prodotto (12 issue)

| #  | Issue                                                                                 | Sezione                  |
|----|---------------------------------------------------------------------------------------|--------------------------|
| 1  | Sidebar a icone senza label visibili (30 destinazioni cieche)                          | Globale                  |
| 2  | Dashboard non comunica il valore Brand Atlas / Inspirations                            | Dashboard                |
| 3  | ARBI Test Bathroom appare in duplicato nel Brand Atlas                                 | Brand Atlas              |
| 4  | Studio Library™: brand collegati non sono visibili in nessuna pagina                   | Studio Library           |
| 5  | Manca hub "I miei brand"                                                                | Studio Library           |
| 6  | 3 pagine materials separate, tutte vuote eccetto Brand Embassy                         | Materials                |
| 7  | Material View non aggrega i materiali dei brand certificati                            | Materials                |
| 8  | Material View CTA "Aggiungi Materiale" non importa dai Brand Atlas                     | Materials                |
| 9  | Nessun hub Prodotti aggregato (Inspirations tab Prodotti vuoto)                        | Products                 |
| 10 | **Nessun ponte Brand Embassy → Moodboard Editor** (no "Add to Moodboard" su card)      | Moodboards               |
| 11 | 5 archivi concorrenti senza gerarchia chiara (Inspirations, Brand Atlas, Studio Collections, Material View, Library) | IA Globale  |
| 12 | Studio Collections mostra 0 prodotti ARBI mentre Brand Atlas mostra 398                | Studio Collections       |

### 🟡 P1 — generano confusione (10 issue)

| #  | Issue                                                                                 | Sezione                  |
|----|---------------------------------------------------------------------------------------|--------------------------|
| 13 | Top CTA "+ Nuovo Lead" non corrisponde al mental model designer                        | Dashboard                |
| 14 | "Aggiungi produttore" visibile a tutti i ruoli                                         | Brand Atlas              |
| 15 | Nessun feedback contestuale dopo "Add to Studio Library"                               | Brand Embassy            |
| 16 | Studio Library™ non esiste come pagina propria                                         | Studio Library           |
| 17 | Click su product card Embassy non apre dettaglio                                       | Brand Embassy            |
| 18 | Nessuna ricerca cross-brand materiali / prodotti                                       | Materials/Products       |
| 19 | Disclaimer Moodboard contraddice il bottone "Nuova Moodboard"                          | Moodboards               |
| 20 | Asset aggiunti a Moodboard perdono link al brand certificato                            | Moodboards               |
| 21 | Logo M non riporta a Dashboard                                                          | Globale                  |
| 22 | Breadcrumb assente o incoerente fra pagine                                              | Globale                  |

### 🟢 P2 — miglioramenti (8 issue)

| #  | Issue                                                                                 |
|----|---------------------------------------------------------------------------------------|
| 23 | Titolo "Dashboard Operativa" è linguaggio CRM, non design                              |
| 24 | Doppio CTA per la stessa azione (card cliccabile + "Entra nell'atelier")               |
| 25 | Nessun ordinamento esplicito brand (alfabetico/recenti/certificati)                    |
| 26 | Solo Share Brand copia URL — manca preview pubblica esterna                            |
| 27 | Materials Embassy senza immagini reali (solo gradient swatch)                          |
| 28 | Designer card Embassy senza foto                                                       |
| 29 | "Apri Blueprint Dashboard" su Moodboards aggiunge destinazione ambigua                 |
| 30 | Tab di stato Moodboard eccessivi quando l'archivio è vuoto                             |

---

## 🛠️ Piano di rimedio raccomandato (no nuovi moduli)

Per ridurre il percorso `Studio brand → Moodboard` a **3-4 click**:

### Sprint A · Sidebar + Navigation (P0 #1-2, P1 #21-22)
1. Aggiungere **label persistenti** sotto le icone (o sidebar espandibile di default su desktop)
2. Logo M → link a Dashboard
3. Breadcrumb coerente su ogni pagina principale
4. Banner Dashboard "Explore Brand Atlas™" come primo CTA contestuale

### Sprint B · Connettere Brand → Moodboard (P0 #10, #11, #12)
5. Aggiungere `Add to Moodboard` su ProductCard / MaterialCard dell'Embassy
6. Moodboard Editor: picker laterale "Brand library" che legge `studio_brand_links`
7. Eliminare Studio Collections (`/inspirations/collections`) OPPURE consolidarla con Studio Library™ in un'unica pagina `/library/brands` che mostra i `studio_brand_links` + drill-down

### Sprint C · Materials / Products unification (P0 #6-9)
8. **Material View** → query aggregata: tutti i materiali dei brand `studio_brand_links` (no più "vuoto")
9. **Inspirations tab Prodotti** → idem per prodotti
10. Rimuovere `/library/materials` e `/library/collections` come route duplicate (redirect → `/inspirations/...`)

### Sprint D · Fix duplicati e ruoli (P0 #3, P1 #14)
11. Deduplicare i brand record duplicati nel DB (UI: warning automatico se brand con stesso nome)
12. Nascondere "Aggiungi produttore" / "Cambia hero" se ruolo ≠ admin/superadmin

---

## 🎯 Risultato atteso post-rimedio

| Percorso                              | Oggi          | Dopo sprint A-D    |
|---------------------------------------|---------------|--------------------|
| Dashboard → Brand Atlas → ARBI        | 2-4 click     | **1 click** (CTA banner) |
| ARBI → "Aggiungi a moodboard"         | impossibile   | **1 click** (Add to Moodboard su card) |
| ARBI → moodboard composta             | 6-8 click     | **3 click** (Brand Atlas → ARBI → Add) |
| Trovare i materiali del brand collegato | impossibile | **2 click** (Material View aggrega studio_brand_links) |

**Obiettivo "3-4 click max" raggiungibile senza creare nuovi moduli.**

---

## 📦 Deliverable

Solo questo report. Nessun codice modificato.

**Generato**: 2026-06-03
**Brand testato**: ARBI Test Bathroom
**User profile**: admin@moodfordesign.com (super_admin)
**Tool**: Playwright browser automation
