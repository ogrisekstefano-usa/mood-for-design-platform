# WEBSITE MULTILINGUAL CONTENT AUDIT
**MOOD for DESIGN · Production readiness audit · 23 June 2026**

> Audit operativo di prontezza multilingua. Dati estratti dal DB di produzione (`tenant=studio`). Zero pianificazione · zero implementazione · solo misurazione e mappa dei gap.

---

## 0 · LOCALES CONFIGURED IN THE SYSTEM

| Locale | Native | Default | Public enabled | Fallback |
|---|---|---|---|---|
| `it-IT` | Italiano | ✅ default | ✅ | en-US |
| `en-US` | English (US) | — | ✅ | en-US |
| `en-GB` | English (UK) | — | ✅ | en-US |
| `fr-FR` | Français | — | ✅ | en-US |
| `de-DE` | Deutsch | — | ✅ | en-US |
| `es-ES` | Español (ES) | — | ✅ | en-US |
| `es-MX` | Español (MX) | — | ✅ | es-ES |

**7 locali pubblici attivi.** Le pagine devono operare in tutti questi.

---

## 1 · PAGE-BY-PAGE AUDIT (`editorial_blocks` translation coverage)

Coverage = numero di blocchi con traduzione **non vuota** sul totale dei blocchi della pagina.

| Page | CMS-driven? | Blocks | it-IT | en-US | en-GB | fr-FR | de-DE | es-ES | es-MX | Hardcoded strings? |
|---|---|---|---|---|---|---|---|---|---|---|
| **/** Home | ✅ yes | 122 | 84/122 (69%) | 84/122 (69%) | **47/122 (39%)** | 83/122 (68%) | 83/122 (68%) | 83/122 (68%) | **0/122 (0%)** | none in public components |
| **/dedicato-a** Audience | ✅ yes | 12 | 12/12 (100%) | **0/12 (0%)** | **0/12** | **0/12** | **0/12** | **0/12** | **0/12** | none |
| **/caratteristiche** Features | ✅ yes | 68 | 41/68 (60%) | 39/68 (57%) | **0/68** | **0/68** | **0/68** | **0/68** | **0/68** | none |
| **/versioni-prezzi** Pricing | ✅ yes | 229 | 170/229 (74%) | 117/229 (51%) | **0/229** | **0/229** | **0/229** | **0/229** | **0/229** | none |
| **/formazione** Academy | ✅ yes | 58 | 58/58 (100%) | **0/58 (0%)** | **0/58** | **0/58** | **0/58** | **0/58** | **0/58** | none |
| **/supporto** Support | ✅ yes | 39 | 30/39 (77%) | **0/39 (0%)** | **0/39** | **0/39** | **0/39** | **0/39** | **0/39** | none |
| **/accedi** Login | ✅ yes | 24 | 24/24 (100%) | 8/24 (33%) | **0/24** | 8/24 (33%) | 8/24 (33%) | 8/24 (33%) | **0/24** | none |
| **/about** About | ⚠️ via `cms_sections.locale_content` (no editorial_blocks) | 0 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | see §3 |
| **/faq** FAQ page | ✅ yes (faq_page section) | — | ✅ 15 keys | ✅ 15 keys | **❌** | **❌** | **❌** | **❌** | **❌** | none |
| **navigation** | ✅ via settings `label_i18n` | 7 nodes | ✅ 7/7 | ✅ 7/7 | **0/7** | **0/7** | **0/7** | **0/7** | **0/7** | none |
| **footer** | ✅ via editorial_blocks | 34 | 34/34 (100%) | 34/34 (100%) | **9/34 (26%)** | 34/34 (100%) | 34/34 (100%) | 34/34 (100%) | **0/34 (0%)** | none |
| **/partner-application** | ✅ via `cms_sections.locale_content` | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | none |

### Aggregate translation coverage (editorial_blocks only)

| Locale | Coverage | Status |
|---|---|---|
| it-IT | 453 / 586 (77.3%) | 🟡 partial (master) |
| en-US | 282 / 586 (48.1%) | 🟡 critical gap |
| en-GB | 56 / 586 (9.6%) | 🔴 severe gap |
| fr-FR | 125 / 586 (21.3%) | 🔴 severe gap |
| de-DE | 125 / 586 (21.3%) | 🔴 severe gap |
| es-ES | 125 / 586 (21.3%) | 🔴 severe gap |
| es-MX | **0 / 586 (0.0%)** | 🔴 **TOTAL ABSENCE** |

---

## 2 · SEO LOCALIZATION

Audit dei blocchi `seo.title` + `seo.description` per pagina.

| Page | seo.title localized | seo.description localized | Status |
|---|---|---|---|
| **/** Home | ❌ **block missing entirely** | ❌ **block missing entirely** | 🔴 P0 |
| **/dedicato-a** | 1/7 (only IT) | 1/7 (only IT) | 🔴 |
| **/caratteristiche** | 1/7 | 1/7 | 🔴 |
| **/versioni-prezzi** | 1/7 | 2/7 | 🔴 |
| **/formazione** | 1/7 | 1/7 | 🔴 |
| **/about** | ❌ **block missing entirely** | ❌ **block missing entirely** | 🔴 P0 |
| **/supporto** | 1/7 | 1/7 | 🔴 |
| **/faq** | ❌ vive in `cms_sections.locale_content` · IT+EN-US only | idem | 🟡 |

**Verdict SEO**: 3 pagine cardine senza alcun blocco SEO (Home · About · FAQ via blocks). Tutte le altre 5 pagine hanno SEO solo in italiano. **5 locali su 7 hanno zero copertura SEO.**

---

## 3 · LOCALE CODE DRIFT (CRITICAL DATA QUALITY ISSUE)

Le `cms_sections.locale_content` (sezioni che usano JSONB invece di editorial_blocks) presentano **frammentazione di codice locale**: alcune chiavi usano BCP-47 (`it-IT`, `en-US`), altre usano short code (`it`, `en`), altre usano `_default`.

| Section | Locale keys present | Issue |
|---|---|---|
| `about/atmosphere_statement` | `en-US`, `it` | uses short `it` instead of `it-IT` |
| `about/cinematic_quote` | `en-US`, `it` | same |
| `about/featured_design_journeys` | `en-US`, `it` | same |
| `about/hero_editorial` | `_default`, `en-US`, `it` | mixed |
| `about/stats_band` | `en-US`, `it` | same |
| `about/team_identity_card` | `en-US`, `it` | same |
| `about/design_journey` | `en-US`, `it` | same |
| `home/hero_editorial` | `_default`, `en`, `en-US`, `it` | uses short `en` + `it` |
| `home/atmosphere_statement` | `_default`, `en`, `en-US`, `it` | mixed |
| `home/design_journey` | `_default`, `en`, `en-GB`, `en-US`, `it` | mixed |
| `home/editorial_grid` | `_default`, `en-US`, `it` | uses `it` short |
| `home/editorial_footer` | `_default`, `en`, `en-US`, `it` | mixed |
| `home/featured_design_journeys` | `_default`, `en-US`, `it` | uses `it` short |
| `home/magazine_highlights` | `_default`, `en-US`, `it` | uses `it` short |
| `home/materials_carousel` | `_default`, `en-US`, `it` | uses `it` short |
| `home/professionals_cta` | `_default`, `en`, `en-US`, `it` | mixed |
| `home/trust_marquee` | `_default`, `en-US`, `it` | uses `it` short |
| `home/cinematic_quote` | `_default`, `en`, `en-GB`, `en-US`, `es-ES`, `fr-FR`, `it` | partial — missing de-DE, es-MX, plus `it` instead of `it-IT` |
| `professionals/*` (7 sections) | mostly `_default`, `en`, `en-US`, `it` | systematic short-code usage |
| `services/*` (5 sections) | mostly `_default`, `en`, `it` | same |
| `footer/footer` | `_default`, `en`, `it` | same |
| **`partner-application/*`** | full BCP-47 across 7 locales | ✅ clean (recent build) |
| `faq/faq_page` | `en-US`, `it-IT` | ✅ clean BCP-47, missing 5 locales |
| `professionals/partner_case_studies` | `_default`, `de-DE`, `en-GB`, `en-US`, `es-ES`, `fr-FR`, `it` | partial — missing `it-IT` and `es-MX`, uses `it` short |

**Impatto**: il frontend resolver (`useLocale` + `useSitePage`) potrebbe normalizzare `it` → `it-IT` e `en` → `en-US`, ma:
- Non c'è una garanzia formale
- Il fallback `_default` è un anti-pattern per audit di prontezza multilingua
- Aggiungere `es-MX` ora richiede touch di **23 sezioni** in JSONB anziché un singolo INSERT pulito

---

## 4 · CTA LABELS LOCALIZATION

CTA labels sono memorizzate come `editorial_blocks` con block_key tipo `*.cta`, `*.cta_primary`, `*.cta.label`, `*.button.label`. Coverage CTA per locale:

| Locale | Coverage |
|---|---|
| it-IT | ✅ tutti i CTA cardine (Home, Audience, Features, Pricing, Training, FAQ, Footer) |
| en-US | 🟡 Home, Footer, Login (partial) — Audience, Features, Pricing, Training **mancano** |
| en-GB | 🔴 solo Footer (9/34) |
| fr-FR | 🟡 Footer completo, Login partial — resto **mancante** |
| de-DE | 🟡 stesso pattern fr-FR |
| es-ES | 🟡 stesso pattern fr-FR |
| es-MX | 🔴 **zero copertura** |

**Status complessivo CTA**: ITA solido, EN-US accettabile, **5 locali con CTA non localizzati su 4-5 pagine cardine**.

---

## 5 · FAQ LOCALIZATION

**8 categorie · 8 item seed**.

| Locale | Categories | Items | faq_page section |
|---|---|---|---|
| it-IT | 8/8 ✅ | 8/8 ✅ | ✅ 15 keys |
| en-US | 8/8 ✅ | 8/8 ✅ | ✅ 15 keys |
| en-GB | 0/8 ❌ | 0/8 ❌ | ❌ |
| fr-FR | 0/8 ❌ | 0/8 ❌ | ❌ |
| de-DE | 0/8 ❌ | 0/8 ❌ | ❌ |
| es-ES | 0/8 ❌ | 0/8 ❌ | ❌ |
| es-MX | 0/8 ❌ | 0/8 ❌ | ❌ |

Inoltre: le **42 FAQ rimanenti** del lead-gen master (per arrivare a 50 totali) NON sono ancora popolate in alcun locale.

---

## 6 · NAVIGATION + FOOTER

### Navigation (`cms_sections.settings.label_i18n`)

7 nodi (CTA + 5 links + login). Tutti hanno:
- ✅ `it-IT`, `en-US`, `_default`
- ❌ `en-GB`, `fr-FR`, `de-DE`, `es-ES`, `es-MX` **MANCANTI per tutti i 7 nodi**

### Footer (`editorial_blocks` + `cms_sections.locale_content`)

- `editorial_blocks` namespace `site.footer`: 34 blocks
  - ✅ it-IT, en-US, fr-FR, de-DE, es-ES (34/34 ciascuno)
  - 🔴 en-GB: 9/34 (26%)
  - 🔴 es-MX: 0/34
- `cms_sections.locale_content` per `footer/footer`: solo `_default`, `en`, `it` (short codes — vedi §3)

### Footer language selector

Frontend ha già il selettore lingua nel footer (verificato in `LocaleContext.js`). **Funzionalmente cambia locale correttamente**, ma il contenuto target non esiste per 5 locali, quindi l'esperienza è degradata: cambiare lingua a `es-MX` mostrerebbe testi in inglese (via fallback) o vuoti.

---

## 7 · HARDCODED STRINGS IN FRONTEND CODE

Audit eseguito su `frontend/src/corporate/**/*.{jsx,js}`:

| File | Hardcoded | Severity |
|---|---|---|
| `corporate/pages/studio_v2/components/PhonePrefixField.jsx` | `searchPlaceholder = 'Cerca…'` | 🟡 fallback locale ITA hardcoded |
| `corporate/pages/studio_v2/components/TargetCountriesCombobox.jsx` | `placeholder = 'Cerca un Paese…'` | 🟡 fallback locale ITA hardcoded |
| `corporate/pages/studio_v2/Step2Location.jsx` | `t('step2.city.fallback_hint', 'Inserisci manualmente…')` | 🟡 i18n fallback string IT |
| `corporate/pages/studio_v2/Step3Contact.jsx` | `useCountries(locale \|\| 'it-IT')` | 🟡 locale fallback to it-IT |
| `corporate/pages/studio_v2/Step2Location.jsx` | `locale \|\| 'it-IT'` (×2) | 🟡 locale fallback |
| `corporate/pages/studio_v2/StudioFunnelV2.jsx` | `? 'en-US' : 'it-IT'` | 🟡 binary locale resolution |
| `corporate/pages/studio_v2/hooks/useStudioV2Manifest.js` | `function useStudioV2Manifest(locale = 'it-IT')` | 🟡 default param locale |

**Note**: i CTA principali, gli hero, le sezioni editoriali pubbliche non hanno alcuna stringa hardcoded. Le occorrenze sono limitate al funnel `/studio` (StudioV2) per: placeholder di componenti combobox, valori di default di locale nei hook. È un funnel di conversione, non una pagina di awareness/SEO — l'impatto è basso ma andrebbe ripulito per coerenza.

**Routes**: `localizedSlugs.js` definisce slug per **6 locali** (it-IT, en-US, en-GB, fr-FR, de-DE, es-ES) — **manca es-MX**. Senza intervento, le rotte pubbliche italiane (`/dedicato-a`, `/caratteristiche`, etc.) **non hanno un equivalente messicano**: i visitor es-MX vedono gli slug di `es-ES` come fallback, che funziona ma non è formalmente registrato.

---

## 8 · GAP REPORT (consolidated · production readiness priorities)

### 🔴 P0 — Bloccanti per la produzione multilingua

| # | Issue | Impact | Effort |
|---|---|---|---|
| P0-1 | **`es-MX` ha 0% coverage ovunque** (editorial_blocks, FAQ, navigation, footer JSONB, route slugs) | Locale dichiarato attivo in produzione ma totalmente inutilizzabile | Alto — richiede traduzioni complete o decisione di fallback automatico a `es-ES` |
| P0-2 | **5 locali (en-GB, fr-FR, de-DE, es-ES, es-MX) hanno ≤21% di copertura sulle pagine cardine** | Pagine illeggibili nei mercati EU/UK/LATAM | Alto — ~460 stringhe da tradurre per ogni locale mancante |
| P0-3 | **SEO blocks mancano su Home, About, FAQ** | Zero indicizzazione mirata su 3 pagine principali | Basso — creare 6 editorial_blocks (3 title + 3 description) × 7 locali |
| P0-4 | **SEO blocks delle altre 5 pagine sono solo in IT** | Nessuna SEO multi-mercato attiva | Basso — tradurre 10 blocchi × 6 locali = 60 traduzioni |
| P0-5 | **Locale code drift in 23 cms_sections.locale_content**: usano `it`/`en`/`_default` invece di BCP-47 | Aggiungere nuovi locali significa toccare 23 sezioni · resolver dipende da normalizzazione client-side | Medio — script SQL one-shot per rinominare keys `it`→`it-IT`, `en`→`en-US`, mantenere `_default` come fallback esplicito |

### 🟡 P1 — Importanti, non bloccanti

| # | Issue | Impact |
|---|---|---|
| P1-1 | About page senza editorial_blocks — tutto in cms_sections.locale_content (con code drift) | Difficile da localizzare in modo strutturato |
| P1-2 | Navigation: solo IT + EN su 7 nodi (5 locali mancanti) | Menu mostrato in EN per FR/DE/ES/MX users |
| P1-3 | Footer link labels: 5/7 ok ma EN-GB 26%, ES-MX 0% | UK/MX users vedono fallback |
| P1-4 | FAQ: solo 8 item seed in IT+EN. Le 42 FAQ del master non popolate | FAQ pubbliche poverissime per qualunque locale ≠ IT/EN |
| P1-5 | `localizedSlugs.js` senza es-MX | URL non native per il mercato MX |
| P1-6 | StudioV2 funnel ha 7 stringhe hardcoded (fallback placeholder + locale default `it-IT`) | Funnel cade in IT se i18n non risponde |

### 🟢 P2 — Pulizia / tech debt

| # | Issue |
|---|---|
| P2-1 | Refactor di `_default` come fallback esplicito in tutte le `cms_sections.locale_content` |
| P2-2 | Centralizzare i hardcoded fallback `'it-IT'` in StudioV2 attraverso `LocaleContext.defaultLocale` |
| P2-3 | Definire una policy: **i locali enabled=true e public_enabled=true devono avere coverage ≥80% su ogni pagina** prima di poter essere visibili nel selector |

---

## 9 · PRODUCTION READINESS SCORE (per locale)

Punteggio composito basato su: (a) editorial_blocks coverage · (b) SEO coverage · (c) navigation/footer · (d) FAQ · (e) presence in route slugs.

| Locale | Score | Status | Note |
|---|---|---|---|
| **it-IT** | 8.5 / 10 | 🟢 production-ready (master) | gap residuo: 23% blocchi mancanti, SEO blocks parziali, code drift `it` → `it-IT` |
| **en-US** | 6.0 / 10 | 🟡 acceptable for soft-launch | navigation ok, body 48%, SEO solo audience/pricing parziali |
| **en-GB** | 1.5 / 10 | 🔴 not production-ready | solo footer parziale |
| **fr-FR** | 2.5 / 10 | 🔴 not production-ready | solo footer + login partial |
| **de-DE** | 2.5 / 10 | 🔴 not production-ready | idem fr-FR |
| **es-ES** | 2.5 / 10 | 🔴 not production-ready | idem fr-FR |
| **es-MX** | 0.0 / 10 | 🔴 **must be disabled until populated** | zero contenuto in nessun layer |

**Verdict di prontezza**:
- ✅ **Pronto in produzione**: solo **it-IT**.
- 🟡 **Soft-launch accettabile**: **en-US** (con upgrade SEO immediato).
- 🔴 **Non da pubblicare**: **en-GB, fr-FR, de-DE, es-ES, es-MX** — devono essere portate ≥80% coverage o nascoste dal language selector.

---

## 10 · RECOMMENDATION (operativo, non strategico)

**Opzione A · disable + ship**
Disattivare temporaneamente da `platform_languages.public_enabled=false` per: `en-GB`, `fr-FR`, `de-DE`, `es-ES`, `es-MX`. Pubblicare in produzione solo `it-IT` + `en-US`. Riabilitare locale-by-locale dopo raggiungimento target.

**Opzione B · auto-translate + ship**
Sfruttare `ai_translation_enabled=true` su tutti i locali per generare bulk translations automatiche. Pubblicare con disclaimer "translation pending review" su locali < 80%.

**Opzione C · manual completion**
Completare manualmente le 460 traduzioni × 5 locali (~2.300 strings) prima della pubblicazione multilingua. Tempo stimato: 4-6 settimane editoriali.

**Raccomandazione**: combinare A + B → disabilitare immediatamente i 5 locali rotti dal language selector, poi avviare auto-translate per `en-US` (gap minore) e `it-IT` per chiudere il proprio 23% mancante, poi review umana, poi riabilitare progressivamente.

In ogni caso, **i 5 fix P0 sopra elencati restano vincolanti**: SEO blocks su Home/About/FAQ (P0-3), localizzazione SEO esistenti (P0-4), normalizzazione locale codes (P0-5).

---

*Audit · MOOD for DESIGN · 23 giugno 2026.*
*Data fonte: PostgreSQL produzione, tenant `studio`. Generato da script SQL diretto. Nessuna modifica eseguita.*
*Status: ⏳ Awaiting user decision on Option A / B / C above.*
