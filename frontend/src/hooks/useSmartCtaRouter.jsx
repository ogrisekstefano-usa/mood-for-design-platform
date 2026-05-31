/**
 * Smart CTA Routing™ helper — ITER180 · AF4
 *
 * Mappa `cta_route` ricevuto dal backend a un'azione frontend:
 *   - "modal:new-relationship"  → apre il Modal Nuova Relazione™
 *   - "/path/to/page"           → navigate(path)
 */
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNewRelationship } from './useNewRelationship';

export function useSmartCtaRouter() {
  const navigate = useNavigate();
  const { open } = useNewRelationship() || {};

  return useCallback((route, opts = {}) => {
    if (!route) return;
    if (route.startsWith('modal:new-relationship')) {
      open?.(opts);
      return;
    }
    if (route.startsWith('modal:')) {
      // Future modal routes — fallback to navigate
      return;
    }
    navigate(route);
  }, [navigate, open]);
}
