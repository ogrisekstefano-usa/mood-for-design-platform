/**
 * Relationship Orchestra™ · client SDK · ITER151 Sprint C
 * Booking · Presence · Ownership · Timezone overlap
 */
import api from './api';
const BASE = '/api/orchestra';

/* ── BOOKING ──────────────────────────────────────────────────── */
export const createBooking      = (body) => api.post(`${BASE}/bookings`, body);
export const myBookings         = ()     => api.get(`${BASE}/bookings/me`);
export const pendingBookings    = ()     => api.get(`${BASE}/bookings/pending`);
export const confirmBooking     = (id, body) => api.patch(`${BASE}/bookings/${id}/confirm`, body);
export const rescheduleBooking  = (id, body) => api.patch(`${BASE}/bookings/${id}/reschedule`, body);
export const rejectBooking      = (id, reason) => api.patch(`${BASE}/bookings/${id}/reject`, { reason });

/* ── PRESENCE ─────────────────────────────────────────────────── */
export const getPresenceOptions = () => api.get(`${BASE}/presence/options`);
export const getMyPresence      = () => api.get(`${BASE}/presence/me`);
export const setMyPresence      = (body) => api.put(`${BASE}/presence/me`, body);
export const getDesignerPresence= (id) => api.get(`${BASE}/presence/designer/${id}`);

/* ── OWNERSHIP ────────────────────────────────────────────────── */
export const getOwnership       = (leadId) => api.get(`${BASE}/ownership/lead/${leadId}`);
export const assignOwnership    = (leadId, body) =>
  api.post(`${BASE}/ownership/lead/${leadId}`, body);
export const removeOwnership    = (leadId, designerId) =>
  api.delete(`${BASE}/ownership/lead/${leadId}/designer/${designerId}`);

/* ── TIMEZONE ─────────────────────────────────────────────────── */
export const timezoneOverlap    = (client_tz, designer_tz) =>
  api.get(`${BASE}/timezones/overlap`, { params: { client_tz, designer_tz } });
