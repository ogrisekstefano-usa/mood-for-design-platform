import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useBlueprint } from '../../contexts/BlueprintContext';
import api from '../../lib/api';

/**
 * NavigableBreadcrumb — deep, clickable trail with smart truncation.
 *
 *   Content / Moodboards / Villa Como / Kitchen Proposal
 *
 * Behaviour:
 *   - Each crumb is a real <Link> (mid crumbs) or plain <span> (last crumb).
 *   - Smart truncate: long titles get `text-overflow: ellipsis` + `max-w-[200px]`,
 *     while the title attribute on each crumb shows the full path for hover.
 *   - Resource crumbs (moodboard title, project title) are fetched on demand
 *     and cached in component state — never blocks render of the rest of
 *     the trail. If the fetch fails or is slow, we fall back to a skeleton.
 *
 * Architecture: pure pattern matching against pathname → entries → cards. To
 * add a new deep breadcrumb path, append a new entry to REGISTRY.
 */

// Resource lookups — fetch a title from a route id. Each lookup returns a
// promise so the breadcrumb can render placeholder pills while the network
// settles. Avoids re-fetching during the same session via window cache.
const _titleCache = (typeof window !== 'undefined' && (window.__bpCrumbCache = window.__bpCrumbCache || {})) || {};

const fetchTitle = async (kind, id) => {
  if (!id) return null;
  const key = `${kind}:${id}`;
  if (_titleCache[key] !== undefined) return _titleCache[key];
  try {
    const path = kind === 'moodboard' ? `/api/moodboards/${id}` : `/api/projects/${id}`;
    const r = await api.get(path);
    const title = r.data?.title || r.data?.name || null;
    _titleCache[key] = title;
    return title;
  } catch {
    _titleCache[key] = null;
    return null;
  }
};

const useResourceTitle = (kind, id) => {
  const [title, setTitle] = useState(() => (id && _titleCache[`${kind}:${id}`]) || null);
  useEffect(() => {
    if (!id) { setTitle(null); return; }
    const cached = _titleCache[`${kind}:${id}`];
    if (cached !== undefined) { setTitle(cached); return; }
    let alive = true;
    fetchTitle(kind, id).then((t) => { if (alive) setTitle(t); });
    return () => { alive = false; };
  }, [kind, id]);
  return title;
};

const Crumb = ({ to, children, last, testid, title }) => {
  const cls = last
    ? 'text-[var(--bp-text-primary)] text-[12px] font-body font-medium tracking-wide'
    : 'text-[var(--bp-text-muted)] text-[12px] font-body tracking-wide hover:text-[var(--bp-text-primary)] transition-colors';
  const truncate = 'truncate inline-block max-w-[200px] align-middle';

  if (last || !to) {
    return (
      <span data-testid={testid} title={title} className={`${cls} ${truncate}`}>
        {children}
      </span>
    );
  }
  return (
    <Link to={to} data-testid={testid} title={title} className={`${cls} ${truncate}`}>
      {children}
    </Link>
  );
};

const Sep = () => <ChevronRight size={11} className="text-[var(--bp-text-subtle)] flex-shrink-0" />;

// Each entry returns the structured trail for a given pathname. The shape is
// an array of { labelKey?, fallback?, to?, dynamic? } — first match wins.
const REGISTRY = [
  // /workspace/projects/:id
  {
    test: /^\/workspace\/projects\/([^/]+)/,
    build: (m, t) => [
      { labelKey: 'nav.section.workspace', to: '/dashboard' },
      { labelKey: 'nav.projects',          to: '/workspace/projects' },
      { dynamic: { kind: 'project', id: m[1] }, fallback: t('nav.project.detail', null, 'Project') },
    ],
  },
  // /moodboards/:id
  {
    test: /^\/moodboards\/([^/]+)/,
    build: (m, t) => [
      { labelKey: 'nav.section.content', to: '/dashboard' },
      { labelKey: 'nav.moodboards',       to: '/moodboards' },
      { dynamic: { kind: 'moodboard', id: m[1] }, fallback: t('nav.moodboard.editor', null, 'Editor') },
    ],
  },
  // /workspace/leads
  { test: /^\/workspace\/leads/,     build: () => [{ labelKey: 'nav.section.workspace', to: '/dashboard' }, { labelKey: 'nav.leads' }] },
  { test: /^\/workspace\/projects/,  build: () => [{ labelKey: 'nav.section.workspace', to: '/dashboard' }, { labelKey: 'nav.projects' }] },
  { test: /^\/workspace\/proposals/, build: () => [{ labelKey: 'nav.section.workspace', to: '/dashboard' }, { labelKey: 'nav.proposals' }] },
  { test: /^\/moodboards/,           build: () => [{ labelKey: 'nav.section.content',  to: '/dashboard' }, { labelKey: 'nav.moodboards' }] },
  { test: /^\/inspirations/,         build: () => [{ labelKey: 'nav.section.content',  to: '/dashboard' }, { labelKey: 'nav.inspirations' }] },
  { test: /^\/insights/,             build: () => [{ labelKey: 'nav.section.intelligence', to: '/dashboard' }, { labelKey: 'nav.insights' }] },
  { test: /^\/settings\/brand/,      build: () => [{ labelKey: 'nav.settings',         to: '/settings' }, { labelKey: 'nav.settings.brand',     fallback: 'Brand Studio' }] },
  { test: /^\/settings\/pages/,      build: () => [{ labelKey: 'nav.settings',         to: '/settings' }, { labelKey: 'nav.settings.pages',     fallback: 'Pages' }] },
  { test: /^\/settings\/domains/,    build: () => [{ labelKey: 'nav.settings',         to: '/settings' }, { labelKey: 'nav.settings.domains',   fallback: 'Domains' }] },
  { test: /^\/settings\/navigation/, build: () => [{ labelKey: 'nav.settings',         to: '/settings' }, { labelKey: 'nav.settings.navigation', fallback: 'Navigation' }] },
  { test: /^\/settings\/forms/,      build: () => [{ labelKey: 'nav.settings',         to: '/settings' }, { labelKey: 'nav.settings.forms',     fallback: 'Forms' }] },
  { test: /^\/settings/,             build: () => [{ labelKey: 'nav.settings' }] },
  { test: /^\/dashboard/,            build: () => [{ labelKey: 'nav.dashboard' }] },
];

const DynamicCrumb = ({ kind, id, fallback, last }) => {
  const title = useResourceTitle(kind, id);
  const label = title || fallback;
  return (
    <Crumb last={last} title={label} testid="breadcrumb-dynamic">
      {title === null
        ? <span className="inline-block w-16 h-3 align-middle rounded bg-[var(--bp-surface-2)] animate-pulse" />
        : label}
    </Crumb>
  );
};

const NavigableBreadcrumb = () => {
  const { pathname } = useLocation();
  const { t } = useBlueprint();

  const entry = REGISTRY.find((r) => r.test.test(pathname));
  if (!entry) return null;
  const match = entry.test.exec(pathname);
  const crumbs = entry.build(match, t);

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 min-w-0">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        const key = c.dynamic ? `dyn-${c.dynamic.id}` : (c.labelKey || c.fallback || i);

        const node = c.dynamic ? (
          <DynamicCrumb key={key} kind={c.dynamic.kind} id={c.dynamic.id} fallback={c.fallback} last={last} />
        ) : (
          <Crumb key={key} to={!last ? c.to : undefined} last={last}
                 testid={last ? 'breadcrumb-page' : 'breadcrumb-section'}
                 title={t(c.labelKey, null, c.fallback || '')}>
            {t(c.labelKey, null, c.fallback || '')}
          </Crumb>
        );
        return (
          <React.Fragment key={`f-${key}`}>
            {i > 0 && <Sep />}
            {node}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default NavigableBreadcrumb;
