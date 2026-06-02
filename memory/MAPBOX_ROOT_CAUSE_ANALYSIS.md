# MAPBOX ROOT CAUSE ANALYSIS

> **Data**: 2026-06-02 00:12 UTC
> **Investigatore**: Studio V2 agent
> **Classificazione finale**: 🟡 **MAPBOX_CONFIGURATION_ERROR** — URL restrictions del token bloccano backend server-side e preview environment

---

## 0. EXECUTIVE SUMMARY

Il problema **NON è uno scope mancante** (come dichiarato in iterazioni precedenti). Il token Mapbox attualmente in uso:
- è **valido**;
- ha **tutti gli scope geocoding necessari** abilitati;
- ritorna **HTTP 200 con payload completo** quando chiamato con `Referer: https://www.moodfordesign.com/`;
- ritorna **HTTP 403 Forbidden** quando chiamato dal backend Python (nessun `Referer` inviato) o dal preview environment (`Referer: https://*.preview.emergentagent.com`).

**Causa precisa**: il token public `slabreality` ha **URL Restrictions ATTIVE** che includono SOLO `moodfordesign.com` / `www.moodfordesign.com` e NON includono:
- gli IP outbound del backend (chiamate server-side senza Referer);
- il dominio della preview Emergent (`*.preview.emergentagent.com`).

**Conferma empirica del fix**: tre città testate (Padova, Chicago, London) restituiscono dati completi quando si passa l'header Referer corretto.

**Implicazione importante**: il "nuovo token MOOD" che l'utente dichiara aver creato **NON è stato configurato** in `/app/backend/.env`. Il file contiene tuttora il **vecchio token `slabreality`** (94 char, payload `{"u":"slabreality","a":"cmpc155di02wv2toy3vn427ed"}`).

---

## 1. TOKEN TRACE

### 1.1 Backend
```
File:           /app/backend/.env
Variable:       MAPBOX_ACCESS_TOKEN
Value:          pk.eyJ1Ijoic2xhYnJlYWxpdHkiLCJhIjoiY21wYzE1NWRpMDJ3djJ0b3kzdm40MjdlZCJ9.b1STBZLpxN1Ytgl_SZmcSA
Length:         94 chars
Owner (u):      slabreality
Token id (a):   cmpc155di02wv2toy3vn427ed
Type:           public (pk.*)
Loaded via:     services/studio_v2.py:404
                    os.environ.get('MAPBOX_ACCESS_TOKEN', '').strip()
                Backed by python-dotenv load on backend startup.
```

### 1.2 Frontend
```
File:           /app/frontend/.env
Variable:       NESSUNA chiave Mapbox configurata
```
Verifica: `grep -i mapbox /app/frontend/.env` → vuoto.
Il frontend **non possiede né utilizza alcun token Mapbox** direttamente.
Tutte le chiamate Mapbox passano dal proxy backend `/api/studio/v2/cities`
(verificato in `Step2Location.jsx:80-96`).

### 1.3 Architettura risultante
```
[browser visitor]
      │
      │   GET /api/studio/v2/cities?country=IT&q=Padova&limit=5
      │   (Referer: https://editorial-platform-4.preview.emergentagent.com)
      ▼
[backend Python (httpx)]
      │
      │   GET https://api.mapbox.com/geocoding/v5/mapbox.places/Padova.json
      │       ?access_token=<token>&country=it&types=place&limit=5&language=en&autocomplete=true
      │   ❌ NO Referer header inviato (httpx default)
      ▼
[Mapbox API]
      │
      │   Lookup URL Restrictions for token slabreality.cmpc155di02wv2toy3vn427ed
      │   Allowed: moodfordesign.com, www.moodfordesign.com
      │   Request Referer: <none>  →  NON match
      │
      ▼
HTTP 403 Forbidden  {"message":"Forbidden"}
```

### 1.4 Confronto con quanto dichiarato
| Dichiarazione utente | Stato verificato |
|---|---|
| "Abbiamo creato un nuovo token dedicato MOOD" | ❌ **Non in uso**: il `.env` contiene ancora il token `slabreality` |
| Frontend e backend usano lo stesso token? | N/A — frontend non usa Mapbox direttamente, solo proxy backend |
| Token nuovo già configurato? | ❌ Non è stato fornito né inserito nel `.env` |

---

## 2. MAPBOX ENDPOINT AUDIT

### 2.1 Endpoint effettivamente chiamato dal codice attuale
File: `/app/backend/services/studio_v2.py:410-420`

```python
url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{safe_q}.json"
async with httpx.AsyncClient(timeout=8) as cx:
    r = await cx.get(url, params={
        "access_token":  token,
        "country":       country_iso.lower(),
        "types":         "place",
        "limit":         limit,
        "language":      "en",
        "autocomplete":  "true",
    })
```

| Campo | Valore |
|---|---|
| URL | `https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json` |
| Method | `GET` |
| Query params | `access_token`, `country` (iso2 lowercase), `types=place`, `limit`, `language=en`, `autocomplete=true` |
| API family | **Geocoding API v5 (Forward Geocoding)** |
| Documentation | https://docs.mapbox.com/api/search/geocoding-v5/ |
| Token type richiesto | `pk.*` (public) o `sk.*` (secret) — entrambi validi |
| Scope richiesto | `GEOCODING_API` (auto-incluso in tutti i public tokens base) |

### 2.2 Test su altri endpoint (per isolare la causa)
| Endpoint | Token | Referer | Status |
|---|---|---|---|
| Geocoding v5 `/mapbox.places/Padova.json` | slabreality | `none` | **403** |
| Geocoding v6 `/search/geocode/v6/forward` | slabreality | `none` | **403** |
| Search Box `/search/searchbox/v1/suggest` | slabreality | `none` | **403** |
| Tilequery `/v4/mapbox.mapbox-streets-v8/...` | slabreality | `none` | **403** |
| Geocoding v5 (same) | slabreality | `https://www.moodfordesign.com/` | **200 ✅** |
| Geocoding v5 (same) | slabreality | `https://editorial-platform-4.preview.emergentagent.com/studio` | **403** |
| Geocoding v5 (same) | slabreality | `https://editorial-platform-4.preview.emergentagent.com` (Origin) | **403** |

**Conclusione**: il 403 NON dipende dall'endpoint né dallo scope. Dipende dal **Referer/Origin** della richiesta, indicando che le **URL Restrictions** del token sono la causa singolare.

---

## 3. FAILURE ANALYSIS — full request/response

### 3.1 Richiesta effettiva dal backend (riprodotta)
```http
GET /geocoding/v5/mapbox.places/Padova.json?access_token=pk.eyJ1...mcSA&country=it&types=place&limit=3&language=en&autocomplete=true HTTP/2
Host: api.mapbox.com
Accept: */*
Accept-Encoding: gzip, deflate
Connection: keep-alive
User-Agent: python-httpx/0.28.1
```

Nota assenza di `Referer` e `Origin`.

### 3.2 Risposta Mapbox
```http
HTTP/2 403
Content-Type: application/json; charset=utf-8
Content-Length: 23
X-Powered-By: Express
Access-Control-Allow-Origin: *
Cache-Control: max-age=432000, stale-while-revalidate=600, stale-if-error=86400
Etag: W/"17-bqIm6pxC4cx+ZoszvXxsClwgWw8"
Via: 1.1 CloudFront
X-Amz-Cf-Pop: ORD58-P9

{"message":"Forbidden"}
```

**Reason**: nessun dettaglio nel body. Mapbox non discrimina fra
"URL restriction mismatch" e "scope mancante" — entrambi tornano
`{"message":"Forbidden"}`. La discriminazione si fa per esclusione:
- Stesso endpoint con Referer giusto → 200 → quindi **scope OK**.
- Diversi endpoint stesso modo → tutti 403 → quindi **URL restriction account-level**.

### 3.3 Risposta Mapbox con fix Referer
```http
GET (same URL)
Referer: https://www.moodfordesign.com/

HTTP/2 200
Content-Type: application/vnd.geo+json; charset=utf-8
Content-Length: 878

{
  "type": "FeatureCollection",
  "query": ["padova"],
  "features": [{
    "id": "place.39233648",
    "type": "Feature",
    "place_type": ["place"],
    "relevance": 1,
    "properties": {"mapbox_id": "dXJuOm1ieHBsYzpBbGFvY0E", "wikidata": "Q617"},
    "text_it": "Padova",
    "language_it": "it",
    "place_name_it": "Padova, provincia di Padova, Italia",
    "text": "Padova",
    "place_name": "Padova, provincia di Padova, Italia",
    "bbox": [11.805438, ...],
    "center": [11.8767, 45.4064],
    "geometry": {"type": "Point", "coordinates": [11.8767, 45.4064]},
    "context": [
      {"id": "region.xxx", "short_code": "IT-PD", "text_it": "provincia di Padova"},
      {"id": "country.xxx", "short_code": "it", "text_it": "Italia"}
    ]
  }, ...]
}
```

---

## 4. NEW TOKEN TEST

### 4.1 Stato del nuovo token MOOD
**Non disponibile per il test**. L'utente ha dichiarato di aver creato un nuovo token dedicato MOOD, ma:
- non è stato fornito tramite messaggio;
- non è presente in `/app/backend/.env`;
- non è presente in alcuna env var del processo backend;
- non è presente in `/app/frontend/.env`.

**Per procedere con il test del nuovo token serve l'utente fornisca**:
- Token value (`pk.*` o `sk.*`)
- (opzionale) Conferma delle URL Restrictions impostate sul dashboard

### 4.2 Test con il token attualmente configurato (slabreality) + Referer corretto

| Test | URL | Risultato |
|---|---|---|
| Italy → Padova | `…/geocoding/v5/mapbox.places/Padova.json?country=it&language=it` + Referer moodfordesign.com | ✅ HTTP 200 — `Padova, provincia di Padova, Italia` · center `[11.8767, 45.4064]` · short_code `IT-PD` |
| USA → Chicago | `…/Chicago.json?country=us&language=en` + Referer moodfordesign.com | ✅ HTTP 200 — `Chicago, Illinois, United States` · center `[-87.8692, ...]` · short_code `US-IL` |
| UK → London | `…/London.json?country=gb&language=en` + Referer moodfordesign.com | ✅ HTTP 200 — `London, Greater London, England, United Kingdom` · center `[-0.3517, ...]` · short_code `GB-LND` |

I 3 test confermano che il **token attuale è funzionalmente operativo** per le 3 città richieste. **L'unico ostacolo è l'URL restriction**.

---

## 5. AUTOCOMPLETE EVIDENCE

L'autocomplete **non può funzionare end-to-end** finché:
- (A) le URL Restrictions del token non includono `*.preview.emergentagent.com` (per testare sulla preview);
- O (B) il backend invia esplicitamente un `Referer` whitelisted nelle chiamate Mapbox;
- O (C) si utilizza un token `sk.*` server-side (i secret token bypassano le URL Restrictions per design).

**Stato attuale dal browser**: fallback testuale attivo, dropdown non visibile (verificato negli screenshot evidence pack `04_step2_hq_city*.jpeg`).

---

## 6. DATA PERSISTENCE TEST

### 6.1 Stato attuale del DB (`studio_requests`)
```
total submissions:      19
with headquarter_lat:    7   ← di cui:
   • 6 con mapbox_place_id LIKE 'place.fallback%' o 'place.test.e2e'  (test scripts)
   •  1 record reale con dati Mapbox autentici (vecchia simulazione)
without headquarter_lat: 12  ← submissions reali via funnel in fallback mode
```

### 6.2 Le 2 submissions Evidence Pack (preview)
| Email | Locale | city | region | lat | lng | place_id |
|---|---|---|---|---|---|---|
| `evidence.it.1780357847@moodtest.example.com` | it-IT | "Milano" | NULL | NULL | NULL | NULL |
| `evidence.en.1780357910@moodtest.example.com` | en-US | "New York" | NULL | NULL | NULL | NULL |

**Conclusione**: nessuna submission realizzata via la preview ha popolato i campi geografici Mapbox, per via dell'URL restriction. Test E2E con autocomplete e popolamento DB **non eseguibili** finché non viene risolto il blocco URL.

### 6.3 Atteso al post-fix
```json
{
  "country_iso":   "IT",
  "country_name":  "Italia",
  "city":          "Padova",
  "region":        "provincia di Padova",
  "latitude":      45.4064,
  "longitude":     11.8767,
  "place_id":      "place.39233648"
}
```

---

## 7. URL RESTRICTIONS CHECK

### 7.1 Stato verificato del token `slabreality.cmpc155di02wv2toy3vn427ed`

| Origine richiesta | Risultato |
|---|---|
| `https://www.moodfordesign.com/` | ✅ Allowed |
| `https://moodfordesign.com/` | ✅ Allowed (presumibilmente, da testare se serve) |
| `https://*.preview.emergentagent.com` (qualsiasi sub) | ❌ Blocked |
| Server-side (no Referer / no Origin) | ❌ Blocked |

### 7.2 Cosa va configurato sul dashboard Mapbox

**Per il token attuale `slabreality`** (`https://account.mapbox.com/access-tokens/`):
- ➕ Aggiungere `editorial-platform-4.preview.emergentagent.com` alle URL allowed.
- ➕ Aggiungere `*.preview.emergentagent.com` come pattern (se Mapbox supporta wildcard).
- ⚠ Le chiamate server-side **non passeranno comunque** un Referer — questo è un comportamento di `python-httpx` (non lo manda by default) e di tutti i client HTTP server-side.

**Soluzione strutturale consigliata**:
- **Creare un token Mapbox SECRET (`sk.*`)** sul dashboard, dedicato all'uso server-side.
- I token `sk.*` **NON sono soggetti a URL Restrictions** per design Mapbox: sono pensati per chiamate server-to-server.
- Inserirlo in `/app/backend/.env` come `MAPBOX_ACCESS_TOKEN`.
- Tenere il token `pk.*` (con URL restrictions su `moodfordesign.com`) per eventuali usi futuri direct-browser (mappe interattive, GL JS), ma per il geocoding server-side non è la scelta giusta.

### 7.3 Verifica del nuovo token MOOD (se fornito)
Quando l'utente fornirà il nuovo token, eseguirò questi 4 test (1 minuto):
1. Test diretto Mapbox sito production-like (Referer moodfordesign.com)
2. Test diretto Mapbox da backend (no Referer) → se 200 → token sk.* o restrictions rimosse
3. Test backend proxy `/api/studio/v2/cities?country=IT&q=Padova`
4. Test funnel browser sulla preview con verifica DB persistence

---

## 8. CONCLUSIONE — CAUSA E AZIONE

### 8.1 Causa precisa del 403 attuale

**Una sola causa attiva**: URL Restrictions sul token `pk.slabreality.cmpc155di02wv2toy3vn427ed` non includono il dominio della preview Emergent né permettono chiamate server-side senza Referer.

Tutte le altre ipotesi (scope mancante, endpoint sbagliato, env vars non lette, configurazione Emergent) **sono escluse empiricamente**:
- ✅ Stesso endpoint, stesso token, Referer giusto → HTTP 200 con dati completi.
- ✅ Geocoding v5/v6 e Search Box tutti 403 con stesso token → non è un endpoint deprecato.
- ✅ Backend env carica correttamente il token (94 char, decodificabile, owner verificato).
- ✅ Frontend non ha alcun token Mapbox configurato (architettura proxy-only).

### 8.2 Azioni risolutive (per ordine di robustezza)

**OPZIONE A (consigliata) — Secret token server-side**:
1. Sul dashboard Mapbox creare un token con prefisso `sk.*` (Secret Token).
2. Abilitare gli scope: `geocoding:read` (default per pk.* o sk.* base).
3. NESSUNA URL restriction necessaria (i sk.* bypassano).
4. Inserire in `/app/backend/.env` → `MAPBOX_ACCESS_TOKEN=sk.…`.
5. `sudo supervisorctl restart backend`.
6. **Costo zero**: i sk.* sono gratuiti, contano sulla stessa quota del free tier Mapbox.

**OPZIONE B — Estendere URL restrictions del token attuale**:
1. Sul dashboard Mapbox editare il token `slabreality.cmpc155di02wv2toy3vn427ed`.
2. Aggiungere allowed URL: `editorial-platform-4.preview.emergentagent.com` e `moodfordesign.com` (se non presente).
3. **Limitazione residua**: le chiamate server-side senza Referer continueranno a essere bloccate se le URL restrictions sono attive. Mapbox bypassa URL restrictions solo quando le sue policies di security riconoscono la richiesta come "no-Referer trusted server-side", e questa policy non è documentata pubblicamente. **Test empirico necessario** dopo la modifica.

**OPZIONE C (non consigliata, hack temporaneo) — Forzare Referer dal backend**:
1. Modificare `services/studio_v2.py:412` per aggiungere `headers={"Referer": "https://www.moodfordesign.com/"}` nella chiamata httpx.
2. **Sicurezza degradata**: chiunque possa modificare il codice può aggirare le URL restrictions. Sconsigliato.

### 8.3 Cosa serve dall'utente per chiudere il ticket

⚠ **Una delle due cose**:
1. Token `sk.*` nuovo (preferito) — da incollare qui o nel file `/app/backend/.env`.
2. Conferma di aver aggiunto `editorial-platform-4.preview.emergentagent.com` alle URL Restrictions del token `pk.slabreality...` — io eseguo il retest immediato.

Nessuna modifica di codice in `Step2Location.jsx` o `services/studio_v2.py` è necessaria: il flow è già pronto a consumare le response Mapbox quando il token funzionerà.

---

## 9. CLASSIFICAZIONE FINALE

### ▶ **MAPBOX_CONFIGURATION_ERROR**

- Endpoint: ✅ corretto (`/geocoding/v5/mapbox.places/`).
- Codice backend/frontend: ✅ corretto (proxy via `/api/studio/v2/cities`, no token client-side).
- Token format: ✅ valido.
- Token scope: ✅ funzionante (verificato con Referer moodfordesign.com).
- Token URL restrictions: ❌ bloccano preview e chiamate server-side senza Referer.
- Variabili d'ambiente: ✅ caricate correttamente.
- Configurazione Emergent: ✅ nessun problema di env injection.

**Il fix richiede SOLO una modifica sul dashboard Mapbox** (5-10 minuti utente). Nessun codice da toccare.

---

## 10. FILE DI RIFERIMENTO

| File | Linee | Contenuto |
|---|---|---|
| `/app/backend/.env` | linea con `MAPBOX_ACCESS_TOKEN=` | Token attualmente caricato |
| `/app/backend/services/studio_v2.py` | 398-446 | `search_cities()` async function — endpoint, parametri, fallback |
| `/app/backend/routers/studio_v2.py` | `/cities` endpoint | router pubblico chiamato dal frontend |
| `/app/frontend/src/corporate/pages/studio_v2/Step2Location.jsx` | 80-100 | hook debounced che chiama il proxy |
| `/app/frontend/.env` | — | NESSUN MAPBOX_TOKEN (corretto) |
| `/app/memory/STUDIO_V2/evidence_pack/it-IT/04_step2_hq_city.jpg` | — | Evidenza visiva del fallback testuale |

STOP. Nessun codice modificato. Nessun deploy. Aspetto decisione utente su opzione A/B.
