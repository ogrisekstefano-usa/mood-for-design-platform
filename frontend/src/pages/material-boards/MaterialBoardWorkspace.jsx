/**
 * MaterialBoardWorkspace · STORE-002 · canvas + library + inspector
 *
 * Single-file workspace per la Material Board. Riusa al massimo:
 *   - EntityPicker (selezione materiali/finiture/prodotti dal Brand Atlas)
 *   - EntityContextPanel (ispezione e gestione di un singolo elemento)
 *
 * Layout:
 *   ┌──── header (titolo · template · stato) ──────────────────────┐
 *   │ ┌─ Library (sinistra) ─┬─ Canvas (centro) ─┬─ Inspector ──┐  │
 *   │ │ + Aggiungi materiale │  drag & drop card │ pannello dx │  │
 *   │ │ (apre EntityPicker)  │  click chip → CP  │              │  │
 *   │ └──────────────────────┴───────────────────┴──────────────┘  │
 *   └─────────────────────────────────────────────────────────────┘
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Layers, Sparkles, ExternalLink, FileText } from 'lucide-react';
import api from '../../lib/api';
import EntityPicker from '../../components/knowledge/EntityPicker';
import EntityContextPanel from '../../components/knowledge/EntityContextPanel';
import './material-board.css';

const TEMPLATES = ['residential', 'kitchen', 'hospitality', 'retail', 'outdoor', 'luxury'];

const MaterialBoardWorkspace = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const [board, setBoard]       = useState(null);
  const [elements, setElements] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [pickerOpen, setPicker] = useState(false);
  const [panel, setPanel]       = useState(null);
  const [drag, setDrag]         = useState(null);

  const load = useCallback(() => {
    let alive = true;
    api.get(`/api/material-boards/${id}`)
      .then((r) => ({ ok: true, board: r.data.board, elements: r.data.elements }))
      .catch(() => ({ ok: false, board: null, elements: [] }))
      .then((res) => { if (alive) { setBoard(res.board); setElements(res.elements); setLoading(false); } });
    return () => { alive = false; };
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const onSelect = (entity) => {
    api.post(`/api/material-boards/${id}/elements`, {
      entity_id: entity.id,
      x: 60 + ((elements.length % 4) * 240),
      y: 60 + (Math.floor(elements.length / 4) * 280),
    }).then(() => { setPicker(false); load(); })
      .catch(() => setPicker(false));
  };

  const onRemoveElement = (eid) => {
    api.delete(`/api/material-boards/${id}/elements/${eid}`)
      .then(() => { setPanel(null); load(); })
      .catch(() => {});
  };

  const startDrag = (e, el) => {
    const pos = el.position_json || {};
    setDrag({ id: el.id, startX: e.clientX, startY: e.clientY, ox: pos.x || 0, oy: pos.y || 0 });
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (e) => {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      setElements((els) => els.map((el) => el.id === drag.id
        ? { ...el, position_json: { ...(el.position_json || {}), x: drag.ox + dx, y: drag.oy + dy } }
        : el));
    };
    const onUp = (e) => {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      api.patch(`/api/material-boards/${id}/elements/${drag.id}`, {
        x: drag.ox + dx, y: drag.oy + dy,
      }).catch(() => {});
      setDrag(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [drag, id]);

  const updateMeta = (patch) => {
    api.patch(`/api/material-boards/${id}`, patch)
      .then(() => setBoard((b) => ({ ...b, ...patch })))
      .catch(() => {});
  };

  if (loading) return <div className="mbw-loading">Caricamento Material Board…</div>;
  if (!board)  return <div className="mbw-loading">Material Board non trovata · <Link to="/material-boards">Torna alla lista</Link></div>;

  return (
    <div className="mbw" data-testid="material-board-workspace">
      {/* Header */}
      <header className="mbw-head">
        <button type="button" className="mbw-back" onClick={() => nav('/material-boards')}>
          <ArrowLeft size={14} strokeWidth={1.6} /> Lista
        </button>
        <input className="mbw-title-input"
               value={board.title}
               onChange={(e) => setBoard((b) => ({ ...b, title: e.target.value }))}
               onBlur={(e) => updateMeta({ title: e.target.value })}
               data-testid="mbw-title" />
        <select className="mbw-tpl"
                value={board.template_key}
                onChange={(e) => updateMeta({ template_key: e.target.value })}
                data-testid="mbw-template">
          {TEMPLATES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="mbw-status">{board.status}</span>
        {board.source_moodboard_id && (
          <Link to={`/moodboards/${board.source_moodboard_id}`} className="mbw-source"
                title="Origine: Moodboard">
            <Sparkles size={12} strokeWidth={1.6} /> Da Moodboard
          </Link>
        )}
        {/* STORE-003 · Convert to Specification */}
        <button type="button" className="mbw-source"
                style={{ background: 'rgba(111,228,210,0.10)', cursor: 'pointer' }}
                data-testid="convert-to-specification"
                onClick={() => {
                  api.post(`/api/specifications/convert-from-material-board/${id}`)
                    .then((r) => { if (r?.data?.package?.id) window.location.assign(`/specifications/${r.data.package.id}`); })
                    .catch(() => {});
                }}>
          <FileText size={12} strokeWidth={1.6} /> Converti in Specification
        </button>      </header>

      <div className="mbw-body">
        {/* Library (sinistra) */}
        <aside className="mbw-lib">
          <p className="mbw-section">Libreria</p>
          <button type="button" className="mbw-add" onClick={() => setPicker(true)}
                  data-testid="mbw-add">
            <Plus size={13} strokeWidth={1.7} /> Aggiungi materiale
          </button>
          <p className="mbw-section mt-6">Conteggi</p>
          <div className="mbw-stat">{elements.length} elementi</div>
        </aside>

        {/* Canvas (centro) */}
        <main className="mbw-canvas" data-testid="mbw-canvas">
          {elements.length === 0 && (
            <div className="mbw-empty">
              <Layers size={32} strokeWidth={1.2} />
              <h3>La palette è vuota</h3>
              <p>Aggiungi materiali e finiture dal tuo Brand Atlas · ognuno è certificato.</p>
            </div>
          )}
          {elements.map((el) => {
            const pos = el.position_json || {};
            const ent = el.entity || {};
            return (
              <div key={el.id}
                   className={`mbw-tile ${drag?.id === el.id ? 'dragging' : ''}`}
                   style={{ left: pos.x || 0, top: pos.y || 0,
                             width: pos.width || 220, height: pos.height || 260 }}
                   data-testid={`mbw-tile-${el.id}`}>
                <div className="mbw-tile-handle" onMouseDown={(e) => startDrag(e, el)} />
                <div className="mbw-tile-body" onClick={() => setPanel({ entityId: el.entity_id, elementId: el.id })}>
                  <Layers size={18} strokeWidth={1.6} className="mbw-tile-icon" />
                  <div className="mbw-tile-name">{ent.display_name || '—'}</div>
                  <div className="mbw-tile-meta">{ent.entity_type || ''}</div>
                </div>
                <button type="button" className="mbw-tile-rm"
                        onClick={(e) => { e.stopPropagation(); onRemoveElement(el.id); }}
                        title="Rimuovi"
                        data-testid={`mbw-tile-rm-${el.id}`}>
                  <Trash2 size={11} strokeWidth={1.7} />
                </button>
              </div>
            );
          })}
        </main>
      </div>

      {pickerOpen && (
        <EntityPicker open onClose={() => setPicker(false)} onSelect={onSelect}
          entityTypes={['material', 'finish', 'product']}
          title="Aggiungi un materiale o prodotto" />
      )}

      {panel && (
        <EntityContextPanel
          open
          entityId={panel.entityId}
          onClose={() => setPanel(null)}
          surfaceContext={{ type: 'material_board', id, elementId: panel.elementId }}
          onRemove={() => onRemoveElement(panel.elementId)}
        />
      )}
    </div>
  );
};

export default MaterialBoardWorkspace;
