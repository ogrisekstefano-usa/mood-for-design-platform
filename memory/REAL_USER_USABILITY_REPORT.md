# REAL USER USABILITY REPORT
**Data**: 2026-06-20  
**Test ID**: iteration_254 — FLOW 5  
**Metodo**: Simulazione utente non tecnico — showroom manager, commerciale, designer

---

## PREMESSA
Questo report simula cosa succede quando una persona non tecnica usa il sistema **senza spiegazioni**. Ogni punto indica dove si blocca, cosa non trova, cosa non capisce.

---

## PROFILO 1 — SHOWROOM MANAGER

**Scenario**: "Devo pubblicare un nuovo progetto sul sito."

### Dove si blocca

| Step | Problema | Gravità |
|------|---------|---------|
| Trova il menu Progetti | ✅ Facile — sidebar Blueprint ha icona + tooltip "Projects Studio" | OK |
| Crea nuovo progetto | ✅ Pulsante "+ Nuovo progetto" visibile | OK |
| Aggiunge hero image | ✅ Campo presente | OK |
| Aggiunge gallery | ⚠️ Non è chiaro come "si entra" in ProjectGalleryEditor. Manca un invito esplicito tipo "Trascina immagini qui" | LOW |
| Pubblica | ✅ Pulsante "Pubblica" visibile | OK |
| **Verifica che il progetto sia online** | ❌ Va su `/projects` e non lo vede. Non capisce perché. Non esiste un messaggio "Progetto pubblicato — ora visibile su /projects/slug" | **CRITICO** |

**Blocco principale**: Il progetto pubblicato non appare nel listing `/projects` perché `featured_only=True` di default nel feed pubblico. L'utente non sa che deve attivare "In evidenza in homepage". Il campo esiste nella tab SEO & Visibilità ma è un checkbox non evidente.

---

## PROFILO 2 — COMMERCIALE

**Scenario**: "Ho ricevuto una richiesta di contatto. Dove la trovo?"

### Dove si blocca

| Step | Problema | Gravità |
|------|---------|---------|
| Trova i lead ricevuti | ❌ Cerca "Lead" o "Contatti" nel sidebar. Non trova voce dedicata. Il sidebar è icon-only. | ALTO |
| Va su `/blueprint/leads` | ❌ 404 — pagina non trovata | ALTO |
| Trova `/relations/accounts` | ⚠️ Esiste ma il nome "Relazioni clienti" non è intuitivo per "lead ricevuti da form contatto" | MEDIO |
| Riesce a qualificare il lead | ⚠️ Una volta trovato, il workflow esiste | OK |

**Blocco principale**: Non esiste una voce "Lead" o "Contatti" nel sidebar Blueprint. Un commerciale cerca un nome familiare, non "Relazioni clienti".

---

## PROFILO 3 — DESIGNER

**Scenario**: "Devo scrivere un articolo per il magazine."

### Dove si blocca

| Step | Problema | Gravità |
|------|---------|---------|
| Trova il Magazine | ⚠️ Cerca "Magazine" o "Articoli" nel sidebar. La voce è sotto "Settings" (ingranaggio) | MEDIO |
| Crea articolo | ✅ Una volta in Settings → Magazine, il pulsante è visibile | OK |
| Inserisce testo | ✅ Editor presente | OK |
| Aggiunge YouTube | ✅ Funziona via StorySectionsEditor | OK |
| Pubblica | ✅ Pulsante presente | OK |
| Verifica online | ✅ Articolo visibile su `/magazine` | OK |

**Blocco principale**: La navigazione verso il Magazine richiede di cercare dentro "Settings" — non intuitivo.

---

## PROBLEMI IDENTIFICATI — RIEPILOGO

| # | Problema | Chi è bloccato | Gravità |
|---|---------|---------------|---------|
| 1 | Progetto pubblicato non visibile nel listing pubblico (featured_only=True default) | Showroom manager | 🔴 CRITICO |
| 2 | Nessuna voce "Lead" nel sidebar Blueprint | Commerciale | 🟡 MEDIO |
| 3 | `/blueprint/leads` → 404 | Commerciale | 🟡 MEDIO |
| 4 | Sidebar icon-only senza label → orientamento difficile | Tutti | 🟡 MEDIO |
| 5 | Magazine nascosto sotto "Settings" | Designer | 🟡 MEDIO |
| 6 | Nessun feedback visivo "progetto ora visibile su /projects/slug" dopo pubblicazione | Showroom manager | 🟡 MEDIO |
| 7 | Partner assignment richiede step non guidato (invite platform) | Manager con partner | 🟠 ALTO |

---

## FLUSSI CHE FUNZIONANO SENZA ASSISTENZA

| Flusso | Funziona da solo? |
|--------|------------------|
| Begin journey → lead registrato | ✅ SÌ |
| Partner application → candidatura ricevuta | ✅ SÌ |
| Creare/modificare testi CMS (Experience Studio) | ✅ SÌ |
| Creare nuovo progetto (fino alla pubblicazione) | ✅ SÌ (ma invisibile nel listing) |
| Pubblicare articolo magazine | ✅ SÌ (ma difficile da trovare) |
| Modificare traduzioni progetti | ✅ SÌ |

---

## VERDETTO

**VERDICT: ⚠️ PARTIAL**  
I flussi funzionano tecnicamente. Il sistema richiede ancora 1–2 sessioni di onboarding per un utente non tecnico. I 3 blocchi principali sono identificati e risolvibili senza nuove feature.
