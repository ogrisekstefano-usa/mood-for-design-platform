# DASHBOARD COPY AUDIT — ITER181.C

**Sprint:** ITER181.C · Dashboard Governance Fix™  
**Data chiusura:** 2026-06-01  
**Scope:** copy review della dashboard + pagina Leads + sidebar + topbar + banner + empty states.

---

## 1 · Filosofia copy

- **Tono:** professionale · internazionale · chiaro · credibile · executive.
- **Vietato:** poetico · teatrale · luxury-marketing · pseudo-editoriale.
- **Lunghezza:** 1 frase dichiarativa per empty state; max 2 frasi per lede di sezione.
- **Persona:** seconda persona singolare informale (tu) o impersonale ("Registra…", "Pianifica…").

---

## 2 · CTA — etichette correnti

| Posizione | Testo |
|---|---|
| Topbar primary CTA (prospects=0) | **+ Nuovo Lead** |
| Topbar primary CTA (prospects>0) | **+ Nuovo Design Journey™** |
| Quick Action 1 (scenario A) | **Nuovo Lead** |
| Quick Action 1 (scenario B, leads>0) | **Qualifica Prospect** |
| Quick Action 1 (scenario C, prospects>0) | **Nuovo Design Journey** |
| Quick Action 1 (scenario D, journeys>0) | **Apri Journey** |
| Activation step CTAs | Configura identità · Apri impostazioni · Invita un membro · Configura mercato · Apri workspace |
| Banner sticky CTA | (dinamico: deriva da `next_action.cta_label`) |
| Leads page primary | **+ Nuovo Lead** (toolbar) |
| Sidebar Active Journey Rail empty | (rimosso · niente CTA, solo "Nessun Design Journey attivo.") |

---

## 3 · Hero · Dashboard

| Elemento | Testo |
|---|---|
| Eyebrow | **Dashboard operativa** |
| Greeting | Buongiorno · Buon pomeriggio · Buonasera + nome utente |
| Summary | `{N} Lead · {N} Prospect · {N} Journey attive` |
| KPI labels | Lead · Prospect · Clienti · Journey attive |

---

## 4 · WorkspaceActionHub

### Setup mode

| Elemento | Testo |
|---|---|
| Eyebrow | **SETUP WORKSPACE** |
| Counter | `{completed}/{total} completati` |
| Col 1 eyebrow | **CHECKLIST** |
| Col 2 eyebrow | **AZIONI RAPIDE** |

### Ready mode (post-setup)

Il blocco scompare. Le Quick Actions appaiono come sezione standalone con eyebrow **QUICK ACTIONS**.

---

## 5 · Pagina Leads · copy completa

| Elemento | Testo nuovo (ITER181.C) |
|---|---|
| Eyebrow | `CRM · DISCOVERY` |
| Title | `Leads` |
| Lede | `Contatti da qualificare. I Lead rappresentano persone o aziende che hanno manifestato un interesse verso lo studio, un progetto o un servizio. Registra, organizza e qualifica ogni contatto prima di trasformarlo in Prospect.` |
| Result bar | `{N} Lead registrato` / `{N} Lead registrati` (plurale corretto) |
| Search placeholder | `Cerca per nome o email…` |
| Primary CTA | `+ Nuovo Lead` |
| Empty title | `Nessun Lead registrato.` |
| Empty subtitle | `Usa "+ Nuovo Lead" per registrare il primo contatto.` |
| Filter chips | (rimossi tutti — nessun filtro reale dietro) |

---

## 6 · NewRelationshipModal

| Elemento | Testo |
|---|---|
| Eyebrow | **CRM · NUOVO LEAD** (ITER181.C: era "CRM · Nuova Relazione") |
| Step 1 question | `Da dove vuoi iniziare?` |
| Step 1 choices | Lead · Prospect · Cliente |
| Step 2 form fields | Nome* · Cognome · Email · Telefono |
| Primary CTA | `Crea Lead + apri Discovery` |
| Secondary CTA | `Indietro` |

---

## 7 · Empty states (dashboard)

| Sezione | Testo |
|---|---|
| Design Journey attive | `Nessuna Design Journey attiva.` |
| Attività recenti | `Nessuna attività registrata.` |
| Prossime scadenze | `Nessuna scadenza in arrivo.` |
| Attività relazionali (timeline) | `Nessuna attività registrata. Le attività di Lead, Prospect, Clienti e Design Journey appariranno qui.` |
| Sidebar Active Journey Rail | `Nessun Design Journey attivo.` |

**Regola:** una frase dichiarativa. Nessun call-to-action testuale (gli CTA sono pulsanti). Nessuna parola decorativa.

---

## 8 · Activation step descriptions

| Step | Description (backend `_AF_CATALOGUE`) |
|---|---|
| identity | `Nome studio, lingua principale e timezone.` |
| blueprint | `Scegli lo stile visivo che definisce lo studio.` |
| team | `Invita il primo collaboratore (designer, project manager, sales).` |
| market | `Imposta il mercato principale dello studio (IT, EU, US, UK, Globale).` |
| workspace | `Configura almeno un tipo di progetto (residenziale, retail, hospitality…).` |

---

## 9 · Sidebar (post-rebrand)

| Group | Items |
|---|---|
| Workspace | Dashboard · Workspace · Leads · Prospects · Accounts · Clienti |
| **Blueprint Dashboard** (era "Studio Pulse") | Hero · KPI · Recent activity · Milestones |
| **Design Journey** (era "Indice Journey") | Design Journey · + Nuovo Design Journey |
| Library | Media Library · Materiali · Moodboard |
| Editorial | Calendario Editoriale · Cultural Editions · Copy CMS |
| Settings | Identità · Members · Languages |

---

## 10 · Termini bannati · verifica post-fix

Eseguito audit con `grep -i` sulla superficie dashboard:

| Termine | Trovato sulla dashboard? |
|---|---|
| atmosfera | ❌ no |
| temperamento | ❌ no |
| atelier interiore | ❌ no |
| viaggio progettuale | ❌ no |
| memoria in evoluzione | ❌ no |
| primo capitolo | ❌ no |
| relazione che respira | ❌ no |
| Studio Pulse | ❌ no |
| Nuova Relazione | ❌ no |
| Segnali | ❌ no |

---

**Audit completo. Tutte le copy della dashboard rispettano Copy Governance C3 e il principio dei 2 secondi.**
