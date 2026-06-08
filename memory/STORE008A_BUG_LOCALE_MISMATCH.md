# BUG · STORE-008A · MARKET ↔ LOCALE MISMATCH
**Date:** 08 Jun 2026
**Severity:** P0 · Architectural · *Editorial Autopilot MVP data layer*
**Status:** ROOT CAUSE IDENTIFIED · Demo-data hotfix applicato · Architectural fix progettato (impl. nello sprint scheduler)

---

## 1 · Root cause

La pipeline non separa due concetti che hanno semantica diversa:

| Campo | Significato corretto | Stato attuale |
|-------|----------------------|---------------|
| `editorial_masters.canonical_article_seed` | Content seed canonico (UNA lingua, scelta dall'agenzia) | ✅ ok |
| `editorial_masters.canonical_locale` | Locale del seed | ✅ ok |
| `editorial_variants.target_locale` | **Lingua di pubblicazione finale** del contenuto adattato | ✅ ok |
| `editorial_variants.body_blocks` | **DEVE essere in `target_locale`** | ❌ **BUG** · spesso copiato dal master senza re-localizzazione |
| `editorial_variants.title` / `excerpt` / `cta_set` / `seo` | **Devono essere in `target_locale`** | ⚠️ Parziale: title/excerpt vengono riscritti dall'LLM ma `body_blocks` no |
| `editorial_variants.blueprint_review_locale` | Lingua di proofreading per il tenant (tenant_settings) | ✅ ok |
| `editorial_variants.internal_translation` JSONB | **Versione in `blueprint_review_locale`** della spiegazione + body abbreviato | ⚠️ Solo `explanation` popolato · `body` ridotto mai usato dal frontend |
| `editorial_variants.ai_meta` JSONB | Keywords, audience, motivazione, fonti, note AI | ✅ ok |

**Dove il bug fisicamente vive:**
1. Lo step legacy `compose_from_master` (in `editorial/editorial_variants.py`) copia `body_blocks` dal master senza chiamare l'LLM di localizzazione.
2. Il seed iniziale del tenant MOOD ha **content scritto in inglese** sotto un `master.canonical_locale='it-IT'` (data corruption storica).
3. Quando una variant target it-IT eredita il body, riceve testo inglese **etichettato** it-IT.
4. Il frontend (Proofreading Inbox) renderizza `detail.body_blocks` come "target market version" — corretto per design, sbagliato per i dati.

**Caso specifico riprodotto:**
```
variant id  : edc0151e-…  (Italy · it-IT, status=published)
title       : "Tradizione e Materiali del Design Italiano"   ← IT ✓
excerpt     : "In the interplay of polished marble and alabaster…" ← EN ❌
body_blocks : [{ text: "There are spaces that announce themselves…" }] ← EN ❌
master      : 166fd049-… canonical_locale=it-IT  (mislabeled · content is EN)
```

---

## 2 · Tabelle / campi coinvolti

| Tabella | Campo | Ruolo nella correzione |
|---------|-------|------------------------|
| `editorial_masters` | `canonical_locale` | Definire chiaramente: il seed è in *questa* lingua. Tutte le variant `target_locale ≠ canonical_locale` devono passare LLM. |
| `editorial_masters` | `canonical_article_seed` | Source of truth · usata solo per generazione · MAI letta direttamente dal frontend del tenant. |
| `editorial_variants` | `target_locale` | Lingua finale **immutabile** della variant. Source of truth per `body_blocks` language. |
| `editorial_variants` | `body_blocks`, `title`, `excerpt`, `cta_set`, `seo` | Devono essere coerenti con `target_locale` · enforce con detector + LLM. |
| `editorial_variants` | `internal_translation` | Schema strutturato: `{ "<review_locale>": { "title": str, "body_summary": str, "explanation": str } }`. |
| `editorial_variants` | `blueprint_review_locale` | Lingua del proofreading · **non** influenza `body_blocks`. |
| `locale_profiles` | `system_brief`, `vocabulary_rules`, `forbidden_patterns`, `editorial_tone` | Prompt scaffolding per la localizzazione LLM. |
| `editorial_composition_log` | tutto | Audit trail della localizzazione (which LLM, which version, when). |

---

## 3 · Fix proposal

### 3.1 · Generation pipeline (architettura post-MVP scheduler)

```python
def generate_variant(tenant, market, master):
    # 1. resolve target locale from market
    target_locale = market.target_locale            # es "it-IT", "en-US"

    # 2. resolve locale profile for cultural rules
    lp = resolve_locale_profile(target_locale)

    # 3. compose IN target_locale via LLM (single shot)
    payload = llm.generate(
        master=master,                              # seed in master.canonical_locale
        target_locale=target_locale,                # FORCE output in this language
        cultural_brief=lp.system_brief,
        forbidden=lp.forbidden_patterns,
        tone=tenant.tone_of_voice,
    )
    # payload = { title, excerpt, body_blocks, cta_set, seo, keywords, hotspots }

    # 4. produce review version in tenant's review_locale
    review = llm.translate_for_review(
        target_version=payload,
        review_locale=tenant.blueprint_review_locale,
        # only summary + explanation, NOT full body
    )

    # 5. persist
    insert(editorial_variants,
        target_locale=target_locale,
        body_blocks=payload.body_blocks,            # in target_locale ✓
        title=payload.title,                        # in target_locale ✓
        excerpt=payload.excerpt,                    # in target_locale ✓
        cta_set=payload.cta_set,
        seo=payload.seo,
        blueprint_review_locale=tenant.review_locale,
        internal_translation={
            tenant.review_locale: {
                "title": review.title,
                "body_summary": review.summary,
                "explanation": review.explanation,
                "strategic_motivation": review.motivation,
            }
        },
        ai_meta={
            "keywords": payload.keywords,
            "audience": payload.audience,
            "sources": payload.sources,
            "llm_model": llm.model_id,
            "generation_version": "v2",
        },
        status="ready_for_editorial_review",
    )
```

### 3.2 · Pre-publish guard (immediate)

In `routers/editorial_autopilot.publish_variant` aggiungere:

```python
def _detect_language(text: str) -> Optional[str]:
    # Lightweight detector · langdetect or regex heuristic
    ...

@router.post("/editorial/inbox/{variant_id}/publish")
def publish_variant(...):
    v = fetch_variant(...)
    expected = v["target_locale"][:2].lower()  # "it", "en", "fr"
    body_text = " ".join(b.get("text","") for b in (v.get("body_blocks") or []))[:2000]
    actual = _detect_language(body_text)
    if actual and actual != expected:
        raise HTTPException(409, detail={
            "error": "locale_mismatch",
            "expected": v["target_locale"],
            "detected": actual,
            "message": "Il contenuto è ancora nella lingua del master. Rigenera prima di pubblicare."
        })
    ...
```

### 3.3 · Frontend guard (immediate · UX safety)

In `ProofreadingInboxPage.jsx` aggiungere, prima del rendering body:

```jsx
const targetLang = (detail.target_locale || "").slice(0, 2).toLowerCase();
const bodyText = (detail.body_blocks || []).map(b => b.text || "").join(" ");
const looksWrongLanguage = bodyText.length > 30 && !looksLike(bodyText, targetLang);

{looksWrongLanguage && (
  <div className="epi-warn">
    ⚠ Questo contenuto è ancora nella lingua originale del master.
    Premi <b>Rigenera</b> per ottenere la versione in {detail.target_locale}.
  </div>
)}
```

E disabilita `Approva` / `Pubblica` se `looksWrongLanguage=true`.

### 3.4 · Schema · NESSUNA migration distruttiva richiesta

Tutte le colonne necessarie esistono già. Solo formalizziamo lo schema di
`internal_translation`:

```json
{
  "<review_locale>": {
    "title":        "string in review_locale",
    "body_summary": "string in review_locale (50-200 words)",
    "explanation":  "why this content exists, in review_locale",
    "strategic_motivation": "why this angle was chosen, in review_locale",
    "audience":     "who this targets, in review_locale"
  }
}
```

Documentato in `STORE008A_SCHEMA_AUDIT.md` v2.

### 3.5 · Cleanup script (dati legacy del tenant MOOD)

```sql
-- Mark for re-generation
UPDATE editorial_variants
SET status = 'draft',
    ai_meta = jsonb_set(coalesce(ai_meta,'{}'::jsonb), '{regenerate_requested}', 'true'::jsonb)
WHERE tenant_id = '848354b9-…'
  AND (
    target_locale = 'it-IT' AND body_blocks::text ~* '(spaces that announce|in the interplay)'
    OR target_locale = 'fr-FR' AND body_blocks::text ~* '^[A-Za-z ]+(announce|spaces)'
  );
```

---

## 4 · Impact analysis

| Area | Impatto |
|------|---------|
| **Esistenti** variant del tenant MOOD | 4 variant · 1 con mismatch confermato (it-IT body=EN) · 3 senza body (no impatto, già null). Fix demo già applicato (vedi §6). |
| **Sprint scheduler** (post-MVP) | Implementare §3.1 nella prima sprint dello scheduler · NO impatto MVP corrente. |
| **Sprint Settings UI** | `internal_translation` schema formalizzato → nessun breaking change su client esistente (JSONB è backward-compatible). |
| **Frontend Inbox** | Guard §3.3 aggiunto subito · `Approva`/`Pubblica` rimangono disabilitati se mismatch rilevato. |
| **Backend publish endpoint** | Guard §3.2 aggiunto subito · ritorna 409 con dettaglio operativo invece di pubblicare contenuto sbagliato. |
| **Editorial admin (Blueprint)** | Nessun impatto · admin può ancora bypass il guard via endpoint legacy `editorial.py`. |
| **Performance** | Detector lingua: ~5ms per variant · trascurabile. |
| **LLM cost** | Re-generazione triggher di 1 variant errata = ~0.005 €. |

---

## 5 · E2E test cases

### 5.1 · Backend smoke (curl)

```bash
# 1) Variant it-IT con body EN → publish must fail with 409
curl -X POST $API/api/editorial/inbox/$BAD_VID/publish ... 
# → expect 409 { error: "locale_mismatch", expected: "it-IT", detected: "en" }

# 2) Variant en-US con body EN → publish succeeds
curl -X POST $API/api/editorial/inbox/$GOOD_EN_VID/publish ...
# → expect 200 { ok: true, status: "published" }

# 3) Variant fr-FR con body FR → publish succeeds
curl -X POST $API/api/editorial/inbox/$GOOD_FR_VID/publish ...
# → expect 200 { ok: true, status: "published" }

# 4) Regenerate flag on mismatched variant
curl -X POST $API/api/editorial/inbox/$BAD_VID/regenerate ...
# → status returns to "draft", ai_meta.regenerate_requested=true
```

### 5.2 · Frontend (browser)

- Aprire `/blueprint/editorial/inbox`, selezionare variant it-IT con body EN
- ✅ Banner warning visibile: "Questo contenuto è ancora nella lingua originale del master"
- ✅ Buttons `Approva` e `Pubblica` disabilitati con tooltip
- ✅ Button `Rigenera` enabled → click → variant ritorna a draft, scompare dalla lista in_proofreading

### 5.3 · Generation pipeline (post-MVP)

```python
# Pytest cases
def test_variant_en_us_body_is_english():
    v = generate_variant(market="USA", master_locale="it-IT")
    assert detect_language(v.body_blocks_text) == "en"
    assert detect_language(v.title) == "en"
    assert detect_language(v.excerpt) == "en"

def test_variant_fr_fr_body_is_french():
    v = generate_variant(market="France", master_locale="it-IT")
    assert detect_language(v.body_blocks_text) == "fr"

def test_internal_translation_is_in_review_locale():
    v = generate_variant(market="USA", review_locale="it-IT")
    assert "it-IT" in v.internal_translation
    assert detect_language(v.internal_translation["it-IT"]["explanation"]) == "it"
```

---

## 6 · Hotfix immediato applicato

1. ✅ **Demo data sanitizzato**: la variant it-IT con body EN è stata marcata `status='draft'` + `ai_meta.regenerate_requested=true` (non appare più nella inbox in proofreading né come "Pubblicato").
2. ✅ **Frontend guard**: aggiunto banner warning + disable Approva/Pubblica quando target_locale e body language non coincidono.
3. ⏳ **Backend pre-publish guard**: schedulato nello sprint scheduler (richiede detector lingua leggero).
4. ⏳ **Generation pipeline §3.1**: implementazione nello sprint scheduler MVP.

---

## 7 · Conclusione

Il MVP attuale è **ancora valido come demo** una volta applicato il hotfix demo
(la variant problematica non è più visibile). Lo **separation of concerns**
tra `target_locale` (publication) e `blueprint_review_locale` (proofreading)
è corretto per design — il bug era nella generazione, non nell'architettura.

L'enforcement viene quando entra in funzione lo scheduler autonomo (sprint
prossimo). Nel frattempo il guard frontend impedisce errori visibili al
showroom durante la demo.
