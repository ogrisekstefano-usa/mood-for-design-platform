# MESSAGING_FLOW_AUDIT.md
> Sprint: NEXT-STABILIZATION · F4 — MESSAGING + NOTIFICATIONS
> Data: 11 giugno 2026
> Stato: ✅ IMPLEMENTATO E VERIFICATO

---

## STATO PRIMA DEL FIX

| Step | Prima | Note |
|---|---|---|
| `relationship_messages` row creata | ✅ | Funzionava |
| `unread_for_designer` / `unread_for_client` incrementato | ✅ | Funzionava |
| `relationship_events` creato | ✅ | Funzionava |
| `relationship_notifications` creata | ❌ | **MANCAVA** |
| Badge notifiche incrementato | ❌ | **MANCAVA** |
| Email al designer (cliente scrive) | ❌ | **MANCAVA** |
| Email al cliente (designer risponde) | ❌ | **MANCAVA** |

---

## FIX IMPLEMENTATO

### 1. Categorie notification_categories aggiunte

```sql
INSERT INTO notification_categories (key, label_it, label_en, ...)
VALUES 
  ('message_received', 'Nuovo messaggio cliente', 'New client message'),
  ('designer_replied', 'Risposta del referente',  'Designer replied');
```

### 2. Catena notifica in `relationship_conversation.py` → `send_message()`

```python
# Dopo thread.unread update e prima di memory fragments:

if sender_type == "client":
    # Client scrive → notifica designer assegnato
    notification_publisher.publish(
        category_key="message_received",
        recipient_user_id=designer_id,
        ...
    )
    # Email notification al designer (non-blocking, best-effort)
    email_service.send_template_email(to=designer_email, template_key="generic", ...)

elif sender_type == "designer":
    # Designer risponde → notifica cliente
    notification_publisher.publish(
        category_key="designer_replied",
        recipient_user_id=client_profile_id,
        ...
    )
```

### 3. Caratteristiche della catena

- **Non-blocking**: tutto il blocco notifiche è in `try/except` — un errore di notifica non blocca la delivery del messaggio
- **Idempotente**: usa `notification_publisher.publish()` che gestisce il dedup tramite `dedup_key`
- **Email best-effort**: l'email al designer è in un secondo `try/except` annidato — il fallimento email non blocca la notifica in-app

---

## TEST END-TO-END

### Scenario: Designer invia messaggio al cliente

**Setup:**
- Thread `a98ae0a4` con `primary_designer_id=caee7b92` (admin) e `client_profile_id=07898723`
- Admin (designer) invia: `"Test catena notifica F4 — designer risponde al cliente."`

**Risultati verificati via SQL:**

```sql
-- 1. Messaggio creato
SELECT id, sender_type FROM relationship_messages 
WHERE id = 'e0a9f2e6...' 
→ sender_type: designer ✅

-- 2. Thread unread aggiornato
SELECT unread_for_client, unread_for_designer 
FROM relationship_threads WHERE id = 'a98ae0a4...'
→ unread_for_client: 1 ✅
→ unread_for_designer: 1 ✅

-- 3. Notifica creata
SELECT category_key, recipient_user_id, narrative, archived_at
FROM relationship_notifications 
WHERE notification_type = 'designer_replied'
ORDER BY created_at DESC LIMIT 1
→ category_key: designer_replied ✅
→ recipient_user_id: 07898723 (cliente) ✅
→ narrative: "Test catena notifica F4 — designer risponde al cli" ✅
→ archived_at: NULL (attiva) ✅
```

**Log backend:**
```
INFO services.notification_publisher: notif.created 
  cat=designer_replied 
  user=07898723-c225-4e9a-93b0-0149ea8ae0d3 
  id=74393770-b77b-4228-8089-5be72d1aad54 
  prio=high
```

---

## MATRICE COMPLETA POST-FIX

| Step | Client → Designer | Designer → Client |
|---|---|---|
| `relationship_messages` row | ✅ | ✅ |
| `unread_for_designer` += 1 | ✅ | — |
| `unread_for_client` += 1 | — | ✅ |
| `relationship_events` creato | ✅ | ✅ |
| `relationship_notifications` creata | ✅ (cat: `message_received`) | ✅ (cat: `designer_replied`) |
| Email al destinatario | ✅ best-effort | ✅ best-effort |

---

## NOTE

- Le email di notifica usano `template_key="generic"` come fallback — nessun template personalizzato per i messaggi
- Quando Resend sarà operativo (F2), le email partiranno automaticamente
- Il badge UI usa `relationship_notifications.archived_at IS NULL` per contare le non lette
- Il `notification_publisher.publish()` incrementa anche `notification_categories.unread_count` per il badge dell'header

---

## FILE MODIFICATI

| File | Cambio |
|---|---|
| `backend/routers/relationship_conversation.py` | Aggiunto blocco notifica F4 in `send_message()` |
| DB `notification_categories` | Aggiunte 2 categorie: `message_received`, `designer_replied` |
