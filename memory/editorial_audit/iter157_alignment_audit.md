# ITER157.CHECK · Blueprint Alignment Audit™
**Date**: 26 Mag 2026 · **Target**: studio (Golden Demo) · **Scope**: Public Lead Generation Landing

---

## 1 · Audit Table (10 control points)

| # | Punto di controllo | Stato | Fonte dati | Residui hardcoded | Fix richiesto |
|---|---|---|---|---|---|
| 1 | **Storefront CMS source of truth** | 🟡 PARTIAL | `cms_pages.home` (status=published, revision served) | `EDITORIAL_SHELL.nav.*` (8 nav labels) · `EDITORIAL_SHELL.footer.colophon` (2 strings) | P0-A · spostare nav in `cms_sections.navigation` · P1-A · footer colophon in CMS |
| 2 | **Sezioni come `cms_section`** | ✅ OK | 10 section types canonici seedati e ordinati | — | nessuno |
| 3 | **Media da media_library + picker** | 🔴 BLOCKED | URL Unsplash hardcoded nei seed (hero + 3 published_journey hero_url) | 4 URL Unsplash | P0-B · upload assets in `media_library` + binding via `hero_asset_id` |
| 4 | **Featured Design Journeys** | ✅ OK | `/api/public/published-journeys/studio/feed` (3 items: Lugano / Brera / Tuscany) | — | nessuno |
| 5 | **Magazine / Editorial Grid** | ✅ OK | Empty editorial state ("Stiamo curando i prossimi articoli.") | — | wire via Sprint C (editorial_articles unified) |
| 6 | **Multi-locale resolution chain** | ✅ OK | `tenant override → translation → canonical → fallback` funziona via `useT()` + `mapCmsToCopy()` + Published Journeys translation rows | — | nessuno |
| 7 | **CTA DB-driven** | 🟡 PARTIAL | Label da CMS (`hero.cta_primary`), MA `href` hardcoded in JSX (`/begin-journey`, `/professionals`) | 4 href su HomePage + 2 nav-CTA | P1-B · `cms_section.settings.cta_primary_href` lettura runtime |
| 8 | **Header / Footer single source** | 🟡 PARTIAL | Header `MoodSiteHeader` legge da `copy.nav` (hardcoded EDITORIAL_SHELL) · Footer legge `useStorefrontContent('navigation')` ✓ | Nav labels in HomePage | P0-A vedi sopra |
| 9 | **Live preview in `/blueprint/experience`** | 🔴 MISSING | StorefrontStudioPage (537 righe) NON ha iframe, NON ha link "Apri sito" | — | P0-C · CTA "Apri Sito Live" + futuro iframe Sprint B.3 |
| 10 | **Pipeline workflow Save → Publish → Live** | 🟡 PARTIAL | Backend: admin save → revision → public read. Frontend: NO feedback visivo che la home è cambiata | — | P0-C aiuta a chiudere il loop |

---

## 2 · Hardcoded residue inventory (post-Sprint A/B)

| File | Linee | Tipo | Severity | Sprint fix |
|---|---|---|---|---|
| `frontend/src/pages/site/HomePage.jsx` | 60-70 | `EDITORIAL_SHELL.nav.*` (8 nav labels IT/EN) | P0 | ITER157.CHECK |
| `frontend/src/pages/site/HomePage.jsx` | 86-99 | `EDITORIAL_SHELL.footer.colophon` (4 strings) | P1 | Sprint C |
| `frontend/src/site/components/MoodSiteHeader.jsx` | 125-188 | `<Link to="/magazine">`, `<Link to="/professionals">` hardcoded targets | P1 | Sprint B.3 |
| `frontend/src/pages/site/HomePage.jsx` (Hero CTA, FinalCTA) | varie | hardcoded `to="/begin-journey"`, `to="/professionals"` | P1 | Sprint B.3 |
| `backend/scripts/seed_canonical_homepage.py` | 64/72/80 | hero `image` URL Unsplash | P0 | ITER157.CHECK |
| `backend/scripts/seed_sample_published_journeys.py` | 39/66/93 | 3× `hero_url` Unsplash | P1 | Sprint C (media_library v3) |
| `frontend/src/App.js` | 76 | `HomepageBuilderPage = lazy(import ...)` dead import | P0 | ITER157.CHECK |
| DB `cms_sections.navigation` | order=0 | Schema obsoleto (Dedicato a / Caratteristiche / Pricing) NON consumer-facing | P0 | ITER157.CHECK |

---

## 3 · Patch P0 applicate in questo sprint

✅ **P0-A** · Allineamento navigation
- Re-seed `cms_sections.navigation` con schema corretto consumer-landing (Come funziona / Magazine / Design Stories / Per i professionisti)
- `mapCmsToCopy()` ora consuma `content.navigation` → `copy.nav` (override del EDITORIAL_SHELL)

✅ **P0-C** · Apertura sito live da Blueprint Experience
- Aggiunta CTA "Apri Sito Live" in `StorefrontStudioPage.jsx` che apre `/?editorial=preview` in nuova tab
- Visibile pattern per il prossimo iframe preview (Sprint B.3)

✅ **P0-D** · Pulizia dead code
- Rimosso `HomepageBuilderPage` import da `App.js` (route già deprecata)

🟡 **P0-B (rimandato a Sprint B.3 · Media Library v3)**
- Upload reale degli asset Unsplash come `media_library` rows
- Migrazione hero URLs → `hero_asset_id` foreign keys
- Decisione: questo richiede attivare il bucket Supabase Storage + UI MediaUploader — sprint dedicato

---

## 4 · Cosa significa per il flusso utente

**Adesso (post-patch)**
1. Admin apre `/blueprint/experience`
2. Click "Apri Sito Live" → vede la landing reale in nuova tab
3. Torna in Blueprint, modifica una sezione (es. hero_editorial title IT)
4. Save → la revisione si pubblica
5. Reload del tab "Sito Live" → vede l'update
6. Nav labels ora editabili dal CMS (era hardcoded fino a 5 minuti fa)

**Non ancora possibile (rimandato Sprint B.3)**
- Iframe live preview side-by-side dentro `/blueprint/experience`
- Asset picker visivo per cover images
- Bulk media upload con focal point editor

---

## 5 · Verdict

🟢 **GO per Sprint B.2** (Editorial Publish Modal™ + Curation Panel)

Motivazione: i 4 punti BLOCKER (Storefront source · sezioni CMS · published_journeys · multi-locale) sono **già verdi**. I residui restanti (Unsplash hero, iframe preview, CTA href) sono **non-blocking** per il flusso editoriale del Publish.
