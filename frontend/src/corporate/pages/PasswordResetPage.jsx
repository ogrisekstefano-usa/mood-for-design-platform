import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useSearchParams, useNavigate } from 'react-router-dom';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

/**
 * Reset-password landing.
 *
 * Reached by the user clicking the link in the password-reset email
 * (token in URL ?token=...). Renders a "set a new password" form,
 * POSTs to /api/auth/password-reset/consume with token + new_password,
 * then redirects to /accedi (corporate login surface).
 *
 * Token validation states:
 *   • token missing → "Link non valido."
 *   • backend says invalid/expired/already_used → editorial error copy
 *   • backend says weak_password → password rules hint
 */
const PasswordResetPage = () => {
  const [params]   = useSearchParams();
  const token      = params.get('token') || '';
  const [pw, setPw]       = useState('');
  const [pw2, setPw2]     = useState('');
  const [phase, setPhase] = useState(token ? 'ready' : 'no_token');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const RULES = [
    { test: (s) => s.length >= 8,          label: 'almeno 8 caratteri' },
    { test: (s) => /[A-Z]/.test(s),        label: 'una lettera maiuscola' },
    { test: (s) => /\d/.test(s),           label: 'un numero' },
    { test: (s) => /[^A-Za-z0-9]/.test(s), label: 'un carattere speciale' },
  ];
  const passesAll = pw && RULES.every((r) => r.test(pw)) && pw === pw2;

  const submit = async (e) => {
    e.preventDefault();
    if (!passesAll) return;
    setPhase('submitting'); setError(null);
    try {
      const r = await axios.post(`${BACKEND}/api/auth/password-reset/consume`, {
        token, new_password: pw,
      });
      if (r.data?.ok) {
        setPhase('success');
        setTimeout(() => navigate('/command-center/overview'), 2200);
      } else {
        setPhase('ready');
        const reason = r.data?.reason || 'invalid';
        const map = {
          invalid:      'Il link non è valido.',
          expired:      'Il link è scaduto. Richiedine uno nuovo.',
          already_used: 'Questo link è già stato usato. Richiedine uno nuovo.',
          weak_password:'La password non soddisfa i requisiti minimi.',
        };
        setError(map[reason] || 'Impossibile reimpostare la password.');
      }
    } catch {
      setPhase('ready');
      setError('Errore di connessione. Riprova tra qualche secondo.');
    }
  };

  const container = {
    minHeight: '100vh', background: '#0A0A0B',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'Inter, sans-serif',
  };
  const card = {
    width: 460, maxWidth: 'calc(100vw - 32px)',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14, padding: '2.5rem',
    color: '#FFF',
  };

  if (phase === 'no_token') {
    return (
      <div style={container} data-testid="reset-no-token">
        <div style={card}>
          <p style={{ color: '#00C9B3', fontSize: '0.66rem',
                      letterSpacing: '0.32em', textTransform: 'uppercase',
                      marginBottom: 12 }}>Link non valido</p>
          <h1 style={{ fontFamily: 'Playfair Display, serif',
                       fontSize: '1.9rem', marginBottom: 16 }}>
            Manca il token di reset.
          </h1>
          <p style={{ color: '#888', lineHeight: 1.6 }}>
            Riapri il link ricevuto via email, oppure richiedi un nuovo
            link di reset dalla pagina di accesso.
          </p>
          <button onClick={() => navigate('/accedi')}
            style={{ marginTop: 28, background: '#00C9B3', color: '#000',
                     border: 'none', padding: '0.8rem 1.4rem',
                     borderRadius: 999, fontWeight: 600, cursor: 'pointer' }}
            data-testid="reset-back-to-login">
            Torna all'accesso
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'success') {
    return (
      <div style={container} data-testid="reset-success">
        <div style={card}>
          <p style={{ color: '#A0E0B6', fontSize: '0.66rem',
                      letterSpacing: '0.32em', textTransform: 'uppercase',
                      marginBottom: 12 }}>Password aggiornata</p>
          <h1 style={{ fontFamily: 'Playfair Display, serif',
                       fontSize: '1.9rem', marginBottom: 16 }}>
            Tutto fatto.
          </h1>
          <p style={{ color: '#888', lineHeight: 1.6 }}>
            Stai per essere reindirizzato al tuo workspace…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={container} data-testid="reset-password-page">
      <div style={card}>
        <p style={{ color: '#00C9B3', fontSize: '0.66rem',
                    letterSpacing: '0.32em', textTransform: 'uppercase',
                    marginBottom: 12 }}>Reset password</p>
        <h1 style={{ fontFamily: 'Playfair Display, serif',
                     fontSize: '1.9rem', marginBottom: 24 }}>
          Imposta una nuova password
        </h1>

        <form onSubmit={submit}>
          <label style={{ fontSize: '0.66rem', letterSpacing: '0.22em',
                          textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)',
                          display: 'block', marginBottom: 6 }}>Nuova password</label>
          <input type="password" value={pw}
            onChange={(e) => setPw(e.target.value)}
            data-testid="reset-pw-1"
            disabled={phase === 'submitting'} autoFocus
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)',
                     border: '1px solid rgba(255,255,255,0.12)',
                     borderRadius: 6, padding: '0.75rem 0.9rem',
                     color: '#FFF', fontSize: '0.92rem',
                     marginBottom: 14, outline: 'none' }} />

          <label style={{ fontSize: '0.66rem', letterSpacing: '0.22em',
                          textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)',
                          display: 'block', marginBottom: 6 }}>Conferma password</label>
          <input type="password" value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            data-testid="reset-pw-2"
            disabled={phase === 'submitting'}
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)',
                     border: '1px solid rgba(255,255,255,0.12)',
                     borderRadius: 6, padding: '0.75rem 0.9rem',
                     color: '#FFF', fontSize: '0.92rem',
                     marginBottom: 18, outline: 'none' }} />

          <ul style={{ listStyle: 'none', padding: 0, marginBottom: 18,
                       fontSize: '0.78rem' }}>
            {RULES.map((r) => (
              <li key={r.label}
                  style={{ color: pw && r.test(pw) ? '#A0E0B6' : '#666',
                           marginBottom: 4 }}>
                {pw && r.test(pw) ? '✓' : '○'} {r.label}
              </li>
            ))}
            <li style={{ color: pw && pw2 && pw === pw2 ? '#A0E0B6' : '#666' }}>
              {pw && pw2 && pw === pw2 ? '✓' : '○'} le due password coincidono
            </li>
          </ul>

          {error && (
            <p style={{ color: '#FFB4A2', fontSize: '0.8rem',
                        marginBottom: 14 }}
               data-testid="reset-error">{error}</p>
          )}

          <button type="submit" disabled={!passesAll || phase === 'submitting'}
            data-testid="reset-submit"
            style={{ width: '100%', background: '#00C9B3', color: '#000',
                     border: 'none', padding: '0.9rem 1.2rem',
                     borderRadius: 999, fontWeight: 600,
                     cursor: passesAll ? 'pointer' : 'not-allowed',
                     opacity: passesAll ? 1 : 0.5,
                     fontFamily: 'Inter, sans-serif',
                     fontSize: '0.85rem' }}>
            {phase === 'submitting' ? 'Aggiornamento in corso…' : 'Aggiorna password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PasswordResetPage;
