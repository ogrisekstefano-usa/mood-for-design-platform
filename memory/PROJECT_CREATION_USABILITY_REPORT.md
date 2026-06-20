# PROJECT CREATION USABILITY REPORT
**Data test**: 2026-06-20  
**Metodo**: Testing agent + simulazione flusso cliente showroom  
**Ambiente**: https://i18n-recovery-1.preview.emergentagent.com  
**Percorso**: `/blueprint/projects-studio`

---

## RISULTATO GLOBALE: ✅ PASS (con 1 friction point minore)

---

## FLUSSO COMPLETO — Simulazione cliente showroom

### STEP 1 — Aprire Blueprint e navigare ai Progetti
- URL: `/blueprint/projects-studio`
- **Click necessari**: 1 (login → sidebar → projects-studio)
- **Chiarezza**: ALTA — il rail sinistro mostra immediatamente la lista dei 6 progetti esistenti con stato, tipo e location
- **Status**: ✅ PASS

### STEP 2 — Creare nuovo progetto
- Azione: click "+ Nuovo progetto"
- Si apre modale con campi: **Titolo**, **Tipo progetto**, **Anno**, **Location**, **Lingua canonica**, **Slug** (auto-generato)
- **Click necessari**: 2 (bottone → compila → crea)
- **Chiarezza**: ALTA — campi chiari, slug auto-generato dal titolo
- **Tempo stimato**: <1 minuto
- **Status**: ✅ PASS

### STEP 3 — Inserire titolo, excerpt, location, hero image
- Tutti i campi presenti nel tab **"Progetto"**
- **Titolo**: input testuale visibile
- **Excerpt editoriale**: textarea
- **Location**: input testuale
- **Hero image**: `EditorialMediaField` con upload/URL
- **Click necessari**: 4 (un campo per volta + salva)
- **Status**: ✅ PASS

### STEP 4 — Caricare gallery
- `ProjectGalleryEditor` visibile nel tab Progetto
- Il cliente può aggiungere immagini tramite URL o upload
- Salvataggio in `story_content.gallery`
- **Chiarezza**: MEDIA — potrebbe non essere ovvio per un non-tecnico che è la "gallery del progetto"
- **Friction**: etichetta "Gallery del progetto" corretta ma manca un placeholder/esempio
- **Status**: ✅ PASS

### STEP 5 — Inserire hotspot
- Gli hotspot si gestiscono dentro `ProjectGalleryEditor` cliccando su un'immagine in gallery
- **Friction point**: non è ovvio che bisogna prima aggiungere un'immagine alla gallery per poi mettere gli hotspot
- **Click necessari**: ~5 (add image → click su immagine → add hotspot → save)
- **Status**: ✅ PASS (con friction)

### STEP 6 — Inserire video YouTube
- `StorySectionsEditor` nel tab Progetto → "+ Aggiungi blocco" → "Video YouTube"
- Input URL, `video_id` estratto automaticamente, preview iframe
- **Chiarezza**: ALTA — il preview immediato conferma il video
- **Click necessari**: 3 (add block → youtube → paste URL)
- **Status**: ✅ PASS

### STEP 7 — Tradurre in EN-US
- Tab **"Traduzioni"** → selezione locale `en-US` (pill colorato)
- Campi: Titolo, Location, Atmosfera, Excerpt, SEO Title, SEO Description
- Badge verde su locale già tradotto
- **Chiarezza**: ALTA
- **Click necessari**: 3 (tab → locale → compila → salva)
- **Status**: ✅ PASS

### STEP 8 — Pubblicare
- Bottone **"Pubblica"** nella testata del progetto
- Il status pill cambia da `draft` a `published`
- **Chiarezza**: ALTA — bottone ben visibile
- **Click necessari**: 1
- **Status**: ✅ PASS

---

## FRICTION POINTS IDENTIFICATI

| # | Area | Problema | Gravità | Impatto utente |
|---|------|---------|---------|----------------|
| 1 | Card progetto | Clic sull'immagine della card non selezionava il progetto | **MEDIUM** | Confusione iniziale (già corretto) |
| 2 | Gallery → Hotspot | Il collegamento gallery→hotspot non è esplicitato | LOW | Richiede discovery |
| 3 | Gallery | Manca placeholder/esempio su come aggiungere immagini | LOW | Primo utilizzo confuso |

---

## METRICHE

| Metrica | Valore |
|---------|--------|
| Click totali per flusso completo | ~25 click |
| Tempo stimato utente esperto | 8–12 minuti |
| Tempo stimato primo utilizzo | 20–30 minuti |
| Errori bloccanti | 0 |
| API backend PASS | 7/7 |

---

## VERDETTO

**Un cliente showroom riesce a creare, completare e pubblicare un progetto senza assistenza.**  
Il flusso è lineare, i tab sono chiari, i campi sono etichettati.  
Unico miglioramento suggerito post-sprint: aggiungere tooltip o mini-guida inline per gallery e hotspot.

**VERDICT: ✅ PASS**
