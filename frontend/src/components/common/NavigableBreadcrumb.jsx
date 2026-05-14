import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useBlueprint } from '../../contexts/BlueprintContext';

/**
 * NavigableBreadcrumb — clickable section > page trail in the Topbar.
 *
 * Resolves a friendly trail from the current pathname against a small route
 * registry. Each crumb is a real <Link> with hover state, so users can jump
 * back up the tree (e.g. Moodboard editor → Moodboards list) in one click.
 *
 * When no section is detected (e.g. /dashboard) we render just the page label.
 */
const REGISTRY = [
  { match: /^\/workspace\/leads/,       section: { to: '/dashboard',           labelKey: 'nav.section.workspace' },     page: { labelKey: 'nav.leads' } },
  { match: /^\/workspace\/projects\/[^/]+/, section: { to: '/workspace/projects', labelKey: 'nav.projects' },           page: { labelKey: 'nav.project.detail', fallback: 'Project' } },
  { match: /^\/workspace\/projects/,    section: { to: '/dashboard',           labelKey: 'nav.section.workspace' },     page: { labelKey: 'nav.projects' } },
  { match: /^\/workspace\/proposals/,   section: { to: '/dashboard',           labelKey: 'nav.section.workspace' },     page: { labelKey: 'nav.proposals' } },
  { match: /^\/moodboards\/[^/]+/,      section: { to: '/moodboards',          labelKey: 'nav.moodboards' },            page: { labelKey: 'nav.moodboard.editor', fallback: 'Editor' } },
  { match: /^\/moodboards/,             section: { to: '/dashboard',           labelKey: 'nav.section.content' },       page: { labelKey: 'nav.moodboards' } },
  { match: /^\/inspirations/,           section: { to: '/dashboard',           labelKey: 'nav.section.content' },       page: { labelKey: 'nav.inspirations' } },
  { match: /^\/insights/,               section: { to: '/dashboard',           labelKey: 'nav.section.intelligence' },  page: { labelKey: 'nav.insights' } },
  { match: /^\/settings\/brand/,        section: { to: '/settings',            labelKey: 'nav.settings' },              page: { labelKey: 'nav.settings.brand', fallback: 'Brand Studio' } },
  { match: /^\/settings\/pages/,        section: { to: '/settings',            labelKey: 'nav.settings' },              page: { labelKey: 'nav.settings.pages',  fallback: 'Pages' } },
  { match: /^\/settings\/domains/,      section: { to: '/settings',            labelKey: 'nav.settings' },              page: { labelKey: 'nav.settings.domains', fallback: 'Domains' } },
  { match: /^\/settings\/navigation/,   section: { to: '/settings',            labelKey: 'nav.settings' },              page: { labelKey: 'nav.settings.navigation', fallback: 'Navigation' } },
  { match: /^\/settings\/forms/,        section: { to: '/settings',            labelKey: 'nav.settings' },              page: { labelKey: 'nav.settings.forms',  fallback: 'Forms' } },
  { match: /^\/settings/,               section: null,                                                                  page: { labelKey: 'nav.settings' } },
  { match: /^\/dashboard/,              section: null,                                                                  page: { labelKey: 'nav.dashboard' } },
];

const Crumb = ({ to, children, last, testid }) => {
  if (last || !to) {
    return (
      <span
        data-testid={testid}
        className="text-[var(--bp-text-primary)] text-[12px] font-body font-medium tracking-wide truncate max-w-[280px]"
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      to={to}
      data-testid={testid}
      className="text-[var(--bp-text-muted)] text-[12px] font-body tracking-wide hover:text-[var(--bp-text-primary)] transition-colors"
    >
      {children}
    </Link>
  );
};

const NavigableBreadcrumb = () => {
  const { pathname } = useLocation();
  const { t } = useBlueprint();

  const entry = REGISTRY.find((r) => r.match.test(pathname));
  if (!entry) return null;

  const sectionLabel = entry.section ? t(entry.section.labelKey) : null;
  const pageLabel    = t(entry.page.labelKey, null, entry.page.fallback || '');

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 min-w-0">
      {entry.section && (
        <>
          <Crumb to={entry.section.to} testid="breadcrumb-section">{sectionLabel}</Crumb>
          <ChevronRight size={11} className="text-[var(--bp-text-subtle)] flex-shrink-0" />
        </>
      )}
      <Crumb last testid="breadcrumb-page">{pageLabel}</Crumb>
    </nav>
  );
};

export default NavigableBreadcrumb;
