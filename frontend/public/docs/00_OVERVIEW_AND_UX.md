# MOOD for DESIGN™ — Studio Activation Flow v2
## Documento 00 · Overview & UX Map

> ⚠️ **OVERRIDE DIRETTIVA LOCALE 2026-05-31** — Vedi `LOCALE_ARCHITECTURE_DIRECTIVE.md`
> Ovunque questo documento citi "lingue", "locale", "IT/EN/FR/DE/ES" o quantità statiche di idiomi:
> leggere "**tutte le locale attive in `active_languages` configurate dal Command Center**". Formato `xx-XX` obbligatorio.

> **Stato**: DESIGN ONLY · in attesa di approvazione · zero codice prodotto
> **Versione**: 2026-05-31 · drafting agent
> **Ambito**: redesign integrale della route `/studio` (funnel di candidatura tenant)
> **Convivenza**: il flow v1 resta intoccato fino al cutover (vedi `03_SCORE_E2E_MIGRATION.md` §3)

---

## 1. Executive Summary

### Mission
Trasformare `/studio` da percorso editoriale-narrativo a **funnel di qualificazione professionale** per studi di interior design, architettura, showroom, material specialist, brand. Durata target: **3–4 minuti**.

### Cosa fa il funnel
1. **Qualifica** il prospect (categoria, mercato, priorità)
2. **Raccoglie** dati strutturati (founder, contatti, identità tenant)
3. **Verifica** unicità email globale e disponibilità subdomain
4. **Genera** una `studio_request` in stato `pending_review`
5. **Calcola** un Tenant Qualification Score™ (vedi `03_…` §1) usato internamente da Advisor + Command Center

### Cosa NON fa
- ❌ Non crea tenant
- ❌ Non crea utenti
- ❌ Non provisiona subdomain
- ❌ Non mostra prezzi, moduli, funzionalità Blueprint/Design Journey/Material Intelligence
- ❌ Non chiede di scegliere temperament, workflow, ecosystem
- ❌ Non chiede di aggiungere collaboratori

### Decisioni di scope (approvate)
| Decisione | Esito |
|---|---|
| Schema DB | Solo `CREATE TABLE` additive (disegno, esecuzione differita) |
| Mapbox | Integrazione via `integration_playbook_expert_v2` in fase implementazione |
| Lingue | `active_languages` con seed dalle locale già attive (`block_localizations`) |
| Email uniqueness | View SQL `v_global_email_registry` (UNION read-only) |
| Output | Solo documenti — zero implementazione |
| Extra | Tenant Qualification Score™ |

---

## 2. Information Architecture

### Macro-flow
```
LANDING /studio
   │
   ▼
[Movimento 1]  Identità professionale       → studio_type
[Movimento 2]  Sede e mercato operativo     → country, city (geo), languages[]
[Movimento 3]  Priorità operative           → primary_goals[]
[Movimento 4]  Referente principale         → founder PII + email check
[Movimento 5]  Identità del tenant          → studio_name + subdomain check
   │
   ▼
SUBMIT → studio_requests_v2 (pending_review) + TQS calcolato
   │
   ▼
SUCCESS PAGE — "Richiesta ricevuta"
```

### Navigazione
- **Linear, single column**, una schermata per movimento (no wizard a step pills cliccabili)
- **Avanti / Indietro** per ogni movimento (no salti random)
- **Progress indicator** sottile in alto: `01 · 02 · 03 · 04 · 05` con stato (✓ done · ● current · ○ pending)
- **Auto-save** silenzioso a ogni `onBlur` valido (PATCH draft) — token persistente in `localStorage` + cookie HttpOnly per resume

### Stati globali
| Stato | UI | Trigger |
|---|---|---|
| `idle` | iniziale | First load |
| `editing` | input attivi | User typing |
| `validating` | spinner accanto al field | Async check (email, subdomain) |
| `valid` | check verde discreto | Async check OK |
| `invalid` | error message inline | Sync/async fail |
| `saving` | overlay leggero opzionale | Auto-save in corso |
| `submitting` | full overlay con loader | Submit finale |
| `submitted` | success page | Server OK |
| `error_recoverable` | toast + retry | Network/5xx |
| `error_blocking` | banner persistente | Email duplicate o subdomain non recuperabile |

---

## 3. Movimento per Movimento

> **Nota copy**: tutti i testi qui sono **placeholder funzionali** in italiano. La copy definitiva editorialmente revisionata + traduzioni sta in `01_COPY_AND_CMS.md`. Le chiavi CMS qui sono già quelle finali.

### 3.1 Movimento 1 — Identità professionale

**Goal**: classificare la categoria di business per scoring + advisor routing.

**Layout**:
- Titolo grande, sublinea breve, **grid responsive di 8 card** astratte
- Card: aspect-ratio 4:5, **texture/geometria editoriale** (NO fotografie reali di studi/showroom)
- Selezione **singola obbligatoria** (radio behavior)
- Card selezionata: bordo `#00C9B3` 2px + leggero glow + checkmark in alto-dx
- CTA primaria: "Avanti" attiva solo dopo selezione

**Card categories** (8):
| Slug | CMS key (title) | Visual archetype |
|---|---|---|
| `interior_design_studio` | `studio.activation.v2.m1.cat.interior_design_studio.title` | Linee architettoniche pulite, marmo sezionato |
| `architecture_studio` | `studio.activation.v2.m1.cat.architecture_studio.title` | Pianta tecnica astratta, blueprint blu |
| `multibrand_showroom` | `studio.activation.v2.m1.cat.multibrand_showroom.title` | Composizione modulare di materiali |
| `retail_design` | `studio.activation.v2.m1.cat.retail_design.title` | Volumi geometrici, luce diagonale |
| `stone_surface_specialist` | `studio.activation.v2.m1.cat.stone_surface_specialist.title` | Macro texture pietra/superficie |
| `contract_hospitality` | `studio.activation.v2.m1.cat.contract_hospitality.title` | Pattern grande scala, ripetizione |
| `furniture_brand` | `studio.activation.v2.m1.cat.furniture_brand.title` | Profilo legno/metallo astratto |
| `material_brand` | `studio.activation.v2.m1.cat.material_brand.title` | Swatch laminato seriale |

**Visual direction (asset)**:
- Tutti gli 8 asset devono essere **astratti, neutri, professionali** — Sumi-e nero + accenti `#00C9B3` o `#F5F2EC`
- Vietato: foto reali di studi, persone, brand identificabili
- Naming: `/cdn/studio-v2/m1/<slug>.webp` + `@2x.webp`

**Data captured**:
```json
{ "studio_type": "interior_design_studio" }
```

**Validation**:
- Sync: `studio_type ∈ enum(8)` — required

**Edge cases**:
- "None of the above" → al momento NON disponibile (forza scelta). In backlog: card aggiuntiva "Altro / Specificare" → free text → flag manuale advisor.

---

### 3.2 Movimento 2 — Sede e mercato operativo

**Goal**: localizzare lo studio + capire il perimetro linguistico operativo.

**Layout**:
- 3 form group verticali con label sopra, separati da spacing 32px

**Field A · Nazione**
- Componente: `<CountrySelect>` (combobox accessibile, search by name/native_name/code)
- Sorgente: `GET /api/studio/v2/countries?locale=<active>` → array `{ code, name_localized, flag_emoji, dial_code }`
- Rendering opzione: `🇮🇹 Italia` (flag emoji + native_name in locale corrente)
- Search: substring case-insensitive su `name_localized` + `english_name`
- Required
- Save: `country_code` (ISO-3166-1 alpha-2)

**Field B · Città**
- Componente: `<CityAutocomplete>` powered by Mapbox Geocoding
- **Disabled** finché `country_code` non è selezionato
- Filtro: `country=<country_code>&types=place,locality`
- Min chars: 2 · debounce 250ms · max 5 suggerimenti
- Display: `Milano, Lombardia, Italia`
- Fallback (Mapbox down o user offline): degrado a `<input type="text">` con flag `mapbox_fallback=true` salvato sulla request per follow-up advisor
- Save: `city`, `city_lat`, `city_lng`, `city_mapbox_id`, `region_admin1`
- Required

**Field C · Lingue operative**
- Componente: `<LanguageMultiSelect>` (chip-based)
- Sorgente: `GET /api/studio/v2/languages` → solo `is_enabled = true` ordinate per `sort_order`
- Min selezione: 1
- Max: 6 (limite editoriale, evita rumore nel TQS)
- Display chip: `🇮🇹 Italiano ×`
- Save: `languages[]` array di BCP-47 codes (`it`, `en-us`, `fr`, …)

**Validation summary**:
| Field | Rule | Error key |
|---|---|---|
| country_code | required, in countries.code | `studio.activation.v2.m2.errors.country_required` |
| city | required, ≥2 chars | `studio.activation.v2.m2.errors.city_required` |
| city_lat/lng | required if mapbox_fallback=false | `studio.activation.v2.m2.errors.city_invalid` |
| languages | required, length ≥1 ≤6 | `studio.activation.v2.m2.errors.languages_required` |

---

### 3.3 Movimento 3 — Priorità operative

**Goal**: capire **cosa** lo studio vuole risolvere oggi, **senza** vendergli moduli MOOD.

**Layout**:
- 6 card orizzontali a tutta larghezza, icona vettoriale (lucide) a sinistra, titolo + descrizione breve a destra
- Selezione **multipla** (min 1, max 4) — checkbox behavior
- Card selezionata: bordo `#00C9B3` 2px + tick a destra

**Opzioni** (slug → CMS key title):
| Slug | Key |
|---|---|
| `new_leads` | Generare nuovi contatti |
| `relationship_mgmt` | Organizzare relazioni e clienti |
| `materials_suppliers` | Gestire materiali e fornitori |
| `project_presentation` | Migliorare la presentazione dei progetti |
| `team_coordination` | Coordinare il lavoro del team |
| `digital_ecosystem` | Costruire un ecosistema digitale per lo studio |

**Data captured**:
```json
{ "primary_goals": ["relationship_mgmt", "materials_suppliers"] }
```

**Validation**:
- length 1..4 — required

**Backend usage**:
- Score (vedi `03_…` §1.5) — pesi per goal
- Advisor routing (futuro: goal → advisor specialization)
- Analytics dashboard (Command Center → conversion by primary_goal)

---

### 3.4 Movimento 4 — Referente principale

**Goal**: identificare la persona che dialogherà con l'Advisor.

**Layout**: form a 2 colonne su desktop, 1 colonna mobile.

| Field | Type | Required | Validation |
|---|---|---|---|
| `first_name` | text | ✓ | 2..60 chars, no digits |
| `last_name` | text | ✓ | 2..60 chars, no digits |
| `role_title` | text | ✓ | 2..80 chars (free text, no enum) |
| `email` | email | ✓ | RFC 5322 + DNS-MX (server) + **uniqueness check** |
| `phone_prefix` | select | ✓ | from countries.dial_code |
| `phone_number` | tel | ✓ | digits only 6..15, no spaces |

**Email uniqueness (CRITICO)**:
- Componente: `<EmailFieldGlobalCheck>`
- Trigger: `onBlur` AND `value` valido RFC
- Endpoint: `POST /api/studio/v2/check-email` `{ "email": "x@y.it" }`
- **Anti-enumeration**: il server risponde sempre con jitter 200..400ms costante. Vedi `02_TECH_DESIGN.md` §6.
- Risposta: `{ "available": true | false }` — nessun dettaglio su dove esiste
- Se `available=false` → input bordo rosso + messaggio inline `studio.activation.v2.m4.errors.email_taken` + blocco submit
- Se transient error → check viene riprovato 1× a 1s; se persiste, l'utente può proseguire ma `email_check_status=deferred` sulla request (advisor verificherà manualmente)

**Phone prefix UX**:
- Mostra bandiera + `+39 IT`
- Auto-selezionato in base a `country_code` di M2 (overridable)

**Data captured**:
```json
{
  "first_name": "...", "last_name": "...", "role_title": "...",
  "email": "...", "phone_prefix": "+39", "phone_number": "...",
  "phone_e164": "+39333..."  // server-derived
}
```

---

### 3.5 Movimento 5 — Identità del tenant

**Goal**: nome dello studio + claim del subdomain futuro.

**Layout**: 2 field verticali.

**Field A · Nome Studio**
- `<input>` text, 2..120 chars
- Required
- Save: `studio_name`
- Side-effect: triggera auto-slug per il subdomain (vedi sotto), ma user può override

**Field B · Subdomain**
- `<SubdomainField>`: input + visual suffix `.moodfordesign.com` non editabile
- Pre-fill: derivato da `slugify(studio_name)`:
  - lowercase, ASCII, replace spaces with `-`, strip non-alphanumeric
  - max 30 chars
  - es. `Atelier Martinel` → `atelier-martinel`
- Live check: `onChange` (debounce 400ms) + `onBlur`
- Endpoint: `POST /api/studio/v2/check-subdomain` `{ "slug": "atelier-martinel" }`
- Stati visivi:
  - 🟢 **Disponibile** → "Disponibile" + check verde
  - 🔴 **Non disponibile** → "Già richiesto" o "Riservato" (motivazione neutra) + bordo rosso
  - ⏳ Validating → spinner
- Regole sync (client):
  - `^[a-z0-9-]{3,30}$`
  - no leading/trailing `-`
  - no `--` consecutivi
- Regole server:
  - non in `reserved_subdomains` (lista sotto)
  - non già usato in `tenants.subdomain`
  - non in `studio_requests_v2` con status `pending_review|approved` (soft-lock per 14 giorni per evitare race)
- **Reserved list** (`reserved_subdomains` table seed iniziale):
  ```
  admin, api, app, apps, blueprint, studio, mail, billing, support,
  advisor, advisors, command-center, root, www, mood, mood-core,
  founder, founders, designer, designers, client, clients, partner, partners,
  dev, staging, prod, production, test, demo, sandbox, console,
  cdn, assets, static, public, files, media, images, video, videos,
  auth, login, logout, signin, signup, register, password, account,
  settings, profile, dashboard, home, help, docs, status, blog,
  press, news, careers, jobs, contact, contacts, legal, privacy, terms,
  cookies, gdpr, security, abuse, postmaster, webmaster, hostmaster,
  noreply, no-reply, info, hello, ciao, ping, pong, healthz, readyz
  ```

**Data captured**:
```json
{ "studio_name": "Atelier Martinel", "subdomain_slug": "atelier-martinel" }
```

---

## 4. Step Finale — Submit & Success

### Submit
- CTA: `Invia richiesta` (loading state)
- Backend:
  1. Re-valida tutti i campi server-side (mai fidarsi del client)
  2. Re-check email uniqueness + subdomain availability (race-safe)
  3. Calcola `qualification_score` (TQS) — vedi `03_…` §1
  4. Crea `studio_requests_v2` (status `pending_review`)
  5. Trigger `Resend` email transactional → `no-reply@mail.moodfordesign.com` → notifica all'advisor team (config) + acknowledge email al founder
  6. Audit log `studio_request_events` (insert `submitted` event)

### Success page
- Layout pulito, single column, max-width 640px
- Eyebrow: `studio.activation.v2.success.eyebrow`
- Titolo: `studio.activation.v2.success.title` (es. "Richiesta ricevuta")
- Paragraph 1: ack + reference code (es. `MOOD-A3F7-9D21`)
- Paragraph 2: timing + next step ("Un Advisor MOOD analizzerà la candidatura e ti contatterà entro 2 giorni lavorativi")
- CTA primaria: `Torna alla Home` → `/`
- CTA secondaria: `Aggiungi al calendario` (opzionale, .ics download placeholder)
- NO link a /accedi (l'utente non ha ancora accesso)

### Email transactional (Resend)
- **Acknowledge founder**: `studio.email.v2.ack.subject/body` — bilingue (lingua autodetect da `Accept-Language` o lingua scelta nel funnel)
- **Notify advisor team**: payload tecnico con TQS + tutti i campi + link diretto a `/command-center/studio-requests/<id>`

---

## 5. Visual Direction

### Tono
- **Editorial professional, NOT theatrical**
- Sumi-e black background (`#0A0A0B`) come default
- Accent: `#00C9B3` (MOOD teal) solo per stati attivi, CTA, indicators
- Off-white per superfici alternative: `#F5F2EC`
- Tipografia:
  - Headlines: Playfair Display (serif) — tracking tight, weight 400/500
  - Body + UI: Montserrat — weight 400/500, letter-spacing 0.02em
  - Numbers/codes: JetBrains Mono o equivalente monospace

### Asset rules
| Permesso | Vietato |
|---|---|
| Texture astratte (marmo, legno, tessuto) | Foto di studi reali identificabili |
| Geometrie pulite (architectural lines) | Persone in posa |
| Macro materiali | Loghi di brand terzi |
| Composizioni grafiche editoriali | Stock photo "office at work" |
| Luce diagonale, ombre lunghe | Render 3D consumer-grade |

### Microinteractions
- **Field focus**: bottom border `#00C9B3`, fade-in 180ms
- **Card hover**: scale 1.015 + glow `0 0 0 1px rgba(0,201,179,0.4)`
- **Selected card**: scale 1.0 + bordo solido + checkmark fade-in
- **Async validation**: spinner inline a destra del field, 14px, MOOD teal
- **Page transitions tra movimenti**: fade + slide 12px, 280ms ease-out

### Accessibility
- WCAG 2.1 AA minimum:
  - Contrasto testo 4.5:1
  - Tutti i field hanno `<label>` esplicita
  - Tutti i card sono `<button role="radio">` o `<button role="checkbox">` con `aria-checked`
  - Focus visible: ring 2px MOOD teal con offset 2px
  - Keyboard navigation completa (Tab/Shift+Tab/Space/Enter/Esc)
  - `aria-live="polite"` sui messaggi di validazione async
- Reduced motion: rispetta `prefers-reduced-motion: reduce`

---

## 6. Elementi RIMOSSI rispetto al flow v1

Lista esplicita di cosa **NON** sarà più presente:
- ❌ Workflow temperament selector (Quieto/Composto/Bold/…)
- ❌ Ecosystem modules picker (Design Journey, Material Intelligence, Moodboard Experience)
- ❌ Atelier members repeater
- ❌ Foto editoriali di studi specifici (entrance image)
- ❌ "Apri un nuovo capitolo del tuo studio"
- ❌ Card "experiences" con copy poetico
- ❌ Locale picker dentro il funnel (la lingua è quella della homepage, scelta a monte)
- ❌ "Quanto sei pronto?" / scale di readiness

---

## 7. Mobile-first responsive

- Breakpoints: `xs <480 · sm 480-767 · md 768-1023 · lg ≥1024`
- M1 grid: 1 col xs · 2 col sm · 3 col md · 4 col lg
- M3 cards: full-width single column su tutti i breakpoint (per leggibilità copy)
- Sticky bottom bar mobile con `Indietro · Avanti` + progress dots ridotto

---

## 8. Telemetria & Abbandono

### Eventi tracciati (analytics interna, NO 3rd party tracker)
- `studio_v2.funnel.started` (M1 reach)
- `studio_v2.movement.completed` (per ogni movimento, con duration_ms)
- `studio_v2.movement.abandoned` (timeout >10min o close tab) — best-effort beacon
- `studio_v2.validation.failed` (campo + reason)
- `studio_v2.email_check.duplicate`
- `studio_v2.subdomain_check.unavailable`
- `studio_v2.submitted` (con qualification_score band: HOT/WARM/COLD)

### Drop-off recovery
- Token draft persiste 30 giorni
- Email opzionale (M4) sblocca recovery: se user fornisce email valida e poi abbandona, dopo 24h scatta email "Continua dove eri" con magic link al draft (riusa `access_magic_links` infra)
- Hard limit: max 5 draft per IP per 24h (anti-abuso)

---

## 9. Open Questions (non bloccanti, da chiudere prima dell'implementazione)

1. **Mapbox vs Geoapify** — confermare provider definitivo in playbook
2. **Reference code format** — confermare `MOOD-XXXX-XXXX` (esadec) o `MOOD-YYYY-NNNN` (anno + counter)
3. **Founder email come futuro login** — la stessa email diventerà automaticamente il login del founder all'approvazione? (Probabile sì, ma da confermare per UX legale)
4. **Lingue future** — quando si attiva una nuova lingua in `active_languages`, il funnel deve mostrarla anche senza traduzioni complete? Default proposto: NO, fallback a EN.
5. **Mobile-only abandon recovery** — accettabile inviare l'email di recovery solo se M4 completato, anche se M5 no?

---

## 10. Index documenti

| File | Contenuto |
|---|---|
| `00_OVERVIEW_AND_UX.md` | **Questo file** — overview + UX map |
| `01_COPY_AND_CMS.md` | Copy audit (vecchio→nuovo→keys) + IT/EN/FR/DE/ES + CMS mapping + tone of voice |
| `02_TECH_DESIGN.md` | Schema DB additivo + view email + API contracts + validation rules + Mapbox spec |
| `03_SCORE_E2E_MIGRATION.md` | Tenant Qualification Score™ + piano test E2E + migrazione v1→v2 |

— *fine documento 00* —
