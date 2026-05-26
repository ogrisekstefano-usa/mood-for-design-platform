import React, { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../adminApi';
import { Header } from './BlocksEditor';
import { Copy, Check, Upload, Trash2, Link as LinkIcon, Filter, AlertTriangle } from 'lucide-react';
import MediaUploader from '../components/MediaUploader';

const MediaLibrary = () => {
  const [media, setMedia] = useState([]);
  const [usages, setUsages] = useState({});  // { mediaId: [{page_key, section_type, slot}] }
  const [copied, setCopied] = useState(null);
  const [uploaderOpen, setUploaderOpen] = useState(false);
  const [form, setForm]   = useState({ open: false, file_url: '', alt_text: '', category: 'site' });
  const [onlyOrphans, setOnlyOrphans] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = () => {
    adminApi.listMedia().then((r) => setMedia(r.data?.media || []));
    adminApi.getMediaUsages().then((r) => setUsages(r.data?.usages || {})).catch(() => {});
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!onlyOrphans) return media;
    return media.filter((m) => !(usages[m.id] && usages[m.id].length > 0));
  }, [media, usages, onlyOrphans]);

  const orphansCount = useMemo(
    () => media.filter((m) => !(usages[m.id] && usages[m.id].length > 0)).length,
    [media, usages],
  );

  const submitRegister = async (e) => {
    e.preventDefault();
    if (!form.file_url) return;
    try {
      await adminApi.registerMedia({
        file_url: form.file_url,
        alt_text: form.alt_text,
        category: form.category,
        file_name: form.file_url.split('/').pop().slice(0, 200),
      });
      setForm({ open: false, file_url: '', alt_text: '', category: 'site' });
      load();
    } catch (e2) {
      window.alert('Register failed: ' + (e2?.response?.data?.detail || e2.message));
    }
  };

  const copyId = (id) => {
    navigator.clipboard?.writeText(id);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Archiviare questa immagine?')) return;
    try {
      await adminApi.deleteMedia(id);
      load();
    } catch (e) {
      window.alert('Delete failed: ' + (e?.response?.data?.detail || e.message));
    }
  };

  const handleBulkDeleteOrphans = async () => {
    const orphans = media.filter((m) => !(usages[m.id] && usages[m.id].length > 0));
    if (orphans.length === 0) {
      window.alert('Nessuna immagine orfana trovata.');
      return;
    }
    if (!window.confirm(`Archiviare ${orphans.length} immagini non utilizzate? L'operazione è reversibile dal database.`)) return;
    setBulkBusy(true);
    let ok = 0, fail = 0;
    for (const m of orphans) {
      try { await adminApi.deleteMedia(m.id); ok += 1; }
      catch { fail += 1; }
    }
    setBulkBusy(false);
    window.alert(`Eliminate ${ok} immagini orfane.${fail ? ` (${fail} errori)` : ''}`);
    load();
  };

  return (
    <div data-testid="media-library">
      <div className="flex items-end justify-between gap-4 mb-8">
        <Header
          title="Media Library"
          subtitle="Carica le fotografie con crop e filtri, oppure registra un URL esterno. Riferisci sempre tramite UUID."
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setOnlyOrphans((v) => !v)}
            title="Mostra solo media non utilizzati da alcuna sezione"
            style={{
              padding: '0.55rem 0.95rem', fontSize: '0.72rem',
              background: onlyOrphans ? 'rgba(255,180,162,0.12)' : 'transparent',
              border: `1px solid ${onlyOrphans ? 'rgba(255,180,162,0.45)' : 'rgba(255,255,255,0.18)'}`,
              color: onlyOrphans ? 'rgba(255,180,162,0.95)' : 'rgba(255,255,255,0.85)',
              borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 6,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif', letterSpacing: '0.04em',
            }}
            data-testid="media-filter-orphans"
          >
            <Filter size={12} />
            {onlyOrphans ? `Mostra tutte (orfane: ${orphansCount})` : `Solo orfane (${orphansCount})`}
          </button>
          {orphansCount > 0 && (
            <button
              onClick={handleBulkDeleteOrphans}
              disabled={bulkBusy}
              style={{
                padding: '0.55rem 0.95rem', fontSize: '0.72rem',
                background: 'transparent',
                border: '1px solid rgba(255,180,162,0.45)',
                color: 'rgba(255,180,162,0.95)',
                borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 6,
                cursor: bulkBusy ? 'wait' : 'pointer',
                opacity: bulkBusy ? 0.55 : 1,
                fontFamily: 'Inter, sans-serif', letterSpacing: '0.04em',
              }}
              data-testid="media-delete-orphans"
            >
              <Trash2 size={12} /> {bulkBusy ? `Elimino…` : `Elimina ${orphansCount} orfane`}
            </button>
          )}
          <button
            onClick={() => setUploaderOpen(true)}
            className="btn-pill-teal"
            style={{ padding: '0.6rem 1.1rem', fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: 8 }}
            data-testid="media-upload-toggle"
          >
            <Upload size={14} /> Carica foto
          </button>
          <button
            onClick={() => setForm((f) => ({ ...f, open: !f.open }))}
            style={{
              padding: '0.6rem 1.1rem', fontSize: '0.74rem',
              background: 'transparent', border: '1px solid rgba(255,255,255,0.18)',
              color: 'rgba(255,255,255,0.85)', borderRadius: 999,
              display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
            data-testid="media-add-toggle"
          >
            <LinkIcon size={13} /> Registra URL
          </button>
        </div>
      </div>

      {form.open && (
        <form
          onSubmit={submitRegister}
          style={{
            background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 8, padding: '1.25rem', marginBottom: '2rem',
            display: 'grid', gridTemplateColumns: '2fr 1.4fr 1fr auto', gap: '0.8rem',
          }}
        >
          <input
            type="url" placeholder="https://…/image.jpg" required
            value={form.file_url} onChange={(e) => setForm({ ...form, file_url: e.target.value })}
            style={inp} data-testid="media-url-input"
          />
          <input
            type="text" placeholder="Alt text"
            value={form.alt_text} onChange={(e) => setForm({ ...form, alt_text: e.target.value })}
            style={inp} data-testid="media-alt-input"
          />
          <input
            type="text" placeholder="Category"
            value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
            style={inp}
          />
          <button
            type="submit" className="btn-pill-teal"
            style={{ padding: '0.6rem 1rem', fontSize: '0.74rem' }} data-testid="media-submit"
          >
            Salva
          </button>
        </form>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' }}>
        {filtered.map((m) => {
          const usedIn = usages[m.id] || [];
          const isOrphan = usedIn.length === 0;
          return (
          <div
            key={m.id}
            style={{
              background: 'rgba(255,255,255,0.025)',
              border: `1px solid ${isOrphan ? 'rgba(255,180,162,0.25)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: 8, overflow: 'hidden', position: 'relative',
            }}
            data-testid={`media-card-${m.id}`}
          >
            <div style={{ aspectRatio: '4/3', background: m.dominant_color || '#1A1A1A', position: 'relative' }}>
              <img src={m.file_url} alt={m.alt_text || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {isOrphan && (
                <div
                  title="Non usata in nessuna sezione"
                  style={{
                    position: 'absolute', top: 8, left: 8,
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: 'rgba(255,180,162,0.95)', color: '#000',
                    fontFamily: 'Inter, sans-serif', fontSize: '0.62rem', fontWeight: 600,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    padding: '0.22rem 0.55rem', borderRadius: 999,
                  }}
                  data-testid={`media-badge-orphan-${m.id}`}
                >
                  <AlertTriangle size={10} /> Orfana
                </div>
              )}
              <button
                onClick={() => handleDelete(m.id)}
                title="Archivia"
                style={{
                  position: 'absolute', top: 8, right: 8,
                  background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.18)',
                  borderRadius: 6, padding: '0.32rem', color: 'rgba(255,255,255,0.85)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                data-testid={`media-delete-${m.id}`}
              >
                <Trash2 size={13} />
              </button>
            </div>
            <div style={{ padding: '0.85rem' }}>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.35, marginBottom: 6, maxHeight: 36, overflow: 'hidden' }}>
                {m.alt_text || m.file_name || '—'}
              </p>
              <p style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter, sans-serif', letterSpacing: '0.04em' }}>
                {m.category || 'site'}{m.width ? ` · ${m.width}×${m.height}` : ''}
              </p>
              {usedIn.length > 0 && (
                <p
                  title={usedIn.map((u) => `${u.page_key} · ${u.section_type} · ${u.slot}`).join('\n')}
                  style={{ marginTop: 6, fontSize: '0.62rem', color: 'rgba(0,201,179,0.85)',
                           fontFamily: 'Inter, sans-serif', letterSpacing: '0.04em' }}
                  data-testid={`media-usage-${m.id}`}
                >
                  Usata in {usedIn.length} {usedIn.length === 1 ? 'sezione' : 'sezioni'}
                </p>
              )}
              <button
                onClick={() => copyId(m.id)}
                style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.75)', fontSize: '0.66rem', padding: '0.3rem 0.55rem', borderRadius: 999, cursor: 'pointer', fontFamily: 'monospace' }}
                data-testid={`media-copy-${m.id}`}
              >
                {copied === m.id ? <><Check size={11} color="#00C9B3" /> Copiato</> : <><Copy size={11} /> {m.id.slice(0, 8)}</>}
              </button>
            </div>
          </div>
          );
        })}
        {filtered.length === 0 && (
          <p style={{ color: 'rgba(255,255,255,0.4)' }}>
            {onlyOrphans ? 'Nessuna immagine orfana — tutte le foto sono utilizzate.' : 'Nessuna media caricata.'}
          </p>
        )}
      </div>

      {uploaderOpen && (
        <MediaUploader
          onClose={() => setUploaderOpen(false)}
          onUploaded={() => load()}
          uploadFn={adminApi.uploadMedia}
        />
      )}
    </div>
  );
};

const inp = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6, padding: '0.6rem 0.85rem', color: '#FFFFFF', fontSize: '0.85rem', outline: 'none',
};

export default MediaLibrary;
