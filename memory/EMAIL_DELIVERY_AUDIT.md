# EMAIL_DELIVERY_AUDIT.md
> Sprint: NEXT-STABILIZATION · F2 — EMAIL DELIVERY
> Data: 11 giugno 2026
> Stato: ⛔ BLOCCATO — Richiede azione manuale dell'utente

---

## STATO ATTUALE

**Nessuna email è stata consegnata con successo.**
Tutti i 20 tentativi registrati in `email_events` hanno status `failed`.

---

## CONFIGURAZIONE AMBIENTE

| Variabile | Valore | Status |
|---|---|---|
| `EMAIL_PROVIDER` | `resend` | ✅ Configurato |
| `RESEND_API_KEY` | `re_TM23Kuzx_...` (36 chars) | ❌ **CHIAVE NON VALIDA** |
| `EMAIL_FROM` | `MOOD for DESIGN™ <no-reply@mail.moodfordesign.com>` | ⚠️ Dominio non verificato |
| `EMAIL_REPLY_TO` | `support@moodfordesign.com` | Secondario |

---

## ROOT CAUSE — DUE PROBLEMI DISTINTI

### Problema 1 (BLOCCO PRIMARIO): API Key Resend non valida

```python
resend.Domains.list()
→ "API key is invalid"
```

La chiave `re_TM23Kuzx_EXqpGsgBfwxkYFe1YTUQD6pe` è stata **revocata o scaduta**.
Il provider Resend la rifiuta alla verifica base.

### Problema 2 (BLOCCO SECONDARIO): Dominio non verificato

Anche se la chiave fosse valida, il dominio mittente non è autorizzato:
```
Error: "The moodfordesign.com domain is not verified. 
Please, add and verify your domain at https://resend.com/domains"
```

Il mittente configurato è `no-reply@mail.moodfordesign.com`.
Il dominio `mail.moodfordesign.com` (o il root `moodfordesign.com`) deve essere verificato su Resend.

---

## PIPELINE TECNICA (funziona se API key e dominio sono ok)

```
email_service.send_template_email(to, template_key, context)
  ↓
_send_resend(from=EMAIL_FROM, to=email, subject=..., html=...)
  ↓
resend_sdk.Emails.send(params)
  ↓ 
[Resend API]
  ├── Se OK → {id: "re_xxxxx"}
  └── Se FAIL → eccezione catturata
  ↓
email_events INSERT (status: sent|failed, error=...)
```

La pipeline è corretta. Il blocco è esterno (Resend account).

---

## INDIRIZZI MITTENTE IN USO

| Indirizzo | Usato come | Configurato dove |
|---|---|---|
| `no-reply@mail.moodfordesign.com` | `FROM` — mittente visibile | `backend/.env → EMAIL_FROM` |
| `support@moodfordesign.com` | `REPLY_TO` — risposte | `backend/.env → EMAIL_REPLY_TO` |
| (nessuno) | `notifications@` | Non configurato |
| (nessuno) | `hello@` | Non configurato |

---

## STATISTICHE EMAIL EVENTS (DB)

| Template | Tentati | Consegnati | Falliti |
|---|---|---|---|
| `magic_link` | 1 | 0 | 1 |
| `space_ready` | 9 | 0 | 9 |
| `generic` | 10 | 0 | 10 |
| **Totale** | **20** | **0** | **20** |

**100% failure rate.** Nessuna email consegnata dall'attivazione del sistema.

---

## AZIONI RICHIESTE — IN ORDINE

### STEP 1 (utente): Verificare/rigenerare API Key Resend

1. Accedi a [resend.com/api-keys](https://resend.com/api-keys)
2. Verifica se la chiave `re_TM23Kuzx_...` è attiva
3. Se revocata/scaduta: crea una nuova API key con permessi `Full access`
4. Aggiorna `backend/.env`:
   ```
   RESEND_API_KEY=re_NUOVA_CHIAVE_QUI
   ```
5. Riavvia il backend: `sudo supervisorctl restart backend`

### STEP 2 (utente): Verificare il dominio `mail.moodfordesign.com` su Resend

1. Vai a [resend.com/domains](https://resend.com/domains)
2. Clicca "Add domain"
3. Inserisci: `mail.moodfordesign.com` (subdomain consigliato per email transazionali)
4. Resend mostrerà i record DNS da aggiungere:
   ```
   TXT  _resend.mail.moodfordesign.com  → "resend-verification=xxxxxxxx"
   MX   mail.moodfordesign.com          → feedback-smtp.eu-west-1.amazonses.com (o simile)
   TXT  mail.moodfordesign.com          → "v=spf1 include:amazonses.com ~all"
   CNAME resend._domainkey.mail         → [DKIM record]
   ```
5. Aggiungi i record nel tuo provider DNS (Cloudflare / Route53 / etc.)
6. Attendi propagazione DNS (max 24h, di solito < 30 min su Cloudflare)
7. Clicca "Verify" su Resend

### STEP 3 (sistema): Test di consegna

Dopo che STEP 1 e STEP 2 sono completati:

```bash
cd /app/backend && python3 -c "
import os, resend
resend.api_key = os.environ.get('RESEND_API_KEY')
r = resend.Emails.send({
    'from': 'MOOD for DESIGN™ <no-reply@mail.moodfordesign.com>',
    'to': ['admin@moodfordesign.com'],
    'subject': 'Test delivery MOOD',
    'html': '<p>Test OK</p>'
})
print(r)
"
```

---

## IMPATTO DELL'ATTUALE BLOCCO

| Funzionalità | Impatto |
|---|---|
| Magic link al cliente | ❌ Cliente non riceve accesso |
| `space_ready` (spazio pronto) | ❌ Cliente non viene notificato |
| Notifiche generic | ❌ Nessuna notifica |
| Recupero password | ⚠️ Non testato ma probabilmente fallisce |
| Inviti team | ⚠️ Non testato ma probabilmente fallisce |

**Il prodotto non è testabile con clienti reali finché le email non funzionano.**

---

## NOTE

- Il sistema di audit email_events è correttamente implementato
- Ogni tentativo è registrato con timestamp, template, destinatario, errore
- Non è necessario alcun workaround: la pipeline tecnica funziona
- Il blocco è esclusivamente nell'account Resend (credenziali + dominio)
- NON è stato creato alcun fallback/mock come da istruzione utente
