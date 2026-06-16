# PROFESSIONALS PAGE PLAN
## Blueprint Pagina Professionisti — CMS-Driven
**Data**: Giugno 2026  
**Vincolo**: ZERO nuove tabelle, ZERO nuovi section types

---

## OBIETTIVO

La pagina deve parlare a:
- Architetti e interior designer
- Developer e contractor
- Artigiani e maestranze specializzate
- Showroom e brand partner

**Non** vende il servizio al cliente finale.  
**Vende la collaborazione** con lo studio.

Messaggio centrale: *"Lavoriamo insieme. Il tuo lavoro, amplificato dalla nostra rete."*

---

## ANALISI SECTION TYPES ESISTENTI

### Verifica riutilizzo (obbligatoria per vincolo)

| Section Type | Cosa contiene | Riutilizzabile per professionals? | Come |
|-------------|--------------|----------------------------------|------|
| `hero_editorial` | Immagine, titolo, sub, CTA primaria/secondaria | ✅ SÌ | Hero della pagina |
| `atmosphere_statement` | Eyebrow, titolo grande serif, body, CTA | ✅ SÌ | Manifesto della collaborazione |
| `professionals_cta` | Eyebrow, titolo, body, CTA, href | ✅ SÌ | Blocchi per ogni tipo di professionista |
| `editorial_triptych` | 3 blocchi con titolo/testo | ✅ SÌ | Vantaggi della partnership (3 colonne) |
| `cinematic_quote` | Titolo grande, sub, 2 percorsi (privati/pro) | ✅ SÌ | CTA finale "Prenota una consulenza" |
| `design_journey` | Steps numerati + CTA | ✅ SÌ | Come inizia una collaborazione (4 step) |

**Conclusione: NESSUN nuovo section type necessario.** I 6 esistenti coprono completamente la struttura.

---

## STRUTTURA PAGINA

### Sezione 1: Hero (`hero_editorial`)
```
EYEBROW: "PER ARCHITETTI E DESIGNER"
TITOLO: "La tua competenza,\nil nostro metodo."
SUB: "Collaboriamo con professionisti del progetto per realizzare spazi che durano nel tempo."
CTA PRIMARIA: "Prenota una consulenza" → /consulenza
CTA SECONDARIA: "Scopri i nostri progetti" → /projects
```

### Sezione 2: Manifesto Collaborazione (`atmosphere_statement`)
```
EYEBROW: "PERCHÉ COLLABORARE"
TITOLO: "Non subappaltiamo.\nCo-progettiamo."
BODY: "Ogni collaborazione con lo studio è una partnership reale. Portiamo la nostra rete di fornitori, 
       la nostra metodologia e la nostra presenza sui cantieri — il tutto integrato con il tuo processo."
CTA: "Come lavoriamo" → /about
```

### Sezione 3: Tipi di Collaborazione (`professionals_cta`)
```
EYEBROW: "CHI PUÒ COLLABORARE"
TITOLO: "Architetti e Interior Designer"
BODY: "Hai un progetto residenziale o contract e cerchi uno studio partner per l'esecuzione? 
       Integriamo il tuo progetto con la nostra rete operativa."
CTA: "Prenota una consulenza" → /consulenza
```
*(Nota: la sezione `professionals_cta` ammette un solo blocco — la narrazione multi-target va gestita via editorial_triptych)*

### Sezione 4: Vantaggi Partnership (`editorial_triptych`)
```
BLOCCO 1:
  TITOLO: "Rete Fornitori"
  TESTO: "Accesso alla nostra selezione di artigiani, brand e maestranze."

BLOCCO 2:
  TITOLO: "Presenza Cantiere"
  TESTO: "Direzione lavori e supervisione dall'inizio alla consegna."

BLOCCO 3:
  TITOLO: "Gestione Progetto"
  TESTO: "Coordinamento fornitori, budget, timeline — tutto sotto un'unica regia."
```

### Sezione 5: Come Inizia (`design_journey`)
```
EYEBROW: "IL PROCESSO DI COLLABORAZIONE"
TITOLO: "Come nasce\nuna partnership."
STEP 1: "Primo contatto" — Ci racconti il progetto, le esigenze e la timeline.
STEP 2: "Assessment" — Valutiamo insieme la compatibilità e definiamo i ruoli.
STEP 3: "Accordo" — Formalizzazione dei termini e avvio operativo.
STEP 4: "Esecuzione" — Lavoriamo fianco a fianco, dalla progettazione alla consegna.
CTA: "Prenota una consulenza" → /consulenza
```

### Sezione 6: CTA Finale (`cinematic_quote`)
```
TITOLO: "Hai un progetto\nda realizzare insieme?"
SUB: "Lavoriamo con un numero selezionato di professionisti. Parliamoci."
CTA PRIMARIA: "Prenota una consulenza" → /consulenza
CTA SECONDARIA: "Scopri i nostri progetti" → /projects
```

---

## IMPLEMENTAZIONE TECNICA

### File da modificare
- `/app/frontend/src/pages/site/ProfessionalsGatewayPage.jsx` — rewrite CMS-driven
- `/app/backend/scripts/seed_professionals_page.py` — seed CMS

### File da NON toccare
- `cms_sections` schema — nessuna modifica
- `users_profile` — non necessario per professionals
- `professionalsContent.js` — può essere deprecato dopo il rewrite

### Pattern di implementazione
Seguire il pattern di `AboutPage.jsx`:
```jsx
const cms = useStorefrontContent(TENANT_SLUG, 'professionals');
// Legge sectionsByType dalla pagina CMS 'professionals'
// Ogni sezione viene passata come prop al componente corrispondente
```

---

## TONO E LINGUAGGIO

### Da evitare
- "Entra nella rete" → metafora platform
- "Accedi al workspace" → dashboard software
- "Inizia il tuo percorso" → journey SaaS
- "Partner ufficiale" → linguaggio corporate generico

### Da usare
- "Collaboriamo", "Co-progettiamo", "Lavoriamo insieme"
- "La tua competenza", "Il tuo progetto"
- "Rete operativa", "Rete fornitori"
- "Prenota una consulenza" — CTA unica

---

## SEED CMS RICHIESTO

Page key: `professionals`  
Tenant: `studio`  
Sezioni (in ordine):

```python
sections = [
    { 'section_type': 'hero_editorial',      'sort_order': 10 },
    { 'section_type': 'atmosphere_statement', 'sort_order': 20 },
    { 'section_type': 'editorial_triptych',  'sort_order': 30 },
    { 'section_type': 'design_journey',      'sort_order': 40 },
    { 'section_type': 'professionals_cta',   'sort_order': 50 },
    { 'section_type': 'cinematic_quote',     'sort_order': 60 },
]
```

---

## SUCCESS CRITERIA

Al termine dell'implementazione, il visitatore professionista deve:
1. Capire immediatamente che lo studio collabora con professionisti (hero)
2. Capire il modello di collaborazione (manifesto + triptych)
3. Capire il processo in 4 step (design_journey)
4. Trovare una sola CTA chiara: "Prenota una consulenza"
5. Non vedere alcun riferimento a MOOD, Blueprint o logiche SaaS
