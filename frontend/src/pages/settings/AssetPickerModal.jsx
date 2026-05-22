// ──────────────────────────────────────────────────────────────────────
// MOOD for DESIGN™ — Editorial Asset Picker (Phase Y.3.A)
// Cinematic modal that bridges Magazine Editor ↔ Media Library v2.
// "Adding atmosphere to a story" — NOT "uploading files".
// ──────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Search, Upload, Image as ImageIcon, Check, AlertCircle, Loader2, FolderOpen, Sparkles, RefreshCw, Edit2, Link2 } from 'lucide-react';
import { media, links, uploadMediaFile } from '../../lib/mediaApi';
import ImageEditModal from '../../components/common/ImageEditModal';
import { toast } from 'sonner';
import './asset-picker.css';
import { useT } from '../../i18n/useT';

// Default editorial taxonomy hints for quick-tagging during upload.
// These are SUGGESTIONS — users can free-type their own.
const QUICK_TAGS = ['mediterranean', 'warm-minimalism', 'hospitality-inspired', 'sculptural-stone', 'natural-oak', 'travertine', 'soft-lighting', 'organic-texture', 'refined-calm'];
const CATEGORY_PRESETS = ['residential', 'hospitality', 'retail', 'workspace', 'outdoor', 'materials', 'lighting', 'atmospheres'];

// ─── helpers ────────────────────────────────────────────────────────────
const fileChecksum = async file => {
  try {
    const buf = await file.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  } catch {
    return null;
  }
};

// ─── Asset card ────────────────────────────────────────────────────────
const AssetCard = ({
  asset,
  selected,
  onClick,
  onEdit
}) => {
  const {
    t
  } = useT();
  return <button type="button" onClick={onClick} className={`mfd-picker__card ${selected ? 'is-selected' : ''}`} data-testid={`picker-asset-${asset.id}`} aria-label={asset.alt_text || asset.file_name}>
    <div className="mfd-picker__card-media">
      {(asset.display_url || asset.file_url) && <img src={asset.display_url || asset.file_url} alt="" loading="lazy" />}
      {selected && <div className="mfd-picker__card-check"><Check size={14} strokeWidth={2} /></div>}
      <button type="button" onClick={e => {
        e.stopPropagation();
        onEdit?.(asset);
      }} className="mfd-picker__card-edit" title={t("settings.asset_picker.modifica_crop_filtri")} aria-label={`Modifica ${asset.file_name}`} data-testid={`picker-asset-edit-${asset.id}`}>
        <Edit2 size={12} strokeWidth={1.8} />
      </button>
    </div>
    <div className="mfd-picker__card-meta">
      <p className="mfd-picker__card-name">{asset.file_name}</p>
      {asset.category && <span className="mfd-picker__card-chip">{asset.category}</span>}
    </div>
  </button>;
};

// ─── Upload row ─────────────────────────────────────────────────────────
const UploadRow = ({
  item
}) => <div className={`mfd-picker__upload-row mfd-picker__upload-row--${item.status}`} data-testid={`upload-row-${item.id}`}>
    <div className="mfd-picker__upload-thumb">
      {item.preview && <img src={item.preview} alt="" />}
    </div>
    <div className="mfd-picker__upload-meta">
      <p className="mfd-picker__upload-name">{item.file.name}</p>
      <p className="mfd-picker__upload-sub">
        {(item.file.size / 1024).toFixed(0)} KB
        {item.status === 'uploading' && ` · ${item.progress}%`}
        {item.status === 'done' && ' · uploaded'}
        {item.status === 'duplicate' && ' · duplicate (auto-resolved)'}
        {item.status === 'error' && ` · ${item.error}`}
      </p>
      {item.status === 'uploading' && <div className="mfd-picker__progress">
          <div className="mfd-picker__progress-bar" style={{
        width: `${item.progress}%`
      }} />
        </div>}
    </div>
    <div className="mfd-picker__upload-status">
      {item.status === 'uploading' && <Loader2 size={14} strokeWidth={1.6} className="animate-spin" />}
      {item.status === 'done' && <Check size={14} strokeWidth={1.8} />}
      {item.status === 'duplicate' && <Sparkles size={14} strokeWidth={1.6} />}
      {item.status === 'error' && <AlertCircle size={14} strokeWidth={1.6} />}
    </div>
  </div>;

// ─── Main modal ────────────────────────────────────────────────────────
const AssetPickerModal = ({
  open,
  onClose,
  onSelect,
  // ({asset}) => void
  articleId,
  // string — auto-links picked/uploaded asset to this article (legacy)
  entityType,
  // 'magazine_article' | 'branding_asset' | 'cms_section' | 'cms_page' | …
  entityId,
  // generic entity id (alternative to articleId)
  role = 'body',
  // 'hero' | 'body' | 'gallery' | 'logo' | … — stored on media_links
  bucket,
  // override bucket (default magazine-media for legacy, tenant-assets otherwise)
  folder,
  // override folder (default magazine/<id>)
  defaultTab = 'library',
  title,
  // optional custom modal title
  eyebrow // optional custom modal eyebrow
}) => {
  const {
    t
  } = useT();
  // Resolve effective entity reference (new generic > legacy articleId).
  const eType = entityType || (articleId ? 'magazine_article' : null);
  const eId = entityId || articleId || null;
  const uploadBucket = bucket || (eType === 'magazine_article' ? 'magazine-media' : 'tenant-assets');
  const uploadFolder = folder || (eType ? `${eType}/${eId || 'orphan'}` : 'library');
  const [tab, setTab] = useState(defaultTab);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeTag, setActiveTag] = useState(null);
  const [stats, setStats] = useState({
    categories: {},
    tags: {}
  });
  const [selectedId, setSelectedId] = useState(null);
  const [queue, setQueue] = useState([]); // [{id, file, preview, status, progress, asset?, error?}]
  const [quickCategory, setQuickCategory] = useState(null);
  const [quickTags, setQuickTags] = useState([]);
  const fileInputRef = useRef(null);
  const dropRef = useRef(null);
  const checksumRef = useRef(new Map()); // local dedupe within session

  // URL tab state — external image linking
  const [urlInput, setUrlInput] = useState('');
  const [urlAlt, setUrlAlt] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);

  // Edit modal state — opens when user clicks the pen icon on a card
  const [editingAsset, setEditingAsset] = useState(null);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setTab(defaultTab);
    setSelectedId(null);
    setQuery('');
    setActiveCategory(null);
    setActiveTag(null);
  }, [open, defaultTab]);

  // Load assets when filters change
  useEffect(() => {
    if (!open || tab !== 'library') return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const params = {
          type: 'image',
          limit: 60
        };
        if (query) params.q = query;
        if (activeCategory) params.category = activeCategory;
        if (activeTag) params.tag = activeTag;
        const r = await media.list(params);
        if (alive) setAssets(r?.data || []);
      } catch (_) {
        if (alive) setAssets([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, tab, query, activeCategory, activeTag]);

  // Load stats once per open for the chip universe
  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      try {
        const s = await media.stats();
        if (alive) setStats({
          categories: s?.categories || {},
          tags: s?.tags || {}
        });
      } catch (_) {/* ignore */}
    })();
    return () => {
      alive = false;
    };
  }, [open]);
  const categoryList = useMemo(() => {
    const fromStats = Object.keys(stats.categories || {});
    const set = new Set([...CATEGORY_PRESETS, ...fromStats]);
    return Array.from(set);
  }, [stats]);
  const topTags = useMemo(() => {
    const entries = Object.entries(stats.tags || {});
    entries.sort((a, b) => (b[1] || 0) - (a[1] || 0));
    return entries.slice(0, 10).map(([t]) => t);
  }, [stats]);

  // ─── Link helper ──────────────────────────────────────────────────────
  const linkAndReturn = useCallback(async asset => {
    if (eType && eId) {
      try {
        await links.create(asset.id, {
          entity_type: eType,
          entity_id: eId,
          role
        });
      } catch (_) {/* link is best-effort — picker still resolves */}
    }
    onSelect?.({
      asset
    });
    onClose?.();
  }, [eType, eId, role, onSelect, onClose]);

  // ─── Drop handlers ────────────────────────────────────────────────────
  const handleFiles = useCallback(async fileList => {
    const files = Array.from(fileList || []).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;
    setTab('upload');
    const newItems = await Promise.all(files.map(async file => {
      const preview = URL.createObjectURL(file);
      const sum = await fileChecksum(file);
      return {
        id: `up_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        file,
        preview,
        status: 'queued',
        progress: 0,
        checksum: sum
      };
    }));
    setQueue(q => [...q, ...newItems]);

    // Sequential upload to keep visual rhythm calm (not enterprise-burst)
    for (const item of newItems) {
      // Dedupe locally — if we already uploaded a file with same checksum
      // in this session, reuse the resulting asset
      if (item.checksum && checksumRef.current.has(item.checksum)) {
        const cached = checksumRef.current.get(item.checksum);
        setQueue(q => q.map(x => x.id === item.id ? {
          ...x,
          status: 'duplicate',
          progress: 100,
          asset: cached
        } : x));
        continue;
      }
      setQueue(q => q.map(x => x.id === item.id ? {
        ...x,
        status: 'uploading'
      } : x));
      try {
        const asset = await uploadMediaFile({
          file: item.file,
          bucket: uploadBucket,
          folder: uploadFolder,
          category: quickCategory,
          tags: quickTags,
          alt_text: null,
          description: null,
          onProgress: p => setQueue(q => q.map(x => x.id === item.id ? {
            ...x,
            progress: p
          } : x))
        });
        if (item.checksum) checksumRef.current.set(item.checksum, asset);
        // Best-effort auto-link
        if (eType && eId) {
          try {
            await links.create(asset.id, {
              entity_type: eType,
              entity_id: eId,
              role
            });
          } catch (_) {}
        }
        setQueue(q => q.map(x => x.id === item.id ? {
          ...x,
          status: 'done',
          progress: 100,
          asset
        } : x));
      } catch (err) {
        setQueue(q => q.map(x => x.id === item.id ? {
          ...x,
          status: 'error',
          error: err.message || 'upload failed'
        } : x));
      }
    }
  }, [eType, eId, role, quickCategory, quickTags, uploadBucket, uploadFolder]);
  const onDragOver = e => {
    e.preventDefault();
    e.stopPropagation();
    dropRef.current?.classList.add('is-over');
  };
  const onDragLeave = e => {
    e.preventDefault();
    e.stopPropagation();
    dropRef.current?.classList.remove('is-over');
  };
  const onDrop = e => {
    e.preventDefault();
    e.stopPropagation();
    dropRef.current?.classList.remove('is-over');
    handleFiles(e.dataTransfer.files);
  };

  // ─── Pick the first successfully uploaded asset (or selected card) ────
  const completedAsset = useMemo(() => {
    const done = queue.find(x => x.status === 'done' || x.status === 'duplicate');
    return done?.asset;
  }, [queue]);
  if (!open) return null;
  return <div className="mfd-picker__backdrop" onClick={onClose} data-testid="asset-picker-modal">
      <div className="mfd-picker__panel" onClick={e => e.stopPropagation()}>
        <header className="mfd-picker__header">
          <div>
            <p className="mfd-picker__eyebrow">{eyebrow || 'EDITORIAL ARCHIVE'}</p>
            <h2 className="mfd-picker__title">{title || 'Aggiungi atmosfera al racconto'}</h2>
          </div>
          <button type="button" onClick={onClose} className="mfd-picker__close" data-testid="asset-picker-close" aria-label="Close">
            <X size={16} strokeWidth={1.6} />
          </button>
        </header>

        <div className="mfd-picker__tabs">
          <button type="button" className={`mfd-picker__tab ${tab === 'library' ? 'is-active' : ''}`} onClick={() => setTab('library')} data-testid="asset-picker-tab-library">
            <FolderOpen size={12} strokeWidth={1.6} /> Library
          </button>
          <button type="button" className={`mfd-picker__tab ${tab === 'upload' ? 'is-active' : ''}`} onClick={() => setTab('upload')} data-testid="asset-picker-tab-upload">
            <Upload size={12} strokeWidth={1.6} /> Upload
          </button>
          <button type="button" className={`mfd-picker__tab ${tab === 'url' ? 'is-active' : ''}`} onClick={() => setTab('url')} data-testid="asset-picker-tab-url">
            <Link2 size={12} strokeWidth={1.6} /> URL
          </button>
        </div>

        {tab === 'library' && <div className="mfd-picker__body" data-testid="asset-picker-library">
            <div className="mfd-picker__filters">
              <div className="mfd-picker__search">
                <Search size={12} strokeWidth={1.6} />
                <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder={t("settings.asset_picker.cerca_per_nome_descrizione_alt")} data-testid="asset-picker-search" />
              </div>
              <div className="mfd-picker__chips">
                <button type="button" className={`mfd-picker__chip ${!activeCategory ? 'is-active' : ''}`} onClick={() => setActiveCategory(null)} data-testid="asset-picker-cat-all">All</button>
                {categoryList.slice(0, 6).map(c => <button key={c} type="button" className={`mfd-picker__chip ${activeCategory === c ? 'is-active' : ''}`} onClick={() => setActiveCategory(activeCategory === c ? null : c)} data-testid={`asset-picker-cat-${c}`}>
                    {c}
                  </button>)}
              </div>
              {topTags.length > 0 && <div className="mfd-picker__chips mfd-picker__chips--secondary">
                  {topTags.map(t => <button key={t} type="button" className={`mfd-picker__chip mfd-picker__chip--ghost ${activeTag === t ? 'is-active' : ''}`} onClick={() => setActiveTag(activeTag === t ? null : t)} data-testid={`asset-picker-tag-${t}`}>
                      #{t}
                    </button>)}
                </div>}
            </div>

            {loading && <div className="mfd-picker__loading" data-testid="asset-picker-loading">
                <Loader2 size={18} className="animate-spin" /> <span>{t('settings.asset_picker.caricamento')}</span>
              </div>}

            {!loading && assets.length === 0 && <div className="mfd-picker__empty" data-testid="asset-picker-empty">
                <ImageIcon size={28} strokeWidth={1} />
                <p>{t('settings.asset_picker.nessun_asset_corrisponde_carica_nuove_immagini_per')}</p>
                <button type="button" onClick={() => setTab('upload')} className="mfd-picker__btn mfd-picker__btn--gold">
                  <Upload size={11} strokeWidth={1.6} /> {t("settings.asset_picker.carica_file")}
                </button>
              </div>}

            {!loading && assets.length > 0 && <div className="mfd-picker__grid" data-testid="asset-picker-grid">
                {assets.map(a => <AssetCard key={a.id} asset={a} selected={selectedId === a.id} onClick={() => setSelectedId(a.id)} onEdit={asset => setEditingAsset(asset)} />)}
              </div>}

            <footer className="mfd-picker__footer">
              <p className="mfd-picker__footer-meta">
                {assets.length} {assets.length === 1 ? 'asset' : 'assets'}
              </p>
              <div className="mfd-picker__footer-actions">
                <button type="button" onClick={onClose} className="mfd-picker__btn mfd-picker__btn--ghost" data-testid="asset-picker-cancel">
                  {t("settings.asset_picker.annulla")}
                </button>
                <button type="button" disabled={!selectedId} onClick={() => {
              const a = assets.find(x => x.id === selectedId);
              if (a) linkAndReturn(a);
            }} className="mfd-picker__btn mfd-picker__btn--gold" data-testid="asset-picker-use">
                  Usa
                </button>
              </div>
            </footer>
          </div>}

        {tab === 'upload' && <div className="mfd-picker__body" data-testid="asset-picker-upload">
            <div ref={dropRef} className="mfd-picker__drop" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} onClick={() => fileInputRef.current?.click()} data-testid="asset-picker-drop">
              <Upload size={28} strokeWidth={1.2} />
              <p className="mfd-picker__drop-title">{t('settings.asset_picker.trascina_qui_le_immagini')}</p>
              <p className="mfd-picker__drop-sub">
                o <span className="mfd-picker__drop-link">{t('settings.asset_picker.scegli_dal_computer')}</span> · jpg / png / webp / heic
              </p>
              <input ref={fileInputRef} type="file" multiple accept="image/*" style={{
            display: 'none'
          }} onChange={e => handleFiles(e.target.files)} data-testid="asset-picker-file-input" />
            </div>

            <div className="mfd-picker__quick">
              <p className="mfd-picker__quick-label">Tagga rapidamente</p>
              <div className="mfd-picker__chips">
                {CATEGORY_PRESETS.map(c => <button key={c} type="button" className={`mfd-picker__chip ${quickCategory === c ? 'is-active' : ''}`} onClick={() => setQuickCategory(quickCategory === c ? null : c)} data-testid={`upload-quick-cat-${c}`}>
                    {c}
                  </button>)}
              </div>
              <div className="mfd-picker__chips mfd-picker__chips--secondary">
                {QUICK_TAGS.map(t => <button key={t} type="button" className={`mfd-picker__chip mfd-picker__chip--ghost ${quickTags.includes(t) ? 'is-active' : ''}`} onClick={() => setQuickTags(qt => qt.includes(t) ? qt.filter(x => x !== t) : [...qt, t])} data-testid={`upload-quick-tag-${t}`}>
                    #{t}
                  </button>)}
              </div>
            </div>

            {queue.length > 0 && <div className="mfd-picker__queue" data-testid="asset-picker-queue">
                {queue.map(item => <UploadRow key={item.id} item={item} />)}
              </div>}

            <footer className="mfd-picker__footer">
              <p className="mfd-picker__footer-meta">
                {queue.filter(x => x.status === 'done' || x.status === 'duplicate').length}/{queue.length} pronti
              </p>
              <div className="mfd-picker__footer-actions">
                <button type="button" onClick={onClose} className="mfd-picker__btn mfd-picker__btn--ghost">
                  {t("settings.asset_picker.chiudi")}
                </button>
                <button type="button" disabled={!completedAsset} onClick={() => completedAsset && linkAndReturn(completedAsset)} className="mfd-picker__btn mfd-picker__btn--gold" data-testid="asset-picker-use-uploaded">
                  Usa
                </button>
              </div>
            </footer>
          </div>}

        {tab === 'url' && <div className="mfd-picker__body" data-testid="asset-picker-url">
            <div className="mfd-picker__url" style={{
          padding: '28px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14
        }}>
              <p style={{
            fontSize: 12.5,
            color: 'var(--bp-text-muted)',
            lineHeight: 1.55
          }}>
                {t("settings.asset_picker.incolla_un_url_pubblico_https_di_un_immagine_verra")}
              </p>
              <div>
                <label className="mfd-picker__label">URL immagine</label>
                <input type="url" value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="https://images.example.com/photo.jpg" className="mfd-picker__input" data-testid="asset-picker-url-input" autoFocus />
              </div>
              <div>
                <label className="mfd-picker__label">Alt text (accessibilità)</label>
                <input type="text" value={urlAlt} onChange={e => setUrlAlt(e.target.value)} placeholder="Descrizione breve per screen reader" className="mfd-picker__input" data-testid="asset-picker-url-alt" />
              </div>
              {urlInput && <div className="mfd-picker__url-preview" style={{
            marginTop: 8,
            padding: 12,
            border: '1px solid var(--bp-border)',
            borderRadius: 4,
            background: 'var(--bp-surface)'
          }}>
                  <img src={urlInput} alt={urlAlt || 'preview'} style={{
              maxWidth: '100%',
              maxHeight: 280,
              display: 'block',
              margin: '0 auto',
              objectFit: 'contain'
            }} onError={e => {
              e.target.style.display = 'none';
            }} data-testid="asset-picker-url-preview" />
                </div>}
            </div>
            <footer className="mfd-picker__footer">
              <p className="mfd-picker__footer-meta">Link esterno</p>
              <div className="mfd-picker__footer-actions">
                <button type="button" onClick={onClose} className="mfd-picker__btn mfd-picker__btn--ghost">
                  {t("settings.asset_picker.annulla")}
                </button>
                <button type="button" disabled={!urlInput || urlLoading} onClick={async () => {
              if (!urlInput) return;
              setUrlLoading(true);
              try {
                const pseudo = {
                  id: null,
                  file_url: urlInput,
                  display_url: urlInput,
                  file_name: urlInput.split('/').pop() || 'external',
                  alt_text: urlAlt,
                  category: 'external_url',
                  external: true
                };
                onSelect?.({
                  asset: pseudo
                });
                onClose?.();
              } catch (e) {
                toast.error('URL non valido');
              } finally {
                setUrlLoading(false);
              }
            }} className="mfd-picker__btn mfd-picker__btn--gold" data-testid="asset-picker-url-use">
                  {urlLoading ? '…' : 'Usa URL'}
                </button>
              </div>
            </footer>
          </div>}

        {/* Image edit modal — pen icon → crop + filters */}
        {editingAsset && <ImageEditModal open asset={editingAsset} onClose={() => setEditingAsset(null)} onSaved={saved => {
        setEditingAsset(null);
        // Refresh the asset in the local list
        setAssets(prev => prev.map(a => a.id === saved.id ? {
          ...a,
          ...saved
        } : a));
      }} />}
      </div>
    </div>;
};
export default AssetPickerModal;