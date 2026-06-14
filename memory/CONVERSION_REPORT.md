# CONVERSION REPORT — MOOD for DESIGN
## Sintesi Esecutiva per Decision Making
**Data:** Giugno 2026

---

## VERDETTO IN 10 PAROLE

> **La landing non vende. Non c'è contenuto. Non c'è studio.**

---

## STATO ATTUALE vs. OBIETTIVO

| | Attuale | Obiettivo |
|---|---|---|
| Homepage | Completamente vuota (placeholder Blueprint) | Luxury studio landing con hero, progetti, team |
| Brand | "MOOD for DESIGN" (SaaS) | Brand dello studio cliente |
| Progetti | 0 pubblicati | 3-5 portfolio reali |
| Magazine | 0 articoli | 3+ contenuti editoriali |
| Fiducia | Zero segnali umani | Fondatore + team + storia |
| CTA | "INIZIA IL TUO DESIGN JOURNEY™" | "Richiedi una consulenza" |

---

## PERCHÉ LA HOMEPAGE È VUOTA

**Causa tecnica identificata**: Il frontend calcola il `TENANT_SLUG` dall'hostname del preview URL (`i18n-recovery-1`) invece di `studio`.  
Il CMS ha **21 sezioni già configurate** — ma non vengono mai caricate.  
**Fix**: 1 riga di codice.

---

## TOP 5 PROBLEMI CHE BLOCCANO OGNI CONVERSIONE

1. **P0** — Homepage visivamente vuota (tenant slug mismatch)
2. **P0** — Debug bar visibile a tutti i visitatori ("EDITORIAL · DEBUG runtime 3")
3. **P0** — Brand della piattaforma SaaS esposto (non il brand dello studio)
4. **P0** — 0 progetti pubblicati (portfolio inesistente)
5. **P0** — CTA incomprensibile per un non-utente ("INIZIA IL TUO DESIGN JOURNEY™")

---

## PER OGNI PERSONA

| Persona | Primo Impatto | Probabilità Conversione |
|---|---|---|
| Cliente privato fascia alta | "Il sito non funziona" | 0% |
| Cliente luxury | "Non trasmette lusso né fiducia" | 0% |
| Architetto | "Non capisco cosa offrono" | 0% |
| Interior Designer | "Sembra un software" | 0% |
| Showroom | "Nessun catalogo, nessun contatto" | 0% |
| Developer immobiliare | "Nessun portfolio, nessuna casistica" | 0% |

---

## QUICK WINS (Prima di spendere 1€ in marketing)

### Azioni senza codice (solo Blueprint)
- [ ] Pubblicare 3-5 Design Journeys come portfolio pubblico
- [ ] Pubblicare 3 articoli Magazine
- [ ] Configurare steps in "Come Lavoriamo"

### Azioni con codice minimo (1-2h)
- [ ] Fix tenant slug detection (1 riga)
- [ ] Disabilitare debug bar in produzione
- [ ] Spostare hero image a bucket pubblico

### Azioni editoriali (nessun codice, content only)
- [ ] Riscrivere CTA: "INIZIA IL TUO DESIGN JOURNEY™" → "Raccontaci il tuo progetto"
- [ ] Riscrivere "RIENTRA" → "Area Riservata"
- [ ] Riscrivere Professionals: rimuovere "MOOD for DESIGN™"

---

## STIMA DI IMPATTO POST-FIX

Se si eseguono i Quick Wins sopra:

| Metrica | Prima | Dopo (stima) |
|---|---|---|
| Bounce rate | ~95% | ~60-70% |
| Tempo medio sul sito | <5s | 45-90s |
| Click su CTA | 0 | misurabile |
| Percepito come studio luxury | No | Parzialmente sì |
| Percepito come software | Sì | No |

Per raggiungere percepito premium **completo** (come Studio Rinaldi nel riferimento):
- Sezione team/fondatore con volto umano
- 6-8 progetti con immagini reali e location
- 5+ articoli magazine
- Indirizzo showroom in footer
- Statistiche reali (anni, progetti, paesi)

---

## RIFERIMENTO VISIVO — COSA MANCA

Confronto con il mockup Studio Rinaldi fornito dall'utente:

| Elemento Studio Rinaldi | Presente in MOOD attuale? |
|---|---|
| Hero image luxury interior | ❌ (non caricato) |
| "Il tuo spazio. Il nostro progetto." | ❌ (non visibile) |
| "Prenota una consulenza" CTA | ❌ (CTA è "DESIGN JOURNEY™") |
| 4 step "Come Lavoriamo" | ❌ (empty slot) |
| Foto team (3 persone) | ❌ |
| 3 progetti con location (Lugano, Puglia, Milano) | ❌ |
| Sezione "Il tuo progetto inizia prima del primo incontro" | ❌ |
| 3 articoli Magazine | ❌ |
| Footer con logo + nav + numero telefono | ❌ |

---

*Report generato nel contesto del MOOD UX/UI & Conversion Sprint — Giugno 2026*
