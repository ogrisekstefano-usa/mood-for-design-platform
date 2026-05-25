/**
 * Real Conversation Engine™ · client SDK · ITER151 Sprint B
 */
import api from './api';
const BASE = '/api/conversation';

/* ── THREADS ──────────────────────────────────────────────────── */
export const listThreads        = ()      => api.get(`${BASE}/threads`);
export const ensureThread       = (body)  => api.post(`${BASE}/threads/ensure`, body || {});
export const getThread          = (id)    => api.get(`${BASE}/threads/${id}`);

/* ── MESSAGES ─────────────────────────────────────────────────── */
export const listMessages       = (threadId, since) =>
  api.get(`${BASE}/threads/${threadId}/messages`, { params: { since } });
export const sendMessage        = (threadId, body) =>
  api.post(`${BASE}/threads/${threadId}/messages`, body);
export const markRead           = (messageId) =>
  api.patch(`${BASE}/messages/${messageId}/read`);
export const markAllRead        = (threadId) =>
  api.post(`${BASE}/threads/${threadId}/mark-all-read`);

/* ── MEMORY / STATUS ──────────────────────────────────────────── */
export const memoryForLead      = (leadId) =>
  api.get(`${BASE}/memory/lead/${leadId}`);
export const myStatus           = () => api.get(`${BASE}/status/me`);
