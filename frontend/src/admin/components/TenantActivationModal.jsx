import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { adminAuth } from '../adminApi';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

/**
 * Curatorial Tenant Activation modal — Studio Acquisition Lifecycle, P0-1/2.
 *
 * Triggered by the "Activate Studio" CTA in the Tenant Activation Console
 * drawer. Loads a preview (POST tenant slug suggestion, founder email),
 * lets the advisor edit ONLY the slug, then issues the full-auto
 * activation: tenant + founder user + 30-day magic link + Founder email.
 *
 * Props:
 *   requestId        — studio_requests.id
 *   onClose()        — close without action
 *   onActivated(res) — successful activation (returns { tenant_id, slug, ... })
 */
const TenantActivationModal = ({ requestId, onClose, onActivated }) => {
  const [phase, setPhase] = useState('loading'); // loading | ready | submitting | success | error
  const [preview, setPreview] = useState(null);
  const [tenantSlug, setTenantSlug] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await axios.get(
          `${BACKEND}/api/admin/studio/requests/${requestId}/activation-preview`,
          { headers: adminAuth.headers() },
        );
        if (!alive) return;
        setPreview(r.data);
        setTenantSlug(r.data.suggested_slug || '');
        setTenantName(r.data.tenant_name || '');
        if (r.data.already_activated) {
          setPhase('error');
          setError('Questo studio è già stato attivato.');
        } else {
          setPhase('ready');
        }
      } catch (e) {
        if (!alive) return;
        setPhase('error');
        setError(e.response?.data?.detail || e.message || 'Impossibile caricare l\'anteprima.');
      }
    })();
    return () => { alive = false; };
  }, [requestId]);

  const sanitizeSlug = (v) =>
    (v || '').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  const submit = async () => {
    setPhase('submitting');
    setError(null);
    try {
      const r = await axios.post(
        `${BACKEND}/api/admin/studio/requests/${requestId}/activate`,
        {
          tenant_slug: sanitizeSlug(tenantSlug),
          tenant_name: tenantName.trim() || null,
        },
        { headers: adminAuth.headers() },
      );
      setResult(r.data);
      setPhase('success');
      if (onActivated) onActivated(r.data);
    } catch (e) {
      setPhase('ready');
      const d = e.response?.data?.detail;
      setError(typeof d === 'string' ? d : (d?.reason || e.message || 'Attivazione fallita.'));
    }
  };

  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(8,8,10,0.78)',
    backdropFilter: 'blur(8px)', zIndex: 200,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'Inter, sans-serif',
  };
  const card = {
    width: 520, maxWidth: 'calc(100vw - 32px)',
    background: '#0F0F0F', color: '#FFF',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14, padding: '2rem 2.2rem',
    boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
  };
  const labelStyle = {
    fontSize: '0.7rem', letterSpacing: '0.18em',
    textTransform: 'uppercase', color: '#888',
    marginBottom: 6, display: 'block',
  };
  const inputStyle = {
    width: '100%', background: 'rgba(255,255,255,0.04)',
    color: '#FFF', border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: 8, padding: '0.7rem 0.9rem',
    fontFamily: 'Inter, sans-serif', fontSize: '0.95rem',
  };
  const readOnlyStyle = {
    ...inputStyle,
    background: 'rgba(255,255,255,0.02)',
    color: '#999', cursor: 'not-allowed',
  };

  return (
    <div style={overlay} data-testid="tenant-activation-modal" onClick={(e) => {
      if (e.target === e.currentTarget && phase !== 'submitting') onClose();
    }}>
      <div style={card}>
        <p style={{
          fontSize: '0.7rem', letterSpacing: '0.22em',
          textTransform: 'uppercase', color: '#00C9B3', marginBottom: 8,
        }}>Tenant Activation</p>
        <h2 style={{
          fontFamily: 'DM Serif Display, serif', fontWeight: 400,
          fontSize: '1.55rem', lineHeight: 1.25, marginBottom: 8,
        }}>Conferma e invia l'invito al Founder</h2>
        <p style={{ color: '#888', fontSize: '0.88rem', lineHeight: 1.55, marginBottom: 24 }}>
          Verrà creato il tenant, l'utente Founder e inviata l'email di benvenuto con
          il magic link valido <strong style={{ color: '#FFF' }}>30 giorni</strong>.
          Quest'azione è irreversibile.
        </p>

        {phase === 'loading' && (
          <p data-testid="modal-loading" style={{ color: '#999' }}>Caricamento anteprima…</p>
        )}

        {(phase === 'ready' || phase === 'submitting') && preview && (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Nome tenant</label>
              <input
                data-testid="modal-tenant-name"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                style={inputStyle}
                disabled={phase === 'submitting'}
                maxLength={120}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Suggested slug (modificabile)</label>
              <input
                data-testid="modal-tenant-slug"
                value={tenantSlug}
                onChange={(e) => setTenantSlug(sanitizeSlug(e.target.value))}
                style={inputStyle}
                disabled={phase === 'submitting'}
                maxLength={64}
                spellCheck={false}
              />
              <p style={{ color: '#666', fontSize: '0.72rem', marginTop: 4 }}>
                Lo slug è l'identificativo URL del tenant. Sarà unico nel sistema.
              </p>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Founder email</label>
              <input
                data-testid="modal-founder-email"
                value={preview.founder_email || ''}
                readOnly
                style={readOnlyStyle}
              />
            </div>

            {error && (
              <p data-testid="modal-error" style={{
                color: '#FF6B6B', fontSize: '0.85rem', marginBottom: 14,
                background: 'rgba(255,107,107,0.08)', padding: '8px 12px',
                borderRadius: 6, border: '1px solid rgba(255,107,107,0.25)',
              }}>{error}</p>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                data-testid="modal-cancel"
                onClick={onClose}
                disabled={phase === 'submitting'}
                style={{
                  background: 'transparent', color: '#999',
                  border: '1px solid rgba(255,255,255,0.18)',
                  padding: '0.7rem 1.2rem', borderRadius: 999,
                  fontSize: '0.85rem', cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}>Annulla</button>
              <button
                data-testid="modal-confirm-activate"
                onClick={submit}
                disabled={phase === 'submitting' || !tenantSlug.trim() || !tenantName.trim()}
                style={{
                  background: '#00C9B3', color: '#000',
                  border: 'none',
                  padding: '0.7rem 1.4rem', borderRadius: 999,
                  fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  opacity: (phase === 'submitting' || !tenantSlug.trim() || !tenantName.trim()) ? 0.5 : 1,
                }}>
                {phase === 'submitting' ? 'Attivazione in corso…' : 'Crea & Invita Founder'}
              </button>
            </div>
          </>
        )}

        {phase === 'success' && result && (
          <div data-testid="modal-success">
            <p style={{
              fontSize: '0.78rem', letterSpacing: '0.18em',
              textTransform: 'uppercase', color: '#A0E0B6', marginBottom: 8,
            }}>Tenant attivato</p>
            <p style={{ color: '#FFF', fontSize: '0.95rem', marginBottom: 16, lineHeight: 1.55 }}>
              <strong>{result.tenant_name || tenantName}</strong> è ora attivo
              come tenant <code style={{ color: '#00C9B3' }}>{result.slug}</code>.
            </p>
            <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: 20, lineHeight: 1.55 }}>
              {result.magic_link_sent
                ? 'L\'email di benvenuto con il magic link è stata inviata a '
                : 'Tenant creato, ma l\'invito al founder non è stato inviato a '}
              <span style={{ color: '#FFF' }}>{result.founder_email || preview.founder_email}</span>.
            </p>
            <button
              data-testid="modal-success-close"
              onClick={onClose}
              style={{
                background: '#FFF', color: '#000', border: 'none',
                padding: '0.7rem 1.4rem', borderRadius: 999,
                fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}>Chiudi</button>
          </div>
        )}

        {phase === 'error' && (
          <div>
            <p data-testid="modal-error-fatal" style={{
              color: '#FF6B6B', fontSize: '0.9rem', marginBottom: 18,
            }}>{error}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                style={{
                  background: 'transparent', color: '#999',
                  border: '1px solid rgba(255,255,255,0.18)',
                  padding: '0.7rem 1.4rem', borderRadius: 999,
                  fontSize: '0.85rem', cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}>Chiudi</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TenantActivationModal;
