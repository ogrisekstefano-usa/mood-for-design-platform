/**
 * ITER204 · Studio Library Bridge™ — API client.
 *
 * Unified curatorial library for the studio:
 *   brands · collections · products · materials · designers
 *
 * Bridge between Brand Atlas (discovery) and Moodboards (creation).
 */
import api from './api';

const BASE = '/api/studio-library';

export const listLibraryItems = (params = {}) =>
  api.get(`${BASE}/`, { params });

export const libraryStats = () => api.get(`${BASE}/stats`);

export const listLibraryResolved = (params = {}) =>
  api.get(`${BASE}/resolved`, { params });

export const saveToLibrary = (payload) =>
  api.post(`${BASE}/`, payload);

export const toggleLibrary = (payload) =>
  api.post(`${BASE}/toggle`, payload);

export const removeLibraryItem = (itemId) =>
  api.delete(`${BASE}/${itemId}`);

export const removeByEntity = (entity_type, entity_id) =>
  api.delete(`${BASE}/by-entity`, { data: { entity_type, entity_id } });

export default {
  listLibraryItems,
  libraryStats,
  listLibraryResolved,
  saveToLibrary,
  toggleLibrary,
  removeLibraryItem,
  removeByEntity,
};
