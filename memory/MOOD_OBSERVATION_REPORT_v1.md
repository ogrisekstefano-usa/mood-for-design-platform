# MOOD Observation Report v1
*Osservazione & Validation Phase — 29 Maggio 2026*

> Questo non è un report tecnico. È una lettura percettiva di MOOD attraversato come uno studio reale, un advisor reale, un founder reale.

---

## Sintesi in tre frasi

**MOOD vive.** L'attraversamento end-to-end — dallo studio sconosciuto fino all'apertura dell'ecosistema — è coerente, lento al punto giusto, e in molti momenti **emotivamente memorabile**. Lo scoglio più visibile è un **silenzioso buco di memoria fra `/studio` e l'Advisor Console**: alcuni dati composti con cura dallo studio (nome, archetipo, città) non arrivano fino alla cartella curatoriale dell'advisor, che li riceve come *"Untitled studio"*. È un singolo punto, ma rompe l'intera promessa relazionale.

---

## Scenario 01 — Studio sconosciuto attraversa `/studio`

**Composizione completata**: `MOOD-3C68-C7AC` ricevuto.

### 🌿 Dove si percepisce un ecosistema curatoriale
- Movement I — **"Apri un nuovo capitolo del tuo studio."** + un solo CTA *"Inizia la composizione"*. Una sola decisione, una sola atmosfera. **Magistrale**.
- Movement II — Lo studio appare come una scelta morale, non una checkbox. *"Quale forma prende il vostro lavoro?"* + tile illuminate. Quando ne scegli una, le altre si attenuano dolcemente. *"Entri in MOOD come Studio di Interior Design"* — la conferma è una **frase**, non un toast.
- Movement III — *"Le esperienze che inviti oggi possono crescere con il tuo studio."* + due esperienze pre-selezionate e suggerite. Negative space dominante. **Sembra un moodboard, non un onboarding**.
- Movement IV — Il monogram dello studio (`OS`) appare in alto a destra in tempo reale mentre digiti. **È il dettaglio più curatoriale di tutto MOOD**.
- Movement V — La reception page (`/studio/request`) con Playfair italico, drift radiale luminoso, e il riferimento `MOOD-3C68-C7AC` in serif. Nessun "Grazie!", nessun emoji. **Cinematic.**

### 💻 Dove si percepisce ancora un software
- Movement IV — la **densità di campi del form identitario** (12 input + 2 select pill groups + 1 textarea) lo fa scivolare in *editorial-form* invece che in *editorial-letter*. Il monogram in alto a destra salva l'atmosfera, ma a metà pagina si torna a "compilare".
- Il **selettore lingua** in cima a Movement IV (5 pillole: Italiano · English · Français · Deutsch · Español) sembra una scelta tecnica più che un gesto curatoriale. Era nascosto altrove come da PRD; qui torna visibile.
- Il **prefisso telefonico** (`+39`) come campo separato dal numero è un retaggio CRM. Un solo campo `+39 333 1234567` sarebbe più poetico.

### ⚠️ Attriti
- **Email e Sito web hanno lo stesso trattamento visivo** (underline grigio, Playfair italico). Durante lo scenario ho confuso le due e ho inserito il sito nel campo email. La validazione *"Per continuare, lascia un riferimento email."* (rosso italico Playfair) è bellissima, ma sarebbe meglio non doverla mai vedere.
- **Due sezioni "nome" adiacenti**: *"L'atelier — chi compone con voi"* (Nome e cognome · Ruolo) e *"Come possiamo continuare la conversazione."* (Il tuo nome · Il tuo ruolo). Lo studio si chiede: *"Devo ripetere?"*. **Ridondanza percepita.**
- L'unica CTA del Movement IV (*"Invia la richiesta"*) è isolata in fondo, dopo una textarea opzionale. Quando lo studio scrolla per leggerla, **passa un tempo morto di ~1.5s** senza riferimento visivo.

### 🌀 Tempi morti
- Tra Movement IV ↔ Movement V (submit → reception): **~3.5s di "schermata vuota"** senza progress visual. Il drift radiale luminoso della reception è bello, ma servirebbe **un movimento di transizione** (fade-to-light, monogram che cresce, qualcosa). Oggi è un loading.

### 🌱 Opportunità future
1. **Sostituire Movement IV con un layout a colonna singola tipo lettera**: nome studio → contatto → temperament → mercati. Una cosa alla volta.
2. Dopo l'invio: invece di un riferimento secco `MOOD-3C68-C7AC`, mostrare **chi leggerà il profilo** ("Beatrice ha aperto la lettura del tuo studio." — entro 24h). Crea l'impressione che la conversazione sia già iniziata.
3. **Reception page con il monogram dello studio centrale**, come un sigillo. Il riferimento diventa secondario.

---

## Scenario 02 — Advisor: lettura, Visit Report, Follow-up

### 🌿 Dove si percepisce un ecosistema curatoriale
- **Hero della Advisor Console**: *"Le tue relazioni di studio."* + *"Un osservatorio editoriale sulle conversazioni in corso con l'ecosistema."* — questa è la **frase più importante di MOOD**. Non leggi: stai contemplando. **Conserva intatta.**
- Quadro generale a 4 celle (Relazioni curate · Conversazioni vive · Ecosistemi attivati · Pronti all'apertura) con numeri grandi Playfair e helper descrittive sotto. *"Studi nel tuo orbitale advisor."* è una frase che farei stampare.
- **Advisory Value strip**: due numeri italici (`€850` ricorrente mensile, `€2K` valore di configurazione iniziale) con sotto: *"Stime indicative dalla tua lettura — non impegni commerciali."* **Questa frase da sola separa MOOD da ogni CRM esistente**.
- Status e Temperature picker come pillole con dot soffuso. *"Allineamento editoriale"* invece di "qualified". *"Pronto all'apertura"* invece di "hot lead". **La distanza linguistica dal CRM è enorme.**
- Note dell'advisor placeholder: *"Osservazioni libere. Atmosfera. Tensioni. Risonanze."* + **Prossimo movimento** placeholder: *"Una sola frase. Il prossimo passo curatoriale."* — è la migliore microcopy che ho letto in un admin tool.
- Sezione **Promemoria di lettura** vuota: *"Nessun promemoria. La relazione respira."* — **scrittura poetica nello stato vuoto**. Più di una decorazione: trasmette filosofia.

### 💻 Dove si percepisce ancora un software
- L'**header della Relation Detail** mostra *"Untitled studio"* per lo studio appena composto (vedi 🔴 attriti). Questa è la **rottura più grande di tutta MOOD**: l'advisor riceve un nome generato dal sistema invece del nome che lo studio ha scritto con cura.
- Sotto il titolo: *"— · osservazione@example.com"* (em dash + email). L'**archetipo, la città, il paese sono assenti**. La provenienza è desolata.
- "Studio Relations" come label di sezione → in inglese. Tutto il resto è italiano. Stesso per "Visit Reports", "Advisor Console", "Studio Requests" in sidebar — **mix linguistico subliminale**.

### 🔴 Attriti (CRITICI)
- **Data loss tra `/studio` e Advisor Console**. Lo studio ha composto un'identità completa (nome `Studio Osservazione`, archetipo `Interior Design`, città `Milano`, temperamento `Composto`, mercato `Residenziale privato`). L'advisor riceve: `Untitled studio`, archetipo `null`, città `null`. **Il 70% della curatela dello studio non viene mai letta dall'advisor.**
- Verifica DB: `studio_requests.studio_name = NULL`, `archetype = NULL`, `city = NULL` per la richiesta appena submitatta. La draft probabilmente non viene "promossa" correttamente al submit, oppure il submit invia solo i campi di contatto.
- Conseguenza percepita: **tutta la magia di Movement IV viene buttata via**. Il founder ha scritto con cura, e l'advisor riceve un guscio.

### 🌀 Tempi morti
- Caricamento Relation Detail: skeleton hairline rectangles per ~2-3s prima del paint. **Lo skeleton è bello**, ma è ancora un loading. Su una pagina che dice di essere una "cartella curatoriale", il caricamento dovrebbe sembrare più una **carta sfogliata** che un'API call.
- Status changed → la riga di timeline appare immediatamente, ma il dot teal lampeggia in modo identico per ogni evento. **Tutti gli eventi sembrano avere lo stesso peso**. *"Relazione aperta"* dovrebbe avere più gravità di *"Cambio di temperatura"*.

### 🌱 Opportunità future
1. **Risolvere il data loss prima di qualsiasi altra cosa**. Questo è il bug più importante che impatta la percezione (non un bug "tecnico", ma narrativo). Quando lo risolvi, l'header diventa "Studio Osservazione" e tutto cambia.
2. **Provenance card** sopra l'header: una micro-scheda con città, paese, temperamento, sito, monogram. *"Lo studio è arrivato da Milano. Si è raccontato come Composto. Ha scelto Residenziale privato come mondo."* — una frase narrativa, non una table.
3. **Timeline con peso eventi**: "Relazione aperta" più grande, "Cambio di temperatura" più piccolo. La cartella curatoriale ha una sua geografia visiva.

---

## Scenario 03 — Open Studio Ecosystem

### 🌿 Dove si percepisce un ecosistema curatoriale
- **CTA in basso a destra della Relation Detail**: *"Apri l'Ecosistema dello Studio"* dentro un riquadro discreto con sotto *"Attivazione curatoriale privata. Crea il tenant, invita il founder, apre la composizione."* — **niente confetti, niente "Activate" verde acido**. Il pulsante teal è grande ma calmo.
- **Modal di Revisione finale**: schermata centrata, fade-out del resto della UI, *"Attivazione curatoriale privata."* in Playfair grande. Sotto: tre righe (Studio · Archetipo · Composizione iniziale · Founder che riceverà l'invito). **Sembra un atto notarile elegante**.
- **Phase "Attivando"**: spinner sottile teal in cerchio + *"Attivazione curatoriale privata."* in italico sotto. Niente progress bar percentuale. **2.5 secondi di silenzio cinematografico**. La schermata che ottieni dopo è proporzionale al tempo che ti ha fatto attendere — **questo è puro luxury hospitality**.
- **Phase "Done"**: *"L'ecosistema è aperto."* in Playfair grande, *"Lo studio ha ricevuto la sua chiave editoriale. Un Magic Link è in viaggio verso il founder."* — **"in viaggio"**. Non "sent". Non "delivered". **In viaggio**. Tutto il tono di MOOD è in queste tre parole.

### 💻 Dove si percepisce ancora un software
- Il "tenant slug" mostrato in basso (`untitled-studio`) è una **leak tecnica**. È utile internamente, ma rovina il momento. Suggerimento: **non mostrare nessuno slug**, oppure mostrare il monogram in grande con il nome studio sotto.
- Il pulsante "Torna alla console" è un tasto bordered classico. Per il momento sacro che è, dovrebbe essere un **link sottile**, un sussurro.

### ⚠️ Attriti
- Il modal Review mostra **"—" per Composizione iniziale**. Le esperienze pre-selezionate in Movement III non sono arrivate qui. Stesso problema del data loss precedente: l'advisor non vede le esperienze che lo studio ha scelto. **Si sta attivando un ecosistema senza ricordare cosa contiene.**

### 🌀 Tempi morti
- Tra "Confirma" e "Done": ~5s. Per la maggior parte sono caricamento backend (creazione tenant, modules, user, magic link). Il tempo è giustificato. **Ma il copy "Attivazione curatoriale privata." resta statico**. Sarebbe magico se cambiasse — "Stiamo preparando la chiave editoriale..." → "Il founder sta per ricevere il link..." → "L'ecosistema è aperto." — **una piccola narrazione anche durante l'attesa**.

### 🌱 Opportunità future
1. **Nascondere il tenant slug** dalla schermata Done. Sostituire con il monogram dello studio in grande (`OS`) e il nome studio sotto. Il tenant tecnico resta nel database.
2. **Narrazione durante l'attesa**: 3 microcopy sostituite ogni ~1.5s.
3. Dopo il Done, **non tornare alla console**. Aprire una piccola overlay: *"Vuoi accompagnare il founder al suo primo accesso?"* con due opzioni: *"Sì, mostrami il link"* / *"Lascialo arrivare in autonomia."* — **rende l'advisor sceglie cosa fare con il momento**.

---

## Scenario 04 — Founder riceve Magic Link

**Magic Link emesso correttamente** verso `osservazione@example.com` (sandbox stub mode, loggato a stdout: `https://.../journey/continue?token=qCVl3b7hNW6fYprYroUnrAYcZHhrQ6cgP1ytcJlIz9Q`).

### 🌿 Dove si percepisce un ecosistema curatoriale
- L'**email Magic Link** (template HTML letto in `access_continuity.py`): dark editoriale, Georgia serif headline, eyebrow teal *"Access Continuity™"*, pill CTA *"Apri il tuo Journey"*, italic signature. **Sembra una lettera, non un transactional email**.
- Schermata `/journey/continue` quando il link è già consumato: *"Questo invito è già stato accolto."* + *"Per maggiore tranquillità ogni link è valido una sola volta. Possiamo aprirti subito un nuovo accesso."* + CTA teal *"Richiedi un nuovo link"*. **Il fatto che sia stato consumato non è un errore: è una rassicurazione**. *"Per maggiore tranquillità"* è la frase che mi rimarrà in testa per giorni.
- Footer sotto: *"MOOD for DESIGN protegge il tuo accesso con riservatezza editoriale. Niente password salvate sui server quando scegli il link."* — **trasforma una limitazione tecnica in un valore curatoriale**.

### 🔴 Attriti
- **Il link è arrivato già "accolto"**. Durante questo scenario, il founder non l'ha mai aperto manualmente — la prima visita al link ha trovato lo stato "già accolto". Possibili cause: doppia issue durante l'activation, o consume implicito side-effect. **Questo è un bug invisibile ma critico**: in produzione, il founder potrebbe ricevere un link che non funziona alla prima visita.
- Il pulsante "Richiedi un nuovo link" porta a una nuova schermata di identity probe. **Funziona**, ma è un secondo passaggio inatteso quando uno si aspetta di entrare direttamente.

### 🌱 Opportunità future
1. **Investigare e risolvere il doppio-consume del Magic Link**. Il founder dovrebbe entrare al primo click — punto.
2. **Quando il link è valido**, la schermata di arrivo dovrebbe essere una **mini-cinematica di benvenuto**: monogram dello studio che si rivela + *"Benvenuta, Beatrice. Il vostro studio è ora MOOD."* — non un redirect immediato.
3. **Per founder ricorrenti** (link richiesto manualmente da `/accedi`), il messaggio dovrebbe essere diverso da quello del primo accesso. Un *"Bentornata"* invece di un *"Benvenuta"*.

---

## Punti forti complessivi (cosa NON toccare)

1. 🌿 **Microcopy editoriale**: ogni frase di MOOD è scritta come se dovesse essere stampata. Mantieni questa disciplina.
2. 🌿 **Spaziatura architetturale**: il negative space è il **vero protagonista** dell'Advisor Console e di Movement III. Più di metà di ogni schermata è respiro.
3. 🌿 **Status/Temperature curatoriali**: l'eliminazione totale del vocabolario CRM (lead, pipeline, hot, qualified) è la cosa più radicale e riuscita di MOOD.
4. 🌿 **Movement V (reception)**: drift radiale, italic, niente celebrazioni. **È pronto da pubblicare**.
5. 🌿 **OpenEcosystemFlow** (Review → Activating → Done): la cinematica a tre atti funziona. Non aggiungere niente.
6. 🌿 **Magic Link "già accolto"** copy: trasforma un errore in un valore. **Studio case di UX writing.**

---

## Punti deboli complessivi

| Priorità | Punto debole | Impatto percettivo |
|---|---|---|
| 🔴 **P0** | Data loss `/studio` → Advisor Console (studio_name, archetype, city, country, experiences) | La promessa relazionale si rompe. L'advisor riceve un guscio. |
| 🔴 **P0** | Magic Link consumato durante l'activation (founder non entra al primo click) | Il momento d'arrivo del founder è compromesso. |
| 🟡 P1 | Tenant slug visibile in schermata Done (`untitled-studio`) | Leak tecnica nel momento sacro. |
| 🟡 P1 | Form Movement IV troppo denso (12 input in una schermata) | Si scivola in modalità "compila", esce dall'atmosfera. |
| 🟡 P1 | Email vs Website indistinguibili visivamente | L'utente sbaglia campo. |
| 🟡 P1 | Doppia sezione "nome" in Movement IV (atelier + contatto) | Ridondanza percepita. |
| 🟢 P2 | Labels nav admin in inglese ("Advisor Console", "Studio Requests") | Mix linguistico subliminale. |
| 🟢 P2 | Skeleton loading su Relation Detail | Sembra ancora una API call. |
| 🟢 P2 | Timeline: tutti gli eventi hanno lo stesso peso visivo | La narrazione manca di gravità. |
| 🟢 P2 | Loading dopo "Conferma l'apertura" è statico (~5s) | Tempo morto, opportunità narrativa persa. |

---

## Suggerimenti prioritizzati (backlog, non implementare ora)

### 🔴 Da risolvere PRIMA del prossimo founder reale

1. **Promozione draft → studio_request**: assicurare che TUTTI i campi (studio_name, archetype, city, country, languages, temperament, markets, experiences, atelier) passino dal draft al submit finale. Senza questo, MOOD non può funzionare con utenti reali.
2. **Magic Link issued in `activate_studio_ecosystem`**: verificare che il link non venga consumato dallo stesso flow che lo crea. Il founder deve poterlo aprire una sola volta, ma deve poterlo aprire.

### 🟡 Prima del lancio pubblico

3. **Provenance Card** sopra Relation Detail (città + temperamento + monogram + esperienze scelte) — restituisce all'advisor la curatela dello studio.
4. **Movement IV ristrutturato** in una colonna sola tipo lettera (nome → contatto → temperamento → mercati), una decisione per volta.
5. **Email/Website diversificati visivamente**: spaziatura, ordine, o un piccolo separatore *"— il vostro riferimento online —"*.
6. **Rimuovere tenant slug** dalla schermata Done. Sostituire con monogram + nome studio.
7. **Labels admin tradotti**: "Advisor Console" → "Console dell'Advisor" (o lasciare in inglese ma per **tutta** la nav, non a metà).

### 🟢 Quando MOOD respira

8. **Reception Movement V con monogram centrale**, riferimento secondario.
9. **Timeline con peso eventi differenziato**.
10. **Narrazione durante l'attesa** della Confirmation activation.
11. **Bentornata vs Benvenuta** sul Magic Link landing.
12. **Provenance intelligence card** durante la composizione nuova relazione (già esistente — ottima — ma da estendere con "ultimo segnale ricevuto").

---

## Una sola frase per chiudere

MOOD è già **un modo di guardare il design**. Manca solo che lo studio composto da Beatrice arrivi davvero, intero, fino alla cartella curatoriale dell'advisor. Quando avverrà, MOOD non sarà più software.

---

*Report curato osservando 4 scenari reali con Playwright in modalità manuale guidata.
Nessuna riga di codice nuovo è stata scritta durante questa fase.
Tutti i comportamenti documentati sono riproducibili nel preview attuale.*
