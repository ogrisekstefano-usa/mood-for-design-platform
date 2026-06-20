# BCP47 COMPLIANCE REPORT
**Sprint:** Pre-Deploy Final Certification  
**Data:** 2026-06-20  
**Scope:** Magazine, Projects, About, Services, Professionals  

---

## STATO ATTUALE

### File già certificati BCP-47 (in sessioni precedenti)

| File | Pattern rimossi | Status |
|---|---|---|
| `ServicesPage.jsx` | `locale === 'en'`, `startsWith` | ✅ COMPLIANT |
| `AboutPage.jsx` | `locale === 'en'`, `startsWith` | ✅ COMPLIANT |
| `ProfessionalsGatewayPage.jsx` | `locale === 'en'`, `startsWith` | ✅ COMPLIANT |
| `PartnerApplicationPage.jsx` | `locale.startsWith('en')` | ✅ COMPLIANT |
| `HomePage.jsx` | 4 istanze rimosse | ✅ COMPLIANT |
| `MoodSiteFooter.jsx` | `slice(0,2)`, `startsWith`, `resolveBag` interno | ✅ COMPLIANT |
| `LocaleHead.jsx` | `slice(0,2)` | ✅ COMPLIANT |

---

## MAGAZINE

### `MagazinePage.jsx`

| Pattern | Riga | Stato | Note |
|---|---|---|---|
| `COPY[locale] \|\| COPY.it` | 49 | ⚠️ NON-BCP47 | Usa `locale` come chiave breve. `it-IT` non trova match → fallback su `COPY.it` |
| `a.locale_content?.[locale]?.kicker` | 200 | ⚠️ DIRETTO | Non usa `resolveLocaleBag` |
| `a.locale_content?.[locale]?.summary` | 201 | ⚠️ DIRETTO | Non usa `resolveLocaleBag` |

**Impatto:** Per locale `it-IT`, BCP-47 non trova chiave esatta in `COPY` (`COPY['it-IT']` non esiste) → fallback corretto su `COPY.it`. Per `en-US` → fallback su `COPY.en`. Per `en-GB` → fallback su `COPY.en` (no distinzione US/GB). Per `fr-FR` → fallback su `COPY.it` (italiano!)

**Vietato rilevato:**
- `COPY[locale] || COPY.it` — Pattern di collasso locale implicito

### `MagazineArticlePage.jsx`

| Pattern | Righe | Stato | Note |
|---|---|---|---|
| `T[locale] \|\| T.it` | 28, 141, 378 | ⚠️ NON-BCP47 | Idem COPY — locale breve fallback |
| `a.locale_content?.[locale] \|\| a.locale_content?.it` | 470 | ❌ VIETATO | Hardcoded fallback su `.it` |
| `b.locale_content[locale] \|\| b.locale_content.it` | 234 | ❌ VIETATO | Hardcoded fallback su `.it` |
| `r.locale_content?.[locale] \|\| r.locale_content?.it` | 552 | ❌ VIETATO | Hardcoded fallback su `.it` — articoli correlati |

**Impatto:** Qualsiasi locale non `it` o `en` mostrerà contenuto in italiano via `|| .it`. EN-GB vede contenuto en (corretto per fallback), ma es-ES vede italiano.

---

## PROJECTS

### `ProjectsIndexPage.jsx`

| Pattern | Riga | Stato | Note |
|---|---|---|---|
| `EDITORIAL_LOADING[locale]` | 120 | ✅ BCP-47 | Chiave esatta BCP-47, fallback `en-US` |
| `EDITORIAL_EMPTY[locale]` | 121 | ✅ BCP-47 | Chiave esatta BCP-47, fallback `en-US` |
| `normalizeLocale` | — | ✅ | Import da `localeResolver` |
| `toBcp47Storefront` | 20 | ✅ RIMOSSO | Sostituito in questa sessione |

**Status: ✅ COMPLIANT**

### `ProjectDetailPage.jsx`

| Pattern | Riga | Stato | Note |
|---|---|---|---|
| `DETAIL_LABELS[locale]` | 48 | ✅ BCP-47 | Chiave esatta BCP-47 — `it-IT`, `en-US`, etc. |
| `labelsFor(locale)` | 48 | ✅ BCP-47 | Fallback `DETAIL_LABELS['en-US']` se non trovato |
| `isRuntime` | — | ✅ RIMOSSO | Rimosso in questa sessione |
| `toBcp47Storefront` | — | ✅ RIMOSSO | Rimosso in questa sessione |
| `resolveLocaleBag` | import | ✅ | Import da `localeResolver` |

**Status: ✅ COMPLIANT**

---

## ABOUT / SERVICES / PROFESSIONALS

Tutti e tre usano `resolveLocaleBag` / `resolveBag` da `localeResolver.js` dopo il refactoring precedente.

| File | Pattern vietati | Status |
|---|---|---|
| `AboutPage.jsx` | Nessuno | ✅ COMPLIANT |
| `ServicesPage.jsx` | Nessuno | ✅ COMPLIANT |
| `ProfessionalsGatewayPage.jsx` | Nessuno | ✅ COMPLIANT |

---

## RIEPILOGO COMPLIANCE

| File | Pattern vietati rimasti | Status |
|---|---|---|
| `MagazinePage.jsx` | 3 | ⚠️ NON-COMPLIANT |
| `MagazineArticlePage.jsx` | 4 (di cui 3 critici `|| .it`) | ❌ NON-COMPLIANT |
| `ProjectsIndexPage.jsx` | 0 | ✅ COMPLIANT |
| `ProjectDetailPage.jsx` | 0 | ✅ COMPLIANT |
| `AboutPage.jsx` | 0 | ✅ COMPLIANT |
| `ServicesPage.jsx` | 0 | ✅ COMPLIANT |
| `ProfessionalsGatewayPage.jsx` | 0 | ✅ COMPLIANT |
| `PartnerApplicationPage.jsx` | 0 | ✅ COMPLIANT |
| `HomePage.jsx` | 0 | ✅ COMPLIANT |
| `MoodSiteFooter.jsx` | 0 | ✅ COMPLIANT |
| `LocaleHead.jsx` | 0 | ✅ COMPLIANT |

---

## AZIONI RICHIESTE PER FULL COMPLIANCE

| Priorità | File | Fix |
|---|---|---|
| P1 | `MagazineArticlePage.jsx` | Sostituire `locale_content?.[locale] || locale_content?.it` con `resolveLocaleBag(locale_content, locale)` (3 occorrenze) |
| P1 | `MagazineArticlePage.jsx` | Sostituire `T[locale] || T.it` con `resolveLocaleBag(T, locale)` |
| P1 | `MagazinePage.jsx` | Sostituire `COPY[locale] || COPY.it` con `resolveLocaleBag(COPY, locale)` + aggiungere chiavi BCP-47 al dict |
