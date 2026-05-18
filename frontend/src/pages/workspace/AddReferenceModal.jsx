/**
 * AddReferenceModal — Pinterest Research™ Add Flow
 * ────────────────────────────────────────────────────────────────────
 * Cultural Design Intelligence™ ingestion modal.
 *
 *   • Upload manuale (file → Supabase Storage)
 *   • Pinterest URL (saves URL only — NO scraping in P0)
 *   • Da Media Library (link an existing asset)
 *
 * After upload/select the reference is sent to
 *   POST /api/references  { imported_image_url, source_url, source_type,
 *                           curator_name, design_intent, advisor_notes,
 *                           locale_origin, project_id }
 *
 * The backend triggers `_interpret_and_store` automatically (Cultural
 * Design Intelligence pipeline) before responding.
 */
import React, { useState, useRef } from 'react';
import { X, Upload, Link2, Library, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { uploadMediaFile } from '../../lib/mediaApi';
import AssetPickerModal from '../settings/AssetPickerModal';

const TAG_VOCABULARY = [
  'mood', 'material', 'hospitality', 'color', 'era',
  'mediterranean', 'mid-century', 'minimalism', 'maximalism',
  'natural-light', 'sculptural-stone', 'soft-textile', 'warm-wood',
];

const AddReferenceModal = ({ open, onClose, onCreated, projects = [] }) => {
  const [source, setSource] = useState('upload'); // upload | pinterest | library
  const [pinUrl, setPinUrl] = useState('');
  const [importedUrl, setImportedUrl] = useState(''); // resolved after upload/library
  const [filePreview, setFilePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [curator, setCurator] = useState('');
  const [intent, setIntent] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  if (!open) return null;

  const reset = () => {
    setSource('upload'); setPinUrl(''); setImportedUrl(''); setFilePreview(null);
    setUploading(false); setProgress(0); setCurator(''); setIntent('');
    setNotes(''); setTags([]); setProjectId(''); setError(null); setSaving(false);
  };

  const close = () => { reset(); onClose?.(); };

  const handleFile = async (file) => {
    if (!file?.type?.startsWith('image/')) {
      setError('Carica solo immagini (jpg, png, webp, heic)');
      return;
    }
    setUploading(true);
    setProgress(5);
    setError(null);
    setFilePreview(URL.createObjectURL(file));
    try {
      const asset = await uploadMediaFile({
        file,
        bucket: 'tenant-assets',
        folder: 'references/pinterest',
        category: 'pinterest_research',
        tags: ['pinterest_research', ...tags],
        onProgress: (p) => setProgress(Math.max(p, 10)),
      });
      setImportedUrl(asset.file_url);
      setProgress(100);
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Upload fallito');
      setFilePreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleLibraryPicked = ({ asset }) => {
    setImportedUrl(asset?.display_url || asset?.file_url || '');
    setFilePreview(asset?.display_url || asset?.file_url || null);
    setPickerOpen(false);
  };

  const toggleTag = (t) => {
    setTags((curr) => curr.includes(t) ? curr.filter((x) => x !== t) : [...curr, t]);
  };

  const canSubmit = () => {
    if (source === 'pinterest') return !!pinUrl.trim() && !saving;
    return !!importedUrl && !uploading && !saving;
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      let payloadImageUrl = importedUrl;
      let payloadSourceUrl = null;
      let payloadSourceType = 'upload';

      if (source === 'pinterest') {
        // P0: no scraping — use pin URL itself as both source + imported_image_url.
        // The backend accepts external URL strings.
        payloadImageUrl = pinUrl.trim();
        payloadSourceUrl = pinUrl.trim();
        payloadSourceType = 'pinterest';
      } else if (source === 'library') {
        payloadSourceType = 'media_library';
      } else {
        payloadSourceType = 'upload';
      }

      const body = {
        imported_image_url: payloadImageUrl,
        source_url: payloadSourceUrl,
        source_type: payloadSourceType,
        curator_name: curator || null,
        design_intent: intent || null,
        advisor_notes: [
          notes || null,
          tags.length ? `Tags: ${tags.join(', ')}` : null,
        ].filter(Boolean).join('\n\n') || null,
        project_id: projectId || null,
      };
      const r = await api.post('/api/references', body);
      toast.success('Riferimento aggiunto · interpretazione editoriale in corso');
      onCreated?.(r.data?.reference);
      close();
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Salvataggio fallito';
      setError(typeof msg === 'string' ? msg : 'Salvataggio fallito');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      data-testid="add-reference-modal"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 overflow-y-auto"
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-[var(--bp-surface-elevated)] border border-[var(--bp-border)] rounded-[16px] shadow-2xl my-8 flex flex-col max-h-[calc(100vh-4rem)]"
      >
        {/* Header (sticky) */}
        <header className="flex items-start justify-between px-7 pt-7 pb-5 border-b border-[var(--bp-border)] flex-shrink-0 bg-[var(--bp-surface-elevated)] rounded-t-[16px]">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--bp-primary)] font-body font-medium mb-1.5">
              Pinterest Research™
            </p>
            <h2 className="text-[24px] font-heading text-[var(--bp-text-primary)] leading-tight">
              Aggiungi un riferimento
            </h2>
            <p className="text-[12.5px] text-[var(--bp-text-muted)] font-body mt-1.5 italic max-w-md">
              Ogni riferimento entra nella Cultural Design Intelligence™ · interpretato attraverso il mercato di destinazione.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            data-testid="add-reference-close"
            className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] transition-colors"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </header>

        {/* Source tabs */}
        <div className="px-7 pt-5 flex-shrink-0">
          <div className="flex gap-1 p-1 rounded-[10px] bg-[var(--bp-surface-1)] border border-[var(--bp-border)]">
            {[
              ['upload', 'Upload manuale', Upload],
              ['pinterest', 'URL Pinterest', Link2],
              ['library', 'Media Library', Library],
            ].map(([id, label, Icon]) => {
              const active = source === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setSource(id); setImportedUrl(''); setFilePreview(null); setError(null); }}
                  data-testid={`add-reference-source-${id}`}
                  className={`flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-[7px] text-[12.5px] font-body transition-colors ${
                    active
                      ? 'bg-[var(--bp-primary-soft)] text-[var(--bp-primary)] border border-[var(--bp-border-active)]'
                      : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] border border-transparent'
                  }`}
                >
                  <Icon size={12} strokeWidth={1.6} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable body wrapper */}
        <div className="flex-1 overflow-y-auto">
        {/* Source body */}
        <div className="px-7 py-6">
          {source === 'upload' && (
            <div data-testid="add-reference-upload-body">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
                disabled={uploading}
                data-testid="add-reference-upload-zone"
                className="w-full aspect-[16/9] rounded-[12px] border border-dashed border-[var(--bp-border-strong)] bg-[var(--bp-surface-1)]
                           hover:border-[var(--bp-primary)] hover:bg-[var(--bp-primary-soft)] transition-all
                           flex flex-col items-center justify-center gap-3 text-[var(--bp-text-muted)] relative overflow-hidden"
              >
                {filePreview ? (
                  <img src={filePreview} alt="" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <>
                    <Upload size={26} strokeWidth={1.3} />
                    <p className="text-[13px] font-body">Trascina · oppure clicca per scegliere</p>
                    <p className="text-[10.5px] font-body text-[var(--bp-text-faint)]">jpg · png · webp · heic</p>
                  </>
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3">
                    <Loader2 size={22} className="animate-spin text-[var(--bp-primary)]" />
                    <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-[var(--bp-primary)]">{progress}%</p>
                  </div>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
                data-testid="add-reference-file-input"
              />
            </div>
          )}

          {source === 'pinterest' && (
            <div data-testid="add-reference-pinterest-body" className="space-y-3">
              <label className="block text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-faint)] font-body">
                URL del pin
              </label>
              <input
                type="url"
                value={pinUrl}
                onChange={(e) => setPinUrl(e.target.value)}
                placeholder="https://pinterest.com/pin/…"
                data-testid="add-reference-pinterest-input"
                className="w-full bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[8px] py-2.5 px-3 text-[14px]
                           text-[var(--bp-text-primary)] focus:outline-none focus:border-[var(--bp-border-hover)] font-body"
              />
              <p className="text-[11px] text-[var(--bp-text-faint)] font-body italic leading-relaxed">
                Stiamo salvando l'URL del pin. Scraping automatico (titolo · immagine · descrizione) arriverà in Fase P2 con l'integrazione Pinterest API ufficiale.
              </p>
            </div>
          )}

          {source === 'library' && (
            <div data-testid="add-reference-library-body" className="space-y-3">
              {filePreview ? (
                <div className="aspect-[16/9] rounded-[12px] overflow-hidden border border-[var(--bp-border-active)] bg-[var(--bp-surface-1)]">
                  <img src={filePreview} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  data-testid="add-reference-library-open"
                  className="w-full aspect-[16/9] rounded-[12px] border border-dashed border-[var(--bp-border-strong)] bg-[var(--bp-surface-1)]
                             hover:border-[var(--bp-primary)] hover:bg-[var(--bp-primary-soft)] transition-all
                             flex flex-col items-center justify-center gap-3 text-[var(--bp-text-muted)]"
                >
                  <Library size={26} strokeWidth={1.3} />
                  <p className="text-[13px] font-body">Sfoglia la Media Library</p>
                </button>
              )}
              {filePreview && (
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="text-[11px] font-body text-[var(--bp-text-muted)] hover:text-[var(--bp-primary)] transition-colors"
                >
                  Cambia asset…
                </button>
              )}
            </div>
          )}
        </div>

        {/* Metadata (always visible) */}
        <div className="px-7 pb-6 space-y-5 border-t border-[var(--bp-border)] pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-faint)] font-body mb-1.5">
                Curatore (opzionale)
              </label>
              <input
                type="text"
                value={curator}
                onChange={(e) => setCurator(e.target.value)}
                placeholder="Es. Giulia Ferri"
                data-testid="add-reference-curator"
                className="w-full bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[7px] py-2 px-3 text-[13px]
                           text-[var(--bp-text-primary)] focus:outline-none focus:border-[var(--bp-border-hover)] font-body"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-faint)] font-body mb-1.5">
                Progetto collegato (opzionale)
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                data-testid="add-reference-project"
                className="w-full bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[7px] py-2 px-3 text-[13px]
                           text-[var(--bp-text-primary)] focus:outline-none focus:border-[var(--bp-border-hover)] font-body cursor-pointer"
              >
                <option value="">— Nessun progetto —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title || p.name || p.id.slice(0, 8)}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-faint)] font-body mb-1.5">
              Design intent (opzionale)
            </label>
            <input
              type="text"
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              placeholder="Es. Hospitality emotion · Material atmosphere"
              data-testid="add-reference-intent"
              className="w-full bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[7px] py-2 px-3 text-[13px]
                         text-[var(--bp-text-primary)] focus:outline-none focus:border-[var(--bp-border-hover)] font-body"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-faint)] font-body mb-1.5">
              Tag tematici
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TAG_VOCABULARY.map((t) => {
                const active = tags.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag(t)}
                    data-testid={`add-reference-tag-${t}`}
                    className={`text-[11px] font-body px-2.5 py-1 rounded-full transition-colors ${
                      active
                        ? 'bg-[var(--bp-primary)] text-black border border-[var(--bp-primary)]'
                        : 'bg-[var(--bp-surface-1)] text-[var(--bp-text-muted)] border border-[var(--bp-border)] hover:border-[var(--bp-border-hover)]'
                    }`}
                  >
                    #{t}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-faint)] font-body mb-1.5">
              Note dell'advisor (opzionale)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Perché questo riferimento entra nell'archivio?"
              data-testid="add-reference-notes"
              className="w-full bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[7px] py-2 px-3 text-[13px]
                         text-[var(--bp-text-primary)] focus:outline-none focus:border-[var(--bp-border-hover)] font-body resize-none"
            />
          </div>

          {error && (
            <p className="text-[12px] text-red-400 font-body flex items-center gap-1.5">
              <AlertCircle size={12} strokeWidth={1.8} /> {error}
            </p>
          )}
        </div>
        </div>{/* /scrollable body wrapper */}

        {/* Footer (sticky) */}
        <footer className="flex items-center justify-between px-7 py-5 border-t border-[var(--bp-border)] bg-[var(--bp-surface-1)] rounded-b-[16px] flex-shrink-0">
          <div className="text-[11px] text-[var(--bp-text-faint)] font-body flex items-center gap-1.5 italic">
            <Sparkles size={11} className="text-[var(--bp-primary)]" />
            Cultural reading generata automaticamente
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={close}
              className="px-3 py-2 text-[12px] font-body text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] transition-colors"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit()}
              data-testid="add-reference-submit"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[8px] bg-[var(--bp-primary)] text-black
                         hover:opacity-90 transition-opacity text-[12.5px] font-body font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {saving ? 'Salvataggio…' : 'Aggiungi al research room'}
            </button>
          </div>
        </footer>
      </div>

      {pickerOpen && (
        <AssetPickerModal
          open
          onClose={() => setPickerOpen(false)}
          onSelect={handleLibraryPicked}
          entityType="design_reference"
          bucket="tenant-assets"
          folder="references/pinterest"
          title="Scegli un asset dalla Library"
          eyebrow="PINTEREST RESEARCH"
          defaultTab="library"
        />
      )}
    </div>
  );
};

export default AddReferenceModal;
