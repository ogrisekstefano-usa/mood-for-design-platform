# LOCALE ARCHITECTURE — GLOBAL DIRECTIVE
## MOOD for DESIGN™ · No Hardcoded Locales

> **Status**: CANONICAL · BINDING · 2026-05-31
> **Authority**: Direttiva architetturale globale del progetto MOOD for DESIGN
> **Scope**: ogni documento, ogni codice futuro, ogni workflow editoriale, ogni email, ogni pagina, ogni componente, ogni migration, ogni test, ogni CMS update
> **Override**: questo documento ha precedenza su qualsiasi specifica locale precedente in tutti i documenti del package STUDIO_V2

---

## 1. Regola fondamentale

> **Nessun documento, nessun codice e nessun workflow può assumere una lista statica di lingue o locale.**

### 1.1 È VIETATO scrivere

- ❌ "Le lingue supportate sono IT, EN, FR, DE, ES"
- ❌ "Per le 5 lingue del sistema"
- ❌ "Genera traduzioni per IT/EN/FR/DE/ES"
- ❌ `const LOCALES = ['it', 'en', 'fr', 'de', 'es']`
- ❌ `if (locale in ('it','en-us','fr','de','es'))`
- ❌ Tabelle CMS hardcoded a 5 colonne lingua
- ❌ Hardcoded fallback chain `it → en → fail`
- ❌ Migration con seed `INSERT (it), (en-us), (fr), (de), (es)` come "lingue definitive"

### 1.2 È OBBLIGATORIO scrivere

- ✅ "Le lingue supportate sono **quelle attive in `active_languages` al momento della richiesta**"
- ✅ "Per **N** locale attive nel Command Center, dove N è dinamico"
- ✅ "Genera traduzioni **per tutte le locale attive configurate in Command Center**"
- ✅ `const locales = await fetchActiveLocales()` con cache TTL
- ✅ `if (locale ∈ activeLocales)`
- ✅ Tabelle CMS con **N colonne lingua generate dinamicamente** da query
- ✅ Fallback chain configurabile per locale via `active_languages.fallback_locale`
- ✅ Migration seed iniziale **esempio**, esplicitamente marcato "starter — extendable runtime via Command Center"

---

## 2. Formato locale obbligatorio

### 2.1 Convenzione: BCP-47 con region tag esplicito

> **Tutte le locale devono essere espresse in formato `language-REGION`** con region tag esplicito in uppercase.

| Forma | Stato | Note |
|---|---|---|
| `en` | ❌ ambiguo | "English" senza varianza non è una locale |
| `en-US` | ✅ valido | English (United States) |
| `en-GB` | ✅ valido | English (United Kingdom) |
| `en-CA` | ✅ valido | English (Canada) |
| `es-ES` | ✅ valido | Spanish (Spain) |
| `es-MX` | ✅ valido | Spanish (Mexico) |
| `es-AR` | ✅ valido | Spanish (Argentina) |
| `pt-BR` | ✅ valido | Portuguese (Brazil) |
| `pt-PT` | ✅ valido | Portuguese (Portugal) |
| `ar-AE` | ✅ valido | Arabic (United Arab Emirates) |
| `zh-CN` | ✅ valido | Chinese (Simplified, China) |
| `zh-TW` | ✅ valido | Chinese (Traditional, Taiwan) |
| `ja-JP` | ✅ valido | Japanese (Japan) |
| `it-IT` | ✅ valido | Italian (Italy) |
| `fr-FR` | ✅ valido | French (France) |
| `fr-CA` | ✅ valido | French (Canada) |
| `de-DE` | ✅ valido | German (Germany) |
| `de-AT` | ✅ valido | German (Austria) |

### 2.2 Esempio: cosa cambia oggi

| Prima (errato) | Dopo (corretto) |
|---|---|
| `it` | `it-IT` |
| `en-us` | `en-US` |
| `en` | `en-US` (variante default) |
| `fr` | `fr-FR` (variante default) |
| `de` | `de-DE` (variante default) |
| `es` | `es-ES` (variante default) |

### 2.3 Database

Tutti i campi `locale` (in `block_localizations`, `active_languages.code`, `studio_requests_v2.submission_locale`, `studio_v2_drafts.locale`, `users.preferred_locale`, etc.) devono accettare e validare il formato `xx-XX` (≤10 chars).

---

## 3. Schema concettuale — Locale ownership

```
                    ┌────────────────────────────────┐
                    │      COMMAND CENTER             │
                    │   (Super Admin governance)      │
                    │                                 │
                    │   /command-center/languages     │
                    │   • activate / deactivate       │
                    │   • set fallback chain          │
                    │   • set default                 │
                    │   • set RTL flag                │
                    │   • set sort order              │
                    └─────────────┬───────────────────┘
                                  │
                                  ▼
                    ┌────────────────────────────────┐
                    │       active_languages          │
                    │       (canonical source)        │
                    └─────────────┬───────────────────┘
                                  │
            ┌─────────────────────┼─────────────────────┐
            │                     │                     │
            ▼                     ▼                     ▼
        ┌────────┐           ┌────────┐           ┌────────┐
        │  CMS   │           │ EMAIL  │           │PRICING │
        └────────┘           └────────┘           └────────┘
            │                     │                     │
            ▼                     ▼                     ▼
        ┌────────┐           ┌────────┐           ┌────────┐
        │FEATURES│           │ STUDIO │           │BLUEPRINT│
        │        │           │ FLOW   │           │ TENANT │
        └────────┘           └────────┘           └────────┘

  Tutti i consumer leggono `active_languages` a runtime.
  Nessun consumer può hardcodare la lista.
```

### 3.1 Responsabilità per layer

| Layer | Responsabilità rispetto alle locale |
|---|---|
| **Command Center** | Sola fonte autorizzata. Attiva/disattiva. Definisce default. Definisce fallback chain per locale. |
| **active_languages (DB)** | Persistenza canonical. Schema definito in §4. |
| **CMS** (`site_blocks`, `block_localizations`) | Memorizza valori per ogni `(block_id, locale)`. Resolver legge `active_languages` per validazione. |
| **Email transactional** | Locale di invio = `recipient.preferred_locale` se in `active_languages`, altrimenti fallback chain. |
| **Pricing pages** | Resolver `GET /api/site/block?locale=<X>` rispetta automaticamente. |
| **Features pages** | Stesso pattern. |
| **Studio Activation Flow** | Locale del funnel = locale homepage al momento dell'ingresso (deve essere in `active_languages`). |
| **Blueprint Tenant** | Locale di default scelta dal Founder tra `active_languages` al primo accesso. |

---

## 4. Schema `active_languages` aggiornato

Sostituisce la versione in `02_TECH_DESIGN.md` §1.2.

```sql
-- Migration 026 (drafted, NOT executed)
CREATE TABLE IF NOT EXISTS active_languages (
  code              VARCHAR(10)   PRIMARY KEY,
    -- BCP-47 con region obbligatorio: "it-IT", "en-US", "ar-AE", ...
  english_name      TEXT          NOT NULL,
    -- "Italian (Italy)", "Arabic (UAE)"
  native_name       TEXT          NOT NULL,
    -- "Italiano", "العربية"
  flag_emoji        TEXT,
    -- "🇮🇹" (opzionale per locale senza region-flag chiaro)
  iso_639_1         CHAR(2)       NOT NULL,
    -- "it", "en", "ar"
  region            CHAR(2)       NOT NULL,
    -- "IT", "US", "GB", "AE", "BR", ...
  text_direction    VARCHAR(3)    NOT NULL DEFAULT 'ltr',
    -- 'ltr' | 'rtl' — critical per ar-*, he-*
  is_enabled        BOOLEAN       NOT NULL DEFAULT true,
  is_default        BOOLEAN       NOT NULL DEFAULT false,
    -- esattamente UNA locale ha is_default=true (vincolo applicativo)
  fallback_locale   VARCHAR(10),
    -- riferimento a un'altra `code` in active_languages (può essere NULL → cade su default)
  sort_order        INTEGER       NOT NULL DEFAULT 1000,
  activated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  deactivated_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT chk_active_languages_direction CHECK (text_direction IN ('ltr','rtl'))
);

CREATE INDEX idx_active_languages_enabled
  ON active_languages(sort_order)
  WHERE is_enabled = true;

CREATE UNIQUE INDEX uq_active_languages_default
  ON active_languages((is_default))
  WHERE is_default = true;
  -- garantisce massimo 1 default
```

### 4.1 Seed iniziale — esempio, NON definitivo

> **Importante**: questo è un seed **starter**. Il Command Center può aggiungere/rimuovere locale runtime. La lista qui sotto è un punto di partenza ragionevole e va trattata come tale, non come "lista delle lingue MOOD".

```sql
-- DRAFTED — NOT EXECUTED — extendable at runtime via Command Center
INSERT INTO active_languages
  (code, english_name, native_name, flag_emoji, iso_639_1, region, text_direction, is_enabled, is_default, fallback_locale, sort_order)
VALUES
  ('it-IT', 'Italian (Italy)',           'Italiano',   '🇮🇹', 'it', 'IT', 'ltr', true,  true,  NULL,    10),
  ('en-US', 'English (United States)',   'English',    '🇺🇸', 'en', 'US', 'ltr', true,  false, 'it-IT', 20),
  ('en-GB', 'English (United Kingdom)',  'English',    '🇬🇧', 'en', 'GB', 'ltr', false, false, 'en-US', 30),
  ('fr-FR', 'French (France)',           'Français',   '🇫🇷', 'fr', 'FR', 'ltr', false, false, 'en-US', 40),
  ('de-DE', 'German (Germany)',          'Deutsch',    '🇩🇪', 'de', 'DE', 'ltr', false, false, 'en-US', 50),
  ('es-ES', 'Spanish (Spain)',           'Español',    '🇪🇸', 'es', 'ES', 'ltr', false, false, 'en-US', 60),
  ('es-MX', 'Spanish (Mexico)',          'Español',    '🇲🇽', 'es', 'MX', 'ltr', false, false, 'es-ES', 70),
  ('ar-AE', 'Arabic (UAE)',              'العربية',     '🇦🇪', 'ar', 'AE', 'rtl', false, false, 'en-US', 80),
  ('pt-BR', 'Portuguese (Brazil)',       'Português',  '🇧🇷', 'pt', 'BR', 'ltr', false, false, 'en-US', 90),
  ('pt-PT', 'Portuguese (Portugal)',     'Português',  '🇵🇹', 'pt', 'PT', 'ltr', false, false, 'pt-BR', 100),
  ('zh-CN', 'Chinese (Simplified)',      '中文',        '🇨🇳', 'zh', 'CN', 'ltr', false, false, 'en-US', 110),
  ('ja-JP', 'Japanese (Japan)',          '日本語',      '🇯🇵', 'ja', 'JP', 'ltr', false, false, 'en-US', 120)
ON CONFLICT (code) DO UPDATE SET updated_at = now();
```

**Default**: solo `it-IT` ed `en-US` sono `is_enabled=true` al seed iniziale (operatività MVP). Tutte le altre sono pre-registrate ma disattive: il Command Center può attivarle quando le traduzioni sono pronte. Nuove locale non in seed possono essere aggiunte via UI Command Center senza migration.

---

## 5. Fallback chain dinamica

### 5.1 Resolver locale

Quando un cliente richiede contenuto per `locale=X`:

```
1. lookup `active_languages` WHERE code = X AND is_enabled = true
   → se manca o disabilitata, X = active_languages.default

2. fetch `block_localizations` WHERE block_id = B AND locale = X
   → se trovato, return

3. follow `active_languages.fallback_locale` chain
   → per ogni step, fetch block_localizations
   → max 5 hop per evitare loop

4. fetch source_value da site_blocks (locale di authoring)

5. return key as-is + log warning "missing translation for B in locale X"
```

### 5.2 Esempi pratici

| Cliente chiede | active_languages state | Resultato |
|---|---|---|
| `fr-FR` | enabled, fallback=`en-US` | tenta `fr-FR` → se mancante, `en-US` → se mancante, source |
| `pt-BR` | enabled, fallback=`en-US` | tenta `pt-BR` → `en-US` → source |
| `xx-XX` | non in `active_languages` | usa default attivo → eventualmente source |
| `ar-AE` | enabled, fallback=`en-US`, RTL | tenta `ar-AE` → `en-US`; UI imposta `dir="rtl"` |

### 5.3 Detection automatica nuove locale

Quando il Command Center attiva una locale (es. `zh-CN`):
- Il sistema **non richiede deploy**
- Tutti i resolver leggono `active_languages` con cache TTL ≤ 5 min
- Le pagine cominciano automaticamente a offrire `zh-CN` nei selector
- Il CMS surface mostra warning: "🚧 attiva ma 0/N chiavi tradotte"
- Workflow editoriale: aggiungere `block_localizations` row per ogni `(block_id, 'zh-CN')`

Nessuna modifica al codice è richiesta per attivare una nuova locale.

---

## 6. Workflow editoriale — Translation Package

### 6.1 Generazione dinamica

Quando un copy lead deve produrre traduzioni per un nuovo set di chiavi (es. il pacchetto Pricing & Positioning):

```
1. Query active_languages WHERE is_enabled = true
   → ottieni la lista N
2. Per ogni locale in N:
     genera file di traduzione con tutte le chiavi del namespace
     pre-popolato con source_value della locale `is_default`
3. Copy lead riempie/revisiona ogni file
4. Import bulk in block_localizations
```

### 6.2 Translation file format

Pattern: un file per locale, nome `<namespace>.<locale>.json`.

Esempio (per `site.pricing` con locale attiva `pt-BR`):

```
site.pricing.pt-BR.json
─────────────────────────
{
  "_meta": {
    "namespace": "site.pricing",
    "locale": "pt-BR",
    "source_locale": "it-IT",
    "generated_at": "2026-06-01T10:00:00Z",
    "active_languages_snapshot": ["it-IT","en-US","pt-BR"]
  },
  "keys": {
    "hero.eyebrow": { "source": "Modalità di adozione", "translated": "" },
    "hero.title":   { "source": "Blueprint non si compra. Si configura.", "translated": "" },
    ...
  }
}
```

### 6.3 Translation Coverage Report

Comando Command Center → `/command-center/translations/coverage`:

```
Namespace: site.pricing
Total keys: 92

| Locale  | Translated | Missing | Coverage |
|---------|------------|---------|----------|
| it-IT   | 92         | 0       | 100% ✅  |
| en-US   | 92         | 0       | 100% ✅  |
| fr-FR   | 87         | 5       | 95%  ⚠️  |
| de-DE   | 0          | 92      | 0%   🚧  |
```

Una locale `is_enabled=true` con coverage < 80% mostra warning visibile nel funnel/pagine in quella locale.

---

## 7. Impatto sui documenti già prodotti

I documenti seguenti **menzionano IT/EN/FR/DE/ES come lista chiusa** in vari punti. Questa direttiva li sovrascrive globalmente.

| Documento | Riferimento da reinterpretare |
|---|---|
| `00_OVERVIEW_AND_UX.md` | §4.3 "Languages multi-select" → leggere `active_languages`, non lista hardcoded |
| `01_COPY_AND_CMS.md` §3 "naming convention" | Tutte le menzioni "5 lingue", "IT/EN/FR/DE/ES" → "tutte le locale attive" |
| `01_COPY_AND_CMS.md` §4 "Traduzioni" | Le tabelle IT/EN/FR/DE/ES sono **esempi indicativi**, NON la lista definitiva. Le traduzioni reali si producono runtime sulle locale attive del momento. |
| `01_COPY_AND_CMS.md` §6 "Conta chiavi" | "590 rows in block_localizations" diventa "N × M chiavi" dove N = locale attive e M = numero chiavi del namespace |
| `01_COPY_AND_CMS.md` §7 "Governance lingue" | Riconferma + esteso da questa direttiva |
| `02_TECH_DESIGN.md` §1.2 `active_languages` | Schema **sostituito** dalla versione in §4 di questo documento |
| `02_TECH_DESIGN.md` §2.2 `GET /countries` payload | Resta corretto (countries è separato) |
| `02_TECH_DESIGN.md` §2.3 `GET /languages` | Già coerente con "filter is_enabled=true" — formalmente OK ma le locale tornate sono `xx-XX` con region |
| `03_SCORE_E2E_MIGRATION.md` §3.2 cutover criteria | "FR/DE/ES possono arrivare in cutover+7gg" → "le locale attive non default possono completarsi in cutover+7gg" |
| `STUDIO_ACTIVATION_LIFECYCLE.md` §8.4 i18n | Riconferma + esteso da questa direttiva |
| `OPEN_DECISIONS_RESOLUTION.md` | Nessuna decision riguarda direttamente le locale — invariato |
| `PRICING_POSITIONING_REVISION.md` §5.4 | Le traduzioni vanno generate per **tutte le locale attive**, non per 5 hardcoded |
| `PRICING_POSITIONING_REVISION.md` §6.3 | Stima "154 touch points" diventa "N_chiavi × M_locale_attive" |
| `TIER_NAMING_FINAL_REVISION.md` §6.3 | Mitigation "Practice in italiano" si applica a tutte le locale non-EN: il **brand name** resta in lingua originale, solo descrizioni traducono. |

---

## 8. Regole di scrittura per documenti futuri

Quando produrrai documenti futuri:

| Da evitare | Da usare |
|---|---|
| "Le 5 lingue del sistema" | "Le N locale attive in `active_languages` (N variabile)" |
| "IT, EN, FR, DE, ES" | "tutte le locale attive configurate in Command Center" |
| "Locale supportate: ..." | "Locale supportate: query `active_languages` WHERE is_enabled = true al momento della richiesta" |
| "5 colonne lingua" | "N colonne lingua, generate dinamicamente" |
| Tabella esempio con 5 lingue | Tabella esempio con `<locale_active_1>`, `<locale_active_2>`, ... + nota "esempio, non lista definitiva" |
| "Add support for pt-BR" come task feature | Non-task: pt-BR si abilita runtime via CC senza release |
| `en` (senza region) | `en-US` o `en-GB` esplicito |

### 8.1 Esempio: prima vs dopo

**Prima** (vietato d'ora in poi):
> Il pacchetto Pricing & Positioning sarà tradotto in IT, EN, FR, DE, ES. Stimiamo 92 chiavi × 5 lingue = 460 traduzioni.

**Dopo** (corretto):
> Il pacchetto Pricing & Positioning sarà tradotto in **tutte le locale attive in Command Center al momento del go-live**. Stimiamo 92 chiavi × N locale (N corrente = `SELECT COUNT(*) FROM active_languages WHERE is_enabled = true`) traduzioni. Se domani il Command Center attiva una nuova locale, il translation package viene rigenerato senza modifiche al codice.

---

## 9. Code conventions (per futura implementazione)

### 9.1 Frontend (React)

```javascript
// Hook canonico
import { useActiveLocales } from '@/lib/i18n';

const Component = () => {
  const { locales, default: defaultLocale, current } = useActiveLocales();
  // locales = [{ code: 'it-IT', native_name: 'Italiano', ... }, ...]
  return (
    <LocaleSwitcher options={locales} value={current} />
  );
};

// VIETATO
const HARDCODED = ['it', 'en', 'fr', 'de', 'es'];  // ❌
```

### 9.2 Backend (FastAPI/Pydantic)

```python
# Validator canonico
async def validate_locale(locale: str, db) -> bool:
    row = await db.fetchrow(
        "SELECT 1 FROM active_languages WHERE code = $1 AND is_enabled = true",
        locale
    )
    return row is not None

# VIETATO
ALLOWED_LOCALES = {'it', 'en-us', 'fr', 'de', 'es'}  # ❌
```

### 9.3 SQL

```sql
-- Resolver canonico
SELECT b.value
FROM block_localizations b
WHERE b.block_id = $1
  AND b.locale = $2
  AND EXISTS (
    SELECT 1 FROM active_languages a
    WHERE a.code = $2 AND a.is_enabled = true
  );

-- VIETATO
SELECT b.value
FROM block_localizations b
WHERE b.block_id = $1
  AND b.locale IN ('it', 'en-us', 'fr', 'de', 'es');  -- ❌
```

---

## 10. Acceptance criteria

Prima di approvare qualsiasi PR o documento futuro, verificare:

- [ ] Nessuna lista hardcoded di codici locale (`['it', 'en', ...]` o similari)
- [ ] Tutte le locale in formato `xx-XX` (region tag obbligatorio)
- [ ] Tutti i fetch di "lingue disponibili" vanno via `active_languages`
- [ ] Il numero di locale supportate è espresso come variabile (`N`, `count(*)`), non come numero fisso
- [ ] I translation package files sono generati dinamicamente da `active_languages`, mai pre-scritti a mano per "5 lingue"
- [ ] La validazione `locale` (Zod, Pydantic, ecc.) chiama il DB, non un enum hardcoded
- [ ] Il fallback chain è configurabile per locale via `active_languages.fallback_locale`
- [ ] Il flag `text_direction` è rispettato (RTL per ar-*, he-*)
- [ ] Nuove locale possono essere attivate solo via Command Center, senza modifiche al codice

---

## 11. Migration impact summary

| Migration / Operazione | Stato | Note |
|---|---|---|
| Schema `active_languages` (Migration 026) | **REVISIONATO** — vedi §4 (region tag obbligatorio + RTL flag + fallback_locale + is_default) |
| Seed `active_languages` | **REVISIONATO** — solo `it-IT` + `en-US` enabled al MVP; altre pre-registrate inactive |
| Schema `studio_requests_v2.submission_locale` | Resta `VARCHAR(10)` — accetta `xx-XX` |
| Schema `studio_v2_drafts.locale` | Resta `VARCHAR(10)` — accetta `xx-XX` |
| Schema `block_localizations.locale` | **REVISIONARE** — deve essere `VARCHAR(10)` se attualmente più stretto |
| Schema `users.preferred_locale` | **REVISIONARE** — idem |
| CMS resolver | **REVISIONARE** — implementa fallback chain dinamica §5 |
| Translation package files | **REVISIONARE** — generazione dinamica §6 |
| Pricing & Positioning translations | **NON GENERARE PER 5 LINGUE** — generare dinamicamente per locale attive al go-live |

---

## 12. Cosa NON cambia

- Il **content** dei copy proposti in `PRICING_POSITIONING_REVISION.md` resta valido
- Il **naming dei tier** (Blueprint Studio / Practice / Enterprise — in attesa di approvazione finale) resta valido
- L'**information architecture** delle pagine /features e /pricing resta valida
- Lo **schema generale** di `studio_requests_v2`, `studio_v2_drafts`, `countries`, `reserved_subdomains` resta valido
- Le **decisioni open** (D1-D10) restano valide
- Il **canonical lifecycle** in `STUDIO_ACTIVATION_LIFECYCLE.md` resta valido

Quello che cambia è **come gestiamo le lingue**, non **cosa diciamo**.

---

## 13. STOP

Documento direttiva consegnato. In attesa di:

1. **Conferma esplicita** dell'utente che questa direttiva è acquisita e binding
2. **Decisione sulle locale al MVP**: lasciare solo `it-IT` + `en-US` enabled come default, o pre-attivare anche altre?
3. **Decisione sul Command Center → /languages**: implementare la UI di gestione locale ora (richiede dev effort) o seed iniziale + UI in P2?

Nessuna implementazione fino a conferma utente.

— *fine documento direttiva* —
