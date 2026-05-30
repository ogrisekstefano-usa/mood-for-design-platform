/* eslint-disable react/prop-types */
import React, { useEffect, useState } from 'react';
import { adminApi } from '../adminApi';

/* Curatorial tokens (mirror CommandOverview) */
const tokens = {
  bg: '#08090C', surface: '#0C0E13',
  hair: 'rgba(255,255,255,0.06)', hairBold: 'rgba(255,255,255,0.12)',
  teal: '#00C9B3', danger: '#FFB4A2',
  ink: '#FFFFFF',
  fade1: 'rgba(255,255,255,0.92)', fade2: 'rgba(255,255,255,0.68)', fade3: 'rgba(255,255,255,0.42)',
};
const eyebrow = {
  fontFamily: 'Montserrat, sans-serif',
  fontSize: '0.66rem', letterSpacing: '0.32em',
  textTransform: 'uppercase', color: tokens.teal, marginBottom: '0.6rem',
};
const headlineL = {
  fontFamily: 'Playfair Display, serif', fontWeight: 400,
  fontSize: '2.5rem', lineHeight: 1.12, color: tokens.fade1, marginBottom: '0.6rem',
};
const sublead = {
  fontFamily: 'Playfair Display, serif', fontStyle: 'italic',
  color: tokens.fade2, fontSize: '1.05rem', lineHeight: 1.55, maxWidth: 760,
};
const inputStyle = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: `1px solid ${tokens.hairBold}`, borderRadius: 6,
  padding: '0.75rem 0.9rem', color: tokens.ink, fontSize: '0.92rem', outline: 'none',
  fontFamily: 'Inter, sans-serif',
};
const labelStyle = {
  display: 'block',
  fontFamily: 'Montserrat, sans-serif',
  fontSize: '0.65rem', letterSpacing: '0.22em', textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.55)', marginBottom: 8,
};

const Field = ({ label, value, onChange, testid, type = 'text', placeholder = '' }) => (
  <label style={{ display: 'block' }}>
    <span style={labelStyle}>{label}</span>
    <input type={type} value={value} placeholder={placeholder}
           onChange={(e) => onChange(e.target.value)}
           style={inputStyle}
           onFocus={(e) => (e.target.style.borderColor = tokens.teal)}
           onBlur={(e) => (e.target.style.borderColor = tokens.hairBold)}
           data-testid={testid} />
  </label>
);

const AdvisorsAdmin = () => {
  const [list, setList]   = useState(null);
  const [err, setErr]     = useState(null);
  const [form, setForm]   = useState({ name: '', email: '', advisor_code: '', commission_percentage: '10' });
  const [busy, setBusy]   = useState(false);
  const [toast, setToast] = useState(null);

  const fetchList = async () => {
    try {
      const r = await adminApi.listAdvisors();
      setList(r.data || []);
    } catch (e) {
      setErr(e?.response?.status === 403 ? 'forbidden' : 'error');
    }
  };
  useEffect(() => { fetchList(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await adminApi.createAdvisor({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        advisor_code: form.advisor_code.trim() || undefined,
        commission_percentage: parseFloat(form.commission_percentage) || 10,
      });
      setToast({
        kind: 'ok',
        msg: r.data.user_was_created
          ? `Nuovo Advisor creato · codice ${r.data.advisor_code}`
          : `Advisor aggiornato · codice ${r.data.advisor_code}`,
      });
      setForm({ name: '', email: '', advisor_code: '', commission_percentage: '10' });
      await fetchList();
    } catch (e2) {
      const detail = e2?.response?.data?.detail || 'Errore di salvataggio.';
      setToast({ kind: 'err', msg: detail });
    } finally {
      setBusy(false);
      setTimeout(() => setToast(null), 5000);
    }
  };

  const toggleStatus = async (a) => {
    const next = a.status === 'active' ? 'inactive' : 'active';
    try {
      await adminApi.updateAdvisor(a.profile_id, { status: next });
      await fetchList();
    } catch {
      setToast({ kind: 'err', msg: 'Impossibile aggiornare lo stato.' });
    }
  };

  if (err === 'forbidden') {
    return (
      <div style={{ padding: '4rem 3rem', color: tokens.fade2,
                    fontFamily: 'Playfair Display, serif', fontStyle: 'italic' }}>
        Questa lettura è riservata al Super Admin di MOOD.
      </div>
    );
  }

  return (
    <div data-testid="advisors-admin" style={{
      background: tokens.bg, color: tokens.ink, minHeight: '100vh',
      padding: '3.5rem 3rem 5rem',
    }}>
      <header style={{ marginBottom: '2.5rem' }}>
        <p style={eyebrow}>MOOD · Advisor Program™</p>
        <h1 style={headlineL}>Le voci della rete</h1>
        <p style={sublead}>Inviti, attivazioni, commissioni di partenza. Ogni Advisor riceve un link magic-only per accedere alla propria Console.</p>
      </header>

      {/* Form */}
      <section data-testid="create-advisor-form" style={{
        background: tokens.surface, border: `1px solid ${tokens.hair}`,
        padding: '2rem 2.5rem 2.5rem', marginBottom: '3rem',
      }}>
        <p style={{ ...eyebrow, color: tokens.fade3, marginBottom: '0.4rem' }}>Nuovo Advisor</p>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400,
                     fontSize: '1.5rem', color: tokens.fade1, marginBottom: '1.5rem' }}>
          Apri un canale.
        </h2>

        <form onSubmit={submit} style={{ display: 'grid',
                                          gridTemplateColumns: 'repeat(4, 1fr)',
                                          gap: '1.2rem' }}>
          <div style={{ gridColumn: 'span 2' }}>
            <Field label="Nome completo" value={form.name}
                   onChange={(v) => setForm({ ...form, name: v })}
                   testid="advisor-name"
                   placeholder="es. Raffaella Russo" />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <Field label="Email" value={form.email} type="email"
                   onChange={(v) => setForm({ ...form, email: v })}
                   testid="advisor-email"
                   placeholder="es. raffaella@moodfordesign.com" />
          </div>
          <div>
            <Field label="Codice Advisor (opz.)" value={form.advisor_code}
                   onChange={(v) => setForm({ ...form, advisor_code: v.toUpperCase() })}
                   testid="advisor-code"
                   placeholder="auto · ADV-XXXXXX" />
          </div>
          <div>
            <Field label="Commissione %" value={form.commission_percentage} type="number"
                   onChange={(v) => setForm({ ...form, commission_percentage: v })}
                   testid="advisor-commission" />
          </div>
          <div style={{ gridColumn: 'span 2', alignSelf: 'end' }}>
            <button type="submit" disabled={busy} className="btn-pill-teal"
                    data-testid="advisor-submit"
                    style={{ padding: '0.9rem 1.5rem', fontSize: '0.7rem',
                             opacity: busy ? 0.6 : 1, width: '100%' }}>
              {busy ? 'Salvataggio…' : 'Crea / Aggiorna Advisor'}
            </button>
          </div>
        </form>

        {toast && (
          <p data-testid="advisor-toast"
             style={{ marginTop: '1.2rem', fontFamily: 'Inter, sans-serif',
                       fontSize: '0.85rem',
                       color: toast.kind === 'ok' ? tokens.teal : tokens.danger }}>
            {toast.msg}
          </p>
        )}
        <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: tokens.fade3,
                     fontFamily: 'Inter, sans-serif', lineHeight: 1.55 }}>
          Al primo accesso l'Advisor riceve un magic-link via email da <code style={{ color: tokens.fade2 }}>/accedi</code>. Una volta dentro, gli viene chiesto di impostare una password personale: dai login successivi entrerà con email + password (il magic-link resta come fallback in caso di smarrimento).
        </p>
      </section>

      {/* List */}
      <section data-testid="advisors-list" style={{
        background: tokens.surface, border: `1px solid ${tokens.hair}`,
      }}>
        <div style={{ padding: '1.4rem 2rem', borderBottom: `1px solid ${tokens.hair}` }}>
          <p style={eyebrow}>Registro Advisor</p>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', color: tokens.fade2, margin: 0 }}>
            {(list || []).length} advisor in totale.
          </p>
        </div>
        {list === null ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div className="w-8 h-8 border border-[#00C9B3] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : list.length === 0 ? (
          <p style={{ padding: '2.5rem', color: tokens.fade3, fontStyle: 'italic',
                       fontFamily: 'Playfair Display, serif' }}>
            Nessun advisor ancora. Inviane uno qui sopra.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Advisor', 'Codice', 'Stato', 'Commissione', 'Relazioni', 'Ultimo accesso', ''].map((h) => (
                  <th key={h} style={{
                    fontFamily: 'Montserrat, sans-serif', fontSize: '0.62rem',
                    letterSpacing: '0.22em', textTransform: 'uppercase',
                    color: tokens.fade3, padding: '0.85rem 1rem', textAlign: 'left',
                    borderBottom: `1px solid ${tokens.hair}`, fontWeight: 600,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.profile_id} data-testid={`advisor-row-${a.advisor_code}`}>
                  <td style={cellStyle()}>
                    <div>{a.name}</div>
                    <div style={{ color: tokens.fade3, fontSize: '0.78rem' }}>{a.email}</div>
                  </td>
                  <td style={cellStyle(tokens.fade2)}><code>{a.advisor_code}</code></td>
                  <td style={cellStyle()}>
                    <span style={{
                      display: 'inline-block', padding: '0.2rem 0.6rem',
                      fontSize: '0.7rem', letterSpacing: '0.14em',
                      textTransform: 'uppercase', borderRadius: 999,
                      background: a.status === 'active' ? 'rgba(0,201,179,0.12)' : 'rgba(255,180,162,0.10)',
                      color:      a.status === 'active' ? tokens.teal           : tokens.danger,
                    }}>{a.status}</span>
                  </td>
                  <td style={cellStyle(tokens.fade2)}>{a.commission_percentage}%</td>
                  <td style={cellStyle()}>{a.relations_count}</td>
                  <td style={cellStyle(tokens.fade2)}>
                    {a.user_last_login
                      ? new Date(a.user_last_login).toLocaleDateString('it-IT')
                      : <em style={{ color: tokens.fade3 }}>mai</em>}
                  </td>
                  <td style={{ ...cellStyle(), textAlign: 'right' }}>
                    <button onClick={() => toggleStatus(a)}
                            data-testid={`advisor-toggle-${a.advisor_code}`}
                            style={{
                              background: 'transparent',
                              border: `1px solid ${tokens.hairBold}`,
                              color: tokens.fade2,
                              padding: '0.35rem 0.8rem', borderRadius: 999,
                              fontSize: '0.7rem', letterSpacing: '0.12em',
                              textTransform: 'uppercase', cursor: 'pointer',
                              fontFamily: 'Montserrat, sans-serif',
                            }}>
                      {a.status === 'active' ? 'Disattiva' : 'Riattiva'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

const cellStyle = (color) => ({
  padding: '1rem',
  fontFamily: 'Inter, sans-serif', fontSize: '0.86rem',
  color: color || tokens.fade1, borderBottom: `1px solid ${tokens.hair}`,
  verticalAlign: 'top',
});

export default AdvisorsAdmin;
