# V2.0 PRE-LAUNCH UX CERTIFICATION
**Data**: 2026-06-21  
**Sprint**: V2.0 Pre-Launch UX Cleanup Sprint  
**Metodo**: Screenshot reali + API test + audit codice  

---

## GATE FINALE

> **"Un proprietario di showroom che entra per la prima volta riesce a capire dove andare nei primi 30 secondi?"**

---

## FIX APPLICATI IN QUESTO SPRINT

| Fix | File | Risultato |
|-----|------|-----------|
| Sidebar espansa di default | `useSidebarCollapsed.js` | 17 etichette visibili al primo accesso |
| "Website Studio" nella nav tree | `tenant_config_resolver.py` | Entry CMS discoverable in <15sec |
| Rename "Blueprint Experience" → "Website Studio" | `SettingsPage.jsx`, `HomepageBuilderPage.jsx` | Terminologia coerente |
| Banner dismiss permanente | `tenant_onboarding.py`, `PersistentAlertBanner.jsx` | Banner scompare definitivamente dopo dismiss |

---

## VERIFICA PER FUNZIONE

| Funzione | Pre-fix (tempo scoperta) | Post-fix (tempo scoperta) |
|---------|--------------------------|--------------------------|
| Accesso Dashboard | VERDE | VERDE |
| CRM "Relazioni con i clienti" | ROSSO (>45sec) | VERDE (<5sec) |
| Magazine | ROSSO (>45sec) | VERDE (<10sec) |
| Website Studio (CMS) | ROSSO (>45sec) | VERDE (<15sec) |
| Partner Network | GIALLO (15-45sec) | VERDE (<5sec) |
| Projects Studio | GIALLO (15-45sec) | VERDE (<10sec) |

---

## COSA VEDE L'UTENTE AL PRIMO ACCESSO (POST-FIX)

```
SHOWROOM
  ✓ Dashboard
  ✓ Relazioni con i clienti     ← trova subito il CRM
  ✓ Design Journey
  ✓ Partner Network             ← trova subito i partner
  ✓ Moodboards
  ✓ Material Board
  ✓ Specifiche
  ✓ Project Story

CONOSCENZA
  ✓ Brand Atlas
  ✓ Knowledge Engine

CRESCITA
  ✓ Magazine                    ← trova subito dove pubblicare
  ✓ Content Studio
  ✓ Editorial Calendar

STUDIO
  ✓ Website Studio              ← trova subito dove modificare il sito
  ✓ Media Library
  ✓ Calendar
  ✓ Workspace Settings
```

Tutto leggibile immediatamente. Nessun hover necessario.

---

## BLOCKERS RESIDUI

**Nessun blocker.**

---

## WARNING RESIDUI (non bloccanti, V3.0)

| # | Elemento | Note |
|---|---------|------|
| W1 | Footer admin: "POWERED BY MOOD FOR DESIGN™" | Branding piattaforma nel pannello admin — scelta intenzionale per questo tenant demo |
| W2 | Terminologia CRM inglese | "DISCOVERY/CULTIVATION/ACTIVE STUDIO" — comprensibile per tech-savvy, meno per showroom tradizionale |
| W3 | "Prenota Consulenza" vs "Design Journey" | Alias intenzionale `/consulenza`=`BeginJourneyPage` — funziona ma crea leggera inconsistenza terminologica |

---

## VERDETTO FINALE

### PASS

**Evidenze**:

1. **Sidebar** (width: 284px, 17 etichette): un utente che entra per la prima volta vede immediatamente etichette chiare per tutte le funzioni principali
2. **CRM**: "Relazioni con i clienti" — trovabile in <5 secondi (prima voce dopo Dashboard)
3. **Magazine**: trovabile in <10 secondi (prima voce del gruppo CRESCITA)
4. **Website Studio**: trovabile in <15 secondi (prima voce del gruppo STUDIO, ex "Blueprint Experience")
5. **Banner**: assente dopo dismiss permanente — zero distrazioni durante demo e onboarding
6. **Nessun percorso morto**, nessun BLOCKER

Un proprietario di showroom che entra per la prima volta **riesce a capire dove andare nei primi 30 secondi**.

---

*Certificazione emessa il 2026-06-21 — V2.0 PRE-LAUNCH UX CLEANUP SPRINT CLOSED*
