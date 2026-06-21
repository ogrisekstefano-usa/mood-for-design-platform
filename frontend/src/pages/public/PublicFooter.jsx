/**
 * PublicFooter — editorial multi-column footer, schema-driven, locale-aware.
 */
import React from 'react';
import { usePublicLocale, resolveI18nLabel } from './publicLocale';

const PublicFooter = ({ footer = {}, brand = {} }) => {
  const { locale } = usePublicLocale();
  const columns = footer.columns || [];
  const bottom = footer.bottom || {};
  const year = new Date().getFullYear();
  const copyrightTemplate = resolveI18nLabel(bottom.copyright, locale)
    || `© ${year} ${brand.name || 'Studio'}.`;
  const copyright = copyrightTemplate
    .replace('{year}', year)
    .replace('{brand}', brand.name || 'Studio');

  return (
    <footer className="border-t border-[var(--bp-border)] bg-[var(--bp-surface-1)]/30" data-testid="public-footer">
      <div className="bp-container px-[var(--bp-section-x)] py-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <span className="bp-eyebrow !text-[var(--bp-text-primary)] !text-xs">{brand.name || 'Studio'}</span>
          </div>

          {columns.map((col) => (
            <div key={col.id}>
              <h4 className="bp-eyebrow !text-[var(--bp-text-muted)]">
                {resolveI18nLabel(col.heading, locale)}
              </h4>
              <ul className="mt-5 space-y-3">
                {(col.links || []).map((l, i) => (
                  <li key={i}>
                    <a href={l.href || '#'} className="bp-body !text-sm text-[var(--bp-text-secondary)] hover:text-[var(--bp-primary)] transition-colors">
                      {resolveI18nLabel(l.label, locale)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="bp-divider mt-16" />

        <div className="mt-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <p className="bp-caption text-[var(--bp-text-muted)]">{copyright}</p>
          <ul className="flex flex-wrap items-center gap-6">
            {(bottom.links || []).map((l, i) => (
              <li key={i}>
                <a href={l.href || '#'} className="bp-caption text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]">
                  {resolveI18nLabel(l.label, locale)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
};

export default PublicFooter;
