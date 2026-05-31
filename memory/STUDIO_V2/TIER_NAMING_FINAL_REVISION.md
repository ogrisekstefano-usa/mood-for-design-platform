# TIER NAMING — FINAL REVISION
## MOOD for DESIGN™ · Blueprint adoption modes

> ⚠️ **OVERRIDE DIRETTIVA LOCALE 2026-05-31** — Vedi `LOCALE_ARCHITECTURE_DIRECTIVE.md`
> §6.3 mitigation "Practice in italiano" si applica a **tutte le locale non-EN attive** in `active_languages`:
> il **brand name** dei tier (`Blueprint Studio`, `Blueprint Practice`, `Blueprint Enterprise`) resta in inglese
> in ogni locale; solo le **descrizioni** vengono tradotte editorialmente.

> **Status**: DESIGN ONLY · revisione finale prima di autorizzazione implementazione
> **Versione**: 2026-05-31
> **Scope**: chiudere D1 con un naming definitivo, eliminato il registro aulico (Atelier/Maison)
> **Autorizzazioni utente già acquisite**: D6 (no prezzi pubblici) · D7 (no CTA "Demo") · D2 con revisione (manifesto trasformato in "Come viene adottato Blueprint™")

---

## 1. Vincoli di valutazione

Le 4 dimensioni richieste:

1. **Coerenza con mercato USA** — il naming non deve suonare strano, esotico o ambiguo a un Brand Manager americano, Senior Designer di NY o buyer corporate.
2. **Coerenza con interior design** — deve risuonare nel mondo del progetto (studi, showroom, contract, retail) senza tradire il dominio.
3. **Comprensibilità immediata** — al primo sguardo, il prospect capisce per chi è ogni tier senza leggere la descrizione.
4. **Scalabilità futura** — regge l'aggiunta di tier o configurazioni successive (es. Blueprint Origin™ tier, nuove modalità per agenzie/brand).

---

## 2. Opzione A — *Blueprint Studio · Blueprint Practice · Blueprint Enterprise*

| Tier | Nome | Per chi |
|---|---|---|
| T1 | **Blueprint Studio** | Studio individuale o team ristretto |
| T2 | **Blueprint Practice** | Studio strutturato, 5–15 persone, più mercati |
| T3 | **Blueprint Enterprise** | Gruppi, brand, network multi-studio |

### Valutazione

**Coerenza mercato USA**: ✅ **Alta**
- "Studio", "Practice" e "Enterprise" sono parole **comuni** nel B2B americano.
- "Practice" in particolare è il termine **standard** in architettura/design statunitense per indicare uno studio operativo strutturato (es. "architectural practice", "design practice"). Usato da AIA, RIBA, Architectural Record, Dezeen.
- "Enterprise" è il livello aziendale universalmente riconosciuto in SaaS.

**Coerenza interior design**: ✅ **Alta**
- "Studio" → universale per chi progetta.
- "Practice" → terminologia industry-native (più che "Atelier" che è francese-italiano e suona luxury europea).
- "Enterprise" → riconosciuto per gruppi, brand, contract.
- Suona professionale **senza** auliche.

**Comprensibilità immediata**: ⚠️ **Media-alta**
- "Studio" e "Enterprise" sono autoesplicativi.
- "Practice" può essere meno immediato in IT/ES/FR (in italiano "pratica" suona ambiguo, in francese "pratique" è odd). Funziona meglio in **EN** che in **IT**.
- Prefisso "Blueprint" ripetuto 3 volte aiuta brand consistency ma allunga il naming.

**Scalabilità futura**: ✅ **Alta**
- Pattern `Blueprint + qualifier` è infinitamente estendibile: Blueprint Network, Blueprint Education, Blueprint Brand, Blueprint Lab, ecc.
- Allineato direttamente al canonical doc che già parla di "Blueprint Origin™".

### Rischi
- "Practice" in italiano richiede una giustificazione editoriale (non è una parola italiana naturale).
- Tre volte "Blueprint" può saturare visivamente in card o tabella.

### Verdetto sintetico
**Premium professionale, leggermente meno comprensibile in IT che in EN. Massima coerenza con il brand Blueprint.**

---

## 3. Opzione B — *Studio · Showroom · Enterprise*

| Tier | Nome | Per chi |
|---|---|---|
| T1 | **Studio** | Studio individuale o team ristretto |
| T2 | **Showroom** | Showroom multibrand, retail design, presenza fisica |
| T3 | **Enterprise** | Gruppi, brand, network multi-studio |

### Valutazione

**Coerenza mercato USA**: ⚠️ **Media**
- "Studio" e "Enterprise" funzionano.
- "Showroom" è una parola **anglo-italiana** universalmente compresa nel design ma rischia di **categorizzare il tier** invece che descriverne la dimensione: un buyer americano potrebbe pensare "io ho uno studio di architettura, non un showroom, quindi T2 non è per me" — anche se T2 è in realtà il tier "studio strutturato".
- Il naming **identifica il tipo di business**, non il livello di adozione.

**Coerenza interior design**: ⚠️ **Media**
- "Studio" e "Showroom" sono assolutamente nativi al settore.
- Ma: nel funnel `/studio/v2` (Movimento 1), abbiamo già **`multibrand_showroom`** come categoria professionale (vedi `00_OVERVIEW_AND_UX.md` §3.1).
- Mischiare "categoria professionale" (showroom è una categoria) con "tier di adozione" crea confusione: lo Studio di Interior Design può essere su Tier "Showroom"? Suona contraddittorio.

**Comprensibilità immediata**: ❌ **Bassa**
- Il prospect legge "Showroom" e pensa "tier per showroom" — ma vorremmo che fosse il tier per studi strutturati.
- "Enterprise" è terzo livello dopo due nomi non-tecnici → discontinuità.
- Mancanza del prefisso "Blueprint" rompe brand consistency.

**Scalabilità futura**: ❌ **Bassa**
- Naming per **categoria** non scala: cosa fai se un giorno aggiungi un tier "Brand"? "Brand" è già una categoria nel funnel.
- Collisione semantica permanente con `studio_type` enum.

### Rischi
- **Confusione strutturale**: il prospect deve scegliere il tier basandosi sulla *dimensione/configurazione*, non sul *tipo di business*. Showroom come nome di tier rompe questo principio.
- Difficoltà di traduzione: "Showroom" funziona in tutte le lingue ma resta nome di luogo, non di livello.

### Verdetto sintetico
**Concettualmente disallineato dal modello. "Showroom" è già una categoria professionale nel Movimento 1 del funnel: usarla come nome di tier crea collisione.**

---

## 4. Opzione C — *Essential · Professional · Enterprise*

| Tier | Nome | Per chi |
|---|---|---|
| T1 | **Essential** | Studio individuale o team ristretto |
| T2 | **Professional** | Studio strutturato |
| T3 | **Enterprise** | Gruppi, brand, network |

### Valutazione

**Coerenza mercato USA**: ✅ **Massima**
- Naming **standard B2B SaaS USA**. Identico a HubSpot, Asana, Atlassian, Notion, Figma, Linear, Webflow.
- Un buyer americano lo capisce **in 0 secondi**, perché è esattamente come ogni altro tool che già usa.
- Riconoscibile da CTO, IT procurement, finance — non solo da designer.

**Coerenza interior design**: ⚠️ **Bassa**
- Naming **agnostico al settore**. Non parla di studio, atelier, showroom.
- Non comunica che MOOD è specifico per il design.
- Rischio di percezione "qualsiasi SaaS" — perde il posizionamento premium / di settore.

**Comprensibilità immediata**: ✅ **Massima**
- "Essential" = entry, "Professional" = team, "Enterprise" = grande organizzazione.
- Pattern già internalizzato da ogni utente B2B.
- Comprensibile in IT/EN/FR/DE/ES senza traduzione (Essential resta Essential, Professional resta Professional).

**Scalabilità futura**: ✅ **Alta**
- Pattern estendibile facilmente: Free, Starter, Essential, Professional, Business, Enterprise, Custom.
- Allineato alla **tabella comparativa già esistente** nel CMS attuale (`Essential / Studio / Professional / Enterprise` → diventerebbe `Essential / Professional / Enterprise` rimuovendo l'incoerente "Studio").

### Rischi
- **Posizionamento appiattito**: MOOD perde la sua specificità editoriale. Suona "tool generico", non "piattaforma per studi di design".
- **Anti-differenziazione**: in un mercato saturo di SaaS, questo naming non aiuta a essere ricordati.
- "Essential" può essere percepito come **entry-low / economico** — non ideale se il T1 vuole comunque essere premium.

### Verdetto sintetico
**Massima comprensibilità, massima neutralità. Perde però il posizionamento di settore. Sicurezza commerciale alta, brand impact basso.**

---

## 5. Matrice comparativa

| Criterio | A (Blueprint Studio/Practice/Enterprise) | B (Studio/Showroom/Enterprise) | C (Essential/Professional/Enterprise) |
|---|---|---|---|
| Coerenza mercato USA | ✅ Alta | ⚠️ Media | ✅ Massima |
| Coerenza interior design | ✅ Alta | ⚠️ Media (collisione semantica) | ❌ Bassa |
| Comprensibilità immediata (EN) | ✅ Alta | ⚠️ Ambigua | ✅ Massima |
| Comprensibilità immediata (IT) | ⚠️ Media ("Practice" non native) | ✅ Alta | ✅ Massima |
| Scalabilità futura | ✅ Alta | ❌ Bassa | ✅ Alta |
| Differenziazione brand | ✅ Alta | ⚠️ Media | ❌ Bassa |
| Coerenza brand Blueprint | ✅ Massima | ⚠️ Media | ⚠️ Media |
| Coerenza con CMS attuale | ⚠️ Rinomina | ⚠️ Rinomina parziale | ✅ Riusa "Essential/Professional/Enterprise" |
| Rischio di confusione con Movimento 1 funnel | ✅ Nessuno | ❌ Alto ("showroom" già categoria) | ✅ Nessuno |
| Editorial test ("lo direi davanti a un Brand Manager USA?") | ✅ Sì | ⚠️ Confuso | ✅ Sì |
| Premium positioning | ✅ Alto | ⚠️ Misto | ❌ Basso |

---

## 6. Raccomandazione finale

### 6.1 Verdetto

→ **OPZIONE A — Blueprint Studio · Blueprint Practice · Blueprint Enterprise**

### 6.2 Motivazione in 5 righe

L'Opzione A è l'unica che bilancia **brand consistency** (prefisso Blueprint), **dominio specifico** ("Practice" è terminologia industry-native nell'architettura/design anglosassone), **scalabilità** (pattern estendibile), e **leggibilità internazionale**. L'Opzione B introduce collisione semantica con il funnel (`showroom` è già categoria). L'Opzione C è commercialmente sicura ma appiattisce il posizionamento MOOD.

### 6.3 Mitigazione del rischio "Practice in italiano"

L'unico rischio dell'Opzione A è che "Practice" non sia una parola italiana naturale. Mitigation:
- Il **brand name** dei tier resta lo stesso in tutte le lingue (`Blueprint Practice` anche in IT/FR/DE/ES) — pattern standard B2B internazionale.
- Le **descrizioni** dei tier sono tradotte editorialmente; il nome resta come "marchio".
- Esempio in italiano:
  > **Blueprint Practice** — per lo studio strutturato che firma progetti complessi e opera su più mercati.

Questo è già il pattern di altre piattaforme premium internazionali (es. Notion non traduce "Plus" e "Business"; Figma non traduce "Professional" e "Organization"; Webflow non traduce "Workspace").

### 6.4 Fallback

Se l'utente vuole comunque massima sicurezza commerciale → **Opzione C** (Essential / Professional / Enterprise) è la seconda scelta. Sacrifica posizionamento per chiarezza universale.

L'Opzione B è **sconsigliata** per la collisione semantica con `studio_type` enum del funnel.

---

## 7. Naming finale proposto per approvazione

```
T1 → Blueprint Studio
     Per lo studio individuale o il team ristretto.

T2 → Blueprint Practice
     Per lo studio strutturato che firma progetti complessi.

T3 → Blueprint Enterprise
     Per gruppi, brand e network multi-studio.
```

### CMS keys impattate (placeholder da rimpiazzare in `PRICING_POSITIONING_REVISION.md`)

| Chiave | Valore |
|---|---|
| `site.pricing.tier_01.eyebrow` | `Blueprint Studio` |
| `site.pricing.tier_02.eyebrow` | `Blueprint Practice` |
| `site.pricing.tier_03.eyebrow` | `Blueprint Enterprise` |
| `site.pricing.comparison.tier_01_name` | `Blueprint Studio` |
| `site.pricing.comparison.tier_02_name` | `Blueprint Practice` |
| `site.pricing.comparison.tier_03_name` | `Blueprint Enterprise` |
| `site.pricing.comparison.tier_04_name` | _(vuoto — tier 4 non più previsto)_ |

Tutti i riferimenti `<<NAME_T1/T2/T3>>` in `PRICING_POSITIONING_REVISION.md` §3.3 saranno sostituiti con i nomi sopra al go-ahead.

---

## 8. Cosa succede dopo questa approvazione

Una volta approvato il naming finale (Opzione A o override esplicito):

1. **Aggiornamento `PRICING_POSITIONING_REVISION.md`** → naming definitivo sostituito ovunque
2. **Generazione `PRICING_POSITIONING_TRANSLATIONS.md`** → traduzioni EN/FR/DE/ES editorialmente curate (non letterali)
3. **CMS UPDATE** → 50 chiavi aggiornate + 42 nuove (vedi `PRICING_POSITIONING_REVISION.md` §6.3)
4. **Preview deploy** → URL preview per QA visivo
5. **Review utente** → IT + EN minimo
6. **Production cutover** → /features + /pricing live

Tutte queste operazioni sono **additive/idempotenti** sul CMS (`site_blocks` + `block_localizations`), compatibili con l'hold P0 sul DB operativo.

---

## 9. Allineamento con D2, D6, D7 già approvate

| Decisione | Impatto sul naming Opzione A |
|---|---|
| **D6** (no prezzi pubblici) | I tier `Blueprint Studio / Practice / Enterprise` saranno presentati **senza prezzi**. CTA universale: `Parlane con un Advisor` |
| **D7** (no CTA "Demo") | Sostituzione globale: `Richiedi una demo` → `Candida il tuo studio` (link `/studio`) per CTA primarie · `Parlane con un Advisor` per CTA secondarie sui singoli tier |
| **D2 revisionata** ("Come viene adottato Blueprint™") | Sezione `philosophy` ribattezzata `adoption` con copy operativo: i tre step (Candidatura → Dialogo Advisor → Attivazione) descrivono il **metodo di adozione**, non una filosofia. Naming tier coerente: ogni tier è una **modalità di adozione** di Blueprint, non un piano. |

Il naming Opzione A rinforza la decisione D2: i tier sono modalità di adozione di **Blueprint** (prefisso ripetuto = unica piattaforma con tre modalità), non prodotti separati.

---

## 10. Risposta richiesta

Per sbloccare CMS Update → Preview → Review → Production:

1. ✅ **Approva Opzione A** → procedo con implementazione come da §8
2. 🔁 **Approva Opzione C** (fallback commerciale)
3. 🔧 **Override**: nuovo naming proposto (specifica T1/T2/T3 esatti)

*STOP — in attesa di approvazione finale naming.*

— *fine documento* —
