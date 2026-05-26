import React, { useEffect, useState } from 'react';
import { adminApi } from '../adminApi';
import { Header } from './BlocksEditor';
import { Plus, Copy, Check, Upload, Trash2, Link as LinkIcon } from 'lucide-react';
import MediaUploader from '../components/MediaUploader';

const MediaLibrary = () => {
  const [media, setMedia] = useState([]);
  const [copied, setCopied] = useState(null);
  const [uploaderOpen, setUploaderOpen] = useState(false);
  const [form, setForm]   = useState({ open: false, file_url: '', alt_text: '', category: 'site' });

  const load = () => { adminApi.listMedia().then((r) => setMedia(r.data?.media || [])); };
  useEffect(load, []);

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

  return (
    <div data-testid="media-library">
      <div className="flex items-end justify-between gap-4 mb-8">
        <Header
          title="Media Library"
          subtitle="Carica le fotografie con crop e filtri, oppure registra un URL esterno. Riferisci sempre tramite UUID."
        />
        <div style={{ display: 'flex', gap: 8 }}>
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
        {media.map((m) => (
          <div
            key={m.id}
            style={{
              background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 8, overflow: 'hidden', position: 'relative',
            }}
            data-testid={`media-card-${m.id}`}
          >
            <div style={{ aspectRatio: '4/3', background: m.dominant_color || '#1A1A1A', position: 'relative' }}>
              <img src={m.file_url} alt={m.alt_text || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
              <button
                onClick={() => copyId(m.id)}
                style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.75)', fontSize: '0.66rem', padding: '0.3rem 0.55rem', borderRadius: 999, cursor: 'pointer', fontFamily: 'monospace' }}
                data-testid={`media-copy-${m.id}`}
              >
                {copied === m.id ? <><Check size={11} color="#00C9B3" /> Copiato</> : <><Copy size={11} /> {m.id.slice(0, 8)}</>}
              </button>
            </div>
          </div>
        ))}
        {media.length === 0 && (
          <p style={{ color: 'rgba(255,255,255,0.4)' }}>Nessuna media caricata.</p>
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
