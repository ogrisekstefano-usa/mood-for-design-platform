/**
 * EntityPicker — ITER187.B.
 * Operational autocomplete for Lead / Prospect / Customer / Design Journey.
 * NO AI suggestions. The user types, results are listed, the user picks.
 */
import React, { useEffect, useRef, useState } from 'react';
import * as Icons from 'lucide-react';
import api from '../../../lib/api';

// Map UI linked_type → backend list endpoint + label fields
const ENDPOINT = {
  lead:     { url: '/api/relations/leads',     nameKey: 'name',         emailKey: 'email' },
  prospect: { url: '/api/relations/prospects', nameKey: 'name',         emailKey: 'email' },
  customer: { url: '/api/relations/accounts',  nameKey: 'account_name', emailKey: 'email' },
  journey:  { url: '/api/projects',            nameKey: 'title',        emailKey: 'client_email' },
};

export default function EntityPicker({ linkedType, value, onPick, placeholder }) {
  const cfg = ENDPOINT[linkedType];
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (!cfg) return;
    let cancelled = false;
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const params = { limit: 25 };
        if (q.trim()) params.q = q.trim();
        const r = await api.get(cfg.url, { params });
        if (cancelled) return;
        // Different endpoints return slightly different shapes
        const data = r.data;
        const rows = Array.isArray(data) ? data
                    : (data?.items || data?.results || data?.projects || data?.data || []);
        // Projects endpoint returns list directly (array); leads/prospects/accounts may use {items} or array
        let filtered = rows;
        if (!q.trim() === false && linkedType === 'journey') {
          // client-side title filter when projects endpoint has no q
          filtered = rows.filter((r2) => (r2.title || '').toLowerCase().includes(q.toLowerCase()));
        }
        setResults(filtered.slice(0, 25));
      } catch (_) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [q, linkedType, cfg]);

  if (!cfg) return null;

  return (
    <div ref={ref} style={{ position: 'relative' }} data-testid={`cm-entity-picker-${linkedType}`}>
      {value ? (
        <div className="cm-input" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{value.name || value.id}</span>
          <button type="button" className="cm-btn cm-btn-ghost cm-btn-sm"
                   onClick={() => onPick(null)} aria-label="Rimuovi selezione">
            <Icons.X size={12} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <input className="cm-input" value={q}
                onChange={(e) => setQ(e.target.value)}
                onFocus={() => setOpen(true)}
                placeholder={placeholder || `Cerca ${linkedType}…`}
                data-testid={`cm-entity-input-${linkedType}`} />
      )}
      {open && !value && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: 'var(--cm-surface)', border: '1px solid var(--cm-line-strong)',
          borderRadius: 'var(--cm-radius-sm)', marginTop: 4, maxHeight: 280, overflowY: 'auto',
          zIndex: 10, boxShadow: '0 10px 30px rgba(0,0,0,.5)',
        }}>
          {loading && <div style={{ padding: 10, color: 'var(--cm-ink-mute)', fontSize: 13 }}>Caricamento…</div>}
          {!loading && results.length === 0 && (
            <div style={{ padding: 10, color: 'var(--cm-ink-mute)', fontSize: 13 }}>Nessun risultato.</div>
          )}
          {!loading && results.map((r) => {
            const name = r[cfg.nameKey] || r.title || r.name || r.id;
            const sub = r[cfg.emailKey] || r.email || '';
            return (
              <button key={r.id} type="button"
                       onClick={() => { onPick({ id: r.id, name }); setOpen(false); setQ(''); }}
                       data-testid={`cm-entity-option-${linkedType}-${r.id}`}
                       style={{
                         display: 'block', width: '100%', textAlign: 'left',
                         padding: '8px 12px', background: 'transparent',
                         border: 0, color: 'var(--cm-ink)', cursor: 'pointer', fontSize: 13,
                       }}>
                <div style={{ fontWeight: 500 }}>{name}</div>
                {sub && <div style={{ color: 'var(--cm-ink-mute)', fontSize: 12 }}>{sub}</div>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
