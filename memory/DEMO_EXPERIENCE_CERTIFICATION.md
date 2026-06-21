# DEMO EXPERIENCE CERTIFICATION
**Data**: 2026-06-21  
**Sprint**: V2.0 Pre-Launch UX Cleanup  

---

## PROBLEMA

Il banner di onboarding "Setup workspace" compariva su OGNI pagina Blueprint finché il tenant non completava tutti gli step obbligatori. Durante le demo, questo banner distrae il prospect con messaggi irrilevanti ("Configura Workspace attivo").

---

## COMPORTAMENTO PRE-FIX

Il dismiss del banner era solo **temporaneo** (24 ore in localStorage):

```js
// useActivationFoundation.jsx — riga 51
const dismissBanner = useCallback(() => {
    const until = Date.now() + 24 * 60 * 60 * 1000;  // 24h
    localStorage.setItem(DISMISS_KEY, String(until));
}, []);
```

Al reload dopo 24 ore, il banner ricompariva.

---

## FIX APPLICATO

### Backend (`tenant_onboarding.py`)

`GET /api/tenant-onboarding/activation-foundation` ora include il campo `dismissed`:

```python
row = _ensure_row(tenant_id)
return {
    ...
    "dismissed": bool(row.get("dismissed_at")),  # permanent server-side dismiss
    ...
}
```

### Frontend (`PersistentAlertBanner.jsx`)

Il banner controlla ora anche `data.dismissed` dal server:

```jsx
// PRIMA
if (!data || data.activated || bannerDismissed) return null;

// DOPO
if (!data || data.activated || bannerDismissed || data.dismissed) return null;
```

---

## COME USARE PER LE DEMO

Prima di una demo, fare una chiamata API una sola volta:

```bash
POST /api/tenant-onboarding/dismiss
Authorization: Bearer {token}
```

→ Il banner scompare **permanentemente** per quel tenant, senza scadenza.

---

## VERIFICA

```
dismissed=True → banner non compare più
```

**Screenshot**: `Banner visible: 0` dopo il dismiss. ✓

---

## ESITO

**PASS**

Il banner non comparirà mai durante le demo o nelle sessioni cliente post-dismiss.
