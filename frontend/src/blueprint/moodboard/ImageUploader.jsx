/**
 * ImageUploader — drag/drop + click upload to Supabase Storage `moodboard-assets`.
 *
 * Flow:
 *   1. POST /api/storage/signed-upload  {bucket, path} → {signed_url, token, path}
 *   2. PUT the file directly to signed_url (browser → Supabase Storage, bypasses backend)
 *   3. POST /api/storage/media  {bucket, storage_path, file_name, file_type, file_size,
 *                                category:'moodboard'} → media_library row + public URL
 *   4. parent receives the resulting URL and patches the block content.src
 *
 * Pure Blueprint-driven (all labels via t()).
 */
import React, { useRef, useState, useCallback } from 'react';
import api from '../../lib/api';
import { Upload, AlertCircle, Loader2 } from 'lucide-react';

const BUCKET = 'moodboard-assets';

const ImageUploader = ({ currentUrl, onUploaded, t }) => {
  const inputRef = useRef();
  const [state, setState] = useState('idle'); // idle | uploading | error
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const upload = useCallback(async (file) => {
    if (!file || !file.type?.startsWith('image/')) return;
    setState('uploading');
    setError(null);
    setProgress(5);
    try {
      // 0. Pre-extract original dimensions (best-effort) so they can be
      //    persisted into metadata_json alongside the upload.
      const dims = await new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
        img.src = url;
      });

      const ext = file.name.split('.').pop() || 'bin';
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const path = `moodboards/${safeName}`;

      // 1. Get signed upload URL — file_size enables pre-flight storage quota
      const sign = await api.post('/api/storage/signed-upload', {
        bucket: BUCKET, path, file_size: file.size, content_type: file.type,
      });
      const { signed_url, token, path: serverPath } = sign.data;
      setProgress(20);

      // 2. PUT direct to Supabase Storage
      await fetch(signed_url, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
          'x-upsert': 'false',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: file,
      }).then((r) => { if (!r.ok) throw new Error(`Upload failed: ${r.status}`); });
      setProgress(70);

      // 3. Register in media_library + get public URL
      const reg = await api.post('/api/storage/media', {
        bucket: BUCKET,
        storage_path: serverPath,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        category: 'moodboard',
      });
      setProgress(100);
      onUploaded(reg.data.file_url, {
        upload_source: 'user_upload',
        original_dimensions: dims,
        media_id: reg.data.id,
        storage_path: serverPath,
        file_name: file.name,
        uploaded_at: new Date().toISOString(),
      });
      setTimeout(() => setState('idle'), 300);
    } catch (e) {
      setState('error');
      const detail = e?.response?.data?.detail;
      // License-aware error formatting for storage quota
      if (detail && typeof detail === 'object' && detail.code === 'LICENSE_LIMIT_REACHED') {
        setError(`Storage limit reached (${detail.current}/${detail.limit} GB). Upgrade your ${detail.plan} plan.`);
      } else {
        setError(typeof detail === 'string' ? detail : (e?.message || 'Upload failed'));
      }
    }
  }, [onUploaded]);

  const onFileSelect = (e) => {
    const f = e.target.files?.[0];
    if (f) upload(f);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) upload(f);
  };

  return (
    <div className="mb-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileSelect}
        data-testid="inspector-image-file-input"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        data-testid="image-uploader-trigger"
        disabled={state === 'uploading'}
        className={`w-full px-3 py-4 border border-dashed rounded-[var(--bp-radius-sm)] text-center transition-all ${
          dragOver
            ? 'border-[var(--bp-primary)] bg-[var(--bp-primary)]/5'
            : 'border-[var(--bp-border)] hover:border-[var(--bp-border-strong)]'
        } ${state === 'error' ? 'border-red-400/40 bg-red-500/5' : ''}`}
      >
        {state === 'uploading' ? (
          <div className="flex flex-col items-center gap-2" data-testid="image-uploader-uploading">
            <Loader2 size={16} className="animate-spin text-[var(--bp-primary)]" />
            <span className="bp-caption text-[var(--bp-text-muted)]">{t('moodboards.editor.uploading')}</span>
            <div className="w-full h-0.5 bg-[var(--bp-surface-2)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--bp-primary)] transition-all duration-300"
                   style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : state === 'error' ? (
          <div className="flex flex-col items-center gap-1.5">
            <AlertCircle size={13} className="text-red-400" />
            <span className="bp-caption !text-red-400">{t('moodboards.editor.uploadFailed')}</span>
            {error && <span className="bp-caption !text-[10px] text-[var(--bp-text-muted)]">{error}</span>}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <Upload size={14} strokeWidth={1.5} className="text-[var(--bp-text-muted)]" />
            <span className="bp-caption text-[var(--bp-text-muted)]">{t('moodboards.editor.dropImage')}</span>
          </div>
        )}
      </button>
    </div>
  );
};

export default ImageUploader;
