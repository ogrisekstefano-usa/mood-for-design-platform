/**
 * CreatePasswordPanel · ITER161 · P0.2
 *
 * Card discreta dentro il Client Profile: "Crea password (opzionale)".
 * Il cliente sta GIÀ DENTRO via session; gli permettiamo di settare una
 * password per non dover sempre passare dal magic link. Mai imposto.
 */
import React, { useState } from 'react';
import { X } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import './clientWelcome.css';

const SUPABASE_URL  = process.env.REACT_APP_SUPABASE_URL || '';
const SUPABASE_ANON = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
const STORAGE_KEY   = 'mfd_session';

const CreatePasswordPanel = ({ onClose }) => {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e?.preventDefault?.();
    if (pw.length < 8) {
      toast.error('Almeno 8 caratteri.');
      return;
    }
    if (pw !== pw2) {
      toast.error('Le password non coincidono.');
      return;
    }
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
            <div className="cw-field">
              <p className="cw-microlabel">Nuova password</p>
              <input
                type="password"
                className="cw-input"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                minLength={8}
                required
                data-testid="client-create-password-input"
              />
            </div>
            <div className="cw-field">
              <p className="cw-microlabel">Conferma</p>
              <input
                type="password"
                className="cw-input"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                minLength={8}
                required
                data-testid="client-create-password-confirm"
              />
            </div>
            <div className="cw-actions">
              <button type="button" className="cw-btn cw-btn--ghost"
                      onClick={onClose}
                      data-testid="client-create-password-cancel">
                Annulla
              </button>
              <button type="submit" className="cw-btn cw-btn--primary"
                      disabled={busy}
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
