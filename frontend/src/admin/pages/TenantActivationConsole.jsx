import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import { adminAuth } from '../adminApi';
import TenantActivationModal from '../components/TenantActivationModal';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const BUCKET_META = [
  { key: 'new',              label: 'Nuovi lead',                tone: '#00C9B3' },
  { key: 'under_review',     label: 'In revisione',              tone: '#7AA7FF' },
  { key: 'qualified',        label: 'Qualificati',               tone: '#A0E0B6' },
  { key: 'rejected',         label: 'Non allineati',             tone: '#888888' },
  { key: 'awaiting_founder', label: 'Attesa Founder activation', tone: '#F0B95F' },
];

const STATUS_OPTIONS = [
  { value: 'received',    label: 'Ricevuta'      },
  { value: 'reviewing',   label: 'In revisione'  },
  { value: 'contacted',   label: 'Contattato'    },
  { value: 'qualified',   label: 'Qualificato'   },
  { value: 'not_aligned', label: 'Non allineato' },
  // 'activated' is intentionally NOT a select option: it is reached only
  // through the dedicated activation modal (confirms tenant slug + sends
  // the founder magic-link invitation in one curatorial step).
];

const TenantActivationConsole = () => {
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get('focus');
  const [data, setData] = useState(null);
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [activationFor, setActivationFor] = useState(null); // request id when modal open

  const fetchPipeline = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${BACKEND}/api/admin/tenant-activation/pipeline`, {
        headers: adminAuth.headers(),
      });
      setData(r.data);
      if (focusId) {
        const all = Object.values(r.data.buckets || {}).flat();
        const found = all.find((x) => x.id === focusId);
        if (found) setSelectedReq(found);
      }
    } catch (e) {
      setData({ buckets: {}, counts: {}, total: 0, error: e.response?.data?.detail || e.message });
    } finally { setLoading(false); }
  };

  const fetchEmails = async (requestId) => {
    try {
      const r = await axios.get(
        `${BACKEND}/api/admin/tenant-activation/emails?request_id=${requestId}`,
        { headers: adminAuth.headers() },
      );
      setEmails(r.data?.items || []);
    } catch { setEmails([]); }
  };

  useEffect(() => { fetchPipeline(); }, []); // eslint-disable-line
  useEffect(() => { if (selectedReq) fetchEmails(selectedReq.id); }, [selectedReq]);

  const updateStatus = async (id, status) => {
    setSavingId(id);
    try {
      await axios.patch(`${BACKEND}/api/admin/studio/requests/${id}`,
        { status }, { headers: adminAuth.headers() });
      await fetchPipeline();
      if (selectedReq?.id === id) {
        setSelectedReq((prev) => ({ ...prev, status }));
        fetchEmails(id);
      }
    } finally { setSavingId(null); }
  };

  if (loading) {
    return <div style={{ padding: '3rem', color: '#666' }}>Caricamento pipeline…</div>;
  }

  if (data?.error) {
    return (
      <div style={{ padding: '3rem', color: '#c33', fontFamily: 'Inter, sans-serif' }}>
        Errore: {data.error}
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem 2.5rem', maxWidth: 1400, margin: '0 auto' }}
         data-testid="tenant-activation-console">
      <header style={{ marginBottom: '2.5rem' }}>
        <p style={{
          fontSize: '0.72rem', letterSpacing: '0.22em', textTransform: 'uppercase',
          color: '#888', marginBottom: '0.5rem', fontFamily: 'Inter, sans-serif',
        }}>Tenant Activation</p>
        <h1 style={{
          fontFamily: 'DM Serif Display, serif', fontSize: '2.2rem',
          letterSpacing: '-0.01em', color: '#FFF', fontWeight: 400,
        }}>Pipeline di attivazione studi</h1>
        <p style={{ color: '#999', marginTop: '0.6rem', fontFamily: 'Inter, sans-serif',
                    maxWidth: 760, lineHeight: 1.55 }}>
          Tutte le candidature in ordine di stadio. Ogni transizione di status invia
          una comunicazione editoriale al referente dello studio.
        </p>
      </header>

      {/* KPI counters */}
      <div style={{ display: 'flex', gap: 14, marginBottom: '2rem', flexWrap: 'wrap' }}>
        {BUCKET_META.map((b) => (
          <div key={b.key} data-testid={`bucket-counter-${b.key}`}
               style={{
                 padding: '0.95rem 1.3rem', minWidth: 165,
                 background: 'rgba(255,255,255,0.04)',
                 borderLeft: `3px solid ${b.tone}`,
                 fontFamily: 'Inter, sans-serif',
               }}>
            <p style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase',
                        letterSpacing: '0.14em' }}>{b.label}</p>
            <p style={{ fontSize: '1.6rem', color: '#FFF', marginTop: 4, fontWeight: 300 }}>
              {data?.counts?.[b.key] || 0}
            </p>
          </div>
        ))}
      </div>

      {/* Pipeline grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {BUCKET_META.map((b) => {
          const items = data?.buckets?.[b.key] || [];
          return (
            <div key={b.key} data-testid={`bucket-${b.key}`}
                 style={{
                   background: 'rgba(255,255,255,0.02)',
                   border: '1px solid rgba(255,255,255,0.06)',
                   padding: '1.2rem 1.1rem', minHeight: 240,
                 }}>
              <p style={{
                fontFamily: 'Inter, sans-serif', fontSize: '0.7rem',
                color: b.tone, letterSpacing: '0.18em', textTransform: 'uppercase',
                marginBottom: 12,
              }}>{b.label} · {items.length}</p>
              {items.length === 0 ? (
                <p style={{ color: '#555', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem' }}>
                  Nessuna candidatura.
                </p>
              ) : items.map((it) => (
                <button key={it.id}
                  data-testid={`request-card-${it.id}`}
                  onClick={() => setSelectedReq(it)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    background: selectedReq?.id === it.id ? 'rgba(0,201,179,0.08)' : 'rgba(255,255,255,0.02)',
                    border: '1px solid ' + (selectedReq?.id === it.id ? 'var(--mood-teal, #00C9B3)' : 'rgba(255,255,255,0.06)'),
                    padding: '0.85rem 1rem', marginBottom: 8, cursor: 'pointer',
                    color: '#FFF', fontFamily: 'Inter, sans-serif',
                  }}>
                  <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>{it.studio_name || '—'}</p>
                  <p style={{ fontSize: '0.74rem', color: '#888', marginTop: 4 }}>
                    {it.reference} · {it.contact_name || '—'}
                  </p>
                  <p style={{ fontSize: '0.72rem', color: '#666', marginTop: 4 }}>
                    {it.city || '—'} · {it.country || '—'}
                  </p>
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {/* Detail drawer */}
      {selectedReq && (
        <div data-testid="request-detail-drawer"
             style={{
               position: 'fixed', right: 0, top: 0, bottom: 0, width: '36%', minWidth: 420,
               background: 'rgba(20,20,22,0.98)', borderLeft: '1px solid rgba(255,255,255,0.08)',
               padding: '2rem', overflowY: 'auto', zIndex: 60, color: '#FFF',
               fontFamily: 'Inter, sans-serif', backdropFilter: 'blur(20px)',
             }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
            <p style={{ fontSize: '0.72rem', letterSpacing: '0.2em', color: '#888' }}>
              {selectedReq.reference}
            </p>
            <button onClick={() => setSelectedReq(null)} style={{
              background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.3rem',
            }} data-testid="drawer-close">×</button>
          </div>

          <h2 style={{
            fontFamily: 'DM Serif Display, serif', fontSize: '1.6rem',
            fontWeight: 400, marginBottom: 8,
          }}>{selectedReq.studio_name || 'Studio'}</h2>
          <p style={{ color: '#999', fontSize: '0.9rem', marginBottom: 24 }}>
            {selectedReq.contact_name || '—'} · {selectedReq.contact_email || '—'}<br/>
            Archetipo: {selectedReq.archetype || '—'}
          </p>

          {/* ── Geografia commerciale ─────────────────────────── */}
          {selectedReq.geo && (
            <div data-testid="drawer-geo" style={{
              marginBottom: 24,
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8, padding: '14px 16px',
              background: 'rgba(255,255,255,0.02)',
            }}>
              <p style={{ fontSize: '0.7rem', letterSpacing: '0.18em',
                          textTransform: 'uppercase', color: '#888',
                          marginBottom: 12 }}>Geografia commerciale</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8,
                            fontSize: '0.86rem', color: '#DDD' }}>
                <div>
                  <span style={{ color: '#777' }}>Mercato MOOD: </span>
                  <span data-testid="geo-op-market">
                    {selectedReq.geo.operating_market_label
                      || selectedReq.geo.operating_market_code
                      || '—'}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#777' }}>Sede: </span>
                  <span data-testid="geo-headquarter">
                    {selectedReq.city || '—'}
                    {selectedReq.geo.headquarter_region
                      ? `, ${selectedReq.geo.headquarter_region}`
                      : ''}
                    {selectedReq.geo.headquarter_country_iso
                      ? ` · ${selectedReq.geo.headquarter_country_iso}`
                      : (selectedReq.country ? `, ${selectedReq.country}` : '')}
                  </span>
                </div>
                {(selectedReq.geo.headquarter_lat != null && selectedReq.geo.headquarter_lng != null) && (
                  <div data-testid="geo-coords">
                    <span style={{ color: '#777' }}>Coordinate: </span>
                    {Number(selectedReq.geo.headquarter_lat).toFixed(4)}° N · {Number(selectedReq.geo.headquarter_lng).toFixed(4)}° E
                  </div>
                )}
                {selectedReq.geo.mapbox_place_id && (
                  <div data-testid="geo-mapbox-id" style={{ fontSize: '0.74rem', color: '#666' }}>
                    Mapbox: {selectedReq.geo.mapbox_place_id}
                  </div>
                )}
                <div data-testid="geo-targets">
                  <span style={{ color: '#777' }}>Paesi target: </span>
                  {(selectedReq.geo.target_countries || []).length === 0
                    ? <span style={{ color: '#555' }}>—</span>
                    : (
                      <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6,
                                     marginTop: 4 }}>
                        {(selectedReq.geo.target_countries || []).map((tc) => (
                          <span key={tc.iso2} data-testid={`geo-target-${tc.iso2}`} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '4px 10px',
                            background: tc.status === 'active'
                              ? 'rgba(0,201,179,0.15)'
                              : 'rgba(255,255,255,0.05)',
                            border: '1px solid ' + (tc.status === 'active'
                              ? 'rgba(0,201,179,0.45)'
                              : 'rgba(255,255,255,0.15)'),
                            borderRadius: 999, fontSize: '0.74rem', color: '#DDD',
                          }}>
                            <span style={{
                              fontSize: '0.66rem', opacity: 0.7,
                            }}>{tc.priority}</span>
                            <span>{tc.iso2}</span>
                            <span style={{
                              fontSize: '0.62rem', opacity: 0.6, letterSpacing: '0.04em',
                            }}>{tc.status === 'active' ? '· attivo' : '· planned'}</span>
                          </span>
                        ))}
                      </span>
                    )}
                </div>
                <div style={{ fontSize: '0.74rem', color: '#666', marginTop: 4 }}>
                  Locale: {selectedReq.locale || '—'}
                </div>
              </div>
            </div>
          )}

          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: '0.74rem', letterSpacing: '0.16em', textTransform: 'uppercase',
                        color: '#888', marginBottom: 8 }}>Status</p>
            <select
              data-testid="status-select"
              value={selectedReq.status}
              disabled={savingId === selectedReq.id}
              onChange={(e) => updateStatus(selectedReq.id, e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.04)', color: '#FFF',
                border: '1px solid rgba(255,255,255,0.12)', padding: '0.7rem 1rem',
                fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', width: '100%',
              }}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            {savingId === selectedReq.id && (
              <p style={{ fontSize: '0.78rem', color: '#888', marginTop: 6 }}>
                Aggiornamento + invio email…
              </p>
            )}
          </div>

          {/* ── Activation CTA (visible until status='activated') ───── */}
          {selectedReq.status !== 'activated' && (
            <div style={{ marginBottom: 24 }}>
              <button
                data-testid="open-activation-modal"
                onClick={() => setActivationFor(selectedReq.id)}
                style={{
                  width: '100%', background: '#00C9B3', color: '#000',
                  border: 'none', padding: '0.85rem 1.2rem', borderRadius: 8,
                  fontFamily: 'Inter, sans-serif', fontSize: '0.92rem',
                  fontWeight: 600, cursor: 'pointer',
                  letterSpacing: '0.04em',
                }}>
                Attiva Studio & invia invito Founder
              </button>
              <p style={{
                fontSize: '0.72rem', color: '#666', marginTop: 6, lineHeight: 1.5,
              }}>
                Crea il tenant, l'utente Founder e invia il magic link (30 giorni).
              </p>
            </div>
          )}

          {selectedReq.status === 'activated' && (
            <div data-testid="status-activated-banner" style={{
              marginBottom: 24, padding: '0.85rem 1rem',
              background: 'rgba(160,224,182,0.08)',
              border: '1px solid rgba(160,224,182,0.28)',
              borderRadius: 8, fontSize: '0.85rem', color: '#A0E0B6',
            }}>
              Studio attivato. Il magic link è stato inviato al Founder.
            </div>
          )}

          {/* Email log */}
          <div>
            <p style={{ fontSize: '0.74rem', letterSpacing: '0.16em', textTransform: 'uppercase',
                        color: '#888', marginBottom: 12 }}>Email inviate</p>
            {emails.length === 0 && (
              <p style={{ color: '#666', fontSize: '0.85rem' }}>Nessuna email registrata.</p>
            )}
            {emails.map((e) => (
              <div key={e.id} data-testid={`email-log-${e.template_key}`}
                   style={{
                     padding: '0.7rem 0.9rem', marginBottom: 6,
                     background: 'rgba(255,255,255,0.03)',
                     borderLeft: '2px solid ' + (
                       e.status === 'sent'    ? '#00C9B3' :
                       e.status === 'failed'  ? '#c54' : '#888'),
                     fontFamily: 'Inter, sans-serif', fontSize: '0.82rem',
                   }}>
                <p style={{ color: '#FFF' }}>{e.template_key}</p>
                <p style={{ color: '#888', fontSize: '0.74rem', marginTop: 4 }}>
                  {e.to_email} · {e.status} · {new Date(e.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activationFor && (
        <TenantActivationModal
          requestId={activationFor}
          onClose={() => setActivationFor(null)}
          onActivated={async (res) => {
            // Refresh pipeline + selected drawer state.
            await fetchPipeline();
            if (selectedReq?.id === activationFor) {
              setSelectedReq((prev) => ({ ...prev, status: 'activated' }));
              fetchEmails(activationFor);
            }
            // Don't auto-close — user clicks "Chiudi" in the success state.
          }}
        />
      )}
    </div>
  );
};

export default TenantActivationConsole;
