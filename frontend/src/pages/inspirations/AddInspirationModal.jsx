/**
 * AddInspirationModal — Unified "Aggiungi riferimento" flow.
 *
 * Una sola entry point. ZERO menzioni "Pinterest Research™".
 *
 * Tre modi di aggiungere:
 *   1. Upload diretto (registra in Media Library + tag inspiration)
 *   2. URL Pinterest / Instagram (salva URL, prova og:image lato server)
 *   3. URL immagine generica
 *
 * Linguaggio editoriale italiano. Drag&drop nativo.
 */
import React, { useRef, useState } from 'react';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';

const AddInspirationModal = ({ open, onClose, onImported, config }) => {
  const [mode, setMode] = useState('url'); // 'url' | 'upload'
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [atmosphereTags, setAtmosphereTags] = useState([]);
  const [materialTags, setMaterialTags] = useState([]);
  const [luxuryLevel, setLuxuryLevel] = useState('');
  const [hospitalityProfile, setHospitalityProfile] = useState('');
  const [marketCodes, setMarketCodes] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef(null);

  const reset = () => {
    setMode('url'); setUrl(''); setTitle(''); setDescription('');
    setAtmosphereTags([]); setMaterialTags([]); setLuxuryLevel('');
    setHospitalityProfile(''); setMarketCodes([]);
  };

  const close = () => { if (!submitting) { reset(); onClose?.(); } };

  const toggle = (arr, setArr, val) => {
    setArr(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  const submitUrl = async () => {
    if (!url.trim()) {
      toast.error('Inserisci un URL valido');
      return;
    }
    setSubmitting(true);
    try {
      const r = await api.post('/api/inspirations/archive/import', {
        url: url.trim(),
        title: title || null,
        description: description || null,
        atmosphere_tags: atmosphereTags,
        material_tags: materialTags,
        luxury_level: luxuryLevel || null,
        hospitality_profile: hospitalityProfile || null,
        market_codes: marketCodes,
      });
      onImported?.(r.data);
      reset();
    } catch (e) {
      toast.error(asErrorString(e, 'Non è stato possibile salvare il riferimento'));
    } finally { setSubmitting(false); }
  };

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) {
      toast.error('Carica un\'immagine (JPG, PNG, WebP)');
      return;
    }
    setSubmitting(true);
    try {
      // 1) Get signed upload URL
      const ext = file.name.split('.').pop().toLowerCase();
      const sp = `inspirations/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
      const su = await api.post('/api/storage/signed-upload', {
        bucket: 'media-library', storage_path: sp,
        content_type: file.type, file_size: file.size,
      });
      // 2) Upload file to Supabase via signed URL
      const signed = su.data?.signed_url || su.data?.url;
      if (signed) {
        await fetch(signed, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      }
      // 3) Register media in DB
      const reg = await api.post('/api/storage/media', {
        bucket: 'media-library', storage_path: sp,
        file_name: file.name, file_type: file.type, file_size: file.size,
        alt_text: title || file.name, category: 'inspiration', tags: ['inspiration'],
      });
      // 4) Promote to Inspiration with the editorial metadata
      const r = await api.post('/api/inspirations/archive/import', {
        media_id: reg.data?.id || reg.data?.media?.id,
        title: title || file.name,
        description: description || null,
        atmosphere_tags: atmosphereTags,
        material_tags: materialTags,
        luxury_level: luxuryLevel || null,
        hospitality_profile: hospitalityProfile || null,
        market_codes: marketCodes,
      });
      onImported?.(r.data);
      reset();
    } catch (e) {
      console.error(e);
      toast.error(asErrorString(e, 'Upload fallito'));
    } finally { setSubmitting(false); }
  };

  if (!open) return null;
  const atmos = config?.atmosphere_tags || [];
  const mats  = config?.material_tags || [];
  const luxs  = config?.luxury_levels || [];
  const profs = config?.hospitality_profiles || [];
  const mks   = config?.markets || [];

  return (
    <div className="ins-backdrop" onClick={(e) => { if (e.target === e.currentTarget) close(); }}
         data-testid="add-inspiration-backdrop">
      <div className="ins-modal" data-testid="add-inspiration-modal">
        <button type="button" className="ins-modal__close" onClick={close} aria-label="Chiudi"
                data-testid="add-inspiration-close">
          <Icons.X size={16} />
        </button>
        <header className="ins-modal__head">
          <p className="ins-eyebrow">Inspirations™</p>
          <h2 className="ins-modal__title">Aggiungi riferimento</h2>
          <p className="ins-modal__lede">
            Carica un'immagine, oppure incolla un link Pinterest, Instagram o qualunque URL.
            MOOD lo aggiunge alla Media Library e lo rende disponibile in tutto il sistema.
          </p>
        </header>

        <div className="ins-tabs">
          <button type="button"
                  className={`ins-tab ${mode === 'url' ? 'ins-tab--on' : ''}`}
                  onClick={() => setMode('url')}
                  data-testid="add-inspiration-tab-url">
            <Icons.Link2 size={12} /> Link
          </button>
          <button type="button"
                  className={`ins-tab ${mode === 'upload' ? 'ins-tab--on' : ''}`}
                  onClick={() => setMode('upload')}
                  data-testid="add-inspiration-tab-upload">
            <Icons.Upload size={12} /> Carica file
          </button>
        </div>

        <div className="ins-modal__body">
          {mode === 'url' && (
            <div className="ins-field" data-testid="add-inspiration-url-panel">
              <label className="ins-label">URL della reference</label>
              <input
                type="url"
                className="ins-input"
                placeholder="https://pinterest.com/pin/… · https://instagram.com/p/… · qualunque URL immagine"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={submitting}
                data-testid="add-inspiration-url"
              />
              <p className="ins-hint">
                Pinterest, Instagram o link diretto. MOOD prova a estrarre l'immagine principale —
                se non riesce, salva comunque il link e potrai aggiornare la copertina più tardi.
              </p>
            </div>
          )}

          {mode === 'upload' && (
            <div
              className={`ins-drop ${dragOver ? 'ins-drop--over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
              onClick={() => fileInput.current?.click()}
              data-testid="add-inspiration-drop">
              <Icons.UploadCloud size={26} strokeWidth={1.2} />
              <p className="ins-drop__title">Trascina un'immagine o clicca per caricare</p>
              <p className="ins-drop__hint">JPG · PNG · WebP — fino a 10MB</p>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => handleFiles(e.target.files)}
                disabled={submitting}
                data-testid="add-inspiration-file"
              />
            </div>
          )}

          <div className="ins-modal__grid">
            <div className="ins-field">
              <label className="ins-label">Titolo (opzionale)</label>
              <input type="text" className="ins-input" placeholder="Es. Salotto materico, palette neutra"
                     value={title} onChange={(e) => setTitle(e.target.value)} disabled={submitting}
                     data-testid="add-inspiration-title" />
            </div>
            <div className="ins-field">
              <label className="ins-label">Descrizione editoriale (opzionale)</label>
              <textarea className="ins-textarea" rows={2}
                        placeholder="Cosa ti ha colpito di questa reference?"
                        value={description} onChange={(e) => setDescription(e.target.value)}
                        disabled={submitting}
                        data-testid="add-inspiration-desc" />
            </div>
          </div>

          <div className="ins-modal__section">
            <p className="ins-label">Atmosfera</p>
            <div className="ins-chips-row">
              {atmos.map((t) => (
                <button key={t.key} type="button"
                        className={`ins-chip-toggle ${atmosphereTags.includes(t.key) ? 'ins-chip-toggle--on' : ''}`}
                        onClick={() => toggle(atmosphereTags, setAtmosphereTags, t.key)}
                        data-testid={`add-insp-atmos-${t.key}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ins-modal__section">
            <p className="ins-label">Materia principale</p>
            <div className="ins-chips-row">
              {mats.map((t) => (
                <button key={t.key} type="button"
                        className={`ins-chip-toggle ${materialTags.includes(t.key) ? 'ins-chip-toggle--on' : ''}`}
                        onClick={() => toggle(materialTags, setMaterialTags, t.key)}
                        data-testid={`add-insp-mat-${t.key}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ins-modal__grid">
            <div className="ins-field">
              <label className="ins-label">Tono luxury</label>
              <select className="ins-input" value={luxuryLevel}
                      onChange={(e) => setLuxuryLevel(e.target.value)} disabled={submitting}>
                <option value="">—</option>
                {luxs.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </div>
            <div className="ins-field">
              <label className="ins-label">Destinazione</label>
              <select className="ins-input" value={hospitalityProfile}
                      onChange={(e) => setHospitalityProfile(e.target.value)} disabled={submitting}>
                <option value="">—</option>
                {profs.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div className="ins-modal__section">
            <p className="ins-label">Mercati di interesse (opzionale)</p>
            <div className="ins-chips-row">
              {mks.map((m) => (
                <button key={m.code} type="button"
                        className={`ins-chip-toggle ${marketCodes.includes(m.code) ? 'ins-chip-toggle--on' : ''}`}
                        onClick={() => toggle(marketCodes, setMarketCodes, m.code)}
                        data-testid={`add-insp-market-${m.code}`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <footer className="ins-modal__foot">
          <button type="button" className="ins-btn ins-btn--ghost" onClick={close} disabled={submitting}
                  data-testid="add-inspiration-cancel">
            Annulla
          </button>
          {mode === 'url' && (
            <button type="button" className="ins-btn ins-btn--primary"
                    onClick={submitUrl} disabled={submitting || !url.trim()}
                    data-testid="add-inspiration-submit-url">
              {submitting ? 'Salvataggio…' : 'Aggiungi a Inspirations™'}
              {!submitting && <Icons.ArrowRight size={13} />}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};

export default AddInspirationModal;
