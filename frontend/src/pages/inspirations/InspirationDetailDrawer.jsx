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
import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { asErrorString } from '../../lib/asErrorString';
import UniversalEditorialCropper, { filterCssFor } from '../../components/media/UniversalEditorialCropper';
import { useT } from '../../i18n/useT';

const InspirationDetailDrawer = ({ open, id, onClose, config, onChanged, onRemoved }) => {
  const { t } = useT();
  const [data, setData] = useState(null);
  const [cropperOpen, setCropperOpen] = useState(false);
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
      .catch((e) => setError(asErrorString(e, 'Errore')));
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
      toast.error(asErrorString(e, 'Aggiornamento fallito'));
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
                aria-label={t('common.close')} data-testid="inspiration-detail-close">
          <Icons.X size={18} />
        </button>

        {error && (
          <div className="insd-empty">
            <Icons.AlertCircle size={20} /><p>{error}</p>
          </div>
        )}

        {!data && !error && (
          <div className="insd-loading">{t('inspirations.inspiration_detail.apertura_del_riferimento')}</div>
        )}

        {data && (
          <>
            <section className="insd-media" data-testid="inspiration-detail-media">
              {data.image_url ? (
                <>
                  <img src={data.image_url} alt={data.title || ''}
                       style={{
                         objectPosition: `${(data.display_meta?.focal_x ?? 0.5) * 100}% ${(data.display_meta?.focal_y ?? 0.5) * 100}%`,
                         filter: filterCssFor(data.display_meta?.editorial_filter),
                         transform: data.display_meta?.zoom ? `scale(${data.display_meta.zoom})` : undefined,
                       }} />
                  <button type="button"
                          className="insd-stage-action"
                          onClick={() => setCropperOpen(true)}
                          data-testid="inspiration-open-cropper">
                    <Icons.Wand2 size={11} /> Regia immagine
                  </button>
                </>
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
                    <p className="ins-eyebrow">{t('inspirations.inspiration_detail.modifica')}</p>
                    <input className="ins-input" value={title} onChange={(e) => setTitle(e.target.value)}
                           placeholder="Titolo" data-testid="insd-edit-title" />
                    <textarea className="ins-textarea" rows={2}
                              value={description} onChange={(e) => setDescription(e.target.value)}
                              placeholder={t('inspirations.inspiration_detail.description_placeholder')}
                              data-testid="insd-edit-desc" />
                  </>
                )}
              </header>

              {/* Product info — only for Product Inspirations™ */}
              {!editing && data.inspiration_type === 'product' && (
                <ProductInfoBlock data={data} />
              )}

              {/* Cultural Reading™ — output editoriale, in cima */}
              {!editing && <CulturalReadingBlock data={data} mediaId={id} onRefresh={(cr) => setData({ ...data, cultural_reading: cr })} />}

              {/* Tags display or edit */}
              <div className="insd-section">
                <p className="ins-label">{t('inspirations.inspiration_detail.atmosfera')}</p>
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
                <p className="ins-label">{t('atelier_voice.inspiration_detail.material_label', null, 'Material')}</p>
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

              {/* Market Resonance — usa Cultural Engine output se disponibile, altrimenti euristica legacy */}
              <div className="insd-section">
                <p className="ins-label" data-testid="insd-resonance-label">Market Resonance™</p>
                <p className="insd-hint">{t('inspirations.inspiration_detail.le_percentuali_sono_secondarie_il_significato_e_ne')}</p>
                <ul className="insd-resonance" data-testid="inspiration-detail-resonance">
                  {(() => {
                    const cr = data.cultural_reading || {};
                    const useEngine = cr.status === 'ready' && Array.isArray(cr.market_resonance) && cr.market_resonance.length;
                    const list = useEngine ? cr.market_resonance : (data.resonance || []);
                    return list.map((r) => {
                      const code = r.market_code;
                      const label = r.market_label;
                      const pct = r.percentage;
                      const narr = r.narrative || r.explanation || '';
                      return (
                        <li key={code} className="insd-resonance__row">
                          <div className="insd-resonance__top">
                            <span className="insd-resonance__market">{label}</span>
                            <span className={`insd-resonance__pct ${pct >= 70 ? 'insd-resonance__pct--high' : pct >= 40 ? 'insd-resonance__pct--mid' : 'insd-resonance__pct--low'}`}>
                              {pct}%
                            </span>
                          </div>
                          <div className="insd-resonance__bar">
                            <span className="insd-resonance__bar-fill" style={{ width: `${pct}%` }} />
                          </div>
                          {narr && <p className="insd-resonance__note">{narr}</p>}
                        </li>
                      );
                    });
                  })()}
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

      {/* Universal Editorial Cropper™ — regia immagine */}
      <UniversalEditorialCropper
        open={cropperOpen}
        mediaId={id}
        imageUrl={data?.image_url}
        initial={data?.display_meta}
        onClose={() => setCropperOpen(false)}
        onSaved={(dm) => { setData({ ...data, display_meta: dm }); setCropperOpen(false); onChanged?.(); }}
      />
    </div>
  );
};

// ── Narrative Mode™ taxonomy (shared frontend constants) ─────────────
// Stesse keys del backend (cultural_engine/editorial_interpreter.py).
// I label sono editoriali italiani, MAI tecnici (no "prompt"/"AI"/"model").
const NARRATIVE_MODES = [
  { key: '',                  label: 'Voce dello studio (default)' },
  { key: 'strategic',         label: 'Strategica · sintetica e progettuale' },
  { key: 'technical',         label: 'Tecnica · architettonica, zero metafore' },
  { key: 'emotional',         label: 'Emozionale · misurata, sensoriale' },
  { key: 'cinematic',         label: 'Visiva · immersiva' },
  { key: 'hospitality',       label: 'Ospitale · esperienziale' },
  { key: 'luxury_editorial',  label: 'Editorial luxury · magazine alta gamma' },
  { key: 'commercial_soft',   label: 'Commerciale morbida · rassicurante' },
  { key: 'cultural_analyst',  label: 'Consulenziale · culturale internazionale' },
  { key: 'minimal_executive', label: 'Minimal executive · una frase essenziale' },
];

const NARRATIVE_INTENSITIES = [
  { key: '',          label: 'Intensità abituale dello studio' },
  { key: 'minimal',   label: 'Minimal · essenziale' },
  { key: 'balanced',  label: 'Bilanciata · misurata' },
  { key: 'editorial', label: 'Editoriale · densa' },
  { key: 'cinematic', label: 'Visiva · narrativa' },
];

// ── CulturalReadingBlock ─────────────────────────────────────────────
// Editorial output del Cultural Intelligence Engine™.
// Mostra status (pending/ready/failed) + headline + body + spatial + atmosphere
// + descriptors attivati raggruppati per categoria.
// Quando pending, polling automatico ogni 4s fino a max 12 tentativi.
const CulturalReadingBlock = ({ data, mediaId, onRefresh }) => {
  const { t } = useT();
  const [poll, setPoll] = useState(0);
  const [narrativeMode, setNarrativeMode] = useState('');
  const [narrativeIntensity, setNarrativeIntensity] = useState('');
  const [openOverride, setOpenOverride] = useState(false);
  const cr = data?.cultural_reading || {};
  const status = cr.status || 'absent';
  const ed = cr.editorial_interpretation || {};
  const desc = cr.mapped_cultural_descriptors || {};
  const byCat = desc.by_category || {};
  // Pre-fill controls with the last applied direction (so user sees current state).
  useEffect(() => {
    const pm = cr.provider_meta || {};
    if (pm.narrative_mode && !narrativeMode) setNarrativeMode(pm.narrative_mode);
    if (pm.narrative_intensity && !narrativeIntensity) setNarrativeIntensity(pm.narrative_intensity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cr.provider_meta?.narrative_mode, cr.provider_meta?.narrative_intensity]);

  useEffect(() => {
    if (status !== 'pending' && status !== 'in_progress') return;
    if (poll >= 12) return;
    const t = setTimeout(async () => {
      try {
        const r = await api.get(`/api/inspirations/archive/${mediaId}/cultural-reading`);
        if (r.data && r.data.status !== status) {
          onRefresh?.(r.data);
          return;
        }
      } catch (e) { /* ignore */ }
      setPoll((p) => p + 1);
    }, 4000);
    return () => clearTimeout(t);
  }, [status, poll, mediaId, onRefresh]);

  const retry = async (opts = {}) => {
    try {
      const body = {};
      if (opts.narrative_mode !== undefined)      body.narrative_mode      = opts.narrative_mode || null;
      if (opts.narrative_intensity !== undefined) body.narrative_intensity = opts.narrative_intensity || null;
      await api.post(`/api/inspirations/archive/${mediaId}/cultural-reading`, body);
      setPoll(0);
      onRefresh?.({ status: 'pending', provider_meta: { ...(cr.provider_meta || {}), ...body } });
      toast.info(
        opts.narrative_mode || opts.narrative_intensity
          ? 'MOOD sta ribilanciando l\'interpretazione editoriale.'
          : 'MOOD sta leggendo il linguaggio culturale di questo riferimento.'
      );
    } catch (e) {
      toast.error('Impossibile avviare la lettura.');
    }
  };

  const regenerateWithDirection = () => retry({
    narrative_mode:      narrativeMode,
    narrative_intensity: narrativeIntensity,
  });

  // Status: pending / in_progress
  if (status === 'pending' || status === 'in_progress') {
    return (
      <div className="insd-cultural insd-cultural--pending" data-testid="cultural-reading-pending">
        <p className="ins-eyebrow"><Icons.Sparkles size={11} /> Cultural Reading™</p>
        <div className="insd-cultural__pending">
          <span className="insd-cultural__pulse" />
          <p>{t('inspirations.inspiration_detail.mood_sta_leggendo_il_linguaggio_culturale_di_quest')}</p>
        </div>
      </div>
    );
  }

  if (status === 'failed' || status === 'absent') {
    return (
      <div className="insd-cultural insd-cultural--absent" data-testid="cultural-reading-absent">
        <p className="ins-eyebrow"><Icons.Sparkles size={11} /> Cultural Reading™</p>
        <p className="insd-cultural__quiet">
          {status === 'failed'
            ? 'La lettura culturale non è stata completata. Puoi riprovare.'
            : 'MOOD non ha ancora letto questo riferimento.'}
        </p>
        <button type="button" className="ins-btn" onClick={() => retry()} data-testid="cultural-reading-retry">
          <Icons.Sparkles size={12} /> Avvia lettura culturale
        </button>
      </div>
    );
  }

  // status === 'ready'
  return (
    <div className="insd-cultural" data-testid="cultural-reading-ready">
      <p className="ins-eyebrow"><Icons.Sparkles size={11} /> Editorial Interpretation™</p>
      {ed.headline && <h3 className="insd-cultural__headline">{ed.headline}</h3>}
      {ed.body && <p className="insd-cultural__body">{ed.body}</p>}

      <div className="insd-cultural__grid">
        {ed.spatial_reading && (
          <div className="insd-cultural__cell">
            <p className="ins-label">Spatial Intelligence™</p>
            <p className="insd-cultural__cell-body">{ed.spatial_reading}</p>
          </div>
        )}
        {ed.atmosphere_language && (
          <div className="insd-cultural__cell">
            <p className="ins-label">Style Reading</p>
            <p className="insd-cultural__cell-body">{ed.atmosphere_language}</p>
          </div>
        )}
      </div>

      {Object.keys(byCat).length > 0 && (
        <div className="insd-cultural__descriptors">
          <p className="ins-label">Design Affinity™</p>
          <div className="insd-cultural__chips">
            {Object.entries(byCat).map(([cat, list]) => (
              list.slice(0, 4).map((d) => (
                <span key={`${cat}-${d.code}`} className="insd-cultural__chip" title={cat}>
                  {d.label}
                </span>
              ))
            ))}
          </div>
        </div>
      )}

      {/* ── Narrative Mode™ override contestuale ────────────────────── */}
      <div className="insd-narrative" data-testid="narrative-mode-block">
        <button type="button"
                className="insd-narrative__toggle"
                onClick={() => setOpenOverride((v) => !v)}
                data-testid="narrative-mode-toggle"
                aria-expanded={openOverride}>
          <Icons.SlidersHorizontal size={11} />
          <span>{t('inspirations.inspiration_detail.adatta_la_direzione_editoriale_per_questo_riferime')}</span>
          <Icons.ChevronDown size={11}
                              style={{ transform: openOverride ? 'rotate(180deg)' : 'none',
                                       transition: 'transform 160ms ease' }} />
        </button>
        {openOverride && (
          <div className="insd-narrative__panel" data-testid="narrative-mode-panel">
            <div className="insd-narrative__row">
              <label className="ins-label" htmlFor="narrative-mode-select">{t('inspirations.inspiration_detail.direzione_editoriale')}</label>
              <select id="narrative-mode-select"
                      className="insd-narrative__select"
                      value={narrativeMode}
                      onChange={(e) => setNarrativeMode(e.target.value)}
                      data-testid="narrative-mode-select">
                {NARRATIVE_MODES.map((m) => (
                  <option key={m.key || 'default'} value={m.key}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="insd-narrative__row">
              <label className="ins-label" htmlFor="narrative-intensity-select">Intensità narrativa</label>
              <select id="narrative-intensity-select"
                      className="insd-narrative__select"
                      value={narrativeIntensity}
                      onChange={(e) => setNarrativeIntensity(e.target.value)}
                      data-testid="narrative-intensity-select">
                {NARRATIVE_INTENSITIES.map((m) => (
                  <option key={m.key || 'default'} value={m.key}>{m.label}</option>
                ))}
              </select>
            </div>
            <p className="insd-narrative__hint">
              La direzione qui sotto sovrascrive solo questa interpretazione.
              I segnali visivi restano invariati, ribilanciamo solo il registro editoriale.
            </p>
            <button type="button"
                    className="insd-narrative__regen"
                    onClick={regenerateWithDirection}
                    data-testid="narrative-mode-regenerate">
              <Icons.RefreshCw size={11} /> Rigenera interpretazione
            </button>
          </div>
        )}
      </div>

      <button type="button" className="insd-cultural__refresh" onClick={() => retry()}
              data-testid="cultural-reading-refresh">
        <Icons.RefreshCw size={10} /> Riesegui lettura
      </button>
    </div>
  );
};

// ── ProductInfoBlock — visible only for inspiration_type='product' ───
// Mostra Brand · Collection · Categoria · Designer · Page reference + diritti.
// NESSUN prezzo, NESSUN codice prodotto: questo NON è un PIM.
const ProductInfoBlock = ({ data }) => {
  const { t } = useT();
  const rightsLabel = {
    uploaded_by_tenant:  'Caricato dallo studio',
    supplier_authorized: 'Autorizzato dal fornitore',
    external_reference:  'Riferimento esterno',
    unknown:             'Diritti da verificare',
  }[data.rights_status] || 'Caricato dallo studio';
  return (
    <div className="insd-product" data-testid="inspiration-product-block">
      <p className="ins-eyebrow"><Icons.Package size={11} /> Product Inspiration™</p>
      <div className="insd-product__grid">
        {data.brand && (
          <div>
            <span className="ins-label">Brand</span>
            <p className="insd-product__val">{data.brand}</p>
          </div>
        )}
        {data.collection && (
          <div>
            <span className="ins-label">Collezione</span>
            <p className="insd-product__val">{data.collection}</p>
          </div>
        )}
        {data.product_category && (
          <div>
            <span className="ins-label">Categoria</span>
            <p className="insd-product__val">{data.product_category}</p>
          </div>
        )}
        {data.designer && (
          <div>
            <span className="ins-label">Design</span>
            <p className="insd-product__val">{data.designer}</p>
          </div>
        )}
      </div>
      <p className="insd-product__rights" data-testid="inspiration-product-rights">
        <Icons.ShieldCheck size={10} /> {rightsLabel}
        {data.rights_status !== 'supplier_authorized' && (
          <em>{' '}{t('inspirations.inspiration_detail.rights_verify_note')}</em>
        )}
      </p>
      {data.id && (
        <Link
          to={`/inspirations/products/${data.id}`}
          className="insd-product__atlas-link"
          data-testid="inspiration-open-product-gallery"
        >
          <Icons.LayoutGrid size={11} />
          <span>{t('inspirations.inspiration_detail.apri_product_gallery')}</span>
          <Icons.ArrowRight size={11} />
        </Link>
      )}
    </div>
  );
};

export default InspirationDetailDrawer;
