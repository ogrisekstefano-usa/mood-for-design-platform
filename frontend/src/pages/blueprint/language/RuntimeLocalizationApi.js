/**
 * SPRINT ITER133 · Runtime Localization API client.
 *
 * Thin wrapper around the `/api/language/runtime/*` endpoints introduced
 * in ITER132. Centralised so every panel inside the Language Command
 * Center talks to the same surface.
 */
import api from '../../../lib/api';

const BASE = '/api/language/runtime';

export const fetchRuntimeSummary = async () => {
  const { data } = await api.get(`${BASE}/summary`);
  return data;
};

export const fetchRuntimeReport = async () => {
  const { data } = await api.get(`${BASE}/report`);
  return data;
};

export const fetchRuntimeLeaks = async ({ openOnly = false, limit = 200 } = {}) => {
  const params = new URLSearchParams();
  if (openOnly) params.set('open_only', 'true');
  params.set('limit', String(limit));
  const { data } = await api.get(`${BASE}/leaks?${params.toString()}`);
  return data;
};

// ─── ITER134 · Self-Healing Loop orchestration ──────────────────────────
export const launchRuntimeLoop = async ({ locales = ['en-US'], maxIters = 3, noRestart = false } = {}) => {
  const { data } = await api.post(`${BASE}/run-loop`, {
    locales, max_iters: maxIters, no_restart: noRestart,
  });
  return data;
};

export const fetchRuntimeJobStatus = async (jobId) => {
  const { data } = await api.get(`${BASE}/run-loop/status/${jobId}`);
  return data;
};

export const fetchRuntimeJobs = async (limit = 10) => {
  const { data } = await api.get(`${BASE}/run-loop/jobs?limit=${limit}`);
  return data;
};

export const cancelRuntimeJob = async (jobId) => {
  const { data } = await api.post(`${BASE}/run-loop/${jobId}/cancel`);
  return data;
};

export const clearFixedLeaks = async () => {
  const { data } = await api.post(`${BASE}/clear-fixed-leaks`);
  return data;
};

// Returns the absolute path so an <img> tag can consume it directly.
// The browser will attach the existing auth cookie/header.
export const runtimeScreenshotUrl = (key) => {
  const base = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '');
  return `${base}${BASE}/screenshot/${encodeURIComponent(key)}`;
};

export const runtimeHeatmapRawUrl = () => {
  const base = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '');
  return `${base}${BASE}/heatmap`;
};

export const downloadRuntimeReport = async () => {
  const data = await fetchRuntimeReport();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `runtime-localization-report-${data.locale || 'en-US'}-${(data.generated_at || '').slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// Severity palette aligned with the static heatmap.
export const SEVERITY = {
  RUNTIME_CRASH:            { color: '#c25b5b', label: 'P0 · CRASH' },
  INVALID_USE_TRANSLATION:  { color: '#d97b3a', label: 'P0 · RAW KEY' },
  MISSING_REGISTRY_KEY:     { color: '#d9b285', label: 'P0 · MISSING' },
  HARD_CODED_UI:            { color: '#a4775e', label: 'P1 · IT LEAK' },
  DB_SEEDED_CONTENT:        { color: '#7b9aa6', label: 'P2 · DB SEED' },
  API_FAILURE:              { color: '#5d6770', label: 'P2 · API' },
};

export const severityForCounts = (counts) => {
  if (counts.RUNTIME_CRASH)            return '#c25b5b';
  if (counts.INVALID_USE_TRANSLATION || counts.MISSING_REGISTRY_KEY) return '#d9b285';
  if (counts.HARD_CODED_UI)            return '#a4775e';
  if (counts.DB_SEEDED_CONTENT)        return '#7b9aa6';
  return '#3d8b6a'; // converged
};
