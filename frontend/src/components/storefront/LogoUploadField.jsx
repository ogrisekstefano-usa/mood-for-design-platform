/**
 * LogoUploadField — drop-in editor for an image/logo URL with file upload.
 *
 * Replaces the bare URL input. Admin clicks "Carica logo" → picks a file →
 * file is PUT to Supabase Storage via signed-upload, then registered in
 * `cms_assets`. The returned public URL is passed back to the parent via
 * `onChange(url)`.
 *
 * Usage:
 *   <LogoUploadField
 *     value={settings.logo_url}
 *     onChange={(url) => onPatchSettings({ ...settings, logo_url: url })}
 *     label="LOGO HEADER"
 *     testid="nav-top-logo"
 *   />
 */
import React, { useRef, useState } from 'react';
import { UploadCloud, Trash2, Image as ImageIcon, Loader2 } from 'lucide-react';
import { storefrontApi } from './storefrontApi';
import { toast } from 'sonner';

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB

const LogoUploadField = ({ value, onChange, label = 'LOGO', hint = null, testid = 'logo-upload' }) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Carica un file immagine (PNG, JPG, SVG, WebP)');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error(`Il logo deve essere ≤ 2 MB · attuale ${(file.size / (1024 * 1024)).toFixed(1)} MB`);
      return;
    }
    setUploading(true);
    try {
      // 1) Get a signed upload URL.
      const signed = await storefrontApi.signedUpload(file.name);
      // 2) PUT the file directly to Supabase Storage.
      const up = await fetch(signed.signed_url, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'x-upsert': 'true',
        },
        body: file,
      });
      if (!up.ok) {
        const t = await up.text();
        throw new Error(`Upload fallito: ${up.status} ${t.slice(0, 120)}`);
      }
      // 3) Register the asset → returns the canonical public URL.
      const reg = await storefrontApi.registerAsset({
        storage_bucket: signed.bucket,
        storage_path: signed.path,
        alt_text: file.name.replace(/\.[^.]+$/, ''),
      });
      const url = reg.public_url || reg.url || '';
      if (!url) throw new Error('URL pubblico non disponibile dopo upload');
      onChange(url);
      toast.success('Logo caricato');
    } catch (err) {
      toast.error(err.message || 'Upload fallito');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="logo-upload" data-testid={testid}>
      <span className="logo-upload__label">{label}</span>
      <div className="logo-upload__row">
        <div className="logo-upload__preview" data-empty={!value}>
          {value ? (
            <img src={value} alt={label} data-testid={`${testid}-preview`} />
          ) : (
            <ImageIcon size={18} aria-hidden />
          )}
        </div>
        <div className="logo-upload__actions">
          <button
            type="button"
            className="logo-upload__btn logo-upload__btn--primary"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            data-testid={`${testid}-pick`}
          >
            {uploading
              ? <><Loader2 size={13} className="logo-upload__spin" /> Caricamento…</>
              : <><UploadCloud size={14} /> {value ? 'Sostituisci logo' : 'Carica logo'}</>}
          </button>
          {value && !uploading && (
            <button
              type="button"
              className="logo-upload__btn logo-upload__btn--ghost"
              onClick={() => onChange('')}
              data-testid={`${testid}-clear`}
              title="Ripristina il logo di default"
            >
              <Trash2 size={13} /> Rimuovi
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            hidden
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>
      </div>
      {hint ? <p className="logo-upload__hint">{hint}</p> : null}
    </div>
  );
};

export default LogoUploadField;
