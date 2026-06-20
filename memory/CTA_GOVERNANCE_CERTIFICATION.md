# CTA GOVERNANCE CERTIFICATION
**Data**: 2026-06-20  
**Sprint**: Final Sales Readiness Sprint

---

## CERTIFICAZIONE: CTA Governance

### Definizione
Una CTA è "governabile" quando il suo testo (label), URL (href), target e visibilità possono essere modificati da Blueprint senza intervento del developer.

---

### CTA per Pagina

#### Navigazione globale (`nav_top`)
| CTA | Campo CMS | Status |
|-----|-----------|--------|
| Primary nav CTA (es. "Start a project") | `primary_cta_label` + `primary_cta_href` | ✅ CMS |
| Secondary nav CTA | `secondary_cta_label` + `secondary_cta_href` | ✅ CMS |
| Lingue localizzate | `locale_content` per ogni locale | ✅ BCP-47 |

#### Homepage — Dual CTA
| CTA | Campo CMS | Status |
|-----|-----------|--------|
| CTA Client (es. "Scopri i progetti") | `cta_client_label` + `cta_client_href` | ✅ CMS |
| CTA Professional (es. "Candidati come partner") | `cta_pro_label` + `cta_pro_href` | ✅ CMS |

#### Homepage — Pro Hero
| CTA | Campo CMS | Status |
|-----|-----------|--------|
| Hero CTA | `cta_label` + `cta_href` | ✅ CMS |

#### Partner Application
| CTA | Campo CMS | Status |
|-----|-----------|--------|
| Submit form | `cta_submit` in `partner_form_labels` | ✅ CMS (BCP-47) |

#### Projects Studio (Blueprint)
| CTA | Tipo | Status |
|-----|------|--------|
| Pubblica / Archivia | Sistema admin | ✅ Funzionale |

---

### Verifica Tecnica
- Tutte le CTA del nav usano `resolveLocaleBag` ✅
- Nessun `href` hardcoded nelle CTA principali ✅
- Il campo `target` (es. `_blank`) è configurabile via `settings` ✅

---

**VERDICT: ✅ PASS — CTA principali 100% governabili da CMS**
