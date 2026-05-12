/**
 * Upload helper — uploads a file via Supabase Storage signed URL,
 * then registers metadata with the backend.
 */
import api from './api';

export async function uploadBrandAsset({ kind, file, onProgress }) {
  // Generate filename
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const filename = `${kind}-${Date.now()}.${ext}`;
  const bucket = 'tenant-assets';
  const path = `brand/${filename}`;

  // 1) Get signed upload URL
  const { data: signed } = await api.post('/api/storage/signed-upload', {
    bucket, path,
  });
  const uploadUrl = signed.signed_url;

  // 2) PUT file to signed URL
  const uploadResp = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: file,
  });
  if (!uploadResp.ok) {
    const text = await uploadResp.text();
    throw new Error(`Upload failed: ${uploadResp.status} ${text}`);
  }
  if (onProgress) onProgress(100);

  // 3) Register asset in media_library + theme.assets
  const { data: reg } = await api.post('/api/settings/assets/register', {
    kind, bucket,
    storage_path: signed.path,
    file_name: file.name,
    file_type: file.type,
    file_size: file.size,
  });

  return reg; // { kind, url, assets }
}
