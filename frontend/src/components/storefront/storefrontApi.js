/**
 * Storefront Studio API client — thin wrapper around axios with token injection.
 */
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api/storefront`;

const authHeaders = () => {
  try {
    const session = JSON.parse(localStorage.getItem('mfd_session') || '{}');
    const token = session?.access_token || session?.token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch { return {}; }
};

export const storefrontApi = {
  registry: () =>
    axios.get(`${API}/admin/registry`, { headers: authHeaders() }).then((r) => r.data),

  listPages: () =>
    axios.get(`${API}/admin/pages`, { headers: authHeaders() }).then((r) => r.data),

  getPage: (pageKey) =>
    axios.get(`${API}/admin/pages/${pageKey}`, { headers: authHeaders() }).then((r) => r.data),

  updatePage: (pageKey, body) =>
    axios.put(`${API}/admin/pages/${pageKey}`, body, { headers: authHeaders() }).then((r) => r.data),

  publishPage: (pageKey) =>
    axios.post(`${API}/admin/pages/${pageKey}/publish`, {}, { headers: authHeaders() }).then((r) => r.data),

  createSection: (pageKey, body) =>
    axios.post(`${API}/admin/pages/${pageKey}/sections`, body, { headers: authHeaders() }).then((r) => r.data),

  updateSection: (sectionId, body) =>
    axios.put(`${API}/admin/sections/${sectionId}`, body, { headers: authHeaders() }).then((r) => r.data),

  deleteSection: (sectionId) =>
    axios.delete(`${API}/admin/sections/${sectionId}`, { headers: authHeaders() }).then((r) => r.data),

  reorderSections: (pageKey, sectionIds) =>
    axios.patch(`${API}/admin/pages/${pageKey}/sections/reorder`, { section_ids: sectionIds },
      { headers: authHeaders() }).then((r) => r.data),

  duplicateSection: (sectionId) =>
    axios.post(`${API}/admin/sections/${sectionId}/duplicate`, {}, { headers: authHeaders() }).then((r) => r.data),

  listAssets: () =>
    axios.get(`${API}/admin/assets`, { headers: authHeaders() }).then((r) => r.data),

  signedUpload: (fileName) =>
    axios.post(`${API}/admin/assets/signed-upload`, { file_name: fileName, bucket: 'tenant-assets' },
      { headers: authHeaders() }).then((r) => r.data),

  registerAsset: (body) =>
    axios.post(`${API}/admin/assets/register`, body, { headers: authHeaders() }).then((r) => r.data),

  updateAsset: (assetId, body) =>
    axios.put(`${API}/admin/assets/${assetId}`, body, { headers: authHeaders() }).then((r) => r.data),

  deleteAsset: (assetId) =>
    axios.delete(`${API}/admin/assets/${assetId}`, { headers: authHeaders() }).then((r) => r.data),

  publicPage: (tenantSlug, pageKey) =>
    axios.get(`${API}/public/${tenantSlug}/pages/${pageKey}`).then((r) => r.data),
};

/** Resolve a locale-keyed field with shared registry fallback chain. */
export const pickLocale = (bag, locale, fallbackChain = []) => {
  if (bag == null) return '';
  if (typeof bag === 'string' || typeof bag === 'number') return bag;
  if (typeof bag !== 'object') return String(bag);
  const chain = [locale, ...fallbackChain, '_default'];
  for (const code of chain) {
    if (bag[code] != null && bag[code] !== '') return bag[code];
  }
  // any non-empty fallback
  const any = Object.values(bag).find((v) => v != null && v !== '');
  return any || '';
};
