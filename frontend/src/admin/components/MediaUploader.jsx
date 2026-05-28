import React, { useCallback, useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';
import { Upload, X, RotateCcw, Check, Image as ImageIcon } from 'lucide-react';
import {
  cropAndFilterImage, buildFilterString,
  ASPECT_PRESETS, FILTER_PRESETS, FILTER_DEFAULTS,
} from '../utils/cropFilter';

/**
 * MediaUploader — drag/drop or file picker; preview with crop overlay and filter sliders.
 * On confirm, produces a Blob via Canvas and POSTs via uploadFn.
 *
 * Props:
 *   onClose: () => void
 *   onUploaded: (mediaRow) => void     // called after a successful upload
 *   uploadFn:  (FormData) => Promise<{data}>   // typically adminApi.uploadMedia
 *   defaultCategory?: string
 *   sourceMedia?: { file_url, file_name, alt_text, category, mime_type }
 *                — when provided, opens directly in crop/filter mode for an
 *                  existing library asset (used by MediaPicker → "Edit before assign")
 */
const MediaUploader = ({ onClose, onUploaded, uploadFn, defaultCategory = 'site', sourceMedia = null }) => {
  const [file, setFile]         = useState(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [sourceUrl, setSourceUrl] = useState(null); // existing media URL
  const [crop, setCrop]         = useState({ x: 0, y: 0 });
  const [zoom, setZoom]         = useState(1);
  const [aspect, setAspect]     = useState(ASPECT_PRESETS[0].ratio);
  const [aspectKey, setAspectKey] = useState('free');
  const [cropPx, setCropPx]     = useState(null);
  const [mediaSize, setMediaSize] = useState(null); // { width, height, naturalWidth, naturalHeight }
  const [freeW, setFreeW]       = useState(80); // % of container width
  const [freeH, setFreeH]       = useState(80); // % of container height
  const [filters, setFilters]   = useState({ ...FILTER_DEFAULTS });
  const [filterKey, setFilterKey] = useState('none');
  const [alt, setAlt]           = useState(sourceMedia?.alt_text || '');
  const [category, setCategory] = useState(sourceMedia?.category || defaultCategory);
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState(null);

  // Free-crop: convert W%/H% → pixel cropSize relative to the displayed media.
  // react-easy-crop expects cropSize in the same coordinate system as the
  // rendered media (i.e. its fitted container size), and ignores `aspect`
  // when cropSize is set. This is what enables a true unconstrained crop.
  const freeCropSize = (aspectKey === 'free' && mediaSize)
    ? {
        width:  Math.max(20, Math.round(mediaSize.width  * freeW / 100)),
        height: Math.max(20, Math.round(mediaSize.height * freeH / 100)),
      }
    : undefined;

  // If sourceMedia is provided, fetch the image and pre-load it in crop view
  useEffect(() => {
    if (!sourceMedia?.file_url) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(sourceMedia.file_url, { mode: 'cors' });
        const blob = await resp.blob();
        if (cancelled) return;
        const name = sourceMedia.file_name || 'edit.jpg';
        const f = new File([blob], name, { type: blob.type || 'image/jpeg' });
        setFile(f);
        setImageSrc(URL.createObjectURL(blob));
        setSourceUrl(sourceMedia.file_url);
      } catch (e) {
        // CORS fallback: pass URL directly to Cropper (react-easy-crop supports URLs)
        setImageSrc(sourceMedia.file_url);
        setSourceUrl(sourceMedia.file_url);
        setFile({ name: sourceMedia.file_name || 'edit.jpg', type: sourceMedia.mime_type || 'image/jpeg' });
      }
    })();
    return () => { cancelled = true; };
  }, [sourceMedia]);

  const onCropComplete = useCallback((_area, areaPx) => { setCropPx(areaPx); }, []);

  const onPickFile = (f) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) { setErr('Solo immagini supportate.'); return; }
    if (f.size > 25 * 1024 * 1024)    { setErr('File troppo grande (max 25MB).'); return; }
    setErr(null);
    setFile(f);
    const url = URL.createObjectURL(f);
    setImageSrc(url);
    // reset
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setFilters({ ...FILTER_DEFAULTS });
    setFilterKey('none');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    onPickFile(f);
  };

  const applyPreset = (key) => {
    const preset = FILTER_PRESETS.find(p => p.key === key);
    if (preset) { setFilters({ ...preset.values }); setFilterKey(key); }
  };

  const onFilterChange = (k, v) => {
    setFilters((f) => ({ ...f, [k]: Number(v) }));
    setFilterKey('custom');
  };

  const reset = () => {
    setFilters({ ...FILTER_DEFAULTS });
    setFilterKey('none');
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const upload = async () => {
    if (!imageSrc) return;
    setBusy(true); setErr(null);
    try {
      const outputMime = (file?.type === 'image/png') ? 'image/png' : 'image/jpeg';
      const ext = outputMime === 'image/png' ? 'png' : 'jpg';
      let blob;
      // If we have a crop or filters not at default, render canvas; else use original
      const filtersTouched = JSON.stringify(filters) !== JSON.stringify(FILTER_DEFAULTS);
      if (cropPx || filtersTouched) {
        blob = await cropAndFilterImage(imageSrc, cropPx, filters, outputMime, 0.92);
      } else if (file && file instanceof File) {
        blob = file;
      } else {
        // sourceUrl without crop/filter: just register as-is via fetched blob
        const resp = await fetch(imageSrc);
        blob = await resp.blob();
      }
      const fd = new FormData();
      const baseName = file?.name || sourceUrl?.split('/').pop() || `image.${ext}`;
      const safeName = baseName.replace(/\.[^.]+$/, '') + (cropPx || filtersTouched ? '-edited' : '') + `.${ext}`;
      fd.append('file', new File([blob], safeName, { type: outputMime }));
      fd.append('alt_text', alt || '');
      fd.append('category', category || 'site');
      const res = await uploadFn(fd);
      onUploaded?.(res.data);
      onClose?.();
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      data-testid="media-uploader-modal"
    >
      <div
        style={{
          background: '#0A0A0A', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12, width: 'min(1200px, 96vw)', height: 'min(840px, 92vh)',
          display: 'grid', gridTemplateRows: 'auto 1fr auto', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ImageIcon size={18} color="#00C9B3" />
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.05rem',
                          color: '#FFFFFF', letterSpacing: '0.01em', margin: 0 }}>
              {sourceMedia ? 'Modifica fotografia (crop & filtri)' : 'Carica fotografia'}
            </h2>
          </div>
          <button onClick={onClose} className="hover:opacity-70" style={btnIcon} data-testid="uploader-close">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ display: 'grid', gridTemplateColumns: imageSrc ? '1fr 340px' : '1fr',
                      overflow: 'hidden' }}>
          {!imageSrc ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              style={{
                margin: '2rem', border: '1px dashed rgba(255,255,255,0.18)', borderRadius: 12,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.02)', minHeight: 360, cursor: 'pointer',
                gap: 14,
              }}
              onClick={() => document.getElementById('uploader-file-input').click()}
              data-testid="uploader-dropzone"
            >
              <Upload size={36} color="rgba(255,255,255,0.5)" />
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.9rem',
                            color: 'rgba(255,255,255,0.75)' }}>
                Trascina un&apos;immagine qui o clicca per selezionare
              </p>
              <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter, sans-serif' }}>
                JPEG · PNG · WebP · AVIF — max 25MB
              </p>
              <input
                id="uploader-file-input" type="file" accept="image/*"
                onChange={(e) => onPickFile(e.target.files?.[0])}
                style={{ display: 'none' }}
                data-testid="uploader-file-input"
              />
            </div>
          ) : (
            <>
              {/* Cropper */}
              <div style={{ position: 'relative', background: '#000' }}>
                <div style={{ position: 'absolute', inset: 0, filter: buildFilterString(filters) }}>
                  <Cropper
                    image={imageSrc}
                    crop={crop} zoom={zoom}
                    aspect={aspectKey === 'free' ? undefined : aspect}
                    cropSize={freeCropSize}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                    onMediaLoaded={(m) => setMediaSize(m)}
                    objectFit="contain"
                    showGrid={true}
                    style={{ containerStyle: { background: '#000' } }}
                  />
                </div>
              </div>

              {/* Side panel */}
              <div style={{ borderLeft: '1px solid rgba(255,255,255,0.06)',
                              overflowY: 'auto', padding: '1.25rem' }}>
                {/* Aspect ratio */}
                <section style={section}>
                  <label style={lbl}>Proporzioni</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {ASPECT_PRESETS.map(p => (
                      <button
                        key={p.key}
                        onClick={() => { setAspect(p.ratio); setAspectKey(p.key); }}
                        style={{
                          ...chip,
                          background: aspectKey === p.key ? 'rgba(0,201,179,0.18)' : 'rgba(255,255,255,0.04)',
                          color: aspectKey === p.key ? '#00C9B3' : 'rgba(255,255,255,0.75)',
                          borderColor: aspectKey === p.key ? 'rgba(0,201,179,0.4)' : 'rgba(255,255,255,0.1)',
                        }}
                        data-testid={`aspect-${p.key}`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Free-form crop: dedicated W/H sliders (visible only in 'Libero' mode) */}
                  {aspectKey === 'free' && (
                    <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 8,
                                   background: 'rgba(0,201,179,0.06)',
                                   border: '1px solid rgba(0,201,179,0.18)' }}
                          data-testid="free-crop-controls">
                      <p style={{ fontSize: '0.66rem', color: 'rgba(0,201,179,0.85)',
                                    margin: '0 0 10px 0', fontFamily: 'Inter, sans-serif',
                                    letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        Crop libero · trascina la cornice, regola le dimensioni
                      </p>
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between',
                                        fontSize: '0.7rem', color: 'rgba(255,255,255,0.75)',
                                        marginBottom: 4, fontFamily: 'Inter, sans-serif' }}>
                          <span>Larghezza</span><span>{freeW}%</span>
                        </div>
                        <input
                          type="range" min={10} max={100} step={1}
                          value={freeW}
                          onChange={(e) => setFreeW(Number(e.target.value))}
                          style={range}
                          data-testid="free-crop-width"
                        />
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between',
                                        fontSize: '0.7rem', color: 'rgba(255,255,255,0.75)',
                                        marginBottom: 4, fontFamily: 'Inter, sans-serif' }}>
                          <span>Altezza</span><span>{freeH}%</span>
                        </div>
                        <input
                          type="range" min={10} max={100} step={1}
                          value={freeH}
                          onChange={(e) => setFreeH(Number(e.target.value))}
                          style={range}
                          data-testid="free-crop-height"
                        />
                      </div>
                    </div>
                  )}
                </section>

                {/* Zoom */}
                <section style={section}>
                  <label style={lbl}>Zoom · {zoom.toFixed(2)}×</label>
                  <input
                    type="range" min={1} max={4} step={0.01}
                    value={zoom} onChange={(e) => setZoom(Number(e.target.value))}
                    style={range}
                  />
                </section>

                {/* Filter presets */}
                <section style={section}>
                  <label style={lbl}>Preset filtri</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {FILTER_PRESETS.map(p => (
                      <button
                        key={p.key}
                        onClick={() => applyPreset(p.key)}
                        style={{
                          ...chip,
                          background: filterKey === p.key ? 'rgba(0,201,179,0.18)' : 'rgba(255,255,255,0.04)',
                          color: filterKey === p.key ? '#00C9B3' : 'rgba(255,255,255,0.75)',
                          borderColor: filterKey === p.key ? 'rgba(0,201,179,0.4)' : 'rgba(255,255,255,0.1)',
                        }}
                        data-testid={`filter-${p.key}`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Fine controls */}
                <section style={section}>
                  <label style={lbl}>Regolazioni</label>
                  {[
                    ['brightness', 'Luminosità', 50, 150, '%'],
                    ['contrast',   'Contrasto',  50, 150, '%'],
                    ['saturate',   'Saturazione', 0, 200, '%'],
                    ['grayscale',  'B&N',        0, 100, '%'],
                    ['sepia',      'Seppia',     0, 100, '%'],
                    ['blur',       'Sfocatura',  0, 8,   'px'],
                  ].map(([k, label, min, max, unit]) => (
                    <div key={k} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between',
                                      fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)',
                                      marginBottom: 4, fontFamily: 'Inter, sans-serif' }}>
                        <span>{label}</span><span>{filters[k]}{unit}</span>
                      </div>
                      <input
                        type="range" min={min} max={max} step={k === 'blur' ? 0.1 : 1}
                        value={filters[k]}
                        onChange={(e) => onFilterChange(k, e.target.value)}
                        style={range}
                        data-testid={`slider-${k}`}
                      />
                    </div>
                  ))}
                  <button onClick={reset} style={{ ...btnGhost, marginTop: 8 }} data-testid="uploader-reset">
                    <RotateCcw size={12} /> Reset
                  </button>
                </section>

                {/* Metadata */}
                <section style={section}>
                  <label style={lbl}>Testo alternativo</label>
                  <input
                    type="text" value={alt} onChange={(e) => setAlt(e.target.value)}
                    placeholder="Descrizione per accessibilità SEO"
                    style={inp}
                    data-testid="uploader-alt"
                  />
                </section>
                <section style={section}>
                  <label style={lbl}>Categoria</label>
                  <input
                    type="text" value={category} onChange={(e) => setCategory(e.target.value)}
                    placeholder="site"
                    style={inp}
                    data-testid="uploader-category"
                  />
                </section>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '0.85rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: 'rgba(0,0,0,0.6)' }}>
          <div style={{ fontSize: '0.74rem', color: err ? '#ff6b6b' : 'rgba(255,255,255,0.5)',
                          fontFamily: 'Inter, sans-serif' }}>
            {err || (file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Nessuna immagine selezionata')}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={btnGhost} data-testid="uploader-cancel">Annulla</button>
            {imageSrc && (
              <button
                onClick={upload}
                disabled={busy}
                className="btn-pill-teal"
                style={{ padding: '0.55rem 1.1rem', fontSize: '0.78rem',
                            opacity: busy ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                data-testid="uploader-submit"
              >
                <Check size={13} /> {busy ? 'Caricamento…' : 'Carica'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// styles
const section = { marginBottom: 18 };
const lbl = {
  display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em',
  color: 'rgba(255,255,255,0.5)', marginBottom: 8, fontFamily: 'Inter, sans-serif', fontWeight: 500,
};
const chip = {
  fontSize: '0.7rem', padding: '0.34rem 0.65rem', borderRadius: 999, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Inter, sans-serif',
  transition: 'all 0.15s',
};
const range = { width: '100%', accentColor: '#00C9B3', cursor: 'pointer' };
const inp = {
  width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6, padding: '0.55rem 0.75rem', color: '#FFFFFF', fontSize: '0.82rem',
  fontFamily: 'Inter, sans-serif', outline: 'none',
};
const btnIcon = {
  background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
};
const btnGhost = {
  background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
  color: 'rgba(255,255,255,0.85)', borderRadius: 999,
  padding: '0.5rem 1rem', fontSize: '0.78rem', cursor: 'pointer',
  fontFamily: 'Inter, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 6,
};

export default MediaUploader;
