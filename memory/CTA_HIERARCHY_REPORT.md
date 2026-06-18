# CTA HIERARCHY REPORT
## MOOD for DESIGN™ — Dual Funnel Strategy Audit

> **Data:** Giugno 2026  
> **Obiettivo:** Mappatura completa delle CTA pubbliche del sito per verificare la chiarezza della strategia dual funnel: "Parlare con lo studio" vs "Descrivere il proprio progetto" entro 5 secondi.

---

## SUCCESS CRITERIA

> Un visitatore deve capire in meno di 5 secondi:
> 1. **Posso parlare con lo studio** → "Prenota una consulenza"
> 2. **Posso descrivere il mio progetto** → "Raccontaci il tuo progetto" / "Brief di Progetto"
>
> **Senza confusione tra i due percorsi.**

---

## A. CTA PRIMARIE — Human First

**Destinazione:** `/consulenza` (alias: `BeginJourneyPage`)  
**Intento:** Contatto diretto, appuntamento, relazione umana con lo studio.

| Posizione | Label | Componente | data-testid |
|-----------|-------|-----------|-------------|
| Header sticky (desktop) | "Prenota una consulenza" | `HomePage.jsx` | `header-cta-start-project` |
| Menu mobile | "Prenota una consulenza" | `HomePage.jsx` | `mobile-menu-cta` |
| Hero section | "Prenota una consulenza" | `HomePage.jsx` | `hero-cta-primary` |
| Sezione "Come lavoriamo" | "Prenota una consulenza" | `HomePage.jsx` | `how-cta` |
| Final CTA (dark band) | "Prenota una consulenza" | `HomePage.jsx` | `final-cta-private` |
| Final CTA — link testuale | "Contattaci" | `HomePage.jsx` | `final-cta-contact` |
| Footer — colonna Contatti | "Prenota una consulenza" | `MoodSiteFooter.jsx` | — |
| About — Hero | "Prenota una consulenza" | `AboutPage.jsx` | `about-hero-cta-primary` |
| About — Final CTA | "Prenota una consulenza" | `AboutPage.jsx` | `about-cta-private` |
| Services — Hero | "Prenota una consulenza" | `ServicesPage.jsx` | `services-hero-cta1` |
| Services — Final CTA | "Prenota una consulenza" | `ServicesPage.jsx` | `services-finalcta-cta1` |
| Professionals — Hero | "Prenota una consulenza" | `ProfessionalsGatewayPage.jsx` | `pro-cta-primary` |
| Professionals — Final CTA | "Prenota una consulenza" | `ProfessionalsGatewayPage.jsx` | `pro-finalcta-cta1` |

**Densità:** 13 punti di contatto. Gerarchia visiva corretta (solid → outline → link testuale).

---

## B. CTA SECONDARIE — Project First

**Destinazione:** `/begin-journey` (alias: `BeginJourneyPage`)  
**Intento:** Il visitatore descrive autonomamente il proprio progetto, senza appuntamento.

| Posizione | Label | Componente | data-testid | Stato |
|-----------|-------|-----------|-------------|-------|
| Sezione DigitalJourneyHighlight (Homepage) | "Compila il brief" | `HomePage.jsx` | `journey-hl-cta` | ✅ LIVE |
| Footer — colonna Contatti | "Brief di Progetto" | `MoodSiteFooter.jsx` | — | ✅ LIVE (patch 2026-06-18) |

**Densità:** 2 punti strategici — corretto per una CTA secondaria.

**Contesto visivo (Homepage):**
- Eyebrow: "BRIEF DI PROGETTO"
- Titolo: "Raccontaci il tuo progetto"
- Copy: "Condividi esigenze, stile, tempistiche e obiettivi. Ti aiuteremo a trasformare le idee in un progetto concreto."
- CTA: "Compila il brief →"

---

## C. CTA EDITORIALI — Content Discovery

**Intento:** Invitano alla scoperta dei contenuti, non generano lead direttamente.

| Label | Destinazione | Componente | Posizione |
|-------|-------------|-----------|-----------|
| "Leggi l'articolo" | `/magazine/:slug` | `HomePage.jsx` | Sezione Magazine (per card) |
| "Scopri il progetto" | `/projects/:slug` | `HomePage.jsx` | Sezione Progetti (per card) |
| "Vedi tutti i progetti" | `/projects` | `HomePage.jsx` | Sezione Progetti — footer di sezione |
| "nostro magazine" | `/magazine` | `HomePage.jsx` | Editorial Statement |
| "Scopri i nostri progetti" | `/projects` | `ProfessionalsGatewayPage.jsx` | Hero secondary |

**Valutazione:** ✅ Neutrale — nessuna competizione con le CTA di conversione.

---

## D. ANOMALIE — CTA Concorrenti / Legacy

> Le CTA seguenti puntano a destinazioni non allineate con la dual funnel strategy approvata. Richiedono una decisione prima del go-live.

### D1. `/start-project` (LEGACY — da valutare)

**`StartProjectWizard`** — Wizard autonomo, distinto da `BeginJourneyPage`.

| File | Contesto | Label visualizzata |
|------|---------|-------------------|
| `MagazinePage.jsx:111` | Sotto la griglia articoli | "Inizia il tuo progetto" (o variante) |
| `MagazineArticlePage.jsx:357` | Sidebar articolo — CTA per-sezione | Etichetta CMS |
| `MagazineArticlePage.jsx:463` | Post-salvataggio soft-modal | Redirect automatico |
| `ProjectDetailPage.jsx:315` | CTA per design story in-page | Etichetta CMS |
| `ProjectDetailPage.jsx:467` | Final CTA del progetto | CTA primaria |

**Raccomandazione:** Verificare se `StartProjectWizard` è ancora necessario. Se `BeginJourneyPage` (`/begin-journey`) copre lo stesso caso d'uso, consolidare i due wizard in uno solo puntando a `/begin-journey`. Questo eliminerebbe 5 punti di confusione.

---

### D2. `/onboarding/private` e `/onboarding/pro` (PLACEHOLDER — da rimuovere)

**`OnboardingPlaceholderPage`** — Pagina placeholder senza contenuto definitivo.

| File | Contesto | Label visualizzata |
|------|---------|-------------------|
| `ProjectDetailPage.jsx:477` | Final CTA — percorso privato | "Inizia un progetto privato" (o variante) |
| `ProjectsIndexPage.jsx:198` | Final CTA — percorso privato | CTA primaria |
| `ProjectsIndexPage.jsx:201` | Final CTA — percorso pro | CTA secondaria |

**Raccomandazione:** Sostituire con `/begin-journey` (privato) e `/professionals` (pro). Le pagine `/onboarding/:kind` sono placeholder non completate — esporle a utenti reali crea aspettative non soddisfatte.

---

## VALUTAZIONE 5-SECOND TEST

### Scenario Homepage — Primo accesso

| Secondo | Ciò che il visitatore vede | Chiarezza |
|---------|--------------------------|-----------|
| 0–1 | Header sticky: **"PRENOTA UNA CONSULENZA"** (solid, dark) | ✅ Chiaro |
| 1–3 | Hero: Headline + **"PRENOTA UNA CONSULENZA"** (solid) + "PER I PROFESSIONISTI" (ghost) | ✅ Chiaro |
| 3–5 | Primo scroll: contenuto editoriale, nessuna CTA competitiva visibile | ✅ Nessuna confusione |

**Verdetto Hero: PASS** — Il visitatore capisce in <2 secondi che può "parlare con lo studio".

---

### Scenario DigitalJourneyHighlight — Scrolling

| Sezione | CTA visibile | Funnel |
|---------|-------------|--------|
| Brief di Progetto | "COMPILA IL BRIEF →" | Secondario (Project First) |
| Final CTA (dark) | "PRENOTA UNA CONSULENZA" | Primario (Human First) |

**Verdetto Scrolling: PASS** — I due funnel sono separati spazialmente, con gerarchia visiva distinta (headline serif = secondario / solid button dark = primario).

---

## SINTESI ESECUTIVA

| Categoria | Stato | Note |
|-----------|-------|------|
| A. CTA Primarie `/consulenza` | ✅ CONFORME | 13 punti di contatto coerenti |
| B. CTA Secondarie `/begin-journey` | ✅ CONFORME | 2 punti strategici — Homepage + Footer |
| C. CTA Editoriali | ✅ NEUTRALE | Nessuna competizione |
| D1. `/start-project` (legacy) | ⚠️ DA CONSOLIDARE | 5 file — wizard duplicato |
| D2. `/onboarding/:kind` (placeholder) | ⚠️ DA RIMUOVERE | 3 link — pagina incompleta |

**Giudizio globale: STRATEGIA DUAL FUNNEL IMPLEMENTATA.**  
La homepage comunica chiaramente i 2 percorsi entro 5 secondi. Le anomalie D1/D2 non impattano la homepage ma vanno risolte prima del go-live sulle pagine Magazine, Progetti e Servizi.

---

## PIANO D'AZIONE CONSIGLIATO

### Priorità P0 (pre go-live)
- [ ] Decidere il destino di `/start-project` — consolidare con `/begin-journey` o mantenere separato?

### Priorità P1 (prima campagna marketing)
- [ ] `MagazineArticlePage`: sostituire CTA → `/begin-journey`
- [ ] `ProjectDetailPage`: sostituire `/start-project` e `/onboarding/private` → `/begin-journey`
- [ ] `ProjectsIndexPage`: sostituire `/onboarding/private` e `/onboarding/pro` → `/begin-journey` e `/professionals`
- [ ] `MagazinePage`: sostituire `/start-project` → `/begin-journey`

### Priorità P2 (ottimizzazione post-lancio)
- [ ] A/B test: misurare conversion rate `/consulenza` vs `/begin-journey` per ottimizzare la proporzione primario/secondario

---

*Documento generato in automatico da scansione statica del codice sorgente `/app/frontend/src/pages/site/` + verifica snapshot CMS live.*  
*Archiviato in `/app/memory/CTA_HIERARCHY_REPORT.md`*
