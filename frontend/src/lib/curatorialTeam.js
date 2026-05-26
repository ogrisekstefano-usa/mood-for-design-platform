/**
 * curatorialTeam.js — Sprint Phase B SDK
 * Editorial language only: NEVER "collaborators / staff".
 */
import api from './api';
export const getCuratorialTeam = () => api.get('/api/orchestra/curatorial-team/me');
