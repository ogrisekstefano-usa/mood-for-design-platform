# PUBLIC ROUTE RESIDUAL AUDIT
**Sprint:** CMS Governance & Multilingual Completion  
**Data:** 2026-06-20  
**Scope:** Tutte le route pubbliche — hardcoded text, locale fallback, placeholder legacy  

---

## Metodologia

Ogni file `.jsx` delle route pubbliche è stato ispezionato per:
1. Testo hardcoded nei JSX (stringhe letterali fuori da variabili CMS)
2. Fallback locale hardcoded (`|| 'testo'` dopo lookup CMS)
3. URL hardcoded residui non protetti da `settings.*`
4. Pattern locale legacy (`locale === 'en'`, `startsWith`, `slice(0,2)`)

---

## STATO LOCALE LEGACY (P0 — COMPLETATO in questa sessione)

| File | Pattern rimosso | Fix applicato |
|------|----------------|---------------|
| `HomePage.jsx` riga 981 | `locale === 'en' ? 'en-US' : 'it-IT'` in `useNavBundle` | `resolveLabel(i18n, locale)` |
| `HomePage.jsx` riga 1023 | `locale === 'en' ? 'en-US' : locale` in `mapCmsToCopy` | `mapCmsToCopy(cms?.content, locale)` |
| `HomePage.jsx` riga 379 | `locale === 'en' ? 'en' : 'it'` in API magazine URL | `encodeURIComponent(locale)` diretto |
| `HomePage.jsx` riga 467 | `(locale === 'en') ? 'en-US' : locale` in API journeys URL | `encodeURIComponent(locale)` diretto |
| `HomePage.jsx` righe 499-503 | Fallback hardcoded `'Our Projects'` / `'I Nostri Progetti'` | Rimosso — CMS è source of truth |
| `MoodSiteFooter.jsx` riga 127 | `(site?.locale).slice(0, 2)` | `normalizeLocale(site?.locale)` |
| `MoodSiteFooter.jsx` riga 128 | `locale === 'en' ? 'en-US' : 'it-IT'` | Eliminata variabile `i18nLocale` |
| `MoodSiteFooter.jsx` righe 51-60 | `resolveBag` interno con `startsWith('en')` | Sostituita con `resolveLocaleBag` da `localeResolver.js` |
| `MoodSiteFooter.jsx` righe 249-252 | `locale.startsWith('it')` per label UI | `lang === 'it'` via `getLangCode()` |
| `PartnerApplicationPage.jsx` riga 131 | `locale.startsWith('en') ? 'en' : 'it'` | `getLangCode(locale)` |
| `LocaleHead.jsx` riga 200 | `canonicalLocale.slice(0, 2)` | `getLangCode(canonicalLocale)` |

**Risultato:** Zero pattern legacy rimasti nei file pubblici principali.

---

## RESIDUI HARDCODED PER PAGINA

### `/` — HomePage.jsx

| Tipo | Posizione | Testo/Pattern | Priorità |
|------|-----------|---------------|----------|
| Fallback URL CTA | riga 217 | `copy.nav.cta_href \|\| '/consulenza'` | P1 — CMS-first con fallback sicuro |
| Fallback URL CTA | riga 293 | `copy.hero.cta_primary_href \|\| '/consulenza'` | P1 — fallback sicuro |
| Fallback URL CTA | riga 362 | `copy.howitworks.cta_href \|\| '/consulenza'` | P1 — fallback sicuro |
| Fallback URL CTA | riga 689 | `copy.finalCTA.private_href \|\| '/consulenza'` | P1 — fallback sicuro |
| Placeholder nav footer | riga 779 | `l.href \|\| '#'` | P2 — sicuro, link vuoto = no-op |
| Default locales | righe 130-136 | `DEFAULT_LOCALES` con `it`, `en` come codici | P1 — deve leggere da DB tenant |

### `/about` — AboutPage.jsx

| Tipo | Posizione | Testo/Pattern | Priorità |
|------|-----------|---------------|----------|
| Fallback URL CTA hero | riga 106 | `settings.cta_primary_href \|\| '/consulenza'` | P1 |
| Fallback URL CTA hero | riga 107 | `settings.cta_secondary_href \|\| '/professionals'` | P1 |
| Fallback URL CTA manifesto | riga 137 | `settings.cta_href \|\| '/projects'` | P1 |
| Fallback URL CTA approach | riga 252 | `settings.cta_href \|\| '/consulenza'` | P1 |
| Fallback URL CTA final | riga 362 | `settings.private_href \|\| '/consulenza'` | P1 |
| Fallback URL CTA final | riga 365 | `settings.pro_href \|\| '/professionals'` | P1 |
| Placeholder immagine | riga 178 | `leader.display_name \|\| 'Studio'` | P2 — UI safe |

### `/services` — ServicesPage.jsx

| Tipo | Posizione | Testo/Pattern | Priorità |
|------|-----------|---------------|----------|
| Fallback URL CTA manifesto | riga 150 | `settings.cta_href \|\| '/about'` | P1 |
| Fallback URL CTA process | riga 196 | `settings.cta_href \|\| '/consulenza'` | P1 |
| Fallback URL CTA final | riga 224 | `settings.private_href \|\| '/consulenza'` | P1 |
| Fallback URL CTA final | riga 228 | `settings.pro_href \|\| '/projects'` | P1 |

### `/professionals` — ProfessionalsGatewayPage.jsx

| Tipo | Posizione | Testo/Pattern | Priorità |
|------|-----------|---------------|----------|
| Nessun residuo hardcoded locale rilevato | — | — | CLEAN |

### `/partner-application` — PartnerApplicationPage.jsx

| Tipo | Posizione | Testo/Pattern | Priorità |
|------|-----------|---------------|----------|
| Placeholder form campo | riga 250 | `placeholder="Mario"` | P2 — placeholder UI, non content |
| Placeholder form campo | riga 254 | `placeholder="Rossi"` | P2 |
| Placeholder dinamico | riga 259 | `en ? 'Rossi Architecture...' : 'Studio Rossi...'` | P2 — form placeholder, non CMS content |
| Placeholder form campo | riga 306 | `en ? 'Milan, Lombardy...' : 'Milano, Lombardia...'` | P2 |
| Localizzazione via `FORM_LABELS` | tutto file | Dict statico `it`/`en` per label form | P1 — da migrare su CMS |

### `/begin-journey` — BeginJourneyPage.jsx

| Tipo | Posizione | Testo/Pattern | Priorità |
|------|-----------|---------------|----------|
| Placeholder CMS-driven | riga 245 | `get(k('step1.field.how_to_feel.placeholder'))` | CLEAN — CMS driven |
| Placeholder hardcoded | riga 458 | `placeholder="0123 456 7890"` | P2 — placeholder tecnico |

### `/consulenza` — ConsulenzaPage.jsx

| Tipo | Posizione | Testo/Pattern | Priorità |
|------|-----------|---------------|----------|
| Nessun residuo locale legacy | — | — | CLEAN |

---

## RIEPILOGO PRIORITÀ

| Priorità | Tipo | Count | Azione |
|----------|------|-------|--------|
| **P0 — COMPLETATO** | Locale legacy (`slice`, `startsWith`, `===`) | 11 | Risolti in questa sessione |
| **P1** | Fallback URL hardcoded (protetti da `settings.*`) | ~15 | Accettabili — CMS popola settings |
| **P1** | `FORM_LABELS` dict statico in `PartnerApplicationPage` | 1 file | Migrare su CMS section |
| **P1** | `DEFAULT_LOCALES` hardcoded in `HomePage` | 1 block | Leggere da `locale_profiles` DB |
| **P2** | Placeholder form tecnici | ~8 | Basso impatto utente |

---

## CONCLUSIONE

Il 100% dei pattern di collasso locale legacy è stato rimosso.  
Tutti i file pubblici usano esclusivamente `resolveLocaleBag`, `resolveLabel`, `normalizeLocale` e `langCode` da `localeResolver.js`.  
Rimangono residui P1/P2 di tipo "fallback sicuro" che non causano regressioni ma andrebbero migrati su CMS nella prossima fase.
