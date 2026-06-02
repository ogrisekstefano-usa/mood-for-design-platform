/**
 * Knowledge Engine API client — ITER195 Phase 4A.
 * Minimal helpers for the Multi-PDF Brand Catalog Ingestion Workspace.
 */
import api from './api';

const BASE = '/api/knowledge';

// ─── Brands ─────────────────────────────────────────────────────────
export const listBrands = () => api.get(`${BASE}/brands`);
export const getBrand = (brandId) => api.get(`${BASE}/brands/${brandId}`);
export const createBrand = (payload) => api.post(`${BASE}/brands`, payload);

// ─── Catalog Sets ───────────────────────────────────────────────────
export const listCatalogSets = (brandId) =>
  api.get(`${BASE}/brands/${brandId}/catalog-sets`);
export const createCatalogSet = (brandId, payload) =>
  api.post(`${BASE}/brands/${brandId}/catalog-sets`, payload);
export const getCatalogSet = (setId) => api.get(`${BASE}/catalog-sets/${setId}`);
export const updateCatalogSet = (setId, payload) =>
  api.patch(`${BASE}/catalog-sets/${setId}`, payload);
export const archiveCatalogSet = (setId) =>
  api.delete(`${BASE}/catalog-sets/${setId}`);

// ─── Documents ──────────────────────────────────────────────────────
export const uploadDocuments = (setId, formData, onProgress) =>
  api.post(`${BASE}/catalog-sets/${setId}/documents/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 600000, // 10 min for large batch
    onUploadProgress: onProgress,
  });
export const listSetDocuments = (setId) =>
  api.get(`${BASE}/catalog-sets/${setId}/documents`);
export const deleteSetDocument = (setId, docId) =>
  api.delete(`${BASE}/catalog-sets/${setId}/documents/${docId}`);

// ─── Extraction ─────────────────────────────────────────────────────
export const triggerExtraction = (setId, body = {}) =>
  api.post(`${BASE}/catalog-sets/${setId}/extract`, body);
export const extractionStatus = (setId) =>
  api.get(`${BASE}/catalog-sets/${setId}/extraction-status`);

// ─── Validation ─────────────────────────────────────────────────────
export const validationSummary = (setId) =>
  api.get(`${BASE}/catalog-sets/${setId}/validation-summary`);
export const listPages = (setId, params = {}) =>
  api.get(`${BASE}/catalog-sets/${setId}/pages`, { params });
export const patchPage = (setId, pageId, payload) =>
  api.patch(`${BASE}/catalog-sets/${setId}/pages/${pageId}`, payload);
export const listEntities = (setId, params = {}) =>
  api.get(`${BASE}/catalog-sets/${setId}/entities`, { params });
export const patchEntity = (setId, entityId, payload) =>
  api.patch(`${BASE}/catalog-sets/${setId}/entities/${entityId}`, payload);
export const mergeEntity = (setId, entityId, targetId) =>
  api.post(`${BASE}/catalog-sets/${setId}/entities/${entityId}/merge`, {
    target_entity_id: targetId,
  });
export const publishSet = (setId) =>
  api.post(`${BASE}/catalog-sets/${setId}/publish`);

// ─── ITER199 / ITER200 / ITER201 · Resolution + Review Workspace ────
export const resolveEntities = (setId) =>
  api.post(`${BASE}/catalog-sets/${setId}/resolve-entities`);
export const knowledgeAudit = (setId) =>
  api.get(`${BASE}/catalog-sets/${setId}/knowledge-audit`);
export const listNeedsReview = (setId) =>
  api.get(`${BASE}/catalog-sets/${setId}/needs-review`);
export const approveEntity = (setId, entityId) =>
  api.post(`${BASE}/catalog-sets/${setId}/entities/${entityId}/approve`);
export const rejectEntity = (setId, entityId) =>
  api.post(`${BASE}/catalog-sets/${setId}/entities/${entityId}/reject`);
export const promoteEntityToCanonical = (setId, entityId) =>
  api.post(`${BASE}/catalog-sets/${setId}/entities/${entityId}/promote-canonical`);
// ITER201 · Review Workspace™
export const reviewSummary = (setId) =>
  api.get(`${BASE}/catalog-sets/${setId}/review-summary`);
export const entityDetail = (setId, entityId) =>
  api.get(`${BASE}/catalog-sets/${setId}/entities/${entityId}/detail`);
export const mergeAliases = (setId, payload) =>
  api.post(`${BASE}/catalog-sets/${setId}/entities/merge-aliases`, payload);
export const bulkAction = (setId, payload) =>
  api.post(`${BASE}/catalog-sets/${setId}/entities/bulk-action`, payload);
export const publishGate = (setId) =>
  api.get(`${BASE}/catalog-sets/${setId}/publish-gate`);

export default {
  listBrands, getBrand, createBrand,
  listCatalogSets, createCatalogSet, getCatalogSet, updateCatalogSet,
  archiveCatalogSet,
  uploadDocuments, listSetDocuments, deleteSetDocument,
  triggerExtraction, extractionStatus,
  validationSummary, listPages, patchPage,
  listEntities, patchEntity, mergeEntity, publishSet,
  resolveEntities, knowledgeAudit,
  listNeedsReview, approveEntity, rejectEntity,
  promoteEntityToCanonical,
  reviewSummary, entityDetail, mergeAliases, bulkAction, publishGate,
};
