# RESEND READINESS REPORT — MOOD for DESIGN™

> **Data:** 2026-06-14  
> **Sprint:** POST-STABILIZATION CLEANUP & PRODUCTION READINESS

---

## CONFIGURAZIONE ATTUALE

| Parametro | Valore | Stato |
|-----------|--------|-------|
| `RESEND_API_KEY` | `re_TM23Kuzx_...` (36 chars) | ✅ PRESENTE |
| Formato API key | `re_...` | ✅ VALIDO |
| `EMAIL_FROM` | `MOOD for DESIGN™ <no-reply@mail.moodfordesign.com>` | ✅ CORRETTO |
| Dominio mittente | `mail.moodfordesign.com` | ✅ VERIFICATO SU RESEND |
| Resend domain status | `verified` | ✅ VERIFIED |
| Resend region | `eu-west-1` | ✅ OK |
| Resend sending capability | `enabled` | ✅ ABILITATO |

---

## TEST INVIO EMAIL

Test eseguito con:
- FROM: `MOOD for DESIGN™ <no-reply@mail.moodfordesign.com>`
- TO: `delivered@resend.dev` (indirizzo di test Resend)
- Risultato: **EMAIL CONSEGNATA** ✅

---

## ROOT CAUSE DEGLI ERRORI PRECEDENTI

Gli errori `ResendError: The moodfordesign.com domain is not verified` nei log erano causati dalla tabella `email_mailboxes` che contiene mailbox con indirizzi `@moodfordesign.com` (dominio radice, NON verificato):

| mailbox ID | from_email | is_active | Stato |
|-----------|-----------|-----------|-------|
| `01f5c8ea` | `me@moodfordesign.com` | TRUE | ❌ Dominio radice non verificato |
| `eb386065` | `t9bad@moodfordesign.com` | FALSE | ❌ Dominio radice (inattiva) |
| `1d7c99ea` | `t9host@moodfordesign.com` | FALSE | ❌ Dominio radice (inattiva) |

Il dominio radice `moodfordesign.com` NON è registrato su Resend. Solo il subdomain `mail.moodfordesign.com` è verificato.

---

## AZIONI RICHIESTE (CLASSIFICATE)

### P1 — Azione tecnica (richiede accesso codebase)

Aggiornare la mailbox attiva `me@moodfordesign.com` a `no-reply@mail.moodfordesign.com`:

```sql
UPDATE email_mailboxes 
SET from_email = 'no-reply@mail.moodfordesign.com',
    updated_at = NOW()
WHERE id = '01f5c8ea-63f3-4640-8265-e0b85650621e';
```

**Oppure:** eseguire lo script già presente:
```bash
cd /app/backend
python3 scripts/swap_sender_to_production.py
```

Questo script aggiorna anche `tenant_email_settings.sender_email` in modo idempotente.

### P2 — Opzionale: verifica DNS aggiuntivi (azione utente)

Il dominio `mail.moodfordesign.com` è già verificato su Resend. I DNS records sono stati correttamente configurati. Nessuna azione DNS richiesta.

### P2 — Opzionale: aggiungere dominio radice su Resend (azione utente)

Per usare indirizzi `@moodfordesign.com` (senza subdomain `mail.`):
1. Accedere a [https://resend.com/domains](https://resend.com/domains)
2. Clic **Add Domain** → inserire `moodfordesign.com`
3. Aggiungere i DNS records indicati da Resend
4. Attendere verifica (5–30 minuti)

---

## RIEPILOGO PASS/FAIL

| Check | Risultato |
|-------|-----------|
| API key presente e valida | ✅ PASS |
| Dominio `mail.moodfordesign.com` verificato | ✅ PASS |
| Email test inviata con successo | ✅ PASS |
| `EMAIL_FROM` configurato con subdomain corretto | ✅ PASS |
| `email_mailboxes` mailbox attiva usa dominio verificato | ❌ FAIL (usa `@moodfordesign.com`) |
| Dominio radice `moodfordesign.com` verificato | ❌ FAIL (non registrato su Resend) |

---

## VERDETTO

🟡 **RESEND 80% PRONTO** — Infrastruttura verificata, un aggiornamento di configurazione richiesto

La consegna email funziona quando il mittente usa `@mail.moodfordesign.com`. La mailbox attiva deve essere aggiornata per eliminare gli errori nel log.
