# CTA CONSOLIDATION REPORT
## Analisi e Raccomandazione — Studio White Label
**Data**: Giugno 2026

---

## INVENTARIO CTA ATTUALE

### CTA Primarie (richiedono azione conversione)

| Label attuale | Href | Posizione | Problema |
|--------------|------|-----------|---------|
| "Prenota una consulenza" | nav (no href specifico) | Header nav | ✅ Corretta — ma non ha destinazione chiara |
| "Inizia il tuo progetto" | `/begin-journey` | Hero homepage | ❌ URL SaaS, label generica |
| "Inizia il tuo percorso" | `/about` | HowItWorks | ❌ URL sbagliata per conversione, label Journey-like |
| "Entra nella rete" | `/professionals` | Professionals CTA | ❌ Metafora platform/community |
| "Inizia un progetto" | `/begin-journey` | Footer | ❌ URL SaaS |
| Pulsante privati | `/begin-journey?audience=private` | FinalCTA | ❌ URL SaaS |

### CTA Secondarie/Contestuali (navigazione editoriale)

| Label attuale | Href | Posizione | Nota |
|--------------|------|-----------|------|
| "Per i professionisti" | `/professionals` | Hero homepage | Secondaria — OK |
| "Scopri il metodo" | `/about` | Editorial Statement | Editoriale — OK |
| "Scopri il progetto" | `/projects/[slug]` | Cards | Contestuale — OK |
| "Leggi l'articolo" | `/magazine/[slug]` | Magazine | Contestuale — OK |
| "Vedi tutti i progetti" | `/projects` | DesignStories | Navigazione — OK |
| "Collabora come professionista" | `/professionals` | FinalCTA | Secondaria — OK |

---

## PROBLEMI IDENTIFICATI

### 1. Dispersione del messaggio
Il visitatore incontra **6 CTA primarie diverse** prima di raggiungere il footer. Nessuna è dominante. Il cervello non sa dove guardare.

### 2. URL SaaS
`/begin-journey` appare **4 volte** nel sito come destinazione di CTA primarie. Un visitatore che esamina i link percepisce immediatamente la logica da piattaforma software.

### 3. Mancanza di destinazione
La CTA "Prenota una consulenza" nell'header non ha un href configurato — naviga a nulla.

### 4. Metafore incongruenti
- "Entra nella rete" → rete sociale/platform
- "Inizia il tuo percorso" → viaggio/journey SaaS
- "Accedi al workspace" (professionals) → dashboard software

---

## RACCOMANDAZIONE: UNA SOLA CTA PRIMARIA

### CTA Scelta: **"Prenota una consulenza"**

**Motivazione**:
- Professionale e internazionale
- Adatta a privati e professionisti
- Coerente con uno studio premium di fascia alta
- Non rimanda a logiche di prodotto o onboarding
- Crea aspettativa di una relazione umana diretta

### Destinazione: `/consulenza`

Alias route per `BeginJourneyPage` (pagina esistente):
- URL neutra e professionale
- Non espone la logica interna (`begin-journey`)
- Facile da comunicare verbalmente o su biglietto da visita

---

## PIANO DI CONSOLIDAMENTO

### CTA da modificare

| Posizione | Attuale | Dopo | Href attuale | Href dopo |
|-----------|---------|------|-------------|-----------|
| Header nav | "Prenota una consulenza" | Invariato ✅ | (mancante) | `/consulenza` |
| Hero primaria | "Inizia il tuo progetto" | "Prenota una consulenza" | `/begin-journey` | `/consulenza` |
| HowItWorks | "Inizia il tuo percorso" | "Scopri il processo" | `/about` | `/about` |
| Professionals CTA | "Entra nella rete" | "Prenota una consulenza" | `/professionals` | `/consulenza` |
| FinalCTA (privati) | "Inizia una conversazione" | "Prenota una consulenza" | `/begin-journey?...` | `/consulenza` |
| Footer | "Inizia un progetto" | "Prenota una consulenza" | `/begin-journey` | `/consulenza` |
| AboutPage fallback | "Inizia un progetto" | "Prenota una consulenza" | `/begin-journey` | `/consulenza` |

### CTA da mantenere invariate (contestuali)

| Posizione | Label | Motivo |
|-----------|-------|--------|
| DesignStories header | "Vedi tutti i progetti" | Navigazione — corretto |
| Magazine | "Leggi l'articolo" | Editoriale — corretto |
| Editorial Statement | "Scopri il metodo" | Editoriale/informativo — corretto |
| Hero secondaria | "Per i professionisti" | Navigazione secondaria — corretto |
| FinalCTA (professionisti) | "Collabora come professionista" | Target diverso — corretto |

---

## IMPLEMENTAZIONE TECNICA

### 1. Route alias (App.js)
```jsx
// Aggiungere alias senza rimuovere /begin-journey per compatibilità
<Route path="/consulenza" element={<BeginJourneyPage />} />
```

### 2. Aggiornamento CMS (DB patch)
Sezioni da aggiornare via script Python:
- `hero_editorial`: `cta_primary` label + `cta_primary_href`
- `design_journey`: `cta` label
- `professionals_cta`: `cta` label + `cta_href`
- `cinematic_quote`: `private` label + `private_href`
- `editorial_footer`: `cols[2].links[0]` label + href

### 3. Aggiornamento JSX (AboutPage.jsx)
Sostituire fallback hardcoded `/begin-journey` con `/consulenza`.

---

## GERARCHIA CTA FINALE

```
LIVELLO 1 — CTA PRIMARIA (conversione)
└── "Prenota una consulenza" → /consulenza
    Presente in: Header, Hero, FinalCTA, Footer, AboutPage, ProfessionalsPage

LIVELLO 2 — CTA SECONDARIA (esplorazione)
├── "Per i professionisti" → /professionals
└── "Collabora come professionista" → /professionals

LIVELLO 3 — CTA CONTESTUALE (navigazione editoriale)
├── "Scopri il processo" → /about
├── "Scopri il metodo" → /about
├── "Vedi tutti i progetti" → /projects
└── "Leggi l'articolo" → /magazine/[slug]
```

---

## IMPATTO ATTESO

| Metrica | Prima | Dopo |
|---------|-------|------|
| CTAs primarie diverse | 6 | 1 |
| URL SaaS esposte | 4 | 0 |
| Chiarezza messaggio | Dispersa | Concentrata |
| Percorso verso contatto | 6 opzioni confuse | 1 percorso chiaro |
