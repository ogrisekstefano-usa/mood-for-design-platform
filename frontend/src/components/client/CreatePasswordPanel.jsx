/**
 * CreatePasswordPanel · ITER161 · P0.2 (rev2)
 *
 * Password opzionale dentro il Client Profile.
 *  + Eye toggle (mostra/nascondi)
 *  + Complexity meter (rosso/giallo/verde) — minimo 8 caratteri
 *  + Match check fra le due password
 */
import React, { useMemo, useState } from 'react';
import { X, Eye, EyeOff, Check, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import './clientWelcome.css';

const SUPABASE_URL  = process.env.REACT_APP_SUPABASE_URL || '';
const SUPABASE_ANON = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
const STORAGE_KEY   = 'mfd_session';

// Score 0-4 → red (0-1) / yellow (2) / green (3-4)
const _scorePassword = (pw) => {
  if (!pw || pw.length < 8) return 0;
  let score = 1;
  if (pw.length >= 12)               score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw))                 score++;
  if (/[^A-Za-z0-9]/.test(pw))       score++;
  return Math.min(4, score);
};

const _strengthMeta = (score) => {
  if (score <= 1) return { label: 'Debole',    tone: 'weak',    fill: 33 };
  if (score === 2) return { label: 'Decente',   tone: 'fair',    fill: 60 };
  if (score === 3) return { label: 'Solida',    tone: 'good',    fill: 80 };
  return            { label: 'Eccellente', tone: 'strong', fill: 100 };
};

const CreatePasswordPanel = ({ onClose }) => {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const score = useMemo(() => _scorePassword(pw), [pw]);
  const meta  = useMemo(() => _strengthMeta(score), [score]);
  const matches = pw2.length > 0 && pw === pw2;
  const minOk = pw.length >= 8;
  const canSubmit = minOk && matches && !busy;

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!minOk) { toast.error('Almeno 8 caratteri.'); return; }
    if (!matches) { toast.error('Le password non coincidono.'); return; }
    setBusy(true);
    try {
      let token = null;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        token = raw ? JSON.parse(raw)?.access_token : null;
      } catch (_) {}
      if (!token || !SUPABASE_URL || !SUPABASE_ANON) {
        toast.error('Sessione non disponibile.');
        setBusy(false);
        return;
      }
      await axios.put(`${SUPABASE_URL}/auth/v1/user`,
        { password: pw },
        { headers: {
            apikey: SUPABASE_ANON,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        }}
      );
      setDone(true);
    } catch (err) {
      toast.error(err?.response?.data?.msg || 'Non riusciamo ora. Riprova fra poco.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cw-modal-backdrop" onClick={onClose}
         data-testid="client-create-password-backdrop">
      <div className="cw-modal cw-modal--narrow" onClick={(e) => e.stopPropagation()}
           data-testid="client-create-password-modal">
        <button type="button" className="cw-close cw-close--modal"
                onClick={onClose} aria-label="Chiudi"
                data-testid="client-create-password-close">
          <X size={18} />
        </button>

        {!done ? (
          <form onSubmit={submit}>
            <p className="cw-eyebrow">Accesso futuro</p>
            <h2 className="cw-modal__title"><em>Crea la tua password.</em></h2>
            <p className="cw-modal__lede">
              Solo se vuoi. Potrai sempre rientrare anche con un magic link
              via email.
            </p>

            {/* Field 1 — password con eye */}
            <div className="cw-field">
              <p className="cw-microlabel">Nuova password</p>
              <div className="cw-pw-wrap">
                <input
                  type={show ? 'text' : 'password'}
                  className="cw-input cw-pw-input"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  minLength={8}
                  required
                  autoFocus
                  data-testid="client-create-password-input"
                  aria-describedby="cw-pw-meter"
                />
                <button
                  type="button"
                  className="cw-pw-eye"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? 'Nascondi password' : 'Mostra password'}
                  data-testid="client-create-password-eye"
                >
                  {show ? <EyeOff size={16} strokeWidth={1.5} />
                        : <Eye    size={16} strokeWidth={1.5} />}
                </button>
              </div>

              {/* Complexity meter */}
              <div
                id="cw-pw-meter"
                className={`cw-pw-meter cw-pw-meter--${meta.tone} ${pw.length === 0 ? 'is-empty' : ''}`}
                data-testid="client-create-password-meter"
                data-tone={meta.tone}
              >
                <div className="cw-pw-meter__track">
                  <div
                    className="cw-pw-meter__fill"
                    style={{ width: pw.length ? `${meta.fill}%` : '0%' }}
                  />
                </div>
                <div className="cw-pw-meter__row">
                  <span className={`cw-pw-meter__rule ${minOk ? 'is-ok' : ''}`}
                        data-testid="client-create-password-rule-min">
                    {minOk ? <Check size={11} strokeWidth={2}/>
                           : <AlertCircle size={11} strokeWidth={2}/>}
                    Almeno 8 caratteri
                  </span>
                  {pw.length > 0 && (
                    <span className="cw-pw-meter__label"
                          data-testid="client-create-password-strength">
                      {meta.label}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Field 2 — conferma con check */}
            <div className="cw-field">
              <p className="cw-microlabel">Conferma</p>
              <div className="cw-pw-wrap">
                <input
                  type={show ? 'text' : 'password'}
                  className={`cw-input cw-pw-input ${pw2 && !matches ? 'is-mismatch' : ''} ${pw2 && matches ? 'is-match' : ''}`}
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  minLength={8}
                  required
                  data-testid="client-create-password-confirm"
                />
                {pw2 && (
                  <span
                    className={`cw-pw-match ${matches ? 'is-match' : 'is-mismatch'}`}
                    data-testid="client-create-password-match"
                    data-state={matches ? 'match' : 'mismatch'}
                    aria-label={matches ? 'Le password coincidono' : 'Le password non coincidono'}
                  >
                    {matches ? <Check size={16} strokeWidth={2}/>
                             : <AlertCircle size={16} strokeWidth={1.8}/>}
                  </span>
                )}
              </div>
              {pw2.length > 0 && !matches && (
                <p className="cw-pw-hint cw-pw-hint--err"
                   data-testid="client-create-password-mismatch-hint">
                  Le due password non coincidono.
                </p>
              )}
              {pw2.length > 0 && matches && (
                <p className="cw-pw-hint cw-pw-hint--ok"
                   data-testid="client-create-password-match-hint">
                  Coincidono.
                </p>
              )}
            </div>

            <div className="cw-actions">
              <button type="button" className="cw-btn cw-btn--ghost"
                      onClick={onClose}
                      data-testid="client-create-password-cancel">
                Annulla
              </button>
              <button type="submit"
                      className="cw-btn cw-btn--primary"
                      disabled={!canSubmit}
                      data-testid="client-create-password-submit">
                {busy ? 'Salvo…' : 'Salva password'}
              </button>
            </div>
          </form>
        ) : (
          <div className="cw-modal__done" data-testid="client-create-password-done">
            <p className="cw-eyebrow">Salvata</p>
            <h2 className="cw-modal__title"><em>La prossima volta sarà più semplice.</em></h2>
            <p className="cw-modal__lede">Puoi continuare a usare anche il magic link.</p>
            <button type="button" className="cw-btn cw-btn--primary" onClick={onClose}>
              Torna allo spazio
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreatePasswordPanel;
