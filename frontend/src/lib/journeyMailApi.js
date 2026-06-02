/**
 * Journey Mail Workspace API client — ITER187.B Phase 1.
 * Wraps the 13 endpoints exposed by /api/journey-mail.
 * Backend: /app/backend/routers/journey_mail.py (ITER187.A).
 */
import api from './api';

const BASE = '/api/journey-mail';

// ─── Mailboxes ──────────────────────────────────────────────────────
export const listMailboxes = () => api.get(`${BASE}/mailboxes`);
export const createMailbox = (payload) => api.post(`${BASE}/mailboxes`, payload);
export const getMailbox = (id) => api.get(`${BASE}/mailboxes/${id}`);
export const patchMailbox = (id, payload) =>
  api.patch(`${BASE}/mailboxes/${id}`, payload);
export const rotateCredentials = (id, payload) =>
  api.put(`${BASE}/mailboxes/${id}/credentials`, payload);
export const disableMailbox = (id) =>
  api.delete(`${BASE}/mailboxes/${id}`);

// ─── Health & Sync ──────────────────────────────────────────────────
export const probeHealth = (id) => api.get(`${BASE}/mailboxes/${id}/health`);
export const triggerSync = (id) => api.post(`${BASE}/mailboxes/${id}/sync`);

// ─── Messages ───────────────────────────────────────────────────────
export const listMailboxMessages = (id, params = {}) =>
  api.get(`${BASE}/mailboxes/${id}/messages`, { params });
export const getMessage = (mid) => api.get(`${BASE}/messages/${mid}`);
export const listMessagesByLink = (params) =>
  api.get(`${BASE}/messages`, { params });

// ─── Links ──────────────────────────────────────────────────────────
export const createLink = (mid, payload) =>
  api.post(`${BASE}/messages/${mid}/links`, payload);
export const removeLink = (mid, linkId) =>
  api.delete(`${BASE}/messages/${mid}/links/${linkId}`);

// ─── Send ───────────────────────────────────────────────────────────
export const sendEmail = (mailboxId, payload) =>
  api.post(`${BASE}/mailboxes/${mailboxId}/send`, payload);

// ─── Provider defaults (matches backend connectors.PROVIDER_DEFAULTS) ─
export const PROVIDER_DEFAULTS = {
  gmail:      { imap_host: 'imap.gmail.com',       imap_port: 993, imap_security: 'ssl',
                 smtp_host: 'smtp.gmail.com',       smtp_port: 587, smtp_security: 'starttls' },
  outlook:    { imap_host: 'outlook.office365.com',imap_port: 993, imap_security: 'ssl',
                 smtp_host: 'smtp.office365.com',   smtp_port: 587, smtp_security: 'starttls' },
  siteground: { imap_host: 'imap.siteground.com',  imap_port: 993, imap_security: 'ssl',
                 smtp_host: 'smtp.siteground.com',  smtp_port: 465, smtp_security: 'ssl' },
  exchange:   { imap_host: 'outlook.office365.com',imap_port: 993, imap_security: 'ssl',
                 smtp_host: 'smtp.office365.com',   smtp_port: 587, smtp_security: 'starttls' },
};

export default {
  listMailboxes, createMailbox, getMailbox, patchMailbox,
  rotateCredentials, disableMailbox, probeHealth, triggerSync,
  listMailboxMessages, getMessage, listMessagesByLink,
  createLink, removeLink, sendEmail, PROVIDER_DEFAULTS,
};
