/**
 * AtelierPasswordPrompt · ITER162
 *
 * Card discreta floating bottom-right: "Crea password (opzionale)".
 * Riutilizza il modal CreatePasswordPanel esistente.
 */
import React, { useState } from 'react';
import { Gift, ChevronRight } from 'lucide-react';
import CreatePasswordPanel from '../../../components/client/CreatePasswordPanel';

const AtelierPasswordPrompt = () => {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('mfd_atelier_password_dismissed') === '1'; }
    catch (_) { return false; }
  });

  if (dismissed) return null;

  return (
    <>
      <aside className="atelier-pwprompt" data-testid="atelier-password-prompt">
        <button
          type="button"
          className="atelier-pwprompt__btn"
          onClick={() => setOpen(true)}
          data-testid="atelier-password-prompt-btn"
        >
          <span className="atelier-pwprompt__icon" aria-hidden>
            <Gift size={16} strokeWidth={1.5} />
          </span>
          <span className="atelier-pwprompt__body">
            <span className="atelier-pwprompt__title">Crea password (opzionale)</span>
            <span className="atelier-pwprompt__sub">
              Rendi più semplice il prossimo accesso.
            </span>
          </span>
          <ChevronRight size={16} strokeWidth={1.4} aria-hidden />
        </button>
        <button
          type="button"
          className="atelier-pwprompt__dismiss"
          aria-label="Nascondi"
          onClick={() => {
            try { localStorage.setItem('mfd_atelier_password_dismissed', '1'); } catch (_) {}
            setDismissed(true);
          }}
          data-testid="atelier-password-prompt-dismiss"
        >
          ×
        </button>
      </aside>
      {open && <CreatePasswordPanel onClose={() => setOpen(false)} />}
    </>
  );
};

export default AtelierPasswordPrompt;
