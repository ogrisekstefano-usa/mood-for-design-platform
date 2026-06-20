/**
 * StorySectionsEditor™
 * ────────────────────────────────────────────────────────────────────
 * Block-based editor for narrative content. Reused by:
 *   • Projects · story_body (master + variants)
 *   • Magazine · body_blocks (article variants)
 *
 * Block types (intentionally minimal — editorial, not Notion):
 *   • paragraph         { type: 'paragraph', text }
 *   • pull_quote        { type: 'pull_quote', text, attribution? }
 *   • image_block       { type: 'image', url, asset_id?, caption?, alt? }
 *   • gallery_block     { type: 'gallery', items: [{url, caption, alt}] }
 *   • hotspot_image     { type: 'hotspot_image', id, url, asset_id?, caption?, hotspots: [...] }
 *   • cta_block         { type: 'cta', label, action, tier }
 *
 * Hotspot persistence:
 *   • In "memory" mode (Projects) → hotspots stored inside block.hotspots[].
 *   • In "remote" mode (Magazine) → HotspotImageOverlay uses block.id as
 *     `block_id` against /api/magazine/admin/articles/{aid}/hotspots.
 *
 * Reorder: HTML5 drag&drop on a left-side handle.
 */
import React, { useState, useCallback } from 'react';
import { GripVertical, Trash2, Plus, Type, Quote, Image as ImgIcon, Images as GalleryIcon, MapPin, Megaphone, ChevronDown, ChevronUp, Youtube } from 'lucide-react';
import EditorialMediaField from '../common/EditorialMediaField';
import HotspotImageOverlay from './HotspotImageOverlay';
import './storytelling.css';
import { useT } from '../../i18n/useT';
const BLOCK_TYPES = [{
  id: 'paragraph',
  label: 'Paragrafo',
  icon: Type
}, {
  id: 'pull_quote',
  label: 'Pull Quote',
  icon: Quote
}, {
  id: 'image',
  label: 'Immagine',
  icon: ImgIcon
}, {
  id: 'gallery',
  label: 'Mini gallery',
  icon: GalleryIcon
}, {
  id: 'hotspot_image',
  label: 'Immagine + Detail Points',
  icon: MapPin
}, {
  id: 'youtube',
  label: 'Video YouTube',
  icon: Youtube
}, {
  id: 'cta',
  label: 'Call to Action',
  icon: Megaphone
}];
const newBlockId = () => `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const StorySectionsEditor = ({
  blocks = [],
  onChange,
  // Hotspot mode for the entire editor (Magazine = remote, Projects = memory)
  hotspotMode = 'memory',
  remoteArticleId,
  entityType,
  entityId,
  testId = 'story-sections',
  readOnly = false
}) => {
  const {
    t
  } = useT();
  const [showAdd, setShowAdd] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const [hotspotBlockId, setHotspotBlockId] = useState(null);

  // Backward-compat: ensure every block has an id (legacy blocks may not).
  // We migrate lazily on mount so subsequent renders use stable IDs (otherwise
  // React keys would flicker and input focus would be lost on every keystroke).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const safeBlocks = React.useMemo(() => blocks.map((b, i) => b.id ? b : {
    ...b,
    id: `legacy_${i}_${Math.random().toString(36).slice(2, 8)}`
  }), [blocks]);

  // Persist the id migration upstream once when needed (idempotent).
  React.useEffect(() => {
    const needsMigration = blocks.some(b => !b.id);
    if (needsMigration) onChange?.(safeBlocks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeBlocks]);
  const updateBlock = useCallback((id, patch) => {
    const next = safeBlocks.map(b => b.id === id ? {
      ...b,
      ...patch
    } : b);
    onChange?.(next);
  }, [safeBlocks, onChange]);
  const removeBlock = id => {
    if (!confirm('Eliminare questo blocco?')) return;
    onChange?.(safeBlocks.filter(b => b.id !== id));
  };
  const moveBlock = (from, to) => {
    if (from === to) return;
    const next = [...safeBlocks];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    onChange?.(next);
  };
  const moveUp = idx => idx > 0 && moveBlock(idx, idx - 1);
  const moveDown = idx => idx < safeBlocks.length - 1 && moveBlock(idx, idx + 1);
  const addBlock = type => {
    const base = {
      id: newBlockId(),
      type
    };
    let block;
    switch (type) {
      case 'paragraph':
        block = {
          ...base,
          text: ''
        };
        break;
      case 'pull_quote':
        block = {
          ...base,
          text: '',
          attribution: ''
        };
        break;
      case 'image':
        block = {
          ...base,
          url: '',
          asset_id: null,
          caption: '',
          alt_text: ''
        };
        break;
      case 'gallery':
        block = {
          ...base,
          items: []
        };
        break;
      case 'hotspot_image':
        block = {
          ...base,
          url: '',
          asset_id: null,
          caption: '',
          hotspots: []
        };
        break;
      case 'cta':
        block = {
          ...base,
          label: '',
          action: 'save_reference',
          tier: 'soft'
        };
        break;
      case 'youtube':
        block = {
          ...base,
          url:      '',
          video_id: '',
          title:    ''
        };
        break;
      default:
        block = {
          ...base,
          text: ''
        };
    }
    onChange?.([...safeBlocks, block]);
    setShowAdd(false);
  };
  return <section className="ss-wrap" data-testid={testId}>
      <header className="ss-head">
        <p className="ss-eyebrow">{t('atelier_voice.story_sections.eyebrow', null, 'Visual narrative')}</p>
        <h3 className="ss-title">{t('storytelling.story_sections.sezioni_della_storia')}</h3>
        <p className="ss-sub">
          {t("storytelling.story_sections.componi_blocchi_editoriali_testo_immagini_gallery")}
        </p>
      </header>

      {safeBlocks.length === 0 && <div className="ss-empty" data-testid="ss-empty">
          <p>{t('storytelling.story_sections.nessun_blocco_ancora_inizia_la_narrazione')}</p>
        </div>}

      <div className="ss-blocks">
        {safeBlocks.map((b, idx) => <BlockRow key={b.id} block={b} index={idx} total={safeBlocks.length} readOnly={readOnly} entityType={entityType} entityId={entityId} onChange={patch => updateBlock(b.id, patch)} onRemove={() => removeBlock(b.id)} onMoveUp={() => moveUp(idx)} onMoveDown={() => moveDown(idx)} onDragStart={() => setDragIdx(idx)} onDrop={() => {
        if (dragIdx !== null) moveBlock(dragIdx, idx);
        setDragIdx(null);
      }} onOpenHotspots={() => setHotspotBlockId(b.id)} />)}
      </div>

      {!readOnly && <div className="ss-addbar">
          {!showAdd ? <button type="button" className="ss-add-trigger" data-testid="ss-add-trigger" onClick={() => setShowAdd(true)}>
              <Plus size={13} /> {t("storytelling.story_sections.aggiungi_blocco")}
            </button> : <div className="ss-add-menu" data-testid="ss-add-menu">
              {BLOCK_TYPES.map(t => {
          const Icon = t.icon;
          return <button key={t.id} type="button" className="ss-add-opt" data-testid={`ss-add-${t.id}`} onClick={() => addBlock(t.id)}>
                    <Icon size={13} strokeWidth={1.4} />
                    <span>{t.label}</span>
                  </button>;
        })}
              <button type="button" className="ss-add-opt ss-add-opt--cancel" onClick={() => setShowAdd(false)}>{t('storytelling.story_sections.annulla')}</button>
            </div>}
        </div>}

      {/* Hotspot overlay for the active hotspot_image block */}
      {hotspotBlockId && (() => {
      const blk = safeBlocks.find(b => b.id === hotspotBlockId);
      if (!blk) return null;
      const isRemote = hotspotMode === 'remote' && remoteArticleId;
      return <HotspotImageOverlay open imageUrl={blk.url} imageCaption={blk.caption} hotspots={blk.hotspots || []} mode={isRemote ? 'remote' : 'memory'} remoteArticleId={remoteArticleId} remoteBlockId={blk.id} onChange={nextHs => updateBlock(blk.id, {
        hotspots: nextHs
      })} onClose={() => setHotspotBlockId(null)} />;
    })()}
    </section>;
};

// ─── Block Row ────────────────────────────────────────────────────
const BlockRow = ({
  block,
  index,
  total,
  readOnly,
  entityType,
  entityId,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDrop,
  onOpenHotspots
}) => {
  const {
    t
  } = useT();
  const meta = BLOCK_TYPES.find(t => t.id === block.type) || BLOCK_TYPES[0];
  const Icon = meta.icon;
  return <article className={`ss-block ss-block--${block.type}`} data-testid={`ss-block-${index}`} data-block-type={block.type} draggable={!readOnly} onDragStart={onDragStart} onDragOver={e => e.preventDefault()} onDrop={e => {
    e.preventDefault();
    onDrop?.();
  }}>
      <header className="ss-block__head">
        <span className="ss-block__handle" title="Trascina">
          <GripVertical size={13} strokeWidth={1.5} />
        </span>
        <span className="ss-block__type">
          <Icon size={11} strokeWidth={1.6} /> {meta.label}
        </span>
        {!readOnly && <div className="ss-block__act">
            <button type="button" className="ss-mini" title="Sposta su" data-testid={`ss-up-${index}`} disabled={index === 0} onClick={onMoveUp}><ChevronUp size={11} /></button>
            <button type="button" className="ss-mini" title="Sposta giù" data-testid={`ss-down-${index}`} disabled={index === total - 1} onClick={onMoveDown}><ChevronDown size={11} /></button>
            <button type="button" className="ss-mini ss-mini--danger" data-testid={`ss-del-${index}`} title={t("storytelling.story_sections.elimina_blocco")} onClick={onRemove}><Trash2 size={11} /></button>
          </div>}
      </header>
      <div className="ss-block__body">
        {block.type === 'paragraph' && <textarea className="ss-textarea" rows={4} data-testid={`ss-text-${index}`} value={block.text || ''} onChange={e => onChange({
        text: e.target.value
      })} placeholder={t("storytelling.story_sections.paragrafo_editoriale")} />}
        {block.type === 'pull_quote' && <>
            <textarea className="ss-textarea ss-textarea--quote" rows={2} data-testid={`ss-quote-${index}`} value={block.text || ''} onChange={e => onChange({
          text: e.target.value
        })} placeholder={t("storytelling.story_sections.la_frase_che_rimane")} />
            <input className="ss-input ss-input--small" placeholder="— Attribuzione (opzionale)" data-testid={`ss-attribution-${index}`} value={block.attribution || ''} onChange={e => onChange({
          attribution: e.target.value
        })} />
          </>}
        {block.type === 'image' && <>
            <EditorialMediaField valueShape="object" value={{
          url: block.url || '',
          asset_id: block.asset_id,
          alt_text: block.alt_text || '',
          caption: block.caption || ''
        }} onChange={v => onChange({
          url: v.url,
          asset_id: v.asset_id,
          alt_text: v.alt_text,
          caption: v.caption
        })} preset="hero" entityType={entityType} entityId={entityId} role={`story_image_${index}`} testId={`ss-img-${index}`} />
          </>}
        {block.type === 'gallery' && <MiniGalleryEditor items={block.items || []} onChange={items => onChange({
        items
      })} entityType={entityType} entityId={entityId} blockIndex={index} />}
        {block.type === 'hotspot_image' && <>
            <EditorialMediaField valueShape="object" value={{
          url: block.url || '',
          asset_id: block.asset_id,
          alt_text: block.alt_text || '',
          caption: block.caption || ''
        }} onChange={v => onChange({
          url: v.url,
          asset_id: v.asset_id,
          alt_text: v.alt_text,
          caption: v.caption
        })} preset="hero" entityType={entityType} entityId={entityId} role={`story_hotspot_${index}`} testId={`ss-himg-${index}`} />
            {block.url && <div className="ss-hs-bar">
                <span className="ss-hs-count">
                  <MapPin size={11} /> {(block.hotspots || []).length} Detail Points
                </span>
                <button type="button" className="ss-btn" data-testid={`ss-open-hotspots-${index}`} onClick={onOpenHotspots}>{t('storytelling.story_sections.apri_editor_hotspot')}</button>
              </div>}
          </>}
        {block.type === 'cta' && <div className="ss-cta-row">
            <select className="ss-select" data-testid={`ss-cta-tier-${index}`} value={block.tier || 'soft'} onChange={e => onChange({
          tier: e.target.value
        })}>
              <option value="soft">Soft</option>
              <option value="medium">Medium</option>
              <option value="strong">Strong</option>
            </select>
            <input className="ss-input" placeholder={t("storytelling.story_sections.copy_editoriale_cta")} data-testid={`ss-cta-label-${index}`} value={block.label || ''} onChange={e => onChange({
          label: e.target.value
        })} />
            <select className="ss-select" data-testid={`ss-cta-action-${index}`} value={block.action || 'save_reference'} onChange={e => onChange({
          action: e.target.value
        })}>
              <option value="save_reference">Save reference</option>
              <option value="discuss_with_advisor">Discuss with advisor</option>
              <option value="add_to_moodboard">{t('storytelling.story_sections.add_to_moodboard')}</option>
              <option value="explore_material">{t('storytelling.story_sections.explore_material')}</option>
              <option value="book_visit">Book visit</option>
              <option value="book_consultation">Book consultation</option>
            </select>
          </div>}
        {block.type === 'youtube' && <div className="ss-youtube-block">
            <input className="ss-input" style={{marginBottom: 8}} placeholder="URL YouTube · es. https://www.youtube.com/watch?v=..." data-testid={`ss-yt-url-${index}`} value={block.url || ''} onChange={e => {
              const url = e.target.value;
              const m = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/);
              onChange({ url, video_id: m ? m[1] : (block.video_id || '') });
            }} />
            <input className="ss-input ss-input--small" placeholder="Titolo video (opzionale)" data-testid={`ss-yt-title-${index}`} value={block.title || ''} onChange={e => onChange({ title: e.target.value })} />
            {block.video_id && <div className="ss-youtube-preview" style={{marginTop: 8, background: '#111', borderRadius: 4, overflow: 'hidden', aspectRatio: '16/9', position: 'relative'}}>
                <iframe
                  style={{position:'absolute',inset:0,width:'100%',height:'100%',border:'none'}}
                  src={`https://www.youtube.com/embed/${block.video_id}`}
                  title={block.title || 'YouTube video'}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>}
          </div>}
      </div>
    </article>;
};

// ─── Mini Gallery Editor (inline, no drag — keep it simple) ──────
const MiniGalleryEditor = ({
  items,
  onChange,
  entityType,
  entityId,
  blockIndex
}) => {
  const {
    t
  } = useT();
  const addItem = () => onChange([...items, {
    id: `mg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    url: '',
    asset_id: null,
    caption: '',
    alt_text: ''
  }]);
  const updateItem = (id, patch) => {
    onChange(items.map(i => i.id === id ? {
      ...i,
      ...patch
    } : i));
  };
  const removeItem = id => onChange(items.filter(i => i.id !== id));
  return <div className="ss-mg" data-testid={`ss-gallery-${blockIndex}`}>
      <div className="ss-mg-grid">
        {items.map((it, i) => <div key={it.id} className="ss-mg-cell" data-testid={`ss-gallery-${blockIndex}-cell-${i}`}>
            <EditorialMediaField valueShape="object" value={{
          url: it.url || '',
          asset_id: it.asset_id,
          alt_text: it.alt_text || '',
          caption: it.caption || ''
        }} onChange={v => updateItem(it.id, {
          url: v.url,
          asset_id: v.asset_id,
          alt_text: v.alt_text,
          caption: v.caption
        })} preset="gallery" entityType={entityType} entityId={entityId} role={`gallery_block_${blockIndex}_${i}`} />
            <button type="button" className="ss-mg-rm" data-testid={`ss-gallery-${blockIndex}-rm-${i}`} onClick={() => removeItem(it.id)}>Rimuovi</button>
          </div>)}
        <button type="button" className="ss-mg-add" data-testid={`ss-gallery-${blockIndex}-add`} onClick={addItem}><Plus size={14} /> {t("storytelling.story_sections.aggiungi_immagine")}</button>
      </div>
    </div>;
};
export default StorySectionsEditor;