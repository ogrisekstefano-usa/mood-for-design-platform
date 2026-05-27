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

// Policy: ≥ 8 caratteri · maiuscola · numero · carattere speciale.
// L'alfanumerico è implicito (lettere + numeri).
const _rulesOf = (pw) => ({
  len:     (pw || '').length >= 8,
  upper:   /[A-Z]/.test(pw || ''),
  digit:   /\d/.test(pw || ''),
  special: /[^A-Za-z0-9]/.test(pw || ''),
});

const _scorePassword = (pw) => {
  const r = _rulesOf(pw);
  return [r.len, r.upper, r.digit, r.special].filter(Boolean).length;
};

const _strengthMeta = (score) => {
  if (score <= 1) return { label: 'Debole',     tone: 'weak',   fill: 25  };
  if (score === 2) return { label: 'Incompleta', tone: 'fair',   fill: 50  };
  if (score === 3) return { label: 'Quasi',      tone: 'good',   fill: 75  };
  return            { label: 'Conforme',    tone: 'strong', fill: 100 };
};

const CreatePasswordPanel = ({ onClose }) => {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const score = useMemo(() => _scorePassword(pw), [pw]);
  const meta  = useMemo(() => _strengthMeta(score), [score]);
  const rules = useMemo(() => _rulesOf(pw), [pw]);
  const policyOk = rules.len && rules.upper && rules.digit && rules.special;
  const matches = pw2.length > 0 && pw === pw2;
  const canSubmit = policyOk && matches && !busy;

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!policyOk) {
      toast.error('La password deve contenere maiuscola, numero e carattere speciale (min 8).');
      return;
    }
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

              {/* Complexity meter + 4 rules checklist */}
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
                  <span className="cw-pw-meter__policy"
                        data-testid="client-create-password-policy">
                    8 caratteri · maiuscola · numero · simbolo
                  </span>
                  {pw.length > 0 && (
                    <span className="cw-pw-meter__label"
                          data-testid="client-create-password-strength">
                      {meta.label}
                    </span>
                  )}
                </div>
                <ul className="cw-pw-rules" data-testid="client-create-password-rules">
                  <li className={rules.len ? 'is-ok' : ''}
                      data-testid="client-create-password-rule-len"
                      data-ok={rules.len ? '1' : '0'}>
                    {rules.len ? <Check size={11} strokeWidth={2}/>
                               : <AlertCircle size={11} strokeWidth={2}/>}
                    Almeno 8 caratteri
                  </li>
                  <li className={rules.upper ? 'is-ok' : ''}
                      data-testid="client-create-password-rule-upper"
                      data-ok={rules.upper ? '1' : '0'}>
                    {rules.upper ? <Check size={11} strokeWidth={2}/>
                                 : <AlertCircle size={11} strokeWidth={2}/>}
                    Una maiuscola (A–Z)
                  </li>
                  <li className={rules.digit ? 'is-ok' : ''}
                      data-testid="client-create-password-rule-digit"
                      data-ok={rules.digit ? '1' : '0'}>
                    {rules.digit ? <Check size={11} strokeWidth={2}/>
                                 : <AlertCircle size={11} strokeWidth={2}/>}
                    Un numero (0–9)
                  </li>
                  <li className={rules.special ? 'is-ok' : ''}
                      data-testid="client-create-password-rule-special"
                      data-ok={rules.special ? '1' : '0'}>
                    {rules.special ? <Check size={11} strokeWidth={2}/>
                                   : <AlertCircle size={11} strokeWidth={2}/>}
                    Un carattere speciale (! ? # …)
                  </li>
                </ul>
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
