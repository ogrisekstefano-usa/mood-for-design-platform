import React, { useState } from 'react';
import axios from 'axios';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

/**
 * AccessRecoveryModals — the 4 self-service flows below the login form.
 *
 *   • forgot      → /api/auth/password-reset/request
 *   • magic_link  → /api/auth/magic-link/request
 *   • resend      → /api/auth/resend-invitation
 *   • recovery    → /api/auth/workspace-recovery
 *
 * All four flows are ANTI-ENUMERATION: the response is always neutral
 * ("If the email is associated with an account, ..."). No token, no
 * status differentiation, no signal leaked to the caller. The advisor
 * team is notified asynchronously by email_dispatcher.
 *
 * Single component for all four flows to keep the surface area minimal
 * (4 secondary CTAs share one modal shell, the body changes per `kind`).
 */

const VARIANTS = {
  forgot: {
    eyebrow: 'Password dimenticata',
    headline: 'Inviamoti un link per reimpostarla.',
    body:     'Inserisci l\'email del tuo account. Se è associata a un workspace MOOD, riceverai un link sicuro per impostare una nuova password.',
    cta:      'Invia link di reset',
    success:  'Se l\'email è collegata a un account MOOD, riceverai a breve un link per reimpostare la password. Controlla anche la cartella spam.',
    endpoint: '/api/auth/password-reset/request',
    payload:  (email) => ({ email, locale: 'it' }),
  },
  magic_link: {
    eyebrow: 'Magic Link',
    headline: 'Entra senza password.',
    body:     'Inserisci l\'email del tuo account. Riceverai un link che ti farà accedere direttamente al tuo workspace.',
    cta:      'Inviami un Magic Link',
    success:  'Se l\'email è collegata a un account MOOD, riceverai a breve un Magic Link valido per pochi minuti.',
    endpoint: '/api/auth/magic-link/request',
    payload:  (email) => ({ email, locale: 'it' }),
  },
  resend: {
    eyebrow: 'Reinvia invito',
    headline: 'Ti rimandiamo l\'invito di attivazione.',
    body:     'Sei stato invitato al tuo Blueprint ma non hai ancora completato il primo accesso? Inserisci la stessa email che ti è stata invitata.',
    cta:      'Reinvia invito',
    success:  'Se l\'email è collegata a un invito attivo, riceverai a breve un nuovo Magic Link di attivazione valido 30 giorni.',
    endpoint: '/api/auth/resend-invitation',
    payload:  (email) => ({ email }),
  },
  recovery: {
    eyebrow: 'Workspace recovery',
    headline: 'Ti aiutiamo a ritrovare il tuo spazio.',
    body:     'Inserisci l\'email che pensi sia associata al tuo workspace MOOD. Un MOOD Advisor ti contatterà entro 24 ore.',
    cta:      'Avvia recupero',
    success:  'Grazie. Se l\'email è collegata a un account MOOD, un Advisor ti contatterà entro 24 ore con le informazioni corrette.',
    endpoint: '/api/auth/workspace-recovery',
    payload:  (email) => ({ email }),
  },
};

const AccessRecoveryModal = ({ kind, onClose }) => {
  const v = VARIANTS[kind];
  const [email, setEmail]     = useState('');
  const [busy, setBusy]       = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState(null);

  if (!v) return null;
  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true); setError(null);
    try {
      await axios.post(`${BACKEND}${v.endpoint}`, v.payload(email.trim()));
      setDone(true);
    } catch {
      // Even on network failure, show neutral success.
      // Anti-enumeration MUST hold even if backend is down.
      setDone(true);
    } finally { setBusy(false); }
  };

  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(8,8,10,0.78)',
    backdropFilter: 'blur(10px)', zIndex: 220,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'Inter, sans-serif',
  };
  const card = {
    width: 460, maxWidth: 'calc(100vw - 32px)',
    background: '#0F0F0F', color: '#FFF',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14, padding: '2rem 2.2rem',
    boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
  };

  return (
    <div style={overlay}
         data-testid={`access-modal-${kind}`}
         onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={card}>
        <p style={{
          fontSize: '0.7rem', letterSpacing: '0.22em',
          textTransform: 'uppercase', color: '#00C9B3', marginBottom: 8,
        }}>{v.eyebrow}</p>
        <h2 style={{
          fontFamily: 'DM Serif Display, Playfair Display, serif',
          fontWeight: 400, fontSize: '1.55rem', lineHeight: 1.25,
          marginBottom: 12,
        }}>{v.headline}</h2>
        <p style={{ color: '#888', fontSize: '0.88rem', lineHeight: 1.6,
                    marginBottom: 24 }}>
          {v.body}
        </p>

        {!done && (
          <form onSubmit={submit}>
            <label style={{
              fontSize: '0.7rem', letterSpacing: '0.18em',
              textTransform: 'uppercase', color: '#888',
              marginBottom: 6, display: 'block',
            }}>Email</label>
            <input
              data-testid={`access-modal-${kind}-email`}
              type="email" value={email} required
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              autoFocus
              style={{
                width: '100%', background: 'rgba(255,255,255,0.04)',
                color: '#FFF', border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: 8, padding: '0.75rem 0.9rem',
                fontSize: '0.92rem', marginBottom: 18,
              }} />
            {error && (
              <p style={{ color: '#FF6B6B', fontSize: '0.8rem',
                          marginBottom: 14 }}>{error}</p>
            )}
            <div style={{ display: 'flex', gap: 10,
                          justifyContent: 'flex-end' }}>
              <button type="button" onClick={onClose} disabled={busy}
                data-testid={`access-modal-${kind}-cancel`}
                style={{
                  background: 'transparent', color: '#999',
                  border: '1px solid rgba(255,255,255,0.18)',
                  padding: '0.7rem 1.2rem', borderRadius: 999,
                  fontSize: '0.82rem', cursor: 'pointer',
                  fontFamily: 'inherit',
                }}>Annulla</button>
              <button type="submit" disabled={busy || !email.trim()}
                data-testid={`access-modal-${kind}-submit`}
                style={{
                  background: '#00C9B3', color: '#000', border: 'none',
                  padding: '0.7rem 1.4rem', borderRadius: 999,
                  fontSize: '0.82rem', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                  opacity: (busy || !email.trim()) ? 0.5 : 1,
                }}>
                {busy ? 'Invio in corso…' : v.cta}
              </button>
            </div>
          </form>
        )}

        {done && (
          <div data-testid={`access-modal-${kind}-success`}>
            <p style={{ color: '#A0E0B6', fontSize: '0.9rem',
                        lineHeight: 1.65, marginBottom: 20,
                        background: 'rgba(160,224,182,0.06)',
                        padding: '12px 16px', borderRadius: 6 }}>
              {v.success}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={onClose}
                data-testid={`access-modal-${kind}-close`}
                style={{
                  background: '#FFF', color: '#000', border: 'none',
                  padding: '0.7rem 1.4rem', borderRadius: 999,
                  fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}>Chiudi</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccessRecoveryModal;
