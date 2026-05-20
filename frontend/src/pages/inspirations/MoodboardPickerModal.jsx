/**
 * MoodboardPickerModal — Phase F2.1.
 *
 * Premium modal picker per scegliere su quale moodboard portare un asset
 * dalla Product Gallery™.
 *
 * Flow:
 *   1. Carica recent moodboards (tenant-scoped)
 *   2. Search + filter
 *   3. Optional: crea nuovo moodboard inline
 *   4. Su selezione: POST /api/moodboards/{id}/blocks con metadata
 *      preservando inspiration_id + display_meta dell'asset
 */
import React, { useEffect, useMemo, useState } from 'react';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';

const fmtDate = (iso) => {
  try { return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }); }
  catch { return ''; }
};

export default function MoodboardPickerModal({ asset, onClose, onAdded }) {
  const [moodboards, setMoodboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(null);          // moodboard id currently being added to
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    api.get('/api/moodboards?limit=40')
      .then(r => {
        const payload = r.data;
        let items = [];
        if (Array.isArray(payload)) items = payload;
        else if (Array.isArray(payload?.items)) items = payload.items;
        else if (Array.isArray(payload?.data)) items = payload.data;
        else if (Array.isArray(payload?.moodboards)) items = payload.moodboards;
        setMoodboards(items);
      })
      .catch(() => setMoodboards([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return moodboards;
    return moodboards.filter(m => (m.title || m.name || '').toLowerCase().includes(q));
  }, [moodboards, search]);

  const addToMoodboard = async (mb) => {
    if (!asset || busy) return;
    setBusy(mb.id);
    try {
      // Compute a sensible aspect ratio
      const ar = (asset.width && asset.height) ? asset.width / asset.height : 1.0;
      const baseW = 320;
      const block = {
        block_type: 'image',
        x: 60,
        y: 60,
        width: baseW,
        height: Math.round(baseW / ar),
        rotation: 0,
        style: {
          focal_point: '50% 50%',
          zoom: 1.0,
          fit_mode: 'cover',
        },
        metadata: {
          inspiration_id:    asset.id,
          source_type:       'product_gallery',
          source_tab:        'visual_atlas',
          brand:             asset.brand,
          collection:        asset.collection,
          product_name:      asset.product_name,
          product_category:  asset.product_category,
          asset_type:        asset.asset_type,
          compositional_role: asset.compositional_role,
          color_family:      asset.color_family,
          file_url:          asset.file_url,
        },
      };
      await api.post(`/api/moodboards/${mb.id}/blocks`, block);
      // Emit usage event (best-effort)
      api.post('/api/inspirations/registry/usage-events', {
        product_id: asset.id,
        usage_type: 'added_to_moodboard',
        moodboard_id: mb.id,
      }).catch(() => {});
      toast.success(`Aggiunto a "${mb.title || mb.name}"`);
      onAdded && onAdded(mb.id);
    } catch (e) {
      toast.error('Impossibile aggiungere al moodboard');
    } finally {
      setBusy(null);
    }
  };

  const createNewMoodboard = async () => {
    const title = newTitle.trim();
    if (!title) { toast.error('Indica un titolo'); return; }
    try {
      const r = await api.post('/api/moodboards', { title });
      // POST /api/moodboards returns the moodboard object flat (id at root)
      const mb = r.data?.item || r.data?.data || r.data;
      if (!mb?.id) { toast.error('Risposta server non valida'); return; }
      setMoodboards(m => [mb, ...m]);
      setCreating(false);
      setNewTitle('');
      // Add asset immediately
      await addToMoodboard(mb);
    } catch {
      toast.error('Creazione moodboard non riuscita');
    }
  };

  return (
    <div
      className="mp-modal"
      role="dialog"
      aria-modal="true"
      data-testid="mp-modal"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="mp-modal__card" onClick={(e) => e.stopPropagation()}>
        <header className="mp-modal__head">
          <div>
            <p className="mp-modal__eyebrow">Aggiungi al moodboard</p>
            <h3 className="mp-modal__title">
              <em>{asset?.product_name || 'Asset'}</em>
            </h3>
            <p className="mp-modal__sub">
              {asset?.brand || ''}{asset?.collection ? ` · ${asset.collection}` : ''}
            </p>
          </div>
          <button
            type="button"
            className="mp-modal__close"
            onClick={onClose}
            aria-label="Chiudi"
            data-testid="mp-close"
          >
            <Icons.X size={14} />
          </button>
        </header>

        <div className="mp-modal__body">
          <div className="mp-modal__search">
            <Icons.Search size={13} />
            <input
              type="text"
              value={search}
              placeholder="Cerca tra i tuoi moodboard"
              onChange={(e) => setSearch(e.target.value)}
              data-testid="mp-search"
            />
          </div>

          <div className="mp-modal__list" data-testid="mp-list">
            {loading && <p className="mp-modal__loading">Sto caricando i moodboard…</p>}
            {!loading && filtered.length === 0 && (
              <p className="mp-modal__empty">
                Nessun moodboard {search ? 'trovato' : 'ancora'}. Crea il primo.
              </p>
            )}
            {filtered.map(mb => (
              <button
                key={mb.id}
                type="button"
                className={`mp-row ${busy === mb.id ? 'is-busy' : ''}`}
                onClick={() => addToMoodboard(mb)}
                disabled={busy === mb.id}
                data-testid={`mp-row-${mb.id}`}
              >
                <div className="mp-row__cover">
                  {mb.cover_url
                    ? <img src={mb.cover_url} alt="" loading="lazy" />
                    : <Icons.LayoutGrid size={14} />}
                </div>
                <div className="mp-row__meta">
                  <p className="mp-row__title">{mb.title || mb.name || 'Senza titolo'}</p>
                  <p className="mp-row__sub">
                    {mb.project_name || mb.client_name || 'Studio'}
                    {mb.updated_at ? ` · aggiornato ${fmtDate(mb.updated_at)}` : ''}
                  </p>
                </div>
                <Icons.ArrowRight size={14} className="mp-row__icon" />
              </button>
            ))}
          </div>

          {creating ? (
            <div className="mp-modal__create" data-testid="mp-create-panel">
              <input
                type="text"
                placeholder="Titolo nuovo moodboard"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                autoFocus
                data-testid="mp-create-title"
              />
              <button
                type="button"
                className="mp-btn mp-btn--primary"
                onClick={createNewMoodboard}
                data-testid="mp-create-confirm"
              >
                Crea e aggiungi
              </button>
              <button
                type="button"
                className="mp-btn"
                onClick={() => { setCreating(false); setNewTitle(''); }}
              >
                Annulla
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="mp-modal__create-trigger"
              onClick={() => setCreating(true)}
              data-testid="mp-create-trigger"
            >
              <Icons.Plus size={13} />
              <span>Crea nuovo moodboard</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
