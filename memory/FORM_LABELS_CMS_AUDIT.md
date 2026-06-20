# FORM LABELS CMS AUDIT
**Sprint:** CMS Governance & Multilingual Completion  
**Data:** 2026-06-20  
**Scope:** Audit dei form sulle pagine Journey, Partner Application, Consulenza — hardcoded label vs CMS-driven  

---

## Metodologia

Per ogni form pubblico si verifica:
1. Le label dei campi sono CMS-driven o hardcoded
2. I placeholder sono CMS-driven o hardcoded
3. I messaggi di errore/validazione sono CMS-driven o hardcoded
4. Il form è multilingua (diversi testi per locale diverso)
5. Il form è white-label (il tenant può personalizzare le label)

---

## FORM 1 — Partner Application (`/partner-application`)

**File:** `PartnerApplicationPage.jsx`  
**Approccio attuale:** Dizionario statico `FORM_LABELS` hardcoded nel sorgente, con chiavi `it` e `en`

### Inventario Label

| Campo | Tipo | Valore IT | Valore EN | CMS-driven | Multilingua | Modificabile da tenant |
|---|---|---|---|---|---|---|
| Sezione "Profilo Studio" — titolo | label | `'Profilo dello Studio'` | `'Studio Profile'` | NO | SI (2 lingue) | NO |
| Nome | label | `'Nome *'` | `'First Name *'` | NO | SI | NO |
| Cognome | label | `'Cognome *'` | `'Last Name *'` | NO | SI | NO |
| Nome Studio | label | `'Nome Studio / Azienda *'` | `'Studio / Company Name *'` | NO | SI | NO |
| Email | label | `'Email *'` | `'Email *'` | NO | NO | NO |
| Telefono | label | `'Telefono'` | `'Phone'` | NO | SI | NO |
| Categoria professionale | label | `'Categoria Professionale *'` | `'Professional Category *'` | NO | SI | NO |
| Sito web | label | `'Sito Web Studio'` | `'Studio Website'` | NO | SI | NO |
| Instagram | label | `'Instagram'` | `'Instagram'` | NO | NO | NO |
| LinkedIn | label | `'LinkedIn'` | `'LinkedIn'` | NO | NO | NO |
| Città | label | `'Area Geografica *'` | `'Geographic Area *'` | NO | SI | NO |
| Collaborazione | label | `'Tipo di Collaborazione *'` | `'Collaboration Type *'` | NO | SI | NO |
| Racconto | label | `'Raccontaci il tuo studio (facoltativo)'` | `'Tell us about your studio (optional)'` | NO | SI | NO |
| Placeholder racconto | placeholder | `c.racconto_ph` (da FORM_LABELS) | idem | NO (statico) | SI | NO |
| Placeholder studio | placeholder | `'Studio Rossi Architetti'` | `'Rossi Architecture Studio'` | NO | SI | NO |
| Placeholder area geo | placeholder | `'Milano, Lombardia, Italia'` | `'Milan, Lombardy, Italy'` | NO | SI | NO |
| Sezione interessi | titolo | `'Aree di Interesse'` | `'Areas of Interest'` | NO | SI | NO |
| Pulsante invio | CTA | `'Invia candidatura'` | `'Submit application'` | NO | SI | NO |
| Messaggio privacy | testo | `'I tuoi dati vengono...'` | `'Your data is used...'` | NO | SI | NO |
| Messaggio errore | alert | `'Si è verificato un errore...'` | `'An error occurred...'` | NO | SI | NO |
| Messaggio campi mancanti | alert | `'Si prega di compilare...'` | `'Please fill in all required fields.'` | NO | SI | NO |

**Categorie professionali** (`PROFESSIONAL_CATEGORIES`):

| Valore | Etichetta IT | Etichetta EN | CMS-driven |
|---|---|---|---|
| `architect` | `'Architetto / Studio di Architettura'` | `'Architect / Architecture Studio'` | NO |
| `interior_designer` | `'Interior Designer'` | `'Interior Designer'` | NO |
| `contractor` | `'General Contractor / Impresa Costruttrice'` | `'General Contractor / Construction Company'` | NO |
| `developer` | `'Developer Immobiliare'` | `'Real Estate Developer'` | NO |
| `hospitality` | `'Operatore Hospitality'` | `'Hospitality Operator'` | NO |
| `other` | `'Altro'` | `'Other'` | NO |

**Interessi** (`INTEREST_OPTIONS`):
- 7 voci hardcoded con etichette IT/EN — nessuna da CMS

### Status Globale Form Partner Application
- **Label CMS-driven:** 0 / ~30 label
- **Label hardcoded:** ~30 / ~30 (100%)
- **Lingue supportate:** 2 (`it`, `en`) via dict statico
- **Mancanti:** `en-GB`, `fr-FR`, `de-DE`, `es-ES`
- **Personalizzabile da tenant:** NO

---

## FORM 2 — Begin Journey (`/begin-journey`)

**File:** `BeginJourneyPage.jsx`  
**Approccio attuale:** CMS-driven via `useStorefrontContent('start_project')` con helper `get(k(...))`

### Inventario Label

| Campo | CMS-driven | Note |
|---|---|---|
| Titolo hero | SI | `get(k('hero.title'))` |
| Sottotitolo hero | SI | `get(k('hero.subtitle'))` |
| Label step 1 | SI | `get(k('step1.field.*'))` |
| Placeholder step 1 | SI | `get(k('step1.field.*.placeholder'))` |
| Label step 2 | SI | `get(k('step2.field.*'))` |
| Placeholder telefono | HARDCODED | `placeholder="0123 456 7890"` (riga 458) |
| CTA "Avanti" | SI | `get(k('step*.cta'))` |
| Messaggi validazione | PARZIALE | Alcuni via CMS, fallback statici |

### Status Globale Form Begin Journey
- **Label CMS-driven:** ~85%
- **Label hardcoded:** ~15% (placeholder tecnici)
- **Lingue supportate:** Tutti i locale che hanno contenuto in `start_project`
- **Personalizzabile da tenant:** SI (tramite Blueprint)

---

## FORM 3 — Consulenza (`/consulenza`)

**File:** `ConsulenzaPage.jsx`

> Il form di `ConsulenzaPage` deve essere auditato separatamente — la pagina non è in `PAGE_KEYS` standard ma è accessibile pubblicamente.

### Status Globale Form Consulenza
- Da ispezionare: Verificare se usa `useStorefrontContent('consulenza')` o label statiche

---

## RIEPILOGO GAP

| Form | % CMS-driven | Multilingua | White-label | Priorità fix |
|---|---|---|---|---|
| Partner Application | ~5% (solo hero) | 2 lingue | NO | **P1** |
| Begin Journey | ~85% | Multi (dipende da DB) | SI | P2 |
| Consulenza | Da verificare | Da verificare | Da verificare | P2 |

---

## RACCOMANDAZIONI

### R1 — Migrare `FORM_LABELS` di PartnerApplication su CMS
**Azione:** Creare sezione `form_labels` nel CMS per `partner-application` con schema:
```json
{
  "it": { "nome": "Nome *", "cognome": "Cognome *", ... },
  "en-US": { "nome": "First Name *", "cognome": "Last Name *", ... },
  "en-GB": { ... },
  "fr-FR": { ... }
}
```
**Impatto:** Abilita white-label e multilingua completo per il form.

### R2 — Standardizzare placeholder tecnici
**Azione:** Sostituire `placeholder="0123 456 7890"` con chiave CMS `step2.field.phone.placeholder`.  
Questo è l'unico placeholder hardcoded rimasto in `BeginJourneyPage`.

### R3 — Aggiungere `PROFESSIONAL_CATEGORIES` e `INTEREST_OPTIONS` al CMS
**Azione:** Spostare le opzioni del dropdown in `cms_sections` di `partner-application` come `form_options` section.  
**Impatto:** Permette al tenant di personalizzare le categorie professionali senza modificare il codice.
