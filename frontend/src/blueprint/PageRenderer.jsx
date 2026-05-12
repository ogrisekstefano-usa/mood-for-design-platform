/**
 * BlueprintPageRenderer — renders a page (list of sections) generically.
 *
 * Usage:
 *   <BlueprintPageRenderer slug="homepage" />
 *   <BlueprintPageRenderer page={pageDoc} />   // bring-your-own (preview mode)
 *
 * Locale resolution is automatic via BlueprintContext.
 */
import React, { useEffect, useState, useMemo } from 'react';
import api from '../lib/api';
import { useBlueprint } from '../contexts/BlueprintContext';
import { resolveSection, resolveContent } from './SectionRegistry';

const BlueprintPageRenderer = ({ slug, page: pageProp, previewLocale }) => {
  const { locale, tenant } = useBlueprint();
  const [page, setPage] = useState(pageProp || null);
  const [loading, setLoading] = useState(!pageProp);
  const [error, setError] = useState(null);
  const effectiveLocale = previewLocale || locale;
  const tenantDefault = tenant?.locales?.default || 'en-US';

  useEffect(() => {
    if (pageProp) { setPage(pageProp); setLoading(false); return; }
    if (!slug) return;
    setLoading(true);
    api.get(`/api/blueprint/pages/${slug}`)
      .then((r) => setPage(r.data))
      .catch((e) => setError(e?.response?.data?.detail || 'Failed to load page'))
      .finally(() => setLoading(false));
  }, [slug, pageProp]);

  // Update when pageProp changes (preview live-edit)
  useEffect(() => { if (pageProp) setPage(pageProp); }, [pageProp]);

  const visibleSections = useMemo(() => {
    if (!page?.sections) return [];
    return [...page.sections]
      .filter((s) => s.visible !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [page]);

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[var(--bp-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (error) {
    return <div className="p-10 text-[var(--bp-text-muted)] bp-caption">{error}</div>;
  }
  if (!visibleSections.length) {
    return <div className="p-10 text-[var(--bp-text-muted)] bp-caption">No sections to display.</div>;
  }

  return (
    <div className="bp-enter" data-testid={`bp-page-${page?.slug || ''}`}>
      {visibleSections.map((section) => {
        const Component = resolveSection(section.type);
        if (!Component) {
          return (
            <div key={section.id} className="bp-section bp-container">
              <p className="bp-caption text-[var(--bp-text-muted)]">
                Unknown section: <code>{section.type}</code>
              </p>
            </div>
          );
        }
        const content = resolveContent(section, effectiveLocale, tenantDefault);
        return (
          <Component
            key={section.id}
            section={section}
            content={content}
            settings={section.settings || {}}
          />
        );
      })}
    </div>
  );
};

export default BlueprintPageRenderer;
