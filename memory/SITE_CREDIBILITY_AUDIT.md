# SITE CREDIBILITY AUDIT
## Tenant Demo: Studio — MOOD for DESIGN™ Platform

> Generato: 17 Giugno 2026  
> Sprint: Content & Credibility Sprint  
> Scopo: Valutare la qualità del tenant demo come strumento white-label B2B

---

## METODOLOGIA

Valutazione su 5 dimensioni (scala 1–10) con criteri oggettivi verificati via DB + frontend.  
Ogni dimensione include: score, evidenze, gap residui, raccomandazioni P0/P1.

---

## DIMENSIONE 1 — TRUST (Fiducia percepita)

**Score: 7 / 10**

### Evidenze positive
| Elemento | Stato | Note |
|----------|-------|------|
| CTA unificato "Prenota una consulenza" | ✅ OK | Tutti i CTA pubblici puntano a `/consulenza` — zero `/begin-journey` residui |
| Portfolio 6 progetti | ✅ OK | Tipologie: residenziale ×3, hospitality ×2, contract ×1 |
| Magazine 12 articoli | ✅ OK | Copertura: materiali, interior, architettura, tendenze, lifestyle, benessere |
| About page 7 sezioni | ✅ OK | Manifesto, team, approccio, numeri, portfolio teaser, CTA |
| HTTPS + dominio stabile | ✅ OK | `preview.emergentagent.com` |
| Nessun dato fittizio nel footer | ✅ OK | Struttura completa, senza recapiti inventati |

### Gap residui
| Elemento | Gap | Priorità |
|----------|-----|----------|
| Social media handle | Non configurati (struttura presente) | P1 |
| Testimonianze clienti | Assenti | P2 |
| Loghi brand fornitori | Trust strip parzialmente vuota | P1 |

---

## DIMENSIONE 2 — AUTHORITY (Autorevolezza editoriale)

**Score: 7.5 / 10**

### Evidenze positive
| Elemento | Stato | Note |
|----------|-------|------|
| Copy manifesto originale | ✅ OK | "Non vendiamo soluzioni. Ascoltiamo storie." — tono B2B autentico |
| Bilingue IT+EN | ✅ OK | 8 articoli IT, 4 articoli EN; pagine About/Services/Professionals bilingue |
| Categorie magazine diversificate | ✅ OK | 7 categorie: materiali, interior, architettura, tendenze, lifestyle, benessere, progettazione |
| Cinematic quote sezioni | ✅ OK | Tono editoriale coerente su tutte le pagine |
| Professionals page B2B | ✅ OK | Copy per architetti, designer, general contractor, artigiani |
| Stats band About | ✅ OK | "18 anni · 200+ progetti · 12 paesi · 100% riservatezza" |

### Gap residui
| Elemento | Gap | Priorità |
|----------|-----|----------|
| Autori articoli magazine | Nessun byline | P2 |
| Data pubblicazione visibile | Non renderizzata nel frontend Magazine | P1 |
| Categorie magazine nel frontend | Solo 7/7 popolate — navigazione per categoria non implementata | P2 |

---

## DIMENSIONE 3 — EDITORIAL QUALITY (Qualità dei contenuti)

**Score: 7 / 10**

### Inventario contenuti

#### Progetti (6/6 — target raggiunto)
| # | Slug | Tipo | Anno | Demo-marked |
|---|------|------|------|-------------|
| 1 | boutique-suite-costiera-amalfitana | ospitalità | 2024 | No (legacy) |
| 2 | penthouse-milano-porta-nuova | residenziale | 2025 | No (legacy) |
| 3 | villa-lago-di-como | residenziale | 2024 | No (legacy) |
| 4 | residenza-in-campagna | residential | 2025 | ✅ `cms-showcase-demo` |
| 5 | suite-boutique-waterfront | hospitality | 2025 | ✅ `cms-showcase-demo` |
| 6 | spazio-di-lavoro-creativo | contract | 2024 | ✅ `cms-showcase-demo` |

> I progetti 1-3 (legacy) non hanno `editorial_tone = cms-showcase-demo`. Non hanno titoli che fingono essere un'azienda reale, ma mancano del marker esplicito.  
> **Raccomandazione P1**: aggiornare anche i progetti legacy con `editorial_tone = 'cms-showcase-demo'`.

#### Articoli Magazine (12/12 — target raggiunto)
| # | Slug | Categoria | Locale | Demo-marked |
|---|------|-----------|--------|-------------|
| 1 | cucina-come-spazio-di-design | progettazione | it | No (legacy) |
| 2 | luce-naturale-benessere-domestico | benessere | it | No (legacy) |
| 3 | tendenze-2025-materiali-naturali | tendenze | it | No (legacy) |
| 4 | 2025-material-trends-stone-linen-wood | tendenze | en | No (legacy) |
| 5 | designing-with-natural-light | benessere | en | No (legacy) |
| 6 | the-kitchen-as-design-statement | progettazione | en | No (legacy) |
| 7 | marmo-luce-architettura-italiana | materiali | it | ✅ `cms-showcase-demo` |
| 8 | arredare-il-silenzio | interior | it | ✅ `cms-showcase-demo` |
| 9 | hospitality-design-2025 | architettura | it | ✅ `cms-showcase-demo` |
| 10 | neutro-come-scelta-radicale | tendenze | it | ✅ `cms-showcase-demo` |
| 11 | designing-for-privacy | interior | en | ✅ `cms-showcase-demo` |
| 12 | cucina-manifesto-del-living-contemporaneo | lifestyle | it | ✅ `cms-showcase-demo` |

#### Pagine CMS (6/6 pubblicate)
| Pagina | Sezioni | Pubbl. | Completezza |
|--------|---------|--------|-------------|
| `home` | ~8 | 2026-06-16 | ✅ Completa |
| `about` | 7 | 2026-06-17 | ✅ Completa |
| `professionals` | 6 | 2026-06-16 | ✅ Completa |
| `services` | 5 | 2026-06-16 | ✅ Completa |
| `navigation` | 1 | 2026-06-17 | ✅ Completa |
| `footer` | 1 | 2026-06-17 | ✅ Struttura completa |

### Gap residui
| Elemento | Gap | Priorità |
|----------|-----|----------|
| Galleria immagini per progetto | Solo hero_url — nessuna gallery | P1 |
| Body blocks articoli più ricchi | I nuovi articoli hanno 1-3 blocchi (vs. 7 del legacy) | P1 |
| Progetti legacy senza demo-marker | 3 progetti, 6 articoli senza `editorial_tone` | P1 |

---

## DIMENSIONE 4 — CONVERSION (Conversione)

**Score: 8.5 / 10**

### Evidenze positive
| Elemento | Stato | Note |
|----------|-------|------|
| CTA primario unificato | ✅ ✅ | "Prenota una consulenza" su tutte le 6 pagine principali |
| `/begin-journey` rimosso dai CTA pubblici | ✅ ✅ | 13 occorrenze fissate (8 JSX + 1 nav DB + 4 about DB) |
| CTA Hero → `/consulenza` | ✅ OK | Testato visivamente |
| CTA Header desktop + mobile | ✅ OK | Usa `copy.nav.cta_href` da CMS |
| CTA Final section | ✅ OK | Usa `copy.finalCTA.private_href` da CMS |
| About page CTA finale | ✅ OK | "Prenota una consulenza privata" → `/consulenza` |
| Professionals page CTA | ✅ OK | "Prenota una consulenza" → `/consulenza` |
| Services page CTA | ✅ OK | "Prenota una consulenza" → `/consulenza` |

### Gap residui
| Elemento | Gap | Priorità |
|----------|-----|----------|
| Pagina `/consulenza` | Contenuto non verificato in questo sprint | P0 (pre-deploy) |
| Form acquisizione lead | `/begin-journey` esiste ma non è collegato ai CTA pubblici | Da valutare |

---

## DIMENSIONE 5 — BRAND CONSISTENCY (Coerenza di brand)

**Score: 8 / 10**

### Evidenze positive
| Elemento | Stato | Note |
|----------|-------|------|
| Nomenclatura coerente | ✅ OK | "Studio" su tutti i componenti — zero nomi fittizi |
| Tono editoriale coerente | ✅ OK | Manifesto, B2B copy, magazine — stesso registro |
| Palette visiva coerente | ✅ OK | Dark editorial + accent teal su tutto il sito pubblico |
| Tipografia serif coerente | ✅ OK | Cormorant/serif per titoli su tutte le pagine |
| Nessun ruolo fittizio | ✅ OK | Team usa ruoli generici ("Creative Director") — mai nomi inventati |
| Nessun indirizzo fittizio | ✅ OK | Footer senza recapiti — struttura CMS pronta per dati reali |
| Classificazione demo chiara | ✅ OK | `editorial_tone = 'cms-showcase-demo'` su tutti i nuovi contenuti |

### Gap residui
| Elemento | Gap | Priorità |
|----------|-----|----------|
| Logo brand tenant | Presente (test logo) — non sostituito | P0 per go-live reale |
| Favicon | Non personalizzata | P2 |
| Colophon footer | "Studio" generico — OK per demo, da personalizzare per go-live | P1 |

---

## SCORE COMPLESSIVO

| Dimensione | Score | Peso | Contributo |
|-----------|-------|------|-----------|
| 1. Trust | 7.0 | 20% | 1.40 |
| 2. Authority | 7.5 | 20% | 1.50 |
| 3. Editorial Quality | 7.0 | 25% | 1.75 |
| 4. Conversion | 8.5 | 25% | 2.13 |
| 5. Brand Consistency | 8.0 | 10% | 0.80 |
| **TOTALE** | | | **7.58 / 10** |

---

## RIEPILOGO AZIONI COMPLETATE IN QUESTO SPRINT

| Task | Stato | Note |
|------|-------|------|
| About page 7 sezioni CMS | ✅ FATTO | Hero, manifesto, team, approccio, stats, portfolio, CTA |
| Footer premium struttura completa | ✅ FATTO | Zero dati fittizi — struttura pronta per tenant reale |
| Progetti 3 → 6 | ✅ FATTO | +3 tipologie: residential, hospitality, contract |
| Magazine 6 → 12 | ✅ FATTO | +6 articoli bilingue: materiali, interior, architettura, tendenze, lifestyle |
| Professionals page 6 sezioni | ✅ FATTO | Copy B2B completo per 5 profili professionali |
| Services page 5 sezioni | ✅ FATTO | 4 tipologie + processo + CTA |
| LEGACY_CTA_SCAN.md | ✅ FATTO | 13 fix documentati — zero /begin-journey nei CTA pubblici |
| Classificazione demo-content | ✅ FATTO | `editorial_tone = 'cms-showcase-demo'` + `tags: ['demo-content']` |
| Ripubblicazione pagine | ✅ FATTO | about, navigation, footer ripubblicati 2026-06-17 |

---

## PRIORITÀ BACKLOG POST-SPRINT

### P0 — Pre go-live
- [ ] Verificare e testare la pagina `/consulenza` (form acquisizione lead attivo)
- [ ] Logo tenant: sostituire logo demo con logo cliente reale

### P1 — Qualità contenuto
- [ ] Aggiungere demo-marker ai 3 progetti legacy (`boutique-suite`, `penthouse`, `villa-lago`)
- [ ] Aggiungere demo-marker ai 6 articoli magazine legacy
- [ ] Arricchire body_blocks dei nuovi articoli (da 1-3 → 5-7 blocchi)
- [ ] Aggiungere gallery_asset_ids ai 3 nuovi progetti
- [ ] Configurare social handles nel footer CMS (da pannello admin)
- [ ] Popolare trust strip (brand/partner logos) sulla homepage

### P2 — Ottimizzazione
- [ ] Navigazione per categoria nel frontend Magazine
- [ ] Favicon personalizzata
- [ ] Visualizzazione data pubblicazione articoli
- [ ] Schema.org markup per SEO

---

*Audit generato automaticamente — Content & Credibility Sprint · MOOD for DESIGN™*
