# IDENTITY & CLIENT PROVISIONING AUDIT — DOCUMENTO C: EMAIL VERIFICATION AUDIT
> Prodotto: 11 Jun 2026 · Audit statico completo

---

## 1. Risposta alle 7 Domande

### 1. Esiste email verification?

**Tecnicamente sì — ma è bypassata su tutti i percorsi operativi.**

Supabase Auth prevede un flow di email verification: dopo la registrazione invia una email di conferma con link one-time. L'utente clicca → `email_confirmed_at` viene settato → può autenticarsi.

---

### 2. Dove viene eseguita?

**DA NESSUNA PARTE** — tutti i percorsi usano `email_confirm: True` che bypassa il flow Supabase e marca l'email come confermata istantaneamente senza inviare email di verifica.

| Percorso | File | Chiamata | Verifica? |
|----------|------|----------|-----------|
| Signup designer | `auth.py:121` | `admin.create_user({ email_confirm: True })` | ❌ BYPASS |
| Member invite (SMTP OK) | `members.py:106` | `admin.invite(email)` | ⚠️ SUPABASE INVITE — vedi nota |
| Member invite (SMTP assente) | `members.py:131` | `admin.create_user({ email_confirm: True })` | ❌ BYPASS |
| Client provisioning (journey) | `client_provisioning.py:85` | `admin.create_user({ email_confirm: True })` | ❌ BYPASS |
| Onboarding wizard | `onboarding.py:81` | `admin.create_user({ email_confirm: True })` | ❌ BYPASS |

**Nota su `admin.invite`**: il flow `admin.invite` di Supabase usa il meccanismo "magic link + invite". Se l'utente NON clicca il link, il suo profilo resta in stato `invited` con `email_confirmed_at = NULL`. **Ma il backend non verifica** `email_confirmed_at` in nessun punto. L'utente può autenticarsi via magic link anche senza confermare il proprio indirizzo.

---

### 3. È obbligatoria?

**No.** Non esiste nessun gate nel backend che controlli `email_confirmed_at` prima di:
- Accettare il JWT
- Restituire il `users_profile`
- Permettere l'accesso al workspace

`middleware/auth.py → get_current_user()` legge solo `auth_user_id` dal JWT e lo mappa al `users_profile` — non controlla `email_confirmed_at`.

---

### 4. È bypassabile?

**È già bypassata by design.** Il commento in `auth.py` (riga 119-120) lo esplicita:

```python
# 1) Create auth.user via admin API (email confirmed for MVP)
admin.create_user({ "email_confirm": True, ... })
```

Il commento `# for MVP` indica una scelta consapevole e temporanea. Non è un bug.

---

### 5. È usata nel Begin Journey?

**No.** Il path `journey_initiate.py` crea il client con `email_confirm: True`. Il cliente riceve solo il magic link (che serve per autenticarsi, non per verificare l'email). Il magic link è un mezzo di accesso, **non un meccanismo di verifica email**.

---

### 6. È usata nel Portal?

**No.** Il portal (`client_portal.py`) risolve l'accesso via:
- `projects.client_user_id` (strutturalmente rotto, P0-B)
- `accounts.email = users_profile.email` (fallback welcome-summary)

Nessuno dei due meccanismi verifica `email_confirmed_at`.

---

### 7. È usata nella creazione Client Profile?

**No.** `provision_client_after_journey()` usa `admin.create_user({ email_confirm: True })`. L'email del cliente è considerata trusted perché è stata inserita nel form pubblico Begin Journey. Nessun double opt-in.

---

## 2. Rischio

| Rischio | Dettaglio | Severità |
|---------|-----------|----------|
| Email typo silenzioso | Se il cliente digita male la propria email nel form Begin Journey, l'account viene creato con l'email errata. Il magic link viene inviato alla email errata. Il cliente non riceve mai il link. | ALTO |
| No double opt-in | Il cliente non conferma il proprio indirizzo. Il sistema assume buona fede. | MEDIO |
| Account enumeration impossibile ma account esistente bypassabile | `/api/auth/identify` protegge contro l'enumerazione, ma il fatto che `email_confirm=True` sia sempre attivo significa che qualsiasi email valida può essere registrata senza verifica. | BASSO |

---

## 3. Confronto con Supabase Default

| Comportamento | MOOD | Supabase Default |
|---------------|------|-----------------|
| Email verification | Bypassata (`email_confirm: True`) | Richiesta (email con link) |
| Tempo conferma | Immediato | ~24 ore (link TTL) |
| Login senza conferma | Sempre possibile | Bloccato fino a conferma |
| Scadenza link magic | N/A (non usato per confirm) | 1 ora |

---

## 4. Raccomandazione

Per MVP la scelta di bypass è corretta e intenzionale. Per produzione con clienti reali:
- **P1**: Aggiungere email validation frontend (regex + domain check) per ridurre typo prima della creazione account
- **P2**: Considerare double opt-in per il flow Begin Journey (l'unico flusso pubblico non autenticato)
- **P2**: Loggare in `email_events` i casi di magic link non cliccato entro X ore (indicatore di typo email)

---

*Audit C — IDENTITY & CLIENT PROVISIONING AUDIT*
