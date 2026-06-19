# MULTILINGUAL GAP REPORT
**Sprint:** CMS Consolidation & Multilingual Governance  
**Data:** Febbraio 2026

---

## LOCALES TARGET

| Locale | Codice | Stato |
|--------|--------|-------|
| Italiano | `it` / `it-IT` | ✅ Primario — completo |
| English (US) | `en-US` | ✅ Completo |
| English (GB) | `en-GB` | ✅ Completo |
| Français | `fr-FR` | ⚠️ Parziale — mancano alcune sezioni |
| Deutsch | `de-DE` | ⚠️ Parziale — mancano alcune sezioni |
| Español (ES) | `es-ES` | ⚠️ Parziale — mancano alcune sezioni |
| Español (MX) | `es-MX` | ❌ Non presente |

---

## SEZIONI CON COPERTURA MULTILINGUA COMPLETA

| Sezione | IT | EN-US | EN-GB | FR | DE | ES |
|---------|----|----|----|----|----|----|
| nav_top labels | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ |
| hero_editorial (home) | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ |
| editorial_triptych (professionals 6 types) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| partner_case_studies | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| partner-application hero | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| cinematic_quote contact | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| design_journey hl_* | ✅ | ✅ | ✅ | — | — | — |
| locale_picker_label_i18n | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## GAP IDENTIFICATI

### P1 — Da completare ASAP
1. **FR / DE / ES** per sezioni hero, atmosphere_statement, design_journey di services/about/professionals
   - Attualmente: `_default` (IT) come fallback
   - Fix: aggiungere traduzioni nelle sezioni esistenti

2. **es-MX** — locale mancante
   - Attualmente: fallback su `es-ES`
   - Fix: aggiungere `es-MX` nei template come alias di `es-ES` nel `bag()` resolver

### P2 — Futura governance

3. **FORM_LABELS in PartnerApplicationPage**
   - Form field labels in codice come oggetto locale-aware `{it: ..., en: ...}`
   - Fix: creare CMS page `partner-application/form` con labels come sections

4. **Email status hints in BeginJourneyPage**
   - `"Verifica in corso…"`, `"✓ Email disponibile"`, ecc.
   - Fix: aggiungere bundle `begin-journey/email_hints`

---

## RESOLVER LOCALE ATTUALE

Il sistema usa la funzione `bag(sec, locale)` per risolvere il contenuto per locale:

```js
priority: locale_content[locale] → locale_content[_default] → {}
```

**Locales supportati dal resolver:**
- `it`, `it-IT` → `locale_content.it` o `locale_content.it-IT`
- `en`, `en-US`, `en-GB` → `locale_content.en-US` poi `locale_content.en`
- `fr`, `fr-FR` → `locale_content.fr-FR`
- `de`, `de-DE` → `locale_content.de-DE`
- `es`, `es-ES`, `es-MX` → `locale_content.es-ES`

**Fallback chain universale:**
`locale_content[exact_locale]` → `locale_content[_default]` → `locale_content[en-US]` → `{}`
