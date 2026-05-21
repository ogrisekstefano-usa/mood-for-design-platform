/**
 * HotspotEditor™
 * ────────────────────────────────────────────────────────────────────
 * Reusable visual hotspot editor for editorial storytelling.
 *
 *   • Click on image to add Detail Point at x_pct/y_pct
 *   • Drag hotspot to reposition
 *   • Edit title/description + link to material/project/article/CTA
 *   • Preview desktop / mobile
 *   • Persist via callback (caller wires to backend)
 *
 * Hotspot vocabulary (NOT ecommerce):
 *   "Detail Point" / "Material Note" / "Design Note" /
 *   "Discover Detail" / "Editorial Hotspot"
 *
 * Coordinate system: stored as % (x_pct, y_pct) — survives image resize
 * across desktop/tablet/mobile.
 *
 * Reusable for: project gallery, magazine article images, moodboard images.
 *
 * @param {Object}  props
 * @param {string}  props.imageUrl
 * @param {Array}   props.hotspots                 - [{id, x_pct, y_pct, title, description, kind, linked_*…}]
 * @param {Function} [props.onCreate]              - async ({x_pct, y_pct, kind, title}) => hotspot
 * @param {Function} [props.onUpdate]              - async (hotspot_id, patch) => hotspot
 * @param {Function} [props.onDelete]              - async (hotspot_id) => void
 * @param {boolean} [props.readOnly]
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Plus, X, Smartphone, Monitor, Eye, Edit3, Trash2, Save, Loader2, MapPin, Gem, BookOpen, Folder, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import './hotspot-editor.css';
import { useT } from '../../i18n/useT';
const KINDS = [{
  id: 'detail_point',
  label: 'Detail Point',
  icon: MapPin
}, {
  id: 'material_note',
  label: 'Material Note',
  icon: Gem
}, {
  id: 'design_note',
  label: 'Design Note',
  icon: BookOpen
}, {
  id: 'discover_detail',
  label: 'Discover Detail',
  icon: Eye
}, {
  id: 'editorial_hotspot',
  label: 'Editorial Hotspot',
  icon: Link2
}];
const HotspotEditor = ({
  imageUrl,
  hotspots = [],
  onCreate,
  onUpdate,
  onDelete,
  readOnly = false
}) => {
  const {
    t
  } = useT();
  const imgRef = useRef(null);
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState(null); // {x_pct, y_pct} for unsaved
  const [view, setView] = useState('desktop'); // 'desktop' | 'mobile'
  const [dragging, setDragging] = useState(null);
  const [busy, setBusy] = useState(false);

  // ─── Click on image to add new hotspot ────────────────────────────
  const handleImageClick = useCallback(e => {
    if (readOnly) return;
    if (dragging) return;
    if (e.target.closest('.hot-pin')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x_pct = (e.clientX - rect.left) / rect.width * 100;
    const y_pct = (e.clientY - rect.top) / rect.height * 100;
    setDraft({
      x_pct: parseFloat(x_pct.toFixed(2)),
      y_pct: parseFloat(y_pct.toFixed(2)),
      kind: 'detail_point',
      title: '',
      description: ''
    });
    setActiveId('__draft__');
  }, [dragging, readOnly]);

  // ─── Drag handling ────────────────────────────────────────────────
  const handlePinPointerDown = (e, h) => {
    if (readOnly) return;
    e.stopPropagation();
    setDragging({
      id: h.id,
      startX: e.clientX,
      startY: e.clientY,
      originalX: h.x_pct,
      originalY: h.y_pct
    });
  };
  useEffect(() => {
    if (!dragging) return;
    const move = e => {
      const rect = imgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = (e.clientX - dragging.startX) / rect.width * 100;
      const dy = (e.clientY - dragging.startY) / rect.height * 100;
      const nx = Math.max(0, Math.min(100, dragging.originalX + dx));
      const ny = Math.max(0, Math.min(100, dragging.originalY + dy));
      setDragging({
        ...dragging,
        currentX: nx,
        currentY: ny
      });
    };
    const up = async () => {
      if (dragging.currentX !== undefined && onUpdate) {
        try {
          await onUpdate(dragging.id, {
            x_pct: parseFloat(dragging.currentX.toFixed(2)),
            y_pct: parseFloat(dragging.currentY.toFixed(2))
          });
        } catch {
          toast.error('Posizione non salvata');
        }
      }
      setDragging(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [dragging, onUpdate]);

  // ─── Create draft commit ──────────────────────────────────────────
  const commitDraft = async () => {
    if (!draft || !onCreate) return setDraft(null);
    if (!draft.title.trim()) return toast.error('Titolo obbligatorio per il hotspot');
    setBusy(true);
    try {
      await onCreate({
        ...draft
      });
      toast.success('Hotspot aggiunto');
      setDraft(null);
      setActiveId(null);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Creazione fallita');
    } finally {
      setBusy(false);
    }
  };

  // ─── Active hotspot resolve ───────────────────────────────────────
  const active = activeId === '__draft__' ? draft : hotspots.find(h => h.id === activeId);

  // ─── Delete ───────────────────────────────────────────────────────
  const handleDelete = async hid => {
    if (!confirm('Eliminare questo hotspot?')) return;
    setBusy(true);
    try {
      await onDelete?.(hid);
      toast.success('Hotspot rimosso');
      setActiveId(null);
    } catch {
      toast.error('Rimozione fallita');
    } finally {
      setBusy(false);
    }
  };
  return <div className={`hot-wrap ${view === 'mobile' ? 'is-mobile' : ''}`} data-testid="hotspot-editor">
      {/* Top bar */}
      <div className="hot-toolbar" data-testid="hot-toolbar">
        <span className="hot-toolbar__label">
          <MapPin size={11} /> Hotspot Editor · {hotspots.length} {hotspots.length === 1 ? 'punto' : 'punti'}
        </span>
        <div className="hot-toolbar__right">
          <div className="hot-view-toggle">
            <button type="button" onClick={() => setView('desktop')} aria-pressed={view === 'desktop'} data-testid="hot-view-desktop" className={view === 'desktop' ? 'is-active' : ''}>
              <Monitor size={11} />
            </button>
            <button type="button" onClick={() => setView('mobile')} aria-pressed={view === 'mobile'} data-testid="hot-view-mobile" className={view === 'mobile' ? 'is-active' : ''}>
              <Smartphone size={11} />
            </button>
          </div>
          {!readOnly && <span className="hot-hint">
              Click sull'immagine per aggiungere · Drag per riposizionare
            </span>}
        </div>
      </div>

      {/* Image canvas */}
      <div className="hot-canvas-wrap">
        <div ref={imgRef} className="hot-canvas" onClick={handleImageClick} data-testid="hot-canvas">
          <img src={imageUrl} alt="" className="hot-image" draggable={false} />

          {hotspots.map(h => {
          const isActive = activeId === h.id;
          const isDraggingThis = dragging?.id === h.id;
          const x = isDraggingThis ? dragging.currentX ?? h.x_pct : h.x_pct;
          const y = isDraggingThis ? dragging.currentY ?? h.y_pct : h.y_pct;
          const kind = KINDS.find(k => k.id === h.kind) || KINDS[0];
          const Icon = kind.icon;
          return <button key={h.id} type="button" className={`hot-pin ${isActive ? 'is-active' : ''}`} style={{
            left: `${x}%`,
            top: `${y}%`
          }} onClick={e => {
            e.stopPropagation();
            setActiveId(h.id);
          }} onPointerDown={e => handlePinPointerDown(e, h)} data-testid={`hot-pin-${h.id}`} title={h.title || kind.label}>
                <span className="hot-pin__dot"><Icon size={9} strokeWidth={2} /></span>
                <span className="hot-pin__ring" />
              </button>;
        })}

          {/* Draft pin (unsaved) */}
          {draft && <span className="hot-pin is-draft" style={{
          left: `${draft.x_pct}%`,
          top: `${draft.y_pct}%`
        }}>
              <span className="hot-pin__dot"><Plus size={9} strokeWidth={2.5} /></span>
              <span className="hot-pin__ring" />
            </span>}
        </div>

        {/* Side panel for active hotspot */}
        {active && <aside className="hot-panel" data-testid="hot-panel">
            <header className="hot-panel__head">
              <span className="hot-panel__eyebrow">{activeId === '__draft__' ? 'Nuovo hotspot' : 'Hotspot'}</span>
              <button type="button" onClick={() => {
            setActiveId(null);
            setDraft(null);
          }} data-testid="hot-panel-close">
                <X size={14} />
              </button>
            </header>
            <div className="hot-panel__body">
              <label className="hot-label">Tipo</label>
              <div className="hot-kind-grid">
                {KINDS.map(k => {
              const Icon = k.icon;
              const sel = (activeId === '__draft__' ? draft.kind : active.kind) === k.id;
              return <button key={k.id} type="button" className={`hot-kind ${sel ? 'is-active' : ''}`} data-testid={`hot-kind-${k.id}`} onClick={() => {
                if (activeId === '__draft__') setDraft({
                  ...draft,
                  kind: k.id
                });else onUpdate?.(active.id, {
                  kind: k.id
                });
              }}>
                      <Icon size={11} />
                      <span>{k.label}</span>
                    </button>;
            })}
              </div>

              <label className="hot-label">Titolo</label>
              <input value={activeId === '__draft__' ? draft.title : active.title || ''} onChange={e => {
            const v = e.target.value;
            if (activeId === '__draft__') setDraft({
              ...draft,
              title: v
            });else onUpdate?.(active.id, {
              title: v
            });
          }} className="hot-input" placeholder="es. Pietra travertino · taglio orizzontale" data-testid="hot-input-title" autoFocus={activeId === '__draft__'} />

              <label className="hot-label">Descrizione</label>
              <textarea rows={3} value={activeId === '__draft__' ? draft.description : active.description || ''} onChange={e => {
            const v = e.target.value;
            if (activeId === '__draft__') setDraft({
              ...draft,
              description: v
            });else onUpdate?.(active.id, {
              description: v
            });
          }} className="hot-input" placeholder={t("common.hotspot.breve_nota_editoriale_sul_dettaglio")} data-testid="hot-input-description" />

              {/* Linkages (read-only — full UI in next iteration) */}
              {activeId !== '__draft__' && <>
                  <label className="hot-label">Linked entities (read-only)</label>
                  <div className="hot-links">
                    {active.linked_material_id && <span className="hot-chip"><Gem size={10} /> {t("common.hotspot.material")} {String(active.linked_material_id).slice(0, 8)}</span>}
                    {active.linked_project_id && <span className="hot-chip"><Folder size={10} /> project · {String(active.linked_project_id).slice(0, 8)}</span>}
                    {active.linked_article_id && <span className="hot-chip"><BookOpen size={10} /> article · {String(active.linked_article_id).slice(0, 8)}</span>}
                    {active.cta_action && <span className="hot-chip"><Link2 size={10} /> CTA · {active.cta_action}</span>}
                    {!active.linked_material_id && !active.linked_project_id && !active.linked_article_id && !active.cta_action && <span className="hot-empty">Nessun collegamento — UI aggiunta in P1.</span>}
                  </div>
                </>}

              {/* Coordinates display */}
              <div className="hot-coord">
                x · {((activeId === '__draft__' ? draft.x_pct : active.x_pct) ?? 0).toFixed(1)}% &nbsp;·&nbsp;
                y · {((activeId === '__draft__' ? draft.y_pct : active.y_pct) ?? 0).toFixed(1)}%
              </div>
            </div>
            <footer className="hot-panel__foot">
              {activeId === '__draft__' ? <>
                  <button type="button" onClick={() => {
              setDraft(null);
              setActiveId(null);
            }} className="hot-btn hot-btn--ghost">{t('common.hotspot.annulla')}</button>
                  <button type="button" onClick={commitDraft} disabled={busy} className="hot-btn hot-btn--primary" data-testid="hot-commit">
                    {busy ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                    {t("common.hotspot.salva_hotspot")}
                  </button>
                </> : <>
                  <button type="button" onClick={() => handleDelete(active.id)} disabled={busy} className="hot-btn hot-btn--danger" data-testid="hot-delete">
                    <Trash2 size={11} /> {t("common.hotspot.elimina")}
                  </button>
                  <span className="hot-saved-hint"><Edit3 size={10} /> Auto-salvato</span>
                </>}
            </footer>
          </aside>}
      </div>
    </div>;
};
export default HotspotEditor;