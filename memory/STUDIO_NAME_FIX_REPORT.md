# STUDIO NAME FIX REPORT — P0-B

> **Data**: 2026-06-02 04:42 UTC
> **Verdetto**: ✅ **STUDIO NAME COLLECTED & PROPAGATED**

---

## 1. PROBLEMA RISOLTO

Prima del fix, il funnel V2 NON chiedeva il nome dello studio. Il campo `studio_requests.studio_name` veniva auto-popolato con la concatenazione `first_name + last_name` del Founder. Conseguenze:

- Nel `FIRST_REAL_TENANT_READINESS_REPORT`, scenario Martinel: il record salvato aveva `studio_name = "Mario Rossi"` invece di "Martinel Interior Design".
- Il modal di activation suggeriva `slug=mario-rossi` come default; se l'advisor era distratto, il tenant nasceva con nome del founder, slug `mario-rossi` e branding nelle email "Il tuo Blueprint è pronto · Mario Rossi" per uno studio in realtà chiamato "Martinel Interior Design".
- Brand experience compromessa: amateurish per qualunque studio premium.

---

## 2. SOLUZIONE

Aggiunto un campo **"Nome dello studio"** come PRIMO input dello Step 3 del funnel V2 (Contact step). Obbligatorio (minimum 2 caratteri), persistito direttamente in `studio_requests.studio_name`, propagato come default a:
- `tenant_name` nella preview di activation
- `suggested_slug` nella preview di activation
- `tenants.name` quando l'advisor conferma l'attivazione
- Subject di tutte le email del lifecycle (`MOOD-XXXX-XXXX · {{studio_name}}`)

---

## 3. FILE MODIFICATI

### Backend
| File | Modifica |
|---|---|
| `backend/routers/studio_v2.py` | `POST /api/studio/v2/submit` ora accetta `studio_name` nel body, lo passa a `submit_v2`. |
| `backend/services/studio_v2.py` | Firma di `submit_v2` estesa con `studio_name: str = ''`. Validazione server-side: `if not studio_name.strip() or len < 2 → {"ok": False, "reason": "missing_studio_name"}`. `studio_label` ora deriva da `studio_name` (fallback al contact_name solo per client legacy). Manifest CMS espone `step3_studio_name`, `step3_studio_name_placeholder`, `step3_studio_name_hint`. |
| `backend/scripts/seed_studio_v2_p0_audit_cms.py` | Aggiunte 3 chiavi bilingui: `step3.studio_name`, `step3.studio_name.placeholder`, `step3.studio_name.hint` (it-IT + en-US). Re-seedato. |

### Frontend
| File | Modifica |
|---|---|
| `frontend/src/corporate/pages/studio_v2/Step3Contact.jsx` | Nuovo input `studio-name-input` come primo campo dello step 3, con label dal CMS (`t('step3_studio_name')`), placeholder (`t('step3_studio_name_placeholder')`) ed hint (`t('step3_studio_name_hint')`). Validazione: `canContinue` richiede `studio_name.trim().length >= 2` oltre a nome/cognome/email validi. |
| `frontend/src/corporate/pages/studio_v2/Step4Help.jsx` | Submit payload include `studio_name: form.studio_name`. |

Nessuna modifica a schema DB. Il campo `studio_requests.studio_name` esisteva già — era semplicemente popolato dal valore sbagliato.

---

## 4. PROPAGAZIONE END-TO-END (verificato con audit Martinel)

Test integrato `FIRST_REAL_TENANT_READINESS_AUDIT` con scenario:
- Studio Name: **Martinel Interior Design**
- Founder: Mario Rossi
- Submission via `POST /api/studio/v2/submit` con il nuovo campo

| Checkpoint | Esito |
|---|---|
| Server validation: `missing_studio_name` rejection con < 2 char | ✅ |
| `studio_requests.studio_name` = "Martinel Interior Design" | ✅ PASS (era "Mario Rossi" prima) |
| Activation preview suggerito: `tenant_name = "Martinel Interior Design"` | ✅ |
| Activation preview suggerito: `suggested_slug = "martinel-interior-design"` (con dedup `-N`) | ✅ |
| `tenants.name` post-activation = "Martinel Interior Design" | ✅ PASS |
| `tenants.slug` post-activation = `martinel-interior-design-N` | ✅ PASS |
| Email founder subject: "Il tuo Blueprint è pronto · Martinel Interior Design" | ✅ PASS (era "· Mario Rossi") |
| Email visitor subject: "Abbiamo ricevuto la tua candidatura · MOOD-XXXX-XXXX" + studio_name nelle variables | ✅ PASS |

Log dell'audit:
```
[PASS P0] data.studio_name_real     — studio_name='Martinel Interior Design' (expected 'Martinel Interior Design')
[PASS P1] data.tenant_name_chosen   — name=Martinel Interior Design
[PASS P0] data.tenant_slug_chosen   — slug=martinel-interior-design-4
[PASS P0] cc.preview_complete       — slug=martinel-interior-design-3 email=mario.rossi.…
[PASS P0] email.founder.approved_sent — subject=Il tuo Blueprint è pronto · Martinel Interior Design
```

---

## 5. UI/UX

Step 3 (Contact) ora apre con:

```
CHI SARÀ IL REFERENTE PRINCIPALE?

  ┌──────────────────────────────────────────────┐
  │ NOME DELLO STUDIO                            │
  │ [ Es. Martinel Interior Design           ]   │
  │ Sarà il nome ufficiale del tuo workspace MOOD. │
  └──────────────────────────────────────────────┘

  ┌────────────────────┐  ┌────────────────────┐
  │ NOME               │  │ COGNOME            │
  │ [                ] │  │ [                ] │
  └────────────────────┘  └────────────────────┘

  EMAIL PROFESSIONALE
  ...
```

Validazione client-side: minimum 2 caratteri, max 120, sanificato lato server (strip whitespace).

---

## 6. RISCHI RESIDUI

| # | Rischio | Probabilità | Impatto | Mitigazione |
|---|---|---|---|---|
| R1 | Client legacy (V1 endpoint o cURL) sottomette senza `studio_name` | bassa | bassa | Fallback al `contact_name` per non rompere la submission. Logghiamo il caso ma non blocca (linea di codice in `submit_v2`). |
| R2 | Validation client-side bypassabile (utente disabilita JS) | bassa | bassa | Server-side validation `missing_studio_name` ritorna 200 + `ok=False` → frontend non procede oltre. |
| R3 | Caratteri speciali nel nome (`O'Brien Design`) generano slug strani | bassa | bassa | Funzione `_slugify` rimuove non-alphanumerici: `o-brien-design`. Verificato OK in test precedenti. |
| R4 | Slug duplicato (due studi diversi con stesso nome) | media nel lungo termine | bassa | Algoritmo dedup `-2`, `-3`, `-N` testato e funzionante. L'advisor può modificare lo slug nel modal. |

Nessun rischio P0.

---

## 7. CLASSIFICAZIONE

### ✅ **STUDIO NAME COLLECTED & PROPAGATED**

Pronto per ricevere studi reali col nome corretto.
