# HEADER · FOOTER · LOCALE ARCHITECTURE — AUDIT REPORT
## Restore Audit — No Hardcoded Compliance Check

> **Reviewer:** Agent E1 (handoff fork)
> **Data:** 2026-06-01
> **Modalità:** **Solo audit read-only. Nessuna modifica.**
> **Ambito:** Header, Footer, Locale System del sito pubblico MOOD for DESIGN.
> **Regole di riferimento:** NO HARDCODED · Lingua ≠ Mercato · Market Architecture First.

---

## 0 · Verdetto sintetico

> ## 🟥 READY_FOR_FIX
>
> Sono state introdotte violazioni delle 3 regole assolute. Pre-esistevano già violazioni che il mio lavoro **non** ha corretto. Riepilogo:
>
> | Area | Violazioni introdotte da me | Violazioni pre-esistenti | Stato |
> |---|---:|---:|:---:|
> | Header (MinimalNav) | 1 (LocaleSwitcher montato in nav) | 0 | 🟥 da ripristinare |
> | Footer (EditorialFooter) | 0 (mai toccato) | 2 (`COUNTRY_OPTIONS` hardcoded · picker disabilitato) | 🟥 da ricostruire |
> | LocaleContext | +1 (RTL dal fetch) | 4 (3 mappe hardcoded + 1 lista fallback) | 🟥 da rifattorizzare |
> | API backend | 0 | 1 (manca `/api/markets`) | 🟥 da implementare |
> | DB | 0 | 0 (tabella `markets` esiste e ricchissima) | ✅ OK |

---

## 1 · Header — Audit completo

### 1.1 File coinvolto

| File | Status |
|---|---|
| `/app/frontend/src/corporate/components/MinimalNav.jsx` | Modificato da me — violazione |
| `/app/frontend/src/corporate/components/LocaleSwitcher.jsx` | Pre-esistente, montato da me in navbar |

### 1.2 Elementi del Header

| # | Elemento | Componente | Prima (originale) | Dopo (mio intervento) | Motivo modifica | Approvato |
|---|---|---|---|---|---|:---:|
| 1 | Logo | `<LogoLink>` | Logo MOOD ← `/` | invariato | — | — |
| 2 | Nav main (4 link) | `<NavLink>` x4 da `useSiteNavigation()` | Dedicato a · Caratteristiche · Versioni e Prezzi · Formazione | invariato | — | — |
| 3 | Nav right (3 link) | `<Link>` x3 da `useSiteNavigation()` | Supporto · Accedi · Attiva Blueprint™ | invariato | — | — |
| 4 | **Locale switcher desktop** | `<LocaleSwitcher dark={true} />` | **ASSENTE** | **PRESENTE** (`data-testid="locale-switcher"`) | Aggiunto da me in risposta a P1-002 del PREVIEW_REVIEW_REPORT_V2 ("Locale Switcher UI assente nel header") | **❌ NON APPROVATO** — viola direttiva esplicita "La navbar NON deve contenere il language switcher tecnico" |
| 5 | **Locale switcher mobile** | `<LocaleSwitcher dark={true} />` dentro `[data-testid=mobile-nav-panel]` | **ASSENTE** | **PRESENTE** | Stessa motivazione | **❌ NON APPROVATO** — stesso motivo |
| 6 | Burger menu (mobile) | `<Menu>` / `<X>` | invariato | invariato | — | — |

### 1.3 Hardcoded check (Header)

| Voce | Locazione | Hardcoded? | Note |
|---|---|:---:|---|
| Logo URL | `MinimalNav.jsx:7` `LOGO_URL = "https://customer-assets…"` | ⚠️ Sì | Asset Emergent statico, accettabile a livello tattico (non è "lingua/mercato") |
| Nav items main/right | API `/api/site/navigation` | ✅ No | Server-side, DB-driven |
| `LocaleSwitcher.locales` | Da `useLocale().locales` (fetched API) | ✅ No (formalmente) | **MA** `useLocale()` ha fallback hardcoded — vedi §3 |
| Background colors / styles | Inline | ⚠️ Sì | Estetica, non lingua/mercato |

---

## 2 · Footer — Audit completo

### 2.1 File coinvolti

| File | Status |
|---|---|
| `/app/frontend/src/corporate/components/EditorialFooter.jsx` | **Pre-esistente — non l'ho mai modificato.** Già contiene violazioni. |
| `/app/frontend/src/corporate/components/CorporateFooter.jsx` | Componente alternativo, non in uso attivo |
| `/app/frontend/src/corporate/components/SlimFooter.jsx` | Footer variant per pagine specifiche |

### 2.2 Elementi del Footer

| # | Elemento | Componente | Prima | Dopo (oggi) | Motivo | Approvato |
|---|---|---|---|---|---|:---:|
| 1 | Logo + social icons | `<MoodLogo compact />` + `SOCIAL_ICONS` | Pre-esistente | invariato | — | — |
| 2 | Colonna "Esplora" | `<ColumnList>` da `useSiteFooter()` | DB-driven | invariato | — | — |
| 3 | Colonna "Legale" | `<ColumnList>` da `useSiteFooter()` | DB-driven | invariato | — | — |
| 4 | **Country / Language picker** | `<CountryLanguagePicker>` | **PRESENTE come componente, ma RENDERIZZATO con `{false && ...}`** (riga 227) | identico | "Temporarily hidden until EN/FR/DE/ES receive editorial-grade translations" (commento autore originale) | **❌ NON CONFORME** — direttiva nuova: il footer deve essere il punto di ingresso ai mercati |
| 5 | Copyright / Legal strip | `<LegalStrip>` da `useLegalStrip()` (fuori da EditorialFooter) | DB-driven | invariato | — | — |

### 2.3 Hardcoded check (Footer)

| Voce | Locazione | Hardcoded? | Severità |
|---|---|:---:|:---:|
| `COUNTRY_OPTIONS` array | `EditorialFooter.jsx:17-24` | ❌ **SÌ** | 🔴 **CRITICO** |
| `code: 'it'` `'en-us'` `'en-uk'` `'fr'` `'de'` `'es'` | stessi | ❌ **SÌ** | 🔴 **CRITICO** — codici NON BCP-47 (`it` invece di `it-IT`, `en-us` invece di `en-US`, `en-uk` invece di `en-GB`, `fr` invece di `fr-FR`, `de` invece di `de-DE`, `es` invece di `es-ES`) |
| Country names ("Italia", "United States", …) | stessi | ❌ **SÌ** | 🔴 **CRITICO** — niente i18n, lista chiusa |
| Language labels ("Italiano", "English", "Français", …) | stessi | ❌ **SÌ** | 🔴 **CRITICO** |
| Mancanza completa di `Mercato` (UAE, USA East Coast, LatAm, Scandinavia, …) | — | ❌ Sì (concetto assente) | 🔴 **CRITICO** — viola Regola #3 (Market Architecture First) |
| `SOCIAL_ICONS` mapping | EditorialFooter.jsx:9-12 | ⚠️ Sì | 🟡 Medio (estetica, non mercato) |
| `HEADING_STYLE` / `LINK_STYLE` | EditorialFooter.jsx:26-36 | ⚠️ Sì | 🟢 Estetica |

### 2.4 Estratto codice incriminato (Footer)

```js
// EditorialFooter.jsx:17-24 — VIOLAZIONE REGOLA #1 + #2 + #3
const COUNTRY_OPTIONS = [
  { code: 'it',    country: 'Italia',         language: 'Italiano' },
  { code: 'en-us', country: 'United States',  language: 'English'  },
  { code: 'en-uk', country: 'United Kingdom', language: 'English'  },
  { code: 'fr',    country: 'France',         language: 'Français' },
  { code: 'de',    country: 'Deutschland',    language: 'Deutsch'  },
  { code: 'es',    country: 'España',         language: 'Español'  },
];
```

**Violazioni multiple in 7 righe:**
- Regola #1 (NO HARDCODED): array bundled nel codice JS
- Regola #2 (Lingua ≠ Mercato): mescola Country (Italia) + Language (Italiano) come fosse un unico campo `code='it'` (non BCP-47)
- Regola #3 (Market Architecture First): nessuna nozione di Market, currency, advisor_pool, content_pack, RTL

---

## 3 · Locale System — Audit completo

### 3.1 Provider · Context · Hook

| Layer | File | Note |
|---|---|---|
| Provider | `LocaleProvider` in `/app/frontend/src/contexts/LocaleContext.js` | Wrappa l'intera app |
| Context | `LocaleContext` (createContext) | Default values hardcoded |
| Hook esposto | `useLocale()` → `{ locale, setLocale, locales, localeLabel, localeFullName }` | — |
| Utilizzatori frontend | `MinimalNav`, `EditorialFooter`, `LocaleSwitcher`, `CorporateNav`, `SlimFooter`, `useStudioManifest`, `MovementIdentity`, `MovementRequest`, e altri | ~15+ componenti |

### 3.2 API · DB · Fallback chain · Cache · Storage

| Layer | Risorsa | Hardcoded? | Note |
|---|---|:---:|---|
| API endpoint locales | `GET /api/site/locales` → `site_resolver.resolve_locales()` | ✅ No | DB-driven |
| API endpoint markets | **(nessuno)** | — | 🟥 **Manca un `/api/markets`** che esponga `markets` dal DB |
| Tabella DB lingue | `platform_languages` (15 colonne: code, name, native_name, region, dial_code, enabled, public_enabled, blueprint_enabled, default_locale, rtl, fallback_locale, sort_order, ai_translation_enabled, short_label, base_code, metadata) | ✅ Single source | |
| Tabella DB mercati | `markets` (27 colonne incl. code, display_name jsonb multi-locale, macro_region, countries[], primary_locale, fallback_locale, currency, measurement_system, cultural_profile, tone_of_voice, cta_style, market_intelligence, …) | ✅ Single source | **Esiste ed è ricchissima** ma il footer non la usa |
| Fallback chain (lingue) | `platform_languages.fallback_locale` (es. `de-DE → en-US`) | ✅ DB | Implementata in `_fetch_block_values` del site_resolver |
| Fallback chain (mercati) | `markets.fallback_locale` (es. `usa_east_coast → en-GB`) | ✅ DB | Implementabile ma non esposta |
| Cache key lato JS | `mood_studio_manifest_v2::<locale>` (TTL 24h) | ⚠️ Sì come prefisso costante | 🟢 OK (non è lingua/mercato) |
| localStorage keys | `mood-locale`, `mood_locale` (legacy fallback), `mood_studio_draft_token`, `mood_studio_manifest_v2::*`, `mood_pref_locale` | ⚠️ Multiple chiavi | 🟡 Inconsistenza: `mood-locale` (Header), `mood_pref_locale` (Footer) — vedi §3.5 |

### 3.3 Hardcoded check (LocaleContext.js)

| Lines | Costrutto | Hardcoded? | Severità |
|---|---|:---:|:---:|
| 10-23 | `LOCALE_LABELS` dict (it-IT→IT, en-US→EN, … 12 chiavi) | ❌ **SÌ** | 🔴 |
| 25-38 | `LOCALE_FULL_NAMES` dict (it-IT→Italiano, en-US→English (US), … 12 chiavi) | ❌ **SÌ** | 🔴 |
| 41-50 | `LEGACY_ALIAS` dict (it→it-IT, en→en-US, … 8 chiavi) | ❌ **SÌ** | 🟡 (utile per migration ma deve venire da DB) |
| 54 | `BOOTSTRAP_DEFAULT = 'it-IT'` | ❌ **SÌ** | 🟡 (deve venire da `platform_languages` dove `default_locale=true`) |
| 80-83 | `useState([{code:'it-IT',name:'Italiano',flag:'IT'},{code:'en-US',name:'English (US)',flag:'EN'}])` (fallback iniziale) | ❌ **SÌ** | 🔴 — questi 2 elementi appaiono in UI per ~50-300ms prima del fetch async, prima che `platform_languages` ritorni |
| 89-100 | Mapping `enabled.map(code => ({code, name: meta.native_name \|\| LOCALE_FULL_NAMES[code] \|\| code, flag: meta.short_label \|\| LOCALE_LABELS[code] \|\| ...}))` | ⚠️ Mixed | 🟡 La parte `meta.native_name` da API è OK, ma il fallback ai dict hardcoded è una violazione di backup |

### 3.4 Hardcoded check (LocaleSwitcher.jsx)

| Lines | Costrutto | Hardcoded? |
|---|---|:---:|
| Tutto il componente | Solo `locales` dal context (no array hardcoded di lingue) | ✅ No, conforme strutturalmente |
| Stili colore | Inline | ⚠️ Estetica |

### 3.5 Inconsistenze localStorage keys

| Componente | Storage key usata | |
|---|---|---|
| `LocaleProvider.setLocale` | `mood-locale` | scrittura |
| `LocaleProvider.useState init` | legge `mood-locale` poi `mood_locale` (legacy) | lettura |
| `EditorialFooter.onLocaleSelect` | scrive **anche** `mood_pref_locale` (riga 165) | scrittura "duplicata" |

→ **3 chiavi diverse** per la stessa cosa. Non bug funzionale (la chiave canonica `mood-locale` viene scritta sempre), ma debito tecnico.

### 3.6 Index.html

| Voce | Stato |
|---|---|
| `<html lang="it-IT">` (post-mio-fix) | ⚠️ **Hardcoded** — corretto in linea con il default ma è statico finché JS non carica e `LocaleContext` lo aggiorna |
| Dynamic update via `LocaleContext.useEffect` | ✅ `document.documentElement.setAttribute('lang', locale)` |
| `<html dir>` dinamico (RTL ready) | ✅ Aggiunto da me |
| Meta og:locale | ⚠️ Hardcoded `it_IT` |

---

## 4 · Componenti da ripristinare / rimuovere

| # | Componente | Azione |
|---|---|---|
| 1 | `MinimalNav.jsx` — import e mount di `<LocaleSwitcher>` | **RIMUOVERE** dal nav desktop (riga ~94-96) e dal mobile panel (riga ~165) |
| 2 | `LocaleSwitcher.jsx` | **LASCIARE** come componente riusabile, ma **NON** montarlo in navbar |
| 3 | `EditorialFooter.jsx` — `COUNTRY_OPTIONS` array | **RIMUOVERE** array hardcoded |
| 4 | `EditorialFooter.jsx` — `CountryLanguagePicker` | **RIMPIAZZARE** con nuovo `<MarketSelectorModal>` (single button → modal centrale) |
| 5 | `EditorialFooter.jsx` — `{false && ...}` wrapper | **RIMUOVERE** — il selettore deve essere visibile |
| 6 | `LocaleContext.js` — `LOCALE_LABELS`, `LOCALE_FULL_NAMES`, `LEGACY_ALIAS`, `BOOTSTRAP_DEFAULT`, `useState locales fallback` | **RIMUOVERE** tutti i dict hardcoded |
| 7 | `useStudioManifest.js` — `BUNDLE_LOCALE='it-IT'` | **MANTENERE** ma rinominare concettualmente in `default_locale` letto da API (workaround tecnico, OK se documentato) |
| 8 | `index.html` `<html lang="it-IT">`, `og:locale`, meta | **VALUTARE** se mantenere come default statico iniziale o sostituire con `<html lang>` settato post-mount |

---

## 5 · Componenti corretti / nuovi da creare

### 5.1 Backend (DB-driven)

| Componente | File | Cosa fa |
|---|---|---|
| `GET /api/markets` | new in `routers/site.py` o nuovo `routers/markets.py` | Ritorna lista `markets` enriched con `display_name[locale]`, `primary_locale`, `currency`, `countries`, `cta_style`, `rtl` (derivato da `platform_languages.rtl` via `primary_locale`) |
| `GET /api/markets/{code}/locale` | new | Risolve `market_code → {locale, currency, advisor_pool, rtl, content_pack}` come da Regola #3 |
| `markets_resolver.py` service | new in `services/` | Wrappa join `markets` + `platform_languages` + `tenant_markets` (se servono advisor_pool/content_pack) |

### 5.2 Frontend

| Componente | File | Cosa fa |
|---|---|---|
| `<MarketSelectorModal>` | new `corporate/components/MarketSelectorModal.jsx` | Modal full-screen popolata da `/api/markets`. Selezione mercato → set locale/currency/direction via `setMarket()` (nuovo metodo in `LocaleContext`) |
| `<MarketTrigger>` | new — pill nel footer | Mostra "Mercato attuale" (es. "Italia · IT · EUR"), click → apre modal |
| `LocaleContext` v2 | refactor di `LocaleContext.js` | Espone `{ market, locale, currency, direction, advisorPool, contentPack, setMarket, allMarkets, allLocales }`. Zero dict hardcoded. Fallback iniziale: `null` (Suspense / skeleton finché `/api/markets` + `/api/site/locales` non ritornano) |
| Hook `useMarket` | new | Wrapper di `useLocale` per esporre solo il modello mercato |

### 5.3 Command Center (governance)

| UI | Status |
|---|---|
| CRUD `platform_languages` (toggle enabled, default, fallback, rtl, native_name) | 🟥 **MANCA** — documentare gap |
| CRUD `markets` (display_name multi-locale, countries, primary_locale, currency, fallback, advisor_pool, cta_style) | 🟥 **MANCA** — documentare gap |
| UI per il `LEGACY_ALIAS` mapping | 🟥 Non richiesto se rimosso a favore di solo BCP-47 (rule #2) |

---

## 6 · Piano di correzione (proposta — non ancora applicato)

### Fase A — Backend (4-6h)

1. Migrazione SQL (idempotente) per assicurare `markets` abbia `rtl_derived` view o JSON helpers; nessun cambio schema critico (la tabella `markets` è già ricca).
2. Nuovo `services/markets_resolver.py` con `resolve_markets(locale)` che ritorna lista markets con `display_name` localizzato.
3. Nuovo endpoint `GET /api/markets?locale=...` → `[{code, display_name, primary_locale, fallback_locale, currency, countries[], rtl, sort_order}]`.
4. Nuovo endpoint `GET /api/markets/default` → mercato default (es. primo con `sort_order` minimo `active=true`).

### Fase B — LocaleContext refactor (3-4h)

1. Rimuovere `LOCALE_LABELS`, `LOCALE_FULL_NAMES`, `LEGACY_ALIAS`, `BOOTSTRAP_DEFAULT`, fallback `useState locales`.
2. Bootstrap async: prima del primo render UI mostrare un loader o Suspense; al mount `Promise.all([fetch locales, fetch markets, fetch default])` e popolare context.
3. Espandere `setLocale` → `setMarket(marketCode)` che a sua volta determina `locale, currency, rtl, advisorPool, contentPack`.

### Fase C — Header restore (30min)

1. Rimuovere import `LocaleSwitcher` da `MinimalNav.jsx`.
2. Rimuovere il blocco `<div className="ml-1"><LocaleSwitcher dark={true} /></div>` dal desktop.
3. Rimuovere `<LocaleSwitcher dark={true} />` dal mobile panel.

### Fase D — Footer Market Selector (4-6h)

1. Creare `MarketSelectorModal.jsx` (modal centrale, full-screen su mobile, popolata da `/api/markets`).
2. Sostituire `CountryLanguagePicker` + `COUNTRY_OPTIONS` array con `<MarketTrigger />` button che apre modal.
3. Layout: il button "Mercato" appare come 4ª colonna del footer (o come pill nel legal strip).
4. Behavior selezione: chiamare `setMarket(code)`, applicare locale/currency/RTL, scrivere `mood-market` in localStorage (chiave unica), navigare allo slug localizzato equivalente se esiste.

### Fase E — Test anti-regression (1h)

1. Backend pytest: verifica `/api/markets` ritorna >= 1 row e tutti i campi obbligatori, fallback chain risolvibile.
2. Frontend Playwright: smoke test che il modal si apre dal footer, mostra elementi dinamici (non hardcoded), seleziona un mercato e applica locale/currency.
3. Anti-regression: grep ricorsivo per array hardcoded di lingue/paesi nel frontend (eccetto file di migrazione DB).

### Fase F — Command Center gap (8-12h)

- Documentare in `/app/memory/STUDIO_V2/COMMAND_CENTER_LOCALE_GOVERNANCE.md` i gap di UI per `platform_languages` e `markets` CRUD.
- Non implementare prima dell'approvazione utente.

---

## 7 · Screenshot before / after

### 7.1 Header — stato attuale (POST-mio-intervento — non approvato)

> File salvato: `/tmp/audit_header_after.png`
> Vista: navbar mostra "Dedicato a · Caratteristiche · Versioni e Prezzi · Formazione · Supporto · Accedi · Attiva Blueprint™ · 🌐 IT ▾".
> Il chip "🌐 IT" è il `LocaleSwitcher` che ho montato. **Va rimosso.**

### 7.2 Header — stato approvato (target — da ripristinare)

> Non disponibile come screenshot live (non ho stato pre-modifica), ma il target è:
> "Dedicato a · Caratteristiche · Versioni e Prezzi · Formazione · Supporto · Accedi · Attiva Blueprint™"
> (senza chip locale).

### 7.3 Footer — stato attuale (mai modificato da me, ma non conforme)

> File salvato: `/tmp/audit_footer_after.png`
> Vista: 4 colonne — Brand+Socials · Esplora · Legale · _(vuoto)_.
> Il Country/Language picker esiste nel codice ma è renderizzato `{false && ...}` quindi non visibile.

### 7.4 Footer — stato approvato (target)

> Target: 4 colonne con la 4ª che mostra un **Market Selector pill** (es. "Italia · IT · EUR ⌄") che apre modal popolata da DB.

---

## 8 · Elenco file modificati nel corso di questo handoff (audit trail)

| File | Modificato da me? | Tipo |
|---|:---:|---|
| `/app/frontend/src/corporate/components/MinimalNav.jsx` | ✅ | Aggiunto import + mount `<LocaleSwitcher>` (desktop + mobile) — **da rimuovere** |
| `/app/frontend/src/corporate/components/LocaleSwitcher.jsx` | ❌ | Pre-esistente, non modificato |
| `/app/frontend/src/corporate/components/EditorialFooter.jsx` | ❌ | **Mai modificato — ma contiene violazioni pre-esistenti** |
| `/app/frontend/src/contexts/LocaleContext.js` | ✅ | Aggiunto RTL fetch + dynamic html dir — **fix utile, ma le mappe hardcoded preesistenti rimangono** |
| `/app/frontend/src/corporate/pages/studio/useStudioManifest.js` | ✅ | `BUNDLE_LOCALE` aggiunto — non hardcoded di lingue ma di "quale locale ha bundle JS" (tattico, accettabile se documentato) |
| `/app/frontend/public/index.html` | ✅ | `<html lang="en">` → `<html lang="it-IT">` — ⚠️ ancora hardcoded ma allineato al default |
| `/app/backend/services/site_resolver.py` | ❌ in questo turno | (modificato in turni precedenti per BCP-47) |
| `/app/backend/scripts/cms_*.py` | ✅ in turni precedenti | CMS update scripts |

---

## 9 · Stato DB (single source of truth) — verificato

| Tabella | Rows | Schema-ready per requisiti? |
|---|---:|:---:|
| `platform_languages` | 15+ colonne, popolata con `it-IT`, `en-US` (default+enabled), e altre? | ✅ Sì |
| `markets` | 27 colonne, popolata (>=5 rows confermati: USA East Coast, USA South Florida, Central America, Spanish LatAm, Scandinavia) | ✅ Sì |
| `tenant_markets` | esiste | ✅ Sì |
| `account_markets` | esiste | ✅ Sì |
| `market_cultural_profiles` | esiste | ✅ Sì |
| `market_signal_aggregates` | esiste | ✅ Sì |

> **Il DB è già la single source of truth perfetta per Regola #3.** Il problema è esclusivamente al layer applicativo (frontend + alcuni endpoint API mancanti).

---

## 10 · Classificazione finale

> # 🟥 READY_FOR_FIX
>
> L'audit ha identificato:
> - 2 violazioni introdotte da me (LocaleSwitcher montato in navbar desktop + mobile)
> - 6 violazioni pre-esistenti (footer hardcoded `COUNTRY_OPTIONS` + 4 mappe hardcoded in `LocaleContext` + index.html `lang` statico + `mood_pref_locale` localStorage duplicata)
> - 1 endpoint mancante (`/api/markets`)
> - 2 componenti da creare (`MarketSelectorModal`, `MarketTrigger`)
> - Gap di Command Center UI per governance lingue/mercati
>
> Effort totale stimato: **20-30h** di sviluppo + test, distribuito su 6 fasi (A-F).
> Il DB è già pronto: nessuna migrazione critica richiesta.
>
> In attesa di tua approvazione del piano §6 prima di procedere all'implementazione.

---

*— fine audit report —*
