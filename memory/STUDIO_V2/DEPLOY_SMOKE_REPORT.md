# DEPLOY SMOKE REPORT
## MOOD for DESIGN™ Public Site · Preview Deploy Verification

> **Data deploy:** 2026-05-31
> **Reviewer:** Agent E1 (handoff fork)
> **Ambiente:** Preview · `https://design-journey-cms.preview.emergentagent.com/`
> **Tipo deploy:** Hot-reload Preview (Emergent K8s ingress) — frontend `pid 2283` / backend `pid 47`
> **Metodo verifica:** Curl API status + Playwright DOM inspection + screenshot reali

---

## 0 · Verdetto sintetico

> ### ✅ DEPLOY_SUCCESSFUL
>
> Il preview deploy è stabile e operativo. Tutte le 9 verifiche tecniche e visive sono passate.
> **Una sola anomalia P1 di routing CTA è stata identificata** (vedi §5) — è di natura logica, non infrastrutturale, e va indirizzata prima del tuo test manuale del lifecycle "Visitor → Studio Request → Advisor → Founder → Blueprint Access".

---

## 1 · Service health (post-deploy)

| Service | PID | Uptime | Status |
|---|---:|---:|:---:|
| backend (FastAPI) | 47 | 0:49:09 | RUNNING ✅ |
| frontend (React) | 2283 | 0:07:57 (post hot-reload P1-002) | RUNNING ✅ |
| mongodb (cluster local) | 51 | 0:49:09 | RUNNING ✅ |
| nginx-code-proxy | 45 | 0:49:09 | RUNNING ✅ |

---

## 2 · API smoke (curl)

| Endpoint | Status | Body size | Esito |
|---|:---:|---:|:---:|
| `GET /api/site/locales` | 200 | 380 B | ✅ `default=it-IT`, `enabled=[it-IT, en-US]`, `count=2` |
| `GET /api/site/navigation` | 200 | — | ✅ `main=4 items`, `right=3 items` |
| `GET /api/site/pages/features?locale=it-IT` | 200 | 5293 B | ✅ |
| `GET /api/site/pages/features?locale=en-US` | 200 | 5252 B | ✅ |
| `GET /api/site/pages/pricing?locale=it-IT` | 200 | 8073 B | ✅ |

---

## 3 · Page-by-page smoke (Playwright)

### 3.1 `/caratteristiche` (it-IT)

| Controllo | Valore | Esito |
|---|---|:---:|
| Page load + render | `document.body.innerText` length = 1894 | ✅ |
| Hero "Una sola piattaforma per tutto il progetto." | Presente | ✅ |
| CTA "Candida il tuo studio" presente | Sì | ✅ |
| `<html lang>` | `it-IT` | ✅ |
| Forbidden terms count | `{Atelier:0, atelier:0, Maison:0, Demo:0, demo:0, €:0, $:0}` | ✅ |
| Item 06 immagine | `https://images.unsplash.com/photo-1616137422495-...` ("Magazine · spazio editoriale") | ✅ |

### 3.2 `/versioni-prezzi` (it-IT)

| Controllo | Valore | Esito |
|---|---|:---:|
| Page load + render | `document.body.innerText` length = 3265 | ✅ |
| Tier names (HTML source, original case) | `Blueprint Studio:✅, Blueprint Practice:✅, Blueprint Enterprise:✅` | ✅ |
| Manifesto "Blueprint non si compra. Si configura." | Presente | ✅ |
| Zero "Demo" / "Atelier" | Confermato | ✅ |
| Zero prezzi numerici (€/$/mese) | Confermato | ✅ |
| CTA "Parlane con un Advisor" (count) | 4 occorrenze (3 tier + 1 comparison) | ✅ |
| CTA "Candida il tuo studio" (count) | 1 occorrenza (intro section) | ✅ |
| Block "Team dedicato 03" copy | "Dalla modalità **Blueprint Practice** in poi" (post-cleanup) | ✅ |

> _Nota tecnica:_ Le eyebrow dei tier sono renderizzate via CSS `text-transform: uppercase`, quindi `body.innerText` restituisce "BLUEPRINT PRACTICE" anziché "Blueprint Practice". Verificato lato HTML source: il valore originale rimane case-sensitive corretto.

### 3.3 `/versioni-prezzi` (en-US, dopo switch)

| Controllo | Valore | Esito |
|---|---|:---:|
| Manifesto EN | "Blueprint isn't bought. It's configured." | ✅ |
| Tier names (immutati per direttiva) | `Blueprint Studio:✅, Blueprint Practice:✅, Blueprint Enterprise:✅` | ✅ |
| Zero "Demo" / "Atelier" anche in EN | Confermato | ✅ |
| `<html lang>` | `en-US` | ✅ |

---

## 4 · Locale Switch (it-IT ↔ en-US)

| Step | Operazione | Risultato | Esito |
|---|---|---|:---:|
| 1 | Bootstrap default | `html lang="it-IT"`, locale chip mostra `IT` | ✅ |
| 2 | Click `[data-testid=locale-switcher-trigger]` | Dropdown aperto, mostra 2 opzioni: `locale-option-it-IT` ("Italiano"), `locale-option-en-US` ("English (US)") | ✅ |
| 3 | Native names dal `platform_languages.native_name` | "Italiano" + "English (US)" — non hardcoded | ✅ |
| 4 | Click `locale-option-en-US` | Pagina ri-renderizza in EN, nav switches a "Audience / Features / Editions & Pricing / Training / Sign in / Support / Activate Blueprint™" | ✅ |
| 5 | `html lang` updated | `en-US` | ✅ |
| 6 | Switch back: click `locale-option-it-IT` | `html lang` torna a `it-IT`, copy IT ripristinato | ✅ |
| 7 | Persistenza `localStorage['mood-locale']` | Confermato (reload conserva la scelta) | ✅ |
| 8 | Architettura RTL ready | `<html dir>` impostato dinamicamente; pronto per future locale RTL | ✅ |

---

## 5 · CTA principali — inventory & routing

> ⚠️ **P1 FINDING — CTA routing misalignment**

| CTA text | data-testid | href attuale | href atteso | Esito |
|---|---|---|---|:---:|
| Supporto | `nav-right-support` | `/supporto` | `/supporto` | ✅ |
| Accedi | `nav-right-login` | `/accedi` | `/accedi` | ✅ |
| Attiva Blueprint™ | `nav-right-activate_blueprint` | `/studio` | `/studio` | ✅ |
| Candida il tuo studio (page intro) | `page-intro-cta` | `/dedicato-a` | `/studio` (funnel entry) | ❌ **P1** |
| Parlane con un Advisor (tier 1) | `pricing-tier-cta-01` | `/dedicato-a` | `/supporto` (o flusso Advisor) | ❌ **P1** |
| Parlane con un Advisor (tier 2) | `pricing-tier-cta-02` | `/dedicato-a` | `/supporto` | ❌ **P1** |
| Parlane con un Advisor (tier 3) | `pricing-tier-cta-03` | `/dedicato-a` | `/supporto` | ❌ **P1** |
| Parlane con un Advisor (comparison) | `pricing-comparison-contact-cta` | `/supporto` | `/supporto` | ✅ |

**Diagnosi:**
La CTA `page-intro-cta` su `/versioni-prezzi` (sezione "Come viene adottato Blueprint") e le 3 CTA dei tier puntano tutte a `/dedicato-a` (Audience page) invece di:
- `Candida il tuo studio` → dovrebbe entrare nel funnel `/studio` (Studio Activation Entry) per coerenza con `Attiva Blueprint™` header
- `Parlane con un Advisor` (tier) → dovrebbe portare a un dialogo con un Advisor (verosimilmente `/supporto` o un endpoint contact dedicato)

Lo capisco come una eredità della struttura CMS attuale: la chiave `target` o `href` per questi blocchi punta erroneamente a `/dedicato-a`. È una **patch CMS** (1 UPDATE su `editorial_blocks.metadata.href` per ognuno dei 4 CTA), non un refactor di codice.

**Impatto sul lifecycle test:**
Quando avvierai il test manuale "Visitor → Studio Request", il primo click su "Candida il tuo studio" dalla pagina pricing porterà a `/dedicato-a` invece che a `/studio`. **Il funnel di candidatura non si avvierà** da questo CTA. Funziona invece via `Attiva Blueprint™` nell'header globale (routing OK).

**Raccomandazione:**
Patch CMS pre-lifecycle-test (15 min). Vedi §7 per l'azione consigliata.

---

## 6 · Header / Footer integrity

| Elemento | Valore rilevato | Esito |
|---|---|:---:|
| Logo header | `alt="MOOD for DESIGN"` · src `customer-assets.emergentagent.com/.../chl...` (logotype OO) | ✅ |
| Nav main (4 items) | Dedicato a · Caratteristiche · Versioni e Prezzi · Formazione | ✅ |
| Nav right (3 items + switcher) | Supporto · Accedi · Attiva Blueprint™ · 🌐 IT | ✅ |
| Footer · sezione ESPLORA | Dedicato a · Caratteristiche · Versioni e Prezzi · Formazione | ✅ |
| Footer · sezione LEGALE | Privacy Policy · Cookie Policy · Termini di Servizio | ✅ |
| Footer · copyright | "© 2026 MOOD for DESIGN™" | ✅ |
| Footer · service line | "Questo servizio è fornito da MOOD for DESIGN" | ✅ |
| Footer · platform line | "Running on Blueprint OS™ · Editorial Infrastructure for Design Studios" | ✅ |
| Social icons | Instagram + LinkedIn presenti | ✅ |

---

## 7 · Issues classification

### 🔴 P1 — Pre-lifecycle-test (raccomandato fix)

**SMOKE-001 — Routing CTA pricing CTAs**
- 4 CTA (`page-intro-cta`, `pricing-tier-cta-01/02/03`) puntano a `/dedicato-a` invece dei target naturali.
- **Impatto:** Il funnel "Candida il tuo studio" non si avvia dalla pricing page.
- **Fix proposto:** Patch CMS — 4 UPDATE su `editorial_blocks` (chiavi `href`/`target` dei blocchi CTA). Stima: 15 minuti.
- **Rischio se non patchato:** Il tuo test manuale del lifecycle si bloccherà al primo CTA da pricing.

### 🟡 P2 — Tracked, non blocking

**SMOKE-002 — Studio Activation V2** (eredità del report precedente)
- Brief approvato, `/studio` ancora su V1 copy. Dipende dal P0 DB unblock.

### 🔵 NOTE — non issues

- "BLUEPRINT ENTERPRISE" appare uppercase nel `body.innerText` → è solo CSS `text-transform: uppercase`. HTML source contiene "Blueprint Enterprise" in case corretto. Test falso-negativo iniziale chiarito.

---

## 8 · Differenze rispetto a PREVIEW_REVIEW_REPORT_V2

| Item | V2 Report | Smoke Post-Deploy |
|---|:---:|:---:|
| Locale switcher UI | ✅ ATTESO | ✅ CONFERMATO live |
| Zero "Atelier" | ✅ ATTESO | ✅ CONFERMATO (4 pagine testate) |
| Zero "Demo" | ✅ ATTESO | ✅ CONFERMATO |
| Zero "Maison" | ✅ ATTESO | ✅ CONFERMATO |
| Item 06 image | ✅ ATTESO | ✅ CONFERMATO |
| BCP-47 html lang + dir | ✅ ATTESO | ✅ CONFERMATO (it-IT, en-US, ltr) |
| **CTA routing target** | _Non testato cliccando (P2-003)_ | ❌ **Scoperto P1: 4 CTA misroute** |

> Il punto **P2-003** del report precedente ("Routing target dei CTA non testati cliccando") era stato classificato come P2. Il smoke test cliccato l'ha promosso a **P1** per impatto operativo sul lifecycle test.

---

## 9 · Recommendation

> ## ✅ **DEPLOY_SUCCESSFUL**

Il preview deploy è tecnicamente stabile, performante e coerente con tutti i requisiti P1 originariamente richiesti (Atelier/Maison/Demo elimination, Locale Switcher, Asset item 06).

**Tuttavia, prima del tuo test manuale del lifecycle**, raccomando uno dei due percorsi:

### Opzione A — _Quick patch CMS_ (consigliata, 15 min)
Eseguire un'UPDATE CMS sulle 4 CTA misroutate:
- `page-intro-cta` → target `/studio`
- `pricing-tier-cta-01/02/03` → target `/supporto`

Dopo la patch, il lifecycle test inizierà senza intoppi dal click su qualunque CTA pricing.

### Opzione B — _Procedere comunque con il lifecycle test_
Utilizzando come unico path d'ingresso il CTA `Attiva Blueprint™` (header, ✅ già corretto). Le 4 CTA misroutate diventerebbero un "issue noto" da risolvere subito dopo il tuo test, prima di passare a production.

---

**NON procediamo in produzione.** Lo deploy è stato mantenuto sul tier Preview come da tua istruzione esplicita.

In attesa della tua decisione (A o B) per procedere con il tuo test manuale del lifecycle:
**Visitor → Studio Request → Advisor → Founder → Blueprint Access**.

---

*— fine report —*
