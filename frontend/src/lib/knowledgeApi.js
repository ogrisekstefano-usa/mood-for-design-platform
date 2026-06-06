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

// ─── ITER202 · Brand Experience Layer™ ──────────────────────────────
export const brandEmbassy = (brandId) =>
  api.get(`${BASE}/brands/${brandId}/embassy`);
export const patchBrandHero = (brandId, payload) =>
  api.patch(`${BASE}/brands/${brandId}/hero`, payload);
export const uploadBrandHero = (brandId, formData) =>
  api.post(`${BASE}/brands/${brandId}/hero/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
export const regenerateMoodDna = (brandId) =>
  api.post(`${BASE}/brands/${brandId}/regenerate-mood-dna`);
export const linkBrandToStudio = (brandId, payload = {}) =>
  api.post(`${BASE}/brands/${brandId}/link-to-studio`, payload);
export const unlinkBrandFromStudio = (brandId) =>
  api.delete(`${BASE}/brands/${brandId}/link-to-studio`);
// ITER204-A · Brand Atlas 2.0 (Discovery Engine)
export const atlasDiscover = () => api.get(`${BASE}/atlas/discover`);
export const atlasFacets = () => api.get(`${BASE}/atlas/facets`);

// ─── V3.1 · Review Workspace™ (Brand Atlas → Ecosistema MOOD) ───────
export const futureUses = (setId, entityId) =>
  api.get(`${BASE}/catalog-sets/${setId}/entities/${entityId}/future-uses`);
export const connectedAssets = (setId, entityId) =>
  api.get(`${BASE}/catalog-sets/${setId}/entities/${entityId}/connected-assets`);
export const projectImpact = (setId, entityId) =>
  api.get(`${BASE}/catalog-sets/${setId}/entities/${entityId}/project-impact`);
export const applyCorrection = (setId, entityId, payload) =>
  api.post(`${BASE}/catalog-sets/${setId}/entities/${entityId}/apply-correction`, payload);

// ─── KE-002 · Control Room™ ─────────────────────────────────────────
export const workerStatus = (setId) =>
  api.get(`${BASE}/catalog-sets/${setId}/worker-status`);
export const listEvents = (setId, params = {}) =>
  api.get(`${BASE}/catalog-sets/${setId}/events`, { params });
export const documentPreview = (setId, docId) =>
  api.get(`${BASE}/catalog-sets/${setId}/documents/${docId}`);
export const documentReviewContext = (setId, docId) =>
  api.get(`${BASE}/catalog-sets/${setId}/documents/${docId}/review-context`);
export const documentPages = (setId, docId, { pageNumber, limit = 200 } = {}) =>
  api.get(`${BASE}/catalog-sets/${setId}/documents/${docId}/pages`, {
    params: { page_number: pageNumber, limit },
  });
export const documentFailureContext = (setId, docId) =>
  api.get(`${BASE}/catalog-sets/${setId}/documents/${docId}/failure-context`);

// ─── KE-004 · Future Uses + Connected Assets + Impact History + Readiness ──
export const impactHistory = (setId, limit = 100) =>
  api.get(`${BASE}/catalog-sets/${setId}/impact-history`, { params: { limit } });
export const certificationMetrics = (setId) =>
  api.get(`${BASE}/catalog-sets/${setId}/certification-metrics`);
export const operationalReadiness = (setId, entityId) =>
  api.get(`${BASE}/catalog-sets/${setId}/entities/${entityId}/operational-readiness`);
export const backfillSemanticEvents = (setId) =>
  api.post(`${BASE}/catalog-sets/${setId}/backfill-semantic-events`);
export const retryFailed = (setId, payload = {}) =>
  api.post(`${BASE}/catalog-sets/${setId}/retry-failed`, payload);
export const retryDocument = (setId, docId) =>
  api.post(`${BASE}/catalog-sets/${setId}/documents/${docId}/retry`);
export const extractionJobsHistory = (setId) =>
  api.get(`${BASE}/catalog-sets/${setId}/extraction-jobs`);
export const needsReviewByType = (setId, type, includeFirst = true) =>
  api.get(`${BASE}/catalog-sets/${setId}/needs-review`,
          { params: { type, include_first: includeFirst } });

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
  brandEmbassy, patchBrandHero, uploadBrandHero, regenerateMoodDna,
  linkBrandToStudio, unlinkBrandFromStudio,
  atlasDiscover, atlasFacets,
  futureUses, connectedAssets, projectImpact, applyCorrection,
  workerStatus, listEvents, documentPreview, documentReviewContext,
  documentPages, documentFailureContext, backfillSemanticEvents,
  impactHistory, certificationMetrics, operationalReadiness,
  retryFailed, retryDocument, extractionJobsHistory, needsReviewByType,
};
