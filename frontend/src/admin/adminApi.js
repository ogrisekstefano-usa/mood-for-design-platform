import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const TENANT_SLUG_KEY = 'mood-admin-tenant';
const KEY_KEY         = 'mood-admin-key';

export const adminAuth = {
  getKey:    () => localStorage.getItem(KEY_KEY) || '',
  getTenant: () => localStorage.getItem(TENANT_SLUG_KEY) || 'studio',
  setKey:    (k) => localStorage.setItem(KEY_KEY, k || ''),
  setTenant: (t) => localStorage.setItem(TENANT_SLUG_KEY, t || 'studio'),
  clear:     () => {
    localStorage.removeItem(KEY_KEY);
    localStorage.removeItem(TENANT_SLUG_KEY);
  },
  headers:   () => ({
    'X-Admin-Key':   localStorage.getItem(KEY_KEY) || '',
    'X-Tenant-Slug': localStorage.getItem(TENANT_SLUG_KEY) || 'studio',
  }),
};

const headers = () => ({
  'X-Admin-Key':   adminAuth.getKey(),
  'X-Tenant-Slug': adminAuth.getTenant(),
});

const client = axios.create({ baseURL: `${BACKEND_URL}/api/admin/site` });

client.interceptors.request.use((cfg) => {
  cfg.headers = { ...cfg.headers, ...headers() };
  return cfg;
});

export const adminApi = {
  whoami:        () => client.get('/whoami'),
  locales:       () => client.get('/locales'),

  // Blocks
  listBlocks:    (namespace) => client.get('/blocks', { params: { namespace } }),
  getBlock:      (namespace, block_key) => client.get('/blocks/by-key', { params: { namespace, block_key } }),
  upsertBlock:   (body) => client.put('/blocks', body),

  // Sections
  listSections:  (page_slug = 'home') => client.get('/sections', { params: { page_slug } }),
  createSection: (body) => client.post('/sections', body),
  patchSection:  (id, body) => client.patch(`/sections/${id}`, body),
  deleteSection: (id) => client.delete(`/sections/${id}`),
  reorderSections: (ordered_ids) => client.post('/sections/reorder', { ordered_ids }),

  // Pages
  listPages:        () => client.get('/pages'),
  getPageContent:   (pageKey) => client.get(`/page-content/${pageKey}`),
  setSectionMedia:  (sectionId, slot, mediaId) =>
    client.put(`/sections/${sectionId}/media-slot`, { slot, media_id: mediaId }),
  getMediaUsages:   () => client.get('/media-usages'),

  // SEO meta (per-locale title / description / og_image)
  getPageSEO:       (pageKey) => client.get(`/pages/${pageKey}/seo`),
  updatePageSEO:    (pageKey, body) => client.put(`/pages/${pageKey}/seo`, body),

  // Footer (global, multi-language)
  getFooter:        (locale = 'it') => client.get('/footer', { params: { locale } }),
  updateFooter:     (body, locale = 'it') => client.put('/footer', body, { params: { locale } }),

  // AI translate (uses /api/ai/editorial/translate, with admin headers)
  translate: (sourceText, sourceLocale, targetLocale) =>
    axios.post(
      `${BACKEND_URL}/api/ai/editorial/translate`,
      { source_text: sourceText, source_locale: sourceLocale, target_locale: targetLocale, register: 'editorial' },
      { headers: headers() },
    ),

  // Media
  listMedia:     (category) => client.get('/media', { params: { category } }),
  registerMedia: (body) => client.post('/media/register', body),
  uploadMedia:   (formData) => client.post('/media/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteMedia:   (id) => client.delete(`/media/${id}`),

  // Publish
  publish:       (slug) => client.post(`/pages/${slug}/publish`),
  unpublish:     (slug) => client.post(`/pages/${slug}/unpublish`),

  // Cache
  invalidate:    () => client.post('/cache/invalidate'),
};
