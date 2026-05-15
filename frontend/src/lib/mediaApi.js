/**
 * Media Library — operational asset layer client (Phase N).
 *
 * Direct upload via Supabase signed URL → register_media on /api/storage/media
 * (the only place that handles physical upload). All other CRUD goes through
 * /api/media/*.
 */
import api from './api';

const STORAGE_REGISTER = '/api/storage/media';
const STORAGE_SIGNED   = '/api/storage/signed-upload';

// ── Image probe ───────────────────────────────────────────────────────
function probeImage(file) {
  return new Promise((resolve) => {
    if (!file?.type?.startsWith('image/')) return resolve({});
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const out = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve({}); };
    img.src = url;
  });
}

// ── Upload pipeline ───────────────────────────────────────────────────
export async function uploadMediaFile({
  file,
  bucket = 'tenant-assets',
  folder = 'library',
  category = null,
  tags = [],
  alt_text = null,
  description = null,
  onProgress,
}) {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `${folder}/${filename}`;

  // 1. Signed URL (with size pre-check)
  const { data: signed } = await api.post(STORAGE_SIGNED, {
    bucket, path, file_size: file.size, content_type: file.type,
  });

  // 2. PUT direct
  const resp = await fetch(signed.signed_url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'true' },
    body: file,
  });
  if (!resp.ok) throw new Error(`Upload failed: ${resp.status}`);
  if (onProgress) onProgress(80);

  // 3. Probe dims
  const dims = await probeImage(file);

  // 4. Register row in media_library
  const { data: row } = await api.post(STORAGE_REGISTER, {
    bucket,
    storage_path: signed.path,
    file_name: file.name,
    file_type: file.type,
    file_size: file.size,
    alt_text,
    category,
    tags,
  });

  // 5. Patch dimensions if we have them
  if (dims.width && dims.height) {
    try {
      await api.patch(`/api/media/${row.id}`, {
        width: dims.width, height: dims.height, description,
      });
    } catch (_) { /* non-blocking */ }
  } else if (description) {
    try { await api.patch(`/api/media/${row.id}`, { description }); } catch (_) {}
  }
  if (onProgress) onProgress(100);
  return { ...row, ...dims, description };
}

// ── Media CRUD ────────────────────────────────────────────────────────
export const media = {
  list: (params = {}) => api.get('/api/media', { params }).then(r => r.data),
  stats: () => api.get('/api/media/stats').then(r => r.data),
  detail: (id) => api.get(`/api/media/${id}`).then(r => r.data),
  update: (id, patch) => api.patch(`/api/media/${id}`, patch).then(r => r.data),
  archive: (id) => api.delete(`/api/media/${id}`).then(r => r.data),
  restore: (id) => api.post(`/api/media/${id}/restore`).then(r => r.data),
  replace: (id, body) => api.post(`/api/media/${id}/replace`, body).then(r => r.data),
};

// ── Collections ───────────────────────────────────────────────────────
export const collections = {
  list: () => api.get('/api/media/collections/list').then(r => r.data),
  create: (body) => api.post('/api/media/collections', body).then(r => r.data),
  detail: (id) => api.get(`/api/media/collections/${id}`).then(r => r.data),
  update: (id, patch) => api.patch(`/api/media/collections/${id}`, patch).then(r => r.data),
  archive: (id) => api.delete(`/api/media/collections/${id}`).then(r => r.data),
  attach: (id, asset_ids, note) => api.post(`/api/media/collections/${id}/attach`,
    { asset_ids, note }).then(r => r.data),
  detach: (id, asset_id) => api.delete(`/api/media/collections/${id}/items/${asset_id}`).then(r => r.data),
};

// ── Links ─────────────────────────────────────────────────────────────
export const links = {
  create: (assetId, body) => api.post(`/api/media/${assetId}/links`, body).then(r => r.data),
  remove: (linkId) => api.delete(`/api/media/links/${linkId}`).then(r => r.data),
};

// ── Materials ─────────────────────────────────────────────────────────
export const materials = {
  list: (params = {}) => api.get('/api/media/materials/list', { params }).then(r => r.data),
  create: (body) => api.post('/api/media/materials', body).then(r => r.data),
  detail: (id) => api.get(`/api/media/materials/${id}`).then(r => r.data),
  bySlug: (slug) => api.get(`/api/media/materials/by-slug/${slug}`).then(r => r.data),
  update: (id, patch) => api.patch(`/api/media/materials/${id}`, patch).then(r => r.data),
  archive: (id) => api.delete(`/api/media/materials/${id}`).then(r => r.data),
  attachAsset: (id, body) => api.post(`/api/media/materials/${id}/attach-asset`, body).then(r => r.data),
  detachAsset: (id, attId) => api.delete(`/api/media/materials/${id}/attachments/${attId}`).then(r => r.data),
};
