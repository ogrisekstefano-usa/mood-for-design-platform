# BEGIN JOURNEY — CONVERSION AUDIT
## Analisi strategica del funnel `/begin-journey`

> Versione: 17 Giugno 2026  
> Classificazione: Strategia CTA — Solo analisi. Nessuna modifica al form, al flow o al lifecycle.

---

## 1. RUOLO DI `/begin-journey`

### Cosa è realmente

`/begin-journey` è un **brief digitale in 3 step** che raccoglie:

| Step | Campi | Obiettivo |
|------|-------|-----------|
| I — Spazio | Tipo di spazio (residenziale / hospitality / contract) + "Come vuoi che ti faccia sentire?" + Riferimenti visivi | Qualifica l'intention d'acquisto |
| II — Stile | Numero di fruitori + Materiali preferiti + Atmosfera | Profila il gusto e il budget |
| III — Contatto | Nome + Email | Lead capture con consenso implicito |

### Cosa NON è

- Non è una registrazione a una piattaforma
- Non crea un account
- Non avvia un abbonamento
- Non dà accesso a una dashboard

### Posizionamento corretto nel funnel

```
AWARENESS  →  INTEREST  →  CONSIDERATION  →  INTENT  →  LEAD
  (homepage)    (about)      (servizi)        (↓)        (/begin-journey)
                                              "Voglio iniziare"
```

`/begin-journey` si posiziona nel momento in cui il visitatore è passato da "potrei interessarmi" a **"voglio fare qualcosa"**, ma non è ancora pronto a telefonare o aspettare una risposta email. È il **funnel self-service per i lead caldi**, alternativo e complementare a `/consulenza`.

---

## 2. PERCEZIONE UTENTE ATTUALE

### Stato post-sprint (CTA unificati a `/consulenza`)

Tutti i CTA pubblici puntano attualmente a `/consulenza`. Questo crea **due problemi distinti**:

#### A — Funnel unico = pressione percepita

"Prenota una consulenza" richiede implicitamente una disponibilità umana (disponibilità agenda, risposta, appuntamento). Per il visitatore che è in fase esplorativa ma motivata, questa è una **barriera troppo alta**. Risultato: abbandono silenzioso.

#### B — Assenza totale di `/begin-journey` = lead persi

Il form `/begin-journey` è il percorso di conversione più basso-impatto per il cliente: può farlo alle 23:00, in 4 minuti, senza aspettare risposta. Toglierlo dalla vista equivale a **rimuovere la porta d'ingresso più accessibile dello studio**.

#### C — Copy "consulenza" come unico registro = tono formale/corporate

Ripetere "Prenota una consulenza" su ogni sezione, in ogni pagina, in ogni footer spinge il tone-of-voice verso il registro professionale-freddo. Il cliente finale (privato, emotivamente coinvolto nel progetto casa) legge "consulenza" e pensa a un medico o a un avvocato, non a un progetto che lo emozionerà.

### Il problema di naming specifico di `/begin-journey`

Il path URL `/begin-journey` è un identificatore tecnico interno. **Non viene mai mostrato all'utente** nel copy del CTA. La percezione del flusso dipende esclusivamente da:

1. Il copy del CTA che porta al form (`"Raccontaci il tuo progetto"` vs `"Inizia il tuo progetto"`)
2. Il contesto della sezione in cui appare (`"Prima del primo incontro..."` vs `"Pronto?"`)
3. Il primo campo del form (`"Che tipo di spazio stai progettando?"` → selezione su chip — tono consulenziale, non tono SaaS)

**Conclusione**: la percezione è già corretta a livello di UX del form. Il problema è a monte: il form non viene mostrato.

---

## 3. PUNTI DI ACCESSO CONSIGLIATI

### Valutazione pagina per pagina

#### HOMEPAGE

| Posizione | Sezione | CTA attuale | Valutazione |
|-----------|---------|-------------|-------------|
| A | Hero — CTA secondaria | "PER I PROFESSIONISTI" → `/professionals` | La secondaria attuale serve a differenziare il pubblico (B2B vs B2C). **Non sostituire.** |
| B | DigitalJourneyHighlight | "Inizia ora" → `/consulenza` | **POSIZIONE IDEALE per `/begin-journey`**. La sezione descrive già il brief digitale — è il contesto perfetto. La CTA attuale è incoerente (descrive il brief, poi manda alla consulenza). |
| C | FinalCTA (3 colonne) | Centro: "PRENOTA UNA CONSULENZA" | La colonna destra ha già uno slot ("Contattaci"). Potrebbe diventare il secondo punto di ingresso controllato. |
| D | Come Lavoriamo | "Scopri il processo" → `/consulenza` | Momento di scoperta, non ancora di azione. Mantenere `/consulenza` o rimuovere il CTA. |

**Raccomandazione homepage**: **B (DigitalJourneyHighlight) come punto primario** + opzionalmente D come terzo punto nella FinalCTA.

---

#### ABOUT PAGE

| Posizione | Sezione | CTA attuale | Valutazione |
|-----------|---------|-------------|-------------|
| Hero | Hero editorial | "Prenota una consulenza" → `/consulenza` | Funziona come prima call. Mantenere. |
| Team | team_identity_card | "Prenota una consulenza" → `/consulenza` | Posizione emotivamente ricca (dopo aver letto del team). **Aggiungere CTA secondaria** "Raccontaci il tuo progetto" → `/begin-journey`. |
| Processo | design_journey | CTA → `/consulenza` | Dopo aver capito come lavora lo studio, il lead caldo vuole "iniziare". **Punto di alta intent** — ideale per `/begin-journey`. |
| Quote finale | cinematic_quote | "Prenota una consulenza" → `/consulenza` | Fondo pagina, momento emotivo. Mantenere `/consulenza` come primario. |

**Raccomandazione about**: **Processo design_journey** come punto `/begin-journey` — il visitatore ha appena capito come funziona lo studio.

---

#### SERVIZI PAGE

| Posizione | Sezione | CTA attuale | Valutazione |
|-----------|---------|-------------|-------------|
| Hero | Hero | "Prenota una consulenza" → `/consulenza` | CTA human-first, appropriato. Mantenere. |
| Singoli servizi | cards tipologiche | — (nessun CTA per card) | **Opportunità**: ogni card servizio potrebbe avere "Descrivi il tuo progetto →" → `/begin-journey`. Il lead sa già che servizio vuole. |
| Processo | Service process | "Prenota una consulenza" → `/consulenza` | Mantenere. |
| FinalCTA | Quote finale | "Prenota una consulenza" → `/consulenza` | Mantenere primario. Aggiungere secondario "o descrivi il tuo spazio" → `/begin-journey`. |

**Raccomandazione servizi**: Aggiungere CTA secondaria nel **FinalCTA** della pagina servizi.

---

#### PROFESSIONISTI PAGE

| Valutazione | Dettaglio |
|-------------|-----------|
| **NON inserire `/begin-journey`** | Questa pagina si rivolge ad architetti, designer e contractor — non al cliente finale. Il brief digitale è uno strumento B2C di lead gen, non B2B. Inserirlo qui creerebbe confusione sul pubblico target e potrebbe generare lead non qualificati da professionisti che "provano il tool" senza essere clienti. |

**Raccomandazione professionisti**: Nessuna modifica. CTA `/consulenza` per partnership è corretto.

---

#### FOOTER

| Posizione | Valutazione |
|-----------|-------------|
| Colonna navigazione | Aggiungere voce "Inizia il tuo progetto" → `/begin-journey` nella colonna NAVIGAZIONE del footer. Non è un CTA prominente, ma garantisce la scoperta per i visitatori che navigano il footer prima di uscire. |
| NON nel colophon | Il colophon è per link legali, non per conversione. |

**Raccomandazione footer**: Voce navigazione discreta.

---

## 4. CTA CONSIGLIATE

### Principi di copy per `/begin-journey`

Il copy deve:
- Parlare di **progetto** (non di form / brief / tool)
- Usare il **noi inclusivo** ("raccontaci", "parla con noi") o il **possessivo** ("il tuo progetto")
- Evitare qualunque riferimento tecnologico ("compila", "inserisci", "clicca", "registra")

### Copy per posizione

| Posizione | CTA primaria | CTA secondaria | Nota |
|-----------|-------------|----------------|------|
| Homepage → DigitalJourneyHighlight | **"Raccontaci il tuo progetto"** | — | Al posto di "Inizia ora" → `/consulenza`. Tono diretto, possessivo. |
| Homepage → FinalCTA (colonna 3) | — | **"...o descrivi il tuo spazio"** link testuale | Tono soft, non in competizione con il bottone primario. |
| About → Sezione Processo | — | **"Inizia il tuo progetto →"** | Tono azione, coerente con il contesto "come lavoriamo". |
| Services → FinalCTA | "Prenota una consulenza" (primario) | **"Preferisci iniziare da qui?"** | Offre un'alternativa senza sminuire il funnel primario. |
| Footer → Navigazione | **"Inizia il tuo progetto"** | — | Voce flat, non CTA stilizzata. |

### Copy da evitare per `/begin-journey`

| Copy errato | Perché |
|-------------|--------|
| "Usa il brief digitale" | Nomina lo strumento, non l'azione del cliente |
| "Compila il form" | Tono burocratico |
| "Inizia il trial" | SaaS language → errore esatto che vogliamo evitare |
| "Registrati" | Implica account |
| "Accedi al tuo journey" | Gergo interno non comprensibile |
| "Inizia ora" (generico, senza contesto) | Ambiguo — inizia cosa? |

---

## 5. RACCOMANDAZIONE FINALE

### Architettura CTA raccomandata (2 funnel paralleli)

```
CLIENTE FINALE — Percorso di conversione

         AWARENESS
              │
    ┌─────────┴──────────┐
    │                    │
 UMANO               SELF-SERVICE
 (consulenza)        (begin-journey)
    │                    │
"Voglio parlare        "Voglio iniziare
 con qualcuno"          da solo"
    │                    │
 /consulenza         /begin-journey
    │                    │
    └─────────┬──────────┘
              │
         LEAD ACQUISITO
```

### Priorità di implementazione

| Priorità | Azione | Pagina | Impatto conversione |
|----------|--------|--------|-------------------|
| 🔴 P0 | Cambiare CTA `DigitalJourneyHighlight` da `/consulenza` a `/begin-journey` + copy "Raccontaci il tuo progetto" | Homepage | **Alto** — sezione già contestualizzata per il funnel |
| 🔴 P0 | Aggiungere voce footer "Inizia il tuo progetto" → `/begin-journey` | Footer | **Medio** — cattura l'exit intent |
| 🟡 P1 | Aggiungere CTA secondaria nel FinalCTA della Homepage (colonna 3: "o descrivi il tuo spazio") | Homepage | **Medio** — rinforza il secondo funnel a fine pagina |
| 🟡 P1 | Aggiungere CTA "Inizia il tuo progetto →" nella sezione Processo dell'About | About | **Medio** — momento di alta intent emotiva |
| 🟢 P2 | CTA secondaria nel FinalCTA di Servizi | Servizi | **Basso-medio** — utenti già qualificati |

### In sintesi

Il sito attuale ha un **funnel unico ipercentalizzato** su "Prenota una consulenza". Questo funziona per i lead già pronti a impegnarsi, ma **esclude il segmento più numeroso**: il visitatore motivato che non è ancora pronto a fissare un appuntamento, ma che è disposto a investire 4 minuti nel proprio progetto.

`/begin-journey` non è in competizione con `/consulenza`. Sono **due porte della stessa casa**:

- `/consulenza` → "Voglio parlare con qualcuno" (alta barriera, alta intenzione)
- `/begin-journey` → "Voglio iniziare a costruire il mio progetto" (bassa barriera, alta motivazione)

L'obiettivo è che entrambe le porte siano visibili, con il giusto copy, nei giusti momenti del percorso utente.

---

**Nota tecnica**: nessuna modifica a form, flow, lifecycle o backend è necessaria per implementare queste raccomandazioni. Le modifiche riguardano esclusivamente le props dei componenti CMS esistenti e le impostazioni `settings.cta_href` nei seed script.
