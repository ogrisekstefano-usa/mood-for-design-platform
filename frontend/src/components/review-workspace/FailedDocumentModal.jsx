/**
 * KE-003 · P0-5 · Failed Document Modal
 *
 * Premium dark-glass modal shown when the user clicks "Review" on a
 * failed document. No blank pages — always communicates WHY the
 * extraction failed, WHEN, and offers a Retry + sibling document
 * shortcuts so the user is never stuck.
 */
import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import KE from '../../lib/knowledgeApi';
import './failed-document-modal.css';

function fmt(ts) {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return ts; }
}

export default function FailedDocumentModal({ ctx, setId, onClose, onRetryDone }) {
  const [busy, setBusy] = useState(false);
  if (!ctx) return null;

  const handleRetry = async () => {
    setBusy(true);
    try {
      await KE.retryDocument(setId, ctx.document_id);
      toast.success(`Retry avviato: ${ctx.name}`);
      onRetryDone?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Retry fallito');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="ke-fdm-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      data-testid="ke-failed-doc-modal-backdrop"
    >
      <div className="ke-fdm" data-testid="ke-failed-doc-modal">
        <header className="ke-fdm__head">
          <div className="ke-fdm__head-left">
            <span className="ke-fdm__chip">DOC ESTRAZIONE FALLITA</span>
            <h2 className="ke-fdm__title" title={ctx.name}>{ctx.name || 'Documento'}</h2>
          </div>
          <button
            className="ke-fdm__close"
            onClick={onClose}
            data-testid="ke-failed-doc-modal-close"
            aria-label="Chiudi"
          >
            <Icons.X size={16} />
          </button>
        </header>

        <section className="ke-fdm__error" data-testid="ke-failed-doc-error">
          <div className="ke-fdm__label">Motivo errore</div>
          <pre className="ke-fdm__error-msg">{ctx.error_message || 'Causa non specificata'}</pre>
          <div className="ke-fdm__meta">
            <span><Icons.Clock size={11} /> Fallito {fmt(ctx.failed_at)}</span>
            <span><Icons.Hash size={11} /> {ctx.document_id?.slice(0, 8) || '—'}</span>
          </div>
        </section>

        <section className="ke-fdm__actions">
          {ctx.retry_available && (
            <button
              className="ke-fdm__btn ke-fdm__btn--primary"
              onClick={handleRetry}
              disabled={busy}
              data-testid="ke-failed-doc-retry"
            >
              <Icons.RefreshCw size={12} /> {busy ? 'Avvio retry…' : 'Riprova estrazione'}
            </button>
          )}
          <button
            className="ke-fdm__btn"
            onClick={onClose}
            data-testid="ke-failed-doc-close-btn"
          >
            Chiudi
          </button>
        </section>

        {ctx.related_documents?.length > 0 && (
          <section className="ke-fdm__related" data-testid="ke-failed-doc-related">
            <div className="ke-fdm__label" style={{ marginBottom: 6 }}>
              Documenti correlati nello stesso catalog set
            </div>
            <ul className="ke-fdm__related-list">
              {ctx.related_documents.slice(0, 8).map((r) => (
                <li
                  key={r.id}
                  className={`ke-fdm__related-row ke-fdm__related-row--${r.status || 'pending'}`}
                  data-testid={`ke-failed-doc-related-${r.id}`}
                >
                  <span className="ke-fdm__related-name" title={r.name}>{r.name}</span>
                  <span className="ke-fdm__related-status">{r.status}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
