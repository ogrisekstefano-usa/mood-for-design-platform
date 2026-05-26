/**
 * studioPulse.js — Studio Pulse™ SDK (ITER156 Sprint A)
 * Surfaces the living climate of the studio. NOT analytics.
 */
import api from './api';

const BASE = '/api/studio-pulse';

export const getStudioClimate            = ()        => api.get(`${BASE}/climate`);
export const getSilentRelationships      = (params)  => api.get(`${BASE}/silent-relationships`, { params });
export const getDesignerIntensity        = ()        => api.get(`${BASE}/designer-intensity`);
export const getAtmosphereConvergence    = ()        => api.get(`${BASE}/atmosphere-convergence`);
export const getRecentMovements          = (params)  => api.get(`${BASE}/recent-movements`, { params });
