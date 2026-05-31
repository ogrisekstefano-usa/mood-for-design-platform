/**
 * CommandPalette — ITER178 · Cmd+K Showroom Flow™
 *
 * Global Cmd+K palette per ricerca + creazione Lead/Prospect/Account.
 * Workflow showroom reale:
 *   ricerca → nessun risultato → "Crea nuovo Lead" con prefill automatico.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus, ArrowRight, Sparkles, Loader2 } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const auth = () => {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

/**
 * Hook globale per ascoltare Cmd+K / Ctrl+K.
 * Apre la palette via prop `onOpen` callback.
 */
export function useCommandPaletteHotkey(onOpen) {
  useEffect(() => {
    const handler = (e) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        onOpen?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpen]);
}

export default function CommandPalette({ open, onClose, onCreateLead, onPickLead, onPickAccount }) {
  const [q, setQ] = useState('');
  const [leadResults, setLeadResults] = useState([]);
  const [accountResults, setAccountResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setQ('');
      setLeadResults([]);
      setAccountResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    if (q.trim().length < 2) {
      setLeadResults([]);
      setAccountResults([]);
      return;
    }
    let cancel = false;
    setLoading(true);
    const tid = setTimeout(async () => {
      try {
        const [leadsRes, accRes] = await Promise.allSettled([
          axios.get(`${API}/api/leads/search`, { params: { q, limit: 6 }, headers: auth() }),
          axios.get(`${API}/api/relations/accounts`, { params: { q, limit: 6 }, headers: auth() }),
        ]);
        if (cancel) return;
        setLeadResults(leadsRes.status === 'fulfilled' ? (leadsRes.value.data?.data || []) : []);
        const accData = accRes.status === 'fulfilled' ? (accRes.value.data?.data || accRes.value.data || []) : [];
        setAccountResults(Array.isArray(accData) ? accData : []);
      } catch (e) {
        if (!cancel) {
          setLeadResults([]);
          setAccountResults([]);
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    }, 260);
    return () => { cancel = true; clearTimeout(tid); };
  }, [q, open]);

  if (!open) return null;

  const totalResults = leadResults.length + accountResults.length;
  const hasQuery = q.trim().length >= 2;
  const noResultsCreate = hasQuery && !loading && totalResults === 0;

  return (
    <div
      className="cmdk__overlay"
      data-testid="cmdk-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose?.(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(12, 14, 18, 0.72)',
        backdropFilter: 'blur(8px)', zIndex: 998,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '14vh', padding: '14vh 24px 24px',
      }}
    >
      <div
        data-testid="cmdk-panel"
        style={{
          background: '#ffffff', borderRadius: 12, maxWidth: 640, width: '100%',
          boxShadow: '0 24px 64px rgba(0,0,0,0.32)', overflow: 'hidden',
        }}
      >
        {/* Input row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
          borderBottom: '1px solid #f1f1f3',
        }}>
          {loading ? <Loader2 size={18} className="animate-spin" color="#7a7d83" /> : <Search size={18} color="#7a7d83" />}
          <input
            ref={inputRef}
            data-testid="cmdk-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca un Lead, un Cliente, oppure digita un nome per crearlo…"
            style={{
              flex: 1, border: 0, outline: 'none', fontSize: 16, color: '#0c0e12',
              background: 'transparent',
            }}
          />
          <kbd style={{
            fontSize: 11, color: '#7a7d83', background: '#f1f1f3', padding: '3px 7px',
            borderRadius: 4, letterSpacing: '0.05em',
          }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          {!hasQuery && (
            <div style={{ padding: '24px 18px', color: '#7a7d83', fontSize: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Sparkles size={14} />
                <span style={{ fontWeight: 500, color: '#0c0e12' }}>Suggerimenti rapidi</span>
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <li>· Cerca per <strong>nome</strong>, <strong>cognome</strong> o <strong>email</strong></li>
                <li>· Se non trovi nessuno → premi <kbd style={kbdInline}>Invio</kbd> per creare un nuovo Lead</li>
                <li>· <kbd style={kbdInline}>Cmd</kbd> + <kbd style={kbdInline}>K</kbd> per aprire ovunque</li>
              </ul>
            </div>
          )}

          {leadResults.length > 0 && (
            <Section title="Lead">
              {leadResults.map((l) => (
                <ResultRow
                  key={l.id}
                  testid={`cmdk-lead-${l.id}`}
                  primary={`${l.first_name || ''} ${l.last_name || ''}`.trim() || l.email || '—'}
                  secondary={`${l.status || 'lead'} · ${l.email || '—'}`}
                  onClick={() => { onPickLead?.(l); onClose?.(); navigate(`/relations/leads/${l.id}`); }}
                />
              ))}
            </Section>
          )}

          {accountResults.length > 0 && (
            <Section title="Account / Cliente">
              {accountResults.map((a) => (
                <ResultRow
                  key={a.id}
                  testid={`cmdk-account-${a.id}`}
                  primary={a.account_name || a.display_name || a.email || '—'}
                  secondary={`${a.lifecycle_stage || 'account'} · ${a.email || '—'}`}
                  onClick={() => { onPickAccount?.(a); onClose?.(); navigate(`/relations/accounts/${a.id}`); }}
                />
              ))}
            </Section>
          )}

          {noResultsCreate && (
            <div data-testid="cmdk-no-results" style={{ padding: '18px' }}>
              <div style={{ fontSize: 13, color: '#7a7d83', marginBottom: 12 }}>
                Nessun risultato per <strong style={{ color: '#0c0e12' }}>«{q}»</strong>
              </div>
              <button
                data-testid="cmdk-create-lead"
                onClick={() => {
                  onClose?.();
                  onCreateLead?.({ choice: 'lead', query: q });
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '14px 16px', textAlign: 'left',
                  background: '#0c0e12', color: '#ffffff', border: 0, borderRadius: 8,
                  cursor: 'pointer', fontSize: 14, fontWeight: 500,
                }}
              >
                <UserPlus size={18} strokeWidth={1.6} />
                <span style={{ flex: 1 }}>Crea nuovo Lead «{q}»</span>
                <ArrowRight size={16} />
              </button>
              <div style={{ fontSize: 11, color: '#9b9da3', marginTop: 8, textAlign: 'center' }}>
                Il modale Nuova Relazione™ si aprirà con il nome già compilato.
              </div>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 18px', borderTop: '1px solid #f1f1f3',
          fontSize: 11, color: '#9b9da3', letterSpacing: '0.03em',
        }}>
          <span>CRM · Ricerca globale</span>
          <span>Powered by Nuova Relazione™</span>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div style={{
        padding: '10px 18px 6px', fontSize: 10, letterSpacing: '0.16em',
        textTransform: 'uppercase', color: '#9b9da3', fontWeight: 600,
      }}>
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

function ResultRow({ testid, primary, secondary, onClick }) {
  return (
    <button
      data-testid={testid}
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '12px 18px', background: 'transparent', border: 0, cursor: 'pointer',
        borderTop: '1px solid #f9f9fa',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#f9f9fa'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ fontSize: 14, color: '#0c0e12', fontWeight: 500 }}>{primary}</div>
      <div style={{ fontSize: 12, color: '#7a7d83', marginTop: 2 }}>{secondary}</div>
    </button>
  );
}

const kbdInline = {
  fontSize: 10, color: '#5a5d63', background: '#f1f1f3',
  padding: '1px 5px', borderRadius: 3, fontFamily: 'monospace',
};
