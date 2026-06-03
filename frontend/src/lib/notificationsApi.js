/**
 * Notifications SDK · M4 Internal Notification Center
 *
 * Wraps /api/notifications endpoints. The legacy `studioOrchestra.js`
 * wrappers (mounted on /api/orchestra-e) remain for backward compat
 * but new code should import from here.
 */
import api from './api';

const BASE = '/api/notifications';

export const listNotifications = ({
  only_unread = false,
  archived = false,
  category,
  since,
  limit = 60,
} = {}) =>
  api.get(`${BASE}/`, {
    params: { only_unread, archived, category, since, limit },
  });

export const unreadCount = () => api.get(`${BASE}/unread-count`);

export const listCategories = () => api.get(`${BASE}/categories`);

export const markRead = (id) => api.patch(`${BASE}/${id}/read`);

export const markAllRead = () => api.post(`${BASE}/mark-all-read`);

export const archive = (id) => api.post(`${BASE}/${id}/archive`);

export const archiveRead = () => api.post(`${BASE}/archive-read`);

export const listPreferences = () => api.get(`${BASE}/preferences`);

export const updatePreference = (categoryKey, in_app_enabled) =>
  api.patch(`${BASE}/preferences/${categoryKey}`, { in_app_enabled });
