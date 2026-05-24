import React, { useEffect, useState } from 'react';
import { adminApi } from '../adminApi';
import { Header } from './BlocksEditor';
import { Plus, Copy, Check } from 'lucide-react';

const MediaLibrary = () => {
  const [media, setMedia] = useState([]);
  const [copied, setCopied] = useState(null);
  const [form, setForm]   = useState({ open: false, file_url: '', alt_text: '', category: 'site' });

  const load = () => { adminApi.listMedia().then((r) => setMedia(r.data?.media || [])); };
  useEffect(load, []);

  const submit = async (e) => {
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

  return (
    <div data-testid="media-library">
      <div className="flex items-end justify-between gap-4 mb-8">
        <Header title="Media Library" subtitle={`All images used across the public site. Reference by UUID — never inline URLs.`} />
        <button onClick={() => setForm((f) => ({ ...f, open: !f.open }))} className="btn-pill-teal" style={{ padding: '0.6rem 1.1rem', fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: 8 }} data-testid="media-add-toggle">
          <Plus size={14} /> Register external URL
        </button>
      </div>

      {form.open && (
        <form onSubmit={submit} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '1.25rem', marginBottom: '2rem', display: 'grid', gridTemplateColumns: '2fr 1.4fr 1fr auto', gap: '0.8rem' }}>
          <input
            type="url"
            placeholder="https://…/image.jpg"
            value={form.file_url}
            onChange={(e) => setForm({ ...form, file_url: e.target.value })}
            required
            style={inp}
            data-testid="media-url-input"
          />
          <input
            type="text"
            placeholder="Alt text"
            value={form.alt_text}
            onChange={(e) => setForm({ ...form, alt_text: e.target.value })}
            style={inp}
            data-testid="media-alt-input"
          />
          <input
            type="text"
            placeholder="Category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            style={inp}
          />
          <button type="submit" className="btn-pill-teal" style={{ padding: '0.6rem 1rem', fontSize: '0.74rem' }} data-testid="media-submit">
            Save
          </button>
        </form>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' }}>
        {media.map((m) => (
          <div
            key={m.id}
            style={{
              background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 8, overflow: 'hidden',
            }}
            data-testid={`media-card-${m.id}`}
          >
            <div style={{ aspectRatio: '4/3', background: m.dominant_color || '#1A1A1A' }}>
              <img src={m.file_url} alt={m.alt_text || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ padding: '0.85rem' }}>
              <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.35, marginBottom: 6, maxHeight: 36, overflow: 'hidden' }}>
                {m.alt_text || m.file_name || '—'}
              </p>
              <p style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat, sans-serif', letterSpacing: '0.04em' }}>
                {m.category || 'site'}
              </p>
              <button
                onClick={() => copyId(m.id)}
                style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.75)', fontSize: '0.66rem', padding: '0.3rem 0.55rem', borderRadius: 999, cursor: 'pointer', fontFamily: 'monospace' }}
                data-testid={`media-copy-${m.id}`}
              >
                {copied === m.id ? <><Check size={11} color="#00C9B3" /> Copied</> : <><Copy size={11} /> {m.id.slice(0, 8)}</>}
              </button>
            </div>
          </div>
        ))}
        {media.length === 0 && <p style={{ color: 'rgba(255,255,255,0.4)' }}>No media yet.</p>}
      </div>
    </div>
  );
};

const inp = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6, padding: '0.6rem 0.85rem', color: '#FFFFFF', fontSize: '0.85rem', outline: 'none',
};

export default MediaLibrary;
