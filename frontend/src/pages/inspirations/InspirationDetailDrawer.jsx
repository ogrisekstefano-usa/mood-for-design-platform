/**
 * InspirationDetailDrawer — fullscreen cinematic detail.
 *
 * Mostra:
 *   • Immagine cinematica a sinistra
 *   • Pannello editoriale a destra: atmosfera, materia, Market Resonance™,
 *     relazioni, azioni (modifica metadati, rimuovi flag inspiration)
 *
 * Mobile: stack verticale fullscreen.
 */
import React, { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';

const InspirationDetailDrawer = ({ open, id, onClose, config, onChanged, onRemoved }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit state buffer
  const [atmos, setAtmos] = useState([]);
  const [mats, setMats] = useState([]);
  const [luxury, setLuxury] = useState('');
  const [profile, setProfile] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!open || !id) return;
    setData(null); setError(null); setEditing(false);
    api.get(`/api/inspirations/archive/${id}`)
      .then((r) => {
        setData(r.data);
        setAtmos(r.data.atmosphere_tags || []);
        setMats(r.data.material_tags || []);
        setLuxury(r.data.luxury_level || '');
        setProfile(r.data.hospitality_profile || '');
        setTitle(r.data.title || '');
        setDescription(r.data.description || '');
      })
      .catch((e) => setError(e?.response?.data?.detail || 'Errore'));
  }, [open, id]);

  const toggle = (arr, setArr, v) => {
    setArr(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await api.patch(`/api/inspirations/archive/${id}`, {
        alt_text: title,
        description,
        inspiration_meta: {
          atmosphere_tags: atmos,
          material_tags: mats,
          luxury_level: luxury || null,
          hospitality_profile: profile || null,
        },
      });
      // Re-fetch full with new resonance
      const fresh = await api.get(`/api/inspirations/archive/${id}`);
      setData(fresh.data);
      setEditing(false);
      onChanged?.(fresh.data);
      toast.success('Riferimento aggiornato');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Aggiornamento fallito');
    } finally { setSaving(false); }
  };

  const removeFromInspirations = async () => {
    if (!confirm('Rimuovere dal layer Inspirations™? Il file resterà nella Media Library.')) return;
    try {
      await api.delete(`/api/inspirations/archive/${id}`);
      toast.success('Rimosso da Inspirations™');
      onRemoved?.(id);
    } catch (e) {
      toast.error('Operazione fallita');
    }
  };

  if (!open) return null;

  return (
    <div className="insd-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
         data-testid="inspiration-detail-backdrop">
      <div className="insd-drawer" data-testid="inspiration-detail">
        <button type="button" className="insd-close" onClick={onClose}
                aria-label="Chiudi" data-testid="inspiration-detail-close">
          <Icons.X size={18} />
        </button>

        {error && (
          <div className="insd-empty">
            <Icons.AlertCircle size={20} /><p>{error}</p>
          </div>
        )}

        {!data && !error && (
          <div className="insd-loading">Apertura del riferimento…</div>
        )}

        {data && (
          <>
            <section className="insd-media" data-testid="inspiration-detail-media">
              {data.image_url ? (
                <img src={data.image_url} alt={data.title || ''} />
              ) : (
                <div className="insd-media__placeholder"><Icons.Image size={48} /></div>
              )}
            </section>

            <section className="insd-panel" data-testid="inspiration-detail-panel">
              <header className="insd-panel__head">
                {!editing ? (
                  <>
                    <p className="ins-eyebrow">Inspiration · {data.source_kind || 'upload'}</p>
                    <h2 className="insd-title">{data.title || 'Senza titolo'}</h2>
                    {data.description && <p className="insd-desc">{data.description}</p>}
                  </>
                ) : (
                  <>
                    <p className="ins-eyebrow">Modifica</p>
                    <input className="ins-input" value={title} onChange={(e) => setTitle(e.target.value)}
                           placeholder="Titolo" data-testid="insd-edit-title" />
                    <textarea className="ins-textarea" rows={2}
                              value={description} onChange={(e) => setDescription(e.target.value)}
                              placeholder="Descrizione editoriale"
                              data-testid="insd-edit-desc" />
                  </>
                )}
              </header>

              {/* Tags display or edit */}
              <div className="insd-section">
                <p className="ins-label">Atmosfera</p>
                {!editing ? (
                  <div className="insd-chips">
                    {(data.atmosphere_tags || []).length === 0 && <span className="insd-quiet">—</span>}
                    {(data.atmosphere_tags || []).map((t, i) => (
                      <span key={i} className="ins-chip ins-chip--atmos">{t.replace(/_/g, ' ')}</span>
                    ))}
                  </div>
                ) : (
                  <div className="ins-chips-row">
                    {(config?.atmosphere_tags || []).map((t) => (
                      <button key={t.key} type="button"
                              className={`ins-chip-toggle ${atmos.includes(t.key) ? 'ins-chip-toggle--on' : ''}`}
                              onClick={() => toggle(atmos, setAtmos, t.key)}
                              data-testid={`insd-atmos-${t.key}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="insd-section">
                <p className="ins-label">Materia</p>
                {!editing ? (
                  <div className="insd-chips">
                    {(data.material_tags || []).length === 0 && <span className="insd-quiet">—</span>}
                    {(data.material_tags || []).map((t, i) => (
                      <span key={i} className="ins-chip ins-chip--mat">{t.replace(/_/g, ' ')}</span>
                    ))}
                  </div>
                ) : (
                  <div className="ins-chips-row">
                    {(config?.material_tags || []).map((t) => (
                      <button key={t.key} type="button"
                              className={`ins-chip-toggle ${mats.includes(t.key) ? 'ins-chip-toggle--on' : ''}`}
                              onClick={() => toggle(mats, setMats, t.key)}
                              data-testid={`insd-mat-${t.key}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {editing && (
                <div className="insd-row-2">
                  <div className="ins-field">
                    <label className="ins-label">Tono luxury</label>
                    <select className="ins-input" value={luxury} onChange={(e) => setLuxury(e.target.value)}>
                      <option value="">—</option>
                      {(config?.luxury_levels || []).map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className="ins-field">
                    <label className="ins-label">Destinazione</label>
                    <select className="ins-input" value={profile} onChange={(e) => setProfile(e.target.value)}>
                      <option value="">—</option>
                      {(config?.hospitality_profiles || []).map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* Market Resonance */}
              <div className="insd-section">
                <p className="ins-label" data-testid="insd-resonance-label">Affinità culturale</p>
                <ul className="insd-resonance" data-testid="inspiration-detail-resonance">
                  {(data.resonance || []).map((r) => (
                    <li key={r.market_code} className="insd-resonance__row">
                      <div className="insd-resonance__top">
                        <span className="insd-resonance__market">{r.market_label}</span>
                        <span className={`insd-resonance__pct ${r.percentage >= 70 ? 'insd-resonance__pct--high' : r.percentage >= 40 ? 'insd-resonance__pct--mid' : 'insd-resonance__pct--low'}`}>
                          {r.percentage}%
                        </span>
                      </div>
                      <div className="insd-resonance__bar">
                        <span className="insd-resonance__bar-fill" style={{ width: `${r.percentage}%` }} />
                      </div>
                      {r.explanation && (
                        <p className="insd-resonance__note">{r.explanation}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Footer actions */}
              <footer className="insd-foot">
                {!editing ? (
                  <>
                    <button type="button" className="ins-btn ins-btn--ghost"
                            onClick={removeFromInspirations}
                            data-testid="insd-remove">
                      <Icons.BookmarkMinus size={12} /> Rimuovi da Inspirations™
                    </button>
                    <button type="button" className="ins-btn ins-btn--primary"
                            onClick={() => setEditing(true)}
                            data-testid="insd-edit">
                      <Icons.Edit3 size={12} /> Modifica metadati
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="ins-btn ins-btn--ghost"
                            onClick={() => setEditing(false)} disabled={saving}>
                      Annulla
                    </button>
                    <button type="button" className="ins-btn ins-btn--primary"
                            onClick={save} disabled={saving}
                            data-testid="insd-save">
                      {saving ? 'Salvataggio…' : 'Salva'}
                      {!saving && <Icons.Check size={12} />}
                    </button>
                  </>
                )}
              </footer>
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default InspirationDetailDrawer;
