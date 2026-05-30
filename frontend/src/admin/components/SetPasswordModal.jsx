import React, { useMemo, useState } from 'react';
import axios from 'axios';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const TOKEN_KEY = 'mood_auth_token';

const tokens = {
  bg: '#08090C',
  surface: '#0C0E13',
  hair: 'rgba(255,255,255,0.06)',
  hairBold: 'rgba(255,255,255,0.12)',
  teal: '#00C9B3',
  danger: '#FFB4A2',
  ink: '#FFFFFF',
  fade1: 'rgba(255,255,255,0.92)',
  fade2: 'rgba(255,255,255,0.68)',
  fade3: 'rgba(255,255,255,0.42)',
};

const rules = [
  { id: 'len',  label: 'Almeno 8 caratteri',         test: (p) => p.length >= 8 },
  { id: 'up',   label: 'Almeno una lettera maiuscola', test: (p) => /[A-Z]/.test(p) },
  { id: 'num',  label: 'Almeno un numero',             test: (p) => /[0-9]/.test(p) },
  { id: 'spec', label: 'Almeno un carattere speciale', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

/**
 * SetPasswordModal — blocking onboarding modal for users who logged in
 * via magic-link and have no password set yet (advisors, founders).
 *
 * Behaviour:
 *   • Cannot be dismissed (no overlay click, no ESC).
 *   • Submit disabled until ALL 4 strength rules pass + confirmation matches.
 *   • On success → onSuccess() (parent refetches whoami).
 */
const SetPasswordModal = ({ userEmail, onSuccess }) => {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const ruleStates = useMemo(
    () => rules.map((r) => ({ ...r, ok: r.test(pw) })),
    [pw],
  );
  const allRulesOk = ruleStates.every((r) => r.ok);
  const matches    = pw.length > 0 && pw === confirm;
  const canSubmit  = allRulesOk && matches && !busy;

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!canSubmit) return;
    setBusy(true);
    setErr(null);
    try {
      const tok = localStorage.getItem(TOKEN_KEY) || '';
      await axios.post(
        `${BACKEND}/api/auth/set-password`,
        { password: pw, confirm_password: confirm },
        { headers: { Authorization: `Bearer ${tok}` } },
      );
      onSuccess?.();
    } catch (e2) {
      setErr(e2?.response?.data?.detail || 'Errore di salvataggio. Riprova.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="set-password-modal"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(5,5,8,0.92)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <form
        onSubmit={submit}
        style={{
          background: tokens.surface,
          border: `1px solid ${tokens.hairBold}`,
          borderRadius: 12,
          maxWidth: 520, width: '100%',
          padding: '2.5rem 2.4rem 2.2rem',
          boxShadow: '0 24px 72px rgba(0,0,0,0.6)',
        }}
      >
        <p style={{
          fontFamily: 'Montserrat, sans-serif',
          fontSize: '0.66rem', letterSpacing: '0.32em',
          textTransform: 'uppercase', color: tokens.teal,
          marginBottom: '0.6rem',
        }}>
          MOOD · Primo accesso
        </p>
        <h1 style={{
          fontFamily: 'Playfair Display, serif', fontWeight: 400,
          fontSize: '1.85rem', lineHeight: 1.2, color: tokens.fade1,
          marginBottom: '0.6rem',
        }}>
          Imposta la tua password.
        </h1>
        <p style={{
          fontFamily: 'Playfair Display, serif', fontStyle: 'italic',
          color: tokens.fade2, fontSize: '0.98rem', lineHeight: 1.55,
          marginBottom: '1.6rem',
        }}>
          D'ora in poi entrerai con email e password.
          {userEmail && (
            <> Account: <span style={{ color: tokens.fade1, fontStyle: 'normal' }}>{userEmail}</span>.</>
          )}
        </p>

        <label style={labelStyle}>Nuova password</label>
        <div style={{ position: 'relative', marginBottom: '1rem' }}>
          <input
            type={showPw ? 'text' : 'password'}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoFocus
            data-testid="setpw-password"
            autoComplete="new-password"
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = tokens.teal)}
            onBlur={(e) => (e.target.style.borderColor = tokens.hairBold)}
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            data-testid="setpw-toggle-visibility"
            style={eyeBtnStyle}
          >
            {showPw ? 'Nascondi' : 'Mostra'}
          </button>
        </div>

        {/* Strength indicator */}
        <ul data-testid="setpw-rules" style={{
          listStyle: 'none', padding: 0, margin: '0 0 1.2rem 0',
          display: 'grid', gap: 6,
        }}>
          {ruleStates.map((r) => (
            <li key={r.id}
                data-testid={`setpw-rule-${r.id}`}
                data-ok={r.ok ? 'true' : 'false'}
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.8rem',
                  color: r.ok ? tokens.teal : tokens.fade3,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
              <span style={{
                display: 'inline-block', width: 14, height: 14,
                borderRadius: 999,
                background: r.ok ? tokens.teal : 'transparent',
                border: r.ok ? 'none' : `1px solid ${tokens.hairBold}`,
                position: 'relative', flexShrink: 0,
              }}>
                {r.ok && (
                  <svg viewBox="0 0 12 12" width="12" height="12"
                       style={{ position: 'absolute', top: 1, left: 1 }}>
                    <path d="M2 6 L5 9 L10 3" stroke="#000" strokeWidth="1.6"
                          fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              {r.label}
            </li>
          ))}
        </ul>

        <label style={labelStyle}>Conferma password</label>
        <input
          type={showPw ? 'text' : 'password'}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          data-testid="setpw-confirm"
          autoComplete="new-password"
          style={{ ...inputStyle, marginBottom: '0.6rem' }}
          onFocus={(e) => (e.target.style.borderColor = tokens.teal)}
          onBlur={(e) => (e.target.style.borderColor = tokens.hairBold)}
        />
        {confirm.length > 0 && !matches && (
          <p data-testid="setpw-mismatch"
             style={{
               fontFamily: 'Inter, sans-serif', fontSize: '0.78rem',
               color: tokens.danger, margin: '0 0 0.8rem 0',
             }}>
            Le due password non coincidono.
          </p>
        )}

        {err && (
          <p data-testid="setpw-error"
             style={{
               fontFamily: 'Inter, sans-serif', fontSize: '0.85rem',
               color: tokens.danger,
               margin: '1rem 0 0 0',
             }}>
            {err}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          data-testid="setpw-submit"
          className="btn-pill-teal"
          style={{
            marginTop: '1.4rem', width: '100%',
            padding: '0.95rem 1.4rem',
            fontSize: '0.72rem',
            opacity: canSubmit ? 1 : 0.4,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          {busy ? 'Salvataggio…' : 'Imposta password e prosegui'}
        </button>

        <p style={{
          marginTop: '1.1rem',
          fontFamily: 'Inter, sans-serif',
          fontSize: '0.72rem', color: tokens.fade3, lineHeight: 1.55,
        }}>
          Questa password sostituisce il magic-link come canale principale.
          Resta valida l'opzione di accesso via link in caso di smarrimento.
        </p>
      </form>
    </div>
  );
};

const inputStyle = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: `1px solid ${tokens.hairBold}`,
  borderRadius: 6,
  padding: '0.85rem 5.5rem 0.85rem 0.95rem',
  color: tokens.ink, fontSize: '0.95rem', outline: 'none',
  fontFamily: 'Inter, sans-serif',
  transition: 'border-color 160ms ease',
};

const labelStyle = {
  display: 'block',
  fontFamily: 'Montserrat, sans-serif',
  fontSize: '0.62rem', letterSpacing: '0.22em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.55)',
  marginBottom: 8,
};

const eyeBtnStyle = {
  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
  background: 'transparent', border: `1px solid ${tokens.hair}`,
  color: tokens.fade2, fontSize: '0.68rem', letterSpacing: '0.14em',
  textTransform: 'uppercase', padding: '0.35rem 0.7rem', borderRadius: 999,
  fontFamily: 'Montserrat, sans-serif', cursor: 'pointer',
};

export default SetPasswordModal;
