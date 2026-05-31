/**
 * DiscoveryInterviewPanel — ITER177.B · CRM Phase 1
 *
 * Inline panel su LeadDetailPage. Promuove esplicitamente:
 *   pending → in_progress → qualified | unqualified | recycled
 * Side effect su qualify: crea/aggiorna account(lifecycle_stage='prospect')
 * e abilita l'apertura della Design Journey.
 */
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, RotateCw, Loader2, Sparkles } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;
const auth = () => {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const QUAL_FIELDS = [
  { key: 'budget',   label: 'Budget indicativo',  placeholder: 'es. 50-80k €' },
  { key: 'timing',   label: 'Tempistica target',  placeholder: 'es. consegna entro 6 mesi' },
  { key: 'style',    label: 'Stile / direzione',  placeholder: 'es. mediterraneo contemporaneo' },
  { key: 'rooms',    label: 'Ambito intervento',  placeholder: 'es. cucina + soggiorno' },
];

export default function DiscoveryInterviewPanel({ leadId, onAccountCreated }) {
  const [discovery, setDiscovery] = useState(null);
  const [signals, setSignals]   = useState({});
  const [notes, setNotes]       = useState('');
  const [busy, setBusy]         = useState(false);
  const [disqReason, setDisqReason] = useState('');

  // Initial load
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await axios.get(`${API}/api/leads/${leadId}/discovery`, { headers: auth() });
        if (cancel) return;
        if (r.data?.status === 'absent') {
          // auto-create pending
          const c = await axios.post(`${API}/api/leads/${leadId}/discovery`, {}, { headers: auth() });
          setDiscovery(c.data);
          setSignals(c.data?.qualification_signals || {});
          setNotes(c.data?.notes || '');
        } else {
          setDiscovery(r.data);
          setSignals(r.data?.qualification_signals || {});
          setNotes(r.data?.notes || '');
        }
      } catch (e) {
        toast.error('Discovery non disponibile');
      }
    })();
    return () => { cancel = true; };
  }, [leadId]);

  const status = discovery?.status;
  const isLocked = ['qualified', 'unqualified', 'recycled'].includes(status);

  // Autosave on blur
  const persist = async () => {
    if (!discovery?.id || isLocked) return;
    try {
      const r = await axios.put(
        `${API}/api/discovery/${discovery.id}`,
        { notes, qualification_signals: signals },
        { headers: { ...auth(), 'Content-Type': 'application/json' } }
      );
      setDiscovery(r.data);
    } catch {}
  };

  const start = async () => {
    if (!discovery?.id || busy) return;
    setBusy(true);
    try {
      const r = await axios.post(`${API}/api/discovery/${discovery.id}/start`, {}, { headers: auth() });
      setDiscovery(r.data);
      toast.success('Discovery in corso');
    } catch (e) {
      toast.error('Impossibile aprire la Discovery');
    } finally {
      setBusy(false);
    }
  };

  const qualify = async () => {
    if (!discovery?.id || busy) return;
    setBusy(true);
    try {
      const r = await axios.post(
        `${API}/api/discovery/${discovery.id}/qualify`,
        { qualification_signals: signals, notes },
        { headers: { ...auth(), 'Content-Type': 'application/json' } }
      );
      setDiscovery(r.data);
      toast.success('Lead qualificato. Prospect creato.');
      if (r.data?.account_id) onAccountCreated?.(r.data.account_id);
    } catch (e) {
      toast.error(e?.response?.data?.detail?.message || 'Errore qualifica');
    } finally {
      setBusy(false);
    }
  };

  const disqualify = async () => {
    if (!discovery?.id || busy || !disqReason.trim()) return;
    setBusy(true);
    try {
      const r = await axios.post(
        `${API}/api/discovery/${discovery.id}/disqualify`,
        { reason: disqReason.trim(), notes },
        { headers: { ...auth(), 'Content-Type': 'application/json' } }
      );
      setDiscovery(r.data);
      toast('Lead disqualificato.');
    } catch (e) {
      toast.error('Errore disqualifica');
    } finally {
      setBusy(false);
    }
  };

  if (!discovery) {
    return (
      <div data-testid="discovery-panel-loading" style={{ padding: 20, color: '#7a7d83' }}>
        <Loader2 className="animate-spin" size={16} /> Caricamento Discovery…
      </div>
    );
  }

  return (
    <section
      data-testid="discovery-panel"
      data-discovery-status={status}
      style={{
        background: '#ffffff', border: '1px solid #e6e6e8', borderRadius: 12,
        padding: 24, marginTop: 16,
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7a7d83' }}>
            Discovery Interview
          </div>
          <h3 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 600, color: '#0c0e12' }}>
            Qualifica il Lead
          </h3>
        </div>
        <StatusBadge status={status} />
      </header>

      {status === 'pending' && (
        <button
          data-testid="discovery-panel-start"
          onClick={start}
          disabled={busy}
          style={primaryBtn}
        >
          {busy ? 'Apro…' : 'Avvia Discovery'}
        </button>
      )}

      {!isLocked && status !== 'pending' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            {QUAL_FIELDS.map((f) => (
              <label key={f.key} style={{ fontSize: 12, color: '#5a5d63' }}>
                <span>{f.label}</span>
                <input
                  data-testid={`discovery-signal-${f.key}`}
                  value={signals[f.key] || ''}
                  onChange={(e) => setSignals({ ...signals, [f.key]: e.target.value })}
                  onBlur={persist}
                  placeholder={f.placeholder}
                  style={{ ...inputStyle, marginTop: 4 }}
                />
              </label>
            ))}
          </div>
          <label style={{ display: 'block', fontSize: 12, color: '#5a5d63' }}>
            <span>Note Discovery</span>
            <textarea
              data-testid="discovery-panel-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={persist}
              rows={4}
              placeholder="Annotazioni dalla conversazione con il cliente"
              style={{ ...inputStyle, marginTop: 4, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </label>

          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <button
              data-testid="discovery-panel-qualify"
              onClick={qualify}
              disabled={busy}
              style={{ ...primaryBtn, background: '#16a34a' }}
            >
              <CheckCircle2 size={16} style={{ marginRight: 6, verticalAlign: '-3px' }} />
              {busy ? 'Promuovo…' : 'Promuovi a Prospect'}
            </button>
            <details style={{ display: 'inline-block' }}>
              <summary
                data-testid="discovery-panel-disqualify-toggle"
                style={{ ...secondaryBtn, color: '#dc2626', borderColor: '#fecaca' }}
              >
                Disqualifica
              </summary>
              <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  data-testid="discovery-panel-disqualify-reason"
                  value={disqReason}
                  onChange={(e) => setDisqReason(e.target.value)}
                  placeholder="Motivo (es. fuori budget, fuori area)"
                  style={inputStyle}
                />
                <button
                  data-testid="discovery-panel-disqualify-confirm"
                  onClick={disqualify}
                  disabled={busy || !disqReason.trim()}
                  style={{ ...primaryBtn, background: '#dc2626', opacity: disqReason.trim() ? 1 : 0.5 }}
                >
                  Conferma
                </button>
              </div>
            </details>
          </div>
        </>
      )}

      {isLocked && (
        <div
          data-testid="discovery-panel-locked"
          style={{ padding: 14, background: '#f1f5f9', borderRadius: 8, color: '#0c0e12', fontSize: 13 }}
        >
          <strong>Discovery {status === 'qualified' ? 'qualificata' : status === 'unqualified' ? 'disqualificata' : 'riciclata'}.</strong>
          {discovery.disqualification_reason && (
            <div style={{ marginTop: 4, color: '#5a5d63' }}>Motivo: {discovery.disqualification_reason}</div>
          )}
        </div>
      )}
    </section>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending:     { bg: '#f1f5f9', fg: '#475569', text: 'In attesa' },
    in_progress: { bg: '#fef3c7', fg: '#92400e', text: 'In corso' },
    qualified:   { bg: '#dcfce7', fg: '#15803d', text: 'Qualificato' },
    unqualified: { bg: '#fee2e2', fg: '#b91c1c', text: 'Disqualificato' },
    recycled:    { bg: '#e0e7ff', fg: '#4338ca', text: 'Riciclato' },
  };
  const s = map[status] || map.pending;
  return (
    <span
      data-testid="discovery-status-badge"
      style={{
        background: s.bg, color: s.fg, padding: '4px 10px', borderRadius: 999,
        fontSize: 11, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase',
      }}
    >{s.text}</span>
  );
}

const inputStyle = {
  width: '100%', padding: '8px 10px', fontSize: 13, color: '#0c0e12',
  border: '1px solid #e6e6e8', borderRadius: 6, outline: 'none', background: '#ffffff',
};

const primaryBtn = {
  padding: '9px 16px', fontSize: 13, fontWeight: 500, color: '#ffffff',
  background: '#0c0e12', border: 0, borderRadius: 8, cursor: 'pointer',
};

const secondaryBtn = {
  padding: '9px 16px', fontSize: 13, fontWeight: 500, color: '#0c0e12',
  background: '#ffffff', border: '1px solid #e6e6e8', borderRadius: 8, cursor: 'pointer',
  display: 'inline-block', listStyle: 'none',
};
