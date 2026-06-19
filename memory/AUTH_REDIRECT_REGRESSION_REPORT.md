# AUTH REDIRECT REGRESSION REPORT
*PARTNER AUTH FIX SPRINT — Giugno 2026*

---

## Obiettivo

Identificare **tutti i punti** nel frontend che possono forzare un redirect verso `/auth/login`, e classificarli come:
- `INTENZIONALE` — comportamento corretto, deve restare
- `ANOMALIA` — potenziale bug su route pubbliche
- `CORRETTO` — già fixato in questo sprint

---

## SCANSIONE ESEGUITA

```
grep -rn "navigate('/auth/login|navigate(\"/auth/login|window\.location.*login|href.*auth/login|Navigate to.*auth/login"
  frontend/src/ --include="*.jsx" --include="*.js"
```

---

## RISULTATI

### 1. `frontend/src/lib/api.js:141`
```js
window.location.href = '/auth/login';
```
**Tipo:** Interceptor axios globale 401  
**Classificazione:** ✅ CORRETTO (fixato in questo sprint)  
**Dettaglio:** Era l'unico interceptor globale. Mancavano `/partner-application`, `/professionals/intake`, `/story/` nella lista `isPublicSurface`. Fix applicato.

---

### 2. `frontend/src/App.js:262, 282, 298, 309, 326, 337`
```jsx
// ProtectedRoute
return user ? children : <Navigate to="/auth/login" replace />;
// ClientRoute
if (!user) return <Navigate to="/auth/login" replace />;
// StudioRoute
if (!user) return <Navigate to="/auth/login" replace />;
// SuperAdminRoute
if (!user) return <Navigate to="/auth/login" replace />;
// RootSuperAdminRoute
if (!user) return <Navigate to="/auth/login" replace />;
// StudioAdminRoute
if (!user) return <Navigate to="/auth/login" replace />;
```
**Tipo:** Guard componenti per route protette  
**Classificazione:** ✅ INTENZIONALE  
**Dettaglio:** Tutti questi guard si trovano DENTRO route protette (`/dashboard`, `/client`, `/admin`, ecc.). Non vengono mai montati su route pubbliche.

---

### 3. `frontend/src/pages/site/ProfessionalIntakePage.jsx:281`
```js
navigate('/auth/login');
```
**Tipo:** Navigate programmatico su submit del wizard  
**Classificazione:** ✅ INTENZIONALE  
**Dettaglio:** L'intake wizard per professionisti salva il payload in `localStorage` e poi reindirizza l'utente alla login per completare la registrazione. Questo è il flusso previsto (professionista compila → poi si registra → il payload viene recuperato dal localStorage post-login). NON è un bug.  
**Post-fix:** Ora che `/professionals/intake` è in whitelist, le chiamate API al mount (contesti globali) non causano più redirect prima che l'utente interagisca con il form.

---

### 4. `frontend/src/pages/admin/AdminShell.jsx:60`
```js
navigate('/auth/login');
```
**Tipo:** Guard su shell admin  
**Classificazione:** ✅ INTENZIONALE  
**Dettaglio:** Si trova dentro `RootSuperAdminRoute` — mai raggiunto da utenti anonimi.

---

### 5. `frontend/src/presets/client-profile/atelier/AtelierUserMenu.jsx:106`
```js
navigate('/auth/login', { replace: true });
```
**Tipo:** Logout utente  
**Classificazione:** ✅ INTENZIONALE  
**Dettaglio:** Menu utente del client portal — si attiva solo su click del pulsante "Esci".

---

### 6. `frontend/src/components/common/UserMenu.jsx:58`
```js
navigate('/auth/login');
```
**Tipo:** Logout utente  
**Classificazione:** ✅ INTENZIONALE  
**Dettaglio:** Menu utente del dashboard OS — si attiva solo su logout esplicito.

---

### 7. `frontend/src/components/client/ClientUserMenu.jsx:140`
```js
navigate('/auth/login');
```
**Tipo:** Logout utente  
**Classificazione:** ✅ INTENZIONALE  
**Dettaglio:** Menu utente client — si attiva solo su logout esplicito.

---

### 8. `frontend/src/components/layout/AdminLayout.jsx:98`
```jsx
onClick={async () => { await signOut(); navigate('/auth/login'); }}
```
**Tipo:** Logout da layout admin  
**Classificazione:** ✅ INTENZIONALE  
**Dettaglio:** Pulsante logout in AdminLayout.

---

### 9. `frontend/src/site/content/professionals.js:58`
```js
href: '/auth/login'
```
**Tipo:** Href in contenuto statico  
**Classificazione:** ✅ INTENZIONALE  
**Dettaglio:** È l'href del CTA "Accedi" nella sezione "Accedi al Blueprint Workspace" della pagina `/professionals`. È corretto — è per professionisti GIÀ registrati che vogliono accedere al workspace.

---

### 10. `frontend/src/site/content/navigation.js:34, 44`
```js
href: '/auth/login'
```
**Tipo:** Link navigazione  
**Classificazione:** ✅ INTENZIONALE  
**Dettaglio:** Link "Area Riservata" e "Accedi" nella navigazione del sito. Porta l'utente alla login page per accedere all'area autenticata.

---

## INTERCEPTOR AGGIUNTIVI

**Risultato scansione:** Nessun interceptor axios aggiuntivo trovato al di fuori di `api.js`.

```
grep -rn "interceptors\." frontend/src/ --include="*.js" --include="*.jsx"
# → Risultato: ZERO occorrenze al di fuori di api.js
```

---

## ALTRI MECCANISMI DI AUTH CHECK

### `AuthContext`
- Chiama `/api/profile/me` al mount per verificare la sessione
- Se la risposta è 401 (nessun utente), imposta `user = null`
- **Non esegue nessun redirect programmatico** — lascia che siano i guard componenti a farlo

### `BlueprintContext`
- Non esegue redirect

### `TenantThemeContext`
- Chiama `/api/branding` al mount
- Se 401: imposta `theme = null`, `branding = null` in un `try/catch`
- **Non esegue redirect** — gestisce il 401 silenziosamente

### `TenantConfigurationContext`
- Chiama `/api/tenant/configuration/public/:slug` — endpoint PUBBLICO
- Non causa mai 401

---

## CONCLUSIONE

**Un solo meccanismo causava redirect non-intenzionali su route pubbliche:**
l'interceptor axios in `api.js` con whitelist incompleta.

**Stato post-fix:**
- Nessun altro intercettore nascosto trovato
- Nessuna context/hook che esegue redirect globali non intenzionali
- Le pagine pubbliche mancanti sono state aggiunte alla whitelist

---

*Documento creato: Giugno 2026 — PARTNER AUTH FIX SPRINT*
