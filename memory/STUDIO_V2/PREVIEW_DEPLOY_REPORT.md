# PREVIEW DEPLOY REPORT
## MOOD for DESIGN™ · Pricing & Positioning Revision

> **Status**: ✅ PREVIEW DEPLOY COMPLETO — pronto per review visiva utente
> **Data**: 2026-05-31
> **NOT YET IN PRODUCTION** — autorizzazione production deployment richiesta separatamente

---

## 1. Cosa è stato fatto

### 1.1 Documentazione (zero codice impattato)
- ✅ `TIER_NAMING_FINAL_REVISION.md` → marcato APPROVED · cleared for implementation
- ✅ `PRICING_POSITIONING_REVISION.md` → tutti i placeholder `<<NAME_T1/T2/T3>>` sostituiti con **Blueprint Studio · Practice · Enterprise**
- ✅ Override banner Locale Directive applicato su tutti i 9 documenti del package

### 1.2 Backend — Migration 026
- ✅ `platform_languages.code` normalizzato a BCP-47 con region (`it-IT`, `en-US`, `en-GB`, `fr-FR`, `de-DE`, `es-ES`, `ar-AE`, `zh-CN`, `ja-JP`)
- ✅ Aggiunte 3 locale pre-registrate (disabled): `es-MX`, `pt-BR`, `pt-PT`
- ✅ Stato MVP applicato:
  - **enabled = true** → `it-IT` (default), `en-US`
  - **disabled** → tutte le altre 10 locale pre-registrate
- ✅ `editorial_block_translations.locale` normalizzato (dedup `de`/`de-de`→`de-DE`, `en-us`→`en-US`, ecc.)
- ✅ `editorial_blocks.source_locale` allineato (1156 righe + 5 tenant aggiornati)
- ✅ Unique index `uq_platform_languages_default` garantisce 1 solo default

### 1.3 Backend — Site Resolver dinamico
- ✅ `services/site_resolver.py` refactored — **NO HARDCODED LOCALES**
  - `_get_default_locale()` legge da `platform_languages.default_locale=true`
  - `_get_fallback_chain()` cammina `fallback_locale` (max 5 hop)
  - `resolve_locales()` legge da `platform_languages WHERE enabled=true`
  - `LOCALE_FALLBACK = ['it-IT','en-US']` (bootstrap only)
  - `LEGAL_STRIP_FALLBACK` chiavi aggiornate a `it-IT` / `en-US`

### 1.4 Frontend — Locale handling BCP-47
- ✅ `LocaleContext.js` riscritto:
  - Code canonical `it-IT`/`en-US` (no più `it`/`en-us`)
  - `LEGACY_ALIAS` map per backward-compat con vecchi link
  - `BOOTSTRAP_DEFAULT = 'it-IT'`
- ✅ `localizedSlugs.js` esteso (additivo):
  - Nuove chiavi BCP-47 (`it-IT`, `en-US`, `en-GB`, `fr-FR`, `de-DE`, `es-ES`)
  - Vecchie chiavi (`it`, `en-us`, `en-uk`, `fr`, `de`, `es`) mantenute come alias

### 1.5 CMS — Copy nuovo Features + Pricing
- ✅ **182 blocchi editoriali** aggiornati/creati
- ✅ **364 traduzioni** (it-IT source + en-US target)
- ✅ Tutti i prezzi pubblici (€89, €249) **eliminati** dai blocchi `tier_*.price`
- ✅ CTA "Demo" → "Candida il tuo studio" / "Apply your studio"
- ✅ Tier naming: Blueprint Studio / Practice / Enterprise
- ✅ Sezione "Philosophy" → "Come viene adottato Blueprint" (D2 revisionato)
- ✅ Tabella comparativa riscritta: capability-oriented (no GB, no n. utenti)
- ✅ FAQ vuota (in attesa di copy/architettura blocchi specifica, opzionale)

---

## 2. Review visiva — Preview URL

| Pagina | URL Preview | Verifica |
|---|---|---|
| **Features (it-IT)** | `/caratteristiche` | ✅ Hero: *"Una sola piattaforma per tutto il progetto."* · CTA "Candida il tuo studio" |
| **Features (en-US)** | `/features` | ✅ Hero: *"One platform for the entire project."* · CTA "Apply your studio" |
| **Pricing (it-IT)** | `/versioni-prezzi` | ✅ Hero: *"Blueprint non si compra. Si configura."* · 3 tier (Studio/Practice/Enterprise) · zero prezzi |
| **Pricing (en-US)** | `/pricing` | ✅ Hero: *"Blueprint isn't bought. It's configured."* · 3 tier · zero prezzi |

### Validazioni programmatiche
- ✅ Nessun prezzo (`€89`, `€249`, `$`, `EUR\\s\\d+`) rilevato in `/versioni-prezzi`
- ✅ Nessun copy aulico (`Strumenti che pensano`, `grammatica condivisa`, `cinematografico`) rilevato in `/features`
- ✅ CTA "Apply your studio" presente in `/features` (en-US)
- ✅ "Blueprint Studio" e "Blueprint Practice" presenti come tier eyebrow nelle card

---

## 3. Cosa NON è stato fatto (volutamente)

| Item | Motivo | Stato |
|---|---|---|
| Pagina Command Center `/languages` (admin) | Non bloccante per la review visiva richiesta | DA FARE prossima iterazione |
| Traduzioni FR/DE/ES/AR/PT/ZH/JA | MVP utente = solo it-IT + en-US enabled | Da generare quando si attivano |
| FAQ pricing | Opzionale, da decidere se aggiungerla in iterazione successiva | DEFERRED |
| Backend API CRUD `/api/admin/languages` | Non bloccante per la review visiva | DA FARE prossima iterazione |
| Production deployment | Esplicitamente NON autorizzato dall'utente | LOCKED |

---

## 4. Compatibilità incidente P0

Tutto il lavoro è stato fatto rispettando l'hold P0:
- ❌ Mai toccate: `users`, `studio_requests`, `studio_relations`, `access_magic_links`
- ✅ Solo UPDATE/INSERT su: `platform_languages`, `editorial_blocks`, `editorial_block_translations`, `tenants.default_language|active_languages`
- ✅ Migration 026 idempotente, re-runnable
- ✅ Zero TRUNCATE, zero DELETE su tabelle operative wipe-colpite

---

## 5. Cosa serve dall'utente

1. ✅ Review visiva delle 4 pagine (link sopra)
2. Conferma autorizzazione **Production Deployment** (esplicita richiesta, oggi LOCKED)
3. (Opzionale) Approvazione del rinvio a iterazione successiva di:
   - Pagina Command Center `/languages`
   - Backend admin API `/api/admin/languages`
   - Traduzioni per le altre 10 locale pre-registrate
4. (Opzionale) Decisione su FAQ pricing (mantenere placeholder o popolare ora)

---

*STOP — preview deploy completo, in attesa della review visiva dell'utente.*
