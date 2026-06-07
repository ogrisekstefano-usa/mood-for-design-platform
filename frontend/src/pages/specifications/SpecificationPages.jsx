/**
 * SpecificationsListPage + SpecificationWorkspace · STORE-003
 * Documento operativo che permette al negozio di chiudere il progetto.
 * Knowledge-native: ogni riga è un entity_id.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Plus, Trash2, FileText, Sparkles, Check } from 'lucide-react';
import api from '../../lib/api';
import EntityPicker from '../../components/knowledge/EntityPicker';
import EntityContextPanel from '../../components/knowledge/EntityContextPanel';
import './specifications.css';

const STATUS_LABEL = {
  draft:    { label: 'Bozza',         tone: 'mute' },
  review:   { label: 'In revisione',  tone: 'amber' },
  approved: { label: 'Approvata',     tone: 'cyan' },
  ready:    { label: 'Pronta',        tone: 'cyan' },
};

export const SpecificationsListPage = () => {
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    api.get('/api/specifications')
      .then((r) => ({ ok: true, items: r.data?.items || [] }))
      .catch(() => ({ ok: false, items: [] }))
      .then((res) => { if (alive) { setItems(res.items); setLoading(false); } });
    return () => { alive = false; };
  }, []);
  const create = () => {
    api.post('/api/specifications', { title: 'Specification Package' })
      .then((r) => nav(`/specifications/${r.data.id}`));
  };
  return (
    <div className="spec-canvas" data-testid="specifications-list">
      <header className="spec-hero">
        <p className="spec-eyebrow">Specification Package™</p>
        <h1 className="spec-title">Il documento che chiude il progetto</h1>
        <p className="spec-lede">
          Ogni elemento è certificato. Ogni riga è cliccabile. Single Source of Truth dal Brand Atlas.
        </p>
        <button type="button" className="spec-cta" onClick={create}
                data-testid="spec-new">
          <Plus size={14} strokeWidth={1.7} /> Nuova Specification
        </button>
      </header>
      <section className="spec-grid">
        {loading && <p className="spec-empty">Caricamento…</p>}
        {!loading && items.length === 0 && (
          <div className="spec-zero">
            <FileText size={32} strokeWidth={1.2} />
            <h3>Nessuna Specification ancora</h3>
            <p>Crea la prima o convertila da una Material Board / Moodboard approvata.</p>
          </div>
        )}
        {items.map((s) => {
          const st = STATUS_LABEL[s.status] || STATUS_LABEL.draft;
          return (
            <Link key={s.id} to={`/specifications/${s.id}`}
                  className="spec-card" data-testid={`spec-card-${s.id}`}>
              <div className={`spec-card-status spec-card-status--${st.tone}`}>
                {st.label}
              </div>
              <h3 className="spec-card-title">{s.title}</h3>
              <p className="spec-card-meta">
                {(s.source_material_board_id || s.source_moodboard_id) && <Sparkles size={11} strokeWidth={1.6} />}
                {s.source_material_board_id ? 'Da Material Board · ' : s.source_moodboard_id ? 'Da Moodboard · ' : ''}
                {new Date(s.updated_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
              </p>
              <span className="spec-card-open">Apri <ArrowUpRight size={12} strokeWidth={1.7} /></span>
            </Link>
          );
        })}
      </section>
    </div>
  );
};

export const SpecificationWorkspace = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const [pkg, setPkg]       = useState(null);
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPicker] = useState(false);
  const [panel, setPanel]   = useState(null);

  const load = useCallback(() => {
    let alive = true;
    api.get(`/api/specifications/${id}`)
      .then((r) => ({ ok: true, pkg: r.data.package, items: r.data.items }))
      .catch(() => ({ ok: false, pkg: null, items: [] }))
      .then((res) => { if (alive) { setPkg(res.pkg); setItems(res.items); setLoading(false); } });
    return () => { alive = false; };
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const onSelect = (entity) => {
    api.post(`/api/specifications/${id}/items`, { entity_id: entity.id })
      .then(() => { setPicker(false); load(); })
      .catch(() => setPicker(false));
  };
  const updItem = (iid, patch) => api.patch(`/api/specifications/${id}/items/${iid}`, patch).then(load).catch(() => {});
  const delItem = (iid) => api.delete(`/api/specifications/${id}/items/${iid}`).then(load).catch(() => {});
  const updPkg  = (patch) => api.patch(`/api/specifications/${id}`, patch).then(() => setPkg((p) => ({ ...p, ...patch }))).catch(() => {});

  if (loading) return <div className="spec-loading">Caricamento Specification…</div>;
  if (!pkg)    return <div className="spec-loading">Non trovata · <Link to="/specifications">Lista</Link></div>;

  const totalEstimate = items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);

  return (
    <div className="specw" data-testid="specification-workspace">
      <header className="specw-head">
        <button type="button" className="specw-back" onClick={() => nav('/specifications')}>
          <ArrowLeft size={14} strokeWidth={1.6} /> Lista
        </button>
        <input className="specw-title"
               value={pkg.title}
               onChange={(e) => setPkg((p) => ({ ...p, title: e.target.value }))}
               onBlur={(e) => updPkg({ title: e.target.value })}
               data-testid="specw-title" />
        <select className="specw-status"
                value={pkg.status}
                onChange={(e) => updPkg({ status: e.target.value })}
                data-testid="specw-status-select">
          <option value="draft">Bozza</option>
          <option value="review">In revisione</option>
          <option value="approved">Approvata</option>
          <option value="ready">Pronta per Presentazione</option>
        </select>
        <button type="button" className="specw-add" onClick={() => setPicker(true)}
                data-testid="specw-add">
          <Plus size={13} strokeWidth={1.7} /> Aggiungi elemento
        </button>
      </header>

      {/* Summary */}
      <section className="specw-summary">
        <div className="specw-sum-tile">
          <div className="specw-sum-num">{items.length}</div>
          <div className="specw-sum-lab">Elementi</div>
        </div>
        <div className="specw-sum-tile">
          <div className="specw-sum-num">
            {items.filter((it) => it.status === 'confirmed').length}
          </div>
          <div className="specw-sum-lab">Confermati</div>
        </div>
        <div className="specw-sum-tile">
          <div className="specw-sum-num">
            {totalEstimate > 0 ? `€ ${totalEstimate.toLocaleString('it-IT')}` : '—'}
          </div>
          <div className="specw-sum-lab">Stima</div>
        </div>
      </section>

      {/* Table */}
      <section className="specw-table-wrap">
        {items.length === 0 ? (
          <div className="specw-empty">
            <FileText size={32} strokeWidth={1.2} />
            <h3>La specifica è vuota</h3>
            <p>Aggiungi elementi dal Brand Atlas · ogni riga è cliccabile e collegata.</p>
          </div>
        ) : (
          <table className="specw-table">
            <thead>
              <tr>
                <th>Brand</th>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Q.tà</th>
                <th>Unità</th>
                <th>Finitura</th>
                <th>Codice</th>
                <th>Prezzo</th>
                <th>Stato</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const ent = it.entity || {};
                return (
                  <tr key={it.id} className={`specw-row specw-row--${it.status}`}
                      data-testid={`specw-row-${it.id}`}>
                    <td className="specw-td-brand">{ent.brand_name || '—'}</td>
                    <td>
                      <button type="button" className="specw-name-btn"
                              onClick={() => setPanel({ entityId: it.entity_id, itemId: it.id })}
                              data-testid={`specw-name-${it.id}`}>
                        {ent.display_name || '—'}
                        {ent.canonical_ref_id && <Check size={10} strokeWidth={2.4} className="specw-cert" />}
                      </button>
                    </td>
                    <td className="specw-td-type">{ent.entity_type || ''}</td>
                    <td>
                      <input className="specw-input specw-input-num" type="number" min="0" step="0.1"
                             defaultValue={it.quantity}
                             onBlur={(e) => updItem(it.id, { quantity: parseFloat(e.target.value) || 1 })} />
                    </td>
                    <td>
                      <input className="specw-input specw-input-mini" defaultValue={it.unit}
                             onBlur={(e) => updItem(it.id, { unit: e.target.value })} />
                    </td>
                    <td>
                      <input className="specw-input" defaultValue={it.material_finish || ''}
                             placeholder="—"
                             onBlur={(e) => updItem(it.id, { material_finish: e.target.value })} />
                    </td>
                    <td>
                      <input className="specw-input specw-input-mini" defaultValue={it.code || ''}
                             placeholder="—"
                             onBlur={(e) => updItem(it.id, { code: e.target.value })} />
                    </td>
                    <td>
                      <input className="specw-input specw-input-num" type="number" min="0" step="1"
                             defaultValue={it.price || ''}
                             placeholder="—"
                             onBlur={(e) => updItem(it.id, { price: parseFloat(e.target.value) || null })} />
                    </td>
                    <td>
                      <select className="specw-input specw-input-mini"
                              value={it.status}
                              onChange={(e) => updItem(it.id, { status: e.target.value })}>
                        <option value="proposed">Proposto</option>
                        <option value="confirmed">Confermato</option>
                        <option value="replaced">Sostituito</option>
                        <option value="removed">Rimosso</option>
                      </select>
                    </td>
                    <td>
                      <button type="button" className="specw-rm"
                              onClick={() => delItem(it.id)} title="Rimuovi"
                              data-testid={`specw-rm-${it.id}`}>
                        <Trash2 size={11} strokeWidth={1.7} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {pickerOpen && (
        <EntityPicker open onClose={() => setPicker(false)} onSelect={onSelect}
          entityTypes={['product', 'material', 'finish', 'designer']}
          title="Aggiungi alla specifica" />
      )}
      {panel && (
        <EntityContextPanel open entityId={panel.entityId}
          onClose={() => setPanel(null)}
          surfaceContext={{ type: 'specification', id, itemId: panel.itemId }}
          onRemove={() => { delItem(panel.itemId); setPanel(null); }} />
      )}
    </div>
  );
};
