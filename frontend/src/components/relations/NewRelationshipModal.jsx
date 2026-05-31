/**
 * NewRelationshipModal — ITER177.B · CRM Phase 1
 *
 * Canonical 3-way entry point per creare una relazione professionale.
 *   A · Nuovo Lead       → POST /api/leads (+ apri Discovery)
 *   B · Prospect esistente → POST /api/accounts/{aid}/journeys
 *   C · Cliente esistente → POST /api/accounts/{aid}/journeys
 *
 * Sostituisce ogni vecchia CTA "Nuova Journey" diretta.
 */
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { X, UserPlus, Search, Briefcase, AlertCircle } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const auth = () => {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

export default function NewRelationshipModal({ open, onClose, onCreated, prefill }) {
  const navigate = useNavigate();
  const [choice, setChoice] = useState(null); // 'lead' | 'prospect' | 'customer'
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setChoice(null);
      setBusy(false);
    } else if (prefill?.choice) {
      // Auto-pick the right choice when launched from Cmd+K with prefill
      setChoice(prefill.choice);
    }
  }, [open, prefill]);

  if (!open) return null;

  return (
    <div
      className="nr-modal__overlay"
      data-testid="new-relationship-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(12, 14, 18, 0.72)',
        backdropFilter: 'blur(8px)', zIndex: 999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        data-testid="new-relationship-modal"
        style={{
          background: '#ffffff', borderRadius: 12, maxWidth: 560, width: '100%',
          maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
          padding: '32px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.15em', color: '#7a7d83', textTransform: 'uppercase', marginBottom: 4 }}>
              CRM · Nuova Relazione
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 600, margin: 0, color: '#0c0e12' }}>
              Da dove vuoi iniziare?
            </h2>
          </div>
          <button
            data-testid="new-relationship-close"
            onClick={onClose}
            aria-label="Chiudi"
            style={{ background: 'transparent', border: 0, cursor: 'pointer', color: '#7a7d83', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        {!choice && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <ChoiceCard
              testid="new-relationship-choice-lead"
              icon={<UserPlus size={22} strokeWidth={1.5} />}
              title="Nuovo Lead"
              desc="Un contatto da qualificare. Aprirà una Discovery."
              onClick={() => setChoice('lead')}
            />
            <ChoiceCard
              testid="new-relationship-choice-prospect"
              icon={<Search size={22} strokeWidth={1.5} />}
              title="Prospect esistente"
              desc="Apri una nuova Design Journey per un contatto già qualificato."
              onClick={() => setChoice('prospect')}
            />
            <ChoiceCard
              testid="new-relationship-choice-customer"
              icon={<Briefcase size={22} strokeWidth={1.5} />}
              title="Cliente esistente"
              desc="Apri una nuova Design Journey per un cliente confermato."
              onClick={() => setChoice('customer')}
            />
          </div>
        )}

        {choice === 'lead' && (
          <NewLeadForm
            prefill={prefill}
            onCancel={() => setChoice(null)}
            onCreated={(payload) => {
              onClose?.();
              onCreated?.(payload);
              if (payload?.lead?.id) {
                navigate(`/relations/leads/${payload.lead.id}?discovery=1`);
              } else {
                navigate('/relations/leads');
              }
            }}
            busy={busy}
            setBusy={setBusy}
          />
        )}

        {choice === 'prospect' && (
          <SelectAccountForm
            stage="prospect"
            label="Cerca un Prospect"
            onCancel={() => setChoice(null)}
            onCreated={(payload) => {
              onClose?.();
              onCreated?.(payload);
              if (payload?.journey_id) navigate(`/workspace/journey/${payload.journey_id}`);
            }}
            busy={busy}
            setBusy={setBusy}
          />
        )}

        {choice === 'customer' && (
          <SelectAccountForm
            stage="customer"
            label="Cerca un Cliente"
            onCancel={() => setChoice(null)}
            onCreated={(payload) => {
              onClose?.();
              onCreated?.(payload);
              if (payload?.journey_id) navigate(`/workspace/journey/${payload.journey_id}`);
            }}
            busy={busy}
            setBusy={setBusy}
          />
        )}
      </div>
    </div>
  );
}

function ChoiceCard({ icon, title, desc, onClick, testid }) {
  return (
    <button
      data-testid={testid}
      onClick={onClick}
      style={{
        textAlign: 'left', background: '#fafafa', border: '1px solid #e6e6e8',
        borderRadius: 10, padding: '16px 18px', cursor: 'pointer',
        display: 'flex', gap: 14, alignItems: 'flex-start',
        transition: 'all 0.16s ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f1f3'; e.currentTarget.style.borderColor = '#0c0e12'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '#fafafa'; e.currentTarget.style.borderColor = '#e6e6e8'; }}
    >
      <div style={{ color: '#0c0e12', flexShrink: 0, paddingTop: 2 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#0c0e12', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 13, color: '#5a5d63', lineHeight: 1.45 }}>{desc}</div>
      </div>
    </button>
  );
}

function NewLeadForm({ onCancel, onCreated, busy, setBusy, prefill }) {
  // Parse prefill query "Mario Rossi" → first_name="Mario", last_name="Rossi"
  const parsedFirst = useMemo(() => {
    if (!prefill) return '';
    if (prefill.first_name) return prefill.first_name;
    if (prefill.query && !prefill.query.includes('@')) {
      const parts = prefill.query.trim().split(/\s+/);
      return parts[0] || '';
    }
    return '';
  }, [prefill]);
  const parsedLast = useMemo(() => {
    if (!prefill) return '';
    if (prefill.last_name) return prefill.last_name;
    if (prefill.query && !prefill.query.includes('@')) {
      const parts = prefill.query.trim().split(/\s+/);
      return parts.slice(1).join(' ') || '';
    }
    return '';
  }, [prefill]);
  const parsedEmail = useMemo(() => {
    if (prefill?.email) return prefill.email;
    if (prefill?.query && prefill.query.includes('@')) return prefill.query.trim();
    return '';
  }, [prefill]);

  const [firstName, setFirstName] = useState(parsedFirst);
  const [lastName, setLastName] = useState(parsedLast);
  const [email, setEmail] = useState(parsedEmail);
  const [phone, setPhone] = useState(prefill?.phone || '');
  const [matches, setMatches] = useState([]);
  const [checkedDedup, setCheckedDedup] = useState(false);

  const canSubmit = useMemo(
    () => firstName.trim().length > 0 && (email.trim() || phone.trim()),
    [firstName, email, phone]
  );

  const runDedup = async () => {
    if (!email && !phone && !firstName) return;
    try {
      const r = await axios.post(
        `${API}/api/leads/dedup-check`,
        { email, phone, first_name: firstName },
        { headers: { ...auth(), 'Content-Type': 'application/json' } }
      );
      setMatches(r.data?.matches || []);
      setCheckedDedup(true);
    } catch (e) {
      console.warn('dedup-check failed', e);
    }
  };

  const submit = async (force = false) => {
    if (!canSubmit || busy) return;
    if (!force && !checkedDedup) {
      await runDedup();
      // If matches found, halt and show warning. User clicks again with force=true.
      if (matches.length > 0) return;
    }
    setBusy(true);
    try {
      const lead = await axios.post(
        `${API}/api/leads`,
        {
          first_name: firstName.trim(),
          last_name: lastName.trim() || null,
          email: email.trim().toLowerCase() || null,
          phone: phone.trim() || null,
          source: 'manual_showroom',
          status: 'new',
        },
        { headers: { ...auth(), 'Content-Type': 'application/json' } }
      );
      // Open discovery
      const discovery = await axios.post(
        `${API}/api/leads/${lead.data.id}/discovery`,
        { notes: null },
        { headers: { ...auth(), 'Content-Type': 'application/json' } }
      );
      toast.success('Lead creato. Avvia la Discovery.');
      onCreated?.({ lead: lead.data, discovery: discovery.data });
    } catch (e) {
      toast.error(e?.response?.data?.detail?.message || 'Errore creazione Lead');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="new-relationship-lead-form">
      <FormField label="Nome*">
        <input
          data-testid="nr-lead-first-name"
          value={firstName}
          onChange={(e) => { setFirstName(e.target.value); setCheckedDedup(false); }}
          placeholder="es. Stefano"
          style={inputStyle}
        />
      </FormField>
      <FormField label="Cognome">
        <input
          data-testid="nr-lead-last-name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="es. Rossi"
          style={inputStyle}
        />
      </FormField>
      <FormField label="Email">
        <input
          data-testid="nr-lead-email"
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setCheckedDedup(false); }}
          onBlur={runDedup}
          placeholder="es. stefano@studio.it"
          style={inputStyle}
        />
      </FormField>
      <FormField label="Telefono">
        <input
          data-testid="nr-lead-phone"
          value={phone}
          onChange={(e) => { setPhone(e.target.value); setCheckedDedup(false); }}
          onBlur={runDedup}
          placeholder="+39 ..."
          style={inputStyle}
        />
      </FormField>

      {matches.length > 0 && (
        <div
          data-testid="new-relationship-dedup-warning"
          style={{
            background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 8,
            padding: 14, marginTop: 12, display: 'flex', gap: 10, alignItems: 'flex-start',
          }}
        >
          <AlertCircle size={18} color="#92400e" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13, color: '#78350f' }}>
            <strong>Forse hai già parlato con loro:</strong>
            <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
              {matches.slice(0, 3).map((m) => (
                <li key={m.type + m.id} style={{ marginBottom: 2 }}>
                  {m.display || '(senza nome)'} <em style={{ opacity: 0.7 }}>({m.type} · {m.reasons.join(', ')})</em>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 8, fontSize: 12 }}>
              Premi <strong>Crea comunque</strong> per procedere lo stesso.
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
        <button onClick={onCancel} data-testid="nr-lead-cancel" style={btnSecondary}>Indietro</button>
        <button
          data-testid="new-relationship-submit"
          onClick={() => submit(matches.length > 0)}
          disabled={!canSubmit || busy}
          style={{ ...btnPrimary, opacity: !canSubmit || busy ? 0.5 : 1 }}
        >
          {busy ? 'Creo…' : matches.length > 0 ? 'Crea comunque' : 'Crea Lead + apri Discovery'}
        </button>
      </div>
    </div>
  );
}

function SelectAccountForm({ stage, label, onCancel, onCreated, busy, setBusy }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [picked, setPicked] = useState(null);

  useEffect(() => {
    let cancel = false;
    if (q.trim().length < 2) { setResults([]); return; }
    (async () => {
      try {
        const r = await axios.get(
          `${API}/api/relations/accounts`,
          { params: { q, lifecycle_stage: stage, limit: 8 }, headers: auth() }
        );
        if (!cancel) setResults(r.data?.data || r.data || []);
      } catch (e) {
        if (!cancel) setResults([]);
      }
    })();
    return () => { cancel = true; };
  }, [q, stage]);

  const submit = async (force = false) => {
    if (!picked || busy) return;
    setBusy(true);
    try {
      const r = await axios.post(
        `${API}/api/accounts/${picked.id}/journeys${force ? '?force=true' : ''}`,
        { kickoff_note: null },
        { headers: { ...auth(), 'Content-Type': 'application/json' } }
      );
      toast.success('Design Journey aperta.');
      onCreated?.(r.data);
    } catch (e) {
      const detail = e?.response?.data?.detail;
      if (detail?.code === 'JOURNEY-ALREADY-ACTIVE') {
        const conf = window.confirm(
          `${detail.message}\n\nVuoi forzare l'apertura di una seconda Journey?`
        );
        if (conf) return submit(true);
      } else {
        toast.error(detail?.message || 'Errore creazione Journey');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid={`new-relationship-${stage}-form`}>
      <FormField label={label}>
        <input
          data-testid={`nr-${stage}-search`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cerca per nome o email…"
          autoFocus
          style={inputStyle}
        />
      </FormField>
      {results.length > 0 && (
        <div style={{ border: '1px solid #e6e6e8', borderRadius: 8, marginTop: 8, maxHeight: 240, overflowY: 'auto' }}>
          {results.map((a) => (
            <button
              key={a.id}
              data-testid={`nr-${stage}-result-${a.id}`}
              onClick={() => setPicked(a)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 14px',
                background: picked?.id === a.id ? '#0c0e12' : '#ffffff',
                color: picked?.id === a.id ? '#ffffff' : '#0c0e12',
                border: 0, borderBottom: '1px solid #f1f1f3', cursor: 'pointer',
                fontSize: 14,
              }}
            >
              <div style={{ fontWeight: 500 }}>{a.account_name || a.display_name || a.email}</div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{a.email || '—'}</div>
            </button>
          ))}
        </div>
      )}
      {q.trim().length >= 2 && results.length === 0 && (
        <div style={{ fontSize: 13, color: '#7a7d83', marginTop: 10 }}>Nessun risultato.</div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
        <button onClick={onCancel} style={btnSecondary}>Indietro</button>
        <button
          data-testid="new-relationship-open-journey"
          onClick={() => submit(false)}
          disabled={!picked || busy}
          style={{ ...btnPrimary, opacity: !picked || busy ? 0.5 : 1 }}
        >
          {busy ? 'Apro…' : 'Apri Design Journey'}
        </button>
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 12, color: '#5a5d63', marginBottom: 4 }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle = {
  width: '100%', padding: '10px 12px', fontSize: 14, color: '#0c0e12',
  border: '1px solid #e6e6e8', borderRadius: 8, outline: 'none', background: '#ffffff',
};

const btnPrimary = {
  padding: '10px 18px', fontSize: 14, fontWeight: 500, color: '#ffffff',
  background: '#0c0e12', border: 0, borderRadius: 8, cursor: 'pointer',
};

const btnSecondary = {
  padding: '10px 18px', fontSize: 14, fontWeight: 500, color: '#0c0e12',
  background: '#ffffff', border: '1px solid #e6e6e8', borderRadius: 8, cursor: 'pointer',
};
