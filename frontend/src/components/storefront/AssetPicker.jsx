/**
 * AssetPicker — Supabase Storage upload + library + focal point.
 *
 * Opens as a luxury cinematic drawer (right-side, 480px width).
 * Three tabs: Library (existing assets) · Upload (drag-drop) · Stock (stub).
 */
import React, { useEffect, useRef, useState } from 'react';
import { X, Upload, Image as ImageIcon, Sparkles, Check, Loader2 } from 'lucide-react';
import axios from 'axios';
import { storefrontApi } from './storefrontApi';

const STOCK_PLACEHOLDERS = [
  { id: 'stock-1', url: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1600&q=85', label: 'Editorial · interior amber' },
  { id: 'stock-2', url: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1600&q=85', label: 'Soft daylight · living' },
  { id: 'stock-3', url: 'https://images.unsplash.com/photo-1615875221691-c63d6a4a83a7?auto=format&fit=crop&w=1600&q=85', label: 'Material atelier' },
  { id: 'stock-4', url: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1600&q=85', label: 'Stone wall · texture' },
  { id: 'stock-5', url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1600&q=85', label: 'Resort overlook' },
  { id: 'stock-6', url: 'https://images.unsplash.com/photo-1567016376408-0226e4d0c1ea?auto=format&fit=crop&w=1600&q=85', label: 'Editorial newsletter' },
];

const AssetPicker = ({ open, onClose, onPick, currentUrl }) => {
  const [tab, setTab] = useState('library');
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [error, setError] = useState('');
  const dropRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    storefrontApi.listAssets()
      .then((r) => setAssets(r.assets || []))
      .catch(() => setAssets([]))
      .finally(() => setLoading(false));
  }, [open]);

  const uploadFile = async (file) => {
    if (!file) return;
    try {
      setError('');
      setUploadProgress(5);
      const signed = await storefrontApi.signedUpload(file.name);
      setUploadProgress(20);
      // Upload via signed URL using fetch with multipart? Supabase expects PUT
      await axios.put(signed.signed_url, file, {
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        onUploadProgress: (e) => {
          if (e.total) setUploadProgress(20 + (e.loaded / e.total) * 60);
        },
      });
      setUploadProgress(85);
      // Compute dimensions via Image probe
      const dims = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve({ width: 0, height: 0 });
        img.src = URL.createObjectURL(file);
      });
      // Derive public URL — Supabase storage convention
      const supabaseUrl = process.env.REACT_APP_BACKEND_URL.replace(/\/api.*/, '') || '';
      // Storage public URL: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
      // Backend will fill in actual public_url if we leave empty? Let's let backend compute.
      const registered = await storefrontApi.registerAsset({
        storage_path: signed.path,
        storage_bucket: signed.bucket,
        public_url: '',
        dimensions: { ...dims, mime: file.type, size_bytes: file.size },
        alt_text: {},
      });
      setUploadProgress(100);
      setAssets((prev) => [registered, ...prev]);
      onPick?.(registered);
      setTimeout(() => setUploadProgress(null), 600);
    } catch (e) {
      console.error('Upload failed', e);
      setError(e?.response?.data?.detail || e.message || 'Upload failed');
      setUploadProgress(null);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    dropRef.current?.classList.remove('drop-hover');
    const files = Array.from(e.dataTransfer.files || []);
    if (files[0]) { setTab('upload'); uploadFile(files[0]); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1300] flex" data-testid="asset-picker">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="w-[480px] bg-[var(--bp-surface-1)] border-l border-[var(--bp-border)] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-[var(--bp-border)]">
          <div>
            <p className="text-[var(--bp-primary)] text-[10px] font-body uppercase tracking-[0.2em] font-semibold">Asset Studio</p>
            <h2 className="font-heading text-xl text-[var(--bp-text-primary)] mt-0.5">Image library</h2>
          </div>
          <button onClick={onClose} className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]" data-testid="asset-picker-close">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex gap-1 px-5 pt-4">
          {[
            ['library', 'My assets', ImageIcon],
            ['upload',  'Upload',    Upload],
            ['stock',   'Stock',     Sparkles],
          ].map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              data-testid={`asset-tab-${key}`}
              className={`flex items-center gap-2 px-3 py-2 text-[10px] font-body uppercase tracking-[0.2em] transition-colors ${tab === key ? 'text-[var(--bp-primary)] border-b border-[var(--bp-primary)]' : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-secondary)] border-b border-transparent'}`}
            >
              <Icon size={11} strokeWidth={1.6} /> {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'library' && (
            <div className="grid grid-cols-2 gap-3" data-testid="asset-library">
              {loading && <p className="text-[var(--bp-text-muted)] text-xs col-span-2 text-center py-12">Loading…</p>}
              {!loading && assets.length === 0 && (
                <p className="text-[var(--bp-text-muted)] text-xs font-body col-span-2 text-center py-12 italic">
                  No uploads yet. Drop an image or open the Upload tab.
                </p>
              )}
              {assets.map((a) => (
                <button
                  key={a.id}
                  onClick={() => onPick?.(a)}
                  data-testid={`asset-card-${a.id}`}
                  className="relative group aspect-[4/5] overflow-hidden bg-[var(--bp-surface-2)] border border-[var(--bp-border)] hover:border-[var(--bp-primary)] transition-colors"
                >
                  {a.public_url && (
                    <img src={a.public_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  )}
                  {currentUrl === a.public_url && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-[var(--bp-primary)] rounded-full flex items-center justify-center">
                      <Check size={12} strokeWidth={2.5} className="text-black" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {tab === 'upload' && (
            <div>
              <div
                ref={dropRef}
                onDragOver={(e) => { e.preventDefault(); dropRef.current?.classList.add('drop-hover'); }}
                onDragLeave={() => dropRef.current?.classList.remove('drop-hover')}
                onDrop={onDrop}
                className="border border-dashed border-[var(--bp-border-strong)] py-16 flex flex-col items-center justify-center text-center hover:bg-[var(--bp-surface-2)] transition-colors"
                data-testid="asset-dropzone"
              >
                <Upload size={28} strokeWidth={1.2} className="text-[var(--bp-text-muted)] mb-4" />
                <p className="font-heading text-lg text-[var(--bp-text-primary)] mb-1">Drop an image</p>
                <p className="text-[var(--bp-text-muted)] text-xs font-body">or</p>
                <label className="mt-3 px-4 py-2 text-[10px] font-body uppercase tracking-[0.2em] text-[var(--bp-primary)] cursor-pointer border border-[var(--bp-primary)] hover:bg-[var(--bp-primary)] hover:text-black transition-colors">
                  Browse files
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => uploadFile(e.target.files?.[0])} data-testid="asset-file-input" />
                </label>
                <p className="text-[var(--bp-text-subtle)] text-[10px] font-body mt-4 italic">PNG · JPG · WebP — max 20 MB</p>
              </div>
              {uploadProgress !== null && (
                <div className="mt-4">
                  <div className="h-[2px] bg-[var(--bp-border)] overflow-hidden">
                    <div className="h-full bg-[var(--bp-primary)] transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <p className="text-[var(--bp-text-muted)] text-[10px] font-body uppercase tracking-[0.18em] mt-2 flex items-center gap-2">
                    <Loader2 size={10} className="animate-spin" /> Uploading… {Math.round(uploadProgress)}%
                  </p>
                </div>
              )}
              {error && (
                <p className="text-[#E74C3C] text-xs font-body mt-3" data-testid="asset-upload-error">{error}</p>
              )}
            </div>
          )}

          {tab === 'stock' && (
            <div data-testid="asset-stock">
              <p className="text-[var(--bp-text-muted)] text-xs font-body mb-4 italic">
                Curated editorial library. Click to use directly — saved into your library on first use.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {STOCK_PLACEHOLDERS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onPick?.({ public_url: s.url, alt_text: { _default: s.label }, focal_point: { x: 0.5, y: 0.5 }, id: null })}
                    className="relative aspect-[4/5] overflow-hidden bg-[var(--bp-surface-2)] border border-[var(--bp-border)] hover:border-[var(--bp-primary)] transition-colors"
                    data-testid={`asset-stock-${s.id}`}
                  >
                    <img src={s.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <p className="absolute bottom-2 left-2 right-2 text-white text-[10px] font-body uppercase tracking-[0.15em] text-left">{s.label}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssetPicker;
