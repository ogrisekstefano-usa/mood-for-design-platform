/**
 * MediaLibraryPage — Phase P "Operational Asset System".
 *
 *   ┌──────────────┬──────────────────────────────┬──────────────────┐
 *   │  LEFT RAIL   │      CENTER WORKSPACE        │   INSPECTOR      │
 *   │              │                              │                  │
 *   │ Collections  │  Header: title + ⌘K search   │  Tabs:           │
 *   │              │          + Upload + Coll.    │   Details        │
 *   │ Filters      │                              │   Usage          │
 *   │  · Type      │  Toolbar: count + view +     │   Versions       │
 *   │  · Tags      │           sort + select      │   Revisions      │
 *   │  · Materials │                              │                  │
 *   │  · Projects  │  Asset Grid                  │  Large Replace   │
 *   │  · Used In   │   (Grid / Compact / List)    │  Asset CTA       │
 *   │  · Date      │                              │                  │
 *   │  · Status    │                              │                  │
 *   └──────────────┴──────────────────────────────┴──────────────────┘
 *
 * Strict OS surface (data-surface=os from DashboardLayout). Uses bp-card
 * utility and Phase O cinematic palette. NO backend changes — purely
 * frontend visual + IA refactor on top of existing /api/media/*.
 */
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';
import {
  media, collections as collectionsApi, materials as matApi, uploadMediaFile,
} from '../../lib/mediaApi';
import { toast } from 'sonner';

// ── utils ─────────────────────────────────────────────────────────────
const fmtBytes = (n) => {
  if (!n) return '—';
  const k = 1024;
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0, v = n;
  while (v >= k && i < u.length - 1) { v /= k; i += 1; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
};

const fmtDate = (iso) => iso
  ? new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
  : '—';

const fmtRelative = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'ora';
  if (diff < 3600) return `${Math.round(diff / 60)}m fa`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h fa`;
  return fmtDate(iso);
};

const detectKind = (file_type) => {
  const t = (file_type || '').toLowerCase();
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('video/')) return 'video';
  if (t === 'application/pdf') return 'pdf';
  return 'other';
};

// Maps entity_type → display label
const ENTITY_LABELS = {
  project: 'Project',
  moodboard: 'Moodboard',
  proposal: 'Proposal',
  lead: 'Lead',
  magazine_article: 'Magazine',
  cms_page: 'CMS Page',
  storefront_page: 'Storefront',
  material: 'Material',
  branding_asset: 'Branding',
  inspiration: 'Inspiration',
};

const ENTITY_HREF = {
  project: (id) => `/workspace/projects/${id}`,
  moodboard: (id) => `/moodboards/${id}`,
  proposal: (id) => `/workspace/proposals/${id}`,
  material: (id) => `/library/materials/${id}`,
};

const ENTITY_ICON = {
  project: 'FolderOpen', moodboard: 'Layers', proposal: 'FileText',
  lead: 'Users', magazine_article: 'BookOpen', cms_page: 'FileCode',
  storefront_page: 'Globe', material: 'Gem', branding_asset: 'Palette',
};

// ═══════════════════════════════════════════════════════════════════════
// LEFT RAIL — Collections + Filters
// ═══════════════════════════════════════════════════════════════════════
const RailSectionLabel = ({ children, actionIcon, onAction, count }) => (
  <div className="flex items-center justify-between px-3 mb-2 mt-1">
    <p className="text-[9px] uppercase tracking-[0.28em] text-[var(--bp-text-faint)] font-body font-medium">
      {children}
    </p>
    {actionIcon && (
      <button
        type="button"
        onClick={onAction}
        className="text-[var(--bp-text-muted)] hover:text-[var(--bp-primary)] transition-colors"
      >
        {React.createElement(Icons[actionIcon] || Icons.Plus, { size: 12, strokeWidth: 2 })}
      </button>
    )}
    {count !== undefined && (
      <span className="text-[10px] text-[var(--bp-text-faint)] font-mono tabular-nums">{count}</span>
    )}
  </div>
);

const RailItem = ({ active, onClick, icon, label, count, testid, disabled }) => {
  const Icon = icon ? Icons[icon] || Icons.Circle : null;
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      data-testid={testid}
      disabled={disabled}
      className={`w-full flex items-center ${Icon ? 'gap-2.5' : ''} px-3 py-1.5 rounded-[7px]
                  transition-colors duration-150 text-left relative font-body
                  ${disabled
                    ? 'text-[var(--bp-text-faint)] cursor-not-allowed'
                    : active
                      ? 'text-[var(--bp-primary)]'
                      : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]'
                  }`}
    >
      <span className={`absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full transition-all
                        ${active ? 'bg-[var(--bp-primary)]' : 'bg-transparent'}`} />
      {Icon && <Icon size={13} strokeWidth={1.5} />}
      <span className="flex-1 truncate text-[12.5px]">{label}</span>
      {count !== undefined && (
        <span className="text-[10px] text-[var(--bp-text-faint)] font-mono tabular-nums">
          {count}
        </span>
      )}
      {disabled && (
        <span className="text-[8px] uppercase tracking-wider text-[var(--bp-text-faint)] font-mono">soon</span>
      )}
    </button>
  );
};

const FilterAccordion = ({ title, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-[var(--bp-border)]/60 pt-3 mt-3 first:border-t-0 first:pt-0 first:mt-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 mb-2 group"
      >
        <p className="text-[9px] uppercase tracking-[0.28em] text-[var(--bp-text-faint)] font-body font-medium group-hover:text-[var(--bp-text-muted)] transition-colors">
          {title}
        </p>
        <Icons.ChevronDown size={11}
          className={`text-[var(--bp-text-faint)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          strokeWidth={1.5}
        />
      </button>
      {open && <div className="space-y-0.5 mb-3">{children}</div>}
    </div>
  );
};

const LeftRail = ({
  stats, collections, materials, filters, setFilters, onCreateCollection, onOpenMaterials,
}) => {
  const setFilter = (k, v) => setFilters((f) => ({ ...f, [k]: f[k] === v ? null : v }));

  return (
    <aside
      data-testid="library-rail"
      className="w-[280px] flex-shrink-0 border-r border-[var(--bp-border)] bg-[var(--bp-bg)]
                 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 pt-7 pb-5 border-b border-[var(--bp-border)]">
        <p className="text-[9px] uppercase tracking-[0.28em] text-[var(--bp-text-faint)] font-body font-medium mb-2">
          Library
        </p>
        <h2 className="text-[22px] font-heading text-[var(--bp-text-primary)] leading-none">
          Asset archive
        </h2>
        {stats && (
          <p className="text-[11px] text-[var(--bp-text-muted)] mt-3 font-body">
            {stats.total} assets · {fmtBytes(stats.total_bytes)}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        {/* Collections */}
        <RailSectionLabel actionIcon="Plus" onAction={onCreateCollection}>
          Collections
        </RailSectionLabel>
        <div className="px-2 space-y-0.5 mb-4">
          <RailItem
            active={!filters.collection_id}
            onClick={() => setFilters((f) => ({ ...f, collection_id: null }))}
            label="All assets"
            count={stats?.total}
            testid="rail-collection-all"
          />
          {(collections || []).map((c) => (
            <RailItem
              key={c.id}
              active={filters.collection_id === c.id}
              onClick={() => setFilter('collection_id', c.id)}
              label={c.name}
              count={c.item_count}
              testid={`rail-collection-${c.slug}`}
            />
          ))}
          {(collections || []).length === 0 && (
            <p className="px-3 py-1 text-[11px] text-[var(--bp-text-faint)] italic font-body">
              No collections yet
            </p>
          )}
        </div>

        {/* Filters accordion */}
        <div className="px-2">
          <FilterAccordion title="Asset Type" defaultOpen>
            {[
              ['', 'All', stats?.total],
              ['image', 'Images', stats?.by_kind?.image],
              ['video', 'Video', stats?.by_kind?.video],
              ['pdf', 'PDF', stats?.by_kind?.pdf],
            ].map(([id, label, count]) => (
              <RailItem
                key={id || 'all'}
                active={(filters.type || '') === id}
                onClick={() => setFilters((f) => ({ ...f, type: id || '' }))}
                label={label}
                count={count}
                testid={`rail-type-${id || 'all'}`}
              />
            ))}
          </FilterAccordion>

          <FilterAccordion title="Used In">
            <RailItem active={filters.used === null} onClick={() => setFilters((f) => ({ ...f, used: null }))} label="Any" />
            <RailItem active={filters.used === true} onClick={() => setFilters((f) => ({ ...f, used: true }))} label="Linked assets" />
            <RailItem
              active={filters.used === false}
              onClick={() => setFilters((f) => ({ ...f, used: false }))}
              label="Orphan / unused"
              count={stats?.unused}
            />
          </FilterAccordion>

          <FilterAccordion title="Materials">
            <RailItem onClick={onOpenMaterials} icon="ArrowUpRight" label="Material registry" count={stats?.materials} />
            {(materials || []).slice(0, 5).map((m) => (
              <RailItem
                key={m.id}
                onClick={onOpenMaterials}
                label={m.name}
                count={m.asset_count}
                testid={`rail-material-${m.slug}`}
              />
            ))}
          </FilterAccordion>

          <FilterAccordion title="Tags">
            <RailItem label="Coming soon" disabled />
          </FilterAccordion>
          <FilterAccordion title="Projects">
            <RailItem label="Coming soon" disabled />
          </FilterAccordion>
          <FilterAccordion title="Orientation">
            <RailItem label="Coming soon" disabled />
          </FilterAccordion>
          <FilterAccordion title="Date Added">
            <RailItem label="Coming soon" disabled />
          </FilterAccordion>
          <FilterAccordion title="Status">
            <RailItem
              active={filters.include_archived}
              onClick={() => setFilters((f) => ({ ...f, include_archived: !f.include_archived }))}
              label="Show archived"
            />
          </FilterAccordion>
        </div>
      </div>
    </aside>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// HEADER — Title + Search + Upload + New Collection
// ═══════════════════════════════════════════════════════════════════════
const LibraryHeader = ({ search, setSearch, onUpload, onNewCollection }) => {
  const inputRef = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <header className="px-10 pt-8 pb-6 border-b border-[var(--bp-border)]">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--bp-text-faint)] font-body font-medium mb-2">
            Operational Asset System
          </p>
          <h1 className="text-[28px] font-heading text-[var(--bp-text-primary)] leading-none">
            Media Library
          </h1>
          <p className="mt-2.5 text-[12.5px] text-[var(--bp-text-muted)] font-body max-w-md">
            Every visual asset, material, render and reference your studio depends on.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNewCollection}
            data-testid="header-new-collection-btn"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[8px] border border-[var(--bp-border)]
                       bg-[var(--bp-surface-1)] text-[12px] text-[var(--bp-text-secondary)]
                       hover:text-[var(--bp-text-primary)] hover:border-[var(--bp-border-hover)]
                       font-body transition-colors"
          >
            <Icons.FolderPlus size={13} strokeWidth={1.5} />
            New collection
          </button>
          <button
            type="button"
            onClick={onUpload}
            data-testid="header-upload-btn"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[8px] bg-[var(--bp-primary)] text-black
                       hover:opacity-90 transition-opacity text-[12px] font-body font-medium"
          >
            <Icons.Upload size={13} strokeWidth={2} />
            Upload
          </button>
        </div>
      </div>

      {/* Big centered search */}
      <div className="mt-6 max-w-2xl mx-auto relative">
        <Icons.Search size={14} strokeWidth={1.5}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--bp-text-muted)]" />
        <input
          ref={inputRef}
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search assets, tags, materials, projects…"
          data-testid="library-search-input"
          className="w-full bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[10px]
                     pl-11 pr-20 py-3 text-[13px] text-[var(--bp-text-primary)]
                     placeholder:text-[var(--bp-text-muted)]
                     focus:outline-none focus:border-[var(--bp-border-hover)] transition-colors"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 rounded-[5px]
                        bg-[var(--bp-surface-2)] border border-[var(--bp-border)]
                        text-[10px] font-mono text-[var(--bp-text-muted)] tracking-wide">
          ⌘K
        </kbd>
      </div>
    </header>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// GRID TOOLBAR
// ═══════════════════════════════════════════════════════════════════════
const GridToolbar = ({
  count, viewMode, setViewMode, sort, setSort, selectedCount, onClearSelection,
  collections, onBulkAddToCollection,
}) => (
  <div className="px-10 py-4 border-b border-[var(--bp-border)] flex items-center gap-4 flex-wrap">
    <p className="text-[12px] text-[var(--bp-text-secondary)] font-body tabular-nums">
      <span className="text-[var(--bp-text-primary)] font-medium">{count}</span> {count === 1 ? 'asset' : 'assets'}
    </p>

    {/* view switcher */}
    <div className="flex items-center gap-0.5 p-0.5 rounded-[7px] bg-[var(--bp-surface-1)] border border-[var(--bp-border)]">
      {[['grid', 'Grid3x3'], ['compact', 'LayoutGrid'], ['list', 'AlignJustify']].map(([mode, icon]) => {
        const Icon = Icons[icon];
        const active = viewMode === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => setViewMode(mode)}
            title={mode}
            data-testid={`view-mode-${mode}`}
            className={`w-7 h-7 flex items-center justify-center rounded-[5px] transition-colors
                        ${active
                          ? 'bg-[var(--bp-surface-3)] text-[var(--bp-primary)]'
                          : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]'}`}
          >
            <Icon size={13} strokeWidth={1.5} />
          </button>
        );
      })}
    </div>

    {/* sort */}
    <div className="flex items-center gap-1.5 text-[11px] text-[var(--bp-text-muted)] font-body">
      <Icons.ArrowUpDown size={11} strokeWidth={1.5} />
      <select
        value={sort}
        onChange={(e) => setSort(e.target.value)}
        data-testid="sort-select"
        className="bg-transparent border-0 text-[12px] text-[var(--bp-text-secondary)] focus:outline-none cursor-pointer"
      >
        <option value="recent">Newest</option>
        <option value="name">Name</option>
        <option value="size">Size</option>
        <option value="usage">Most used</option>
      </select>
    </div>

    <div className="flex-1" />

    {selectedCount > 0 && (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-[7px] bg-[var(--bp-primary-soft)] border border-[var(--bp-border-active)]">
        <span className="text-[12px] text-[var(--bp-primary)] font-body">
          {selectedCount} selected
        </span>
        {(collections || []).length > 0 && (
          <select
            onChange={(e) => { if (e.target.value) { onBulkAddToCollection(e.target.value); e.target.value = ''; } }}
            data-testid="bulk-add-collection-select"
            className="bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded text-[11px]
                       text-[var(--bp-text-secondary)] px-2 py-1 focus:outline-none"
            defaultValue=""
          >
            <option value="">Add to collection…</option>
            {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <button
          type="button"
          onClick={onClearSelection}
          className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] transition-colors"
        >
          <Icons.X size={12} />
        </button>
      </div>
    )}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════
// ASSET TILE — filename below image, no overlay-heavy
// ═══════════════════════════════════════════════════════════════════════
const AssetTile = ({ asset, selected, onSelect, onOpen, viewMode }) => {
  const kind = detectKind(asset.file_type);
  const url = asset.display_url || asset.file_url;
  const KindIcon = { image: 'Image', video: 'Film', pdf: 'FileText', other: 'Layers' }[kind];
  const KIcon = Icons[KindIcon] || Icons.Layers;

  if (viewMode === 'list') {
    return (
      <button
        type="button"
        onClick={() => onOpen(asset.id)}
        data-testid={`asset-tile-${asset.id}`}
        className={`w-full flex items-center gap-4 px-4 py-3 rounded-[8px] text-left transition-colors
                    border ${selected
                      ? 'border-[var(--bp-border-active)] bg-[var(--bp-primary-soft)]'
                      : 'border-transparent hover:bg-[var(--bp-surface-1)] hover:border-[var(--bp-border)]'}`}
      >
        <span
          onClick={(e) => { e.stopPropagation(); onSelect(asset.id); }}
          className={`w-4 h-4 rounded-[3px] border flex items-center justify-center flex-shrink-0
                      ${selected ? 'bg-[var(--bp-primary)] border-[var(--bp-primary)]' : 'border-[var(--bp-border-strong)]'}`}
        >
          {selected && <Icons.Check size={11} className="text-black" strokeWidth={3} />}
        </span>
        <span className="w-10 h-10 rounded-[5px] overflow-hidden bg-[var(--bp-surface-2)] flex-shrink-0">
          {kind === 'image' && url
            ? <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
            : <span className="w-full h-full flex items-center justify-center"><KIcon size={14} className="text-[var(--bp-text-muted)]" /></span>}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] text-[var(--bp-text-primary)] truncate font-body">{asset.file_name}</p>
          <p className="text-[10.5px] text-[var(--bp-text-muted)] truncate mt-0.5 font-mono uppercase tracking-wider">
            {kind} · {fmtBytes(asset.file_size)}{asset.width && asset.height && ` · ${asset.width}×${asset.height}`}
          </p>
        </div>
        {asset.usage_count > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bp-surface-2)] text-[var(--bp-text-secondary)] font-mono">
            {asset.usage_count} link{asset.usage_count > 1 ? 's' : ''}
          </span>
        )}
        {asset.replaced_by_id && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300/90 font-mono uppercase tracking-wider">
            replaced
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      data-testid={`asset-tile-${asset.id}`}
      className={`group rounded-[12px] overflow-hidden border transition-all duration-200
                  ${selected
                    ? 'border-[var(--bp-border-active)] ring-1 ring-[var(--bp-primary)]/40'
                    : 'border-[var(--bp-border)] hover:border-[var(--bp-border-hover)] hover:-translate-y-[1px]'}`}
    >
      <button
        type="button"
        onClick={(e) => {
          if (e.shiftKey || e.metaKey || e.ctrlKey) { onSelect(asset.id); return; }
          onOpen(asset.id);
        }}
        className="block w-full relative bg-[var(--bp-surface-2)]"
        style={{ aspectRatio: '1 / 1' }}
      >
        {kind === 'image' && url ? (
          <img src={url} alt={asset.alt_text || asset.file_name}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <KIcon size={26} strokeWidth={1.3} className="text-[var(--bp-text-muted)]" />
          </div>
        )}

        {/* selection chip */}
        <span
          onClick={(e) => { e.stopPropagation(); onSelect(asset.id); }}
          className={`absolute top-2.5 left-2.5 w-5 h-5 rounded-[5px] border flex items-center justify-center
                      cursor-pointer transition-all
                      ${selected
                        ? 'bg-[var(--bp-primary)] border-[var(--bp-primary)] opacity-100'
                        : 'bg-black/50 border-white/25 opacity-0 group-hover:opacity-100'}`}
          data-testid={`asset-select-${asset.id}`}
        >
          {selected && <Icons.Check size={11} className="text-black" strokeWidth={3} />}
        </span>

        {/* type chip — top right */}
        <span className="absolute top-2.5 right-2.5 px-1.5 py-0.5 rounded-[4px]
                         bg-black/60 backdrop-blur-sm text-[9px] text-white/85 font-mono uppercase tracking-[0.15em]
                         opacity-0 group-hover:opacity-100 transition-opacity">
          {kind}
        </span>

        {asset.replaced_by_id && (
          <span className="absolute bottom-2.5 right-2.5 px-1.5 py-0.5 rounded
                           bg-amber-500/15 text-amber-300/95 text-[9px] font-mono uppercase tracking-wider">
            replaced
          </span>
        )}
      </button>

      {/* Metadata below image */}
      {viewMode !== 'compact' && (
        <div className="px-3 py-2.5 bg-[var(--bp-surface-1)]">
          <div className="flex items-start gap-2">
            <KIcon size={11} className="text-[var(--bp-text-muted)] flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <p className="flex-1 text-[12px] text-[var(--bp-text-primary)] truncate font-body" title={asset.file_name}>
              {asset.file_name}
            </p>
          </div>
          <p className="mt-1 text-[10px] text-[var(--bp-text-muted)] font-mono uppercase tracking-[0.12em]">
            {fmtBytes(asset.file_size)}
            {asset.width && asset.height && ` · ${asset.width}×${asset.height}`}
            {asset.usage_count > 0 && ` · ${asset.usage_count} link${asset.usage_count > 1 ? 's' : ''}`}
          </p>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// INSPECTOR — Tabs (Details / Usage / Versions / Revisions)
// ═══════════════════════════════════════════════════════════════════════
const InspectorTabs = ({ tab, setTab }) => {
  const tabs = [
    { id: 'details',   label: 'Details',   icon: 'Info' },
    { id: 'usage',     label: 'Usage',     icon: 'Link2' },
    { id: 'versions',  label: 'Versions',  icon: 'GitBranch' },
    { id: 'revisions', label: 'Revisions', icon: 'History' },
  ];
  return (
    <div className="flex border-b border-[var(--bp-border)]">
      {tabs.map((t) => {
        const Icon = Icons[t.icon];
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            data-testid={`inspector-tab-${t.id}`}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-body uppercase tracking-[0.16em]
                        border-b-2 transition-colors ${active
                          ? 'text-[var(--bp-primary)] border-[var(--bp-primary)]'
                          : 'text-[var(--bp-text-muted)] border-transparent hover:text-[var(--bp-text-primary)]'}`}
          >
            <Icon size={11} strokeWidth={1.5} />
            {t.label}
          </button>
        );
      })}
    </div>
  );
};

const Chip = ({ children, onRemove, testid }) => (
  <span
    data-testid={testid}
    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
               bg-[var(--bp-surface-2)] border border-[var(--bp-border)]
               text-[11px] text-[var(--bp-text-secondary)] font-body"
  >
    {children}
    {onRemove && (
      <button type="button" onClick={onRemove} className="text-[var(--bp-text-muted)] hover:text-[var(--bp-danger)] transition-colors">
        <Icons.X size={9} strokeWidth={2} />
      </button>
    )}
  </span>
);

const RelationshipCard = ({ link }) => {
  const label = ENTITY_LABELS[link.entity_type] || link.entity_type;
  const title = link.entity_title || `${label} · ${(link.entity_id || '').slice(0, 8)}`;
  const Icon = Icons[ENTITY_ICON[link.entity_type] || 'Circle'];
  const href = ENTITY_HREF[link.entity_type]?.(link.entity_id);

  const inner = (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] bg-[var(--bp-surface-2)]
                    border border-[var(--bp-border)] hover:border-[var(--bp-border-hover)] transition-colors group">
      <span className="w-9 h-9 rounded-[7px] bg-[var(--bp-surface-3)] flex items-center justify-center
                       text-[var(--bp-text-secondary)] flex-shrink-0">
        <Icon size={14} strokeWidth={1.5} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] uppercase tracking-[0.22em] text-[var(--bp-text-faint)] font-body mb-0.5">
          {label}{link.role ? ` · ${link.role}` : ''}
        </p>
        <p className="text-[12.5px] text-[var(--bp-text-primary)] truncate font-body">{title}</p>
      </div>
      <Icons.ArrowUpRight size={13} strokeWidth={1.5}
        className="text-[var(--bp-text-muted)] group-hover:text-[var(--bp-primary)] transition-colors flex-shrink-0" />
    </div>
  );

  return href ? <Link to={href} data-testid={`relationship-${link.id}`}>{inner}</Link> : <div data-testid={`relationship-${link.id}`}>{inner}</div>;
};

const Inspector = ({ assetId, onClose, onReload, onReplaceStart }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('details');
  const [editing, setEditing] = useState({ alt_text: '', description: '', tags: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!assetId) return;
    setLoading(true);
    try {
      const d = await media.detail(assetId);
      setDetail(d);
      setEditing({
        alt_text: d.asset.alt_text || '',
        description: d.asset.description || '',
        tags: (d.asset.tags || []).join(', '),
      });
    } catch (e) {
      toast.error('Asset non trovato');
    } finally { setLoading(false); }
  }, [assetId]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await media.update(assetId, {
        alt_text: editing.alt_text || null,
        description: editing.description || null,
        tags: editing.tags.split(',').map((s) => s.trim()).filter(Boolean),
      });
      toast.success('Metadata salvati');
      onReload?.(); load();
    } catch { toast.error('Salvataggio fallito'); }
    finally { setSaving(false); }
  };

  const archive = async () => {
    if (!confirm('Archive this asset?')) return;
    await media.archive(assetId);
    toast.success('Archived');
    onReload?.(); onClose();
  };

  if (!assetId) return null;

  return (
    <aside
      data-testid="asset-inspector"
      className="w-[400px] flex-shrink-0 border-l border-[var(--bp-border)] bg-[var(--bp-surface-1)]
                 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--bp-border)]">
        <p className="text-[9px] uppercase tracking-[0.28em] text-[var(--bp-text-faint)] font-body font-medium">
          Inspector
        </p>
        <button type="button" onClick={onClose} data-testid="inspector-close-btn"
          className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] transition-colors">
          <Icons.X size={15} strokeWidth={1.5} />
        </button>
      </div>

      <InspectorTabs tab={tab} setTab={setTab} />

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Icons.Loader2 size={18} className="animate-spin text-[var(--bp-text-muted)]" />
        </div>
      ) : !detail ? null : (
        <div className="flex-1 overflow-y-auto">
          {tab === 'details' && (
            <DetailsTab
              detail={detail} editing={editing} setEditing={setEditing}
              saving={saving} onSave={save}
            />
          )}
          {tab === 'usage' && <UsageTab detail={detail} />}
          {tab === 'versions' && <VersionsTab detail={detail} />}
          {tab === 'revisions' && <RevisionsTab detail={detail} />}
        </div>
      )}

      {/* Replace CTA — sticky at bottom */}
      {detail && (
        <div className="p-5 border-t border-[var(--bp-border)] bg-[var(--bp-surface-1)] space-y-2.5">
          <button
            type="button"
            onClick={() => onReplaceStart?.(detail.asset)}
            data-testid="inspector-replace-cta"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-[10px]
                       bg-[var(--bp-primary-soft)] border border-[var(--bp-border-active)]
                       text-[var(--bp-primary)] hover:bg-[var(--bp-primary)] hover:text-black
                       transition-colors font-body text-[12.5px] font-medium tracking-wide"
          >
            <Icons.RefreshCw size={13} strokeWidth={1.5} />
            Replace asset
            <span className="text-[10px] opacity-70 font-body normal-case font-normal">· keeps all relationships</span>
          </button>
          <button
            type="button"
            onClick={archive}
            data-testid="inspector-archive-btn"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-[8px]
                       border border-[var(--bp-border)] text-[11px] text-[var(--bp-text-muted)]
                       hover:text-[var(--bp-danger)] hover:border-[var(--bp-danger)]/40
                       font-body transition-colors"
          >
            <Icons.Archive size={11} strokeWidth={1.5} />
            Archive asset
          </button>
        </div>
      )}
    </aside>
  );
};

const Section = ({ label, children }) => (
  <div>
    <p className="text-[9px] uppercase tracking-[0.28em] text-[var(--bp-text-faint)] font-body font-medium mb-2">
      {label}
    </p>
    {children}
  </div>
);

const DetailsTab = ({ detail, editing, setEditing, saving, onSave }) => {
  const a = detail.asset;
  const kind = detectKind(a.file_type);
  const url = a.display_url || a.file_url;
  return (
    <div className="p-5 space-y-6">
      {/* Preview */}
      <div className="rounded-[12px] overflow-hidden border border-[var(--bp-border)] bg-[var(--bp-bg)]">
        {kind === 'image' && url ? (
          <img src={url} alt="" className="w-full max-h-[280px] object-contain bg-[var(--bp-bg-deep)]" />
        ) : (
          <div className="aspect-video flex items-center justify-center bg-[var(--bp-surface-2)]">
            <Icons.FileText size={28} className="text-[var(--bp-text-muted)]" />
          </div>
        )}
      </div>

      {/* File facts grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          ['Type', kind],
          ['Size', fmtBytes(a.file_size)],
          ['Dimensions', a.width && a.height ? `${a.width} × ${a.height}` : '—'],
          ['Uploaded', fmtDate(a.created_at)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[8px] bg-[var(--bp-surface-2)] border border-[var(--bp-border)] px-3 py-2">
            <p className="text-[9px] uppercase tracking-[0.22em] text-[var(--bp-text-faint)] font-body mb-0.5">{label}</p>
            <p className="text-[12px] text-[var(--bp-text-primary)] font-mono uppercase">{value}</p>
          </div>
        ))}
      </div>

      <Section label="File name">
        <p className="text-[12.5px] text-[var(--bp-text-primary)] font-mono break-all">{a.file_name}</p>
      </Section>

      <Section label="Alt text">
        <input
          value={editing.alt_text}
          onChange={(e) => setEditing((p) => ({ ...p, alt_text: e.target.value }))}
          placeholder="Editorial alt text…"
          data-testid="inspector-alt-input"
          className="w-full bg-transparent border-0 border-b border-[var(--bp-border)] py-1.5 text-[13px]
                     text-[var(--bp-text-primary)] focus:outline-none focus:border-[var(--bp-border-hover)]"
        />
      </Section>

      <Section label="Description">
        <textarea
          rows={3}
          value={editing.description}
          onChange={(e) => setEditing((p) => ({ ...p, description: e.target.value }))}
          placeholder="Internal description, notes for the team…"
          data-testid="inspector-description-input"
          className="w-full bg-[var(--bp-surface-2)] border border-[var(--bp-border)] rounded-[6px] py-2 px-2.5 text-[13px]
                     text-[var(--bp-text-primary)] focus:outline-none focus:border-[var(--bp-border-hover)] resize-none"
        />
      </Section>

      <Section label="Tags">
        <input
          value={editing.tags}
          onChange={(e) => setEditing((p) => ({ ...p, tags: e.target.value }))}
          placeholder="quartzite, luxury, brasil…"
          data-testid="inspector-tags-input"
          className="w-full bg-transparent border-0 border-b border-[var(--bp-border)] py-1.5 text-[13px]
                     text-[var(--bp-text-primary)] focus:outline-none focus:border-[var(--bp-border-hover)]"
        />
        {(a.tags || []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {(a.tags || []).map((t) => <Chip key={t}>{t}</Chip>)}
          </div>
        )}
      </Section>

      {detail.material_attachments.length > 0 && (
        <Section label="Materials">
          <div className="flex flex-wrap gap-1.5">
            {detail.material_attachments.map((m, i) => (
              <Chip key={i}>
                <Icons.Gem size={9} className="text-[var(--bp-primary)]" strokeWidth={1.5} />
                {m.role || 'attached'}
              </Chip>
            ))}
          </div>
        </Section>
      )}

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        data-testid="inspector-save-btn"
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[8px]
                   bg-[var(--bp-primary)] text-black hover:opacity-90 transition-opacity
                   text-[12px] font-body font-medium disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save metadata'}
      </button>
    </div>
  );
};

const UsageTab = ({ detail }) => {
  const links = detail.links || [];
  if (links.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-[var(--bp-surface-2)] border border-[var(--bp-border)] flex items-center justify-center mx-auto mb-4">
          <Icons.Link2 size={16} className="text-[var(--bp-text-muted)]" strokeWidth={1.5} />
        </div>
        <p className="text-[9px] uppercase tracking-[0.28em] text-[var(--bp-text-faint)] font-body mb-2">Orphan asset</p>
        <p className="text-[13px] text-[var(--bp-text-muted)] font-body max-w-[260px] mx-auto leading-relaxed">
          This asset is not yet linked to any project, moodboard, or page.
        </p>
      </div>
    );
  }
  // Group by entity_type
  const byType = links.reduce((acc, l) => {
    (acc[l.entity_type] = acc[l.entity_type] || []).push(l);
    return acc;
  }, {});
  return (
    <div className="p-5 space-y-6">
      <p className="text-[12px] text-[var(--bp-text-muted)] font-body">
        This asset is used in <span className="text-[var(--bp-text-primary)] font-medium">{links.length}</span> place{links.length > 1 ? 's' : ''}.
      </p>
      {Object.entries(byType).map(([et, list]) => (
        <Section key={et} label={`${ENTITY_LABELS[et] || et}s · ${list.length}`}>
          <div className="space-y-2">
            {list.map((l) => <RelationshipCard key={l.id} link={l} />)}
          </div>
        </Section>
      ))}
    </div>
  );
};

const VersionsTab = ({ detail }) => {
  const versions = detail.versions || [];
  if (versions.length <= 1) {
    return (
      <div className="p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-[var(--bp-surface-2)] border border-[var(--bp-border)] flex items-center justify-center mx-auto mb-4">
          <Icons.GitBranch size={16} className="text-[var(--bp-text-muted)]" strokeWidth={1.5} />
        </div>
        <p className="text-[9px] uppercase tracking-[0.28em] text-[var(--bp-text-faint)] font-body mb-2">Single version</p>
        <p className="text-[13px] text-[var(--bp-text-muted)] font-body max-w-[260px] mx-auto leading-relaxed">
          No replacement history yet. Use <span className="text-[var(--bp-text-primary)]">Replace asset</span> to evolve this asset while keeping all relationships intact.
        </p>
      </div>
    );
  }
  return (
    <div className="p-5 space-y-4">
      <p className="text-[12px] text-[var(--bp-text-muted)] font-body">
        Asset lineage · {versions.length} version{versions.length > 1 ? 's' : ''}
      </p>
      <ol className="space-y-3 relative">
        <span className="absolute left-3 top-3 bottom-3 w-px bg-[var(--bp-border)]" />
        {versions.map((v, i) => {
          const isCurrent = v.id === detail.asset.id;
          return (
            <li key={v.id} className="relative pl-8">
              <span className={`absolute left-[6px] top-1.5 w-[13px] h-[13px] rounded-full
                                ${isCurrent
                                  ? 'bg-[var(--bp-primary)] ring-4 ring-[var(--bp-primary-soft)]'
                                  : 'bg-[var(--bp-surface-3)] border border-[var(--bp-border-strong)]'}`} />
              <div className={`rounded-[8px] px-3 py-2.5 border ${isCurrent
                                ? 'border-[var(--bp-border-active)] bg-[var(--bp-primary-soft)]/40'
                                : 'border-[var(--bp-border)] bg-[var(--bp-surface-2)]'}`}>
                <div className="flex items-center justify-between">
                  <p className={`text-[11px] uppercase tracking-[0.18em] font-mono ${isCurrent ? 'text-[var(--bp-primary)]' : 'text-[var(--bp-text-muted)]'}`}>
                    v{v.version_number || 1}{isCurrent && ' · current'}
                  </p>
                  <p className="text-[10px] text-[var(--bp-text-faint)] font-body">{fmtRelative(v.created_at)}</p>
                </div>
                <p className="text-[12px] text-[var(--bp-text-primary)] truncate mt-1 font-body">{v.file_name}</p>
                <p className="text-[10px] text-[var(--bp-text-muted)] font-mono mt-0.5">{fmtBytes(v.file_size)}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

const RevisionsTab = ({ detail }) => {
  // Map media_links pointing to cms_page or storefront_page — the only
  // entities tracked by the Phase J revision engine. Show as an editorial
  // "exposure surface" — which pages publish this asset live.
  const cmsLinks = (detail.links || []).filter((l) => ['cms_page', 'storefront_page', 'magazine_article'].includes(l.entity_type));
  if (cmsLinks.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-[var(--bp-surface-2)] border border-[var(--bp-border)] flex items-center justify-center mx-auto mb-4">
          <Icons.History size={16} className="text-[var(--bp-text-muted)]" strokeWidth={1.5} />
        </div>
        <p className="text-[9px] uppercase tracking-[0.28em] text-[var(--bp-text-faint)] font-body mb-2">Not published</p>
        <p className="text-[13px] text-[var(--bp-text-muted)] font-body max-w-[260px] mx-auto leading-relaxed">
          This asset is not yet referenced by any live CMS page or magazine article.
        </p>
      </div>
    );
  }
  return (
    <div className="p-5 space-y-4">
      <p className="text-[12px] text-[var(--bp-text-muted)] font-body">
        Live publishing surfaces where this asset is exposed.
      </p>
      <div className="space-y-2">
        {cmsLinks.map((l) => <RelationshipCard key={l.id} link={l} />)}
      </div>
      <p className="mt-4 text-[10px] text-[var(--bp-text-faint)] italic font-body leading-relaxed">
        Replacing this asset triggers a new revision on every linked CMS page.
        Use the Diff Drawer on each page to compare draft vs live.
      </p>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// NEW COLLECTION MODAL
// ═══════════════════════════════════════════════════════════════════════
const NewCollectionModal = ({ onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await collectionsApi.create({ name: name.trim(), description: description.trim() || null });
      toast.success('Collection created');
      onCreated?.(); onClose();
    } catch { toast.error('Create failed'); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}
         data-testid="new-collection-modal">
      <div onClick={(e) => e.stopPropagation()}
           className="w-full max-w-md bg-[var(--bp-surface-elevated)] border border-[var(--bp-border)] rounded-[14px] p-6 shadow-2xl">
        <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--bp-text-faint)] font-body font-medium mb-1">New</p>
        <h3 className="text-[22px] font-heading text-[var(--bp-text-primary)] mb-6">Create collection</h3>
        <label className="block text-[9px] uppercase tracking-[0.22em] text-[var(--bp-text-faint)] mb-1 font-body">Name</label>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Villa Riviera · Marble Collection 2026 …"
          data-testid="new-collection-name-input"
          className="w-full bg-transparent border-0 border-b border-[var(--bp-border)] py-2 text-[14px]
                     text-[var(--bp-text-primary)] focus:outline-none focus:border-[var(--bp-border-hover)] mb-5" />
        <label className="block text-[9px] uppercase tracking-[0.22em] text-[var(--bp-text-faint)] mb-1 font-body">Description</label>
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
          data-testid="new-collection-desc-input"
          className="w-full bg-[var(--bp-surface-2)] border border-[var(--bp-border)] rounded-[6px] py-2 px-2.5 text-[13px]
                     text-[var(--bp-text-primary)] focus:outline-none focus:border-[var(--bp-border-hover)] resize-none" />
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onClose}
            className="px-3 py-1.5 text-[12px] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] font-body">
            Cancel
          </button>
          <button type="button" disabled={!name.trim() || saving} onClick={submit}
            data-testid="new-collection-submit-btn"
            className="px-4 py-1.5 rounded-[7px] bg-[var(--bp-primary)] text-black font-body text-[12px] font-medium
                       hover:opacity-90 transition-opacity disabled:opacity-40">
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// REPLACE MODAL
// ═══════════════════════════════════════════════════════════════════════
const ReplaceModal = ({ asset, onClose, onDone }) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const onFile = async (file) => {
    if (!file) return;
    setUploading(true); setProgress(0);
    try {
      const row = await uploadMediaFile({ file, folder: 'library/replacements', onProgress: setProgress });
      await media.replace(asset.id, { new_asset_id: row.id, migrate_links: true });
      toast.success('Asset replaced — version chain updated');
      onDone?.(); onClose();
    } catch { toast.error('Replace failed'); }
    finally { setUploading(false); }
  };
  const url = asset.display_url || asset.file_url;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
         onClick={onClose} data-testid="replace-modal">
      <div onClick={(e) => e.stopPropagation()}
           className="w-full max-w-xl bg-[var(--bp-surface-elevated)] border border-[var(--bp-border)] rounded-[14px] p-7 shadow-2xl">
        <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--bp-text-faint)] font-body font-medium mb-1">Replace</p>
        <h3 className="text-[22px] font-heading text-[var(--bp-text-primary)] mb-2">Safe operational replacement</h3>
        <p className="text-[13px] text-[var(--bp-text-muted)] font-body mb-6 leading-relaxed">
          The replacement becomes the primary version. The current asset stays accessible in the version chain.
          All links to projects · moodboards · pages are migrated automatically.
        </p>
        <div className="flex items-center gap-3 p-4 rounded-[10px] border border-[var(--bp-border)] bg-[var(--bp-surface-2)]">
          {url ? <img src={url} alt="" className="w-16 h-16 object-cover rounded-[6px] border border-[var(--bp-border)]" />
               : <div className="w-16 h-16 rounded-[6px] bg-[var(--bp-surface-3)]" />}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-faint)] mb-1 font-body">Current version</p>
            <p className="text-[13px] text-[var(--bp-text-primary)] truncate font-body">{asset.file_name}</p>
            <p className="text-[10px] text-[var(--bp-text-muted)] font-mono mt-0.5">{fmtBytes(asset.file_size)}</p>
          </div>
        </div>
        <input ref={inputRef} type="file" accept="image/*,application/pdf,video/*"
          onChange={(e) => onFile(e.target.files?.[0])} className="hidden" data-testid="replace-file-input" />
        <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()}
          data-testid="replace-pick-file-btn"
          className="mt-4 w-full px-4 py-4 rounded-[10px] border border-dashed border-[var(--bp-border-strong)]
                     text-[var(--bp-text-secondary)] hover:text-[var(--bp-primary)] hover:border-[var(--bp-border-hover)]
                     transition-colors text-[13px] font-body disabled:opacity-50">
          {uploading ? `Uploading… ${progress}%` : '+ Choose replacement file'}
        </button>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} disabled={uploading}
            className="px-3 py-1.5 text-[12px] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] font-body">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════
const MediaLibraryPage = () => {
  const [stats, setStats] = useState(null);
  const [colls, setColls] = useState([]);
  const [mats, setMats] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [openedAsset, setOpenedAsset] = useState(null);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    q: '', type: '', used: null, collection_id: null, include_archived: false,
  });
  const [viewMode, setViewMode] = useState('grid');
  const [sort, setSort] = useState('recent');
  const fileInputRef = useRef(null);

  // Debounce search → filters.q
  useEffect(() => {
    const h = setTimeout(() => setFilters((f) => ({ ...f, q: search })), 220);
    return () => clearTimeout(h);
  }, [search]);

  const loadStats = useCallback(async () => {
    try { setStats(await media.stats()); } catch {}
  }, []);
  const loadColls = useCallback(async () => {
    try { setColls((await collectionsApi.list()).data || []); } catch {}
  }, []);
  const loadMats = useCallback(async () => {
    try { setMats((await matApi.list()).data || []); } catch {}
  }, []);
  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 120, sort };
      if (filters.q) params.q = filters.q;
      if (filters.type) params.type = filters.type;
      if (filters.used !== null) params.used = filters.used;
      if (filters.collection_id) params.collection_id = filters.collection_id;
      if (filters.include_archived) params.include_archived = true;
      const r = await media.list(params);
      setAssets(r.data || []);
    } finally { setLoading(false); }
  }, [filters, sort]);

  useEffect(() => { loadStats(); loadColls(); loadMats(); }, [loadStats, loadColls, loadMats]);
  useEffect(() => { loadAssets(); }, [loadAssets]);

  const reload = () => { loadStats(); loadColls(); loadAssets(); };

  const toggleSelect = (id) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleUpload = async (filesList) => {
    const files = Array.from(filesList || []);
    if (!files.length) return;
    setUploadProgress({ total: files.length, done: 0, current: files[0]?.name });
    for (let i = 0; i < files.length; i += 1) {
      const f = files[i];
      setUploadProgress({ total: files.length, done: i, current: f.name });
      try { await uploadMediaFile({ file: f, folder: 'library' }); }
      catch { toast.error(`Upload failed: ${f.name}`); }
    }
    setUploadProgress(null);
    toast.success(`${files.length} asset${files.length > 1 ? 's' : ''} uploaded`);
    reload();
  };

  // Drag & drop globally
  useEffect(() => {
    const over = (e) => { e.preventDefault(); };
    const drop = (e) => {
      e.preventDefault();
      if (e.dataTransfer?.files?.length) handleUpload(e.dataTransfer.files);
    };
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bulkAddToCollection = async (collectionId) => {
    if (!selectedIds.length) return;
    await collectionsApi.attach(collectionId, selectedIds);
    toast.success(`${selectedIds.length} added`);
    setSelectedIds([]); reload();
  };

  const gridClass = useMemo(() => {
    if (viewMode === 'list') return 'flex flex-col gap-1';
    if (viewMode === 'compact') return 'grid gap-2';
    return 'grid gap-4';
  }, [viewMode]);
  const gridStyle = useMemo(() => {
    if (viewMode === 'list') return {};
    if (viewMode === 'compact') return { gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' };
    return { gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' };
  }, [viewMode]);

  return (
    <div data-testid="media-library-page" className="flex h-full bg-[var(--bp-bg)] overflow-hidden">
      <LeftRail
        stats={stats}
        collections={colls}
        materials={mats}
        filters={filters}
        setFilters={setFilters}
        onCreateCollection={() => setShowNewCollection(true)}
        onOpenMaterials={() => { window.location.href = '/library/materials'; }}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <LibraryHeader
          search={search}
          setSearch={setSearch}
          onUpload={() => fileInputRef.current?.click()}
          onNewCollection={() => setShowNewCollection(true)}
        />

        <GridToolbar
          count={assets.length}
          viewMode={viewMode}
          setViewMode={setViewMode}
          sort={sort}
          setSort={setSort}
          selectedCount={selectedIds.length}
          onClearSelection={() => setSelectedIds([])}
          collections={colls}
          onBulkAddToCollection={bulkAddToCollection}
        />

        <input ref={fileInputRef} type="file" multiple
          accept="image/*,application/pdf,video/*"
          onChange={(e) => handleUpload(e.target.files)} className="hidden"
          data-testid="upload-file-input" />

        <div className="flex-1 overflow-y-auto px-10 py-7">
          {loading && assets.length === 0 ? (
            <div className="h-64 flex items-center justify-center">
              <Icons.Loader2 size={20} className="animate-spin text-[var(--bp-text-muted)]" />
            </div>
          ) : assets.length === 0 ? (
            <EmptyState onUpload={() => fileInputRef.current?.click()} />
          ) : (
            <div className={gridClass} style={gridStyle} data-testid="media-grid">
              {assets.map((a) => (
                <AssetTile
                  key={a.id} asset={a}
                  selected={selectedIds.includes(a.id)}
                  onSelect={toggleSelect}
                  onOpen={(id) => setOpenedAsset(id)}
                  viewMode={viewMode}
                />
              ))}
            </div>
          )}
        </div>

        {uploadProgress && (
          <div className="absolute bottom-6 right-6 z-30 px-4 py-3 rounded-[10px]
                          bg-[var(--bp-surface-elevated)] border border-[var(--bp-border)] shadow-2xl"
               data-testid="upload-progress-toast">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-faint)] font-body">
              Uploading {uploadProgress.done + 1} / {uploadProgress.total}
            </p>
            <p className="text-[12px] text-[var(--bp-text-primary)] truncate mt-1 max-w-[260px] font-body">
              {uploadProgress.current}
            </p>
          </div>
        )}
      </main>

      {openedAsset && (
        <Inspector
          assetId={openedAsset}
          onClose={() => setOpenedAsset(null)}
          onReload={reload}
          onReplaceStart={(a) => setReplaceTarget(a)}
        />
      )}

      {showNewCollection && (
        <NewCollectionModal
          onClose={() => setShowNewCollection(false)}
          onCreated={() => loadColls()}
        />
      )}
      {replaceTarget && (
        <ReplaceModal
          asset={replaceTarget}
          onClose={() => setReplaceTarget(null)}
          onDone={reload}
        />
      )}
    </div>
  );
};

const EmptyState = ({ onUpload }) => (
  <div className="h-full flex flex-col items-center justify-center text-center px-6 py-20">
    <div className="w-16 h-16 rounded-[14px] bg-[var(--bp-surface-1)] border border-[var(--bp-border)] flex items-center justify-center mb-6">
      <Icons.Archive size={22} strokeWidth={1.3} className="text-[var(--bp-text-muted)]" />
    </div>
    <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--bp-text-faint)] font-body font-medium mb-3">
      Empty archive
    </p>
    <h3 className="text-[26px] font-heading text-[var(--bp-text-primary)] mb-3 max-w-md leading-tight">
      Your operational archive is waiting
    </h3>
    <p className="text-[13px] text-[var(--bp-text-muted)] font-body max-w-md mb-7 leading-relaxed">
      Drag &amp; drop materials, renders, slabs, references. Everything becomes part of the studio's
      asset operating system — linkable to projects, moodboards, articles and materials.
    </p>
    <button
      type="button"
      onClick={onUpload}
      data-testid="empty-state-upload-btn"
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-[var(--bp-primary)] text-black
                 hover:opacity-90 transition-opacity text-[13px] font-body font-medium"
    >
      <Icons.Upload size={14} strokeWidth={2} />
      Upload first assets
    </button>
  </div>
);

export default MediaLibraryPage;
