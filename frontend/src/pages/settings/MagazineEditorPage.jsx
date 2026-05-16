// ──────────────────────────────────────────────────────────────────────
// MOOD for DESIGN™ — Visual Hotspot Editor (Phase Y.2)
// "I'm curating a project narrative" — NOT "I'm configuring metadata"
// ──────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Globe, ExternalLink, Save as SaveIcon, Plus, X,
  Trash2, GripVertical, Send, EyeOff, Eye, Image as ImageIcon,
} from 'lucide-react';
import api from '../../lib/api';
import './magazine-editor.css';

const LOCALES = [
  { id: 'it', label: 'Italiano' },
  { id: 'en', label: 'English' },
  { id: 'fr', label: 'Français' },
  { id: 'de', label: 'Deutsch' },
  { id: 'es', label: 'Español' },
];

const REFERENCE_TYPES = [
  { id: 'material',    label: 'Material' },
  { id: 'fabric',      label: 'Fabric' },
  { id: 'lighting',    label: 'Lighting' },
  { id: 'furniture',   label: 'Furniture' },
  { id: 'finish',      label: 'Finish' },
  { id: 'atmosphere',  label: 'Atmosphere' },
  { id: 'color_palette', label: 'Palette' },
  { id: 'architectural_detail', label: 'Detail' },
  { id: 'custom',      label: 'Other' },
];

const CTA_ACTIONS = [
  { id: 'save_to_project',     label: 'Save to my project' },
  { id: 'discuss_with_advisor', label: 'Discuss with my advisor' },
  { id: 'add_to_moodboard',    label: 'Add to my moodboard' },
  { id: 'explore_material',    label: 'Explore the palette' },
  { id: 'request_similar',     label: 'Request similar concept' },
];

const MagazineEditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [locale, setLocale] = useState('it');
  const [article, setArticle] = useState(null);
  const [hotspots, setHotspots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [activeHotspot, setActiveHotspot] = useState(null);
  const [publishing, setPublishing] = useState(false);

  // Load
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const arts = await api.get('/api/magazine/admin/articles');
        const found = (arts.data?.articles || []).find((a) => a.id === id);
        if (alive && found) {
          setArticle(found);
          setHotspots(found.hotspots || []);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  // ─── Article patch helpers ───────────────────────────────────────────
  const patchArticle = async (patch) => {
    setArticle((a) => ({ ...a, ...patch }));
    await api.patch(`/api/magazine/admin/articles/${id}`, patch);
  };

  const setLocaleField = (field, value) => {
    const next = { ...(article.locale_content || {}) };
    next[locale] = { ...(next[locale] || {}), [field]: value };
    setArticle((a) => ({ ...a, locale_content: next }));
  };

  const commitLocaleContent = () => patchArticle({ locale_content: article.locale_content });

  const patchBlock = (blockId, patch) => {
    const next = (article.body_blocks || []).map((b) => b.id === blockId ? { ...b, ...patch } : b);
    setArticle((a) => ({ ...a, body_blocks: next }));
  };
  const setBlockLocaleField = (blockId, field, value) => {
    const blk = (article.body_blocks || []).find((b) => b.id === blockId);
    if (!blk) return;
    const lc = { ...(blk.locale_content || {}) };
    lc[locale] = { ...(lc[locale] || {}), [field]: value };
    patchBlock(blockId, { locale_content: lc });
  };
  const commitBodyBlocks = () => patchArticle({ body_blocks: article.body_blocks });

  // ─── Hotspot CRUD ─────────────────────────────────────────────────────
  const createHotspot = async (blockId, xPct, yPct) => {
    const body = {
      block_id: blockId,
      x_pct: Math.max(2, Math.min(98, Math.round(xPct * 100) / 100)),
      y_pct: Math.max(2, Math.min(98, Math.round(yPct * 100) / 100)),
      reference_type: 'atmosphere',
      cta_action: 'save_to_project',
      locale_content: { [locale]: { label: 'New reference', description: '', cta_label: '' } },
    };
    const r = await api.post(`/api/magazine/admin/articles/${id}/hotspots`, body);
    setHotspots((hs) => [...hs, r.data]);
    setActiveHotspot(r.data.id);
  };

  const updateHotspot = async (hid, patch) => {
    setSavingId(hid);
    setHotspots((hs) => hs.map((h) => h.id === hid ? { ...h, ...patch } : h));
    try {
      await api.patch(`/api/magazine/admin/hotspots/${hid}`, patch);
    } finally {
      setSavingId(null);
    }
  };

  const deleteHotspot = async (hid) => {
    if (!window.confirm('Eliminare questo Design Reference™?')) return;
    setHotspots((hs) => hs.filter((h) => h.id !== hid));
    setActiveHotspot(null);
    await api.delete(`/api/magazine/admin/hotspots/${hid}`);
  };

  // ─── Publish ──────────────────────────────────────────────────────────
  const handlePublish = async () => {
    setPublishing(true);
    try {
      // First save pending changes
      await api.patch(`/api/magazine/admin/articles/${id}`, {
        locale_content: article.locale_content,
        body_blocks: article.body_blocks,
      });
      await api.post(`/api/magazine/admin/articles/${id}/publish`);
      setArticle((a) => ({ ...a, status: 'published' }));
    } finally {
      setPublishing(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────
  if (loading) return <div className="p-12 text-[var(--bp-text-muted)] italic">Caricamento…</div>;
  if (!article) return (
    <div className="p-12 text-[var(--bp-text-muted)]">
      Articolo non trovato. <Link to="/settings/magazine" className="text-[var(--bp-primary)]">Torna alla lista</Link>
    </div>
  );

  const lc = article.locale_content?.[locale] || {};
  const imageBlocks = (article.body_blocks || []).filter((b) => b.type === 'image' || b.type === 'gallery' || b.type === 'hero');

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto" data-testid="magazine-editor-page">
      {/* Topbar */}
      <header className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--bp-border)]">
        <Link to="/settings/magazine" className="inline-flex items-center gap-2 text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] text-[10px] uppercase tracking-[0.22em]" data-testid="editor-back">
          <ArrowLeft size={12} strokeWidth={1.6} /> Magazine
        </Link>
        <div className="flex items-center gap-3">
          {/* Locale switcher */}
          <div className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--bp-surface)] border border-[var(--bp-border)]">
            <Globe size={11} strokeWidth={1.5} className="text-[var(--bp-text-muted)] ml-1" />
            {LOCALES.slice(0, 3).map((l) => (
              <button key={l.id}
                      onClick={() => setLocale(l.id)}
                      data-testid={`editor-locale-${l.id}`}
                      className={`px-2 py-1 text-[10px] uppercase tracking-[0.18em] transition-colors ${locale === l.id ? 'text-[var(--bp-primary)] font-medium' : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]'}`}>
                {l.id}
              </button>
            ))}
          </div>
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-[2px] border text-[9px] uppercase tracking-[0.22em] ${
            article.status === 'published' ? 'border-emerald-400/40 text-emerald-300 bg-emerald-400/10' : 'border-amber-400/40 text-amber-300 bg-amber-400/10'}`}
          data-testid={`editor-status-${article.status}`}>
            {article.status}
          </span>
          {article.status === 'published' && (
            <a href={`/magazine/${article.slug}`} target="_blank" rel="noreferrer"
               className="inline-flex items-center gap-1 px-3 py-2 border border-[var(--bp-border)] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] text-[10px] uppercase tracking-[0.22em]"
               data-testid="editor-view-public">
              <ExternalLink size={11} strokeWidth={1.6} /> View public
            </a>
          )}
          <button type="button" onClick={handlePublish} disabled={publishing}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--bp-primary)] text-white text-[10px] uppercase tracking-[0.22em] hover:bg-[var(--bp-primary-hover)] disabled:opacity-50"
                  data-testid="editor-publish-btn">
            <Send size={11} strokeWidth={1.6} /> {publishing ? 'Publishing…' : (article.status === 'published' ? 'Republish' : 'Publish')}
          </button>
        </div>
      </header>

      {/* Article title + summary */}
      <section className="mb-8" data-testid="editor-heading-section">
        <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--bp-primary)] mb-2">EDITORIAL · {locale.toUpperCase()}</p>
        <input type="text" value={lc.title || ''} onChange={(e) => setLocaleField('title', e.target.value)} onBlur={commitLocaleContent}
               placeholder="Titolo dell'articolo (es. Casa vista mare ligure)" data-testid="editor-title-input"
               className="w-full font-heading text-3xl md:text-4xl text-[var(--bp-text-primary)] font-light leading-tight bg-transparent border-0 border-b border-transparent hover:border-[var(--bp-border)] focus:border-[var(--bp-primary)] outline-none py-1 mb-3 placeholder:text-[var(--bp-text-muted)]/50" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input type="text" value={lc.kicker || ''} onChange={(e) => setLocaleField('kicker', e.target.value)} onBlur={commitLocaleContent}
                 placeholder="Kicker (es. Residenza · Liguria)" data-testid="editor-kicker-input"
                 className="px-0 py-1 text-[11px] uppercase tracking-[0.25em] text-[var(--bp-primary)] bg-transparent border-0 outline-none" />
          <input type="text" value={lc.category_label || ''} onChange={(e) => setLocaleField('category_label', e.target.value)} onBlur={commitLocaleContent}
                 placeholder="Categoria etichetta" data-testid="editor-category-input"
                 className="px-0 py-1 text-[11px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] bg-transparent border-0 outline-none" />
        </div>
        <textarea value={lc.summary || ''} onChange={(e) => setLocaleField('summary', e.target.value)} onBlur={commitLocaleContent}
                  placeholder="Riassunto editoriale (1-2 frasi)" rows={2} data-testid="editor-summary-input"
                  className="w-full bg-transparent border-0 border-b border-transparent hover:border-[var(--bp-border)] focus:border-[var(--bp-primary)] outline-none text-[var(--bp-text-secondary)] font-body text-sm py-2 mt-3 resize-none" />
      </section>

      {/* Hero image */}
      <section className="mb-8" data-testid="editor-hero-section">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] mb-2">HERO IMAGE</p>
        <div className="flex items-center gap-3">
          <input type="text" value={article.hero_url || ''} onChange={(e) => setArticle((a) => ({ ...a, hero_url: e.target.value }))}
                 onBlur={() => patchArticle({ hero_url: article.hero_url, cover_url: article.cover_url || article.hero_url })}
                 placeholder="https://… image URL"
                 className="flex-1 px-3 py-2 bg-[var(--bp-surface)] border border-[var(--bp-border)] text-[var(--bp-text-primary)] outline-none focus:border-[var(--bp-primary)] text-sm font-mono"
                 data-testid="editor-hero-url" />
          {article.hero_url && (
            <div className="w-24 h-14 bg-[var(--bp-surface-2)] overflow-hidden border border-[var(--bp-border)]">
              <img src={article.hero_url} alt="" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      </section>

      {/* Body blocks with hotspot canvas on images */}
      <section className="space-y-8" data-testid="editor-blocks">
        <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--bp-primary)]">EDITORIAL BLOCKS</p>
        {(article.body_blocks || []).map((b) => (
          <BlockEditor
            key={b.id}
            block={b}
            locale={locale}
            hotspots={hotspots.filter((h) => h.block_id === b.id)}
            activeHotspot={activeHotspot}
            savingId={savingId}
            onSetField={(field, value) => patchBlock(b.id, { [field]: value })}
            onSetLocaleField={(field, value) => setBlockLocaleField(b.id, field, value)}
            onCommitBlocks={commitBodyBlocks}
            onCreateHotspot={(x, y) => createHotspot(b.id, x, y)}
            onUpdateHotspot={updateHotspot}
            onDeleteHotspot={deleteHotspot}
            onActivateHotspot={(hid) => setActiveHotspot(hid)}
          />
        ))}
      </section>

      <footer className="mt-12 pt-6 border-t border-[var(--bp-border)] text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--bp-text-muted)]">
          {hotspots.length} {hotspots.length === 1 ? 'Design Reference™ curated' : 'Design References™ curated'} · {locale.toUpperCase()}
        </p>
      </footer>
    </div>
  );
};

// ─── BlockEditor — renders the block + its image canvas + hotspots ────────
const BlockEditor = ({
  block, locale, hotspots, activeHotspot, savingId,
  onSetField, onSetLocaleField, onCommitBlocks,
  onCreateHotspot, onUpdateHotspot, onDeleteHotspot, onActivateHotspot,
}) => {
  const blc = block.locale_content?.[locale] || {};
  const isImage = block.type === 'image' || block.type === 'gallery' || block.type === 'hero';

  if (block.type === 'paragraph') {
    return (
      <div className="border-l-2 border-[var(--bp-border)] pl-4">
        <p className="text-[9px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] mb-2">PARAGRAPH</p>
        <textarea value={blc.text || ''} onChange={(e) => onSetLocaleField('text', e.target.value)} onBlur={onCommitBlocks}
                  placeholder="Testo editoriale del paragrafo…" rows={4}
                  className="w-full bg-transparent border-0 outline-none text-[var(--bp-text-primary)] text-base font-body leading-relaxed resize-none"
                  data-testid={`block-${block.id}-text`} />
      </div>
    );
  }

  if (block.type === 'quote') {
    return (
      <div className="border-l-2 border-[var(--bp-primary)] pl-4">
        <p className="text-[9px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] mb-2">QUOTE</p>
        <textarea value={blc.text || ''} onChange={(e) => onSetLocaleField('text', e.target.value)} onBlur={onCommitBlocks}
                  placeholder="Citazione…" rows={2}
                  className="w-full bg-transparent border-0 outline-none font-heading text-2xl text-[var(--bp-text-primary)] font-light italic leading-snug resize-none mb-2"
                  data-testid={`block-${block.id}-quote`} />
        <input type="text" value={blc.author || ''} onChange={(e) => onSetLocaleField('author', e.target.value)} onBlur={onCommitBlocks}
               placeholder="Autore"
               className="bg-transparent border-0 outline-none text-[10px] uppercase tracking-[0.22em] text-[var(--bp-primary)]"
               data-testid={`block-${block.id}-quote-author`} />
      </div>
    );
  }

  if (isImage) {
    return (
      <div data-testid={`block-${block.id}-image-wrap`}>
        <p className="text-[9px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] mb-2">
          {block.type === 'hero' ? 'HERO IMAGE' : 'EDITORIAL IMAGE'} · click anywhere to add a Design Reference™
        </p>
        <div className="flex items-center gap-2 mb-3">
          <input type="text" value={block.image_url || ''} onChange={(e) => onSetField('image_url', e.target.value)} onBlur={onCommitBlocks}
                 placeholder="Image URL"
                 className="flex-1 px-2 py-1.5 bg-[var(--bp-surface)] border border-[var(--bp-border)] text-[var(--bp-text-primary)] outline-none focus:border-[var(--bp-primary)] text-xs font-mono"
                 data-testid={`block-${block.id}-url`} />
        </div>
        <HotspotCanvas
          block={block}
          locale={locale}
          hotspots={hotspots}
          activeHotspot={activeHotspot}
          savingId={savingId}
          onCreateHotspot={onCreateHotspot}
          onUpdateHotspot={onUpdateHotspot}
          onDeleteHotspot={onDeleteHotspot}
          onActivateHotspot={onActivateHotspot}
        />
        <input type="text" value={blc.caption || ''} onChange={(e) => onSetLocaleField('caption', e.target.value)} onBlur={onCommitBlocks}
               placeholder="Caption opzionale"
               className="w-full mt-2 px-0 py-1 bg-transparent border-0 outline-none text-xs text-[var(--bp-text-muted)] italic"
               data-testid={`block-${block.id}-caption`} />
      </div>
    );
  }
  return null;
};

// ─── HotspotCanvas — the heart of Phase Y.2 ───────────────────────────────
const HotspotCanvas = ({
  block, locale, hotspots, activeHotspot, savingId,
  onCreateHotspot, onUpdateHotspot, onDeleteHotspot, onActivateHotspot,
}) => {
  const canvasRef = useRef(null);
  const [dragging, setDragging] = useState(null); // { id, offsetX, offsetY }
  const [showAddHint, setShowAddHint] = useState(false);

  useEffect(() => {
    if (!dragging) return;
    let moved = false;
    let lastX = null, lastY = null;
    const onMove = (e) => {
      const rect = dragging.rect;
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      const clX = Math.max(2, Math.min(98, x));
      const clY = Math.max(2, Math.min(98, y));
      lastX = clX; lastY = clY;
      moved = Math.abs(e.clientX - dragging.startX) > 3 || Math.abs(e.clientY - dragging.startY) > 3;
      // Optimistic UI
      const pinEl = canvasRef.current?.querySelector(`[data-pin="${dragging.id}"]`);
      if (pinEl) {
        pinEl.style.left = `${clX}%`;
        pinEl.style.top = `${clY}%`;
      }
    };
    const onUp = () => {
      if (moved && lastX != null && lastY != null) {
        onUpdateHotspot(dragging.id, {
          x_pct: Math.round(lastX * 100) / 100,
          y_pct: Math.round(lastY * 100) / 100,
        });
      }
      setDragging(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  if (!block.image_url) {
    return (
      <div className="aspect-[16/10] bg-[var(--bp-surface-2)] border border-dashed border-[var(--bp-border)] flex flex-col items-center justify-center"
           data-testid={`canvas-${block.id}-empty`}>
        <ImageIcon size={32} strokeWidth={1} className="text-[var(--bp-text-muted)] opacity-50 mb-2" />
        <p className="text-[var(--bp-text-muted)] text-xs">Inserisci una URL immagine per iniziare a curare hotspot.</p>
      </div>
    );
  }

  const handleCanvasClick = (e) => {
    // Ignore clicks that came from a pin
    if (e.target.closest('[data-pin]')) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onCreateHotspot(x, y);
  };

  const handlePinMouseDown = (e, h) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    setDragging({ id: h.id, startX: e.clientX, startY: e.clientY, rect });
    onActivateHotspot(h.id);
  };

  return (
    <div
      ref={canvasRef}
      onClick={handleCanvasClick}
      onMouseEnter={() => setShowAddHint(true)}
      onMouseLeave={() => setShowAddHint(false)}
      className="relative aspect-[16/10] overflow-hidden bg-[var(--bp-surface-2)] cursor-crosshair select-none"
      data-testid={`canvas-${block.id}`}
    >
      <img src={block.image_url} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />

      {showAddHint && (
        <div className="absolute bottom-3 left-3 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-black/75 backdrop-blur-md text-white text-[9px] uppercase tracking-[0.22em] pointer-events-none">
          <Plus size={10} strokeWidth={1.6} /> Click anywhere to add a Design Reference™
        </div>
      )}

      {hotspots.map((h) => (
        <EditorPin
          key={h.id}
          hotspot={h}
          locale={locale}
          active={activeHotspot === h.id}
          saving={savingId === h.id}
          onMouseDown={(e) => handlePinMouseDown(e, h)}
          onActivate={() => onActivateHotspot(h.id)}
          onUpdate={(patch) => onUpdateHotspot(h.id, patch)}
          onDelete={() => onDeleteHotspot(h.id)}
        />
      ))}
    </div>
  );
};

// ─── EditorPin: pin + inline popover editor ───────────────────────────────
const EditorPin = ({ hotspot, locale, active, saving, onMouseDown, onActivate, onUpdate, onDelete }) => {
  const lc = hotspot.locale_content?.[locale] || {};
  // Smart popover positioning (mirrors the public reader)
  const pos = useMemo(() => ({
    vertical: hotspot.y_pct > 55 ? 'above' : 'below',
    horizontal: hotspot.x_pct < 22 ? 'left' : hotspot.x_pct > 78 ? 'right' : 'center',
  }), [hotspot.x_pct, hotspot.y_pct]);

  const setField = (field, value) => {
    const next = { ...(hotspot.locale_content || {}) };
    next[locale] = { ...(next[locale] || {}), [field]: value };
    onUpdate({ locale_content: next });
  };

  return (
    <div
      data-pin={hotspot.id}
      data-testid={`editor-pin-${hotspot.id}`}
      className="absolute"
      style={{ left: `${hotspot.x_pct}%`, top: `${hotspot.y_pct}%`, transform: 'translate(-50%, -50%)', zIndex: active ? 30 : 10 }}
    >
      <button
        type="button"
        onMouseDown={onMouseDown}
        onClick={(e) => { e.stopPropagation(); onActivate(); }}
        className={`mfd-edit-pin ${active ? 'is-active' : ''} ${saving ? 'is-saving' : ''}`}
        aria-label={lc.label || 'Design Reference'}
      >
        <span />
      </button>

      {active && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`mfd-edit-pin__panel mfd-edit-pin__panel--v-${pos.vertical} mfd-edit-pin__panel--h-${pos.horizontal}`}
          data-testid={`editor-pin-panel-${hotspot.id}`}
        >
          <header className="flex items-center justify-between mb-2">
            <p className="text-[9px] uppercase tracking-[0.28em] text-[#D8B47A]">DESIGN REFERENCE™</p>
            <div className="flex items-center gap-1">
              {saving && <span className="text-[9px] text-white/60 uppercase tracking-[0.18em]">saving…</span>}
              <button type="button" onClick={onDelete} className="text-white/60 hover:text-rose-300 p-1" title="Delete" data-testid={`editor-pin-delete-${hotspot.id}`}>
                <Trash2 size={11} strokeWidth={1.6} />
              </button>
              <button type="button" onClick={() => onActivate(null)} className="text-white/60 hover:text-white p-1" title="Close">
                <X size={11} strokeWidth={1.6} />
              </button>
            </div>
          </header>

          <input type="text" value={lc.label || ''} onChange={(e) => setField('label', e.target.value)}
                 placeholder="Reference title"
                 className="w-full bg-transparent border-0 border-b border-white/10 focus:border-[#D8B47A] outline-none text-white font-heading text-base py-1 mb-2"
                 data-testid={`editor-pin-label-${hotspot.id}`} />

          <textarea value={lc.description || ''} onChange={(e) => setField('description', e.target.value)}
                    placeholder="Editorial description…" rows={3}
                    className="w-full bg-transparent border-0 outline-none text-white/85 text-xs leading-relaxed resize-none mb-2 placeholder:text-white/30"
                    data-testid={`editor-pin-desc-${hotspot.id}`} />

          <div className="grid grid-cols-2 gap-2 mb-2">
            <select value={hotspot.reference_type || 'atmosphere'}
                    onChange={(e) => onUpdate({ reference_type: e.target.value })}
                    className="w-full px-2 py-1.5 bg-white/5 border border-white/12 text-white text-[10px] uppercase tracking-[0.16em] outline-none focus:border-[#D8B47A]"
                    data-testid={`editor-pin-type-${hotspot.id}`}>
              {REFERENCE_TYPES.map((t) => <option key={t.id} value={t.id} className="bg-[#181613]">{t.label}</option>)}
            </select>
            <select value={hotspot.cta_action || 'save_to_project'}
                    onChange={(e) => onUpdate({ cta_action: e.target.value })}
                    className="w-full px-2 py-1.5 bg-white/5 border border-white/12 text-white text-[10px] uppercase tracking-[0.16em] outline-none focus:border-[#D8B47A]"
                    data-testid={`editor-pin-cta-${hotspot.id}`}>
              {CTA_ACTIONS.map((c) => <option key={c.id} value={c.id} className="bg-[#181613]">{c.label}</option>)}
            </select>
          </div>

          <input type="text" value={lc.cta_label || ''} onChange={(e) => setField('cta_label', e.target.value)}
                 placeholder="CTA label (es. Esplora la palette materica)"
                 className="w-full px-2 py-1.5 bg-white/5 border border-white/12 text-white text-[10px] uppercase tracking-[0.18em] outline-none focus:border-[#D8B47A] mb-2"
                 data-testid={`editor-pin-cta-label-${hotspot.id}`} />

          <p className="text-[9px] uppercase tracking-[0.22em] text-white/40 text-center pt-1 border-t border-white/10">
            {hotspot.x_pct.toFixed(1)}% · {hotspot.y_pct.toFixed(1)}% · drag to move
          </p>
        </div>
      )}
    </div>
  );
};

export default MagazineEditorPage;
