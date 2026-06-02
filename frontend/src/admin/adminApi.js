import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const TENANT_SLUG_KEY = 'mood-admin-tenant';
const KEY_KEY         = 'mood-admin-key';
const TOKEN_KEY       = 'mood_auth_token';

export const adminAuth = {
  // Legacy header-based (kept for dev preview where ADMIN_API_KEY=dev).
  getKey:    () => localStorage.getItem(KEY_KEY) || '',
  getTenant: () => localStorage.getItem(TENANT_SLUG_KEY) || 'studio',
  setKey:    (k) => localStorage.setItem(KEY_KEY, k || ''),
  setTenant: (t) => localStorage.setItem(TENANT_SLUG_KEY, t || 'studio'),

  // JWT bearer (production-grade).
  getToken:  () => localStorage.getItem(TOKEN_KEY) || '',
  setToken:  (t) => { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); },

  clear:     () => {
    localStorage.removeItem(KEY_KEY);
    localStorage.removeItem(TENANT_SLUG_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('mood_auth_user');
    localStorage.removeItem('mood_auth_tenant');
    // P0 — also drop the legacy keys written by AccessContinuityPage
    // so a Logout leaves NO zombie auth state in localStorage.
    localStorage.removeItem('mood_jwt');
    localStorage.removeItem('mood_user');
    localStorage.removeItem('mood_tenant');
  },

  // Auth headers — JWT bearer wins, X-Admin-Key is sent as fallback for
  // dev environments where ADMIN_API_KEY is configured.
  headers: () => {
    const h = { 'X-Tenant-Slug': localStorage.getItem(TENANT_SLUG_KEY) || 'studio' };
    const tok = localStorage.getItem(TOKEN_KEY);
    if (tok) {
      h.Authorization = `Bearer ${tok}`;
    }
    const k = localStorage.getItem(KEY_KEY);
    if (k) {
      h['X-Admin-Key'] = k;
    }
    return h;
  },

  // Login via /api/auth/login → stores JWT on success.
  login: async (email, password, tenant_slug = null) => {
    const r = await axios.post(`${BACKEND_URL}/api/auth/login`,
      { email, password, tenant_slug });
    if (r.data?.token) {
      localStorage.setItem(TOKEN_KEY, r.data.token);
      localStorage.setItem('mood_auth_user',   JSON.stringify(r.data.user || {}));
      localStorage.setItem('mood_auth_tenant', JSON.stringify(r.data.tenant || {}));
      localStorage.setItem(TENANT_SLUG_KEY, r.data.tenant?.slug || 'studio');
    }
    return r.data;
  },
};

const headers = () => adminAuth.headers();

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

  // ─── ITER161 — Studio Relations & Advisor Governance ───
  copyManifest:  (namespace, locale = 'it') =>
    axios.get(`${BACKEND_URL}/api/admin/copy/manifest`, {
      params: { namespace, locale }, headers: headers(),
    }),
  consoleSummary: (advisor_id) =>
    axios.get(`${BACKEND_URL}/api/admin/advisor/console-summary`, {
      params: advisor_id ? { advisor_id } : {}, headers: headers(),
    }),
  listRelations: (params = {}) =>
    axios.get(`${BACKEND_URL}/api/admin/relations`, { params, headers: headers() }),
  getRelation: (id) =>
    axios.get(`${BACKEND_URL}/api/admin/relations/${id}`, { headers: headers() }),
  createRelation: (body) =>
    axios.post(`${BACKEND_URL}/api/admin/relations`, body, { headers: headers() }),
  patchRelation: (id, body) =>
    axios.patch(`${BACKEND_URL}/api/admin/relations/${id}`, body, { headers: headers() }),
  verifyIdentity: (body) =>
    axios.post(`${BACKEND_URL}/api/admin/relations/verify-identity`, body, { headers: headers() }),
  openFromRequest: (request_id, body = {}) =>
    axios.post(`${BACKEND_URL}/api/admin/relations/from-request/${request_id}`, body, { headers: headers() }),
  createVisit: (relationId, body) =>
    axios.post(`${BACKEND_URL}/api/admin/relations/${relationId}/visits`, body, { headers: headers() }),
  createFollowup: (relationId, body) =>
    axios.post(`${BACKEND_URL}/api/admin/relations/${relationId}/followups`, body, { headers: headers() }),
  completeFollowup: (followupId, body = {}) =>
    axios.patch(`${BACKEND_URL}/api/admin/followups/${followupId}/complete`, body, { headers: headers() }),
  advisorFollowups: (advisor_id) =>
    axios.get(`${BACKEND_URL}/api/admin/advisor/followups`, {
      params: { advisor_id }, headers: headers(),
    }),
  activateEcosystem: (relationId, body = {}) =>
    axios.post(`${BACKEND_URL}/api/admin/relations/${relationId}/activate-ecosystem`, body, { headers: headers() }),
  commandOverview: () =>
    axios.get(`${BACKEND_URL}/api/admin/command/overview`, { headers: headers() }),
  tenantManifest: (slug) =>
    axios.get(`${BACKEND_URL}/api/admin/tenants/${slug}/manifest`, { headers: headers() }),
  listAdvisors: () =>
    axios.get(`${BACKEND_URL}/api/admin/advisors`, { headers: headers() }),
  createAdvisor: (body) =>
    axios.post(`${BACKEND_URL}/api/admin/advisors`, body, { headers: headers() }),
  updateAdvisor: (profileId, body) =>
    axios.patch(`${BACKEND_URL}/api/admin/advisors/${profileId}`, body, { headers: headers() }),
};
