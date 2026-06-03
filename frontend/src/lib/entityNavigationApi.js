/**
 * ITER204-B · Entity Navigation Layer™ — shared API client.
 */
import api from './api';

const BASE = '/api/knowledge';

export const collectionDetail = (brandId, collectionId) =>
  api.get(`${BASE}/brands/${brandId}/collections/${collectionId}`);

export const productDetail = (brandId, productId) =>
  api.get(`${BASE}/brands/${brandId}/products/${productId}`);

export const materialDetail = (materialId) =>
  api.get(`${BASE}/materials/${materialId}`);

export const designerDetail = (designerId) =>
  api.get(`${BASE}/designers/${designerId}`);

export default {
  collectionDetail, productDetail, materialDetail, designerDetail,
};
