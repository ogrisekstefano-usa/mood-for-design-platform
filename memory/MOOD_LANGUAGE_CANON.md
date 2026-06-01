# MOOD LANGUAGE CANON™

**Sprint:** ITER182 · MOOD Language Lock™  
**Versione:** 1.0  
**Data:** 2026-06-01  
**Owner:** Product Governance  
**Status:** OFFICIAL · governance binding per UI, UX writing, dashboard, CRM, Design Journey, Libraries, Editorial, Onboarding, Modali, Traduzioni, Future Features, AI Agents.

---

## 0 · Principio costituzionale

> **Brand ≠ Interfaccia.**  
> Il Brand può avere personalità. L'interfaccia deve essere operativa.

MOOD è oggi una piattaforma utilizzata da showroom, negozi di arredamento, interior designer, architetti, studi di progettazione, project manager, sales manager e advisor.  
Il linguaggio deve essere **professionale · internazionale · comprensibile · coerente · credibile**, senza perdere identità.

---

## 1 · Quality test (regola dei 2 secondi)

Ogni nuovo testo deve superare la domanda:

> *"Un manager americano, un architetto, un interior designer o il titolare di uno showroom capirebbe immediatamente questo termine?"*

Se la risposta è **NO** → riscrivere.

---

## 2 · LIVELLO 1 · BRAND LANGUAGE (consentito)

Nomi prodotto registrati. **Non vanno modificati né tradotti** (eccetto formattazione locale del simbolo ™):

- MOOD for DESIGN™
- Design Journey™
- Blueprint™
- Blueprint Chameleon™
- Material View™
- Brand Atlas™
- Cultural Editions™
- Design Stories™

Possono apparire in tutte le superfici (marketing, dashboard, sidebar, modali). Capitalizzazione fissa, sempre con ™ a meno di vincoli tipografici stretti.

---

## 3 · LIVELLO 2 · UI LANGUAGE

La UI deve essere:

| Requisito | Esempio |
|---|---|
| **chiara** | "Nessun Lead registrato." |
| **immediata** | "Nuovo Lead" |
| **concreta** | "Calendario Editoriale" |
| **internazionale** | "Media Library" (concetto universale, anche in IT) |

Mai:

| Anti-pattern | Esempio sbagliato | Alternativa |
|---|---|---|
| poetica | "Il tuo atelier è in silenzio." | "Nessuna Design Journey attiva." |
| teatrale | "Il primo capitolo del rapporto" | "Discovery Interview" |
| metaforica | "Segnali appena arrivati" | "Lead da qualificare" |
| interpretativa | "Cura le atmosfere" | "Pianifica i contenuti" |
| pseudo-editoriale | "Curatorial moodboard" | "Moodboard" |

---

## 4 · VOCABOLARIO APPROVATO

### 4.1 · Entità CRM (canon assoluto)
- **Lead** · **Prospect** · **Cliente** · **Contatto** · **Azienda** · **Architetto** · **Studio Partner**

### 4.2 · Entità Progetto
- **Design Journey** · **Journey** · **Progetto** · **Milestone** · **Deliverable** · **Discovery** · **Proposal**

### 4.3 · Entità Workspace
- **Workspace** · **Studio** · **Setup** · **Identità operativa** · **Mercato operativo**

### 4.4 · Entità Library
- **Media Library** · **Material View** · **Materiali** · **Moodboard** · **Brand Atlas** · **Inspirations**

### 4.5 · Entità Editorial
- **Editorial Calendar** · **Calendario Editoriale** · **Cultural Editions** · **Design Stories**

### 4.6 · Entità Operatività
- **Attività** · **Workflow** · **Discovery Interview** · **Qualifica** · **Promozione** · **Conversione** · **Activation Foundation** · **Workspace Activated™**

### 4.7 · Entità Team
- **Team** · **Membro** · **Designer** · **Project Manager** · **Sales** · **Advisor**

### 4.8 · Dashboard KPI ufficiali
1. **Lead**
2. **Prospect**
3. **Clienti**
4. **Design Journey Attive**

---

## 5 · LISTA NERA UFFICIALE

I termini che seguono sono **banditi** da UI, copy, empty states, KPI labels, i18n e modali. Il loro uso è ammesso solo in:
- nomi di codice / data-testid (identificatori tecnici)
- documentazione interna di architettura
- payload backend interni invisibili all'utente

| Termine | Severity | Sostituzione canonica |
|---|---|---|
| atmosfera / atmosfere | 🔴 critical | "stile" · "mood" · "look" · — (rimuovere) |
| segnale / segnali (per CRM record) | 🔴 critical | "Lead" |
| relazione / relazioni (per CRM) | 🔴 critical | "Lead" · "Prospect" · "Cliente" · "Contatto" |
| nuova relazione | 🔴 critical | "Nuovo Lead" · "Nuovo Prospect" · "Nuovo Cliente" · "Nuovo Design Journey" |
| curatoriale / curatorial | 🟠 high | "selezionato" · "editoriale" · — (rimuovere) |
| temperamento | 🟠 high | "stile" · "preset" |
| ecosistema | 🟠 high | "workspace" · "piattaforma" · "studio" |
| ritmo (in copy operativa) | 🟡 medium | "frequenza" · "cadenza" · "attività" |
| viaggio / viaggio progettuale | 🟠 high | "Design Journey" · "progetto" |
| capitolo / primo capitolo | 🟠 high | "Discovery" · "step" · "fase" |
| Studio Pulse | 🔴 critical | "Blueprint Dashboard" · "Dashboard operativa" |
| Journey Pulse | 🔴 critical | "Design Journey Overview" · "Journey Index" |
| Signal Listening | 🔴 critical | "Lead Pipeline" |
| Active Studio | 🟠 high | "Workspace attivo" |
| Cultivation | 🟠 high | "Nurture" · "Follow-up" · — (rimuovere) |
| Warm Editorial · Nordic Silence · Mediterranean Light · Architectural Dawn · Midnight Mood | 🟠 high | rimuovere (sono filtri fake) · sostituire solo con filtri reali |
| Memory (come entità CRM) | 🟠 high | "Attività" · "Interaction Log" |
| Listening Queue | 🟠 high | "Lead Queue" · "Pipeline" |
| Editorial Mood | 🟡 medium | "Editorial Style" |
| Creative Flow | 🟡 medium | "Workflow" |
| Studio Narrative | 🟠 high | "Studio Profile" |
| Narrative Layer | 🟠 high | "Content Layer" · — (rimuovere) |
| Memoria viva · Interazione organica · Presenza · Connessione (come CRM concept) | 🟠 high | "Attività" · "Contatto" · "Interaction" |

**Severity legend:**
- 🔴 **critical** = visibile in superficie dashboard / topbar / sidebar / modali principali → da rimuovere subito.
- 🟠 **high** = visibile in pagine secondarie operative (Library, Inspirations, CRM lists) → da rimuovere a breve.
- 🟡 **medium** = visibile solo in pagine admin / settings / blog / marketing → roadmap di lungo termine.

---

## 6 · CRM GOVERNANCE

| Approvato | Vietato |
|---|---|
| Lead | Segnale |
| Prospect | Relazione |
| Cliente | Connessione |
| Contatto | Presenza |
| Azienda | Memoria viva |
| Architetto | Interazione organica |
| Studio Partner | — |

**Regola CRM-flow:** Lead → Discovery Interview → Prospect → Design Journey → Cliente. Nessuna scorciatoia, nessuna nomenclatura alternativa.

---

## 7 · DASHBOARD GOVERNANCE

### KPI approvati
1. **Lead**
2. **Prospect**
3. **Clienti**
4. **Design Journey Attive**

### KPI vietati
- Segnali
- Relazioni
- Connessioni
- Presenze
- Memorie
- Voices / Vocii
- Active Journeys (al posto di "Design Journey Attive")
- Dossier in progress
- Awaiting feedback
- Deliveries this week

### Sezioni dashboard (label canonici)
- **Hero**: "Dashboard operativa"
- **Setup**: "Setup Workspace"
- **Quick Actions**: "Azioni rapide" · "Quick Actions"
- **Journey**: "Design Journey attive"
- **Attività**: "Attività recenti"
- **Scadenze**: "Prossime scadenze"
- **Timeline**: "Attività relazionali"

### Banner sticky (Activation Foundation)
- Eyebrow: `Setup workspace · N/total`
- Title: usa il `title` dello step da `_AF_CATALOGUE`
- CTA: usa il `cta_label` dello step

---

## 8 · EMPTY STATES

Regola: **1 frase dichiarativa**. No narrazione. No call-to-action testuale (gli CTA sono pulsanti).

| Sezione | Empty state approvato |
|---|---|
| Design Journey attive | "Nessuna Design Journey attiva." |
| Attività recenti | "Nessuna attività registrata." |
| Prossime scadenze | "Nessuna scadenza in arrivo." |
| Attività relazionali (timeline) | "Nessuna attività registrata. Le attività di Lead, Prospect, Clienti e Design Journey appariranno qui." |
| Leads page | "Nessun Lead registrato." + sub "Usa '+ Nuovo Lead' per registrare il primo contatto." |
| Sidebar Active Journey Rail | "Nessun Design Journey attivo." |
| Moodboards | "Nessun moodboard creato." |
| Materials | "Nessun materiale catalogato." |
| Editorial Calendar | "Nessun contenuto pianificato." |

### Empty states vietati
- ❌ "Il tuo atelier è in silenzio."
- ❌ "Nessun segnale, per ora."
- ❌ "Quando la relazione respirerà, le memorie emergeranno qui."
- ❌ "L'ecosistema attende il primo capitolo."

---

## 9 · SIDEBAR GOVERNANCE

Struttura canonica (post-cleanup):

| Group | Items |
|---|---|
| **Workspace** | Dashboard · Workspace · Calendar |
| **Blueprint Dashboard** (era "Studio Pulse") | Hero · KPI · Recent activity · Milestones |
| **Design Journey** (era "Indice Journey" / "Inizia un Journey") | Design Journey · + Nuovo Design Journey |
| **CRM** | Leads · Prospects · Accounts · Clienti |
| **Library** | Media Library · Material View · Moodboard · Brand Atlas |
| **Editorial** | Editorial Calendar · Cultural Editions · Copy CMS |
| **Settings** | Identità · Team · Languages |

### Regole sidebar
- Nessun item duplicato per la stessa funzione.
- Nessun item con label vaga ("Indice", "Inizia", "Apri").
- Massimo 7 items per group.
- Section header in `text-[10px] tracking-[0.22em] uppercase`.

---

## 10 · TRANSLATION GOVERNANCE

### Locales ufficiali (status attuale)

| Locale | Status | Note |
|---|---|---|
| **EN-US** | 🟢 MASTER | Lingua sorgente ufficiale. Ogni nuovo copy nasce qui. |
| **EN-GB** | 🟢 LIVE | Esiste in `/i18n/strings/en-GB.json`. |
| **IT-IT** | 🟢 LIVE | Esiste in `/i18n/strings/it-IT.json`. |
| **ES-ES** | 🟢 LIVE | Esiste in `/i18n/strings/es-ES.json`. |
| **DE-DE** | 🟢 LIVE | Esiste in `/i18n/strings/de-DE.json`. |
| **FR-FR** | 🟢 LIVE | Esiste in `/i18n/strings/fr-FR.json`. |
| **AR** | 🟡 LIVE (legacy) | Esiste in `/i18n/strings/ar.json`. Da promuovere o decommissionare. |
| **ES-MX** | 🔴 NON ESISTE | Da creare prima del lancio LATAM. |
| **PT-BR** | 🔴 NON ESISTE | Da creare prima del lancio BR. |

### Regola di localizzazione

1. **EN-US è la lingua sorgente.** Ogni nuovo copy deve essere approvato prima in EN-US.
2. Gli altri locales **adattano**, non reinterpretano: stesso significato, stessa gerarchia, stessa terminologia CRM/prodotto.
3. **Nomi prodotto Livello 1 non si traducono** (Design Journey™, Blueprint™, Material View™, ecc.).

### Esempio CORRETTO

| Locale | "New Lead" → |
|---|---|
| EN-US | New Lead |
| EN-GB | New Lead |
| IT-IT | Nuovo Lead |
| ES-ES | Nuevo Lead |
| ES-MX | Nuevo Lead |
| DE-DE | Neuer Lead |
| FR-FR | Nouveau Lead |
| PT-BR | Novo Lead |

### Esempio SBAGLIATO (reinterpretazione)

| Locale | Traduzione errata | Motivo |
|---|---|---|
| IT-IT | "Nuova Opportunità" | introduce nuova entità non canonica |
| IT-IT | "Nuova Relazione" | termine bandito |
| IT-IT | "Nuovo Contatto Qualificato" | confonde Lead con Prospect |
| FR-FR | "Nouvelle Piste" | reinterpreta concetto |

---

## 11 · MODAL / WIZARD GOVERNANCE

| Elemento modal | Regola |
|---|---|
| Eyebrow | `<MODULO> · <ENTITÀ>` in UPPERCASE (es. "CRM · NUOVO LEAD") |
| Title | sostantivo + verbo all'infinito (es. "Da dove vuoi iniziare?") |
| Field labels | sostantivo singolo (es. "Nome", "Email", "Telefono") · `*` per required |
| Primary CTA | verbo + entità (es. "Crea Lead + apri Discovery") |
| Secondary CTA | "Indietro" / "Annulla" |

---

## 12 · AI AGENTS PROMPT GOVERNANCE

Qualsiasi LLM o agente AI che produca copy per MOOD deve:

1. Citare in system prompt:  
   > "Adottare il MOOD_LANGUAGE_CANON.md: lessico CRM-first, mai poetic, mai narrativo. Lista nera in §5."
2. Restituire copy in lingua sorgente EN-US prima di tradurre.
3. Riportare in output un campo `forbidden_terms_check: []` con esito audit interno.

---

## 13 · ESCALATION & EXCEPTIONS

| Caso | Decisione |
|---|---|
| Nuovo nome prodotto candidato Livello 1 | Approvazione Product Governance + registrazione ™ |
| Termine borderline (es. "Studio Atelier") | Default reject; required approval Product Governance |
| Marketing site / Magazine / Cultural Editions | Lessico più libero ammesso (registro editoriale), MAI nella UI operativa |
| Termini legacy in route URL / data-testid (es. `modal:new-relationship`) | Conservare per backward-compat tecnica; sostituire solo le label visibili |

---

## 14 · ENFORCEMENT

- **Tooling:** `/app/scripts/copy_lint.py` mantenuto in CI come baseline. Estensione richiesta per coprire la lista nera completa di §5.
- **PR review:** ogni PR che tocca i18n o componenti UI deve passare `copy_lint.py` con zero nuove violazioni critical.
- **Test agent:** `testing_agent_v3_fork` esegue audit DOM-level dei termini critical sulle superfici dashboard/sidebar/leads/journey.
- **Onboarding nuovi developer:** lettura obbligatoria di questo documento prima del primo merge.

---

## 15 · REVISION LOG

| Versione | Data | Autore | Note |
|---|---|---|---|
| 1.0 | 2026-06-01 | Product Governance | Documento iniziale ITER182. |

---

**MOOD parla come una piattaforma internazionale per studi di progettazione, showroom, interior designer, architetti, project manager, sales manager.**  
**Non come una brochure creativa. Non come una rivista. Non come un esercizio poetico.**
