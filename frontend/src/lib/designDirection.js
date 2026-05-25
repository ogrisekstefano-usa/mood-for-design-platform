/**
 * Design Direction™ · client SDK · ITER152 Sprint D
 */
import api from './api';
const BASE = '/api/direction';

export const getMyDirection      = () => api.get(`${BASE}/me`);
export const getLeadDirection    = (leadId) => api.get(`${BASE}/lead/${leadId}`);
export const getLeadSignals      = (leadId) => api.get(`${BASE}/lead/${leadId}/signals`);
export const forceLeadDistil     = (leadId) => api.post(`${BASE}/lead/${leadId}/distil`);
export const addSignal           = (body) => api.post(`${BASE}/signals`, body);
