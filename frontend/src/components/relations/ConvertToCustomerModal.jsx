/**
 * ConvertToCustomerModal — ITER185 · Phase 1
 *
 * Manual conversion Prospect → Customer with optional proposal_id reference
 * and admin override. Mandatory audit trail (funnel_events backend).
 *
 * Props:
 *   - open: boolean
 *   - account: { id, account_name, lifecycle_stage }
 *   - onClose: () => void
 *   - onConverted: (account) => void
 */
import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, CheckCircle2 } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const auth = () => {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

export default function ConvertToCustomerModal({ open, account, onClose, onConverted }) {
  const [proposalId, setProposalId]   = useState('');
  const [signedAt, setSignedAt]       = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes]             = useState('');
  const [adminOverride, setAdmin]     = useState(false);
  const [busy, setBusy]               = useState(false);

  if (!open || !account) return null;

  const canSubmit = (proposalId.trim().length > 0 || adminOverride) && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const r = await axios.post(
        `${API}/api/accounts/${account.id}/convert-to-customer`,
        {
          proposal_id:    proposalId.trim() || null,
          signed_at:      signedAt || null,
          notes:          notes.trim() || null,
          admin_override: adminOverride,
        },
        { headers: { ...auth(), 'Content-Type': 'application/json' } }
      );
      toast.success(`${account.account_name} è ora Customer.`);
      onConverted?.(r.data.account);
      onClose?.();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      toast.error(detail?.message || 'Errore conversione cliente');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="convert-to-customer-modal"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(12, 14, 18, 0.72)',
        backdropFilter: 'blur(8px)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          background: '#ffffff', borderRadius: 14, width: '100%', maxWidth: 520,
          padding: 28, position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          data-testid="ctc-close"
          style={{
            position: 'absolute', top: 14, right: 14, border: 0, background: 'transparent',
            cursor: 'pointer', color: '#9b9da3',
          }}
        >
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <CheckCircle2 size={22} color="#0c6e3f" />
          <div>
            <p style={{ margin: 0, fontSize: 11, letterSpacing: '0.08em', color: '#9b9da3', textTransform: 'uppercase' }}>
              CRM · Conferma cliente
            </p>
            <h2 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 500, color: '#0c0e12' }}>
              {account.account_name}
            </h2>
          </div>
        </div>

        <p style={{ fontSize: 13, color: '#5a5d62', marginBottom: 18, lineHeight: 1.55 }}>
          Conferma il passaggio a Customer. La conversione è registrata nel log CRM con la proposta firmata.
        </p>

        <Field label="ID Proposta">
          <input
            data-testid="ctc-proposal-id"
            value={proposalId}
            onChange={(e) => setProposalId(e.target.value)}
            placeholder="uuid · es. b3a4e2…"
            style={inputStyle}
          />
        </Field>
        <Field label="Data firma">
          <input
            data-testid="ctc-signed-at"
            type="date"
            value={signedAt}
            onChange={(e) => setSignedAt(e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="Note">
          <textarea
            data-testid="ctc-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Opzionale · contesto firma"
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </Field>

        <label
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#5a5d62',
                   margin: '8px 0 18px', cursor: 'pointer' }}
        >
          <input
            type="checkbox"
            data-testid="ctc-admin-override"
            checked={adminOverride}
            onChange={(e) => setAdmin(e.target.checked)}
          />
          Admin override (procedi senza proposta verificata)
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={btnSecondary} data-testid="ctc-cancel">Annulla</button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            data-testid="ctc-submit"
            style={{ ...btnPrimary, opacity: canSubmit ? 1 : 0.5 }}
          >
            {busy ? 'Conferma…' : 'Conferma cliente'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 11, letterSpacing: '0.06em',
                      color: '#9b9da3', textTransform: 'uppercase', marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '10px 12px', border: '1px solid #d8dade', borderRadius: 8,
  fontSize: 14, color: '#0c0e12', background: '#ffffff', boxSizing: 'border-box',
  fontFamily: 'inherit',
};
const btnPrimary = {
  padding: '10px 20px', border: 0, borderRadius: 8, background: '#0c0e12', color: '#ffffff',
  fontSize: 13, fontWeight: 500, cursor: 'pointer',
};
const btnSecondary = {
  padding: '10px 20px', border: '1px solid #d8dade', borderRadius: 8, background: '#ffffff',
  color: '#3a3d44', fontSize: 13, cursor: 'pointer',
};
