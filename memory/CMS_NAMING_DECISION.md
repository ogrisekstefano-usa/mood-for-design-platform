# CMS NAMING DECISION
**Data**: 2026-06-21  
**Sprint**: V2.0 Pre-Launch UX Cleanup  

---

## PROBLEMA

L'entry point per modificare il sito web pubblico si chiamava "Blueprint Experience" (in `SettingsPage.jsx`) o "Experience Studio" (tile Settings) — entrambi termini non intuitivi.

Nei test reali: un utente che cerca "dove modifico la homepage" non associa mai la parola "Experience" a questa funzione.

---

## ANALISI ALTERNATIVE

| Nome candidato | Pro | Contro |
|--------------|-----|--------|
| Website Studio | Autoesplicativo ("website" = sito), "Studio" coerente con il tono del brand | Nessuno |
| Website & Content | Chiarisce anche i contenuti | Doppio concetto |
| Content Studio | "Content" è familiare | Non evoca "homepage" o "sito" |
| CMS | Tecnico, universale per professionisti digitali | Incomprensibile per showroom non tecnici |
| Blueprint Experience | Attuale — elegante ma opaco | Non comunica la funzione |

---

## DECISIONE

**Scelta: Website Studio**

Motivazione:
- "Website" comunica immediatamente la funzione (modifica il sito web)
- "Studio" mantiene il tono premium del brand
- Coerente con "Projects Studio", "Content Studio" già presenti nella sidebar
- Immediatamente comprensibile per uno showroom non tecnico

---

## MODIFICHE APPLICATE

| File | Modifica |
|------|---------|
| `tenant_config_resolver.py` | Aggiunta voce `website_studio` nella navigation tree (gruppo STUDIO, position 5) con route `/blueprint/experience` |
| `SettingsPage.jsx` | Tile `Experience Studio` → `Website Studio` |
| `HomepageBuilderPage.jsx` | 3 riferimenti a "Blueprint Experience" → "Website Studio" |

---

## VOCE SIDEBAR

```python
{"code": "website_studio", "label": "Website Studio",
 "route": "/blueprint/experience", "icon": "Globe",
 "test_id": "sidebar-nav-website-studio", "position": 5}
```

**Posizione**: gruppo STUDIO, prima voce — massima discoverability.

---

## VERIFICA

- Navigation API: `website_studio = Website Studio → /blueprint/experience` ✓
- Settings tile: label `Website Studio` visibile (count: 1) ✓
- Route `/blueprint/experience` invariata ✓

---

## ESITO

**PASS**
