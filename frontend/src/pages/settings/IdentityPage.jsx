/**
 * IdentityPage — ITER180 · Step 0
 *
 * Form a 4 campi per "Identità Operativa": nome, mercato, lingua, timezone.
 */
import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowLeft } from 'lucide-react';
import { useActivationFoundation } from '../../hooks/useActivationFoundation';

const MARKETS = [
  { value: 'IT', label: 'Italia' },
  { value: 'EU', label: 'Europa' },
  { value: 'US', label: 'Stati Uniti' },
  { value: 'UK', label: 'Regno Unito' },
  { value: 'GLOBAL', label: 'Globale / multi-mercato' },
];

const LANGUAGES = [
  { value: 'it-IT', label: 'Italiano' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'fr-FR', label: 'Français' },
  { value: 'de-DE', label: 'Deutsch' },
  { value: 'es-ES', label: 'Español' },
];

const TIMEZONES = [
  'Europe/Rome', 'Europe/Paris', 'Europe/London', 'Europe/Berlin', 'Europe/Madrid',
  'America/New_York', 'America/Los_Angeles', 'America/Chicago',
  'Asia/Dubai', 'Asia/Tokyo', 'UTC',
];

export default function IdentityPage() {
  const navigate = useNavigate();
  const { data, refresh } = useActivationFoundation();
  const [name, setName] = useState('');
  const [primaryMarket, setPrimaryMarket] = useState('');
  const [language, setLanguage] = useState('');
  const [timezone, setTimezone] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) {
      const identity = data.items.find((i) => i.key === 'identity');
      const v = identity?.metadata?.values || {};
      setName(v.name || '');
      setPrimaryMarket(v.primary_market || '');
      setLanguage(v.language || '');
      setTimezone(v.timezone || '');
    }
  }, [data]);

  const submit = async () => {
    setBusy(true);
    try {
      await api.post(
        '/api/tenant-onboarding/identity',
        { name, primary_market: primaryMarket, language, timezone }
      );
      toast.success('Identità operativa aggiornata.');
      refresh();
      navigate('/dashboard');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Errore salvataggio identità');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="identity-page" style={{ padding: '40px 32px', maxWidth: 720, margin: '0 auto' }}>
      <button onClick={() => navigate(-1)} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: 'transparent', border: 0, color: '#7a7d83',
        cursor: 'pointer', fontSize: 13, marginBottom: 20,
      }}>
        <ArrowLeft size={14} /> Indietro
      </button>

      <div style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7a7d83', marginBottom: 6 }}>
        Activation Foundation™ · Step 0
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0, color: '#0c0e12' }}>
        Identità operativa
      </h1>
      <p style={{ fontSize: 14, color: '#5a5d63', marginTop: 8, marginBottom: 28, lineHeight: 1.5 }}>
        Quattro campi essenziali per dare allo studio una identità operativa coerente: nome, mercato di riferimento, lingua principale e timezone.
      </p>

      <Field label="Nome dello studio" required>
        <input
          data-testid="identity-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="es. Studio Rossi Architetti"
          style={inputStyle}
        />
      </Field>

      <Field label="Mercato principale" required>
        <select
          data-testid="identity-market"
          value={primaryMarket}
          onChange={(e) => setPrimaryMarket(e.target.value)}
          style={inputStyle}
        >
          <option value="">— Seleziona —</option>
          {MARKETS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </Field>

      <Field label="Lingua principale" required>
        <select
          data-testid="identity-language"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          style={inputStyle}
        >
          <option value="">— Seleziona —</option>
          {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
      </Field>

      <Field label="Timezone" required>
        <select
          data-testid="identity-timezone"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          style={inputStyle}
        >
          <option value="">— Seleziona —</option>
          {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
        </select>
      </Field>

      <button
        data-testid="identity-save"
        onClick={submit}
        disabled={busy || !name.trim() || !primaryMarket || !language || !timezone}
        style={{
          marginTop: 24,
          padding: '12px 24px', fontSize: 14, fontWeight: 500, color: '#ffffff',
          background: '#0c0e12', border: 0, borderRadius: 8, cursor: 'pointer',
          opacity: (busy || !name.trim() || !primaryMarket || !language || !timezone) ? 0.5 : 1,
          display: 'inline-flex', alignItems: 'center', gap: 8,
        }}
      >
        <CheckCircle2 size={16} /> {busy ? 'Salvo…' : 'Salva e continua'}
      </button>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 16 }}>
      <span style={{ display: 'block', fontSize: 12, color: '#5a5d63', marginBottom: 6 }}>
        {label} {required && <span style={{ color: '#dc2626' }}>*</span>}
      </span>
      {children}
    </label>
  );
}

const inputStyle = {
  width: '100%', padding: '10px 12px', fontSize: 14, color: '#0c0e12',
  border: '1px solid #e6e6e8', borderRadius: 8, outline: 'none', background: '#ffffff',
};
