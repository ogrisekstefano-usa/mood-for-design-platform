/**
 * MediaLibraryPage — operational asset layer (Phase N).
 *
 * Layout: [sidebar — filters + collections] | [grid — search/upload] | [inspector — detail/links/replace]
 * Surface: Blueprint OS (dark cinematic).
 * Strict OS surface — never touches storefront tokens.
 */
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Upload, Archive, Image as ImageIcon, FileText, Film, Layers,
  X, Plus, FolderPlus, Tag, Trash2, RotateCcw, Replace, Link2,
  ChevronDown, Filter, Gem, Loader2, Check, Eye, ExternalLink, SlidersHorizontal,
} from 'lucide-react';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { media, collections as collectionsApi, uploadMediaFile } from '../../lib/mediaApi';
import { toast } from 'sonner';

// ── tiny utility ───────────────────────────────────────────────────────
const fmtBytes = (n) => {
  if (!n) return '—';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= k && i < units.length - 1) { v /= k; i += 1; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
};

const KIND_LABEL = {
  all: { label: 'All', icon: Layers },
  image: { label: 'Images', icon: ImageIcon },
  video: { label: 'Video', icon: Film },
  pdf:   { label: 'PDF', icon: FileText },
};

// ═════════════════════════════════════════════════════════════════════════
// Tile
// ═════════════════════════════════════════════════════════════════════════
const AssetTile = ({ asset, selected, onSelect, onOpen }) => {
  const isImage = (asset.file_type || '').startsWith('image/');
  const isPdf   = asset.file_type === 'application/pdf';
  const isVideo = (asset.file_type || '').startsWith('video/');

  return (
    <button
      type="button"
      onClick={(e) => {
        if (e.shiftKey || e.metaKey || e.ctrlKey) { onSelect(asset.id); return; }
        onOpen(asset.id);
      }}
      data-testid={`asset-tile-${asset.id}`}
      className={`relative group text-left overflow-hidden rounded-md
                  border transition-all duration-200 bg-[var(--bp-surface-1)]
                  ${selected
                    ? 'border-[var(--bp-primary)] ring-1 ring-[var(--bp-primary)]/40'
                    : 'border-[var(--bp-border)] hover:border-[var(--bp-border-strong)]'}`}
      style={{ aspectRatio: '1 / 1' }}
    >
      {isImage && (asset.display_url || asset.file_url) && (
        <img
          src={asset.display_url || asset.file_url}
          alt={asset.alt_text || asset.file_name}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          loading="lazy"
        />
      )}
      {isPdf && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--bp-surface-2)]">
          <FileText size={32} className="text-[var(--bp-text-muted)]" />
        </div>
      )}
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--bp-surface-2)]">
          <Film size={32} className="text-[var(--bp-text-muted)]" />
        </div>
      )}
      {!isImage && !isPdf && !isVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--bp-surface-2)]">
          <Layers size={28} className="text-[var(--bp-text-muted)]" />
        </div>
      )}

      {/* Overlay metadata */}
      <div className="absolute inset-0 flex flex-col justify-end p-2
                      bg-gradient-to-t from-black/70 via-black/20 to-transparent
                      opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <p className="text-[10px] text-white/70 uppercase tracking-[0.18em] mb-0.5 font-body">
          {asset.usage_count > 0 ? `${asset.usage_count} link${asset.usage_count > 1 ? 's' : ''}` : 'unused'}
        </p>
        <p className="text-[12px] text-white truncate font-medium">{asset.file_name}</p>
      </div>

      {/* Select checkbox (top-left, always visible if selected) */}
      <div
        onClick={(e) => { e.stopPropagation(); onSelect(asset.id); }}
        className={`absolute top-2 left-2 w-5 h-5 rounded-[4px] border flex items-center justify-center
                    cursor-pointer transition-all ${
                      selected
                        ? 'bg-[var(--bp-primary)] border-[var(--bp-primary)] opacity-100'
                        : 'bg-black/40 border-white/30 opacity-0 group-hover:opacity-100'
                    }`}
        data-testid={`asset-select-${asset.id}`}
      >
        {selected && <Check size={12} className="text-black" strokeWidth={3} />}
      </div>

      {asset.replaced_by_id && (
        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded
                        bg-amber-500/20 text-amber-300 text-[9px] font-mono uppercase tracking-wider">
          replaced
        </div>
      )}
      {asset.archived_at && !asset.replaced_by_id && (
        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded
                        bg-[var(--bp-surface-3)] text-[var(--bp-text-muted)] text-[9px] font-mono uppercase tracking-wider">
          archived
        </div>
      )}
    </button>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// Sidebar
// ═════════════════════════════════════════════════════════════════════════
const SidebarPanel = ({
  stats, filters, setFilters, colls, onCreateCollection, onOpenMaterials,
}) => {
  const setKind = (k) => setFilters((f) => ({ ...f, type: k }));
  const setUsed = (v) => setFilters((f) => ({ ...f, used: v }));
  const setCollection = (id) => setFilters((f) => ({ ...f, collection_id: id }));

  return (
    <aside
      data-testid="library-sidebar"
      className="w-[260px] flex-shrink-0 border-r border-[var(--bp-border)]
                 bg-[var(--bp-bg)] flex flex-col overflow-y-auto"
    >
      <div className="px-5 pt-6 pb-3 border-b border-[var(--bp-border)]">
        <p className="text-[9px] tracking-[0.28em] uppercase text-[var(--bp-text-muted)] mb-1 font-body">
          Library
        </p>
        <h2 className="text-[18px] font-heading tracking-tight text-[var(--bp-text-primary)]">
          Asset archive
        </h2>
        {stats && (
          <p className="text-[11px] text-[var(--bp-text-muted)] mt-2 font-body">
            {stats.total} assets · {fmtBytes(stats.total_bytes)}
          </p>
        )}
      </div>

      {/* Type */}
      <div className="px-3 py-4">
        <p className="px-2 mb-2 text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--bp-text-muted)] font-body">
          Type
        </p>
        <div className="space-y-0.5">
          {Object.entries(KIND_LABEL).map(([k, { label, icon: Icon }]) => {
            const active = (filters.type || 'all') === k;
            const count = k === 'all'
              ? stats?.total
              : stats?.by_kind?.[k];
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k === 'all' ? '' : k)}
                data-testid={`filter-type-${k}`}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-[5px]
                            text-[13px] font-body transition-colors ${
                              active
                                ? 'bg-[var(--bp-primary)]/10 text-[var(--bp-primary)]'
                                : 'text-[var(--bp-text-secondary)] hover:text-[var(--bp-text-primary)] hover:bg-[var(--bp-surface-2)]/50'
                            }`}
              >
                <span className="flex items-center gap-2">
                  <Icon size={14} strokeWidth={1.5} />
                  {label}
                </span>
                <span className="text-[10px] text-[var(--bp-text-muted)] font-mono tabular-nums">
                  {count ?? '—'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Usage */}
      <div className="px-3 py-2 border-t border-[var(--bp-border)]/60">
        <p className="px-2 mb-2 text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--bp-text-muted)] font-body">
          Usage
        </p>
        <div className="space-y-0.5">
          <button
            type="button"
            data-testid="filter-used-all"
            onClick={() => setUsed(null)}
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-[5px] text-[13px] font-body transition-colors ${
              filters.used === null ? 'bg-[var(--bp-primary)]/10 text-[var(--bp-primary)]'
                                    : 'text-[var(--bp-text-secondary)] hover:bg-[var(--bp-surface-2)]/50'}`}
          >
            <span>All</span>
          </button>
          <button
            type="button"
            data-testid="filter-used-true"
            onClick={() => setUsed(true)}
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-[5px] text-[13px] font-body transition-colors ${
              filters.used === true ? 'bg-[var(--bp-primary)]/10 text-[var(--bp-primary)]'
                                    : 'text-[var(--bp-text-secondary)] hover:bg-[var(--bp-surface-2)]/50'}`}
          >
            <span>Linked</span>
          </button>
          <button
            type="button"
            data-testid="filter-used-false"
            onClick={() => setUsed(false)}
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-[5px] text-[13px] font-body transition-colors ${
              filters.used === false ? 'bg-[var(--bp-primary)]/10 text-[var(--bp-primary)]'
                                     : 'text-[var(--bp-text-secondary)] hover:bg-[var(--bp-surface-2)]/50'}`}
          >
            <span>Unused</span>
            {stats?.unused > 0 && (
              <span className="text-[10px] text-[var(--bp-text-muted)] font-mono tabular-nums">{stats.unused}</span>
            )}
          </button>
        </div>
      </div>

      {/* Collections */}
      <div className="px-3 py-3 border-t border-[var(--bp-border)]/60 flex-1">
        <div className="flex items-center justify-between px-2 mb-2">
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--bp-text-muted)] font-body">
            Collections
          </p>
          <button
            type="button"
            onClick={onCreateCollection}
            data-testid="create-collection-btn"
            className="text-[var(--bp-text-muted)] hover:text-[var(--bp-primary)] transition-colors"
          >
            <Plus size={13} strokeWidth={2} />
          </button>
        </div>
        <div className="space-y-0.5 max-h-[260px] overflow-y-auto">
          <button
            type="button"
            data-testid="filter-collection-all"
            onClick={() => setCollection(null)}
            className={`w-full text-left px-2 py-1.5 rounded-[5px] text-[13px] font-body transition-colors ${
              !filters.collection_id ? 'bg-[var(--bp-primary)]/10 text-[var(--bp-primary)]'
                                     : 'text-[var(--bp-text-secondary)] hover:bg-[var(--bp-surface-2)]/50'}`}
          >
            All assets
          </button>
          {colls.map((c) => {
            const active = filters.collection_id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCollection(c.id)}
                data-testid={`filter-collection-${c.slug}`}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-[5px] text-[13px] font-body transition-colors ${
                  active ? 'bg-[var(--bp-primary)]/10 text-[var(--bp-primary)]'
                         : 'text-[var(--bp-text-secondary)] hover:bg-[var(--bp-surface-2)]/50'}`}
              >
                <span className="truncate">{c.name}</span>
                <span className="text-[10px] text-[var(--bp-text-muted)] font-mono tabular-nums ml-2">
                  {c.item_count ?? 0}
                </span>
              </button>
            );
          })}
          {colls.length === 0 && (
            <p className="px-2 py-2 text-[11px] text-[var(--bp-text-muted)] italic">
              No collections yet
            </p>
          )}
        </div>
      </div>

      {/* Footer: Materials shortcut */}
      <button
        type="button"
        onClick={onOpenMaterials}
        data-testid="open-materials-btn"
        className="border-t border-[var(--bp-border)] px-5 py-4 flex items-center gap-2 text-[13px]
                   text-[var(--bp-text-secondary)] hover:bg-[var(--bp-surface-2)]/40 hover:text-[var(--bp-primary)] transition-colors group"
      >
        <Gem size={14} strokeWidth={1.5} />
        <span className="flex-1 text-left font-body">Material registry</span>
        {stats?.materials > 0 && (
          <span className="text-[10px] font-mono tabular-nums text-[var(--bp-text-muted)]">{stats.materials}</span>
        )}
      </button>
    </aside>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// Inspector (right rail)
// ═════════════════════════════════════════════════════════════════════════
const Inspector = ({ assetId, onClose, onChanged, onReplaceStart }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});

  const load = useCallback(async () => {
    if (!assetId) return;
    setLoading(true);
    try {
      const d = await media.detail(assetId);
      setDetail(d);
      setForm({
        alt_text: d.asset.alt_text || '',
        description: d.asset.description || '',
        tags: (d.asset.tags || []).join(', '),
      });
    } catch (e) {
      toast.error('Failed to load asset');
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await media.update(assetId, {
        alt_text: form.alt_text || null,
        description: form.description || null,
        tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
      });
      toast.success('Asset updated');
      onChanged?.();
      load();
    } catch (e) {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!confirm('Archive this asset?')) return;
    await media.archive(assetId);
    toast.success('Archived');
    onChanged?.();
    onClose();
  };

  const restore = async () => {
    await media.restore(assetId);
    toast.success('Restored');
    onChanged?.();
    load();
  };

  if (!assetId) return null;

  return (
    <aside
      data-testid="asset-inspector"
      className="w-[380px] flex-shrink-0 border-l border-[var(--bp-border)]
                 bg-[var(--bp-surface-1)] flex flex-col overflow-y-auto"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--bp-border)] sticky top-0 bg-[var(--bp-surface-1)] z-10">
        <p className="text-[10px] tracking-[0.28em] uppercase text-[var(--bp-text-muted)] font-body">
          Asset
        </p>
        <button
          type="button"
          onClick={onClose}
          data-testid="inspector-close-btn"
          className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] transition-colors"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-[var(--bp-text-muted)]" />
        </div>
      )}

      {!loading && detail && (
        <>
          {/* Preview */}
          <div className="p-5">
            {(detail.asset.file_type || '').startsWith('image/') ? (
              <img
                src={detail.asset.display_url || detail.asset.file_url}
                alt={detail.asset.alt_text || ''}
                className="w-full rounded-md border border-[var(--bp-border)]"
              />
            ) : (
              <div className="w-full aspect-video rounded-md border border-[var(--bp-border)] bg-[var(--bp-surface-2)] flex items-center justify-center">
                <FileText size={28} className="text-[var(--bp-text-muted)]" />
              </div>
            )}

            <p className="mt-3 text-[12px] text-[var(--bp-text-primary)] font-medium truncate">
              {detail.asset.file_name}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--bp-text-muted)] font-body">
              {detail.asset.file_type} · {fmtBytes(detail.asset.file_size)}
              {detail.asset.width && detail.asset.height && ` · ${detail.asset.width}×${detail.asset.height}`}
            </p>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.open(detail.asset.display_url || detail.asset.file_url, '_blank')}
                data-testid="inspector-open-original-btn"
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-[4px]
                           border border-[var(--bp-border)] text-[11px] text-[var(--bp-text-secondary)]
                           hover:border-[var(--bp-border-strong)] hover:text-[var(--bp-text-primary)]
                           font-body transition-colors"
              >
                <ExternalLink size={11} />
                Open
              </button>
              <button
                type="button"
                onClick={() => onReplaceStart?.(detail.asset)}
                data-testid="inspector-replace-btn"
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-[4px]
                           border border-[var(--bp-border)] text-[11px] text-[var(--bp-text-secondary)]
                           hover:border-[var(--bp-primary)]/40 hover:text-[var(--bp-primary)]
                           font-body transition-colors"
              >
                <Replace size={11} />
                Replace
              </button>
            </div>
          </div>

          {/* Metadata form */}
          <div className="px-5 pb-5 space-y-3 border-t border-[var(--bp-border)]/60 pt-4">
            <div>
              <label className="text-[9px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] font-body block mb-1">
                Alt text
              </label>
              <input
                type="text"
                value={form.alt_text}
                onChange={(e) => setForm((f) => ({ ...f, alt_text: e.target.value }))}
                data-testid="inspector-alt-input"
                className="w-full bg-transparent border-0 border-b border-[var(--bp-border)] py-1 text-[13px]
                           text-[var(--bp-text-primary)] focus:outline-none focus:border-[var(--bp-primary)] transition-colors"
              />
            </div>
            <div>
              <label className="text-[9px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] font-body block mb-1">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                data-testid="inspector-description-input"
                className="w-full bg-transparent border border-[var(--bp-border)] rounded-[4px] py-1.5 px-2 text-[13px]
                           text-[var(--bp-text-primary)] focus:outline-none focus:border-[var(--bp-primary)] transition-colors"
              />
            </div>
            <div>
              <label className="text-[9px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] font-body block mb-1">
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                data-testid="inspector-tags-input"
                className="w-full bg-transparent border-0 border-b border-[var(--bp-border)] py-1 text-[13px]
                           text-[var(--bp-text-primary)] focus:outline-none focus:border-[var(--bp-primary)] transition-colors"
              />
            </div>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              data-testid="inspector-save-btn"
              className="w-full px-3 py-2 rounded-[4px] bg-[var(--bp-primary)] text-black font-body text-[12px]
                         hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save metadata'}
            </button>
          </div>

          {/* Usage map */}
          <div className="px-5 pb-5 border-t border-[var(--bp-border)]/60 pt-4">
            <p className="text-[9px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] font-body mb-2">
              Used in
            </p>
            {detail.links.length === 0 && detail.material_attachments.length === 0 && detail.collections.length === 0 && (
              <p className="text-[12px] text-[var(--bp-text-muted)] italic">Not linked to anything yet</p>
            )}
            {detail.links.length > 0 && (
              <div className="space-y-1.5">
                {detail.links.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-[4px]
                               bg-[var(--bp-surface-2)]/50 border border-[var(--bp-border)]/60"
                  >
                    <Link2 size={11} className="text-[var(--bp-text-muted)]" />
                    <span className="text-[11px] text-[var(--bp-text-primary)] font-mono uppercase tracking-wide">
                      {l.entity_type}
                    </span>
                    {l.role && (
                      <span className="text-[10px] text-[var(--bp-text-muted)] font-body">· {l.role}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {detail.collections.length > 0 && (
              <div className="mt-3">
                <p className="text-[9px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] font-body mb-1.5">
                  Collections
                </p>
                <div className="space-y-1">
                  {detail.collections.map((c) => (
                    <div key={c.collection_id} className="text-[12px] text-[var(--bp-text-secondary)]">
                      · {c.collection_id.slice(0, 8)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Versions */}
          {detail.versions.length > 1 && (
            <div className="px-5 pb-5 border-t border-[var(--bp-border)]/60 pt-4">
              <p className="text-[9px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] font-body mb-2">
                Version history
              </p>
              <div className="space-y-1.5">
                {detail.versions.map((v) => (
                  <div
                    key={v.id}
                    className={`flex items-center justify-between px-2 py-1.5 rounded-[4px] text-[11px]
                               ${v.id === detail.asset.id
                                  ? 'bg-[var(--bp-primary)]/10 border border-[var(--bp-primary)]/30 text-[var(--bp-primary)]'
                                  : 'bg-[var(--bp-surface-2)]/30 border border-[var(--bp-border)]/40 text-[var(--bp-text-muted)]'}`}
                  >
                    <span className="font-mono">v{v.version_number || 1}</span>
                    <span className="font-body truncate flex-1 ml-2">{v.file_name}</span>
                    {v.id === detail.asset.id && <span className="font-body text-[9px] uppercase">current</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Danger zone */}
          <div className="mt-auto p-5 border-t border-[var(--bp-border)]/60">
            {detail.asset.archived_at && !detail.asset.replaced_by_id ? (
              <button
                type="button"
                onClick={restore}
                data-testid="inspector-restore-btn"
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-[4px]
                           border border-[var(--bp-border)] text-[11px] text-[var(--bp-text-secondary)]
                           hover:border-[var(--bp-border-strong)] hover:text-[var(--bp-text-primary)]
                           font-body transition-colors"
              >
                <RotateCcw size={11} />
                Restore from archive
              </button>
            ) : (
              <button
                type="button"
                onClick={archive}
                data-testid="inspector-archive-btn"
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-[4px]
                           border border-red-900/40 text-[11px] text-red-300/80
                           hover:bg-red-900/10 hover:border-red-900/60 hover:text-red-300
                           font-body transition-colors"
              >
                <Archive size={11} />
                Archive asset
              </button>
            )}
          </div>
        </>
      )}
    </aside>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// New collection modal
// ═════════════════════════════════════════════════════════════════════════
const NewCollectionModal = ({ onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const c = await collectionsApi.create({ name: name.trim(), description: description.trim() || null });
      toast.success('Collection created');
      onCreated?.(c);
      onClose();
    } catch (e) {
      toast.error('Create failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      data-testid="new-collection-modal"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-md p-6"
      >
        <p className="text-[9px] uppercase tracking-[0.28em] text-[var(--bp-text-muted)] font-body mb-1">
          New
        </p>
        <h3 className="text-[20px] font-heading tracking-tight text-[var(--bp-text-primary)] mb-5">
          Create collection
        </h3>
        <label className="block text-[9px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] mb-1 font-body">
          Name
        </label>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-testid="new-collection-name-input"
          className="w-full bg-transparent border-0 border-b border-[var(--bp-border)] py-1.5 text-[14px]
                     text-[var(--bp-text-primary)] focus:outline-none focus:border-[var(--bp-primary)] mb-4 transition-colors"
          placeholder="Marmi Calacatta 2026"
        />
        <label className="block text-[9px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] mb-1 font-body">
          Description
        </label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          data-testid="new-collection-desc-input"
          className="w-full bg-transparent border border-[var(--bp-border)] rounded-[4px] py-1.5 px-2 text-[13px]
                     text-[var(--bp-text-primary)] focus:outline-none focus:border-[var(--bp-primary)] transition-colors"
        />
        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            data-testid="new-collection-cancel-btn"
            className="px-3 py-1.5 text-[12px] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] font-body transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!name.trim() || saving}
            onClick={submit}
            data-testid="new-collection-submit-btn"
            className="px-4 py-1.5 rounded-[4px] bg-[var(--bp-primary)] text-black font-body text-[12px]
                       hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// Replace modal
// ═════════════════════════════════════════════════════════════════════════
const ReplaceModal = ({ asset, onClose, onDone }) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const onFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    try {
      const newRow = await uploadMediaFile({
        file,
        folder: 'library/replacements',
        onProgress: setProgress,
      });
      // Wire replace
      await media.replace(asset.id, { new_asset_id: newRow.id, migrate_links: true });
      toast.success('Asset replaced — version chain updated');
      onDone?.();
      onClose();
    } catch (e) {
      toast.error('Replace failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      data-testid="replace-modal"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-md p-6"
      >
        <p className="text-[9px] uppercase tracking-[0.28em] text-[var(--bp-text-muted)] font-body mb-1">
          Replace
        </p>
        <h3 className="text-[20px] font-heading tracking-tight text-[var(--bp-text-primary)] mb-2">
          Soft replace — keep history
        </h3>
        <p className="text-[12px] text-[var(--bp-text-muted)] font-body mb-5">
          The new asset becomes <span className="text-[var(--bp-text-primary)]">primary</span>. The old version stays accessible.
          All links pointing at the old asset move to the new one.
        </p>

        <div className="flex items-center gap-3 p-3 rounded-[5px] border border-[var(--bp-border)] bg-[var(--bp-surface-2)]/40">
          <img
            src={asset.display_url || asset.file_url}
            alt=""
            className="w-14 h-14 object-cover rounded-[3px] border border-[var(--bp-border)]"
          />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] text-[var(--bp-text-primary)] truncate">{asset.file_name}</p>
            <p className="text-[10px] text-[var(--bp-text-muted)] uppercase tracking-wider mt-0.5">
              Current version
            </p>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf,video/*"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="hidden"
          data-testid="replace-file-input"
        />

        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          data-testid="replace-pick-file-btn"
          className="mt-4 w-full px-4 py-3 rounded-[4px] border border-dashed border-[var(--bp-border-strong)]
                     text-[var(--bp-text-secondary)] hover:text-[var(--bp-primary)] hover:border-[var(--bp-primary)]/60
                     transition-colors text-[13px] font-body disabled:opacity-50"
        >
          {uploading ? `Uploading… ${progress}%` : 'Choose replacement file'}
        </button>

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            data-testid="replace-cancel-btn"
            className="px-3 py-1.5 text-[12px] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] font-body"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// Main Page
// ═════════════════════════════════════════════════════════════════════════
const MediaLibraryPage = () => {
  const { t } = useBlueprint();
  const [stats, setStats] = useState(null);
  const [colls, setColls] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [openedAsset, setOpenedAsset] = useState(null);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [filters, setFilters] = useState({
    q: '',
    type: '',
    used: null,
    collection_id: null,
  });
  const [searchInput, setSearchInput] = useState('');
  const fileInputRef = useRef(null);
  const dropZoneActive = useRef(false);

  // Debounced search
  useEffect(() => {
    const h = setTimeout(() => setFilters((f) => ({ ...f, q: searchInput })), 250);
    return () => clearTimeout(h);
  }, [searchInput]);

  const loadStats = useCallback(async () => {
    try { setStats(await media.stats()); } catch (_) {}
  }, []);

  const loadColls = useCallback(async () => {
    try { setColls((await collectionsApi.list()).data || []); } catch (_) {}
  }, []);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 120 };
      if (filters.q) params.q = filters.q;
      if (filters.type) params.type = filters.type;
      if (filters.used !== null) params.used = filters.used;
      if (filters.collection_id) params.collection_id = filters.collection_id;
      const r = await media.list(params);
      setAssets(r.data || []);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadStats(); loadColls(); }, [loadStats, loadColls]);
  useEffect(() => { loadAssets(); }, [loadAssets]);

  const reload = () => { loadStats(); loadColls(); loadAssets(); };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  // Upload via file picker / drop
  const handleUpload = async (filesList) => {
    const files = Array.from(filesList || []);
    if (!files.length) return;
    setUploadProgress({ total: files.length, done: 0, current: files[0]?.name });
    for (let i = 0; i < files.length; i += 1) {
      const f = files[i];
      setUploadProgress({ total: files.length, done: i, current: f.name });
      try {
        await uploadMediaFile({ file: f, folder: 'library' });
      } catch (e) {
        toast.error(`Upload failed for ${f.name}`);
      }
    }
    setUploadProgress(null);
    toast.success(`${files.length} asset${files.length > 1 ? 's' : ''} uploaded`);
    reload();
  };

  // Drag & drop on body
  useEffect(() => {
    const onDragOver = (e) => {
      e.preventDefault();
      dropZoneActive.current = true;
    };
    const onDrop = (e) => {
      e.preventDefault();
      dropZoneActive.current = false;
      if (e.dataTransfer?.files?.length) handleUpload(e.dataTransfer.files);
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const attachToCollection = async (collectionId) => {
    if (!selectedIds.length) return;
    await collectionsApi.attach(collectionId, selectedIds);
    toast.success(`${selectedIds.length} added to collection`);
    setSelectedIds([]);
    reload();
  };

  return (
    <div data-testid="media-library-page" className="flex h-full bg-[var(--bp-bg)] overflow-hidden">
      <SidebarPanel
        stats={stats}
        filters={filters}
        setFilters={setFilters}
        colls={colls}
        onCreateCollection={() => setShowNewCollection(true)}
        onOpenMaterials={() => { window.location.href = '/library/materials'; }}
      />

      <main className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <div className="h-14 px-6 flex items-center gap-3 border-b border-[var(--bp-border)] bg-[var(--bp-bg)]/80 backdrop-blur-sm">
          <div className="flex-1 max-w-xl relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--bp-text-muted)]" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search assets, tags, descriptions…"
              data-testid="media-search-input"
              className="w-full bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[5px]
                         pl-9 pr-3 py-2 text-[13px] text-[var(--bp-text-primary)]
                         placeholder:text-[var(--bp-text-muted)]
                         focus:outline-none focus:border-[var(--bp-primary)]/50 transition-colors"
            />
          </div>

          {selectedIds.length > 0 && (
            <div data-testid="bulk-bar" className="flex items-center gap-2 px-3 py-1.5 rounded-[5px] bg-[var(--bp-surface-2)]/60 border border-[var(--bp-border)]">
              <span className="text-[12px] text-[var(--bp-text-primary)] font-body">
                {selectedIds.length} selected
              </span>
              {colls.length > 0 && (
                <select
                  onChange={(e) => { if (e.target.value) { attachToCollection(e.target.value); e.target.value = ''; } }}
                  data-testid="bulk-attach-collection-select"
                  className="bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded text-[11px]
                             text-[var(--bp-text-secondary)] px-2 py-1 focus:outline-none"
                  defaultValue=""
                >
                  <option value="">Add to collection…</option>
                  {colls.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]"
              >
                <X size={13} />
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,application/pdf,video/*"
            onChange={(e) => handleUpload(e.target.files)}
            className="hidden"
            data-testid="upload-file-input"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            data-testid="upload-btn"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[5px] bg-[var(--bp-primary)] text-black
                       hover:opacity-90 transition-opacity text-[12px] font-body"
          >
            <Upload size={13} strokeWidth={2} />
            Upload
          </button>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && assets.length === 0 ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 size={20} className="animate-spin text-[var(--bp-text-muted)]" />
            </div>
          ) : assets.length === 0 ? (
            <EmptyState onUpload={() => fileInputRef.current?.click()} />
          ) : (
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}
              data-testid="media-grid"
            >
              {assets.map((a) => (
                <AssetTile
                  key={a.id}
                  asset={a}
                  selected={selectedIds.includes(a.id)}
                  onSelect={toggleSelect}
                  onOpen={(id) => setOpenedAsset(id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Upload progress */}
        {uploadProgress && (
          <div className="absolute bottom-6 right-6 z-30 px-4 py-3 rounded-md
                          bg-[var(--bp-surface-1)] border border-[var(--bp-border)] shadow-xl"
               data-testid="upload-progress-toast">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] font-body">
              Uploading {uploadProgress.done + 1} / {uploadProgress.total}
            </p>
            <p className="text-[12px] text-[var(--bp-text-primary)] truncate mt-1 max-w-[260px]">
              {uploadProgress.current}
            </p>
          </div>
        )}
      </main>

      {openedAsset && (
        <Inspector
          assetId={openedAsset}
          onClose={() => setOpenedAsset(null)}
          onChanged={reload}
          onReplaceStart={(a) => setReplaceTarget(a)}
        />
      )}

      {showNewCollection && (
        <NewCollectionModal
          onClose={() => setShowNewCollection(false)}
          onCreated={() => { loadColls(); }}
        />
      )}

      {replaceTarget && (
        <ReplaceModal
          asset={replaceTarget}
          onClose={() => setReplaceTarget(null)}
          onDone={() => reload()}
        />
      )}
    </div>
  );
};

const EmptyState = ({ onUpload }) => (
  <div className="h-full flex flex-col items-center justify-center text-center px-6 py-16">
    <div className="w-16 h-16 rounded-full bg-[var(--bp-surface-2)] border border-[var(--bp-border)] flex items-center justify-center mb-4">
      <Archive size={24} className="text-[var(--bp-text-muted)]" strokeWidth={1.3} />
    </div>
    <p className="text-[9px] tracking-[0.28em] uppercase text-[var(--bp-text-muted)] font-body mb-2">
      Empty archive
    </p>
    <h3 className="text-[24px] font-heading tracking-tight text-[var(--bp-text-primary)] mb-2">
      Your asset library is waiting
    </h3>
    <p className="text-[13px] text-[var(--bp-text-muted)] font-body max-w-md mb-6 leading-relaxed">
      Drag &amp; drop materials, renders, slabs, references, presentations.
      Everything you upload becomes part of your studio's operational archive — linkable
      to projects, moodboards, magazine articles and materials.
    </p>
    <button
      type="button"
      onClick={onUpload}
      data-testid="empty-state-upload-btn"
      className="inline-flex items-center gap-2 px-5 py-2 rounded-[5px] bg-[var(--bp-primary)] text-black
                 hover:opacity-90 transition-opacity text-[13px] font-body"
    >
      <Upload size={14} />
      Upload first assets
    </button>
  </div>
);

export default MediaLibraryPage;
