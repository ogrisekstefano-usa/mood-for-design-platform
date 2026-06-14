# AUTH STATUS REPORT — MOOD for DESIGN™

> **Data:** 2026-06-14  
> **Sprint:** POST-STABILIZATION CLEANUP & PRODUCTION READINESS

---

## STATO AUTH.USERS POST-CLEANUP

### Utenti conservati (2)

| Email | auth.user ID | Ruolo | Note |
|-------|-------------|-------|------|
| `admin@moodfordesign.com` | `18712745-...` | super_admin | Accesso piattaforma admin ✅ |
| `ogrisekadvisor@gmail.com` | `8ce24bae-...` | tenant_admin | ⚠️ Password NON valida (vedi issue) |

### Utenti eliminati (5)

| Email | Motivo |
|-------|--------|
| `e2e.certify.1781405667@moodtest.io` | Certificazione tecnica |
| `lc.certify.1781408030@moodtest.io` | Certificazione tecnica |
| `lc2.certify.1781408118@moodtest.io` | Certificazione tecnica |
| `p05.final.1781408474@moodtest.io` | Certificazione tecnica |
| `readiness.check.1781409131@moodtest.io` | Readiness check |

---

## ISSUE APERTA: ogrisekadvisor@gmail.com

| Campo | Valore |
|-------|--------|
| Email | ogrisekadvisor@gmail.com |
| Login test | ❌ FAIL — "Invalid login credentials" |
| Password in test_credentials.md | `Blueprint2024!` (NON valida) |
| Classificazione | P1 — utente non può accedere al sistema |

### Azione richiesta all'utente

Per ripristinare l'accesso:
1. Accedere a [https://supabase.com](https://supabase.com) → Progetto → **Authentication** → **Users**
2. Trovare `ogrisekadvisor@gmail.com`
3. Cliccare su **Reset Password** (o **Send Magic Link**)
4. Oppure: reimpostare la password manualmente tramite Supabase Dashboard

---

## POLICY DI SICUREZZA

- ✅ Nessun account di test residuo in auth.users
- ✅ Nessuna credenziale demo accessibile in produzione
- ⚠️ JWT logout è stateless (Supabase) — i token emessi rimangono validi per tutta la loro durata (~1h) anche dopo logout. Comportamento atteso e documentato.

---

## VERDETTO

🟡 **AUTH QUASI-PRONTO** — Admin OK, advisor richiede reset password
