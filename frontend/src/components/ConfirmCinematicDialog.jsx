/**
 * ConfirmCinematicDialog — conferma editoriale (NON browser alert).
 *
 * Usato per: delete brand, delete collection, azioni distruttive.
 * Linguaggio: italiano editoriale, mai "Are you sure?".
 */
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as Icons from 'lucide-react';
// brand-form.css is imported by the parent pages (BrandDetailPage,
// StudioCollectionsPage) so the .bf-* + .bm-* styles are available globally.

const ConfirmCinematicDialog = ({
  open,
  title = 'Confermi?',
  body,
  confirmLabel = 'Conferma',
  cancelLabel = 'Annulla',
  tone = 'destructive',  // 'destructive' | 'editorial'
  onConfirm,
  onClose,
  testid = 'cinematic-confirm',
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="bf-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="bf-confirm" data-testid={testid}>
        <div className="bf-confirm__icon">
          {tone === 'destructive'
            ? <Icons.AlertTriangle size={16} strokeWidth={1.4} />
            : <Icons.Info size={16} strokeWidth={1.4} />}
        </div>
        <p className="bf-eyebrow">{tone === 'destructive' ? 'Azione definitiva' : 'Conferma editoriale'}</p>
        <h2 className="bf-confirm__title">{title}</h2>
        {body && <p className="bf-confirm__body">{body}</p>}
        <div className="bf-confirm__actions">
          <button type="button" className="bf-btn-soft" onClick={onClose} data-testid={`${testid}-cancel`}>
            {cancelLabel}
          </button>
          <button type="button"
                  className={`bf-btn ${tone === 'destructive' ? 'bf-btn--danger' : ''}`}
                  onClick={() => { onConfirm?.(); }}
                  data-testid={`${testid}-confirm`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmCinematicDialog;
