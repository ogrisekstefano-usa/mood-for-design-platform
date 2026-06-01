/**
 * RevertToProspectModal — ITER185 · Phase 1
 *
 * Customer → Prospect rollback with mandatory reason (audit trail).
 *
 * Props:
 *   - open: boolean
 *   - account: { id, account_name, lifecycle_stage }
 *   - onClose, onReverted
 */
import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, RotateCcw } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const auth = () => {
  try {
    const raw = localStorage.getItem('mfd_session');
    if (raw) {
      const s = JSON.parse(raw);
      if (s?.access_token) return { Authorization: `Bearer ${s.access_token}` };
    }
  } catch (_) {}
  const legacy = localStorage.getItem('token');
  return legacy ? { Authorization: `Bearer ${legacy}` } : {};
};

export default function RevertToProspectModal({ open, account, onClose, onReverted }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy]     = useState(false);

  if (!open || !account) return null;

  const canSubmit = reason.trim().length >= 10 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const r = await axios.post(
        `${API}/api/accounts/${account.id}/revert-to-prospect`,
        { reason: reason.trim() },
        { headers: { ...auth(), 'Content-Type': 'application/json' } }
      );
      toast.success(`${account.account_name} è tornato Prospect.`);
      onReverted?.(r.data.account);
      onClose?.();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      const msg = typeof detail === 'string'
        ? detail
        : detail?.message || (Array.isArray(detail) && detail[0]?.msg) || 'Errore rollback';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="revert-to-prospect-modal"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(12, 14, 18, 0.72)',
        backdropFilter: 'blur(8px)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        style={{
          background: '#ffffff', borderRadius: 14, width: '100%', maxWidth: 480,
          padding: 28, position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          data-testid="rtp-close"
          style={{
            position: 'absolute', top: 14, right: 14, border: 0, background: 'transparent',
            cursor: 'pointer', color: '#9b9da3',
          }}
        >
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <RotateCcw size={22} color="#b5680a" />
          <div>
            <p style={{ margin: 0, fontSize: 11, letterSpacing: '0.08em', color: '#9b9da3', textTransform: 'uppercase' }}>
              CRM · Rollback cliente
            </p>
            <h2 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 500, color: '#0c0e12' }}>
              {account.account_name}
            </h2>
          </div>
        </div>

        <p style={{ fontSize: 13, color: '#5a5d62', marginBottom: 18, lineHeight: 1.55 }}>
          Il customer torna a Prospect. L'azione è registrata nel log con la motivazione.
        </p>

        <label style={{ display: 'block', fontSize: 11, letterSpacing: '0.06em',
                        color: '#9b9da3', textTransform: 'uppercase', marginBottom: 4 }}>
          Motivazione* (min. 10 caratteri)
        </label>
        <textarea
          data-testid="rtp-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="es. Proposta annullata, cliente non firma"
          rows={4}
          style={{
            width: '100%', padding: '10px 12px', border: '1px solid #d8dade', borderRadius: 8,
            fontSize: 14, color: '#0c0e12', background: '#ffffff', boxSizing: 'border-box',
            fontFamily: 'inherit', resize: 'vertical',
          }}
        />
        <div style={{ fontSize: 11, color: '#9b9da3', marginTop: 4, marginBottom: 18 }}>
          {reason.trim().length}/10 minimo
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            data-testid="rtp-cancel"
            style={{
              padding: '10px 20px', border: '1px solid #d8dade', borderRadius: 8, background: '#ffffff',
              color: '#3a3d44', fontSize: 13, cursor: 'pointer',
            }}
          >
            Annulla
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            data-testid="rtp-submit"
            style={{
              padding: '10px 20px', border: 0, borderRadius: 8, background: '#b5680a', color: '#ffffff',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
              opacity: canSubmit ? 1 : 0.5,
            }}
          >
            {busy ? 'Rollback…' : 'Conferma rollback'}
          </button>
        </div>
      </div>
    </div>
  );
}
