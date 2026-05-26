import React, { useEffect, useMemo, useState } from 'react';
import { Search, X, Check, Upload, Grid, FolderTree, Image as ImageIcon } from 'lucide-react';
import { adminApi } from '../adminApi';
import MediaUploader from './MediaUploader';

/**
 * MediaPicker — full-screen modal to select an image from the media_library.
 * Tabs: "Tutte" (grid) | "Per categoria" (grouped) — search bar always visible.
 * Each card shows: dominant color, ratio, category, and current usages
 * ("used in Home Hero", etc.).
 *
 * Props:
 *   open: bool
 *   onClose: () => void
 *   onSelect: (mediaRow) => void
 *   currentMediaId?: string   // highlight the currently-assigned media
 */
const MediaPicker = ({ open, onClose, onSelect, currentMediaId = null }) => {
  const [media, setMedia]       = useState([]);
  const [usages, setUsages]     = useState({});
  const [query, setQuery]       = useState('');
  const [view, setView]         = useState('all');     // 'all' | 'category'
  const [uploaderOpen, setUploaderOpen] = useState(false);
  const [loading, setLoading]   = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      adminApi.listMedia(),
      adminApi.getMediaUsages(),
    ]).then(([m, u]) => {
      setMedia(m.data?.media || []);
      setUsages(u.data?.usages || {});
    }).finally(() => setLoading(false));
  };

  useEffect(() => { if (open) load(); }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return media;
    return media.filter(m =>
      (m.alt_text || '').toLowerCase().includes(q) ||
      (m.file_name || '').toLowerCase().includes(q) ||
      (m.category || '').toLowerCase().includes(q),
    );
  }, [media, query]);

  const grouped = useMemo(() => {
    const g = {};
    filtered.forEach(m => {
      const k = m.category || 'uncategorized';
      (g[k] = g[k] || []).push(m);
    });
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  if (!open) return null;

  const formatUsageLabel = (u) => {
    if (!u || !u.length) return null;
    const first = u[0];
    const label = `${first.page_key} · ${first.section_type.replace(/_/g, ' ')}`;
    return u.length > 1 ? `${label} (+${u.length - 1})` : label;
  };

  const renderCard = (m) => {
    const isCurrent = m.id === currentMediaId;
    const u = usages[m.id] || [];
    const usageLabel = formatUsageLabel(u);
    const ratio = (m.width && m.height) ? (m.width / m.height) : null;
    const ratioLabel = ratio
      ? (ratio > 2.1 ? '21:9' : ratio > 1.6 ? '16:9' : ratio > 1.4 ? '3:2' : ratio > 0.9 ? '1:1' : ratio > 0.7 ? '4:5' : '9:16')
      : null;
    return (
      <button
        key={m.id}
        onClick={() => onSelect?.(m)}
        style={{
          ...cardBase,
          border: isCurrent ? '2px solid var(--mood-teal, #00C9B3)' : '1px solid rgba(255,255,255,0.07)',
        }}
        data-testid={`picker-media-${m.id}`}
      >
        <div style={{
          position: 'relative',
          aspectRatio: '4/3',
          background: m.dominant_color || '#1A1A1A',
          overflow: 'hidden',
        }}>
          <img
            src={m.file_url}
            alt={m.alt_text || ''}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy"
          />
          {isCurrent && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,201,179,0.18)',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
              padding: 10,
            }}>
              <span style={pill}><Check size={11} /> in uso</span>
            </div>
          )}
          {ratioLabel && (
            <span style={{
              position: 'absolute', bottom: 8, left: 8,
              fontSize: 9, fontFamily: 'monospace',
              background: 'rgba(0,0,0,0.7)', color: 'rgba(255,255,255,0.85)',
              padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em',
            }}>{ratioLabel}</span>
          )}
        </div>
        <div style={{ padding: '0.85rem' }}>
          <p style={{
            fontFamily: 'Inter, sans-serif', fontSize: '0.74rem',
            color: 'rgba(255,255,255,0.9)', lineHeight: 1.4,
            margin: 0, marginBottom: 6,
            display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {m.alt_text || m.file_name || '—'}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase',
              fontFamily: 'Inter, sans-serif', color: 'rgba(255,255,255,0.45)',
              padding: '2px 6px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 999,
            }}>{m.category || 'uncategorized'}</span>
            {usageLabel && (
              <span style={{
                fontSize: 9, fontFamily: 'Inter, sans-serif',
                color: 'rgba(0,201,179,0.85)', letterSpacing: '0.04em',
              }}>used in {usageLabel}</span>
            )}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div style={overlay} data-testid="media-picker">
      <div style={panel}>
        {/* Header */}
        <div style={header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ImageIcon size={18} color="var(--mood-teal, #00C9B3)" />
            <h2 style={titleStyle}>Seleziona fotografia</h2>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>
              {filtered.length} {filtered.length === 1 ? 'asset' : 'asset'}
            </span>
          </div>
          <button onClick={onClose} style={iconBtn} data-testid="picker-close">
            <X size={18} />
          </button>
        </div>

        {/* Toolbar */}
        <div style={toolbar}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 440 }}>
            <Search size={14} style={{
              position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              color: 'rgba(255,255,255,0.4)',
            }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca per nome, alt text o categoria"
              style={searchInput}
              data-testid="picker-search"
            />
          </div>
          <div style={{ display: 'flex', gap: 4, padding: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 999 }}>
            <button onClick={() => setView('all')} style={tabBtn(view === 'all')} data-testid="picker-tab-all">
              <Grid size={12} /> Tutte
            </button>
            <button onClick={() => setView('category')} style={tabBtn(view === 'category')} data-testid="picker-tab-category">
              <FolderTree size={12} /> Per categoria
            </button>
          </div>
          <button onClick={() => setUploaderOpen(true)} style={uploadBtn} data-testid="picker-upload">
            <Upload size={12} /> Carica nuova
          </button>
        </div>

        {/* Body */}
        <div style={body}>
          {loading && <p style={{ color: 'rgba(255,255,255,0.4)' }}>Caricamento…</p>}
          {!loading && view === 'all' && (
            <div style={grid}>
              {filtered.map(renderCard)}
              {filtered.length === 0 && (
                <p style={{ color: 'rgba(255,255,255,0.4)' }}>Nessun risultato.</p>
              )}
            </div>
          )}
          {!loading && view === 'category' && (
            <div>
              {grouped.map(([cat, items]) => (
                <section key={cat} style={{ marginBottom: 36 }}>
                  <div style={{
                    display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16,
                  }}>
                    <h3 style={catHeading}>{cat}</h3>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{items.length}</span>
                  </div>
                  <div style={grid}>
                    {items.map(renderCard)}
                  </div>
                </section>
              ))}
              {grouped.length === 0 && (
                <p style={{ color: 'rgba(255,255,255,0.4)' }}>Nessun risultato.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {uploaderOpen && (
        <MediaUploader
          onClose={() => setUploaderOpen(false)}
          onUploaded={(m) => { setUploaderOpen(false); load(); onSelect?.(m); }}
          uploadFn={adminApi.uploadMedia}
        />
      )}
    </div>
  );
};

// ── styles ─────────────────────────────────────────────────────────────
const overlay = {
  position: 'fixed', inset: 0, zIndex: 90,
  background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const panel = {
  background: '#0A0A0A', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12, width: 'min(1400px, 96vw)', height: 'min(900px, 94vh)',
  display: 'grid', gridTemplateRows: 'auto auto 1fr', overflow: 'hidden',
};
const header = {
  padding: '1.1rem 1.75rem', borderBottom: '1px solid rgba(255,255,255,0.06)',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};
const titleStyle = {
  fontFamily: 'Playfair Display, serif', fontSize: '1.15rem',
  color: '#FFFFFF', letterSpacing: '-0.01em', margin: 0, fontWeight: 400,
};
const iconBtn = {
  background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)',
  cursor: 'pointer', padding: 4,
};
const toolbar = {
  padding: '0.9rem 1.75rem', borderBottom: '1px solid rgba(255,255,255,0.06)',
  display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(0,0,0,0.4)',
};
const searchInput = {
  width: '100%', padding: '0.7rem 0.85rem 0.7rem 2.5rem',
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 999, color: '#FFFFFF', fontSize: '0.85rem',
  fontFamily: 'Inter, sans-serif', outline: 'none',
};
const tabBtn = (active) => ({
  padding: '0.5rem 0.95rem', fontSize: '0.72rem',
  fontFamily: 'Inter, sans-serif', fontWeight: 500,
  background: active ? '#FFFFFF' : 'transparent',
  color: active ? '#000000' : 'rgba(255,255,255,0.7)',
  border: 'none', borderRadius: 999, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 6,
  transition: 'all 0.15s', letterSpacing: '0.02em',
});
const uploadBtn = {
  marginLeft: 'auto', padding: '0.55rem 1rem',
  background: 'rgba(0,201,179,0.12)', border: '1px solid rgba(0,201,179,0.35)',
  color: 'var(--mood-teal, #00C9B3)', borderRadius: 999,
  fontFamily: 'Inter, sans-serif', fontSize: '0.72rem', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 6, letterSpacing: '0.04em',
};
const body = {
  overflowY: 'auto', padding: '1.5rem 1.75rem',
};
const grid = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.25rem',
};
const cardBase = {
  background: 'rgba(255,255,255,0.025)', borderRadius: 8, overflow: 'hidden',
  cursor: 'pointer', textAlign: 'left', padding: 0, transition: 'transform 0.18s, border-color 0.18s',
};
const pill = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  background: 'rgba(0,0,0,0.7)', color: 'var(--mood-teal, #00C9B3)',
  fontSize: 9, fontFamily: 'Inter, sans-serif', padding: '4px 8px',
  borderRadius: 999, letterSpacing: '0.06em', textTransform: 'uppercase',
};
const catHeading = {
  fontFamily: 'Playfair Display, serif', fontSize: '0.92rem',
  color: '#FFFFFF', letterSpacing: '-0.005em', margin: 0, fontWeight: 400,
};

export default MediaPicker;
