/**
 * NewRelationshipModal — ITER177.B · CRM Phase 1
 * MOOD Atelier styling pass · estetica condivisa con il Create Modal.
 *
 * 3-way entry point per creare una relazione professionale.
 *   A · Nuovo Lead       → POST /api/leads/fast-capture
 *   B · Prospect esistente → POST /api/accounts/{aid}/journeys
 *   C · Cliente esistente → POST /api/accounts/{aid}/journeys
 */
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { UserPlus, Search, Briefcase, AlertCircle } from 'lucide-react';

import {
  AtelierModal,
  AtelierFooter,
  AtelierField,
  AtelierInput,
  AtelierButton,
  AtelierChip,
  AtelierCard,
} from '../atelier/AtelierModal';
import { getAuthHeader as auth } from '../../lib/authHeader';

const API = process.env.REACT_APP_BACKEND_URL;

const SOURCE_OPTIONS = [
  { key: 'showroom',  label: 'Showroom' },
  { key: 'phone',     label: 'Telefono' },
  { key: 'email',     label: 'Email' },
  { key: 'website',   label: 'Sito web' },
  { key: 'referral',  label: 'Referral' },
  { key: 'architect', label: 'Architetto' },
  { key: 'event',     label: 'Evento' },
  { key: 'import',    label: 'Import' },
  { key: 'other',     label: 'Altro' },
];

export default function NewRelationshipModal({ open, onClose, onCreated, prefill }) {
  const navigate = useNavigate();
  const [choice, setChoice] = useState(null); // 'lead' | 'prospect' | 'customer'
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setChoice(null);
      setBusy(false);
    } else if (prefill?.choice) {
      setChoice(prefill.choice);
    }
  }, [open, prefill]);

  const eyebrow =
    choice === 'lead'     ? 'CRM · Nuovo Lead' :
    choice === 'prospect' ? 'CRM · Nuova Design Journey' :
    choice === 'customer' ? 'CRM · Nuova Design Journey' :
    'CRM · Nuova Relazione';

  const title =
    choice === 'lead'     ? 'Aggiungi un nuovo lead' :
    choice === 'prospect' ? 'Apri una nuova Journey' :
    choice === 'customer' ? 'Apri una nuova Journey' :
    'Da dove vuoi iniziare?';

  const subtitle =
    !choice
      ? "Scegli il punto di partenza della relazione. Ogni percorso apre il workspace giusto."
      : null;

  return (
    <AtelierModal
      open={open}
      onClose={onClose}
      eyebrow={eyebrow}
      title={title}
      subtitle={subtitle}
      maxWidth={620}
      testid="new-relationship-modal"
    >
      {!choice && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <AtelierCard
            index={1}
            icon={<UserPlus size={20} strokeWidth={1.5} />}
            title="Nuovo Lead"
            desc="Un contatto da qualificare. Aprirà una Discovery."
            accent="var(--accent-secondary, #c9a875)"
            onClick={() => setChoice('lead')}
            testid="new-relationship-choice-lead"
          />
          <AtelierCard
            index={2}
            icon={<Search size={20} strokeWidth={1.5} />}
            title="Prospect esistente"
            desc="Apri una nuova Design Journey per un contatto già qualificato."
            accent="var(--accent-primary, #5dd9c4)"
            onClick={() => setChoice('prospect')}
            testid="new-relationship-choice-prospect"
          />
          <AtelierCard
            index={3}
            icon={<Briefcase size={20} strokeWidth={1.5} />}
            title="Cliente esistente"
            desc="Apri una nuova Design Journey per un cliente confermato."
            accent="#a78bfa"
            onClick={() => setChoice('customer')}
            testid="new-relationship-choice-customer"
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

      {(choice === 'prospect' || choice === 'customer') && (
        <SelectAccountForm
          stage={choice}
          label={choice === 'prospect' ? 'Cerca un Prospect' : 'Cerca un Cliente'}
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
    </AtelierModal>
  );
}

/* ───────────────────────── Forms ───────────────────────── */

function NewLeadForm({ onCancel, onCreated, busy, setBusy, prefill }) {
  const parsedName = useMemo(() => {
    if (!prefill) return '';
    if (prefill.first_name || prefill.last_name) {
      return [prefill.first_name, prefill.last_name].filter(Boolean).join(' ');
    }
    if (prefill.query && !prefill.query.includes('@')) return prefill.query.trim();
    return '';
  }, [prefill]);
  const parsedEmail = useMemo(() => {
    if (prefill?.email) return prefill.email;
    if (prefill?.query && prefill.query.includes('@')) return prefill.query.trim();
    return '';
  }, [prefill]);

  const [name, setName] = useState(parsedName);
  const [email, setEmail] = useState(parsedEmail);
  const [phone, setPhone] = useState(prefill?.phone || '');
  const [source, setSource] = useState('');
  const [sourceDetail, setSourceDetail] = useState('');
  const [dedupMatches, setDedupMatches] = useState([]);

  const canSubmit = useMemo(() => {
    if (name.trim().length < 2) return false;
    if (!email.trim() && !phone.trim()) return false;
    if (!source) return false;
    if (source === 'other' && sourceDetail.trim().length < 3) return false;
    return true;
  }, [name, email, phone, source, sourceDetail]);

  const submit = async (skipDedup = false) => {
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      const r = await axios.post(
        `${API}/api/leads/fast-capture`,
        {
          name: name.trim(),
          email: email.trim().toLowerCase() || null,
          phone: phone.trim() || null,
          source,
          source_detail: source === 'other' ? sourceDetail.trim() : null,
          skip_dedup_check: skipDedup,
        },
        { headers: { ...auth(), 'Content-Type': 'application/json' } }
      );
      toast.success('Lead creato. Avvia la Discovery.');
      onCreated?.({ lead: r.data.lead, discovery: r.data.discovery });
    } catch (e) {
      const data = e?.response?.data;
      if (e?.response?.status === 409 && data?.code === 'LEAD-DEDUP-MATCH') {
        setDedupMatches(data.matches || []);
        toast.warning('Possibile duplicato. Conferma per creare comunque.');
      } else {
        toast.error(data?.detail?.message || data?.message || 'Errore creazione Lead');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="new-relationship-lead-form" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <AtelierField label="Nome" required>
        <AtelierInput
          data-testid="nr-lead-name"
          value={name}
          onChange={(e) => { setName(e.target.value); setDedupMatches([]); }}
          placeholder="es. Marco Rossi"
          autoFocus
        />
      </AtelierField>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <AtelierField label="Email" hint="Opzionale se hai il telefono">
          <AtelierInput
            data-testid="nr-lead-email"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setDedupMatches([]); }}
            placeholder="email@dominio.com"
          />
        </AtelierField>
        <AtelierField label="Telefono" hint="Opzionale se hai l'email">
          <AtelierInput
            data-testid="nr-lead-phone"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setDedupMatches([]); }}
            placeholder="+39…"
          />
        </AtelierField>
      </div>

      <AtelierField label="Origine" required>
        <div data-testid="nr-lead-source-picker" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SOURCE_OPTIONS.map((opt) => (
            <AtelierChip
              key={opt.key}
              active={source === opt.key}
              onClick={() => setSource(opt.key)}
              testid={`nr-source-${opt.key}`}
            >
              {opt.label}
            </AtelierChip>
          ))}
        </div>
      </AtelierField>

      {source === 'other' && (
        <AtelierField label="Specifica origine" required>
          <AtelierInput
            data-testid="nr-lead-source-detail"
            value={sourceDetail}
            onChange={(e) => setSourceDetail(e.target.value)}
            placeholder="es. LinkedIn DM, agenzia X, …"
          />
        </AtelierField>
      )}

      {dedupMatches.length > 0 && (
        <div
          data-testid="new-relationship-dedup-warning"
          style={{
            background: 'color-mix(in srgb, #E0A872 12%, transparent)',
            border: '1px solid color-mix(in srgb, #E0A872 35%, transparent)',
            borderRadius: 10,
            padding: 14,
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
          }}
        >
          <AlertCircle size={18} color="#E0A872" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13, color: 'var(--bp-text, #f5f2ed)' }}>
            <strong>Forse hai già parlato con loro:</strong>
            <ul style={{ margin: '6px 0 0 16px', padding: 0, opacity: 0.85 }}>
              {dedupMatches.slice(0, 3).map((m) => (
                <li key={m.id} style={{ marginBottom: 2 }}>
                  {m.first_name || ''} {m.last_name || ''}
                  <em style={{ opacity: 0.7 }}> · {m.email || m.phone}</em>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
              Premi <strong>Crea comunque</strong> per procedere.
            </div>
          </div>
        </div>
      )}

      <AtelierFooter>
        <AtelierButton variant="ghost" onClick={onCancel} testid="nr-lead-cancel">
          Indietro
        </AtelierButton>
        <AtelierButton
          onClick={() => submit(dedupMatches.length > 0)}
          disabled={!canSubmit || busy}
          loading={busy}
          testid="new-relationship-submit"
        >
          {busy ? 'Creo…' : dedupMatches.length > 0 ? 'Crea comunque' : 'Crea Lead'}
        </AtelierButton>
      </AtelierFooter>
    </div>
  );
}

function SelectAccountForm({ stage, label, onCancel, onCreated, busy, setBusy }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [picked, setPicked] = useState(null);

  useEffect(() => {
    let cancel = false;
    if (q.trim().length < 2) { setResults([]); return undefined; }
    (async () => {
      try {
        const r = await axios.get(
          `${API}/api/relations/accounts`,
          { params: { q, lifecycle_stage: stage, limit: 8 }, headers: auth() }
        );
        if (!cancel) setResults(r.data?.data || r.data || []);
      } catch {
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
        const conf = window.confirm(`${detail.message}\n\nVuoi forzare l'apertura di una seconda Journey?`);
        if (conf) return submit(true);
      } else {
        toast.error(detail?.message || 'Errore creazione Journey');
      }
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <div data-testid={`new-relationship-${stage}-form`} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <AtelierField label={label}>
        <AtelierInput
          data-testid={`nr-${stage}-search`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cerca per nome o email…"
          autoFocus
        />
      </AtelierField>
      {results.length > 0 && (
        <div
          style={{
            border: '1px solid color-mix(in srgb, var(--bp-text, #f5f2ed) 10%, transparent)',
            borderRadius: 10,
            maxHeight: 280,
            overflowY: 'auto',
            background: 'color-mix(in srgb, var(--bp-text, #f5f2ed) 2%, transparent)',
          }}
        >
          {results.map((a) => {
            const isPicked = picked?.id === a.id;
            return (
              <button
                key={a.id}
                type="button"
                data-testid={`nr-${stage}-result-${a.id}`}
                onClick={() => setPicked(a)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px 16px',
                  background: isPicked
                    ? 'color-mix(in srgb, var(--accent-primary, #5dd9c4) 14%, transparent)'
                    : 'transparent',
                  color: 'var(--bp-text, #f5f2ed)',
                  border: 0,
                  borderBottom: '1px solid color-mix(in srgb, var(--bp-text, #f5f2ed) 6%, transparent)',
                  cursor: 'pointer',
                  fontSize: 13,
                  transition: 'background 160ms ease',
                }}
              >
                <div style={{ fontWeight: 500 }}>{a.account_name || a.display_name || a.email}</div>
                <div style={{ fontSize: 11, opacity: 0.55, marginTop: 2 }}>{a.email || '—'}</div>
              </button>
            );
          })}
        </div>
      )}
      {q.trim().length >= 2 && results.length === 0 && (
        <div style={{ fontSize: 12, color: 'color-mix(in srgb, var(--bp-text, #f5f2ed) 45%, transparent)' }}>
          Nessun risultato.
        </div>
      )}
      <AtelierFooter>
        <AtelierButton variant="ghost" onClick={onCancel}>Indietro</AtelierButton>
        <AtelierButton
          onClick={() => submit(false)}
          disabled={!picked || busy}
          loading={busy}
          testid="new-relationship-open-journey"
        >
          {busy ? 'Apro…' : 'Apri Design Journey'}
        </AtelierButton>
      </AtelierFooter>
    </div>
  );
}
