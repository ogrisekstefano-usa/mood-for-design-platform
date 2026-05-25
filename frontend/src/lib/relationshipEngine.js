/**
 * Relationship Live Engine™ · client SDK
 *
 * Single source of truth for all calls to /api/relationship-engine.
 * Client-portal CTAs and designer workspace polling both go through
 * this module so we never re-implement the URL string anywhere.
 */
import api from './api';

const BASE = '/api/relationship-engine';

/* ── CLIENT actions ──────────────────────────────────────────── */
export const fireBriefingCompleted = (summary, locale = 'it') =>
  api.post(`${BASE}/actions/briefing-completed`, { summary, locale });

export const fireMessageSent = (content, thread_id, locale = 'it') =>
  api.post(`${BASE}/actions/message-sent`, { content, thread_id, locale });

export const fireCallRequested = ({ preferred_slots, timezone, note, locale = 'it' } = {}) =>
  api.post(`${BASE}/actions/call-requested`, { preferred_slots, timezone, note, locale });

export const fireMoodboardViewed = (moodboard_id, locale = 'it') =>
  api.post(`${BASE}/actions/moodboard-viewed`, { moodboard_id, locale });

export const fireJourneyResumed = (locale = 'it') =>
  api.post(`${BASE}/actions/journey-resumed`, { locale });

/* ── DESIGNER reads ───────────────────────────────────────────── */
export const getDesignerTimeline = ({ since, limit = 60 } = {}) =>
  api.get(`${BASE}/timeline`, { params: { since, limit } });

export const getLeadTimeline = (leadId, limit = 80) =>
  api.get(`${BASE}/timeline/lead/${leadId}`, { params: { limit } });

export const getLeadStatus = (leadId) =>
  api.get(`${BASE}/status/lead/${leadId}`);

export const getBriefingSummary = (leadId) =>
  api.get(`${BASE}/briefing-summary/lead/${leadId}`);

export const getPendingCallRequests = () =>
  api.get(`${BASE}/call-requests/pending`);

/* ── CLIENT read (own timeline) ───────────────────────────────── */
export const getClientLiveView = () => api.get(`${BASE}/client/me`);
