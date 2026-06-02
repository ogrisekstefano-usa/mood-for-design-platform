/**
 * StudioRequestsAdmin — Lists Guided Introduction Requests received
 * through the public /studio flow. Allows the advisor to change
 * status (received / reviewing / contacted / qualified / not_aligned /
 * activated) and to attach private notes.
 *
 * Premium concierge UI — quiet, table-less, magazine-like cards.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { adminAuth } from '../adminApi';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const STATUS_OPTIONS = [
  { key: 'received',     label: 'Received',     tone: '#00C9B3' },
  { key: 'reviewing',    label: 'Reviewing',    tone: '#FFB400' },
  { key: 'contacted',    label: 'Contacted',    tone: '#8FB7FF' },
  { key: 'qualified',    label: 'Qualified',    tone: '#A6FFB0' },
  { key: 'not_aligned',  label: 'Not aligned',  tone: '#FFB4A2' },
  // 'activated' is unreachable via direct status change — use the
  // dedicated Tenant Activation Console activation modal instead.
  { key: 'activated',    label: 'Activated',    tone: '#FFFFFF', readOnly: true },
];

const StudioRequestsAdmin = () => {
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState({}); // request_id → string

  const load = async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const r = await axios.get(`${BACKEND}/api/admin/studio/requests${params}`, {
        headers: adminAuth.headers(),
      });
      setRequests(r.data || []);
    } catch (e) {
      console.error('Failed to load studio requests', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter]);

  const setStatus = async (id, status) => {
    try {
      await axios.patch(`${BACKEND}/api/admin/studio/requests/${id}`, { status }, {
        headers: { ...adminAuth.headers(), 'Content-Type': 'application/json' },
      });
      setRequests((rs) => rs.map((r) => r.id === id ? { ...r, status } : r));
    } catch {}
  };

  const saveNotes = async (id) => {
    const notes = editingNotes[id] ?? '';
    try {
      await axios.patch(`${BACKEND}/api/admin/studio/requests/${id}`, {
        advisor_notes: notes,
      }, {
        headers: { ...adminAuth.headers(), 'Content-Type': 'application/json' },
      });
      setRequests((rs) => rs.map((r) => r.id === id ? { ...r, advisor_notes: notes } : r));
      setEditingNotes((m) => { const c = { ...m }; delete c[id]; return c; });
    } catch {}
  };

  return (
    <div data-testid="studio-requests-admin" style={{ color: '#fff' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={EYEBROW}>Studio Requests</p>
        <h1 style={HEADLINE}>Guided Introduction Requests</h1>
        <p style={SUBLEAD}>
          Studios who have completed the composition and await a tailored advisor follow-up.
        </p>
      </div>

      {/* Status filter chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
        <FilterChip
          active={statusFilter === null}
          onClick={() => setStatusFilter(null)}
          label="All"
          dataTestid="studio-filter-all"
        />
        {STATUS_OPTIONS.map((s) => (
          <FilterChip
            key={s.key}
            active={statusFilter === s.key}
            onClick={() => setStatusFilter(s.key)}
            label={s.label}
            color={s.tone}
            dataTestid={`studio-filter-${s.key}`}
          />
        ))}
      </div>

      {loading && (
        <p style={{ color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
          Loading composition requests…
        </p>
      )}

      {!loading && requests.length === 0 && (
        <p data-testid="studio-requests-empty"
            style={{ color: 'rgba(255,255,255,0.45)', fontStyle: 'italic',
                       padding: '32px 0' }}>
          No requests in this view yet — the next conversation will appear here.
        </p>
      )}

      {/* Requests list */}
      <div style={{ display: 'grid', gap: 18 }}>
        {requests.map((r) => {
          const statusTone = STATUS_OPTIONS.find((s) => s.key === r.status)?.tone || '#FFFFFF';
          const notesValue = editingNotes[r.id] ?? r.advisor_notes ?? '';
          return (
            <article
              key={r.id}
              data-testid={`studio-request-${r.id}`}
              style={{
                padding: 24,
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between',
                              alignItems: 'flex-start', gap: 20, marginBottom: 14 }}>
                <div>
                  <p style={{ fontSize: '0.66rem', letterSpacing: '0.28em',
                                 textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)',
                                 margin: 0 }}>
                    {r.reference}
                  </p>
                  <h3 style={{ margin: '6px 0 0 0',
                                  fontFamily: '"Playfair Display", serif',
                                  fontSize: '1.4rem', fontWeight: 400 }}>
                    {r.studio_name || r.contact_name || r.contact_email}
                  </h3>
                  <p style={{ margin: '6px 0 0 0', color: 'rgba(255,255,255,0.6)',
                                 fontSize: '0.85rem' }}>
                    {[r.city, r.country].filter(Boolean).join(', ') || '—'}
                  </p>
                </div>
                <select
                  value={r.status}
                  onChange={(e) => setStatus(r.id, e.target.value)}
                  data-testid={`studio-request-${r.id}-status`}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    color: statusTone,
                    border: `1px solid ${statusTone}40`,
                    borderRadius: 999,
                    padding: '6px 14px',
                    fontSize: '0.78rem',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.key} value={s.key} style={{ background: '#0A0A0B' }}
                            disabled={s.readOnly && r.status !== s.key}>
                      {s.label}{s.readOnly && r.status !== s.key ? ' (via modal)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Composition snapshot */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                              gap: 16, marginTop: 8, fontSize: '0.82rem',
                              color: 'rgba(255,255,255,0.78)' }}>
                <Cell label="Practice"        value={r.archetype || '—'} />
                <Cell label="Experiences"     value={(r.experiences || []).length
                                                       ? r.experiences.join(', ')
                                                       : '—'} />
                <Cell label="Temperament"     value={r.temperament || '—'} />
                <Cell label="Contact"         value={`${r.contact_name || ''} ${r.contact_role ? '· ' + r.contact_role : ''}`.trim() || '—'} />
                <Cell label="Email"           value={r.contact_email} />
                <Cell label="Phone"           value={`${r.phone_prefix || ''} ${r.phone_number || ''}`.trim() || '—'} />
                <Cell label="Website"         value={r.website || '—'} />
                <Cell label="Markets"         value={(r.markets || []).join(', ') || '—'} />
                <Cell label="Languages"       value={(r.languages || []).join(', ') || '—'} />
              </div>

              {r.notes && (
                <div style={{ marginTop: 16, padding: 14,
                                background: 'rgba(0,201,179,0.04)',
                                borderLeft: '2px solid #00C9B3' }}>
                  <p style={{ margin: 0, fontSize: '0.66rem',
                                 letterSpacing: '0.22em', textTransform: 'uppercase',
                                 color: '#00C9B3' }}>
                    Studio note
                  </p>
                  <p style={{ margin: '6px 0 0 0', color: 'rgba(255,255,255,0.82)',
                                 fontStyle: 'italic', fontSize: '0.92rem',
                                 lineHeight: 1.5 }}>
                    {r.notes}
                  </p>
                </div>
              )}

              <div style={{ marginTop: 16 }}>
                <label style={{ fontSize: '0.66rem', letterSpacing: '0.22em',
                                  textTransform: 'uppercase',
                                  color: 'rgba(255,255,255,0.45)' }}>
                  Advisor notes
                </label>
                <textarea
                  rows={2}
                  value={notesValue}
                  onChange={(e) => setEditingNotes((m) => ({ ...m, [r.id]: e.target.value }))}
                  data-testid={`studio-request-${r.id}-notes`}
                  style={{
                    width: '100%', marginTop: 8,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 6,
                    color: '#FFF', padding: 10,
                    fontSize: '0.86rem', fontFamily: 'inherit', resize: 'vertical',
                  }}
                />
                {editingNotes[r.id] !== undefined && (
                  <button
                    onClick={() => saveNotes(r.id)}
                    data-testid={`studio-request-${r.id}-notes-save`}
                    style={{
                      marginTop: 8,
                      background: '#00C9B3', color: '#000',
                      border: 'none', borderRadius: 999,
                      padding: '8px 18px', fontSize: '0.74rem',
                      letterSpacing: '0.14em', textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}
                  >
                    Save
                  </button>
                )}
              </div>

              <p style={{ marginTop: 16,
                             color: 'rgba(255,255,255,0.35)',
                             fontSize: '0.7rem' }}>
                Received {new Date(r.created_at).toLocaleString()} · locale {r.locale}
              </p>
            </article>
          );
        })}
      </div>
    </div>
  );
};

const Cell = ({ label, value }) => (
  <div>
    <p style={{ margin: 0, fontSize: '0.62rem', letterSpacing: '0.22em',
                  textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>
      {label}
    </p>
    <p style={{ margin: '4px 0 0 0', color: 'rgba(255,255,255,0.85)',
                  fontSize: '0.86rem' }}>
      {value}
    </p>
  </div>
);

const FilterChip = ({ active, onClick, label, color, dataTestid }) => (
  <button
    onClick={onClick}
    data-testid={dataTestid}
    style={{
      appearance: 'none',
      background: active ? 'rgba(0,201,179,0.10)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${active ? (color || '#00C9B3') : 'rgba(255,255,255,0.10)'}`,
      color: active ? (color || '#00C9B3') : 'rgba(255,255,255,0.7)',
      borderRadius: 999, padding: '6px 14px',
      fontSize: '0.78rem', cursor: 'pointer',
      transition: 'all 200ms ease',
    }}
  >
    {label}
  </button>
);

const EYEBROW = {
  fontSize: '0.66rem', letterSpacing: '0.32em', textTransform: 'uppercase',
  color: '#00C9B3', margin: 0,
};
const HEADLINE = {
  margin: '6px 0 0 0',
  fontFamily: '"Playfair Display", serif', fontSize: '2rem',
  fontWeight: 400, color: '#FFF',
};
const SUBLEAD = {
  marginTop: 10, color: 'rgba(255,255,255,0.6)',
  fontSize: '0.92rem', maxWidth: '60ch',
};

export default StudioRequestsAdmin;
