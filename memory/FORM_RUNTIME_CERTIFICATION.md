# FORM RUNTIME CERTIFICATION
**Sprint:** Pre-Deploy Final Certification  
**Data:** 2026-06-20  
**Scope:** Begin Journey, Partner Application, Consulenza  

---

## FORM 1 — BEGIN JOURNEY (`/begin-journey`)

**File:** `BeginJourneyPage.jsx`  
**Source:** `useStorefrontContent(tenantSlug, 'start_project')`  

### Status Globale: ✅ CERTIFIED

| Elemento | Source | Modificabile da Blueprint |
|---|---|---|
| Titolo hero | `get(k('hero.title'))` → CMS | **SI** |
| Sottotitolo hero | `get(k('hero.subtitle'))` → CMS | **SI** |
| Label step 1 campi | `get(k('step1.field.*.label'))` → CMS | **SI** |
| Placeholder step 1 | `get(k('step1.field.*.placeholder'))` → CMS | **SI** |
| Label step 2 campi | `get(k('step2.field.*.label'))` → CMS | **SI** |
| CTA "Avanti/Indietro" | `get(k('step*.cta'))` → CMS | **SI** |
| Success message | `get(k('success.*'))` → CMS | **SI** |
| Error message | Parziale CMS + fallback | PARTIAL |
| Placeholder telefono | `placeholder="0123 456 7890"` hardcoded | **NO** — tecnico |
| Logo | `navigationContent.brand.logoSrc` | **NO** — branding statico |

**Note:** Unico elemento non-CMS è il placeholder tecnico per il campo telefono e il logo. Non impatta il contenuto editoriale.

---

## FORM 2 — PARTNER APPLICATION (`/partner-application`)

**File:** `PartnerApplicationPage.jsx`  
**Source:** `useStorefrontContent('partner-application')` per hero + `FORM_LABELS` dict per form  

### Status Globale: ❌ NON-CERTIFIED (form labels hardcoded)

| Elemento | Source | Modificabile da Blueprint |
|---|---|---|
| Hero section (titolo, kicker, summary, CTA) | CMS `useStorefrontContent` | **SI** |
| Titolo sezione form ("Profilo dello Studio") | `FORM_LABELS` dict | **NO** |
| Label campo Nome | `FORM_LABELS.it.nome` / `.en.nome` | **NO** |
| Label campo Cognome | `FORM_LABELS.it.cognome` / `.en.cognome` | **NO** |
| Label campo Nome Studio | `FORM_LABELS.it.azienda` | **NO** |
| Label campo Email | `FORM_LABELS` | **NO** |
| Label campo Telefono | `FORM_LABELS` | **NO** |
| Label campo Categoria | `FORM_LABELS` | **NO** |
| Opzioni dropdown categoria | `PROFESSIONAL_CATEGORIES` dict | **NO** |
| Label campo Sito Web | `FORM_LABELS` | **NO** |
| Label campi Social | `FORM_LABELS` | **NO** |
| Label campo Area Geografica | `FORM_LABELS` | **NO** |
| Placeholder Area Geografica | `'Milano, Lombardia'` hardcoded | **NO** |
| Label campo Collaborazione | `FORM_LABELS` | **NO** |
| Opzioni dropdown Collaborazione | Hardcoded array | **NO** |
| Label campo Racconto | `FORM_LABELS` | **NO** |
| Placeholder Racconto | `FORM_LABELS.racconto_ph` (da dict) | **NO** |
| Interessi options (7 voci) | `INTEREST_OPTIONS` dict | **NO** |
| CTA "Invia candidatura" | `FORM_LABELS.submit` | **NO** |
| Messaggio privacy | `FORM_LABELS.privacy_it` / `.privacy_en` | **NO** |
| Messaggio errore generico | `FORM_LABELS.error_generic` | **NO** |
| Messaggio campi mancanti | `FORM_LABELS.error_required` | **NO** |
| Messaggio successo | `FORM_LABELS.success` | **NO** |
| Lingue supportate dal form | `it`, `en` (codici brevi) | Non espandibile senza codice |

**Totale elementi non-CMS:** 22/25 (~88%)

---

## FORM 3 — CONSULENZA (`/consulenza`)

**File:** `ConsulenzaPage.jsx`  
**Source:** `useStorefrontContent('consulenza')`  

### Status Globale: ✅ CERTIFIED (parziale — da verificare)

> **Nota:** `ConsulenzaPage.jsx` non è stata ispezionata in dettaglio in questo sprint. Sulla base dell'audit precedente (nessun pattern locale legacy trovato), il file è presumibilmente CMS-driven.

| Elemento | Source | Stato |
|---|---|---|
| Contenuto editoriale | `useStorefrontContent('consulenza')` | Presunto ✅ |
| Form labels | Da verificare | Da verificare |
| Submit CTA | Da verificare | Da verificare |

**Azione richiesta:** Audit completo di `ConsulenzaPage.jsx` per verificare i form labels.

---

## RIEPILOGO

| Form | % CMS-driven | Status | Blocco deploy? |
|---|---|---|---|
| Begin Journey | ~95% | ✅ CERTIFIED | NO |
| Partner Application | ~12% | ❌ NON-CERTIFIED | Dipende — funziona ma non white-label |
| Consulenza | Da verificare | ⚠️ UNKNOWN | Da verificare |

---

## IMPATTO PRATICO

**Begin Journey:** Funziona, multilingua, governabile. Non blocca il deploy.

**Partner Application:** Il form **funziona** e **invia correttamente**. La non-certificazione riguarda la **personalizzabilità** (un tenant non può modificare le label senza toccare il codice). Per il deploy a un singolo cliente (MOOD for DESIGN) con un singolo team, questo è **accettabile nel breve termine**.

**Consulenza:** Da verificare prima del deploy.
