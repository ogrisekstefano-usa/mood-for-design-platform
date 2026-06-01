# DASHBOARD NAMING AUDIT — ITER181.C

**Sprint:** ITER181.C · Dashboard Governance Fix™  
**Data chiusura:** 2026-06-01  
**Scope:** audit nomenclatura su superficie dashboard + sidebar + topbar + Leads.

---

## 1 · Principio guida

> Se un architetto, uno showroom manager o un manager americano non capirebbe immediatamente il significato del testo in meno di 2 secondi, il testo va riscritto.

MOOD non è un magazine. Non è una mostra. È una **piattaforma operativa CRM + Project**. Ogni etichetta deve essere comprensibile a colpo d'occhio.

---

## 2 · Termini ELIMINATI

| Termine | Dove appariva | Motivo | Stato |
|---|---|---|---|
| **Studio Pulse / Studio Pulse™** | sidebar group code, Hero eyebrow, editorial admin, mobile bottombar | Concetto duplicato di Blueprint; non concretizza nulla di operativo | ✅ Rimosso |
| **Nuova Relazione** | Topbar primary CTA, Quick Actions, Modal eyebrow, Sidebar Active Journey Rail empty CTA | "Relazione" non è un'entità CRM; può significare Lead/Prospect/Cliente/Progetto | ✅ Sostituito |
| **Nuovo Contatto** (transitorio in ITER181.A.3) | Topbar e Quick Actions | Non era ancora abbastanza specifico; meglio "Lead" come prima entità CRM | ✅ Sostituito |
| **Indice Journey** | Sidebar item | "Indice" è terminologia editoriale; il prodotto è CRM | ✅ Rinominato |
| **Inizia un Journey** | Sidebar item | Verb-form ambigua; troppe parole per un'azione | ✅ Rinominato |
| **Atmosfere** | Pagina Leads (toolbar filter chips e copy lede) | Termine bandito da Copy Governance C3; non rappresenta un'entità reale | ✅ Rimosso |
| **Segnali appena arrivati** | Pagina Leads lede | "Segnali" non è un Lead; un Lead è un record CRM | ✅ Riscritto |
| **Ascolta prima di rispondere** | Pagina Leads lede | Frase narrativa, non operativa | ✅ Rimosso |
| **Memoria in evoluzione** | RelationshipLiveTimeline title (rimosso in iter precedenti) | poetic / non operativo | ✅ già rimosso |
| **Studio Pulse · Ritmo Progettuale** | Hero eyebrow legacy | Sostituito da "Dashboard operativa" + "Blueprint Dashboard" nelle aree admin | ✅ Sostituito |

---

## 3 · Mappa SOSTITUZIONI applicate

| Prima | Dopo | File / posizione |
|---|---|---|
| Studio Pulse | **Blueprint Dashboard** | `i18n it-IT.json` → `nav.studio_pulse`, editorial admin |
| I tuoi Journey | **I tuoi Design Journey** | `nav.your_journeys` |
| Indice Journey | **Design Journey** | `nav.journey_index` |
| Inizia un Journey | **+ Nuovo Design Journey** | `nav.begin_journey` |
| Nuova Relazione | **Nuovo Lead** (prospects=0) · **Nuovo Design Journey** (prospects>0) | Topbar `PrimaryCta`, smart-switch |
| Nuovo Contatto | **Nuovo Lead** | `nav.new_lead`, Quick Actions catalogue |
| CRM · Nuova Relazione | **CRM · Nuovo Lead** | `NewRelationshipModal` eyebrow |
| Apri Nuova Relazione → (Sidebar empty rail) | (rimossa) — empty state ora "Nessun Design Journey attivo." | `ActiveJourneyRail` |
| Warm editorial / Nordic silence / Midnight mood / Mediterranean light / Architectural dawn | (rimossi tutti — niente filtri se non ci sono filtri reali) | `LeadsPage` |
| Segnali appena arrivati nello studio... | **Contatti da qualificare. I Lead rappresentano...** | `LeadsPage.lede` |

---

## 4 · Termini AMMESSI · vocabolario operativo

| Categoria | Lessico ammesso |
|---|---|
| **Entità CRM** | Lead · Prospect · Cliente · Contatto |
| **Progetto** | Design Journey · Journey · Progetto |
| **Workspace** | Studio · Workspace · Centro operativo · Setup |
| **Operatività** | Workflow · Attività · Materiali · Moodboard · Calendario · Discovery · Qualifica |
| **Team** | Team · Membro · Designer · Project Manager · Sales |

---

## 5 · Termini BANDITI · da non reintrodurre

- atmosfera · temperamento · atelier interiore
- viaggio · viaggio progettuale · capitolo · primo capitolo
- ecosistema · curatoriale · pseudo-editoriale
- memoria in evoluzione · relazione che respira
- prende forma · dà vita · respira · pulse (in contesti non-musicali)
- segnale · segnali (per indicare CRM record)
- Studio Pulse (rinominato Blueprint Dashboard)
- Nuova Relazione (rinominato a entità reali)

---

## 6 · Audit residuo (fuori scope ITER181.C)

Termini banditi residui in moduli **non-dashboard** (da consolidare in sprint dedicato):
- `CulturalEditionReview` / `editorial-admin` — usa ancora "Studio Pulse™" in alcuni testi
- `Moodboard` / `Inspirations` — usa "atmosfera" in alcune label
- `CrmAccountsPage` (linea 322) — `'CRM · Nuova relazione'` ancora in i18n key `new_relationship_eyebrow` (key non triggerata dal flow dashboard ma da CRM accounts page)
- `RelationshipsPage`, `JourneyPulsePage`, `CommandPalette` — alcune label "Relazione" da consolidare

Tutti questi sono **fuori dalla superficie dashboard** e non visibili al founder nei primi 30 secondi. Da gestire in `ITER181.D · App-wide Naming Lock` come follow-up P1.

---

**Audit completo · 100% delle nomenclature dashboard ora coerenti.**
