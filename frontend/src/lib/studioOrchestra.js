/**
 * Studio Orchestra™ · SDK · ITER153 Sprint E
 * Notifications + Team
 */
import api from './api';
const BASE = '/api/orchestra-e';

/* ── NOTIFICATIONS ──────────────────────────────────────────── */
export const listNotifications  = ({ since, limit = 60, only_unread } = {}) =>
  api.get(`${BASE}/notifications`, { params: { since, limit, only_unread } });
export const unreadCount        = () => api.get(`${BASE}/notifications/unread-count`);
export const markNotifRead      = (id) => api.patch(`${BASE}/notifications/${id}/read`);
export const markAllNotifRead   = ()   => api.post(`${BASE}/notifications/mark-all-read`);

/* ── TEAM ───────────────────────────────────────────────────── */
export const listTeam           = () => api.get(`${BASE}/team`);
export const listTeamRoles      = () => api.get(`${BASE}/team/roles`);
export const addTeamMember      = (body) => api.post(`${BASE}/team`, body);
export const patchTeamMember    = (id, body) => api.patch(`${BASE}/team/${id}`, body);
export const removeTeamMember   = (id) => api.delete(`${BASE}/team/${id}`);
