/**
 * MaterialBoardsListPage — STORE-002
 *
 * Vista di accesso alle Material Board del tenant. Editoriale, dark,
 * coerente con Blueprint Chameleon.
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, ArrowUpRight, Layers, Sparkles } from 'lucide-react';
import api from '../../lib/api';
import './material-board.css';

const TEMPLATE_META = {
  residential:  { label: 'Residenziale',  hint: 'Casa privata' },
  kitchen:      { label: 'Cucina',        hint: 'Aree cottura · isole' },
  hospitality:  { label: 'Hospitality',   hint: 'Hotel · ristorazione' },
  retail:       { label: 'Retail',        hint: 'Negozi · showroom' },
  outdoor:      { label: 'Outdoor',       hint: 'Esterni · giardino' },
  luxury:       { label: 'Luxury',        hint: 'Materie nobili · alto di gamma' },
};

const MaterialBoardsListPage = () => {
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [template, setTemplate] = useState('residential');

  useEffect(() => {
    let alive = true;
    api.get('/api/material-boards')
      .then((r) => ({ ok: true, items: r.data?.items || [] }))
      .catch(() => ({ ok: false, items: [] }))
      .then((res) => { if (alive) { setItems(res.items); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  const create = () => {
    api.post('/api/material-boards', { title: title || 'Material Board', template_key: template })
      .then((r) => nav(`/material-boards/${r.data.id}`))
      .catch(() => setShowCreate(false));
  };

  return (
    <div className="mbl-canvas" data-testid="material-boards-list">
      <header className="mbl-hero">
        <p className="mbl-eyebrow">Material Board Studio™</p>
        <h1 className="mbl-title">Materie selezionate per ogni progetto</h1>
        <p className="mbl-lede">
          Componi palette professionali · ogni materiale è certificato dal tuo Brand Atlas.
        </p>
        <button type="button" className="mbl-cta"
                onClick={() => setShowCreate(true)}
                data-testid="mb-new">
          <Plus size={14} strokeWidth={1.7} /> Nuova Material Board
        </button>
      </header>

      <section className="mbl-grid">
        {loading && <p className="mbl-empty">Caricamento…</p>}
        {!loading && items.length === 0 && (
          <div className="mbl-zero">
            <Layers size={32} strokeWidth={1.2} />
            <h3>Nessuna Material Board ancora</h3>
            <p>Crea la tua prima palette · o convertila da una Moodboard esistente.</p>
          </div>
        )}
        {items.map((mb) => (
          <Link key={mb.id} to={`/material-boards/${mb.id}`}
                className="mbl-card"
                data-testid={`mb-card-${mb.id}`}>
            <div className="mbl-card-tag">
              {TEMPLATE_META[mb.template_key]?.label || mb.template_key}
            </div>
            <h3 className="mbl-card-title">{mb.title}</h3>
            <p className="mbl-card-meta">
              {mb.source_moodboard_id && <Sparkles size={11} strokeWidth={1.6} />}
              {mb.source_moodboard_id ? 'Da Moodboard · ' : ''}
              {new Date(mb.updated_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
            </p>
            <span className="mbl-card-open">Apri <ArrowUpRight size={12} strokeWidth={1.7} /></span>
          </Link>
        ))}
      </section>

      {showCreate && (
        <div className="mb-modal-bg" onClick={() => setShowCreate(false)}>
          <div className="mb-modal" onClick={(e) => e.stopPropagation()}
               data-testid="mb-create-modal">
            <h3 className="mb-modal-title">Nuova Material Board</h3>
            <label className="mb-label">Titolo</label>
            <input className="mb-input" value={title}
                   onChange={(e) => setTitle(e.target.value)}
                   placeholder="Villa Treviso · Palette pietra"
                   data-testid="mb-title-input" />
            <label className="mb-label">Template</label>
            <div className="mb-pills">
              {Object.entries(TEMPLATE_META).map(([k, v]) => (
                <button key={k} type="button"
                        className={`mb-pill ${template === k ? 'on' : ''}`}
                        onClick={() => setTemplate(k)}
                        data-testid={`mb-template-${k}`}>
                  {v.label}
                </button>
              ))}
            </div>
            <div className="mb-modal-actions">
              <button type="button" className="mb-btn mb-btn-ghost"
                      onClick={() => setShowCreate(false)}>Annulla</button>
              <button type="button" className="mb-btn mb-btn-primary"
                      onClick={create} data-testid="mb-create-confirm">
                Crea Material Board <ArrowUpRight size={13} strokeWidth={1.7} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaterialBoardsListPage;
