# IDENTITY & CLIENT PROVISIONING AUDIT — DOCUMENTO E: UTENTI ANOMALI
> Prodotto: 11 Jun 2026 · Dati reali DB + auth.users Supabase

---

## 1. Analisi `ogrisekadvisor@gmail.com`

### Dati DB Reali

| Campo | Valore |
|-------|--------|
| Tabella | `users_profile` |
| `id` (profile) | `7e43614e-d0af-477d-98bc-8eeda1f61736` |
| `auth_user_id` | `691d73dc-bb4d-4793-93c1-f8edf38fdbf2` |
| `email` | `ogrisekadvisor@gmail.com` |
| `role` | `project_manager` |
| `status` | **`invited`** (mai attivato — nessun primo login) |
| `first_name` | `Stef` |
| `last_name` | `Ogri` |
| `tenant_id` | `848354b9-…` (MOOD for DESIGN — stesso del super_admin) |
| `created_at` | `2026-05-31` |
| `last_login_at` | NULL |
| `accepted_at` | NULL |
| `phone` | NULL |
| `preferred_locale_code` | NULL |

### Dati auth.users (Supabase)

| Campo | Valore |
|-------|--------|
| `auth.users.id` | `691d73dc-…` |
| `email_confirmed_at` | **CONFERMATA** (`confirmed=YES`) |
| `last_sign_in_at` | **`never`** — non ha mai effettuato l'accesso |
| `user_metadata.email_verified` | `true` |
| `user_metadata.first_name` | `Stef` |
| `user_metadata.last_name` | `Ogri` |
| `user_metadata.invited_role` | `project_manager` |
| `app_metadata.provider` | `email` |

---

### Percorso che lo ha creato

**Percorso P2 — `/api/members/invite`** (ITER177 · Team Foundation).

Sequenza ricostruita:
```
POST /api/members/invite
  body: { email: "ogrisekadvisor@gmail.com", first_name: "Stef", last_name: "Ogri", role: "project_manager" }
  invitato da: admin@moodfordesign.com (super_admin, profile caee7b92)
  
  1. _supabase_invite_user() → admin.invite()
     → auth.users CREATO con email_confirmed=true (dalla `/admin/invite` endpoint Supabase)
     → invite email INVIATA (o tentata) via Supabase SMTP
  2. INSERT users_profile(role='project_manager', status='invited', invited_by=caee7b92)
  3. INSERT tenant_memberships(status='invited')
  4. UPSERT member_invites (audit log)
```

**Conferma**: `auth.users.email_confirmed_at = YES` + `last_sign_in_at = never` indica che Supabase ha confermato l'email al momento dell'invite (comportamento standard di `admin/invite`) ma l'utente non ha mai cliccato il link e non si è mai autenticato.

---

### Relazioni

| Tabella | Record collegati |
|---------|-----------------|
| `auth.users` | `691d73dc-…` — presente, email confermata da Supabase |
| `users_profile` | `7e43614e-…` — status `invited`, **mai attivato** |
| `tenant_memberships` | Presumibilmente 1 riga `status='invited'` (non verificata dopo purge) |
| `member_invites` | Presumibilmente 1 riga (audit log invito) |
| `accounts` | Nessun account associato |
| `leads` | Nessun lead associato |
| `design_journeys` | Nessun journey associato |
| `projects` | Nessun progetto associato |

---

### Classificazione

| Aspetto | Valutazione |
|---------|------------|
| È un utente legittimo? | **Sì** — stesso cognome dell'admin (`Ogrisek` / `Ogri`), email `@gmail.com` diversa da quella admin. È un secondo account staff dell'owner della piattaforma. |
| È un utente di test? | **No** — ruolo `project_manager` assegnato consapevolmente tramite invite flow reale |
| Ha mai usato il sistema? | **No** — `last_sign_in_at = never`, `status = invited` |
| Deve essere mantenuto? | **Decisione dello studio** — non è dati demo. È un invito reale, però mai accettato. |
| Rischio di lasciarlo? | Basso — non ha accesso a dati (non ha mai fatto login). Status `invited` blocca operatività finché non attivato. |

---

### Azione Raccomandata

Due opzioni:

| Opzione | Azione | Quando |
|---------|--------|--------|
| **A — Mantenere** | Lasciare `status='invited'`. Se lo studio vuole aggiungerlo al team, usare `/members/{id}/resend-invite` per rinviare il magic link. | Se si prevede di usare questo account |
| **B — Rimuovere** | DELETE `users_profile`, DELETE `tenant_memberships`, DELETE `member_invites`, DELETE `auth.users` via Admin API. | Se è un invito scaduto non più necessario |

---

## 2. Altri Utenti Anomali Trovati

**Nessuno.** Dopo la purge, il tenant `848354b9` ha solo:

| Email | Ruolo | Status | Anomalia |
|-------|-------|--------|---------|
| `admin@moodfordesign.com` | `super_admin` | `active` | ✅ Nessuna |
| `ogrisekadvisor@gmail.com` | `project_manager` | `invited` | ⚠️ Invito mai accettato |

---

## 3. Tenant Test/Simulazione

Nel DB esistono **47 tenant attivi** con nomi come `Studio Simulazione E2E`, `Martinel Interior Design` (x32), `Studio Completion`, `Studio Hardening`. Questi sono tenant generati automaticamente dagli agent di test nei job precedenti.

| Tipologia | Conteggio |
|-----------|-----------|
| Tenant nominati `Martinel Interior Design` | **33** |
| Tenant nominati `Studio Simulazione E2E` | **4** |
| Tenant `Studio Completion/Hardening` | **3** |
| Tenant archiviated | **6** |
| Tenant **MOOD for DESIGN** (produzione) | **1** |

**Questi tenant non sono stati cancellati** dalla purge perché il comando di pulizia era scoped su `tenant_id = 848354b9`. Gli altri tenant potrebbero avere dati operativi propri (ogni signup crea un tenant separato by design).

**Azione suggerita**: revisione separata dei tenant simulazione per decidere se eliminare o lasciare. Non urgente — non impattano il funzionamento del tenant MOOD for DESIGN.

---

*Audit E — IDENTITY & CLIENT PROVISIONING AUDIT*
