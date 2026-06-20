# YOUTUBE BLOCK READINESS
**Sprint:** Pre-Deploy Final Certification  
**Data:** 2026-06-20  
**Obiettivo:** Verifica fattibilità blocchi body_blocks senza nuove tabelle  

---

## DOMANDA

> Possiamo utilizzare i `body_blocks` JSON esistenti per `image`, `gallery`, `youtube`, `quote`, `CTA` senza nuove tabelle?

---

## RISPOSTA

### **SI** — per tutti e 5 i tipi di blocco.

La tabella `magazine_articles` ha il campo `body_blocks JSONB`. Essendo JSONB, accetta qualsiasi struttura JSON senza vincoli di schema. Non è necessario ALTER TABLE né nuove tabelle.

---

## ANALISI PER TIPO DI BLOCCO

### `image` — ✅ GIÀ ESISTENTE E FUNZIONANTE
```json
{
  "type": "image",
  "id": "block_abc",
  "url": "https://...",
  "caption": {"it": "...", "en": "..."},
  "alt_text": "...",
  "filters": { "brightness": 1.0 },
  "focal_point": { "x": 0.5, "y": 0.3 }
}
```
- **Editor:** ✅ Supportato in `MagazineEditorPage` (image picker + upload)
- **Renderer pubblico:** ✅ Renderizzato in `MagazineArticlePage` (`ArticleBody`)
- **Conclusione:** PRONTO

---

### `gallery` — ✅ ESISTENTE, PARZIALMENTE SUPPORTATO
```json
{
  "type": "gallery",
  "id": "block_def",
  "items": [
    { "url": "...", "caption": "...", "alt_text": "..." },
    { "url": "...", "caption": "...", "alt_text": "..." }
  ]
}
```
- **Editor:** ⚠️ Non esiste UI per aggiungere/modificare una gallery nell'editor (solo singole immagini)
- **Renderer pubblico:** ✅ `ProjectDetailPage` ha `if (b.type === 'gallery' && (b.items || []).length > 0)` → renderizza grid
- **Conclusione:** PARZIALE — renderer esiste, manca editor UI

---

### `youtube` — ⚠️ NON SUPPORTATO (ma fattibile senza nuove tabelle)
```json
{
  "type": "youtube",
  "id": "block_ghi",
  "video_id": "dQw4w9WgXcQ",
  "caption": {"it": "...", "en": "..."},
  "autoplay": false,
  "lazy": true
}
```
- **Schema DB:** ✅ Nessun cambio necessario — JSONB accetta
- **Editor:** ❌ Non implementato — nessun campo `video_id` nell'editor
- **Renderer pubblico:** ❌ Non implementato — `MagazineArticlePage` non renderizza tipo `youtube`
- **Implementazione minima:**
  - Editor: input per URL YouTube + estrazione `video_id` automatica
  - Renderer: `<iframe src="https://www.youtube.com/embed/{video_id}" loading="lazy" />` con wrapper responsive

**Impegno stima:** 2-4 ore — nessuna nuova tabella, nessun nuovo componente architetturale

**Conclusione:** FATTIBILE senza nuove tabelle — **non ancora implementato**

---

### `quote` — ✅ GIÀ ESISTENTE E FUNZIONANTE
```json
{
  "type": "quote",
  "id": "block_jkl",
  "locale_content": {
    "it": { "text": "...", "attribution": "..." },
    "en": { "text": "...", "attribution": "..." }
  }
}
```
- **Editor:** ✅ Supportato in `MagazineEditorPage` (tipo `quote` con testo + attribuzione)
- **Renderer pubblico:** ✅ `MagazineArticlePage` renderizza `type === 'quote'`
- **Conclusione:** PRONTO

---

### `CTA` — ✅ ESISTENTE, PARZIALMENTE GOVERNATO
```json
{
  "type": "cta",
  "id": "block_mno",
  "label": "Inizia il dialogo",
  "action": "begin_dialogue",
  "href": "/consulenza"
}
```
- **Editor:** ⚠️ Non esiste UI per aggiungere un blocco CTA nell'editor
- **Renderer pubblico:** ✅ `ProjectDetailPage` renderizza `type === 'cta'`. `MagazineArticlePage` gestisce `type === 'cta'`
- **CTA href:** hardcoded `/start-project` nel renderer di `ProjectDetailPage`
- **Conclusione:** PARZIALE — renderer esiste, editor mancante, href hardcoded

---

## BLOCCHI RICHIESTI DALL'UTENTE — STATO

| Blocco | DB Schema | Editor | Renderer Pubblico | Stato |
|---|---|---|---|---|
| `heading` | ✅ JSONB | ❌ | ❌ | ⚠️ NON PRONTO |
| `paragraph` | ✅ JSONB | ✅ | ✅ | ✅ PRONTO |
| `quote` | ✅ JSONB | ✅ | ✅ | ✅ PRONTO |
| `image` | ✅ JSONB | ✅ | ✅ | ✅ PRONTO |
| `gallery` | ✅ JSONB | ❌ (solo singola img) | ✅ | ⚠️ PARZIALE |
| `youtube` | ✅ JSONB | ❌ | ❌ | ❌ NON PRONTO |
| `CTA` | ✅ JSONB | ❌ | ✅ | ⚠️ PARZIALE |
| `divider` | ✅ JSONB | ❌ | ❌ | ❌ NON PRONTO |

---

## RISPOSTA FINALE

**Nuove tabelle necessarie:** **NO** — `body_blocks JSONB` è sufficiente per tutti i tipi.

**Blocchi pronti per il deploy:** `paragraph`, `quote`, `image` (3/8)  
**Blocchi parziali:** `gallery` (renderer ok, editor no), `CTA` (renderer ok, editor no) (2/8)  
**Blocchi non implementati:** `heading`, `youtube`, `divider` (3/8)

**Per YouTube:** Richiede max 4 ore di implementazione (editor field + renderer `<iframe>`). **Nessuna nuova tabella.**
